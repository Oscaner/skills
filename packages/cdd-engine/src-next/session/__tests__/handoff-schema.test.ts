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

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { HandoffSchema, type WorkCarrier } from "../handoff-schema.ts";
import { Ledger } from "../ledger.ts";

const schema = new HandoffSchema();

/** A hermetic ledger fixture — a fresh temp workspace (the buildHandoff carrier
 *  needs no on-disk state; the fixture keeps the per-face pins self-contained). */
const ledgerFixture = (): { ledger: Ledger; cleanup: () => void } => {
  const repo = mkdtempSync(path.join(tmpdir(), "handoff-carrier-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "test-slug",
  );
  return {
    ledger: new Ledger(workspace, new ConfigLoader()),
    cleanup: () => rmSync(repo, { recursive: true, force: true }),
  };
};

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

  it("the fence parses byte-identically to the declared face node minus engineOnly — the one-hand projection pin (T3)", () => {
    // The prompt-injection projection (schemaText) and the read-back declaration
    // (faceSchema) are the SAME declared object's two projections: parses of the
    // ```` ```json ```` fences must round-trip to the declared nodes minus the
    // engine-only metadata (projection ①'s authority filter — the child-visible
    // fence never shows the engine's own write keys) — the prompt can never show
    // a schema the engine does not enforce (the guard's checkHandoffPlane ③
    // asserts the same fact against the live tree).
    for (const face of ["work", "findings"] as const) {
      const text = schema.schemaText(face, false);
      const parsed = JSON.parse(text.split("```json\n")[1]!.split("\n```")[0]!);
      const { engineOnly: _authority, ...declared } = schema.faceSchema(face);
      void _authority;
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(declared));
    }
  });

  it("the projection fences filter the engineOnly metadata — neither face's child-visible view serializes the authority field (T3)", () => {
    // The engine-only keys live on the DECLARED node (the guard's write-plane
    // derivation + authority hygiene read them there); projection ①'s injected
    // fence must never serialize the metadata — the child sees only the writable
    // subset a child can write. The findings face declares `status` engine-only,
    // so its fence must not surface the field either (the same status the work
    // face's property makes a read-back refusal).
    expect(schema.schemaText("findings", false)).not.toContain("engineOnly");
    expect(schema.schemaText("work", false)).not.toContain("engineOnly");
    expect(schema.schemaText("findings", false)).not.toContain('"status"');
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

describe("the derived carrier types — buildHandoff per-face shaping (T1)", () => {
  it("the work carrier's flat keys equal the declared properties set, zero findings (the runtime fallback of the type derivation)", () => {
    const { ledger, cleanup } = ledgerFixture();
    try {
      const carrier = ledger.buildHandoff("work", {
        artifacts: { brief: "/b" },
        commits: { base: "a".repeat(8), head: "b".repeat(8) },
      });
      carrier.status = "APPROVED";
      carrier.failure_category = "none";
      carrier.changes = [{ file: "packages/x/a.ts", reason: "task" }];
      carrier.notes = ["one note"];
      expect(Object.keys(carrier).sort()).toEqual(
        Object.keys(schema.faceSchema("work").properties ?? {}).sort(),
      );
      expect("findings" in carrier).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("the findings carrier carries the schema-required findings key", () => {
    const { ledger, cleanup } = ledgerFixture();
    try {
      const carrier = ledger.buildHandoff("findings", {
        findings: [{ severity: "blocker", lens: "spec", summary: "drift" }],
      });
      expect(Object.keys(carrier)).toContain("findings");
      expect(carrier.findings).toEqual([{ severity: "blocker", lens: "spec", summary: "drift" }]);
    } finally {
      cleanup();
    }
  });

  it("the type gate — the work face refuses a findings payload at compile time", () => {
    const { ledger, cleanup } = ledgerFixture();
    try {
      // The compile-time twin of the runtime key-set pin above — a negative TYPE
      // assertion (the repo's zero-debt escape ban forbids compile-error-suppression
      // directives, so the gate is the assertion itself): `NoFindings<WorkCarrier>`
      // only COMPILES while the work writable subset declares no findings field — a
      // schema edit adding findings to the work face breaks this file's typecheck
      // (Q1→c), and the `buildHandoff("work", …)` overload refuses a findings init
      // by construction.
      type NoFindings<T> = "findings" extends keyof T ? never : true;
      const gate: NoFindings<WorkCarrier> = true;
      expect(gate).toBe(true);
      void ledger;
    } finally {
      cleanup();
    }
  });
});
