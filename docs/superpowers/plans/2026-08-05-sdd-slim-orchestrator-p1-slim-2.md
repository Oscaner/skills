# SDD Orchestrator Universal Gate (p1-slim.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cross-harness PreToolUse gate blocks orchestrator direct repo edits during active SDD tasks; repo changes flow only through H6 CLI subprocesses.

**Architecture:** Shared `bin/lib/sdd-orchestrator-gate.sh` + thin Cursor/Claude adapters; session activation via expansion/detect generators; spor-SDD compact checklist fallback.

**Tech Stack:** Bash, jq, plugin hook generators, `pnpm run generate:overrides`, `pnpm run validate`.

**Spec:** [2026-08-05-sdd-slim-orchestrator-p1-slim-2-design.md](../specs/2026-08-05-sdd-slim-orchestrator-p1-slim-2-design.md)

## Global Constraints

- Plugin-bundled only — **no** consumer-project hook files
- **Same allowlist semantics** on Cursor and Claude Code
- spor-SDD **≤160 lines** after checklist restore
- **No** upstream superpowers SDD changes
- **No** new slash-command skills (shared `lib/` + thin adapters OK)
- **No** `CURSOR-SMOKE.md` edits
- Emit files (**do not hand-edit**): `hooks/hooks-cursor.json`, `bin/override-cursor-detect.sh`, `hooks/hooks.json` — change generators only
- Conventional commits; no attribution trailers

## File map

| File | Responsibility |
|------|----------------|
| `bin/lib/sdd-orchestrator-gate.sh` | Shared state machine + allowlist |
| `bin/sdd-session-activate.sh` | Write minimal/bound pending-sdd JSON |
| `bin/override-cursor-sdd-gate.sh` | Cursor preToolUse JSON adapter |
| `bin/override-claude-sdd-gate.sh` | Claude PreToolUse JSON adapter |
| `build/render-cursor-hooks.sh` | SDD slash detect + dual preToolUse emit |
| `build/render-claude-hooks.sh` | PreToolUse emit for CC |
| `skills/spor-subagent-driven-development/SKILL.md` | Rule 0a item 4 + trims |

---

### Task 1: Shared SDD gate lib + session activate + adapters + unit tests

**Files:**
- Create: `plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh`
- Create: `plugins/superpowers-overrides/bin/sdd-session-activate.sh`
- Create: `plugins/superpowers-overrides/bin/override-cursor-sdd-gate.sh`
- Create: `plugins/superpowers-overrides/bin/override-claude-sdd-gate.sh`
- Create: `plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh`
- Create: `plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh`
- Modify: `plugins/superpowers-overrides/bin/override-prompt-expansion.sh`

**Interfaces:**
- Consumes: spec pending-sdd schema; penf session_key helper pattern from `override-cursor-enforce.sh`
- Produces:
  - `sdd_session_activate(mode, session_key, repo_root)` → writes `$TMPDIR/oscaner-superpowers-overrides/pending-sdd/<session_key>.json`
  - `sdd_gate_decide(harness, tool_name, tool_input_json, session_key)` → stdout `allow` or `deny|<message>`
  - Cursor adapter stdout: `{"permission":"allow"|"deny","agent_message":"..."}`
  - Claude adapter stdout: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"|"deny","permissionDecisionReason":"..."}}`

Bind pending: gate lib calls `sdd-session-activate.sh bind` when ledger header parsed or when bash command matches `*sdd-workspace*` success (parse printed workspace path from stdout — one line).

- [ ] **Step 1: Write failing cursor gate tests (AC#3, #4, #5, fail-open)**

Create `tests/override-cursor-sdd-gate.test.sh` with **four** cases:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/bin/override-cursor-sdd-gate.sh"
ACTIVATE="$ROOT/bin/sdd-session-activate.sh"
PENDING_SDD="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"
REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"
WS="$REPO/.superpowers/sdd/dogfood-test"
mkdir -p "$WS" "$PENDING_SDD"
rm -f "$PENDING_SDD"/*.json

# AC#3 ORCHESTRATING — pending, NO TASK_BASE
"$ACTIVATE" minimal conv-g1 "$REPO"
deny_orch=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$REPO/plugins/foo.txt\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_orch" | jq -e '.permission == "deny"' >/dev/null
allow_git=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"git -C $REPO rev-parse HEAD\"}}" | "$GATE")
echo "$allow_git" | jq -e '.permission == "allow"' >/dev/null

# AC#4 TASK_ACTIVE — add TASK_BASE, no APPROVED handoff
echo 'TASK_BASE: abc' > "$WS/task-1-brief.md"
deny_active=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$REPO/plugins/foo.txt\",\"contents\":\"x\"}}" | "$GATE")
echo "$deny_active" | jq -e '.permission == "deny"' >/dev/null
allow_ws=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Write\",\"tool_input\":{\"path\":\"$WS/progress.md\",\"contents\":\"# ledger\"}}" | "$GATE")
echo "$allow_ws" | jq -e '.permission == "allow"' >/dev/null

# AC#5 Bash allowlist during TASK_ACTIVE
allow_h6=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"$ROOT/bin/sdd-run-task-cursor.sh --task 1 --mode implement --plan foo.md\"}}" | "$GATE")
echo "$allow_h6" | jq -e '.permission == "allow"' >/dev/null
deny_bash=$(printf '%s' "{\"conversation_id\":\"conv-g1\",\"tool_name\":\"Shell\",\"tool_input\":{\"command\":\"rm -rf $REPO/plugins\"}}" | "$GATE")
echo "$deny_bash" | jq -e '.permission == "deny"' >/dev/null

# fail-open — no pending
allow_no_pending=$(printf '%s' '{"conversation_id":"conv-none","tool_name":"Write","tool_input":{"path":"/tmp/x","contents":"y"}}' | "$GATE")
echo "$allow_no_pending" | jq -e '.permission == "allow"' >/dev/null

echo "OK — override-cursor-sdd-gate"
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
chmod +x plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh
plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh
```

Expected: script or gate not found / permission not deny.

- [ ] **Step 3: Implement `bin/lib/sdd-orchestrator-gate.sh`**

Core functions (sourced by adapters):

```bash
SDD_PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"

sdd_pending_path() { echo "$SDD_PENDING_ROOT/$1.json"; }

sdd_is_under_workspace() {
  local path="$1" workspace="$2"
  [[ "$path" == "$workspace/"* ]]
}

sdd_bash_allowed() {
  local cmd="$1" state="$2"
  case "$cmd" in
    *sdd-run-task-*|*sdd-workspace*|*task-brief*|*review-package*) return 0 ;;
    *git\ rev-parse*) return 0 ;;
  esac
  return 1  # ORCHESTRATING and TASK_ACTIVE use same allowlist
}

sdd_gate_decide() {
  # args: harness tool_name tool_input_json session_key
  # states: INACTIVE | ORCHESTRATING | TASK_ACTIVE(N) | between tasks after APPROVED
  # lazy bind: if pending lacks workspace, read ledger line 1:
  #   # SDD ledger — plan: <rel-plan>  → set plan_path; workspace via sdd-workspace or dirname convention
  # frontier: lowest N where handoff missing or jq '.status' != "APPROVED"
  # TASK_COMPLETE: handoff APPROVED and no TASK_BASE on task-(N+1)-brief yet → allow repo writes until next TASK_BASE written
  # pending clear: all ledger lines match 'Task N: complete' + final line present; OR detected_at + 86400 TTL
  # deny message: substitute <harness> in spec template (cursor|claude)
  # return via stdout: allow OR deny|<message>
}
```

Bind pending on `sdd-workspace` success: merge `plan_path`, `workspace` from ledger header.

TASK_ACTIVE when `$workspace/task-N-brief.md` contains `TASK_BASE:` and `$workspace/task-N-handoff.json` missing or `status != APPROVED` (use jq).

- [ ] **Step 4: Implement adapters + activate + expansion hook**

`override-cursor-sdd-gate.sh`: read stdin JSON; map `Write|StrReplace|Edit|WriteNotebook` → path from `path` or `file_path`; call lib; emit Cursor JSON.

`override-claude-sdd-gate.sh`: read CC PreToolUse stdin; map `Write|Edit|MultiEdit` and `Bash`; emit `hookSpecificOutput` shape per spec.

`sdd-session-activate.sh`:

```bash
# usage: sdd-session-activate.sh minimal <session_key> <repo_root>
# usage: sdd-session-activate.sh bind <session_key> <repo_root> <plan_path> <workspace>
```

In `override-prompt-expansion.sh` SDD branches (`subagent-driven-development`, `executing-plans`), after case match call:

```bash
"${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}/bin/sdd-session-activate.sh" minimal "$session_key" "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

(session_key from stdin JSON — same python snippet as enforce script)

- [ ] **Step 5: Write claude adapter test (mirror AC#3/#5 + hookSpecificOutput shape)**

`tests/override-claude-sdd-gate.test.sh` — duplicate ORCHESTRATING + TASK_ACTIVE + Bash deny cases; assert:

```bash
echo "$deny" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null
echo "$deny" | jq -e '.hookSpecificOutput.hookEventName == "PreToolUse"' >/dev/null
echo "$deny" | jq -e '.hookSpecificOutput.permissionDecisionReason | contains("sdd-run-task-claude")' >/dev/null
```

- [ ] **Step 6: Run tests + adapter line-count gate (AC#1)**

```bash
wc -l plugins/superpowers-overrides/bin/override-cursor-sdd-gate.sh \
       plugins/superpowers-overrides/bin/override-claude-sdd-gate.sh
# each ≤50 lines (excluding lib)
plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh
plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh
```

Expected: both print `OK`.

- [ ] **Step 7: Commit**

```bash
git add plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh \
  plugins/superpowers-overrides/bin/sdd-session-activate.sh \
  plugins/superpowers-overrides/bin/override-cursor-sdd-gate.sh \
  plugins/superpowers-overrides/bin/override-claude-sdd-gate.sh \
  plugins/superpowers-overrides/bin/override-prompt-expansion.sh \
  plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh \
  plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh
git commit -m "feat: add cross-harness SDD orchestrator gate core"
```

---

### Task 2: Hook generators + regenerate + validate-overrides dual preToolUse

**Files:**
- Modify: `plugins/superpowers-overrides/build/render-cursor-hooks.sh`
- Modify: `plugins/superpowers-overrides/build/render-claude-hooks.sh`
- Modify: `plugins/superpowers-overrides/tests/validate-overrides-build.sh`
- Regenerate: `hooks/hooks-cursor.json`, `bin/override-cursor-detect.sh`, `hooks/hooks.json`

**Interfaces:**
- Consumes: Task 1 gate scripts on disk
- Produces: dual `preToolUse` in cursor hooks; `PreToolUse` block in claude hooks; detect SDD slash branch

- [ ] **Step 1: Extend `render-cursor-hooks.sh` hooks JSON**

Change `preToolUse` array from one entry to two:

```python
"preToolUse": [
    {"command": "./bin/override-cursor-enforce.sh"},
    {"command": "./bin/override-cursor-sdd-gate.sh"},
],
```

Append to generated detect script (after attach TARGETS loop): SDD slash regex on `prompt` field:

```python
SDD_SLASH_RES = [
    r"(?i)(^|\s)/subagent\-driven\-development(\s|$)",
    r"(?i)(^|\s)/spor\-subagent\-driven\-development(\s|$)",
    r"(?i)(^|\s)/superpowers:subagent\-driven\-development(\s|$)",
    r"(?i)(^|\s)/executing\-plans(\s|$)",
]
# on match: shell out sdd-session-activate.sh minimal with session_key + repo_root
```

- [ ] **Step 2: Extend `render-claude-hooks.sh`**

Add after UserPromptExpansion block:

```python
sdd_gate_hook = {
    "type": "command",
    "command": "${CLAUDE_PLUGIN_ROOT}/bin/override-claude-sdd-gate.sh",
}
hooks["hooks"]["PreToolUse"] = [
    {"matcher": "Write|Edit", "hooks": [sdd_gate_hook]},
    {"matcher": "Bash", "hooks": [sdd_gate_hook]},
]
```

- [ ] **Step 3: Update `validate-overrides-build.sh`**

Replace single enforce assert with:

```python
pre = hooks['hooks']['preToolUse']
assert len(pre) == 2
assert pre[0]['command'] == './bin/override-cursor-enforce.sh'
assert pre[1]['command'] == './bin/override-cursor-sdd-gate.sh'
```

Add CC hooks check:

```python
cc = json.loads((root / 'hooks/hooks.json').read_text())
assert 'PreToolUse' in cc['hooks']
assert len(cc['hooks']['PreToolUse']) == 2
assert cc['hooks']['PreToolUse'][0]['matcher'] == 'Write|Edit'
assert cc['hooks']['PreToolUse'][1]['matcher'] == 'Bash'
assert cc['hooks']['PreToolUse'][0]['hooks'][0]['command'].endswith('override-claude-sdd-gate.sh')
```

Add executable checks for new gate scripts.

- [ ] **Step 4: Regenerate and validate**

```bash
cd /Users/oscaner/Projects/oscaner-skills && pnpm run generate:overrides
chmod +x plugins/superpowers-overrides/bin/override-cursor-sdd-gate.sh \
  plugins/superpowers-overrides/bin/override-claude-sdd-gate.sh
plugins/superpowers-overrides/tests/validate-overrides-build.sh
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/build/render-cursor-hooks.sh \
  plugins/superpowers-overrides/build/render-claude-hooks.sh \
  plugins/superpowers-overrides/tests/validate-overrides-build.sh \
  plugins/superpowers-overrides/hooks/hooks-cursor.json \
  plugins/superpowers-overrides/bin/override-cursor-detect.sh \
  plugins/superpowers-overrides/hooks/hooks.json
git commit -m "feat: wire SDD gate into Cursor and Claude hook generators"
```

---

### Task 3: spor-SDD Rule 0a item 4 + line budget

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`

**Interfaces:**
- Consumes: spec item 4 markdown block verbatim
- Produces: Rule 0a with 4 items; `wc -l` ≤ 160

- [ ] **Step 1: Insert Rule 0a item 4 after item 3**

Paste spec item 4 block exactly (Orchestrator checklist compact).

- [ ] **Step 2: Trim per line budget**

- Rule 1: replace batching **table** with 3-line prose (keep batching semantics)
- Rule 7: merge items 5–6 into item 5 single line (final review + spor-init)
- Remove 2 lowest-value Common Rationalizations rows
- Rule 5a: prepend hook sentence from spec

- [ ] **Step 3: Add 3 Red Flags from spec**

- [ ] **Step 4: Verify**

```bash
wc -l plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
rg -c '^[0-9]+\.' plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md | head -1
# Rule 0a: count numbered items under #### Rule 0a — expect 4
grep -n "Orchestrator checklist" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
```

Expected: lines ≤ 160; item 4 present.

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
git commit -m "feat: restore spor-SDD compact orchestrator checklist (p1-slim.2)"
```

---

### Task 4: CI smoke, synthetic plan, docs, overall inventory

**Files:**
- Create: `plugins/superpowers-overrides/tests/sdd-cli-dry-run-smoke.sh`
- Create: `docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md`
- Modify: `plugins/superpowers-overrides/docs/cross-harness-overrides.md`
- Modify: `scripts/ci-validate.sh` (repo root — step 5 runs `validate-overrides-build.sh`)
- Modify: `docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md`
- Modify: `docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-p1-slim-2-design.md` (§Smoke + §3)

**Interfaces:**
- Consumes: Task 1–3 complete; `SDD_DRY_RUN=1` support in `sdd-run-task-cursor.sh`
- Produces: CI green; synthetic plan; overall p1-slim.2 row

- [ ] **Step 1: Create dry-run smoke script**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN="$ROOT/../../docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md"
export SDD_DRY_RUN=1 SDD_WORKSPACE="${TMPDIR:-/tmp}/sdd-dry-run-$$"
mkdir -p "$SDD_WORKSPACE"
echo "# SDD ledger — plan: $PLAN" > "$SDD_WORKSPACE/progress.md"
echo "constraints" > "$SDD_WORKSPACE/plan-constraints.md"
echo "# task 1" > "$SDD_WORKSPACE/task-1-brief.md"
for mode in implement handoff review; do
  SDD_MODE=$mode SDD_TASK_BRIEF="$SDD_WORKSPACE/task-1-brief.md" \
  SDD_LEDGER="$SDD_WORKSPACE/progress.md" \
  SDD_PLAN_CONSTRAINTS="$SDD_WORKSPACE/plan-constraints.md" \
  SDD_HANDOFF_PATH="$SDD_WORKSPACE/task-1-handoff.json" \
  "$ROOT/bin/sdd-run-task-cursor.sh" --task 1 --mode "$mode" --plan "$PLAN" | head -4
done
echo "OK — sdd-cli-dry-run-smoke"
```

- [ ] **Step 2: Create synthetic dogfood plan**

2 tasks; deliverable = workspace-only `dogfood-marker.txt`; each task brief requires H6 artifacts: `task-N-handoff.json` (`status: APPROVED`), `task-N-test-evidence.json`, `task-N-report.md`; ledger must not contain `inline review`. Include manual E2E checklist comment for AC#8 (Cursor + Claude Code §Smoke — human fills spec table post-run).

- [ ] **Step 3: Wire CI**

In `scripts/ci-validate.sh` after overrides build validation:

```bash
plugins/superpowers-overrides/tests/sdd-cli-dry-run-smoke.sh
plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh
plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh
```

- [ ] **Step 4: Update cross-harness-overrides.md**

Add **SDD orchestrator gate** subsection under Enforcement: pending-sdd path, dual harness PreToolUse, fail-open, **p0 Task-tool known gap** (hook cannot intercept subagent Write), link to spec.

- [ ] **Step 5: Overall inventory + spec smoke table**

Decomposition row:

```markdown
| SDD orchestrator gate | **p1-slim.2** | [p1-slim.2 design](2026-08-05-sdd-slim-orchestrator-p1-slim-2-design.md) | p1-slim.1 ship | impl pending |
```

Charter: `| p1-slim.2 | PreToolUse gate + spor-SDD checklist + dogfood |`

Mark spec §3 **Yes**; §Smoke rows remain **Pending** until manual E2E (document in commit message body for human).

- [ ] **Step 6: Full validate**

```bash
CI=true pnpm run validate
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add plugins/superpowers-overrides/tests/sdd-cli-dry-run-smoke.sh \
  docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md \
  plugins/superpowers-overrides/docs/cross-harness-overrides.md \
  scripts/ci-validate.sh \
  docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md \
  docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-p1-slim-2-design.md
git commit -m "docs: add p1-slim.2 CI smoke, synthetic plan, and inventory"
```

---