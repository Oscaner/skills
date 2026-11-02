// packages/cdd-engine/src-next/face/capsule.ts
// T10 — the single capsule face (design spec §3.2: the `status · blocker · handoff
// · next:` word-face steady state). Capsule#emit renders the ALL-OP single stdout
// face — the capsule the orchestrator greps / routes on without opening the handoff:
//
//   status: <status> · blocker: <blocker> · handoff: <handoff>   (success statuses)
//   status: <status> [· handoff: <crash>]                       (TIMEOUT / BLOCKED)
//   next: <suggestion>          (optional — the C5 route / a caller-rendered text)
//
// The key set is the word table's single source (`Words.capsuleKeys(status,
// withHandoff)`) — a failure status drops the blocker cell whose value would be a
// filler, and keeps the handoff cell only when the round wrote a crash record.
//
// The byte face is v1-pinned: the key words (status · blocker · handoff) are
// pin-enforced by the CapsuleKey type and the emit signature — a data-only change
// cannot reshape them. What rides the injected Words table (the single word-table
// instance) is the `·` separator, the `next:` station anchor and the route/status
// vocabulary — a second table is excluded by construction. The `next:` value is
// either a caller-rendered string or the C5 Route rendered through the route-word
// table as a COMPLETE EXECUTABLE command (P4.1 T4 — the v1.39 semantic-literal
// reversal): `implement --plan <path> --tasks 17` · `review --type spec --spec
// <path>` · `fix --type spec --spec <path> --reviews <handoff> (read file back to
// confirm)` · `done` (the bare terminal word) · the soft-cap message verbatim.
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
// A `NextHop` that is ABSENT (the BLOCKED / TIMEOUT failure face) prints no `next:`
// line; a present hop with `hop: null` (`done` · `soft-cap` · the doc-class
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
 * Capsule — the single capsule output face. emit(status, blocker, handoff, hop?,
 * withHandoff?) renders one round's facts into the byte-pinned `status · blocker ·
 * handoff` line plus the optional `next:` line. The key words are the CapsuleKey
 * literals the kind loop renders (pin-enforced by the emit signature); the
 * separator, station and route/status words ride the injected Words instance. The
 * complete executable `next:` literal composes its full argv from the injected
 * `NextHop`'s route + target through the argv-channel flag spellings (P4.1 T4; same
 * channel source the parse reads — the hop is optional, the channel an optional 2nd
 * constructor argument).
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

  /** emit(status, blocker, handoff, hop, withHandoff) → the capsule stdout lines:
   *  the status-class key set from the word table (a success status renders
   *  `status · blocker · handoff`; a failure status renders `status`, plus `handoff`
   *  only when the round wrote a crash record), then the optional `next:` line.
   *  `hop` is the ONE injected `NextHop` object — its ABSENCE (null: the BLOCKED /
   *  TIMEOUT failure face) prints no `next:` line at all, while a present object
   *  renders through the shared hop face (`RouteRenderer#renderHop`: the soft-cap
   *  message · the in-line hop · the face-to-face station · the BLOCKED face · the
   *  terminal word). `withHandoff` is the caller's crash-record fact — the key set
   *  remains the table's single source (this render adds no status special case). */
  emit(
    status: string,
    blocker: string,
    handoff: string,
    hop?: NextHop | null,
    withHandoff = false,
  ): string[] {
    const words = this.#words;
    // The `handoff:` cell is a path value — normalized to the repoRoot-relative
    // shape through the ONE value object (D47 · the ONE basis; `handoffPath` sources
    // it absolute).
    const cells: Record<CapsuleKey, string> = {
      status,
      blocker,
      handoff: this.#rel(handoff),
    };
    const capsuleLine = words
      .capsuleKeys(status, withHandoff)
      .map((kind) => `${kind}: ${cells[kind]}`)
      .join(words.capsuleSeparator());
    const lines = [capsuleLine];
    const next = this.#route.renderHop(hop ?? null);
    if (next !== null) lines.push(`${words.station("next")} ${next}`);
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
