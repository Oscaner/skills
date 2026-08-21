// packages/osuperpowers/bin/engine/tests/brief.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateBrief, validateBrief } from "../lib/brief.mjs";

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

test("generateBrief: task 不存在 → throw task N not found", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const planFile = path.join(dir, "plan.md");
  writeFileSync(planFile, makePlan([[1, "body\n"]]));
  assert.throws(
    () => generateBrief(planFile, 99, path.join(dir, "out.md"), REPO_ROOT),
    /task 99 not found/,
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
