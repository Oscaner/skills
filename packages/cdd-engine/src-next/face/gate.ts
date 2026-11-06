// packages/cdd-engine/src-next/face/gate.ts
// T8 — the split contract's gate face (§6.2: face/gate.ts — the target/line gate
// family). The work commands' readiness gate facts — the single-target line's phase
// derivation (lineGate/#lineKey, reading the ONE walk
// `DispatchAuthority#linePhaseFacts`), the doc line's revision-aware BLOCK +
// pending-fix faces (#docLineBlock/#pendingFixBlock/#docContent/#docVersionOf), the
// refusal-prose renderers the CLI still prints (`lineHopMessage` for the lifecycle's
// peeked hop, `hopCommand` for the dispatch verdict's `next:` value, P22 §5.2) and
// the group/line helpers (#tasksOf/#renderBrief). The dispatch VERDICT itself is not
// this face's: `session/dispatch-authority.ts` owns it, and the CLI refusal renders
// the authority's hop (`PipelineFrontier#hopOf`). The method bodies are the
// pre-split Cli members moved verbatim — behavior bytes identical; the root Cli
// holds the gate instance and composes through it via its .action thin shells (zero
// bare functions).

import { readFileSync } from "node:fs";
import process from "node:process";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import { BriefRenderer } from "../render/brief.ts";
import { DispatchAuthority, type LinePhaseFacts } from "../session/dispatch-authority.ts";
import type { DocRevisionRef } from "../session/ledger.ts";
import type { NextHop } from "../session/next.ts";
import { RoundNaming } from "../session/round-naming.ts";
import type { RunInput, WorkScene } from "./cli.ts";
import { ARGV_CHANNEL } from "./declare.ts";
import { HostDetect } from "./host.ts";
import { RouteRenderer } from "./route-render.ts";
import type { Words } from "./words.ts";

/**
 * CliGate — the target/line gate family (the split contract's gate face): the
 * readiness FACTS the work commands render around a dispatch. The instance's methods
 * take the per-invocation scene; the gate holds only the stable collaborators it
 * needs — the brief renderer and the dispatch authority whose ONE line-phase walk it
 * reads (P27 §2.7; the verdict itself is never this face's to judge). The
 * verdict-bearing methods return their ruling + message — the root renders, never
 * re-judges.
 */
export class CliGate {
  readonly #brief: BriefRenderer;
  readonly #authority: DispatchAuthority;

  constructor(opts: { brief?: BriefRenderer; authority?: DispatchAuthority } = {}) {
    this.#brief = opts.brief ?? new BriefRenderer();
    this.#authority = opts.authority ?? new DispatchAuthority();
  }

  /** The single-target line's current open phase plus the doc-line verdict the gate
   *  judged — a FACE-LEVEL FACT READ (P27 §2.7): the walk itself lives ONCE, on the
   *  session plane (`DispatchAuthority#linePhaseFacts`), so the dispatch VERDICT and
   *  this face read one derivation and can never disagree on the line's phase. The
   *  gate renders the value; it never judges a dispatch.
   *
   *  The {phase, verdict} pair IS the gate's ruling: the revision-aware
   *  BLOCK renders only the "same" verdict the gate returned, the pending-fix note
   *  only the derived pending face, never a recomputed one. The task face holds no
   *  separate gate here: the wave rows are the authority's line leg — the ONE phase
   *  authority. A doc line's gate is the reviewGate method family (T8 · §3.5), shared
   *  by the lifecycle's frame phase so an opened gate dispatches: a moved doc reopens
   *  the review lead on a line whose C5 hop is on the EXIT side (a closed line, `null`,
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
   *  renders through the ONE hop), while only a fully closed, drift-free branch
   *  line keeps the generic `face-closed` row. */
  lineGate(scene: WorkScene): LinePhaseFacts {
    return this.#authority.linePhaseFacts(scene.ledger, {
      key: this.#lineKey(scene),
      doc: this.#docOf(scene),
      type: scene.face.type,
    });
  }

  /** The doc line's revision-aware BLOCK message (T7/T8) — the unchanged-approved
   *  face: "{plan|spec} already reviewed at vX.Y (doc-hash …) — target revision
   *  unchanged; amend body to open a new review". Renders ONLY on the
   *  gate's "same" verdict — the approved identity the gate judged, whose reviewed
   *  ref the message names: the block consumes the verdict's identity, never a
   *  second ledger lookup (the face's judgment read points converge to the
   *  method family). Null off that face or with no identity ("target revision
   *  unchanged" is a present fact only there). */
  docLineBlock(scene: WorkScene, reviewed: DocRevisionRef | null): string | null {
    if (reviewed === null || (scene.target?.kind !== "plan" && scene.target?.kind !== "spec"))
      return null;
    const version = this.#docVersionOf(this.#docContent(scene.target.doc));
    return `${scene.type} already reviewed at ${version ?? "the current version"} (doc-hash ${reviewed.doc_hash.slice(0, 12)}…) — target revision unchanged; amend body to open a new review`;
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

  /** lineHopMessage(scene, hop, words) — the CLI rejection prose of one `NextHop`
   *  (P22 §5.2, the ONE message shape): a hop names its verb, a closed face names
   *  its handoff station (rendered through the SAME route renderer the `next:` line
   *  uses), and neither renders an invented verb slot. */
  lineHopMessage(scene: WorkScene, hop: NextHop | null, words: Words): string {
    if (hop === null) return "the line holds no open round";
    const renderer = this.#renderer(scene, words);
    return scene.router.message(hop, (entry) =>
      renderer.render({ kind: "handoff", entry }, hop.target),
    );
  }

  /** hopCommand(scene, hop, words) — the `next:` VALUE of one hop through the SAME
   *  route renderer the capsule and the board read, so a dispatch refusal's `next:`
   *  and the board's `next:` row are byte-identical by construction. Empty string
   *  when the hop renders no command (the bare terminal rows). */
  hopCommand(scene: WorkScene, hop: NextHop, words: Words): string {
    return this.#renderer(scene, words).renderHop(hop) ?? "";
  }

  /** lineIdentity(scene) — this line's stable identity facts: the ledger KEY (the
   *  branch line's constant, a doc line's declared word) and the judged document (a
   *  doc line's own path, the branch line's plan, P21 §4.1). A FACT read, never a
   *  judgment: the dispatch verdict belongs to `session/dispatch-authority.ts`, so
   *  this accessor only spares its request assembly a second key/doc derivation. */
  lineIdentity(scene: WorkScene): { key: string | null; doc: string | null } {
    return { key: this.#lineKey(scene), doc: this.#docOf(scene) };
  }

  /** The ONE route renderer of this face — the argv channel, the host spelling and
   *  the scene's repo basis (the same instance shape the capsule and the board
   *  build), so every `next:` literal this file prints speaks one rendering. */
  #renderer(scene: WorkScene, words: Words): RouteRenderer {
    return new RouteRenderer(
      words,
      ARGV_CHANNEL,
      HostDetect.detect(process.env),
      scene.workspace.root.basis,
    );
  }

  /** The line's judged document — the doc line's own path, the branch line's plan
   *  (its identity document, P21 §4.1); null off the doc faces. */
  #docOf(scene: WorkScene): string | null {
    if (scene.target?.kind === "plan" || scene.target?.kind === "spec") return scene.target.doc;
    if (scene.target?.kind === "branch") return scene.planPath;
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

  /** The line key of a fixed-target face — the line's STABLE key (find #9 · spec
   *  §6.5/§3.7 — `"branch"` per workspace for the branch line; a doc line keys by
   *  its target-type word (`"phase-spec"` / `"overall"` / `"plan"` / `"single-spec"`)
   *  — never the argv path: a moved argv
   *  string must not fork the same line into two ledger rows, resetting its round),
   *  the lifecycle's own key derivation (run.ts #lineKey). Read here as a line
   *  IDENTITY fact; the phase judgment is the authority's. */
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
