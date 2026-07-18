"""IntelligenceOS Backend - FastAPI application."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Query, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import uuid
import logging
import asyncio
import hashlib
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import jwt as pyjwt
import bcrypt
import httpx
import yfinance as yf
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="IntelligenceOS API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("intelligence-os")

# ---------------- Utilities ----------------
def now_utc():
    return datetime.now(timezone.utc)

def now_iso():
    return now_utc().isoformat()

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": (now_utc() + timedelta(days=7)).timestamp()}
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(request: Request) -> Dict[str, Any]:
    # Try session_token from cookie or header (Emergent OAuth), then JWT
    session_token = request.cookies.get("session_token")
    auth_header = request.headers.get("Authorization", "")
    bearer = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None

    # Try session_token (Emergent OAuth)
    token = session_token or bearer
    if token:
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at and expires_at > now_utc():
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user

    # Try JWT
    if bearer:
        try:
            payload = pyjwt.decode(bearer, JWT_SECRET, algorithms=["HS256"])
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
            if user:
                return user
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Not authenticated")


# ---------------- Models ----------------
class SignupBody(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginBody(BaseModel):
    email: EmailStr
    password: str

class WatchlistAddBody(BaseModel):
    ticker: str

class ThesisBody(BaseModel):
    ticker: str
    stance: str  # bull/bear/neutral
    thesis: str
    evidence: Optional[List[str]] = []

class NoteBody(BaseModel):
    title: str
    content: str
    ticker: Optional[str] = None

class AlertRuleBody(BaseModel):
    ticker: str
    condition: str  # e.g., "price_below", "price_above", "news"
    value: Optional[float] = None
    note: Optional[str] = None

class PortfolioHoldingBody(BaseModel):
    ticker: str
    shares: float
    cost_basis: float

class AgentQueryBody(BaseModel):
    agent: str  # research | financial | news | competitor | risk | valuation | macro
    ticker: Optional[str] = None
    question: str

class ScreenerBody(BaseModel):
    query: Optional[str] = None
    min_market_cap: Optional[float] = None
    max_pe: Optional[float] = None
    sector: Optional[str] = None

class DCFBody(BaseModel):
    ticker: str
    revenue: float
    growth_rate: float  # e.g., 0.10
    margin: float  # e.g., 0.20
    wacc: float  # e.g., 0.09
    terminal_growth: float  # e.g., 0.025
    years: int = 5
    shares_outstanding: float


# ---------------- Auth ----------------
@api.post("/auth/signup")
async def signup(body: SignupBody, response: Response):
    existing = await db.users.find_one({"email": body.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "email": body.email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "Owner",
        "team_id": None,
        "created_at": now_iso(),
        "plan": "Free",
    }
    await db.users.insert_one(user)
    token = create_jwt(user_id)
    return {"token": token, "user": {"user_id": user_id, "email": body.email, "name": body.name, "role": "Owner", "plan": "Free"}}

@api.post("/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user["user_id"])
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}

@api.post("/auth/oauth/session")
async def oauth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    async with httpx.AsyncClient() as c:
        r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                        headers={"X-Session-ID": session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = r.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name"),
            "picture": data.get("picture"), "role": "Owner", "team_id": None,
            "plan": "Free", "created_at": now_iso(),
        })
    session_token = data["session_token"]
    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": expires_at.isoformat(), "created_at": now_iso()
    })
    response.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*3600)
    user_out = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"user": user_out, "session_token": session_token}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------- Market Data (yfinance) ----------------
_yf_cache: Dict[str, Dict[str, Any]] = {}
def _cache_get(key: str, ttl_sec: int = 300):
    v = _yf_cache.get(key)
    if v and (datetime.now().timestamp() - v["ts"]) < ttl_sec:
        return v["data"]
    return None

def _cache_set(key: str, data: Any):
    _yf_cache[key] = {"ts": datetime.now().timestamp(), "data": data}

def _fetch_quote(ticker: str) -> Dict[str, Any]:
    cached = _cache_get(f"quote:{ticker}", 60)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        info = t.fast_info if hasattr(t, 'fast_info') else {}
        hist = t.history(period="2d")
        price = float(hist["Close"].iloc[-1]) if len(hist) else None
        prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
        change = (price - prev) if (price and prev) else 0
        change_pct = (change / prev * 100) if prev else 0
        data = {
            "ticker": ticker.upper(),
            "price": price,
            "change": change,
            "change_pct": change_pct,
            "prev_close": prev,
            "volume": int(hist["Volume"].iloc[-1]) if len(hist) else 0,
            "market_cap": getattr(info, "market_cap", None) if info else None,
        }
    except Exception as e:
        logger.warning(f"yfinance quote failed for {ticker}: {e}")
        data = {"ticker": ticker.upper(), "price": None, "change": 0, "change_pct": 0, "error": str(e)}
    _cache_set(f"quote:{ticker}", data)
    return data

@api.get("/market/quote/{ticker}")
async def get_quote(ticker: str, user=Depends(get_current_user)):
    return _fetch_quote(ticker)

@api.get("/market/quotes")
async def get_quotes(tickers: str, user=Depends(get_current_user)):
    tks = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    return [_fetch_quote(t) for t in tks]

@api.get("/market/history/{ticker}")
async def get_history(ticker: str, period: str = "1mo", user=Depends(get_current_user)):
    cached = _cache_get(f"hist:{ticker}:{period}", 300)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period)
        data = [
            {"date": idx.strftime("%Y-%m-%d"), "close": float(row["Close"]), "volume": int(row["Volume"])}
            for idx, row in hist.iterrows()
        ]
    except Exception as e:
        data = []
    _cache_set(f"hist:{ticker}:{period}", data)
    return data

@api.get("/market/overview")
async def market_overview(user=Depends(get_current_user)):
    indices = ["^GSPC", "^IXIC", "^DJI", "^VIX", "^RUT"]
    labels = {"^GSPC": "S&P 500", "^IXIC": "NASDAQ", "^DJI": "Dow Jones", "^VIX": "VIX", "^RUT": "Russell 2000"}
    quotes = [{"label": labels[t], **_fetch_quote(t)} for t in indices]
    sectors = ["XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLU", "XLB", "XLRE", "XLC"]
    sector_labels = {"XLK":"Tech","XLF":"Financials","XLE":"Energy","XLV":"Health","XLY":"Cons. Disc.","XLP":"Cons. Staples","XLI":"Industrials","XLU":"Utilities","XLB":"Materials","XLRE":"Real Estate","XLC":"Comm."}
    sector_data = [{"label": sector_labels[t], **_fetch_quote(t)} for t in sectors]
    return {"indices": quotes, "sectors": sector_data, "as_of": now_iso()}

@api.get("/company/{ticker}/profile")
async def company_profile(ticker: str, user=Depends(get_current_user)):
    cached = _cache_get(f"profile:{ticker}", 3600)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        data = {
            "ticker": ticker.upper(),
            "name": info.get("longName") or info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "website": info.get("website"),
            "summary": info.get("longBusinessSummary"),
            "market_cap": info.get("marketCap"),
            "employees": info.get("fullTimeEmployees"),
            "pe": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "dividend_yield": info.get("dividendYield"),
            "beta": info.get("beta"),
            "52w_high": info.get("fiftyTwoWeekHigh"),
            "52w_low": info.get("fiftyTwoWeekLow"),
        }
    except Exception as e:
        data = {"ticker": ticker.upper(), "error": str(e)}
    _cache_set(f"profile:{ticker}", data)
    return data

@api.get("/company/{ticker}/financials")
async def company_financials(ticker: str, user=Depends(get_current_user)):
    cached = _cache_get(f"fin:{ticker}", 3600)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        income = t.financials.T if t.financials is not None else None
        balance = t.balance_sheet.T if t.balance_sheet is not None else None
        cashflow = t.cashflow.T if t.cashflow is not None else None
        def to_records(df):
            if df is None or df.empty:
                return []
            return [{"period": str(idx.date()) if hasattr(idx,'date') else str(idx), **{k: (float(v) if v==v else None) for k,v in row.items()}} for idx, row in df.iterrows()]
        data = {
            "income_statement": to_records(income)[:4],
            "balance_sheet": to_records(balance)[:4],
            "cash_flow": to_records(cashflow)[:4],
        }
    except Exception as e:
        data = {"income_statement": [], "balance_sheet": [], "cash_flow": [], "error": str(e)}
    _cache_set(f"fin:{ticker}", data)
    return data

@api.get("/company/{ticker}/news")
async def company_news(ticker: str, user=Depends(get_current_user)):
    cached = _cache_get(f"news:{ticker}", 300)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        news = t.news or []
        data = [{
            "title": n.get("title") or (n.get("content") or {}).get("title"),
            "publisher": n.get("publisher") or (n.get("content") or {}).get("provider", {}).get("displayName"),
            "link": n.get("link") or ((n.get("content") or {}).get("canonicalUrl") or {}).get("url"),
            "published": n.get("providerPublishTime") or (n.get("content") or {}).get("pubDate"),
        } for n in news[:10]]
    except Exception as e:
        data = []
    _cache_set(f"news:{ticker}", data)
    return data

@api.get("/search")
async def universal_search(q: str, user=Depends(get_current_user)):
    """Search tickers via yfinance."""
    q = q.strip().upper()
    if not q:
        return {"results": []}
    common = {
        "AAPL": "Apple Inc.", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
        "NVDA": "NVIDIA", "META": "Meta Platforms", "TSLA": "Tesla", "AMD": "AMD",
        "NFLX": "Netflix", "JPM": "JPMorgan", "V": "Visa", "MA": "Mastercard",
        "BRK-B": "Berkshire Hathaway", "UNH": "UnitedHealth", "XOM": "ExxonMobil",
        "JNJ": "Johnson & Johnson", "WMT": "Walmart", "PG": "Procter & Gamble",
    }
    results = [{"ticker": t, "name": n} for t, n in common.items() if q in t or q.lower() in n.lower()][:8]
    if not results and len(q) <= 5:
        # fallback: try direct lookup
        try:
            p = _fetch_quote(q)
            if p.get("price"):
                results = [{"ticker": q, "name": q}]
        except Exception:
            pass
    return {"results": results}


# ---------------- Watchlist ----------------
@api.get("/watchlist")
async def get_watchlist(user=Depends(get_current_user)):
    doc = await db.watchlists.find_one({"user_id": user["user_id"]}, {"_id": 0})
    tickers = (doc or {}).get("tickers", [])
    if not tickers:
        # seed default watchlist
        tickers = ["AAPL", "MSFT", "NVDA", "GOOGL", "TSLA"]
        await db.watchlists.update_one({"user_id": user["user_id"]},
                                       {"$set": {"tickers": tickers, "updated_at": now_iso()}}, upsert=True)
    quotes = [_fetch_quote(t) for t in tickers]
    return {"tickers": tickers, "quotes": quotes}

@api.post("/watchlist/add")
async def add_to_watchlist(body: WatchlistAddBody, user=Depends(get_current_user)):
    await db.watchlists.update_one({"user_id": user["user_id"]},
                                   {"$addToSet": {"tickers": body.ticker.upper()}, "$set": {"updated_at": now_iso()}}, upsert=True)
    return {"ok": True}

@api.post("/watchlist/remove")
async def remove_from_watchlist(body: WatchlistAddBody, user=Depends(get_current_user)):
    await db.watchlists.update_one({"user_id": user["user_id"]},
                                   {"$pull": {"tickers": body.ticker.upper()}})
    return {"ok": True}


# ---------------- Portfolio ----------------
@api.get("/portfolio")
async def get_portfolio(user=Depends(get_current_user)):
    holdings = await db.holdings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    total_value = 0
    total_cost = 0
    enriched = []
    for h in holdings:
        q = _fetch_quote(h["ticker"])
        price = q.get("price") or 0
        value = price * h["shares"]
        cost = h["cost_basis"] * h["shares"]
        total_value += value
        total_cost += cost
        enriched.append({**h, "price": price, "value": value, "gain": value - cost,
                        "gain_pct": ((value - cost) / cost * 100) if cost else 0,
                        "change_pct": q.get("change_pct", 0)})
    # allocation
    for e in enriched:
        e["allocation"] = (e["value"] / total_value * 100) if total_value else 0
    return {
        "holdings": enriched,
        "total_value": total_value,
        "total_cost": total_cost,
        "total_gain": total_value - total_cost,
        "total_gain_pct": ((total_value - total_cost) / total_cost * 100) if total_cost else 0,
        "health_score": min(100, max(0, 70 + (10 if len(enriched) >= 5 else -10) + (20 if total_value > total_cost else -20))),
    }

@api.post("/portfolio/add")
async def add_holding(body: PortfolioHoldingBody, user=Depends(get_current_user)):
    h = {"holding_id": str(uuid.uuid4()), "user_id": user["user_id"],
         "ticker": body.ticker.upper(), "shares": body.shares,
         "cost_basis": body.cost_basis, "created_at": now_iso()}
    await db.holdings.insert_one(h)
    return {"ok": True, "holding_id": h["holding_id"]}

@api.delete("/portfolio/{holding_id}")
async def remove_holding(holding_id: str, user=Depends(get_current_user)):
    await db.holdings.delete_one({"holding_id": holding_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------- Notes / Research ----------------
@api.get("/notes")
async def list_notes(user=Depends(get_current_user)):
    notes = await db.notes.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return notes

@api.post("/notes")
async def create_note(body: NoteBody, user=Depends(get_current_user)):
    note = {"note_id": str(uuid.uuid4()), "user_id": user["user_id"],
            "title": body.title, "content": body.content, "ticker": body.ticker,
            "created_at": now_iso(), "updated_at": now_iso()}
    await db.notes.insert_one(note)
    return note

@api.put("/notes/{note_id}")
async def update_note(note_id: str, body: NoteBody, user=Depends(get_current_user)):
    await db.notes.update_one({"note_id": note_id, "user_id": user["user_id"]},
                              {"$set": {"title": body.title, "content": body.content, "ticker": body.ticker, "updated_at": now_iso()}})
    return {"ok": True}

@api.delete("/notes/{note_id}")
async def delete_note(note_id: str, user=Depends(get_current_user)):
    await db.notes.delete_one({"note_id": note_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------- Thesis ----------------
@api.get("/thesis/{ticker}")
async def get_thesis(ticker: str, user=Depends(get_current_user)):
    theses = await db.theses.find({"user_id": user["user_id"], "ticker": ticker.upper()}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return theses

@api.post("/thesis")
async def create_thesis(body: ThesisBody, user=Depends(get_current_user)):
    doc = {"thesis_id": str(uuid.uuid4()), "user_id": user["user_id"],
           "ticker": body.ticker.upper(), "stance": body.stance,
           "thesis": body.thesis, "evidence": body.evidence,
           "created_at": now_iso()}
    await db.theses.insert_one(doc)
    return doc


# ---------------- Alerts ----------------
@api.get("/alerts")
async def list_alerts(user=Depends(get_current_user)):
    rules = await db.alert_rules.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    fires = await db.alerts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"rules": rules, "fires": fires}

@api.post("/alerts")
async def create_alert(body: AlertRuleBody, user=Depends(get_current_user)):
    r = {"rule_id": str(uuid.uuid4()), "user_id": user["user_id"],
         "ticker": body.ticker.upper(), "condition": body.condition,
         "value": body.value, "note": body.note, "created_at": now_iso(), "active": True}
    await db.alert_rules.insert_one(r)
    return r

@api.delete("/alerts/{rule_id}")
async def delete_alert(rule_id: str, user=Depends(get_current_user)):
    await db.alert_rules.delete_one({"rule_id": rule_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------- AI Agents ----------------
AGENT_SYSTEM = {
    "research": "You are a senior equity research analyst. Provide a concise, structured analysis with clear reasoning.",
    "financial": "You are a CFA financial analyst. Focus on financials, ratios, and quality of earnings.",
    "news": "You are a news impact analyst. Focus on materiality, sentiment, and affected entities.",
    "competitor": "You are a competitive strategy analyst (Porter's Five Forces, moat analysis).",
    "risk": "You are a risk analyst. Identify key risks, tail risks, and mitigations.",
    "valuation": "You are a valuation expert. Explain DCF, comps, and scenario logic.",
    "macro": "You are a macro strategist. Explain macro impacts on the given asset.",
    "market_brief": "You are a market strategist writing the AI Market Brief.",
    "portfolio_brief": "You are a portfolio strategist writing a daily portfolio brief.",
    "contradiction": "You are a contradiction detector. Compare claims across 10-K, earnings calls, guidance, and news. Surface conflicts and inconsistencies with citations.",
    "management": "You are a management-quality analyst. Score capital allocation, execution vs promises, dilution, and acquisitions history. Rate 0-100 on execution and integrity.",
    "materiality": "You are a news materiality scorer. Rate 0-100 on how much a news item should move an investor's thesis, filtering noise from signal.",
    "earnings_diff": "You are an earnings analyst. Compare current quarter vs previous quarter and guidance vs actual. Show what changed line-by-line, not just beat/miss.",
    "bias": "You are a behavioral finance coach. Given a user's decision journal, identify recurring biases (confirmation, recency, loss aversion, anchoring, overconfidence, FOMO).",
    "assumption_check": "You are an assumption auditor. Given a thesis assumption and current data, determine if it is INTACT, AT_RISK, or BROKEN with reasoning.",
    "hidden_connections": "You are a portfolio pattern analyst. Given holdings, identify hidden thesis clusters (e.g., AI-infrastructure, rate-sensitive, China-exposed) that go beyond sector labels.",
    "macro_exposure": "You are a macro exposure analyst. For a given portfolio, quantify exposure (0-100) to: interest rates, oil, China, AI, semiconductors, inflation, housing, defense, consumer.",
}

async def run_agent(agent_key: str, prompt: str, context: str = "") -> Dict[str, Any]:
    system = AGENT_SYSTEM.get(agent_key, AGENT_SYSTEM["research"])
    system += (
        "\n\nYou MUST respond in strict JSON with these keys: "
        "summary (string, 2-4 sentences), "
        "evidence (array of strings), "
        "sources (array of strings), "
        "confidence (number 0-100), "
        "assumptions (array of strings). "
        "No markdown. Only JSON."
    )
    if not EMERGENT_LLM_KEY:
        return {
            "summary": "AI key missing. Configure EMERGENT_LLM_KEY.",
            "evidence": [], "sources": [], "confidence": 0, "assumptions": []
        }
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{agent_key}-{uuid.uuid4().hex[:8]}",
            system_message=system,
        ).with_model("openai", "gpt-5.2")
        full_prompt = f"{context}\n\nQuestion: {prompt}" if context else prompt
        reply = await chat.send_message(UserMessage(text=full_prompt))
        text = reply.strip() if isinstance(reply, str) else str(reply)
        # extract JSON
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start:end+1]
        parsed = json.loads(text)
        parsed.setdefault("summary", "")
        parsed.setdefault("evidence", [])
        parsed.setdefault("sources", [])
        parsed.setdefault("confidence", 60)
        parsed.setdefault("assumptions", [])
        return parsed
    except Exception as e:
        logger.error(f"agent {agent_key} failed: {e}")
        return {
            "summary": f"Analysis unavailable: {str(e)[:100]}",
            "evidence": [], "sources": [], "confidence": 0, "assumptions": []
        }

@api.post("/agents/query")
async def agents_query(body: AgentQueryBody, user=Depends(get_current_user)):
    context = ""
    if body.ticker:
        profile = await company_profile(body.ticker, user)
        quote = _fetch_quote(body.ticker)
        context = f"Ticker: {body.ticker.upper()}. Company: {profile.get('name')}. Sector: {profile.get('sector')}. Price: {quote.get('price')}. Summary: {(profile.get('summary') or '')[:800]}"
    result = await run_agent(body.agent, body.question, context)
    # store
    await db.agent_runs.insert_one({
        "run_id": str(uuid.uuid4()), "user_id": user["user_id"],
        "agent": body.agent, "ticker": body.ticker, "question": body.question,
        "result": result, "created_at": now_iso()
    })
    return result

@api.get("/market/brief")
async def market_brief(user=Depends(get_current_user)):
    overview = await market_overview(user)
    ctx = "Market Indices: " + ", ".join([f"{i['label']} {i.get('change_pct',0):.2f}%" for i in overview["indices"] if i.get("change_pct") is not None])
    result = await run_agent("market_brief",
                             "Write today's AI Market Brief: What happened / Why it matters / Affected sectors / Risks / Opportunities.",
                             ctx)
    return {"brief": result, "as_of": now_iso()}

@api.get("/portfolio/brief")
async def portfolio_brief(user=Depends(get_current_user)):
    port = await get_portfolio(user)
    ctx = f"Portfolio value: ${port['total_value']:.0f}, gain: {port['total_gain_pct']:.2f}%. Holdings: " + ", ".join([f"{h['ticker']}({h['allocation']:.1f}%)" for h in port["holdings"][:10]])
    result = await run_agent("portfolio_brief",
                             "Write the daily portfolio brief: performance, key movers, risks, and one actionable insight.",
                             ctx)
    return {"brief": result, "as_of": now_iso()}


# ---------------- Screener ----------------
UNIVERSE = ["AAPL","MSFT","GOOGL","AMZN","NVDA","META","TSLA","AMD","NFLX","JPM","V","MA","UNH","XOM","JNJ","WMT","PG","BRK-B","HD","BAC","AVGO","COST","PEP","KO","CVX"]

@api.post("/screener/run")
async def screener_run(body: ScreenerBody, user=Depends(get_current_user)):
    results = []
    for t in UNIVERSE:
        try:
            p = _cache_get(f"profile:{t}", 3600)
            if not p:
                tk = yf.Ticker(t)
                info = tk.info or {}
                p = {"ticker": t, "name": info.get("shortName"), "sector": info.get("sector"),
                     "market_cap": info.get("marketCap"), "pe": info.get("trailingPE"),
                     "dividend_yield": info.get("dividendYield")}
                _cache_set(f"profile:{t}", p)
            q = _fetch_quote(t)
            row = {**p, "price": q.get("price"), "change_pct": q.get("change_pct")}
            if body.sector and (row.get("sector") or "").lower() != body.sector.lower():
                continue
            if body.min_market_cap and (row.get("market_cap") or 0) < body.min_market_cap:
                continue
            if body.max_pe and (row.get("pe") or 999) > body.max_pe:
                continue
            results.append(row)
        except Exception:
            continue

    ai_summary = None
    if body.query:
        ai_summary = await run_agent("research",
                                     f"User's natural-language screen: '{body.query}'. From the universe of tickers, which look most promising and why?",
                                     "Universe: " + ",".join(UNIVERSE))
    return {"results": results, "ai_summary": ai_summary}


# ---------------- Valuation Lab ----------------
@api.post("/valuation/dcf")
async def dcf(body: DCFBody, user=Depends(get_current_user)):
    fcf = body.revenue * body.margin
    projections = []
    total_pv = 0
    for y in range(1, body.years + 1):
        fcf_y = fcf * ((1 + body.growth_rate) ** y)
        pv = fcf_y / ((1 + body.wacc) ** y)
        projections.append({"year": y, "fcf": fcf_y, "pv": pv})
        total_pv += pv
    terminal_fcf = fcf * ((1 + body.growth_rate) ** body.years) * (1 + body.terminal_growth)
    terminal_value = terminal_fcf / (body.wacc - body.terminal_growth) if body.wacc > body.terminal_growth else 0
    pv_terminal = terminal_value / ((1 + body.wacc) ** body.years)
    enterprise_value = total_pv + pv_terminal
    fair_value_per_share = enterprise_value / body.shares_outstanding if body.shares_outstanding else 0

    q = _fetch_quote(body.ticker)
    current = q.get("price") or 0
    upside = ((fair_value_per_share - current) / current * 100) if current else 0

    return {
        "ticker": body.ticker.upper(),
        "projections": projections,
        "terminal_value": terminal_value,
        "pv_terminal": pv_terminal,
        "enterprise_value": enterprise_value,
        "fair_value_per_share": fair_value_per_share,
        "current_price": current,
        "upside_pct": upside,
        "scenarios": {
            "bull": {"fair_value": fair_value_per_share * 1.25, "upside_pct": upside + 25},
            "base": {"fair_value": fair_value_per_share, "upside_pct": upside},
            "bear": {"fair_value": fair_value_per_share * 0.75, "upside_pct": upside - 25},
        }
    }


# ---------------- Documents (RAG light) ----------------
@api.post("/documents/upload")
async def upload_doc(file: UploadFile = File(...), user=Depends(get_current_user)):
    content = await file.read()
    text = ""
    if file.filename.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join([p.extract_text() or "" for p in reader.pages])
        except Exception as e:
            text = f"[PDF parse error: {e}]"
    else:
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            text = ""
    doc = {"doc_id": str(uuid.uuid4()), "user_id": user["user_id"],
           "filename": file.filename, "text": text[:200000],
           "size": len(content), "created_at": now_iso()}
    await db.documents.insert_one(doc)
    return {"doc_id": doc["doc_id"], "filename": file.filename, "chars": len(text)}

@api.get("/documents")
async def list_documents(user=Depends(get_current_user)):
    docs = await db.documents.find({"user_id": user["user_id"]}, {"_id": 0, "text": 0}).sort("created_at", -1).to_list(100)
    return docs

@api.post("/documents/{doc_id}/ask")
async def ask_doc(doc_id: str, body: Dict[str, Any], user=Depends(get_current_user)):
    doc = await db.documents.find_one({"doc_id": doc_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    question = body.get("question", "")
    ctx = f"Document '{doc['filename']}':\n{doc['text'][:8000]}"
    result = await run_agent("research", question, ctx)
    return result


# ---------------- Team ----------------
@api.get("/team/members")
async def list_team(user=Depends(get_current_user)):
    members = await db.users.find({}, {"_id": 0, "password_hash": 0}).limit(20).to_list(20)
    return members


# ---------------- Knowledge Graph ----------------
@api.get("/graph/{ticker}")
async def get_graph(ticker: str, user=Depends(get_current_user)):
    """Returns nodes/edges for React Flow."""
    ticker = ticker.upper()
    profile = await company_profile(ticker, user)
    peers_map = {
        "AAPL": ["MSFT","GOOGL","AMZN","META","NVDA"],
        "MSFT": ["AAPL","GOOGL","AMZN","ORCL","CRM"],
        "NVDA": ["AMD","INTC","TSM","QCOM","AVGO"],
        "TSLA": ["F","GM","RIVN","NIO","LCID"],
    }
    peers = peers_map.get(ticker, ["MSFT","AAPL","GOOGL"])
    nodes = [{"id": ticker, "type": "default", "position": {"x": 300, "y": 200}, "data": {"label": ticker}}]
    edges = []
    for i, p in enumerate(peers[:6]):
        angle = (i / max(1, len(peers[:6]))) * 6.28
        import math
        nodes.append({"id": p, "type": "default",
                      "position": {"x": 300 + 250 * math.cos(angle), "y": 200 + 250 * math.sin(angle)},
                      "data": {"label": p}})
        edges.append({"id": f"{ticker}-{p}", "source": ticker, "target": p, "label": "peer"})
    sector = profile.get("sector") or "Sector"
    nodes.append({"id": sector, "type": "default", "position": {"x": 300, "y": -20}, "data": {"label": sector}})
    edges.append({"id": f"{ticker}-{sector}", "source": ticker, "target": sector, "label": "sector"})
    return {"nodes": nodes, "edges": edges}


# ---------------- Living Thesis (assumptions, catalysts, risks) ----------------
class AssumptionBody(BaseModel):
    text: str
    kind: str = "business"  # business|competitive|financial|valuation|macro

class LivingThesisBody(BaseModel):
    ticker: str
    stance: str  # bull|base|bear
    headline: str
    narrative: str
    assumptions: List[AssumptionBody] = []
    catalysts: List[str] = []
    risks: List[str] = []
    confidence: int = 60
    price_target: Optional[float] = None
    time_horizon_months: int = 12
    parent_id: Optional[str] = None  # for versions

@api.post("/thesis/living")
async def create_living_thesis(body: LivingThesisBody, user=Depends(get_current_user)):
    chain_id = None
    version = 1
    if body.parent_id:
        parent = await db.living_theses.find_one({"thesis_id": body.parent_id, "user_id": user["user_id"]}, {"_id": 0})
        if parent:
            chain_id = parent.get("chain_id") or parent["thesis_id"]
            latest = await db.living_theses.find({"chain_id": chain_id}).sort("version", -1).to_list(1)
            version = (latest[0]["version"] + 1) if latest else 2
    thesis_id = str(uuid.uuid4())
    if not chain_id:
        chain_id = thesis_id
    doc = {
        "thesis_id": thesis_id, "chain_id": chain_id, "version": version,
        "user_id": user["user_id"], "ticker": body.ticker.upper(),
        "stance": body.stance, "headline": body.headline, "narrative": body.narrative,
        "assumptions": [{"assumption_id": str(uuid.uuid4()), "text": a.text, "kind": a.kind,
                        "status": "intact", "last_checked": None, "reasoning": None} for a in body.assumptions],
        "catalysts": body.catalysts, "risks": body.risks,
        "confidence": body.confidence, "price_target": body.price_target,
        "time_horizon_months": body.time_horizon_months,
        "created_at": now_iso(),
    }
    await db.living_theses.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/thesis/living")
async def list_living_theses(ticker: Optional[str] = None, user=Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if ticker:
        q["ticker"] = ticker.upper()
    # latest per chain
    all_docs = await db.living_theses.find(q, {"_id": 0}).sort("version", -1).to_list(500)
    seen = set()
    latest = []
    for d in all_docs:
        if d["chain_id"] not in seen:
            seen.add(d["chain_id"])
            latest.append(d)
    return latest

@api.get("/thesis/living/{thesis_id}")
async def get_living_thesis(thesis_id: str, user=Depends(get_current_user)):
    doc = await db.living_theses.find_one({"thesis_id": thesis_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc

@api.get("/thesis/living/{thesis_id}/history")
async def thesis_history(thesis_id: str, user=Depends(get_current_user)):
    doc = await db.living_theses.find_one({"thesis_id": thesis_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc: return []
    chain_id = doc.get("chain_id") or thesis_id
    return await db.living_theses.find({"chain_id": chain_id, "user_id": user["user_id"]}, {"_id": 0}).sort("version", 1).to_list(50)

@api.post("/thesis/living/{thesis_id}/check")
async def check_thesis(thesis_id: str, user=Depends(get_current_user)):
    doc = await db.living_theses.find_one({"thesis_id": thesis_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc: raise HTTPException(status_code=404, detail="Not found")
    profile = await company_profile(doc["ticker"], user)
    quote = _fetch_quote(doc["ticker"])
    ctx = f"Ticker {doc['ticker']} · {profile.get('name')} · Sector {profile.get('sector')} · Price ${quote.get('price')} · P/E {profile.get('pe')} · 52w range {profile.get('52w_low')}-{profile.get('52w_high')}. Business: {(profile.get('summary') or '')[:400]}."
    updated_assumptions = []
    for a in doc.get("assumptions", []):
        prompt = f"Assumption ({a['kind']}): '{a['text']}'. Determine current status. Return summary explaining status. In evidence array, list 2-3 concrete data points. In assumptions field, put your final verdict: exactly one of 'INTACT', 'AT_RISK', or 'BROKEN'."
        res = await run_agent("assumption_check", prompt, ctx)
        # heuristics: parse status from assumptions[0] or from summary
        verdict = "intact"
        blob = " ".join(res.get("assumptions", []) + [res.get("summary", "")]).upper()
        if "BROKEN" in blob:
            verdict = "broken"
        elif "AT_RISK" in blob or "AT RISK" in blob:
            verdict = "at_risk"
        updated_assumptions.append({**a, "status": verdict, "last_checked": now_iso(), "reasoning": res.get("summary", "")})
    await db.living_theses.update_one({"thesis_id": thesis_id}, {"$set": {"assumptions": updated_assumptions, "last_checked": now_iso()}})
    return {"assumptions": updated_assumptions, "checked_at": now_iso()}

@api.get("/thesis/living/{thesis_id}/diff")
async def thesis_diff(thesis_id: str, user=Depends(get_current_user)):
    doc = await db.living_theses.find_one({"thesis_id": thesis_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc: raise HTTPException(status_code=404, detail="Not found")
    chain = await db.living_theses.find({"chain_id": doc.get("chain_id", thesis_id)}, {"_id": 0}).sort("version", 1).to_list(50)
    if len(chain) < 2:
        return {"changes": [], "message": "No prior version"}
    prev, curr = chain[-2], chain[-1]
    changes = []
    def compare_list(field):
        p_items = [x["text"] if isinstance(x, dict) else x for x in prev.get(field, [])]
        c_items = [x["text"] if isinstance(x, dict) else x for x in curr.get(field, [])]
        added = [x for x in c_items if x not in p_items]
        removed = [x for x in p_items if x not in c_items]
        for x in added: changes.append({"field": field, "type": "added", "value": x})
        for x in removed: changes.append({"field": field, "type": "removed", "value": x})
    compare_list("assumptions")
    compare_list("catalysts")
    compare_list("risks")
    for f in ["headline","narrative","stance","confidence","price_target"]:
        if prev.get(f) != curr.get(f):
            changes.append({"field": f, "type": "changed", "from": prev.get(f), "to": curr.get(f)})
    return {"changes": changes, "prev_version": prev["version"], "curr_version": curr["version"]}


# ---------------- Decision Journal ----------------
class JournalEntryBody(BaseModel):
    ticker: str
    action: str  # buy|sell|hold|watch
    decision_reason: str
    expected_outcome: str
    expected_timeframe_months: int = 12
    confidence: int = 60
    price_at_decision: Optional[float] = None

class PostMortemBody(BaseModel):
    result_outcome: str  # right|wrong|partial
    result_summary: str
    lessons: List[str] = []

@api.get("/journal")
async def list_journal(user=Depends(get_current_user)):
    entries = await db.journal_entries.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return entries

@api.post("/journal")
async def create_journal(body: JournalEntryBody, user=Depends(get_current_user)):
    price = body.price_at_decision
    if price is None:
        q = _fetch_quote(body.ticker)
        price = q.get("price")
    entry = {
        "entry_id": str(uuid.uuid4()), "user_id": user["user_id"],
        "ticker": body.ticker.upper(), "action": body.action,
        "decision_reason": body.decision_reason, "expected_outcome": body.expected_outcome,
        "expected_timeframe_months": body.expected_timeframe_months,
        "confidence": body.confidence, "price_at_decision": price,
        "result_outcome": None, "result_summary": None, "lessons": [],
        "created_at": now_iso(), "resolved_at": None,
    }
    await db.journal_entries.insert_one(entry)
    return entry

@api.post("/journal/{entry_id}/postmortem")
async def add_postmortem(entry_id: str, body: PostMortemBody, user=Depends(get_current_user)):
    await db.journal_entries.update_one(
        {"entry_id": entry_id, "user_id": user["user_id"]},
        {"$set": {"result_outcome": body.result_outcome, "result_summary": body.result_summary,
                  "lessons": body.lessons, "resolved_at": now_iso()}}
    )
    return {"ok": True}

@api.delete("/journal/{entry_id}")
async def delete_journal(entry_id: str, user=Depends(get_current_user)):
    await db.journal_entries.delete_one({"entry_id": entry_id, "user_id": user["user_id"]})
    return {"ok": True}

@api.get("/journal/analyze")
async def analyze_journal(user=Depends(get_current_user)):
    entries = await db.journal_entries.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    if not entries:
        return {"summary": "No journal entries yet.", "evidence": [], "sources": [], "confidence": 0, "assumptions": []}
    summary = []
    for e in entries[:50]:
        line = f"{e['action'].upper()} {e['ticker']} @ ${e.get('price_at_decision','?')} · conf {e['confidence']}% · reason: {e['decision_reason'][:120]}"
        if e.get("result_outcome"):
            line += f" · OUTCOME: {e['result_outcome']}"
        summary.append(line)
    ctx = "Journal entries:\n" + "\n".join(summary)
    return await run_agent("bias", "Identify recurring biases and blind spots in these investment decisions. Concrete, specific, actionable.", ctx)


# ---------------- Investment CRM Pipeline ----------------
STAGES = ["idea","research","validation","buy","monitor","review","archive"]

class PipelineAddBody(BaseModel):
    ticker: str
    stage: str = "idea"
    note: Optional[str] = ""
    thesis_headline: Optional[str] = None

class PipelineMoveBody(BaseModel):
    item_id: str
    new_stage: str
    note: Optional[str] = None

@api.get("/pipeline")
async def get_pipeline(user=Depends(get_current_user)):
    items = await db.pipeline_items.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    grouped = {s: [] for s in STAGES}
    for it in items:
        s = it.get("stage") if it.get("stage") in STAGES else "idea"
        # attach current price
        q = _fetch_quote(it["ticker"])
        it["price"] = q.get("price")
        it["change_pct"] = q.get("change_pct")
        grouped[s].append(it)
    return {"stages": STAGES, "items": grouped}

@api.post("/pipeline")
async def add_pipeline(body: PipelineAddBody, user=Depends(get_current_user)):
    if body.stage not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")
    item = {
        "item_id": str(uuid.uuid4()), "user_id": user["user_id"],
        "ticker": body.ticker.upper(), "stage": body.stage,
        "note": body.note or "", "thesis_headline": body.thesis_headline,
        "history": [{"stage": body.stage, "at": now_iso(), "note": body.note or ""}],
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.pipeline_items.insert_one(item)
    return {k: v for k, v in item.items() if k != "_id"}

@api.post("/pipeline/move")
async def move_pipeline(body: PipelineMoveBody, user=Depends(get_current_user)):
    if body.new_stage not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")
    await db.pipeline_items.update_one(
        {"item_id": body.item_id, "user_id": user["user_id"]},
        {"$set": {"stage": body.new_stage, "updated_at": now_iso()},
         "$push": {"history": {"stage": body.new_stage, "at": now_iso(), "note": body.note or ""}}}
    )
    return {"ok": True}

@api.delete("/pipeline/{item_id}")
async def delete_pipeline(item_id: str, user=Depends(get_current_user)):
    await db.pipeline_items.delete_one({"item_id": item_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------- Portfolio Intelligence (hidden connections + macro) ----------------
@api.get("/portfolio/connections")
async def portfolio_connections(user=Depends(get_current_user)):
    holdings = await db.holdings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    if not holdings:
        return {"summary": "No holdings.", "evidence": [], "sources": [], "confidence": 0, "assumptions": []}
    ctx_lines = []
    for h in holdings:
        p = _cache_get(f"profile:{h['ticker']}", 3600)
        if not p:
            try:
                tk = yf.Ticker(h["ticker"])
                info = tk.info or {}
                p = {"sector": info.get("sector"), "industry": info.get("industry")}
                _cache_set(f"profile:{h['ticker']}", p)
            except Exception:
                p = {}
        ctx_lines.append(f"{h['ticker']} · {p.get('sector','?')} · {p.get('industry','?')}")
    ctx = "Holdings:\n" + "\n".join(ctx_lines)
    return await run_agent("hidden_connections",
                           "Identify 3-6 hidden thesis clusters that group these holdings by underlying business drivers, not sectors. In evidence, list each cluster as 'ClusterName: TICKER1, TICKER2, ...'. In assumptions, list the shared driver for each cluster.",
                           ctx)

@api.get("/portfolio/macro")
async def portfolio_macro(user=Depends(get_current_user)):
    holdings = await db.holdings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    if not holdings:
        return {"exposures": [], "summary": "No holdings."}
    tickers = ", ".join(sorted({h["ticker"] for h in holdings}))
    ctx = f"Portfolio tickers: {tickers}. Total holdings: {len(holdings)}."
    result = await run_agent("macro_exposure",
                             "Score portfolio's exposure (0-100) to each of: interest_rates, oil, china, ai, semiconductors, inflation, housing, defense, consumer. Return the scores in the assumptions field as 'factor:score' one per line.",
                             ctx)
    # parse
    exposures = []
    for line in result.get("assumptions", []):
        if ":" in line:
            k, v = line.split(":", 1)
            try:
                exposures.append({"factor": k.strip().lower().replace(" ", "_"), "score": int(''.join([c for c in v if c.isdigit()]) or 0)})
            except Exception:
                continue
    return {"exposures": exposures, "summary": result.get("summary"), "confidence": result.get("confidence", 60), "raw": result}


# ---------------- Investment Timeline ----------------
@api.get("/timeline/{ticker}")
async def timeline(ticker: str, user=Depends(get_current_user)):
    T = ticker.upper()
    events = []
    # news
    news = await company_news(ticker, user)
    for n in news:
        events.append({"type": "news", "title": n.get("title"), "meta": n.get("publisher"),
                       "link": n.get("link"), "at": now_iso()})
    # journal
    journal = await db.journal_entries.find({"user_id": user["user_id"], "ticker": T}, {"_id": 0}).to_list(100)
    for j in journal:
        events.append({"type": f"journal_{j['action']}", "title": j["decision_reason"][:140],
                       "meta": f"conf {j['confidence']}%", "at": j["created_at"]})
    # thesis versions
    theses = await db.living_theses.find({"user_id": user["user_id"], "ticker": T}, {"_id": 0}).to_list(100)
    for t in theses:
        events.append({"type": "thesis", "title": f"v{t['version']} · {t['headline']}",
                       "meta": t["stance"].upper(), "at": t["created_at"]})
    events.sort(key=lambda e: e.get("at") or "", reverse=True)
    return {"ticker": T, "events": events[:80]}



@api.get("/")
async def root():
    return {"service": "IntelligenceOS", "status": "ok", "time": now_iso()}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
