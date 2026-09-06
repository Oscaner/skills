// bin/tests/cdd.test.mjs — 合并面 CLI（bin/cdd.mjs）契约测试。
// 覆盖：帮助/用法、review 的 round+Stopping 接线（dry-run smoke）、fix --findings 接线、
// select/research 内联、brief/contract 模块转发。CDD_DRY_RUN=1 跳过真实 harness 调用。
import { describe, it, expect } from "vitest";
import { execaSync } from "execa";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = "/Users/kang/Projects/oscaner-skills";   // 显式 cwd（vitest 默认 cwd=packages/cdd-engine，相对 smoke-plan 不可达）
const CDD_MJS = path.join(REPO_ROOT, "packages", "cdd-engine", "bin", "cdd.mjs");   // absolute（contract 测试换 cwd 到临时 repo）
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

  it("dry-run review --type branch → H1 + exit 0（随机 base/head 避免 Review Stopping 误拒）", () => {
    const base = `base${Date.now().toString(16).slice(-4)}`;
    const head = `head${Date.now().toString(16).slice(-8, -4)}`;
    const r = runCli(["review", "--type", "branch", "--harness", "claude",
      "--plan", SMOKE_PLAN, "--base", base, "--head", head],
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

  it("fix --type spec|plan 非 dry-run：pre-Task-4 fallback 模板可渲染（SP-1 回归）", () => {
    // SP-1 回归：docs-runner fix mode 恒做 `-review`→`-fix` 派生，fallback 传 spec-review/plan-review
    // 才得到可渲染的 spec-fix/plan-fix（传 spec-fix → spec-fix-fix unknown template，崩在 render）。
    // nonexistent harness 保证停在 harness gate（"unknown harness"），不进入 spawn/写 handoff。
    for (const type of ["spec", "plan"]) {
      const r = runCli(["fix", "--type", type, "--harness", "nonexistent", "--doc", SMOKE_PLAN]);
      expect(r.stderr).toMatch(/unknown harness: nonexistent/);
      expect(r.stderr).not.toMatch(/template/);
    }
  });

  it("review --type branch 缺 --base/--head → 必填守卫 exit 2（SP-2）", () => {
    const r = runCli(["review", "--type", "branch", "--harness", "claude", "--plan", SMOKE_PLAN]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/--base/);
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