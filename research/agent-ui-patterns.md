# Agent + Human UI Patterns — Brief for Lattice

> Last updated 2026-08-28. Compiled from public product documentation, design guides, and direct observation of the tools listed. Tailored for a research-paper workspace.

---

## 0. TL;DR

"Show your work" is now table stakes. The differentiator is **how legibly and how fast** you show it. The winners in 2026 stream every tool call, render every source as a citable chip, and let the human take over mid-action.

The most underrated 2026 pattern is **time-travel / replay over a recorded agent run**. Almost no WebMCP starter does this well yet.

For research, **citation as a first-class object** (not a footnote) and **"I don't know" as a visible affordance** beat any amount of flashier styling.

The Netlify WebMCP starter is intentionally minimal. The visual gap to Vercel/Linear/Claude-aesthetic is wide and easy to close.

---

## 1. How today's AI products show their work

### 1.1 ChatGPT

- **Canvas** is the "show me what you did" surface for long-form edits. Side panel, inline diffs, comments, version slider, "back to previous version." Targets writing and code edits, not research.
- **SearchGPT / ChatGPT Search** shows inline citation chips with a "Sources" button; hover reveals a card with the publisher and quote.
- **Deep Research** exposes a multi-step "task plan" that updates live (e.g., "Researching 12 sources, reading 4, drafting 1"), with collapsible per-step tool traces.
- **Tool surfacing**: each tool call is rendered as a collapsible card with the tool name, args, and result. Long-running tools show a shimmer.

### 1.2 Claude (Anthropic)

- **Extended thinking** is a first-class UI affordance. Users see a separate "thinking" block, often muted, that can be collapsed.
- **Artifacts** are rendered alongside the chat in a side pane. The chat stays a log of intent; the artifact is the work product. **The best dual-pane pattern in the market** and a strong reference for research.
- **Projects** are the workspace abstraction: knowledge (uploaded docs) + custom system prompt + chat history. Sidebar lists projects; each is a self-contained research container.
- **Computer use** streams screenshots, cursor moves, clicks, typed text. Confirmation flow is developer-driven, not user-driven in the public API.

### 1.3 Gemini (Google)

- **Side panel in Workspace (Docs/Gmail/Sheets)** is the canonical "AI in your existing tool" pattern. It reads context, proposes edits, and shows an "Insert" button rather than mutating directly.
- **Deep Research** (gemini.google.com) shows a plan, then a live "Reading X sources" feed, then a long-form report with inline citations. The plan can be edited before run.
- "Double-click a paragraph → ask Gemini about it" — keep the user in the page, treat the AI as a researcher sitting next to them.

### 1.4 Cursor

- The gold standard for **inline diff UX**. A change appears in the editor with a green gutter, an inline comment with the prompt that produced it, and a single keystroke to accept/reject.
- **Cmd-K** = local edit; **Cmd-L** = chat; **Cmd-I** = composer (multi-file). Each has its own surface.
- **Agent mode** has a plan first ("I'll edit these 4 files to…"), and during execution each file edit appears as a diff you can accept/reject. Terminal commands are queued behind a "Run" button — never auto-executed.
- "Worked for 14m 22s, explored 12 files" status line is a great "I did work" badge.

### 1.5 GitHub Copilot

- **Agent mode** in VS Code: chat panel + working set (list of files) + inline edits. Each tool call is shown as a card with the tool name, args, and output.
- The **"Used N references"** link at the bottom of every chat response: always tell the user what you read.
- **Copilot Edits** has a per-file "Accept / Discard" affordance. Terminal commands are explicit, not silent.
- Workspace/trust boundaries are clearly visible: "This file is outside your workspace."

### 1.6 v0 / Bolt / Lovable

All three follow a **plan → build → preview** flow:

- A plan/checklist appears at the top, each item has a checkmark when done.
- Build logs stream below with file names, language, and a small status icon.
- The preview is a real, interactive iframe on the right.
- "View code" expands a Monaco-style viewer with file tabs.
- v0 leans further on **component previews**: each generated component renders as a card you can drop into your project.

**Key insight:** plan visibility is a product feature, not just a debug feature. The user feels in control because they see the steps.

### 1.7 Replit Agent 4

- Kanban board of tasks. The agent adds tasks, you can add tasks, the agent sequences them.
- Each task has its own "playground" with a chat, file diffs, and a live preview.
- **Parallel workstreams** are visualized as multiple agents running in different swimlanes.
- The "Design Canvas" is a visual editor; click any element to ask the agent to change just that.

### 1.8 Devin

- The cleanest "agent as coworker" UI. Three panels: **Chat** (instructions and status), **IDE** (real VS Code-style editor), **Browser** (Devin's actual browser, with a cursor you can see move).
- A left-rail **Tools/Shell** panel shows every command Devin ran, with output.
- **Plan** appears at the top of the chat as a numbered list Devin updates live.
- A **"Take Over"** button lets you grab the IDE or browser and drive manually. **The killer pattern.**

### 1.9 Perplexity / SearchGPT

- **Inline numbered citations** `[1]` `[2]` `[3]` after every claim. Hover → card with title, source, snippet. Click → opens source.
- A right-rail "Sources" list with favicons, sorted by recency or relevance.
- **Follow-up questions** below the answer, generated, clickable.
- **Focus modes** (Academic, Writing, YouTube) act as a "tool picker" rendered as chips.
- "I read 47 sources" badge is the credibility signal.

### 1.10 Notion AI

- **AI block** = inline, persistent, editable. The AI output lives as a block in the page, not a transient message.
- **Q&A** = top-of-page chat that searches the workspace.
- **Notion Agent** = multi-step task runner with a progress bar.
- **Research Mode** = long-form report generator with sources at the bottom.
- **The pattern to copy:** the AI output is a first-class document object, not a message in a thread.

---

## 2. The "agent sidebar" pattern

### 2.1 Survey of variants

| Product | Pattern | Notes |
|---|---|---|
| ChatGPT Canvas | Right rail, full-height | Closes back to chat; minimal Chrome |
| Claude Artifacts | Right rail, resizable | Tabs for multiple artifacts; full-screen mode |
| Claude Projects | Left rail (project list) + main chat | Project is the unit of organization |
| Gemini Workspace | Right rail in Gmail/Docs | Context-aware, "Insert" rather than mutate |
| Cursor | Right rail chat + inline edits | "Quick chat" can be a floating bar |
| Copilot | Chat panel + inline | Working set visible above the input |
| Bolt / v0 | Left chat + right preview | Plan at the top of the left rail |
| Devin | Three panels (chat / IDE / browser) | Most aggressive, most info-dense |
| Replit Agent | Kanban (top) + per-task chat | Plan is the layout itself |

### 2.2 Pros and cons for research work

| Pattern | Pro | Con |
|---|---|---|
| **Right sidebar chat** | Familiar, doesn't fight the page | Eats horizontal space; paper-reading needs width |
| **Left sidebar with threads** | Good for sessions across many papers | Can feel like Slack, not a workspace |
| **Bottom drawer** | Maximizes reading area | Hard to see chat + document at once |
| **Floating pop-out** | Maximizes document area | Easy to lose; no home for past runs |
| **Modal overlay** | Good for focused actions (confirm, edit) | Awful as a permanent home for the agent |
| **In-page block** (Notion AI) | Agent output becomes part of the document | Loses the conversational thread |

**Recommendation for research:** **left rail (papers, threads) + right rail (agent) + main canvas (the paper being worked on)**. This is the Linear / Figma split, and it's the right one when the main artifact is text.

### 2.3 "Watch the agent work" motion

Two philosophies, both right for different moments:

1. **Real-time stream** (Cursor, Bolt, v0, Devin) — each tool call appends to a log as it happens. Best for low-stakes, exploratory, "show me the search results as you find them" research. Risk: feels chaotic on long runs; users tune out.
2. **Step-by-step, gated** (ChatGPT Deep Research, Replit Agent, Kiro) — the agent announces a plan, the user approves, the agent runs a batch, reports back, asks for the next instruction. Best for high-stakes, long-running, multi-day work. Risk: latency between turns feels dead.

**Best 2026 practice:** **stream within a step, gate between steps.** Show tool calls as they happen inside a single research action; require approval or a clear handoff between actions.

Motion design specifics that work:

- A subtle pulse on the tool being used right now.
- A typewriter for textual output, a fade-in for cards.
- A "swoosh" to scroll the page to the spot the agent just edited.
- A low-frequency ambient hum (off by default) for the agent thinking.
- A distinct, calm motion for "I am waiting on a slow API" (e.g., spinner with a 1-line ETA).

---

## 3. The "explain your reasoning" surface

### 3.1 Chain-of-thought displays

- Claude's **extended thinking** is the cleanest pattern: a separate "Thinking…" block, often greyed, expandable, with a "show full thinking" affordance.
- ChatGPT's o1/o3 surfaces "reasoning tokens" as a separate stream.
- **The research lesson:** thinking should be visible by default, dismissible, and *searchable*. The user may want to scroll back to find why the agent made a specific choice.
- **The risk:** leakage of system prompt, copyrighted text, or reasoning that the user shouldn't see. Have a clear "hide" toggle, and a policy on what gets shown.

### 3.2 Tool-call traces

- A vertical log, one entry per call, each with: timestamp, tool name (mono), args (collapsed by default), result (collapsed, expandable).
- Each entry has a "Copy" button and a "Pin" button. Pinned entries float to the top.
- For research tools specifically, a **"Show in document"** button on each call that scrolls the document to the relevant section.
- A **search box** over the entire log.
- Research sessions will have 200+ calls; search is non-negotiable.
- **Export** the log as JSON, for users who want to audit or share.

### 3.3 Source citation chips

- Perplexity-style `[1]` chips, with a hover card.
- For research, the chip should include: author, year, journal/venue, type (paper / preprint / blog / dataset), and a "Read" button.
- **Citation as a first-class object:** every chip should be clickable to open a full citation, with a "Copy BibTeX" and "Copy APA" action. **Table-stakes for a research product.**
- A **bibliography panel** that aggregates every cited work, deduplicated, with the inline references linked to it.

### 3.4 Confidence indicators

- ChatGPT shows a soft "could be wrong" footer. Claude shows "based on the provided documents."
- For research, the right pattern is **per-claim confidence**, not per-message. After a claim, a small indicator: green dot (well-supported by sources), yellow (one source), red (no source, or contradicted), grey (model's own knowledge, not from this workspace).
- **Hide confidence when not useful:** at high latency, when the user is brainstorming, when the model is being creative. Show it when the user is making a real decision.
- **Calibrate honestly:** confidence is a UX lie if it doesn't correlate with accuracy. Consider showing it as a probability band ("3 of 4 sources agree") rather than a fake scalar.

### 3.5 "I don't know" affordances

- A **dedicated button**: "I don't know — search the web" / "I don't know — flag for the human."
- Visible in the empty state of the tool result panel.
- For research, the most valuable "I don't know" is: "I couldn't find a source that supports this." That single sentence, displayed prominently, is more useful than 10 paragraphs of hedging.
- Make **"I don't know" a positive UX state**, not a failure. Use a calm color, a clean icon, and a clear next action.

---

## 4. The confirmation pattern

### 4.1 Browser-native `confirm()` vs custom modal vs inline

- `confirm()` is dead in 2026. It can't be styled, blocks the event loop, doesn't work on mobile, and conveys no context.
- **Custom modals** (Radix, shadcn) are the workhorse for destructive or expensive actions: deleting a paper, regenerating a long report, paying for a run.
- **Inline confirmations** ("Delete? [Confirm] [Cancel]" right in the row) are right for **safe, reversible** actions.
- **Toolbar / banner confirmations** (a yellow strip at the top of the workspace) are right for **whole-session** changes ("Agent wants to overwrite your notes. Allow?").

### 4.2 "Always allow" toggles

- Every confirmation should have a "Don't ask again for this action" or "Always allow `web_search`" toggle. Without it, the user will tap "Allow" 200 times in a long run.
- Group toggles by **tool** and **scope**:
  - "Always allow `read_paper` for this session."
  - "Always allow `web_search` for this project."
  - "Always allow this agent (read-only tools) across all projects."
- For write tools (`write_notes`, `edit_figure`), **never** offer a global "always allow." Per-run, per-target.

### 4.3 What other agentic products do

- **Anthropic Computer Use**: developer-defined, no user-facing confirm. The model is the user.
- **OpenAI Operator**: takes over a browser, asks for confirmation before purchases or sensitive actions. Modal with a clear "Operator wants to…" header. Has a "Take over" button mid-run.
- **Devin**: shows a "Plan" up front, the user clicks "Approve Plan," then Devin runs autonomously. Confirmation is at the level of the plan, not the tool call.
- **Replit Agent**: per-task approval, not per-tool. "Should I install this package?" is a question, not a confirm.
- **Cursor Agent**: per-command approval in the terminal, per-diff acceptance in the editor, no per-tool confirm for the LLM's "read" tools (read is free).
- **Kiro (AWS)**: spec-driven. The user approves the spec; the agent works against the spec. Spec drift is flagged.

**The principle:** **confirm at the highest level that is still reversible.** Don't ask about every tool call; ask about the plan. Don't ask about every edit; ask about the file. Don't ask about every run; ask about the project.

---

## 5. The audit / replay pattern

### 5.1 Workflow replay

- **OpenAI's record/replay** in their evals framework and agent SDK: every run is a JSONL of events that can be replayed deterministically.
- **Runme** makes markdown runbooks executable. A runbook is a deterministic, replayable record of what was done.
- **Hex / Observable / Deepnote** all have notebook-style replay: every cell's input and output is stored, you can re-run any cell and propagate.

### 5.2 Time-travel debugging

- The strongest pattern: **a scrubber bar across the top of the tool log**. Drag it back, and the document state, the chat state, and the agent's reasoning all rewind.
- LangGraph Studio, Replit, and Braintrust (evals) all have some form of this.
- **For a research product, the killer use case:** "Why did the agent conclude X? Let me rewind to the moment it cited paper Y." The answer should be one drag away.

### 5.3 Git-style history

- **Devin** and **Cursor** show a "session" as a series of file diffs. Each diff is a commit, you can revert.
- For research, think of every tool call as a micro-commit. The user can:
  - Revert the agent's last edit.
  - Branch the workspace at any point ("what if it had cited paper Z instead?").
  - Compare two runs side-by-side.
- This is the **branching workspace** pattern. It's rare in 2026, and it's a real differentiator for a research product.

### 5.4 What "show my work" should mean in 2026

A working definition:

1. **Every tool call is recorded** with a timestamp, args, and result.
2. **Every claim is traceable** to one or more tool calls and source documents.
3. **Every edit is a diff** the user can accept, reject, or branch from.
4. **Every session is replayable** deterministically, or as close to deterministically as the model allows.
5. **Every session is exportable** as a reproducible package: the prompt, the model, the tool definitions, the document state, the source list, the BibTeX.

In one line: "Show my work" in 2026 means **"you can re-run me, you can audit me, and you can prove where each sentence came from."**

---

## 6. The "two agents" pattern

### 6.1 Multi-agent UIs in the wild

- **LangGraph Studio**: graph view (nodes = agents, edges = handoffs), thread view (one row per message, color-coded by speaker), state inspection panel. **Best-in-class** for understanding orchestration.
- **CrewAI Studio**: list view of agents + tasks, with a flow diagram. Less visual, more spreadsheet.
- **AutoGen Studio**: chat view of agents talking to each other, with a left rail to configure the team. Not production-ready, but the chat-vs-chat idea is interesting.
- **Microsoft Agent Framework**: emerging, pushes a "team" abstraction with role definitions.
- **Braintrust / LangSmith**: a debugging view, not a runtime view. Shows traces, not the live experience.

### 6.2 Conductor / orchestrator metaphors

- The most common is the **graph view**: nodes (agents or tools) and edges (data or control flow). Looks like a flow chart. Expressive but hard to read at scale.
- A **swimlane view** (one row per agent) reads better. Each row has its own timeline; messages cross between rows.
- A **tab view** (one tab per agent) is the simplest. Loses the "they're talking" feel.
- A **"conductor" card** at the top, with the current "active" agent highlighted, is the cleanest. Like a TV show with a host; the user always knows who is talking.

### 6.3 Side-by-side vs thread-of-thought

- **Side-by-side** (two columns, one per agent) is good for **debate**, comparison, or "show me both sides." This is where you want it for research: a "skeptic" agent and a "supporter" agent arguing about a paper.
- **Thread-of-thought** (one stream, color-coded by speaker) is good for **handoff**. A researcher agent finishes, hands to a writer agent, the user sees the seam.

For research, the **dual-column "argue with yourself" view** is the high-leverage move. It is also the most fun to demo on a landing page.

### 6.4 Chat-vs-chat debates

- A debate UI with a **referee button** (user steps in to break ties) and a **synthesis button** (agent produces the final answer after the debate) is a research pattern with no good incumbent yet.
- Add a **citation requirement**: every claim in the debate must be cited. The referee can demand a citation before scoring a point.

---

## 7. Visual design for an "AI-native" app

### 7.1 The "Linear for AI" aesthetic

- **Linear**: monochrome with one accent (electric purple in the past, now a neutral gradient). Tight, geometric type (Inter Display). A 4px-radius everything. Dense, never cluttered. Status pills in muted colors.
- **Vercel**: black/white, Geist Sans + Geist Mono, the Vercel triangle as a brand mark. Tabs across the top, monospace for code, generous whitespace.
- **Claude.ai**: warm off-white, serif accents (Tiempos), cream and terracotta accents, very low contrast in the chrome so the model output pops. The most "literary" AI design.
- **ChatGPT**: more colorful, with a 3D blob hero, conversation cards in a grid on the home screen.
- **Gemini**: Material 3 with a colorful gradient overlay; sparkles everywhere; multicolor is the brand.
- **Perplexity**: stark white, sharp type, blue accent, search-bar-first, source list on the right.

**The throughline:** monochrome chrome, one accent color, generous whitespace, type that does the work.

### 7.2 Monospace type, code-flavored UI

Use a mono font (`JetBrains Mono`, `Geist Mono`, `IBM Plex Mono`) for:

- Tool names
- File paths
- Timestamps
- Source IDs (e.g., `[arxiv:2401.01234]`)
- Status codes, error codes
- Anything that came from a machine

A mono character signals "this is data, not prose" to the user, even if they can't articulate why. The cheapest way to look "technical" without looking like a CLI.

### 7.3 The Claude.ai / Vercel / Linear design vocab

- **Tokens:** `--bg`, `--fg`, `--muted`, `--accent`, `--border`. Resist adding more.
- **Type scale:** 12, 14, 16, 20, 24, 32. No more than 6 steps. Pair a humanist sans (Inter, Geist Sans) with a mono (Geist Mono, JetBrains Mono).
- **Radii:** pick 2 (`4px` for inputs, `8px` for cards). Square is fine and increasingly fashionable.
- **Borders:** 1px, low-contrast (`--border` should be ~5% darker than `--bg`).
- **Shadows:** avoid. Use a 1px border to separate.
- **Spacing:** 4px grid. Generous padding (24px) on cards, tight padding (8px) on rows.
- **Motion:** 150–200ms ease-out. No bounces. No parallax.

### 7.4 Color palettes that signal "AI work in progress"

- **Vercel:** `#000000` / `#FAFAFA` / `#0070F3` (electric blue, used only for primary actions and the "AI in progress" indicator).
- **Linear:** `#08090A` / `#FBFBFB` / `#5E6AD2` (indigo accent, very restrained).
- **Claude:** `#FAF9F5` (warm off-white) / `#1F1E1C` (warm near-black) / `#C96442` (terracotta) / `#A8B5A0` (sage) for status.
- **Cursor:** dark by default (`#1E1E1E` / `#282828` / `#7D7D7D`) with bright accent colors per agent.
- **Devin:** black and white with a single warm accent (`#FF7A00`-ish) for "agent is working."

**For a research product specifically:** a calm palette earns trust. A bright blue or violet on warm white, with one color reserved for the agent (e.g., violet), and another for the human (e.g., black). The contrast between the two is the visual story.

Reserve one color — call it `--agent` — for **agent-driven UI:**

- The agent's cursor
- The agent's edits (gutter color)
- The agent's chat rail
- The "thinking" dot

This is how you make the agent's presence legible without writing a word.

---

## 8. The WebMCP-specific UI requirements

This is where to over-invest. Most WebMCP submissions will hand-wave the tool surface; a strong one will treat it as a product.

### 8.1 The live tool array

- A UI panel that shows, in real time, the tools the current page has registered. Like DevTools' Network tab, but for tools.
- Each row shows: tool name, one-line description, schema (collapsed), a "Try it" button, and a "Last called" timestamp.
- Filter by: read-only / write / requires-confirmation / origin (this page / third-party / workspace).
- A green dot on tools the agent is currently using. A spinner on the tool currently in flight.

This panel is the **DevTools Network tab for agents.** Make it a feature.

### 8.2 The tool call log

- A vertical log, append-only, showing every tool call the agent has made in this session.
- Each row: timestamp (mono), tool name (mono), one-line description of what was asked, status (ok / err / pending), duration.
- Click to expand: full args, full result, copy buttons, a "re-run" button.
- Group by turn (one agent turn = one group) and by tool. Allow both views.
- A small badge on the row when the result was used to write to the document ("This call wrote 3 paragraphs").
- **Search** across the log. Research sessions will have 200+ calls; search is non-negotiable.
- **Export** the log as JSON, for users who want to audit or share.

### 8.3 "Agent is using `compare_claims` right now"

- The most important single UI moment: the human needs to know, in one glance, what the agent is doing.
- A small persistent status bar at the top of the right rail (or the bottom of the screen):
  - Agent avatar (or just a dot) · **"Using `compare_claims`"** · 2.3s · [pause] [take over]
- The bar should also show the **arguments** in a tiny inline pill: "comparing *Smith et al. 2024* with *Lee et al. 2023*."
- On hover, a popover with the full tool schema and a "Learn more" link to the page's docs (the page can register a `docs` resource alongside its tools).
- An **animated chevron** or progress bar (linear, not spinny) shows progress. Spinners read as "stuck." Progress bars read as "working."

### 8.4 Visual cues for read-only vs write tools

- Two visual classes:
  - **Read tools** (e.g., `read_paper`, `search_workspace`): neutral border, light icon, no confirmation needed. Free to call.
  - **Write tools** (e.g., `edit_notes`, `add_citation`): amber border, a "mutates document" icon, confirmation required for the first call, then per session.
- A **two-tone row** in the tool array: left half read, right half write. The eye reads the asymmetry immediately.
- For research specifically, mark **search tools** (network calls) in a third color (blue) so the user can see when the agent is going off-page.

### 8.5 Showing the untrusted content boundary

- The **most undersold** pattern in 2026. When the agent fetches a paper, the contents are untrusted input. The UI should make that boundary visible.
- A subtle banner at the top of any content block that came from outside the workspace: "This section was fetched from arxiv.org. The agent may have been influenced by it." A small icon (an open door, a paper plane) signals "external."
- When the agent cites a fetched claim, the citation chip has a slightly different style than a citation from a workspace document.
- A **"Sources of trust" panel:** a list of every source the agent has touched in this session, classified by trust level (workspace / signed / unsigned / fetched). The user can promote or demote any source's trust for the current session.
- This is the **prompt-injection-aware UI.** It will read as paranoid in 2025 and as professional in 2026.

### 8.6 Bonus: a "Tool Inspector" like Chrome DevTools

- A right-side panel that mirrors the agent's view of the page: the tool list, the registered resources, the recent calls.
- Toggleable like DevTools. Power users will live in it.
- Has a **"Replay last call"** button that re-runs the tool with the same args. A researcher's dream when debugging "why did the agent say X."

---

## 9. Landing page patterns

### 9.1 Modern AI product landing pages

A survey of what works in 2026:

- **Linear:** minimal hero, a 6-second looping product video, then a 3-column "What's new," then testimonials, then pricing. Almost no text.
- **Vercel:** black background, one sentence ("Develop. Preview. Ship."), a real-time deploy feed in the hero, then logos.
- **Cursor:** a full-bleed editor mockup as the hero, with a moving cursor typing AI code. No headline, the demo is the headline.
- **ElevenLabs:** a hero with three pillars and a clickable audio sample you can play without signing up. **The pattern:** every section has a live, no-signup demo.
- **Perplexity:** search bar in the hero, a sample answer pre-typed, "Try it" prominent.
- **Notion AI:** a feature wall with one-sentence value props and short looping GIFs.

### 9.2 Hero patterns that don't feel like SaaS slop

**What to avoid:**

- A stock photo of a diverse team high-fiving
- "Empower your team to do more with AI"
- A CTA above the fold with no demo
- A 6-bullet feature list

**What to do:**

- **One sentence, in plain language**, that names the specific thing the product does for a specific person.
- **A live or recorded demo** as the centerpiece. No signup.
- **One "see it work" moment** in the first scroll. For a research product: "paste a paper, watch the agent summarize, click a citation to verify."
- **A real human's face and name** in the founder section, with one paragraph of why they built it.
- **Numbers with a story:** "12 researchers use it to read 200 papers a week." Not "10,000 users."

### 9.3 The "see it work" pattern (live demo in the hero)

- **ElevenLabs** does this best: you can play audio on the landing page.
- **v0** has a "Try it" button that opens the actual product in a panel.
- **Perplexity** has a pre-typed query in the search bar.
- **Bolt** has a "Start a new project" button that opens the builder with a sample prompt.

For a WebMCP research product, the hero demo should be:

- A real research paper (a famous one, e.g., "Attention Is All You Need") on the left.
- The agent on the right, summarizing it in real time.
- Citations appearing as chips.
- The tool call log lighting up with `read_paper`, `search_workspace`, `compare_claims`.
- A user can click "Try with your own paper" without signup (paste a PDF or arXiv link).

**This is the single most important asset for the submission. Build it first.**

### 9.4 Founder story framing

The best 2026 AI landing pages have:

- A **first-person founder note** in plain prose, no marketing voice. "I built this because I spent 6 months reading 400 papers for my PhD and there wasn't a tool that didn't make me worse at it."
- A **specific use case** described in detail: "When I was writing the related-work section for my thesis, I wanted to see every paper that cited Smith 2023, summarize each in one sentence, and find the disagreements. No tool did this."
- A **small, sharp image** of the founder, ideally at a desk, with papers visible.

**The story is the moat.** The product has to be good, but the story is what makes 800 submissions distinguishable.

---

## 10. Synthesis: design principles for the WebMCP entry

Distilled into 10 rules:

1. **The agent is a coworker, not a chatbot.** Give it a permanent rail, a status, and a take-over button.
2. **Every tool call is a first-class object.** Logged, searchable, replayable, diffable.
3. **Citations are chips, links, and a bibliography.** Not footnotes. Not a "Sources" section the user has to scroll to.
4. **Confidence is per-claim, not per-message.** And it is honest or it's a lie.
5. **"I don't know" is a feature.** Visible, calm, and actionable.
6. **The untrusted content boundary is drawn in the UI.** A line, a banner, a different chip color. The user always knows what came from where.
7. **The plan is the layout.** Make the research process legible; the paper is a byproduct.
8. **Confirm at the highest reversible level.** Plans, not tool calls. Tools, not every prompt.
9. **Time-travel is a first-class verb.** Rewind, branch, replay, diff two runs.
10. **Mono is data. Sans is prose.** Use them accordingly, and the design reads as "for researchers" without saying so.
