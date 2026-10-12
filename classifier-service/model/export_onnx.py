"""
Export the fine-tuned DistilBERT model to an int8-quantized ONNX model for serving.

Input:  model/distilbert-toxic/        (produced by model/train.py)
Output: model/distilbert-toxic-onnx/   model.onnx + tokenizer.json + metadata.json
                                       (+ thresholds.json when present)

The quantized model is ~4x smaller than the PyTorch weights and runs on
onnxruntime without torch, which keeps the serving container small enough
for a 512 MB host. After exporting, the script compares quantized vs.
PyTorch predictions on the validation split so the accuracy cost is visible.

Run from the classifier-service/ directory:
    python model/export_onnx.py
    python model/export_onnx.py --compare-samples 0   # skip the comparison
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

SERVICE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_ROOT))

from inference.classifier import LABEL_COLUMNS  # noqa: E402

DEFAULT_SOURCE_DIR = SERVICE_ROOT / "model" / "distilbert-toxic"
DEFAULT_OUTPUT_DIR = SERVICE_ROOT / "model" / "distilbert-toxic-onnx"
DEFAULT_VALIDATION_CSV = SERVICE_ROOT / "data" / "processed" / "validation.csv"
COPIED_FILES = ["tokenizer.json", "metadata.json", "thresholds.json"]


def export_fp32(source_dir: Path, onnx_path: Path) -> None:
    model = AutoModelForSequenceClassification.from_pretrained(str(source_dir)).eval()
    tokenizer = AutoTokenizer.from_pretrained(str(source_dir))
    sample = tokenizer(["export sample", "a second, longer export sample"], padding=True, return_tensors="pt")
    torch.onnx.export(
        model,
        (sample["input_ids"], sample["attention_mask"]),
        str(onnx_path),
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "sequence"},
            "attention_mask": {0: "batch", 1: "sequence"},
            "logits": {0: "batch"},
        },
        opset_version=17,
        dynamo=False,
    )


def quantize(fp32_path: Path, int8_path: Path) -> None:
    from onnxruntime.quantization import QuantType, quantize_dynamic

    quantize_dynamic(str(fp32_path), str(int8_path), weight_type=QuantType.QInt8, per_channel=True)


def compare(source_dir: Path, output_dir: Path, validation_csv: Path, n_samples: int) -> None:
    import pandas as pd

    from inference.classifier import ToxicityClassifier

    df = pd.read_csv(validation_csv).sample(n=n_samples, random_state=42)
    texts = df["comment_text"].astype(str).tolist()
    truth = df[LABEL_COLUMNS].to_numpy()

    tokenizer = AutoTokenizer.from_pretrained(str(source_dir))
    model = AutoModelForSequenceClassification.from_pretrained(str(source_dir)).eval()
    torch_probs = []
    for start in range(0, len(texts), 32):
        enc = tokenizer(texts[start : start + 32], truncation=True, max_length=256, padding=True, return_tensors="pt")
        with torch.inference_mode():
            torch_probs.append(torch.sigmoid(model(**enc).logits).numpy())
    torch_probs = np.concatenate(torch_probs)

    onnx_clf = ToxicityClassifier(output_dir)
    onnx_probs = np.array([[p[l] for l in LABEL_COLUMNS] for p in onnx_clf.predict_probabilities(texts)])

    def f1(pred: np.ndarray, gold: np.ndarray) -> float:
        tp = (pred & gold).sum()
        denom = pred.sum() + gold.sum()
        return float(2 * tp / denom) if denom else 1.0

    torch_pred, onnx_pred = torch_probs >= 0.5, onnx_probs >= 0.5
    gold = truth.astype(bool)
    print(f"\nComparison on {n_samples} validation comments (threshold 0.5):")
    print(f"  max |prob diff|          : {np.abs(torch_probs - onnx_probs).max():.4f}")
    print(f"  mean |prob diff|         : {np.abs(torch_probs - onnx_probs).mean():.5f}")
    print(f"  label decisions identical: {(torch_pred == onnx_pred).mean():.4%}")
    print(f"  overall toxic/normal same: {(torch_pred.any(1) == onnx_pred.any(1)).mean():.4%}")
    print(f"  {'label':<14} {'F1 torch':>9} {'F1 onnx':>9}")
    for i, label in enumerate(LABEL_COLUMNS):
        print(f"  {label:<14} {f1(torch_pred[:, i], gold[:, i]):>9.4f} {f1(onnx_pred[:, i], gold[:, i]):>9.4f}")
    print(f"  {'micro':<14} {f1(torch_pred, gold):>9.4f} {f1(onnx_pred, gold):>9.4f}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--validation-csv", type=Path, default=DEFAULT_VALIDATION_CSV)
    parser.add_argument("--compare-samples", type=int, default=2000)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        fp32_path = Path(tmp) / "model.fp32.onnx"
        print(f"Exporting {args.source_dir} -> ONNX ...")
        export_fp32(args.source_dir, fp32_path)
        print("Quantizing to int8 ...")
        quantize(fp32_path, args.output_dir / "model.onnx")

    for name in COPIED_FILES:
        if (args.source_dir / name).exists():
            shutil.copy2(args.source_dir / name, args.output_dir / name)
    size_mb = (args.output_dir / "model.onnx").stat().st_size / 1e6
    print(f"Wrote {args.output_dir} (model.onnx: {size_mb:.1f} MB)")

    if args.compare_samples > 0 and args.validation_csv.exists():
        compare(args.source_dir, args.output_dir, args.validation_csv, args.compare_samples)


if __name__ == "__main__":
    main()
