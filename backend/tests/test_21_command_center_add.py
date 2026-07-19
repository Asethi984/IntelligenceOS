"""BUG 1 FIX: Command Center Add Ticker dialog ⇒ POST /api/watchlist/add works
across all three asset classes and GET /api/watchlist still returns the primary
(stocks) list with quotes intact for backward compatibility."""
import pytest


def test_watchlist_get_backward_compat(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/watchlist", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "tickers" in d and isinstance(d["tickers"], list)
    assert "quotes" in d and isinstance(d["quotes"], list)
    assert len(d["tickers"]) == len(d["quotes"]), "quotes must align 1:1 with tickers"
    # Default stocks list is auto-provisioned
    assert len(d["tickers"]) > 0, "expected default stocks tickers to be seeded"


@pytest.mark.parametrize("asset_class,ticker", [
    ("stocks", "AMZN"),
    ("crypto", "SOL-USD"),
    ("etfs",   "SPY"),
])
def test_command_center_add_ticker(auth_client, base_url, asset_class, ticker):
    """Reproduces the Command Center 'Add Ticker' dialog submit."""
    r = auth_client.post(f"{base_url}/api/watchlist/add",
                         json={"asset_class": asset_class, "ticker": ticker},
                         timeout=30)
    assert r.status_code == 200, f"[{asset_class}/{ticker}] {r.status_code} {r.text}"
    d = r.json()
    assert d.get("ok") is True

    # Verify persistence via /watchlist/lists
    rl = auth_client.get(f"{base_url}/api/watchlist/lists", timeout=30)
    assert rl.status_code == 200
    lists = rl.json()["lists"]
    target = next((L for L in lists if L["asset_class"] == asset_class), None)
    assert target is not None, f"asset_class {asset_class} not returned"
    all_tickers = (target.get("default_tickers") or []) + (target.get("user_tickers") or [])
    assert ticker.upper() in [t.upper() for t in all_tickers], \
        f"[{asset_class}] ticker {ticker} not persisted"


def test_add_invalid_asset_class_rejected(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/watchlist/add",
                         json={"asset_class": "nfts", "ticker": "PUNK"},
                         timeout=30)
    assert r.status_code == 400, f"expected 400 for invalid asset_class, got {r.status_code}"


def test_add_idempotent(auth_client, base_url):
    body = {"asset_class": "stocks", "ticker": "TEST_IDEM"}
    r1 = auth_client.post(f"{base_url}/api/watchlist/add", json=body, timeout=30)
    assert r1.status_code == 200
    r2 = auth_client.post(f"{base_url}/api/watchlist/add", json=body, timeout=30)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2.get("already_added") is True, "second add of same ticker must be idempotent"


def test_watchlist_endpoint_does_not_500_on_slow_yfinance(auth_client, base_url):
    """Even when yfinance is rate-limited, /watchlist should not 500 (misc info (a))."""
    r = auth_client.get(f"{base_url}/api/watchlist", timeout=60)
    assert r.status_code == 200, f"watchlist 500'd: {r.status_code} {r.text}"
    # quotes may contain None price fields but the shape must be intact
    for q in r.json()["quotes"]:
        assert isinstance(q, dict), "each quote must be a dict"
