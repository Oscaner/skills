// packages/cdd-engine/src/documents/doctypes/body/doc-body.ts — the DocBody abstract contract
// (P2 T1; plan §T1 · design C1, Criterion ②). The doc-body plane is the projected-shape source for
// the parse/brief shape split the concrete bodies materialize: every concrete body
// (PhaseSpecBody at T2, PlanBody at T3) re-derives the DocType.shape domain and the parse-slice
// regexes from its own two projection members, so the output-schema content and the parse surface
// can never drift apart (the retired shape-domain constants are gone — dead-shell discipline). This
// module establishes the abstract base + the contract types + the SHARED body-plane atoms (the
// escape helper + the canonical `## Constraints` heading its derived regex builds from) — the
// shared surface both concrete bodies read off one module, never re-typed per leaf. The plan-only
// task-brief render surface (renderBrief(task)) is deliberately OFF the abstract contract: the base
// declaring it would force every concrete body — including PhaseSpecBody, which has no task brief —
// to implement a surface it can never use; the PlanBody-side member lands with its class at T3.
//
// TIMELINE — T1 established the base with zero wiring (the docTypeRegistry / SchemaFactory / tokens
// tree untouched, the shape constants in place). T2 lands PhaseSpecBody and the phase-spec
// derivation switch: the registry's spec doc type carries the injected body singleton, tokens.ts
// loads the body leaf, and the shape-domain constant retires. T3 lands PlanBody with the plan-side
// switch. T5 review hardens the shared plane: the `## Constraints` parse heading + the escape atom
// single-source here (the plan and phase-spec bodies projected the same heading regex by hand, and
// the leaf load-order law keeps them off tokens.ts — the atomics live at the body root instead,
// re-exported by tokens.ts for its token-plane consumers). The base's forward contract stays stable
// across both switches.

import type { SchemaShape } from "../../doctype.ts";

/** The doc-body kind identity — the concrete body family's discriminant ("phase-spec" | "plan"). */
export type DocBodyKind = "phase-spec" | "plan";

/** The parse slice-pattern projection contract — the concrete body's single-source parse regexes,
 *  keyed by slice (an index-shaped mapping: the abstract surface presets NO concrete slice keys —
 *  each concrete body declares its own, e.g. the plan side's taskHeadingRe or the phase-spec side's
 *  `## Design` / `### Acceptance criteria` / `## Constraints` heading keys). */
export interface SlicePatternSet {
  [sliceKey: string]: RegExp;
}

// ---- shared body-plane atoms (T5 review hardening — the single-sourcing of the parse head plane) ----

/** Escape a literal string for a regex context — the shared body-plane escaping atom. The concrete
 *  bodies build their parse-slice regexes from literal consts (the drift-proof single source), and
 *  the load-order law keeps the body leaves off tokens.ts — so the atom lives at the body root,
 *  where every body leaf already imports from, and tokens.ts re-exports it for its token-plane
 *  consumers (the engine's one escape implementation, one definition home). */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The shared `## Constraints` heading literal — the single byte-source of the canonical
 *  constraint-section heading across the body plane. Both concrete bodies project a
 *  `constraintsHeading` parse slice (the plan side's Form-A extraction + the phase-spec side's
 *  skeleton assertion); both derive it from this const, so the merge-machine canonical read and the
 *  spec-skeleton heading can never drift apart. */
export const BODY_CONSTRAINTS_HEADING = "## Constraints";

/** The shared Form-A constraint-heading line regex — derived from the literal const above (the
 *  escape keeps surrounding regex context from ever misparsing the literal; the heading const stays
 *  the drift-proof source). Both body leaves spread this same slice into their
 *  `projectSlicePatterns()` sets. */
export const BODY_CONSTRAINTS_HEADING_RE = new RegExp(
  `^${escapeRegExp(BODY_CONSTRAINTS_HEADING)}\\s*$`,
  "m",
);

/** Constructor options for a doc body — the identity kind + the template-prose description. */
export interface DocBodyOpts {
  /** The body's kind identity — the concrete family this body belongs to. */
  kind: DocBodyKind;
  /** The template prose (sample prose single source — a consumer reading the DocBody reads the
   *  authoring way; the concrete bodies inject their own per-type template prose). */
  description: string;
}

/**
 * The abstract doc-body base (P2 T1; plan §T1 · design C1 — Criterion ② class + constructor
 * injection). Each concrete body carries its kind identity + template prose and projects its two
 * derived surfaces: `projectSchemaShape()` re-derives the DocType.shape domain (the T2/T3 shape
 * derivation switch — tokens/SchemaFactory keep reading DocType.shape, which the concrete body
 * now derives from the projection) and `projectSlicePatterns()` the parse slice regexes (the
 * per-type parse single source). Unimplemented projections are a compile-time failure — the
 * abstract contract's existence is itself a test subject (see the colocated doc-body.test.ts).
 */
export abstract class DocBody {
  /** The body's kind identity — the concrete family this body belongs to. */
  readonly kind: DocBodyKind;

  /** The template prose single source — a consumer reading the DocBody reads the authoring way. */
  readonly description: string;

  constructor(opts: DocBodyOpts) {
    this.kind = opts.kind;
    this.description = opts.description;
  }

  /** The shape-domain derivation source — re-derives the DocType.shape content this body serves
   *  (the concrete bodies at T2/T3; the tokens/SchemaFactory DocType.shape reading face is
   *  unchanged). */
  abstract projectSchemaShape(): SchemaShape;

  /** The parse slice-pattern single source — every parse regex this body's document shape
   *  recognizes, keyed per concrete body (no preset keys on the abstract face). */
  abstract projectSlicePatterns(): SlicePatternSet;
}
