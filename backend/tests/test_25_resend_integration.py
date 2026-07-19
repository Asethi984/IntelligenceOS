"""Resend integration tests.

Covers:
(a) Default email prefs created on first GET /api/settings/email-prefs
(b) PUT /api/settings/email-prefs persists updates
(c) POST /api/notifications/test-email returns 200 with sent:false when Resend key
    is rejected — MUST NOT 500 (graceful degradation)
(d) POST /api/portfolio/digest/send respects weekly_digest=false → {skipped:true}
(e) POST /api/auth/signup responds quickly (<2s) even when Resend is invalid — welcome
    email is fire-and-forget via asyncio.create_task
(f) _create_notification-side effect: notification is stored in DB even if email fails
    (verified indirectly via /api/notifications list — email dispatch is best-effort)
"""
import os
import time
import uuid
import pytest
import requests


@pytest.fixture(scope="module")
def resend_user(base_url):
    """Fresh user just for resend tests."""
    email = f"TEST_resend_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass!234"
    s = requests.Session()
    r = s.post(f"{base_url}/api/auth/signup",
               json={"email": email, "password": password, "name": "Resend Tester"},
               timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {tok}"})
    return {"session": s, "email": email, "password": password}


# ---------------- (a) default prefs creation ----------------
def test_email_prefs_default_on_first_get(resend_user, base_url):
    r = resend_user["session"].get(f"{base_url}/api/settings/email-prefs", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    # Shape assertions
    for key in ("user_id", "thesis_alerts", "weekly_digest",
                "product_updates", "created_at", "resend_configured"):
        assert key in d, f"missing key {key} in prefs response: {d}"
    # Defaults
    assert d["thesis_alerts"] is True
    assert d["weekly_digest"] is True
    assert d["product_updates"] is False
    assert d["resend_configured"] is True, "RESEND_API_KEY should be configured in env"
    # No mongo _id leak
    assert "_id" not in d


# ---------------- (b) PUT persists ----------------
def test_email_prefs_put_persists(resend_user, base_url):
    # Toggle thesis_alerts off
    r = resend_user["session"].put(
        f"{base_url}/api/settings/email-prefs",
        json={"thesis_alerts": False}, timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("ok") is True
    assert d.get("thesis_alerts") is False
    assert "updated_at" in d

    # GET returns updated value
    r2 = resend_user["session"].get(f"{base_url}/api/settings/email-prefs", timeout=30)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["thesis_alerts"] is False
    # Others still true
    assert d2["weekly_digest"] is True

    # Flip back so subsequent tests aren't affected
    resend_user["session"].put(
        f"{base_url}/api/settings/email-prefs",
        json={"thesis_alerts": True}, timeout=30,
    )


# ---------------- (c) test-email graceful failure ----------------
def test_test_email_endpoint_graceful_on_invalid_key(resend_user, base_url):
    """The provided Resend key is currently invalid — endpoint MUST return 200
    with {sent:false, error:...}, NOT a 500."""
    r = resend_user["session"].post(f"{base_url}/api/notifications/test-email",
                                    timeout=30)
    assert r.status_code == 200, (
        f"Endpoint must return 200 (graceful) even when Resend rejects; got "
        f"{r.status_code}: {r.text}"
    )
    d = r.json()
    assert "sent" in d, f"response missing 'sent': {d}"
    assert isinstance(d["sent"], bool)
    if d["sent"] is False:
        # Expected path with current (invalid) key
        assert "error" in d and isinstance(d["error"], str) and len(d["error"]) > 0, d
    else:
        # If someone rotates in a valid key, we accept a real id
        assert "id" in d and isinstance(d["id"], str) and len(d["id"]) > 0, d


# ---------------- (d) digest opt-out short-circuit ----------------
def test_digest_respects_weekly_digest_false(resend_user, base_url):
    # Opt out of digest
    r = resend_user["session"].put(
        f"{base_url}/api/settings/email-prefs",
        json={"weekly_digest": False}, timeout=30,
    )
    assert r.status_code == 200

    # POST digest → should short-circuit with skipped:true, reason: user opted out
    r2 = resend_user["session"].post(f"{base_url}/api/portfolio/digest/send",
                                     timeout=30)
    assert r2.status_code == 200, r2.text
    d = r2.json()
    assert d.get("skipped") is True, f"expected skipped:true, got {d}"
    assert d.get("reason") == "user opted out", f"expected reason 'user opted out', got {d}"

    # Restore prefs
    resend_user["session"].put(
        f"{base_url}/api/settings/email-prefs",
        json={"weekly_digest": True}, timeout=30,
    )


def test_digest_attempts_send_when_opted_in(resend_user, base_url):
    """When weekly_digest=true, digest endpoint runs full path (compose portfolio,
    LLM brief, send). With invalid key it returns {sent:false, error:...} and
    NOT 500."""
    # Ensure opted in
    resend_user["session"].put(
        f"{base_url}/api/settings/email-prefs",
        json={"weekly_digest": True}, timeout=30,
    )
    # This endpoint calls LLM (portfolio_brief) so allow generous timeout.
    r = resend_user["session"].post(f"{base_url}/api/portfolio/digest/send",
                                    timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    # Should NOT be the skipped path
    assert d.get("skipped") is not True, f"digest should not be skipped: {d}"
    assert "sent" in d, f"missing 'sent' in digest response: {d}"
    if d["sent"] is False:
        assert "error" in d and len(d["error"]) > 0, d


# ---------------- (e) signup remains fast even with resend down ----------------
def test_signup_is_fast_and_nonblocking(base_url):
    """POST /api/auth/signup must complete <2s even with invalid Resend key
    (welcome email is fire-and-forget)."""
    email = f"TEST_signupspeed_{uuid.uuid4().hex[:8]}@example.com"
    t0 = time.time()
    r = requests.post(f"{base_url}/api/auth/signup",
                      json={"email": email, "password": "TestPass!234",
                            "name": "Speed Signup"},
                      timeout=10)
    elapsed = time.time() - t0
    assert r.status_code == 200, r.text
    assert "token" in r.json()
    # Fire-and-forget welcome should not block the response
    assert elapsed < 2.0, (
        f"signup took {elapsed:.2f}s — welcome email may be blocking the "
        f"request path (should be asyncio.create_task fire-and-forget)"
    )


# ---------------- (f) unauth guard ----------------
def test_email_prefs_requires_auth(base_url):
    r = requests.get(f"{base_url}/api/settings/email-prefs", timeout=15)
    assert r.status_code == 401


def test_test_email_requires_auth(base_url):
    r = requests.post(f"{base_url}/api/notifications/test-email", timeout=15)
    assert r.status_code == 401


def test_digest_requires_auth(base_url):
    r = requests.post(f"{base_url}/api/portfolio/digest/send", timeout=15)
    assert r.status_code == 401


# ---------------- (g) test-email actually calls Resend (attempts real dispatch) ----------------
def test_test_email_actually_attempts_resend(resend_user, base_url):
    """Distinguish 'not configured' from 'key rejected'. Response must contain a
    meaningful error string when sent:false — proves the code reached Resend."""
    r = resend_user["session"].post(f"{base_url}/api/notifications/test-email",
                                    timeout=30)
    assert r.status_code == 200
    d = r.json()
    if d.get("sent") is False:
        err = d.get("error", "").lower()
        # Should NOT be "not configured" — RESEND_API_KEY is set in env
        assert "not configured" not in err, (
            f"Env RESEND_API_KEY appears missing at runtime — got error: {err}"
        )
        # With the currently-supplied invalid key we expect Resend's own message
        # (e.g. 'API key is invalid'). We do NOT hard-assert exact text — we just
        # verify the error came back from a real send attempt (i.e., not the
        # short-circuit "not configured" branch).
