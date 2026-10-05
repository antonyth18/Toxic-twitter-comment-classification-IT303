"""API tests for main.py using a fake classifier, so they run without the model weights."""

import pytest
from fastapi.testclient import TestClient

import main
from inference.classifier import LABEL_COLUMNS, build_prediction


class FakeClassifier:
    thresholds = {label: 0.5 for label in LABEL_COLUMNS}

    def predict(self, texts):
        results = []
        for text in texts:
            p = {label: 0.01 for label in LABEL_COLUMNS}
            if "idiot" in text.lower():
                p.update(toxic=0.95, insult=0.9)
            results.append(build_prediction(p, self.thresholds))
        return results


@pytest.fixture
def client():
    main.app.state.classifier = FakeClassifier()
    with TestClient(main.app) as c:
        yield c
    main.app.state.classifier = None


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True


def test_classify_returns_full_shape(client):
    res = client.post("/classify", json={"text": "you idiot"})
    assert res.status_code == 200
    body = res.json()
    assert body["label"] == "toxic"
    assert body["subcategories"] == ["insult"]
    assert set(body["probabilities"]) == set(LABEL_COLUMNS)
    assert 0 <= body["confidence"] <= 1
    assert body["timestamp"].endswith("Z")


def test_cors_allows_web_client(client):
    res = client.options(
        "/classify",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_rejects_unknown_origin(client):
    res = client.post("/classify", json={"text": "hi"}, headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in res.headers


def test_classify_rejects_empty_text(client):
    assert client.post("/classify", json={"text": "   "}).status_code == 400


def test_batch_preserves_order(client):
    res = client.post("/classify/batch", json={"texts": ["nice post", "you idiot", "thanks"]})
    assert res.status_code == 200
    labels = [r["label"] for r in res.json()["results"]]
    assert labels == ["normal", "toxic", "normal"]


def test_batch_rejects_empty_list(client):
    assert client.post("/classify/batch", json={"texts": []}).status_code == 400


def test_batch_rejects_blank_item(client):
    res = client.post("/classify/batch", json={"texts": ["ok", ""]})
    assert res.status_code == 400
    assert "[1]" in res.json()["detail"]


def test_batch_rejects_oversized_batch(client):
    res = client.post("/classify/batch", json={"texts": ["hi"] * (main.MAX_BATCH_SIZE + 1)})
    assert res.status_code == 413
