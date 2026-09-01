# Lattice

> Research papers, in conversation. A WebMCP-powered workspace where the AI agent, your open PDF, your library, and your notes share one context — and every claim the agent makes is a re-openable, re-playable, citable event in your own audit log.

[![CI](https://github.com/10xdev4u-alt/lattice/actions/workflows/ci.yml/badge.svg)](https://github.com/10xdev4u-alt/lattice/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![WebMCP](https://img.shields.io/badge/WebMCP-Challenge_2026-7c6cff)](https://openai.com/webmcp-challenge)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Built for the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge) (Sept 3, 2026). $35K prize pool, 10 winning teams.

---

## What this is

You bring a library of research PDFs. Lattice registers 14 typed WebMCP tools that let your AI agent search, summarize, compare, cite, and audit across your papers. Every tool call is logged. Every claim is traceable to a paper, a page, a sentence. You can replay the agent's work, branch it, export it as a PRISMA-style methods appendix, and invite a second agent to peer-review it — all without leaving the page.

**The killer feature:** the page IS the audit log. Open the Log tab. See every tool call, every arg, every result, every duration. Click a step. Replay it. Export it as a Markdown methods appendix you can drop into a thesis. This answers WebMCP open issue #261 (reviewable workflow documents) with a working implementation.

---

## Try it

Docker-first — one image runs the client, the API, and the store:

```bash
# Option A — Docker (recommended)
docker build --target runtime -t lattice:runtime .
docker run --rm -p 8888:8888 lattice:runtime
# → http://localhost:8888        (the story: landing page)
# → http://localhost:8888/app/  (the workspace)

# Compressed shippable artifact (~57MB gz)
scripts/docker-artifact.sh lattice-image.tar.gz
gunzip -c lattice-image.tar.gz | docker load

# Dev/test via compose
docker compose up prod -d     # the running app on :8888
docker compose run --rm test  # the vitest suite in-container
docker compose up dev         # vite + API server, hot reload

# Option B — local Node (no Docker)
npm install
npm run build
npm start            # → http://localhost:8888

# Option C — dev with hot reload
npm run dev          # vite on :5173, API on :8888
```

For the full WebMCP experience, open in **Chrome 149+ with the flag enabled at `chrome://flags/#enable-webmcp-testing`**, or in the **ChatGPT desktop in-app browser**. The polyfill keeps the page fully usable in Safari and Firefox.

The empty state has a "Load sample library" button that pulls in 5 well-known arXiv papers. You can also paste an arXiv ID (e.g. `1706.03762`), or **drop a PDF straight onto the empty state** — the file is ingested, its text extracted, a BM25 index built, and the paper joins your library without a reload.

---

## Validation

Every merge to main runs: typecheck (strict, `api/` included) · eslint · 142 unit tests · 7 Playwright e2e tests (landing route, workspace boot + wired PDF picker, sample library, search, healthz truth, share page render, agent rail) · bundle budgets (≤36K js gzip initial, ≤12K css gzip; pdf.js and web-llm lazily vendor-chunked) · a Docker build whose smoke test verifies the runtime serves the app shell, the share page, and the WebMCP headers.

---

## The 14 tools

| Tool | Mode | What it does |
|---|---|---|
| `list_papers` | read | Returns the library as CSL-JSON |
| `open_paper` | action | Opens a paper; re-registers per-paper tools |
| `search_library` | search | Full-text search with snippets |
| `summarize_paper` | read | LLM-summarize at a chosen audience level |
| `extract_quote` | read | Verbatim quote for a concept |
| `compare_claims` | read | Agreements and conflicts between two papers |
| `cite_paper` | read | Citation in BibTeX, APA, MLA, Chicago, CSL-JSON, RIS |
| `add_to_bibliography` | write | Add a paper to the export list (confirmation required) |
| `remove_from_bibliography` | write | Inverse |
| `export_bibliography` | write | Download the bibliography as a file |
| `explain_evidence` | read | List papers supporting/refuting a claim |
| `show_workflow_trail` | read | The audit log; summary, jsonl, or markdown |
| `compose_review` | write | Draft a structured peer review |
| `peer_review_invite` | write | Invite the second agent (skeptic persona) |

Every tool: snake_case, ≤ 30 char name, ≤ 500 char description, JSON-Schema input, `readOnlyHint` / `untrustedContentHint` where appropriate. Write tools require explicit user confirmation per the WebMCP secure-tools guide.

---

## Architecture

| | |
|---|---|
| **Stack** | Vanilla TypeScript, Vite, plain-Node API (one `node server.mjs` process), pdf.js, @citation-js |
| **LLM** | OpenAI-compatible endpoint at `https://api.kilo.ai/api/gateway/v1`, model `kilo-auto/free`, key `latticex` (swap via env var); browser calls route through `/api/llm` |
| **Storage** | Filesystem KV under `LATTICE_STORE_DIR` for papers (`papers/<id>/source.pdf`, `text.json`, `index.json`); localStorage for the trail in the demo |
| **Docker** | Multi-stage alpine build: `test` target (in-container vitest), `runtime` target (~3MB app layer on node:22-alpine), 57MB gzipped artifact via `scripts/docker-artifact.sh` |
| **WebMCP** | Imperative API only, with a no-op polyfill for absent `document.modelContext` |
| **License** | Apache 2.0 |
| **Status** | 10-day sprint, deadline Sept 3, 2026 1pm PT |

The 4 research briefs that shaped this build are in [`research/`](research/):

- [`research/webmcp-spec.md`](research/webmcp-spec.md) — full WebMCP technical reference
- [`research/academic-domain.md`](research/academic-domain.md) — the research-tools market and pain points
- [`research/competitive-landscape.md`](research/competitive-landscape.md) — every existing WebMCP demo analyzed
- [`research/agent-ui-patterns.md`](research/agent-ui-patterns.md) — design patterns for agent+human UIs
- [`research/demo-script.md`](research/demo-script.md) — the 3-minute video script

---

## The team

- **10xdev4u-alt** — primary author, architect
- **the-ai-developer** — co-author, engineering
- Built with ZCode, Claude Code, Codex, and a deep agentic git-issues-and-PRs loop

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The short version: we work in branches off main, raise issues before code, and use strict 6-word conventional commits with co-author trailers. Every PR is reviewed before merge.

---

## License

Apache 2.0. See [`LICENSE`](LICENSE).
