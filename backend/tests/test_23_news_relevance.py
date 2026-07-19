"""BUG: Timeline news not relevant to ticker.
Fix in /api/company/{ticker}/news filters by ticker+company name in title/link.
"""
import pytest


COMPANY_TOKENS = {
    "AAPL": ["aapl", "apple"],
    "NVDA": ["nvda", "nvidia"],
    "MSFT": ["msft", "microsoft"],
    "TSLA": ["tsla", "tesla"],
}


@pytest.mark.parametrize("ticker", ["AAPL", "NVDA"])
def test_news_returns_only_relevant_items(auth_client, base_url, ticker):
    r = auth_client.get(f"{base_url}/api/company/{ticker}/news", timeout=60)
    assert r.status_code == 200, r.text
    news = r.json()
    assert isinstance(news, list)
    # yfinance can be rate-limited; if it's empty tolerate but flag
    if not news:
        pytest.skip(f"yfinance returned zero news items for {ticker} (rate limit)")
    assert 1 <= len(news) <= 10, f"expected 1..10 items, got {len(news)}"
    tokens = COMPANY_TOKENS[ticker]
    irrelevant = []
    for item in news:
        hay = ((item.get("title") or "") + " " + (item.get("link") or "")).lower()
        if not any(tok in hay for tok in tokens):
            irrelevant.append(item.get("title"))
    # Fallback branch (empty relevance filter) is permitted only if yfinance news was empty,
    # which we already handled above. So we require STRICT relevance here.
    assert not irrelevant, f"irrelevant news slipped through relevance filter for {ticker}: {irrelevant}"


def test_news_shape(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/company/AAPL/news", timeout=60)
    assert r.status_code == 200
    news = r.json()
    if not news:
        pytest.skip("yfinance returned zero news items (rate limit)")
    item = news[0]
    for k in ("title", "publisher", "link", "published"):
        assert k in item, f"news item missing key {k}: {item}"
