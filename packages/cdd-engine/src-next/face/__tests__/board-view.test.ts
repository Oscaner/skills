// packages/cdd-engine/src-next/face/__tests__/board-view.test.ts
// The board face's colocated pins (T5 rework): the entry document → board.
//   · the render face — entry `doc-type:` picks the node/program board; every
//     related node resolves through `SlugIndex` by slug; violation markers and the
//     `(none)` degradation states; the `next:` derivation.
// Fixtures are hermetic tmp dirs (no git needed — pure file-system reads).

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { RepoRoot } from "../../infra/root.ts";
import { type DocEntry, SlugIndex } from "../../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { CarrierIntegrity, CarrierMismatchError } from "../../session/carrier-integrity.ts";
import { DispatchAuthority } from "../../session/dispatch-authority.ts";
import { type RouteTarget, targetFaces } from "../../session/faces.ts";
import type { InFlightRecord } from "../../session/inflight.ts";
import { Ledger, type RoundRecord, RoundViolation } from "../../session/ledger.ts";
import { type NextHop, NextStepRouter, REVIEW_CYCLE_CAP, type Route } from "../../session/next.ts";
import { PipelineFrontier } from "../../session/pipeline.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../../session/run.ts";
import { BoardNext, BoardView, LineCarriers } from "../board-view.ts";
import { Capsule } from "../capsule.ts";
import { Cli, type CliIo, type CliOptions } from "../cli.ts";
import { ARGV_CHANNEL } from "../declare.ts";
import { RouteRenderer } from "../route-render.ts";
import { Words } from "../words.ts";

/** One `NextHop` from the ONE derivation — a route + the frame's target, with the
 *  board's declaration-reading station discrimination injected. */
const hopOf = (repo: string, route: Route, target: RouteTarget | null = null): NextHop => {
  const root = new RepoRoot(repo);
  return new NextStepRouter().nextHop({
    target,
    gate: { docDrift: false, briefDrift: false },
    route,
    verdict: target === null ? "terminal" : BoardView.docClassOf(root, target),
  });
};

describe("BoardView.render — the phase / program board layouts + the next derivation", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-render-"));
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  /** Write a doc with a declared doc-type (the header declaration the board reads). */
  const writeDoc = (rel: string, lines: readonly string[]): string => {
    const file = path.join(repo, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
    return file;
  };

  /** Seed a node's own workspace progress.json. */
  const seed = (slug: string, waves: unknown[]): void => {
    const dir = path.join(repo, ".kairos/cdd", slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "progress.json"),
      JSON.stringify({ timeoutCount: 0, contractViolationCount: 0, waves }, null, 2),
    );
  };

  /** The indexed entry at one repo-relative path (the CLI's path-entry surface). */
  const entryAt = (rel: string): DocEntry => {
    const entry = SlugIndex.build(repo).entryAt(rel);
    if (entry === null) throw new Error(`no indexed doc at ${rel}`);
    return entry;
  };

  /** The entry addressed by its front-matter slug — the program overall first,
   *  then the identity document, then the plan (the test-side mirror of a path
   *  entry that the CLI resolves by path). */
  const entryFor = (slug: string): DocEntry => {
    const index = SlugIndex.build(repo);
    const entry = index.overallOf(slug) ?? index.identityDoc(slug) ?? index.planOf(slug);
    if (entry === null) throw new Error(`no doc for slug ${slug}`);
    return entry;
  };

  const renderEntry = (entry: DocEntry, host = "claude"): { text: string; exitCode: number } => {
    const index = SlugIndex.build(repo);
    const root = new RepoRoot(repo);
    // The board's `next:` line renders the assembly face's ONE injected `NextHop`
    // (P22 §5.2) — the same object the CLI's board command hands it.
    const next = BoardNext.of(index, entry, root);
    const board = BoardView.render(
      index,
      entry,
      repo,
      new Words(),
      host,
      ARGV_CHANNEL,
      undefined,
      next,
    );
    return { text: board.lines.join("\n"), exitCode: board.exitCode };
  };

  const render = (slug: string, host = "claude"): { text: string; exitCode: number } =>
    renderEntry(entryFor(slug), host);

  /** The board's `next:` value (the `  next:    ` row, the anchor stripped). */
  const nextOf = (slug: string, host = "claude"): string => {
    const line = render(slug, host)
      .text.split("\n")
      .find((row) => row.startsWith("  next:    "));
    return line!.slice("  next:    ".length);
  };

  it("renders the phase board header + rows + the fixed legend tail", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "version: v0.14",
      "status: Done",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "---",
      "title: Plan",
      "version: v0.9",
      "doc-type: plan",
      "slug: prog-p1",
      "---",
    ]);
    seed("prog-p1", [{ wave: "phase-spec", rounds: { review: [1, 2], fix: [1] } }]);

    const { text, exitCode } = render("prog-p1");

    expect(exitCode).toBe(0);
    expect(text).toContain("cdd board: prog-p1");
    expect(text).toContain("  overall  ");
    expect(text).toMatch(/prog-p1-design\.md\s+v0\.14 · Done/);
    expect(text).toMatch(/prog-p1\.md\s+v0\.9/);
    // D47 — the doc cells render repoRoot-relative (the index holds absolute paths;
    // the board emits the ONE shape). No row carries the absolute repo prefix.
    expect(text).toContain("  spec     prog-p1-design.md");
    expect(text).toContain("  plan     prog-p1.md");
    expect(text).not.toContain(repo);
    expect(text).toContain("  branch   ○ open");
    expect(text.split("\n").at(-1)).toBe("progress: ✔ done · ▶ current · ○ pending");
  });

  it("renders one wave line per derived wave with the ✔/▶ markers", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    // Two task blocks → two waves.
    writeDoc("docs/kairos/plans/prog-p1.md", [
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
      "### Task 1: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
      "",
      "### Task 2: b",
      "- **Objective**: o",
      "- **Files**: `b.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: 1",
    ]);
    // Close wave {1}: a recorded zero-findings review round.
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });

    const { text } = render("prog-p1");

    // D40 — the wave line's label carries the wave's task scope in braces.
    expect(text).toContain("W1 {1}");
    expect(text).toContain("W2 {2}");
  });

  it("round-trips a written round record onto the line's rounds cell — one normalize face", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
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
      "### Task 1: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
    ]);
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    // ONE record write — op · cycle · attempt — read back through RoundRecords.of
    ledger.recordRound("1", { op: "review", cycle: 1, attempt: 1 });

    const { text } = render("prog-p1");

    // the wave line's aggregated cell renders the recorded round under its verb
    expect(text).toContain("review 1 ✓");
  });

  it("renders a crashed round in the top fact block without touching the counts or the hop", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
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
      "### Task 1: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
    ]);
    const crashRow = "  crashed: implement 1·a1 no-commits";
    // The SAME identity, the SAME anomaly token, one difference: the crash is booked
    // by a HARD violation rather than a soft one — the crashed row is the ONLY new
    // bytes, so the counts, the legend and the `next:` hop judge the same way.
    const seedCrash = (grade: "hard" | "soft"): void =>
      seed("prog-p1", [
        {
          wave: "1",
          rounds: [
            {
              op: "implement",
              cycle: 1,
              attempt: 1,
              dispatchBase: null,
              carrierPath: null,
              verdict: { treeClean: true, targetAction: false },
              violations: [{ grade, cause: "no-commits", message: "the round committed nothing" }],
            },
          ],
        },
      ]);

    seedCrash("hard");
    const crashed = render("prog-p1").text;
    seedCrash("soft");
    const soft = render("prog-p1").text;

    expect(crashed.split("\n")).toContain(crashRow);
    expect(soft).not.toContain("crashed:");
    // the observer claim: the crashed row is additive alone — strip it (and the blank
    // row that separates its block from the line rows) and the two boards are
    // byte-identical: the aggregation, the legend, the `next:` hop.
    const substance = (text: string): string =>
      text
        .split("\n")
        .filter((row) => row !== crashRow && row !== "")
        .join("\n");
    expect(substance(crashed)).toBe(substance(soft));
    // the crashed row renders in the top fact block, before the first line row
    expect(crashed.indexOf(crashRow)).toBeLessThan(crashed.indexOf("  overall "));
    // the legend never advertises the row
    expect(crashed.split("\n").at(-1)).toBe("progress: ✔ done · ▶ current · ○ pending");
  });

  it("renders only the NODE's own crashed rounds — the program's failure is not this node's work", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    // The PARENT program's own round crashed; the node never dispatched one.
    seed("prog-overall", [
      {
        wave: "phase-spec",
        rounds: [
          {
            op: "review",
            cycle: 1,
            attempt: 1,
            dispatchBase: null,
            carrierPath: null,
            verdict: { treeClean: true, targetAction: false },
            violations: [{ grade: "hard", cause: "child-exit", message: "the child died" }],
          },
        ],
      },
    ]);
    seed("prog-p1", [{ wave: "1", rounds: [] }]);
    const { text } = render("prog-p1");
    // the overall document's records feed the program board alone — a parent's crashed
    // round never renders on a node board as this node's failure
    expect(text).not.toContain("crashed:");
    expect(text).not.toContain("child-exit");
  });

  it("phase board next: the first not-closed line renders its ACTIVE C5 hop (the spec review)", () => {
    // D40 deep-solve — the spec line has not started its C5 (no review round on record),
    // so its ACTIVE hop is the review-lead the dispatch engine would run (Ledger#lineRoute
    // → {kind:"review"}), NOT the exhausted-face handoff `/kairos:cdd-plan`. board next ==
    // engine next (the retired shallow form rendered the face-to-face entry for an open line).
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "---",
      "title: Plan",
      "doc-type: plan",
      "slug: prog-p1",
      "---",
    ]);

    const { text } = render("prog-p1");

    expect(text).toContain(
      `  next:    review --type phase-spec --spec ${path.relative(repo, path.join(repo, "docs/kairos/specs/prog-p1-design.md"))}`,
    );
    expect(text).not.toContain("  next:    route to /kairos:cdd-plan skill");
  });

  it("phase board next: spec closed + plan not started → the plan line's active review hop", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "---",
      "title: Plan",
      "doc-type: plan",
      "slug: prog-p1",
      "---",
    ]);
    // Close the spec line: a recorded zero-findings spec review.
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });

    const { text } = render("prog-p1");

    // The spec face is exhausted → the plan line is the frontier; the plan line has not
    // started its C5 → its ACTIVE hop is the plan review (not the cdd-dev handoff).
    expect(text).toContain(
      `  next:    review --type plan --plan ${path.relative(repo, path.join(repo, "docs/kairos/plans/prog-p1.md"))}`,
    );
    expect(text).not.toContain("  next:    route to /kairos:cdd-dev skill");
  });

  it("phase board next: a skipped-cycle plan line (`{review:[1,2], fix:[2]}`) is CLOSED — the engine's judge, not a count", () => {
    // The drift-voided review-1 shape the reviewer's own P8 workspace carries. A
    // count-based closure judge reads the nonexistent fix cycle 1 → plan OPEN → the
    // plan entry; the engine's identity judge reads the fix at cycle 2 → plan CLOSED
    // → next advances past the plan face.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
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
      "### Task 1: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
    ]);
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    // spec closed (a recorded zero-findings spec review)
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    // plan closed by identity: review cycles [1,2], the fix at its own cycle 2
    ledger.persistHandoff("review", "plan", { round: 2 }, { findings: [] });
    ledger.persistHandoff("fix", "plan", { round: 2 }, { findings: [] });
    ledger.recordRound("plan", { op: "review", cycle: 1 });
    ledger.recordRound("plan", { op: "review", cycle: 2 });
    ledger.recordRound("plan", { op: "fix", cycle: 2 });
    // A dispatched-but-blocked wave round: the wave face counts as entered (P25 §6), so
    // the frontier past the plan face is the wave face, not the fresh-plan handoff.
    ledger.recordRound("1", {
      op: "implement",
      verdict: { treeClean: true, targetAction: false },
    });

    const { text } = render("prog-p1");

    // plan closed by identity → past the plan face onto the wave face. A count-based
    // closure judge reads the nonexistent fix cycle 1 → plan OPEN → its own exit (the
    // cdd-dev handoff), which the second assertion rules out.
    expect(text).not.toContain("  next:    route to /kairos:cdd-dev skill");
    expect(text).toContain("  next:    implement --plan docs/kairos/plans/prog-p1.md --tasks 1");
  });

  it("D40 — a skipped-cycle row's board judgment EQUALS the engine's Ledger#lineClosed verdict", () => {
    // The board's `next:` walk now delegates its closure reads to Ledger#lineClosed
    // (the single judge) — a jump-number row `{review:[1,2], fix:[2]}` (D28) must read
    // CLOSED on BOTH faces. A count-based board judge (the retired hand-rolled form)
    // would read it OPEN and diverge from the engine.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "---",
      "title: Plan",
      "doc-type: plan",
      "slug: prog-p1",
      "---",
    ]);
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "plan", { round: 2 }, { findings: [] });
    ledger.persistHandoff("fix", "plan", { round: 2 }, { findings: [] });
    ledger.recordRound("plan", { op: "review", cycle: 1 });
    ledger.recordRound("plan", { op: "review", cycle: 2 });
    ledger.recordRound("plan", { op: "fix", cycle: 2 });

    // The engine judge: the plan line is CLOSED (the fix at its own cycle 2, D28).
    expect(ledger.lineClosed("plan", "plan")).toBe(true);
    // The board consumes that SAME judge — the plan face is exhausted.
    const { text } = render("prog-p1");
    expect(text).not.toContain("  next:    route to /kairos:cdd-dev skill");
  });

  it("D40 — the wave line's label carries the wave's task scope (W3 = tasks 5,11)", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
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
      "### Task 5: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
      "",
      "### Task 11: b",
      "- **Objective**: o",
      "- **Files**: `b.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
    ]);

    const { text } = render("prog-p1");
    const labels = text
      .split("\n")
      .filter((row) => /W\d+ \{/.test(row))
      .map((row) => row.trim().split(/\s{2,}/)[1]);

    // The wave's task ids ride the label in braces (a reader sees `W1 {5,11}`, not a
    // bare W1) — the spec §5.2 `W{n} {<ids>}` form.
    expect(labels[0]).toBe("W1 {5,11}");
    expect(text).toContain("W1 {5,11}");
  });

  it("D40 — a wave in flight renders the wave line's ACTIVE C5 hop, not the face handoff", () => {
    // The deep-solve (spec §18.1 live case): W1 is closed, W2 ({12,13,14}) is the open
    // frontier with no implement yet — its active C5 hop is the whole-wave implement
    // (`implement --plan <plan> --tasks 12,13,14`), NOT the exhausted-wave face handoff
    // (`review --type branch …`). A shallow `resolve(null, …)` renders the branch-review
    // handoff here — the bug (W4 in flight rendering branch review) this pin drives out.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
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
      "### Task 5: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
      "",
      "### Task 12: b",
      "- **Objective**: o",
      "- **Files**: `b.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: 5",
      "",
      "### Task 13: c",
      "- **Objective**: o",
      "- **Files**: `c.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: 5",
      "",
      "### Task 14: d",
      "- **Objective**: o",
      "- **Files**: `d.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: 5",
    ]);
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    // Close the spec and plan lines (a recorded zero-findings review each) so the wave
    // face IS the frontier.
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    // W1 ({5}) closed: a recorded zero-findings review round.
    ledger.persistHandoff("review", "wave", { tasks: "5", round: 1 }, { findings: [] });
    ledger.recordRound("5", { op: "review" });
    // W2 ({12,13,14}) is the open frontier with NO implement yet — its active C5 hop is
    // the whole-wave implement (spec §18.4 live case: W4 in flight → `implement --tasks
    // 12,13,14`, never the exhausted-wave face handoff `review --type branch`).

    const { text } = render("prog-p1");
    const planPath = path.relative(repo, path.join(repo, "docs/kairos/plans/prog-p1.md"));

    // The active wave hop — the not-yet-implemented wave renders its implement literal.
    expect(text).toContain(`  next:    implement --plan ${planPath} --tasks 12,13,14`);
    // NOT the exhausted-wave face handoff (the shallow resolve(null, …) bug).
    expect(text).not.toContain("review --type branch");
  });

  it("D40 — the wave-line markers align into one fixed-width column across differing id-set widths", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
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
      "### Task 1: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
      "",
      "### Task 2: b",
      "- **Objective**: o",
      "- **Files**: `b.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: 1",
      "",
      "### Task 3: c",
      "- **Objective**: o",
      "- **Files**: `c.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: 1",
      "",
      "### Task 4: d",
      "- **Objective**: o",
      "- **Files**: `d.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: 1,2,3",
    ]);
    // Close W1 ({1}) — a recorded zero-findings review at the "1" row.
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });

    const { text } = render("prog-p1");
    // W1 {1} (narrow) and W2 {2,3} / W3 {4} (wider) — the markers must share one column.
    const waveRows = text.split("\n").filter((line) => /W\d+ \{/.test(line));
    expect(waveRows.length).toBe(3);
    const markerColumns = waveRows.map((row) => row.search(/[✔▶○]/));
    // Every wave row places its ✔/▶/○ marker at the exact same column index.
    expect(new Set(markerColumns).size).toBe(1);
  });

  it("phase board next: a just-closed spec hands off to its OWN exit (never the absent plan's)", () => {
    // D40 deep-solve / D26 — the spec line is closed and NO plan doc exists yet: the
    // plan face is the frontier but was NEVER ENTERED (no doc), so the transition is
    // the PRECEDING face's exit — the spec's `PIPELINE_NEXT["phase-spec"]` → the
    // cdd-plan ref. The retired board fork handed off via the frontier LINE's own key
    // (the absent plan's `cdd-dev`) — a face-boundary off-by-one the ONE walk kills
    // (a closed spec means "author the plan", not "the plan is done"). Rendering rides
    // the SAME RouteRenderer the Capsule's `done` face uses; host "" falls back to the
    // claude form (REFS[ref].claude) — never a bare plugin guess.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });

    const { text } = render("prog-p1", "");

    expect(text).toContain("  next:    route to /kairos:cdd-plan skill");
  });

  it("board per-harness ref pins — a drained line renders REFS[ref][host] (host=pi → /skill:…)", () => {
    // The board's per-harness spelling rides REFS[ref][host] (never a claude-form
    // constant). The reachable ref at the spec boundary is cdd-plan through both
    // sub-states — the spec face never authored, and the spec face just closed with no
    // plan authored (the off-by-one the fork rendered as the absent plan's cdd-dev).
    // host=pi renders the flat `/skill:<bare>` form.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    // The board is entered through a document, so the representable pre-plan state
    // is `spec closed + plan absent`: the plan face is the frontier but was never
    // entered → the spec's OWN exit (cdd-plan). host=pi renders `/skill:<bare>`.

    // Close the spec line so the plan face is the frontier; no plan doc → the spec's OWN
    // exit (cdd-plan), never the absent plan's cdd-dev.
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    expect(nextOf("prog-p1", "pi")).toBe("route to /skill:cdd-plan skill");
    expect(nextOf("prog-p1", "claude")).toBe("route to /kairos:cdd-plan skill");
  });

  it("board next == the Capsule's done face — the shared renderer byte-identity (host claude / pi)", () => {
    // route-render.ts claims the board's `next:` and the capsule's `next:` are
    // byte-identical by construction (ONE RouteRenderer). Pin it at the state BOTH
    // seams agree on: the spec boundary. The board has a closed spec face + no plan doc
    // (the plan face unentered → the spec's exit entry); the capsule's `done` face is
    // fed the closed spec line's target (a phase-spec doc → `PIPELINE_NEXT["phase-spec"]`).
    // Both resolve to the SAME pipeline entry through the ONE renderer, and both seams
    // read the SAME argv channel (the board is threaded ARGV_CHANNEL from the
    // composition root) — a flag-spelling change cannot silently split the two faces.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    const specId = writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });

    for (const host of ["claude", "pi"]) {
      const capsuleNext = new Capsule(new Words(), ARGV_CHANNEL, host, new RepoRoot(repo))
        .emit(
          "APPROVED",
          "/h.json",
          hopOf(repo, { kind: "done" }, { type: "phase-spec", id: specId }),
        )[1]!
        .slice("next: ".length);
      // The board's spec face is drained (spec closed + no plan doc) → the same entry.
      expect(nextOf("prog-p1", host)).toBe(capsuleNext);
      expect(capsuleNext).toBe(
        host === "pi" ? "route to /skill:cdd-plan skill" : "route to /kairos:cdd-plan skill",
      );
    }
  });

  it("D47 — the next: literal's embedded paths are repoRoot-relative, byte-identical board↔capsule", () => {
    // route-render.ts is the ONE renderer for both faces; D47 makes its embedded path
    // values repoRoot-relative (the ONE shape, §2.13). Pin BOTH seams at a path-bearing
    // C5 hop — the spec review literal's `--spec` — feeding the capsule an ABSOLUTE
    // target path: the renderer must emit the repoRoot-relative form on both faces alike.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    const specId = writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "---",
      "title: Plan",
      "doc-type: plan",
      "slug: prog-p1",
      "---",
    ]);
    expect(path.isAbsolute(specId)).toBe(true);

    for (const host of ["claude", "pi"]) {
      const capsuleNext = new Capsule(new Words(), ARGV_CHANNEL, host, new RepoRoot(repo))
        .emit(
          "APPROVED",
          "/h.json",
          hopOf(repo, { kind: "review" }, { type: "phase-spec", id: specId }),
        )[1]!
        .slice("next: ".length);
      // The reviewer's own hop renders the repoRoot-relative --spec (never the absolute).
      expect(capsuleNext).toBe(
        "review --type phase-spec --spec docs/kairos/specs/prog-p1-design.md",
      );
      expect(capsuleNext).not.toContain(repo);
      // The board's spec frontier renders the SAME byte-identical relative literal.
      expect(nextOf("prog-p1", host)).toBe(capsuleNext);
    }
  });

  it("a present doc without a Doc type declaration renders BLOCKED and exits 2", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    // The spec doc carries NO `doc-type:` key (but a legal slug, so the missing
    // type — not a missing identity — is the violation under test).
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "version: v1.0",
      "slug: prog-p1",
      "---",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "---",
      "title: Plan",
      "doc-type: plan",
      "slug: prog-p1",
      "---",
    ]);

    const { text, exitCode } = renderEntry(entryAt("docs/kairos/specs/prog-p1-design.md"));

    expect(exitCode).toBe(2);
    expect(text).toContain("doc-type: missing (BLOCKED)");
  });

  it("renders the program board with one phase summary line + next: done", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "version: v2.33",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    // Two task blocks → two waves, so the phase line carries its `wave W1…` token (spec §5.3).
    writeDoc("docs/kairos/plans/prog-p1.md", [
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
      "### Task 1: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
      "",
      "### Task 2: b",
      "- **Objective**: o",
      "- **Files**: `b.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: 1",
    ]);
    seed("prog-overall", [{ wave: "overall", rounds: { review: [1, 2, 3, 4] } }]);
    seed("prog-p1", [
      { wave: "phase-spec", rounds: { review: [1] } },
      { wave: "plan", rounds: { review: [1] } },
      { wave: "branch", rounds: { "branch-review": [1] } },
    ]);

    const { text, exitCode } = render("prog-overall");

    expect(exitCode).toBe(0);
    expect(text).toContain("cdd board: prog-overall");
    // D28 identity: the cell renders the stored CYCLE NUMBERS, never their count
    // (deliberate pin break — the retired `review×4` read the array length).
    expect(text).toContain("prog-overall.md   v2.33   review 4 ✓");
    // The full phase line shape (spec §5.3): status + the spec/plan/wave/branch cells,
    // the `wave W1…` token derived from the phase's own wave segment. The branch line's
    // round aggregates under the `review` verb — branch review folds to the review
    // family in the record (`RoundRecords.of`; OpType has no branch-review member).
    expect(text).toContain(
      "  phase prog-p1  Pending   spec review 1 ✓ · plan review 1 ✓ · wave W1… · branch review 1 ✓   title: S",
    );
    expect(text).toContain("  next:    done");
  });

  it("a single-spec entry reads its OWN line — the declared word, then the cdd-plan handoff", () => {
    // P26 T3 — the board's spec face follows the identity document's DECLARED
    // `doc-type:` (never a hardcoded `phase-spec`): the row counts ride the
    // `single-spec` line the engine books, and the exit is the pipeline handoff
    // (`PIPELINE_NEXT["single-spec"]` → cdd-plan) — the SAME word the capsule renders.
    writeDoc("docs/kairos/specs/prog-single.md", [
      "---",
      "title: S",
      "version: v1.0",
      "status: Active",
      "doc-type: single-spec",
      "slug: prog-single",
      "---",
    ]);
    seed("prog-single", [{ wave: "single-spec", rounds: { review: [1, 2], fix: [1] } }]);

    const { text } = render("prog-single");

    expect(text).toContain("  spec     prog-single.md");
    expect(text).toContain("review 2 ✓ · fix 1 ✓");
    expect(nextOf("prog-single")).toBe("route to /kairos:cdd-plan skill");
    // the pi spelling resolves from the same ref row
    expect(nextOf("prog-single", "pi")).toBe("route to /skill:cdd-plan skill");
    // P26 T3 red pin: the declared class IS the pipeline key — folding it back into
    // `terminal` turns this red (the retired D73 shape).
    expect(
      BoardView.docClassOf(new RepoRoot(repo), {
        type: "single-spec",
        id: "docs/kairos/specs/prog-single.md",
      }),
    ).toBe("single-spec");
    expect(text).not.toContain("--type phase-spec");
  });

  it("a charter's retired `spec` row IS its `overall` line — the counts render, bytes stay frozen", () => {
    // The pre-rename charter recorded its rounds under the retired `spec` key (the
    // only document word the enum carried). The read alias keys on the workspace's
    // DECLARED identity word — an `overall` charter's retired row is its own line —
    // and never rewrites the stored key.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "version: v2.33",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    seed("prog-overall", [{ wave: "spec", rounds: { review: [1, 2], fix: [2] } }]);

    const { text } = render("prog-overall");

    expect(text).toContain("prog-overall.md   v2.33   review 2 ✓ · fix 1 ✓");
    const stored = JSON.parse(
      readFileSync(path.join(repo, ".kairos/cdd/prog-overall/progress.json"), "utf8"),
    ) as { waves: Array<{ wave: string }> };
    expect(stored.waves.map((row) => row.wave)).toEqual(["spec"]);
  });

  it("orders the phase rows by their phase number, never by the rel-path lexicographic order", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    // The rel order of these files is p1-design · p10-design · p2-design; the
    // board must render the program order (p1 · p2 · p10).
    for (const phase of ["p10", "p2", "p1"]) {
      writeDoc(`docs/kairos/specs/prog-${phase}-design.md`, [
        "---",
        "title: S",
        "doc-type: phase-spec",
        `slug: prog-${phase}`,
        "program: prog-overall",
        "---",
      ]);
    }

    const { text } = render("prog-overall");
    const rows = text
      .split("\n")
      .filter((line) => line.startsWith("  phase "))
      .map((line) => line.split(/\s+/)[2]);

    expect(rows).toEqual(["prog-p1", "prog-p2", "prog-p10"]);
  });

  it("a phase spec whose `program:` names no overall renders `program: missing (BLOCKED)` and exits 2", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    // The phase spec's `program:` names an overall that does not exist on disk —
    // the hard gate renders on the spec line (spec §2.2: not `(none)`, not a crash).
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: ghost-overall",
      "---",
    ]);

    const { text, exitCode } = renderEntry(entryAt("docs/kairos/specs/prog-p1-design.md"));

    expect(exitCode).toBe(2);
    expect(text).toContain("  overall  (none)");
    expect(text).toContain("program: missing (BLOCKED)");
  });

  it("degrades without error — an absent plan leaves the wave segment empty", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);

    const board = BoardView.render(
      SlugIndex.build(repo),
      entryFor("prog-p1"),
      repo,
      new Words(),
      "claude",
    );

    expect(board.lines.join("\n")).toContain("  wave     (none)");
  });
});

// ---------------------------------------------------------------------------
// P21 T6 — the in-flight fact, the orphan drafts and the cycle-number cell
// ---------------------------------------------------------------------------

/** One in-flight record fixture — the identity facts the board row names. */
const inFlightRecord = (over: Partial<InFlightRecord> = {}): InFlightRecord => ({
  pid: 4242,
  command: "cdd implement --tasks 1 --plan docs/p.md",
  slug: "p3",
  startedAt: Date.parse("2026-10-28T10:00:00.000Z"),
  wave: "1",
  phase: "implement",
  cycle: 1,
  attempt: 1,
  briefHash: null,
  plan: "docs/p.md",
  dispatchBase: null,
  sampledAt: null,
  verdict: null,
  ...over,
});

describe("BoardView.inFlightRows — the in-flight fact + the takeover hint", () => {
  const words = new Words();

  it("adds the takeover hint only for a dead holder", () => {
    const alive = BoardView.inFlightRows(
      { kind: "held", record: inFlightRecord(), alive: true },
      [],
      words,
    );
    const dead = BoardView.inFlightRows(
      { kind: "held", record: inFlightRecord(), alive: false },
      [],
      words,
    );
    expect(alive.join("\n")).toContain("pid 4242");
    expect(alive.join("\n")).not.toContain(words.inFlightWords().stealable);
    expect(dead.join("\n")).toContain(words.inFlightWords().stealable);
  });

  it("(f) the held row names the holder's IDENTITY only — never the dispatch narrative", () => {
    const rows = BoardView.inFlightRows(
      { kind: "held", record: inFlightRecord(), alive: true },
      [],
      words,
    );
    const row = rows[0]!;
    // the round identity (op + cycle + attempt — spec §5.3), the wave key and the pid
    // a takeover targets
    expect(row).toContain("op: implement");
    expect(row).toContain("cycle: 1");
    expect(row).toContain("attempt: 1");
    expect(row).toContain("wave: 1");
    expect(row).toContain("pid 4242");
    // the child's command line, its start instant and its plan path are narrative
    expect(row).not.toContain("command:");
    expect(row).not.toContain("started:");
    expect(row).not.toContain("docs/p.md");
  });

  it("(f2) a re-dispatch's attempt and a later cycle are readable in the row", () => {
    const rows = BoardView.inFlightRows(
      { kind: "held", record: inFlightRecord({ cycle: 3, attempt: 2 }), alive: true },
      [],
      words,
    );
    expect(rows[0]).toContain("cycle: 3");
    expect(rows[0]).toContain("attempt: 2");
  });

  it("(f3) a record written before the cycle/attempt cells existed omits them, not prints null", () => {
    const rows = BoardView.inFlightRows(
      { kind: "held", record: inFlightRecord({ cycle: null, attempt: null }), alive: true },
      [],
      words,
    );
    const row = rows[0]!;
    expect(row).not.toContain("cycle:");
    expect(row).not.toContain("attempt:");
    expect(row).not.toContain("null");
    // the older identity cells still render
    expect(row).toContain("op: implement");
    expect(row).toContain("pid 4242");
  });

  it("fills the free and corrupt rows from the one word table", () => {
    const free = BoardView.inFlightRows({ kind: "absent" }, [], words);
    expect(free[0]).toBe(`  in-flight: ${words.checkedWords().inFlight.free}`);
    const locked = BoardView.inFlightRows({ kind: "corrupt", locked: true }, [], words);
    expect(locked[0]).toBe(`  in-flight: ${words.inFlightWords().corruptLocked}`);
    const unlocked = BoardView.inFlightRows({ kind: "corrupt", locked: false }, [], words);
    expect(unlocked[0]).toBe(`  in-flight: ${words.inFlightWords().corruptUnlocked}`);
  });

  it("renders the free state plus one row per orphan handoff draft", () => {
    const rows = BoardView.inFlightRows(
      { kind: "absent" },
      ["tasks-1-review-1.json", "branch-fix-1.json"],
      words,
    );
    expect(rows[0]).toBe("  in-flight: free — no dispatch holds this tree");
    expect(rows[1]).toContain("tasks-1-review-1.json");
    expect(rows[2]).toContain("branch-fix-1.json");
  });

  it("appends the crashed row after the orphan rows — the same top fact block", () => {
    const rows = BoardView.inFlightRows({ kind: "absent" }, ["tasks-1-review-1.json"], words, [
      "  crashed: implement 1·a1 contract-violation",
    ]);
    expect(rows.at(-1)).toBe("  crashed: implement 1·a1 contract-violation");
  });
});

describe("BoardView.crashedRows — the crashed round as an observation (spec §5.3)", () => {
  /** One round record fixture — the identity, the verdict and the booked violations. */
  const record = (over: Partial<RoundRecord>): RoundRecord => ({
    op: "implement",
    cycle: 1,
    attempt: 1,
    dispatchBase: null,
    verdict: { treeClean: true, targetAction: true },
    violations: [],
    carrierPath: null,
    ...over,
  });
  const hard = (cause: string): RoundRecord["violations"][number] =>
    RoundViolation.hard("the round's target action did not land", cause);

  it("renders ONE line, one token per crashed round — op cycle·attempt then the FIRST hard cause", () => {
    const rows = BoardView.crashedRows([
      record({
        cycle: 2,
        attempt: 3,
        verdict: { treeClean: true, targetAction: false },
        violations: [hard("no-commits"), hard("hygiene")],
      }),
    ]);
    expect(rows).toEqual(["  crashed: implement 2·a3 no-commits"]);
  });

  it("joins every crashed round into the ONE line the spec renders", () => {
    // the design spec's literal row: `crashed: review 1·a1 contract-violation · review 3·a2 stalled`
    const rows = BoardView.crashedRows([
      record({
        op: "review",
        cycle: 1,
        verdict: { treeClean: false, targetAction: false },
        violations: [hard("contract-violation")],
      }),
      record({
        op: "review",
        cycle: 3,
        attempt: 2,
        verdict: { treeClean: true, targetAction: false },
        violations: [hard("stalled")],
      }),
    ]);
    expect(rows).toEqual(["  crashed: review 1·a1 contract-violation · review 3·a2 stalled"]);
  });

  it("skips a round that landed its action and a round whose failures are all SOFT", () => {
    const rows = BoardView.crashedRows([
      record({ cycle: 1 }),
      record({
        cycle: 2,
        verdict: { treeClean: false, targetAction: false },
        violations: [RoundViolation.soft("a dirty tree", "hygiene")],
      }),
    ]);
    expect(rows).toEqual([]);
  });

  it("reads the records in (cycle, attempt) order — the session's sequence, never the file's order", () => {
    const crashed = (cycle: number, attempt = 1): RoundRecord =>
      record({
        cycle,
        attempt,
        verdict: { treeClean: true, targetAction: false },
        violations: [hard("child-exit")],
      });
    const rows = BoardView.crashedRows([
      crashed(3),
      record({ cycle: 1 }),
      crashed(2),
      crashed(1, 2),
    ]);
    expect(rows).toEqual([
      "  crashed: implement 1·a2 child-exit · implement 2·a1 child-exit · implement 3·a1 child-exit",
    ]);
  });

  it("renders ONE token per round identity — a re-booked round never doubles its token", () => {
    const crashed: RoundRecord = record({
      cycle: 2,
      verdict: { treeClean: true, targetAction: false },
      violations: [hard("child-exit")],
    });
    const rows = BoardView.crashedRows([crashed, crashed, { ...crashed, op: "review" }]);
    expect(rows).toEqual(["  crashed: implement 2·a1 child-exit · review 2·a1 child-exit"]);
  });
});

describe("BoardView.summaryCell — the verb × judgement aggregation (spec §5.3)", () => {
  /** Each fixture record's carrier path — out of band, because a round record names no
   *  path (P34 §2.7): the path is derived from the record's identity in production, and
   *  these fixtures supply it the same way the ledger accessor would. */
  const paths = new WeakMap<RoundRecord, string>();

  /** One round record fixture — the identity + verdict the aggregation reads. */
  const record = (over: Partial<RoundRecord> & { carrierPath?: string | null }): RoundRecord => {
    const { carrierPath, ...rest } = over;
    const built: RoundRecord = {
      op: "review",
      cycle: 1,
      attempt: 1,
      dispatchBase: null,
      verdict: { treeClean: true, targetAction: true },
      violations: [],
      ...rest,
    };
    if (typeof carrierPath === "string") paths.set(built, carrierPath);
    return built;
  };

  /** The aggregation under test — the line's carriers derived per record from the
   *  fixture map (the board's own call shape). */
  const cell = (records: readonly RoundRecord[]): string =>
    BoardView.summaryCell(
      records,
      LineCarriers.of(records, (record) => paths.get(record) ?? ""),
    );

  const scratchDirs: string[] = [];

  /** One REAL round carrier — the handoff file a review round persists, carrying the
   *  judge plane's declared `findings` array (the `+N` count's only source). */
  const carrier = (findings: readonly unknown[]): string => {
    const dir = mkdtempSync(path.join(tmpdir(), "board-carrier-"));
    scratchDirs.push(dir);
    const at = path.join(dir, "tasks-1-review-1.json");
    writeFileSync(at, `${JSON.stringify({ findings }, null, 2)}\n`, "utf8");
    return at;
  };

  afterEach(() => {
    for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("(a) ten green review rounds collapse into `review 10 ✓` — the range form never renders", () => {
    const records = Array.from({ length: 10 }, (_, index) => record({ cycle: index + 1 }));
    expect(cell(records)).toBe("review 10 ✓");
    expect(cell(records)).not.toContain("1–10");
  });

  it("(b) the judgement glyph is mandatory — a token never renders without it", () => {
    expect(cell([record({ verdict: { treeClean: true, targetAction: true } })])).toBe("review 1 ✓");
    expect(cell([record({ verdict: { treeClean: false, targetAction: false } })])).toBe(
      "review 1 ✗",
    );
  });

  it("(c) the round's FINDINGS ride the +N suffix (read from its carrier, omitted at zero)", () => {
    const at = carrier([
      { severity: "blocker", summary: "a" },
      { severity: "nit", summary: "b" },
    ]);
    const approved = [record({ cycle: 1 }), record({ cycle: 2 }), record({ cycle: 3 })];
    const withFindings = [
      record({ cycle: 1, carrierPath: at }),
      record({ cycle: 2 }),
      record({ cycle: 3 }),
    ];
    expect(cell(withFindings)).toBe("review 3 ✓+2");
    expect(cell(approved)).toBe("review 3 ✓");
    expect(cell([record({ verdict: { treeClean: true, targetAction: false } })])).toBe(
      "review 1 ✗",
    );
  });

  it("(c2) the count is the CARRIER's findings — contract violations are a different fact", () => {
    // The discriminating case: a round carrying two hard/soft contract violations and
    // a carrier with ZERO findings prints no suffix; a round carrying NO violations and
    // a carrier with two findings prints `+2`. Reading `record.violations` fails here.
    const violation = { grade: "soft" as const, cause: "c", message: "m" };
    const cleanCarrier = carrier([]);
    expect(
      cell([record({ cycle: 1, violations: [violation, violation], carrierPath: cleanCarrier })]),
    ).toBe("review 1 ✓");
    const findingsOnly = record({
      cycle: 1,
      carrierPath: carrier([{ severity: "warn" }, { severity: "nit" }]),
    });
    expect(cell([findingsOnly])).toBe("review 1 ✓+2");
    // A record with no carrier (a legacy row / a work-plane round) contributes zero.
    expect(cell([record({ cycle: 1 })])).toBe("review 1 ✓");
  });

  it("(c3) the +N read is CHECKED against the record's digest — a tampered carrier raises, an absent one counts zero", () => {
    // P31 §2.2 — absent and mismatch are DIFFERENT facts: an absent carrier is a
    // present-facts zero, a carrier whose bytes moved past its digest is a refusal.
    const findings = [{ severity: "warn" }];
    const at = carrier(findings);
    const digest = CarrierIntegrity.digestOf({ findings });
    expect(cell([record({ cycle: 1, carrierPath: at, carrierDigest: digest })])).toBe(
      "review 1 ✓+1",
    );
    writeFileSync(
      at,
      `${JSON.stringify({ findings: [...findings, { severity: "blocker" }] }, null, 2)}\n`,
    );
    expect(() => cell([record({ cycle: 1, carrierPath: at, carrierDigest: digest })])).toThrow(
      CarrierMismatchError,
    );
    // An absent carrier with a recorded digest stays the zero count (absence ≠ mismatch).
    const ghost = path.join(path.dirname(at), "tasks-9-review-1.json");
    expect(cell([record({ cycle: 1, carrierPath: ghost, carrierDigest: digest })])).toBe(
      "review 1 ✓",
    );
    // A LEGACY record (no digest) over the same tampered bytes keeps the present-facts read.
    expect(cell([record({ cycle: 1, carrierPath: at })])).toBe("review 1 ✓+2");
  });

  it("(c4) a re-dispatched cycle counts EACH attempt's own carrier — never attempt 1's bytes against attempt 2's digest", () => {
    const firstFindings = [{ severity: "warn" }];
    const secondFindings = [{ severity: "warn" }, { severity: "nit" }];
    const first = carrier(firstFindings);
    const second = carrier(secondFindings);
    const records = [
      record({
        op: "review",
        cycle: 1,
        carrierPath: first,
        carrierDigest: CarrierIntegrity.digestOf({ findings: firstFindings }),
        verdict: { treeClean: true, targetAction: false },
      }),
      record({
        op: "review",
        cycle: 1,
        attempt: 2,
        carrierPath: second,
        carrierDigest: CarrierIntegrity.digestOf({ findings: secondFindings }),
      }),
    ];
    // each attempt's digest belongs to its own carrier: no mismatch is raised, and the
    // success token counts attempt 2 (+2) while the failed token counts attempt 1 (+1)
    expect(cell(records)).toBe("review 1/2 ✓+2 · review 1 ✗→✓+1");
  });

  it("(c5) two legacy rounds collapsed onto ONE path count the owner alone — the overwritten record is a plain zero", () => {
    const at = carrier([{ severity: "warn" }, { severity: "nit" }]);
    const records = [
      record({ op: "review", cycle: 1, carrierPath: at }),
      record({ op: "review", cycle: 2, carrierPath: at }),
    ];
    // cycle 2 is the path's owner (no later round sits on it); cycle 1's bytes are gone
    // by definition, so its derived count is zero — never a second read of the same file
    expect(cell(records)).toBe("review 2 ✓+2");
  });

  it("(c6) the owner's read stays CHECKED — a tampered owner raises while the overwritten record reads nothing", () => {
    const findings = [{ severity: "warn" }];
    const at = carrier(findings);
    const digest = CarrierIntegrity.digestOf({ findings });
    const records = [
      record({ op: "review", cycle: 1, carrierPath: at }),
      record({ op: "review", cycle: 2, carrierPath: at, carrierDigest: digest }),
    ];
    writeFileSync(at, `${JSON.stringify({ findings: [] }, null, 2)}\n`);
    expect(() => cell(records)).toThrow(CarrierMismatchError);
  });

  it("(c7) a pathless LEGACY record reaches its canonical carrier through the ledger's ladder — and counts", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "board-ladder-"));
    try {
      const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      // Pre-P31: the carrier sits on the bare family name, the record names no path.
      writeFileSync(
        path.join(workspace.path, "tasks-1-review-2.json"),
        JSON.stringify({ findings: [{ severity: "warn" }, { severity: "nit" }] }),
        "utf8",
      );
      ledger.writeProgress({
        ...ledger.emptyProgress(),
        waves: [
          {
            wave: "1",
            rounds: [
              {
                op: "review",
                cycle: 2,
                attempt: 1,
                dispatchBase: null,
                verdict: { treeClean: true, targetAction: true },
                violations: [],
              },
            ],
          },
        ],
      });
      const records = ledger.recordsOf("1");
      // Zero digest comparison (the record declares none) and the count is real: the
      // success token's body is the run length, not the cycle.
      expect(
        BoardView.summaryCell(records, LineCarriers.ofLedger(ledger, "wave", "1", records)),
      ).toBe("review 1 ✓+2");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("(d) a same-cycle re-dispatch renders a ratio plus a recovered failure token, and attempt 1 never renders `a1`", () => {
    expect(
      cell([
        record({ op: "fix", verdict: { treeClean: true, targetAction: false } }),
        record({ op: "fix", attempt: 2, verdict: { treeClean: true, targetAction: true } }),
      ]),
    ).toBe("fix 1/2 ✓ · fix 1 ✗→✓");
    expect(BoardView.attemptSuffix(record({ attempt: 1 }))).toBe("");
    expect(BoardView.attemptSuffix(record({ attempt: 3 }))).toBe("a3");
    expect(cell([record({})])).not.toContain("a1");
  });

  it("(e) the live shape — a recovered re-dispatch renders the attempt ratio plus the failed cycle", () => {
    const findingsCarrier = carrier(
      Array.from({ length: 74 }, (_, index) => ({ severity: "nit", summary: `n${index}` })),
    );
    const reviews = Array.from({ length: 13 }, (_, index) =>
      record({
        op: "review",
        cycle: index + 1,
        carrierPath: index === 12 ? findingsCarrier : null,
      }),
    );
    const fixes: RoundRecord[] = [];
    for (let cycle = 1; cycle <= 11; cycle += 1) fixes.push(record({ op: "fix", cycle }));
    fixes.push(
      record({ op: "fix", cycle: 12, verdict: { treeClean: false, targetAction: false } }),
    );
    fixes.push(record({ op: "fix", cycle: 12, attempt: 2 }));
    fixes.push(record({ op: "fix", cycle: 13 }));
    expect(cell([...reviews, ...fixes])).toBe("review 13 ✓+74 · fix 13/14 ✓ · fix 12 ✗→✓");
  });

  it("(f) an unrecovered failure renders its cycle with no arrow, and an `aN` failure keeps its superscript", () => {
    const lone = record({
      op: "fix",
      cycle: 1,
      verdict: { treeClean: true, targetAction: false },
    });
    expect(cell([lone])).toBe("fix 1 ✗");
    expect(cell([lone])).not.toContain("→✓");
    const reDispatched = record({
      op: "fix",
      cycle: 1,
      attempt: 2,
      verdict: { treeClean: true, targetAction: false },
    });
    expect(cell([reDispatched])).toBe("fix 1a2 ✗");
  });

  it("(g) recovery reads the NEXT attempt of the SAME cycle — not another cycle, not a further attempt", () => {
    expect(
      cell([
        record({ op: "fix", cycle: 1, verdict: { treeClean: true, targetAction: false } }),
        record({ op: "fix", cycle: 2 }),
      ]),
    ).toBe("fix 1/2 ✓ · fix 1 ✗");
    const line = cell([
      record({
        op: "fix",
        cycle: 1,
        attempt: 1,
        verdict: { treeClean: true, targetAction: false },
      }),
      record({
        op: "fix",
        cycle: 1,
        attempt: 2,
        verdict: { treeClean: true, targetAction: false },
      }),
      record({ op: "fix", cycle: 1, attempt: 3 }),
    ]);
    expect(line).toBe("fix 1/3 ✓ · fix 1 ✗ · fix 1a2 ✗→✓");
    expect(line).not.toContain("a1");
  });

  it("(h) a recovered failure keeps its own +N — the success token counts the success carriers alone", () => {
    const at = carrier([{ severity: "nit" }, { severity: "warn" }]);
    const line = cell([
      record({ op: "fix", cycle: 1 }),
      record({ op: "fix", cycle: 2 }),
      record({ op: "fix", cycle: 3 }),
      record({
        op: "fix",
        cycle: 5,
        verdict: { treeClean: false, targetAction: false },
        carrierPath: at,
      }),
      record({ op: "fix", cycle: 5, attempt: 2 }),
    ]);
    expect(line).toBe("fix 4/5 ✓ · fix 5 ✗→✓+2");
  });

  it("(i) a failure in one verb leaves another verb's plate alone, and an all-green verb never renders a ratio", () => {
    const at = carrier([{ severity: "blocker" }]);
    const line = cell([
      record({ op: "review", cycle: 1, carrierPath: at }),
      record({ op: "review", cycle: 2 }),
      record({ op: "fix", cycle: 1, verdict: { treeClean: true, targetAction: false } }),
      record({ op: "fix", cycle: 1, attempt: 2 }),
    ]);
    expect(line).toBe("review 2 ✓+1 · fix 1/2 ✓ · fix 1 ✗→✓");
    expect(line).not.toContain("review 2/2");
    expect(
      cell([record({ op: "fix", cycle: 1 }), record({ op: "fix", cycle: 2, attempt: 2 })]),
    ).toBe("fix 2a2 ✓");
  });

  it("(j) the token order is verb-major and success-token-first — failure tokens never drift to the line's tail", () => {
    expect(
      cell([
        record({ op: "review", cycle: 1 }),
        record({ op: "review", cycle: 2 }),
        record({ op: "review", cycle: 3, verdict: { treeClean: false, targetAction: false } }),
        record({ op: "review", cycle: 3, attempt: 2 }),
        record({ op: "fix", cycle: 1 }),
        record({ op: "fix", cycle: 2 }),
        record({ op: "fix", cycle: 3 }),
      ]),
    ).toBe("review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓");
  });

  it("(k) a verb with zero successes renders no success token at all", () => {
    const review = cell([record({ verdict: { treeClean: false, targetAction: false } })]);
    expect(review).toBe("review 1 ✗");
    expect(review).not.toContain("review 0/1 ✓");
    expect(review).not.toContain("✓");
    expect(
      cell([record({ op: "implement", verdict: { treeClean: false, targetAction: false } })]),
    ).toBe("implement 1 ✗");
  });
});

describe("cdd board — the in-flight read face (zero write)", () => {
  /** A captured io + the CLI over a fresh git repo (the board's root resolution). */
  interface BoardFixture {
    readonly repoRoot: string;
    readonly command: Cli;
    readonly stdoutText: () => string;
    readonly cleanup: () => void;
  }

  const io = (): CliIo & { text: string } => {
    const captured = {
      text: "",
      stdout: (chunk: string) => {
        captured.text += chunk;
      },
      stderr: () => {},
    };
    return captured;
  };

  const fixture = (opts: CliOptions = {}): BoardFixture => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), "board-inflight-"));
    const cwd = process.cwd();
    process.chdir(repoRoot);
    spawnSync("git", ["init", "-q"], { cwd: repoRoot });
    spawnSync("git", ["config", "user.email", "board@test"], { cwd: repoRoot });
    spawnSync("git", ["config", "user.name", "board-test"], { cwd: repoRoot });
    writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n/docs/\n", "utf8");
    writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
    spawnSync("git", ["add", "-A"], { cwd: repoRoot });
    spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
    mkdirSync(path.join(repoRoot, "docs/kairos/plans"), { recursive: true });
    writeFileSync(
      path.join(repoRoot, "docs/kairos/plans/p3.md"),
      [
        "---",
        "title: Plan",
        "version: v1.0",
        "doc-type: plan",
        "date: 2026-10-09",
        "slug: p3",
        "---",
        "",
        "## Constraints",
        "",
        "- delta",
        "",
        "### Task 1: a",
        "- **Objective**: o",
        "- **Files**: a.ts",
        "- **Consumes**: x",
        "- **Produces**: y",
        "- **Steps**:",
        "  - s — checkable: g",
        "- **Acceptance**: ok",
        "- **DependsOn**: none",
        "",
      ].join("\n"),
      "utf8",
    );
    const captured = io();
    const command = Cli.create({ io: captured, ...opts });
    return {
      repoRoot,
      command,
      stdoutText: () => captured.text,
      cleanup: () => {
        process.chdir(cwd);
        rmSync(repoRoot, { recursive: true, force: true });
      },
    };
  };

  it("reports a dead holder + an orphan draft, and leaves the lock carrier and the draft bytes untouched", async () => {
    const { repoRoot, command, stdoutText, cleanup } = fixture();
    try {
      const dir = path.join(repoRoot, ".kairos", "cdd");
      mkdirSync(dir, { recursive: true });
      const record = `${JSON.stringify(inFlightRecord({ pid: 999_999, startedAt: 1 }), null, 2)}\n`;
      writeFileSync(path.join(dir, "in-flight.json"), record, "utf8");
      mkdirSync(path.join(dir, "in-flight.json.lock"), { recursive: true });
      const workspace = path.join(dir, "p3");
      mkdirSync(workspace, { recursive: true });
      const draft = path.join(workspace, "tasks-1-review-1.json");
      writeFileSync(draft, `${JSON.stringify({ findings: [] })}\n`, "utf8");
      const draftMtime = statSync(draft).mtimeMs;
      // A standing progress.json is the ledger's own fact — `board` only reads it.
      const progressPath = path.join(workspace, "progress.json");
      const progress = `${JSON.stringify({ timeoutCount: 0, waves: [{ wave: "1", rounds: [] }] }, null, 2)}\n`;
      writeFileSync(progressPath, progress, "utf8");
      const dirBefore = JSON.stringify(readdirSync(workspace).sort());

      expect(await command.runArgv(["board", "--plan", "docs/kairos/plans/p3.md"])).toBe(0);
      expect(stdoutText()).toContain("in-flight: pid 999999");
      expect(stdoutText()).toContain("--recover");
      expect(stdoutText()).toContain("orphan: tasks-1-review-1.json");
      // zero write: the record bytes, the lock carrier and the draft are untouched
      expect(readFileSync(path.join(dir, "in-flight.json"), "utf8")).toBe(record);
      expect(existsSync(path.join(dir, "in-flight.json.lock"))).toBe(true);
      expect(statSync(draft).mtimeMs).toBe(draftMtime);
      // §5.3 (g) — the in-flight facts are read, never written: the progress bytes stand
      expect(readFileSync(progressPath, "utf8")).toBe(progress);
      expect(JSON.stringify(readdirSync(workspace).sort())).toBe(dirBefore);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P22 §5.2 / §5.3 — the board renders the ONE injected `NextHop`, the traversal's
// four face-order rules live in the session plane's `PipelineFrontier`, and the
// default layout aggregates by verb × judgement.
// ---------------------------------------------------------------------------

describe("P22 — the board's injected hop, the four face-order rules, the layout", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-p22-"));
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  const writeDoc = (rel: string, lines: readonly string[]): string => {
    const file = path.join(repo, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
    return file;
  };

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

  const planDoc = (tasks: readonly number[][]): string =>
    path.join(
      writeDoc("docs/kairos/plans/prog-p1.md", [
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
        ...tasks.flatMap((layer) => layer.flatMap((id) => taskBlock(id, "none"))),
      ]),
    );

  const nodeDocs = (): void => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
  };

  const entryOf = (slug: string): DocEntry => {
    const index = SlugIndex.build(repo);
    const entry = index.overallOf(slug) ?? index.identityDoc(slug) ?? index.planOf(slug);
    if (entry === null) throw new Error(`no doc for slug ${slug}`);
    return entry;
  };

  const nextOfBoard = (slug: string, host = "claude"): string => {
    const index = SlugIndex.build(repo);
    const entry = entryOf(slug);
    const root = new RepoRoot(repo);
    const next = BoardNext.of(index, entry, root);
    const board = BoardView.render(
      index,
      entry,
      repo,
      new Words(),
      host,
      ARGV_CHANNEL,
      undefined,
      next,
    );
    return board.lines
      .join("\n")
      .split("\n")
      .find((row) => row.startsWith("  next:    "))!
      .slice("  next:    ".length);
  };

  const ledgerOf = (): Ledger =>
    new Ledger(
      new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1"),
      new ConfigLoader(),
    );

  /** Enter the wave face without completing a dispatch: one BLOCKED implement round on
   *  wave {1} (a non-target action). The face counts as entered (P25 §6) while its line
   *  still awaits the implement hop — the fixture shape OUTSIDE the fresh-plan window. */
  const enterWaveFace = (ledger: Ledger): void => {
    ledger.recordRound("1", {
      op: "implement",
      verdict: { treeClean: true, targetAction: false },
    });
  };

  it("(k2) a zero-batch plan was NEVER entered — the frontier hands off from the plan face", () => {
    nodeDocs();
    // A plan with no task blocks yields no batch at all, so the wave face's OWN entry
    // predicate never held (P25 §6): the face carries no target and the frontier walks
    // rule 3 — the preceding (plan) face's exit, never the wave face's own branch-review
    // literal. An ENTERED wave face with no active hop is pinned by `(w2)` below.
    planDoc([]);
    const ledger = ledgerOf();
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    expect(nextOfBoard("prog-p1")).toBe("route to /kairos:cdd-dev skill");
  });

  it("P25 §6 — the fresh-plan window: an UNENTERED wave face hands off to cdd-dev, two faces one assembly", () => {
    nodeDocs();
    planDoc([[1]]);
    const ledger = ledgerOf();
    // The window, byte for byte: spec + plan closed on clean rounds, a task graph
    // present, ZERO wave rounds. The wave face was never entered, so the frontier
    // exchanges from the plan face and the wave face's own literals never render.
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const root = new RepoRoot(repo);
    const facts = BoardView.pipelineFacts(index, entry, root)!;
    const hop = new PipelineFrontier(ledger).hopOf(facts.input, {
      docClassOf: (target) => BoardView.docClassOf(root, target),
    });
    expect(hop.hop).toBeNull();
    expect(hop.reason).toBe("closed-line");
    // The board's two rows, on the pi host's flat `/skill:` form.
    const rows = nextReasonRows("pi");
    expect(rows.next).toBe("route to /skill:cdd-dev skill");
    expect(rows.reason).toBe("  reason:  closed-line");
    // The board fills no cell of its own: its rows ARE the ONE assembly's render.
    const renderer = new RouteRenderer(new Words(), ARGV_CHANNEL, "pi", root);
    expect(rows.next).toBe(renderer.renderHop(hop));
    expect(rows.reason).toBe(BoardView.reasonLine(hop));
    // ... and the capsule renders the SAME object into its own two closing lines.
    const capsuleLines = new Capsule(new Words(), ARGV_CHANNEL, "pi", root).emit(
      "APPROVED",
      "/p25-6.json",
      hop,
    );
    expect(capsuleLines[capsuleLines.length - 2]).toBe(`next: ${rows.next}`);
    expect(capsuleLines[capsuleLines.length - 1]).toBe(`reason: ${hop.reason}`);
  });

  it("(a) the board renders the SAME NextHop object the capsule renders — byte equality", () => {
    nodeDocs();
    planDoc([[1]]);
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const hop = BoardNext.of(index, entry, new RepoRoot(repo));
    expect(hop).not.toBeNull();
    const capsuleNext = new Capsule(new Words(), ARGV_CHANNEL, "claude", new RepoRoot(repo)).emit(
      "APPROVED",
      "/h.json",
      hop,
    )[1]!;
    expect(capsuleNext.slice("next: ".length)).toBe(nextOfBoard("prog-p1"));
  });

  it("(k3) the branch mark and `next:` are ONE fact — drift ⇒ `▶ open`, unchanged ⇒ `✔ closed`", () => {
    nodeDocs();
    const planFile = planDoc([[1]]);
    const ledger = ledgerOf();
    // Every face closed on a clean round, and the branch row binds the PLAN's
    // doc-revision — its identity document (P21 §3/§4.1).
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    ledger.persistHandoff("review", "branch", { round: 1 }, { findings: [] });
    ledger.recordRound("branch", { op: "review" });
    ledger.recordReviewedRevision(
      "branch",
      ledger.refs().docRevision(planFile, readFileSync(planFile, "utf8")),
      "branch",
    );
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });
    const boardText = (): string => {
      const index = SlugIndex.build(repo);
      const entry = entryOf("prog-p1");
      const root = new RepoRoot(repo);
      const next = BoardNext.of(index, entry, root);
      return BoardView.render(
        index,
        entry,
        repo,
        new Words(),
        "claude",
        ARGV_CHANNEL,
        undefined,
        next,
      ).lines.join("\n");
    };
    // The plan has NOT moved — the mark stays closed and `next:` is the terminus.
    expect(boardText()).toContain("  branch   ✔ closed");
    expect(nextOfBoard("prog-p1")).toBe("route to /kairos:cdd-close skill");
    // One plan revision later the SAME line is open for review — the mark and the
    // `next:` line move together (one judgment, never two facts).
    writeFileSync(planFile, `${readFileSync(planFile, "utf8")}\n<!-- drift -->\n`, "utf8");
    expect(boardText()).toContain("  branch   ▶ open");
    expect(boardText()).not.toContain("  branch   ✔ closed");
    expect(nextOfBoard("prog-p1")).toBe("review --type branch --plan docs/kairos/plans/prog-p1.md");
  });

  it("(k) every face closed → the LAST entered face's exit (the pipeline terminus)", () => {
    nodeDocs();
    planDoc([[1]]);
    const ledger = ledgerOf();
    // spec + plan + branch closed with clean reviews; the single wave closed too.
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    ledger.persistHandoff("review", "branch", { round: 1 }, { findings: [] });
    ledger.recordRound("branch", { op: "review" });
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });

    expect(nextOfBoard("prog-p1")).toBe("route to /kairos:cdd-close skill");
  });

  it("(h) the lifecycle frontier's peekNext hop renders the SAME next line as the board", () => {
    nodeDocs();
    const specPath = path.join(repo, "docs/kairos/specs/prog-p1-design.md");
    planDoc([[1]]);
    const ledger = ledgerOf();
    const run = new Lifecycle({
      face: targetFaces["phase-spec"],
      state: EMPTY_RUN_STATE,
      ledger,
      dispatch: async () => ({ status: "APPROVED", findings: [] }),
      target: { kind: "spec", doc: specPath },
      planPath: path.join(repo, "docs/kairos/plans/prog-p1.md"),
    });
    const peeked = run.peekNext();
    expect(peeked?.hop?.hop).toBe("review");
    const capsuleNext = new Capsule(new Words(), ARGV_CHANNEL, "claude", new RepoRoot(repo)).emit(
      "APPROVED",
      "/h.json",
      peeked!.hop!,
    )[1]!;
    expect(capsuleNext.slice("next: ".length)).toBe(nextOfBoard("prog-p1"));
  });

  it("(h2) a drift-reopened CLOSED line's frontier hop is the SAME `next:` the board renders", () => {
    nodeDocs();
    const planFile = planDoc([[1]]);
    const ledger = ledgerOf();
    // The branch line closes on a clean round and binds the plan's revision — its
    // identity document (P21 §3/§4.1). The other lines are seeded closed so the
    // branch face IS the board's frontier (the state a finished run reaches).
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });
    ledger.persistHandoff("review", "branch", { round: 1 }, { findings: [] });
    ledger.recordRound("branch", { op: "review" });
    ledger.recordReviewedRevision(
      "branch",
      ledger.refs().docRevision(planFile, readFileSync(planFile, "utf8")),
      "branch",
    );
    const run = new Lifecycle({
      face: targetFaces.branch,
      state: EMPTY_RUN_STATE,
      ledger,
      dispatch: async () => ({ status: "APPROVED", findings: [] }),
      target: { kind: "branch" },
      planPath: planFile,
    });
    // Closed and drift-free: the frontier holds no frame at all.
    expect(run.peekNext()).toBeNull();
    // One plan revision later the SAME line is open — and the frontier's hop is the
    // exit-side reopen the board names (the fourth read face reads the ONE object).
    writeFileSync(planFile, `${readFileSync(planFile, "utf8")}\n<!-- drift -->\n`, "utf8");
    const peeked = run.peekNext();
    expect(peeked?.hop?.hop).toBe("branch-review");
    expect(peeked?.hop?.reason).toBe("doc-drift");
    const capsuleNext = new Capsule(new Words(), ARGV_CHANNEL, "claude", new RepoRoot(repo)).emit(
      "APPROVED",
      "/h2.json",
      peeked!.hop!,
    )[1]!;
    expect(capsuleNext.slice("next: ".length)).toBe(nextOfBoard("prog-p1"));
  });

  it("(r1) the board's `reason:` row carries the SAME token as the capsule's — each prefix its own", () => {
    nodeDocs();
    const planFile = planDoc([[1]]);
    const ledger = ledgerOf();
    // Every face closed on a clean round and the branch row bound the plan — then one
    // plan revision reopens the branch line (the exit-side drift hop).
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    ledger.persistHandoff("review", "branch", { round: 1 }, { findings: [] });
    ledger.recordRound("branch", { op: "review" });
    ledger.recordReviewedRevision(
      "branch",
      ledger.refs().docRevision(planFile, readFileSync(planFile, "utf8")),
      "branch",
    );
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });
    writeFileSync(planFile, `${readFileSync(planFile, "utf8")}\n<!-- drift -->\n`, "utf8");

    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const root = new RepoRoot(repo);
    const hop = BoardNext.of(index, entry, root);
    expect(hop).not.toBeNull();
    const boardLines = BoardView.render(
      index,
      entry,
      repo,
      new Words(),
      "claude",
      ARGV_CHANNEL,
      undefined,
      hop,
    ).lines;
    const nextAt = boardLines.findIndex((row) => row.startsWith("  next:    "));
    const boardReason = boardLines[nextAt + 1]!;
    // The row's OWN layout prefix is pinned BEFORE any normalization — otherwise
    // `tokenOf` below would paper over a wrong shape.
    expect(boardReason.startsWith("  reason:  ")).toBe(true);

    const capsuleLines = new Capsule(new Words(), ARGV_CHANNEL, "claude", root).emit(
      "APPROVED",
      "/h2.json",
      hop,
    );
    const capsuleReason = capsuleLines[capsuleLines.length - 1]!;
    // The capsule's prefix rides the word table (one space), the board's its own
    // layout literal (two) — only the token is shared.
    expect(capsuleReason.startsWith(`reason: `)).toBe(true);
    const tokenOf = (line: string): string => line.trim().replace(/^reason:\s+/, "");
    expect(tokenOf(boardReason)).toBe(tokenOf(capsuleReason));
    expect(tokenOf(boardReason)).toBe(hop!.reason);
  });

  it("P24 T7 (b1) — the spec-unreviewed frontier: the board and the capsule render ONE assembly", () => {
    nodeDocs();
    planDoc([[1]]);
    const ledger = ledgerOf();
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const root = new RepoRoot(repo);
    // The divergence state: the identity line was never reviewed, so the pipeline
    // frontier HOLDS on the spec face while the wave line is at its own point. The
    // pre-T7 capsule printed the frame-keyed wave literal here; the board printed this.
    const facts = BoardView.pipelineFacts(index, entry, root)!;
    const hop = new PipelineFrontier(ledger).hopOf(facts.input, {
      docClassOf: (target) => BoardView.docClassOf(root, target),
    });
    const rows = nextReasonRows();
    expect(rows.next).toBe("review --type phase-spec --spec docs/kairos/specs/prog-p1-design.md");
    expect(rows.reason).toBe("  reason:  task-open");
    // The board fills no cell of its own: its rows ARE the session-plane assembly's
    // render, through the ONE shared literal face.
    const renderer = new RouteRenderer(new Words(), ARGV_CHANNEL, "claude", root);
    expect(rows.next).toBe(renderer.renderHop(hop)!);
    expect(rows.reason).toBe(BoardView.reasonLine(hop));
    // ... and the capsule renders the same object, its prefix from the word table.
    const capsuleLines = new Capsule(new Words(), ARGV_CHANNEL, "claude", root).emit(
      "APPROVED",
      "/b1.json",
      hop,
    );
    expect(capsuleLines[capsuleLines.length - 2]).toBe(`next: ${rows.next}`);
    expect(capsuleLines[capsuleLines.length - 1]).toBe(`reason: ${hop.reason}`);
  });

  /** The spec + plan lines closed on a clean round and wave {1} implemented + reviewed
   *  with a WARN — the wave's finding awaits its fix and its brief is bound. */
  const warnReviewedWave = (): { ledger: Ledger; planFile: string } => {
    nodeDocs();
    const planFile = planDoc([[1]]);
    const ledger = ledgerOf();
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    ledger.recordRound("1", { op: "implement" });
    ledger.recordRound("1", { op: "review" });
    ledger.persistHandoff(
      "review",
      "wave",
      { tasks: "1", round: 1 },
      { tasks: [1], phase: "review", findings: [{ severity: "warn", lens: "plan", summary: "w" }] },
    );
    ledger.recordReviewedBrief("1", planFile);
    return { ledger, planFile };
  };

  /** One plan revision INSIDE the wave's own section — the reviewed brief moves. */
  const driftWaveSection = (planFile: string): void => {
    const moved = `${readFileSync(planFile, "utf8").trimEnd()}\n  - extra step — checkable: green\n`;
    writeFileSync(planFile, moved, "utf8");
  };

  /** The board's `next:` / `reason:` row pair, in layout order. */
  const nextReasonRows = (host = "claude"): { next: string; reason: string | undefined } => {
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const lines = BoardView.render(
      index,
      entry,
      repo,
      new Words(),
      host,
      ARGV_CHANNEL,
      undefined,
      BoardNext.of(index, entry, new RepoRoot(repo)),
    ).lines;
    const nextAt = lines.findIndex((row) => row.startsWith("  next:    "));
    return {
      next: lines[nextAt]!.slice("  next:    ".length),
      reason: lines[nextAt + 1],
    };
  };

  it("(w1) a drifted fix-pending WAVE renders the review lead with `reason: brief-drift`", () => {
    const { planFile } = warnReviewedWave();
    driftWaveSection(planFile);
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const hop = BoardNext.of(index, entry, new RepoRoot(repo));
    expect(hop).not.toBeNull();
    expect(hop!.hop).toBe("review");
    // P29 §2.3 — a wave brief's task-only projection is not a document revision:
    // the row names its own token, never `doc-drift`.
    expect(hop!.reason).toBe("brief-drift");
    expect(hop!.reason).not.toBe("doc-drift");
    const rows = nextReasonRows();
    // the dispatchable row is still the executable review literal — `reason:` is the
    // DIAGNOSTIC row of its own (never a suffix on `next:`)
    expect(rows.next).toMatch(/^review --type wave --tasks 1 --plan /);
    expect(rows.reason).toBe("  reason:  brief-drift");
  });

  it("(w3) board ↔ dispatch agree: a CLOSED wave's stale brief opens no drift refusal", () => {
    nodeDocs();
    const planFile = planDoc([[1]]);
    const ledger = ledgerOf();
    // Every face closed on a clean round, the wave's brief bound, the branch line
    // bound to the plan revision it judged — a finished run's state.
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    ledger.recordRound("1", { op: "implement" });
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", { op: "review" });
    ledger.recordReviewedBrief("1", planFile);
    ledger.persistHandoff("review", "branch", { round: 1 }, { findings: [] });
    ledger.recordRound("branch", { op: "review" });
    ledger.recordReviewedRevision(
      "branch",
      ledger.refs().docRevision(planFile, readFileSync(planFile, "utf8")),
      "branch",
    );
    // The wave's TASK section moves. The PLAN line is re-reviewed on the moved body
    // (its own round rebinds); the closed wave's brief stays stale — the P29 state.
    driftWaveSection(planFile);
    ledger.persistHandoff("review", "plan", { round: 2 }, { findings: [] });
    ledger.recordRound("plan", { op: "review", cycle: 2 });
    ledger.recordReviewedRevision(
      "plan",
      ledger.refs().docRevision(planFile, readFileSync(planFile, "utf8")),
      "plan",
    );
    expect(ledger.briefDrifted("1")).toBe(true);
    // The board names the branch review (the D76 plan drift), never a wave brief row.
    const rows = nextReasonRows();
    expect(rows.next).toBe("review --type branch --plan docs/kairos/plans/prog-p1.md");
    expect(rows.reason).toBe("  reason:  doc-drift");
    // ... and the dispatch face allows the very round the board names: the closed
    // wave's stale brief refuses nothing (§2.1/§2.6 — one station read, two faces).
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const root = new RepoRoot(repo);
    const facts = BoardView.pipelineFacts(index, entry, root)!;
    const verdict = new DispatchAuthority().verdict({
      verb: "review",
      type: "branch",
      structure: { ok: true, order: [], checked: [] },
      line: {
        ledger,
        words: new Words(),
        graph: null,
        tasks: null,
        lineKey: "branch",
        doc: planFile,
        pipeline: facts.input,
        docClassOf: (candidate) => BoardView.docClassOf(root, candidate),
      },
    });
    expect(verdict).toEqual({ allowed: true });
  });

  it("(w2) the negative control — a SOFT-CAPPED drifted wave is never rewritten into a review", () => {
    const { ledger, planFile } = warnReviewedWave();
    // REVIEW_CYCLE_CAP consecutive blocker reviews each fixed: the wave's fix round
    // reaches the cap, so `waveLineRoute` defers to the user (null) — the soft-cap face.
    for (let cycle = 1; cycle <= REVIEW_CYCLE_CAP; cycle += 1) {
      ledger.recordRound("1", { op: "review", cycle });
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: cycle },
        {
          tasks: [1],
          phase: "review",
          findings: [{ severity: "blocker", lens: "plan", summary: "s" }],
        },
      );
      ledger.recordRound("1", { op: "fix", cycle });
      ledger.persistHandoff(
        "fix",
        "wave",
        { tasks: "1", round: cycle },
        { tasks: [1], phase: "fix", status: "APPROVED" },
      );
    }
    expect(ledger.waveLinePhase("1")).toBeNull(); // the cap holds the line
    const before = nextReasonRows();
    // the soft-capped wave face is the frontier with NO active hop — its OWN pipeline
    // exit station (the branch handoff literal), not a wave review
    expect(before.next).toBe("review --type branch --plan docs/kairos/plans/prog-p1.md");
    // the brief drifts AFTER the cap — the injected fact must not rewrite the route
    driftWaveSection(planFile);
    const after = nextReasonRows();
    expect(after.next).toBe(before.next);
    expect(after.next).not.toContain("--type wave");
    expect(after.reason).toBe("  reason:  closed-line");
    expect(ledger.waveLinePhase("1")).toBeNull(); // the board stays on the gate's side
  });

  it("(s1) the board frontier reads drift on the spec line — a drifted reviewed spec halts at its review lead", () => {
    nodeDocs();
    const specFile = path.join(repo, "docs/kairos/specs/prog-p1-design.md");
    planDoc([[1]]);
    const ledger = ledgerOf();
    // The spec line closes on a clean round and binds the revision it judged (the
    // identity a real run's write-back records); the plan line closes the same way.
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.recordReviewedRevision(
      "phase-spec",
      ledger.refs().docRevision(specFile, readFileSync(specFile, "utf8")),
      "phase-spec",
    );
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    enterWaveFace(ledger);
    // Undrifted: the frontier has walked past the doc faces onto the wave's ready batch.
    expect(nextOfBoard("prog-p1")).toBe("implement --plan docs/kairos/plans/prog-p1.md --tasks 1");
    // One spec revision later the SAME face is open — the frontier holds on the spec
    // face and names its review lead, never the wave command the engine would reject.
    writeFileSync(specFile, `${readFileSync(specFile, "utf8")}\n<!-- drift -->\n`, "utf8");
    const rows = nextReasonRows();
    expect(rows.next).toBe("review --type phase-spec --spec docs/kairos/specs/prog-p1-design.md");
    expect(rows.reason).toBe("  reason:  doc-drift");
  });

  it("(s2) the twin stays green — a clean re-review closes the spec face and the frontier advances", () => {
    nodeDocs();
    const specFile = path.join(repo, "docs/kairos/specs/prog-p1-design.md");
    planDoc([[1]]);
    const ledger = ledgerOf();
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.recordReviewedRevision(
      "phase-spec",
      ledger.refs().docRevision(specFile, readFileSync(specFile, "utf8")),
      "phase-spec",
    );
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    enterWaveFace(ledger);
    writeFileSync(specFile, `${readFileSync(specFile, "utf8")}\n<!-- drift -->\n`, "utf8");
    // The drifted spec's own review lead runs clean: the line rebinds the moved
    // revision and the frontier walks on to the plan's wave shape (the regression pin).
    ledger.persistHandoff("review", "phase-spec", { round: 2 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review", cycle: 2 });
    ledger.recordReviewedRevision(
      "phase-spec",
      ledger.refs().docRevision(specFile, readFileSync(specFile, "utf8")),
      "phase-spec",
    );
    expect(nextOfBoard("prog-p1")).toBe("implement --plan docs/kairos/plans/prog-p1.md --tasks 1");
  });

  // The plan face's OWN drift cell (`lineStateAt("plan", "plan", planPath)`) — the same
  // judgment the spec half reads, on the document the plan line actually bound. The cell
  // itself lives in the session plane (`PipelineFrontier#planState`), and the judgement
  // face it yields is pinned in `session/__tests__/pipeline.test.ts`; this case keeps a
  // separate, board-side pin: the `next:` / `reason:` bytes a drifted plan renders.
  it("(s3) the plan face reads drift on its own identity document — a drifted reviewed plan halts at its review lead", () => {
    nodeDocs();
    const specFile = path.join(repo, "docs/kairos/specs/prog-p1-design.md");
    const planFile = planDoc([[1]]);
    const ledger = ledgerOf();
    // Both doc lines close on a clean round and bind the revision each judged — the
    // key/identity pairs a real run's write-back records (`phase-spec` at its own line,
    // `plan` at its own line), so the plan cell has a real identity to drift past.
    ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
    ledger.recordRound("phase-spec", { op: "review" });
    ledger.recordReviewedRevision(
      "phase-spec",
      ledger.refs().docRevision(specFile, readFileSync(specFile, "utf8")),
      "phase-spec",
    );
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", { op: "review" });
    ledger.recordReviewedRevision(
      "plan",
      ledger.refs().docRevision(planFile, readFileSync(planFile, "utf8")),
      "plan",
    );
    // Undrifted: the frontier has walked past both doc faces onto the wave's batch.
    enterWaveFace(ledger);
    expect(nextOfBoard("prog-p1")).toBe("implement --plan docs/kairos/plans/prog-p1.md --tasks 1");
    // One plan revision later the plan face is open — the frontier holds THERE and
    // names the plan's review lead, never the wave command the engine would reject.
    writeFileSync(planFile, `${readFileSync(planFile, "utf8")}\n<!-- drift -->\n`, "utf8");
    const rows = nextReasonRows();
    expect(rows.next).toBe("review --type plan --plan docs/kairos/plans/prog-p1.md");
    expect(rows.reason).toBe("  reason:  doc-drift");
    // The drifted plan's own review lead runs clean: the line rebinds the moved revision
    // and the frontier advances again — the plan-side half of the regression pin.
    ledger.persistHandoff("review", "plan", { round: 2 }, { findings: [] });
    ledger.recordRound("plan", { op: "review", cycle: 2 });
    ledger.recordReviewedRevision(
      "plan",
      ledger.refs().docRevision(planFile, readFileSync(planFile, "utf8")),
      "plan",
    );
    expect(nextOfBoard("prog-p1")).toBe("implement --plan docs/kairos/plans/prog-p1.md --tasks 1");
  });

  it("(r2) a hop-less board renders `next: (none)` with no reason row — byte-unchanged", () => {
    nodeDocs();
    planDoc([[1]]);
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const lines = BoardView.render(index, entry, repo, new Words(), "claude", ARGV_CHANNEL).lines;
    expect(lines).toContain("  next:    (none)");
    expect(lines.some((row) => row.startsWith("  reason:"))).toBe(false);
  });

  it("(r3) the program board's literal `next: done` takes no reason row", () => {
    nodeDocs();
    planDoc([[1]]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "version: v0.14",
      "status: Done",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-overall");
    const lines = BoardView.render(
      index,
      entry,
      repo,
      new Words(),
      "claude",
      ARGV_CHANNEL,
      undefined,
      BoardNext.of(index, entry, new RepoRoot(repo)),
    ).lines;
    expect(lines).toContain("  next:    done");
    expect(lines.some((row) => row.startsWith("  reason:"))).toBe(false);
  });

  it("(e) the whole board output carries zero absolute paths (doc names collapse to basenames)", () => {
    nodeDocs();
    planDoc([[1]]);
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const board = BoardView.render(
      index,
      entry,
      repo,
      new Words(),
      "claude",
      ARGV_CHANNEL,
      undefined,
      BoardNext.of(index, entry, new RepoRoot(repo)),
    );
    const text = board.lines.join("\n");
    expect(text).not.toContain(repo);
    expect(text).not.toMatch(/(^|\s)\/(Users|tmp|home)\//);
  });

  it("(i) §5.3 — the default face never renders a range form, and every token carries its mark", () => {
    nodeDocs();
    planDoc([[1]]);
    const ledger = ledgerOf();
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      ledger.persistHandoff("review", "phase-spec", { round: cycle }, { findings: [] });
      ledger.recordRound("phase-spec", { op: "review", cycle });
    }
    const index = SlugIndex.build(repo);
    const entry = entryOf("prog-p1");
    const text = BoardView.render(
      index,
      entry,
      repo,
      new Words(),
      "claude",
      ARGV_CHANNEL,
      undefined,
      BoardNext.of(index, entry, new RepoRoot(repo)),
    ).lines.join("\n");
    expect(text).toContain("review 10 ✓");
    expect(text).not.toMatch(/review 1[–-]10/);
    expect(text).not.toMatch(/review \d+(?![a-z0-9]*\s*[✓✗])/);
  });
});
