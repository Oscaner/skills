// packages/cdd-engine/src/rules/__tests__/closeout-fixtures.ts — P2 Task 4: program/test fixtures
// shared by the closeout rule-unit suite (rules/__tests__/closeout.test.ts) and the dispatch
// channel suite (dispatch/__tests__/closeout-channels.test.ts). Single source for the
// program-shaped docs (slug "demo", phases P1/P2) + the engine-workspace writers the closeout debt
// inference consumes — extracted from the two suites' identical copy-paste (previously ~90
// duplicated lines) so the fixture text cannot drift between the two black-box faces.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolveWorkspace } from "../../artifacts/handoff/naming.ts";

const OVERALL_CLEAN = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "|---|---|---|---|---|---|---|",
  "| P1 | phase one | [Pending] | [Pending] | | none |",
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

/** Backfilled-overall fixture (P1 shipped + claim + column): the same chain as OVERALL_CLEAN with
 *  P1's Implementation plan column set to Done and a matching change-history plan claim — the
 *  v1.12 happy path (已回填 → no terminal debt, structural faces pass). */
const OVERALL_BACKFILLED = [
  "- **Version**: v1.1 · 2026-09-21",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "|---|---|---|---|---|---|---|",
  "| P1 | phase one | [p1-design v1.0](2026-01-01-demo-p1-design.md) | Done | | none |",
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
  "| v1.1 | 2026-09-21 | P1 plan: Pending → Done |",
  "",
].join("\n");

/** Design-spec body for the demo phases (linked from the overall via the Parent program line). */
const SPEC = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "- **Parent program**: [2026-01-01-demo-overall.md v1.0](./2026-01-01-demo-overall.md)",
  "",
].join("\n");

/** Plan-doc body pointing back at its design spec (the plan → spec → overall lineage). */
function planBody(specBasename: string): string {
  return [
    "# Plan",
    "",
    `**Spec:** [${specBasename}](docs/osuperpowers/specs/${specBasename})`,
    "",
    "## Constraints",
    "",
    "- boundary one",
    "",
    "### Task 1: x",
    "body",
    "",
  ].join("\n");
}

export { OVERALL_BACKFILLED, OVERALL_CLEAN, planBody, SPEC };

/** The program chain a closeout suite walks: the overall + its phase docs under the canonical
 *  program dirs (`docs/osuperpowers/specs|plans`, filename slug "demo", phases P1 / P2). */
export interface Program {
  repo: string;
  specDir: string;
  plansDir: string;
  overall: string;
  spec1: string; // the design spec for phase one
  spec2: string; // the design spec for phase two
  plan1: string; // the plan doc for phase one
  plan2: string; // the plan doc for phase two
}

/** Fresh temp repo dir for a standalone program (rule-unit suites — no git repo needed). */
export function mkProgramRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "cdd-closeout-"));
}

/** Write the three-doc program chain (overall + p1/p2 design specs + p1/p2 plans) into an
 *  existing repo. Derived counter-level: overall in specs/, plans under plans/ matching
 *  `*-demo-p1.md` / `*-demo-p2.md` (the canonical program glob). The dispatch-channel suite wraps
 *  this with the docs git-commit; the rule-unit suite calls it straight on a fresh temp dir. */
export function writeProgramDocs(repo: string, overallBody: string = OVERALL_CLEAN): Program {
  const specDir = path.join(repo, "docs", "osuperpowers", "specs");
  const plansDir = path.join(repo, "docs", "osuperpowers", "plans");
  mkdirSync(specDir, { recursive: true });
  mkdirSync(plansDir, { recursive: true });
  const overall = path.join(specDir, "2026-01-01-demo-overall.md");
  const spec1 = path.join(specDir, "2026-01-01-demo-p1-design.md");
  const spec2 = path.join(specDir, "2026-01-01-demo-p2-design.md");
  const plan1 = path.join(plansDir, "2026-01-01-demo-p1.md");
  const plan2 = path.join(plansDir, "2026-01-01-demo-p2.md");
  writeFileSync(overall, overallBody);
  writeFileSync(spec1, SPEC);
  writeFileSync(spec2, SPEC);
  writeFileSync(plan1, planBody("2026-01-01-demo-p1-design.md"));
  writeFileSync(plan2, planBody("2026-01-01-demo-p2-design.md"));
  return { repo, specDir, plansDir, overall, spec1, spec2, plan1, plan2 };
}

/** Land a COMPLETE plan (all tasks converged to complete) in the plan's workspace — progress.json
 *  rows + the APPROVED review-1 carriers (the engine-derived terminal state the debt inference
 *  consumes). The workspace is derived through the canonical resolveWorkspace (no hand-written slug
 *  drift). P4.3: task carriers are group-keyed (tasks-{N}-review-1.json). */
export function writeCompletePlanWorkspace(repo: string, planPath: string, taskCount = 1): string {
  const ws = resolveWorkspace(planPath, repo);
  mkdirSync(ws, { recursive: true });
  const tasks: Array<{ task: number; rounds: Record<string, number> }> = [];
  for (let n = 1; n <= taskCount; n++) {
    tasks.push({ task: n, rounds: { review: 1 } });
    writeFileSync(
      path.join(ws, `tasks-${n}-review-1.json`),
      JSON.stringify({
        task: n,
        phase: "review",
        status: "APPROVED",
        findings: [],
        artifacts: {},
      }),
    );
  }
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify({ plan: planPath, tasks }));
  return ws;
}

/** Land an IN-FLIGHT workspace (progress row without a completed review) — the plan is dispatched
 *  but not complete. */
export function writeInFlightPlanWorkspace(repo: string, planPath: string, taskCount = 1): string {
  const ws = resolveWorkspace(planPath, repo);
  mkdirSync(ws, { recursive: true });
  writeFileSync(
    path.join(ws, "progress.json"),
    JSON.stringify({
      plan: planPath,
      tasks: Array.from({ length: taskCount }, (_, i) => ({ task: i + 1 })),
    }),
  );
  return ws;
}
