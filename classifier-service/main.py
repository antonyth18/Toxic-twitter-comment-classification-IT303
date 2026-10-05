import os
import datetime
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Toxic Comment Classifier Service")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        "status": "ok",
        "service": "classifier-service",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }

@app.post("/classify", response_model=ClassifyResponse)
def classify_text(request: ClassifyRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty.")

    text_lower = request.text.lower()
    
    # Keyword detection patterns across toxicity subcategories
    threat_patterns = [
        "kill", "murder", "find you", "where you live", "make you regret",
        "hunt you", "destroy", "shoot", "hurt you", "die", "attack", "beat you"
    ]
    insult_patterns = [
        "stupid", "idiot", "dumb", "ugly", "trash", "clown", "pathetic",
        "loser", "scumbag", "braindead", "shut up", "fraud"
    ]
    identity_patterns = [
        "hate", "eliminated", "disgusting", "that community", "your kind"
    ]

    found_subcategories = []

    if any(p in text_lower for p in threat_patterns):
        found_subcategories.append("threat")
    if any(p in text_lower for p in insult_patterns):
        found_subcategories.append("insult")
    if any(p in text_lower for p in identity_patterns):
        found_subcategories.append("identity_attack")

    if found_subcategories:
        label = "toxic"
        confidence = min(0.98, 0.88 + (0.03 * len(found_subcategories)))
    else:
        label = "normal"
        confidence = 0.95

    return ClassifyResponse(
        label=label,
        subcategories=found_subcategories,
        confidence=round(confidence, 4),
        timestamp=datetime.datetime.utcnow().isoformat() + "Z"
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
