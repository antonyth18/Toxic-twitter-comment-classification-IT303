import os
import logging
import datetime
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from inference.classifier import DEFAULT_MODEL_DIR, Prediction, ToxicityClassifier

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("classifier-service")

MODEL_DIR = Path(os.getenv("MODEL_DIR", str(DEFAULT_MODEL_DIR)))
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", 100))
# The web client reaches this service through the backend (server-to-server,
# no CORS involved); browser origins listed here are only for local tools.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")


SELF_CHECK_CLEAN = "Such an inspiring speech, really gives hope for the future."
SELF_CHECK_TOXIC = "Get lost you filthy idiot, nobody wants you here."


def run_self_check(classifier: ToxicityClassifier) -> bool:
    """Sanity-check the loaded model on one obviously clean and one obviously
    toxic comment. Catches numerically broken inference (e.g. quantized
    kernels overflowing on a host CPU) that would otherwise label everything
    the same way while /health still looked fine."""
    clean, toxic = classifier.predict([SELF_CHECK_CLEAN, SELF_CHECK_TOXIC])
    passed = clean.label == "normal" and toxic.label == "toxic"
    if not passed:
        logger.error(
            "Model self-check FAILED: clean=%s %s, toxic=%s %s",
            clean.label, clean.probabilities, toxic.label, toxic.probabilities,
        )
    return passed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once per process. Tests pre-set app.state.classifier with
    # a fake so they don't need the 250 MB weights.
    if getattr(app.state, "classifier", None) is None:
        try:
            classifier = ToxicityClassifier(MODEL_DIR)
            # Warm-up pass: pages the memory-mapped weights in and initialises the
            # MPS/CUDA kernels now, instead of making the first real request time out.
            classifier.predict(["warm-up"])
            app.state.classifier = classifier
            app.state.self_check = run_self_check(classifier)
            logger.info(
                "Model loaded from %s on %s, max_length=%d, thresholds=%s",
                MODEL_DIR, classifier.device, classifier.max_length, classifier.thresholds,
            )
        except Exception:
            # Start in degraded mode rather than crash: /health reports it and
            # classify endpoints return 503 so callers can tell what's wrong.
            logger.exception("Failed to load classification model from %s", MODEL_DIR)
            app.state.classifier = None
    yield


app = FastAPI(title="Toxic Comment Classifier Service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ORIGINS],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Request Models
class ClassifyRequest(BaseModel):
    text: str

class BatchClassifyRequest(BaseModel):
    texts: List[str]

# Response Models
class ClassifyResponse(BaseModel):
    label: str
    subcategories: List[str]
    confidence: float
    probabilities: Dict[str, float]
    timestamp: str

class BatchClassifyResponse(BaseModel):
    results: List[ClassifyResponse]


def utc_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def to_response(prediction: Prediction, timestamp: str) -> ClassifyResponse:
    return ClassifyResponse(
        label=prediction.label,
        subcategories=prediction.subcategories,
        confidence=prediction.confidence,
        probabilities=prediction.probabilities,
        timestamp=timestamp,
    )


def run_prediction(request: Request, texts: List[str]) -> List[Prediction]:
    classifier = request.app.state.classifier
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model is not loaded or unavailable.")
    try:
        return classifier.predict(texts)
    except Exception:
        logger.exception("Inference execution failed")
        raise HTTPException(status_code=500, detail="Inference execution failed.")


@app.get("/health")
def health_check(request: Request):
    classifier = request.app.state.classifier
    self_check = getattr(request.app.state, "self_check", None)
    return {
        "status": "ok" if classifier is not None and self_check is not False else "degraded",
        "service": "classifier-service",
        "model_loaded": classifier is not None,
        "self_check_passed": self_check,
        "thresholds": classifier.thresholds if classifier is not None else None,
        "timestamp": utc_now(),
    }

@app.post("/classify", response_model=ClassifyResponse)
def classify_text(request: Request, body: ClassifyRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty.")

    prediction = run_prediction(request, [body.text])[0]
    return to_response(prediction, utc_now())

@app.post("/classify/batch", response_model=BatchClassifyResponse)
def classify_batch(request: Request, body: BatchClassifyRequest):
    if not body.texts:
        raise HTTPException(status_code=400, detail="texts must contain at least one item.")
    if len(body.texts) > MAX_BATCH_SIZE:
        raise HTTPException(status_code=413, detail=f"Batch size exceeds limit of {MAX_BATCH_SIZE}.")
    empty = [i for i, text in enumerate(body.texts) if not text.strip()]
    if empty:
        raise HTTPException(status_code=400, detail=f"Text content cannot be empty (indices: {empty}).")

    predictions = run_prediction(request, body.texts)
    timestamp = utc_now()
    return BatchClassifyResponse(results=[to_response(p, timestamp) for p in predictions])

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
