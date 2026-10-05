// packages/cdd-engine/src/documents/doctypes/body/__tests__/plan-body.test.ts — the plan concrete
// body (P2 T3; plan §T3 · design C1/C3, Criterion ②). Covers the T3 PlanBody deliverable surface:
//   - the concrete-body construction contract (kind pinned "plan", the authoring-way description
//     injected read-only, an instance of the abstract DocBody);
//   - the full-field shape projection — the metadata header five-tuple (specRef — the Class-A
//     `**Spec:**` + label==basename kept — · parentProgram · version · dependsOn · base), the
//     delta-only `## Constraints` (Form B prose pointers banned for new docs, retained for the
//     legacy dual-read tree only), the `tasks[]` Task data shape (objective / files / interface
//     {consumes,produces} / steps[]{action,checkable} / acceptance[] + the optional dependsOn?/
//     atomicWith? edge fields), the taskGroups dispatch-group declaration (an optional section — the
//     DOC_TOKENS layout leaves preserved) and the `language` authoring-language policy note (the
//     plan is a Strategy B internal doc — prose in the working language, value tokens neutral);
//   - the DOC_TOKENS derived-leaf invariant: the re-projection keeps the four deriveDocTokens leaf
//     paths/values (taskHeadings.format · constraints.formACanonical.heading ·
//     constraints.formBProseAnchors.anchors.items.enum · the taskGroups layout nodes) — deriveDocTokens
//     keeps resolving at module load with production values unchanged;
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
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SchemaNode } from "../../../doctype.ts";
import { docTypeRegistry } from "../../../registry.ts";
import { DOC_TOKENS, deriveDocTokens } from "../../../tokens.ts";
import { PLAN_BODY_VIEW } from "../../body-views.ts";
import type { PlanDocType, PlanParse } from "../../plan.ts";
import { OVERALL_SHAPE } from "../../shapes/overall.ts";
import { DocBody } from "../doc-body.ts";
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
    for (const key of ["objective", "files", "consumes", "produces", "steps", "acceptance"])
      expect(slices[key]).toBeInstanceOf(RegExp);
    expect(slices.objective.test("- **Objective**: x")).toBe(true);
    expect(slices.steps.test("- **Steps**:")).toBe(true);
    expect(slices.acceptance.test("- **Acceptance**:")).toBe(true);
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

  it("`## Constraints` is delta-only — the section carries the plan's own deltas; Form B is a legacy-only read face", () => {
    expect(pat(["constraints", "formACanonical", "heading"])).toBe("^## Constraints\\s*$");
    // The new form's description states the delta-only semantics (new docs never restate inherited
    // conventions; Form B prose pointers are banned for new docs).
    const formADesc = node(["constraints", "formACanonical"]).description ?? "";
    expect(formADesc).toMatch(/delta/i);
    expect(formADesc).toMatch(/own/);
    const formBDesc = node(["constraints", "formBProseAnchors"]).description ?? "";
    expect(formBDesc).toMatch(/legacy/i);
    // The Form-B anchor quad is retained verbatim (the T5 legacy dual-read + extractProseConstraints
    // dependency — the four anchors stay the same tokens).
    const anchors = node(["constraints", "formBProseAnchors", "anchors"]).items
      ?.enum as readonly string[];
    expect(anchors).toEqual([
      "**口径**：",
      "**commit 边界机制**：",
      "**Flow Atomicity**：",
      "**顺序原则**：",
    ]);
  });

  it("taskHeadings keeps the colon-form render surface (the DOC_TOKENS taskHeading leaf path)", () => {
    expect(constAt(["taskHeadings", "format"])).toBe("### Task N:");
    expect(pat(["taskHeadings", "pattern"])).toBe("^### Task \\d+:");
    expect(node(["taskHeadings", "continuity"])).toBeDefined();
  });

  it("tasks[] carries the Task data shape — objective/files/interface{consumes,produces}/steps[]{action,checkable}/acceptance + the edge fields", () => {
    expect(node(["tasks"]).type).toBe("array");
    const item = node(["tasks"]).items;
    const required = item?.required as readonly string[] | undefined;
    expect(required).toContain("objective");
    expect(required).toContain("steps");
    expect(required).toContain("acceptance");
    // interface {consumes,produces} — the typed task boundary slices.
    expect(item?.properties?.interface?.properties?.consumes?.type).toBe("array");
    expect(item?.properties?.interface?.properties?.produces?.type).toBe("array");
    // steps[]{action,checkable} — every step requires its verifiable outcome (the checkable
    // validate constraint comes from the schema face, never author discretion at runtime).
    const step = item?.properties?.steps?.items;
    expect(step?.required).toContain("action");
    expect(step?.required).toContain("checkable");
    // The edge fields — read/write (the parser fills them, TaskGraph consumes them).
    expect(item?.properties?.dependsOn).toBeDefined();
    expect(item?.properties?.atomicWith).toBeDefined();
  });

  it("taskGroups keeps the dispatch-group layout nodes (the DOC_TOKENS taskGroups leaf paths)", () => {
    expect(node(["taskGroups"]).type).toBe("array");
    expect(node(["taskGroups"]).default).toEqual([]);
    expect(constAt(["taskGroups", "$defs", "section", "properties", "heading"])).toBe(
      "## Task Groups",
    );
    expect(pat(["taskGroups", "$defs", "section", "properties", "entry"])).toBe(
      "^- \\*\\*Task (?:\\d+(?:, \\d+)*)\\*\\*:",
    );
    expect(node(["taskGroups", "items", "properties", "tasks"]).minItems).toBe(2);
  });

  it("language carries the authoring-language policy guidance (the plan is a Strategy B internal doc)", () => {
    expect(node(["language"]).type).toBe("object");
    const desc = node(["language"]).description ?? "";
    expect(desc).toMatch(/working language/);
    expect(desc).toMatch(/Strategy B/);
  });
});

describe("DOC_TOKENS derived-leaf invariant (the T3 re-projection keeps all four leaf paths)", () => {
  it("deriveDocTokens keeps resolving off the new plan shape with production values unchanged", () => {
    // The module-level DOC_TOKENS already ran at import (a broken leaf path throws at load) — this
    // test re-derives off the LIVE registry shape and pins the four leaf families explicitly.
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
    // 3 · constraints.formBProseAnchors.anchors.items.enum
    expect(DOC_TOKENS.proseAnchorTokens).toEqual([
      "**口径**：",
      "**commit 边界机制**：",
      "**Flow Atomicity**：",
      "**顺序原则**：",
    ]);
    // 4 · the taskGroups layout nodes
    expect(DOC_TOKENS.taskGroupsHeading).toBe("## Task Groups");
    expect(DOC_TOKENS.taskGroupsMinItems).toBe(2);
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
    expect(parsed.taskGroups).toEqual([]);
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

  /** Write a doctored plan to a temp file and run the plan validate against it (the doc contract
   *  reads the file — the doctoring surface for the data-shape negatives). */
  function doctored(content: string, run: (planPath: string) => void): void {
    const dir = mkdtempSync(path.join(tmpdir(), "plan-body-"));
    try {
      const planPath = path.join(dir, "doctored-plan-new-shape.md");
      writeFileSync(planPath, content);
      run(planPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("a task step dropping its checkable → validate fail (step checkable is a validate failure, never author discretion)", () => {
    const missingCheckable = readFileSync(NEW_SHAPE, "utf8").replace(
      "2. Re-derive the schema product — checkable: `plan.json` is byte-faithful to the projection",
      "2. Re-derive the schema product",
    );
    doctored(missingCheckable, (p) => {
      const failures = planType().validate(p, { root: REPO_ROOT });
      expect(failures.some((f) => f.field.includes("`checkable`"))).toBe(true);
      expect(failures.some((f) => f.fix.includes("checkable"))).toBe(true);
    });
  });

  it("every step keeps its checkable in the untouched fixture — no spurious data-shape failure", () => {
    doctored(readFileSync(NEW_SHAPE, "utf8"), (p) => {
      const failures = planType().validate(p, { root: REPO_ROOT });
      expect(failures.some((f) => f.field.includes("`checkable`"))).toBe(false);
    });
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
