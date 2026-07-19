"""Bulk Ratings endpoint tests.

Covers: POST /api/ratings
- Without ai_rationale (fast, no LLM)
- With ai_rationale (LLM via EMERGENT_LLM_KEY)
"""
import pytest


VALID_RATINGS = {"STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"}


def test_bulk_ratings_no_ai(auth_client, base_url):
    payload = {"tickers": ["AAPL", "NVDA", "MSFT"], "ai_rationale": False}
    r = auth_client.post(f"{base_url}/api/ratings", json=payload, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "ratings" in d and isinstance(d["ratings"], list)
    ratings = d["ratings"]
    # We requested 3; yfinance may occasionally drop one — require at least 2, but ideally 3.
    assert len(ratings) >= 2, f"expected >=2 rating rows, got {len(ratings)}"
    tickers_returned = {row["ticker"] for row in ratings}
    # Assert full set when possible
    if len(ratings) == 3:
        assert tickers_returned == {"AAPL", "NVDA", "MSFT"}

    for row in ratings:
        assert row["ticker"] in {"AAPL", "NVDA", "MSFT"}
        assert row.get("rating") in VALID_RATINGS
        assert 0 <= row["overall"] <= 100
        assert isinstance(row.get("components"), dict)
        # ai_rationale must NOT be present when not requested
        assert "ai_rationale" not in row


def test_bulk_ratings_with_ai(auth_client, base_url):
    payload = {"tickers": ["NVDA"], "ai_rationale": True}
    r = auth_client.post(f"{base_url}/api/ratings", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    ratings = d["ratings"]
    assert len(ratings) == 1, f"expected 1 row, got {len(ratings)}"
    row = ratings[0]
    assert row["ticker"] == "NVDA"
    assert row.get("rating") in VALID_RATINGS

    # ai_rationale must be present and non-empty string
    assert "ai_rationale" in row, "ai_rationale missing when ai_rationale=True was requested"
    assert isinstance(row["ai_rationale"], str)
    assert len(row["ai_rationale"].strip()) > 0, "ai_rationale is empty string"
    # Guard against fallback "Analysis unavailable" text (means LLM failed silently)
    assert "unavailable" not in row["ai_rationale"].lower(), \
        f"ai_rationale looks like fallback: {row['ai_rationale']}"


def test_bulk_ratings_unauthenticated(base_url):
    import requests
    r = requests.post(f"{base_url}/api/ratings", json={"tickers": ["AAPL"]}, timeout=15)
    assert r.status_code == 401
