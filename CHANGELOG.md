# Changelog

All notable changes to Lattice are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com), and the
project adheres to [Semantic Versioning](https://semver.org).

## [0.1.0] — 2026-08-28

The first sprint of the WebMCP Challenge build. 11 PRs, 1 squash
merge per PR, strict 6-word conventional commits with co-author
trailers. The team is 10xdev4u-alt and the-ai-developer, with humans
joining later.

### Added

- Project skeleton: Vite, TypeScript strict, ESLint, Prettier, Vitest
- Netlify Functions + Blobs with the WebMCP-required headers on every
  response (`Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`)
- 14 typed WebMCP tools, dynamically registered, with the polyfill for
  browsers without `document.modelContext`
- Library, bibliography, and workflow-trail persistence (localStorage
  for the demo; the magic-link auth upgrade will move them to Blobs)
- Bibliography export in 5 formats: CSL-JSON, BibTeX, RIS, APA-MD, MLA-MD
- PDF ingest via Netlify Function with magic-byte validation, 25MB
  cap, SHA-256 dedup
- Two-column read-order reconstruction (heuristic; per-page column
  detection + top-to-bottom sort + line-break detection)
- arXiv source ingestion fallback (Atom API for metadata, /e-print
  for LaTeX, gunzip + strip)
- Per-paper search inverted index with stopword filter and snippet
  extraction
- Three-rail workspace UI: paper list (left), PDF canvas (center),
  agent rail (right)
- Confirmation modal for write tools, per the WebMCP secure-tools
  guide
- Workflow trail UI: timeline, click-to-expand, Markdown + JSONL
  export, methods-appendix output
- Cross-agent peer-reviewer demo: the skeptic persona joins via
  `peer_review_invite`, challenges every claim, never writes
- Marketing landing page with the hero IS the demo
- Multi-stage Dockerfile, non-root user, 200MB size budget
- OpenAI-compatible LLM client (kilo.ai / poolside-laguna-free)
- The 4 deep research briefs (WebMCP spec, academic domain,
  competitive landscape, agent UI patterns)
- The 3-minute demo video script
- The Devpost submission text

### Fixed

- The polyfill returns early on Chrome 150+ where `document.modelContext`
  is native
- Write tools are confirmed on the first call per session, with a
  per-session "allow always" toggle

### Security

- Every tool returning paper text is annotated with
  `untrustedContentHint: true`
- All write tools require explicit user confirmation
- No secrets in the repo; `.env.example` documents the env vars
- SHA-256 dedup on PDF ingest prevents storage abuse
- Netlify Blobs store is origin-scoped; cross-origin iframe access
  requires `allow="tools"`
