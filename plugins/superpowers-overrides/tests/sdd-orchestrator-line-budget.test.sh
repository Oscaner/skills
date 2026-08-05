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

# p0-fallback exists but not in manifest
[ -f "$SKILLS/spor-sdd-p0-fallback/SKILL.md" ] || { echo "FAIL: missing p0-fallback"; exit 1; }
! grep -q 'spor-sdd-p0-fallback' "$ROOT/overrides.manifest.json"

# schema single file — JSON examples only in sdd-handoff-schema.md
hw_examples=$(grep -c '"task":' "$SKILLS/spor-handoff-writer/SKILL.md" || true)
schema_examples=$(grep -c '"task":' "$ROOT/templates/sdd-handoff-schema.md" || true)
[ "$hw_examples" -eq 0 ] || { echo "FAIL: handoff-writer still has inline schema"; exit 1; }
[ "$schema_examples" -ge 1 ] || { echo "FAIL: schema file missing JSON example"; exit 1; }

echo "OK — line budget"
