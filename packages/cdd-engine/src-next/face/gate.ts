// packages/cdd-engine/src-next/face/gate.ts
// T8 — the split contract's gate face (§6.2: face/gate.ts — the target/line gate
// family). The work commands' readiness gates — the single-target line's phase
// derivation (#lineGate/#linePhase/#lineKey/#lineParams/#lineRoundRoute/#lineFixRoute),
// the doc line's revision-aware BLOCK + pending-fix faces (#docLineBlock/
// #pendingFixBlock/#docContent/#docVersionOf) and the group/line helpers
// (#tasksOf/#renderBrief/#refFromHandoff). The method bodies are the pre-split Cli
// members moved verbatim — behavior bytes identical; the root Cli holds the gate
// instance and composes through it via its .action thin shells (zero bare functions).

import { readFileSync, writeFileSync } from "node:fs";
import { MarkdownPrimitives } from "../contract/doc.ts";
import { BriefRenderer } from "../render/brief.ts";
import type { DispatchPhase } from "../session/faces.ts";
import type { DocRevisionRef, HandoffParams } from "../session/ledger.ts";
import type { Route } from "../session/next.ts";
import { EMPTY_RUN_STATE } from "../session/run.ts";
import type { RunInput, WorkScene } from "./cli.ts";

/**
 * CliGate — the target/line gate family (the split contract's gate face): the
 * readiness judgments the work commands consult before dispatching a round. The
 * instance's methods take the per-invocation scene; the gate holds only the stable
 * collaborators it needs (the brief renderer). The verdict-bearing methods return
 * their ruling + message — the root renders, never re-judges.
 */
export class CliGate {
  readonly #brief: BriefRenderer;

  constructor(opts: { brief?: BriefRenderer } = {}) {
    this.#brief = opts.brief ?? new BriefRenderer();
  }

  /** The single-target line's current open phase plus the doc-line verdict the gate
   *  judged — the {phase, verdict} pair IS the gate's ruling: the revision-aware
   *  BLOCK renders only the "same" verdict the gate returned, the pending-fix note
   *  only the derived pending face, never a recomputed one. The task face holds no
   *  separate gate here: the WaveGate's wrong-phase verdict (the pre-flight) IS the
   *  task-face phase authority — the wave gate is the single phase authority. A
   *  doc line's gate is the reviewGate method family (T8 · §3.5 · judgment order =
   *  doc revision FIRST, shared by the lifecycle's frame phase so an opened gate
   *  dispatches): a moved doc opens the review lead whatever the round/route state
   *  says (fix after · backfill after · user-decision after are the SAME case — the
   *  stuck "next round is fix after an aborted fix" never freezes a revised doc),
   *  an unchanged doc yields the gate's "same" verdict — the pending fix DERIVED
   *  from the latest review's non-APPROVED conclusion opens only the fix phase,
   *  while the no-pending face falls back to the legacy rounds/routes judgment: a
   *  completed-fix line reopens the review lead through its fix round's C5-1 route
   *  (the lifecycle's own fall-through — an open gate and a dispatchable frame
   *  agree), a truly closed line keeps the revision-aware BLOCK. An unbound line
   *  (no identity on record / an unreadable doc) keeps the legacy round/route
   *  judgment + the generic closed message (only present facts land). */
  lineGate(scene: WorkScene): {
    phase: DispatchPhase | null;
    verdict: "same" | "pending-fix" | null;
    reviewed: DocRevisionRef | null;
  } {
    if (scene.target?.kind === "doc") {
      const key = this.#lineKey(scene);
      if (key === null) return { phase: null, verdict: null, reviewed: null };
      const verdict = scene.ledger.reviewGate(key, scene.target.doc, scene.face.type);
      if (verdict.kind === "open") {
        return { phase: scene.face.product.reviewLead, verdict: null, reviewed: null };
      }
      if (verdict.kind === "same") {
        if (verdict.pending) {
          return { phase: "fix", verdict: "pending-fix", reviewed: verdict.reviewed };
        }
        // same + no pending fix — the legacy rounds/routes judgment (the lifecycle's
        // own fall-through): a completed-fix line reopens the review lead through its
        // fix round's C5-1 route; a truly closed line keeps the revision-aware BLOCK.
        const open = this.#linePhase(scene);
        return open !== null
          ? { phase: open, verdict: null, reviewed: null }
          : { phase: null, verdict: "same", reviewed: verdict.reviewed };
      }
    }
    const open = this.#linePhase(scene);
    return { phase: open, verdict: null, reviewed: null };
  }

  /** The doc line's revision-aware BLOCK message (T7/T8) — the unchanged-approved
   *  face: "{plan|spec} already reviewed at vX.Y (doc-hash …) — target revision
   *  unchanged; amend body/version to open a new review". Renders ONLY on the
   *  gate's "same" verdict — the approved identity the gate judged, whose reviewed
   *  ref the message names: the block consumes the verdict's identity, never a
   *  second ledger lookup (the face's judgment read points converge to the
   *  method family). Null off that face or with no identity ("target revision
   *  unchanged" is a present fact only there). */
  docLineBlock(scene: WorkScene, reviewed: DocRevisionRef | null): string | null {
    if (reviewed === null || scene.target?.kind !== "doc") return null;
    const version = this.#docVersionOf(this.#docContent(scene.target.doc));
    return `${scene.type} already reviewed at ${version ?? "the current version"} (doc-hash ${reviewed.doc_hash.slice(0, 12)}…) — target revision unchanged; amend body/version to open a new review`;
  }

  /** The doc line's derived pending-fix note (T8) — the unchanged + non-APPROVED
   *  face: "the pending fix applies to the unchanged doc (doc-hash …) — run cdd
   *  fix first". Renders ONLY for the gate's "pending-fix" verdict — the derived
   *  fix-awaited face (a same-doc re-review stays refused until its fix lands,
   *  Review Convergence anti-spin); the message names the reviewed identity the
   *  gate judged. */
  pendingFixBlock(scene: WorkScene, reviewed: DocRevisionRef | null): string | null {
    if (reviewed === null || scene.target?.kind !== "doc") return null;
    return `the pending fix applies to the unchanged doc (doc-hash ${reviewed.doc_hash.slice(0, 12)}…) — run cdd fix first`;
  }

  /** The requested group ints — the normalized tasks value split. */
  tasksOf(parsed: RunInput): number[] {
    return (parsed.args.tasks ?? "").split(",").map((part) => Number(part));
  }

  /** Render the task group brief into the workspace (the implement dispatch's input)
   *  — the brief mirrors the current plan (its task sections + the `## Constraints`
   *  section, re-extracted at every dispatch). */
  renderBrief(scene: WorkScene, parsed: RunInput): string {
    const tasks = this.tasksOf(parsed);
    const content = this.#brief.render(scene.planText!, tasks);
    const briefPath = scene.workspace.resolve(`tasks-${parsed.args.tasks}-brief.md`);
    writeFileSync(briefPath, content, "utf8");
    return briefPath;
  }

  /** The single-target line's current open phase — fix-awaits / re-review / closure
   *  read through the same ledger + router the lifecycle's line faces judge. */
  #linePhase(scene: WorkScene): DispatchPhase | null {
    const reviewLead = scene.face.product.reviewLead;
    const key = this.#lineKey(scene);
    if (key === null) return null;
    const reviews = scene.ledger.roundCount(key, reviewLead);
    if (reviews === 0) return reviewLead;
    // The latest review cycle's IDENTITY membership in the fix set (D28) — the twin
    // of the lifecycle's #nextLinePhase judgment (a count comparison would flatten a
    // skipped cycle into a phantom pending fix).
    if (!scene.ledger.roundRecorded(key, "fix", reviews)) {
      const route = this.#lineRoundRoute(scene, reviews);
      return route?.kind === "fix" ? "fix" : null;
    }
    const route = this.#lineFixRoute(scene, reviews);
    return route?.kind === "review" ? reviewLead : null;
  }

  /** The line key of a fixed-target face — the line's STABLE key (find #9 · spec
   *  §6.5/§3.7 — `"branch"` per workspace for the branch line; the doc line keys by
   *  its line-type constant `"spec"`/`"plan"` — never the argv path: a moved argv
   *  string must not fork the same line into two ledger rows, resetting its round),
   *  the lifecycle's own key derivation (run.ts #lineKey). */
  #lineKey(scene: WorkScene): string | null {
    if (scene.target?.kind === "branch") return "branch";
    if (scene.target?.kind === "doc") return scene.face.type;
    return null;
  }

  /** The official handoff params of a line round (the lifecycle's own per-face shape). */
  #lineParams(round: number): HandoffParams {
    return { round };
  }

  /** The C5 route of a line's review-lead round (the fix-awaits decision). */
  #lineRoundRoute(scene: WorkScene, round: number): Route | null {
    const carried = scene.ledger.round("review", scene.face.type, this.#lineParams(round), round);
    if (carried === null) return null;
    return scene.router.next(EMPTY_RUN_STATE, carried);
  }

  /** The C5 route of a line's fix round (the re-review/closure decision). */
  #lineFixRoute(scene: WorkScene, round: number): Route | null {
    const carried = scene.ledger.round("fix", scene.face.type, this.#lineParams(round), round);
    if (carried === null) return null;
    return scene.router.next(EMPTY_RUN_STATE, carried);
  }

  /** The doc's live content — readable doc else null. This helper backs the face's
   *  one remaining doc read site, the revision-aware BLOCK's version token — a read
   *  fired only when the BLOCK message actually renders (the version is raw doc
   *  grammar — zero parse dependence: the revision hash is a raw-content digest).
   *  The gate's own doc read lives in the ledger (Ledger#docLineVerdict — one read
   *  per reviewGate, the shared comparison). A BLOCK render is a run-failure prose
   *  channel — never a usage face — so the read is guarded here (null on unreadable),
   *  not routed through the artifacts readText's usage error. */
  #docContent(doc: string): string | null {
    try {
      return readFileSync(doc, "utf8");
    } catch {
      return null;
    }
  }

  /** The doc's `v<major>.<minor>` version token — the first token on the
   *  `**Version**` header line (the shared version-token grammar's one home —
   *  MarkdownPrimitives.versionTokensOf · contract/doc.ts). */
  #docVersionOf(content: string | null): string | null {
    if (content === null) return null;
    for (const line of content.split("\n")) {
      if (line.trimStart().startsWith("- **Version**:")) {
        return MarkdownPrimitives.versionTokensOf(line)[0] ?? null;
      }
    }
    return null;
  }
}
