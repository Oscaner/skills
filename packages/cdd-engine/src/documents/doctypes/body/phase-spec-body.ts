// packages/cdd-engine/src/documents/doctypes/body/phase-spec-body.ts — the phase-spec concrete body
// (P2 T2; plan §T2 · design C1/C2, Criterion ②). The new three-truth skeleton + conditional-section
// shape domain, projected onto the DocType.shape face the SchemaFactory derives `config/schema/
// phase-spec.json` from (the only contract chain: DocBody.projectSchemaShape() → DocType.shape →
// SchemaFactory). This module is the LOAD-ORDER-SAFE leaf: it imports zero other engine modules
// (no registry / tokens / doctypes), so tokens.ts can authorize its DOC_TOKENS phase-spec shape
// input from the module-level leaf without re-entering the doctypes plane (tokens → body leaf makes
// the import graph a one-way chain — registry → doctypes → tokens; no TDZ back-edge).
//
// The new-skeleton design (design C2): a metadata header five-tuple (`**Version**` — the strictly
// required line, the detect feature / backfill-as-version / R2 versionToken anchor — · `**Status**`
// · `**Author**` · `**Parent program**` (Class-B) · `**Depends on**`), the permanent three-truth
// skeleton (`## Design` — carrying the unique `### Acceptance criteria` subsection — · `##
// Constraints` — the inheritance point where the parent-overall conventions auto-apply and the
// constraints-pointer semantics merge, a non-conditional section), and the four conditional sections
// (incremental warning / deviations / notes for downstream / review record) written only when their
// condition holds — zero residue otherwise. The schema carries the structural-consequence anchor:
// each conditional node's `dependentRequired` (a decorated section's marker) + the root `if`/`then`
// (the three-truth skeleton consequence). Whether a section's semantic condition genuinely holds is
// the author's declared judgment (the descriptions carry the human criteria) — the machine asserts
// only how a decorated section must look.

import type { SchemaShape } from "../../doctype.ts";
import {
  BODY_CONSTRAINTS_HEADING_RE,
  DocBody,
  type SlicePatternSet,
  type StructureRule,
} from "./doc-body.ts";

/** The new-skeleton phase-spec shape domain (P2 T2; design C2) — the projection product
 *  `projectSchemaShape()` serves and the module-level leaf tokens.ts authorizes its DOC_TOKENS
 *  phase-spec input from. The header five-tuple's `version` leaves keep the P1 values verbatim (the
 *  deriveDocTokens `["header","version","marker"]` path reads the same const — the DOC_TOKENS
 *  phase-spec derivation surface is byte-unchanged by the skeleton re-projection). */
export const PHASE_SPEC_BODY_SHAPE: SchemaShape = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://oscaner.dev/schemas/cdd/phase-spec.json",
  title: "Phase design spec document structure",
  description:
    "Canonical structure of a kairos phase design spec — one phase's increment of a program; the program-level charter lives in the parent overall (whole-program conventions win on conflict). This schema is the single structure fact for the phase-spec doc type: the artifact header five-tuple (`**Version**` — strictly required, the detect feature / backfill-as-version anchor — · `**Status**` · `**Author**` · `**Parent program**` (Class-B) · `**Depends on**`), the permanent three-truth skeleton (`## Design` with the unique `### Acceptance criteria` subsection · `## Constraints` — the inheritance point where the parent-overall conventions auto-apply and the constraints-pointer semantics merge), and the conditional sections (incremental warning / deviations / notes for downstream / review record) written only when their condition holds — zero residue otherwise. The schema's `dependentRequired` / `if-then` carry the structural consequence anchored on a section being present (a decorated section must carry its marker — e.g. the deviations table's `Overall updated?` must be `Yes` before review); whether the section's semantic condition truly holds is the author's declared judgment (the descriptions carry the criteria). Authoring agents read the properties + descriptions to draft conforming specs; docContractValidate consumes the same patterns (`**Version**` strictly required, Class-B parent-program lineage, the skeleton + conditional consequences).",
  type: "object",
  properties: {
    header: {
      type: "object",
      description:
        "Artifact header block — the metadata five-tuple at the top of the artifact, a bullet block, not a `##` section. The `**Version**` line is STRICTLY required here (the phase-spec Version check — the detect feature / backfill-as-version / the R2 versionToken anchor line); every remaining field is part of the block.",
      properties: {
        version: {
          type: "object",
          description:
            "`**Version**` — strictly required line; `- **Version**: vX.Y · YYYY-MM-DD`.",
          properties: {
            marker: {
              type: "string",
              const: "**Version**",
              description:
                "The canonical `**Version**` marker (shared token with the overall; the engine derives its phase-spec version assertion from the same single source).",
            },
            line: {
              type: "string",
              pattern: "^\\s*-?\\s*\\*\\*Version\\*\\*:\\s*v\\d+\\.\\d+",
              description:
                "The strictly-required version line; the `v\\d+\\.\\d+` token follows the version-lineage rule (must reference a version the parent overall actually carries when the spec pins one).",
            },
          },
        },
        status: {
          type: "object",
          description: "`**Status**` — the phase-spec status vocabulary.",
          properties: {
            states: {
              type: "array",
              enum: ["Draft", "Approved", "Plan pending", "Shipped"],
              description: "Phase-spec status states — Draft / Approved / Plan pending / Shipped.",
            },
          },
        },
        author: {
          type: "object",
          description:
            "`**Author**` — contributor line (`[human] · [harness + model]`); free text, no structural rule.",
        },
        parentProgram: {
          type: "object",
          description:
            "`**Parent program**` — link + version to the parent overall; Class-B lineage check resolves it to an existing `*-overall.md` and requires every `vX.Y` token on the line to be in the parent's lineage (current `**Version:**` ∪ change-history cells).",
          properties: {
            linkForm: {
              type: "string",
              pattern: "^-?(\\s*)\\*\\*Parent program\\*\\*:?\\s+\\[[^\\]]+\\]\\([^)]+\\)",
              description:
                "`- **Parent program**: [<name>-overall.md vX.Y](<path>)` — markdown link to the parent overall doc (`*-overall.md`).",
            },
          },
        },
        dependsOn: {
          type: "object",
          description:
            "`**Depends on**` — upstream phases + tags (e.g. `P1（shipped · [p1-design v1.1](…)）`; informational.",
        },
      },
    },
    design: {
      type: "object",
      description:
        "`## Design` — the phase's design body: this phase's increment (approaches, architecture, components, data flow, errors, testing) AND the unique `### Acceptance criteria` subsection (see design.acceptanceCriteria) — the first of the permanent three-truth skeleton sections.",
      properties: {
        heading: {
          type: "string",
          pattern: "^## Design$",
          description: "Literal heading `## Design`.",
        },
        acceptanceCriteria: {
          type: "object",
          description:
            "`### Acceptance criteria` — the ONLY subsection, and it lives inside `## Design`: verifiable completion conditions, each independently testable. An acceptance criterion is a claim: a claim that cannot be mechanically verified on the shipped tree is a paper claim.",
          properties: {
            heading: {
              type: "string",
              const: "### Acceptance criteria",
              description:
                "Literal subsection heading `### Acceptance criteria` — unique: no other subsection exists anywhere in the doc.",
            },
            location: {
              type: "object",
              description: "Location rule — the subsection sits inside `## Design`.",
              properties: {
                parent: {
                  type: "string",
                  const: "## Design",
                  description: "`### Acceptance criteria` is nested directly under `## Design`.",
                },
              },
            },
            entry: {
              type: "string",
              pattern: "^- `",
              description:
                "Acceptance entries — `- ` code-span-prefixed bullets, each an independently testable condition (e.g. `- artifact X exists at path Y with property Z`).",
            },
          },
        },
      },
    },
    acceptance: {
      type: "object",
      description:
        "The acceptance-claim entry form — the `### Acceptance criteria` code-span conditional-sentence entries (`- ` code-span 条件句): the shared entry leaf the design.acceptanceCriteria subsection carries, each an independently testable claim (a claim that cannot be mechanically verified on the shipped tree is a paper claim).",
      properties: {
        entry: {
          type: "string",
          pattern: "^- `",
          description:
            "Acceptance entries — `- ` code-span-prefixed bullets, each an independently testable condition (e.g. `- artifact X exists at path Y with property Z`).",
        },
      },
    },
    constraints: {
      type: "object",
      description:
        "`## Constraints` — the inheritance point (non-conditional section): the parent overall's conventions auto-apply (delta-only); this section carries the spec's own delta + the `**Parent program**` pointer — the constraints-pointer semantics merge here, a spec never restates overall conventions (whole-program conventions win on conflict).",
      properties: {
        heading: {
          type: "string",
          pattern: "^## Constraints$",
          description: "Literal heading `## Constraints`.",
        },
        entry: {
          type: "string",
          pattern: "^- ",
          description:
            "Constraint entries — the spec's self-owned delta bullets (`- …`), each a phase-local constraint the parent overall's conventions do not already cover (no restatement).",
        },
      },
    },
    deviations: {
      type: "object",
      description:
        "`## Deviations` — conditional section: written ONLY when the phase diverges on a cross-phase matter (condition = 有 cross-phase divergence; zero residue otherwise — the section is absent). `Overall updated?` must be `Yes` before review — a divergence not fed back to the overall is a backfill violation. Decorated ⇒ the marker consequence holds (dependentRequired): the section's heading demands its `updated` answer.",
      properties: {
        heading: {
          type: "string",
          pattern: "^## Deviations$",
          description: "Literal heading `## Deviations`.",
        },
        columns: {
          type: "array",
          items: {
            type: "string",
            enum: ["Overall assumption", "Phase decision", "Overall updated?"],
            description: "One deviation-table column name.",
          },
          description:
            "The three deviation-table column names; `Overall updated?` must be `Yes` (with version + date, e.g. `Yes — vX.Y · YYYY-MM-DD`) before review.",
        },
        updated: {
          type: "string",
          pattern: "^Yes",
          description:
            "The `Overall updated?` answer form — a fed-back deviation reads `Yes` (e.g. `Yes — vX.Y · YYYY-MM-DD`); a divergence not fed back to the overall is a backfill violation.",
        },
      },
      required: ["heading", "columns"],
      dependentRequired: { heading: ["updated"] },
    },
    incrementalWarning: {
      type: "object",
      description:
        "`## Incremental warning` — conditional section: written ONLY when the phase commits to an increment-boundary-crossing declaration (condition = 有 increment 边界跨越声明; zero residue otherwise). The phase commits to exactly one phase; splitting / reordering a phase's work is not a local edit — phase-inventory rows, dependency edges and a change-history row land in the parent overall first (backfill-as-version). The section's structural marker is its heading alone (dependentRequired).",
      properties: {
        heading: {
          type: "string",
          pattern: "^## Incremental warning$",
          description: "Literal heading `## Incremental warning`.",
        },
      },
      dependentRequired: { heading: [] },
    },
    downstreamNotes: {
      type: "object",
      description:
        "`## Notes for downstream` — conditional section: written ONLY when the phase hands a downstream-phase note over (condition = 有下游 phase 交接 note; zero residue otherwise). A 'later phases will handle this' note that stays here alone is a dead end — downstream writers read the overall, record the shift in the overall's issue / phase / dependency tables and history, keep the note as a pointer. The section's structural marker is its heading alone (dependentRequired).",
      properties: {
        heading: {
          type: "string",
          pattern: "^## Notes for downstream$",
          description: "Literal heading `## Notes for downstream`.",
        },
      },
      dependentRequired: { heading: [] },
    },
    reviewRecord: {
      type: "object",
      description:
        "`## Review record` — conditional section: written ONLY when the phase records a review conclusion (condition = 有评审结论要记录; zero residue otherwise). Fresh-subagent review passes before user review and cdd-plan — baseline = committed tree, Review Convergence (blocker > 0 → fix all findings → re-review; blocker = 0 → fix all findings → done, no re-review). The section's structural marker is its heading alone (dependentRequired).",
      properties: {
        heading: {
          type: "string",
          pattern: "^## Review record$",
          description: "Literal heading `## Review record`.",
        },
      },
      dependentRequired: { heading: [] },
    },
  },
  // The three-truth skeleton consequence — the permanent sections are structurally linked: a spec
  // carrying `## Design` (the new-skeleton marker) must also carry the acceptance + constraints
  // sections (docContractValidate asserts the same existence contract on the doc text).
  if: { required: ["design"] },
  // biome-ignore lint/suspicious/noThenProperty: the JSON-Schema `then` keyword — the if-then structural-consequence anchor of the projection, a schema keyword, never a thenable.
  then: { required: ["acceptance", "constraints"] },
};

/** The new-skeleton parse slice patterns — the concrete body's single-source heading regexes
 *  (design C2): the three permanent heading slices. The `m` flag keeps each pattern matchable on
 *  both a full-content scan and a per-line scan. The `constraintsHeading` slice is the SHARED
 *  body-plane regex (BODY_CONSTRAINTS_HEADING_RE — the same `## Constraints` byte source the plan
 *  body's Form-A extraction reads; the inheritance-point assertion and the merge machine can never
 *  drift apart). */
const PHASE_SPEC_SLICE_PATTERNS: SlicePatternSet = {
  designHeading: /^## Design\s*$/m,
  acceptanceCriteriaHeading: /^### Acceptance criteria\s*$/m,
  constraintsHeading: BODY_CONSTRAINTS_HEADING_RE,
};

/** The phase-spec structure-rule data (P3.1 T2 — the retired skeleton-walker migration, design §2.2):
 *  the three-truth skeleton's existence/uniqueness assertions as rule data (the ONE interpreter
 *  `runStructureRules` consumes them at the doc-contract gate — the judgmental surface the retired
 *  handwritten skeleton walker fed). Each anchor derives from the projected slice regexes
 *  (`.source` — the parse-pattern single source, never a re-typed literal). The rule-construction
 *  atom is deliberately local: the slice source of a projected heading key, so a heading rename in
 *  the projection re-anchors the rule in the same build.
 *
 *  Scope note (the delegated deviations axis): the `## Deviations` row-anchor `Yes` consequence is
 *  NOT on this plane — it stays on the doc type (phase-spec.ts `#deviationsFailures`), section-
 *  scoped to the `## Deviations` section. The rule interpreter is section-blind (a rule's plane
 *  scans the whole content), and the tree's legacy specs carry incidental `Yes`/`No`-starting cells
 *  inside non-deviations tables (a legacy program's p2-design Q&A rows) — a content-wide
 *  answer-row rule would false-fire there and break the tree-walk delta-zero contract (T2 step 1). */
function specHeadingAnchor(re: RegExp): string {
  return re.source;
}

/** The phase-spec structure rules — the three-truth skeleton (design §2.2): `## Design` presence →
 *  `### Acceptance criteria` uniqueness → `## Constraints` presence. Severity BLOCK (the skeleton
 *  is the skeleton — a missing permanent member blocks the gate). */
const PHASE_SPEC_RULES: readonly StructureRule[] = [
  {
    id: "spec.design",
    plane: {
      kind: "headingLeads",
      anchor: specHeadingAnchor(PHASE_SPEC_SLICE_PATTERNS.designHeading),
    },
    invariants: [{ type: "presence" }],
    severity: "BLOCK",
    message:
      "no `## Design` section (the three-truth skeleton's first member — add the section carrying the phase's design body + the unique `### Acceptance criteria` subsection)",
  },
  {
    id: "spec.acceptance",
    plane: {
      kind: "headingLeads",
      anchor: specHeadingAnchor(PHASE_SPEC_SLICE_PATTERNS.acceptanceCriteriaHeading),
    },
    invariants: [{ type: "uniqueness" }],
    severity: "BLOCK",
    message:
      "the `### Acceptance criteria` subsection must appear exactly once inside `## Design` (`- ` code-span-prefixed acceptance entries)",
  },
  {
    id: "spec.constraints",
    plane: {
      kind: "headingLeads",
      anchor: specHeadingAnchor(PHASE_SPEC_SLICE_PATTERNS.constraintsHeading),
    },
    invariants: [{ type: "presence" }],
    severity: "BLOCK",
    message:
      "no `## Constraints` inheritance-point section (add the section carrying the spec's own delta + the `**Parent program**` pointer — the parent-overall conventions auto-apply)",
  },
];

/**
 * The phase-spec concrete body (P2 T2; design C1/C2 — Criterion ②: class + constructor injection).
 * Carries the phase-spec kind identity + authoring-way description and projects the two concrete
 * surfaces: the new-skeleton schema shape (the DocType.shape derivation source for the SchemaFactory
 * product) and the parse slice regexes (the docContractValidate skeleton assertions' single source).
 */
export class PhaseSpecBody extends DocBody {
  constructor(opts: PhaseSpecBodyOpts) {
    super({ kind: "phase-spec", description: opts.description });
  }

  /** The shape-domain projection — the new-skeleton schema content (the module-level leaf; identity
   *  with the exported `PHASE_SPEC_BODY_SHAPE` — the same projection product every consumer reads). */
  projectSchemaShape(): SchemaShape {
    return PHASE_SPEC_BODY_SHAPE;
  }

  /** The parse slice-pattern projection — the three permanent heading regexes. */
  projectSlicePatterns(): SlicePatternSet {
    return PHASE_SPEC_SLICE_PATTERNS;
  }

  /** The phase-spec structure-rule data (P3.1 T2): the three-truth skeleton rules — the planner's
   *  single-interpreter surface the doc-contract gate judges (the retired skeleton walker
   *  heading walker). The Deviations answer-axis stays on the doc type (section-scoped — see the
   *  module note above). */
  structureRules(): readonly StructureRule[] {
    return PHASE_SPEC_RULES;
  }
}

/** Constructor options for the phase-spec body — the authoring-way description (the kind identity
 *  is pinned to "phase-spec" by the class, never caller-supplied). */
export interface PhaseSpecBodyOpts {
  /** The phase-spec authoring-way prose (the DocBody.description single source). */
  description: string;
}

/** The phase-spec body singleton — the constructor-injected doc-type wiring target (registry.ts
 *  passes it to `new PhaseSpecDocType(phaseSpecBody)`; the doc-type's `shape` field is the body's
 *  projected shape, never a re-homed constant). */
export const phaseSpecBody = new PhaseSpecBody({
  description:
    "Canonical phase-spec authoring way: a metadata header five-tuple (`**Version**` strictly required — the detect feature / backfill-as-version / R2 versionToken anchor line — · `**Status**` · `**Author**` · `**Parent program**` (Class-B) · `**Depends on**`), a three-truth skeleton (`## Design` carrying the unique `### Acceptance criteria` subsection · `## Constraints` — the inheritance point where parent-overall conventions auto-apply and the constraints-pointer semantics merge), and the conditional sections (incremental warning / deviations — `Overall updated?` must be `Yes` — / notes for downstream / review record) written only when their condition holds — zero residue otherwise.",
});
