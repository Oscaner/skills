// packages/cdd-engine/src/documents/__tests__/doctypes.test.ts — the three concrete doc types
// (P1 T2; plan §T2). Covers the T2 deliverable
// surfaces: detect determination (per-kind positive/negative + the fallback scan order overall →
// plan → spec — including the negative that a plan/spec doc carrying the `**Version**` line but no
// four-table header is NOT an overall), the registered-trio wiring (route metadata + lifecycle
// dispatch keys — S4, and the S3 parentChain walk), the parse surfaces (the baseline
// `phaseIdFromPlan` behavior retained; the overall four-table parse; the phase-spec Version-line
// check), and validate against the current doc tree — one existing overall/spec/plan doc each (the
// pi-harness trio) audits clean.

import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DocKind } from "../doctype.ts";
import type { OverallParse } from "../doctypes/overall.ts";
import type { PlanDocType, PlanParse } from "../doctypes/plan.ts";
import { docTypeRegistry } from "../registry.ts";

// The repo root — five levels up from this test file (packages/cdd-engine/src/documents/__tests__/).
const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

const pi = {
  overall: `${REPO_ROOT}/docs/kairos/specs/2026-09-27-pi-harness-overall.md`,
  spec: `${REPO_ROOT}/docs/kairos/specs/2026-09-27-pi-harness-p5-design.md`,
  plan: `${REPO_ROOT}/docs/kairos/plans/2026-09-27-pi-harness-p5.md`,
};

/** The T6 detection scan — the fixed iterating order's first-hit walk (overall → plan → spec). */
function detectKind(fileName: string, content: string): DocKind | null {
  for (const type of docTypeRegistry.all()) {
    if (type.detect(fileName, content)) return type.kind;
  }
  return null;
}

/** The concrete plan doc type — the plan-specific extractor surface (phaseIdFromPlan …) is not on
 *  the abstract face; the tests reach it through the registered concrete type. */
const planType = (): PlanDocType => docTypeRegistry.resolve("plan") as PlanDocType;

const FOUR_TABLE_HEADER =
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |";
const VERSION_LINE = "- **Version**: v1.2 · 2026-09-27";
const TASK_HEADINGS = "### Task 1: x\nbody\n### Task 2: y\n";

describe("doc-type detection (the T6-facing scan surface)", () => {
  it("overall positive: the `-overall.md` basename detects even without the four-table header", () => {
    const type = docTypeRegistry.resolve("overall");
    expect(type.detect("2026-09-27-pi-harness-overall.md", "# plain content")).toBe(true);
    expect(detectKind("2026-09-27-pi-harness-overall.md", "# plain content")).toBe("overall");
  });

  it("overall positive: a Phase-inventory header-open line (`| # | Phase |`) detects regardless of the filename", () => {
    const content = `# Program\n\n${FOUR_TABLE_HEADER}\n| P1 | x | y | z | a | b | none |\n`;
    expect(detectKind("misc.md", content)).toBe("overall");
  });

  it("overall negative: a spec/plan doc with the `**Version**` line but no four-table header is NOT an overall", () => {
    const specDoc = `${VERSION_LINE}\n\n- **Parent program**: [overall.md](x.md)\n`;
    expect(
      docTypeRegistry.resolve("overall").detect("2026-09-27-pi-harness-p5-design.md", specDoc),
    ).toBe(false);
    const planDoc = `${VERSION_LINE}\n\n${TASK_HEADINGS}`;
    expect(docTypeRegistry.resolve("overall").detect("2026-09-27-pi-harness-p5.md", planDoc)).toBe(
      false,
    );
  });

  it("plan positive: `### Task N:` headings detect (the plan feature)", () => {
    expect(detectKind("2026-09-27-pi-harness-p5.md", TASK_HEADINGS)).toBe("plan");
  });

  it("plan negative: no task heading → not a plan", () => {
    expect(docTypeRegistry.resolve("plan").detect("x-plan.md", "# no tasks")).toBe(false);
  });

  it("spec positive: the `-design.md` basename + the `**Version**` line detect", () => {
    expect(detectKind("2026-09-27-pi-harness-p5-design.md", VERSION_LINE)).toBe("spec");
  });

  it("spec negative: a `-design.md` doc without the `**Version**` contract line is not a spec", () => {
    expect(docTypeRegistry.resolve("spec").detect("x-design.md", "# no version")).toBe(false);
  });

  it("fallback order: the four-table header wins over task headings (overall → plan → spec)", () => {
    expect(detectKind("both.md", `${FOUR_TABLE_HEADER}\n\n${TASK_HEADINGS}`)).toBe("overall");
  });

  it("fallback order: task headings win over the spec feature (plan before spec)", () => {
    expect(detectKind("mixed.md", `${VERSION_LINE}\n${TASK_HEADINGS}`)).toBe("plan");
  });

  it("fallback order: every kind misses → null (the T6 zero-hit rejection shape)", () => {
    expect(detectKind("readme.md", "# no doc-structure features")).toBeNull();
  });
});

describe("route metadata + lifecycle dispatch keys (S4)", () => {
  it("plan carries the routed review/fix face (`plan` / `--plan`) and the `-plan` lifecycle key", () => {
    const planType = docTypeRegistry.resolve("plan");
    expect(planType.route).toEqual({ reviewType: "plan", argKey: "plan", targetFlag: "--plan" });
    expect(planType.lifecycle(pi.plan, { root: REPO_ROOT })).toBe("plan");
  });

  it("phase-spec carries the routed review/fix face (`spec` / `--spec`) and the `-spec` lifecycle key", () => {
    const specType = docTypeRegistry.resolve("spec");
    expect(specType.route).toEqual({ reviewType: "spec", argKey: "spec", targetFlag: "--spec" });
    expect(specType.lifecycle(pi.spec, { root: REPO_ROOT })).toBe("spec");
  });

  it("overall is the chain root — no routed review/fix face (null across the route surface)", () => {
    const overallType = docTypeRegistry.resolve("overall");
    expect(overallType.route).toEqual({ reviewType: null, argKey: null, targetFlag: null });
    expect(overallType.lifecycle(pi.overall, { root: REPO_ROOT })).toBeNull();
  });
});

describe("parentChain — the S3 parent-doc walk", () => {
  it("overall resolves to itself (the chain root)", () => {
    expect(docTypeRegistry.resolve("overall").parentChain(pi.overall, REPO_ROOT)).toBe(pi.overall);
  });

  it("phase-spec resolves its Parent program overall", () => {
    expect(docTypeRegistry.resolve("spec").parentChain(pi.spec, REPO_ROOT)).toBe(pi.overall);
  });

  it("plan resolves the `**Spec:**` spec → the spec's Parent program overall", () => {
    expect(docTypeRegistry.resolve("plan").parentChain(pi.plan, REPO_ROOT)).toBe(pi.overall);
  });
});

describe("validate on the current doc tree (the pi-harness sample trio — all clean)", () => {
  it("overall self-audit: 2026-09-27-pi-harness-overall.md audits clean", () => {
    expect(docTypeRegistry.resolve("overall").validate(pi.overall, { root: REPO_ROOT })).toEqual(
      [],
    );
  });

  it("phase-spec: 2026-09-27-pi-harness-p5-design.md audits clean (Version line + parent overall)", () => {
    expect(docTypeRegistry.resolve("spec").validate(pi.spec, { root: REPO_ROOT })).toEqual([]);
  });

  it("plan: 2026-09-27-pi-harness-p5.md audits clean — the full entry walk (plan contract + Class A + spec + parent overall)", () => {
    expect(docTypeRegistry.resolve("plan").validate(pi.plan, { root: REPO_ROOT })).toEqual([]);
  });
});

describe("parse surfaces", () => {
  it("overall parse returns the canonical four-table parse (kernelOk on the live overall)", () => {
    const parsed = docTypeRegistry.resolve("overall").parse(pi.overall, {
      root: REPO_ROOT,
    }) as OverallParse;
    expect(parsed.kernelOk).toBe(true);
    expect(parsed.ids).toContain("P5");
  });

  it("plan parse aggregates the phase-id + task extractors", () => {
    const parsed = docTypeRegistry.resolve("plan").parse(pi.plan, {
      root: REPO_ROOT,
    }) as PlanParse;
    expect(parsed.phaseId).toBe("P5");
    expect(parsed.dispatchPhaseId).toBe("P5");
    expect(parsed.taskNumbers.length).toBeGreaterThan(0);
    // the plan's declared `## Task Groups` section (one merged group 7,8) surfaces verbatim
    expect(parsed.taskGroups.map((g) => g.key())).toEqual(["7,8"]);
  });

  it("phase-spec parse returns the pinned version token (the Version-line check)", () => {
    expect(docTypeRegistry.resolve("spec").parse(pi.spec, { root: REPO_ROOT })).toBe("v1.3");
  });
});

describe("phaseIdFromPlan — the basename-scan behavior retained", () => {
  it("a `…-p5.md` plan yields P5", () => {
    expect(planType().phaseIdFromPlan("/w/plans/2026-09-27-pi-harness-p5.md")).toBe("P5");
  });

  it("a `…-p2.1.md` plan yields P2.1 (never the base P2)", () => {
    expect(planType().phaseIdFromPlan("/w/plans/2026-09-27-pi-harness-p2.1.md")).toBe("P2.1");
  });

  it("a phase-less plan name yields null (fail-open — face ④ skipped)", () => {
    expect(planType().phaseIdFromPlan("/w/plans/plain.md")).toBeNull();
  });
});
