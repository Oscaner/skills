// packages/cdd-engine/src/rules/documents.ts — DocumentsValidator facade (P1 T2 · DocType
// convergence S2/S3). The per-doc-type contract/parse logic has migrated INTO the three doc types
// (documents/doctypes/{overall,plan,phase-spec}.ts — the S2 convergence); THIS file is the
// DocumentsValidator service facade that keeps the public audit/extractor surface byte-identical
// for its consumers (closeout / dispatch / status) by delegating every per-type judgment to the
// doc-type registry:
//
//   validateDispatchDocuments — the single audit entry → docTypeRegistry.resolve(kind).validate
//                               (kind detected through the registry — the S1 detection scan).
//   parentOverallOf           — resolve(kind).parentChain (the S3 parent walk per doc type).
//   detectDocKind             — the registry-scan doc-kind determination (S1 — the retired
//                               per-kind handwritten scan's replacement; validateDispatchDocuments /
//                               parentOverallOf route through it).
//   parseOverall / contract validators / plan extractors / phase-id resolution — the doc types'
//   per-type instance methods (zero per-type big function bodies remain in this file).
//
// Cross-type atoms the facade still surfaces (isPendingText / isInflightText / extractClaimRows)
// come from the shared doctype layer. The overall four-table audit + claim machinery + plan/overall
// contract helpers are gone from this file — they live in the doctype modules (grep-verifiable)
// and were never hand-edited here.
//
// The failure surface is the converged `DocValidateFailure` identity (the rules side aliases it
// under the old `DocValidationFailure` name — the T2 type convergence).
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DocKind, DocValidateFailure } from "../documents/doctype.ts";
import { specConstraintsOf as mergedSpecConstraintsOf } from "../documents/doctypes/body/constraints.ts";
import type { OverallDocType, OverallParse } from "../documents/doctypes/overall.ts";
import type { PhaseSpecDocType } from "../documents/doctypes/phase-spec.ts";
import type { PlanDocType } from "../documents/doctypes/plan.ts";
import type { ClaimExtraction } from "../documents/doctypes/shared.ts";
import {
  extractClaimRows as historyClaimsOf,
  isInflightText as inflightTextOf,
  isPendingText as pendingTextOf,
} from "../documents/doctypes/shared.ts";
import { docTypeRegistry } from "../documents/registry.ts";
import type { TaskGroup } from "../domain/task-group.ts";

// The type surface the facade still owns (options + converged failure + the parse/claim shapes the
// doctype modules now define — re-exported under the historical names so consumers never move).
export type { OverallParse, PhaseRow } from "../documents/doctypes/overall.ts";
export type { ClaimDeclarationTrace, ClaimExtraction } from "../documents/doctypes/shared.ts";

/** The doc-contract failure surface — the P1 T2 convergence: the doc types emit the canonical
 *  `DocValidateFailure` identity; this alias keeps the historical export name for the rules-side
 *  consumers (closeout / dispatch / status). */
export type DocValidationFailure = DocValidateFailure;

export interface DocValidationOptions {
  /** the audit entry point — a **plan** path (task / branch lanes + docs-lane plan review), a
   *  **design spec** path (docs-lane spec review) or an **overall** path (docs-lane self-audit);
   *  the doc-type dispatch happens here (no caller-supplied type). */
  entry: string;
  /** git workspace root the doc chain resolves against (repo-root-form link targets). */
  root: string;
}

// Doc-type detection for the entry point (lane-declared audit target, S1/T6 — the retired
// per-kind handwritten scan): the registered doc types' detect surfaces are iterated in the fixed
// overall → plan → spec order (docTypeRegistry.all()). Exactly ONE matching type resolves its kind;
// multiple matches are an ambiguous entry (the dispatch is never a silent first-hit — the author
// must disambiguate); zero matches are an unknown doc kind (fail-fast throw with the entry text —
// the retired `return "spec"` fallback that silently selected spec is gone: spec selection is never
// implicit, spec 2.6). Same fail-fast shape as `resolve(kind)`'s unknown-kind throw.
//
// The zero-hit throw is a TYPED error (UnknownDocKindError) — the dispatch fail-open lane
// (dispatch/base.ts docContractValidate) distinguishes this readable-but-unclassifiable case from a
// genuinely unreadable chain by `instanceof`, so the skip-warn never mislabels it "unreadable".
export class UnknownDocKindError extends Error {}

function detectEntryKind(filePath: string): DocKind {
  const content = readFileSync(filePath, "utf8");
  const hits = docTypeRegistry.all().filter((t) => t.detect(path.basename(filePath), content));
  if (hits.length > 1) {
    const kinds = hits.map((t) => t.kind).join(", ");
    throw new Error(
      `ambiguous doc kind for entry ${filePath} — multiple registered doc types detect (${kinds}); the doc-kind dispatch is registry single-match`,
    );
  }
  if (hits.length === 0) {
    throw new UnknownDocKindError(
      `unknown doc kind for entry ${filePath} — no registered doc type (overall/plan/spec) detects; the spec fallback is retired (spec selection is never implicit)`,
    );
  }
  return hits[0].kind;
}

// The per-kind registry accessors — every delegation below routes through the doc-type singleton
// (the S2 convergence entry; the doc types compose their chains through the same registry).
const overallType = (): OverallDocType => docTypeRegistry.resolve("overall") as OverallDocType;
const planType = (): PlanDocType => docTypeRegistry.resolve("plan") as PlanDocType;
const specType = (): PhaseSpecDocType => docTypeRegistry.resolve("spec") as PhaseSpecDocType;

/** DocumentsValidator — the single doc-chain audit entry facade (Criterion ②; every judgment below
 *  delegates to the registered doc-type home — zero per-type function bodies remain in this class).
 */
export class DocumentsValidator {
  // ---- plan parsing (canonical extractors — delegated to the plan doc type) ----

  /** Plan-cell state recognition (the three-state machine, P4.3 Task 8 #274) — the shared doctype
   *  atom under the historical public name. */
  isPendingText(v: string): boolean {
    return pendingTextOf(v);
  }

  isInflightText(v: string): boolean {
    return inflightTextOf(v);
  }

  /** Task-heading scan (`^### Task N:` → numeric sort; tolerant titles after the colon are kept) —
   *  delegated to the plan doc type (the canonical extractor's home). */
  taskNumbersFromPlan(planFile: string): number[] {
    return planType().taskNumbersFromPlan(planFile);
  }

  /** Task-Groups section parse — delegated to the plan doc type (the canonical extractor's home). */
  taskGroupsFromPlan(planFile: string): TaskGroup[] {
    return planType().taskGroupsFromPlan(planFile);
  }

  /** effectiveGroups(planPath) — the SINGLE dispatch-group derivation — delegated to the plan doc
   *  type (the iteration surfaces consume this one derivation, no second implementation). */
  effectiveGroups(planPath: string): TaskGroup[] {
    return planType().effectiveGroups(planPath);
  }

  /** Deterministic extraction from the plan's declared Constraints source (Form A / legacy Form B)
   *  — delegated to the plan doc type (the canonical extractor's home). */
  extractPlanConstraints(planContent: string): string | null {
    return planType().extractPlanConstraints(planContent);
  }

  /** The plan's merged constraints read (design C4 — the plan side of the delta-only inheritance
   *  machine) — delegated to the plan doc type: the plan's Form-A `## Constraints` delta joined
   *  with the parent overall's conventions (the constitution auto-applies); legacy Form B reads
   *  unchanged. */
  planConstraintsOf(planPath: string, root: string): string | null {
    return planType().planConstraintsOf(planPath, root);
  }

  /** The phase-spec's merged constraints read (design C4 — the spec side) — the spec's `##
   *  Constraints` delta joined with the parent overall's conventions along the Class-B `**Parent
   *  program**` chain (the spec-parse single consumption face; legacy six-section specs → null). */
  specConstraintsOf(entry: string, root: string): string | null {
    return mergedSpecConstraintsOf(entry, root);
  }

  /** plan contract: `### Task N:` continuous extractability · `**Spec:**` exists + resolves ·
   *  constraints source declaration extractable · no placeholders — delegated to the plan doc type. */
  validatePlanContract(planPath: string): DocValidationFailure[] {
    return planType().validatePlanContract(planPath);
  }

  /** phaseIdFromPlan(planPath) — the basename-scan phase id — delegated to the plan doc type. */
  phaseIdFromPlan(planPath: string): string | null {
    return planType().phaseIdFromPlan(planPath);
  }

  /** phaseIdForDispatch(planPath, root) — the dispatch phase id resolved through the canonical
   *  chain — delegated to the plan doc type. */
  phaseIdForDispatch(planPath: string, root: string): string | null {
    return planType().phaseIdForDispatch(planPath, root);
  }

  /** parseOverall — the canonical four-table parse (single source; exported for the closeout
   *  mismatch module — P2 ④) — delegated to the overall doc type's ctx-free parse surface (the
   *  overall parse never consumes a DocContext — the chain root carries no phase/pin tokens — so
   *  the delegation passes no synthesized context). */
  parseOverall(overallPath: string): OverallParse {
    return overallType().parseOverall(overallPath);
  }

  /** The phase-spec doc-type surface: `**Version**` line + Class B → the parent overall's contract
   *  face + four tables — delegated to the phase-spec doc type. */
  validatePhaseSpecContract(
    specPath: string,
    root: string,
    phaseId: string | null,
  ): DocValidationFailure[] {
    return specType().validatePhaseSpecContract(specPath, root, phaseId);
  }

  /** overall contract: canonical header · row-shape guard · change-history + merged version-lineage
   *  + the four-table audit faces ①-⑥ — delegated to the overall doc type. */
  validateOverallContract(
    overallPath: string,
    phaseId: string | null,
    pinnedTokens: string[] = [],
  ): DocValidationFailure[] {
    return overallType().validateOverallContract(overallPath, phaseId, pinnedTokens);
  }

  /** Program slug for the doc-existence globs and the anchor scan — delegated to the overall doc
   *  type (the four-table audit's naming surface). */
  fileNameSlug(overallPath: string): string {
    return overallType().fileNameSlug(overallPath);
  }

  /** Directory listing for the same-slug doc globs — delegated to the overall doc type. */
  mdNames(dir: string): string[] {
    return overallType().mdNames(dir);
  }

  /** detectDocKind(entry) — the registry-scan doc-kind determination (S1, the retired handwritten
   *  scan's replacement): the registered doc types' detect surfaces iterate in the fixed overall →
   *  plan → spec order (docTypeRegistry.all()); exactly one match resolves its kind, multiple
   *  matches throw (ambiguous — the dispatch is never a silent first-hit), zero matches throw
   *  unknown-doc-kind with the entry text (spec selection is never implicit). */
  detectDocKind(entry: string): DocKind {
    return detectEntryKind(entry);
  }

  /** Resolve the CLASS-B parent overall for an audit entry — the doc-type-facing S3 chain walk
   *  (overall → itself; spec → Parent program; plan → `**Spec:**` → Parent program), exposed for
   *  the closeout mismatch module (P2 ④). null → chain truncation. */
  parentOverallOf(entry: string, root: string): string | null {
    return docTypeRegistry.resolve(detectEntryKind(entry)).parentChain(entry, root);
  }

  /** validateDispatchDocuments — the audit entry: resolve the entry doc's kind through the registry
   *  detection scan (S1 — fail-fast on ambiguous / unknown kinds) and delegate the full audit to the
   *  registered doc type's validate surface — the doc type walks its own chain (plan → `**Spec:**`
   *  spec → the spec's Parent program overall) and every per-type face runs where it is checked in. */
  validateDispatchDocuments(options: DocValidationOptions): DocValidationFailure[] {
    const { entry, root } = options;
    const kind = detectEntryKind(entry);
    return docTypeRegistry.resolve(kind).validate(entry, { root });
  }

  /** formatDocFailures — the operator-facing guidance block: one line per failure with the artifact,
   * file, field, what is missing and how to fix. (Generic formatting — stays on the facade.) */
  formatDocFailures(failures: DocValidationFailure[]): string {
    return failures
      .map((f) => `- [${f.artifact}] ${f.file} — ${f.field}: ${f.missing} → ${f.fix}`)
      .join("\n");
  }

  /** ① Claim extraction (the change-history window scan) — the shared doctype atom under the
   *  historical public name (the declaration set the closeout terminal state merges into, P2 ④). */
  extractClaimRows(historyRows: OverallParse["historyRows"]): ClaimExtraction {
    return historyClaimsOf(historyRows);
  }
}
