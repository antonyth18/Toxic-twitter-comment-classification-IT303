# Toxic Comment Classifier Service

FastAPI service serving the fine-tuned DistilBERT multi-label toxicity model
as an int8-quantized ONNX model (onnxruntime, no torch at serving time).

- `GET /health` — model status
- `POST /classify` — `{"text": "..."}`
- `POST /classify/batch` — `{"texts": ["...", "..."]}`

## Model files

- `model/distilbert-toxic/` — PyTorch weights from `model/train.py` (not committed, 268 MB)
- `model/distilbert-toxic-onnx/` — serving model from `model/export_onnx.py` (committed, ~68 MB)

After retraining, regenerate the serving model and check the accuracy comparison it prints:

```bash
python model/export_onnx.py
```
