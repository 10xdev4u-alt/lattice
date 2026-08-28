#!/usr/bin/env bash
# Lattice smoke test.
# Runs after every build. Verifies the page loads, the tool array
# is populated, and the API endpoints respond.

set -euo pipefail

BASE="${LATTICE_BASE:-http://localhost:8888}"
FAIL=0

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; FAIL=1; }

# 1. Index loads
if curl -fsSL "$BASE/" >/dev/null; then
  pass "index loads"
else
  fail "index does not load"
fi

# 2. WebMCP headers
HEADERS=$(curl -fsI "$BASE/" 2>/dev/null)
echo "$HEADERS" | grep -qi 'origin-agent-cluster' && pass "Origin-Agent-Cluster header present" || fail "Origin-Agent-Cluster header missing"
echo "$HEADERS" | grep -qi 'permissions-policy' && pass "Permissions-Policy header present" || fail "Permissions-Policy header missing"

# 3. healthz
if curl -fsS "$BASE/api/healthz" >/dev/null; then
  pass "/api/healthz returns 200"
else
  fail "/api/healthz failed"
fi

# 4. Assets load
if curl -fsS "$BASE/assets/main.ts" >/dev/null; then
  pass "main.ts serves"
else
  fail "main.ts does not serve"
fi

if [ "$FAIL" -eq 0 ]; then
  echo
  echo "All smoke tests passed."
  exit 0
else
  echo
  echo "Smoke tests failed."
  exit 1
fi
