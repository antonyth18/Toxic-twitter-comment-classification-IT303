"""Test script for Toxic Comment Classifier Service.

POSTs sample texts to http://127.0.0.1:8000/classify and prints a formatted
table containing text, label, subcategories, confidence, and latency in ms.
Also checks http://127.0.0.1:8000/health and reports accuracy and slow requests.
"""

import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Tuple

BASE_URL = "http://127.0.0.1:8000"
HEALTH_URL = f"{BASE_URL}/health"
CLASSIFY_URL = f"{BASE_URL}/classify"

# 8 clearly toxic samples (including required phrases, direct threat, and identity-based insult)
TOXIC_SAMPLES: List[str] = [
    "I will fuck your mom",
    "you are a worthless idiot",
    "I am going to hunt you down and kill you",
    "You are a disgusting subhuman because of your religion",
    "Shut up you pathetic loser, nobody cares about you",
    "I will find where you live and destroy you",
    "You are completely braindead and garbage",
    "Go die in a hole you ugly piece of shit",
]

# 8 clearly clean samples
CLEAN_SAMPLES: List[str] = [
    "have a great day",
    "thanks for sharing this",
    "Looking forward to working together on this project.",
    "Could you please help me understand this concept?",
    "The weather is lovely outside this afternoon.",
    "Congratulations on your promotion, well deserved!",
    "I appreciate your quick reply and helpful guidance.",
    "This recipe turned out delicious, thank you for the tip.",
]


def check_health() -> Dict[str, Any]:
    """Check /health endpoint and verify connectivity."""
    try:
        req = urllib.request.Request(HEALTH_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data
    except urllib.error.URLError as e:
        print(f"\n[ERROR] Connection failed to {BASE_URL}: {e}")
        print("Please ensure the classifier service is running, for example via:")
        print("  .\\.venv\\Scripts\\python.exe -m uvicorn main:app --port 8000")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error connecting to /health: {e}")
        sys.exit(1)


def classify_text(text: str) -> Tuple[Dict[str, Any], float]:
    """POST text to /classify and return response dictionary and latency in ms."""
    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        CLASSIFY_URL,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )

    start_time = time.perf_counter()
    with urllib.request.urlopen(req, timeout=10) as response:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        data = json.loads(response.read().decode("utf-8"))
        return data, duration_ms


def truncate(text: str, max_len: int = 40) -> str:
    """Truncate text with ellipsis if it exceeds max_len."""
    return text if len(text) <= max_len else text[: max_len - 3] + "..."


def main() -> None:
    print("=" * 100)
    print("CLASSIFIER SERVICE BENCHMARK & ACCURACY TEST")
    print("=" * 100)

    # 1. Health check & model_loaded inspection
    print(f"\n[1/3] Checking service health at {HEALTH_URL}...")
    health_data = check_health()
    model_loaded = health_data.get("model_loaded")
    status = health_data.get("status")
    print(f"  Service Status : {status}")
    print(f"  model_loaded   : {model_loaded}")

    if not model_loaded:
        print("  [WARNING] Model is reported as NOT loaded in classifier-service.")

    # 2. Benchmark runs
    print(f"\n[2/3] Running classification tests on 16 samples (8 toxic, 8 clean)...")

    results: List[Dict[str, Any]] = []
    toxic_correct = 0
    clean_correct = 0
    slow_requests: List[Tuple[str, float]] = []

    all_test_cases = [("toxic", t) for t in TOXIC_SAMPLES] + [("clean", c) for c in CLEAN_SAMPLES]

    for expected_type, sample in all_test_cases:
        try:
            resp, duration_ms = classify_text(sample)
        except urllib.error.URLError as e:
            print(f"\n[ERROR] Connection error during request for '{sample}': {e}")
            sys.exit(1)

        label = resp.get("label", "unknown")
        subcategories = ", ".join(resp.get("subcategories", [])) or "-"
        confidence = resp.get("confidence", 0.0)

        is_correct = (expected_type == "toxic" and label == "toxic") or (
            expected_type == "clean" and label == "normal"
        )

        if expected_type == "toxic" and is_correct:
            toxic_correct += 1
        elif expected_type == "clean" and is_correct:
            clean_correct += 1

        is_slow = duration_ms > 3000.0
        if is_slow:
            slow_requests.append((sample, duration_ms))

        results.append(
            {
                "expected": expected_type,
                "text": sample,
                "label": label,
                "subcategories": subcategories,
                "confidence": confidence,
                "latency_ms": duration_ms,
                "is_slow": is_slow,
                "is_correct": is_correct,
            }
        )

    # 3. Print Results Table
    header_fmt = "{:<42} | {:<8} | {:<25} | {:<10} | {:<12} | {:<7}"
    row_fmt = "{:<42} | {:<8} | {:<25} | {:<10.4f} | {:<12.1f} | {:<7}"
    separator = "-" * 115

    print("\n" + separator)
    print(
        header_fmt.format(
            "Text", "Label", "Subcategories", "Confidence", "Time (ms)", "Status"
        )
    )
    print(separator)

    for r in results:
        status_tag = "SLOW!" if r["is_slow"] else ("OK" if r["is_correct"] else "MISMATCH")
        print(
            row_fmt.format(
                truncate(r["text"], 42),
                r["label"],
                truncate(r["subcategories"], 25),
                r["confidence"],
                r["latency_ms"],
                status_tag,
            )
        )
    print(separator)

    # 4. Summary & Flags
    total_samples = len(all_test_cases)
    total_correct = toxic_correct + clean_correct

    print("\n[3/3] Test Summary:")
    print(f"  Toxic Samples Correct : {toxic_correct}/{len(TOXIC_SAMPLES)}")
    print(f"  Clean Samples Correct : {clean_correct}/{len(CLEAN_SAMPLES)}")
    print(
        f"  Total Accuracy        : {total_correct}/{total_samples} ({(total_correct / total_samples) * 100:.1f}%)"
    )

    if slow_requests:
        print(f"\n  [ALERT] {len(slow_requests)} request(s) took more than 3.0 seconds (>3000 ms):")
        for text, lat in slow_requests:
            print(f"    - \"{text}\": {lat:.2f} ms")
    else:
        print("  Latency Flag Check    : All requests completed within 3.0 seconds (no slow requests flagged).")

    print("\n" + "=" * 100)


if __name__ == "__main__":
    main()
