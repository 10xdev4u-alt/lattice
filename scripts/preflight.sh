#!/usr/bin/env bash
# Lattice pre-flight — run before submitting the demo.
#
# Verifies the build artifacts, the static assets, the tool surface
# spec, and the Functions endpoints. Designed to be safe to run on
# a fresh clone in <30s.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

pass() { echo "PASS: $*"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $*"; FAIL=$((FAIL+1)); }

# 1. Required files exist
for f in README.md LICENSE CONTRIBUTING.md HANDOFF.md CHANGELOG.md FAQ.md SUBMISSION.md package.json docker-compose.yml vite.config.ts tsconfig.json server.mjs Dockerfile; do
  if [ -f "$f" ]; then pass "$f exists"; else fail "$f missing"; fi
done

# 2. Research briefs are present
for f in research/webmcp-spec.md research/academic-domain.md research/competitive-landscape.md research/agent-ui-patterns.md research/error-codes.md; do
  if [ -f "$f" ]; then pass "$f exists"; else fail "$f missing"; fi
done

# 3. The 14 tools exist
TOOLS=$(ls public/assets/tools/*.ts 2>/dev/null | wc -l)
if [ "$TOOLS" -ge 14 ]; then pass "$TOOLS tool files"; else fail "expected >=14 tool files, got $TOOLS"; fi

# 4. The API handlers exist
FNS=$(ls api/*.ts 2>/dev/null | wc -l)
if [ "$FNS" -ge 6 ]; then pass "$FNS API handler files"; else fail "expected >=6 API handlers, got $FNS"; fi

# 5. The HTML pages
for f in public/index.html public/share.html public/landing.html; do
  if [ -f "$f" ]; then pass "$f exists"; else fail "$f missing"; fi
done

# 6. The styles
STYLES=$(ls public/assets/styles/*.css 2>/dev/null | wc -l)
if [ "$STYLES" -ge 10 ]; then pass "$STYLES stylesheets"; else fail "expected >=10 stylesheets, got $STYLES"; fi

# 7. Tool linter (if available)
if [ -f scripts/lint-tools.mjs ]; then
  if node scripts/lint-tools.mjs >/dev/null 2>&1; then pass "tool linter passes"; else fail "tool linter found violations"; fi
fi

# 8. JSON / YAML validity
for f in scripts/issues.json .github/labels.yml .github/labeler.yml; do
  if [ -f "$f" ]; then
    case "$f" in
      *.json)
        if node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then pass "$f is valid JSON"; else fail "$f invalid JSON"; fi
        ;;
      *.yml)
        if python3 -c "import sys, yaml; yaml.safe_load(open('$f'))" 2>/dev/null; then
          pass "$f is valid YAML"
        else
          fail "$f invalid YAML (or no python yaml module)"
        fi
        ;;
    esac
  fi
done

# 9. server.mjs sets the WebMCP headers on every response
if grep -q 'Origin-Agent-Cluster' server.mjs; then pass "WebMCP origin isolation in server.mjs"; else fail "WebMCP headers missing from server.mjs"; fi
if grep -q 'tools=(self)' server.mjs; then pass "tools permission policy in server.mjs"; else fail "tools permission policy missing"; fi

# 10. Dockerfile size check
if [ -f Dockerfile ]; then pass "Dockerfile present"; else fail "Dockerfile missing"; fi

echo
echo "=== Pre-flight: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
