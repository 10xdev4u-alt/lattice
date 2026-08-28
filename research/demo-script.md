# Lattice demo video — 3-minute script

> Total runtime: 2:55. Audio required. Record with OBS or ScreenFlow.
> Use a USB mic, not the laptop mic. Captions auto-generated, then
> hand-corrected.

## Scene 1 — Setup (0:00–0:20)

**Visual:** Lattice landing page. Click "Open the demo."

**Voice-over:**
"Lattice is a research-paper workspace where the page itself is the audit log.
Fourteen typed tools, not a chat box."

**Action:** The empty state appears. Click "Load sample library."

## Scene 2 — Search & compare (0:20–0:50)

**Visual:** The three-rail workspace appears. The right rail shows the
Live Tool Array with 9 tools.

**Voice-over:**
"Five well-known papers load. The agent now has access to nine
read and write tools, all visible here in the Live Tool Array. Every
tool the agent can call is right there, no hidden surface."

**Action:** Type in the agent input: "What do Attention Is All You
Need and BERT disagree about?"

**Voice-over:**
"Watch the right rail. The agent calls list_papers, then
search_library, then compare_claims. The audit log fills in."

## Scene 3 — Challenge a claim (0:50–1:20)

**Visual:** The chat shows the agent's response with a citations chip.

**Voice-over:**
"The agent drafts a claim. The citation chip links to the source
paper. But the user can challenge it."

**Action:** Click the small "challenge" button on the claim.

**Voice-over:**
"The agent re-runs the analysis, defending or retracting."

## Scene 4 — Add to bibliography (1:20–1:50)

**Visual:** The agent now wants to add a paper to the export list.

**Voice-over:**
"When the agent wants to mutate state — like adding a paper to the
export list — the user clicks first. This is the WebMCP secure-
tools pattern. Read tools are free; write tools require consent."

**Action:** Confirmation modal appears. Click "Allow for this session."

**Action:** Click "Export bibliography as CSL-JSON."

**Voice-over:**
"The export downloads a file the user can drag into Zotero. Round-
trips cleanly through every reference manager."

## Scene 5 — Show my work (1:50–2:20)

**Visual:** Click the "Log" tab in the right rail.

**Voice-over:**
"This is the killer feature. Every tool call the agent has made
is here, with timestamp, args, result, and duration. Click any
step. See the full args, the full result. Export the whole trail
as a Markdown methods appendix the user can drop into a paper."

**Action:** Click "Export as methods appendix." The file downloads.

**Voice-over:**
"The page IS the audit log. The user can show their committee
exactly how the agent got from question to claim."

## Scene 6 — Cross-agent peer review (2:20–2:50)

**Visual:** Type: "Invite the peer-reviewer." The agent calls
peer_review_invite. A violet banner appears above the agent rail.

**Voice-over:**
"The cross-agent demo. A second agent — the skeptic — joins the
page. Every claim the primary agent makes, the skeptic challenges."

**Action:** Type: "Compose a peer review of Attention Is All You
Need." The agent calls compose_review. The skeptic persona
responds in violet.

**Voice-over:**
"The user watches two agents negotiate. The user is the editor."

## Scene 7 — End card (2:50–3:00)

**Visual:** Fade to the Lattice landing page.

**Voice-over:**
"Lattice. Research papers, in conversation. Open source. Apache
2.0. WebMCP Challenge, 2026."

**End card text:** Lattice · 10xdev4u-alt + the-ai-developer ·
github.com/10xdev4u-alt/lattice
