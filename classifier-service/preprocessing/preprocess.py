"""
Preprocessing pipeline for the Jigsaw Toxic Comment Classification dataset.

Pipeline stages (in order):
    Raw Jigsaw CSV
        -> data inspection
        -> cleaning (missing/invalid text & label validation)
        -> light text normalization
        -> duplicate removal
        -> train / validation / test split
        -> saved processed datasets

This stage does NOT tokenize text and does NOT touch the model. Its only
output is: clean comment text + six binary labels, ready for a later
DistilBERT tokenization stage.

Run from the classifier-service/ directory:
    python preprocessing/preprocess.py
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from iterstrat.ml_stratifiers import MultilabelStratifiedShuffleSplit

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

# Directories, relative to this file's parent (classifier-service/).
DEFAULT_INPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "train.csv"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"

DEFAULT_SEED = 42
TRAIN_FRAC = 0.8
VAL_FRAC = 0.1
TEST_FRAC = 0.1


class InvalidLabelError(ValueError):
    """Raised when a label column contains values other than 0/1."""


@dataclass
class PreprocessingReport:
    """Accumulates every stat/decision made during preprocessing so it can
    be printed and saved for later review (per pipeline requirement)."""

    seed: int = DEFAULT_SEED
    original_rows: int = 0
    inspection: dict[str, Any] = field(default_factory=dict)
    rows_removed_missing_text: int = 0
    duplicate_comment_rows_removed: int = 0
    duplicate_ids_found: int = 0
    final_rows: int = 0
    split_sizes: dict[str, int] = field(default_factory=dict)
    split_label_distribution: dict[str, Any] = field(default_factory=dict)
    no_cross_split_duplicates: bool = False
    labels_are_binary: bool = True

    def to_json(self) -> str:
        return json.dumps(self.__dict__, indent=2, default=str)


# ---------------------------------------------------------------------------
# 1. Load
# ---------------------------------------------------------------------------

def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}. Place the Jigsaw train.csv there "
            "(see classifier-service/data/raw/)."
        )
    df = pd.read_csv(path)
    required_columns = {ID_COLUMN, TEXT_COLUMN, *LABEL_COLUMNS}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")
    return df


# ---------------------------------------------------------------------------
# 2. Inspection
# ---------------------------------------------------------------------------

def inspect_dataset(df: pd.DataFrame) -> dict[str, Any]:
    """Compute read-only statistics. Does not modify df."""
    comment_lengths = df[TEXT_COLUMN].astype(str).str.len()

    stats: dict[str, Any] = {
        "shape": list(df.shape),
        "columns": list(df.columns),
        "missing_values_per_column": df.isnull().sum().to_dict(),
        "duplicate_comment_text_count": int(df[TEXT_COLUMN].duplicated().sum()),
        "duplicate_id_count": int(df[ID_COLUMN].duplicated().sum()),
        "label_distribution": {
            col: df[col].value_counts(dropna=False).to_dict() for col in LABEL_COLUMNS
        },
        "num_comments_with_multiple_labels": int((df[LABEL_COLUMNS].sum(axis=1) > 1).sum()),
        "num_comments_with_no_labels": int((df[LABEL_COLUMNS].sum(axis=1) == 0).sum()),
        "comment_length_stats_chars": {
            "mean": float(comment_lengths.mean()),
            "std": float(comment_lengths.std()),
            "min": int(comment_lengths.min()),
            "max": int(comment_lengths.max()),
            "median": float(comment_lengths.median()),
        },
    }
    return stats


def print_inspection(stats: dict[str, Any]) -> None:
    print("\n=== Dataset Inspection ===")
    print(json.dumps(stats, indent=2, default=str))


# ---------------------------------------------------------------------------
# 3. Missing / invalid data handling
# ---------------------------------------------------------------------------

def clean_text_column(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Remove rows with no usable comment_text (null or whitespace-only).

    Returns the cleaned dataframe and the number of rows removed.
    """
    df = df.copy()
    df[TEXT_COLUMN] = df[TEXT_COLUMN].astype("string")  # nullable string dtype, keeps NaN as <NA>

    is_null = df[TEXT_COLUMN].isna()
    is_blank = df[TEXT_COLUMN].fillna("").str.strip() == ""
    to_remove = is_null | is_blank

    removed_count = int(to_remove.sum())
    df = df.loc[~to_remove].copy()

    # Every remaining comment must be a plain python str for downstream tooling.
    df[TEXT_COLUMN] = df[TEXT_COLUMN].astype(str)
    return df, removed_count


def validate_labels(df: pd.DataFrame) -> None:
    """Verify all six label columns contain only 0/1. Raises with a detailed
    report on the first violation set rather than silently coercing values,
    since corrupt labels must not flow into training data undetected."""
    invalid_report: dict[str, Any] = {}
    for col in LABEL_COLUMNS:
        invalid_mask = ~df[col].isin([0, 1])
        if invalid_mask.any():
            invalid_report[col] = {
                "count": int(invalid_mask.sum()),
                "sample_values": df.loc[invalid_mask, col].unique().tolist()[:10],
                "sample_ids": df.loc[invalid_mask, ID_COLUMN].head(10).tolist(),
            }

    if invalid_report:
        raise InvalidLabelError(
            "Found label values outside {0, 1}:\n" + json.dumps(invalid_report, indent=2, default=str)
        )


# ---------------------------------------------------------------------------
# 4. Light text normalization
# ---------------------------------------------------------------------------

# Matches http(s):// and bare www. URLs.
_URL_RE = re.compile(r"(https?://\S+|www\.\S+)", flags=re.IGNORECASE)
# Matches @mentions (word chars/underscore), e.g. "@someuser".
_MENTION_RE = re.compile(r"@\w+")
# 2+ blank lines -> collapse to a single paragraph break.
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")
# Runs of spaces/tabs (not newlines) -> single space.
_HORIZONTAL_WHITESPACE_RE = re.compile(r"[ \t]+")


def normalize_text(text: str) -> str:
    """Lightweight, reversible-in-spirit normalization for a transformer
    model. Deliberately does NOT strip punctuation, case, or stopwords —
    DistilBERT's subword tokenizer benefits from that information.

    Transformations applied, in order:
      1. URLs (http(s):// or www.) -> "<URL>" placeholder token.
      2. @mentions -> "<USER>" placeholder token.
      3. Runs of spaces/tabs collapsed to a single space.
      4. 3+ consecutive newlines collapsed to 2 (keeps paragraph breaks).
      5. Leading/trailing whitespace stripped.
    Capitalization, punctuation, and emoji are left untouched.
    """
    text = _URL_RE.sub("<URL>", text)
    text = _MENTION_RE.sub("<USER>", text)
    text = _HORIZONTAL_WHITESPACE_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()


def apply_normalization(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df[TEXT_COLUMN] = df[TEXT_COLUMN].map(normalize_text)
    return df


# ---------------------------------------------------------------------------
# 5. Duplicate removal (after normalization, before splitting)
# ---------------------------------------------------------------------------

def remove_duplicate_comments(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Drop rows with duplicate comment_text, keeping the first occurrence
    by id for determinism regardless of input row order."""
    df = df.sort_values(ID_COLUMN, kind="stable").reset_index(drop=True)
    duplicate_mask = df.duplicated(subset=[TEXT_COLUMN], keep="first")
    removed_count = int(duplicate_mask.sum())
    deduped = df.loc[~duplicate_mask].reset_index(drop=True)
    return deduped, removed_count


# ---------------------------------------------------------------------------
# 6. Train / validation / test split (multilabel-stratified)
# ---------------------------------------------------------------------------

def split_dataset(
    df: pd.DataFrame, seed: int
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Two-stage multilabel-stratified split: 80% train, 10% val, 10% test.

    Uses iterative stratification (via `iterative-stratification`) instead
    of plain random splitting so that rare labels (e.g. threat,
    identity_hate) remain reasonably represented in every split.
    """
    X = df.index.to_numpy().reshape(-1, 1)
    y = df[LABEL_COLUMNS].to_numpy()

    # Stage 1: train (80%) vs temp (20% = val + test).
    stage1 = MultilabelStratifiedShuffleSplit(
        n_splits=1, test_size=(VAL_FRAC + TEST_FRAC), random_state=seed
    )
    train_idx, temp_idx = next(stage1.split(X, y))

    # Stage 2: split temp 50/50 into val and test (each 10% of the original).
    temp_df = df.iloc[temp_idx].reset_index(drop=True)
    X_temp = temp_df.index.to_numpy().reshape(-1, 1)
    y_temp = temp_df[LABEL_COLUMNS].to_numpy()

    stage2 = MultilabelStratifiedShuffleSplit(n_splits=1, test_size=0.5, random_state=seed)
    val_idx, test_idx = next(stage2.split(X_temp, y_temp))

    train_df = df.iloc[train_idx].reset_index(drop=True)
    val_df = temp_df.iloc[val_idx].reset_index(drop=True)
    test_df = temp_df.iloc[test_idx].reset_index(drop=True)
    return train_df, val_df, test_df


def verify_no_cross_split_duplicates(
    train_df: pd.DataFrame, val_df: pd.DataFrame, test_df: pd.DataFrame
) -> bool:
    train_set = set(train_df[TEXT_COLUMN])
    val_set = set(val_df[TEXT_COLUMN])
    test_set = set(test_df[TEXT_COLUMN])
    return not (train_set & val_set) and not (train_set & test_set) and not (val_set & test_set)


def split_label_distribution(df: pd.DataFrame) -> dict[str, int]:
    return {col: int(df[col].sum()) for col in LABEL_COLUMNS}


# ---------------------------------------------------------------------------
# 7. Save
# ---------------------------------------------------------------------------

OUTPUT_COLUMNS = [ID_COLUMN, TEXT_COLUMN, *LABEL_COLUMNS]


def save_splits(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    output_dir: Path,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    train_df[OUTPUT_COLUMNS].to_csv(output_dir / "train.csv", index=False)
    val_df[OUTPUT_COLUMNS].to_csv(output_dir / "validation.csv", index=False)
    test_df[OUTPUT_COLUMNS].to_csv(output_dir / "test.csv", index=False)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def run_pipeline(input_path: Path, output_dir: Path, seed: int) -> PreprocessingReport:
    report = PreprocessingReport(seed=seed)

    df = load_dataset(input_path)
    report.original_rows = len(df)

    report.inspection = inspect_dataset(df)
    print_inspection(report.inspection)
    report.duplicate_ids_found = report.inspection["duplicate_id_count"]

    df, rows_removed_missing_text = clean_text_column(df)
    report.rows_removed_missing_text = rows_removed_missing_text

    validate_labels(df)  # raises InvalidLabelError with a report if anything is off
    report.labels_are_binary = True

    df = apply_normalization(df)

    df, duplicate_rows_removed = remove_duplicate_comments(df)
    report.duplicate_comment_rows_removed = duplicate_rows_removed
    report.final_rows = len(df)

    train_df, val_df, test_df = split_dataset(df, seed=seed)
    report.split_sizes = {
        "train": len(train_df),
        "validation": len(val_df),
        "test": len(test_df),
    }
    report.split_label_distribution = {
        "train": split_label_distribution(train_df),
        "validation": split_label_distribution(val_df),
        "test": split_label_distribution(test_df),
    }
    report.no_cross_split_duplicates = verify_no_cross_split_duplicates(train_df, val_df, test_df)

    save_splits(train_df, val_df, test_df, output_dir)

    report_path = output_dir / "preprocessing_report.json"
    report_path.write_text(report.to_json())

    print_summary(report, report_path)
    return report


def print_summary(report: PreprocessingReport, report_path: Path) -> None:
    print("\n=== Preprocessing Summary ===")
    print(f"Random seed used:                {report.seed}")
    print(f"Original rows:                    {report.original_rows}")
    print(f"Rows removed (missing/empty text): {report.rows_removed_missing_text}")
    print(f"Duplicate comment rows removed:   {report.duplicate_comment_rows_removed}")
    print(f"Duplicate ids found (reported):   {report.duplicate_ids_found}")
    print(f"Final rows:                       {report.final_rows}")
    print(f"Split sizes:                      {report.split_sizes}")
    print(f"Split label distribution:         {json.dumps(report.split_label_distribution, indent=2)}")
    print(f"No duplicate comments across splits: {report.no_cross_split_duplicates}")
    print(f"All six labels are binary (0/1):  {report.labels_are_binary}")
    print(f"Full report written to:           {report_path}")

    if not report.no_cross_split_duplicates:
        raise RuntimeError(
            "Data leakage detected: duplicate comments found across splits."
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT_PATH, help="Path to raw Jigsaw train.csv")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Directory for processed CSVs")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="Random seed for splitting")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_pipeline(input_path=args.input, output_dir=args.output_dir, seed=args.seed)


if __name__ == "__main__":
    main()
