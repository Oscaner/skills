#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"
OS_ENG="$ROOT/../os-engineering"
OS_EXEC="$OS_ENG/skills/os-executing-plans/SKILL.md"

# orchestrator prose now lives in os-executing-plans + the os-engineering docs
# (overrides side is thin pointers); measure the real hosts so the budget still
# bounds the prose.
sdd="$(wc -l < "$OS_EXEC" | tr -d ' ')"
ctrl="$(wc -l < "$OS_ENG/docs/controller-handoff.md" | tr -d ' ')"
life="$(wc -l < "$OS_ENG/docs/subagent-lifecycle.md" | tr -d ' ')"
rev="$(wc -l < "$OS_ENG/docs/review-dispatch.md" | tr -d ' ')"

tier1=$((sdd + ctrl))
tier2=$((tier1 + life + rev))

echo "Tier 1 (os-executing-plans + controller-handoff): $tier1 lines"
echo "Tier 2 (+ subagent-lifecycle + review-dispatch): $tier2 lines"

[ "$sdd" -le 160 ] || { echo "FAIL: os-executing-plans $sdd > 160"; exit 1; }
[ "$ctrl" -le 110 ] || { echo "FAIL: controller-handoff $ctrl > 110"; exit 1; }
[ "$tier1" -le 225 ] || { echo "FAIL: Tier 1 $tier1 > 225"; exit 1; }
[ "$tier2" -le 350 ] || { echo "FAIL: Tier 2 $tier2 > 350"; exit 1; }

# AC#1 — orchestrator prose moved to os-engineering; the spor-SDD thin pointer is
# deleted (T2), and os-executing-plans hosts D6 + checklist.
[ ! -e "$SKILLS/spor-subagent-driven-development" ] \
  || { echo "FAIL: spor-subagent-driven-development still present"; exit 1; }
grep -q '^### Rule: D6 Aggregation' "$OS_EXEC" \
  || { echo "FAIL: os-executing-plans missing D6 Aggregation"; exit 1; }
grep -q '^### Rule: Orchestrator Checklist' "$OS_EXEC" \
  || { echo "FAIL: os-executing-plans missing Orchestrator Checklist"; exit 1; }

# AC#2 — env/exit/harness tables live in os-engineering/docs/cdd-reference.md;
# the controller-handoff thin pointer is deleted (T2).
[ ! -e "$SKILLS/spor-token-efficient-controller-handoff" ] \
  || { echo "FAIL: spor-token-efficient-controller-handoff still present"; exit 1; }
grep -qF '| Variable | Purpose |' "$OS_ENG/docs/cdd-reference.md" \
  || { echo "FAIL: cdd-reference missing env table"; exit 1; }
grep -qF '| Ship | Harnesses |' "$OS_ENG/docs/cdd-reference.md" \
  || { echo "FAIL: cdd-reference missing harness table"; exit 1; }

# deleted cross-cutting skills are gone from the overrides tree
for slug in spor-sdd-p0-fallback spor-subagent-lifecycle spor-token-efficient-review-dispatch; do
  [ -e "$SKILLS/$slug" ] && { echo "FAIL: deleted skill still present: $slug"; exit 1; }
done

# schema single file — JSON examples only in the os-engineering schema SOT;
# the handoff-writer thin pointer is deleted (T2).
[ ! -e "$SKILLS/spor-handoff-writer" ] \
  || { echo "FAIL: spor-handoff-writer still present"; exit 1; }
schema_examples=$(grep -c '"task":' "$OS_ENG/docs/handoff-schema.md" || true)
[ "$schema_examples" -ge 1 ] || { echo "FAIL: schema file missing JSON example"; exit 1; }

# D3 severity behavior anchors + deferral semantics now live in the
# os-engineering review-dispatch doc (T1 completion).
D3="$(sed -n '/^### Rule: D3 Findings-Only Output/,$p' "$OS_ENG/docs/review-dispatch.md")"

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
grep -qF 'deferred?' <<<"$D3" \
  || { echo "FAIL: D3 schema block missing deferred field"; exit 1; }

# AC#1d — D3 output schema {findings: [...]} preserved
grep -qF '{findings:' <<<"$D3" \
  || { echo "FAIL: D3 findings schema lost"; exit 1; }

# review-segment parsing severity-aware, cites schema SOT (AC#2).
RSP="$(sed -n '/^### Segment: review/,/^### Segment: fix/p' "$OS_ENG/templates/cdd/_handoff-write-fragment.md")"

# AC#2a — status decision cites schema SOT, not redefined inline
grep -qF 'docs/handoff-schema.md' "$OS_ENG/templates/cdd/_handoff-write-fragment.md" \
  || { echo "FAIL: handoff-write fragment must cite schema SOT"; exit 1; }

# AC#2b — severity-aware deferred marking (warn/nit → deferred: true)
grep -qF 'deferred: true' <<<"$RSP" \
  || { echo "FAIL: review segment missing deferred marking"; exit 1; }

# AC#2c — open-findings scoped to blocker (non-deferred) only
grep -qF 'non-deferred = blocker findings only' <<<"$RSP" \
  || { echo "FAIL: review segment missing blocker-only open-findings"; exit 1; }

# D6 终盘聚合 + 用户决策门 (AC#1-3) — hosted in os-executing-plans
D6="$(sed -n '/^### Rule: D6 Aggregation/,/^### Rule: Ledger/p' "$OS_EXEC")"
[ -n "$D6" ] || { echo "FAIL: D6 section (D6 Aggregation) missing"; exit 1; }

# AC#1a — step 1 聚合: grep deferred + no-jq 降级行（无冒号）子串匹配健壮
grep -qF 'deferred' <<<"$D6" \
  || { echo "FAIL: D6 missing aggregation (deferred)"; exit 1; }
grep -qF 'deferred not enumerated — jq missing' <<<"$D6" \
  || { echo "FAIL: D6 missing no-jq degraded-line robustness note"; exit 1; }

# AC#1b — step 1 呈现 + step 2 用户决策
grep -qF '呈现' <<<"$D6" \
  || { echo "FAIL: D6 missing present-to-user step"; exit 1; }
grep -qF '用户决策' <<<"$D6" \
  || { echo "FAIL: D6 missing user decision gate"; exit 1; }

# AC#1c — step 3 有界 final fix 波: 一个 fix agent + 一次 scoped re-review
grep -qF 'scoped re-review' <<<"$D6" \
  || { echo "FAIL: D6 missing scoped re-review"; exit 1; }
grep -qF 'fix agent' <<<"$D6" \
  || { echo "FAIL: D6 missing single fix agent"; exit 1; }

# AC#2 — 不破坏既有语义规则标题（os-executing-plans 编排器控制器语义规则集）
for r in '### Rule: Read Upstream' '### Rule: Mode Selection' '### Rule: Task Complexity' '### Rule: Confirm Once' '### Rule: Fix Loop' '### Rule: Per-Task Review' '### Rule: Quality Invariants' '### Rule: D6 Aggregation' '### Rule: Ledger'; do
  grep -qF "$r" "$OS_EXEC" \
    || { echo "FAIL: os-executing-plans rule heading lost: $r"; exit 1; }
done
grep -qF 'controller-handoff.md' "$OS_EXEC" \
  || { echo "FAIL: os-executing-plans missing controller-handoff citation"; exit 1; }

# AC#3 — round cap 5 明确不适用于跨任务 final fix 波
grep -qF 'round cap 5' <<<"$D6" \
  || { echo "FAIL: D6 missing round cap 5 anchor"; exit 1; }
grep -qF '不适用' <<<"$D6" \
  || { echo "FAIL: D6 missing round-cap-5 inapplicability"; exit 1; }

# AC#8 — Orchestrator Checklist semantic anchors (issue #52 Guard 1)
RULE0="$(sed -n '/^### Rule: Orchestrator Checklist/,/^### Rule: D6 Aggregation/p' "$OS_EXEC")"

# three phase markers, each on its own line (line-anchored — blocks single-line collapse)
for marker in 'Setup \(once\):' 'Per-task:' 'Final:'; do
  grep -qE "^[[:space:]]*\*\*${marker}\*\*" <<<"$RULE0" \
    || { echo "FAIL: checklist phase marker '$marker' not on its own line"; exit 1; }
done

# checklist-body tokens, scoped to the checklist rule
for token in 'sdd-workspace' 'plan-constraints.md' 'ledger' 'TASK_BASE' 'H6 chain' 'implement' 'review' 'handoff.json' 'APPROVED' 'Rule: Per-Task Review' 'Rule: Quality Invariants' '**Never** edit repo deliverables' 'H6 CLI only' 'requesting-code-review' 'finishing-a-development-branch'; do
  grep -qF "$token" <<<"$RULE0" \
    || { echo "FAIL: checklist token missing: $token"; exit 1; }
done

echo "OK — line budget"
