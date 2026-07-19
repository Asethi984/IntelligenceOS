"""Demo seed: /api/demo/seed inserts 6 journal + 11 pipeline items; /api/demo/clear removes only demo=True."""
import pytest


def test_demo_seed_and_bias_analysis(auth_client, base_url):
    # Baseline counts before seed
    j0 = auth_client.get(f"{base_url}/api/journal", timeout=30).json()
    pip0 = auth_client.get(f"{base_url}/api/pipeline", timeout=45).json()
    base_j = len(j0)
    base_p = sum(len(v) for v in pip0["items"].values())

    # Seed
    r = auth_client.post(f"{base_url}/api/demo/seed", timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["journal_added"] == 6, f"expected 6 journal_added, got {d['journal_added']}"
    assert d["pipeline_added"] == 11, f"expected 11 pipeline_added, got {d['pipeline_added']}"

    # Verify journal has >=6 entries
    r_j = auth_client.get(f"{base_url}/api/journal", timeout=30)
    assert r_j.status_code == 200
    journal = r_j.json()
    assert len(journal) >= 6
    # At least 6 of them must be demo=True
    demo_j = [e for e in journal if e.get("demo") is True]
    assert len(demo_j) >= 6

    # Verify pipeline has >=11 items across stages
    r_p = auth_client.get(f"{base_url}/api/pipeline", timeout=45)
    assert r_p.status_code == 200
    pip = r_p.json()
    assert "stages" in pip and "items" in pip
    total = sum(len(v) for v in pip["items"].values())
    assert total >= 11, f"expected >=11 pipeline items, got {total}"
    # multiple stages populated
    stages_with_items = [s for s, v in pip["items"].items() if len(v) > 0]
    assert len(stages_with_items) >= 3, f"expected items across multiple stages, got {stages_with_items}"

    # Bias detection after seed should now be meaningful (AI, GPT-5.2)
    r_a = auth_client.get(f"{base_url}/api/journal/analyze", timeout=180)
    assert r_a.status_code == 200, r_a.text
    a = r_a.json()
    for k in ["summary", "evidence", "sources", "confidence", "assumptions"]:
        assert k in a
    assert a["summary"], "bias analysis summary empty"
    assert "No journal entries" not in a["summary"]
    assert "Analysis unavailable" not in a["summary"]


def test_demo_clear_deletes_only_demo(auth_client, base_url):
    # Ensure at least one non-demo journal exists (add one so we can verify it is untouched)
    r_nd = auth_client.post(
        f"{base_url}/api/journal",
        json={"ticker": "MSFT", "action": "buy",
              "decision_reason": "non-demo entry preserved through clear.",
              "expected_outcome": "Untouched by demo/clear.",
              "expected_timeframe_months": 12, "confidence": 60},
        timeout=30,
    )
    assert r_nd.status_code == 200
    non_demo_id = r_nd.json()["entry_id"]

    # Clear demo
    r = auth_client.post(f"{base_url}/api/demo/clear", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["journal_cleared"] >= 6
    assert d["pipeline_cleared"] >= 11

    # Non-demo journal entry must survive
    r_j = auth_client.get(f"{base_url}/api/journal", timeout=30)
    ids = {e["entry_id"] for e in r_j.json()}
    assert non_demo_id in ids, "non-demo journal entry was incorrectly deleted"

    # No remaining demo=True items should be in journal
    remaining_demo = [e for e in r_j.json() if e.get("demo") is True]
    assert len(remaining_demo) == 0, f"expected no demo journal entries after clear, got {len(remaining_demo)}"

    # Pipeline should also have no demo=True items left
    r_p = auth_client.get(f"{base_url}/api/pipeline", timeout=45)
    all_pip = [it for v in r_p.json()["items"].values() for it in v]
    demo_pip = [it for it in all_pip if it.get("demo") is True]
    assert len(demo_pip) == 0, f"expected no demo pipeline items after clear, got {len(demo_pip)}"
