// packages/cdd-engine/src-next/face/capsule.ts
// T10 — the single capsule face (design spec §3.2: the `status · blocker · handoff
// · next:` word-face steady state). Capsule#emit renders the ALL-OP single stdout
// face — the capsule the orchestrator greps / routes on without opening the handoff:
//
//   status: <status> · blocker: <blocker> · handoff: <handoff>
//   next: <suggestion>          (optional — the C5 route / a caller-rendered text)
//
// The byte face is v1-pinned: the key words (status · blocker · handoff) are
// pin-enforced by the CapsuleKey type and the emit signature — a data-only change
// cannot reshape them. What rides the injected Words table (the single word-table
// instance) is the `·` separator, the `next:` station anchor and the route/status
// vocabulary — a second table is excluded by construction. The `next:` value is
// either a caller-rendered string or the C5 Route rendered through the route-word
// table as a DISPATCH-READY literal (v1.25): `[verb] [target-type] [id] (payload)`
// — `implement wave {tasks}` · `review wave {tasks} (base {base7})` · `fix wave
// {tasks} --findings {path} (read file back to confirm)` · `done` (the bare
// terminal word) · the soft-cap message verbatim. The target identity (type + id)
// rides the optional additive RouteTarget param (the dispatch frame's own facts —
// emitted by the lifecycle, never judged by the router); the route-borne prose —
// the readback suffix · the soft-cap message — rides declared constants from
// session/next.ts, rendered by reference, never restated.
//
// The class satisfies the session/run.ts CapsuleFace seam (T8's interaction point) —
// the capsule plugs into the lifecycle's attachCapsule contact, byte-identically.
// Module-level exports are the class — zero behavior-carrying bare functions.

import type { RouteTarget } from "../session/faces.ts";
import { FIX_READBACK_SUFFIX, type Route } from "../session/next.ts";
import type { CapsuleKey, Words } from "./words.ts";

/**
 * Capsule — the single capsule output face. emit(status, blocker, handoff, next)
 * renders one round's facts into the byte-pinned `status · blocker · handoff` line
 * plus the optional `next:` line. The key words are the CapsuleKey literals the
 * kind loop renders (pin-enforced by the emit signature); the separator, station
 * and route/status words ride the injected Words instance. The dispatch-ready
 * `next:` literal fills its verb + target-type + id from the route + the additive
 * optional RouteTarget (the frame's own facts — the 4-param signature stays
 * byte-pinned, the target is an optional 5th).
 */
export class Capsule {
  /** The single word table — the capsule's whole vocabulary source. */
  readonly #words: Words;

  constructor(words: Words) {
    this.#words = words;
  }

  /** The word table this capsule reads from (the single-source face). */
  words(): Words {
    return this.#words;
  }

  /** emit(status, blocker, handoff, next, target) → the capsule stdout lines: the
   *  pinned `status · blocker · handoff` capsule line, then the optional `next:`
   *  line (a caller-rendered text, a C5 Route rendered dispatch-ready, or null/
   *  absent → no line). The additive optional RouteTarget supplies the frame's own
   *  type + id for the dispatch-ready literal (v1.25); without it the route renders
   *  its bare classifier fallbacks (the 4-param signature stays byte-pinned). */
  emit(
    status: string,
    blocker: string,
    handoff: string,
    next?: Route | string | null,
    target?: RouteTarget | null,
  ): string[] {
    const words = this.#words;
    const cells: Record<CapsuleKey, string> = { status, blocker, handoff };
    const capsuleLine = words
      .capsuleKeys()
      .map((kind) => `${kind}: ${cells[kind]}`)
      .join(words.capsuleSeparator());
    const lines = [capsuleLine];
    if (next !== undefined && next !== null) {
      const text = typeof next === "string" ? next : this.#routeText(next, target);
      lines.push(`${words.station("next")} ${text}`);
    }
    return lines;
  }

  /** The route → `next:` text render — one classifier per C5 route row, shaped as
   *  the dispatch-ready literal `[verb] [target-type] [id] (payload)` (v1.25):
   *  `implement wave {tasks}` for a ready wave · `review {type} {id} (base {base7})`
   *  for a re-review · `fix {type} {id} --findings {path} (read file back to
   *  confirm)` for the one-way fix hop · `done` as the bare terminal word · the
   *  soft-cap message verbatim. The target identity is the dispatch frame's own
   *  facts (never a router judgment); absent → the bare classifier fallbacks. */
  #routeText(route: Route, target?: RouteTarget | null): string {
    const words = this.#words;
    switch (route.kind) {
      case "done":
        return words.routeWord("done");
      case "next-wave":
        return `${words.routeWord("implement")} wave ${route.tasks}`;
      case "review":
        if (target !== undefined && target !== null) {
          return `${words.routeWord("review")} ${target.type} ${target.id} (base ${route.base.slice(0, 7)})`;
        }
        return `${words.routeWord("review")} ${route.base.slice(0, 7)}`;
      case "fix":
        if (route.findings === undefined) return words.routeWord("fix");
        if (target !== undefined && target !== null) {
          return `${words.routeWord("fix")} ${target.type} ${target.id} --findings ${route.findings} ${FIX_READBACK_SUFFIX}`;
        }
        return `${route.findings} ${FIX_READBACK_SUFFIX}`;
      case "soft-cap":
        return route.message;
    }
  }
}
