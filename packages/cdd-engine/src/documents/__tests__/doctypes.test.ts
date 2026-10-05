// packages/cdd-engine/src/documents/__tests__/doctypes.test.ts — the three concrete doc types
// (P1 T2; plan §T2). Covers the T2 deliverable
// surfaces: detect determination (per-kind positive/negative + the ordered-scan multi-match /
// zero-hit material — the facade's T6 ambiguity / unknown-doc-kind faces land in
// rules/__tests__/documents.test.ts; including the negative that a plan/spec doc carrying the
// `**Version**` line but no four-table header is NOT an overall), the registered-trio wiring (route
// metadata + lifecycle facts — S4, and the S3 parentChain walk), the parse surfaces (the baseline
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

/** The T6 single-match judgment over the ordered detect surface (overall → plan → spec): exactly
 *  one registered type detecting resolves its kind (the facade's contract — rules/documents.ts
 *  detectDocKind); zero matches resolve null (the facade's unknown-doc-kind throw). Multiple matches
 *  are the facade's ambiguity material — asserted per-kind in the both-features tests below. */
function detectKind(fileName: string, content: string): DocKind | null {
  const matches = docTypeRegistry.all().filter((t) => t.detect(fileName, content));
  return matches.length === 1 ? matches[0].kind : null;
}

/** The T6 multi-match surface — every registered type that detects (the ambiguous-entry material
 *  the facade's all() scan reports). */
function detectMatches(fileName: string, content: string): DocKind[] {
  return docTypeRegistry
    .all()
    .filter((t) => t.detect(fileName, content))
    .map((t) => t.kind);
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

  it("both features: a Phase-inventory header WITH task headings registers overall AND plan (the facade's ambiguous-entry material — the dispatch never first-hits)", () => {
    expect(detectMatches("both.md", `${FOUR_TABLE_HEADER}\n\n${TASK_HEADINGS}`)).toEqual([
      "overall",
      "plan",
    ]);
  });

  it("both features: a `-design.md` with the `**Version**` line AND task headings registers plan AND spec (the facade's ambiguous-entry material)", () => {
    expect(detectMatches("mixed-design.md", `${VERSION_LINE}\n${TASK_HEADINGS}`)).toEqual([
      "plan",
      "spec",
    ]);
  });

  it("zero-hit material: every kind misses → no matching kind (the facade's unknown-doc-kind throw face)", () => {
    expect(detectKind("readme.md", "# no doc-structure features")).toBeNull();
    expect(detectMatches("readme.md", "# no doc-structure features")).toEqual([]);
  });
});

describe("route metadata + lifecycle facts (S4 — the dispatched type-specific lifecycle handling)", () => {
  it("plan carries the routed review/fix face (`plan` / `--plan`) and its lifecycle renders the upstream `**Spec:**` REVIEW_PLAN_LINE", () => {
    const planType = docTypeRegistry.resolve("plan");
    expect(planType.route).toEqual({ reviewType: "plan", argKey: "plan", targetFlag: "--plan" });
    expect(
      planType.lifecycle(pi.plan, {
        root: REPO_ROOT,
        upstreamSpec: "docs/kairos/specs/plan-design.md",
      }),
    ).toEqual({ reviewPlanLine: "**Spec:** docs/kairos/specs/plan-design.md" });
    // no upstream reference supplied → the plan review carries no REVIEW_PLAN_LINE (the D11
    // optional `--spec` face).
    expect(planType.lifecycle(pi.plan, { root: REPO_ROOT })).toEqual({ reviewPlanLine: "" });
  });

  it("phase-spec carries the routed review/fix face (`spec` / `--spec`) and its lifecycle renders NO upstream reference (the reviewed spec is the target)", () => {
    const specType = docTypeRegistry.resolve("spec");
    expect(specType.route).toEqual({ reviewType: "spec", argKey: "spec", targetFlag: "--spec" });
    expect(
      specType.lifecycle(pi.spec, {
        root: REPO_ROOT,
        upstreamSpec: "docs/kairos/specs/other-design.md",
      }),
    ).toEqual({ reviewPlanLine: "" });
    expect(specType.lifecycle(pi.spec, { root: REPO_ROOT })).toEqual({ reviewPlanLine: "" });
  });

  it("overall is the chain root — no routed review/fix face (null across the route surface + null lifecycle)", () => {
    const overallType = docTypeRegistry.resolve("overall");
    expect(overallType.route).toEqual({ reviewType: null, argKey: null, targetFlag: null });
    expect(overallType.lifecycle(pi.overall, { root: REPO_ROOT })).toBeNull();
  });
});

describe("bodyView domain (T5 — the template-contract split surface migrated to the doc types)", () => {
  it("spec/plan carry the docs-family discrimination (the migrated DOCS_FORMATS member set)", () => {
    for (const kind of ["spec", "plan"] as const) {
      const family = docTypeRegistry.resolve(kind).bodyView.docFamily;
      expect(family.label).toBe("docs");
      expect(family.formats).toContain("RETURN_JSON");
      expect(family.formats).toContain("DOCS_FIX");
    }
  });

  it("spec/plan share the single docs-family value (DOCS_FAMILY single-source, shared by reference — no duplicated literal)", () => {
    expect(docTypeRegistry.resolve("spec").bodyView.docFamily).toBe(
      docTypeRegistry.resolve("plan").bodyView.docFamily,
    );
  });

  it("overall carries no body forms — zero discriminating formats and no review face", () => {
    const overall = docTypeRegistry.resolve("overall").bodyView;
    expect(overall.docFamily.formats).toEqual([]);
    expect(overall.docFamily.label).toBe("task");
    expect(overall.reviews).toBeNull();
  });

  it("DOCS_FORMATS member determination (positive/negative)", () => {
    const docsFormats = new Set(docTypeRegistry.all().flatMap((t) => t.bodyView.docFamily.formats));
    for (const member of ["RETURN_JSON", "DOCS_FIX"]) {
      expect(docsFormats.has(member)).toBe(true);
    }
    for (const nonMember of ["RETURN_STDOUT_BLOCK", "NOPE", ""]) {
      expect(docsFormats.has(nonMember)).toBe(false);
    }
  });

  it("spec/plan bodyView reviews carry the migrated axesGuide/lensEnum (the reviews.{spec,plan} content)", () => {
    const spec = docTypeRegistry.resolve("spec").bodyView.reviews!;
    expect(spec.lensEnum).toEqual(["completeness", "consistency", "clarity"]);
    expect(spec.axesGuide).toContain("Follow URC: single-cycle");
    const plan = docTypeRegistry.resolve("plan").bodyView.reviews!;
    expect(plan.lensEnum).toEqual(["completeness", "decomposition", "buildability"]);
    expect(plan.axesGuide).toContain("Follow URC: spec coverage");
    expect(plan.axesGuide).toContain("changed-surface reasonableness");
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

describe("validate on the current doc tree (the pi-harness sample trio — the migration-queue state)", () => {
  // The six-section design-spec family was migrated to the three-truth skeleton by T5: the
  // pi-harness p5 design now validates clean (its clean parent chain). The legacy PLAN face stays
  // pending-migration (its parse surfaces stay processable — see dual-read.test.ts — its validate
  // BLOCKS, see tree-migration.test.ts). The overall self-audit stays clean (the four-table
  // contract is unaffected by the runtime retirement / the spec transcription).
  it("overall self-audit: 2026-09-27-pi-harness-overall.md audits clean", () => {
    expect(docTypeRegistry.resolve("overall").validate(pi.overall, { root: REPO_ROOT })).toEqual(
      [],
    );
  });

  it("phase-spec: 2026-09-27-pi-harness-p5-design.md validates clean after T5 (the three-truth skeleton — the clean pi-harness parent chain)", () => {
    expect(docTypeRegistry.resolve("spec").validate(pi.spec, { root: REPO_ROOT })).toEqual([]);
  });

  it("plan: 2026-09-27-pi-harness-p5.md is pending-migration (legacy task blocks — the single-form record face BLOCKS)", () => {
    const failures = docTypeRegistry.resolve("plan").validate(pi.plan, { root: REPO_ROOT });
    expect(failures.length).toBeGreaterThan(0);
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

  it("plan parse aggregates the phase-id + task-heading extractors", () => {
    const parsed = docTypeRegistry.resolve("plan").parse(pi.plan, {
      root: REPO_ROOT,
    }) as PlanParse;
    expect(parsed.phaseId).toBe("P5");
    expect(parsed.dispatchPhaseId).toBe("P5");
    expect(parsed.taskNumbers.length).toBeGreaterThan(0);
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
