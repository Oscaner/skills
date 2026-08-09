# SDD 语义守卫 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two CI semantic guards so the Rule 0 checklist structure and `Rule N` cross-references survive slimming/renames — catching what review previously caught by hand (issue #52).

**Architecture:** Two independent guards. (1) `sdd-orchestrator-line-budget.test.sh` gains a Rule 0 checklist anchor block: line-anchored phase-marker greps (enforce own-line structure) + token greps scoped to the checklist sub-block. (2) A new Python `rule-reference.test.py` resolver builds a heading index over every override skill and checks each numeric `Rule N` reference resolves via link / scoped prefix / same-file / a 3-entry allowlist, else FAILs. Both wire into `validate-overrides-build.sh` → `pnpm run validate`. Prerequisite: purge ~10 stale `Rule 0a`/`Rule 0b` references and 3 exit-2 doc drifts.

**Tech Stack:** bash (line-budget test), Python 3 stdlib (resolver, no deps), `sed`/`grep`, `pnpm run validate`.

## Global Constraints

- Conventional commits; no attribution/AI-generation trailers in commit messages.
- No `git worktree`.
- `pnpm run validate` must pass after every task (runs `validate-overrides-build.sh` + line-budget + the new resolver).
- Do **not** modify existing AC# blocks in `sdd-orchestrator-line-budget.test.sh` (AC#1 p0-fallback, AC#2 H6 tables, Task 4 D3/D6, Task 6 D6 assertions) — only append the new anchor block.
- `spor-sdd-p0-fallback` stays on disk and must remain **absent** from `overrides.manifest.json` `targets[]` (p1-slim.3 AC#9).
- Guard 2 scans `plugins/superpowers-overrides/skills/*/SKILL.md` (body **and** frontmatter `description:`); `docs/` reference docs are not scanned.
- Guard 1 anchors are scoped to the Rule 0 block / checklist sub-block in `spor-subagent-driven-development/SKILL.md`.
- Resolver matches numeric rule IDs only (`Rule [0-9]+[a-z]?`); `Rule H1`–`H6`, bare `D1`–`D4`, and plural `Rules N` forms are out of scope.

---

### Task 1: Purge stale `Rule 0a` / `Rule 0b` references

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md:95`
- Modify: `plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md:28`
- Modify: `plugins/superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md:51`
- Modify: `plugins/superpowers-overrides/skills/spor-sdd-p0-fallback/SKILL.md` (5 refs, 4 locations)
- Modify: `plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh:302`
- Modify: `plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh:115`

**Interfaces:**
- Consumes: none (pure doc/script edits).
- Produces: a skill tree with **zero** numeric `Rule 0a`/`Rule 0b` references — the prerequisite for Task 4's resolver to pass. `spor-sdd-p0-fallback` reframed as dormant so its post-fix `Rule 0` reference resolves cross-file to spor-SDD.

The new `rule-reference.test.py` (Task 4) FAILs on any dangling `Rule 0a`/`Rule 0b`. This task removes them all. All edits are mechanical string replacements.

- [ ] **Step 1: spor-SDD Red Flag label (`spor-subagent-driven-development/SKILL.md:95`)**

Replace the line `- "Rule 0a — I'll paraphrase tdd in the override instead of citing implement.md."` with:

```markdown
- "Rule 0 — I'll paraphrase tdd in the override instead of citing implement.md."
```

- [ ] **Step 2: executing-plans commit rule (`spor-executing-plans/SKILL.md:28`)**

Replace `commit is SDD Rule 0a + \`templates/sdd-cli/implement.md\`` with `commit is SDD Rule 0 + \`templates/sdd-cli/implement.md\`` (full line: `When Rule 1 redirects to SDD, this rule does not apply — commit is SDD Rule 0 + \`templates/sdd-cli/implement.md\` or Rule 5b (p0).`). Keep `Rule 5b (p0)` unchanged.

- [ ] **Step 3: review-dispatch in-session gate (`spor-token-efficient-review-dispatch/SKILL.md:51`)**

Replace `runs in-session (Rule 0b), see` with `runs in-session (p0 path), see` (full line: `When SDD per-task review runs in-session (p0 path), see [\`spor-sdd-p0-fallback\`](../spor-sdd-p0-fallback/SKILL.md) Appendix D4. CLI-default path: D4 runs inside H6 \`review\` subprocess — orchestrator does not load D4 prose.`).

- [ ] **Step 4: p0-fallback dormancy (`spor-sdd-p0-fallback/SKILL.md`, 4 locations)**

4a. Frontmatter description (line 3): replace `description: p0 in-session SDD worker rules — Read only when spor-SDD Rule 0b triggers. Not an override slash target.` with `description: p0 in-session SDD worker rules — dormant since CLI-mandatory (7c1a7b8); retained as p0 reference. Not an override slash target.` (keep `Contains Rules 3, 5b, 5c and D4 review gate.`).

4b. Rule 3 body (line 10): replace `When Rule 0a applies, skip this rule — see \`templates/sdd-cli/implement.md\`.` with `When Rule 0 applies (CLI default), skip — \`templates/sdd-cli/implement.md\` is SOT.`

4c. Rule 3 body (line 12): replace `(Rule 0b / p0 path)` with `(p0 path)` — full phrase: `When dispatching an **implementer** subagent to write code (p0 path), delegate implementation discipline to [\`mattpocock-skills:tdd\`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md).`

4d. Rule 5b body (line 22): replace `When Rule 0a applies, skip — \`templates/sdd-cli/implement.md\` is SOT.` with `When Rule 0 applies (CLI default), skip — \`templates/sdd-cli/implement.md\` is SOT.`

4e. Rule 5c body (line 28): replace `When Rule 0a applies, skip — H6 + \`templates/sdd-cli/\` is SOT.` with `When Rule 0 applies (CLI default), skip — H6 + \`templates/sdd-cli/\` is SOT.`

- [ ] **Step 5: gate deny message + smoke needle (change together — the smoke test asserts the deny message)**

5a. `bin/lib/sdd-orchestrator-gate.sh:302`: replace the line `	See spor-SDD Rule 0a item 4.` with `	See spor-SDD Rule 0 item 4.` (keep the leading tab).

5b. `tests/sdd-gate-allow-deny-smoke.sh:115`: replace the needle `"See spor-SDD Rule 0a item 4."` with `"See spor-SDD Rule 0 item 4."` (this assertion needle must match the new deny message or the smoke test fails).

- [ ] **Step 6: Verify no stale refs remain**

Run from the repo root:

```bash
grep -rn "Rule 0a\|Rule 0b" plugins/superpowers-overrides/skills/ plugins/superpowers-overrides/bin/ plugins/superpowers-overrides/tests/
```

Expected: **no output** (the only remaining `Rule 0a` occurrences anywhere are historical CHANGELOG entries and the resolver's own allowed fixture, which live outside these three dirs).

- [ ] **Step 7: Run the full validation**

Run: `pnpm run validate`
Expected: `ALL PASS` (the updated smoke needle keeps `sdd-gate-allow-deny-smoke` green; nothing else changes).

- [ ] **Step 8: Commit**

```bash
git add plugins/superpowers-overrides/skills plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh
git commit -m "fix: purge stale Rule 0a/0b references across SDD skills and gate (issue #52)"
```

### Task 2: Align exit-2 docs to CLI-mandatory BLOCKED + Rule 0 checklist contract note

**Files:**
- Modify: `plugins/superpowers-overrides/docs/sdd-h6-reference.md:110` (exit-2 drift) + top note (new)
- Modify: `plugins/superpowers-overrides/README.md:119`
- Modify: `plugins/superpowers-overrides/README.zh-CN.md:118`

**Interfaces:**
- Consumes: none.
- Produces: `sdd-h6-reference.md` carrying the Rule 0 checklist semantic-contract note (spec AC#8), and exit-2 semantics consistent with spor-SDD Rule 7 (BLOCKED). The 3-line drift is prose the Task 4 resolver does not scan — hence its own task with an explicit AC.

- [ ] **Step 1: h6-reference exit-2 line (`docs/sdd-h6-reference.md:110`)**

Replace `cursor/claude CLI not in PATH → exit 2 → p0 fallback.` with `cursor/claude CLI not in PATH → exit 2 → orchestrator **BLOCKED**.` — full line: `Stub harness selected → exit 1 → orchestrator **BLOCKED** (not p0 fallback). cursor/claude CLI not in PATH → exit 2 → orchestrator **BLOCKED**.`

- [ ] **Step 2: README exit-2 line (`README.md:119`)**

Replace `CLI missing → exit 2 → p0 fallback.` with `CLI missing → exit 2 → orchestrator **BLOCKED**.` — full line: `Stub harness → exit 1 → orchestrator **BLOCKED** (not in-session p0 fallback). CLI missing → exit 2 → orchestrator **BLOCKED**. See [cross-harness-overrides.md](docs/cross-harness-overrides.md#sdd-cli-harness-scripts-p1).`

- [ ] **Step 3: README.zh-CN exit-2 line (`README.zh-CN.md:118`)**

Replace `CLI 缺失 → exit 2 → p0 fallback。` with `CLI 缺失 → exit 2 → orchestrator **BLOCKED**。` — full line: `Stub harness → exit 1 → orchestrator **BLOCKED**（非 in-session p0 fallback）。CLI 缺失 → exit 2 → orchestrator **BLOCKED**。详见 [cross-harness-overrides.md](docs/cross-harness-overrides.md#sdd-cli-harness-scripts-p1)。`

- [ ] **Step 4: Add Rule 0 checklist semantic-contract note to `docs/sdd-h6-reference.md`**

Immediately after the file's opening blockquote (the `> Orchestrator gate discipline: ... H1–H5` line) and before `## H6 — CLI dispatch (p1)`, insert:

```markdown
> **Rule 0 checklist 语义契约:** Rule 0 的三阶段 phase 标记与关键 token 不是 line-budget 瘦身目标 — 瘦身不得删除/压缩 checklist 的 phase 结构或关键 token；`sdd-orchestrator-line-budget.test.sh` 会断言（issue #52 Guard 1）。
```

- [ ] **Step 5: Verify**

Run from the repo root:

```bash
grep -rn "exit 2 → p0 fallback\|CLI 缺失 → exit 2 → p0 fallback\|CLI missing → exit 2 → p0 fallback" plugins/superpowers-overrides/docs/ plugins/superpowers-overrides/README.md plugins/superpowers-overrides/README.zh-CN.md
```

Expected: **no output**. Then confirm the note exists: `grep -qF "Rule 0 checklist 语义契约" plugins/superpowers-overrides/docs/sdd-h6-reference.md && echo OK`.

- [ ] **Step 6: Run the full validation**

Run: `pnpm run validate`
Expected: `ALL PASS`.

- [ ] **Step 7: Commit**

```bash
git add plugins/superpowers-overrides/docs/sdd-h6-reference.md plugins/superpowers-overrides/README.md plugins/superpowers-overrides/README.zh-CN.md
git commit -m "docs: align exit-2 semantics to CLI-mandatory BLOCKED + Rule 0 checklist contract note (issue #52)"
```

### Task 3: Guard 1 — Rule 0 checklist semantic anchors

**Files:**
- Modify: `plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh` (append AC#8 block before the final `echo "OK — line budget"`)

**Interfaces:**
- Consumes: the Rule 0 block and checklist sub-block in `spor-subagent-driven-development/SKILL.md` (unchanged structure — already intact from `7fc1864`).
- Produces: CI enforcement that the three phase markers stay on their own lines and the 15 load-bearing tokens survive — the guard that FAILs on a `ca3aaa1`-style single-line collapse.

- [ ] **Step 1: Append the anchor AC# block**

Open `tests/sdd-orchestrator-line-budget.test.sh` and insert the following immediately **before** the final line `echo "OK — line budget"` (keep every existing AC# block untouched):

```bash
# AC#8 — Rule 0 checklist semantic anchors (issue #52 Guard 1)
RULE0="$(sed -n '/^### Rule 0 /,/^### Rule 1/p' "$SKILLS/spor-subagent-driven-development/SKILL.md")"
CHECK="$(sed -n '/^4\. \*\*Orchestrator checklist/,/^### Rule 1/p' <<<"$RULE0")"

# three phase markers, each on its own line (line-anchored — blocks single-line collapse)
for marker in 'Setup \(once\):' 'Per-task:' 'Final:'; do
  grep -qE "^[[:space:]]*\*\*${marker}\*\*" <<<"$CHECK" \
    || { echo "FAIL: checklist phase marker '$marker' not on its own line"; exit 1; }
done

# checklist-body tokens, scoped to the checklist sub-block
for token in 'sdd-workspace' 'plan-constraints.md' 'ledger' 'TASK_BASE' 'H6 chain' 'implement' 'review' 'handoff.json' 'APPROVED' 'Rule 5a' 'Rule 6' '**Never** edit repo deliverables' 'H6 CLI only' 'requesting-code-review' 'finishing-a-development-branch'; do
  grep -qF "$token" <<<"$CHECK" \
    || { echo "FAIL: checklist token missing: $token"; exit 1; }
done
```

- [ ] **Step 2: Run the line-budget test — expect PASS**

Run: `./plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh`
Expected: ends with `OK — line budget` (the current checklist contains all 18 anchors: 3 markers + 15 tokens).

- [ ] **Step 3: Negative check A — delete a phase marker (temp, revert after)**

Temporarily delete the `**Final:**` line from the checklist in `skills/spor-subagent-driven-development/SKILL.md`, then:

Run: `./plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh`
Expected: `FAIL: checklist phase marker 'Final:' not on its own line` + exit 1.

Revert the deletion (`git checkout -- plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`).

- [ ] **Step 4: Negative check B — single-line reflow (temp, revert after)**

Temporarily collapse the three checklist phase lines into one line (keep all tokens, e.g. `**Setup (once):** ... **Per-task:** ... **Final:** ...` on a single line), then:

Run: `./plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh`
Expected: FAIL (the line-anchored `^[[:space:]]*\*\*...` greps no longer match — the marker is mid-line, not line-initial). Revert.

- [ ] **Step 5: Run the full validation**

Run: `pnpm run validate`
Expected: `ALL PASS`.

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh
git commit -m "feat: add Rule 0 checklist semantic anchors to SDD line-budget CI (issue #52)"
```

### Task 4: Guard 2 — rule-reference cross-check resolver + wiring

**Files:**
- Create: `plugins/superpowers-overrides/tests/rule-reference.test.py`
- Modify: `plugins/superpowers-overrides/tests/validate-overrides-build.sh` (add resolver invocation after the line-budget call)

**Interfaces:**
- Consumes: Task 1's zero-stale-ref skill tree; the heading inventory of all `skills/*/SKILL.md`.
- Produces: `rule-reference.test.py` — runnable standalone and from CI; exits 0 when every numeric `Rule N` ref resolves, 1 otherwise; includes a self-test fixture that proves a dangling ref is caught (spec AC#4). Also produces the wiring line so `pnpm run validate` exercises it.

- [ ] **Step 1: Create the resolver**

Create `plugins/superpowers-overrides/tests/rule-reference.test.py` with exactly:

```python
#!/usr/bin/env python3
"""Rule-reference integrity guard for override SKILL.md files (issue #52 Guard 2).

Every numeric `Rule N` reference (e.g. `Rule 0a`, `Rule 5b`) in an override
skill's body or frontmatter must resolve to:
  1. a linked skill file — markdown link whose text contains `Rule N`, or a link
     ending right before the token. Sibling override (`skills/*`): the target must
     have that heading. Non-sibling/upstream target: OK (author pointed elsewhere).
  2. a scoped prefix — `spor-SDD Rule N`, `SDD Rule N`, or `spor-<name> Rule N`;
     the named sibling must have that heading.
  3. a same-file heading.
  4. a per-file allowlist entry (cross-file entries validated against target).
Otherwise the reference is dangling and the guard FAILs.

Exits 0 on clean scan + self-test; 1 otherwise.
"""
import os
import re
import shutil
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SKILLS = os.path.join(ROOT, "skills")

HEAD = re.compile(r'^(?:#{3,4} |\*\*)Rule ([0-9]+[a-z]?)\b')
REF = re.compile(r'\bRule ([0-9]+[a-z]?)\b')
LINK = re.compile(r'\[[^\]]*\]\(([^)]*SKILL\.md)\)')
LINK_HAS_REF = re.compile(r'\[[^\]]*Rule [0-9]+[a-z]?[^\]]*\]\(([^)]*SKILL\.md)\)')
SCOPED = re.compile(r'\b(spor-[a-z-]+|SDD) Rule ([0-9]+[a-z]?)\b')
COMMENT = re.compile(r'^\s*<!--')

SPOR_SDD = "spor-subagent-driven-development"
SCOPED_TARGET = {"SDD": SPOR_SDD, "spor-SDD": SPOR_SDD}

# per-file allowlist: bare rule id -> ("cross-file", target_skill) | ("upstream", None)
ALLOWLIST = {
    "spor-finishing-a-development-branch": {"4": ("upstream", None)},
    "spor-executing-plans": {"5b": ("cross-file", "spor-sdd-p0-fallback")},
    "spor-sdd-p0-fallback": {"0": ("cross-file", SPOR_SDD)},
}


def build_index(skills_dir):
    idx = {}
    for name in os.listdir(skills_dir):
        path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        ids = set()
        for line in open(path, encoding="utf-8"):
            m = HEAD.match(line)
            if m:
                ids.add(m.group(1))
        idx[name] = ids
    return idx


def resolve_link(url, cur_dir, skills_dir):
    target = os.path.normpath(os.path.join(cur_dir, url))
    if os.path.commonpath([target, skills_dir]) == os.path.normpath(skills_dir) and os.path.isfile(target):
        return os.path.basename(os.path.dirname(target)), True
    return None, False


def linked_target(line, m, cur_dir, skills_dir):
    """If Rule N is tied to a SKILL.md link on this line, return (target_name, is_sibling)."""
    for lm in LINK_HAS_REF.finditer(line):          # ref inside link text: [.. Rule N](..SKILL.md)
        if lm.start() <= m.start() <= lm.end():
            return resolve_link(lm.group(1), cur_dir, skills_dir)
    for lm in LINK.finditer(line):                   # link ends right before the token
        if lm.end() < m.start() and m.start() - lm.end() < 80:
            return resolve_link(lm.group(1), cur_dir, skills_dir)
    return None


def scan(skills_dir, idx):
    problems = []
    for name in sorted(os.listdir(skills_dir)):
        path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        cur_dir = os.path.dirname(path)
        for lineno, line in enumerate(open(path, encoding="utf-8").read().splitlines(), 1):
            if HEAD.match(line) or COMMENT.match(line):
                continue
            for m in REF.finditer(line):
                rid = m.group(1)
                # 1. linked
                lt = linked_target(line, m, cur_dir, skills_dir)
                if lt is not None:
                    tname, is_sibling = lt
                    if is_sibling and rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> {tname} lacks heading")
                    continue
                # 2. scoped prefix
                sc = next((s for s in SCOPED.finditer(line) if s.start() <= m.start() < s.end()), None)
                if sc is not None:
                    tname = SCOPED_TARGET.get(sc.group(1), sc.group(1))
                    if rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> scoped {tname} lacks heading")
                    continue
                # 3. same-file heading
                if rid in idx[name]:
                    continue
                # 4. allowlist
                entry = ALLOWLIST.get(name, {}).get(rid)
                if entry is not None:
                    kind, tname = entry
                    if kind == "cross-file" and rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> allowlist {tname} lacks heading")
                    continue
                # 5. dangling
                problems.append(f"{name}:{lineno}: Rule {rid} dangling (no heading, no allowlist)")
    return problems


def self_test():
    tmp = tempfile.mkdtemp()
    try:
        d = os.path.join(tmp, "skills")
        os.makedirs(os.path.join(d, "spor-aaa"))
        with open(os.path.join(d, "spor-aaa", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: spor-aaa\n---\n\n### Rule 1 — exists\n\nBody references Rule 2 which has no heading.\n")
        idx = build_index(d)
        probs = scan(d, idx)
        assert any("Rule 2" in p for p in probs), f"dangling Rule 2 not caught: {probs}"
    finally:
        shutil.rmtree(tmp)


def main():
    self_test()
    idx = build_index(SKILLS)
    problems = scan(SKILLS, idx)
    if problems:
        for p in problems:
            print("FAIL:", p)
        print("rule-reference: FAIL (%d)" % len(problems))
        return 1
    print("rule-reference: OK (self-test passed, %d skills clean)" % len(idx))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run the resolver against the repo — expect OK**

Run: `python3 plugins/superpowers-overrides/tests/rule-reference.test.py`
Expected: `rule-reference: OK (self-test passed, 17 skills clean)`, exit 0.

If it reports FAIL lines, resolve each: a `Rule N dangling` line means a ref I missed in the allowlist — add the entry (with justification) to `ALLOWLIST`; a `-> <skill> lacks heading` line means a stale cross-file target (should have been fixed in Task 1).

- [ ] **Step 3: Wire into `validate-overrides-build.sh`**

In `tests/validate-overrides-build.sh`, immediately after the block:

```bash
echo "== validate SDD orchestrator line budget =="
"$ROOT/tests/sdd-orchestrator-line-budget.test.sh"
```

add:

```bash
echo "== validate rule-reference integrity =="
python3 "$ROOT/tests/rule-reference.test.py"
```

- [ ] **Step 4: Run the full validation**

Run: `pnpm run validate`
Expected: `ALL PASS` (the new `== validate rule-reference integrity ==` step prints `rule-reference: OK`).

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/tests/rule-reference.test.py plugins/superpowers-overrides/tests/validate-overrides-build.sh
git commit -m "feat: add rule-reference cross-check resolver to overrides CI (issue #52)"
```



