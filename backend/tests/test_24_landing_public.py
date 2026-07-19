"""Landing / public-route + business summary + auth flow regression.
Frontend Landing routing is client-side. Backend contract:
- /api/auth/me returns 401 for unauth
- Signup + login flows return token+user; duplicate email -> 400
- /api/company/{T}/profile returns summary or graceful error (never 500)
"""
import uuid
import pytest
import requests


BASE = None  # populated via fixture


def test_auth_me_401_without_token(base_url):
    r = requests.get(f"{base_url}/api/auth/me", timeout=15)
    assert r.status_code == 401, f"expected 401 for unauth /api/auth/me, got {r.status_code}"


def test_signup_returns_token_and_user_shape(base_url):
    email = f"TEST_land_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "TestPass!234", "name": "Landing Test"}
    r = requests.post(f"{base_url}/api/auth/signup", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("token"), "no token in signup response"
    assert isinstance(data["token"], str) and len(data["token"]) > 20
    u = data.get("user") or {}
    assert "_id" not in u, f"ObjectId leaking in signup response: {u}"
    assert u.get("email") == email
    assert u.get("user_id"), "user_id missing"
    assert u.get("name") == "Landing Test"
    assert u.get("role") == "Owner", f"expected role=Owner, got {u.get('role')}"
    assert u.get("plan") == "Free", f"expected plan=Free, got {u.get('plan')}"

    # Token must work against /api/auth/me
    r2 = requests.get(f"{base_url}/api/auth/me",
                      headers={"Authorization": f"Bearer {data['token']}"}, timeout=15)
    assert r2.status_code == 200, r2.text
    me = r2.json()
    assert me.get("email") == email


def test_login_flow_and_duplicate_signup(base_url):
    email = f"TEST_land2_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "TestPass!234", "name": "Land2"}
    r_signup = requests.post(f"{base_url}/api/auth/signup", json=payload, timeout=30)
    assert r_signup.status_code == 200

    # Login OK
    r_login = requests.post(f"{base_url}/api/auth/login",
                            json={"email": email, "password": "TestPass!234"}, timeout=30)
    assert r_login.status_code == 200, r_login.text
    assert r_login.json().get("token")

    # Wrong password -> 401
    r_bad = requests.post(f"{base_url}/api/auth/login",
                          json={"email": email, "password": "wrongpw!!"}, timeout=15)
    assert r_bad.status_code == 401, r_bad.text

    # Duplicate signup -> 400
    r_dup = requests.post(f"{base_url}/api/auth/signup", json=payload, timeout=15)
    assert r_dup.status_code == 400, r_dup.text
    body = r_dup.json()
    msg = (body.get("detail") or body.get("message") or "").lower()
    assert "already" in msg or "registered" in msg, f"unexpected duplicate-signup message: {body}"


@pytest.mark.parametrize("ticker", ["AAPL", "MSFT", "NVDA", "TSLA"])
def test_business_summary_present_or_graceful(auth_client, base_url, ticker):
    r = auth_client.get(f"{base_url}/api/company/{ticker}/profile", timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    # Always safe: summary present, OR error field but never 500
    if "error" in data and not data.get("summary"):
        pytest.skip(f"yfinance rate-limited for {ticker}: {data.get('error')}")
    assert data.get("summary"), f"business summary missing for {ticker}: {data}"
    assert isinstance(data["summary"], str)
    assert len(data["summary"]) > 30, f"summary too short for {ticker}: {data['summary']!r}"


def test_business_summary_no_500_even_on_bad_ticker(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/company/ZZZZZZZZ/profile", timeout=30)
    # Must not 500; either 200 with error/empty, or 4xx
    assert r.status_code != 500, r.text
