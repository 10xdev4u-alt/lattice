# Changelog

A 1-paragraph running summary of the Lattice sprint, regenerated
on each push to main. The full commit log is the source of truth
(\`git log\` on the \`main\` branch); this file is the narrative.

---

## 2026-08-28 — Sprint day 10 (phase 4 polish queue)

72 PRs merged across the 10-day sprint; the project is at 14,187
lines of TypeScript, CSS, and docs across 17 Netlify Functions and
14 WebMCP tools. Today added: per-tool-call retry banner, tool call
inspector, session-timestamp footer, AI "what would you do?"
placeholder. typecheck 0 errors, lint 0 errors, vitest 50/50.

### Recent commits

```
cb25876 feat(chat): AI-generated "what would you do?" placeholder
1535ee9 feat(ui): session timestamp footer (bottom-right)
0c109d1 feat(workflow-trail): tool call inspector overlay
73ef3b6 feat(workflow-trail): per-tool-call retry banner
6a7ea6f feat(stats): real stats page with feedback aggregates
624577f feat(chat): real skeptic inline preview on citation hover
4877e85 feat(routines): detector for broken routines (g d)
7154634 feat(chat): prompt diff between last 2 submissions (g p) (#193)
7f0c327 feat(session): short URL for the current session (g h) (#192)
b072e6d feat(arxiv): saved searches with manual check-for-new (#191)
```
