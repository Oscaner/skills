// engine/tests/schema-utils.test.mjs — handoff JSON schema validation tests.
// Tests validateHandoffSchema / loadHandoffSchema: valid object, missing required fields,
// invalid enums, unknown properties, type mismatches, edge cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateHandoffSchema, loadHandoffSchema } from "../lib/schema-utils.mjs";

// Minimal valid handoff object (all required fields present).
function validHandoff(overrides = {}) {
  return {
    task: 1,
    phase: "implement",
    status: "APPROVED",
    artifacts: {},
    findings: [],
    ...overrides,
  };
}

// ---- loadHandoffSchema ----

test("loadHandoffSchema: returns schema with required + properties", () => {
  const schema = loadHandoffSchema();
  assert.ok(schema.required, "schema has required array");
  assert.ok(schema.properties, "schema has properties object");
  assert.deepEqual(schema.required, ["task", "phase", "status", "artifacts", "findings"]);
});

test("loadHandoffSchema: additionalProperties is false", () => {
  const schema = loadHandoffSchema();
  assert.equal(schema.additionalProperties, false);
});

// ---- valid handoff ----

test("validateHandoffSchema: valid minimal handoff → valid", () => {
  const r = validateHandoffSchema(validHandoff());
  assert.equal(r.valid, true);
});

test("validateHandoffSchema: valid handoff with all optional fields → valid", () => {
  const r = validateHandoffSchema(validHandoff({
    commits: { base: "a".repeat(40), head: "b".repeat(40) },
    complexity: "simple",
    review_scope: "task",
    blocker: "some blocker",
    unverifiable: [],
    plan_conflicts: [],
  }));
  assert.equal(r.valid, true);
});

// ---- missing required fields ----

test("validateHandoffSchema: missing task → invalid", () => {
  const r = validateHandoffSchema({ phase: "implement", status: "APPROVED", artifacts: {}, findings: [] });
  assert.equal(r.valid, false);
  assert.match(r.reason, /missing required field: task/);
});

test("validateHandoffSchema: missing phase → invalid", () => {
  const r = validateHandoffSchema({ task: 1, status: "APPROVED", artifacts: {}, findings: [] });
  assert.equal(r.valid, false);
  assert.match(r.reason, /missing required field: phase/);
});

test("validateHandoffSchema: missing status → invalid", () => {
  const r = validateHandoffSchema({ task: 1, phase: "implement", artifacts: {}, findings: [] });
  assert.equal(r.valid, false);
  assert.match(r.reason, /missing required field: status/);
});

test("validateHandoffSchema: missing artifacts → invalid", () => {
  const r = validateHandoffSchema({ task: 1, phase: "implement", status: "APPROVED", findings: [] });
  assert.equal(r.valid, false);
  assert.match(r.reason, /missing required field: artifacts/);
});

test("validateHandoffSchema: missing findings → invalid", () => {
  const r = validateHandoffSchema({ task: 1, phase: "implement", status: "APPROVED", artifacts: {} });
  assert.equal(r.valid, false);
  assert.match(r.reason, /missing required field: findings/);
});

test("validateHandoffSchema: completely empty object → invalid", () => {
  const r = validateHandoffSchema({});
  assert.equal(r.valid, false);
  assert.match(r.reason, /missing required field: task/);
});

// ---- invalid enums ----

test("validateHandoffSchema: invalid phase → invalid", () => {
  const r = validateHandoffSchema(validHandoff({ phase: "review" }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /invalid phase: review/);
});

test("validateHandoffSchema: invalid status → invalid", () => {
  const r = validateHandoffSchema(validHandoff({ status: "DONE" }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /invalid status: DONE/);
});

test("validateHandoffSchema: valid phases: implement/task-review/fix", () => {
  for (const phase of ["implement", "task-review", "fix"]) {
    const r = validateHandoffSchema(validHandoff({ phase }));
    assert.equal(r.valid, true, `phase ${phase} should be valid`);
  }
});

test("validateHandoffSchema: valid statuses: APPROVED/BLOCKED/CHANGES_REQUESTED/TIMEOUT", () => {
  for (const status of ["APPROVED", "BLOCKED", "CHANGES_REQUESTED", "TIMEOUT"]) {
    const r = validateHandoffSchema(validHandoff({ status }));
    assert.equal(r.valid, true, `status ${status} should be valid`);
  }
});

// ---- unknown properties ----

test("validateHandoffSchema: unknown top-level property → invalid", () => {
  const r = validateHandoffSchema(validHandoff({ extraField: "oops" }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /unknown property: extraField/);
});

test("validateHandoffSchema: unknown nested property (not checked) → valid", () => {
  // additionalProperties: false is only checked at top level by schema-utils.mjs
  const r = validateHandoffSchema(validHandoff({
    artifacts: { brief: "/b.md", unknownNested: true },
  }));
  assert.equal(r.valid, true);
});

// ---- type mismatches ----

test("validateHandoffSchema: task is string → invalid", () => {
  const r = validateHandoffSchema(validHandoff({ task: "1" }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /task must be integer/);
});

test("validateHandoffSchema: task is float → valid (typeof is number, integer check not enforced at runtime)", () => {
  // The JSON schema declares "type": "integer" but validateHandoffSchema only checks
  // typeof !== 'number'. Floats pass the runtime check. This test documents current behavior.
  const r = validateHandoffSchema(validHandoff({ task: 1.5 }));
  assert.equal(r.valid, true);
});

test("validateHandoffSchema: findings is not array → invalid", () => {
  const r = validateHandoffSchema(validHandoff({ findings: "not-array" }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /findings must be array/);
});

test("validateHandoffSchema: artifacts is not object → invalid", () => {
  const r = validateHandoffSchema(validHandoff({ artifacts: "not-object" }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /artifacts must be object/);
});

// ---- commits.base validation ----

test("validateHandoffSchema: commits.base invalid hex → invalid", () => {
  const r = validateHandoffSchema(validHandoff({
    commits: { base: "not-a-sha" },
  }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /commits\.base must be 40-char hex SHA/);
});

test("validateHandoffSchema: commits.base 39 chars → invalid", () => {
  const r = validateHandoffSchema(validHandoff({
    commits: { base: "a".repeat(39) },
  }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /commits\.base must be 40-char hex SHA/);
});

test("validateHandoffSchema: commits.base valid 40-char hex → valid", () => {
  const r = validateHandoffSchema(validHandoff({
    commits: { base: "a".repeat(40) },
  }));
  assert.equal(r.valid, true);
});

test("validateHandoffSchema: commits.base uppercase hex → invalid (pattern requires lowercase)", () => {
  const r = validateHandoffSchema(validHandoff({
    commits: { base: "A".repeat(40) },
  }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /commits\.base must be 40-char hex SHA/);
});

// ---- edge cases ----

test("validateHandoffSchema: null findings → invalid (not array)", () => {
  const r = validateHandoffSchema(validHandoff({ findings: null }));
  assert.equal(r.valid, false);
  assert.match(r.reason, /findings must be array/);
});

test("validateHandoffSchema: task=0 → valid (schema minimum is 1, but validateHandoffSchema does not enforce minimum)", () => {
  // Note: the JSON schema declares minimum: 1, but validateHandoffSchema only checks
  // typeof task !== 'number'. This test documents the current behavior.
  const r = validateHandoffSchema(validHandoff({ task: 0 }));
  assert.equal(r.valid, true);
});

test("validateHandoffSchema: task negative → valid (same as above — minimum not enforced)", () => {
  const r = validateHandoffSchema(validHandoff({ task: -1 }));
  assert.equal(r.valid, true);
});

test("validateHandoffSchema: completely empty findings → valid", () => {
  const r = validateHandoffSchema(validHandoff({ findings: [] }));
  assert.equal(r.valid, true);
});

test("validateHandoffSchema: findings with entries → valid", () => {
  const r = validateHandoffSchema(validHandoff({
    findings: [{ severity: "blocker", summary: "x" }],
  }));
  assert.equal(r.valid, true);
});
