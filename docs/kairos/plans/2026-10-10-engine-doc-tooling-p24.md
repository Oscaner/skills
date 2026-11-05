---
title: 引擎文档工具（Engine Doc-Tooling）— P24 计划：NEXT-LOOP 收口面（基线随轮推进 + hop 原因可读）
doc-type: plan
version: v0.27
date: 2026-11-05
slug: 2026-10-10-engine-doc-tooling-p24
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p24-design.md` **现行 `version`**（**v0.32**）所指的面；面与裁决以现行 spec 与 handoff 裁定为准，需要改动即回评审，不在计划里顺手扩面。本周这次对齐不是排版：v0.22 把 §11 的定案加深为「渲染板面那个 `NextHop`」并把 cell 装配一并搬进 session 平面，v0.25 按名拆开 **pipeline frontier** / **line frontier**，v0.26 重写了 doc 线的验收面——Task 7 据此重写（见其 Objective 与 Steps 1-9），照 v0.21 读到的浅版 Task 7（只换 route）会漏掉装配搬迁。**spec v0.31 / v0.32 重写了 §12 的汇总单元**（成功数为 0 的豁免 · 令牌顺序 · 恢复形带 `+N` · 陈旧散文登记）——Task 8 据此整体重写；只同步锁号而不同笔改正文，正是上一版 Task 8 落后一版的根因。
- **单点判据**：drift 的「记了什么 identity」只有一个写入点（`Ledger#recordReviewedRevision`，wave 经 `recordReviewedBrief`），读取面按既有事实分两条（doc/branch 走 `docReopens`、wave 走 `waveLineRoute` 的 D30 腿）。不得为任何一面新开第二个 drift 判定或第二个写入点。
- **只推进完成的轮**：`targetAction` 为假的轮（BLOCKED / TIMEOUT）一律不推进基线；读不到输入（文档 / plan 不可读）时什么都不记录，保留旧基线。
- **`next:` 字节零变**：`next:` 行仍是可执行字面，整行抄进 shell 必须能跑。诊断信息只落**另一行**（`reason:`）。字面上不得出现 `—`/`#`/任何后缀。
- **重锚在册**：`next:` 断言 152 处中 137 处零改动（按行抽取 / `toContain`），15 处整块 `toEqual` 快照逐条重锚（每处新增一个 `reason:` 元素；逐处行号见 Task 2 Step 7），另有 1 处站表长度 pin 由 4 改 5；总数 16，一条不许漏、一条不许顺带。**本账只覆盖 `next:` 字节**：§12 对 `board-view.test.ts:1274` 的重锚（`fix 1 ✗ · fix 1a2 ✓` → `fix 1/2 ✓ · fix 1 ✗→✓`）与其新增实况用例是**账外修复**（板面汇总单元不是 `next:` 行，spec §12 证据第 5 条在册），**不计入**这 16，也不得从这 16 里腾位。
- **陈旧散文在册**：凡声称 `next:` / `reason:` 行形状的注释与用例标题（spec §7 第 5 类列出的 14 处，含 `face/capsule.ts:2` · `:7-10` · `face/words.ts:7-8` 三处文件自述散文）同笔改写；它们不承载断言。三处自述是输出形状的权威陈述，改写留在 `face/capsule.ts:1-12` 与 `face/words.ts:1-12` 的既有散文内，架构图 `face` 节点的取证跨度不脱钩。扫描词面取「末行 / `LAST` / `close` / `last line` / `trailing` / 唯一站锚 / 唯一站词」——只凭「九处」不足以免漏。
- **前缀各有其家**：胶囊取站表 `words.station("reason")`；板面取布局字面 `  reason:  `（与它自己的 `  next:    ` 同形）。不得为「统一」给板面的 static 加 `Words` 参数。
- **预览的策略副本是显式债务**：`face/preview.ts#recordsOf` 与 `#bookkeep` **无法共用同一处判别**——`#bookkeep` 有 verdict 门（`record.verdict.targetAction`），`#recordsOf` 是无 verdict 的 dry run；故 phase 白名单 `review | branch-review | fix` **各存一份**。`preview.test.ts` 的 fix 轮用例只钉住**预览侧当前行为**（行为 pin），**不是**漂移探针：任一侧日后单独改动，该用例都不必红。**不得**再声称「复制成第二份就红」——这是已知双写及其守卫边界，Task 1 Acceptance 在册。
- **wave 面禁分叉**：装配（Task 7 之后归会话平面、与 `PipelineFrontier.next` 并列；今日在 `BoardNext#hopOf`）只发**一次** `nextHopOf` 调用，六格里 `briefDrift` / `nextLineOpen` 都只是该输入对象上的条件值（前者 wave 面按 target 注入，后者由装配自己从账本 + `planPath` 取，**判据只此一份**）；**不需要 `active !== null` 之类的闸**——因为 `nextHopOf` 把两个值分开（Task 3 Step 4）：替换驱动仍只取 doc 面 `reviewGate`，wave 的 exit 侧路由不会被改写；禁止为 wave 另开第二个调用。`Lifecycle#hopOf`（line frontier）保留自己的注入，与装配共用同一份第六格判据。
- **两个 frontier 不许混称，胶囊不承诺「与 `peekNext` 同值」**：**pipeline frontier** 指 `PipelineFrontier.next(...)` 装出的产物——胶囊（§11 之后）与板面**共用**它；**line frontier** 指 `Lifecycle#peekNext`（`session/run.ts:400-408`），仍从被派发的 frame 与本线 C5 路由装配，是单线视角。`#bookkeep` 的 brief 重绑发生在 `advance` 之前（`:429-430`），故「帧上 drift 恒为假」只描述那条 frame-keyed 的 line frontier 装配（`advance` 那一跳对 `briefDrift` 注入是死代码，`peekNext` 那一跳才是活判据），**不是**胶囊的输出事实——胶囊渲 pipeline frontier 的 hop，故在 wave 面与板面同值。**任何任务不得**为了让两面「更一致」去改 `#routeNext` 或加第二套路由；也不得把 capsule ⇄ `peekNext` 写成等式（两个不同对象，同值只是夹具级期望）。
- **零状态迁移**：`progress.json` 的任何键名 / 键集不变；`recordReviewedRevision` 只改文档注释。
- **调用与提交纪律**：引擎一律本地 `node packages/cdd-engine/src-next/bin.ts`；每任务提交过 `pnpm run precommit`；末任务跑 `env -u AI_AGENT pnpm run validate`（`AI_AGENT` 在场会让 5 条既有注入派发 E2E 误红）；changeset `@oscaner-skills/cdd-engine` **minor**（D74），不涉 kairos 包、不发布。
- **行号与计数以落地时的树为准**：本计划里的每一条 `文件:行` 与每一个计数（夹具数、grep 命中数、断言数）都是评审时那一棵树的快照；实施时先重查，对不上就改计划回填，**不得照抄**。引用一个符号时优先同时给出可搜索的上下文（如 `:741` 的 `planPath: scene.planPath`），而不是只给一个行号。
- **spec 版本与范围锁同笔**：spec 的 `version` 一变，本约束的版本字面同笔改（本轮起，避免「改完 spec 不改锁」）。
- **已知限制：四份 diagram 源（`next-loop.{en,zh-CN}` / `journey.{en,zh-CN}`）上的新措辞没有任何常驻 pin，源↔HTML 也没有常驻孪生门**：`face/__tests__/diagrams.guard.test.ts` 的 `SOURCES`（`:77-90`）只覆盖 `architecture.{en,zh-CN}` 的源→HTML 腿；`scripts/__tests__/next-loop-twin.test.ts` 的 `SOURCES`（`:93-95`）是 `next-loop` ×2 + `architecture` ×2，钉的是三条收敛语句（blocker → 重审 · warn/nit → `REVIEW_FIX` · 软上限），**不涉**「`next:` 是否末行」这一句，且没有 HTML 腿；`journey` 两份在 `scripts/__tests__` · `face/__tests__` · `packages/kairos/tests` 三个测试面里零命中，**完全没有 pin**。因此本计划对那四份消费面产物的保证只是「Task 4 本轮重生成 + 一次性新鲜度校验」，**不**声明「门会拦住改源不重生成或手改 HTML」；建门属后续工作，不在本相位（与 spec v0.18 §5 同口径）。

## Review Focus

- **收口之后有人在轮外改文档**：drift 的另一半必须还在——否则「防自旋」被本相位拆掉，未按现版本审过的文档会被交出去。由 Task 1 的用例 B 覆盖。
- **半途被砍的 fix 改了文档**：基线不得推进（负控直读账本的 `doc_hash`），而 frontier 给的是**该 fix 的重试面**——drift 不压 pending fix（§5.5 ②）。由 Task 1 的用例 C 覆盖。
- **`next:` 行被脚本 / 技能整行抄走**：`review --type plan --plan <path>` 后面多一个 ` — reason: x` 就会在 shell 里炸。由 Task 2 的「`next:` 字节不变」断言与独立 `reason:` 行覆盖。
- **BLOCKED / TIMEOUT 轮**：既无 `next:` 行就不得有 `reason:` 行——凭空造一个 reason 会让人以为有一个可执行去向。由 Task 2 的 hop-null 断言覆盖。
- **wave 面的两个 frontier**：§11 之后胶囊与板面印的是 **pipeline frontier** 的同一个 `NextHop`（故 `reason:` 同值），**line frontier**（`peekNext`，frame-keyed）是另一个对象：drifted wave 上它给 `review` / `doc-drift` 的帧，正是 Task 3 的注入活判据。不得有人把 capsule ⇄ `peekNext` 「修」成等式（那要改 `#routeNext` 的路由来源）；board ⇄ capsule 才是 Task 7 的结构事实（只对板面跑 frontier 的节点：`overall` 条目渲程序板、无板面半边，`face/board-view.ts:807`）。Task 3 Step 8 的落地负控保留，但其理由按 §11 改写（该夹具的 review 在胶囊渲染前重绑了 brief，故**帧**不再 drift）。

### Task 1: 写回白名单加 `fix` + 预览的 fix 腿 + 三条互锁测试

#### Objective

让**完成**的 fix 轮把它产出的一版写回为该行的 reviewed identity，使 C5 的 `fix blocker==0 → close(state)` 在 doc 线四型与 branch 线上真正可达；dry-run 预览也认 `fix` 轮，但其 phase 列表**自存一份**（判别门不同，无法共用一处判定），以行为 pin 守住、并登记为已知双写债务。

#### Files

- Modify: `packages/cdd-engine/src-next/session/run.ts:705-718`（phase 白名单）· **白名单正上方的整段注释 `:689-704`**（现写「The completed-review revision write-back … a completed review binds the CURRENT revision」，加 `fix` 后即陈旧）· 同文件 `#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision` 的文档注释（`:720-750` 区）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts:793-797`（`recordReviewedRevision` 注释：改为「已入账 identity」）
- Modify: `packages/cdd-engine/src-next/face/preview.ts:147-162`（`#recordsOf` 判别式 + docstring）
- Test: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（新增 describe：doc 线四型 · branch 线 · wave 收口回归 pin）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（新增 fix 轮用例 + 改写 `:126-146` 的陈旧 branch 用例）

#### Consumes

- `Ledger#recordReviewedRevision(key, revision, identity)` · `Ledger#recordReviewedBrief(waveKey, planPath)`（既有，签名不动）
- `Lifecycle#advance()` 与 `run.test.ts` 的 `fixture()` / `stub()` / `finding()` 助手（既有）

#### Produces

- 行为变化（无新导出）：完成的 fix 轮写回 reviewed identity；`face/preview.ts#recordsOf` 对 `fix` 轮报告同一条写。
- 测试助手约定：文档写在 **ledger 的读取基准**下并传**绝对路径**——`doc = path.join(repo, ".kairos", "cdd", DOC)`，首次写前 `mkdirSync(path.dirname(doc), { recursive: true })`（`fixture()` 只建了 `<repo>/.kairos/cdd`）；`stub` 的 dispatch 回调用这个 `doc` 改写文件，代表「fix 轮编辑文档」。`target.doc` 与 branch 线的 `planPath` 一律传绝对路径（branch 线传 `planPath` 本身）：相对值会让 `#abs`（`docLineVerdict:905-906` → `#abs:598-600`，基准 = workspace root）与 `#recordDocRevisionOf`（`run.ts:750-762`，从 `process.cwd()` 读）读到两个不同文件，用例从此恒绿。`run.test.ts` 的 `node:fs` import 增 `mkdirSync`。

#### Steps

- [ ] **Step 1: 写用例 A（doc 线四型：warn-only 的 review → 改文档的 fix → 收口）** — checkable: 断言面取**胶囊的 `next:` 行**（doc/branch 线上它是 drift 感知的：`#hopOf` → `Ledger#nextHopOf`，其 drift cell 读 `reviewGate`）；在改动前的树上 `fix1.capsuleLines[1]` 以 `next: review` 开头（红），实现后不再以 `review` 开头。**夹具是裸 slug，这一点要写明**：该 `Lifecycle` 不传 `specPath` / `planPath`（`run.test.ts:1016-1022`），故胶囊走 Task 7 的**`specPath === null`** 退化、印本线自己的 exit（`done` / `handoff` / `next-wave`）；§11 之后**带 plan 的 slug** 上收口轮印的是**下一面的 active hop**，它完全可能以 `next: review --type plan --plan …` 开头——那句字面不是本线被重开，也不是本断言的普适形式（spec v0.26 §6 第 1 条）。故「不以 `review` 开头」只在该裸 slug 夹具上成立，不得读成普遍事实。同一条用例里 `run.peekNext()` 今日给出非 null 的 `review` 帧（`hop.reason === "doc-drift"`）、实现后为 `null`（这是**line frontier**，与 §11 的 pipeline frontier 不是同一个对象）。`fix1.route` 今日已是 `{ kind: "done" }`——它是 C5 的判定（`:813-818`），不读文档——只作辅助事实，**不得**当红证据

```ts
describe("P24 §2 — a completed round advances the line's reviewed identity", () => {
  for (const type of ["phase-spec", "overall", "plan", "single-spec"] as const) {
    it(`${type} — a warn-only fix that edited the doc still closes the line`, async () => {
      const { ledger, repo, cleanup } = fixture();
      try {
        // The ledger's read basis is `<repo>/.kairos/cdd` (WorkspaceRoot) — the doc
        // lives there and BOTH reads (the basis-relative verdict, the absolute
        // write-back) must hit one file: an absolute path.
        const doc = path.join(repo, ".kairos", "cdd", DOC);
        mkdirSync(path.dirname(doc), { recursive: true });
        writeFileSync(doc, "---\ndoc-type: phase-spec\nversion: v0.1\nslug: x-design\n---\n\n## Design\n\n- one\n");
        let fixes = 0;
        const dispatch = stub((frame) => {
          if (frame.phase === "fix") {
            fixes += 1;
            writeFileSync(doc, `---\ndoc-type: phase-spec\nversion: v0.${fixes + 1}\nslug: x-design\n---\n\n## Design\n\n- ${fixes}\n`);
            return { status: "APPROVED" };
          }
          return { status: "APPROVED", findings: [finding("warn")] };
        });
        const run = new Lifecycle({
          face: targetFaces[type],
          state: EMPTY_RUN_STATE,
          ledger,
          dispatch: dispatch.step,
          target: { kind: type === "plan" ? "plan" : "spec", doc },
        });
        run.attachCapsule(new Capsule(new Words()));

        const review1 = await run.advance();
        expect(review1!.route!.kind).toBe("fix");
        const fix1 = await run.advance();
        expect(fix1!.frame.phase).toBe("fix");
        // `[1]` is the `next:` row (the stub passes no dispositionsSummary); Task 2's
        // `reason:` row lands at `[2]`, so this index holds whichever task lands first.
        // 今日：`next: review --type …`（drift 自噬）· 实现后：本线自己的 exit（裸 slug）
       // 夹具未传 specPath/planPath ⇒ Task 7 的 `specPath === null` 退化；带 plan 的 slug 上
       // 收口轮印的是下一面的 active hop（可以是 `review --type plan …`），不属本断言面
        expect(fix1!.capsuleLines[1]).not.toMatch(/^next: review\b/);
        expect(run.peekNext()).toBeNull();
        // 辅助事实：C5 今日即判了收口，故这条断言前后都绿，不作红证据
        expect(fix1!.route).toEqual({ kind: "done" });
        expect(await run.advance()).toBeNull();
      } finally {
        cleanup();
      }
    });
  }
});
```

- [ ] **Step 2: 跑它并确认红** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/run.test.ts -t "warn-only fix that edited the doc"` 全部 4 例 FAIL，`fix1.capsuleLines[1]` 实测为 `next: review --type <type> …`、`peekNext()` 为非 null 的 `review` 帧。若实测为 `next: done` 且 `peekNext()` 为 `null`，先查夹具基准（`doc` 未落在 `<repo>/.kairos/cdd` 下或未建父目录 ⇒ 用例惰性），不要进入实现
- [ ] **Step 3: 写用例 B（防自旋：收口后编排器侧改文档仍重开 review）** — checkable: 同一 `doc` 基准；该用例在 Step 7 的实现后仍绿（它今天已绿，作用是锁住语义不被拆）
- [ ] **Step 4: 写用例 C（半途负控：BLOCKED 的 fix 改了文档，基线不推进）** — checkable: 同一 `doc` 基准；驱动是 `{ status: "BLOCKED" }` 的 fix 轮；实现后断言两件事——① `run.peekNext()!.frame.phase === "fix"`（frontier 给的是**该 fix 的重试面**，§5.5 ②：drift 不压 pending fix）② **基线未推进**：`ledger.reviewedDocRevisionOf(type, type)!.doc_hash` 仍等于 review 1 绑定的内容哈希，且 ≠ BLOCKED fix 写出的内容哈希（②直接读账本，才是真正的负控；①锁住「drift 不压 fix」）。**片段须过 `tsc -p packages/cdd-engine`**：`DispatchOutcome`（`session/run.ts:213-252`）没有 `reason` 字段，`stub(script: (frame: OpenFrame) => DispatchOutcome)` 是上下文返回位，写多余属性会触发 excess property check 报 TS2353；既有同类用例一律写 `{ status: "BLOCKED" }`（`run.test.ts:503` · `:529` · `:575` · `:1083`）

```ts
// 用例 B 的断言（收口后轮外改动）
expect(run.peekNext()).toBeNull();                        // 收口后无帧
writeFileSync(doc, "---\ndoc-type: phase-spec\nversion: v0.3\nslug: x-design\n---\n\n## Design\n\n- out-of-round\n");
expect(run.peekNext()!.frame.phase).toBe("review");       // 轮外改动仍重开

// 用例 C 的断言（半途被砍的 fix）
const original = "---\ndoc-type: phase-spec\nversion: v0.1\nslug: x-design\n---\n\n## Design\n\n- one\n";
const half = "---\ndoc-type: phase-spec\nversion: v0.2\nslug: x-design\n---\n\n## Design\n\n- half\n";
writeFileSync(doc, original); // the review-1 input — the baseline's source content
const dispatch = stub((frame) => {
  if (frame.phase === "fix") {
    writeFileSync(doc, half);
    return { status: "BLOCKED" };
  }
  return { status: "APPROVED", findings: [finding("warn")] };
});
await run.advance(); // review 1 — the write-back binds `original`
await run.advance(); // fix — BLOCKED: writes `half`, binds nothing (targetAction false)
// ① the frontier offers the fix RETRY — drift never outranks a pending fix (§5.5 ②)
expect(run.peekNext()!.frame.phase).toBe("fix");
// ② the baseline did not advance — it still names the reviewed content, not the half fix
const bound = ledger.reviewedDocRevisionOf(type, type)!;
expect(bound.doc_hash).toBe(ledger.refs().docRevision(doc, original).doc_hash);
expect(bound.doc_hash).not.toBe(ledger.refs().docRevision(doc, half).doc_hash);
```

- [ ] **Step 5: 写 branch 线用例（branch fix 改 plan → 收口）** — checkable: `planPath` 指向 `<repo>/.kairos/cdd/docs/kairos/plans/x-plan.md`（绝对路径，先建父目录，夹具 `planDoc([task(1, "none")])`），`target: { kind: "branch" }`；fix 轮改写 plan 后 `fix1.capsuleLines[1]` 不再以 `next: review` 开头、`run.peekNext()` 为 `null`（改动前为 `next: review --type branch --plan …` + 非 null 的 `review` 帧，必红）

```ts
const planPath = path.join(repo, ".kairos", "cdd", "docs/kairos/plans/x-plan.md");
mkdirSync(path.dirname(planPath), { recursive: true });
writeFileSync(planPath, planDoc([task(1, "none")]));
const dispatch = stub((frame) => {
  if (frame.phase === "fix") {
    // A real fix rewrites its own output: one appended line changes the revision
    // without touching the plan structure the parser reads.
    writeFileSync(planPath, `${readFileSync(planPath, "utf8")}\n<!-- fix round edit -->\n`);
    return { status: "APPROVED" };
  }
  return { status: "APPROVED", findings: [finding("warn")] };
});
const run = new Lifecycle({
  face: targetFaces.branch,
  state: EMPTY_RUN_STATE,
  ledger,
  dispatch: dispatch.step,
  target: { kind: "branch" },
  planPath,
});
```

- [ ] **Step 6: wave 收口回归 pin（白名单加 `fix` 后 wave 仍收口）** — checkable: 一条既有 wave 小循环夹具的用例——blocker-free 的 fix 之后 `await run.advance()` 为 `null` 且 `run.peekNext()` 为 `null`；先在改动前的树上跑一次并记录为绿，改动后仍绿。`#recordReviewedWaveBrief`（`run.ts:733`）从此在 fix 轮也绑定 brief，这条 pin 是「wave 分支零可观测收益」的唯一守门人
- [ ] **Step 7: 实现白名单** — checkable: `run.ts:705-718` 的条件从 `frame.phase === "review" || frame.phase === "branch-review"` 改为三者并含 `"fix"`，三分支（doc / wave / branch）原样复用；`run.ts:689-704`（白名单正上方的整段注释，含 `:693` 的「a completed review binds the CURRENT revision」）、`ledger.ts:793-797` 与三个 `#record…` 的注释改为「完成的 review **或 fix** 轮把该轮产出的 identity 入账」
- [ ] **Step 8: 跑全部用例确认绿** — checkable: `-t "P24 §2"` 全绿（doc 四型 + branch 线 + wave 回归 pin）；且 `-t "the spec/plan small loop"` 与 `-t "the branch small loop"` 既有用例全绿（未被白名单改动打破）
- [ ] **Step 9: 预览的 fix 腿 + 行为 pin + 陈旧 branch pin** — checkable: `face/preview.ts#recordsOf` 的 phase 白名单扩为 `review | branch-review | fix`，腿按 target 取；它与 `#bookkeep` **各存一份**——`#bookkeep` 另有 `record.verdict.targetAction` 门，dry run 无 verdict，两处物理上无法共用同一处判定（spec §7 允许的 fallback 即此）。`preview.test.ts` 的 fix 轮用例只钉住**预览侧当前行为**，是行为 pin 而**不是**漂移探针：任一侧日后单独改动它都不必红，不得据此宣称能拦单侧漂移（双写与守卫边界见 Constraint「预览的策略副本是显式债务」与 Acceptance）。docstring 改为「on a completed review **or a fix**」，并删掉 `face/preview.ts:147-151` 里的「the branch line binds none」（自 P21 的 `#recordReviewedBranchRevision` 起就是错的——分支线绑 plan 的 doc-revision）；`preview.test.ts` 新增用例断言 doc 线 fix 轮 dry-run 的 `would record:` 含 `reviewedRevision(doc)`，并改写 `:126-146` 的陈旧 branch 用例（标题与 `:144` 的期望同笔改为含 `reviewedRevision(doc)`）。**branch 腿的路径来源指名**：`#recordsOf` 的 branch 腿取 `this.#scene.planPath`（与 `#readsOf` 的 branch 分支同源，`face/preview.ts:122-127`），`null` 时不追加该腿；**不得**就地再引第二条路径来源（`#bookkeep` 用的是 `Lifecycle#planPath`，预览面手里没有它）
- [ ] **Step 10: 跑 preview 套件 + 提交** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/preview.test.ts` 绿；`pnpm run precommit` 绿；`git commit -m "fix(cdd-engine): a completed fix round advances the line's reviewed identity"`

#### Acceptance

- doc 线四型（phase-spec / overall / plan / single-spec）各有一条用例：warn-only review → 改文档的 fix → 胶囊的 `next:` 行为收口（不再以 `review` 开头）且 `peekNext()` 为 `null`，并在改动前的树上**必红**。**该断言只在裸 slug 夹具上成立**（不传 `specPath` / `planPath`，走 Task 7 的 `specPath === null` 退化，故印本线 exit）；带 plan 的 slug 上收口轮印**下一面的 active hop**（`review --type plan --plan …`），那是别的面的 lead，不构成本线重开，也不得拿来当本用例的红证据。`route` 为 `{ kind: "done" }` 同时成立，但它是 C5 的既有事实（今日即绿），只作辅助断言。
- branch 线同断言一条（branch fix 改 plan → 胶囊 `next:` 收口 + `peekNext()` 为 `null`，改动前必红）。
- wave 收口回归 pin 一条：白名单加 `fix` 后，blocker-free 的 fix 仍收口（`advance()` 与 `peekNext()` 均为 `null`），改动前后都绿。
- 收口后由「轮外」写文档 → `peekNext()` 的帧为 `review`（防自旋未失效）。
- `{ status: "BLOCKED" }` 的 fix 且改了文档 → 基线不推进（`reviewedDocRevisionOf(type, type)` 仍指向 review 1 绑定的内容哈希），frontier 给的是该 fix 的重试面（`peekNext()` 帧为 `fix`；drift 不压 pending fix），重试若再次带 blocker 才回到 `review`。
- 预览面 fix 轮 dry-run 报告 `reviewedRevision(doc)`；preview 的陈旧 branch 断言已改为实际行为。
- `progress.json` 键集不变（无迁移）。
- **已登记的双写债务**：`#recordsOf` 与 `#bookkeep` 的 phase 列表各存一份（判别门不同：前者无 verdict、后者有 `targetAction` 门，无法共用一处判定）；守卫边界是「预览侧行为 pin」——它是行为 pin 而**不是**漂移探针，任一侧日后单独改动它都不必红，故**不**宣称能拦住单侧漂移；两处判别的合并已另开 [#414] 记录（债的收敛属该 issue，不在本相位）。

#### DependsOn

none

### Task 2: `reason:` 行渲染（站表 + 胶囊 + 板面）+ 16 处重锚 + 陈旧散文

#### Objective

让每个由 hop 渲染出的 `next:` 行之后紧跟一行 `reason: <token>`（token 取 `NEXT_HOP_REASON` 七值），`next:` 行字节零变；胶囊与板面同值。

#### Files

- Modify: `packages/cdd-engine/src-next/face/words.ts:47`（`StationKind` 加 `"reason"`）· `:194-199`（`CAPSULE_WORDS.stations` 增 `reason: "reason:"`）· 文件自述散文 `:7-8`（「the `next:` route station + the stderr stations」→ 两枚路由站锚、五行站表）
- Modify: `packages/cdd-engine/src-next/face/route-render.ts`（新增 `renderReason(hop: NextHop): string`——hop 的缺席由调用方一次把门（`renderHop` 只对 null hop 返回 null），不设 null 入参、不留不可达的 null 分支；`renderHop` 不动）
- Modify: `packages/cdd-engine/src-next/face/capsule.ts:133-134`（前缀取 `words.station("reason")`，值取 `renderReason`）· 陈旧散文 `:19` · `:67` · `:100` · 文件自述散文 `:2`（摘要行）· `:7-10`（文件自己的渲染示意图：补第十一行 `reason: <token>`，并注明 hop 为 `null` 时不渲）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts:349-358`（`nextLine` 旁增 `static reasonLine(hop)`：值直取 `hop.reason`、前缀布局字面 `  reason:  `；无 `renderer` 参数，`next === null` 分支不调用它）· `:558`（调用点后追加一行）
- Test: `packages/cdd-engine/src-next/face/__tests__/face.test.ts`（13 处整块快照 + 站表长度 4→5 + 陈旧散文 `:8` · `:101`）
- Test: `packages/cdd-engine/src-next/face/__tests__/capsule.test.ts`（2 处整块快照 + 陈旧散文：`:467` 的 describe 标题 · `:474`）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`reason:` 行渲染 · hop-null 无行 · 胶囊 ⇄ 板面 token 同值 pin）

#### Consumes

- `NextHop.reason`（既有字段，七值）· `RouteRenderer#renderHop`（既有）
- `Words#station(kind)`（既有；Task 2 为站表加第五行）

#### Produces

- `StationKind` 增 `"reason"`；`CAPSULE_WORDS.stations.reason === "reason:"`
- `RouteRenderer#renderReason(hop: NextHop): string` — 返回 `reason: <hop.reason>`（站表前缀 + token）；hop 的缺席由胶囊的 `hopValue !== null` 门一次判定，与 `renderHop` 读同一对象
- `BoardView.reasonLine(hop: NextHop): string` — 返回 `  reason:  <token>`（token 直取 `hop.reason`；无 renderer 参数，故无不可达的 `(none)` 退化分支）

#### Steps

- [ ] **Step 1: 写红测试（胶囊）** — checkable: `face.test.ts` 新增用例断言 `capsule.emit("APPROVED", "/h.json", hopOf({ kind: "review" }))` 的**末元素**为 `` `reason: ${NEXT_HOP_REASON.taskOpen}` `` —— 今日 FAIL（无该行）
- [ ] **Step 2: 写红测试（hop 为 null 不渲）** — checkable: 既有 hop-absent 快照（`face.test.ts:109`（成功无 hop）· `:114`/`:118`（BLOCKED / TIMEOUT）· `:222`/`:223`；`capsule.test.ts:470`/`:490`/`:491`）**一行不改**仍绿（若实现给它们加了 `reason:` 行则红）
- [ ] **Step 3: 站表加第五行** — checkable: `StationKind` 与 `stations` 各加 `reason`；`face.test.ts:103` 的长度断言由 4 改 5；`:66-69` 四条逐键断言不动；同处**补第五条**逐键断言 `expect(words.station("reason")).toBe("reason:")`——只改长度 pin 时把值写成 `"reason"`（少冒号）也能全绿
- [ ] **Step 4: 实现 `renderReason` 并接到胶囊** — checkable: `renderHop` 一行未动；胶囊在 hop 非 null 时追加一行，且**不再**判 `reason !== null`（`renderHop` 只对 null hop 返回 null，故 `hopValue !== null` 这一门同时管住两行，内层 null 判是不可达的死代码）

```ts
// face/route-render.ts
renderReason(hop: NextHop): string {
  return `${this.#words.station("reason")} ${hop.reason}`;
}

// face/capsule.ts（:133-134 之后）
const hopValue = hop ?? null;
const next = this.#route.renderHop(hopValue);
if (hopValue !== null && next !== null) {
  lines.push(`${words.station("next")} ${next}`);
  lines.push(this.#route.renderReason(hopValue));
}
```

- [ ] **Step 5: 板面渲染** — checkable: `reasonLine` 与 `nextLine` 同形（布局字面，不取词表），值直取 `hop.reason`（`renderReason` 的值自带站表前缀，不直取），`:558` 之后追加；`:556` 的 `(none)` 与 `:623` 的程序板 `done` **不追加**（字节零变）
- [ ] **Step 6: 胶囊 ⇄ 板面 `reason:` 同值 pin** — checkable: 沿用 `board-view.test.ts:1612-1654` 的 frontier-hop 夹具形状（`peekNext().hop` → 胶囊 `emit(…)` 的 `reason:` 行对板面那行），断言两面的 **token 等值**，且**两边同一归一化**：`const tokenOf = (line: string) => line.trim().replace(/^reason:\s+/, "");`，然后 `expect(tokenOf(boardReasonLine)).toBe(tokenOf(capsuleReasonLine))`。**比较之前先钉板面前缀本身**：`expect(boardReasonLine.startsWith("  reason:  ")).toBe(true)`——`tokenOf` 的 `^reason:\s+` 会把 `  reason:  ` 这个布局字面归一化掉，不另钉就没人断言 spec §4 声明的 11 列形状。胶囊行是 `reason: <token>`（一个空格），板面行是 `  reason:  <token>`（11 列 + 两空格）——**不归一化就恒红**，而恒红的 pin 会逗人把它弱化成 `toContain`（那是把 pin 变成永不红）。前缀各按自己的家（胶囊走站表、板面走布局字面），故只比 token；两面共用同一事实 `NextHop.reason`（胶囊经站表前缀渲、板面直取），这条 pin 只钉「将来有人只改一面」
- [ ] **Step 7: 重锚 15 处整块快照** — checkable: `face.test.ts` 13 处 / `capsule.test.ts` 2 处，各新增**一个** `reason:` 元素。13 处按 `toEqual(` 行在册：`:124`（done）· `:128`（next-wave）· `:136`（review）· `:147`（fix + reviews）· `:152`（bare fix）· `:163`（soft-cap，单行数组）· `:171`（review + wave target）· `:182`（fix + wave target）· `:195`（review + branch target）· `:205`（review + phase-spec target）· `:213`（next-wave + wave target）· `:226`（done）· `:266`（T8 seam 的 `lines`），另 `capsule.test.ts:482` · `:498`（spec §7 第 2 类按 `capsule.emit(...)` 调用行登记，两者逐处一一对应）。**token 不得猜**——先实现再一次性重锚：跑套件，从失败断言的 `received` 里逐处抄实际值，一条不漏。取值来源（`#reasonOf` 的序，`session/next.ts:396-404`）：`fix` ⇒ `pending-fix` · `soft-cap` ⇒ `soft-cap` · `review` + drift ⇒ `doc-drift` · 其余活 hop（`review` 未 drift / `next-wave`）⇒ `task-open` · doc-class blocked ⇒ `doc-class-blocked` · 无路由或 terminal ⇒ `face-closed` · 闭线 ⇒ `closed-line`；`received` 仍是权威
- [ ] **Step 8: 改写陈旧散文（14 处）** — checkable: `face.test.ts:8` · `:101` · `capsule.ts:19` · `:67` · `:100` · `run.ts:262` · `capsule.test.ts:467`（describe 标题）· `:474` · `cli.test.ts:1960` · `run.ts:239` · `:876` —— 一律改为「`next:` 行 + 紧随其后的 `reason:` 行」；断言字节零变。**另三处文件自述散文同笔同义**：`face/capsule.ts:2`（摘要行 → 「both station anchors ride the table (`next:` + the new `reason:`)」）· `face/capsule.ts:7-10`（文件自己的渲染示意图补第十一行 `reason: <token>`，并注明 hop 为 `null` 时不渲）· `face/words.ts:7-8`（「the `next:` route station + the stderr stations」→ 两枚路由站锚、五行站表）。改写留在 `face/capsule.ts:1-12` 与 `face/words.ts:1-12` 的既有散文内——架构图 `face` 节点的取证跨度不脱钩；`diagrams.guard.test.ts` 只校验 upstream/host/engine 三锚，故这是文档一致性要求而非门的要求。**`face.test.ts:101` 的那句改写必须由断言承载**：`:102` 只钉 `emitted[1]` 的 `next:`，故同处补 `expect(emitted[2].split(" ")[0]).toBe(words.station("reason"))`——否则 `renderReason` 里硬编码 `reason:` 也会全绿，新站行成了死声明。**扫描词面**：末行 / `LAST` / `close` / `last line` / `trailing` / 唯一站锚 / 唯一站词——`capsule.ts:100` 的「line LAST … the output's close」正是旧词面（只扫「末行」）漏掉的；「九处」不是穷尽的证明。`session/__tests__/run.test.ts` 无此散文（其 `next:` 提及是断言，以及一条「prints no `next:` line」的缺席断言），不进这十四处
- [ ] **Step 9: 跑三套件 + 提交** — checkable: `face.test.ts` / `capsule.test.ts` / `board-view.test.ts` 全绿；`next:` 行断言（`lines[1]` 抽取与 `toContain`）零改动仍绿；`pnpm run precommit` 绿；`git commit -m "feat(cdd-engine): render the hop reason on its own line after next:"`

#### Acceptance

- 每个由 hop 渲染出的 `next:` 行之后紧跟一行 `reason: <token>`，token ∈ `NEXT_HOP_REASON` 七值。
- **非胶囊读者**的 `next:` 行字节与今日逐字节相同（152 处既有断言中 137 处零改动即证）。**该字节声明限非胶囊读者**（spec v0.22 / v0.26 的收窄）：§7 的 137/15 分类只描述板面、门与按行抽取的读者；胶囊侧在 pipeline frontier 与本线 C5 分歧处的 `next:` 字面**会变**（Task 7），故胶囊的重锚另立清单（Task 7 Step 7），不得用本条本包它。
- hop 为 `null` 的轮（BLOCKED / TIMEOUT）两面都不渲 `reason:` 行。
- 胶囊与板面对同一 hop 渲同值（token 等值；前缀各按自己的家：胶囊走站表、板面走布局字面），由 Step 6 的 pin 钉住；板面的 `(none)` 与程序板 `done` 两行字节零变。
- 站表五行（长度 pin 已重锚），`routeWords` 一行未动。
- 站表第五行的**值**有逐键断言（`words.station("reason") === "reason:"`，与 `:66-69` 同形）；胶囊**确实读该行**——`face.test.ts:101` 旁的 `emitted[2]` 前缀断言承载「两个站锚都走站表」这句注释；板面 `  reason:  ` 的 11 列前缀自身有断言（Step 6 在归一化之前钉住），不靠 `tokenOf` 抹平。

#### DependsOn

none

### Task 3: wave 面的 `briefDrift` 注入（一个判定、四个读者）

#### Objective

让 wave 线的 `reason` 能取到 `doc-drift`：把 `#briefDrift` 提为公开读、经 **`Ledger#nextHopOf` 自己入参对象的** `briefDrift` cell 注入（`NextHopInput` 是 router 的输入面，drift 事实在那里走既有 `gate.drift`，一字不动），由 `Lifecycle#hopOf`（服务 `peekNext` 的活读者）与 `BoardNext#hopOf`（板面）喂同一 fact；两处都只在**这一面是 wave** 时注入，**不设第二道闸**——wave 面不做路由替换（替换驱动只取 doc 面 `reviewGate`，见 Step 4），故板面拿到的 pipeline exit `handoff` 原样保留，注入只可能改它的 `reason:` 取值。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`#briefDrift` → public `briefDrifted(waveKey: string): boolean`，内部读 `reviewedRevisionOf(waveKey)`）· `:983`（`waveLineRoute` 的 D30 腿改调它）· `:1219-1229`（`nextHopOf` 的**内联入参类型**新增可选 `briefDrift?: boolean`，落在 `nextLineOpen` 旁）· `:1230-1233`（原因 cell 读注入值，替换驱动仍只读 `reviewGate`）· `:1205-1218`（`nextHopOf` 的 docstring 同笔改为两值口径）
- Modify: `packages/cdd-engine/src-next/session/next.ts:208-226`——**形状一行不动**（不加 cell、`NextHop.reason` 与 `#reasonOf` 也不动）：`NextHopInput` 是 `NextStepRouter#nextHop` 的输入面（`:341-355`），drift 事实在那里走既有 `gate.drift`（由 `nextHopOf` 填）；加到这个类型上会是一个没人读的字段，且两个注入点会因 excess property 被 `tsc` 拒绝。**该接口唯一被改的是 `gate` 的 docstring（`:211-213`）**——它今天教「`drift` = the doc moved past its reviewed revision, so the closed line reopens」，本相位之后该 cell 是两个事实的并（doc revision 移动，或 wave 的 brief revision 相对该面自己的已入账 identity 移动），且替换只落 doc 线；同笔列入 Step 4 的同步列
- Modify: `packages/cdd-engine/src-next/session/run.ts:836-849`（`#hopOf` 在 wave 帧注入）· `packages/cdd-engine/src-next/face/board-view.ts:849-861`（那一次 `nextHopOf` 调用的输入对象加一格：`target?.type === "wave" ? … : undefined`，无额外闸）
- Test: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（`peekNext` 的 token 红→绿）· `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（板面 token 红→绿 · soft-capped + drifted 的替换负控）

#### Consumes

- `Ledger#waveLineRoute` 的 D30 腿（既有）· `RouteRenderer#renderReason`（Task 2）
- `Lifecycle#peekNext()`（既有；frontier 面的活读者）

#### Produces

- `Ledger#briefDrifted(waveKey: string): boolean`（public；`#briefDrift` 唯一实现）
- `Ledger#nextHopOf` 入参新增可选 `briefDrift?: boolean` ——只改该调用的**原因 cell**：`gate.drift` 取 `drift || (input.briefDrift ?? false)`；**替换驱动 `drift` 对 wave 恒为 `false`**（`input.doc != null && input.type !== "wave"` 的既有形状保留，Step 4 的两个值分开），故 `drift && onExitSide(route)` 在 wave 面不触发。`NextHopInput` 形状不变，缺省 `undefined` 时行为与今日一致
- 行为变化：drifted 且 fix 待办的 wave 在 `peekNext()` 与板面渲 `reason: doc-drift`（今日为 `task-open`）

#### Steps

- [ ] **Step 1: 写红测试（`peekNext` 的 token）** — checkable: 构造「wave review 出 warn（绑定 brief）→ 轮外改 plan 的该 wave 段 → 无 fix 记录」，断言 `run.peekNext()!.hop.reason === "doc-drift"` 且 `renderReason` 渲 `reason: doc-drift` —— 今日为 `"task-open"`
- [ ] **Step 2: 跑它并确认红** — checkable: 实际值 `"task-open"`
- [ ] **Step 3: 提公开读 + 改 D30 腿调用点** — checkable: `briefDrifted` 与 `#briefDrift` 只有一份实现；`waveLineRoute` 行为不变（既有 T11/D30 用例全绿）
- [ ] **Step 4: 加 `nextHopOf` 入参的 `briefDrift` cell + 改原因 cell** — checkable: 入参 `briefDrift` 为 `true` 时 wave 面的 `gate.drift` 为真（替换驱动 `drift` 仍为 `false`；`gate.drift` 为真 ⇒ `#reasonOf` 把 `review` 路由的 token 从 `task-open` 改为 `doc-drift`），其余面仍读 `reviewGate`；缺省 `undefined` 时行为零变。**两个值分开**：替换驱动 `drift` 仍只取 doc 面 `reviewGate`（既有 `input.doc != null && input.type !== "wave"` 形状保留），`drift && Ledger.onExitSide(input.route)` 的替换谓词对 wave **不触发**；原因 cell `gate.drift` 取 `drift || (input.briefDrift ?? false)`（`briefDrift?: boolean` 下 `drift || briefDrift` 的类型是 `boolean | undefined`，而 `NextHopInput.gate.drift` 是 `boolean`，`strict: true` 会在 Task 3 Step 9 / Task 4 Step 5 直接红）——一个值同时驱动两件事是不行的：调用方交给 `nextHopOf` 的 wave 路由只有四种——`next-wave`（无 implement 轮 ⇒ 无已绑 brief ⇒ drift 恒假）、`review`（drifted 的 fix 待办面已在 `waveLineRoute:983` 改写成 review）、`fix`（未 drift）、`null`（`Lifecycle` 侧：soft-cap / 不可读轮时 `#openWaveFrame` 已不出发帧，`peekNext` 到不了这里）——板面侧另会拿到 `handoff`（`#exitRoute`：`active` 为 null 的 soft-cap / 不可读 carried 轮，`face/board-view.ts:886-892` · `:902-905`），它虽在 exit 侧，但替换驱动对 wave 恒为 `false`，故 `onExitSide` 为真且 `drift` 为真的组合只落在 `review` 上，不需要 wave 例外、不写死分支、也不需要第二道闸；该 `handoff` 的 `next:` 逐字节不变、`reason:` 落 `closed-line`（Step 7 的负控钉住）。**同笔同步 docstring**：`session/next.ts:211-213` 的 `NextHopInput.gate` docstring（今日教「`drift` = the doc moved past its reviewed revision, so the closed line reopens」）改为「该面自己的已入账 identity 移动了（doc 的 revision 或 wave 的 brief revision），故闭合行重开——替换只对 doc 线生效」；`session/ledger.ts:1205-1218` 今天教「the drift-aware gate verdict」与「the gate's `drift` verdict IS the reopen」；改后须写成「替换驱动只读 gate 判定；原因 cell 另认调用方注入的 wave brief-drift 事实」——本步在装配里留下两个 drift 量，注释不改就是新的陈旧契约
- [ ] **Step 5: 两处注入** — checkable: `Lifecycle#hopOf` 在该 `nextHopOf` 入参对象的 `briefDrift` 一格上于 `frame.type === "wave"` 时传 `this.#ledger.briefDrifted(String(frame.key))`；`BoardNext#hopOf` 在既有那一次 `nextHopOf` 调用里传 `target?.type === "wave" ? facts.ledger.briefDrifted(String(target.id)) : undefined`（**不得**新增第二次调用，方法签名不动；`target.type` 那半个条件不能省——引擎走到非 wave frontier 时 `facts.report.wave.active` 也可能非 null，而 `target.id` 那时是文档路径）。**这一格只有 `target.type` 一道条件，且它不是路由闸**：**不需要（也不该加）`active !== null` 之类的闸**：`#pipeline` 交给 `#hopOf` 的是 frontier 自己的路由，wave 的 `active` 为 null 时它是 `#exitRoute` 的 `{ kind: "handoff", entry: PIPELINE_NEXT.wave }`（`face/board-view.ts:886-892` · `:902-905`），属 exit 侧，而替换驱动 `drift` 对 wave 恒为 `false`（Step 4 的两个值分开），故 `drift && onExitSide(handoff)` 不可能命中——该 `handoff` 不会被改写成 `review --type wave …`，注入只改它 `reason:` 的取值（`#reasonOf` 对 `handoff` 落末行 `closed-line`）。`WaveGate.vet` 按 `waveLinePhase` 判 phase，板面因此与门同侧，P22 T17(c) 的分叉不可达——由 Step 7 的负控钉住；两个注入点也因不设闸而对称。
- [ ] **Step 6: 板面断言** — checkable: `board-view.test.ts` 断言同一状态下板面的 `next:` 行为 review lead、`reason:` 行为 `doc-drift`
- [ ] **Step 7: 负控（soft-capped + drifted 的板面不翻路由）** — checkable: `board-view.test.ts` 再加一条——构造 `waveLineRoute` 落 `null`（review 周期打到 `REVIEW_CYCLE_CAP` 的 soft-cap 面）**且**该 wave 的 brief 已 drift 的行，断言板面的 `next:` 行与 drift 前**逐字节相同**（仍为该 wave 的 pipeline exit `handoff` 站，**不得**出现 `review`），`reason:` 行为该路由的既有取值 `closed-line`（**不是** `task-open`：`handoff` 的 `hopOf` 为 null，`#reasonOf` 落末行 `closedLine`；`doc-drift` 只可能落在 `review` 路由上，`session/next.ts:399`），并断言 `ledger.waveLinePhase(key)` 为 `null`（板面与门同侧）
- [ ] **Step 8: 负控（line frontier 的帧在重绑之后）** — checkable: 落地的那条断言保留，但**理由按 §11 改写**：`advance()` 的胶囊帧在 `#bookkeep` 重绑之后，故**该帧**不再 drift（`ledger.briefDrifted(key)` 为假）——这是 frame-keyed **line frontier** 的事实，不是「胶囊不承诺 drift」；胶囊渲的是 **pipeline frontier** 的 hop（§11），改动后与板面同值。`run.test.ts:1566` 的标题「the capsule never promises the wave brief drift — its frame sits AFTER the re-bind」按此重写（标题归 Task 7 Step 6 的散文清单），断言本身保留：它钉的是「帧不再 drift」，不得再被读成「胶囊渲染面不管 drift」。不因此改 `#routeNext`。
- [ ] **Step 9: 跑套件 + 提交** — checkable: `run.test.ts` / `board-view.test.ts` / `ledger.test.ts` 全绿；`pnpm run precommit` 绿；`git commit -m "feat(cdd-engine): the wave line's drift fact feeds the next-hop reason"`

#### Acceptance

- drifted 且 fix 待办的 wave：`peekNext()` 与板面渲 `reason: doc-drift`，且在改动前的树上必红（今日 `task-open`）。
- `briefDrifted` 是唯一实现，`waveLineRoute` 的 D30 腿与它同源；既有 T11/D30 用例全绿。
- `briefDrift` 缺省时行为与今日逐字节一致（wave 之外的四个 face 不受影响）。
- **替换不触发的负控**：soft-capped（`waveLineRoute` 落 `null`）且 brief 已 drift 的 wave，板面 `next:` 不得被改写成 `review`（仍为该 wave 的 pipeline exit `handoff` 站），`reason:` 为该路由的既有取值 `closed-line`，且 `waveLinePhase` 为 `null`——板面与门同侧，由 Step 7 钉住。
- **line frontier 的帧在重绑之后**：一条断言固定「`advance` 的胶囊帧上 `doc-drift` 不出现、`briefDrifted` 为假」——这是 frame-keyed 装配的事实；胶囊渲的是 pipeline frontier 的 hop（§11），故不得把这句读成「胶囊渲染面不管 drift」。
- wave 的收口回归 pin 归 Task 1（白名单加 `fix` 是唯一会改变 wave 写回的改动）；本任务只负责 frontier ⇄ 板面的 token 断言与胶囊负控。

#### DependsOn

2

### Task 4: 消费面一句 + changeset + 全量验收

#### Objective

把根 README 那句会变陈旧的输出承诺改准（英 + 中镜像）、把四份已发布 diagram 源里同一句断言改准（并重生成 HTML），并给本次消费面可见变化落一条 `cdd-engine` minor 的 changeset，最后跑全量验收。

#### Files

- Modify: `README.md:60`（该 bullet 的粗体首句 + 三从句一并改写）
- Modify: `README.zh-CN.md:64`（镜像同步）
- Modify: `docs/diagrams/src/next-loop.en.json:278` · `next-loop.zh-CN.json:278` · `journey.en.json:573` · `journey.zh-CN.json:573`（四句措辞——`next:` 不再是末行）
- Regenerate（**禁手改**）：`docs/diagrams/next-loop.{en,zh-CN}.html` · `journey.{en,zh-CN}.html`——按 `docs/diagrams/README.md` 的 Archify `finalize` 命令从源 JSON 重生成（`--repo-root .`，类型 `lifecycle` / `workflow`）；`*.finalize*.json` / `*.browser-check.json` / `*.delivery.json` 是 gitignored 机器回执，不入库
- Modify: `.changeset/p24-fix-identity-and-reason-row.md`——本相位**唯一**一份发布条目，且它的覆盖规则是**不变式**：**本相位每一件消费面可见变化都写进这一条**（不是固定的「四件」这个数，且**引导句本身不得带硬计数**——清单可数，不靠散文记账）。落笔时在册四件（①–④），其中第 ④ 件由 Task 5 落地、由该任务核对同一份文件的这一句；本任务之后还有两件：§11 的胶囊 frontier hop（第 ⑤ 件）由落 §11 的 **Task 7** 补，§12 的板面汇总单元（第 ⑥ 件，有失败尝试的行改字节）由**最后落地的 Task 8** 补——**且 Task 8 拥有该条目末句的改写**（现末句「`cdd board` output is unchanged — the board was already the assembly's reader.」在 §12 落地后即为假），故本任务与 Task 7 都不得把「board output 不变」写成定论；不另开第二条、不改级别。

#### Consumes

- Task 1/2/3 的落地行为（收口可达成 · `reason:` 行 · wave 的 `doc-drift`）
- Task 5 将落地的 §9 行为（板面 frontier 读 drift）——第 ④ 件的正文由本任务先写定

#### Produces

- 无代码导出；消费面文案与发行声明。

#### Steps

- [ ] **Step 1: 改英文 bullet** — checkable: 该 bullet 读作「The next hop is derived, then printed with its reason. Each run ends with its `next:` line and the reason line that follows it, and `cdd board --plan <path>` renders that same judgment as a progress board — the line and the board cannot disagree.」（三个从句都在）
- [ ] **Step 2: 同步中文镜像** — checkable: `README.zh-CN.md:64` 用 spec §5 给的整句（不得自行转述）：「**下一个去向是推演出来的，并连同其原因一起打印。** 每次运行以 `next:` 行收尾，紧接着是它的原因行，而 `cdd board --plan <path>` 会把同一个判定渲染成进度看板——这一行与看板不可能互相矛盾。」（含第三从句，即看板一致性）
- [ ] **Step 3: 刷四份 diagram 源 + 重生成 HTML** — checkable: 四句**一律引用 spec §5 定案表的原句**（不另记措辞）：`next-loop.en.json:278`「The next: line and the reason line that follows it are the last two lines of a run — the route and its cause; a BLOCKED or TIMEOUT round carries neither」· `next-loop.zh-CN.json:278`「next: 行与紧随其后的原因行是运行的最后两行——去向与它的原因；BLOCKED 或 TIMEOUT 的轮次两者都不带」· `journey.en.json:573`「next: and the reason line that follows it close the run, and cdd board renders the same judgment from the ledger」· `journey.zh-CN.json:573`「next: 与紧随其后的原因行一起收尾，而 cdd board 从账本渲染同一个判定」；四份源里旧措辞（`the last line of a run` · `最后一行` · `its last line` · `作为最后一行收尾`）零残留。重生成后逐份核验（**本轮一次性新鲜度校验**，四份结果都记入报告）：新 HTML 含新句、**不含**旧句（`grep -c "the last line of a run" docs/diagrams/next-loop.en.html` 为 0，今日即是；中英四份同法各验一句）。两处 pin 各只对**自己的面**绿、且都不钉本段改写的句子——`pnpm exec vitest run scripts/__tests__/next-loop-twin.test.ts` 的 `SOURCES` 是 `next-loop` ×2 + `architecture` ×2（`:93-95`；**不是**四份，`journey` 不在其中），钉的是三条收敛语句、不是「`next:` 是否末行」，且无 HTML 腿；`pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/diagrams.guard.test.ts` 证的是 `architecture.{en,zh-CN}` 的源→HTML 腿（`SOURCES`，`:77-90`）；`journey.{en,zh-CN}` 在三个测试面里零命中、**没有任何 pin**。故四份源的措辞与「源→HTML」两头都只能靠上面那条一次性校验，两处 pin 不构成常驻新鲜度证明（见 Constraints 的已知限制）。Archify 工具链不可用 ⇒ 报 BLOCKED（**禁止**手改 HTML）
- [ ] **Step 4: 写 changeset** — checkable: `.changeset/p24-fix-identity-and-reason-row.md` 的 front-matter 为 `"@oscaner-skills/cdd-engine": minor`，**引导句不带硬计数**（`Three consumer-visible face changes` 这类数字删掉，改为无编号列举；这一项由 **Task 7 Step 8** 先执行、由**最后落地的 Task 8 Step 5**复核——该条目被多个任务触，任何数字都会滞，故它**不是本任务落地时的未达成判据**），正文覆盖**落笔时在册的四件**消费面事实（不变式：本相位每一件消费面可见变化都在此条目内，一条不得漏）：① 完成的 fix 轮把该行 identity 入账（doc 线由此能收口）② 每条 hop 渲染的 `next:` 行后多一行 `reason: <token>` ③ wave 线的 drift 重开在 `peekNext` / 板面上标 `doc-drift`（此前只会说 `task-open`）④ 板面的 pipeline frontier 的 spec / plan 两面改读 drift：收口后被轮外改动的 doc 让板面停回该 doc 线的 review lead 并标 `reason: doc-drift`（此前印 `implement --plan … --tasks …`）——④ 由 Task 5 落地，本条目**先写定**，Task 5 只核对/订正同一份文件的这一句；**⑤ 不在本任务落笔**：§11 之后胶囊的 `next:` 会改印 pipeline frontier 的 hop（收口的 spec 轮改印后继面的 `review --type plan --plan …`）——它是本相位第五件消费面事实（含 `overall` / `single-spec` 身份节点在「收口 + 同 slug plan」上的同一形状；**不含** `overall` 收口无 plan 的 `face-closed → closed-line`——该形状字节零变），由落 §11 的 Task 7 在同一份条目上补一句（Task 7 Step 8 是它的 owner）；**⑥ 同样不在本任务落笔**：§12 的汇总单元在有失败尝试的行上改字节（比率 `{成功}/{尝试}` + `✗→✓` 恢复标记），由**最后落地的 Task 8** 补写，并**由 Task 8 改写该条目的末句**——现末句「`cdd board` output is unchanged — the board was already the assembly's reader.」在 §12 落地后即为假，本任务与 Task 7 都不得把它当定论。**只此一份**——不得另建第二条（同包同级别的两条声明会在 changelog 里生成两条同义条目），也不得声称 wave 的写回修好了某个既有收口缺陷
- [ ] **Step 5: 全量验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0（emit fresh · root · kairos · engine 三套件 · typecheck ×3 · version-sync · no-bare-functions）
- [ ] **Step 6: 提交** — checkable: `git commit -m "docs: P24 consumer face and the cdd-engine minor changeset"`；`git status --porcelain` 为空

#### Acceptance

- 根 README 英中两处表述一致且保留「line 与 board 不可能互相矛盾」这一句。
- 四份 diagram 源与它们的生成 HTML 同步刷新：源无旧措辞、HTML 含新措辞且不含旧措辞（`next:` 不再是末行在发布面上成立），证据是**本轮的一次性校验**（四份 grep，逐份记入报告），不是常驻门；HTML 从源重生成（无手改）。两处 pin **各只对自己的面**绿、且都不钉这四句——`diagrams.guard` 的源→HTML 腿只覆盖 `architecture.{en,zh-CN}`；`next-loop-twin` 读 `next-loop` ×2 + `architecture` ×2（`:93-95`）、只钉三条收敛语句、无 HTML 腿；`journey.{en,zh-CN}` 无任何 pin——故它们**不**证明这四份产物「措辞正确」或「与源同步」；「四份源的新措辞无常驻 pin · `next-loop` / `journey` 的源↔HTML 无孪生门 · `journey` 两份完全无覆盖」三项一并登记为已知限制（建门超出本相位范围）。
- changeset 存在、级别为 `cdd-engine` minor（**引导句不带硬计数**这一项由 Task 7 Step 8 先执行、由最后落地的 Task 8 Step 5 复核——该文件被多个任务触，任何数字都会滞，故本节只对正文四件负责），正文覆盖**落笔时在册的四件**消费面可见变化（规则是不变式：每件消费面可见变化都在同一份条目内；第四件是 Task 5 落地的板面 frontier，正文由本任务先写定、Task 5 只核对；第五件是 §11 的胶囊 hop，由 Task 7 补写；第六件是 §12 的板面汇总单元（有失败尝试的行改字节）与同笔的末句处理——那句「`cdd board` output is unchanged」**删除且不换成任何全板声言**，§12 的叙述另起一段、口径限定在汇总单元，由最后落地的 **Task 8** 负责）。
- `env -u AI_AGENT pnpm run validate` 退出码 0；`pnpm run emit:check` fresh。
- 树干净。
- **§6 的验收演示留证**：本相位之后的 plan 线 / 波形若出现「零 blocker 的 fix 之后收口」，取其 `next:` 输出记入 plan 的 change history；若 plan 一轮即 APPROVED，则以 spec 线已发生的六轮（零 blocker 的 fix 被 drift 打回三次）为既有事实，在 change history 里指回 spec。

#### DependsOn

1, 2, 3

### Task 5: 板面 frontier 的选面读 drift（§9）

#### Objective

让板面的 pipeline frontier 与门的判定同源：spec 已收口、其后其身份文档被轮外改动时，板面**不得**把 frontier 推到下一面（今日印 `implement --plan … --tasks …`，一条引擎会拒的命令），而应停在该 doc 面并渲该面的 review lead + `reason: doc-drift`。

#### Files

- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`pipelineFacts` 的 `phase-spec` 与 `plan` 两面的 `closed` 单元格，今日在 `:704-716`；**这两行由 Task 6 删除**，见 Acceptance）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`
- Modify: `.changeset/p24-fix-identity-and-reason-row.md`（只核对 Task 4 已写定的第 ④ 件与落地行为一致；必要时就地订正**同一份**条目的这一句——不得另开第二条、不得改级别）

#### Consumes

- `Ledger#lineStateAt(key, type, doc): "closed" | "reopened" | "open"`（`session/ledger.ts:1154-1161`，既有；`branch` 面已在用）
- `BoardView.pipelineFacts` / `BoardNext.of`（既有）

#### Produces

- 无新导出、无新状态位：行为变化——spec/plan 面的 `closed` 读 drift。

#### Steps

- [ ] **Step 1: 写红测试** — checkable: 构造「spec 行已收口（review 零 finding）→ 轮外改 spec 内容 → plan 存在」，断言板面 `next:` 为该 spec 的 review lead（`review --type <specType> --spec <path>`）且其 `reason:` 行为 `doc-drift`；今日 FAIL（印 `implement --plan … --tasks …`）
- [ ] **Step 2: 跑它并确认红** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/board-view.test.ts -t "frontier reads drift"` FAIL，实际值为 implement 字面
- [ ] **Step 3: 换用 `lineStateAt`** — checkable: `phase-spec` 的 `closed: ledger.lineClosed(specType, specType)` → `closed: ledger.lineStateAt(specType, specType, specPath) === "closed"`；`plan` 的 `closed: ledger.lineClosed("plan", "plan")` → `closed: ledger.lineStateAt("plan", "plan", planPath) === "closed"`；`branch` 面与 wave 面一字不动
- [ ] **Step 4: 孪生绿（正常推进不破）** — checkable: 同一夹具里让该 spec 的 review 闭合（零 finding）后，frontier 前进到 plan 的波形（`next:` 为 implement 字面）；既有 board 用例全绿
- [ ] **Step 5: 两个例外仍零变** — checkable: 无 spec / 无 plan 的板面路径（`specPath === null` / `planPath === null`）行为不变——`lineStateAt` 传 `null` doc 时退化与 `lineClosed` 等价
- [ ] **Step 6: 跑套件 + 提交** — checkable: `board-view.test.ts` / `cli.test.ts` 全绿；`pnpm run precommit` 绿；`git commit -m "fix(cdd-engine): the board frontier reads drift on the doc lines"`
- [ ] **Step 7: 本波验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0

#### Acceptance

- drifted spec + plan 存在 ⇒ 板面 `next:` 为 spec 的 review lead、`reason:` 为 `doc-drift`；改动前必红。**该红→绿证据取自本任务的提交**（`board-view.test.ts` 的 `frontier reads drift` 用例）。
- 该 review 闭合后 frontier 前进到 plan 的波形（回归 pin）。
- 无 spec / 无 plan / wave / branch 四个面的既有行为零变。
- **本任务调度的两个 `closed` 单元格是过渡态**：Step 3 改的两行（`lineClosed` → `lineStateAt(...) === "closed"`）由 Task 6 删除，判定随整体搬入 `session/pipeline.ts` 的 `PipelineFrontier`（spec §10）——只看最终树的读者找不到这两行，是因为行为**迁移**了而不是消失了；`board-view.ts` 里 `^\s+(closed|active):` 归零是 Task 6 的验收，不是本任务的。
- §9 的消费面变化由 Task 4 的发布条目承载（同一份 `.changeset/p24-fix-identity-and-reason-row.md` 的第 ④ 件）：本任务只核对/订正那一句，**不**另开 changelog 条目。
- `env -u AI_AGENT pnpm run validate` 退出码 0。

#### DependsOn

1, 2, 3, 4

### Task 6: pipeline frontier 归 session 平面（§10）

#### Objective

把「哪条线在下」的判定从板面搬到 session 平面：新增 `PipelineFrontier` 承担选面（逐面只读该线自己的 `lineStateAt` / `lineRoute` / ready batch + `waveLineRoute`），板面退化为纯渲染、不再判定任何东西。**本任务是纯重构，不是 bug 修复**——落地后板面的 `next:` / `reason:` 字节**零变**，故：

- **必红证据只有结构缺失面**：五个成员（`#pipeline` / `#exitRoute` / `#lastEnteredIndex` / `#waveFrontierKey` / `pipelineFacts` 的逐面 `closed`·`active`）今日在 `face/board-view.ts` 里，搬走后必须一个不剩（Step 1 记录今日命中，Step 5 的 `grep` 为空）。
- **parity 是回归 pin，不是必红断言**：板面 `next:` == frontier 那条线自己的 `peekNext()` 渲染值，**只在「该 frontier 面自己有一个可渲染帧」时成立**（有 active hop，或 drift 重开的闭合线）；未进入 / 进入但无 active hop / 全闭合三种状态里，那条线的 `peekNext()` 为 `null` 而板面渲的是前一面或该面自己的 exit，parity 在那里**无定义**（Step 2 逐条在册）。
- **不得再声称「parity 今日必红」**：实测今日树（`c2626b68`）上 parity 已逐字节成立，`board-view.test.ts:1589`（h）与 `:1612`（h2）早已钉住；把一次重构包装成 bug 修复会让必红验收本身失去意义。

#### Files

- Create: `packages/cdd-engine/src-next/session/pipeline.ts`（`PipelineFrontier`；constructor injection `new PipelineFrontier(ledger)`，与 `Ledger` / `Lifecycle` 同形——**不是**只有一个静态方法的类，故不需要 `// biome-ignore lint/complexity/noStaticOnlyClass`）
- Modify: `packages/cdd-engine/src-next/session/next.ts:132-133`（`PipelineFaceState.closed` 的 docstring 与既有 pin 相反——它写「a face holding no open work (an empty wave segment) is closed」，而 `board-view.test.ts:1494-1507`（k2）钉的是「无 task 段的 plan **不是**闭合的 wave 面」：frontier 停在该面并渲该面自己的 exit。同笔改为 `waves.length > 0 && every wave done`，空波形段不闭合）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（删逐面 `closed` / `active` 单元格、`#waveFrontierKey`、`#pipeline`、`#exitRoute`、`#lastEnteredIndex`；`pipelineFacts` 收缩为该节点的**事实**面——`ledger` + frontier 的入参 `{ specType, specPath, planPath, planGraph }`；`BoardNext.#hopOf` 改调 `new PipelineFrontier(facts.ledger).next(facts.input)`。**散文改写面八处同义**——凡是声称「面序判定 / derivation 归板面或装配面」的注释一律随搬移改写：① 文件头 `:12` ② 文件头 `:17-19`（「the pipeline traversal (the four face-order rules) lives on the assembly face (`face/cli.ts`)」——**正是本任务要推翻的那句**）③ 文件头 `:21` ④ `BoardPipelineFacts` 的 docstring `:110-113`（「Pure facts: the traversal and the derivation belong to the assembly face」——本任务改写的就是它所描述的接口，故这处与 `:12` / `:21` 同等必须）⑤ `pipelineFacts` 的 docstring `:696-700`（「the traversal (the four face-order rules) and the ONE hop derivation belong to the assembly face」）⑥ `#planGraph`（docstring `:769-772` · 方法体 `:773-782`）：它不再是「the ONE guarded plan read shared by the wave frontier key and the wave segment」——frontier key 的推演已搬进 session 平面，这条受守卫的读只服务板面自己的波形显示，并以 `planGraph` 一格注入 frontier ⑦ `BoardNext` 的类 docstring `:844-853`（「the retired router `walk`'s four face-order rules, re-homed at the board's CONSTRUCTION face … `BoardNext` decides the next pipeline step」）改为「`BoardNext` 只接 `PipelineFrontier.next(...)` 的结果、不再判定」⑧ `#pipeline` 的 docstring `:890-902` 随 `#pipeline` 一并删除（其四条规则先在 Step 4 逐条写死）。`#pipelineFacts` 仍存在，但只回事实，判定在 session 平面）
- Modify: `packages/cdd-engine/src-next/face/cli.ts:483-487`（同一句措辞——「the pipeline OBSERVATION comes from the board face, the four face-order rules and the ONE derivation from this assembly point (`BoardNext`) — the board itself holds no ledger for the next line and judges nothing」：判定已归 session 平面，装配点只接结果。本任务必须把这个文件列入范围，否则搬走后它成为新的错读源）
- Modify: `packages/cdd-engine/src-next/session/next.ts:33-34`（模块头「the pipeline traversal itself belongs to the board's assembly face — no second resolver」改为「belongs to the session plane's `PipelineFrontier`」——本任务本来就改这个文件（`:132-133`），漏改这句就在新家的同一个文件里留一句指向旧家的话）
- Test: `packages/cdd-engine/src-next/session/__tests__/pipeline.test.ts`（新增：四条面序规则直接打 `PipelineFrontier`）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（既有断言**零改动**即证零字节；**仅**分节横幅散文 `:1389-1392` 改写——「the traversal's four face-order rules land at the board's construction face」→ 「in the session plane's `PipelineFrontier`」，零个 `expect` 改动）
- Test: `packages/cdd-engine/src-next/session/__tests__/next.test.ts:339-343`（分节横幅散文同笔改写——「the pipeline traversal's four face-order rules live at the board's assembly face (`BoardNext` in `face/cli.ts`, pinned by the board suite)」→ session 平面；同样零个 `expect` 改动。这条横幅就在本任务已改的同一模块套件里，不改则同一文件内自相矛盾）

#### Consumes

- `Ledger#lineStateAt(key, type, doc)` · `lineRoute(key, type)` · `waveLineRoute(waveKey)` · `closedWaves()`（既有）
- `PIPELINE_FACES`（`session/next.ts:124`）· `PIPELINE_NEXT`（`:107`）· `PhaseFaceKey`（`:119`）· `PipelineFaceState`（`:131`）——四个都住 `session/next.ts`；`session/faces.ts` **不导出**这四者（它导出 `TargetType` / `DispatchPhase` / `ReviewLead` / `AuditFace` / `RouteTarget:50` / `targetFaces` / `TargetFace`），从前一处导入 `tsc` 直接失败
- `Route`（`session/next.ts:46`）· `RouteTarget`（`session/faces.ts:50`）——`next` 返回类型里的 `{ route, target }` 就由这两者拼成
- `NextStepRouter.handoff(key: PipelineKey)`（`session/next.ts:414`，既有——入参是 `PipelineKey`，不是「face 对象」）
- `TaskGraph`（`session/graph.ts:83`）——**只作注入类型**：`session/pipeline.ts` 内零 `readFileSync`、零第二条 plan 读

#### Produces

- `PipelineFrontierInput = { specType: TargetType | null; specPath: string | null; planPath: string | null; planGraph: TaskGraph | null }` —— frontier 的全部入参。`planGraph` 是**注入**的受守卫 plan 读（板面侧 `#planGraph`，`board-view.ts:769-782`），frontier 自己不读 plan。
- `new PipelineFrontier(ledger).next(input: PipelineFrontierInput): { face: PhaseFaceKey | null; route: Route; target: RouteTarget | null }` —— `face` 是**该 `route` 自己所属的面**：面序规则①（frontier 有 active hop）与②（已进入但无 active hop ⇒ 该面自己的 exit）下，`face` 就是 **frontier 面**（第一个未闭合面）；规则③（未进入）与④（全闭合）是两条 **exchange** 规则，`route` 属**锚面**而非 frontier 面，故 `face` 为 **`null`**，锚面可由 `target` 反推（exchange 规则下 `target` 就是锚面的 render target）。`face` 的静态类型是 `PhaseFaceKey | null`（`"phase-spec" / "plan" / "wave" / "branch"`，`session/next.ts:119`），**不是** `PipelineEntry`（那是 pipeline-next 的行联合 `{ref} / {literal} / {done}`，`:95`）——写错返回点直接 `tsc` 失败。
- 消费者两处，都不在板面的 hop 组装上：① Step 3 的四个 `pipeline.test.ts` 用例（唯一直接断言 `{ face, route, target }` 的地方）② `BoardNext.#hopOf` 只吃 `{ route, target }` 两格（`face` 今天不用；`#hopOf` 也不消费 `{ face }`）。**本任务的 `#hopOf` 仍填 cell**——那描述的是本任务落地时的树；Task 7 随后把这段 cell 装配整体搬进 session 平面（胶囊与板面共用一个装配）。既有的 parity pin（`board-view.test.ts:1589` / `:1612`）比的是板面 `next:` 与该线 `Lifecycle#peekNext()` 的 hop（那是 **line frontier**），**不碰** `PipelineFrontier`——不要写成「板面与 parity pin 共用」。
- `face` 在两条 exchange 规则下为 `null`，这一点由 Step 3 的 ③④ 两例直接断言（未经板面），避免后人把它当必填而造一个不存在的 frontier 面。
- 无新导出自 `face/board-view.ts`：板面只剩事实面与渲染。

#### Steps

- [ ] **Step 1: 结构必红在册** — checkable: `grep -nE "#pipeline\b|#exitRoute\b|#lastEnteredIndex\b|#waveFrontierKey\b" packages/cdd-engine/src-next/face/board-view.ts` 今日 10 行命中：四处定义（`:762` `#waveFrontierKey` · `:903` `#pipeline` · `:930` `#exitRoute` · `:937` `#lastEnteredIndex`）加六个调用点（`:719` · `:872` · `:907` · `:911` · `:918` · `:920`）；`grep -c "pipelineFacts" packages/cdd-engine/src-next/face/board-view.ts` 今日为 5（文件头 `:12` · `:21` · 方法 docstring `:693` · 方法定义 `:701` · `BoardNext.of` 调用 `:860`，这一面**保留**但只回事实）。`\b` 不能省：`#pipelineFacts` 保留，裸 `#pipeline` 子串会把它一并命中共使 grep 永不空。另一条 `grep -cE "^\s+(closed|active):" …/board-view.ts` 今日为 8（四面 × 两格）。把这几条命令与今日计数记入本轮报告——这是本任务唯一的必红证据（结构缺失），不是行为断言
- [ ] **Step 2: 划清 parity 的适用面（写进用例注释与 Acceptance）** — checkable: parity 只在两种状态断言等式——① frontier 面有 active hop（板面渲该 hop；既有 pin `board-view.test.ts:1589`（h））② drift 重开的闭合线（`:1612`（h2））。三种状态**排除在 parity 之外**、各由既有字节断言覆盖：③ frontier 未进入（无 target）⇒ 板面取**前一面**的 exit（`board-view.test.ts:712`：spec 收口、无 plan ⇒ `route to /kairos:cdd-plan skill`），而 spec 线的 `peekNext()` 为 `null`；④ frontier 进入但无 active hop（k2 的空波形段，`:1494-1507`）⇒ 板面渲该面自己的 exit；⑤ 全闭合 ⇒ 板面渲最后进入面的 exit（`:1572`（k）），branch 线的 `peekNext()` 为 `null`。把 ③④⑤ 写成等式就是造一条恒红的 pin——不许
- [ ] **Step 3: 写面序用例（红：类不存在）** — checkable: `pipeline.test.ts` 四条面序规则各一例直接打 `PipelineFrontier`（frontier-active / frontier-no-active / not-entered / all-closed），只断言 `{ face, route, target }`，不经板面；今日 import 失败即红
- [ ] **Step 4: 建 `session/pipeline.ts`** — checkable: 逐面事实与四条面序规则同笔搬入——`phase-spec` / `plan` / `branch` 用 `lineStateAt(...) === "closed"` + `lineRoute(...)`；`wave` 的 `closed` 写成「`graph.report(ledger.closedWaves()).waves` 非空且每波全 done」（空波形段**不**闭合，与 k2 同判据），wave key 取 `graph.frontier(ledger.closedWaves())`（ready batch，不得自走），路由取 `waveLineRoute(waveKey)`；`planGraph === null` 时 wave 面 closed 为假、active 为 null、target 仍由 `planPath` 给（与今日同）。四条面序规则与 `#exitRoute` / `#lastEnteredIndex` 逐条语义保持——**四条一条不许省**。权威原文就是 `face/board-view.ts:890-902` 的 `#pipeline` docstring（Step 5 删 `#pipeline` 时这份文字随之消失，故必须先在计划里写死，逐条照抄）：
  1. **frontier 有 active hop**：`the FRONTIER face (first not-closed) with an active C5 hop renders that hop (the in-flight work — review / fix / implement / next-wave)`；
  2. **已进入但无 active hop**：`the frontier has no active hop but IS entered (a target is present) → its OWN pipeline exit entry`（k2 的空波形段用例 `board-view.test.ts:1494-1507` 钉的就是这一条——它常被误当成规则④）；
  3. **未进入（无 target）**：`the frontier is NOT entered (no target — an absent doc) → the transition INTO it: the PRECEDING entered face's exit entry (a just-closed spec hands off to cdd-plan, never the absent plan's cdd-dev); none preceding → the FIRST face's exit entry`——**兜底那一半同属契约**：无前置已进入面时取第一个面的 exit，代码即 `:918` 的 `Math.max(0, BoardNext.#lastEnteredIndex(states.slice(0, frontierIndex)))`（`#lastEnteredIndex` 返回 `-1` 时 `Math.max` 把锚点钳到 0）；
  4. **全闭合**：`every face closed → the LAST entered face's exit entry (the terminus — cdd-close for a phase slug)`。
  文件内**零**第二份 drift 或闭合判定、零 plan 读
- [ ] **Step 5: 板面退化** — checkable:
  - **零门（只此两条，且都点名文件）**：`grep -E "#pipeline\b|#exitRoute\b|#lastEnteredIndex\b|#waveFrontierKey\b" packages/cdd-engine/src-next/face/board-view.ts` 输出为空；`grep -cE "^\s+(closed|active):" packages/cdd-engine/src-next/face/board-view.ts` 为 `0`（今日 8）。
  - **观察项（不得为 0，不是零门）**：`grep -c "pipelineFacts" packages/cdd-engine/src-next/face/board-view.ts` 今日 5，搬移后仍须**非 0**——`pipelineFacts` 保留为事实面；若把它当零门写，就因为它仍在而恒红。
  - `pipelineFacts` 只回事实（`ledger` + `PipelineFrontierInput`）；`BoardNext.#hopOf` 吃 `PipelineFrontier.next(...)` 的 `{ route, target }`。
  - **散文改写清单（逐处改写，不得只改 `:12` / `:21`）**：`face/board-view.ts` 六处——`:12` · `:17-19` · `:21` · `:110-113` · `:696-700` · `:844-853`，加上随 `#pipeline` 删除的 `:890-902`；`face/cli.ts:483-487`；`session/next.ts:33-34`；两处测试分节横幅 `board-view.test.ts:1389-1392` 与 `next.test.ts:339-343`。验收是「搬走后不再有任何一处声称面序判定 / derivation 归板面、`BoardNext` 或装配面」——逐处复读 `assembly face` / `CONSTRUCTION face` 的关键词命中，人工核对，**不作零门**（该词在别处仍有正当用法）。
  - **「既有断言零改动」只绑断言**：`board-view.test.ts` / `next.test.ts` 的 `expect` 零改动；上面两处横幅是注释散文，改写它们不算改断言，也不许顺势改任何一个 `expect`。
- [ ] **Step 6: 零字节回归** — checkable: `board-view.test.ts` / `cli.test.ts` 既有断言**一行不改**仍全绿（`next:` / `reason:` 字节零变——这是纯重构的正确证据）
- [ ] **Step 7: 面序用例转绿** — checkable: Step 3 的四例绿，且 `pipeline.test.ts` 不含「拿板面输出与 frontier 线输出比」的等式（parity 归 Step 2 的两条既有 pin）
- [ ] **Step 8: 跑套件 + 提交** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next` 全绿；`pnpm run precommit` 绿；`git commit -m "refactor(cdd-engine): the pipeline frontier moves into the session plane"`
- [ ] **Step 9: 本波验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0

#### Acceptance

- **结构（本任务唯一的必红面）**：`face/board-view.ts` 内不再存在 frontier 判定代码——`#pipeline` / `#exitRoute` / `#lastEnteredIndex` / `#waveFrontierKey` 的定义与调用全无（`grep -E "#pipeline\b|#exitRoute\b|#lastEnteredIndex\b|#waveFrontierKey\b" packages/cdd-engine/src-next/face/board-view.ts` 为空）；逐面 `closed`·`active` 单元格全无（`grep -cE "^\s+(closed|active):" packages/cdd-engine/src-next/face/board-view.ts` 为 0——**必须点名该文件**：全仓计数永不可能是 0，`session/pipeline.ts` 会建同一批逐面单元格）。`pipelineFacts` 仅存为事实面，其全仓出现次数是**观察项**（不得为 0），不是零门；今日命中数见 Step 1。
- **散文不叛变**：搬走后 `face/board-view.ts` / `face/cli.ts` / `session/next.ts` 与两处测试横幅里，不再有任何一处声称面序判定或 hop derivation 归板面 / `BoardNext` / 装配面（Step 5 的逐处清单）。
- **行为零变（纯重构）**：`board-view.test.ts` / `cli.test.ts` 既有断言零改动全绿，`next:` / `reason:` 字节零变。「既有断言零改动」只绑**断言**（`expect`）——两处分节横幅是注释散文，随搬移改写，不改任何断言。
- **面序规则的新家自证**：四条规则各有 `pipeline.test.ts` 用例直接打 `PipelineFrontier`（新家自己的用例，不是旧的板面断言）。
- **parity 仅为回归 pin、且有在册的适用范围**：只在「frontier 面自己有可渲染帧」时断言板面 `next:` == 该线 `peekNext()` 的渲染值（`board-view.test.ts:1589` / `:1612` 两条既有 pin）；未进入（`:712`）/ 空波形段（`:1494-1507`）/ 全闭合（`:1572`）三种状态显式排除——不写等式、不改既有字节断言。
- **判据单点**：`session/pipeline.ts` 内零第二份 drift / 闭合判定、零 plan 读（`planGraph` 注入）；`PipelineFaceState.closed` 的 docstring 与 k2 同判据（空波形段不闭合）；`#planGraph` 的「ONE guarded plan read」旧说法已随 docstring 改写消失。
- `face` 的类型是 `PhaseFaceKey | null`（`session/next.ts:119`），不是 `PipelineEntry`（`:95`）；`null` 只出现在两条 exchange 规则（未进入 / 全闭合），此时锚面由 `target` 反推；`tsc` 绿。
- C5 决策表、drift 判据、pending-fix、写回、派发动词、round 记账零改动（不做越序拒绝）。
- `env -u AI_AGENT pnpm run validate` 退出码 0。

#### DependsOn

5

### Task 7: 每轮的下一跳读 pipeline frontier（§11 · 渲染源统一）

#### Objective

让胶囊与板面渲染**同一个对象**，并把**装出**该对象的那段装配一并收进 session 平面：`PipelineFrontier` 旁多一个与 `next` 并列的装配入口（下文按 `hopOf` 称呼），吃 `next(input)` 的 `{ route, target }` 与端口，产出 `Ledger#nextHopOf` 的 `NextHop`；胶囊的 `#capsuleLines` 与板面 `BoardNext` 都调**这一个装配**，各自只负责渲染。做完之后「板面与胶囊不可能不同」是**结构事实**（一个装配、两个渲染面），不是约定——但该等式只对**板面确实跑 pipeline frontier 的节点**成立：`BoardNext.of` 对 `docType === "overall"` 返回 `null`（`face/board-view.ts:807`），`overall` 条目渲的是程序板，永不跑 frontier，故它**没有板面半边**；退化节点（`specPath === null`）按 Step 5 落到 line 侧，同样不在等式里。

**本任务按 spec v0.26 §11 定案 ¶2 与 §7「渲染源统一」行重写**：只换 route（把 `#routeNext(frame)` 的产物塞给 frontier）**不算完成**——`BoardNext#hopOf` 填的 cell（target → `type` / `key` / `doc` / `briefDrift` / `docClassOf`）全部取自**被派发的那个 frame**，只换路由会让 frontier 的 target（例如 spec）与本轮的 cell（例如 wave）打架：`BoardNext#hopOf`（`face/board-view.ts:818-836`）今日填前五格、`Lifecycle#hopOf`（`session/run.ts:841`）按帧条件补第六格，而 `Ledger#nextHopOf` 的入参是这六格（`type` / `key` / `doc` / `nextLineOpen` / `briefDrift` / `docClassOf`，`session/ledger.ts:1227-1236`），并用 `input.key` / `input.doc` / `input.type` 判 drift（`:1241-1269`）。只喂 `{ route, target }` 得到的是「frontier 的路由 + frame 的 cell」——旗舰夹具（波形轮完而 spec 面是 frontier）上 `next:` 可能对上而 `reason:` 与板面相反，正是 spec v0.22 关掉的缺陷。

**身份槽有三个主人**：`#identityState` 的槽键是 `input.specType ?? "phase-spec"`（`session/pipeline.ts:131`），而 `SlugIndex#identityDoc`（`infra/slug-index.ts:174`，声明条件是 `#isIdentity`「非 null 且非 plan」，`:336-338`）返回任何**非 plan** 的声明文档——故 `phase-spec` / `single-spec` / `overall` 同占这一格。`type` 同时喂收口判据、活动 hop 与 render target 三路（`:133-135`），三段代码对三个主人是同一段。所以「退化键」必须在**每个主人**上各验一次：只在 `phase-spec` 节点上验过的键，不能声称对 `single-spec` / `overall` 成立。板面半边只有跑 frontier 的节点有：`BoardNext.of` 对 `docType === "overall"` 返回 `null`（`face/board-view.ts:807`），故 `overall` 只断言胶囊侧。

**六格同源，一格不留第二份判据**：前五格由 frontier 的 `target` 派生，第六格 `nextLineOpen` 不是 frame 的事实，而是**账本自己的 branch 线事实**（今日只在胶囊路径上按帧条件填：`session/run.ts:851` 的 `frame.type === "wave" ? this.#branchLineOpen() : undefined`，判据在 `:872-877`），板面装配今日不填这一格（`face/board-view.ts:821-835`）。搬移后六格由共享装配一次取齐，第六格的判据只此一份（`Lifecycle#branchLineOpen` 改为转调）。**该格在共享装配上是惰性的，任何一面的字节都不因它而变**：`NextStepRouter#entryOf` 只在 `handoff` 之后才读它——`session/next.ts:384` 的 `if (route.kind === "handoff") return route.entry;` 提前返回，`:387` 的 `input.nextLineOpen === false` 才被读到；而 wave 目标的 route 只来自 `#waveState.active` = `ledger.waveLineRoute(waveKey)`（next-wave / review / fix / null，**从不为 `done`**，`session/ledger.ts:956-989`）或 `#exitRoute` 的 `handoff`（`session/pipeline.ts:203-205`）。故第六格并入共享装配的理由只有一条——两面同源、判据一份；它**不构成独立工作项**：不另立验收条、**不进 changeset 清单**，证据就是 Acceptance 那条 parity（同一 `PipelineFrontierInput` 下两面的 `NextHop` 全等，含 `reason`）。`run.test.ts:1249` / `:1269` 的 P21 §4.2 字节保持原值（该状态在 pipeline frontier 上由面序给出 branch 面 exit 的 `handoff`，与本格无关）。

#### Files

- Modify: `packages/cdd-engine/src-next/session/pipeline.ts`（**装配入口**与 `PipelineFrontier` 同居、与 `next` 并列：`next(input)` 一次 → `{ route, target }` → 六格装配 → `Ledger#nextHopOf` → `NextHop`；`next` 的签名与四条面序规则一字不动，本文件仍**零文件读**、零第二份 drift / 闭合判定。第六格 `nextLineOpen` 由装配内部取：`input.planPath === null ? undefined : ledger.reviewGate("branch", planPath, "branch").kind === "open" || ledger.lineRoute("branch", "branch") !== null`——今日 `Lifecycle#branchLineOpen` 的同一个组合（`session/run.ts:872-877`），搬来只为让两面同源，不新开判据；该格惰性（见 Objective），并入不产生任何一面的字节变化，也不单独进 changeset）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`:448` 的 `#capsuleLines` 输入源改为该装配；`Lifecycle` opts 收四格输入 + `docClassOf` 端口；`#routeNext`（`:818`）仍只服务 `#markTerminal`（`:435`）；`#hopOf`（`:841`）**保留**给 `peekNext`，并正名为 **line frontier** 的装配；`#branchLineOpen`（`:872-877`）的判据随第六格搬入会话平面，此处改为转调那一份——**不得**留第二份 `reviewGate` / `lineRoute` 组合）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`BoardNext.#hopOf` 的 cell 装配整段移出——`:818-836` 退化为「取 `pipelineFacts` → 交会话平面装配 → 返回 `NextHop`」；`BoardNext` 的类 docstring `:791-800` 与 `BoardPipelineFacts` 的 docstring `:103-109` 同笔改写为「只交事实，不再填任何 cell」——`:108` 的 `Ledger#nextHopOf` 字样是 Acceptance 那条零门的第三处命中，不改它门永远绿不了）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（场景从文档索引收齐四格 + 受守卫读：`:741` 的 argv `planPath`（`planPath: scene.planPath`）在索引知道同 slug plan 时由索引值替代；胶囊路径的 `planGraph` 由装配层注入；`:483-486` 的装配散文与 `:1080-1082` 的 `state` 事实同笔说准）
- Modify: `.changeset/p24-fix-identity-and-reason-row.md`（补本相位**第五件**消费面事实，口径按 Round-13 实测（HEAD `e47de014`）：胶囊的 `next:` / `reason:` 在 pipeline frontier 与 line frontier 分歧处会变、改后与板面同值——身份槽的三个主人在「收口 + 同 slug plan」上落在同一形状（`phase-spec` 由 `route to /…:cdd-plan skill` / `closed-line`、`overall` 由 `done` / `closed-line`、`single-spec` 由 `done` / `face-closed` 改印后继 plan 面的 `review --type plan --plan …` / `reason: task-open`）。**不得**写 `overall` 的 `face-closed → closed-line`：收口而无 plan 的 `overall` 今日两条装配都渲 `next: done` / `reason: closed-line`，**字节零变**（那是回归 pin，不是可见变化）；且 `overall` 条目在板面没有 pipeline 板（`BoardNext.of` 返回 `null`，`face/board-view.ts:807`），故也不得为它声明 capsule ⇄ board 同值。第六格并入共享装配不产生任何一面的字节变化（惰性论证见 Objective），故条目里**不得**声称板面因此改输出；同一份条目、同一级别，不另开第二条）
- Test: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（必红 parity：`next:` **与** `reason:` 两半；`:1566` 的「the capsule never promises the wave brief drift」标题按 §11 改写——该夹具的 review 在胶囊渲染前重绑了 brief，故**帧**不再 drift，不是「胶囊不承诺」）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（板面侧同一状态的 `next:` / `reason:` 对照；既有断言零改动）
- Test: `packages/cdd-engine/src-next/face/__tests__/capsule.test.ts` · `face.test.ts`（因「pipeline frontier next ≠ 本线 C5 next」而变的整块快照逐条重锚）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（**装配层 E2E**——cli 层真跑一轮，断言胶囊的 `next:` / `reason:` 与同一 slug 上 `cdd board` 的输出一致；`run.test.ts` 的用例都自带 opts 直接驱动 `Lifecycle`，装配层漏填四格时它们不会红）

#### Consumes

- `new PipelineFrontier(ledger).next(input: PipelineFrontierInput)` → `{ face, route, target }`（Task 6 落地，`session/pipeline.ts:73` / `:79`；**构造注入**，不是 `next(ledger, …)`——与本计划 Task 6 的 Produces 同一形式）
- `Ledger#nextHopOf`（既有，`session/ledger.ts:1227-1270`）· `Ledger#briefDrifted`（Task 3，`:1015`）
- `Ledger#reviewGate(type, doc, type)` / `Ledger#lineRoute(type, type)`（既有，今日 `Lifecycle#branchLineOpen` 的同一个组合，`session/run.ts:872-877`）——第六格 `nextLineOpen` 的来路，装配内部一处判定
- `BoardView.docClassOf(root, candidate)`（既有端口，今日经 `Lifecycle` opts 注入，`face/cli.ts:745`）
- `SlugIndex#identityDoc(slug)` / `#planOf(slug)`（既有，`infra/slug-index.ts:174` / `:182`）——`specType` / `specPath` / 索引侧 `planPath` 三格的来路
- `BoardView.#planGraph(planPath)`（既有受守卫读，`face/board-view.ts:720-728`）——第四格 `planGraph` 的来路

#### Produces

- 会话平面新增与 `next` 并列的装配入口（同一 `PipelineFrontier` 实例）：`hopOf(input: PipelineFrontierInput, ports): NextHop`——内部一次 `next(input)` 得 `{ route, target }`，再按 target 填 `type` / `key` / `doc` / `briefDrift` 四格、注入 `docClassOf` 端口，并**自己从账本取第六格 `nextLineOpen`**（`input.planPath` + branch 面的 `reviewGate` / `lineRoute` 组合），交既有 `Ledger#nextHopOf`（第六格在该装配上惰性——见 Objective——并入只为两面一份判据）。它是**唯一**装配：板面与胶囊都吃它的返回值，谁也拿不到「自己填的 cell」。
- `Lifecycle` opts 增四格：`specType?: TargetType | null` · `specPath?: string | null` · `planPath`（既有键：plan / branch 线沿用 argv 值，`--spec` 线由索引填）· `planGraph?: TaskGraph | null`；四格全缺省即裸 slug，退化键见 Step 5（`specPath === null`）。
- 行为变化（消费面可见）：pipeline frontier 与 line frontier 分歧处，胶囊的 `next:` 换成 frontier 那条线的 hop（例如收口的 spec 轮印后继面的 `review --type plan --plan …`），`reason:` 与板面同值；`overall` 身份节点同样在册（它不退化，走共享装配，见 Step 5 ⑤），但该条目**没有板面半边**（`BoardNext.of` 对 `docType === "overall"` 返回 `null`，`face/board-view.ts:807`），故「与板面同值」只对板面跑 frontier 的节点成立。**这是本任务唯一的消费面字节变化**：第六格并入共享装配不改变任何一面的输出（`entryOf` 在 `handoff` 之后才读该格，wave 目标的 route 从不为 `done`），故 `run.test.ts:1249` / `:1269` 的既有字节保持原值。
- 无新导出自 `face/board-view.ts`：`BoardNext` 只剩「取 facts → 交会话平面装配 → 返回 `NextHop`」，板面不填任何 cell。

#### Steps

- [ ] **Step 1: 写必红 parity（`next:` 与 `reason:` 两半）** — checkable: 构造「spec 未闭（或未审）+ 波形轮到点」，断言胶囊的 `next:` 行**等于**板面同一状态的 `next:`，**且**两条 `reason:` 行的 token 同值（`const tokenOf = (line: string) => line.trim().replace(/^reason:\s+/, "");`，前缀各按自己的家：胶囊走站表、板面走布局字面）；今日 FAIL（胶囊印本线字面）。**`reason:` 这一半是这条断言的重心**：`next:` 只由 `{ route, target }` 渲染，`reason:` 才是 cell 派生（`doc` / `type` / `briefDrift` → 路由侧 drift / gate）的下游——只钉 `next:` 会放过「路由换了、cell 仍取本轮 frame」的实现，那正是 §11 缺口段点名的打架。
- [ ] **Step 1b: 装配层 E2E（四格真的从索引收齐了吗）** — checkable: 在 `face/__tests__/cli.test.ts` 加一条 cli 层用例——同一 slug 下有 conforming 的 phase-spec **与**同 slug plan，spec 行已闭而后继 plan 未起步；真跑 `cdd review --type phase-spec --spec <spec>`，再跑 `cdd board --spec <spec> --plan <plan>`，断言胶囊的 `next:` 与板面的 `next:` 逐字同值、且两条 `reason:` 的 token 同值（归一化去前缀后比）。**这条才是 §11 的机制保护**：`run.test.ts` 的用例用自己递给 `Lifecycle` 的 opts 驱动，装配层（`face/cli.ts` 的场景 + `Lifecycle` opts）忘了从索引补格时它们全绿。该用例在改动前**必红**（`--spec` 轮的 `scene.planPath` 为 null，胶囊停在退化路径），改后转绿。若 cli 夹具无法把 spec 行做闭，则退而断言装配层本身：对 `Cli` 的一个最小场景断言交付给 `Lifecycle` 的 `specType` / `specPath` / `planPath` / `planGraph` 四格均有值（并写明这是退而求次的等价证据）。
- [ ] **Step 2: 四格来路逐格指名** — checkable: `specType` 取 `index.identityDoc(slug)` 的声明词（既有读法 `BoardView.#lineWordOf`）、`specPath` 取该 entry 的路径、`planPath` 取 `index.planOf(slug)`（plan / branch 线沿用 argv 的 `scene.planPath`；**`--spec` 轮 argv 为 null**——`scene.planPath` 由 `parsed.paths.plan` 派生，`face/cli.ts:993-994`（`specPath` 在 `:995-996`）· `:741`——而索引知道同 slug plan，故**必须**由索引值补上，否则 spec 轮 frontier 看不到 plan 面，胶囊会印本线 exit，§11 的实案（spec 行印 `cdd-plan`、板面印 `cdd-close`）原样留下）、`planGraph` 取装配层那次既有受守卫读（`face/board-view.ts:720-728`：搬走后它要么提成 `face` 侧 seam 把 `TaskGraph | null` 交给装配层，要么在组合根 `face/cli.ts` 的场景里读出后注入——两条都可，frontier 自己**不许**读文件）。**不得复用生命周期的事实**：`--spec` 轮 `Lifecycle#planPath` 是 argv 派生（值即 `scene.planPath`，为 null），`scene.state` 在非 wave 面是 `EMPTY_RUN_STATE` 而非 `TaskGraph`（`face/cli.ts:1080-1082`）——两处都不够四格。
- [ ] **Step 3: 装配搬迁（六格同源）** — checkable: `face/board-view.ts:818-836` 的 cell 装配整段移入会话平面，取值规则与今日逐字节同一：`type: target?.type ?? "branch"` · `key: target?.type === "wave" ? target.id : (target?.type ?? "branch")` · `doc: target === null ? null : target.type === "branch" ? (target.plan ?? null) : target.id` · `briefDrift: target?.type === "wave" ? ledger.briefDrifted(String(target.id)) : undefined` · `docClassOf`（面侧端口，注入而非导入）· **第六格 `nextLineOpen`**：`planPath === null ? undefined : ledger.reviewGate("branch", planPath, "branch").kind === "open" || ledger.lineRoute("branch", "branch") !== null`——今日只在胶囊路径上按帧条件有值（`run.ts:851` 转调 `#branchLineOpen` `:872-877`），判据只留一份（`Lifecycle#branchLineOpen` 改为转调）。**该格惰性**：`entryOf` 在 `handoff` 之后才读它（`session/next.ts:384` 先于 `:387`），wave 目标的 route 从不为 `done`（`session/pipeline.ts:155-163` · `session/ledger.ts:956-989`），故它不改变任何一面的字节，**不另立验收条、不占 Step 7 任何一行、不进 changeset 清单**；它的证据是三段、不靠一条「会红」的断言：① 反证惰性——`session/next.ts:384` 的 `if (route.kind === "handoff") return route.entry;` 先于 `:387` 读该格，故 wave 路由不会走到 `done`；② 该格**不进 changeset**（无消费面变化）；③ **变异不变量**——临时把装配里对 `nextLineOpen` 的取值换成 `undefined` 后跑 `pnpm -C packages/cdd-engine exec vitest run src-next`，既有测试仍全绿，随后还原：这是「同值即惰性」的不变量，**不是** must-be-red 断言（同一装配下两面读同一个值，本就不存在一面红一面绿的状态）。不得把惰性写成「站位会翻转」。`BoardNext.#hopOf` 只剩一行调用。**两个调用点都换成同一装配**：板面 `board-view.ts:818` 与胶囊路径 `run.ts:448`。这一步之后「板面与胶囊取同一 `NextHop`」由结构保证；渲染面代码一行不改。
- [ ] **Step 4: 接线胶囊** — checkable: `#capsuleLines` 只吃装配产出的 `NextHop`；`#routeNext`（`session/run.ts:818`）仍只服务 `#markTerminal`（`:435`）；`peekNext`（`:400-408`）仍走 `#hopOf`（`:841`，line frontier）——两条路径各司其职，`peekNext` 不进本任务的装配（它不参与 board ⇄ capsule 的 parity）。
- [ ] **Step 5: 退化键是 `specPath === null`（不看 `planPath`）** — checkable: ①**裸 slug**（`specPath === null && planPath === null`，故 `specType` / `planGraph` 亦为 null）胶囊与今日逐字节相同（有测试）；②**只带 plan 的节点**（`specPath === null && planPath !== null`：phase 没有 spec 文档的常规形状，`session/__tests__/run.test.ts` 有 14 个 Lifecycle 夹具只传 `planPath`——`:1141` · `:1175` · `:1202` · `:1221` · `:1263` · `:1365` · `:1430` · `:1469` · `:1505` · `:1543` · `:1602` · `:1631` · `:1664` · `:1689`）**同样退化**——实测该输入今日的 `PipelineFrontier.next({specType:null, specPath:null, planPath:<可读 plan>, planGraph:null})` 得 `{face: null, route: handoff(kairos:cdd-plan), target: null}`（`#identityState` 在 `specPath === null` 时既不判闭合也不给 target，`session/pipeline.ts:130-140`，故规则 3 的兜底把锚点钳到 0），照 `specPath === null && planPath === null` 判就会让这类常规节点每轮印 `route to /…:cdd-plan skill`（一个已过的阶段），故必须有一条测试钉住它与今日逐字节相同；③**有 spec 无 plan**（`specPath !== null && planPath === null`）**不**退化——frontier 交出 plan 的 transition（spec 未闭时停在 spec 面、规则 2 取它的 exit；spec 已闭时规则 3 以它为锚，两者同得 `PIPELINE_NEXT[specType]` 的 `route to /…:cdd-plan skill`），也要一例；④**不得**把退化键得比 `specPath === null` 更宽（例如再并上 `specType === null`）或掺进 `planPath`：那会把 ③ 误判成裸 slug，正好掩盖 Step 2 的补格；⑤**身份槽的另外两个主人 `overall` / `single-spec` 也在册**——`#identityState` 的槽键是 `input.specType ?? "phase-spec"`（`session/pipeline.ts:131`），`SlugIndex#identityDoc` 又对任何非 plan 的声明文档返回路径（`infra/slug-index.ts:174` · `#isIdentity` `:336-338`），故 `cdd … --type overall --spec <path>` / `--type single-spec --spec <path>` 上 `specType` 是两个声明词、`specPath` 均非 null，**两者都不退化**，照旧走共享装配——收口判据 / 活动 hop / render target 三路（`:133-135`）取值均不得退化。已测（Round-13 评审在 HEAD `e47de014` 上用一次性 Lifecycle 探针实测，`PipelineFrontier.next` + `Ledger#nextHopOf` + 真 `RouteRenderer`；探针已删）：(a) 收口的 `overall` 节点带同 slug plan ⇒ line frontier 渲 `next: done` / `reason: closed-line`，pipeline frontier 渲 `next: review --type plan --plan docs/kairos/plans/x-plan.md` / `reason: task-open`——`next:` 从终止词换成可派发的 review 字面，这是 §11 期望的行为；(b) 收口的 `overall` 节点无 plan ⇒ 两条装配今日都已是 `next: done` / `reason: closed-line`，**字节零变**——这是回归 pin，不是红→绿用例（不得再写 `face-closed`：`face-closed` 是收口的 `single-spec`（terminal 类）在两条路径上的取值）；(c) 未收口的 `overall` 节点 ⇒ `review`，与 `phase-spec` 同形。故本步要一条 `overall` 用例只钉**胶囊侧**：(a) 的 `next:` / `reason:` 与其身份槽（`#identityState`，`session/pipeline.ts:131-135`）交出的后继一致（`review --type plan …` / `task-open`），(b) 的 `reason:` 为 `closed-line`（回归 pin）；**不得**断言「胶囊与板面值全等」——`overall` 的板面半边不存在（`BoardNext.of` 对 `docType === "overall"` 返回 `null`，`face/board-view.ts:807`），一张程序板上没有 `next:` 可比。**身份槽第三个主人 `single-spec` 同笔在册**：它走同一段代码（`#identityState` 的 `type` 键，`:131-135`），(a) 形状下 pipeline frontier 同样给后继 plan 面的 review 字面、line frontier 给 `done` / `face-closed`，收口无 plan 时两条路径都是 `done` / `face-closed`（回归 pin）；至少要有一条断言覆盖该主人的 (a) 形状，若判为同一代码路径而省，须在用例注释里写明。`PIPELINE_NEXT.overall` 是 `done`（`session/next.ts:109`）不构成豁免——收口节点的 route 由面序给出后继面，与本表无关。
- [ ] **Step 6: 散文正名** — checkable: 逐处改写，术语按 spec v0.25 / v0.26 分开（**pipeline frontier** = `PipelineFrontier` 的装配产物，胶囊与板面共用；**line frontier** = `Lifecycle#peekNext`，frame-keyed 的单线视角）：`session/run.ts:396`（`peekNext` docstring「the SAME `NextHop` object the board and the CLI rejection message read」→ 它是 line frontier，板面共用的那个不是它）· `:838`（`#hopOf` 的「the frontier face reads the same object the board and the gate read」→ 同一处分）· `:257-259`（`CapsuleFace.emit` 的「`hop` is the ONE `NextHop` object the round renders」，句子横跨三行 → 指明取 pipeline frontier 的装配）· `StepResult.capsuleLines`（`:283-285`，「rendered at the interaction point」补一句「取自 pipeline frontier 的装配」）· `run.test.ts:1566` 的标题（见 Files）· `face/board-view.ts:791-800`（`BoardNext` 类 docstring 的「the board's next-hop assembly face」→ 装配已归会话平面，它只交 facts）· `:811-817`（`#hopOf` 的 docstring：Step 3 收尾后它不再填任何 cell，那句「this face fills facts only」随之改准——`:813` 的 `Ledger#nextHopOf` 同时是该零门的第二处命中）· `:103-109`（`BoardPipelineFacts` 的 docstring——`:108` 的「the ONE derivation is `NextStepRouter#nextHop` reached through `Ledger#nextHopOf`」是 Acceptance 零门的**第三处**命中，改写为「只交事实、装配在会话平面」，否则那条门永远绿不了）· `session/pipeline.ts:1-30` 的模块头（补一句装配在此、胶囊与板面同吃）· **三处把多面写成同一对象的既有陈述**（§11 之后胶囊不再经本线的 `nextHopOf` 调用）：`session/ledger.ts:1211-1213`（「Every read face（capsule · CLI rejection · board · the lifecycle frontier）comes through here, so the four faces share one object by construction」→ 改为「line-hop 装配服务本线 frontier 与 CLI 拒绝；pipeline 装配服务胶囊与板面」）· `face/gate.ts:134-142`（`lineHop` 的「the SAME derivation / the capsule, the board and the lifecycle frontier read」，句子横跨 `:134-135` → 同一处分）· `face/cli.ts:757-761`（「The generic refusal renders the SAME `NextHop` the capsule / board / frontier read」→ 改为「胶囊与板面渲染同一个 `NextHop`；本拒绝消息渲染的是本线装配的产物」）。验收是「搬走后不再有任何一处把两个 frontier 混称」——**逐处复读 + 三条零门**（今日各 1 命中：`ledger.ts:1213` · `gate.ts:135` · `cli.ts:757`；每条的匹配词都落在**单行**内，不跨行）：`grep -rn "share one object by construction" packages/cdd-engine/src-next` 为 0 · `grep -rn "the board and the lifecycle frontier read" packages/cdd-engine/src-next` 为 0 · `grep -rn "the SAME .NextHop. the capsule" packages/cdd-engine/src-next` 为 0；三条命令与其退出码记入本步报告。
- [ ] **Step 7: 重锚受影响快照 + 登记字节变化** — checkable: 跑套件，**逐条登记**每个因「pipeline frontier next ≠ 本线 next」而变的整块快照（文件:行 + 变化前后），不许只说「若干处」；Step 1b 新增的 cli 层用例与 Step 1 的 parity 用例一并全绿。第六格**不占本步任何一行**：它惰性（Step 3 的论证），既无快照变化也无单独的「同值」验收；`run.test.ts:1249` / `:1269` 保持原值本属既有断言零改动。§7 的 137/15 分类只描述**非胶囊**读者，胶囊侧这份清单是本步的产物（与 Task 2 Step 7 的 15 处不重叠：那 15 处是追加 `reason:` 元素，本步是 `next:` 取值变化）。
- [ ] **Step 8: changeset 第五件 + 提交** — checkable: `.changeset/p24-fix-identity-and-reason-row.md` 补**第五件**（Task 4 已写定前四件；本步只加这一条，口径是胶囊在分歧处的 `next:` / `reason:` 变化及其与板面同值（身份槽三主人在「收口 + 同 slug plan」上的同一形状，实测值见 Files 的本条目说明）、**不含** `overall` 收口无 plan 的「`face-closed → closed-line`」（该形状字节零变，`overall` 在板面也无半边）；**不得**写「第六格让板面输出改变」——该格惰性，不单独成条；不另开文件、不改级别）；**本步不是最后的 owner**：§12 的板面汇总单元（第 ⑥ 件）与该条目末句「`cdd board` output is unchanged」的改写归 **Task 8**（最后落地），故本步不得预写 §12，也不得把那句写成定论；**并重校该条目的引导句**：开头的粗体总结不得带硬计数——今日落地的那句仍是 `Three consumer-visible face changes, carried by one release entry.`（`:6-7`），与在册四项已不符，本步一并改为无编号列举（清单可数，不靠散文记账）；新增第五件后仍不得同入数字；`pnpm -C packages/cdd-engine exec vitest run src-next` 全绿；`pnpm run precommit` 绿；`git commit -m "feat(cdd-engine): the round capsule renders the pipeline frontier's hop"`——**类型是 `feat` 而不是 `refactor`**：`next:` / `reason:` 是消费面可见输出，收口轮的字面会变，把它写成重构会让那条发行说明失去依据。
- [ ] **Step 9: 本波验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0

#### Acceptance

- **必红 parity（两半）**：spec 未闭而行完一轮波形时，胶囊 `next:` == 板面 `next:`（改动前必红），**且**两条 `reason:` 行的 token 同值——`reason:` 这一半才是「cell 也换了」的证据，只钉 `next:` 会放过仍读本轮 frame 的实现。**第六格 `nextLineOpen` 的证据不是一条会红的断言，而是三段不变量**：同一条 parity 钉住「同一 `PipelineFrontierInput` 下两面取到的 `NextHop` 全等（含 `reason`）」（板面 `board-view.ts:818` · 胶囊 `run.ts:448`），而该格**惰性**由「装配搬迁」Step 3 的三段证据在册——③ 反证：`NextStepRouter#entryOf` 在 `handoff` 之后提前返回（`session/next.ts:384` 先于 `:387`），wave 目标的 route 只来自 `#waveState.active` = `ledger.waveLineRoute(...)` 或 `#exitRoute` 的 `handoff`（`session/pipeline.ts:155-163` · `:203-205` · `session/ledger.ts:956-989`），从不为 `done`；② 该格不进 changeset（无消费面变化）；③ **变异不变量**：临时把装配里对该格的取值换成 `undefined` 后跑套件、既有测试仍全绿（跑后还原）——所以它不改变任何一面的字节、不另立验收、不进 changeset 清单，也不得被要求造一条能红的断言（同一装配两面读同一个值，本就没有一面红一面绿的状态）。
- **一个装配、两个渲染面（结构事实）**：cell 装配（target → `type` / `key` / `doc` / `briefDrift` / `docClassOf`，**加第六格 `nextLineOpen`**）只剩会话平面一份——`grep -n "nextHopOf\|briefDrifted" packages/cdd-engine/src-next/face/board-view.ts` 搬后为空（今日 `nextHopOf` **四处**：`:108` 的 `BoardPipelineFacts` docstring · `:796` 的 `BoardNext` 类 docstring（`Ledger#nextHopOf →`）· `:813` 的 `#hopOf` docstring · `:821` 的调用；`briefDrifted` 一处：`:833`——故 Step 6 的改写列必须含 `:103-109`、`:791-800` 与 `:811-817`，且重写 `:791-800` 时必须一并删掉那行 `Ledger#nextHopOf →`，否则该门永远绿不了；门本身不改）；板面（`:818`）与胶囊（`run.ts:448`）两个调用点都吃同一入口的返回值（`overall` 条目在板面没有这一半，见 Objective），故「板面与胶囊不可能不同」对板面跑 frontier 的节点由结构保证，不是约定。
- **四格来路在册、且有装配层证据**：`specType` / `specPath` 取自文档索引，`planPath` 在索引知道同 slug plan 时由索引值替代 argv（`--spec` 轮的 argv 值为 null，`face/cli.ts:993-996` · `:741`），`planGraph` 取自既有受守卫读（`board-view.ts:720-728`）并由装配层注入；`session/pipeline.ts` 仍零文件读。**证据在 `face/__tests__/cli.test.ts`（Step 1b）**：cli 层真跑一轮，胶囊与同一 slug 的 `cdd board` 逐字同值——只测 `Lifecycle` 等于测了测试自己递进去的事实，测不到装配层有没有收齐四格。
- **退化键是 `specPath === null`，且在身份槽的每个主人上各验一次**：裸 slug 与**只带 plan 的节点**（phase 无 spec 文档的常规形状）都与今日逐字节相同，各有测试；**有 spec 无 plan**（`specPath !== null && planPath === null`）**不**退化——frontier 停在 spec 面、交出 plan 的 transition，也有测试；**`overall` / `single-spec` 两个身份节点同样不退化**——`specType` 就是身份槽的键（`session/pipeline.ts:131`）而 `identityDoc` 返回任何非 plan 的声明文档（`infra/slug-index.ts:174`），故 `--type overall` / `--type single-spec` 带 `--spec <path>` 就走共享装配，收口判据 / 活动 hop / render target 三路均有值；「收口 + 同 slug plan」时 pipeline frontier 给后继 plan 面的 review 字面且 `reason: task-open`（line frontier 分别是 `done` / `closed-line` 与 `done` / `face-closed`），各有断言。**`overall` 只断言胶囊侧**（它的板面是程序板，`BoardNext.of` 返回 `null`，`face/board-view.ts:807`）；收口而无 plan 的 `overall` 是 `done` / `closed-line` 的回归 pin（字节零变）、`single-spec` 则是 `done` / `face-closed`。判据**不看** `planPath`，也不得并上 `specType === null` 之类的更宽条件。
- **散文正名在册，且有三条零门**：`run.ts:257-259` / `:396` / `:838` / `:283-285`、`run.test.ts:1566` 的标题、`board-view.ts:791-800` / `:811-817` / `:103-109`、`pipeline.ts` 模块头全部按 pipeline frontier / line frontier 分开说；**`session/ledger.ts:1211-1213` · `face/gate.ts:134-142` · `face/cli.ts:757-761`** 三处已改（line-hop 装配服务本线 frontier 与 CLI 拒绝，pipeline 装配服务胶囊与板面）；`peekNext` 不被称作「胶囊与板面共用的那个 frontier」。三条零门（今日各 1 命中）：`grep -rn "share one object by construction" packages/cdd-engine/src-next` · `grep -rn "the board and the lifecycle frontier read" packages/cdd-engine/src-next` · `grep -rn "the SAME .NextHop. the capsule" packages/cdd-engine/src-next` 均为 0，命令与退出码记入报告。
- `next:` 仍是可执行字面；`reason:` 仍取 `NEXT_HOP_REASON` 同一 source。
- spec 缺席（裸 slug 与只带 plan 的节点）行为零变，各有测试；有 spec 无 plan 不退化（frontier 停在 spec 面并交出 plan 的 transition），`overall` 与 `single-spec` 两个身份节点也走共享装配但**只断言胶囊侧**（`overall` 的板面是程序板：`BoardNext.of` 返回 `null`，`face/board-view.ts:807`），各有测试。
- 受影响快照的重锚逐条在册（胶囊侧另立清单，不混 §7 的 137/15）。
- 消费面第五件事实进 `.changeset/p24-fix-identity-and-reason-row.md`（唯一一份条目、级别不变；含身份槽三主人 `phase-spec` / `single-spec` / `overall` 在「收口 + 同 slug plan」上的同一形状，**不**含 `overall` 收口无 plan 的 `face-closed → closed-line`——该形状字节零变），且该条目的**引导句不带硬计数**（见 Task 4 Step 4），提交类型为 `feat`；**本任务不是最后一件**：§12 的板面汇总单元（第 ⑥ 件）与该条目末句「`cdd board` output is unchanged」的改写归 **Task 8**（最后落地），本任务不得预写 §12、也不得把那句当成定论。
- C5 / drift / pending-fix / 写回 / 派发动词零改动；不做越序拒绝。
- `env -u AI_AGENT pnpm run validate` 退出码 0。

#### DependsOn

6

### Task 8: 板面汇总单元按「成功总量 + 失败尝试」重排（§12）

#### Objective

让汇总单元说得清「有几轮成功、失败发生在哪一轮、那次失败有没有恢复」。两类令牌**形状不同**故不会混淆：

- **成功令牌**：**该 verb 的成功数为 0 时不渲**——纯失败 verb 只出 ✗ 令牌，既有 pin `review 1 ✗` / `implement 1 ✗` 因此字节零变（若渲 `review 0/1 ✓` 便与它们直接冲突）。**该 verb 无失败记录**时渲 `{verb} {成功数}{末条成功记录的 attempt 后缀} ✓{+N}`；**该 verb 有失败记录**时改渲 `{verb} {成功数}/{尝试总数} ✓{+N}`——**比率形不带 attempt 后缀**（spec v0.30 §12：后缀与分母互斥，否则同 cycle 重派会渲成 `fix 1/2a2 ✓`）。该令牌的 `+N` **只累加成功记录的 carrier**：今日 `+N` 是「同一判决 run 的求和」，重分组后一个 verb 变成「一枚成功令牌 + N 枚失败令牌」，不写明分账，实现就会把失败记录的 findings 也加进成功令牌而**双计**（那些 findings 已在各自 ✗ 令牌上）。
- **失败令牌**：每条失败记录一枚，`{verb} {cycle}{attempt > 1 ? aN : ""} ✗{+N}`；**恢复只认同一 cycle 中紧邻的下一次 attempt**——`attempt + 1` 那条记录存在且 `verdict.targetAction` 为真时改为 `{verb} {cycle}{aN} ✗→✓{+N}`（已恢复；`+N` 照带，且**只算该条记录自己的 carrier**——该轮的 findings 不因后来成功而消失，漏掉它会让已恢复轮的 findings 从板上消失）。读法钉死三边：**不是**「该 cycle 之后的任意成功」，**不是**「后续 cycle 的成功」，也**不是**「同一 cycle 内任意更大的 attempt 成功」——`a1 败 · a2 败 · a3 胜` 只让 `a2` 那枚带箭头，`a1` 是历史失败（渲 `fix 1 ✗`）。

比率只在**该 verb 有失败**时出现，`→✓` 只在该失败记录**同 cycle 内紧邻的下一次 attempt** 成功时出现，✓ 令牌只在该 verb **成功数 > 0** 时出现。地基四条一字不动（裁决符不可省 · findings 只以 `+N` 出现 · 区间形永不出现 · `a1` 永不出现）；对 P22 §5.3 的三条修订（异常面逐条展开 · 令牌形增比率与 cycle · 旧示例字面 `fix 1 ✗ · fix 1a2 ✓` 作废）按 spec §12 逐条落地。

**令牌顺序**（spec v0.31 §12，钉死）：外层按 `VERB_ORDER`（`implement` → `review` → `branch-review` → `fix`，其余 verb 追加在后，`face/board-view.ts:58`）；内层同一 verb 先成功令牌、后失败令牌，失败令牌按存储时间序（`rounds` 的存储序，同今日 `#judgementRuns` 的读序），**不聚到行尾**——点名样例 `review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓`。

#### Files

- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`summaryCell` `:271-278` · `#summaryToken` `:291-297` · `#judgementRuns` `:328-345`：分组粒度由「verb × 判决连续段」改为「verb 的成功面 / 失败面」，令牌形按 Objective 的三条规则重写——成功数为 0 的 verb 不渲 ✓ 令牌 · 有失败时渲比率且不带后缀 · 失败逐条带 cycle 与自己的 `+N`，且**同一 cycle 中紧邻的下一次 attempt** 成功时改 `✗→✓{+N}`；`summaryCell` 与 `#summaryToken` 的**令牌形规则句**改指 P24 §12，`#summaryToken` 的**首句**（`One aggregated token of a verb × judgement run`）在重分组后不再成立，同笔改写并指 P24 §12——而 `#summaryToken` 的 `+N` 规则句（「The `+N` suffix counts the run's graded FINDINGS …」，`:292-296`）**逐字保留**，它的 `spec §5.3` 引用（`:294`）不动；`#judgementRuns` 的 docstring 同笔改为「成功面按 verb 合并、异常面逐条」并改指 P24 §12——**该 static 保留、不改名**（spec v0.32 §12「陈旧散文登记」）；`board-view.test.ts:1268` 的用例标题同笔改写——「(d) a re-dispatch carries its attempt superscript and attempt 1 never renders `a1`」在新形下不准（`fix 1/2 ✓ · fix 1 ✗→✓` 无上标；上标只出现在失败令牌 `attempt > 1` 上，或无失败的成功令牌上））
- Modify: `.changeset/p24-fix-identity-and-reason-row.md`（**末句改写**：现末句「`cdd board` output is unchanged — the board was already the assembly's reader.」在 §12 落地后即为假；§12 并入**同一份**条目，不另开第二条、不改级别）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（既有 pin `:1274` 重锚 + 新增实况用例 + Step 4 的七条项（六条新用例 + ⑦ 的既有 pin 枚举）；**无失败行**的既有断言 `:1218` · `:1225` · `:1242` · `:1263` 与**纯失败行**的 `:1228` · `:1246` 一行不改，`:1268` 的标题改写）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`:7356-7357` 的 `implement 1 ✗` 是**纯失败行** pin，一行不改）

#### Consumes

- `RoundRecord`（`op` / `cycle` / `attempt` / `verdict.targetAction` · `carrierPath`）· `attemptSuffix`（既有，语义不动）· `#findingsCountOf`（既有，`+N` 算法不变）· `VERB_ORDER` · `JUDGEMENT_MARKERS`

#### Produces

- 无新导出；行为变化：`summaryCell` 的两类令牌——成功令牌（**成功数为 0 时不渲**；无失败时计数 + 末条成功记录的 `attemptSuffix`，有失败时 `{成功}/{尝试总数}` 且不带后缀；`+N` **只累加成功记录的 carrier**）· 失败令牌（逐条 cycle + **只算自己那条记录的** `+N`，同一 cycle 紧邻的下一次 attempt 成功时改 `✗→✓{+N}`）。

#### Steps

- [ ] **Step 1: 写实况用例（必红）** — checkable: 构造实况数据——13 条 review 成功（其中一条的 carrier 带 74 条 findings）+ fix 的 14 次尝试（cycle 1–11 各一次成功 · cycle 12 attempt 1 失败 · cycle 12 attempt 2 成功 · cycle 13 成功），断言 `BoardView.summaryCell(records)` 为 `review 13 ✓+74 · fix 13/14 ✓ · fix 12 ✗→✓`；今日渲 `review 13 ✓+74 · fix 11 ✓ · fix 1 ✗ · fix 2 ✓` ⇒ FAIL
- [ ] **Step 2: 重锚既有 pin** — checkable: `board-view.test.ts:1274` 的 `fix 1 ✗ · fix 1a2 ✓` 改为 `fix 1/2 ✓ · fix 1 ✗→✓`（同 cycle 重派：`attempt` 1 败、`attempt` 2 胜；失败记录的 `attempt === 1` 故失败令牌无 `aN`；该记录无 carrier ⇒ 无 `+N`）
- [ ] **Step 3: 实现两类令牌** — checkable: 每个 verb 的**成功**记录合并为**一枚**成功令牌——**成功数为 0 时不渲该令牌**（纯失败 verb 只有 ✗ 令牌）；有失败记录时渲 `{成功}/{尝试总数}` 且**不带** `attemptSuffix`，无失败时渲计数 + 末条成功记录的 `attemptSuffix`；该令牌的 `+N` **只累加成功记录的 carrier**（`#findingsCountOf` 逐条求和）。**失败**记录**逐条**一枚失败令牌 `{verb} {cycle}{attemptSuffix} ✗{+N}`（`{verb}` 前缀与成功令牌同形），其 `+N` **只算该条记录自己的 carrier**；**当且仅当同一 cycle 中紧邻的下一次 attempt（`attempt + 1`）存在且 `verdict.targetAction` 为真**时把裁决符换成 `✗→✓`（`+N` 照带；另一 cycle 的成功不算恢复，同一 cycle 内更远的 attempt 也不算——`a1 败 · a2 败 · a3 胜` 只让 `a2` 带箭头）；令牌序 = 按 `VERB_ORDER`（+ 额外 verb）逐 verb 输出「成功令牌 + 该 verb 的失败令牌」，失败令牌按存储时间序；`#findingsCountOf` 的单条算法不变；`attemptSuffix` 不动（故 `a1` 仍不出现）；令牌里没有区间，区间形仍不可能
- [ ] **Step 4: 七条边界 / 顺序用例**（前六条是新用例，⑦ 是既有 pin 的逐条枚举）— checkable:
  ① **纯失败 verb（成功数为 0）独立用例**：`BoardView.summaryCell([record({ verdict: { treeClean: false, targetAction: false } })])` 为 `review 1 ✗`，且整行**不含** `review 0/1 ✓`、不含任何 `✓` 令牌；同形再断言一枚 `implement 1 ✗`（`record({ op: "implement", … })`）——这是本任务为「成功数为 0」立的独立 pin，`cli.test.ts:7356-7357` 的既有实况是它的装配层对照
  ② **无后续成功的失败**渲 `fix N ✗`、**不带** `→✓`（防把 `→✓` 硬编码）；同条再补一枚 **`attempt >= 2` 且从未重派**的失败记录 ⇒ `fix 1a2 ✗`——此前没有任何用例带 `attempt >= 2` 的失败记录，实现把上标从 ✗ 令牌上丢掉也能全绿
  ③ **恢复只认同一 cycle 中紧邻的下一次 attempt**：跨 cycle 的成功不算恢复——同一 verb 在 cycle N 失败、cycle N+1 成功（`attempt` 各自为 1）⇒ 失败令牌仍为 `{verb} N ✗`，整行**不出现** `→✓`；同一 cycle 内 `a1 败 · a2 败 · a3 胜` ⇒ 整行**逐字**为 `fix 1/3 ✓ · fix 1 ✗ · fix 1a2 ✗→✓`——只有紧邻成功的那枚（`a2`）带箭头，更早的 `a1` 是历史失败；与 ② 一起把这条读法钉死（它是全任务唯一有两种读法的地方）
  ④ **恢复形带 `+N`，且 `+N` 分账**：四条成功记录**都不带 carrier**、cycle 5 的 `attempt` 1 记录 carrier 带 2 条 findings、同 cycle `attempt` 2 成功 ⇒ 断言**整行**逐字为 `fix 4/5 ✓ · fix 5 ✗→✓+2`——`+N` 不因后来成功而消失，且只落在那枚失败令牌上；实现若把失败记录的 2 也累进成功令牌，整行变成 `fix 4/5 ✓+2 · …` 即红（只断言失败侧 `fix 5 ✗→✓+2` 会放过这个双计）
  ⑤ **verb 隔离与比率边界**：同一行里成功 verb 的素形不受另一 verb 的失败影响（`review 13 ✓+74` 保持无分母）；同一 verb 全成功哪怕末条是 `a2` 也只渲计数 + `attemptSuffix`，**绝不**渲 `n/m`
  ⑥ **令牌顺序**：构造 review 4 次尝试（3 成功；cycle 3 的 `attempt` 1 败、`attempt` 2 胜）+ fix 3 次成功，断言整行**逐字**为 `review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓`——失败令牌紧跟其 verb 的成功令牌、不聚到行尾
  ⑦ **既有 pin 逐条在册**：spec §12 证据第 3 条点名的四处**按行性拆开**——**无失败行** `board-view.test.ts:1218`（`review 10 ✓`）· `:1225`（`review 1 ✓`）· `:1242`（`review 3 ✓+2`）· `:1263`（`review 1 ✓+2`）与**纯失败行** `:1228` · `:1246`（`review 1 ✗`）· `cli.test.ts:7356-7357`（`implement 1 ✗`）——断言**一行不改**仍绿；纯失败行之所以零变，是「成功数为 0 不渲 ✓」在起作用，不是运气
- [ ] **Step 5: changeset 末句改写** — checkable: `.changeset/p24-fix-identity-and-reason-row.md` 的末句「`cdd board` output is unchanged — the board was already the assembly's reader.」是 Task 7 那段（§11）的收尾句，**删除且不换成任何全板声言**——同一份条目已写了 `reason:` 行、`doc-drift` 与 frontier 搬家，任何「其余行逐字节不变」的全板断言在它自己身上就是假的；§12 另起一段、口径限定在**汇总单元**，用作者裁定的英文原句（该文件是 shipped 的英文面，不得照抄中文）：「Within the board's summary cell, rows that carry no failed attempt stay byte-identical; rows with one show an ok/attempts ratio and a recovery marker.」；§12 并入**同一份**条目（不另开第二条、级别仍 minor）；门两条——`grep -c "output is unchanged" .changeset/p24-fix-identity-and-reason-row.md` 为 0，且 `grep -c "byte-identical on every other row" .changeset/p24-fix-identity-and-reason-row.md` 为 0（条目里任何 `byte-identical` 字样都必须由 `within the board's summary cell` 限定，不得残留全板声言）；并**复核引导句**（Task 7 Step 8 已改成无编号列举）仍不带硬计数——本条目被多个任务触，最后一步落笔时再数一次
- [ ] **Step 6: 跑套件 + 提交** — checkable: `board-view.test.ts` / `cli.test.ts` 全绿；`pnpm run precommit` 绿；`git commit -m "fix(cdd-engine): the board summary names the cycle that failed"`
- [ ] **Step 7: 本波验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0

#### Acceptance

- 有失败尝试的行渲 `{verb} {成功}/{尝试} ✓ · {verb} {cycle} ✗→✓{+N?}`（实况 `review 13 ✓+74 · fix 13/14 ✓ · fix 12 ✗→✓`，同 cycle 重派 `fix 1/2 ✓ · fix 1 ✗→✓`），改动前必红。
- **成功数为 0 的 verb 不渲 ✓ 令牌**：纯失败行 `review 1 ✗` / `implement 1 ✗` 字节零变，既有 pin `board-view.test.ts:1228` · `:1246` · `cli.test.ts:7356-7357` 一行不改仍绿，并另有一条**独立**用例钉住该形（断言整行不含 `review 0/1 ✓`、不含任何 ✓ 令牌）。
- **比率形不带 attempt 后缀**（`fix 1/2 ✓`，不是 `fix 1/2a2 ✓`）；后缀只在**无失败**的合并令牌上出现——两形各有断言（Step 3 的实现与 Step 4 ⑤）。
- **比率只在**该 verb 有失败记录时出现；**无失败记录**的行**字节零变**，spec 点名的**无失败行** pin（`board-view.test.ts:1218` · `:1225` · `:1242` · `:1263`）一行不改仍绿。
- **失败且无同 cycle 后续成功**渲 `{verb} {cycle}{aN?} ✗`、**不带** `→✓`；**`attempt >= 2` 且从未重派的失败记录仍带自己的上标**（`fix 1a2 ✗`，Step 4 ②）；**跨 cycle 的成功不算恢复**（cycle N 败 + cycle N+1 胜 ⇒ 仍是 `N ✗`）；**同一 cycle 内只认紧邻的下一次 attempt**（`a1 败 · a2 败 · a3 胜` ⇒ `fix 1/3 ✓ · fix 1 ✗ · fix 1a2 ✗→✓`，更早那次是历史失败）——四例各有断言（Step 4 ②③）。**恢复形 `✗→✓` 照带 `+N`，且 `+N` 分账**：成功令牌只累加成功记录的 carrier、每枚失败令牌只算自己那条记录的 carrier（Step 4 ④ 的整行 `fix 4/5 ✓ · fix 5 ✗→✓+2`——把失败记录的 2 计进成功令牌即变红）。某 verb 的失败**不改**另一 verb 的令牌（Step 4 ⑤）。
- **令牌顺序钉死**：外层 `VERB_ORDER`、内层先成功令牌后失败令牌、失败按时间序、**不聚到行尾**；点名样例 `review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓` 整行逐字断言（Step 4 ⑥）。
- 区间形（`review 1–10 ✓`）与 `a1` 两个既有门仍红，既有断言不改：`board-view.test.ts:1219`（`not.toContain("1–10")`）与 `:1277`（`not.toContain("a1")`）。**`:1277` 只覆盖一条全成功的单记录**，故「失败令牌与比率形都不出现 `a1`」这一保证**不靠它**，而靠 Step 2 与 Step 4 的逐字等值（`fix 1/3 ✓ · fix 1 ✗ · fix 1a2 ✗→✓`、`fix 4/5 ✓ · fix 5 ✗→✓+2` 里都没有 `a1`）——新增用例必须保留这些整串断言，不得弱化成 `toContain`。
- **docstring 收窄**：**仅** `summaryCell` / `#summaryToken` 的两类句子改指 P24 §12——`summaryCell` 的**令牌形规则句**，与 `#summaryToken` 的**首句**（`One aggregated token of a verb × judgement run`，重分组后不再成立）及其令牌形句；`#summaryToken` 的 `+N` 规则句（`:292-296`，含 `:294` 的 `spec §5.3` 引用）**保留逐字原样**，它讲的是 `+N` 的算法，P22 §5.3 对它仍是正确依据；`#judgementRuns` 的 docstring 同笔改写（「成功面按 verb 合并、异常面逐条」）并改指 P24 §12——**该 static 保留、不改名**。`board-view.ts` 里其余 `spec §5.3` 引用（`:24` 文件头 · `:60` 字形 · `:294` 的 `+N` 规则 · `:370` 在飞单元 · `:406` / `:511` / `:530` 排版 · `:612` 波单元 · `:655` doc 单元）承载排版、字形与 `+N` 规则，P22 §5.3 对它们仍是正确依据，**一处不得触碰**；`:330`（`#judgementRuns` docstring 内的引用）**不在**该列——spec §12 的陈旧散文登记明写该 docstring 同笔改写，故它的 `spec §5.3` 引用随 docstring 移向 P24 §12。
- **陈旧散文在册**：`board-view.test.ts:1268` 的标题按新形改写（新形无上标；上标只在失败令牌 `attempt > 1` 或无失败的成功令牌上出现），零个 `expect` 改动。
- **`spec §5.3` 引用处数的口径登记**：spec §7「汇总单元」行写「仅 `summaryCell` / `#summaryToken` 两处改指 P24 §12、`#judgementRuns` 同笔改写」，spec §12「落空面」写「三处 docstring 改指 P24 §12」——两处计数不同。本计划取**三处都改指 P24 §12**：`#judgementRuns` 的旧 docstring 正是「contiguous verdict runs … `✗ → ✓` pair renders as two tokens」这条被 §12 作废的规则，改指是唯一不留下第二份陈旧契约的读法；spec 自身的两处计数差异按已知不一致记录，本计划不改 spec。
- **changeset**：`.changeset/p24-fix-identity-and-reason-row.md` 的末句「`cdd board` output is unchanged」**已删除且未被任何全板声言替代**；§12 另起一段、口径限定在**汇总单元**（英文原句见 Step 5：无失败尝试的行字节不变，有失败尝试的行改渲比率与恢复标记），并入同一份条目（唯一一份、级别仍 minor）。门两条：`grep -c "output is unchanged"` 为 0，且该条目**不得**残留全板逐字节声言（`grep -c "byte-identical on every other row"` 为 0；其余 `byte-identical` 字样一律由 `within the board's summary cell` 限定）。
- `env -u AI_AGENT pnpm run validate` 退出码 0。

#### DependsOn

7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-04 | 初稿：四任务三波——W1 {1,2}（写回白名单 + 预览同源 ‖ reason 行渲染 + 16 锚 + 散文）、W2 {3}（wave `briefDrift` 注入）、W3 {4}（README + changeset + 全量验收） | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-04） |
| v0.2 | 2026-11-04 | 第 1 轮评审回填（无结构变更，内容面）：① 红证据换面——`StepResult.route` 是 C5 路由（`session/run.ts:436-447` → `#routeNext` `:813-818`），不读文档、今日即 `{kind:"done"}`，故 Task 1 的必红断言改盯 drift-aware 的胶囊 `next:` 行（doc 线四型 + branch 线），`route` 降级为辅助事实 ② 夹具落回 ledger 读取基准——`fixture()` 只建 `<repo>/.kairos/cdd`，文档须写在该基准下并传绝对路径（先 `mkdirSync(…, { recursive: true })`），用例 A/B/C 与 branch 用例同一接线，并写明惰性夹具的自查信号 ③ `briefDrift` cell 落到 `Ledger#nextHopOf` 的内联入参（`session/ledger.ts:1219-1229` · drift cell `:1230-1233`），`NextHopInput` 与 `#reasonOf` 一行不动 ④ 删掉 wave 的 `onExitSide` 豁免死分支（不可达），Step 4 记可达性论证 ⑤ 补三条缺 owner 的验收：branch 线用例与 wave 收口回归 pin（Task 1）、胶囊 ⇄ 板面 `reason:` token pin（Task 2 Step 6）⑥ 13 处 `toEqual` 快照以 `toEqual(` 行在册（五处 stale 行号改正；`:213` 对应 spec §7 的 emit 行 `:212`）⑦ `#reasonOf` 取值表替换「`nextLineOpen` 决定 token」的假断言 ⑧ 陈旧散文九处删掉 `run.test.ts` ⑨ `face.test.ts:109` 标签改正 ⑩ 补 EOF 换行 | Oscaner M. · Claude（kairos:cdd-plan [P24] 第 1 轮评审回填 · 2026-11-04） |
| v0.3 | 2026-11-04 | 第 2 轮评审回填（无结构变更，内容面）：① **用例 C 的断言改对**——BLOCKED 的 fix 后 `lineRoute` 仍是 `{kind:"fix"}`（非 exit 侧），故 `docReopens` 为假、frontier 给的是该 fix 的**重试面**：断言改为①`peekNext().frame.phase === "fix"` ②`reviewedDocRevisionOf(type, type)!.doc_hash` 仍等于 review 1 绑定的内容哈希（直读账本的负控）；Review Focus 与 Acceptance 同步改写 ② **板面注入加闸**——`briefDrift` 只在 `facts.report.wave.active !== null` 时取值（soft-capped / 不可读轮的 `#exitRoute` `handoff` 属 exit 侧，不设闸就会把待用户裁定改写为 review，与 `waveLinePhase` 为 null 的门分叉）；Step 4 的可达性论证重写，新增 Step 7 负控与 Acceptance 条 ③ **四份 diagram 源归 Task 4**（`next-loop` / `journey` 中英四句 + 源重生成 HTML 四份，`next-loop-twin` / `diagrams.guard` 两处 pin 验绿；Archify 不可用则报 BLOCKED；Task 4 Step 3） ④ **陈旧散文 9→11 处**（`face/capsule.ts:100` 的「line LAST … the output's close」与 `capsule.test.ts:467` 的 describe 标题），扫描词面扩为末行 / `LAST` / `close` / `last line` / `trailing` / 唯一站锚 / 唯一站词 ⑤ **胶囊 ⇄ 板面 token pin 先归一化再比**（`tokenOf` 去 `^reason:\s+`），禁以 `toContain` 弱化 ⑥ Task 1 Step 9 去掉「无注释指明两处同改」的逃生口（共用一处判定为硬要求），并补删 `face/preview.ts:147-151` 的「the branch line binds none」（自 P21 起即错）⑦ Constraints 的 spec 版本引用同步 v0.9 | Oscaner M. · Claude（kairos:cdd-plan [P24] 第 2 轮评审回填 · 2026-11-04） |
| v0.4 | 2026-11-04 | 编排器裁定对齐 spec v0.10：**删掉板面注入的 `active !== null` 闸**（三处：Constraint「wave 面禁分叉」· Task 3 Files · Task 3 Step 5）——wave 面从不做路由替换，替换谓词不适用于 wave，故 soft-capped wave 的 `handoff` 路由不会被劫持，闸是多余的死防御；两处注入点因此对称 | Constraint · Task 3 Files/Steps · Change history v0.4 | Oscaner M. · Claude（kairos:cdd-plan · 裁定回填 · 2026-11-04） |
| v0.5 | 2026-11-04 | 第 3 轮评审回填（内容面）：① **`nextHopOf` 的两个值分开**——替换驱动仍只取 doc 面 `reviewGate`，原因 cell 取 `drift \|\| briefDrift`；v0.4 的「cell 只喂 `gate.drift`、替换谓词不动」在代码上不成立（一个值同时驱动两件事）② 负控的期望 token 改为 `closed-line`（`handoff` 的 `hopOf` 为 null ⇒ `#reasonOf` 落末行；`task-open` 在该状态不可产生）③ 语义注释补 `run.ts:689-693`（白名单正上方那句）④ 范围锁的 spec 版本改为 v0.11 | Constraint · Task 1 Files/Steps · Task 3 Steps · Change history v0.5 | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-04） |
| v0.6 | 2026-11-04 | 第 3 轮评审回填（核验 `d0312bcd` 的落地后补完内容面）：① Task 3 Objective 删掉「板面只在 wave 自己的 C5 路由非 null 时取值」——v0.4 删闸、v0.5 把两个值分开之后，wave 的 exit 侧路由不可能被替换，这句旧表述与 Step 4 自相矛盾 ② Step 4 末尾的「由 Step 5 的注入闸挡掉」改为如实描述：板面会拿到 `#exitRoute` 的 `handoff`，替换驱动对 wave 恒 false，故 `next:` 零变、`reason:` 落 `closed-line`，并把该 `handoff` 补进可达路由的枚举 ③ Step 5 的 rationale 按实际守卫重写——只有 `target.type === "wave"` 一道条件（防止非 wave frontier 用文档路径去问 brief drift），`active !== null` 之类不设，exit 侧安全来自两个值分开 ④ 负控与 Acceptance 标签由「注入闸」改「替换不触发」，并在 Step 7 补 `closed-line` 的取值来源（`doc-drift` 只落 `review` 路由）⑤ Task 1 的注释同步范围由 `run.ts:689-693` 扩为 `:689-704`（白名单正上方的整段注释） | Constraint 保持 · Task 1 Files/Step 7 · Task 3 Objective/Step 5/Step 7/Acceptance · Change history v0.6 | Oscaner M. · Claude（kairos:cdd-plan [P24] 第 3 轮评审回填 · 2026-11-04） |
| v0.7 | 2026-11-04 | 第 4 轮评审回填（内容面，无结构变更）：① Task 3 Produces 由「一个 drift 值」改为两值口径——`gate.drift = drift \|\| (input.briefDrift ?? false)`，替换驱动 `drift` 对 wave 恒为 `false`（与 Step 4 同一词汇） ② Task 3 Files 补 `session/ledger.ts:1205-1218`（`nextHopOf` 的 docstring 同入同步列），Step 4 写明两值口径的注释改写 ③ Task 2 补三条 back —— 站表第五行的**值**逐键断言（`face.test.ts:66-69` 旁同形补一条）、胶囊**确实读该行**（`:101` 注释旁补 `emitted[2]` 前缀取自 `words.station("reason")`）、板面 `  reason:  ` 的 11 列前缀在 `tokenOf` 归一化之前自带断言 ④ Task 1 Step 9 删掉「判别式一旦被复制成第二份就红」的假敏感度——`#bookkeep` 有 `targetAction` 门、`#recordsOf` 是无 verdict 的 dry run，两处 phase 列表**各存一份**，`preview.test.ts` 的 fix 轮用例是行为 pin 而非漂移探针；Constraint 与 Acceptance 同步登记该双写债务 ⑤ `#abs` 的行号引脚由 `:905-906`（`docLineVerdict` 的读基准处）改为 `docLineVerdict:905-906` → `#abs:598-600` ⑥ `drift \|\| briefDrift` 的写法改为 `drift \|\| (input.briefDrift ?? false)`（否则 `boolean \| undefined` 在 `strict` 下不过 `tsc`） | Oscaner M. · Claude（kairos:cdd-plan [P24] 第 4 轮评审回填 · 2026-11-04） |
| v0.8 | 2026-11-04 | **范围追加（用户裁定并入 P24，对齐 spec v0.13 §9）**：新增 **Task 5**「板面 frontier 的选面读 drift」——`pipelineFacts` 的 spec/plan 两面 `closed` 由 `lineClosed` 改 `lineStateAt(...) === "closed"`（既有 drift-aware 读数），含必红断言（drifted spec + plan ⇒ 板面给 review lead 而非 implement）、孪生回归（review 闭合后 frontier 前进）、两处 null 路径零变、本波自带 validate；`DependsOn: 1,2,3,4` ⇒ 新波 W4。范围锁版本改 v0.13 | Task 5 + 范围锁 + Change history v0.8 | Oscaner M. · Claude（kairos:cdd-plan · 范围追加 · 2026-11-04） |
| v0.9 | 2026-11-04 | 第 5 轮评审回填（内容面，对齐 spec v0.14）：① Task 2 补三处**文件自述散文**——`face/capsule.ts:2` · `:7-10` · `face/words.ts:7-8`（补第十一行 `reason: <token>` 并注明 hop 为 `null` 时不渲）；Step 8 由 11 处改 **14 处**并逐条列出，Constraint 计数同笔同步 ② Task 3 的 `session/next.ts:208-226` 由「No change」改为「**形状**一行不动」，`NextHopInput.gate` 的 docstring（`:211-213`）改为两值口径并入 Step 4 的同步列 ③ 范围锁的 spec 版本由 v0.13 改 **v0.14** ④ Task 1 用例 C 的 dispatch 返回值改为 `{ status: "BLOCKED" }`（`DispatchOutcome` 无 `reason` 字段，照抄会 TS2353），Step 4 补「片段须过 `tsc -p packages/cdd-engine`」 ⑤ Task 4 的四份 diagram 源与 README 中文镜像一律引用 spec §5 的定案句 ⑥ Task 1 Step 9 指名预览面 branch 腿的路径来源为 `this.#scene.planPath`（与 `#readsOf` 同源） | Oscaner M. · Claude（kairos:cdd-plan [P24] 第 5 轮评审回填 · 2026-11-04） |
| v0.10 | 2026-11-04 | 任务 1,2 实现轮第 1 轮 fix（内容面，结构面未动）：Task 2 的 reason 面按实际代码校正——① `renderReason` 由 `(hop: NextHop \| null): string \| null` 改为 `(hop: NextHop): string`（`renderHop` 只对 null hop 返回 null，故内部 null 分支永不可达；hop 的缺席由胶囊的 `hopValue !== null` 门一次判定） ② 板面 `reasonLine(hop, renderer)` 改为 `reasonLine(hop)`，值直取 `hop.reason`（`renderReason` 的值自带站表前缀，板面取来只能弃用）；原写法里「渲不出就退化成 `(none)`」的分支因此不可达，docstring 一并改正——absent hop 的行本来就没有 `reason:` 行 ③ Files / Produces / Step 4 片段 / Step 5 / Step 6 末句同笔同步；范围锁的 spec 版本随 spec v0.15 | Task 2 Files/Produces/Steps + 范围锁 + Change history v0.10 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 1 轮 fix · 2026-11-04） |
| v0.11 | 2026-11-04 | **§6 验收演示留证 + 一处计划笔误**：① 修复前有 **4 次实案**（spec fix 6 / plan fix 4 / spec fix 7 / plan fix 5，均为「review 零 blocker → fix 改完 → `next:` 仍印 `review`」，靠人工推进基线才闭合）；**修复后的第一次自证是 W1**——review 1 零 blocker（1 warn + 4 nit）→ fix 1 修完 5 条 → `next: implement --tasks 3` / `reason: task-open`，**无人工干预即收口**。② Task 4 Step 6 的提交类型 `docs+release:` 不在仓库词表（feat/fix/docs/chore/test）内，已改为 `docs:`（该提交已在历史中，不改写历史，只在计划里订正） | Task 4 Step 6 + Change history v0.10 | Oscaner M. · Claude（kairos:cdd-dev · W3 裁定回填 · 2026-11-04） |
| v0.12 | 2026-11-04 | **W3 评审第 2 轮 fix（内容面，结构面未动）**：① Task 4 Files 的 `Create: .changeset/p24-nextloop-closeout.md` 改为 `Modify: .changeset/p24-fix-identity-and-reason-row.md`——本相位只落**一份**发布条目 ② Task 4 Step 4 由「写 `p24-nextloop-closeout.md`」改写为「写 `p24-fix-identity-and-reason-row.md`」，写明三件真事的口径，并禁止再开第二条、禁止声称 wave 的写回修好了既有收口缺陷 ③ 范围锁的 spec 版本随 spec v0.16 | Task 4 Files/Step 4 + 范围锁 + Change history v0.12 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 2 轮 fix · 2026-11-04） |
| v0.13 | 2026-11-04 | **范围追加（用户裁定 · 对齐 spec v0.17 §10）**：新增 **Task 6**「pipeline frontier 归 session 平面」——新增 `session/pipeline.ts` 的 `PipelineFrontier`，板面删除 `#pipeline` / `#exitRoute` / `#lastEnteredIndex` / `#waveFrontierKey` / 逐面 `closed`·`active` 并改为纯渲染；必红验收是 parity（板面 `next:` == frontier 线 `peekNext()`） + 零字节回归 + 四条面序用例；`DependsOn: 5` ⇒ 新波 W5；明确不做越序拒绝 | Task 6 + 范围锁 + Change history v0.13 | Oscaner M. · Claude（kairos:cdd-dev · 范围追加 · 2026-11-04） |
| v0.14 | 2026-11-04 | **plan 第 6 轮评审回填（内容面，结构面未动；Task 6 重定性为纯重构）**：① **B1**——删掉「parity 今日必红」的假前提（实测今日树 parity 已逐字节成立，`board-view.test.ts:1589` 与 `:1612` 早已钉住）：Task 6 的必红证据改为**结构缺失**（五个成员今日在 `board-view.ts`，搬走后 `grep` 为空），parity 降为**回归 pin** 并写明适用面（只在 frontier 面自己有可渲染帧时；未进入 `:712` / 空波形段 `:1494-1507` / 全闭合 `:1572` 三态显式排除）② **W1**——`PipelineFrontierInput` 增注入的 `planGraph: TaskGraph \| null`（受守卫的 plan 读仍在板面 `#planGraph`，frontier 不读 plan），wave 面的 `closed` 谓词写进 Step 4（`waves.length > 0 && every done`，空波形段不闭合），`#planGraph` docstring 入改写列 ③ **W2**——`session/next.ts:132-133` 的 `PipelineFaceState.closed` docstring 入 Files（它教「empty wave segment is closed」，与 k2 相反）④ **W3**——`face: PhaseFaceKey`（`session/next.ts:119`），不是 `PipelineEntry`（`:95`）⑤ **W4 + W5**——范围锁 spec 版本 v0.17 → v0.18 并新增「spec 版本与范围锁同笔」；Task 4 Step 3 / Acceptance 改为「两处 pin 各只对自己的面 + 本轮一次性新鲜度校验」，并把「`next-loop` / `journey` 源↔HTML 无常驻门」登记进 Constraints ⑥ **N1**——Consumes 的 `PIPELINE_FACES` / `PIPELINE_NEXT` 改指 `session/next.ts`，`handoff` 入参写 `PipelineKey` ⑦ **N2**——选定 constructor injection（`new PipelineFrontier(ledger)`，与 `Ledger` / `Lifecycle` 同形），故不需要 `noStaticOnlyClass` 豁免 | Task 6 + Task 4 + Constraints + 范围锁 + Change history v0.14 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 6 轮 fix · 2026-11-04） |
| v0.15 | 2026-11-04 | **plan 第 7 轮评审回填（内容面，结构面未动；Task 6 引用精度与搬移完整性）**：① **W1**——散文改写面由两处扩为**八处同义**：`board-view.ts:17-19`（「the traversal lives on the assembly face」——正是本任务要推翻的那句）· `:110-113`（`BoardPipelineFacts` 的「the traversal and the derivation belong to the assembly face」）· `:696-700`（`pipelineFacts` docstring）· `:844-853`（`BoardNext` 的「re-homed at the board's CONSTRUCTION face … decides the next pipeline step」）· 随 `#pipeline` 删除的 `:890-902`，并新增三个文件进范围：`face/cli.ts:483-487`（原不在 Files 里）· `session/next.ts:33-34`（本任务已改的同一模块）· 两处测试分节横幅 `board-view.test.ts:1389-1392` / `next.test.ts:339-343`；Step 5 与 Acceptance 同笔写明「既有断言零改动」只绑 `expect`，两处横幅改写不动任何断言 ② **W2**——Step 4 按 `board-view.ts:890-902` **逐条照抄四条面序规则**，补回被漏掉的规则②（已进入但无 active hop ⇒ 该面自己的 exit，k2 `board-view.test.ts:1494-1507` 覆盖的正是它）与规则③的兜底半句（无前置已进入面 ⇒ 第一个面的 exit，代码 `:918` 的 `Math.max(0, #lastEnteredIndex(...))`），并标注原文随 Step 5 删除 ③ **N1**——Step 5 分清两条**零门**（`#pipeline\b|…` grep 为空 · `^\s+(closed|active):` 计数为 0，两者都点名 `face/board-view.ts`）与**观察项**（`pipelineFacts` 计数须非 0）；Acceptance 的 closed/active 计数同步点名文件（全仓永不为 0，因为 `session/pipeline.ts` 会建同名单元格） ④ **N2**——Produces 改写：`face` 是「该 route 自己所属的面」，两条 exchange 规则（未进入 / 全闭合）下为 `null`、锚面由 `target` 反推，类型改 `PhaseFaceKey \| null`；消费者改为 Step 3 的四个 `pipeline.test.ts` 用例，`BoardNext.#hopOf` 只吃 `{ route, target }`，parity pin 不碰 `PipelineFrontier` ⑤ **N3**——Consumes 改正 `session/faces.ts` 的导出清单（`TargetType` / `DispatchPhase` / `ReviewLead` / `AuditFace` / `RouteTarget:50` / `targetFaces` / `TargetFace`，**不含** `PIPELINE_*` 与 `PhaseFaceKey` / `PipelineFaceState`），并补上返回类型用到的 `Route`（`session/next.ts:46`）与 `RouteTarget`（`session/faces.ts:50`） | Task 6 Files/Consumes/Produces/Step 4/Step 5/Acceptance + Change history v0.15 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 7 轮 fix · 2026-11-04） |
| v0.16 | 2026-11-04 | **branch 第 1 轮评审回填（内容面，结构面未动）**：① **W1**——Task 1 Acceptance 的双写债务句改为指向 [#414]（`#recordsOf` 与 `#bookkeep` 两处判别的合并另开该 issue，债的收敛不在本相位），并把守卫边界写实为「行为 pin 而**不是**漂移探针」：任一侧日后单独改动该用例都不必红，不得据此宣称能拦单侧漂移 ② **N1**——`board-view.test.ts:1633` 的 `targetFaces["branch"]` 改 `targetFaces.branch`（biome `useLiteralKeys`，本轮 diff 唯一新增命中；其余 `targetFaces[…]` 站点键名含连字符，无法点取） | Task 1 Acceptance + Change history v0.16（N1 落测试文件，非本文档） | Oscaner M. · Claude（kairos:cdd-dev [P24] 分支第 1 轮 fix · 2026-11-04） |
| v0.17 | 2026-11-04 | **plan 第 8 轮评审回填（内容面，结构面未动）**：① **W1**——发布条目由「三件」改为**四件**：板面 pipeline frontier 改读 drift（§9）也是消费面可见字节变化（收口后被轮外改动的 doc 让板面从 `implement --plan … --tasks …` 改印该 doc 线的 review lead + `reason: doc-drift`），故 Task 4 的 Files / Step 4 / Acceptance 三处一律改为四件，并把 `.changeset/p24-fix-identity-and-reason-row.md` 加进 Task 5 的 Files（只核对 ④）与其 Acceptance（「该变化由 Task 4 的发布条目承载」）——此前没有任何在 Task 4 之后的任务 owner 这份条目，实落时第四句只能靠 Task 5 顺手补 ② **N1**——四份 diagram 源的 pin 归属记实：`next-loop-twin` 的 `SOURCES` 是 `next-loop` ×2 + `architecture` ×2（`:93-95`）且只钉三条收敛语句，`journey` 两份在三个测试面里零命中（**完全没有** pin），故 Step 3 / Acceptance / Constraints 的已知限制三项一并改写（不再声称「四份源的孪生断言」）③ **N2**——Task 5 Acceptance 加交叉引用：它调度的两个 `closed` 单元格由 Task 6 删除并迁入 `session/pipeline.ts`（spec §10），红→绿证据取自本任务的提交 | Task 4 Files/Consumes/Step3/Step4/Acceptance + Task 5 Files/Acceptance + Constraints + 范围锁 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 8 轮 fix · 2026-11-04） |
| v0.18 | 2026-11-04 | **范围追加（用户裁定 · 对齐 spec v0.21 §11）**：新增 **Task 7**「每轮的下一跳读 pipeline frontier」——`#capsuleLines` 改喂 `PipelineFrontier.next(...)`，`Lifecycle` 增 `specType`/`specPath`（`cli.ts` 从文档索引填）；必红 parity（波形轮完而未闭 spec 时胶囊 == 板面）、裸 slug 退化、受影响快照逐条重锚；`DependsOn: 6` ⇒ 新波 W6 | Task 7 + 范围锁 + Change history v0.18 | Oscaner M. · Claude（kairos:cdd-dev · 范围追加 · 2026-11-04） |
| v0.19 | 2026-11-05 | **plan 第 9 轮评审回填（内容面，结构面未动；九条全收）**：根因单一——Task 7 照 spec v0.21 写而 spec 已到 v0.26。① **B1**——范围锁的版本字面由 v0.21 改 **v0.26**，并写明这不是排版（v0.22 加深 §11、v0.25 拆开两个 frontier 术语、v0.26 重写 doc 线验收）；Task 7 按 §11 定案 ¶2 与 §7「渲染源统一」行重写 ② **B2**——Task 7 必须涵盖 **cell 装配的搬迁**：target → `type` / `key` / `doc` / `briefDrift` / `docClassOf` 与 `PipelineFrontier` 一起进 session 平面，`face/board-view.ts:818-836` 进 Files，胶囊与板面调**同一个装配**，Acceptance 改为「一个装配、两个渲染面」的结构事实（`grep nextHopOf\|briefDrifted board-view.ts` 搬后为空） ③ **W1**——parity 同时钉 `next:` **与** `reason:` token（`reason:` 才是 cell 派生的下游，只钉 `next:` 会放过仍读本轮 frame 的实现） ④ **W2**——删掉不存在的 `SessionRun`（三处：Files · Produces · v0.18 行），Consumes 改为构造注入 `new PipelineFrontier(ledger).next(input)` ⑤ **W3**——四格来路逐格指名（三格索引 + 一格受守卫读；`--spec` 轮 argv `planPath` 为 null、`scene.state` 非 `TaskGraph`），Step 5 的退化改按**整组输入缺席**（`specPath === null && planPath === null`） ⑥ **W4**——Constraints 的「胶囊在 wave 面不承诺 drift」与 Review Focus 的「不得修一致」、Task 3 Step 8 及其 Acceptance 按 §11 改写：frame-keyed 的 **line frontier** 才是看不到重绑 brief 的那个，胶囊渲 **pipeline frontier** 故与板面同值；`run.test.ts:1566` 的标题理由改写（标题归 Task 7 Step 6） ⑦ **W5**——changeset 规则改为**不变式**（每件消费面可见变化都在同一份条目内，落笔时在册四件、第五件由最后落地的 Task 7 补），Task 7 的 Files 加 changeset、提交类型 `refactor` → `feat` ⑧ **W6**——Task 1 的夹具裸 slug 选择写明（不传 specPath/planPath ⇒ 印本线 exit；带 plan 的 slug 收口轮印下一面的 active hop，可以是 `review --type plan …`），Task 2 的字节声明收窄为**非胶囊读者** ⑨ **W7**——Task 7 新增散文正名步：`session/run.ts:257` · `:396` · `:838` · `:283-285` 与 `PipelineFrontier` 模块头按两个 frontier 分开说 | Constraints · Review Focus · Task 1 Steps/Acceptance · Task 2 Acceptance · Task 3 Step 8/Acceptance · Task 4 Files/Step 4/Acceptance · Task 7（整体重写）· 范围锁 · Change history v0.19 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 9 轮 fix · 2026-11-05） |
| v0.20 | 2026-11-05 | **plan 第 10 轮评审回填（内容面，结构面未动；四条全收，B1/B2 是设计漏项）**：① **B1**——共享装配补**第六格 `nextLineOpen`**：`Ledger#nextHopOf` 的入参是六格（`session/ledger.ts:1227-1236`），今日只有胶囊路径填（`session/run.ts:851` 的 `#branchLineOpen`，判据 `:872-877`），板面装配缺它（`face/board-view.ts:821-835`）；它是 wave 面 `done` 路由在 `PIPELINE_NEXT.wave` 与 `PIPELINE_NEXT.branch` 之间翻转的事实（`session/next.ts:387` · P21 §4.2 · `run.test.ts:1249` / `:1269`）。**做法**：装配自己从账本取该事实（`input.planPath` + branch 面的 `reviewGate` / `lineRoute`，判据只留一份），两面同源；**以胶囊那一侧为正确值**；板面该状态的字节变化进 Step 7 的重锚清单（两面各一例）与第五件 changeset；Objective / Files / Consumes / Produces / Step 3 / Step 5 / Step 7 / Step 8 / Acceptance 同笔写准，Constraints 的「wave 面禁分叉」把单次调用的哨位改到会话平面 ② **B2**——退化键由「整组输入缺席」改为 **`specPath === null`**（不看 `planPath`）：只带 plan 的节点（phase 无 spec 文档，`run.test.ts` 33 个夹具）是常规形状，该输入今日实测得 `{face: null, route: handoff(kairos:cdd-plan), target: null}`（`#identityState` 在 `specPath === null` 时既不闭合也不给 target，`session/pipeline.ts:130-140`），照旧键就会每轮印一个已过的阶段；**补两条测试**——plan-only 与今日逐字节相同、有 spec 无 plan 不退化（frontier 停在 spec 面交出 plan 的 transition） ③ **W1**——散文改写列补 `face/board-view.ts:103-109`（`BoardPipelineFacts` docstring 的 `:108` 是那条零门的第三处命中），**门本身不改**，并把「今日计数」改为 `nextHopOf` 三处（`:108` / `:813` / `:821`）+ `briefDrifted` 一处（`:833`） ④ **N1**——行号按落地后的树重钉：`BoardNext` 类 docstring `:791-800`（原 `:805-816`）· `#hopOf` `:818-836`（实测正确，评审的 `:818-838` 多算两行）· `face/cli.ts` 的 `planPath` 派生 `:993-994`、`specPath` `:995-996`（原 `:994-995`）· `run.ts` 的「ONE `NextHop` object」句子 `:257-259`（原 `:257`，句子横跨三行）；另按实测把 `face/cli.ts` 的装配散文由 `:486-490` 改为 `:483-486` | Constraints · Task 7（Objective / Files / Consumes / Produces / Steps 2,3,5,6,7,8 / Acceptance）· 范围锁 · Change history v0.20 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 10 轮 fix · 2026-11-05） |
| v0.21 | 2026-11-05 | **plan 第 11 轮评审回填（内容面，结构面未动；三条全收）**：① **B1**——删掉「板面缺 `nextLineOpen` 故 wave 收口态站位与胶囊不同」的假前提：`NextStepRouter#entryOf` 在 `handoff` 之后提前返回（`session/next.ts:384` 先于 `:387`），wave 目标的 route 只来自 `waveLineRoute`（从不返回 `done`）或 `#exitRoute` 的 `handoff`，故第六格在共享装配上是**惰性**的。**保留**六格并入（两面同源、判据一份，本身是对的），但删掉 Objective / Files / Produces / Step 3 / Step 7 / Step 8 / Acceptance 里一切「站位翻转」与「板面改前改后各在册」的描述，并把惰性论证写进 Objective 与 Acceptance；验收改断言**两面 `NextHop` 全等（含 `reason`）**，第六格两侧只作零变回归 pin ② **W1**——三处 pin 按树重钉：`face/cli.ts:738`→`:741`（`:738` 是 `HostDetect.detect` 行）· `:744`→`:745` · 「33 个夹具」→**14**（`run.test.ts` 里传 `planPath` 的 Lifecycle 夹具，逐行在册；33 是 `cli.test.ts` 的 `planPath` 行数）；并在 Constraints 新增一条：凡引用行号 / 计数，落地时以当时树为准并回填 ③ **W2**——补一条 **cli 层 E2E**（Task 7 Step 1b）：`run.test.ts` 的用例均自带 opts 直接驱动 `Lifecycle`，装配层（`face/cli.ts` 场景 + `Lifecycle` opts）漏填四格时全绿；新用例真跑一次 `cdd review --spec …` 再跑 `cdd board`，断言胶囊与板面 `next:` / `reason:` 同值；`face/__tests__/cli.test.ts` 写进 Files 与 Acceptance | Task 7（Objective / Files / Produces / Step 1b / Step 3 / Step 7 / Step 8 / Acceptance）· Constraints · Change history v0.21 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 11 轮 fix · 2026-11-05） |
| v0.22 | 2026-11-05 | **plan 第 12 轮评审回填（内容面，结构面未动；四条全收）**：① **B1**——退化键只在 `phase-spec` 上验过，而 `overall` 占**同一身份槽**（`#identityState` 的键是 `input.specType ?? "phase-spec"`，`session/pipeline.ts:131`；`SlugIndex#identityDoc` 对任何非 plan 的声明文档都给路径，`infra/slug-index.ts:174` · `:336-338`），故带 `--spec` 的 `overall` 节点**不退化**、走共享装配。做法：Objective 新增「身份槽有两个主人」段；Step 5 新增 ⑤（三路取值均不得退化 + 已测三例：收口带 plan ⇒ `review --type plan --plan …` / `task-open`；收口无 plan ⇒ `reason:` 由 `face-closed` 变 `closed-line`；未收口 ⇒ `review`）与一条 `overall` 用例；Acceptance 的退化键条与「spec 缺席」条同笔；changeset 第五件改为**两半**（含 `overall`） ② **W1**——散文清单补 `session/ledger.ts:1211-1213` · `face/gate.ts:134-142` · `face/cli.ts:757-761`（三处把多面写成同一对象的陈述），并把「不作零门」改为**逐处复读 + 三条零门**（`share one object by construction` · `the board and the lifecycle frontier read` · 「the SAME NextHop the capsule」，今日各 1 命中：`ledger.ts:1213` · `gate.ts:135` · `cli.ts:757`），Acceptance 同步 ③ **W2**——第六格「自洽但不是工作项」：删掉它的独立 Acceptance 条与独立散文段（Step 7 的零变 pin、Step 8 的板面零变提醒、Task 7 Acceptance 的第六格专条），并入 parity 断言（两面 `NextHop` 全等，含 `reason`），并写明惰性与「不进 changeset 清单」 ④ **N1**——`.changeset/p24-fix-identity-and-reason-row.md`:6-7 的硬计数 `Three consumer-visible face changes` 与四项/五项对不上：**去掉硬数字**（无编号列举），Task 4 Files / Step 4 / Acceptance 与 Task 7 Step 8 同笔加上「引导句不带硬计数」的指令 | Task 7（Objective / Files / Produces / Steps 3,5,6,7,8 / Acceptance）· Task 4（Files / Step 4 / Acceptance）· Change history v0.22 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 12 轮 fix · 2026-11-05） |
| v0.23 | 2026-11-05 | **plan 第 13 轮评审回填（内容面，结构面未动；三条接受、一条 rejected）**：① **W1**——`overall` **没有板面半边**：`BoardNext.of` 对 `docType === "overall"` 返回 `null`（`face/board-view.ts:807`），程序板不跑 pipeline frontier，故 Step 5 ⑤(a) 的「胶囊与板面值全等」在 `overall` 上不可能构造——改为只断言**胶囊侧**与其身份槽（`#identityState`）一致，并写明板面半边不存在及其原因；Objective / Produces / Acceptance 的「一个装配、两个渲染面」同笔收窄为「板面跑 frontier 的节点」 ② **W2**——纠正 `overall` 的实测值：收口的 `overall` 今日渲 `next: done` / `reason: closed-line`（**不是** `face-closed`），带同 slug plan 时 pipeline frontier 给后继 plan 面的 `review --type plan --plan …` / `task-open`；changeset 第五件**删掉**「收口无 plan 的 `face-closed → closed-line`」（该形状字节零变），并把身份槽三主人（`phase-spec` / `single-spec` / `overall`）的同一形状在册，`single-spec` 的收口无 plan 形状定为 `done` / `face-closed` 回归 pin ③ **W3 rejected**——「第六格证据不可能红」的论证正确但结论不成立：该格在本相位的全部作用就是「两面同源且惰性」，要求一条能红的断言是伪要求；Acceptance 改按作者裁定的三段替代证据在册（`session/next.ts:384` 先于 `:387` 的反证 · 不进 changeset · **变异不变量**：临时把装配里对 `nextLineOpen` 的取值换成 `undefined` 后套件仍全绿、跑后还原） ④ **N1**——零门枚举补 `:796`（`BoardNext` 类 docstring 的 `Ledger#nextHopOf →`），并注明重写 `:791-800` 必须一并删掉该字样，否则门绿不了；Task 4 Step 4 / Acceptance 的「引导句不带硬计数」标注为 **Task 7 Step 8** 的 owner，不再作为 Task 4 的未达成判据 | Task 4 Step 4/Acceptance · Task 7 Objective/Files/Produces/Steps 3·5·8/Acceptance · Constraints · Change history v0.23 | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 13 轮 fix · 2026-11-05） |
| v0.24 | 2026-11-05 | **范围追加（用户裁定 · 对齐 §12；当轮 spec v0.27，现行 v0.30）**：新增 **Task 8**「板面汇总单元重排」——成功按 verb 合并、失败逐条带 cycle；既有 pin `:1274` 重锚为 `fix 1a2 ✓ · fix 1 ✗`；两条零变用例（无失败行字节不变 · 区间形与 `a1` 门仍红）；`DependsOn: 7` ⇒ 新波 W7 | Task 8 + 范围锁 + Change history v0.24 | Oscaner M. · Claude（kairos:cdd-dev · 范围追加 · 2026-11-05） |
| v0.25 | 2026-11-05 | **plan 第 14 轮评审回填（内容面，结构面未动；六条全接受，根因单一——Task 8 写于 spec v0.27，现行 spec 已是 v0.30）**：① **B1**——Task 8 的 Objective / Step 1-4 / Acceptance 换成现行 §12 的两类令牌形：实况行 `review 13 ✓+74 · fix 13/14 ✓ · fix 12 ✗→✓`、同 cycle 重派 pin `fix 1/2 ✓ · fix 1 ✗→✓`；比率只在**该 verb 有失败**时出现、`✗→✓` 只在**恢复**时出现；范围锁已是 **v0.30**（v0.24 后另有一次同步），本行确认并记录 ② **W2**——Task 8 拥有 changeset：Files 补 `.changeset/p24-fix-identity-and-reason-row.md`，新增 Step 5 改写其末句「`cdd board` output is unchanged」为如实描述（有失败尝试的行输出变化、其余行字节不变），Acceptance 补一条；Task 4 的 Files / Step 4 / Acceptance 与 Task 7 Step 8 / Acceptance 的「最后落地 owner」改指 **Task 8** ③ **W3**——Task 8 Step 3 写死**后缀与分母互斥**（比率形不带 `attemptSuffix`，`fix 1/2 ✓` 而非 `fix 1/2a2 ✓`），与 spec v0.30 的自查订正同口径 ④ **W4**——Task 8 Step 4 拆成四条边界用例：无后续成功的失败不带 `→✓` · 失败 verb 不改另一 verb 的令牌 · 比率仅在有失败时出现 · 四条既有干净行 pin（`board-view.test.ts:1218-1228` · `:1242-1246` · `:1256-1265` · `cli.test.ts:7356-7357`）逐条在册并一行不改 ⑤ **W5**——Task 8 Acceptance 的 docstring 条收窄为**仅** `summaryCell` / `#summaryToken` 的令牌形句（其余 `spec §5.3` 引用 `:24` `:60` `:294` `:330` `:370` `:406` `:511` `:530` `:612` `:655` 一处不得触碰），Constraints 的「重锚在册」补一句：§12 对 `:1274` 的重锚是**账外修复**、不计入那 16 ⑥ **N1**——Change history 的 v0.24 行日期改 2026-11-05（不再早于 v0.23 与 front-matter），其引用的 spec 版本注明现行 v0.30 | Constraints · Task 4（Files / Step 4 / Acceptance）· Task 7（Step 8 / Acceptance）· Task 8（整体）· Change history | Oscaner M. · Claude（kairos:cdd-dev [P24] plan docs-fix 第 14 轮 · 2026-11-05） |
| v0.26 | 2026-11-05 | **plan 第 15 轮评审回填（内容面，结构面未动；五条全接受，根因单一——Task 8 的正文停在 spec v0.30 之前，而现行 spec 已是 v0.32）**：① **B1**——Task 8 补**成功数为 0 的豁免**（纯失败 verb 只渲 ✗ 令牌 ⇒ `review 1 ✗` / `implement 1 ✗` 字节零变），Objective / Step 3 / Acceptance 三处同笔；pin 清单按行性拆为**无失败行**（`:1218` `:1225` `:1242` `:1263`）与**纯失败行**（`:1228` `:1246` · `cli.test.ts:7356-7357`），并新增一条独立纯失败用例（断言不含 `review 0/1 ✓`） ② **W1**——补三条 spec v0.31 规则与用例：令牌顺序钉死（点名样例 `review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓`）· 恢复形 `✗→✓{+N}` **照带 `+N`**（并加一例 carrier 带 findings）· 恢复改述为「**同一 cycle 的后续 attempt** 成功」，并加一例「cycle N 败 + cycle N+1 胜仍是 `✗`」 ③ **W2**——陈旧散文登记搬进 Task 8：`board-view.test.ts:1268` 的标题改写、`#judgementRuns` 的 docstring 改写（**保留该 static、不改名**）进 Files 与 Steps；`:330` 从「不得触碰」列移出，并登记 spec §7（两处）与 §12 落空面（三处）的计数差异，本计划取三处都改指 P24 §12 ④ **W3**——范围锁的 spec 版本 v0.31 → **v0.32**，本行单独记录**吸收 spec v0.31 + v0.32**（前几版只改锁号未改正文，才使 Task 8 落后） ⑤ **N1**——Step 5 的 changeset 收尾句改给**英文原文**（该文件是 shipped 的英文面），`grep -c 'output is unchanged'` 仍为可检查的门 | Constraints 范围锁 · Task 8（Objective / Files / Produces / Steps 2-5 / Acceptance）· Change history v0.26 | Oscaner M. · Claude（kairos:cdd-dev [P24] plan docs-fix 第 15 轮 · 2026-11-05） |
| v0.27 | 2026-11-05 | **plan 第 16 轮评审回填（内容面，结构面未动；四条全接受，W1 的措词按作者裁定收窄到「汇总单元」，W2 的恢复定义钉死为「紧邻的下一次 attempt」）**：① **W1**——changeset 的 §12 收尾不再写全板声言：删掉 Task 7 段（§11）的「`cdd board` output is unchanged」**且不换成任何全板声言**（同一份条目本身已写了 `reason:` 行、`doc-drift` 与 frontier 搬家），§12 另起一段、口径限定为汇总单元（作者裁定的英文原句「Within the board's summary cell, rows that carry no failed attempt stay byte-identical; rows with one show an ok/attempts ratio and a recovery marker.」），门两条（`output is unchanged` 为 0 · 无 `byte-identical on every other row` 残留） ② **W2**——Step 4 补两条 pin：`attempt >= 2` 且从未重派的失败记录仍带 `aN`（`fix 1a2 ✗`）· 同一 cycle `a1 败 · a2 败 · a3 胜` 只让紧邻成功的那枚带箭头（`fix 1/3 ✓ · fix 1 ✗ · fix 1a2 ✗→✓`），故 Step 3 的恢复定义由「同一 cycle 存在更大 attempt 且 targetAction 为真」改为「**紧邻的下一次 attempt**（`attempt + 1`）成功」；Acceptance 补 :1219 / :1277 的覆盖边界——`:1277` 只覆盖一条全成功单记录，失败令牌与比率形的「不出现 `a1`」靠 Step 2 / Step 4 的逐字等值 ③ **W3**——`+N` 分账写明：成功令牌只累加成功记录的 carrier、每枚失败令牌只算自己那条；Step 4 ④ 由失败侧单断言改为整行 `fix 4/5 ✓ · fix 5 ✗→✓+2`（成功记录无 carrier），把失败记录的 findings 累进成功令牌即红 ④ **N1**——Step 4 由「六条」改「七条」（前六条新用例、⑦ 是既有 pin 枚举）· Step 3 的失败令牌补 `{verb}` 前缀 · `#summaryToken` 的**首句**（`One aggregated token of a verb × judgement run`）与令牌形句一并改写并指 P24 §12，而 `:294` 的 `+N` 规则句与其 `spec §5.3` 引用逐字保留 | Task 8（Objective / Files / Produces / Steps 3-5 / Acceptance）· Task 4 Acceptance 的第六件口径 · Change history v0.27 | Oscaner M. · Claude（kairos:cdd-dev [P24] plan docs-fix 第 16 轮 · 2026-11-05） |
