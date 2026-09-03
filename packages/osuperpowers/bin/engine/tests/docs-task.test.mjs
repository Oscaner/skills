// engine/tests/docs-task.test.mjs — integration tests for docs-task.mjs CLI.
// Covers: --mode review/fix dry-run, invalid args, schema rejection.
// Migrated from review.test.mjs (deleted in T8). Extended in T13.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");
const DOCS_TASK = path.join(REPO_ROOT, "packages/osuperpowers/bin/engine/docs-task.mjs");

function run(args, extraEnv = {}) {
  return spawnSync("node", [DOCS_TASK, ...args], {
    cwd: REPO_ROOT, env: { ...process.env, ...extraEnv }, encoding: "utf8",
  });
}

test("docs-task.mjs: -h → usage + exit 0", () => {
  const r = run(["-h"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^usage:/);
});

test("docs-task.mjs: missing --harness → usage + exit 2", () => {
  const r = run(["--mode", "review", "--template", "spec-review", "--doc", "/x.md"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^usage:/);
});

test("docs-task.mjs: invalid --mode → exit 2", () => {
  const r = run(["--harness", "claude", "--mode", "doc-review", "--template", "spec-review", "--doc", "/x.md"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /must be review\|fix/);
});

test("docs-task.mjs: branch-review + --mode fix → exit 2", () => {
  const r = run(["--harness", "claude", "--mode", "fix", "--template", "branch-review", "--doc", "/x.md"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /does not support.*fix/);
});
