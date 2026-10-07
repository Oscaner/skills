// packages/cdd-engine/src/documents/doctypes/__tests__/dual-read.test.ts — the single-form tree
// suite (T3 re-base: the dual-read contract + extractor re-homing + the 46-file zero-regression
// golden all retired in one action). The engine's runtime read surface is single-grammar from T3
// on — the common read faces (the `### Task N:` headings / the Form-A `## Constraints` section /
// the phase-spec version line / the design-spec three-truth skeleton) — and this file covers the
// deliverable surface:
//   - extractor projection single source (the task-heading + Form-A constraint-heading slices —
//     the parse families read the plan body's `projectSlicePatterns()` and never hand-write a
//     duplicate pattern; the Form-B anchor family is gone with the dual-read runtime);
//   - the full-tree walk: the ENTIRE docs/kairos/specs|plans/* tree (actual count: 22 plans + 21
//     design specs + 4 overalls + 1 one-off spec = 48 files — including this program's own p3
//     plan/design) stays PROCESSABLE on every common read face (detect / version parse / task
//     headings / brief slices) with byte-deterministic parse outputs;
//   - single-form BLOCK: a NEW document carrying a legacy face (`- **Do**:` task block / Form B
//     prose anchors / `## Task Groups` section / spec `## Section 1`) fails `docContractValidate` —
//     the three-truth skeleton and the literal `## Constraints` source are the only grammar (the
//     `## Task Groups` dispatch-group section is blocked by the unknown-section face — the shape
//     node is deleted with the runtime read; the migration-queue state of the legacy tree lives in
//     tree-migration.test.ts; T5–T7 migrate per family, T8 flips the terminal state).
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DocumentsValidator } from "../../../rules/documents.ts";
import { docTypeRegistry } from "../../registry.ts";
import { DOC_TOKENS } from "../../tokens.ts";
import { phaseSpecBody } from "../body/phase-spec-body.ts";
import { planBody } from "../body/plan-body.ts";
import type { PlanDocType, PlanParse } from "../plan.ts";

const HERE = import.meta.dirname; // …/documents/doctypes/__tests__
const FIXTURES = path.join(HERE, "fixtures");
// The repo root — 6 levels up from src/documents/doctypes/__tests__ (the real docs tree the
// full-tree walk covers).
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..", "..");
const SPECS_DIR = path.join(REPO_ROOT, "docs", "kairos", "specs");
const PLANS_DIR = path.join(REPO_ROOT, "docs", "kairos", "plans");

// The single-form BLOCK fixtures — new documents carrying a legacy face (each fails validate on
// its legacy axis only, the single-form grammar's BLOCK surface).
const ORPHAN_TASK_PLAN = path.join(FIXTURES, "orphan-task-block-plan.md");
const FORM_B_PLAN = path.join(FIXTURES, "form-b-anchor-plan.md");
const SECTION_1_SPEC = path.join(FIXTURES, "section-1-spec-design.md");
const NEW_SHAPE_FIXTURE = path.join(
  HERE,
  "..",
  "body",
  "__tests__",
  "fixtures",
  "new-shape-plan.md",
);

const validator = new DocumentsValidator();
const planType = (): PlanDocType => docTypeRegistry.resolve("plan") as PlanDocType;
const specType = () => docTypeRegistry.resolve("spec");

// The pre-rewire extractor files — the negative grep scope (see the projection-single-source
// suite). The task-heading / constraints-heading regex literals must not be hand-written in the
// extractor planes — the readers use the body projection.
const EXTRACTOR_FILES = [
  "documents/doctypes/plan.ts",
  "documents/doctypes/shared.ts",
  "documents/doctypes/body/constraints.ts",
  "render/brief.ts",
];

describe("extractor projection single source — the common parse families derive from the plan body", () => {
  it("the projected slice set carries the task-heading (number-capturing) + the Form-A constraints heading", () => {
    const slices = planBody.projectSlicePatterns();
    // `### Task N:` — the number captured (taskNumbersFromPlan's read face).
    expect(slices.taskHeading.source).toBe("^### Task (\\d+):");
    const m = slices.taskHeading.exec("### Task 7: x");
    expect(m?.[1]).toBe("7");
    expect(slices.taskHeading.test("## Task Groups")).toBe(false);
    // `## Constraints` — the Form-A section heading (the shared extraction's injected pattern).
    expect(slices.constraintsHeading.test("## Constraints")).toBe(true);
    expect(slices.constraintsHeading.test("## Global Constraints")).toBe(false);
  });

  it("grep: no hand-written family regex literal in the extractor files (plan / shared / constraints / brief)", () => {
    const engineSrc = path.resolve(REPO_ROOT, "packages", "cdd-engine", "src");
    for (const rel of EXTRACTOR_FILES) {
      const code = readFileSync(path.join(engineSrc, rel), "utf8");
      // the task-heading / constraints-heading regex-literal forms (a `/^### Task` or `/^## Constraints`
      // slash-prefixed scan) must not be hand-written — the extractors read the body projection.
      expect(code, `${rel} hand-writes a task-heading regex`).not.toMatch(/\/\^### Task/);
      expect(code, `${rel} hand-writes a constraints-heading regex`).not.toMatch(
        /\/\^## Constraints/,
      );
    }
    // The parse-regex single homes: the plan body leaf owns the plan-only task-heading regex; the
    // SHARED constraints-heading regex is built in the body-plane root (doc-body.ts — the
    // `## Constraints` literal const + the derived regex BOTH body leaves spread), so the
    // constraint-heading scan has one byte source, never a hand-written literal per leaf.
    const bodyLeaf = readFileSync(
      path.join(engineSrc, "documents", "doctypes", "body", "plan-body.ts"),
      "utf8",
    );
    expect(bodyLeaf).toMatch(/taskHeading: \/\^### Task \(\\d\+\):\/m/);
    expect(bodyLeaf).toMatch(/constraintsHeading: BODY_CONSTRAINTS_HEADING_RE/);
    const bodyRoot = readFileSync(
      path.join(engineSrc, "documents", "doctypes", "body", "doc-body.ts"),
      "utf8",
    );
    expect(bodyRoot).toMatch(/BODY_CONSTRAINTS_HEADING = "## Constraints"/);
    expect(bodyRoot).toMatch(/BODY_CONSTRAINTS_HEADING_RE = new RegExp/);
    expect(bodyRoot).toMatch(/escapeRegExp\(BODY_CONSTRAINTS_HEADING\)/);
  });
});

describe("full-tree single-form walk — the entire docs/kairos tree (50 files, zero exclusions)", () => {
  it("the actual tree composition: 23 plans + 22 design specs + 4 overalls + 1 one-off spec = 50 files", () => {
    const plans = readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"));
    const specs = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".md"));
    const designs = specs.filter((f) => f.endsWith("-design.md"));
    const overalls = specs.filter((f) => f.endsWith("-overall.md"));
    const oneOffs = specs.filter((f) => !f.endsWith("-design.md") && !f.endsWith("-overall.md"));
    expect(plans).toHaveLength(23);
    expect(designs).toHaveLength(22);
    expect(overalls).toHaveLength(4);
    expect(oneOffs).toEqual(["2026-09-28-cdd-review-contract-fix.md"]);
  });

  it("every validation file walks the rule plane: structureFindings(kind, content) = 0 at BLOCK severity — the tree's structural judgments are the body rule sets, never a self-written walk (P3.1 T2 step 4; BLOCK-only caliber since P3.1 T6 — referenceLint WARN is a legal tree observation, asserted by the lint unit tests)", () => {
    // The composition split: 23 plans + 22 design specs + 4 overalls (the one-off single-spec is
    // detect-only, never counted — the walk excludes it by shape). The rule plane asserts the
    // whole-tree structural hit-set (0 or pin); the frozen overalls' backfill-claim residue is the
    // ACCOUNTING face — asserted separately in tree-migration.test.ts on the validate side, never
    // part of this structural walk.
    const plans = readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"));
    const specs = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".md"));
    const designs = specs.filter((f) => f.endsWith("-design.md"));
    const overalls = specs.filter((f) => f.endsWith("-overall.md"));
    const oneOffs = specs.filter((f) => !f.endsWith("-design.md") && !f.endsWith("-overall.md"));
    expect(oneOffs).toEqual(["2026-09-28-cdd-review-contract-fix.md"]);
    const validationFiles = [
      ...plans.map((f) => ({ kind: "plan" as const, file: f })),
      ...designs.map((f) => ({ kind: "spec" as const, file: f })),
      ...overalls.map((f) => ({ kind: "overall" as const, file: f })),
    ];
    expect(validationFiles).toHaveLength(49);
    for (const { kind, file } of validationFiles) {
      const dir = kind === "plan" ? PLANS_DIR : SPECS_DIR;
      const content = readFileSync(path.join(dir, file), "utf8");
      const findings = validator
        .structureFindings(kind, content)
        .filter((f) => f.severity === "BLOCK");
      expect(findings, `${file} structure findings must be zero`).toEqual([]);
    }
  });

  it("every plan stays processable: detect + contiguous 1..N task headings + parse + brief-slice + the unilateral edge-line face (P3.1 T3 — every task block carries its `- **DependsOn**:` line, `none`/empty/real values; no golden — the per-file state table lives in tree-migration.test.ts)", () => {
    for (const file of readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"))) {
      const planPath = path.join(PLANS_DIR, file);
      // detect + parse (no throw) + contiguous task numbers == the heading count.
      expect(validator.detectDocKind(planPath), file).toBe("plan");
      const nums = planType().taskNumbersFromPlan(planPath);
      expect(
        nums.every((n, i) => n === i + 1),
        `${file} headings must be contiguous 1..N`,
      ).toBe(true);
      expect(
        (planType().parse(planPath, { root: REPO_ROOT }) as PlanParse).taskNumbers,
        file,
      ).toEqual(nums);
      // The unilateral edge-line face (P3.1 T3): every task record carries its line-present fact —
      // a missing `- **DependsOn**:` line is the missing-edge BLOCK (the single-directed-edge walk).
      const tasks = planType().tasksFromPlan(planPath);
      expect(tasks, `${file} task records`).toHaveLength(nums.length);
      for (let i = 0; i < tasks.length; i++) {
        expect(tasks[i]!.hasDependsOn, `${file} Task ${i + 1} edge line missing`).toBe(true);
      }
      // The brief's exact-header slice match works for every task (the scan + the header both
      // resolve — the same surface BriefRenderer runs per dispatch).
      const content = readFileSync(planPath, "utf8");
      const lines = content.split("\n");
      for (const n of nums) {
        expect(
          lines.some((l) => l.startsWith(DOC_TOKENS.taskHeadingFor(n))),
          `${file} Task ${n} heading must be brief-sliceable`,
        ).toBe(true);
      }
    }
  });

  it("every design spec stays processable: detect + the version-line parse (the validate state table lives in tree-migration.test.ts)", () => {
    for (const file of readdirSync(SPECS_DIR).filter((f) => f.endsWith("-design.md"))) {
      const specPath = path.join(SPECS_DIR, file);
      expect(validator.detectDocKind(specPath), file).toBe("spec");
      expect(specType().parse(specPath, { root: REPO_ROOT }), file).toMatch(/^v\d+\.\d+$/);
    }
  });

  it("the double-layer design face is processable tree-wide (P3.1 T4) — every design-body `### N.` / `#### N.M` line matches the projected slices, and every item's `N` resolves to a declared group (the migration targets + the zero-migration pairs walk the same registration-leaf plane)", () => {
    const slices = phaseSpecBody.projectSlicePatterns();
    for (const file of readdirSync(SPECS_DIR).filter((f) => f.endsWith("-design.md"))) {
      const lines = readFileSync(path.join(SPECS_DIR, file), "utf8").split("\n");
      let inDesign = false;
      const groups = new Set<string>();
      const items: Array<{ n: string; line: string }> = [];
      for (const l of lines) {
        if (/^## Design/.test(l)) {
          inDesign = true;
          continue;
        }
        if (inDesign && /^### Acceptance criteria/.test(l)) break;
        if (!inDesign) continue;
        const g = slices.groupHeading.exec(l);
        if (g) {
          groups.add(g[1]!);
          continue;
        }
        const item = slices.designItemHeading.exec(l);
        if (item) items.push({ n: item[1]!, line: l });
      }
      for (const { n, line } of items) {
        expect(groups.has(n), `${file} misbound item ${line}`).toBe(true);
      }
    }
  });

  it("the overalls detect as the overall kind (the enclosing four-table chain stays enumerable)", () => {
    for (const file of readdirSync(SPECS_DIR).filter((f) => f.endsWith("-overall.md"))) {
      expect(validator.detectDocKind(path.join(SPECS_DIR, file)), file).toBe("overall");
    }
  });

  it("the one-off spec (2026-09-28-cdd-review-contract-fix.md) is the sole non-detecting tree doc — documented, not silently excluded", () => {
    // The one-off single-spec (neither a `-design.md` phase spec nor a plan) matches no registered
    // doc type — the tree-migration tolerance (kept out of the canonical count by shape, never by
    // silent exclusion).
    const oneOff = path.join(SPECS_DIR, "2026-09-28-cdd-review-contract-fix.md");
    expect(() => validator.detectDocKind(oneOff)).toThrow(/no registered doc type/);
  });
});

describe("single-form grammar — a NEW document carrying a legacy face fails the rule plane (T3 BLOCK, judged as structure findings from P3.1 T2)", () => {
  /** Write a doc to a temp dir and return its path (the inline single-form negatives — the same
   *  doctored-file surface the body tests use). The caller removes the dir. */
  function tempDoc(content: string, name: string = "doctored.md"): string {
    const dir = mkdtempSync(path.join(tmpdir(), "single-form-"));
    const p = path.join(dir, name);
    writeFileSync(p, content);
    return p;
  }

  /** The structural findings of a doc's content on its kind's body rule set — the doc-contract
   *  gate's structure plane (the single-form judgments ride here from T2 on). */
  function structureHits(kind: "plan" | "spec", file: string): string[] {
    return validator.structureFindings(kind, readFileSync(file, "utf8")).map((f) => f.id);
  }

  it("orphan task block: a `- **Do**:`-face `### Task N:` block (no data-shaped fields) → the record-data residue fires", () => {
    expect(structureHits("plan", ORPHAN_TASK_PLAN)).toContain("plan.recordData");
  });

  it("a field-less task block: an EMPTY `### Task N:` block (no data-shaped fields at all) → the record-presence face fires (the T0 orphan semantic restored — the rule fires on any orphan block, not just the legacy `- **Do**:` face)", () => {
    const empty = tempDoc(
      [
        "# Plan",
        "",
        "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
        "",
        "## Constraints",
        "",
        "- delta",
        "",
        "### Task 1: x",
        "",
      ].join("\n"),
    );
    try {
      expect(structureHits("plan", empty)).toContain("plan.recordData");
    } finally {
      rmSync(path.dirname(empty), { recursive: true, force: true });
    }
  });

  it("Form B constraints: prose-anchor declarations declare NO `## Constraints` source → the constraints-source rule fires (source undeclared BLOCK)", () => {
    expect(structureHits("plan", FORM_B_PLAN)).toContain("plan.constraints");
  });

  it("spec `## Section 1`: a six-section spec (no `## Design` three-truth skeleton) → the skeleton rules fire", () => {
    const hits = structureHits("spec", SECTION_1_SPEC);
    expect(hits).toContain("spec.design");
    expect(hits).toContain("spec.acceptance");
    expect(hits).toContain("spec.constraints");
  });

  it("an inline `- **Do**:` plan and an inline `## Section 1` spec reproduce the fixture verdicts (no fixture-only trap)", () => {
    const orphan = tempDoc(
      [
        "# Plan",
        "",
        "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
        "",
        "## Constraints",
        "",
        "- delta",
        "",
        "### Task 1: x",
        "- **Do**: legacy action",
        "",
      ].join("\n"),
    );
    try {
      expect(structureHits("plan", orphan)).toContain("plan.recordData");
    } finally {
      rmSync(path.dirname(orphan), { recursive: true, force: true });
    }
    const section1 = tempDoc(
      [
        "# Demo P1 — Phase Spec",
        "",
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Section 1: Constraints pointer",
        "",
        "cross-phase conventions live in the parent overall — pointer only.",
        "",
      ].join("\n"),
    );
    try {
      expect(structureHits("spec", section1)).toContain("spec.design");
    } finally {
      rmSync(path.dirname(section1), { recursive: true, force: true });
    }
  });

  it("a legacy `## Task Groups` dispatch-group section → the legacy-section residue fires (unknown section — the shape-node-deleted single-form face)", () => {
    // The dispatch-group declaration is gone from the shape (T4): the single-form plan owns exactly
    // the `## Constraints` top-level section, so a NEW document carrying the retired `## Task Groups`
    // section is an unknown-section BLOCK — never silently parsed or swept under the data records.
    const taskGroups = tempDoc(
      [
        "# Plan",
        "",
        "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
        "",
        "## Constraints",
        "",
        "- delta",
        "",
        "## Task Groups",
        "",
        "- **Task 1, 2**: merged",
        "",
        "### Task 1: x",
        "- **Objective**: task one",
        "- **Steps**:",
        "  1. implement — checkable: done",
        "- **Acceptance**:",
        "  - done",
        "",
        "### Task 2: y",
        "- **Objective**: task two",
        "- **Steps**:",
        "  1. implement — checkable: done",
        "- **Acceptance**:",
        "  - done",
        "",
      ].join("\n"),
    );
    try {
      expect(structureHits("plan", taskGroups)).toContain("plan.legacySections");
    } finally {
      rmSync(path.dirname(taskGroups), { recursive: true, force: true });
    }
  });

  it("the p3 canonical plan carries the only legal top-level section — the legacy-section residue stays silent on the declared `## Constraints` surface", () => {
    // Backstop: the legacy-section rule must not misfire on a conforming plan (the canonical
    // new-shape fixture carries exactly the `## Constraints` section) — the residue fires only on
    // what the shape no longer declares.
    expect(structureHits("plan", NEW_SHAPE_FIXTURE)).not.toContain("plan.legacySections");
  });
});
