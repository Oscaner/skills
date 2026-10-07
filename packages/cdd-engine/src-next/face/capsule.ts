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
// table (`none` / the next group key / the re-review ref / the fix findings input
// with its readback suffix / the soft-cap message verbatim — only present facts
// land; the route-borne prose — the readback suffix · the soft-cap message — rides
// declared constants from session/next.ts, rendered by reference, never restated).
//
// The class satisfies the session/run.ts CapsuleFace seam (T8's interaction point) —
// the capsule plugs into the lifecycle's attachCapsule contact, byte-identically.
// Module-level exports are the class — zero behavior-carrying bare functions.

import { FIX_READBACK_SUFFIX, type Route } from "../session/next.ts";
import type { CapsuleKey, Words } from "./words.ts";

/**
 * Capsule — the single capsule output face. emit(status, blocker, handoff, next)
 * renders one round's facts into the byte-pinned `status · blocker · handoff` line
 * plus the optional `next:` line. The key words are the CapsuleKey literals the
 * kind loop renders (pin-enforced by the emit signature); the separator, station
 * and route/status words ride the injected Words instance.
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

  /** emit(status, blocker, handoff, next) → the capsule stdout lines: the pinned
   *  `status · blocker · handoff` capsule line, then the optional `next:` line (a
   *  caller-rendered text or a C5 Route; null/absent → no line). */
  emit(status: string, blocker: string, handoff: string, next?: Route | string | null): string[] {
    const words = this.#words;
    const cells: Record<CapsuleKey, string> = { status, blocker, handoff };
    const capsuleLine = words
      .capsuleKeys()
      .map((kind) => `${kind}: ${cells[kind]}`)
      .join(words.capsuleSeparator());
    const lines = [capsuleLine];
    if (next !== undefined && next !== null) {
      const text = typeof next === "string" ? next : this.#routeText(next);
      lines.push(`${words.station("next")} ${text}`);
    }
    return lines;
  }

  /** The route → `next:` text render — one classifier per C5 route row (only
   *  present facts land: a route without its optional payload renders the bare
   *  classifier). */
  #routeText(route: Route): string {
    const words = this.#words;
    switch (route.kind) {
      case "none":
        return words.routeWord("none");
      case "next-group":
        return route.tasks;
      case "review":
        return `${words.routeWord("review")} ${route.base.slice(0, 7)}`;
      case "fix":
        return route.findings ? `${route.findings} ${FIX_READBACK_SUFFIX}` : words.routeWord("fix");
      case "soft-cap":
        return route.message;
    }
  }
}
