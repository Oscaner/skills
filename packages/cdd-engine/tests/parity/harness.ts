// packages/cdd-engine/tests/parity/harness.ts
// The differential reconciliation harness (spec §2.4) — the one thing that turns "the
// new tree reproduces the old one" from a promise into a red-able judgment.
//
// It lives in the test surface on purpose: it reads BOTH trees, which no product module
// may do. Its corpus is the old suite's fixtures (the seven tree shapes plus the three
// non-tree inputs); its expectations are recorded ONCE from the live old tree; its
// verdicts are per CELL, where a cell is one command × one route × one stream, or one
// render face × one scenario.
//
// THE TWO SIDES. A cell's expectation is the baseline — the old tree's recorded bytes.
// Its actual reading comes from the NEW tree, through `NewTree`: the same fixture, the
// same argv, the same injected day. A driver is registered by the wave that lands the
// entry it drives (the process `entry` in the first wave, the in-process `seam` with the
// command face, `render:<family>` with each renderer), and a kind with no driver is a
// NAMED absence — the reconciler never falls back to the old tree, so a wired cell can
// never be judged old-against-old.
//
// THE FIXTURE IS THE INPUT, NOT THE JUDGMENT. Both sides read one prepared tree
// (`Corpus`): the fixture is materialized, its prior rounds are replayed and its stand-in
// is planted by the corpus itself, so the two readings differ only in the reader.
//
// Three states, and each is a different fact:
//   · GAP            — the cell's producer has not landed on the new tree yet. It is
//                      COUNTED, neither skipped nor red: a wave that has not landed a
//                      producer cannot be judged on it;
//   · DIFF           — the cell is wired and its new-tree bytes differ from the recording.
//                      Red;
//   · MISSING        — the recording and the tree disagree: a cell recorded GAP whose
//                      producer has landed (the producer arrived, nobody wired the cell),
//                      a cell recorded wired whose producer is gone, a wired cell the new
//                      tree cannot read, or a recording taken under another frozen date.
//                      Red;
//   · NOT-APPLICABLE — the command has no such route. Its own state, so it never counts
//                      as a GAP and never blocks "the GAP set is empty".
// The per-wave judgment is therefore "wired cells show zero diffs, and the GAP set is
// exactly the roster's unwired applicable cells". "The GAP set is empty" belongs to the
// cutover wave, not to every wave.
//
// The harness must be able to go red on its own, without any new-tree producer: the
// self-proving arm records one scenario twice from the old tree and compares the two
// recordings (they must be equal), then flips one byte of one recording and compares
// again (they must differ). A harness that cannot fail is only running itself.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { declaredRegistries } from "../../src-next/contract/declare.ts";
import { Projector } from "../../src-next/contract/project.ts";
import { Capsule } from "../../src-next/face/capsule.ts";
import { Words } from "../../src-next/face/words.ts";
import { ProcessFacts } from "../../src-next/infra/proc.ts";
import { SkeletonAssembler } from "../../src-next/render/skeleton.ts";
import { TEMPLATE_PROMPT } from "../../src-next/render/templates.ts";
import type { DispatchOutcome } from "../../src-next/session/run.ts";
import { FROZEN_DATE, plantPathStandIn, RecordingStepRunner } from "./fixtures/non-tree.ts";
import { type HolderFacts, materialize, treeFixture } from "./fixtures/trees.ts";
import {
  CELLS,
  type Cell,
  cellId,
  GRID,
  type Landing,
  type Probe,
  type ProbeReading,
} from "./grid.ts";

/** This directory — the corpus's home. */
export const PARITY_ROOT = path.dirname(fileURLToPath(import.meta.url));

/** The new tree's product root — where a producer landing is resolved. */
export const NEW_TREE_ROOT = path.resolve(PARITY_ROOT, "../../src");

/** The new tree's process entry — the composition root the cutover points at. */
export const NEW_TREE_ENTRY = path.join(NEW_TREE_ROOT, "bin.ts");

/** The wiring roster's file — prose plus the table rendered from `CELLS`. */
export const ROSTER_FILE = path.join(PARITY_ROOT, "GRID-WIRING.md");

/** The baseline's directory. */
export const BASELINE_DIR = path.join(PARITY_ROOT, "baseline");

/** The baseline's file. */
export const BASELINE_FILE = path.join(BASELINE_DIR, "src-next.json");

/** One byte difference between a cell's expectation and its reading. */
export interface Diff {
  /** The cell's id. */
  readonly cell: string;
  /** What the baseline holds. */
  readonly expected: string;
  /** What the new tree's reading produced. */
  readonly actual: string;
}

/** One cell's state in a recording. */
export type RecordedState = "gap" | "recorded" | "not-applicable";

/** One cell's state and bytes in a recording. */
export interface RecordedCell {
  /** `gap` = no producer yet; `recorded` = wired and byte-compared; `not-applicable` = the
   *  command has no such route. */
  readonly state: RecordedState;
  /** The recorded bytes (empty for a GAP or a not-applicable cell). */
  readonly value: string;
}

/** One recording of the corpus. */
export interface Baseline {
  /** The scenario's name. */
  readonly scenario: string;
  /** The injected run date every skeleton cell was recorded under. */
  readonly frozenDate: string;
  /** Which tree the bytes came from — the baseline dies with it at the cutover. */
  readonly recordedFrom: "src-next";
  /** The cells, by id. */
  readonly cells: Record<string, RecordedCell>;
}

/** One roster row: which task wires a cell, and where its producer lands. */
export interface RosterRow {
  /** The cell id. */
  readonly cell: string;
  /** The wiring task's label (`T9` … `T16`). */
  readonly task: string;
  /** The producer's landing: `<src-relative module>#<export name>`. */
  readonly producer: string;
  /** The route the cell records, or `not-applicable`. */
  readonly route: string;
}

/**
 * Roster — the cell → wiring-task relation read from `GRID-WIRING.md`. Invariant: every
 * cell the grid declares has exactly one row, every row names exactly one task and one
 * producer landing, and no row names a cell the grid does not declare.
 */
export class Roster {
  readonly #rows: ReadonlyMap<string, RosterRow>;

  private constructor(rows: ReadonlyMap<string, RosterRow>) {
    this.#rows = rows;
  }

  /** Read the roster off the markdown table. */
  static read(file: string): Roster {
    const rows = new Map<string, RosterRow>();
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) continue;
      const parts = trimmed
        .slice(1, -1)
        .split("|")
        .map((part) => part.trim());
      if (parts.length !== 4) continue;
      const [cell, task, producer, route] = parts as [string, string, string, string];
      if (cell === "cell" || cell.startsWith("---")) continue;
      rows.set(cell, { cell, task, producer, route });
    }
    return new Roster(rows);
  }

  /** One cell's row. */
  rowOf(cell: string): RosterRow | null {
    return this.#rows.get(cell) ?? null;
  }

  /** Every cell's row, in grid order. */
  rows(): readonly RosterRow[] {
    return [...this.#rows.values()];
  }

  /** The roster's violations — a missing row, a doubled task, a row for no cell. */
  violations(): readonly string[] {
    const out: string[] = [];
    for (const cell of CELLS) {
      const row = this.#rows.get(cell.id);
      if (row === undefined) {
        out.push(`${cell.id}: no roster row — a cell with no wiring task is a hole`);
        continue;
      }
      if (row.route === "not-applicable") {
        if (row.task !== "—") out.push(`${cell.id}: an inapplicable route names no wiring task`);
        continue;
      }
      if (row.task.trim().length === 0 || row.task.includes("/") || row.task.includes(",")) {
        out.push(`${cell.id}: "${row.task}" is not exactly one wiring task`);
      }
      if (!row.producer.includes("#")) {
        out.push(`${cell.id}: "${row.producer}" names no producer landing (module#export)`);
      }
    }
    for (const row of this.#rows.values()) {
      if (CELLS.some((cell) => cell.id === row.cell)) continue;
      out.push(`${row.cell}: roster row names no declared cell`);
    }
    return out;
  }
}

/** One scenario of the corpus — the frozen date and the shape it speaks through. */
export interface Scenario {
  /** The scenario's name (the baseline file's stem). */
  readonly id: string;
  /** The injected date both trees' skeleton assemblers receive. */
  readonly frozenDate: string;
}

/** The corpus's one scenario. */
export const CORPUS: Scenario = { id: "corpus", frozenDate: FROZEN_DATE };

/** Whether a cell's producer already lands on the new tree: the module exists and its
 *  text names the export. This is the ONLY reading of "wired", and it is what makes a
 *  missed wiring red in the wave that lands the producer. */
export const producerWired = (producer: string): boolean => {
  const [modulePath, exportName] = producer.split("#");
  if (modulePath === undefined || exportName === undefined) return false;
  const file = path.join(NEW_TREE_ROOT, modulePath);
  if (!existsSync(file)) return false;
  return new RegExp(`\\b${exportName}\\b`).test(readFileSync(file, "utf8"));
};

/** One cell's state, DERIVED from the tree rather than assumed. A route the command does
 *  not have is `not-applicable`; a cell whose producer has landed is `recorded`; the rest
 *  are `gap`. Recording the derivation is what keeps a re-record honest: a hardcoded "gap"
 *  can never advance, so the wave that lands a producer could never clear its own red. */
export const stateOf = (cell: Cell): RecordedState => {
  if (!cell.applicable) return "not-applicable";
  return producerWired(cell.producer) ? "recorded" : "gap";
};

/** One cell's value, taken off a reading — the ONE projection BOTH trees' readings pass
 *  through, so the two sides are always compared in the same spelling. A stream with no
 *  declared projection records its own bytes; an exit code stays an exit code. */
export const projectionOf = (cell: Cell, reading: ProbeReading): string => {
  if (!cell.applicable) return "";
  const project = cell.project?.[cell.stream];
  if (project !== undefined) return project(reading);
  if (cell.stream === "exit-code") return String(reading.exitCode);
  return cell.stream === "stderr" ? reading.stderr : reading.stdout;
};

/**
 * Recorder — one pass over the grid with one reader. Invariant: each unit's probe runs
 * exactly once, and every cell's value is a projection of that one reading.
 */
export class Recorder {
  readonly #read: (probe: Probe) => Promise<ProbeReading>;
  readonly #readings = new Map<string, ProbeReading>();

  /** Record through one reader — the old tree's entry or the new tree's face. */
  constructor(read: (probe: Probe) => Promise<ProbeReading>) {
    this.#read = read;
  }

  /** Record every declared cell, each with the state its producer's landing earns. */
  async record(): Promise<Record<string, RecordedCell>> {
    const cells: Record<string, RecordedCell> = {};
    for (const cell of CELLS) {
      cells[cell.id] = { state: stateOf(cell), value: await this.cellValueOf(cell) };
    }
    return cells;
  }

  /** One cell's value, recording its unit on first use. */
  async cellValueOf(cell: Cell): Promise<string> {
    if (!cell.applicable) return "";
    return projectionOf(cell, await this.#readingOf(cell));
  }

  /** The reading behind one unit. */
  async #readingOf(cell: Cell): Promise<ProbeReading> {
    const cached = this.#readings.get(cell.unit);
    if (cached !== undefined) return cached;
    if (cell.probe === undefined)
      throw new Error(`${cell.unit}: a probe-less unit is never recorded`);
    const reading = await this.#read(cell.probe);
    this.#readings.set(cell.unit, reading);
    return reading;
  }
}

/**
 * Corpus — one prepared fixture: the INPUT both sides read. Invariant: the tree is built
 * once, its prior rounds replayed in order, and it is gone when `close` returns. Building
 * it here (not inside a reader) is what makes the two readings differ only in the reader.
 */
export class Corpus {
  /** The materialized repository's real path — the reader's working directory. */
  readonly repo: string;
  /** Whether the probe's prior steps and stand-in were planted, and where. */
  readonly standIn: string | null;
  readonly #target: string | undefined;

  private constructor(repo: string, standIn: string | null, target: string | undefined) {
    this.repo = repo;
    this.standIn = standIn;
    this.#target = target;
  }

  /** Materialize the probe's fixture, replay its prior rounds, plant its stand-in. */
  static async open(probe: Probe): Promise<Corpus> {
    const repo = materialize(
      treeFixture(probe.fixture, { ...probe.options, holder: await Corpus.#holder(probe) }),
    );
    for (const step of probe.before ?? []) {
      if (step.argv !== undefined) {
        // A prior step is a ROUND by definition: it always gets the injected dispatch
        // seam, whatever the observed command declares (a `board` run dispatches nothing
        // itself but still needs its history recorded hermetically — the production seam
        // would spawn a real child).
        await CliProbe.run(
          repo,
          { ...probe, argv: step.argv, before: undefined, dispatch: true },
          step.verdict,
        );
      }
      if (step.write !== undefined) CliProbe.write(repo, step.write.path, step.write.text);
    }
    return new Corpus(repo, probe.standIn === true ? plantPathStandIn(repo) : null, probe.target);
  }

  /** What the run left at the probe's declared target — read INSIDE the tree's life,
   *  because the tree is removed the moment the run ends. */
  landing(): Landing | undefined {
    const rel = this.#target;
    if (rel === undefined) return undefined;
    const absolute = path.join(this.repo, rel);
    if (!existsSync(absolute)) return { path: rel, kind: "absent", digest: "" };
    const bytes = readFileSync(absolute);
    if (bytes.length === 0) return { path: rel, kind: "empty", digest: "" };
    return {
      path: rel,
      kind: "written",
      digest: createHash("sha256").update(bytes).digest("hex"),
    };
  }

  /** Remove the tree — every reading has been taken by now. */
  close(): void {
    rmSync(this.repo, { recursive: true, force: true });
  }

  /** The holder a fixture plants: the live one (this process, so the record reads as a
   *  standing dispatch) or the probe's own facts (a dead holder, for the stale shape). */
  static async #holder(probe: Probe): Promise<HolderFacts | undefined> {
    const declared = probe.options?.holder;
    if (declared !== undefined && declared !== "live") return declared;
    if (declared !== "live" && probe.fixture !== "inflight") return undefined;
    return { pid: process.pid, startedAt: (await ProcessFacts.startOf(process.pid)) ?? 0 };
  }
}

/** The OLD tree's face — its own entry run in process, with every seam injected. */
// biome-ignore lint/complexity/noStaticOnlyClass: one run over one fixture; there is no per-instance state.
export class ProbeRunner {
  /** Run one probe against a fresh materialization of its fixture, read its three streams
   *  and its landing fact, and hand the tree back. A probe that needs a prior round on
   *  record has it replayed in the SAME tree by `Corpus`. */
  static async run(probe: Probe): Promise<ProbeReading> {
    if (probe.render !== undefined) return RenderProbe.run(probe.render);
    const corpus = await Corpus.open(probe);
    try {
      const reading = await CliProbe.run(corpus.repo, probe, probe.verdict);
      return { ...reading, landing: corpus.landing() };
    } finally {
      corpus.close();
    }
  }
}

/** One dispatch conclusion — the round's own verdict, which the corpus records as the
 *  command's failure face when it is `BLOCKED`. */
/** The blocker a review or fix round carries when its conclusion is not `APPROVED`. */
const PENDING_FINDINGS = [
  { id: "F1", severity: "blocker", summary: "the guard is missing" },
] as const;

const verdictOf = (verdict: string | undefined): DispatchOutcome => {
  if (verdict === "BLOCKED") return { status: "BLOCKED", findings: [...PENDING_FINDINGS] };
  if (verdict === "CHANGES_REQUESTED")
    return { status: "CHANGES_REQUESTED", findings: [...PENDING_FINDINGS] };
  return { status: "APPROVED", findings: [] };
};

/** The harness markers the host detection reads — the `no-host` station's whole input. */
const HOST_MARKERS: readonly string[] = ["CLAUDE_CODE_SESSION_ID", "AI_AGENT"];

/** The captured io of one probe run. */
class Capture {
  readonly out: string[] = [];
  readonly err: string[] = [];

  /** The captured standard output so far. */
  get stdout(): string {
    return this.out.join("");
  }

  /** The captured standard error so far. */
  get stderr(): string {
    return this.err.join("");
  }

  /** Append to the captured standard output (the `init` step header's writer). */
  write(text: string): void {
    this.out.push(text);
  }

  /** The io seam the old CLI writes through. */
  io(): { stdout: (text: string) => void; stderr: (text: string) => void } {
    return {
      stdout: (text: string) => this.out.push(text),
      stderr: (text: string) => this.err.push(text),
    };
  }
}

/** The in-process CLI probe — the old tree's own entry, its io captured and its dispatch
 *  step injected, so nothing is spawned and no harness runs for real. */
// biome-ignore lint/complexity/noStaticOnlyClass: one run over one fixture path; there is no per-instance state.
export class CliProbe {
  /** Run the old CLI in `repo` and capture its three streams. The old CLI resolves the
   *  repository root from the working directory, so the fixture is entered and always
   *  left again. A probe that declares `hostless` runs with the harness markers removed —
   *  the `no-host` station's own fixture. */
  static async run(
    repo: string,
    probe: Probe,
    verdict: string | undefined = undefined,
  ): Promise<ProbeReading> {
    const before = process.cwd();
    const capture = new Capture();
    const runner =
      probe.failingRunner === true ? RecordingStepRunner.failing() : new RecordingStepRunner();
    const saved = probe.hostless === true ? CliProbe.#hostless() : null;
    process.chdir(repo);
    try {
      const exitCode = await OldCli.run(repo, probe, capture, runner, verdict);
      // The fixture's own root is the corpus's bookkeeping, not the engine's byte: a
      // diagnostic that names the resolved path (a carrier mismatch, an artifact report)
      // is compared with the materialization spelled as one constant, so two runs in two
      // temp trees are the same recording.
      return {
        stdout: normalizeReading(capture.stdout, repo),
        stderr: normalizeReading(capture.stderr, repo),
        exitCode,
      };
    } finally {
      process.chdir(before);
      if (saved !== null) CliProbe.#restore(saved);
    }
  }

  /** Plant one file inside the materialized tree — how a probe whose fixture needs a
   *  round's own bytes on disk (a tampered carrier, a misplaced sidecar) builds them. */
  static write(repo: string, rel: string, text: string): void {
    const target = path.join(repo, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    // A round carrier is sealed read-only when the engine lands it; a tamper is an
    // explicit act, so the fixture opens the mode first.
    if (existsSync(target)) chmodSync(target, 0o644);
    writeFileSync(target, text, "utf8");
  }

  /** Remove every harness marker from the environment, remembering what stood there. */
  static #hostless(): ReadonlyMap<string, string | undefined> {
    const saved = new Map<string, string | undefined>();
    for (const key of HOST_MARKERS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
    return saved;
  }

  /** Put the environment back the way the probe found it. */
  static #restore(saved: ReadonlyMap<string, string | undefined>): void {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** The old entry's one call — kept as its own seam so the synchronous reading and the
 *  asynchronous CLI call do not tangle. */
// biome-ignore lint/complexity/noStaticOnlyClass: one awaited call into the old entry.
export class OldCli {
  /** Run argv through `Cli.create` with the fixture's injected seams. The dispatch seam
   *  answers the probe's own verdict (`APPROVED` when it does not name one), so a probe
   *  can record a round's BLOCKED conclusion — the command's failure route. */
  static async run(
    _repo: string,
    probe: Probe,
    capture: Capture,
    runner: RecordingStepRunner | null,
    verdict: string | undefined = undefined,
  ): Promise<number> {
    const { Cli } = await import("../../src-next/face/cli.ts");
    const cli = Cli.create({
      io: capture.io(),
      dispatch: probe.dispatch === true ? async () => verdictOf(verdict) : null,
      stdinRead: () => probe.stdin ?? "",
      initRunner: runner ?? new RecordingStepRunner(),
      // The step header must land on the captured stream, never on the process's own fd:
      // the corpus compares the byte the engine writes, not a side channel.
      initHeader: (line: string) => capture.write(`${line}\n`),
    });
    return cli.runArgv(probe.argv);
  }
}

/** The in-process render probe — the old tree's renderers driven directly, which is how a
 *  face whose bytes are a projection (skeleton, prompt, capsule) is recorded without
 *  inventing a command invocation for it. */
// biome-ignore lint/complexity/noStaticOnlyClass: one dispatch over the declared render keys.
export class RenderProbe {
  /** Run one render key. */
  static run(key: string): ProbeReading {
    return { stdout: RenderProbe.#render(key), stderr: "", exitCode: 0 };
  }

  /** The render table — one entry per declared key, no fallback. */
  static #render(key: string): string {
    const [family, name] = key.split(":");
    if (family === "skeleton")
      return new SkeletonAssembler(
        new Projector(declaredRegistries).skeleton()[name as never],
        FROZEN_DATE,
      ).render();
    if (family === "prompt") return RenderProbe.#prompt(name ?? "");
    if (family === "review") return RenderProbe.#review(name ?? "");
    if (family === "capsule") return RenderProbe.#capsule(name ?? "");
    throw new Error(`parity: unknown render probe "${key}"`);
  }

  /** One work-mode prompt band — its fixed shell plus the return zone. */
  static #prompt(mode: string): string {
    const row = TEMPLATE_PROMPT.modes[mode as keyof typeof TEMPLATE_PROMPT.modes];
    if (row === undefined) throw new Error(`parity: no prompt row for "${mode}"`);
    return [
      `$version ${TEMPLATE_PROMPT.$version}`,
      ...row.shell,
      ...TEMPLATE_PROMPT.return.RETURN_PROSE,
    ].join("\n");
  }

  /** One review prompt band — the per-target row's fixed shell plus the return zone. */
  static #review(target: string): string {
    const row = TEMPLATE_PROMPT.reviews[target as keyof typeof TEMPLATE_PROMPT.reviews];
    if (row === undefined) throw new Error(`parity: no review row for "${target}"`);
    return [
      `$version ${TEMPLATE_PROMPT.$version}`,
      ...row.shell,
      ...TEMPLATE_PROMPT.return.RETURN_PROSE,
    ].join("\n");
  }

  /** The capsule's two status faces. */
  static #capsule(kind: string): string {
    const capsule = new Capsule(new Words());
    const handoff = ".kairos/cdd/p9/tasks-1-implement-1.json";
    const lines =
      kind === "failure" ? capsule.emit("BLOCKED", handoff) : capsule.emit("APPROVED", handoff);
    return lines.join("\n");
  }
}

/** How the new tree answers one probe: the driver a wave registers when the entry it
 *  drives lands on the new tree. */
export interface NewTreeDriver {
  /** Read one probe on the new tree, under the corpus's frozen date. */
  run(probe: Probe, frozenDate: string): Promise<ProbeReading>;
}

/** A probe kind the new tree has no driver for — a NAMED absence, never a fallback. */
export class NewTreeAbsent extends Error {
  /** The probe kind that has no driver. */
  readonly kind: string;

  constructor(kind: string) {
    super(`parity: the new tree has no "${kind}" driver yet`);
    this.name = "NewTreeAbsent";
    this.kind = kind;
  }
}

/** Whether a probe needs a seam only the in-process composition root can carry: a dispatch
 *  conclusion (the corpus never spawns a child), the `init` step runner (the corpus never
 *  installs anything) or a runner that refuses. A probe that needs none is read through the
 *  new tree's own process entry. */
const needsSeams = (probe: Probe): boolean =>
  probe.dispatch === true || probe.failingRunner === true || probe.argv[0] === "init";

/** The kind of driver one probe needs — the key the new tree's face is read through. */
export const kindOf = (probe: Probe): string => {
  if (probe.render !== undefined) return `render:${probe.render.split(":")[0]}`;
  return needsSeams(probe) ? "seam" : "entry";
};

/**
 * NewTree — the SECOND side of the reconciliation (spec §2.4). Invariant: a probe is read
 * by the driver registered for its kind, and a kind with no driver raises a named absence.
 * There is no fallback path to the old tree, which is what makes "a wired cell is judged
 * on the new tree's bytes" a property rather than a convention.
 */
export class NewTree {
  readonly #drivers: ReadonlyMap<string, NewTreeDriver>;

  private constructor(drivers: ReadonlyMap<string, NewTreeDriver>) {
    this.#drivers = drivers;
  }

  /** Assemble the face from the drivers that have landed. */
  static of(drivers: readonly (readonly [string, NewTreeDriver])[]): NewTree {
    return new NewTree(new Map(drivers));
  }

  /** The face with no driver at all — every cell is owed one. */
  static unwired(): NewTree {
    return new NewTree(new Map());
  }

  /** The kinds this face answers. */
  kinds(): readonly string[] {
    return [...this.#drivers.keys()].sort();
  }

  /** Read one probe on the new tree. */
  async read(probe: Probe, frozenDate: string): Promise<ProbeReading> {
    const kind = kindOf(probe);
    const driver = this.#drivers.get(kind);
    if (driver === undefined) throw new NewTreeAbsent(kind);
    return driver.run(probe, frozenDate);
  }
}

/** The new tree's own process entry (spec §2.3): the same fixture, the same argv, in a
 *  real process — the composition root the cutover points every entry surface at. A probe
 *  that needs no injected seam is read here verbatim. An entry that has not grown its boot
 *  wrapper yet answers nothing, and the cell's bytes say so instead of the harness
 *  pretending the old tree's answer is the new tree's. */
const ENTRY_DRIVER: NewTreeDriver = {
  async run(probe: Probe, _frozenDate: string): Promise<ProbeReading> {
    const corpus = await Corpus.open(probe);
    try {
      const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: tmpdir() };
      if (probe.hostless === true) for (const key of HOST_MARKERS) delete env[key];
      const result = spawnSync(process.execPath, [NEW_TREE_ENTRY, ...probe.argv], {
        cwd: corpus.repo,
        env,
        input: probe.stdin ?? "",
        encoding: "utf8",
      });
      return {
        stdout: normalizeReading(result.stdout ?? "", corpus.repo),
        stderr: normalizeReading(result.stderr ?? "", corpus.repo),
        exitCode: result.status ?? 1,
        landing: corpus.landing(),
      };
    } finally {
      corpus.close();
    }
  },
};

/** The new tree's execution face as it stands. `entry` is registered because the entry
 *  itself landed in the first wave; `seam` lands with the command face (T16) and
 *  `render:<family>` with each renderer (T9 · T15). The roster names the owing task per
 *  cell, and the reconciler reports an owed cell as MISSING rather than as a diff. */
export const NEW_TREE = NewTree.of([["entry", ENTRY_DRIVER]]);

/** Record the whole corpus from the live old tree. Each cell's state is DERIVED from the
 *  producer's landing on the new tree, so a re-record after a producer arrives advances
 *  the recording instead of writing the same stale state again. */
export const recordCorpus = async (scenario: Scenario): Promise<Baseline> => ({
  scenario: scenario.id,
  frozenDate: scenario.frozenDate,
  recordedFrom: "src-next",
  cells: await new Recorder(ProbeRunner.run).record(),
});

/** Read the baseline, or null when the corpus has never been recorded. */
export const readBaseline = (file: string): Baseline | null => {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as Baseline;
};

/** Write a baseline (the corpus's recording step). */
export const writeBaseline = (baseline: Baseline, file: string): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
};

/** One reconciliation's whole answer. */
export interface Reconciliation {
  /** The byte differences of the wired cells. */
  readonly diffs: readonly Diff[];
  /** The cells with no producer yet — counted, never skipped. */
  readonly gaps: readonly string[];
  /** The recording and the tree disagree, or the new tree cannot read the cell. */
  readonly missing: readonly string[];
}

/** One landing's byte form — the path the command echoed, the landing kind and the written
 *  bytes' digest. Two trees writing one skeleton under one clock answer one value. */
const landingFormOf = (cell: Cell, reading: ProbeReading): string => {
  const landing = reading.landing;
  const target = landing === undefined ? "unread" : `${landing.kind}${landing.digest}`;
  return `${projectionOf(cell, reading)} landing=${target}`;
};

/** One landing cell's judgment: both trees write a target in this run, both targets must be
 *  there, and their bytes must be equal. A cell whose target nobody wrote is a difference
 *  even when neither tree wrote it — "the path was echoed and the file was not written" is
 *  the exact failure this cell exists to red on. */
export const landingDiff = (
  cell: Cell,
  expected: ProbeReading,
  actual: ProbeReading,
): Diff | null => {
  if (expected.landing?.kind !== "written") {
    return {
      cell: cell.id,
      expected: `the old tree must write the target, and it left ${expected.landing?.kind ?? "nothing"}`,
      actual: landingFormOf(cell, actual),
    };
  }
  if (actual.landing?.kind !== "written") {
    return {
      cell: cell.id,
      expected: `the new tree must write the target, and it left ${actual.landing?.kind ?? "nothing"}`,
      actual: landingFormOf(cell, actual),
    };
  }
  if (
    expected.landing.digest === actual.landing.digest &&
    landingFormOf(cell, expected) === landingFormOf(cell, actual)
  ) {
    return null;
  }
  return {
    cell: cell.id,
    expected: landingFormOf(cell, expected),
    actual: landingFormOf(cell, actual),
  };
};

/**
 * Reconcile one scenario against its recording: for every applicable cell whose producer
 * has landed, read the SAME probe on the NEW tree and compare the projection with the
 * recording. Invariant: an actual reading is never taken from the old tree — a wired cell
 * the new tree cannot read is MISSING, not equal.
 */
export const reconcile = async (
  scenario: Scenario,
  baseline: Baseline,
  roster: Roster,
  newTree: NewTree = NEW_TREE,
): Promise<Reconciliation> => {
  const diffs: Diff[] = [];
  const gaps: string[] = [];
  const missing: string[] = [];
  if (baseline.frozenDate !== scenario.frozenDate) {
    missing.push(
      `the corpus was recorded under ${baseline.frozenDate}, not ${scenario.frozenDate} — re-record it`,
    );
  }
  for (const cell of GRID) {
    const recorded = baseline.cells[cell.id];
    if (recorded === undefined) {
      missing.push(`${cell.id}: the baseline carries no entry`);
      continue;
    }
    if (!cell.applicable) {
      if (recorded.state !== "not-applicable") {
        missing.push(`${cell.id}: recorded as ${recorded.state}, but the route does not apply`);
      }
      continue;
    }
    const row = roster.rowOf(cell.id);
    if (row === null || !producerWired(row.producer)) {
      gaps.push(cell.id);
      if (recorded.state === "recorded") {
        missing.push(`${cell.id}: recorded as wired, but its producer is not resolvable`);
      }
      continue;
    }
    if (recorded.state !== "recorded") {
      missing.push(
        `${cell.id}: recorded as ${recorded.state}, but its producer has landed — wire the cell`,
      );
      continue;
    }
    const probe = cell.probe;
    if (probe === undefined) {
      missing.push(`${cell.id}: an applicable cell declares no probe`);
      continue;
    }
    let next: ProbeReading;
    try {
      next = await newTree.read(probe, scenario.frozenDate);
    } catch (raw) {
      if (!(raw instanceof NewTreeAbsent)) throw raw;
      missing.push(`${cell.id}: the new tree has no "${raw.kind}" driver — ${row.task} wires it`);
      continue;
    }
    if (probe.target !== undefined) {
      // A LANDING cell is judged within the run (spec §2.3): its file carries the wall
      // clock's date, so the two trees must write under one clock and their targets be
      // compared then. The baseline keeps the fact it recorded; it is not this cell's
      // expectation, because across a day boundary it would be a lie.
      const diff = landingDiff(cell, await ProbeRunner.run(probe), next);
      if (diff !== null) diffs.push(diff);
      continue;
    }
    const actual = projectionOf(cell, next);
    if (actual === recorded.value) continue;
    diffs.push({ cell: cell.id, expected: recorded.value, actual });
  }
  return { diffs, gaps, missing };
};

/** Compare one scenario against its recording — the byte differences of the wired cells.
 *  The brief's declared signature is `Diff[]`; the read is asynchronous because the new
 *  tree is read through its own process and because a fixture's holder facts are resolved
 *  from the running process. */
export const compareTree = async (scenario: Scenario): Promise<readonly Diff[]> => {
  const baseline = readBaseline(BASELINE_FILE);
  if (baseline === null) throw new Error("the corpus has never been recorded");
  const answer = await reconcile(scenario, baseline, Roster.read(ROSTER_FILE));
  return answer.diffs;
};

/** The harness's self-proving arm — it must be able to fail with no new-tree producer in
 *  the tree at all. */
export class SelfProof {
  readonly #first: Record<string, RecordedCell>;
  readonly #second: Record<string, RecordedCell>;

  private constructor(first: Record<string, RecordedCell>, second: Record<string, RecordedCell>) {
    this.#first = first;
    this.#second = second;
  }

  /** Record the same corpus twice, from the same tree. */
  static async recordTwice(): Promise<SelfProof> {
    return new SelfProof(
      await new Recorder(ProbeRunner.run).record(),
      await new Recorder(ProbeRunner.run).record(),
    );
  }

  /** The two recordings' byte differences — empty when the recording is deterministic. */
  drift(): Diff[] {
    const diffs: Diff[] = [];
    for (const cell of GRID) {
      const left = this.#first[cell.id];
      const right = this.#second[cell.id];
      if (left === undefined || right === undefined) {
        diffs.push({
          cell: cell.id,
          expected: left?.value ?? "(absent)",
          actual: right?.value ?? "(absent)",
        });
        continue;
      }
      if (left.value !== right.value)
        diffs.push({ cell: cell.id, expected: left.value, actual: right.value });
    }
    return diffs;
  }

  /** The same comparison, with one byte of one cell's expectation flipped — the arm that
   *  proves a difference is actually seen. */
  flipped(cell: string): Diff[] {
    const held = this.#first[cell];
    if (held === undefined) throw new Error(`self-proof: unknown cell "${cell}"`);
    const mutated = `${held.value}\u0000flipped`;
    return [{ cell, expected: mutated, actual: this.#second[cell]?.value ?? "" }].filter(
      (diff) => diff.expected !== diff.actual,
    );
  }
}

/** A shell helper for a report: the number of applicable cells in the grid. */
export const applicableCellCount = (): number => CELLS.filter((cell) => cell.applicable).length;

/** The cell id form, re-exported for the test's report lines. */
export { cellId };

/** The one spelling a materialized tree's own root takes in a recording. */
export const REPO_TOKEN = "<repo>";

/** The facts the corpus cannot pin, and the constants that stand in for them.
 *
 *  A holder record's pid, its start instant and its uptime are facts about the process the
 *  corpus itself started: two trees driven by two fixtures can never print the same
 *  numbers, so the recording spells them as corpus constants. Everything the numbers
 *  surround — `alive` / `gone`, the takeover hint, the target-gone sentence — stays in the
 *  byte, so a liveness judgment that drifts still shows.
 *
 *  A `recorded=` digest is the record's own memory of a carrier the ENGINE wrote, and those
 *  bytes carry a write instant: the digest changes whenever the tree is materialized again.
 *  Only the recorded side is unpinnable — the `current=` side digests the tampered bytes
 *  the corpus itself plants, so it stays a pinned byte and the mismatch fact itself is never
 *  masked. */
const UNPINNED: readonly (readonly [RegExp, string])[] = [
  [/\bpid \d+/g, "pid <pid>"],
  [/\bstarted: \d{4}-\d\d-\d\dT[\d:.]+Z/g, "started: <startedAt>"],
  [/\brunning for \d+m/g, "running for <uptime>"],
  [/\brecorded=[0-9a-f]{8}/g, "recorded=<digest>"],
];

/** Replace the fixture's absolute root and the corpus's own runtime facts with the corpus
 *  constants. The engine's own decisions stay in the byte. */
export const normalizeReading = (text: string, repo: string): string =>
  UNPINNED.reduce(
    (carried, [pattern, token]) => carried.replace(pattern, token),
    repo === "" ? text : text.split(repo).join(REPO_TOKEN),
  );

/** One temp directory helper used by the fixtures' README readings. */
export const repoReadings = (argv: readonly string[], repo: string): string => {
  const result = spawnSync("node", [path.join(PARITY_ROOT, "../../src-next/bin.ts"), ...argv], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, TMPDIR: tmpdir() },
  });
  return `${result.stdout}${result.stderr}`.trim();
};
