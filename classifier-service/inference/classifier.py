"""
Inference wrapper around the fine-tuned DistilBERT multi-label model.

Loads model/distilbert-toxic/ (produced by model/train.py) once, and turns raw
comment text into per-label probabilities plus the label / subcategories /
confidence shape stored in the backend's Classification table.

Thresholds: if model/distilbert-toxic/thresholds.json exists (written by
model/validate.py from validation-set tuning) it supplies one threshold per
label; otherwise every label uses metadata.json's threshold (0.5).
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

LABEL_COLUMNS: list[str] = [
    "toxic",
    "severe_toxic",
    "obscene",
    "threat",
    "insult",
    "identity_hate",
]
PRIMARY_LABEL = "toxic"
DEFAULT_THRESHOLD = 0.5
DEFAULT_MAX_LENGTH = 256  # must match dataset/tokenize.py and model/train.py
INFERENCE_BATCH_SIZE = 32

DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "model" / "distilbert-toxic"


@dataclass
class Prediction:
    label: str  # "toxic" or "normal"
    subcategories: list[str]
    confidence: float
    probabilities: dict[str, float]


def detect_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def load_thresholds(model_dir: Path, default: float) -> dict[str, float]:
    """Per-label thresholds from thresholds.json, falling back to `default`
    for the whole file or for any label it omits."""
    path = model_dir / "thresholds.json"
    tuned = json.loads(path.read_text()) if path.exists() else {}
    return {label: float(tuned.get(label, default)) for label in LABEL_COLUMNS}


def build_prediction(probabilities: dict[str, float], thresholds: dict[str, float]) -> Prediction:
    """Maps six label probabilities to the backend's response shape.

    - label: "toxic" if ANY label clears its threshold, else "normal".
    - subcategories: the flagged fine-grained labels (everything except the
      primary "toxic" label, which is already expressed by `label`).
    - confidence: probability of the decision that was made -- the highest
      flagged probability when toxic, or 1 - the highest probability when
      normal (i.e. how far the most suspicious label is from firing).
    """
    flagged = [l for l in LABEL_COLUMNS if probabilities[l] >= thresholds[l]]
    if flagged:
        label = "toxic"
        confidence = max(probabilities[l] for l in flagged)
    else:
        label = "normal"
        confidence = 1.0 - max(probabilities.values())
    return Prediction(
        label=label,
        subcategories=[l for l in flagged if l != PRIMARY_LABEL],
        confidence=round(float(confidence), 4),
        probabilities={l: round(float(p), 4) for l, p in probabilities.items()},
    )


class ToxicityClassifier:
    def __init__(self, model_dir: Path = DEFAULT_MODEL_DIR, device: torch.device | None = None) -> None:
        if not (model_dir / "config.json").exists():
            raise FileNotFoundError(
                f"Trained model not found at {model_dir}. Run model/train.py or copy the "
                "distilbert-toxic/ folder into classifier-service/model/."
            )
        metadata_path = model_dir / "metadata.json"
        metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
        if metadata.get("label_columns", LABEL_COLUMNS) != LABEL_COLUMNS:
            raise ValueError(f"Model label order {metadata['label_columns']} != expected {LABEL_COLUMNS}")

        self.model_dir = model_dir
        self.max_length = int(metadata.get("max_length", DEFAULT_MAX_LENGTH))
        self.thresholds = load_thresholds(model_dir, float(metadata.get("threshold", DEFAULT_THRESHOLD)))
        self.device = device or detect_device()
        self.tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
        self.model = AutoModelForSequenceClassification.from_pretrained(str(model_dir)).to(self.device).eval()
        # One forward pass at a time: FastAPI runs sync endpoints in a thread pool,
        # and sharing one model across concurrent MPS/CUDA calls isn't safe.
        self._lock = threading.Lock()

    def predict_probabilities(self, texts: list[str]) -> list[dict[str, float]]:
        results: list[dict[str, float]] = []
        for start in range(0, len(texts), INFERENCE_BATCH_SIZE):
            chunk = texts[start : start + INFERENCE_BATCH_SIZE]
            encoded = self.tokenizer(
                chunk,
                truncation=True,
                max_length=self.max_length,
                padding=True,
                return_tensors="pt",
            ).to(self.device)
            with self._lock, torch.inference_mode():
                probs = torch.sigmoid(self.model(**encoded).logits).float().cpu().tolist()
            results.extend(dict(zip(LABEL_COLUMNS, row)) for row in probs)
        return results

    def predict(self, texts: list[str]) -> list[Prediction]:
        return [build_prediction(p, self.thresholds) for p in self.predict_probabilities(texts)]
