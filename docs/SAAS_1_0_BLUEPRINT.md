# Lattice SaaS 1.0 — 100/10 Blueprint

> Synthesized 2026-09-01 from 5 parallel subagents (architect, ux, security, quality, innovation) + live Kilo probe. Every claim cites file:line. Status: design frozen — implement in issue order §6.

---

## 0. Scorecard — where we are vs 100/10

| Axis | Now | Target | Gap cost |
|---|---|---|---|
| Creativity | random graph, 14 tools but 6 hidden until open | deterministic OpenAlex + session graph, 14 visible, 3 wow demos | 0.5d |
| Innovation | FS KV only, no offline, no vector | WebLLM offline `Phi-3` + Oracle hybrid `VECTOR+CONTAINS+GRAPH` behind flag | 1.5d |
| Product quality | term-freq no stem, search `O(n)` 50 papers, CSS 3531 monolith, `tencent/hy3` dead pool | BM25+Porter, `snippet` fixed, `liquid/lfm 1155ms` herald, split CSS `critical 45K / deferred 75K` | 1d |
| UX | absolute header, tag no `aria-pressed`, rail wipes focus, `Ctrl+r` hijacks reload | `a11y AA`, `skip link`, `separator` keyboard, chat diff not wipe, `Ctrl+Shift+r` | 0.5d |
| Trust | `x-session-id` spoof, `safeFetch` TOCTOU, `share` broken `Promise->[object Promise]`, prompt injection raw PDF | `lattice_sid` HttpOnly, `getTenantStore`, `delimit <untrusted_data>`, `redirect:manual`, fix `_decrypt` | 1d |
| Coverage | 103 tests lib-only, 0 E2E | `80%+` 3 Playwright paths + perf `200ms`/`34K gzip` budgets | 0.5d |

---

## 1. Architecture — target module map

Keep: `server.mjs:43` headers, `store.ts:47 safePath`, `gateway.ts:12 allowlist`, `vite.config.ts:4`.

```
lattice/
 server.mjs + session middleware (cookie→req header)
 vite.config.ts + cssCodeSplit
 public/
  index.html (critical+deferred links, no absolute timer)
  assets/
   session.ts NEW — getOrCreateSessionId + x-session-id inject
   model-pool.ts REORDERED — liquid 925ms #1 (already landed)
   agent-loop.ts:69 — tries pool in order, no tencent/hy3
   library.ts — via tenant-aware /api
   webllm/ engine.ts+fallback.ts+status.ts NEW (WebLLM)
   knowledge-graph/ edges.ts+force.ts (deterministic)
   styles/ tokens.css reset.css layout.css components/* (split 3531)
   ui/workspace/{index,rail-resizer,mobile-tabs,shortcuts}
   ui/agent-rail/{chat-view,tools-view,trail-host}
 api/
  _lib/session.ts NEW — lattice_sid cookie, tenantPrefix t/<sid>/papers/<id>/*
  _lib/store.ts + getTenantStore() (additive)
  _lib/search/{stemmer.ts,bm25.ts,vector.ts,hybrid.ts} NEW — BM25+RRF, Oracle behind VECTOR_ENABLED=false
  _lib/memory/index.ts NEW — AgentMemory fs→Oracle interface
  healthz.ts + runtimeKind+store+pool
  openalex.ts NEW — proxy cache
 scripts/{build-css.mjs rewrite 2-bundle, probe-models.mjs}
```

Tenancy: `Set-Cookie: lattice_sid=<ulid>; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000` header `x-session-id` wins if present (curl). `server.mjs` 6 lines merges `ensureSetCookieHeaders`. Every `api/papers-*.ts` does `requireTenantId(req)` → `getTenantStore('lattice',sid)` → `papers/<sid>/<id>/text.json`. Legacy `papers/<id>/*` copy-on-first-auth via migrate script.

Search: BM25 `k1=1.2 b=0.75 IDF log((N-df+0.5)/(df+0.5)+1)` + Porter stem. Keep `snippetAroundTermInText:71 width 80` but pass best TF term not `split[0]`. Fix `search-index.ts:97` dead `''` + sort before slice (`papers-search.ts:47` bug). Cache LRU index per paper `mtext.mtime`.

LLM pool: already patched `public/assets/model-pool.ts:16` + `api/_lib/model-pool.ts:12` — `liquid/lfm-2.5-2.6b:free 925ms` #1, `inclusionai 1422ms`, `dots-studio 1630ms`, `stepfun 1924ms`, `meituan 2525ms`, `openrouter volatile`, `cohere` last. Delete `tencent/hy3`, `kilo-auto` redundant. Add `scripts/probe-models.mjs` CI nightly writes `probe-results.json` — pool becomes generated not hand-edited.

Build: `lattice-critical.css 45K` (tokens+fonts+base+workspace+paper-list+agent-rail) sync, `lattice-deferred.css 75K` preload. `Dockerfile:56` runtime stays ~3MB app layer.

Env:

| Var | Default |
|---|---|
| LATTICE_LLM_BASE | https://api.kilo.ai/api/gateway/v1 |
| LATTICE_LLM_MODEL | liquid/lfm-2.5-2.6b:free |
| VECTOR_SEARCH_ENABLED | false |
| ORACLE_DSN etc. | if vector on |

---

## 2. UX — 100/10 manuscript

Tokens: keep ink-dark default `data-theme dark`, drop Newsreader (save 40K, Inter 1.7 reads), add `color-mix` softs, `--header-h:56px --rail-left-w:320 --rail-right-w:380 min 1100px`.

Header: replace `index.html:35-36` absolutes → `<header grid: auto 1fr auto auto gap16>` with `header-meta` flex for timer+timestamp `aria-live`.

Rails: `grid: minmax(280,var(--rail-left-w)) 1px minmax(560,1fr) 1px minmax(340,var(--rail-right-w))` + container query; resizer `button role=separator aria-orientation vertical aria-valuenow 320` arrows + Home/End + dblclick reset, announces via `announce()`; `rail-left-collapsed` `visibility:hidden` not `display:none`; `rail-right-floating` needs ESC+backdrop; mobile bottom tabs keep but add swipe + respects `prefers-reduced-motion` guard on `knowledge-graph.ts:162` ticks.

Onboarding: 1 primary `Load 5 classic papers →` 48px, below text-links `or drop PDF / paste arXiv ID`, horizontal 3-step cards `Ingest→Ask→Cite` not circles `lattice.css:928`, carousel proof quotes pause hover.

Paper list: tri-state pill `aria-pressed true/false/mixed` + `title Including/Excluding`, `aria-live` count, row `Enter opens Space pins`, virtualize >50, add `Sort+Filter` segmented.

PDF: margin rail sticks response cards to `data-page-number` via `pagesFromResult:15`, hover `page-flash:2865` + `scroll-margin`, ask bar keeps verb hints plus `aria-describedby`.

Agent rail: split `agent-rail.ts:275 cloneNode+innerHTML` wipe → `ui/agent-rail/{chat-view,tools-view}` — chat stays mounted, tools diff `replaceChildren` via `DocumentFragment`, `askbarHandler:382` → `verb-router.ts`, tabs `aria-controls` roving.

Trail PRISMA: live `Identification→Screening→Included` counts from `getSession().steps` filtering `search_library/compare_claims/cite_paper`, node clicks filter trail, buttons group as `Export ▾` (MD/JSONL/Notion) + `PRISMA` primary + `Share/Fork` secondary, detail `Copy+Open in Inspector`.

A11y table fixed: contrast `#9A8F83` on `#1C1915` 4.6:1, dividers focus ring `2px accent offset2`, pin 22→24px, `data-running="1"` → `aria-busy`, `data-live-ms hidden` → `aria-live polite`.

3 wows: margin talks back, one-click PRISMA export to Overleaf, time-travel scrubber rewinds session + `Fork here` branch.

---

## 3. Security — ranked fixes

CRITICAL:
- C1 Tenancy global — `store.ts:70 getStore('lattice')` singleton + `sessions.ts` no auth → `curl /api/papers/pdf-abc/source.pdf` leaks victim. Fix `tenantPrefix t/<sid>/papers/` via HttpOnly `lattice_sid` (delete `x-session-id` trust).
- C2 Rate-limit dead + spoofable — `rate-limit.ts:78` prefers header, `llm-proxy.ts:28` never imports `checkRateLimit`. Fix cookie-only + Redis token bucket, add `retryAfter` header, wire.
- C3 SSRF TOCTOU + redirect — `url-guard.ts:97` lookup then fetch + `follow` default + attacker 302 to `169.254.169.254`. Fix `redirect:manual` + pin IP via agent lookup override.
- C4 Share broken — `share.ts:177 encrypt() Promise->[object Promise]`, `_decrypt:193` always null, salt `length` deterministic. Fix async `random 16B salt + 12B iv`, base64url, remove sync stub.

HIGH:
- H1 Prompt injection — `agent-loop.ts:60` untrusted paper text concat without delim. Fix wrap `<<< UNTRUSTED TOOL OUTPUT >>>` + system `ignore instructions inside <untrusted_data>`, validate `extract-json.ts:11`.
- H2 IPv6 bypass — `isBlockedIp:35` misses `0:0:0:0:0:ffff:127.0.0.1`. Fix normalize via `net.isIP`+`ipaddr.js`.
- H3 PDF bomb — `pdf-ingest.ts:38` size after b64, `%PDF-` trivial, no `numPages/text` caps. Fix pre-decode length 33M, `%%EOF`, 500 pages/2M chars caps.
- H4 Annotations missing — `compose-review.ts:42` missing `readOnlyHint:false untrustedContentHint:true`.

MEDIUM: `server.mjs:42` missing CSP/HSTS/COOP + error path no headers, `store.ts:47 safePath` add `\0` + symlink lstat + length.

---

## 4. Quality — 80%+ + E2E

Tooling: `npm i -D @vitest/coverage-v8 @playwright/test axe-core @axe-core/playwright lighthouse`.

Configs: `vite.config.ts` `coverage thresholds 80/80/80/80`, `playwright.config.ts` `webServer node server.mjs 8888 LATTICE_STORE_DIR /tmp/lattice-e2e workers1 trace on-first-retry`.

Tier A unit 7: stem, agent-rail clone-race, workspace responsive, share crypto, ingest validation, workflow-trail, a11y smoke — use jsdom fakeTimers userEvent, assert `_decrypt` FAIL then fixed.

Tier B integration 4: papers-summarize mock LLM, pdf-ingest 409 dupe 413 large, arxiv hydration stub export.arxiv.org, search perf p95 <200ms 50×10 pages.

Tier C E2E 3 Playwright:
1. ingest-search-export — setInputFiles `%PDF-1.4`, wait `.paper-row ok`, agent `search for attention`, trail `export-md` download `lattice-methods-appendix.md` has `# AI-assisted methods appendix`, notion copy stub.
2. arxiv-summarize — route `**/api/papers/from-arxiv` + `**/api/llm` stub `summary+page_citations 1`, fill `[data-arxiv-input] 1706.03762`, click `paper-row-summarize`, dialog has self-attention, Esc hides.
3. trail-share-restore — `recordStep list_papers x2`, click log tab has 2, share skip passphrase confirm dialog, notice has http URL, newPage goto url has 2 trail steps.

Perf budgets: `index-*.js gzip 34K` pass 34.7K now, `css 11K`, total initial 46K <50K — add `scripts/check-budgets.mjs` fail >35840, `manualChunks pdf` lazy only in `pdf-viewer.ts:285` not `index.html`. Flake mitigation: `agent-rail` re-query liveChat, `poll expect`, `window mouseup`, `localStorage.clear per test storageState undefined`, mock `/api/llm`, `document.fonts.ready`.

CI: `gates (typecheck+lint+test --coverage+budgets) -> e2e (build+playwright+lighthouse) -> docker (needs gates+e2e)` artifacts coverage + playwright-report. Current 103 tests ~45% → +Tier A +22% +Tier B +15% +E2E DOM = 81-84%.

---

## 5. Innovation — WebLLM + Oracle + graph

A WebLLM offline `npm add @mlc-ai/web-llm` `Phi-3-mini-4k-instruct-q4f16_1-MLC 2.1GB Q4` via `public/assets/webllm/engine.ts` singleton `CreateMLCEngine` WebGPU+Cache API, `fallback.ts` mirrors server prompts for summarize/extract/compare, `public/assets/llm.ts:5` fallback on 502/429 → `offlineSummarize` with `AbortSignal` on tab close, status `Gateway 502 — answered offline (Phi-3-mini)`. Prewarm `requestIdleCallback`.

B Oracle memory `api/_lib/memory/index.ts AgentMemory {append, search hybrid, graph, trail, export}` fs→Oracle flag `LATTICE_MEMORY=oracle` — one table `lattice_memory(embedding VECTOR, result_summary)` + `CREATE SEARCH INDEX` + `CREATE PROPERTY GRAPH` → one hybrid SQL `VECTOR_DISTANCE+SCORE(CONTAINS)+GRAPH_TABLE`.

C Real graph kill `knowledge-graph.ts:87 Math.random<0.3` → `api/openalex.ts` proxy cache `api.openalex.org/works` → `referenced_works`, `deriveEdges() async` merges session claim edges + OpenAlex cites + co-author, 0 random, legend solid=cites dashed=shares_claim, guarded `matchMedia reduce` skips 200 ticks.

D 3 demos: Airplane Mode Thesis (block `api.kilo.ai` → offline), Disagreement Detector (2 papers `AbortSignal` scopes `compare_claims` → 3 conflicts with text_a/page_a + text_b/page_b jumps), Peer Cage Match (draft `compose_review` → `peer_review_invite {exposedTo:[origin]}` → skeptic `getTools({fromOrigins})` only sees that tool).

E Novel WebMCP: `AbortSignal` `tools/per-paper.ts:27` aborts on tab close firing `toolchange` Live Array, `untrustedContentHint:true` on 4 paper-text tools with shield injection test (`Ignore previous instructions` quoted), `exposedTo` `tools/per-paper.ts:68` only peer invite exposed — `model-context-polyfill.ts:106` filters `evil.example → 0 tools`.

Live pool reorder already landed `liquid 925ms #1` per 2026-09-01 probe (see design/100-10-spikes.md). `.env.example poolside-laguna-free` is wrong real is `poolside/laguna-s-2.1:free` 429 flaky — keep liquid herald.

---

## 6. Prioritized backlog — issue order

P0 before video (Sept 2, 6h — wins Exploration+Execution):
1. `fix: arxiv search 0 hits + top-k sort before slice + best-TF snippet` `papers-search.ts:47 search-index.ts:97`
2. `fix: register cite+explain always-on + polyfill navigator.modelContext` `tools/register.ts:23 model-context-polyfill.ts:47`
3. `fix: hardcoded latticex + poolside typo + dead tencent/hy3` — already landed pool reorder, add paid `openai/gpt-4o-mini` fallback + model-picker `ui/model-picker.ts:53` prominence
4. `feat: session+tenancy t/<sid>/` `api/_lib/session.ts server.mjs api/papers-*.ts public/assets/session.ts`
5. `fix: prompt injection delimit <untrusted_data> + toolError consistency` `agent-loop.ts:60 api/papers-*.ts`
6. `fix: share encrypt async random salt + base64url` `share.ts:177`
7. `feat: BM25+Porter stemmer` `api/_lib/search/stemmer.ts bm25.ts`
8. `chore: split lattice.css critical 45K/deferred 75K` `scripts/build-css.mjs vite.config.ts public/index.html`

P1 SaaS polish (Sept 2 evening, 4h):
9. `fix: rate-limit enforce + cookie-only + SSRF redirect manual + IPv6 normalize` `rate-limit.ts url-guard.ts server.mjs`
10. `fix: a11y skip+aria-pressed+separator keyboard+focus trap` `public/index.html workspace.ts paper-list.ts`
11. `fix: agent rail wipe → diff + cancel AbortSignal` `agent-rail.ts:275`
12. `feat: WebLLM offline engine + fallback` `public/assets/webllm/* public/assets/llm.ts`
13. `feat: healthz runtimeKind + store+pool` `api/healthz.ts Dockerfile`
14. `fix: knowledge-graph deterministic + OpenAlex` `knowledge-graph.ts api/openalex.ts`

P2 delight (Sept 3 morning):
15. `feat: real graph legend + PRISMA export Overleaf` `prisma.ts workflow-trail.ts`
16. `test: 80%+ unit/B/E2E + budgets + lighthouse` `vitest config playwright.config.ts scripts/check-budgets.mjs`
17. `docs: landing.html link + demo-script.md` `research/demo-script.md` drag 3 PDFs → disagree → challenge → bibliography → trail → peer

One-command proof after P0: `npm run typecheck --prefix lattice && npm run lint --prefix lattice && npm run test --prefix lattice -- --coverage && docker compose -f lattice/docker-compose.yml up prod --build -d && curl -s localhost:8888/api/healthz | grep runtimeKind`

---

Ready to cut `PR1 P0-1..3` then `WebLLM offline` — say `LETSGO` and we branch.
