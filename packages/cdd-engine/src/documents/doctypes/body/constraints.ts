// packages/cdd-engine/src/documents/doctypes/body/constraints.ts — the constraint-inheritance
// delta-only merge machine (P2 T4; plan §T4 · design C4). New-shape docs carry a literal
// `## Constraints` DELTA section — the child declares only its own deltas, the parent overall's
// conventions auto-apply (the inherited constitution). This module is the shared read+merge face
// both doc sides consume:
//
//   - mergeParentConstraints — the pure presentation join (own delta ∪ parent conventions);
//   - specConstraintsOf — the phase-spec's merged read: the spec's `## Constraints` delta + the
//     Class-B `**Parent program**` chain (resolveParentOverall) → the parent overall's constraints
//     → merge; consumed by the spec parse/validate gate;
//   - overallConstraintsOf — the constitutional-block read: the overall's `**Constraints**:` header
//     block, the inherited conventions the plan side joins through the same Class-A/B chain.
//
// The Form-A section extraction lives on the shared doctype atoms (constraintsSectionOf in
// shared.ts — one section semantic for both doc sides; legacy Form B stays plan-side, unchanged).
//
// NOT a load-order-safe body leaf: this module imports the shared doctype atoms (shared.ts →
// tokens.ts). That is safe because nothing on the tokens → body-leaf chain imports it back — the
// leaf doctrine applies to the modules tokens.ts authorizes from (plan-body / phase-spec-body),
// never to an engine-side pull module (the registry → doctypes → tokens graph stays acyclic).

import { readFileSync } from "node:fs";
import { DOC_TOKENS, escapeRegExp } from "../../tokens.ts";
import { constraintsSectionOf, resolveParentOverall } from "../shared.ts";
import { planBody } from "./plan-body.ts";

/** The overall's constitutional block — the artifact header `**Constraints**:` marker line +
 *  its following `- ` bullets (one standing rule per bullet; the block is the last header field in
 *  the canonical overall layout). The bullets are normalized to top-level `- ` form (their
 *  header-nested indentation stripped) — the block reads as the flat standing-rule list the
 *  inherited marker section renders. null when the overall carries no constraints block. */
export function overallConstraintsOf(content: string): string | null {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.includes(DOC_TOKENS.overallConstraintsMark));
  if (start === -1) return null;
  const bullets: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (!/^\s*-\s/.test(lines[i])) break;
    bullets.push(lines[i].trimStart());
  }
  if (bullets.length === 0) return null;
  return `${bullets.join("\n")}\n`;
}

/** The pure presentation join (design C4 — the shared merge machine): the child doc's own
 *  `## Constraints` delta (constraintsSectionOf output, heading included — this merge strips it)
 *  presented with the inherited parent-overall conventions (the constitution auto-applies —
 *  whole-program conventions win on conflict, the delta never restates them; no semantic dedup, it
 *  is a presentation union). Both surfaces byte-deterministic after trimming the outer blanks; the
 *  merged body renders the own delta first (the doc's active constraint face — the
 *  plan-constraints.md reading today), then the inherited constitution under its own marker. null
 *  → the child declares no delta AND the parent carries no conventions (the undeclared face). */
export function mergeParentConstraints(input: {
  ownDelta: string | null;
  parentConstraints: string | null;
}): string | null {
  // The section heading is the schema-derived token (DOC_TOKENS.constraintsHeading — the body
  // shape projection's leaf), never a hand-written duplicate: the strip removes the section
  // heading the extractor included, the render re-emits the canonical heading.
  const stripHeading = new RegExp(`^${escapeRegExp(DOC_TOKENS.constraintsHeading)}\\s*\\n`);
  const own = input.ownDelta?.replace(stripHeading, "").trim() ?? null;
  const parent = input.parentConstraints?.trim() ?? null;
  if (!own && !parent) return null;
  const out: string[] = [DOC_TOKENS.constraintsHeading];
  if (own) out.push("", own);
  if (parent) {
    out.push("", "---", "", "### Parent overall — inherited (auto-applies)", "", parent);
  }
  return `${out.join("\n")}\n`;
}

/** The phase-spec's merged constraints read (design C4 — the spec side): the spec's own
 *  `## Constraints` delta joined with the parent overall's conventions along the Class-B
 *  `**Parent program**` chain → the merged presentation the spec review/validate gate consumes.
 *  Legacy six-section specs (no literal `## Constraints` inheritance point — their constraint
 *  source stays the `## Section 1: Constraints pointer` prose) return null: the dual-read
 *  exemption keeps the legacy read path machine-free, no merge. A new-shape spec whose parent
 *  chain truncates still returns the delta-only presentation — the inheritance-point RESOLUTION is
 *  the validate face (resolveParentOverall + the docContractValidate linkage), never this read. */
export function specConstraintsOf(entry: string, root: string): string | null {
  const content = readFileSync(entry, "utf8");
  // The Form-A heading scan is the plan body's projected `constraintsHeading` slice — the shared
  // atom's parse-pattern single source (the spec body projects the same literal heading for its
  // own skeleton assertions; the merge machine reads one canonical pattern).
  const ownDelta = constraintsSectionOf(
    content,
    planBody.projectSlicePatterns().constraintsHeading,
  );
  if (ownDelta === null) return null; // legacy six-section spec — no `## Constraints` inheritance point
  const parent = resolveParentOverall(entry, root);
  const parentConstraints =
    parent.overallPath !== null
      ? overallConstraintsOf(readFileSync(parent.overallPath, "utf8"))
      : null;
  return mergeParentConstraints({ ownDelta, parentConstraints });
}
