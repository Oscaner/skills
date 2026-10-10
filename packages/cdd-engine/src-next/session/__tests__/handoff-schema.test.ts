// packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts
// T15 v1.9 — the handoff schema face suite (one declaration, two projections):
//   · projection ① — schemaText: the per-face writable-subset fence (work vs
//     findings), the evidence-file fence on the task-family work rounds, and the
//     byte-stability of the injected prompt text;
//   · projection ② — violations/evidenceViolations: the child draft's read-back
//     validation (the SAME declared objects the prompt showed; a violation is the
//     engine's read-back BLOCK — no-overwrite on failure);
//   · the status rollup — the review conclusion (blocker → CHANGES_REQUESTED ·
//     warn/nit → REVIEW_FIX · none → APPROVED) + the findings normalization (the
//     capsule's blocker face, never the judgment domain).

import { describe, expect, it } from "vitest";
import { HandoffSchema } from "../handoff-schema.ts";

const schema = new HandoffSchema();

/** The canonical valid work draft — the implement/fix child's write-back. */
const WORK = {
  status: "APPROVED",
  artifacts: { brief: "/b", report: "/r", test_evidence: "/ws/tasks-1-test-evidence.json" },
  commits: { base: "a".repeat(8), head: "b".repeat(8) },
  changes: [{ file: "packages/x/a.ts", reason: "task scope" }],
  notes: ["one note"],
};

/** The canonical valid review draft — the findings-only write-back. */
const FINDINGS = {
  findings: [{ severity: "blocker", lens: "spec", summary: "drift" }],
  notes: [],
};

/** The canonical valid evidence file — the evidence gate's read-back input. */
const EVIDENCE = {
  command: "npx vitest run",
  exit_code: 0,
  passed: true,
  warnings_count: 0,
  typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
};

describe("projection ① — the injected writable-subset schema text", () => {
  it("renders the work face — the carrier fence + the evidence-file fence", () => {
    const text = schema.schemaText("work", true);
    expect(text).toContain("```json");
    expect(text).toContain("Write the handoff draft at `OUTPUT_HANDOFF` per this writable subset");
    expect(text).toContain('"status"');
    expect(text).toContain('"artifacts"');
    expect(text).toContain('"commits"');
    expect(text).toContain("The evidence file");
    expect(text).toContain('"typecheck"');
    // the reserved engine fields are NOT writable by the child — the subset refuses them
    expect(JSON.parse(text.split("```json\n")[1]!.split("\n```")[0]!)).toMatchObject({
      type: "object",
      required: ["status", "artifacts"],
    });
  });

  it("renders the findings face — findings only, no status, no evidence fence", () => {
    const text = schema.schemaText("findings", false);
    expect(text).toContain("```json");
    expect(text).toContain('"findings"');
    expect(text).not.toContain('"status"');
    expect(text).not.toContain("The evidence file");
    const json = JSON.parse(text.split("```json\n")[1]!.split("\n```")[0]!);
    expect(json).toMatchObject({ type: "object", required: ["findings"] });
  });

  it("is byte-stable per (face, evidence) — the prompt's contract surface never shifts", () => {
    // the SAME face renders identical text every dispatch (the prefix-tail cache fact)
    expect(schema.schemaText("work", true)).toBe(schema.schemaText("work", true));
    expect(schema.schemaText("findings", false)).toBe(schema.schemaText("findings", false));
    expect(schema.schemaText("work", true)).not.toBe(schema.schemaText("findings", false));
  });
});

describe("projection ② — the read-back validation (violations)", () => {
  it("accepts the canonical work draft and the canonical findings draft", () => {
    expect(schema.violations("work", WORK)).toEqual([]);
    expect(schema.violations("findings", FINDINGS)).toEqual([]);
  });

  it("refuses a work draft missing the required status / artifacts", () => {
    expect(schema.violations("work", { artifacts: { report: "/r" } })).toContain(
      "status: required",
    );
    expect(schema.violations("work", { status: "APPROVED" })).toContain("artifacts: required");
  });

  it("refuses a non-object draft and an out-of-enum status", () => {
    expect(schema.violations("work", "nope")).toEqual(["expected an object"]);
    expect(schema.violations("work", { status: "NEEDS_CONTEXT", artifacts: {} })).toEqual([
      "status: must be one of APPROVED | BLOCKED",
    ]);
  });

  it("refuses an engine-reserved field (the single-author rule: phase/tasks are the engine's)", () => {
    expect(
      schema.violations("work", { status: "APPROVED", artifacts: {}, phase: "implement" }),
    ).toEqual(["phase: not a declared field"]);
    expect(schema.violations("work", { status: "APPROVED", artifacts: {}, tasks: [1] })).toEqual([
      "tasks: not a declared field",
    ]);
    expect(schema.violations("findings", { findings: [], status: "APPROVED" })).toEqual([
      "status: not a declared field",
    ]);
  });

  it("refuses a malformed commits row (non-8-char shas)", () => {
    const bad = { ...WORK, commits: { base: "short", head: "b".repeat(8) } };
    expect(schema.violations("work", bad)).toEqual(["commits.base: must be at least 8 characters"]);
  });

  it("refuses a findings draft with a missing findings array or a bad severity", () => {
    expect(schema.violations("findings", {})).toEqual(["findings: required"]);
    expect(schema.violations("findings", { findings: "nope" })).toEqual([
      "findings: expected an array",
    ]);
    expect(
      schema.violations("findings", {
        findings: [{ severity: "fatal", lens: "spec", summary: "x" }],
      }),
    ).toEqual(["findings[0].severity: must be one of blocker | warn | nit"]);
    expect(
      schema.violations("findings", {
        findings: [{ severity: "warn", lens: "spec" }],
      }),
    ).toEqual(["findings[0].summary: required"]);
  });
});

describe("projection ② — the evidence read-back (evidenceViolations)", () => {
  it("accepts the canonical evidence file", () => {
    expect(schema.evidenceViolations(EVIDENCE)).toEqual([]);
  });

  it("refuses a missing evidence file (the null read-back face)", () => {
    expect(schema.evidenceViolations(null)).toEqual(["the evidence file is missing"]);
  });

  it("refuses an incomplete typecheck item (the missing-typecheck = BLOCK pin)", () => {
    expect(
      schema.evidenceViolations({
        command: "x",
        exit_code: 0,
        passed: true,
        warnings_count: 0,
        typecheck: { command: "tsc --noEmit", exit_code: 0 },
      }),
    ).toEqual(["typecheck.passed: required"]);
    expect(
      schema.evidenceViolations({
        command: "x",
        exit_code: 0,
        passed: true,
        warnings_count: 0,
      }),
    ).toEqual(["typecheck: required"]);
  });

  it("refuses a non-boolean passed and a non-integer exit_code", () => {
    expect(schema.evidenceViolations({ ...EVIDENCE, passed: "yep" })).toEqual([
      "passed: expected a boolean",
    ]);
    expect(schema.evidenceViolations({ ...EVIDENCE, exit_code: "0" })).toEqual([
      "exit_code: expected an integer",
    ]);
  });
});

describe("the status rollup + the findings normalization", () => {
  it("rolls the review conclusion up from the finding severities", () => {
    expect(schema.rollup([])).toBe("APPROVED");
    expect(schema.rollup([{ severity: "nit" }])).toBe("REVIEW_FIX");
    expect(schema.rollup([{ severity: "warn" }])).toBe("REVIEW_FIX");
    expect(schema.rollup([{ severity: "blocker" }])).toBe("CHANGES_REQUESTED");
    expect(schema.rollup([{ severity: "warn" }, { severity: "blocker" }])).toBe(
      "CHANGES_REQUESTED",
    );
  });

  it("normalizes the draft findings — unknown severities dropped, severity + summary kept", () => {
    expect(schema.findingsOf(FINDINGS.findings)).toEqual([
      { severity: "blocker", summary: "drift" },
    ]);
    expect(
      schema.findingsOf([{ severity: "fatal" }, { severity: "nit", summary: "s" }, "garbage"]),
    ).toEqual([{ severity: "nit", summary: "s" }]);
    expect(schema.findingsOf("nope")).toEqual([]);
  });
});
