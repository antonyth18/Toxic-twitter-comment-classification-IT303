"""
Train / validation / test split verification stage.

IMPORTANT DESIGN NOTE - read before changing this file:

The actual splitting of this dataset already happens upstream, in
`preprocessing/preprocess.py`, using multilabel-stratified shuffling
(`iterstrat.ml_stratifiers.MultilabelStratifiedShuffleSplit`, RANDOM_SEED=42,
80/10/10). That stage produces `data/processed/{train,validation,test}.csv`.
`dataset/tokenize.py` then tokenizes each of those three CSVs independently
into a single DatasetDict with matching splits (`data/processed/tokenized/`).

This module deliberately does NOT split the data a second time. Re-splitting
already-split-and-tokenized data would either (a) be a redundant no-op, or
(b) silently produce a *different* partition than the one already baked into
the tokenized dataset (since a fresh shuffle -- even with the same seed --
over a differently-ordered or differently-sized input is not guaranteed to
reproduce the same assignment), which would reintroduce train/val/test
leakage risk rather than prevent it. Splitting exactly once, as early as
possible, is what keeps the pipeline leakage-free.

Instead, this stage's job is to:
  1. Load the tokenized DatasetDict produced by dataset/tokenize.py.
  2. Rigorously validate it: no id/comment_text leakage across splits, label
     values are valid, all required model-input fields are present, split
     sizes and label distributions are reasonable and roughly match the
     80/10/10 multilabel-stratified split performed upstream.
  3. Persist the validated DatasetDict to its final, canonical location
     (data/tokenized/{train,validation,test}) so the training stage has one
     unambiguous "this is ready" artifact to load.

Why multilabel stratification (not plain random splitting): a comment can
carry any combination of the six labels simultaneously, and several labels
are rare (threat ~0.3%, identity_hate ~0.9%, severe_toxic ~1.0% of the
corpus). A plain random or single-column-stratified split would let those
rare labels drift unevenly across splits by chance. Iterative stratification
(Sechidis et al., 2011, via the `iterative-stratification` package) balances
all six label distributions simultaneously.

Run from the classifier-service/ directory:
    python -m dataset.split

NOTE: must be run as a module (`-m dataset.split`), not as a script
(`python dataset/split.py`). Running any script directly from inside the
dataset/ directory puts that directory first on sys.path, which shadows
Python's stdlib `tokenize` module with this package's own dataset/tokenize.py
and crashes with a circular-import error (see dataset/tokenize.py's docstring).
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
from datasets import Dataset, DatasetDict

LABEL_COLUMNS: list[str] = [
    "toxic",
    "severe_toxic",
    "obscene",
    "threat",
    "insult",
    "identity_hate",
]
ID_COLUMN = "id"
TEXT_COLUMN = "comment_text"
REQUIRED_FIELDS = [ID_COLUMN, TEXT_COLUMN, "input_ids", "attention_mask", "labels"]

SPLIT_NAMES = ["train", "validation", "test"]

# Documents the split that was actually performed upstream (preprocessing/preprocess.py).
# Not re-applied here -- see module docstring -- but recorded for the report/checks below.
RANDOM_SEED = 42
EXPECTED_FRACTIONS = {"train": 0.8, "validation": 0.1, "test": 0.1}
FRACTION_TOLERANCE = 0.05  # split may be off by up to 5 percentage points from the target
LABEL_RATE_TOLERANCE_PP = 2.0  # max allowed spread (percentage points) of a label's positive rate across splits

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = _SERVICE_ROOT / "data" / "processed" / "tokenized"
DEFAULT_OUTPUT_DIR = _SERVICE_ROOT / "data" / "tokenized"


class SplitValidationError(ValueError):
    """Raised when a split fails a leakage, schema, or distribution check."""


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_tokenized_dataset_dict(input_dir: Path) -> DatasetDict:
    if not input_dir.exists():
        raise FileNotFoundError(
            f"Tokenized dataset not found at {input_dir}. "
            "Run `python -m dataset.tokenize` first."
        )
    dataset_dict = DatasetDict.load_from_disk(str(input_dir))
    missing_splits = [s for s in SPLIT_NAMES if s not in dataset_dict]
    if missing_splits:
        raise SplitValidationError(f"Loaded DatasetDict is missing split(s): {missing_splits}")
    return dataset_dict


# ---------------------------------------------------------------------------
# Leakage checks (id + comment_text)
# ---------------------------------------------------------------------------

def _cross_split_duplicates(values_by_split: dict[str, list[Any]]) -> dict[Any, set[str]]:
    """Return {value: {splits it appears in}} for every value seen in 2+ splits."""
    membership: dict[Any, set[str]] = {}
    for split_name, values in values_by_split.items():
        for v in set(values):
            membership.setdefault(v, set()).add(split_name)
    return {v: splits for v, splits in membership.items() if len(splits) > 1}


def check_no_leakage(train: Dataset, validation: Dataset, test: Dataset) -> tuple[int, int]:
    """Returns (duplicate_id_count, duplicate_comment_count) across the three splits."""
    ids_by_split = {"train": train[ID_COLUMN], "validation": validation[ID_COLUMN], "test": test[ID_COLUMN]}
    comments_by_split = {
        "train": train[TEXT_COLUMN],
        "validation": validation[TEXT_COLUMN],
        "test": test[TEXT_COLUMN],
    }

    duplicate_ids = _cross_split_duplicates(ids_by_split)
    duplicate_comments = _cross_split_duplicates(comments_by_split)

    if duplicate_ids:
        sample = list(duplicate_ids.items())[:5]
        raise SplitValidationError(f"{len(duplicate_ids)} id(s) appear in more than one split, e.g. {sample}")
    if duplicate_comments:
        sample = list(duplicate_comments.items())[:5]
        raise SplitValidationError(
            f"{len(duplicate_comments)} comment_text value(s) appear in more than one split, e.g. {sample}"
        )
    return len(duplicate_ids), len(duplicate_comments)


# ---------------------------------------------------------------------------
# Schema / field checks
# ---------------------------------------------------------------------------

def check_required_fields(name: str, dataset: Dataset) -> None:
    missing = [f for f in REQUIRED_FIELDS if f not in dataset.column_names]
    if missing:
        raise SplitValidationError(f"'{name}' split is missing required field(s): {missing}")


def label_matrix(dataset: Dataset) -> np.ndarray:
    labels = dataset["labels"]
    try:
        arr = np.array(labels, dtype=np.float64)
    except ValueError as e:
        raise SplitValidationError(f"Labels are not a uniform 2D array (ragged rows?): {e}") from e
    if arr.ndim != 2 or arr.shape[1] != len(LABEL_COLUMNS):
        raise SplitValidationError(
            f"Expected labels shaped (n, {len(LABEL_COLUMNS)}), got {arr.shape}."
        )
    return arr


def check_label_values(name: str, arr: np.ndarray) -> None:
    invalid = ~np.isin(arr, [0.0, 1.0])
    if invalid.any():
        bad_rows = np.argwhere(invalid.any(axis=1)).flatten()[:5].tolist()
        raise SplitValidationError(f"'{name}' split has non-binary label values at row(s) {bad_rows}.")


# ---------------------------------------------------------------------------
# Size / distribution checks
# ---------------------------------------------------------------------------

def check_sizes(train: Dataset, validation: Dataset, test: Dataset) -> dict[str, int]:
    sizes = {"train": len(train), "validation": len(validation), "test": len(test)}
    if any(n == 0 for n in sizes.values()):
        raise SplitValidationError(f"One or more splits is empty: {sizes}")

    total = sum(sizes.values())
    for split_name, expected_frac in EXPECTED_FRACTIONS.items():
        actual_frac = sizes[split_name] / total
        if abs(actual_frac - expected_frac) > FRACTION_TOLERANCE:
            raise SplitValidationError(
                f"'{split_name}' split is {actual_frac:.1%} of the data, "
                f"expected ~{expected_frac:.0%} (tolerance {FRACTION_TOLERANCE:.0%})."
            )
    return sizes


def label_distribution(arr: np.ndarray) -> dict[str, dict[str, float]]:
    n = len(arr)
    return {
        label: {"count": int(arr[:, i].sum()), "pct": float(arr[:, i].sum() / n * 100)}
        for i, label in enumerate(LABEL_COLUMNS)
    }


def check_label_distribution_similarity(distributions: dict[str, dict[str, dict[str, float]]]) -> None:
    for label in LABEL_COLUMNS:
        rates = {split: distributions[split][label]["pct"] for split in SPLIT_NAMES}
        spread = max(rates.values()) - min(rates.values())
        if spread > LABEL_RATE_TOLERANCE_PP:
            raise SplitValidationError(
                f"Label '{label}' positive rate varies by {spread:.2f} percentage points "
                f"across splits ({rates}), exceeding the {LABEL_RATE_TOLERANCE_PP}pp tolerance."
            )


def multilabel_combination_counts(arr: np.ndarray) -> dict[str, int]:
    positive_counts_per_row = arr.sum(axis=1)
    return {
        "0 labels": int((positive_counts_per_row == 0).sum()),
        "1 label": int((positive_counts_per_row == 1).sum()),
        "2+ labels": int((positive_counts_per_row >= 2).sum()),
    }


# ---------------------------------------------------------------------------
# Orchestrated validation (per task spec: validate_splits(train, validation, test))
# ---------------------------------------------------------------------------

@dataclass
class SplitReport:
    sizes: dict[str, int] = field(default_factory=dict)
    label_distributions: dict[str, dict[str, dict[str, float]]] = field(default_factory=dict)
    multilabel_counts: dict[str, dict[str, int]] = field(default_factory=dict)
    duplicate_ids_across_splits: int = 0
    duplicate_comments_across_splits: int = 0


def validate_splits(train: Dataset, validation: Dataset, test: Dataset) -> SplitReport:
    """Runs every required check and raises SplitValidationError with a clear
    message on the first failure. Returns a SplitReport on success."""
    datasets = {"train": train, "validation": validation, "test": test}

    # 1 & 3: sizes + fraction sanity.
    sizes = check_sizes(train, validation, test)

    # 7: required fields present in every split.
    for name, ds in datasets.items():
        check_required_fields(name, ds)

    # 4 & 5: labels are well-formed and binary.
    matrices = {name: label_matrix(ds) for name, ds in datasets.items()}
    for name, arr in matrices.items():
        check_label_values(name, arr)

    # 1 & 2: no id or comment_text leakage across splits.
    duplicate_id_count, duplicate_comment_count = check_no_leakage(train, validation, test)

    # 6: label distributions are reasonably similar across splits.
    distributions = {name: label_distribution(arr) for name, arr in matrices.items()}
    check_label_distribution_similarity(distributions)

    multilabel_counts = {name: multilabel_combination_counts(arr) for name, arr in matrices.items()}

    return SplitReport(
        sizes=sizes,
        label_distributions=distributions,
        multilabel_counts=multilabel_counts,
        duplicate_ids_across_splits=duplicate_id_count,
        duplicate_comments_across_splits=duplicate_comment_count,
    )


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

_DIST_COL_WIDTH = 24  # wide enough for the longest cell, e.g. "12226/127592 (9.58%)"


def _print_label_distribution_table(report: SplitReport) -> None:
    print(f"\n{'Label':<16}{'Train':>{_DIST_COL_WIDTH}}{'Validation':>{_DIST_COL_WIDTH}}{'Test':>{_DIST_COL_WIDTH}}")
    for label in LABEL_COLUMNS:
        row = f"{label:<16}"
        for split in SPLIT_NAMES:
            d = report.label_distributions[split][label]
            cell = f"{d['count']}/{report.sizes[split]} ({d['pct']:.2f}%)"
            row += f"{cell:>{_DIST_COL_WIDTH}}"
        print(row)


def print_final_report(report: SplitReport, output_dir: Path) -> None:
    total = sum(report.sizes.values())

    print("\n=== Dataset Split Report ===")
    print(f"Total examples: {total}")
    print(f"\nTraining examples: {report.sizes['train']}")
    print(f"Validation examples: {report.sizes['validation']}")
    print(f"Test examples: {report.sizes['test']}")
    print(f"\nTraining percentage: {report.sizes['train'] / total:.2%}")
    print(f"Validation percentage: {report.sizes['validation'] / total:.2%}")
    print(f"Test percentage: {report.sizes['test'] / total:.2%}")

    print("\n--- Label distributions (count/split_size (pct)) ---")
    _print_label_distribution_table(report)

    print("\n--- Multi-label combination counts ---")
    header = f"{'':<16}{'Train':>10}{'Validation':>14}{'Test':>10}"
    print(header)
    for bucket in ["0 labels", "1 label", "2+ labels"]:
        train_v = report.multilabel_counts["train"][bucket]
        val_v = report.multilabel_counts["validation"][bucket]
        test_v = report.multilabel_counts["test"][bucket]
        print(f"{bucket:<16}{train_v:>10}{val_v:>14}{test_v:>10}")

    print("\nDataset split complete")
    print(f"\nTotal: {total}")
    print(f"Train: {report.sizes['train']}")
    print(f"Validation: {report.sizes['validation']}")
    print(f"Test: {report.sizes['test']}")
    print(f"\nDuplicate IDs across splits: {report.duplicate_ids_across_splits}")
    print(f"Duplicate comments across splits: {report.duplicate_comments_across_splits}")
    print(f"\nRandom seed: {RANDOM_SEED}")
    print(
        "Stratification: multilabel iterative stratification "
        "(iterative-stratification package, MultilabelStratifiedShuffleSplit), "
        "performed in preprocessing/preprocess.py prior to tokenization"
    )
    print(f"Saved to: {output_dir}")
    print("Status: READY FOR TRAINING")


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def run_pipeline(input_dir: Path, output_dir: Path) -> SplitReport:
    dataset_dict = load_tokenized_dataset_dict(input_dir)
    report = validate_splits(dataset_dict["train"], dataset_dict["validation"], dataset_dict["test"])

    output_dir.mkdir(parents=True, exist_ok=True)
    dataset_dict.save_to_disk(str(output_dir))

    print_final_report(report, output_dir)
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        run_pipeline(input_dir=args.input_dir, output_dir=args.output_dir)
    except (FileNotFoundError, SplitValidationError) as e:
        print(f"\nSplit validation FAILED: {e}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
