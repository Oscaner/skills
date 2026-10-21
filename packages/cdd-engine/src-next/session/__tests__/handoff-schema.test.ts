// packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts
// The handoff schema face suite (one declaration, two projections):
//   · the op-derived plane — planeOf: implement / fix → work, review → judge;
//   · projection ① — schemaText: the per-plane writable-subset fence (work vs
//     judge), the evidence-file fence on the evidence rounds, and the byte-stability
//     of the injected prompt text;
//   · projection ② — violations/evidenceViolations: the child draft's read-back
//     validation (the SAME projected objects the prompt showed; a violation is the
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
import { HandoffSchema } from "../handoff-schema.ts";
import { Ledger } from "../ledger.ts";

const schema = new HandoffSchema();

/** A hermetic ledger fixture — a fresh temp workspace (the buildHandoff carrier
 *  needs no on-disk state; the fixture keeps the per-plane pins self-contained). */
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
  artifacts: { report: "/r", test_evidence: "/ws/tasks-1-test-evidence.json" },
  notes: ["one note"],
};

/** The canonical valid judge draft — the review's write-back. */
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

describe("the op-derived plane — planeOf", () => {
  it("derives work for implement / fix and judge for review — the ONE plane source", () => {
    expect(HandoffSchema.planeOf("implement")).toBe("work");
    expect(HandoffSchema.planeOf("fix")).toBe("work");
    expect(HandoffSchema.planeOf("review")).toBe("judge");
  });

  it("projects the plane's writable subset — CARRIER's declaration order filtered per plane", () => {
    const work = schema.planeSchema("work");
    expect(Object.keys(work.properties ?? {})).toEqual(["status", "artifacts", "notes"]);
    expect(work.required).toEqual(["status", "artifacts"]);
    const judge = schema.planeSchema("judge");
    expect(Object.keys(judge.properties ?? {})).toEqual(["findings", "artifacts", "notes"]);
    expect(judge.required).toEqual(["findings"]);
  });

  it("keeps the plane exclusives — status never rides judge, findings never ride work", () => {
    expect(schema.planeSchema("work").properties ?? {}).not.toHaveProperty("findings");
    expect(schema.planeSchema("judge").properties ?? {}).not.toHaveProperty("status");
  });
});

describe("projection ① — the injected writable-subset schema text", () => {
  it("renders the work plane — the carrier fence + the evidence-file fence", () => {
    const text = schema.schemaText("work", true);
    expect(text).toContain("```json");
    expect(text).toContain("Write the handoff draft at `OUTPUT_HANDOFF` per this writable subset");
    expect(text).toContain('"status"');
    expect(text).toContain('"artifacts"');
    expect(text).not.toContain('"commits"');
    expect(text).not.toContain('"changes"');
    expect(text).toContain("The evidence file");
    expect(text).toContain('"typecheck"');
    // the reserved engine fields are NOT writable by the child — the subset refuses them
    expect(JSON.parse(text.split("```json\n")[1]!.split("\n```")[0]!)).toMatchObject({
      type: "object",
      required: ["status", "artifacts"],
    });
  });

  it("renders the judge plane — findings only, no status, no evidence fence", () => {
    const text = schema.schemaText("judge", false);
    expect(text).toContain("```json");
    expect(text).toContain('"findings"');
    expect(text).not.toContain('"status"');
    expect(text).not.toContain("The evidence file");
    const json = JSON.parse(text.split("```json\n")[1]!.split("\n```")[0]!);
    expect(json).toMatchObject({ type: "object", required: ["findings"] });
  });

  it("is byte-stable per (plane, evidence) — the prompt's contract surface never shifts", () => {
    // the SAME plane renders identical text every dispatch (the prefix-tail cache fact)
    expect(schema.schemaText("work", true)).toBe(schema.schemaText("work", true));
    expect(schema.schemaText("judge", false)).toBe(schema.schemaText("judge", false));
    expect(schema.schemaText("work", true)).not.toBe(schema.schemaText("judge", false));
  });

  it("the fence parses byte-identically to the projected plane node — the one-hand projection pin (T3)", () => {
    // The prompt-injection projection (schemaText) and the read-back declaration
    // (planeSchema) are the SAME projected object's two readings: parses of the
    // ```` ```json ```` fences must round-trip to the projected nodes verbatim (the
    // projection IS the writable plane — zero engine-only metadata to strip) — the
    // prompt can never show a schema the engine does not enforce.
    for (const plane of ["work", "judge"] as const) {
      const text = schema.schemaText(plane, false);
      const parsed = JSON.parse(text.split("```json\n")[1]!.split("\n```")[0]!);
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(schema.planeSchema(plane)));
    }
  });

  it("the judge fence carries no status — the conclusion is derived, never a child-writable field (D27)", () => {
    // The judge carrier holds no status field: the projection IS the writable plane,
    // and the round conclusion derives at judgment time
    // (`conclusionOf("judge", carrier)` → rollup(findings)). The child-visible
    // fence therefore never surfaces a `"status"` slot on the judge plane.
    expect(schema.schemaText("judge", false)).not.toContain('"status"');
  });
});

describe("projection ② — the read-back validation (violations)", () => {
  it("accepts the canonical work draft and the canonical judge draft", () => {
    expect(schema.violations("work", WORK)).toEqual([]);
    expect(schema.violations("judge", FINDINGS)).toEqual([]);
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

  it("drops non-declared fields instead of BLOCKing (materialize judges the same way)", () => {
    // a work draft carrying engine-reserved or extra keys is dropped by materialize
    // and never refuses the draft (the drop-not-BLOCK ruling · §8.7)
    expect(
      schema.violations("work", { status: "APPROVED", artifacts: {}, phase: "implement" }),
    ).toEqual([]);
    expect(schema.violations("work", { status: "APPROVED", artifacts: {}, tasks: [1] })).toEqual(
      [],
    );
    // a residual findings payload on a docs-fix work draft is non-declared — dropped,
    // not refused (D62: the work plane carries no findings slot)
    expect(schema.violations("work", { status: "APPROVED", artifacts: {}, findings: [] })).toEqual(
      [],
    );
    // a stray `commits` key on a work draft is no longer declared — dropped
    expect(schema.violations("work", { ...WORK, commits: { base: "short" } })).toEqual([]);
  });

  it("refuses a judge draft with a missing findings array or a bad severity", () => {
    expect(schema.violations("judge", {})).toEqual(["findings: required"]);
    expect(schema.violations("judge", { findings: "nope" })).toEqual([
      "findings: expected an array",
    ]);
    expect(
      schema.violations("judge", {
        findings: [{ severity: "fatal", lens: "spec", summary: "x" }],
      }),
    ).toEqual(["findings[0].severity: must be one of blocker | warn | nit"]);
    expect(
      schema.violations("judge", {
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

  it("conclusionOf derives the judge conclusion from the findings, the work conclusion from the declared status (D27)", () => {
    // the judge plane NEVER reads a carrier status — its conclusion rolls up from
    // the findings alone (the persisted judge carrier holds no status field)
    expect(schema.conclusionOf("judge", { findings: [{ severity: "blocker" }] })).toBe(
      "CHANGES_REQUESTED",
    );
    expect(schema.conclusionOf("judge", { findings: [{ severity: "nit" }] })).toBe("REVIEW_FIX");
    expect(schema.conclusionOf("judge", { findings: [] })).toBe("APPROVED");
    expect(schema.conclusionOf("judge", {})).toBe("APPROVED");
    // a stray status on a judge carrier is ignored — the derivation is from findings
    expect(
      schema.conclusionOf("judge", { findings: [{ severity: "blocker" }], status: "APPROVED" }),
    ).toBe("CHANGES_REQUESTED");
    // the work plane reads its declared status verbatim
    expect(schema.conclusionOf("work", { status: "APPROVED", artifacts: {} })).toBe("APPROVED");
    expect(schema.conclusionOf("work", { status: "BLOCKED", artifacts: {} })).toBe("BLOCKED");
    // a PRESENT-but-invalid work status byte degrades to BLOCKED — a malformed
    // declaration is a failure signal, never silently approved
    expect(schema.conclusionOf("work", { status: "garbage", artifacts: {} })).toBe("BLOCKED");
    expect(schema.conclusionOf("work", { status: "CHANGES_REQUESTED", artifacts: {} })).toBe(
      "BLOCKED",
    );
    // an ABSENT status is NOT a failure declaration — undefined (no conclusion
    // declared), distinct from a declared BLOCKED. This is the legacy-carrier fact:
    // a work carrier predating the status field never reads as a fabricated failure
    // (the router treats undefined as "not failed"; BLOCKED as the failure face).
    expect(schema.conclusionOf("work", {})).toBeUndefined();
    expect(schema.conclusionOf("work", { artifacts: {} })).toBeUndefined();
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

describe("the derived carrier types — buildHandoff per-plane shaping", () => {
  it("the work carrier's runtime keys equal the work projection's declared properties set, zero findings", () => {
    const { ledger, cleanup } = ledgerFixture();
    try {
      const carrier = ledger.buildHandoff("work", { artifacts: { report: "/r" } });
      carrier.status = "APPROVED";
      carrier.notes = ["one note"];
      expect(Object.keys(carrier).sort()).toEqual(
        Object.keys(schema.planeSchema("work").properties ?? {}).sort(),
      );
      expect("findings" in carrier).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("the judge carrier carries the schema-required findings key", () => {
    const { ledger, cleanup } = ledgerFixture();
    try {
      const carrier = ledger.buildHandoff("judge", {
        findings: [{ severity: "blocker", lens: "spec", summary: "drift" }],
      });
      expect(Object.keys(carrier)).toContain("findings");
      expect(carrier.findings).toEqual([{ severity: "blocker", lens: "spec", summary: "drift" }]);
    } finally {
      cleanup();
    }
  });
});
