// packages/cdd-engine/src/run/gate/__tests__/gate.test.ts
// The gate's pins — six groups, one per fact the gate owns:
//
//   · the row set — one closed vocabulary derived from ONE declaration, the four stations as
//     MEMBERS of it, and each face's row count as that face's own function;
//   · the `graph` leg — the injected graph's own failure set, never a second edge rule;
//   · "a refusal books no round" — the ledger is not this gate's collaborator;
//   · the refusal's timestamp — the injected clock, and zero clock reads in this segment;
//   · at most one refusal — two refusals leave one fact;
//   · the two expiry triggers — the door's clear and the release point's clear, and no other
//     path clearing;
//   · the three takeover legs — each one's own authorization condition;
//   · the two yielding conditions — a face with no input face yields all four stations, and a
//     refusal before them records none of them.
//
// Every case drives a real `WorkspaceRoot` and a real `Ledger` over a temp git tree: "the
// record lands through the workspace" and "no round moved" are only facts if the writes are
// the workspace's own.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { Finding, JudgeInput, LedgerFacts, RuleDeclaration } from "../../../docs/index.ts";
import { RULE_REGISTRY, TaskGraph } from "../../../docs/index.ts";
import type { RepoPath } from "../../../env/paths/root.ts";
import { RepoRoot } from "../../../env/paths/root.ts";
import { Clock } from "../../../env/process/clock.ts";
import { WorkspaceRoot } from "../../../env/workspace/workspace.ts";
import { Ledger } from "../../ledger/ledger.ts";
import { Authority } from "../authority.ts";
import {
  type CheckedRow,
  type DocJudgment,
  PRE_FLIGHT_GATE_NAMES,
  PRE_FLIGHT_REASONS,
  PreFlight,
  type PreFlightContext,
  type PreFlightVerdict,
  ROW_STATIONS,
  STRUCTURE_ROWS,
} from "../preflight.ts";
import { Refusal } from "../refusal.ts";

/** The `src`-relative directory this file pins. */
const GATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A fixed instant — the injected clock's one reading. */
const FIXED_NOW = 1_700_000_000_000;

/** The phase workspace slug every case dispatches on. */
const SLUG = "p9";

/** The judged document's coordinate. */
const DOC_REL = "docs/kairos/plans/p9.md" as RepoPath;

/** The temp repos this file made, removed after every case. */
const created: string[] = [];

/** A temp directory initialised as a git working tree. */
const tempRepo = (): string => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "gate-")));
  created.push(directory);
  spawnSync("git", ["init", "-q"], { cwd: directory });
  return directory;
};

/** One stamped finding — the shape the document slice answers. */
const finding = (kind: string, severity: "block" | "warn" = "block"): Finding => ({
  path: DOC_REL,
  field: kind,
  message: `${kind} happened`,
  fix: `fix ${kind}`,
  kind,
  severity,
});

/** The document judgment stand-in — the gate reads the document slice through this face, so a
 *  case dictates the findings, the closure and the table without parsing a document. */
class FakeJudgment implements DocJudgment {
  doc: readonly Finding[] = [];
  ledger: readonly Finding[] = [];
  closed = false;

  judge(_input: JudgeInput): readonly Finding[] {
    return this.doc;
  }

  judgeLedger(_input: JudgeInput, _facts: LedgerFacts): readonly Finding[] {
    return this.ledger;
  }

  ruleRows(): readonly RuleDeclaration[] {
    return RULE_REGISTRY;
  }

  closedAt(_path: RepoPath): boolean {
    return this.closed;
  }
}

/** One fixture: a temp repo, its workspace family, the gate and the real ledger beside it. */
const fixture = (opts: { readonly clean?: boolean } = {}) => {
  const repo = tempRepo();
  const root = new WorkspaceRoot({
    basis: RepoRoot.of(repo),
    now: () => FIXED_NOW,
    baseName: "base.json",
  });
  const clock = new Clock(() => FIXED_NOW);
  const refusal = new Refusal({
    root,
    clock,
    stations: new Set<string>(PRE_FLIGHT_GATE_NAMES),
  });
  const docs = new FakeJudgment();
  const tree = { clean: opts.clean ?? true };
  const gate = new PreFlight({
    repoRoot: repo,
    tree: { isClean: async () => tree.clean },
    docs,
    refusal,
  });
  const workspace = root.at(SLUG);
  const ledger = new Ledger({ workspace, names: () => [] });
  return { repo, root, clock, refusal, docs, tree, gate, workspace, ledger };
};

/** One dispatch's gate inputs, with the face's own cells overridden per case. */
const contextOf = (over: Partial<PreFlightContext> = {}): PreFlightContext => ({
  type: "wave",
  slug: SLUG,
  op: "implement",
  cycle: 1,
  attempt: 1,
  inflight: { kind: "absent" },
  graph: null,
  planLedger: null,
  doc: null,
  rows: null,
  ...over,
});

/** One plan task block in the plan grammar — the six declared sections plus its edge. */
const taskBlock = (id: number, dependsOn: string): string =>
  [
    `### Task ${id}: task ${id}`,
    "",
    "#### Objective",
    "",
    `objective ${id}`,
    "",
    "#### Files",
    "",
    "- Create: `a.ts`",
    "",
    "#### Consumes",
    "",
    "- the gate",
    "",
    "#### Produces",
    "",
    "- the gate",
    "",
    "#### Steps",
    "",
    "- write it — checkable: green",
    "",
    "#### Acceptance",
    "",
    "ok",
    "",
    "#### DependsOn",
    "",
    dependsOn,
    "",
  ].join("\n");

/** A plan whose blocks carry the given edges. */
const planText = (edges: Readonly<Record<number, string>>): string =>
  Object.entries(edges)
    .map(([id, dependsOn]) => taskBlock(Number(id), dependsOn))
    .join("\n");

/** The checked rows of one label — the derivation every row-set assertion reads. */
const rowsLabelled = (verdict: PreFlightVerdict, label: string): readonly CheckedRow[] =>
  verdict.checked.filter((row) => row.row === label);

/** The skip reasons in one verdict's checked face. */
const skipReasons = (verdict: PreFlightVerdict): readonly string[] =>
  verdict.checked.flatMap((row) => (row.reading.kind === "skipped" ? [row.reading.reason] : []));

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("the gate row set", () => {
  it("is one closed vocabulary, and the four stations are MEMBERS of it", () => {
    // Containment, never equality: the stations are part of the gate's row set, not a second
    // set standing beside it.
    for (const station of ROW_STATIONS) expect(PRE_FLIGHT_GATE_NAMES).toContain(station);
    for (const row of STRUCTURE_ROWS) expect(PRE_FLIGHT_GATE_NAMES).toContain(row);
    // The runtime companion carries every member exactly once.
    expect(new Set(PRE_FLIGHT_GATE_NAMES).size).toBe(PRE_FLIGHT_GATE_NAMES.length);
  });

  it("derives each face's rows from that one set — the count is the face's function", async () => {
    const { gate } = fixture();
    // A plan dispatch hits the whole set; every other face is a strict subset of it.
    expect(PreFlight.rowsOf("plan", { graph: true })).toEqual([...PRE_FLIGHT_GATE_NAMES]);
    const counts = new Map<string, number>();
    for (const face of ["wave", "branch", "phase-spec", "overall"] as const) {
      const rows = PreFlight.rowsOf(face, { graph: true });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThan(PRE_FLIGHT_GATE_NAMES.length);
      for (const row of rows) expect(PRE_FLIGHT_GATE_NAMES).toContain(row);
      counts.set(face, rows.length);
    }
    // Three faces, three different counts — no constant stands in for the derivation.
    expect(new Set([counts.get("plan"), counts.get("wave"), counts.get("branch")]).size).toBe(3);
    // …and the approved verdict's own order is that derivation, so a row inserted into the
    // vocabulary without a leg reds here instead of passing silently.
    const verdict = await gate.vet(
      contextOf({ type: "wave", graph: TaskGraph.parse(planText({ 1: "none" })) }),
    );
    expect(verdict.ok).toBe(true);
    expect(verdict.order).toEqual(PreFlight.rowsOf("wave", { graph: true }));
  });

  it("makes every declared reason reachable through a row", async () => {
    const seen = new Set<string>();
    const dirty = fixture({ clean: false });
    seen.add(String((await dirty.gate.vet(contextOf())).reason));
    const live = fixture();
    const held = await live.gate.vet(
      contextOf({ inflight: { kind: "held", pid: 4242, alive: true, targetGone: [] } }),
    );
    seen.add(String(held.reason));
    const corrupt = fixture();
    const locked = await corrupt.gate.vet(
      contextOf({ inflight: { kind: "corrupt", locked: true } }),
    );
    seen.add(String(locked.reason));
    const looped = fixture();
    const graph = await looped.gate.vet(
      contextOf({ type: "wave", graph: TaskGraph.parse(planText({ 1: "1" })) }),
    );
    seen.add(String(graph.reason));
    const doc = fixture();
    doc.docs.doc = [finding("presence")];
    const contract = await doc.gate.vet(
      contextOf({
        type: "phase-spec",
        doc: { docKey: "phase-spec", path: DOC_REL, content: "body" },
        rows: [],
      }),
    );
    seen.add(String(contract.reason));
    expect([...seen].sort()).toEqual([...PRE_FLIGHT_REASONS].sort());
  });

  it("refuses a record whose station names no row of the set", () => {
    const { refusal, root } = fixture();
    refusal.write({
      slug: SLUG,
      op: "implement",
      type: "wave",
      cycle: 1,
      attempt: 1,
      station: "tree-claen" as never,
      detail: "a hand-edited word",
    });
    expect(refusal.readRaw()).toEqual({
      kind: "corrupt",
      reason: "its `station` names no pre-flight row",
    });
    // The bytes really are on the workspace family's root — not inside a slug directory.
    expect(existsSync(path.join(root.path, Refusal.FILE))).toBe(true);
    expect(existsSync(path.join(root.path, SLUG, Refusal.FILE))).toBe(false);
  });
});

describe("the graph leg", () => {
  it("refuses a self-dependent plan from the graph's own failure set", async () => {
    const { gate } = fixture();
    const verdict = await gate.vet(
      contextOf({ type: "wave", graph: TaskGraph.parse(planText({ 1: "1", 2: "none" })) }),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.gate).toBe("graph");
    expect(verdict.reason).toBe("graph");
    // The detail is the graph's ONE rendered template, and it names the edge.
    expect(verdict.details?.[0]).toContain("self-loop@T1");
    expect(verdict.order).toEqual(["tree-clean", "in-flight", "graph"]);
  });

  it("passes the same plan once the injected graph answers no issue — the leg is not vacuous", async () => {
    const { gate } = fixture();
    const empty = {
      validate: () => [],
      batches: () => [],
      nodes: () => [],
    } as unknown as TaskGraph;
    const verdict = await gate.vet(contextOf({ type: "wave", graph: empty }));
    expect(verdict.ok).toBe(true);
    expect(verdict.order).toContain("graph");
  });
});

describe("a refusal books no round", () => {
  it("writes the tree's refusal fact and leaves the ledger untouched", async () => {
    const { gate, ledger, refusal } = fixture({ clean: false });
    expect(ledger.read()).toBeNull();
    const verdict = await gate.vet(contextOf());
    expect(verdict.ok).toBe(false);
    // The record states the refusal and the coordinate it WOULD have consumed…
    const state = refusal.readRaw();
    expect(state.kind).toBe("standing");
    expect(state.kind === "standing" ? state.facts.cycle : null).toBe(1);
    // …and no round is booked under it: the ledger has no document at all.
    expect(ledger.read()).toBeNull();
    expect(ledger.rounds(`tasks-1`)).toEqual([]);
  });
});

describe("the refusal's timestamp", () => {
  it("takes `at` from the injected clock", async () => {
    const { gate, refusal, clock } = fixture({ clean: false });
    await gate.vet(contextOf());
    const state = refusal.readRaw();
    expect(state.kind === "standing" ? state.facts.at : null).toBe(clock.isoOf(FIXED_NOW));
  });

  it("reads no clock of its own anywhere in this segment", () => {
    const files = readdirSync(GATE_DIR).filter((name) => name.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(2);
    for (const file of files) {
      const text = readFileSync(path.join(GATE_DIR, file), "utf8");
      expect(text).not.toContain("Date.now()");
      expect(text).not.toContain("new Date()");
    }
  });
});

describe("at most one refusal", () => {
  it("keeps ONE fact across two refusals, the second replacing the first", async () => {
    const { gate, refusal, root } = fixture({ clean: false });
    await gate.vet(contextOf({ type: "wave" }));
    await gate.vet(contextOf({ type: "phase-spec", doc: null }));
    const state = refusal.readRaw();
    expect(state.kind).toBe("standing");
    expect(state.kind === "standing" ? state.facts.station : null).toBe("tree-clean");
    expect(state.kind === "standing" ? state.facts.type : null).toBe("phase-spec");
    // One record, not a queue.
    const names = readdirSync(path.join(root.path)).sort();
    expect(names).toEqual([Refusal.FILE]);
  });
});

describe("the two expiry triggers", () => {
  it("clears the fact at the door when every row passes", async () => {
    // The same workspace, one refusal first: the record stands before the clean run.
    const clean = fixture();
    clean.tree.clean = false;
    await clean.gate.vet(contextOf());
    expect(clean.refusal.readRaw().kind).toBe("standing");
    // Now every applicable row passes on the plan face.
    clean.tree.clean = true;
    clean.docs.doc = [];
    const verdict = await clean.gate.vet(
      contextOf({
        type: "plan",
        graph: TaskGraph.parse(planText({ 1: "none" })),
        planLedger: {
          input: { docKey: "plan", path: DOC_REL, content: "body" },
          facts: {
            planTasks: [1],
            recordedTasks: [],
            closedWaves: [],
            openWaves: [],
            snapshots: [],
            layers: [[1]],
          },
        },
        doc: { docKey: "plan", path: DOC_REL, content: "body", taskLayers: [[1]] },
        rows: [],
      }),
    );
    expect(verdict.ok).toBe(true);
    expect(clean.refusal.readRaw()).toEqual({ kind: "absent" });
    expect(clean.refusal.read(SLUG)).toEqual({ kind: "absent" });
  });

  it("clears the fact at the release point — and no other path clears", async () => {
    const { gate, refusal } = fixture({ clean: false });
    await gate.vet(contextOf());
    // A read does not clear, and neither does a second look at the record.
    expect(refusal.read(SLUG).kind).toBe("standing");
    expect(refusal.readRaw().kind).toBe("standing");
    // The release point's clearance is `Refusal#clear` — the same call `InFlight#release`
    // makes when a dispatch finishes normally.
    refusal.clear();
    expect(refusal.readRaw()).toEqual({ kind: "absent" });
    refusal.clear();
    expect(refusal.readRaw()).toEqual({ kind: "absent" });
  });

  it("reads another workspace's standing record as absent, and the tree's read as standing", async () => {
    const { gate, refusal } = fixture({ clean: false });
    await gate.vet(contextOf({ slug: "other" }));
    expect(refusal.read(SLUG)).toEqual({ kind: "absent" });
    expect(refusal.readRaw().kind).toBe("standing");
  });
});

describe("the three takeover legs", () => {
  it("never crosses a live holder, whatever the flag says", async () => {
    const { gate } = fixture();
    const verdict = await gate.vet(
      contextOf({
        recover: true,
        inflight: { kind: "held", pid: 4242, alive: true, targetGone: [] },
      }),
    );
    expect(verdict.gate).toBe("in-flight");
    // …and the leg is false on both cells: the record is not stale, and the gate refused the
    // row it rests on.
    expect(new Authority().abortAllowed({ verdict, stale: false })).toBe(false);
    expect(new Authority().abortAllowed({ verdict, stale: true })).toBe(false);
  });

  it("still holds when a document gate refuses after the in-flight gate passed", async () => {
    const { gate, docs } = fixture();
    docs.doc = [finding("presence")];
    const verdict = await gate.vet(
      contextOf({
        recover: true,
        type: "phase-spec",
        doc: { docKey: "phase-spec", path: DOC_REL, content: "body" },
        rows: [],
      }),
    );
    expect(verdict.gate).toBe("doc-contract");
    // The record is about the TREE: the in-flight gate passed, so the takeover stands.
    expect(new Authority().abortAllowed({ verdict, stale: true })).toBe(true);
  });

  it("holds legs ② and ③ back when the structure leg refused", async () => {
    const { gate } = fixture();
    const verdict = await gate.vet(
      contextOf({
        recover: true,
        inflight: { kind: "held", pid: 9, alive: false, targetGone: ["plan"] },
      }),
    );
    expect(verdict.ok).toBe(true);
    expect(verdict.gate).toBeUndefined();
    // The gate passed the stale record: leg ① holds…
    expect(new Authority().abortAllowed({ verdict, stale: true })).toBe(true);
    // …and with a structural refusal instead, the reopen waits for the tree:
    const refused = await fixture({ clean: false }).gate.vet(contextOf());
    const answer = new Authority().takeover({
      verdict: refused,
      stale: false,
      reopenRequested: true,
    });
    expect(answer).toEqual({ kind: "structure" });
  });

  it("composes the three legs in one answer", () => {
    const authority = new Authority();
    const approved: PreFlightVerdict = {
      ok: true,
      order: ["tree-clean", "in-flight"],
      checked: [],
    };
    const refused: PreFlightVerdict = {
      ok: false,
      gate: "tree-clean",
      reason: "dirty-tree",
      order: ["tree-clean"],
      checked: [],
    };
    // Leg ① alone.
    expect(authority.takeover({ verdict: approved, stale: true, reopenRequested: false })).toEqual({
      kind: "allowed",
      aborted: true,
      reopened: false,
    });
    // Legs stack.
    expect(authority.takeover({ verdict: approved, stale: true, reopenRequested: true })).toEqual({
      kind: "allowed",
      aborted: true,
      reopened: true,
    });
    // Leg ② alone.
    expect(authority.takeover({ verdict: approved, stale: false, reopenRequested: true })).toEqual({
      kind: "allowed",
      aborted: false,
      reopened: true,
    });
    // Leg ③: neither leg, and the structure leg passed.
    expect(authority.takeover({ verdict: approved, stale: false, reopenRequested: false })).toEqual(
      {
        kind: "blocked",
      },
    );
    // The first refuser rules instead of the double-gap message.
    expect(authority.takeover({ verdict: refused, stale: false, reopenRequested: false })).toEqual({
      kind: "structure",
    });
  });
});

describe("the two yielding conditions", () => {
  it("yields all four stations when the face has no input face", async () => {
    const { gate } = fixture();
    const verdict = await gate.vet(contextOf({ rows: null }));
    expect(verdict.ok).toBe(true);
    for (const station of ROW_STATIONS) {
      expect(rowsLabelled(verdict, station)).toEqual([
        { row: station, reading: { kind: "skipped", reason: "no-input-face" } },
      ]);
    }
  });

  it("records none of the four when a row before them refused", async () => {
    const { gate } = fixture({ clean: false });
    const verdict = await gate.vet(
      contextOf({ rows: [{ station: "no-host", detail: "no harness detected" }] }),
    );
    expect(verdict.ok).toBe(false);
    for (const station of ROW_STATIONS) {
      expect(verdict.order).not.toContain(station);
      expect(rowsLabelled(verdict, station)).toEqual([]);
    }
  });

  it("refuses on the first station and rides the rest as details", async () => {
    const { gate, refusal } = fixture();
    const verdict = await gate.vet(
      contextOf({
        rows: [
          { station: "no-host", detail: "no harness detected" },
          { station: "artifact", detail: "the sidecar is misplaced" },
        ],
      }),
    );
    expect(verdict.gate).toBe("no-host");
    // A station refusal carries no reason word: the station IS the row and the detail is the
    // row's own conclusion.
    expect(verdict.reason).toBeUndefined();
    expect(verdict.details).toEqual(["the sidecar is misplaced"]);
    // The recorded fact keeps the first row's conclusion, never the station head.
    const state = refusal.readRaw();
    expect(state.kind === "standing" ? state.facts.detail : null).toBe("no harness detected");
    expect(state.kind === "standing" ? state.facts.station : null).toBe("no-host");
  });

  it("lets every declared rule row yield rather than claim a pass it never judged", async () => {
    const { gate } = fixture();
    const verdict = await gate.vet(contextOf({ rows: [] }));
    // A wave dispatch judges no document and no ledger fact: both rule families yield.
    expect(skipReasons(verdict)).toContain("no-doc-target");
    expect(skipReasons(verdict)).toContain("no-ledger-facts");
    // A plan document judged without an injected layer set says so on the one layer-reading
    // row instead of reading `passed` for it.
    const plan = fixture();
    const judged = await plan.gate.vet(
      contextOf({
        type: "plan",
        graph: TaskGraph.parse(planText({ 1: "none" })),
        doc: { docKey: "plan", path: DOC_REL, content: "body" },
        rows: [],
      }),
    );
    expect(judged.ok).toBe(true);
    const yielding = judged.checked.filter(
      (row) => row.reading.kind === "skipped" && row.reading.reason === "no-plan-layers",
    );
    expect(yielding).toHaveLength(1);
  });

  it("reads a proven-closed document as a yield on exactly the exempt rows", async () => {
    const { gate, docs } = fixture();
    docs.closed = true;
    const verdict = await gate.vet(
      contextOf({
        type: "phase-spec",
        doc: { docKey: "phase-spec", path: DOC_REL, content: "body" },
        rows: [],
      }),
    );
    expect(verdict.ok).toBe(true);
    const exempt = RULE_REGISTRY.filter(
      (row) =>
        row.scope === "doc" &&
        row.skipWhenClosed &&
        (row.docTypes === "all" || row.docTypes.includes("phase-spec")),
    );
    const yielded = verdict.checked.filter(
      (row) => row.reading.kind === "skipped" && row.reading.reason === "closed-document",
    );
    expect(yielded.map((row) => row.row).sort()).toEqual(exempt.map((row) => row.id).sort());
  });
});

describe("the segment boundary", () => {
  it("imports no later run segment and spells no consumer byte", () => {
    for (const file of readdirSync(GATE_DIR).filter((name) => name.endsWith(".ts"))) {
      const text = readFileSync(path.join(GATE_DIR, file), "utf8");
      for (const later of ["run/dispatch", "run/advance", "surface/"]) {
        expect(text).not.toContain(`"${later}`);
      }
    }
  });
});
