// packages/cdd-engine/src-next/face/dispatch-values.ts
// P40 T4 — the PRE-FRAME value assembly (design spec §1.1 ② and §2.4). The pre-flight
// seam judges a dispatch BEFORE the dispatch exists: `vet` runs at the composition root
// while the dispatch frames come from `Lifecycle#peekNext()`, and `run` is built only after
// the verdict. Every value producer today is frame-bound (`CliLifecycle#valuesOf` /
// `#artifactCellOf`), so the values get their own home: ONE frame-free, workspace-free
// composer that takes declared FLAT facts and answers the flat record, and TWO consumers
// read that one answer — the seam's four rows and the renderer. Neither re-assembles.
//
// The three input cells are the spec's four kinds of fact, with the round identity
// holding two of them:
//   · `DispatchIdentity` — the folded op, the type, the rendered phase, the wave's task
//     group and the `(cycle, attempt)` this dispatch would consume (identity, never a
//     row's input);
//   · `DispatchSceneFacts` — the line's declared paths, the base branch, the workspace
//     directory and slug, the engine-written brief's path, the three `OUTPUT_*` paths
//     and the injected `## Handoff schema` text. The path basis rides in here
//     (`repoRoot`) so the relativization below is the ONE conversion point — the same
//     one `#valuesOf`'s `#rel` performs — and never a second conversion at a call site.
//   · `ArtifactSnapshot` — the contract plane's snapshot, whose `reviewsPath` is the fix
//     face's `--reviews` input and whose `read.path` (on `ok`) is `INPUT_RULINGS`'s only
//     source. The rulings sidecar's path is DERIVED from the carrier there, so it is not
//     stored a second time in the scene.
//
// `RequestingCarrier` is the seam's other half: the `--reviews` path's three-branch
// priority used to live in three private `CliLifecycle` methods. Two callers ask it (the
// composition root produces `INPUT_REVIEWS`, the lifecycle's completion criterion and
// family face read it), so the rule gets ONE home and the lifecycle's methods become
// delegations. The class holds no frame: the four identity cells arrive as flat facts.
//
// Module-level exports are types / the two classes — zero behavior-carrying bare
// functions.

import type { ArtifactSnapshot } from "../contract/preflight-rows.ts";
import type { RepoRoot } from "../infra/root.ts";
import { TargetFaceTable, type TargetType } from "../session/faces.ts";
import type { Ledger, OpType, RoundRecord } from "../session/ledger.ts";

/** The dispatch's identity — the one cell that is not a path, a hash or a sentence.
 *  `cycle` / `attempt` are the round this dispatch would consume: they name the
 *  `OUTPUT_*` / brief / handoff artifacts and nothing else (no row reads them). */
export interface DispatchIdentity {
  /** The round verb, already folded (`RoundRecords.opOf(expected)`: the branch line's
   *  `branch-review` → `review`). The composition root hands the value in; this module
   *  never maps it again — `attempt` is allocated on this same value. */
  readonly op: OpType;
  /** The target face (the dispatch's `--type` word). */
  readonly type: TargetType;
  /** The rendered phase word (`implement` · `fix` · `review` · `branch-review`). The
   *  render's `ROLE` / `TARGET_TYPE` / evidence legs read it, never a frame. */
  readonly phase: string;
  /** The wave face's task group ("" off the wave face — the `WAVE` cell is the only
   *  reader, and it is dropped from every other mode's row). */
  readonly tasks: string;
  /** The cycle the dispatch would consume (the `OUTPUT_*` / brief / handoff name
   *  coordinate). */
  readonly cycle: number;
  /** The attempt on that cycle — the second half of the same naming coordinate. */
  readonly attempt: number;
}

/** The line's declared scene facts — everything the record needs that is neither the
 *  dispatch's identity nor an artifact judgment. Paths arrive in the shape their
 *  producer holds (absolute from `RoundNaming` / `Workspace#path`, already
 *  repoRoot-relative from the argv funnel); the composer collapses them onto ONE shape. */
export interface DispatchSceneFacts {
  /** The path cells' ONE basis (`scene.workspace.root.basis`) — the relativization
   *  below delegates to it, so no call site converts twice. */
  readonly repoRoot: RepoRoot;
  /** The judged document of a plan / spec target (repoRoot-relative); null elsewhere. */
  readonly docPath: string | null;
  /** The line's plan path (the branch line's `INPUT_PLAN`); null when it carries none. */
  readonly planPath: string | null;
  /** The plan's `spec:` link target; null when the line declares none. */
  readonly specLink: string | null;
  /** The parent charter the spec's `program:` names; null when it names none. */
  readonly overallLink: string | null;
  /** The base artifact's branch name (the `BASE_BRANCH` anchor); null when absent. */
  readonly baseBranch: string | null;
  /** The engine-written brief's path — `RoundNaming#brief(tasks)`, the SAME name the
   *  dispatch's unconditional re-extract writes (the producer names it, this module
   *  never derives it). */
  readonly briefPath: string;
  /** The dispatch workspace's directory and slug (`WORKSPACE_DIR` · `WORKSPACE_ID`). */
  readonly workspaceDir: string;
  readonly workspaceId: string;
  /** The three prescribed write paths (`OUTPUT_REPORT` · `OUTPUT_EVIDENCE` ·
   *  `OUTPUT_HANDOFF`) — the naming face's output; `evidencePath` is "" off the evidence
   *  rounds. */
  readonly reportPath: string;
  readonly evidencePath: string;
  readonly handoffPath: string;
  /** The `## Handoff schema` section the prompt carries (the schema plane's projection
   *  for this dispatch's carrier plane). */
  readonly handoffSchema: string;
}

/** The requesting carrier's four flat identity facts — the frame-free source every
 *  branch of the priority reads. */
export interface RequestingCarrierFacts {
  readonly type: TargetType;
  /** The line's ledger key (`String(frame.key)` — a wave key string or the line word). */
  readonly key: string;
  /** The round the asking dispatch consumes (`frame.round`). */
  readonly cycle: number;
  /** The wave's task group (`frame.params.tasks`); the family-name branch reads it. */
  readonly tasks: string;
}

/**
 * DispatchValues — the ONE pre-frame assembly of a dispatch's round-context values.
 * Stateless: `compose` takes the three cells and answers the flat record, so a seam
 * judgment and a render of the same dispatch read one answer, never two derivations.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the composer's single entry — the zero-bare-function discipline admits no standalone functions.
export class DispatchValues {
  /** Compose the flat value record from the identity, the scene facts and the artifact
   *  snapshot. Every path cell is collapsed onto the ONE repoRoot-relative basis here
   *  (the single conversion point `#valuesOf`'s `#rel` provided). */
  static compose(
    identity: DispatchIdentity,
    scene: DispatchSceneFacts,
    artifact: ArtifactSnapshot,
  ): Readonly<Record<string, string>> {
    const isWave = identity.type === "wave";
    const isReview = identity.phase === "review" || identity.phase === "branch-review";
    const docPath = scene.docPath ?? "";
    return {
      ROLE: DispatchValues.#roleOf(identity),
      // The wave face's scope IS the wave — the unit, never the line's own identity.
      WAVE: isWave ? identity.tasks : "",
      // The brief is the dispatch's read input: the engine writes that exact name before
      // the child exists, so the cell is frame-free (and never an existence read).
      INPUT_WAVE_BRIEF: isWave ? DispatchValues.#rel(scene, scene.briefPath) : "",
      // The fix face's requesting carrier alone — a review writes its own draft, so
      // naming the same carrier would short-circuit the round.
      INPUT_REVIEWS:
        identity.op === "fix" ? DispatchValues.#rel(scene, artifact.reviewsPath ?? "") : "",
      // The ruling sidecar's path is the artifact read's OWN answer (the reviewed
      // carrier's identity), never a second derivation from the carrier name.
      INPUT_RULINGS:
        artifact.kind === "read" && artifact.read.kind === "ok"
          ? DispatchValues.#rel(scene, artifact.read.path ?? "")
          : "",
      INPUT_PLAN:
        identity.type === "plan"
          ? DispatchValues.#rel(scene, docPath)
          : identity.type === "branch"
            ? DispatchValues.#rel(scene, scene.planPath ?? "")
            : "",
      INPUT_SPEC: DispatchValues.#inputSpec(identity, scene, docPath),
      INPUT_OVERALL: DispatchValues.#inputOverall(identity, scene, docPath),
      // The tree-review scope anchor — the two tree-review faces only.
      BASE_BRANCH:
        isReview && (identity.type === "branch" || identity.type === "wave")
          ? (scene.baseBranch ?? "")
          : "",
      OUTPUT_REPORT: DispatchValues.#rel(scene, scene.reportPath),
      OUTPUT_EVIDENCE: DispatchValues.#rel(scene, scene.evidencePath),
      OUTPUT_HANDOFF: DispatchValues.#rel(scene, scene.handoffPath),
      // The target discriminant the child reads — the implement mode is the one role
      // without a target row, so its slot stays empty and the assembler drops the line.
      TARGET_TYPE: identity.phase === "implement" ? "" : identity.type,
      WORKSPACE_DIR: DispatchValues.#rel(scene, scene.workspaceDir),
      WORKSPACE_ID: scene.workspaceId,
      HANDOFF_SCHEMA: scene.handoffSchema,
    };
  }

  /** The ONE repo-basis conversion of this module — an empty value stays empty (never a
   *  `"."`), every other value collapses onto the repoRoot-relative shape
   *  (`RepoRoot.relativize` is idempotent, so a relative argv value passes through). */
  static #rel(scene: DispatchSceneFacts, value: string): string {
    return value === "" ? "" : scene.repoRoot.relativize(value);
  }

  /** The work-mode word (ROLE) of the dispatch — the doc shapes' fix face rides
   *  `docs-fix`; every other phase maps by its own word. */
  static #roleOf(identity: DispatchIdentity): string {
    if (identity.phase === "fix")
      return TargetFaceTable.isDocShape(identity.type) ? "docs-fix" : "fix";
    return identity.phase === "implement" ? "implement" : "review";
  }

  /** The judged-doc anchor: the design-spec reference on the plan / branch / wave lines
   *  (a `when: "identity"` cell), the judged document on the spec-shaped doc targets,
   *  and empty on the overall line — the charter is never its own spec. */
  static #inputSpec(
    identity: DispatchIdentity,
    scene: DispatchSceneFacts,
    docPath: string,
  ): string {
    if (identity.type === "plan" || identity.type === "branch" || identity.type === "wave") {
      return DispatchValues.#rel(scene, scene.specLink ?? "");
    }
    if (identity.type === "overall") return "";
    return DispatchValues.#rel(scene, docPath);
  }

  /** The parent charter: the overall line's own judged charter, the spec's declared
   *  `program:` on the phase-spec line, and the same-slug identity document's
   *  `program:` on the plan / branch / wave lines. */
  static #inputOverall(
    identity: DispatchIdentity,
    scene: DispatchSceneFacts,
    docPath: string,
  ): string {
    if (identity.type === "overall") return DispatchValues.#rel(scene, docPath);
    if (
      identity.type === "phase-spec" ||
      identity.type === "plan" ||
      identity.type === "branch" ||
      identity.type === "wave"
    ) {
      return DispatchValues.#rel(scene, scene.overallLink ?? "");
    }
    return "";
  }
}

/**
 * RequestingCarrier — the requesting review carrier's path, the ONE home of its
 * three-branch priority: the explicit `--reviews` flag → the carrier path the
 * same-cycle review record remembers → the review family's resolved name. Two readers
 * ask it (the composition root's `INPUT_REVIEWS` production and the lifecycle's
 * completion criterion / family face), so the order and the judgments live here alone.
 * Frame-free: the four identity cells arrive as flat facts.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the carrier priority's single home — the zero-bare-function discipline admits no standalone functions.
export class RequestingCarrier {
  /** The three branches in order. The second branch answers null when a record exists
   *  but resolves no carrier on disk (the unrecorded face the dispatch-input gate then
   *  words as `empty-value`). */
  static path(ledger: Ledger, flag: string | null, facts: RequestingCarrierFacts): string | null {
    if (flag !== null) return flag;
    const record = RequestingCarrier.requesterRecord(ledger, facts);
    if (record !== null) {
      const recorded = ledger.carrierPathOf(facts.type, facts.key, record);
      return recorded === "" ? null : recorded;
    }
    return RequestingCarrier.familyPath(ledger, facts);
  }

  /** The review family's name for this CYCLE — the "fall back with the cycle only" rule.
   *  It never carries the asking dispatch's attempt: the review family's attempt is its
   *  OWN recorded one, filled in by the ledger's `#attemptAware` default. A
   *  re-dispatched fix frame would otherwise ask for an `-a{n}` name the cycle's review
   *  never wrote. */
  static familyPath(ledger: Ledger, facts: RequestingCarrierFacts): string {
    return ledger.resolveHandoffPath("review", facts.type, {
      tasks: facts.tasks,
      round: facts.cycle,
    });
  }

  /** The upstream review this dispatch answers — the latest attempt of the same
   *  contract line at the same cycle (a re-dispatched review supersedes its
   *  predecessor, the same rule the round-read gate applies). Null when the line records
   *  no review for this cycle. ONE basis for the carrier's path and its digest. */
  static requesterRecord(ledger: Ledger, facts: RequestingCarrierFacts): RoundRecord | null {
    const reviewed = ledger
      .recordsOf(facts.key)
      .filter((record) => record.op === "review" && record.cycle === facts.cycle);
    return reviewed.reduce<RoundRecord | null>(
      (newest, record) => (newest === null || record.attempt >= newest.attempt ? record : newest),
      null,
    );
  }
}
