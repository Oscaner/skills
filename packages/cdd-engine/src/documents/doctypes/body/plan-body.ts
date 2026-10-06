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
// `**Base**`), a delta-only `## Constraints` face (the section carries the plan's own deltas — the
// single constraint surface), the `tasks[]` Task data records (objective / files /
// interface{consumes,produces} / steps[]{action,checkable} / acceptance[], plus the optional
// dependsOn?/atomicWith? edge fields — read/write: the task-block parser fills them and TaskGraph
// consumes them for the atomic-closure grouping + the edge-validation BLOCK face) the brief
// renderer materializes the task-handoff brief from. The `### Task N:` render surface keeps the
// colon-form heading const — the deriveDocTokens taskHeadings leaf and the 1..N continuity contract
// are byte-unchanged by the re-projection.
//
// renderBrief(task) carries the plan-only task-brief render surface — deliberately OFF the abstract
// DocBody contract (the phase-spec body never uses a task brief): the brief content renders the
// objective + the ordered steps (each action with its checkable outcome) + the acceptance criteria
// from the Task data, zero prose carving — the legacy `- **Do**:` face is gone.

import type { SchemaShape } from "../../doctype.ts";
import {
  BODY_CONSTRAINTS_HEADING_RE,
  DocBody,
  type SlicePatternSet,
  type StructureRule,
} from "./doc-body.ts";
import type { Task } from "./task.ts";

/** The data-shaped plan shape domain (P2 T3; design C3) — the projection product
 *  `projectSchemaShape()` serves and the module-level leaf tokens.ts authorizes its DOC_TOKENS plan
 *  input from. The deriveDocTokens leaf families keep their exact paths/values (taskHeadings
 *  format · constraints formACanonical heading) — the projection leaves the DOC_TOKENS plan
 *  derivation surface byte-unchanged. */
export const PLAN_BODY_SHAPE: SchemaShape = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://oscaner.dev/schemas/cdd/plan.json",
  title: "Phase implementation plan document structure",
  description:
    "Canonical structure of a kairos phase implementation plan — the per-phase executable breakdown of one design spec. This schema is the single structure fact for the plan doc type: the header fields, the `### Task N:` colon-form task headings, the per-task data records (objective / files / interface{consumes,produces} / steps[]{action,checkable} / acceptance[]) the brief renderer materializes the task-handoff brief from — zero prose `- **Do**:` carving — and the `## Constraints` delta (the section carries only the plan's own deltas, the single constraint surface). Authoring agents read the properties + descriptions to draft conforming plans; docContractValidate / brief extraction consume the same patterns.",
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
        "The plan's constraint surface — what `cdd implement` materializes plan-constraints.md from. The canonical form is DELTA-ONLY: the literal top-level `## Constraints` section carries the plan's own delta constraints, never a restatement of the inherited spec/overall conventions (which auto-apply). Declaring neither source is a plan-constraints-source-undeclared block.",
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
    language: {
      type: "object",
      description:
        "Repo authoring policy applies to the plan's prose — the plan at docs/kairos/plans/ is an internal program doc written in the working language (Strategy B), value tokens (ids / tags / SHAs / paths) stay locale-neutral.",
    },
  },
};

/** The plan's parse slice patterns — the concrete body's single-source regexes (design C3): the
 *  `### Task N:` render surface (the task-heading face the plan detection + the 1..N continuity
 *  contract parse from — the number captured for taskNumbersFromPlan), the Form-A `## Constraints`
 *  heading — the SHARED body-plane slice (`BODY_CONSTRAINTS_HEADING_RE`, the same regex the
 *  phase-spec body projects: the constraint-section extraction's plan-side pattern and the spec
 *  skeleton assertion read one byte source, never a hand-written duplicate per leaf), and the
 *  task-block data-field markers (objective / files / consumes / produces / steps / acceptance /
 *  dependsOn / atomicWith) the task-record parser slices the `### Task N:` blocks on. A numbered
 *  step entry captures its action + its optional checkable outcome in one regex — a step line
 *  without the `— checkable:` separator leaves the checkable capture empty (the validate-failing
 *  case, never silently dropped). */
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

  /** The plan structure-rule data (P3.1 T2 — the retired plan-contract text-assertion migration,
   *  design §2.2): task continuity + record presence (the data-shaped record face, every step's
   *  checkable) + constraints source + legacy residue, as rule data the ONE interpreter runs at the
   *  doc-contract gate. The anchors derive from the projected slices (`.source` — the parse-pattern
   *  single source, never a re-typed literal; the legacy-section / placeholder / Do-face residues
   *  are the retired faces' own anchors). The checkable rule is section-scoped (`within` — the
   *  interpreter's run-closed records plane): a numbered step counts as a checkable-judgment target
   *  only under a `- **Steps**:` field, exactly the retired contract's parsed-steps scope — a
   *  numbered line in Constraints prose or a code fence never demands a checkable. The Class-A
   *  `**Spec:**` cross-document chain is NOT on this plane — `#resolveSpecOf` stays on the plan doc
   *  type (P5 boundary). */
  structureRules(): readonly StructureRule[] {
    const heading = (re: RegExp): string => re.source;
    return [
      {
        id: "plan.tasks",
        plane: { kind: "headingLeads", anchor: heading(PLAN_SLICE_PATTERNS.taskHeading) },
        invariants: [{ type: "presence" }, { type: "continuity" }],
        severity: "BLOCK",
        message:
          "task headings must run `### Task 1:` … `### Task N:` — present at least once, 1-indexed and contiguous (no gaps / duplicates / offset)",
      },
      {
        id: "plan.recordData",
        plane: { kind: "records", anchor: "^- \\*\\*Do\\*\\*:" },
        invariants: [{ type: "residue" }],
        severity: "BLOCK",
        message:
          "a task block carrying the legacy `- **Do**:` face carries no data-shaped fields — shape the block as a data record (`- **Objective**:` / `- **Files**:` / `- **Interface**:`{consumes,produces} / `- **Steps**:` / `- **Acceptance**:`)",
      },
      {
        id: "plan.checkable",
        plane: {
          kind: "records",
          anchor: "^\\s*\\d+\\.\\s+(.*)$",
          within: heading(PLAN_SLICE_PATTERNS.steps),
        },
        invariants: [{ type: "domain", valuePattern: ".*—\\s*checkable:\\s*.+" }],
        severity: "BLOCK",
        message:
          "every `- **Steps**:` entry must end with ` — checkable: <outcome>` (the verifiable outcome is the step's acceptance evidence)",
      },
      {
        id: "plan.constraints",
        plane: { kind: "headingLeads", anchor: heading(PLAN_SLICE_PATTERNS.constraintsHeading) },
        invariants: [{ type: "presence" }],
        severity: "BLOCK",
        message:
          "plan declares no Constraints source — add a literal `## Constraints` section carrying the plan's deltas (the single constraint source)",
      },
      {
        id: "plan.legacySections",
        plane: { kind: "headingLeads", anchor: "^## (?!Constraints\\s*$)[^#]" },
        invariants: [{ type: "residue" }],
        severity: "BLOCK",
        message:
          "unknown top-level `##` section — the single-form plan owns exactly the declared `## Constraints` section surface (a legacy `## Task Groups` face is retired)",
      },
      {
        id: "plan.placeholders",
        plane: { kind: "records", anchor: "\\{\\{\\s*[^{}>\\n]+\\s*\\}\\}" },
        invariants: [{ type: "residue" }],
        severity: "BLOCK",
        message:
          "unfilled template token `{{…}}` — replace the placeholder with the real content (or drop the template syntax); `{{> …}}` handlebars partials are the in-repo mechanism and stay exempt",
      },
    ];
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
    "Canonical plan authoring way: a metadata header five-tuple (`**Spec:**` — the Class-A `**Spec:**` marker + label==basename — · `**Parent program**` · `**Version**` · `**Depends on**` · `**Base**`), a delta-only `## Constraints` section (the plan's own deltas — the single constraint surface), and the per-task data records (`### Task N:` headings + objective / files / interface{consumes,produces} / steps[]{action,checkable} / acceptance[] — every step carries its checkable outcome). The task-handoff brief renders from the task records — zero prose `- **Do**:` carving.",
});
