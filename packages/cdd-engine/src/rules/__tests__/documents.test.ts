// packages/cdd-engine/src/rules/__tests__/documents.test.ts — Task 29 (spec T7.8) + P2 Task 3
// shared doc-contract validation (the docContractValidate base-default hook's rules core). The
// single audit entry (validateDispatchDocuments) walks the dispatch chain by entry doc-type:
//
//   plan     — plan 契約 (`### Task N:` continuous · Constraints source · no placeholders) + Class A
//              (`**Spec:**` resolves + label == basename) → the spec's own face → (chain) → overall
//   spec     — `**Version**` line · Parent program → `*-overall.md` resolution (Class B) → overall
//   overall  — overall 契約 face directly (the self-audit boundary)
//
// The overall 契約 face = canonical Phase inventory kernel (header / row-shape / change-history
// ascending) + the merged version-lineage check (the spec's pinned vX.Y tokens ∈ the overall's
// lineage) + the four-table audit (faces ①-⑥):
//
//   ① bidirectional backfill claim ↔ Phase-inventory column  ② document-existence glob
//   ③ dependency-graph membership (graph tokens + dependency-cell predecessors ∈ ids)
//   ④ phase-registration completeness (dispatch phase ∈ inventory ids + no duplicate rows)
//   ⑤ anchor registration domain (anchor issue ∈ Issue-inventory ref set; no anchors → no-op)
//   ⑥ Issue-inventory rows well-formed (phase ∈ ids + ref well-formed)
//
// Lineage-unresolvable chains (no / broken `**Parent program**`) truncate: the four-table audit +
// overall 契約 no-op, and the necessary subset (plan 契約 + Class A + the spec's own face) still
// runs — the four tables are only ever audited against a reached parent overall.
//
// Every failure carries guidance (field / what is missing / how to fix). The module reads docs
// only — zero writes. extractTaskNumbers / extractConstraints moved INTO this module (Task 3 —
// the canonical plan extractors; the base default hook needs them without a dispatch-layer import).
import { it, expect, describe } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateDispatchDocuments, formatDocFailures, taskNumbersFromPlan, extractPlanConstraints } from "../documents.ts";

function repoDir(): string {
  return mkdtempSync(path.join(tmpdir(), "cdd-docs-"));
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
  "| P1 | phase one | [Pending] | Pending | | none |",
  "",
  "## Change history",
  "",
  "| Version | date | summary |",
  "|---|---|---|",
  "| v1.0 | 2026-09-21 | Initial |",
  "",
].join("\n");

function validSpec(parent = "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)"): string {
  return [
    "- **Version**: v1.0 · 2026-09-21",
    "",
    parent,
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

function run(c: Chain, entry?: string) {
  return validateDispatchDocuments({ entry: entry ?? c.plan, root: c.repo });
}

function fieldNames(c: Chain, entry?: string): string[] {
  return run(c, entry).map((f) => f.field);
}

describe("validatePlanContract — the plan face (necessary subset, always runs)", () => {
  it("valid chain → zero failures", () => {
    const c = writeChain();
    expect(run(c)).toEqual([]);
  });

  it("plan: no `**Spec:**` reference → failure with actionable guidance", () => {
    const c = writeChain({ plan: "# Plan\n\n### Task 1: x\nbody\n" });
    const f = run(c);
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
    expect(fieldNames(c)).toContain("`**Spec:**`");
  });

  it("plan: non-contiguous task headings → failure", () => {
    const c = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c\n\n### Task 1: x\nbody\n\n### Task 3: z\nbody\n",
    });
    expect(fieldNames(c)).toContain("Task headings");
  });

  it("plan: no Constraints source declaration → failure (Form A and Form B both absent)", () => {
    const c = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n### Task 1: x\nbody\n",
    });
    expect(fieldNames(c)).toContain("Constraints source");
  });

  it("plan: `{{…}}` placeholder → failure; `{{> partial}}` mechanism ref → exempt", () => {
    const withPlaceholder = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c\n\n{{TASK_BRIEF}}\n\n### Task 1: x\nbody\n",
    });
    expect(fieldNames(withPlaceholder)).toContain("placeholders");
    const withPartial = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c **{{> clause cl:language}}**\n\n### Task 1: x\nbody\n",
    });
    expect(fieldNames(withPartial)).not.toContain("placeholders");
  });
});

describe("lineage truncation — the spec's own face + necessary subset, four tables no-op", () => {
  it("spec: missing `**Version**` line → failure with guidance (spec own face still runs)", () => {
    const c = writeChain({ spec: "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)\n" });
    const f = run(c);
    expect(f.some((x) => x.artifact === "phase spec" && x.field === "`**Version**`")).toBe(true);
  });

  it("spec: no `**Parent program**` line → chain truncation — the four-table audit no-ops and the chain passes (necessary subset only)", () => {
    // The plan/spec are otherwise valid; the parent cannot be reached → no overall 契約, no four
    // tables (AC1: lineage 未 resolve → 四表 no-op、necessary-subset 恒跑).
    const c = writeChain({ spec: "- **Version**: v1.0 · 2026-09-21\n" });
    expect(run(c)).toEqual([]);
  });

  it("spec: Parent program target unresolvable → chain truncation (no four-table failure, necessary subset proceeds)", () => {
    const c = writeChain({ spec: validSpec("- **Parent program**: [missing-overall.md v1.0](./missing-overall.md)") });
    expect(run(c)).toEqual([]);
  });

  it("spec: Parent program target is not a `*-overall.md` → chain truncation", () => {
    const c = writeChain({ spec: validSpec("- **Parent program**: [plan-design.md](./plan-design.md)") });
    expect(run(c)).toEqual([]);
  });

  it("lineage truncated + plan invalid → only the plan-face failures surface (never overall faces)", () => {
    const c = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n### Task 1: x\nbody\n", // no Constraints source
      spec: "- **Version**: v1.0 · 2026-09-21\n", // no parent line → overall never audited
      overall: "not even a doc",
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "plan")).toBe(true);
    expect(f.some((x) => x.artifact === "overall")).toBe(false);
  });
});

// ---- overall 契約 face: kernel + merged version-lineage + four tables ---- //

// A fully audit-clean overall (all six faces pass): P1 shipped with matching backfill claims and
// real phase docs on disk (face ② globs need them, slug derived from plan-overall.md), a
// dependency edge, a well-formed issue row and ascending change history.
const AUDIT_OVERALL = [
  "- **Version**: v1.1 · 2026-09-21",
  "",
  "## Issue inventory",
  "",
  "| Phase | Issue (ref) | Title summary |",
  "|---|---|---|",
  "| P1 | none | issue one |",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "|---|---|---|---|---|---|---|",
  "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | Done | | |",
  "| P2 | phase two | [Pending] | [Pending] | | P1 ->(hard) |",
  "",
  "## Dependency graph (ASCII)",
  "",
  "```",
  "P1 -> P2",
  "```",
  "",
  "Legend:",
  "- `->` = hard block",
  "- `-> (soft)` = suggestion only",
  "",
  "## Change history",
  "",
  "| Version | date | summary |",
  "|---|---|---|",
  "| v1.0 | 2026-09-21 | Initial |",
  "| v1.1 | 2026-09-21 | P1 Implementation plan 列回填（[Pending]→Done） |",
  "",
].join("\n");

/** write an audit chain: the entry plan (default a phaseful P2 plan — registered in the overall),
 * the resolved spec + parent overall, and the SHIPPED phase P1's docs (face ② globs need them,
 * slug "plan" derived from plan-overall.md) — P1 shipped with matching backfill claims, P2 pending.
 * Mutators override the overall / spec / planName. */
function writeAuditChain(overrides: { overall?: string; spec?: string; planName?: string } = {}): Chain {
  const c = writeChain({
    overall: overrides.overall ?? AUDIT_OVERALL,
    spec: overrides.spec ?? validSpec(),
    planName: overrides.planName ?? "2026-09-21-plan-p2.md",
  });
  // Face ② doc-existence globs (slug "plan"): the shipped phase's docs must exist under the
  // derived patterns — distinct from the entry plan (also 2026-09-21-plan-<pN>.md).
  writeFileSync(path.join(c.repo, "docs", "osuperpowers", "specs", "2026-09-21-plan-p1-design.md"), "# p1 design\n");
  writeFileSync(path.join(c.repo, "docs", "osuperpowers", "plans", "2026-09-21-plan-p1.md"), "# plan\n");
  return c;
}

describe("four-table audit — faces ①-⑥ each with an illegal state → BLOCK material", () => {
  it("baseline audit-clean chain → zero failures (all six faces pass)", () => {
    const c = writeAuditChain();
    expect(run(c)).toEqual([]);
  });

  it("face ① forward: change-history plan claim says Done but the column cell is [Pending] → failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL
        .replace("| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | Done | | |",
          "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | [Pending] | | |"),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /backfill|claim/i.test(x.field))).toBe(true);
  });

  it("face ① reverse: shipped plan column (Done) with no matching plan claim in change history → failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace(
        "| v1.1 | 2026-09-21 | P1 Implementation plan 列回填（[Pending]→Done） |",
        "| v1.1 | 2026-09-21 | P1 scope refinement |",
      ),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /backfill/i.test(x.field))).toBe(true);
  });

  it("face ① design: claim pins a design token the column cell does not carry → failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.concat(
        "\n",
        "| v1.2 | 2026-09-21 | P2 Design-spec 列回填（[Pending]→p2-design v1.0） |",
      ),
    });
    // The claim demands p2-design but the design cell is still [Pending] → forward mismatch.
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /backfill/i.test(x.field))).toBe(true);
  });

  it("face ②: design cell carries an own P<n>-design token but the design doc glob misses → failure", () => {
    const c = writeAuditChain();
    unlinkSync(path.join(c.repo, "docs", "osuperpowers", "specs", "2026-09-21-plan-p1-design.md"));
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /missing/i.test(x.missing))).toBe(true);
  });

  it("face ②: non-pending plan column with no matching plan doc on disk → failure", () => {
    const c = writeAuditChain();
    unlinkSync(path.join(c.repo, "docs", "osuperpowers", "plans", "2026-09-21-plan-p1.md"));
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /missing/i.test(x.missing))).toBe(true);
  });

  it("face ③: dependency graph references a phase not in the Phase inventory → failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace("P1 -> P2", "P1 -> P9"),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /dependency|依赖/i.test(x.field))).toBe(true);
  });

  it("face ③: Phase-inventory dependency cell cites a predecessor not in the inventory → failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace("| P2 | phase two | [Pending] | [Pending] | | P1 ->(hard) |",
        "| P2 | phase two | [Pending] | [Pending] | | P9 ->(hard) |"),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /dependency|依赖/i.test(x.field))).toBe(true);
  });

  it("face ④: dispatch phase (phaseful plan) not registered in the parent overall → exactly ONE failure (single implementation)", () => {
    const c = writeAuditChain({ planName: "2026-09-21-demo-p3.md" }); // the dispatch phase P3 is unregistered (the inventory holds only P1 and P2)
    const f = run(c);
    const hits = f.filter((x) => /registered|row missing|registration/i.test(x.missing));
    expect(hits.length).toBe(1); // Class B spec-side duplicate GONE — face ④ only
    expect(hits[0].artifact).toBe("overall");
  });

  it("face ④: duplicate phase rows in the Phase inventory → registration incompleteness → failure", () => {
    const c = writeAuditChain({
      // Insert the duplicate registration row INSIDE the Phase-inventory table (the phase
      // inventory's own row surface — not the file tail, which the change-history section owns).
      overall: AUDIT_OVERALL.replace(
        "| P2 | phase two | [Pending] | [Pending] | | P1 ->(hard) |",
        "| P2 | phase two | [Pending] | [Pending] | | P1 ->(hard) |\n| P1 | phase one dup | [Pending] | [Pending] | | none |",
      ),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /duplicate|重复/i.test(x.missing))).toBe(true);
  });

  it("face ⑤: a phase doc carries a `#NNN#issuecomment-<digits>` anchor whose issue is not in the Issue inventory → failure", () => {
    const c = writeAuditChain();
    writeFileSync(
      path.join(c.repo, "docs", "osuperpowers", "specs", "2026-09-21-plan-p1-design.md"),
      "fixes #123#issuecomment-456\n",
    );
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /anchor|锚/i.test(x.field))).toBe(true);
  });

  it("face ⑤: no anchors anywhere → no-op (zero failures from the anchor registry)", () => {
    const c = writeAuditChain();
    expect(run(c).some((x) => /anchor|锚/i.test(x.field))).toBe(false);
  });

  it("face ⑥: Issue-inventory row references a phase not in the inventory → failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace("| P1 | none | issue one |", "| P9 | none | issue one |"),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /issue/i.test(x.field))).toBe(true);
  });

  it("face ⑥: Issue-inventory ref is not well-formed → failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace("| P1 | none | issue one |", "| P1 | #12x | issue one |"),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /issue/i.test(x.field))).toBe(true);
  });
});

describe("overall 契約 face — kernel + merged version-lineage", () => {
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

  it("overall: row-shape drift → failure", () => {
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P1 | phase one | [Pending] | Pending | | none |",
        "| P2 | scope a | scope b | [Pending] | Pending | | none |",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | Initial |",
        "",
      ].join("\n"),
    });
    expect(fieldNames(c)).toContain("row-shape drift");
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
        "| P1 | phase one | [Pending] | Pending | | none |",
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
    expect(fieldNames(c)).toContain("Change history");
  });

  it("merged version-lineage: spec pins a vX.Y the parent overall does not carry → the OVERALL face fails (single implementation)", () => {
    const c = writeChain({ spec: validSpec("- **Parent program**: [plan-overall.md v9.9](./plan-overall.md)") });
    const f = run(c);
    // The check moved from the spec face into the overall contract face — artifact is the overall.
    expect(f.some((x) => x.artifact === "overall" && /v9\.9/.test(x.missing))).toBe(true);
    expect(f.some((x) => x.artifact === "phase spec" && /v9\.9/.test(x.missing))).toBe(false);
  });

  it("merged version-lineage: a pinned token the overall DOES carry → no failure", () => {
    const c = writeChain({ spec: validSpec("- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)") });
    expect(run(c).some((x) => /v1\.0/.test(x.missing))).toBe(false);
  });
});

describe("entry forms — the per-doc-type audit surfaces", () => {
  it("overall self-audit (docs-lane boundary): entry is the overall itself → kernel + four tables run on it", () => {
    const repo = repoDir();
    const specsDir = path.join(repo, "docs", "osuperpowers", "specs");
    mkdirSync(specsDir, { recursive: true });
    const duck = path.join(specsDir, "duck-overall.md");
    writeFileSync(duck, AUDIT_OVERALL.replace("P1 -> P2", "P1 -> P9"));
    writeFileSync(path.join(specsDir, "2026-09-21-duck-p1-design.md"), "# d\n");
    const plansDir = path.join(repo, "docs", "osuperpowers", "plans");
    mkdirSync(plansDir, { recursive: true });
    writeFileSync(path.join(plansDir, "2026-09-21-duck-p1.md"), "# p\n");
    const f = run({ repo, plan: duck, spec: duck, overall: duck }, duck);
    expect(f.some((x) => x.artifact === "overall" && /dependency/i.test(x.field))).toBe(true);
  });

  it("overall self-audit: a clean overall entry → zero failures", () => {
    const repo = repoDir();
    const specsDir = path.join(repo, "docs", "osuperpowers", "specs");
    mkdirSync(specsDir, { recursive: true });
    const overall = path.join(specsDir, "duck-overall.md");
    writeFileSync(overall, AUDIT_OVERALL);
    writeFileSync(path.join(specsDir, "2026-09-21-duck-p1-design.md"), "# d\n");
    const plansDir = path.join(repo, "docs", "osuperpowers", "plans");
    mkdirSync(plansDir, { recursive: true });
    writeFileSync(path.join(plansDir, "2026-09-21-duck-p1.md"), "# p\n");
    expect(run({ repo, plan: overall, spec: overall, overall }, overall)).toEqual([]);
  });

  it("spec entry (docs-lane type=spec): the spec's own chain is audited from the spec file", () => {
    const c = writeChain({ spec: validSpec() });
    const f = run(c, c.spec);
    expect(f).toEqual([]); // spec face + overall face all clean
  });

  it("plan entry whose own plan-level contracts pass but the resolved chain fails → chain failures surface", () => {
    const c = writeChain({ spec: validSpec("- **Parent program**: [plan-overall.md v9.9](./plan-overall.md)") });
    const f = run(c, c.plan);
    expect(f.some((x) => x.artifact === "overall")).toBe(true);
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