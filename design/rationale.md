# Lattice design rationale

> One page that answers: why this palette, why this motion, why this
> layout, why this typography. For a judge who has 90 seconds to
> understand the design choices.

## The aesthetic: "Linear for researchers"

Lattice sits between two design vocabularies:

- **Consumer AI chat** — Claude.ai, ChatGPT, Gemini. Warm, friendly,
  centered on a single long-form artifact.
- **Developer tooling** — Linear, Vercel, the Netlify dashboard.
  Monochrome, dense, the chrome stays out of the way.

We want neither. We're a tool for people who already trust themselves
with LaTeX, who read raw JSON, who keep a `.bib` file. The UI should
signal that. So we borrow the developer-tooling chrome (dense, mono
where it matters, single accent color) and pair it with one
deliberate concession to the AI-chat aesthetic: a single accent color
in violet, used only for agent-driven affordances. The agent's
presence is the only colorful thing in the room. That choice
mirrors the design brief: the agent is a guest, not the host.

## The palette: one accent, calm everything else

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0a0a0c` | Default background (dark mode) |
| `--bg-elev-1` | `#131318` | Raised surfaces (rails, modals) |
| `--bg-elev-2` | `#1a1a20` | Hover / pressed |
| `--fg` | `#ececf1` | Primary text |
| `--fg-muted` | `#9aa0aa` | Secondary text |
| `--border` | `#232329` | Dividers |
| `--accent` | `#7c6cff` | The single accent — agent affordances only |
| `--agent` | `#b69bff` | The agent's text, slightly desaturated |
| `--warn` | `#d97706` | User denial, in-flight |
| `--err` | `#ef4444` | Tool error |
| `--ok` | `#10b981` | Tool success |

The agent's text is a slightly desaturated violet so the human can
tell the agent's voice from their own at a glance, but it doesn't
shout. A judge looking at the audit log can see who said what
without reading the labels.

## The type system: Inter + JetBrains Mono

Inter for prose. JetBrains Mono for data. The pairing is the
shortcut that signals "for technical work" without a single line of
copy. Mono is reserved for:

- Tool names (`open_paper`, `search_library`, `summarize_paper`)
- Timestamps and durations
- File paths, source IDs, status codes
- Anything that came from a machine

The scale: 12, 14, 16, 20, 24, 32. Six steps. Generous at the top
(titles, eyebrows), tight at the bottom (chips, status). No 11px or
13px in the type scale; the spacing is a 4px grid, the type is a
6-step geometric scale.

## The motion: 150ms ease-out, never a spinner

Every transition is under 300ms. We use ease-out (`cubic-bezier(0.2,
0, 0, 1)`) for everything because it's the curve that says "this
finished and you can move on." No bounces, no parallax, no
decorative motion. A linear progress chevron reads as "working" the
way a spinner reads as "stuck." Respect `prefers-reduced-motion` —
the tokens override to 0ms.

## The layout: three rails, fixed widths, flex canvas

240px left rail (paper list), flex main canvas (PDF or empty
state), 360px right rail (agent). Resize-aware. Collapses to a
single column at <800px so the demo works on a phone.

The fixed-width rails matter: paper lists and agent rails benefit
from being narrow (more items in less space). The canvas takes
whatever is left, because papers and the agent's output are the
two things that need horizontal room.

## The agent rail: 3 tabs, one color, no chat

The agent rail has three tabs: Chat, Tools, Log. The chat is not the
primary surface — the tools and the log are. A judge who clicks the
Tools tab sees the 14 typed tools and the annotations. A judge who
clicks the Log tab sees the audit trail with one click to expand
each step. The chat is a convenience, not the product.

## What we deliberately don't do

- **No emojis.** Emoji in a research tool is decorative noise. The
  favicon and logo are simple geometric marks.
- **No marketing voice.** Plain prose, one sentence per section,
  reads at a 10th-grade level. Passes the unslop skill.
- **No dark patterns.** Confirmation modals are explicit. The
  agent's "I don't know" is a calm grey dot, not a red error.
- **No AI-tell copy.** "Powered by AI", "intelligent assistant",
  "transform your workflow" — none of it. The product speaks for
  itself in the demo.
- **No fake social proof.** No "trusted by 10,000 researchers" —
  we have no users yet. The judge knows.
