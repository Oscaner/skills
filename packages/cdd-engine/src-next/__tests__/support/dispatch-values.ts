// packages/cdd-engine/src-next/__tests__/support/dispatch-values.ts
// P40 T5 — the fixture-side dispatch value record. `CliLifecycle` renders the record the
// composition root assembled (`DispatchValues.compose`) and derives nothing, so a test
// that dispatches a frame must hand the same kind of record in. This file is that
// producer: the SAME three cells the composition root composes (the identity off the
// frame, the scene facts off the fixture's scene, an artifact snapshot), so the fixture
// never writes a hand-made map of values.
//
// It mirrors the composition root's scene-facts assembly (`Cli#beforeOf`) on purpose:
// a fixture that hand-wrote the record would stop witnessing what the production
// assembly produces, and the prompt bytes those tests assert would be the fixture's
// rather than the engine's.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import type { ArtifactSnapshot } from "../../contract/preflight-rows.ts";
import {
  ArtifactSnapshots,
  type DispatchIdentity,
  type DispatchSceneFacts,
  DispatchValues,
  RequestingCarrier,
} from "../../face/dispatch-values.ts";
import type { DispatchScene } from "../../face/lifecycle.ts";
import { Words } from "../../face/words.ts";
import { TargetFaceTable } from "../../session/faces.ts";
import { HandoffSchema } from "../../session/handoff-schema.ts";
import { RoundRecords } from "../../session/ledger.ts";
import { ArtifactRegistry } from "../../session/round-artifacts.ts";
import { RoundNaming } from "../../session/round-naming.ts";
import type { OpenFrame } from "../../session/run.ts";

/**
 * TestDispatchValues — the fixture's pre-frame assembly. One entry: the frame plus the
 * fixture scene answer the flat record the lifecycle renders.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the fixture's single entry — the zero-bare-function discipline admits no standalone functions.
export class TestDispatchValues {
  /** The identity a frame would consume (the composition root's own folding rules). */
  static identityOf(frame: OpenFrame): DispatchIdentity {
    return {
      op: RoundRecords.opOf(frame.phase) ?? "review",
      type: frame.type,
      phase: frame.phase,
      tasks: frame.params.tasks ?? "",
      cycle: frame.round,
      attempt: frame.attempt ?? 1,
    };
  }

  /** The record for one frame over one fixture scene. `reviews` states the fix face's
   *  requesting carrier exactly as the CLI's `--reviews` flag would; the artifact
   *  snapshot is the caller's (the fixture's own read, or the no-sidecar default). */
  static of(
    scene: DispatchScene,
    frame: OpenFrame,
    over: { readonly reviews?: string | null; readonly artifact?: ArtifactSnapshot } = {},
  ): Readonly<Record<string, string>> {
    const identity = TestDispatchValues.identityOf(frame);
    const artifact = over.artifact ?? TestDispatchValues.artifactOf(scene, frame, over.reviews);
    return DispatchValues.compose(
      identity,
      TestDispatchValues.sceneFactsOf(scene, frame),
      artifact,
    );
  }

  /** The dispatch's artifact snapshot — the SAME assembly the composition root runs
   *  (`ArtifactSnapshots.of`), so a fixture whose sidecar sits on disk produces the
   *  record the real dispatch would: `INPUT_RULINGS` included. */
  static artifactOf(
    scene: DispatchScene,
    frame: OpenFrame,
    reviews?: string | null,
  ): ArtifactSnapshot {
    const identity = TestDispatchValues.identityOf(frame);
    const resolved = reviews === undefined ? TestDispatchValues.reviewsOf(scene, frame) : reviews;
    const record = RequestingCarrier.requesterRecord(scene.ledger, {
      type: frame.type,
      key: String(frame.key),
      cycle: frame.round,
      tasks: frame.params.tasks ?? "",
    });
    return ArtifactSnapshots.of({
      artifacts: new ArtifactRegistry(),
      workspace: scene.workspace,
      words: new Words(),
      op: identity.op,
      reviewsPath: resolved === null ? null : scene.workspace.root.basis.relativize(resolved),
      digest: record?.carrierDigest ?? null,
    });
  }

  /** The three `OUTPUT_*` names + the workspace cells the record carries — the naming
   *  rules the composition root applies, never a hand-spelled name. */
  static sceneFactsOf(scene: DispatchScene, frame: OpenFrame): DispatchSceneFacts {
    const identity = TestDispatchValues.identityOf(frame);
    const naming = scene.ledger.naming();
    const artifact = RoundNaming.artifactOf(identity.op, identity.type, {
      tasks: identity.tasks,
      round: identity.cycle,
      attempt: identity.attempt,
    });
    const plane = HandoffSchema.planeOf(identity.op);
    const evidence = TestDispatchValues.#evidenceName(scene, frame, artifact);
    const docPath =
      frame.target.kind === "plan" || frame.target.kind === "spec" ? frame.target.doc : null;
    return {
      repoRoot: scene.workspace.root.basis,
      docPath,
      planPath: scene.planPath,
      specLink: scene.specLink ?? null,
      overallLink: scene.overallLink ?? null,
      baseBranch: scene.baseBranch ?? null,
      briefPath:
        identity.tasks === ""
          ? ""
          : (scene.briefPath ?? scene.workspace.resolve(naming.briefName(identity.tasks))),
      workspaceDir: scene.workspace.path,
      workspaceId: scene.workspace.slug,
      reportPath: scene.workspace.resolve(RoundNaming.renderName(artifact, "report")),
      evidencePath: evidence,
      handoffPath: scene.ledger.handoffPath(identity.op, identity.type, {
        tasks: identity.tasks,
        round: identity.cycle,
        attempt: identity.attempt,
      }),
      handoffSchema: new HandoffSchema().schemaText(
        plane,
        plane === "work" && (identity.type === "wave" || identity.type === "branch"),
      ),
    };
  }

  /** The requesting carrier's path, resolved the way the composition root resolves it
   *  (the explicit flag, the recorded carrier, the family name) — the fixture's fix
   *  face reads its `INPUT_REVIEWS` cell through this. */
  static reviewsOf(scene: DispatchScene, frame: OpenFrame): string | null {
    return RequestingCarrier.path(scene.ledger, null, {
      type: frame.type,
      key: String(frame.key),
      cycle: frame.round,
      tasks: frame.params.tasks ?? "",
    });
  }

  /** The evidence path of this dispatch — "" off the evidence rounds (the doc shapes
   *  and the review rounds prescribe none), the round's own name on implement / fix. */
  static #evidenceName(
    scene: DispatchScene,
    frame: OpenFrame,
    artifact: ReturnType<typeof RoundNaming.artifactOf>,
  ): string {
    if (TargetFaceTable.isDocShape(frame.type)) return "";
    if (frame.phase !== "implement" && frame.phase !== "fix") return "";
    return scene.workspace.resolve(RoundNaming.renderName(artifact, "evidence"));
  }
}
