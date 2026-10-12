"""End-to-end check against the real (ONNX) serving model. Skipped when
model/distilbert-toxic-onnx/ is absent (run model/export_onnx.py to create it)."""

import pytest

from inference.classifier import DEFAULT_MODEL_DIR, ToxicityClassifier

pytestmark = pytest.mark.skipif(
    not (DEFAULT_MODEL_DIR / "model.onnx").exists(),
    reason="serving model not present at model/distilbert-toxic-onnx/",
)


@pytest.fixture(scope="module")
def classifier():
    return ToxicityClassifier(DEFAULT_MODEL_DIR)


def test_real_model_separates_clean_and_toxic(classifier):
    clean, toxic = classifier.predict([
        "Thanks for fixing the citation, great work!",
        "You are a complete idiot and nobody wants you here.",
    ])
    assert clean.label == "normal"
    assert toxic.label == "toxic"
    assert "insult" in toxic.subcategories


def test_urls_and_mentions_are_normalized_like_training(classifier):
    # Same text with and without a URL/@mention should score identically once
    # both are mapped to the <URL>/<USER> placeholders used in training.
    a, b = classifier.predict_probabilities([
        "@alice you are an idiot http://example.com/a",
        "@bob you are an idiot https://other.org/b",
    ])
    assert a == pytest.approx(b)


def test_long_input_is_truncated_not_rejected(classifier):
    [pred] = classifier.predict(["word " * 2000])  # far beyond 256 tokens
    assert pred.label in {"toxic", "normal"}
