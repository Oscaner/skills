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
// table as a COMPLETE EXECUTABLE command (P4.1 T4 — the v1.39 semantic-literal
// reversal): `implement --plan <path> --tasks 17` · `review --type spec --spec
// <path>` · `fix --type spec --spec <path> --findings <handoff> (read file back to
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
// The class satisfies the session/run.ts CapsuleFace seam (T8's interaction point) —
// the capsule plugs into the lifecycle's attachCapsule contact, byte-identically.
// Module-level exports are the class — zero behavior-carrying bare functions.

import type { RouteTarget } from "../session/faces.ts";
import { FIX_READBACK_SUFFIX, type Route } from "../session/next.ts";
import type { CapsuleKey, Words } from "./words.ts";

/** The argv-channel flag row the capsule's render reads (structural — the engine's
 *  channel rows carry the `flag` spelling; the default `--<key>` covers a row-less
 *  key so the render never hard-codes a spelling). */
export interface CapsuleChannelRow {
  flag?: string;
}

/**
 * Capsule — the single capsule output face. emit(status, blocker, handoff, next)
 * renders one round's facts into the byte-pinned `status · blocker · handoff` line
 * plus the optional `next:` line. The key words are the CapsuleKey literals the
 * kind loop renders (pin-enforced by the emit signature); the separator, station
 * and route/status words ride the injected Words instance. The complete executable
 * `next:` literal composes its full argv from the route + the additive optional
 * RouteTarget (the frame's own facts) through the argv-channel flag spellings
 * (P4.1 T4; same channel source parse reads — the 4-param signature stays
 * byte-pinned, the target is an optional 5th, the channel an optional 2nd).
 */
export class Capsule {
  /** The single word table — the capsule's whole vocabulary source. */
  readonly #words: Words;
  /** The argv-channel flag spellings — the declared render source (parse's own). */
  readonly #channels: Readonly<Record<string, CapsuleChannelRow>>;

  constructor(words: Words, channels: Readonly<Record<string, CapsuleChannelRow>> = {}) {
    this.#words = words;
    this.#channels = channels;
  }

  /** The word table this capsule reads from (the single-source face). */
  words(): Words {
    return this.#words;
  }

  /** emit(status, blocker, handoff, next, target) → the capsule stdout lines: the
   *  pinned `status · blocker · handoff` capsule line, then the optional `next:`
   *  line (a caller-rendered text, a C5 Route rendered as the complete executable
   *  command, or null/absent → no line). The additive optional RouteTarget supplies
   *  the frame's own type + id + plan for the executable literal (P4.1 T4); without
   *  it the route renders its bare classifier fallbacks (the 4-param signature stays
   *  byte-pinned). */
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

  /** The declared flag spelling of one channel key — the argv channel the CLI parse
   *  itself resolves (never a hard-coded format string; `--<key>` for a row-less key). */
  #flag(key: string): string {
    return this.#channels[key]?.flag ?? `--${key}`;
  }

  /** The plan path of the literal — the frame's plan fact (the implement literal's
   *  required `--plan`), the `<plan>` placeholder when the fact is absent (the bare
   *  fallback face — the mirror of the crash-resume's `<plan>` seed). */
  #planOf(target?: RouteTarget | null): string {
    return target?.plan ?? "<plan>";
  }

  /** The route → `next:` text render — one complete executable command per C5 route
   *  row (P4.1 T4): `implement --plan <path> --tasks 17` for a ready wave ·
   *  `review --type <wave|spec|plan|branch> <type-arg>` for a review hop ·
   *  `fix --type <type> <type-arg> --findings <path> (read file back to confirm)`
   *  for the one-way fix hop · `done` as the bare terminal word · the soft-cap
   *  message verbatim. `--type` renders only where the verb's type discriminates —
   *  implement (the single-type wave verb) never carries it (the declaration's
   *  default-type semantics unchanged) · review/fix (multi-type) always do. The
   *  target identity is the dispatch frame's own facts (never a router judgment);
   *  absent → the bare classifier fallbacks. */
  #routeText(route: Route, target?: RouteTarget | null): string {
    const words = this.#words;
    switch (route.kind) {
      case "done":
        return words.routeWord("done");
      case "next-wave":
        return `${words.routeWord("implement")} ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("tasks")} ${route.tasks}`;
      case "review": {
        const verb = words.routeWord("review");
        const type = target?.type ?? null;
        if (type === "wave") {
          return `${verb} ${this.#flag("type")} wave ${this.#flag("tasks")} ${target!.id}`;
        }
        if (type === "spec") {
          return `${verb} ${this.#flag("type")} spec ${this.#flag("spec")} ${target!.id}`;
        }
        if (type === "plan") {
          return `${verb} ${this.#flag("type")} plan ${this.#flag("plan")} ${target!.id}`;
        }
        if (type === "branch") {
          return `${verb} ${this.#flag("type")} branch ${this.#flag("base")} ${route.base}`;
        }
        return verb;
      }
      case "fix": {
        if (route.findings === undefined) return words.routeWord("fix");
        const verb = words.routeWord("fix");
        const type = target?.type ?? null;
        const id = target?.id ?? "";
        if (type === "wave") {
          return `${verb} ${this.#flag("type")} wave ${this.#flag("tasks")} ${id} ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("findings")} ${route.findings} ${FIX_READBACK_SUFFIX}`;
        }
        if (type === "spec") {
          return `${verb} ${this.#flag("type")} spec ${this.#flag("spec")} ${id} ${this.#flag("findings")} ${route.findings} ${FIX_READBACK_SUFFIX}`;
        }
        if (type === "plan") {
          return `${verb} ${this.#flag("type")} plan ${this.#flag("plan")} ${id} ${this.#flag("findings")} ${route.findings} ${FIX_READBACK_SUFFIX}`;
        }
        if (type === "branch") {
          return `${verb} ${this.#flag("type")} branch ${this.#flag("findings")} ${route.findings} ${FIX_READBACK_SUFFIX}`;
        }
        return `${verb} ${this.#flag("findings")} ${route.findings} ${FIX_READBACK_SUFFIX}`;
      }
      case "soft-cap":
        return route.message;
    }
  }
}
