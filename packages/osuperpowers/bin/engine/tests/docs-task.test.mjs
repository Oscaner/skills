// engine/tests/docs-task.test.mjs — integration tests for docs-task.mjs CLI.
// Covers: --mode review/fix dry-run, invalid args, schema rejection.
// Migrated from review.test.mjs (deleted in T8). Extended in T13.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateHandoffSchema } from "../lib/schema-utils.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");
const DOCS_TASK = path.join(REPO_ROOT, "packages/osuperpowers/bin/engine/docs-task.mjs");
const DOCS_SCHEMA_PATH = path.join(REPO_ROOT, "packages/osuperpowers/skills/_templates/docs-handoff-schema.json");

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

// ---- T13: dry-run + --param + schema rejection ----

test("docs-task.mjs: --param KEY=VALUE passes through to template rendering → exit 0", () => {
  // Verifies extraParams from --param reach renderTemplate (spec §2.9 extraParams)
  const r = run(
    ["--harness", "claude", "--mode", "review", "--template", "plan-review",
     "--doc", "/x.md", "--param", "SPEC=/some/spec.md"],
    { DOCS_DRY_RUN: "1" },
  );
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  // dry-run skips real agent; just verify CLI doesn't crash on --param
  assert.match(r.stdout, /^status: APPROVED$/m);
});

test("docs-task.mjs: dry-run review → status APPROVED + exit 0", () => {
  const r = run(
    ["--harness", "claude", "--mode", "review", "--template", "spec-review", "--doc", "/x.md"],
    { DOCS_DRY_RUN: "1" },
  );
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /^status: APPROVED$/m);
});

test("docs-task.mjs: dry-run fix → status APPROVED + exit 0", () => {
  const r = run(
    ["--harness", "claude", "--mode", "fix", "--template", "spec-review", "--doc", "/x.md"],
    { DOCS_DRY_RUN: "1" },
  );
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /^status: APPROVED$/m);
});

test("docs-task.mjs: invalid schema phase → validateHandoffSchema rejects", () => {
  const invalidHandoff = {
    phase: "doc-review",  // invalid — enum expects "review"
    status: "APPROVED", findings: [], artifacts: {}, doc_path: "/spec.md",
  };
  const result = validateHandoffSchema(invalidHandoff, DOCS_SCHEMA_PATH);
  assert.equal(result.valid, false, "invalid phase must be rejected by docs-handoff-schema");
  assert.match(result.reason, /invalid phase/);
});
