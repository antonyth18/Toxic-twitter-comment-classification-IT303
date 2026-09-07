"""
DistilBERT fine-tuning stage for multi-label toxic comment classification.

Consumes the already-split, already-tokenized, already-validated dataset at
data/tokenized/ (produced by preprocessing/preprocess.py -> dataset/tokenize.py
-> dataset/split.py). This module does NOT re-split, re-tokenize, or touch
the raw CSVs -- it only loads the canonical tokenized DatasetDict and trains.

The TEST split is loaded from disk for accounting purposes only (to report
its size) and is never used for training, evaluation, class-weight
computation, or model selection in this script.

Pipeline position:
    Raw Jigsaw CSV -> preprocess.py -> tokenize.py -> split.py
        -> data/tokenized/{train,validation,test}
        -> THIS SCRIPT (train.py)
        -> classifier-service/model/distilbert-toxic/ (best checkpoint + tokenizer + metadata)

Run from the classifier-service/ directory:
    python model/train.py [--epochs N] [--batch-size N] [--use-class-weights] ...
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import torch
from datasets import Dataset, DatasetDict
from sklearn.metrics import f1_score, precision_score, recall_score
from torch import nn
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    EvalPrediction,
    PreTrainedTokenizerBase,
    Trainer,
    TrainingArguments,
    set_seed,
)

LABEL_COLUMNS: list[str] = [
    "toxic",
    "severe_toxic",
    "obscene",
    "threat",
    "insult",
    "identity_hate",
]
NUM_LABELS = len(LABEL_COLUMNS)

MODEL_NAME = "distilbert-base-uncased"
RANDOM_SEED = 42
MAX_LENGTH = 256  # must match dataset/tokenize.py's max_length -- recorded here for metadata only
DEFAULT_THRESHOLD = 0.5

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TOKENIZED_DIR = _SERVICE_ROOT / "data" / "tokenized"
DEFAULT_TOKENIZER_DIR = _SERVICE_ROOT / "tokenizer"  # saved by dataset/tokenize.py -- reused, not recreated
DEFAULT_MODEL_OUTPUT_DIR = _SERVICE_ROOT / "model" / "distilbert-toxic"
DEFAULT_CHECKPOINT_DIR = _SERVICE_ROOT / "model" / "checkpoints"


# ---------------------------------------------------------------------------
# Device detection
# ---------------------------------------------------------------------------

def detect_device() -> torch.device:
    """CUDA if available, else Apple Silicon MPS, else CPU. Trainer will
    independently arrive at the same device; this is printed up front per
    the task requirement and used for the manual sanity-check batch."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


# ---------------------------------------------------------------------------
# Data loading (reuses existing artifacts -- no re-splitting/re-tokenizing)
# ---------------------------------------------------------------------------

def load_tokenized_splits(tokenized_dir: Path) -> DatasetDict:
    if not tokenized_dir.exists():
        raise FileNotFoundError(
            f"Tokenized dataset not found at {tokenized_dir}. "
            "Run preprocessing/preprocess.py, dataset/tokenize.py, then dataset/split.py first."
        )
    dataset_dict = DatasetDict.load_from_disk(str(tokenized_dir))
    for split in ["train", "validation", "test"]:
        if split not in dataset_dict:
            raise ValueError(f"'{split}' split missing from {tokenized_dir}.")
    return dataset_dict


def load_shared_tokenizer(tokenizer_dir: Path) -> PreTrainedTokenizerBase:
    """Loads the exact tokenizer saved by dataset/tokenize.py. Training must
    use the same tokenizer as tokenization/inference -- never a freshly
    re-resolved one -- so vocab/config can never silently drift."""
    if not tokenizer_dir.exists():
        raise FileNotFoundError(
            f"Saved tokenizer not found at {tokenizer_dir}. Run dataset/tokenize.py first."
        )
    return AutoTokenizer.from_pretrained(str(tokenizer_dir))


# ---------------------------------------------------------------------------
# Class imbalance handling (train-split only, toggleable)
# ---------------------------------------------------------------------------

def inspect_label_frequencies(train_dataset: Dataset) -> dict[str, dict[str, float]]:
    """Prints and returns per-label positive counts/rates from TRAINING data
    only. Never inspects validation/test labels -- that would leak split
    information into a training-time decision."""
    labels = np.array(train_dataset["labels"], dtype=np.float64)
    n = len(labels)
    freqs = {
        label: {"count": int(labels[:, i].sum()), "pct": float(labels[:, i].sum() / n * 100)}
        for i, label in enumerate(LABEL_COLUMNS)
    }
    print("\n=== Training label frequencies (imbalance check) ===")
    for label, stats in freqs.items():
        print(f"  {label:<16} {stats['count']:>7} / {n} ({stats['pct']:.2f}%)")
    return freqs


def compute_pos_weight(train_dataset: Dataset) -> torch.Tensor:
    """pos_weight[i] = (#negative / #positive) for label i, computed strictly
    from the training split, for use with BCEWithLogitsLoss to counteract
    class imbalance (per-label, since this is multi-label not multi-class).
    Clipped away from zero positives to avoid division by zero on a
    hypothetical fully-absent label."""
    labels = np.array(train_dataset["labels"], dtype=np.float64)
    n = len(labels)
    pos_counts = labels.sum(axis=0)
    pos_counts = np.clip(pos_counts, a_min=1.0, a_max=None)
    neg_counts = n - pos_counts
    pos_weight = neg_counts / pos_counts
    print("\n=== Computed pos_weight (train-only) ===")
    for label, w in zip(LABEL_COLUMNS, pos_weight):
        print(f"  {label:<16} {w:.2f}")
    return torch.tensor(pos_weight, dtype=torch.float32)


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

def build_model() -> AutoModelForSequenceClassification:
    return AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=NUM_LABELS,
        problem_type="multi_label_classification",
    )


class WeightedTrainer(Trainer):
    """Trainer that computes BCEWithLogitsLoss explicitly (rather than relying
    on the model's built-in multi_label_classification loss), so an optional
    per-label pos_weight can be plugged in or removed independently -- this
    is the on/off switch for class-imbalance handling requested by the task.
    """

    def __init__(self, *args: Any, pos_weight: torch.Tensor | None = None, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.pos_weight = pos_weight

    def compute_loss(
        self,
        model: nn.Module,
        inputs: dict[str, torch.Tensor],
        return_outputs: bool = False,
        num_items_in_batch: torch.Tensor | int | None = None,
    ):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        pos_weight = self.pos_weight.to(logits.device) if self.pos_weight is not None else None
        loss_fct = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
        loss = loss_fct(logits, labels.to(logits.dtype))
        return (loss, outputs) if return_outputs else loss


# ---------------------------------------------------------------------------
# Metrics (multi-label: micro/macro F1, precision, recall, per-label F1)
# ---------------------------------------------------------------------------

def make_compute_metrics(threshold: float):
    def compute_metrics(eval_pred: EvalPrediction) -> dict[str, float]:
        logits = eval_pred.predictions
        if isinstance(logits, tuple):
            logits = logits[0]
        labels = eval_pred.label_ids

        probs = 1 / (1 + np.exp(-logits))  # sigmoid
        preds = (probs >= threshold).astype(int)
        labels = labels.astype(int)

        metrics: dict[str, float] = {
            "f1_micro": f1_score(labels, preds, average="micro", zero_division=0),
            "f1_macro": f1_score(labels, preds, average="macro", zero_division=0),
            "precision_micro": precision_score(labels, preds, average="micro", zero_division=0),
            "recall_micro": recall_score(labels, preds, average="micro", zero_division=0),
            "precision_macro": precision_score(labels, preds, average="macro", zero_division=0),
            "recall_macro": recall_score(labels, preds, average="macro", zero_division=0),
        }
        per_label_f1 = f1_score(labels, preds, average=None, zero_division=0)
        for label, f1 in zip(LABEL_COLUMNS, per_label_f1):
            metrics[f"f1_{label}"] = float(f1)
        return metrics

    return compute_metrics


# ---------------------------------------------------------------------------
# Sanity check -- required before launching full training
# ---------------------------------------------------------------------------

def run_sanity_check(
    model: nn.Module,
    train_dataset: Dataset,
    collator: DataCollatorWithPadding,
    device: torch.device,
    batch_size: int = 4,
) -> None:
    print("\n=== Sanity check ===")
    # Trainer strips non-model columns (id, comment_text) automatically via
    # remove_unused_columns; replicate that manually here since we're calling
    # the collator directly, outside of Trainer.
    model_fields = {"input_ids", "attention_mask", "labels"}
    sample = [
        {k: v for k, v in train_dataset[i].items() if k in model_fields}
        for i in range(min(batch_size, len(train_dataset)))
    ]
    batch = collator(sample)
    batch = {k: v.to(device) for k, v in batch.items()}

    model.to(device)
    model.eval()
    with torch.no_grad():
        outputs = model(**batch)

    logits = outputs.logits
    labels = batch["labels"]
    expected_shape = (len(sample), NUM_LABELS)

    assert tuple(logits.shape) == expected_shape, f"logits shape {tuple(logits.shape)} != {expected_shape}"
    assert tuple(labels.shape) == expected_shape, f"labels shape {tuple(labels.shape)} != {expected_shape}"

    loss_fct = nn.BCEWithLogitsLoss()
    loss = loss_fct(logits, labels.to(logits.dtype))
    assert torch.isfinite(loss), f"loss is not finite: {loss}"

    print(f"  batch logits shape : {tuple(logits.shape)}  (expected {expected_shape})")
    print(f"  batch labels shape : {tuple(labels.shape)}  (expected {expected_shape})")
    print(f"  loss               : {loss.item():.4f} (finite: {torch.isfinite(loss).item()})")
    print("  Sanity check PASSED")
    model.train()


# ---------------------------------------------------------------------------
# Training report
# ---------------------------------------------------------------------------

@dataclass
class BestEpochMetrics:
    epoch: float
    metrics: dict[str, float]


def find_best_epoch_metrics(trainer: Trainer, metric_name: str) -> BestEpochMetrics:
    eval_key = f"eval_{metric_name}"
    eval_logs = [entry for entry in trainer.state.log_history if eval_key in entry]
    if not eval_logs:
        raise RuntimeError(f"No evaluation logs found containing '{eval_key}'.")
    best_entry = max(eval_logs, key=lambda e: e[eval_key])
    metrics = {k[len("eval_"):]: v for k, v in best_entry.items() if k.startswith("eval_")}
    return BestEpochMetrics(epoch=best_entry.get("epoch", -1), metrics=metrics)


def print_training_report(
    device: torch.device,
    train_size: int,
    val_size: int,
    args: argparse.Namespace,
    best: BestEpochMetrics,
    model_output_dir: Path,
) -> None:
    print("\n=== Training Report ===")
    print(f"Device used: {device}")
    print(f"Training examples: {train_size}")
    print(f"Validation examples: {val_size}")
    print(f"Number of labels: {NUM_LABELS}")
    print(f"Model: {MODEL_NAME}")
    print(f"Epochs: {args.epochs}")
    print(f"Learning rate: {args.learning_rate}")
    print(f"Batch size: {args.batch_size}")
    print(f"Class weighting (pos_weight): {'enabled' if args.use_class_weights else 'disabled'}")
    print(f"Best epoch: {best.epoch}")
    print(f"Best validation micro-F1: {best.metrics.get('f1_micro', float('nan')):.4f}")
    print(f"Best validation macro-F1: {best.metrics.get('f1_macro', float('nan')):.4f}")
    print(f"Validation precision (micro): {best.metrics.get('precision_micro', float('nan')):.4f}")
    print(f"Validation recall (micro): {best.metrics.get('recall_micro', float('nan')):.4f}")
    print(f"Model saved to: {model_output_dir}")


def save_metadata(
    output_dir: Path,
    args: argparse.Namespace,
    best: BestEpochMetrics,
) -> None:
    metadata = {
        "model_name": MODEL_NAME,
        "label_columns": LABEL_COLUMNS,
        "max_length": MAX_LENGTH,
        "threshold": args.threshold,
        "random_seed": RANDOM_SEED,
        "hyperparameters": {
            "epochs": args.epochs,
            "learning_rate": args.learning_rate,
            "batch_size": args.batch_size,
            "eval_batch_size": args.eval_batch_size,
            "weight_decay": args.weight_decay,
            "use_class_weights": args.use_class_weights,
        },
        "best_epoch": best.epoch,
        "validation_metrics": best.metrics,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }
    (output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tokenized-dir", type=Path, default=DEFAULT_TOKENIZED_DIR)
    parser.add_argument("--tokenizer-dir", type=Path, default=DEFAULT_TOKENIZER_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_MODEL_OUTPUT_DIR)
    parser.add_argument("--checkpoint-dir", type=Path, default=DEFAULT_CHECKPOINT_DIR)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--eval-batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--use-class-weights", action="store_true", help="Enable pos_weight in BCEWithLogitsLoss")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    parser.add_argument(
        "--sanity-check-only", action="store_true", help="Run only the pre-training sanity check and exit"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    device = detect_device()
    print(f"Detected device: {device}")

    dataset_dict = load_tokenized_splits(args.tokenized_dir)
    train_dataset = dataset_dict["train"]
    val_dataset = dataset_dict["validation"]
    test_size = len(dataset_dict["test"])  # accounting only -- never used below
    print(f"Loaded splits -- train: {len(train_dataset)}, validation: {len(val_dataset)}, test (untouched): {test_size}")

    tokenizer = load_shared_tokenizer(args.tokenizer_dir)
    collator = DataCollatorWithPadding(tokenizer=tokenizer)

    inspect_label_frequencies(train_dataset)
    pos_weight = compute_pos_weight(train_dataset) if args.use_class_weights else None

    model = build_model()

    run_sanity_check(model, train_dataset, collator, device)
    if args.sanity_check_only:
        print("\n--sanity-check-only set; exiting before full training.")
        return

    training_args = TrainingArguments(
        output_dir=str(args.checkpoint_dir),
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="epoch",
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.eval_batch_size,
        num_train_epochs=args.epochs,
        weight_decay=args.weight_decay,
        load_best_model_at_end=True,
        metric_for_best_model="f1_micro",
        greater_is_better=True,
        save_total_limit=2,  # keep disk usage bounded: best + most-recent checkpoint only
        seed=args.seed,
        report_to="none",
        fp16=torch.cuda.is_available(),  # fp16 is CUDA-only here; MPS/CPU stay full precision
        dataloader_pin_memory=torch.cuda.is_available(),
    )

    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=collator,
        compute_metrics=make_compute_metrics(args.threshold),
        pos_weight=pos_weight,
    )

    trainer.train()

    best = find_best_epoch_metrics(trainer, "f1_micro")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(args.output_dir))  # saves the best model (load_best_model_at_end=True)
    tokenizer.save_pretrained(str(args.output_dir))
    save_metadata(args.output_dir, args, best)

    print_training_report(device, len(train_dataset), len(val_dataset), args, best, args.output_dir)
    print("\nStatus: TRAINING COMPLETE. Test set was not evaluated -- reserved for the final evaluation stage.")


if __name__ == "__main__":
    main()
