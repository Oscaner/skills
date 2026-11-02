// packages/cdd-engine/src-next/face/lifecycle.ts
// T8 — the lifecycle face (the split contract §6.2: face/cli.ts slims to composition).
// The dispatch seam's production default lives here — CliLifecycle (the former
// HarnessDispatch composition member, renamed by the split; face/cli.ts re-exports it
// as HarnessDispatch so the public surface is unchanged) — the dispatch + readback +
// round-context plane (§6.2: implement/review/fix dispatch, the read-back reconstruct
// (#reconstruct/#reject/#materialize + carrier helpers), the round-context data
// (#valuesOf/#childPrompt/round-context fact assembly)). The shared seams the
// lifecycle rides (cli io / sync process / env / scene) are declared here too — the
// root composition imports them back (zero public-export drift, zero import cycle).
// The root Cli holds the lifecycle instances and composes through them via its .action
// thin shells — zero bare functions; every collaborator stays injectable (the tests
// substitute the hermetic ones).

// The module exports the shared seams + the lifecycle class — zero behavior-carrying
// bare functions.

import { readFileSync } from "node:fs";
import process from "node:process";
import { printParseErrorCode } from "jsonc-parser";
import { CompletionCriteria, FixDispositions } from "../contract/completion-criterion.ts";
import { GitClient } from "../infra/git.ts";
import { ProcessFacts, type ProcessStartReader } from "../infra/proc.ts";
import type { RepoRoot } from "../infra/root.ts";
import { RoundLog } from "../infra/round-log.ts";
import type { JsonRead, Workspace } from "../infra/workspace.ts";
import type { TemplateValues, WorkMode } from "../render/templates.ts";
import { TemplateAssembler } from "../render/templates.ts";
import { TargetFaceTable } from "../session/faces.ts";
import type { CarrierPlane } from "../session/handoff-schema.ts";
import { HandoffSchema } from "../session/handoff-schema.ts";
import { InFlight, type InFlightRecord } from "../session/inflight.ts";
import {
  type CrashCause,
  Ledger,
  type OpType,
  type ProgressRow,
  type RoundIdentity,
  type RoundStatus,
  type RoundVerdict,
  RoundViolation,
  type Termination,
} from "../session/ledger.ts";
import { RoundNaming } from "../session/round-naming.ts";
import type { DispatchOutcome, DispatchStep, OpenFrame } from "../session/run.ts";
import { PlanStructure } from "../session/run.ts";
import { DISPATCH, HOSTS, HostDetect, type HostId, type HostReferenceTable, REFS } from "./host.ts";
import {
  type ChildOutcome,
  type ChildRunner,
  TerminationPolicy,
  Terminator,
} from "./termination.ts";
import { FIX_DISPOSITIONS_SUMMARY, Words } from "./words.ts";

/** The crash-record stdout-tail cap (P11 T2) — the child's last STDOUT_TAIL_MAX
 *  non-empty stdout lines ride the crash record's `stdoutTail` (the diagnostic
 *  channel; the child's Return is prose, never the round's content). */
const STDOUT_TAIL_MAX = 40;

/** The structure-face change message — the round's graded entry when the plan's Task id
 *  set or a task's `DependsOn` set moved inside the round (design spec §7.3). The
 *  vanished / unreadable document cases name their own damage instead. */
const STRUCTURE_CHANGED =
  "the plan's structure changed inside this round (the Task id set or a task's DependsOn set) — the structure face belongs to the orchestrator and lands as its own commit";

// ---------------------------------------------------------------------------
// the stable seams — the shared faces the composition root + the lifecycle ride
// (declared here, re-exported by face/cli.ts so the public surface never drifts)
// ---------------------------------------------------------------------------

/** The CLI io seam — production wraps process stdio; tests capture. */
export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

// ---------------------------------------------------------------------------
// the harness dispatch (the production dispatch default)
// ---------------------------------------------------------------------------

/** The environment face the harness dispatch detects the host against. */
export type ProcessEnvLike = Record<string, string | undefined>;

/** One dispatch scene — the per-invocation composition the work commands assemble
 *  (the workspace + ledger the frame's round rides, the plan/brief paths the prompt
 *  references, the base artifact's branch name the branch review's scope anchor
 *  (BASE_BRANCH) derives). */
export interface DispatchScene {
  workspace: Workspace;
  ledger: Ledger;
  planPath: string | null;
  briefPath: string | null;
  baseBranch?: string | null;
  /** The plan's design-spec reference (the `spec:` front-matter link target), read
   *  from the plan document at the CLI seam — the plan-review round context's extra
   *  read input (a plan review judges the plan against its spec). Null off the plan
   *  scene (the slot stays empty and the assembler drops it). */
  specLink?: string | null;
  /** The parent charter the spec's `program:` names (the same-slug overall's
   *  repoRoot-relative path) — the review/fix round context's extra read input
   *  (the spec-scope reviewer judges the phase against its charter). Null when the
   *  line's spec carries no `program:` (the slot stays empty and the assembler
   *  drops it). */
  overallLink?: string | null;
}

/** One dispatch's PRE-VERDICT outcome — the round's read-back facts before the
 *  terminal verdict is written (design spec §3.1: the verdict first, the gate split
 *  second). The status is the handoff-derived conclusion, and NULL on a round whose
 *  handoff was never written: there the completion criterion alone concludes (an
 *  implement round continues on its commits — the missing carrier is a soft
 *  observation — while a review/fix round fails on its carrier criterion). */
type DraftedOutcome = Omit<DispatchOutcome, "status"> & { status: RoundStatus | null };

/**
 * CliLifecycle — the lifecycle's dispatch-seam production default (the split contract's
 * lifecycle face; face/cli.ts re-exports it as HarnessDispatch so the composition
 * surface keeps its name). `step()` returns the DispatchStep the lifecycle runs, which
 * assembles the dispatch prompt (the render template-contract data plane) from the
 * frame, runs the host harness CLI (the harness-contract rows: cli + invoke flags +
 * the phase's skill-ref slash form) and reads the child's OUTPUT_HANDOFF draft back
 * into the lifecycle's outcome (the child's Return is prose, never parsed). Detection
 * reads the harness-contract detect markers from the injected env — empty host → a
 * BLOCKED outcome over the CDD_BLOCKED channel (never a thrown dispatch).
 */
export class CliLifecycle {
  /** The workspace-relative directory every round log lands in — built by
   *  `RoundLog.create` on first use, never by the workspace's own mkdir. */
  static readonly LOGS_DIR = "logs";

  readonly #env: ProcessEnvLike;
  readonly #sync: ChildRunner;
  readonly #template: TemplateAssembler;
  readonly #io: CliIo;
  readonly #scene: DispatchScene;
  readonly #reviews: string | null;
  /** The single word table (the promotion WARN wording + its station) — one instance,
   *  injected at the composition root, so the lifecycle never re-types a user-facing
   *  line. */
  readonly #words: Words;
  /** The round-naming single source (P11 T4) — every prescribed artifact name of a
   *  frame derives here (the report/evidence/brief names + the family op), so the
   *  lifecycle and the dry-run preview name the same artifacts by one rule. */
  readonly #naming: RoundNaming;
  /** The handoff-schema face — stateless, one shared instance (the read-back
   *  validator + the injected prompt text). */
  readonly #handoffSchema = new HandoffSchema();
  /** The in-flight record handle of this dispatch's workspace root — the ONE write
   *  point of the running dispatch (acquire before the spawn, release at the normal
   *  end; a crash leaves the record behind). */
  readonly #inflight: InFlight;
  /** The git read face — the crash record's `dispatchBase` / `commitsSince` facts. */
  readonly #git: GitClient;
  /** The recorded side of the liveness judgment — the holder pid's own start instant
   *  (`ProcessFacts.startOf`; injected by the tests to span a long session). */
  readonly #proc: ProcessStartReader;
  /** Whether this invocation asked to take over a dead holder's record (the
   *  `--steal-stale` flag — the only takeover path). */
  readonly #stealStale: boolean;
  /** The HEAD the current dispatch started from (null off a repo / before a spawn) —
   *  the postmortem baseline of `commitsSince`. */
  #dispatchBase: string | null = null;
  /** The commits added after `#dispatchBase` (computed once the child returned). */
  #commitsSince: readonly string[] = [];
  /** The current dispatch's child-stdout diagnostic tail (the crash-record channel,
   *  P11 T2) — set in #dispatch after the child returns, read by #reject. The child's
   *  Return is prose; the engine never parses it — this is the failure channel only. */
  #stdoutTail: readonly string[] = [];
  /** The current dispatch's round log path (repoRoot-relative), null when the round has
   *  no log channel — the crash record's postmortem pointer (one file to open instead
   *  of reading `ps` from outside). */
  #roundLogPath: string | null = null;

  constructor(opts: {
    env?: ProcessEnvLike;
    sync?: ChildRunner;
    template?: TemplateAssembler;
    io?: CliIo;
    scene: DispatchScene;
    reviews?: string | null;
    words?: Words;
    inflight?: InFlight;
    git?: GitClient;
    proc?: ProcessStartReader;
    stealStale?: boolean;
  }) {
    this.#env = opts.env ?? process.env;
    this.#scene = opts.scene;
    this.#naming = new RoundNaming(opts.scene.workspace);
    this.#inflight =
      opts.inflight ?? new InFlight(opts.scene.workspace.root, opts.scene.workspace.slug);
    this.#git = opts.git ?? new GitClient();
    this.#proc = opts.proc ?? ProcessFacts;
    this.#stealStale = opts.stealStale ?? false;
    this.#sync = opts.sync ?? new Terminator();
    this.#template = opts.template ?? new TemplateAssembler();
    this.#words = opts.words ?? new Words();
    this.#io = opts.io ?? {
      stdout: (t) => process.stdout.write(t),
      stderr: (t) => process.stderr.write(t),
    };
    this.#reviews = opts.reviews ?? null;
  }

  /** The host-harness id detected from the env — "claude" | "pi" | "" —
   *  a delegation to the module-level judgment (HostDetect.detect, face/host.ts —
   *  the detection's single home; this instance method is the injectable-env
   *  adapter the lifecycle face rides, behavior unchanged). */
  detectHost(env: ProcessEnvLike = this.#env): string {
    return HostDetect.detect(env);
  }

  /** The DispatchStep the lifecycle runs — one frame → the outcome. */
  step(): DispatchStep {
    return (frame) => this.#dispatch(frame);
  }

  /** One dispatch — the round's work, the observation facts every record carries (the
   *  dispatch baseline HEAD captured before the spawn, the dispatch-after
   *  `treeClean` observation) and the TERMINAL VERDICT the round is booked under
   *  (design spec §3.1: the verdict is written first, the violation family splits the
   *  gate second — never the child's exit code). A hard verdict is the round's
   *  failure face: `targetAction: false`, the concluded status is BLOCKED (so the
   *  invocation exits non-zero and the same command re-offers the round), and the ONE
   *  `CDD_BLOCKED` line names the round's own log file (§4.1). A soft entry is
   *  bookkeeping only — it never touches the exit code. */
  async #dispatch(frame: OpenFrame): Promise<DispatchOutcome> {
    // The round's STRUCTURE baseline (design spec §7.3): taken HERE — after the
    // pre-flight gate (which ran before the step was handed over) and before the
    // spawn — so the close-time comparison judges this round's OWN plan edit only.
    // It rides the frame and nowhere else (no progress key, no carrier slot, no
    // in-flight field).
    const baseline = PlanStructure.of(this.#scene.planPath);
    const carried: OpenFrame = {
      ...frame,
      structure: baseline.kind === "ok" ? baseline.structure : null,
    };
    const drafted = await this.#runDispatch(carried);
    const terminal = drafted.status === "BLOCKED" || drafted.status === "TIMEOUT";
    const observed: DraftedOutcome = {
      ...drafted,
      dispatchBase: this.#dispatchBase,
      treeClean: await this.#git.isClean(this.#scene.workspace.root.repoRoot),
    };
    const judged = await this.#verdictOf(carried, observed);
    // The death faces author their own entry AND emit their own line (`#reject`), so
    // only a hard verdict concluded HERE adds the shared line.
    if (judged.violations.some((violation) => violation.grade === "hard") && !terminal) {
      this.#blocked(this.#hardReason(judged.violations), false);
    }
    this.#warnSoft(judged.violations);
    return {
      ...observed,
      // A hard round's conclusion is the failure: no hard entry can leave a round
      // reading as approved. A soft-only round keeps its handoff conclusion, and a
      // round whose handoff was never written concludes APPROVED on its criterion
      // alone (the missing carrier is bookkeeping, never a gate).
      status: this.#concludedStatus(judged.verdict, observed.status),
      verdict: judged.verdict,
      violations: judged.violations,
    };
  }

  /** The round's concluded status under its verdict — a done round keeps its handoff
   *  conclusion (APPROVED when the handoff was never written: the completion criterion
   *  concluded it), and a hard-failed round concludes BLOCKED — or keeps TIMEOUT, the
   *  terminated round's own conveyed face (the §4.3 judging order is unchanged). */
  #concludedStatus(verdict: RoundVerdict, drafted: RoundStatus | null): RoundStatus {
    if (verdict.targetAction) return drafted ?? "APPROVED";
    return drafted === "TIMEOUT" ? "TIMEOUT" : "BLOCKED";
  }

  /** The terminal verdict of one dispatched round (design spec §3.1/§3.2) — the
   *  completion criterion of the round's verb judge its OWN facts (the group's
   *  records, the persisted carrier, the round's baseline) plus the work plane's
   *  evidence gate, and the graded entries decide the verdict: a round with no hard
   *  entry is done. The judgment's two provider cells are supplied HERE, the single
   *  point: `records` is the key's in-register history (`Ledger#recordsOf`), and
   *  `reviewsPath` is the fix route's `--reviews` carrier or the ledger's canonical
   *  review-carrier fallback.
   *
   *  A death face (a killed child, a non-zero exit, a rejected draft) already carries
   *  its authored hard entry and needs no second judgment — the criterion table and
   *  the violation family never judge the same round twice. */
  async #verdictOf(
    frame: OpenFrame,
    outcome: DraftedOutcome,
  ): Promise<{ verdict: RoundVerdict; violations: readonly RoundViolation[] }> {
    const treeClean = outcome.treeClean ?? true;
    if (outcome.status === "BLOCKED" || outcome.status === "TIMEOUT") {
      const authored = outcome.violations ?? [];
      return {
        verdict: { treeClean, targetAction: false },
        // A failure is never a silent absence (§3.3): a concluded BLOCKED round that
        // authored no entry books one here (`contract-violation`, the existing cause).
        violations:
          authored.length > 0
            ? authored
            : [RoundViolation.hard(`the round concluded ${outcome.status}`)],
      };
    }
    const violations: RoundViolation[] = [
      ...(outcome.violations ?? []),
      ...(await this.#criterionViolations(frame, outcome)),
      ...this.#evidenceViolations(frame),
      ...this.#structureViolations(frame),
    ];
    return {
      verdict: {
        treeClean,
        targetAction: !violations.some((violation) => violation.grade === "hard"),
      },
      violations,
    };
  }

  /** The verb's completion-criterion verdict as graded entries — the criterion's own
   *  hard violation plus its SOFT observations (design spec §3.2/§3.3). */
  async #criterionViolations(
    frame: OpenFrame,
    outcome: DraftedOutcome,
  ): Promise<readonly RoundViolation[]> {
    const scene = this.#scene;
    const judged = await CompletionCriteria.of(this.#opOf(frame)).judge({
      record: this.#judgedRecordOf(frame, outcome),
      row: this.#rowOf(frame),
      records: scene.ledger.recordsOf(frame.key, frame.type),
      carrier: outcome.carrier ?? null,
      reviewsPath: this.#reviewsPath(frame),
      git: this.#git,
      repoRoot: scene.workspace.root.repoRoot,
    });
    return [
      ...(judged.violation === null ? [] : [judged.violation]),
      ...(judged.observations ?? []),
    ];
  }

  /** The round IDENTITY the criterion judges from — its op / cycle / attempt, the
   *  group baseline and the carrier path the round writes. Deliberately verdict-free:
   *  this judgment PRODUCES the verdict, so a verdict cell here would be a
   *  self-fulfilling input. The group's already-recorded verdicts arrive through
   *  `CompletionContext.records`, never through this cell. */
  #judgedRecordOf(frame: OpenFrame, outcome: DraftedOutcome): RoundIdentity {
    const op = this.#opOf(frame);
    return {
      op,
      cycle: frame.round,
      attempt: frame.attempt ?? 1,
      dispatchBase: outcome.dispatchBase ?? null,
      carrierPath:
        outcome.carrier === undefined
          ? null
          : this.#scene.ledger.handoffPath(op, frame.type, frame.params),
    };
  }

  /** The progress row the round belongs to (the criterion's context cell) — the key's
   *  row when it exists, else the fresh entry form of that key. */
  #rowOf(frame: OpenFrame): ProgressRow {
    const ledger = this.#scene.ledger;
    const data = ledger.readProgress();
    return (
      (data === null ? undefined : Ledger.rowFor(data, frame.key, frame.type)) ??
      ledger.entryFor(frame.key)
    );
  }

  /** The evidence gate as a graded entry (design spec §3.3) — the work plane's wave /
   *  branch rounds write the canonical `{family-prefix}-{key}-test-evidence.json`; a
   *  missing / malformed / schema-violating file is HARD. The tri-state read reports
   *  each cause truly (D27): a corrupt file is never misreported as absent. */
  #evidenceViolations(frame: OpenFrame): readonly RoundViolation[] {
    if (HandoffSchema.planeOf(this.#opOf(frame)) !== "work") return [];
    if (TargetFaceTable.isDocShape(frame.type)) return [];
    const scene = this.#scene;
    const evidencePath = scene.workspace.resolve(this.#naming.evidenceName(frame));
    const read = scene.workspace.readJson<unknown>(this.#naming.evidenceName(frame));
    if (read.kind === "malformed") {
      return [this.#hard(`the test evidence at ${evidencePath} is malformed JSON`)];
    }
    if (read.kind === "missing") {
      return [this.#hard(`the test evidence at ${evidencePath} was not written`)];
    }
    const problems = this.#handoffSchema.evidenceViolations(read.value);
    if (problems.length === 0) return [];
    return [
      this.#hard(
        `the test evidence at ${evidencePath} violates the contract: ${problems.join("; ")}`,
      ),
    ];
  }

  /** The round's OWN plan-structure edit as a graded entry (design spec §7.3) — the
   *  close-time comparison against the dispatch-time snapshot: a changed Task-id set
   *  or a changed `DependsOn` set is a HARD entry under the existing
   *  `contract-violation` cause (zero new violation enum), because the structure face
   *  belongs to the orchestrator and lands as its own commit. A content-only amendment
   *  differs on neither face and judges nothing.
   *
   *  The two sides are judged apart. An ABSENT baseline (no plan fact, or a document
   *  already unreadable at dispatch) judges nothing — there is nothing to compare
   *  against. A PRESENT baseline with a missing / unreadable current side is the
   *  round's own damage: the document the dispatch read is gone or damaged inside this
   *  round, which is the structure face's most extreme edit and is judged hard rather
   *  than skipped. */
  #structureViolations(frame: OpenFrame): readonly RoundViolation[] {
    const baseline = frame.structure ?? null;
    if (baseline === null) return [];
    const current = PlanStructure.of(this.#scene.planPath);
    if (current.kind === "ok") {
      if (!current.structure.differsFrom(baseline)) return [];
      return [this.#hard(STRUCTURE_CHANGED)];
    }
    return [
      this.#hard(
        current.kind === "absent"
          ? "the plan document disappeared inside this round — the structure face belongs to the orchestrator and lands as its own commit"
          : `the plan document became unreadable inside this round (${current.reason}) — the structure face belongs to the orchestrator and lands as its own commit`,
      ),
    ];
  }

  /** One self-authored HARD entry — the ledger's existing `contract-violation` cause,
   *  zero new violation enum (design spec §3.3). */
  #hard(message: string): RoundViolation {
    return RoundViolation.hard(message);
  }

  /** The hard entries' one-line reason (the `CDD_BLOCKED` line's message). */
  #hardReason(violations: readonly RoundViolation[]): string {
    return violations
      .filter((violation) => violation.grade === "hard")
      .map((violation) => violation.message)
      .join("; ");
  }

  /** Warn once per round about its SOFT entries (design spec §3.3 — soft is
   *  bookkeeping only, so it never touches the verdict, the exit code or the gate). */
  #warnSoft(violations: readonly RoundViolation[]): void {
    const soft = violations
      .filter((violation) => violation.grade === "soft")
      .map((violation) => violation.message);
    if (soft.length === 0) return;
    this.#io.stderr(
      `${this.#words.station("warn")} ${this.#words.softViolation(soft.join("; "))}\n`,
    );
  }

  /** One dispatch's round work — prompt from the template plane + the frame, host
   *  child via the harness-contract rows, the child's write-back read in (the draft
   *  at OUTPUT_HANDOFF is the round's content; the child's Return is prose, never
   *  parsed). */
  async #runDispatch(frame: OpenFrame): Promise<DraftedOutcome> {
    // The baseline belongs to THIS dispatch alone: cleared at entry, so an early
    // return (no host harness) records "no baseline" rather than a previous round's.
    this.#dispatchBase = null;
    this.#roundLogPath = null;
    const host = this.detectHost();
    if (host === "") {
      this.#io.stderr(
        "CDD_BLOCKED: no host harness detected (run cdd from within a supported harness)\n",
      );
      return { status: "BLOCKED" };
    }
    const prompt = this.#template.render(this.#valuesOf(frame));
    const row = HOSTS[host as HostId];
    const cliName = row.cli;
    const args = [...row.invoke.split(" ").filter((part) => part.length > 0)];
    const ref = this.#skillRef(host, frame);
    // The dispatch's ONE write point: publish the intent BEFORE the child exists, so
    // any later crash / kill / timeout leaves a record naming who was running. The
    // gates read `InFlight.inspect()` only — this call is the real dispatch's alone.
    // A sibling dispatch that won the lock in between makes `acquire` throw
    // `HoldingError` (carrying the holder's facts), which rides the CLI's held BLOCK.
    this.#dispatchBase = await this.#git.head(this.#scene.workspace.root.repoRoot);
    await this.#inflight.acquire(await this.#recordOf(frame), { stealStale: this.#stealStale });
    // The round's own log file — created BEFORE the spawn (append stream open, zero
    // bytes), so the channel exists from the dispatch's first millisecond. A create
    // failure is a named soft observation and the round continues on the CPU leg
    // alone (the log leg is null, never a kill authorization).
    const roundLog = await this.#openRoundLog(frame);
    // The postmortem pointer of THIS round — the log the child's bytes land in (absent
    // when the channel could not be opened: the record then carries the honest null).
    this.#roundLogPath = roundLog === null ? null : this.#rel(roundLog.path);
    // The child receives ONE prompt argument — per the host's promptForm data column
    // (§3.5): the ref-prefixed form embeds the slash ref at the start of the single
    // prompt positional (claude -p consumes the whole first positional as the prompt;
    // a standalone ref arg after the flags would be swallowed, losing everything after
    // the ref) — the prompt assembly is data, never a code assumption.
    let result: ChildOutcome;
    try {
      result = await this.#sync.run({
        command: cliName,
        args: [...args, this.#childPrompt(row.promptForm, ref, prompt)],
        // The child's spawn directory is the repo root; the in-flight record handle
        // carries the sampler's own write path (the record is the ONE trail, and its
        // path is the tree leg's exclusion). The same `cwd` is also the tree-leg scan
        // root, so the scan root ≡ child cwd correspondence is structural.
        cwd: this.#scene.workspace.root.repoRoot,
        inflight: this.#inflight,
        policy: TerminationPolicy.of(frame.phase),
        // The host row's own child env — the TTL pin the terminator layers over the
        // inherited env at spawn (the host difference is data, never a dispatcher branch).
        env: row.env,
        log: roundLog ?? undefined,
      });
    } finally {
      // Drain → close BEFORE any read-back judgment: the append stream's tail bytes can
      // land after the exit event, so the postmortem face is only complete after close.
      if (roundLog !== null) await roundLog.close();
    }
    // The postmortem pair's second leg: what the (possibly crashed) child added on top
    // of the dispatch baseline. Computed ONCE here, so every reject path below writes
    // the same facts without a second git read.
    this.#commitsSince = await this.#git.commitsSince(
      this.#scene.workspace.root.repoRoot,
      this.#dispatchBase,
    );
    // The child's stdout rides the diagnostic channel — #reject reads it into the
    // crash record on either failure face. Child Return is prose: the engine never
    // parses it; the round's content is the OUTPUT_HANDOFF draft, read in #reconstruct.
    this.#stdoutTail = this.#tailOf(result.stdout);
    // The termination leg FIRST (§4.3 — the judging order is a hard rule): a killed
    // child's exit code is null, so `null !== 0` is true — judging the child-exit leg
    // first would fold every terminated round into `child-exit` and falsify the crash
    // cause. `termination !== null` → the round concludes TIMEOUT (the words table's
    // status is already there), the reason rides the CDD_BLOCKED channel, and the
    // failure face (no `next:` line) follows from the status alone.
    //
    // The ONE promotion exception (D53 Q12's deliberate narrowing): a terminated
    // REVIEW round whose draft already sits on disk — valid against the findings
    // schema and carrying at least one finding — has done its work; its conclusion is
    // derived from the handoff, never from the termination word (termination ⊥
    // conclusion). Every other terminated round keeps the TIMEOUT failure face.
    if (result.termination !== null) {
      const draft = this.#probeDraft(frame);
      if (draft !== null) {
        return this.#promote(frame, draft, result.termination, result);
      }
      return this.#reject(
        frame,
        this.#scene.ledger.handoffPath(this.#opOf(frame), frame.type, frame.params),
        `child ${cliName} was terminated: ${result.termination.cause}`,
        // the terminated round's OWN death facts — the termination rides whole
        // (cause + last sample), the signalled child's code is null verbatim
        { exitCode: result.code, cause: result.termination.cause, termination: result.termination },
      );
    }
    if (result.code !== 0) {
      return this.#reject(
        frame,
        this.#scene.ledger.handoffPath(this.#opOf(frame), frame.type, frame.params),
        `child ${cliName} exited ${result.code}`,
        // the dead child's OWN death facts — never the read-back face's defaults;
        // this branch sits AFTER the termination leg, so the termination is null
        { exitCode: result.code, cause: "child-exit", termination: null },
      );
    }
    // The normal end: the child finished on its own and its handoff was read back —
    // the ONE release point. The read-back's own refusals (a malformed / schema-
    // violating draft) still release: the CHILD did not die, the round's artifacts were
    // judged. The record survives only the round-ending paths above (a non-zero child
    // exit, a kill, a timeout) and an uncaught throw — i.e. the process-death paths the
    // record exists for.
    const outcome = this.#reconstruct(frame);
    await this.#inflight.release();
    return outcome;
  }

  /** The in-flight record of one frame — the identity facts written before the spawn.
   *  `pid` is the dispatching engine process, the command is the same-command resume
   *  form, and the brief hash is computed NOW from the rendered brief (the ledger's ONE
   *  hash face — never a new hash surface).
   *  `startedAt` is the recorded pid's OWN start instant (`ProcessFacts.startOf`), the
   *  instant `ProcessFacts.live` compares against: the dispatch instant drifts away
   *  from it, and on a session older than the tolerance that drift would judge a live
   *  holder dead — the one direction the guard must never take. The dispatch instant
   *  is only the fallback when the process table cannot answer, and an unreadable
   *  start time then folds to "alive" on the read side (never to a takeover). */
  async #recordOf(frame: OpenFrame): Promise<InFlightRecord> {
    const scene = this.#scene;
    return {
      pid: process.pid,
      command: this.#resumeOf(frame),
      slug: scene.workspace.slug,
      startedAt: (await this.#proc.startOf(process.pid)) ?? Date.now(),
      wave: frame.type === "wave" ? (frame.params.tasks ?? null) : null,
      phase: frame.phase,
      cycle: frame.round,
      attempt: frame.attempt ?? 1,
      briefHash: this.#briefHashOf(frame),
      plan: scene.planPath === null ? null : this.#rel(scene.planPath),
      sampledAt: null,
      verdict: null,
    };
  }

  /** Open one round's log file — the per-round channel the child's stdout/stderr
   *  land in, under the workspace's `logs/` directory (which no other writer creates).
   *  A create failure is a named soft observation and the round continues on the CPU
   *  leg alone (the log leg stays null); a fault AFTER the channel is live marks the
   *  log leg dead and is reported through the same channel — never a second notice. */
  async #openRoundLog(frame: OpenFrame): Promise<RoundLog | null> {
    const name = this.#naming.logName(
      this.#opOf(frame),
      frame.type,
      frame.params,
      frame.attempt ?? 1,
    );
    const target = this.#scene.workspace.resolve(`${CliLifecycle.LOGS_DIR}/${name}`);
    try {
      return await RoundLog.create(target, () =>
        this.#io.stderr(
          `${this.#words.station("warn")} round log write failed at ${this.#rel(target)}\n`,
        ),
      );
    } catch {
      this.#io.stderr(
        `${this.#words.station("warn")} round log unavailable at ${this.#rel(target)}\n`,
      );
      return null;
    }
  }

  /** The wave frame's brief hash at acquire time — `ReviewRefs.briefRevision` over the
   *  brief file this dispatch rendered (the SAME hash face the ledger binds as the
   *  reviewed revision). Computed independently of the ledger's records, so a wave's
   *  FIRST dispatch (no `brief-revision` row yet) still carries the hash. Null off the
   *  wave face and when the brief is not on disk yet. */
  #briefHashOf(frame: OpenFrame): string | null {
    const scene = this.#scene;
    if (frame.type !== "wave" || scene.planPath === null || scene.briefPath === null) return null;
    try {
      const brief = readFileSync(scene.briefPath, "utf8");
      return scene.ledger.refs().briefRevision(this.#rel(scene.planPath), brief).brief_hash;
    } catch {
      return null;
    }
  }

  /** The work-mode of a frame phase — branch-review rides the review family. The
   *  mapping itself lives in `RoundNaming` (the artifact stems key on it); this is
   *  the lifecycle's read of that single source. */
  #opOf(frame: OpenFrame): OpType {
    return this.#naming.op(frame);
  }

  /** The dispatch-table work-mode (ROLE) of a frame — the doc shapes' fix faces ride
   *  the docs-fix mode; everything else maps by its phase (§3.5's four-mode table). */
  #roleOf(frame: OpenFrame): WorkMode {
    if (frame.phase === "fix") {
      return TargetFaceTable.isDocShape(frame.type) ? "docs-fix" : "fix";
    }
    return frame.phase === "implement" ? "implement" : "review";
  }

  /** The phase's skill-ref slash form for the detected host ("/mattpocock-skills:implement"
   *  · "/mattpocock-skills:code-review" etc.); null when the phase carries no skill
   *  ref (the fix face and the spec/plan reviews — their criteria ride the
   *  prompt's fixed body, never a slash arg). */
  #skillRef(host: string, frame: OpenFrame): string | null {
    const dispatch = DISPATCH;
    let ref: unknown = null;
    if (frame.phase === "review" || frame.phase === "branch-review") {
      // The task/branch rows are object-shaped {ref}; the spec/plan review types
      // carry NO dispatch row (their criteria are the review prompt's fixed body).
      const entry = dispatch.review[frame.type as "wave" | "branch"];
      const declaredRef = (entry as { ref?: unknown } | undefined)?.ref;
      ref =
        typeof declaredRef === "string" && declaredRef.startsWith("mattpocock-skills:")
          ? declaredRef
          : null;
    } else {
      // The implement row is the dispatch table's single string slot; the other
      // phases (fix) carry no dispatch row — the lookup resolves null (the fix
      // face's ref-less face, same-shape as the spec/plan reviews).
      const value = dispatch[frame.phase as "implement"];
      ref = typeof value === "string" ? value : null;
    }
    if (typeof ref !== "string") return null;
    const hostForm = (REFS as HostReferenceTable)[ref]?.[host as HostId];
    return hostForm ?? null;
  }

  /** The child's single prompt argument — per the host's promptForm data contract
   *  (§3.5): the ref-prefixed form embeds the skill-ref slash form at the start of
   *  the assembled dispatch prompt as one positional (`/kairos:cdd-* <prompt>`); the
   *  plain form passes the prompt verbatim. */
  #childPrompt(form: "ref-prefixed" | "plain", ref: string | null, prompt: string): string {
    return form === "ref-prefixed" && ref !== null ? `${ref} ${prompt}` : prompt;
  }

  /** The round-context zone values of the dispatch prompt (the naming contract:
   *  ROLE nominative · WAVE (unit) · INPUT_* read-side · OUTPUT_* write-side · WORKSPACE_*
   *  environment · BASE_BRANCH scope anchor). Every declared token supplied — a mode's
   *  non-consumed slots stay empty and are NOT emitted by the assembler
   *  (empty-valued keys are dropped), so each mode's round context carries only the
   *  facts the mode reads. The review criteria/lens are NOT values — they fold into
   *  the review type's fixed prefix (§3.7). */
  #valuesOf(frame: OpenFrame): TemplateValues {
    const scene = this.#scene;
    const op = this.#opOf(frame);
    const role = this.#roleOf(frame);
    const params = frame.params;
    const isReview = frame.phase === "review" || frame.phase === "branch-review";
    const docPath =
      frame.target.kind === "plan" || frame.target.kind === "spec" ? frame.target.doc : null;
    const isWave = frame.type === "wave";
    return {
      ROLE: role,
      // v1.22 (wave-unitary): the wave face's scope IS the wave (the whole task list)
      // — the round context speaks the UNIT, `WAVE`; the line faces carry their own
      // read-side identity (INPUT_PLAN / INPUT_SPEC — the doc/branch line's kind-named
      // tokens under the wave-unitary model).
      WAVE: isWave ? (params.tasks ?? "") : "",
      // The wave-brief read input — the ONE engine-rendered brief of the current
      // dispatch (the unconditional re-extract at every dispatch makes it the pure
      // read face of the wave line — §4.2); the non-wave faces carry no brief path
      // (the slot stays empty, never emitted).
      INPUT_WAVE_BRIEF: isWave ? this.#rel(scene.briefPath ?? "") : "",
      // v1.9: INPUT_REVIEWS is fix/docs-fix only — the source review's handoff
      // carrier; a review writes its own draft (INPUT_REVIEWS === OUTPUT_HANDOFF
      // would be a short-circuit).
      INPUT_REVIEWS: op === "fix" ? this.#rel(this.#reviewsPath(frame)) : "",
      // The kind-named judged-doc anchors (the semantic retirement of the generic
      // INPUT_DOC): the plan/branch lines carry the plan document (INPUT_PLAN — the
      // doc path on a plan line, the plan path on a branch line, whose review/fix
      // judges the plan document) AND its design-spec reference (INPUT_SPEC — the
      // `spec:` front-matter link target, so the plan/branch reviewer judges plan→
      // spec conformance); the spec line carries its spec document (INPUT_SPEC; the
      // judged doc IS the spec, no plan anchor). Empty off the off-faces (the slots
      // are dropped by the assembler).
      INPUT_PLAN:
        frame.type === "plan"
          ? this.#rel(docPath ?? "")
          : frame.type === "branch"
            ? this.#rel(scene.planPath ?? "")
            : "",
      INPUT_SPEC:
        frame.type === "plan" || frame.type === "branch"
          ? this.#rel(scene.specLink ?? "")
          : frame.type === "wave"
            ? ""
            : // the doc shapes (phase-spec · overall · single-spec) carry the judged
              // document — the charter line's own charter is its spec anchor.
              this.#rel(docPath ?? ""),
      // The parent charter of the spec the face reads (INPUT_OVERALL) — the same
      // value condition as INPUT_SPEC, one face (the phase-spec line = its own
      // `program:`; plan/branch = the same-slug identity doc's `program:`; the
      // overall line itself = the judged charter); empty off those faces and when
      // the named program is absent (the assembler drops the empty slot).
      INPUT_OVERALL:
        frame.type === "overall"
          ? this.#rel(docPath ?? "")
          : frame.type === "phase-spec" || frame.type === "plan" || frame.type === "branch"
            ? this.#rel(scene.overallLink ?? "")
            : "",
      // The branch/wave tree-review scope anchor (BASE_BRANCH) — engine-injected
      // from the base artifact at dispatch; empty off those faces (spec/plan reviews
      // carry none, and the empty slot is dropped by the assembler).
      BASE_BRANCH:
        isReview && (frame.type === "branch" || frame.type === "wave")
          ? (scene.baseBranch ?? "")
          : "",
      // find #5 (P4.1 T7) — the prescribed artifact write paths (the {family}-{key}-
      // {artifact} single naming): the round context carries the canonical OUTPUT_*
      // names the child MUST use (zero free naming · cross-round zero overwrite); a
      // slot the frame's family does not consume stays empty and is dropped (only
      // present facts land). The brief is a pure read input (INPUT_WAVE_BRIEF) with
      // no write slot.
      OUTPUT_REPORT: this.#rel(this.#naming.report(frame)),
      OUTPUT_EVIDENCE: this.#rel(this.#naming.evidence(frame)),
      OUTPUT_HANDOFF: this.#rel(scene.ledger.handoffPath(op, frame.type, params)),
      REVIEW_TYPE: isReview ? frame.type : "",
      WORKSPACE_DIR: this.#rel(scene.workspace.path),
      WORKSPACE_ID: scene.workspace.slug,
      // v1.9 — the injected writable-subset schema (projection ①): the `## Handoff
      // schema` section of the mode's fixed prefix (byte-stable per mode; the work
      // faces — implement/fix — carry the evidence-file fence too).
      HANDOFF_SCHEMA: this.#schemaText(frame),
    };
  }

  /** The round-context path normalizer (D46) — EVERY path token injected into the
   *  child prompt speaks ONE basis (repoRoot-relative): the child is spawned at
   *  cwd = repoRoot, so a relative token resolves from the same root for every
   *  token, input or output alike. The producers (`RoundNaming`/`handoffPath`/
   *  `workspace.path`) yield absolute; `INPUT_SPEC` is resolved absolute at the CLI
   *  seam; the post-T3 argv tokens (`INPUT_PLAN`/`INPUT_SPEC`/`INPUT_REVIEWS`) are repoRoot-relative
   *  `RepoPath`s. So the exit takes an absolute-or-repoRoot-relative value and emits
   *  repoRoot-relative through the ONE value object (`RepoRoot.relativize` reads an
   *  absolute value as itself and a relative value as repoRoot-relative, collapsing
   *  both to one basis — the single conversion point). */
  #rel(value: string): string {
    if (value === "") return "";
    return this.#repoRootValue().relativize(value);
  }

  /** The repo-basis value object of this scene — the ONE conversion entry every
   *  round-context token normalizes through. The basis is the scene workspace
   *  root's OWN value object (built once at the root's boundary) — never re-wrapped
   *  here (branch-review-1 F2: one basis, one form). */
  #repoRootValue(): RepoRoot {
    return this.#scene.workspace.root.basis;
  }

  /** The child-stdout diagnostic tail (P11 T2) — the last STDOUT_TAIL_MAX non-empty
   *  stdout lines, kept verbatim for the crash record. The child's Return is prose;
   *  the engine never parses it — this is the failure-diagnosis channel only. */
  #tailOf(stdout: string): readonly string[] {
    const lines = stdout.split("\n").filter((line) => line.trim() !== "");
    return lines.slice(-STDOUT_TAIL_MAX);
  }

  // -------------------------------------------------------------------------
  // the read-back reconstruct (§3.6) — the draft is the round's content
  // -------------------------------------------------------------------------

  /** The ONE draft-read point — the frame's handoff draft read with the lenient
   *  child-authored dialect (D39). The reconstruct reports its tri-state outcome;
   *  the terminated-round probe only asks "is there a promotable draft?". */
  #readDraft(frame: OpenFrame): JsonRead<Record<string, unknown>> {
    const op = this.#opOf(frame);
    return this.#scene.workspace.readJsonLenient<Record<string, unknown>>(
      this.#scene.ledger.handoffName(op, frame.type, frame.params),
    );
  }

  /** The non-rejecting draft probe of the termination branch — a terminated REVIEW
   *  round's draft is promotable iff it exists, parses, passes the judge plane's schema,
   *  and carries at least one finding. Returns the validated draft (the promotion
   *  then rides the reconstruct's existing validation/persistence/conclusion path) or
   *  null (the round keeps the TIMEOUT failure face). It calls no `#reject` and
   *  produces no outcome — a probe is a question, never a verdict. Implement/fix
   *  rounds are outside the promotion domain (their `op` is not the review family). */
  #probeDraft(frame: OpenFrame): Record<string, unknown> | null {
    const op = this.#opOf(frame);
    if (op !== "review") return null;
    const plane = HandoffSchema.planeOf(op);
    const read = this.#readDraft(frame);
    if (read.kind !== "ok") return null;
    const draft = read.value;
    if (this.#handoffSchema.violations(plane, draft).length > 0) return null;
    const findings = Array.isArray(draft.findings) ? draft.findings : [];
    return findings.length >= 1 ? draft : null;
  }

  /** Promote a terminated review round whose draft is valid and carries findings —
   *  the terminal ⊥ conclusion exception (D53 Q12): the conclusion derives from the
   *  handoff, never from the termination word. The crash record still lands
   *  (`promoted: true`, carrying the termination's `idleMs`/last sample), and the
   *  lifecycle emits the ONE `CDD_WARN` line — the CLI layer emits none. The outcome
   *  is the ordinary read-back outcome (carrier + findings + derived status) plus the
   *  termination fact, so the bookkeep records the round and the route derives
   *  normally. */
  #promote(
    frame: OpenFrame,
    draft: Record<string, unknown>,
    termination: Termination,
    dead: ChildOutcome,
  ): DraftedOutcome {
    const op = this.#opOf(frame);
    const path = this.#scene.ledger.handoffPath(op, frame.type, frame.params);
    const outcome = this.#reconstruct(frame, draft);
    this.#writeCrash(
      frame,
      path,
      `child was terminated: ${termination.cause}`,
      { exitCode: dead.code, cause: termination.cause, termination },
      true,
    );
    const findings = outcome.findings ?? [];
    const text = this.#words.promotionWarning({
      cause: termination.cause,
      idleMs: termination.idleMs,
      verdict: termination.lastSample?.verdict ?? "none",
      count: findings.length,
    });
    this.#io.stderr(`${this.#words.station("warn")} ${text} — ${this.#words.lateLandingHint()}\n`);
    return { ...outcome, termination };
  }

  /** The read-back reconstruct — the child's draft at OUTPUT_HANDOFF is the round's
   *  content source of truth: read it, validate it against the mode's writable
   *  subset (projection ② of session/handoff-schema.ts — the SAME declared objects
   *  the prompt injected), then build the final carrier the lifecycle persists in
   *  place (agent draft → finalized, full-replace at the same path — the engine
   *  remains the carrier's single author). A malformed or schema-violating draft is a
   *  contract violation at the read-back face (the draft untouched — the child's work
   *  is never clobbered; resume re-runs the same command, which re-offers the round).
   *  A MISSING draft is not a rejection: the completion criterion owns it (§3.3) — an
   *  implement round continues on its commits with a soft observation, a review/fix
   *  round fails on its carrier criterion — so no carrier is materialized and the
   *  verdict is written against the null status.
   *
   *  `prefetched` is the terminated-review promotion's already-probed draft — the ONE
   *  draft parse stays single-sourced (`#readDraft`), and the promotion rides this
   *  same validation/persistence/conclusion path rather than a second implementation. */
  #reconstruct(frame: OpenFrame, prefetched?: Record<string, unknown>): DraftedOutcome {
    const scene = this.#scene;
    const op = this.#opOf(frame);
    const plane = HandoffSchema.planeOf(op);
    const schema = this.#handoffSchema;
    const path = scene.ledger.handoffPath(op, frame.type, frame.params);
    let draft: Record<string, unknown>;
    if (prefetched !== undefined) {
      draft = prefetched;
    } else {
      // The tri-state draft read — a MISSING draft ("never written") and a MALFORMED
      // one (present but unparseable JSON) are different facts: the rejection reports
      // each truly, so a corrupt draft is never misreported as "not written" (D27).
      // The read is LENIENT (D39): the draft is a child-LLM-authored carrier, and a
      // trailing comma (a routine model slip) must not void the whole round —
      // jsonc-parser tolerates the lenient dialect while a real break (a missing
      // brace, …) still reports malformed.
      const draftRead = this.#readDraft(frame);
      if (draftRead.kind === "missing") return { status: null };
      if (draftRead.kind === "malformed") {
        // The lenient face carries the parser's precise error codes (D39) — surface
        // them in the rejection so a genuinely corrupt draft is diagnosable, not just
        // "malformed".
        const codes = (draftRead.errors ?? [])
          .map((error) => printParseErrorCode(error.error))
          .join(", ");
        const detail = codes === "" ? "" : ` (${codes})`;
        return this.#reject(frame, path, `the handoff draft at ${path} is malformed JSON${detail}`);
      }
      draft = draftRead.value;
    }
    const problems = schema.violations(plane, draft);
    if (problems.length > 0) {
      return this.#reject(
        frame,
        path,
        `the handoff draft at ${path} violates the ${plane} schema: ${problems.join("; ")}`,
      );
    }
    // T2 — the plane-aware read: the judge plane ALONE reads `draft.findings` (its
    // own declared required field — rolled up to the conclusion); the work plane
    // derives its status from the draft's declared status, never the findings slot
    // (the work writable subset declares no findings field — zero findings read).
    // The conclusion rides the ONE source (`HandoffSchema.conclusionOf`) the ledger
    // legs read too — the reconstruct never rules a work status by a second path.
    const findings = plane === "judge" ? (Array.isArray(draft.findings) ? draft.findings : []) : [];
    // A validated draft's conclusion is total: the judge plane rolls up its own
    // required findings, and the work plane's `status` passed the `required` gate above
    // — so the `?? "BLOCKED"` never fires here (a work draft without a status never
    // reaches this line; the absent→undefined case exists only for on-disk legacy
    // carriers the ledger reads back, never a schema-validated draft).
    const status: RoundStatus = schema.conclusionOf(plane, draft) ?? "BLOCKED";
    const carrier = this.#materialize(frame, plane, draft, status);
    return {
      status,
      findings: plane === "judge" ? schema.findingsOf(findings) : undefined,
      carrier,
      dispositionsSummary: this.#dispositionsSummary(frame, plane, carrier),
    };
  }

  /** The fix round's ONE summary line (design spec §3.4) — computed from the PERSISTED
   *  carrier's dispositions and the REQUESTING carrier's input set (the same pair the
   *  fix criterion judges), never stored: no record field, no carrier key, no capsule
   *  key, no second read face. Undefined off the fix face and when the input set
   *  cannot be located or read (the round fails on grounds the line cannot describe).
   *  The criterion supplies the counts; the `FIX_DISPOSITIONS_SUMMARY` template — the
   *  presentation plane's byte fact — renders the row here. */
  #dispositionsSummary(
    frame: OpenFrame,
    plane: CarrierPlane,
    carrier: Record<string, unknown>,
  ): string | undefined {
    if (plane !== "work" || this.#opOf(frame) !== "fix") return undefined;
    const requester = FixDispositions.requesterInputOf(
      this.#scene.ledger.recordsOf(frame.key, frame.type),
      frame.round,
      this.#reviewsPath(frame),
      this.#repoRootValue().absolute,
    );
    if (requester.kind !== "read") return undefined;
    const counts = new FixDispositions().summaryOf(carrier, requester.summaries);
    return FIX_DISPOSITIONS_SUMMARY.replace("{fixed}", String(counts.fixed)).replace(
      "{rejected}",
      String(counts.rejected),
    );
  }

  /** The requesting review carrier's path — the fix round's `--reviews` input, or the
   *  ledger's resolved review handoff path when the route carried none (the ONE
   *  resolution the round context's INPUT_REVIEWS and the disposition summary share).
   *  A migrated line resolves the carrier that EXISTS — the retired twin's name, never
   *  the never-minted canonical spelling. */
  #reviewsPath(frame: OpenFrame): string {
    return (
      this.#reviews ?? this.#scene.ledger.resolveHandoffPath("review", frame.type, frame.params)
    );
  }

  /** The read-back rejection face — CDD_BLOCKED reason + the crash record (the
   *  same-command resume's decision source: the attempted handoff + the resume
   *  command) + NO carrier (the bookkeep leaves the draft untouched). The crash
   *  record carries the caller's REAL death facts: a present-but-unqualified draft
   *  (malformed JSON / schema) is `contract-violation` (the default), a dead child
   *  passes its own exit code + `child-exit`, and a terminated round passes its whole
   *  `termination` fact (cause + last sample) — one record shape, three truthful
   *  callers (the record is the postmortem artifact; a misreported death sends a
   *  maintainer hunting the wrong fault). A MISSING draft is not this face: the
   *  completion criterion owns it, so no rejection — and no crash record — ever fires
   *  for an absent draft.
   *
   *  The returned status derives from the death facts alone (§4.3 — no status
   *  parameter): a termination rides it → `TIMEOUT`; otherwise → `BLOCKED` (the
   *  read-back and child-exit callers pass `termination: null`, today's behavior
   *  verbatim). */
  #reject(
    frame: OpenFrame,
    path: string,
    reason: string,
    death: {
      exitCode: number | null;
      cause: CrashCause;
      termination: Termination | null;
    } = {
      exitCode: 0,
      cause: "contract-violation",
      termination: null,
    },
  ): DraftedOutcome {
    const cause = this.#causeOf(death);
    this.#writeCrash(frame, path, reason, death, false);
    // A terminated round extends its ONE CDD_BLOCKED line with the idle time and the
    // last sample's verdict (the crash record carries the full sample).
    const detail =
      death.termination === null
        ? ""
        : this.#words.terminationDetail({
            idleMs: death.termination.idleMs,
            verdict: death.termination.lastSample?.verdict ?? "none",
          });
    // Every cut-short round (kill · timeout · crash) carries the late-landing hint: the
    // child may still write after the engine stopped watching, and the recovery starts
    // from the working tree, never from the assumption that nothing landed.
    this.#blocked(`${reason}${detail}`, true);
    // The rejected round's own HARD entry — the verdict is `targetAction: false` and the
    // failure is named, never a silent absence (§3.3). The cause rides the death facts'
    // existing vocabulary (no new enum row).
    const violations: readonly RoundViolation[] = [RoundViolation.hard(reason, cause)];
    if (death.termination === null) return { status: "BLOCKED", violations };
    return { status: "TIMEOUT", termination: death.termination, violations };
  }

  /** The crash cause of one death fact — the termination's own cause when present,
   *  else the caller's. One derivation, two readers (the crash record and the round's
   *  hard entry). */
  #causeOf(death: { cause: CrashCause; termination: Termination | null }): CrashCause {
    return death.termination?.cause ?? death.cause;
  }

  /** The ONE `CDD_BLOCKED` line (§3.3): the hard verdict and the rejected / cut-short
   *  rounds share it, and every line names the round's own log file (§4.1) — a
   *  diagnose-one-round job is one path away, never a `ps` read from outside. The
   *  late-landing hint is a CUT-SHORT fact alone (a hard round's child finished). */
  #blocked(reason: string, cutShort: boolean): void {
    const log = this.#roundLogPath === null ? "" : ` — log: ${this.#roundLogPath}`;
    const hint = cutShort ? ` — ${this.#words.lateLandingHint()}` : "";
    this.#io.stderr(`CDD_BLOCKED: ${reason}${log}${hint}\n`);
  }

  /** Write the lane's crash record — the postmortem artifact and same-command
   *  resume's decision source. One writer serves both the rejection face
   *  (`promoted: false`) and the termination branch's promotion (`promoted: true`):
   *  the record shape is identical, only the promotion fact differs. */
  #writeCrash(
    frame: OpenFrame,
    path: string,
    reason: string,
    death: {
      exitCode: number | null;
      cause: CrashCause;
      termination: Termination | null;
    },
    promoted: boolean,
  ): void {
    // The cause rides the termination fact when one is present (one of the three
    // causes or the `unknown` fallback); without it, the caller's own cause.
    const cause = this.#causeOf(death);
    this.#scene.ledger.writeCrash(this.#naming.crashName(frame), {
      exitCode: death.exitCode,
      stderrTail: [reason],
      stdoutTail: this.#stdoutTail,
      // The persisted attempted-handoff path is the CANONICAL repoRoot-relative
      // shape (never the absolute `handoffPath` syscall form — §2.7).
      attemptedHandoff: this.#rel(path),
      next: this.#resumeOf(frame),
      cause,
      // The postmortem's observation pair: the round's own log file (one file to open
      // instead of reading `ps` from outside) and its last sample, which rides WITH the
      // termination (in memory, zero re-read of the in-flight record) — null on every
      // non-terminated face.
      logPath: this.#roundLogPath,
      lastSample: death.termination?.lastSample ?? null,
      promoted,
      idleMs: death.termination?.idleMs ?? null,
      // The postmortem's git facts: the HEAD the dispatch started from and whatever
      // the (possibly crashed) child committed before it died.
      dispatchBase: this.#dispatchBase,
      commitsSince: this.#commitsSince,
    });
    // P22 — the crash record is the postmortem, never a counter write: the soft
    // counter derives from the round records (`Ledger#softViolations`), and a hard
    // crash reads as the round's failed verdict (design spec §3.3).
  }

  /** Build the final carrier — the validated writable fields from the draft (the
   *  engine-seated identity rides the canonical file name, never inline: phase/tasks
   *  are not declared and never written — v1.30), persisted by the bookkeep
   *  full-replace at the SAME path (agent draft → finalized). The ROUND VERDICT is a
   *  separate fact (`#verdictOf`): a hard round fails on its record + exit code, while
   *  the carrier keeps the child's own declared status (the engine never rewrites a
   *  declaration to encode a judgment). */
  #materialize(
    frame: OpenFrame,
    plane: CarrierPlane,
    draft: Record<string, unknown>,
    status: RoundStatus,
  ): Record<string, unknown> {
    const ledger = this.#scene.ledger;
    const notes: string[] = [];
    // The §8.7 classification ruling — the SAME judgment the read-back validator makes
    // (non-declared keys are dropped, never a BLOCK): materialize drops them and books
    // AT MOST ONE WARN on the carrier's notes (auditable, non-interrupting — replacing
    // the retired "BLOCK + crash-resume + reopen" chain). The engine stays the carrier's
    // single author; a child's stray key is surfaced, not obeyed.
    const dropped = this.#handoffSchema.droppedKeys(plane, draft);
    if (dropped.length > 0) {
      notes.push(
        `dropped non-declared draft field(s): ${dropped.join(", ")} — engine-reserved, never written`,
      );
    }
    // The per-plane carrier — buildHandoff's typed overloads: the judge plane REQUIRES
    // its findings payload (the schema-required field — cli.test pins the review
    // carrier's findings + status), the work plane builds a findings-FREE typed carrier
    // (the work writable subset declares no findings field — a docs-fix draft's residual
    // findings are dropped, never materialized). `Record<string, unknown>` local: the
    // round conclusion (status — a RoundStatus, wider than the carrier's declared union)
    // and the engine's extended fields ride the caller's set below.
    const carrier: Record<string, unknown> =
      plane === "judge"
        ? ledger.buildHandoff("judge", {
            artifacts: this.#canonicalArtifacts(frame, draft.artifacts, notes),
            findings: this.#findingsList(draft.findings),
          })
        : ledger.buildHandoff("work", {
            artifacts: this.#canonicalArtifacts(frame, draft.artifacts, notes),
          });
    // The work plane ALONE persists the round conclusion — it is the child's own
    // declared status (the schema enum pinned it to APPROVED | BLOCKED). The judge
    // plane holds NO status field: its conclusion is DERIVED at judgment time
    // (`HandoffSchema.conclusionOf("judge", carrier)` → rollup(findings)), so the
    // persisted judge carrier stays the pure declaration plane
    // (findings/artifacts/notes) and a fix child's INPUT_REVIEWS carrier is
    // status-free (the judgment plane is perpendicular to the input plane · D27).
    const draftNotes = Array.isArray(draft.notes) ? [...(draft.notes as unknown[])] : [];
    if (plane === "work") {
      carrier.status = status;
      // The fix dispositions ride the carrier VERBATIM (the child's declaration, never
      // an engine rewrite) — the schema pinned the slot's object shape.
      if (draft.dispositions !== undefined) carrier.dispositions = draft.dispositions;
    }
    if (notes.length > 0 || draftNotes.length > 0) carrier.notes = [...notes, ...draftNotes];
    return carrier;
  }

  /** The carrier's artifacts map (find #5 — the engine self-derives, never trusts a
   *  child-reported path for the canonical slots): a declared PRESCRIBED slot
   *  (report/test_evidence) books the frame's canonical OUTPUT_* path — a
   *  free-named deviation is replaced and surfaced on the notes (the review scope
   *  axis reads them); the non-prescribed slots (a docs-fix's `doc`, child extras)
   *  pass verbatim. undefined when the draft declared no artifacts. */
  #canonicalArtifacts(
    frame: OpenFrame,
    artifacts: unknown,
    notes: string[],
  ): Record<string, string> | undefined {
    const declared = this.#stringMap(artifacts);
    if (declared === undefined) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(declared)) {
      const canonical = this.#prescribedArtifact(frame, key);
      if (canonical === "") {
        // The non-prescribed slots (the pure read input `brief`, a docs-fix's `doc`,
        // child extras) pass verbatim.
        out[key] = value;
        continue;
      }
      // A prescribed slot ALWAYS books the engine's canonical path in the CANONICAL
      // shape (repoRoot-relative — never the absolute `workspace.resolve` form): the
      // persisted carrier's artifacts map carries zero absolute strings (§2.7). The
      // comparison runs on ONE basis (D46 — the child receives relative OUTPUT_*
      // tokens, so a compliant declaration matches); a free-named OR absolute
      // deviation is replaced and surfaced on the notes (the review scope axis reads
      // them).
      const relative = this.#rel(canonical);
      if (this.#rel(value) !== relative) {
        notes.push(
          `artifact ${key}: declared path ${value} deviates from the prescribed ${canonical} — the canonical path is booked`,
        );
      }
      out[key] = relative;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  /** The prescribed path of one block-artifact slot — a slot the frame's family
   *  prescribes (report/test_evidence → the canonical name from `RoundNaming`), ""
   *  for every other slot (the pure read input `brief` is never a write slot, and a
   *  docs-fix's `doc` is never prescribed — both pass verbatim). */
  #prescribedArtifact(frame: OpenFrame, slot: string): string {
    switch (slot) {
      case "report":
        return this.#naming.report(frame);
      case "test_evidence":
        return this.#naming.evidence(frame);
      default:
        return "";
    }
  }

  /** The `## Handoff schema` section value — the mode's writable-subset fence
   *  (projection ①; byte-fixed per mode so the prompt's fixed prefix stays
   *  cache-friendly). The op-derived plane selects the subset: work → carrier +
   *  evidence fence on the wave / branch rounds; judge → the review fence only. */
  #schemaText(frame: OpenFrame): string {
    const plane = HandoffSchema.planeOf(this.#opOf(frame));
    const evidence = plane === "work" && (frame.type === "wave" || frame.type === "branch");
    const prefix = evidence ? this.#naming.prefix(frame) : "tasks";
    return this.#handoffSchema.schemaText(plane, evidence, prefix);
  }

  /** The artifacts field as a string-map (only string values land — non-string rows
   *  are dropped, never coerced). */
  #stringMap(artifacts: unknown): Record<string, string> | undefined {
    if (typeof artifacts !== "object" || artifacts === null || Array.isArray(artifacts))
      return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(artifacts)) {
      if (typeof value === "string") out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  /** The draft findings as a plain list (the materialized carrier keeps them
   *  verbatim; the schema validated their shape before this ran). */
  #findingsList(findings: unknown): unknown[] {
    return Array.isArray(findings) ? findings : [];
  }

  /** The same-command resume string — the crash record's `next`, mirroring the
   *  CLI's dispatchable form of this frame (re-run the same command per the BLOCKED
   *  `next:` to continue — the idempotent full mode re-run). */
  #resumeOf(frame: OpenFrame): string {
    const scene = this.#scene;
    const plan = scene.planPath ?? "<plan>";
    switch (frame.phase) {
      case "implement":
        return `cdd implement --tasks ${frame.params.tasks ?? ""} --plan ${plan}`;
      case "branch-review":
        // The branch re-review literal carries only the workspace-identity `--plan`
        // — the review judges the live tree (the scope anchor BASE_BRANCH is
        // engine-injected at dispatch), so no range rides the command.
        return `cdd review --type branch --plan ${plan}`;
      case "review":
        if (frame.type === "wave")
          return `cdd review --type wave --tasks ${frame.params.tasks ?? ""} --plan ${plan}`;
        if (frame.type === "branch") return `cdd review --type branch --plan ${plan}`;
        if (frame.type === "plan") return `cdd review --type plan --plan ${this.#docOf(frame)}`;
        // phase-spec · overall · single-spec — the document under review rides
        // the retained `--spec` flag.
        return `cdd review --type ${frame.type} --spec ${this.#docOf(frame)}`;
      case "fix": {
        const findings = scene.ledger.resolveHandoffPath("review", frame.type, frame.params);
        const target =
          frame.target.kind === "plan"
            ? `--plan ${frame.target.doc}`
            : frame.target.kind === "spec"
              ? `--spec ${frame.target.doc}`
              : // The branch fix carries no refs — the source findings ride the
                // --reviews handoff; the workspace-identity `--plan` still rides
                // (the plan is the branch line's identity, zero orchestrator fallback).
                frame.target.kind === "branch"
                ? `--plan ${plan}`
                : `--tasks ${frame.params.tasks ?? ""} --plan ${plan}`;
        return `cdd fix --type ${frame.type} ${target} --reviews ${findings}`;
      }
    }
  }

  /** The doc path of a doc-target frame (the `""` never lands — the reject paths
   *  only frame docs). */
  #docOf(frame: OpenFrame): string {
    return frame.target.kind === "plan" || frame.target.kind === "spec" ? frame.target.doc : "";
  }
}
