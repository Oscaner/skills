// packages/cdd-engine/src/rules/__tests__/structure.test.ts — the StructureRule single-interpreter
// contract (P3.1 T1; design §2.1 — the unified engine boundary). The interpreter is the ONE
// structure-judgment face every migrated doc assertion consumes: a rule declares a judgment plane
// (headingLeads / tableRows / records — the leaf-plane classes) + an invariant bundle (the typed
// invariants: presence / uniqueness / domain / crosslink / order / continuity / residue /
// selfBounded / hollow) +
// a BLOCK|WARN severity, and `runStructureRules` emits one finding per failing rule carrying the
// rule's fixed message copy. This file pins the T1 contract surface:
//   - the interpreter decides all three plane kinds + every invariant, each factor with a
//     positive and a negative instance (the brief's checkable factors);
//   - the finding surface is exactly {id, severity, message} — severity maps from the rule, the
//     message passes through verbatim (zero runtime assembly); the reference-lint observation face
//     (P3.1 T6) emits one finding per offending run (the per-block aggregation);
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
import { overallBody } from "../../documents/doctypes/body/overall-body.ts";
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

describe("runStructureRules — the invariant vocabulary, each decidable in both directions", () => {
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

  it("hollow — an anchored heading must own a body: a blank-only run to the next heading is a finding, a content line satisfies it (the P3.1 T4 empty-body / hollow-leaf face)", () => {
    const rule = headingRule("spec.itemHollow", "^#### (\\d+)\\.\\d+ ", [{ type: "hollow" }]);
    const hollow = ["#### 2.1 Empty", "", "#### 2.2 Next"].join("\n");
    const bounded = ["#### 2.1 Empty", "", "## Constraints"].join("\n");
    const withBody = ["#### 2.1 Item", "", "the item's substance"].join("\n");
    expect(runStructureRules(hollow, [rule])).toHaveLength(1);
    expect(runStructureRules(bounded, [rule])).toHaveLength(1);
    expect(runStructureRules(withBody, [rule])).toHaveLength(0);
  });

  it("hollow children — a child-item line satisfies the anchored heading before the heading boundary closes it (a `### N.` group whose first content is a `#### N.M` item is not hollow; a group closing at a higher heading with no item is a finding)", () => {
    const rule = headingRule("spec.groupHollow", "^### (\\d+)\\. ", [
      { type: "hollow", children: "^#### (\\d+)\\.\\d+ " },
    ]);
    const withChild = ["### 2. Group", "", "#### 2.1 Item"].join("\n");
    const emptyGroup = ["### 2. Group", "", "## Constraints"].join("\n");
    expect(runStructureRules(withChild, [rule])).toHaveLength(0);
    expect(runStructureRules(emptyGroup, [rule])).toHaveLength(1);
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

  it("within — a section-scoped records rule judges anchored lines only INSIDE a run opened by the within-anchor (a numbered line in the Steps block fires; the same line in prose / a later code fence does not — the P3.1 T2 section-scoped plane)", () => {
    const rule: StructureRule = {
      id: "plan.checkableScoped",
      plane: {
        kind: "records",
        anchor: "^\\s*\\d+\\.\\s+(.*)$",
        within: "^\\s*-\\s+\\*\\*Steps\\*\\*:\\s*$",
      },
      invariants: [{ type: "domain", valuePattern: ".*—\\s*checkable:\\s*.+" }],
      severity: "BLOCK",
      message: "every steps entry must end with a checkable",
    };
    // A checkable-less numbered line INSIDE the `- **Steps**:` run → the item is judged → finding.
    const scopedTarget = [
      "- **Steps**:",
      "  1. implement bare",
      "- **Acceptance**:",
      "  - done",
    ].join("\n");
    // The SAME line before any run opens (prose) or after the run closed (a code fence) is never an
    // item — the checkable demand is scoped to the steps run exactly.
    const proseTarget = [
      "1. a numbered prose line before any Steps field",
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "",
      "```",
      "1. a numbered line in a later code fence",
      "```",
    ].join("\n");
    expect(runStructureRules(scopedTarget, [rule])).toHaveLength(1);
    expect(runStructureRules(proseTarget, [rule])).toHaveLength(0);
  });

  it("crosslink targetWithin — the target scan scopes to a `##`-section run, so a same-form target row outside the section never resolves a ref (a graph token present only as an Issue-inventory row stays dangling — the P3.1 T2 fix)", () => {
    const rule: StructureRule = {
      id: "overall.graphScoped",
      // The graph-edge TARGET token (the `overall.graphTarget` face — the dangling edge's target).
      plane: { kind: "records", anchor: "^\\s*P\\d+(?:\\.\\d+)*\\s*->\\s*(P\\d+(?:\\.\\d+)*)" },
      invariants: [
        {
          type: "crosslink",
          targetAnchor: "^\\|\\s*(P\\d+(?:\\.\\d+)*)\\s*\\|",
          targetWithin: "^## Phase inventory\\s*$",
        },
      ],
      severity: "BLOCK",
      message: "the dependency graph references a phase outside the Phase inventory",
    };
    // The dangling edge target appears ONLY as an Issue-inventory row (BEFORE the Phase-inventory
    // section) — the unscoped target would self-resolve the dangling graph token; the
    // section-scoped target keeps membership to the Phase-inventory ids (the retired `idsLower`
    // set) → the finding fires.
    const maskedByIssueRow = [
      "## Issue inventory",
      "",
      "| Phase | Issue (ref) | Title summary |",
      "|---|---|---|",
      "| P9 | none | issue one |",
      "",
      "## Phase inventory",
      "",
      "| # | Phase | Scope |",
      "|---|---|---|",
      "| P1 | phase one |",
      "",
      "## Dependency graph",
      "",
      "```",
      "P1 -> P9",
      "```",
    ].join("\n");
    expect(runStructureRules(maskedByIssueRow, [rule])).toHaveLength(1);
    // The contrast — the SAME content judged by the unscoped crosslink (no targetWithin) resolves
    // P9 against the Issue-inventory row and stays silent: exactly the mask the fix closes.
    const unscoped: StructureRule = {
      ...rule,
      invariants: [{ type: "crosslink", targetAnchor: "^\\|\\s*(P\\d+(?:\\.\\d+)*)\\s*\\|" }],
    };
    expect(runStructureRules(maskedByIssueRow, [unscoped])).toHaveLength(0);
    // A token registered INSIDE the Phase-inventory section resolves under the scoped target → none.
    const resolved = [
      "## Phase inventory",
      "",
      "| # | Phase | Scope |",
      "|---|---|---|",
      "| P1 | phase one |",
      "| P2 | phase two |",
      "",
      "## Dependency graph",
      "",
      "```",
      "P1 -> P2",
      "```",
    ].join("\n");
    expect(runStructureRules(resolved, [rule])).toHaveLength(0);
  });

  it("presence perRun — every heading-opened within-run carries at least one anchored item (a field-less empty `### Task N:` block fires; populated sequential blocks pass — the P3.1 T2 orphan-task-block face)", () => {
    const rule: StructureRule = {
      id: "plan.recordData",
      plane: {
        kind: "records",
        anchor: "^- \\*\\*(?:Objective|Steps|Acceptance)\\*\\*:",
        within: "^### Task \\d+:",
      },
      invariants: [{ type: "presence", perRun: true }],
      severity: "BLOCK",
      message: "a task block must carry data-shaped fields",
    };
    // The first block carries no data-shaped fields at all (its run closes with zero items) — per-run
    // presence fires even though the second block (a sequential heading-run of its own) is
    // populated.
    const withEmptyBlock = [
      "### Task 1:",
      "body prose only",
      "### Task 2:",
      "- **Objective**: a",
      "- **Acceptance**:",
      "  - done",
    ].join("\n");
    expect(runStructureRules(withEmptyBlock, [rule])).toHaveLength(1);
    // Sequential blocks whose runs all carry at least one data-shaped field → no finding (the
    // field-marker lines are items inside the heading-run, never closers).
    const populated = [
      "### Task 1:",
      "- **Objective**: a",
      "- **Acceptance**:",
      "  - done",
      "### Task 2:",
      "- **Steps**:",
      "  1. act — checkable: ok",
    ].join("\n");
    expect(runStructureRules(populated, [rule])).toHaveLength(0);
  });

  it("the invariant vocabulary is expressible as typed instances — the design §2.1 vocabulary (grown at P3.1 T3 selfBounded / T4 hollow), no wildcard DSL", () => {
    const instances: readonly StructureInvariant[] = [
      { type: "presence" },
      { type: "uniqueness" },
      { type: "domain", valuePattern: "(?:none|\\s*|\\d+(?:\\s*,\\s*\\d+)*)" },
      { type: "crosslink", targetAnchor: "^\\| \\d+ \\| (P\\d+) \\|" },
      { type: "order", compare: "version" },
      { type: "continuity" },
      { type: "residue" },
      { type: "selfBounded" },
      { type: "hollow", children: "^#### (\\d+)\\.\\d+ " },
      { type: "referenceLint" },
    ];
    expect(instances.map((i) => i.type)).toEqual([
      "presence",
      "uniqueness",
      "domain",
      "crosslink",
      "order",
      "continuity",
      "residue",
      "selfBounded",
      "hollow",
      "referenceLint",
    ]);
  });

  it("referenceLint — the WARN observation face: a backward reference absent from the run's declared edge set is observed ONCE; forward / spec-item / code-span refs stay silent (P3.1 T6)", () => {
    const rule: StructureRule = {
      id: "plan.referenceLint",
      plane: {
        kind: "records",
        anchor:
          "^- \\*\\*Objective\\*\\*:.*$|^- \\*\\*Acceptance\\*\\*:.*$|^\\s+[-*]\\s+(?!\\d+\\.).*$",
        within: "^### Task (\\d+):", // the run opener captures the block's own number (the backward bound)
        declaredReferences: "^- \\*\\*DependsOn\\*\\*:[ \\t]*(.*)$",
        // The scan surface — the interpreter's item classification reads THIS data (the markers to
        // scan + the acceptance-owned bullet family), never a re-typed field name.
        referenceSurface: {
          markers: ["^- \\*\\*Objective\\*\\*:[ \\t]*", "^- \\*\\*Acceptance\\*\\*:[ \\t]*"],
          bulletOwners: ["^- \\*\\*Acceptance\\*\\*:[ \\t]*"],
        },
      },
      invariants: [{ type: "referenceLint" }],
      severity: "WARN",
      message: "suspected missing edge",
    };
    const blocks = (...lines: string[]) => lines.join("\n");
    // The suspicious face — a backward citation of `Task 1` inside Task 2's objective, with no
    // declared edge, fires the missing-edge suspicion exactly once (the per-block aggregation).
    const suspicious = blocks(
      "### Task 1: a",
      "- **Objective**: task one",
      "- **DependsOn**: none",
      "- **Acceptance**:",
      "  - done",
      "",
      "### Task 2: b",
      "- **Objective**: extends Task 1 and Task 1 again",
      "- **DependsOn**: none",
      "- **Acceptance**:",
      "  - done",
      "",
    );
    expect(runStructureRules(suspicious, [rule])).toEqual([
      { id: "plan.referenceLint", severity: "WARN", message: "suspected missing edge" },
    ]);
    // The silent face — a forward ref (`Task 5` ≥ the block's own number), a spec-item word form
    // (`T1.1`), and a code-span citation (`` `T1` ``) are each structurally exempt.
    const silent = blocks(
      "### Task 1: a",
      "- **Objective**: task one",
      "- **DependsOn**: none",
      "- **Acceptance**:",
      "  - done",
      "",
      "### Task 2: b",
      "- **Objective**: sees the `T1` seam, Task 5 and T1.1",
      "- **DependsOn**: none",
      "- **Acceptance**:",
      "  - done",
      "",
    );
    expect(runStructureRules(silent, [rule])).toEqual([]);
  });

  it("referenceLint without a declared referenceSurface — the observation face judges nothing (documented vacuity over a surface-less plane; the field vocabulary is the plane's data, never an interpreter default)", () => {
    const surfaceLess: StructureRule = {
      id: "plan.referenceLint",
      plane: {
        kind: "records",
        anchor:
          "^- \\*\\*Objective\\*\\*:.*$|^- \\*\\*Acceptance\\*\\*:.*$|^\\s+[-*]\\s+(?!\\d+\\.).*$",
        within: "^### Task (\\d+):",
        declaredReferences: "^- \\*\\*DependsOn\\*\\*:[ \\t]*(.*)$",
      },
      invariants: [{ type: "referenceLint" }],
      severity: "WARN",
      message: "suspected missing edge",
    };
    const suspicious = [
      "### Task 1: a",
      "- **Objective**: task one",
      "- **DependsOn**: none",
      "- **Acceptance**:",
      "  - done",
      "",
      "### Task 2: b",
      "- **Objective**: extends Task 1",
      "- **DependsOn**: none",
      "- **Acceptance**:",
      "  - done",
      "",
    ].join("\n");
    expect(runStructureRules(suspicious, [surfaceLess])).toEqual([]);
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

describe("the DocBody rule-data seam (T1 — abstract default; T2 — the concrete rule sets landed)", () => {
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

  it("the three concrete bodies carry their rule sets — the plan/spec/overall migrations landed (rule identities per type, the unilateral edge faces included)", () => {
    expect(planBody.structureRules().map((r) => r.id)).toEqual([
      "plan.tasks",
      "plan.recordData",
      "plan.checkable",
      // The unilateral edge faces: the per-block edge completeness (missing-edge sixth class) + the
      // anti-dependency gate (selfBounded run-context invariant) + the reference lint (P3.1 T6 —
      // the WARN observation face, at most one WARN per offending block).
      "plan.edge",
      "plan.antiDependency",
      "plan.referenceLint",
      "plan.constraints",
      "plan.legacySections",
      "plan.placeholders",
    ]);
    expect(phaseSpecBody.structureRules().map((r) => r.id)).toEqual([
      "spec.design",
      "spec.acceptance",
      "spec.constraints",
      "spec.designGroups",
      "spec.designItemOwnership",
      "spec.designBodyEmpty",
      "spec.designGroupEmpty",
      "spec.designItemHollow",
      "spec.pseudoHeading",
    ]);
    expect(overallBody.structureRules().map((r) => r.id)).toEqual([
      "overall.inventoryHeader",
      "overall.canonicalColumn",
      "overall.historyVersion",
      "overall.historyOrder",
      "overall.historyDate",
      "overall.graph",
      "overall.graphTarget",
      "overall.charterGoal",
      "overall.charterNonGoals",
      "overall.charterCrossCutting",
      "overall.charterBoldFlat",
      "overall.pseudoHeading",
    ]);
    // every rule's invariant bundle is non-empty (a zero-demand rule judges nothing).
    for (const body of [planBody, phaseSpecBody, overallBody]) {
      for (const rule of body.structureRules()) expect(rule.invariants.length).toBeGreaterThan(0);
    }
  });

  it("source pin — the three body leaves carry the `structureRules` member (the rule-data seam)", () => {
    expect(read("documents/doctypes/body/plan-body.ts")).toContain("structureRules()");
    expect(read("documents/doctypes/body/phase-spec-body.ts")).toContain("structureRules()");
    expect(read("documents/doctypes/body/overall-body.ts")).toContain("structureRules()");
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

  it("resolves each registered doc kind to its body rule set and runs the interpreter — the T2 rule sets fire on violating content, and a conformant doc stays zero", () => {
    // The content carries plan-shaped and spec-shaped structure that FAILS the T2 rule sets
    // (a legacy `## Task Groups` section, a `- **DependsOn**: foo` record, a missing `## Design`
    // skeleton member, a `## Task Groups` residue surface) — the body rule seam is the live
    // judgmental plane, not the T1 empty state.
    const content = [
      "## Design",
      "",
      "the design body's testable increment (a non-shell `## Design` — the P3.1 T4 empty-body face)",
      "",
      "### Acceptance criteria",
      "",
      "## Constraints",
      "",
      "## Task Groups",
      "",
      "- **DependsOn**: foo",
    ].join("\n");
    const planFindings = validator.structureFindings("plan", content);
    expect(planFindings.map((f) => f.id)).toContain("plan.legacySections");
    const specFindings = validator.structureFindings("spec", content);
    expect(specFindings).toEqual([]); // the spec skeleton members are present
    // the overall kernel rules fire on the header-less content (no four-table surface present).
    const overallFindings = validator.structureFindings("overall", content);
    expect(overallFindings.map((f) => f.id)).toContain("overall.inventoryHeader");
  });

  it("`pseudo-heading-overall.md` fires overall.pseudoHeading — an independent bold pseudo-heading survives in the charter (BLOCK residue)", () => {
    // The T5 step-4 negative fixture wired through the same docContractValidate seam the phase-spec
    // side uses: `validator.structureFindings` resolves the overall body's rule set and runs the
    // interpreter, mirroring the pseudo-heading-design single-axis assertion.
    const ids = validator
      .structureFindings(
        "overall",
        read("documents/doctypes/body/__tests__/fixtures/pseudo-heading-overall.md"),
      )
      .map((f) => f.id);
    expect(ids).toContain("overall.pseudoHeading");
    expect(ids.every((id) => id === "overall.pseudoHeading")).toBe(true); // single-axis
  });

  it("source pin — the dispatch doc-contract gate consumes the plane: closeout.ts wires structureFindings into the single inference and base.ts judges result.structure by severity", () => {
    // The brief's step-3 checkable requires the doc-contract gate to invoke runStructureRules for
    // the resolved doc type — a production-call fact, not a facade availability. The carrier must
    // call the interpreter and the gate must read the plane.
    const closeout = read("rules/closeout.ts");
    expect(closeout).toMatch(/structureFindings\(/);
    expect(closeout).toMatch(/detectDocKind\(options\.entry\)/);
    expect(closeout).toMatch(/structure: StructureFinding\[\]/);
    const gate = read("dispatch/base.ts");
    expect(gate).toMatch(/result\.structure\.filter\(/);
    expect(gate).toMatch(/f\.severity === "BLOCK"/);
  });
});
