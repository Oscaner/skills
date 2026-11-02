// packages/cdd-engine/src-next/face/route-render.ts
// D40 — the ONE route → `next:` literal renderer (the shared render point): both
// the Capsule (a round's own line) and the board (a line's frontier) render the
// exact same Route into the exact same literal through this single class, so the
// board's `next:` and the engine's `next:` are byte-identical by construction
// (the retired board `#entryText` / capsule `#doneText` pair — one renderer now).
//
//   · an active C5 hop (`implement` / `review` / `fix` / `soft-cap`) renders the
//     complete executable argv composed from the frame facts (the RouteTarget's
//     type + id + plan) through the argv-channel flag spellings — the same channel
//     the CLI parse reads (never a second hard-coded format string);
//   · the face-to-face `handoff` renders the pipeline entry: a `ref` fills the
//     declared instruction phrase (`route to {ref} skill`) with REFS[ref][host]
//     (the `""` host falls back to the claude form — never a bare plugin guess), a
//     `literal` fills its `<plan>` slot, a `done` entry the bare terminal word;
//   · the bare `done` is the terminal word (its no-target face).
//
// The route-borne prose (the fix readback suffix · the soft-cap message) rides
// declared constants from session/next.ts, rendered by reference, never restated.
// Module-level exports are the class — zero behavior-carrying bare functions.

import type { RepoRoot } from "../infra/root.ts";
import type { RouteTarget } from "../session/faces.ts";
import { FIX_READBACK_SUFFIX, NEXT_HOP_REASON, type NextHop, type Route } from "../session/next.ts";
import { REFS } from "./host.ts";
import type { Words } from "./words.ts";

/** The argv-channel flag row the renderer reads (structural — the engine's channel
 *  rows carry the `flag` spelling; the default `--<key>` covers a row-less key so the
 *  render never hard-codes a spelling). */
export interface RouteChannelRow {
  flag?: string;
}

/**
 * RouteRenderer — the single route → `next:` literal face (D40). One instance holds
 * the render facts the literal needs (the word table · the argv-channel spellings ·
 * the host harness id); render() turns a Route (+ the frame's own RouteTarget) into
 * the `next:` value. The Capsule and the board both delegate here — no second
 * renderer.
 */
export class RouteRenderer {
  /** The single word table — the literal's whole vocabulary source. */
  readonly #words: Words;
  /** The argv-channel flag spellings — the declared render source (parse's own). */
  readonly #channels: Readonly<Record<string, RouteChannelRow>>;
  /** The host harness id — the skill-ref resolution key of the handoff/`done`
   *  pipeline lookup (REFS[ref][host]; `""` falls back to the claude form). */
  readonly #host: string;
  /** The repo-basis value object the literal's embedded path values normalize
   *  through (T1 `RepoRoot` · D47) — the ONE conversion exit; `null` (the
   *  hermetic-test default) passes values through unchanged. */
  readonly #root: RepoRoot | null;

  constructor(
    words: Words,
    channels: Readonly<Record<string, RouteChannelRow>> = {},
    host = "",
    root: RepoRoot | null = null,
  ) {
    this.#words = words;
    this.#channels = channels;
    this.#host = host;
    this.#root = root;
  }

  /** One embedded path value in the literal — normalized to the repoRoot-relative
   *  shape through the ONE value object (D47 · the ONE basis; a `null` root — the
   *  hermetic default — short-circuits). Every `--plan`/`--reviews`/doc-id in the
   *  rendered argv passes through here, so the board's `next:` and the engine's
   *  `next:` are byte-identical by construction. */
  #rel(value: string): string {
    return this.#root === null ? value : this.#root.relativize(value);
  }

  /** renderHop(hop) → the `next:` VALUE of one derived NextHop (§5.2), or null when
   *  the hop is ABSENT (the failure face — a BLOCKED / TIMEOUT round holds no next
   *  object at all, so no `next:` line renders). The ONE hop face both read faces
   *  share: the capsule (a round's own line) and the board (the pipeline frontier)
   *  render the SAME object into the SAME bytes. The row order is the frozen table:
   *    · a `soft-cap` payload renders its declared suggestion verbatim;
   *    · an in-line hop renders the route through `render` (a `hop` is never null on
   *      a renderable payload route — the closure kinds carry no hop);
   *    · a face-to-face station renders the entry through the same `render`;
   *    · an unjudgeable doc class renders the BLOCKED face;
   *    · the residual (the bare `done` / `face-closed` row) renders the terminal word.
   *  A `null` hop is NOT the failure-face gate: `done` / `soft-cap` / the doc-class
   *  `terminal` row all carry `hop: null` yet still print their line. */
  renderHop(hop: NextHop | null): string | null {
    if (hop === null) return null;
    if (hop.route?.kind === "soft-cap") return hop.route.message;
    if (hop.hop !== null && hop.route !== null) return this.render(hop.route, hop.target);
    if (hop.to !== null) return this.render({ kind: "handoff", entry: hop.to }, hop.target);
    if (hop.reason === NEXT_HOP_REASON.docClassBlocked) {
      return `${this.#words.station("blocked")} ${this.#words.routeWord("docType")}`;
    }
    return this.#words.routeWord("done");
  }

  /** render(route, target) → the `next:` value: the complete executable command (a
   *  C5 hop), the pipeline entry (a `handoff`), or the bare terminal word (`done`).
   *  The additive optional RouteTarget supplies the frame's own type + id + plan for
   *  the executable literal; without it the route renders its bare classifier
   *  fallbacks. */
  render(route: Route, target?: RouteTarget | null): string {
    switch (route.kind) {
      case "done":
        return this.#words.routeWord("done");
      case "handoff":
        return this.#handoffText(route, target);
      case "next-wave":
        return `${this.#words.routeWord("implement")} ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("tasks")} ${route.tasks}`;
      case "review":
        return this.#reviewText(target);
      case "fix":
        return this.#fixText(route, target);
      case "soft-cap":
        return route.message;
    }
  }

  /** The declared flag spelling of one channel key — the argv channel the CLI parse
   *  itself resolves (never a hard-coded format string; `--<key>` for a row-less key). */
  #flag(key: string): string {
    return this.#channels[key]?.flag ?? `--${key}`;
  }

  /** The plan path of the literal — the frame's plan fact (the implement literal's
   *  required `--plan`), normalized to the repoRoot-relative shape (D47); the
   *  `<plan>` placeholder when the fact is absent (the bare fallback face — the
   *  mirror of the crash-resume's `<plan>` seed). */
  #planOf(target?: RouteTarget | null): string {
    return target?.plan === undefined ? "<plan>" : this.#rel(target.plan);
  }

  /** The review hop's literal — `review --type <wave|branch|phase-spec|overall|plan|single-spec>
   *  <type-arg>` (`--type` renders only where the verb's type discriminates — review/fix
   *  are multi-type, so they always carry it; absent target → the bare verb). The four
   *  doc shapes ride the retained `--spec` flag (the document under review). */
  #reviewText(target?: RouteTarget | null): string {
    const verb = this.#words.routeWord("review");
    const type = target?.type ?? null;
    if (type === "wave") {
      // The wave review literal carries its runtime-required `--plan` — the same
      // assembly the implement/next-wave and fix→wave branches share (a missing flag
      // parses green yet refuses the dispatch at run time).
      return `${verb} ${this.#flag("type")} wave ${this.#flag("tasks")} ${target!.id} ${this.#flag("plan")} ${this.#planOf(target)}`;
    }
    if (type === "plan") {
      return `${verb} ${this.#flag("type")} plan ${this.#flag("plan")} ${this.#rel(target!.id)}`;
    }
    if (type === "branch") {
      // The branch re-review literal carries only the workspace-identity `--plan` —
      // the review judges the live tree, so no range rides the command (the scope
      // anchor BASE_BRANCH is engine-injected at dispatch).
      return `${verb} ${this.#flag("type")} branch ${this.#flag("plan")} ${this.#planOf(target)}`;
    }
    if (type === null) return verb;
    // phase-spec · overall · single-spec — the declared shapes ride `--spec`.
    return `${verb} ${this.#flag("type")} ${type} ${this.#flag("spec")} ${this.#rel(target!.id)}`;
  }

  /** The one-way fix hop's literal — `fix --type <type> <type-arg> --reviews <path>
   *  <readback>` (the readback suffix the declared constant, rendered by reference).
   *  Every embedded path value (the doc-id for the doc shapes · `--reviews`)
   *  is normalized to the repoRoot-relative shape (D47); the wave face's `<type-arg>`
   *  is a task key, not a path — passed through as-is. */
  #fixText(route: Extract<Route, { kind: "fix" }>, target?: RouteTarget | null): string {
    if (route.reviews === undefined) return this.#words.routeWord("fix");
    const verb = this.#words.routeWord("fix");
    const type = target?.type ?? null;
    const id = target?.id ?? "";
    const reviews = this.#rel(route.reviews);
    if (type === "wave") {
      return `${verb} ${this.#flag("type")} wave ${this.#flag("tasks")} ${id} ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("reviews")} ${reviews} ${FIX_READBACK_SUFFIX}`;
    }
    if (type === "plan") {
      return `${verb} ${this.#flag("type")} plan ${this.#flag("plan")} ${this.#rel(id)} ${this.#flag("reviews")} ${reviews} ${FIX_READBACK_SUFFIX}`;
    }
    if (type === "branch") {
      // The branch fix literal carries the workspace-identity `--plan` (isomorphic
      // with the wave fix branch — a plan-less target resolves to the empty
      // ref.short() directory, the workspace double identity).
      return `${verb} ${this.#flag("type")} branch ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("reviews")} ${reviews} ${FIX_READBACK_SUFFIX}`;
    }
    if (type === null) return `${verb} ${this.#flag("reviews")} ${reviews} ${FIX_READBACK_SUFFIX}`;
    // phase-spec · overall · single-spec — the declared shapes ride `--spec`.
    return `${verb} ${this.#flag("type")} ${type} ${this.#flag("spec")} ${this.#rel(id)} ${this.#flag("reviews")} ${reviews} ${FIX_READBACK_SUFFIX}`;
  }

  /** The face-to-face handoff render — the pipeline entry: a `ref` fills the declared
   *  instruction phrase (`route to {ref} skill`, the word table's `handoffRef` row)
   *  with REFS[ref][host] (the `""` host falls back to the claude form), a `literal`
   *  fills its `<plan>` slot with the frame's plan fact, a `done` entry renders the
   *  bare word. Never a hard-coded plugin spelling. */
  #handoffText(route: Extract<Route, { kind: "handoff" }>, target?: RouteTarget | null): string {
    const entry = route.entry;
    if (entry.kind === "done") return this.#words.routeWord("done");
    if (entry.kind === "literal") return entry.literal.replace("<plan>", this.#planOf(target));
    // The ref table read over a dynamic ref key — the local's shape (`string → per-host
    // form`) is the HostReferenceTable contract, so the lookup needs no key cast.
    const table: Readonly<
      Record<string, Readonly<Record<string, string | undefined>> | undefined>
    > = REFS;
    const row = table[entry.ref];
    const form = row === undefined ? undefined : (row[this.#host] ?? row.claude);
    if (form === undefined) return this.#words.routeWord("done");
    return this.#words.handoffRefWord(form);
  }
}
