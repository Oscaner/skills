// packages/cdd-engine/src-next/contract/__tests__/lint.test.ts
// T5 reference-lint suite — the WARN pass acceptance surface (design spec §2.3):
//   · the missing-edge suspect scan — a backward `Task N` / `T<N>` prose reference
//     with no matching `- **DependsOn**:` declaration WARNs once per block, while
//     forward / self / unregistered / spec-item / code-span / declared-edge refs
//     stay silent (the positive surface);
//   · the cross-doc observation — the Class-B `**Parent program**` link whose
//     version-stripped label drifts from the target basename WARNs, the canonical
//     `basename v1.21` form stays silent;
//   · the WARN-only gate — the same defective document produces ZERO Contract
//     findings (the lint never feeds the judgment face) and every warning carries
//     the reference-lint shape, never a Finding.
// Fixtures are known-good plan literals parsed through the shared PlanDocType
// instance (the parse-once-reuse discipline — the lint consumes the same parse
// record the dispatch and the graph read).

import { describe, expect, it } from "vitest";
import type { ParsedDoc } from "../doc.ts";
import { docTypeParsers } from "../doc.ts";
import type { DocFs } from "../invariants.ts";
import { Contract } from "../judge.ts";
import { LintPass } from "../lint.ts";

const PLAN_PATH = "docs/kairos/plans/x-p3.md";
const SPEC_PATH = "docs/kairos/specs/x-p3-design.md";

/** The sibling-doc fs a conforming chain resolves into (judge comparisons). */
const GOOD_FS: DocFs = {
  exists: () => true,
  read: () => null,
  list: (dir) =>
    dir.endsWith("/specs") || dir.endsWith("specs")
      ? ["x-overall.md", "x-design.md", "x-p3-design.md"]
      : ["x-p3.md"],
};

/** One rendered `### Task N:` block with all required fields. */
function planTask(
  id: number,
  objective: string,
  dependsOn: string,
  acceptance: readonly string[] = ["done"],
): string[] {
  return [
    `### Task ${id}: task ${id}`,
    `- **Objective**: ${objective}`,
    "- **Files**: file",
    "- **Consumes**: consumes",
    "- **Produces**: produces",
    "- **Steps**:",
    "  - step one",
    "- **Acceptance**:",
    ...acceptance.map((entry) => `  - ${entry}`),
    `- **DependsOn**: ${dependsOn}`,
  ];
}

/** A full canonical plan document over the task blocks — the shared parse fixture. */
function planDoc(
  blocks: readonly string[],
  parent = "[x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
): string {
  return [
    "# Test Plan",
    "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
    `- **Parent program**: ${parent}`,
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks,
  ].join("\n");
}

const lintPass = new LintPass();

function lintPlan(content: string): ReturnType<LintPass["run"]> {
  return lintPass.run({
    docKey: "plan",
    path: PLAN_PATH,
    parsed: parseDoc("plan", content.split("\n")),
  });
}

function lintParsed(
  docKey: "overall" | "plan" | "phaseSpec",
  lines: readonly string[],
): ReturnType<LintPass["run"]> {
  return lintPass.run({ docKey, path: PLAN_PATH, parsed: parseDoc(docKey, lines) });
}

/** The shared parse — the composition root consumers reuse (parse-once discipline). */
const parseDoc = (docKey: "overall" | "plan" | "phaseSpec", lines: readonly string[]): ParsedDoc =>
  docTypeParsers[docKey].parse(lines);

describe("the missing-edge suspect scan (the prose reference surface)", () => {
  it("a backward Task N citation with no matching edge → exactly one WARN per block", () => {
    const warns = lintPlan(
      planDoc([
        ...planTask(1, "task one", "none"),
        ...planTask(2, "task two", "none"),
        ...planTask(3, "extends Task 1", "none"),
      ]),
    );
    expect(warns).toHaveLength(1);
    expect(warns[0]!.field).toBe("Task 3");
    expect(warns[0]!.kind).toBe("reference-lint");
  });

  it("the short T<N> form triggers the same observation", () => {
    const warns = lintPlan(
      planDoc([
        ...planTask(1, "task one", "none"),
        ...planTask(2, "task two", "none"),
        ...planTask(3, "reuses T1", "none"),
      ]),
    );
    expect(warns).toHaveLength(1);
  });

  it("aggregation — multiple suspect references in one block collapse into a single WARN", () => {
    const warns = lintPlan(
      planDoc([
        ...planTask(1, "task one", "none"),
        ...planTask(2, "task two", "none"),
        ...planTask(3, "spans Task 1 and Task 2", "none"),
      ]),
    );
    expect(warns).toHaveLength(1);
  });

  it("per-block granularity — two suspect blocks emit two WARNs", () => {
    const warns = lintPlan(
      planDoc([
        ...planTask(1, "task one", "none"),
        ...planTask(2, "reuses Task 1", "none"),
        ...planTask(3, "reuses Task 1", "none"),
      ]),
    );
    expect(warns).toHaveLength(2);
  });
});

describe("the silent surfaces (positive reference scanning)", () => {
  it("a forward reference and a self reference are never a missing-edge suspicion", () => {
    const warns = lintPlan(
      planDoc([
        ...planTask(1, "continues Task 3", "none"),
        ...planTask(2, "task two", "none"),
        ...planTask(3, "about Task 3 itself", "none"),
      ]),
    );
    expect(warns).toEqual([]);
  });

  it("an unregistered reference (the graph's missing-id class) is never a missing-edge suspicion", () => {
    const warns = lintPlan(
      planDoc([...planTask(1, "task one", "none"), ...planTask(3, "mirrors Task 2", "none")]),
    );
    expect(warns).toEqual([]);
  });

  it("the spec-item word form (T3.1) is excluded — a design-item reference is never a task reference", () => {
    const warns = lintPlan(
      planDoc([
        ...planTask(1, "task one", "none"),
        ...planTask(2, "task two", "none"),
        ...planTask(3, "task three", "none"),
        ...planTask(4, "per T3.1", "none"),
      ]),
    );
    expect(warns).toEqual([]);
  });

  it("a reference inside a code span cites a symbol, never prose intent — `T3` / `Task 1` stay silent", () => {
    const warns = lintPlan(
      planDoc([
        ...planTask(1, "task one", "none"),
        ...planTask(2, "task two", "none"),
        ...planTask(3, "reads `T3` and `Task 1`", "none"),
      ]),
    );
    expect(warns).toEqual([]);
  });

  it("the scan surface is prospective prose — a reference inside Files / Consumes / Steps is never prose intent", () => {
    const content = [
      "# Test Plan",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
      "",
      "### Task 3: task 3",
      "- **Objective**: task three",
      "- **Files**:",
      "  - src/Task 1 seam",
      "- **Consumes**: T1 骨架 · T2 登记表",
      "- **Produces**: produces",
      "- **Steps**:",
      "  - 1. wire the T1 seam — checkable: done",
      "- **Acceptance**:",
      "  - done",
      "- **DependsOn**: none",
    ].join("\n");
    expect(lintPlan(content)).toEqual([]);
  });

  it("a reference the block itself declares as an edge is never a suspicion", () => {
    const warns = lintPlan(
      planDoc([...planTask(1, "task one", "none"), ...planTask(2, "spans Task 1", "1")]),
    );
    expect(warns).toEqual([]);
  });

  it("a conformant plan with zero references observes zero — the lint adds no noise to a clean record", () => {
    const warns = lintPlan(
      planDoc([...planTask(1, "task one", "none"), ...planTask(2, "task two", "1")]),
    );
    expect(warns).toEqual([]);
  });
});

describe("the cross-doc reference observation (Class-B label drift)", () => {
  it("the canonical `basename v1.21` parent form stays silent", () => {
    const warns = lintPlan(planDoc([...planTask(1, "task one", "none")]));
    expect(warns).toEqual([]);
  });

  it("a parent link whose version-stripped label drifts from the target basename WARNs", () => {
    const warns = lintPlan(
      planDoc(
        [...planTask(1, "task one", "none")],
        "[overall v1.21](docs/kairos/specs/x-overall.md)",
      ),
    );
    expect(warns).toHaveLength(1);
    expect(warns[0]!.field).toBe("**Parent program**");
    expect(warns[0]!.message).toContain("x-overall.md");
  });

  it("the same drift observation applies to a phase-spec's parent link", () => {
    const lines = [
      "# Test Spec",
      "- **Version**: v1.0",
      "- **Status**: Draft",
      "- **Author**: x",
      "- **Parent program**: [misnamed v1.0](docs/kairos/specs/x-overall.md)",
      "- **Depends on**: P1",
      "",
      "## Design",
      "",
      "### 1. group",
      "#### 1.1 item",
      "- text",
      "",
      "### Acceptance criteria",
      "",
      "- `c`",
    ];
    const warns = lintPass.run({
      docKey: "phaseSpec",
      path: SPEC_PATH,
      parsed: parseDoc("phaseSpec", lines),
    });
    expect(warns).toHaveLength(1);
  });

  it("the overall carries no reference-lint surface — the class is a silent no-op over an overall", () => {
    const warns = lintParsed("overall", ["# Test Overall", "## Document scope", "scope"]);
    expect(warns).toEqual([]);
  });
});

describe("the WARN-only gate", () => {
  it("the lint-defective plan stays judgment-clean on the reference surfaces — WARNs never become Findings", () => {
    const content = planDoc([
      ...planTask(1, "task one", "none"),
      ...planTask(2, "task two", "none"),
      ...planTask(3, "extends Task 1", "none"),
    ]);
    expect(lintPlan(content)).toHaveLength(1);
    // The lint's observation surfaces — prose references, DependsOn edges, the
    // cross-doc chain — judge ZERO findings even though the lint WARNs the doc.
    const findings = new Contract().validate({
      docKey: "plan",
      path: PLAN_PATH,
      content,
      root: ".",
      fs: GOOD_FS,
    });
    const referenceSurfaces = findings.filter((finding) =>
      ["crosslink", "cross-doc-chain", "file-existence", "sibling-scan"].includes(finding.kind),
    );
    expect(referenceSurfaces).toEqual([]);
  });

  it("every warning carries the reference-lint shape, never a judge Finding kind", () => {
    const warns = lintPlan(
      planDoc(
        [...planTask(1, "task one", "none"), ...planTask(3, "extends Task 1", "none")],
        "[overall v1.21](docs/kairos/specs/x-overall.md)",
      ),
    );
    expect(warns.length).toBeGreaterThan(0);
    for (const warn of warns) {
      expect(warn.kind).toBe("reference-lint");
      expect(typeof warn.path).toBe("string");
      expect(typeof warn.field).toBe("string");
      expect(typeof warn.message).toBe("string");
      expect(typeof warn.fix).toBe("string");
    }
  });
});
