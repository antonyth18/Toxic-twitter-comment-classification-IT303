"""End-to-end check against the real trained model. Skipped when
model/distilbert-toxic/ is absent (e.g. a fresh clone, since it isn't in git)."""

import pytest

from inference.classifier import DEFAULT_MODEL_DIR, ToxicityClassifier

pytestmark = pytest.mark.skipif(
    not (DEFAULT_MODEL_DIR / "model.safetensors").exists(),
    reason="trained model not present at model/distilbert-toxic/",
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


def test_long_input_is_truncated_not_rejected(classifier):
    [pred] = classifier.predict(["word " * 2000])  # far beyond 256 tokens
    assert pred.label in {"toxic", "normal"}
