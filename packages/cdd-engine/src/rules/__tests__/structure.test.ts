// packages/cdd-engine/src/rules/__tests__/structure.test.ts — the StructureRule single-interpreter
// contract (P3.1 T1; design §2.1 — the unified engine boundary). The interpreter is the ONE
// structure-judgment face every migrated doc assertion consumes: a rule declares a judgment plane
// (headingLeads / tableRows / records — the leaf-plane classes) + an invariant bundle (the seven
// typed invariants: presence / uniqueness / domain / crosslink / order / continuity / residue) +
// a BLOCK|WARN severity, and `runStructureRules` emits one finding per failing rule carrying the
// rule's fixed message copy. This file pins the T1 contract surface:
//   - the interpreter decides all three plane kinds + all seven invariants, each factor with a
//     positive and a negative instance (the brief's checkable factors);
//   - the finding surface is exactly {id, severity, message} — severity maps from the rule, the
//     message passes through verbatim (zero runtime assembly);
//   - an empty rule set yields zero findings (the T1 no-behavior-change state);
//   - the DocBody rule-data seam defaults to [] on the abstract face AND on the two existing
//     concrete bodies (plan-body / phase-spec-body do not override at T1 — source-pinned);
//   - the body plane carries zero reverse-interpreter imports (the `rules/structure.ts` grep guard)
//     and the interpreter module itself is load-order-safe (zero runtime imports);
//   - DocumentsValidator.structureFindings resolves every registered doc kind's body rule set
//     (all [] at T1) and runs the interpreter through the facade.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SchemaShape } from "../../documents/doctype.ts";
import {
  DocBody,
  type SlicePatternSet,
  type StructureInvariant,
  type StructureRule,
} from "../../documents/doctypes/body/doc-body.ts";
import { phaseSpecBody } from "../../documents/doctypes/body/phase-spec-body.ts";
import { planBody } from "../../documents/doctypes/body/plan-body.ts";
import { DocumentsValidator } from "../documents.ts";
import { runStructureRules } from "../structure.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", ".."); // packages/cdd-engine/src — the source-plane root

function read(rel: string): string {
  return readFileSync(path.join(SRC, rel), "utf8");
}

/** A headingLeads-plane rule fixture — the interpreter's decidable instances read rule data as
 *  plain literals (the same shape the T2–T6 bodies will declare). */
function headingRule(
  id: string,
  anchor: string,
  invariants: readonly StructureInvariant[],
  severity: "BLOCK" | "WARN" = "BLOCK",
  message = `${id} demand unmet`,
): StructureRule {
  return { id, plane: { kind: "headingLeads", anchor }, invariants, severity, message };
}

/** A records-plane rule fixture — the task-record field-marker anchor family. */
function recordRule(
  id: string,
  anchor: string,
  invariants: readonly StructureInvariant[],
  severity: "BLOCK" | "WARN" = "BLOCK",
  message = `${id} demand unmet`,
): StructureRule {
  return { id, plane: { kind: "records", anchor }, invariants, severity, message };
}

describe("runStructureRules — the seven invariants, each decidable in both directions", () => {
  it("presence — the anchored heading must exist (a missing `## Design` is a finding; present → none)", () => {
    const rule = headingRule("spec.design", "^## Design\\s*$", [{ type: "presence" }]);
    const absent = ["## Constraints", "", "body text"].join("\n");
    const present = ["## Design", "", "body text"].join("\n");
    expect(runStructureRules(absent, [rule])).toHaveLength(1);
    expect(runStructureRules(present, [rule])).toHaveLength(0);
  });

  it("uniqueness — the anchored heading appears exactly once (a doubled `### Acceptance criteria` is a finding; a single one → none)", () => {
    const rule = headingRule("spec.acceptance", "^### Acceptance criteria\\s*$", [
      { type: "uniqueness" },
    ]);
    const doubled = [
      "## Design",
      "",
      "### Acceptance criteria",
      "",
      "### Acceptance criteria",
    ].join("\n");
    const single = ["## Design", "", "### Acceptance criteria"].join("\n");
    expect(runStructureRules(doubled, [rule])).toHaveLength(1);
    expect(runStructureRules(single, [rule])).toHaveLength(0);
  });

  it("domain — every record value matches the declared domain (an edge value `foo` is a finding; `none` / integer lists → none)", () => {
    const rule = recordRule("plan.edges", "^- \\*\\*DependsOn\\*\\*:\\s*(.*)$", [
      { type: "domain", valuePattern: "(?:none|\\s*|\\d+(?:\\s*,\\s*\\d+)*)" },
    ]);
    const illegal = ["- **DependsOn**: foo"].join("\n");
    const legal = ["- **DependsOn**: 1, 3", "- **DependsOn**: none"].join("\n");
    expect(runStructureRules(illegal, [rule])).toHaveLength(1);
    expect(runStructureRules(legal, [rule])).toHaveLength(0);
  });

  it("crosslink — every captured ref resolves under the target anchor (a dangling `P9` with no inventory row is a finding; a resolved `P1` → none)", () => {
    const rule = recordRule("overall.phaseRef", "^- \\*\\*Depends on:\\*\\* (P\\d+)", [
      { type: "crosslink", targetAnchor: "^\\| \\d+ \\| (P\\d+) \\|" },
    ]);
    const dangling = [
      "## Phase inventory",
      "",
      "| # | Phase | Scope |",
      "|---|---|---|",
      "| 1 | P1 | phase one |",
      "",
      "- **Depends on:** P9",
    ].join("\n");
    const resolved = [
      "## Phase inventory",
      "",
      "| # | Phase | Scope |",
      "|---|---|---|",
      "| 1 | P1 | phase one |",
      "",
      "- **Depends on:** P1",
    ].join("\n");
    expect(runStructureRules(dangling, [rule])).toHaveLength(1);
    expect(runStructureRules(resolved, [rule])).toHaveLength(0);
  });

  it("order — change-history versions ascend, version-aware (v1.2 before v1.1 is a finding; v1.1, v1.2, v1.10 ascending → none — a lexical compare would fail v1.10 < v1.2)", () => {
    const rule: StructureRule = {
      id: "overall.history",
      plane: { kind: "tableRows", anchor: "^\\| (Version|v\\d+(?:\\.\\d+)*) \\|" },
      invariants: [{ type: "order", compare: "version" }],
      severity: "BLOCK",
      message: "change history versions must ascend",
    };
    const inverted = [
      "## Change history",
      "",
      "| Version | date | summary |",
      "|---|---|---|",
      "| v1.2 | 2026-02-01 | second |",
      "| v1.1 | 2026-01-01 | first |",
    ].join("\n");
    const ascending = [
      "## Change history",
      "",
      "| Version | date | summary |",
      "|---|---|---|",
      "| v1.1 | 2026-01-01 | first |",
      "| v1.2 | 2026-02-01 | second |",
      "| v1.10 | 2026-03-01 | third |",
    ].join("\n");
    expect(runStructureRules(inverted, [rule])).toHaveLength(1);
    expect(runStructureRules(ascending, [rule])).toHaveLength(0);
  });

  it("order — the numeric default compare (an out-of-order step sequence is a finding; ascending → none)", () => {
    const rule = headingRule("plan.steps", "^### Step (\\d+):", [{ type: "order" }]);
    const desc = ["### Step 3:", "### Step 1:", "### Step 2:"].join("\n");
    const asc = ["### Step 1:", "### Step 2:", "### Step 3:"].join("\n");
    expect(runStructureRules(desc, [rule])).toHaveLength(1);
    expect(runStructureRules(asc, [rule])).toHaveLength(0);
  });

  it("continuity — the captured numbers run 1..N without gaps or duplicates (1,2,4 and 1,1,2 are findings; 1,2,3 → none)", () => {
    const rule = headingRule("plan.tasks", "^### Task (\\d+):", [{ type: "continuity" }]);
    const gapped = ["### Task 1:", "### Task 2:", "### Task 4:"].join("\n");
    const duped = ["### Task 1:", "### Task 1:", "### Task 2:"].join("\n");
    const ok = ["### Task 1:", "### Task 2:", "### Task 3:"].join("\n");
    expect(runStructureRules(gapped, [rule])).toHaveLength(1);
    expect(runStructureRules(duped, [rule])).toHaveLength(1);
    expect(runStructureRules(ok, [rule])).toHaveLength(0);
  });

  it("residue — the forbidden plane must be empty (a legacy `## Task Groups` hit is a finding; zero residue → none)", () => {
    const rule = headingRule("plan.legacy", "^## Task Groups\\s*$", [{ type: "residue" }]);
    const legacy = ["# Plan", "", "## Task Groups"].join("\n");
    const clean = ["# Plan", "", "## Constraints"].join("\n");
    expect(runStructureRules(legacy, [rule])).toHaveLength(1);
    expect(runStructureRules(clean, [rule])).toHaveLength(0);
  });
});

describe("the plane/anchor families (three decidable plane kinds)", () => {
  it("tableRows — the table anchor selects a real table (a change-history table with no header is a finding; a present table → none)", () => {
    const rule: StructureRule = {
      id: "overall.historyTable",
      plane: { kind: "tableRows", anchor: "^\\| (Version|v\\d+(?:\\.\\d+)*) \\|" },
      invariants: [{ type: "presence" }],
      severity: "BLOCK",
      message: "the change-history table must exist",
    };
    const withoutTable = ["## Change history", "", "(none)"].join("\n");
    const withTable = [
      "## Change history",
      "",
      "| Version | date | summary |",
      "|---|---|---|",
      "| v1.0 | 2026-01-01 | initial |",
    ].join("\n");
    // The separator row is a structural table face, never a data item — a table whose rows are
    // the header + separator + one data row still satisfies presence exactly once (so the row
    // extraction skips the `[---]` separator, mirroring the deviations-table scan).
    expect(runStructureRules(withoutTable, [rule])).toHaveLength(1);
    expect(runStructureRules(withTable, [rule])).toHaveLength(0);
  });

  it("the seven invariants are expressible as typed instances — the design §2.1 vocabulary, no wildcard DSL", () => {
    const instances: readonly StructureInvariant[] = [
      { type: "presence" },
      { type: "uniqueness" },
      { type: "domain", valuePattern: "(?:none|\\s*|\\d+(?:\\s*,\\s*\\d+)*)" },
      { type: "crosslink", targetAnchor: "^\\| \\d+ \\| (P\\d+) \\|" },
      { type: "order", compare: "version" },
      { type: "continuity" },
      { type: "residue" },
    ];
    expect(instances.map((i) => i.type)).toEqual([
      "presence",
      "uniqueness",
      "domain",
      "crosslink",
      "order",
      "continuity",
      "residue",
    ]);
  });
});

describe("the finding surface (severity + fixed message copy)", () => {
  it("severity maps from the rule — BLOCK and WARN rules emit findings at their declared severity", () => {
    const block = headingRule(
      "plan.legacy",
      "^## Task Groups\\s*$",
      [{ type: "residue" }],
      "BLOCK",
    );
    const warn = headingRule("plan.lint", "^## Task Groups\\s*$", [{ type: "residue" }], "WARN");
    const findings = runStructureRules("# Plan\n\n## Task Groups", [block, warn]);
    const byId = Object.fromEntries(findings.map((f) => [f.id, f.severity]));
    expect(byId).toEqual({ "plan.legacy": "BLOCK", "plan.lint": "WARN" });
  });

  it("the finding is exactly {id, severity, message} — the message is the rule's fixed copy, verbatim (zero runtime assembly)", () => {
    const rule = headingRule(
      "spec.design",
      "^## Design\\s*$",
      [{ type: "presence" }],
      "BLOCK",
      "the spec must carry a `## Design` section",
    );
    const findings = runStructureRules("## Constraints", [rule]);
    expect(findings).toEqual([
      {
        id: "spec.design",
        severity: "BLOCK",
        message: "the spec must carry a `## Design` section",
      },
    ]);
  });

  it("empty rule sets judge nothing — zero findings over any content (the T1 no-behavior-change state)", () => {
    expect(runStructureRules("## Design\n\n## Task Groups\n\n- **DependsOn**: foo", [])).toEqual(
      [],
    );
  });

  it("a rule carries zero invariants — the interpreter judges nothing and emits no finding", () => {
    const rule = headingRule("spec.none", "^## Design\\s*$", []);
    expect(runStructureRules("## Constraints", [rule])).toEqual([]);
  });
});

describe("the DocBody rule-data seam (T1 — abstract default in place, concrete bodies not yet overridden)", () => {
  const SHAPE: SchemaShape = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://oscaner.dev/schemas/cdd/stub-body.json",
    title: "Stub body structure",
    description: "stub body shape",
    type: "object",
    properties: {},
  };

  class StubDocBody extends DocBody {
    projectSchemaShape(): SchemaShape {
      return SHAPE;
    }

    projectSlicePatterns(): SlicePatternSet {
      return { headingRe: /^## Design$/m };
    }
  }

  it("the abstract base defaults the rule set to []", () => {
    const body = new StubDocBody({ kind: "plan", description: "stub body" });
    expect(body.structureRules()).toEqual([]);
  });

  it("the two existing concrete bodies inherit the default — no override at T1 (their rule sets land with T2+)", () => {
    expect(planBody.structureRules()).toEqual([]);
    expect(phaseSpecBody.structureRules()).toEqual([]);
  });

  it("source pin — plan-body.ts / phase-spec-body.ts carry no `structureRules` member yet", () => {
    expect(read("documents/doctypes/body/plan-body.ts")).not.toContain("structureRules");
    expect(read("documents/doctypes/body/phase-spec-body.ts")).not.toContain("structureRules");
  });

  it("grep guard — no body-plane module references the interpreter (zero reverse imports; the load-order law)", () => {
    const bodyDir = path.join(SRC, "documents/doctypes/body");
    const offenders = readdirSync(bodyDir).filter(
      (f) =>
        f.endsWith(".ts") &&
        /from ".*rules\/structure\.ts"/.test(readFileSync(path.join(bodyDir, f), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("load-order safety — the interpreter module carries zero runtime imports (every import is `import type`; the tokens.ts cycle stays unbroken)", () => {
    const valueImports = read("rules/structure.ts")
      .split("\n")
      .filter((l) => /^import /.test(l) && !/^import type/.test(l));
    expect(valueImports).toEqual([]);
  });
});

describe("DocumentsValidator.structureFindings — the docContractValidate hook seam", () => {
  const validator = new DocumentsValidator();

  it("resolves each registered doc kind to its body rule set and runs the interpreter — every set is [] at T1, so every kind yields zero findings", () => {
    // The content carries plan-shaped and spec-shaped structure that WOULD fail rules if any were
    // declared (`## Task Groups` residue, `- **DependsOn**: foo` domain) — the empty-body seam is
    // the T1 guarantee: zero findings, the tree-migration/dual-read suite stays byte-identical.
    const content = [
      "## Design",
      "",
      "### Acceptance criteria",
      "",
      "## Task Groups",
      "",
      "- **DependsOn**: foo",
    ].join("\n");
    for (const kind of ["overall", "plan", "spec"] as const) {
      expect(validator.structureFindings(kind, content)).toEqual([]);
    }
  });

  it("source pin — the dispatch doc-contract gate consumes the plane: closeout.ts wires structureFindings into the single inference and base.ts judges result.structure by severity", () => {
    // The brief's step-3 checkable requires the doc-contract gate to invoke runStructureRules for
    // the resolved doc type — a production-call fact, not a facade availability. The carrier must
    // call the interpreter and the gate must read the plane (both empty at T1, behavior-neutral).
    const closeout = read("rules/closeout.ts");
    expect(closeout).toMatch(/structureFindings\(/);
    expect(closeout).toMatch(/detectDocKind\(options\.entry\)/);
    expect(closeout).toMatch(/structure: StructureFinding\[\]/);
    const gate = read("dispatch/base.ts");
    expect(gate).toMatch(/result\.structure\.filter\(/);
    expect(gate).toMatch(/f\.severity === "BLOCK"/);
  });
});
