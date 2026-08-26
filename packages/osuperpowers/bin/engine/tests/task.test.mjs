// engine/tests/task.test.mjs — T3: cdd-task.mjs 入口壳 CLI 契约（Node port of cdd-cli-dry-run-smoke.sh）。
// CDD_DRY_RUN=1 跳过真实 CLI 调用；runTask 仍走 registry ship gate / template render /
// commit-contract（非 git temp workspace → fail-open）。断言 H1 四行 + 退出码。
// 测试经 spawnSync 起子进程（cwd=repo root），env 清掉 orchestrator 会话可能继承的 CDD_*。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gitCommit, gitInit } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/osuperpowers/bin/engine/tests
const REPO_ROOT = path.resolve(HERE, "../../../../..");
const TASK_MJS = path.join(REPO_ROOT, "packages/osuperpowers/bin/engine/cdd-task.mjs");

// 测试 env：清掉外部会话可能继承的 CDD_*，再叠加测试可控的 extra。
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra };
}

// spawn 子进程；返回 { status, stdout, stderr }。
function run(args, extraEnv = {}, opts = {}) {
  const res = spawnSync("node", [TASK_MJS, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    env: cleanEnv(extraEnv),
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

// #173：plan 须位于 git 仓库内（repoRoot = gitToplevel(dirname(plan))，永不回退 cwd）——
// workspace 派生于 <planDir>/.superpowers/cdd/<slug>/；gitCommit 保持工作树干净
// （commit-contract 校验）。
function setupWorkspace() {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-task-cli-")));
  gitInit(dir);
  writeFileSync(path.join(dir, "plan.md"), "# Plan\n### Task 1: test\n");
  gitCommit(dir);
  return dir;
}

test("cdd-task.mjs: dry-run implement → H1 四行 DONE + exit 0", () => {
  const ws = setupWorkspace();
  const res = run(
    ["--harness", "claude", "--task", "1", "--mode", "implement", "--plan", path.join(ws, "plan.md")],
    { CDD_DRY_RUN: "1", CDD_WORKSPACE: ws },
  );
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const lines = res.stdout.trim().split("\n");
  assert.equal(lines.length, 4, `expected 4 H1 lines, got: ${JSON.stringify(res.stdout)}`);
  assert.equal(lines[0], "status: DONE");
  assert.equal(lines[1], "commits: base=dry-run head=dry-run");
  assert.match(lines[2], /^artifacts: brief=/);
  assert.equal(lines[3], "blocker: none");
});

test("cdd-task.mjs: dry-run task-review/fix 三模式 → status DONE + exit 0", () => {
  for (const mode of ["task-review", "fix"]) {
    const ws = setupWorkspace();
    const res = run(
      ["--harness", "claude", "--task", "1", "--mode", mode, "--plan", path.join(ws, "plan.md")],
      { CDD_DRY_RUN: "1", CDD_WORKSPACE: ws },
    );
    assert.equal(res.status, 0, `mode ${mode} stderr: ${res.stderr}`);
    assert.match(res.stdout, /^status: DONE$/m, `mode ${mode}`);
  }
});

test("cdd-task.mjs: -h/--help → usage stdout + exit 0", () => {
  for (const flag of ["-h", "--help"]) {
    const res = run([flag]);
    assert.equal(res.status, 0, `flag ${flag}`);
    assert.match(res.stdout, /^usage: /, `flag ${flag}`);
  }
});

test("cdd-task.mjs: 缺 --harness → usage stderr + exit 2", () => {
  const res = run(["--task", "1", "--mode", "implement"]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /^usage: /);
});

test("cdd-task.mjs: Mode A 缺 --mode → usage exit 2", () => {
  const res = run(["--harness", "claude", "--task", "1"]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /^usage: /);
});

test("cdd-task.mjs: 未知 flag → usage exit 2", () => {
  const res = run(["--bogus", "x"]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unknown argument: --bogus/);
});

test("cdd-task.mjs: 非法 mode → CDD_BLOCKED exit 1（port cdd-cli-dry-run-smoke handoff 拒绝）", () => {
  const ws = setupWorkspace();
  const res = run(
    ["--harness", "claude", "--task", "1", "--mode", "handoff", "--plan", path.join(ws, "plan.md")],
    { CDD_DRY_RUN: "1", CDD_WORKSPACE: ws },
  );
  assert.equal(res.status, 1);
  assert.match(res.stderr, /CDD_MODE must be implement\|task-review\|fix \(got: handoff\)/);
});

test("cdd-task.mjs: --plan without --task → usage stderr + exit 2", () => {
  const ws = setupWorkspace();
  const res = run(
    ["--harness", "claude", "--plan", path.join(ws, "plan.md")],
    { CDD_DRY_RUN: "1", CDD_WORKSPACE: ws },
  );
  assert.equal(res.status, 2, `stderr: ${res.stderr}`);
  assert.match(res.stderr, /^usage: /);
});
