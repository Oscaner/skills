// packages/cdd-engine/src-next/face/cli.ts
// T11 + T8 — the command face + composition root (design spec §3.3: the cdd CLI
// command surface — implement / review / fix / base / schema / issue / board / init —
// is kept as a steady word face; T20 converges the base command face to `base`, T5
// adds the board observability command and P20 adds the repo-independent init
// bootstrap — the eight-command surface). This module is
// the new tree's composition root: the
// `Cli.create` static factory — the class face is the entry, the module carries zero
// bare functions (the composition root's deliberate class form) — wires the contract /
// session / face objects into the ONE CLI the bin thin entry boots. Task 3 (P1)
// reorganized the face into one boundary per responsibility — the CLI declaration
// single surface (face/declare.ts, §2.4 — the eight subcommand rows + the argv
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

import { existsSync, readFileSync, writeSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { type Command, CommanderError } from "commander";
import { ClosedDocument } from "../contract/closed-document.ts";
import { declaredRegistries } from "../contract/declare.ts";
import { FrontMatterExtractor, type FrontMatterParseError } from "../contract/frontmatter.ts";
import { Contract } from "../contract/judge.ts";
import type { ArtifactSnapshot } from "../contract/preflight-rows.ts";
import type { DocKey } from "../contract/project.ts";
import { Projector } from "../contract/project.ts";
import { Translator } from "../contract/translate.ts";
import { ConfigLoader } from "../infra/config.ts";
import { GitClient } from "../infra/git.ts";
import { type PlanRead, PlanSource } from "../infra/plan-source.ts";
import { type RepoPath, RepoRoot } from "../infra/root.ts";
import { type DocEntry, SlugIndex } from "../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { BriefRenderer } from "../render/brief.ts";
import { IssueBodyRenderer } from "../render/issue-body.ts";
import { TemplateAssembler } from "../render/templates.ts";
import { CarrierMismatchError } from "../session/carrier-integrity.ts";
import {
  DispatchAuthority,
  type DispatchRefusal,
  type DispatchVerb,
} from "../session/dispatch-authority.ts";
import {
  type DispatchPhase,
  type TargetFace,
  TargetFaceTable,
  type TargetType,
  targetFaces,
} from "../session/faces.ts";
import { TaskGraph } from "../session/graph.ts";
import { HandoffSchema } from "../session/handoff-schema.ts";
import { HoldingError, InFlight } from "../session/inflight.ts";
import {
  AbortFold,
  type BookedAbort,
  ConsumedRound,
  Ledger,
  RoundRecords,
  type RoundStatus,
} from "../session/ledger.ts";
import { NextStepRouter } from "../session/next.ts";
import type { PipelineFrontierInput } from "../session/pipeline.ts";
import { PreFlight, type PreFlightVerdict } from "../session/preflight.ts";
import { PreFlightRefusal, type RefusalFacts } from "../session/refusal.ts";
import { ArtifactRegistry } from "../session/round-artifacts.ts";
import { RoundNaming } from "../session/round-naming.ts";
import type { DispatchStep, RunState } from "../session/run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../session/run.ts";
import { CliArtifacts } from "./artifacts.ts";
import { type ArtifactProjection, type BoardDisplay, BoardNext, BoardView } from "./board-view.ts";
import { Capsule } from "./capsule.ts";
import { ARGV_CHANNEL, type CliLeafName, type CliVerb } from "./declare.ts";
import {
  ArtifactSnapshots,
  type DispatchIdentity,
  type DispatchSceneFacts,
  DispatchValues,
  RequestingCarrier,
} from "./dispatch-values.ts";
import { CliGate } from "./gate.ts";
import { GraphView } from "./graph-view.ts";
import { HOST_IDS, HostDetect, type HostId } from "./host.ts";
import { CliInit, ExecaStepRunner, type InitRequest, type StepRunner } from "./init.ts";
import { type CliIo, CliLifecycle, type DispatchScene } from "./lifecycle.ts";
import { Preview } from "./preview.ts";
import { CommandTreeBuilder } from "./projection.ts";
import { type ChildRunner, Terminator } from "./termination.ts";
import { Words } from "./words.ts";

// ---------------------------------------------------------------------------
// the re-exported seams + the dispatch production default — the split contract's
// lifecycle face owns the dispatch/readback plane (face/lifecycle.ts) and the
// shared seams it rides; the composition root re-exports them here unchanged so
// the module's public surface never drifts (CliIo · ChildRunner · DispatchScene ·
// BaseArtifact · HarnessDispatch).
// ---------------------------------------------------------------------------

export type { BaseArtifact } from "./artifacts.ts";
export type { CliIo, DispatchScene } from "./lifecycle.ts";
export { CliLifecycle as HarnessDispatch } from "./lifecycle.ts";
export type { ChildOutcome, ChildRun, ChildRunner } from "./termination.ts";
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
  sync?: ChildRunner;
  dryRun?: boolean;
  dispatch?: DispatchStep | null;
  preflight?: PreFlight;
  authority?: DispatchAuthority;
  template?: TemplateAssembler;
  brief?: BriefRenderer;
  stdinRead?: () => string;
  /** The `cdd init` step runner (tests substitute a recording stand-in). */
  initRunner?: StepRunner;
  /** The `cdd init` synchronous header writer (tests collect the lines). */
  initHeader?: (line: string) => void;
  /** The artifact matrix the command preamble hands to every read face (tests inject a
   *  recording registry to pin the single-instance wiring). Absent = the composition
   *  root mints the invocation's ONE instance. */
  artifacts?: ArtifactRegistry;
}

/** One work command's assembled scene — the composition the run body advances. The
 *  `plan` cell is the ONE plan read of the run (argv face or derived doc face). */
export interface WorkScene extends DispatchScene {
  plan: PlanRead;
  type: TargetType;
  face: TargetFace;
  target: { kind: "branch" } | { kind: "plan"; doc: string } | { kind: "spec"; doc: string } | null;
  state: RunState;
  router: NextStepRouter;
  /** The pipeline frontier's declared input (§11) — the four cells the capsule's
   *  hop assembly consumes: the identity document's DECLARED word + path (the
   *  document index, never the argv spelling), the plan path (the argv value on the
   *  plan / branch lines, the index's same-slug plan on a `--spec` round) and the
   *  guarded plan read. The session plane reads no file, so the composition root
   *  collects all four and injects them. */
  pipeline: PipelineFrontierInput;
  /** The plan's `spec:` front-matter link target (plan docs only) — the plan-review
   *  round context's spec anchor; null off the plan face. */
  specLink: string | null;
  /** The parent charter the spec's `program:` names (the same-slug overall's
   *  repoRoot-relative path) — the review/fix round context's charter anchor; null
   *  when the line's spec names no program. */
  overallLink: string | null;
  /** The identity document's DECLARED `program:` literal (`DocEntry.program`) — the
   *  dispatch-input gate's `when: "program"` declaration source (P38 §1.3).
   *  Required here so a scene assembled by this root can never be handed to the gate
   *  with the declaration silently missing: null IS the "not declared" answer. */
  program: string | null;
  /** The identity document's DECLARED `doc-type:` shape (`DocEntry.docType`) — the
   *  `when: "identity"` declaration source, same shape as `program` beside it. */
  docType: DocEntry["docType"];
}
/** The path-typed argv values (T3 §2.3) — split out of the generic `args` record
 *  so the funnel's normalized `RepoPath` brand reaches the scene/read faces with
 *  NO downcast (branch-review-1 F7). The funnel is the ONE landing: before it runs
 *  the three fields are null; after it they carry the branded repoRoot-relative
 *  value (or null when the flag was absent). */
export interface PathArgs {
  plan: RepoPath | null;
  spec: RepoPath | null;
  reviews: RepoPath | null;
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
  /** The declared keys' values — normalized strings (undefined-flagged keys absent;
   *  the path-typed keys are split into `paths` by the funnel). */
  args: Record<string, string>;
  /** The path-typed argv values — the funnel's branded `RepoPath` landing (F7). */
  paths: PathArgs;
  /** The positional values (the schema <type> — the parseTypeKey-normalized key). */
  positionals: readonly string[];
  /** The invocation's read-only preview scope (the --dry-run program flag). */
  dryRun: boolean;
  /** The `cdd init` harness — the commander enum value narrowed against HOST_IDS
   *  (undefined until the run face guards it; only the init shell consumes it). */
  harness?: HostId;
  /** The `cdd init` update form — the parsed `--update` boolean. */
  update?: boolean;
  /** The `cdd init` recommended-tier flag — the parsed `--include-recommends`
   *  boolean (the tier is opt-in, so an absent flag is the core-only face). */
  includeRecommends?: boolean;
}

/** The `--recover` double-gap refusal (P30 §2.1③) — NEITHER leg holds: no stale
 *  in-flight record stands on this tree, and the line is not at drift ∧ pending-fix.
 *  The command dispatches nothing: a flag that silently degrades into an ordinary
 *  dispatch is exactly the silent fallback §2.1③ forbids. */
const RECOVER_NOTHING =
  "--recover has nothing to take over and nothing to reopen — no stale in-flight record stands on this tree (①), and this line is not at drift ∧ pending-fix (②); nothing was dispatched";

/** The `--recover` judgment's answer: taken over (the abort leg already ran, so the
 *  dispatch must not fold again), or the refusal to print. */ type RecoverRun =
  | { readonly kind: "allowed" }
  | { readonly kind: "blocked"; readonly message: string };

/** One memo keyed by repo root — the ONE memo shape every `Cli` seam over the doc
 *  corpus shares (`#index` · the production pre-flight). A `Cli` may serve
 *  several commands and a fixture several repos, so the key is the root: a read for the
 *  root that built the value answers it, and a read for any other root rebuilds. The
 *  invalidation therefore lives HERE, not in a `#...Root` companion every seam has to
 *  remember to pair. `reset` drops the memo when a command boundary says the snapshot
 *  is stale. */
class RootMemo<T> {
  #value: T | null = null;
  #root: string | null = null;

  read(root: string, build: (root: string) => T): T {
    if (this.#value !== null && this.#root === root) return this.#value;
    const value = build(root);
    this.#value = value;
    this.#root = root;
    return value;
  }

  reset(): void {
    this.#value = null;
    this.#root = null;
  }
}

/** The pre-frame value assembly's inputs. One object rather than five positionals: the
 *  assembly reads exactly these five facts and its only caller writes them at one call
 *  site. `folded` is the round `--recover` is about to book — the recovery legs run after
 *  the verdict by spec order, so the ledger does not hold it yet when the values are
 *  composed (`AbortFold` answers what the fold will write). */
interface BeforeParts {
  readonly scene: WorkScene;
  readonly type: TargetType;
  readonly phase: DispatchPhase;
  readonly parsed: RunInput;
  readonly folded: BookedAbort | null;
}

/** The dispatch seam's inputs. One object rather than five positionals: `recovered`
 *  (the composition root already ran the `--recover` legs, so the harness must not fold
 *  again) and `recover` (the SAME derived value every other reader takes — the harness's
 *  takeover permission included) are two different facts about one flag, and passing
 *  them apart is what let four spellings of it drift. */
interface DispatchParts {
  readonly scene: WorkScene;
  readonly parsed: RunInput;
  readonly recovered: boolean;
  readonly recover: boolean;
  readonly artifacts: ArtifactRegistry;
  /** The seam's own value record (P40 T5) — handed to the harness so the renderer reads
   *  the record the gate judged instead of re-assembling a second one. */
  readonly values: Readonly<Record<string, string>>;
  /** The invocation's ONE host probe (P40 T6) — handed to the harness so the spawn reads
   *  the table row the seam judged the `no-host` row against. */
  readonly host: HostId | "";
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
  readonly #sync: ChildRunner;
  readonly #dryRun: boolean;
  readonly #dispatch: DispatchStep | null;
  readonly #template: TemplateAssembler;
  readonly #brief: BriefRenderer;
  readonly #stdinRead: () => string;
  readonly #issue: IssueBodyRenderer;
  readonly #translator: Translator;
  /** The pre-flight board face (the blocked-dispatch wave hint). */
  readonly #graphView: GraphView;
  /** The lifecycle pre-flight seam (P4.1 T1) — the STRUCTURE gates the work
   *  commands consult before ANY child dispatch (tree-clean → in-flight → graph →
   *  plan-ledger → doc-contract; the CLI orchestrates, never a re-type). A caller's
   *  injected seam (tests) is used as-is; the production one is memoized below. */
  readonly #preflightInjected: PreFlight | null;
  /** The dispatch authority (P27 §2) — the ONE verdict over structure → upstream →
   *  line, and the ONE refusal line. The dispatch gate reads it before its first
   *  write; the capsule and the board read the same hop the refusal names. */
  readonly #authority: DispatchAuthority;
  /** The contract coordinator — the doc-contract judgment face the pre-flight's
   *  doc gate reads (the single interpreter entry; spec §12 · D34 retired the
   *  filename→type derivation — the doc type is now the declared header fact read
   *  through BoardView.readDocType). Its instance carries the judgment strategies' own
   *  state (the `single-home` right-domain corpus, per workspace root), so the command
   *  boundary REBUILDS it: a corpus list carried across commands would answer from a
   *  snapshot taken before this command's writes. */
  #contract: Contract;
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
  /** The artifact matrix of this invocation — constructed ONCE per command and handed
   *  down to the scene's ledger / router / lifecycle, the board's node ledgers and the
   *  seal sweep. It binds no workspace (the matrix is naming knowledge; the workspace is
   *  the read-time coordinate), so ONE instance serves every node a command observes.
   *  The doc domain answers through the command's identity index, which is bound ONTO
   *  this instance at `#indexOf` — the same object, never a second registry. */
  readonly #matrix: ArtifactRegistry;
  /** The command's ONE identity index — built once per repo root at `#indexOf`, so no
   *  two read faces of a command scan the doc roots twice. */
  readonly #index = new RootMemo<SlugIndex>();
  /** The dispatch's ONE closure reading (design spec §1.4) — constructed on first use by
   *  the accessor handed to BOTH the pre-flight closure port and the lifecycle's doc
   *  gate, so one dispatch answers closure off one doc scan. A wave / branch dispatch
   *  has no doc target and asks neither, so it constructs none. */
  readonly #closed = new RootMemo<ClosedDocument>();
  /** The production pre-flight seam, memoized per repo root (the closure port's memo
   *  key) — built at the assembly point so its port names THIS invocation's closure
   *  reading. */
  readonly #preflight = new RootMemo<PreFlight>();
  /** The harness plugin bootstrap (P20 — face/init.ts): the repo-independent
   *  install/update sequence face. */
  readonly #init: CliInit;
  /** The bootstrap's synchronous line writer — the step headers of a real run and
   *  the `would run:` lines of a `--dry-run` preview ride the SAME seam (one writer,
   *  so a preview and a run never format the same plan differently). */
  readonly #initHeader: (line: string) => void;

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
    this.#sync = opts.sync ?? new Terminator();
    this.#dryRun = opts.dryRun ?? false;
    this.#dispatch = opts.dispatch ?? null;
    this.#template = opts.template ?? new TemplateAssembler();
    this.#brief = opts.brief ?? new BriefRenderer();
    this.#stdinRead = opts.stdinRead ?? (() => readFileSync(0, "utf8"));
    this.#translator = opts.translator ?? new Translator(this.#words);
    this.#issue = new IssueBodyRenderer(this.#words, this.#translator);
    this.#graphView = new GraphView();
    this.#contract = new Contract();
    // The pre-flight seam is built at the dispatch, not here (design spec §1.4): its
    // closure port must name THIS invocation's closure reading, and the repo root is
    // known only once the command preamble resolves it. A caller's injected seam (tests)
    // is kept as-is; the production one is memoized by `#preflightOf`.
    this.#preflightInjected = opts.preflight ?? null;
    this.#authority = opts.authority ?? new DispatchAuthority();
    this.#gate = new CliGate({ brief: this.#brief, authority: this.#authority });
    // The invocation's ONE matrix — the command preamble's construction point. The
    // declared domain is bound onto this same instance at `#indexOf` (an injected one
    // included), so no face ever holds a registry the doc reads do not answer through.
    this.#matrix = opts.artifacts ?? new ArtifactRegistry();
    this.#artifacts = new CliArtifacts({
      io: this.#io,
      projector: this.#projector,
      issue: this.#issue,
      stdinRead: this.#stdinRead,
      matrix: this.#matrix,
      usage: (node, message) => this.#usage(node, message),
    });
    // The synchronous writer — the step header must land before the spawned
    // child writes to the same fd (a piped log would otherwise reorder them).
    this.#initHeader = opts.initHeader ?? ((line) => writeSync(1, `${line}\n`));
    this.#init = new CliInit({
      io: this.#io,
      runner: opts.initRunner ?? new ExecaStepRunner(),
      header: this.#initHeader,
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
      this.#beginCommand();
      await this.#program.parseAsync([...raw], { from: "user" });
      return this.#exitCode;
    } catch (err) {
      return this.#normalizeExit(err);
    }
  }

  /** The command boundary — the ONE invalidation point of every snapshot a command
   *  may take and the next one must not inherit. One COMMAND, one snapshot: the three
   *  per-root memos (`#index` · `#closed` · the production pre-flight, whose closure
   *  port closes over `#closed`) and the judgment instance's own right-domain
   *  corpus are dropped here, so the next invocation re-scans. A memo carried across
   *  commands would answer from a snapshot taken before the documents this command
   *  writes or observes — the `✔ Done` cell of the judged document included.
   *
   *  The memos stay keyed on the repo root (one `Cli` may serve several fixtures), and
   *  the invalidation lives here rather than in a `#...Root` companion every seam has
   *  to remember to pair. */
  #beginCommand(): void {
    this.#index.reset();
    this.#closed.reset();
    this.#preflight.reset();
    // The strategies hold their own state (the `single-home` corpus per root); a fresh
    // judgment instance is the whole reset, and its construction reads no file.
    this.#contract = new Contract();
  }

  /** The exit-code discriminator — the CommanderError surface (§3.1): the explicit
   *  help faces exit 0, the missing-command/missing-subcommand faces ride the help
   *  code's non-zero exit → 2, the usage-class codes (unknown option/command ·
   *  invalid argument (incl. the preAction conditional-required) · excess args ·
   *  missing required) → 2, an unexpected error → 1. */
  #normalizeExit(err: unknown): number {
    // P31 §2.2 — a carrier whose bytes no longer digest to the recorded value is a
    // hard stop on the CDD_BLOCKED channel (the ordered-rank of every blocked gate),
    // with the existing blocked exit code. The read faces that can meet it (board's
    // `+N` count, the fix criterion's input, the ledger's carrier read) all throw it
    // through their own seam.
    if (err instanceof CarrierMismatchError) {
      this.#io.stderr(`${this.#words.station("blocked")} ${err.message}\n`);
      return 1;
    }
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
    leafNode("issue", "render").action(async (_opts: unknown, command: Command) => {
      this.#assertDryRunScope(command, this.#dryRunOf(command));
      this.#exitCode = this.#artifacts.runIssue();
    });
    // the board observability command — a pure read (no preflight gate)
    commandNode("board").action(async (_opts: unknown, command: Command) => {
      this.#exitCode = await this.#runBoard(command, this.#runInput(null, command));
    });
    // the repo-independent bootstrap — zero #rootOf(), zero workspace writes. The
    // preview flag renders the step plan through the same header seam and returns
    // before the first spawn (spec §2.7): a preview must never install packages.
    commandNode("init").action(async (_opts: unknown, command: Command) => {
      const dryRun = this.#dryRunOf(command);
      const parsed = this.#runInput(null, command);
      // The declaration marks --harness as requiredOption, so commander rejects a
      // missing flag before this shell; the guard keeps the run input's narrowed
      // type honest (the usage face belongs to the root's private surface, so it
      // stays here rather than sinking into CliInit).
      if (parsed.harness === undefined) this.#usage(command, "cdd init: missing --harness");
      const update = parsed.update ?? false;
      // The recommended tier is its own parsed boolean — an absent flag means the
      // core-only face, never a derived default.
      const recommended = parsed.includeRecommends ?? false;
      // The flatten request — the ONE shape `preview` and `run` both read.
      const request: InitRequest = {
        host: parsed.harness,
        shape: update ? "update" : "install",
        recommended,
      };
      if (dryRun) {
        for (const line of this.#init.preview(request)) this.#initHeader(line);
        this.#exitCode = 0;
        return;
      }
      this.#exitCode = await this.#init.run(request);
    });
  }

  /** The command's ONE identity index — the doc-domain binding point. `board` · the
   *  scene assembly · `base` each call this once, and a second call inside one command
   *  reuses the memo (a command never scans the doc roots twice). The matrix's declared
   *  domain is bound onto the SAME registry instance here — the base face, the ledgers,
   *  the lifecycle and the board all keep holding it, so a doc read can not fall on a
   *  table that never learned the index. */
  #indexOf(repoRoot: string): SlugIndex {
    return this.#index.read(repoRoot, (root) => {
      const index = SlugIndex.build(root);
      this.#matrix.bindDocIndex(index);
      return index;
    });
  }

  /** The dispatch's closure reading — constructed on first use, memoized per repo root.
   *  The ONE construction point of that reading: the pre-flight closure port and the
   *  lifecycle's `Contract.validate` both resolve through here, so a review dispatch
   *  scans the doc roots once and a wave / branch dispatch (no doc target) reads them
   *  zero times. The index is the command's own (`#indexOf`), never a second scan. */
  #closedOf(repoRoot: string): ClosedDocument {
    return this.#closed.read(repoRoot, (root) => new ClosedDocument(this.#indexOf(root)));
  }

  /** The pre-flight seam of one dispatch — the caller's injected seam when there is one,
   *  otherwise the production seam built here so its closure port can name this
   *  invocation's closure reading. Memoized per repo root (the port's memo key). */
  #preflightOf(repoRoot: string): PreFlight {
    if (this.#preflightInjected !== null) return this.#preflightInjected;
    return this.#preflight.read(
      repoRoot,
      (root) =>
        new PreFlight({
          git: this.#git,
          contract: this.#contract,
          words: this.#words,
          provenClosed: (rel) => this.#closedOf(root).closed(rel),
        }),
    );
  }

  /** `cdd board --plan <path> / --spec <path>` — the entry document's progress board
   *  (spec §3.1): a PURE READ — zero preflight gate, zero tree writes, zero ledger
   *  writes, zero child dispatch. At least one path flag is required (missing →
   *  usage exit 2); each path resolves through the ONE identity index (`SlugIndex`
   *  scans every docRoot), so a path outside the docRoots or absent on disk is
   *  the not-found face (exit 2, zero doc reads, zero BLOCKED markers). Two flags
   *  naming different slugs are an argument conflict (exit 2, both values on
   *  stderr); two flags on one slug render ONE board shaped by the `--spec`
   *  document's `doc-type:`. The host is detected once for the pipeline-entry ref
   *  render (REFS[ref][host], the same judgment the capsule injects). */
  async #runBoard(node: Command, parsed: RunInput): Promise<number> {
    this.#assertDryRunScope(node, parsed.dryRun);
    const planArg = parsed.args.plan;
    const specArg = parsed.args.spec;
    if (planArg === undefined && specArg === undefined)
      this.#usage(node, "cdd board: pass --plan and/or --spec");
    const repoRoot = await this.#rootOf();
    if (repoRoot === null) return 1;
    const root = new RepoRoot(repoRoot);
    const planRel = planArg === undefined ? null : this.#relativizePath(root, planArg);
    const specRel = specArg === undefined ? null : this.#relativizePath(root, specArg);
    // The not-found face reads ZERO documents (spec §3.1): a path outside the two
    // doc roots or absent on disk refuses BEFORE the identity scan — the scan is
    // this face's only document-reading step, and it never runs for this verdict.
    const planMissing =
      planRel !== null &&
      (!SlugIndex.insideDocRoots(planRel) || !existsSync(root.resolve(planRel)));
    const specMissing =
      specRel !== null &&
      (!SlugIndex.insideDocRoots(specRel) || !existsSync(root.resolve(specRel)));
    if (planMissing || specMissing)
      return this.#boardNotFound([
        planMissing ? `--plan ${planArg}` : null,
        specMissing ? `--spec ${specArg}` : null,
      ]);
    // The command's ONE identity index — built BEFORE the read seam, which is handed
    // it: the plan read asks the same scan the board renders from (a second index
    // would be a second snapshot of the disk, and §2.7's "clean surface" answer must
    // describe the one the board names).
    const index = this.#indexOf(repoRoot);
    // The board's plan read seam — ONE instance per command, threaded down the
    // static render chain (the board's ledgers read their brief revisions through
    // it; a node workspace never mints its own).
    const planSource = new PlanSource(root, index);
    // ② the read (spec §2.4): ONLY a solo `--plan` reads X's bytes. When `--spec` is
    // present the board's value comes from `readFor(specEntry)` (§2.1: `--spec` wins),
    // so X's bytes are never opened — its `--plan` duties stay the ① existence probe
    // and the ③ `no docs match` attribution. An io failure here is the ONE
    // `cannot read` face: exit 2, no board, no cause tail (`DocFs.read` carries no
    // errno, so a suffix would be an invented literal).
    const soloPlanRead = specRel === null && planRel !== null ? planSource.readPath(planRel) : null;
    if (soloPlanRead !== null && soloPlanRead.failure()?.cause === "io")
      return this.#boardCannotRead(`--plan ${planArg}`);
    const planEntry = planRel === null ? null : index.entryAt(planRel);
    const specEntry = specRel === null ? null : index.entryAt(specRel);
    const unmatched = [
      planRel !== null && planEntry === null ? `--plan ${planArg}` : null,
      specRel !== null && specEntry === null ? `--spec ${specArg}` : null,
    ].filter((part): part is string => part !== null);
    if (unmatched.length > 0) return this.#boardNotFound(unmatched);
    const planSlug = planEntry?.slug ?? null;
    const specSlug = specEntry?.slug ?? null;
    if (
      planEntry !== null &&
      specEntry !== null &&
      SlugIndex.isLegalSlug(planSlug) &&
      SlugIndex.isLegalSlug(specSlug) &&
      planSlug !== specSlug
    ) {
      this.#io.stderr(
        `cdd board: --plan slug "${planSlug}" conflicts with --spec slug "${specSlug}"\n`,
      );
      return 2;
    }
    const entry = specEntry ?? planEntry;
    if (entry === null) return 2;
    const host = HostDetect.detect(process.env);
    // The in-flight fact is TREE-level: the board inspects it (read-only — the gate
    // and the board share `InFlight.inspect()`, never a second liveness judgment).
    const workspaceRoot = new WorkspaceRoot(
      repoRoot,
      this.#config.handoffNamespace().workspaceRoot,
    );
    // The board's ONE matrix instance — the invocation's registry, the same table the
    // node ledgers and the seal sweep read, so the board renders facts and holds no
    // name rule of its own. Each node ledger resolves against ITS OWN workspace (the
    // registry carries no directory), so a parent row never reads a child's names.
    const artifacts = this.#matrix;
    const inflight = new InFlight(workspaceRoot, entry.slug ?? "");
    // The tree's refusal record, read ONCE here and handed to the render as a value: the
    // board judges nothing and constructs no workspace of its own, so the `slug` filter
    // (`read()` answers `absent` for another phase workspace's record) is applied at its
    // ONE producer. The read is REQUIRED at the render — a defaulted `absent` would let a
    // board that forgot the parameter print nothing while every unit case stayed green.
    const refusal = new PreFlightRefusal(workspaceRoot, entry.slug ?? "").read();
    // The board's `next:` line renders ONE injected `NextHop` (P22 §5.2 · P24 §11):
    // the pipeline FACTS come from the board face, and the ONE hop assembly (the four
    // face-order rules + the six hop cells) lives in the session plane's
    // `PipelineFrontier` — the same assembly the capsule renders, so the board and the
    // capsule state one hop. Neither face judges anything here.
    // The board's ONE ordered plan value table (spec §2.1 · §2.4): an overall board
    // reads one value per `index.phaseSpecsOf` row, so every phase cell and every
    // `CDD_WARN:` line speaks the same read; a single-document board is a table of
    // length 1 (the argv face's read when `--plan` stands alone, the derived face's
    // otherwise).
    const readTable = this.#boardReadTable(planSource, index, entry, soloPlanRead);
    const read = readTable[0] ?? planSource.readFor(entry);
    // The board's artifact observation is ONE value: the matrix seam plus the
    // `--artifacts` switch. Both the hop assembly and the render read it, so the
    // board can never print a `next:` computed against one registry and an `art:`
    // block read through another.
    const projection: ArtifactProjection = {
      registry: artifacts,
      showAll: parsed.args.artifacts === "true",
    };
    // The board's PRINTING face — `--notes` opens the child-note bodies the folded
    // default keeps as a count. It changes no judgment and no token order: the same
    // `notes +M` segment either stops at the count or appends its rows.
    const display: BoardDisplay = { notes: parsed.args.notes === "true" };
    const next = BoardNext.of(read, planSource, index, entry, root, projection);
    // The read's own diagnostics (spec §2.4): stderr, one line per bad read, printed
    // BEFORE the board. `warnLine` answers null for a healthy plan and for the normal
    // `undeclared` gap, so the line count is exactly (bad plans + `spec-absent`
    // orphans + `slug-absent` facts) — never "non-ready phases".
    for (const row of readTable) {
      const warn = row.warnLine(this.#words);
      if (warn !== null) this.#io.stderr(`${warn}\n`);
    }
    const board = BoardView.render(
      readTable,
      planSource,
      index,
      entry,
      repoRoot,
      this.#words,
      host,
      refusal,
      ARGV_CHANNEL,
      await inflight.inspect(),
      next,
      projection,
      display,
    );
    for (const line of board.lines) this.#io.stdout(`${line}\n`);
    return board.exitCode;
  }

  /** The board's ordered per-phase plan value table (spec §2.1 · §2.4) — the ONE
   *  construction point of the board's `PlanRead`s. An overall board reads each
   *  `phaseSpecsOf` row in index order through the derived face; any other board is
   *  one document, whose value the caller already read (the argv face when `--plan`
   *  stands alone) or reads here through the derived face. */
  #boardReadTable(
    planSource: PlanSource,
    index: SlugIndex,
    entry: DocEntry,
    soloPlanRead: PlanRead | null,
  ): readonly PlanRead[] {
    const slug = entry.slug;
    if (entry.docType !== "overall") return [soloPlanRead ?? planSource.readFor(entry)];
    if (slug === null || !SlugIndex.isLegalSlug(slug)) return [];
    return index.phaseSpecsOf(slug).map((phase) => planSource.readFor(phase));
  }

  /** The board's read-failure face (spec §2.4 ②) — ONE stderr line, exit 2, no board:
   *  the named plan's bytes did not read. The message names no cause on purpose: the
   *  read seam returns `string | null` and carries no errno, and the `io` / `syntax`
   *  distinction rides the `CDD_WARN:` line instead. */
  #boardCannotRead(flag: string): number {
    this.#io.stderr(`cdd board: cannot read ${flag}\n`);
    return 2;
  }

  /** The board's not-found face (spec §3.1) — the ONE stderr line + exit 2 the
   *  pre-scan membership/existence probe and the post-scan entry lookup share. */
  #boardNotFound(parts: readonly (string | null)[]): number {
    const named = parts.filter((part): part is string => part !== null);
    this.#io.stderr(`cdd board: no docs match ${named.join(" and ")}\n`);
    return 2;
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
    const harnessToken = typeof globals.harness === "string" ? globals.harness : "";
    return {
      leaf,
      args,
      // The path-typed values land empty — the funnel (`#funnel`) is the ONE
      // normalization site that fills them with the branded repoRoot-relative form.
      paths: { plan: null, spec: null, reviews: null },
      positionals: command.processedArgs as string[],
      dryRun: this.#dryRunOf(command),
      // The harness word is narrowed through the ONE host vocabulary (a cast would
      // let a foreign token ride into the roster index); `--update` is the parsed
      // boolean, never a truthy string.
      harness: HOST_IDS.find((id) => id === harnessToken),
      update: globals.update === true,
      includeRecommends: globals.includeRecommends === true,
    };
  }

  /** The invocation's `--dry-run` scope — the constructor flag OR the program-scope
   *  flag (the flag is declared on the program node, so a leaf's own opts would miss
   *  it; `optsWithGlobals` merges the parent chain). The ONE derivation the run input
   *  and the scope guard read — never a second copy of the merge rule. */
  #dryRunOf(command: Command): boolean {
    const globals = command.optsWithGlobals() as Record<string, unknown>;
    return this.#dryRun || globals.dryRun === true;
  }

  /** The `--dry-run` scope guard (P11 T5 · §3.5) — the pure commands' rejection face
   *  alone: a pure command carrying the program flag is a usage rejection (exit 2),
   *  never a silently ignored flag — a no-op flag the consumer has to remember to
   *  skip is a mind-share defect, not a convenience. The four preview-capable faces
   *  (implement / review / fix / init) never reach this guard; `init`'s preview is
   *  `CliInit.preview`. The usage byte is the owning node's commander-native usage
   *  line (the same `#usage` face every run body's rejection rides). */
  #assertDryRunScope(node: Command, dryRun: boolean): void {
    if (!dryRun) return;
    this.#usage(
      node,
      "--dry-run previews the next dispatch step and its expected artifacts — it applies to implement / review / fix / init only",
    );
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
    // run (scene + ledger + dispatch `--reviews`) speaks ONE normalized argv shape.
    const repoRoot = await this.#rootOf();
    if (repoRoot === null) return 1;
    const root = new RepoRoot(repoRoot);
    // The identity index FIRST: the plan read seam below is handed THIS scan, so the
    // phase's plan row, the same-slug spec link and the phase list all speak one
    // snapshot of the doc roots.
    const index = this.#indexOf(repoRoot);
    // The plan read seam — ONE instance per command, built here in the command
    // preamble (the repo root and the index exist now; `Cli.create` runs before they
    // do) and passed down as a parameter: the scene, the pre-flight context and the
    // ledger all read their plan through this ONE seam.
    const planSource = new PlanSource(root, index);
    const parsed = this.#funnel(root, raw);
    const assembled = await this.#sceneOf(verb, type, node, root, planSource, parsed);
    if (assembled === null) return 1;
    const { scene, artifacts } = assembled;

    // The phase this dispatch expects — the verb's own word, or the face's review
    // lead (the branch line's `branch-review`). Every face reads it (the values, the
    // dispatch verdict, the lookahead refusal).
    const expected: DispatchPhase =
      verb === "implement" ? "implement" : verb === "fix" ? "fix" : scene.face.product.reviewLead;

    // The per-invocation batch cursor: the in-memory done set mirrors the on-disk
    // ledger's closed waves (the C5 closure single face) — NOT a "every non-group
    // task pre-done" shortcut. The old shortcut made the frontier yield exactly the
    // requested group, but it also emptied readyBatch() at every closure: a mid-run
    // wave's fix rendered `next: done` instead of the next wave (the {16,22,24} →
    // {25,26,27} bug — the closure routing judged a per-invocation cursor, not the
    // plan's real remaining frontier). The ledger mirror keeps the progress face
    // cross-invocation: the dispatched group's own closure marks in #markTerminal
    // as the loop advances, and the next wave surfaces from the live closed set. The
    // request's own validity (a task id absent from the plan) is a USAGE rejection,
    // judged before any gate, write or child: nothing of the dispatch exists yet.
    let group: Set<number> | null = null;
    if (type === "wave") {
      group = new Set(this.#gate.tasksOf(parsed));
      // The requested ids against the plan's own task set. A non-ready plan (no
      // readable document) judges no membership here — the doc-contract refusal leg
      // owns that verdict; an empty set here is NOT "skip", so the guard stays
      // outside the `doc !== null` block.
      const doc = scene.plan.doc();
      if (doc !== null) {
        const planIds = doc.taskBlocks.map((block) => block.id);
        for (const id of group) {
          if (!planIds.includes(id)) {
            this.#usage(node, `cdd ${verb}: task ${id} not found in the plan`);
          }
        }
      }
      for (const id of scene.ledger.closedWaves()) scene.state.markDone(id);
    }

    // The in-flight handle of this tree — ONE instance per invocation, built at the
    // tree root (not the slug workspace: the collision domain is the tree). The gate
    // only inspects it; the lifecycle's real dispatch path acquires it after the gate.
    // It is built HERE, before the value assembly, because the `--recover` abort fold
    // books a round the assembly must already count (see `folded` below).
    const inflight = new InFlight(scene.workspace.root, scene.workspace.slug);

    // THE host probe (P40 T6) — ONCE per invocation, handed to the three readers that
    // judge, spawn and forecast this dispatch: the pre-flight seam's `no-host` row, the
    // lifecycle harness's host row, and the preview's `child:` row. A second probe
    // could answer differently and make the three disagree about the same invocation.
    const host = HostDetect.detect(process.env);

    // P40 T4 — the dispatch's value record and artifact snapshot, assembled ONCE here
    // and handed to the seam: the frames `Lifecycle#peekNext()` would build do not exist
    // yet (the run is constructed only after the verdict), and a frame-bound producer is
    // exactly what this assembly retires. The seam's four rows and the renderer read the
    // SAME record.
    //
    // The `--recover` flag's ONE derived value: `--dry-run` VOIDS it — the preview never
    // takes over, never folds and never reopens, so it also judges the in-flight row as
    // an ordinary invocation does. Every reader below (the stale read, the seam's
    // `recover` input, the recovery legs, the dispatch seam's own fold and the harness's
    // acquire permission) takes THIS value: four spellings of the conjunction are four
    // chances for the composer to allocate over a round the fold never books.
    const recover = !parsed.dryRun && parsed.args.recover === "true";

    // The round `--recover` is about to fold: the recovery legs run AFTER the verdict
    // (P30 §2.1④ — a dirty tree is never displaced by an argument), so at this instant
    // the ledger does not hold the killed round yet, while the dispatch that follows
    // will allocate over it. `AbortFold` is the fold's OWN reader, so the cycle and the
    // attempt the prompt names and the round record lands on are one pair of numbers.
    const stale = recover ? await inflight.staleState() : null;
    const folded = stale?.kind === "held" ? AbortFold.bookedOf(stale.record) : null;
    const before = this.#beforeOf({ scene, type, phase: expected, parsed, folded });

    // THE pre-flight seam (P4.1 T1 · design §1): the STRUCTURE gates —
    // tree-clean → in-flight → plan-carrier → graph → plan-ledger → doc-contract, then
    // the four pre-dispatch rows (P40 T4) — ONE call, the whole sequence lives in the
    // seam (session/preflight.ts), the CLI orchestrates the call + the verdict render
    // (zero re-implemented gate here). The dispatch's own phase is the authority's
    // verdict below (P27 §2), never a second seam. A refused verdict returns before any
    // brief/lifecycle: no child dispatch ever runs. The dirty-tree / doc-contract
    // refusals ride the CDD_BLOCKED channel; the graph / plan-ledger refusals keep the
    // pre-existing refusal face. The doc-face read path is the repoRoot-relative branded
    // `RepoPath` (T4 §2.2 — a bare `string` never reaches the read faces
    // `BoardView.readDocType`/`PreFlightDoc.path`; the CLI feeds the funnel-shaped
    // relative value, each read face erasing to the absolute syscall form through its OWN
    // `RepoRoot`). Both branches yield the brand through the ONE conversion entry
    // (`relativize` of the doc path; the empty path relativizes to the empty `RepoPath`)
    // — no cast (F3).
    const docRel = root.relativize(
      scene.target !== null && (scene.target.kind === "plan" || scene.target.kind === "spec")
        ? scene.target.doc
        : "",
    );
    // The in-flight handle of this tree is built above, with the value assembly.
    const preflight = await this.#preflightOf(repoRoot).vet({
      type,
      repoRoot: scene.workspace.root.repoRoot,
      plan: scene.plan,
      ledger: scene.ledger,
      doc: TargetFaceTable.isDocShape(type)
        ? {
            // The ONE declaration reading face (spec §12 · D34) — every doc shape
            // dispatch reads the doc's front-matter `doc-type:` key;
            // a key-less doc reads null and the seam BLOCKs (zero command-type
            // carve-out, zero filename-suffix fallback).
            docKey: BoardView.readDocType(root, docRel),
            path: docRel,
          }
        : null,
      inflight,
      // The explicit takeover flag — VOID under --dry-run (the ONE derived value): the
      // preview face never acquires, so a takeover there would have no write channel at
      // all. The preview still judges the same gate, sees the same holder facts, exits 1.
      recover,
      // P40 T4's five inputs — each with a producer at THIS root, none imported from
      // another plane: the value record and the snapshot are the assembly above, the
      // host cell is the ONE value HostDetect.detect answers above, the declarations
      // are the renderer's own row selection over that record, and the two scene facts
      // are the DECLARED documents' cells booleanized.
      host,
      values: before.values,
      declarations: this.#template.layoutOf(before.values),
      scene: { program: scene.program != null, docType: scene.docType != null },
      artifact: before.artifact,
    });

    // THE GATE-CLEAR anchor (P40 §2.2's first expiry trigger) — an anchor, not a span:
    // it sits AFTER `vet` returned and BEFORE the `--recover` takeover judgment below,
    // because a dispatch the structure leg did not refuse has invalidated every
    // structure refusal this tree carried (the record names a fact that no longer
    // holds). That predicate is not "nine rows passed": a batch-less wave dispatch
    // stands the four pre-dispatch rows down and answers the same `null`, and it clears
    // at this one gate too. Putting the clear after the verdict would leave a
    // `tree-clean` record standing through a dispatch that did not refuse on the
    // structure leg and only failed to find a takeover — the record would then outlive
    // the fact it stated.
    const structure = this.#authority.structureRefusal(preflight);
    if (structure === null && !parsed.dryRun) this.#refusalOf(scene).clear();

    // THE `--recover` judgment (P30 §2.1①–③ · P44 §2.1), at the composition root and
    // BEFORE the dispatch verdict: the takeover lands first, the supersede stamp second
    // and the `N+1` review dispatch third — the order is fixed HERE, never inside
    // `step()`. The judgment RUNS even when the structure leg refused: leg ① is
    // authorized by the in-flight gate's own pass (this tree's stale record, judged by
    // the gate that ran), never by the structure leg's verdict — a later gate's refusal
    // is a fact about a DOCUMENT, and it may not revoke the tree's cleanup. The
    // structure fact still reaches the judgment as its own cell: when no leg landed it
    // answers `allowed`, so the FIRST refuser keeps its verdict (a dirty tree or a live
    // holder is never displaced by an argument).
    const recovery = recover
      ? await this.#recoverRun({
          verb,
          type,
          scene,
          parsed,
          inflight,
          artifacts,
          values: before.values,
          host,
          preflight,
          structureRefused: structure !== null,
        })
      : null;
    if (recovery !== null && recovery.kind === "blocked") {
      this.#io.stderr(`${this.#words.station("blocked")} ${recovery.message}\n`);
      return 1;
    }

    // THE dispatch verdict (P27 §2.2) — ONE authority over the three legs, in
    // priority order: the structure leg (the pre-flight verdict just judged), the
    // upstream station leg, then this line's own phase. A refusal is ONE verdict —
    // the stderr face, the capsule's `next:` and the board's `next:` all read the
    // same hop, so a command can never name a round another face refuses. The
    // dispatch gate consults the verdict BEFORE its first write: a refused dispatch
    // creates no workspace, no brief, no round.
    const identity = this.#gate.lineIdentity(scene);
    const verdict = this.#authority.verdict({
      verb: verb as DispatchVerb,
      type,
      structure: preflight,
      line: {
        ledger: scene.ledger,
        words: this.#words,
        // The wave face's frontier source is the run state's own parsed graph (one
        // plan read per invocation); the doc/branch faces carry none.
        graph: scene.state instanceof TaskGraph ? scene.state : null,
        tasks: group,
        lineKey: identity.key,
        doc: identity.doc,
        pipeline: scene.pipeline,
        docClassOf: (candidate) => BoardView.docClassOf(scene.workspace.root.basis, candidate),
      },
    });
    if (!verdict.allowed) {
      if (verdict.leg === "structure") {
        // THE GATE-WRITE anchor (P40 §2.1 · §2.3) — an anchor, not a span: it sits in
        // this arm and BEFORE the render, so the record exists the moment the tree
        // refuses. A dry run writes nothing (the preview is a pure read).
        if (!parsed.dryRun)
          await this.#recordRefusal({
            scene,
            refusal: verdict,
            preflight,
            type,
            identity: before.identity,
          });
        if (parsed.dryRun && preflight.gate === "in-flight" && preflight.holding !== undefined) {
          // The preview's read-only held face — kept by PREDICATE, not by label: it
          // covers a live holder, a dead holder and a corrupt record with its lock
          // behind it (all three carry `holding`), each with its own `lock:` row and
          // hint and no `refused:` row. Zero write (the preview never acquires / steals
          // / releases).
          for (const line of new Preview({ scene, host, words: this.#words }).heldBlock(
            verb,
            preflight.holding,
          ))
            this.#io.stdout(`${line}\n`);
          // The checked face rides the SAME stdout stream here: every dry-run shape
          // (pass / dirty / held / blocked) reports which gates ran.
          this.#renderChecked(preflight, (text) => this.#io.stdout(text));
          return 1;
        }
        if (parsed.dryRun) {
          // The preview's refusal face (P40 T6) — the STRUCTURE leg's ONE refusal
          // renderer, on stdout: the block, the seam's details rows, then the checked
          // face. `CDD_BLOCKED:` rides no stream here, so a forecast can never print a
          // sentence the real run's channel does not own.
          for (const line of new Preview({ scene, host, words: this.#words }).artifactBlock(
            verb,
            this.#authority.message(verdict, { detail: preflight.message }),
          ))
            this.#io.stdout(`${line}\n`);
          for (const detail of preflight.details ?? []) this.#io.stdout(`  ${detail}\n`);
          this.#renderChecked(preflight, (text) => this.#io.stdout(text));
          return 1;
        }
        this.#renderPreflightBlocked(verb, verdict, preflight);
        return 1;
      }
      this.#renderLineRefusal(verb, expected, verdict, scene, preflight);
      return 1;
    }
    // The approved path's checked face (P21 §3.4): the SAME rows the refusal path
    // renders — every dispatch reports which rules ran, not only the blocked ones.
    this.#renderChecked(preflight);

    // The real run's first write point (P11 · §4.2): the workspace — and the
    // namespace's `.gitignore` keep-out marker — is built HERE, after the
    // pre-flight verdict and before the brief render / the child dispatch, for
    // EVERY face (wave / spec / plan / branch). Scene assembly no longer
    // pre-creates it, so a read-only command leaves `.kairos/` absent while a
    // real dispatch always lands in an existing workspace (the child's
    // OUTPUT_REPORT / OUTPUT_HANDOFF targets, and the keep-out marker published
    // before the child can dirty the tree). `Workspace.writeJson` keeps its own
    // internal ensure; `CliGate#renderBrief` no longer ensures. The `--dry-run`
    // preview never reaches it — the preview path returns before any write
    // (P11 T5 · §3.2: a preview is a pure read).
    if (!parsed.dryRun) scene.workspace.ensure();

    // The unconditional extract (§4.1): every wave-face dispatch re-renders the
    // brief from the CURRENT plan text — implement, review and fix alike (a
    // mid-run plan amendment reflects into the next dispatch; no "exists → leave
    // it" reuse). The doc/branch faces carry no wave brief (the plan read is the
    // derived same-slug document there, so the wave face is the only caller).
    // The preview skips it — the brief is a WRITE (`Workspace#writeText`), and the
    // preview names the same path through RoundNaming instead of rendering it.
    if (!parsed.dryRun && type === "wave" && scene.plan.kind === "ready") {
      const { text, doc } = scene.plan.document();
      scene.briefPath = this.#gate.renderBrief(scene, parsed, text, doc);
    }
    const statuses: (RoundStatus | null)[] = [];
    const { step: dispatch } = await this.#dispatchOf({
      scene,
      parsed,
      recovered: recovery !== null,
      recover,
      artifacts,
      values: before.values,
      host,
    });
    const run = new Lifecycle({
      face: scene.face,
      state: scene.state,
      ledger: scene.ledger,
      router: scene.router,
      // The dispatch-entry pre-flight wiring (P4.1 T1): the single seam verdict the
      // work command computed rides the lifecycle's gate — a refused frame is
      // structurally never passed to the child (the lifecycle's hard "child zero-dispatch"
      // guarantee; the CLI already returned above when the seam refused). The APPROVED
      // verdict is handed over too, not folded to `null`: its `findings` cell is the fix
      // round's contract baseline (P42 §7), so folding it here would leave every
      // production round with an empty baseline while the tests still passed.
      preflight: { gate: () => preflight },
      dispatch: async (frame) => {
        const outcome = await dispatch(frame);
        statuses.push(outcome.status ?? null);
        return outcome;
      },
      target: scene.target ?? undefined,
      capsule: new Capsule(
        this.#words,
        ARGV_CHANNEL,
        HostDetect.detect(process.env),
        scene.workspace.root.basis,
      ),
      plan: scene.plan,
      specType: scene.pipeline.specType,
      specPath: scene.pipeline.specPath,
      // The hop derivation's pipeline-station discrimination (§5.2) — the ONE
      // declaration-reading judgment, injected so the session plane never imports a
      // face class.
      docClassOf: (candidate) => BoardView.docClassOf(scene.workspace.root.basis, candidate),
    });

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
      const peeked = run.peekNext();
      if (peeked === null) break;
      const frame = peeked.frame;
      const waveTasks = frame.target.kind === "wave" ? frame.target.tasks : null;
      const mismatch =
        frame.phase !== expected ||
        (group !== null && (waveTasks === null || !waveTasks.every((id) => group!.has(id))));
      if (mismatch) {
        if (dispatched === 0) {
          // The lookahead refusal renders the SAME `NextHop` the frame's line just
          // derived (`peekNext`), through the ONE message shape — so one command can
          // never print two different "next round" answers (the gate refusal above
          // and this one name one object). The wave key stays an added clause.
          const waveContext = waveTasks !== null ? ` for wave ${waveTasks.join(",")}` : "";
          const reject = `${this.#gate.lineHopMessage(scene, peeked.hop, this.#words)}${waveContext}`;
          this.#io.stderr(`cdd ${verb}: cannot dispatch a ${expected} round — ${reject}\n`);
          return 1;
        }
        break;
      }
      // The `--dry-run` preview (P11 T5 · §3.3) — the SAME frame the real run would
      // dispatch, rendered as the five-row forecast instead of dispatched: the
      // frontier read above is the preview's single step source (zero second
      // derivation), and the early return means no write point below ever runs
      // (`renderBrief` skipped above, `#bookkeep`/`#reject` never reached).
      if (parsed.dryRun) {
        // The pre-flight seam already judged this dispatch ONCE, before this loop: the
        // four pre-dispatch rows are the seam's (P40 T4/T5), so the preview holds no
        // gate mirror — a second ask here would be a second source of truth for the
        // same judgment, and a refused dispatch never reaches the preview at all (the
        // seam's verdict returned at the composition root). The `--dry-run` arm is
        // therefore a pure forecast: read the frame, render the five rows.
        const preview = new Preview({ scene, host, words: this.#words });
        for (const line of preview.render(verb, frame)) this.#io.stdout(`${line}\n`);
        return 0;
      }
      // The gate→acquire race: another dispatch took the lock between the in-flight
      // gate's read and this dispatch's acquire. `HoldingError` carries the holder's
      // facts and renders the SAME held BLOCK message the gate renders.
      let step: Awaited<ReturnType<Lifecycle["advance"]>>;
      try {
        step = await run.advance();
      } catch (error) {
        if (!(error instanceof HoldingError)) throw error;
        this.#renderHeld(error);
        return 1;
      }
      if (step === null) break;
      // The dispatch-entry gate's refusal (the lifecycle's hard child zero-dispatch wiring —
      // structurally unreachable here: the seam already returned above on refusal).
      if (step.preflight !== undefined) {
        // The lifecycle re-states the seam's refusal (structurally unreachable — the
        // verdict above already returned on it): the structure leg's own line.
        const rejection = this.#authority.structureRefusal(step.preflight);
        if (rejection !== null) this.#renderPreflightBlocked(verb, rejection, step.preflight);
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
      // The timeout counter's call site (§4.2): a round that was cut short lands, the
      // count goes up by one — driven by the termination fact alone, never the status
      // word (the counter's only production writer).
      if (step.termination !== undefined) scene.ledger.incrementTimeoutCount();
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

  /** The dispatch seam — the injected override, else the harness production default.
   *  The call itself is unconditional (the caller resolves the step before the
   *  preview branch), but under `--dry-run` the preview path returns before the
   *  step is INVOKED — `dispatch(frame)` is never called (P11 T5 · §3.2) — so the
   *  retired synthetic approval (`() => ({ status: "APPROVED", findings: [] })`)
   *  has no remaining caller: a preview books no round and fabricates no
   *  conclusion. */
  async #dispatchOf(parts: DispatchParts): Promise<{ step: DispatchStep }> {
    const { scene, parsed, recovered, recover, artifacts, values, host } = parts;
    if (this.#dispatch !== null) return { step: this.#dispatch };
    const harness = this.#lifecycleOf({ scene, parsed, artifacts, recover, values, host });
    // The abort fold already ran at the composition root's `--recover` judgment
    // (`#recoverRun`) when `recovered`; the injected/default face keeps its own fold
    // here, so the takeover always precedes this dispatch's own record. `recover` is
    // the composition root's ONE derived value — never a second reading of the flag.
    if (!recovered && recover) {
      await harness.foldAbort();
    }
    // The harness stays private to this method: the `--dry-run` branch asks it nothing
    // (P40 T5 retired the gate mirror — the seam is the ONE ask), so the ONLY reader of
    // a built harness is the dispatch step itself.
    return { step: harness.step() };
  }

  /** The `--recover` judgment (spec §2.1①–③) — the two legs, judged in order and
   *  allowed to stack:
   *    ① the ABORT leg — a stale in-flight record is taken over and, when it still
   *      names the killed round, folded into the ledger (`foldAbort`);
   *    ② the REOPEN leg — `review` on a doc / branch line only, at drift ∧ pending-fix,
   *      with no round in flight: the old review is stamped `supersededBy` and the
   *      dispatch that follows allocates `N+1`;
   *    ③ neither → the double-gap BLOCKED, naming both missing conditions, and no
   *      dispatch at all.
   *  The ORDER is the ruling (§2.1④): the abort fold first, the stamp second, the
   *  `N+1` dispatch third — it lives here, not in `step()`'s internals. `fix --recover`
   *  and `implement --recover` take leg ① only (never a reopen), wave lines likewise
   *  (their reopen face stays P29's brief-drift).
   *
   *  The two legs' AUTHORIZATIONS differ (P44 §2.1–§2.2): leg ① is the in-flight
   *  gate's own pass — the record's stale morphology plus a `checked` face that
   *  carries the gate's row, i.e. a tree-clean gate that already passed; legs ②③ keep
   *  the structure leg (`structure === null`) because they write the DOCUMENT's ledger
   *  (a supersede stamp and the `N+1` dispatch), which a refusing document gate must
   *  hold back. */
  async #recoverRun(parts: {
    verb: CliVerb;
    type: TargetType;
    scene: WorkScene;
    parsed: RunInput;
    inflight: InFlight;
    artifacts: ArtifactRegistry;
    values: Readonly<Record<string, string>>;
    host: HostId | "";
    /** The seam's verdict for this dispatch — read for its `checked` face (the
     *  in-flight gate's own row), never for its `ok` cell: a refusal that reaches the
     *  in-flight gate still carries that row, and the row is what says the gate judged
     *  THIS tree. */
    preflight: PreFlightVerdict;
    /** Whether the structure leg refused — the caller's `structureRefusal` cell. A
     *  refusal without a landed leg leaves the verdict to that first refuser, so the
     *  judgment answers `allowed` instead of the double-gap BLOCK. */
    structureRefused: boolean;
  }): Promise<RecoverRun> {
    const { verb, type, scene, parsed, inflight, artifacts, values, host } = parts;
    // The fold rides a throwaway harness: this judgment runs BEFORE the wave brief is
    // rendered, and the DISPATCHING harness must be built afterwards (its scene snapshot
    // carries `briefPath` — the dispatch-input gate reads it). `foldAbort` touches only
    // the in-flight record and the ledger, so a pre-brief instance is enough. The value
    // record is the root's ONE assembly (P40 T5) — the fold renders nothing, so the
    // throwaway instance carries the SAME object the dispatching one will.
    const stale = (await inflight.staleState()) !== null;
    // LEG ① authorization: two read facts, both required (spec §2.1). The `in-flight:`
    // row says tree-clean passed and the in-flight gate judged this tree — a dirty
    // tree's refusal stops BEFORE that row is pushed, so a stale record on a dirty tree
    // is never folded; and `staleState()` says the gate passed (a live holder's record
    // answers null, which is why the flag never crosses `alive`). Neither cell is a
    // restatement of the other: the row alone cannot say the gate passed (it is pushed
    // before the refusal it may itself carry), and `staleState()` alone cannot say
    // tree-clean passed.
    const takenOver = stale && Cli.#inFlightJudged(parts.preflight.checked);
    // `true`: this judgment runs ONLY under the derived `--recover` (the caller's guard),
    // so the harness it builds holds the takeover permission by construction.
    if (takenOver)
      await this.#lifecycleOf({
        scene,
        parsed,
        artifacts,
        recover: true,
        values,
        host,
      }).foldAbort();
    const reopened = parts.structureRefused
      ? false
      : await this.#reopenLeg(verb, type, scene, inflight);
    if (takenOver || reopened) return { kind: "allowed" };
    // A structure refusal is the tree's own verdict: the judgment never overrides the
    // first refuser with its own double-gap message.
    if (parts.structureRefused) return { kind: "allowed" };
    return { kind: "blocked", message: RECOVER_NOTHING };
  }

  /** Whether the seam's `checked` face carries the in-flight gate's row — the ONE
   *  reading of leg ①'s first fact (spec §2.1). The row's own state word is NOT the
   *  judgment: `#inFlightRow` runs before `#inFlightRefusal`, so a refusal the
   *  in-flight gate itself owns carries the row too. */
  static #inFlightJudged(checked: readonly string[]): boolean {
    return checked.some((row) => row.startsWith("in-flight:"));
  }

  /** The reopen leg (spec §2.3) — its three conditions judged here, and the stamp
   *  written when all hold: ① `reviewGate` open (the doc drifted), ② a fix still owed
   *  (`pendingFix`), ③ no round in flight (a live holder was refused upstream; a stale
   *  one was already taken over). Trigger face pinned: `review` on a doc / branch line
   *  ONLY — `fix` / `implement` and the wave line never reopen. Returns whether the
   *  supersede stamp landed. */
  async #reopenLeg(
    verb: CliVerb,
    type: TargetType,
    scene: WorkScene,
    inflight: InFlight,
  ): Promise<boolean> {
    if (verb !== "review") return false;
    if (type !== "branch" && !TargetFaceTable.isDocShape(type)) return false;
    const identity = this.#gate.lineIdentity(scene);
    if (identity.key === null || identity.doc === null) return false;
    const state = await inflight.inspect();
    if (state.kind !== "absent" || existsSync(inflight.lockPath())) return false;
    const ledger = scene.ledger;
    if (ledger.reviewGate(identity.key, identity.doc, type).kind !== "open") return false;
    if (!ledger.pendingFix(identity.key, type)) return false;
    const completed = ledger.completedCycles(identity.key, "review");
    if (completed.length === 0) return false;
    // The next review cycle is the latest completed review's + 1 — allocated BEFORE
    // the stamp lands (the spec's fixed action order), and it is exactly the cycle the
    // following dispatch allocates (the register's cycle count is unchanged by a stamp).
    const latest = Math.max(...completed);
    return ledger.supersedeReview(identity.key, latest, latest + 1);
  }

  /** The invocation's lifecycle harness — the production dispatch face, built at the
   *  point of use and never held across the brief render. The scene snapshot it copies
   *  carries `briefPath`, which `CliGate#renderBrief` writes and the dispatch-input gate
   *  reads, so the dispatching instance must be built AFTER the brief lands — building
   *  it earlier snapshots `briefPath: null` and refuses every dispatch. The `--recover`
   *  abort fold (the takeover that precedes the stamp, spec §2.1④) therefore rides its
   *  own throwaway instance in `#recoverRun`: it touches only the in-flight record and
   *  the ledger, so a pre-brief instance is enough. */
  #lifecycleOf(parts: {
    scene: WorkScene;
    parsed: RunInput;
    artifacts: ArtifactRegistry;
    recover: boolean;
    values: Readonly<Record<string, string>>;
    host: HostId | "";
  }): CliLifecycle {
    const { scene, parsed, artifacts, recover, values, host } = parts;
    return new CliLifecycle({
      sync: this.#sync,
      template: this.#template,
      io: this.#io,
      words: this.#words,
      scene: {
        workspace: scene.workspace,
        ledger: scene.ledger,
        planPath: scene.planPath,
        plan: scene.plan,
        briefPath: scene.briefPath,
        baseBranch: this.#baseBranchOf(scene),
        specLink: scene.specLink,
        overallLink: scene.overallLink,
        program: scene.program,
        docType: scene.docType,
      },
      reviews: parsed.paths.reviews,
      // The ONE contract instance the pre-flight gate judged with — the fix round's
      // close-out leg runs the same `Contract.validate`, so both readings come from one
      // registry (P42 §7). A second instance here would be a second source of truth.
      contract: this.#contract,
      // The explicit takeover flag (`--recover`): the ONLY path that displaces a
      // standing in-flight record — and only when its holder is dead. The caller's ONE
      // derived value (void under `--dry-run`, which never dispatches this harness).
      recover,
      // The same matrix instance the scene's ledger and router hold.
      artifacts,
      // The dispatch's value record — composed ONCE at this root, judged by the seam and
      // rendered here: one assembly, two consumers (P40 T5).
      values,
      // The host id the root probed ONCE — the spawn's table row (P40 T6).
      host,
      // The dispatch's ONE closure reading — the accessor the pre-flight closure port and
      // the lifecycle's doc gate resolve, so the shape gate and the doc gate share one
      // doc scan.
      closedDocument: () => this.#closedOf(scene.workspace.root.repoRoot),
    });
  }

  /** The branch scope anchor (BASE_BRANCH) — the base artifact's branch name read
   *  from the line's own workspace (`base.json`, the same `base get` source the CLI
   *  writes). "" when the artifact is absent or malformed.
   *
   *  WAS: the empty slot was dropped and the wave / branch review silently fell back
   *  to judging the live tree. NOW: P38 §2.3 reversal ④ — `BASE_BRANCH` is required on
   *  every wave / branch face, so an empty value is `empty-value` at the
   *  dispatch-input gate: the round stops before the child exists (the recovery is
   *  `cdd base set`, the orchestrator's action, never the gate's). */
  #baseBranchOf(scene: WorkScene): string {
    const name = this.#matrix.render({ domain: "workspace", tasks: null }, "base");
    const read = scene.workspace.readJson<{ base?: unknown }>(name);
    const artifact = read.kind === "ok" ? read.value : null;
    return typeof artifact?.base === "string" ? artifact.base : "";
  }

  /** The pre-frame dispatch assembly: the identity, the flat value record and the
   *  artifact snapshot the seam judges (and, after Task 5, the renderer renders). It
   *  runs BEFORE `PreFlight#vet` because the frames `Lifecycle#peekNext()` builds do not
   *  exist yet — every fact here is a flat, frame-free value: the ledger's recorded
   *  rounds, the argv's parsed paths, the workspace's own directory, the naming face's
   *  rendered names. ONE assembly, two consumers. The five inputs ride one object: the
   *  assembly reads exactly five facts and its only caller writes them once. */
  #beforeOf(parts: BeforeParts): {
    identity: DispatchIdentity;
    values: Readonly<Record<string, string>>;
    artifact: ArtifactSnapshot;
  } {
    const { scene, type, phase, parsed, folded } = parts;
    // The wave's task group is the OPEN batch the frame builder will read — the SAME
    // `frontier(doneTasks())` call `Lifecycle#openWaveFrame` makes, taken after the
    // closed waves were mirrored into the run state above.
    const tasks = type === "wave" ? scene.state.frontier(scene.state.doneTasks()).join(",") : "";
    const key = this.#gate.lineIdentity(scene).key ?? tasks;
    // The round verb is folded ONCE (`branch-review` → `review`): the identity's `op`, the
    // rendered artifact names and the attempt allocation all read this value, so the
    // refusal record and the prompt cannot name two different verbs.
    const op = RoundRecords.opOf(phase) ?? "review";
    const { cycle, attempt } = ConsumedRound.of(scene.ledger, phase, key, folded);
    const identity: DispatchIdentity = { op, type, phase, tasks, cycle, attempt };
    const carrier = { type, key, cycle, tasks };
    // The carrier reaches the snapshot as its producer holds it (an absolute workspace
    // path, or the repo-relative `--reviews` value): the module's OWN basis conversion
    // is the only one this value takes, so no call site normalizes it twice. The
    // record's `INPUT_REVIEWS` cell is that same value collapsed by `compose`.
    const reviewsPath = RequestingCarrier.path(scene.ledger, parsed.paths.reviews, carrier);
    const digest = RequestingCarrier.requesterRecord(scene.ledger, carrier)?.carrierDigest ?? null;
    // The snapshot is the assembly's third cell (P40 T5 lifted it beside the composer):
    // ONE read of the sidecar, the same value the seam judges and the record names.
    const artifact = ArtifactSnapshots.of({
      artifacts: this.#matrix,
      workspace: scene.workspace,
      words: this.#words,
      op,
      reviewsPath,
      digest,
    });
    const roundArtifact = RoundNaming.artifactOf(op, type, { tasks, round: cycle, attempt });
    const plane = HandoffSchema.planeOf(op);
    const sceneFacts: DispatchSceneFacts = {
      repoRoot: scene.workspace.root.basis,
      docPath:
        scene.target !== null && (scene.target.kind === "plan" || scene.target.kind === "spec")
          ? scene.target.doc
          : null,
      planPath: scene.planPath,
      specLink: scene.specLink,
      overallLink: scene.overallLink,
      baseBranch: this.#baseBranchOf(scene),
      // The engine-written brief: the exact name `CliGate#renderBrief` lands, derived
      // here so the value exists BEFORE the file does (the seam judges the declaration —
      // the engine guarantees that file — never the disk).
      briefPath: tasks === "" ? "" : scene.ledger.naming().brief(tasks),
      workspaceDir: scene.workspace.path,
      workspaceId: scene.workspace.slug,
      reportPath: path.join(scene.workspace.path, RoundNaming.renderName(roundArtifact, "report")),
      evidencePath: scene.ledger.naming().evidencePathOf(roundArtifact, type, phase),
      handoffPath: scene.ledger.handoffPath(op, type, { tasks, round: cycle, attempt }),
      handoffSchema: new HandoffSchema().schemaText(
        plane,
        plane === "work" && (type === "wave" || type === "branch"),
      ),
    };
    return { identity, values: DispatchValues.compose(identity, sceneFacts, artifact), artifact };
  }

  /** The tree's refusal record handle — stateless: the record is the state, so a fresh
   *  handle per use cannot disagree with another one over the same root. */
  #refusalOf(scene: WorkScene): PreFlightRefusal {
    return new PreFlightRefusal(scene.workspace.root, scene.workspace.slug);
  }

  /** Publish the refusal record (P40 §2.1) — this tree's ONE persistent fact about a
   *  dispatch the structure leg refused: the station that refused plus the verdict's
   *  FIRST line with its station word stripped off (the station is a cell of its own).
   *  The identity cells are the SAME `DispatchIdentity` the composer assembled and the
   *  seam judged — never a second derivation here, so the record names the exact round
   *  the next dispatch will consume. The continuation lines (`derived:` · `found:` ·
   *  `identity:` · `repair:`) describe the work this refusal did not do and never land
   *  in the file (§2.1: eight cells, one line). A publish the tree refuses (a read-only
   *  root) is reported and swallowed: the record OBSERVES the refusal, it never stands
   *  between the user and the reason the dispatch refused. */
  async #recordRefusal(parts: {
    scene: WorkScene;
    refusal: DispatchRefusal;
    preflight: PreFlightVerdict;
    type: TargetType;
    identity: DispatchIdentity;
  }): Promise<void> {
    const facts = this.#refusalFactsOf(parts);
    if (facts === null) return;
    try {
      await this.#refusalOf(parts.scene).write(facts);
    } catch (error) {
      // A tree whose root refuses the write (a read-only checkout, a root-owned CI
      // mount) still gets the diagnosis it asked for: the record is an OBSERVATION
      // about the refusal and never its precondition, so a failed publish costs ONE
      // diagnostic line. Rethrowing would trade the station line for a bare errno and
      // hide the reason the dispatch refused (spec §2.2's write anchor).
      const reason = error instanceof Error ? error.message : String(error);
      this.#io.stderr(`cdd: the refusal record was not published — ${reason}\n`);
    }
  }

  /** The eight cells the write anchor publishes, or null when the verdict names no
   *  station (a structure refusal always carries one). Split out so the publish's
   *  failure arm stays the only branch in `#recordRefusal`. */
  #refusalFactsOf(parts: {
    scene: WorkScene;
    refusal: DispatchRefusal;
    preflight: PreFlightVerdict;
    type: TargetType;
    identity: DispatchIdentity;
  }): RefusalFacts | null {
    const station = parts.preflight.gate;
    if (station === undefined) return null;
    const line = this.#authority.message(parts.refusal, { detail: parts.preflight.message });
    const join = this.#words.preflightWording().dispatchInput.stationJoin;
    const prefix = `${station}${join}`;
    const head = line.split("\n")[0] ?? "";
    return {
      at: new Date().toISOString(),
      slug: parts.scene.workspace.slug,
      op: parts.identity.op,
      type: parts.type,
      cycle: parts.identity.cycle,
      attempt: parts.identity.attempt,
      station,
      detail: head.startsWith(prefix) ? head.slice(prefix.length) : head,
    };
  }

  /** Render a refused STRUCTURE-leg verdict — the work command's BLOCK face (P4.1
   *  T1). The structure leg's ONE line (§2.6) is `<reason> · <the seam's own
   *  wording>`: the dirty-tree / doc-contract rows ride the CDD_BLOCKED channel (the
   *  commit/discard guidance + the named structural findings), the graph /
   *  plan-ledger rows keep their refusal face. The leg names no hop — a refused
   *  structure carries no `next:` round. */
  #renderPreflightBlocked(
    verb: CliVerb,
    rejection: DispatchRefusal,
    preflight: PreFlightVerdict,
  ): void {
    const message = this.#authority.message(rejection, { detail: preflight.message });
    // The channel-ownership condition is the SECOND place a gate row is added (the
    // first is `PreFlightGateName`): the CDD_BLOCKED channel owns `tree-clean` ·
    // `in-flight` · `doc-contract` and the four pre-dispatch rows; the `cdd <verb>: …`
    // channel keeps `graph` · `plan-ledger`. A row added to the type but not here would
    // be printed on the wrong channel — `cdd review: dispatch-input · …` instead of
    // `CDD_BLOCKED: dispatch-input · …`.
    if (
      preflight.gate === "tree-clean" ||
      preflight.gate === "in-flight" ||
      preflight.gate === "doc-contract" ||
      preflight.gate === "no-host" ||
      preflight.gate === "carrier" ||
      preflight.gate === "dispatch-input" ||
      preflight.gate === "artifact"
    ) {
      this.#io.stderr(`${this.#words.station("blocked")} ${message}\n`);
      for (const detail of preflight.details ?? []) this.#io.stderr(`  ${detail}\n`);
      this.#renderChecked(preflight);
      return;
    }
    this.#io.stderr(`cdd ${verb}: ${message}\n`);
    for (const detail of preflight.details ?? []) this.#io.stderr(`  ${detail}\n`);
    this.#renderChecked(preflight);
  }

  /** Render a refused LINE-leg verdict (§2.6) — ONE line, `<reason> · next: <the
   *  command the capsule and the board print>`. The wave face's split row keeps its
   *  wave-board hint (the graph the refusal is about — its done face rides the SAME
   *  closedWaves() read the gate judged, one closed set, one source), and the checked
   *  face reports the structure gates that passed. */
  #renderLineRefusal(
    verb: CliVerb,
    expected: DispatchPhase,
    rejection: DispatchRefusal,
    scene: WorkScene,
    preflight: PreFlightVerdict,
  ): void {
    const message = this.#authority.message(rejection, {
      command: (hop) => this.#gate.hopCommand(scene, hop, this.#words),
    });
    this.#io.stderr(`cdd ${verb}: cannot dispatch a ${expected} round — ${message}\n`);
    if (rejection.reason === "split" && scene.plan.kind === "ready") {
      this.#renderWaveBoard(scene, scene.plan);
    }
    this.#renderChecked(preflight);
  }

  /** The wave-board hint of a split refusal — the derived graph the refusal is
   *  about, rendered on the stderr detail channel. */
  #renderWaveBoard(scene: WorkScene, read: PlanRead): void {
    const graph = read.graph();
    if (graph === null) return;
    const closed = scene.ledger.closedWaves();
    // The graph title's plan path renders repoRoot-relative (D47 · the ONE shape;
    // `scene.planPath` is argv-origin) — normalized through the scene's OWN basis
    // value object (F2: never a per-call re-wrap).
    const titlePlan = scene.workspace.root.basis.relativize(scene.planPath ?? "");
    for (const line of this.#graphView
      .render(graph.report(closed), `graph: ${titlePlan}`)
      .split("\n"))
      this.#io.stderr(`  ${line}\n`);
  }

  /** Render the acquire race's held BLOCK — the in-flight gate's own message face
   *  (`Words.inFlightBlocked`, one filler for both call sites), exit 1 at the caller. */
  #renderHeld(error: HoldingError): void {
    const message = this.#words.inFlightBlocked(error.record, true);
    this.#io.stderr(`${this.#words.station("blocked")} ${message}\n`);
  }

  /** Render the checked face — the pre-flight's per-gate / per-rule rows, derived by
   *  the seam from the ONE rule declaration surface (P21 §3.4). It renders on BOTH
   *  pre-flight paths (approved and refused) into the diagnostic channel by default;
   *  the dry-run held preview passes its stdout writer so every dry-run shape reports
   *  the same face: "which rule ran, and what it judged" is a production read face,
   *  never a test-only field. The heading and the outcome words come from the word
   *  table (zero CLI literal), and the rows indent exactly like the details face
   *  above them. */
  #renderChecked(verdict: PreFlightVerdict, write?: (text: string) => void): void {
    const out = write ?? ((text: string) => this.#io.stderr(text));
    out(`${this.#words.checkedWords().heading}\n`);
    for (const row of verdict.checked) out(`  ${row}\n`);
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
    planSource: PlanSource,
    parsed: RunInput,
  ): Promise<{ scene: WorkScene; artifacts: ArtifactRegistry } | null> {
    const config = this.#config;
    const face = targetFaces[type];
    const repoRoot = root.absolute;
    const rootPath = new WorkspaceRoot(repoRoot, config.handoffNamespace().workspaceRoot);
    // The argv paths ride the ONE funnel (T3 §2.3): the READ faces consume the branded
    // `RepoPath` (`parsed.paths`), while the scene's own `planPath`/`target.doc` — the
    // facts the ledger persists and the syscalls read — are the value object's `resolve`
    // erasure (the absolute syscall form; their persisted shape is T4's face). Both
    // derive from the same funnel, so there is zero second normalization — the brand
    // reaches here with NO downcast (F7).
    const planRel = parsed.paths.plan;
    const planPath = planRel === null ? null : root.resolve(planRel);
    const specRel = parsed.paths.spec;
    const specPath = specRel === null ? null : root.resolve(specRel);
    // The identity index — the ONE slug judgment (spec §2.1/§2.2). The workspace
    // key is the target document's declared `slug:`; the same index supplies the
    // same-slug spec link and the duplicate gates.
    const index = this.#indexOf(repoRoot);

    let slug: string;
    let plan: PlanRead;
    let specLink: string | null = null;
    let overallLink: string | null = null;
    let target: WorkScene["target"] = null;
    /** The slug's declared identity document, when the face looks one up — the plan
     *  and branch lines carry it as the round context's spec anchor. */
    let specDoc: DocEntry | null = null;
    switch (type) {
      case "wave": {
        if (planPath === null || planRel === null)
          this.#usage(node, `cdd ${verb} --type wave: missing required --plan <path>`);
        plan = this.#argvPlanOf(node, planSource, planRel);
        const resolved = this.#targetSlug(index, planRel, plan);
        if (resolved === null) return null;
        slug = resolved;
        break;
      }
      case "phase-spec":
      case "overall":
      case "single-spec": {
        if (specPath === null || specRel === null)
          this.#usage(node, `cdd ${verb} --type ${type}: missing required --spec <path>`);
        // An unreadable target declares no identity: the SAME slug carrier hard-refuses
        // it (CDD_BLOCKED + exit 1, never a filename-derived key). The T7 null-verdict
        // face covers the other shape — a document ON DISK that declares no
        // `doc-type:` / `slug:`.
        const specEntry = index.entryAt(specRel);
        const resolved = this.#targetSlugText(index, specRel, this.#readTarget(root, specRel));
        if (resolved === null) return null;
        slug = resolved;
        target = { kind: "spec", doc: specPath };
        // The plan face of a doc round is the SAME derived document every other face
        // derives (`plans/<the identity doc's slug>.md`), read through the derived
        // entry — so the doc round and the plan round speak one document. The read
        // is derived on EVERY face, never re-pointed at an index-registered file
        // name: identity is the slug, the path is derived from it.
        plan = planSource.readFor(specEntry);
        // The judged document's own `program:` — the parent charter (INPUT_OVERALL)
        // the phase-spec reviewer judges the phase against. A document without
        // `program:` (an overall charter or a single-spec) leaves the slot null; an
        // off-disk target reads null here and the existing slug-ref invariant reports
        // it (never a second reporter).
        const overallEntry = specEntry?.program == null ? null : index.overallOf(specEntry.program);
        overallLink = overallEntry === null ? null : root.relativize(overallEntry.path);
        break;
      }
      case "plan":
      // fallthrough to the shared plan-sourced derivation below
      case "branch": {
        // The plan-doc seam (shared by the plan + branch lines): the target plan
        // must exist (a required fact for both — the branch review/fix faces carry
        // `--plan`), its text is read ONCE, and the same-slug identity document (the
        // index's SET answer — never a path scalar) supplies the round context's
        // extra read input. Its PATH is read through the doc domain after the
        // workspace exists (below), so the path and the identity come from one read.
        // The plan review judges the plan doc; the branch line carries no commit
        // identity (the audit target is the branch itself, its workspace identity is
        // the plan path, and the review's scope anchor BASE_BRANCH is engine-injected
        // from the base artifact) — both faces carry the plan + its same-slug spec
        // anchor.
        if (planPath === null || planRel === null)
          this.#usage(node, `cdd ${verb} --type ${type}: missing required --plan <path>`);
        plan = this.#argvPlanOf(node, planSource, planRel);
        const resolved = this.#targetSlug(index, planRel, plan);
        if (resolved === null) return null;
        slug = resolved;
        specDoc = this.#specDocOf(index, slug);
        // The plan/branch line reads the same-slug identity document's `program:` —
        // the parent charter (INPUT_OVERALL) the reviewer judges the plan against.
        const overallEntry = specDoc?.program == null ? null : index.overallOf(specDoc.program);
        overallLink = overallEntry === null ? null : root.relativize(overallEntry.path);
        target = type === "plan" ? { kind: "plan", doc: planPath } : { kind: "branch" };
        break;
      }
    }

    // The workspace is NOT built here (P11 · §4.2): scene assembly is a READ face —
    // the real run's single write point builds it (`Cli#runWork`'s explicit ensure,
    // every face), so a read-only command never creates `.kairos/`. The one-time
    // legacy migration retired with this build: the `Workspace.readJson` read-time
    // normalization is the ONE heal path, covering `base.json` alongside
    // `progress.json` (a second healing point is gone).
    const workspace = new Workspace(rootPath, slug);
    // The artifact matrix — the invocation's ONE instance (the command preamble's),
    // handed down: the ledger, the router, the lifecycle's seal sweep and the board all
    // read the same table, so no face can spell an artifact name of its own.
    const artifacts = this.#matrix;
    const ledger = new Ledger(workspace, config, planSource, artifacts);
    // The run state degrades to the empty state on a non-ready plan: the scene is
    // assembled BEFORE the pre-flight verdict, and the refusal leg (Task 4's
    // doc-contract leg) stops the dispatch before any `state` consumer runs. No
    // try/catch: the read has already happened, so assembly has no throw point.
    const graph = plan.graph();
    const state: RunState = type === "wave" && graph !== null ? graph : EMPTY_RUN_STATE;
    // The identity document the pipeline frontier names — the plan/branch faces already
    // looked it up; the wave and doc-target faces look it up from their own slug.
    specDoc ??= this.#specDocOf(index, slug);
    // ONE read of that document, through the doc domain: a duplicated identity
    // (`invalid(found)`) supplies NO path — the slug carrier has already refused that
    // shape, so this face never picks a first document to hand downstream.
    const identityRead =
      specDoc === null || specDoc.docType === null
        ? null
        : artifacts.read(
            { domain: "doc", slug, docType: specDoc.docType },
            specDoc.docType,
            workspace,
          );
    const identityPath = identityRead?.kind === "ok" ? identityRead.path : null;
    // The spec link is the SAME read's path rebased to repoRoot-relative (D46 · T3), so
    // every round-context path token speaks ONE basis (the child spawns at cwd = the
    // repo root) and the anchor and the frontier can never name two documents. The wave
    // line reads it on the same rule as the plan / branch lines (P37 §4.1): a code
    // review that cannot open the phase contract is the constructive blind spot the
    // phase closes.
    if (type === "plan" || type === "branch" || type === "wave") {
      specLink = identityPath === null ? null : root.relativize(identityPath);
    }
    // P37 §4.1 — the wave line's charter anchor. The two anchors are judged
    // INDEPENDENTLY: the spec anchor follows the identity document's own resolution
    // (a single-spec resolves fine and owns no `program:` by design), the charter
    // anchor follows that document's `program:` alone. Coupling them would strip a
    // single-spec phase's spec anchor — the blind spot this phase closes.
    if (type === "wave" && identityPath !== null && specDoc?.program != null) {
      const overallEntry = index.overallOf(specDoc.program);
      overallLink = overallEntry === null ? null : root.relativize(overallEntry.path);
    }
    // The pipeline frontier's four declared cells (§11) — the composition root's ONE
    // collection point. The identity word + path come from the document index's read
    // (never the argv `--type` spelling): every non-plan declared document owns the
    // identity slot, so `phase-spec` / `single-spec` / `overall` all reach the same
    // assembly. The plan path is the read value's OWN frontier path (`stationPath()`):
    // a command has ONE plan path carrier, so the authority's verdict and this line's
    // hop can never name two different documents.
    const pipeline: PipelineFrontierInput = {
      specType: specDoc?.docType ?? null,
      specPath: identityPath,
      planPath: plan.stationPath(),
      plan,
    };
    return {
      scene: {
        workspace,
        ledger,
        planPath,
        plan,
        type,
        face,
        target,
        state,
        router: new NextStepRouter(artifacts),
        pipeline,
        briefPath: null,
        specLink,
        overallLink,
        // P38 §2.1 — the two DECLARED cells the dispatch-input gate reads instead of
        // parsing a document at dispatch: the identity document's `program:` literal
        // and its `doc-type:` shape, taken from the SAME index entry `specLink` and
        // `overallLink` were resolved from (one read, three facts).
        program: specDoc?.program ?? null,
        docType: specDoc?.docType ?? null,
      },
      artifacts,
    };
  }

  /** The argv-face plan read (the wave / plan / branch lines) — ONE read through the
   *  command preamble's `PlanSource`. An `io` failure keeps today's usage byte (the
   *  same `#usage` seam the retired `readText` rode): the workspace key has no
   *  source, so the run stops here, BEFORE any identity is derived or any workspace
   *  gets built — never a fabricated slug. */
  #argvPlanOf(node: Command, planSource: PlanSource, rel: RepoPath): PlanRead {
    const plan = planSource.readPath(rel);
    if (plan.failure()?.cause === "io") this.#usage(node, `cannot read file: ${rel}`);
    return plan;
  }

  /** The slug's declared identity document — the sole index entry of an identity class
   *  (`null` when the slug names none, or when it carries two: an ambiguous set is the
   *  doc domain `read`'s refusal, and this face never picks a first). The returned
   *  entry supplies the declared `docType:` and `program:`; its PATH comes from the doc
   *  domain's read, so a filename is never an identity. */
  #specDocOf(index: SlugIndex, slug: string): DocEntry | null {
    const docs = index
      .docsOf(slug)
      .filter((entry) => entry.docType !== null && entry.docType !== "plan");
    return docs.length === 1 ? docs[0]! : null;
  }

  /** The plan-carrier target's workspace key (the wave / plan / branch lines) — the
   *  document's declared `slug:` (spec §2.1 · §2.4), taken from the plan READ rather
   *  than a second text hand-off: a `ready` read supplies its parsed front-matter
   *  head, and a `syntax` read (the grammar refused the plan, its front matter read
   *  out) supplies the index's own entry, so the scene still assembles and the
   *  doc-contract refusal leg can speak. An `io` failure never reaches here — it
   *  stops at `#argvPlanOf`. A missing / illegal / duplicated slug (identity or plan)
   *  renders the CDD_BLOCKED station and returns null (exit 1 at the caller — never
   *  the board's exit 2). The workspace key therefore stays a `string`: no `slug!`,
   *  no `slug ?? ""`. */
  #targetSlug(index: SlugIndex, rel: RepoPath, read: PlanRead): string | null {
    const head = read.doc()?.head ?? null;
    const parseError = head?.parseError ?? null;
    if (parseError !== null) return this.#parseErrorBlocked(parseError);
    const slug = head !== null ? head.slug : (index.entryAt(rel)?.slug ?? null);
    // The four-way identity gate (present · legal · indexed · unique) is the ONE
    // `SlugIndex` judgment the pre-flight gate also reads — this carrier supplies
    // only the CDD_BLOCKED channel, never a second spelling of the rule.
    return this.#slugVerdictOf(index, rel, slug);
  }

  /** The text-carrier target's workspace key (the doc faces and `base`) — ONE read
   *  face shared by the three work verbs' spec shapes and `base`: an unreadable
   *  target, a missing `slug:`, an illegal value, or a slug the index judges
   *  duplicated each render the CDD_BLOCKED station and return null (exit 1 at the
   *  caller). The caller passes the document text it already holds — the identity
   *  read never opens the file a second time. */
  #targetSlugText(index: SlugIndex, rel: RepoPath, content: string | null): string | null {
    // An unreadable target document declares no identity — the workspace key has
    // no source, so the dispatch face refuses on the SAME carrier as a missing
    // `slug:` (never a filename-derived directory).
    if (content === null)
      return this.#slugBlocked(
        `the target document ${rel} is unreadable — its declared \`slug:\` is the workspace key`,
      );
    const head = FrontMatterExtractor.split(content).head;
    const parseError = head.parseError;
    if (parseError !== null) return this.#parseErrorBlocked(parseError);
    return this.#slugVerdictOf(index, rel, head.slug);
  }

  /** The identity carriers' shared tail — the ONE named-key verdict pair: the four-way
   *  `SlugIndex` judgment and its CDD_BLOCKED channel. Both carriers differ only in
   *  where their `slug` comes from (a plan read's front matter, a target document's
   *  text); the verdict and the refusal are one fact, never two spellings. */
  #slugVerdictOf(index: SlugIndex, rel: RepoPath, slug: string | null): string | null {
    const verdict = index.slugVerdict(rel, slug);
    return verdict.kind === "accepted"
      ? verdict.slug
      : this.#slugBlocked(this.#words.slugRefusal(verdict));
  }

  /** The front-matter parse break's refusal — ONE message construction for the two
   *  identity carriers (a broken head is unjudgeable whichever face reads it). The
   *  bytes are the pre-existing `frontmatterParse` route word, unchanged. */
  #parseErrorBlocked(parseError: FrontMatterParseError): null {
    return this.#slugBlocked(
      this.#words
        .routeWord("frontmatterParse")
        .replace("{reason}", parseError.reason)
        .replace("{line}", String(parseError.line))
        .replace("{column}", String(parseError.column))
        .replace("{source}", parseError.source),
    );
  }

  /** Read a dispatch target's text — null when the file is absent or unreadable.
   *  The null is NOT a degradation: every caller hands it to `#targetSlug`, which
   *  refuses the target on the slug carrier (CDD_BLOCKED + exit 1). A document
   *  that IS readable and declares no `doc-type:` / `slug:` is the separate
   *  T7 null-verdict shape. */
  #readTarget(root: RepoRoot, rel: RepoPath): string | null {
    try {
      return readFileSync(root.resolve(rel), "utf8");
    } catch {
      return null;
    }
  }

  /** The dispatch-face critical stop carrier — the CDD_BLOCKED station + the
   *  reason row; the caller returns exit 1 (the CDD_BLOCKED channel carries
   *  dispatch hard gates only, never a board reject face). */
  #slugBlocked(message: string): null {
    this.#io.stderr(`${this.#words.station("blocked")} ${message}\n`);
    return null;
  }

  /** The input funnel — the ONE path normalization landing (T3 · §2.3): every
   *  path-typed argv value is relativized to the repo root EXACTLY once, here,
   *  before the scene or any downstream face reads it, so no face ever sees a raw
   *  argv path shape. The covered face: `--plan` · `--spec` · `--reviews` (the
   *  schema `--output skeleton` `<target>` positional and base `--plan` reach the
   *  SAME landing through `#relativizePath` — branch-review-1 F6: one relativize+warn
   *  helper, one landing). An out-of-repo input (a `..` segment after relativize) is
   *  ACCEPTED with a stderr warning — the shape is what is judged, never the location
   *  (§2.10). */
  #funnel(root: RepoRoot, parsed: RunInput): RunInput {
    const raw = parsed.args;
    // The three path keys move OUT of the generic string record into the branded
    // `paths` face (F7) — splitting them out means the raw path string exists in
    // exactly ONE form downstream (the normalized `RepoPath`), never duplicated
    // (the Data Clumps F2 targets).
    const { plan, spec, reviews, ...rest } = raw;
    return {
      ...parsed,
      args: rest,
      paths: {
        plan: plan === undefined ? null : this.#relativizePath(root, plan),
        spec: spec === undefined ? null : this.#relativizePath(root, spec),
        reviews: reviews === undefined ? null : this.#relativizePath(root, reviews),
      },
    };
  }

  /** The ONE path normalization landing (T3 §2.3 · F6) — relativize a raw argv path
   *  to the branded repoRoot-relative `RepoPath` through the value object, then warn
   *  on the stderr CDD_WARN channel when the result lies outside the repo. The
   *  work-command funnel (`#funnel`) and the pure-command path argv (schema
   *  `--output skeleton` `<target>` · base `--plan`) all reach THIS helper, so there
   *  is literally ONE relativize+warn site. An out-of-repo input (a `..` segment after
   *  relativize) is ACCEPTED — the shape is what is judged, never the location
   *  (§2.10). An empty input normalizes to the empty path (no warning). */
  #relativizePath(root: RepoRoot, raw: string): RepoPath {
    const rel = root.relativize(raw);
    if (rel.split(path.sep).includes("..")) {
      this.#io.stderr(`${this.#words.station("warn")} path is outside the repository: ${rel}\n`);
    }
    return rel;
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
    this.#assertDryRunScope(node, parsed.dryRun);
    const [type, target] = parsed.positionals;
    if (type === undefined) this.#usage(node, "cdd schema get: missing <type>");
    const output = parsed.args.output ?? "json";
    if (output === "skeleton") {
      // The skeleton render face — the engine-declared target (D19): the authoring
      // scaffold lands in the target document, zero shell-redirection indirection.
      if (target === undefined) {
        this.#usage(node, "cdd schema get --output skeleton: missing <target>");
      }
      // The positional `<target>` reaches the SAME one normalization landing (T3 §2.3
      // · F6) as the work-command path argv (`#relativizePath`), then is erased
      // through the value object at the write boundary.
      const repoRoot = await this.#rootOf();
      if (repoRoot === null) return 1;
      const root = new RepoRoot(repoRoot);
      const targetPath = this.#relativizePath(root, target);
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
    this.#assertDryRunScope(node, parsed.dryRun);
    const planArg = parsed.args.plan;
    if (planArg === undefined) {
      this.#usage(node, "cdd base: missing --plan — the sole target is --plan <path>");
    }
    const repoRoot = await this.#rootOf();
    if (repoRoot === null) return 1;
    const root = new RepoRoot(repoRoot);
    // The base `--plan` reaches the SAME one normalization landing (T3 §2.3 · F6) as
    // the work-command path argv: the stored artifact's path field speaks the ONE
    // canonical shape (repoRoot-relative).
    const planPath = this.#relativizePath(root, planArg);
    // The workspace key is the plan document's `slug:` — the SAME resolution point
    // (and rejection carrier) the work verbs use. `base` carries no pre-flight gate,
    // so a missing / illegal / duplicated slug or an unreadable target stops HERE:
    // CDD_BLOCKED + exit 1 (never a filename-derived key).
    const slug = this.#targetSlugText(
      this.#indexOf(repoRoot),
      planPath,
      this.#readTarget(root, planPath),
    );
    if (slug === null) return 1;
    // The workspace is not built here (P11 · §4.2): `base set` builds it through
    // `Workspace.writeJson`'s internal ensure, while the read-only `base get`
    // creates nothing. The read rides `Workspace.readJson`, so the P9 read-time
    // normalization covers `base.json` (the retired migration's job).
    const workspace = new Workspace(
      new WorkspaceRoot(repoRoot, this.#config.handoffNamespace().workspaceRoot),
      slug,
    );
    if (parsed.leaf === "set")
      return this.#artifacts.baseSet(node, parsed, planPath, workspace, root);
    if (parsed.leaf === "get") return this.#artifacts.baseGet(workspace, root);
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
