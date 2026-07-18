# IntelligenceOS · PRD

## Original Problem Statement
Production-grade AI investment intelligence platform — Bloomberg-terminal-inspired dark UI, 7+ specialized AI agents, real financial data (yfinance), portfolio + valuation + screeners + RAG documents + knowledge graph. JWT + Emergent Google Auth. Emergent LLM Key (GPT-5.2). Stripe stubs.

## User Choices
- Scope: end-to-end MVP, deep on Phases 1–4
- LLM: GPT-5.2 via Emergent LLM Key
- Data: yfinance only
- Auth: JWT + Emergent Google Auth
- Billing: UI stubs only

## Architecture Complete
- FastAPI single-file backend (`server.py`, ~1200 lines, 60+ endpoints, 17 agent prompts)
- React SPA (CRA + Tailwind + shadcn/ui + Recharts + React Flow)
- MongoDB (10 collections: users, sessions, watchlists, holdings, notes, theses, living_theses, journal_entries, pipeline_items, alert_rules, documents, agent_runs)
- Auth: JWT bearer + Emergent OAuth cookie (dual path in `get_current_user`)
- In-memory TTL cache for yfinance (Redis in Phase 6)

## Implemented (v1.0 · Feb 2026)

### Phase 1–2 — Foundation & Command Center
- JWT signup/login + Emergent Google OAuth (session cookie)
- Persistent sidebar (15 routes) + ⌘K palette + top bar
- Command Center: indices strip, sector heatmap, SPY chart, watchlist, AI Market Brief
- Markets page with search
- Universal ticker search

### Phase 3 — Company Intelligence
- Company workspace: profile, financials (income/balance/cashflow), 6M chart, news, thesis, agents
- Investment Thesis: **Living Thesis** (assumptions/catalysts/risks/confidence/versions) + Assumption Monitor with AI check
- "What Changed?" thesis diff engine + version history
- Research Notebook (CRUD)
- Documents (upload PDF, ask questions via RAG-lite)

### Phase 4 — AI Agents (12 specialized agents)
- Research, Financial, News, Competitor, Risk, Valuation, Macro
- **NEW gap-closers:** Contradiction Detector, Management Quality, Materiality, Earnings Diff, Bias Detector, Assumption Check, Hidden Connections, Macro Exposure
- Every agent returns strict JSON: `summary / evidence / sources / confidence / assumptions`
- Reusable `<AIPanel/>` renders all agent output with 5 tabs
- Knowledge Graph (React Flow, peer + sector edges)

### Phase 5 — Portfolio, Screener, Valuation, Alerts
- Portfolio: holdings, KPIs, health score, allocation donut, daily AI brief
- **Portfolio Intelligence:** AI Hidden Connections (thesis clusters), Macro Exposure Map (rates/oil/AI/semis/etc.)
- AI Screener (NL + filters over universe of 25 tickers)
- Valuation Lab: full DCF + Bull/Base/Bear scenarios
- Alerts (rules stored; background evaluator deferred)

### Phase 6 — Workflow (gap-closer)
- **Investment CRM Pipeline (Kanban):** Idea → Research → Validation → Buy → Monitor → Review → Archive
- **Decision Journal** with post-mortem + AI Bias Detection
- **Investment Timeline** (unified event stream: news + theses + journal per ticker)
- Team page (roster; RBAC hooks present)
- Settings with 4-tier subscription UI (Stripe stubbed)

### Testing
- 39/39 backend pytest passing (iteration_2). All AI agents verified with real GPT-5.2 JSON output. All yfinance flows healthy.

## Deferred (Post-v1 Backlog)

### P0
- Rate-limit LLM per user
- Migrate `_yf_cache` → Redis
- Background alert evaluator (Celery beat)
- React error boundaries
- Structured logging → Grafana

### P1
- Real earnings transcripts (Finnhub free tier) + Earnings Diff Engine hooked to live transcripts
- SEC EDGAR full-text search + Filing Diff engine
- PDF/DOCX report export (WeasyPrint / python-docx)
- Approval workflow (Draft → Review → Approved → Published)
- Team invites via Resend
- Vector store for real multi-doc RAG (Mongo Atlas Vector Search)

### P2
- Live Stripe (checkout + webhooks + gating)
- Multi-region deploy
- Real-time WebSocket quotes
- Dependency graph enrichment (customers/suppliers)

## Next Action Items
1. Populate `/pipeline`, `/journal`, `/timeline`, and Living Thesis with real user data to demo the differentiation.
2. Consider background job scheduler (Celery + Redis) for automatic assumption re-checks (e.g., after every earnings).
3. Vector store upgrade for cross-document RAG.
