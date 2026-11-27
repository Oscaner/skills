// packages/cdd-engine/src/surface/index.ts
// `surface/` — the consumer surface: the one word table and the renderers that connect it.
//
// INVARIANT (the slice's one sentence, from the phase spec): one fact, one word table, one
// rendering — every byte a consumer reads of a fact the engine states is declared once, and
// a renderer only connects the table.
//
// This entrance is the surface's ONE door. It exposes the declared words (the table, the
// guard-ban vocabulary and the issue type set), the render classes, and ONE entry per render
// step, so a command shell never reaches into the render folder: it hands a value in and
// prints what comes back.
//
// The render entries, by the value they take:
//   · `report` / `confirm` — the usage face: a declared misuse or failure value, or a
//     successful command's echoed path;
//   · `capsuleRows` — one round's capsule;
//   · `boardRows` — one tree's board (node or program, with the two display switches);
//   · `previewPass` / `previewHeld` / `previewBlocked` — the dry-run face's three blocks;
//   · `issueReport` — the stdin findings contract and the aggregate body;
//   · `briefName` / `briefBody` / `briefBytes` — the wave brief's three products;
//   · `initPreview` / `initProgress` / `initGreen` / `initFailure` — the bootstrap face's
//     four exits, each carrying its own stream;
//   · `checkedBlock` / `refusalBody` / `refusalDetails` / `lineRefusal` — the route face's
//     shared assemblies, so a shell prints one refusal with one spelling;
//   · `prompt` / `review` — the two dispatch prompt bands, so the dispatch face reads a
//     band through this door like every other consumer byte.
//
// The collaborators are constructed HERE and nowhere else — one word table, one route
// renderer, every renderer over them — so the capsule and the board cannot read two tables.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { type Command, CommanderError } from "commander";
import type { TaskBlocks } from "../docs/grammar/task-blocks.ts";
import type { Documents } from "../docs/index.ts";
import { Clock } from "../env/process/clock.ts";
import type { Provisioner } from "../env/provision/init.ts";
import type { FrameFacts, FrameRequest } from "../run/advance/frame.ts";
import type { NextHop } from "../run/advance/next.ts";
import { TargetFaces } from "../run/advance/target-faces.ts";
import type { WaveVerdict } from "../run/advance/wave.ts";
import type { InFlightState } from "../run/dispatch/inflight.ts";
import type { CheckedRow, PreFlightVerdict } from "../run/gate/preflight.ts";
import type { AdvanceOutcome, BoardOutcome, PreviewOutcome, Run } from "../run/index.ts";
import { CarrierMismatchError } from "../run/ledger/carrier-line.ts";
import { BaseCommand, type BaseResolution } from "./commands/base.ts";
import { BoardCommand, type TargetTypeRead } from "./commands/board.ts";
import type {
  CliLeafName,
  CliOutcome,
  CliVerb,
  CommandReporter,
  ParsedCommand,
  TextStreams,
} from "./commands/declare.ts";
import { FixCommand } from "./commands/fix.ts";
import { ImplementCommand } from "./commands/implement.ts";
import { InitCommand } from "./commands/init.ts";
import { IssueCommand, type StdinRead } from "./commands/issue.ts";
import { CommandTreeBuilder, ScopeGuard } from "./commands/projection.ts";
import { ReviewCommand } from "./commands/review.ts";
import { type RelativePath, SchemaCommand } from "./commands/schema.ts";
import type { BoardDisplay, BoardShape, BoardValue } from "./render/board.ts";
import { BoardView, FOLDED_BOARD } from "./render/board.ts";
import { BriefRenderer } from "./render/brief.ts";
import type { CapsuleFacts } from "./render/capsule.ts";
import { Capsule } from "./render/capsule.ts";
import type { GraphTree } from "./render/graph.ts";
import { GraphView } from "./render/graph.ts";
import type { InitLine } from "./render/init.ts";
import { InitRenderer } from "./render/init.ts";
import type { IssueReport } from "./render/issue.ts";
import { IssueBodyRenderer } from "./render/issue.ts";
import type { PreviewPass } from "./render/preview.ts";
import { Preview } from "./render/preview.ts";
import type { RefusalVerdict } from "./render/route.ts";
import { RouteRenderer } from "./render/route.ts";
import {
  PromptBandsRenderer,
  type ReviewVariantRow,
  type WorkModeRowKey,
} from "./render/templates.ts";
import type { UsageInput, UsageReport } from "./render/usage.ts";
import { UsageFace } from "./render/usage.ts";
import { Words } from "./words/words.ts";

export {
  type BoardDisplay,
  type BoardShape,
  type BoardValue,
  BoardView,
  FOLDED_BOARD,
} from "./render/board.ts";
export { BriefRenderer } from "./render/brief.ts";
export { Capsule, type CapsuleFacts } from "./render/capsule.ts";
export { type GraphTree, GraphView } from "./render/graph.ts";
export { type InitFacts, type InitLine, InitRenderer } from "./render/init.ts";
export {
  ISSUE_LABEL_ROWS,
  IssueBodyRenderer,
  type IssueLabelRow,
  type IssueReport,
  type IssueReportInput,
  type ReportFindingInput,
} from "./render/issue.ts";
export { Preview, type PreviewPass } from "./render/preview.ts";
export type { RefusalVerdict } from "./render/route.ts";
export { type RouteChannelRow, type RouteChannels, RouteRenderer } from "./render/route.ts";
export {
  type BandRow,
  type PromptBands,
  PromptBandsRenderer,
  REVIEW_VARIANTS,
  type ReviewVariantRow,
  TEMPLATE_PROMPT,
  WORK_MODES,
  type WorkModeRowKey,
} from "./render/templates.ts";
export {
  FAILURE_REASONS,
  type FailureValue,
  USAGE_BYTES,
  type UsageByteRow,
  type UsageContext,
  UsageFace,
  type UsageInput,
  type UsageReport,
} from "./render/usage.ts";
export {
  type ArtifactReportWords,
  type ArtifactWords,
  type BoardFactRowWords,
  type BoardFactWords,
  type BoardWords,
  type CapsuleKey,
  type CapsuleSlot,
  type CapsuleWords,
  type CheckedWords,
  FIX_DISPOSITIONS_SUMMARY,
  GUARD_BAN_WORDS,
  type GuardBanWord,
  type GuardFamily,
  type InFlightWords,
  ISSUE_TYPES,
  type IssueType,
  type ProgressWords,
  type RefusalWords,
  type RouteWordKind,
  type StationKind,
  type TargetGoneWords,
  WORDS,
  Words,
} from "./words/words.ts";

/** The surface's construction facts — the injected clock the in-flight rows are computed
 *  through, the host a routed skill reference renders for, and the usage line face the
 *  command tree owns. */
export interface CliOptions {
  /** The clock a pinned run injects. */
  readonly clock?: Clock;
  /** The dispatch host the route face renders skill references for (`""` = no harness). */
  readonly host?: string;
  /** The usage line face — the ONE derivation of a command node's first help line. The
   *  command tree injects it; an unwired surface answers the empty line, which the usage face
   *  renders as no line at all rather than a fabricated one. */
  readonly usageLine?: (commandPath: string) => string;
  /** The two writers every byte goes through — one pair, so the `init` face's progress rows
   *  and its first-failure report cannot be handed two different stdout spellings. */
  readonly io?: TextStreams;
  /** The round layer's ONE entrance — the work commands and the board read through it. */
  readonly run?: Run;
  /** The document slice's ONE entrance — the two schema faces. */
  readonly documents?: Documents;
  /** The base artifact's resolver: an argv `--plan` to a workspace artifact. Absent leaves
   *  `base` refusing with its own named error instead of guessing a workspace. */
  readonly base?: (planArg: string) => BaseResolution;
  /** The board's entry-document type read — the board's one non-argv cell. */
  readonly boardType?: TargetTypeRead;
  /** The one relativize landing the schema target takes. */
  readonly relative?: RelativePath;
  /** The stdin read the issue face consumes. */
  readonly stdin?: StdinRead;
  /** The harness provisioner the `init` face drives. */
  readonly provisioner?: Provisioner;
}

/**
 * Cli — the consumer surface's one door. Invariant: every byte a consumer reads comes from
 * the ONE word table this door holds, so a second table is unreachable by construction.
 */
export class Cli {
  /** The word table this surface renders through. */
  readonly words: Words;
  /** The route face — the one `next:` / `reason:` / `checked:` / refusal assembly. */
  readonly route: RouteRenderer;
  /** The usage face — every misuse and declared-failure byte. */
  readonly usage: UsageFace;
  /** The board — the tree's two layouts. */
  readonly board: BoardView;
  /** The capsule — one round's slot order. */
  readonly capsule: Capsule;
  /** The dry-run face's three blocks. */
  readonly preview: Preview;
  /** The issue body and its stdin contract. */
  readonly issue: IssueBodyRenderer;
  /** The wave brief's three products. */
  readonly brief: BriefRenderer;
  /** The bootstrap face's four exits. */
  readonly init: InitRenderer;
  /** The wave board's three sections. */
  readonly graph: GraphView;
  /** The two prompt bands — one renderer over the declared rows. */
  readonly prompts: PromptBandsRenderer;

  /** The two writers every byte goes through. */
  readonly #io: TextStreams;
  /** The declaration's ONE projection — the parse tree and the usage line's home. */
  readonly #builder: CommandTreeBuilder;
  /** The pure commands' scope rejection. */
  readonly #scope = new ScopeGuard();
  /** The entries the shells call; a missing one turns its command into a named refusal. */
  readonly #entries: CommandEntries;
  /** The per-invocation exit code the thin shells capture — `commander` discards an
   *  action's return value, so the shell writes the run's code here. */
  #exitCode = 0;

  constructor(opts: CliOptions = {}) {
    this.words = new Words({ clock: opts.clock ?? new Clock() });
    this.route = new RouteRenderer(this.words, {
      ...(opts.host === undefined ? {} : { host: opts.host }),
    });
    // The projection first: the usage face's line is that tree's own first help line, so the
    // default derivations point at the tree this surface just assembled.
    this.#builder = new CommandTreeBuilder();
    this.usage = new UsageFace({
      words: this.words,
      usageLine: opts.usageLine ?? ((commandPath) => this.#builder.usageLineOf(commandPath)),
    });
    this.capsule = new Capsule(this.words, this.route);
    this.board = new BoardView(this.words, this.route);
    this.preview = new Preview(this.words, this.route);
    this.issue = new IssueBodyRenderer(this.words);
    this.brief = new BriefRenderer();
    this.init = new InitRenderer();
    this.graph = new GraphView(this.words);
    this.prompts = new PromptBandsRenderer();
    this.#io = opts.io ?? Cli.#processWriters();
    this.#entries = {
      run: opts.run,
      documents: opts.documents,
      base: opts.base,
      boardType: opts.boardType,
      relative: opts.relative,
      stdin: opts.stdin,
      provisioner: opts.provisioner,
    };
    Cli.#wireOutput(this.#builder.program, this.#io);
    this.#wireActions();
  }

  /** One work mode's dispatch prompt band. */
  prompt(mode: WorkModeRowKey): string {
    return this.prompts.prompt(mode);
  }

  /** One target type's review prompt band. */
  review(type: ReviewVariantRow["key"]): string {
    return this.prompts.review(type);
  }

  /** One misuse or declared failure's bytes, as a VALUE — the rendering half of the one
   *  output face, kept apart from `report` (which writes and answers an exit code) so a pin
   *  can assert bytes without a stream. */
  usageReport(value: UsageInput, commandPath = ""): UsageReport {
    return this.usage.report(value, commandPath);
  }

  /** One successful command's bytes — the echoed path and its newline. */
  confirm(echo: string): UsageReport {
    return this.usage.confirm(echo);
  }

  /** One round's capsule rows. */
  capsuleRows(facts: CapsuleFacts): readonly string[] {
    return this.capsule.emit(facts);
  }

  /** One tree's board rows. */
  boardRows(
    value: BoardValue,
    shape: BoardShape = "node",
    display: BoardDisplay = FOLDED_BOARD,
  ): readonly string[] {
    return shape === "program"
      ? this.board.renderProgram(value, display)
      : this.board.render(value, display);
  }

  /** The dry-run pass block. */
  previewPass(pass: PreviewPass): readonly string[] {
    return this.preview.passBlock(pass);
  }

  /** The dry-run held block. */
  previewHeld(
    verb: string,
    state: InFlightState,
    checked: readonly CheckedRow[],
  ): readonly string[] {
    return this.preview.heldBlock(verb, state, checked);
  }

  /** The dry-run blocked block. */
  previewBlocked(
    verb: string,
    body: string,
    details: readonly string[],
    checked: readonly CheckedRow[],
  ): readonly string[] {
    return this.preview.blockedBlock(verb, body, details, checked);
  }

  /** The `checked:` block — the row set the verdict carried. */
  checkedBlock(checked: readonly CheckedRow[]): readonly string[] {
    return this.route.checkedBlock(checked);
  }

  /** One refusal's body line. */
  refusalBody(verdict: RefusalVerdict, holder?: string | null): string {
    return this.route.refusalBody(verdict, holder);
  }

  /** One refusal's detail rows. */
  refusalDetails(verdict: RefusalVerdict, tree: GraphTree | null = null): readonly string[] {
    return this.route.refusalDetails(verdict, tree);
  }

  /** The task face's refusal line. */
  lineRefusal(
    verb: string,
    phase: string,
    verdict: Parameters<RouteRenderer["lineRefusalText"]>[2],
    hop: NextHop | null = null,
  ): string {
    return this.route.lineRefusalText(verb, phase, verdict, hop);
  }

  /** The stdin findings contract and the aggregate issue body. */
  issueReport(stdin: string): IssueReport {
    return this.issue.report(stdin);
  }

  /** The brief's workspace-relative name. */
  briefName(frame: FrameFacts): string {
    return this.brief.name(frame);
  }

  /** The brief's task-only projection — the version a wave line binds. */
  briefBody(text: string, blocks: TaskBlocks, tasks: readonly number[]): string {
    return this.brief.taskBody(text, blocks, tasks);
  }

  /** The brief's landed bytes — the projection plus the plan's constraints and the notes. */
  briefBytes(
    text: string,
    blocks: TaskBlocks,
    tasks: readonly number[],
    notes: readonly string[] = [],
  ): string {
    return this.brief.render(text, blocks, tasks, notes);
  }

  // -------------------------------------------------------------------------
  // the command face — parse, dispatch to one shell, write through one pair
  // -------------------------------------------------------------------------

  /** The declaration's ONE projection, as the parse tree a process wrapper hands its argv. */
  get program(): Command {
    return this.#builder.program;
  }

  /** One command node's first help line — the usage byte's ONE derivation. */
  usageLineOf(commandPath: string): string {
    return this.#builder.usageLineOf(commandPath);
  }

  /** `run(argv)` — the command face: parse through the projection, dispatch the parsed
   *  command to its ONE shell, return that shell's exit code. A parse rejection is
   *  normalized into the declared exit-code table (0 help · 2 usage · 1 failure). */
  async run(argv: readonly string[]): Promise<number> {
    try {
      this.#exitCode = 0;
      await this.#builder.program.parseAsync([...argv], { from: "user" });
      return this.#exitCode;
    } catch (raw) {
      return this.#normalizeExit(raw);
    }
  }

  /** The ONE output face — a declared answer becomes bytes on its own stream and an exit
   *  code. Every shell hands its entry's return value here unchanged, so no shell picks a
   *  stream and none spells a byte. */
  report(outcome: CliOutcome, commandPath: string): number {
    switch (outcome.kind) {
      case "advance-entry":
        return this.#reportAdvance(outcome.value, outcome.request);
      case "preview-entry":
        return this.#reportPreview(outcome.value, outcome.request);
      case "board-entry":
        return this.#reportBoard(outcome.value, outcome.display);
      case "base-read":
        return outcome.value.kind === "artifact"
          ? this.#write("stdout", `${JSON.stringify(outcome.value.value, null, 2)}\n`)
          : this.#reportUsage(outcome.value, commandPath);
      case "base-write":
        return outcome.value.kind === "written"
          ? this.#write("stdout", `${outcome.value.target}\n`)
          : this.#reportUsage(
              { kind: "base-conflict", existing: outcome.value.existing.base },
              commandPath,
            );
      case "projection":
        return outcome.value.kind === "projection"
          ? this.#write("stdout", outcome.value.text)
          : this.#reportUsage(outcome.value, commandPath);
      case "skeleton":
        if (outcome.value.kind === "written") {
          return this.#write("stdout", `${outcome.value.target}\n`);
        }
        return this.#reportUsage(outcome.value, commandPath);
      case "issue-report":
        return this.#write(outcome.report.stream, outcome.report.text, outcome.report.exitCode);
      case "init":
        this.progress(outcome.lines);
        return outcome.exitCode;
      default:
        return this.#reportUsage(outcome, commandPath);
    }
  }

  /** Lines a long-running step produced before its next action — the `init` progress row,
   *  which must land ahead of the spawn it announces. Each line carries its own stream, so
   *  this routes through the same pair `report` writes through. */
  progress(lines: readonly InitLine[]): void {
    for (const line of lines) {
      this.#io[line.stream](line.text.endsWith("\n") ? line.text : `${line.text}\n`);
    }
  }

  /** One misuse or declared failure, written — the usage face's report on its own stream. */
  #reportUsage(value: UsageInput, commandPath: string): number {
    const report = this.usage.report(value, commandPath);
    return this.#write(report.stream, report.text, report.exitCode);
  }

  /** One board read — the rows on stdout, or the declared usage value. The layout is picked
   *  by the read's own phase rows (a charter answers them), never by an argv word. */
  #reportBoard(outcome: BoardOutcome, display: BoardDisplay): number {
    if (outcome.kind !== "board") return this.#reportUsage(outcome, "board");
    const shape: BoardShape = outcome.phases.length > 0 ? "program" : "node";
    for (const line of this.boardRows(outcome, shape, display)) this.#io.stdout(`${line}\n`);
    return 0;
  }

  /**
   * One dispatch step's declared answer — its capsule on the standard stream and the
   * `checked:` rows on the diagnostic one, in the order a real dispatch reports them: the
   * status line with its summary and its two route rows, then the rows that ran.
   *
   * The cells are the step's OWN (`AdvanceOutcome#face`), so this face spells no status word
   * and no route: the conclusion is the carrier's, the hop is the pipeline's, and the fix
   * round's summary is the word table's template filled with the counts the criterion judged.
   * The exit code follows the same value: a failure conclusion exits 1 and a completed round
   * exits 0.
   */
  #reportAdvance(outcome: AdvanceOutcome, request: FrameRequest): number {
    if (outcome.kind === "dispatch") return this.#reportCapsule(outcome);
    if (outcome.kind === "held") return this.#reportHeld(outcome.state, outcome.checked);
    if (outcome.kind === "blocked") {
      return this.#reportBlocked(outcome.verdict, outcome.leg, request, outcome.checked);
    }
    return this.#reportUsage(outcome, request.command);
  }

  /** One round's capsule — the step's own cells, the ONE summary composition and the rows it
   *  ran, then its exit code. */
  #reportCapsule(outcome: Extract<AdvanceOutcome, { kind: "dispatch" }>): number {
    const face = outcome.face;
    const failed = this.#failureStatus(face.status);
    // A completed round always states its carrier coordinate and its hop: the ledger resolves
    // one path for every booked round and the step derives one hop per dispatch. A missing
    // cell is therefore an UNWIRED read, and a capsule with `handoff: ` or without its route
    // rows is the plausible-looking wrong byte this face exists to refuse.
    if (!failed && (face.handoff === "" || face.hop === null))
      throw new Error(CAPSULE_READS_ABSENT);
    const summary = this.#summaryOf(outcome.capsule);
    const rows = this.capsuleRows({
      status: face.status,
      handoff: face.handoff,
      ...(summary === undefined ? {} : { summary }),
      ...(face.crashRecord ? { crashRecord: true } : {}),
      hop: face.hop,
    });
    this.#writeLines("stdout", rows, 0);
    this.#writeChecked(outcome.checked);
    return failed ? 1 : 0;
  }

  /** The capsule's summary row — the ONE cell the round's own facts fill, in the order the
   *  step states them: the composed note, else the fix round's two counts through the word
   *  table's own template. Absent when the round contributed neither. */
  #summaryOf(capsule: StepCapsule): string | undefined {
    if (capsule.summary !== undefined) return capsule.summary;
    const counts = capsule.dispositionCounts;
    if (counts === undefined) return undefined;
    return this.words.dispositionsSummary(counts.fixed, counts.rejected);
  }

  /** Whether one conclusion word belongs to the capsule's failure family — READ OFF the word
   *  table's own key rows (a failure status drops the `handoff` key, so the two reads differ
   *  by that one row), never a second list of statuses in this file. */
  #failureStatus(status: string): boolean {
    return (
      this.words.capsuleKeys(status, false).length !== this.words.capsuleKeys(status, true).length
    );
  }

  /** The in-flight gate's hold — the `CDD_BLOCKED` anchor, the holder's own report, then the
   *  rows that ran. */
  #reportHeld(state: InFlightState, checked: readonly CheckedRow[]): number {
    const message = this.#heldReport(state);
    this.#io.stderr(`${this.words.station("blocked")} ${message}\n`);
    this.#writeChecked(checked);
    return 1;
  }

  /** The held sentence of one occupancy — the holder's own report with the word table's
   *  slots filled, the corrupt-lock row when the record could not be read, or the free
   *  sentence when nothing claims the tree. */
  #heldReport(state: InFlightState): string {
    if (state.kind === "held") {
      const record = state.record;
      return this.words.inFlightHeld({
        pid: record.pid,
        command: record.command,
        startedAt: record.startedAt,
        wave: record.wave,
        slug: record.slug,
      });
    }
    if (state.kind === "corrupt") return this.words.refusalReason("corrupt-record");
    return this.words.checkedWords().inFlight.free;
  }

  /** A refused dispatch — the structure leg's own channel or the line leg's one line, its
   *  detail rows, then the rows that ran. */
  #reportBlocked(
    verdict: PreFlightVerdict | WaveVerdict,
    leg: "structure" | "line",
    request: FrameRequest,
    checked: readonly CheckedRow[],
  ): number {
    if (leg === "line") {
      const phase = CDD_PHASE_OF.of(request.command, request.type);
      this.#io.stderr(
        `${this.route.lineRefusalText(request.command, phase, verdict as WaveVerdict)}\n`,
      );
    } else {
      this.#writeStructureBlocked(request.command, verdict as PreFlightVerdict);
    }
    this.#writeChecked(checked);
    return 1;
  }

  /** The structure leg's line — the `CDD_BLOCKED` anchor for the rows that own that channel,
   *  the command channel for the two that keep their own face, then the detail rows. */
  #writeStructureBlocked(verb: string, verdict: PreFlightVerdict): void {
    const body = this.route.refusalBody(verdict);
    const anchor = CDD_BLOCKED_GATES.includes(verdict.gate ?? "")
      ? `${this.words.station("blocked")} ${body}`
      : `cdd ${verb}: ${body}`;
    this.#io.stderr(`${anchor}\n`);
    for (const detail of this.route.refusalDetails(verdict)) this.#io.stderr(`${detail}\n`);
  }

  /** The `checked:` block, on the diagnostic stream the real dispatch reports it through. */
  #writeChecked(checked: readonly CheckedRow[]): void {
    for (const line of this.checkedBlock(checked)) this.#io.stderr(`${line}\n`);
  }

  /** One dry-run forecast — the passing block (its `checked:` rows on the diagnostic stream,
   *  exactly where the real dispatch reports them), the held block, the blocked block or the
   *  line-leg refusal, and the declared usage value on the usage face. */
  #reportPreview(outcome: PreviewOutcome, request: FrameRequest): number {
    if (outcome.kind === "usage" || outcome.kind === "read-failure") {
      return this.#reportUsage(outcome, request.command);
    }
    if (outcome.kind === "refused") {
      return this.#reportBlocked(outcome.verdict, "line", request, outcome.checked);
    }
    if (outcome.kind === "held") {
      return this.#writeLines(
        "stdout",
        this.previewHeld(request.command, outcome.state, outcome.checked),
        1,
      );
    }
    if (outcome.kind === "blocked") {
      return this.#writeLines(
        "stdout",
        this.previewBlocked(
          request.command,
          this.route.refusalBody(outcome.verdict),
          this.route.refusalDetails(outcome.verdict),
          outcome.checked,
        ),
        1,
      );
    }
    this.#writeChecked(outcome.checked);
    return this.#writeLines(
      "stdout",
      this.preview.passBlock({
        frame: outcome.frame,
        host: outcome.host,
        brief: outcome.brief,
        writes: outcome.writes,
        ledger: outcome.ledger,
      }),
      0,
    );
  }

  /** Lines and an exit code — the one writer both blocks use. */
  #writeLines(stream: "stdout" | "stderr", lines: readonly string[], exitCode: number): number {
    for (const line of lines) this.#io[stream](`${line}\n`);
    return exitCode;
  }

  /** One byte write, answering the caller's exit code (0 when it carries none). */
  #write(stream: "stdout" | "stderr", text: string, exitCode = 0): number {
    this.#io[stream](text);
    return exitCode;
  }

  // -------------------------------------------------------------------------
  // the actions — one thin shell per command node
  // -------------------------------------------------------------------------

  /** Attach one action per command node and per leaf. `commander` discards an action's
   *  return value, so each shell writes the run's code into `#exitCode`. */
  #wireActions(): void {
    const attach = (node: Command, leaf: CliLeafName | null): void => {
      node.action(async (...args: unknown[]) => {
        const command = args[args.length - 1] as Command;
        this.#exitCode = await this.#dispatch(leaf, command);
      });
    };
    for (const verb of ["implement", "review", "fix", "board", "init"] as const) {
      attach(Cli.#nodeOf(this.#builder.program, verb, null), null);
    }
    attach(Cli.#nodeOf(this.#builder.program, "base", "set"), "set");
    attach(Cli.#nodeOf(this.#builder.program, "base", "get"), "get");
    attach(Cli.#nodeOf(this.#builder.program, "schema", "get"), "get");
    attach(Cli.#nodeOf(this.#builder.program, "issue", "render"), "render");
  }

  /** One node of the assembled tree, by verb and (when it is a leaf) by its own name. */
  static #nodeOf(program: Command, verb: CliVerb, leaf: string | null): Command {
    const parent = program.commands.find((candidate) => candidate.name() === verb);
    if (parent === undefined) throw new Error(`cdd: no command node "${verb}"`);
    if (leaf === null) return parent;
    const node = parent.commands.find((candidate) => candidate.name() === leaf);
    if (node === undefined) throw new Error(`cdd: no leaf node "${verb} ${leaf}"`);
    return node;
  }

  /** One invocation: read the parsed cells, run the scope guard, hand them to the ONE shell. */
  async #dispatch(leaf: CliLeafName | null, command: Command): Promise<number> {
    const parsed = this.#parsedOf(leaf, command);
    const rejection = this.#scope.rejectionOf({
      commandPath: parsed.commandPath,
      dryRun: parsed.dryRun,
    });
    if (rejection !== null) return this.report(rejection, parsed.commandPath);
    const report = this.#reporter;
    switch (parsed.commandPath) {
      case "implement":
        return new ImplementCommand({ run: this.#need("run"), report }).run(parsed);
      case "review":
        return new ReviewCommand({ run: this.#need("run"), report }).run(parsed);
      case "fix":
        return new FixCommand({ run: this.#need("run"), report }).run(parsed);
      case "board":
        return await new BoardCommand({
          run: this.#need("run"),
          typeOf: (request) => this.#need("boardType")(request),
          report,
        }).run(parsed);
      case "base set":
      case "base get":
        return new BaseCommand({
          resolve: (plan) => this.#need("base")(plan),
          report,
        }).run(parsed);
      case "schema get":
        return new SchemaCommand({
          documents: this.#need("documents"),
          relative: (raw) => this.#need("relative")(raw),
          report,
        }).run(parsed);
      case "issue render":
        return new IssueCommand({
          renderer: this.issue,
          stdin: this.#need("stdin"),
          report,
        }).run(parsed);
      default:
        return await new InitCommand({
          provisioner: this.#need("provisioner"),
          renderer: this.init,
          report,
        }).run(parsed);
    }
  }

  /** The reporter this surface hands every shell — the same instance for all eight, so no
   *  shell can hold a second output face. */
  get #reporter(): CommandReporter {
    return {
      report: (outcome, commandPath) => this.report(outcome, commandPath),
      progress: (lines) => this.progress(lines),
    };
  }

  /** One injected entry, refusing by NAME when the surface was constructed without it. */
  #need<K extends keyof CommandEntries>(key: K): NonNullable<CommandEntries[K]> {
    const value = this.#entries[key];
    if (value === undefined) throw new Error(`cdd: ${String(key)} is not wired on this surface`);
    return value as NonNullable<CommandEntries[K]>;
  }

  /** The parsed cells — `commander`'s own opts widened to the shell's reading: booleans as
   *  `"true"` / `"false"`, everything else as its string form, plus the positionals and the
   *  program flag. */
  #parsedOf(leaf: CliLeafName | null, command: Command): ParsedCommand {
    const globals = command.optsWithGlobals() as Record<string, unknown>;
    const args: Record<string, string> = {};
    for (const [key, value] of Object.entries(globals)) {
      if (value === undefined) continue;
      args[key] = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
    }
    const parent = command.parent;
    const commandPath =
      parent === null || parent.name() === "cdd"
        ? command.name()
        : `${parent.name()} ${command.name()}`;
    return {
      commandPath,
      leaf,
      args,
      positionals: (command.processedArgs as readonly unknown[]).map(String),
      dryRun: globals.dryRun === true,
    };
  }

  /** The exit-code discriminator — the declared table: the explicit help faces exit 0, the
   *  help face's non-zero entries and every usage-class code exit 2, a run failure exits 1. */
  #normalizeExit(raw: unknown): number {
    if (raw instanceof CarrierMismatchError) {
      this.#io.stderr(`${this.words.station("blocked")} ${raw.message}\n`);
      return 1;
    }
    if (raw instanceof CommanderError) {
      if (raw.code === "commander.help") return raw.exitCode === 0 ? 0 : 2;
      if (raw.code === "commander.helpDisplayed") return 0;
      if (!raw.message.startsWith("error: ")) this.#io.stderr(`error: ${raw.message}\n`);
      return 2;
    }
    this.#io.stderr(`cdd: ${raw instanceof Error ? raw.message : String(raw)}\n`);
    return 1;
  }

  /** The living process's two writers — the default the composition root may override. */
  static #processWriters(): TextStreams {
    return {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
    };
  }

  /** Wire ONE node's output into the injected pair. A subcommand's help is written through
   *  the subcommand's own configuration, so the whole tree is wired, never just the program. */
  static #wireOutput(node: Command, io: TextStreams): void {
    node.configureOutput({ writeOut: io.stdout, writeErr: io.stderr });
    for (const child of node.commands) Cli.#wireOutput(child, io);
  }
}

/** The two cells a completed round's capsule cannot do without, as the surface would
 *  otherwise print them empty: the carrier coordinate (`LifecycleLedger#handoffOf`) and the
 *  line's hop (`LifecycleReads#hopOf`). Both are the advance segment's readings, so a surface
 *  wired without them names the absence instead of printing a capsule with a missing slot. */
const CAPSULE_READS_ABSENT =
  "cdd: the dispatch step's capsule has no carrier coordinate or no hop — the run's handoff " +
  "read and its hop read are not wired on this surface";

/** One dispatch step's summary cells, as the step hands them over — the round's composed note
 *  and, on the fix face, the two counts its criterion judged. */
type StepCapsule = Extract<AdvanceOutcome, { kind: "dispatch" }>["capsule"];

/** The work verbs' expected phase — the verb's own word, or the target row's review lead. */
const CDD_PHASE_OF = {
  of(command: string, type: FrameRequest["type"]): string {
    if (command === "implement" || command === "fix") return command;
    return TargetFaces.reviewLeadOf(type);
  },
};

/** The pre-flight rows that own the `CDD_BLOCKED` channel. The other refusing rows (`graph` ·
 *  `plan-ledger`) keep their own `cdd <verb>:` face. */
const CDD_BLOCKED_GATES: readonly string[] = [
  "tree-clean",
  "in-flight",
  "doc-contract",
  "no-host",
  "carrier",
  "dispatch-input",
  "artifact",
];

/** The entries a shell calls — every one injected by the composition root, none constructed
 *  here. A surface built without one refuses that command by name instead of guessing. */
interface CommandEntries {
  readonly run?: Run;
  readonly documents?: Documents;
  readonly base?: (planArg: string) => BaseResolution;
  readonly boardType?: TargetTypeRead;
  readonly relative?: RelativePath;
  readonly stdin?: StdinRead;
  readonly provisioner?: Provisioner;
}
