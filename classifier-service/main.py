import os
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

MODEL_DIR = Path(os.getenv("MODEL_DIR", str(DEFAULT_MODEL_DIR)))
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", 100))
# The web client currently calls this service straight from the browser.
# Once the backend proxies /classify, this can shrink to the backend only.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once per process. Tests pre-set app.state.classifier with
    # a fake so they don't need the 250 MB weights.
    if getattr(app.state, "classifier", None) is None:
        app.state.classifier = ToxicityClassifier(MODEL_DIR)
        # Warm-up pass: pages the memory-mapped weights in and initialises the
        # MPS/CUDA kernels now, instead of making the first real request time out.
        app.state.classifier.predict(["warm-up"])
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


@app.get("/health")
def health_check(request: Request):
    classifier = request.app.state.classifier
    return {
        "status": "ok",
        "service": "classifier-service",
        "model_loaded": classifier is not None,
        "thresholds": classifier.thresholds,
        "timestamp": utc_now(),
    }

@app.post("/classify", response_model=ClassifyResponse)
def classify_text(request: Request, body: ClassifyRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty.")

    prediction = request.app.state.classifier.predict([body.text])[0]
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

    predictions = request.app.state.classifier.predict(body.texts)
    timestamp = utc_now()
    return BatchClassifyResponse(results=[to_response(p, timestamp) for p in predictions])

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
