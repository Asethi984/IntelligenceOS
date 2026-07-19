"""APScheduler: status and manual trigger for auto thesis re-check."""
import pytest


@pytest.fixture(scope="module")
def seed_thesis(auth_client, base_url):
    """Create a living thesis so scheduler has something to scan."""
    payload = {
        "ticker": "AAPL",
        "stance": "bull",
        "headline": "Scheduler-test living thesis",
        "narrative": "AAPL services flywheel and iPhone AI cycle.",
        "assumptions": [
            {"text": "Services gross margin expands past 74%.", "kind": "financial"},
        ],
        "catalysts": ["AI iPhone super-cycle"],
        "risks": ["China demand slowdown"],
        "confidence": 70,
        "price_target": 260,
        "time_horizon_months": 12,
    }
    r = auth_client.post(f"{base_url}/api/thesis/living", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["thesis_id"]


def test_scheduler_status_has_job(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/scheduler/status", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "jobs" in d and "recent_runs" in d
    assert isinstance(d["jobs"], list)
    assert isinstance(d["recent_runs"], list)
    job_ids = [j["id"] for j in d["jobs"]]
    assert "thesis_auto_recheck" in job_ids, f"expected 'thesis_auto_recheck' job in {job_ids}"
    # each job should have a next_run field (may be string)
    for j in d["jobs"]:
        assert "next_run" in j
        if j["id"] == "thesis_auto_recheck":
            assert j["next_run"] and j["next_run"] != "None", "thesis_auto_recheck has no next_run_time"


def test_scheduler_run_now_scans(auth_client, base_url, seed_thesis):
    r = auth_client.post(f"{base_url}/api/scheduler/run-now", timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "scanned" in d and "triggered" in d
    assert isinstance(d["scanned"], int)
    assert d["scanned"] >= 1, f"expected scanned>=1 after seeding thesis, got {d}"
    assert isinstance(d["triggered"], list)
    # triggered may be empty (no material signal today) — that's acceptable per spec.
    # If any triggered items, each should have ticker + reason
    for t in d["triggered"]:
        assert "ticker" in t and "reason" in t
