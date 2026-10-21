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

import process from "node:process";
import { printParseErrorCode } from "jsonc-parser";
import type { ConfigLoader } from "../infra/config.ts";
import type { RepoRoot } from "../infra/root.ts";
import type { JsonRead, Workspace } from "../infra/workspace.ts";
import type { TemplateValues, WorkMode } from "../render/templates.ts";
import { TemplateAssembler } from "../render/templates.ts";
import type { CarrierPlane } from "../session/handoff-schema.ts";
import { HandoffSchema } from "../session/handoff-schema.ts";
import type { CrashCause, Ledger, OpType, RoundStatus, Termination } from "../session/ledger.ts";
import { RoundNaming } from "../session/round-naming.ts";
import type { DispatchOutcome, DispatchStep, OpenFrame } from "../session/run.ts";
import { DISPATCH, HOSTS, HostDetect, type HostId, type HostReferenceTable, REFS } from "./host.ts";
import {
  type ChildOutcome,
  type ChildRunner,
  TerminationPolicy,
  Terminator,
} from "./termination.ts";
import { Words } from "./words.ts";

/** The crash-record stdout-tail cap (P11 T2) — the child's last STDOUT_TAIL_MAX
 *  non-empty stdout lines ride the crash record's `stdoutTail` (the diagnostic
 *  channel; the child's Return is prose, never the round's content). */
const STDOUT_TAIL_MAX = 40;

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
  /** The current dispatch's child-stdout diagnostic tail (the crash-record channel,
   *  P11 T2) — set in #dispatch after the child returns, read by #reject. The child's
   *  Return is prose; the engine never parses it — this is the failure channel only. */
  #stdoutTail: readonly string[] = [];

  constructor(opts: {
    env?: ProcessEnvLike;
    sync?: ChildRunner;
    config?: ConfigLoader;
    template?: TemplateAssembler;
    io?: CliIo;
    scene: DispatchScene;
    reviews?: string | null;
    words?: Words;
  }) {
    this.#env = opts.env ?? process.env;
    this.#scene = opts.scene;
    this.#naming = new RoundNaming(opts.scene.workspace);
    this.#sync = opts.sync ?? new Terminator();
    this.#template = opts.template ?? new TemplateAssembler();
    this.#words = opts.words ?? new Words();
    this.#io = opts.io ?? {
      stdout: (t) => process.stdout.write(t),
      stderr: (t) => process.stderr.write(t),
    };
    this.#reviews = opts.reviews ?? null;
  }

  /** The host-harness id detected from the env — "claude" | "cursor" | "pi" | "" —
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

  /** One dispatch — prompt from the template plane + the frame, host child via
   *  the harness-contract rows, the child's write-back read in (the draft at
   *  OUTPUT_HANDOFF is the round's content; the child's Return is prose, never parsed). */
  async #dispatch(frame: OpenFrame): Promise<DispatchOutcome> {
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
    // The child receives ONE prompt argument — per the host's promptForm data column
    // (§3.5): the ref-prefixed form embeds the slash ref at the start of the single
    // prompt positional (claude -p consumes the whole first positional as the prompt;
    // a standalone ref arg after the flags would be swallowed, losing everything after
    // the ref) — the prompt assembly is data, never a code assumption.
    const result = await this.#sync.run({
      command: cliName,
      args: [...args, this.#childPrompt(row.promptForm, ref, prompt)],
      // The two paths the dispatch needs share ONE source (this workspace, held only
      // here): the child's spawn directory is the repo root, and the heartbeat lands
      // in this dispatch's workspace. The same `cwd` is also the tree-leg scan root,
      // and the heartbeat path is the sampler's own write — the scan root ≡ child cwd
      // correspondence is structural, never a convention.
      cwd: this.#scene.workspace.root.repoRoot,
      heartbeatPath: this.#scene.workspace.resolve("liveness.json"),
      policy: TerminationPolicy.of(frame.phase),
    });
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
    return this.#reconstruct(frame);
  }

  /** The work-mode of a frame phase — branch-review rides the review family. The
   *  mapping itself lives in `RoundNaming` (the artifact stems key on it); this is
   *  the lifecycle's read of that single source. */
  #opOf(frame: OpenFrame): OpType {
    return this.#naming.op(frame);
  }

  /** The dispatch-table work-mode (ROLE) of a frame — the spec/plan fix faces ride
   *  the docs-fix mode; everything else maps by its phase (§3.5's four-mode table). */
  #roleOf(frame: OpenFrame): WorkMode {
    if (frame.phase === "fix") {
      return frame.type === "spec" || frame.type === "plan" ? "docs-fix" : "fix";
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
      INPUT_REVIEWS:
        op === "fix"
          ? this.#rel(this.#reviews ?? scene.ledger.handoffPath("review", frame.type, params))
          : "",
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
        frame.type === "spec"
          ? this.#rel(docPath ?? "")
          : frame.type === "plan" || frame.type === "branch"
            ? this.#rel(scene.specLink ?? "")
            : "",
      // The parent charter of the spec the face reads (INPUT_OVERALL) — the same
      // value condition as INPUT_SPEC, one face (spec = its own `program:`; plan/
      // branch = the same-slug identity doc's `program:`); empty off those faces and
      // when the spec names no program (the assembler drops the empty slot).
      INPUT_OVERALL:
        frame.type === "spec" || frame.type === "plan" || frame.type === "branch"
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
  ): DispatchOutcome {
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
    this.#io.stderr(`${this.#words.station("warn")} ${text}\n`);
    return { ...outcome, termination };
  }

  /** The read-back reconstruct — the child's draft at OUTPUT_HANDOFF is the round's
   *  content source of truth: read it, validate it against the mode's writable
   *  subset (projection ② of session/handoff-schema.ts — the SAME declared objects
   *  the prompt injected), then build the final carrier the lifecycle persists in
   *  place (agent draft → finalized, full-replace at the same path — the engine
   *  remains the carrier's single author). A missing or schema-violating draft →
   *  BLOCK over the CDD_BLOCKED channel + a crash record + the draft untouched
   *  (on failure, no overwrite — the child's work is never clobbered; resume re-runs the same
   *  command, which re-offers the round). The test-evidence file (work-plane wave /
   *  branch rounds only) is read back with the same stakes: a missing/violating file
   *  rewrites the carrier to BLOCKED (persisted — the child's work is kept, marked
   *  bad), the second fix for a prose-only claim.
   *
   *  `prefetched` is the terminated-review promotion's already-probed draft — the ONE
   *  draft parse stays single-sourced (`#readDraft`), and the promotion rides this
   *  same validation/persistence/conclusion path rather than a second implementation. */
  #reconstruct(frame: OpenFrame, prefetched?: Record<string, unknown>): DispatchOutcome {
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
      if (draftRead.kind === "missing") {
        return this.#reject(frame, path, `the handoff draft was not written at ${path}`, {
          exitCode: 0,
          cause: "handoff-absent",
          termination: null,
        });
      }
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
    let status: RoundStatus = schema.conclusionOf(plane, draft) ?? "BLOCKED";
    let reason: string | null = null;
    // The evidence gate (v1.9) — the work plane's wave / branch rounds (implement/fix
    // task+branch) write the canonical `{family-prefix}-{key}-test-evidence.json` under
    // the workspace (§3.7 naming: tasks- for the task families, branch- for the branch
    // fix); the doc rounds (review/docs-fix) carry no evidence file. The read-back is
    // REAL — a missing/malformed/schema-violating file rewrites the draft to BLOCKED
    // (each cause reported truly — the tri-state read, D27).
    if (plane === "work" && (frame.type === "wave" || frame.type === "branch")) {
      const evidenceName = this.#naming.evidenceName(frame);
      const evidencePath = scene.workspace.resolve(evidenceName);
      const evidenceRead = scene.workspace.readJson<unknown>(evidenceName);
      // The SAME tri-state discrimination as the draft leg (D27): a PRESENT-but-corrupt
      // evidence file reports its true cause, never the misleading "missing" — only a
      // genuinely absent file (or a schema-violating present one) rides the schema
      // verdict below.
      if (evidenceRead.kind === "malformed") {
        status = "BLOCKED";
        reason = `the test evidence at ${evidencePath} is malformed JSON`;
      } else {
        const evidence = evidenceRead.kind === "ok" ? evidenceRead.value : null;
        const evidenceProblems = schema.evidenceViolations(evidence);
        if (evidenceProblems.length > 0) {
          status = "BLOCKED";
          reason = `the test evidence at ${evidencePath} violates the contract: ${evidenceProblems.join("; ")}`;
        }
      }
    }
    return {
      status,
      findings: plane === "judge" ? schema.findingsOf(findings) : undefined,
      carrier: this.#materialize(frame, plane, draft, status, reason),
    };
  }

  /** The read-back rejection face — CDD_BLOCKED reason + the crash record (the
   *  same-command resume's decision source: the attempted handoff + the resume
   *  command) + NO carrier (the bookkeep leaves the draft untouched). The crash
   *  record carries the caller's REAL death facts: an absent draft is the
   *  `handoff-absent` read-back face (exit 0), a present-but-unqualified draft
   *  (malformed JSON / schema) is `contract-violation` (the default), a dead
   *  child passes its own exit code + `child-exit`, and a terminated round passes
   *  its whole `termination` fact (cause + last sample) — one record shape, four
   *  truthful callers (the record is the postmortem artifact; a misreported death
   *  sends a maintainer hunting the wrong fault).
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
  ): DispatchOutcome {
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
    this.#io.stderr(`CDD_BLOCKED: ${reason}${detail}\n`);
    if (death.termination === null) return { status: "BLOCKED" };
    return { status: "TIMEOUT", termination: death.termination };
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
    const op = this.#opOf(frame);
    // The cause rides the termination fact when one is present (one of the three
    // causes or the `unknown` fallback); without it, the caller's own cause.
    const cause: CrashCause = death.termination?.cause ?? death.cause;
    this.#scene.ledger.writeCrash(`${op}.${frame.type}`, frame.round, {
      exitCode: death.exitCode,
      stderrTail: [reason],
      stdoutTail: this.#stdoutTail,
      // The persisted attempted-handoff path is the CANONICAL repoRoot-relative
      // shape (never the absolute `handoffPath` syscall form — §2.7).
      attemptedHandoff: this.#rel(path),
      next: this.#resumeOf(frame),
      cause,
      // The last sample rides WITH the termination (in memory, zero re-read of the
      // heartbeat file) — null on every non-terminated face.
      lastSample: death.termination?.lastSample ?? null,
      promoted,
      idleMs: death.termination?.idleMs ?? null,
    });
    // P14 — the sole contractViolationCount write seam: observe the FINAL crash
    // cause (termination override wins). Never keyed off status === "BLOCKED".
    if (cause === "handoff-absent" || cause === "contract-violation") {
      this.#scene.ledger.incrementContractViolationCount();
    }
  }

  /** Build the final carrier — the validated writable fields from the draft (the
   *  engine-seated identity rides the canonical file name, never inline: phase/tasks
   *  are not declared and never written — v1.30), persisted by the bookkeep
   *  full-replace at the SAME path (agent draft → finalized). The evidence override
   *  rewrites the status to BLOCKED + the reason note (the child's work preserved,
   *  marked bad). */
  #materialize(
    frame: OpenFrame,
    plane: CarrierPlane,
    draft: Record<string, unknown>,
    status: RoundStatus,
    reason: string | null,
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
      // The evidence-contract override (work-plane wave / branch rounds only — the
      // evidence gate reads that round's evidence file) rewrites the persisted
      // conclusion to BLOCKED.
      if (reason !== null) {
        carrier.status = "BLOCKED";
        draftNotes.push(reason);
      }
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
        if (frame.type === "spec") return `cdd review --type spec --spec ${this.#docOf(frame)}`;
        if (frame.type === "plan") return `cdd review --type plan --plan ${this.#docOf(frame)}`;
        return `cdd review --type wave --tasks ${frame.params.tasks ?? ""} --plan ${plan}`;
      case "fix": {
        const findings = scene.ledger.handoffPath("review", frame.type, frame.params);
        const target =
          frame.target.kind === "plan" || frame.target.kind === "spec"
            ? `--${frame.type === "spec" ? "spec" : "plan"} ${frame.target.doc}`
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
