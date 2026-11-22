// packages/cdd-engine/src-next/session/__tests__/tier-vocabulary.test.ts
// P42 T1 — the tier vocabulary's two faces (design spec §1.1). The WRITE face (the
// child draft's severity enum) narrows to two tiers; the READ face (the stored
// carrier's projection) keeps the retired third, so a legacy `nit` row still rolls up
// to REVIEW_FIX and still marks its cross-round downgrade. Every claim here is pinned
// as a PAIR — the same fixture on both sides of the boundary — so widening or
// narrowing either face alone turns exactly one arm red.
//
//   · the write face refuses `nit` (the read-back message names the two it accepts);
//   · the read face still projects a stored `nit` through the three-value union;
//   · the judge fence carries the two-value enum, the work fence carries no severity
//     slot at all (both come from the ONE `CARRIER` declaration);
//   · `rollup` keeps its four arms byte-identically — warn and nit still read the same;
//   · a legacy all-`nit` carrier still lands REVIEW_FIX on the fix arm;
//   · the tier ladder keeps 2 / 1 / 0, so `warn → nit` still carries the downgrade mark.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { REGRADE_MARK, regradeNote } from "../../contract/review-criteria.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { HandoffSchema } from "../handoff-schema.ts";
import { type FindingSeverity, Ledger, type RoundFinding } from "../ledger.ts";
import { NextStepRouter, type Route } from "../next.ts";
import { ArtifactRegistry } from "../round-artifacts.ts";
import { EMPTY_RUN_STATE } from "../run.ts";

/** The write face's two tiers, keyed by the union itself — the compile-time pin: a
 *  widened union leaves a key missing (`tsc` refuses the literal) and a literal
 *  carrying the retired third tier is an excess property, so the vocabulary cannot
 *  grow back without breaking the build. */
const WRITE_TIER_WEIGHT: Record<FindingSeverity, number> = { blocker: 2, warn: 1 };

/** One finding row of the judge plane — the two cells the write face requires. */
const row = (severity: string, summary: string, scenario?: string) => ({
  severity,
  lens: "standards",
  summary,
  ...(scenario === undefined ? {} : { impact: { scenario } }),
});

/** A hermetic ledger fixture — a fresh temp workspace under a temp repo root. */
const fixture = (): { ledger: Ledger; cleanup: () => void } => {
  const repo = mkdtempSync(path.join(tmpdir(), "tier-vocabulary-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "tier-vocabulary",
  );
  const ledger = new Ledger(
    workspace,
    new ConfigLoader(),
    planSourceOf(workspace.root.basis),
    new ArtifactRegistry(),
  );
  return { ledger, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
};

/** Persist one review carrier, record its completed round and read it back as the
 *  Round the next-hop derivation judges — the legacy carrier's whole trip. */
const roundOf = (ledger: Ledger, findings: readonly unknown[]) => {
  ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [...findings] });
  ledger.recordRound("1", {
    op: "review",
    cycle: 1,
    verdict: { treeClean: true, targetAction: true },
  });
  return ledger.round("review", "wave", { tasks: "1" }, 1);
};

/** A route's comparable shape — the fix hop's carrier path is workspace-absolute, so
 *  two fixtures compare by the carrier's NAME (the bytes this tier change can move). */
const shapeOf = (route: Route | null) =>
  route !== null && route.kind === "fix"
    ? { ...route, reviews: route.reviews === undefined ? undefined : path.basename(route.reviews) }
    : route;

describe("the tier vocabulary — the write face narrows, the read face does not", () => {
  const schema = new HandoffSchema();

  it("refuses a `nit` draft and names the two tiers the write face accepts", () => {
    expect(schema.readBack("judge", { findings: [row("nit", "wording")] }).problems).toEqual([
      "findings[0].severity: must be one of blocker | warn",
    ]);
    // the pair: the same draft one tier up is a legal write — the refusal is the
    // vocabulary, never the row's shape
    expect(schema.readBack("judge", { findings: [row("warn", "wording")] }).problems).toEqual([]);
  });

  it("still projects a stored `nit` through the three-value read union", () => {
    // the legacy carrier is READ, never re-authored: its third tier survives the
    // projection (a narrowed read face would silently drop the row)
    const projected: readonly RoundFinding[] = schema.findingsOf([
      row("nit", "wording"),
      row("warn", "smell"),
    ]);
    expect(projected).toEqual([
      { severity: "nit", summary: "wording" },
      { severity: "warn", summary: "smell" },
    ]);
    // the pair: both faces agree on the two tiers they share
    expect(schema.findingsOf([row("warn", "smell")])).toEqual([
      { severity: "warn", summary: "smell" },
    ]);
    // the runtime face of the same pin: exactly the two tiers the write side accepts
    expect(Object.keys(WRITE_TIER_WEIGHT)).toEqual(["blocker", "warn"]);
  });

  it("carries the two-value enum on the judge fence and no severity slot on the work fence", () => {
    const judge = schema.schemaText("judge", false);
    expect(judge).toContain('"severity":{"type":"string","enum":["blocker","warn"]}');
    expect(judge).not.toContain('"nit"');
    // both fences are projections of the ONE declaration — the work plane writes no
    // finding row, so its fence carries no severity slot to disagree with
    expect(schema.schemaText("work", true)).not.toContain("severity");
  });
});

describe("the tier vocabulary — `rollup`'s four arms, byte-identically", () => {
  const schema = new HandoffSchema();

  it("keeps the four conclusions and reads `warn` and `nit` the same", () => {
    expect(schema.rollup([])).toBe("APPROVED");
    expect(schema.rollup([{ severity: "warn" }])).toBe("REVIEW_FIX");
    // the retired tier still rolls up — a legacy carrier is never an approval
    expect(schema.rollup([{ severity: "nit" }])).toBe("REVIEW_FIX");
    expect(schema.rollup([{ severity: "blocker" }])).toBe("CHANGES_REQUESTED");
    // the two non-blocker arms are one conclusion, whatever the row count
    expect(schema.rollup([{ severity: "warn" }, { severity: "nit" }])).toBe("REVIEW_FIX");
  });
});

describe("the tier vocabulary — a legacy carrier's next hop", () => {
  it("lands an all-`nit` carrier on REVIEW_FIX and the fix arm", () => {
    const { ledger, cleanup } = fixture();
    try {
      const round = roundOf(ledger, [row("nit", "wording")]);
      expect(round?.status).toBe("REVIEW_FIX");
      const route: Route | null = new NextStepRouter().next(EMPTY_RUN_STATE, round!);
      expect(route?.kind).toBe("fix");
      // the pair: the same carrier one tier up reads byte-identically — the third
      // tier costs nothing on the way out
      const { ledger: other, cleanup: otherCleanup } = fixture();
      try {
        const warned = roundOf(other, [row("warn", "wording")]);
        expect(warned?.status).toBe("REVIEW_FIX");
        expect(shapeOf(new NextStepRouter().next(EMPTY_RUN_STATE, warned!))).toEqual(
          shapeOf(route),
        );
      } finally {
        otherCleanup();
      }
    } finally {
      cleanup();
    }
  });

  it("closes a zero-finding carrier through the closure arm — APPROVED, no fix hop", () => {
    const { ledger, cleanup } = fixture();
    try {
      const round = roundOf(ledger, []);
      expect(round?.status).toBe("APPROVED");
      expect(new NextStepRouter().next(EMPTY_RUN_STATE, round!)).toEqual({ kind: "done" });
    } finally {
      cleanup();
    }
  });
});

describe("the tier vocabulary — the downgrade mark survives the retired tier", () => {
  const schema = new HandoffSchema();
  const prior = schema.findingsOf([
    row("warn", "drift", "an empty wave key → no task mirrored → expected a refusal"),
  ]);

  it("marks a `warn → nit` downgrade — the ladder still ranks 1 above 0", () => {
    const current = schema.findingsOf([row("nit", "drift")]);
    const marked = HandoffSchema.downgrades(prior, current);
    expect(marked).toEqual([{ severity: "nit", summary: "drift" }]);
    expect(regradeNote(marked.length, HandoffSchema.regradeReasons(prior, current))).toBe(
      REGRADE_MARK,
    );
  });

  it("marks nothing when the same fixture stays at `warn` — an unchanged grade", () => {
    const current = schema.findingsOf([row("warn", "drift")]);
    expect(HandoffSchema.downgrades(prior, current)).toEqual([]);
    expect(regradeNote(0, HandoffSchema.regradeReasons(prior, current))).toBeUndefined();
  });
});
