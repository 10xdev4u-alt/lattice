# UI Redesign — the research synthesis

> What was researched: Rauno Freiberg's "Invisible Details of
> Interaction Design" (rauno.me/craft/interaction-design),
> Nielsen's response-time thresholds (via the interaction-design
> reference), assistant-ui (12k stars — the production-grade
> agent chat library), Vercel's ai-chatbot (21k stars), and the
> agent-UI pattern survey in agent-ui-patterns.md. This document
> is the design direction those sources dictate, written before
> implementation so the code follows the research.

---

## 1. What the research says (and the source for each)

**Rauno Freiberg — Invisible Details of Interaction Design**

- **Frequency vs. novelty.** High-frequency actions deserve *no*
  motion. Command menus, context menus, app switchers appear
  instantly — animating them becomes cognitive burden by the
  hundredth use. Reserve animation for novelty and for state
  transitions that need explanation. (His bmrks.com story:
  animating the active indicator felt great for two days, then
  felt sluggish; removing motion from core interactions made him
  feel *faster*.)
- **Immediate response during the gesture.** The interface must
  show the delta as it happens, not after a threshold. Scale
  while pinching, not after pinching enough.
- **Spatial consistency.** Motion communicates origin. If
  something comes from the agent rail, it should arrive from the
  agent rail. If from a page, from the page.
- **Interruptibility.** Destructive actions trigger on gesture
  *end*; lightweight peeks trigger mid-gesture.

**Nielsen's response-time thresholds** (usability engineering,
confirmed by decades of HCI work):

| Band | Time | What the interface owes the user |
|---|---|---|
| Instantaneous | 0–100ms | Visual state change on the element. Nothing else. |
| Flow maintained | 100ms–1s | Loading indicator. |
| Attention limit | 1–10s | Progress *with estimate*, streaming, or a card already docked and filling. |
| Abandonment | >10s | Background processing + completion notice. |

**assistant-ui** (12k stars, YC-backed, used in production by
Mastra, LangChain, Stack et al.) calls two things
"production-grade" that matter here:
- **Generative UI** — tool calls render as *components*, not as
  log rows. The result of an action is a visual object.
- **Inline human approvals** — the approval lives in the flow,
  not behind a modal elsewhere.

**Vercel ai-chatbot** (21k stars) is notable mostly for what it
*doesn't* do: no dead buttons, every affordance in the composer
responds within its band.

**The agent-UI survey** (our own research brief): the pattern to
steal is **Notion AI's** — "the AI output is a first-class
document object, not a message in a thread." Claude Artifacts is
the best dual-pane because the chat is a log of *intent* and the
artifact is the *work product*. Perplexity's inline numbered
citations hover to a card and click to the source.

## 2. The diagnosis that started this

Four canvas actions (Explain in 3, Regenerate summary, Related,
and the ask-agent bridge) wrote their results into
`[data-summarize-host]` — **a node that is never rendered.** The
buttons computed results, the trail logged them, and the user saw
nothing. The user was right to call it a broken flow rather
than a styling problem: results existed but had no home.

## 3. The design direction: margin notes

A research paper's natural second surface is the margin. The
redesign makes every agent result a **docked response card** — a
persistent, first-class object attached to the paper, not a
transient message.

**Principles, each traceable to the research:**

1. **One action surface.** A command bar under the paper title —
   a text input with verb hints — replaces the row of buttons.
   Rationale: buttons that can fail silently are the failure
   mode we just proved; a command bar *always* responds because
   its response is a card, even when the answer is an error.
   The palette remains the global layer; this is the paper-local
   layer.

2. **The feedback ladder, enforced per action.** Every action
   names its band and honors it:
   - Card dock (instantaneous): the card appears within 100ms of
     the verb — empty, claiming space, verb visible. The user
     knows the click landed before any LLM call resolves.
   - Filling (1s+): the card shows a shimmer and the running ms
     count; when the protocol trace exists, the card docks and
     the trace marks simultaneously.
   - Error is a card too (assistant-ui's lesson): a failed call
     docks a red-ruled card that says what failed and offers
     the retry verb. Errors are content, not toasts.

3. **Results are spatially consistent.** Cards dock in the
   paper's right margin and arrive from the right (spatial
   consistency); page chips inside a card flash the cited page
   in the reader when clicked (Perplexity's citation pattern).

4. **No motion on high-frequency chrome.** Cards for *new* work
     animate in (novelty — you want to see where it landed).
     Re-renders, tab switches, and hover states do not animate
     (frequency). The protocol trace marks do not animate on
     completion, only while running (state explanation, not
     decoration).

5. **The reading surface stays reading.** Newsreader at 17px,
   68-character measure. The margin system never shrinks the
   paper; it shares the column with it.

## 4. What must not survive from the old flow

- The toolbar of five buttons, two of which could never respond.
- `[data-summarize-host]` and any other write-without-render
  host. Any handler that cannot name the element that will show
  its result is a bug by construction.
- Results that appear only in the Log tab. The log is the audit
  record; it is not a substitute for showing the work.
