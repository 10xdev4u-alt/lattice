# Lattice — Frequently Asked Questions

> The 12 questions a judge is most likely to ask, with one-line
> answers that link into the deeper docs.

## What is Lattice?

A research-paper workspace where the AI agent, your open PDF, your
library, and your notes share one context — and where every claim the
agent makes is a re-openable, re-playable, citable event in your own
audit log.

## How is this different from Elicit, Consensus, or Scite?

Those are research-AI *backends* — you ask a question, they return
an answer. Lattice is a research-AI *workspace* — you live in the
page, the agent sees your library, and every action is recorded.
Lattice is a peer to the backends, not a competitor.

## How is this different from Zotero or Readwise?

Zotero and Readwise are reference managers. Lattice is the
workspace *around* the references. Import a Zotero library into
Lattice (drag-and-drop the PDFs), and the agent can now reason
over it. Zotero's strength is citation; Lattice's strength is the
audit trail.

## Does it work without the WebMCP flag?

Yes. The polyfill kicks in on Safari, Firefox, older Chrome, and
Chrome 149 without the flag. The page renders, the tools appear
in the Live Tool Array, and the audit log fills in — but the
*agent* won't call the tools because there's no agent. To see
the full experience, enable the flag in Chrome 149+ or open the
URL in the ChatGPT desktop app's built-in browser.

## How do I run it locally?

```
git clone https://github.com/10xdev4u-alt/lattice
cd lattice
npm install
npm run dev
# open http://localhost:8888
```

## How do I run it in Docker?

```
docker build -t lattice:dev .
docker run --rm -p 8888:8888 lattice:dev
```

The image is multi-stage, non-root, and stays under 200MB.

## Which model is the agent using?

By default, `poolside-laguna-free` on the OpenAI-compatible endpoint
at `https://api.kilo.ai/api/gateway/v1`. Swap via the Settings panel
(Ctrl/Cmd+,), or the `LATTICE_LLM_BASE` / `LATTICE_LLM_MODEL` env
vars. Any OpenAI-compatible endpoint works.

## Is the AI work reproducible?

Yes. Every tool call is recorded to the workflow trail with timestamp,
args, result, and duration. The trail is exportable as Markdown
(methods appendix) or JSONL (machine-readable). Drag the timeline
scrubber to rewind to any step.

## How do I export a bibliography?

Click the agent rail's Tools tab, find `export_bibliography`, or
ask the agent. Supported formats: CSL-JSON (default), BibTeX, RIS,
APA-Markdown, MLA-Markdown. The file downloads to your browser.

## How does the cross-agent peer review work?

Click "Invite peer-reviewer" in the agent rail. A second agent
(default: the skeptic) joins the page via WebMCP's `exposedTo`
mechanism. The skeptic challenges every claim the primary agent
makes, demands citations, never writes to the document. Watch
them negotiate in the chat.

## What's the audit log for?

Three reasons:

1. **You can defend it.** When your committee asks "why this paper,
   why this quote," you show them the log.
2. **You can replay it.** Drag the scrubber back to any step. The
   page re-renders to that point in the session.
3. **You can publish it.** Export the trail as a methods appendix
   for your paper. The PRISMA flow diagram is the academic-norm-
   shaped output of the audit log.

## What about my data?

In the demo, the library and trail live in your browser's
localStorage. The PDF source and the search index live in Netlify
Blobs scoped to the Lattice site. No third-party analytics, no
tracking, no cookies beyond the session. The magic-link auth (when
shipped) will scope persistence to your account.

## What can I do with the command palette?

Press **Cmd/Ctrl+K**. It lists 17 actions: load sample, tour,
ingest a paper, stats, peer review, bibliography, batch extract,
knowledge graph, arXiv feed, saved searches, share, restore,
prompt diff, what's wrong, scratchpad, settings, help. Type to
filter, arrow keys to navigate, Enter to run.

## What are all the keyboard shortcuts?

- **Cmd/Ctrl+K** — command palette
- **Cmd/Ctrl+B** — toggle the paper list rail
- **Cmd/Ctrl+R** — toggle the agent rail
- **Cmd/Ctrl+Shift+R** — float the agent rail over the canvas
- **Cmd/Ctrl+,** — settings panel
- **Cmd/Ctrl+Shift+P** — "what's in the prompt" debug view
- **g w** — workflow trail tab
- **g l** — chat tab
- **g t** — tools tab
- **g k** — knowledge graph
- **g f** — arXiv feed
- **g s** — stats panel
- **g n** — scratchpad
- **g b** — branch diff
- **g h** — session hash (share URL)
- **g p** — prompt diff (last 2 submissions)
- **g d** — routine detector
- **g a** — build bibliography
- **g r** — restore a session
- **g i** — ingest one paper
- **g e** — batch extract quotes
- **?** — this help
