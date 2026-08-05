# Cursor attach-only enforce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change Cursor override hooks so `preToolUse` enforce fires only on upstream SKILL attach—not on slash commands—and include `skill_suffix` in pending/deny payloads.

**Architecture:** Manifest-driven generator (`render-cursor-hooks.sh`) emits `override-cursor-detect.sh` (attach-only pending with `skill_suffix`) and `override-cursor-enforce.sh` (deny message references pending `skill_suffix`). Slash enforcement falls back to `.cursor/rules/superpowers-overrides.mdc`. Claude Code hooks unchanged.

**Tech Stack:** Bash, Python 3 (`manifest_targets.py`), jq, pnpm (`generate:overrides`, `validate:overrides`), shell tests under `plugins/superpowers-overrides/tests/`.

**Spec:** [docs/superpowers/specs/2026-08-05-cursor-attach-only-enforce-design.md](../specs/2026-08-05-cursor-attach-only-enforce-design.md)

## Global Constraints

- Cursor harness only; do **not** modify Claude Code `hooks/hooks.json` or `override-prompt-expansion.sh`.
- Pending TTL remains **300s**.
- Pending `trigger` is always **`attach`** when written.
- No `beforeShellExecution` hook.
- No session loaded marker.
- Regenerate committed artifacts via `pnpm run generate:overrides`; never hand-edit `bin/override-cursor-*.sh`.
- Conventional commits; no AI attribution trailers.

## File map

| File | Responsibility |
|------|----------------|
| `plugins/superpowers-overrides/build/render-cursor-hooks.sh` | Generator source: detect attach-only + `skill_suffix`; enforce deny copy |
| `plugins/superpowers-overrides/bin/override-cursor-detect.sh` | Generated detect handler |
| `plugins/superpowers-overrides/bin/override-cursor-enforce.sh` | Generated enforce handler |
| `plugins/superpowers-overrides/tests/override-cursor-detect.test.sh` | Detect regression tests |
| `plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh` | Enforce regression tests |
| `plugins/superpowers-overrides/docs/cross-harness-overrides.md` | Harness enforcement docs |
| `plugins/superpowers-overrides/build/templates/self-check.mdc` | Cursor self-check template (regenerated) |
| `plugins/superpowers-overrides/CHANGELOG.md` | Ship note |

---

### Task 1: Detect attach-only + `skill_suffix` in pending

**Files:**
- Modify: `plugins/superpowers-overrides/build/render-cursor-hooks.sh`
- Modify: `plugins/superpowers-overrides/tests/override-cursor-detect.test.sh`
- Regenerate: `plugins/superpowers-overrides/bin/override-cursor-detect.sh`

**Interfaces:**
- Consumes: `Target.source` from `manifest_targets.load_targets()` (e.g. `./skills/spor-brainstorming`)
- Produces: `write_pending(session_key, override, skill_suffix)` writing JSON `{override, skill_suffix, detected_at, trigger:"attach"}`; detect Python block matches attachments only (no prompt slash loops)

- [ ] **Step 1: Rewrite detect tests for attach-only behavior**

Replace slash/prefix pending assertions in `override-cursor-detect.test.sh` with negative cases; keep attach cases and add `skill_suffix` check.

```bash
#!/usr/bin/env bash
# --- replace lines 10-31 (slash pending expects) with: ---

out=$(printf '%s' '{"conversation_id":"conv-test-1","prompt":"/brainstorming design foo","attachments":[]}' | "$BIN")
echo "$out" | jq -e '.continue == true' >/dev/null
[ ! -f "$PENDING_ROOT/conv-test-1.json" ] || { echo "slash must not write pending"; exit 1; }

printf '%s' '{"conversation_id":"conv-test-1b","prompt":"use /spor-brainstorming please","attachments":[]}' | "$BIN" >/dev/null
[ ! -f "$PENDING_ROOT/conv-test-1b.json" ] || { echo "spor slash must not write pending"; exit 1; }

printf '%s' '{"conversation_id":"conv-test-1c","prompt":"run superpowers:brainstorming","attachments":[]}' | "$BIN" >/dev/null
[ ! -f "$PENDING_ROOT/conv-test-1c.json" ] || { echo "prefixed slash must not write pending"; exit 1; }

printf '%s' '{"conversation_id":"conv-test-1d","prompt":"use superpowers-overrides:spor-brainstorming","attachments":[]}' | "$BIN" >/dev/null
[ ! -f "$PENDING_ROOT/conv-test-1d.json" ] || { echo "spor prefixed must not write pending"; exit 1; }

printf '%s' '{"session_id":"sess-fallback","prompt":"/brainstorming","attachments":[]}' | "$BIN" >/dev/null
[ ! -f "$PENDING_ROOT/sess-fallback.json" ] || { echo "session_id slash must not write pending"; exit 1; }

hash_key=$(python3 -c "import hashlib; print(hashlib.sha256(b'/brainstorming only prompt hash').hexdigest()[:16])")
printf '%s' '{"prompt":"/brainstorming only prompt hash","attachments":[]}' | "$BIN" >/dev/null
[ ! -f "$PENDING_ROOT/${hash_key}.json" ] || { echo "hash slash must not write pending"; exit 1; }
```

After the existing attach block (conv-test-2), add:

```bash
jq -e '.skill_suffix == "skills/spor-brainstorming/SKILL.md"' "$PENDING_ROOT/conv-test-2.json" >/dev/null
```

- [ ] **Step 2: Run detect tests — verify slash cases fail against current generator**

```bash
cd /Users/kang/Projects/oscaner-skills
./plugins/superpowers-overrides/tests/override-cursor-detect.test.sh
```

Expected: **FAIL** — `slash must not write pending` (current detect still writes pending on `/brainstorming`).

- [ ] **Step 3: Update generator — attach-only detect + `skill_suffix`**

In `build/render-cursor-hooks.sh` Python block:

1. Add `skill_suffix` per target when building `target_rows`:

```python
source = t.source.lstrip("./")
skill_suffix = f"{source}/SKILL.md" if not source.endswith(".md") else source
target_rows.append({
    "name": t.name,
    "skill_suffix": skill_suffix,
    "attach_res": attach_res,
})
```

Remove unused keys: `bare_re`, `spor_re`, `prefixed_re`, `spor_prefixed_re`, `upstream_slug` from embed JSON (only if unused in detect script).

2. Replace `write_pending` in generated detect script:

```bash
write_pending() {
  local session_key="$1" override="$2" skill_suffix="$3"
  mkdir -p "$PENDING_ROOT"
  local now
  now=$(date +%s)
  jq -n --arg override "$override" --arg skill_suffix "$skill_suffix" \
    --arg trigger "attach" --argjson detected_at "$now" \
    '{override: $override, skill_suffix: $skill_suffix, trigger: $trigger, detected_at: $detected_at}' \
    > "$(pending_path "$session_key")"
}
```

3. Replace PYMATCH body — **attachment loop only**, emit `skill_suffix` from target row:

```python
for t in TARGETS:
    for att in attachments:
        path = att.get("file_path") or att.get("path") or ""
        if not path:
            continue
        for pat in t["attach_res"]:
            if re.search(pat, path):
                print(json.dumps({
                    "override": t["name"],
                    "skill_suffix": t["skill_suffix"],
                    "trigger": "attach",
                    "session_key": key,
                }))
                sys.exit(0)
```

Delete the four prompt-matching `for t in TARGETS` loops at the bottom of PYMATCH.

4. Update match handler:

```bash
if [ -n "$match" ]; then
  override=$(printf '%s' "$match" | jq -r '.override')
  skill_suffix=$(printf '%s' "$match" | jq -r '.skill_suffix')
  session_key=$(printf '%s' "$match" | jq -r '.session_key')
  write_pending "$session_key" "$override" "$skill_suffix"
fi
```

Remove unused imports from generator top: `bare_slash_prompt_regex`, `spor_slash_prompt_regex` if no longer referenced.

- [ ] **Step 4: Regenerate detect script**

```bash
cd /Users/kang/Projects/oscaner-skills/plugins/superpowers-overrides
bash build/render-cursor-hooks.sh
```

- [ ] **Step 5: Run detect tests — verify pass**

```bash
./plugins/superpowers-overrides/tests/override-cursor-detect.test.sh
```

Expected: `OK — override-cursor-detect`

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-overrides/build/render-cursor-hooks.sh \
  plugins/superpowers-overrides/bin/override-cursor-detect.sh \
  plugins/superpowers-overrides/tests/override-cursor-detect.test.sh
git commit -m "fix: cursor detect attach-only pending with skill_suffix"
```

---

### Task 2: Enforce deny message uses `skill_suffix`

**Files:**
- Modify: `plugins/superpowers-overrides/build/render-cursor-hooks.sh` (enforce template)
- Modify: `plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh`
- Regenerate: `plugins/superpowers-overrides/bin/override-cursor-enforce.sh`

**Interfaces:**
- Consumes: pending JSON `{override, skill_suffix, detected_at, trigger}` from Task 1
- Produces: deny `agent_message` containing `skill_suffix` and `override`; allow logic unchanged

- [ ] **Step 1: Update enforce tests — seed pending manually (not via slash detect)**

Replace Task 1-style detect setup at top of enforce test. New helper to write attach pending:

```bash
write_attach_pending() {
  local session_key="$1"
  local now
  now=$(date +%s)
  jq -n --arg override "spor-brainstorming" \
    --arg skill_suffix "skills/spor-brainstorming/SKILL.md" \
    --arg trigger "attach" --argjson detected_at "$now" \
    '{override: $override, skill_suffix: $skill_suffix, trigger: $trigger, detected_at: $detected_at}' \
    > "$PENDING_ROOT/${session_key}.json"
}

write_attach_pending conv-e1
```

Remove lines that pipe `/brainstorming` into `$DETECT` before enforce assertions (conv-e1, e1b, e2). Keep TTL test but update seeded pending:

```bash
printf '{"override":"spor-brainstorming","skill_suffix":"skills/spor-brainstorming/SKILL.md","detected_at":%s,"trigger":"attach"}' "$old" > "$PENDING_ROOT/conv-expired.json"
```

Add deny message assertion after first deny:

```bash
echo "$deny" | jq -e '.agent_message | contains("skills/spor-brainstorming/SKILL.md")' >/dev/null
echo "$deny" | jq -e '.agent_message | contains("upstream skill attached")' >/dev/null
```

Add slash-no-pending allow case:

```bash
printf '%s' '{"conversation_id":"conv-slash","prompt":"/brainstorming","attachments":[]}' | "$DETECT" >/dev/null
grep=$(printf '%s' '{"conversation_id":"conv-slash","tool_name":"Grep","tool_input":{"pattern":"foo"}}' | "$ENFORCE")
echo "$grep" | jq -e '.permission == "allow"' >/dev/null
```

- [ ] **Step 2: Run enforce tests — verify deny copy test fails**

```bash
./plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh
```

Expected: **FAIL** on `contains("upstream skill attached")` or slash allow case (depending on order).

- [ ] **Step 3: Update enforce deny template in generator**

In `render-cursor-hooks.sh` enforce_script, before the final `jq -n deny`:

```bash
skill_suffix=$(printf '%s' "$pending" | jq -r '.skill_suffix // ("skills/" + $override + "/SKILL.md")')
```

Update deny jq:

```bash
jq -n --arg skill_suffix "$skill_suffix" --arg override "$override" --arg skill_ref "$skill_ref" \
  '{permission:"deny", agent_message: ("MANDATORY OVERRIDE — upstream skill attached without spor override loaded.\nYour FIRST tool call MUST be Read(\"" + $skill_suffix + "\") using the fullPath from agent_skills for " + $override + ".\n(Claude Code: Skill(\"" + $skill_ref + "\") if available.)\nDo NOT follow the upstream skill checklist until the spor override is loaded.")}'
```

Allow block unchanged.

- [ ] **Step 4: Regenerate enforce script**

```bash
bash build/render-cursor-hooks.sh
```

- [ ] **Step 5: Run enforce tests — verify pass**

```bash
./plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh
```

Expected: `OK — override-cursor-enforce`

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-overrides/build/render-cursor-hooks.sh \
  plugins/superpowers-overrides/bin/override-cursor-enforce.sh \
  plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh
git commit -m "fix: cursor enforce deny cites skill_suffix on attach"
```

---

### Task 3: Docs, self-check template, validation

**Files:**
- Modify: `plugins/superpowers-overrides/docs/cross-harness-overrides.md`
- Modify: `plugins/superpowers-overrides/build/templates/self-check.mdc`
- Modify: `plugins/superpowers-overrides/CHANGELOG.md`
- Regenerate: `plugins/superpowers-overrides/build/generated/cursor-self-check.mdc` (via generate:overrides)

**Interfaces:**
- Consumes: shipped detect/enforce behavior from Tasks 1–2
- Produces: updated docs; regenerated self-check; changeset-ready CHANGELOG entry

- [ ] **Step 1: Update cross-harness doc**

In `docs/cross-harness-overrides.md` § Cursor enforcement table:

- detect row: match **upstream SKILL attach paths only** → write pending (with `skill_suffix`)
- Add row note: bare `/brainstorming`, `/spor-*`, prefixed slash → **no pending**; rules fallback
- Pending schema: add `skill_suffix` field; `trigger` always `attach`
- Manual smoke bullet 1: `/brainstorming` → no deny; bullet 2: attach → enforce

- [ ] **Step 2: Update self-check template**

In `build/templates/self-check.mdc`, replace line 22:

```markdown
**Cursor:** plugin-bundled hooks enforce overrides on **upstream SKILL attach only** (`beforeSubmitPrompt` detect + `preToolUse` enforce). Slash commands (`/brainstorming`, `/spor-*`) rely on this self-check rule as primary enforcement. Do **not** install project `.cursor/hooks.json`.
```

- [ ] **Step 3: Regenerate self-check + validate**

```bash
cd /Users/kang/Projects/oscaner-skills
pnpm run generate:overrides
pnpm run validate:overrides
./plugins/superpowers-overrides/tests/validate-overrides-build.sh
```

Expected: all OK, no generator drift.

- [ ] **Step 4: CHANGELOG entry**

Under `## Unreleased` or next patch section in `plugins/superpowers-overrides/CHANGELOG.md`:

```markdown
- **Cursor attach-only enforce**
  - Detect writes pending only on upstream SKILL attach; slash commands no longer trigger preToolUse deny.
  - Pending includes `skill_suffix`; deny message references attach + agent_skills fullPath.
  - Docs and self-check template updated.
```

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/docs/cross-harness-overrides.md \
  plugins/superpowers-overrides/build/templates/self-check.mdc \
  plugins/superpowers-overrides/build/generated/cursor-self-check.mdc \
  plugins/superpowers-overrides/CHANGELOG.md
git commit -m "docs: cursor attach-only enforce behavior"
```

- [ ] **Step 6: Manual smoke (Cursor)**

1. `/brainstorming` + Grep → no deny
2. Attach upstream `brainstorming/SKILL.md` → Grep deny → Read spor allow
3. Hooks Execution Log confirms behavior

---

