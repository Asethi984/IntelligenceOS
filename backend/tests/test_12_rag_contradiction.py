"""Documents RAG with BM25 chunking: upload + contradiction + doc-scoped ask + delete."""
import io
import requests


DOC1_TEXT = (
    "Apple Inc quarterly bullish memo on financials and guidance. "
    "Gross margins are expanding this quarter driven by "
    "favorable Services mix shift and pricing power. Management guidance points to continued "
    "margin expansion into next fiscal year with Services now above thirty percent of revenue. "
    "iPhone unit growth remains stable and the Services attach rate is at a record. "
    "Capital allocation remains disciplined with buybacks accelerating. Free cash flow "
    "is at an all-time high and inventory is well-controlled. Management noted that "
    "the App Store and advertising businesses are structural tailwinds for margin. "
    "Financial performance is strong. Management statements confirm no inconsistencies."
) * 3

DOC2_TEXT = (
    "Apple Inc bearish teardown flags material risk factors and contradictions. "
    "Gross margins are compressing this quarter due to "
    "unfavorable component costs, foreign exchange headwinds, and increased promotional "
    "activity in China. Management guidance now points to margin compression through the next two "
    "quarters as Services growth decelerates and hardware ASPs come under pressure. "
    "Buybacks are being throttled to preserve cash for AI capex. iPhone shipments "
    "are trending below street expectations. Regulatory risk factors on App Store are rising. "
    "Contradictions between prior guidance and current financials are emerging. "
    "Management statements contradict prior guidance about margins."
) * 3


def _upload(base_url, token, filename, text, ticker="AAPL"):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    files = {"file": (filename, io.BytesIO(text.encode("utf-8")), "text/plain")}
    r = s.post(f"{base_url}/api/documents/upload?ticker={ticker}",
               files=files, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


def test_upload_chunks_with_ticker(base_url, test_user, auth_client):
    d = _upload(base_url, test_user["token"], "aapl_bullish_memo.txt", DOC1_TEXT, ticker="AAPL")
    assert d["filename"] == "aapl_bullish_memo.txt"
    assert d["chars"] > 200
    assert d["chunks"] > 0, f"expected chunks>0, got {d}"

    # list — should show ticker=AAPL + chunk_count>0
    r = auth_client.get(f"{base_url}/api/documents", timeout=30)
    assert r.status_code == 200
    docs = r.json()
    match = next((x for x in docs if x["doc_id"] == d["doc_id"]), None)
    assert match is not None, "uploaded doc not in list"
    assert match.get("ticker") == "AAPL"
    assert match.get("chunk_count", 0) > 0


def test_contradiction_across_docs(base_url, test_user, auth_client):
    # Upload two noise docs to enrich BM25 corpus (with small N, IDF collapses)
    _upload(base_url, test_user["token"], "noise_1.txt",
            "Miscellaneous unrelated filler content about weather sports and cooking recipes." * 8,
            ticker="AAPL")
    _upload(base_url, test_user["token"], "noise_2.txt",
            "Another filler document with random placeholder text and unrelated topics." * 8,
            ticker="AAPL")
    # Upload two contradictory docs about AAPL
    d1 = _upload(base_url, test_user["token"], "aapl_bullish_memo.txt", DOC1_TEXT, ticker="AAPL")
    d2 = _upload(base_url, test_user["token"], "aapl_bearish_memo.txt", DOC2_TEXT, ticker="AAPL")
    assert d1["chunks"] > 0 and d2["chunks"] > 0

    # Default query first \u2014 verifies contract even without explicit query
    r = auth_client.post(f"{base_url}/api/documents/contradiction",
                         json={"ticker": "AAPL"}, timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    # AI JSON contract
    for k in ["summary", "evidence", "sources", "confidence", "assumptions"]:
        assert k in d, f"missing '{k}' in {d.keys()}"
    # New fields per playbook
    assert "retrieved" in d and isinstance(d["retrieved"], int)
    assert d["retrieved"] > 0, f"expected retrieved>0, got {d['retrieved']}"
    assert "source_files" in d and isinstance(d["source_files"], list)
    assert len(d["source_files"]) >= 1
    assert d["summary"], "summary should be non-empty"
    assert "unavailable" not in d["summary"].lower(), f"AI unavailable: {d['summary']}"

    # Explicit query with terms unique to EACH doc \u2014 must surface BOTH files
    r2 = auth_client.post(f"{base_url}/api/documents/contradiction",
                          json={"ticker": "AAPL",
                                "query": "contradictions inconsistencies guidance financials risk management"},
                          timeout=180)
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["retrieved"] > 0
    sf = set(d2["source_files"])
    assert "aapl_bullish_memo.txt" in sf and "aapl_bearish_memo.txt" in sf, \
        f"expected both filenames in source_files with margin-targeted query, got {sf}"


def test_doc_scoped_ask(base_url, test_user, auth_client):
    d = _upload(base_url, test_user["token"], "aapl_ask_scope.txt", DOC1_TEXT, ticker="AAPL")
    r = auth_client.post(f"{base_url}/api/documents/{d['doc_id']}/ask",
                         json={"question": "Are gross margins expanding or compressing?"},
                         timeout=180)
    assert r.status_code == 200, r.text
    ai = r.json()
    for k in ["summary", "evidence", "sources", "confidence", "assumptions"]:
        assert k in ai
    assert ai["summary"], "summary empty"


def test_document_delete_removes_chunks(base_url, test_user, auth_client):
    # Upload a fresh throwaway doc
    d = _upload(base_url, test_user["token"], "tmp_delete_me.txt", DOC1_TEXT, ticker="ZZZZ")
    doc_id = d["doc_id"]

    # Delete
    r = auth_client.delete(f"{base_url}/api/documents/{doc_id}", timeout=30)
    assert r.status_code == 200

    # Verify doc gone from list
    r2 = auth_client.get(f"{base_url}/api/documents", timeout=30)
    assert r2.status_code == 200
    assert not any(x["doc_id"] == doc_id for x in r2.json()), "doc still in list after DELETE"

    # Contradiction for ZZZZ ticker should now return 0 retrieved (no chunks left)
    r3 = auth_client.post(f"{base_url}/api/documents/contradiction",
                          json={"ticker": "ZZZZ"}, timeout=30)
    assert r3.status_code == 200, r3.text
    d3 = r3.json()
    assert d3.get("retrieved", -1) == 0, f"expected 0 retrieved after delete, got {d3.get('retrieved')}"
