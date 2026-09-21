// packages/cdd-engine/src/rules/__tests__/closeout.test.ts — P2 Task 4: the SINGLE closeout
// mismatch inference module (rules/closeout.ts). The module merges the engine-derived terminal
// state (plan-complete) into the overall declaration source and infers the mismatch set on two
// surfaces:
//
//   structural    — the single audit entry (validateDispatchDocuments) consumed verbatim — the
//                   four-table 声明源 ↔ 列 bidirectional full-column (missing cell / missing claim).
//   terminal-debt — plan-complete (derivePlanVerdict.done over EVERY plan workspace under the
//                   parent overall) but the overall carries no backfill claim for the phase
//                   (v1.12: 回填 = branch-review 前置义务 — an unpaid completed plan is debt until
//                   the orchestration backfills the overall).
//
// Same-source regression contract: deriveCloseoutMismatches is consumed by BOTH the pre-flight hard
// gate (base docContractValidate) and the post-flight highlight (base statusValidate) — changing
// the inference here changes both channels together. Read-only by construction: a plan workspace
// without progress.json (fresh checkout / undispatched plan) is treated as not-done (零误伤, and a
// never-done write).
import { it, expect, describe } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  deriveCloseoutMismatches,
  deriveTerminalDebt,
  formatCloseoutDebtFailures,
  formatCloseoutDebtHighlight,
} from "../closeout.ts";
import { resolveWorkspace } from "../../artifacts/handoff/naming.ts";

function repoDir(): string {
  return mkdtempSync(path.join(tmpdir(), "cdd-closeout-"));
}

// ---- program-shaped fixtures (slug "demo", phases P1 / P2) ----

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

interface Program {
  repo: string;
  specDir: string;
  plansDir: string;
  overall: string;
  spec1: string; // the design spec for phase one
  plan1: string; // the plan doc for phase one
  plan2: string; // the plan doc for phase two
}

/** Write the three-doc program chain. Derived counter-level: overall in specs/, plans under
 *  plans/ matching `*-demo-p1.md` / `*-demo-p2.md` (the canonical program glob). */
function writeProgram(overallBody = OVERALL_CLEAN): Program {
  const repo = repoDir();
  const specDir = path.join(repo, "docs", "osuperpowers", "specs");
  const plansDir = path.join(repo, "docs", "osuperpowers", "plans");
  mkdirSync(specDir, { recursive: true });
  mkdirSync(plansDir, { recursive: true });
  const overall = path.join(specDir, "2026-01-01-demo-overall.md");
  const spec1 = path.join(specDir, "2026-01-01-demo-p1-design.md");
  const plan1 = path.join(plansDir, "2026-01-01-demo-p1.md");
  const plan2 = path.join(plansDir, "2026-01-01-demo-p2.md");
  writeFileSync(overall, overallBody);
  writeFileSync(spec1, [
    "- **Version**: v1.0 · 2026-09-21",
    "",
    "- **Parent program**: [2026-01-01-demo-overall.md v1.0](./2026-01-01-demo-overall.md)",
    "",
  ].join("\n"));
  const planBody = (specBasename: string) => [
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
  writeFileSync(plan1, planBody("2026-01-01-demo-p1-design.md"));
  writeFileSync(plan2, planBody("2026-01-01-demo-p2-design.md"));
  return { repo, specDir, plansDir, overall, spec1, plan1, plan2 };
}

/** Land a COMPLETE plan (all tasks converged to complete) in the plan's workspace — progress.json
 *  rows + the APPROVED review-1 carriers (the engine-derived terminal state the debt inference
 *  consumes). The workspace is derived through the canonical resolveWorkspace (no hand-written slug
 *  drift). */
function writeCompletePlanWorkspace(repo: string, planPath: string, taskCount = 1): string {
  const ws = resolveWorkspace(planPath, repo);
  mkdirSync(ws, { recursive: true });
  const tasks: Array<{ task: number; rounds: Record<string, number> }> = [];
  for (let n = 1; n <= taskCount; n++) {
    tasks.push({ task: n, rounds: { review: 1 } });
    writeFileSync(path.join(ws, `task-${n}-review-1.json`), JSON.stringify({
      task: n, phase: "review", status: "APPROVED", findings: [], artifacts: {},
    }));
  }
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify({ plan: planPath, tasks }));
  return ws;
}

/** Land an IN-FLIGHT workspace (progress row without a completed review) — the plan is dispatched
 *  but not complete. */
function writeInFlightPlanWorkspace(repo: string, planPath: string, taskCount = 1): string {
  const ws = resolveWorkspace(planPath, repo);
  mkdirSync(ws, { recursive: true });
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify({
    plan: planPath,
    tasks: Array.from({ length: taskCount }, (_, i) => ({ task: i + 1 })),
  }));
  return ws;
}

describe("deriveTerminalDebt — plan-complete unbackfilled (the terminal-debt surface)", () => {
  it("complete plan + no backfill claim → one terminal-debt item for the phase (guidance)", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const debt = deriveTerminalDebt(p.overall, p.repo);
    expect(debt).toHaveLength(1);
    expect(debt[0]!.surface).toBe("terminal-debt");
    expect(debt[0]!.phase).toBe("P1");
    expect(debt[0]!.kind).toBe("plan-complete-unbackfilled");
    expect(debt[0]!.fix).toMatch(/backfill-overall|backfill/);
  });

  it("backfilled overall (claim + column Done) → no terminal debt (已回填 → 放行)", () => {
    const p = writeProgram(OVERALL_BACKFILLED);
    writeCompletePlanWorkspace(p.repo, p.plan1);
    expect(deriveTerminalDebt(p.overall, p.repo)).toEqual([]);
  });

  it("non-complete plan (in-flight task, no APPROVED review) → no debt", () => {
    const p = writeProgram();
    writeInFlightPlanWorkspace(p.repo, p.plan1);
    expect(deriveTerminalDebt(p.overall, p.repo)).toEqual([]);
  });

  it("undispatched plan (no progress.json / no workspace) → no debt — fresh-checkout 零误伤", () => {
    const p = writeProgram();
    // No workspace is written for plan1 or plan2 — a fresh checkout has no engine state.
    expect(deriveTerminalDebt(p.overall, p.repo)).toEqual([]);
  });

  it("enumerates ALL plan workspaces under the parent overall — a sibling complete unbackfilled phase contributes (cross-phase debt)", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1); // a complete unbackfilled phase-one plan
    writeInFlightPlanWorkspace(p.repo, p.plan2); // the sibling phase-two plan — in-flight, no debt
    const debt = deriveTerminalDebt(p.overall, p.repo);
    expect(debt).toHaveLength(1);
    expect(debt[0]!.phase).toBe("P1"); // only P1 is complete-and-unbackfilled
  });

  it("unparseable overall → no debt (the structural surface already flags the kernel)", () => {
    const p = writeProgram("not a document\n");
    writeCompletePlanWorkspace(p.repo, p.plan1);
    expect(deriveTerminalDebt(p.overall, p.repo)).toEqual([]);
  });
});

describe("deriveCloseoutMismatches — the single module (both surfaces, 同源)", () => {
  it("structural surface mirrors the single audit entry (missing cell / missing claim)", () => {
    const p = writeProgram();
    // Doctor a dangling dependency graph (face ③ illegal state) — the structural surface carries it.
    const broken = OVERALL_CLEAN.replace("\n```\nP1 -> P2\n```", "\n```\nP1 -> P9\n```");
    writeFileSync(p.overall, broken);
    const r = deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    expect(r.structural.some((f) => f.field === "Dependency graph")).toBe(true);
  });

  it("terminal-debt surface merged into the result (plan-complete unbackfilled)", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const r = deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    expect(r.terminalDebt).toHaveLength(1);
    expect(r.terminalDebt[0]!.phase).toBe("P1");
  });

  it("lineage-truncated chain (no parent overall) → no terminal-debt, overallPath null", () => {
    const p = writeProgram();
    // A spec with no Parent program link truncates the chain (AC1 — the four tables no-op).
    writeFileSync(p.spec1, "- **Version**: v1.0 · 2026-09-21\n");
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const r = deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    expect(r.terminalDebt).toEqual([]);
    expect(r.overallPath).toBeNull();
  });

  it("overallPath exposes the resolved parent overall (the Class B lineage)", () => {
    const p = writeProgram();
    const r = deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    expect(r.overallPath).toBe(p.overall);
  });

  it("read-only: the inference never writes — a fresh checkout stays fresh (zero engine doc writes)", () => {
    const p = writeProgram();
    const preTree = [readdirSync(p.repo), readdirSync(path.join(p.repo, "docs", "osuperpowers"))].flat();
    deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    // No workspace is materialized, no progress.json landed, no doc touched
    expect(existsSync(resolveWorkspace(p.plan1, p.repo))).toBe(false);
    expect([readdirSync(p.repo), readdirSync(path.join(p.repo, "docs", "osuperpowers"))].flat()).toEqual(preTree);
  });
});

describe("formatting — the two operator-facing surfaces", () => {
  it("formatCloseoutDebtFailures carries the backfill-overall step + per-phase guidance", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const debt = deriveTerminalDebt(p.overall, p.repo);
    const text = formatCloseoutDebtFailures(debt, p.overall);
    expect(text).toContain("backfill-overall");
    expect(text).toContain("P1");
    expect(text).toContain(p.overall);
  });

  it("formatCloseoutDebtHighlight is the stdout-capturable next-backfill-step line", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const debt = deriveTerminalDebt(p.overall, p.repo);
    const line = formatCloseoutDebtHighlight(debt, p.overall);
    expect(line).toContain("backfill-overall");
    expect(line).toContain(p.overall);
    expect(line).toContain("P1");
  });
});