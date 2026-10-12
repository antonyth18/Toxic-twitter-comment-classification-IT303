import os
import json
import logging
import re
import datetime
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("classifier-service")

# Resolve model paths relative to main.py
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model" / "distilbert-toxic"
METADATA_PATH = MODEL_DIR / "metadata.json"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = None
tokenizer = None
model_loaded = False
label_columns: List[str] = [
    "toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"
]
threshold: float = 0.5
max_length: int = 256

# Preprocessing text cleaning matching preprocessing/preprocess.py
_URL_RE = re.compile(r"(https?://\S+|www\.\S+)", flags=re.IGNORECASE)
_MENTION_RE = re.compile(r"@\w+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")
_HORIZONTAL_WHITESPACE_RE = re.compile(r"[ \t]+")


def normalize_text(text: str) -> str:
    """Lightweight text normalization applied before tokenization."""
    text = _URL_RE.sub("<URL>", text)
    text = _MENTION_RE.sub("<USER>", text)
    text = _HORIZONTAL_WHITESPACE_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()


def load_model_artifacts() -> None:
    """Load model, tokenizer, and metadata once at startup."""
    global model, tokenizer, model_loaded, label_columns, threshold, max_length
    try:
        if not METADATA_PATH.exists():
            raise FileNotFoundError(f"Metadata file not found at {METADATA_PATH}")

        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        label_columns = metadata.get("label_columns", label_columns)
        threshold = float(metadata.get("threshold", 0.5))
        max_length = int(metadata.get("max_length", 256))

        tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
        model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
        model.to(device)
        model.eval()

        # Warm-up inference
        with torch.no_grad():
            warmup_clean = normalize_text("warmup")
            warmup_inputs = tokenizer(
                warmup_clean,
                truncation=True,
                max_length=max_length,
                return_tensors="pt"
            )
            warmup_inputs = {k: v.to(device) for k, v in warmup_inputs.items()}
            _ = model(**warmup_inputs)

        model_loaded = True
        logger.info(
            "Model successfully loaded on %s with %d labels, max_length=%d, threshold=%.2f",
            device, len(label_columns), max_length, threshold
        )
    except Exception as e:
        logger.error("Failed to load classification model from %s: %s", MODEL_DIR, e, exc_info=True)
        model = None
        tokenizer = None
        model_loaded = False


# Load model at startup
load_model_artifacts()

app = FastAPI(title="Toxic Comment Classifier Service")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    if not model_loaded:
        load_model_artifacts()


# Request Model
class ClassifyRequest(BaseModel):
    text: str


# Response Model
class ClassifyResponse(BaseModel):
    label: str
    subcategories: List[str]
    confidence: float
    timestamp: str


@app.get("/health")
def health_check():
    return {
        "status": "ok" if model_loaded else "degraded",
        "service": "classifier-service",
        "model_loaded": model_loaded,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }


@app.post("/classify", response_model=ClassifyResponse)
def classify_text(request: ClassifyRequest):
    if not model_loaded or model is None or tokenizer is None:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded or unavailable."
        )

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty.")

    cleaned_text = normalize_text(request.text)
    if not cleaned_text:
        cleaned_text = request.text.strip()

    try:
        with torch.no_grad():
            inputs = tokenizer(
                cleaned_text,
                truncation=True,
                max_length=max_length,
                return_tensors="pt"
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}
            outputs = model(**inputs)
            logits = outputs.logits
            probs = torch.sigmoid(logits)[0].cpu().tolist()
    except Exception as e:
        logger.error("Inference execution failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Inference execution failed.")

    flagged_labels = []
    flagged_probs = []
    subcategories = []

    for name, prob in zip(label_columns, probs):
        if prob >= threshold:
            flagged_labels.append(name)
            flagged_probs.append(prob)
            if name != "toxic":
                mapped_name = "identity_attack" if name == "identity_hate" else name
                subcategories.append(mapped_name)

    if flagged_labels:
        label = "toxic"
        confidence = round(float(max(flagged_probs)), 4)
    else:
        label = "normal"
        confidence = round(float(1.0 - max(probs)), 4)

    return ClassifyResponse(
        label=label,
        subcategories=subcategories,
        confidence=confidence,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z"
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
