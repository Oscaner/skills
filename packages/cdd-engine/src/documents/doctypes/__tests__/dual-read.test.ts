// packages/cdd-engine/src/documents/doctypes/__tests__/dual-read.test.ts — the dual-read contract
// + extractor re-homing + full-tree zero-regression (P2 T5; plan §T5 · design C5/C6). Covers the
// T5 deliverable surface:
//   - legacy six-section spec fixture: validate + parse green (the P1-era shape — constraint source
//     stays the `## Section 1: Constraints pointer` prose) and the legacy constraint read KEPT
//     (specConstraintsOf null — no merged read ever applies to the legacy face, the presentation
//     never changes because of the spec-side merge surface);
//   - Form B plan fixture: validate + parse green (prose-pointer constraint deltas + legacy task
//     bodies) — the dual-read exemption's plan face, with extractPlanConstraints / planConstraintsOf
//     / brief extraction all producing the legacy read unchanged;
//   - extractor re-homing (projection single source): taskNumbersFromPlan / the brief heading scan /
//     the constraints extraction all read the plan body's `projectSlicePatterns()` — the three parse
//     families (`### Task N:` / `## Constraints` / the Form-B anchors) derive from the body leaf and
//     never hand-write a duplicate pattern (grep assertion);
//   - full-tree zero-regression: the ENTIRE docs/kairos/specs|plans/* tree (actual count: 21 plans +
//     20 design specs + 4 overalls + 1 one-off spec = 46 files — including this program's own p1/p2
//     legacy-form docs, the 18/19 count is only the dual-read comparison baseline, never a validate
//     scope limitation) processes with outcomes byte-identical to the TASK_BASE golden (the tree is
//     untouched — zero rewiring-induced regressions on every rewired surface).
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BriefRenderer } from "../../../render/brief.ts";
import { DocumentsValidator } from "../../../rules/documents.ts";
import { docTypeRegistry } from "../../registry.ts";
import { DOC_TOKENS } from "../../tokens.ts";
import { planBody } from "../body/plan-body.ts";
import type { PlanDocType, PlanParse } from "../plan.ts";

const HERE = import.meta.dirname; // …/documents/doctypes/__tests__
const FIXTURES = path.join(HERE, "fixtures");
// The repo root — 6 levels up from src/documents/doctypes/__tests__ (the real docs tree the
// full-tree zero-regression walks).
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..", "..");
const SPECS_DIR = path.join(REPO_ROOT, "docs", "kairos", "specs");
const PLANS_DIR = path.join(REPO_ROOT, "docs", "kairos", "plans");

const LEGACY_SPEC = path.join(FIXTURES, "legacy-six-section-spec-design.md");
const FORM_B_PLAN = path.join(FIXTURES, "form-b-plan.md");

const validator = new DocumentsValidator();
const planType = (): PlanDocType => docTypeRegistry.resolve("plan") as PlanDocType;
const specType = () => docTypeRegistry.resolve("spec");

// The tree golden (frozen at TASK_BASE 534a321d — the tree is untouched by T5, so the rewired
// surfaces must produce exactly these outcomes). Per plan: the contiguous task-count, the declared
// Constraints source (`null` = the pre-existing `## Global Constraints`-era plans declare neither
// Form A nor the Form-B prose pointers — unchanged), and the merged-read outcome (`merged` = the
// planConstraintsOf non-null face; the legacy Form B plans read unmerged). Per design spec: the
// parsed version token + whether the full audit is green (the 13 non-green historical specs carry
// pre-existing four-table claim results — frozen, never part of the T5 rewiring scope).
const PLAN_GOLDEN: Record<
  string,
  { count: number; src: "declared" | null; merged: "declared" | null }
> = {
  "2026-09-13-osuperpowers-overhaul-p1.md": { count: 5, src: null, merged: null },
  "2026-09-13-osuperpowers-overhaul-p2.md": { count: 6, src: null, merged: null },
  "2026-09-13-osuperpowers-overhaul-p3.md": { count: 6, src: null, merged: null },
  "2026-09-13-osuperpowers-overhaul-p4.md": { count: 18, src: null, merged: null },
  "2026-09-13-osuperpowers-overhaul-p5.md": { count: 19, src: "declared", merged: "declared" },
  "2026-09-13-osuperpowers-overhaul-p6.md": { count: 31, src: "declared", merged: "declared" },
  "2026-09-21-consumer-parity-p1.md": { count: 3, src: "declared", merged: "declared" },
  "2026-09-21-consumer-parity-p2.md": { count: 6, src: "declared", merged: "declared" },
  "2026-09-21-consumer-parity-p3.md": { count: 8, src: "declared", merged: "declared" },
  "2026-09-21-consumer-parity-p4.1.md": { count: 10, src: "declared", merged: "declared" },
  "2026-09-21-consumer-parity-p4.2.md": { count: 12, src: "declared", merged: "declared" },
  "2026-09-21-consumer-parity-p4.3.md": { count: 11, src: "declared", merged: "declared" },
  "2026-09-21-consumer-parity-p4.4.md": { count: 11, src: "declared", merged: "declared" },
  "2026-09-27-pi-harness-p1.md": { count: 4, src: "declared", merged: "declared" },
  "2026-09-27-pi-harness-p2.md": { count: 6, src: "declared", merged: "declared" },
  "2026-09-27-pi-harness-p3.md": { count: 9, src: "declared", merged: "declared" },
  "2026-09-27-pi-harness-p4.md": { count: 8, src: "declared", merged: "declared" },
  "2026-09-27-pi-harness-p5.md": { count: 9, src: "declared", merged: "declared" },
  "2026-09-28-cdd-review-contract-fix.md": { count: 9, src: "declared", merged: "declared" },
  "2026-10-02-doc-architecture-v2-p1.md": { count: 7, src: "declared", merged: "declared" },
  "2026-10-02-doc-architecture-v2-p2.md": { count: 7, src: "declared", merged: "declared" },
};

const SPEC_GOLDEN: Record<string, { version: string | null; green: boolean }> = {
  "2026-09-13-osuperpowers-overhaul-p1-design.md": { version: "v1.0", green: false },
  "2026-09-13-osuperpowers-overhaul-p2-design.md": { version: "v1.0", green: false },
  "2026-09-13-osuperpowers-overhaul-p3-design.md": { version: "v1.2", green: false },
  "2026-09-13-osuperpowers-overhaul-p4-design.md": { version: "v1.0", green: false },
  "2026-09-13-osuperpowers-overhaul-p5-design.md": { version: "v1.0", green: false },
  "2026-09-13-osuperpowers-overhaul-p6-design.md": { version: "v1.21", green: false },
  "2026-09-21-consumer-parity-p1-design.md": { version: "v1.1", green: false },
  "2026-09-21-consumer-parity-p2-design.md": { version: "v1.4", green: false },
  "2026-09-21-consumer-parity-p3-design.md": { version: "v1.2", green: false },
  "2026-09-21-consumer-parity-p4.1-design.md": { version: "v1.5", green: false },
  "2026-09-21-consumer-parity-p4.2-design.md": { version: "v1.2", green: false },
  "2026-09-21-consumer-parity-p4.3-design.md": { version: "v1.7", green: false },
  "2026-09-21-consumer-parity-p4.4-design.md": { version: "v1.9", green: false },
  "2026-09-27-pi-harness-p1-design.md": { version: "v1.5", green: true },
  "2026-09-27-pi-harness-p2-design.md": { version: "v1.2", green: true },
  "2026-09-27-pi-harness-p3-design.md": { version: "v1.6", green: true },
  "2026-09-27-pi-harness-p4-design.md": { version: "v1.6", green: true },
  "2026-09-27-pi-harness-p5-design.md": { version: "v1.3", green: true },
  "2026-10-02-doc-architecture-v2-p1-design.md": { version: "v1.1", green: true },
  "2026-10-02-doc-architecture-v2-p2-design.md": { version: "v1.1", green: true },
};

// The pre-rewire extractor files — the negative grep scope (see the projection-single-source suite).
const EXTRACTOR_FILES = [
  "documents/doctypes/plan.ts",
  "documents/doctypes/shared.ts",
  "documents/doctypes/body/constraints.ts",
  "render/brief.ts",
];

describe("legacy six-section spec — the dual-read spec face", () => {
  it("detect + validate + parse all green (the P1-era shape, no `## Design` marker)", () => {
    expect(validator.detectDocKind(LEGACY_SPEC)).toBe("spec");
    expect(specType().validate(LEGACY_SPEC, { root: REPO_ROOT })).toEqual([]);
    expect(specType().parse(LEGACY_SPEC, { root: REPO_ROOT })).toBe("v1.0");
    // The six-section fixture carries no `## Design` — the new-skeleton assertions never fire.
    expect(readFileSync(LEGACY_SPEC, "utf8")).not.toMatch(/\n## Design\s*\n/);
  });

  it("legacy constraint read kept — no merged read ever applies (specConstraintsOf null, the Section 1 prose untouched)", () => {
    // The old read path is the doc's own `## Section 1: Constraints pointer` prose — the merge
    // machine (specConstraintsOf) returns null for a legacy spec, so the constraint presentation
    // does not change because of the spec-side merge surface.
    expect(validator.specConstraintsOf(LEGACY_SPEC, REPO_ROOT)).toBeNull();
    const content = readFileSync(LEGACY_SPEC, "utf8");
    expect(content).toContain("## Section 1: Constraints pointer");
    expect(content).toMatch(/仅指针/);
    // No merged-inherited presentation is ever injected into the legacy read.
    expect(content).not.toContain("Parent overall — inherited");
  });
});

describe("Form B plan — the dual-read plan face", () => {
  it("detect + validate + parse all green (prose-pointer deltas + legacy `- **Do**:` bodies)", () => {
    expect(validator.detectDocKind(FORM_B_PLAN)).toBe("plan");
    expect(planType().validate(FORM_B_PLAN, { root: REPO_ROOT })).toEqual([]);
    const parsed = planType().parse(FORM_B_PLAN, { root: REPO_ROOT }) as PlanParse;
    expect(parsed.taskNumbers).toEqual([1, 2]);
    // The legacy block (no data-field markers) parses no Task record — the brief still renders
    // from the section text (the legacy face is left untouched).
    expect(planType().tasksFromPlan(FORM_B_PLAN)).toEqual([]);
  });

  it("Form B constraints extraction kept — the prose-pointer deltas in canonical order, unmerged", () => {
    const content = readFileSync(FORM_B_PLAN, "utf8");
    const expected = [
      "**口径**：mouthpiece constraint",
      "",
      "**commit 边界机制（本 program 全 phase 生效）**：commit-boundary constraint",
      "",
      "**Flow Atomicity**：flow-atomicity constraint",
      "",
      "**顺序原则（spec §2.4）**：ordering-principle constraint",
      "",
    ].join("\n");
    expect(planType().extractPlanConstraints(content)).toBe(expected);
    expect(validator.planConstraintsOf(FORM_B_PLAN, REPO_ROOT)).toBe(expected);
  });

  it("brief extraction keeps slicing legacy `### Task N:` sections (both tasks, one base)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dual-read-brief-"));
    const out = path.join(dir, "tasks-1,2-brief.md");
    try {
      await new BriefRenderer().render(FORM_B_PLAN, [1, 2], out, REPO_ROOT);
      const text = readFileSync(out, "utf8");
      expect(text).toMatch(/^### Task 1: keep the legacy read/m);
      expect(text).toMatch(/^### Task 2: keep the task-heading parse/m);
      expect(text).toMatch(/^TASK_BASE: [0-9a-f]{40}$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("extractor projection single-source — the three parse families derive from the plan body", () => {
  it("the projected slice set carries the task-heading (number-capturing) + Form-A heading + the Form-B anchor family", () => {
    const slices = planBody.projectSlicePatterns();
    // `### Task N:` — the number captured (taskNumbersFromPlan's read face).
    expect(slices.taskHeading.source).toBe("^### Task (\\d+):");
    const m = slices.taskHeading.exec("### Task 7: x");
    expect(m?.[1]).toBe("7");
    expect(slices.taskHeading.test("## Task Groups")).toBe(false);
    // `## Constraints` — the Form-A section heading (the shared extraction's injected pattern).
    expect(slices.constraintsHeading.test("## Constraints")).toBe(true);
    expect(slices.constraintsHeading.test("## Global Constraints")).toBe(false);
    // The Form-B anchor family — `formBAnchor1..4` in canonical declaration order, each scanning
    // its anchor's heading with the optional qualifier slot.
    expect(slices.formBAnchor1.test("**口径**：prose")).toBe(true);
    expect(slices.formBAnchor1.test("**commit 边界机制**：prose")).toBe(false);
    expect(slices.formBAnchor2.test("**commit 边界机制（本 program 全 phase 生效）**：prose")).toBe(
      true,
    );
    expect(slices.formBAnchor3.test("**Flow Atomicity**：prose")).toBe(true);
    expect(slices.formBAnchor4.test("**顺序原则（spec §2.4）**：prose")).toBe(true);
  });

  it("one anchor declaration feeds the shape enum, the DOC_TOKENS tokens and the parse family (zero duplicated literals)", () => {
    // Walk the projected shape's `constraints.formBProseAnchors.anchors.items` enum leaf (the same
    // properties-first walk tokens.ts uses).
    const node = (props: readonly string[]): Record<string, unknown> => {
      let cur = planBody.projectSchemaShape() as unknown as Record<string, unknown>;
      for (const key of props) {
        const viaProps = (cur.properties as Record<string, unknown> | undefined)?.[key];
        cur = (viaProps ?? cur[key]) as Record<string, unknown>;
      }
      return cur;
    };
    const enumTokens = node(["constraints", "formBProseAnchors", "anchors", "items"])
      .enum as readonly string[];
    expect(enumTokens).toEqual(DOC_TOKENS.proseAnchorTokens);
    // The four projected anchor slices match the four declared tokens, in order.
    for (let i = 0; i < enumTokens.length; i++) {
      expect(planBody.projectSlicePatterns()[`formBAnchor${i + 1}`].test(enumTokens[i]!)).toBe(
        true,
      );
    }
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
    // The anchor literals are written exactly once in the engine (the PLAN_FORM_B_ANCHOR_TOKENS
    // const) — deriveDocTokens + the parse family read from it, never re-type it. The only
    // non-leaf mention is the dispatch/task.ts derivation COMMENT (a `:// `-prefixed doc note,
    // never code).
    const anchorHits = execSync(
      `grep -rnF --include="*.ts" '**口径**：' "${REPO_ROOT}/packages/cdd-engine/src" --exclude-dir="__tests__" || true`,
      { encoding: "utf8", shell: "/bin/zsh" },
    );
    const nonLeafHits = anchorHits
      .split("\n")
      .filter(Boolean)
      .filter((l) => !l.includes("plan-body.ts") && !/:\d+:\/\//.test(l));
    expect(nonLeafHits).toEqual([]);
  });
});

describe("full-tree zero-regression — the entire docs/kairos tree (zero changes, zero exclusions)", () => {
  it("the actual tree composition: 21 plans + 20 design specs + 4 overalls + 1 one-off spec = 46 files", () => {
    const plans = readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"));
    const specs = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".md"));
    const designs = specs.filter((f) => f.endsWith("-design.md"));
    const overalls = specs.filter((f) => f.endsWith("-overall.md"));
    const oneOffs = specs.filter((f) => !f.endsWith("-design.md") && !f.endsWith("-overall.md"));
    expect(plans).toHaveLength(21);
    expect(designs).toHaveLength(20);
    expect(overalls).toHaveLength(4);
    expect(oneOffs).toEqual(["2026-09-28-cdd-review-contract-fix.md"]);
  });

  it("every plan: detect + parse + task-heading + constraints-extraction + brief-slice outcomes are the frozen golden (contiguous 1..N)", () => {
    for (const file of readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"))) {
      const planPath = path.join(PLANS_DIR, file);
      const golden = PLAN_GOLDEN[file];
      expect(golden, `${file} must be in the tree golden`).toBeDefined();
      // detect + parse (no throw) + contiguous task numbers == the golden count.
      expect(validator.detectDocKind(planPath), file).toBe("plan");
      const nums = planType().taskNumbersFromPlan(planPath);
      expect(nums.length, file).toBe(golden.count);
      expect(
        nums.every((n, i) => n === i + 1),
        `${file} headings must be contiguous 1..N`,
      ).toBe(true);
      expect(
        (planType().parse(planPath, { root: REPO_ROOT }) as PlanParse).taskNumbers,
        file,
      ).toEqual(nums);
      // The constraints extraction + merged read keep their golden outcome (legacy Form B reads
      // unmerged; the four `## Global Constraints`-era plans keep declaring no source — the
      // pre-existing state the rewire must not change).
      const content = readFileSync(planPath, "utf8");
      const src = planType().extractPlanConstraints(content) === null ? null : "declared";
      expect(src, `${file} constraints source`).toBe(golden.src);
      expect(
        validator.planConstraintsOf(planPath, REPO_ROOT) === null ? null : "declared",
        `${file} merged read`,
      ).toBe(golden.merged);
      // The brief's exact-header slice match works for every task (the scan + the header both
      // resolve — the same surface BriefRenderer runs per dispatch).
      const lines = content.split("\n");
      for (const n of nums) {
        expect(
          lines.some((l) => l.startsWith(DOC_TOKENS.taskHeadingFor(n))),
          `${file} Task ${n} heading must be brief-sliceable`,
        ).toBe(true);
      }
    }
  });

  it("every design spec: detect + parse + validate outcomes are the frozen golden (green set unchanged)", () => {
    for (const file of readdirSync(SPECS_DIR).filter((f) => f.endsWith("-design.md"))) {
      const specPath = path.join(SPECS_DIR, file);
      const golden = SPEC_GOLDEN[file];
      expect(golden, `${file} must be in the golden`).toBeDefined();
      expect(validator.detectDocKind(specPath), file).toBe("spec");
      expect(specType().parse(specPath, { root: REPO_ROOT }), file).toBe(golden.version);
      const failures = specType().validate(specPath, { root: REPO_ROOT });
      // Every design spec's full-audit outcome is byte-frozen: the 7 green specs (pi-harness p1–p5
      // + this program's p1/p2 — the `自身旧形` docs) stay green; the 13 historical specs carry
      // pre-existing four-table claim results that T5 must not touch.
      expect(failures.length === 0, `${file} validate outcome`).toBe(golden.green);
    }
  });

  it("the overalls detect as the overall kind (the enclosing four-table chain stays enumerable)", () => {
    for (const file of readdirSync(SPECS_DIR).filter((f) => f.endsWith("-overall.md"))) {
      expect(validator.detectDocKind(path.join(SPECS_DIR, file)), file).toBe("overall");
    }
  });

  it("the one-off spec (2026-09-28-cdd-review-contract-fix.md) is the sole pre-existing non-detecting tree doc — documented, not silently excluded", () => {
    // The one-off single-spec (neither a `-design.md` phase spec nor a plan) matches no registered
    // doc type — the pre-T5 state, kept out of the dual-read coverage by shape, not by exclusion.
    const oneOff = path.join(SPECS_DIR, "2026-09-28-cdd-review-contract-fix.md");
    expect(() => validator.detectDocKind(oneOff)).toThrow(/no registered doc type/);
  });
});
