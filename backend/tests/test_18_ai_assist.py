"""BUG 8 FIX: /api/agents/assist AI writing assistant covering all context_type values."""
import pytest


ASSIST_CASES = [
    ("thesis",           "NVDA good",                       "improve"),
    ("note",             "Bought some NVDA today",          "make analytical"),
    ("journal_reason",   "Felt bullish",                    "make crisp"),
    ("journal_expected", "Stock will go up",                "make measurable"),
    ("catalyst",         "",                                "generate"),
    ("risk",             "",                                "generate"),
    ("assumption",       "Datacenter demand stays strong",  "make testable"),
]


@pytest.mark.parametrize("context_type,current_text,instruction", ASSIST_CASES)
def test_agents_assist_returns_non_empty(auth_client, base_url, context_type, current_text, instruction):
    body = {
        "context_type": context_type,
        "ticker": "NVDA",
        "current_text": current_text,
        "instruction": instruction,
    }
    r = auth_client.post(f"{base_url}/api/agents/assist", json=body, timeout=180)
    assert r.status_code == 200, f"{context_type} → {r.status_code} {r.text}"
    d = r.json()
    # Contract keys
    for k in ["summary", "evidence", "sources", "confidence", "assumptions", "_meta"]:
        assert k in d, f"[{context_type}] missing key '{k}' in response"
    # Real AI response, not a fallback
    assert d["summary"], f"[{context_type}] summary empty"
    assert "unavailable" not in d["summary"].lower(), f"[{context_type}] AI unavailable: {d['summary']}"
    assert "AI key missing" not in d["summary"], f"[{context_type}] EMERGENT_LLM_KEY missing"
    # Meta comes from note_assist agent
    assert d["_meta"]["agent"] == "note_assist"


def test_agents_assist_ticker_optional(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/agents/assist",
                         json={"context_type": "note", "current_text": "quick idea about semis",
                               "instruction": "improve"},
                         timeout=180)
    assert r.status_code == 200
    d = r.json()
    assert d["summary"], "ticker-less assist should still produce content"


def test_agents_assist_model_is_gpt54(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/agents/assist",
                         json={"context_type": "thesis", "ticker": "AAPL",
                               "current_text": "Ecosystem lock-in", "instruction": "improve"},
                         timeout=180)
    assert r.status_code == 200
    d = r.json()
    assert d["_meta"]["model"] == "gpt-5.4", f"expected model=gpt-5.4, got {d['_meta']['model']}"
