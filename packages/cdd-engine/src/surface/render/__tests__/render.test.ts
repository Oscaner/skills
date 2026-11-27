// packages/cdd-engine/src/surface/render/__tests__/render.test.ts
// The render pins — one arm per declared byte face, each asserting WHICH value produces
// WHICH bytes, so a renderer that stops connecting the word table, a second assembly point or
// a dropped row goes red here instead of shipping.
//
// The pins are grouped by the value a renderer takes: the prompt bands, the capsule, the route
// face (the one `next:` / `checked:` / refusal assembly), the wave board, the board (two
// display states, the tree fact block, the artifact inventory, the program layout), the brief
// (the projection a wave line binds and the bytes its child reads), the preview's three blocks,
// the issue contract, the init exits and the usage table.
//
// Every fixture value is built here, from the same declared shapes the renderers read, so the
// suite measures the renderer and never this repository's own documents.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TARGET_TYPE_VALUES } from "../../../docs/identity/types.ts";
import { regradeNote } from "../../../docs/judging/criteria.ts";
import type { RepoPath } from "../../../env/paths/root.ts";
import { Clock } from "../../../env/process/clock.ts";
import type { ProvisionStep } from "../../../env/provision/init.ts";
import type { UsageReason } from "../../../run/advance/frame.ts";
import type { NextHop } from "../../../run/advance/next.ts";
import type { WaveVerdict } from "../../../run/advance/wave.ts";
import type { InFlightRecord } from "../../../run/dispatch/inflight.ts";
import type { CheckedRow, PreFlightVerdict } from "../../../run/gate/preflight.ts";
import type { RefusalFacts, RefusalState } from "../../../run/gate/refusal.ts";
import type {
  ArtifactObservation,
  BoardDoc,
  BoardFacts,
  BoardPhase,
  BoardRound,
  BoardRow,
  CrashedRound,
} from "../../../run/index.ts";
import type { ArtifactRead } from "../../../run/ledger/artifact-reads.ts";
import { Cli } from "../../index.ts";
import { Words } from "../../words/words.ts";
import { type BoardValue, BoardView, FOLDED_BOARD } from "../board.ts";
import { BriefRenderer } from "../brief.ts";
import { Capsule } from "../capsule.ts";
import { type GraphTree, GraphView } from "../graph.ts";
import { type InitFacts, InitRenderer } from "../init.ts";
import { IssueBodyRenderer } from "../issue.ts";
import { Preview } from "../preview.ts";
import { RouteRenderer } from "../route.ts";
import { PromptBandsRenderer, REVIEW_VARIANTS, TEMPLATE_PROMPT, WORK_MODES } from "../templates.ts";
import { FAILURE_REASONS, type FailureValue, USAGE_BYTES, UsageFace } from "../usage.ts";

/** The usage members, as the UNION's own projection: a mapped type over `UsageReason["kind"]`
 *  cannot miss a member (the compiler demands every key) and cannot name a non-member (the
 *  value is that key), so this map is not a list maintained beside the union — it is the
 *  union, spelled out where a pin can read it. An array typed `satisfies readonly …[]` would
 *  only close one direction: a forgotten member would pass, and the pin would then compare the
 *  table against a strict subset of itself. */
const USAGE_MEMBERS: Readonly<{ readonly [M in UsageReason["kind"]]: M }> = {
  "missing-tasks": "missing-tasks",
  "missing-skeleton-target": "missing-skeleton-target",
  "extra-target": "extra-target",
  "missing-plan-or-spec": "missing-plan-or-spec",
  "unknown-task": "unknown-task",
  "dry-run-scope": "dry-run-scope",
  "read-failure": "read-failure",
  "write-failure": "write-failure",
  "base-conflict": "base-conflict",
  "board-unmatched": "board-unmatched",
  "board-unreadable": "board-unreadable",
  "base-absent": "base-absent",
  "no-frame": "no-frame",
};

/** The declared failure values, closed the same way — the translation table's domain. */
const FAILURE_VALUES: Readonly<{ readonly [M in FailureValue["kind"]]: M }> = {
  "read-failure": "read-failure",
  "write-failure": "write-failure",
  "base-conflict": "base-conflict",
  absent: "absent",
  corrupt: "corrupt",
  "missing-target": "missing-target",
  "extra-target": "extra-target",
};

/** The pinned clock — every in-flight row's two instants are the injected clock's. */
const CLOCK = new Clock(() => 1_700_000_000_000);

/** The one word table under test. */
const words = new Words({ clock: CLOCK });

/** The one route face under test. */
const route = new RouteRenderer(words);

/** The render directory — the wording scan's set. */
const RENDER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Every render module (the pin's own directory excluded). */
const renderSources = (): readonly { readonly rel: string; readonly text: string }[] =>
  readdirSync(RENDER_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => ({
      rel: entry.name,
      text: readFileSync(path.join(RENDER_ROOT, entry.name), "utf8"),
    }));

/** One path value on the repo-relative basis (the brand is real: a bare string never reaches
 *  a render face). */
const rel = (value: string): RepoPath => value as unknown as RepoPath;

/** One fix hop over a phase specification — the same value the capsule and the board read. */
const FIX_HOP: NextHop = {
  face: "phase-spec",
  target: { type: "phase-spec", id: "docs/spec.md" },
  hop: "fix",
  to: null,
  reason: "pending-fix",
  route: { kind: "fix", reviews: rel(".kairos/cdd/p9/spec-review-1.c1.json") },
};

/** One round, as a line's token reads it. */
const round = (over: Partial<BoardRound> = {}): BoardRound => ({
  op: "implement",
  cycle: 1,
  attempt: 1,
  passed: true,
  findings: 0,
  notes: [],
  ...over,
});

/** One document row — the document's header cells plus the line's rounds. */
const docRow = (
  line: string,
  over: {
    readonly doc?: BoardDoc | null;
    readonly rounds?: readonly BoardRound[];
  } = {},
): BoardRow => ({
  kind: "doc",
  line,
  doc:
    over.doc === undefined
      ? { name: `${line}.md`, version: "v1.0", status: "Draft", title: null }
      : over.doc,
  rounds: over.rounds ?? [],
});

/** One wave row — the frontier cell the marker reads, the closure cell and the line's
 *  rounds. */
const waveRow = (
  tasks: readonly number[],
  frontier = false,
  closed = false,
  rounds: readonly BoardRound[] = [],
): BoardRow => ({
  kind: "wave",
  line: `tasks-${tasks.join(",")}`,
  tasks,
  frontier,
  closed,
  rounds,
});

/** The branch row. */
const branchRow = (
  state: "closed" | "reopened" | "open" = "open",
  rounds: readonly BoardRound[] = [],
): BoardRow => ({ kind: "branch", state, rounds });

/** The tree's empty fact block. */
const NO_FACTS: BoardFacts = { orphans: [], crashed: [], refusal: { kind: "absent" } };

/** One board value — the shape the round layer hands a board. */
const boardValue = (over: Partial<BoardValue> = {}): BoardValue => ({
  slug: "p9",
  rows: [
    { kind: "in-flight", state: { kind: "absent" } },
    { kind: "next", hop: FIX_HOP },
    docRow("plan"),
  ],
  facts: NO_FACTS,
  observed: [],
  ...over,
});

/** One artifact observation. */
const observation = (read: ArtifactRead): ArtifactObservation => ({
  line: "phase-spec",
  kind: "rulings",
  cycle: 1,
  attempt: 1,
  carrier: rel(".kairos/cdd/p9/phase-spec-review-1.c1.json"),
  read,
});

/** One standing refusal's facts. */
const refusalFacts = (): RefusalFacts => ({
  at: "2026-01-01T00:00:00.000Z",
  slug: "p9",
  op: "implement",
  type: "wave",
  cycle: 1,
  attempt: 1,
  station: "graph",
  detail: "task 1 depends on a task the plan does not declare",
});

/** One in-flight record. */
const holder = (): InFlightRecord => ({
  pid: 42,
  command: "cdd implement --tasks 1 --plan p9.md",
  slug: "p9",
  startedAt: 1_699_999_700_000,
  wave: "1",
  phase: "implement",
  cycle: 1,
  attempt: 1,
  plan: "docs/kairos/plans/p9.md",
  dispatchBase: null,
});

/** One wave board's tree. */
const tree = (): GraphTree => ({
  plan: "docs/kairos/plans/p9.md",
  waves: [[1, 2], [3]],
  done: new Set([1]),
});

/** A passing preview's frame facts. */
const passFrame = (): Parameters<Preview["passBlock"]>[0]["frame"] =>
  ({
    kind: "frame",
    command: "implement",
    recover: false,
    type: "wave",
    slug: "p9",
    key: "tasks-1",
    doc: null,
    planPath: "docs/kairos/plans/p9.md",
    planText: null,
    graph: null,
    emptyFileTasks: new Set(),
    tasks: [1],
    target: { type: "wave", id: "1", plan: "docs/kairos/plans/p9.md" },
    program: null,
    overall: null,
    identity: { type: "wave", doc: null, plan: null },
    pipeline: { specType: null, specPath: null, planPath: null, graph: null },
    workspace: { dir: "p9", id: "p9" },
    phase: "implement",
    round: 1,
    attempt: 1,
  }) as unknown as Parameters<Preview["passBlock"]>[0]["frame"];

describe("the prompt bands", () => {
  it("declares one row per work mode and one per declared target type", () => {
    const renderer = new PromptBandsRenderer();
    expect(Object.keys(TEMPLATE_PROMPT.modes).sort()).toEqual([...WORK_MODES].sort());
    expect(renderer.reviewTypes().slice().sort()).toEqual([...TARGET_TYPE_VALUES].sort());
    expect(Object.keys(REVIEW_VARIANTS).length).toBe(TARGET_TYPE_VALUES.length);
  });

  it("renders a band as the version line, the declared row and the shared return zone", () => {
    const renderer = new PromptBandsRenderer();
    const band = renderer.prompt("implement");
    expect(band.split("\n")[0]).toBe(`$version ${TEMPLATE_PROMPT.$version}`);
    expect(band).toContain(TEMPLATE_PROMPT.modes.implement.shell[0] ?? "");
    expect(band).toContain(TEMPLATE_PROMPT.return.RETURN_PROSE[0] ?? "");
    expect(renderer.prompt("implement")).toBe(band);
  });
});

describe("the capsule", () => {
  const capsule = new Capsule(words, route);

  it("prints the success status line with its handoff cell", () => {
    expect(
      capsule.emit({ status: "APPROVED", handoff: ".kairos/cdd/p9/tasks-1-implement-1.json" }),
    ).toEqual(["status: APPROVED · handoff: .kairos/cdd/p9/tasks-1-implement-1.json"]);
  });

  it("keeps the failure status alone unless the round wrote a crash record", () => {
    expect(capsule.emit({ status: "BLOCKED", handoff: ".kairos/cdd/p9/crash.json" })).toEqual([
      "status: BLOCKED",
    ]);
    expect(
      capsule.emit({ status: "BLOCKED", handoff: ".kairos/cdd/p9/crash.json", crashRecord: true }),
    ).toEqual(["status: BLOCKED · handoff: .kairos/cdd/p9/crash.json"]);
  });

  it("prints the summary row between the status line and the route rows", () => {
    const rows = capsule.emit({
      status: "CHANGES_REQUESTED",
      handoff: "h.json",
      summary: words.dispositionsSummary(3, 1),
      hop: FIX_HOP,
    });
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatch(/^status: /);
    expect(rows[1]).toBe("fixed 3 · rejected 1");
    expect(rows[2]).toMatch(/^next: /);
    expect(rows[3]).toBe("reason: pending-fix");
  });

  it("drops only the summary ROW when the fact is absent — the slot order stands", () => {
    const rows = capsule.emit({ status: "CHANGES_REQUESTED", handoff: "h.json", hop: FIX_HOP });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^status: /);
    expect(rows[1]).toMatch(/^next: /);
    expect(rows[2]).toBe("reason: pending-fix");
    expect(capsule.emit({ status: "BLOCKED", handoff: "" })).toHaveLength(1);
  });

  it("renders the fix summary from the injected counts and the judge note from its one composer", () => {
    const fix = capsule.emit({
      status: "REVIEW_FIX",
      handoff: "h.json",
      summary: words.dispositionsSummary(2, 0),
    });
    expect(fix[1]).toBe("fixed 2 · rejected 0");
    expect(words.dispositionsSummary(5, 3)).toBe("fixed 5 · rejected 3");
    const note = regradeNote(1, ["the guard is second-order"]) ?? "";
    expect(capsule.emit({ status: "CHANGES_REQUESTED", handoff: "h.json", summary: note })[1]).toBe(
      note,
    );
  });
});

describe("the route face — one assembly point", () => {
  it("renders one hop into the capsule and the board with identical value bytes", () => {
    const capsuleRows = route.capsuleRows(FIX_HOP);
    const boardRows = route.boardRows(FIX_HOP);
    const value = route.nextValue(FIX_HOP) ?? "";
    expect(value).not.toBe("");
    expect(capsuleRows[0]).toBe(`next: ${value}`);
    expect(boardRows[0]).toBe(`  next:    ${value}`);
    expect(capsuleRows[1]).toBe(`reason: ${FIX_HOP.reason}`);
    expect(boardRows[1]).toBe(`  reason:  ${FIX_HOP.reason}`);
    // A different hop moves BOTH faces: the pair is read off one render, never stored.
    const other: NextHop = { ...FIX_HOP, target: { type: "phase-spec", id: "docs/other.md" } };
    expect(route.nextValue(other)).not.toBe(value);
    expect(route.capsuleRows(other)[0]).toBe(`next: ${route.nextValue(other)}`);
    expect(route.boardRows(other)[0]).toBe(`  next:    ${route.nextValue(other)}`);
  });

  it("appends the fix readback sentence only when the hop consumed a rulings sidecar", () => {
    const rulings = rel(".kairos/cdd/p9/spec-review-1.c1.rulings.json");
    const bare = route.nextValue(FIX_HOP) ?? "";
    // A hop with no sidecar ends at its `--reviews` path: the sentence is omitted whole.
    expect(bare.endsWith(".c1.json")).toBe(true);
    const withRulings: NextHop = {
      ...FIX_HOP,
      route: { kind: "fix", reviews: rel(".kairos/cdd/p9/spec-review-1.c1.json"), rulings },
    };
    const value = route.nextValue(withRulings) ?? "";
    // One value: the literal, then the declared sentence with the route's own path in it.
    expect(value).toBe(`${bare} ${words.fixReadbackWord(rulings)}`);
    expect(value.endsWith(`record it at ${rulings})`)).toBe(true);
    // Both faces of the one hop carry it, and the sentence is not a second assembly.
    expect(route.capsuleRows(withRulings)[0]).toBe(`next: ${value}`);
    expect(route.boardRows(withRulings)[0]).toBe(`  next:    ${value}`);
  });

  it("prints the board's `(none)` degradation with no reason row", () => {
    expect(route.boardRows(null)).toEqual(["  next:    (none)"]);
    expect(route.capsuleRows(null)).toEqual([]);
  });

  it("renders the checked block from the row set it is handed", () => {
    const checked: readonly CheckedRow[] = [
      { row: "tree-clean", reading: { kind: "ran" } },
      { row: "in-flight", reading: { kind: "in-flight", state: "free" } },
      { row: "plan-ledger", reading: { kind: "plan-ledger", ahead: 2 } },
      { row: "presence", reading: { kind: "skipped", reason: "no-doc-target" } },
      { row: "domain", reading: { kind: "rule", result: "passed", count: 0 } },
      { row: "link", reading: { kind: "rule", result: "warned", count: 2 } },
    ];
    expect(route.checkedBlock(checked)).toEqual([
      "checked:",
      "  tree-clean",
      "  in-flight: free — no dispatch holds this tree",
      "  plan-ledger: info (plan leads ledger by 2 tasks)",
      "  presence: skipped (no doc target)",
      "  domain: passed",
      "  link: warned — 2 warning(s)",
    ]);
  });

  it("renders the split cause's detail as the wave board and nothing for the other causes", () => {
    const split: WaveVerdict = { ok: false, reason: "split", open: [1, 2], phases: [] };
    const graph = new GraphView(words);
    const details = route.refusalDetails(split, tree());
    expect(details).toEqual(
      graph
        .render(tree())
        .split("\n")
        .map((line) => `  ${line}`),
    );
    expect(details.join("\n")).toContain("graph: docs/kairos/plans/p9.md");
    expect(details.join("\n")).toContain("wave board:");
    expect(details.join("\n")).toContain("progress:");
    const wrongPhase: WaveVerdict = { ok: false, reason: "wrong-phase", open: [1], phases: [] };
    expect(route.refusalDetails(wrongPhase, tree())).toEqual([]);
  });

  it("renders one refusal body for the structure leg and one line for the task leg", () => {
    const verdict: PreFlightVerdict = {
      ok: false,
      gate: "tree-clean",
      reason: "dirty-tree",
      order: [],
      checked: [],
    };
    expect(route.refusalBody(verdict)).toBe(`tree-clean · ${words.refusalReason("dirty-tree")}`);
    const line: WaveVerdict = { ok: false, reason: "split", open: [1], phases: [] };
    expect(route.lineRefusalText("implement", "implement", line, FIX_HOP)).toBe(
      `cdd implement: cannot dispatch a implement round — split · next: ${route.nextValue(FIX_HOP)}`,
    );
    expect(route.lineRefusalText("implement", "implement", line)).toBe(
      "cdd implement: cannot dispatch a implement round — split",
    );
    // A held refusal never prints a template slot: the caller's filled report when it has
    // one, the checked face's closed row otherwise.
    const held: PreFlightVerdict = {
      ok: false,
      gate: "in-flight",
      reason: "held",
      holding: { kind: "held", pid: 77, alive: true, targetGone: [] },
      order: [],
      checked: [],
    };
    const closed = route.refusalBody(held);
    expect(closed).toBe(`in-flight · ${words.checkedWords().inFlight.held.replace("{pid}", "77")}`);
    expect(closed).not.toContain("{");
    expect(route.refusalBody(held, "a dispatch is in flight — the filled report")).toBe(
      "in-flight · a dispatch is in flight — the filled report",
    );
    const graph: PreFlightVerdict = {
      ok: false,
      gate: "graph",
      reason: "graph",
      order: [],
      checked: [],
    };
    expect(route.refusalBody(graph, "3")).toBe(
      `graph · ${words.refusalReason("graph").replace("{count}", "3")}`,
    );
  });

  it("renders the wave board's three sections with the table's markers and legend", () => {
    const board = new GraphView(words).render(tree());
    expect(board.split("\n")[0]).toBe("graph: docs/kairos/plans/p9.md");
    expect(board).toContain("wave board:");
    expect(board).toContain(
      `  W1  T1${words.boardWords().progress.markers.done} · T2${words.boardWords().progress.markers.current}`,
    );
    // The current wave's row carries its OWN annotation word — the legend's scope word is
    // the two boards' difference and never rides this cell.
    const currentRow = board.split("\n").find((row) => row.startsWith("  W1  ")) ?? "";
    expect(currentRow.endsWith(`   ← ${words.currentWaveAnnotation()}`)).toBe(true);
    expect(currentRow).not.toContain(words.boardWords().progress.scopes.graph);
    expect(board.endsWith(words.legendTail("graph"))).toBe(true);
    expect(new GraphView(words).render(tree())).toBe(board);
  });
});

describe("the board", () => {
  const board = new BoardView(words, route);

  it("prints the note count folded by default and the bodies under --notes", () => {
    const notes = ["the guard is missing", "the guard is missing twice"];
    const value = boardValue({
      rows: [
        { kind: "in-flight", state: { kind: "absent" } },
        waveRow([1], false, true, [round({ op: "review", notes })]),
      ],
    });
    const folded = board.render(value).join("\n");
    expect(folded).toContain("notes +2");
    expect(folded).not.toContain("the guard is missing");
    const expanded = board.render(value, { notes: true, artifacts: false }).join("\n");
    expect(expanded).toContain("notes +2; the guard is missing; the guard is missing twice");
    // The count cell does not move with the switch: only what follows it does.
    const counted = (text: string): string =>
      text.slice(0, text.indexOf("notes +2") + "notes +2".length);
    expect(counted(expanded)).toBe(counted(folded));
  });

  it("prints one refusal row per state, and none for an absent record", () => {
    const absent = board.render(boardValue());
    expect(absent.join("\n")).not.toContain("refused:");
    const standing: RefusalState = { kind: "standing", facts: refusalFacts() };
    const rows = board.render(boardValue({ facts: { ...NO_FACTS, refusal: standing } }));
    const refused = rows.filter((row) => row.includes("refused:"));
    expect(refused).toHaveLength(1);
    expect(refused[0]).toBe(
      `  ${words.refusalWords().token} implement 1·a1 graph · task 1 depends on a task the plan does not declare`,
    );
    const corrupt = board.render(
      boardValue({ facts: { ...NO_FACTS, refusal: { kind: "corrupt", reason: "bad bytes" } } }),
    );
    expect(corrupt.filter((row) => row.includes("refused:"))).toEqual([
      `  refused: ${words.refusalWords().corrupt}`,
    ]);
    // The observation rows move nothing else: the row set outside the fact block is the same.
    const strip = (text: readonly string[]): readonly string[] =>
      text.filter((row) => !row.includes("refused:") && row.trim() !== "");
    expect(strip(rows)).toEqual(strip(board.render(boardValue())));
  });

  it("prints the orphan and crashed facts between the occupancy row and the document rows", () => {
    const crashed: CrashedRound = {
      op: "implement",
      cycle: 2,
      attempt: 1,
      cause: "no commits",
    };
    const rows = board.render(
      boardValue({
        rows: [docRow("plan")],
        facts: { ...NO_FACTS, orphans: ["draft.json"], crashed: [crashed] },
      }),
    );
    const body = rows.join("\n");
    expect(body).toContain("orphan: draft.json — no recorded round owns it");
    expect(body).toContain("crashed: implement 2·a1 no commits");
    const clean = board.render(boardValue({ rows: [docRow("plan")] })).join("\n");
    expect(clean).not.toContain("orphan:");
    expect(clean).not.toContain("crashed:");
    // The orphan row sits above the crashed row, and both above the document rows.
    const index = (needle: string): number => rows.findIndex((row) => row.includes(needle));
    expect(index("in-flight:")).toBeLessThan(index("orphan:"));
    expect(index("orphan:")).toBeLessThan(index("crashed:"));
    expect(index("crashed:")).toBeLessThan(index("plan"));
    // A fact block carrying MORE than the occupancy row is set off from the document rows by
    // one blank column; the occupancy row alone shares the block with them.
    expect(rows[index("crashed:") + 1]).toBe("");
    const occupancyOnly = board.render(
      boardValue({
        rows: [{ kind: "in-flight", state: { kind: "absent" } }, docRow("plan")],
      }),
    );
    expect(occupancyOnly[2]).toContain("in-flight:");
    expect(occupancyOnly[3]).toContain("plan");
  });

  it("opens the fact block on a standing dispatch — the held and corrupt shapes too", () => {
    // The occupancy is the block's fourth opener: a holder's row is followed by the blank
    // column that separates the facts from the document rows, exactly as an orphan, a
    // crashed round or a refusal opens the block.
    const held = board.render(
      boardValue({
        rows: [
          {
            kind: "in-flight",
            state: { kind: "held", record: holder(), alive: true, targetGone: [] },
          },
          docRow("plan"),
        ],
      }),
    );
    expect(held[2]).toContain("in-flight: pid 42");
    expect(held[3]).toBe("");
    expect(held[4]).toContain("plan");
    // A corrupt record with its lock left behind is the block's other holding shape.
    const corrupt = board.render(
      boardValue({
        rows: [{ kind: "in-flight", state: { kind: "corrupt", locked: true } }, docRow("plan")],
      }),
    );
    expect(corrupt[2]).toContain("in-flight:");
    expect(corrupt[3]).toBe("");
    expect(corrupt[4]).toContain("plan");
  });

  it("prints no artifact row on a tree with no observation, switch or no switch", () => {
    expect(board.render(boardValue())).toEqual(
      board.render(boardValue(), { notes: false, artifacts: true }),
    );
  });

  it("prints the healthy round only under --artifacts, with its coordinate and `ok`", () => {
    const healthy = boardValue({
      rows: [docRow("phase-spec")],
      observed: [
        observation({ kind: "ok", path: rel(".kairos/cdd/p9/rulings.json"), rulings: [] }),
      ],
    });
    expect(board.render(healthy).join("\n")).not.toContain("art:");
    const open = board.render(healthy, { notes: false, artifacts: true }).join("\n");
    expect(open).toContain("art:     phase-spec · rulings · c1·a1   ok");
  });

  it("prints an absent sidecar only under --artifacts", () => {
    const absent = boardValue({
      rows: [docRow("phase-spec")],
      observed: [observation({ kind: "absent" })],
    });
    expect(board.render(absent).join("\n")).not.toContain("art:");
    expect(board.render(absent, { notes: false, artifacts: true }).join("\n")).toContain(
      "art:     phase-spec · rulings · c1·a1   absent",
    );
  });

  it("prints an anomalous round by default, both continuation rows at the frozen bytes", () => {
    const value = boardValue({
      rows: [docRow("phase-spec")],
      observed: [
        observation({
          kind: "misplaced",
          path: rel(".kairos/cdd/p9/phase-spec-review-1.c1.rulings.json"),
          names: [rel(".kairos/cdd/p9/phase-spec-review-1.rulings.json")],
        }),
      ],
    });
    const rows = board.render(value);
    expect(rows).toContain("  art:     phase-spec · rulings   ! misplaced");
    // The block's two continuation rows, byte for byte against §2.2's face 6: the labels are
    // the board's own column (no colon, two spaces) and BOTH cells are repo-relative
    // coordinates — the `found` cell is the arm that once printed the bare workspace name.
    expect(rows).toContain(
      "           derived  .kairos/cdd/p9/phase-spec-review-1.c1.rulings.json",
    );
    expect(rows).toContain("           found    .kairos/cdd/p9/phase-spec-review-1.rulings.json");
  });

  it("lays the program board out as the charter row, its phase rows and the program terminal", () => {
    const phase: BoardPhase = {
      slug: "p9",
      status: "Draft",
      title: "P9 spec",
      wave: "W1",
      cells: [],
    };
    const value = boardValue({
      rows: [
        { kind: "in-flight", state: { kind: "absent" } },
        docRow("overall", {
          doc: { name: "p9-overall.md", version: "v1.0", status: "Approved", title: null },
          rounds: [round({ op: "review" })],
        }),
        docRow("phase-spec"),
      ],
      phases: [phase],
    });
    const rows = board.renderProgram(value);
    const body = rows.join("\n");
    // The charter row is a document row at the charter's altitude — name, header cells and
    // the charter's own round tokens.
    expect(body).toContain(
      `  overall  p9-overall.md   v1.0 · Approved   review 1 ${words.boardWords().tokens.judgement.passed}`,
    );
    // The phase row names its slug, its status, its wave cell and its title.
    expect(body).toContain("  phase p9  Draft   wave W1…   title: P9 spec");
    // No tree fact block, and no `reason:` row: the program's own terminal is the last row.
    expect(body).not.toContain("in-flight:");
    expect(body).toContain("next:    done");
    expect(body).not.toContain("reason:");
    expect(body.endsWith(words.legendTail("board"))).toBe(true);
  });

  it("prints a phase row's cells in the table's declared order and with its declared join", () => {
    // The cells arrive in an order the renderer does NOT follow: the layout is the table's,
    // so `wave` sits between `plan` and `branch` and the join is the row's own ` · `.
    const phase: BoardPhase = {
      slug: "p9",
      status: "Draft",
      title: null,
      wave: "W1",
      cells: [
        { key: "branch", rounds: [round({ op: "review" })] },
        { key: "spec", rounds: [round({ op: "review" })] },
        { key: "plan", rounds: [round({ op: "review", findings: 2 })] },
      ],
    };
    const body = board
      .renderProgram(
        boardValue({
          rows: [
            { kind: "in-flight", state: { kind: "absent" } },
            docRow("overall", {
              doc: { name: "p9-overall.md", version: "v1.0", status: "Approved", title: null },
            }),
            docRow("phase-spec"),
          ],
          phases: [phase],
        }),
      )
      .join("\n");
    const { tokens } = words.boardWords();
    expect(body).toContain(
      `  phase p9  Draft   spec review 1 ${tokens.judgement.passed} · plan review 1 ${tokens.judgement.passed}+2 · wave W1… · branch review 1 ${tokens.judgement.passed}`,
    );
    // The join is the board's cell separator, never the downgrade note's `; `.
    expect(body).not.toContain("; plan");
    // A phase line with no round still prints no cell for that key.
    const bare = board
      .renderProgram(
        boardValue({
          rows: [
            { kind: "in-flight", state: { kind: "absent" } },
            docRow("overall", {
              doc: { name: "p9-overall.md", version: "v1.0", status: "Approved", title: null },
            }),
          ],
          phases: [{ ...phase, wave: null, cells: [{ key: "spec", rounds: [] }] }],
        }),
      )
      .join("\n");
    expect(bare).toContain("  phase p9  Draft\n");
  });

  it("prints the wave segment's one frontier marker, the first-row label and the absence", () => {
    const markers = words.boardWords().progress.markers;
    const two = board.render(
      boardValue({
        rows: [
          { kind: "in-flight", state: { kind: "absent" } },
          waveRow([1], true, false),
          waveRow([2], false, false),
        ],
      }),
    );
    // ONE frontier: the second wave is not current just because it is unstarted.
    expect(two).toContain(`  wave     W1 {1}  ${markers.current}`);
    expect(two).toContain(`           W2 {2}  ${markers.pending}`);
    // The label column prints the `wave` word on the FIRST row only.
    expect(two.filter((row) => row.includes("wave     "))).toHaveLength(1);
    // A closed wave is done whatever its frontier cell says, and the frontier may sit past it.
    const passed = board.render(
      boardValue({
        rows: [
          { kind: "in-flight", state: { kind: "absent" } },
          waveRow([1], false, true),
          waveRow([2], true, false),
        ],
      }),
    );
    expect(passed).toContain(`  wave     W1 {1}  ${markers.done}`);
    expect(passed).toContain(`           W2 {2}  ${markers.current}`);
    // A tree with no wave line prints the absence, never nothing at all.
    const none = board.render(
      boardValue({ rows: [{ kind: "in-flight", state: { kind: "absent" } }] }),
    );
    expect(none).toContain(`  wave     ${words.boardWords().absent}`);
  });

  it("prints a document row as the name, the header cells and the line's round tokens", () => {
    const rows = board.render(
      boardValue({
        rows: [
          { kind: "in-flight", state: { kind: "absent" } },
          { kind: "next", hop: FIX_HOP },
          docRow("overall", {
            doc: { name: "p9-overall.md", version: "v1.0", status: "Approved", title: null },
          }),
          docRow("phase-spec", {
            doc: { name: "p9-design.md", version: "v1.0", status: "Draft", title: null },
            rounds: [round({ op: "review", findings: 1 })],
          }),
          docRow("plan", {
            doc: { name: "p9.md", version: "v1.0", status: null, title: null },
            rounds: [round({ op: "review" })],
          }),
          waveRow([1], false, true, [round(), round({ op: "review", notes: ["a note"] })]),
          branchRow("open"),
        ],
      }),
    );
    // The name column is the widest name, so the version column aligns down the block; a
    // phase specification is the `spec` line, never its `--type` spelling.
    expect(rows).toContain("  overall  p9-overall.md   v1.0 · Approved");
    expect(rows).toContain("  spec     p9-design.md    v1.0 · Draft   review 1 ✓+1");
    expect(rows).toContain("  plan     p9.md           v1.0   review 1 ✓");
    expect(rows).toContain("  wave     W1 {1}  ✔  implement 1 ✓ · review 1 ✓ notes +1");
    expect(rows).toContain("  branch   ○ open");
  });

  it("merges a verb's successes into one token and expands each failed attempt", () => {
    const rows = board.render(
      boardValue({
        rows: [
          waveRow([1], true, false, [
            round(),
            round({ cycle: 2, passed: false }),
            round({ cycle: 2, attempt: 2 }),
          ]),
        ],
      }),
    );
    // The success face is the `{succeeded}/{attempts}` ratio once the verb has a failure, and
    // the failure token names its own cycle — the recovered edge marks the same cycle's next
    // attempt, and the merged token carries no superscript.
    expect(rows.join("\n")).toContain("implement 2/3 ✓ · implement 2 ✗→✓");
    const failed = board.render(
      boardValue({
        rows: [waveRow([1], false, true, [round(), round({ cycle: 2, passed: false })])],
      }),
    );
    expect(failed.join("\n")).toContain("implement 1/2 ✓ · implement 2 ✗");
  });

  it("hands the regrade note through untouched — no composition at a render site", () => {
    const note = regradeNote(1, ["a second-order guard"]) ?? "";
    const value = boardValue({
      rows: [waveRow([1], false, true, [round({ op: "review", regrade: note })])],
    });
    expect(board.render(value, { notes: true, artifacts: false }).join("\n")).toContain(note);
    expect(FOLDED_BOARD).toEqual({ notes: false, artifacts: false });
  });

  it("places the note after the findings count and before the note count, and folds its reason", () => {
    const { tokens } = words.boardWords();
    const rowOf = (regrade: string | undefined): string =>
      board
        .render(
          boardValue({
            rows: [
              waveRow([1], false, false, [
                round({
                  op: "review",
                  findings: 2,
                  notes: ["a note"],
                  ...(regrade === undefined ? {} : { regrade }),
                }),
              ]),
            ],
          }),
        )
        .join("\n");
    // No downgrade: the segment is ZERO bytes, so the count and the note count sit adjacent.
    expect(rowOf(undefined)).toContain(`review 1 ✓+2 ${tokens.notes} +1`);
    // An owing round: the mark rides between `+N` and ` notes +M`.
    const mark = regradeNote(1, []) ?? "";
    expect(rowOf(mark)).toContain(`review 1 ✓+2 ${mark} ${tokens.notes} +1`);
    // A stated reason: the FOLDED sentence replaces nothing and splits nothing.
    const stated = regradeNote(1, ["the guard is\nsecond-order"]) ?? "";
    expect(stated).not.toContain("\n");
    expect(rowOf(stated)).toContain(`review 1 ✓+2 ${stated} ${tokens.notes} +1`);
  });
});

describe("the brief", () => {
  const brief = new BriefRenderer();

  /** A two-task `####`-shape plan with a `## Constraints` section — the projection and the
   *  mirror's shared input. Document order is 1 then 2, so a pin can request `[2, 1]` and see
   *  whose order the brief follows. */
  const PLAN = [
    "---",
    "title: A plan",
    "doc-type: plan",
    "version: v1.0",
    "---",
    "",
    "## Constraints",
    "",
    "- keep the engine single-authored",
    "",
    "### Task 1: the first",
    "",
    "#### Objective",
    "do the first thing",
    "",
    "#### Steps",
    "- touch a file — checkable: the file exists",
    "",
    "### Task 2: the second",
    "",
    "#### Objective",
    "do the second thing",
    "",
    "#### Steps",
    "- touch the other file — checkable: the file exists",
    "",
  ].join("\n");

  /** The plan's ONE parse, as the caller hands it over — the short renderer owns no parser. */
  const blocksOf = () => BriefRenderer.blocksOf(PLAN);

  it("projects the same plan to the same bytes twice — no render state rides the reviewed version", () => {
    const first = brief.taskBody(PLAN, blocksOf(), [1]);
    expect(brief.taskBody(PLAN, blocksOf(), [1])).toBe(first);
    const pair = brief.taskBody(PLAN, blocksOf(), [1, 2]);
    expect(brief.taskBody(PLAN, blocksOf(), [1, 2])).toBe(pair);
  });

  it("opens the projection on the first requested `### Task …` heading — zero preamble", () => {
    const body = brief.taskBody(PLAN, blocksOf(), [1]);
    expect(body.split("\n")[0]).toBe("### Task 1: the first");
    expect(body).not.toMatch(/^---/);
    expect(body).not.toContain("## Constraints");
  });

  it("slices a block's `####` children whole — the boundary is the next rank-3 heading", () => {
    const body = brief.taskBody(PLAN, blocksOf(), [1]);
    expect(body).toContain("#### Objective\ndo the first thing");
    expect(body).toContain("#### Steps\n- touch a file — checkable: the file exists");
    expect(body).not.toContain("### Task 2");
  });

  it("appends the `## Constraints` mirror and then the notes tail, each verbatim", () => {
    const body = brief.taskBody(PLAN, blocksOf(), [1]);
    const bytes = brief.render(PLAN, blocksOf(), [1], ["the round left one note"]);
    expect(bytes.startsWith(`${body}\n\n## Constraints`)).toBe(true);
    expect(bytes).toContain("- keep the engine single-authored");
    expect(bytes.endsWith("\n## Notes\nthe round left one note\n")).toBe(true);
    // No notes: the file closes on the mirror instead of an empty heading.
    const bare = brief.render(PLAN, blocksOf(), [1]);
    expect(bare.endsWith("## Constraints\n\n- keep the engine single-authored\n")).toBe(true);
    expect(bare).not.toContain("## Notes");
  });

  it("keeps the CALLER's order — a reversed request is not re-sorted into document order", () => {
    const reversed = brief.taskBody(PLAN, blocksOf(), [2, 1]);
    expect(reversed.split("\n")[0]).toBe("### Task 2: the second");
    expect(reversed.indexOf("### Task 2")).toBeLessThan(reversed.indexOf("### Task 1"));
    // The unreversed request answers the other order: the INPUT moved it, not the plan.
    const ordered = brief.taskBody(PLAN, blocksOf(), [1, 2]);
    expect(ordered.indexOf("### Task 1")).toBeLessThan(ordered.indexOf("### Task 2"));
  });

  it("blocks both products when a requested task is absent — one refusal, two consumers", () => {
    expect(() => brief.taskBody(PLAN, blocksOf(), [1, 5])).toThrow(/task 5 not found/);
    expect(() => brief.render(PLAN, blocksOf(), [1, 5])).toThrow(/task 5 not found/);
  });
});

describe("the preview", () => {
  const preview = new Preview(words, route);

  it("renders the pass block as the header plus five rows, with no route and no checked face", () => {
    const rows = preview.passBlock({ frame: passFrame(), host: "pi", brief: "tasks-1-brief.md" });
    expect(rows[0]).toBe("cdd implement: preview (no repo changes)");
    const labels = rows.slice(1).map((row) => row.trim().split(":")[0]);
    expect(labels).toEqual(["step", "reads", "would write", "would record", "child"]);
    expect(rows.join("\n")).not.toContain("next:");
    expect(rows.join("\n")).not.toContain("checked:");
    expect(rows.join("\n")).toContain("pi -p --mode text");
    expect(rows.join("\n")).toContain("would re-render from the current plan");
  });

  it("appends the orphan drafts to the reads row, and zero bytes when there are none", () => {
    const bare = preview.passBlock({ frame: passFrame(), host: "", brief: "b.md" });
    expect(bare[2]).not.toContain("orphan drafts");
    const withOrphans = preview.passBlock({
      frame: passFrame(),
      host: "",
      brief: "b.md",
      orphans: ["a.json", "b.json"],
    });
    expect(withOrphans[2]?.endsWith(" · orphan drafts: a.json · b.json")).toBe(true);
    expect(withOrphans[0]).toBe(bare[0]);
  });

  it("renders the held block's three lock facts and the dead holder's hint", () => {
    const free = preview.heldBlock("implement", { kind: "absent" }, []);
    expect(free[1]).toBe(`  lock: ${words.inFlightWords().free}`);
    expect(free[2]).toBe("checked:");
    const held = preview.heldBlock(
      "implement",
      { kind: "held", record: holder(), alive: true, targetGone: [] },
      [],
    );
    expect(held[1]).toBe(`  lock: ${words.inFlightLock(holder())}`);
    expect(held).toHaveLength(3);
    const dead = preview.heldBlock(
      "implement",
      { kind: "held", record: holder(), alive: false, targetGone: [] },
      [],
    );
    expect(dead[2]).toBe(words.inFlightWords().stealable);
    const gone = preview.heldBlock(
      "implement",
      { kind: "held", record: holder(), alive: false, targetGone: ["plan"] },
      [],
    );
    expect(gone[2]).toBe(words.inFlightTargetGone(["plan"]));
  });

  it("appends the corrupt-lock sentence after the lock row when the lock is still on disk", () => {
    const rows = preview.heldBlock("implement", { kind: "corrupt", locked: true }, []);
    expect(rows.slice(0, 3)).toEqual([
      "cdd implement: preview (no repo changes)",
      `  lock: ${words.inFlightWords().lockOnly}`,
      words.inFlightWords().corruptLocked,
    ]);
    expect(rows.at(-1)).toBe("checked:");
    expect(preview.heldBlock("implement", { kind: "corrupt", locked: false }, [])).toHaveLength(3);
  });

  it("renders the blocked block from the route face's body and details, checked at the tail", () => {
    const verdict: PreFlightVerdict = {
      ok: false,
      gate: "doc-contract",
      reason: "doc-contract",
      details: ["presence@title: the title is missing"],
      order: [],
      checked: [{ row: "tree-clean", reading: { kind: "ran" } }],
    };
    const rows = preview.blockedBlock(
      "review",
      route.refusalBody(verdict),
      route.refusalDetails(verdict),
      verdict.checked,
    );
    expect(rows[0]).toBe("cdd review: preview (no repo changes)");
    expect(rows[1]).toBe(`  ${words.refusalWords().token}  ${route.refusalBody(verdict)}`);
    expect(rows[2]).toBe("  presence@title: the title is missing");
    expect(rows.slice(3)).toEqual(route.checkedBlock(verdict.checked));
  });

  it("carries the same checked bytes a real dispatch prints, at the tail of both refusal blocks", () => {
    const checked: readonly CheckedRow[] = [{ row: "tree-clean", reading: { kind: "ran" } }];
    const block = route.checkedBlock(checked);
    expect(
      preview.heldBlock("implement", { kind: "absent" }, checked).slice(-block.length),
    ).toEqual(block);
    expect(preview.blockedBlock("implement", "body", [], checked).slice(-block.length)).toEqual(
      block,
    );
  });
});

describe("the issue body and its contract", () => {
  const issue = new IssueBodyRenderer(words);

  /** One legal payload — the smallest shape the contract accepts. */
  const payload = (): Record<string, unknown> => ({
    harness: "claude",
    findings: [
      {
        type: "bug",
        lang: "en",
        context: "context",
        problem: "problem",
        impact: "impact",
        suggestedFix: "fix",
        meta: { skill: "cdd-dev", step: "implement" },
      },
    ],
    related: {
      open: [{ issue: 1, component: "cdd-engine", reason: "same cell" }],
      closed: [{ issue: 9 }],
      program: { issue: 2 },
    },
  });

  it("renders a legal payload on stdout with exit 0", () => {
    const report = issue.report(JSON.stringify(payload()));
    expect(report.stream).toBe("stdout");
    expect(report.exitCode).toBe(0);
    expect(report.text).toBe(
      [
        "# CDD aggregate issue",
        "",
        "- Harness: claude",
        "",
        "## Context",
        "",
        "context",
        "",
        "## Problem",
        "",
        "problem",
        "",
        "## Impact",
        "",
        "impact",
        "",
        "## Suggested fix",
        "",
        "fix",
        "",
        "- Skill: cdd-dev",
        "- Step: implement",
        "",
        "## Dedup",
        "- Dedup → #1 (open)：cdd-engine · same cell",
        "",
        "## Related",
        "- Regression / follow-up of #9 (closed)",
        "- Program: #2",
        "",
      ].join("\n"),
    );
  });

  it("accepts an extra key — the contract reads the fields, it is not a closed object", () => {
    const withExtra = { ...payload(), unmodelled: { anything: true } };
    expect(issue.report(JSON.stringify(withExtra)).exitCode).toBe(0);
  });

  it("refuses malformed JSON on ONE line, exit 1", () => {
    const report = issue.report("{ not json");
    expect(report.stream).toBe("stderr");
    expect(report.exitCode).toBe(1);
    expect(report.text.split("\n").filter((line) => line !== "")).toHaveLength(1);
    expect(report.text.startsWith("cdd issue render: invalid input JSON — ")).toBe(true);
  });

  it("refuses missing keys and type errors as one indented line per violation, exit 1", () => {
    const { harness: _harness, findings: _findings, ...rest } = payload();
    const report = issue.report(JSON.stringify({ ...rest, findings: [{ type: "bug" }] }));
    expect(report.exitCode).toBe(1);
    const lines = report.text.split("\n");
    expect(lines[0]).toBe("cdd issue render: invalid input:");
    expect(lines[1]?.startsWith("  harness: ")).toBe(true);
    expect(report.text).toContain("  findings[0].lang: ");
    expect(report.text).toContain("  findings[0].meta: ");
    expect(report.text).not.toContain("invalid input JSON");
  });

  it("refuses a malformed related tail with its field path", () => {
    const report = issue.report(JSON.stringify({ ...payload(), related: { open: "nope" } }));
    expect(report.exitCode).toBe(1);
    expect(report.text).toContain("related.open: array of open hits expected");
  });

  it("derives the type and language vocabularies from one declaration", () => {
    expect(issue.types).toEqual(words.issueTypes());
    expect(issue.langs()).toContain("en");
  });
});

describe("the init face's four exits", () => {
  const renderer = new InitRenderer();
  const steps: readonly ProvisionStep[] = [
    { packageName: "superpowers", tier: "core", argv: ["claude", "plugin", "install", "a"] },
    { packageName: "kairos", tier: "core", argv: ["pi", "plugin", "install", "b"] },
  ];
  const facts = (): InitFacts => ({ host: "claude", shape: "install", recommended: false, steps });

  it("sends the preview block and the green summary to stdout", () => {
    const preview = renderer.preview(facts());
    expect(preview.every((line) => line.stream === "stdout")).toBe(true);
    expect(preview.map((line) => line.text)).toEqual([
      "would run: claude plugin install a",
      "would run: pi plugin install b",
      "init: 2 steps (claude · install) — dry run, nothing executed",
    ]);
    const green = renderer.green(facts());
    expect(green.every((line) => line.stream === "stdout")).toBe(true);
    expect(green[0]?.text).toBe("init: 2 steps ok (claude · install)");
  });

  it("renders one progress line per step, before that step's spawn", () => {
    expect(renderer.progress(facts(), 0).text).toBe(
      "init[1/2] claude · superpowers · plugin install a",
    );
    expect(renderer.progress(facts(), 1).stream).toBe("stdout");
  });

  it("sends the first-failure report's lines to stderr with the code it was handed", () => {
    const lines = renderer.failure(facts(), 1, 3);
    expect(lines.every((line) => line.stream === "stderr")).toBe(true);
    expect(lines[0]?.text).toBe("init[2/2] · pi plugin install b · exit 3");
    expect(renderer.failure(facts(), 1, 9)[0]?.text).toContain("exit 9");
    expect(lines).toHaveLength(1);
    const update = renderer.failure({ ...facts(), shape: "update" }, 0, 1);
    expect(update).toHaveLength(2);
    expect(update[1]?.text).toContain("without --update first");
  });

  it("renders one step line per step on both exits, differing only in the step and summary forms", () => {
    const preview = renderer.preview(facts()).map((line) => line.text);
    const progress = steps.map((_step, index) => renderer.progress(facts(), index).text);
    expect(preview.slice(0, steps.length)).toHaveLength(progress.length);
    for (const [index, line] of preview.slice(0, steps.length).entries()) {
      expect(line.startsWith("would run: ")).toBe(true);
      expect(progress[index]?.startsWith(`init[${index + 1}/2] `)).toBe(true);
      expect(line).not.toBe(progress[index]);
    }
    // The summary lines are the one other difference: the preview closes dry, the run closes ok.
    expect(preview.at(-1)).not.toBe(renderer.green(facts()).at(0)?.text);
  });

  it("renders the empty-tier info row identically on the preview and the green exit", () => {
    const recommended: InitFacts = { ...facts(), recommended: true, steps: [] };
    const preview = renderer.preview(recommended).map((line) => line.text);
    const green = renderer.green(recommended).map((line) => line.text);
    expect(preview.at(-1)).toBe("init: no recommended packages for claude");
    expect(green.at(-1)).toBe(preview.at(-1));
    expect(preview).toHaveLength(2);
    expect(green).toHaveLength(2);
  });
});

describe("the usage face", () => {
  /** One recorded usage-line call. */
  const recorded: string[] = [];
  const face = new UsageFace({
    words,
    usageLine: (commandPath) => {
      recorded.push(commandPath);
      return `Usage: cdd ${commandPath} [options]`;
    },
  });

  it("declares one row per union member, with a resolvable producer on every row", () => {
    // The member set is the union's own projection, so this compares the TABLE against the
    // members it serves — never the table against a hand-written subset of itself.
    expect(Object.keys(USAGE_BYTES).sort()).toEqual(Object.keys(USAGE_MEMBERS).sort());
    for (const member of Object.values(USAGE_MEMBERS)) {
      expect(USAGE_BYTES[member], member).toBeDefined();
      const row = USAGE_BYTES[member];
      const [module, symbol] = row.producer.split("#");
      expect(module?.length ?? 0).toBeGreaterThan(0);
      expect(symbol?.length ?? 0).toBeGreaterThan(0);
    }
    expect(Object.keys(FAILURE_REASONS).sort()).toEqual(Object.keys(FAILURE_VALUES).sort());
    for (const value of Object.values(FAILURE_VALUES)) {
      expect(FAILURE_REASONS[value], value).toBeInstanceOf(Function);
    }
  });

  it("prints the usage-shaped family as the injected line plus one error row", () => {
    const members: Record<string, unknown> = {
      "missing-tasks": { kind: "missing-tasks" },
      "missing-skeleton-target": { kind: "missing-skeleton-target" },
      "extra-target": { kind: "extra-target", target: "x.md" },
      "missing-plan-or-spec": { kind: "missing-plan-or-spec" },
      "unknown-task": { kind: "unknown-task", command: "implement", task: 7 },
      "dry-run-scope": { kind: "dry-run-scope", command: "board" },
      "read-failure": { kind: "read-failure", target: "docs/a.md" },
      "write-failure": { kind: "write-failure", target: "docs/b.md" },
      "base-conflict": { kind: "base-conflict", existing: "develop" },
    };
    for (const [name, reason] of Object.entries(members)) {
      recorded.length = 0;
      const report = face.report({ kind: "usage", reason: reason as never }, "implement");
      expect(report.exitCode, name).toBe(2);
      expect(report.stream, name).toBe("stderr");
      const lines = report.text.split("\n").filter((line) => line !== "");
      expect(lines).toHaveLength(2);
      expect(lines[0], name).toBe("Usage: cdd implement [options]");
      expect(lines[1], name).toMatch(/^error: /);
      expect(recorded, name).toEqual(["implement"]);
    }
    expect(
      face.report(
        { kind: "usage", reason: { kind: "base-conflict", existing: "develop" } },
        "base set",
      ).text,
    ).toContain("error: cdd base set: base already set to develop — pass --force to override");
    expect(
      face.report(
        { kind: "usage", reason: { kind: "read-failure", target: "docs/a.md" } },
        "review",
      ).text,
    ).toContain("error: cannot read file: docs/a.md");
  });

  it("prints the single-line family with no usage line and no error prefix", () => {
    const misses = [
      { flag: "--plan", target: "docs/a.md" },
      { flag: "--spec", target: "docs/b.md" },
    ];
    recorded.length = 0;
    const unmatched = face.report(
      { kind: "usage", reason: { kind: "board-unmatched", misses } },
      "board",
    );
    expect(unmatched.text).toBe("cdd board: no docs match --plan docs/a.md and --spec docs/b.md\n");
    const unreadable = face.report(
      { kind: "usage", reason: { kind: "board-unreadable", flag: "--plan", target: "docs/a.md" } },
      "board",
    );
    expect(unreadable.text).toBe("cdd board: cannot read --plan docs/a.md\n");
    expect(unreadable.exitCode).toBe(2);
    const absent = face.report(
      { kind: "usage", reason: { kind: "base-absent", target: ".kairos/cdd/p9/base.json" } },
      "base get",
    );
    expect(absent.text).toBe(
      "cdd base get: missing or corrupt base artifact at .kairos/cdd/p9/base.json\n",
    );
    const noFrame = face.report(
      { kind: "usage", reason: { kind: "no-frame", command: "review" } },
      "review",
    );
    expect(noFrame.text).toBe("cdd review: nothing to dispatch — the line holds no open frame\n");
    expect(noFrame.exitCode).toBe(1);
    expect(recorded).toEqual([]);
  });

  it("translates every declared failure value into the one member that prints its bytes", () => {
    const values: readonly (readonly [FailureValue, string])[] = [
      [{ kind: "read-failure", target: "a.md" }, "read-failure"],
      [{ kind: "write-failure", target: "b.md" }, "write-failure"],
      [{ kind: "base-conflict", existing: "develop" }, "base-conflict"],
      [{ kind: "absent", target: "base.json" }, "base-absent"],
      [{ kind: "corrupt", target: "base.json" }, "base-absent"],
      [{ kind: "missing-target" }, "missing-skeleton-target"],
      [{ kind: "extra-target", target: "x.md" }, "extra-target"],
    ];
    for (const [value, member] of values) {
      expect(UsageFace.translate(value).kind, value.kind).toBe(member);
      const report = face.report(value, "cdd");
      expect(report.stream, value.kind).toBe(
        USAGE_BYTES[member as never] === undefined ? "?" : "stderr",
      );
      expect(report.text, value.kind).not.toBe("\n");
    }
    // The base artifact's two read variants land on ONE member, each carrying its own target.
    for (const target of ["one.json", "two.json"]) {
      expect(face.report({ kind: "absent", target }, "base get").text).toContain(`at ${target}`);
      expect(face.report({ kind: "corrupt", target }, "base get").text).toContain(`at ${target}`);
    }
    // The document slice's two values land on the two skeleton rows.
    expect(face.report({ kind: "missing-target" }, "schema get").text).toContain(
      "missing <target>",
    );
    expect(face.report({ kind: "extra-target", target: "x.md" }, "schema get").text).toContain(
      "unexpected x.md",
    );
  });

  it("keeps the usage line out of this file — the injected face is its only source", () => {
    const source = readFileSync(path.join(RENDER_ROOT, "usage.ts"), "utf8");
    expect(source).not.toContain("Usage: ");
    expect(face.confirm("docs/a.md")).toEqual({
      stream: "stdout",
      text: "docs/a.md\n",
      exitCode: 0,
    });
  });
});

describe("the surface door", () => {
  it("hands every renderer to one caller over ONE word table", async () => {
    const cli = new Cli({ clock: CLOCK });
    expect(cli.route).toBeInstanceOf(RouteRenderer);
    expect(cli.board).toBeInstanceOf(BoardView);
    expect(cli.capsule).toBeInstanceOf(Capsule);
    // The capsule and the board read the SAME route face, so their `next:` bytes agree.
    const capsuleRows = cli.capsuleRows({
      status: "CHANGES_REQUESTED",
      handoff: "h",
      hop: FIX_HOP,
    });
    const boardRows = cli.boardRows(boardValue());
    expect(capsuleRows[1]).toBe(`next: ${route.nextValue(FIX_HOP)}`);
    expect(boardRows.join("\n")).toContain(`  next:    ${route.nextValue(FIX_HOP)}`);
    // The prompt bands arrive through the same door: a consumer byte never reaches into the
    // render folder, and both entries read the ONE declared table.
    expect(cli.prompts).toBeInstanceOf(PromptBandsRenderer);
    for (const mode of WORK_MODES) {
      expect(cli.prompt(mode)).toBe(new PromptBandsRenderer().prompt(mode));
    }
    for (const type of TARGET_TYPE_VALUES) {
      expect(cli.review(type)).toBe(new PromptBandsRenderer().review(type));
      expect(cli.review(type)).toContain(`**Criteria — ${type}:**`);
    }
  });

  it("routes a misuse through the usage face and the body through the issue face", async () => {
    const cli = new Cli({ clock: CLOCK, usageLine: (path) => `Usage: cdd ${path}` });
    expect(
      cli.report({ kind: "usage", reason: { kind: "no-frame", command: "review" } }).exitCode,
    ).toBe(1);
    expect(
      cli.report({ kind: "usage", reason: { kind: "missing-plan-or-spec" } }, "board").text,
    ).toBe("Usage: cdd board\nerror: cdd board: pass --plan and/or --spec\n");
    expect(cli.issueReport("{ not json").exitCode).toBe(1);
    expect(cli.briefName(passFrame())).toBe("tasks-1-brief.md");
  });
});

describe("the render folder's wording discipline", () => {
  /** Every prose row of the word table, flat — the strings a renderer must READ, never copy. */
  const proseRows = (): readonly string[] => {
    const rows: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "string") {
        if (value.includes(" ") && value.length > 20) rows.push(value);
        return;
      }
      if (Array.isArray(value)) {
        for (const entry of value) walk(entry);
        return;
      }
      if (typeof value === "object" && value !== null) {
        for (const entry of Object.values(value)) walk(entry);
      }
    };
    walk({ ...words.boardWords(), ...words.refusalWords(), ...words.checkedWords() });
    walk(words.inFlightWords());
    walk(words.artifactWords());
    return rows;
  };

  it("carries no copy of a word-table row in the render modules that read the table", () => {
    const readers = renderSources().filter(
      (source) => !["templates.ts", "issue.ts", "init.ts"].includes(source.rel),
    );
    expect(readers.length).toBeGreaterThan(0);
    for (const row of proseRows()) {
      for (const source of readers) {
        expect(source.text.includes(row), `${source.rel} restates a word-table row`).toBe(false);
      }
    }
  });
});
