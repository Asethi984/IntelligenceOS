"""Market data endpoints backed by yfinance. Tolerate rate-limit (data null) but require 200."""


def test_market_overview(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/market/overview", timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "indices" in d and isinstance(d["indices"], list) and len(d["indices"]) == 5
    assert "sectors" in d and isinstance(d["sectors"], list) and len(d["sectors"]) == 11
    # each item has label + ticker
    for row in d["indices"]:
        assert "label" in row and "ticker" in row


def test_market_quote(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/market/quote/AAPL", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ticker"] == "AAPL"
    assert "price" in d  # may be None on rate-limit
    # If not rate-limited, price should be > 0
    if d.get("price") is not None:
        assert d["price"] > 0


def test_market_history_1mo(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/market/history/AAPL?period=1mo", timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d, list)
    # historical data may be empty on rate limit but usually returns rows
    if d:
        assert "date" in d[0] and "close" in d[0]


def test_search(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/search?q=NVDA", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "results" in d
    tickers = [x["ticker"] for x in d["results"]]
    assert "NVDA" in tickers
