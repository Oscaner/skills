// packages/cdd-engine/src-next/face/__tests__/board-view.test.ts
// The board face's colocated pins (T2 slice): the slug → node-tree infrastructure
//   · Workspace.docsOfSlug — the reverse derivation over a hermetic tmp repo
//     (program slug → overall path · phase slug → spec/plan paths · deep-phase
//     suffix parse);
//   · BoardView.scanPhases — the phase-suffix set from the specs dir, sorted by the
//     dot-separated numeric path, with NO on-disk-absent parent synthesized;
//   · the artifact header read — `{version, status, docType}` from the doc's
//     header block, the doc type read from the `- **Doc type**:` declaration line
//     (spec §12 · D34 — null when absent, zero filename-suffix inference).
// Fixtures are hermetic tmp dirs (no git needed — pure file-system reads).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../../session/ledger.ts";
import { BoardView } from "../board-view.ts";
import { Words } from "../words.ts";

describe("Workspace.docsOfSlug — the slug → doc-tree reverse derivation", () => {
  let repo: string;
  let prevCwd: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-view-"));
    prevCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  });

  it("a phase slug derives the overall + spec + plan paths from what exists on disk", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-overall.md"), "# P\n");
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p7-design.md"), "# S\n");
    writeFileSync(path.join(repo, "docs/kairos/plans/prog-p7.md"), "# Plan\n");

    const docs = Workspace.docsOfSlug("prog-p7", repo);

    expect(docs.phaseSuffix).toBe("-p7");
    expect(docs.overall).toBe(path.join(repo, "docs/kairos/specs/prog-overall.md"));
    expect(docs.spec).toBe(path.join(repo, "docs/kairos/specs/prog-p7-design.md"));
    expect(docs.plan).toBe(path.join(repo, "docs/kairos/plans/prog-p7.md"));
  });

  it("a phase slug with the overall absent carries null — nothing synthesized", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p7-design.md"), "# S\n");

    const docs = Workspace.docsOfSlug("prog-p7", repo);

    expect(docs.overall).toBeNull();
    expect(docs.spec).not.toBeNull();
    expect(docs.plan).toBeNull();
  });

  it("a deep-phase suffix parses whole and anchors the nearest existing overall", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p7-overall.md"), "# O\n");

    const docs = Workspace.docsOfSlug("prog-p7.1", repo);

    expect(docs.phaseSuffix).toBe("-p7.1");
    expect(docs.overall).toBe(path.join(repo, "docs/kairos/specs/prog-p7-overall.md"));
    expect(docs.spec).toBeNull();
  });

  it("a deep-phase suffix falls through to the program overall when no sub-overall exists", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-overall.md"), "# O\n");

    const docs = Workspace.docsOfSlug("prog-p3.2.1", repo);

    expect(docs.phaseSuffix).toBe("-p3.2.1");
    expect(docs.overall).toBe(path.join(repo, "docs/kairos/specs/prog-overall.md"));
  });

  it("a deepest suffix parses whole (`-p3.2.1`)", () => {
    const docs = Workspace.docsOfSlug("prog-p3.2.1", repo);
    expect(docs.phaseSuffix).toBe("-p3.2.1");
  });

  it("a program slug (no phase suffix) derives only the overall", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-overall.md"), "# O\n");

    const docs = Workspace.docsOfSlug("prog", repo);

    expect(docs.phaseSuffix).toBeNull();
    expect(docs.overall).toBe(path.join(repo, "docs/kairos/specs/prog-overall.md"));
    expect(docs.spec).toBeNull();
    expect(docs.plan).toBeNull();
  });
});

describe("BoardView.scanPhases — the phase-suffix scan (no absent parent synthesized)", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-view-scan-"));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("only the on-disk suffixes return — a lone `-p4.1` mounts without `-p4`", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p4.1-design.md"), "# S\n");

    expect(BoardView.scanPhases("prog", repo)).toEqual(["-p4.1"]);
  });

  it("suffixes sort by the dot-separated numeric path (2 before 10, p4 before p4.1)", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    for (const name of ["prog-p10", "prog-p2", "prog-p4", "prog-p4.1"])
      writeFileSync(path.join(repo, "docs/kairos/specs", `${name}-design.md`), "# S\n");

    expect(BoardView.scanPhases("prog", repo)).toEqual(["-p2", "-p4", "-p4.1", "-p10"]);
  });

  it("an absent specs dir scans empty (a bare repo is a valid board input)", () => {
    expect(BoardView.scanPhases("prog", repo)).toEqual([]);
  });
});

describe("BoardView.readHeader — the artifact header `{version, status, docType}` read", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-view-head-"));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("reads the Version/Status/Doc type markers from a plan doc's header block", () => {
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    const planPath = path.join(repo, "docs/kairos/plans/prog-p8.md");
    writeFileSync(
      planPath,
      [
        "# The plan",
        "",
        "- **Version**: v0.9 · …",
        "- **Status**: Done",
        "- **Doc type**: plan",
        "",
        "## Constraints",
        "",
      ].join("\n"),
    );

    expect(BoardView.readHeader(planPath)).toEqual({
      version: "v0.9",
      status: "Done",
      docType: "plan",
    });
  });

  it("reads the declared docType from a phase-spec's `- **Doc type**:` declaration line", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    const specPath = path.join(repo, "docs/kairos/specs/prog-p8-design.md");
    writeFileSync(
      specPath,
      [
        "# The phase spec",
        "",
        "- **Version**: v1.2 · 2026-10-15",
        "- **Status**: In review",
        "- **Doc type**: phase-spec",
        "",
        "## 1. The design group",
        "",
      ].join("\n"),
    );

    expect(BoardView.readHeader(specPath)).toEqual({
      version: "v1.2",
      status: "In review",
      docType: "phase-spec",
    });
    expect(BoardView.readDocType(specPath)).toBe("phase-spec");
  });

  it("a doc without a Doc type declaration reads docType null — the consumer blocks, no suffix fallback", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    const specPath = path.join(repo, "docs/kairos/specs/prog-p8-design.md");
    writeFileSync(
      specPath,
      ["# The phase spec", "", "- **Version**: v1.0", "- **Status**: Draft", ""].join("\n"),
    );

    expect(BoardView.readHeader(specPath)).toEqual({
      version: "v1.0",
      status: "Draft",
      docType: null,
    });
    expect(BoardView.readDocType(specPath)).toBeNull();
  });

  it("an out-of-domain Doc type value reads null — present facts, never a fabricated type", () => {
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    const planPath = path.join(repo, "docs/kairos/plans/prog-p8.md");
    writeFileSync(planPath, ["# The plan", "", "- **Doc type**: memo", ""].join("\n"));

    expect(BoardView.readDocType(planPath)).toBeNull();
  });

  it("an absent doc yields nulls — never a fabricated value", () => {
    expect(BoardView.readHeader(path.join(repo, "docs/kairos/plans/ghost-p8.md"))).toEqual({
      version: null,
      status: null,
      docType: null,
    });
  });

  it("a doc whose first line is not the `# Title` still reads its metadata block", () => {
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    const planPath = path.join(repo, "docs/kairos/plans/prog-p8.md");
    writeFileSync(
      planPath,
      [
        "- **Version**: v0.9 · …",
        "- **Status**: Done",
        "- **Doc type**: plan",
        "",
        "## Constraints",
        "",
      ].join("\n"),
    );

    expect(BoardView.readHeader(planPath)).toEqual({
      version: "v0.9",
      status: "Done",
      docType: "plan",
    });
  });
});

describe("BoardView projectNode — the per-node progress.json single-source projection", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-progress-"));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  /** Seed a node's own workspace progress.json (the pure data write — the read side
   *  is the projection under test, never a Ledger round synthesis). */
  const seedProgress = (slug: string, data: Record<string, unknown>): void => {
    const dir = path.join(repo, ".kairos/cdd", slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "progress.json"),
      JSON.stringify({ timeoutCount: 0, contractViolationCount: 0, waves: [], ...data }, null, 2),
    );
  };

  it("projects each node from its OWN progress.json — the overall node and a phase node", () => {
    seedProgress("o1-overall", {
      waves: [{ wave: "spec", rounds: { review: [1, 2], fix: [1] } }],
    });
    seedProgress("o1-p1", { waves: [{ wave: "plan", rounds: { review: [1], fix: [2] } }] });
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/o1-p1-design.md"), "# S\n");

    const nodes = BoardView.projectNodes("o1", repo);
    const overall = nodes.find((node) => node.label === "o1-overall");
    const phase = nodes.find((node) => node.label === "o1-p1");

    expect(overall?.rounds).toEqual({ review: [1, 2], fix: [1] });
    expect(phase?.lines.find((line) => line.label === "plan")?.rounds).toEqual({
      review: [1],
      fix: [2],
    });
  });

  it("renders the ×N from the CYCLE-NUMBER array length — never the stored number", () => {
    expect(BoardView.roundsCell({ review: [1, 3] })).toBe("review×2");
    expect(BoardView.roundsCell({ implement: [1], review: [1, 3], fix: [2] })).toBe(
      "implement×1 · review×2 · fix×1",
    );
    // the retired numeric form is out-of-format — no count renders (zero compat layer)
    expect(BoardView.roundsCell({ review: 2 } as unknown as Record<string, number[]>)).toBe("");
  });

  it("derives one wave line per wave — the ✔/▶ markers ride the closedWaves() read", () => {
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    const planPath = path.join(repo, "docs/kairos/plans/o1-p1.md");
    writeFileSync(
      planPath,
      [
        "# Plan",
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
      ].join("\n"),
    );
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/o1-p1-design.md"), "# S\n");
    // Close wave {1}: a recorded zero-findings review round at the wave row "1".
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "o1-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "wave", { tasks: "1", round: 1 }, { findings: [] });
    ledger.recordRound("1", "review");

    const node = BoardView.projectNode("o1-p1", repo);
    const rendered = (node.waveLines ?? []).map((line) => `${line.label} ${line.marker}`);

    expect(rendered[0]).toContain("W1 ✔");
    expect(rendered[1]).toContain("W2 ▶");
  });

  it("degrades without error — no plan leaves the wave segment empty, no throw", () => {
    seedProgress("o1-p2", { waves: [{ wave: "spec", rounds: { review: [1] } }] });
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/o1-p2-design.md"), "# S\n");

    const node = BoardView.projectNode("o1-p2", repo);

    expect(node.waveLines ?? []).toEqual([]);
  });

  it("leaves the overall segment empty when the program carries no overall doc", () => {
    seedProgress("o1-overall", { waves: [{ wave: "spec", rounds: { review: [1] } }] });

    const node = BoardView.projectNode("o1-overall", repo);

    expect(node.version).toBeNull();
    expect(node.rounds).toEqual({ review: [1] });
  });
});

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

  const render = (slug: string, host = "claude"): { text: string; exitCode: number } => {
    const board = BoardView.render(slug, repo, new Words(), host);
    return { text: board.lines.join("\n"), exitCode: board.exitCode };
  };

  it("renders the phase board header + rows + the fixed legend tail", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", [
      "# S",
      "",
      "- **Version**: v0.14",
      "- **Status**: Done",
      "- **Doc type**: phase-spec",
    ]);
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "# Plan",
      "",
      "- **Version**: v0.9",
      "- **Doc type**: plan",
    ]);
    seed("prog-p1", [{ wave: "spec", rounds: { review: [1, 2], fix: [1] } }]);

    const { text, exitCode } = render("prog-p1");

    expect(exitCode).toBe(0);
    expect(text).toContain("cdd board: prog-p1");
    expect(text).toContain("  overall  ");
    expect(text).toContain("prog-p1-design.md   v0.14 · Done");
    expect(text).toContain("prog-p1.md   v0.9");
    expect(text).toContain("  branch   ○ open");
    expect(text.split("\n").at(-1)).toBe("progress: ✔ done · ▶ current · ○ pending");
  });

  it("renders one wave line per derived wave with the ✔/▶ markers", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Doc type**: phase-spec"]);
    // Two task blocks → two waves.
    writeDoc("docs/kairos/plans/prog-p1.md", [
      "# Plan",
      "",
      "- **Doc type**: plan",
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

    expect(text).toContain("W1 ✔");
    expect(text).toContain("W2 ▶");
  });

  it("phase board next: renders the first unexhausted face's PIPELINE_NEXT entry", () => {
    // spec NOT closed → the phase-spec frontier → the cdd-plan ref (host=claude).
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Doc type**: phase-spec"]);
    writeDoc("docs/kairos/plans/prog-p1.md", ["# Plan", "", "- **Doc type**: plan"]);

    const { text } = render("prog-p1");

    expect(text).toContain("  next:    /kairos:cdd-plan");
  });

  it("phase board next: spec closed + plan not started → the plan face's cdd-dev entry", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Doc type**: phase-spec"]);
    writeDoc("docs/kairos/plans/prog-p1.md", ["# Plan", "", "- **Doc type**: plan"]);
    // Close the spec line: a recorded zero-findings spec review.
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "prog-p1").ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    ledger.persistHandoff("review", "spec", { round: 1 }, { findings: [] });
    ledger.recordRound("spec", "review");

    const { text } = render("prog-p1");

    expect(text).toContain("  next:    /kairos:cdd-dev");
  });

  it("phase board next: a skipped-cycle plan line (`{review:[1,2], fix:[2]}`) is CLOSED — the engine's judge, not a count", () => {
    // The drift-voided review-1 shape the reviewer's own P8 workspace carries. A
    // count-based closure judge reads the nonexistent fix cycle 1 → plan OPEN → the
    // plan entry; the engine's identity judge reads the fix at cycle 2 → plan CLOSED
    // → next advances past the plan face.
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Doc type**: phase-spec"]);
    writeDoc("docs/kairos/plans/prog-p1.md", ["# Plan", "", "- **Doc type**: plan"]);
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

  it("phase board next: the same literal the Capsule renders for the done face (byte-identical)", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Doc type**: phase-spec"]);
    writeDoc("docs/kairos/plans/prog-p1.md", ["# Plan", "", "- **Doc type**: plan"]);

    const { text } = render("prog-p1", "");

    // host "" falls back to the claude form (REFS[ref].claude) — never a bare plugin guess.
    expect(text).toContain("  next:    /kairos:cdd-plan");
  });

  it("a present doc without a Doc type declaration renders BLOCKED and exits 2", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    // The spec doc carries NO `- **Doc type**:` line.
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Version**: v1.0"]);
    writeDoc("docs/kairos/plans/prog-p1.md", ["# Plan", "", "- **Doc type**: plan"]);

    const { text, exitCode } = render("prog-p1");

    expect(exitCode).toBe(2);
    expect(text).toContain("doc-type: missing (BLOCKED)");
  });

  it("renders the program board with one phase summary line + next: done", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", [
      "# O",
      "",
      "- **Version**: v2.33",
      "- **Doc type**: overall-spec",
    ]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Doc type**: phase-spec"]);
    writeDoc("docs/kairos/plans/prog-p1.md", ["# Plan", "", "- **Doc type**: plan"]);
    seed("prog-overall", [{ wave: "spec", rounds: { review: [1, 2, 3, 4] } }]);

    const { text, exitCode } = render("prog");

    expect(exitCode).toBe(0);
    expect(text).toContain("cdd board: prog");
    expect(text).toContain("prog-overall.md   v2.33   review×4" /* 4 cycle numbers → ×4 */);
    expect(text).toContain("  phase P1");
    expect(text).toContain("  next:    done");
  });

  it("the program board propagates a phase doc-type BLOCK — a present phase spec without a declaration exits 2", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    // The phase spec carries NO `- **Doc type**:` line — the phase board BLOCKs it;
    // the program board must propagate the SAME BLOCK (no silent fallback, spec §12).
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Version**: v1.0"]);
    writeDoc("docs/kairos/plans/prog-p1.md", ["# Plan", "", "- **Doc type**: plan"]);

    const { text, exitCode } = render("prog");

    expect(exitCode).toBe(2);
    expect(text).toContain("  phase P1  doc-type: missing (BLOCKED)");
  });

  it("degrades without error — an absent plan leaves the wave segment empty", () => {
    writeDoc("docs/kairos/specs/prog-overall.md", ["# O", "", "- **Doc type**: overall-spec"]);
    writeDoc("docs/kairos/specs/prog-p1-design.md", ["# S", "", "- **Doc type**: phase-spec"]);

    const board = BoardView.render("prog-p1", repo, new Words(), "claude");

    expect(board.lines.join("\n")).toContain("  wave     (none)");
  });
});

describe("BoardView.hasNode — the file-system-only existence test", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-hasnode-"));
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("a ghost slug matches nothing on disk", () => {
    expect(BoardView.hasNode("ghost", repo)).toBe(false);
    expect(BoardView.hasNode("ghost-p9", repo)).toBe(false);
  });

  it("a program slug matches its overall", () => {
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-overall.md"), "# O\n");
    expect(BoardView.hasNode("prog", repo)).toBe(true);
  });

  it("a phase slug matches its on-disk spec", () => {
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p1-design.md"), "# S\n");
    expect(BoardView.hasNode("prog-p1", repo)).toBe(true);
  });
});
