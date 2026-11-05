// packages/cdd-engine/src-next/face/capsule.ts
// T10 — the single capsule face (design spec §3.2: the `status · handoff` + route
// word-face steady state; P22 §10: the output face's closeout). Both station anchors
// ride the word table (`next:` and the `reason:` row that follows it). Capsule#emit
// renders the ALL-OP single stdout face — the capsule the orchestrator greps /
// routes on without opening the handoff:
//
//   status: <status> · handoff: <handoff>               (success statuses)
//   status: <status> [· handoff: <crash>]               (TIMEOUT / BLOCKED)
//   fixed N · rejected M        (fix rounds only — between the status line and `next:`)
//   next: <suggestion>          (optional — the C5 route / a caller-rendered text)
//   reason: <token>             (only after `next:` — the hop's named fact; no hop, no row)
//
// The `blocker` cell is retired: its whole information content — the blocker count —
// is derivable from `status` (any blocker ⇒ CHANGES_REQUESTED, warn/nit-only ⇒
// REVIEW_FIX, empty ⇒ APPROVED, a failure round prints no cell at all), and that
// count is exactly the number the review criterion rules undisplayed. The key set is
// still the word table's single source (`Words.capsuleKeys(status, withHandoff)`) —
// a failure status keeps the handoff cell only when the round wrote a crash record.
// The fix round's disposition summary rides the SAME render, placed so the
// dispatchable `next:` literal keeps its line: `status` → summary → `next:` →
// `reason:`.
//
// The byte face is v1-pinned: the key words (status · handoff) are pin-enforced by
// the CapsuleKey type and the emit signature — a data-only change cannot reshape
// them. What rides the injected Words table (the single word-table instance) is the
// `·` separator, the two route station anchors (`next:` and the `reason:` row that
// follows it) and the route/status vocabulary — a second table is excluded by
// construction. The `next:` value is
// either a caller-rendered string or the C5 Route rendered through the route-word
// table as a COMPLETE EXECUTABLE command (P4.1 T4 — the v1.39 semantic-literal
// reversal): `implement --plan <path> --tasks 17` · `review --type phase-spec --spec
// <path>` · `fix --type phase-spec --spec <path> --reviews <handoff>` + the readback
// suffix · `done` (the bare terminal word) · the soft-cap message verbatim.
// The argv is composed from the frame facts (the RouteTarget's type + id + plan)
// through the argv-channel flag spellings (the same channel the CLI parse reads —
// the render source is the declared channel, never a second hard-coded format
// string); the type flag renders ONLY where the verb's type discriminates
// (review/fix multi-type — implement is the single-type wave verb, so its literal
// never carries `--type` — the declaration's `parsed.args.type ?? "wave"` default
// semantics unchanged). The route-borne prose — the readback suffix · the soft-cap
// message — rides declared constants from session/next.ts, rendered by reference,
// never restated.
//
// D40 · P22 §5.2 — the render delegates to the shared `RouteRenderer` (the ONE
// route → `next:` literal face, also consumed by the board). The capsule reads the
// INJECTED `NextHop` — the ONE object every read face renders — and adds no
// judgment of its own: the doc-class discrimination that picks the pipeline station
// belongs to the derivation's injected seam (`BoardView.docClassOf`), never here.
// A `NextHop` that is ABSENT (the BLOCKED / TIMEOUT failure face) prints neither
// route row; a present hop with `hop: null` (`done` · `soft-cap` · the doc-class
// `terminal` / `blocked` rows) still prints its frozen line.
//
// The class satisfies the session/run.ts CapsuleFace seam (T8's interaction point) —
// the capsule plugs into the lifecycle's attachCapsule contact, byte-identically.
// Module-level exports are the class — zero behavior-carrying bare functions.

import type { RepoPath, RepoRoot } from "../infra/root.ts";
import type { NextHop } from "../session/next.ts";
import { type RouteChannelRow, RouteRenderer } from "./route-render.ts";
import type { CapsuleKey, Words } from "./words.ts";

/** The argv-channel flag row the capsule's render reads — re-exported from the
 *  shared renderer's row type (the capsule renders through the ONE RouteRenderer). */
export type CapsuleChannelRow = RouteChannelRow;

/**
 * Capsule — the single capsule output face. emit(status, handoff, hop?,
 * withHandoff?, summary?) renders one round's facts into the byte-pinned `status ·
 * handoff` line, the fix round's optional disposition summary, and the optional
 * `next:` row plus its `reason:` row LAST (the dispatchable literal keeps its exact
 * bytes; the diagnostic fact rides the line after it). The key words are
 * the CapsuleKey literals the kind loop renders (pin-enforced by the emit
 * signature); the separator, station and route/status words ride the injected Words
 * instance. The complete executable `next:` literal composes its full argv from the
 * injected `NextHop`'s route + target through the argv-channel flag spellings (P4.1
 * T4; same channel source the parse reads — the hop is optional, the channel an
 * optional 2nd constructor argument).
 */
export class Capsule {
  /** The single word table — the capsule's whole vocabulary source. */
  readonly #words: Words;
  /** The ONE route → `next:` literal renderer (D40 — shared with the board). */
  readonly #route: RouteRenderer;
  /** The repo-basis value object the doc-target ids + the `handoff:` cell resolve
   *  through (T1 `RepoRoot` · D47 — the ONE conversion exit; `null` keeps a relative
   *  id relative · the hermetic-test default). */
  readonly #root: RepoRoot | null;

  constructor(
    words: Words,
    channels: Readonly<Record<string, CapsuleChannelRow>> = {},
    host = "",
    root: RepoRoot | null = null,
  ) {
    this.#words = words;
    this.#root = root;
    this.#route = new RouteRenderer(words, channels, host, root);
  }

  /** emit(status, handoff, hop, withHandoff, summary) → the capsule stdout lines:
   *  the status-class key set from the word table (a success status renders
   *  `status · handoff`; a failure status renders `status`, plus `handoff` only when
   *  the round wrote a crash record), then the fix round's optional summary line,
   *  then the optional `next:` row followed by its `reason:` row — the dispatchable
   *  literal keeps its exact bytes and the diagnostic fact lands on the line after
   *  it. `hop` is the ONE injected `NextHop` object — its ABSENCE (null: the
   *  BLOCKED / TIMEOUT failure face) prints neither row, while a present object
   *  renders through the shared hop face (`RouteRenderer#renderHop`: the soft-cap
   *  message · the in-line hop · the face-to-face station · the BLOCKED face · the
   *  terminal word). `withHandoff` is the caller's crash-record fact — the key set
   *  remains the table's single source (this render adds no status special case).
   *
   *  Five parameters is one over the flat-signature limit: the positional face IS the
   *  pinned contract (the seam's emit signature), so it stays flat rather than boxed
   *  into a parameter object. */
  emit(
    status: string,
    handoff: string,
    hop?: NextHop | null,
    withHandoff = false,
    summary?: string,
  ): string[] {
    const words = this.#words;
    // The `handoff:` cell is a path value — normalized to the repoRoot-relative
    // shape through the ONE value object (D47 · the ONE basis; `handoffPath` sources
    // it absolute).
    const cells: Record<CapsuleKey, string> = {
      status,
      handoff: this.#rel(handoff),
    };
    const capsuleLine = words
      .capsuleKeys(status, withHandoff)
      .map((kind) => `${kind}: ${cells[kind]}`)
      .join(words.capsuleSeparator());
    const lines = [capsuleLine];
    if (summary !== undefined) lines.push(summary);
    const hopValue = hop ?? null;
    const next = this.#route.renderHop(hopValue);
    if (hopValue !== null && next !== null) {
      lines.push(`${words.station("next")} ${next}`);
      lines.push(this.#route.renderReason(hopValue));
    }
    return lines;
  }

  /** One path value normalized to the branded repoRoot-relative `RepoPath` through
   *  the ONE value object (D47); a `null` root (the hermetic default) passes the
   *  value through as its own basis. The branded return type carries the §2.2 brand
   *  to the render face with NO call-site cast (branch-review-1 F3); the board's doc
   *  cell and its `docClassOf` discrimination are the sibling read faces that
   *  resolve the same branded form. */
  #rel(value: string): RepoPath {
    return this.#root === null ? (value as RepoPath) : this.#root.relativize(value);
  }
}
