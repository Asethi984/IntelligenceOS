"""Living Thesis: create, versioning, check (AI), diff, history."""
import pytest


@pytest.fixture(scope="module")
def thesis_ids(auth_client, base_url):
    """Create a v1 thesis for AAPL, return its id for the module."""
    payload = {
        "ticker": "AAPL",
        "stance": "bull",
        "headline": "iPhone + Services flywheel drives durable FCF",
        "narrative": "Ecosystem lock-in and Services margin expansion sustain double-digit EPS growth.",
        "assumptions": [
            {"text": "iPhone unit growth resumes to low-single digits by FY26.", "kind": "business"},
            {"text": "Services gross margin expands past 74%.", "kind": "financial"},
        ],
        "catalysts": ["AI-enabled iPhone super-cycle", "Services >$100B ARR"],
        "risks": ["Regulatory antitrust on App Store", "China demand slowdown"],
        "confidence": 72,
        "price_target": 260,
        "time_horizon_months": 18,
    }
    r = auth_client.post(f"{base_url}/api/thesis/living", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["version"] == 1
    assert d["ticker"] == "AAPL"
    assert len(d["assumptions"]) == 2
    return {"v1": d["thesis_id"]}


def test_list_theses_by_ticker(auth_client, base_url, thesis_ids):
    r = auth_client.get(f"{base_url}/api/thesis/living?ticker=AAPL", timeout=30)
    assert r.status_code == 200
    lst = r.json()
    assert isinstance(lst, list) and len(lst) >= 1
    assert any(t["thesis_id"] == thesis_ids["v1"] for t in lst)


def test_thesis_check_runs_ai(auth_client, base_url, thesis_ids):
    r = auth_client.post(f"{base_url}/api/thesis/living/{thesis_ids['v1']}/check", timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "assumptions" in d and "checked_at" in d
    assert len(d["assumptions"]) == 2
    for a in d["assumptions"]:
        assert a["status"] in ("intact", "at_risk", "broken")
        assert a["last_checked"]
        assert a.get("reasoning") is not None


def test_thesis_v2_and_diff(auth_client, base_url, thesis_ids):
    v2_payload = {
        "ticker": "AAPL", "stance": "bull",
        "headline": "iPhone + Services flywheel (updated post Q1)",
        "narrative": "Adds Vision Pro contribution to Services mix.",
        "assumptions": [
            {"text": "iPhone unit growth resumes to low-single digits by FY26.", "kind": "business"},
            {"text": "Services gross margin expands past 76%.", "kind": "financial"},  # changed
        ],
        "catalysts": ["AI-enabled iPhone super-cycle", "Services >$100B ARR", "Vision Pro traction"],  # added
        "risks": ["China demand slowdown"],  # removed antitrust
        "confidence": 75,
        "price_target": 275,
        "time_horizon_months": 18,
        "parent_id": thesis_ids["v1"],
    }
    r = auth_client.post(f"{base_url}/api/thesis/living", json=v2_payload, timeout=30)
    assert r.status_code == 200, r.text
    v2 = r.json()
    assert v2["version"] == 2, f"expected version 2, got {v2['version']}"

    # diff
    rd = auth_client.get(f"{base_url}/api/thesis/living/{v2['thesis_id']}/diff", timeout=30)
    assert rd.status_code == 200
    diff = rd.json()
    assert "changes" in diff and diff.get("prev_version") == 1 and diff.get("curr_version") == 2
    assert len(diff["changes"]) > 0

    # history
    rh = auth_client.get(f"{base_url}/api/thesis/living/{v2['thesis_id']}/history", timeout=30)
    assert rh.status_code == 200
    hist = rh.json()
    assert isinstance(hist, list) and len(hist) == 2
    versions = sorted([h["version"] for h in hist])
    assert versions == [1, 2]
