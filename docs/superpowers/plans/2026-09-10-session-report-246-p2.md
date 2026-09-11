# P2 cdd review spec/plan Stopping ref 内容状态维度（演进重审通道）— Implementation Plan

**Spec:** [2026-09-10-session-report-246-p2-design.md](docs/superpowers/specs/2026-09-10-session-report-246-p2-design.md)（v1.1：v1.0 + ghost-doc CDD_INFO 抑制细化（gate `&& docHash`）、§2.4/§2.5 双补 BLOCKED 失败轮 + ghost 边角 + 真实 schema 往返——plan-review r2 驱动；review 绑定内容状态 token 统一原则——四 type 收敛 task/branch=git-range / spec/plan=doc_hash；`(doc_path, doc_hash)` 双签名 Stopping ref；内容演进即新 ref 自动放行、未变仍 exit 3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 cdd-engine spec/plan review 补内容状态维度——docs review handoff 携带 `doc_hash`（sha256 内容指纹）+ Stopping gate 升级 `(doc_path, doc_hash)` 双签名，使内容实质演进即新 ref、可开新 review cycle（F5），未变内容仍硬停 exit 3，并文档化演进重审路径。

**Architecture:** 四任务顺序——① `lib/runner/review-loop.mjs` 增 `hashFile` helper（sha256 hex / 缺失文件 `""` 哨兵）+ 单测；② `lib/cli/review.mjs` spec/plan gate 升级双签名 + `reviewStoppingGuard/reviewStoppedError` 增 `{ reason }` 分场景消息 + cdd.test.mjs 黑盒内容状态矩阵（7 用例）；③ `lib/runner/run-docs.mjs` review-mode 定稿注入 `doc_hash` + docs-handoff-schema 扩展 + docs-runner.test.mjs 断言（T5 回归 / 真实内容 / plan 镜像 / fix 负向 / BLOCKED 注入）；④ review.md（URC）Stopping 规则四 type 统一表述 + 演进重审路径 + `pnpm run emit` + changeset（cdd-engine minor）+ 全量 validate。模块触碰纪律：每模块只动一次（`review-loop.mjs` 例外——Task 1 增 `hashFile` 导出 + Task 2 改 `reviewStoppedError` reason 分写为两处加性不重叠改动，顺序先在先）。

**Tech Stack:** Node ESM + `node:crypto` sha256 + vitest（`packages/cdd-engine`）+ changesets。

## Global Constraints

- **内容状态原则**（spec §2.1）：review 绑定被审内容的状态而非位置；spec/plan Stopping ref = `(doc_path, doc_hash)` 双签名——同路径同内容 → 同 ref → U1 硬停；同路径异内容 → 新 ref → 自动放行新一轮。task/branch 的 git-range ref 机制**不动**。
- **hash 尺度**（spec §2.2 bullet 1）：全字节 sha256（`node:crypto`），不归一化——白空格/行尾异动触发新一轮是良性代价，注释与 review.md 显式记录。
- **放行方式**（spec §2.2 bullet 2）：内容变即新 ref 自动放行，**不加确认旗标/旁路面**；U1 真防护（内容未变重跑）由同 hash 硬停完整保留。
- **legacy 语义**（spec §2.2 bullet 3）：`prev.doc_hash == null` → 内容状态未知 → 视同 ref 相同 → 走既有 gate 硬停；新放行通道只对携 `doc_hash` 的新 handoff 打开。不意外重开在途 workspace。
- **消息不变量**：exit-3 消息不再含旧「change ref to open a new review」impossible 措辞；`unchanged` reason → 「编辑 doc 内容 / 新建 doc 可开新 review」；`legacy` reason →「新建 doc / 移除陈旧 review handoff」——legacy 不许给不可达的改动指引；reason 缺省（task/branch 调用面）保留现消息原文。
- **CDD_INFO 抑制**（spec §2.3.2 + r2 细化）：内容演进放行提示仅 `prev.status === "APPROVED" && docHash`（非空）时打印——BLOCKED/CHANGES_REQUESTED prev 无声放行（SP-4）；ghost doc（hashFile 空串哨兵）属 §2.4 缺失边角，不印「内容演进」误导消息。
- **注入范围**（spec §2.2 bullet 4）：`doc_hash` 仅 docs **review-mode** 定稿 + 两条 BLOCKED 失败写盘；fix-mode 不注入（p persistFinalized 原样）；内存返回值与磁盘定稿一致（`local.status = finalized.status` + `local.doc_hash`）。
- **schema**：docs-handoff-schema.json 增 `doc_hash`（optional string，不进 required——老 handoff 不失效）；`additionalProperties: false` 已声明属性后不误伤。doc_hash 由引擎定稿注入（载体唯一作者 T7，agent 不贡献）。
- **唯一 gate 谓词改动点**：`lib/cli/review.mjs` spec/plan 分支（`prev.doc_path === doc` 处）；消息单点 `reviewStoppedError`（review-loop.mjs）。
- vendored 子模块不可改；specs/plans 属于 Strategy B（中文）不触发 emit；skills 侧 `_docs/review.md` 改动**必须** `pnpm run emit`（`.agents/` 为派生产物禁手编）+ `pnpm run emit:check` 绿。
- conventional commit 无 attribution trailer；每任务结束前 `pnpm run validate` 全绿；批次末 changeset `@oscaner-skills/cdd-engine` minor。

---

### Task 1: `hashFile` 内容指纹 helper + 单元测试

<thinking>原子单元：review-loop.mjs 增 `hashFile(doc)`——sha256 hex；缺失/读失败 → `""`（空串哨兵，与真实 hex 永不等）。这是 §2.3.1 规范化 helper，Task 2/3 双消费方（gate + 定稿注入）。单测放 review-loop.test.mjs。</thinking>

**Files:**
- Modify: `packages/cdd-engine/lib/runner/review-loop.mjs`（顶部 import + `hashFile` 导出）
- Test: `packages/cdd-engine/tests/review-loop.test.mjs`（hashFile 单测簇 + reviewStoppedError 既有断言保持绿）

**Interfaces:**
- Consumes: 无（起点任务）
- Produces: `export function hashFile(doc) → string`（64-char hex | `""`）——Task 2 gate、Task 3 定稿注入消费

- [ ] **Step 1: 写失败测试**

在 `tests/review-loop.test.mjs` 末尾追加：

```js
import { createHash } from "node:crypto";
describe("hashFile（§2.3.1 内容状态 token：sha256 hex / 缺失 → 空串哨兵）", () => {
  it("真实文件 → 64-char sha256 hex", async () => {
    const { hashFile } = await import("../lib/runner/review-loop.mjs");
    const dir = mkdtempSync(join(tmpdir(), "hashf-"));
    const doc = join(dir, "a.md");
    writeFileSync(doc, "hello p2");
    const expectHex = createHash("sha256").update("hello p2").digest("hex");
    expect(hashFile(doc)).toBe(expectHex);
    expect(hashFile(doc)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("缺失文件 → 空串哨兵（≠ 任何真实 hex）", async () => {
    const { hashFile } = await import("../lib/runner/review-loop.mjs");
    expect(hashFile(join(tmpdir(), "nope-p2-" + Date.now() + ".md"))).toBe("");
  });
  it("目录（readFileSync EISDIR）→ 空串哨兵（读失败统一归哨兵）", async () => {
    const { hashFile } = await import("../lib/runner/review-loop.mjs");
    expect(hashFile(tmpdir())).toBe("");
  });
});
```

注意：`review-loop.test.mjs` 现仅 import 了 `it/expect`——新增 `describe` import；`mkdtempSync/join/tmpdir/createHash/writeFileSync` 已在 hook 顶部或按需补 import（现有 `import { mkdtempSync, writeFileSync } from "node:fs"; import { join } from "node:path"; import { tmpdir } from "node:os";` 已有，补 `import { createHash } from "node:crypto";`）。

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /Users/kang/Projects/oscaner-skills/packages/cdd-engine && npx vitest run tests/review-loop.test.mjs
```

Expected: FAIL — `hashFile is not a function`（或 import 错误）。

- [ ] **Step 3: 实现 `hashFile`**

`lib/runner/review-loop.mjs` 顶部 import + 导出：

```js
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// 内容状态 token（spec §2.1/§2.3.1）：被审文档的全字节 sha256 hex。
// 尺度选择（§2.2 bullet 1）：不归一化——白空格/行尾异动会触发新一轮，单轮 review dispatch 是良性代价。
// 缺失/读失败 → "" 哨兵（与真实 hex 永不等）：gate 按「ref 变了」放行，下游 runDocsTask 对幽灵 doc 自然失败。
export function hashFile(doc) {
  try {
    return createHash("sha256").update(readFileSync(doc)).digest("hex");
  } catch {
    return "";
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /Users/kang/Projects/oscaner-skills/packages/cdd-engine && npx vitest run tests/review-loop.test.mjs
```

Expected: PASS（新增 3 例 + 既有 reviewStoppedError `/blocker=0/` 用例仍绿）。

- [ ] **Step 5: 全量 validate + commit**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
git add packages/cdd-engine/lib/runner/review-loop.mjs packages/cdd-engine/tests/review-loop.test.mjs
git commit -m "feat(cdd-engine): add hashFile content-state token helper（sha256 hex / 缺失空串哨兵，§2.3.1）"
```

Expected: validate 12 块 ALL PASS；commit 成功（pre-commit hook 会再跑 validate）。

---

### Task 2: Stopping gate 升级 `(doc_path, doc_hash)` 双签名 + reason 分场景消息 + 黑盒矩阵

<thinking>原子单元：① `reviewStoppedError/reviewStoppingGuard/stoppedExit3` 增 `{ reason }` 选参（legacy/unchanged 分写消息，缺省保留现文案——task/branch 调用面不变）；② review.mjs spec/plan gate 升级双签名 + CDD_INFO 演进放行提示（仅 prev APPROVED 且 docHash 非空）；③ cdd.test.mjs 黑盒内容状态矩阵 8 用例（含 plan 家族镜像 + `--round` 共存 + legacy 消息对照 + CDD_INFO 抑制 + BLOCKED/CHANGES_REQUESTED 失败轮 + doc 缺失边角）。</thinking>

**Files:**
- Modify: `packages/cdd-engine/lib/runner/review-loop.mjs`（`reviewStoppedError` 增 reason 分写）
- Modify: `packages/cdd-engine/lib/cli/review.mjs`（import hashFile；gate 升级；`stoppedExit3`/`reviewStoppingGuard` 透传 opts）
- Test: `packages/cdd-engine/tests/cdd.test.mjs`（`seedDocsReviewRound` 增 docHash/content 参数；内容状态矩阵黑盒用例）

**Interfaces:**
- Consumes: `hashFile`（Task 1）
- Produces: gate 双签名行为（Task 3 定稿后真实 review handoff 自动携 hash 落盘，黑盒矩阵即闭环）；`reviewStoppingGuard(prev, type, round, ref, opts?)` 新选参

- [ ] **Step 1: reviewStoppedError 消息按 reason 分写（保持 `/blocker=0/` 前缀不变量）**

`lib/runner/review-loop.mjs` 替换 `reviewStoppedError`：

```js
export function reviewStoppedError(type, round, ref, { reason } = {}) {
  const prev = Math.max(round - 1, 1);
  const tail = reason === "legacy"
    ? `Review Stopping: do not re-run — pre-content-hash review handoff (no doc_hash) at round ${prev}; content state unknown: open a new doc or remove the stale round-${prev} review handoff to re-review`
    : reason === "unchanged"
      ? `Review Stopping: do not re-run — doc content unchanged since round ${prev} clean review: edit the doc content or open a new doc to start a new review`
      : "Review Stopping: do not re-run; change ref to open a new review";
  return new Error(`round ${round} (${type}, ${ref}) already blocker=0 — ${tail}`);
}
```

- [ ] **Step 2: review.mjs guard/stoppedExit3 透传 opts**

`lib/cli/review.mjs` 中：

```js
export function stoppedExit3(type, round, ref, blocker, opts) {
  const e = reviewStoppedError(type, round, ref, opts);   // structured error + message, single authority
  process.stderr.write(`${e.message}\n` + (blocker ? `last blocker: ${blocker}\n` : ""));
  exitWithCode(3);
}

export function reviewStoppingGuard(prev, type, round, ref, opts) {
  if (prev && prev.status === "APPROVED" && blockerCount(prev) === 0) stoppedExit3(type, round, ref, prev?.blocker, opts);
}
```

（task 分支调用 `reviewStoppingGuard(th, "task", prevR, opts.plan)` 无 opts → 缺省 reason → 现文案不变。）

- [ ] **Step 3: spec/plan gate 升级双签名 + CDD_INFO**

`lib/cli/review.mjs` import 行改为：

```js
import { reviewStoppedError, hashFile } from "../runner/review-loop.mjs";
```

spec/plan 分支 gate 替换（现 `const prev = ...; if (prev && (prev.doc_path ?? "") === doc) reviewStoppingGuard(prev, opts.type, round, doc);`）：

```js
const prev = existingRoundHandoff(ws, opts.type, round - 1);
// Stopping ref 状态绑定位（spec §2.3.2）：同路径 + 同 doc_hash → 同 ref（U1 硬停）；
// 内容演进 → 新 ref（自动放行新一轮）；legacy（无 doc_hash）→ 内容状态未知 → 保险硬停（§2.2 bullet 3）。
// BLOCKED/TIMEOUT 失败轮无视 hash 无声放行（SP-4）。
if (prev && (prev.doc_path ?? "") === doc) {
  const docHash = hashFile(doc);
  const legacy = prev.doc_hash == null;
  const contentSame = !legacy && prev.doc_hash === docHash;
  if (legacy || contentSame) {
    reviewStoppingGuard(prev, opts.type, round, doc, { reason: legacy ? "legacy" : "unchanged" });
  } else if (prev.status === "APPROVED" && docHash) {
    // 内容演进 + 既有 clean review → 新 ref → 放行 + 自文档化。
    // docHash 空串哨兵（ghost doc，§2.4）不印 CDD_INFO —— 已删文档非「演进」：静默放行、下游自然失败。
    process.stderr.write(`CDD_INFO: doc content changed since round-${round - 1} clean review (${prev.doc_hash.slice(0, 8)} → ${docHash.slice(0, 8)}) → new review round ${round}\n`);
  }
}
```

- [ ] **Step 4: seed 辅助扩展 + 黑盒矩阵 7 用例**

`tests/cdd.test.mjs` 顶部补 `import { createHash } from "node:crypto";`；替换 `seedDocsReviewRound` 为：

```js
function sha256(s) { return createHash("sha256").update(s).digest("hex"); }
function seedDocsReviewRound(repo, doc, fileName, { docHash, content = "" } = {}) {
  const ws = path.join(repo, ".superpowers", "cdd", "foo");
  mkdirSync(path.dirname(doc), { recursive: true });
  mkdirSync(ws, { recursive: true });
  writeFileSync(doc, content);                 // hashFile 读实时文件——内容由用例显式控制
  const handoff = { task: 0, phase: "review", status: "APPROVED", findings: [], artifacts: {}, doc_path: doc };
  if (docHash) handoff.doc_hash = docHash;
  writeFileSync(path.join(ws, fileName), JSON.stringify(handoff));
  return ws;
}
```

在 `describe("P6 T3: ...")` 内（canonical Stopping 黑盒区）追加矩阵 describe：

```js
describe("P2 F5: spec/plan Stopping ref 内容状态维度（doc_hash 双签名矩阵）", () => {
  it("内容未变 + doc_hash 相等 + APPROVED+0 → exit 3（U1 保留；unchanged 消息，无旧 impossible 措辞）", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      seedDocsReviewRound(dir, doc, "spec-review-1.json", { docHash: sha256("v1"), content: "v1" });
      const r = runCli(["review", "--type", "spec", "--spec", doc],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/already blocker=0 — Review Stopping/);
      expect(r.stderr).toMatch(/doc content unchanged/);
      expect(r.stderr).toMatch(/edit the doc content or open a new doc/);
      expect(r.stderr).not.toMatch(/change ref to open a new review/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("内容演进 + doc_hash 异 + APPROVED+0 → 放行新一轮（round 2 + CDD_INFO）", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      seedDocsReviewRound(dir, doc, "spec-review-1.json", { docHash: sha256("v1"), content: "v2" }); // 内容实为 v2，旧 review 验的是 v1
      const r = runCli(["review", "--type", "spec", "--spec", doc],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);
      expect(r.stderr).toMatch(/CDD_INFO: doc content changed since round-1 clean review/);
      expect(r.stderr).toMatch(/new review round 2/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("legacy handoff（无 doc_hash）+ APPROVED+0 → exit 3（内容状态未知硬停；legacy 消息不给改动指引）", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      seedDocsReviewRound(dir, doc, "spec-review-1.json", { content: "v1" });   // 不传 docHash → legacy
      const r = runCli(["review", "--type", "spec", "--spec", doc],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/content state unknown/);
      expect(r.stderr).toMatch(/open a new doc or remove the stale/);
      expect(r.stderr).not.toMatch(/edit the doc content/);   // legacy 不给不可达改动指引
      expect(r.stderr).not.toMatch(/change ref to open a new review/);   // §2.5 item 8 双场景禁用（与 case 1 对称）
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("CHANGES_REQUESTED prev + 同内容同 hash → 无声放行（SP-4；CDD_INFO 抑制）", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      const ws = seedDocsReviewRound(dir, doc, "spec-review-1.json", { docHash: sha256("v1"), content: "v1" });
      // 覆写 status = CHANGES_REQUESTED（同 hash 同内容）→ 应无声放行、无 CDD_INFO
      const hf = path.join(ws, "spec-review-1.json");
      const h = JSON.parse(readFileSync(hf, "utf8")); h.status = "CHANGES_REQUESTED";
      writeFileSync(hf, JSON.stringify(h));
      const r = runCli(["review", "--type", "spec", "--spec", doc],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);                    // 放行（blocker>0 重审权 SP-4）
      expect(r.stderr).not.toMatch(/CDD_INFO/);      // 非 clean prev → 自文档化抑制（§2.3.2）
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("BLOCKED prev + 内容演进（hash 异）→ 无声放行、无 CDD_INFO（SP-4 §2.4 失败轮照旧；else-if 不进入）", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      const ws = seedDocsReviewRound(dir, doc, "spec-review-1.json", { docHash: sha256("v1"), content: "v2" });
      // 覆写 status = BLOCKED（内容 v2 ≠ 旧 review 验的 v1）→ 无声放行，else-if（仅 clean prev）不进入 → 无 CDD_INFO
      const hf = path.join(ws, "spec-review-1.json");
      const h = JSON.parse(readFileSync(hf, "utf8")); h.status = "BLOCKED";
      writeFileSync(hf, JSON.stringify(h));
      const r = runCli(["review", "--type", "spec", "--spec", doc],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);                    // 失败轮重派（SP-4）
      expect(r.stderr).not.toMatch(/CDD_INFO/);      // 非 clean prev → 自文档化抑制
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("内容演进 + 显式 --round 2（= engine 推导）→ 放行；--round 1（≠ 推导）→ exit 2 backfill 冲突", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      seedDocsReviewRound(dir, doc, "spec-review-1.json", { docHash: sha256("v1"), content: "v2" });
      const ok = runCli(["review", "--type", "spec", "--spec", doc, "--round", "2"],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(ok.exitCode).toBe(0);
      expect(ok.stderr).toMatch(/new review round 2/);
      const bad = runCli(["review", "--type", "spec", "--spec", doc, "--round", "1"],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(bad.exitCode).toBe(2);
      expect(bad.stderr).toMatch(/≠ engine round/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("plan 家族镜像：内容未变 → exit 3；内容演进 → 放行（plan-review 族同矩阵）", () => {
    const dir = tmpGitRepo();
    try {
      const plan = path.join(dir, "plans", "foo.md");
      seedDocsReviewRound(dir, plan, "plan-review-1.json", { docHash: sha256("p1"), content: "p1" });
      const same = runCli(["review", "--type", "plan", "--plan", plan],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(same.exitCode).toBe(3);
      writeFileSync(plan, "p2-different");          // 内容演进
      const ev = runCli(["review", "--type", "plan", "--plan", plan],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(ev.exitCode).toBe(0);
      expect(ev.stderr).toMatch(/CDD_INFO.*new review round 2/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("doc 文件缺失（hashFile → 空哨兵 ≠ prev.hash）→ 按 ref 变静默放行、无 CDD_INFO、下游自然失败", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      seedDocsReviewRound(dir, doc, "spec-review-1.json", { docHash: sha256("v1"), content: "v1" });
      rmSync(doc);                                   // 删除现档——gate 放行（幽灵 doc 下游失败/或 dry-run 直接 exit 0）
      const r = runCli(["review", "--type", "spec", "--spec", doc],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);                    // dry-run 下放行即 exit 0（真实模式由 runDocsTask 自然报错）
      expect(r.stderr).not.toMatch(/CDD_INFO/);      // 空串哨兵抑制「内容演进」误导消息（gate `&& docHash` 条款）
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
```

- [ ] **Step 5: 跑黑盒矩阵 + 全量 engine 套件确认回归**

```bash
cd /Users/kang/Projects/oscaner-skills/packages/cdd-engine && npx vitest run tests/cdd.test.mjs tests/review-loop.test.mjs
```

Expected: 矩阵 8 用例 + 既有 canonical Stopping 用例（legacy seed 无 content——注意：现有用例 `seedDocsReviewRound(dir, doc, "spec-review-1.json")` 不传 content/docHash，新 helper 默认 content="" 会**写出空 doc 文件**——`legacy` 语义不变仍 exit 3，但 doc 文件被意外创建；若既有用例依赖 doc 不存在，保持语义优先，违反处按失败信息调整 seed 调用）。回归：既有 `exit 3 /Review Stopping/` 断言仍绿（消息前缀不变）。

- [ ] **Step 6: 全量 validate + commit**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
git add packages/cdd-engine/lib/runner/review-loop.mjs packages/cdd-engine/lib/cli/review.mjs packages/cdd-engine/tests/cdd.test.mjs
git commit -m "feat(cdd-engine): spec/plan Stopping ref 升 (doc_path, doc_hash) 双签名——演进自动放行 + reason 分场景消息（F5 #246）"
```

Expected: validate ALL PASS；commit 成功。

---

### Task 3: docs review 定稿注入 `doc_hash` + schema 扩展 + docs-runner 断言

<thinking>原子单元：① run-docs.mjs review-mode 定稿路径改 `writeOwnHandoff` 恒写（merge doc_hash）+ 内存返回值同步（status/doc_hash）+ 两条 BLOCKED 失败写盘并入 doc_hash；fix-mode 保持 persistFinalized（不注入）；② docs-handoff-schema.json 增 `doc_hash` optional；③ docs-runner.test.mjs 断言（T5 回归扩展 / 真实内容 hex / fix 负向 / BLOCKED 注入 / plan 镜像，r2 补 plan 族双族断言）；④ schema-utils.test.mjs 真实 schema 往返 3 例（r2 补，防 schema 属性删改无测试拦截）。</thinking>

**Files:**
- Modify: `packages/cdd-engine/lib/runner/run-docs.mjs`
- Modify: `packages/cdd-engine/templates/schema/docs-handoff-schema.json`
- Modify: `packages/cdd-engine/tests/docs-runner.test.mjs`
- Modify: `packages/cdd-engine/tests/schema-utils.test.mjs`（真实 schema 往返：doc_hash 合法同携——schema.mjs 在该文件不 mock，防 schema 属性删改无测试拦截）

**Interfaces:**
- Consumes: `hashFile`（Task 1）
- Produces: 真实 review handoff 自动携 `doc_hash` 落盘（Task 2 黑盒矩阵的对手件闭环——演进开新 cycle 的真实产物从此带 hash 可连续演进）

- [ ] **Step 1: docs-handoff-schema.json 增字段**

`templates/schema/docs-handoff-schema.json` properties 中既有 `"doc_path"` 行**后**追加 `doc_hash` 一项（不进 required——legacy handoff 不失效；additionalProperties:false 下声明属性防误伤；doc_path 已存在，切勿重复列出）：

```json
"doc_hash":  { "type": "string" },
```

- [ ] **Step 2: 写失败测试（docs-runner 断言四则）**

`tests/docs-runner.test.mjs` 追加（T5 用例后）：

```js
// ---- P2 F5：review-mode doc_hash 定稿注入（载体唯一作者 T7）----

it("review-mode 定稿注入 doc_hash：缺失 doc（mock 环境 ENOENT）→ 空串哨兵 + 内存返回值同步", async () => {
  const { execa } = await import("execa");
  execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
  vi.resetModules();
  const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
  const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
  const result = await runDocsTask({
    harness: "claude", mode: "review", template: "review", type: "spec",
    doc: "/repo/root/docs/superpowers/specs/my-spec.md",   // 不存在 → hashFile "" 哨兵
    handoffPath: "/repo/root/.superpowers/cdd/foo/spec-review-1.json",
    dryRun: false,
  });
  expect(result.handoff.status).toBe("APPROVED");
  expect(result.handoff.doc_hash).toBe("");                // 内存返回值同步（§2.3.3）
  const writeCall = writeOwnHandoff.mock.calls.find(([p]) => String(p).endsWith("spec-review-1.json"));
  expect(writeCall[1].doc_hash).toBe("");                  // 磁盘定稿含 doc_hash
  expect(writeCall[1].status).toBe("APPROVED");
});

it("review-mode doc_hash = 真实内容 sha256 hex（temp doc + 非 ws 前缀不被 mock 拦截）", async () => {
  const { execa } = await import("execa");
  execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
  const dir = mkdtempSync(join(tmpdir(), "p2hash-"));
  const doc = join(dir, "spec.md");
  writeFileSync(doc, "real content p2");
  vi.resetModules();
  const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
  const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
  const result = await runDocsTask({
    harness: "claude", mode: "review", template: "review", type: "spec", doc,
    handoffPath: "/repo/root/.superpowers/cdd/foo/spec-review-1.json",
    dryRun: false,
  });
  expect(result.handoff.doc_hash).toBe(createHash("sha256").update("real content p2").digest("hex"));
  const writeCall = writeOwnHandoff.mock.calls.find(([p]) => String(p).endsWith("spec-review-1.json"));
  expect(writeCall[1].doc_hash).toBe(result.handoff.doc_hash);
});

it("fix-mode 不注入 doc_hash（p persistFinalized 原样；负向对称防误扩展）", async () => {
  const { execa } = await import("execa");
  execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
  vi.resetModules();
  const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
  const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
  await runDocsTask({
    harness: "claude", mode: "fix", template: "doc-fix", type: "spec",
    doc: "/repo/root/docs/superpowers/specs/my-spec.md",
    findingsPath: "/repo/root/docs/findings.md",
    handoffPath: "/repo/root/.superpowers/cdd/foo/spec-fix-1.json",
    dryRun: false,
  });
  const fixCalls = writeOwnHandoff.mock.calls.filter(([p]) => String(p).includes("spec-fix-"));
  expect(fixCalls).toHaveLength(0);                       // fix-mode 无注入写
  expect(writeOwnHandoff).not.toHaveBeenCalledWith(expect.any(String),
    expect.objectContaining({ doc_hash: expect.anything() }));
});

it("BLOCKED 失败写盘（handoff 未写）亦注入 doc_hash（uniform 载体）", async () => {
  const dir = mkdtempSync(join(tmpdir(), "p2block-"));
  const doc = join(dir, "spec.md");
  writeFileSync(doc, "blocked content");
  vi.resetModules();
  const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
  const { writeHandoff } = await import("../lib/handoff/write.mjs");
  // 真实落盘 mock：模块级 vi.mock 把 writeHandoff 换成 vi.fn() 不落盘 → BLOCKED 分支写盘后
  // JSON.parse(readFileSync(handoffPath)) 读回必 ENOENT（orphan 路径 node:fs mock 透传真实 fs）。
  // 注入真实写盘实现让读回成功（run-docs.mjs:66-75 分支强耦合同步读回，不可 stub 掉）。
  writeHandoff.mockImplementation((p, data) => {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
    return data;
  });
  const orphanPath = join(dir, "ws", "spec-review-1.json");  // 非 .superpowers/cdd/foo 前缀 → existsSync mock 走真实 → 文件不存在 → BLOCKED 写盘
  const result = await runDocsTask({
    harness: "claude", mode: "review", template: "review", type: "spec", doc,
    handoffPath: orphanPath,
    dryRun: false,
  });
  expect(result.exitCode).toBe(1);
  const writeCall = writeHandoff.mock.calls.find(([p]) => String(p).endsWith("spec-review-1.json"));
  expect(writeCall[1].status).toBe("BLOCKED");
  expect(writeCall[1].doc_hash).toBe(createHash("sha256").update("blocked content").digest("hex"));
});

it("plan 家族镜像：review-mode type:plan 定稿注入 doc_hash（真实双族 handoff 断言）", async () => {
  const { execa } = await import("execa");
  execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
  const dir = mkdtempSync(join(tmpdir(), "p2planh-"));
  const doc = join(dir, "plan.md");
  writeFileSync(doc, "plan content p2");
  vi.resetModules();
  const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
  const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
  const result = await runDocsTask({
    harness: "claude", mode: "review", template: "review", type: "plan", doc,
    handoffPath: "/repo/root/.superpowers/cdd/foo/plan-review-1.json",
    dryRun: false,
  });
  expect(result.handoff.doc_hash).toBe(createHash("sha256").update("plan content p2").digest("hex"));
  const writeCall = writeOwnHandoff.mock.calls.find(([p]) => String(p).endsWith("plan-review-1.json"));
  expect(writeCall[1].doc_hash).toBe(result.handoff.doc_hash);
});
```

（测试文件需补 import：`createHash` from `node:crypto`、`mkdirSync/mkdtempSync/writeFileSync` from `node:fs`、`path` 与 `join` from `node:path`、`tmpdir` from `node:os`——现文档头仅有 vi 类 mock，按需加在文件顶部；`path` 供 BLOCKED 用例的 mockImplementation 计算 dirname。）

`tests/schema-utils.test.mjs`（真实 schema 往返，schema.mjs 在该文件不 mock）追加：

```js
// docs schema（§2.5.7「schema 校验过」）：真实 docs-handoff-schema 既收 doc_path 又收 doc_hash
//（additionalProperties:false 已声明属性不误伤；未知属性仍拒）——若 schema 属性被删/拼错即红。
describe('docs handoff schema (doc_hash)', () => {
  const DOCS = {
    phase: 'review', status: 'APPROVED',
    findings: [], artifacts: {}, doc_path: '/x.md', doc_hash: 'a'.repeat(64),
  };
  it('doc_path + doc_hash 同携 valid（schema 显式声明 doc_hash 属性）', () => {
    expect(validateHandoffSchema(DOCS, 'docs')).toEqual({ valid: true });
  });
  it('doc_hash optional（无 doc_hash 的 legacy handoff 仍 valid）', () => {
    const { doc_hash, ...legacy } = DOCS;
    expect(validateHandoffSchema(legacy, 'docs')).toEqual({ valid: true });
  });
  it('additionalProperties:false 仍桩——未知属性拒绝', () => {
    expect(validateHandoffSchema({ ...DOCS, bogus: 1 }, 'docs').valid).toBe(false);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd /Users/kang/Projects/oscaner-skills/packages/cdd-engine && npx vitest run tests/docs-runner.test.mjs
```

Expected: 新 docs-runner 5 例中 **4 例 FAIL**（两注入例 + plan 镜像 + BLOCKED——`doc_hash` 尚未注入）；**fix-mode 负向例（C）改造前即绿属预期**（现 fix 分支走 persistFinalized skip-write，writeOwnHandoff.mock.calls 本就为空）。schema-utils 3 例由 Step 1 的 schema 编辑后即绿（不在本专项 run 内），Step 5 全量带过。

- [ ] **Step 4: run-docs.mjs 注入实现**

`lib/runner/run-docs.mjs`：import 增 `hashFile`：

```js
import { hashFile } from "./review-loop.mjs";
```

现有两条 BLOCKED 失败写盘（handoff 未写 / schema 无效）——各自 `writeHandoff(handoffPath, {...})` 的 payload 增一行 `doc_hash: hashFile(doc)`。

现有定稿块替换：

```js
  if (mode === "review" || mode === "fix") {
    const finalized = finalizeHandoff({ mode, agentHandoff: handoff });
    if (mode === "review") {
      // P2 F5（§2.3.3）：review-mode 恒注入内容状态 token——引擎定稿（载体唯一作者 T7），
      // 恒有 doc_hash 变更 → writeOwnHandoff 全量覆盖（不再复用 persistFinalized 的 skip-write）。
      // 内存返回值与磁盘定稿一致：派生 status 覆写回写 local + doc_hash 同步。
      const merged = { ...(finalized.handoff ?? handoff), doc_hash: hashFile(doc) };
      writeOwnHandoff(handoffPath, merged);
      handoff.status = merged.status;
      handoff.doc_hash = merged.doc_hash;
    } else {
      persistFinalized(handoffPath, handoff, finalized);   // fix-mode 原样（无注入，负向对称）
    }
  }
```

- [ ] **Step 5: 跑 docs-runner 套件 + 既有 T5 回归**

```bash
cd /Users/kang/Projects/oscaner-skills/packages/cdd-engine && npx vitest run tests/docs-runner.test.mjs
```

Expected: 新 4 例 PASS + 既有 T5（`result.handoff.status === "APPROVED"`、writeOwnHandoff 收 status APPROVED）保绿——注意既有 T5 的 writeCall[1] 现多 `doc_hash` 键，其断言仅查 status/findings 字段不受影响。

- [ ] **Step 6: 全量 validate + commit**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
git add packages/cdd-engine/lib/runner/run-docs.mjs packages/cdd-engine/templates/schema/docs-handoff-schema.json packages/cdd-engine/tests/docs-runner.test.mjs
git commit -m "feat(cdd-engine): docs review 定稿注入 doc_hash 内容状态 token + schema 扩展 + fix-mode 负向（F5 #246）"
```

Expected: validate ALL PASS；commit 成功。

---

### Task 4: review.md（URC）四 type 统一原则 + 演进重审路径 + emit + changeset

<thinking>原子单元：① `packages/osuperpowers/skills/_docs/review.md` 更新——run-review Invariant / 演进重审路径小节 / Handoff output doc_hash / hash 尺度注释；② `pnpm run emit` 派生 `.agents/` + `emit:check` 绿；③ changeset（@oscaner-skills/cdd-engine minor 关 F5）；④ spec §2.6.3 no-op 判定随载——消费侧 `cli-driven-development/docs/handoff-schema.md` 仅枚举 task-N-handoff 族 schema、不含 docs review 的 doc_path 枚举（spec 期已 grep 证实）→ **本轮无改动**，执行代理无需再 grep。</thinking>

**Files:**
- Modify: `packages/osuperpowers/skills/_docs/review.md`（消费者可读——改后必 emit）
- Modify: `.changeset/<slug>.md`（新增，经 `pnpm run changeset` 或手写）
- Derived: `.agents/`（emit 再生，禁止手编）

**Interfaces:**
- Consumes: Tasks 1-3 落地行为（gate 双签名 + doc_hash 注入）
- Produces: 消费者可读的四 type 统一 Stopping 原则 + 演进重审路径文档；changeset 供版本 bump

- [ ] **Step 1: review.md §run-review Invariant 按 type 分写准确**

`packages/osuperpowers/skills/_docs/review.md` 第 31 行 Invariant 段落替换为：

```markdown
- **Invariant**: must not re-run after blocker=0 output — the engine layer rejects a re-run of the **same ref**: task/branch bind the ref to the reviewed git range; spec/plan bind it to `(doc_path, doc_hash)` — same path **and** same content hash — whose previous round is APPROVED with blocker=0 (Review Stopping violation). **Orchestrator obligation (all four types, incl. branch)**: after a blocker=0 review, fix ALL captured findings (blocker+warn+nit) and finish — do NOT re-dispatch a review of the target. For task/branch the engine cannot detect re-runs whose ref moved with your fix commits; for spec/plan the engine CAN detect a content change (new hash) and would open a *new* review round — so the stop after a clean review is the orchestrator's discipline in both cases (Enh Y); an *edit* to a reviewed spec/plan is precisely what legitimately opens a new cycle (see Spec/plan evolution re-review below).
```

- [ ] **Step 2: 新增「Spec/plan evolution re-review」小节 + Handoff output + hash 尺度**

在 §run-review 之后、§cli-fix-all-findings 之前插一小节：

```markdown
### Spec/plan evolution re-review (docs)

Editing a reviewed spec/plan changes its content hash (`doc_hash` = sha256 of the doc bytes, recorded in the docs review handoff by the engine at finalization) → the Stopping ref `(doc_path, doc_hash)` becomes a new ref → `cdd review --type spec|plan` opens a fresh review cycle (round auto-incremented; the engine prints `CDD_INFO: doc content changed since round-<R> clean review … → new review round <N>` when the previous round was clean). Unchanged content still exits 3 with guidance (edit the doc content or open a new doc). Handoffs written before `doc_hash` existed (no field) keep the hard stop — their content state is unknown, and editing such a doc alone does not unlock a re-review (open a new doc or remove the stale review handoff). Hash is full-bytes sha256, not normalized — whitespace-only edits can open a review; accepted, the cost is one review dispatch.
```

Handoff Output 段（§Rules → **Handoff Output**）docs review handoff 描述补一句：

```markdown
docs review handoffs additionally carry `doc_hash` (the reviewed content's sha256 — the content-state half of the Stopping ref; engine-attached at finalization).
```

- [ ] **Step 3: emit + emit:check**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run emit && pnpm run emit:check
```

Expected: emit 成功（`.agents/skills/_docs/review.md` 等派生更新）；`emit:check` exit 0 无 drift。

- [ ] **Step 4: changeset**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run changeset
```
选择 `@oscaner-skills/cdd-engine` → **minor**，summary 填：

```
cdd review --type spec|plan 的 Stopping ref 升级 (doc_path, doc_hash) 内容状态双签名：内容实质演进即新 ref、可开新 review cycle（关 #246 F5）；未变内容仍 exit 3；legacy handoff 硬停保留
```

（或手写 `.changeset/<slug>.md`，内容 `'@oscaner-skills/cdd-engine': minor` + summary 单行。）

- [ ] **Step 5: 全量 validate + commit**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
git add packages/osuperpowers/skills/_docs/review.md .agents .changeset
git commit -m "docs(cdd-engine): review.md Stopping 规则四 type 内容状态统一 + spec/plan 演进重审路径 + changeset（F5 #246）"
```

Expected: validate ALL PASS（含 emit：check 块）；`.agents/` 派生更新进 commit；changeset 落盘。

---

## 收尾断言（对应 spec §2.7 Acceptance）

- [ ] spec 恒等：evolved 内容走 spec-review-2 黑盒（Task 2 case 2/5）→ exit 0 + CDD_INFO + round 2
- [ ] U1：同内容同 hash → exit 3（Task 2 case 1）
- [ ] legacy 硬停 + legacy 消息（Task 2 case 3）＋ case 3 旧 impossible 措辞禁用断言
- [ ] SP-4：CHANGES_REQUESTED prev 无声放行（case 4）＋ BLOCKED prev + 内容演进无声放行（case 8）——docs 族失败轮重派
- [ ] doc 缺失边角：静默放行、无 CDD_INFO（case 7）
- [ ] 消息分场景 + 禁用 + CDD_INFO 抑制（Task 2 case 1/3/4/7/8 断言）
- [ ] doc_hash 注入 spec+plan 双族真实 handoff（docs-runner 用例＋ plan 镜像）＋ BLOCKED 亦含 ＋ 真实 schema 往返（schema-utils 3 例）
- [ ] `--round` 共存双分支（Task 2 case 5）
- [ ] review.md 文档化 + emit 无 drift + changeset minor 落盘