"""Watchlist + Portfolio CRUD and KPIs."""


def test_watchlist_seed_default(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/watchlist", timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "tickers" in d and isinstance(d["tickers"], list)
    # seeded default
    assert len(d["tickers"]) >= 5
    assert "AAPL" in d["tickers"]


def test_watchlist_add(auth_client, base_url):
    # NOTE: /api/watchlist/add now requires asset_class (new multi-list schema).
    r = auth_client.post(f"{base_url}/api/watchlist/add",
                         json={"asset_class": "stocks", "ticker": "AMD"}, timeout=30)
    assert r.status_code == 200, r.text
    r2 = auth_client.get(f"{base_url}/api/watchlist", timeout=45)
    assert "AMD" in r2.json()["tickers"]


def test_portfolio_add_and_get(auth_client, base_url):
    # add three holdings for later intelligence tests
    for ticker, sh, cb in [("AAPL", 10, 150), ("MSFT", 5, 300), ("NVDA", 4, 400)]:
        r = auth_client.post(f"{base_url}/api/portfolio/add",
                             json={"ticker": ticker, "shares": sh, "cost_basis": cb},
                             timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    r = auth_client.get(f"{base_url}/api/portfolio", timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "holdings" in d and len(d["holdings"]) >= 3
    assert "total_value" in d and "total_cost" in d and "total_gain" in d
    assert "health_score" in d
    assert 0 <= d["health_score"] <= 100
    # each holding should have allocation
    for h in d["holdings"]:
        assert "allocation" in h and "gain_pct" in h
