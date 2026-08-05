# SDD Token 效率 — Phase penf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship plugin-bundled override enforcement for Claude Code (expanded matchers + expansion script) and Cursor (beforeSubmitPrompt detect + preToolUse enforce), plus self-check/docs/smoke — so first tool is always Read/Skill `spor-*`.

**Architecture:** Manifest-driven generators (`overrides.manifest.json` → shell hook scripts + `hooks.json` + `hooks-cursor.json`). Cursor cannot inject context on submit; detect writes `$TMPDIR/oscaner-superpowers-overrides/pending/<session_key>.json`, enforce resolves the **same** `session_key` and denies non-spor first tools. Claude Code uses existing `UserPromptExpansion` with expanded matchers. No consumer-project hook files.

**Tech Stack:** Bash, Python 3 (`build/lib/manifest_targets.py`), `jq`, `pnpm` emit/validate, Cursor/Claude Code plugin hooks.

**Spec:** [penf design v1.3](../specs/2026-08-05-sdd-token-efficiency-penf-design.md)

## Global Constraints

- **Scope:** Only `plugins/superpowers-overrides` + repo-root marketplace emit/docs; **no** upstream superpowers edits; **no** p0/p1 work.
- **Hook delivery:** Plugin-bundled only; **`spor-init` must NOT write/merge** project `.cursor/hooks.json`.
- **Generation:** Hand-editing `bin/override-*.sh` or generated `hooks/hooks.json` is forbidden — run `pnpm run generate:overrides`.
- **Pending state path:** `$TMPDIR/oscaner-superpowers-overrides/pending/<session_key>.json` where `session_key` = `conversation_id` ?? `session_id` ?? first 16 hex of `sha256(prompt)`.
- **Pending schema:** `{"override":"spor-<slug>","detected_at":<unix>,"trigger":"bare-slash|prefixed|attach"}`; **TTL 300s**.
- **Cursor detect output:** `{"continue": true}` only — do not assume `additional_context`.
- **Cursor enforce:** no matcher on `preToolUse`; script exits `allow` immediately when no pending file.
- **Commits:** conventional (`feat:`, `fix:`, `docs:`, `chore:`); no AI trailers; commit after each task unless user says otherwise.

### Hook I/O contract (Cursor generated scripts)

**Detect stdin** (base fields +): `prompt`, `attachments[]` with `file_path`.

**Detect stdout:** `{"continue": true}`

**Enforce stdin** (base fields +): `tool_name`, `tool_input` (shape varies by tool).

**Enforce stdout allow:** `{"permission": "allow"}`

**Enforce stdout deny:** `{"permission": "deny", "agent_message": "MANDATORY OVERRIDE — FIRST tool call MUST Read or Skill spor-* …"}`

**session_key algorithm** (shared copy-paste or generated helper in both scripts):

```python
def session_key(payload):
    return payload.get("conversation_id") or payload.get("session_id") or sha256_hex(payload.get("prompt", ""))[:16]
```

**Allow paths for Read** (regex, case-insensitive): `(spor-<slug>|superpowers-overrides.*spor-<slug>)/SKILL\.md$`

**Allow for Skill tool:** `tool_input.skill` or equivalent equals `spor-<slug>` or `superpowers-overrides:spor-<slug>`

### trigger_patterns.py consumer map

| Helper | Consumer |
|--------|----------|
| `cc_matcher_bare_slash`, `cc_matcher_spor_slash` | `render-claude-hooks.sh` |
| `bare_slash_prompt_regex`, attach + prefixed checks | `render-cursor-hooks.sh` → detect script |
| `attach_path_regexes` | detect script attachment loop |

---

## File structure (locked)

| File | Responsibility |
|------|----------------|
| `build/lib/trigger_patterns.py` | Shared regex/path patterns from manifest targets |
| `build/render-claude-hooks.sh` | Generate `hooks/hooks.json` matchers |
| `build/render-cursor-hooks.sh` | Generate `hooks/hooks-cursor.json`, `bin/override-cursor-detect.sh`, `bin/override-cursor-enforce.sh` |
| `build/render-hook.sh` | (extend) CC expansion script case table |
| `build/generate-all.sh` | Wire new render scripts + `--check` |
| `hooks/hooks-cursor.json` | Generated Cursor plugin hook manifest |
| `bin/override-cursor-detect.sh` | Generated detect handler |
| `bin/override-cursor-enforce.sh` | Generated enforce handler |
| `tests/override-prompt-expansion.test.sh` | CC expansion shell tests |
| `tests/override-cursor-detect.test.sh` | Cursor detect shell tests |
| `tests/override-cursor-enforce.test.sh` | Cursor enforce shell tests |
| `marketplace/source.json` | Add `superpowers-overrides.cursor.hooks` |
| `build/templates/self-check.mdc` | D3 red flags (source for cursor rules) |
| `build/templates/claude-self-check.md` | D3 red flags (Claude Code) |

---

### Task 1: Shared trigger patterns + generator wiring

**Files:**
- Create: `plugins/superpowers-overrides/build/lib/trigger_patterns.py`
- Create: `plugins/superpowers-overrides/build/render-claude-hooks.sh`
- Modify: `plugins/superpowers-overrides/build/generate-all.sh`
- Test: `plugins/superpowers-overrides/tests/trigger-patterns.test.py`

**Interfaces:**
- Produces: `trigger_patterns.attach_path_regexes(slug)`, `trigger_patterns.bare_slash_prompt_regex(slug)`, `trigger_patterns.cc_matcher_bare_slash(slug)`, `trigger_patterns.cc_matcher_spor_slash(slug)`

- [ ] **Step 1: Write failing Python unit test**

Create `plugins/superpowers-overrides/tests/trigger-patterns.test.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "build/lib"))
from manifest_targets import load_targets
from trigger_patterns import attach_path_regexes, bare_slash_prompt_regex, cc_matcher_bare_slash, cc_matcher_spor_slash

ROOT = Path(__file__).resolve().parents[1]
slugs = {t.upstream_slug for t in load_targets(ROOT)}

def test_all_manifest_slugs_have_patterns():
    for slug in slugs:
        assert bare_slash_prompt_regex(slug)
        assert cc_matcher_bare_slash(slug)
        assert cc_matcher_spor_slash(slug)

def test_attach_patterns_cover_all_four_families():
    joined = "|".join(attach_path_regexes("brainstorming"))
    assert r"/skills/brainstorming/SKILL" in joined or "skills/brainstorming" in joined
    assert "plugins/superpowers/skills" in joined
    assert r"\.claude/plugins/cache" in joined
    assert r"\.cursor/skills" in joined

if __name__ == "__main__":
    test_all_manifest_slugs_have_patterns()
    test_attach_patterns_cover_all_four_families()
    print("OK")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 plugins/superpowers-overrides/tests/trigger-patterns.test.py`
Expected: FAIL `ModuleNotFoundError: No module named 'trigger_patterns'`

- [ ] **Step 3: Implement `trigger_patterns.py` + `render-claude-hooks.sh`**

Implement regex helpers per spec **D1** (CC matchers) and **D2 §Trigger rules** (detect prompt/attach patterns). `render-claude-hooks.sh` emits `hooks/hooks.json` (three `UserPromptExpansion` entries). Wire into `generate-all.sh`.

- [ ] **Step 4: Re-run tests + drift + CI wiring**

Run: `python3 plugins/superpowers-overrides/tests/trigger-patterns.test.py`
Expected: `OK`

Run: `pnpm run generate:overrides && pnpm run validate:overrides`
Expected: ALL PASS

Add to `validate-overrides-build.sh`:

```bash
echo "== validate trigger patterns =="
python3 "$ROOT/tests/trigger-patterns.test.py"
echo "== validate hooks.json matchers =="
python3 -c "
import json, re
from pathlib import Path
root = Path('$ROOT')
hooks = json.loads((root / 'hooks/hooks.json').read_text())
matchers = [e['matcher'] for e in hooks['hooks']['UserPromptExpansion']]
assert any(m.startswith('^superpowers:') for m in matchers)
assert any('/brainstorming' in m for m in matchers)
assert any('spor-' in m for m in matchers)
print('OK')
"
```

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/build/lib/trigger_patterns.py \
  plugins/superpowers-overrides/build/render-claude-hooks.sh \
  plugins/superpowers-overrides/build/generate-all.sh \
  plugins/superpowers-overrides/hooks/hooks.json \
  plugins/superpowers-overrides/tests/trigger-patterns.test.py
git commit -m "feat(overrides): manifest-driven Claude Code hook matchers"
```

---

### Task 2: D1 — Claude Code expansion script (bare + spor slash)

**Files:**
- Modify: `plugins/superpowers-overrides/build/render-hook.sh`
- Modify: `plugins/superpowers-overrides/bin/override-prompt-expansion.sh` (via regenerate)
- Create: `plugins/superpowers-overrides/tests/override-prompt-expansion.test.sh`
- Modify: `plugins/superpowers-overrides/tests/validate-overrides-build.sh`

**Interfaces:**
- Consumes: manifest targets via existing `render-hook.sh` Python block
- Produces: expansion script mapping `command_name`: `superpowers:<slug>`, `/<slug>`, `/spor-<slug>` → `superpowers-overrides:spor-<slug>`

- [ ] **Step 1: Write failing shell test**

Create `plugins/superpowers-overrides/tests/override-prompt-expansion.test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/override-prompt-expansion.sh"
command -v jq >/dev/null

run() {
  local name="$1" input="$2"
  out=$(printf '%s' "$input" | "$BIN")
  echo "$out" | jq -e '.additionalContext | contains("MANDATORY OVERRIDE")' >/dev/null \
    || { echo "FAIL $name: $out"; exit 1; }
  echo "$out" | jq -e --arg e "$3" '.additionalContext | contains($e)' >/dev/null \
    || { echo "FAIL $name slug: $out"; exit 1; }
}

run superpowers-prefix '{"command_name":"superpowers:brainstorming"}' 'spor-brainstorming'
run bare-slash '{"command_name":"/brainstorming"}' 'spor-brainstorming'
run spor-slash '{"command_name":"/spor-brainstorming"}' 'spor-brainstorming'
run writing-plans '{"command_name":"superpowers:writing-plans"}' 'spor-writing-plans'
no_match=$(printf '%s' '{"command_name":"other:thing"}' | "$BIN" || true)
[ -z "$no_match" ] && echo "OK no-match exits 0 empty" || echo "$no_match" | jq -e '.additionalContext' >/dev/null && exit 1 || true
echo "OK — override-prompt-expansion"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `chmod +x plugins/superpowers-overrides/tests/override-prompt-expansion.test.sh && plugins/superpowers-overrides/tests/override-prompt-expansion.test.sh`
Expected: FAIL on `bare-slash` or `spor-slash` case arms

- [ ] **Step 3: Extend `render-hook.sh`**

Add `case` arms for each manifest target:
- `superpowers:<slug>` (existing)
- `/<slug>` and `/spor-<slug>` (new)

Do **not** add sed fallback — explicit case table only (manifest is source of truth).

Regenerate: `pnpm run generate:overrides`

- [ ] **Step 4: Re-run test + wire CI**

Add to `validate-overrides-build.sh` before `ALL PASS`:

```bash
echo "== validate expansion script =="
"$ROOT/tests/override-prompt-expansion.test.sh"
```

Run: `plugins/superpowers-overrides/tests/override-prompt-expansion.test.sh`
Expected: `OK — override-prompt-expansion`

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/build/render-hook.sh \
  plugins/superpowers-overrides/bin/override-prompt-expansion.sh \
  plugins/superpowers-overrides/tests/override-prompt-expansion.test.sh \
  plugins/superpowers-overrides/tests/validate-overrides-build.sh
git commit -m "feat(overrides): expand Claude Code prompt expansion for bare slash"
```

---

### Task 3: D2 — Cursor detect + enforce hooks (generated)

**Files:**
- Create: `plugins/superpowers-overrides/build/render-cursor-hooks.sh`
- Create: `plugins/superpowers-overrides/hooks/hooks-cursor.json` (generated)
- Create: `plugins/superpowers-overrides/bin/override-cursor-detect.sh` (generated)
- Create: `plugins/superpowers-overrides/bin/override-cursor-enforce.sh` (generated)
- Create: `plugins/superpowers-overrides/tests/override-cursor-detect.test.sh`
- Create: `plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh`
- Modify: `plugins/superpowers-overrides/build/generate-all.sh`

**Interfaces:**
- Produces detect stdout: `{"continue":true}`
- Produces enforce stdout: `{"permission":"allow"}` or `{"permission":"deny","agent_message":"MANDATORY OVERRIDE …"}`
- Pending helpers (inline in generated scripts): `pending_path(session_key)`, `write_pending`, `read_pending`, `clear_pending`, `is_expired`

- [ ] **Step 1: Write failing detect test**

Create `plugins/superpowers-overrides/tests/override-cursor-detect.test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/override-cursor-detect.sh"
PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
SPOR_SKILL="$ROOT/skills/spor-brainstorming/SKILL.md"
rm -rf "$PENDING_ROOT"
mkdir -p "$PENDING_ROOT"

out=$(printf '%s' '{"conversation_id":"conv-test-1","prompt":"/brainstorming design foo","attachments":[]}' | "$BIN")
echo "$out" | jq -e '.continue == true' >/dev/null
[ -f "$PENDING_ROOT/conv-test-1.json" ] || { echo "missing pending"; exit 1; }
jq -e '.override == "spor-brainstorming"' "$PENDING_ROOT/conv-test-1.json" >/dev/null

# spor slash + prefixed prompt triggers
printf '%s' '{"conversation_id":"conv-test-1b","prompt":"use /spor-brainstorming please","attachments":[]}' | "$BIN" >/dev/null
jq -e '.override == "spor-brainstorming"' "$PENDING_ROOT/conv-test-1b.json" >/dev/null

printf '%s' '{"conversation_id":"conv-test-1c","prompt":"run superpowers:brainstorming","attachments":[]}' | "$BIN" >/dev/null
jq -e '.trigger == "prefixed"' "$PENDING_ROOT/conv-test-1c.json" >/dev/null

printf '%s' '{"conversation_id":"conv-test-1d","prompt":"use superpowers-overrides:spor-brainstorming","attachments":[]}' | "$BIN" >/dev/null
jq -e '.override == "spor-brainstorming"' "$PENDING_ROOT/conv-test-1d.json" >/dev/null

printf '%s' '{"session_id":"sess-fallback","prompt":"/brainstorming","attachments":[]}' | "$BIN" >/dev/null
[ -f "$PENDING_ROOT/sess-fallback.json" ] || { echo "missing session_id pending"; exit 1; }

# session_key fallback when no conversation_id — hash via python3 (portable)
hash_key=$(python3 -c "import hashlib; print(hashlib.sha256(b'/brainstorming only prompt hash').hexdigest()[:16])")
printf '%s' '{"prompt":"/brainstorming only prompt hash","attachments":[]}' | "$BIN" >/dev/null
[ -f "$PENDING_ROOT/${hash_key}.json" ] || { echo "missing hash pending"; exit 1; }

cache_path="$SPOR_SKILL"
# simulate upstream attach by copying path shape
upstream_cache="${PENDING_ROOT%/pending}/fake-cache/brainstorming/SKILL.md"
mkdir -p "$(dirname "$upstream_cache")" && cp "$SPOR_SKILL" "$upstream_cache"
out2=$(printf '%s' "{\"conversation_id\":\"conv-test-2\",\"prompt\":\"please review\",\"attachments\":[{\"type\":\"file\",\"file_path\":\"$upstream_cache\"}]}" | "$BIN")
echo "$out2" | jq -e '.continue == true' >/dev/null
jq -e '.trigger == "attach"' "$PENDING_ROOT/conv-test-2.json" >/dev/null

repo_attach="$(dirname "$ROOT")/superpowers/skills/brainstorming/SKILL.md"
if [ -f "$repo_attach" ]; then
  printf '%s' "{\"conversation_id\":\"conv-test-3\",\"prompt\":\"x\",\"attachments\":[{\"type\":\"file\",\"file_path\":\"$repo_attach\"}]}" | "$BIN" >/dev/null
  jq -e '.override == "spor-brainstorming"' "$PENDING_ROOT/conv-test-3.json" >/dev/null
fi

cursor_skills="$ROOT/../.cursor/skills/brainstorming/SKILL.md"
if [ -f "$cursor_skills" ]; then
  printf '%s' "{\"conversation_id\":\"conv-test-4\",\"prompt\":\"x\",\"attachments\":[{\"type\":\"file\",\"file_path\":\"$cursor_skills\"}]}" | "$BIN" >/dev/null
  jq -e '.trigger == "attach"' "$PENDING_ROOT/conv-test-4.json" >/dev/null
fi
echo "OK — override-cursor-detect"
```

- [ ] **Step 2: Write failing enforce test**

Create `plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT="$ROOT/bin/override-cursor-detect.sh"
ENFORCE="$ROOT/bin/override-cursor-enforce.sh"
PENDING_ROOT="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending"
rm -rf "$PENDING_ROOT" && mkdir -p "$PENDING_ROOT"

printf '%s' '{"conversation_id":"conv-e1","prompt":"/brainstorming","attachments":[]}' | "$DETECT" >/dev/null

deny=$(printf '%s' '{"conversation_id":"conv-e1","tool_name":"Grep","tool_input":{"pattern":"foo"}}' | "$ENFORCE")
echo "$deny" | jq -e '.permission == "deny"' >/dev/null
echo "$deny" | jq -e '.agent_message | contains("MANDATORY OVERRIDE")' >/dev/null

allow=$(printf '%s' "{\"conversation_id\":\"conv-e1\",\"tool_name\":\"Read\",\"tool_input\":{\"path\":\"$SPOR_SKILL\"}}" | "$ENFORCE")
echo "$allow" | jq -e '.permission == "allow"' >/dev/null
[ ! -f "$PENDING_ROOT/conv-e1.json" ] || { echo "pending not cleared"; exit 1; }

# Skill invocation as valid first tool
printf '%s' '{"conversation_id":"conv-e2","prompt":"/brainstorming","attachments":[]}' | "$DETECT" >/dev/null
allow_skill=$(printf '%s' '{"conversation_id":"conv-e2","tool_name":"Skill","tool_input":{"skill":"superpowers-overrides:spor-brainstorming"}}' | "$ENFORCE")
echo "$allow_skill" | jq -e '.permission == "allow"' >/dev/null

# TTL expiry
now=$(date +%s)
old=$((now - 301))
mkdir -p "$PENDING_ROOT"
printf '{"override":"spor-brainstorming","detected_at":%s,"trigger":"bare-slash"}' "$old" > "$PENDING_ROOT/conv-expired.json"
expired=$(printf '%s' '{"conversation_id":"conv-expired","tool_name":"Grep","tool_input":{"pattern":"x"}}' | "$ENFORCE")
echo "$expired" | jq -e '.permission == "allow"' >/dev/null
[ ! -f "$PENDING_ROOT/conv-expired.json" ] || { echo "expired pending not removed"; exit 1; }

noop=$(printf '%s' '{"conversation_id":"conv-none","tool_name":"Shell","tool_input":{"command":"true"}}' | "$ENFORCE")
echo "$noop" | jq -e '.permission == "allow"' >/dev/null
echo "OK — override-cursor-enforce"
```

- [ ] **Step 3: Run tests to verify they fail**

Run both test scripts (after `chmod +x`).
Expected: FAIL — scripts or pending logic missing

- [ ] **Step 4: Implement `render-cursor-hooks.sh`**

Generator emits:

`hooks/hooks-cursor.json`:

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [
      {
        "command": "./bin/override-cursor-detect.sh",
        "matcher": "UserPromptSubmit"
      }
    ],
    "preToolUse": [
      {
        "command": "./bin/override-cursor-enforce.sh"
      }
    ]
  }
}
```

Detect script: jq parse → match prompt/attachments via manifest-generated regex table → write pending → `jq -n '{continue:true}'`.

Enforce script: resolve **same session_key algorithm** as detect → load pending → TTL check → allow Read/Skill spor paths per Hook I/O contract → deny others.

Wire `render-cursor-hooks.sh` into `generate-all.sh`. Run `pnpm run generate:overrides`. **Ensure** `chmod +x` on emitted `bin/override-cursor-*.sh` (mirror `render-hook.sh`).

- [ ] **Step 5: Re-run tests + add to validate-overrides-build.sh**

```bash
"$ROOT/tests/override-cursor-detect.test.sh"
"$ROOT/tests/override-cursor-enforce.test.sh"
```

Expected: both `OK`

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-overrides/build/render-cursor-hooks.sh \
  plugins/superpowers-overrides/hooks/hooks-cursor.json \
  plugins/superpowers-overrides/bin/override-cursor-*.sh \
  plugins/superpowers-overrides/tests/override-cursor-*.test.sh \
  plugins/superpowers-overrides/build/generate-all.sh \
  plugins/superpowers-overrides/tests/validate-overrides-build.sh
git commit -m "feat(overrides): Cursor plugin detect/enforce hooks"
```

---

### Task 4: Marketplace emit + CI executable checks

**Files:**
- Modify: `marketplace/source.json`
- Modify: `cursor-plugins/superpowers-overrides/.cursor-plugin/plugin.json` (via emit)
- Modify: `scripts/ci-validate.sh`

- [ ] **Step 1: Add cursor.hooks to marketplace source**

In `marketplace/source.json`, under `superpowers-overrides.cursor`:

```json
"hooks": "../../plugins/superpowers-overrides/hooks/hooks-cursor.json"
```

- [ ] **Step 2: Emit and verify wrapper**

Run: `pnpm run emit`

Verify:
- `cursor-plugins/superpowers-overrides/.cursor-plugin/plugin.json` has `"hooks": "../../plugins/superpowers-overrides/hooks/hooks-cursor.json"`
- `.cursor-plugin/marketplace.json` superpowers-overrides entry references hooks

Drift gate: `pnpm run validate` (includes `emit-marketplace.mjs --check`)

- [ ] **Step 3: Extend ci-validate.sh step 4**

Add executable checks:

```bash
[ -f plugins/superpowers-overrides/hooks/hooks-cursor.json ] && echo "OK — hooks-cursor.json"
[ -x plugins/superpowers-overrides/bin/override-cursor-detect.sh ] && echo "OK — cursor-detect"
[ -x plugins/superpowers-overrides/bin/override-cursor-enforce.sh ] && echo "OK — cursor-enforce"
```

- [ ] **Step 4: Run full validate**

Run: `pnpm run validate`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add marketplace/source.json cursor-plugins/superpowers-overrides/.cursor-plugin/plugin.json \
  .cursor-plugin/marketplace.json scripts/ci-validate.sh
git commit -m "feat(overrides): wire Cursor plugin hooks into marketplace emit"
```

---

### Task 5: D3 self-check templates + spor-init

**Files:**
- Modify: `plugins/superpowers-overrides/build/templates/self-check.mdc`
- Modify: `plugins/superpowers-overrides/build/templates/claude-self-check.md`
- Modify: `plugins/superpowers-overrides/skills/spor-init/SKILL.md`
- Regenerate: `build/generated/cursor-self-check.mdc`, `build/generated/claude-self-check.md`

- [ ] **Step 1: Add red-flag block to both templates**

Insert after self-check intro in each template:

```markdown
### Red flags — manual attach upstream

- User attached **upstream** `superpowers/*/SKILL.md` body → you **still** Read/Skill `spor-*` first
- Any tool call before spor override loaded
- Attaching upstream SKILL full text is an **anti-pattern** — use `/spor-*`, bare upstream slash, or agent_skills list; never paste upstream SKILL.md as inline context
```

For Cursor template, add note: plugin hooks detect/enforce; rules are **fallback only**.

- [ ] **Step 2: Update spor-init reminder (line ~27)**

Replace «rely on rules intercept for upstream triggers» with:

«Cursor: plugin-bundled hooks (`beforeSubmitPrompt` + `preToolUse`) enforce overrides; rules are fallback. Claude Code: UserPromptExpansion hooks. **Do not** install project `.cursor/hooks.json`.»

- [ ] **Step 3: Regenerate + validate**

Run: `pnpm run generate:overrides && pnpm run validate:overrides`
Expected: ALL PASS (including dogfood stamp check)

- [ ] **Step 3.5: Refresh dogfood rules if stamp drift**

If validate fails on `.cursor/rules/superpowers-overrides.mdc` version stamp, run `/spor-init` (or copy `build/generated/cursor-self-check.mdc`) and include `.cursor/rules/superpowers-overrides.mdc` in commit.

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-overrides/build/templates/ \
  plugins/superpowers-overrides/build/generated/ \
  plugins/superpowers-overrides/skills/spor-init/SKILL.md
git commit -m "docs(overrides): self-check red flags and spor-init hook guidance"
```

---

### Task 6: D4 documentation + CURSOR-SMOKE blocking

**Files:**
- Modify: `plugins/superpowers-overrides/README.md`
- Modify: `plugins/superpowers-overrides/README.zh-CN.md`
- Modify: `plugins/superpowers-overrides/docs/CURSOR-SMOKE.md`
- Modify: `plugins/superpowers-overrides/docs/cross-harness-overrides.md`

- [ ] **Step 1: Update cross-harness-overrides §Enforcement**

Document Cursor plugin-bundled `hooks-cursor.json` (detect/enforce), Claude Code triple matcher, pending state contract, anti-pattern for manual upstream attach.

- [ ] **Step 2: Harden CURSOR-SMOKE.md (blocking checklist)**

Add **blocking** section with checkboxes mirroring spec AC D2/D4:

- [ ] Settings → Hooks shows `superpowers-overrides` `beforeSubmitPrompt` + `preToolUse`
- [ ] `/brainstorming` → wrong first tool denied; Read/Skill spor allowed
- [ ] `/spor-brainstorming` → detect + enforce path works
- [ ] Prompt containing `superpowers:brainstorming` → detect fires
- [ ] Attach upstream `brainstorming/SKILL.md` (repo `plugins/superpowers/skills/...` **or** cache path) → detect fires
- [ ] Attach via `.cursor/skills/brainstorming/SKILL.md` → detect fires
- [ ] `git status` in consumer project shows **no** new `.cursor/hooks.json`
- [ ] Claude Code `/brainstorming` expansion contains `MANDATORY OVERRIDE`

- [ ] **Step 3: README EN/ZH — Manual skill attach section**

Short subsection: attach spor or use slash; never attach upstream SKILL; hooks ship with plugin.

- [ ] **Step 4: Final validate + manual smoke note**

Run: `pnpm run validate`
Record completion in `plugins/superpowers-overrides/docs/CURSOR-SMOKE.md` top: `<!-- penf ship smoke: YYYY-MM-DD by <name> -->` after manual blocking run.

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/README.md plugins/superpowers-overrides/README.zh-CN.md \
  plugins/superpowers-overrides/docs/CURSOR-SMOKE.md plugins/superpowers-overrides/docs/cross-harness-overrides.md
git commit -m "docs(overrides): penf smoke checklist and plugin hook documentation"
```

---

## Spec coverage checklist (plan author)

| Spec section | Task |
|--------------|------|
| D1 CC matchers + expansion | Task 1–2 |
| D2 Cursor detect/enforce + pending | Task 3 |
| D2 marketplace plugin hooks | Task 4 |
| D3 self-check red flags | Task 5 |
| D4 README / CURSOR-SMOKE / cross-harness | Task 6 |
| D5 YAGNI | — (explicitly skipped) |
| spor-init no project hooks | Task 5 |
| DoD `pnpm run validate` | Task 4 + 6 |

