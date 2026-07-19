"""Attractiveness Score endpoint tests.

Covers: GET /api/company/{ticker}/score
"""
import pytest


VALID_RATINGS = {"STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"}


def test_company_score_shape_nvda(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/company/NVDA/score", timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()

    # ticker echo
    assert d["ticker"] == "NVDA"

    # overall 0..100
    assert "overall" in d
    assert isinstance(d["overall"], (int, float))
    assert 0 <= d["overall"] <= 100

    # rating enum
    assert d.get("rating") in VALID_RATINGS, f"unexpected rating: {d.get('rating')}"

    # components block
    comps = d.get("components")
    assert isinstance(comps, dict)
    for k in ("value", "momentum", "quality", "sentiment"):
        assert k in comps, f"missing component {k}"
        assert isinstance(comps[k], (int, float))
        assert 0 <= comps[k] <= 100, f"component {k}={comps[k]} out of range"

    # signals block
    sigs = d.get("signals")
    assert isinstance(sigs, dict)
    for k in ("pe", "range_position_pct", "beta", "change_pct"):
        assert k in sigs, f"missing signal {k}"

    # as_of present
    assert "as_of" in d


def test_company_score_deterministic(auth_client, base_url):
    """Score is deterministic (no LLM): two consecutive calls should yield same overall/rating
    when using cached quote/profile (cache TTL 60s / 3600s).
    """
    r1 = auth_client.get(f"{base_url}/api/company/AAPL/score", timeout=60)
    r2 = auth_client.get(f"{base_url}/api/company/AAPL/score", timeout=60)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["overall"] == r2.json()["overall"]
    assert r1.json()["rating"] == r2.json()["rating"]


def test_company_score_unauthenticated(base_url):
    import requests
    r = requests.get(f"{base_url}/api/company/NVDA/score", timeout=15)
    assert r.status_code == 401
