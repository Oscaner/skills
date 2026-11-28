// packages/cdd-engine/src/run/dispatch/values.ts
// The dispatch's PRE-FRAME value assembly — one flat record, composed before any child
// exists and read by every consumer of the dispatch's values.
//
// INVARIANT — one assembly, one basis: the three input cells (the dispatch's identity, the
// line's declared scene facts, the artifact judgment) are flattened ONCE, every path cell
// is collapsed onto the repository basis at exactly one point (`#rel`), and the four
// pre-dispatch station rows and the render face read the same record — neither re-assembles
// it.
//
// The identity cell folds two kinds of fact the spec keeps apart: the round identity (the
// verb, the cycle, the attempt) and the line's own facts (the target face, the rendered
// phase, the wave's task group). Nothing here derives either again: the op arrives already
// folded (`branch-review` → `review`), and `attempt` is the one allocated on that value.
//
// The scene cell carries every path in the shape its producer holds; the composer collapses
// them onto ONE shape. The brief is the dispatch's read input and its cell is frame-free:
// the engine writes that exact name before the child exists. The artifact snapshot never
// relativizes — a read's coordinate is already the repository's.
//
// Two spellings of the brief exist and both are the same name: the dispatch face hands its
// path at landing time, while a preview reads the name from the injected brief face. The
// producer's matrix row is that one spelling's home, so this module neither spells it nor
// writes it.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { DOC_TYPE_VALUES, type TargetType } from "../../docs/identity/types.ts";
import type { RepoRoot } from "../../env/paths/root.ts";
import type { ArtifactRead } from "../ledger/artifact-reads.ts";
import type { CarrierFacts } from "../ledger/carrier-line.ts";
import type { RoundOp } from "../ledger/identity.ts";

/** The dispatch's identity — the round it would consume plus the line's own facts. */
export interface DispatchIdentity {
  /** The round verb, already folded (`branch-review` → `review`). */
  readonly op: RoundOp;
  /** The target face (the dispatch's `--type` word). */
  readonly type: TargetType;
  /** The rendered phase word (`implement` · `fix` · `review` · `branch-review`). */
  readonly phase: string;
  /** The wave face's task group ("" off the wave face). */
  readonly tasks: string;
  /** The cycle the dispatch would consume. */
  readonly cycle: number;
  /** The attempt on that cycle. */
  readonly attempt: number;
}

/** The line's declared scene facts — everything the record needs that is neither the
 *  dispatch's identity nor an artifact judgment. */
export interface DispatchSceneFacts {
  /** The path cells' ONE basis — the relativization below delegates to it. */
  readonly repoRoot: RepoRoot;
  /** The judged document of a plan / spec target; null elsewhere. */
  readonly docPath: string | null;
  /** The line's plan path; null when it carries none. */
  readonly planPath: string | null;
  /** The plan's `spec:` link target; null when the line declares none. */
  readonly specLink: string | null;
  /** The parent charter the spec's `program:` names; null when it names none. */
  readonly overallLink: string | null;
  /** The base artifact's branch name; null when absent. */
  readonly baseBranch: string | null;
  /** The engine-written brief's path — the name the producer wrote, never one derived
   *  here. */
  readonly briefPath: string;
  /** The dispatch workspace's directory and slug. */
  readonly workspaceDir: string;
  readonly workspaceId: string;
  /** The three prescribed write paths; `evidencePath` is "" off the evidence rounds. */
  readonly reportPath: string;
  readonly evidencePath: string;
  readonly handoffPath: string;
  /** The `## Handoff schema` section the prompt carries. */
  readonly handoffSchema: string;
}

/** This dispatch's artifact judgment: the sidecar read, or the carrier-integrity arm that
 *  replaces it (a tampered carrier's id set is not a fact the round may read). */
export type ArtifactSnapshot =
  | {
      readonly kind: "read";
      /** The fix face's `--reviews` input, in the shape its producer holds it. */
      readonly reviewsPath: string | null;
      readonly read: ArtifactRead;
    }
  | {
      readonly kind: "mismatch";
      readonly reviewsPath: string | null;
      readonly carrier: CarrierFacts;
    };

/**
 * DispatchValues — the ONE pre-frame assembly of a dispatch's round-context values.
 * Stateless: `compose` takes the three cells and answers the flat record, so a seam judgment
 * and a render of the same dispatch read one answer, never two derivations.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the composer's single entry — the zero-bare-function discipline admits no standalone function.
export class DispatchValues {
  /** Compose the flat record from the identity, the scene facts and the artifact snapshot.
   *  Every path cell meets the repository basis here, and only here. */
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
      // The fix face's requesting carrier alone — a review writes its own draft, so naming
      // the same carrier would short-circuit the round.
      INPUT_REVIEWS:
        identity.op === "fix" ? DispatchValues.#rel(scene, artifact.reviewsPath ?? "") : "",
      // The ruling sidecar's path is the artifact read's OWN answer, never a second
      // derivation from the carrier name — and it is already a repo-relative coordinate,
      // so it passes through unre-spelled.
      INPUT_RULINGS:
        artifact.kind === "read" && artifact.read.kind === "ok" ? artifact.read.path : "",
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

  /** The ONE repository-basis conversion of this module — an empty value stays empty
   *  (never a `.`), every other value collapses onto the repo-relative shape
   *  (`relativize` is idempotent, so a relative value passes through). */
  static #rel(scene: DispatchSceneFacts, value: string): string {
    return value === "" ? "" : scene.repoRoot.relativize(value);
  }

  /** The work-mode word (ROLE) — a doc shape's fix face rides `docs-fix`; every other
   *  phase maps by its own word. */
  static #roleOf(identity: DispatchIdentity): string {
    if (identity.phase === "fix") {
      return (DOC_TYPE_VALUES as readonly string[]).includes(identity.type) ? "docs-fix" : "fix";
    }
    return identity.phase === "implement" ? "implement" : "review";
  }

  /** The judged-doc anchor: the design-spec reference on the plan / branch / wave lines,
   *  the judged document on the spec-shaped doc targets, and empty on the overall line —
   *  the charter is never its own spec. */
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
   *  `program:` on the phase-spec line, and the same-slug identity document's `program:` on
   *  the plan / branch / wave lines. */
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
