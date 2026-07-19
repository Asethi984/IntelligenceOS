"""Shared test fixtures for IntelligenceOS backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or os.environ["BACKEND_URL"]
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def test_user():
    """Create a shared test user for the whole session."""
    email = f"TEST_iops_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass!234"
    name = "IntelligenceOS Test User"
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/signup",
               json={"email": email, "password": password, "name": name},
               timeout=30)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": password, "name": name,
            "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="session")
def auth_client(test_user):
    """Session with Bearer JWT."""
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_user['token']}",
    })
    return s
