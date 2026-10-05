"""Post-training validation for classifier-service/model/distilbert-toxic.

Run from classifier-service/:  python model/validate.py [output_dir]

Outputs (default: model/distilbert-toxic/): validation_results.json,
val_logits.npy, test_logits.npy. Always writes model/distilbert-toxic/thresholds.json
(per-label thresholds tuned on validation), which the service loads at startup.
"""
import json, sys, time
from pathlib import Path

import numpy as np
import torch
from datasets import load_from_disk
from safetensors.torch import load_file
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer, DataCollatorWithPadding

ROOT = Path.cwd()
MODEL_DIR = ROOT / "model" / "distilbert-toxic"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else MODEL_DIR
LABELS = ["toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"]
results = {}

def section(t): print(f"\n=== {t} ===", flush=True)

# 1. Artifact integrity ------------------------------------------------------
section("1. Artifact integrity")
meta = json.loads((MODEL_DIR / "metadata.json").read_text())
cfg = json.loads((MODEL_DIR / "config.json").read_text())
checks = {
    "label_columns match": meta["label_columns"] == LABELS,
    "num_labels == 6": len(cfg["id2label"]) == 6,
    "problem_type multi-label": cfg.get("problem_type") == "multi_label_classification",
    "tokenizer.json identical to shared tokenizer/":
        (MODEL_DIR / "tokenizer.json").read_bytes() == (ROOT / "tokenizer" / "tokenizer.json").read_bytes(),
}
state = load_file(str(MODEL_DIR / "model.safetensors"))
checks["all weights finite"] = all(torch.isfinite(t).all().item() for t in state.values() if t.is_floating_point())
head = state.get("classifier.weight")
checks["classifier head shape (6, 768)"] = head is not None and tuple(head.shape) == (6, 768)
del state
for k, v in checks.items(): print(f"  [{'PASS' if v else 'FAIL'}] {k}")
results["integrity"] = checks

device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
print(f"  device: {device}")
tok = AutoTokenizer.from_pretrained(str(MODEL_DIR))
model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR)).to(device).eval()

# 2. Split hygiene -----------------------------------------------------------
section("2. Split hygiene (local data/tokenized)")
dd = load_from_disk(str(ROOT / "data" / "tokenized"))
ids = {s: set(dd[s]["id"]) for s in dd}
for a, b in [("train", "validation"), ("train", "test"), ("validation", "test")]:
    n = len(ids[a] & ids[b]); print(f"  [{'PASS' if n == 0 else 'FAIL'}] id overlap {a}/{b}: {n}")
    results[f"overlap_{a}_{b}"] = n
print("  sizes:", {s: len(dd[s]) for s in dd})

collate = DataCollatorWithPadding(tok)
def predict(ds):
    ds = ds.select_columns(["input_ids", "attention_mask", "labels"])
    dl = DataLoader(ds, batch_size=64, collate_fn=collate)
    logits, labels = [], []
    t0 = time.time()
    with torch.no_grad():
        for i, b in enumerate(dl):
            labels.append(b.pop("labels").numpy())
            logits.append(model(**{k: v.to(device) for k, v in b.items()}).logits.float().cpu().numpy())
            if i % 50 == 0: print(f"    batch {i}/{len(dl)}  {time.time()-t0:.0f}s", flush=True)
    return np.concatenate(logits), np.concatenate(labels).astype(int)

def metrics(y, p, thr):
    pred = (p >= thr).astype(int)
    m = {
        "f1_micro": f1_score(y, pred, average="micro", zero_division=0),
        "f1_macro": f1_score(y, pred, average="macro", zero_division=0),
        "precision_micro": precision_score(y, pred, average="micro", zero_division=0),
        "recall_micro": recall_score(y, pred, average="micro", zero_division=0),
        "roc_auc_macro": roc_auc_score(y, p, average="macro"),
    }
    for i, l in enumerate(LABELS):
        m[f"f1_{l}"] = f1_score(y[:, i], pred[:, i], zero_division=0)
        m[f"auc_{l}"] = roc_auc_score(y[:, i], p[:, i])
    return {k: float(v) for k, v in m.items()}

sig = lambda x: 1 / (1 + np.exp(-x))

# 3. Reproduce validation metrics -------------------------------------------
section("3. Reproduce reported validation metrics")
vl, vy = predict(dd["validation"])
vp = sig(vl)
np.save(OUT / "val_logits.npy", vl)
val_loss = float(torch.nn.functional.binary_cross_entropy_with_logits(torch.tensor(vl), torch.tensor(vy, dtype=torch.float32)))
vm = metrics(vy, vp, 0.5); vm["loss"] = val_loss
for k in ["loss", "f1_micro", "f1_macro", "precision_micro", "recall_micro"] + [f"f1_{l}" for l in LABELS]:
    r = meta["validation_metrics"][k]; diff = abs(vm[k] - r)
    print(f"  [{'PASS' if diff < 5e-3 else 'FAIL'}] {k:<18} reported {r:.4f}  reproduced {vm[k]:.4f}  (diff {diff:.4f})")
results["validation@0.5"] = vm

# 4. Per-label threshold tuning on validation only ---------------------------
section("4. Per-label threshold tuning (validation only)")
grid = np.round(np.arange(0.05, 0.96, 0.01), 2)
thr = np.zeros(len(LABELS))
for i, l in enumerate(LABELS):
    f1s = [f1_score(vy[:, i], (vp[:, i] >= t).astype(int), zero_division=0) for t in grid]
    thr[i] = grid[int(np.argmax(f1s))]
    print(f"  {l:<14} best thr {thr[i]:.2f}  val F1 {max(f1s):.4f}  (@0.5: {vm[f'f1_{l}']:.4f})")
vmt = metrics(vy, vp, thr)
print(f"  val micro-F1 {vm['f1_micro']:.4f} -> {vmt['f1_micro']:.4f}, macro-F1 {vm['f1_macro']:.4f} -> {vmt['f1_macro']:.4f}")
results["tuned_thresholds"] = dict(zip(LABELS, thr.tolist()))
# Picked up by inference/classifier.py on the next service start.
(MODEL_DIR / "thresholds.json").write_text(json.dumps(results["tuned_thresholds"], indent=2))
print(f"  wrote {MODEL_DIR / 'thresholds.json'}")
results["validation@tuned"] = vmt

# 5. Held-out test evaluation (single pass) ----------------------------------
section("5. Held-out test evaluation")
tl, ty = predict(dd["test"])
tp = sig(tl)
np.save(OUT / "test_logits.npy", tl)
t05, tt = metrics(ty, tp, 0.5), metrics(ty, tp, thr)
print(f"  {'metric':<18}{'@0.5':>9}{'@tuned':>9}")
for k in t05: print(f"  {k:<18}{t05[k]:>9.4f}{tt[k]:>9.4f}")
results["test@0.5"], results["test@tuned"] = t05, tt
results["test_positives"] = dict(zip(LABELS, ty.sum(0).tolist()))

# 6. Behavioural smoke test --------------------------------------------------
section("6. Behavioural smoke test")
samples = [
    "Thanks for fixing the citation, great work!",
    "I disagree with this edit, please discuss on the talk page first.",
    "You are a complete idiot and nobody wants you here.",
    "I will find you and kill you.",
    "This is f***ing bullshit, you moron.",
    "People of that religion are all disgusting animals.",
    "",
]
enc = tok(samples, truncation=True, max_length=256, padding=True, return_tensors="pt").to(device)
with torch.no_grad(): sp = torch.sigmoid(model(**enc).logits).cpu().numpy()
results["smoke"] = []
for s, p in zip(samples, sp):
    flagged = [l for l, pi, ti in zip(LABELS, p, thr) if pi >= ti]
    print(f"  {s[:55]!r:<58} max={p.max():.2f} -> {flagged or 'clean'}")
    results["smoke"].append({"text": s, "probs": dict(zip(LABELS, p.round(3).tolist())), "flagged": flagged})

(OUT / "validation_results.json").write_text(json.dumps(results, indent=2))
print("\nDONE ->", OUT / "validation_results.json")
