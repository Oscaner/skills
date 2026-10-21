// packages/cdd-engine/src-next/contract/__tests__/lint.test.ts
// T5 reference-lint suite — the WARN pass acceptance surface (design spec §2.3):
//   · the missing-edge suspect scan — a backward `Task N` / `T<N>` prose reference
//     with no matching `- **DependsOn**:` declaration WARNs once per block, while
//     forward / self / unregistered / spec-item / code-span / declared-edge refs
//     stay silent (the positive surface);
//   · the retired cross-doc drift observation (T6) — the Class-B link-text drift
//     WARN retires with the ChainLink label face: parent references carry zero
//     WARNs whatever their shape (the chain facts ride the front-matter head);
//   · the WARN-only gate — the same defective document produces ZERO Contract
//     findings (the lint never feeds the judgment face) and every warning carries
//     the reference-lint shape, never a Finding.
// Fixtures are known-good plan literals parsed through the shared PlanDocType
// instance (the parse-once-reuse discipline — the lint consumes the same parse
// record the dispatch and the graph read). Since T6 the fixtures carry the
// front-matter head (the §2.2 delivery seam's canonical document form).

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
  // The identity index reads through this seam: the same-slug `x-p3-design.md` is
  // the plan's Class-A identity document.
  read: (p) =>
    p.endsWith("/x-p3-design.md")
      ? "---\ntitle: S\ndoc-type: phase-spec\nslug: x-p3\nprogram: x-overall\n---\n"
      : "---\ntitle: X\ndoc-type: single-spec\nslug: x-other\n---\n",
  list: (dir) =>
    dir.endsWith("/specs") || dir.endsWith("specs")
      ? ["x-overall.md", "x-design.md", "x-p3-design.md"]
      : ["x-p3.md"],
};

/** One rendered `### Task N:` block with all required fields. */
const planTask = (
  id: number,
  objective: string,
  dependsOn: string,
  acceptance: readonly string[] = ["done"],
): string[] => {
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
};

/** A full canonical plan document over the task blocks — the shared parse fixture
 *  (the front-matter head carries the identity keys; the lint's scan surfaces are
 *  the task blocks only). */
const planDoc = (blocks: readonly string[]): string => {
  return [
    "---",
    "title: Test Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: x-p3",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks,
  ].join("\n");
};

const lintPass = new LintPass();

const lintPlan = (content: string): ReturnType<LintPass["run"]> => {
  return lintPass.run({
    path: PLAN_PATH,
    parsed: parseDoc("plan", content.split("\n")),
  });
};

const lintParsed = (
  docKey: "overall-spec" | "plan" | "phase-spec",
  lines: readonly string[],
): ReturnType<LintPass["run"]> => {
  // docKey selects the parser only — the lint input carries no re-typed doc key.
  return lintPass.run({ path: PLAN_PATH, parsed: parseDoc(docKey, lines) });
};

/** The shared parse — the composition root consumers reuse (parse-once discipline). */
const parseDoc = (
  docKey: "overall-spec" | "plan" | "phase-spec",
  lines: readonly string[],
): ParsedDoc => docTypeParsers[docKey].parse(lines);

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
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: x-p3",
      "---",
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

describe("the retired cross-doc drift observation (T6 — zero WARNs)", () => {
  it("the canonical parent reference stays silent (zero WARNs)", () => {
    const warns = lintPlan(planDoc([...planTask(1, "task one", "none")]));
    expect(warns).toEqual([]);
  });

  it("a parent reference whose shape would have drifted WARNs no more — the link-text face is retired", () => {
    // The drift judgment retired with the ChainLink label face: a plan declares no
    // parent key at all (its chain is the same-slug identity document) — there is
    // no link text to compare, so no drift WARN can fire.
    const warns = lintPlan(planDoc([...planTask(1, "task one", "none")]));
    expect(warns).toEqual([]);
  });

  it("the same retired surface applies to a phase-spec's program reference — zero WARNs", () => {
    const lines = [
      "---",
      "title: Test Spec",
      "doc-type: phase-spec",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: x-p3",
      "program: x-overall",
      "status: Draft",
      "author: x",
      "parent-version: v1.0",
      "---",
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
      path: SPEC_PATH,
      parsed: parseDoc("phase-spec", lines),
    });
    expect(warns).toEqual([]);
  });

  it("the overall carries no reference-lint surface — the class is a silent no-op over an overall", () => {
    const warns = lintParsed("overall-spec", ["# Test Overall", "## Document scope", "scope"]);
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
      planDoc([...planTask(1, "task one", "none"), ...planTask(3, "extends Task 1", "none")]),
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
