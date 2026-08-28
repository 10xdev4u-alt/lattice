# Lattice

> Research papers, in conversation. A WebMCP-powered workspace where the agent, your open PDF, your library, and your notes share one context, and every claim the agent makes is a re-openable, re-playable, citable event in your own audit log.

Built for the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge) (Sept 3, 2026). $35K prize pool. 10 winning teams. We're going for one of them.

---

## What this is, in one paragraph

You bring a library of research PDFs. Lattice registers 14 typed WebMCP tools that let your AI agent search, summarize, compare, cite, and audit across your papers. Every tool call is logged. Every claim is traceable to a paper, a page, a sentence. You can replay the agent's work, branch it, export it as a PRISMA-style methods appendix, and invite a second agent to peer-review it, all without leaving the page.

---

## Why it wins

| Judge criterion | How Lattice answers it |
|---|---|
| **WebMCP Leverage** | 14 tools, imperative API, dynamically registered per open paper, full lifecycle (`registerTool`, `AbortSignal`, `toolchange`), `readOnlyHint` on 8 reads, `untrustedContentHint: true` on every paper-text return, `exposedTo` for the cross-agent peer-reviewer demo, confirmation flows on every write. |
| **Execution** | Real backend (Netlify Functions + Blobs + AI Gateway), real papers (arXiv source PDFs, pre-bundled), real bibliography export (BibTeX, CSL-JSON, RIS), real workflow artifacts (Markdown methods appendix, JSONL audit log). |
| **Impact** | Every researcher on Earth has this exact pain. The "show your work" expectation is academic norm, not nice-to-have. |
| **Creativity** | The page IS the audit log. We answer an open WebMCP spec issue (#261) with a working demo. |

The research vertical has no WebMCP demos in the 20+ official + ChromeLabs set. The only scholarly site in the 365-site live directory does API-shaped citation. Nobody has built a workspace the researcher lives in.

---

## Try it

```bash
git clone https://github.com/10xdev4u-alt/lattice
cd lattice
npm install
netlify dev
# open http://localhost:8888
```

For the full WebMCP experience, open in Chrome 149+ with the flag enabled at `chrome://flags/#enable-webmcp-testing`, or in the ChatGPT desktop in-app browser.

---

## How we built it

| | |
|---|---|
| Stack | Vanilla TypeScript + Vite, Netlify Functions, Netlify Blobs, Netlify AI Gateway (Claude Haiku), pdf.js |
| Standard | [WebMCP](https://github.com/webmachinelearning/webmcp) imperative API |
| License | Apache 2.0 |
| Status | 10-day sprint, deadline Sept 3, 2026 1pm PT |

---

## The team

- **10xdev4u-alt** (10xdev4u@gmail.com) — primary author, architect
- **the-ai-developer** — co-author, engineering
- Built with ZCode + Claude Code + Codex in an agentic git-issues-and-PRs loop

---

## Read the briefs

Before you dig into the code, the deep research is here:

- [`research/webmcp-spec.md`](research/webmcp-spec.md) — full WebMCP technical reference
- [`research/academic-domain.md`](research/academic-domain.md) — the research-tools market and pain points
- [`research/competitive-landscape.md`](research/competitive-landscape.md) — every existing WebMCP demo analyzed
- [`research/agent-ui-patterns.md`](research/agent-ui-patterns.md) — design patterns for agent+human UIs

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The TL;DR is: we work in branches off main, raise issues before code, and use strict 6-word conventional commits with co-author trailers.

---

## License

Apache 2.0. See [`LICENSE`](LICENSE).
