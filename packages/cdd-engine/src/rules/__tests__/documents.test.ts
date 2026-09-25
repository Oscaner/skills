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

import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  effectiveGroups,
  extractClaimRows,
  formatDocFailures,
  isInflightText,
  isPendingText,
  parseOverall,
  taskGroupsFromPlan,
  taskNumbersFromPlan,
  validateDispatchDocuments,
} from "../documents.ts";

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

function validSpec(
  parent = "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
): string {
  return ["- **Version**: v1.0 · 2026-09-21", "", parent, ""].join("\n");
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
function writeChain(
  overrides: { plan?: string; spec?: string; overall?: string; planName?: string } = {},
): Chain {
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
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c\n\n{{SOME_UNKNOWN}}\n\n### Task 1: x\nbody\n",
    });
    expect(fieldNames(withPlaceholder)).toContain("placeholders");
    const withPartial = writeChain({
      plan: "# Plan\n\n**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)\n\n## Constraints\n\n- c **{{> clause cl:language}}**\n\n### Task 1: x\nbody\n",
    });
    expect(fieldNames(withPartial)).not.toContain("placeholders");
  });
});

describe("taskGroupsFromPlan / effectiveGroups — dispatch-group declaration (P4.3 Task 3, spec §2.2)", () => {
  function planFile(body: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-groups-"));
    const p = path.join(dir, "plan.md");
    writeFileSync(p, body);
    return p;
  }
  const TASKS = "# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n\n### Task 3: c\nbody\n";

  it("no `## Task Groups` section → empty default: [] declared + per-task singleton groups (pre-P4.3 equivalence)", () => {
    const p = planFile(TASKS);
    expect(taskGroupsFromPlan(p)).toEqual([]);
    expect(effectiveGroups(p).map((g) => g.key())).toEqual(["1", "2", "3"]);
  });

  it("merged groups parse — one `- **Task 1, 2**:` bullet per group, number list ascending + deduped", () => {
    const p = planFile(
      [
        TASKS,
        "## Task Groups",
        "",
        "- **Task 1, 2**: 共享验收面",
        "- **Task 3**: reader-tolerated verbatim (length-1 line is schema-invalid — the write-back judgment keeps such groups off the plan)",
        "",
      ].join("\n"),
    );
    expect(taskGroupsFromPlan(p).map((g) => g.key())).toEqual(["1,2", "3"]);
  });

  it("section boundary — the next `##` heading / `---` rule / prose without a group line terminates the parse", () => {
    const p = planFile(
      [
        TASKS,
        "## Task Groups",
        "",
        "- **Task 1, 2**: merged",
        "",
        "## Pending Acceptance Patch",
        "",
        "- **Task 2 (patch)**: later",
        "",
        "---",
        "tail",
      ].join("\n"),
    );
    expect(taskGroupsFromPlan(p).map((g) => g.key())).toEqual(["1,2"]);
  });

  it("declared groups replace the singleton set verbatim → effectiveGroups = the declared groups", () => {
    const p = planFile(
      [
        "# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n\n### Task 3: c\nbody\n\n### Task 4: d\nbody\n",
        "## Task Groups",
        "",
        "- **Task 1, 2**: 共享验收面",
        "- **Task 3, 4**: second merged group",
        "",
      ].join("\n"),
    );
    // effectiveGroups derives from the section, never fabricating singletons in the declared branch
    expect(effectiveGroups(p).map((g) => g.key())).toEqual(["1,2", "3,4"]);
  });

  it("a length-1 declared line is parse-tolerated and surfaces in effectiveGroups — the >= 2 floor is schema minItems + write-back, never the parser", () => {
    const p = planFile(
      [
        "# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n\n### Task 3: c\nbody\n",
        "## Task Groups",
        "",
        "- **Task 1**: length-1 line (schema-invalid — tolerated read-only, never written back)",
        "- **Task 2, 3**: conformant merged group",
        "",
      ].join("\n"),
    );
    // Reader tolerance: the length-1 group parses and surfaces verbatim — taskGroupsFromPlan /
    // effectiveGroups never drop a declared task. The >= 2 floor lives in plan.json
    // taskGroups.items.tasks.minItems + the adjudication write-back judgment (plan.json description:
    // a length-1 group never lands on disk — the single-group state exists only as the empty
    // default), not in this derivation.
    expect(taskGroupsFromPlan(p).map((g) => g.key())).toEqual(["1", "2,3"]);
    expect(effectiveGroups(p).map((g) => g.key())).toEqual(["1", "2,3"]);
  });

  it("有效分区 == 全 task 号集覆盖 guard (P4.4: the effective-group union is the plan task set — declared or empty-default)", () => {
    const declared = planFile(
      [
        "# Plan\n\n### Task 1: a\nbody\n\n### Task 2: b\nbody\n\n### Task 3: c\nbody\n\n### Task 4: d\nbody\n",
        "## Task Groups",
        "",
        "- **Task 1, 2**: merged",
        "- **Task 3**: length-1 line tolerated",
        "",
      ].join("\n"),
    );
    const empty = planFile("# Plan\n\n### Task 1: a\n\n### Task 2: b\n\n### Task 3: c\n");
    for (const p of [declared, empty]) {
      const union = [...new Set(effectiveGroups(p).flatMap((g) => [...g]))].sort((a, b) => a - b);
      expect(union).toEqual(taskNumbersFromPlan(p)); // every plan task lands in exactly one effective group
    }
  });
});

describe("lineage truncation — the spec's own face + necessary subset, four tables no-op", () => {
  it("spec: missing `**Version**` line → failure with guidance (spec own face still runs)", () => {
    const c = writeChain({
      spec: "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)\n",
    });
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
    const c = writeChain({
      spec: validSpec("- **Parent program**: [missing-overall.md v1.0](./missing-overall.md)"),
    });
    expect(run(c)).toEqual([]);
  });

  it("spec: Parent program target is not a `*-overall.md` → chain truncation", () => {
    const c = writeChain({
      spec: validSpec("- **Parent program**: [plan-design.md](./plan-design.md)"),
    });
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
  "- **Version**: v1.2 · 2026-09-21",
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
  "| v1.2 | 2026-09-21 | P1 Design-spec 列回填（[Pending]→p1-design v1.0） |",
  "",
].join("\n");

/** write an audit chain: the entry plan (default a phaseful P2 plan — registered in the overall),
 * the resolved spec + parent overall, and the SHIPPED phase P1's docs (face ② globs need them,
 * slug "plan" derived from plan-overall.md) — P1 shipped with matching backfill claims, P2 pending.
 * Mutators override the overall / spec / planName. */
function writeAuditChain(
  overrides: { overall?: string; spec?: string; planName?: string } = {},
): Chain {
  const c = writeChain({
    overall: overrides.overall ?? AUDIT_OVERALL,
    spec: overrides.spec ?? validSpec(),
    planName: overrides.planName ?? "2026-09-21-plan-p2.md",
  });
  // Face ② doc-existence globs (slug "plan"): the shipped phase's docs must exist under the
  // derived patterns — distinct from the entry plan (also 2026-09-21-plan-<pN>.md).
  writeFileSync(
    path.join(c.repo, "docs", "osuperpowers", "specs", "2026-09-21-plan-p1-design.md"),
    "# p1 design\n",
  );
  writeFileSync(
    path.join(c.repo, "docs", "osuperpowers", "plans", "2026-09-21-plan-p1.md"),
    "# plan\n",
  );
  return c;
}

describe("four-table audit — faces ①-⑥ each with an illegal state → BLOCK material", () => {
  it("baseline audit-clean chain → zero failures (all six faces pass)", () => {
    const c = writeAuditChain();
    expect(run(c)).toEqual([]);
  });

  it("face ① forward: change-history plan claim says Done but the column cell is [Pending] → failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace(
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | Done | | |",
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | [Pending] | | |",
      ),
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
        "| v1.3 | 2026-09-21 | P2 Design-spec 列回填（[Pending]→p2-design v1.0） |",
      ),
    });
    // The claim demands p2-design but the design cell is still [Pending] → forward mismatch.
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /backfill/i.test(x.field))).toBe(true);
  });

  it("face ①: a canonical sub-phase claim (P2.1) resolves verbatim — no base collapse", () => {
    // Sub-phase ids (`P2.1`) are canonical claim references (phaseReference.single allows the
    // dotted dot-digit hierarchy) — a consistent claim on P2.1 must attribute to the FULL id,
    // never re-derived as the numeric base `P2` (the single/range scans capture the full id plus
    // its ridge; a base-only scan would emit "P2" and falsely fail the membership audit).
    const c = writeChain({
      overall: [
        "- **Version**: v1.1 · 2026-09-21",
        "",
        "## Issue inventory",
        "",
        "| Phase | Issue (ref) | Title summary |",
        "|---|---|---|",
        "| P2.1 | none | issue one |",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P2.1 | phase two-one | [Pending] | Done | | |",
        "| P2 | phase two | [Pending] | [Pending] | | P2.1 ->(hard) |",
        "",
        "## Dependency graph (ASCII)",
        "",
        "```",
        "P2.1 -> P2",
        "```",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | Initial |",
        "| v1.1 | 2026-09-21 | P2.1 Implementation plan 列回填（[Pending]→Done） |",
        "",
      ].join("\n"),
      planName: "2026-09-21-plan-p2.md",
    });
    // face ② globs (slug "plan"): the shipped P2.1 plan doc must exist (its design cell is [Pending])
    // — the dotted-id filename form `…-plan-p2.1.md` is what the design-existence glob resolves.
    writeFileSync(
      path.join(c.repo, "docs", "osuperpowers", "plans", "2026-09-21-plan-p2.1.md"),
      "# plan\n",
    );
    expect(run(c)).toEqual([]);
  });

  it("face ③: a sub-phase dependency graph (`P2.1 -> P2.2` hard + `P2.1 -> (soft) P2.2` soft) with dotted dependency cells → clean membership", () => {
    // Sub-phase edges are the new-grammar headliner (AC3): the graph fence carries a hardEdge and
    // a softEdge over dotted ids and the P2.2 row's Dependency cell cites its dotted predecessor —
    // the membership audit scans every token (P2.1, P2.2) against the inventory.
    const c = writeChain({
      overall: [
        "- **Version**: v1.1 · 2026-09-21",
        "",
        "## Issue inventory",
        "",
        "| Phase | Issue (ref) | Title summary |",
        "|---|---|---|",
        "| P2.1 | none | sub-phase one |",
        "| P2.2 | none | sub-phase two |",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P2.1 | phase two-one | [Pending] | [Pending] | | none |",
        "| P2.2 | phase two-two | [Pending] | [Pending] | | P2.1 ->(hard) |",
        "",
        "## Dependency graph (ASCII)",
        "",
        "```",
        "P2.1 -> P2.2",
        "P2.1 -> (soft) P2.2",
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
        "| v1.1 | 2026-09-21 | P2.1–P2.2 split 注册（sub-phase edges added） |",
        "",
      ].join("\n"),
      planName: "2026-09-21-plan-p2.2.md",
    });
    expect(run(c)).toEqual([]);
  });

  it("face ①: a ranged `P2.1–P2.3` claim expands to EVERY phase, endpoints included (sub-phase claim ranges)", () => {
    // Range expansion is segment-aware over the shared digit ridge: `P2.1–P2.3` attributes the
    // plan claim to P2.1, P2.2 AND P2.3 — the endpoints and the intermediate (a base-only or
    // float-walk expansion would emit the spurious P3.1). extractClaimRows exposes the expanded set.
    const c = writeChain({
      overall: [
        "- **Version**: v1.1 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P2.1 | phase two-one | [Pending] | [Pending] | | none |",
        "| P2.2 | phase two-two | [Pending] | [Pending] | | none |",
        "| P2.3 | phase two-three | [Pending] | [Pending] | | none |",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | Initial |",
        "| v1.1 | 2026-09-21 | P2.1–P2.3 Implementation plan 列回填（[Pending]→Done） |",
        "",
      ].join("\n"),
      planName: "2026-09-21-plan-p2.3.md",
    });
    const { planClaims } = extractClaimRows(parseOverall(c.overall).historyRows);
    expect([...planClaims.keys()].sort()).toEqual(["P2.1", "P2.2", "P2.3"]);
  });

  it("face ①/②: sub-phase design tokens attribute per phase — `p2-design` and `p2.1-design` live under their own rows and doc globs", () => {
    // The own-token derivation must not merge ridges: P2.1's design claim satisfies P2.1's row and
    // its dotted design-doc glob, P2's its own — a ridge-blind attribution would cross-fire the
    // forward/reverse claim checks or demand the wrong doc file.
    const c = writeChain({
      overall: [
        "- **Version**: v1.2 · 2026-09-21",
        "",
        "## Issue inventory",
        "",
        "| Phase | Issue (ref) | Title summary |",
        "|---|---|---|",
        "| P2 | none | base issue |",
        "| P2.1 | none | sub-phase issue |",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P2 | phase two | **p2-design** | [Pending] | | none |",
        "| P2.1 | phase two-one | **p2.1-design** | [Pending] | | P2 -> |",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | Initial |",
        "| v1.1 | 2026-09-21 | P2 Design-spec 列回填（[Pending]→p2-design v1.0） |",
        "| v1.2 | 2026-09-21 | P2.1 Design-spec 列回填（[Pending]→p2.1-design v1.0） |",
        "",
      ].join("\n"),
      planName: "2026-09-21-demo-p2.1.md",
    });
    // face ② design-doc globs (slug "plan") — each own token needs its own dotted-id file
    writeFileSync(
      path.join(c.repo, "docs", "osuperpowers", "specs", "2026-09-21-plan-p2-design.md"),
      "# d2\n",
    );
    writeFileSync(
      path.join(c.repo, "docs", "osuperpowers", "specs", "2026-09-21-plan-p2.1-design.md"),
      "# d21\n",
    );
    expect(run(c)).toEqual([]);
  });

  it("face ②: an own-token regex matches the sub-phase id LITERALLY — a near-miss cell (`p2-1-design`) is not P2.1's token", () => {
    // The canonical sub-phase id embeds a literal dot; the own-token regex derived for P2.1 must
    // NOT match `p2-1-design` (a hyphen form the strict-A grammar rejects) — an unescaped dot
    // would glom the two characters and falsely demand the (missing) P2.1 design doc.
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P2.1 | phase two-one | **p2-1-design** | [Pending] | | none |",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | Initial |",
        "",
      ].join("\n"),
      planName: "2026-09-21-plan-p2.1.md",
    });
    expect(run(c)).toEqual([]);
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
      overall: AUDIT_OVERALL.replace(
        "| P2 | phase two | [Pending] | [Pending] | | P1 ->(hard) |",
        "| P2 | phase two | [Pending] | [Pending] | | P9 ->(hard) |",
      ),
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

  it("face ④: sub-phase dispatch plan (`…-p2.1.md`) resolves its id THROUGH the chain (Design-spec cell carries the spec)", () => {
    // The chain resolution (design §2.1 item 2 ④ — 不依赖 basename 编号) must find the P2.1 row
    // whose Design-spec cell links the plan's `**Spec:**` spec and return its REGISTERED id P2.1.
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P2.1 | phase two-one | [plan-design v1.0](plan-design.md) | [Pending] | | none |",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | Initial |",
        "",
      ].join("\n"),
      planName: "2026-09-21-demo-p2.1.md",
    });
    expect(run(c)).toEqual([]);
  });

  it("face ④: a Design-spec cell carrying only its own `P<digits>(.digits)*-design` token (no file link) still resolves the phase id → registered", () => {
    // The token strand of the chain resolution: the plan's `**Spec:**` spec has the sub-phase id
    // in its filename (`…p2.1-design.md`), and the P2.1 row's design cell carries the own
    // `p2.1-design` token without a link — the row is still identified and its registered id is
    // preserved (a ridge-blind scan would return the base P2).
    const specName = "2026-09-21-plan-p2.1-design.md";
    const c = writeChain({
      plan: `# Plan\n\n**Spec:** [${specName}](docs/osuperpowers/specs/${specName})\n\n## Constraints\n\n- c\n\n### Task 1: x\nbody\n`,
      spec: "- **Version**: v1.0 · 2026-09-21\n\n- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)\n",
      overall: [
        "- **Version**: v1.1 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|---|---|",
        "| P2.1 | phase two-one | **p2.1-design** | [Pending] | | none |",
        "",
        "## Change history",
        "",
        "| Version | date | summary |",
        "|---|---|---|",
        "| v1.0 | 2026-09-21 | Initial |",
        "| v1.1 | 2026-09-21 | P2.1 Design-spec 列回填（[Pending]→p2.1-design v1.0） |",
        "",
      ].join("\n"),
      planName: "2026-09-21-demo-p2.1.md",
    });
    // the token-strand spec file the plan's `**Spec:**` targets (also satisfies the face ② glob
    // `-plan-p2.1-design.md` under the dotted id)
    writeFileSync(path.join(c.repo, "docs", "osuperpowers", "specs", specName), validSpec());
    expect(run(c)).toEqual([]);
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

// ---- Plan-column three-state machine + explicit-claim-only parsing (P4.3 Task 8 #274) ---- //

describe("plan column three-state — `[Pending]` → `[In-flight]` → `**Done**` (P4.3 Task 8)", () => {
  it("isPendingText / isInflightText — the three-state recognition (pending vs in-flight vs shipped)", () => {
    expect(isPendingText("[Pending]")).toBe(true);
    expect(isPendingText("Pending")).toBe(true);
    expect(isPendingText("")).toBe(true);
    expect(isInflightText("[In-flight]")).toBe(true);
    expect(isInflightText("In-flight")).toBe(true);
    expect(isPendingText("[In-flight]")).toBe(false);
    expect(isPendingText("In-flight")).toBe(false);
    expect(isInflightText("[Pending]")).toBe(false);
    expect(isInflightText("Done")).toBe(false);
    expect(isInflightText("**Done**")).toBe(false);
  });

  // A self-contained three-state overall: P1 flows [Pending] → [In-flight] → **Done**, P2 pending
  // (the dispatch entry), P1's plan doc on disk (writeAuditChain lands it).
  const THREE_STATE_OVERALL = [
    "- **Version**: v1.0 · 2026-09-21",
    "",
    "## Issue inventory",
    "",
    "| Phase | Issue (ref) | Title summary |",
    "|---|---|---|",
    "| P1 | none | issue one |",
    "| P2 | none | issue two |",
    "",
    "## Phase inventory",
    "",
    "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
    "|---|---|---|---|---|---|---|",
    "| P1 | phase one | [Pending] | {PLAN} | | none |",
    "| P2 | phase two | [Pending] | [Pending] | | P1 ->(hard) |",
    "",
    "## Dependency graph (ASCII)",
    "",
    "```",
    "P1 -> P2",
    "```",
    "",
    "## Change history",
    "",
    "| Version | date | summary |",
    "|---|---|---|",
    "| v1.0 | 2026-09-21 | Initial |",
    "",
  ].join("\n");

  it("`[Pending]` plan column → clean (no plan-doc obligation, no claim) and `[In-flight]` with its plan doc and NO claim → clean (reverse-claim carve-out, non-mismatch cell)", () => {
    const pending = writeAuditChain({
      overall: THREE_STATE_OVERALL.replace("{PLAN}", "[Pending]"),
    });
    expect(run(pending)).toEqual([]);
    const inflight = writeAuditChain({
      overall: THREE_STATE_OVERALL.replace("{PLAN}", "[In-flight]"),
    });
    expect(run(inflight)).toEqual([]); // started (已开工): the plan doc is on disk, yet no closeout claim is owed
  });

  it("`[In-flight]` is a non-missing cell — deleting the plan doc still fails face ②", () => {
    const c = writeAuditChain({ overall: THREE_STATE_OVERALL.replace("{PLAN}", "[In-flight]") });
    unlinkSync(path.join(c.repo, "docs", "osuperpowers", "plans", "2026-09-21-plan-p1.md"));
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /missing/i.test(x.missing))).toBe(true);
  });

  it("`**Done` closeout demands a claim — a shipped column without one fails the reverse rule", () => {
    const c = writeAuditChain({ overall: THREE_STATE_OVERALL.replace("{PLAN}", "**Done**") });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /backfill/i.test(x.field))).toBe(true);
  });

  it("three-state + claim only at closeout — `**Done**` + matching claim → clean (the legal terminal state)", () => {
    const overall = THREE_STATE_OVERALL.replace("{PLAN}", "**Done**")
      .replace("- **Version**: v1.0 · 2026-09-21", "- **Version**: v1.1 · 2026-09-21")
      .replace(
        "| v1.0 | 2026-09-21 | Initial |",
        "| v1.0 | 2026-09-21 | Initial |\n| v1.1 | 2026-09-21 | P1 Implementation plan 列回填（[Pending]→Done） |",
      );
    const c = writeAuditChain({ overall });
    expect(run(c)).toEqual([]);
  });

  it("face ① forward: a claim targeting `Done` vs an `[In-flight]` column → NOT a mismatch (in-flight carve-out)", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace(
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | Done | | |",
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | [In-flight] | | |",
      ),
    });
    // The change-history still carries the P1 plan claim (v1.1) + the P1 plan doc is on disk —
    // the in-flight column is a legal mid-dispatch state, never a forward mismatch.
    expect(run(c)).toEqual([]);
  });

  it("face ①: a link-form plan column pointing at the phase's own plan doc satisfies its claim (own-document equivalence, ownDesignToken-aligned)", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace(
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | Done | | |",
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | [p1-plan v1.1](2026-09-21-plan-p1.md) | | |",
      ),
    });
    expect(run(c)).toEqual([]);
  });

  it("face ①: a link-form plan column pointing at a DIFFERENT plan doc → forward mismatch (own-document identity fails)", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace(
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | Done | | |",
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | [p1-plan v1.1](2026-09-21-plan-p9.md) | | |",
      ),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /backfill/i.test(x.field))).toBe(true);
  });

  it("face ① reverse: a shipped link-form plan column with no matching claim → reverse failure", () => {
    const c = writeAuditChain({
      overall: AUDIT_OVERALL.replace(
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | Done | | |",
        "| P1 | phase one | [p1-design v1.0](2026-09-21-plan-p1-design.md) | [p1-plan v1.1](2026-09-21-plan-p1-plan.md) | | |",
      ).replace("| v1.1 | 2026-09-21 | P1 Implementation plan 列回填（[Pending]→Done） |", ""),
    });
    const f = run(c);
    expect(f.some((x) => x.artifact === "overall" && /backfill/i.test(x.field))).toBe(true);
  });
});

describe("extractClaimRows — explicit claim structure only (P4.3 Task 8)", () => {
  // The parse shape extractClaimRows consumes (a change-history row's summary cell).
  function row(summary: string) {
    return { version: [1, 2] as [number, number], date: "2026-09-21", summary };
  }

  it("a prose-mentioned phase in the SAME claim clause is not a target (window scan, not whole-clause)", () => {
    const { planClaims, proseHints } = extractClaimRows([
      row("P1 Implementation plan 列回填（[Pending]→Done）+ Dependency graph P1→P3 边"),
    ]);
    expect([...planClaims.keys()]).toEqual(["P1"]);
    expect(planClaims.get("P1")).toBe("Done"); // the claim key is the explicit target
    expect(proseHints.get("P1")).toEqual(["P3"]); // the same-clause prose mention rides as the hint
  });

  it("two comma-joined claims in one clause attribute phases via successive windows", () => {
    const { planClaims } = extractClaimRows([
      row("P1 Implementation plan 列回填（[Pending]→Done），P2 计划列回填（[Pending]→Done）"),
    ]);
    expect([...planClaims.keys()].sort()).toEqual(["P1", "P2"]);
  });

  it("a clause with BOTH a plan and a design claim attributes each target by its own window", () => {
    const { planClaims, designClaims } = extractClaimRows([
      row("P1 计划列回填（[Pending]→Done）+ P2 Design-spec 列回填（[Pending]→p2-design v1.0）"),
    ]);
    expect([...planClaims.keys()]).toEqual(["P1"]);
    expect(designClaims.get("P2")).toBe("p2-design");
  });

  it("a ranged claim stays range-expanded inside its window (P2.1–P2.3 → every endpoint + intermediate)", () => {
    const { planClaims } = extractClaimRows([
      row("P2.1–P2.3 Implementation plan 列回填（[Pending]→Done）"),
    ]);
    expect([...planClaims.keys()].sort()).toEqual(["P2.1", "P2.2", "P2.3"]);
  });

  it("P3.8 scene: prose-mentioned P3 in the claim clause is NOT a claim target — no false reverse/forward mismatch on P3's `[In-flight]` column, and the P1 forward failure carries the diagnosis hint", () => {
    const overall = [
      "- **Version**: v1.2 · 2026-09-21",
      "",
      "## Phase inventory",
      "",
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "|---|---|---|---|---|---|---|",
      "| P1 | phase one | [Pending] | [Pending] | | none |",
      "| P2 | phase two | [Pending] | [Pending] | | none |",
      "| P3 | phase three | [Pending] | [In-flight] | | none |",
      "",
      "## Change history",
      "",
      "| Version | date | summary |",
      "|---|---|---|",
      "| v1.0 | 2026-09-21 | Initial |",
      "| v1.1 | 2026-09-21 | P1 Implementation plan 列回填（[Pending]→Done）+ Dependency graph P1→P3 边 |",
      "",
    ].join("\n");
    const c = writeAuditChain({ overall, planName: "2026-09-21-plan-p2.md" });
    // The in-flight P3 plan doc (face ② non-missing cell) + the shipped P1 plan doc must exist:
    writeFileSync(
      path.join(c.repo, "docs", "osuperpowers", "plans", "2026-09-21-plan-p1.md"),
      "# p\n",
    );
    writeFileSync(
      path.join(c.repo, "docs", "osuperpowers", "plans", "2026-09-21-plan-p3.md"),
      "# p\n",
    );
    const f = run(c);
    const claimHits = f.filter((x) => /backfill|claim/i.test(x.field));
    expect(claimHits.some((x) => x.missing.includes("P1"))).toBe(true); // forward mismatch on P1
    expect(claimHits.some((x) => /P3/.test(x.missing))).toBe(true); // the same-clause prose hint names P3
    expect(
      claimHits.some((x) => /P3/.test(x.missing) && /claim target|same-clause/.test(x.missing)),
    ).toBe(true);
    // No claim failure surfaces on the in-flight phase itself: its column is not a target and owes no claim.
    expect(claimHits.some((x) => x.missing.includes("P3 Implementation"))).toBe(false);
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
    const c = writeChain({
      spec: validSpec("- **Parent program**: [plan-overall.md v9.9](./plan-overall.md)"),
    });
    const f = run(c);
    // The check moved from the spec face into the overall contract face — artifact is the overall.
    expect(f.some((x) => x.artifact === "overall" && /v9\.9/.test(x.missing))).toBe(true);
    expect(f.some((x) => x.artifact === "phase spec" && /v9\.9/.test(x.missing))).toBe(false);
  });

  it("merged version-lineage: a pinned token the overall DOES carry → no failure", () => {
    const c = writeChain({
      spec: validSpec("- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)"),
    });
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
    const c = writeChain({
      spec: validSpec("- **Parent program**: [plan-overall.md v9.9](./plan-overall.md)"),
    });
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

describe("P4.3 Task 9 #276 — error UX guidance + schema-described authoring shapes", () => {
  it("bad/empty version cell message carries `should look like:` (first-content-cell shape)", () => {
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
        "| ?? | 2026-09-21 | Initial |",
        "",
      ].join("\n"),
    });
    const f = run(c);
    const v = f.find((x) => x.artifact === "overall" && x.field === "Change history");
    expect(v).toBeDefined();
    expect(v!.missing).toMatch(/bad\/empty version/);
    expect(v!.missing).toMatch(/should look like:/);
  });

  it("not-a-Phase-inventory-id issue phase message carries `should look like:`", () => {
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Issue inventory",
        "",
        "| Phase | Issue (ref) | Title summary |",
        "|---|---|---|",
        "| P9 | none | issue one |",
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
      ].join("\n"),
    });
    const f = run(c);
    const issue = f.find((x) => x.artifact === "overall" && x.field === "Issue inventory");
    expect(issue).toBeDefined();
    expect(issue!.missing).toMatch(/is not a Phase-inventory id/);
    expect(issue!.missing).toMatch(/should look like:/);
  });

  it("unrecognized issue ref message carries `should look like:` (the retired `none (dogfood session …)` literal is rejected)", () => {
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Issue inventory",
        "",
        "| Phase | Issue (ref) | Title summary |",
        "|---|---|---|",
        "| P1 | none (dogfood session 2026-09-21 discovery) | issue one |",
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
      ].join("\n"),
    });
    const f = run(c);
    const issue = f.find((x) => x.artifact === "overall" && x.field === "Issue inventory");
    expect(issue).toBeDefined();
    expect(issue!.missing).toMatch(/unrecognized issue ref/);
    expect(issue!.missing).toMatch(/should look like:/);
  });

  it("non-canonical Phase inventory header failure no longer offers the 7-column hint and names the actual gate", () => {
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
    const ph = f.find((x) => x.artifact === "overall" && x.field === "Phase inventory");
    expect(ph).toBeDefined();
    expect(ph!.missing).toMatch(/non-canonical/);
    expect(ph!.fix).not.toMatch(/7-column/);
    expect(ph!.fix).toMatch(/Implementation plan/);
  });

  it("every chapter of the schema-described authoring surface passes the doc-contract gate (regression — §验收 ②)", () => {
    // A whole overall written per the Task 9 descriptions: six-content-cell Phase rows, all five
    // legal issue-ref forms (none / `#NNN` / `[#NNN]` / `#NNN#issuecomment-<digits>` / whole-cell
    // parenthetical), and a conventional one-line `| Version | date | summary |` heading.
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Issue inventory",
        "",
        "| Phase | Issue (ref) | Title summary |",
        "|---|---|---|",
        "| P1 | none | issue one |",
        "| P1 | #123 | issue two |",
        "| P1 | [#123] | issue three |",
        "| P1 | #123#issuecomment-456 | issue four |",
        "| P1 | （note） | issue five |",
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
      ].join("\n"),
    });
    expect(run(c)).toEqual([]);
  });

  it("issue-inventory rows carrying EVERY legal ref form still fail face ④ when the phase is unregistered (guidance works with valid refs)", () => {
    // The should-look-like guidance must not mask the failure: write a valid ref on an
    // unregistered phase — the SAME unrecognized-shape gate logic must not fire (the ref is
    // fine), only the phase-registration failure does.
    const c = writeChain({
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Issue inventory",
        "",
        "| Phase | Issue (ref) | Title summary |",
        "|---|---|---|",
        "| P9 | #123#issuecomment-456 | issue one |",
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
      ].join("\n"),
    });
    const f = run(c);
    expect(
      f.some((x) => x.field === "Issue inventory" && /not a Phase-inventory id/.test(x.missing)),
    ).toBe(true);
    expect(
      f.some((x) => x.field === "Issue inventory" && /unrecognized issue ref/.test(x.missing)),
    ).toBe(false);
  });
});
