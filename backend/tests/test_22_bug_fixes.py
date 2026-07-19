"""Cross-cutting bug fix verification:
- BUG 2: Living Thesis versioning (parent_id -> version==2)
- BUG 3: Input.jsx contains 'text-foreground' (visual/CSS static check)
- BUG 4: /documents/contradiction returns retrieved>=2 with 2 contradictory docs
- BUG 5: /company/{ticker}/score + /agents/query with 'research' end-to-end
"""
import io
import os
import pytest
import requests


# ---------- BUG 3: static frontend CSS check ----------
def test_bug3_input_component_has_text_foreground():
    path = "/app/frontend/src/components/ui/input.jsx"
    assert os.path.exists(path), f"missing {path}"
    with open(path, "r") as f:
        content = f.read()
    assert "text-foreground" in content, \
        "shadcn Input must include 'text-foreground' to fix black-on-black input bug"


def test_bug3_index_css_has_input_color_override():
    path = "/app/frontend/src/index.css"
    assert os.path.exists(path), f"missing {path}"
    with open(path, "r") as f:
        content = f.read()
    # Must have SOME explicit color override for textarea/input/select
    lower = content.lower()
    has_override = any(sel in lower for sel in ["textarea", "select {", "input {", "input,", "input,select"])
    assert has_override, "index.css should override text color on input/textarea/select"


# ---------- BUG 2: Living Thesis versioning ----------
def test_bug2_living_thesis_v2_gets_parent_and_version_2(auth_client, base_url):
    v1_body = {
        "ticker": "TSLA",
        "stance": "base",
        "headline": "TSLA v1 for BUG2 test",
        "narrative": "Initial thesis narrative",
        "assumptions": [{"text": "FSD reaches parity by 2027", "kind": "business"}],
        "catalysts": ["Robotaxi launch"],
        "risks": ["Margin compression"],
        "confidence": 60,
    }
    r1 = auth_client.post(f"{base_url}/api/thesis/living", json=v1_body, timeout=30)
    assert r1.status_code == 200, r1.text
    v1 = r1.json()
    assert v1["version"] == 1
    v1_id = v1["thesis_id"]

    v2_body = {**v1_body,
               "headline": "TSLA v2 updated",
               "narrative": "Updated after Q1 print",
               "parent_id": v1_id}
    r2 = auth_client.post(f"{base_url}/api/thesis/living", json=v2_body, timeout=30)
    assert r2.status_code == 200, r2.text
    v2 = r2.json()
    assert v2["version"] == 2, f"expected version 2, got {v2['version']}"
    assert v2["chain_id"] == v1["chain_id"] or v2["chain_id"] == v1_id, \
        "v2.chain_id must equal v1's chain (isVersioning fix)"

    # History confirms both
    rh = auth_client.get(f"{base_url}/api/thesis/living/{v2['thesis_id']}/history", timeout=30)
    assert rh.status_code == 200
    hist = rh.json()
    versions = sorted([h["version"] for h in hist])
    assert 1 in versions and 2 in versions, f"history missing versions: {versions}"


# ---------- BUG 4: contradiction returns retrieved>=2 ----------
DOC_A = ("BUG4TICKER quarterly filing. Management raised full-year guidance and expects "
         "revenue growth of 15 percent driven by AI product demand. Gross margins are expanding "
         "into next fiscal year with strong operating leverage. The company plans to increase "
         "buybacks and pay down debt aggressively. Guidance is unambiguously positive.") * 4

DOC_B = ("BUG4TICKER earnings call transcript flags material contradictions. Management now "
         "expects revenue to decline mid-single digits and gross margins to compress under FX "
         "and pricing pressure. Buybacks are paused to conserve cash. Guidance is being cut."
         " These statements directly contradict the earlier full-year outlook. ") * 4


def _upload(base_url, token, filename, text, ticker):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    files = {"file": (filename, io.BytesIO(text.encode("utf-8")), "text/plain")}
    r = s.post(f"{base_url}/api/documents/upload?ticker={ticker}", files=files, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


def test_bug4_contradiction_returns_retrieved_when_bm25_scores_are_zero(auth_client, base_url, test_user):
    """Regression: BM25 with a rare-word query used to return 0 chunks because scores were 0.
    Fix keeps top_k regardless of score."""
    ticker = "BUG4T"
    d1 = _upload(base_url, test_user["token"], "bug4_bull.txt", DOC_A, ticker=ticker)
    d2 = _upload(base_url, test_user["token"], "bug4_bear.txt", DOC_B, ticker=ticker)
    assert d1["chunks"] > 0 and d2["chunks"] > 0

    # Rare-word query — historically would score 0 across corpus
    r = auth_client.post(f"{base_url}/api/documents/contradiction",
                         json={"ticker": ticker,
                               "query": "xyzzzq unusualtokenfoobarbaz nonexistent"},
                         timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("retrieved", 0) >= 2, \
        f"expected retrieved>=2 (BUG4 fix), got {d.get('retrieved')}: {d}"
    assert d["summary"], "summary must be non-empty even when BM25 scores are zero"
    assert "no document chunks found" not in d["summary"].lower(), \
        f"regression: hit old 'No document chunks found' path: {d['summary']}"


# ---------- BUG 5: /company/{T}/score + /agents/query end-to-end ----------
def test_bug5_company_score_endpoint(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/company/AAPL/score", timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ticker"] == "AAPL"
    assert "overall" in d and isinstance(d["overall"], (int, float))
    assert 0 <= d["overall"] <= 100, f"score out of range: {d['overall']}"
    assert "rating" in d
    assert d.get("as_of")


def test_bug5_running_stock_via_research_agent(auth_client, base_url):
    r = auth_client.post(f"{base_url}/api/agents/query",
                         json={"agent": "research", "ticker": "NVDA",
                               "question": "Quick research read on NVDA."},
                         timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["summary"], "research agent returned empty summary for NVDA"
    assert "unavailable" not in d["summary"].lower(), f"AI unavailable: {d['summary']}"
    assert d["_meta"]["model"] == "gpt-5.4"
    assert d["_meta"]["agent"] == "research"
