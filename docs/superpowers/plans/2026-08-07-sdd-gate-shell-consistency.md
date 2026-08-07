# SDD gate Shell/Write 一致性 + 防劫持 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 SDD PreToolUse gate 的 Shell/Write 不一致（issue #53）并加固防劫持：(a) 只读 git 诊断 Bash 可用 + deny 消息升级为多行 allowlist 矩阵；(b) TASK_BASE 必须真实 git object + bound-ws 优先，旧 workspace 不再劫持新 session；(c) 全矩阵 smoke 测试 + fixture 隔离到 `tests/fixtures/sdd-gate/`。

**Architecture:** 核心改动集中在 `bin/lib/sdd-orchestrator-gate.sh`（共享单源，两个 harness adapter 零改动自动继承）。T1 改 shell 一致性（`sdd_shell_allowed` 重命名+扩展 + `sdd_git_verb_allowed` + deny 消息矩阵）；T2 改防劫持（`sdd_git_object_exists` + `sdd_brief_has_task_base` git-object 校验 + `sdd_gate_phase` 单一解析点/bound-ws 优先）。T1→T2→T3 串行（**T1/T2/T3 都改同一 lib**：T1 shell、T2 防劫持、T3 `SDD_GATE_FIXTURES_ROOT` 覆盖）。T3 建 fixture 基础设施 + 改造现有两个 gate 测试；T4 新增全矩阵 smoke + CI 挂载；T5 文档（sdd-h6-reference / cross-harness-overrides / spor-SDD Rule 0a）；T6 清理 dogfood-test + 全量 validate。T4/T5 依赖 T1+T2+T3。

**Tech Stack:** Bash、jq、git；验证命令 `pnpm run validate`

## Global Constraints

- 不改 adapter JSON 格式（`hookSpecificOutput.permissionDecision` / `.permission`）
- 不改 H6 four-mode 语义、`sdd-run-task-*.sh` 行为
- **No duplicated allowlist logic** — 判定逻辑放共享 lib，不保留 `sdd_bash_allowed` 与 `sdd_shell_allowed` 两个函数
- 不改 fail-open 语义（无 jq / 无 pending → allow）
- spor-SDD 保持 ≤160 行（当前 94 行，Rule 0a 补一行安全）
- 解析失败 → deny（fail-closed）
- `git cat-file -e` 必须 `git -C "$repo_root"`（CWD 无关）
- 提交信息使用 conventional commits，无 attribution/co-author trailer

---

## File Map

| 文件 | 操作 | Task |
|------|------|------|
| `plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh` | Modify | T1, T2, T3 |
| `plugins/superpowers-overrides/tests/fixtures/sdd-gate/` | Create | T3 |
| `plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh` | Modify | T3 |
| `plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh` | Modify | T3 |
| `plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh` | Create | T4 |
| `scripts/ci-validate.sh` | Modify | T4 |
| `plugins/superpowers-overrides/docs/sdd-h6-reference.md` | Modify | T5 |
| `plugins/superpowers-overrides/docs/cross-harness-overrides.md` | Modify | T5 |
| `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` | Modify | T5 |
| `.superpowers/sdd/dogfood-test/` | Delete | T6 |

---

### Task 1: `sdd_shell_allowed` 重命名+扩展 + `sdd_git_verb_allowed` + deny 消息矩阵

**Files:**
- Modify: `plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh`

**Interfaces:**
- Consumes: 无（首个改动）
- Produces: shell 一致性；`sdd_gate_decide` 唯一调用点更新；deny 消息多行矩阵

- [ ] **Step 1: 重命名 `sdd_bash_allowed` → `sdd_shell_allowed` 并扩展只读 git 动词**

  将现有 `sdd_bash_allowed()`（当前第 77-84 行）重命名为 `sdd_shell_allowed()`，在其 allowlist `case` 之后追加只读 git 判定：

  ```bash
  sdd_shell_allowed() {
    local cmd="$1"
    case "$cmd" in
      *sdd-run-task-*|*sdd-workspace*|*task-brief*|*review-package*) return 0 ;;
    esac
    if sdd_git_verb_allowed "$cmd"; then
      return 0
    fi
    return 1
  }
  ```

  更新 `sdd_gate_decide` 里 shell 分支的调用点：`sdd_bash_allowed "$cmd"` → `sdd_shell_allowed "$cmd"`。**不保留 `sdd_bash_allowed` 函数**（避免重复 allowlist 逻辑）。

- [ ] **Step 2: 新增 `sdd_git_verb_allowed()` — 提取 git 子命令并查只读白名单**

  新增函数（放在 `sdd_shell_allowed` 附近）：

  ```bash
  # 提取 git 子命令并查只读白名单。提取失败 → return 1（deny，fail-closed）。
  # 支持：git <verb>、git -C <path> <verb>、git --git-dir=<path> <verb>
  # v1 不支持：git -C <path> -c k=v <verb>（-c 配置选项）→ 提取失败 → deny
  sdd_git_verb_allowed() {
    local cmd="$1" verb=""
    local -a tokens=()
    read -r -a tokens <<<"$cmd"
    [[ "${tokens[0]:-}" == "git" ]] || return 1
    local i=1
    while [[ $i -lt ${#tokens[@]} ]]; do
      case "${tokens[$i]}" in
        -C)
          i=$((i + 2))        # 跳过 -C 及其路径
          continue
          ;;
        --git-dir=*)          # 跳过 --git-dir=<path>
          i=$((i + 1))
          continue
          ;;
        -*)                   # 其它未知 flag → 提取失败 → deny
          return 1
          ;;
        *)
          verb="${tokens[$i]}"
          break
          ;;
      esac
    done
    [[ -n "$verb" ]] || return 1
    case "$verb" in
      status|diff|log|show|rev-parse|branch|remote|ls-files|diff-tree) return 0 ;;
      *) return 1 ;;
    esac
  }
  ```

- [ ] **Step 3: 更新 `sdd_deny_message()` 为多行 allowlist 矩阵**

  将 `sdd_deny_message()`（当前第 212-222 行）替换为（**用 `<<-EOF`**，容忍前导 tab，保证 code block 内缩进也能正确终止 heredoc）：

  ```bash
  sdd_deny_message() {
    local harness="$1" task_num="$2" plan_basename="$3"
    local plugin_root
    plugin_root="$(sdd_plugin_root_from_lib)"
    cat <<-EOF
  SDD orchestrator gate — direct repo edits forbidden during active task.

  Allowed Bash (read-only diagnostics):
    git status / git diff / git log / git show / git rev-parse / git branch / git remote
    git ls-files / git diff-tree
    ${plugin_root}/bin/sdd-run-task-${harness}.sh
    sdd-workspace / task-brief / review-package

  Allowed Write:
    .superpowers/sdd/${plan_basename}/

  Repo changes flow only through:
    ${plugin_root}/bin/sdd-run-task-${harness}.sh --task ${task_num} --mode implement

  Full matrix: docs/sdd-h6-reference.md (SDD gate matrix)
  See spor-SDD Rule 0a item 4.
  EOF
  }
  ```

  > `<<-EOF` 允许前导 tab；文本行用 tab 缩进对齐函数体。若实现环境偏好左对齐文本，也可用 `<<EOF` + 左对齐（参考当前实现第 216-221 行）。两种都需保证 `EOF` 终结符无多余缩进/空格。

- [ ] **Step 4: 验证 T1 改动**

  ```bash
  cd /Users/kang/Projects/oscaner-skills
  bash -n plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh
  # 快速行为验证：只读 git allow、变更类 git deny
  ROOT=plugins/superpowers-overrides
  GATE=$ROOT/bin/override-claude-sdd-gate.sh
  ACT=$ROOT/bin/sdd-session-activate.sh
  PENDING="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"
  WS="$PWD/.superpowers/sdd/dogfood-test"
  rm -f "$PENDING"/*.json
  "$ACT" bind conv-t1 "$PWD" "docs/superpowers/plans/x.md" "$WS"
  echo 'TASK_BASE: 0dc7387' > "$WS/task-1-brief.md"
  printf '%s' "{\"session_id\":\"conv-t1\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git status --short\"}}" | "$GATE" | jq -r '.hookSpecificOutput.permissionDecision'   # 预期 allow
  printf '%s' "{\"session_id\":\"conv-t1\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git add .\"}}" | "$GATE" | jq -r '.hookSpecificOutput.permissionDecision'  # 预期 deny
  printf '%s' "{\"session_id\":\"conv-t1\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git add .\"}}" | "$GATE" | jq -r '.hookSpecificOutput.permissionDecisionReason'   # 预期含矩阵
  rm -f "$WS/task-1-handoff.json" "$PENDING"/conv-t1.json
  ```

  预期：`git status` → `allow`；`git add .` → `deny`；deny 消息含 "Allowed Bash" / "git show" / "Allowed Write"。

- [ ] **Step 5: 提交**

  ```bash
  git add plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh
  git commit -m "fix: allow read-only git diagnostics in sdd orchestrator gate"
  ```

---

### Task 2: 防劫持 — `sdd_git_object_exists` + `sdd_brief_has_task_base` git-object 校验 + `sdd_gate_phase` 单一解析点/bound-ws 优先

**Files:**
- Modify: `plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh`

**Interfaces:**
- Consumes: T1（同文件）
- Produces: 旧 workspace（stub `TASK_BASE: abc`）不再劫持新 session；bound-ws 优先

- [ ] **Step 1: 新增 `sdd_git_object_exists()` — git-object 校验（绑定 repo_root）**

  ```bash
  # git cat-file 必须绑定 repo_root（CWD 无关）。实证：bare `git cat-file -e` 依赖 CWD 是 git 仓库。
  sdd_git_object_exists() {
    local repo_root="$1" sha="$2"
    git -C "$repo_root" cat-file -e "$sha" 2>/dev/null   # 真实 SHA → 0；stub 'abc' → 1
  }
  ```

- [ ] **Step 2: `sdd_brief_has_task_base()` 加 git-object 校验（签名变更，加 repo_root）**

  ```bash
  sdd_brief_has_task_base() {
    local brief="$1" repo_root="$2"
    [[ -f "$brief" ]] || return 1
    local sha
    sha="$(sed -nE 's/^TASK_BASE: //p' "$brief" | head -1 | tr -d ' \r')"
    [[ -n "$sha" ]] || return 1
    sdd_git_object_exists "$repo_root" "$sha"
  }
  ```

- [ ] **Step 3: 更新 `sdd_brief_has_task_base` 全部调用点，传入 `repo_root`**

  `grep -n "sdd_brief_has_task_base" plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh` 定位。调用点：
  - `sdd_find_active_workspace()` — 已有 `repo_root` 参数，传入
  - `sdd_gate_phase()` — 已有 `repo_root`，传入
  - `sdd_frontier_task()` — **新增 `repo_root` 参数**，从 `sdd_gate_phase` 和 `sdd_active_task_num` 调用点传入

  逐个更新为 `sdd_brief_has_task_base "$brief" "$repo_root"`。

  **`repo_root` 传播链（必须完整，否则 git-object 校验拿空 repo_root）**：
  - `sdd_frontier_task()` 签名 → `sdd_frontier_task "$workspace" "$repo_root"`
  - `sdd_active_task_num()`（当前第 207 行）签名 → `sdd_active_task_num "$workspace" "$repo_root"`，内部调 `sdd_frontier_task "$workspace" "$repo_root"`
  - `sdd_gate_decide` 内 `sdd_active_task_num` 两个调用点（当前第 308、324 行）→ `task_num="$(sdd_active_task_num "$active_ws" "$repo_root")"`

- [ ] **Step 4: `sdd_gate_phase()` 单一解析点 + bound-ws 优先**

  `sdd_gate_decide` 保持单一解析点（当前第 291-295 行已是）：
  ```bash
  workspace="$(sdd_resolve_workspace "$repo_root" "$pending" || true)"
  active_ws="$workspace"
  if [[ -z "$active_ws" ]]; then
    active_ws="$(sdd_find_active_workspace "$repo_root" || true)"   # git-object 过滤后 stub 不激活
  fi
  phase="$(sdd_gate_phase "$repo_root" "$active_ws" "$pending")"   # 传入已解析 active_ws
  ```

  修改 `sdd_gate_phase()`：**接收已解析的 `$workspace`，删除内部二次 resolve/find**（当前第 176-184 行）：
  ```bash
  sdd_gate_phase() {
    local repo_root="$1" workspace="$2" pending_json="$3"
    local n brief next_brief active_ws
    active_ws="$workspace"    # 直接使用已解析值
    if [[ -z "$active_ws" ]]; then
      printf 'orchestrating\n'
      return 0
    fi
    ...
  }
  ```

  > **注意**：minimal 模式（未 bind）的 `find_active_workspace` 由 `sdd_gate_decide` 的单一解析点保证；若 `active_ws` 为空，`sdd_gate_phase` 返回 `orchestrating`（行为保留）。

- [ ] **Step 5: 验证 T2 改动**

  ```bash
  cd /Users/kang/Projects/oscaner-skills
  bash -n plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh
  ROOT=plugins/superpowers-overrides
  GATE=$ROOT/bin/override-claude-sdd-gate.sh
  ACT=$ROOT/bin/sdd-session-activate.sh
  PENDING="${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd"
  WS="$PWD/.superpowers/sdd/dogfood-test"
  NEW_WS="$PWD/.superpowers/sdd/t2-probe-ws"      # 用于区分的"新 workspace"路径
  rm -f "$PENDING"/*.json
  rm -rf "$NEW_WS"
  # stub SHA（abc）不应激活 → phase=orchestrating
  echo 'TASK_BASE: abc' > "$WS/task-1-brief.md"
  "$ACT" minimal conv-t2 "$PWD"
  # 探针：写"新 workspace"路径。orchestrating 下该路径属于 .superpowers/sdd/** → allow；
  #       若被劫持成 task_active，该路径非 active_ws → deny。这是唯一能区分的探针。
  printf '%s' "{\"session_id\":\"conv-t2\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$NEW_WS/progress.md\",\"content\":\"x\"}}" | "$GATE" | jq -r '.hookSpecificOutput.permissionDecision'   # 预期 allow（orchestrating，未被劫持）
  # 真实 SHA 应激活 → phase=task_active，active_ws=dogfood-test
  SHA=$(git rev-parse --short HEAD)
  echo "TASK_BASE: $SHA" > "$WS/task-1-brief.md"
  "$ACT" minimal conv-t2b "$PWD"
  printf '%s' "{\"session_id\":\"conv-t2b\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$NEW_WS/progress.md\",\"content\":\"x\"}}" | "$GATE" | jq -r '.hookSpecificOutput.permissionDecision'   # 预期 deny（task_active，NEW_WS 非 active_ws）
  rm -rf "$NEW_WS"
  rm -f "$WS/task-1-brief.md"   # 清理：避免真实 SHA brief 残留（T2~T6 期间劫持态）
  rm -f "$PENDING"/conv-t2.json "$PENDING"/conv-t2b.json
  ```

  预期：stub `abc` → 写 `t2-probe-ws` `allow`（phase=orchestrating，未被劫持）；真实 SHA → `deny`（task_active，probe 路径非 active_ws）。**注意**：repo 路径（如 `plugins/foo.txt`）在 orchestrating 下本就是 deny（非 `.superpowers/sdd/**`），不能用作劫持探针。

  > **环境鲁棒性**：若本 plan 经 SDD 执行，`sdd_find_active_workspace` 可能扫到本 plan 自身的活 workspace（真实 SHA + 无 APPROVED handoff）→ stub 探针的 allow 会被误判为 deny。若出现此情况，改用 `bind` 模式锚定探针 workspace：`"$ACT" bind conv-t2 "$PWD" "docs/x.md" "$NEW_WS"` 后再探针（`sdd_resolve_workspace` 钉住 active_ws，不受扫描结果干扰）。

- [ ] **Step 6: 提交**

  ```bash
  git add plugins/superpowers-overrides/bin/lib/sdd-orchestrator-gate.sh
  git commit -m "fix: prevent stale sdd workspace hijack via git-object check"
  ```

---

### Task 3: fixture 基础设施 + 改造现有两个 gate 测试

**Files:**
- Create: `plugins/superpowers-overrides/tests/fixtures/sdd-gate/`（场景根）
- Modify: `plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh`
- Modify: `plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh`

**Interfaces:**
- Consumes: T1, T2（fixture 依赖新 gate 行为）
- Produces: 隔离的测试 workspace；现有测试不再污染真实 `.superpowers/sdd/`

- [ ] **Step 1: 创建 fixture 场景根**

  **路径约束（实证）**：`.superpowers` 被根 `.gitignore`（第 4 行，无斜杠 → 匹配任意深度）忽略；fixture 目录若 `git init` 会变嵌套 git 仓库（`git add` 记成 gitlink，fresh clone 为空）。因此 fixture 模板**不用** `.superpowers/sdd/` 路径、**不做** `git init`——用普通目录 `sdd/` 存放，测试运行时把 `SDD_GATE_FIXTURES_ROOT` 指向副本并 `git init`（git-object 校验绑定**真实 repo** 的 repo_root，fixture 无需是 git 仓库）。

  ```
  tests/fixtures/sdd-gate/                      # 普通目录，全部被 git 跟踪
    orchestrating/sdd/orchestrating-ws/         # 空目录（无 brief → 不激活）
    active/sdd/active-ws/task-1-brief.md        # 内容: "TASK_BASE: <SHA>\n"
    complete/sdd/complete-ws/
      task-1-brief.md                           # 内容: "TASK_BASE: <SHA>\n"
      task-1-handoff.json                       # 内容: {"status":"APPROVED","phase":"implement","task":1,"commits":{"base":"<SHA>","head":"<SHA>"}}
    stub/sdd/stub-ws/task-1-brief.md            # 内容: "TASK_BASE: abc\n"
  ```

  创建命令（写 brief/handoff 文件，**不做 `git init`**）：

  ```bash
  cd plugins/superpowers-overrides/tests/fixtures/sdd-gate
  # orchestrating：空 workspace（无需文件）
  mkdir -p orchestrating/sdd/orchestrating-ws
  # active：TASK_BASE 占位符，无 handoff
  mkdir -p active/sdd/active-ws
  printf 'TASK_BASE: <SHA>\n' > active/sdd/active-ws/task-1-brief.md
  # complete：TASK_BASE + APPROVED handoff
  mkdir -p complete/sdd/complete-ws
  printf 'TASK_BASE: <SHA>\n' > complete/sdd/complete-ws/task-1-brief.md
  printf '%s\n' '{"status":"APPROVED","phase":"implement","task":1,"commits":{"base":"<SHA>","head":"<SHA>"}}' > complete/sdd/complete-ws/task-1-handoff.json
  # stub：TASK_BASE: abc（字面量，断言不激活）
  mkdir -p stub/sdd/stub-ws
  printf 'TASK_BASE: abc\n' > stub/sdd/stub-ws/task-1-brief.md
  ```

  > **确认**：`git status` 下这些文件应被跟踪（路径不含 `.superpowers`）。用 `git check-ignore` 验证无命中。

- [ ] **Step 2: gate lib 增加 `SDD_GATE_FIXTURES_ROOT` 覆盖**

  在 `sdd-orchestrator-gate.sh` 里，凡解析 `.superpowers/sdd` 的地方支持覆盖。`sdd_find_active_workspace` **签名改为接收 `sdd_root`**（替代 `repo_root` 内联拼接）：

  ```bash
  # sdd_find_active_workspace() — 签名: sdd_find_active_workspace "$sdd_root"
  sdd_find_active_workspace() {
    local sdd_root="$1" dir brief n handoff
    [[ -d "$sdd_root" ]] || return 1
    for dir in "$sdd_root"/*/; do
      ...
    done
  }
  ```

  **必须更新的调用点**（`grep -n "sdd_find_active_workspace"` 定位）：
  - `sdd_gate_decide`（T2 Step 4 加的单一解析点）→ `active_ws="$(sdd_find_active_workspace "$sdd_root" || true)"`
  - `sdd_write_allowed` / `sdd_plan_basename` 里的 `.superpowers/sdd` 引用 → 用 `$sdd_root`

  `sdd_root` 在 `sdd_gate_decide` 开头统一解析：
  ```bash
  local sdd_root="${SDD_GATE_FIXTURES_ROOT:-$repo_root/.superpowers/sdd}"
  ```

- [ ] **Step 3: 改造 `override-claude-sdd-gate.test.sh`**

  移除对 `dogfood-test` 的写入（当前第 9、18 行），改为从 fixture 复制到临时目录 + 注入真实 SHA：

  ```bash
  FIXTURES="$ROOT/tests/fixtures/sdd-gate"
  REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"
  TMPFIX=$(mktemp -d)
  trap 'rm -rf "$TMPFIX"' EXIT
  cp -R "$FIXTURES/active/." "$TMPFIX/"
  SHA=$(git -C "$REPO" rev-parse --short HEAD)
  sed -i '' "s/TASK_BASE: <SHA>/TASK_BASE: $SHA/" "$TMPFIX/sdd/active-ws/task-1-brief.md"
  # 副本需是 git 仓库（git-object 校验绑定 TMPFIX 作为 repo_root 时）
  git -C "$TMPFIX" init -q && git -C "$TMPFIX" add -A && git -C "$TMPFIX" commit -qm "fixture" 2>/dev/null
  export SDD_GATE_FIXTURES_ROOT="$TMPFIX/sdd"
  ```

  > **注意**：测试的 pending `repo_root` 必须指向 `$TMPFIX`（而非真实 repo），使 `git -C "$repo_root" cat-file -e "$SHA"` 在副本内可解析。用 `"$ACT" minimal conv-c1 "$TMPFIX"`。

  断言保持不变（claude 测 `hookSpecificOutput.permissionDecision`）。

- [ ] **Step 4: 改造 `override-cursor-sdd-gate.test.sh`**

  同样移除 dogfood-test 依赖。cursor 测试（当前第 12-31 行）改为：
  - `WS="$TMPFIX/sdd/active-ws"`（替代 `$REPO/.superpowers/sdd/dogfood-test`）
  - `"$ACT" minimal conv-g1 "$TMPFIX"`（repo_root 指向副本）
  - `"$ACT" bind conv-g1 "$TMPFIX" "dogfood-plan.md" "$WS"`（bind 到副本 active-ws）
  - TASK_ACTIVE 场景用 `active` fixture（brief 已含真实 SHA）
  - cursor 用 `conversation_id`、`tool_input.path`（保留）

- [ ] **Step 5: 验证 T3**

  ```bash
  cd /Users/kang/Projects/oscaner-skills
  bash plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh
  bash plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh
  ```

  预期：两个测试都输出 `OK — ...`。`git status` 确认 `.superpowers/sdd/` 无测试写入（stub 不再出现在真实树）；`git check-ignore` 确认 fixture 文件被跟踪。

- [ ] **Step 6: 提交**

  ```bash
  git add plugins/superpowers-overrides/tests/fixtures/ \
          plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh \
          plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh
  git status   # 确认 fixture 文件出现在 staged（无 gitlink 警告、无 .superpowers 忽略）
  git commit -m "test: isolate sdd gate fixtures from real workspace tree"
  ```

- [ ] **Step 5: 验证 T3**

  ```bash
  cd /Users/kang/Projects/oscaner-skills
  bash plugins/superpowers-overrides/tests/override-claude-sdd-gate.test.sh
  bash plugins/superpowers-overrides/tests/override-cursor-sdd-gate.test.sh
  ```

  预期：两个测试都输出 `OK — ...`。`git status` 确认 `.superpowers/sdd/` 无测试写入（stub 不再出现在真实树）。

- [ ] **Step 6: 提交**

  ```bash
  git add plugins/superpowers-overrides/tests/
  git commit -m "test: isolate sdd gate fixtures from real workspace tree"
  ```

---

### Task 4: 全矩阵 smoke 测试 + CI 挂载

**Files:**
- Create: `plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh`
- Modify: `scripts/ci-validate.sh`

**Interfaces:**
- Consumes: T1, T2, T3（smoke 依赖全部 gate 行为 + fixture）
- Produces: 完整 allow/deny 矩阵回归测试

- [ ] **Step 1: 创建 `sdd-gate-allow-deny-smoke.sh`**

  覆盖 spec §设计 判定矩阵的每一行，用 fixture 场景根 + `SDD_GATE_FIXTURES_ROOT`。脚本骨架：

  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  GATE="$ROOT/bin/override-claude-sdd-gate.sh"
  ACT="$ROOT/bin/sdd-session-activate.sh"
  FIXTURES="$ROOT/tests/fixtures/sdd-gate"
  REPO="$(git -C "$ROOT/../.." rev-parse --show-toplevel)"

  fail() { echo "FAIL: $1"; exit 1; }
  assert_allow() { ... }   # 断言 permissionDecision == allow
  assert_deny() { ... }    # 断言 permissionDecision == deny

  # 场景函数：复制 fixture 到临时目录，注入真实 SHA，设 SDD_GATE_FIXTURES_ROOT
  setup_scenario() { ... }

  # 矩阵断言（claude adapter JSON 形状）
  # 1. 只读 git allow（orchestrating/task_active）
  #    - `git status` / `git -C x status` / `git --git-dir=x status` / `git diff HEAD~1` → allow（AC1 边界用例）
  #    - `git -C x -c k=v status` → deny（AC1 v1 超范围）
  # 2. 变更类 git deny（`git add`/`git commit`/`git push`）
  # 3. stub-ws 不激活 / active-ws 激活
  # 4. bound-ws 不扫描无关 workspace
  # 5. deny 消息含多行矩阵 + git show
  # 6. task_complete 后 shell/Write allow

  echo "OK — sdd-gate-allow-deny-smoke"
  ```

  每个场景用 `setup_scenario <场景名>` 复制对应 fixture 根 + 注入 SHA + 设 env。矩阵断言对照 spec §设计 判定矩阵表。

- [ ] **Step 2: 在 `scripts/ci-validate.sh` 挂载 smoke**

  在现有 gate 测试之后（第 61 行 `override-claude-sdd-gate.test.sh` 后）追加：

  ```bash
  ./plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh
  ```

- [ ] **Step 3: 验证 T4**

  ```bash
  cd /Users/kang/Projects/oscaner-skills
  bash plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh
  ```

  预期：输出 `OK — sdd-gate-allow-deny-smoke`，无失败断言。

- [ ] **Step 4: 提交**

  ```bash
  git add plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh scripts/ci-validate.sh
  git commit -m "test: add sdd gate allow-deny matrix smoke test"
  ```

---

### Task 5: 文档同步

**Files:**
- Modify: `plugins/superpowers-overrides/docs/sdd-h6-reference.md`
- Modify: `plugins/superpowers-overrides/docs/cross-harness-overrides.md`
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`

**Interfaces:**
- Consumes: T1, T2（文档描述新 gate 行为）
- Produces: orchestrator 可查阅的完整 gate 矩阵；Rule 0a 清单同步

- [ ] **Step 1: `sdd-h6-reference.md` 新增 `## SDD gate matrix` 小节**

  在 `docs/sdd-h6-reference.md` 追加（内容对照 spec §设计 判定矩阵 + 安全属性）：
  - 完整 allow/deny 矩阵表（Write/Edit、Bash/Shell、其它工具）
  - Shell 契约：只读 git 诊断可用、变更走 H6/Write、heredoc 被拒
  - 防劫持说明：TASK_BASE 必须真实 git object（`git -C <repo> cat-file -e`）；bound-ws 优先
  - `SDD_GATE_FIXTURES_ROOT` 测试覆盖开关

- [ ] **Step 2: `cross-harness-overrides.md` 同步 gate 小节**

  在现有「SDD orchestrator gate (p1-slim.2)」小节后补：
  - 允许只读 git 诊断 Bash（白名单动词列表）
  - deny 消息为多行 allowlist 矩阵
  - 防劫持（git-object 校验 + bound-ws 优先）

- [ ] **Step 3: `spor-subagent-driven-development/SKILL.md` Rule 0a 补一行**

  在 Rule 0a item 4 的 Per-task 行后补一行说明（保持 ≤160 行，当前 94 行安全）：

  ```markdown
  **Shell 契约：** 只读 git 诊断（`git status`/`git diff`/`git log`/`git show`/`git rev-parse`/`git branch`/`git remote`/`git ls-files`/`git diff-tree`）可用；`TASK_BASE` 必须是真实 git SHA（gate 以 `git cat-file -e` 校验）。
  ```

- [ ] **Step 4: 验证 T5**

  ```bash
  cd /Users/kang/Projects/oscaner-skills
  bash plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh   # 确认 spor-SDD ≤160
  ```

- [ ] **Step 5: 提交**

  ```bash
  git add plugins/superpowers-overrides/docs/sdd-h6-reference.md \
          plugins/superpowers-overrides/docs/cross-harness-overrides.md \
          plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
  git commit -m "docs: document sdd gate allow-deny matrix"
  ```

---

### Task 6: 清理 dogfood-test + 全量 validate

**Files:**
- Delete: `.superpowers/sdd/dogfood-test/`（gitignored，无提交风险）
- Modify: `.superpowers/sdd/`（删除测试残留）

**Interfaces:**
- Consumes: T1–T5（全部改动就绪）
- Produces: 干净的 `.superpowers/sdd/` 树 + validate 全绿

- [ ] **Step 1: 删除 dogfood-test 及测试残留**

  ```bash
  rm -rf .superpowers/sdd/dogfood-test
  # 确认无其他 stub brief 残留
  find .superpowers/sdd -name 'task-*-brief.md' -exec grep -l '^TASK_BASE: abc' {} \;
  ```

  > 若其它旧 workspace 含真实 TASK_BASE（如已完成的 p1 系列），保留不动（它们有真实 SHA 或已完成，不劫持）。

- [ ] **Step 2: 全量 validate**

  ```bash
  cd /Users/kang/Projects/oscaner-skills
  pnpm run validate
  ```

  预期：`ALL PASS`。重点看 `override-claude-sdd-gate`、`override-cursor-sdd-gate`、新 smoke 三行通过。

- [ ] **Step 3: 更新 spec §Smoke results 表格**

  在 `docs/superpowers/specs/2026-08-07-sdd-gate-shell-consistency-design.md` 的 §Smoke results 填上实际 Pass 结果与日期。

- [ ] **Step 4: 提交（含 spec smoke 更新）**

  ```bash
  git add docs/superpowers/specs/2026-08-07-sdd-gate-shell-consistency-design.md
  git commit -m "docs: record sdd gate consistency smoke results"
  ```

---

## 收尾

- 全量 `pnpm run validate` 通过后，按仓库流程开 PR（目标分支 `develop`）。
- spec + plan + tickets 三个文档同 slug：`2026-08-07-sdd-gate-shell-consistency`。
