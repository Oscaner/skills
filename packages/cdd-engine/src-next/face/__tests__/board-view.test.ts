// packages/cdd-engine/src-next/face/__tests__/board-view.test.ts
// The board face's colocated pins (T5 rework): the entry document → board.
//   · the render face — entry `doc-type:` picks the node/program board; every
//     related node resolves through `SlugIndex` by slug; violation markers and the
//     `(none)` degradation states; the `next:` derivation.
// Fixtures are hermetic tmp dirs (no git needed — pure file-system reads).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { RepoRoot } from "../../infra/root.ts";
import { type DocEntry, SlugIndex } from "../../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../../session/ledger.ts";
import { BoardView } from "../board-view.ts";
import { Capsule } from "../capsule.ts";
import { ARGV_CHANNEL } from "../declare.ts";
import { Words } from "../words.ts";

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
    const board = BoardView.render(
      SlugIndex.build(repo),
      entry,
      repo,
      new Words(),
      host,
      ARGV_CHANNEL,
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
      "doc-type: overall-spec",
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
    seed("prog-p1", [{ wave: "spec", rounds: { review: [1, 2], fix: [1] } }]);

    const { text, exitCode } = render("prog-p1");

    expect(exitCode).toBe(0);
    expect(text).toContain("cdd board: prog-p1");
    expect(text).toContain("  overall  ");
    expect(text).toContain("prog-p1-design.md   v0.14 · Done");
    expect(text).toContain("prog-p1.md   v0.9");
    // D47 — the doc cells render repoRoot-relative (the index holds absolute paths;
    // the board emits the ONE shape). No row carries the absolute repo prefix.
    expect(text).toContain("  spec     docs/kairos/specs/prog-p1-design.md");
    expect(text).toContain("  plan     docs/kairos/plans/prog-p1.md");
    expect(text).not.toContain(repo);
    expect(text).toContain("  branch   ○ open");
    expect(text.split("\n").at(-1)).toBe("progress: ✔ done · ▶ current · ○ pending");
  });

  it("renders one wave line per derived wave with the ✔/▶ markers", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall-spec",
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
    ledger.recordRound("1", "review");

    const { text } = render("prog-p1");

    // D40 — the wave line's label carries the wave's task scope in braces.
    expect(text).toContain("W1 {1}");
    expect(text).toContain("W2 {2}");
  });

  it("phase board next: the first not-closed line renders its ACTIVE C5 hop (the spec review)", () => {
    // D40 deep-solve — the spec line has not started its C5 (no review round on record),
    // so its ACTIVE hop is the review-lead the dispatch engine would run (Ledger#lineRoute
    // → {kind:"review"}), NOT the exhausted-face handoff `/kairos:cdd-plan`. board next ==
    // engine next (the retired shallow form rendered the face-to-face entry for an open line).
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall-spec",
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
      `  next:    review --type spec --spec ${path.relative(repo, path.join(repo, "docs/kairos/specs/prog-p1-design.md"))}`,
    );
    expect(text).not.toContain("  next:    /kairos:cdd-plan");
  });

  it("phase board next: spec closed + plan not started → the plan line's active review hop", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall-spec",
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
    ledger.persistHandoff("review", "spec", { round: 1 }, { findings: [] });
    ledger.recordRound("spec", "review");

    const { text } = render("prog-p1");

    // The spec face is exhausted → the plan line is the frontier; the plan line has not
    // started its C5 → its ACTIVE hop is the plan review (not the cdd-dev handoff).
    expect(text).toContain(
      `  next:    review --type plan --plan ${path.relative(repo, path.join(repo, "docs/kairos/plans/prog-p1.md"))}`,
    );
    expect(text).not.toContain("  next:    /kairos:cdd-dev");
  });

  it("phase board next: a skipped-cycle plan line (`{review:[1,2], fix:[2]}`) is CLOSED — the engine's judge, not a count", () => {
    // The drift-voided review-1 shape the reviewer's own P8 workspace carries. A
    // count-based closure judge reads the nonexistent fix cycle 1 → plan OPEN → the
    // plan entry; the engine's identity judge reads the fix at cycle 2 → plan CLOSED
    // → next advances past the plan face.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall-spec",
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
    // spec closed (a recorded zero-findings spec review)
    ledger.persistHandoff("review", "spec", { round: 1 }, { findings: [] });
    ledger.recordRound("spec", "review");
    // plan closed by identity: review cycles [1,2], the fix at its own cycle 2
    ledger.persistHandoff("review", "plan", { round: 2 }, { findings: [] });
    ledger.persistHandoff("fix", "plan", { round: 2 }, { findings: [] });
    ledger.recordRound("plan", "review", 1);
    ledger.recordRound("plan", "review", 2);
    ledger.recordRound("plan", "fix", 2);

    const { text } = render("prog-p1");

    // plan closed → past the plan face; no plan task blocks → the wave face is the frontier
    expect(text).not.toContain("  next:    /kairos:cdd-dev");
    expect(text).toContain("  next:    review --type branch --plan");
  });

  it("D40 — a skipped-cycle row's board judgment EQUALS the engine's Ledger#lineClosed verdict", () => {
    // The board's `next:` walk now delegates its closure reads to Ledger#lineClosed
    // (the single judge) — a jump-number row `{review:[1,2], fix:[2]}` (D28) must read
    // CLOSED on BOTH faces. A count-based board judge (the retired hand-rolled form)
    // would read it OPEN and diverge from the engine.
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall-spec",
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
    ledger.recordRound("plan", "review", 1);
    ledger.recordRound("plan", "review", 2);
    ledger.recordRound("plan", "fix", 2);

    // The engine judge: the plan line is CLOSED (the fix at its own cycle 2, D28).
    expect(ledger.lineClosed("plan", "plan")).toBe(true);
    // The board consumes that SAME judge — the plan face is exhausted.
    const { text } = render("prog-p1");
    expect(text).not.toContain("  next:    /kairos:cdd-dev");
  });

  it("D40 — the wave line's label carries the wave's task scope (W3 = tasks 5,11)", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall-spec",
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
      "doc-type: overall-spec",
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
    ledger.persistHandoff("review", "spec", { round: 1 }, { findings: [] });
    ledger.recordRound("spec", "review");
    ledger.persistHandoff("review", "plan", { round: 1 }, { findings: [] });
    ledger.recordRound("plan", "review");
    // W1 ({5}) closed: a recorded zero-findings review round.
    ledger.persistHandoff("review", "wave", { tasks: "5", round: 1 }, { findings: [] });
    ledger.recordRound("5", "review");
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
      "doc-type: overall-spec",
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
    ledger.recordRound("1", "review");

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
      "doc-type: overall-spec",
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
    ledger.persistHandoff("review", "spec", { round: 1 }, { findings: [] });
    ledger.recordRound("spec", "review");

    const { text } = render("prog-p1", "");

    expect(text).toContain("  next:    /kairos:cdd-plan");
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
      "doc-type: overall-spec",
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
    ledger.persistHandoff("review", "spec", { round: 1 }, { findings: [] });
    ledger.recordRound("spec", "review");
    expect(nextOf("prog-p1", "pi")).toBe("/skill:cdd-plan");
    expect(nextOf("prog-p1", "claude")).toBe("/kairos:cdd-plan");
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
      "doc-type: overall-spec",
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
    ledger.persistHandoff("review", "spec", { round: 1 }, { findings: [] });
    ledger.recordRound("spec", "review");

    for (const host of ["claude", "pi"]) {
      const capsuleNext = new Capsule(new Words(), ARGV_CHANNEL, host, new RepoRoot(repo))
        .emit("APPROVED", "0", "/h.json", { kind: "done" }, { type: "spec", id: specId })[1]!
        .slice("next: ".length);
      // The board's spec face is drained (spec closed + no plan doc) → the same entry.
      expect(nextOf("prog-p1", host)).toBe(capsuleNext);
      expect(capsuleNext).toBe(host === "pi" ? "/skill:cdd-plan" : "/kairos:cdd-plan");
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
      "doc-type: overall-spec",
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
        .emit("APPROVED", "0", "/h.json", { kind: "review" }, { type: "spec", id: specId })[1]!
        .slice("next: ".length);
      // The reviewer's own hop renders the repoRoot-relative --spec (never the absolute).
      expect(capsuleNext).toBe("review --type spec --spec docs/kairos/specs/prog-p1-design.md");
      expect(capsuleNext).not.toContain(repo);
      // The board's spec frontier renders the SAME byte-identical relative literal.
      expect(nextOf("prog-p1", host)).toBe(capsuleNext);
    }
  });

  it("a present doc without a Doc type declaration renders BLOCKED and exits 2", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall-spec",
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
      "doc-type: overall-spec",
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
    seed("prog-overall", [{ wave: "spec", rounds: { review: [1, 2, 3, 4] } }]);
    seed("prog-p1", [
      { wave: "spec", rounds: { review: [1] } },
      { wave: "plan", rounds: { review: [1] } },
      { wave: "branch", rounds: { "branch-review": [1] } },
    ]);

    const { text, exitCode } = render("prog-overall");

    expect(exitCode).toBe(0);
    expect(text).toContain("cdd board: prog-overall");
    expect(text).toContain("prog-overall.md   v2.33   review×4" /* 4 cycle numbers → ×4 */);
    // The full phase line shape (spec §5.3): status + the spec/plan/wave/branch cells,
    // the `wave W1…` token derived from the phase's own wave segment.
    expect(text).toContain(
      "  phase prog-p1  Pending   spec review×1 · plan review×1 · wave W1… · branch branch-review×1   title: S",
    );
    expect(text).toContain("  next:    done");
  });

  it("orders the phase rows by their phase number, never by the rel-path lexicographic order", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall-spec",
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
      "doc-type: overall-spec",
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
      "doc-type: overall-spec",
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
