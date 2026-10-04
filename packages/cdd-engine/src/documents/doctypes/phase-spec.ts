// packages/cdd-engine/src/documents/doctypes/phase-spec.ts — the PhaseSpecDocType subclass (P1 T2;
// plan §T2 · design C1: the phase-spec doc type — `-design.md` basename + `**Version**` line
// detection, the spec's own Version face + the Class-B parent walk). The DocumentsValidator's spec
// branch (validatePhaseSpecContract semantics) homes here: the spec's own `**Version` line, then the
// Class-B Parent program resolution → the parent overall's contract + four tables (composed through
// the registry — the S3 parent walk). The phase-spec is a routed review target (`"spec"` review
// type — S4); it has no dedicated structure parse beyond the Version-line check.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type DocContext, DocType, type DocValidateFailure } from "../doctype.ts";
import { docTypeRegistry } from "../registry.ts";
import { DOC_TOKENS } from "../tokens.ts";
import { PHASE_SPEC_SHAPE } from "./shapes/phase-spec.ts";
import { isPlaceholderOrTemplateTarget, linksOnLine, resolveAny } from "./shared.ts";

// ---- spec-contract atoms (canonical — documents/tokens.ts) ----
const VERSION_HEADER_RE = DOC_TOKENS.versionHeaderRe;
const VERSION_FIELD = DOC_TOKENS.versionField;
const VERSION_TOKEN_RE = DOC_TOKENS.versionTokenRe;
const PARENT_MARK = DOC_TOKENS.parentMark;

/** The phase-spec doc type — `-design.md` basename + `**Version**` line detection (the spec's
 *  structural feature — a plan/spec doc with the Version line but no four-table header is never
 *  judged an overall), the Version-line check parse, and the spec contract face (Version STRICTLY
 *  line + Class-B Parent program → the parent overall contract + four tables). The phase-spec is a
 *  routed review target (`"spec"` review type).
 */
export class PhaseSpecDocType extends DocType {
  constructor() {
    super({
      kind: "spec",
      // Shape domain — the phase-spec output schema content (T3: the concrete per-type shape, the
      // SchemaFactory's projection source). words / instructions / refKind / bodyView stay the P1
      // placeholder state (T4/T5/P5 land the concrete content).
      shape: PHASE_SPEC_SHAPE,
      words: { reference: "" },
      instructions: [],
      refKind: { kind: "" },
      bodyView: { format: "" },
      // The phase-spec's routed review/fix face (S4): `--type spec` / the `--spec` next-step flag.
      route: { reviewType: "spec", argKey: "spec", targetFlag: "--spec" },
    });
  }

  /** Phase-spec detection: the `-design.md` basename form AND the `**Version**` line contract
   *  feature — the fallback scan order (overall → plan → spec) asks this type last. */
  detect(fileName: string, content: string): boolean {
    if (!fileName.endsWith("-design.md")) return false;
    return content.match(VERSION_HEADER_RE) !== null;
  }

  /** The spec has no dedicated structure parse — the `**Version**` line check (the spec's own
   *  structural fact): the pinned `vX.Y` token or null when the line is absent. */
  parse(entry: string, _ctx: DocContext): unknown {
    const m = readFileSync(entry, "utf8").match(VERSION_HEADER_RE);
    return m ? m[1] : null;
  }

  /** The spec contract face: the spec's own `**Version` line, then Class-B → the parent overall's
   *  contract + four tables (version-lineage merged in). phaseId is the dispatch plan's phase (a
   *  spec-entry audit has none). */
  validate(entry: string, ctx: DocContext): DocValidateFailure[] {
    return this.validatePhaseSpecContract(entry, ctx.root, ctx.phaseId ?? null);
  }

  /** The phase-spec's routed review/fix lifecycle dispatch key (S4) — `"spec"` (the review `--type`). */
  lifecycle(_entry: string, _ctx: DocContext): unknown {
    return this.route.reviewType;
  }

  /** The S3 parent walk: the spec's `**Parent program**` → its `*-overall.md`. */
  parentChain(entry: string, root: string): string | null {
    return this.#resolveParentOverall(entry, root).overallPath;
  }

  /** The phase-spec doc-type surface: `**Version**` line (the spec's own structural face) then Class B
   * → the parent overall's contract face + four tables (version-lineage merged in). phaseId is the
   * dispatch plan's phase (a spec-entry audit has none). */
  validatePhaseSpecContract(
    specPath: string,
    root: string,
    phaseId: string | null,
  ): DocValidateFailure[] {
    const failures: DocValidateFailure[] = [];
    const content = readFileSync(specPath, "utf8");
    if (!content.match(VERSION_HEADER_RE)) {
      failures.push({
        artifact: "phase spec",
        file: specPath,
        field: VERSION_FIELD,
        missing: `no ${VERSION_FIELD} line`,
        fix: `add a \`- ${DOC_TOKENS.versionMark}: vX.Y · <date>\` line at the document head`,
      });
    }
    const parent = this.#resolveParentOverall(specPath, root);
    if (!parent.overallPath) return failures; // chain truncation — the four tables + overall contract no-op
    failures.push(
      ...docTypeRegistry.resolve("overall").validate(parent.overallPath, {
        root,
        phaseId,
        pinnedTokens: parent.pinnedTokens,
      }),
    );
    return failures;
  }

  /** Class B — the spec's Parent program → its `*-overall.md`. Chain truncation (no parent line /
   * placeholder / unresolvable / not an overall) yields { overallPath: null } and the FOUR-TABLE +
   * overall contract faces no-op (AC1: lineage not resolved → the four tables no-op, the necessary
   * subset always runs) — the overall is only ever audited against a reached parent doc. Pinned
   * version tokens ride the resolution for the merged version-lineage check. */
  #resolveParentOverall(
    specPath: string,
    root: string,
  ): { overallPath: string | null; pinnedTokens: string[] } {
    const lines = readFileSync(specPath, "utf8").split("\n");
    const parentIdx = lines.findIndex((l) => l.includes(PARENT_MARK));
    if (parentIdx === -1) return { overallPath: null, pinnedTokens: [] };
    const links = linksOnLine(lines[parentIdx]);
    if (links.length === 0) return { overallPath: null, pinnedTokens: [] };
    const { target } = links[0];
    if (isPlaceholderOrTemplateTarget(target)) return { overallPath: null, pinnedTokens: [] };
    const resolved = resolveAny(target, [path.dirname(specPath), root]);
    if (!resolved) return { overallPath: null, pinnedTokens: [] };
    if (!path.basename(resolved).endsWith("-overall.md"))
      return { overallPath: null, pinnedTokens: [] };
    const pinnedTokens = [...lines[parentIdx].matchAll(VERSION_TOKEN_RE)].map((m) => m[0]);
    return { overallPath: resolved, pinnedTokens };
  }
}
