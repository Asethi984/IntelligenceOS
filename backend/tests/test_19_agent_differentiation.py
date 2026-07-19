"""BUG 7 FIX: Verify each AI agent is genuinely different (different context, temperature, output)."""
import pytest


def _query(auth_client, base_url, agent, ticker="NVDA", question=None):
    q = question or f"Give a {agent}-lens read on {ticker}."
    r = auth_client.post(f"{base_url}/api/agents/query",
                         json={"agent": agent, "ticker": ticker, "question": q},
                         timeout=180)
    assert r.status_code == 200, f"agent={agent}: {r.status_code} {r.text}"
    return r.json()


def test_temperature_differs_across_agents(auth_client, base_url):
    """AGENT_CONFIG should give research=0.4, financial=0.2, news=0.5, valuation=0.2."""
    temps = {}
    for a in ["research", "financial", "news", "valuation"]:
        d = _query(auth_client, base_url, a, ticker="AAPL",
                   question="Quick one-liner take.")
        temps[a] = d["_meta"]["temperature"]
    assert temps["research"] == 0.4, temps
    assert temps["financial"] == 0.2, temps
    assert temps["news"] == 0.5, temps
    assert temps["valuation"] == 0.2, temps
    # Also confirm they truly differ (not all defaults)
    assert len({temps["research"], temps["financial"], temps["news"], temps["valuation"]}) >= 3


def test_competitor_vs_financial_produce_different_outputs(auth_client, base_url):
    """Same ticker, different agent context enrichment ⇒ different responses."""
    d_fin = _query(auth_client, base_url, "financial", ticker="NVDA",
                   question="Give a financial-only read on NVDA. Focus purely on the income statement.")
    d_comp = _query(auth_client, base_url, "competitor", ticker="NVDA",
                    question="Give a peer-comparison read on NVDA. Focus purely on peers.")
    assert d_fin["_meta"]["agent"] == "financial"
    assert d_comp["_meta"]["agent"] == "competitor"
    assert d_fin["summary"] and d_comp["summary"]
    # The two agent outputs must not be identical strings (different context => different response)
    assert d_fin["summary"] != d_comp["summary"], \
        "financial and competitor agents returned IDENTICAL summary — context enrichment not working"


def test_macro_agent_evidence_reflects_macro_context(auth_client, base_url):
    """Macro agent enriches with 10y/oil/USD — should surface in evidence or assumptions."""
    d = _query(auth_client, base_url, "macro", ticker="NVDA",
               question="How do rates, oil, and USD influence NVDA?")
    assert d["_meta"]["agent"] == "macro"
    blob = " ".join([d.get("summary", "")] + list(d.get("evidence") or []) +
                    list(d.get("assumptions") or [])).lower()
    # At least one of the macro signals must appear (rates/10y/dollar/usd/oil)
    keywords = ["rate", "10y", "yield", "dollar", "usd", "oil", "crude", "macro"]
    hits = [k for k in keywords if k in blob]
    assert hits, f"macro agent output has no macro signals in evidence/summary: {d}"


def test_risk_agent_context_includes_beta_or_debt(auth_client, base_url):
    """Risk agent enriches with beta/shortRatio/debt — should show risk framing in output."""
    d = _query(auth_client, base_url, "risk", ticker="TSLA",
               question="What are TSLA's structural risks?")
    assert d["_meta"]["agent"] == "risk"
    blob = " ".join([d.get("summary", "")] + list(d.get("evidence") or [])).lower()
    keywords = ["beta", "debt", "short", "leverage", "volatil", "risk"]
    assert any(k in blob for k in keywords), f"risk agent output has no risk framing: {d}"
