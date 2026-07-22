llm-gateway — API Usage for Client Teams
Base URL of this deployment: `http://<gateway-host>:8080` (replace with the URL your
platform team gave you). Interactive OpenAPI is at `/docs`.
This document is the full contract, in Swagger-flavor tables, followed by working
copy-paste examples in curl, Python (httpx & OpenAI SDK), TypeScript / Node, and C# / .NET.
---
Changelog
2026-07-15 — new `context_urls` mode: `"human"` (async, opt-in)
Existing integrations need no action. The sync path is unchanged: `context_urls` entries
without a `mode` (or with `auto` / `screenshot` / `screenshot_vlm`) behave exactly as before.
New optional per-URL value `mode: "human"` routes hard-to-scrape / bulk pages
(DataDome / Cloudflare / aggressive anti-bot) to a human-paced browser fleet that distils each
page to markdown, injected as the usual `<web_context>` block. Before you use it:
Async / minutes-scale — never in a live or streaming turn. A batch is paced per domain
and can take tens of minutes; the request parks and resumes, up to the operator max wait
(default 600 s). Submit via `POST /v1/jobs` and set `timeout_s` above the batch time.
Putting `mode:"human"` in an interactive `chat/completions` turn will hang it.
Opt-in, default OFF. Only clients your operator has flagged can reach it — ask your
platform team to enable your client first. Others get a silent fallback to sync (or a
rejection per policy).
Same degrade rules. `blocked` / `failed` / timeout → notice-and-continue, or fails the
request if you set `strict: true`. Never a silent hang.
Full how-to and decision flow: `CLIENT_GUIDE.md` §3. Screenshot knobs
(`screenshot_vlm`, `capture_engine`): `SCREENSHOT_EXTRACTION_GUIDE.md`.
> Status: shipped, mock-validated. Live-WCS validation pending — confirm enablement with your
> operator before depending on it in production.
---
Contents
Which endpoint should I use?
Available models
Authentication
Endpoint reference
`POST /v1/chat/completions`
`POST /v1/embeddings`
`POST /v1/jobs`
`GET /v1/jobs/{id}`
`GET /v1/jobs`
`DELETE /v1/jobs/{id}`
`GET /v1/models`
`GET /healthz`
`GET /metrics`
Web context: live web pages in your prompts
Schemas
Error model
Idempotency
Webhooks (callbacks)
Client examples
Cookbook: common patterns
Limits & gotchas
---
Which endpoint should I use?
Your app is…	Use	Why
An interactive chat / RAG UI, one user waiting	`POST /v1/chat/completions` (sync)	Drop-in OpenAI shape. Blocks up to `wait` seconds. If it takes longer, you still get an `X-Job-Id` — nothing is lost.
A backend job / ETL / batch pipeline	`POST /v1/jobs` (async)	Returns instantly with a job id. Poll it or give a `callback_url`. Survives your process restarts.
Something that must never miss a result even if my worker crashes	`POST /v1/jobs` with `callback_url` and `idempotency_key`	Gateway keeps retrying delivery; retries are idempotent by key.
Vector embeddings (RAG, search, reranking)	`POST /v1/embeddings` (sync)	Direct proxy, skips the job queue — returns immediately even under chat load.
I want the model to read live web pages	`context_urls` or `tools_enabled` on your chat request	Gateway fetches + cleans pages for you. See Web context.
I want token streaming to a live UI	Bypass this gateway; call Ollama directly.	The gateway forces `stream=false` to store full bodies durably.
Key promise of this gateway: every request is written to disk before you get a
response. If the gateway process dies, your job is still there. If your process dies
after submitting, poll by id or wait for the webhook — the result is retained for 7 days.
---
Available models
Always discover the live set with `GET /v1/models` — it returns every model the backend
currently has, each annotated with a `capabilities` array (`chat`, `vision`, `tools`,
`thinking`, `embedding`, …). The set below is what this deployment typically carries; treat it
as a guide, not a fixed contract.
Chat / reasoning (recommended starting points):
`model`	Params	Context	Capabilities	Good for
`qwen3.5:4b`	4.7B	262 K	chat, vision, tools, thinking	Cheap/fast summarization, extraction, classification.
`qwen3.6:27b`	27.8B	262 K	chat, vision, tools, thinking	Harder reasoning, long-doc synthesis, high-quality Q&A.
Other chat models the backend commonly exposes: `qwen3.5:27b`, `qwen3:14b`,
`qwen3-vl:{4b,8b,32b}-instruct`, `qwen3-vl:32b-thinking`, `qwen2.5-coder:7b`,
`qwen3-coder:30b`. Capabilities vary per model — check `/v1/models`.
Embeddings:
`model`	Dimensions	Use with
`nomic-embed-text`	768	`POST /v1/embeddings`
Pass the `model` string exactly as `/v1/models` reports it (e.g. `nomic-embed-text:latest`).
A model wired into the wrong path (e.g. a text-only model for vision input) surfaces as a
`502` with a capability hint — the `capabilities` array lets you avoid that up front.
---
Authentication
If the gateway operator has set `GW_API_KEY`, every request must send:
```
X-API-Key: <your-shared-key>
```
Requests without it get `401 Unauthorized`. `/healthz` remains public (for infra probes).
Ask your platform team for the key. Never commit it — put it in your app's secret
store / env var.
Two kinds of key. The header is the same (`X-API-Key`); what it resolves to differs:
Key you were given	Sees	Notes
Admin key (`GW_API_KEY`)	Everything	The shared operator key.
Per-client secret (issued to your team, e.g. `gwc_…`)	Only your own jobs	`GET /v1/jobs` is filtered to your client; another client's job id returns `404`, indistinguishable from "not found". Your `idempotency_key`s never collide with another client's.
If your platform team runs per-client isolation, you'll get a per-client secret — use it exactly
like the shared key (`X-API-Key: <secret>`). Everything in this doc works the same; you just never
see other clients' data. A secret can be revoked by the operator, after which it returns `401`.
---
Endpoint reference
`POST /v1/chat/completions`
Synchronous, OpenAI-compatible chat completion. Point any OpenAI SDK at
`http://<host>:8080/v1` and it "just works".
Headers
Header	Required	Notes
`Content-Type: application/json`	✅	
`X-API-Key`	if gateway is keyed	See Authentication
`Idempotency-Key`	optional	Resubmit with same key ⇒ returns the same job/result.
`X-Callback-Url`	optional	Also POST the result to this URL when it finishes (useful if the sync call times out).
Query parameters
Param	Type	Default	Purpose
`wait`	number (seconds)	`GW_SYNC_WAIT_S` (600)	How long to block before returning a `504` handle.
`priority`	integer	`GW_SYNC_PRIORITY` (50)	Lower = served sooner. Interactive < batch.
Body — standard OpenAI chat body:
```json
{
  "model": "qwen3.5:4b",
  "messages": [
    {"role": "system", "content": "You are concise."},
    {"role": "user",   "content": "Summarize this paragraph: ..."}
  ],
  "temperature": 0.2,
  "max_tokens": 512
}
```
The full OpenAI `chat.completions` param set is forwarded to Ollama untouched
(`temperature`, `top_p`, `top_k`, `stop`, `frequency_penalty`, `presence_penalty`,
`seed`, `tools`, `tool_choice`, `response_format`, …). `stream` is force-disabled.
Gateway extension fields (optional; strip through `extra_body` when using the OpenAI SDK).
These give the model live web access — see Web context
for the full contract:
Field	Type	Purpose
`context_urls`	array	URLs you want fetched and prepended as context before the model runs. Each item is a URL string or `{url, hint?, max_tokens?, max_tier?, mode?, capture_engine?}`.
`strict`	bool	With `context_urls`: `false` (default) injects a "fetch failed" notice on a bad URL and continues; `true` fails the whole request instead.
`tools_enabled`	bool	Register a `web_extract` tool so the model itself can decide to fetch a page mid-answer (agentic loop).
These are no-ops unless you send them, and may be governed off per client by the operator.
Responses
Status	Meaning	Body
`200`	Completion returned in time.	Standard OpenAI `chat.completion` object. `X-Job-Id` header included.
`504`	Still processing after `wait` s. Not lost — keeps running.	`{"error":{"message":"...","type":"timeout","job_id":"<id>"}}`. `X-Job-Id` header. Retrieve later at `GET /v1/jobs/{id}`.
`502`	Backend returned an error we couldn't retry (bad model, malformed body, etc.).	`{"error":{"message":"...","type":"backend_error","job_id":"<id>"}}`
`400`	Invalid JSON or missing `messages`.	`{"detail":"..."}`
`401`	Missing / bad `X-API-Key`.	`{"detail":"..."}`
`409`	Job was canceled before it started.	`{"error":{"message":"...","job_id":"<id>"}}`
200 body — exactly what Ollama returned:
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1783185386,
  "model": "qwen3.5:4b",
  "choices": [
    {
      "index": 0,
      "message": {"role": "assistant", "content": "..."},
      "finish_reason": "stop"
    }
  ],
  "usage": {"prompt_tokens": 17, "completion_tokens": 42, "total_tokens": 59}
}
```
---
`POST /v1/embeddings`
Drop-in OpenAI embeddings endpoint. Synchronous, and not routed through the job
queue — embedding calls are milliseconds-scale, so they return immediately even while long
chat/vision jobs occupy the worker pool. No `X-Job-Id`, no polling.
Headers: `Content-Type: application/json`, `X-API-Key` (if keyed).
Body — standard OpenAI embeddings body:
```json
{
  "model": "nomic-embed-text",
  "input": ["first text", "second text"]
}
```
`input` accepts a single string or an array of strings (batch). Empty/missing `input` → `400`.
Responses
Status	Meaning	Body
`200`	Embeddings returned.	OpenAI `list` of embedding objects (see below).
`400`	Missing / empty `input`.	`{"detail":"..."}`
`401`	Missing / bad `X-API-Key`.	`{"detail":"..."}`
`502`	Backend error (e.g. model not an embedding model).	`{"error":{"message":"...","type":"backend_error"}}`
200 body:
```json
{
  "object": "list",
  "model": "nomic-embed-text",
  "data": [
    {"object": "embedding", "index": 0, "embedding": [0.01, -0.02, "... 768 floats"]},
    {"object": "embedding", "index": 1, "embedding": ["..."]}
  ],
  "usage": {"prompt_tokens": 6, "total_tokens": 6}
}
```
Batch order is preserved (`data[i].index == i`). `nomic-embed-text` returns 768-dim vectors.
```bash
curl -sS -X POST "$GATEWAY/v1/embeddings" \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"model":"nomic-embed-text","input":["hello world","second text"]}'
```
---
`POST /v1/jobs`
Asynchronous submit. Returns immediately with a job id.
Headers: `Content-Type: application/json`, `X-API-Key` (if keyed).
Body — see JobSubmit schema:
```json
{
  "payload": {
    "model": "qwen3.6:27b",
    "messages": [{"role": "user", "content": "Extract entities from: ..."}],
    "temperature": 0
  },
  "priority": 100,
  "callback_url": "https://my-app.example/webhooks/llm",
  "timeout_s": 900,
  "max_attempts": 3,
  "idempotency_key": "doc-4172",
  "metadata": {"doc_id": 4172, "pipeline": "nightly-extract"}
}
```
Responses
Status	Meaning
`202`	Newly enqueued. Response body = Job.
`200`	`idempotency_key` matched an existing job — returning it. Response body = Job.
`400`	Malformed body.
`401`	Auth.
Response body — Job. Note: `status` at submit time is usually `"queued"`,
`result` is `null` until the job finishes.
---
`GET /v1/jobs/{id}`
Fetch a job's current state. This is the primary way to poll for a result.
Path: `id` — the job id returned by `POST /v1/jobs` or the `X-Job-Id` header from
the sync endpoint.
Response
Status	Body
`200`	Job
`404`	`{"detail": "job not found"}` (may be expired past `GW_RESULT_TTL_S`)
`401`	Auth.
Poll every 2-5 s until `status` ∈ `{done, failed, canceled}`.
---
`GET /v1/jobs`
List recent jobs (useful for a small ops dashboard, backfill scripts, or debugging).
Query
Param	Type	Default	Notes
`status`	`queued` | `running` | `done` | `failed` | `canceled`	(all)	Filter.
`limit`	int (1-500)	`50`	Newest first.
Response `200`:
```json
{ "jobs": [ /* Job, Job, ... */ ] }
```
---
`DELETE /v1/jobs/{id}`
Cancel a job. Only jobs still in `queued` are cancelable. A job already `running`
runs to completion.
Status	Meaning
`200`	Canceled. Body = Job with `status: "canceled"`.
`409`	Not cancelable (already running / done / failed).
`404`	Not found.
---
`GET /v1/models`
Proxies the backend's model list, annotating each entry with a `capabilities` array so you
can feature-detect (e.g. avoid sending image input to a text-only model).
Response mirrors the OpenAI `models.list` shape, plus `capabilities`:
```json
{
  "object": "list",
  "data": [
    {"id": "qwen3.6:27b", "object": "model", "created": 0, "owned_by": "library",
     "capabilities": ["chat", "vision", "tools", "thinking"]},
    {"id": "qwen2.5-coder:7b", "object": "model", "created": 0, "owned_by": "library",
     "capabilities": ["chat", "tools", "insert"]},
    {"id": "nomic-embed-text:latest", "object": "model", "created": 0, "owned_by": "library",
     "capabilities": ["embedding"]}
  ]
}
```
`capabilities` is best-effort (from the backend's model metadata); it may be absent for a
non-Ollama backend.
---
`GET /healthz`
Unauthenticated. For load balancers / uptime probes. Cheap (backend status is cached ~10 s,
so polling never triggers a backend round-trip per request).
```json
{
  "ok": true,
  "ollama": true,
  "gateway": "ok",
  "backend": "ok",
  "queue": {"queued": 3, "running": 2, "done": 41, "failed": 0, "canceled": 0}
}
```
`ok` is the gateway's own liveness; `ollama` (and the legacy `backend: "ok"|"down"`) report
backend reachability. `backend` is `"down"` if Ollama isn't reachable — but you can still submit
jobs; they just wait in the queue until it's back.
---
`GET /metrics`
Requires `X-API-Key` (if set). Includes effective config, for dashboards.
```json
{
  "queue": {"queued": 3, "running": 2, "done": 41, "failed": 0, "canceled": 0},
  "config": {
    "backend_base_url": "http://localhost:11434",
    "max_concurrency": 2,
    "default_timeout_s": 900,
    "default_max_attempts": 3
  }
}
```
---
Web context: live web pages in your prompts
The gateway can pull live web pages into a chat request for you — no client-side scraping. It
fetches each URL through a local Web Context Service (WCS), cleans it to markdown, and feeds it
to the model. Two ways, and they compose (a request may use both). Works on both
`POST /v1/chat/completions` and inside a `POST /v1/jobs` `payload`.
> Fetched page text is treated as **data, not instructions** (the gateway wraps it and tells the
> model so). Your operator may disable web access for your client — if so, these fields are
> silently ignored and the request runs without web content.
Path 1 — you supply the URLs (`context_urls`)
Add `context_urls` and the gateway fetches them before the model runs, prepending each as a
delimited `<web_context>` block:
```jsonc
{
  "model": "qwen3.6:27b",
  "messages": [{"role": "user", "content": "Summarize the latest filing."}],
  "context_urls": [
    {"url": "https://example.com/10k", "hint": "article", "max_tokens": 3000},
    "https://example.com/press-release"
  ],
  "strict": false
}
```
Each entry is a URL string or an object:
Field	Type	Default	Notes
`url`	string	—	Must be `http`/`https`.
`hint`	`article`|`job_posting`|`docs`|`generic`	`generic`	Tunes extraction/caching.
`max_tokens`	int	`4000`	Per-URL cap on the injected markdown.
`max_tier`	int `1..3`	`3`	How hard to try: `1` fast HTTP · `2` headless browser · `3` adds screenshot+vision. Applies to `mode: auto` only.
`mode`	`auto`|`screenshot`|`screenshot_vlm`|`human`	`auto`	`auto` = DOM ladder. `screenshot_vlm` = skip the DOM tiers, capture the page and transcribe the pixels with a vision model — use for dynamic job boards / image-heavy pages where DOM extraction is thin. `screenshot` = pixels only, no text. `human` = async, opt-in human-paced capture for hostile bulk pages — minutes-scale, submit via `/v1/jobs`, never in a live turn (see Changelog + `CLIENT_GUIDE.md` §3).
`capture_engine`	`auto`|`crawl4ai`|`helper`	(WCS default)	Screenshot backend for the screenshot modes. `helper` gives the highest text fidelity on dense pages. Ignored for `mode: auto`.
`mode`/`capture_engine` ride each URL straight through to WCS (see `SCREENSHOT_EXTRACTION_GUIDE.md`); they are the same knobs the direct-WCS `/v1/extract` API exposes.
`strict` (top level): `false` (default) = a failed fetch injects a short "fetch failed"
notice so the model knows, and the request still completes. `true` = any failed fetch fails the
whole request (`502`, error contains `context_urls fetch failed`).
Up to 10 URLs per request (excess are dropped with a notice).
Path 2 — the model decides (`tools_enabled`)
Set `"tools_enabled": true` and the gateway registers a `web_extract` tool with the model. When
the model chooses to call it, the gateway fetches the page via WCS, feeds the markdown back as a
tool result, and re-invokes the model — up to 3 rounds, ~8K tokens of fetched context,
then a final tool-free answer.
```jsonc
{
  "model": "qwen3.6:27b",
  "messages": [{"role": "user", "content": "Read https://example.com and give me the exact title."}],
  "tools_enabled": true
}
```
Requires a tools-capable model (see `capabilities` in `/v1/models`); a model without `tools`
falls back to a single normal call.
If you also pass your own `tools`, the gateway executes only its `web_extract` calls; any
other tool call is handed back to you unchanged (your app fulfils it, standard OpenAI flow).
Seeing what was fetched
Every fetch (URL, final URL, tier, quality score, tokens, errors) and each tool-loop round is
recorded per job and visible in the operator's obs dashboard job detail. If you need the trace
programmatically, ask your platform team — it is not returned on the public response body.
OpenAI SDK note
`context_urls` / `tools_enabled` / `strict` are gateway extensions, not OpenAI fields. Pass them
via `extra_body` (Python) / the request body directly (raw fetch):
```python
resp = client.chat.completions.create(
    model="qwen3.6:27b",
    messages=[{"role": "user", "content": "What did this company report?"}],
    extra_body={"context_urls": [{"url": "https://example.com/earnings", "hint": "article"}]},
)
```
---
Schemas
`JobSubmit`
Body for `POST /v1/jobs`.
Field	Type	Required	Default	Notes
`payload`	object	✅	—	The OpenAI chat body (`model`, `messages`, `temperature`, `tools`, …). Sent to Ollama verbatim (with `stream=false`). May also carry the web-context fields (`context_urls`, `strict`, `tools_enabled`).
`endpoint`	string		`/v1/chat/completions`	Rarely used. Overrides the backend path (e.g. `/v1/embeddings` if wired up).
`priority`	integer		`100`	Lower = served sooner. Interactive traffic: `10-50`; batch: `100+`.
`callback_url`	string (URL)		(none)	If set, gateway POSTs the finished job here. See Webhooks.
`timeout_s`	number		`GW_DEFAULT_TIMEOUT_S` (900)	Per-request timeout to the backend. Long 27B / long-context jobs need this raised.
`max_attempts`	integer		`GW_DEFAULT_MAX_ATTEMPTS` (3)	Retries on transient backend failure. `4xx` (bad requests) never retry.
`idempotency_key`	string		(none)	Resubmitting the same key returns the same job. See Idempotency.
`metadata`	object		(none)	Opaque; echoed back in the Job response and any webhook payload.
`Job`
Response body for job-lookup endpoints and the webhook payload.
Field	Type	Notes
`id`	string (hex)	Gateway-generated.
`status`	`queued` | `running` | `done` | `failed` | `canceled`	Poll until in `{done, failed, canceled}`.
`priority`	integer	Echo of submit.
`attempts`	integer	How many times a worker has tried.
`max_attempts`	integer	Cap.
`created_at`	number (unix seconds, float)	
`updated_at`	number	
`started_at`	number | null	When a worker first claimed it.
`finished_at`	number | null	When it entered a terminal status.
`callback_url`	string | null	
`callback_status`	string | null	`null` → not attempted; `"delivered"` → 2xx from receiver; `"failed: <reason>"` → all retries exhausted.
`error`	string | null	Populated on `failed`. Truncated to 4000 chars.
`result`	object | null	On `done`: the raw OpenAI-shape response body from Ollama.
`metadata`	object | null	Echo of submit.
---
Error model
Errors from `/v1/chat/completions` follow an OpenAI-ish shape so SDKs surface them nicely:
```json
{
  "error": {
    "message": "still processing after 600s; job is NOT lost. Retrieve it at GET /v1/jobs/<id>.",
    "type":    "timeout",
    "job_id":  "3f8ae1..."
  }
}
```
`type` is one of `timeout` | `backend_error`. `job_id` is always populated when the
request was successfully enqueued (so you can always recover the result).
FastAPI validation errors (missing fields, wrong types) use the standard
`{"detail": "..."}` shape.
---
Idempotency
Set `idempotency_key` (or the `Idempotency-Key` header on the sync endpoint) when you
might retry the same logical request. Rules:
Same key ⇒ same job. Response is `200` (not `202`) to indicate "existing".
Keys are unique across all statuses for the retention window (`GW_RESULT_TTL_S`, 7 days).
Once a job with the key is purged, the key becomes reusable.
Recommended shape: `{tenant}:{pipeline}:{primary_key}:{version}`, e.g.
`acme:nightly-extract:doc-4172:v3`.
This is the safest pattern for at-least-once pipelines: retry submissions freely.
---
Webhooks (callbacks)
If you supply `callback_url`, the gateway will `POST` a JSON body to that URL when the
job reaches a terminal status. Payload is the Job object, minus a few internal
fields:
```json
{
  "id":          "3f8ae1...",
  "status":      "done",
  "result":      { /* full chat.completion body from Ollama */ },
  "error":       null,
  "metadata":    { "doc_id": 4172 },
  "attempts":    1,
  "finished_at": 1783185394.11
}
```
Delivery guarantees
At-least-once. Retried up to `GW_CALLBACK_MAX_ATTEMPTS` with exponential backoff.
Your receiver should be idempotent (use `id`).
If all attempts fail, the result is still retrievable via `GET /v1/jobs/{id}` for
the retention window. Nothing is thrown away.
Delivered = HTTP 2xx from your receiver.
Signing
If the operator has set `GW_CALLBACK_SECRET`, each POST includes:
```
X-Gateway-Signature: sha256=<hex hmac of the raw body using the shared secret>
```
Reject requests where the signature doesn't verify.
Webhook verification
Python (FastAPI):
```python
import hmac, hashlib, os
from fastapi import FastAPI, Header, HTTPException, Request

SECRET = os.environ["GW_CALLBACK_SECRET"].encode()
app = FastAPI()

@app.post("/webhooks/llm")
async def receive(request: Request, x_gateway_signature: str = Header(...)):
    body = await request.body()
    expected = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_gateway_signature):
        raise HTTPException(401, "bad signature")
    job = await request.json()
    # ... your processing ...
    return {"ok": True}
```
Node (Express):
```js
import express from "express";
import crypto from "crypto";

const SECRET = process.env.GW_CALLBACK_SECRET;
const app = express();

app.post("/webhooks/llm",
  express.raw({ type: "application/json" }),        // need raw body for HMAC
  (req, res) => {
    const expected = "sha256=" +
      crypto.createHmac("sha256", SECRET).update(req.body).digest("hex");
    const got = req.header("X-Gateway-Signature") || "";
    if (expected.length !== got.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got))) {
      return res.status(401).send("bad signature");
    }
    const job = JSON.parse(req.body.toString("utf8"));
    // ... your processing ...
    res.json({ ok: true });
  });

app.listen(9000);
```
C# (ASP.NET Core minimal API):
```csharp
using System.Security.Cryptography;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var secret = Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("GW_CALLBACK_SECRET")!);

app.MapPost("/webhooks/llm", async (HttpRequest req) => {
    using var ms = new MemoryStream();
    await req.Body.CopyToAsync(ms);
    var body = ms.ToArray();

    using var hmac = new HMACSHA256(secret);
    var expected = "sha256=" + Convert.ToHexString(hmac.ComputeHash(body)).ToLowerInvariant();
    var got = req.Headers["X-Gateway-Signature"].ToString();
    if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(got)))
        return Results.Unauthorized();

    // parse `body` as JSON, process job.id / job.status / job.result, ack 2xx
    return Results.Ok(new { ok = true });
});
app.Run();
```
---
Client examples
Set `GATEWAY` and `API_KEY` for your environment. Examples use the two headline chat models; any
model from `/v1/models` works.
curl
Sync completion (interactive):
```bash
curl -sS -X POST "$GATEWAY/v1/chat/completions?wait=120" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
        "model": "qwen3.5:4b",
        "messages": [{"role":"user","content":"Say hi in one word."}],
        "temperature": 0.2,
        "max_tokens": 32
      }'
```
Async submit + poll:
```bash
JOB=$(curl -sS -X POST "$GATEWAY/v1/jobs" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d '{
              "payload": {
                "model": "qwen3.6:27b",
                "messages": [{"role":"user","content":"Draft a 3-bullet summary of: ..."}]
              },
              "priority": 100,
              "timeout_s": 900,
              "idempotency_key": "doc-4172",
              "metadata": {"doc_id": 4172}
            }' | jq -r .id)

while true; do
  RESP=$(curl -sS -H "X-API-Key: $API_KEY" "$GATEWAY/v1/jobs/$JOB")
  STATE=$(echo "$RESP" | jq -r .status)
  [ "$STATE" = "done" ] || [ "$STATE" = "failed" ] || [ "$STATE" = "canceled" ] && break
  sleep 2
done
echo "$RESP" | jq
```
---
Python — httpx (async submit + poll)
```python
import time, httpx

GATEWAY = "http://<gateway-host>:8080"
API_KEY = "<your-key>"
H = {"X-API-Key": API_KEY}

r = httpx.post(f"{GATEWAY}/v1/jobs", headers=H, json={
    "payload": {
        "model": "qwen3.6:27b",
        "messages": [{"role": "user", "content": "Extract parties & effective date: ..."}],
        "temperature": 0,
    },
    "priority": 100,
    "timeout_s": 900,
    "idempotency_key": "contract-482:v1",
    "metadata": {"contract_id": 482},
})
r.raise_for_status()
job = r.json()
print("submitted:", job["id"])

while True:
    j = httpx.get(f"{GATEWAY}/v1/jobs/{job['id']}", headers=H).json()
    if j["status"] in ("done", "failed", "canceled"):
        break
    time.sleep(2)

if j["status"] == "done":
    print(j["result"]["choices"][0]["message"]["content"])
else:
    raise RuntimeError(j["error"])
```
Python — OpenAI SDK (drop-in sync)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://<gateway-host>:8080/v1",
    api_key="<your-key>",                         # sent as X-API-Key AND Authorization; gateway checks X-API-Key
    default_headers={"X-API-Key": "<your-key>"},  # required if GW_API_KEY is set
)

resp = client.chat.completions.create(
    model="qwen3.5:4b",
    messages=[{"role": "user", "content": "One-sentence pitch for espresso."}],
    temperature=0.4,
    max_tokens=80,
)
print(resp.choices[0].message.content)
```
> **Handling the 504 handle with the OpenAI SDK:** the SDK raises on non-200. If you
> want the "return a handle instead of failing" behavior, either (a) use plain httpx
> as above, or (b) catch the SDK's `APIStatusError` and read `X-Job-Id` off the
> response, then poll `GET /v1/jobs/{id}`.
Python — batch pipeline with callbacks
```python
import httpx, uuid
GATEWAY, API_KEY = "http://<gateway-host>:8080", "<your-key>"
H = {"X-API-Key": API_KEY}
CALLBACK = "https://my-app.example/webhooks/llm"

for i, doc in enumerate(load_documents()):     # your iterator
    httpx.post(f"{GATEWAY}/v1/jobs", headers=H, json={
        "payload": {
            "model": "qwen3.5:4b",
            "messages": [{"role": "user", "content": f"Classify:\n{doc.text}"}],
        },
        "priority": 100,
        "timeout_s": 300,
        "callback_url": CALLBACK,
        "idempotency_key": f"classify:{doc.id}:v1",
        "metadata": {"doc_id": doc.id},
    }).raise_for_status()

# Enqueue everything, walk away. Gateway drains at safe concurrency; results POST to your receiver.
```
---
TypeScript / Node — fetch
```ts
const GATEWAY = "http://<gateway-host>:8080";
const API_KEY = process.env.LLM_GATEWAY_KEY!;
const H = { "Content-Type": "application/json", "X-API-Key": API_KEY };

async function chat(model: string, prompt: string): Promise<string> {
  const r = await fetch(`${GATEWAY}/v1/chat/completions?wait=120`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });
  if (r.status === 200) {
    const j = await r.json();
    return j.choices[0].message.content;
  }
  if (r.status === 504) {
    // Still running. Poll the handle.
    const jobId = r.headers.get("X-Job-Id")!;
    return pollUntilDone(jobId);
  }
  throw new Error(`gateway error ${r.status}: ${await r.text()}`);
}

async function pollUntilDone(jobId: string): Promise<string> {
  while (true) {
    const j = await (await fetch(`${GATEWAY}/v1/jobs/${jobId}`, { headers: H })).json();
    if (j.status === "done") return j.result.choices[0].message.content;
    if (j.status === "failed" || j.status === "canceled") throw new Error(j.error ?? j.status);
    await new Promise(r => setTimeout(r, 2000));
  }
}

console.log(await chat("qwen3.5:4b", "Say hi in one word."));
```
TypeScript — OpenAI SDK
```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://<gateway-host>:8080/v1",
  apiKey: "unused",
  defaultHeaders: { "X-API-Key": process.env.LLM_GATEWAY_KEY! },
});

const resp = await client.chat.completions.create({
  model: "qwen3.6:27b",
  messages: [{ role: "user", content: "Summarize: ..." }],
  temperature: 0.2,
});
console.log(resp.choices[0].message.content);
```
---
C# / .NET — HttpClient (async submit + poll)
```csharp
using System.Net.Http.Json;
using System.Text.Json;

var gateway = "http://<gateway-host>:8080";
var http = new HttpClient();
http.DefaultRequestHeaders.Add("X-API-Key", Environment.GetEnvironmentVariable("LLM_GATEWAY_KEY"));

var submit = await http.PostAsJsonAsync($"{gateway}/v1/jobs", new {
    payload = new {
        model = "qwen3.6:27b",
        messages = new[] { new { role = "user", content = "Draft a 3-bullet summary of ..." } },
        temperature = 0.2
    },
    priority = 100,
    timeout_s = 900,
    idempotency_key = "report-2026-07-04:v1",
    metadata = new { source = "reporting-svc" }
});
submit.EnsureSuccessStatusCode();
var job = await submit.Content.ReadFromJsonAsync<JsonElement>();
var id = job.GetProperty("id").GetString()!;

JsonElement final;
while (true) {
    final = await http.GetFromJsonAsync<JsonElement>($"{gateway}/v1/jobs/{id}");
    var status = final.GetProperty("status").GetString();
    if (status is "done" or "failed" or "canceled") break;
    await Task.Delay(2000);
}

if (final.GetProperty("status").GetString() == "done") {
    var text = final.GetProperty("result")
        .GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
    Console.WriteLine(text);
} else {
    throw new Exception(final.GetProperty("error").GetString());
}
```
C# — OpenAI SDK (`OpenAI` NuGet package)
```csharp
using OpenAI;
using OpenAI.Chat;
using System.ClientModel;

var options = new OpenAIClientOptions { Endpoint = new Uri("http://<gateway-host>:8080/v1") };
// The gateway checks X-API-Key, not Authorization. Add a message handler that injects it:
options.Transport = new HttpClientPipelineTransport(new HttpClient(new ApiKeyHandler(
    Environment.GetEnvironmentVariable("LLM_GATEWAY_KEY")!)));

var client = new ChatClient("qwen3.5:4b", new ApiKeyCredential("unused"), options);
var resp = await client.CompleteChatAsync("Say hi in one word.");
Console.WriteLine(resp.Value.Content[0].Text);

class ApiKeyHandler(string key) : DelegatingHandler(new HttpClientHandler()) {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct) {
        req.Headers.Add("X-API-Key", key);
        return base.SendAsync(req, ct);
    }
}
```
---
Cookbook: common patterns
1. Two-tier priority (interactive UI + background batch on one gateway)
```python
# UI request — served first
httpx.post(f"{GATEWAY}/v1/chat/completions?priority=10", ...)

# ETL batch — waits behind UI
httpx.post(f"{GATEWAY}/v1/jobs", json={"payload": {...}, "priority": 100, ...})
```
Rule of thumb: `10-50` for anything a human is watching; `100+` for backend batch.
2. Cheap-first / escalate
Try the small model; if the answer is unusable, resubmit to the big one. Keep separate
idempotency keys so both results are cached.
```python
def summarize(text):
    for model, tag in [("qwen3.5:4b", "v1-cheap"), ("qwen3.6:27b", "v1-strong")]:
        out = submit_and_wait(model, text, key=f"summ:{doc_id}:{tag}")
        if len(out) >= 100 and "TODO" not in out:
            return out
    return out
```
3. Big documents to the 27B, everything else to the 4B
```python
model = "qwen3.6:27b" if len(doc) > 20_000 else "qwen3.5:4b"
```
Both models support 262K context, so you can also just feed everything to one — pick
`qwen3.5:4b` when latency and cost matter, `qwen3.6:27b` when quality matters.
4. Safe retry from a crashed worker
```python
key = f"{tenant}:{doc_id}:v1"   # deterministic
r = httpx.post(f"{GATEWAY}/v1/jobs", headers=H, json={
    "payload": payload, "idempotency_key": key, "metadata": {"doc_id": doc_id},
})
job = r.json()   # 202 first time, 200 on any subsequent retry with same key
```
Your worker can crash and restart; it will get the same job id back and can just poll.
5. Fan-out with metadata correlation
```python
for row in rows:
    httpx.post(f"{GATEWAY}/v1/jobs", headers=H, json={
        "payload": prompt_for(row),
        "callback_url": CALLBACK,
        "idempotency_key": f"classify:{row.id}",
        "metadata": {"row_id": row.id, "batch": "2026-07-04"},   # comes back on the webhook
    })
```
Your webhook handler dispatches by `metadata.row_id`.
6. Tool-calling (both models support it)
Standard OpenAI `tools` / `tool_choice` fields pass through:
```json
{
  "model": "qwen3.6:27b",
  "messages": [{"role":"user","content":"What is 12 * 47?"}],
  "tools": [{
    "type": "function",
    "function": {
      "name": "multiply",
      "parameters": {"type":"object","properties":{"a":{"type":"number"},"b":{"type":"number"}},"required":["a","b"]}
    }
  }],
  "tool_choice": "auto"
}
```
The response `choices[0].message.tool_calls[]` follows the OpenAI shape.
---
Limits & gotchas
No streaming. `stream: true` is silently overridden. If you need tokens as they
arrive for a chat UI, hit Ollama directly; use the gateway for anything you want
durable/queued.
One-shot per job. Multi-turn conversations are managed by your app — you send
the full `messages` list each call. The gateway has no session state.
Timeouts are per-attempt. `timeout_s` bounds one backend call. With retries, wall
time can be up to `timeout_s * max_attempts` + backoff. Size accordingly.
`504` is not an error. It means "still running — here's your handle". Always
read the `X-Job-Id` header and poll.
Retention. Job results are kept for 7 days (`GW_RESULT_TTL_S`). Fetch
before then, or set a `callback_url`.
Auth mismatch. OpenAI SDKs by default send `Authorization: Bearer …`; this
gateway checks `X-API-Key`. Configure `defaultHeaders`/`default_headers` as shown.
Priorities are only useful under contention. With an empty queue, priority is
moot — first-in-first-out.
Backend crash = the currently-running slot's job is retried automatically once
Ollama is back (subject to `max_attempts`). Queued jobs are unaffected.
Idempotency key uniqueness is per-DB and expires with the job; don't rely on it
across gateway redeployments where the DB was wiped.
Embeddings skip the queue. `POST /v1/embeddings` is a direct synchronous proxy (no
`X-Job-Id`, no ret/poll) so it never waits behind long chat jobs. Use the exact model id from
`/v1/models` — a non-embedding model there returns `502`.
Web context is best-effort and may be governed. `context_urls`/`tools_enabled` can be
disabled for your client by the operator (then silently ignored). A slow page can add seconds
(tier 3 uses a vision model); non-`strict` fetch failures degrade rather than error. Only
`http`/`https` public URLs are fetched (internal/loopback addresses are blocked).
Everything else you might want to know is in `DEV_GUIDE.md`
(ops-side) and `README.md` (architecture rationale).
---
Structured JSON output & reasoning models (added 2026-07-21)
The local models are reasoning models (e.g. `qwen3.5:4b`): they think in a hidden
`<think>` block before answering. On a JSON-extraction prompt with a tight `max_tokens`,
the model can spend its whole token budget thinking, hit the cap, and return an empty
response (`finish_reason: "length"`, no content). The gateway now retries these with a
larger budget so you never receive an empty answer — but the wasted first attempt costs
~30–45s. You avoid that entirely with one line.
Do this for every JSON task
Send `response_format: {"type": "json_object"}`. This grammar-constrains decoding to
valid JSON: the model answers directly (no runaway thinking), output is compact and always
parseable. Measured on `qwen3.5:4b`: an extraction prompt went from an 8192-token truncated
invalid ramble to a ~400-token valid answer on the first try.
```jsonc
POST /v1/chat/completions
{
  "model": "qwen3.5:4b",
  "messages": [
    {"role": "system", "content": "You extract fields. Return STRICT JSON {\"impact_score\": <int>, \"direction\": <string>}."},
    {"role": "user",   "content": "TICKER: NVDA\nHEADLINE: ..."}
  ],
  "response_format": {"type": "json_object"}
}
```
Requirements when using JSON mode:
The word “JSON” must appear somewhere in your prompt (Ollama enforces this) — keep your
`Return STRICT JSON {…}` schema line.
Don't also set a tiny `max_tokens`; leave it unset or generous. JSON mode keeps output short
on its own.
What the gateway does automatically (so you don't have to)
Auto JSON mode. If your prompt clearly asks for JSON (`Return STRICT JSON …`, `respond with JSON`, …) and you did not set `response_format`, the gateway injects
`{"type":"json_object"}` for you. Setting it yourself is still preferred — it's explicit and
guarantees the match regardless of phrasing.
`/no_think` is ignored. Appending `/no_think` (or `/think`) to your prompt does nothing on
this endpoint — the gateway strips it. Do not rely on it to control reasoning. To trade
reasoning depth for speed, send `reasoning_effort: "low"` (or `"none"`); reasoning stays on
by default for answer quality.
Empty answers are retried, not returned. A truly empty `finish_reason:"length"` response is
treated as a transient fault and retried with a doubled output budget (honoring `max_attempts`).
If you can't set `response_format`
Ask the operator to raise `GW_CHAT_MIN_MAX_TOKENS` (first-attempt output-token floor) so heavier
prompts finish reasoning and answer on the first attempt instead of paying a retry. This is a
server-side knob, not per-request.