import os
import datetime
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Toxic Comment Classifier Service")

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
    
    # Very simple mock classification logic based on keywords
    toxic_keywords = ["hate", "kill", "stupid", "idiot", "dumb", "ugly", "trash"]
    found_subcategories = []
    
    if "kill" in text_lower:
        found_subcategories.append("threat")
    if any(word in text_lower for word in ["stupid", "idiot", "dumb", "ugly"]):
        found_subcategories.append("insult")
    if "hate" in text_lower:
        found_subcategories.append("identity_attack")

    if found_subcategories:
        label = "toxic"
        confidence = 0.88 + (0.02 * len(found_subcategories))  # Dynamic-looking mock confidence
    else:
        label = "normal"
        confidence = 0.95
        found_subcategories = []

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
