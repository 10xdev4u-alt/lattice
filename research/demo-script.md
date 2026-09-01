# Lattice Demo — 3 Killer Demos (2:50 total)

> Record at 1440p, USB mic, captions hand-corrected. Start from empty state after `Load 5 classic papers` warmed once.

## 0. Title (0:00–0:12)
**Visual:** Fraunces headline "Research papers, in conversation." + WebLLM badge `Private • Phi-3-mini` in header + 14-tool Live Array.
**VO:** "Every AI demo asks you to trust the agent. Lattice proves it — the page IS the audit log. 14 typed tools, private offline, tenant-isolated."

## 1. Airplane Mode Thesis — WebLLM offline (0:12–0:55)
**Action:** Load 3 papers, open Transformer, toggle Network offline in DevTools, click `Send → Cancel` is visible, ask "Summarize for a grad audience".
**VO:** "Gateway 502. Every other demo dies. Lattice answers — Phi-3-mini runs in your GPU via WebLLM, 2.1GB cached once. Same prompt shape, `[answered offline]` badge. No server, no key, private."
**Show:** Response card ` [answered offline: Phi-3-mini]` + header badge flipping `Downloading → Private • Phi-3-mini`.

## 2. Disagreement Detector — compare_claims + deterministic graph (0:55–1:40)
**Action:** Open 2 papers, `compare_claims` scopes via `AbortSignal` to those two (close tab → tool unregisters), 3 conflicts with `text_a/page_a + text_b/page_b`, click page chip jumps to PDF highlight, graph edge `hashTwo` deterministic.
**VO:** "Two papers, one `compare_claims` scoped to them. Close a paper, the tool dies — AbortSignal. Click a claim, the PDF flashes. The graph is hash-deterministic, not Math.random. OpenAlex backs cites when online."
**Show:** Graph solid=cites dashed=shares_claim legend, `prefers-reduced-motion` static.

## 3. Peer Cage Match — exposedTo + untrustedContentHint (1:40–2:25)
**Action:** `compose_review` drafts 4-section peer review, `peer_review_invite skeptic` via `exposedTo:[origin]` — second agent `getTools({fromOrigins})` only sees that tool, challenges via `explain_evidence` with `untrustedContentHint:true` shield.
**VO:** "One draft, one skeptic. The peer reviewer is a second agent invited via `exposedTo` — it only sees the invite tool. It demands citations, never writes. You watch them negotiate. Every paper-text return is `untrustedContentHint` — injected `Ignore previous instructions` PDFs are quoted, not obeyed."
**Show:** Two agent bubbles negotiating, `UNTRUSTED` delim in system prompt visible in `What's in the prompt` (g d).

## 4. Audit → PRISMA → Share (2:25–2:50)
**Action:** Open Log tab, `PRISMA` flow live from `search_library`/`compare_claims`/`cite_paper` counts, `Export as methods appendix` → Markdown + Mermaid, `Share` → `v1.` encrypted URL, `BM25` recall: `transformer` matches `transformers`.
**VO:** "The trail is the product. PRISMA from live steps, export to Overleaf, share `v1.` encrypted. BM25 + Porter so `running` finds `run`. Tenant-isolated — your library never leaks."
**End card:** `lattice.app` + GitHub + 3-bullet SaaS spine (14 tools, private, isolated).
