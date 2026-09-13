# P7 submodule-bump workflow 精简 — Implementation Plan

**Spec:** [2026-09-10-session-report-246-p7-design.md](docs/superpowers/specs/2026-09-10-session-report-246-p7-design.md)（v1.0）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根除 submodule-bump 的产物生命周期缺口——删除全部跟踪 issue 机制（F7，bump 唯一载体收敛为 PR）+ 新增陈旧 bump PR reconcile 闭环（F8，updated=false 关闭并删分支）+ 存量 #240/#241/#242/#117/#118 人工归档，open issue/PR 列表零自动杂音。

**Architecture:** 四层改动——① `.github/workflows/submodule-bump.yml` 重写：删 5 个 issue 步骤（find-issue / write-issue-body / create-issue / issue-number / comment-on-tracking-issue）+ cpr 修改（body 去 `Tracking Issue:` 行、增 `delete-branch: true`）+ 新增 reconcile 步（`updated == 'false'` 门控，github-script，owner-ref head 防 dependabot 误关，comment→close→deleteRef）；② `.github/workflows/submodule-sync.yml` 权限收缩（去 `issues: write`）；③ `docs/maintainers/osuperpowers-plugin.md` §Automated submodule sync 文档同步（删 Issue Action chain 表述 / `submodule:<name>` bootstrap / v1 迁移注记）；④ 存量归档（closeout——overall v1.19 回填——由 finishing 在 branch-review 后经 F13 检查点执行，不在本 plan task 内）。detect 契约与 `scripts/run.mjs bump-submodule` 零改动。

**Tech Stack:** GitHub Actions YAML（`peter-evans/create-pull-request@v8` + `actions/github-script@v9`）+ `gh` CLI（存量归档）+ maintainer markdown。**无 npm package 变更 → 无 changeset、无 `pnpm run emit`**。

## Global Constraints

- `.github/workflows/` 不在 `pnpm run validate` 13 块覆盖内——**YAML 畸形不得静默通过**，每 task 必须做 YAML parse（`node -e` js-yaml 不可用时用 `ruby -e 'require "yaml"; YAML.load_file(...)'` 或 Python yaml；均失败则至少作 `git diff` 人工审 + 结构 grep）。
- `bump-submodule` detect 契约（`updated / new_tag / old_label`）**零改动**；`scripts/run.mjs` / `scripts/release/bump-submodule.mjs` 不 touch。
- vendored 子模块不可改；`workflow_call` 接口（`submodule-sync.yml` matrix）不变。
- **无 changeset**：纯 `.github/workflows/` + `docs/maintainers/` 变更，无 npm package 版本影响；maintainer 文档非发布面、不受 emit 覆盖。
- 存量归档破坏性操作已获用户授权（`gh issue close` / `gh pr close` / `gh api -X DELETE git/refs`）；操作前先 `gh view` 复核 state，关闭理由回填 finding 决策。
- reconcile 的 head 必须 owner-ref 形式（`<owner>:chore/bump-<name>`）——裸 branch 形式实测会把 dependabot PR 纳入匹配集（4 vs 1，spec §2.6 实证），禁止回归。
- 每 task 结束 `pnpm run validate` 全绿 + conventional commit，无 attribution trailer；vim/编辑器不介入，全程工具写盘。

---

### Task 1: `submodule-bump.yml` 重写 — 删 issue 机制 + cpr 修改 + reconcile 新增

<thinking>原子单元：整个 submodule-bump.yml 一次改写（删 5 步 + cpr body/delete-branch + reconcile 新步 + 权限行）。拆小只会制造中间态 YAML（步骤 id 引用悬空）。</thinking>

**Files:**
- Modify: `.github/workflows/submodule-bump.yml`（全文件重写）

**Interfaces:**
- Consumes: `scripts/run.mjs bump-submodule <name> --dry-run` 输出契约（`updated/new_tag/old_label`）；`inputs.submodule`（workflow_call）
- Produces: 目标文件 = 下述完整 YAML（cpr 产物 PR 于 `chore/bump-<name>` 分支、label `submodule-bump`+`automated`；reconcile 步关闭陈旧 PR + 删分支）

- [ ] **Step 1: 将 `.github/workflows/submodule-bump.yml` 整文件替换为：**

```yaml
name: Submodule Bump

on:
  workflow_call:
    inputs:
      submodule:
        required: true
        type: string

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          submodules: recursive
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - id: detect
        run: |
          json=$(node scripts/run.mjs bump-submodule "${{ inputs.submodule }}" --dry-run)
          echo "$json" | node -e "
            const j = JSON.parse(require('fs').readFileSync(0, 'utf8'));
            const fs = require('fs');
            const o = (k, v) => fs.appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + String(v) + '\n');
            o('updated', j.updated === true);
            o('new_tag', j.newTag ?? '');
            o('old_label', j.oldTag ?? j.oldPinSha ?? '');
          "

      - name: Apply bump
        if: steps.detect.outputs.updated == 'true'
        run: node scripts/run.mjs bump-submodule "${{ inputs.submodule }}"

      - id: pr-body
        if: steps.detect.outputs.updated == 'true'
        run: |
          if [ "${{ inputs.submodule }}" = "mattpocock-skills" ]; then
            {
              echo 'rollback_note<<EOF'
              echo "> **Note:** Pin was not aligned to latest release tag; this PR syncs to \`${{ steps.detect.outputs.new_tag }}\`."
              echo EOF
            } >> "$GITHUB_OUTPUT"
          else
            echo "rollback_note=" >> "$GITHUB_OUTPUT"
          fi

      - id: cpr
        if: steps.detect.outputs.updated == 'true'
        uses: peter-evans/create-pull-request@v8
        with:
          branch: chore/bump-${{ inputs.submodule }}
          base: develop
          title: "chore: bump ${{ inputs.submodule }} submodule"
          commit-message: "chore: bump ${{ inputs.submodule }} submodule"
          labels: |
            submodule-bump
            automated
          delete-branch: true
          body: |
            Automated tag sync.
            ${{ steps.pr-body.outputs.rollback_note }}

      - name: Reconcile stale bump PRs
        if: steps.detect.outputs.updated == 'false'
        uses: actions/github-script@v9
        with:
          script: |
            const branch = `chore/bump-${{ inputs.submodule }}`;
            const head = `${context.repo.owner}:${branch}`;
            const { data: pulls } = await github.rest.pulls.list({
              ...context.repo,
              state: 'open',
              base: 'develop',
              head,
            });
            for (const pr of pulls) {
              await github.rest.issues.createComment({
                ...context.repo,
                issue_number: pr.number,
                body: `Auto-reconcile: \`${{ inputs.submodule }}\` is already up to date — closing superseded bump PR.`,
              });
              await github.rest.pulls.update({
                ...context.repo,
                pull_number: pr.number,
                state: 'closed',
              });
            }
            try {
              await github.rest.git.deleteRef({ ...context.repo, ref: `heads/${branch}` });
            } catch (e) {
              if (![404, 422].includes(e.status)) throw e;
              core.info(`reconcile: branch ${branch} delete skipped (${e.message})`);
            }
```

- [ ] **Step 2: YAML parse + 结构断言**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/submodule-bump.yml','utf8');['find-issue','write-issue-body','create-issue','issue-number','comment-on-tracking-issue','Tracking Issue','issues: write'].forEach(k=>{if(s.includes(k))throw new Error('must-not-contain: '+k)});['context.repo.owner','updated == \'false\'','delete-branch: true','peter-evans/create-pull-request@v8','actions/github-script@v9'].forEach(k=>{if(!s.includes(k))throw new Error('must-contain: '+k)});console.log('grep assertions OK');"
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/submodule-bump.yml'); puts 'YAML OK'" 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/submodule-bump.yml')); print('YAML OK')"
```
Expected: `grep assertions OK` + `YAML OK`（两行都通过；YAML 解析至少一种运行时可用）。

- [ ] **Step 3: 人工 diff 复核**（`git diff`）：确认删除的 5 步无残留引用；detect / Apply bump / pr-body 原样；reconcile head 为 owner-ref。

- [ ] **Step 4: 全量 validate + commit**

Run: `pnpm run validate` → Expected: `ALL PASS`（13 块）。
```bash
git add .github/workflows/submodule-bump.yml
git commit -m "ci: submodule-bump workflow 精简 — drop tracking-issue machinery, add stale bump PR reconcile + cpr delete-branch"
```

---

### Task 2: `submodule-sync.yml` 权限收缩 + maintainer 文档同步

**Files:**
- Modify: `.github/workflows/submodule-sync.yml`（去 `issues: write`）
- Modify: `docs/maintainers/osuperpowers-plugin.md`（L57 §Automated submodule sync 首段 + label bootstrap 段 + v1 迁移注记）

**Interfaces:**
- Consumes: Task 1 的权限口径（`issues: write` 已从 bump.yml 移除，本 task 补齐 sync.yml）
- Produces: 无新接口；maintainer 文档与 workflow 实际行为一致（消费方核对）

- [ ] **Step 1: `submodule-sync.yml` — 删 `issues: write` 行**

permissions 块从：
```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
```
改为：
```yaml
permissions:
  contents: write
  pull-requests: write
```

- [ ] **Step 2: `docs/maintainers/osuperpowers-plugin.md` §Automated submodule sync 三处同步**

① 首段（L57）：
`per submodule (\`create-pull-request\` + Issue Action chain; no bash glue)` → `per submodule (\`create-pull-request\` \`chore/bump-<name>\` branch PR; no bash glue)`

② 一次性 label bootstrap 段（L59-66）：**只保留** `submodule-bump` 行，**删除** `submodule:mattpocock-skills` / `submodule:superpowers` / `submodule:impeccable` 三行：
```bash
gh label create submodule-bump --color EDEDED --description "Automated submodule sync tracking"
```

③ v1 迁移注记（L68）整句删除：
`If migrating from v1 tracking Issues, add \`submodule-bump\` + \`submodule:<name>\` to existing open Issues to avoid duplicates.`

- [ ] **Step 3: YAML parse + grep 断言**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/submodule-sync.yml','utf8');['issues: write'].forEach(k=>{if(s.includes(k))throw new Error('must-not-contain: '+k)});console.log('sync.yml grep OK');"
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/submodule-sync.yml'); puts 'YAML OK'" 2>/dev/null || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/submodule-sync.yml')); print('YAML OK')"
node -e "const fs=require('fs');const s=fs.readFileSync('docs/maintainers/osuperpowers-plugin.md','utf8');const bad=['Issue Action chain','submodule:mattpocock-skills','submodule:superpowers','submodule:impeccable','migrating from v1 tracking Issues'].filter(k=>s.includes(k));if(bad.length)throw new Error('must-not-contain: '+bad.join(','));console.log('maintainer grep assertions OK');"
```
（nits：`grep -c` 在 0 匹配时（即断言通过态）退出码为 1，弃用；改 node 断言——通过时恒 exit 0。）
Expected: `sync.yml grep OK` + `YAML OK`（± 1 种解析器）+ `maintainer grep assertions OK`。

- [ ] **Step 4: 全量 validate + commit**

Run: `pnpm run validate` → Expected: `ALL PASS`。
```bash
git add .github/workflows/submodule-sync.yml docs/maintainers/osuperpowers-plugin.md
git commit -m "ci: trim submodule-sync issues permission + sync maintainer doc (drop Issue Action chain / submodule labels / v1 migration note)"
```

---

### Task 3: 存量归档 + 归档证据断言 + no-changeset 复核

<thinking>本 task 为纯 GitHub 运维（无本地文件改动）：close 5 条 + 删 2 分支。closeout（overall v1.19 回填 Phase inventory plan 列 + change-history，须含 branch-review 实际结果）不在本 plan 内——由 finishing（branch-review 之后，P4 F13 强制检查点）执行，禁止占位/预估结果（plan-review warn）。CDD commit-contract：本 task 无本地改动，tree clean + commits.head==HEAD 即通过，无需也不许伪造 commit。</thinking>

**Files:**
- None（全部操作为 GitHub 远端状态；本 task 不产生本地 commit）

**Interfaces:**
- Consumes: Task 1/2 的 workflow 落地（归档语义与 reconcile 一致）；user 已授权的破坏性操作（gh close / deleteRef）
- Produces: GitHub 侧 5 条目 CLOSED + `chore/bump-impeccable` / `chore/bump-mattpocock-skills` 分支删除；无本地产物（closeout 交 finishing）

- [ ] **Step 1: 存量五项归档（复核先行 + 失败显式报错）**

```bash
for n in 240 241 242; do
  s=$(gh issue view $n --json state --jq .state)
  if [ "$s" = "OPEN" ]; then
    gh issue close $n --comment "P7 (F7): tracking-issue lifecycle removed — bump tracking vehicle is now the PR itself. Closed by submodule-bump workflow 精简." || echo "CLOSE FAILED #$n"
  else
    echo "skip #$n state=$s"
  fi
done
for n in 117 118; do
  s=$(gh pr view $n --json state --jq .state)
  if [ "$s" = "OPEN" ]; then
    gh pr close $n --comment "P7 (F8): stale bump superseded — reconcile (updated=false) closes unmerged bump PR + deletes branch. Closed by submodule-bump workflow 精简." || echo "CLOSE FAILED #$n"
  else
    echo "skip #$n state=$s"
  fi
done
for b in chore/bump-impeccable chore/bump-mattpocock-skills; do
  resp=$(gh api -X DELETE "/repos/Oscaner/skills/git/refs/heads/$b" 2>&1); rc=$?
  if [ $rc -eq 0 ]; then echo "branch $b deleted"
  elif echo "$resp" | grep -qi "not found"; then echo "branch $b already gone"
  else echo "DELETE FAILED $b: $resp"
  fi
done
```
（plan-review nit：state 判断与命令退出码分离——close 失败显式 `CLOSE FAILED`，DELETE 仅 404（Not Found）归 "already gone"、其余显式报错，杜绝静默（spec §2.6 故障报修不静默）。）

- [ ] **Step 2: 归档证据断言**

```bash
for n in 240 241 242 117 118; do echo "#$n: $(gh issue view $n --json state --jq .state 2>/dev/null || gh pr view $n --json state --jq .state)"; done
git ls-remote --heads origin chore/bump-impeccable chore/bump-mattpocock-skills
```
Expected: 五条全 `CLOSED`；`git ls-remote` **无输出**（两类分支不存于远端）。

- [ ] **Step 3: 无 changeset 复核**

Run: `ls .changeset/ | grep -i p7 || echo "no-changeset-ok"` → Expected: `no-changeset-ok`。
（本 phase 纯 `.github/workflows/` + `docs/maintainers/` 变更，无 npm package 影响，正确无 changeset；`grep` 0 匹配退出码 1 用 `||` 收敛——plan-review nit：通过态不得报失败。）

- [ ] **Step 4: 全量 validate（不 commit）**

Run: `pnpm run validate` → Expected: `ALL PASS`（13 块）。
本 task 无本地文件改动，**不产生本地 commit**（commit-contract：tree clean + commits.head==HEAD 即通过；整体 closeout 由 finishing 经 F13 检查点执行）。

---

**计划自评（write-plan self-review）：**
1. **Spec coverage**：spec §2.2（bump.yml 重写）→ Task 1；§2.3（sync 权限）→ Task 2 Step 1；§2.4（reconcile 语义 + owner-ref + catch 收窄）→ Task 1 YAML；新增文档同步（findings Warn-1）→ Task 2 Step 2；§2.5（存量归档）→ Task 3 Step 1；§2.7 acceptance（grep/YAML parse/归档断言）→ 各 Task 验证步；§3 v1.18 同步已随 commit-spec 完成，v1.19 closeout（含 branch-review 结果）由 finishing F13 检查点执行，本 plan 不含（spec §4 同口径）。
2. **Placeholder scan**：无 TBD/TODO；reconcile YAML 为完整可复制目标文件；closeout 无占位/预估结果（明确延迟至 finishing）。
3. **Type consistency**：`updated === true` / `updated == 'false'` 门控字面与 engine bump-submodule 输出布尔一致（detect 步 `o('updated', j.updated === true)` 产 `"true"/"false"` 字符串）；`branch` / `head` / `bump-<submodule>` 三处命名一致；plan-review 3 findings（warn closeout 时序 + 2 nit 退出码语义）全量 fix-inline 于本修订。