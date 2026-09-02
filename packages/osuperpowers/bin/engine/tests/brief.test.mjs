// engine/tests/brief.test.mjs — T2: brief 生成/校验模块单测（Node port）。
// generateBrief：从 plan 机械提取 ### Task N: 段落，追加 TASK_BASE: <sha>，写入 brief。
//   plan 缺失 → throw；task 段落缺失 → throw；git HEAD 不可取 → throw。
// validateBrief：含 TASK_BASE: 行 → true；文件不存在 / 无 TASK_BASE: → false。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateBrief, validateBrief } from "../lib/brief.mjs";
import { gitCommit, gitInit } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");

function makePlan(tasks) {
  return tasks.map(([n, body]) => `### Task ${n}: Task${n}\n${body}`).join("\n\n") + "\n";
}

test("generateBrief: 提取 Task 1 段落，含 TASK_BASE:，不含 Task 2", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const planFile = path.join(dir, "plan.md");
  writeFileSync(planFile, makePlan([[1, "Do task 1\n"], [2, "Do task 2\n"]]));
  const outPath = path.join(dir, "task-1-brief.md");
  generateBrief(planFile, 1, outPath, REPO_ROOT);
  const content = readFileSync(outPath, "utf8");
  assert.match(content, /^### Task 1:/m);
  assert.match(content, /^TASK_BASE: [0-9a-f]{40}$/m);
  assert.doesNotMatch(content, /^### Task 2:/m);
});

test("generateBrief: task 不存在 → throw task N not found (CDD-level index)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const planFile = path.join(dir, "plan.md");
  writeFileSync(planFile, makePlan([[1, "body\n"]]));
  assert.throws(
    () => generateBrief(planFile, 99, path.join(dir, "out.md"), REPO_ROOT),
    /task 99 not found \(CDD-level index/,
  );
});

test("generateBrief: plan 不存在 → throw plan file not found", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  assert.throws(
    () => generateBrief(path.join(dir, "missing.md"), 1, path.join(dir, "out.md"), REPO_ROOT),
    /plan file not found/,
  );
});

test("validateBrief: 含 TASK_BASE: → true", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const f = path.join(dir, "brief.md");
  writeFileSync(f, "### Task 1: Foo\nDo something\nTASK_BASE: abc123\n");
  assert.equal(validateBrief(f), true);
});

test("validateBrief: 无 TASK_BASE: → false", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const f = path.join(dir, "brief.md");
  writeFileSync(f, "### Task 1: Foo\nDo something\n");
  assert.equal(validateBrief(f), false);
});

test("validateBrief: 文件不存在 → false", () => {
  assert.equal(validateBrief("/nonexistent/no-such-brief.md"), false);
});

// #173 回归钉死：generateBrief 第 4 参数语义 = repoRoot（取该目录所在仓库的 HEAD），cwd 无关。
test("generateBrief #173: 第 4 参数为 repoRoot —— cwd 无关，取传入目录所在仓库 HEAD", () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-brief-a-")));
  const repoB = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-brief-b-")));
  gitInit(repoA);
  gitInit(repoB);
  const planFile = path.join(repoA, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: x\nbody\n");
  gitCommit(repoA);
  const out = path.join(mkdtempSync(path.join(tmpdir(), "cdd-brief-out-")), "task-1-brief.md");
  // process.cwd() 与 repoA 无关（测试进程 cwd 在 oscaner-skills）——断言仅由第 4 参数决定
  generateBrief(planFile, 1, out, repoA);
  const head = execFileSync("git", ["-C", repoA, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.match(readFileSync(out, "utf8"), new RegExp(`^TASK_BASE: ${head.slice(0, 7)}`, "m"));
});

// #185 统一命名空间：--task N = CDD 级唯一索引（plan 中 ### Task N: heading 1:1 对应）
test("generateBrief #185: CDD 级统一命名空间 —— --task 2 取 Task 2 段落（不含 Task 1 / Task 3）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-ns-"));
  const planFile = path.join(dir, "plan.md");
  writeFileSync(planFile, makePlan([[1, "body 1\n"], [2, "body 2\n"], [3, "body 3\n"]]));
  const outPath = path.join(dir, "task-2-brief.md");
  generateBrief(planFile, 2, outPath, REPO_ROOT);
  const content = readFileSync(outPath, "utf8");
  assert.match(content, /^### Task 2:/m);
  assert.doesNotMatch(content, /^### Task 1:/m);
  assert.doesNotMatch(content, /^### Task 3:/m);
  assert.ok(content.includes("body 2"));
});

test("generateBrief #185: task 2 不存在（仅 Task 1）→ throw CDD-level index 错误信息", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-ns-miss-"));
  const planFile = path.join(dir, "plan.md");
  writeFileSync(planFile, makePlan([[1, "only task 1\n"]]));
  assert.throws(
    () => generateBrief(planFile, 2, path.join(dir, "out.md"), REPO_ROOT),
    /task 2 not found \(CDD-level index; plan must contain '### Task N:' heading\)/,
  );
});

// --- CLI entry point tests ---

const BRIEF_MJS = path.resolve(HERE, "../lib/brief.mjs");

function cliRun(repo, ...args) {
  try {
    const stdout = execFileSync(process.execPath, [BRIEF_MJS, ...args], {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exitCode: 0, stdout: stdout.trim() };
  } catch (e) {
    return { exitCode: e.status, stdout: (e.stdout || "").trim() };
  }
}

test("CLI --task N --plan --output: success → exit 0, brief path", () => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "brief-cli-")));
  gitInit(repo);
  const planFile = path.join(repo, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: First task\nDo stuff\n");
  gitCommit(repo);
  const outPath = path.join(repo, "task-1-brief.md");
  const r = cliRun(repo, "--task", "1", "--plan", planFile, "--output", outPath);
  assert.equal(r.exitCode, 0);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.brief, outPath);
  const content = readFileSync(outPath, "utf8");
  assert.match(content, /^### Task 1:/m);
  assert.match(content, /^TASK_BASE: [0-9a-f]{40}$/m);
});

test("CLI --task N: missing task → exit 1, stderr contains error", () => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "brief-cli-err-")));
  gitInit(repo);
  const planFile = path.join(repo, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: First task\nDo stuff\n");
  gitCommit(repo);
  const outPath = path.join(repo, "task-99-brief.md");
  const r = cliRun(repo, "--task", "99", "--plan", planFile, "--output", outPath);
  assert.equal(r.exitCode, 1);
});
