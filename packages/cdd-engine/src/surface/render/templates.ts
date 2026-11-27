// packages/cdd-engine/src/surface/render/templates.ts
// The prompt bands — the two dispatch prompt families, rendered as bytes.
//
// INVARIANT — a prompt band is one DECLARED row plus one shared return zone: every work
// mode's fixed prefix and every target type's review prefix is a row of this file's table,
// and the renderer only joins the row with the return prose. No consumer re-spells a band,
// so a mode's prompt and a review's prompt can never drift from the table that declares
// them.
//
// The two bands are distinct on purpose:
//   · `modes` — the three non-review work modes (implement · fix · docs-fix), keyed by the
//     mode word the round context's ROLE carries;
//   · `reviews` — one row per target type the review mode can be asked for, so the six
//     review prompts are six declared rows rather than one row with a branch. A review row
//     shares one frame and one tail; what differs between two targets is DERIVED from the
//     judging slice's criteria table (the lens label set and the `**Criteria — <type>:**`
//     body, numbered lens list included), never re-spelled here — the reviewer is graded by
//     that table, so a second copy would be a second grading.
//
// `$version` is the band's own version: it rides the first line of every rendered prompt
// (`$version <n>`) and is bumped by a change to the band contract itself, never by a change
// to a row's prose.
//
// The rows carry `{{> cl:…}}` clause slots and `{{TOKEN}}` round-context slots verbatim.
// Expanding them belongs to the round-context assembly (the dispatch input), not to this
// renderer: a band's bytes are the declared row plus the return zone, so what a pin
// compares is the table, not a filled dispatch.
//
// Two more declarations ride the same plane, because the expansion's two inputs are data:
//   · the round-context LAYOUT — one declared line per cell each row renders, with the
//     three-state rule kept on the line itself: a value renders the line, an empty value
//     drops it (`drop`) or prints the bare literal `none`. What this table does NOT declare
//     yet is EXIGIBILITY — the arms that make a cell required on one target type and optional
//     on another, the `path` bit a missing-file refusal answers, and the `written` bit that
//     exempts the file the engine landed itself from an existence read. Nothing in this tree
//     reads those today: the four pre-dispatch stations reach
//     `run/gate/preflight.ts#PreFlight` as a ready `DispatchRowReading[]`, and the producer
//     that assembles them belongs to `run/advance/reads.ts` — task T17, not written yet. That producer owes the
//     `dispatch-input` row — and it owes declaring the arms HERE, because a second exigibility
//     table beside these layouts is the drift this declaration exists to prevent. Until it
//     lands, an empty value answers one question only: does the line render; nothing refuses a
//     required cell, so no "empty but required" state exists here;
//   · the CLAUSE PARTIALS — the eleven discipline sentences the shells name by `cl:<key>`,
//     one home, so a clause is written once and resolved once.
// The assembly composes those bytes (the prompt a child receives); this module only declares
// them, which is why `bandOf` answers the band's PARTS rather than one joined string.
//
// Module-level exports are types, the declared table and the class — zero bare functions.

import { CRITERIA, LENS_QUESTIONS, reviewKindOf } from "../../docs/judging/criteria.ts";
import type { TargetType } from "../../run/advance/target-faces.ts";

/** The three work-mode rows of the dispatch table — every work mode except `review`,
 *  whose rows live in `reviews` (one per target type). */
export type WorkModeRowKey = "implement" | "fix" | "docs-fix";

/** The three work-mode rows, in the order the table declares them. */
export const WORK_MODES: readonly WorkModeRowKey[] = ["implement", "fix", "docs-fix"];

/** One exigibility arm of a round-context cell — the target types it covers, optionally
 *  narrowed by a structural precondition. A cell may hang several CONJUNCTIVE arms; each is
 *  judged on its own and any hit makes the cell exigible. `types: []` is the `never`
 *  spelling — a legal declaration, not a missing one. */
export interface RequiredArm {
  /** The target types this arm covers — `always` (the row's whole served set) or a subset;
   *  an empty array names no type at all (`never`). */
  readonly types: "always" | readonly TargetType[];
  /** A structural precondition stacked on the same arm: the identity document DECLARED a
   *  `program:` / a shape (`doc-type:`). The declaration is what is read, never the
   *  resolved link value. */
  readonly when?: "program" | "identity";
}

/** One round-context line's declaration — the rendered line (a heading, a blank line, or a
 *  `- \`TOKEN\`: {{TOKEN}}` cell) plus what its EMPTY value prints and the cells that judge
 *  whether it is owed at all. There is no third absence state: a line with no value has
 *  exactly the two shapes below.
 *
 *  The exigibility arms live HERE because the round-context declaration is this table's: the
 *  station-row producer assembles the `dispatch-input` reading the gate refuses on, and it
 *  reads the arms off these declarations rather than keeping a second table beside them. */
export interface ContextLine {
  /** The rendered line. */
  readonly line: string;
  /** The cell's value names a file that must exist — the only bit `target-absent` reads. */
  readonly path?: true;
  /** What an empty value does to the line: drop it whole, or print the bare literal `none`. */
  readonly absent: "drop" | "none";
  /** The cells that make this line exigible, per target type (conjunctive arms). */
  readonly requiredOn: readonly RequiredArm[];
  /** The engine writes this cell's file itself before the child reads it (the brief), so an
   *  empty value earns no refusal and no existence read is taken. */
  readonly written?: "engine";
}

/** One band row — the fixed prefix a dispatch of that mode / target renders, and the round
 *  context it declares beneath that prefix. */
export interface BandRow {
  /** The row's key word — a work mode or a target type. */
  readonly key: string;
  /** The row's fixed prefix, line by line. */
  readonly shell: readonly string[];
  /** The row's round-context layout, line by line — the ONLY dynamic region of the prompt. */
  readonly context: readonly ContextLine[];
}

/** One band's three declared parts — what the assembly composes the prompt from. `fixed` is
 *  the version line and the row's shell, `returning` the ONE shared return zone, `layout`
 *  the row's round context. */
export interface PromptBandParts {
  readonly fixed: readonly string[];
  readonly returning: readonly string[];
  readonly layout: readonly ContextLine[];
}

/** The two band families — the work modes and the per-target review rows. */
export type BandFamily = "work" | "review";

/** One review band row, keyed by the target type it serves. */
export type ReviewVariantRow = BandRow & { readonly key: TargetType };

/** The prompt data plane — the two band families and the ONE return zone they share. */
export interface PromptBands {
  /** The band contract's version (`$version <n>` leads every rendered prompt). */
  readonly $version: number;
  readonly modes: Readonly<Record<WorkModeRowKey, BandRow>>;
  readonly reviews: Readonly<Record<TargetType, ReviewVariantRow>>;
  /** The `## Return` zone every band ends with. */
  readonly return: { readonly RETURN_PROSE: readonly string[] };
  /** The `{{> cl:…}}` clause partials — the shells name them, the assembly resolves them. */
  readonly clauses: Readonly<Record<string, string>>;
}

/** One declared row, keyed by the mode / target word it serves. The declarations are
 *  literal data: a row's prose is not derived from anything, so it is written once and
 *  read once. */
const row = <K extends string>(
  key: K,
  shell: readonly string[],
  context: readonly ContextLine[],
): {
  readonly key: K;
  readonly shell: readonly string[];
  readonly context: readonly ContextLine[];
} => ({ key, shell, context });

/** One round-context cell — the line spelling a `- \`TOKEN\`: {{TOKEN}}` row derives from the
 *  token's own name, so the spelled token and the filled slot cannot disagree. */
const cell = (token: string, spec: CellSpec = {}): ContextLine => ({
  line: `- \`${token}\`: {{${token}}}`,
  absent: spec.absent ?? "drop",
  requiredOn: spec.requiredOn ?? ALWAYS,
  ...(spec.path === true ? { path: true as const } : {}),
  ...(spec.written === undefined ? {} : { written: spec.written }),
});

/** One cell's declared facts besides its token — every one but the exigibility arms has a
 *  default, so a plain owed cell stays a one-argument declaration. */
interface CellSpec {
  readonly requiredOn?: readonly RequiredArm[];
  readonly absent?: "drop" | "none";
  readonly path?: true;
  readonly written?: "engine";
}

/** The `always` arm — the cell is owed on every face of the row. */
const ALWAYS: readonly RequiredArm[] = [{ types: "always" }];

/** The `never` arm — a value-less line, or a cell no target type owes. */
const NEVER: readonly RequiredArm[] = [{ types: [] }];

/** The two value-less lines every layout opens with — the heading and its separator. They
 *  carry no slot, so their `absent` cell is never consulted and no arm is exigible. */
const CONTEXT_HEAD: readonly ContextLine[] = [
  { line: "## Round context", absent: "drop", requiredOn: NEVER },
  { line: "", absent: "drop", requiredOn: NEVER },
];

// ---------------------------------------------------------------------------
// the declared rows
// ---------------------------------------------------------------------------

const MODE_SHELLS = {
  implement: [
    "# CDD dispatch — implement round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**Capability — `capability: may.amend = content`:** this round may amend the judged document's content face — the phase-spec, single-spec, overall charter and plan families (facts, file lists, steps, acceptance detail, cited line numbers). The structure face — the plan's Task id set and any task's `DependsOn` set — belongs to the orchestrator: the engine snapshots it at dispatch and compares it at the close, so changing it inside this round judges the round hard.",
    "**implement:** read `INPUT_WAVE_BRIEF` (the complete plan mirror — every `### Task N:` of the wave + the plan's `## Constraints` section, plus the previous review round's `## Notes` section when it left any, fresh-extracted at dispatch). `WAVE` = this round's wave (the task list); implement ALL tasks of the wave, never a subset. `CONFIRMED_SEAMS` in the brief → apply as-is; else propose test boundaries in the report, then invoke **`mattpocock-skills:implement`**. Write the handoff draft at `OUTPUT_HANDOFF` per `## Handoff schema` BEFORE the return block: `status` (APPROVED once applied, else BLOCKED + the reason in `notes`) and `artifacts` (the prescribed `OUTPUT_REPORT`/`OUTPUT_EVIDENCE` paths from the round context — the `{family}-{key}-` canonical names, zero free naming).",
    "**Evidence gate:** write the test-evidence file at the prescribed `OUTPUT_EVIDENCE` path per the `test-evidence` schema in `## Handoff schema` — `command`/`exit_code`/`passed`/`warnings_count` + `typecheck` (`command`/`exit_code`/`passed`); `behavior_change` when applicable. Update the round's report after verification. Missing or schema-violating evidence → the engine rewrites the draft to `status: BLOCKED`. Reports, test output, diffs: files only, never the return.",
    "Anything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "",
    "**Discipline clauses:**",
    "- {{> cl:english-comments}}",
    "- {{> cl:eof-newline}}",
    "- {{> cl:no-full-tree-find}}",
    "- {{> cl:bash-stall-limit}}",
    "- {{> cl:no-infinite-loop}}",
    "- {{> cl:plan-freeze}}",
    "- {{> cl:own-document}}",
    "- {{> cl:atomic-commit}}",
    "- {{> cl:self-validate}}",
    "- {{> cl:no-secret-access}}",
    "- {{> cl:sync-completion}}",
    "",
    "## Handoff schema",
    "",
    "{{HANDOFF_SCHEMA}}",
  ],
  fix: [
    "# CDD dispatch — fix round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**Capability — `capability: may.amend = content`:** this round may amend the judged document's content face — the phase-spec, single-spec, overall charter and plan families (facts, file lists, steps, acceptance detail, cited line numbers). The structure face — the plan's Task id set and any task's `DependsOn` set — belongs to the orchestrator: the engine snapshots it at dispatch and compares it at the close, so changing it inside this round judges the round hard.",
    "**Verify-then-apply:** verify each finding against the codebase's actual state before changing anything — apply a finding only when it is technically sound; a finding that does not hold up stays open with a note (never blind adoption). Apply findings one at a time and test each one before moving on.",
    "**Conditional TDD:** when a finding requires a behavior change and the change has no test coverage, write or adjust the tests first and drive the change red→green — the discipline applies conditionally, never as a blanket demand on every finding.",
    "**fix:** read `INPUT_REVIEWS` (open findings) + the plan context (`INPUT_WAVE_BRIEF` on a wave line — the complete plan mirror plus the previous review round's notes, when it left any; `INPUT_PLAN` on the branch line — the plan document; `INPUT_SPEC` on the wave and branch lines — the design spec, a conformance reference, never the judged document; `INPUT_OVERALL` on those two lines — that spec's parent charter, a conformance reference too). Fix ALL findings (blocker/warn), verifying against `INPUT_REVIEWS` none remain open. Fix + write the draft at `OUTPUT_HANDOFF` per `## Handoff schema` in one process; draft write failure → `status: BLOCKED`; retry = full re-run (idempotent).",
    '**Dispositions:** every requested finding needs a disposition keyed by its `id` exactly as the requesting carrier prints it (`F1`, `F2`, … — the summary is description only), valued `{ "status": "fixed" | "rejected", "reason"?: "…" }` — a missing or mis-keyed disposition fails the round.',
    "**Rulings:** read the orchestrator's ruling file named by `INPUT_RULINGS` before touching a finding — each ruling answers one finding id and overrides that finding's own suggestion (`REJECTED` = do not adopt that finding's fix); the carrier itself is read-only, never rewritten. `INPUT_RULINGS` is a path, or the literal `none` when this round has no ruling sidecar.",
    "**Evidence gate:** write the test-evidence file at the prescribed `OUTPUT_EVIDENCE` path per the `test-evidence` schema in `## Handoff schema` — `command`/`exit_code`/`passed`/`warnings_count` + `typecheck` (`command`/`exit_code`/`passed`); `behavior_change` when applicable. Update the round's report after verification. Missing or schema-violating evidence → the engine rewrites the draft to `status: BLOCKED`. Reports, test output, diffs: files only, never the return.",
    "Anything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "",
    "**Discipline clauses:**",
    "- {{> cl:english-comments}}",
    "- {{> cl:eof-newline}}",
    "- {{> cl:no-full-tree-find}}",
    "- {{> cl:bash-stall-limit}}",
    "- {{> cl:no-infinite-loop}}",
    "- {{> cl:plan-freeze}}",
    "- {{> cl:own-document}}",
    "- {{> cl:atomic-commit}}",
    "- {{> cl:self-validate}}",
    "- {{> cl:no-secret-access}}",
    "- {{> cl:sync-completion}}",
    "**Draft fields:** every top-level field of the draft comes from the `## Handoff schema` declared `properties` — the declaration is the field source, zero extra keys.",
    "",
    "## Handoff schema",
    "",
    "{{HANDOFF_SCHEMA}}",
  ],
  "docs-fix": [
    "# CDD dispatch — docs-fix round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**Capability — `capability: may.amend = content`:** this round may amend the judged document's content face — the phase-spec, single-spec, overall charter and plan families (facts, file lists, steps, acceptance detail, cited line numbers). The structure face — the plan's Task id set and any task's `DependsOn` set — belongs to the orchestrator: the engine snapshots it at dispatch and compares it at the close, so changing it inside this round judges the round hard.",
    "**docs-fix:** apply `INPUT_REVIEWS` (all severities) directly to the judged doc — `INPUT_PLAN` on a plan-doc line (where `INPUT_SPEC` is the design reference, never edited here), `INPUT_SPEC` on a spec-doc line, `INPUT_OVERALL` on the overall line — removing fixed findings; record the path in `artifacts.doc` and report the round in `status` (APPROVED once every finding is applied, else BLOCKED + the reason in `notes`). Fix + write the draft at `OUTPUT_HANDOFF` per `## Handoff schema` in one process; retry = full re-run (idempotent).",
    "**Change-history rows:** a new `## Change history` row bumps the front-matter `version:` in the same edit — the header version is the lineage's newest numeric version, and the two can never disagree.",
    "**Table cells:** never hard-wrap a table cell — a wrapped continuation parses as a row whose cell count disagrees with the header, and the lineage row it was meant to be stops registering.",
    "**Escaped pipes:** a `## Change history` summary cell that needs a literal vertical bar carries `\\|` — a bare `|` splits the cell in two and the row stops matching the declared header.",
    "**Written shape:** the edit obeys the two shape rules the gate judges — `line-coordinate` (cite a module path and symbol, never a line number), `live-arithmetic` (state no arithmetic over counts) — because the round's close re-reads the document and blocks the advance on every violation this round adds.",
    '**Dispositions:** every requested finding needs a disposition keyed by its `id` exactly as the requesting carrier prints it (`F1`, `F2`, … — the summary is description only), valued `{ "status": "fixed" | "rejected", "reason"?: "…" }` — a missing or mis-keyed disposition fails the round.',
    "**Rulings:** read the orchestrator's ruling file named by `INPUT_RULINGS` before touching a finding — each ruling answers one finding id and overrides that finding's own suggestion (`REJECTED` = do not adopt that finding's fix); the carrier itself is read-only, never rewritten. `INPUT_RULINGS` is a path, or the literal `none` when this round has no ruling sidecar.",
    "Anything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "",
    "**Discipline clauses:**",
    "- {{> cl:english-comments}}",
    "- {{> cl:eof-newline}}",
    "- {{> cl:no-full-tree-find}}",
    "- {{> cl:bash-stall-limit}}",
    "- {{> cl:no-infinite-loop}}",
    "- {{> cl:plan-freeze}}",
    "- {{> cl:own-document}}",
    "- {{> cl:atomic-commit}}",
    "- {{> cl:self-validate}}",
    "- {{> cl:no-secret-access}}",
    "- {{> cl:sync-completion}}",
    "**Draft fields:** every top-level field of the draft comes from the `## Handoff schema` declared `properties` — the declaration is the field source, zero extra keys.",
    "",
    "## Handoff schema",
    "",
    "{{HANDOFF_SCHEMA}}",
  ],
} as const;

/** The review rows' shared frame — the fixed text every review dispatch carries, up to and
 *  including the reference-face paragraph. The two lines that follow it are the ones the
 *  review criteria table derives per target, so they are not part of this frame. */
const REVIEW_FRAME: readonly string[] = [
  "# CDD dispatch — review round",
  "",
  "## Instructions",
  "",
  "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
  "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
  "**review:** review the criteria below against the reference face named in the round context. A wave review judges `INPUT_WAVE_BRIEF` (the complete plan mirror, plus the previous review round's `## Notes` section when it left any — a note changes no conclusion); the plan review judges the plan at `INPUT_PLAN`; the branch review judges the live tree against its base branch (`INPUT_PLAN` is its plan-conformance reference); the spec review judges the spec at `INPUT_SPEC`; the overall review judges the charter at `INPUT_OVERALL`; and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn → REVIEW_FIX · none → APPROVED) — a review never declares its own status. **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review. **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.\n\nAnything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
];

/** The review rows' shared tail — the discipline clauses and the injected handoff schema. */
const REVIEW_TAIL: readonly string[] = [
  "",
  "**Discipline clauses:**",
  "- {{> cl:english-comments}}",
  "- {{> cl:eof-newline}}",
  "- {{> cl:no-full-tree-find}}",
  "- {{> cl:bash-stall-limit}}",
  "- {{> cl:no-infinite-loop}}",
  "- {{> cl:plan-freeze}}",
  "- {{> cl:own-document}}",
  "- {{> cl:atomic-commit}}",
  "- {{> cl:self-validate}}",
  "- {{> cl:no-secret-access}}",
  "- {{> cl:sync-completion}}",
  "",
  "## Handoff schema",
  "",
  "{{HANDOFF_SCHEMA}}",
];

/**
 * One review band row. The frame and the tail are shared; the two lines between them are the
 * JUDGING slice's, not this file's: the target's lens label set and its
 * `**Criteria — <type>:**` body (the numbered lens list included) are read off the ONE
 * criteria table, so a review prompt can never carry a second spelling of the criteria it is
 * graded by — and the table is the only place that spelling lives.
 */
const reviewShell = (type: TargetType): readonly string[] => {
  const kind = reviewKindOf(type);
  const lenses = [...new Set(LENS_QUESTIONS.forKind(kind).map((row) => row.lens))];
  return [
    ...REVIEW_FRAME,
    `**Lens labels:** one of \`${lenses.join(" | ")}\` — every finding MUST carry its \`lens\`.`,
    `**Criteria — ${type}:** ${CRITERIA.textOf(kind)}`,
    ...REVIEW_TAIL,
  ];
};

/** The six review rows — one per target type, each over the shared frame and tail. */
const REVIEW_SHELLS: Readonly<Record<TargetType, readonly string[]>> = {
  wave: reviewShell("wave"),
  branch: reviewShell("branch"),
  "phase-spec": reviewShell("phase-spec"),
  overall: reviewShell("overall"),
  plan: reviewShell("plan"),
  "single-spec": reviewShell("single-spec"),
};

const RETURN_PROSE = [
  "## Return",
  "",
  "Report in a few plain sentences what this round did, whether it succeeded, and — if it",
  "did not — what blocked it. Nothing downstream parses this text; the handoff draft at",
  "`OUTPUT_HANDOFF` is the round's machine-readable result. Do not emit key-value lines,",
  "JSON, or any fixed block.",
  "",
  "(fail: an uncaught failure → exit non-zero with a one-line reason)",
] as const;

const PROMPT_VERSION = 27;

// ---------------------------------------------------------------------------
// the round-context layouts
// ---------------------------------------------------------------------------

/** The three work modes' round context. Each row declares the cells its own prose reads, in
 *  the order the child reads them: `implement` carries the wave's brief and the three write
 *  paths, `fix` adds the requesting carrier and the ruling sidecar, and `docs-fix` carries no
 *  evidence file (a document fix writes none). */
const IMPLEMENT_CONTEXT: readonly ContextLine[] = [
  ...CONTEXT_HEAD,
  cell("ROLE"),
  cell("WAVE"),
  cell("INPUT_WAVE_BRIEF", { path: true, written: "engine" }),
  cell("OUTPUT_REPORT"),
  cell("OUTPUT_EVIDENCE"),
  cell("OUTPUT_HANDOFF"),
  cell("WORKSPACE_DIR"),
  cell("WORKSPACE_ID"),
];

/** The fix row's round context — the wave line's brief, the branch line's plan, and the
 *  requesting carrier both lines read. The ruling sidecar renders `none` when the round has
 *  no sidecar: a dropped line and "the orchestrator wrote no rulings" are different facts. */
const FIX_CONTEXT: readonly ContextLine[] = [
  ...CONTEXT_HEAD,
  cell("ROLE"),
  cell("TARGET_TYPE"),
  cell("WAVE", { requiredOn: [{ types: ["wave"] }] }),
  cell("INPUT_WAVE_BRIEF", { path: true, written: "engine", requiredOn: [{ types: ["wave"] }] }),
  cell("INPUT_PLAN", { path: true, requiredOn: [{ types: ["branch"] }] }),
  cell("INPUT_SPEC", {
    path: true,
    requiredOn: [{ types: ["branch", "wave"], when: "identity" }],
  }),
  cell("INPUT_OVERALL", {
    path: true,
    requiredOn: [{ types: ["branch", "wave"], when: "program" }],
  }),
  cell("INPUT_REVIEWS", { path: true }),
  cell("INPUT_RULINGS", { path: true, requiredOn: NEVER, absent: "none" }),
  cell("OUTPUT_REPORT"),
  cell("OUTPUT_EVIDENCE"),
  cell("OUTPUT_HANDOFF"),
  cell("WORKSPACE_DIR"),
  cell("WORKSPACE_ID"),
];

/** The document-fix row's round context — the judged document and its references, no evidence
 *  file (the round writes none), and the same `none` arm for the ruling sidecar. */
const DOCS_FIX_CONTEXT: readonly ContextLine[] = [
  ...CONTEXT_HEAD,
  cell("ROLE"),
  cell("TARGET_TYPE"),
  cell("WAVE", { requiredOn: NEVER }),
  cell("INPUT_PLAN", { path: true, requiredOn: [{ types: ["plan"] }] }),
  cell("INPUT_SPEC", {
    path: true,
    requiredOn: [{ types: ["phase-spec", "single-spec"] }, { types: ["plan"], when: "identity" }],
  }),
  cell("INPUT_OVERALL", {
    path: true,
    requiredOn: [{ types: ["overall"] }, { types: ["phase-spec", "plan"], when: "program" }],
  }),
  cell("INPUT_REVIEWS", { path: true }),
  cell("INPUT_RULINGS", { path: true, requiredOn: NEVER, absent: "none" }),
  cell("OUTPUT_REPORT"),
  cell("OUTPUT_HANDOFF"),
  cell("WORKSPACE_DIR"),
  cell("WORKSPACE_ID"),
];

/** The review rows' ONE shared round context — a review is read-only, so its write side is
 *  the report and the draft alone, and it never carries the ruling sidecar (a review writes
 *  no ruling). The wave line adds the brief, the tree lines add `BASE_BRANCH`; a cell away
 *  from its line drops, which is how one layout serves all six targets. */
const REVIEW_CONTEXT: readonly ContextLine[] = [
  ...CONTEXT_HEAD,
  cell("ROLE"),
  cell("TARGET_TYPE"),
  cell("WAVE", { requiredOn: [{ types: ["wave"] }] }),
  cell("INPUT_WAVE_BRIEF", { path: true, written: "engine", requiredOn: [{ types: ["wave"] }] }),
  cell("INPUT_PLAN", { path: true, requiredOn: [{ types: ["plan", "branch"] }] }),
  cell("INPUT_SPEC", {
    path: true,
    requiredOn: [
      { types: ["phase-spec", "single-spec"] },
      { types: ["plan", "branch", "wave"], when: "identity" },
    ],
  }),
  cell("INPUT_OVERALL", {
    path: true,
    requiredOn: [
      { types: ["overall"] },
      { types: ["phase-spec", "plan", "branch", "wave"], when: "program" },
    ],
  }),
  cell("BASE_BRANCH", { requiredOn: [{ types: ["branch", "wave"] }] }),
  cell("OUTPUT_REPORT"),
  cell("OUTPUT_HANDOFF"),
  cell("WORKSPACE_DIR"),
  cell("WORKSPACE_ID"),
];

/**
 * The clause partials — the `{{> cl:…}}` forms the four shell texts name, each sentence
 * written ONCE. The assembly resolves a shell's slot to its declared bytes, so a clause can
 * never fork between two shells that both carry it.
 */
export const CLAUSES: Readonly<Record<string, string>> = {
  "cl:english-comments":
    "Write code comments and shipped prose in English only — English-primary (no other-language comment blocks, no translated mirrors).",
  "cl:eof-newline":
    "Every text file must end with exactly one newline (EOF newline): no missing final newline and no trailing blank lines.",
  "cl:no-full-tree-find":
    "Never run an unbounded full-tree `find` over a large directory and never bare-read a large file — constrain to explicit paths with `maxdepth`/`-path`, or read only the needed range.",
  // The ceiling is the prompt contract's own sentence: the engine's per-phase wall clock is a
  // separate declaration (`env/process/child-runner.ts`), so this clause states its minutes
  // rather than deriving them from a constant that governs a different limit.
  "cl:bash-stall-limit":
    "Put a `timeout` on every Bash command — no single invocation may run longer than 15 minutes; a command that stalls without progress is terminated and replaced with an equivalent, lighter command.",
  "cl:no-infinite-loop":
    "Never run an unbounded loop — no `while True: pass`, no `while true; do …; done`, no spin-wait or tail-follow that only a human can stop. A wait must carry a bounded exit condition (a timeout, a max-attempt counter, or a terminating predicate) that ends the loop on its own.",
  "cl:plan-freeze":
    "Approved plan/spec files are frozen beyond the round's declared `capability: may.amend` scope — without that declaration a needed change goes out through findings, never an in-place edit; the structure face is outside amending authority in every round.",
  "cl:own-document":
    "Write only your own documents: this round writes its own target document plus the files its own instruction names — an **implement** round writes the task files its wave brief names at `### Task N:`; a **fix** or **docs-fix** round writes the code files the findings view names (on a docs-fix round that is the judged document itself); a **review** round has no code write surface at all — its target document is read-only and its only writes are the prescribed `OUTPUT_*` artifacts, its `findings` carrier among them, never a document outside its own target — the `Read-only` sentence in this same prompt states the same rule from the carrier side. Every other document — the parent charter, a sibling spec, the plan — lies outside this round's write authority and lands through the orchestrator's backfill, never by the round's own hand. The division with `cl:plan-freeze`: that clause governs permission INSIDE the target document (may this document be changed at all), while this one governs the boundary of the document SET (which documents may be touched); when both are broken, the freeze clause is the one reported first.",
  "cl:atomic-commit":
    "Commit each round's change as one atomic conventional commit scoped to the round — no mixed or out-of-scope content, no AI-generation trailers. A read-only round has nothing to commit: its only writes are the prescribed `OUTPUT_*` artifacts, and committing belongs to the orchestrator.",
  "cl:self-validate":
    "Self-validate before returning: run the validation/checks your change requires and record the evidence (command + exit code + result) in the report.",
  "cl:no-secret-access":
    "Never read, print, or derive a user secret — no keychain access (`security find-generic-password` / `security dump-keychain` / `login.keychain-db`), no `~/.ssh/*`, `~/.aws/credentials`, `~/.netrc`, no host CLI credential store, and no token-bearing environment variable (`*_TOKEN` / `*_API_KEY` / `*_SECRET`). A missing or failing credential is never yours to obtain: report it as `status: BLOCKED` on a work round or as a finding on a review round, then continue with the rest. A secret that reaches a report, evidence file, handoff draft, commit, or issue body has leaked — if one is already visible in your inputs, redact it as `[REDACTED]` and never echo its value.",
  "cl:sync-completion":
    "This dispatch is one-shot and non-interactive: end your turn with anything still running and the process exits — the work and the handoff die with it. So do not end your turn — a background command, a background subagent, or any yield-and-wait path such as `bg_run` / `bg_delegate` — before the handoff draft is written. Finish nested work in this same turn: complete it synchronously in this process turn, then write the handoff and finish.",
};

// ---------------------------------------------------------------------------
// the table and its renderer
// ---------------------------------------------------------------------------

/** The review variants, keyed by the target type — the ONE review-row declaration. The
 *  type annotation is the completeness pin: a target type with no row does not type-check. */
export const REVIEW_VARIANTS: Readonly<Record<TargetType, ReviewVariantRow>> = {
  wave: row("wave", REVIEW_SHELLS.wave, REVIEW_CONTEXT),
  branch: row("branch", REVIEW_SHELLS.branch, REVIEW_CONTEXT),
  "phase-spec": row("phase-spec", REVIEW_SHELLS["phase-spec"], REVIEW_CONTEXT),
  overall: row("overall", REVIEW_SHELLS.overall, REVIEW_CONTEXT),
  plan: row("plan", REVIEW_SHELLS.plan, REVIEW_CONTEXT),
  "single-spec": row("single-spec", REVIEW_SHELLS["single-spec"], REVIEW_CONTEXT),
};

/** The prompt data plane — the two band families, the shared return zone and the clause
 *  partials the shells name. */
export const TEMPLATE_PROMPT: PromptBands = {
  $version: PROMPT_VERSION,
  modes: {
    implement: row("implement", MODE_SHELLS.implement, IMPLEMENT_CONTEXT),
    fix: row("fix", MODE_SHELLS.fix, FIX_CONTEXT),
    "docs-fix": row("docs-fix", MODE_SHELLS["docs-fix"], DOCS_FIX_CONTEXT),
  },
  reviews: REVIEW_VARIANTS,
  return: { RETURN_PROSE },
  clauses: CLAUSES,
};

/**
 * PromptBandsRenderer — the two prompt bands' ONE renderer. Invariant: a band is its
 * declared row plus the shared return zone, joined by one newline, so two renders of one
 * row are byte-identical and the two families cannot diverge in how they are composed.
 *
 * The band is that pinned face; the prompt a child RECEIVES is the assembly's composition of
 * the same parts (`bandOf`), which is why this class answers the parts rather than one joined
 * string alone — the round context is a zone of its own, never a suffix of the return prose.
 */
export class PromptBandsRenderer {
  readonly #prompt: PromptBands;

  constructor(prompt: PromptBands = TEMPLATE_PROMPT) {
    this.#prompt = prompt;
  }

  /** The band contract's version. */
  version(): number {
    return this.#prompt.$version;
  }

  /** The work modes the table declares. */
  modes(): readonly WorkModeRowKey[] {
    return WORK_MODES;
  }

  /** The target types the review band declares — read off the table, never a second list. */
  reviewTypes(): readonly TargetType[] {
    return Object.keys(this.#prompt.reviews) as TargetType[];
  }

  /** The clause partials the shells name — the assembly's second expansion input. */
  clauses(): Readonly<Record<string, string>> {
    return this.#prompt.clauses;
  }

  /** One band's three declared parts — the version line and the row's shell, the shared
   *  return zone, and the row's round-context layout. The assembly composes those bytes; a
   *  key the table does not declare is a hard error, never an empty band. */
  bandOf(family: BandFamily, key: string): PromptBandParts {
    const rowOf =
      family === "review"
        ? (this.#prompt.reviews[key as TargetType] as BandRow | undefined)
        : (this.#prompt.modes[key as WorkModeRowKey] as BandRow | undefined);
    if (rowOf === undefined) {
      throw new Error(`templates: "${key}" is not a declared ${family} row`);
    }
    return {
      fixed: [`$version ${this.#prompt.$version}`, ...rowOf.shell],
      returning: this.#prompt.return.RETURN_PROSE,
      layout: rowOf.context,
    };
  }

  /** One work mode's prompt band. */
  prompt(mode: WorkModeRowKey): string {
    return PromptBandsRenderer.#band(this.bandOf("work", mode));
  }

  /** One review prompt band. */
  review(type: TargetType): string {
    return PromptBandsRenderer.#band(this.bandOf("review", type));
  }

  /** The ONE join: the version line, the row, then the shared return zone. */
  static #band(parts: PromptBandParts): string {
    return [...parts.fixed, ...parts.returning].join("\n");
  }
}
