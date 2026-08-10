#!/usr/bin/env bash
set -euo pipefail
# cdd-severity-contract.test.sh — lock the severity→status + deferred governance prose
# (spec D1/D4/D5a/D6). Grep contract over template/skill prose. Single source of
# truth = docs/handoff-schema.md (D1); every positive grep is chosen so the
# OLD wording / deleted passage does NOT match (no false-green), and negative greps
# assert the removed phrases stay gone.
#
# Files under test:
#   templates/cdd/_handoff-write-fragment.md   review/fix segment I/O + status step
#   docs/handoff-schema.md                schema SOT (findings[].deferred, mapping)
#   bin/lib/cdd-common.sh                          _append_ledger deferred roll-up + no-jq
#   templates/cdd/review.md                    severity-aware status decision
#   templates/cdd/fix.md                       open-findings blocker-only
#   ../superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md   D3 anchors + result anchor
#   ../superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md       Rule 8 D6 end semantics
#
# fail() is intentionally NOT sourced from the gate test lib — this test is
# standalone (no fixture isolation needed; it greps the committed tree).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fail() { echo "FAIL: $1" >&2; exit 1; }

ASSERT_COUNT=0

# assert_grep <needle> <file> <desc> — extended regex must match the file.
assert_grep() {
  grep -qE "$1" "$2" || fail "missing '$1' in $2 ($3)"
  ASSERT_COUNT=$((ASSERT_COUNT + 1))
}

# assert_no_grep <needle> <file> <desc> — extended regex must NOT match (removed prose).
assert_no_grep() {
  if grep -qE "$1" "$2"; then fail "unexpected '$1' in $2 ($3)"; fi
  ASSERT_COUNT=$((ASSERT_COUNT + 1))
}

# section <file> <header> — print lines from <header> up to (not incl) the next
# ## / ### header outside a fenced code block (fences can legitimately contain
# header-looking lines, e.g. the ## Findings (D3) block in handoff-writer).
# Start condition is anchored to a real '## '/'### ' header line so body prose
# or #### sub-headers containing the header string cannot shift the window.
section() {
  awk -v h="$2" '/^#{2,3} / && index($0,h){p=1;next} p && /^```/{f=!f; next} p && !f && /^#{2,3} /{exit} p' "$1"
}

# assert_section_grep <file> <header> <needle> <desc> — needle must match within a section.
# The section is captured to a variable first (not piped straight into grep -q)
# so awk finishes before grep runs: under `set -o pipefail` a grep -q early exit
# would otherwise SIGPIPE awk once the section exceeds the pipe buffer.
# grep must NOT use -q: with -q the reader exits early and the writer (printf)
# SIGPIPEs once the section exceeds the pipe buffer (latent CI breakage). Redirect
# to /dev/null instead — grep reads all stdin, printf never receives SIGPIPE.
assert_section_grep() {
  local out
  out="$(section "$1" "$2")"
  printf '%s' "$out" | grep -E "$3" >/dev/null || fail "missing '$3' in '$2' of $1 ($4)"
  ASSERT_COUNT=$((ASSERT_COUNT + 1))
}

FRAGMENT="$ROOT/templates/cdd/_handoff-write-fragment.md"
SCHEMA="$ROOT/docs/handoff-schema.md"
CDD_COMMON="$ROOT/bin/lib/cdd-common.sh"
REVIEW="$ROOT/templates/cdd/review.md"
FIX="$ROOT/templates/cdd/fix.md"
OVERRIDES="$ROOT/../superpowers-overrides"
DISPATCH="$OVERRIDES/skills/spor-token-efficient-review-dispatch/SKILL.md"
CDD_SKILL="$OVERRIDES/skills/spor-subagent-driven-development/SKILL.md"

echo "== 1. _handoff-write-fragment.md (review status step + fix/review deferred preserve) =="
# mapping wording is the new review step 6 (any blocker → CHANGES_REQUESTED), NOT the
# old `status: CHANGES_REQUESTED` line — the regex cannot match that old wording.
assert_grep 'blocker.*CHANGES_REQUESTED' "$FRAGMENT" "review status mapping (D1)"
# the APPROVED result of that step is locked too (no blocker → APPROVED).
assert_grep 'otherwise.*APPROVED' "$FRAGMENT" "no-blocker → APPROVED (result anchor)"
assert_grep 'deferred: true' "$FRAGMENT" "deferred marking"
assert_section_grep "$FRAGMENT" '### Segment: fix' 'Preserve all.*deferred: true.*findings' "fix segment preserves deferred"
assert_section_grep "$FRAGMENT" '### Segment: review' 'never replace wholesale|merge' "review segment merges findings"
assert_no_grep 'Empty findings' "$FRAGMENT" "old 'Empty findings' wording removed"

echo "== 2. docs/handoff-schema.md (SOT mapping + findings[].deferred) =="
assert_section_grep "$SCHEMA" '## Severity → status mapping' 'CHANGES_REQUESTED' "mapping table keeps CHANGES_REQUESTED"
assert_section_grep "$SCHEMA" '## Review arrays' 'findings\[\]' "findings[] described"
assert_section_grep "$SCHEMA" '## Review arrays' 'deferred' "findings[] deferred field"

echo "== 3. cdd-common.sh (_append_ledger deferred roll-up + no-jq degradation) =="
APPEND_LEDGER="$(awk '/^  _append_ledger[(][)] [{]/{p=1} p{print} p && /^  [}]$/{exit}' "$CDD_COMMON")"
printf '%s' "$APPEND_LEDGER" | grep 'deferred' >/dev/null || fail "missing deferred branch in _append_ledger: $CDD_COMMON"
ASSERT_COUNT=$((ASSERT_COUNT + 1))
printf '%s' "$APPEND_LEDGER" | grep 'deferred not enumerated' >/dev/null || fail "missing no-jq degradation line in _append_ledger: $CDD_COMMON"
ASSERT_COUNT=$((ASSERT_COUNT + 1))

echo "== 4. review.md (blocker + CHANGES_REQUESTED co-occur; no empty→APPROVED) =="
assert_grep 'blocker.*CHANGES_REQUESTED' "$REVIEW" "review status decision"
assert_no_grep 'empty → APPROVED' "$REVIEW" "old 'empty → APPROVED' wording removed"
assert_no_grep 'empty → `APPROVED`' "$REVIEW" "old 'empty → \`APPROVED\`' wording removed (backtick variant)"

echo "== 5. fix.md (deferred + open-findings blocker-only) =="
assert_grep 'deferred' "$FIX" "fix segment deferred"
assert_grep 'open-findings 只含 blocker' "$FIX" "open-findings blocker-only wording"

echo "== 6. spor-token-efficient-review-dispatch D3 (behavior anchors, not bare severities) =="
assert_section_grep "$DISPATCH" '### D3 — Findings-only output' 'deferred: true' "D3 deferred field"
assert_section_grep "$DISPATCH" '### D3 — Findings-only output' '合并前必须修复' "D3 blocker behavior anchor"
assert_section_grep "$DISPATCH" '### D3 — Findings-only output' 'APPROVED.*deferred: true' "D3 result anchor (warn/nit → APPROVED+deferred)"

echo "== 7. _handoff-write-fragment.md review segment (deferred + blocker-only) =="
assert_section_grep "$FRAGMENT" '### Segment: review' 'deferred: true' "review parsing keeps deferred"
assert_section_grep "$FRAGMENT" '### Segment: review' 'non-deferred = blocker findings only' "review segment blocker-only open-findings"

echo "== 8. spor-subagent-driven-development Rule 8 (D6 end semantics) =="
assert_section_grep "$CDD_SKILL" '### Rule 8 — 终盘聚合' 'deferred' "final aggregation deferred"
assert_section_grep "$CDD_SKILL" '### Rule 8 — 终盘聚合' '有界 final fix 波' "bounded-once final fix wave"
assert_section_grep "$CDD_SKILL" '### Rule 8 — 终盘聚合' '不重写' "handoff stays APPROVED (no rewrite)"
assert_section_grep "$CDD_SKILL" '### Rule 8 — 终盘聚合' 'unconditionally report to the user' "unconditional user report"
assert_section_grep "$CDD_SKILL" '### Rule 8 — 终盘聚合' 'no cross-task fix loop' "no cross-task fix loop"

echo "== 9. result anchors (warn/nit → APPROVED + deferred; never → CHANGES_REQUESTED) =="
assert_grep 'deferred.*APPROVED' "$SCHEMA" "mapping row: warn/nit(deferred) → APPROVED"
assert_grep 'APPROVED.*deferred: true' "$DISPATCH" "D3: handoff records APPROVED + deferred: true"

echo "OK — cdd-severity-contract ($ASSERT_COUNT assertions)"
