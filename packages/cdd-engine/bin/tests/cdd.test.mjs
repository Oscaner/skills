// bin/tests/cdd.test.mjs — 合并面 CLI（bin/cdd.mjs）契约测试。
// 覆盖：帮助/用法、review 的 round+Stopping 接线（dry-run smoke）、fix --findings 接线、
// select/research 内联、brief/contract 模块转发。CDD_DRY_RUN=1 跳过真实 harness 调用。
import { describe, it, expect } from "vitest";
import { execaSync } from "execa";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Repo-root derivation via fileURLToPath (task.test.mjs convention) — no hardcoded machine
// path, so the suite also passes under CI checkouts (STD-4). CDD_MJS must be absolute:
// contract tests switch cwd to a temp repo and a relative path would break there.
const HERE = path.dirname(fileURLToPath(import.meta.url));   // packages/cdd-engine/bin/tests
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..");
const CDD_MJS = path.join(REPO_ROOT, "packages", "cdd-engine", "bin", "cdd.mjs");
const SMOKE_PLAN = "packages/cdd-engine/bin/tests/fixtures/smoke-plan.md";
const NODE = process.execPath;

// Test env: strip 任何从 orchestrator session 继承的 CDD_*，再叠加测试 extras（与 task.test.mjs 一致）。
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra };
}

function runCli(args = [], opts = {}) {
  const { env: extraEnv = {}, cwd = REPO_ROOT } = opts;
  try {
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd, env: cleanEnv(extraEnv), encoding: "utf8" });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    return { exitCode: e.exitCode ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

describe("cdd CLI", () => {
  it("-h → help", () => {
    const r = execaSync(NODE, [CDD_MJS, "--help"], { cwd: REPO_ROOT, env: cleanEnv() });
    expect(r.stdout).toMatch(/implement|review|fix|select|research|brief|contract/);
  });

  it("review missing --type → usage exit 2", () => {
    expect(() => execaSync(NODE, [CDD_MJS, "review"], { cwd: REPO_ROOT, env: cleanEnv({ CDD_DRY_RUN: "1" }) }))
      .toThrow(/required option|--type/);
  });

  it("dry-run review --type task → H1 + exit 0", () => {
    const r = runCli(["review", "--type", "task",
      "--harness", "claude", "--task", "1", "--plan", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1" } });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/status: APPROVED/);
  });

  it("dry-run review --type branch → H1 + exit 0（随机 base/head 避免 Review Stopping 误拒；tmp plan 避免向真实 workspace 写副作用）", () => {
    const base = `base${Date.now().toString(16).slice(-4)}`;
    const head = `head${Date.now().toString(16).slice(-8, -4)}`;
    const tmpPlan = path.join(mkdtempSync(path.join(tmpdir(), "cdd-br-")), "plan.md");
    writeFileSync(tmpPlan, "### Task 1:\n- base: develop\n");
    const r = runCli(["review", "--type", "branch", "--harness", "claude",
      "--plan", tmpPlan, "--base", base, "--head", head],
      { env: { CDD_DRY_RUN: "1" } });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/status: APPROVED/);
    expect(r.stdout).toMatch(new RegExp(`commits: base=${base} head=${head}`));
  });

  it("dry-run review --type spec → exit 0", () => {
    const r = runCli(["review", "--type", "spec", "--harness", "claude", "--doc", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1" } });
    expect(r.exitCode).toBe(0);
  });

  it("dry-run fix --type task → H1 + exit 0", () => {
    const r = runCli(["fix", "--type", "task", "--harness", "claude", "--task", "1",
      "--findings", SMOKE_PLAN, "--plan", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1" } });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/status: APPROVED/);
  });

  it("fix --type spec|plan 非 dry-run：doc-fix 模板渲染后停在 harness gate（Task 4 SP-1 回归）", () => {
    // Task 4：fix 模板统一走 reviews.json fixTemplate（spec/plan → doc-fix 共享壳），
    // docs-runner 不再做 `-review`→`-fix` 派生（doc-fix 直传，不得 double-suffix）。
    // nonexistent harness 保证停在 harness gate（"unknown harness"），不进入 spawn/写 handoff；
    // 若 doc-fix 缺失/渲染崩，stderr 会出现 template 字样 → not.toMatch(/template/) 拦截。
    for (const type of ["spec", "plan"]) {
      const r = runCli(["fix", "--type", type, "--harness", "nonexistent", "--doc", SMOKE_PLAN]);
      expect(r.stderr).toMatch(/unknown harness: nonexistent/);
      expect(r.stderr).not.toMatch(/template/);
    }
  });

  it("review --type spec 非 dry-run：review.md 共享壳渲染后停在 harness gate（Task 4 路由回归）", () => {
    // runDocsTask 先 render 共享壳 review.md（reviews.json type=spec 补全占位）再进 harness gate；
    // 渲染崩（缺参/模板缺失）→ stderr 出现 template → not.toMatch(/template/) 拦截。
    const r = runCli(["review", "--type", "spec", "--harness", "nonexistent", "--doc", SMOKE_PLAN]);
    expect(r.stderr).toMatch(/unknown harness: nonexistent/);
    expect(r.stderr).not.toMatch(/template/);
  });

  it("review --type branch 缺 --base/--head → 必填守卫 exit 2（SP-2）", () => {
    const r = runCli(["review", "--type", "branch", "--harness", "claude", "--plan", SMOKE_PLAN]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/--base/);
  });

  it("review --type plan 非 dry-run：review.md 共享壳渲染后停在 harness gate（SP-3）", () => {
    // Task 4：plan 走共享壳 review.md（reviews.json type=plan 配置，占位由注入参数补齐），
    // 不再要求 {{SPEC}}/{{PASS}}。--spec 保留为可选（不内嵌文档），默认/显式都必须
    // 落在 "unknown harness: nonexistent"（exit 2），而不是渲染崩溃。
    const r = runCli(["review", "--type", "plan", "--harness", "nonexistent", "--doc", SMOKE_PLAN]);
    expect(r.stderr).toMatch(/unknown harness: nonexistent/);
    expect(r.stderr).not.toMatch(/template/);
    const r2 = runCli(["review", "--type", "plan", "--harness", "nonexistent", "--doc", SMOKE_PLAN, "--spec", SMOKE_PLAN]);
    expect(r2.stderr).toMatch(/unknown harness: nonexistent/);
    expect(r2.stderr).not.toMatch(/template/);
  });

  it("dry-run review --type plan --spec → exit 0（SP-3 --spec 接线）", () => {
    const r = runCli(["review", "--type", "plan", "--harness", "claude", "--doc", SMOKE_PLAN, "--spec", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1" } });
    expect(r.exitCode).toBe(0);
  });

  it("--task 非整数 → 校验回退 exit 2（STD-3 Bug A 契约回归）", () => {
    // parseInt NaN must not leak into runTask (task-NaN-* garbage + fake APPROVED H1);
    // the Commander coercion rejects at parse time → exit 2 (legacy cdd-task contract).
    const r = runCli(["review", "--type", "task", "--harness", "claude", "--task", "abc", "--plan", SMOKE_PLAN],
      { env: { CDD_DRY_RUN: "1" } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/must be an integer, got: abc/);
  });

  // --- SP-4 Review Stopping status criterion: a BLOCKED/TIMEOUT failure round (findings:[])
  //     must remain re-dispatchable; only an APPROVED round with blocker=0 stops a re-run. ---

  // Seed helper: temp git repo + plan file + a seeded task-N-task-review-N.json round.
  function seedTaskReviewHandoff(status) {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-stop-"));
    execaSync("git", ["-C", dir, "init", "-q"]);
    execaSync("git", ["-C", dir, "-c", "user.name=cdd-test", "-c", "user.email=cdd-test@example.com",
      "commit", "--allow-empty", "-qm", "fixture"]);
    const plan = path.join(dir, "zz-stop-test.md");
    writeFileSync(plan, "### Task 1: fixture\n");
    const ws = path.join(dir, ".superpowers", "cdd", "zz-stop-test");
    mkdirSync(ws, { recursive: true });
    writeFileSync(path.join(ws, "task-1-task-review-1.json"),
      JSON.stringify({ task: 1, phase: "task-review", status, artifacts: {}, findings: [],
        ...(status !== "APPROVED" ? { blocker: "boom" } : {}) }));
    return { dir, plan };
  }

  it("review --type task：status:BLOCKED 失败轮 → 可重派（SP-4）", () => {
    const { dir, plan } = seedTaskReviewHandoff("BLOCKED");
    try {
      const r = runCli(["review", "--type", "task", "--harness", "claude", "--task", "1", "--plan", plan],
        { cwd: dir, env: { CDD_DRY_RUN: "1" } });
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
      const r = runCli(["review", "--type", "task", "--harness", "claude", "--task", "1", "--plan", plan],
        { cwd: dir, env: { CDD_DRY_RUN: "1" } });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/already blocker=0 — Review Stopping/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("select 无可用 harness → BLOCKED exit 1", () => {
    const r = runCli(["select"], { env: { PATH: "/nonexistent" } });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/BLOCKED: no full harness installed/);
  });

  it("dry-run research → exit 0", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-cli-research-"));
    try {
      const brief = path.join(dir, "brief.md");
      writeFileSync(brief, "# test brief\n");
      const r = runCli(["research", "--harness", "claude", "--brief", brief, "--output", path.join(dir, "findings.md")],
        { env: { CDD_DRY_RUN: "1" } });
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

  it("contract --check-dirty（临时 git repo）→ dirty:false", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-cli-contract-"));
    try {
      execaSync("git", ["-C", dir, "init", "-q"]);
      execaSync("git", ["-C", dir, "-c", "user.name=cdd-test", "-c", "user.email=cdd-test@example.com",
        "commit", "--allow-empty", "-qm", "fixture"]);
      const r = runCli(["contract", "--check-dirty"], { cwd: dir });
      expect(r.exitCode).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual({ dirty: false });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});