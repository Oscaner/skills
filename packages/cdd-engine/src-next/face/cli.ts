// packages/cdd-engine/src-next/face/cli.ts
// T11 + T8 — the command face + composition root (design spec §3.3: the cdd CLI
// command surface — implement / review / fix / schema / issue / base / board — is
// kept as a steady word face; T20 converges the base command face to `base` and T5
// adds the board observability command — the seven-command surface). This module is
// the new tree's composition root: the
// `Cli.create` static factory — the class face is the entry, the module carries zero
// bare functions (the composition root's deliberate class form) — wires the contract /
// session / face objects into the ONE CLI the bin thin entry boots. Task 3 (P1)
// reorganized the face into one boundary per responsibility — the CLI declaration
// single surface (face/declare.ts, §2.4 — the seven subcommand rows + the argv
// channel), the declaration projection (face/projection.ts — the CommandTreeBuilder
// whose commander program OWNS the parse + help + validation pipeline), and the run
// face; the typed argv parse channel (face/argv.ts) was deleted at T6 — the parse
// handover to commander is total, and the domain-run error face's usage is
// commander's own byte.
//
// Task 8 (the split contract §6.2) slimmed this module to the COMPOSITION RESPONSIBILITY:
// wire + exit + parse, plus the work/pure command run bodies that ASSEMBLE the scene.
// The domain faces live in their own files and are composed through here —
// face/lifecycle.ts (CliLifecycle — the dispatch + readback + round-context plane:
// implement/review/fix dispatch, the read-back reconstruct, the round-context fact
// assembly; the pre-split HarnessDispatch member renamed, re-exported unchanged
// below), face/gate.ts (CliGate — the target/line gate family: the readiness
// judgments + the doc line's revision-aware BLOCK/pending-fix faces), face/artifacts.ts
// (CliArtifacts — the pure-command domain: schema get / issue / base runs). The root
// Cli holds the three instances and composes through them via its .action thin shells
// (zero bare functions; the seams it still assembles — the lifecycle dispatch seam's
// production default construction — stay here).
//
//   · runArgv — parse through the commander program (face/projection.ts), dispatch
//     each parsed command through an .action thin shell (the parseArg-normalized
//     values ride into the domain run as its consumed values, zero rewriting) and
//     normalize the exit-code surface from the thrown CommanderError (0 = help/OK ·
//     2 = usage (incl. the preAction conditional-required) · 1 = run failure).
//   · the .action thin shells — the work commands (implement / review / fix)
//     assemble the lifecycle (session/run), the capsule + words (face), the ledger
//     (session/ledger) and the task graph (contract parse) and advance the
//     requested phase; schema / issue / base run their pure artifact surfaces
//     through the same assembled objects (the pure runs + the readiness gates
//     delegate to the split faces above — the root orchestrates, never re-types).

// Module-level exports are types / constant data / classes — zero behavior-carrying
// bare functions (the composition root is the Cli class's static create factory).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { type Command, CommanderError } from "commander";
import { declaredRegistries } from "../contract/declare.ts";
import { PlanDocType } from "../contract/doc.ts";
import { Contract } from "../contract/judge.ts";
import type { DocKey } from "../contract/project.ts";
import { Projector } from "../contract/project.ts";
import { Translator } from "../contract/translate.ts";
import { ConfigLoader } from "../infra/config.ts";
import { GitClient } from "../infra/git.ts";
import { type RepoPath, RepoRoot } from "../infra/root.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { BriefRenderer } from "../render/brief.ts";
import { IssueBodyRenderer } from "../render/issue-body.ts";
import { TemplateAssembler } from "../render/templates.ts";
import type { TargetFace, TargetType } from "../session/faces.ts";
import { targetFaces } from "../session/faces.ts";
import { TaskGraph } from "../session/graph.ts";
import type { RoundStatus } from "../session/ledger.ts";
import { Ledger } from "../session/ledger.ts";
import { NextStepRouter } from "../session/next.ts";
import type { PreFlightVerdict } from "../session/preflight.ts";
import { PreFlight } from "../session/preflight.ts";
import type { DispatchStep, RunState } from "../session/run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../session/run.ts";
import { CliArtifacts } from "./artifacts.ts";
import { BoardView } from "./board-view.ts";
import { Capsule } from "./capsule.ts";
import { ARGV_CHANNEL, type CliLeafName, type CliVerb } from "./declare.ts";
import { CliGate } from "./gate.ts";
import { GraphView } from "./graph-view.ts";
import { HostDetect } from "./host.ts";
import {
  type CliIo,
  CliLifecycle,
  type DispatchScene,
  type SyncProcess,
  SyncRunner,
} from "./lifecycle.ts";
import { CommandTreeBuilder } from "./projection.ts";
import { Words } from "./words.ts";

// ---------------------------------------------------------------------------
// the re-exported seams + the dispatch production default — the split contract's
// lifecycle face owns the dispatch/readback plane (face/lifecycle.ts) and the
// shared seams it rides; the composition root re-exports them here unchanged so
// the module's public surface never drifts (CliIo · SyncProcess · SyncRunner ·
// ProcessEnvLike · DispatchScene · BaseArtifact · HarnessDispatch).
// ---------------------------------------------------------------------------

export type { BaseArtifact } from "./artifacts.ts";
export type {
  CliIo,
  DispatchScene,
  ProcessEnvLike,
  SyncProcess,
} from "./lifecycle.ts";
export {
  CliLifecycle as HarnessDispatch,
  SyncRunner,
} from "./lifecycle.ts";
/** The composition options — every collaborator injectable (tests substitute the
 *  hermetic ones: io / dispatch / stdin); the production defaults wire the living
 *  process. The repo root is NEVER injectable (T2): it derives from the ONE
 *  conversion point (the git top level of the working directory — §2.4/§2.6). */
export interface CliOptions {
  io?: CliIo;
  config?: ConfigLoader;
  projector?: Projector;
  words?: Words;
  translator?: Translator;
  git?: GitClient;
  sync?: SyncProcess;
  dryRun?: boolean;
  dispatch?: DispatchStep | null;
  preflight?: PreFlight;
  template?: TemplateAssembler;
  brief?: BriefRenderer;
  stdinRead?: () => string;
}

/** One work command's assembled scene — the composition the run body advances. */
export interface WorkScene extends DispatchScene {
  planText: string | null;
  type: TargetType;
  face: TargetFace;
  target: { kind: "branch" } | { kind: "doc"; doc: string } | null;
  state: RunState;
  router: NextStepRouter;
  /** The plan's `**Spec:**` header link target (plan docs only) — the plan-review
   *  round context's spec anchor; null off the plan face. */
  specLink: string | null;
}

/** The thin-shell → run-body input — the .action shell maps commander's parsed
 *  opts onto this consumption face (the parseArg-normalized values ride through
 *  verbatim, zero rewriting: int-list → the comma string · enum → the value · sha
 *  → the short form · the schema <type> → the parseTypeKey normalization). The
 *  CLI's parse-result face retired with the argv channel at T6 — commander owns
 *  the parse; this seam is the run face's own shape, never a parallel parse
 *  product. */
export interface RunInput {
  /** The nested leaf word (schema get|gen · base set|get) — null on the verbs. */
  leaf: CliLeafName | null;
  /** The declared keys' values — normalized strings (undefined-flagged keys absent). */
  args: Record<string, string>;
  /** The positional values (the schema <type> — the parseTypeKey-normalized key). */
  positionals: readonly string[];
  /** The invocation's synthetic-dispatch scope (the --dry-run program flag). */
  dryRun: boolean;
}

/**
 * The Cli — the command face's parse/run surface over the assembled object graph.
 * runArgv() parses through the commander program and rejects unknown flags (the
 * unknown-flag semantics); run() dispatches to the command's run body — the work verbs
 * compose the lifecycle/capsule/ledger/graph and advance the requested phase, the
 * pure verbs run their artifact surfaces through the same assembled objects.
 */
export class Cli {
  readonly #io: CliIo;
  readonly #config: ConfigLoader;
  readonly #projector: Projector;
  readonly #words: Words;
  readonly #git: GitClient;
  readonly #sync: SyncProcess;
  readonly #dryRun: boolean;
  readonly #dispatch: DispatchStep | null;
  readonly #template: TemplateAssembler;
  readonly #brief: BriefRenderer;
  readonly #stdinRead: () => string;
  readonly #issue: IssueBodyRenderer;
  readonly #translator: Translator;
  /** The pre-flight board face (the blocked-dispatch wave hint). */
  readonly #graphView: GraphView;
  /** The lifecycle pre-flight seam (P4.1 T1) — the single dispatch gate the work
   *  commands consult before ANY child dispatch (tree-clean → graph → wave →
   *  doc-contract; the CLI orchestrates the call + the render, never a re-type). */
  readonly #preflight: PreFlight;
  /** The contract coordinator — the doc-contract judgment face the pre-flight's
   *  doc gate reads (the single interpreter entry; spec §12 · D34 retired the
   *  filename→type derivation — the doc type is now the declared header fact read
   *  through BoardView.readDocType). */
  readonly #contract: Contract;
  /** The commander command tree — the declaration projection (CommandTreeBuilder,
   *  face/projection.ts): the domain-run error face's usage byte is the command
   *  node's commander-native helpInformation() first line (the self-built usage
   *  corpus is retired; the T3 rebuild closes the parse face onto the same
   *  program). */
  readonly #program: Command;
  /** The target/line gate family (T8 — the split contract's gate face,
   *  face/gate.ts): the work commands' readiness judgments (line phase / review
   *  convergence BLOCKs) + the group/line helpers. */
  readonly #gate: CliGate;
  /** The pure-command domain (T8 — the split contract's artifacts face,
   *  face/artifacts.ts): the schema/issue/base run bodies. */
  readonly #artifacts: CliArtifacts;

  constructor(opts: CliOptions = {}) {
    this.#io = opts.io ?? {
      stdout: (t) => process.stdout.write(t),
      stderr: (t) => process.stderr.write(t),
    };
    this.#config = opts.config ?? new ConfigLoader();
    this.#words = opts.words ?? new Words();
    this.#projector = opts.projector ?? new Projector(declaredRegistries);
    this.#program = new CommandTreeBuilder().program;
    this.#wireTreeOutput(this.#program);
    this.#wireActions();
    this.#git = opts.git ?? new GitClient();
    this.#sync = opts.sync ?? new SyncRunner();
    this.#dryRun = opts.dryRun ?? false;
    this.#dispatch = opts.dispatch ?? null;
    this.#template = opts.template ?? new TemplateAssembler();
    this.#brief = opts.brief ?? new BriefRenderer();
    this.#stdinRead = opts.stdinRead ?? (() => readFileSync(0, "utf8"));
    this.#translator = opts.translator ?? new Translator(this.#words);
    this.#issue = new IssueBodyRenderer(this.#words, this.#translator);
    this.#graphView = new GraphView();
    this.#contract = new Contract();
    this.#preflight =
      opts.preflight ??
      new PreFlight({
        git: this.#git,
        contract: this.#contract,
        words: this.#words,
      });
    this.#gate = new CliGate({ brief: this.#brief });
    this.#artifacts = new CliArtifacts({
      io: this.#io,
      projector: this.#projector,
      issue: this.#issue,
      stdinRead: this.#stdinRead,
      usage: (node, message) => this.#usage(node, message),
    });
  }

  // ---------------------------------------------------------------------------
  // the commander parse pipeline — the composition root parses through the
  // projection's program (T3): the .action thin shells (below) dispatch the parsed
  // command to its domain run; the exit-code discriminator maps the CommanderError
  // surface (§3.1 — probe-verified v0.9): help exit 0 / helpDisplayed → 0 · help
  // non-zero (bare run · missing subcommand · help <bogus>) + usage-class codes →
  // 2 · an unexpected throw → 1.
  // ---------------------------------------------------------------------------

  /** runArgv(argv) — the CLI face: parse through the commander program, return the
   *  thin shell's domain-run exit code (0 = success/help · 2 = usage · 1 = run
   *  failure — the steady exit-code table). Every commander/normal usage error
   *  discriminates on the thrown CommanderError: the help display faces write
   *  themselves through the node's configured output (the CLI never re-types a
   *  help byte), the parse/usage rejections carry commander's own "error: " line
   *  (never double-written), and the preAction conditional-required rejection (the
   *  one commander throws unwritten) is surfaced by the run face. */
  async runArgv(raw: readonly string[]): Promise<number> {
    try {
      this.#exitCode = 0;
      await this.#program.parseAsync([...raw], { from: "user" });
      return this.#exitCode;
    } catch (err) {
      return this.#normalizeExit(err);
    }
  }

  /** The exit-code discriminator — the CommanderError surface (§3.1): the explicit
   *  help faces exit 0, the missing-command/missing-subcommand faces ride the help
   *  code's non-zero exit → 2, the usage-class codes (unknown option/command ·
   *  invalid argument (incl. the preAction conditional-required) · excess args ·
   *  missing required) → 2, an unexpected error → 1. */
  #normalizeExit(err: unknown): number {
    if (err instanceof CommanderError) {
      if (err.code === "commander.help") return err.exitCode === 0 ? 0 : 2;
      if (err.code === "commander.helpDisplayed") return 0;
      // usage-class — commander's own error() already wrote its "error: ..." line
      // (the parseArg/unknown surfaces); the preAction hook's InvalidArgumentError
      // and the run bodies' #usage throw are both thrown unwritten — the run face
      // surfaces them once.
      if (!err.message.startsWith("error: ")) this.#io.stderr(`error: ${err.message}\n`);
      return 2;
    }
    this.#io.stderr(`cdd: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  /** The domain-run usage error — a usage rejection raised inside a run body:
   *  commander's OWN CommanderError (never a second error type — the retired
   *  parse-channel error class is deleted at T6), which the normalizeExit
   *  discriminator above surfaces with the native "error:" byte and exit 2 (§3.1).
   *  The usage byte is the owning command node's commander-native
   *  helpInformation() first line (the declaration's help face — the self-built
   *  usage corpus never returned here); the throw carries only the message. */
  #usage(node: Command, message: string): never {
    const usageLine = node.helpInformation().split("\n")[0];
    if (usageLine !== "") this.#io.stderr(`${usageLine}\n`);
    throw new CommanderError(2, "cdd.usage-error", message);
  }

  /** The per-invocation exit code the thin shells capture (commander discards the
   *  action's return — parseAsync resolves with the program node, so the shell
   *  writes the domain-run's code here and runArgv reads it back). */
  #exitCode = 0;

  /** The .action thin shells — the parsed command → its domain run: build the
   *  run input from commander's parsed opts (parseArg-normalized values pass
   *  through as the domain's consumed values — no rewrite, §3.3) and dispatch to
   *  the domain run, capturing the exit code. */
  #wireActions(): void {
    const commandNode = (name: CliVerb) => this.#program.commands.find((c) => c.name() === name)!;
    const leafNode = (parent: CliVerb, name: CliLeafName) =>
      commandNode(parent).commands.find((c) => c.name() === name)!;

    // the work verbs — implement / review / fix compose the domain run
    for (const verb of ["implement", "review", "fix"] as const) {
      commandNode(verb).action(async (_opts: unknown, command: Command) => {
        this.#exitCode = await this.#runWork(verb, command, this.#runInput(null, command));
      });
    }
    // the pure commands' leaves — schema get · base set/get · issue render
    leafNode("schema", "get").action(
      async (_type: unknown, _target: unknown, _opts: unknown, command: Command) => {
        this.#exitCode = await this.#runSchema(command, this.#runInput("get", command));
      },
    );
    leafNode("base", "set").action(async (_opts: unknown, command: Command) => {
      this.#exitCode = await this.#runBase(command, this.#runInput("set", command));
    });
    leafNode("base", "get").action(async (_opts: unknown, command: Command) => {
      this.#exitCode = await this.#runBase(command, this.#runInput("get", command));
    });
    leafNode("issue", "render").action(async () => {
      this.#exitCode = this.#artifacts.runIssue();
    });
    // the board observability command — a pure read (no preflight gate)
    commandNode("board").action(async (_slug: unknown, _opts: unknown, command: Command) => {
      this.#exitCode = await this.#runBoard(command, this.#runInput(null, command));
    });
  }

  /** `cdd board <slug>` — the slug progress board (spec §5 · §2.2): a PURE READ —
   *  zero preflight gate, zero tree writes, zero ledger writes, zero child dispatch.
   *  The slug (the one positional) resolves the repo root, assembles the node tree
   *  and renders the phase/program board + the `next:` derivation to stdout. A
   *  missing slug is a usage error (exit 2, commander's own byte); a slug matching
   *  nothing on disk renders the not-found face and exits 2; a present doc line
   *  carrying no `- **Doc type**:` declaration renders its BLOCKED marker and exits 2
   *  (spec §12 · D34). The host is detected once for the pipeline-entry ref render
   *  (REFS[ref][host], the same judgment the capsule injects — never hard-coded). */
  async #runBoard(node: Command, parsed: RunInput): Promise<number> {
    const slug = parsed.positionals[0];
    if (slug === undefined) this.#usage(node, "cdd board: missing <slug>");
    const repoRoot = await this.#rootOf();
    if (repoRoot === null) return 1;
    if (!BoardView.hasNode(slug, repoRoot)) {
      this.#io.stderr(`cdd board: no docs match slug ${slug}\n`);
      return 2;
    }
    const host = HostDetect.detect(process.env);
    const board = BoardView.render(slug, repoRoot, this.#words, host, ARGV_CHANNEL);
    for (const line of board.lines) this.#io.stdout(`${line}\n`);
    return board.exitCode;
  }

  /** The thin shell's run input — commander's parsed opts mapped to the domain
   *  run's consumption face (the parseArg-normalized values ride through verbatim:
   *  int-list → the comma string · enum → the value · sha → the short form · the
   *  schema <type> → the parseTypeKey normalization), plus the positionals
   *  (processedArgs) and the program-scope dry-run (optsWithGlobals — the flag
   *  lives on the program node, merged here). The args read GLOBALS too: a flag
   *  declared on the parent command (schema's --plan) is consumed by that node —
   *  the leaf's own opts would miss it. */
  #runInput(leaf: CliLeafName | null, command: Command): RunInput {
    const globals = command.optsWithGlobals() as Record<string, unknown>;
    const args: Record<string, string> = {};
    for (const [key, value] of Object.entries(globals)) {
      if (value === undefined) continue;
      args[key] = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
    }
    return {
      leaf,
      args,
      positionals: command.processedArgs as string[],
      dryRun: this.#dryRun || globals.dryRun === true,
    };
  }

  /** Configure every node's output into the injected io (commander writes its
   *  help/error bytes through the node that produced them — a subcommand's help
   *  uses the subcommand's own output configuration, so the whole tree must be
   *  wired, never just the program). */
  #wireTreeOutput(node: Command): void {
    node.configureOutput({
      writeOut: (text) => this.#io.stdout(text),
      writeErr: (text) => this.#io.stderr(text),
    });
    for (const child of node.commands) this.#wireTreeOutput(child);
  }

  // ---------------------------------------------------------------------------
  // the work commands — lifecycle/capsule/ledger composition + the phase advance
  // ---------------------------------------------------------------------------

  /** One work command's run — assemble the scene, advance the requested phase (the
   *  lifecycle's single dispatch step per frame), render the capsule lines. */
  async #runWork(verb: CliVerb, node: Command, raw: RunInput): Promise<number> {
    const type = (raw.args.type ?? "wave") as TargetType;
    if (type === "wave" && raw.args.tasks === undefined) {
      this.#usage(node, `cdd ${verb} --type wave: missing required --tasks <n|n,n,…>`);
    }
    // The repo root (the ONE conversion point, T2) + the input funnel (T3 §2.3) run
    // FIRST — before the scene or any downstream face reads a path arg, so the whole
    // run (scene + ledger + dispatch `--findings`) speaks ONE normalized argv shape.
    const repoRoot = await this.#rootOf();
    if (repoRoot === null) return 1;
    const root = new RepoRoot(repoRoot);
    const parsed = this.#funnel(root, raw);
    const scene = await this.#sceneOf(verb, type, node, root, parsed);
    if (scene === null) return 1;

    // THE pre-flight seam (P4.1 T1 · design §1): the single dispatch gate —
    // tree-clean → graph → wave → doc-contract — ONE call, the whole sequence
    // lives in the seam (session/preflight.ts), the CLI only orchestrates the call
    // + the verdict render (zero re-implemented gate here). A refused verdict
    // returns before any brief/lifecycle: no child dispatch ever runs. The
    // dirty-tree / doc-contract refusals ride the CDD_BLOCKED channel; the
    // graph / wave refusals keep the pre-existing refusal face. The doc-face read
    // path is the repoRoot-relative branded `RepoPath` (T4 §2.2 — a bare `string`
    // never reaches the read faces `BoardView.readDocType`/`PreFlightDoc.path`; the
    // CLI feeds the funnel-shaped relative value, each read face erasing to the
    // absolute syscall form through its OWN `RepoRoot`).
    const docRel = (
      scene.target !== null && scene.target.kind === "doc" ? root.relativize(scene.target.doc) : ""
    ) as RepoPath;
    const preflight = await this.#preflight.vet({
      verb: verb as "implement" | "review" | "fix",
      type,
      repoRoot: scene.workspace.root.repoRoot,
      planText: scene.planText,
      tasks: type === "wave" ? new Set(this.#gate.tasksOf(parsed)) : null,
      ledger: scene.ledger,
      doc:
        type === "spec" || type === "plan"
          ? {
              // The ONE declaration reading face (spec §12 · D34) — both the spec and
              // the plan dispatch read the doc's `- **Doc type**:` header declaration;
              // a declaration-less doc reads null and the seam BLOCKs (zero command-type
              // carve-out, zero filename-suffix fallback).
              docKey: BoardView.readDocType(root, docRel),
              path: docRel,
            }
          : null,
    });
    if (!preflight.ok) {
      this.#renderPreflightBlocked(verb, preflight, scene);
      return 1;
    }

    // The unconditional extract (§4.1): every wave-face dispatch re-renders the
    // brief from the CURRENT plan text — implement, review and fix alike (a
    // mid-run plan amendment reflects into the next dispatch; no "exists → leave
    // it" reuse). The doc/branch faces carry no wave brief (planText is null there).
    if (type === "wave" && scene.planText !== null)
      scene.briefPath = this.#gate.renderBrief(scene, parsed);
    const expected =
      verb === "implement" ? "implement" : verb === "fix" ? "fix" : scene.face.product.reviewLead;

    // The per-invocation batch cursor: the in-memory done set mirrors the on-disk
    // ledger's closed waves (the C5 closure single face) — NOT a "every non-group
    // task pre-done" shortcut. The old shortcut made the frontier yield exactly the
    // requested group, but it also emptied readyBatch() at every closure: a mid-run
    // wave's fix rendered `next: done` instead of the next wave (the {16,22,24} →
    // {25,26,27} bug — the closure routing judged a per-invocation cursor, not the
    // plan's real remaining frontier). The ledger mirror keeps the progress face
    // cross-invocation: the dispatched group's own closure marks in #markTerminal
    // as the loop advances, and the next wave surfaces from the live closed set.
    let group: Set<number> | null = null;
    if (type === "wave") {
      group = new Set(this.#gate.tasksOf(parsed));
      const planIds =
        scene.planText !== null
          ? new PlanDocType("plan")
              .parse(scene.planText.split("\n"))
              .taskBlocks.map((block) => block.id)
          : [];
      for (const id of group) {
        if (!planIds.includes(id)) {
          this.#usage(node, `cdd ${verb}: task ${id} not found in the plan`);
        }
      }
      for (const id of scene.ledger.closedWaves()) scene.state.markDone(id);
    }

    const statuses: (RoundStatus | null)[] = [];
    const dispatch: DispatchStep = this.#dispatchOf(scene, parsed);
    const run = new Lifecycle({
      face: scene.face,
      state: scene.state,
      ledger: scene.ledger,
      router: scene.router,
      // The dispatch-entry pre-flight wiring (P4.1 T1): the single seam verdict the
      // work command computed rides the lifecycle's gate — a refused frame is
      // structurally never passed to the child (the lifecycle's hard "child zero-dispatch"
      // guarantee; the CLI already returned above when the seam refused).
      preflight: { gate: () => (preflight.ok ? null : preflight) },
      dispatch: (frame) => {
        const outcome = dispatch(frame);
        statuses.push(outcome.status ?? null);
        return outcome;
      },
      target: scene.target ?? undefined,
      capsule: new Capsule(
        this.#words,
        ARGV_CHANNEL,
        HostDetect.detect(process.env),
        new RepoRoot(scene.workspace.root.repoRoot),
      ),
      planPath: scene.planPath,
    });

    // The requested-phase gate — the line faces (branch/spec/plan) keep the
    // line-phase readiness check; the task face needs no second gate (the WaveGate's
    // wrong-phase verdict above IS the phase authority for the requested wave).
    if (group === null) {
      const { phase: open, verdict, reviewed } = this.#gate.lineGate(scene);
      if (open !== expected) {
        const pendingBlock =
          verdict === "pending-fix" ? this.#gate.pendingFixBlock(scene, reviewed) : null;
        const docBlock = open === null ? this.#gate.docLineBlock(scene, reviewed) : null;
        this.#io.stderr(
          `cdd ${verb}: cannot dispatch a ${expected} round — ${pendingBlock ?? docBlock ?? (open === null ? "the line holds no open round" : `the next round is ${open}${this.#phaseHint(open)}`)}\n`,
        );
        return 1;
      }
    }

    // Advance the requested phase across the wave (one dispatch per frame — the
    // lifecycle's "one dispatch, one advance" step), keeping only the LAST step's
    // capsule for the invocation's single stdout face (the per-step intermediate
    // next-wave lines stay in the router, never on the CLI face). The loop PEEKS
    // before every advance: advance() dispatches on entry, so an expected-phase
    // mismatch must be judged against the next frame BEFORE it spends the round —
    // the {16,22,24} bug's lookahead-after-dispatch consumed the next wave's round
    // in the same invocation (implement 1 silently closed wave 1's review round).
    let dispatched = 0;
    let latest: readonly string[] = [];
    let lastStatus: RoundStatus | null = null;
    for (;;) {
      const frame = run.peekNext();
      if (frame === null) break;
      const waveTasks = frame.target.kind === "wave" ? frame.target.tasks : null;
      const mismatch =
        frame.phase !== expected ||
        (group !== null && (waveTasks === null || !waveTasks.every((id) => group!.has(id))));
      if (mismatch) {
        if (dispatched === 0) {
          this.#io.stderr(
            `cdd ${verb}: cannot dispatch a ${expected} round — the next round is ${frame.phase}${waveTasks !== null ? ` for wave ${waveTasks.join(",")}` : ""}${this.#phaseHint(frame.phase)}\n`,
          );
          return 1;
        }
        break;
      }
      const step = run.advance();
      if (step === null) break;
      // The dispatch-entry gate's refusal (the lifecycle's hard child zero-dispatch wiring —
      // structurally unreachable here: the seam already returned above on refusal).
      if (step.preflight !== undefined) {
        this.#renderPreflightBlocked(verb, step.preflight, scene);
        return 1;
      }
      dispatched += 1;
      latest = step.capsuleLines;
      lastStatus = statuses[statuses.length - 1] ?? null;
      // NO manual done-marking here: the lifecycle's markTerminal is the single
      // closure gate (C5) — a dispatched wave advances the frontier only through
      // its concluded round's route. The old dispatch-then-markDone shortcut drove
      // the loop across waves without a closure verdict: after implement of wave 1
      // it marked wave 1 done, so the loop dispatched wave 2 in the same call
      // (dry-run) and rendered every mid-run closure as `next: done` (the per-step
      // next was already consumed). The ledger-mirrored cursor above + markTerminal
      // together keep one wave phase per invocation.
      if (lastStatus === "BLOCKED" || lastStatus === "TIMEOUT") {
        for (const line of latest) this.#io.stdout(`${line}\n`);
        return 1;
      }
      // The no-next hard error (v1.20): a completed non-failed round must produce a
      // `next:` line — null after a passed BLOCKED/TIMEOUT check is an abnormal
      // completion, never a silent approved-without-next.
      if (step.route === null) {
        for (const line of latest) this.#io.stdout(`${line}\n`);
        this.#io.stderr(
          `${this.#words.station("blocked")} the round concluded ${lastStatus ?? "APPROVED"} with no next: line — a completed non-failed round must yield a next-hop route (re-run the same command to continue)\n`,
        );
        return 1;
      }
    }
    if (dispatched === 0) {
      this.#io.stderr(`cdd ${verb}: nothing to dispatch — the line holds no open frame\n`);
      return 1;
    }
    for (const line of latest) this.#io.stdout(`${line}\n`);
    return 0;
  }

  /** The dispatch seam — the injected override, else the dry-run synthetic approval,
   *  else the harness production default. */
  #dispatchOf(scene: WorkScene, parsed: RunInput): DispatchStep {
    if (this.#dispatch !== null) return this.#dispatch;
    if (parsed.dryRun || this.#dryRun) {
      return () => ({ status: "APPROVED", findings: [] });
    }
    const harness = new CliLifecycle({
      env: process.env,
      sync: this.#sync,
      config: this.#config,
      template: this.#template,
      io: this.#io,
      scene: {
        workspace: scene.workspace,
        ledger: scene.ledger,
        planPath: scene.planPath,
        briefPath: scene.briefPath,
        baseBranch: this.#baseBranchOf(scene),
        specLink: scene.specLink,
      },
      findings: parsed.args.findings ?? null,
    });
    return harness.step();
  }

  /** The branch scope anchor (BASE_BRANCH) — the base artifact's branch name read
   *  from the line's own workspace (`base.json`, the same `base get` source the CLI
   *  writes). "" when the artifact is absent or malformed (the slot stays empty and
   *  the assembler drops it — the wave/branch review then judges the live tree). */
  #baseBranchOf(scene: WorkScene): string {
    const read = scene.workspace.readJson<{ base?: unknown }>("base.json");
    const artifact = read.kind === "ok" ? read.value : null;
    return typeof artifact?.base === "string" ? artifact.base : "";
  }

  /** The phase-mismatch hint — what to run instead. */
  #phaseHint(phase: string): string {
    switch (phase) {
      case "implement":
        return " — run cdd implement first";
      case "review":
      case "branch-review":
        return " — run cdd review first";
      default:
        return " — run cdd fix first";
    }
  }

  /** Render a refused pre-flight verdict — the work command's BLOCK face (P4.1 T1).
   *  The dirty-tree / doc-contract refusals ride the CDD_BLOCKED channel (the
   *  commit/discard guidance + the named structural findings); the graph / wave
   *  refusals keep the pre-existing refusal face (the wave-board hint renders for the
   *  wave gate's split row — its done face rides the SAME closedWaves() read the gate
   *  judged, one closed set, one source). */
  #renderPreflightBlocked(verb: CliVerb, verdict: PreFlightVerdict, scene: WorkScene): void {
    if (verdict.gate === "tree-clean" || verdict.gate === "doc-contract") {
      this.#io.stderr(`${this.#words.station("blocked")} ${verdict.message ?? ""}\n`);
      for (const detail of verdict.details ?? []) this.#io.stderr(`  ${detail}\n`);
      return;
    }
    this.#io.stderr(`cdd ${verb}: ${verdict.message ?? "the dispatch gate refused the request"}\n`);
    for (const detail of verdict.details ?? []) this.#io.stderr(`  ${detail}\n`);
    if (verdict.gate === "wave" && verdict.reason === "split" && scene.planText !== null) {
      const graph = new TaskGraph(new PlanDocType("plan").parse(scene.planText.split("\n")));
      const closed = scene.ledger.closedWaves();
      // The graph title's plan path renders repoRoot-relative (D47 · the ONE shape;
      // `scene.planPath` is argv-origin) — normalized through the ONE value object.
      const titlePlan = new RepoRoot(scene.workspace.root.repoRoot).relativize(
        scene.planPath ?? "",
      );
      for (const line of this.#graphView
        .render(graph.report(closed), `graph: ${titlePlan}`)
        .split("\n"))
        this.#io.stderr(`  ${line}\n`);
    }
  }

  // ---------------------------------------------------------------------------
  // the work scene — the composition of contract/session/face objects
  // ---------------------------------------------------------------------------

  /** Assemble one work command's scene: the workspace (repo root + the plan/spec
   *  slug), the ledger, the run state (TaskGraph from the plan parse for the task
   *  face, the empty single-target state otherwise), the fixed target. The repo root
   *  is derived at the ONE conversion point (T2) — a cwd outside a git repo returns
   *  null, which the caller turns into the BLOCKED exit (§2.6). The path-typed argv
   *  values ride the input funnel (T3 · `#funnel`) so the scene consumes canonical
   *  repoRoot-relative `RepoPath`s. */
  async #sceneOf(
    verb: CliVerb,
    type: TargetType,
    node: Command,
    root: RepoRoot,
    parsed: RunInput,
  ): Promise<WorkScene | null> {
    const config = this.#config;
    const face = targetFaces[type];
    const repoRoot = root.absolute;
    const rootPath = new WorkspaceRoot(repoRoot, config.handoffNamespace().workspaceRoot);
    // The argv paths ride the ONE funnel (T3 §2.3): the READ faces consume the branded
    // `RepoPath`, while the scene's own `planPath`/`target.doc` — the facts the ledger
    // persists and the syscalls read — are the value object's `resolve` erasure (the
    // absolute syscall form; their persisted shape is T4's face). Both derive from the
    // same funnel, so there is zero second normalization.
    const planRel = (parsed.args.plan ?? null) as RepoPath | null;
    const planPath = planRel === null ? null : root.resolve(planRel);
    const specRel = (parsed.args.spec ?? null) as RepoPath | null;
    const specPath = specRel === null ? null : root.resolve(specRel);

    let slug: string;
    let planText: string | null = null;
    let specLink: string | null = null;
    let target: WorkScene["target"] = null;
    switch (type) {
      case "wave": {
        if (planPath === null || planRel === null)
          this.#usage(node, `cdd ${verb} --type wave: missing required --plan <path>`);
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#artifacts.readText(node, root, planRel);
        break;
      }
      case "spec": {
        if (specPath === null)
          this.#usage(node, `cdd ${verb} --type spec: missing required --spec <path>`);
        slug = Workspace.slugFromDoc(specPath);
        target = { kind: "doc", doc: specPath };
        break;
      }
      case "plan": {
        if (planPath === null || planRel === null)
          this.#usage(node, `cdd ${verb} --type plan: missing required --plan <path>`);
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#artifacts.readText(node, root, planRel);
        // The plan's design-spec reference — the `**Spec:**` header link target,
        // derived from the plan text already read (the plan-review round context's
        // extra read input; no second file read). Rebased to repoRoot-relative (D46 ·
        // T3): the raw header form is markdown link-space (relative to the plan's own
        // dir), so it is first resolved to an absolute path, then routed through the
        // ONE value object (`RepoRoot.relativize`) — every round-context path token
        // speaks ONE basis (the child is spawned at cwd = repoRoot).
        const rawSpecLink =
          new PlanDocType("plan").parse(planText.split("\n")).chain.specLink?.target ?? null;
        specLink =
          rawSpecLink === null
            ? null
            : root.relativize(this.#resolveSpecLink(repoRoot, planPath, rawSpecLink));
        target = { kind: "doc", doc: planPath };
        break;
      }
      case "branch": {
        // The branch line carries no commit identity: the audit target is the
        // branch itself, its workspace identity is the plan path (a required
        // fact — the branch review/fix faces carry `--plan`), and the review's
        // scope anchor (BASE_BRANCH) is engine-injected from the base artifact.
        if (planPath === null)
          this.#usage(node, `cdd ${verb} --type branch: missing required --plan <path>`);
        slug = Workspace.slugFromDoc(planPath);
        target = { kind: "branch" };
        break;
      }
    }

    const workspace = new Workspace(rootPath, slug).ensure();
    // The one-time legacy migration (P9 T4 §2.11) — a `progress.json` / `base.json`
    // written by an older build (absolute path fields) is healed to the canonical
    // repoRoot-relative shape on first dispatch; an already-clean file is left
    // byte-identical (zero churn). The read-time backstop (`Workspace.#normalizePaths`)
    // covers any straggler regardless.
    workspace.migrateJsonChild("progress.json");
    workspace.migrateJsonChild("base.json");
    const ledger = new Ledger(workspace, config);
    const state =
      type === "wave"
        ? new TaskGraph(new PlanDocType("plan").parse(planText!.split("\n")))
        : EMPTY_RUN_STATE;
    return {
      workspace,
      ledger,
      planPath,
      planText,
      type,
      face,
      target,
      state,
      router: new NextStepRouter(),
      briefPath: null,
      specLink,
    };
  }

  /** The input funnel — the ONE normalization landing (T3 · §2.3): every path-typed
   *  argv value is relativized to the repo root EXACTLY once, here, before the scene
   *  or any downstream face reads it, so no face ever sees a raw argv path shape. The
   *  covered face: `--plan` · `--spec` · `--findings` (the schema `--output skeleton`
   *  `<target>` positional rides `#runSchema`'s own funnel). An out-of-repo input (a
   *  `..` segment after relativize) is ACCEPTED with a stderr warning — the shape is
   *  what is judged, never the location (§2.10). */
  #funnel(root: RepoRoot, parsed: RunInput): RunInput {
    const args: Record<string, string> = { ...parsed.args };
    for (const key of ["plan", "spec", "findings"] as const) {
      const value = args[key];
      if (value === undefined || value === "") continue;
      const rel = root.relativize(value);
      this.#warnOutsideRepo(rel);
      args[key] = rel;
    }
    return { ...parsed, args };
  }

  /** The out-of-repo path warning (T3 · §2.10) — a relativized value carrying a `..`
   *  segment lies outside the repo; the engine still reads it (shape, not location),
   *  but the fact rides the stderr CDD_WARN channel so the caller is not surprised. */
  #warnOutsideRepo(rel: string): void {
    if (!rel.split(path.sep).includes("..")) return;
    this.#io.stderr(`${this.#words.station("warn")} path is outside the repository: ${rel}\n`);
  }

  /** The repo root — the ONE conversion point (T2 · §2.4/§2.6): the single
   *  working-dir → git-top-level resolution of the engine. Zero injection seams
   *  (`--root` is retired; the composition options carry no root/cwd), zero
   *  fallback. A cwd outside any git repository (a null top level) is a missing
   *  run-environment fact: the existing CDD_BLOCKED channel carries the reason and
   *  the caller exits 1 (never a usage error — exit 2). */
  async #rootOf(): Promise<string | null> {
    const root = await this.#git.topLevel(process.cwd());
    if (root === null) {
      const blocked = this.#words.station("blocked");
      this.#io.stderr(
        `${blocked} cannot resolve the repository root — the current directory is not inside a git repository (run cdd from within the repo)\n`,
      );
      return null;
    }
    return root;
  }

  /** The plan's `**Spec:**` link target resolved to an ABSOLUTE path (D46) — the
   *  plan-review round context's `INPUT_SPEC` (the round-context exit relativizes it
   *  to repoRoot along with every other path token). The raw header form is markdown
   *  link-space (relative to the plan's own dir — the skeleton's form) or a repoRoot
   *  form; the resolution mirrors the doc-contract's own chain-link judgment
   *  (FileExistenceInvariant.#targetExists): absolute direct · the repoRoot-relative
   *  reading when it exists · else the plan-dir-relative reading. The fallback (neither
   *  reading exists) resolves against the plan's own dir — the link-space semantic —
   *  so the exit still receives an absolute path (the doc-contract's file-existence
   *  finding owns the truly-missing case). */
  #resolveSpecLink(repoRoot: string, planPath: string, target: string): string {
    const root = path.resolve(repoRoot);
    if (path.isAbsolute(target)) return target;
    const fromRoot = path.join(root, target);
    if (existsSync(fromRoot)) return fromRoot;
    const fromDocDir = path.resolve(path.dirname(path.resolve(planPath)), target);
    return fromDocDir;
  }

  // ---------------------------------------------------------------------------
  // the pure commands — schema / issue / base
  // ---------------------------------------------------------------------------

  /** `cdd schema get <type> [--output json|skeleton] [<target>]` — the merged D19
   *  single leaf: the json render face (the default — the derived doc-structure
   *  schema JSON to stdout, no target) and the skeleton render face (`--output
   *  skeleton` — the derived doc skeleton written DIRECTLY into the target
   *  document, the target required). The type vocabulary = the one shared
   *  schema-type table (`SCHEMA_TYPE_KEYS` in face/declare.ts: the primary DocKey
   *  spellings + the legacy alias normalized to kebab, spec §5.3). */
  async #runSchema(node: Command, parsed: RunInput): Promise<number> {
    const [type, target] = parsed.positionals;
    if (type === undefined) this.#usage(node, "cdd schema get: missing <type>");
    const output = parsed.args.output ?? "json";
    if (output === "skeleton") {
      // The skeleton render face — the engine-declared target (D19): the authoring
      // scaffold lands in the target document, zero shell-redirection indirection.
      if (target === undefined) {
        this.#usage(node, "cdd schema get --output skeleton: missing <target>");
      }
      // The positional `<target>` rides the SAME input funnel (T3 §2.3) as the
      // work-command path argv: relativized to the repo root exactly once, then
      // erased through the value object at the write boundary.
      const repoRoot = await this.#rootOf();
      if (repoRoot === null) return 1;
      const root = new RepoRoot(repoRoot);
      const targetPath = root.relativize(target);
      this.#warnOutsideRepo(targetPath);
      return this.#artifacts.runSchemaSkeleton(node, root, type, targetPath);
    }
    if (target !== undefined) {
      this.#usage(
        node,
        "cdd schema get: unexpected <target> — the json render takes no target (use --output skeleton <target> to render the scaffold into a document)",
      );
    }
    this.#io.stdout(`${JSON.stringify(this.#projector.schema()[type as DocKey], null, 2)}\n`);
    return 0;
  }

  /** `cdd base <set|get> --plan <path>` — the base artifact read/write (T20: the
   *  command face `base`; the artifact file carries the base face too). */
  async #runBase(node: Command, parsed: RunInput): Promise<number> {
    const planArg = parsed.args.plan;
    if (planArg === undefined) {
      this.#usage(node, "cdd base: missing --plan — the sole target is --plan <path>");
    }
    const repoRoot = await this.#rootOf();
    if (repoRoot === null) return 1;
    const root = new RepoRoot(repoRoot);
    // The base `--plan` rides the SAME input funnel (T3 §2.3): the stored artifact's
    // path field speaks the ONE canonical shape (repoRoot-relative).
    const planPath = root.relativize(planArg);
    this.#warnOutsideRepo(planPath);
    const workspace = new Workspace(
      new WorkspaceRoot(repoRoot, this.#config.handoffNamespace().workspaceRoot),
      Workspace.slugFromDoc(planPath),
    ).ensure();
    // The one-time legacy migration (P9 T4 §2.11) — a legacy base.json with an
    // absolute plan field is healed to the canonical repoRoot-relative shape before
    // the read (an already-clean file is left byte-identical).
    workspace.migrateJsonChild("base.json");
    const path = workspace.resolve("base.json");
    if (parsed.leaf === "set")
      return this.#artifacts.baseSet(node, parsed, planPath, path, repoRoot);
    if (parsed.leaf === "get") return this.#artifacts.baseGet(path, repoRoot);
    this.#usage(node, "cdd base: missing <set|get> subcommand");
  }

  /**
   * Cli.create(opts?) — the composition root's static factory: wires the engine's
   * object graph (contract: the projector over the declared registries · session: the
   * ledger + lifecycle + task graph + next router · face: the words + capsule ·
   * infra: the config loader + git + the sync process seam) into the ONE Cli the bin
   * thin entry boots. Every collaborator is overridable for the hermetic test face
   * (io / dispatch / repoRoot); the defaults bind the living process.
   */
  static create(opts: CliOptions = {}): Cli {
    return new Cli(opts);
  }
}
