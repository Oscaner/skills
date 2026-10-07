// packages/cdd-engine/src/documents/doctypes/body/__tests__/plan-body.test.ts — the plan concrete
// body (P2 T3; plan §T3 · design C1/C3, Criterion ②). Covers the T3 PlanBody deliverable surface:
//   - the concrete-body construction contract (kind pinned "plan", the authoring-way description
//     injected read-only, an instance of the abstract DocBody);
//   - the full-field shape projection — the metadata header five-tuple (specRef — the Class-A
//     `**Spec:**` + label==basename kept — · parentProgram · version · dependsOn · base), the
//     delta-only `## Constraints` (the single constraint surface — the literal top-level section
//     carrying the plan's own deltas), the `tasks[]` Task data shape (objective / files / interface
//     {consumes,produces} / steps[]{action,checkable} / acceptance[] + the optional dependsOn?/
//     atomicWith? edge fields), the zero taskGroups surface (the retired dispatch-group declaration
//     node is gone) and the `language` authoring-language policy note (the plan is a Strategy B
//     internal doc — prose in the working language, value tokens neutral);
//   - the DOC_TOKENS derived-leaf invariant: the re-projection keeps the deriveDocTokens leaf
//     paths/values (taskHeadings.format · constraints.formACanonical.heading) — deriveDocTokens
//     keeps resolving at module load with production values unchanged, and the retired taskGroups /
//     Form-B token families hold zero presence;
//   - the parse slice-pattern projection (the `### Task N:` render surface + the task-block field
//     markers — objective/steps/acceptance single source);
//   - the leaf-binding identity: `projectSchemaShape()` returns the module-level `PLAN_BODY_SHAPE`
//     leaf (the same object identity the registry's plan doc type carries as its `shape` field);
//   - renderBrief(task): the task-handoff brief content rendered from the Task data (objective +
//     steps[action+checkable] + acceptance) — zero `- **Do**:` prose-carving face (the new-shape
//     fixture assertion: the fixture's parsed task records render their fields into the brief);
//   - the new-shape docContractValidate surface (design C3): the new-shape plan fixture parses
//     (taskNumbers 1..N) and validates clean, and a task step dropping its checkable → validate fail
//     (the step checkable constraint is a validate failure, never an author's discretion);
//   - body-views: the PLAN_BODY_VIEW decomposition axis names the typed `interface{consumes,produces}`
//     task boundary slices;
//   - the dead-shell discipline: `doctypes/shapes/plan.ts` is gone (zero existence — grep included).
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runStructureRules } from "../../../../rules/structure.ts";
import type { SchemaNode } from "../../../doctype.ts";
import { docTypeRegistry } from "../../../registry.ts";
import { DOC_TOKENS, deriveDocTokens } from "../../../tokens.ts";
import { PLAN_BODY_VIEW } from "../../body-views.ts";
import type { PlanDocType, PlanParse } from "../../plan.ts";
import { DocBody } from "../doc-body.ts";
import { OVERALL_SHAPE } from "../overall-body.ts";
import { PHASE_SPEC_BODY_SHAPE, phaseSpecBody } from "../phase-spec-body.ts";
import { PLAN_BODY_SHAPE, PlanBody, planBody } from "../plan-body.ts";
import type { Task } from "../task.ts";

const HERE = import.meta.dirname; // …/documents/doctypes/body/__tests__
const FIXTURES = path.join(HERE, "fixtures");
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..", "..", "..");

const NEW_SHAPE = path.join(FIXTURES, "new-shape-plan.md");

const planType = (): PlanDocType => docTypeRegistry.resolve("plan") as PlanDocType;

// ---- type-level contract surface (tsc --noEmit gate; zero escape directives) ----

/** The type-level assertion carrier — `Expect<T extends true>` compiles only while its argument is
 *  exactly `true`; a flipped contract surface (a `false` argument) fails the whole file. */
type Expect<T extends true> = T;

/** renderBrief is a PlanBody-side member — the abstract DocBody contract exposes no brief surface
 *  (the phase-spec body pins the same negative; the plan body carries the concrete member). */
type _renderBriefOnPlanBody = Expect<
  PlanBody extends { renderBrief(task: Task): string } ? true : false
>;

// ---- shape-navigation probe (the projection content assertions read the leaf's properties tree) ----

function node(props: readonly string[]): SchemaNode {
  let cur: SchemaNode = PLAN_BODY_SHAPE;
  for (const key of props) {
    // The same properties-first walk as tokens.ts nodeAt: a segment is first tried as a
    // `properties` child, falling back to a DIRECT key on the current node (the schema-keyword
    // nodes — the `$defs` container / `items` — used as navigation steps).
    const viaProps = cur.properties && key in cur.properties ? cur.properties[key] : undefined;
    const direct = (cur as Readonly<Record<string, unknown>>)[key] as SchemaNode | undefined;
    const next = viaProps ?? direct;
    if (!next) throw new Error(`shape node path not found: ${props.join(".")}`);
    cur = next;
  }
  return cur;
}

const pat = (props: readonly string[]): string => {
  const v = node(props).pattern;
  if (typeof v !== "string") throw new Error(`no pattern at ${props.join(".")}`);
  return v;
};

const constAt = (props: readonly string[]): unknown => {
  const v = node(props).const;
  if (v === undefined) throw new Error(`no const at ${props.join(".")}`);
  return v;
};

describe("PlanBody — the concrete body construction contract", () => {
  it('idempotent identity: kind pinned "plan" + the authoring-way description injected read-only', () => {
    expect(planBody.kind).toBe("plan");
    expect(planBody.description.length).toBeGreaterThan(0);
    expect(planBody.description).toMatch(/### Task N:/);
    expect(planBody).toBeInstanceOf(DocBody);
  });

  it("a PlanBody constructs with an injected description (the opts face is the arbitrary-description surface)", () => {
    const body = new PlanBody({ description: "fixture-specific template prose" });
    expect(body.kind).toBe("plan");
    expect(body.description).toBe("fixture-specific template prose");
  });

  it("the schema projection returns the module-level leaf (identity — every consumer reads one product)", () => {
    expect(planBody.projectSchemaShape()).toBe(PLAN_BODY_SHAPE);
  });

  it("the slice projection exposes the task-heading surface + the task-block field markers", () => {
    const slices = planBody.projectSlicePatterns();
    // The `### Task N:` render surface — the parse/detect face the 1..N continuity contract reads.
    expect(slices.taskHeading.test("### Task 1: x")).toBe(true);
    expect(slices.taskHeading.test("## Task Groups")).toBe(false);
    // The task-block data-field markers (objective / steps / acceptance single source).
    for (const key of [
      "objective",
      "files",
      "consumes",
      "produces",
      "steps",
      "acceptance",
      "dependsOn",
    ])
      expect(slices[key]).toBeInstanceOf(RegExp);
    expect(slices.objective.test("- **Objective**: x")).toBe(true);
    expect(slices.steps.test("- **Steps**:")).toBe(true);
    expect(slices.acceptance.test("- **Acceptance**:")).toBe(true);
    expect(slices.dependsOn.test("- **DependsOn**: none")).toBe(true);
    // A numbered step entry captures the action + the optional checkable outcome.
    const m = slices.stepEntry.exec("1. do the work — checkable: it works");
    expect(m).not.toBeNull();
    expect(m![1].trim()).toBe("do the work");
    expect(m![2].trim()).toBe("it works");
    // A step entry without the checkable separator leaves the checkable capture empty (a validate
    // failure — the section's own negative probe).
    const bare = slices.stepEntry.exec("2. do the work without a checkable");
    expect(bare).not.toBeNull();
    expect(bare![1].trim()).toBe("do the work without a checkable");
    expect(bare![2]).toBeUndefined();
  });

  it("the constraintsHeading slice is the shared body-plane single source (the plan + phase-spec bodies project the same RegExp)", () => {
    const planSlices = planBody.projectSlicePatterns();
    const specSlices = phaseSpecBody.projectSlicePatterns();
    // The two bodies' constraint scans read ONE byte source (BODY_CONSTRAINTS_HEADING_RE) — the
    // merge-machine canonical read and the spec-skeleton heading can never drift apart.
    expect(planSlices.constraintsHeading).toBe(specSlices.constraintsHeading);
    expect(planSlices.constraintsHeading.test("## Constraints")).toBe(true);
    expect(planSlices.constraintsHeading.test("### Constraints")).toBe(false);
  });
});

describe("PLAN_BODY_SHAPE — the full-field data-shape projection", () => {
  it("metadata header five-tuple (specRef / parentProgram / version / dependsOn / base)", () => {
    for (const key of ["specRef", "parentProgram", "version", "dependsOn", "base"])
      expect(node(["header", key])).toBeDefined();
    // The Class-A `**Spec:**` marker + the label==basename rule keep their leaves (the plan detect
    // marker + the schema.test pin paths).
    expect(constAt(["header", "specRef", "marker"])).toBe("**Spec:**");
    expect(node(["header", "specRef", "labelEqualsBasename"])).toBeDefined();
    expect(constAt(["header", "parentProgram", "marker"])).toBe("**Parent program**");
  });

  it("`## Constraints` is delta-only — the literal section carries the plan's own deltas (the single constraint surface)", () => {
    expect(pat(["constraints", "formACanonical", "heading"])).toBe("^## Constraints\\s*$");
    // The new form's description states the delta-only semantics (new docs never restate inherited
    // conventions).
    const formADesc = node(["constraints", "formACanonical"]).description ?? "";
    expect(formADesc).toMatch(/delta/i);
    expect(formADesc).toMatch(/own/);
    // The plan shape carries no Form-B leaf — the single constraint surface is exactly the one
    // Form-A declaration (a re-added prose-pointer leaf would fail this exact-keys pin).
    const constraintsProps = node(["constraints"]).properties as Readonly<
      Record<string, SchemaNode>
    >;
    expect(Object.keys(constraintsProps)).toEqual(["formACanonical"]);
  });

  it("taskHeadings keeps the colon-form render surface (the DOC_TOKENS taskHeading leaf path)", () => {
    expect(constAt(["taskHeadings", "format"])).toBe("### Task N:");
    expect(pat(["taskHeadings", "pattern"])).toBe("^### Task \\d+:");
    expect(node(["taskHeadings", "continuity"])).toBeDefined();
  });

  it("tasks[] carries the Task data shape — objective/files/interface{consumes,produces}/steps[]{action,checkable}/acceptance + the mandatory dependsOn edge (the bilateral pairing plane is retired)", () => {
    expect(node(["tasks"]).type).toBe("array");
    const item = node(["tasks"]).items;
    const required = item?.required as readonly string[] | undefined;
    expect(required).toContain("objective");
    expect(required).toContain("steps");
    expect(required).toContain("acceptance");
    // the single directed edge is a REQUIRED record member (the edge-completeness contract).
    expect(required).toContain("dependsOn");
    // interface {consumes,produces} — the typed task boundary slices.
    expect(item?.properties?.interface?.properties?.consumes?.type).toBe("array");
    expect(item?.properties?.interface?.properties?.produces?.type).toBe("array");
    // steps[]{action,checkable} — every step requires its verifiable outcome (the checkable
    // validate constraint comes from the schema face, never author discretion at runtime).
    const step = item?.properties?.steps?.items;
    expect(step?.required).toContain("action");
    expect(step?.required).toContain("checkable");
    // The edge field — the mandatory single directed dependsOn (read/write: the parser fills it,
    // TaskGraph consumes it for the wave batches); the retired pairing property carries zero shape
    // presence (a re-added node would fail this pin).
    expect(item?.properties?.dependsOn).toBeDefined();
    expect(item?.properties?.atomicWith).toBeUndefined();
  });

  it("the plan shape declares zero taskGroups node — the retired dispatch-group layout surface is gone (single-form)", () => {
    // The `## Task Groups` dispatch-group declaration node is deleted with the runtime read — the
    // shape's root properties hold no taskGroups member (T4 deliberate update: a re-added node
    // would fail this pin and re-open the retired layout contract).
    const props = PLAN_BODY_SHAPE.properties as Readonly<Record<string, SchemaNode>>;
    expect("taskGroups" in props).toBe(false);
  });

  it("language carries the authoring-language policy guidance (the plan is a Strategy B internal doc)", () => {
    expect(node(["language"]).type).toBe("object");
    const desc = node(["language"]).description ?? "";
    expect(desc).toMatch(/working language/);
    expect(desc).toMatch(/Strategy B/);
  });
});

describe("DOC_TOKENS derived-leaf invariant (the re-projection keeps the derivation leaves)", () => {
  it("deriveDocTokens keeps resolving off the new plan shape with production values unchanged", () => {
    // The module-level DOC_TOKENS already ran at import (a broken leaf path throws at load) — this
    // test re-derives off the LIVE registry shape and pins the leaf families explicitly.
    expect(() =>
      deriveDocTokens({
        plan: docTypeRegistry.resolve("plan").shape,
        overall: OVERALL_SHAPE,
        "phase-spec": PHASE_SPEC_BODY_SHAPE,
      }),
    ).not.toThrow();
    // 1 · taskHeadings.format
    expect(DOC_TOKENS.taskHeadingFormat).toBe("### Task N:");
    // 2 · constraints.formACanonical.heading
    expect(DOC_TOKENS.constraintsHeading).toBe("## Constraints");
    expect(DOC_TOKENS.constraintsHeadingRe.test("## Constraints")).toBe(true);
    // 3 · the retired taskGroups tokens hold zero presence on the derived surface (T4 deliberate
    //    update — the node deletion removes the DOC_TOKENS members with it)
    const keys = Object.keys(DOC_TOKENS);
    for (const retired of [
      "taskGroupsHeading",
      "taskGroupsHeadingRe",
      "taskGroupsLineRe",
      "taskGroupsMinItems",
    ]) {
      expect(keys).not.toContain(retired);
    }
    // 4 · the Form-B prose-anchor tokens are retired (the shape leaf + its derivation are gone)
    expect("proseAnchorTokens" in DOC_TOKENS).toBe(false);
    expect("proseAnchors" in DOC_TOKENS).toBe(false);
  });
});

describe("leaf binding — DocType.shape derives from the body projection (S8)", () => {
  it("the registered plan doc type's shape IS the body leaf projection value (identity — the tokens.ts / SchemaFactory input)", () => {
    expect(docTypeRegistry.resolve("plan").shape).toBe(PLAN_BODY_SHAPE);
  });

  it("the leaf carries the data-shape head (the tasks[] record the projection serves)", () => {
    expect(docTypeRegistry.resolve("plan").shape.description).toMatch(/task data records/);
    expect(docTypeRegistry.resolve("plan").shape.description).toMatch(/delta/i);
  });
});

describe("body-view decomposition axis (the interface{consumes,produces} typed slices)", () => {
  it("PLAN_BODY_VIEW.reviews.axesGuide names the typed task boundary + interface slices", () => {
    const axes = PLAN_BODY_VIEW.reviews!.axesGuide;
    expect(axes).toMatch(/interface/);
    expect(axes).toMatch(/consumes/);
    expect(axes).toMatch(/produces/);
    expect(axes).toMatch(/decomposition/);
  });
});

describe("renderBrief — the task-handoff brief rendered from Task data (zero `- **Do**:`)", () => {
  it("renders objective + steps[action+checkable] + acceptance from a task record", () => {
    const task: Task = {
      objective: "ship the data-shaped brief",
      files: ["a.ts"],
      interface: { consumes: ["x"], produces: ["y"] },
      steps: [
        { action: "write the renderer", checkable: "the brief compiles" },
        { action: "prove zero Do carving", checkable: "the output has no legacy Do marker" },
      ],
      acceptance: ["the brief carries objective", "the brief carries every checkable"],
      dependsOn: [],
      hasDependsOn: true,
    };
    const brief = planBody.renderBrief(task);
    expect(brief).toContain("ship the data-shaped brief");
    expect(brief).toContain("write the renderer");
    expect(brief).toContain("the brief compiles");
    expect(brief).toContain("prove zero Do carving");
    expect(brief).toContain("no legacy Do marker");
    expect(brief).toContain("the brief carries objective");
    expect(brief).toContain("the brief carries every checkable");
    // The `- **Do**:` FACE is gone — no brief line opens with the legacy marker (inline content that
    // merely mentions the token is not the marker face).
    expect(brief).not.toMatch(/^- \*\*Do\*\*:/m);
  });

  it("the new-shape fixture's parsed task records render their fields into the brief (新形 fixture 断言)", () => {
    const tasks = planType().tasksFromPlan(NEW_SHAPE);
    expect(tasks.length).toBeGreaterThan(0);
    const task = tasks[0]!;
    const brief = planBody.renderBrief(task);
    expect(brief).toContain(task.objective);
    for (const step of task.steps) {
      expect(brief).toContain(step.action);
      expect(brief).toContain(step.checkable);
    }
    for (const a of task.acceptance) expect(brief).toContain(a);
    // The `- **Do**:` FACE is gone (no brief line opens with it) — inline content that merely
    // mentions the legacy token in prose is not the marker face.
    expect(brief).not.toMatch(/^- \*\*Do\*\*:/m);
  });
});

describe("the new-shape plan fixture — parse + validate + tasksFromPlan (design C3)", () => {
  it("parse 全绿: the data-shape fixture's task headings stay the contiguous 1..N render surface", () => {
    const parsed = planType().parse(NEW_SHAPE, { root: REPO_ROOT }) as PlanParse;
    expect(parsed.taskNumbers).toEqual([1, 2]);
  });

  it("validate 全绿: the full new-shape fixture audits clean (plan contract + data-shape steps + Class A)", () => {
    expect(planType().validate(NEW_SHAPE, { root: REPO_ROOT })).toEqual([]);
  });

  it("tasksFromPlan extracts the full Task data records (objective / files / interface / steps / acceptance)", () => {
    const tasks = planType().tasksFromPlan(NEW_SHAPE);
    expect(tasks).toHaveLength(2);
    const first = tasks[0]!;
    expect(first.objective).toContain("project the new plan record shape");
    expect(first.steps).toEqual([
      {
        action: "Write the PlanBody leaf projection",
        checkable: "`plan-body.ts` compiles under the new shape",
      },
      {
        action: "Re-derive the schema product",
        checkable: "`plan.json` is byte-faithful to the projection",
      },
    ]);
    expect(first.acceptance).toContain("The rendered brief carries no `- **Do**:` face");
    // The second task's objective/steps/acceptance parse independently.
    const second = tasks[1]!;
    expect(second.objective).toContain("render the task-handoff brief");
    expect(second.steps).toHaveLength(2);
    expect(second.steps.every((s) => s.checkable.length > 0)).toBe(true);
  });

  it("a task step dropping its checkable → structure-finding fail (P3.1 T2: the step checkable is a rule-data judgment at the gate — never author discretion)", () => {
    const missingCheckable = readFileSync(NEW_SHAPE, "utf8").replace(
      "2. Re-derive the schema product — checkable: `plan.json` is byte-faithful to the projection",
      "2. Re-derive the schema product",
    );
    const findings = runStructureRules(missingCheckable, planBody.structureRules());
    expect(findings.map((f) => f.id)).toContain("plan.checkable");
    expect(findings.find((f) => f.id === "plan.checkable")!.severity).toBe("BLOCK");
  });

  it("a numbered line outside a `- **Steps**:` block (Constraints prose / a code fence) never demands a checkable — the checkable rule is section-scoped (P3.1 T2: behavior-equivalence with the retired contract's parsed-steps scope)", () => {
    const scoped = [
      "# Plan",
      "",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "",
      "## Constraints",
      "",
      "- boundary one",
      "1. a numbered constraint line without a checkable (prose, never a step)",
      "",
      "### Task 1: x",
      "",
      "- **Objective**: task one",
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "",
      "```",
      "1. a numbered line in a code fence (never a step)",
      "```",
      "",
    ].join("\n");
    const findings = runStructureRules(scoped, planBody.structureRules());
    expect(findings.map((f) => f.id)).not.toContain("plan.checkable");
  });

  it("every step keeps its checkable in the untouched fixture — no spurious data-shape failure", () => {
    const findings = runStructureRules(readFileSync(NEW_SHAPE, "utf8"), planBody.structureRules());
    expect(findings.map((f) => f.id)).not.toContain("plan.checkable");
  });
});

describe("the unilateral edge rules — plan.edge (missing-edge sixth class) + plan.antiDependency (the gate)", () => {
  it("a task block without its `- **DependsOn**:` line → the edge-completeness rule fires (BLOCK)", () => {
    const missing = [
      "# Plan",
      "",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "### Task 1: x",
      "- **Objective**: task one",
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "",
    ].join("\n");
    const findings = runStructureRules(missing, planBody.structureRules());
    expect(findings.map((f) => f.id)).toContain("plan.edge");
    expect(findings.find((f) => f.id === "plan.edge")!.severity).toBe("BLOCK");
    // single-axis: the anti-dependency rule judges nothing on a line-less plan (no items).
    expect(findings.map((f) => f.id)).not.toContain("plan.antiDependency");
  });

  it("a forward reference (`T5 dependsOn 10`) → the anti-dependency rule fires (BLOCK); `none` stays silent", () => {
    const blockLines: string[] = [];
    for (let n = 1; n <= 10; n++) {
      blockLines.push(`### Task ${n}: t${n}`);
      blockLines.push(`- **Objective**: task ${n}`);
      blockLines.push(n === 5 ? "- **DependsOn**: 10" : "- **DependsOn**: none");
      blockLines.push("- **Steps**:");
      blockLines.push("  1. implement — checkable: done");
      blockLines.push("- **Acceptance**:");
      blockLines.push("  - done");
      blockLines.push("");
    }
    const plan = ["# Plan", "", "## Constraints", "", "- delta", "", ...blockLines].join("\n");
    const findings = runStructureRules(plan, planBody.structureRules());
    expect(findings.map((f) => f.id)).toContain("plan.antiDependency");
    expect(findings.map((f) => f.id)).not.toContain("plan.edge"); // every block declares its line
  });

  it("an out-of-bounds reference (`T2 dependsOn 99` — beyond the plan's 2-task range) does NOT trip the anti-dependency rule (the out-of-range exemption mirrors the graph plane's missing-id class)", () => {
    const plan = [
      "# Plan",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "### Task 1: x",
      "- **Objective**: task one",
      "- **DependsOn**: none",
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "",
      "### Task 2: y",
      "- **Objective**: task two",
      "- **DependsOn**: 99",
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "",
    ].join("\n");
    const findings = runStructureRules(plan, planBody.structureRules());
    // the gate survives on a genuinely out-of-range ref — a past-the-edge value is the graph
    // plane's missing-id failure, never the anti-dependency contradiction (task-graph pins 99 → missing-id).
    expect(findings.map((f) => f.id)).not.toContain("plan.antiDependency");
    expect(findings.map((f) => f.id)).not.toContain("plan.edge"); // every block declares its line
  });

  it("a self reference (`### Task 5:` block with `- **DependsOn**: 5`) also trips the anti-dependency rule (引用 ≥ 自身 BLOCK)", () => {
    const plan = [
      "# Plan",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "### Task 5: lonely",
      "- **Objective**: task five",
      "- **DependsOn**: 5",
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "",
    ].join("\n");
    const findings = runStructureRules(plan, planBody.structureRules());
    expect(findings.map((f) => f.id)).toContain("plan.antiDependency");
  });

  it("a conforming all-`none` plan carries zero edge findings (the tree's migrated quiet baseline)", () => {
    const plan = [
      "# Plan",
      "",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "### Task 1: x",
      "- **Objective**: task one",
      "- **DependsOn**: none",
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "",
      "### Task 2: y",
      "- **Objective**: task two",
      "- **DependsOn**: 1",
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "",
    ].join("\n");
    expect(runStructureRules(plan, planBody.structureRules())).toEqual([]);
  });
});

describe("plan.referenceLint — the reference-lint WARN observation (P3.1 T6 · spec §2.3 宽松观测面，非门面)", () => {
  /** The structure-clean plan baseline the reference lint observes over: edge lines present,
   *  checkables present, no legacy faces — any finding left is a reference-lint observation. */
  function lintPlan(blocks: string[]): string {
    return ["# Plan", "", "## Constraints", "", "- delta", "", ...blocks].join("\n");
  }

  /** One task block — objective / dependsOn / steps / acceptance; extra field bodies (files /
   *  consumes…) inject via extras (a file bullet or a numbered step after the marker). */
  function lintBlock(
    n: number,
    objective: string,
    dependsOn: string,
    acceptance: string[],
    extras: string[] = [],
  ): string {
    return [
      `### Task ${n}: t${n}`,
      `- **Objective**: ${objective}`,
      ...extras,
      `- **DependsOn**: ${dependsOn}`,
      "- **Steps**:",
      "  1. implement — checkable: done",
      "- **Acceptance**:",
      ...acceptance.map((a) => `  - ${a}`),
      "",
    ].join("\n");
  }

  const lint = (plan: string) =>
    runStructureRules(plan, planBody.structureRules()).filter((f) => f.id === "plan.referenceLint");

  it("the rule is registered as a WARN observation with the field-defined reference surface (anchor + declaredReferences + the scan surface — single-sourced from the projected slices)", () => {
    const rule = planBody.structureRules().find((r) => r.id === "plan.referenceLint");
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe("WARN");
    expect(rule!.invariants).toEqual([{ type: "referenceLint" }]);
    expect(rule!.plane.within).toBe("^### Task (\\d+):");
    expect(rule!.plane.declaredReferences).toContain("DependsOn");
    // The scan surface is rule data single-sourced from the projected slices — the interpreter
    // reads the marker / bullet vocabulary from HERE, never a re-typed field name (P3.1 T6 fix).
    const slices = planBody.projectSlicePatterns();
    expect(rule!.plane.referenceSurface).toEqual({
      markers: [slices.objective.source, slices.acceptance.source],
      bulletOwners: [slices.acceptance.source],
    });
    // The anchor's marker arms co-derive from the SAME surface markers (a renamed prose field
    // drifts the anchor AND the scan together, never silently), and its constructive exclusion
    // keeps numbered step entries off the bullet face.
    expect(rule!.plane.anchor).toBe(
      `${slices.objective.source}.*$|${slices.acceptance.source}.*$|^\\s+[-*]\\s+(?!\\d+\\.).*$`,
    );
  });

  it("a backward `Task N` citation with no matching edge → exactly one WARN (the suspected missing edge)", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "task two", "none", ["done"]),
      lintBlock(3, "extends Task 1", "none", ["done"]),
    ]);
    expect(lint(plan)).toHaveLength(1);
    expect(lint(plan)[0]!.severity).toBe("WARN");
  });

  it("the short `T<N>` form triggers the same observation (a cited backward task, no edge)", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "task two", "none", ["done"]),
      lintBlock(3, "reuses T1", "none", ["done"]),
    ]);
    expect(lint(plan)).toHaveLength(1);
  });

  it("aggregation — multiple suspect references in one block collapse into a single WARN (每块至多一条)", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "task two", "none", ["done"]),
      lintBlock(3, "spans Task 1 and Task 2", "none", ["done"]),
    ]);
    expect(lint(plan)).toHaveLength(1);
  });

  it("per-block granularity — two suspect blocks emit two WARNs (each block at most one)", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "reuses Task 1", "none", ["done"]),
      lintBlock(3, "reuses Task 1", "none", ["done"]),
    ]);
    expect(lint(plan)).toHaveLength(2);
  });

  it("a forward reference (ref ≥ the block's own number) and a self reference are exempt — the anti-dependency gate makes them undeclareable, never a missing-edge suspicion", () => {
    const plan = lintPlan([
      lintBlock(1, "continues Task 3", "none", ["done"]),
      lintBlock(2, "task two", "none", ["done"]),
      lintBlock(3, "about Task 3 itself", "none", ["done"]),
    ]);
    expect(lint(plan)).toEqual([]);
  });

  it("the spec-item word form (`T7.1`) is excluded — a design-item reference is never a task reference (a `T3.1` in a lower block would otherwise be suspect)", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "task two", "none", ["done"]),
      lintBlock(3, "task three", "none", ["done"]),
      lintBlock(4, "per T3.1", "none", ["done"]),
    ]);
    expect(lint(plan)).toEqual([]);
  });

  it("a reference inside a code span cites a symbol, never prose intent — `T3` / `Task 1` inside a span stay silent", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "task two", "none", ["done"]),
      lintBlock(3, "reads `T3` and `Task 1`", "none", ["done"]),
    ]);
    expect(lint(plan)).toEqual([]);
  });

  it("the scan surface is FIELD-defined — references in the Files / Steps faces are constructively outside the objective/acceptance prose (a would-be suspect inside a file bullet or a numbered step stays silent)", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(
        2,
        "task two",
        "none",
        ["done"],
        [
          "- **Files**:",
          "  - Modify: src/Task 1 seam",
          "- **Steps**:",
          "  - 1. wire the T1 seam — checkable: done",
        ],
      ),
    ]);
    expect(lint(plan)).toEqual([]);
  });

  it("an out-of-range reference is exempt — a past-the-edge id (0 or > taskCount) is the graph plane's missing-id class, never a dependency hint", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "mirrors Task 42 and Task 0", "none", ["done"]),
    ]);
    expect(lint(plan)).toEqual([]);
  });

  it("a reference the block itself declares as an edge is never a suspicion (已声明边 → zero)", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "spans Task 1", "1", ["done"]),
    ]);
    expect(lint(plan)).toEqual([]);
  });

  it("a conformant plan with zero references observes zero — the lint adds no noise to a clean record", () => {
    const plan = lintPlan([
      lintBlock(1, "task one", "none", ["done"]),
      lintBlock(2, "task two", "1", ["done"]),
    ]);
    expect(lint(plan)).toEqual([]);
  });
});

describe("dead-shell discipline — shapes/plan.ts is gone", () => {
  it("doctypes/shapes/plan.ts does not exist (grep included)", () => {
    expect(existsSync(path.join(import.meta.dirname, "..", "..", "shapes", "plan.ts"))).toBe(false);
    // No surviving reference to the retired constant anywhere in the non-test engine src.
    const root = path.resolve(import.meta.dirname, "..", "..", "..", ".."); // src root
    const hits = execSync(
      `grep -rn --include="*.ts" "shapes/plan" "${root}" --exclude-dir="__tests__" || true`,
      { encoding: "utf8" },
    );
    expect(hits.trim()).toBe("");
  });
});

describe("deletion-set union — the retired shape/token surface holds zero presence (T3+T4, engine src incl. comments)", () => {
  // The T3+T4 deletion-set union (the acceptance's union surface): every symbol the single-form
  // re-base retired must hold zero hits in the engine src (COMMENTS included — a comment that still
  // names a retired symbol re-opens the deleted surface; __tests__ excluded — the BLOCK fixtures
  // legitimately carry the legacy content they test against). The runtime/token/shape symbols
  // below are the whole acceptance list.
  const ENGINE_SRC = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const DELETION_SET = [
    "PLAN_FORM_B_ANCHOR_TOKENS",
    "formBAnchorHeadingRe",
    "formBAnchorSlices",
    "formBProseAnchors",
    "taskGroupsFromPlan",
    "taskGroupsHeading",
    "taskGroupsHeadingRe",
    "taskGroupsLineRe",
    "taskGroupsMinItems",
    "extractProseConstraints",
    // The unilateral-rebuild symbols: the pairing field's read surface, its symmetric transitive
    // closure + the contradiction-edge component passes (the atomic plan is gone).
    "atomicPairHas",
    "atomicPartition",
    "componentPass",
    "compIndexOf",
    // the bare-word sweep — the pairing marker's zero presence in the non-test engine src
    // (COMMENTS included, the deletion-set discipline) guards the declaration face's retirement.
    "atomicWith",
  ];
  const grepNontest = (needle: string): string =>
    execSync(
      `grep -rn -e "${needle}" "${ENGINE_SRC}" --include="*.ts" --exclude-dir="__tests__" || true`,
      { encoding: "utf8" },
    );

  it.each(DELETION_SET)("%s — zero hits across the engine src", (sym) => {
    const hits = grepNontest(sym);
    expect(hits.trim(), `deletion-set symbol "${sym}" still referenced in the engine src`).toBe("");
  });

  it("the legacy spec Section-1 heading READ is gone (no `## Section` top-level heading in the non-test src)", () => {
    // The six-section legacy spec skeleton's heading read is retired with the dual-read runtime — a
    // `## Section N:` top-level heading string in the engine src would re-open the retired read face.
    const hits = execSync(
      `grep -rn -e '^## Section' "${ENGINE_SRC}" --include="*.ts" --exclude-dir="__tests__" || true`,
      { encoding: "utf8" },
    );
    expect(hits.trim(), "a `## Section` heading reference survives in the engine src").toBe("");
  });

  it("the regenerated plan schema golden carries zero taskGroups / pairing-field surface", () => {
    const planJson = readFileSync(
      path.join(ENGINE_SRC, "..", "config", "schema", "plan.json"),
      "utf8",
    );
    expect(planJson).not.toMatch(/taskGroups/i);
    expect(planJson).not.toMatch(/Task Groups/);
    expect(planJson).not.toMatch(/atomicWith/i);
    expect(planJson).not.toMatch(/formB|proseAnchors/i);
  });
});
