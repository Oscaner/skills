// packages/cdd-engine/src-next/face/cli.ts
// T11 + T8 — the command face + composition root (design spec §3.3: the cdd CLI
// command surface — implement / review / fix / schema / issue / base — is kept as a
// steady word face; T20 converges the base command face to `base` — the six-command
// surface unchanged in count). This module is the new tree's composition root: the
// `Cli.create` static factory — the class face is the entry, the module carries zero
// bare functions (the composition root's deliberate class form) — wires the contract /
// session / face objects into the ONE CLI the bin thin entry boots. Task 3 (P1)
// reorganized the face into one boundary per responsibility — the CLI declaration
// single surface (face/declare.ts, §2.4 — the six subcommand rows + the argv
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

import { readFileSync } from "node:fs";
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
import { Capsule } from "./capsule.ts";
import { ARGV_CHANNEL, type CliLeafName, type CliVerb } from "./declare.ts";
import { CliGate } from "./gate.ts";
import { GraphView } from "./graph-view.ts";
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
 *  hermetic ones: io / dispatch / repoRoot / stdin); the production defaults wire
 *  the living process. */
export interface CliOptions {
  io?: CliIo;
  config?: ConfigLoader;
  projector?: Projector;
  words?: Words;
  translator?: Translator;
  git?: GitClient;
  sync?: SyncProcess;
  cwd?: string;
  repoRoot?: string;
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
  readonly #cwd: string;
  readonly #repoRoot: string | null;
  readonly #dryRun: boolean;
  readonly #dispatch: DispatchStep | null;
  readonly #template: TemplateAssembler;
  readonly #brief: BriefRenderer;
  readonly #stdinRead: () => string;
  readonly #issue: IssueBodyRenderer;
  readonly #translator: Translator;
  /** The plan-graph display (the schema get plan-graph + the pre-flight face). */
  readonly #graphView: GraphView;
  /** The lifecycle pre-flight seam (P4.1 T1) — the single dispatch gate the work
   *  commands consult before ANY child dispatch (tree-clean → plan-graph → wave →
   *  doc-contract; the CLI orchestrates the call + the render, never a re-type). */
  readonly #preflight: PreFlight;
  /** The contract coordinator — the shared doc-key derivation face (deriveDocType)
   *  the pre-flight doc construction reads (design spec §2.3: the derivation point
   *  converges to the single contract method). */
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
    this.#cwd = opts.cwd ?? process.cwd();
    this.#repoRoot = opts.repoRoot ?? null;
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
  async #runWork(verb: CliVerb, node: Command, parsed: RunInput): Promise<number> {
    const type = (parsed.args.type ?? "wave") as TargetType;
    if (type === "wave" && parsed.args.tasks === undefined) {
      this.#usage(node, `cdd ${verb} --type wave: missing required --tasks <n|n,n,…>`);
    }
    const scene = await this.#sceneOf(verb, type, node, parsed);

    // THE pre-flight seam (P4.1 T1 · design §1): the single dispatch gate —
    // tree-clean → plan-graph → wave → doc-contract — ONE call, the whole sequence
    // lives in the seam (session/preflight.ts), the CLI only orchestrates the call
    // + the verdict render (zero re-implemented gate here). A refused verdict
    // returns before any brief/lifecycle: no child dispatch ever runs. The
    // dirty-tree / doc-contract refusals ride the CDD_BLOCKED channel; the
    // plan-graph / wave refusals keep the pre-existing refusal face.
    const docPath = scene.target !== null && scene.target.kind === "doc" ? scene.target.doc : "";
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
              docKey: type === "plan" ? "plan" : this.#contract.deriveDocType(docPath),
              path: docPath,
            }
          : null,
    });
    if (!preflight.ok) {
      this.#renderPreflightBlocked(verb, preflight, scene);
      return 1;
    }

    if (verb === "implement" && scene.planText !== null)
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
        if (
          scene.briefPath !== null &&
          outcome.artifacts !== undefined &&
          outcome.artifacts.brief === undefined
        ) {
          outcome.artifacts.brief = scene.briefPath;
        }
        return outcome;
      },
      target: scene.target ?? undefined,
      capsule: new Capsule(this.#words, ARGV_CHANNEL),
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
      cwd: this.#cwd,
      sync: this.#sync,
      config: this.#config,
      template: this.#template,
      io: this.#io,
      scene: {
        workspace: scene.workspace,
        ledger: scene.ledger,
        planPath: scene.planPath,
        briefPath: scene.briefPath,
      },
      findings: parsed.args.findings ?? null,
    });
    return harness.step();
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
   *  commit/discard guidance + the named structural findings); the plan-graph / wave
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
      for (const line of this.#graphView
        .render(graph.report(closed), `plan-graph: ${scene.planPath ?? ""}`)
        .split("\n"))
        this.#io.stderr(`  ${line}\n`);
    }
  }

  // ---------------------------------------------------------------------------
  // the work scene — the composition of contract/session/face objects
  // ---------------------------------------------------------------------------

  /** Assemble one work command's scene: the workspace (repo root + the plan/spec
   *  slug), the ledger, the run state (TaskGraph from the plan parse for the task
   *  face, the empty single-target state otherwise), the fixed target. */
  async #sceneOf(
    verb: CliVerb,
    type: TargetType,
    node: Command,
    parsed: RunInput,
  ): Promise<WorkScene> {
    const config = this.#config;
    const face = targetFaces[type];
    const repoRoot = await this.#repoRootOf(parsed);
    const root = new WorkspaceRoot(repoRoot, config.handoffNamespace().workspaceRoot);
    const planPath = parsed.args.plan ?? null;
    const specPath = parsed.args.spec ?? null;

    let slug: string;
    let planText: string | null = null;
    let target: WorkScene["target"] = null;
    switch (type) {
      case "wave": {
        if (planPath === null)
          this.#usage(node, `cdd ${verb} --type wave: missing required --plan <path>`);
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#artifacts.readText(node, planPath);
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
        if (planPath === null)
          this.#usage(node, `cdd ${verb} --type plan: missing required --plan <path>`);
        slug = Workspace.slugFromDoc(planPath);
        planText = this.#artifacts.readText(node, planPath);
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

    const workspace = new Workspace(root, slug).ensure();
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
    };
  }

  /** The repo root — the --root override, else the injected root, else the git top
   *  level, else the cwd. */
  async #repoRootOf(parsed?: RunInput): Promise<string> {
    const override = parsed?.args.root;
    return override ?? this.#repoRoot ?? (await this.#git.topLevel(this.#cwd)) ?? this.#cwd;
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
   *  spellings + the legacy alias normalized to kebab, spec §5.3); the `plan-graph`
   *  type rides the discovery read (§3.8) on the json face. */
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
      if (type === "plan-graph") {
        this.#usage(
          node,
          "cdd schema get plan-graph: the skeleton render takes a doc-key <type> (plan-graph rides the --output json display face)",
        );
      }
      return this.#artifacts.runSchemaSkeleton(node, type, target);
    }
    if (target !== undefined) {
      this.#usage(
        node,
        "cdd schema get: unexpected <target> — the json render takes no target (use --output skeleton <target> to render the scaffold into a document)",
      );
    }
    if (type === "plan-graph") return this.#runPlanGraph(node, parsed);
    this.#io.stdout(`${JSON.stringify(this.#projector.schema()[type as DocKey], null, 2)}\n`);
    return 0;
  }

  /** `cdd schema get plan-graph --plan <path>` — the plan-graph read (§3.8): the task
   *  graph + the derived wave chain + the ledger progress, rendered as the engine-held
   *  wave-board (GraphView — one deterministic row per wave, zero third-party layout;
   *  the engine owns the node placement and the labels). A Graph validate failure
   *  BLOCKs the read with the named edge violations — the wave-preflight gate surfaces
   *  as a discovery read. The board's done face is the same closedWaves() the pre-flight
   *  gates judge. */
  async #runPlanGraph(node: Command, parsed: RunInput): Promise<number> {
    const planPath = parsed.args.plan;
    if (planPath === undefined) {
      this.#usage(node, "cdd schema get plan-graph: missing --plan <path>");
    }
    const text = this.#artifacts.readText(node, planPath);
    const plan = new PlanDocType("plan").parse(text.split("\n"));
    const graph = new TaskGraph(plan);
    const issues = graph.validate();
    if (issues.length > 0) {
      this.#io.stderr(
        `cdd schema get plan-graph: ${issues.length} plan-graph violation(s) — fix the **DependsOn** edges first\n`,
      );
      for (const issue of issues)
        this.#io.stderr(`  ${issue.kind}@T${issue.task}: ${issue.message}\n`);
      return 1;
    }
    const repoRoot = await this.#repoRootOf(parsed);
    const workspace = new Workspace(
      new WorkspaceRoot(repoRoot ?? this.#cwd, this.#config.handoffNamespace().workspaceRoot),
      Workspace.slugFromDoc(planPath),
    ).ensure();
    const ledger = new Ledger(workspace, this.#config);
    // The board's done face = the C5 closure single read (v1.20): closedWaves() — the
    // same set the pre-flight gates judge, never "any ledger row is done".
    const done = ledger.closedWaves();
    this.#io.stdout(`${this.#graphView.render(graph.report(done), `plan-graph: ${planPath}`)}\n`);
    return 0;
  }

  /** `cdd base <set|get> --plan <path>` — the base artifact read/write (T20: the
   *  command face `base`; the artifact file carries the base face too). */
  async #runBase(node: Command, parsed: RunInput): Promise<number> {
    const planPath = parsed.args.plan;
    if (planPath === undefined) {
      this.#usage(node, "cdd base: missing --plan — the sole target is --plan <path>");
    }
    const workspace = new Workspace(
      new WorkspaceRoot(
        await this.#repoRootOf(parsed),
        this.#config.handoffNamespace().workspaceRoot,
      ),
      Workspace.slugFromDoc(planPath),
    ).ensure();
    const path = workspace.resolve("base.json");
    if (parsed.leaf === "set") return this.#artifacts.baseSet(node, parsed, planPath, path);
    if (parsed.leaf === "get") return this.#artifacts.baseGet(path);
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
