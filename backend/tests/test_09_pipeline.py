"""CRM Pipeline: 7 stages, add/move/delete."""

STAGES = ["idea", "research", "validation", "buy", "monitor", "review", "archive"]


def test_pipeline_add_move_delete(auth_client, base_url):
    # Create idea
    r = auth_client.post(f"{base_url}/api/pipeline",
                         json={"ticker": "AMD", "stage": "idea", "note": "AI GPU alternative"},
                         timeout=30)
    assert r.status_code == 200, r.text
    item = r.json()
    item_id = item["item_id"]
    assert item["stage"] == "idea"

    # list -> should have all 7 stages
    r2 = auth_client.get(f"{base_url}/api/pipeline", timeout=45)
    assert r2.status_code == 200
    d = r2.json()
    assert d["stages"] == STAGES
    assert "items" in d and set(d["items"].keys()) == set(STAGES)
    idea_ids = [i["item_id"] for i in d["items"]["idea"]]
    assert item_id in idea_ids

    # move to research
    r3 = auth_client.post(f"{base_url}/api/pipeline/move",
                          json={"item_id": item_id, "new_stage": "research", "note": "moving to research"},
                          timeout=30)
    assert r3.status_code == 200

    r4 = auth_client.get(f"{base_url}/api/pipeline", timeout=45)
    research_ids = [i["item_id"] for i in r4.json()["items"]["research"]]
    assert item_id in research_ids

    # invalid stage
    r5 = auth_client.post(f"{base_url}/api/pipeline/move",
                          json={"item_id": item_id, "new_stage": "invalid"},
                          timeout=30)
    assert r5.status_code == 400

    # delete
    r6 = auth_client.delete(f"{base_url}/api/pipeline/{item_id}", timeout=30)
    assert r6.status_code == 200
    r7 = auth_client.get(f"{base_url}/api/pipeline", timeout=45)
    for stage in STAGES:
        assert item_id not in [i["item_id"] for i in r7.json()["items"][stage]]
