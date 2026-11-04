---
title: 引擎文档工具（Engine Doc-Tooling）— P24 计划：NEXT-LOOP 收口面（基线随轮推进 + hop 原因可读）
doc-type: plan
version: v0.2
date: 2026-11-04
slug: 2026-10-10-engine-doc-tooling-p24
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p24-design.md` **现行 `version`**（v0.7）所指的面；面与裁决以现行 spec 与 handoff 裁定为准，需要改动即回评审，不在计划里顺手扩面。
- **单点判据**：drift 的「记了什么 identity」只有一个写入点（`Ledger#recordReviewedRevision`，wave 经 `recordReviewedBrief`），读取面按既有事实分两条（doc/branch 走 `docReopens`、wave 走 `waveLineRoute` 的 D30 腿）。不得为任何一面新开第二个 drift 判定或第二个写入点。
- **只推进完成的轮**：`targetAction` 为假的轮（BLOCKED / TIMEOUT）一律不推进基线；读不到输入（文档 / plan 不可读）时什么都不记录，保留旧基线。
- **`next:` 字节零变**：`next:` 行仍是可执行字面，整行抄进 shell 必须能跑。诊断信息只落**另一行**（`reason:`）。字面上不得出现 `—`/`#`/任何后缀。
- **重锚在册**：`next:` 断言 152 处中 137 处零改动（按行抽取 / `toContain`），15 处整块 `toEqual` 快照逐条重锚（每处新增一个 `reason:` 元素；逐处行号见 Task 2 Step 7），另有 1 处站表长度 pin 由 4 改 5；总数 16，一条不许漏、一条不许顺带。
- **陈旧散文在册**：凡声称 `next:` 是末行 / 唯一站锚 / 唯一站词的注释（spec §7 第 5 类列出的 9 处）同笔改写；它们不承载断言。
- **前缀各有其家**：胶囊取站表 `words.station("reason")`；板面取布局字面 `  reason:  `（与它自己的 `  next:    ` 同形）。不得为「统一」给板面的 static 加 `Words` 参数。
- **预览不得留第二份策略**：`face/preview.ts#recordsOf` 的写回判别式与 `#bookkeep` 必须同源（共用一处判定），否则以 preview 的 fix 轮用例把副本钉死。
- **wave 面禁分叉**：`BoardNext#hopOf` 只发**一次** `nextHopOf` 调用，`briefDrift` 作为该输入对象里的一格条件值；禁止为 wave 另开第二个调用。`Lifecycle#hopOf` 只在 wave 帧注入。
- **胶囊在 wave 面不承诺 drift**：`advance` 出的胶囊恒看不到 brief drift（其帧在 `#bookkeep` 重绑之后）。这不是缺陷，是结构事实；**任何任务不得**为了让胶囊渲 `doc-drift` 去改 `#routeNext` 或加第二套路由。
- **零状态迁移**：`progress.json` 的任何键名 / 键集不变；`recordReviewedRevision` 只改文档注释。
- **调用与提交纪律**：引擎一律本地 `node packages/cdd-engine/src-next/bin.ts`；每任务提交过 `pnpm run precommit`；末任务跑 `env -u AI_AGENT pnpm run validate`（`AI_AGENT` 在场会让 5 条既有注入派发 E2E 误红）；changeset `@oscaner-skills/cdd-engine` **minor**（D74），不涉 kairos 包、不发布。

## Review Focus

- **收口之后有人在轮外改文档**：drift 的另一半必须还在——否则「防自旋」被本相位拆掉，未按现版本审过的文档会被交出去。由 Task 1 的用例 B 覆盖。
- **半途被砍的 fix 改了文档**：基线不得推进，下一轮仍判 drift、仍重开 review（让人看半成品）。由 Task 1 的用例 C 覆盖。
- **`next:` 行被脚本 / 技能整行抄走**：`review --type plan --plan <path>` 后面多一个 ` — reason: x` 就会在 shell 里炸。由 Task 2 的「`next:` 字节不变」断言与独立 `reason:` 行覆盖。
- **BLOCKED / TIMEOUT 轮**：既无 `next:` 行就不得有 `reason:` 行——凭空造一个 reason 会让人以为有一个可执行去向。由 Task 2 的 hop-null 断言覆盖。
- **wave 面的胶囊**：drifted wave 上胶囊印的是 C5 路由（`fix` / `pending-fix`），板面与 `peekNext` 印 `review` / `doc-drift`。这是结构差异、不是缺陷；不得有人把它「修」成一致（那要改 `#routeNext` 的路由来源）。由 Task 3 的断言范围（只打 `peekNext` 与板面）固定。

### Task 1: 写回白名单加 `fix` + 预览副本同源 + 三条互锁测试

#### Objective

让**完成**的 fix 轮把它产出的一版写回为该行的 reviewed identity，使 C5 的 `fix blocker==0 → close(state)` 在 doc 线四型与 branch 线上真正可达；同一条判别式在 dry-run 预览里与 `#bookkeep` 同源，不留第二份会烂的策略。

#### Files

- Modify: `packages/cdd-engine/src-next/session/run.ts:705-718`（phase 白名单）· 同文件 `#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision` 的文档注释（`:720-750` 区）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts:793-797`（`recordReviewedRevision` 注释：改为「已入账 identity」）
- Modify: `packages/cdd-engine/src-next/face/preview.ts:147-162`（`#recordsOf` 判别式 + docstring）
- Test: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（新增 describe：doc 线四型 · branch 线 · wave 收口回归 pin）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（新增 fix 轮用例 + 改写 `:126-146` 的陈旧 branch 用例）

#### Consumes

- `Ledger#recordReviewedRevision(key, revision, identity)` · `Ledger#recordReviewedBrief(waveKey, planPath)`（既有，签名不动）
- `Lifecycle#advance()` 与 `run.test.ts` 的 `fixture()` / `stub()` / `finding()` 助手（既有）

#### Produces

- 行为变化（无新导出）：完成的 fix 轮写回 reviewed identity；`face/preview.ts#recordsOf` 对 `fix` 轮报告同一条写。
- 测试助手约定：文档写在 **ledger 的读取基准**下并传**绝对路径**——`doc = path.join(repo, ".kairos", "cdd", DOC)`，首次写前 `mkdirSync(path.dirname(doc), { recursive: true })`（`fixture()` 只建了 `<repo>/.kairos/cdd`）；`stub` 的 dispatch 回调用这个 `doc` 改写文件，代表「fix 轮编辑文档」。`target.doc` 与 branch 线的 `planPath` 一律传绝对路径（branch 线传 `planPath` 本身）：相对值会让 `#abs`（`ledger.ts:905-906`，基准 = workspace root）与 `#recordDocRevisionOf`（`run.ts:750-762`，从 `process.cwd()` 读）读到两个不同文件，用例从此恒绿。`run.test.ts` 的 `node:fs` import 增 `mkdirSync`。

#### Steps

- [ ] **Step 1: 写用例 A（doc 线四型：warn-only 的 review → 改文档的 fix → 收口）** — checkable: 断言面取**胶囊的 `next:` 行**（doc/branch 线上它是 drift 感知的：`#hopOf` → `Ledger#nextHopOf`，其 drift cell 读 `reviewGate`）；在改动前的树上 `fix1.capsuleLines[1]` 以 `next: review` 开头（红），实现后不再以 `review` 开头（收口值随型而定：`done` / 流水线 handoff / `next-wave`）。同一条用例里 `run.peekNext()` 今日给出非 null 的 `review` 帧（`hop.reason === "doc-drift"`）、实现后为 `null`。`fix1.route` 今日已是 `{ kind: "done" }`——它是 C5 的判定（`:813-818`），不读文档——只作辅助事实，**不得**当红证据

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
        // 今日：`next: review --type …`（drift 自噬）· 实现后：收口值（done / handoff / next-wave）
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
- [ ] **Step 4: 写用例 C（半途负控：BLOCKED 的 fix 改了文档，基线不推进）** — checkable: 同一 `doc` 基准；实现后 `run.peekNext()!.frame.phase === "review"`（drift 仍成立），且该断言的驱动是 `{ status: "BLOCKED" }` 的 fix 轮

```ts
// 用例 B 的断言（收口后轮外改动）
expect(run.peekNext()).toBeNull();                        // 收口后无帧
writeFileSync(doc, "---\ndoc-type: phase-spec\nversion: v0.3\nslug: x-design\n---\n\n## Design\n\n- out-of-round\n");
expect(run.peekNext()!.frame.phase).toBe("review");       // 轮外改动仍重开

// 用例 C 的断言（半途被砍的 fix）
const dispatch = stub((frame) => {
  if (frame.phase === "fix") {
    writeFileSync(doc, "---\ndoc-type: phase-spec\nversion: v0.2\nslug: x-design\n---\n\n## Design\n\n- half\n");
    return { status: "BLOCKED", reason: "child died" };
  }
  return { status: "APPROVED", findings: [finding("warn")] };
});
// review1 → fix(BLOCKED) → 基線不推进：下一帧仍是 review
expect(run.peekNext()!.frame.phase).toBe("review");
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
- [ ] **Step 7: 实现白名单** — checkable: `run.ts:705-718` 的条件从 `frame.phase === "review" || frame.phase === "branch-review"` 改为三者并含 `"fix"`，三分支（doc / wave / branch）原样复用；`ledger.ts:793-797` 与三个 `#record…` 的注释改为「完成的 review **或 fix** 轮把该轮产出的 identity 入账」
- [ ] **Step 8: 跑全部用例确认绿** — checkable: `-t "P24 §2"` 全绿（doc 四型 + branch 线 + wave 回归 pin）；且 `-t "the spec/plan small loop"` 与 `-t "the branch small loop"` 既有用例全绿（未被白名单改动打破）
- [ ] **Step 9: 预览副本同源 + fix 轮用例** — checkable: `face/preview.ts#recordsOf` 的判别式与 `#bookkeep` 同源（共用一处判定；无法共用时以注释指明两处必须同改），docstring 改为「on a completed review **or a fix**」；`preview.test.ts` 新增用例断言 doc 线 fix 轮 dry-run 的 `would record:` 含 `reviewedRevision(doc)`，并改写 `:126-146` 的陈旧 branch 用例（改为含 `reviewedRevision(doc)`）
- [ ] **Step 10: 跑 preview 套件 + 提交** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/preview.test.ts` 绿；`pnpm run precommit` 绿；`git commit -m "fix(cdd-engine): a completed fix round advances the line's reviewed identity"`

#### Acceptance

- doc 线四型（phase-spec / overall / plan / single-spec）各有一条用例：warn-only review → 改文档的 fix → 胶囊的 `next:` 行为收口（不再以 `review` 开头）且 `peekNext()` 为 `null`，并在改动前的树上**必红**。`route` 为 `{ kind: "done" }` 同时成立，但它是 C5 的既有事实（今日即绿），只作辅助断言。
- branch 线同断言一条（branch fix 改 plan → 胶囊 `next:` 收口 + `peekNext()` 为 `null`，改动前必红）。
- wave 收口回归 pin 一条：白名单加 `fix` 后，blocker-free 的 fix 仍收口（`advance()` 与 `peekNext()` 均为 `null`），改动前后都绿。
- 收口后由「轮外」写文档 → `peekNext()` 的帧为 `review`（防自旋未失效）。
- `{ status: "BLOCKED" }` 的 fix 且改了文档 → 基线不推进，`peekNext()` 帧仍为 `review`。
- 预览面 fix 轮 dry-run 报告 `reviewedRevision(doc)`；preview 的陈旧 branch 断言已改为实际行为。
- `progress.json` 键集不变（无迁移）。

#### DependsOn

none

### Task 2: `reason:` 行渲染（站表 + 胶囊 + 板面）+ 16 处重锚 + 陈旧散文

#### Objective

让每个由 hop 渲染出的 `next:` 行之后紧跟一行 `reason: <token>`（token 取 `NEXT_HOP_REASON` 七值），`next:` 行字节零变；胶囊与板面同值。

#### Files

- Modify: `packages/cdd-engine/src-next/face/words.ts:47`（`StationKind` 加 `"reason"`）· `:194-199`（`CAPSULE_WORDS.stations` 增 `reason: "reason:"`）
- Modify: `packages/cdd-engine/src-next/face/route-render.ts`（新增 `renderReason(hop: NextHop | null): string | null`；`renderHop` 不动）
- Modify: `packages/cdd-engine/src-next/face/capsule.ts:133-134`（前缀取 `words.station("reason")`，值取 `renderReason`）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts:349-358`（`nextLine` 旁增 `static reasonLine(hop, renderer)`，前缀布局字面 `  reason:  `）· `:558`（调用点后追加一行）
- Test: `packages/cdd-engine/src-next/face/__tests__/face.test.ts`（13 处整块快照 + 站表长度 4→5 + 陈旧散文 `:8` · `:101`）
- Test: `packages/cdd-engine/src-next/face/__tests__/capsule.test.ts`（2 处整块快照 + 陈旧散文 `:474`）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`reason:` 行渲染 · hop-null 无行 · 胶囊 ⇄ 板面 token 同值 pin）

#### Consumes

- `NextHop.reason`（既有字段，七值）· `RouteRenderer#renderHop`（既有）
- `Words#station(kind)`（既有；Task 2 为站表加第五行）

#### Produces

- `StationKind` 增 `"reason"`；`CAPSULE_WORDS.stations.reason === "reason:"`
- `RouteRenderer#renderReason(hop: NextHop | null): string | null` — hop 为 `null` 返回 `null`，否则返回 `reason: <hop.reason>`
- `BoardView.reasonLine(hop: NextHop, renderer: RouteRenderer): string` — 返回 `  reason:  <token>`

#### Steps

- [ ] **Step 1: 写红测试（胶囊）** — checkable: `face.test.ts` 新增用例断言 `capsule.emit("APPROVED", "/h.json", hopOf({ kind: "review" }))` 的**末元素**为 `` `reason: ${NEXT_HOP_REASON.taskOpen}` `` —— 今日 FAIL（无该行）
- [ ] **Step 2: 写红测试（hop 为 null 不渲）** — checkable: 既有 hop-absent 快照（`face.test.ts:109`（成功无 hop）· `:114`/`:118`（BLOCKED / TIMEOUT）· `:222`/`:223`；`capsule.test.ts:470`/`:490`/`:491`）**一行不改**仍绿（若实现给它们加了 `reason:` 行则红）
- [ ] **Step 3: 站表加第五行** — checkable: `StationKind` 与 `stations` 各加 `reason`；`face.test.ts:103` 的长度断言由 4 改 5；`:66-69` 四条逐键断言不动
- [ ] **Step 4: 实现 `renderReason` 并接到胶囊** — checkable: `renderHop` 一行未动；胶囊在 `next` 非 null 时追加一行

```ts
// face/route-render.ts
renderReason(hop: NextHop | null): string | null {
  return hop === null ? null : `${this.#words.station("reason")} ${hop.reason}`;
}

// face/capsule.ts（:133-134 之后）
const next = this.#route.renderHop(hop ?? null);
if (next !== null) {
  lines.push(`${words.station("next")} ${next}`);
  const reason = this.#route.renderReason(hop ?? null);
  if (reason !== null) lines.push(reason);
}
```

- [ ] **Step 5: 板面渲染** — checkable: `reasonLine` 与 `nextLine` 同形（布局字面，不取词表），`:558` 之后追加；`:556` 的 `(none)` 与 `:623` 的程序板 `done` **不追加**（字节零变）
- [ ] **Step 6: 胶囊 ⇄ 板面 `reason:` 同值 pin** — checkable: 沿用 `board-view.test.ts:1612-1654` 的 frontier-hop 夹具形状（`peekNext().hop` → 胶囊 `emit(…)[1]` 对 `nextOfBoard`），断言两面的 **token 等值**——`capsule.emit(…)[2]!.slice("reason: ".length)` 与板面 `  reason:  ` 行的 `trim().slice("reason: ".length)`；前缀各按自己的家（胶囊走站表、板面走布局字面），故只比 token。两面共用 `renderReason`，这条 pin 只钉「将来有人只改一面」
- [ ] **Step 7: 重锚 15 处整块快照** — checkable: `face.test.ts` 13 处 / `capsule.test.ts` 2 处，各新增**一个** `reason:` 元素。13 处按 `toEqual(` 行在册：`:124`（done）· `:128`（next-wave）· `:136`（review）· `:147`（fix + reviews）· `:152`（bare fix）· `:163`（soft-cap，单行数组）· `:171`（review + wave target）· `:182`（fix + wave target）· `:195`（review + branch target）· `:205`（review + phase-spec target）· `:213`（next-wave + wave target）· `:226`（done）· `:266`（T8 seam 的 `lines`），另 `capsule.test.ts:482` · `:498`（spec §7 第 2 类按 `capsule.emit(...)` 调用行登记，两者逐处一一对应）。**token 不得猜**——先实现再一次性重锚：跑套件，从失败断言的 `received` 里逐处抄实际值，一条不漏。取值来源（`#reasonOf` 的序，`session/next.ts:396-404`）：`fix` ⇒ `pending-fix` · `soft-cap` ⇒ `soft-cap` · `review` + drift ⇒ `doc-drift` · 其余活 hop（`review` 未 drift / `next-wave`）⇒ `task-open` · doc-class blocked ⇒ `doc-class-blocked` · 无路由或 terminal ⇒ `face-closed` · 闭线 ⇒ `closed-line`；`received` 仍是权威
- [ ] **Step 8: 改写陈旧散文（9 处）** — checkable: `face.test.ts:8` · `:101` · `capsule.ts:19` · `:67` · `run.ts:262` · `capsule.test.ts:474` · `cli.test.ts:1960` · `run.ts:239` · `:876` —— 一律改为「`next:` 行 + 紧随其后的 `reason:` 行」；断言字节零变。`session/__tests__/run.test.ts` 无此散文（其 `next:` 提及是断言，以及一条「prints no `next:` line」的缺席断言），不进这九处
- [ ] **Step 9: 跑三套件 + 提交** — checkable: `face.test.ts` / `capsule.test.ts` / `board-view.test.ts` 全绿；`next:` 行断言（`lines[1]` 抽取与 `toContain`）零改动仍绿；`pnpm run precommit` 绿；`git commit -m "feat(cdd-engine): render the hop reason on its own line after next:"`

#### Acceptance

- 每个由 hop 渲染出的 `next:` 行之后紧跟一行 `reason: <token>`，token ∈ `NEXT_HOP_REASON` 七值。
- `next:` 行字节与今日逐字节相同（152 处既有断言中 137 处零改动即证）。
- hop 为 `null` 的轮（BLOCKED / TIMEOUT）两面都不渲 `reason:` 行。
- 胶囊与板面对同一 hop 渲同值（token 等值；前缀各按自己的家：胶囊走站表、板面走布局字面），由 Step 6 的 pin 钉住；板面的 `(none)` 与程序板 `done` 两行字节零变。
- 站表五行（长度 pin 已重锚），`routeWords` 一行未动。

#### DependsOn

none

### Task 3: wave 面的 `briefDrift` 注入（一个判定、四个读者）

#### Objective

让 wave 线的 `reason` 能取到 `doc-drift`：把 `#briefDrift` 提为公开读、经 **`Ledger#nextHopOf` 自己入参对象的** `briefDrift` cell 注入（`NextHopInput` 是 router 的输入面，drift 事实在那里走既有 `gate.drift`，一字不动），由 `Lifecycle#hopOf`（服务 `peekNext` 的活读者）与 `BoardNext#hopOf`（板面）喂同一 fact。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`#briefDrift` → public `briefDrifted(waveKey: string): boolean`，内部读 `reviewedRevisionOf(waveKey)`）· `:983`（`waveLineRoute` 的 D30 腿改调它）· `:1219-1229`（`nextHopOf` 的**内联入参类型**新增可选 `briefDrift?: boolean`，落在 `nextLineOpen` 旁）· `:1230-1233`（drift cell 读注入值）
- No change: `packages/cdd-engine/src-next/session/next.ts:208-226`——`NextHopInput` **不**加 cell。它是 `NextStepRouter#nextHop` 的输入面（`:341-355`），drift 事实在那里走既有 `gate.drift`（由 `nextHopOf` 填）；加到这个类型上会是一个没人读的字段，且两个注入点会因 excess property 被 `tsc` 拒绝
- Modify: `packages/cdd-engine/src-next/session/run.ts:836-849`（`#hopOf` 在 wave 帧注入）· `packages/cdd-engine/src-next/face/board-view.ts:849-861`（那一次 `nextHopOf` 调用的输入对象加一格）
- Test: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（`peekNext` 的 token 红→绿）· `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（板面 token 红→绿）

#### Consumes

- `Ledger#waveLineRoute` 的 D30 腿（既有）· `RouteRenderer#renderReason`（Task 2）
- `Lifecycle#peekNext()`（既有；frontier 面的活读者）

#### Produces

- `Ledger#briefDrifted(waveKey: string): boolean`（public；`#briefDrift` 唯一实现）
- `Ledger#nextHopOf` 入参新增可选 `briefDrift?: boolean` ——只改该调用的 drift cell（`true` 时 wave 线的 `drift` 为真，`gate.drift` 随之填真）；`NextHopInput` 形状不变，缺省 `undefined` 时行为与今日一致
- 行为变化：drifted 且 fix 待办的 wave 在 `peekNext()` 与板面渲 `reason: doc-drift`（今日为 `task-open`）

#### Steps

- [ ] **Step 1: 写红测试（`peekNext` 的 token）** — checkable: 构造「wave review 出 warn（绑定 brief）→ 轮外改 plan 的该 wave 段 → 无 fix 记录」，断言 `run.peekNext()!.hop.reason === "doc-drift"` 且 `renderReason` 渲 `reason: doc-drift` —— 今日为 `"task-open"`
- [ ] **Step 2: 跑它并确认红** — checkable: 实际值 `"task-open"`
- [ ] **Step 3: 提公开读 + 改 D30 腿调用点** — checkable: `briefDrifted` 与 `#briefDrift` 只有一份实现；`waveLineRoute` 行为不变（既有 T11/D30 用例全绿）
- [ ] **Step 4: 加 `nextHopOf` 入参的 `briefDrift` cell + 改 drift cell** — checkable: 入参 `briefDrift` 为 `true` 时 wave 面的 `drift` 为真（`gate.drift` 为真 ⇒ `#reasonOf` 把 `review` 路由的 token 从 `task-open` 改为 `doc-drift`），doc/branch 面仍读 `reviewGate`；缺省时行为零变。**替换谓词一行不动**（`drift && Ledger.onExitSide(input.route)`）：wave 面能观察到的 drift 路由恒为 `review`（`waveLineRoute:983` 已把 drifted 的 fix-pending 改写成 review）或 `null`（exit 侧），故不加 wave 例外——那条分支不可达，按仓库的 no-dead-code 纪律不写
- [ ] **Step 5: 两处注入** — checkable: `Lifecycle#hopOf` 在该 `nextHopOf` 入参对象的 `briefDrift` 一格上于 `frame.type === "wave"` 时传 `this.#ledger.briefDrifted(String(frame.key))`；`BoardNext#hopOf` 在既有那一次 `nextHopOf` 调用里传 `target?.type === "wave" ? facts.ledger.briefDrifted(String(target.id)) : undefined`（**不得**新增第二次调用，方法签名不动）
- [ ] **Step 6: 板面断言** — checkable: `board-view.test.ts` 断言同一状态下板面的 `next:` 行为 review lead、`reason:` 行为 `doc-drift`
- [ ] **Step 7: 负控（胶囊不承诺 drift）** — checkable: 断言 `advance()` 产出的胶囊在 drifted wave 上**不带** `doc-drift`（其帧在重绑之后）；该断言写进用例，防止后人「修一致」而改掉 `#routeNext`
- [ ] **Step 8: 跑套件 + 提交** — checkable: `run.test.ts` / `board-view.test.ts` / `ledger.test.ts` 全绿；`pnpm run precommit` 绿；`git commit -m "feat(cdd-engine): the wave line's drift fact feeds the next-hop reason"`

#### Acceptance

- drifted 且 fix 待办的 wave：`peekNext()` 与板面渲 `reason: doc-drift`，且在改动前的树上必红（今日 `task-open`）。
- `briefDrifted` 是唯一实现，`waveLineRoute` 的 D30 腿与它同源；既有 T11/D30 用例全绿。
- `briefDrift` 缺省时行为与今日逐字节一致（wave 之外的四个 face 不受影响）。
- 胶囊路径不被承诺：一条断言固定「`advance` 的胶囊不带 `doc-drift`」。
- wave 的收口回归 pin 归 Task 1（白名单加 `fix` 是唯一会改变 wave 写回的改动）；本任务只负责 frontier ⇄ 板面的 token 断言与胶囊负控。

#### DependsOn

2

### Task 4: 消费面一句 + changeset + 全量验收

#### Objective

把根 README 那句会变陈旧的输出承诺改准（英 + 中镜像），并给本次消费面可见变化落一条 `cdd-engine` minor 的 changeset，最后跑全量验收。

#### Files

- Modify: `README.md:60`（该 bullet 的粗体首句 + 三从句一并改写）
- Modify: `README.zh-CN.md:64`（镜像同步）
- Create: `.changeset/p24-nextloop-closeout.md`

#### Consumes

- Task 1/2/3 的落地行为（收口可达成 · `reason:` 行 · wave 的 `doc-drift`）

#### Produces

- 无代码导出；消费面文案与发行声明。

#### Steps

- [ ] **Step 1: 改英文 bullet** — checkable: 该 bullet 读作「The next hop is derived, then printed with its reason. Each run ends with its `next:` line and the reason line that follows it, and `cdd board --plan <path>` renders that same judgment as a progress board — the line and the board cannot disagree.」（三个从句都在）
- [ ] **Step 2: 同步中文镜像** — checkable: `README.zh-CN.md:64` 与英句逐句对应，含第三从句（看板一致性）
- [ ] **Step 3: 写 changeset** — checkable: `.changeset/p24-nextloop-closeout.md` front-matter 为 `"@oscaner-skills/cdd-engine": minor`，正文写清三件消费面可见的事：① 零 blocker 的 fix 之后行能收口（此前被自己的产出打回）② 每条 `next:` 行后多一行 `reason: <token>` ③ wave 线的 drift 重开在 board / `peekNext` 上标 `doc-drift`
- [ ] **Step 4: 全量验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0（emit fresh · root · kairos · engine 三套件 · typecheck ×3 · version-sync · no-bare-functions）
- [ ] **Step 5: 提交** — checkable: `git commit -m "docs+release: P24 consumer face and the cdd-engine minor changeset"`；`git status --porcelain` 为空

#### Acceptance

- 根 README 英中两处表述一致且保留「line 与 board 不可能互相矛盾」这一句。
- changeset 存在、级别为 `cdd-engine` minor、正文覆盖三件消费面可见变化。
- `env -u AI_AGENT pnpm run validate` 退出码 0；`pnpm run emit:check` fresh。
- 树干净。
- **§6 的验收演示留证**：本相位之后的 plan 线 / 波形若出现「零 blocker 的 fix 之后收口」，取其 `next:` 输出记入 plan 的 change history；若 plan 一轮即 APPROVED，则以 spec 线已发生的六轮（零 blocker 的 fix 被 drift 打回三次）为既有事实，在 change history 里指回 spec。

#### DependsOn

1, 2, 3

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-04 | 初稿：四任务三波——W1 {1,2}（写回白名单 + 预览同源 ‖ reason 行渲染 + 16 锚 + 散文）、W2 {3}（wave `briefDrift` 注入）、W3 {4}（README + changeset + 全量验收） | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-04） |
| v0.2 | 2026-11-04 | 第 1 轮评审回填（无结构变更，内容面）：① 红证据换面——`StepResult.route` 是 C5 路由（`session/run.ts:436-447` → `#routeNext` `:813-818`），不读文档、今日即 `{kind:"done"}`，故 Task 1 的必红断言改盯 drift-aware 的胶囊 `next:` 行（doc 线四型 + branch 线），`route` 降级为辅助事实 ② 夹具落回 ledger 读取基准——`fixture()` 只建 `<repo>/.kairos/cdd`，文档须写在该基准下并传绝对路径（先 `mkdirSync(…, { recursive: true })`），用例 A/B/C 与 branch 用例同一接线，并写明惰性夹具的自查信号 ③ `briefDrift` cell 落到 `Ledger#nextHopOf` 的内联入参（`session/ledger.ts:1219-1229` · drift cell `:1230-1233`），`NextHopInput` 与 `#reasonOf` 一行不动 ④ 删掉 wave 的 `onExitSide` 豁免死分支（不可达），Step 4 记可达性论证 ⑤ 补三条缺 owner 的验收：branch 线用例与 wave 收口回归 pin（Task 1）、胶囊 ⇄ 板面 `reason:` token pin（Task 2 Step 6）⑥ 13 处 `toEqual` 快照以 `toEqual(` 行在册（五处 stale 行号改正；`:213` 对应 spec §7 的 emit 行 `:212`）⑦ `#reasonOf` 取值表替换「`nextLineOpen` 决定 token」的假断言 ⑧ 陈旧散文九处删掉 `run.test.ts` ⑨ `face.test.ts:109` 标签改正 ⑩ 补 EOF 换行 | Oscaner M. · Claude（kairos:cdd-plan [P24] 第 1 轮评审回填 · 2026-11-04） |
