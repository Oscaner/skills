// packages/cdd-engine/src/run/advance/reads.ts
// The advance segment's PRODUCTION reads: every fact one dispatch step asks for, assembled
// from the graph the composition root hands in.
//
// INVARIANT — one step, one assembly: the pre-dispatch station rows and the dispatch frame
// are composed from ONE value record per frame (`DispatchValues.compose`), so the cells the
// gate judges and the cells the child receives can never be two different readings of one
// dispatch. Nothing here derives a fact a sibling already owns: the round identity comes from
// the frame, the artifact names from `ArtifactIdentity`, the log coordinate from the
// workspace, the host from `env/process`, the plan text from the injected read, the git facts
// from `env/vcs`, and the round-context declarations from the injected prompt band.
//
// The four pre-dispatch stations are judged HERE because this is the producer of their input
// face: `no-host` reads the detected host, `carrier` reads the requested carrier's integrity,
// `dispatch-input` reads the round-context declarations' exigibility arms against the value
// record, and `artifact` reads the ruling sidecar's own name judgment. All four answer the
// same closed `RowStation` vocabulary the gate refuses on.
//
// Rule zero (over the 200-line class limit): this class is the one adapter from the assembled
// four slices to ONE interface (`LifecycleReads`). Every member reads the same handful of
// collaborators, and splitting it would hand each half its own copy of the workspace, the
// ledger and the value assembly — the drift the one-assembly invariant exists to forbid.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { frontmatterOf } from "../../docs/grammar/frontmatter.ts";
import { TaskBlocks } from "../../docs/grammar/task-blocks.ts";
import { DOC_TYPE_VALUES, type DocType } from "../../docs/identity/types.ts";
import type { JudgeInput } from "../../docs/index.ts";
import type { FixDisposition } from "../../docs/judging/completion.ts";
import type { LedgerFacts } from "../../docs/judging/invariants.ts";
import { LedgerTaskSetRule } from "../../docs/judging/invariants.ts";
import type { TaskGraph } from "../../docs/judging/task-graph.ts";
import type { DocWorld } from "../../docs/world.ts";
import type { Paths } from "../../env/index.ts";
import type { RepoPath } from "../../env/paths/root.ts";
import type { Clock } from "../../env/process/clock.ts";
import { isHostId } from "../../env/process/host.ts";
import type { GitClient } from "../../env/vcs/git.ts";
import { RoundLogLayout } from "../../env/workspace/round-log.ts";
import type { Workspace, WriteOutcome } from "../../env/workspace/workspace.ts";
import { assembleDispatchFrame, type PromptBandLine } from "../dispatch/frame-assembly.ts";
import { Handoff, type JudgedRecord, type RoundFinding } from "../dispatch/handoff.ts";
import type { InFlightState } from "../dispatch/inflight.ts";
import { type ArtifactSnapshot, DispatchValues } from "../dispatch/values.ts";
import type {
  DispatchRowReading,
  DocJudgment,
  PlanLedgerTarget,
  PreFlightContext,
} from "../gate/preflight.ts";
import { type ArtifactRead, ArtifactReads } from "../ledger/artifact-reads.ts";
import { ArtifactIdentity, type Artifacts } from "../ledger/artifacts.ts";
import { CarrierLine } from "../ledger/carrier-line.ts";
import { RoundIdentity } from "../ledger/identity.ts";
import type { Ledger, RoundRecord, WaveLine } from "../ledger/ledger.ts";
import type { FrameFacts } from "./frame.ts";
import type { BriefLanding, DispatchFrameRead, EvidenceFile, LifecycleReads } from "./lifecycle.ts";
import type { CarriedFacts, LinePhase } from "./line-phase.ts";
import type { NextHop } from "./next.ts";
import type { Pipeline } from "./pipeline.ts";
import { TargetFaces, type TargetType } from "./target-faces.ts";

/** One round-context declaration's exigibility arm, as the prompt band declares it. */
export interface ExigibleArmRead {
  readonly types: "always" | readonly string[];
  readonly when?: "program" | "identity";
}

/** One round-context line, as the prompt band declares it — the two cells the frame assembly
 *  reads plus the two the station row reads. */
export interface ContextDeclarationRead extends PromptBandLine {
  readonly path?: true;
  readonly requiredOn: readonly ExigibleArmRead[];
  readonly written?: "engine";
}

/** The prompt band face this file reads — the render face's own renderer satisfies it. */
export interface PromptBandReads {
  modes(): readonly string[];
  reviewTypes(): readonly string[];
  bandOf(
    family: "work" | "review",
    key: string,
  ): {
    readonly fixed: readonly string[];
    readonly returning: readonly string[];
    readonly layout: readonly ContextDeclarationRead[];
  };
  clauses(): Readonly<Record<string, string>>;
}

/** The brief face this file reads — `surface/render/brief.ts#BriefRenderer` satisfies it. */
export interface BriefReads {
  name(frame: FrameFacts): string;
  taskBody(text: string, blocks: TaskBlocks, tasks: readonly number[]): string;
  render(
    text: string,
    blocks: TaskBlocks,
    tasks: readonly number[],
    notes?: readonly string[],
  ): string;
}

/** The document face this file reads — the concrete `Documents` satisfies it. */
export type DocumentJudgment = Pick<DocJudgment, "judge" | "judgeLedger" | "ruleRows" | "closedAt">;

/** The station rows' wording — the word table's own cells, injected so this file spells no
 *  sentence. `identityWords` renders one round coordinate in the words plane's spelling. */
export interface StationWording {
  /** The station → conclusion join (` · `). */
  readonly join: string;
  /** The `no-host` station's whole sentence. */
  readonly noHost: string;
  readonly dispatchInput: {
    readonly station: string;
    readonly segment: string;
    readonly separator: string;
  };
  readonly artifact: {
    readonly invalid: string;
    readonly reason: string;
    readonly derived: string;
    readonly found: string;
    readonly identity: string;
    readonly foundJoin: string;
    readonly emptyFound: string;
    readonly repair: readonly string[];
  };
  identityWords(round: RoundIdentity): string;
}

/** One round's coordinate — the three cells a carrier's name is rendered from. A booked
 *  record carries them, and a round that is still being booked carries them on its frame. */
export interface RoundCoordinate {
  readonly op: "implement" | "review" | "fix";
  readonly cycle: number;
  readonly attempt: number;
}

/** The requesting carrier one fix frame resolves — the three-branch priority's answer. `path`
 *  is the carrier the dispatch names (`null` when a record resolves none, and off the fix
 *  face); `record` is the same-cycle review record it answers, `null` on the flag and family
 *  branches; `identity` is the coordinate its ruling sidecar is named from. */
export interface RequestingCarrierRead {
  readonly path: string | null;
  readonly record: RoundRecord | null;
  readonly identity: RoundIdentity | null;
}

/**
 * CarrierReads — one line's checked carrier read. Invariant: a record's carrier path is the
 * name its own round identity renders (the finalized carrier, else the draft the round wrote),
 * and the bytes are judged by `Handoff`'s read-back with a digest check on the record's own
 * digest — a tampered carrier throws, never reads as the round's facts.
 */
export class CarrierReads {
  readonly #workspace: Workspace;

  constructor(opts: { readonly workspace: Workspace }) {
    this.#workspace = opts.workspace;
  }

  /** The carrier path a round resolves, repo-relative; null when neither name is on disk. */
  pathOf(line: string, record: RoundCoordinate): RepoPath | null {
    const identity = CarrierReads.identityOf(line, record);
    for (const kind of ["final", "draft"] as const) {
      const rel = this.#workspace.relOf(ArtifactIdentity.nameOf(identity, kind));
      if (this.#textOf(rel) !== null) return rel;
    }
    return null;
  }

  /** One record's carrier facts, as the line walk reads them. The PERSISTED carrier is read
   *  for its facts, not judged: the strict draft read-back (`Handoff.read`) belongs to the
   *  round that just dispatched, while a line's history may hold carriers an older engine
   *  wrote with fewer cells — a line that refused to route over them would read a finished
   *  round as unfinished. The digest check is the board's round-token read and the dispatch
   *  station's, never this walk's. */
  factsOf(line: string, record: RoundCoordinate): CarriedFacts {
    const path = this.pathOf(line, record);
    const text = path === null ? null : this.#textOf(path);
    if (path === null || text === null) return { findings: null, status: null, readable: false };
    let draft: unknown;
    try {
      draft = JSON.parse(text);
    } catch {
      return { findings: null, status: null, readable: false };
    }
    const identity = CarrierReads.identityOf(line, record);
    const status = (draft as { readonly status?: unknown } | null)?.status;
    return {
      readable: true,
      findings: record.op === "review" ? Handoff.findingsOf(draft) : null,
      status: status === "APPROVED" || status === "BLOCKED" ? status : null,
      ...(record.op === "review"
        ? {
            requesting: {
              reviews: String(path),
              rulings: String(this.#workspace.relOf(ArtifactIdentity.nameOf(identity, "rulings"))),
            },
          }
        : {}),
      ...(record.op === "fix"
        ? {
            dispositions: CarrierReads.#dispositionsOf(
              (draft as { dispositions?: unknown }).dispositions,
            ),
          }
        : {}),
    };
  }

  /** The round identity one line/record pair spells. */
  static identityOf(line: string, record: RoundCoordinate): RoundIdentity {
    return new RoundIdentity({
      line,
      op: record.op,
      cycle: record.cycle,
      attempt: record.attempt,
    });
  }

  /** One repo-relative file's text, through the workspace's ONE material read. */
  #textOf(rel: RepoPath): string | null {
    const read = this.#workspace.readText(rel);
    return read.kind === "text" ? read.value : null;
  }

  /** One draft's dispositions as the fix criterion reads them — the declared decision
   *  vocabulary only; a row whose status is anything else is handed over unchanged so the
   *  criterion's own shape refusal names it (this read judges no table). */
  static #dispositionsOf(value: unknown): Readonly<Record<string, FixDisposition>> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const rows: Record<string, FixDisposition> = {};
    for (const [key, row] of Object.entries(value as Record<string, unknown>)) {
      const cell = (row ?? {}) as { readonly status?: unknown; readonly reason?: unknown };
      rows[key] = {
        status: (cell.status === "rejected" ? "rejected" : "fixed") as FixDisposition["status"],
        ...(typeof cell.reason === "string" ? { reason: cell.reason } : {}),
      };
    }
    return rows;
  }
}

/** The construction facts — every collaborator is the composition root's own instance. */
export interface AdvanceReadsOptions {
  readonly paths: Paths;
  readonly workspace: Workspace;
  readonly clock: Clock;
  readonly git: GitClient;
  readonly ledger: Ledger;
  readonly lines: LinePhase;
  readonly carriers: CarrierReads;
  readonly pipeline: Pipeline;
  readonly artifacts: Artifacts;
  readonly documents: DocumentJudgment;
  readonly world: DocWorld;
  readonly brief: BriefReads;
  readonly prompts: PromptBandReads;
  readonly wording: StationWording;
  /** The dispatch host the one probe read ("" = no harness). */
  readonly host: () => string;
  /** One repo-relative file's text, or null — the plan read. */
  readonly planText: (rel: RepoPath) => string | null;
  /** The base artifact's branch name, "" when absent. */
  readonly baseBranch: () => string;
}

/** One round-context cell the exigibility rows judged into a refusal. */
interface ExigibleCell {
  readonly token: string;
  readonly path: true | undefined;
  readonly written: "engine" | undefined;
  readonly reason: "target-absent" | "empty-value";
}

/**
 * AdvanceReads — the advance segment's production reads. Invariant: one step's value record is
 * composed once, and every read the step asks for answers from the collaborators it was
 * constructed with (see the file's header).
 */
export class AdvanceReads implements LifecycleReads {
  readonly #o: AdvanceReadsOptions;
  /** The frame the current step is reading — the cells whose read takes no frame (the plan's
   *  task set at closure) resolve against this ONE value, set by `preflight`. */
  #frame: FrameFacts | null = null;

  constructor(opts: AdvanceReadsOptions) {
    this.#o = opts;
  }

  // -------------------------------------------------------------------------
  // the gate context
  // -------------------------------------------------------------------------

  /** The gate context of one dispatch: the four station rows, the plan/ledger bundle, the
   *  judged document and the tree's occupancy. */
  preflight(frame: FrameFacts, holding: InFlightState): PreFlightContext {
    this.#frame = frame;
    const artifact = this.#artifactOf(frame);
    const values = this.#valuesOf(frame, this.#briefName(frame), artifact);
    return {
      type: frame.type,
      slug: frame.slug,
      op: AdvanceReads.#opOf(frame),
      cycle: frame.round,
      attempt: frame.attempt,
      ...(frame.recover ? { recover: true } : {}),
      inflight: AdvanceReads.#inflightOf(holding),
      graph: frame.graph,
      planLedger: this.#planLedgerOf(frame),
      doc: this.#docOf(frame),
      rows: this.#stationsOf(frame, values, artifact),
    };
  }

  // -------------------------------------------------------------------------
  // the dispatch input
  // -------------------------------------------------------------------------

  /** The dispatch's frame, assembled from the ONE value record and refused by name when the
   *  rendered prompt is empty. */
  dispatchFrame(frame: FrameFacts, briefPath: string): DispatchFrameRead {
    // The host row is the frame's own input — a dispatch without a harness has no argv form.
    // The pre-flight's `no-host` station refuses that tree before this read, so the answer
    // here is the declared refusal of an environment that moved under the step, never an
    // index into a table the empty string does not key.
    const host = this.#o.host();
    if (!isHostId(host)) return { kind: "no-host" };
    const artifact = this.#artifactOf(frame);
    const values = this.#valuesOf(frame, briefPath, artifact);
    const identity = this.#identityOf(frame);
    const stem = ArtifactIdentity.nameOf(identity, "log").slice(0, -RoundLogLayout.SUFFIX.length);
    const log = this.#workspaceOf(frame).roundLogOf(stem);
    return assembleDispatchFrame({
      frame,
      briefPath: briefPath as RepoPath,
      values,
      prompts: this.#o.prompts,
      host,
      cwd: this.#o.paths.root.absolute,
      log: { file: this.#o.paths.root.resolve(log), path: log },
    });
  }

  /** The brief's three cells: its name, its bytes and the task-only projection a wave round
   *  binds. */
  brief(frame: FrameFacts): BriefLanding {
    const text = frame.planText ?? "";
    const blocks = AdvanceReads.#blocksOf(text);
    const reviewed =
      blocks === null ? undefined : this.#o.brief.taskBody(text, blocks, frame.tasks);
    const content = blocks === null ? text : this.#o.brief.render(text, blocks, frame.tasks, []);
    return {
      name: this.#briefName(frame),
      content,
      ...(reviewed === undefined ? {} : { reviewed }),
    };
  }

  /** The dispatched brief's landing — the workspace's own text write face. */
  writeText(name: string, content: string): WriteOutcome {
    return this.#workspaceOf(this.#frame).writeText(name, content);
  }

  // -------------------------------------------------------------------------
  // the round's own facts
  // -------------------------------------------------------------------------

  /** The checked read of the round this frame dispatched — findings, work status and the fix
   *  facts, from the carrier the ledger resolved for it. A digest mismatch throws there. */
  async carried(frame: FrameFacts): Promise<CarriedFacts> {
    // The round being booked is not in the ledger yet — the carrier's coordinate is the
    // FRAME's own, which is the same identity the booking writes next.
    return this.#o.carriers.factsOf(this.#lineWordOf(frame), {
      op: AdvanceReads.#opOf(frame),
      cycle: frame.round,
      attempt: frame.attempt,
    });
  }

  /** The findings of the most recent judged record carrying a non-empty set — the regrade
   *  judgment's reference. */
  priorFindings(frame: FrameFacts): readonly RoundFinding[] {
    const earlier: JudgedRecord[] = [];
    for (const record of this.#recordsOf(frame)) {
      if (!AdvanceReads.#before(record, frame)) continue;
      earlier.push({ findings: this.#findingsOf(frame, record) });
    }
    return Handoff.priorFindingsOf(earlier);
  }

  /** The plan's task set, read at the closure point. */
  planTasks(): readonly number[] {
    const frame = this.#requireFrame();
    const blocks = AdvanceReads.#blocksOf(frame.planText ?? "");
    return blocks === null ? [] : blocks.blocks().map((block) => block.id);
  }

  /** The judged document's current FILE bytes — the review line's version binding. */
  docText(frame: FrameFacts): string | null {
    return frame.doc === null ? null : this.#readRel(frame.doc);
  }

  /** Whether the tree carries a stale record naming the round this frame dispatches. */
  stale(frame: FrameFacts, holding: InFlightState): boolean {
    if (holding.kind !== "held" || holding.alive) return false;
    const record = holding.record;
    return (
      record.slug === frame.slug &&
      record.phase === frame.phase &&
      record.cycle === frame.round &&
      record.attempt === frame.attempt
    );
  }

  /** Whether the drifted line asks for a reopen — the takeover's second leg. Drift alone is
   *  not enough: the line must also sit at the pending fix the reopen resolves. */
  reopenRequested(frame: FrameFacts): boolean {
    const drifted =
      frame.type === "wave"
        ? this.#o.lines.briefDriftedAt(frame.key)
        : this.#o.lines.reopenedAt(frame.key, frame.type, frame.doc);
    if (!drifted) return false;
    return this.#o.lines.phaseOf(frame.key, frame.type) === "fix";
  }

  /** The requesting review's carrier, as a fix round reads it — its findings and the two
   *  coordinates the fix hop carries. Empty off the fix face and when the carrier resolves no
   *  path (an unresolvable name has no findings to read). */
  requesting(frame: FrameFacts): {
    readonly findings: readonly RoundFinding[];
    readonly reviews?: string;
    readonly rulings?: string;
  } {
    const requester = this.#requesterOf(frame);
    if (requester?.path == null) return { findings: [] };
    const text = this.#readRel(requester.path);
    const read = text === null ? null : Handoff.read(text, "judge");
    return {
      findings: read !== null && read.kind === "compliant" ? Handoff.findingsOf(read.draft) : [],
      reviews: requester.path,
      ...(requester.identity === null
        ? {}
        : { rulings: String(this.#relOfName(requester.identity, "rulings")) }),
    };
  }

  // -------------------------------------------------------------------------
  // the git and evidence facts
  // -------------------------------------------------------------------------

  /** The commits this round's group produced since its baseline. */
  async commits(base: string): Promise<number> {
    return (await this.#o.git.commitsSince(base)).length;
  }

  /** The group's recorded dispatch baseline — the earliest round record's own cell. */
  groupBase(frame: FrameFacts): string | null {
    for (const record of this.#recordsOf(frame)) {
      if (record.dispatchBase !== null) return record.dispatchBase;
    }
    return null;
  }

  /** The HEAD this dispatch starts from — measured once per step. */
  async head(): Promise<string | null> {
    return this.#o.git.head();
  }

  /** Whether this round's own commits touched the input the round binds. Three answers:
   *  `true` / `false` off a READABLE range, `null` when nothing was measured. */
  async touchedDoc(frame: FrameFacts, base: string | null): Promise<boolean | null> {
    const paths = await this.#o.git.pathsSince(base);
    if (paths === null) return null;
    const bound = frame.planPath;
    if (bound === null) return false;
    const wanted = this.#o.paths.root.relativize(bound);
    return paths.some((path) => this.#o.paths.root.relativize(path) === wanted);
  }

  /** The round's test-evidence file, read once — the artifact identity's own name. */
  evidence(frame: FrameFacts): EvidenceFile {
    const identity = this.#identityOf(frame);
    const name = ArtifactIdentity.nameOf(identity, "evidence");
    return {
      target: String(this.#o.workspace.relOf(name)),
      read: Handoff.evidenceOf(this.#o.workspace.readJson(name)),
    };
  }

  /** The consecutive-blocker run the round at `frame.round` closes. */
  blockerRun(frame: FrameFacts): number {
    return this.#o.lines.blockerRunOf(frame.key, frame.type, frame.round);
  }

  /** The line's ONE next hop — the very object the board's `next:` row renders. */
  hopOf(frame: FrameFacts): NextHop {
    return this.#o.pipeline.hopOf(frame.pipeline);
  }

  // -------------------------------------------------------------------------
  // the value record and its station rows
  // -------------------------------------------------------------------------

  /** THE one pre-frame value record of this dispatch — the identity cell, the scene cell and
   *  the artifact snapshot collapsed onto one basis. */
  #valuesOf(
    frame: FrameFacts,
    briefPath: string,
    artifact: ArtifactSnapshot,
  ): Readonly<Record<string, string>> {
    const scene = this.#sceneOf(frame, briefPath);
    return DispatchValues.compose(
      {
        // The VERB is the command's, never the line's derived phase: a fix request on a line
        // still at implement is refused by the line leg, but the prompt it would have carried
        // is composed first, and `INPUT_REVIEWS` is the fix face's own cell.
        op: AdvanceReads.#commandOpOf(frame.command),
        type: frame.type,
        // The ROW is the command's own mode, never the line's derived phase: a command that
        // asked for `implement` on a line already at review is judged against the round it
        // asked for (the wave gate then refuses the phase), and its prompt band follows the
        // same word.
        phase: frame.command,
        tasks: frame.tasks.join(","),
        cycle: frame.round,
        attempt: frame.attempt,
      },
      scene,
      artifact,
    );
  }

  /** Whether one wave frame has an input face at all — the plan's derived open batch is the
   *  wave the dispatch would run, and an empty one means the request names no batch: no `WAVE`
   *  cell, no brief, nothing for the four station rows to judge. */
  static #hasOpenBatch(frame: FrameFacts, pipeline: Pipeline): boolean {
    if (frame.graph === null) return false;
    return frame.graph.frontier(pipeline.closedTasks()).length > 0;
  }

  /** The four pre-dispatch stations, in the gate's declared order — every violation in one
   *  pass, so a refused round is repaired once instead of one row per dispatch. Null when the
   *  face has NO input face: a wave dispatch whose derived open batch is empty names no
   *  `WAVE` cell and no brief, so the four rows judge nothing and stand down (the line leg
   *  owns that request — a station refusing the empty cells would mask it). */
  #stationsOf(
    frame: FrameFacts,
    values: Readonly<Record<string, string>>,
    artifact: ArtifactSnapshot,
  ): readonly DispatchRowReading[] | null {
    if (frame.type === "wave" && !AdvanceReads.#hasOpenBatch(frame, this.#o.pipeline)) return null;
    const rows: DispatchRowReading[] = [];
    const host = this.#o.host();
    if (host === "") rows.push({ station: "no-host", detail: this.#o.wording.noHost });
    if (artifact.kind === "mismatch") {
      rows.push({ station: "carrier", detail: CarrierLine.of(artifact.carrier) });
    }
    const inputDetail = this.#dispatchInputOf(frame, values);
    if (inputDetail !== null) rows.push({ station: "dispatch-input", detail: inputDetail });
    const artifactDetail = this.#artifactDetailOf(artifact);
    if (artifactDetail !== null) rows.push({ station: "artifact", detail: artifactDetail });
    return rows;
  }

  /** The `dispatch-input` row: the round-context declarations' exigible cells, judged against
   *  the value record, every failing cell reported in one pass. */
  #dispatchInputOf(frame: FrameFacts, values: Readonly<Record<string, string>>): string | null {
    const band = this.#bandOf(values);
    if (band === null) return null;
    // The two DECLARED scene facts the arms read: the identity document declared a
    // `program:` literal, and it declared an IDENTITY shape (`doc-type:` other than the
    // plan's). A plan-only line declares no identity document, so the identity arms miss.
    const scene = { program: frame.program !== null, docType: frame.pipeline.specType !== null };
    const segments: string[] = [];
    for (const cell of AdvanceReads.#exigibleOf(band.layout, scene, frame.type)) {
      const reason = this.#reasonOfCell(cell, values);
      if (reason === null) continue;
      segments.push(
        this.#o.wording.dispatchInput.segment
          .replace("{row}", values.ROLE ?? "")
          .replace("{token}", cell.token)
          .replace("{reason}", reason),
      );
    }
    if (segments.length === 0) return null;
    // The station word is the VERDICT's (`gate`), never part of the detail: the record holds
    // the conclusion alone, and the door adds the row name exactly once.
    return segments.join(this.#o.wording.dispatchInput.separator);
  }

  /** Why one exigible cell fails, or null when it stands: an empty value earns the
   *  declaration's own word unless the engine writes that file, and a non-empty PATH cell is
   *  read once through the document world's existence face. */
  #reasonOfCell(cell: ExigibleCell, values: Readonly<Record<string, string>>): string | null {
    const value = values[cell.token] ?? "";
    if (value === "") return cell.written === "engine" ? null : cell.reason;
    if (cell.path !== true || cell.written === "engine") return null;
    return this.#o.world.exists(this.#o.paths.root.relativize(value)) ? null : "target-absent";
  }

  /** The `artifact` row's two shapes: a present-but-unreadable sidecar, or a sidecar sitting
   *  off the name the record renders. */
  #artifactDetailOf(artifact: ArtifactSnapshot): string | null {
    if (artifact.kind !== "read") return null;
    const read = artifact.read;
    if (read.kind === "invalid") {
      return this.#o.wording.artifact.invalid.replace("{reason}", read.reason);
    }
    if (read.kind !== "misplaced") return null;
    return AdvanceReads.#artifactReportOf(this.#o.wording.artifact, {
      sidecarKind: "rulings",
      derived: String(read.path),
      found: read.names.map(String),
      identity: this.#o.wording.identityWords(this.#requesterIdentityOf()),
    });
  }

  /** The `misplaced` report — the one composition of the four continuation rows. */
  static #artifactReportOf(
    wording: StationWording["artifact"],
    facts: {
      readonly sidecarKind: string;
      readonly derived: string;
      readonly found: readonly string[];
      readonly identity: string;
    },
  ): string {
    const found =
      facts.found.length === 0 ? wording.emptyFound : facts.found.join(wording.foundJoin);
    return [
      wording.reason.replace("{kind}", facts.sidecarKind),
      wording.derived.replace("{derived}", facts.derived),
      wording.found.replace("{found}", found),
      wording.identity.replace("{identity}", facts.identity),
      ...wording.repair,
    ].join("\n");
  }

  /** The cells one row's declarations make exigible on this dispatch. Arms are CONJUNCTIVE
   *  within a cell: any hit makes it exigible, and a `program` hit is the `target-absent`
   *  reason (the charter the declaration names did not resolve). */
  static #exigibleOf(
    layout: readonly ContextDeclarationRead[],
    scene: { readonly program: boolean; readonly docType: boolean },
    type: TargetType,
  ): readonly ExigibleCell[] {
    const cells: ExigibleCell[] = [];
    for (const declaration of layout) {
      const token = /\{\{([A-Z0-9_]+)\}\}/.exec(declaration.line)?.[1];
      if (token === undefined) continue;
      const hits = declaration.requiredOn.filter((arm) => AdvanceReads.#armHits(arm, scene, type));
      if (hits.length === 0) continue;
      cells.push({
        token,
        path: declaration.path,
        written: declaration.written,
        reason: hits.some((arm) => arm.when === "program") ? "target-absent" : "empty-value",
      });
    }
    return cells;
  }

  /** Whether one declared arm is exigible: the type hit plus, when the arm carries one, its
   *  structural precondition read off the two DECLARED scene facts. */
  static #armHits(
    arm: ExigibleArmRead,
    scene: { readonly program: boolean; readonly docType: boolean },
    type: TargetType,
  ): boolean {
    const typed = arm.types === "always" || arm.types.includes(type);
    if (!typed) return false;
    if (arm.when === "program") return scene.program;
    if (arm.when === "identity") return scene.docType;
    return true;
  }

  /** The declared prompt band of this dispatch's value record, or null when the record names
   *  no declared row (an empty render, which the empty-prompt refusal owns). */
  #bandOf(
    values: Readonly<Record<string, string>>,
  ): { layout: readonly ContextDeclarationRead[] } | null {
    const role = values.ROLE ?? "";
    if (role === "review") {
      const type = values.TARGET_TYPE ?? "";
      return this.#o.prompts.reviewTypes().includes(type)
        ? this.#o.prompts.bandOf("review", type)
        : null;
    }
    return this.#o.prompts.modes().includes(role) ? this.#o.prompts.bandOf("work", role) : null;
  }

  // -------------------------------------------------------------------------
  // the artifact snapshot
  // -------------------------------------------------------------------------

  /** This dispatch's artifact judgment: the requested carrier's integrity, then the ruling
   *  sidecar the fix face reads. */
  #artifactOf(frame: FrameFacts): ArtifactSnapshot {
    const requester = this.#requesterOf(frame);
    const reviewsPath = requester?.path ?? null;
    // The bytes judged are the carrier the dispatch NAMES (the flag included), against the
    // digest the same-cycle record remembers — the shipped engine's pair: a flag pointing at
    // one carrier while the cycle's review recorded another is exactly the tamper this row
    // exists to state.
    if (requester !== null && requester.record !== null && reviewsPath !== null) {
      const text = this.#readRel(reviewsPath);
      const current = text === null ? null : CarrierLine.digestOf(AdvanceReads.#parseOrNull(text));
      const mismatch = CarrierLine.mismatch(requester.record.carrierDigest, current);
      if (mismatch !== null) {
        return {
          kind: "mismatch",
          reviewsPath,
          carrier: {
            // The diagnostic names the ABSOLUTE carrier a reader opens; the value's path
            // cells stay on the repository basis.
            line: this.#o.paths.root.resolve(reviewsPath as RepoPath),
            recorded: CarrierLine.sha8(mismatch.recorded),
            current: CarrierLine.sha8(mismatch.current),
          },
        };
      }
    }
    return { kind: "read", reviewsPath, read: this.#sidecarOf(requester) };
  }

  /** The ruling sidecar's read — the fix face alone carries one. The carrier reference is the
   *  requesting path with the digest the record remembers, `null` when it remembers none: the
   *  sidecar's findings are still judged against the carrier's own ids, with zero comparison. */
  #sidecarOf(requester: RequestingCarrierRead | null): ArtifactRead {
    if (requester?.path == null || requester.identity == null) return { kind: "absent" };
    const reads = new ArtifactReads({ artifacts: this.#o.artifacts, source: this.#sourceOf() });
    return reads.read(requester.identity, "rulings", {
      path: requester.path as RepoPath,
      digest: requester.record === null ? null : requester.record.carrierDigest,
    });
  }

  /** The workspace read faces the artifact reads are taken over. */
  #sourceOf(): {
    names(): readonly string[];
    readText(target: RepoPath): string | null;
    relOf(name: string): RepoPath;
  } {
    return {
      names: () =>
        this.#o.paths.listing.names(
          this.#workspaceOf(this.#frame).relOf("").replace(/\/$/, "") as RepoPath,
        ),
      readText: (target) => this.#readRel(target),
      relOf: (name) => this.#workspaceOf(this.#frame).relOf(name),
    };
  }

  /** The requesting carrier a fix frame resolves — the ONE three-branch priority the shipped
   *  engine states (`RequestingCarrier.path`): the explicit `--reviews` flag, then the
   *  carrier path the same-cycle review record remembers, then the review family's resolved
   *  name for the cycle. Two readers ask it (the dispatch's `INPUT_REVIEWS` cell and the
   *  completion criterion's input findings), so the order and the judgments live here alone.
   *
   *  `path` is null on a record that resolves no carrier (the dispatch-input gate words that
   *  `empty-value`) and off the fix face. `identity` is the coordinate a sidecar is named
   *  from: the record's own when there is a record, else the carrier's own attributed name —
   *  a `--reviews` value names a file whose round is readable off the name itself. */
  #requesterOf(frame: FrameFacts): RequestingCarrierRead | null {
    // The fix FACE is the command the caller typed, never the line's derived phase: a fix
    // request on a line still at implement is exactly the request the line leg refuses, and it
    // still carries the carrier its prompt names.
    if (frame.command !== "fix") return null;
    const record = this.#requestingRecordOf(frame);
    const path = this.#reviewsPathOf(frame, record);
    return { path, record, identity: this.#requestedIdentityOf(frame, path, record) };
  }

  /** The identity the requesting carrier's sidecar is named from — the record's own coordinate
   *  when there is a record, else the carrier NAME's attribution (a `--reviews` value names a
   *  file whose round is readable off the name itself). */
  #requestedIdentityOf(
    frame: FrameFacts,
    path: string | null,
    record: RoundRecord | null,
  ): RoundIdentity | null {
    if (record !== null) {
      return new RoundIdentity({
        line: frame.key,
        op: record.op,
        cycle: record.cycle,
        attempt: record.attempt,
      });
    }
    if (path === null) return null;
    const name = path.split("/").pop() ?? path;
    return this.#o.artifacts.attribute(name)?.round ?? null;
  }

  /** The three branches of the requesting carrier, in the shipped order. A record that resolves
   *  no carrier ends the walk (the unrecorded face, worded `empty-value`); only a cycle that
   *  records NO review falls back to the family name, which the gate can then word
   *  `target-absent` when that name is not on disk. The record branch asks the ledger for the
   *  carrier of a RECORD, whose accessor keys a line by its persisted ROW key — the frame holds
   *  the LINE word (`tasks-1`), so the ONE fold between the two spellings is applied here
   *  rather than left to the accessor's own re-derivation (which would spell `tasks-tasks-1`
   *  and resolve nothing). */
  #reviewsPathOf(frame: FrameFacts, record: RoundRecord | null): string | null {
    if (frame.reviews !== null) return frame.reviews;
    if (record === null) return String(this.#reviewFamilyPathOf(frame));
    const recorded = this.#o.ledger.carrierPathOf(
      frame.type,
      RoundIdentity.rowKeyOf(frame.key),
      record,
    );
    return recorded === "" ? null : String(recorded);
  }

  /** The review family's name for this frame's CYCLE — the "fall back with the cycle only"
   *  rule, resolved the way the shipped read resolves it: the round's CANONICAL carrier
   *  (`<line>-review-<cycle>[-a<attempt>].json`, the child's own draft) unless the finalized
   *  `.c<cycle>` sibling is on the disk face, which then wins as the round's answer. The
   *  FINAL-only spelling this read used to answer made a workspace recoverable in the shipped
   *  engine (`--recover`'s draft-with-no-record state) read as an absent carrier here — a
   *  repair the engine cannot perform, because the bytes are on disk under the name it reads.
   *  It never carries the asking dispatch's attempt: a fix retried at attempt 2 would otherwise
   *  ask for an `-a2` name the cycle's review never wrote, and a cycle with no review record
   *  has no recorded attempt to inherit either. A final that cannot be read is not an answer —
   *  the canonical name stands, and the round's integrity check stays the carrier read's. */
  #reviewFamilyPathOf(frame: FrameFacts): RepoPath {
    const identity = new RoundIdentity({
      line: frame.key,
      op: "review",
      cycle: frame.round,
      attempt: 1,
    });
    const final = this.#o.workspace.relOf(ArtifactIdentity.nameOf(identity, "final"));
    if (this.#readRel(final) !== null) return final;
    return this.#o.workspace.relOf(ArtifactIdentity.nameOf(identity, "draft"));
  }

  /** The same-cycle review record this fix frame answers — the latest attempt of the
   *  same-contract line at the same cycle (a re-dispatched review supersedes its predecessor,
   *  the same rule the round-read gate applies). Null when the line records no review here. */
  #requestingRecordOf(frame: FrameFacts): RoundRecord | null {
    return this.#recordsOf(frame)
      .filter((record) => record.op === "review" && record.cycle === frame.round)
      .reduce<RoundRecord | null>(
        (newest, candidate) =>
          newest === null || candidate.attempt >= newest.attempt ? candidate : newest,
        null,
      );
  }

  /** The identity the `artifact` report names — the requesting carrier's own. */
  #requesterIdentityOf(): RoundIdentity {
    const frame = this.#requireFrame();
    const requester = this.#requesterOf(frame);
    if (requester?.identity != null) return requester.identity;
    return this.#identityOf(frame);
  }

  /** One round identity's artifact name, repo-relative. */
  #relOfName(identity: RoundIdentity, kind: "final" | "draft" | "rulings" | "evidence"): RepoPath {
    return this.#o.workspace.relOf(ArtifactIdentity.nameOf(identity, kind));
  }

  // -------------------------------------------------------------------------
  // the scene cells
  // -------------------------------------------------------------------------

  /** The round identity of one frame. */
  #identityOf(frame: FrameFacts): RoundIdentity {
    return new RoundIdentity({
      line: frame.key,
      op: AdvanceReads.#opOf(frame),
      cycle: frame.round,
      attempt: frame.attempt,
    });
  }

  /** The line's scene facts — every path cell in the shape its producer holds. */
  #sceneOf(frame: FrameFacts, briefPath: string): Parameters<typeof DispatchValues.compose>[1] {
    const identity = this.#identityOf(frame);
    const evidence = ArtifactIdentity.nameOf(identity, "evidence");
    return {
      repoRoot: this.#o.paths.root,
      docPath: frame.doc,
      planPath: frame.planPath,
      // The judged line's design-document anchor is the IDENTITY document's own path (the
      // same read the pipeline frontier names), never a link parsed out of the plan.
      specLink: frame.pipeline.specPath,
      overallLink: frame.overall,
      baseBranch: this.#o.baseBranch(),
      briefPath,
      workspaceDir: this.#o.workspace.path,
      workspaceId: frame.slug,
      reportPath: ArtifactIdentity.nameOf(identity, "report"),
      evidencePath: TargetFaces.isDocShape(frame.type) ? "" : this.#o.workspace.relOf(evidence),
      handoffPath: ArtifactIdentity.nameOf(identity, "final"),
      handoffSchema: this.#handoffSchemaOf(frame),
    };
  }

  /** The `## Handoff schema` section of this dispatch's prompt — the plane's writable subset
   *  (work rounds also carry the evidence contract). */
  #handoffSchemaOf(frame: FrameFacts): string {
    const op = AdvanceReads.#opOf(frame);
    const evidence = Handoff.planeOf(op) === "work" && !TargetFaces.isDocShape(frame.type);
    return Handoff.sectionText(Handoff.planeOf(op), evidence);
  }

  /** The brief's workspace-relative name — `BriefRenderer`'s own rule. */
  #briefName(frame: FrameFacts): string {
    return this.#o.brief.name(frame);
  }

  // -------------------------------------------------------------------------
  // the plan/ledger bundle and the judged document
  // -------------------------------------------------------------------------

  /** The plan/ledger row's two inputs; null when the face carries neither a plan read nor a
   *  plan-layered face. */
  #planLedgerOf(frame: FrameFacts): PlanLedgerTarget | null {
    if (!(frame.type === "plan" || frame.type === "wave" || frame.type === "branch")) return null;
    if (frame.planPath === null || frame.planText === null || frame.graph === null) return null;
    return {
      input: AdvanceReads.#judgeInputOf("plan", frame.planPath, frame.planText, frame.graph),
      facts: this.#ledgerFactsOf(frame),
    };
  }

  /** The judged document's input; null off the doc faces and on a document that cannot be
   *  read (the row then renders `unreadable`). */
  #docOf(frame: FrameFacts): JudgeInput | null {
    if (!TargetFaces.isDocShape(frame.type) || frame.doc === null) return null;
    const text = this.#readRel(frame.doc);
    if (text === null) return null;
    const declared = AdvanceReads.#declaredTypeOf(text) ?? (frame.type as DocType);
    return AdvanceReads.#judgeInputOf(declared, frame.doc, text, frame.graph);
  }

  /** One judged document's input — the plan's layers and edge issues ride the plan document
   *  alone, so the layer-reading rule yields on every other shape. No phase coordinate is one
   *  of the judgment's inputs: a cross-document chain reads the Phase inventory's own row ids
   *  off the parent charter, and a document SLUG is not one of those ids — handing one in
   *  fabricated a `cross-doc-chain` finding against every charter. */
  static #judgeInputOf(
    docKey: DocType,
    path: string,
    content: string,
    graph: TaskGraph | null,
  ): JudgeInput {
    return {
      docKey,
      path: path as RepoPath,
      content,
      // The plan's topological layers ride the graph gate's OWN derivation, so a document
      // judged on a line that registers a plan reads the same layer set the wave gate will
      // dispatch against. A cycled plan never reaches here: the `graph` row refuses first.
      ...(graph === null ? {} : { taskLayers: graph.batches() }),
    };
  }

  /** The plan/ledger fact bundle — one read of the ledger's wave rows. */
  #ledgerFactsOf(frame: FrameFacts): LedgerFacts {
    const waves = this.#o.ledger.waveLines();
    const closed = new Set<number>();
    for (const row of waves) {
      if (!this.#o.lines.waveClosedAt(RoundIdentity.splitLineWord(row.line).key)) continue;
      for (const task of row.taskIds) closed.add(task);
    }
    const ids = waves.map((row) => row.taskIds).filter((row) => row.length > 0);
    const planTasks = frame.graph === null ? [] : [...frame.graph.nodes()];
    return {
      planTasks,
      recordedTasks: AdvanceReads.#recordedTasksOf(waves),
      closedWaves: ids.filter((row) => row.every((task) => closed.has(task))),
      openWaves: ids.filter((row) => row.some((task) => !closed.has(task))),
      snapshots: waves.flatMap((row) =>
        row.planTasks === null || row.taskIds.length === 0
          ? []
          : [{ wave: RoundIdentity.splitLineWord(row.line).key, planTasks: [...row.planTasks] }],
      ),
      layers: frame.graph === null ? [] : frame.graph.batches(),
    };
  }

  /** The task ids the ledger recorded a COMPLETED round for — the plan/ledger agreement's
   *  recorded set, so a dispatched-but-failed round does not close the agreement. */
  static #recordedTasksOf(waves: readonly WaveLine[]): readonly number[] {
    const recorded: number[] = [];
    for (const row of waves) {
      if (!row.rounds.some((record) => record.verdict.targetAction)) continue;
      recorded.push(...row.taskIds);
    }
    return recorded;
  }

  /** The plan's ahead count — the `checked:` info row's cell. */
  static planAheadOf(facts: LedgerFacts): number {
    return LedgerTaskSetRule.planAhead(facts);
  }

  // -------------------------------------------------------------------------
  // the small shared readers
  // -------------------------------------------------------------------------

  /** The tree's occupancy as the gate's row reads it — the same three states, with the
   *  record's own target facts folded to their names. */
  static #inflightOf(state: InFlightState): PreFlightContext["inflight"] {
    if (state.kind === "absent") return { kind: "absent" };
    if (state.kind === "corrupt") return { kind: "corrupt", locked: state.locked };
    return {
      kind: "held",
      pid: state.record.pid,
      command: state.record.command,
      startedAt: state.record.startedAt,
      wave: state.record.wave,
      slug: state.record.slug,
      alive: state.alive,
      targetGone: state.targetGone.map(String),
    };
  }

  /** The ledger op one frame's phase books under. */
  static #opOf(frame: FrameFacts): "implement" | "review" | "fix" {
    return frame.phase === "branch-review" ? "review" : frame.phase;
  }

  /** The round verb one COMMAND word names — `branch-review` folds to its own word's op, and
   *  every non-work word reads as a review (only the fix face consumes this cell). */
  static #commandOpOf(command: string): "implement" | "review" | "fix" {
    return command === "implement" || command === "fix" ? command : "review";
  }

  /** Whether one record precedes this frame's round on the line. */
  static #before(record: RoundRecord, frame: FrameFacts): boolean {
    return record.cycle === frame.round
      ? record.attempt < frame.attempt
      : record.cycle < frame.round;
  }

  /** One carrier's parsed draft, or an empty object when the bytes do not parse (the carrier
   *  row's integrity judgment reads the digest, never the JSON). */
  static #parseOrNull(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  /** The declared `doc-type:` of one document, narrowed to the declared vocabulary. */
  static #declaredTypeOf(text: string): DocType | null {
    try {
      const declared = frontmatterOf(text).head.docType;
      if (declared === null) return null;
      return (DOC_TYPE_VALUES as readonly string[]).includes(declared)
        ? (declared as DocType)
        : null;
    } catch {
      return null;
    }
  }

  /** The workspace every read is taken over — the frame's own slug when the step has one,
   *  else the composition root's workspace. */
  #workspaceOf(frame: FrameFacts | null): Workspace {
    if (frame === null) return this.#o.workspace;
    return frame.slug === this.#o.workspace.slug
      ? this.#o.workspace
      : this.#o.workspace.root.at(frame.slug);
  }

  /** The line's round records for one frame. */
  #recordsOf(frame: FrameFacts): readonly RoundRecord[] {
    return this.#o.ledger.rounds(frame.key);
  }

  /** One repo-relative file's text, through the ONE material read. */
  #readRel(rel: string): string | null {
    const read = this.#o.workspace.readText(rel as RepoPath);
    return read.kind === "text" ? read.value : null;
  }

  /** The current step's frame, refusing by name when a frame-free read runs before one. */
  #requireFrame(): FrameFacts {
    if (this.#frame === null)
      throw new Error("AdvanceReads: a frame-free read ran before any frame");
    return this.#frame;
  }

  /** The findings one record carries, read through the checked carrier. */
  #findingsOf(frame: FrameFacts, record: RoundRecord): readonly RoundFinding[] | null {
    return this.#o.carriers.factsOf(this.#lineWordOf(frame), record).findings;
  }

  /** The line word one frame's rounds hang on. */
  #lineWordOf(frame: FrameFacts): string {
    return frame.key;
  }

  /** One plan text's task blocks — the extraction the brief's two products share. A plan whose
   *  block grammar breaks yields no extraction, never a throw. */
  static #blocksOf(text: string): TaskBlocks | null {
    try {
      return TaskBlocks.parse(text, "plan");
    } catch {
      return null;
    }
  }
}
