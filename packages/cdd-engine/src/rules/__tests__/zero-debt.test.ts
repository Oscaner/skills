// packages/cdd-engine/src/rules/__tests__/zero-debt.test.ts — P2 T6 (2): the AC7 zero-debt assertion
// aggregation. Every item of the phase's zero-debt assertions (overall AC7) is mechanically asserted
// here in ONE colocated block — source-grep facts + unit behavior — so the closeout of the phase is
// reproducible from a single test file:
//
//   (1) no plan-only leftover (grep) — the reverse-direction missing-claim rule (shipped plan column
//       ⇒ a matching change-history claim) is a member of the SINGLE audit entry and fires exactly
//       once; the design column's backfill is audited on the same bidirectional rule (nothing
//       backfill is plan-only).
//   (2) closeout inference has no second implementation — deriveCloseoutMismatches
//       (rules/closeout.ts) is the single inference module: the two base hooks (pre-flight
//       docContractValidate gate / post-flight statusValidate highlight) both consume it; no channel
//       or rules module re-implements the computation.
//   (3) no exemption exception constants — the docs-lane terminal-debt no-op is an absent-source
//       semantic (dispatchPlanPath() → null), never an exemption constant: the mismatch seam carries
//       no lane parameter, and no EXEMPT-style constant token exists in the rules/dispatch layer.
//   (4) handoff schema has no dual core block (single source) — the task/docs handoff schemas share
//       one machine core (status enum / failure_category / commits / blocker / shared list fields
//       deep-equal after the description prose is stripped); the only allowed divergences are the
//       lane boundary objects.
//   (5) base default override takes effect on all channels — docContractValidate / statusValidate
//       have NO lane override in task/docs/branch (the base default is the single implementation for
//       all three channels) and both are template steps of the run() walk every channel inherits.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { CloseoutChecker } from "../closeout.ts";

const closeoutChecker = new CloseoutChecker();

import { DocumentsValidator } from "../documents.ts";

const documentsValidator = new DocumentsValidator();

import { HandoffSchemaValidator } from "../schema.ts";

const schemaValidator = new HandoffSchemaValidator();

import {
  mkProgramRepo,
  OVERALL_CLEAN,
  writeCompletePlanWorkspace,
  writeProgramDocs,
} from "./closeout-fixtures.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", ".."); // packages/cdd-engine/src

function readSrc(rel: string): string {
  return readFileSync(path.join(SRC, rel), "utf8");
}

/** Strip full-line `//` comments and `/* … *​/` blocks — code-fact greps must never trip on prose. */
function codeOnly(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("AC7 (1) no plan-only leftover — the reverse-direction rule is a single audit member; backfill is never plan-only", () => {
  it("shipped plan column without a matching claim → EXACTLY ONE missing-claim failure (single audit member)", () => {
    const repo = mkProgramRepo();
    const c = writeProgramDocs(
      repo,
      OVERALL_CLEAN.replace(
        "| P1 | phase one | [Pending] | [Pending] | | none |",
        "| P1 | phase one | [Pending] | Done | | none |",
      ),
    );
    const f = documentsValidator.validateDispatchDocuments({ entry: c.plan1, root: c.repo });
    const missingClaim = f.filter(
      (x) =>
        x.artifact === "overall" &&
        x.field === "backfill claim" &&
        /no matching plan claim/i.test(x.missing),
    );
    expect(missingClaim).toHaveLength(1); // one missing-claim member — no dual or partial variant
    expect(f).toHaveLength(1); // the rest of the chain is clean — nothing else fires on this fixture
  });

  it("design backfill is audited on the SAME rule (forward: claim ⇒ column token) — not plan-only", () => {
    const repo = mkProgramRepo();
    const c = writeProgramDocs(
      repo,
      OVERALL_CLEAN.concat(
        "\n",
        "| v1.1 | 2026-09-21 | P2 Design-spec 列回填（[Pending]→p2-design v1.0） |",
      ),
    );
    const f = documentsValidator.validateDispatchDocuments({ entry: c.plan1, root: c.repo });
    // the claim demands p2-design in P2's Design spec cell, which is still [Pending] — the
    // backfill-claim member class carries the design-forward mismatch (the design column is audited
    // on the same bidirectional rule; nothing backfill is plan-only)
    const backfill = f.filter(
      (x) =>
        x.artifact === "overall" && x.field === "backfill claim" && /Design spec/.test(x.missing),
    );
    expect(backfill.length).toBeGreaterThanOrEqual(1);
  });

  it("shipped design column (own P<n>-design token) without a matching design claim → EXACTLY ONE missing-claim failure (reverse-design on the same member)", () => {
    // Reverse direction of the same bidirectional member: a SHIPPED design column (own P<n>-design
    // token) demands a matching design claim — the fixture gives P1 a p1-design token in its Design
    // spec column while the change history carries no Design-spec clause for it (backfill is never
    // plan-only; a design-complete column without a claim is the closeout-debt class the phase gates).
    const repo = mkProgramRepo();
    const c = writeProgramDocs(
      repo,
      OVERALL_CLEAN.replace(
        "| P1 | phase one | [Pending] | [Pending] | | none |",
        "| P1 | phase one | [p1-design v1.0](2026-01-01-demo-p1-design.md) | [Pending] | | none |",
      ),
    );
    const f = documentsValidator.validateDispatchDocuments({ entry: c.plan1, root: c.repo });
    const missingClaim = f.filter(
      (x) =>
        x.artifact === "overall" &&
        x.field === "backfill claim" &&
        /no matching design claim/i.test(x.missing),
    );
    expect(missingClaim).toHaveLength(1); // one reverse-design member — no dual or partial variant
    expect(f).toHaveLength(1); // the rest of the chain is clean — nothing else fires on this fixture
  });

  it("grep: the missing-claim surface text lives once, in the single audit entry (rules/documents.ts)", () => {
    const docs = readSrc("rules/documents.ts");
    expect(docs.match(/no matching plan claim/g)).toHaveLength(1);
    expect(docs.match(/no matching design claim/g)).toHaveLength(1);
    // no other rules/dispatch module carries a second (plan-only) implementation of either phrase
    expect(codeOnly(readSrc("rules/closeout.ts"))).not.toMatch(
      /matching plan claim|matching design claim/,
    );
    expect(codeOnly(readSrc("dispatch/base.ts"))).not.toMatch(
      /matching plan claim|matching design claim/,
    );
  });
});

describe("AC7 (2) single inference module — one inference for the two base hooks", () => {
  it("grep: the inference is defined in rules/closeout.ts only; base.ts consumes it twice (pre-flight + post-flight), channels never", () => {
    const closeout = readSrc("rules/closeout.ts");
    expect(closeout).toMatch(/deriveTerminalDebt\(overallPath: string, root: string\)/);
    expect(closeout).toMatch(
      /deriveCloseoutMismatches\(options: \{ entry: string; root: string \}\)/,
    );
    const base = codeOnly(readSrc("dispatch/base.ts"));
    // two CALL SITES (the import line carries the name without a call paren)
    expect(base.match(/deriveCloseoutMismatches\(/g)).toHaveLength(2); // docContractValidate gate + statusValidate highlight
    for (const channel of ["task", "docs", "branch"]) {
      expect(codeOnly(readSrc(`dispatch/${channel}.ts`))).not.toMatch(
        /deriveCloseoutMismatches|deriveTerminalDebt/,
      );
    }
  });

  it("behavior: ONE CloseoutResult carries both surfaces — the single carrier the two hooks key off", () => {
    const repo = mkProgramRepo();
    const c = writeProgramDocs(repo, OVERALL_CLEAN); // unbackfilled chain
    writeCompletePlanWorkspace(repo, c.plan1); // P1 engine-terminal state: plan complete
    const r = closeoutChecker.deriveCloseoutMismatches({ entry: c.plan1, root: c.repo });
    expect(r.structural).toEqual([]); // the chain's tables are structurally legal
    expect(r.terminalDebt.map((m) => m.kind)).toEqual(["plan-complete-unbackfilled"]);
    expect(r.overallPath).toBe(c.overall);
  });
});

describe("AC7 (3) no exemption constants — the lane boundary is temporal derivation, never a skip literal", () => {
  it("grep: the mismatch seam carries no lane parameter and no lane string literal", () => {
    const closeout = readSrc("rules/closeout.ts");
    // the two inference seams admit only {entry, root} — a per-lane exemption cannot even be expressed here
    expect(closeout).toMatch(/deriveTerminalDebt\(overallPath: string, root: string\)/);
    expect(closeout).toMatch(
      /deriveCloseoutMismatches\(options: \{ entry: string; root: string \}\)/,
    );
    // the inference CODE holds no phase/lane id literals (comments are prose and exempt from the grep)
    expect(codeOnly(closeout)).not.toMatch(/["'](?:task|docs|branch)["']/);
  });

  it("grep: no EXEMPT-style constant token in the closeout/rules + dispatch layer", () => {
    for (const rel of [
      "rules/closeout.ts",
      "rules/documents.ts",
      "dispatch/base.ts",
      "dispatch/task.ts",
      "dispatch/docs.ts",
      "dispatch/branch.ts",
    ]) {
      expect(codeOnly(readSrc(rel))).not.toMatch(/\b\w*[Ee]xempt\w*\s*=/);
    }
  });

  it("grep: the docs-lane no-op derives from the absent plan workspace (dispatchPlanPath() → null), not a skip list", () => {
    const base = codeOnly(readSrc("dispatch/base.ts"));
    // the terminal-debt activation is absence-derived: plan-bearing rounds only, plan-less no-ops
    expect(base).toMatch(/dispatchPlanPath\(\) !== null && result\.terminalDebt\.length > 0/);
    // and the CloseoutMismatch carrier defines no lane/channel/branch dimension to exempt
    const body = /interface CloseoutMismatch \{([\s\S]*?)\}/.exec(readSrc("rules/closeout.ts"))![1];
    expect(codeOnly(body)).not.toMatch(/lane|channel|branch/);
  });
});

describe("AC7 (4) no dual core block — task/docs share one machine core (single source)", () => {
  // The schemas' descriptions carry lane prose (the changelog/breaking notes differ) — the machine
  // contract is the shape/enum/pattern surface, so the comparison strips description prose.
  function stripDescriptions(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(stripDescriptions);
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (k === "description") continue;
        out[k] = stripDescriptions(val);
      }
      return out;
    }
    return v;
  }

  // Every property both schemas declare must deep-equal modulo descriptions — status / failure
  // category / commits / blocker / recovery / the shared list fields. Lane differences may ONLY be
  // the boundary objects (task=task number; docs=doc_path/doc_hash/round).
  it("shared properties deep-equal across the task/docs core", () => {
    const taskProps = (
      schemaValidator.loadHandoffSchema("task") as { properties: Record<string, unknown> }
    ).properties;
    const docsProps = (
      schemaValidator.loadHandoffSchema("docs") as { properties: Record<string, unknown> }
    ).properties;
    const shared = Object.keys(taskProps).filter((k) => Object.hasOwn(docsProps, k));
    // `phase` is excluded from the core-equality: its enums are a lane AMOUNT (task runs
    // implement/review/fix/branch-review, docs only review/fix) — the core fields below are the
    // unified contract the two families must not drift apart on. `findings` likewise carries a lane
    // AMOUNT since P4.3: the task family adds the per-task section items schema (findings[].task —
    // the grouped review's section attribution), docs keeps the bare array. The core fields below
    // are the unified contract the two families must not drift apart on.
    const core = shared.filter((k) => k !== "phase" && k !== "findings");
    expect(core.length).toBeGreaterThan(5); // a real shared core, not an accident of key naming
    for (const name of core) {
      expect(stripDescriptions(docsProps[name])).toEqual(stripDescriptions(taskProps[name]));
    }
  });

  it("the only allowed divergences are the lane boundary objects", () => {
    const taskProps = Object.keys(
      (schemaValidator.loadHandoffSchema("task") as { properties: Record<string, unknown> })
        .properties,
    );
    const docsProps = Object.keys(
      (schemaValidator.loadHandoffSchema("docs") as { properties: Record<string, unknown> })
        .properties,
    );
    const taskOnly = taskProps.filter((k) => !docsProps.includes(k)).sort();
    const docsOnly = docsProps.filter((k) => !taskProps.includes(k)).sort();
    // task-lane boundaries: the P4.3 single-data-model group reference (tasks — the carrier's sole
    // task identity) + the per-task findings-section items (findings is a shared name, spelled
    // lane-differently — see the core test)
    expect(taskOnly).toEqual(["complexity", "notes", "review_scope", "tasks", "test_evidence"]);
    expect(docsOnly).toEqual(["doc_hash", "doc_path", "round"]);
    // the docs phase enum is a restriction of the task family's (review/fix shared; implement /
    // branch-review are task-only) — the shared status enum carries the unified core
    const taskPhase = (
      schemaValidator.loadHandoffSchema("task") as { properties: { phase: { enum: string[] } } }
    ).properties.phase.enum;
    const docsPhase = (
      schemaValidator.loadHandoffSchema("docs") as { properties: { phase: { enum: string[] } } }
    ).properties.phase.enum;
    expect(taskPhase).toEqual(["implement", "review", "fix", "branch-review"]);
    expect(docsPhase).toEqual(["review", "fix"]);
    expect(docsPhase.every((p) => taskPhase.includes(p))).toBe(true);
    const taskStatus = (
      schemaValidator.loadHandoffSchema("task") as { properties: { status: { enum: string[] } } }
    ).properties.status.enum;
    const docsStatus = (
      schemaValidator.loadHandoffSchema("docs") as { properties: { status: { enum: string[] } } }
    ).properties.status.enum;
    expect(docsStatus).toEqual(taskStatus); // docs gains TIMEOUT — same enum as task (the unified core)
  });
});

describe("AC7 (5) base-default override on all channels — docContractValidate / statusValidate are base defaults, no lane override", () => {
  it("grep: no channel overrides the two base hooks (single implementation for task/docs/branch)", () => {
    for (const channel of ["task", "docs", "branch"]) {
      const code = codeOnly(readSrc(`dispatch/${channel}.ts`));
      expect(code).not.toMatch(/override\s+docContractValidate|override\s+statusValidate/);
      // the channels DO override the lane-declared seams — the audit target / plan path the base walks
      expect(code).toMatch(/override\s+docAuditTarget|override\s+dispatchPlanPath/);
    }
  });

  it("grep: both hooks are overridable base defaults AND template steps of the run() walk every channel inherits", () => {
    const base = readSrc("dispatch/base.ts");
    expect(base).toMatch(/protected async docContractValidate/);
    expect(base).toMatch(/protected async statusValidate/);
    expect(base).toMatch(/this\.#step\("docContractValidate"\)/);
    expect(base).toMatch(/this\.#step\("statusValidate"\)/);
  });

  it("the per-hook three-channel acceptance surfaces (Task 3/4 acceptance) exist in the channel suites", () => {
    for (const rel of [
      "dispatch/__tests__/doc-contract-channels.test.ts",
      "dispatch/__tests__/closeout-channels.test.ts",
    ]) {
      expect(readSrc(rel).length).toBeGreaterThan(0); // the file exists and is non-empty
    }
  });
});
