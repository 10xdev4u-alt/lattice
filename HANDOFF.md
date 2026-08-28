# Lattice — Build Handoff

**Status:** Foundation complete, 111 issues queued, ready for the PR-driven build loop.

**Deadline:** Sept 3, 2026, 1:00 PM PT (~5.5 days from now)

---

## What's done

| | |
|---|---|
| **Repo** | [github.com/10xdev4u-alt/lattice](https://github.com/10xdev4u-alt/lattice) (public, Apache 2.0) |
| **Research** | 4 deep briefs in `research/`: WebMCP spec, academic domain, competitive landscape, agent UI patterns |
| **Repo hygiene** | README, CONTRIBUTING, LICENSE, .gitignore, .gitattributes, .editorconfig, branch-protection-ready |
| **Issue taxonomy** | 33 labels across 4 types, 12 epics, 4 priorities, 8 areas, 4 statuses |
| **Issue templates** | feature, bug, research |
| **PR template** | standardized body |
| **CODEOWNERS** | 10xdev4u-alt is the required reviewer |
| **Label scripts** | `scripts/create-labels.sh` is idempotent and re-runnable |
| **Issue queue** | 111 issues, persisted to `scripts/issues.json`, all live on the remote |
| **Foundation commit** | 1 commit on main, no app code (per the brief: research first) |

## The plan in one sentence

Build Lattice in 6 PR-driven sprints, each shipping 1-3 issues per the issue queue, with strict 6-word conventional commits, co-author trailers, and 1 reviewer per PR.

## The 6 sprints

| Sprint | Days | What ships |
|---|---|---|
| **0** | Aug 28 (today) | Foundation: research, hygiene, issue queue. ✅ Done. |
| **1** | Aug 28–29 | Foundation code: Vite + TS + Netlify + CI, all 14 tools scaffolded with schema + confirmation wiring, tool registration harness, polyfill, dev deploy. |
| **2** | Aug 30 | PDF pipeline: ingestion, two-column read order, search index, arXiv source fallback. Sample library of 5 papers. |
| **3** | Aug 31 | Workspace UI: layout, paper list, PDF viewer, agent rail, status bar, tool call log. Live Tool Array. |
| **4** | Sept 1 | Workflow trail: persistence, methods-appendix export, scrubber, branching. Bibliography exports (BibTeX, CSL-JSON, RIS). |
| **5** | Sept 2 | Peer-reviewer demo (cross-agent `exposedTo`), confirmation modals, design polish, accessibility audit, landing page, demo video. |
| **6** | Sept 3 morning | Dry-run the submission checklist, shoot video if not done, submit. |

## Critical-path issues (in order)

1. **#1** Bootstrap Vite + TS + Netlify Functions project layout
2. **#4** Add netlify.toml headers required by the WebMCP spec
3. **#9** Implement list_papers (read) tool
4. **#10** Implement open_paper (action) tool
5. **#11** Implement search_library (search) tool
6. **#12** Implement summarize_paper (read) tool
7. **#14** Implement compare_claims (read) tool
8. **#20** Implement show_workflow_trail (read) tool
9. **#21** Implement peer_review_invite (write) tool
10. **#75** Implement PDF ingestion via Netlify Function
11. **#76** Implement two-column read-order reconstruction
12. **#34** Design the main workspace layout
13. **#35** Build the paper list component
14. **#36** Build the PDF viewer component
15. **#84** Build the landing page hero with a live demo
16. **#88** Write the 3-minute demo video script
17. **#89** Shoot the demo video
18. **#91** Write the submission text (400 words)
19. **#92** Polish the README
20. **#93** Dry-run the submission checklist

## What I need from you to start the build loop

- **Confirm the 6-sprint plan** or push back on the day allocation.
- **Confirm the build order** (or let me re-shuffle).
- **Who else is on the team?** If it's just you + me, I'll move faster. If there are more, I need their GitHub handles so I can mention them in the co-author trailers.
- **Netlify account**: do you want me to deploy to `lattice-app.netlify.app` (a free Netlify site), or do you have a custom domain in mind?
- **OpenAI API key**: do we have one for the model, or do we go pure Netlify AI Gateway with Claude Haiku (free tier)?
- **Auth**: do you want me to add real auth (Netlify Identity, Clerk, magic link) or keep the demo anonymous?

## The PR loop in 7 steps

For each issue, the loop is:

1. `git checkout -b feat/<scope>-<short-desc> main`
2. Make the change. One logical change per commit.
3. Strict 6-word conventional commit title with co-author trailer.
4. `npm run typecheck && npm run lint && npm run test && netlify dev` smoke test.
5. `git push -u origin feat/<branch>`
6. `gh pr create --title "<conventional>" --body "Closes #N\n..."` 
7. Reviewer approves, squash-merge, delete branch, close issue.

## How I'll keep you in the loop

- Every PR, I paste the diff summary + the link.
- Every 2 hours, I post a status note (what's in, what's next, blockers).
- Every major milestone (sprint complete), I post a "we hit X, on track for Y" note.

The repo is your single source of truth. Open the issues, the PRs, the commits, and the research briefs, in that order, and you'll know everything I know.

---

**Bottom line:** We've got a clean foundation, 111 well-defined issues, and a 6-sprint plan. We're going to win this. The next message I send will be Issue #1's PR link.
