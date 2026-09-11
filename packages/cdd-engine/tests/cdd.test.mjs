// tests/cdd.test.mjs — 合并面 CLI（bin/cdd.mjs 薄入口 + lib/cli/ 命令面）契约测试。
// 覆盖：帮助/用法、review 的 round+Stopping 接线（dry-run smoke）、fix --findings 接线、
// select/research 内联、brief/contract 模块转发。CDD_DRY_RUN=1 跳过真实 harness 调用。
import { describe, it, expect, afterAll, vi } from "vitest";
import { execaSync } from "execa";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { forkLifecyclePath } from './helpers.mjs';
import path from "node:path";
import { fileURLToPath } from "node:url";

// Repo-root derivation via fileURLToPath (task.test.mjs convention) — no hardcoded machine
// path, so the suite also passes under CI checkouts (STD-4). CDD_MJS must be absolute:
// contract tests switch cwd to a temp repo and a relative path would break there.
const HERE = path.dirname(fileURLToPath(import.meta.url));   // packages/cdd-engine/tests
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const CDD_MJS = path.join(REPO_ROOT, "packages/cdd-engine/bin/cdd.mjs");
const SMOKE_PLAN = "packages/cdd-engine/tests/fixtures/smoke-plan.md";
// T10 warn: SMOKE_PLAN 派生 workspace = .superpowers/cdd/smoke-plan/（resolveWorkspace md 名→slug）。
// 测试 teardown 清理，避免 validate 后根杂讯污染 F6 单一根。
afterAll(() => {
  rmSync(path.join(REPO_ROOT, ".superpowers", "cdd", "smoke-plan"), { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, ".superpowers", "cdd", "plan"), { recursive: true, force: true }); // 其他 fixture slug
});
const NODE = process.execPath;
// Task 3 fork 隔离（spec §2.2 A / §2.6）：bin 启动 reapStale 读写 lifecycle 盘文件 —— 每 fork 注入
// 唯一 tmp 路径，避免并发 fork 共享 <cwd>/.superpowers/cdd/lifecycle.json 时启动 reapStale 误杀
// 另一 fork in-flight 组（ownerPid 异判为 orphan；本文件 branch-review 真实 dispatch + 黑盒 CLI 并发尤为相关）。
const LIFECYCLE_PATH = forkLifecyclePath("cdd");

// Test env: strip 任何从 orchestrator session 继承的 CDD_*，再叠加测试 extras（与 task.test.mjs 一致）。
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra, CDD_LIFECYCLE_PATH: LIFECYCLE_PATH };
}

function runCli(args = [], opts = {}) {
  const { env: extraEnv = {}, cwd = REPO_ROOT, noHost = false } = opts;
  const env = cleanEnv(extraEnv);
  // T3: host detection is ambient-env driven (CLAUDE_CODE_SESSION_ID / AI_AGENT) — a no-host
  // case must explicitly delete the three host markers; stripping CDD_* alone leaks detection
  // through the parent session (see host-detection.test.mjs B1 blocker).
  if (noHost) {
    delete env.CLAUDE_CODE_SESSION_ID;
    delete env.CURSOR_TRACE_ID;
    delete env.AI_AGENT;
  }
  try {
    // extendEnv:false —— execa 默认 extendEnv:true 会把父进程 env 合入 child，覆盖 cleanEnv 的
    // CDD_* 剥离（orchestrator 携带的 CDD_REVIEW_TIMEOUT 等泄漏回测试 child，见 T8 回归：
    // 秒值 ×1000 溢出 setTimeout 32 位上限 → ~1ms 瞬时 SIGTERM → 非 dry-run 用例确定性 FAIL）。
    // 关闭 extendEnv 后 child 只见 cleanEnv 显式清单，测试与调度侧环境变量零耦合。
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd, env, encoding: "utf8", extendEnv: false });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    return { exitCode: e.exitCode ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

// P6 T3 单元 seam：vi.mock docs-runner 动态 import，直接断言 cdd.mjs runReview/runFix 传给
// runDocsTask 的 handoffPath/workspace（canonical 派生命名）。cdd.mjs 以
// `await import("../runner/run-docs.mjs")` 动态加载 → vitest 按解析 id 拦截同一模块。
// CLI 黑盒用例走独立 node 子进程，不经此 mock。
const docsRunnerMock = vi.hoisted(() => ({
  runDocsTask: vi.fn(async () => ({
    exitCode: 0,
    handoff: { phase: "review", status: "APPROVED", findings: [], artifacts: {}, doc_path: "" },
  })),
}));
vi.mock("../lib/runner/run-docs.mjs", () => docsRunnerMock);

describe("cdd CLI", () => {
  it("-h → help", () => {
    const r = execaSync(NODE, [CDD_MJS, "--help"], { cwd: REPO_ROOT, env: cleanEnv(), extendEnv: false });
    expect(r.stdout).toMatch(/implement|review|fix|research|brief/);
  });

  it("review missing --type → usage exit 2", () => {
    expect(() => execaSync(NODE, [CDD_MJS, "review"], { cwd: REPO_ROOT, env: cleanEnv({ CDD_DRY_RUN: "1" }), extendEnv: false }))
      .toThrow(/required option|--type/);
  });

  it("dry-run review --type task → H1 + exit 0", () => {
    const r = runCli(["review", "--type", "task",
      "--task", "1", "--plan", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/status: APPROVED/);
  });

  it("dry-run review --type branch → H1 + exit 0（随机 base/head 避免 Review Stopping 误拒；tmp git repo 内 plan 供 resolveWorkspace 推导，避免向真实 workspace 写副作用）", () => {
    const base = `base${Date.now().toString(16).slice(-4)}`;
    const head = `head${Date.now().toString(16).slice(-8, -4)}`;
    const dir = tmpGitRepo();
    try {
      const tmpPlan = path.join(dir, "plan.md");
      writeFileSync(tmpPlan, "### Task 1:\n- base: develop\n");
      const r = runCli(["review", "--type", "branch",
        "--plan", tmpPlan, "--base", base, "--head", head],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/status: APPROVED/);
      expect(r.stdout).toMatch(new RegExp(`commits: base=${base} head=${head}`));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("dry-run review --type spec → exit 0", () => {
    const r = runCli(["review", "--type", "spec", "--spec", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
    expect(r.exitCode).toBe(0);
  });

  it("dry-run fix --type task → H1 + exit 0", () => {
    const r = runCli(["fix", "--type", "task", "--task", "1",
      "--findings", SMOKE_PLAN, "--plan", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/status: APPROVED/);
  });

  it("fix --type spec|plan 非 dry-run：无 host env → CDD_BLOCKED exit 1（T3 — 无 harness 停闸，host 由环境判定）", () => {
    // 原"unknown harness 停闸"用例已随 harness 参数删除淘汰：entry 层 host 判定为空即 BLOCK，
    // 不再存在未知 harness 需停闸（host 必然是 claude/cursor-agent 两合法键）——T3 改断言无-host BLOCK。
    // 保留 not.toMatch(/template/)：BLOCK 消息不得来自 doc-fix 模板渲染错误。
    for (const [type, reviewFile] of [["spec", "spec-review-1.json"], ["plan", "plan-review-1.json"]]) {
      // D11 target param: type=spec → --spec, type=plan → --plan（type 自解释）。
      const targetParam = type === "spec" ? "--spec" : "--plan";
      const r = runCli(["fix", "--type", type, targetParam, SMOKE_PLAN,
        "--findings", path.join(REPO_ROOT, ".superpowers", "cdd", "smoke-plan", reviewFile)],
        { noHost: true });
      expect(r.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
      expect(r.stderr).not.toMatch(/template/);
    }
  });

  it("review --type spec 非 dry-run：无 host env → CDD_BLOCKED exit 1（原 harness-gate 停闸用例，T3 改断言）", () => {
    // runDocsTask 原在 harness gate 前 render 共享壳 review.md；host 判定现于 entry 先发 BLOCK。
    // 渲染崩（缺参/模板缺失）→ stderr 出现 template → not.toMatch(/template/) 仍拦截。
    const r = runCli(["review", "--type", "spec", "--spec", SMOKE_PLAN], { noHost: true });
    expect(r.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
    expect(r.stderr).not.toMatch(/template/);
  });

  it("review --type branch 缺 --base/--head → 必填守卫 exit 2（SP-2）", () => {
    const r = runCli(["review", "--type", "branch", "--plan", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/--base/);
  });

  it("review --type plan 非 dry-run：无 host env → CDD_BLOCKED exit 1（原 harness-gate 停闸用例，T3 改断言）", () => {
    // Task 4 曾验证 plan 走共享壳 review.md 渲染后停在 harness gate；T3 后 host 判定 entry 先发 BLOCK。
    // --spec 保留为可选参数；两种调用形态都必须命中 CDD_BLOCKED（exit 1），而非渲染崩溃。
    const r = runCli(["review", "--type", "plan", "--plan", SMOKE_PLAN], { noHost: true });
    expect(r.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
    expect(r.stderr).not.toMatch(/template/);
    const r2 = runCli(["review", "--type", "plan", "--plan", SMOKE_PLAN, "--spec", SMOKE_PLAN], { noHost: true });
    expect(r2.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
    expect(r2.stderr).not.toMatch(/template/);
  });

  it("dry-run review --type plan --spec → exit 0（SP-3 --spec 接线）", () => {
    const r = runCli(["review", "--type", "plan", "--plan", SMOKE_PLAN, "--spec", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
    expect(r.exitCode).toBe(0);
  });

  it("--task 非整数 → 校验回退 exit 2（STD-3 Bug A 契约回归）", () => {
    // parseInt NaN must not leak into runTask (task-NaN-* garbage + fake APPROVED H1);
    // the Commander coercion rejects at parse time → exit 2 (legacy cdd-task contract).
    const r = runCli(["review", "--type", "task", "--task", "abc", "--plan", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/must be an integer, got: abc/);
  });

  // --- SP-4 Review Stopping status criterion: a BLOCKED/TIMEOUT failure round (findings:[])
  //     must remain re-dispatchable; only an APPROVED round with blocker=0 stops a re-run. ---

  // Seed helper: temp git repo + plan file + a seeded task-N-review-N.json round.
  function seedTaskReviewHandoff(status) {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-stop-"));
    execaSync("git", ["-C", dir, "init", "-q"]);
    execaSync("git", ["-C", dir, "-c", "user.name=cdd-test", "-c", "user.email=cdd-test@example.com",
      "commit", "--allow-empty", "-qm", "fixture"]);
    const plan = path.join(dir, "zz-stop-test.md");
    writeFileSync(plan, "### Task 1: fixture\n");
    const ws = path.join(dir, ".superpowers", "cdd", "zz-stop-test");
    mkdirSync(ws, { recursive: true });
    writeFileSync(path.join(ws, "task-1-review-1.json"),
      JSON.stringify({ task: 1, phase: "review", status, artifacts: {}, findings: [],
        ...(status !== "APPROVED" ? { blocker: "boom" } : {}) }));
    return { dir, plan };
  }

  it("review --type task：status:BLOCKED 失败轮 → 可重派（SP-4）", () => {
    const { dir, plan } = seedTaskReviewHandoff("BLOCKED");
    try {
      const r = runCli(["review", "--type", "task", "--task", "1", "--plan", plan],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/status: APPROVED/);
      expect(r.stderr).not.toMatch(/already APPROVED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("review --type task：status:APPROVED + blocker=0 已通过轮 → 拒绝重派 exit 3（SP-4 保留 Stopping）", () => {
    const { dir, plan } = seedTaskReviewHandoff("APPROVED");
    try {
      const r = runCli(["review", "--type", "task", "--task", "1", "--plan", plan],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/already blocker=0 — Review Stopping/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("dry-run research → exit 0", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-cli-research-"));
    try {
      const brief = path.join(dir, "brief.md");
      writeFileSync(brief, "# test brief\n");
      const r = runCli(["research", "--brief", brief, "--output", path.join(dir, "findings.md")],
        { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("brief --task --plan --output → 生成 brief + {brief} JSON", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-cli-brief-"));
    try {
      const out = path.join(dir, "task-1-brief.md");
      const r = runCli(["brief", "--task", "1", "--plan", SMOKE_PLAN, "--output", out]);
      expect(r.exitCode).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual({ brief: out });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---- T8: `cdd contract` 子命令删除 + branch-review 读回覆写（T5 nit4 补测） ----

  it("cdd contract 子命令不存在（check-dirty/check-head/clear-findings 全灭）→ 未知命令 exit 2", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-cli-contract-"));
    try {
      execaSync("git", ["-C", dir, "init", "-q"]);
      execaSync("git", ["-C", dir, "-c", "user.name=cdd-test", "-c", "user.email=cdd-test@example.com",
        "commit", "--allow-empty", "-qm", "fixture"]);
      // 已删除子命令不得仍可调用（旧 contract --check-dirty 会 exit 0）
      for (const args of [["contract", "--check-dirty"], ["contract", "--check-head"], ["contract", "--clear-findings"], ["contract"]]) {
        const r = runCli(args, { cwd: dir });
        expect(r.exitCode).not.toBe(0);
        expect(r.stderr).toMatch(/usage: cdd/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("branch-review 读回定稿（T5/T7 finalizeHandoff 单点）：fake harness CLI 写 warn-only CHANGES_REQUESTED branch-review handoff → 引擎覆写为 APPROVED", () => {
    const dir = tmpGitRepo();
    try {
      const plan = path.join(dir, "plan.md");
      writeFileSync(plan, "### Task 1:\n- base: develop\n");
      const binDir = mkdtempSync(path.join(tmpdir(), "cdd-br-fake-"));
      const ws = path.join(dir, ".superpowers", "cdd", "plan");
      const handoffPath = path.join(ws, "branch-review-eeee555..ffff666-r1.json");
      // fake claude：PATH 遮蔽 registry cli 名（cdd.mjs REG_PATH 无 registry override seam）。
      // 非 dry-run 真实走 runBranchReview：agent 写 warn-only CHANGES_REQUESTED → engine finalizeHandoff
      //（三消费方共享定稿单点）rollup 派生覆写 APPROVED + writeOwnHandoff 持久化。
      writeFileSync(path.join(binDir, "claude"),
        "#!/usr/bin/env bash\n" +
        `mkdir -p "${ws}"\n` +
        `printf '%s' '{"task":1,"phase":"branch-review","status":"CHANGES_REQUESTED","findings":[{"severity":"warn","summary":"w"}],"artifacts":{}}' > "${handoffPath}"\n` +
        "exit 0\n");
      chmodSync(path.join(binDir, "claude"), 0o755);
      const r = runCli(["review", "--type", "branch",
        "--plan", plan, "--base", "eeee555", "--head", "ffff666"],
        { cwd: dir, env: { PATH: `${binDir}${path.delimiter}${process.env.PATH}`, CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);
      const h = JSON.parse(readFileSync(handoffPath, "utf8"));
      // warn/nit = 0 blocker → status 被 finalizeHandoff（applyDerivedStatus rollup）覆写为 APPROVED
      expect(h.status).toBe("APPROVED");
      expect(h.findings).toEqual([{ severity: "warn", summary: "w" }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- P6 T3：docs 命名统一 — spec/plan/branch handoff 走派生层（canonical naming + resolveWorkspace） ----
// 单元 seam（docsRunnerMock）断言 runReview/runFix 传给 runDocsTask 的 handoffPath/workspace；
// CLI 黑盒用 canonical seed 驱动 Review Stopping / 轮次，端到端验证命名 + workspace 接线。

// 临时 git 仓库：供 resolveWorkspace 推导 git root；每个用例独立 seed，不留真实 repo 副作用。
function tmpGitRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-p6-"));
  execaSync("git", ["-C", dir, "init", "-q"]);
  execaSync("git", ["-C", dir, "-c", "user.name=cdd-test", "-c", "user.email=cdd-test@example.com",
    "commit", "--allow-empty", "-qm", "fixture"]);
  return dir;
}

// seed 一条 canonical <type>-review-1.json（status APPROVED + blocker=0）→ 命中 Review Stopping。
// ws = <repo>/.superpowers/cdd/foo —— 覆盖 spec（foo-design.md 去 -design）与 plan（foo.md）同 slug 收敛。
// doc 父目录一并创建：resolveWorkspace 从 dirname(doc) 走 gitToplevel，父目录缺失会回退失败。
// content 实写 doc 文件（hashFile 读实时文件）：默认 content="" → 既有 legacy seed 调用写空 doc，
// 语义（status APPROVED + blocker=0）不变仍 exit 3；docHash 显式传入才落 handoff.doc_hash。
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

describe("P6 T3: docs handoff 命名走派生层", () => {
  // ---- 单元 seam：runReview/runFix（cdd.mjs 导出）→ mocked runDocsTask 参数断言 ----

  it("review --type spec → runDocsTask handoffPath=<ws>/spec-review-1.json + workspace=<ws>（canonical 派生命名，非 flat-root/旧体）", async () => {
    process.env.CDD_DRY_RUN = "1";
    process.env.CLAUDE_CODE_SESSION_ID = "1"; // in-process seam: runReview resolves host from process.env
    try {
      const { runReview } = await import("../lib/cli/review.mjs");
      // D11: type=spec target param is --spec (opts.spec); opts.doc retired.
      await runReview({ type: "spec", spec: "/repo/root/docs/superpowers/specs/foo-design.md" });
      const call = docsRunnerMock.runDocsTask.mock.calls.at(-1)?.[0] ?? {};
      expect(call.handoffPath).toBe("/repo/root/.superpowers/cdd/foo/spec-review-1.json");
      expect(call.workspace).toBe("/repo/root/.superpowers/cdd/foo");
    } finally {
      delete process.env.CDD_DRY_RUN;
      delete process.env.CLAUDE_CODE_SESSION_ID;
      docsRunnerMock.runDocsTask.mockClear();
    }
  });

  it("resolveWorkspace: plan foo.md 与 spec foo-design.md 收敛同一 workspace", async () => {
    const { resolveWorkspace } = await import("../lib/handoff/naming.mjs");
    expect(resolveWorkspace("/repo/root/docs/superpowers/plans/foo.md"))
      .toBe("/repo/root/.superpowers/cdd/foo");
    expect(resolveWorkspace("/repo/root/docs/superpowers/specs/foo-design.md"))
      .toBe("/repo/root/.superpowers/cdd/foo");
  });

  it("fix --findings spec-review-2.json → runDocsTask handoffPath=<ws>/spec-fix-2.json（round 从 findings 名经 roundPattern 解析）", async () => {
    process.env.CDD_DRY_RUN = "1";
    process.env.CLAUDE_CODE_SESSION_ID = "1"; // in-process seam: runFix resolves host from process.env
    try {
      const { runFix } = await import("../lib/cli/fix.mjs");
      const findings = "/repo/root/.superpowers/cdd/foo/spec-review-2.json";
      // D11: type=spec target param is --spec (opts.spec); opts.doc retired.
      await runFix({ type: "spec", spec: "/repo/root/docs/superpowers/specs/foo-design.md", findings });
      const call = docsRunnerMock.runDocsTask.mock.calls.at(-1)?.[0] ?? {};
      expect(call.handoffPath).toBe("/repo/root/.superpowers/cdd/foo/spec-fix-2.json");
      expect(call.workspace).toBeUndefined(); // T3 r1 nit：docs-runner 不再收 workspace（handoffPath 权威）
      expect(call.findingsPath).toBe(findings);
    } finally {
      delete process.env.CDD_DRY_RUN;
      delete process.env.CLAUDE_CODE_SESSION_ID;
      docsRunnerMock.runDocsTask.mockClear();
    }
  });

  // ---- CLI 黑盒：canonical seed 驱动 Stopping / 轮次 ----

  it("review --type spec：canonical spec-review-1.json（doc_path 同 doc）于 .superpowers/cdd/foo/ → Stopping exit 3", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      seedDocsReviewRound(dir, doc, "spec-review-1.json");
      const r = runCli(["review", "--type", "spec", "--spec", doc],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/Review Stopping/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("review --type plan：canonical plan-review-1.json（doc_path 同 doc，foo.md → 同 slug foo）→ Stopping exit 3", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "plans", "foo.md");
      seedDocsReviewRound(dir, doc, "plan-review-1.json");
      const r = runCli(["review", "--type", "plan", "--plan", doc],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/Review Stopping/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fix --type spec 缺 --findings（round 无源）→ exit 2 提示 <type>-review-{R}.json", () => {
    const r = runCli(["fix", "--type", "spec", "--spec", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/spec-review-\{R\}\.json/);
  });

  it("fix --findings spec-review-0.json（round<1）→ exit 2 拒（round 须 >= 1）", () => {
    const r = runCli(["fix", "--type", "spec", "--spec", SMOKE_PLAN,
      "--findings", path.join(REPO_ROOT, ".superpowers", "cdd", "smoke-plan", "spec-review-0.json")],
      { env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/round must be >= 1/);
  });

  it("review --type branch 同 ref 已 APPROVED r1 → Stopping exit 3（prev 经 concrete base7..head7 匹配）", () => {
    const dir = tmpGitRepo();
    try {
      const plan = path.join(dir, "plan.md");
      writeFileSync(plan, "### Task 1:\n- base: develop\n");
      const wsPath = path.join(dir, ".superpowers", "cdd", "plan");
      mkdirSync(wsPath, { recursive: true });
      writeFileSync(path.join(wsPath, "branch-review-eeee555..ffff666-r1.json"),
        JSON.stringify({ task: 1, phase: "branch-review", status: "APPROVED", findings: [], artifacts: {}, blocker: "" }));
      const r = runCli(["review", "--type", "branch",
        "--plan", plan, "--base", "eeee555", "--head", "ffff666"],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/Review Stopping/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("review --type branch 轮次 per-ref：他 ref 已有 r1 时，新 ref dry-run 产出 -r1（非全局递增 r2）", () => {
    const dir = tmpGitRepo();
    try {
      const plan = path.join(dir, "plan.md");
      writeFileSync(plan, "### Task 1:\n- base: develop\n");
      const wsPath = path.join(dir, ".superpowers", "cdd", "plan");
      mkdirSync(wsPath, { recursive: true });
      // 他 ref（aaaa111..bbbb222）已有 r1 —— 全局轮次已被推到 r2；新 ref 应各自从 r1 起（ref 名内嵌）。
      writeFileSync(path.join(wsPath, "branch-review-aaaa111..bbbb222-r1.json"), "{}");
      const newHead = "cccc333";
      const newBase = "dddd444";
      const r = runCli(["review", "--type", "branch",
        "--plan", plan, "--base", newBase, "--head", newHead],
        { cwd: dir, env: { CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" } });
      expect(r.exitCode).toBe(0);
      expect(existsSync(path.join(wsPath, `branch-review-${newBase}..${newHead}-r1.json`))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
});