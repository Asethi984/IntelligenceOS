"""BUG 6 FIX: Every AI response must report _meta.model == 'gpt-5.4'."""
import pytest


AGENTS_UNDER_TEST = ["research", "financial", "news", "competitor",
                    "risk", "valuation", "macro"]


@pytest.mark.parametrize("agent", AGENTS_UNDER_TEST)
def test_agent_meta_model_is_gpt54(auth_client, base_url, agent):
    r = auth_client.post(f"{base_url}/api/agents/query",
                         json={"agent": agent, "ticker": "AAPL",
                               "question": "One-line take."},
                         timeout=180)
    assert r.status_code == 200, f"{agent}: {r.text}"
    d = r.json()
    assert "_meta" in d, f"[{agent}] response missing _meta"
    assert d["_meta"]["model"] == "gpt-5.4", \
        f"[{agent}] expected model=gpt-5.4, got {d['_meta']['model']}"


def test_market_brief_uses_gpt54(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/market/brief", timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["brief"]["_meta"]["model"] == "gpt-5.4"


def test_portfolio_brief_uses_gpt54(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/portfolio/brief", timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["brief"]["_meta"]["model"] == "gpt-5.4"


def test_assist_uses_gpt54(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/agents/assist",
                         json={"context_type": "note", "current_text": "test",
                               "instruction": "improve"},
                         timeout=180)
    assert r.status_code == 200
    assert r.json()["_meta"]["model"] == "gpt-5.4"
