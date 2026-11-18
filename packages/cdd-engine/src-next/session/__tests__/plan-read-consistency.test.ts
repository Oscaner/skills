// packages/cdd-engine/src-next/session/__tests__/plan-read-consistency.test.ts
// P35 T7 — the three-face consistency gate (design spec §2.6): the board's rendered
// wave rows, the graph the `PreFlight` seam judged and the frontier's wave keys are
// ONE fact, checked in one process (the three observables are reachable here without
// a single CLI call seeing all three layers).
//
// The three cases:
//   · the healthy baseline — a plan with two waves: the board's `W1 {…}` / `W2 {…}`
//     labels, the graph gate's wave set and the frontier's wave keys are element-wise
//     equal. This is a REGRESSION pin, not a change pin: the three faces already read
//     one document, so "no shared fact source" never meant "unequal";
//   · the single-source pin — the read happens ONCE: after the document changes on
//     disk, every face keeps reporting the waves of the value it was handed. A face
//     that re-read the file would report the second document's waves (red first);
//   · the bad plan — a grammar break makes all three faces agree on producing NO
//     wave set (the board renders the value's own literal, the seam refuses before
//     the graph gate, the frontier never enters the wave face) instead of disagreeing.
//
// Module-level exports are none — helpers are arrow consts (the zero-bare-function
// discipline).

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { Contract } from "../../contract/judge.ts";
import type { ArtifactSnapshotRead } from "../../contract/preflight-rows.ts";
import { BoardNext, BoardView } from "../../face/board-view.ts";
import { Words } from "../../face/words.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { GitClient } from "../../infra/git.ts";
import type { PlanRead } from "../../infra/plan-source.ts";
import { RepoRoot } from "../../infra/root.ts";
import { SlugIndex } from "../../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { TemplateAssembler } from "../../render/templates.ts";
import { InFlight } from "../inflight.ts";
import { Ledger } from "../ledger.ts";
import { PipelineFrontier, type PipelineFrontierInput } from "../pipeline.ts";
import { PreFlight, type PreFlightContext } from "../preflight.ts";

const SLUG = "prog-p1";
const SPEC_REL = "docs/kairos/specs/prog-p1-design.md";
const PLAN_REL = "docs/kairos/plans/prog-p1.md";

/** The no-sidecar artifact snapshot — this suite's dispatch never judges a sidecar. */
const ABSENT_SNAPSHOT: ArtifactSnapshotRead = {
  kind: "absent",
  path: null,
  reason: null,
  found: [],
  identity: null,
  sidecarKind: null,
};

/** One task block — the plan grammar's own shape (the block every fixture suite
 *  spells the same way). */
const taskBlock = (id: number, dependsOn: string): readonly string[] => [
  `### Task ${id}: t${id}`,
  "- **Objective**: o",
  "- **Files**: `a.ts`",
  "- **Consumes**: x",
  "- **Produces**: y",
  "- **Steps**:",
  "  - s — checkable: g",
  "- **Acceptance**: ok",
  `- **DependsOn**: ${dependsOn}`,
  "",
];

/** A plan document over the given task layers: each layer depends on the previous
 *  one, so the declared layers ARE the derived batches. */
const planOf = (layers: readonly (readonly number[])[]): string =>
  [
    "---",
    "title: Plan",
    "doc-type: plan",
    "slug: prog-p1",
    "---",
    "",
    "## Constraints",
    "",
    "- c",
    "",
    ...layers.flatMap((layer, index) =>
      layer.flatMap((id) =>
        taskBlock(id, index === 0 ? "none" : (layers[index - 1] ?? []).join(", ")),
      ),
    ),
  ].join("\n");

/** The two-wave healthy document — the baseline's ONE fixture. */
const TWO_WAVES = planOf([[1, 2], [3]]);

/** The grammar-breaking document — a repeated reserved section (the read is
 *  `unreadable`/`syntax` while the front matter still reads out). */
const BROKEN = [
  "---",
  "title: Plan",
  "doc-type: plan",
  "slug: prog-p1",
  "---",
  "",
  "## Constraints",
  "",
  "- c",
  "",
  "### Task 1: t1",
  "- **Objective**: o",
  "- **Files**: `a.ts`",
  "- **Consumes**: x",
  "- **Produces**: y",
  "- **Steps**:",
  "  - s — checkable: g",
  "- **Acceptance**: ok",
  "#### DependsOn",
  "none",
  "#### DependsOn",
  "none",
  "",
].join("\n");

/** The wave keys the board's rendered wave rows name — the label's `{…}` cell. The
 *  wave segment's FIRST row carries the label cell, the later rows the blank pad,
 *  so the key is read off the label the row renders, not the row's prefix. */
const boardWaveKeys = (lines: readonly string[]): string[] =>
  lines.flatMap((line) => {
    const match = /W\d+ \{([^}]*)\}/.exec(line);
    return match === null ? [] : [match[1] ?? ""];
  });

/** Write the phase's derived plan document into one fixture repo. */
const writePlanAt = (repo: string, content: string): string => {
  const file = path.join(repo, PLAN_REL);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, "utf8");
  return file;
};

describe("P35 T7 — the board, the pre-flight graph and the frontier read ONE plan", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "plan-read-consistency-"));
    // The fixture's own writes stay out of the tree: the pre-flight's tree-clean
    // gate judges committed bytes only.
    writeFileSync(path.join(repo, ".gitignore"), ".kairos\n/docs/\n", "utf8");
    writeFileSync(path.join(repo, "seed.txt"), "seed\n", "utf8");
    spawnSync("git", ["init", "-q"], { cwd: repo });
    spawnSync("git", ["config", "user.email", "consistency@test"], { cwd: repo });
    spawnSync("git", ["config", "user.name", "consistency-test"], { cwd: repo });
    spawnSync("git", ["add", "-A"], { cwd: repo });
    spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repo });
    writePlanAt(repo, TWO_WAVES);
    mkdirSync(path.dirname(path.join(repo, SPEC_REL)), { recursive: true });
    writeFileSync(
      path.join(repo, SPEC_REL),
      "---\ntitle: S\ndoc-type: phase-spec\nslug: prog-p1\nprogram: prog-overall\n---\n",
      "utf8",
    );
    writeFileSync(
      path.join(repo, "docs/kairos/specs/prog-overall.md"),
      "---\ntitle: O\ndoc-type: overall\nslug: prog-overall\n---\n",
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  /** The derived read of the phase's plan — the doc face's ONE read. */
  const derivedRead = (): PlanRead => {
    const index = SlugIndex.build(repo);
    const source = planSourceOf(new RepoRoot(repo));
    const specEntry = index.entryAt(SPEC_REL);
    if (specEntry === null) throw new Error("fixture: the phase spec did not register");
    return source.readFor(specEntry);
  };

  /** The node board over ONE handed-in read — the production assembly's shape (the
   *  read table, the injected hop), so the wave rows are the board's own bytes. */
  const boardOf = (read: PlanRead): { lines: string[]; exitCode: number } => {
    const root = new RepoRoot(repo);
    const source = planSourceOf(root);
    const index = SlugIndex.build(repo);
    const entry = index.entryAt(SPEC_REL);
    if (entry === null) throw new Error("fixture: the phase spec did not register");
    const board = BoardView.render(
      [read],
      source,
      index,
      entry,
      repo,
      new Words(),
      "claude",
      {},
      undefined,
      BoardNext.of(read, source, index, entry, root),
    );
    return { lines: [...board.lines], exitCode: board.exitCode };
  };

  /** The phase's ledger over the fixture repo (the same workspace production builds). */
  const ledgerOf = (): Ledger =>
    new Ledger(
      new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), SLUG).ensure(),
      new ConfigLoader(),
      planSourceOf(new RepoRoot(repo)),
    );

  /** Close the two doc lines (a zero-findings review each) so the wave face is the
   *  pipeline's frontier — the walk below needs the wave face to be reachable. */
  const closeDocLines = (ledger: Ledger): void => {
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
  };

  /** The frontier's input — the SAME read the board and the seam were handed. */
  const frontierInputOf = (read: PlanRead): PipelineFrontierInput => ({
    specType: "phase-spec",
    specPath: SPEC_REL,
    planPath: read.stationPath(),
    plan: read,
  });

  /** Every wave key the frontier ROUTES on — walk the batches, each one becoming the
   *  ready frontier in turn (the same `join(",")` key the wave row carries). */
  const frontierWaveKeys = (read: PlanRead): string[] => {
    const graph = read.graph();
    if (graph === null) return [];
    const ledger = ledgerOf();
    closeDocLines(ledger);
    const frontier = new PipelineFrontier(ledger);
    const input = frontierInputOf(read);
    const keys: string[] = [];
    for (const batch of graph.batches()) {
      const key = batch.join(",");
      // A dispatched-but-BLOCKED implement round: the face is ENTERED, its line still
      // awaits the implement dispatch — so the verdict names this batch's key.
      ledger.recordRound(key, {
        op: "implement",
        verdict: { treeClean: true, targetAction: false },
      });
      const verdict = frontier.next(input);
      if (verdict.target?.type === "wave") keys.push(String(verdict.target.id));
      ledger.persistHandoff("review", "wave", { tasks: key, round: 1 }, { findings: [] });
      ledger.recordRound(key, { op: "review" });
    }
    return keys;
  };

  /** The wave-face pre-flight context over ONE handed-in read — the graph gate's
   *  input is the value's own `graph()` (§2.5), never a second parse. The four
   *  pre-dispatch rows (P40 T4) get their healthy facts: this suite judges the graph
   *  gate, not the input face. */
  const preflightCtxOf = (read: PlanRead): PreFlightContext => {
    const values: Record<string, string> = {
      ROLE: "implement",
      WAVE: "1,2",
      INPUT_WAVE_BRIEF: "tasks-1,2-brief.md",
      OUTPUT_REPORT: "report.md",
      OUTPUT_EVIDENCE: "evidence.json",
      OUTPUT_HANDOFF: "handoff.json",
      WORKSPACE_DIR: `.kairos/cdd/${SLUG}`,
      WORKSPACE_ID: SLUG,
    };
    return {
      type: "wave",
      repoRoot: repo,
      plan: read,
      ledger: ledgerOf(),
      doc: null,
      inflight: new InFlight(new WorkspaceRoot(repo, ".kairos/cdd"), SLUG, {
        live: async () => false,
      }),
      host: "claude",
      values,
      declarations: new TemplateAssembler().layoutOf(values),
      scene: { program: false, docType: false },
      artifact: { kind: "read", reviewsPath: null, read: ABSENT_SNAPSHOT },
    };
  };

  const preflightOf = (): PreFlight =>
    new PreFlight({ git: new GitClient(), contract: new Contract(), words: new Words() });

  it("healthy baseline — the board rows, the graph gate's waves and the frontier keys are one list", async () => {
    const read = derivedRead();
    expect(read.kind).toBe("ready");
    // ① the board's rendered wave rows.
    const board = boardOf(read);
    expect(board.exitCode).toBe(0);
    expect(boardWaveKeys(board.lines)).toEqual(["1,2", "3"]);
    // ② the graph the pre-flight judges — the wave set it derives from the value.
    const verdict = await preflightOf().vet(preflightCtxOf(read));
    expect(verdict.ok).toBe(true);
    expect(verdict.order).toContain("graph");
    const graphWaves = read
      .graph()!
      .report(new Set<number>())
      .waves.map((wave) => wave.join(","));
    // ③ the frontier's routed wave keys.
    const frontierKeys = frontierWaveKeys(read);
    expect(graphWaves).toEqual(boardWaveKeys(board.lines));
    expect(frontierKeys).toEqual(boardWaveKeys(board.lines));
  });

  it("single source — the document changes on disk after the read and every face keeps the value's waves", async () => {
    const read = derivedRead();
    const before = boardWaveKeys(boardOf(read).lines);
    expect(before).toEqual(["1,2", "3"]);
    // The second document on disk: a grammar break. A face that re-reads would
    // report it (the board would fold, the seam would refuse, the frontier would
    // hold no graph) — so every face below is evidence the read happened ONCE.
    writePlanAt(repo, BROKEN);
    // ① the board renders the handed-in read's rows, unchanged.
    expect(boardWaveKeys(boardOf(read).lines)).toEqual(before);
    // ② the pre-flight still passes the graph gate it ran on this value.
    const verdict = await preflightOf().vet(preflightCtxOf(read));
    expect(verdict.ok).toBe(true);
    expect(verdict.order).toContain("graph");
    // ③ the frontier still routes the value's keys.
    expect(frontierWaveKeys(read)).toEqual(before);
  });

  it("bad plan — all three faces produce NO wave set, never disagreeing lists", async () => {
    writePlanAt(repo, BROKEN);
    const read = derivedRead();
    expect(read.kind).toBe("unreadable");
    // The two distinct facts the value carries: the front-matter path survives, the
    // graph does not.
    expect(read.stationPath()).toBe(PLAN_REL);
    expect(read.graph()).toBeNull();
    // ① the board renders the value's own literal — never a half wave set.
    const board = boardOf(read);
    expect(board.lines).toContain(`  wave     ! unparseable`);
    expect(board.lines).toContain(`  plan     ${PLAN_REL} · ! unparseable`);
    expect(board.lines).toContain("  next:    (none)");
    expect(boardWaveKeys(board.lines)).toEqual([]);
    // ② the seam refuses at the plan carrier, before the graph gate ever runs.
    const verdict = await preflightOf().vet(preflightCtxOf(read));
    expect(verdict.ok).toBe(false);
    expect(verdict.gate).toBe("doc-contract");
    expect(verdict.reason).toBe("doc-contract");
    expect(verdict.order).not.toContain("graph");
    // ③ the frontier derives no wave key (the wave face is never entered).
    expect(frontierWaveKeys(read)).toEqual([]);
    const next = new PipelineFrontier(ledgerOf()).next(frontierInputOf(read));
    expect(next.target?.type).not.toBe("wave");
  });
});
