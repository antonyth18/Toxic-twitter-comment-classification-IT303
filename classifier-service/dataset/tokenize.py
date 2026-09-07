"""
DistilBERT tokenization / dataset preparation stage.

Pipeline stage (in order):
    Processed CSV (data/processed/{train,validation,test}.csv)
        -> load + validate columns
        -> DistilBERT tokenizer (input_ids, attention_mask; truncation only,
           NO padding here -- padding is deferred to a DataCollator at
           DataLoader time, see get_data_collator())
        -> attach 6-dim multi-label targets + original id
        -> Hugging Face Dataset / DatasetDict
        -> saved to disk, ready for the model-training stage

This stage does NOT instantiate or fine-tune a model. Its only output is a
tokenized, label-attached dataset plus a saved tokenizer.

Run from the classifier-service/ directory:
    python -m dataset.tokenize

NOTE: must be run as a module (`-m dataset.tokenize`), not as a script
(`python dataset/tokenize.py`). Running it as a script puts this file's own
directory first on sys.path, which shadows Python's stdlib `tokenize`
module (imported internally by `inspect`/`dataclasses`) and crashes with a
circular-import error.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from datasets import Dataset, DatasetDict
from transformers import AutoTokenizer, DataCollatorWithPadding, PreTrainedTokenizerBase

LABEL_COLUMNS: list[str] = [
    "toxic",
    "severe_toxic",
    "obscene",
    "threat",
    "insult",
    "identity_hate",
]
TEXT_COLUMN = "comment_text"
ID_COLUMN = "id"
REQUIRED_COLUMNS = [ID_COLUMN, TEXT_COLUMN, *LABEL_COLUMNS]

DEFAULT_MODEL_NAME = "distilbert-base-uncased"
DEFAULT_MAX_LENGTH = 256

# Paths, relative to this file's parent (classifier-service/).
_SERVICE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = _SERVICE_ROOT / "data" / "processed"
DEFAULT_TOKENIZED_OUTPUT_DIR = _SERVICE_ROOT / "data" / "processed" / "tokenized"
# Tokenizer files are saved here so training, evaluation, and production
# inference all load the *exact same* tokenizer instead of re-resolving
# "distilbert-base-uncased" from the Hub each time (offline-safe, version-pinned).
DEFAULT_TOKENIZER_DIR = _SERVICE_ROOT / "tokenizer"


class MissingColumnsError(ValueError):
    """Raised when a required column is absent from a processed CSV."""


@dataclass
class SplitLengthStats:
    """Token-length statistics for one split, computed WITHOUT truncation
    so we can honestly report how much max_length actually cuts off."""

    count: int
    min: int
    max: int
    mean: float
    median: float
    p90: float
    p95: float
    truncated_count: int
    truncated_pct: float


@dataclass
class TokenizationReport:
    model_name: str
    max_length: int
    split_sizes: dict[str, int] = field(default_factory=dict)
    length_stats: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps(self.__dict__, indent=2, default=lambda o: o.__dict__)


# ---------------------------------------------------------------------------
# 1. Load + validate processed CSVs
# ---------------------------------------------------------------------------

def load_and_validate_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Processed dataset not found at {path}. Run preprocessing/preprocess.py first."
        )
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise MissingColumnsError(
            f"{path} is missing required columns: {missing}. "
            f"Expected columns: {REQUIRED_COLUMNS}."
        )
    if len(df) == 0:
        raise ValueError(f"{path} contains no rows.")
    return df


def load_processed_splits(data_dir: Path) -> dict[str, pd.DataFrame]:
    return {
        "train": load_and_validate_csv(data_dir / "train.csv"),
        "validation": load_and_validate_csv(data_dir / "validation.csv"),
        "test": load_and_validate_csv(data_dir / "test.csv"),
    }


# ---------------------------------------------------------------------------
# 2. Tokenizer
# ---------------------------------------------------------------------------

def load_tokenizer(model_name: str) -> PreTrainedTokenizerBase:
    # AutoTokenizer keeps the model name configurable (e.g. swapping to a
    # different checkpoint later) without changing any downstream code.
    return AutoTokenizer.from_pretrained(model_name)


def save_tokenizer(tokenizer: PreTrainedTokenizerBase, save_dir: Path) -> None:
    """Persist the tokenizer so training/eval/inference all load the exact
    same vocab + config from disk instead of separately resolving the model
    name (which could silently drift if the Hub checkpoint ever changes)."""
    save_dir.mkdir(parents=True, exist_ok=True)
    tokenizer.save_pretrained(save_dir)


def get_data_collator(tokenizer: PreTrainedTokenizerBase) -> DataCollatorWithPadding:
    """Dynamic-padding collator for use with a PyTorch DataLoader later.

    We deliberately do NOT pad every example to max_length during dataset
    preparation -- that would waste memory padding short comments (median
    ~36 words) out to the same length as the longest one. Instead each
    example keeps its own (truncated, unpadded) length here, and this
    collator pads each *batch* only up to that batch's longest example.
    """
    return DataCollatorWithPadding(tokenizer=tokenizer, padding=True)


# ---------------------------------------------------------------------------
# 3/5/6. Build the raw (pre-tokenization) HF Dataset: text + labels + id
# ---------------------------------------------------------------------------

def build_raw_dataset(df: pd.DataFrame) -> Dataset:
    # Labels as float32: BCEWithLogitsLoss (the standard loss for multi-label
    # classification) expects float targets, not long/int.
    labels = df[LABEL_COLUMNS].to_numpy(dtype=np.float32).tolist()
    return Dataset.from_dict(
        {
            ID_COLUMN: df[ID_COLUMN].astype(str).tolist(),
            TEXT_COLUMN: df[TEXT_COLUMN].astype(str).tolist(),
            "labels": labels,
        }
    )


# ---------------------------------------------------------------------------
# 4. Tokenization (truncation only, no padding)
# ---------------------------------------------------------------------------

def tokenize_dataset(
    dataset: Dataset, tokenizer: PreTrainedTokenizerBase, max_length: int
) -> Dataset:
    def _tokenize_batch(batch: dict[str, list[Any]]) -> dict[str, Any]:
        return tokenizer(
            batch[TEXT_COLUMN],
            truncation=True,
            max_length=max_length,
            padding=False,  # dynamic padding happens later, per-batch, via the DataCollator
        )

    return dataset.map(_tokenize_batch, batched=True, desc="Tokenizing")


# ---------------------------------------------------------------------------
# 9. Sequence length statistics (computed without truncation)
# ---------------------------------------------------------------------------

def compute_length_stats(
    dataset: Dataset, tokenizer: PreTrainedTokenizerBase, max_length: int
) -> SplitLengthStats:
    """Tokenize without truncation purely to measure how long comments
    actually are, so we can report how many max_length=256 would cut off."""

    def _full_length_batch(batch: dict[str, list[Any]]) -> dict[str, Any]:
        encoded = tokenizer(batch[TEXT_COLUMN], truncation=False)
        return {"_full_length": [len(ids) for ids in encoded["input_ids"]]}

    lengths = dataset.map(
        _full_length_batch,
        batched=True,
        remove_columns=dataset.column_names,
        desc="Measuring untruncated lengths",
    )["_full_length"]
    lengths_arr = np.array(lengths)

    truncated_count = int((lengths_arr > max_length).sum())
    return SplitLengthStats(
        count=len(lengths_arr),
        min=int(lengths_arr.min()),
        max=int(lengths_arr.max()),
        mean=float(lengths_arr.mean()),
        median=float(np.median(lengths_arr)),
        p90=float(np.percentile(lengths_arr, 90)),
        p95=float(np.percentile(lengths_arr, 95)),
        truncated_count=truncated_count,
        truncated_pct=float(truncated_count / len(lengths_arr) * 100),
    )


# ---------------------------------------------------------------------------
# 8. Validation
# ---------------------------------------------------------------------------

def validate_tokenized_dataset(name: str, dataset: Dataset) -> None:
    if len(dataset) == 0:
        raise ValueError(f"'{name}' split is empty after tokenization.")

    for i in range(len(dataset)):
        example = dataset[i]
        if len(example["input_ids"]) != len(example["attention_mask"]):
            raise ValueError(
                f"'{name}' example {i} has mismatched input_ids/attention_mask lengths."
            )
        labels = example["labels"]
        if len(labels) != len(LABEL_COLUMNS):
            raise ValueError(
                f"'{name}' example {i} has {len(labels)} labels, expected {len(LABEL_COLUMNS)}."
            )
        if any(v not in (0.0, 1.0) for v in labels):
            raise ValueError(f"'{name}' example {i} has a non-binary label: {labels}.")


def print_example_previews(
    name: str, raw_df: pd.DataFrame, tokenized: Dataset, tokenizer: PreTrainedTokenizerBase, n: int = 3
) -> None:
    print(f"\n--- {name}: {n} example preview(s) ---")
    for i in range(min(n, len(tokenized))):
        example = tokenized[i]
        tokens = tokenizer.convert_ids_to_tokens(example["input_ids"])
        print(f"\n[{name}][{i}] id={example[ID_COLUMN]}")
        print(f"  original comment : {raw_df.iloc[i][TEXT_COLUMN][:200]!r}")
        print(f"  tokens           : {tokens}")
        print(f"  input_ids        : {example['input_ids']}")
        print(f"  attention_mask   : {example['attention_mask']}")
        print(f"  labels           : {example['labels']}  (order: {LABEL_COLUMNS})")


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def run_pipeline(
    data_dir: Path,
    output_dir: Path,
    tokenizer_dir: Path,
    model_name: str,
    max_length: int,
    num_preview_examples: int,
) -> TokenizationReport:
    raw_frames = load_processed_splits(data_dir)

    tokenizer = load_tokenizer(model_name)
    save_tokenizer(tokenizer, tokenizer_dir)

    report = TokenizationReport(model_name=model_name, max_length=max_length)
    tokenized_splits: dict[str, Dataset] = {}

    for split_name, df in raw_frames.items():
        raw_dataset = build_raw_dataset(df)
        tokenized = tokenize_dataset(raw_dataset, tokenizer, max_length)
        validate_tokenized_dataset(split_name, tokenized)

        # Tensors for the fields the model consumes; id/comment_text stay as
        # plain Python values (output_all_columns=True) for debugging/eval.
        tokenized.set_format(
            type="torch",
            columns=["input_ids", "attention_mask", "labels"],
            output_all_columns=True,
        )

        tokenized_splits[split_name] = tokenized
        report.split_sizes[split_name] = len(tokenized)
        report.length_stats[split_name] = compute_length_stats(raw_dataset, tokenizer, max_length)

        print_example_previews(split_name, df, tokenized, tokenizer, n=num_preview_examples)

    dataset_dict = DatasetDict(tokenized_splits)
    output_dir.mkdir(parents=True, exist_ok=True)
    # Reset format before saving -- Arrow storage should stay backend-agnostic;
    # set_format("torch") is re-applied by load_dataset_dict() below.
    dataset_dict.reset_format()
    dataset_dict.save_to_disk(str(output_dir))

    report_path = output_dir / "tokenization_report.json"
    report_path.write_text(report.to_json())

    print_summary(report, report_path)
    return report


def load_dataset_dict(output_dir: Path) -> DatasetDict:
    """Convenience loader for the training stage: reloads the saved
    tokenized DatasetDict and restores the torch tensor format."""
    dataset_dict = DatasetDict.load_from_disk(str(output_dir))
    dataset_dict.set_format(
        type="torch", columns=["input_ids", "attention_mask", "labels"], output_all_columns=True
    )
    return dataset_dict


def print_summary(report: TokenizationReport, report_path: Path) -> None:
    train_stats: SplitLengthStats = report.length_stats["train"]
    print("\n=== Tokenization Summary ===")
    print(f"Tokenizer: {report.model_name}")
    print(f"Max length: {report.max_length}")
    print(f"Train examples: {report.split_sizes['train']}")
    print(f"Validation examples: {report.split_sizes['validation']}")
    print(f"Test examples: {report.split_sizes['test']}")
    print(f"Average token length (train): {train_stats.mean:.1f}")
    print(f"95th percentile (train): {train_stats.p95:.1f}")
    print(
        f"Truncated examples (train): {train_stats.truncated_count} "
        f"({train_stats.truncated_pct:.2f}%)"
    )
    print(f"Labels: {len(LABEL_COLUMNS)} ({LABEL_COLUMNS})")
    print(f"Full report written to: {report_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_TOKENIZED_OUTPUT_DIR)
    parser.add_argument("--tokenizer-dir", type=Path, default=DEFAULT_TOKENIZER_DIR)
    parser.add_argument("--model-name", type=str, default=DEFAULT_MODEL_NAME)
    parser.add_argument("--max-length", type=int, default=DEFAULT_MAX_LENGTH)
    parser.add_argument("--num-preview-examples", type=int, default=3)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_pipeline(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        tokenizer_dir=args.tokenizer_dir,
        model_name=args.model_name,
        max_length=args.max_length,
        num_preview_examples=args.num_preview_examples,
    )


if __name__ == "__main__":
    main()
