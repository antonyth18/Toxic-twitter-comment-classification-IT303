"""
Text normalization shared by preprocessing (training data) and inference.

Kept free of heavy dependencies (pandas, scikit-learn) so the serving image
can import it without installing the training stack.
"""

from __future__ import annotations

import re

# Matches http(s):// and bare www. URLs.
_URL_RE = re.compile(r"(https?://\S+|www\.\S+)", flags=re.IGNORECASE)
# Matches @mentions (word chars/underscore), e.g. "@someuser".
_MENTION_RE = re.compile(r"@\w+")
# 2+ blank lines -> collapse to a single paragraph break.
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")
# Runs of spaces/tabs (not newlines) -> single space.
_HORIZONTAL_WHITESPACE_RE = re.compile(r"[ \t]+")


def normalize_text(text: str) -> str:
    """Lightweight, reversible-in-spirit normalization for a transformer
    model. Deliberately does NOT strip punctuation, case, or stopwords —
    DistilBERT's subword tokenizer benefits from that information.

    Transformations applied, in order:
      1. URLs (http(s):// or www.) -> "<URL>" placeholder token.
      2. @mentions -> "<USER>" placeholder token.
      3. Runs of spaces/tabs collapsed to a single space.
      4. 3+ consecutive newlines collapsed to 2 (keeps paragraph breaks).
      5. Leading/trailing whitespace stripped.
    Capitalization, punctuation, and emoji are left untouched.
    """
    text = _URL_RE.sub("<URL>", text)
    text = _MENTION_RE.sub("<USER>", text)
    text = _HORIZONTAL_WHITESPACE_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()
