// packages/cdd-engine/src/documents/doctypes/body/__tests__/constraints-inheritance.test.ts —
// the constraint-inheritance delta-only merge machine (P2 T4; plan §T4 · design C4): the shared
// merge face (body/constraints.ts — mergeParentConstraints / specConstraintsOf / the constitutional
// overallConstraintsOf read) + the two doc-side validate/read wirings. Covers the T4 deliverable
// surface:
//   - the pure merge: own delta ∪ parent conventions (the constitution auto-applies), delta-only → delta, both
//     empty → null;
//   - the plan side: planConstraintsOf (Form-A delta + the Class-A `**Spec:**` → Class-B Parent
//     program chain → the overall's `**Constraints**:` block) and the materializer's merged
//     plan-constraints.md (the constitution auto-applies — materialize evidence);
//   - the spec side: specConstraintsOf (the spec's `## Constraints` delta + its Parent program
//     chain); a spec without the literal `## Constraints` section → null (the undeclared face);
//   - the Form-B retirement: Form B prose-anchor declarations are no longer a Constraints source —
//     a plan carrying them fails validate (source undeclared, the single-form grammar);
//   - the inheritance-point linkage: a spec declaring `## Constraints` whose Class-B Parent program
//     pointer does not resolve fails validate.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ConstraintsSourceUndeclared,
  materializePlanConstraints,
} from "../../../../dispatch/task.ts";
import { DocumentsValidator } from "../../../../rules/documents.ts";
import { docTypeRegistry } from "../../../registry.ts";
import { mergeParentConstraints, overallConstraintsOf } from "../constraints.ts";

const validator = new DocumentsValidator();

// ---- the parent overall — a valid overall header carrying the constitutional `**Constraints**:`
// block (the block + the four-table kernel the spec validate re-audits as the parent chain). ----
const OVERALL = [
  "- **Version**: v1.0 · 2026-09-21",
  "- **Status**: Draft",
  "- **Author**: test",
  "- **Constraints**:",
  "  - **破坏性变更授权**: constitutional rule one",
  "  - constitutional rule two",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "|---|---|---|---|---|---|---|",
  "| P1 | phase one | [Pending] | Pending | | none |",
  "",
  "## Change history",
  "",
  "| Version | date | summary |",
  "|---|---|---|",
  "| v1.0 | 2026-09-21 | Initial |",
  "",
].join("\n");

// The new-skeleton spec — the three-truth skeleton + the `## Constraints` delta + the Class-B
// Parent program pointer (the inheritance point).
const NEW_SPEC = [
  "- **Version**: v1.0 · 2026-09-21",
  "- **Status**: Draft",
  "- **Author**: test",
  "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
  "- **Depends on**: P1",
  "",
  "## Design",
  "",
  "design body",
  "",
  "### Acceptance criteria",
  "",
  "- `criterion one`",
  "",
  "## Constraints",
  "",
  "- spec own delta constraint one",
  "- spec own delta constraint two",
  "",
].join("\n");

// Legacy six-section spec — the P1-era shape; it carries no literal `## Constraints` section, so
// the spec merged read has no delta to merge (specConstraintsOf returns null — the undeclared
// face). The three-truth skeleton validation is what such a spec fails, never this read.
const LEGACY_SPEC = [
  "- **Version**: v1.0 · 2026-09-21",
  "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
  "",
  "## Section 1: Constraints pointer",
  "",
  "Cross-phase conventions live in the parent overall v1.0 — pointer only.",
  "",
].join("\n");

// The new-shape plan — Form-A `## Constraints` delta + the Class-A `**Spec:**` chain.
const NEW_PLAN = [
  "# Plan",
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "**Spec:** [plan-design.md](docs/kairos/specs/plan-design.md)",
  "",
  "## Constraints",
  "",
  "### 口径",
  "",
  "- the plan's own delta constraint",
  "",
  "### Flow Atomicity",
  "",
  "- plan delta two",
  "",
  "### Task 1: x",
  "",
  "- **Objective**: task one",
  "- **Steps**:",
  "  1. implement — checkable: done",
  "- **Acceptance**:",
  "  - done",
  "",
].join("\n");

/** Build a self-contained three-doc chain: the parent overall + the new-shape spec + the plan,
 *  in the canonical docs layout (the root the link targets resolve against). */
function writeChain(rootContent: string, planContent: string, specContent: string) {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-constraints-"));
  const specsDir = path.join(root, "docs", "kairos", "specs");
  const plansDir = path.join(root, "docs", "kairos", "plans");
  mkdirSync(specsDir, { recursive: true });
  mkdirSync(plansDir, { recursive: true });
  const overall = path.join(specsDir, "plan-overall.md");
  const spec = path.join(specsDir, "plan-design.md");
  const plan = path.join(plansDir, "plan.md");
  writeFileSync(overall, rootContent, "utf8");
  writeFileSync(spec, specContent, "utf8");
  writeFileSync(plan, planContent, "utf8");
  return { root, overall, spec, plan };
}

function tmpFile(content: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-constraints-doc-"));
  const p = path.join(dir, "doc.md");
  writeFileSync(p, content, "utf8");
  return p;
}

describe("mergeParentConstraints — the pure presentation join (the constitution auto-applies)", () => {
  it("own delta + parent conventions → the merged presentation carries both surfaces verbatim", () => {
    const merged = mergeParentConstraints({
      ownDelta: "## Constraints\n\n- plan delta\n",
      parentConstraints: "- constitutional rule one\n",
    });
    expect(merged).toBe(
      [
        "## Constraints",
        "",
        "- plan delta",
        "",
        "---",
        "",
        "### Parent overall — inherited (auto-applies)",
        "",
        "- constitutional rule one",
        "",
      ].join("\n"),
    );
  });

  it("delta-only (no parent conventions) → the own delta alone, no inherited marker (the legacy Form-A materialize face)", () => {
    const merged = mergeParentConstraints({
      ownDelta: "## Constraints\n\n### 口径\n-mouthpiece\n",
      parentConstraints: null,
    });
    expect(merged).toBe("## Constraints\n\n### 口径\n-mouthpiece\n");
    expect(merged).not.toContain("Parent overall — inherited");
  });

  it("both surfaces empty → null (the undeclared face)", () => {
    expect(mergeParentConstraints({ ownDelta: null, parentConstraints: null })).toBeNull();
    expect(mergeParentConstraints({ ownDelta: "   ", parentConstraints: " " })).toBeNull();
  });
});

describe("overallConstraintsOf — the constitutional block read", () => {
  it("the overall's `**Constraints**:` block bullets, normalized to top-level `- ` form (marker stripped)", () => {
    expect(overallConstraintsOf(OVERALL)).toBe(
      "- **破坏性变更授权**: constitutional rule one\n- constitutional rule two\n",
    );
  });

  it("an overall with no constraints block → null", () => {
    expect(overallConstraintsOf("# No constraints\n\n## Phase inventory\n")).toBeNull();
  });
});

describe("planConstraintsOf — the plan's merged read (Form-A delta + the inherited constitution)", () => {
  it("Form A: own `## Constraints` delta + the parent overall's conventions (auto-applies) via the Class-A/B chain", () => {
    const chain = writeChain(OVERALL, NEW_PLAN, NEW_SPEC);
    try {
      const merged = validator.planConstraintsOf(chain.plan, chain.root);
      expect(merged).not.toBeNull();
      expect(merged!).toContain("## Constraints");
      // the plan's own delta surfaces verbatim
      expect(merged!).toContain("the plan's own delta constraint");
      expect(merged!).toContain("plan delta two");
      // the constitutional block auto-applies under the inherited marker
      expect(merged!).toContain("### Parent overall — inherited (auto-applies)");
      expect(merged!).toContain("constitutional rule one");
      expect(merged!).toContain("constitutional rule two");
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });

  it("Form A chain truncation (unresolvable Spec) degrades to the delta-only presentation", () => {
    const plan = tmpFile(NEW_PLAN.replace("plan-design.md", "missing-design.md"));
    try {
      const merged = validator.planConstraintsOf(plan, path.dirname(path.dirname(plan)));
      expect(merged).not.toBeNull();
      expect(merged!).toContain("the plan's own delta constraint");
      expect(merged!).not.toContain("Parent overall — inherited");
    } finally {
      rmSync(path.dirname(plan), { recursive: true, force: true });
    }
  });

  it("Form B (retired): a prose-anchor plan declares no `## Constraints` source → the merged read is null (no fallback)", () => {
    const plan = tmpFile(
      [
        "# Plan",
        "",
        "**Spec:** [plan-design.md](docs/kairos/specs/plan-design.md)",
        "",
        "**口径**：mouthpiece constraint",
        "",
        "**顺序原则**：ordering-principle constraint",
        "",
        "---",
        "",
        "### Task 1: x",
        "body",
        "",
      ].join("\n"),
    );
    try {
      // The literal `## Constraints` section is the plan's single constraint source — the retired
      // prose-pointer read never applies.
      expect(validator.planConstraintsOf(plan, path.dirname(path.dirname(plan)))).toBeNull();
    } finally {
      rmSync(path.dirname(plan), { recursive: true, force: true });
    }
  });
});

describe("materializePlanConstraints — the merged plan-constraints.md (the constitution auto-applies — materialize evidence)", () => {
  it("a Form-A plan materializes the merged presentation (own delta + the inherited constitution)", () => {
    const chain = writeChain(OVERALL, NEW_PLAN, NEW_SPEC);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-constraints-ws-"));
    try {
      const outPath = materializePlanConstraints(chain.plan, ws, chain.root);
      const text = readFileSync(outPath, "utf8");
      // the deterministic header stays
      expect(text).toMatch(/plan hash: [0-9a-f]{64}/);
      // the materialized content = the inherited constitution + the own delta, merged
      expect(text).toContain("## Constraints");
      expect(text).toContain("the plan's own delta constraint");
      expect(text).toContain("### Parent overall — inherited (auto-applies)");
      expect(text).toContain("constitutional rule one");
      expect(text).toContain("constitutional rule two");
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
      rmSync(ws, { recursive: true, force: true });
    }
  });

  it("a Form B prose-anchor plan cannot materialize — the retired face throws ConstraintsSourceUndeclared", () => {
    const plan = tmpFile(
      [
        "# Plan",
        "",
        "**Spec:** [plan-design.md](docs/kairos/specs/plan-design.md)",
        "",
        "**口径**：mouthpiece constraint",
        "",
        "**顺序原则**：ordering-principle constraint",
        "",
        "---",
        "",
        "### Task 1: x",
        "body",
        "",
      ].join("\n"),
    );
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-constraints-ws-"));
    try {
      expect(() => materializePlanConstraints(plan, ws, path.dirname(path.dirname(plan)))).toThrow(
        ConstraintsSourceUndeclared,
      );
      expect(existsSync(path.join(ws, "plan-constraints.md"))).toBe(false);
    } finally {
      rmSync(path.dirname(plan), { recursive: true, force: true });
      rmSync(ws, { recursive: true, force: true });
    }
  });
});

describe("specConstraintsOf — the spec's merged read along the Class-B chain", () => {
  it("new-skeleton spec: `## Constraints` delta + the parent overall's conventions via `**Parent program**`", () => {
    const chain = writeChain(OVERALL, NEW_PLAN, NEW_SPEC);
    try {
      const merged = validator.specConstraintsOf(chain.spec, chain.root);
      expect(merged).not.toBeNull();
      expect(merged!).toContain("spec own delta constraint one");
      expect(merged!).toContain("spec own delta constraint two");
      expect(merged!).toContain("### Parent overall — inherited (auto-applies)");
      expect(merged!).toContain("constitutional rule one");
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });

  it("a spec without the literal `## Constraints` section has no delta to merge → null (the undeclared face)", () => {
    const chain = writeChain(OVERALL, NEW_PLAN, LEGACY_SPEC);
    try {
      expect(validator.specConstraintsOf(chain.spec, chain.root)).toBeNull();
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });
});

describe("the Form-B retirement — prose-anchor declarations are no longer a Constraints source", () => {
  it("a plan declaring Form B prose anchors (no `## Constraints`) → validate fails: source undeclared (the single-form grammar)", () => {
    const plan = tmpFile(
      [
        "# Plan",
        "",
        "**Spec:** [plan-design.md](docs/kairos/specs/plan-design.md)",
        "",
        "**口径**：prose pointer used by a plan",
        "",
        "### Task 1: x",
        "",
        "- **Objective**: objective one",
        "- **Steps**:",
        "  1. step one — checkable: pass",
        "- **Acceptance**:",
        "  - done",
        "",
      ].join("\n"),
    );
    try {
      const failures = validator.validatePlanContract(plan);
      const source = failures.find((f) => f.field === "Constraints source");
      expect(source).toBeDefined();
      expect(source!.missing).toMatch(/declares no Constraints source/);
      expect(source!.fix).toContain("## Constraints");
    } finally {
      rmSync(path.dirname(plan), { recursive: true, force: true });
    }
  });

  it("a legacy Form B prose-anchor plan → BLOCK (pending-migration): the anchors no longer declare any source", () => {
    const plan = tmpFile(
      [
        "# Plan",
        "",
        "**Spec:** [plan-design.md](docs/kairos/specs/plan-design.md)",
        "",
        "**口径**：mouthpiece constraint",
        "",
        "**commit 边界机制**：commit-boundary constraint",
        "",
        "**Flow Atomicity**：flow-atomicity constraint",
        "",
        "**顺序原则**：ordering-principle constraint",
        "",
        "---",
        "",
        "### Task 1: x",
        "body",
        "",
      ].join("\n"),
    );
    try {
      const failures = validator.validatePlanContract(plan);
      expect(failures.some((f) => f.field === "Constraints source")).toBe(true);
    } finally {
      rmSync(path.dirname(plan), { recursive: true, force: true });
    }
  });

  it("a Form-A plan (with `## Constraints`) carries no Form-B message — failures come from the data-shaped record face, never a Form-B prohibition", () => {
    const plan = tmpFile(
      [
        "# Plan",
        "",
        "**Spec:** [plan-design.md](docs/kairos/specs/plan-design.md)",
        "",
        "## Constraints",
        "",
        "- boundary one",
        "- boundary two",
        "",
        "### Task 1: x",
        "",
        "- **Objective**: task one",
        "- **Steps**:",
        "  1. implement — checkable: done",
        "- **Acceptance**:",
        "  - done",
        "",
      ].join("\n"),
    );
    try {
      const failures = validator.validatePlanContract(plan);
      expect(failures.some((f) => /Form B|prose pointer/.test(f.missing))).toBe(false);
      expect(failures).toEqual([]);
    } finally {
      rmSync(path.dirname(plan), { recursive: true, force: true });
    }
  });
});

describe("the inheritance-point linkage — `## Constraints` demands a resolvable Class-B parent", () => {
  it("a spec declaring `## Constraints` whose Parent program resolves → validate green + merged read non-null", () => {
    const chain = writeChain(OVERALL, NEW_PLAN, NEW_SPEC);
    try {
      expect(docTypeRegistry.resolve("spec").validate(chain.spec, { root: chain.root })).toEqual(
        [],
      );
      expect(validator.specConstraintsOf(chain.spec, chain.root)).not.toBeNull();
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });

  it("a spec declaring `## Constraints` whose Parent program pointer cannot resolve → validate fails (the inheritance-point linkage)", () => {
    const broken = NEW_SPEC.replace(
      "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
      "- **Parent program**: [plan-overall.md v1.0](./missing-overall.md)",
    );
    const chain = writeChain(OVERALL, NEW_PLAN, LEGACY_SPEC);
    try {
      const specPath = path.join(chain.root, "docs", "kairos", "specs", "broken-design.md");
      writeFileSync(specPath, broken, "utf8");
      const failures = docTypeRegistry.resolve("spec").validate(specPath, { root: chain.root });
      const linkage = failures.find(
        (f) => f.field === "`**Parent program**`" && /inheritance point/.test(f.missing),
      );
      expect(linkage).toBeDefined();
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });

  it("a six-section spec fails the three-truth skeleton — the legacy no-op is gone (skeleton assertions fire regardless of the parent linkage)", () => {
    const chain = writeChain(OVERALL, NEW_PLAN, LEGACY_SPEC);
    try {
      const failures = docTypeRegistry.resolve("spec").validate(chain.spec, { root: chain.root });
      expect(failures.some((f) => f.field === "`## Design`")).toBe(true);
      expect(failures.some((f) => f.field === "`## Constraints`")).toBe(true);
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });
});
