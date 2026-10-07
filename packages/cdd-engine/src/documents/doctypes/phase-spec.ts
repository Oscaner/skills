// packages/cdd-engine/src/documents/doctypes/phase-spec.ts — the PhaseSpecDocType subclass (P1 T2;
// plan §T2 · design C1: the phase-spec doc type — `-design.md` basename + `**Version**` line
// detection, the spec's own Version face + the Class-B parent walk). The DocumentsValidator's spec
// branch (validatePhaseSpecContract semantics) homes here: the spec's own `**Version` line, then the
// Class-B Parent program resolution → the parent overall's contract + four tables (composed through
// the registry — the S3 parent walk). The phase-spec is a routed review target (`"spec"` review
// type — S4); it has no dedicated structure parse beyond the Version-line check. P2 T2 adds the
// new-skeleton body injection (the shape domain derives from `PhaseSpecBody.projectSchemaShape()`
// — the intended Projection source, never a re-homed constant) and the new-skeleton structural
// assertions (design C2: the three-truth skeleton existence + the decorated-conditional-section
// consequences). P3.1 T2 migrates the skeleton judgment to rule data (the body's `structureRules()`
// — the single interpreter plane); this module keeps only the section-scoped deviations answer
// consequence (see `#deviationsFailures` — the section-blind rule plane cannot scope the axis).

import { readFileSync } from "node:fs";
import {
  type DocContext,
  type DocLifecycleFacts,
  DocType,
  type DocValidateFailure,
} from "../doctype.ts";
import { docTypeRegistry } from "../registry.ts";
import { DOC_TOKENS } from "../tokens.ts";
import { DOC_WORDS } from "../words.ts";
import type { PhaseSpecBody } from "./body/phase-spec-body.ts";
import { SPEC_BODY_VIEW } from "./body-views.ts";
import { resolveParentOverall } from "./shared.ts";

// ---- spec-contract atoms (canonical — documents/tokens.ts) ----
const VERSION_HEADER_RE = DOC_TOKENS.versionHeaderRe;
const VERSION_FIELD = DOC_TOKENS.versionField;

/** The phase-spec doc type — `-design.md` basename + `**Version**` line detection (the spec's
 *  structural feature — a plan/spec doc with the Version line but no four-table header is never
 *  judged an overall), the Version-line check parse, and the spec contract face (Version STRICTLY
 *  line + Class-B Parent program → the parent overall contract + four tables). The phase-spec is a
 *  routed review target (`"spec"` review type).
 */
export class PhaseSpecDocType extends DocType {
  /** The injected body — the shape + slice single source for this doc type's checks (constructor
   *  injection, no default parameterization: the body is the live wiring of the shape domain). */
  readonly body: PhaseSpecBody;

  constructor(body: PhaseSpecBody) {
    super({
      kind: "spec",
      // Shape domain — the phase-spec output schema content (P2 T2: derived from the injected body's
      // projectSchemaShape() — the only contract chain DocBody.projectSchemaShape() → DocType.shape →
      // SchemaFactory; the retired phase-spec shape constant is gone). Words — the shared engine
      // lexicon content. BodyView — the docs-family body forms + the spec review config. instructions
      // / refKind stay the P1 placeholder state (P5 lands the concrete content).
      shape: body.projectSchemaShape(),
      words: DOC_WORDS,
      instructions: [],
      refKind: { kind: "" },
      bodyView: SPEC_BODY_VIEW,
      // The phase-spec's routed review/fix face (S4): `--type spec` / the `--spec` next-step flag.
      route: { reviewType: "spec", argKey: "spec", targetFlag: "--spec" },
    });
    this.body = body;
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

  /** The phase-spec's routed review/fix lifecycle handling (S4/T6): the docs review's REVIEW_PLAN_LINE
   *  is empty — the reviewed spec is the target itself, never an upstream reference. */
  lifecycle(_entry: string, _ctx: DocContext): DocLifecycleFacts | null {
    return { reviewPlanLine: "" };
  }

  /** The S3 parent walk: the spec's `**Parent program**` → its `*-overall.md`. */
  parentChain(entry: string, root: string): string | null {
    return resolveParentOverall(entry, root).overallPath;
  }

  /** The phase-spec doc-type surface: `**Version**` line (the spec's own structural face) + the
   * new-skeleton structural assertions (P2 T2) then Class B → the parent overall's contract face +
   * four tables (version-lineage merged in). phaseId is the dispatch plan's phase (a spec-entry
   * audit has none). */
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
    failures.push(...this.#deviationsFailures(content, specPath));
    const parent = resolveParentOverall(specPath, root);
    if (!parent.overallPath) {
      // The inheritance-point linkage (P2 T4; design C4): a spec's `## Constraints` inheritance
      // point is the constraint single source — the parent-overall conventions auto-apply through
      // the Class-B pointer, so a spec whose `**Parent program**` does NOT resolve to an existing
      // `*-overall.md` is a validate failure. The three-truth skeleton is the only assertion
      // surface — the legacy six-section no-op is gone.
      failures.push({
        artifact: "phase spec",
        file: specPath,
        field: DOC_TOKENS.parentField,
        missing:
          "the `**Parent program**` pointer cannot resolve to an existing `*-overall.md` (the `## Constraints` inheritance point demands the parent-overall conventions)",
        fix: `make the ${DOC_TOKENS.parentMark} pointer resolve to the parent overall (e.g. \`- ${DOC_TOKENS.parentMark}: [<slug>-overall.md vX.Y](docs/kairos/specs/<slug>-overall.md)\`)`,
      });
      return failures; // chain truncation — the four tables + overall contract no-op
    }
    failures.push(
      ...docTypeRegistry.resolve("overall").validate(parent.overallPath, {
        root,
        phaseId,
        pinnedTokens: parent.pinnedTokens,
      }),
    );
    return failures;
  }

  /** The decorated-conditional-section consequence (P2 T2 design C2; P3.1 T2 — the sole survivor of
   *  the retired skeleton walker): a `## Deviations` section — when PRESENT — must carry its
   *  structural marker. The section-scoped scan is deliberate: the section-blind rule plane cannot
   *  scope the axis (a content-wide `Yes`-answer-row rule would false-fire on the tree's legacy
   *  specs' incidental `Yes`/`No` cells in non-deviations tables), so the axis stays here as the
   *  doc type's section-bound judgment feeding the DocValidateFailure surface. The other skeleton
   *  assertions (## Design / unique ### Acceptance criteria / ## Constraints) migrated to the body
   *  rule data (phase-spec-body.structureRules) — the single interpreter consumes them at the gate.
   *  The heading + the answer form derive live from the projected shape (the schema is the single
   *  structure fact — the same shape walk the retired skeleton used for `deviations.heading`
   *  / `deviations.updated`). The marker scan is anchored to the deviations table's answer column —
   *  every data row's final cell must read the canonical `^Yes` leaf (the anchored schema pattern,
   *  never a stripped contains-search): an incidental `Yes` elsewhere in the section cannot satisfy
   *  the assertion. */
  #deviationsFailures(content: string, specPath: string): DocValidateFailure[] {
    const lines = content.split("\n");
    const failures: DocValidateFailure[] = [];
    const push = (field: string, missing: string, fix: string) => {
      failures.push({ artifact: "phase spec", file: specPath, field, missing, fix });
    };
    // The heading + the answer form derive live from the projected shape (the schema is the single
    // structure fact — the same shape walk the retired skeleton used for
    // `deviations.heading` / `deviations.updated`).
    const spine = this.body.projectSchemaShape();
    const pattern = (path: readonly string[]): string => {
      let node: Readonly<Record<string, unknown>> = spine as unknown as Readonly<
        Record<string, unknown>
      >;
      for (const key of path) {
        const viaProps = (node.properties as Readonly<Record<string, unknown>> | undefined)?.[key];
        const next = viaProps ?? node[key];
        if (next === null || next === undefined || typeof next !== "object") {
          throw new Error(`phase-spec shape pattern node not found: ${path.join(".")}`);
        }
        node = next as Readonly<Record<string, unknown>>;
      }
      return node.pattern as string;
    };
    const deviationsHeadingRe = new RegExp(pattern(["deviations", "heading"]));
    const deviationsIdx = lines.findIndex((l) => deviationsHeadingRe.test(l));
    if (deviationsIdx === -1) return failures;
    // The row-anchored column scan: table rows are `|`-prefixed lines. The header row (its final
    // cell is the `Overall updated?` column name) and the separator row (every cell dashes) are
    // structural table faces, never the marker. Every remaining data row's answer cell must match
    // `^Yes`, and at least one data row must exist — a decorated section missing the answer
    // entirely is a backfill violation. A `No` answer cell fails even when the word `Yes` appears
    // in another cell of the same row or elsewhere in the section (the finding's false-positive
    // probe: a contains-scan over the full section validated green on incidental `Yes`).
    let sectionEnd = lines.length;
    for (let i = deviationsIdx + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i]!)) {
        sectionEnd = i;
        break;
      }
    }
    let sawDataRow = false;
    let allAnswersYes = true;
    const updatedRe = new RegExp(pattern(["deviations", "updated"]));
    for (const row of lines.slice(deviationsIdx + 1, sectionEnd).filter((l) => l.startsWith("|"))) {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .slice(1);
      if (cells[cells.length - 1] === "") cells.pop();
      if (cells.length === 0) continue;
      if (cells[cells.length - 1] === "Overall updated?") continue; // the header row
      if (cells.every((c) => /^[-:]+$/.test(c))) continue; // the `|---|---|` separator row
      sawDataRow = true;
      if (!updatedRe.test(cells[cells.length - 1]!)) allAnswersYes = false;
    }
    if (!sawDataRow || !allAnswersYes) {
      push(
        "`Overall updated?`",
        "a `## Deviations` table row's `Overall updated?` answer is not `Yes`",
        "answer every deviations-table `Overall updated?` row `Yes` (with version + date, e.g. `Yes — vX.Y · YYYY-MM-DD`) before review, or remove the section when the deviation has been fed back to the overall",
      );
    }
    return failures;
  }
}
