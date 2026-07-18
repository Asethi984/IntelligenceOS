"""Portfolio Intelligence: hidden connections, macro exposure, timeline.

We seed holdings inside this module so the tests are self-contained and
survive xdist loadscope worker-isolation (each worker gets its own test user)."""
import pytest


@pytest.fixture(scope="module", autouse=True)
def _seed_holdings(auth_client, base_url):
    for ticker, sh, cb in [("AAPL", 10, 150), ("MSFT", 5, 300), ("NVDA", 4, 400)]:
        auth_client.post(f"{base_url}/api/portfolio/add",
                         json={"ticker": ticker, "shares": sh, "cost_basis": cb},
                         timeout=30)


def test_portfolio_connections(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/portfolio/connections", timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    # AIPanel shape
    for k in ["summary", "evidence", "sources", "confidence", "assumptions"]:
        assert k in d
    assert d["summary"] and "Analysis unavailable" not in d["summary"]
    # We seeded 3 holdings so should not be "No holdings."
    assert "No holdings" not in d["summary"]


def test_portfolio_macro(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/portfolio/macro", timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "exposures" in d
    assert isinstance(d["exposures"], list)
    # summary should be populated
    assert d.get("summary")
    # Should parse at least one exposure line
    # (not enforcing count; LLM may or may not put lines in assumptions)


def test_timeline_ticker(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/timeline/AAPL", timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ticker"] == "AAPL"
    assert "events" in d and isinstance(d["events"], list)
