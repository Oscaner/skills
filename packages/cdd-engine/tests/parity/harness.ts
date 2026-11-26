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
// Three states, and each is a different fact:
//   · GAP     — the cell's producer has not landed on the new tree yet. It is COUNTED,
//               not skipped and not red: a wave that has not landed a producer cannot be
//               judged on it. The baseline records which cells were GAP when it was
//               taken, so "still GAP" and "silently dropped" stay different facts;
//   · DIFF    — the cell is wired and its bytes differ from the baseline. Red;
//   · MISSING — the recorded state and the tree disagree: a cell recorded GAP whose
//               roster producer is already resolvable on the new tree (the producer
//               landed and nobody wired the cell), or a cell recorded wired whose
//               producer is gone. Red.
// The per-wave judgment is therefore "wired cells show zero diffs, and the GAP set is
// exactly the set the baseline recorded as unwired". "The GAP set is empty" belongs to
// the cutover wave, not to every wave.
//
// The harness must be able to go red on its own, without any new-tree producer: the
// self-proving arm records one scenario twice from the old tree and compares the two
// recordings (they must be equal), then flips one byte of one recording and compares
// again (they must differ). A harness that cannot fail is only running itself.

import { spawnSync } from "node:child_process";
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
import { CELLS, type Cell, cellId, GRID, type Probe } from "./grid.ts";

/** This directory — the corpus's home. */
export const PARITY_ROOT = path.dirname(fileURLToPath(import.meta.url));

/** The new tree's product root — where a producer landing is resolved. */
export const NEW_TREE_ROOT = path.resolve(PARITY_ROOT, "../../src");

/** One byte difference between a cell's expectation and its reading. */
export interface Diff {
  /** The cell's id. */
  readonly cell: string;
  /** What the baseline holds. */
  readonly expected: string;
  /** What the reading produced. */
  readonly actual: string;
}

/** One cell's state in a recording. */
export interface RecordedCell {
  /** `gap` = not wired yet; `recorded` = wired and byte-compared. */
  readonly state: "gap" | "recorded";
  /** The recorded bytes (empty for a GAP cell). */
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

/** One probe's reading — the three streams every probe answers. */
export interface Reading {
  /** Standard output. */
  readonly stdout: string;
  /** Standard error. */
  readonly stderr: string;
  /** The process exit code. */
  readonly exitCode: number;
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

/** The baseline's directory. */
export const BASELINE_DIR = path.join(PARITY_ROOT, "baseline");

/** The baseline's file. */
export const BASELINE_FILE = path.join(BASELINE_DIR, "src-next.json");

/**
 * Recorder — one pass over the grid. Invariant: each unit's probe runs exactly once
 * against a fresh fixture, and every cell's value is a projection of that one reading.
 */
export class Recorder {
  readonly #readings = new Map<string, Reading>();

  /** Record every declared cell. */
  async record(): Promise<Record<string, RecordedCell>> {
    const cells: Record<string, RecordedCell> = {};
    for (const cell of CELLS) {
      cells[cell.id] = { state: "gap", value: await this.valueOf(cell) };
    }
    return cells;
  }

  /** One cell's value, recording its unit on first use. */
  async valueOf(cell: Cell): Promise<string> {
    if (!cell.applicable) return "";
    const reading = await this.#readingOf(cell);
    if (cell.slice !== undefined) return cell.slice(reading);
    if (cell.stream === "exit-code") return String(reading.exitCode);
    return cell.stream === "stderr" ? reading.stderr : reading.stdout;
  }

  /** The reading behind one unit. */
  async #readingOf(cell: Cell): Promise<Reading> {
    const cached = this.#readings.get(cell.unit);
    if (cached !== undefined) return cached;
    if (cell.probe === undefined)
      throw new Error(`${cell.unit}: a probe-less unit is never recorded`);
    const reading = await ProbeRunner.run(cell.probe);
    this.#readings.set(cell.unit, reading);
    return reading;
  }
}

/** The probe executor — one fresh fixture, one run, one reading. */
// biome-ignore lint/complexity/noStaticOnlyClass: a single imperative seam around the two old-tree entries; there is no per-instance state.
export class ProbeRunner {
  /** Run one probe against a fresh materialization of its fixture. A probe that needs a
   *  prior round on record runs its `before` steps first, in the SAME tree, and the
   *  observed run is the last one — the shape the old suite's E2E cases build, not a
   *  second corpus arm. */
  static async run(probe: Probe): Promise<Reading> {
    if (probe.render !== undefined) return RenderProbe.run(probe.render);
    const repo = materialize(
      treeFixture(probe.fixture, { ...probe.options, holder: await ProbeRunner.#holder(probe) }),
    );
    try {
      for (const step of probe.before ?? []) {
        if (step.argv !== undefined) {
          // A prior step is a ROUND by definition: it always gets the injected
          // dispatch seam, whatever the observed command declares (a `board` run
          // dispatches nothing itself but still needs its history recorded
          // hermetically — the production seam would spawn a real child).
          await CliProbe.run(
            repo,
            { ...probe, argv: step.argv, before: undefined, dispatch: true },
            step.verdict,
          );
        }
        if (step.write !== undefined) CliProbe.write(repo, step.write.path, step.write.text);
      }
      return await CliProbe.run(repo, probe, probe.verdict);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
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

/** The in-process CLI probe — the old tree's own entry, its io captured and its
 *  dispatch step injected, so nothing is spawned and no harness runs for real. */
// biome-ignore lint/complexity/noStaticOnlyClass: one run over one fixture path; there is no per-instance state.
export class CliProbe {
  /** Run the old CLI in `repo` and capture its three streams. The old CLI resolves
   *  the repository root from the working directory, so the fixture is entered and
   *  always left again. A probe that declares `hostless` runs with the harness markers
   *  removed — the `no-host` station's own fixture. */
  static async run(
    repo: string,
    probe: Probe,
    verdict: string | undefined = undefined,
  ): Promise<Reading> {
    const before = process.cwd();
    const capture = new Capture();
    const runner =
      probe.failingRunner === true ? RecordingStepRunner.failing() : new RecordingStepRunner();
    const saved = probe.hostless === true ? CliProbe.#hostless() : null;
    process.chdir(repo);
    try {
      if (probe.standIn === true) plantPathStandIn(repo);
      const exitCode = await OldCli.run(repo, probe, capture, runner, verdict);
      // The fixture's own root is the corpus's bookkeeping, not the engine's byte: a
      // diagnostic that names the resolved path (a carrier mismatch, an artifact
      // report) is compared with the materialization spelled as one constant, so two
      // runs in two temp trees are the same recording.
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

/** The harness markers the host detection reads — the `no-host` station's whole input. */
const HOST_MARKERS: readonly string[] = ["CLAUDE_CODE_SESSION_ID", "AI_AGENT"];

/** The old entry's one call — kept as its own seam so the synchronous reading and the
 *  asynchronous CLI call do not tangle. */
// biome-ignore lint/complexity/noStaticOnlyClass: one awaited call into the old entry.
export class OldCli {
  /** Run argv through `Cli.create` with the fixture's injected seams. The dispatch
   *  seam answers the probe's own verdict (`APPROVED` when it does not name one), so a
   *  probe can record a round's BLOCKED conclusion — the command's failure route. */
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
      // The step header must land on the captured stream, never on the process's own
      // fd: the corpus compares the byte the engine writes, not a side channel.
      initHeader: (line: string) => capture.write(`${line}\n`),
    });
    return cli.runArgv(probe.argv);
  }
}

/** The in-process render probe — the old tree's renderers driven directly, which is
 *  how a face whose bytes are a projection (skeleton, prompt, capsule) is recorded
 *  without inventing a command invocation for it. */
// biome-ignore lint/complexity/noStaticOnlyClass: one dispatch over the declared render keys.
export class RenderProbe {
  /** Run one render key. */
  static run(key: string): Reading {
    const text = RenderProbe.#render(key);
    return { stdout: text, stderr: "", exitCode: 0 };
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

/** Record the whole corpus from the live old tree. `state` is `gap` for every cell
 *  while no new-tree producer has landed — the wave's own fact, recorded rather than
 *  assumed. */
export const recordCorpus = async (scenario: Scenario): Promise<Baseline> => ({
  scenario: scenario.id,
  frozenDate: scenario.frozenDate,
  recordedFrom: "src-next",
  cells: await new Recorder().record(),
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
  /** The recorded state and the tree disagree. */
  readonly missing: readonly string[];
}

/** Reconcile one scenario against its baseline: wire the cell, read it, compare it. */
export const reconcile = async (
  scenario: Scenario,
  baseline: Baseline,
  roster: Roster,
): Promise<Reconciliation> => {
  const recorder = new Recorder();
  const diffs: Diff[] = [];
  const gaps: string[] = [];
  const missing: string[] = [];
  for (const cell of GRID) {
    const recorded = baseline.cells[cell.id];
    if (recorded === undefined) {
      missing.push(`${cell.id}: the baseline carries no entry`);
      continue;
    }
    const row = roster.rowOf(cell.id);
    const wired = row === null ? false : producerWired(row.producer);
    if (!wired) {
      gaps.push(cell.id);
      if (recorded.state === "recorded") {
        missing.push(`${cell.id}: recorded as wired, but its producer is not resolvable`);
      }
      continue;
    }
    if (recorded.state === "gap") {
      missing.push(`${cell.id}: recorded as GAP, but its producer has landed — wire the cell`);
      continue;
    }
    if (cell.applicable === false) continue;
    const actual = await recorder.valueOf(cell);
    if (actual === recorded.value) continue;
    diffs.push({ cell: cell.id, expected: recorded.value, actual });
  }
  void scenario;
  return { diffs, gaps, missing };
};

/** The harness's self-proving arm — it must be able to fail with no new-tree producer
 *  in the tree at all. */
export class SelfProof {
  readonly #first: Record<string, RecordedCell>;
  readonly #second: Record<string, RecordedCell>;

  private constructor(first: Record<string, RecordedCell>, second: Record<string, RecordedCell>) {
    this.#first = first;
    this.#second = second;
  }

  /** Record the same corpus twice, from the same tree. */
  static async recordTwice(): Promise<SelfProof> {
    return new SelfProof(await new Recorder().record(), await new Recorder().record());
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

  /** The same comparison, with one byte of one cell's expectation flipped — the arm
   *  that proves a difference is actually seen. */
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
 *  A holder record's pid, its start instant and its uptime are facts about the process
 *  the corpus itself started: two trees driven by two fixtures can never print the same
 *  numbers, so the recording spells them as corpus constants. Everything the numbers
 *  surround — `alive` / `gone`, the takeover hint, the target-gone sentence — stays in
 *  the byte, so a liveness judgment that drifts still shows.
 *
 *  A `recorded=` digest is the record's own memory of a carrier the ENGINE wrote, and
 *  those bytes carry a write instant: the digest changes whenever the tree is
 *  materialized again. Only the recorded side is unpinnable — the `current=` side
 *  digests the tampered bytes the corpus itself plants, so it stays a pinned byte and
 *  the mismatch fact itself is never masked. */
const UNPINNED: readonly (readonly [RegExp, string])[] = [
  [/\bpid \d+/g, "pid <pid>"],
  [/\bstarted: \d{4}-\d\d-\d\dT[\d:.]+Z/g, "started: <startedAt>"],
  [/\brunning for \d+m/g, "running for <uptime>"],
  [/\brecorded=[0-9a-f]{8}/g, "recorded=<digest>"],
];

/** Replace the fixture's absolute root and the corpus's own runtime facts with the
 *  corpus constants. The engine's own decisions stay in the byte. */
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
