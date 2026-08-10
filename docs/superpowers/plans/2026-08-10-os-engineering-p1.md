# os-engineering P1 实施计划：插件骨架 + cli-* 家族

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建独立插件 `plugins/os-engineering/`（cli-* 家族 + cdd 引擎），把 SDD CLI 机制从 superpowers-overrides 迁入并重组为 registry + 单一 runner，新增 droid/pi full harness 与 harness 选择。

**Architecture:** 新增 os-engineering 插件，`harness-registry.json` 声明每 harness 的调用 flags/output 格式/review_prefix，单一 `cdd-run.sh` 从 registry 拼命令并按 output 归一化 stdout（text 透传 / stream-json 取最后 completion.finalText）。overrides 保留编器（spor-sdd）与 gate（过渡期），spor-sdd 的 CLI 派发 retarget 到 `cdd-run.sh`；4 个 cli-* 技能（select/task/driven-development/code-review）基于 cdd 引擎。

**Tech Stack:** Bash、JSON（jq）、Markdown；验证命令 `pnpm run validate`

## Global Constraints

- 缩写：`cdd` = cli-driven-development（镜像 `sdd`）；skill 家族前缀 `cli-*`
- 全量改名：迁移后的 cdd-common.sh / cdd-run.sh / cdd-select.sh / templates / cdd-reference.md 中**零 `sdd_*` / `SDD_*` / `sdd-run-` 标识残留**
- 语义规则名：`### Rule: <Name>`（无数字、无 a/b/c 子后缀）；跨技能引用用 markdown 链接 `[Rule: <Name>](../<skill>/SKILL.md#rule-<kebab>)`
- 过渡期 SDD 链必须持续可用（每任务结束 `pnpm run validate` 通过）
- 退出码：0 OK / 1 BLOCKED / 2 CLI missing
- `pnpm run validate` 必须 ALL PASS；提交信息 conventional commits，无 attribution/co-author trailer

---

## File Map

| 文件 | 操作 | Task |
|------|------|------|
| `plugins/os-engineering/.claude-plugin/plugin.json` | Create | T1 |
| `marketplace/source.json` | Modify | T1 |
| `plugins/os-engineering/bin/harness-registry.json` | Create | T2 |
| `plugins/os-engineering/tests/registry-schema.test.sh` | Create | T2 |
| `plugins/os-engineering/bin/lib/cdd-common.sh` | Create（自 sdd-common.sh 迁移+改名） | T3 |
| `plugins/os-engineering/templates/cdd/{implement,review,fix}.md` + `_handoff-write-fragment.md` | Create（迁移） | T3 |
| `plugins/os-engineering/bin/cdd-run.sh` | Create | T4 |
| `plugins/os-engineering/bin/cdd-select.sh` | Create | T5 |
| `plugins/os-engineering/skills/cli-select/SKILL.md` | Create | T5 |
| `plugins/os-engineering/skills/cli-task/SKILL.md` | Create | T6 |
| `plugins/os-engineering/skills/cli-driven-development/SKILL.md` | Create | T7 |
| `plugins/os-engineering/skills/cli-code-review/SKILL.md` | Create | T8 |
| `plugins/os-engineering/docs/cdd-reference.md` | Create（自 sdd-h6-reference.md 迁移） | T9 |
| `plugins/os-engineering/docs/controller-handoff.md` | Create（自 spor-token-efficient-controller-handoff 降级） | T9 |
| `plugins/os-engineering/docs/handoff-schema.md` | Create（自 spor-handoff-writer 降级） | T9 |
| `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` | Modify（retarget） | T10 |
| `plugins/superpowers-overrides/bin/{sdd-orchestrator-gate.sh,sdd-session-activate.sh}` + adapters | Rename→cdd-*（内部） | T10 |
| `plugins/superpowers-overrides/bin/sdd-run-task-*.sh` + `sdd-run-plan-*.sh`（10 个） | Delete | T10 |
| `plugins/superpowers-overrides/tests/rule-reference.test.py` | Modify（双模式） | T10 |
| `plugins/superpowers-overrides/tests/validate-overrides-build.sh` | Modify（registry/cdd-run 断言） | T10 |
| `plugins/superpowers-overrides/bin/lib/sdd-common.sh` + 旧引擎测试 | Delete/Move | T10 |
| `scripts/ci-validate.sh` | Modify（os-engineering 步骤） | T11 |

---

### Task 1: os-engineering 插件骨架 + marketplace 注册

**Files:**
- Create: `plugins/os-engineering/package.json`
- Create: `plugins/os-engineering/.claude-plugin/plugin.json`
- Create: `plugins/os-engineering/skills/.keep`
- Create: `plugins/os-engineering/cursor-plugins/README.md`（占位，cursor wrapper 由 emit 生成）
- Modify: `marketplace/source.json`
- Modify: `scripts/lib/marketplace-utils.mjs`（truthPaths）

**Interfaces:**
- Consumes: 无
- Produces: 插件可被 emit 解析 + validate 通过；`resolveVersion` 能从 `plugins/os-engineering/package.json` 读到 version

- [ ] **Step 1: 创建 `plugins/os-engineering/package.json`（版本真源）**

```json
{
  "name": "os-engineering",
  "version": "0.1.0",
  "private": true
}
```

> version `0.1.0` 为占位（P3 接 changeset/version-packages）。`marketplace-utils.mjs` 的 `resolveVersion` 要求 source.json 的 `plugin.version` 与真源一致。

- [ ] **Step 2: 创建 `plugins/os-engineering/.claude-plugin/plugin.json`**

```json
{
  "name": "os-engineering",
  "version": "0.1.0",
  "skills": "./skills/"
}
```

- [ ] **Step 3: 创建 `plugins/os-engineering/skills/.keep`（空目录占位，后续任务填充技能）**

```bash
mkdir -p plugins/os-engineering/skills
touch plugins/os-engineering/skills/.keep
```

- [ ] **Step 4: 修改 `scripts/lib/marketplace-utils.mjs` — truthPaths 加 os-engineering**

在 `resolveVersion` 的 `truthPaths` 对象中追加：

```js
    "os-engineering": join(
      root,
      "plugins/os-engineering/package.json",
    ),
```

- [ ] **Step 5: 修改 `marketplace/source.json` — 追加 os-engineering 条目**

在 `plugins` 数组末尾（superpowers-overrides 之后）追加：

```json
    {
      "name": "os-engineering",
      "version": "0.1.0",
      "description": "Standalone engineering skills: cli-* orchestration family (select/task/driven-development/code-review) on the cdd engine.",
      "author": {
        "name": "Oscaner Miao",
        "email": "oscaner1997@gmail.com"
      },
      "license": "MIT",
      "contentRoot": "plugins/os-engineering",
      "claude": {
        "category": "engineering",
        "keywords": [
          "engineering",
          "cli",
          "cdd",
          "harness",
          "droid",
          "pi"
        ]
      },
      "cursor": {
        "displayName": "os-engineering",
        "skills": "../../plugins/os-engineering/skills"
      }
    }
```

- [ ] **Step 6: 运行 emit + validate 确认注册成功**

```bash
pnpm run emit:marketplace
pnpm run validate
```

预期：emit 生成 `.claude-plugin/marketplace.json` + `cursor-plugins/os-engineering/` wrapper；validate `ALL PASS`（此时 os-engineering skills/ 为空，0 技能也合法）。

- [ ] **Step 7: 提交**

```bash
git add plugins/os-engineering package.json plugins/os-engineering/.claude-plugin/plugin.json marketplace/source.json scripts/lib/marketplace-utils.mjs .claude-plugin .cursor-plugin cursor-plugins
git commit -m "feat: scaffold os-engineering plugin + marketplace registration"
```

> 注：`git add` 需覆盖 emit 生成的 `.claude-plugin/`、`.cursor-plugin/`、`cursor-plugins/` 变更（它们是提交产物）。

---

### Task 2: harness registry + schema 校验测试

**Files:**
- Create: `plugins/os-engineering/bin/harness-registry.json`
- Create: `plugins/os-engineering/tests/registry-schema.test.sh`

**Interfaces:**
- Consumes: T1 的插件骨架
- Produces: `harness-registry.json` 为 cdd-run.sh / cdd-select.sh 提供 harness 配置；`registry-schema.test.sh` 断言字段合法

- [ ] **Step 1: 创建 `plugins/os-engineering/bin/harness-registry.json`**

```json
{
  "claude": {
    "cli": "claude",
    "invoke": "-p --output-format text --dangerously-skip-permissions",
    "output": "text",
    "review_prefix": "Skill(mattpocock-skills:code-review)",
    "ship": "full"
  },
  "cursor-agent": {
    "cli": "cursor-agent",
    "invoke": "--print --output-format text --force",
    "output": "text",
    "review_prefix": "",
    "ship": "full"
  },
  "droid": {
    "cli": "droid",
    "invoke": "exec --auto medium --output-format stream-json",
    "output": "stream-json",
    "review_prefix": "",
    "ship": "full"
  },
  "pi": {
    "cli": "pi",
    "invoke": "-p --no-session --no-approve",
    "output": "text",
    "review_prefix": "",
    "ship": "full"
  },
  "codex": { "cli": "codex", "ship": "not-supported" },
  "copilot": { "cli": "copilot", "ship": "not-supported" },
  "gemini": { "cli": "gemini", "ship": "not-supported" }
}
```

- [ ] **Step 2: 创建 `plugins/os-engineering/tests/registry-schema.test.sh`**

```bash
#!/usr/bin/env bash
# registry-schema.test.sh — harness-registry.json 字段合法性断言
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REG="${ROOT}/bin/harness-registry.json"

command -v jq >/dev/null 2>&1 || { echo "SKIP — jq missing"; exit 0; }
command -v python3 >/dev/null 2>&1 || { echo "FAIL — python3 missing"; exit 1; }

python3 - "$REG" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1]))
assert isinstance(reg, dict) and reg, "registry must be non-empty object"
for name, e in reg.items():
    assert isinstance(e, dict), f"{name}: must be object"
    assert "cli" in e and isinstance(e["cli"], str) and e["cli"], f"{name}: cli required"
    assert e.get("ship") in ("full", "not-supported"), f"{name}: ship must be full|not-supported"
    if e["ship"] == "full":
        for k in ("invoke", "output", "review_prefix"):
            assert k in e, f"{name}: full entry requires {k}"
        assert e["output"] in ("text", "stream-json"), f"{name}: output must be text|stream-json"
    else:
        assert "invoke" not in e, f"{name}: not-supported entry must not carry invoke"
print(f"OK — {len(reg)} harnesses, schema valid")
PY
```

> 关键断言：full 条目必有 invoke/output/review_prefix，not-supported 条目豁免 invoke。

- [ ] **Step 3: 运行 schema 测试确认通过**

```bash
chmod +x plugins/os-engineering/tests/registry-schema.test.sh
./plugins/os-engineering/tests/registry-schema.test.sh
```

预期：`OK — 7 harnesses, schema valid`。

- [ ] **Step 4: 提交**

```bash
git add plugins/os-engineering/bin/harness-registry.json plugins/os-engineering/tests/registry-schema.test.sh
git commit -m "feat: add harness registry + schema validation for os-engineering"
```

---

### Task 3: cdd-common.sh 迁移 + registry 驱动 + templates

**Files:**
- Create: `plugins/os-engineering/bin/lib/cdd-common.sh`（自 `sdd-common.sh` 迁移+改名）
- Create: `plugins/os-engineering/templates/cdd/implement.md` + `review.md` + `fix.md` + `_handoff-write-fragment.md`（迁移）
- Create: `plugins/os-engineering/tests/cdd-cli-dry-run-smoke.sh`

**Interfaces:**
- Consumes: T1 插件骨架、T2 registry
- Produces: `cdd_plugin_root` / `cdd_run_task <harness> <task_num>` / `cdd_run_plan <plan> <harness>` / `_cdd_resolve_workspace` / `_cdd_invoke_cli`（registry 驱动）/ `cdd_require_env`（CDD_* env）—— 供 T4 cdd-run.sh 调用

- [ ] **Step 1: 复制 sdd-common.sh → cdd-common.sh 并做全量改名（sed）**

```bash
mkdir -p plugins/os-engineering/bin/lib plugins/os-engineering/templates/cdd
cp plugins/superpowers-overrides/bin/lib/sdd-common.sh plugins/os-engineering/bin/lib/cdd-common.sh

# 全量改名：函数 + env + stderr 标记（覆盖 sdd_* / _sdd_* / SDD_* 全部标识）
# macOS BSD sed 不支持 \b —— 用裸 sdd_/SDD_ 规则即可（每个模式以 _ 结尾，天然词界安全）
cd plugins/os-engineering/bin/lib
sed -i '' \
  -e 's/sdd_/cdd_/g' \
  -e 's/SDD_/CDD_/g' \
  cdd-common.sh
```

> `s/sdd_/cdd_/g` 同时覆盖 `_sdd_`（其 `sdd_` 子串匹配）；`s/SDD_/CDD_/g` 覆盖 `SDD_` 前缀 env 与 `SDD_BLOCKED:`/`SDD_CLI_MISSING:`/`SDD_HARNESS_STUB:` stderr 标记（这些标记去掉 `:` 后是 `SDD_BLOCKED`，前缀规则命中）。

> 该 sed 覆盖全部 `sdd_*`/`_sdd_*`/`SDD_*` 标识（含 `sdd_run_task`、`_sdd_invoke_cli`、`SDD_MODE_ARG`、`SDD_REVIEW_FIXED_POINT` 等）。验收（Task 10 复查）：迁移后零残留。

- [ ] **Step 2: 内联 workspace resolver — 替换对上游 `sdd-workspace` 的调用**

在 `cdd-common.sh` 中，将 `_cdd_resolve_workspace`（原 `_sdd_resolve_workspace`）函数体替换为**内联推导**（不再调用上游 `sdd-workspace`），并将 `_cdd_set_task_env` 内的 `CDD_*` 导出与 `sdd_render_mode_prompt` 的 review 前缀逻辑按 Step 3 调整：

```bash
# 原 _sdd_resolve_workspace 内调用 "${scripts}/sdd-workspace" 的部分整体替换为：
# 函数名必须保持 _cdd_resolve_workspace（sed 已把两处调用点 _sdd_resolve_workspace 改为 _cdd_resolve_workspace）
_cdd_resolve_workspace() {
  local plan_file="${1:-}"
  if [[ -z "$plan_file" && -n "${CDD_WORKSPACE:-}" ]]; then
    printf '%s\n' "$CDD_WORKSPACE"
    return 0
  fi
  [[ -n "$plan_file" ]] || plan_file="${PLAN_FILE:-}"
  [[ -n "$plan_file" ]] || cdd_exit_blocked "CDD_WORKSPACE unset and --plan not provided"
  [[ -f "$plan_file" ]] || cdd_exit_blocked "plan file not found: ${plan_file}"
  local slug root base dir
  slug="$(basename "$plan_file" .md)"
  [[ -n "$slug" && "$slug" != "." && "$slug" != ".." ]] \
    || cdd_exit_blocked "cannot derive workspace name from: ${plan_file}"
  root="$(git rev-parse --show-toplevel 2>/dev/null)" \
    || cdd_exit_blocked "not in a git repo"
  base="$root/.superpowers/cdd"
  dir="$base/$slug"
  mkdir -p "$dir"
  printf '*\n' > "$base/.gitignore"
  printf '%s\n' "$dir"
}
```

> 保留 `cdd_superpowers_scripts_dir`（仍调上游 `task-brief` / `review-package`，以显式输出路径指向 `.superpowers/cdd/<plan>/`）。

- [ ] **Step 3: registry 驱动 `_cdd_invoke_cli` + review_prefix 来源改为 registry**

替换 `_cdd_invoke_cli` 函数（原为空壳，由各 harness shell 定义）为 registry 驱动实现，并让 `cdd_render_mode_prompt` 不再接收 review_prefix 参数（review 拼装移到 `_cdd_invoke_cli`）：

```bash
# registry 路径：由 cdd_plugin_root 推导（cdd-common.sh 所在插件根 = os-engineering）
_cdd_registry() {
  local root
  root="$(cdd_plugin_root)" || cdd_exit_blocked "os-engineering plugin root not found"
  printf '%s\n' "${root}/bin/harness-registry.json"
}

# 从 registry 读 harness 字段（cli / invoke / output / review_prefix）
_cdd_registry_field() {
  local harness="$1" field="$2" reg
  reg="$(_cdd_registry)"
  jq -r --arg h "$harness" --arg f "$field" '.[$h][$f] // empty' "$reg"
}

# registry 驱动 CLI 调用：拼 <cli> <invoke> "$prompt_arg"（review 时 "$review_prefix $prompt"），
# 按 output 归一化 stdout（text 透传 / stream-json 取最后 completion.finalText）
_cdd_invoke_cli() {
  local prompt="$1"
  local harness="${CDD_HARNESS:?}"
  local cli invoke output review_prefix ship prompt_arg out raw
  ship="$(_cdd_registry_field "$harness" ship)"
  [[ "$ship" == "full" ]] || cdd_exit_blocked "harness not supported: ${harness}"
  cli="$(_cdd_registry_field "$harness" cli)"
  invoke="$(_cdd_registry_field "$harness" invoke)"
  output="$(_cdd_registry_field "$harness" output)"
  review_prefix="$(_cdd_registry_field "$harness" review_prefix)"
  [[ -n "$cli" ]] || cdd_exit_blocked "unknown harness: ${harness}"
  if [[ "${CDD_MODE:-}" == "review" && -n "$review_prefix" ]]; then
    prompt_arg="${review_prefix} ${prompt}"
  else
    prompt_arg="$prompt"
  fi
  # invoke 是 whitespace flags 模板，有意 word-split（registry 受控）
  # shellcheck disable=SC2086
  out="$($cli $invoke "$prompt_arg" 2>/dev/null)" || return $?
  if [[ "$output" == "stream-json" ]]; then
    raw="$(printf '%s\n' "$out" | jq -r 'select(.type=="completion") | .finalText' | tail -1)"
    if [[ -z "$raw" ]]; then
      printf 'stream-json: no completion event\nraw head:\n%s\n' "$(printf '%s\n' "$out" | head -5)" >&2
      cdd_exit_blocked "stream-json produced no completion finalText"
    fi
    printf '%s\n' "$raw"
  else
    printf '%s\n' "$out"
  fi
}
```

同步修改 `cdd_run_task` 签名与调用点：
- 签名 `cdd_run_task harness task_num`（原 `sdd_run_task cli_bin review_prefix task_num`，sed 后函数名已是 cdd）
- 函数内：`cdd_check_cli "$cli_bin"` → `cdd_check_cli "$(_cdd_registry_field "$harness" cli)"`；`cdd_render_mode_prompt "${CDD_MODE_ARG}" "$review_prefix"` → `cdd_render_mode_prompt "${CDD_MODE_ARG}"`（review 前缀由 `_cdd_invoke_cli` 处理）
- **Mode B（cdd_run_plan）**：签名 `(plan task_script cli_bin label)` → `(plan harness)`，内部 `_run_task_mode` 每次调用前 `export CDD_MODE_ARG="$mode"`（`cdd_run_task` 读 `${CDD_MODE_ARG:-}`，Mode B 无外层 Mode A 的 export，必须自己设）；`cdd_run_task "$harness" "$n"`；**无 pending 任务尾部去掉 `$label`**（原 `printf 'sdd-run-plan-%s' "$label"` 改为 `printf 'no pending tasks\n'`，且消除 `sdd-run-` 残留）

- [ ] **Step 4: 迁移 templates 到 `templates/cdd/`**

```bash
cp plugins/superpowers-overrides/templates/sdd-cli/implement.md  plugins/os-engineering/templates/cdd/implement.md
cp plugins/superpowers-overrides/templates/sdd-cli/review.md     plugins/os-engineering/templates/cdd/review.md
cp plugins/superpowers-overrides/templates/sdd-cli/fix.md        plugins/os-engineering/templates/cdd/fix.md
cp plugins/superpowers-overrides/templates/sdd-cli/_handoff-write-fragment.md plugins/os-engineering/templates/cdd/_handoff-write-fragment.md
```

模板内容用 `{{PLACEHOLDER}}` token（由 `cdd_render_template` 从 CDD_* env 注入），无需改 token 名；但把模板内所有 `SDD` 字样替换为 `CDD`（提示文案 + 注释）：

```bash
cd plugins/os-engineering/templates/cdd
sed -i '' \
  -e 's/SDD/CDD/g' \
  -e 's/sdd_/cdd_/g' \
  -e 's/_sdd_/_cdd_/g' \
  -e 's/sdd-run-task-/cdd-run.sh --harness /g' \
  -e 's/sdd-run-plan-/cdd-run.sh --harness /g' \
  -e 's|templates/sdd-handoff-schema.md|docs/handoff-schema.md|g' \
  *.md
```

> 模板含小写 `sdd_*`/`_sdd_*`/`sdd-run-*` token（如 `_handoff-write-fragment.md` 引 `templates/sdd-handoff-schema.md`、`_sdd_template_value`），sed 需同时覆盖小写形态，否则 T12 零残留 grep 失败。

> 模板 token 映射（cdd-common.sh `cdd_render_template` 保持不变）：`{{WORKSPACE}}`→CDD_WORKSPACE、`{{BRIEF}}`→CDD_TASK_BRIEF、`{{HANDOFF}}`→CDD_HANDOFF_PATH、`{{CONSTRAINTS}}`→CDD_PLAN_CONSTRAINTS。

- [ ] **Step 5: 创建 `plugins/os-engineering/tests/cdd-cli-dry-run-smoke.sh`（迁移自 overrides 的 sdd 版）**

从 `plugins/superpowers-overrides/tests/sdd-cli-dry-run-smoke.sh` 迁移，替换：
- 引用的 `bin/lib/sdd-common.sh` → `bin/lib/cdd-common.sh`
- `sdd-run-task-*` 调用 → `bin/cdd-run.sh --harness <name>`（注：cdd-run.sh 在 T4 创建，本测试 T4 后启用；此处先写测试骨架 + 用 `CDD_DRY_RUN=1`）
- `SDD_DRY_RUN` → `CDD_DRY_RUN`、`SDD_*` → `CDD_*`、workspace `.superpowers/sdd` → `.superpowers/cdd`

将迁移后的测试文件放在 `plugins/os-engineering/tests/cdd-cli-dry-run-smoke.sh`（T4 完成后运行；本任务只落文件）。

- [ ] **Step 6: 冒烟验证 cdd-common.sh 语法 + dry-run**

```bash
bash -n plugins/os-engineering/bin/lib/cdd-common.sh && echo "syntax OK"
```

预期：`syntax OK`（dry-run 全链路测试在 T4 完成后跑）。

- [ ] **Step 7: 提交**

```bash
git add plugins/os-engineering/bin/lib/cdd-common.sh plugins/os-engineering/templates/cdd plugins/os-engineering/tests/cdd-cli-dry-run-smoke.sh
git commit -m "feat: migrate cdd-common.sh with registry-driven invoke + cdd templates"
```

> 此时 overrides 的 sdd-common.sh 原样保留（并行过渡），SDD 链未受影响。

---

### Task 4: cdd-run.sh — 单一通用 runner（Mode A / Mode B）

**Files:**
- Create: `plugins/os-engineering/bin/cdd-run.sh`

**Interfaces:**
- Consumes: T3 `cdd_run_task` / `cdd_run_plan`（签名 `(harness task_num)` / `(plan harness)`）、T2 registry
- Produces: 唯一 CLI 派发入口 —— spor-sdd（T10 retarget）与 cli-* 技能都经此调用；Mode A 任务路径、Mode B 计划驱动路径

- [ ] **Step 1: 创建 `plugins/os-engineering/bin/cdd-run.sh`**

```bash
#!/usr/bin/env bash
# cdd-run.sh — os-engineering single CLI runner: one mode per invocation (Mode A)
# or plan driver (Mode B). Registry-driven: reads harness-registry.json for the
# chosen harness's cli/invoke/output/review_prefix.
#
#   Mode A:  cdd-run.sh --harness <name> --task N --mode implement|review|fix [--plan PATH]
#   Mode B:  cdd-run.sh --harness <name> --plan PATH
#
# Entry disambiguation: --task N present => Mode A (--plan optional);
# else --plan present => Mode B (required); neither => usage exit 2.
#
# CDD_DRY_RUN=1 skips the CLI (argument parsing / orchestration smoke tests).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cdd-common.sh
source "${SCRIPT_DIR}/lib/cdd-common.sh"

HARNESS=""
TASK_NUM=""
MODE_ARG=""
PLAN_FILE=""

usage() {
  printf 'usage: %s --harness <name> (--task N --mode implement|review|fix [--plan PATH] | --plan PATH)\n' "$(basename "$0")" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --harness) [[ $# -ge 2 ]] || usage; HARNESS="$2"; shift 2 ;;
    --task)    [[ $# -ge 2 ]] || usage; TASK_NUM="$2"; shift 2 ;;
    --mode)    [[ $# -ge 2 ]] || usage; MODE_ARG="$2"; shift 2 ;;
    --plan)    [[ $# -ge 2 ]] || usage; PLAN_FILE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage ;;
  esac
done

[[ -n "$HARNESS" ]] || usage
export CDD_HARNESS="$HARNESS"

if [[ -n "$TASK_NUM" ]]; then
  # Mode A
  [[ -n "$MODE_ARG" ]] || usage
  export CDD_MODE_ARG="$MODE_ARG"
  cdd_run_task "$HARNESS" "$TASK_NUM"
else
  # Mode B
  [[ -n "$PLAN_FILE" ]] || usage
  cdd_run_plan "$PLAN_FILE" "$HARNESS"
fi
```

> 注：`SDD_MODE_ARG` 变量名在 cdd-common.sh 中已被 sed 改为 `CDD_MODE_ARG`；`MODE_ARG` 局部赋值与 `export CDD_MODE_ARG` 保持 `cdd_run_task` 内对 `${CDD_MODE_ARG:-}` 的读取一致（`_cdd_set_task_env` 里 `export CDD_MODE="${CDD_MODE_ARG:-}"`）。

- [ ] **Step 2: 语法检查 + dry-run 冒烟**

```bash
chmod +x plugins/os-engineering/bin/cdd-run.sh
bash -n plugins/os-engineering/bin/cdd-run.sh && echo "syntax OK"
```

预期：`syntax OK`。

- [ ] **Step 3: 运行迁移后的 dry-run smoke（T3 落文件，现在启用）**

```bash
./plugins/os-engineering/tests/cdd-cli-dry-run-smoke.sh
```

预期：dry-run 断言全过（`CDD_DRY_RUN=1` 下不调真实 CLI，走 `cdd_run_task` 的 dry-run 分支输出 H1 四行）。

> 若 smoke 引用过时签名（如旧 `cli_bin review_prefix` 参数），按 T3 Step 3 的 registry 签名修正测试调用。

- [ ] **Step 4: 提交**

```bash
git add plugins/os-engineering/bin/cdd-run.sh plugins/os-engineering/tests/cdd-cli-dry-run-smoke.sh
git commit -m "feat: add cdd-run.sh single registry-driven runner (Mode A/B)"
```

---

### Task 5: cdd-select.sh + cli-select 技能

**Files:**
- Create: `plugins/os-engineering/bin/cdd-select.sh`
- Create: `plugins/os-engineering/skills/cli-select/SKILL.md`
- Create: `plugins/os-engineering/tests/cdd-select.test.sh`

**Interfaces:**
- Consumes: T2 registry
- Produces: `cdd-select.sh` 输出 `available:` / `unsupported_installed:` / `recommended:`（BLOCKED exit 1 时空 available）；cli-select 技能被其余 cli-* / os-* 技能引用

- [ ] **Step 1: 创建 `plugins/os-engineering/bin/cdd-select.sh`**

```bash
#!/usr/bin/env bash
# cdd-select.sh — detect installed harness CLIs + recommended default.
# Reads harness-registry.json; prints:
#   available: <csv of ship=full AND command -v found>
#   unsupported_installed: <csv of ship=not-supported AND found>
#   recommended: <name>
# BLOCKED (exit 1) when no full harness is installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REG="${SCRIPT_DIR}/harness-registry.json"

detect_current_harness() {
  if [[ -n "${CURSOR_TRACE_ID:-}" ]]; then printf 'cursor-agent'; return; fi
  if [[ -n "${CLAUDE_CODE_SESSION_ID:-}" ]]; then printf 'claude'; return; fi
  case "${AI_AGENT:-}" in
    claude-code*) printf 'claude'; return ;;
  esac
  printf ''
}

available=""
unsupported=""
while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  ship="$(jq -r --arg n "$name" '.[$n].ship' "$REG")"
  cli="$(jq -r --arg n "$name" '.[$n].cli' "$REG")"
  if command -v "$cli" >/dev/null 2>&1; then
    if [[ "$ship" == "full" ]]; then
      available="${available} ${name}"
    else
      unsupported="${unsupported} ${name}"
    fi
  fi
done < <(jq -r 'keys[]' "$REG")

available="$(printf '%s' "$available" | xargs)"
unsupported="$(printf '%s' "$unsupported" | xargs)"

recommended=""
if [[ -z "$available" ]]; then
  printf 'available:\n'
  printf 'unsupported_installed:%s\n' "$(printf '%s' "$unsupported" | tr ' ' ',')"
  printf 'recommended:\n'
  printf 'BLOCKED: no full harness installed (registry: %s)\n' "$(jq -r 'keys[]' "$REG" | tr '\n' ' ')" >&2
  exit 1
fi

# 推荐优先级: droid > pi > 当前 harness(full) > 注册序第一个可用
if [[ " $available " == *" droid "* ]]; then
  recommended="droid"
elif [[ " $available " == *" pi "* ]]; then
  recommended="pi"
else
  current="$(detect_current_harness)"
  if [[ -n "$current" && " $available " == *" $current "* ]]; then
    recommended="$current"
  else
    recommended="$(printf '%s\n' "$available" | awk '{print $1}')"
  fi
fi

printf 'available:%s\n' "$(printf '%s' "$available" | tr ' ' ',')"
printf 'unsupported_installed:%s\n' "$(printf '%s' "$unsupported" | tr ' ' ',')"
printf 'recommended:%s\n' "$recommended"
```

- [ ] **Step 2: 创建 `plugins/os-engineering/skills/cli-select/SKILL.md`（语义规则名）**

```markdown
---
name: cli-select
description: 列出系统已安装的 harness CLI 并询问用哪个执行任务。推荐优先级 droid > pi > 当前 harness。被 cli-driven-development / cli-task / cli-code-review / os-executing-plans 引用。
---

# CLI Select

选择执行任务的 harness CLI：检测、列出、推荐、询问。

## Rules

### Rule: Detect

运行 `{plugin_root}/bin/cdd-select.sh`，解析三行输出：

- `available:` —— ship=full 且已安装的 harness（逗号分隔）
- `unsupported_installed:` —— ship=not-supported 但已安装（提示性，不参与推荐）
- `recommended:` —— 推荐默认（droid > pi > 当前 harness > 注册序第一个）

### Rule: Ask

用 `AskUserQuestion` 列出 `available` 各项，在推荐项标注「(Recommended)」并放第一位，请用户选择。

### Rule: Empty list

`available:` 为空（cdd-select.sh exit 1）→ **BLOCKED**，报告注册的 full harness 清单与缺失提示。不静默 fallback。

### Rule: Propagate

把所选 harness 以**显式** `--harness <name>` 传给调用方（`cdd-run.sh --harness <name> …`）。不设隐式环境变量。

## Red Flags

- 「当前 harness 不在 available 里，就强制用它」→ 当前非 full/未检测则跳过回退（Rule: Empty list）
- 「available 为空但 codex 在 PATH，凑合推 codex」→ not-supported 不参与推荐（Rule: Detect）
```

- [ ] **Step 3: 创建 `plugins/os-engineering/tests/cdd-select.test.sh`（mock PATH 检测 + 推荐）**

```bash
#!/usr/bin/env bash
# cdd-select.test.sh — cdd-select.sh 检测 + 推荐逻辑（mock PATH）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEL="${ROOT}/bin/cdd-select.sh"

command -v jq >/dev/null 2>&1 || { echo "SKIP — jq missing"; exit 0; }
command -v python3 >/dev/null 2>&1 || { echo "FAIL — python3 missing"; exit 1; }

mockdir="$(mktemp -d)"
trap 'rm -rf "$mockdir"' EXIT
for bin in droid pi claude codex; do printf '#!/bin/sh\nexit 0\n' > "$mockdir/$bin"; chmod +x "$mockdir/$bin"; done

# 场景1: droid+pi 在 PATH → available 含 claude,droid,pi（jq keys[] 字母序）；recommended=droid
out=$(PATH="$mockdir:$PATH" "$SEL")
echo "$out" | grep -q 'available:claude,droid,pi' || { echo "FAIL: available"; echo "$out"; exit 1; }
echo "$out" | grep -q 'recommended:droid' || { echo "FAIL: recommend droid"; echo "$out"; exit 1; }

# 场景2: 只 pi 在 PATH → recommended=pi
rm "$mockdir/droid" "$mockdir/claude"
out=$(PATH="$mockdir:$PATH" "$SEL")
echo "$out" | grep -q 'recommended:pi' || { echo "FAIL: recommend pi"; echo "$out"; exit 1; }

# 场景3: 只 codex（not-supported）在 PATH → BLOCKED exit 1
rm "$mockdir/pi"
if PATH="$mockdir:$PATH" "$SEL" >/dev/null 2>&1; then
  echo "FAIL: not-supported only should BLOCK"; exit 1
fi

echo "OK — cdd-select (3 scenarios)"
```

- [ ] **Step 4: 运行检测测试**

```bash
chmod +x plugins/os-engineering/tests/cdd-select.test.sh
./plugins/os-engineering/tests/cdd-select.test.sh
```

预期：`OK — cdd-select (3 scenarios)`。

- [ ] **Step 5: 提交**

```bash
git add plugins/os-engineering/bin/cdd-select.sh plugins/os-engineering/skills/cli-select plugins/os-engineering/tests/cdd-select.test.sh
git commit -m "feat: add cdd-select harness detection + cli-select skill"
```

---

### Task 6: cdd-exec.sh + cli-task 技能（一次性 / --loop / brief 路径）

**Files:**
- Create: `plugins/os-engineering/bin/cdd-exec.sh`
- Create: `plugins/os-engineering/skills/cli-task/SKILL.md`

**Interfaces:**
- Consumes: T3 `_cdd_invoke_cli` / `_cdd_registry_field` / `cdd_check_cli`、T5 cli-select
- Produces: `cdd-exec.sh --harness <name> --prompt <text>` 自由任务一次性入口；cli-task 技能组织 one-shot / --loop / brief 三条路径

> 注：cdd-exec.sh 不在 spec 架构树显式列出，属「cli-task 复用 cdd 引擎（registry + runner）」的实现细节 —— runner 即 cdd-exec.sh（自由任务）+ cdd-run.sh（brief/计划）。

- [ ] **Step 1: 创建 `plugins/os-engineering/bin/cdd-exec.sh`**

```bash
#!/usr/bin/env bash
# cdd-exec.sh — run one prompt via a chosen harness CLI, print normalized output.
# Reuses cdd-common.sh's registry-driven _cdd_invoke_cli (text passthrough /
# stream-json finalText extraction).
#
#   usage: cdd-exec.sh --harness <name> --prompt <text>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cdd-common.sh
source "${SCRIPT_DIR}/lib/cdd-common.sh"

usage() {
  printf 'usage: %s --harness <name> --prompt <text>\n' "$(basename "$0")" >&2
  exit 2
}

HARNESS=""
PROMPT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --harness) [[ $# -ge 2 ]] || usage; HARNESS="$2"; shift 2 ;;
    --prompt)  [[ $# -ge 2 ]] || usage; PROMPT="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage ;;
  esac
done
[[ -n "$HARNESS" && -n "$PROMPT" ]] || usage

export CDD_HARNESS="$HARNESS"
cdd_check_cli "$(_cdd_registry_field "$HARNESS" cli)"
_cdd_invoke_cli "$PROMPT"
```

- [ ] **Step 2: 创建 `plugins/os-engineering/skills/cli-task/SKILL.md`**

```markdown
---
name: cli-task
description: 把任务派发给选定的 harness CLI 执行。三条路径：一次性自由任务、--loop 迭代（sentinel 停止）、brief 路径（handoff 契约）。复用 cdd 引擎（registry + cdd-exec.sh / cdd-run.sh），无 ledger/plan 编器职责。
---

# CLI Task

把单个任务派发给选定的 harness CLI 执行，返回最终输出。

## Rules

### Rule: Choose Harness

先经 [cli-select](../cli-select/SKILL.md) 选定 harness，以显式 `--harness <name>` 传入。

### Rule: One-shot Free-Form

默认路径：`{plugin_root}/bin/cdd-exec.sh --harness <name> --prompt "<task 描述>"`，返回归一化后的最终输出（text 透传 / stream-json 取 finalText）。

### Rule: Loop

`cli-task --loop "<base prompt>"`：迭代调用 `cdd-exec.sh`，每轮 prompt = base prompt + `[Iteration N — previous result: <上一轮 final text>]`（回喂上一轮输出）。输出含 sentinel（默认 `<promise>NO MORE TASKS</promise>`，`--sentinel` 可改）或达 `--max`（默认 20）则停；逐轮显示最终文本。

### Rule: Brief Path

用户提供 brief 路径 → 走 handoff 契约：设 `CDD_TASK_BRIEF` 等 env，调 `{plugin_root}/bin/cdd-run.sh --harness <name> --task N --mode <implement|review|fix>`（模式由用户指定，默认 implement；用户 brief 即 task brief，cli-task 不做 transform）。

## Red Flags

- 「--loop 每轮发同一 prompt，反正会变」→ 无状态 print CLI 每轮输出相同，必须回喂上一轮结果（Rule: Loop）
- 「free-form 也要写 handoff.json」→ 一次性自由任务不写 ledger/handoff（Rule: One-shot Free-Form）
```

- [ ] **Step 3: 语法检查 + 提交**

```bash
chmod +x plugins/os-engineering/bin/cdd-exec.sh
bash -n plugins/os-engineering/bin/cdd-exec.sh && echo "syntax OK"
git add plugins/os-engineering/bin/cdd-exec.sh plugins/os-engineering/skills/cli-task
git commit -m "feat: add cdd-exec one-shot runner + cli-task skill"
```

---

### Task 7: cli-driven-development 技能（cdd 引擎，引擎模式）

**Files:**
- Create: `plugins/os-engineering/skills/cli-driven-development/SKILL.md`

**Interfaces:**
- Consumes: T3-T5 引擎（cdd-run.sh / cdd-select.sh / cdd-common.sh）、T9 cdd-reference.md
- Produces: 编器侧（spor-sdd，T10）与 os-executing-plans（P2）调用 cdd 引擎的入口技能；语义规则名示例

> **依赖**：本技能链接 `../docs/cdd-reference.md`（T9 创建）。执行顺序上 **T9 应先于 T7** —— 按编号顺序执行到本任务时先完成 T9（或其 Step 1），否则链接悬空。

- [ ] **Step 1: 创建 `plugins/os-engineering/skills/cli-driven-development/SKILL.md`**

```markdown
---
name: cli-driven-development
description: cdd 引擎 —— 用选定 harness CLI 驱动计划任务的开发：三模式链（implement/review/fix）+ handoff 契约 + commit gate + ledger。引擎模式：编器职责（任务分类/fix loop/质量门/D6 聚合）由 spor-sdd（过渡期）与 os-executing-plans（P2）承担。
---

# CLI-Driven Development（cdd）

用选定的 harness CLI 执行计划任务的三模式链。**这是引擎**：它执行，不做编器决策。

## Rules

### Rule: Harness Selection

执行前先经 [cli-select](../cli-select/SKILL.md) 选定 harness，以 `--harness <name>` 传入。无 full harness 安装 → BLOCKED。

### Rule: Three-Mode Chain

每任务三种模式各一次 CLI 调用（见 [cdd-reference.md](../docs/cdd-reference.md) H6）：

```bash
{plugin_root}/bin/cdd-run.sh --harness <name> --task N --mode implement
{plugin_root}/bin/cdd-run.sh --harness <name> --task N --mode review
```

`--mode fix` 仅当 review 返回 CHANGES_REQUESTED 时进入（fix loop，上限 5 轮）。

### Rule: Handoff Contract

每模式结束写/更新 `CDD_HANDOFF_PATH`（task-N-handoff.json）；stdout ≤ H1 四行；非零退出且无 handoff → BLOCKED。模板见 `templates/cdd/{implement,review,fix}.md` + `_handoff-write-fragment.md`。

### Rule: Commit Gate

implement / fix 模式返回时校验工作区干净（`cdd_validate_commit_contract`）：脏树 → 重写 handoff `status: BLOCKED` + 非零退出；非 git / git 错误 → fail-open。

### Rule: Ledger

`APPROVED` 才在 `CDD_LEDGER`（progress.md）追加 `Task N: complete` 行；CLI 子进程不写 ledger。

## Red Flags

- 「--resume / -c / 任何携带历史会话的 flag」→ 禁止（H6.5），用一次性 print 模式
- 「在编器会话里改 repo 文件」→ 引擎链只经 cdd-run.sh；会话侧由 orchestrator-gate 约束
- 「把编器决策塞进引擎」→ 分类/质量门/D6 属于编器（spor-sdd / os-executing-plans），不是引擎
```

- [ ] **Step 2: 提交**

```bash
git add plugins/os-engineering/skills/cli-driven-development
git commit -m "feat: add cli-driven-development engine skill"
```

---

### Task 8: cli-code-review 技能（独立任意 diff 评审）

**Files:**
- Create: `plugins/os-engineering/skills/cli-code-review/SKILL.md`

**Interfaces:**
- Consumes: T3 `_cdd_invoke_cli`（经 cdd-exec.sh）、上游 `review-package` 脚本、T5 cli-select
- Produces: 独立评审入口 —— 评任意 base..head / 当前分支，返回 findings 报告

- [ ] **Step 1: 创建 `plugins/os-engineering/skills/cli-code-review/SKILL.md`**

```markdown
---
name: cli-code-review
description: 用选定 harness CLI 评审任意 diff（base..head 或当前分支 vs origin/main），返回 findings 报告。独立于 cdd 链内逐任务 review 模式。
---

# CLI Code Review

评审任意 diff 范围的代码，委托给选定的 harness CLI agent。

## Rules

### Rule: Choose Harness

先经 [cli-select](../cli-select/SKILL.md) 选定 harness。

### Rule: Scope

范围 = 显式 `base..head`，或当前分支 vs `origin/main`（`git merge-base` 推导）。

### Rule: Diff Package

用上游 `review-package` 脚本生成 diff 包（`review-package PLAN_FILE BASE HEAD <out>`），作为评审输入。

### Rule: Review Prompt

构造自包含评审 prompt（含评审维度 + diff 文件路径；CLI agent 无本仓库 skill 上下文，须自带标准，不假设 `Skill(...)` 可加载），经 `cdd-exec.sh --harness <name> --prompt "<prompt>"` 派发。

### Rule: Findings Report

收集 agent 输出的 findings（按严重级 blocker / warn / nit 整理）作为报告；无 findings → 通过。报告给用户，不自动合并。

## Red Flags

- 「评审当前未提交改动用 HEAD~1」→ 用显式 base..head 或 merge-base（Rule: Scope）
- 「假设 CLI agent 能加载 mattpocock code-review skill」→ droid/pi 无该 skill；prompt 必须自包含（Rule: Review Prompt）
```

- [ ] **Step 2: 提交**

```bash
git add plugins/os-engineering/skills/cli-code-review
git commit -m "feat: add cli-code-review skill"
```

---

### Task 9: docs 迁移（cdd-reference / controller-handoff / handoff-schema）

**Files:**
- Create: `plugins/os-engineering/docs/cdd-reference.md`（自 `sdd-h6-reference.md` 迁移）
- Create: `plugins/os-engineering/docs/controller-handoff.md`（自 `spor-token-efficient-controller-handoff` H1-H5 降级）
- Create: `plugins/os-engineering/docs/handoff-schema.md`（自 `spor-handoff-writer` 降级）

**Interfaces:**
- Consumes: 无
- Produces: cli-driven-development 引用的引擎契约（cdd-reference.md）、编器/引擎共享的 H1-H5（controller-handoff.md）与 handoff schema（handoff-schema.md）

- [ ] **Step 1: 迁移 `sdd-h6-reference.md` → `cdd-reference.md`**

```bash
mkdir -p plugins/os-engineering/docs
cp plugins/superpowers-overrides/docs/sdd-h6-reference.md plugins/os-engineering/docs/cdd-reference.md
cd plugins/os-engineering/docs
sed -i '' \
  -e 's/SDD_/CDD_/g' \
  -e 's/sdd_/cdd_/g' \
  -e 's|\.superpowers/sdd|.superpowers/cdd|g' \
  -e 's/sdd-run-task-/cdd-run.sh --harness /g' \
  -e 's/sdd-run-plan-/cdd-run.sh --harness /g' \
  cdd-reference.md
```

> 小写 `s/sdd_/cdd_/g` 覆盖 doc 内的 `sdd_resolve_workspace`/`sdd_gate_decide`/`sdd_find_active_workspace`/`sdd_validate_commit_contract`/`sdd_emit_h*` 等函数标识（与 T3/T10 的 rename 一致）。

> 该 sed 覆盖 env 名、workspace 路径、harness 脚本引用。**注意**：`sdd-run-task-<harness>.sh --task N --mode implement` 这类命令形会被 sed 改成 `cdd-run.sh --harness <harness>.sh --task ...`（错），需人工修正为 `cdd-run.sh --harness <harness> --task N --mode implement`（删多余的 `.sh`）。

- [ ] **Step 2: 手动修正 cdd-reference.md 关键节**

1. **H6.1「Detect harness」**：改为「经 `cli-select` 选定 harness → `{plugin_root}/bin/cdd-run.sh --harness <name>`（orchestrator 选一次；无 runtime 重新检测）」
2. **H8 harness 映射表**：替换 per-harness 脚本表为 registry 引用 —— `harness-registry.json` 声明 cli/invoke/output/review_prefix/ship（full: claude/cursor-agent/droid/pi；not-supported: codex/copilot/gemini）
3. **「SDD gate matrix」节**：保留（orchestrator-gate 过渡期在 overrides，P1 跨插件引用该节；P2 随编器迁走后该节可移入 overrides 侧文档），但节内 allowlist 的 `sdd-run-task-*` / `sdd-run-*.sh` 改为 `cdd-run.sh --harness` 名、`SDD_GATE_FIXTURES_ROOT` 改为 `CDD_GATE_FIXTURES_ROOT`（overrides gate 同名改名），使 T12 零残留 grep 通过
4. **顶部 Rule 0 checklist 语义契约注**：保留（overrides 的 line-budget 测试仍引用）
5. **env 表**：`SDD_*` → `CDD_*`（`CDD_WORKSPACE`/`CDD_LEDGER`/`CDD_MODE`/`CDD_TASK_BRIEF`/`CDD_HANDOFF_PATH`/`CDD_PLAN_CONSTRAINTS`/`CDD_FINDINGS`/`CDD_REVIEW_FIXED_POINT`）
6. **batching 文件名**：`batch-<first>-<last>-handoff.json` 等保留（handoff 契约不变）
7. **Typical per-task shell sequence**：`sdd-run-task-<harness>.sh --task N --mode implement` → `cdd-run.sh --harness <name> --task N --mode implement`

- [ ] **Step 3: 迁移 `spor-token-efficient-controller-handoff` → `docs/controller-handoff.md`**

从 `plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md` 提取 H1-H5 编器纪律，写入 `controller-handoff.md`（语义规则名形式，保留 H1 return 块、H2 handoff-only、H3 review-package、H4 fix cap 5、H5 inline handoff）：

```bash
# 手写 docs/controller-handoff.md：标题 + H1-H5 编器纪律（语义规则名）
cat > plugins/os-engineering/docs/controller-handoff.md <<'EOF'
# Controller Handoff（H1-H5）

编器（spor-sdd 过渡期 / os-executing-plans P2）驱动 cdd 引擎的纪律。被 cli-driven-development 与编器技能引用。

## Rules

### Rule: H1 Return Block
CLI agent stdout ≤ H1 四行（status/commits/artifacts/blocker）；编器只读 H1。

### Rule: H2 Handoff Only
编器读 handoff.json 驱动后续（plan_conflicts → STOP；CHANGES_REQUESTED → fix 链；NEEDS_CONTEXT/unverifiable → STOP），不读 report body。

### Rule: H3 Review Package
review 用上游 review-package 生成 diff 包；scope 用 handoff commits.base。

### Rule: H4 Fix Cap
fix loop 上限 5 轮，超限 STOP + 升级。

### Rule: H5 Inline Handoff
handoff 写入内联在各模式模板，无独立 handoff 模式。
EOF
```

- [ ] **Step 4: 迁移 `spor-handoff-writer` → `docs/handoff-schema.md`**

从 `plugins/superpowers-overrides/skills/spor-handoff-writer/SKILL.md` 提取 handoff JSON schema（status/commits/artifacts/blocker/findings[].deferred 等），写入 `docs/handoff-schema.md`。templates 与 cdd-reference 以相对路径引用它。

- [ ] **Step 5: 更新 cli-driven-development 的 docs 链接（如 T7 中 `../docs/cdd-reference.md`）并提交**

```bash
git add plugins/os-engineering/docs
git commit -m "docs: migrate cdd-reference, controller-handoff, handoff-schema into os-engineering"
```

---

### Task 10: overrides 过渡 —— spor-sdd retarget + gate 内部改名 + 删 per-harness 脚本

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`（Rule 0/7 retarget）
- Rename: `plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh` → `cdd-orchestrator-gate.sh`（内部改名）
- Rename: `plugins/superpowers-overrides/bin/sdd-session-activate.sh` → `cdd-session-activate.sh`
- Modify: `plugins/superpowers-overrides/bin/override-claude-sdd-gate.sh` + `override-cursor-sdd-gate.sh`（lib 引用）
- Delete: `plugins/superpowers-overrides/bin/sdd-run-task-{claude,cursor,codex,copilot,gemini}.sh` + `sdd-run-plan-{同}.sh`（10 个）

**Interfaces:**
- Consumes: T3-T9 引擎就位
- Produces: overrides 的 spor-sdd 派发指向 cdd 引擎；gate 内部 cdd 化；per-harness 脚本删除

- [ ] **Step 1: spor-sdd SKILL.md retarget — 更新 CLI 派发与引用**

在 `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`：

1. **Rule 7** 派发命令改为完整转发：
   - 任务路径：`{os-engineering}/bin/cdd-run.sh --harness <name> --task N --mode implement|review|fix [--plan PATH]`
   - 计划驱动路径：`{os-engineering}/bin/cdd-run.sh --harness <name> --plan PATH`
   - `{os-engineering}` = os-engineering 插件根（相对路径 `../../os-engineering` 或 `{plugin_root}` 邻居）
2. **Rule 0** 指针更新：
   - `{plugin_root}/docs/sdd-h6-reference.md` → `{os-engineering}/docs/cdd-reference.md`
   - `spor-token-efficient-controller-handoff` H1–H5 → `{os-engineering}/docs/controller-handoff.md`
   - `templates/sdd-cli/*.md` → `{os-engineering}/templates/cdd/*.md`
3. **Rule 0 item 3「Workers → templates/sdd-cli/*.md」** 同步指向 os-engineering templates/cdd/

> 保留编器 Rules 1-8 内容（分类/fix loop/质量门/D6 不动，P2 移 os-executing-plans）。

- [ ] **Step 2: gate 内部改名 — lib + session-activate**

```bash
cd plugins/superpowers-overrides/bin
mv lib/sdd-orchestrator-gate.sh lib/cdd-orchestrator-gate.sh
mv sdd-session-activate.sh cdd-session-activate.sh
# lib 内全量改名（函数 + 变量 + 路径）；BSD sed 无 \b，用裸 sdd_/SDD_ 规则
sed -i '' -e 's/sdd_/cdd_/g' -e 's/SDD_/CDD_/g' lib/cdd-orchestrator-gate.sh
sed -i '' -e 's|\.superpowers/sdd|.superpowers/cdd|g' lib/cdd-orchestrator-gate.sh
sed -i '' -e 's/sdd_/cdd_/g' -e 's/SDD_/CDD_/g' cdd-session-activate.sh
```

- [ ] **Step 3: 更新 gate adapters 的 lib 引用 + gate 测试 env 同步改名**

在 `override-claude-sdd-gate.sh` / `override-cursor-sdd-gate.sh` 中，把 `source ".../lib/sdd-orchestrator-gate.sh"` 改为 `source ".../lib/cdd-orchestrator-gate.sh"`，并把内部对 `sdd_*` 函数的调用同步改为 `cdd_*`（grep 逐个确认）。

**gate 测试文件 env 同步**：Step 2 的 `\bSDD_`→`CDD_` 已把 gate lib 的 `SDD_GATE_FIXTURES_ROOT`/`SDD_PENDING_ROOT`/`SDD_GATE_TEST_TAG` 改为 `CDD_*`，因此 `tests/sdd-gate-test-lib.sh`、`tests/sdd-gate-allow-deny-smoke.sh`、`tests/override-claude-sdd-gate.test.sh`、`tests/override-cursor-sdd-gate.test.sh` 中的同名 env 导出必须同步改名，否则 gate 读到未设置变量、测试失败：

```bash
cd plugins/superpowers-overrides/tests
sed -i '' \
  -e 's/SDD_GATE_FIXTURES_ROOT/CDD_GATE_FIXTURES_ROOT/g' \
  -e 's/SDD_PENDING_ROOT/CDD_PENDING_ROOT/g' \
  -e 's/SDD_GATE_TEST_TAG/CDD_GATE_TEST_TAG/g' \
  -e 's/sdd_/cdd_/g' \
  -e 's/sdd-session-activate/cdd-session-activate/g' \
  -e 's|\.superpowers/sdd|.superpowers/cdd|g' \
  sdd-gate-test-lib.sh sdd-gate-allow-deny-smoke.sh override-claude-sdd-gate.test.sh override-cursor-sdd-gate.test.sh
```

> 覆盖 gate 测试内：`ACT=".../sdd-session-activate.sh"`（文件名）、`SDD_GATE_FIXTURES_ROOT` 导出、fixture/断言路径 `.superpowers/sdd`。BSD sed 无 `\b`，用裸规则。

- [ ] **Step 4: 删除 10 个 per-harness 脚本**

```bash
cd plugins/superpowers-overrides/bin
rm sdd-run-task-claude.sh sdd-run-task-cursor.sh sdd-run-task-codex.sh sdd-run-task-copilot.sh sdd-run-task-gemini.sh
rm sdd-run-plan-claude.sh sdd-run-plan-cursor.sh sdd-run-plan-codex.sh sdd-run-plan-copilot.sh sdd-run-plan-gemini.sh
```

- [ ] **Step 5: 更新 hooks.json / hooks-cursor.json 中 PreToolUse 适配器引用（若仍指 sdd-session-activate）**

grep 确认 hooks 引用的 `cdd-session-activate.sh` / `override-*-sdd-gate.sh` 路径仍然存在；若 hooks.json 引用 `sdd-session-activate.sh` 旧名，同步改为 `cdd-session-activate.sh`（hooks.json 为生成产物，直接改后 `pnpm run validate` 的 freshness 检查若报 diff 再重跑生成器）。

- [ ] **Step 6: 更新 validate-overrides-build.sh — 删 10-script 断言（与脚本删除同任务，保持 validate 每任务绿）**

在 `plugins/superpowers-overrides/tests/validate-overrides-build.sh` 中删除「10 harness 脚本存在且可执行」断言循环（T11 Step 2 只负责新增 os-engineering 断言）。

- [ ] **Step 7: 运行 overrides 既有测试（gate/hook 类应仍过）**

```bash
pnpm run validate
```

预期：gate/hook 测试过（`override-cursor-sdd-gate` / `override-claude-sdd-gate` / `sdd-gate-allow-deny-smoke`），validate-overrides-build 已删 10-script 断言所以不再失败；**此时 os-engineering 侧测试尚未接入 ci-validate**（T12 接入），故 validate 覆盖 overrides 全绿即可。

- [ ] **Step 8: 提交**

```bash
git add plugins/superpowers-overrides/skills/spor-subagent-driven-development plugins/superpowers-overrides/bin plugins/superpowers-overrides/tests
git commit -m "refactor: retarget spor-sdd to cdd-run.sh, rename gate to cdd, delete per-harness scripts"
```

---

### Task 11: 测试拆分 + validate-overrides-build 更新 + rule-reference 双模式

**Files:**
- Modify: `plugins/superpowers-overrides/tests/rule-reference.test.py`（双模式）→ 迁移至 `plugins/os-engineering/tests/rule-reference.test.py`
- Modify: `plugins/superpowers-overrides/tests/validate-overrides-build.sh`（断言更新）
- Move: `plugins/superpowers-overrides/tests/sdd-commit-gate-smoke.sh` → `plugins/os-engineering/tests/cdd-commit-gate-smoke.sh`（测试 cdd-common.sh）
- Move: `plugins/superpowers-overrides/tests/sdd-common-functions.test.sh` → `plugins/os-engineering/tests/cdd-common-functions.test.sh`
- Move: `plugins/superpowers-overrides/tests/sdd-severity-contract.test.sh` → `plugins/os-engineering/tests/cdd-severity-contract.test.sh`（路径 retarget）
- Modify: `plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh`（controller-handoff 引用 retarget + 计数更新）
- Delete: `plugins/superpowers-overrides/bin/lib/sdd-common.sh`
- Modify: `plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md` + `spor-handoff-writer/SKILL.md`（降为薄指针）

**Interfaces:**
- Consumes: T10（脚本已删、gate 已改名）
- Produces: 校验体系按「引擎在 os-engineering、gate/hook 在 overrides」拆分，`pnpm run validate` 全绿

- [ ] **Step 1: rule-reference.test.py 双模式 + 迁移到 os-engineering**

把 `plugins/superpowers-overrides/tests/rule-reference.test.py` 复制到 `plugins/os-engineering/tests/rule-reference.test.py`，做两处改造：

1. **双模式解析**：`HEAD` / `REF` / `SCOPED` 正则同时接受数字与语义两种形态：
   - 数字：`Rule ([0-9]+[a-z]?)\b`
   - 语义：`Rule: ([A-Z][A-Za-z ]*?)\b`（如 `Rule: Task Complexity`）
   - 语义标题：`### Rule: <Name>`（无数字）；子标题 `#### <Name>` 不纳入顶层规则 ID
2. **校验范围**：接受 `--skills-dir` 参数，脚本默认同时扫描 `os-engineering/skills`（语义）与 `superpowers-overrides/skills`（数字，过渡期）；迁移后的脚本入口：

```bash
python3 plugins/os-engineering/tests/rule-reference.test.py \
  --skills os-engineering/skills:semantic superpowers-overrides/skills:numeric
```

> 语义 cross-ref 用 markdown 链接 `[Rule: <Name>](../<skill>/SKILL.md#rule-<kebab>)` —— 解析器从链接文本提取 `<Name>` 并在目标技能查找 `### Rule: <Name>` 标题。

- [ ] **Step 2: validate-overrides-build.sh 更新断言**

在 `plugins/superpowers-overrides/tests/validate-overrides-build.sh`：

1. **删除**「10 harness 脚本存在且可执行」的断言循环
2. **新增**：
   - `plugins/os-engineering/bin/harness-registry.json` 存在 + `registry-schema.test.sh` 通过
   - `plugins/os-engineering/bin/cdd-run.sh` / `cdd-select.sh` / `cdd-exec.sh` 存在且可执行
   - `plugins/os-engineering/tests/rule-reference.test.py`（双模式）通过
   - `plugins/os-engineering/tests/cdd-cli-dry-run-smoke.sh` / `cdd-select.test.sh` 通过
3. 保留 gate/hook 断言（cdd-orchestrator-gate.sh 改名后路径更新）

- [ ] **Step 3: 迁移引擎测试到 os-engineering**

```bash
# commit-gate + common-functions 随引擎迁移，改名 sdd→cdd、SDD_*→CDD_*、路径 .superpowers/cdd/
git mv plugins/superpowers-overrides/tests/sdd-commit-gate-smoke.sh plugins/os-engineering/tests/cdd-commit-gate-smoke.sh
git mv plugins/superpowers-overrides/tests/sdd-common-functions.test.sh plugins/os-engineering/tests/cdd-common-functions.test.sh
sed -i '' -e 's/sdd_/cdd_/g' -e 's/SDD_/CDD_/g' -e 's|\.superpowers/sdd|.superpowers/cdd|g' \
  plugins/os-engineering/tests/cdd-commit-gate-smoke.sh plugins/os-engineering/tests/cdd-common-functions.test.sh
```

> **F1 review-prefix 断言更新**：T3 Step 3 已把 `cdd_render_mode_prompt` 改为单参（review 前缀移到 `_cdd_invoke_cli`）。`cdd-common-functions.test.sh` 中 2 参形式 +「review 前缀被 prepend」的 F1 断言**必须删除或改写**为等价 `_cdd_invoke_cli` 层断言，否则迁移后失败。

> 引用 `bin/lib/sdd-common.sh` 的行改为 `bin/lib/cdd-common.sh`；引用 `SDD_GATE_FIXTURES_ROOT` 的测试行**删除**（gate fixtures 属 gate，留 overrides）。

- [ ] **Step 4: severity-contract 迁移到 os-engineering**

```bash
git mv plugins/superpowers-overrides/tests/sdd-severity-contract.test.sh plugins/os-engineering/tests/cdd-severity-contract.test.sh
# 引用改为 os-engineering 侧：templates/cdd/*.md、docs/handoff-schema.md、bin/lib/cdd-common.sh、CDD_*
sed -i '' \
  -e 's|templates/sdd-cli|templates/cdd|g' \
  -e 's|sdd-handoff-schema.md|docs/handoff-schema.md|g' \
  -e 's|bin/lib/sdd-common.sh|bin/lib/cdd-common.sh|g' \
  -e 's/SDD_/CDD_/g' \
  plugins/os-engineering/tests/cdd-severity-contract.test.sh
```

> 保留对 `spor-subagent-driven-development` Rule 8（D6 终盘聚合）的断言（经相对路径 `../../superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` 引用，编器仍在 overrides）。

- [ ] **Step 5: line-budget retarget**

`sdd-orchestrator-line-budget.test.sh`：Tier 1 的 controller-handoff 引用从 `skills/spor-token-efficient-controller-handoff/SKILL.md` 改为 `os-engineering/docs/controller-handoff.md`（若薄指针保留，则按薄指针行数重算）。重新测量后更新期望行数。

- [ ] **Step 6: 降级 controller-handoff / handoff-writer SKILL.md 为薄指针**

把 `spor-token-efficient-controller-handoff/SKILL.md` 与 `spor-handoff-writer/SKILL.md` 内容替换为薄指针（frontmatter + 一行指向 os-engineering docs），保留技能位使既有引用/解析不破；P3 薄封装时整体删除：

```markdown
---
name: spor-token-efficient-controller-handoff
description: 已降级 —— H1-H5 编器纪律迁至 os-engineering docs/controller-handoff.md。此技能为过渡期薄指针（P3 删除）。
---

# Controller Handoff（降级指针）

见 [controller-handoff.md](../../../os-engineering/docs/controller-handoff.md)。引用方改为直接链接该文档。
```

- [ ] **Step 7: 删除 overrides 的 sdd-common.sh**

```bash
git rm plugins/superpowers-overrides/bin/lib/sdd-common.sh
```

> 前提：T3 的 cdd-common.sh 已就位、T10 已删 10 脚本、本任务已迁引擎测试，overrides 侧无引用残留。grep 确认 `sdd-common` 在 overrides 内零引用后再删。

- [ ] **Step 8: 全量 validate**

```bash
pnpm run validate
```

预期：ALL PASS（gate/hook 测试在 overrides、引擎测试在 os-engineering、rule-reference 双模式同时校验两插件）。

- [ ] **Step 9: 提交**

```bash
git add -A plugins/os-engineering plugins/superpowers-overrides
git commit -m "refactor: split tests engine/overrides, dual-mode rule-reference, thin-pointer downgraded skills"
```

---

### Task 12: ci-validate.sh os-engineering 步骤 + 终检（零残留 + ALL PASS）

**Files:**
- Modify: `scripts/ci-validate.sh`
- Modify（可选）: `README.md` / `README.zh-CN.md`（os-engineering 插件条目）

**Interfaces:**
- Consumes: T1-T11 全部就位
- Produces: `pnpm run validate` 覆盖 os-engineering + overrides，ALL PASS；零 sdd 残留

- [ ] **Step 1: ci-validate.sh 新增 os-engineering 步骤**

在 `scripts/ci-validate.sh` 的步骤 5 后新增「== 5b. os-engineering plugin validation ==」：

```bash
echo "== 5b. os-engineering plugin validation =="
python3 -c '
import json, os
root = "plugins/os-engineering"
d = json.load(open(os.path.join(root, ".claude-plugin/plugin.json")))
skills = d.get("skills")
skills_dir = os.path.join(root, skills.lstrip("./"))
assert os.path.isdir(skills_dir), f"missing skills dir: {skills_dir}"
n = sum(1 for x in os.listdir(skills_dir) if os.path.isfile(os.path.join(skills_dir, x, "SKILL.md")))
print(f"OK — {n} os-engineering skills")
'
./plugins/os-engineering/tests/registry-schema.test.sh
./plugins/os-engineering/tests/cdd-select.test.sh
./plugins/os-engineering/tests/cdd-cli-dry-run-smoke.sh
./plugins/os-engineering/tests/cdd-commit-gate-smoke.sh
./plugins/os-engineering/tests/cdd-common-functions.test.sh
./plugins/os-engineering/tests/cdd-severity-contract.test.sh
python3 plugins/os-engineering/tests/rule-reference.test.py \
  --skills os-engineering/skills:semantic superpowers-overrides/skills:numeric
```

> 注：severity-contract 已在 T11 Step 4 `git mv` 到 `plugins/os-engineering/tests/cdd-severity-contract.test.sh`，此处路径即 os-engineering 侧唯一路径。

- [ ] **Step 2: 零残留终检**

```bash
# 迁移后的引擎文件零 sdd 标识（cdd-common.sh / cdd-run.sh / cdd-select.sh / cdd-exec.sh / templates / cdd-reference.md）
grep -rnE '\b(sdd_|_sdd_|SDD_|sdd-run-)' \
  plugins/os-engineering/bin plugins/os-engineering/templates plugins/os-engineering/docs/cdd-reference.md \
  || echo "OK — zero sdd residue in migrated engine"
```

预期：`OK — zero sdd residue in migrated engine`（gate 属 overrides 过渡期，其 env 已随 T10 Step 3 改为 `CDD_*`；`CDD_GATE_FIXTURES_ROOT` 等在 overrides 侧，不算迁移引擎残留）。

- [ ] **Step 3: README 补 os-engineering 条目（可选）**

在 `README.md` 插件清单补一行 `os-engineering`（cli-* 家族 + cdd 引擎）。

- [ ] **Step 4: 全量 validate**

```bash
pnpm run emit
pnpm run validate
```

预期：`ALL PASS`（emit 重新生成 marketplace 产物，validate 覆盖两插件）。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "ci: add os-engineering validation steps + zero-residue check"
```


---











