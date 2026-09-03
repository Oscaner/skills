// engine/tests/docs-runner.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateHandoffSchema, loadHandoffSchema } from "../lib/schema-utils.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
