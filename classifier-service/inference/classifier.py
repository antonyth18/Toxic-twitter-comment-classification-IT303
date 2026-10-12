"""
Inference wrapper around the fine-tuned DistilBERT multi-label model.

Loads model/distilbert-toxic-onnx/ (the int8-quantized ONNX export written by
model/export_onnx.py from model/train.py's output) once, and turns raw comment
text into per-label probabilities plus the label / subcategories / confidence
shape stored in the backend's Classification table. Runs on onnxruntime, so
serving needs neither torch nor transformers.

Thresholds: if thresholds.json exists in the model dir (written by
model/validate.py from validation-set tuning, copied over by the export) it
supplies one threshold per label; otherwise every label uses metadata.json's
threshold (0.5).
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

# Same normalization the training data went through (URLs -> <URL>,
# @mentions -> <USER>, whitespace collapsing) so inference input matches
# what the model saw during training.
from preprocessing.text import normalize_text

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

def _find_default_model_dir() -> Path:
    service_root = Path(__file__).resolve().parent.parent
    candidates = [
        service_root / "model" / "distilbert-toxic-onnx",
        service_root / "distilbert-toxic-onnx",
        service_root.parent / "distilbert-toxic-onnx",
    ]
    for c in candidates:
        if (c / "model.onnx").exists():
            return c
    return candidates[0]


DEFAULT_MODEL_DIR = _find_default_model_dir()


@dataclass
class Prediction:
    label: str  # "toxic" or "normal"
    subcategories: list[str]
    confidence: float
    probabilities: dict[str, float]


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
    def __init__(self, model_dir: Path = DEFAULT_MODEL_DIR) -> None:
        if not (model_dir / "model.onnx").exists():
            raise FileNotFoundError(
                f"ONNX model not found at {model_dir}. Train with model/train.py, then "
                "run model/export_onnx.py to produce distilbert-toxic-onnx/."
            )
        metadata_path = model_dir / "metadata.json"
        metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
        if metadata.get("label_columns", LABEL_COLUMNS) != LABEL_COLUMNS:
            raise ValueError(f"Model label order {metadata['label_columns']} != expected {LABEL_COLUMNS}")

        self.model_dir = model_dir
        self.max_length = int(metadata.get("max_length", DEFAULT_MAX_LENGTH))
        self.thresholds = load_thresholds(model_dir, float(metadata.get("threshold", DEFAULT_THRESHOLD)))
        self.device = "cpu"
        self.tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=self.max_length)
        self.tokenizer.enable_padding(pad_id=0, pad_token="[PAD]")
        self.session = ort.InferenceSession(str(model_dir / "model.onnx"), providers=["CPUExecutionProvider"])
        # One forward pass at a time: FastAPI runs sync endpoints in a thread pool,
        # and concurrent batches would multiply peak memory on a small host.
        self._lock = threading.Lock()

    def predict_probabilities(self, texts: list[str]) -> list[dict[str, float]]:
        texts = [normalize_text(t) or t.strip() for t in texts]
        results: list[dict[str, float]] = []
        for start in range(0, len(texts), INFERENCE_BATCH_SIZE):
            encoded = self.tokenizer.encode_batch(texts[start : start + INFERENCE_BATCH_SIZE])
            inputs = {
                "input_ids": np.array([e.ids for e in encoded], dtype=np.int64),
                "attention_mask": np.array([e.attention_mask for e in encoded], dtype=np.int64),
            }
            with self._lock:
                (logits,) = self.session.run(["logits"], inputs)
            probs = 1.0 / (1.0 + np.exp(-logits))
            results.extend(dict(zip(LABEL_COLUMNS, row)) for row in probs.tolist())
        return results

    def predict(self, texts: list[str]) -> list[Prediction]:
        return [build_prediction(p, self.thresholds) for p in self.predict_probabilities(texts)]
