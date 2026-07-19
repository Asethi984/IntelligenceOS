"""Valuation DCF, screener, documents upload/list, alerts, graph."""
import io


def test_dcf_realistic_aapl(auth_client, base_url):
    payload = {
        "ticker": "AAPL",
        "revenue": 400_000_000_000,
        "growth_rate": 0.06,
        "margin": 0.25,
        "wacc": 0.09,
        "terminal_growth": 0.025,
        "years": 5,
        "shares_outstanding": 15_500_000_000,
    }
    r = auth_client.post(f"{base_url}/api/valuation/dcf", json=payload, timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ticker"] == "AAPL"
    assert d["fair_value_per_share"] > 0
    assert len(d["projections"]) == 5
    for k in ["bull", "base", "bear"]:
        assert k in d["scenarios"]
        assert "fair_value" in d["scenarios"][k]
    # bull > base > bear
    assert d["scenarios"]["bull"]["fair_value"] > d["scenarios"]["base"]["fair_value"] > d["scenarios"]["bear"]["fair_value"]


def test_screener_min_market_cap(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/screener/run",
                         json={"min_market_cap": 1_000_000_000_000},
                         timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "results" in d and isinstance(d["results"], list)
    # each result should have market_cap >= 1T (skip Nones)
    for row in d["results"]:
        mc = row.get("market_cap")
        if mc is not None:
            assert mc >= 1_000_000_000_000


def test_screener_sector_tech(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/screener/run",
                         json={"sector": "Technology"},
                         timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "results" in d


def test_documents_upload_and_list(auth_client, base_url, test_user):
    # Auth session with different content-type (multipart)
    import requests
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {test_user['token']}"})
    content = b"This is a sample research memo about Apple Inc. Revenue is growing steadily."
    files = {"file": ("memo.txt", io.BytesIO(content), "text/plain")}
    r = s.post(f"{base_url}/api/documents/upload", files=files, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "doc_id" in d and d["filename"] == "memo.txt"

    # list
    r2 = auth_client.get(f"{base_url}/api/documents", timeout=30)
    assert r2.status_code == 200
    docs = r2.json()
    assert any(x["doc_id"] == d["doc_id"] for x in docs)


def test_alerts_crud(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/alerts",
                         json={"ticker": "AAPL", "condition": "price_above", "value": 200},
                         timeout=30)
    assert r.status_code == 200, r.text
    rule = r.json()
    assert rule["ticker"] == "AAPL"
    assert rule["condition"] == "price_above"
    assert rule["value"] == 200
    rule_id = rule["rule_id"]

    r2 = auth_client.get(f"{base_url}/api/alerts", timeout=30)
    assert r2.status_code == 200
    d = r2.json()
    assert any(x["rule_id"] == rule_id for x in d["rules"])

    r3 = auth_client.delete(f"{base_url}/api/alerts/{rule_id}", timeout=30)
    assert r3.status_code == 200

    r4 = auth_client.get(f"{base_url}/api/alerts", timeout=30)
    assert not any(x["rule_id"] == rule_id for x in r4.json()["rules"])


def test_graph(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/graph/AAPL", timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "nodes" in d and "edges" in d
    assert len(d["nodes"]) > 1
    # AAPL should be one of the nodes
    assert any(n["id"] == "AAPL" for n in d["nodes"])
    # each edge has source/target
    for e in d["edges"]:
        assert "source" in e and "target" in e
