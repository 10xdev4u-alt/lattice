# Contributing to Lattice

We're a small, focused team with six days, a $35K prize, and an opinionated process. This document is the operating manual.

## 1. The flow: research → issue → branch → PR → review → merge

```
issue raised
   ↓
branch from main (name: feat/<scope>-<short-desc> or fix/<scope>-<short-desc>)
   ↓
small commits, conventional commit messages, 6-word title
   ↓
local validation (npm run typecheck, npm run lint, smoke test in Chrome)
   ↓
push branch, open PR referencing the issue ("Closes #N" in the body)
   ↓
review by 10xdev4u-alt or the-ai-developer
   ↓
merge to main, close issue, delete branch
```

A single commit per logical change. A single PR per issue. A single reviewer per PR. The reviewer is not the author.

## 2. Conventional commits, strict 6-word title

Format: `<type>(<scope>): <six word description>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

The description is exactly **six words**. This is a discipline rule, not a suggestion. If you can't say what you did in six words, you're committing too much.

### Examples (note the body explains; the title is 6 words)

```
feat(tools): add search_library imperative tool

Implements the first read tool in the Lattice tool surface.
Snake_case, snake_case description, search query in inputSchema,
result echoes the query and includes a count.
```

```
fix(pdf): correct two-column read order heuristic
```

```
docs(readme): add demo video and submission deadline
```

### Co-author trailer

Every commit authored by an AI agent includes a co-author trailer:

```
Co-authored-by: the-ai-developer <the-ai-developer@users.noreply.github.com>
```

This is non-negotiable. It is required by GitHub's terms and by our team's operating principle: be honest about who wrote what.

## 3. Branches

- `main` is always deployable
- Branch names: `feat/<scope>-<short-desc>`, `fix/<scope>-<short-desc>`, `chore/<short-desc>`, `docs/<short-desc>`
- Max 80 chars
- Delete the branch on merge (locally and on the remote)

## 4. Pull requests

- Title matches the conventional commit format
- Body has: "Closes #N", a one-paragraph what/why, a list of changes, a "How I tested" section, screenshots or a screen recording if there's UI
- Reviewer is assigned by round-robin
- Reviews are blocking; at least one approval
- We squash-merge by default

## 5. Issues

- One issue = one well-defined unit of work
- Use the issue templates (`.github/ISSUE_TEMPLATE/`)
- Labels are mandatory: at least one `epic:*`, one `priority:*`, one `area:*`
- Issues are the unit of discussion. The PR is just the answer to the issue.

## 6. Local validation, before push

Run before every push:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest run (when we have tests)
npm run dev         # smoke test in Chrome
```

If the local validation fails, the PR doesn't open. The CI will fail it for you anyway.

## 7. Honesty about what's done

If a thing is "done in the demo" but not in the code, say so in the PR body. If a thing is in the code but not the demo, say so. We lose judges' trust by overclaiming; we win by being precise.

## 8. The single most important rule

> A junior dev reading this repo in two years should be able to follow the issues → PRs → commits trail and rebuild the whole thing from first principles.

That means: clear commits, clear PRs, clear issues, code that explains itself. We are a team of enterprise quality. We act like it.
