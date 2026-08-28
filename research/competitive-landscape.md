# WebMCP Challenge — Competitive Landscape

> Compiled 2026-08-28. Sourced from the official Netlify demos, the ChromeLabs repo, the webmcp.com live directory, and the adjacent research-tool ecosystem.

---

## 0. TL;DR

- Commerce is dead. A 10-tool Shopify clone scores 3/10.
- The official demos set the tool-design bar. snake_case, schema descriptions, annotations, edge validation, fallback — non-negotiable.
- The official demos set the transparency bar. Hidden tools will be docked.
- The ChromeLabs repo sets the architecture bar. `page-agent`, `analytics-dashboard`, `smart-home` are the three design ideas most submissions will miss.
- **Research is wide open.** `scholar-sidekick.com` is the only existing scholarly site. Elicit, Consensus, Scite are *backends*. Nobody has built a *workspace* for the researcher.
- The winning pitch: **workspace + audit trail + composition**. Don't compete with Elicit (search) or Scholar Sidekick (cite). Compete by giving the researcher a page they live in where every agent action is a typed, auditable, reversible, shareable tool call.

---

## 1. The five official Netlify demos

### 1.1 webmcp-starter (the "blank canvas")

- **URL:** https://webmcp-starter.netlify.app/
- **Category:** Personal site / link hub / guestbook
- **Tools (3):** `get_profile` (read), `search_links` (read/search), `leave_message` (write)
- **Does well:**
  - **Self-documenting artifact.** Page slices its own `webmcp.js` source by `//#region` markers, so docs cannot drift from code.
  - **One source of truth.** `profile.json` powers both UI and tool responses.
  - **Exemplary tool design:** snake_case verb_noun, `inputSchema` always required, per-property descriptions, `readOnlyHint: true` on reads, server-side validation ("a tool declaration is a hint to a cooperative agent, never a security boundary"), `AbortController` registration, custom event `webmcp:messages-changed` for UI re-render.
  - **Two prompts (scratch + extend)** both require the agent to list existing capabilities before writing tools.
  - **Progressive enhancement:** status line honestly reports when `document.modelContext` is absent.
- **Does poorly:** No auth on `leave_message`; relies on Chrome 149+ flag; `search_links` is keyword-only by convention, not enforcement.
- **Judge would note:** **Gold standard for tool design.** Every submission is implicitly measured against this.

### 1.2 webmcp-kurio (commerce)

- **URL:** https://webmcp-kurio.netlify.app/
- **Category:** Agentic commerce marketplace (fictional products)
- **Tools:** `search_products`, `add_to_cart`, `view_cart`, `checkout`, "+ 6 more" (10 total, 6 hidden)
- **Does well:** Minimal scope, visible cart updates, floating status pill, 3-step onboarding.
- **Does poorly:** **Hides 6 of 10 tool names behind "+ 6 more"** — agents and judges cannot assess the surface.
- **Judge would note:** Hidden-tools design hurts discoverability. Good visual feedback, weak transparency.

### 1.3 webmcp-tagboard (community / write surface)

- **URL:** https://webmcp-tagboard.netlify.app/
- **Category:** Public guestbook with edge-validated writes + AI moderation
- **Tools (7):** `list_tags`, `read_notes`, `search_notes`, `add_note`, `open_tag`, `board_stats`, `get_webmcp_setup_prompt`
- **Does well:**
  - **Tool design transparency is the headline.** Annotations honest (`untrustedContentHint: true` on user-text returns), schemas require `description` on every property, `enum` for closed sets, `execute` returns prose strings.
  - **Edge layer enforces limits before any model call** — invalid JSON rejected at CDN, salt-fingerprinted IP+UA, rolling-window Blobs budget, moderation fails closed and refunds budget.
  - **HTTP fallback at `/api/tools`** for non-browser agents.
  - Live AI-moderation log shown to the user.
- **Does poorly:** 400-char cap is tight for agent-generated summaries; seed data can look indistinguishable from live data in the moderation view.
- **Judge would note:** **Best write-side demo.** Establishes the "edge guardrails before model spend" pattern.

### 1.4 webmcp-mabels-table (booking)

- **URL:** https://webmcp-mabels-table.netlify.app/
- **Category:** Fictional bistro reservation
- **Tools:** `mabel_check_availability` is the only one shown in code; 6 total claimed (hold / confirm / look up / cancel / reschedule + availability). JSON Schema with `minimum`/`maximum`, 21-day window.
- **Does well:** Hold-then-confirm flow prevents overbooking. Fictional-restaurant framing makes the spec legible. Copy-paste starter prompts lower activation to zero.
- **Does poorly:** **Only 1 of 6 tools is visible in code**; others are named in prose only. No timezone handling. No auth/rate-limit guidance.
- **Judge would note:** Good story, weak transparency. Mirrors Kurio's "trust me, the rest is there" pattern.

### 1.5 webmcp-archive (gamified)

- **URL:** https://webmcp-archive.netlify.app/
- **Category:** Noir detective mystery / 192-A case
- **Tools (4 shown, 5 advertised):** `search_archive_records`, `lookup_manifest`, `decode_document`, `query_timeline`
- **Does well:** Fiction makes tool-call mechanics memorable. Split-screen (passive evidence / active agent console). "Copy Agent Prompt" + "Agent / Fallback Mode" so non-LLM visitors can play. Domain-flavored tools.
- **Does poorly:** **Page advertises 5 tools but only 4 are named** (mismatch). Evidence is read-only HTML. "0 EVENTS" / log area has no success-state guidance. Fallback console is hollow.
- **Judge would note:** Most "show, don't tell" of the five, but human-agent coupling is loose. The 4-vs-5 mismatch will be the first thing a critical judge flags.

**Pattern across the five official demos:**

1. Tool-design patterns are codified: snake_case, schema descriptions, annotations, `AbortController`, edge validation.
2. Hiding tool counts is treated as a stylistic choice in some but penalizes you in others — the starter and tagboard are the most honest.
3. **No demo leads with multi-agent orchestration, no demo does PII-safe handling, no demo shows cost/latency budgets** — these are explicit white space.

---

## 2. The ChromeLabs demos (15 in `GoogleChromeLabs/webmcp-tools`)

Plus the shared polyfill, `webmcp-evals` CLI, and `Model Context Tool Inspector` Chrome extension (submodule by beaufortfrancois). The repo has 521 stars, 96 forks, 634 commits — *the* reference repo.

| # | Demo | Industry | Approach | Tools | Novel? |
|---|---|---|---|---:|---|
| 1 | **analytics-dashboard** | Dev tools / observability | Imperative (React + Vite) | 1 (one atomic query tool w/ 7 params) | Medium — "one tool, many filters" is a real design choice |
| 2 | **coffee-shop** ("The Morning Ritual") | Food/beverage | Imperative, multi-page | 4 | No |
| 3 | **doors** ("Mystery Doors") | Game / multi-page | Both | 8 (across 4 pages) | Medium |
| 4 | **explainer** | Docs / education | Static, side-by-side | Booking + shim | High — canonical "scraping vs. tools" teaching artifact |
| 5 | **french-bistro** ("Le Petit Bistro") | Restaurant | Declarative (HTML form) | 1 | No |
| 6 | **hotel-chain** ("L'Atelier Hotel") | Travel/hospitality | Both | 6 | No |
| 7 | **leather-bag** ("Luxe Leather") | E-commerce (Angular) | Both | 7 | No |
| 8 | **order-tracking** | E-commerce returns | Declarative | 2 | No |
| 9 | **page-agent** | Meta / Gemini-powered | Imperative | 2 core + 1 experimental (getTools, executeTool, execute_batch w/ `$ref:stepId` deps) | **Very high** — meta-demo, "code mode," batched dependent steps, sub-agent delegation across an iframe |
| 10 | **pizza-maker** ("zaMaker!") | Food/ordering | Imperative | ~6 | No |
| 11 | **react-flightsearch** | Travel (React) | Imperative | 4 | No |
| 12 | **real-estate-map** ("UrbanEstates") | Real estate | Imperative | 3 | No |
| 13 | **smart-home** | IoT / dashboard (React) | Imperative | 1 (with 10 widget IDs embedded) | Medium |
| 14 | **sport-shop-angular** | E-commerce/sports (Angular) | Both | 13 | No |
| 15 | **ticket-booking** ("CineFlow") | Entertainment/movies | Imperative | 1 | No |
| — | **webmcp-maze** | Game | Imperative | 6 + 1 debug | Medium |

**Most ambitious in the repo:** `page-agent` (meta-demo with batched dependent steps) and `sport-shop-angular` (13 tools). **Most novel:** `page-agent`, `explainer`, `smart-home`, `analytics-dashboard`, `maze`. **Rest are category exercises.**

**Industry mix:** Travel (3), food/restaurant (4), retail/leisure (5), real estate (1), home/IoT (1), games (2), docs (1), meta (1), analytics (1). **Zero research, healthcare, education, finance, civic, accessibility, or developer-productivity demos in the repo.**

---

## 3. The webmcp.com live directory

**Total: 365 verified sites.** Eight verticals. The 4 most-ambitious by tool count are not in commerce:

| Rank | Site | Tools | Vertical | Why it's interesting |
|---:|---|---:|---|---|
| 1 | hunchbank.com | 51 | AI & Agents | "Turns every form on a site into a tool" — auto-generated tool surface |
| 2 | persona-chat.dev | 42 | Developer Tools | Open-source AI chat widget |
| 3 | birmakine.com | 31 | Commerce | Turkish industrial machinery marketplace |
| 4 | vaanzari.com | 31 | Commerce | Handcrafted Banarasi sarees |
| 5 | demos.telerik.com | 30 | Developer Tools | Blazor UI grid/spreadsheet/map |
| 6 | webroom.openai.chatgpt.site | 28 | Media & Personal | Photo editor w/ agent-ready controls |
| 7 | demo.openforagents.com | 27 | AI & Agents | Commerce + custom "buddy" configurator |
| 8 | bandarra.me | 27 | Developer Tools | Text editor with sub-agent delegation |
| 9 | fieldwork-beat-machine.openai.chatgpt.site | 26 | Media & Personal | 12-voice beat machine |
| 10 | admintoolkit.io | 24 | Developer Tools | DNS / mail / TLS / HTTP admin checks |

**Vertical saturation:**

| Vertical | Count | Saturation | Notes |
|---|---:|---|---|
| Commerce | ~120+ | **Extreme** | 25+ sites use the same 10-tool template (Alo Yoga, Reebok, Allbirds, Brooklinen, Netgear, Away, Ascent Protein, Press Coffee) |
| AI & Agents | ~30+ | High | Most are wrapper sites / directories |
| Developer Tools | ~40+ | High | Many of these are the directory's own inhabitants |
| Media & Personal | ~50+ | High | Lots of personal portfolios |
| Finance & Crypto | ~15 | Medium | Stock/crypto charting, comparison, mortgage; **no tax, no budgeting, no wealth, no accounting for SMBs** |
| Travel & Events | ~15 | Medium | Events, hotels, transport — saturated on "find me an event in city X" |
| Health & Education | ~8 | Low | Telehealth, certificates, language, kid's coding, **therapy resources, ONE citation tool** |
| Productivity & Business | ~30+ | Medium-High | CRM, docs, job boards, project mgmt |

**The single existing research-adjacent entry in the directory is `scholar-sidekick.com` (7 tools)** — citation formatting for DOI/PMID/ISBN/arXiv, retraction checks, open-access checks, AI-reference verification. **No other directory entry is scholarly. No demo in `GoogleChromeLabs/webmcp-tools` is scholarly.**

---

## 4. What other teams are likely to submit

**Bulk categories (70%+ of submissions):**
1. **More commerce.** Another 10-tool Shopify-style store. Boring, but the path of least resistance.
2. **Travel + booking.** Hotel, flight, restaurant, spa, salon, gym, doctor.
3. **"AI wrapper" pages** that just expose a chat with a few search tools.
4. **Game demos.** Maze, blackjack, word puzzles, chess.
5. **Personal portfolio + guestbook.** Clone of the starter.
6. **Educational demos for kids** (coding, language).
7. **Crypto / stock charting.** Coinranking / Longbridge clones.

**"Obvious" picks (saturated, low judge interest):**
- Shopping cart + checkout (Kurio)
- Restaurant booking (Mabel's Table)
- Pizza builder (pizza-maker)
- Movie tickets (ticket-booking)
- Flight search (react-flightsearch)
- Hotel booking (hotel-chain)
- Coffee subscription (coffee-shop)
- Generic guestbook / tagboard (tagboard)
- E-commerce returns (order-tracking)
- Real estate filters (real-estate-map)

**"Clever" picks (already partially taken, still possible to differentiate):**
- IoT / smart-home control (only 1 tool — wide open for depth)
- Dashboard / observability (only 1 tool — could add alerts, anomalies, multi-tenant)
- Detective / gamified narrative (loose human-agent coupling)
- Sub-agent delegation / "page-agent" composition (only 1 demo does this)
- Diagram/drawing tools (Excalidraw integration exists but it's a wrapper)

**Genuinely novel (no demo does this well):**
- **Anything where trust, sourcing, and citation matter** (research, journalism, legal, policy, healthcare)
- **Anything that handles PII, regulated data, or auth properly**
- **Anything that composes multiple WebMCP sites into a single workflow**
- **Anything that uses WebMCP for *accessibility* — making an existing site work for blind/deaf/motor-impaired users via agent proxy**
- **Anything that exposes a *dataset* with provenance, not just a storefront**
- **Anything that gives WebMCP a *temporal* axis** — history, diff, undo, replay, observability
- **Anything that costs money to call** (paid tools, metering, rate limits at the tool level)
- **Anything that's offline-first or works in hostile networks**

---

## 5. Specific novelty gaps

### 5.1 Vertical gaps

- **Academic / research** — virtually empty (only Scholar Sidekick). No literature-review tool, no citation graph, no PRISMA workflow, no replication checker, no dataset explorer with provenance.
- **Healthcare (non-therapy)** — `cuvo.co` and `emorahealth.com` exist as patient intake. No EHR integration, no clinical decision support, no lab results, no imaging, no clinical-trial enrollment.
- **Civic / government** — basically empty. No voter-registration tool, no permit lookup, no 311, no FOIA tracker, no public-comment on regulations.
- **Legal** — `Lawstronaut` is on MCP.so but not on webmcp.com. No case-law search, no small-claims helper, no eviction/landlord-tenant assistant.
- **Education (adult / higher-ed)** — `aicertificates.study` and `codaquest.com` are kids. No course discovery, no syllabus reader, no transcript tool, no peer-review assistant, no grant-writing tool, no IRB helper.
- **Journalism** — no FOI tool, no public-records search, no source-tracking, no correction workflow.
- **Nonprofit / fundraising** — no donor CRM, no grant tracker.
- **Accessibility** — no "agent proxy" for screen-reader, no motor-impaired click-by-voice wrapper.
- **Climate / environment** — no energy-bill analyzer, no carbon-footprint tool, no municipal-data lookup.
- **Insurance** — empty.
- **Real estate beyond map filter** — empty (mortgage comparison, lease review, listing quality scoring).

### 5.2 Technical gaps

- No demo uses WebMCP for offline / cached / local-first state. Everything is server-backed.
- No demo shows streaming / chunked tool returns. All returns are atomic.
- No demo exposes tools that cost money per call (no Stripe / metering / pay-per-tool).
- No demo handles multi-tab / multi-agent coordination. Tools assume one agent.
- No demo exposes a sampling or elicitation surface — only `tools`, `prompts`, `resources`.
- No demo handles file uploads / blobs through tools.
- No demo exposes WebSocket / SSE / push updates from tool to agent.
- No demo demonstrates `resources` (the third MCP primitive alongside tools and prompts).
- No demo shows graceful degradation when a tool is rate-limited or slow.
- No demo does cross-origin tool composition (calling tools on Site A from Site B).
- No demo shows tool deprecation / versioning.

### 5.3 UX gaps

- No demo shows the agent thinking in the UI (drafting a plan, asking for confirmation before destructive tools).
- No demo shows cost / latency / confidence per tool call in the user-facing UI.
- No demo lets the human override or undo an agent's tool call.
- No demo surfaces a "what did the agent just do?" audit log in plain English.
- No demo pairs a "fallback" mode with real fallback UX.
- No demo shows how a tool returns a long response (PDF, image, video) cleanly.
- No demo shows the agent negotiating with the human (e.g., "Friday 7pm is full, want Saturday 6pm?").

### 5.4 Tool-design gaps

- No demo shows `outputSchema` (return-value schemas) — they're all duck-typed.
- No demo uses `examples` in `inputSchema` to disambiguate.
- No demo uses `title` (the human-friendly name) vs `name` (the machine name).
- No demo uses `destructiveHint: true` or `openWorldHint: true` / `idempotentHint: true`.
- No demo returns structured errors (most throw strings).
- No demo shows `progress` reporting for long-running tools.
- No demo uses `annotations` beyond `readOnlyHint`.
- No demo uses `icons` on tools (newer MCP feature).
- No demo uses the `Mcp-Session-Id` / resumability pattern.

---

## 6. The "10/10" criteria

The closest comparable prior OpenAI hackathon (**Build Week**, Jul 13–21, 2026) judged on four explicit criteria:

> **Technological Implementation · Design · Potential Impact · Quality of the Idea**

WebMCP Challenge is **highly likely** to follow the same four-axis rubric.

**What 10/10 looks like on each:**

- **Technological Implementation:** Current API (`document.modelContext` with `navigator.modelContext` fallback), no deprecated patterns, `AbortController` cleanup, edge validation, proper `inputSchema` with descriptions, sensible `outputSchema`, structured errors, annotations used honestly, no parallel agent API, observable tool calls, works without the flag.
- **Design:** The UI teaches the agent. Status pill is honest. Tool execution is visible. "What did the agent do?" is legible. Accessibility (keyboard, screen reader, color contrast). Loading / empty / error states. Friction where it should exist (hold-then-confirm, irreversible confirmations).
- **Potential Impact:** Solves a real problem for a real user. Vertical that matters (research, healthcare, civic, accessibility) beats vertical that's fun (pizza). Repeatable. Agent surface that other agents would *want* to call.
- **Quality of the Idea:** If you removed WebMCP from the design, it wouldn't work. The best demos would lose their entire point without the agent.

**Mistakes that will knock out most submissions:**

1. Building a storefront. 200+ already exist. Even a "well-built storefront" scores low.
2. Hiding tools behind "+ 6 more" or "ask the agent" — judges will dock transparency.
3. Misnumbering tools (Archive's "5 tools, 4 shown" issue).
4. Building a tool with no real return value.
5. Falling back on deprecated APIs (`provideContext`, `clearContext`, `unregisterTool`, `navigator.modelContext` without the `.document.` fallback).
6. No fallback for non-Chrome browsers.
7. No demo / no video / no README.
8. Agent-only with no human UI.
9. Cheap slide of "our tools" without the schemas.
10. "We used WebMCP" but the tools are just thin wrappers around REST endpoints.

**The "vibe" after 800 submissions in a week:**

By hour three, a judge has seen every possible pizza maker. By hour six, every possible booking. After day two, every possible shopping cart. **The 10/10 demos are the ones where the judge stops scrolling and re-reads the README.** The novelty gap isn't "no one has built X" — it's "no one has built X with the care of a spec-aware engineer who also cares about humans."

A judge who's been judging all week is not looking for the best WebMCP demo. **They are looking for the best demo of what the agentic web should feel like.** That means: legible, safe, fast, honest about failure, honest about cost, and solving a problem that a person actually has.

---

## 7. The research / academic angle

### 7.1 Who has done research-with-WebMCP?

**One site:** `scholar-sidekick.com` (7 tools). It formats citations from DOI / PMID / ISBN / arXiv / ADS bibcode, checks retractions (Crossref + Retraction Watch), checks open access (Unpaywall), batch-verifies AI-generated references. It exposes:

- A REST API
- An open-source MCP server (HTTP)
- Discovery endpoints: `/.well-known/mcp/server-card.json`, `/llms.txt`, `/llms-full.txt`, `/AGENTS.md`, `/openapi.yaml`
- 13 free web tools behind one `scholar` MCP tool
- Tiered API pricing (BASIC 500/mo free → MEGA 500k/$199)

**No other WebMCP site in the directory is scholarly.** None of the 15 ChromeLabs demos is scholarly. None of the 5 official Netlify demos is scholarly. **The gap is wide open.**

### 7.2 Adjacent research-agent ecosystems (their tool surface)

| Tool | Surface | MCP? | What it exposes |
|---|---|---|---|
| **Elicit** | 138M+ papers, ClinicalTrials.gov | **Yes** | 8 MCP tools: `search_papers`, `search_trials`, `create_report`, `get_report`, `create_systematic_review`, `get_systematic_review`, `list_sessions`, `resume_session`. Plus a public API. |
| **Consensus** | 200M+ peer-reviewed papers | **Yes** (remote MCP at `https://mcp.consensus.app/mcp`, OAuth, Streamable HTTP) | `search` returns titles, authors, abstracts, citation counts, journal-quality scores, URLs |
| **Scite** | 1.2B+ citation statements, "smart citations" | No public MCP | Web app + paid API |
| **Litmaps, Connected Papers, Research Rabbit** | Visualization | No | None confirmed as MCP |
| **Semantic Scholar API** | 200M+ papers | No (GraphQL/REST) | Free tier, paid tier |
| **OpenAlex** | 240M+ works | No | Free API, open data |
| **PubMed / NCBI** | 36M+ citations | No public MCP | E-utilities API |
| **arXiv** | 2.4M+ preprints | No | OAI-PMH, RSS |

**All three major research tools are *MCP servers* — but none of them is a *WebMCP site* in a browser.** That's the entire opportunity: **Elicit, Consensus, Scite are agent backends. Nobody has built the agent *front end* — a workspace the human lives in.**

### 7.3 What makes a research-paper workspace unique

The thesis is straightforward: a research workflow is not one tool, it's a *graph* of stateful operations across documents, citations, claims, evidence, and notes. WebMCP gives the agent a *single typed surface* on a workspace page — exactly what researchers need.

**Sub-angles that are *taken* (don't pitch these):**
- Citation formatting (Scholar Sidekick has it)
- Retraction check (Scholar Sidekick has it)
- AI-reference verification (Scholar Sidekick has it)
- Raw paper search (Elicit/Consensus/Semantic Scholar do it)
- Literature-review generation (Elicit does it)

**Sub-angles that are *open* (and that WebMCP uniquely enables):**
1. **The "PRISMA in a browser" workflow** — define inclusion/exclusion criteria as tools, screen papers with the agent, capture the audit trail, export the flow diagram. Currently a Google Sheet.
2. **A claim-evidence graph editor** — paste a paragraph, mark claims, link each claim to a paper, see the matrix. The agent does the linking. Currently Notion.
3. **A replication-checker workspace** — given a finding, the agent finds 3 attempted replications, scores them, produces a "claim confidence" badge. **No one does this as an agent surface.**
4. **A methods-critique workspace** — for a given paper, the agent pulls the methods section, cross-references the cited methodology, flags missing details, ambiguous statistics, undisclosed conflicts. **Highly novel.**
5. **A pre-registration / OSF-style workflow** — write the hypothesis, the agent finds the closest prior work, flags whether the hypothesis is registered. **No one does this in a browser.**
6. **A grant / proposal workspace** — given a 1-paragraph aim, the agent finds 5 closest funded projects (NIH RePORTER, Dimensions), scores novelty, drafts a specific-aims page. **Unique.**
7. **A literature-table-by-extraction workspace** — given 20 PDFs, extract a unified comparison table.
8. **A "second opinion" tool** — paste an abstract, the agent finds contradicting papers, reports the effect-size distribution, and gives a confidence score.
9. **A protocol-for-sharing workspace** — generate a sharable URL where another agent (or human) can pick up where the first one left off.
10. **A lab-notebook / ELN with WebMCP** — `add_observation`, `link_to_protocol`, `query_last_n_experiments`, `find_anomalies` — the smart-home demo, but for a lab.

**The single best angle:** **PRISMA flow as a workspace where the human and the agent *co-author* the systematic review and the page IS the audit log** — every tool call becomes a node in a published flowchart.

---

## 8. Names, dates, contacts

### 8.1 Judges

Seven confirmed. Backgrounds:

- **Ilya Grigorik** — Web performance engineer, author of *High Performance Browser Networking*, long-time Chrome/web platform lead, editor of web.dev. Cares about: current spec adherence, no deprecated APIs, edge validation, observability of the tool surface, browser-correctness.
- **Sarah Drasner** — Designer, author, former VP Design at Netlify. Cares about: legible UI, accessibility, animation that means something, the human side of agent actions, the fallback experience.
- **Sean Roberts** — Author of the Netlify blog post *"MCP goes stateless and extensible"* (Jul 28, 2026). Cares about: protocol correctness, statelessness, extensibility, server-side validation patterns. **A demo that does a clever MCP extension (e.g., sampling, elicitation, resources) will land with him.**
- **Andrew Galloni** — Netlify. Evaluates: deployability, Netlify-native patterns (Functions, Blobs, Edge), `netlify.toml` hygiene, deploy-and-prove-it execution.
- **Alex Nahas, Justin Rushing, Jude Gao** — OpenAI side. Evaluate: agent ergonomics, integration with ChatGPT's in-app browser, real user value, demo clarity, prompt portability.

### 8.2 Public talks / quotes

- Sean Roberts has the "MCP goes stateless and extensible" blog post (Jul 28, 2026) — the **single most relevant public artifact on what the MCP side of WebMCP should look like for the challenge**. Read it.
- Sarah Drasner and Ilya Grigorik have decades of public writing — but no specific public statements about WebMCP found.
- The other three judges have no public WebMCP-specific statements located.

### 8.3 Devpost submission system

- The Netlify blog post (Aug 25, 2026) is "Compete in OpenAI's WebMCP Challenge with Netlify" by Karthik Puvvada. The Devpost page itself is not yet publicly indexable in search results as of 2026-08-28.
- The most recent comparable OpenAI Devpost event was **OpenAI Build Week** (Jul 13–21, 2026, $100K prize, 46,724 participants), judged on: **Technological Implementation, Design, Potential Impact, Quality of the Idea.** Tracks: Apps for Your Life, Work and Productivity, Developer Tools, Education.
- Devpost's submission system typically requires: a public URL (the live demo), a 1–2 min video walkthrough, a text description, team info, and a GitHub repo. The Devpost plugin runs inside ChatGPT for Build Week — this is probably also true for the WebMCP Challenge.

### 8.4 What to do *today*

1. Read Sean Roberts' "MCP goes stateless and extensible" (Netlify blog, Jul 28, 2026) in full.
2. Read the `webmcp-starter` source — it's the tool-design benchmark.
3. Read `page-agent` and `bandarra.me` — they represent the high bar on tool design.
4. Clone the Elicit MCP server (`elicit/api-examples`) and the Consensus MCP server — know exactly what tools research agents already have so you don't compete with them; you *compose* with them.
5. Open `scholar-sidekick.com` and read every tool — your submission must clearly exceed this in the *workspace* dimension (Scholar Sidekick is API-shaped; you should be workspace-shaped).

---

## 9. TL;DR — the strategic read

1. **Commerce is dead.** A 10-tool Shopify clone scores a 3/10.
2. **The official demos set the tool-design bar.** snake_case, schema descriptions, annotations, edge validation, fallback — non-negotiable.
3. **The official demos set the transparency bar.** Hidden tools will be docked.
4. **The ChromeLabs repo sets the architecture bar.** `page-agent` (meta-agent), `analytics-dashboard` (one expressive tool), and `smart-home` (widget composition) are the three design ideas most submissions will miss.
5. **Research is open.** `scholar-sidekick.com` is the only existing site; Elicit/Consensus are backends; nobody has built a research workspace as a WebMCP site.
6. **The winning pitch is workspace + audit trail + composition.** Don't compete with Elicit (search) or Scholar Sidekick (cite). Compete by giving the researcher a page they live in where every agent action is a typed, auditable, reversible, shareable tool call.
7. **The single highest-leverage idea:** *PRISMA in a browser*, where the systematic review's flow diagram is generated from the tool-call log, and the workspace is the audit trail. **That page is what the next 10 years of research workflow looks like — and nobody is building it for WebMCP.**
