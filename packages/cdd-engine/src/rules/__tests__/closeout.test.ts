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
//
// The program fixtures + engine-workspace writers live in ./closeout-fixtures.ts (shared with
// dispatch/__tests__/closeout-channels.test.ts — single source, no drift between the two faces).

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkspace } from "../../artifacts/handoff/naming.ts";
import { CloseoutChecker } from "../closeout.ts";

const closeoutChecker = new CloseoutChecker();

import {
  mkProgramRepo,
  OVERALL_BACKFILLED,
  OVERALL_CLEAN,
  type Program,
  writeCompletePlanWorkspace,
  writeInFlightPlanWorkspace,
  writeProgramDocs,
} from "./closeout-fixtures.ts";

/** The three-doc program chain in a fresh temp repo. Derived counter-level: overall in specs/,
 *  plans under plans/ matching `*-demo-p1.md` / `*-demo-p2.md` (the canonical program glob). */
function writeProgram(overallBody = OVERALL_CLEAN): Program {
  return writeProgramDocs(mkProgramRepo(), overallBody);
}

describe("deriveTerminalDebt — plan-complete unbackfilled (the terminal-debt surface)", () => {
  it("complete plan + no backfill claim → one terminal-debt item for the phase (guidance)", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const debt = closeoutChecker.deriveTerminalDebt(p.overall, p.repo);
    expect(debt).toHaveLength(1);
    expect(debt[0]!.surface).toBe("terminal-debt");
    expect(debt[0]!.phase).toBe("P1");
    expect(debt[0]!.kind).toBe("plan-complete-unbackfilled");
    expect(debt[0]!.fix).toMatch(/backfill-overall|backfill/);
  });

  it("backfilled overall (claim + column Done) → no terminal debt (已回填 → 放行)", () => {
    const p = writeProgram(OVERALL_BACKFILLED);
    writeCompletePlanWorkspace(p.repo, p.plan1);
    expect(closeoutChecker.deriveTerminalDebt(p.overall, p.repo)).toEqual([]);
  });

  it("non-complete plan (in-flight task, no APPROVED review) → no debt", () => {
    const p = writeProgram();
    writeInFlightPlanWorkspace(p.repo, p.plan1);
    expect(closeoutChecker.deriveTerminalDebt(p.overall, p.repo)).toEqual([]);
  });

  it("undispatched plan (no progress.json / no workspace) → no debt — fresh-checkout 零误伤", () => {
    const p = writeProgram();
    // No workspace is written for plan1 or plan2 — a fresh checkout has no engine state.
    expect(closeoutChecker.deriveTerminalDebt(p.overall, p.repo)).toEqual([]);
  });

  it("enumerates ALL plan workspaces under the parent overall — a sibling complete unbackfilled phase contributes (cross-phase debt)", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1); // a complete unbackfilled phase-one plan
    writeInFlightPlanWorkspace(p.repo, p.plan2); // the sibling phase-two plan — in-flight, no debt
    const debt = closeoutChecker.deriveTerminalDebt(p.overall, p.repo);
    expect(debt).toHaveLength(1);
    expect(debt[0]!.phase).toBe("P1"); // only P1 is complete-and-unbackfilled
  });

  it("unparseable overall → no debt (the structural surface already flags the kernel)", () => {
    const p = writeProgram("not a document\n");
    writeCompletePlanWorkspace(p.repo, p.plan1);
    expect(closeoutChecker.deriveTerminalDebt(p.overall, p.repo)).toEqual([]);
  });
});

describe("deriveCloseoutMismatches — the single module (both surfaces, 同源)", () => {
  it("structural surface mirrors the single audit entry (missing cell / missing claim)", () => {
    const p = writeProgram();
    // Doctor a dangling dependency graph (face ③ illegal state) — the structural surface carries it.
    const broken = OVERALL_CLEAN.replace("\n```\nP1 -> P2\n```", "\n```\nP1 -> P9\n```");
    writeFileSync(p.overall, broken);
    const r = closeoutChecker.deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    expect(r.structural.some((f) => f.field === "Dependency graph")).toBe(true);
  });

  it("terminal-debt surface merged into the result (plan-complete unbackfilled)", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const r = closeoutChecker.deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    expect(r.terminalDebt).toHaveLength(1);
    expect(r.terminalDebt[0]!.phase).toBe("P1");
  });

  it("lineage-truncated chain (no parent overall) → no terminal-debt, overallPath null", () => {
    const p = writeProgram();
    // A spec with no Parent program link truncates the chain (AC1 — the four tables no-op).
    writeFileSync(p.spec1, "- **Version**: v1.0 · 2026-09-21\n");
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const r = closeoutChecker.deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    expect(r.terminalDebt).toEqual([]);
    expect(r.overallPath).toBeNull();
  });

  it("overallPath exposes the resolved parent overall (the Class B lineage)", () => {
    const p = writeProgram();
    const r = closeoutChecker.deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    expect(r.overallPath).toBe(p.overall);
  });

  it("read-only: the inference never writes — a fresh checkout stays fresh (zero engine doc writes)", () => {
    const p = writeProgram();
    const preTree = [
      readdirSync(p.repo),
      readdirSync(path.join(p.repo, "docs", "osuperpowers")),
    ].flat();
    closeoutChecker.deriveCloseoutMismatches({ entry: p.plan1, root: p.repo });
    // No workspace is materialized, no progress.json landed, no doc touched
    expect(existsSync(resolveWorkspace(p.plan1, p.repo))).toBe(false);
    expect(
      [readdirSync(p.repo), readdirSync(path.join(p.repo, "docs", "osuperpowers"))].flat(),
    ).toEqual(preTree);
  });
});

describe("formatting — the two operator-facing surfaces", () => {
  it("formatCloseoutDebtFailures carries the backfill-overall step + per-phase guidance", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const debt = closeoutChecker.deriveTerminalDebt(p.overall, p.repo);
    const text = closeoutChecker.formatCloseoutDebtFailures(debt, p.overall);
    expect(text).toContain("backfill-overall");
    expect(text).toContain("P1");
    expect(text).toContain(p.overall);
  });

  it("formatCloseoutDebtHighlight is the stdout-capturable next-backfill-step line", () => {
    const p = writeProgram();
    writeCompletePlanWorkspace(p.repo, p.plan1);
    const debt = closeoutChecker.deriveTerminalDebt(p.overall, p.repo);
    const line = closeoutChecker.formatCloseoutDebtHighlight(debt, p.overall);
    expect(line).toContain("backfill-overall");
    expect(line).toContain(p.overall);
    expect(line).toContain("P1");
  });
});
