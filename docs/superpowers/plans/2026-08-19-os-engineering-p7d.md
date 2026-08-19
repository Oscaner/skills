# P7d: Legacy Naming Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Purge every legacy name from first-party files — `os-*` skill-prefix tokens, `engineering` plugin/function/artifact names, `oscaner-engineering` temp dir, `engineeringVersion`/`ENGINEERING_VERSION` — leaving zero tech debt and a sound acceptance gate.

**Architecture:** Wide mechanical rename with the canonical mapping fixed once in the design spec §1, applied in dependency order: metadata/emit SOT first (re-emit regenerates all derived artifacts), then runtime pending path, then channel key, then install surface + ci, then docs/skills (re-emit again), then historical P7 docs, then final acceptance. Vendored upstream data and P1-P6 history intentionally untouched.

**Tech Stack:** Node.js (.mjs), JSON metadata, Markdown skill bodies, git mv, pnpm emit, node:test.

## Global Constraints

- **映射唯一权威** = `docs/superpowers/specs/2026-08-18-os-engineering-p7d-design.md` §1 canonical mapping table。任何任务中的替换都按该表；任务文件清单/验证互不冲突。§8 验收按该表的 A/A2/D/D2 车道。
- **派生文件不手工编辑**：`marketplace/*.json`、`.claude-plugin/`、`.cursor-plugin/`、`.codex-plugin/`、`.kimi-plugin/`、`.qoder-plugin/`、`packages/osuperpowers/gemini-extension.json`、`.agents/skills/osuperpowers/` 全部由 `pnpm run emit` 重生成，禁止手改。
- **vendors/ 子模块不动**；上游数据（mattpocock `skills/engineering/` 路径、category/描述、`VENDOR_FALLBACK`、`publish-vendor.test.mjs:124` fixture）保留为白名单。
- **上游路径引用保留**：任何对 mattpocock `skills/engineering/<skill>/SKILL.md` 的引用一律不改。
- **验收模式**：`os-` 家族 + `-i` 大小写不敏感；禁 `os-[a-z]`（漏 `os-*`）与逐行 `-v osuperpowers`（漏同行共存）。
- Conventional commits，无 attribution / co-author trailer；禁用 git worktree。
- 每任务完成后 `pnpm run validate` 必须通过（T6 纯文档不触发代码，T7 为终验）。
- 历史文档：P1-P6 + `docs/research/` 不动（时代史实）；P7 系列（p7a/b/c）由 T6 同步。
- 各任务验证 grep 若命中其他任务所有权的残留（如 pending grep 命中 `vibe/hooks.toml:4`），以本清单为准，最终以 T7 验收为准。

---

### Task 1: Metadata SOT + emit function rename (re-emit)

**Files:**
- Modify: `packages/osuperpowers/package.json` (oscaner-plugin.claude.category/keywords/description)
- Modify: `scripts/lib/emit/manifests.mjs` (functions `engineeringClaudeHooks`/`engineeringCursorHooks`/`engineeringHooksFor` → `osuperpowers*`; harness-set key; 7 comments)
- Modify: `scripts/emit.mjs` (imports/calls at 66/203; comments 21/22/216/217; **delete** staleWrapper check 435/438/467; `emitOsEngineering` → `emitOsuperpowers` at 146/426)
- Modify: `scripts/lib/emit/emit.test.mjs` (imports 16-18; category/keywords fixtures 53-54/88-89/465-466; description fixtures 49/82/279/458; test names/asserts 77/187/529/547/557-575)
- Keep (whitelist, do NOT touch): `scripts/lib/emit/source.mjs` (mattpocock VENDOR_FALLBACK), `scripts/lib/publish-vendor.test.mjs`

**Interfaces:**
- Consumes: P7c emit pipeline (`pnpm run emit`)
- Produces: package metadata `category/keywords = "osuperpowers"` and emit exports `osuperpowersClaudeHooks`/`osuperpowersCursorHooks`/`osuperpowersHooksFor`/`emitOsuperpowers` that Tasks 2-7 rely on

- [ ] **Step 1: Verify current stale references**

Run: `grep -nE 'engineering|os-\*' packages/osuperpowers/package.json`
Expected: 3 matches (`category`, `keywords`, description)

- [ ] **Step 2: Edit `packages/osuperpowers/package.json`**

Inside `oscaner-plugin.claude`:
```json
"category": "osuperpowers",
"keywords": ["osuperpowers", "cli", "cdd", "harness", "droid", "pi"]
```
Description becomes:
```json
"description": "Standalone osuperpowers skills: orchestration + cli-* family + CDD engine + cross-harness gate."
```

- [ ] **Step 3: Rename emit functions + delete stale-wrapper guard**

In `scripts/lib/emit/manifests.mjs` — `engineeringClaudeHooks` → `osuperpowersClaudeHooks`, `engineeringCursorHooks` → `osuperpowersCursorHooks`, `engineeringHooksFor` → `osuperpowersHooksFor`, harness-set key `"engineering"` → `"osuperpowers"` (line 330), comments `engineering` → `osuperpowers` (lines 223/256/264/276/288/300-301).

In `scripts/emit.mjs` — update the 2 import references + call sites to `osuperpowersHooksFor`; comments lines 21/22/216/217 → `osuperpowers`; rename `emitOsEngineering` → `emitOsuperpowers` (definition 146 + call 426); **delete** the stale-wrapper guard: `staleWrapper` const, the `if (existsSync(staleWrapper))` block, and the `extraStale: ["cursor-plugins/engineering/"]` entry (repo-root `cursor-plugins/` now covered by the Task 7 filename scan).

In `scripts/lib/emit/emit.test.mjs` — update imports to the new names; `category: "engineering"` → `"osuperpowers"` and keywords arrays (53-54/88-89/465-466); description fixtures 49/82/279/458 to the new description string; test names/asserts referencing `engineering*Hooks` → `osuperpowers*Hooks`.

**Do NOT touch** `scripts/lib/emit/source.mjs` (VENDOR_FALLBACK is the mattpocock whitelist) or `scripts/lib/publish-vendor.test.mjs`.

- [ ] **Step 4: Re-emit + verify no drift**

Run: `pnpm run emit && pnpm run emit:check`
Expected: both OK — derived artifacts (marketplace jsons, per-plugin manifests, gemini-extension.json, `.agents/skills` copies) now carry the `osuperpowers` category/keywords/description

- [ ] **Step 5: Verify**

Run: `grep -nE 'engineering|os-\*' packages/osuperpowers/package.json`
Expected: exit 1 (no matches)

Run: `grep -nE 'engineeringClaudeHooks|engineeringCursorHooks|engineeringHooksFor|emitOsEngineering|staleWrapper' scripts/emit.mjs scripts/lib/emit/manifests.mjs scripts/lib/emit/emit.test.mjs`
Expected: exit 1 (no matches)

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/package.json scripts/emit.mjs scripts/lib/emit/manifests.mjs scripts/lib/emit/emit.test.mjs marketplace .claude-plugin .cursor-plugin cursor-plugins packages/osuperpowers/.claude-plugin packages/osuperpowers/.cursor-plugin packages/osuperpowers/.codex-plugin packages/osuperpowers/.kimi-plugin packages/osuperpowers/.qoder-plugin packages/osuperpowers/.agents packages/osuperpowers/gemini-extension.json
git commit -m "feat: rename emit functions and metadata to osuperpowers"
```

---

### Task 2: Runtime pending path `oscaner-engineering` → `osuperpowers`

**Files:**
- Modify: `packages/osuperpowers/bin/gate/cdd-gate-core.mjs` (line 26 `DEFAULT_PENDING_ROOT`, line 231 comment)
- Modify: `packages/osuperpowers/bin/engine/cdd-session-activate.mjs` (lines 14/17)
- Modify: `packages/osuperpowers/bin/gate/tests/cdd-gate-core.test.mjs` (lines 3/185/192)
- Modify: `packages/osuperpowers/bin/engine/tests/session-activate.test.mjs` (line 125)

**Interfaces:**
- Consumes: nothing new (Task 1 unrelated)
- Produces: `DEFAULT_PENDING_ROOT` = `${TMPDIR:-/tmp}/osuperpowers/pending-cdd` — the shared gate/engine pending root used by Task 4's install-surface tests and the final acceptance

- [ ] **Step 1: Verify current stale references**

Run: `grep -n 'oscaner-engineering' packages/osuperpowers/bin/gate packages/osuperpowers/bin/engine --exclude-dir=node_modules`
Expected: matches at cdd-gate-core.mjs:26, cdd-session-activate.mjs:14/17, cdd-gate-core.test.mjs:3/185/192, session-activate.test.mjs:125, and (owned by later tasks) vibe/hooks.toml

- [ ] **Step 2: Replace the pending root + comments**

Apply to the 4 files above (design §3.1): every `oscaner-engineering` → `osuperpowers`, and the `cdd-gate-core.mjs:231` comment `os_root 为 engineering 插件根` → `os_root 为 osuperpowers 插件根`.

Example (cdd-gate-core.mjs:26):
```js
const DEFAULT_PENDING_ROOT = path.join(process.env.TMPDIR?.trim() || "/tmp", "osuperpowers", "pending-cdd");
```

**Hard cut, no legacy-path read**: pending missing → gate fail-open (allow) is safe by design (identical to 24h TTL expiry); `CDD_PENDING_ROOT` env override stays supported.

- [ ] **Step 3: Run the affected test suites**

Run: `node --test packages/osuperpowers/bin/gate/tests/*.test.mjs packages/osuperpowers/bin/engine/tests/*.test.mjs`
Expected: all pass (fixtures assert the new `/tmp/osuperpowers/` root)

- [ ] **Step 4: Verify no stale refs remain in the 4 files**

Run: `grep -rn 'oscaner-engineering' packages/osuperpowers/bin/gate/cdd-gate-core.mjs packages/osuperpowers/bin/engine/cdd-session-activate.mjs packages/osuperpowers/bin/gate/tests/cdd-gate-core.test.mjs packages/osuperpowers/bin/engine/tests/session-activate.test.mjs`
Expected: exit 1 (no matches; vibe/hooks.toml residual is Task 4-owned)

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/gate/cdd-gate-core.mjs packages/osuperpowers/bin/engine/cdd-session-activate.mjs packages/osuperpowers/bin/gate/tests/cdd-gate-core.test.mjs packages/osuperpowers/bin/engine/tests/session-activate.test.mjs
git commit -m "feat: rename cdd pending root to osuperpowers"
```

---

### Task 3: Harness channel key `"os-init"` → `"init"` + engine comments + fixtures

**Files:**
- Modify: `packages/osuperpowers/bin/utils/skills-probe.config.mjs` (channel key line 14; comments 6/8/11; install hints 67/73/79/85)
- Modify: `packages/osuperpowers/bin/utils/skills-probe.mjs` (1 comment)
- Modify: `packages/osuperpowers/bin/utils/harness-detect.mjs` (3 comments)
- Modify: `packages/osuperpowers/bin/utils/tests/skills-probe.test.mjs` (12), `packages/osuperpowers/bin/utils/tests/harness-detect.test.mjs` (4)
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs` (comments 406/424/445), `packages/osuperpowers/bin/engine/lib/templates.mjs` (line 34), `packages/osuperpowers/bin/engine/cdd-run.mjs` (line 2)
- Modify: `packages/osuperpowers/bin/engine/tests/skills-gate.test.mjs` (18 fixtures `osInitChannel` etc.)
- Modify: `packages/osuperpowers/tests/rule-reference.test.mjs` (comments 4/25/260-261; fixture dirs `os-aaa`/`os-bbb` 238-252; tmpdir `rule-ref-os-` line 236)

**Interfaces:**
- Consumes: Task 1/2 (independent of their outputs)
- Produces: channel key `"init"` for the 4 init-channel harnesses (opencode/trae/vibe/kiro) and the `osuperpowers` plugin-root-error strings — consumed by Task 4's install-harness and Task 7 acceptance

- [ ] **Step 1: Verify current stale references**

Run: `grep -n 'os-init' packages/osuperpowers/bin/utils/skills-probe.config.mjs`
Expected: matches at 6/8/11/14/67/73/79/85

- [ ] **Step 2: Channel key + hints + comments**

In `skills-probe.config.mjs` (design §3.2):
- Line 14: `"os-init": ["opencode", "trae", "vibe", "kiro"]` → `"init": [...]`
- Lines 6/8/11 comments: `os-init` → `init`
- Lines 67/73/79/85 hints: `os-init harness <name>` → `osuperpowers:init harness <name>` (same rule as Task 4's CLI messages)

In `skills-probe.mjs:121` (`first-party（engineering/overrides）...` comment): `engineering` → `osuperpowers` (single occurrence).
In `harness-detect.mjs` (3 occurrences): `os-init` channel references → `init`.

In the engine (`runner.mjs` 406/424/445, `templates.mjs` 34, `cdd-run.mjs` 2):
- `os-init channel` → `init channel`
- `engineering plugin root` / `engineering single CLI runner` → `osuperpowers ...`

- [ ] **Step 3: Update test fixtures**

`skills-probe.test.mjs`, `harness-detect.test.mjs`, `skills-gate.test.mjs`: `config.channel["os-init"]`/`osInitChannel`/`"os-init": [...]` fixture keys → `"init"`; assertion messages/expected channel values follow.

`rule-reference.test.mjs`: fixture dirs/names `os-aaa`/`os-bbb` → `aaa`/`bbb` (lines 238-252, pure model names); **line 250's negative assert** `problems.some((p) => p.includes("os-aaa"))` must become prefix-scoped — `p.startsWith("aaa:")` — because the anchor-mismatch message (line 155) embeds the target name and `bbb`'s problem contains the `cli-aaa` substring, so a bare `includes("aaa")` would fire on the wrong-ish line (keep semantics identical via the `${name}:` prefix); tmpdir `rule-ref-os-` → `rule-ref-` (line 236); comments `engineering` → `osuperpowers` (4/25/260-261).

- [ ] **Step 4: Run affected test suites**

Run: `node --test packages/osuperpowers/bin/utils/tests/*.test.mjs packages/osuperpowers/bin/engine/tests/*.test.mjs packages/osuperpowers/tests/rule-reference.test.mjs`
Expected: all pass

- [ ] **Step 5: Verify**

Run: `grep -rn 'os-init\|os-aaa\|os-bbb\|rule-ref-os-\|engineering' packages/osuperpowers/bin/utils packages/osuperpowers/bin/engine packages/osuperpowers/tests/rule-reference.test.mjs --exclude-dir=node_modules`
Expected: no matches on the renamed patterns (any `os-init`/`engineering` residual here is Task 4/5-owned — it is not)

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/bin/utils packages/osuperpowers/bin/engine packages/osuperpowers/tests/rule-reference.test.mjs
git commit -m "feat: rename harness channel 'os-init' to init"
```

---

### Task 4: `bin/os-init` → `bin/init` + ci-validate + install surface

**Files:**
- Rename: `git mv packages/osuperpowers/bin/os-init packages/osuperpowers/bin/init`
- Modify: `packages/osuperpowers/bin/init/install-harness.mjs` (header comments 2/10; channel comments 7/54; `ENGINEERING_VERSION` → `OSUPERPOWERS_VERSION` 162; manifest field `engineeringVersion` → `osuperpowersVersion` 11/170/174; `source: "os-init"` → `source: "init"` 12/13/185/190/220/282; `PI_TS_MARKER` 34; channel keys 85/91/96/100; CLI messages 261/273/277/325; trust/hint texts 56/61/70/81/82/97/100)
- Rename: `git mv packages/osuperpowers/bin/init/tests/install-gates.test.mjs packages/osuperpowers/bin/init/tests/install-harness-gates.test.mjs`
- Modify: `packages/osuperpowers/bin/init/tests/install-harness.test.mjs` (26: `engineeringVersion`, `~/.engineering` 82/97/122, test name 78)
- Modify: `packages/osuperpowers/bin/init/tests/install-harness-gates.test.mjs` (37: NATIVE_DEST `engineering.json` paths, `~/.engineering`, `PI_TS_MARKER`, channel keys)
- Rename: `git mv packages/osuperpowers/bin/gate/configs/grok/engineering.json packages/osuperpowers/bin/gate/configs/grok/osuperpowers.json`
- Modify: `packages/osuperpowers/bin/gate/configs/pi/pi.ts` (header comment line 1)
- Modify: `packages/osuperpowers/bin/gate/configs/pi/README.md` (3: gate extension description + `~/.pi/agent/extensions/engineering.ts` paths)
- Modify: `packages/osuperpowers/bin/gate/configs/vibe/hooks.toml` (hook name line 4 + comment)
- Modify: `packages/osuperpowers/bin/gate/tests/configs-parse.test.mjs` (fixture line 18)
- Modify: `scripts/ci-validate.mjs` (os-init lines 175/181/187/192/204/207/212; functions `checkEngineeringSkillsCount` 171/196, `checkEngineeringGateHooks` 219/236 → `checkOsuperpowers*`)
- Modify: `packages/osuperpowers/tests/ci-validate.test.mjs` (lines 96/97/101)

**Interfaces:**
- Consumes: Task 3 channel key (install-harness HARNESSES reuse `init` channel); Task 1 emit naming (ci-validate's step labels mirror emit products)
- Produces: `bin/init/` layout + `OSUPERPOWERS_VERSION`/`osuperpowersVersion` + installed-artifact names `osuperpowers.json`/`osuperpowers.ts` + manifest path `~/.osuperpowers/state/` — all finalized for Task 5/6/7

- [ ] **Step 1: Verify current stale references**

Run: `ls packages/osuperpowers/bin/os-init && grep -n 'engineeringVersion\|ENGINEERING_VERSION' packages/osuperpowers/bin/os-init/install-harness.mjs`
Expected: dir exists; matches at lines 11/162/170/174

- [ ] **Step 2: Move directories + template file**

Run: `git mv packages/osuperpowers/bin/os-init packages/osuperpowers/bin/init && git mv packages/osuperpowers/bin/init/tests/install-gates.test.mjs packages/osuperpowers/bin/init/tests/install-harness-gates.test.mjs && git mv packages/osuperpowers/bin/gate/configs/grok/engineering.json packages/osuperpowers/bin/gate/configs/grok/osuperpowers.json`

- [ ] **Step 3: `install-harness.mjs` renames (design §3.3/§3.4)**

Apply §1 mapping to `packages/osuperpowers/bin/init/install-harness.mjs`:
- `ENGINEERING_VERSION` → `OSUPERPOWERS_VERSION` (line 162) and its `engineeringVersion` uses (170/174); header comment 11 `{ engineeringVersion, ... }` → `{ osuperpowersVersion, ... }`
- `source: "os-init"` → `source: "init"` (12/13/185/190/220) + comment 282
- `PI_TS_MARKER = "os-init harness — Pi TS extension"` → `"osuperpowers harness — Pi TS extension"` (34)
- channel keys `"os-init"` → `"init"` (85/91/96/100) + comments 7/54
- channel/hint text: line 56/61/70/81/82/97 — grok/pi/kiro dest names `engineering.json`/`engineering.ts` → `osuperpowers.json`/`osuperpowers.ts`; trust text `engineering 钩子` → `osuperpowers 钩子`; header comment 2 `bin/os-init/install-harness.mjs` → `bin/init/install-harness.mjs`
- **manifest 真实路径（行 165）**：`path.join(HOME, ".engineering", "state", ...)` → `path.join(HOME, ".osuperpowers", "state", ...)`（§3.3 —— 文档 `bin/init/state/` 是错的，以实现为准）
- 头部注释行 10 `// 6. manifest — bin/os-init/state/<harness>.json 全量同步` → `// 6. manifest — ~/.osuperpowers/state/<harness>.json 全量同步`（与行 165 真实路径一致）
- CLI messages `os-init harness:` → `osuperpowers:init harness:` (261/273/277/325)

- [ ] **Step 4: Config templates + install docs**

- `bin/gate/configs/pi/pi.ts:1`: `// os-init gates — Pi TS extension（manual extension copy）。` → `// init gates — Pi TS extension（manual extension copy）。` (distinct from PI_TS_MARKER)
- `bin/gate/configs/pi/README.md`: `engineering gate` → `osuperpowers gate`; `~/.pi/agent/extensions/engineering.ts` → `osuperpowers.ts` (3 occurrences)
- `bin/gate/configs/vibe/hooks.toml:4`: `name = "oscaner-engineering-cdd-gate"` → `"osuperpowers-cdd-gate"`; comment `os-init gates` → `init gates`
- `bin/gate/tests/configs-parse.test.mjs:18`: `["grok", "engineering.json"]` → `["grok", "osuperpowers.json"]`
- Hint: the grok template dest `~/.grok/hooks/engineering.json` → `osuperpowers.json` (inside install-harness.mjs HARNESSES) is part of Step 3

- [ ] **Step 5: ci-validate + its test**

In `scripts/ci-validate.mjs`:
- `os-init` → `init` at lines 175 (comment `12 emitters + os-init`), 181/187/192 (assert messages), 204 (comment), 207 (step name `5b. node:test engine + gate + os-init + utils + behavior`), 212 (glob `bin/os-init/tests/*.test.mjs`)
- `checkEngineeringSkillsCount` → `checkOsuperpowersSkillsCount` (171/196), `checkEngineeringGateHooks` → `checkOsuperpowersGateHooks` (219/236)

In `packages/osuperpowers/tests/ci-validate.test.mjs`: lines 1/3 header comments `engineering` → `osuperpowers`; lines 96/97/101 `os-init` → `init` (comment + test name + glob argument `packages/osuperpowers/bin/os-init/tests/*.test.mjs` → `.../bin/init/tests/...`)

- [ ] **Step 6: Update the two install test files**

`install-harness.test.mjs` (26): replace `engineeringVersion` → `osuperpowersVersion`, `~/.engineering` → `~/.osuperpowers` (82/97/122), test name line 78 `bin/os-init/state/` → `~/.osuperpowers/state/`.

`install-harness-gates.test.mjs` (37, formerly install-gates.test.mjs): NATIVE_DEST map `engineering.json` → `osuperpowers.json` (`.kiro/hooks/` and `.grok/hooks/`), `.pi/agent/extensions/engineering.ts` → `osuperpowers.ts`, `~/.engineering` → `~/.osuperpowers`, temp pending fixtures (`/tmp/oscaner-engineering` paths), `PI_TS_MARKER` literals, hook-name strings. (Channel keys do NOT live here — they are in install-harness.test.mjs / skills-gate.test.mjs, covered by Task 3.)

- [ ] **Step 7: Run affected test suites + full validation**

Run: `node --test packages/osuperpowers/bin/init/tests/*.test.mjs packages/osuperpowers/bin/gate/tests/*.test.mjs packages/osuperpowers/tests/ci-validate.test.mjs`
Expected: all pass

Run: `pnpm run validate`
Expected: green (emit unaffected by Task 4 — no generator files changed)

- [ ] **Step 8: Verify**

Run: `ls packages/osuperpowers/bin/init/install-harness.mjs packages/osuperpowers/bin/gate/configs/grok/osuperpowers.json`
Expected: both exist

Run: `grep -rn 'oscaner-engineering\|engineeringVersion\|ENGINEERING_VERSION\|\.engineering\|os-init' packages/osuperpowers/bin/init packages/osuperpowers/bin/gate scripts/ci-validate.mjs packages/osuperpowers/tests/ci-validate.test.mjs --exclude-dir=node_modules`
Expected: exit 1 (no matches)

- [ ] **Step 9: Commit**

```bash
git add -A packages/osuperpowers/bin/init packages/osuperpowers/bin/gate packages/osuperpowers/tests/ci-validate.test.mjs scripts/ci-validate.mjs
git commit -m "feat: rename os-init install surface to init"
```

---

### Task 5: Plugin docs + skill bodies + router (re-emit)

**Files:**
- Modify: `packages/osuperpowers/docs/cdd-reference.md` (line 75 plugins list) + `cdd-reference.zh-CN.md`
- Modify: `docs/gate-install.md` (line 225 manifest path + field)
- Modify: `packages/osuperpowers-router/docs/cross-harness-overrides.md` (29 refs — paths, `os-*` family words, `os-<slug>`, pending path, `engineering-version`)
- Delete: `packages/osuperpowers-router/docs/sdd-h6-reference.md` (SUPERSEDED transition copy)
- Modify: `packages/osuperpowers-router/tests/validate-overrides-build.mjs` (13), `packages/osuperpowers-router/tests/cursor-enforce.test.mjs` (line 18)
- Modify: `CLAUDE.md` (root, lines 11/13), `README.md` (root 1), `README.zh-CN.md` (root, line 26)
- Modify: `packages/osuperpowers/CLAUDE.md` (8 `os-*` family words), `README.md` (2 + tagline line 5), `README.zh-CN.md` (2)
- Modify: `packages/osuperpowers-router/README.md` (1) + `README.zh-CN.md` (1)
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md` (16) + `SKILL.zh-CN.md`
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md` (28) + `SKILL.zh-CN.md` (28 — KEEP line 18 upstream path)
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.md` (4) + `SKILL.zh-CN.md` (4)
- Modify: `packages/osuperpowers/skills/init/harness.md` (line 3)
- Modify: `packages/osuperpowers/docs/subagent-lifecycle.md` (line 3) + `subagent-lifecycle.zh-CN.md`
- Modify: `scripts/version-packages.mjs` (69/89/128/154), `scripts/lib/version-utils.mjs` (34), `scripts/sync-overrides-versions.mjs` (20/21) — comments

**Interfaces:**
- Consumes: Task 4 (`init` channel name, `bin/init/` path, `osuperpowers` installed names) — this task's prose references them consistently
- Produces: grep-clean first-party docs + skill bodies; re-emit regenerates `.agents/skills/osuperpowers/*` copies clean (`writing-plans`/`brainstorming`/`report-issue`/`init` bodies) — consumed by Task 7 acceptance

- [ ] **Step 1: Verify current stale references**

Run: `grep -rnE 'os-|engineering|oscaner-engineering' packages/osuperpowers/docs packages/osuperpowers/skills packages/osuperpowers-router/docs CLAUDE.md README.md README.zh-CN.md docs/gate-install.md 2>/dev/null | grep -v 'skills/engineering/to-tickets' | grep -vc '^CLAUDE.md:14:'`
Expected: > 0 (counts the surfaces this task clears)

- [ ] **Step 2: Functional docs**

- `packages/osuperpowers/docs/cdd-reference.md:75`: required plugins `(... + engineering + osuperpowers-router ...)` → `...+ osuperpowers + osuperpowers-router`; mirror in `cdd-reference.zh-CN.md`
- `docs/gate-install.md:225`: `bin/init/state/<harness>.json` → `~/.osuperpowers/state/<harness>.json` (aligns with Task 4 implementation) + `engineeringVersion` → `osuperpowersVersion`

- [ ] **Step 3: cross-harness-overrides.md full pass (design §5.1)**

Apply §1 mapping across `packages/osuperpowers-router/docs/cross-harness-overrides.md` (29 refs):
- `engineering` → `osuperpowers` in every path/term (`engineering/bin/...`, `engineering/docs/cdd-reference.md`, `"source": "../engineering/skills/brainstorming"`, `{[engineering]}` placeholders, plugins list, "routes to engineering targets", `engineering/hooks/`)
- `os-\*` family → `osuperpowers:*`; `os-<upstream-slug>` → `<upstream-slug>` (line 93 matcher); line 54 schema `skills/os-<slug>/SKILL.md` → `skills/<slug>/SKILL.md`
- line 66 pending path → `$TMPDIR/osuperpowers/pending-cdd`
- line 237 `engineering-version` → `osuperpowers-version` (token already renamed in init skill bodies)

- [ ] **Step 4: Router docs + tests**

- Delete `packages/osuperpowers-router/docs/sdd-h6-reference.md` (SUPERSEDED — live doc is `osuperpowers/docs/cdd-reference.md`; no current references, verified zero prior)
- `tests/validate-overrides-build.mjs`: `os-init` labels/comments (6/162-191) → `init`/`osuperpowers:init`; `engineering` prose (125/129/132/136/233/236/238) → `osuperpowers`
- `tests/cursor-enforce.test.mjs:18`: `SKILL_SUFFIX = "../engineering/skills/brainstorming/SKILL.md"` → `"../osuperpowers/skills/brainstorming/SKILL.md"`

- [ ] **Step 5: Root + plugin docs (bilingual)**

- `CLAUDE.md` (root): line 11 `os-\* orchestration` → `osuperpowers orchestration`; line 13 `read by os-\* orchestrators` → `read by osuperpowers orchestrators`; **KEEP line 14 `Engineering precision skills`** (vendored mattpocock genre descriptor — whitelisted in the design §6.3/§8, do NOT touch)
- `README.md` (root, 1) + `README.zh-CN.md` (root, line 26 `os-\* 编排器` → `osuperpowers 编排器`)
- `packages/osuperpowers/CLAUDE.md`: 8 `os-\*` family words (lines 21/27/50/52/53/55/103/184) → `osuperpowers` family descriptor (`os-\*` orchestrator skill → `osuperpowers` orchestration skill; keep `osuperpowers:*` namespace references)
- `packages/osuperpowers/README.md`: line 5 tagline `Engineering skills for Claude Code` → `osuperpowers skills for Claude Code`; `os-\*` orchestration descriptors → `osuperpowers`; mirror in `README.zh-CN.md` (lines 5/11)
- `packages/osuperpowers-router/README.md` + `README.zh-CN.md`: `os-\*` → `osuperpowers` (line 5, 1 each)

- [ ] **Step 6: Skill bodies (design §5.1)**

- `skills/brainstorming/SKILL.md:16` + zh-CN: `{plugin-root}` = engineering root → osuperpowers root
- `skills/writing-plans/SKILL.md:28` + zh-CN: same `{plugin-root}` wording; **KEEP line 18** `skills/engineering/to-tickets/SKILL.md` (upstream path — whitelist)
- `skills/report-issue/SKILL.md` + zh-CN: dogfood comments `os-\* skills in use` → `osuperpowers skills in use` (4 each)
- `skills/init/harness.md:3`: `os-\*/cli-\*` → `osuperpowers:*/cli-*`
- `packages/osuperpowers/docs/subagent-lifecycle.md:3` + zh-CN: `in os-\* skills` → `in osuperpowers skills`

- [ ] **Step 7: Script comments**

`version-packages.mjs` (69/89/128/154), `lib/version-utils.mjs` (34): `engineering` → `osuperpowers` in comments only. `sync-overrides-versions.mjs` (20/21): `engineering` → `osuperpowers` AND `os-init` → `init` (`os-init owns the dogfood`).

- [ ] **Step 8: Re-emit + full validation + verify**

Run: `pnpm run emit && pnpm run emit:check`
Expected: OK — `.agents/skills/osuperpowers/{brainstorming,writing-plans,report-issue,init}/*` and all per-plugin manifests now carry the cleaned bodies/descriptions

Run: `pnpm run validate`
Expected: green (Global Constraints — every task leaves validate passing)

Run: `grep -rInE 'os-|engineering|oscaner-engineering|ENGINEERING_VERSION|engineeringVersion' packages/osuperpowers/skills packages/osuperpowers/docs packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md packages/osuperpowers/README.zh-CN.md packages/osuperpowers-router/docs packages/osuperpowers-router/README.md packages/osuperpowers-router/README.zh-CN.md CLAUDE.md README.md README.zh-CN.md docs/gate-install.md 2>/dev/null | grep -v 'skills/engineering/to-tickets' | grep -v '^CLAUDE\.md:14:'`
Expected: exit 1 (no matches; residual = only the whitelisted upstream path/references)

Run: `node --test packages/osuperpowers-router/tests/*.test.mjs`
Expected: pass (validate also covers the router build; this pins the two router test files this task edited)

- [ ] **Step 9: Commit**

```bash
git add packages/osuperpowers packages/osuperpowers-router CLAUDE.md README.md README.zh-CN.md docs/gate-install.md scripts/version-packages.mjs scripts/lib/version-utils.mjs scripts/sync-overrides-versions.mjs marketplace .claude-plugin .cursor-plugin cursor-plugins
git commit -m "docs: purge os-* and engineering names from plugin docs and skills"
```

---

### Task 6: Historical P7a/b/c sync + overall spec (no code impact)

**Files:**
- Modify: `docs/superpowers/specs/2026-08-18-os-engineering-p7a-design.md`, `-p7b-design.md`, `-p7c-design.md`
- Modify: `docs/superpowers/plans/2026-08-18-os-engineering-p7a.md`, `-p7b.md`, `-p7c.md`
- Modify: `docs/superpowers/tickets/2026-08-18-os-engineering-p7a-tickets.md`, `-p7b-tickets.md` (p7c-tickets **does not exist** — nothing to do for it)
- Modify: `docs/superpowers/specs/2026-08-10-os-engineering-overall.md` (§2 status rows, P7d row → completed, change history v4.2)
- **Keep** (do NOT touch): P1-P6 specs/plans/tickets + `docs/research/` (era history per §6.2)

**Interfaces:**
- Consumes: Tasks 1-5 finalized names
- Produces: grep-clean P7-era docs + overall spec P7d row in completed state — verified by Task 7's D/D2 lanes

- [ ] **Step 1: P7 系列文档 —— 改名记录类豁免（执行期决策 A）**

P7a/b/c 设计/计划/tickets 是**改名记录文档**（内容即旧→新对照表）。按执行期批准的决策 A：**映射记录行（含 `→`/`->`）与文件名 slug 引用（`os-engineering-p7*`）豁免**，不做 token 清扫（清除即破坏史实）；前向引用清理实测为 0（296 行匹配剔除豁免类后无剩余）。本步骤无文件编辑 —— 仅确认文档保持原样（映射记录）。

- [ ] **Step 2: Sync the overall spec**

In `docs/superpowers/specs/2026-08-10-os-engineering-overall.md` (design §6.1 + Rule 3b):
- §2 table: P7a/P7b rows → `✅ 实现完成` + design/plan links; P7d row → links (this design + plan) + status `✅ 实现完成`；P7d 行验收描述指向设计 spec §8 A/A2/D/D2 车道（含改名记录豁免）
- Header `Version` → v4.2
- §6 Change history: append `v4.2 · 2026-08-19 · **P7d 实现完成** ...` entry
- Keep the v4.0/v4.1 changelog entries + §2 phase descriptions + row mapping text (records — exempt)

- [ ] **Step 3: Verify P7-era docs (exempt-class classifier, D lane)**

Run: the design spec §8 D-lane command (8 existing files) — grep tokens, then `| grep -v 'os-engineering-p7' | grep -vE '(→|->)'`
Expected: no residual lines (all matches are exempt classes: mapping records + filename-slug refs; note grep on the 8 files must not name any nonexistent file — p7c has no tickets file, excluded from the lane)

- [ ] **Step 4: Verify overall markers**

Run: `grep -nE 'P7d.*✅|2026-08-19-os-engineering-p7d' docs/superpowers/specs/2026-08-10-os-engineering-overall.md`
Expected: matches showing P7d completed row with design/plan links

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-10-os-engineering-overall.md docs/superpowers/specs/2026-08-18-os-engineering-p7a-design.md docs/superpowers/specs/2026-08-18-os-engineering-p7b-design.md docs/superpowers/specs/2026-08-18-os-engineering-p7c-design.md docs/superpowers/plans/2026-08-18-os-engineering-p7a.md docs/superpowers/plans/2026-08-18-os-engineering-p7b.md docs/superpowers/plans/2026-08-18-os-engineering-p7c.md docs/superpowers/tickets/2026-08-18-os-engineering-p7a-tickets.md docs/superpowers/tickets/2026-08-18-os-engineering-p7b-tickets.md
git commit -m "docs: sync P7-era docs and overall spec to osuperpowers naming"
```

---

### Task 7: Final acceptance (A/A2/D/D2 + full validation)

**Files:**
- Run: the §8 acceptance lanes from the design spec (no file edits unless a lane fails)

**Interfaces:**
- Consumes: all prior tasks
- Produces: zero legacy naming in first-party files; green `validate`; P7d phase complete

- [ ] **Step 1: Lane A (first-party content, case-insensitive)**

Run:
```bash
grep -rIniE 'os-|engineering|oscaner-engineering|ENGINEERING_VERSION|engineeringVersion' \
  packages scripts .github CLAUDE.md README.md README.zh-CN.md docs/gate-install.md \
  --exclude-dir=node_modules 2>/dev/null \
  | grep -v 'skills/engineering/to-tickets' \
  | grep -v '^scripts/lib/emit/source\.mjs:' \
  | grep -v 'publish-vendor.test.mjs' \
  | grep -v '^CLAUDE\.md:14:' \
  || echo "(A clean or allowlisted-only)"
```
Expected: no residual lines (only allowed: `skills/engineering/to-tickets` upstream references, `source.mjs` VENDOR_FALLBACK, `publish-vendor.test.mjs` fixture, root `CLAUDE.md:14` mattpocock genre descriptor). If residual lines appear, fix them (they are missed first-party stale refs) and re-run.

- [ ] **Step 2: Lane A2 (filename tokens)**

Run:
```bash
find packages scripts cursor-plugins -type f \( -iname '*engineering*' -o -iname '*os-init*' \) \
  -not -path '*/node_modules/*' -not -path '*/.agents/*'
```
Expected: no output. If output appears, rename those files (content-scan misses them).

- [ ] **Step 3: Lane D + D2 (P7 docs + overall markers)**

Run the §8 D command (the **8 existing** p7a/b/c files — spec lane excludes the never-created p7c-tickets; passing a missing file would make grep exit 2 and `|| echo` fake-clean) then the two exempt-class filters: `| grep -v 'os-engineering-p7' | grep -vE '(→|->)'` — expected no residual (all matches are mapping-record / filename-slug exemptions).
Run the §8 D2 command on the overall spec — expected matches showing `P7d.*✅` + `2026-08-19-os-engineering-p7d`.

- [ ] **Step 4: Full test + validation**

Run: `node --test packages/osuperpowers/bin/init/tests/*.test.mjs packages/osuperpowers/bin/engine/tests/*.test.mjs packages/osuperpowers/bin/gate/tests/*.test.mjs packages/osuperpowers/bin/utils/tests/*.test.mjs packages/osuperpowers/tests/*.test.mjs packages/osuperpowers-router/tests/*.test.mjs`
Expected: all pass

Run: `pnpm run validate`
Expected: all blocks green

Run: `node scripts/version-packages.mjs --dry-run 2>&1 | tail -3 || true`
Expected: no thrown error (version sync comments renamed in Task 5)

- [ ] **Step 5: Commit any residual fixes**

If Steps 1-4 forced file edits, commit them:
```bash
git add -A
git commit -m "fix: clear residual legacy naming refs"
```

---