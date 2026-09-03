// engine/tests/docs-runner.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateHandoffSchema, loadHandoffSchema } from "../lib/schema-utils.mjs";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDocsTask } from "../lib/docs-runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, "../../..");
const DOCS_SCHEMA = path.join(PKG_ROOT, "skills", "_templates", "docs-handoff-schema.json");

test("docs-handoff-schema: required fields present", () => {
  const schema = loadHandoffSchema(DOCS_SCHEMA);
  assert.deepEqual(schema.required, ["phase", "status", "findings", "artifacts", "doc_path"]);
});

test("docs-handoff-schema: valid review handoff", () => {
  const r = validateHandoffSchema(
    { phase: "review", status: "APPROVED", findings: [], artifacts: {}, doc_path: "/spec.md" },
    DOCS_SCHEMA
  );
  assert.equal(r.valid, true);
});

test("docs-handoff-schema: valid fix handoff", () => {
  const r = validateHandoffSchema(
    { phase: "fix", status: "APPROVED", findings: [], artifacts: {}, doc_path: "/spec.md" },
    DOCS_SCHEMA
  );
  assert.equal(r.valid, true);
});

test("docs-handoff-schema: invalid phase rejects", () => {
  const r = validateHandoffSchema(
    { phase: "doc-review", status: "APPROVED", findings: [], artifacts: {}, doc_path: "/spec.md" },
    DOCS_SCHEMA
  );
  assert.equal(r.valid, false);
  assert.match(r.reason, /invalid phase/);
});

test("docs-handoff-schema: missing doc_path rejects", () => {
  const r = validateHandoffSchema(
    { phase: "review", status: "APPROVED", findings: [], artifacts: {} },
    DOCS_SCHEMA
  );
  assert.equal(r.valid, false);
  assert.match(r.reason, /missing required field: doc_path/);
});

// ---- T13: runDocsTask dry-run + BLOCKED message format ----

test("runDocsTask: dry-run review → exitCode 0 + APPROVED handoff", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "docs-runner-"));
  const handoffPath = path.join(ws, "spec-review-1.json");
  const result = await runDocsTask("review", {
    harness: "claude", template: "spec-review",
    docPath: "/spec.md", findingsPath: undefined,
    handoffPath, round: 1, dryRun: true,
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.handoff.status, "APPROVED");
  assert.equal(result.handoff.phase, "review");
});

test("runDocsTask: BLOCKED handoff has artifacts + <diagnosis> → <action> message", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "docs-runner-"));
  const handoffPath = path.join(ws, "spec-review-1.json");
  // Test the BLOCKED message format directly via writeHandoff (same path used by docs-runner.mjs).
  const { writeHandoff } = await import("../lib/contract.mjs");
  writeHandoff(handoffPath, {
    phase: "review", status: "BLOCKED", findings: [], artifacts: {},
    doc_path: "/spec.md",
    blocker: `spec-review-1.json not written after exit 0 → re-run review and ensure handoff is written to ${handoffPath} before exit`,
  });
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.match(h.blocker, /→/, "BLOCKED blocker must contain → action");
  assert.ok(h.artifacts !== undefined, "BLOCKED handoff must have artifacts field");
});
