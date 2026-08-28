#!/usr/bin/env bash
# Create the Lattice label set on the remote.
# Idempotent: re-running is safe.

set -euo pipefail

GH="${GH:-/home/princetheprogrammerbtw/.local/share/mise/installs/gh/2.98.0/gh_2.98.0_linux_amd64/bin/gh}"

# Format: name|color|description
# Use a delimiter that won't appear in any of our names/descriptions.
LABELS=$(cat <<'EOF'
type: feature|1f883d|A new user-facing capability
type: bug|d73a4a|Something is broken, wrong, or surprising
type: research|5319e7|A research question that needs an answer
type: chore|cccccc|Maintenance, refactor, or non-feature work
type: docs|0075ca|Documentation only
epic: foundation|fbca04|Repo hygiene, CI, tooling — the team can work
epic: tool-surface|fbca04|The 14 WebMCP tools and their schemas
epic: workspace-ui|fbca04|The main workspace UI: paper list, PDF viewer, agent rail
epic: agent-experience|fbca04|The agent rail, tool call log, confirmations, fallbacks
epic: workflow-trail|fbca04|The killer feature: reviewable, replayable audit log
epic: peer-review|fbca04|Cross-agent peer-reviewer demo (the exposedTo use case)
epic: pdf-pipeline|fbca04|PDF ingestion, text extraction, two-column read order
epic: bibliography|fbca04|CSL JSON, BibTeX, RIS export; arXiv/OpenAlex integration
epic: design-system|fbca04|Tokens, type, motion, color, component library
epic: landing-page|fbca04|The marketing landing page (the hero demo video)
epic: demo-and-submit|fbca04|Demo video, README, submission form, deadline Sep 3
epic: ops|fbca04|Deploys, secrets, observability, monitoring
priority: critical|b60205|Blocker. Demo cannot ship without it.
priority: high|d93f0b|Directly affects a judging criterion
priority: medium|fbca04|Important but not blocking
priority: low|cccccc|Polish, nice-to-have
area: webmcp|0e8a16|WebMCP API surface, tool registration, annotations
area: pdf|0e8a16|PDF parsing, text extraction, layout analysis
area: ai|0e8a16|LLM calls, prompt engineering, response handling
area: storage|0e8a16|Netlify Blobs, persistence, migrations
area: auth|0e8a16|Auth, sessions, rate limits, abuse
area: deploy|0e8a16|netlify.toml, env, CI/CD
area: design|0e8a16|Tokens, components, motion, accessibility
area: content|0e8a16|Sample papers, copy, README, submission text
needs-triage|ededed|Issue has not been reviewed for priority/area
in-progress|1d76db|Someone is actively working this
blocked|b60205|Cannot proceed; see comments for the blocker
ready-for-review|0e8a16|PR is ready, all checks green
EOF
)

ok=0
fail=0
while IFS='|' read -r name color desc; do
  if $GH label create "$name" --color "$color" --description "$desc" --force >/dev/null 2>&1; then
    ok=$((ok+1))
  else
    fail=$((fail+1))
    echo "FAILED: $name ($color)"
  fi
done <<< "$LABELS"

echo "Created/updated: $ok label(s). Failed: $fail."
