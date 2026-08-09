#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"

sdd="$(wc -l < "$SKILLS/spor-subagent-driven-development/SKILL.md" | tr -d ' ')"
ctrl="$(wc -l < "$SKILLS/spor-token-efficient-controller-handoff/SKILL.md" | tr -d ' ')"
life="$(wc -l < "$SKILLS/spor-subagent-lifecycle/SKILL.md" | tr -d ' ')"
rev="$(wc -l < "$SKILLS/spor-token-efficient-review-dispatch/SKILL.md" | tr -d ' ')"

tier1=$((sdd + ctrl))
tier2=$((tier1 + life + rev))

echo "Tier 1 (spor-SDD + controller-handoff): $tier1 lines"
echo "Tier 2 (+ lifecycle + review-dispatch): $tier2 lines"

[ "$sdd" -le 160 ] || { echo "FAIL: spor-SDD $sdd > 160"; exit 1; }
[ "$ctrl" -le 110 ] || { echo "FAIL: controller-handoff $ctrl > 110"; exit 1; }
[ "$tier1" -le 225 ] || { echo "FAIL: Tier 1 $tier1 > 225"; exit 1; }
[ "$tier2" -le 350 ] || { echo "FAIL: Tier 2 $tier2 > 350"; exit 1; }

# AC#1 — Rule 3/5b/5c bodies only in p0-fallback (references in spor-SDD OK)
for rule in '### Rule 3' '#### Rule 5b' '#### Rule 5c' '### Rule 5b' '### Rule 5c'; do
  ! grep -q "$rule" "$SKILLS/spor-subagent-driven-development/SKILL.md" \
    || { echo "FAIL: spor-SDD must not contain $rule body"; exit 1; }
done
grep -q '### Rule 3' "$SKILLS/spor-sdd-p0-fallback/SKILL.md" \
  || { echo "FAIL: p0-fallback missing Rule 3"; exit 1; }

# AC#2 — env/exit/harness tables only in sdd-h6-reference.md
for marker in '| Variable | Purpose |' '| `SDD_MODE` |' '| Harness |'; do
  ! grep -qF "$marker" "$SKILLS/spor-token-efficient-controller-handoff/SKILL.md" \
    || { echo "FAIL: controller-handoff contains H6 table: $marker"; exit 1; }
done
grep -qF '| Variable | Purpose |' "$ROOT/docs/sdd-h6-reference.md" \
  || { echo "FAIL: sdd-h6-reference missing env table"; exit 1; }

# p0-fallback exists but not in manifest
[ -f "$SKILLS/spor-sdd-p0-fallback/SKILL.md" ] || { echo "FAIL: missing p0-fallback"; exit 1; }
! grep -q 'spor-sdd-p0-fallback' "$ROOT/overrides.manifest.json"

# schema single file — JSON examples only in sdd-handoff-schema.md
hw_examples=$(grep -c '"task":' "$SKILLS/spor-handoff-writer/SKILL.md" || true)
schema_examples=$(grep -c '"task":' "$ROOT/templates/sdd-handoff-schema.md" || true)
[ "$hw_examples" -eq 0 ] || { echo "FAIL: handoff-writer still has inline schema"; exit 1; }
[ "$schema_examples" -ge 1 ] || { echo "FAIL: schema file missing JSON example"; exit 1; }

# Task 4 — D3 severity behavior anchors + deferral semantics (AC#1)
D3="$(sed -n '/^### D3/,/^### D4/p' "$SKILLS/spor-token-efficient-review-dispatch/SKILL.md")"

# AC#1a — three severity behavior anchors
for anchor in '合并前必须修复' '可延期的 minor' '纯风格'; do
  grep -qF "$anchor" <<<"$D3" \
    || { echo "FAIL: D3 missing severity behavior anchor: $anchor"; exit 1; }
done

# AC#1b — deferral semantics: warn/nit never enter fix loop → APPROVED + deferred: true
grep -qF 'deferred: true' <<<"$D3" \
  || { echo "FAIL: D3 missing deferral semantics (deferred: true)"; exit 1; }
grep -qF 'fix loop' <<<"$D3" \
  || { echo "FAIL: D3 missing fix-loop exclusion for warn/nit"; exit 1; }

# AC#1c — D3 schema block documents deferred optional field
grep -qF '`deferred`' <<<"$D3" \
  || { echo "FAIL: D3 schema block missing deferred field"; exit 1; }

# AC#1d — D3 output schema {findings: [...]} preserved
grep -qF '{findings:' <<<"$D3" \
  || { echo "FAIL: D3 findings schema lost"; exit 1; }

# Task 4 — handoff-writer Review segment parsing severity-aware, cites schema SOT (AC#2)
RSP="$(sed -n '/^## Review segment parsing/,/^## D3 orchestrator return/p' "$SKILLS/spor-handoff-writer/SKILL.md")"

# AC#2a — status decision cites schema SOT, not redefined inline
grep -qF 'sdd-handoff-schema.md' <<<"$RSP" \
  || { echo "FAIL: Review segment parsing must cite schema SOT"; exit 1; }

# AC#2b — severity-aware deferred marking (warn/nit → deferred: true)
grep -qF 'deferred: true' <<<"$RSP" \
  || { echo "FAIL: Review segment parsing missing deferred marking"; exit 1; }

# AC#2c — open-findings scoped to blocker (non-deferred) only
grep -qF '非 deferred' <<<"$RSP" \
  || { echo "FAIL: Review segment parsing missing blocker-only open-findings"; exit 1; }

echo "OK — line budget"
