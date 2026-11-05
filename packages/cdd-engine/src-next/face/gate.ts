// packages/cdd-engine/src-next/face/gate.ts
// T8 — the split contract's gate face (§6.2: face/gate.ts — the target/line gate
// family). The work commands' readiness gates — the single-target line's phase
// derivation (lineGate/#linePhase/#lineKey), the doc line's revision-aware BLOCK +
// pending-fix faces (#docLineBlock/#pendingFixBlock/#docContent/#docVersionOf), the
// ONE line-hop object the CLI refusal renders (lineHop + lineHopMessage, P22 §5.2)
// and the group/line helpers (#tasksOf/#renderBrief). The method bodies are the
// pre-split Cli members moved verbatim — behavior bytes identical; the root Cli
// holds the gate instance and composes through it via its .action thin shells (zero
// bare functions).

import { readFileSync } from "node:fs";
import process from "node:process";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import { BriefRenderer } from "../render/brief.ts";
import type { DispatchPhase, RouteTarget } from "../session/faces.ts";
import type { DocRevisionRef } from "../session/ledger.ts";
import type { NextHop } from "../session/next.ts";
import { RoundNaming } from "../session/round-naming.ts";
import { BoardView } from "./board-view.ts";
import type { RunInput, WorkScene } from "./cli.ts";
import { ARGV_CHANNEL } from "./declare.ts";
import { HostDetect } from "./host.ts";
import { RouteRenderer } from "./route-render.ts";
import type { Words } from "./words.ts";

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
   *  doc line's gate is the reviewGate method family (T8 · §3.5), shared by the
   *  lifecycle's frame phase so an opened gate dispatches: a moved doc reopens the
   *  review lead on a line whose C5 hop is on the EXIT side (a closed line, `null`,
   *  or a face-to-face station — the ONE `Ledger#docReopens` judgment), while a
   *  still-pending fix keeps its hop (drift never outranks it, §5.5 ②) so the gate
   *  never refuses the round the ONE derivation names. An unchanged doc yields the
   *  gate's "same" verdict — the pending fix DERIVED from the latest review's
   *  non-APPROVED conclusion opens only the fix phase, while the no-pending face
   *  falls back to the legacy rounds/routes judgment: a completed-fix line reopens
   *  the review lead through its fix round's C5-1 route (the lifecycle's own
   *  fall-through — an open gate and a dispatchable frame agree), a truly closed line
   *  keeps the revision-aware BLOCK. An unbound line (no identity on record / an
   *  unreadable doc) keeps the legacy round/route judgment + the generic closed
   *  message (only present facts land).
   *
   *  The branch line rides the SAME drift leg (its identity document is the PLAN,
   *  P21 §3/§4.1 — the very document a branch re-review judges): a plan revision
   *  moved past the bound one reopens the branch face onto its `branch-review`
   *  lead, so the `next:` a closure hands the user is never a command this gate
   *  refuses. An unchanged plan falls through to the SAME derived faces the doc lines
   *  reach: a branch review that left findings yields the derived `fix` face
   *  (`pending-fix` — no doc-class BLOCK message binds the branch face, so the refusal
   *  renders through the ONE line hop), while only a fully closed, drift-free branch
   *  line keeps the generic `face-closed` row. */
  lineGate(scene: WorkScene): {
    phase: DispatchPhase | null;
    verdict: "same" | "pending-fix" | null;
    reviewed: DocRevisionRef | null;
  } {
    const key = this.#lineKey(scene);
    const doc = this.#docOf(scene);
    const verdict =
      key !== null && doc !== null ? scene.ledger.reviewGate(key, doc, scene.face.type) : null;
    // The drift leg reads the ONE reopen judgment (exit-side routes only): a moved doc
    // reopens the review lead on a line whose C5 hop is gone, while a still-pending
    // fix keeps its own hop — drift never outranks it (§5.1 · §5.5 ②), so this gate
    // always accepts the round the ONE derivation names.
    if (
      key !== null &&
      verdict !== null &&
      scene.ledger.docReopens(key, scene.face.type, verdict)
    ) {
      return { phase: scene.face.product.reviewLead, verdict: null, reviewed: null };
    }
    if (verdict !== null && verdict.kind === "same") {
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
    if (reviewed === null || (scene.target?.kind !== "plan" && scene.target?.kind !== "spec"))
      return null;
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
    if (reviewed === null || (scene.target?.kind !== "plan" && scene.target?.kind !== "spec"))
      return null;
    return `the pending fix applies to the unchanged doc (doc-hash ${reviewed.doc_hash.slice(0, 12)}…) — run cdd fix first`;
  }

  /** lineHop(scene) — this LINE's next-hop object (§5.2), the LINE FRONTIER's
   *  assembly: built from this line's facts through `Ledger#nextHopOf` (the ONE
   *  derivation entry: the drift gate + the declaration read). The capsule and the
   *  board render the PIPELINE frontier's assembly (`PipelineFrontier#hopOf`) instead,
   *  a different reader over a different input; this one serves the CLI rejection
   *  message, which renders THIS object's `reason` + hop/station
   *  — never a second judgment, never a second shape. The doc-class
   *  discrimination is ROOTED in the workspace's own repo basis (the same basis the
   *  lifecycle injects), so an engine invoked from a subdirectory reads the
   *  same declared `doc-type:` the board does. Null when the scene holds no
   *  registered line (no fixed target → there is no line to name). */
  lineHop(scene: WorkScene): NextHop | null {
    const key = this.#lineKey(scene);
    const target = this.#routeTargetOf(scene);
    if (key === null || target === null) return null;
    const basis = scene.workspace.root.basis;
    return scene.ledger.nextHopOf({
      type: scene.face.type,
      key,
      route: scene.ledger.lineRoute(key, scene.face.type),
      target,
      doc: this.#docOf(scene),
      docClassOf: (candidate) => BoardView.docClassOf(basis, candidate),
    });
  }

  /** lineHopMessage(scene, hop, words) — the CLI rejection prose of one `NextHop`
   *  (P22 §5.2, the ONE message shape): a hop names its verb, a closed face names
   *  its handoff station (rendered through the SAME route renderer the `next:` line
   *  uses), and neither renders an invented verb slot. */
  lineHopMessage(scene: WorkScene, hop: NextHop | null, words: Words): string {
    if (hop === null) return "the line holds no open round";
    const renderer = new RouteRenderer(
      words,
      ARGV_CHANNEL,
      HostDetect.detect(process.env),
      scene.workspace.root.basis,
    );
    return scene.router.message(hop, (entry) =>
      renderer.render({ kind: "handoff", entry }, hop.target),
    );
  }

  /** The line's judged document — the doc line's own path, the branch line's plan
   *  (its identity document, P21 §4.1); null off the doc faces. */
  #docOf(scene: WorkScene): string | null {
    if (scene.target?.kind === "plan" || scene.target?.kind === "spec") return scene.target.doc;
    if (scene.target?.kind === "branch") return scene.planPath;
    return null;
  }

  /** The dispatch frame's own render target (§5.2's `target` cell) — the fixed
   *  line's type + stable key (+ the plan fact the branch literal needs). A doc shape
   *  (the `--spec` channel: phase-spec / overall / single-spec) renders its OWN
   *  target-type word, never a folded `spec` spelling. */
  #routeTargetOf(scene: WorkScene): RouteTarget | null {
    if (scene.target?.kind === "branch")
      return { type: "branch", id: "branch", plan: scene.planPath ?? undefined };
    if (scene.target?.kind === "spec") return { type: scene.face.type, id: scene.target.doc };
    if (scene.target?.kind === "plan") return { type: "plan", id: scene.target.doc };
    return null;
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
    // The real run's workspace is built by the single write point (`Cli#runWork`'s
    // ensure, P11 · §4.2) BEFORE this render; the write still rides the workspace's
    // own text-write face (the `writeJson` mkdir-before-write pattern), never a
    // second explicit `ensure()` — no bare `writeFileSync` into a possibly absent dir.
    const name = new RoundNaming(scene.workspace).briefName(parsed.args.tasks ?? "");
    return scene.workspace.writeText(name, content);
  }

  /** The single-target line's current open phase — fix-awaits / re-review / closure
   *  read from the ledger's SINGLE line-phase judge (`Ledger#linePhase`, D40 — the
   *  retired gate twin): the gate and the lifecycle's frame frontier now read ONE
   *  source, never a second walk. */
  #linePhase(scene: WorkScene): DispatchPhase | null {
    const key = this.#lineKey(scene);
    if (key === null) return null;
    return scene.ledger.linePhase(key, scene.face.type);
  }

  /** The line key of a fixed-target face — the line's STABLE key (find #9 · spec
   *  §6.5/§3.7 — `"branch"` per workspace for the branch line; a doc line keys by
   *  its target-type word (`"phase-spec"` / `"overall"` / `"plan"` / `"single-spec"`)
   *  — never the argv path: a moved argv
   *  string must not fork the same line into two ledger rows, resetting its round),
   *  the lifecycle's own key derivation (run.ts #lineKey). */
  #lineKey(scene: WorkScene): string | null {
    if (scene.target?.kind === "branch") return "branch";
    if (scene.target?.kind === "plan" || scene.target?.kind === "spec") return scene.face.type;
    return null;
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

  /** The doc's `v<major>.<minor>` version token — the front-matter `version:`
   *  scalar (the T6 read point: the header version facts ride the typed head
   *  record — the fence split + `yaml` engine, never a line scan). */
  #docVersionOf(content: string | null): string | null {
    if (content === null) return null;
    return FrontMatterExtractor.split(content).head.version;
  }
}
