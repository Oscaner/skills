// packages/cdd-engine/src-next/render/templates.ts
// T21 — the template-contract typed surface: the template-contract JSON's data-plane
// home PLUS the TemplateAssembler (one module, one renderer). The dispatch prompt
// data (the per-mode shell frames · the review variants · the return-format block ·
// the round-context subsets · the token registry · the clause partials) and the
// review criteria (the four-type axes guides — P4, extended to spec/plan by the
// v1.8 review-closeout) are typed constant data here, imported never parsed:
//
//   · TEMPLATE_PROMPT — the rendering data plane the assembler consumes; this
//     module renders over it (the JSON's $schema/_doc prose plane is gone).
//   · REVIEWS — the four-type review criteria (task/branch axes guides + the
//     spec/plan URC prose, migrated from the dispatch table — their single typed
//     home, P4). P5 lands here: the "no parallel sub-agents" phrase is deleted.
//
// T15 v1.8 (the mode dispatch table — §3.5) restructures the prompt from "one all-mode
// manual + dynamic zone" to the per-mode dispatch table:
//   · MODE_PROMPTS — one row per work-mode (implement / fix / docs-fix — the ROLE
//     vocabulary; the spec/plan fix faces ride the docs-fix row): the mode's FIXED
//     prefix (its instruction shell + the injected writable-subset schema at the
//     shell's tail — byte-identical for every dispatch of the mode, so the prompt-
//     cache prefix groups by mode) + the mode's REDUCED round-context subset.
//   · REVIEW_VARIANTS — the review mode's four per-type rows (task/branch/spec/plan):
//     the criteria + lens text are FIXED PREFIX content (folded into each variant's
//     shell — they are per-type constants, so they never ride the dynamic tail; the
//     INPUT_CRITERIA / INPUT_LENS round-context tokens are gone) and each variant's
//     fixed prefix is byte-stable — a review dispatch's cache prefix groups by type.
//   · the normalized token vocabulary (§3.5): INPUT_* (read-side) / OUTPUT_* (write-
//     side) / WORKSPACE_* (environment) / FIX_BASE (the fix anchor) / ROLE (the
//     nominative identity) / WAVE (the wave-unitary unit). Round-context keys are
//     the mode's consumption set — a key the shell never names is not declared (the
//     fix round carries no INPUT_ RULES).
//
// T15 v1.9 (the handoff contract-surface rework — §3.6) lands the schema injection
// in the same plane: the `## Handoff schema` section at every shell's tail carries
// the {{HANDOFF_SCHEMA}} slot (projection ① of session/handoff-schema.ts — the same
// declared objects the engine validates the draft against, projection ②). The
// handoff-format prose is gone; RETURN_STDOUT_BLOCK is the ONE return contract.
//
// T15 v1.10/1.11 (the review-closeout batch — §3.7) refines the shell composition:
// the work-mode tail (evidence gate + commit contract) is the shared EVIDENCE_ITEM /
// COMMITS_*_ITEM cells (implement/fix carry both, docs-fix the commit contract only —
// zero per-mode duplication), and the review variants fold the criteria/lens in.
//
// P5 (M1) supersede: the implement mode's dispatch wording names the upstream
// `mattpocock-skills:implement` skill (the ref the dispatch row now resolves to),
// never the retired tdd alias.
//
// Module-level exports are types / the declared constant data / the class — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import type { TargetType } from "../session/faces.ts";

/** The per-dispatch slot values — one entry per declared template token. */
export interface TemplateValues {
  readonly [name: string]: string;
}

/** One token declaration — a round-context/return zone slot the dispatch fills. */
export interface TemplateToken {
  /** The token name — the `{{NAME}}` slot spelling. */
  name: string;
  /** The zone the token belongs to (shell / return / round-context). */
  zone: string;
}

/** One per-return-format block — the `## Return` zone's declared variants. */
export interface ReturnZone {
  [format: string]: readonly string[];
}

/** The work-modes of the dispatch table — the ROLE values (fix's spec/plan face is
 *  the docs-fix mode; review covers task/branch/spec/plan + branch-review). */
export type WorkMode = "implement" | "fix" | "review" | "docs-fix";

/** The work-mode rows of the dispatch table — every ROLE except review (the review
 *  mode's rows are the four per-type REVIEW_VARIANTS). */
export type WorkModeRowKey = Exclude<WorkMode, "review">;

/** The four review types — the review mode's per-type prefix variants (the criteria
 *  and lens are per-type constants, so each variant's fixed prefix is byte-stable). */

/** One dispatch-table row — a mode's fixed prefix + its reduced dynamic tail. */
export interface ModePromptRow {
  /** The work-mode identity (the ROLE vocabulary). */
  mode: WorkMode;
  /** The mode's FIXED prefix — its instruction shell + the `## Handoff schema`
   *  section (with the {{HANDOFF_SCHEMA}} slot at the tail — the injected
   *  writable-subset fence): byte-identical for every dispatch of the mode. */
  shell: readonly string[];
  /** The mode's REDUCED round-context subset — the only dynamic region; a key
   *  whose value is empty is not emitted (empty-valued keys are dropped). */
  roundContext: readonly string[];
}

/** The template prompt data plane — the work-mode rows + the review-per-type rows +
 *  the single return contract + the token registry + the clause partials. */
export interface TemplatePrompt {
  $version: number;
  /** The work-mode rows — one per non-review ROLE (§3.5; the review rows live in
   *  `reviews` — their ROLE value is "review" and REVIEW_TYPE selects the row). */
  modes: Readonly<Record<WorkModeRowKey, ModePromptRow>>;
  /** The review mode's per-type rows — each variant's fixed prefix carries its
   *  criteria + lens (folded in, never tokens). */
  reviews: Readonly<Record<TargetType, ModePromptRow>>;
  /** The `## Return` zone — the single block contract (v1.9). */
  return: ReturnZone;
  /** The token registry — the union across every mode's round context + the shell's
   *  schema slot (the gate's declared list). */
  tokens: readonly TemplateToken[];
  clauses: Readonly<Record<string, string>>;
}

/** One review guide row — the criteria of one review type (its lens vocabulary +
 *  the axes/URC prose — the review prompt's fixed criteria body). */
export interface ReviewGuideRow {
  /** The lens vocabulary — the finding lens labels the review may carry. */
  lensEnum: readonly string[];
  /** The reference face the review judges. */
  ref: string;
  /** The axes/URC guide prose — the criteria body (the task/branch four axes +
   *  verification-evidence duty; the spec/plan URC rows). */
  axesGuide: string;
}

/** The review criteria — the four per-type guides (P4 typed data; the spec/plan
 *  URC prose migrated from the dispatch table at v1.8 closeout). */
export type ReviewGuides = Readonly<Record<TargetType, ReviewGuideRow>>;

/** The nominal fixed-frame cells shared by every shell (byte-identical words — the
 *  fixed prefix is read on every dispatch, so every word costs child context). */
const FRAME_ITEMS: readonly string[] = [
  "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
  "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
];

/** The shared work-mode tail cells — the evidence gate + the commit contract
 *  (implement/fix carry both; docs-fix carries the commit contract only — zero
 *  per-mode duplication, §3.7). The evidence file's concrete name rides the
 *  injected schema's preamble (per-family prefix), never this fixed text. */
const EVIDENCE_ITEM =
  "**Evidence gate:** write the test-evidence file at the prescribed `OUTPUT_EVIDENCE` path per the `test-evidence` schema in `## Handoff schema` — `command`/`exit_code`/`passed`/`warnings_count` + `typecheck` (`command`/`exit_code`/`passed`); `behavior_change` when applicable. Update the round's report after verification. Missing or schema-violating evidence → the engine rewrites the draft to `status: BLOCKED`. Reports, test output, diffs: files only, never the return.";
const COMMITS_TASK_ITEM =
  "**Commits:** `base` = `WAVE_BASE`. Verification already committed this scope → `head` = `git rev-parse HEAD` (no duplicate); else create **one** conventional commit (`feat:`/`fix:`/`refactor:`/…, no attribution/AI trailers) then `head` = `git rev-parse HEAD`. Uncommitted or out-of-scope changes at return → `status: BLOCKED` (engine rewrites + surfaces `CDD_BLOCKED:`; off-ledger commits land in `notes`).";
const COMMITS_FIX_ITEM =
  "**Commits:** `base` = `FIX_BASE`; one conventional commit (`fix:`/`refactor:`/…, no attribution/AI trailers) unless verification already committed it. Uncommitted or out-of-scope changes at return → `status: BLOCKED` (engine rewrites + surfaces `CDD_BLOCKED:`; off-ledger commits land in `notes`).";

/** The discipline-clause cells shared by every shell (the `{{> cl:…}}` partials
 *  resolve from the single clause container — the same bytes, one per shell). */
const LICENSE_ITEMS: readonly string[] = [
  "",
  "**Discipline clauses:**",
  "- {{> cl:english-comments}}",
  "- {{> cl:eof-newline}}",
  "- {{> cl:no-full-tree-find}}",
  "- {{> cl:bash-stall-limit}}",
  "- {{> cl:plan-freeze}}",
  "- {{> cl:atomic-commit}}",
  "- {{> cl:self-validate}}",
  "- {{> cl:changed-surface}}",
];

/** The `## Handoff schema` section — the injected writable-subset fence at every
 *  shell's tail (the {{HANDOFF_SCHEMA}} slot; the face's sets differ per mode, so
 *  the section's bytes are fixed per mode — §3.5 prefix-cache grouping). */
const SCHEMA_SECTION: readonly string[] = ["", "## Handoff schema", "", "{{HANDOFF_SCHEMA}}"];

/** The implement row's fixed prefix — header + instructions + the shared work tail. */
const IMPLEMENT_SHELL: readonly string[] = [
  "# CDD dispatch — implement round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  "**implement:** read `INPUT_WAVE_BRIEF` (the wave brief) + the plan's `## Constraints` via `INPUT_PLAN` (the constraint document itself — the round context carries no materialized rules file). `WAVE` = this round's wave (the task list); `INPUT_WAVE_BRIEF` holds every `### Task N:` section — implement ALL tasks of the wave, never a subset. `CONFIRMED_SEAMS` in the brief → apply as-is; else propose test boundaries in the report, then invoke **`mattpocock-skills:implement`**. Write the handoff draft at `OUTPUT_HANDOFF` per `## Handoff schema` BEFORE the return block: `status` (APPROVED once applied, else BLOCKED + `failure_category`), `artifacts` (the prescribed `OUTPUT_BRIEF`/`OUTPUT_REPORT`/`OUTPUT_EVIDENCE` paths from the round context — the `{family}-{key}-` canonical names, zero free naming), `commits` (`base` = `WAVE_BASE`; `head` = `git rev-parse HEAD`), `changes[]` (every changed file + reason).",
  EVIDENCE_ITEM,
  COMMITS_TASK_ITEM,
  ...LICENSE_ITEMS,
  ...SCHEMA_SECTION,
];

/** The fix row's fixed prefix — header + instructions + the shared work tail. */
const FIX_SHELL: readonly string[] = [
  "# CDD dispatch — fix round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  "**fix:** read `INPUT_FINDINGS` (open findings) + `INPUT_WAVE_BRIEF` (wave brief — context). Fix ALL findings (blocker/warn/nit), verifying against `INPUT_FINDINGS` none remain open. `commits.base` = `FIX_BASE` (the prior handoff's `commits.head`); `commits.head` = `git rev-parse HEAD` — no diff vs `FIX_BASE` → no commit (keep `head`). Fix + write the draft at `OUTPUT_HANDOFF` per `## Handoff schema` in one process; draft write failure → `status: BLOCKED`; retry = full re-run (idempotent).",
  EVIDENCE_ITEM,
  COMMITS_FIX_ITEM,
  ...LICENSE_ITEMS,
  ...SCHEMA_SECTION,
];

/** The docs-fix row's fixed prefix — header + instructions + the commit contract
 *  cell (no evidence — the docs-fix face writes no evidence file). */
const DOCS_FIX_SHELL: readonly string[] = [
  "# CDD dispatch — docs-fix round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  "**docs-fix:** apply `INPUT_FINDINGS` (all severities) directly to `INPUT_DOC`, removing fixed findings; record the path in `artifacts.doc`; empty `findings` = all fixed. Fix + write the draft at `OUTPUT_HANDOFF` per `## Handoff schema`; the engine derives the conclusion from the residual findings; draft write failure → `status: BLOCKED`; retry = full re-run (idempotent).",
  COMMITS_FIX_ITEM,
  ...LICENSE_ITEMS,
  ...SCHEMA_SECTION,
];

/** The review variants' shared instruction text — the review's mode rule (the
 *  criteria body + the lens vocabulary ride per-type fixed items below). */
const REVIEW_ITEM =
  "**review:** review the criteria below against `INPUT_RANGE`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · none → APPROVED) — a review never declares its own status.";

/** The review mode's shared reduced tail — the only dynamic region of every review
 *  variant (the criteria/lens are fixed-prefix per type, never here). */
const REVIEW_CONTEXT: readonly string[] = [
  "## Round context",
  "",
  "- `ROLE`: {{ROLE}}",
  "- `WAVE`: {{WAVE}}",
  "- `INPUT_RANGE`: {{INPUT_RANGE}}",
  "- `INPUT_PLAN`: {{INPUT_PLAN}}",
  "- `OUTPUT_REPORT`: {{OUTPUT_REPORT}}",
  "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
  "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
  "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
];

/** The work-mode dispatch rows — implement / fix / docs-fix (§3.5; the review rows
 *  are REVIEW_VARIANTS). */
const MODE_PROMPTS: Readonly<Record<WorkModeRowKey, ModePromptRow>> = {
  implement: {
    mode: "implement",
    shell: IMPLEMENT_SHELL,
    roundContext: [
      "## Round context",
      "",
      "- `ROLE`: {{ROLE}}",
      "- `WAVE`: {{WAVE}}",
      "- `INPUT_WAVE_BRIEF`: {{INPUT_WAVE_BRIEF}}",
      // find #4 + #5 — no INPUT_RULES (the plan's ## Constraints rides INPUT_PLAN);
      // the OUTPUT_* write paths are prescribed (the {family}-{key}- canonical names)
      "- `OUTPUT_BRIEF`: {{OUTPUT_BRIEF}}",
      "- `OUTPUT_REPORT`: {{OUTPUT_REPORT}}",
      "- `OUTPUT_EVIDENCE`: {{OUTPUT_EVIDENCE}}",
      "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
      "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
      "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
    ],
  },
  fix: {
    mode: "fix",
    shell: FIX_SHELL,
    roundContext: [
      "## Round context",
      "",
      "- `ROLE`: {{ROLE}}",
      "- `WAVE`: {{WAVE}}",
      "- `INPUT_WAVE_BRIEF`: {{INPUT_WAVE_BRIEF}}",
      "- `INPUT_FINDINGS`: {{INPUT_FINDINGS}}",
      "- `FIX_BASE`: {{FIX_BASE}}",
      "- `OUTPUT_REPORT`: {{OUTPUT_REPORT}}",
      "- `OUTPUT_EVIDENCE`: {{OUTPUT_EVIDENCE}}",
      "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
      "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
      "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
    ],
  },
  "docs-fix": {
    mode: "docs-fix",
    shell: DOCS_FIX_SHELL,
    roundContext: [
      "## Round context",
      "",
      "- `ROLE`: {{ROLE}}",
      "- `WAVE`: {{WAVE}}",
      "- `INPUT_DOC`: {{INPUT_DOC}}",
      "- `INPUT_FINDINGS`: {{INPUT_FINDINGS}}",
      "- `FIX_BASE`: {{FIX_BASE}}",
      "- `OUTPUT_REPORT`: {{OUTPUT_REPORT}}",
      "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
      "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
      "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
    ],
  },
};

/** The four-type review criteria — the review prompts' fixed criteria body (P4; the
 *  spec/plan URC rows migrated from the dispatch table at the v1.8 closeout — their
 *  single typed home). */
export const REVIEWS = {
  wave: {
    lensEnum: ["standards", "spec", "buildability"],
    ref: "WAVE_BASE..HEAD",
    axesGuide:
      "Standards axis (repo coding standards + code-review smell baseline) + Spec axis (wave brief / plan requirements) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — `tsc --noEmit`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): cross-check the handoff's `changes[]` ledger against the actual `git diff <base>..HEAD` fileset — any changed file with no ledger entry and no brief-seam attribution is a candidate finding (severity by your judgment; warn-level booking gaps the engine flagged can surface here as blockers when they expose out-of-brief changes). Single agent, four axes.",
  },
  branch: {
    lensEnum: ["standards", "spec", "buildability"],
    ref: "BASE..HEAD",
    axesGuide:
      "Same four axes as task (branch-wide health: diff BASE..HEAD + plan conformance) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — `tsc --noEmit`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): branch review IS the full diff — every changed file must be attributable to a finding, a plan requirement, or the reviewed intent; unrelated surface = candidate finding (severity by your judgment), normal finding → fix loop.",
  },
  spec: {
    lensEnum: ["completeness", "consistency", "clarity"],
    ref: "INPUT_RANGE",
    axesGuide:
      "Follow URC: single-cycle, lens-tagged findings (completeness/consistency/clarity) + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence",
  },
  plan: {
    lensEnum: ["completeness", "decomposition", "buildability"],
    ref: "INPUT_RANGE",
    axesGuide:
      "Follow URC: single-cycle, lens-tagged findings (completeness/decomposition/buildability) + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence",
  },
} as const satisfies ReviewGuides;

/** The per-type facts the review variants compose at module-const time (the lens
 *  vocabularies + the criteria bodies — single data references, never restates). */
const REVIEWS_WAVE_LENS = REVIEWS.wave.lensEnum.join(" | ");
const REVIEWS_BRANCH_LENS = REVIEWS.branch.lensEnum.join(" | ");
const REVIEWS_SPEC_LENS = REVIEWS.spec.lensEnum.join(" | ");
const REVIEWS_PLAN_LENS = REVIEWS.plan.lensEnum.join(" | ");
const REVIEW_WAVE_AXES = REVIEWS.wave.axesGuide;
const REVIEW_BRANCH_AXES = REVIEWS.branch.axesGuide;
const REVIEW_SPEC_URC = REVIEWS.spec.axesGuide;
const REVIEW_PLAN_URC = REVIEWS.plan.axesGuide;

/** The review mode's four per-type rows (§3.7) — each variant's fixed prefix folds
 *  its criteria + lens INLINE (the `INPUT_CRITERIA`/`INPUT_LENS` round-context
 *  tokens are gone), and shares the REVIEW_CONTEXT dynamic tail. */
const REVIEW_VARIANTS: Readonly<Record<TargetType, ModePromptRow>> = {
  wave: {
    mode: "review",
    shell: [
      "# CDD dispatch — review round",
      "",
      "## Instructions",
      "",
      ...FRAME_ITEMS,
      REVIEW_ITEM,
      `**Lens labels:** one of \`${REVIEWS_WAVE_LENS}\` — every finding MUST carry its \`lens\`.`,
      `**Criteria — wave:** ${REVIEW_WAVE_AXES}`,
      ...LICENSE_ITEMS,
      ...SCHEMA_SECTION,
    ],
    roundContext: REVIEW_CONTEXT,
  },
  branch: {
    mode: "review",
    shell: [
      "# CDD dispatch — review round",
      "",
      "## Instructions",
      "",
      ...FRAME_ITEMS,
      REVIEW_ITEM,
      `**Lens labels:** one of \`${REVIEWS_BRANCH_LENS}\` — every finding MUST carry its \`lens\`.`,
      `**Criteria — branch:** ${REVIEW_BRANCH_AXES}`,
      ...LICENSE_ITEMS,
      ...SCHEMA_SECTION,
    ],
    roundContext: REVIEW_CONTEXT,
  },
  spec: {
    mode: "review",
    shell: [
      "# CDD dispatch — review round",
      "",
      "## Instructions",
      "",
      ...FRAME_ITEMS,
      REVIEW_ITEM,
      `**Lens labels:** one of \`${REVIEWS_SPEC_LENS}\` — every finding MUST carry its \`lens\`.`,
      `**Criteria — spec:** ${REVIEW_SPEC_URC}`,
      ...LICENSE_ITEMS,
      ...SCHEMA_SECTION,
    ],
    roundContext: REVIEW_CONTEXT,
  },
  plan: {
    mode: "review",
    shell: [
      "# CDD dispatch — review round",
      "",
      "## Instructions",
      "",
      ...FRAME_ITEMS,
      REVIEW_ITEM,
      `**Lens labels:** one of \`${REVIEWS_PLAN_LENS}\` — every finding MUST carry its \`lens\`.`,
      `**Criteria — plan:** ${REVIEW_PLAN_URC}`,
      ...LICENSE_ITEMS,
      ...SCHEMA_SECTION,
    ],
    roundContext: REVIEW_CONTEXT,
  },
};

/** The `## Return` zone — the single block contract (v1.9: the child's content
 *  lives in the draft file, the block is the three-line pointer every mode
 *  returns). */
const RETURN_ZONE: ReturnZone = {
  RETURN_STDOUT_BLOCK: [
    "## Return",
    "",
    "Output exactly 3 lines — this block is the FINAL output; nothing may follow it:",
    "",
    "```",
    "status: <APPROVED|BLOCKED>",
    "commits: base=<sha> head=<sha>",
    "artifacts: brief=<path> report=<path> test_evidence=<path>",
    "```",
    "",
    "RETURN_STDOUT_BLOCK (one contract): the handoff content (findings/notes/changes/evidence) lives in the draft at `OUTPUT_HANDOFF` — this block is the pointer. Review/docs-fix rounds state `status: APPROVED` (their conclusion derives from the draft's findings); work rounds state the concluding status. Never emit the 4th `counters:` / 5th `next:` lines (the engine appends them). Any non-`APPROVED` status (e.g. `NEEDS_CONTEXT`) → collapsed to `BLOCKED` + exit 1.",
    "",
    "The `artifacts:` line's paths are the round context's prescribed `OUTPUT_BRIEF`/`OUTPUT_REPORT`/`OUTPUT_EVIDENCE` values — copy them verbatim (zero free naming; a declared path deviating from the canonical name is corrected to it and flagged on the carrier's notes).",
  ],
};

/** The token registry — the union across every mode's round context + the shell's
 *  schema slot (the v1.8 normalized vocabulary; the assembly face supplies every
 *  declared slot, empty where the mode does not consume it — the round-context
 *  renderer drops the empty-valued lines). REVIEW_TYPE is the review-mode row
 *  selector (supplied but never rendered); INPUT_CRITERIA/INPUT_LENS are gone
 *  (§3.7 — the review criteria/lens are fixed-prefix per type). */
const TOKENS: readonly TemplateToken[] = [
  { name: "FIX_BASE", zone: "round-context" },
  { name: "HANDOFF_SCHEMA", zone: "shell" },
  { name: "INPUT_DOC", zone: "round-context" },
  { name: "INPUT_FINDINGS", zone: "round-context" },
  { name: "INPUT_PLAN", zone: "round-context" },
  { name: "INPUT_RANGE", zone: "round-context" },
  { name: "INPUT_WAVE_BRIEF", zone: "round-context" },
  // find #5 — the prescribed artifact write paths (the {family}-{key}-{artifact}
  // single naming; INPUT_RULES is retired — the plan's ## Constraints rides INPUT_PLAN)
  { name: "OUTPUT_BRIEF", zone: "round-context" },
  { name: "OUTPUT_REPORT", zone: "round-context" },
  { name: "OUTPUT_EVIDENCE", zone: "round-context" },
  { name: "OUTPUT_HANDOFF", zone: "round-context" },
  { name: "REVIEW_TYPE", zone: "round-context" },
  { name: "ROLE", zone: "round-context" },
  { name: "WAVE", zone: "round-context" },
  { name: "WORKSPACE_DIR", zone: "round-context" },
  { name: "WORKSPACE_ID", zone: "round-context" },
];

/** The clause partials — the `{{> cl:…}}` forms of the discipline clauses. */
export const CLAUSES = {
  "cl:english-comments":
    "Write code comments and shipped prose in English only — English-primary (no other-language comment blocks, no translated mirrors).",
  "cl:eof-newline":
    "Every text file must end with exactly one newline (EOF newline): no missing final newline and no trailing blank lines.",
  "cl:no-full-tree-find":
    "Never run an unbounded full-tree `find` over a large directory and never bare-read a large file — constrain to explicit paths with `maxdepth`/`-path`, or read only the needed range.",
  "cl:bash-stall-limit":
    "If a Bash command stalls without progress for more than 10 minutes, terminate it and substitute an equivalent, lighter command.",
  "cl:plan-freeze":
    "Approved plan/spec files are frozen — zero modification authority; any change needed is reported to the orchestrator through findings, never edited in place.",
  "cl:atomic-commit":
    "Commit each round's change as one atomic conventional commit scoped to the round — no mixed or out-of-scope content, no AI-generation trailers.",
  "cl:self-validate":
    "Self-validate before returning: run the validation/checks your change requires and record the evidence (command + exit code + result) in the report.",
  "cl:changed-surface":
    "Changed-surface bookkeeping: implement/fix rounds declare every file they changed in the handoff `changes[]` ledger (file + reason each). The engine reconciles `git diff <base>..HEAD` against it — files off the ledger are surfaced (warn + notes), never blocked; the review scope axis judges them (normal finding → fix loop).",
} as const;

/** The dispatch-prompt data plane — the typed template-contract surface. $version 6
 *  marks the v1.8-closeout reparametrization (review per-type prefixes + the shared
 *  work tail + the INPUT_CRITERIA/INPUT_LENS token removal) over the v1.8 dispatch
 *  table + the v1.9 single-return + schema-injection base (§3.5 · §3.6 · §3.7). */
export const TEMPLATE_PROMPT = {
  $version: 6,
  modes: MODE_PROMPTS,
  reviews: REVIEW_VARIANTS,
  return: RETURN_ZONE,
  tokens: TOKENS,
  clauses: CLAUSES,
} as const satisfies TemplatePrompt;

/** The ROLE vocabulary — the four work-modes of the dispatch table (§3.5). */
export const WORK_MODES: readonly WorkMode[] = ["implement", "fix", "review", "docs-fix"];

/**
 * The template assembler — the ONE renderer over the typed template-prompt data
 * plane. Construction reads the typed contract (the module's declared data —
 * no file reads, no second copy). render(values) selects the row by the ROLE value
 * (the review mode by ROLE + REVIEW_TYPE) — the row's fixed prefix + the single
 * return contract + its reduced round context (empty-value keys not emitted).
 */
export class TemplateAssembler {
  readonly #contract: TemplatePrompt;

  constructor() {
    this.#contract = TEMPLATE_PROMPT;
  }

  /** The return formats the contract declares — the single block contract (v1.9:
   *  one format; every pre-v1.9 return variant is retired). */
  returnFormats(): readonly string[] {
    return Object.keys(this.#contract.return);
  }

  /** The tokens the contract declares (the union across every mode — all zones). */
  declaredTokens(): readonly string[] {
    return this.#contract.tokens.map((token) => token.name);
  }

  /** The work-modes of the dispatch table — the ROLE vocabulary. */
  workModes(): readonly WorkMode[] {
    return WORK_MODES;
  }

  /** Assemble the full dispatch template for a role with the slot values — the
   *  row's fixed prefix + the single return contract + its reduced round context
   *  (empty-value keys omitted). */
  render(values: TemplateValues): string {
    this.#gate(values);
    const row = this.#rowOf(values);
    const zones: Record<string, string> = {
      shell: this.#joinLines(row.shell),
      return: this.#joinLines(this.#contract.return.RETURN_STDOUT_BLOCK),
      "round-context": this.#contextLines(row, values),
    };
    return this.#fill([zones.shell, zones.return, zones["round-context"]].join("\n\n"), values);
  }

  #joinLines(lines: readonly string[]): string {
    return lines.join("\n");
  }

  /** The row of a ROLE — the review mode's per-type variant (selected by the
   *  REVIEW_TYPE discriminant), the work modes from the modes table. */
  #rowOf(values: TemplateValues): ModePromptRow {
    if (values.ROLE === "review") {
      const row = this.#contract.reviews[values.REVIEW_TYPE as TargetType];
      if (row === undefined) {
        throw new Error(
          `template review type not declared: ${values.REVIEW_TYPE === undefined || values.REVIEW_TYPE === "" ? "(missing REVIEW_TYPE)" : values.REVIEW_TYPE}`,
        );
      }
      return row;
    }
    const row = this.#contract.modes[values.ROLE as WorkModeRowKey];
    if (row === undefined) {
      throw new Error(
        `template work-mode not declared: ${values.ROLE === undefined ? "(missing ROLE)" : values.ROLE}`,
      );
    }
    return row;
  }

  /** The reduced round-context section — the row's subset, a key whose value is
   *  empty omitted (only present facts land in the dynamic region). */
  #contextLines(row: ModePromptRow, values: TemplateValues): string {
    const lines: string[] = [];
    for (const line of row.roundContext) {
      const slot = line.match(/\{\{([A-Z0-9_]+)\}\}/)?.[1];
      if (slot !== undefined && values[slot] === "") continue;
      lines.push(line);
    }
    return lines.join("\n");
  }

  /** The hard gates — a known ROLE (+ its REVIEW_TYPE for reviews), every declared
   *  token supplied (empty allowed — a mode's non-consumed slots are legitimately
   *  empty and merely not emitted), no undeclared values, the single return
   *  contract declared. */
  #gate(values: TemplateValues): void {
    const role = values.ROLE;
    const row =
      role === undefined
        ? undefined
        : role === "review"
          ? this.#reviewRow(values)
          : this.#workRow(role);
    if (row === undefined) {
      const message =
        role === "review"
          ? `template review type not declared: ${values.REVIEW_TYPE === undefined || values.REVIEW_TYPE === "" ? "(missing REVIEW_TYPE)" : values.REVIEW_TYPE}`
          : `template work-mode not declared: ${role === undefined ? "(missing ROLE)" : role}`;
      throw new Error(message);
    }
    for (const token of this.#contract.tokens) {
      if (values[token.name] === undefined) {
        throw new Error(`template token ${token.name} (${token.zone}) has no value`);
      }
    }
    for (const name of Object.keys(values)) {
      if (!this.#contract.tokens.some((token) => token.name === name)) {
        throw new Error(`template value provided for undeclared token ${name}`);
      }
    }
  }

  /** The review variant of a REVIEW_TYPE (verified in the gate). */
  #reviewRow(values: TemplateValues): ModePromptRow | undefined {
    return this.#contract.reviews[values.REVIEW_TYPE as TargetType];
  }

  /** The work-mode row of a ROLE (verified in the gate). */
  #workRow(role: string): ModePromptRow | undefined {
    return this.#contract.modes[role as WorkModeRowKey];
  }

  /** Slot resolution — the `{{> cl:…}}` clause partials resolve from the contract's
   *  clauses container, the `{{TOKEN}}` slots from the values; any unresolved form
   *  (a clause absent from the container, a slot with no value) is a hard error. */
  #fill(text: string, values: TemplateValues): string {
    return text
      .replace(/\{\{> cl:([A-Za-z0-9-]+)\}\}/g, (_match, name: string) => {
        const clause = this.#contract.clauses[`cl:${name}`];
        if (clause === undefined) {
          throw new Error(`template clause cl:${name} not declared`);
        }
        return clause;
      })
      .replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, name: string) => {
        const value = values[name];
        if (value === undefined) {
          throw new Error(`template slot not resolved: ${name}`);
        }
        return value;
      });
  }
}
