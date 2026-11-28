#!/usr/bin/env node
// packages/cdd-engine/src/bin.ts — the composition root.
//
// INVARIANT — the ONLY place the four slices are CONSTRUCTED. `Env` → `Documents` → `Run` →
// `Cli` are built here, once per process, and every other object arrives through a
// constructor argument; a `new Env` / `new Documents` / `new Run` / `new Cli` anywhere else in
// `src/**` is a second composition and `src/__tests__/composition.test.ts` reds on it. The
// same rule holds one level down for `env/`'s own two: `Provisioner` is built by `Env`'s
// constructor and the base artifact by `Workspace#baseOf`, so one capability has one
// instantiation path and the root never re-derives it.
//
// The one pre-command judgment lives here because it is what makes the graph constructible at
// all: a phase workspace is keyed by the target document's DECLARED `slug:`, so the argv
// target is read and its identity judged (present · legal · indexed · unique) BEFORE the
// ledger, the gate and the run exist. A target that names no workspace is answered with the
// engine's own identity refusal — exit 1, no dispatch, no writes.
//
// One invocation reads the corpus ONCE: the document world and every workspace ledger are
// built from the same listing instance, and a program board hands the ONE world to every
// phase it reads, so the cost of a board is linear in the documents it judges rather than
// the product of documents and phases.
//
// `main` is the arrow const (one call per process, argv in, exit code out) and the boot
// wrapper runs it only when this module IS the process entry, so a suite imports `main`
// without booting a CLI.
//
// Module-level exports are `Boot`, `main` and the two boot literals — zero behaviour-carrying
// bare functions.

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { type FrontMatter, frontmatterOf } from "./docs/grammar/frontmatter.ts";
import { TaskBlocks } from "./docs/grammar/task-blocks.ts";
import { isLegalSlug } from "./docs/identity/registry.ts";
import { DOC_TYPE_VALUES, type DocType } from "./docs/identity/types.ts";
import { Documents } from "./docs/index.ts";
import { TaskGraph } from "./docs/judging/task-graph.ts";
import { DocWorld } from "./docs/world.ts";
import { isThisProcess } from "./entry-guard.ts";
import { Env } from "./env/index.ts";
import type { RepoPath } from "./env/paths/root.ts";
import type { SlugIndex } from "./env/paths/slug-index.ts";
import { Clock } from "./env/process/clock.ts";
import type { PlanText } from "./env/vcs/plan-source.ts";
import { Workspace } from "./env/workspace/workspace.ts";
import { DriftStation } from "./run/advance/drift-station.ts";
import { type DocFacts, Frame } from "./run/advance/frame.ts";
import { Lifecycle } from "./run/advance/lifecycle.ts";
import { LinePhase } from "./run/advance/line-phase.ts";
import { LineRows } from "./run/advance/line-rows.ts";
import type { DocClassVerdict } from "./run/advance/next.ts";
import { Pipeline } from "./run/advance/pipeline.ts";
import { AdvanceReads, CarrierReads, type StationWording } from "./run/advance/reads.ts";
import type { RouteTarget } from "./run/advance/target-faces.ts";
import { WaveGate } from "./run/advance/wave.ts";
import { Child } from "./run/dispatch/child.ts";
import { InFlight } from "./run/dispatch/inflight.ts";
import { Authority } from "./run/gate/authority.ts";
import { PreFlight } from "./run/gate/preflight.ts";
import { Refusal } from "./run/gate/refusal.ts";
import { type BoardOutcome, type BoardReads, type DocSeat, Run } from "./run/index.ts";
import { Artifacts } from "./run/ledger/artifacts.ts";
import { RoundIdentity } from "./run/ledger/identity.ts";
import { Ledger } from "./run/ledger/ledger.ts";
import type { BaseResolution } from "./surface/commands/base.ts";
import type { TargetTypeRead } from "./surface/commands/board.ts";
import type { ParsedCommand } from "./surface/commands/declare.ts";
import { Cli } from "./surface/index.ts";
import { BriefRenderer } from "./surface/render/brief.ts";
import { PromptBandsRenderer } from "./surface/render/templates.ts";
import { Words } from "./surface/words/words.ts";

/** The base artifact's file name inside one phase workspace — the composition root owns this
 *  spelling because `EnvOptions#baseName` takes it and no slice may default it. */
const BASE_NAME = "base.json";

/** The base artifact's name as the ledger's reserved set reads it (the same literal, one
 *  binding, so the two uses cannot drift). */
export const BASE_ARTIFACT_NAME = BASE_NAME;

/** The argv flags whose value names the workspace key's source document. */
const TARGET_FLAGS: readonly string[] = ["--plan", "--spec"];

/** One target document's workspace-key verdict — the declared slug, or the refusal that names
 *  the fact the caller prints. */
type SlugVerdict =
  | { readonly kind: "ok"; readonly slug: string }
  | {
      readonly kind: "missing" | "illegal" | "duplicated" | "unreadable";
      readonly slug: string;
      readonly target: string;
    };

/** The document reads one graph is assembled over — the repo-basis text read, the index and
 *  the ONE document world this invocation built. */
interface GraphReads {
  readonly readRepo: (rel: string) => string | null;
  readonly index: SlugIndex;
  readonly documents: Documents;
  readonly world: DocWorld;
}

/** The seams a caller may substitute for one invocation — the surface's two writers and stdin
 *  read, and `env/`'s own injection points (the child seam, the provisioning step runner, the
 *  host probe and its environment view). The production boot substitutes none of them, so a
 *  capability keeps one instantiation path; a harness drives the SAME composition over
 *  hermetic substitutes instead of building a second one. */
export interface BootSeams {
  readonly io?: import("./surface/commands/declare.ts").TextStreams;
  readonly stdin?: () => string;
  readonly runner?: import("./env/process/child-runner.ts").ChildRunner;
  readonly stepRunner?: import("./env/provision/init.ts").StepRunner;
  readonly hostProbe?: import("./env/process/host.ts").HostProbe;
  readonly hostEnv?: import("./env/process/host.ts").HostEnv;
}

/**
 * Boot — the composition itself. Invariant: one process builds one graph, and every object the
 * slices receive is constructed here or by `env/`'s own two entries (see the file's header).
 *
 * Rule zero (over the 200-line class limit): the composition root is ONE graph built in one
 * place — the wiring order and the one pre-command identity judgment are the whole reason it
 * exists, and splitting it would hand each half its own copy of that order, which is the
 * defect a composition root is here to prevent.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the composition root's single entry — the zero-bare-function discipline admits no standalone functions.
export class Boot {
  /** Run one invocation: compose the graph, hand the argv to the surface, answer its code. */
  static async main(argv: readonly string[], seams: BootSeams = {}): Promise<number> {
    // The ONE word table and the ONE writer every seam below reports through: the out-of-tree
    // sink is wired HERE because `env/` reports the fact and spells no sentence. A path that
    // leaves the repository is warned about ONCE per invocation — several readers normalize the
    // same argv value (the identity gate, then the frame), and one input is one warning.
    const clock = new Clock();
    const stderr = seams.io?.stderr ?? ((text: string) => process.stderr.write(text));
    const words = new Words({ clock });
    const warned = new Set<string>();
    const env = new Env({
      baseName: BASE_NAME,
      cwd: process.cwd(),
      clock,
      outside: (rel) => {
        const outside = String(rel);
        if (warned.has(outside)) return;
        warned.add(outside);
        stderr(`${words.station("warn")} ${words.outsideRepo(outside)}\n`);
      },
      ...(seams.runner === undefined ? {} : { runner: seams.runner }),
      ...(seams.stepRunner === undefined ? {} : { stepRunner: seams.stepRunner }),
      ...(seams.hostProbe === undefined ? {} : { hostProbe: seams.hostProbe }),
      ...(seams.hostEnv === undefined ? {} : { hostEnv: seams.hostEnv }),
    });
    const index = env.paths.slugIndex((text) => Boot.declaredSlug(text));
    // The repo-basis text read: `Workspace#readText` resolves against the repository root and
    // ignores the workspace it hangs on, so the family root is the reading instance while no
    // phase is known yet.
    const family = env.workspace.at("");
    const readRepo = (rel: string): string | null => {
      const read = family.readText(rel as RepoPath);
      return read.kind === "text" ? read.value : null;
    };
    const world = Boot.worldOf(env, readRepo);
    const documents = new Documents({
      readText: (target) => family.readText(target),
      today: clock.dayOf(clock.now()),
      textWriter: (target, text) => family.writeTextAt(target, text),
      world,
    });
    const target = Boot.targetOf(argv);
    const resolved = target === null ? null : Boot.workspaceKeyOf(env, index, readRepo, target);
    const verdict = resolved !== null && typeof resolved === "object" ? resolved : null;
    // The identity gate is the DOCUMENT face's (`--spec`, and `base`, whose plan must name a
    // workspace before it can read the artifact) — the faces whose workspace key has no other
    // source. A `--plan` target's key comes from the plan read itself, so an unreadable plan
    // reaches the frame and answers that frame's own declared failure.
    const gateApplies = argv[0] !== "board" && (target?.flag === "--spec" || argv[0] === "base");
    if (verdict !== null && gateApplies) {
      stderr(`${words.station("blocked")} ${words.slugRefusal(verdict)}\n`);
      return 1;
    }
    // Every run-dependent command composes its graph over the accepted workspace key, or over
    // the family root when the target named none the engine accepts — the frame then answers
    // the failure its own read found (a plan the caller spelled, a board with no entry flag).
    const slug = Boot.needsRun(argv) ? (typeof resolved === "string" ? resolved : "") : null;
    const wiring =
      slug === null
        ? null
        : Boot.phaseRun({ env, reads: { readRepo, index, documents, world }, slug });
    const cli = new Cli({
      clock,
      host: env.process.host(),
      ...(wiring === null
        ? {}
        : { run: wiring.run, base: wiring.base, boardType: wiring.boardType }),
      documents,
      // The surface's ONE argv normalization seam — the reporting projection, so the pure
      // commands (`schema get --output skeleton <target>`) and the `--reviews` report read the
      // same out-of-tree fact the work commands' frame does.
      relative: (raw) => env.paths.root.callerPath(raw),
      stdin: seams.stdin ?? (() => readFileSync(0, "utf8")),
      provisioner: env.provision,
      ...(seams.io === undefined ? {} : { io: seams.io }),
    });
    return cli.run(argv);
  }

  /** The phase graph of one workspace key: the ledger, the line walk, the frontier, the gate
   *  and the run — every collaborator the four slices need, built once. */
  static phaseRun(parts: {
    readonly env: Env;
    readonly reads: GraphReads;
    readonly slug: string;
  }): {
    readonly run: Run;
    readonly base: (planArg: string) => BaseResolution;
    readonly boardType: TargetTypeRead;
  } {
    const { env, reads, slug } = parts;
    const clock = env.process.clock;
    const workspace = env.workspace.at(slug);
    const workspaceRel = env.paths.root.relativize(workspace.path);
    const artifacts = new Artifacts();
    const ledger = Boot.ledgerAt(env, slug, artifacts);
    const carriers = new CarrierReads({ workspace });
    const brief = new BriefRenderer();
    const lines = new LinePhase({
      facts: ledger,
      carried: (line, record) => carriers.factsOf(line, record),
      text: reads.readRepo,
      projection: (waveKey) => Boot.projectionOf(reads, env, slug, waveKey),
    });
    const pipeline = new Pipeline({
      lines,
      waves: () => ledger.waveLines(),
      docClassOf: (target) => Boot.docClassOf(reads, target),
    });
    const drift = new DriftStation({ lines, waves: pipeline });
    const frame = new Frame({
      driftedUpstream: (facts) => drift.refusalOf(facts) !== null,
      reads: {
        root: env.paths.root,
        index: () => reads.index,
        planText: (target) => Boot.planTextOf(reads.readRepo, target),
        docFacts: (target) => Boot.docFactsOf(reads.readRepo, target),
        exists: (target) => Boot.existsOf(env, target),
        insideDocs: (target) => env.paths.docs.contains(target),
      },
      lines: {
        walk: lines,
        attemptOf: (key, op, cycle) =>
          ledger.rounds(key).filter((record) => record.op === op && record.cycle === cycle).length +
          1,
        // The wave line's own task group: the derived frontier over the ledger's closure set,
        // read off the pipeline's ONE decomposition (a second frontier here would be a second
        // rule). A plan that is not ready, or a drained one, answers null and the request's own
        // group stands as the line.
        readyGroupOf: (graph) => {
          if (graph === null) return null;
          const ready = graph.frontier(pipeline.closedTasks());
          return ready.length === 0 ? null : ready.join(",");
        },
      },
    });
    const refusal = new Refusal({ root: env.workspace, clock });
    const gate = new PreFlight({
      repoRoot: env.paths.root.absolute,
      tree: env.vcs.git,
      docs: reads.documents,
      refusal,
    });
    const inflight = new InFlight({
      root: env.workspace,
      lock: env.process.lockOf({ target: path.join(env.workspace.path, InFlight.FILE) }),
      clock,
      refusal,
    });
    const child = new Child({ runner: env.process.runner, clock });
    const waveGate = new WaveGate();
    const readers = new AdvanceReads({
      paths: env.paths,
      workspace,
      clock,
      git: env.vcs.git,
      ledger,
      lines,
      carriers,
      pipeline,
      artifacts,
      documents: reads.documents,
      world: reads.world,
      brief,
      prompts: new PromptBandsRenderer(),
      wording: Boot.wordingOf(clock),
      host: () => env.process.host(),
      planText: reads.readRepo,
      baseBranch: () => Boot.baseBranchOf(workspace),
    });
    const lifecycle = new Lifecycle({
      gate,
      authority: new Authority(),
      drift,
      lineRows: new LineRows({ lines, drifts: drift }),
      inflight,
      child,
      ledger,
      reads: readers,
      waveGate,
      waveInput: (facts) => ({
        graph: facts.graph ?? TaskGraph.parse(""),
        closed: pipeline.closedTasks(),
        waves: ledger.waveLines(),
        phaseOf: (key) => lines.wavePhaseOf(key),
      }),
    });
    const board: BoardReads = {
      docFacts: (target) => Boot.docFactsOf(reads.readRepo, target),
      phases: async (charterSlug) => Boot.phaseBoards(env, reads, charterSlug),
      // The charter's own seat: its `overall` row is recorded in the PROGRAM's workspace,
      // never the phase's, so a node board reads that one line from there.
      charterSeat: (charterSlug) => Boot.seatOf(env, charterSlug),
    };
    const run = new Run({
      workspace,
      names: () => env.paths.listing.files(workspaceRel),
      artifacts,
      reserved: Boot.reservedNames(env, workspaceRel),
      gate,
      refusal,
      inflight,
      child,
      lines,
      frame,
      pipeline,
      lifecycle,
      stepReads: readers,
      briefName: (facts) => brief.name(facts),
      host: () => env.process.host(),
      board,
    });
    return {
      run,
      base: (planArg) => Boot.baseOf(env, reads, planArg),
      boardType: (parsed) => Boot.boardTypeOf(reads, parsed),
    };
  }

  /** One workspace's fact ledger — the ONE construction site of a seat's ledger, so the
   *  phase graph and a charter's `overall` row read their records through the same
   *  collaborators (the reserve set, the file listing, the artifact index). */
  static ledgerAt(env: Env, slug: string, artifacts: Artifacts): Ledger {
    const workspace = env.workspace.at(slug);
    const rel = env.paths.root.relativize(workspace.path);
    return new Ledger({
      workspace,
      names: () => env.paths.listing.files(rel),
      artifacts,
      reserved: Boot.reservedNames(env, rel),
    });
  }

  /** The charter's own seat — the `overall` row as the program's workspace records it: the
   *  rounds, their carrier paths and the carrier bytes, all on that workspace's basis. ONE
   *  construction (the seat's ledger), so the row and its carriers never come from two
   *  readings of one document. */
  static seatOf(env: Env, charterSlug: string): DocSeat {
    const workspace = env.workspace.at(charterSlug);
    // The artifact index is intentionally PER SEAT: it caches the names one workspace
    // registers, so a shared instance would answer another workspace's spellings. The
    // index a graph reads and the index a seat reads are therefore the same CLASS, not the
    // same object — see `Boot#phaseRun` for the node's own.
    const ledger = Boot.ledgerAt(env, charterSlug, new Artifacts());
    return {
      rounds: ledger.rounds("overall"),
      carrierPathOf: (record) => ledger.carrierPathOf("overall", "overall", record),
      readText: (target) => {
        const read = workspace.readText(target);
        return read.kind === "text" ? read.value : null;
      },
      // The seat's own inventory scope: the charter's `overall` line and nothing else — the
      // program's workspace records no other line this tree reads.
      observedArtifacts: () => ledger.observedArtifacts(["overall"]),
    };
  }

  /** The document world of one invocation — the scan every judgment reads through. */
  static worldOf(env: Env, readRepo: (rel: string) => string | null): DocWorld {
    return new DocWorld({
      docs: {
        overalls: env.paths.docs.at("overalls"),
        specs: env.paths.docs.at("specs"),
        plans: env.paths.docs.at("plans"),
      },
      listing: env.paths.listing,
      readText: (rel) => readRepo(rel),
    });
  }

  /** The station rows' wording — the word table's cells handed over as values, so the reads
   *  hear no render implementation. */
  static wordingOf(clock: Env["process"]["clock"]): StationWording {
    const words = new Words({ clock });
    const refusal = words.refusalWords();
    return {
      join: refusal.join,
      noHost: refusal.noHost,
      dispatchInput: refusal.dispatchInput,
      artifact: refusal.artifact,
      identityWords: (round) => words.identityWords(round),
    };
  }

  /** The workspace names the engine writes that are NOT round artifacts — the ledger's own
   *  document, the tree-level records, the base artifact, the log directory, and the WAVE
   *  brief family already on disk (a brief is the dispatch's read input, not a carrier).
   *  Only a wave dispatch lands a brief (`TargetFaces#advancesBatch`), so only the wave
   *  spine's briefs are reserved: a leftover `<document line>-brief.md` from an older engine
   *  is no name this tree writes, and it stays an observation the orphan face reports. */
  static reservedNames(env: Env, workspaceRel: RepoPath): readonly string[] {
    const existing = env.paths.listing.files(workspaceRel);
    return [
      Ledger.FILE,
      Refusal.FILE,
      InFlight.FILE,
      BASE_NAME,
      Workspace.LOGS_SEGMENT,
      ...existing.filter(Boot.isWaveBrief),
    ];
  }

  /** Whether one workspace name is a WAVE dispatch brief — the engine's own brief family
   *  (`BriefRenderer#name` over a wave frame's line key, whose word is the wave spine). A
   *  document line dispatches no brief, so any other `-brief.md` is a name this engine never
   *  writes, whatever wrote it. */
  static isWaveBrief(name: string): boolean {
    if (!name.endsWith(BRIEF_SUFFIX)) return false;
    const word = name.slice(0, -BRIEF_SUFFIX.length);
    return RoundIdentity.splitLineWord(word).kind === "wave";
  }

  /** The requested wave's task-only brief projection — the version a wave review binds today.
   *  The wave line's plan is the phase's own plan document, read through the same read face
   *  the dispatch reads. */
  static projectionOf(reads: GraphReads, env: Env, slug: string, waveKey: string): string | null {
    const plan = Boot.planOfSlug(reads, env, slug);
    if (plan === null) return null;
    const blocks = Boot.blocksOf(plan);
    if (blocks === null) return null;
    const tasks = waveKey
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((task) => Number.isInteger(task));
    try {
      return new BriefRenderer().taskBody(plan, blocks, tasks);
    } catch {
      return null;
    }
  }

  /** One phase slug's plan text, or null when the index holds no plan for it. */
  static planOfSlug(reads: GraphReads, env: Env, slug: string): string | null {
    void env;
    for (const rel of Boot.indexedRels(reads.index, slug)) {
      if (Boot.docTypeOf(reads.readRepo(rel)) !== "plan") continue;
      return reads.readRepo(rel);
    }
    return null;
  }

  /** Every indexed coordinate one slug declares. */
  static indexedRels(index: SlugIndex, slug: string): readonly RepoPath[] {
    const entry = index.lookup(slug);
    if (entry.kind === "unique") return [entry.rel];
    return entry.kind === "invalid" ? entry.rels : [];
  }

  /** The base artifact's read/write resolution over one argv `--plan`. */
  static baseOf(env: Env, reads: GraphReads, planArg: string): BaseResolution {
    const rel = env.paths.root.callerPath(planArg);
    const verdict = Boot.verdictOf(reads.index, reads.readRepo, rel, reads.readRepo(rel));
    if (verdict.kind !== "ok") {
      return {
        kind: "refused",
        outcome: { kind: "usage", reason: { kind: "read-failure", target: String(rel) } },
      };
    }
    return {
      kind: "resolved",
      target: { artifact: env.workspace.at(verdict.slug).baseOf(), plan: rel },
    };
  }

  /** The board's entry-document type — the document's OWN declared `doc-type:`, never the
   *  flag's spelling. A document declaring none reads as the plan face (the board's widest
   *  reading). */
  static boardTypeOf(reads: GraphReads, parsed: ParsedCommand): DocType {
    const named = parsed.args.spec ?? parsed.args.plan;
    if (named === undefined) return "plan";
    return Boot.docTypeOf(reads.readRepo(named as RepoPath)) ?? "plan";
  }

  /** Every phase a charter groups — the identity documents whose declared `program:` names
   *  the charter slug, in program order (`-p<major>[.<minor>]` numerically, then rel order),
   *  each with its OWN board read. A document that declares no `program:` belongs to no
   *  charter, so it contributes no phase row. */
  static async phaseBoards(
    env: Env,
    reads: GraphReads,
    charterSlug: string,
  ): Promise<readonly { readonly slug: string; readonly board: BoardOutcome }[]> {
    const phases: {
      readonly slug: string;
      readonly rel: RepoPath;
      readonly ordinal: readonly number[] | null;
    }[] = [];
    for (const slug of reads.index.slugs()) {
      for (const rel of Boot.indexedRels(reads.index, slug)) {
        const head = Boot.headOf(reads.readRepo(rel) ?? "");
        if (head === null || head.program !== charterSlug) continue;
        const declared = head.docType;
        if (declared === "plan" || declared === null) continue;
        phases.push({ slug, rel, ordinal: Boot.phaseOrdinalOf(slug) });
      }
    }
    const boards: { slug: string; board: BoardOutcome }[] = [];
    for (const phase of phases.sort(Boot.phaseCompare)) {
      const own = Boot.phaseRun({ env, reads, slug: phase.slug });
      const board = await own.run.boardOf({
        command: "board",
        type: (Boot.docTypeOf(reads.readRepo(phase.rel)) ?? "phase-spec") as DocType,
        spec: String(phase.rel),
      });
      boards.push({ slug: phase.slug, board });
    }
    return boards;
  }

  /** The phase ordinal a slug carries in its `-p<major>[.<minor>…]` tail, or null. */
  static phaseOrdinalOf(slug: string): readonly number[] | null {
    const match = /-p(\d+(?:\.\d+)*)$/.exec(slug);
    return match === null ? null : match[1].split(".").map(Number);
  }

  /** Program order: numbered slugs numerically, then the unnumbered, rel as the tie-break. */
  static phaseCompare(
    left: { readonly rel: RepoPath; readonly ordinal: readonly number[] | null },
    right: { readonly rel: RepoPath; readonly ordinal: readonly number[] | null },
  ): number {
    if (left.ordinal !== null && right.ordinal !== null) {
      const width = Math.max(left.ordinal.length, right.ordinal.length);
      for (let index = 0; index < width; index += 1) {
        const delta = (left.ordinal[index] ?? 0) - (right.ordinal[index] ?? 0);
        if (delta !== 0) return delta;
      }
    } else if (left.ordinal !== null) {
      return -1;
    } else if (right.ordinal !== null) {
      return 1;
    }
    return left.rel < right.rel ? -1 : left.rel > right.rel ? 1 : 0;
  }

  /** Whether one repo-relative target is present on disk — derived from the ONE listing read. */
  static existsOf(env: Env, target: RepoPath): boolean {
    const segments = target.split("/");
    const name = segments.pop() ?? "";
    if (name.length === 0) return false;
    return env.paths.listing.names(segments.join("/") as RepoPath).includes(name);
  }

  /** The plan read of one coordinate — the declared read failure on an unreadable target. */
  static planTextOf(readRepo: (rel: string) => string | null, rel: RepoPath): PlanText {
    const text = readRepo(rel);
    if (text === null) return { kind: "read-failure", target: rel };
    return { kind: "text", target: rel, value: text };
  }

  /** One document's declared identity facts, or null when it cannot be read. */
  static docFactsOf(readRepo: (rel: string) => string | null, rel: RepoPath): DocFacts | null {
    const text = readRepo(rel);
    if (text === null) return null;
    const head = Boot.headOf(text);
    if (head === null) return null;
    const declared = head.docType;
    return {
      slug: head.slug,
      docType:
        declared !== null && (DOC_TYPE_VALUES as readonly string[]).includes(declared)
          ? (declared as DocType)
          : null,
      program: head.program,
      version: head.version,
      // The declared status is a head value, not a typed getter: the charter's own
      // `status:` is an arbitrary scalar, and the board prints it verbatim.
      status: head.value("status"),
      title: head.title,
    };
  }

  /** The pipeline's doc-class discrimination of one render target — the doc shapes read their
   *  DECLARED type, the node shapes key by their own word. */
  static docClassOf(reads: GraphReads, target: RouteTarget): DocClassVerdict {
    if (target.type === "plan") return "plan";
    if (target.type === "wave") return "wave";
    if (target.type === "branch") return "branch";
    const declared = Boot.docTypeOf(reads.readRepo(target.id as RepoPath));
    return declared ?? "blocked";
  }

  /** One document's declared type, narrowed to the declared vocabulary. */
  static docTypeOf(text: string | null): DocType | null {
    if (text === null) return null;
    const declared = Boot.headOf(text)?.docType ?? null;
    if (declared === null || !(DOC_TYPE_VALUES as readonly string[]).includes(declared)) {
      return null;
    }
    return declared as DocType;
  }

  /** One document's declared slug, or null when the head declares none. */
  static declaredSlug(text: string): string | null {
    return Boot.headOf(text)?.slug ?? null;
  }

  /** One document's typed head; null when the head cannot be parsed (a broken head declares no
   *  identity — the refusal's own case, never a crash). */
  static headOf(text: string): FrontMatter | null {
    try {
      return frontmatterOf(text).head;
    } catch {
      return null;
    }
  }

  /** The task blocks of one plan text, or null when the grammar breaks. */
  static blocksOf(text: string): TaskBlocks | null {
    try {
      return TaskBlocks.parse(text, "plan");
    } catch {
      return null;
    }
  }

  /** The base artifact's branch name of one workspace, "" when absent. */
  static baseBranchOf(workspace: Workspace): string {
    const read = workspace.readJson(BASE_NAME);
    if (read.kind !== "ok") return "";
    const base = (read.value as { base?: unknown } | null)?.base;
    return typeof base === "string" ? base : "";
  }

  /** The uniqueness ROLE of one declared document type: the four identity shapes share one
   *  role, the plan alone forms the other (a phase's registration is one of each). */
  static roleOf(declared: string | null): "identity" | "plan" {
    return declared === "plan" ? "plan" : "identity";
  }

  /** The workspace key of one argv target document, or the refusal that names the fact. */
  static workspaceKeyOf(
    env: Env,
    index: SlugIndex,
    readRepo: (rel: string) => string | null,
    target: { readonly value: string },
  ):
    | string
    | {
        readonly kind: "missing" | "illegal" | "duplicated" | "unreadable";
        readonly slug: string;
        readonly target: string;
      } {
    const rel = env.paths.root.callerPath(target.value);
    const verdict = Boot.verdictOf(index, readRepo, rel, readRepo(rel));
    return verdict.kind === "ok"
      ? verdict.slug
      : { kind: verdict.kind, slug: verdict.slug, target: verdict.target };
  }

  /** The four-way identity judgment of one target document: a declared slug, inside the
   *  grammar, indexed, and unique. */
  static verdictOf(
    index: SlugIndex,
    readRepo: (rel: string) => string | null,
    rel: RepoPath,
    text: string | null,
  ): SlugVerdict {
    if (text === null) return { kind: "unreadable", slug: "", target: String(rel) };
    const head = Boot.headOf(text);
    const slug = head?.slug ?? null;
    if (slug === null) return { kind: "missing", slug: "", target: String(rel) };
    if (!isLegalSlug(slug)) return { kind: "illegal", slug, target: String(rel) };
    const entry = index.lookup(slug);
    if (entry.kind === "absent") return { kind: "missing", slug: "", target: String(rel) };
    // Uniqueness is judged per ROLE, never over the whole document set: one identity document
    // and one plan may share a slug (that IS a phase's registration), while a second identity
    // document or a second plan makes the slug ambiguous.
    const role = Boot.roleOf(head?.docType ?? null);
    const sameRole = Boot.indexedRels(index, slug).filter(
      (candidate) => Boot.roleOf(Boot.headOf(readRepo(candidate) ?? "")?.docType ?? null) === role,
    );
    return sameRole.length > 1
      ? { kind: "duplicated", slug, target: String(rel) }
      : { kind: "ok", slug };
  }

  /** The invocation's target document — the `--spec` value when one is named (the document
   *  face's own key source), else the `--plan` value. Null when the argv names neither. */
  static targetOf(
    argv: readonly string[],
  ): { readonly flag: string; readonly value: string } | null {
    const found = new Map<string, string>();
    for (let at = 0; at < argv.length; at += 1) {
      const word = argv[at];
      if (word === undefined || !TARGET_FLAGS.includes(word)) continue;
      const value = argv[at + 1];
      if (value !== undefined && !value.startsWith("-") && !found.has(word)) found.set(word, value);
    }
    for (const flag of ["--spec", "--plan"]) {
      const value = found.get(flag);
      if (value !== undefined) return { flag, value };
    }
    return null;
  }

  /** Whether one invocation reads the phase graph — the six commands whose bodies consult the
   *  ledger, the gate or the documents through it. `schema`, `issue` and `init` do not. */
  static needsRun(argv: readonly string[]): boolean {
    return ["implement", "review", "fix", "board", "base"].includes(argv[0] ?? "");
  }
}

/** The brief's name suffix — the `-brief.md` family the reserved set excludes from the orphan
 *  judgment (a brief is the dispatch's read input, never a carrier). */
const BRIEF_SUFFIX = "-brief.md";

/** The CLI entry — argv in, exit code out. `seams` substitutes the boundary faces only: the
 *  four slices are still constructed in one place. */
export const main = async (argv: readonly string[], seams: BootSeams = {}): Promise<number> =>
  Boot.main(argv, seams);

/** Whether this module IS the process entry (a suite importing `main` never boots). */
const isEntry = isThisProcess(import.meta.url);

/** The boot — one call per process, its failures mapped to the engine's one exit-1 face. */
if (isEntry) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (raw) {
    process.stderr.write(`cdd: ${raw instanceof Error ? raw.message : String(raw)}\n`);
    process.exit(1);
  }
}
