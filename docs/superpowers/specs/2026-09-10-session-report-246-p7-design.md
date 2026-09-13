# P7 — submodule-bump workflow 精简：删跟踪 issue 机制 + 陈旧 bump PR reconcile + 存量归档

- **Version**: v1.0 · 2026-09-13
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-10-session-report-246-overall.md](./2026-09-10-session-report-246-overall.md) · v1.17
- **Depends on**: 无（七 phase 独立）；作用于 `.github/workflows/submodule-bump.yml` + `submodule-sync.yml`；`scripts/run.mjs bump-submodule` detect 契约作为只读消费方（零改动）

---

## Section 0: Incremental warning

> P7 increment only。跨 phase 约定见 [overall](./2026-09-10-session-report-246-overall.md)；冲突以 overall 为准。

---

## Section 1: Constraints pointer

不重复 overall 约定。约束继承：仓库语言政策（SKILL.md / 代码英文主源，本 spec 中文 Strategy B）；vendored 子模块不可改；不 commit 除非用户明确要求；changeset 逐 phase 建（**本 phase 无 package 改动 → 无 changeset**）；所有改动过 `pnpm run validate`。

---

## Section 2: Design body

### 2.1 根因与决策链

两 finding 同源一类：**bump workflow 的产物生命周期缺回收闭环**。

| Finding | 现象（实测） | 根因 |
|---|---|---|
| F7 | `submodule-sync` 每周检测 bump 时为每个 submodule 创建跟踪 issue（#240/#241/#242，2026-09-07 创建后 0 评论永久 OPEN）| 跟踪 issue 生命周期**无任何 close 触发**——bump PR 合并不关闭 issue；issue 是 bump 的「额外跟踪载体」而非必要 |
| F8 | 陈旧 bump PR 悬空（#117 impeccable / #118 mattpocock-skills，2026-08-17 OPEN 未合并未关闭）| 只 create/update 不回收——cpr 按 branch 复用更新，但失效 bump 无关闭路径 |

**决策（grilling Q1/Q2/Q2b，用户「ok」拍板）**：

1. **F7 —— 删除全部跟踪 issue 机制**：bump 唯一跟踪载体收敛为 **PR 本身**。（结构性事实：issue 载体无 close 生命周期，保留任何 issue 步骤都会复现 #240 式堆积。）
2. **F8 —— 陈旧 PR reconcile**：`updated == 'false'`（无需 bump）时关闭该 submodule 的 open bump PR 并删除其分支。
3. **存量归档**：#240/#241/#242（issue）+ #117/#118（PR 含分支）人工关闭。

**关键事实（grilling 核实后收敛设计口径）**：`peter-evans/create-pull-request@v8` **无 `force` input**，且官方 common-issues 明示「rebase the PR branch and force push it」——即 `updated=true` 路径**已内建**「rebuild 到当前 base + force-push 复用同分支」语义，F8 字面「force-push 复用既有分支」由 cpr 原生覆盖，**不新增独立步**。`updated=false` 时 cpr 步被门控跳过 → 陈旧 PR 无人关闭，**此即真正缺口**。故 reconcile 门控 `updated == 'false'` 是充分最小增量（updated=true 侧零新增逻辑，含冲突场景，见 §2.4 语义要点 4）。

### 2.2 `.github/workflows/submodule-bump.yml` 重写

最终步骤序列：

| # | 步骤 | 动作 |
|---|---|---|
| 1–4 | checkout / pnpm setup / setup-node / install | **保持** |
| 5 | `detect` | **保持**（`bump-submodule <name> --dry-run` → `updated / new_tag / old_label`，detect 契约零改动） |
| 6 | `Apply bump`（`updated=='true'`） | **保持** |
| 7 | `pr-body`（`updated=='true'`） | **保持**（mattpocock-skills rollback_note 专用行） |
| 8 | `cpr`（`updated=='true'`） | **修改**：body **删除 `Tracking Issue: #…` 行**（issue-number 步删除后不再有值）；增 `delete-branch: true`（PR 合并后自动删分支，与 reconcile 零残留语义联动） |
| 9 | **`reconcile`（新，`updated=='false'`）** | **新增**，见 §2.4 |

**删除步骤（共 5 步）**：`find-issue`（github-script 查 open issue）· `write-issue-body`（mkdir + 落 body 文件）· `create-issue`（create-issue-from-file）· `issue-number`（选 found/created）· `comment-on-tracking-issue`（create-or-update-comment）。

**权限**：`issues: write` **移除**。留存 `contents: write` + `pull-requests: write`（cpr 建 PR / reconcile comment + close PR 属 pull-requests write 域；`git deleteRef` 属 contents write 域）。

**残留物**：`.github/issue-bodies/` 为 `write-issue-body` 步骤运行时产物（非入库，已核实 `git ls-files` 为空）——删步骤即消失，无 git 清理动作。

**文档同步（maintainer，findings Warn-1）**：`docs/maintainers/osuperpowers-plugin.md` §Automated submodule sync 段落随删 issue 机制同步——① 段首「`create-pull-request` + Issue Action chain; no bash glue」删除「Issue Action chain」表述（cpr 即全部 PR 机制）；② 一次性 label bootstrap 保留 `submodule-bump`（cpr 仍用作 PR 标签）而移除 `submodule:<name>` 三行；③ v1 跟踪 issue 迁移注记删除。该文件为 maintainer-only（非发布面），不受 emit 覆盖。

### 2.3 `.github/workflows/submodule-sync.yml`

- `issues: write` **移除**（该 workflow 仅委托 bump workflow，无自有 issue 步骤；留存 `contents: write` + `pull-requests: write`）。
- matrix / `workflow_call` 接口零改动。

### 2.4 Reconcile 步设计（F8）

```yaml
- name: Reconcile stale bump PRs
  if: steps.detect.outputs.updated == 'false'
  uses: actions/github-script@v9
  with:
    script: |
      const branch = `chore/bump-${{ inputs.submodule }}`;
      // owner-ref 形式：裸 branch 形式实测解析歧义（head=chore/bump-impeccable → 误命中
      // dependabot PR，4 vs 1），必须显式 `owner:ref` 防误关无关开放 PR（§2.6 实证记录）
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
        // idempotent: 仅对「branch 已删除 / ref 不存在」预期态静默（404 / 422）；
        // 其余（403 权限 / API 瞬时失败）rethrow，保持可观测（§2.6 故障报修不静默）
        if (![404, 422].includes(e.status)) throw e;
        core.info(`reconcile: branch ${branch} delete skipped (${e.message})`);
      }
```

**语义要点**：

1. **触发**：`updated == 'false'`（无需 bump → 该 submodule 的 open bump PR 必已失效——pinned == 已最新，任何残留 PR 提议的都是陈旧/降级 bump）。`updated == 'true'` 侧由 cpr 内建无独立逻辑。
2. **匹配**：`base: develop` + `head: <owner>:chore/bump-<submodule>` + `state: open`。branch 名确定性匹配（自动产物专用分支，无人为 PR 误伤）；**owner-ref 形式必须**（§2.6 实证：裸 form 会连带 dependabot PR）。
3. **动作**：comment（审计痕迹）→ close → deleteRef（幂等 try/catch）。顺序纪律：先 close PR 再删 ref，不对 open PR 的 head 分支删 ref。
4. **冲突场景免逻辑**：cpr 机构 =「当前 base 之上重建 + force-push」→ push 侧永不冲突；PR 可见 conflict 窗口由下次 live run force-rebuild 自愈；reconcile 关闭的恰是已无谓的（含 conflicted）陈旧 PR。加 `mergeable_state` 分支 = YAGNI 违例。

### 2.5 存量归档（dev 期执行，破坏性授权已获）

| 条目 | 类型 | 现状 | 动作 |
|---|---|---|---|
| #240 | issue | OPEN（impeccable 跟踪） | close + 理由回填 |
| #241 | issue | OPEN（mattpocock-skills 跟踪） | close + 理由回填 |
| #242 | issue | OPEN（superpowers 跟踪） | close + 理由回填 |
| #117 | PR | OPEN（impeccable bump） | close + 删除分支 `chore/bump-impeccable` |
| #118 | PR | OPEN（mattpocock-skills bump） | close + 删除分支 `chore/bump-mattpocock-skills` |
| #103 | PR | CLOSED（未合并，方向不明） | 仅参考，无动作 |

关闭理由均为对应 finding 决策（F7：跟踪载体移除，bump 跟踪=PR 自身；F8：陈旧 bump 被 supersede，reconcile 语义人工先行）。

### 2.6 验证与实证记录

- **reconcile head 形式实证**（2026-09-13，`gh api /repos/Oscaner/skills/pulls?state=open&base=develop`）：
  - `head=chore/bump-impeccable`（裸 branch）→ **4 条**（含 dependabot PR #238/#239 与双 bump PR #117/#118）——解析歧义，**禁止使用**；
  - `head=Oscaner:chore/bump-impeccable`（owner-ref）→ **1 条**（恰 #117）——reconcile 采用形式。
  - 该实证入 acceptance（防止回归裸 form）。
- workflow YAML 语法 + GitHub 结构消费方合法（workflow_call / permissions / `if:` 门控）：`node` YAML parse（或 GitHub 侧解析）通过；`.github/workflows/` 语义 grep 断言见 acceptance。
- `pnpm run validate` 13 块全绿（workflow 变更不涉 validate 面，基线保持）。
- 生产实证：merge 后每周 cron（或 `workflow_dispatch`）首次运行即为 reconcile 实测；若 comment 步遇权限 403（理论不应——PR comment 属 pull-requests write 域），reconcile 的 close + deleteRef 仍须正确执行，故障报修不静默。

### 2.7 acceptance criteria

- `submodule-bump.yml` 无 `find-issue` / `write-issue-body` / `create-issue` / `issue-number` / `comment-on-tracking-issue` 步骤；PR body 无 `Tracking Issue:` 行（grep 断言）。
- `submodule-bump.yml` + `submodule-sync.yml` 均无 `issues: write`。
- `reconcile` 步存在、门控 `updated == 'false'`、head 使用 owner-ref 形式（grep 断言含 `context.repo.owner`）；`submodule-bump.yml` + `submodule-sync.yml` YAML parse 通过（node yaml 或 GitHub 侧解析）+ 门控/步骤结构断言（§2.6 对齐——`.github/workflows/` 不在 validate 13 块覆盖内，YAML 畸形不得静默通过）。
- `docs/maintainers/osuperpowers-plugin.md` §Automated submodule sync 无「Issue Action chain」表述、无 `submodule:<name>` bootstrap 行、无 v1 迁移注记（grep 断言）。
- `cpr` 步含 `delete-branch: true`；其余原步骤（checkout/install/detect/apply/pr-body）原样保留。
- #240 / #241 / #242（issue）与 #117 / #118（PR）状态均为 CLOSED；分支 `chore/bump-impeccable` / `chore/bump-mattpocock-skills` 已删除（远端不存在，`git ls-remote` 断言）。
- `scripts/run.mjs` / `scripts/release/bump-submodule.mjs` / vendored 子模块零改动。
- `pnpm run validate` 13 块全绿。

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P7 scope「updated=true → force-push 复用既有分支」 | 落实为 **cpr 内建 rebase+force-push**（官方 common-issues 实证，无 `force` input、无独立步）；reconcile 仅门控 `updated=false`（**删步骤为 5 步**——overall 字面列举 4 步缺 `write-issue-body`；**cpr 增 `delete-branch: true`** 合并后自动删分支，零残留联动） | Yes — 随 commit-spec 同步 overall v1.18（P7 scope 行措辞精化：`force-push 复用` → `cpr 内建 rebuild 复用`；reconcile 增「close + 删分支」零残留语义；**删步骤 5 步 + `delete-branch: true` 计入同步口径**） |
| P7 scope「存量 #240/#241/#242 与 #117/#118 人工关闭存档」 | 关闭含对应 bump 分支删除（reconcile 语义人工先行，与 Q2b 决策 A 一致） | 并入上条 v1.18 |

---

## Section 4: Notes for downstream

- **无 changeset**：纯 `.github/workflows/` + `docs/maintainers/osuperpowers-plugin.md` 变更，无任何 npm package 版本影响；maintainer 文档不受 emit 覆盖 → **不运行 `pnpm run emit`**。
- **无 lint/格式面**：workflow 变更不触 SKILL.md / docs→emit 链。
- 后续 phase（P3 fix-mode 决策）独立不受影响。
- 消费方视角：submodule-bump 是 CI 内构，非发布面；consumer 无感知。
- merge 后的主观验收：下一周 submodule-sync cron 运行实证 reconcile（open PR 列表无陈旧 bump、无新跟踪 issue）；此期间若新增误报，走 report-issue 通道。

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and writing-plans。