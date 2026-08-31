# Lattice demo video — 3-minute script

> Total runtime: 2:50. Audio required. Record with OBS or ScreenFlow.
> Use a USB mic, not the laptop mic. Captions auto-generated, then
> hand-corrected.
>
> Before recording: load the sample library once so the ingests are
> warm, then reload the page so the video starts from the empty
> state. The container should be running at localhost:8888.

## Scene 1 — The claim (0:00–0:15)

**Visual:** The workspace on the empty state. Fraunces headline:
"Bring a paper. Watch every claim become traceable."

**Voice-over:**
"Every AI demo asks you to trust the agent. Lattice asks the
opposite: prove it. This is a research workspace where the page
itself is the audit log — and it can prove its own compliance."

**Action:** Press Cmd+K, type "self-audit", Enter. Click
"Run the checks."

## Scene 2 — The self-audit (0:15–0:45)

**Visual:** The audit panel streams nine checks, each flipping to
verdigris as it resolves: modelContext present, the three API
methods, toolchange firing, tool budgets, a live executeTool
round-trip, the isolation headers read off this origin,
untrustedContentHint on every content tool, abort scoping,
exposedTo filtering.

**Voice-over:**
"Nine live probes against this page's actual WebMCP surface. Not a
checklist we wrote — checks that run right now. Register a probe
tool: toolchange fires. Abort its signal: it unregisters. Ask
where the tools permissions policy is: the page reads its own
headers. Nine passing. This is what compliance looks like when
it's code, not a slide."

**Action:** Let all nine resolve. Hover one row so its probe note
is visible for a beat.

## Scene 3 — The workspace (0:45–1:10)

**Visual:** Close the audit. The empty state. Click "Load 5 classic
papers." The three rails fill: library left, the Transformer paper
center in the reading voice, agent right.

**Voice-over:**
"Five papers load — their full text fetched, extracted, and
indexed server-side. The reading surface follows the agent: when
it opens a paper, yours opens too."

**Action:** In the chat type: "Compare Attention Is All You Need
with BERT on attention."

## Scene 4 — The red thread (1:10–1:45)

**Visual:** The agent streams a reply in violet. Tool chips appear
inline. The Log tab count climbs.

**Voice-over:**
"Every tool call lands in the trail as a numbered entry on a red
spine — the thread of the argument. Expand a step: the exact
arguments, the exact result, the duration. Press Re-run and the
same call executes again, appended — same input, fresh result.
The log grows honestly. It never rewrites."

**Action:** Open the Log tab. Expand one step. Click Re-run.
Watch the new entry appear.

## Scene 5 — Challenge (1:45–2:15)

**Visual:** The peer-reviewer banner. Click "Invite
peer-reviewer." The skeptic's challenge arrives.

**Voice-over:**
"Invite a second agent and it challenges the first — a skeptic
with its own persona, exposed to exactly this tool surface. Two
agents, one page, and the human holds the pen. Every write tool
still asks permission first."

**Action:** Ask the chat to add the paper to the bibliography. The
confirmation modal appears. Click Allow.

## Scene 6 — Export (2:15–2:50)

**Visual:** The trail exports as a methods appendix — markdown,
structured, citable.

**Voice-over:**
"Finally: export the trail. Every claim, traced to a paper, a
page, a sentence — the methods appendix for your thesis, written
by the work itself. Lattice: research papers, in conversation —
and in evidence. Nine checks passing."

**Action:** Open the Log tab, click "Export as methods appendix."
Show the downloaded document for the last beat.

---

## Cut-list (if you need to trim to 2:00)

- Cut Scene 3's typing beat (keep the narration).
- Trim Scene 5 to the invite + one challenge line.

## Recording notes

- 1440x900, dark theme (default) — the warm ink reads better on
  video than the light paper.
- Slow your cursor. Hover before clicking; the hover states are
  part of the story.
- The LLM is a free tier — if a call stalls, wait; the retry
  banner is honest and quick.
