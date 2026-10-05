// packages/cdd-engine/src/documents/doctypes/body/doc-body.ts — the DocBody abstract contract
// (P2 T1; plan §T1 · design C1, Criterion ②). The doc-body plane is the projected-shape source for
// the parse/brief shape split the T2/T3 concrete bodies materialize: every concrete body
// (PhaseSpecBody / PlanBody — the old shapes/ phase-spec.ts / plan.ts constants retire into them)
// re-derives the DocType.shape domain and the parse-slice regexes from its own two projection
// members, so the output-schema content and the parse surface can never drift apart. This module
// establishes the abstract base + the contract types ONLY — the concrete bodies land at T2/T3 as
// full classes (dead-shell discipline: no empty placeholder classes). The plan-only task-brief
// render surface (renderBrief(task)) is deliberately OFF the abstract contract: the base declaring
// it would force every concrete body — including PhaseSpecBody, which has no task brief — to
// implement a surface it can never use; the PlanBody-side member lands with its class at T3.
//
// TIMELINE — T1 is pure-new-module (zero wiring): the docTypeRegistry / SchemaFactory / tokens /
// doctypes tree is untouched, the shape constants stay in place, and tokens/SchemaFactory keep
// reading DocType.shape until T2/T3 switch the derivation to projectSchemaShape().

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
