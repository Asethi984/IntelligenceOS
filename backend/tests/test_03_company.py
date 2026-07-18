"""Company profile/financials/news."""


def test_company_profile(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/company/AAPL/profile", timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ticker"] == "AAPL"
    # yfinance may throttle; tolerate but require ticker echo


def test_company_financials(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/company/AAPL/financials", timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "income_statement" in d and "balance_sheet" in d and "cash_flow" in d


def test_company_news(auth_client, base_url):
    r = auth_client.get(f"{base_url}/api/company/AAPL/news", timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d, list)
