// packages/cdd-engine/src-next/contract/context-declarations.ts
// P40 T3 — the round-context DECLARATION surface on the contract plane. The types
// moved here verbatim from `render/templates.ts` (which now imports them back, so the
// declaration table and its one selector stay where they were and zero behaviour
// moved): the pre-flight judgment decides which cells are exigible FROM THE
// DECLARATION, never from a second table of its own, so the declarations it reads must
// live on the plane it is allowed to read. `contract/` importing `render/` would
// invert the direction this extraction exists for.
//
// One resolution entry lives beside the types: `ExigibleCells.resolve` turns a row's
// declarations + the two DECLARED scene facts + the dispatch's type into the cells the
// gate must judge, each with the two-word reason its empty value earns (P38 §1.3 · §2.2).
//
// Module-level exports are types / the classes — zero behavior-carrying bare functions.

import type { TargetType } from "./target-type.ts";

/** The arm shape of one round-context cell's exigibility declaration (P38 §1.1) —
 *  one arm is a type set, optionally narrowed by a structural precondition, and a
 *  cell may hang several CONJUNCTIVE arms: each is judged on its own, and any hit
 *  makes the cell exigible. `types: []` is the `never` spelling — the cell is never
 *  exigible, which is a legal declaration (not a missing one). */
export interface RequiredArm {
  /** The target types this arm covers — `"always"` (the row's whole served set) or a
   *  subset of it; an empty array names no type at all (`never`). */
  readonly types: "always" | readonly TargetType[];
  /** A structural precondition stacked on the same arm (§1.3): the identity document
   *  declared `program:` / its shape (`doc-type:`) — the DECLARATION, never the
   *  resolved value the frame carries. */
  readonly when?: "program" | "identity";
}

/** One round-context line's declaration (P38 §1.1) — the line with its `{{TOKEN}}`
 *  slot plus the facts a caller must be able to read off it. A line without a slot
 *  (the `## Round context` heading, the separator blank line) carries the `never`
 *  form: it has no value to compare, so it is never exigible and never dropped. */
export interface ContextLine {
  /** The rendered line — a heading, a blank line, or a `- \`TOKEN\`: {{TOKEN}}` cell. */
  readonly line: string;
  /** The cell's value names a file that must exist — the ONLY bit `target-absent`
   *  reads (§1.1: read paths are declared, never inferred from an `INPUT_` prefix). */
  readonly path?: true;
  /** What absence looks like away from `requiredOn`: drop the whole line, or render
   *  the bare literal `none`. */
  readonly absent: "drop" | "none";
  /** The types the cell is exigible on — one arm, or several conjunctive arms. */
  readonly requiredOn: readonly RequiredArm[];
  /** The engine writes this cell's file itself before the child reads it (§1: the
   *  brief). The name is the whole answer — no path on an engine-written cell ever
   *  takes an existence read, and `NAMED_BRIEF_CELL` is the ONE slot allowed to say so. */
  readonly written?: "engine";
}

/** The two DECLARED scene facts the `when` arms read (booleans, never the resolved
 *  links): `program` = the identity document declared a `program:`; `docType` = it
 *  declared its shape (`doc-type:`). A declared program whose charter does not
 *  resolve and a program never declared are different facts, and only the
 *  declaration can tell them apart. */
export interface SceneFacts {
  readonly program: boolean;
  readonly docType: boolean;
}

/** One exigible cell's two-word reason set (P38 §2.2) — the closed set this plane
 *  declares once: `empty-value` (required, and the engine supplied nothing) or
 *  `target-absent` (the declared charter did not resolve / the named file is off
 *  disk). A third reason is not representable. */
export type ExigibleReason = "target-absent" | "empty-value";

/** One exigible judgment row — a declared cell resolved against the declarations and
 *  the scene facts. The gate reads this and no longer reads the face. */
export interface ExigibleCell {
  /** The cell's `{{TOKEN}}` — the slot the declaration's line carries. */
  readonly token: string;
  /** Whether the cell's value names a file that must exist (`target-absent` leg). */
  readonly path: true | undefined;
  /** Whether the ENGINE writes this cell's file (zero existence reads, ever). */
  readonly written: "engine" | undefined;
  /** The word this cell's EMPTY value earns — the same closed set the target-absent
   *  existence read uses. */
  readonly reason: ExigibleReason;
}

/** The `{{TOKEN}}` slot grammar — the ONE reader of a declared line's braces. It lives
 *  beside the declaration it reads (the renderer's `TemplateAssembler.slotOf` delegates
 *  here), so the pre-flight gate and the renderer can never disagree about which slot a
 *  line carries. */
// biome-ignore lint/complexity/noStaticOnlyClass: the slot grammar's single reader — the zero-bare-function discipline admits no standalone predicate functions.
export class ContextSlot {
  /** The slot a declared line carries — `undefined` for a value-less line (the
   *  heading, the separator blank line). */
  static of(line: string): string | undefined {
    return /\{\{([A-Z0-9_]+)\}\}/.exec(line)?.[1];
  }
}

/** The exigibility resolution — P38 §1.3's arm parse and §2.2's word choice in ONE
 *  place. The target plane is a DECLARATION PARAMETER: no type table of its own, no
 *  scene object to rummage in, no `session/` import — `always`, a type set and
 *  `never` (`types: []`) are all decided on one plane. */
// biome-ignore lint/complexity/noStaticOnlyClass: the exigibility resolver — the zero-bare-function discipline admits no standalone predicate functions.
export class ExigibleCells {
  /** The cells one row's declarations make exigible on this dispatch, each with the
   *  word its empty value earns. A value-less line is never a cell; a cell whose arms
   *  all miss is not exigible this round. */
  static resolve(
    declarations: readonly ContextLine[],
    scene: SceneFacts,
    type: TargetType,
  ): readonly ExigibleCell[] {
    const cells: ExigibleCell[] = [];
    for (const decl of declarations) {
      const token = ContextSlot.of(decl.line);
      if (token === undefined) continue;
      const hits = decl.requiredOn.filter((arm) => ExigibleCells.#hits(arm, scene, type));
      if (hits.length === 0) continue;
      cells.push({
        token,
        path: decl.path,
        written: decl.written,
        reason: ExigibleCells.#reasonOf(hits),
      });
    }
    return cells;
  }

  /** Whether one declared arm is exigible (§1.3): the type hit plus, when the arm
   *  carries one, its structural precondition — read off the two DECLARED scene facts. */
  static #hits(arm: RequiredArm, scene: SceneFacts, type: TargetType): boolean {
    const typed = arm.types === "always" || arm.types.includes(type);
    if (!typed) return false;
    if (arm.when === "program") return scene.program;
    if (arm.when === "identity") return scene.docType;
    return true;
  }

  /** The reason an exigible cell's EMPTY value earns (§2.2): an arm whose
   *  precondition is the declared `program:` that hit means the charter the declaration
   *  names did not resolve (`target-absent`); every other empty value is the engine's
   *  own omission (`empty-value`). The two `when` legs are told apart by this word
   *  alone. */
  static #reasonOf(hits: readonly RequiredArm[]): ExigibleReason {
    return hits.some((arm) => arm.when === "program") ? "target-absent" : "empty-value";
  }
}
