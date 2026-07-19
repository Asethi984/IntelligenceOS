"""Decision Journal: create, postmortem, analyze (AI)."""
import pytest


@pytest.fixture(scope="module")
def journal_ids(auth_client, base_url):
    ids = []
    for payload in [
        {"ticker": "AAPL", "action": "buy", "decision_reason": "Bought post-earnings on Services growth beat.",
         "expected_outcome": "20% upside in 12 months as Services margins expand.",
         "expected_timeframe_months": 12, "confidence": 72},
        {"ticker": "NVDA", "action": "buy", "decision_reason": "FOMO after big rally, felt like missing AI wave.",
         "expected_outcome": "50% upside in 6 months on continued data-center demand.",
         "expected_timeframe_months": 6, "confidence": 85},
    ]:
        r = auth_client.post(f"{base_url}/api/journal", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ticker"] == payload["ticker"]
        assert d["action"] == payload["action"]
        assert d["result_outcome"] is None
        ids.append(d["entry_id"])
    return ids


def test_list_journal(auth_client, base_url, journal_ids):
    r = auth_client.get(f"{base_url}/api/journal", timeout=30)
    assert r.status_code == 200
    entries = r.json()
    ids_in = {e["entry_id"] for e in entries}
    for i in journal_ids:
        assert i in ids_in


def test_postmortem(auth_client, base_url, journal_ids):
    r = auth_client.post(
        f"{base_url}/api/journal/{journal_ids[0]}/postmortem",
        json={"result_outcome": "right", "result_summary": "Hit +20% within 8 months.",
              "lessons": ["Trust the Services thesis", "Don't overtrade around earnings"]},
        timeout=30,
    )
    assert r.status_code == 200
    # verify persistence
    r2 = auth_client.get(f"{base_url}/api/journal", timeout=30)
    e = next(x for x in r2.json() if x["entry_id"] == journal_ids[0])
    assert e["result_outcome"] == "right"
    assert e["resolved_at"] is not None
    assert "Trust the Services thesis" in e["lessons"]


def test_analyze_journal_ai(auth_client, base_url, journal_ids):
    r = auth_client.get(f"{base_url}/api/journal/analyze", timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["summary", "evidence", "sources", "confidence", "assumptions"]:
        assert k in d
    assert d["summary"] and "No journal entries" not in d["summary"]
    assert "Analysis unavailable" not in d["summary"]
