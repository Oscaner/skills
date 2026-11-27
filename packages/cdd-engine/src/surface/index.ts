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

import type { TaskBlocks } from "../docs/grammar/task-blocks.ts";
import { Clock } from "../env/process/clock.ts";
import type { FrameFacts } from "../run/advance/frame.ts";
import type { NextHop } from "../run/advance/next.ts";
import type { InFlightState } from "../run/dispatch/inflight.ts";
import type { CheckedRow } from "../run/gate/preflight.ts";
import type { BoardDisplay, BoardShape, BoardValue } from "./render/board.ts";
import { BoardView, FOLDED_BOARD } from "./render/board.ts";
import { BriefRenderer } from "./render/brief.ts";
import type { CapsuleFacts } from "./render/capsule.ts";
import { Capsule } from "./render/capsule.ts";
import type { GraphTree } from "./render/graph.ts";
import { GraphView } from "./render/graph.ts";
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

  constructor(opts: CliOptions = {}) {
    this.words = new Words({ clock: opts.clock ?? new Clock() });
    this.route = new RouteRenderer(this.words, {
      ...(opts.host === undefined ? {} : { host: opts.host }),
    });
    this.usage = new UsageFace({
      words: this.words,
      usageLine: opts.usageLine ?? (() => ""),
    });
    this.capsule = new Capsule(this.words, this.route);
    this.board = new BoardView(this.words, this.route);
    this.preview = new Preview(this.words, this.route);
    this.issue = new IssueBodyRenderer(this.words);
    this.brief = new BriefRenderer();
    this.init = new InitRenderer();
    this.graph = new GraphView(this.words);
    this.prompts = new PromptBandsRenderer();
  }

  /** One work mode's dispatch prompt band. */
  prompt(mode: WorkModeRowKey): string {
    return this.prompts.prompt(mode);
  }

  /** One target type's review prompt band. */
  review(type: ReviewVariantRow["key"]): string {
    return this.prompts.review(type);
  }

  /** One misuse or declared failure's bytes. */
  report(value: UsageInput, commandPath = ""): UsageReport {
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
}
