"""Unit tests for the label/threshold logic in inference/classifier.py."""

import json

import pytest

from inference.classifier import LABEL_COLUMNS, build_prediction, load_thresholds

THRESHOLDS = {label: 0.5 for label in LABEL_COLUMNS}


def probs(**overrides):
    return {label: overrides.get(label, 0.01) for label in LABEL_COLUMNS}


def test_clean_comment_is_normal():
    pred = build_prediction(probs(toxic=0.2), THRESHOLDS)
    assert pred.label == "normal"
    assert pred.subcategories == []
    assert pred.confidence == pytest.approx(0.8)  # 1 - highest probability


def test_toxic_with_subcategories():
    pred = build_prediction(probs(toxic=0.9, insult=0.7, identity_hate=0.6), THRESHOLDS)
    assert pred.label == "toxic"
    assert pred.subcategories == ["insult", "identity_hate"]  # "toxic" itself is not a subcategory
    assert pred.confidence == pytest.approx(0.9)


def test_subcategory_alone_still_marks_toxic():
    pred = build_prediction(probs(obscene=0.8), THRESHOLDS)
    assert pred.label == "toxic"
    assert pred.subcategories == ["obscene"]


def test_per_label_thresholds_are_respected():
    thresholds = {**THRESHOLDS, "threat": 0.3}
    pred = build_prediction(probs(threat=0.35), thresholds)
    assert pred.label == "toxic"
    assert pred.subcategories == ["threat"]


def test_probabilities_cover_all_six_labels():
    pred = build_prediction(probs(), THRESHOLDS)
    assert list(pred.probabilities) == LABEL_COLUMNS
    assert "identity_attack" not in pred.probabilities


def test_load_thresholds_defaults_without_file(tmp_path):
    assert load_thresholds(tmp_path, 0.5) == THRESHOLDS


def test_load_thresholds_partial_file_falls_back(tmp_path):
    (tmp_path / "thresholds.json").write_text(json.dumps({"threat": 0.2}))
    thresholds = load_thresholds(tmp_path, 0.5)
    assert thresholds["threat"] == 0.2
    assert thresholds["toxic"] == 0.5
