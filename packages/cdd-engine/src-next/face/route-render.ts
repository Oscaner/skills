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
//   · the face-to-face `handoff` renders the pipeline entry: a `ref` resolves
//     REFS[ref][host] (the `""` host falls back to the claude form — never a bare
//     plugin guess), a `literal` fills its `<plan>` slot, a `done` entry the bare
//     terminal word;
//   · the bare `done` is the terminal word (its no-target face).
//
// The route-borne prose (the fix readback suffix · the soft-cap message) rides
// declared constants from session/next.ts, rendered by reference, never restated.
// Module-level exports are the class — zero behavior-carrying bare functions.

import { WorkspaceRoot } from "../infra/workspace.ts";
import type { RouteTarget } from "../session/faces.ts";
import { FIX_READBACK_SUFFIX, type Route } from "../session/next.ts";
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
  /** The repo root the literal's embedded path values are normalized against —
   *  `--plan`/`--findings`/doc-id render repoRoot-relative (D47 · the ONE shape);
   *  `""` (the hermetic-test default) passes values through unchanged. */
  readonly #repoRoot: string;

  constructor(
    words: Words,
    channels: Readonly<Record<string, RouteChannelRow>> = {},
    host = "",
    repoRoot = "",
  ) {
    this.#words = words;
    this.#channels = channels;
    this.#host = host;
    this.#repoRoot = repoRoot;
  }

  /** One embedded path value in the literal — normalized to the repoRoot-relative
   *  shape (D47 · the ONE basis; `""` short-circuits). Every `--plan`/`--findings`/
   *  doc-id in the rendered argv passes through here, so the board's `next:` and the
   *  engine's `next:` are byte-identical by construction. */
  #rel(value: string): string {
    return WorkspaceRoot.relativize(this.#repoRoot, value);
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

  /** The review hop's literal — `review --type <wave|spec|plan|branch> <type-arg>`
   *  (`--type` renders only where the verb's type discriminates — review/fix are
   *  multi-type, so they always carry it; absent target → the bare verb). */
  #reviewText(target?: RouteTarget | null): string {
    const verb = this.#words.routeWord("review");
    const type = target?.type ?? null;
    if (type === "wave") {
      // The wave review literal carries its runtime-required `--plan` — the same
      // assembly the implement/next-wave and fix→wave branches share (a missing flag
      // parses green yet refuses the dispatch at run time).
      return `${verb} ${this.#flag("type")} wave ${this.#flag("tasks")} ${target!.id} ${this.#flag("plan")} ${this.#planOf(target)}`;
    }
    if (type === "spec") {
      return `${verb} ${this.#flag("type")} spec ${this.#flag("spec")} ${this.#rel(target!.id)}`;
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
    return verb;
  }

  /** The one-way fix hop's literal — `fix --type <type> <type-arg> --findings <path>
   *  <readback>` (the readback suffix the declared constant, rendered by reference).
   *  Every embedded path value (the doc-id for the spec/plan faces · `--findings`)
   *  is normalized to the repoRoot-relative shape (D47); the wave face's `<type-arg>`
   *  is a task key, not a path — passed through as-is. */
  #fixText(route: Extract<Route, { kind: "fix" }>, target?: RouteTarget | null): string {
    if (route.findings === undefined) return this.#words.routeWord("fix");
    const verb = this.#words.routeWord("fix");
    const type = target?.type ?? null;
    const id = target?.id ?? "";
    const findings = this.#rel(route.findings);
    if (type === "wave") {
      return `${verb} ${this.#flag("type")} wave ${this.#flag("tasks")} ${id} ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("findings")} ${findings} ${FIX_READBACK_SUFFIX}`;
    }
    if (type === "spec") {
      return `${verb} ${this.#flag("type")} spec ${this.#flag("spec")} ${this.#rel(id)} ${this.#flag("findings")} ${findings} ${FIX_READBACK_SUFFIX}`;
    }
    if (type === "plan") {
      return `${verb} ${this.#flag("type")} plan ${this.#flag("plan")} ${this.#rel(id)} ${this.#flag("findings")} ${findings} ${FIX_READBACK_SUFFIX}`;
    }
    if (type === "branch") {
      // The branch fix literal carries the workspace-identity `--plan` (isomorphic
      // with the wave fix branch — a plan-less target resolves to the empty
      // ref.short() directory, the workspace double identity).
      return `${verb} ${this.#flag("type")} branch ${this.#flag("plan")} ${this.#planOf(target)} ${this.#flag("findings")} ${findings} ${FIX_READBACK_SUFFIX}`;
    }
    return `${verb} ${this.#flag("findings")} ${findings} ${FIX_READBACK_SUFFIX}`;
  }

  /** The face-to-face handoff render — the pipeline entry: a `ref` resolves
   *  REFS[ref][host] (the `""` host falls back to the claude form), a `literal`
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
    if (row === undefined) return this.#words.routeWord("done");
    return row[this.#host] ?? row.claude ?? this.#words.routeWord("done");
  }
}
