// packages/cdd-engine/src/rules/__tests__/documents.test.ts — Task 29 (spec T7.8) shared doc
// contract validation (the docContractValidate hook's rules core). Three doc contracts:
//
//   plan     — `### Task N:` headings continuously extractable · `**Spec:**` resolves · Constraints
//              source declaration extractable · no `{{…}}` placeholders (handlebars `{{> partial}}`
//              refs excluded — the in-repo template mechanism token)
//   spec     — `**Version**` line · Parent program → existing `*-overall.md` with the line's vX.Y
//              tokens in the overall's version lineage · target phase registered in the parent
//   overall  — canonical Phase inventory header · row-shape guard (same cell-count consistency as
//              the validate 247832c6 guard) · target-phase row present · change-history ascending
//
// Every failure carries guidance (field / what is missing / how to fix). The module reads docs
// only — zero writes. extractTaskNumbers / extractConstraints are injected (the canonical engines
// live in dispatch/task.ts; this rules module stays acyclic).
import { it, expect, describe } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateDispatchDocuments, formatDocFailures } from "../documents.ts";

function repoDir(): string {
  return mkdtempSync(path.join(tmpdir(), "cdd-docs-"));
}

/** test-side task extractor mirroring taskNumbersFromPlan's `/^### Task (\d+):/` semantics. */
function extractTasks(planPath: string): number[] {
  const nums: number[] = [];
  for (const line of readFileSync(planPath, "utf8").split("\n")) {
    const m = line.match(/^### Task (\d+):/);
    if (m) nums.push(Number(m[1]));
  }
  return nums.sort((a, b) => a - b);
}

/** test-side constraint extractor: literal `## Constraints` section (Form A) or the prose-pointer
 *  headings (Form B) → non-null; nothing declared → null. */
function extractConstraints(content: string): string | null {
  if (/^\s*## Constraints\s*$/m.test(content)) return "constraints body";
  if (/^\*\*口径\*\*[：:]/.test(content)) return "prose constraints";
  return null;
}

interface Chain {
  repo: string;
  plan: string;
  spec: string;
  overall: string;
}

const VALID_OVERALL = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "|---|---|---|---|---|---|---|",
  "| P1 | phase one | P1-design v1.0 | Pending | | none |",
  "",
  "## Change history",
  "",
  "| Version | date | summary |",
  "|---|---|---|",
  "| v1.0 | 2026-09-21 | Initial |",
  "",
].join("\n");

function validSpec(): string {
  return [
    "- **Version**: v1.0 · 2026-09-21",
    "",
    "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
    "",
  ].join("\n");
}

function validPlan(): string {
  return [
    "# Plan",
    "",
    "**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)",
    "",
    "## Constraints",
    "",
    "- boundary one",
    "- boundary two",
    "",
    "### Task 1: x",
    "body",
    "",
  ].join("\n");
}

/** write the three-doc chain; a null member falls back to the valid default for that doc (mutators
 *  pass a doctored version to build the invalid fixture). planName controls the phase id token. */
function writeChain(overrides: { plan?: string; spec?: string; overall?: string; planName?: string } = {}): Chain {
  const repo = repoDir();
  const specsDir = path.join(repo, "docs", "osuperpowers", "specs");
  const plansDir = path.join(repo, "docs", "osuperpowers", "plans");
  mkdirSync(specsDir, { recursive: true });
  mkdirSync(plansDir, { recursive: true });
  const planName = overrides.planName ?? "plan.md";
  const plan = path.join(plansDir, planName);
  const spec = path.join(specsDir, "plan-design.md");
  const overall = path.join(specsDir, "plan-overall.md");
  writeFileSync(plan, overrides.plan ?? validPlan());
  writeFileSync(spec, overrides.spec ?? validSpec());
  writeFileSync(overall, overrides.overall ?? VALID_OVERALL);
  return { repo, plan, spec, overall };
}

function run(c: Chain, planPath?: string) {
  return validateDispatchDocuments({
    planPath: planPath ?? c.plan,
    root: c.repo,
    extractTaskNumbers: extractTasks,
    extractConstraints,
  });
}

function fieldNames(c: Chain, planPath?: string): string[] {
  return run(c, planPath).map((f) => f.field);
}

describe("validatePlanContract", () => {
  it("valid chain → zero failures", () => {
    const c = writeChain();
    expect(run(c)).toEqual([]);
  });

  it("plan: no `**Spec:**` reference → failure with actionable guidance", () => {
    const c = writeChain({ plan: "# Plan\n\n### Task 1: x\nbody\n" });
    const f = run(c);
    expect(f).toHaveLength(2); // spec ref + constraints source
    expect(f.some((x) => x.artifact === "plan" && x.field === "`**Spec:**`")).toBe(true);
    const specFail = f.find((x) => x.field === "`**Spec:**`")!;
    expect(specFail.missing).toMatch(/no `\*\*Spec:\*\*` reference/);
    expect(specFail.fix).toMatch(/add a `\*\*Spec:\*\*` line/);
  });

  it("plan: `**Spec:**` target does not resolve → failure", () => {
    const c = writeChain({
      plan: "# Plan\n\n**Spec:** [missing-design.md](docs/osuperpowers/specs/missing-design.md)\n\n## Constraints\n\n- c\n\n### Task 1: x\nbody\n",
    });
    const f = run(c);
    expect(f[0].field).toBe("`**Spec:**`");
    expect(f[0].missing).toMatch(/does not resolve/);
  });

  it("plan: `**Spec:**` link label ≠ resolved basename (label drift) → failure", () => {
    const c = writeChain({
      plan: "# Plan\n\n**Spec:** [wrong-name.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c\n\n### Task 1: x\nbody\n",
    });
    const f = run(c);
    expect(f.some((x) => x.field === "`**Spec:**`" && /label/.test(x.missing))).toBe(true);
  });

  it("plan: non-contiguous task headings (`### Task 1:` + `### Task 3:` missing 2) → failure", () => {
    const c = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c\n\n### Task 1: x\nbody\n\n### Task 3: z\nbody\n",
    });
    const f = run(c);
    expect(f.some((x) => x.field === "Task headings")).toBe(true);
  });

  it("plan: duplicate task heading → failure", () => {
    const c = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c\n\n### Task 1: x\nbody\n\n### Task 1: x again\nbody\n",
    });
    expect(fieldNames(c)).toContain("Task headings");
  });

  it("plan: no Constraints source declaration → failure (Form A and Form B both absent)", () => {
    const c = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n### Task 1: x\nbody\n",
    });
    const f = run(c);
    expect(f.some((x) => x.field === "Constraints source")).toBe(true);
  });

  it("plan: `{{…}}` placeholder → failure; `{{> partial}}` mechanism ref → exempt", () => {
    const withPlaceholder = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c\n\n{{{TASK_BRIEF}}}\n\n### Task 1: x\nbody\n".replace("{{{TASK_BRIEF}}}", "{{TASK_BRIEF}}"),
    });
    expect(fieldNames(withPlaceholder)).toContain("placeholders");
    const withPartial = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c **{{> clause cl:language}}**\n\n### Task 1: x\nbody\n",
    });
    expect(fieldNames(withPartial)).not.toContain("placeholders");
  });
});

describe("validatePhaseSpecContract", () => {
  it("spec: missing `**Version**` line → failure with guidance", () => {
    const c = writeChain({
      spec: "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)\n",
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "phase spec" && x.field === "`**Version**`")).toBe(true);
  });

  it("spec: Parent program target unresolvable → failure", () => {
    const c = writeChain({
      spec: "- **Version**: v1.0 · 2026-09-21\n\n- **Parent program**: [missing-overall.md v1.0](./missing-overall.md)\n",
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "phase spec" && /Parent program/.test(x.field) && /does not resolve/.test(x.missing))).toBe(true);
  });

  it("spec: Parent program is not a `*-overall.md` → failure", () => {
    const c = writeChain({
      spec: "- **Version**: v1.0 · 2026-09-21\n\n- **Parent program**: [plan-design.md](./plan-design.md)\n",
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "phase spec" && /not a `\*-overall\.md`/.test(x.missing))).toBe(true);
  });

  it("spec: Parent program vX.Y token ∉ overall version lineage → failure", () => {
    const c = writeChain({
      spec: "- **Version**: v1.0 · 2026-09-21\n\n- **Parent program**: [plan-overall.md v9.9](./plan-overall.md)\n",
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "phase spec" && /v9\.9/.test(x.missing))).toBe(true);
  });

  it("spec: target phase not registered in the parent overall → failure", () => {
    const c = writeChain({ planName: "2026-09-21-demo-p2.md" }); // phase P2; overall registers P1 only
    const f = run(c);
    // double coverage: the spec-side Parent-program registration check + the overall-side
    // target-phase-row check both surface the same missing P2 against the structure.
    expect(f.some((x) => x.artifact === "phase spec" && /not registered/.test(x.missing))).toBe(true);
    expect(f.some((x) => x.artifact === "overall" && /row missing/.test(x.missing))).toBe(true);
  });
});

describe("validateOverallContract", () => {
  it("overall: non-canonical Phase inventory header → failure", () => {
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|",
        "| P1 | phase one | | | none |",
        "",
      ].join("\n"),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /canonical/.test(x.missing))).toBe(true);
  });

  it("overall: row-shape drift — one P row with a shifted cell count → failure", () => {
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P1 | phase one | P1-design v1.0 | Pending | | none |",
        "| P2 | scope a | scope b | P2-design v1.0 | Pending | | none |", // 9 cells vs norm 8
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | Initial |",
        "",
      ].join("\n"),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /row-shape/.test(x.field) && /≠/.test(x.missing))).toBe(true);
  });

  it("overall: change-history not ascending → failure", () => {
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P1 | phase one | P1-design v1.0 | Pending | | none |",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v2.0 | 2026-09-21 | newer first |",
        "| v1.0 | 2026-09-21 | older after |",
        "",
      ].join("\n"),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /not ascending/.test(x.missing))).toBe(true);
  });

  it("overall: duplicate change-history version → failure", () => {
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P1 | phase one | P1-design v1.0 | Pending | | none |",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | first |",
        "| v1.0 | 2026-09-22 | duplicate |",
        "",
      ].join("\n"),
    });
    expect(fieldNames(c)).toContain("Change history");
  });

  it("overall: target phase row missing（phaseful plan）→ failure", () => {
    const c = writeChain({ planName: "2026-09-21-demo-p2.md" });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /P2/.test(x.missing) && /row/.test(x.missing))).toBe(true);
  });
});

describe("formatDocFailures — the guidance line (artifact · file · field · missing · fix)", () => {
  it("one failure line carries artifact / file / field / missing / fix in order", () => {
    const c = writeChain({ plan: "# Plan\n\n### Task 1: x\nbody\n" });
    const f = run(c);
    const text = formatDocFailures([f[0]]);
    expect(text).toMatch(/^- \[plan\] /);
    expect(text).toContain(c.plan);
    expect(text).toMatch(/→ .*how to fix|→ .*add a|→ .*declare/);
    expect(text.split("\n")).toHaveLength(1);
  });
});