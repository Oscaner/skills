// packages/cdd-engine/src/documents/doctypes/body/plan-body.ts — the plan concrete body (P2 T3;
// plan §T3 · design C1/C3, Criterion ②). The plan's data-shaped projection, served onto the
// DocType.shape face the SchemaFactory derives `config/schema/plan.json` from (the only contract
// chain: DocBody.projectSchemaShape() → DocType.shape → SchemaFactory). This module is the
// LOAD-ORDER-SAFE leaf (the T3 counterpart of T2's phase-spec-body): it imports zero engine modules
// (type-only doctype/task imports + the abstract DocBody), so tokens.ts can authorize its DOC_TOKENS
// plan shape input from the module-level leaf without re-entering the doctypes plane (tokens → body
// leaf is a one-way chain; no TDZ back-edge).
//
// The data-shape design (design C3): a metadata header five-tuple (`**Spec:**` — the Class-A marker
// + the label==basename rule kept — · `**Parent program**` · `**Version**` · `**Depends on**` ·
// `**Base**`), a delta-only `## Constraints` face (the section carries the plan's own deltas; the
// legacy Form B prose pointers are retained only as the T5 dual-read + extractProseConstraints
// dependency — new docs never use them), the `tasks[]` Task data records (objective / files /
// interface{consumes,produces} / steps[]{action,checkable} / acceptance[], plus the optional
// dependsOn?/atomicWith? edge fields — read/write: the task-block parser fills them and TaskGraph
// consumes them for the atomic-closure grouping + the edge-validation BLOCK face) the brief
// renderer materializes the task-handoff brief from, and the taskGroups dispatch-group declaration
// (an optional section; its layout leaves stay exactly where the DOC_TOKENS derivation reads
// them). The `### Task N:` render surface keeps the colon-form heading const — the deriveDocTokens
// taskHeadings leaf and the 1..N continuity contract are byte-unchanged by the re-projection.
//
// renderBrief(task) carries the plan-only task-brief render surface — deliberately OFF the abstract
// DocBody contract (the phase-spec body never uses a task brief): the brief content renders the
// objective + the ordered steps (each action with its checkable outcome) + the acceptance criteria
// from the Task data, zero prose carving — the legacy `- **Do**:` face is gone.

import type { SchemaShape } from "../../doctype.ts";
import {
  BODY_CONSTRAINTS_HEADING_RE,
  DocBody,
  escapeRegExp,
  type SlicePatternSet,
} from "./doc-body.ts";
import type { Task } from "./task.ts";

/** The Form-B prose-pointer anchor tokens — the SINGLE declaration of the anchor set (the shape
 *  enum leaf `constraints.formBProseAnchors.anchors.items.enum` and the parse anchor scans both
 *  read it: one anchor edit lands in the authoring schema and the parse face together — zero
 *  duplicated anchor literals). In canonical declaration order (`口径` / `commit 边界机制` /
 *  `Flow Atomicity` / `顺序原则`, the data operands) — the order extraction presents the anchors
 *  in. */
export const PLAN_FORM_B_ANCHOR_TOKENS = [
  "**口径**：",
  "**commit 边界机制**：",
  "**Flow Atomicity**：",
  "**顺序原则**：",
] as const;

/** The data-shaped plan shape domain (P2 T3; design C3) — the projection product
 *  `projectSchemaShape()` serves and the module-level leaf tokens.ts authorizes its DOC_TOKENS plan
 *  input from. The four deriveDocTokens leaf families keep their exact paths/values (taskHeadings
 *  format · constraints formACanonical heading · constraints formBProseAnchors anchors enum · the
 *  taskGroups layout nodes) — the re-projection leaves the DOC_TOKENS plan derivation surface
 *  byte-unchanged. */
export const PLAN_BODY_SHAPE: SchemaShape = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://oscaner.dev/schemas/cdd/plan.json",
  title: "Phase implementation plan document structure",
  description:
    "Canonical structure of a kairos phase implementation plan — the per-phase executable breakdown of one design spec. This schema is the single structure fact for the plan doc type: the header fields, the `### Task N:` colon-form task headings, the per-task data records (objective / files / interface{consumes,produces} / steps[]{action,checkable} / acceptance[]) the brief renderer materializes the task-handoff brief from — zero prose `- **Do**:` carving — the `## Constraints` delta (the section carries only the plan's own deltas; the legacy Form B prose pointers are retained for the dual-read tree but never used by new docs), and the `taskGroups` dispatch-group declaration (empty default ⇒ every task its own per-task group). Authoring agents read the properties + descriptions to draft conforming plans; docContractValidate / brief extraction consume the same patterns.",
  type: "object",
  properties: {
    header: {
      type: "object",
      description:
        "Plan header block — the first lines after the `# Title`; metadata fields, not `##` sections.",
      properties: {
        specRef: {
          type: "object",
          description:
            "`**Spec:**` reference — the plan's approved design link, the same source as `plan-review`'s `--spec` pointer and cdd-report's program attribution chain (plan record → `**Spec:**` → overall).",
          properties: {
            marker: {
              type: "string",
              const: "**Spec:**",
              description:
                "The literal marker. Parsing semantics keep the engine contract (resolveSpecFromPlan): the marker is located by ANY-line findIndex — it may sit anywhere in the header. Line 2 (immediately after `# Title`) is the cdd-plan template/example convention, NOT a schema required-position: a plan is valid wherever the `**Spec:**` line lives.",
            },
            linkForm: {
              type: "string",
              pattern: "^\\*\\*Spec:\\*\\*\\s+\\[[^\\]]+\\]\\([^)]+\\)$",
              description:
                "Link form: `**Spec:** [<name>-design.md](docs/kairos/specs/<name>-design.md)` — targets an existing spec file (repo-root form primary, file-relative fallback).",
            },
            labelEqualsBasename: {
              type: "object",
              description:
                "Class-A label rule — the link label must equal the resolved file's basename.",
              properties: {
                rule: {
                  type: "string",
                  const: "label == basename",
                  description:
                    "`[<label>](<target>)` — the label must equal the basename of the resolved target (drift fails).",
                },
              },
            },
          },
        },
        parentProgram: {
          type: "object",
          description:
            "`**Parent program**` — link to the phase's parent overall (Class B lineage anchor).",
          properties: {
            marker: {
              type: "string",
              const: "**Parent program**",
              description: "The literal marker.",
            },
            linkForm: {
              type: "string",
              pattern: "^-?(\\s*)\\*\\*Parent program\\*\\*:?\\s+\\[[^\\]]+\\]\\([^)]+\\)",
              description:
                "Link form: `- **Parent program**: [<name>-overall.md vX.Y](<path>)` — resolves to an existing `*-overall.md`, and the version tokens on the line must belong to the parent overall's lineage (its `**Version:**` header ∪ change-history cells).",
            },
          },
        },
        version: {
          type: "object",
          description:
            "`**Version**` — EXAMPLE field for a plan: only the phase-spec strictly requires a `**Version**` line; a plan header MAY carry one but no enforcing check reads it (the value has no lineage role at plan level). The example/template convention places it in the header block.",
        },
        dependsOn: {
          type: "object",
          description:
            "`**Depends on**` — upstream phase / spec pointers (e.g. `P1 design v1.1 Approved (sha)`); informational.",
        },
        base: {
          type: "object",
          description:
            "`**Base**` — the cdd-close read-base data source (e.g. `develop`); informational.",
        },
      },
    },
    constraints: {
      type: "object",
      description:
        "The plan's constraint surface — what `cdd implement` materializes plan-constraints.md from. The canonical form is DELTA-ONLY: the literal top-level `## Constraints` section carries the plan's own delta constraints, never a restatement of the inherited spec/overall conventions (which auto-apply). The legacy Form B prose pointers are retained as a read face for the existing doc tree only — new-form plans never use them (no silent fallback either: declaring neither source is a plan-constraints-source-undeclared block).",
      properties: {
        formACanonical: {
          type: "object",
          description:
            "Form A (canonical): the literal top-level `## Constraints` section — DELTA-ONLY, carrying the plan's own delta constraints as `###` sub-sections under it. The plan never owns a restated copy of the inherited conventions (the parent spec/overall conventions auto-apply and win on conflict).",
          properties: {
            heading: {
              type: "string",
              pattern: "^## Constraints\\s*$",
              description:
                "The literal `## Constraints` heading (the section is bounded by the next `##`/`#` heading, a `### Task` heading, or a `---` rule; `###` sub-sections stay inside).",
            },
            delta: {
              type: "object",
              description:
                "The delta-only rule — the section's content is the plan's own delta constraint set.",
              properties: {
                rule: {
                  type: "string",
                  const: "delta-only",
                  description:
                    "The section carries ONLY the plan's own delta constraints; the inherited spec/overall conventions auto-apply and are never restated.",
                },
              },
            },
          },
        },
        formBProseAnchors: {
          type: "object",
          description:
            "Form B (legacy — retained ONLY as the dual-read + extractProseConstraints read face for the existing plan tree): prose-pointer bold paragraphs in the preamble declare the constraint deltas under the four canonical anchor names. NEW-form plans must not use this form — the literal Form A `## Constraints` section is the single new-shape constraint surface.",
          properties: {
            anchors: {
              type: "array",
              items: {
                type: "string",
                // The anchor set is the shared PLAN_FORM_B_ANCHOR_TOKENS declaration (one anchor
                // edit lands in the authoring schema AND the parse anchor scans together).
                enum: [...PLAN_FORM_B_ANCHOR_TOKENS],
                description: "One prose-anchor label token — bold name + full-width colon.",
              },
              description:
                "The four prose anchors (`口径` / `commit 边界机制` / `Flow Atomicity` / `顺序原则`), each a bold paragraph label followed by a full-width-colon block. A qualifier like `**commit 边界机制（本 program 全 phase 生效）**：` still occupies the anchor's slot; adding a suffix (`**commit 边界机制 补充**：`) makes it a different token and never fills the anchor requirement.",
            },
          },
        },
      },
    },
    taskHeadings: {
      type: "object",
      description: "Task headings — the `### Task N:` render surface every task record sits under.",
      properties: {
        format: {
          type: "string",
          const: "### Task N:",
          description:
            "Colon format — `### Task N:` with an ASCII colon. A title after the colon is permitted and parse-tolerated (the task-heading scan `/^### Task \\d+:/` ignores everything after the colon); only a non-`:` delimiter after the number (em dash, Chinese colon, bare space) fails the heading parse at dispatch time.",
        },
        pattern: {
          type: "string",
          pattern: "^### Task \\d+:",
          description:
            "Task heading pattern — 1-indexed tasks from `### Task 1:` through `### Task N:`, an optional title after the colon is parse-tolerated.",
        },
        continuity: {
          type: "object",
          description:
            "Continuity rule — task numbers must be 1-indexed and contiguous (every number 1..max present exactly once; duplicates and gaps fail).",
          properties: {
            rule: {
              type: "string",
              const: "contiguous from 1",
              description:
                "taskNumbersFromPlan reads every `### Task N:` heading; the plan contract requires the extracted sequence to be exactly 1..N.",
            },
          },
        },
      },
    },
    tasks: {
      type: "array",
      description:
        "The plan's tasks — one task record per `### Task N:` block, the C3 data shape the brief renderer materializes the task-handoff brief from (renderBrief: objective + steps[action+checkable] + acceptance). Every task record's steps carry their checkable outcome (a step without a checkable fails validation).",
      items: {
        type: "object",
        required: ["objective", "files", "interface", "steps", "acceptance"],
        description:
          "One plan task record — objective / files / interface{consumes,produces} / steps[]{action,checkable} / acceptance[], plus the optional dependsOn? (the tasks this task depends on) and atomicWith? (the tasks this task is atomic with) edge fields — read/write: the task-block parser fills them from their `- **DependsOn**:` / `- **AtomicWith**:` comma lists, TaskGraph consumes them for the grouping + edge validation.",
        properties: {
          objective: {
            type: "string",
            description:
              "`- **Objective**: …` — the task's outcome statement (what the task delivers; the brief's lead line).",
          },
          files: {
            type: "array",
            items: {
              type: "string",
              description: "One file the task touches.",
            },
            description: "`- **Files**: …` — the files the task touches.",
          },
          interface: {
            type: "object",
            description:
              "`- **Consumes**:` / `- **Produces**:` — the task's typed interface surface: the consumed inputs and produced outputs the decomposition review judges the task boundaries by.",
            properties: {
              consumes: {
                type: "array",
                items: {
                  type: "string",
                  description:
                    "One consumed input slice — the task's typed dependency on an upstream slice.",
                },
                description: "The task's consumed inputs.",
              },
              produces: {
                type: "array",
                items: {
                  type: "string",
                  description: "One produced output slice — the task's typed deliverable surface.",
                },
                description: "The task's produced outputs.",
              },
            },
          },
          steps: {
            type: "array",
            description:
              "`- **Steps**:` — the ordered implementation steps; every step carries its verifiable outcome (checkable) — a step whose action has no checkable outcome fails validation (never an author's discretion).",
            items: {
              type: "object",
              required: ["action", "checkable"],
              description: "One step — an executable action + its verifiable outcome.",
              properties: {
                action: {
                  type: "string",
                  description: "The step's executable action.",
                },
                checkable: {
                  type: "string",
                  description:
                    "The step's verifiable outcome — required: the action line ends with ` — checkable: <outcome>` (the outcome is the step's acceptance evidence; a step missing it fails validation).",
                },
              },
            },
          },
          acceptance: {
            type: "array",
            items: {
              type: "string",
              description: "One acceptance criterion for the task.",
            },
            description: "`- **Acceptance**:` — the task's acceptance criteria.",
          },
          dependsOn: {
            type: "array",
            items: {
              type: "integer",
              minimum: 1,
              description: "One task id this task depends on (a `### Task N:` id).",
            },
            description:
              "The task ids this task depends on — the `- **DependsOn**:` comma list (read/write: the task-block parser fills it; TaskGraph consumes the edges).",
          },
          atomicWith: {
            type: "array",
            items: {
              type: "integer",
              minimum: 1,
              description: "One task id this task is atomic with (a `### Task N:` id).",
            },
            description:
              "The task ids this task is atomic with — the `- **AtomicWith**:` comma list (read/write: the task-block parser fills it; TaskGraph consumes the edges).",
          },
        },
      },
    },
    taskGroups: {
      type: "array",
      default: [],
      $defs: {
        section: {
          type: "object",
          description:
            "The `## Task Groups` section layout — the dispatch-group declaration's plan surface: the section heading const + the one-line entry form per merged group. Written to the plan ONLY when a non-trivial merged group exists (the plan-authoring judgment: a length-1 group never lands on disk — the single-task state exists only as the empty default below).",
          properties: {
            heading: {
              type: "string",
              const: "## Task Groups",
              description:
                "The section's top-level `##` heading (bounded like `## Constraints`: the next `#`/`##` heading, a `### Task N:` heading, or a `---` rule).",
            },
            entry: {
              type: "string",
              pattern: "^- \\*\\*Task (?:\\d+(?:, \\d+)*)\\*\\*:",
              description:
                "One merged-group line — `- **Task 1, 2**: <note>` — the task numbers comma-space separated (the `--tasks <a>,<b>` join form).",
            },
          },
        },
      },
      items: {
        type: "object",
        required: ["tasks"],
        description:
          "One declared dispatch group — the plan record of a merged `--tasks <a>,<b>` dispatch. Declared only when 2+ tasks merge; a length-1 group is redundant (the single-group state exists only as the empty default).",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "integer",
              minimum: 1,
              description: "One task number of the merged group (a `### Task N:` id).",
            },
            minItems: 2,
            uniqueItems: true,
            description:
              "The merged group's task numbers — unique and ascending (the deterministic group iteration order). minItems >= 2: a length-1 group is never declared.",
          },
        },
      },
      description:
        "Dispatch-group declaration — the plan author's dispatch-grouping decision in `author-plan` (its sole writer), carried by the plan's `## Task Groups` section; every dispatch iteration under `implement-group` reads it. Empty default: `[]` / an absent section ⇒ every `### Task N:` is its own singleton group — effectiveGroups = [[1],[2],…,[N]], exactly the pre-group per-task dispatch (zero migration); non-empty ⇒ effectiveGroups = the declared merged groups ∪ implicit single-task groups for any task a partial declaration leaves uncovered (the union is always the full plan task set). Section-persist rule: the section lands only when a non-trivial merged group exists — no groups → no section → empty default (zero plan churn).",
    },
    language: {
      type: "object",
      description:
        "Repo authoring policy applies to the plan's prose — the plan at docs/kairos/plans/ is an internal program doc written in the working language (Strategy B), value tokens (ids / tags / SHAs / paths) stay locale-neutral.",
    },
  },
};

/** The Form-B prose-pointer anchor heading scan for one anchor token — `**<name>(?:（qualifier）)?**：`
 *  -style declaration-heading line (full-width or ASCII colon accepted; a qualifier in full-width
 *  parens between the anchor name and the closing `**` allowed). Derived from the token — the bare
 *  name strips the bold wrap + trailing colon the same way deriveDocTokens derives `proseAnchors` —
 *  never re-typed in the parse plane. The derived name is regex-escaped before interpolation (the
 *  body-plane escape atom): a future anchor token carrying a regex metacharacter (e.g. `**v2.1**：`
 *  or `**C++**：`) stays a literal scan instead of silently corrupting the Form-B parse. */
function formBAnchorHeadingRe(token: string): RegExp {
  const name = token.replace(/^\*\*/, "").replace(/\*\*[：:].*$/, "");
  return new RegExp(`^\\*\\*${escapeRegExp(name)}(?:（[^）]*）)?\\*\\*[：:]`);
}

/** The Form-B anchor family — one `formBAnchor{digit}` slice per canonical anchor in declaration
 *  order (`formBAnchor1` = `**口径**：` … `formBAnchor4` = `**顺序原则**：`): the extractProseConstraints
 *  canonical-order walk reads this family off `projectSlicePatterns()` (the body leaf stays the
 *  anchor single source — the shape enum and these scans share PLAN_FORM_B_ANCHOR_TOKENS). */
function formBAnchorSlices(): Record<string, RegExp> {
  const out: Record<string, RegExp> = {};
  PLAN_FORM_B_ANCHOR_TOKENS.forEach((token, i) => {
    out[`formBAnchor${i + 1}`] = formBAnchorHeadingRe(token);
  });
  return out;
}

/** The plan's parse slice patterns — the concrete body's single-source regexes (design C3): the
 *  `### Task N:` render surface (the task-heading face the plan detection + the 1..N continuity
 *  contract parse from — the number captured for taskNumbersFromPlan), the Form-A `## Constraints`
 *  heading — the SHARED body-plane slice (`BODY_CONSTRAINTS_HEADING_RE`, the same regex the
 *  phase-spec body projects: the constraint-section extraction's plan-side pattern and the spec
 *  skeleton assertion read one byte source, never a hand-written duplicate per leaf), the Form-B
 *  prose-pointer anchor family (`formBAnchor1..4` — the extractProseConstraints canonical-order
 *  anchor scan), and the task-block data-field markers (objective / files / consumes / produces /
 *  steps / acceptance / dependsOn / atomicWith) the task-record parser slices the `### Task N:`
 *  blocks on. A numbered step
 *  entry captures its action + its optional checkable outcome in one regex — a step line without
 *  the `— checkable:` separator leaves the checkable capture empty (the validate-failing case,
 *  never silently dropped). */
const PLAN_SLICE_PATTERNS: SlicePatternSet = {
  taskHeading: /^### Task (\d+):/m,
  constraintsHeading: BODY_CONSTRAINTS_HEADING_RE,
  objective: /^- \*\*Objective\*\*:[ \t]*/,
  files: /^- \*\*Files\*\*:[ \t]*/,
  consumes: /^- \*\*Consumes\*\*:[ \t]*/,
  produces: /^- \*\*Produces\*\*:[ \t]*/,
  steps: /^- \*\*Steps\*\*:[ \t]*/,
  stepEntry: /^\s*\d+\.\s+(.+?)(?:\s*—\s*checkable:\s*(.*))?$/,
  acceptance: /^- \*\*Acceptance\*\*:[ \t]*/,
  acceptanceEntry: /^\s*[-*]\s+/,
  dependsOn: /^- \*\*DependsOn\*\*:[ \t]*/,
  atomicWith: /^- \*\*AtomicWith\*\*:[ \t]*/,
  ...formBAnchorSlices(),
};

/**
 * The plan concrete body (P2 T3; design C1/C3 — Criterion ②: class + constructor injection).
 * Carries the plan kind identity + authoring-way description and projects the two concrete
 * surfaces: the data-shaped schema (the DocType.shape derivation source for the SchemaFactory
 * product) and the parse slice regexes (the task-heading + task-block field single source). The
 * PlanBody-side task-brief render surface (renderBrief) lives here — off the abstract DocBody
 * contract (the phase-spec body never carries a task brief).
 */
export class PlanBody extends DocBody {
  constructor(opts: PlanBodyOpts) {
    super({ kind: "plan", description: opts.description });
  }

  /** The shape-domain projection — the data-shaped schema content (the module-level leaf; identity
   *  with the exported `PLAN_BODY_SHAPE` — the same projection product every consumer reads). */
  projectSchemaShape(): SchemaShape {
    return PLAN_BODY_SHAPE;
  }

  /** The parse slice-pattern projection — the `### Task N:` render surface + the task-block field
   *  markers (the task-record parser's single source). */
  projectSlicePatterns(): SlicePatternSet {
    return PLAN_SLICE_PATTERNS;
  }

  /** The task-handoff brief content, rendered from the Task data (design C3): the objective
   *  statement, the ordered steps (each action with its checkable outcome) and the acceptance
   *  criteria — zero prose carving, the legacy `- **Do**:` face is gone. The caller composes the
   *  task heading + TASK_BASE around this content. */
  renderBrief(task: Task): string {
    const out: string[] = [`- **Objective**: ${task.objective}`];
    if (task.steps.length > 0) {
      out.push("- **Steps**:");
      for (const step of task.steps) out.push(`  - ${step.action} — checkable: ${step.checkable}`);
    }
    if (task.acceptance.length > 0) {
      out.push("- **Acceptance**:");
      for (const a of task.acceptance) out.push(`  - ${a}`);
    }
    return `${out.join("\n")}\n`;
  }
}

/** Constructor options for the plan body — the authoring-way description (the kind identity is
 *  pinned to "plan" by the class, never caller-supplied). */
export interface PlanBodyOpts {
  /** The plan authoring-way prose (the DocBody.description single source). */
  description: string;
}

/** The plan body singleton — the constructor-injected doc-type wiring target (registry.ts passes it
 *  to `new PlanDocType(planBody)`; the doc-type's `shape` field is the body's projected shape, never
 *  a re-homed constant). */
export const planBody = new PlanBody({
  description:
    "Canonical plan authoring way: a metadata header five-tuple (`**Spec:**` — the Class-A `**Spec:**` marker + label==basename — · `**Parent program**` · `**Version**` · `**Depends on**` · `**Base**`), a delta-only `## Constraints` section (the plan's own deltas; the legacy Form B prose pointers are never used by new docs), the per-task data records (`### Task N:` headings + objective / files / interface{consumes,produces} / steps[]{action,checkable} / acceptance[] — every step carries its checkable outcome), and the optional `## Task Groups` dispatch-group declaration (written only when 2+ tasks merge). The task-handoff brief renders from the task records — zero prose `- **Do**:` carving.",
});
