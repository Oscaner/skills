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
// consequences).

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  type DocContext,
  type DocLifecycleFacts,
  DocType,
  type DocValidateFailure,
  type SchemaShape,
} from "../doctype.ts";
import { docTypeRegistry } from "../registry.ts";
import { DOC_TOKENS } from "../tokens.ts";
import { DOC_WORDS } from "../words.ts";
import type { PhaseSpecBody } from "./body/phase-spec-body.ts";
import { SPEC_BODY_VIEW } from "./body-views.ts";
import { isPlaceholderOrTemplateTarget, linksOnLine, resolveAny } from "./shared.ts";

// ---- spec-contract atoms (canonical — documents/tokens.ts) ----
const VERSION_HEADER_RE = DOC_TOKENS.versionHeaderRe;
const VERSION_FIELD = DOC_TOKENS.versionField;
const VERSION_TOKEN_RE = DOC_TOKENS.versionTokenRe;
const PARENT_MARK = DOC_TOKENS.parentMark;

/** One structural-pattern leaf of a body's projected shape, navigated by its `properties` path —
 *  the docContractValidate reads the same schema leaves the authors draft against (the schema is
 *  the single structure fact; module-private — exactly one consumer, the skeleton assertions). The
 *  walk is the same properties-first collection idiom as tokens.ts nodeAt. */
function shapePattern(shape: SchemaShape, props: readonly string[]): string {
  let node: Readonly<Record<string, unknown>> = shape as unknown as Readonly<
    Record<string, unknown>
  >;
  for (const key of props) {
    const viaProps = (node.properties as Readonly<Record<string, unknown>> | undefined)?.[key];
    const next = viaProps ?? node[key];
    if (next === null || next === undefined || typeof next !== "object") {
      throw new Error(`phase-spec shape pattern node not found: ${props.join(".")}`);
    }
    node = next as Readonly<Record<string, unknown>>;
  }
  const pattern = node.pattern;
  if (typeof pattern !== "string") {
    throw new Error(`phase-spec shape pattern not found at: ${props.join(".")}`);
  }
  return pattern;
}

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
    return this.#resolveParentOverall(entry, root).overallPath;
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
    failures.push(...this.#skeletonFailures(content, specPath));
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

  /** The new-skeleton structural assertions (P2 T2; design C2): a phase-spec in the NEW skeleton
   *  shape — recognized by the `## Design` heading (a marker no legacy Section 0–5 skeleton carries)
   *  — must carry the full three-truth skeleton (unique `### Acceptance criteria` inside `## Design`
   *  · `## Constraints`), and a DECORATED conditional section must carry its structural marker
   *  (`## Deviations` demands an `Overall updated?` answer of `Yes` — a decorated section must
   *  carry its marker). Legacy six-section docs (no `## Design`) keep the P1 acceptance path
   *  unchanged — both shapes are read (dual-read contract). Whether a section's semantic condition
   *  holds is the author's declared judgment (the schema descriptions carry the criteria) — the
   *  machine asserts only how a decorated section must look, never the condition's truth. */
  #skeletonFailures(content: string, specPath: string): DocValidateFailure[] {
    const slices = this.body.projectSlicePatterns();
    const lines = content.split("\n");
    const lineHas = (re: RegExp): boolean => lines.some((l) => re.test(l));
    // The new-skeleton gate: `## Design` is the new shape's marker (legacy Section 0–5 docs never
    // carry it) — only a new-shape spec runs the assertion family (dual-read).
    if (!lineHas(slices.designHeading)) return [];
    const failures: DocValidateFailure[] = [];
    const push = (field: string, missing: string, fix: string) => {
      failures.push({ artifact: "phase spec", file: specPath, field, missing, fix });
    };
    // 1. The unique `### Acceptance criteria` subsection inside `## Design` — present exactly once
    //    (the unique-constraint kept from the retired Section 2 skeleton).
    const acceptanceHits = lines.filter((l) => slices.acceptanceCriteriaHeading.test(l));
    if (acceptanceHits.length === 0) {
      push(
        "`### Acceptance criteria`",
        "no `### Acceptance criteria` subsection in the `## Design` body",
        "add the unique `### Acceptance criteria` subsection (`- ` code-span-prefixed acceptance entries) inside `## Design`",
      );
    } else if (acceptanceHits.length > 1) {
      push(
        "`### Acceptance criteria`",
        "the `### Acceptance criteria` subsection appears more than once",
        "keep `### Acceptance criteria` the unique subsection (`- ` code-span-prefixed entries)",
      );
    }
    // 2. The `## Constraints` inheritance point — the non-conditional third of the three-truth
    //    skeleton (the parent-overall conventions auto-apply; the section carries the spec's own
    //    delta + the `**Parent program**` pointer, never a restatement).
    if (!lineHas(slices.constraintsHeading)) {
      push(
        "`## Constraints`",
        "no `## Constraints` inheritance-point section",
        "add a `## Constraints` section carrying the spec's own delta + the `**Parent program**` pointer (the parent-overall conventions auto-apply)",
      );
    }
    // 3. Conditional-section structural consequence — a DECORATED `## Deviations` section must carry
    //    the `Overall updated?` = `Yes` marker. The heading + the answer form derive live from the
    //    projected shape (the schema is the single structure fact). The marker scan is anchored to
    //    the deviations table's answer column — every data row's final cell must read the canonical
    //    `^Yes` leaf (the anchored schema pattern, never a stripped contains-search): an incidental
    //    `Yes` elsewhere in the section cannot satisfy the assertion.
    const spine = this.body.projectSchemaShape();
    const deviationsHeadingRe = new RegExp(shapePattern(spine, ["deviations", "heading"]));
    const deviationsIdx = lines.findIndex((l) => deviationsHeadingRe.test(l));
    if (deviationsIdx !== -1) {
      const updatedRe = new RegExp(shapePattern(spine, ["deviations", "updated"]));
      let sectionEnd = lines.length;
      for (let i = deviationsIdx + 1; i < lines.length; i++) {
        if (/^## /.test(lines[i]!)) {
          sectionEnd = i;
          break;
        }
      }
      // The row-anchored column scan: table rows are `|`-prefixed lines. The header row (its final
      // cell is the `Overall updated?` column name) and the separator row (every cell dashes) are
      // structural table faces, never the marker. Every remaining data row's answer cell must match
      // `^Yes`, and at least one data row must exist — a decorated section missing the answer
      // entirely is a backfill violation. A `No` answer cell fails even when the word `Yes` appears
      // in another cell of the same row or elsewhere in the section (the finding's false-positive
      // probe: a contains-scan over the full section validated green on incidental `Yes`).
      let sawDataRow = false;
      let allAnswersYes = true;
      for (const row of lines
        .slice(deviationsIdx + 1, sectionEnd)
        .filter((l) => l.startsWith("|"))) {
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
    }
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
