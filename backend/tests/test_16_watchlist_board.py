"""Multi-asset Watchlist Board tests: default lists, plan cap, crypto/etfs, chart periods.

Covers:
- GET  /api/watchlist/lists  (3 default lists: stocks/crypto/etfs)
- POST /api/watchlist/add    (with asset_class), including Free plan cap (5 additional)
- POST /api/watchlist/remove (user tickers only; defaults remain)
- GET  /api/market/history/{ticker}?period=X  for many periods
- Backward compat: GET /api/watchlist still returns primary stocks list
"""
import uuid
import pytest
import requests


DEFAULT_LISTS = {
    "stocks": {"AAPL", "MSFT", "NVDA", "GOOGL", "TSLA"},
    "crypto": {"BTC-USD", "ETH-USD", "SOL-USD"},
    "etfs":   {"SPY", "QQQ", "VTI"},
}

CHART_PERIODS = ["1d", "5d", "1mo", "ytd", "6mo", "1y", "5y", "10y", "max"]


# -------- Isolated user fixtures (avoid crossing with session user) --------
@pytest.fixture(scope="module")
def board_user(base_url):
    email = f"TEST_board_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass!234"
    s = requests.Session()
    r = s.post(f"{base_url}/api/auth/signup",
               json={"email": email, "password": password, "name": "Board Tester"},
               timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {tok}"})
    return s


# -------- Default lists --------
def test_watchlist_lists_returns_three_defaults(board_user, base_url):
    r = board_user.get(f"{base_url}/api/watchlist/lists", timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "lists" in d and isinstance(d["lists"], list)
    assert len(d["lists"]) == 3, f"expected exactly 3 default lists, got {len(d['lists'])}"

    seen_asset_classes = {lst["asset_class"] for lst in d["lists"]}
    assert seen_asset_classes == {"stocks", "crypto", "etfs"}

    # each list has default_tickers seeded + user_slots_used + user_slots_max fields
    for lst in d["lists"]:
        ac = lst["asset_class"]
        assert set(lst.get("default_tickers", [])) >= DEFAULT_LISTS[ac], \
            f"defaults for {ac} missing: expected superset of {DEFAULT_LISTS[ac]}"
        assert "user_slots_used" in lst, f"missing user_slots_used on {ac}"
        assert "user_slots_max" in lst, f"missing user_slots_max on {ac}"
        assert lst["user_slots_used"] == 0  # fresh user
        # Free plan cap
        assert lst["user_slots_max"] == 5

    assert d.get("plan") == "Free"
    assert d.get("additional_cap_free") == 5


# -------- Free plan cap --------
def test_free_plan_cap_stocks(board_user, base_url):
    # Add 5 user tickers → all succeed
    tickers = ["AMZN", "META", "AMD", "NFLX", "AVGO"]
    for t in tickers:
        r = board_user.post(f"{base_url}/api/watchlist/add",
                            json={"asset_class": "stocks", "ticker": t}, timeout=30)
        assert r.status_code == 200, f"add {t} failed: {r.status_code} {r.text}"

    # 6th call must be blocked with 403 and 'Free plan limit reached' message
    r6 = board_user.post(f"{base_url}/api/watchlist/add",
                         json={"asset_class": "stocks", "ticker": "PLTR"}, timeout=30)
    assert r6.status_code == 403, f"expected 403 on 6th add, got {r6.status_code}: {r6.text}"
    err = r6.json().get("detail", "")
    assert "Free plan limit reached" in err, f"missing cap message: {err}"

    # slots_used should be 5
    lists = board_user.get(f"{base_url}/api/watchlist/lists", timeout=90).json()["lists"]
    stocks_lst = next(l for l in lists if l["asset_class"] == "stocks")
    assert stocks_lst["user_slots_used"] == 5


# -------- Remove user ticker; default stays --------
def test_remove_user_ticker_default_stays(board_user, base_url):
    # Remove one user-added ticker (added in previous test): "AMZN"
    r = board_user.post(f"{base_url}/api/watchlist/remove",
                        json={"asset_class": "stocks", "ticker": "AMZN"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    lists = board_user.get(f"{base_url}/api/watchlist/lists", timeout=90).json()["lists"]
    stocks_lst = next(l for l in lists if l["asset_class"] == "stocks")
    assert "AMZN" not in stocks_lst.get("user_tickers", [])
    # slot freed
    assert stocks_lst["user_slots_used"] == 4

    # Attempting to "remove" a default ticker must be a no-op — default stays
    r2 = board_user.post(f"{base_url}/api/watchlist/remove",
                         json={"asset_class": "stocks", "ticker": "AAPL"}, timeout=30)
    assert r2.status_code == 200  # endpoint doesn't error; just pulls from user_tickers
    lists2 = board_user.get(f"{base_url}/api/watchlist/lists", timeout=90).json()["lists"]
    stocks_lst2 = next(l for l in lists2 if l["asset_class"] == "stocks")
    assert "AAPL" in stocks_lst2["default_tickers"], "default ticker AAPL was removed via /remove"


# -------- Crypto & ETF support --------
def test_add_crypto_and_etf(board_user, base_url):
    r = board_user.post(f"{base_url}/api/watchlist/add",
                        json={"asset_class": "crypto", "ticker": "DOGE-USD"}, timeout=30)
    assert r.status_code == 200, r.text
    r2 = board_user.post(f"{base_url}/api/watchlist/add",
                         json={"asset_class": "etfs", "ticker": "ARKK"}, timeout=30)
    assert r2.status_code == 200, r2.text

    lists = board_user.get(f"{base_url}/api/watchlist/lists", timeout=90).json()["lists"]
    crypto = next(l for l in lists if l["asset_class"] == "crypto")
    etfs = next(l for l in lists if l["asset_class"] == "etfs")
    assert "DOGE-USD" in crypto.get("user_tickers", [])
    assert "ARKK" in etfs.get("user_tickers", [])


def test_watchlist_add_invalid_asset_class(board_user, base_url):
    r = board_user.post(f"{base_url}/api/watchlist/add",
                        json={"asset_class": "bonds", "ticker": "AGG"}, timeout=15)
    assert r.status_code == 400, r.text


# -------- Backward compat: GET /api/watchlist returns primary stocks list --------
def test_backward_compat_get_watchlist(board_user, base_url):
    r = board_user.get(f"{base_url}/api/watchlist", timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "tickers" in d and isinstance(d["tickers"], list)
    assert "quotes" in d
    # primary stocks list contains default tickers
    tickers_set = set(d["tickers"])
    assert DEFAULT_LISTS["stocks"].issubset(tickers_set), \
        f"backward-compat /api/watchlist missing defaults: {tickers_set}"


# -------- Chart periods --------
@pytest.mark.parametrize("period", CHART_PERIODS)
def test_chart_periods(board_user, base_url, period):
    r = board_user.get(f"{base_url}/api/market/history/AAPL", params={"period": period}, timeout=60)
    assert r.status_code == 200, f"period={period} failed: {r.text}"
    arr = r.json()
    assert isinstance(arr, list), f"period={period} not a list"
    # Spec: 1d may be [] on non-trading days; other periods should have data
    if period != "1d":
        assert len(arr) > 0, f"period={period} returned empty list"
        first = arr[0]
        assert "date" in first and "close" in first and "volume" in first
