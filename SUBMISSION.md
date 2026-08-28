# Lattice — WebMCP Challenge submission

> ~370 words. Paste into the Devpost "Describe your project" field.

## Headline

Lattice is a research-paper workspace where the AI agent, your open PDF, your library, and your notes share one context — and where every claim the agent makes is a re-openable, re-playable, citable event in your own audit log.

## What it does

You bring a library of research PDFs (drag-and-drop, or paste an arXiv ID — the LaTeX source path is more accurate than the PDF path). Lattice registers 14 typed WebMCP tools that let your AI agent search, summarize, compare, cite, and audit across your papers. Every tool call is logged. Every claim is traceable to a paper, a page, a sentence. You can replay the agent's work, branch it, export it as a PRISMA-style methods appendix, and invite a second agent to peer-review it — all without leaving the page.

## Why WebMCP

The WebMCP standard lets the agent see your library the way you do — every open paper, every annotation, every draft — using your existing browser session. No API keys. No vendor lock-in. No "premium tier for full-text access." The agent calls `open_paper` and the page registers a per-paper tool set (summarize, extract_quote, compare_claims) scoped via AbortController. The agent calls `show_workflow_trail` and the page hands back the audit log. The agent calls `peer_review_invite` and a second agent — a skeptic persona — joins the page via `exposedTo`. This is the agent-native web the standard was written for.

## What's novel

Existing WebMCP demos are stores, bookings, and games. Lattice is the first workspace the researcher lives in. The audit trail answers WebMCP open issue #261 (reviewable workflow documents) with a working implementation. Every paper-text return carries `untrustedContentHint: true` so the agent treats paper content as data, not instructions. Every write tool requires explicit user confirmation. The page is fully usable without the WebMCP flag (the polyfill no-ops on Safari and Firefox).

## Stack

Vanilla TypeScript on Netlify Functions + Blobs + AI Gateway. pdf.js for PDF extraction, @citation-js for bibliography export. Apache 2.0. The Lattice source is on GitHub; the research briefs, the issue tracker, and the demo are all public.
