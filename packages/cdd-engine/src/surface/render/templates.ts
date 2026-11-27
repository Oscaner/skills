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
// Module-level exports are types, the declared table and the class — zero bare functions.

import { CRITERIA, LENS_QUESTIONS, reviewKindOf } from "../../docs/judging/criteria.ts";
import type { TargetType } from "../../run/advance/target-faces.ts";

/** The three work-mode rows of the dispatch table — every work mode except `review`,
 *  whose rows live in `reviews` (one per target type). */
export type WorkModeRowKey = "implement" | "fix" | "docs-fix";

/** The three work-mode rows, in the order the table declares them. */
export const WORK_MODES: readonly WorkModeRowKey[] = ["implement", "fix", "docs-fix"];

/** One band row — the fixed prefix a dispatch of that mode / target renders. */
export interface BandRow {
  /** The row's key word — a work mode or a target type. */
  readonly key: string;
  /** The row's fixed prefix, line by line. */
  readonly shell: readonly string[];
}

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
}

/** One declared row's shell, keyed by the mode / target word it serves. The declarations
 *  are literal data: a row's prose is not derived from anything, so it is written once and
 *  read once. */
const row = <K extends string>(
  key: K,
  shell: readonly string[],
): { readonly key: K; readonly shell: readonly string[] } => ({ key, shell });

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
// the table and its renderer
// ---------------------------------------------------------------------------

/** The review variants, keyed by the target type — the ONE review-row declaration. The
 *  type annotation is the completeness pin: a target type with no row does not type-check. */
export const REVIEW_VARIANTS: Readonly<Record<TargetType, ReviewVariantRow>> = {
  wave: row("wave", REVIEW_SHELLS.wave),
  branch: row("branch", REVIEW_SHELLS.branch),
  "phase-spec": row("phase-spec", REVIEW_SHELLS["phase-spec"]),
  overall: row("overall", REVIEW_SHELLS.overall),
  plan: row("plan", REVIEW_SHELLS.plan),
  "single-spec": row("single-spec", REVIEW_SHELLS["single-spec"]),
};

/** The prompt data plane — the two band families and the shared return zone. */
export const TEMPLATE_PROMPT: PromptBands = {
  $version: PROMPT_VERSION,
  modes: {
    implement: row("implement", MODE_SHELLS.implement),
    fix: row("fix", MODE_SHELLS.fix),
    "docs-fix": row("docs-fix", MODE_SHELLS["docs-fix"]),
  },
  reviews: REVIEW_VARIANTS,
  return: { RETURN_PROSE },
};

/**
 * PromptBandsRenderer — the two prompt bands' ONE renderer. Invariant: a band is its
 * declared row plus the shared return zone, joined by one newline, so two renders of one
 * row are byte-identical and the two families cannot diverge in how they are composed.
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

  /** One work mode's prompt band. */
  prompt(mode: WorkModeRowKey): string {
    const row = this.#prompt.modes[mode];
    if (row === undefined) throw new Error(`templates: "${mode}" is not a declared mode row`);
    return PromptBandsRenderer.#band(this.#prompt, row);
  }

  /** One review prompt band. */
  review(type: TargetType): string {
    const row = this.#prompt.reviews[type];
    if (row === undefined) throw new Error(`templates: "${type}" is not a declared review row`);
    return PromptBandsRenderer.#band(this.#prompt, row);
  }

  /** The ONE join: the version line, the row, then the shared return zone. */
  static #band(prompt: PromptBands, row: BandRow): string {
    return [`$version ${prompt.$version}`, ...row.shell, ...prompt.return.RETURN_PROSE].join("\n");
  }
}
