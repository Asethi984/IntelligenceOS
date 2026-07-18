"""AI agent endpoints - verify strict JSON contract and real LLM output."""
import pytest

CONTRACT_KEYS = {"summary", "evidence", "sources", "confidence", "assumptions"}


def _validate_ai_panel(d):
    assert CONTRACT_KEYS.issubset(d.keys()), f"missing keys: {CONTRACT_KEYS - set(d.keys())}"
    assert isinstance(d["summary"], str)
    assert isinstance(d["evidence"], list)
    assert isinstance(d["sources"], list)
    assert isinstance(d["confidence"], (int, float))
    assert 0 <= d["confidence"] <= 100
    assert isinstance(d["assumptions"], list)


@pytest.mark.parametrize("agent", [
    "contradiction", "management", "materiality", "earnings_diff",
])
def test_agent_new_variants(auth_client, base_url, agent):
    r = auth_client.post(f"{base_url}/api/agents/query",
                         json={"agent": agent, "ticker": "AAPL",
                               "question": f"Provide a concise {agent} analysis for AAPL."},
                         timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    _validate_ai_panel(d)
    # Real content, not the fallback error
    assert d["summary"], "summary must be non-empty"
    assert "Analysis unavailable" not in d["summary"], \
        f"agent {agent} returned fallback error: {d['summary']}"
    assert "AI key missing" not in d["summary"]


def test_bias_agent(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/agents/query",
                         json={"agent": "bias", "ticker": None,
                               "question": "Common cognitive biases when buying tech stocks after strong rallies."},
                         timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    _validate_ai_panel(d)
    assert d["summary"] and "Analysis unavailable" not in d["summary"]


def test_market_brief(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/market/brief", timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "brief" in d and "as_of" in d
    _validate_ai_panel(d["brief"])
    assert d["brief"]["summary"] and "Analysis unavailable" not in d["brief"]["summary"]


def test_portfolio_brief(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/portfolio/brief", timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "brief" in d
    _validate_ai_panel(d["brief"])
    assert d["brief"]["summary"] and "Analysis unavailable" not in d["brief"]["summary"]
