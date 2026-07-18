"""Auth: signup, login, me (JWT bearer path)."""
import uuid
import requests


def test_signup_returns_token_and_user(base_url):
    email = f"TEST_signup_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{base_url}/api/auth/signup",
                      json={"email": email, "password": "TestPass!234", "name": "Sign Up"},
                      timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 20
    assert d["user"]["email"] == email
    assert d["user"]["name"] == "Sign Up"
    assert d["user"]["role"] == "Owner"


def test_signup_duplicate_returns_400(test_user, base_url):
    r = requests.post(f"{base_url}/api/auth/signup",
                      json={"email": test_user["email"], "password": "x", "name": "y"},
                      timeout=30)
    assert r.status_code == 400


def test_login_success(test_user, base_url):
    r = requests.post(f"{base_url}/api/auth/login",
                      json={"email": test_user["email"], "password": test_user["password"]},
                      timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "token" in d and d["user"]["email"] == test_user["email"]


def test_login_invalid_credentials(test_user, base_url):
    r = requests.post(f"{base_url}/api/auth/login",
                      json={"email": test_user["email"], "password": "wrong"},
                      timeout=30)
    assert r.status_code == 401


def test_me_with_bearer(auth_client, test_user, base_url):
    r = auth_client.get(f"{base_url}/api/auth/me", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["email"] == test_user["email"]
    assert "user_id" in d


def test_me_unauthenticated(base_url):
    r = requests.get(f"{base_url}/api/auth/me", timeout=30)
    assert r.status_code == 401
