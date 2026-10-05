// packages/cdd-engine/src/documents/doctypes/body-views.ts — the bodyView domain content (P1 T5;
// plan §T5 · design C1/Q5 — the template-contract split surface migrates into DocType.bodyView).
// The per-type body-form discrimination + review-config faces: the `reviews.{spec,plan}` blocks
// (axesGuide/lensEnum/ref) and the DOCS_FORMATS member set (["RETURN_JSON","DOCS_FIX"]) leave the
// template-contract render plane and land here as the three doc types' bodyView values — TemplateLoader
// re-reads them through the registry (spec/plan review config + the shell-family discrimination,
// S7). The values are the migrated template-contract content verbatim (the render-equivalence
// contract: reviewTypeConfig(spec/plan) answers exactly what the removed reviews.spec/plan blocks
// carried). Export face: named content consts (Criterion ② — no bare functions).
import type { BodyViewDocFamily, BodyViewSpec } from "../doctype.ts";

/** The docs-family shared value — the migrated DOCS_FORMATS member set ("RETURN_JSON" · "DOCS_FIX").
 *  Single object shared by reference across the spec/plan body views (single-source, no duplication —
 *  the T5 analog of the T4 DOC_WORDS shared-reference precedent). */
export const DOCS_FAMILY: BodyViewDocFamily = {
  label: "docs",
  formats: ["RETURN_JSON", "DOCS_FIX"],
};

/** The overall's body view — the chain root has no body forms (zero discriminating formats, the
 *  familyFor fallback label) and no routed review face (reviews null). */
export const OVERALL_BODY_VIEW: BodyViewSpec = {
  docFamily: { label: "task", formats: [] },
  reviews: null,
};

/** The phase-spec's body view — the docs-family body forms (RETURN_JSON · DOCS_FIX — the migrated
 *  DOCS_FORMATS member set) + the spec review config (the migrated reviews.spec content). */
export const SPEC_BODY_VIEW: BodyViewSpec = {
  docFamily: DOCS_FAMILY,
  reviews: {
    lensEnum: ["completeness", "consistency", "clarity"],
    ref: "doc vs spec",
    axesGuide:
      "Follow URC: single-cycle; lens-tag every finding (completeness / consistency / clarity) + Scope axis (changed-surface reasonableness): the doc edits under review must track the reviewed findings — edits beyond them (or beyond the brief seam) are candidate findings",
  },
};

/** The plan's body view — the docs-family body forms (RETURN_JSON · DOCS_FIX) + the plan review
 *  config (the migrated reviews.plan content). */
export const PLAN_BODY_VIEW: BodyViewSpec = {
  docFamily: DOCS_FAMILY,
  reviews: {
    lensEnum: ["completeness", "decomposition", "buildability"],
    ref: "doc vs spec",
    axesGuide:
      "Follow URC: spec coverage (completeness) / task boundaries + interfaces (decomposition — the typed `interface{consumes,produces}` slices) / type consistency + placeholder scan (buildability) + Scope axis (changed-surface reasonableness): the doc edits under review must track the reviewed findings — edits beyond them (or beyond the brief seam) are candidate findings",
  },
};
