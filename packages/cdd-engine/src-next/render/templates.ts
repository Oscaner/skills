// packages/cdd-engine/src-next/render/templates.ts
// T21 — the template-contract typed surface: the template-contract JSON's data-plane
// home PLUS the TemplateAssembler (one module, one renderer). The dispatch prompt
// data (the per-mode shell frames · the review variants · the single prose return block ·
// the round-context subsets · the token registry · the clause partials) and the
// review criteria (the per-key axes guides — P4, extended by the v1.8
// review-closeout and the P22 charter body) are typed constant data here, imported
// never parsed:
//
//   · TEMPLATE_PROMPT — the rendering data plane the assembler consumes; this
//     module renders over it (the JSON's $schema/_doc prose plane is gone).
//   · REVIEWS — the per-type review criteria (task/branch axes guides + the
//     document shapes' URC prose, migrated from the dispatch table — their single typed
//     home, P4). P5 lands here: the "no parallel sub-agents" phrase is deleted.
//
// T15 v1.8 (the mode dispatch table — §3.5) restructures the prompt from "one all-mode
// manual + dynamic zone" to the per-mode dispatch table:
//   · MODE_PROMPTS — one row per work-mode (implement / fix / docs-fix — the ROLE
//     vocabulary; the spec/plan fix faces ride the docs-fix row): the mode's FIXED
//     prefix (its instruction shell + the injected writable-subset schema at the
//     shell's tail — byte-identical for every dispatch of the mode, so the prompt-
//     cache prefix groups by mode) + the mode's REDUCED round-context subset.
//   · REVIEW_VARIANTS — the review mode's per-target rows, one per target type:
//     the criteria + lens text are FIXED PREFIX content (folded into each row's
//     shell — the body is selected per target, so they never ride the dynamic tail;
//     the INPUT_CRITERIA / INPUT_LENS round-context tokens are gone) and each row's
//     fixed prefix is byte-stable — a review dispatch's cache prefix groups by type.
//   · the normalized token vocabulary (§3.5): INPUT_* (read-side) / OUTPUT_* (write-
//     side) / WORKSPACE_* (environment) / BASE_BRANCH (the branch review's scope
//     anchor) / ROLE (the nominative identity) / WAVE (the wave-unitary unit).
//     Round-context keys are the mode's consumption set — a key the shell never
//     names is not declared (the fix round carries no INPUT_ RULES).
//
// T15 v1.9 (the handoff contract-surface rework — §3.6) lands the schema injection
// in the same plane: the `## Handoff schema` section at every shell's tail carries
// the {{HANDOFF_SCHEMA}} slot (projection ① of session/handoff-schema.ts — the same
// declared objects the engine validates the draft against, projection ②). The
// handoff-format prose is gone; RETURN_PROSE is the ONE return contract.
//
// T15 v1.10/1.11 (the review-closeout batch — §3.7) refines the shell composition:
// the work-mode tail is the shared EVIDENCE_ITEM cell (implement/fix carry it;
// docs-fix carries no evidence file — zero per-mode duplication), and the review
// variants fold the criteria/lens in.
//
// P5 (M1) supersede: the implement mode's dispatch wording names the upstream
// implement skill ref (`DISPATCH.implement`, the ref the dispatch row resolves
// to), never the retired tdd alias.
//
// Module-level exports are types / the declared constant data / the class — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import { DISPATCH } from "../face/host.ts";
import { TerminationPolicy } from "../face/termination.ts";
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

/** The work-modes of the dispatch table — the ROLE values (fix's spec/plan face is
 *  the docs-fix mode; review covers every target type + branch-review). */
export type WorkMode = "implement" | "fix" | "review" | "docs-fix";

/** The work-mode rows of the dispatch table — every ROLE except review (the review
 *  mode's six per-target rows live in `reviews`, over the five criteria bodies
 *  keyed by `ReviewKey`). */
export type WorkModeRowKey = Exclude<WorkMode, "review">;

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
   *  `reviews` — their ROLE value is "review" and TARGET_TYPE selects the row). */
  modes: Readonly<Record<WorkModeRowKey, ModePromptRow>>;
  /** The review mode's per-type rows — each variant's fixed prefix carries its
   *  criteria + lens (folded in, never tokens). */
  reviews: Readonly<Record<TargetType, ModePromptRow>>;
  /** The `## Return` zone — the single plain-prose block (P11: the child's stdout
   *  contract is prose, never a fixed key=value block; the handoff draft is the
   *  round's machine-readable result). */
  return: { readonly RETURN_PROSE: readonly string[] };
  /** The token registry — the union across every mode's round context + the shell's
   *  schema slot (the gate's declared list). */
  tokens: readonly TemplateToken[];
  clauses: Readonly<Record<string, string>>;
}

/** One review guide row — one criteria body (its lens vocabulary + the axes/URC
 *  prose — the review prompt's fixed criteria body). */
export interface ReviewGuideRow {
  /** The lens vocabulary — the finding lens labels the review may carry. */
  lensEnum: readonly string[];
  /** The axes/URC guide prose — the criteria body (the task/branch four axes +
   *  verification-evidence duty; the document shapes' URC rows). */
  axesGuide: string;
}

/** The review criteria keys — the criteria-BODY domain (never the target
 *  vocabulary): the five distinct bodies a review target selects among. `wave` /
 *  `branch` / `plan` / `overall` are the same-named bodies; `spec` is the ONE
 *  narrative body the two spec-shaped document targets (`phase-spec` ·
 *  `single-spec`) share, so no second prose copy exists. The word `spec` names a
 *  criteria body only — it is not a `--type` value (the CLI enum carries
 *  `phase-spec` / `single-spec`). */
export type ReviewKey = "wave" | "branch" | "plan" | "overall" | "spec";

/** The review criteria — the five per-key guides (P4 typed data; the spec/plan
 *  URC prose migrated from the dispatch table at v1.8 closeout, the charter body
 *  added by P22). */
export type ReviewGuides = Readonly<Record<ReviewKey, ReviewGuideRow>>;

/** The nominal fixed-frame cells shared by every shell (byte-identical words — the
 *  fixed prefix is read on every dispatch, so every word costs child context). */
const FRAME_ITEMS: readonly string[] = [
  "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
  "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
];

/** The shared work-mode tail cell — the evidence gate (implement/fix carry it;
 *  docs-fix carries no evidence file — zero per-mode duplication, §3.7). The
 *  evidence file's concrete name rides the injected schema's preamble (per-family
 *  prefix), never this fixed text. */
const EVIDENCE_ITEM =
  "**Evidence gate:** write the test-evidence file at the prescribed `OUTPUT_EVIDENCE` path per the `test-evidence` schema in `## Handoff schema` — `command`/`exit_code`/`passed`/`warnings_count` + `typecheck` (`command`/`exit_code`/`passed`); `behavior_change` when applicable. Update the round's report after verification. Missing or schema-violating evidence → the engine rewrites the draft to `status: BLOCKED`. Reports, test output, diffs: files only, never the return.";

/** The work plane's ONE capability declaration (design spec §7.3) — a dispatched
 *  implement / fix / docs-fix round may amend the CONTENT face of the judged
 *  document — the phase-spec / single-spec / overall charter / plan families —
 *  because the document authoring right is a prompt slot, never a carrier slot (it
 *  is not in `CARRIER`, not in `PLANE_REQUIRED`, not in the frame and not in
 *  `progress.json` — the gate judges the result, never the declaration). The
 *  declaration names the families in their own words: the freeze clause limits
 *  itself to this declared scope, so a docs-fix round on the charter can never read
 *  "amend the charter" beside "freeze the spec". The structure face (the plan's Task
 *  id set and any task's `DependsOn` set) belongs to
 *  the orchestrator: the engine snapshots both faces at dispatch and compares them at
 *  the close, so a round-internal structure edit judges the round hard. The docs-fix
 *  row carries it too — a fix round on a spec / plan line IS docs-fix, so this is the
 *  row the authorization has to reach. The review variants declare nothing — a review
 *  is read-only. */
const WORK_CAPABILITY =
  "**Capability — `capability: may.amend = content`:** this round may amend the judged document's content face — the phase-spec, single-spec, overall charter and plan families (facts, file lists, steps, acceptance detail, cited line numbers). The structure face — the plan's Task id set and any task's `DependsOn` set — belongs to the orchestrator: the engine snapshots it at dispatch and compares it at the close, so changing it inside this round judges the round hard.";

/** The discipline-clause cells shared by every shell (the `{{> cl:…}}` partials
 *  resolve from the single clause container — the same bytes, one per shell). */
const LICENSE_ITEMS: readonly string[] = [
  "",
  "**Discipline clauses:**",
  "- {{> cl:english-comments}}",
  "- {{> cl:eof-newline}}",
  "- {{> cl:no-full-tree-find}}",
  "- {{> cl:bash-stall-limit}}",
  "- {{> cl:no-infinite-loop}}",
  "- {{> cl:plan-freeze}}",
  "- {{> cl:atomic-commit}}",
  "- {{> cl:self-validate}}",
  "- {{> cl:no-secret-access}}",
  "- {{> cl:sync-completion}}",
];

/** The `## Handoff schema` section — the injected writable-subset fence at every
 *  shell's tail (the {{HANDOFF_SCHEMA}} slot; the plane's sets differ per mode, so
 *  the section's bytes are fixed per mode — §3.5 prefix-cache grouping). */
const SCHEMA_SECTION: readonly string[] = ["", "## Handoff schema", "", "{{HANDOFF_SCHEMA}}"];

/** The implement row's fixed prefix — header + instructions + the shared work tail. */
const IMPLEMENT_SHELL: readonly string[] = [
  "# CDD dispatch — implement round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  WORK_CAPABILITY,
  `**implement:** read \`INPUT_WAVE_BRIEF\` (the complete plan mirror — every \`### Task N:\` of the wave + the plan's \`## Constraints\` section, fresh-extracted at dispatch). \`WAVE\` = this round's wave (the task list); implement ALL tasks of the wave, never a subset. \`CONFIRMED_SEAMS\` in the brief → apply as-is; else propose test boundaries in the report, then invoke **\`${DISPATCH.implement}\`**. Write the handoff draft at \`OUTPUT_HANDOFF\` per \`## Handoff schema\` BEFORE the return block: \`status\` (APPROVED once applied, else BLOCKED + the reason in \`notes\`) and \`artifacts\` (the prescribed \`OUTPUT_REPORT\`/\`OUTPUT_EVIDENCE\` paths from the round context — the \`{family}-{key}-\` canonical names, zero free naming).`,
  EVIDENCE_ITEM,
  ...LICENSE_ITEMS,
  ...SCHEMA_SECTION,
];

/** The fix row's fixed prefix — header + instructions + the shared work tail. */
const FIX_TYPED_INSTRUCTIONS: readonly string[] = [
  "**Verify-then-apply:** verify each finding against the codebase's actual state before changing anything — apply a finding only when it is technically sound; a finding that does not hold up stays open with a note (never blind adoption). Apply findings one at a time and test each one before moving on.",
  "**Conditional TDD:** when a finding requires a behavior change and the change has no test coverage, write or adjust the tests first and drive the change red→green — the discipline applies conditionally, never as a blanket demand on every finding.",
];

/** The fix row's fixed prefix — header + instructions + the shared work tail. */
const FIX_SHELL: readonly string[] = [
  "# CDD dispatch — fix round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  WORK_CAPABILITY,
  ...FIX_TYPED_INSTRUCTIONS,
  "**fix:** read `INPUT_REVIEWS` (open findings) + the plan context (`INPUT_WAVE_BRIEF` on a wave line — the complete plan mirror; `INPUT_PLAN` on the branch line — the plan document; `INPUT_SPEC` on the branch line — the design spec, a conformance reference, never the judged document). Fix ALL findings (blocker/warn/nit), verifying against `INPUT_REVIEWS` none remain open. Fix + write the draft at `OUTPUT_HANDOFF` per `## Handoff schema` in one process; draft write failure → `status: BLOCKED`; retry = full re-run (idempotent).",
  '**Dispositions:** every requested finding needs a disposition keyed by its `id` exactly as the requesting carrier prints it (`F1`, `F2`, … — the summary is description only), valued `{ "status": "fixed" | "rejected", "reason"?: "…" }` — a missing or mis-keyed disposition fails the round.',
  EVIDENCE_ITEM,
  ...LICENSE_ITEMS,
  // T5 (v0.3) — The work plane's ONE strict-schema sentence: every top-level draft
  // field comes from the `## Handoff schema` declared properties (the fields'
  // single source is the injected fence below — never a second enumeration in the
  // shell prose; a fix child that mirrors the source review carrier's top-level
  // shape trips the engine's read-back BLOCK, so the sentence names the schema as
  // the field source explicitly).
  "**Draft fields:** every top-level field of the draft comes from the `## Handoff schema` declared `properties` — the declaration is the field source, zero extra keys.",
  ...SCHEMA_SECTION,
];

/** The docs-fix row's fixed prefix — header + instructions (no evidence — the
 *  docs-fix round writes no evidence file). It carries the shared work capability
 *  declaration: the fix face's spec / plan dispatch lands on this row. */
const DOCS_FIX_SHELL: readonly string[] = [
  "# CDD dispatch — docs-fix round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  WORK_CAPABILITY,
  "**docs-fix:** apply `INPUT_REVIEWS` (all severities) directly to the judged doc — `INPUT_PLAN` on a plan-doc line (where `INPUT_SPEC` is the design reference, never edited here), `INPUT_SPEC` on a spec-doc line, `INPUT_OVERALL` on the overall line — removing fixed findings; record the path in `artifacts.doc` and report the round in `status` (APPROVED once every finding is applied, else BLOCKED + the reason in `notes`). Fix + write the draft at `OUTPUT_HANDOFF` per `## Handoff schema` in one process; retry = full re-run (idempotent).",
  "**Change-history rows:** a new `## Change history` row bumps the front-matter `version:` in the same edit — the header version is the lineage's newest numeric version, and the two can never disagree.",
  "**Table cells:** never hard-wrap a table cell — a wrapped continuation parses as a row whose cell count disagrees with the header, and the lineage row it was meant to be stops registering.",
  "**Escaped pipes:** a `## Change history` summary cell that needs a literal vertical bar carries `\\|` — a bare `|` splits the cell in two and the row stops matching the declared header.",
  '**Dispositions:** every requested finding needs a disposition keyed by its `id` exactly as the requesting carrier prints it (`F1`, `F2`, … — the summary is description only), valued `{ "status": "fixed" | "rejected", "reason"?: "…" }` — a missing or mis-keyed disposition fails the round.',
  ...LICENSE_ITEMS,
  // The generic strict-schema sentence — the SAME one the work shells carry: the
  // injected declaration is the draft's single field source, zero per-mode field
  // enumeration in the shell prose.
  "**Draft fields:** every top-level field of the draft comes from the `## Handoff schema` declared `properties` — the declaration is the field source, zero extra keys.",
  ...SCHEMA_SECTION,
];

/** The review variants' shared instruction text — the review's mode rule (the
 *  criteria body + the lens vocabulary ride per-type fixed items below). */
const REVIEW_ITEM =
  "**review:** review the criteria below against the reference face named in the round context. A wave review judges `INPUT_WAVE_BRIEF` (the complete plan mirror); the plan review judges the plan at `INPUT_PLAN`; the branch review judges the live tree against its base branch (`INPUT_PLAN` is its plan-conformance reference); the spec review judges the spec at `INPUT_SPEC`; the overall review judges the charter at `INPUT_OVERALL`; and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · none → APPROVED) — a review never declares its own status. **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review. **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.";

/** The review mode's shared reduced tail — the only dynamic region of every review
 *  variant (the criteria/lens are fixed-prefix per type, never here). Each review
 *  type carries its own judged-doc referent (wave → `INPUT_WAVE_BRIEF`; plan →
 *  `INPUT_PLAN` as the judged doc, with `INPUT_SPEC` as its plan→spec conformance
 *  reference; branch → the live tree against `BASE_BRANCH`, with `INPUT_PLAN` as its
 *  plan-conformance reference and the same `INPUT_SPEC` design-spec reference; spec →
 *  `INPUT_SPEC`; overall → `INPUT_OVERALL`); empty slots are dropped by the
 *  assembler, so a face renders only the anchors it reads. */
const REVIEW_CONTEXT: readonly string[] = [
  "## Round context",
  "",
  "- `ROLE`: {{ROLE}}",
  "- `TARGET_TYPE`: {{TARGET_TYPE}}",
  "- `WAVE`: {{WAVE}}",
  "- `INPUT_WAVE_BRIEF`: {{INPUT_WAVE_BRIEF}}",
  "- `INPUT_PLAN`: {{INPUT_PLAN}}",
  "- `INPUT_SPEC`: {{INPUT_SPEC}}",
  "- `INPUT_OVERALL`: {{INPUT_OVERALL}}",
  "- `BASE_BRANCH`: {{BASE_BRANCH}}",
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
      // find #4 + #5 — the plan's ## Constraints rides the wave brief mirror;
      // the OUTPUT_* write paths are prescribed (the {family}-{key}- canonical names)
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
      "- `TARGET_TYPE`: {{TARGET_TYPE}}",
      "- `WAVE`: {{WAVE}}",
      "- `INPUT_WAVE_BRIEF`: {{INPUT_WAVE_BRIEF}}",
      "- `INPUT_PLAN`: {{INPUT_PLAN}}",
      "- `INPUT_SPEC`: {{INPUT_SPEC}}",
      "- `INPUT_OVERALL`: {{INPUT_OVERALL}}",
      "- `INPUT_REVIEWS`: {{INPUT_REVIEWS}}",
      "- `INPUT_RULINGS`: {{INPUT_RULINGS}}",
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
      "- `TARGET_TYPE`: {{TARGET_TYPE}}",
      "- `WAVE`: {{WAVE}}",
      "- `INPUT_PLAN`: {{INPUT_PLAN}}",
      "- `INPUT_SPEC`: {{INPUT_SPEC}}",
      "- `INPUT_OVERALL`: {{INPUT_OVERALL}}",
      "- `INPUT_REVIEWS`: {{INPUT_REVIEWS}}",
      "- `INPUT_RULINGS`: {{INPUT_RULINGS}}",
      "- `OUTPUT_REPORT`: {{OUTPUT_REPORT}}",
      "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
      "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
      "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
    ],
  },
};

/** The two slots of the severity rubric — the reviewed artifact's name and the
 *  audience whose expectation judges the artifact's silence. The values are the
 *  literal placeholder spellings the fragment carries. */
export const SEVERITY_RUBRIC_SLOTS = {
  artifact: "{artifact}",
  audience: "{audience}",
} as const;

/** The severity rubric — the ONE calibration fragment every review axes guide
 *  shares: the four blocker questions, the warn/nit tiers, the same-grade
 *  consistency duty, the vision (silence-is-not-permission) sentence with its two
 *  slots, the set-aside ledger and the closing acknowledgement. */
export const SEVERITY_RUBRIC =
  "Calibrate findings by real severity — not everything is a blocker. A finding is a blocker when any one of these holds: (a) the declared acceptance gate, contract or prompt is violated; (b) a legal input escapes the declared failure face (a blank input returns 500, an unknown id is not a 404); (c) the gate fails or the suite can never go red (an inert grep · a dead guard · an unconditional skip); (d) a security or privacy defect. Debt inside the contract is a warn (duplicated policy · stale docstring · a missing coverage case). Style, naming and line-wrapping is a nit. Within one run, a defect already graded in the same class keeps that grade; crossing grades names its reason in the finding. The reviewed {artifact} is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable {audience} would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger. Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside. Acknowledge what was done well before listing findings (accurate praise earns the rest of the report trust).";

/** The slot values per criteria body — the ONE registry the filled fragment reads.
 *  `{artifact}` = the reviewed product's name; `{audience}` = the subject whose
 *  expectation judges the artifact's silence. The two spec-shaped targets share the
 *  ONE `spec` row, so their shared narrative body can never fork its vocabulary;
 *  the charter's own row reads charter / phase author — the completion of the P17
 *  `overall-spec` → `overall` rename, never a copy of the spec's vocabulary. */
export const REVIEW_BODY_TEXT: Readonly<
  Record<ReviewKey, { readonly artifact: string; readonly audience: string }>
> = {
  wave: { artifact: "artifact", audience: "user" },
  branch: { artifact: "artifact", audience: "user" },
  spec: { artifact: "spec", audience: "downstream author" },
  plan: { artifact: "plan", audience: "implementer" },
  overall: { artifact: "charter", audience: "phase author" },
};

/** The filled severity rubric of one criteria body — the shared fragment with that
 *  body's two slot values substituted. The parameter domain IS the `REVIEWS` key
 *  domain, so a consumer derives the guide from the same key. */
export const reviewGuideOf = (key: ReviewKey): string => {
  const text = REVIEW_BODY_TEXT[key];
  return SEVERITY_RUBRIC.replaceAll(SEVERITY_RUBRIC_SLOTS.artifact, text.artifact).replaceAll(
    SEVERITY_RUBRIC_SLOTS.audience,
    text.audience,
  );
};

/** The closed-wave discipline's ONE sentence (P30 §2.7) — the document review axes'
 *  shared body: a finding on an already-closed task block's content face is answered
 *  by the document, never by moving the work. Both document criteria bodies select
 *  it, so the duty cannot fork between the plan variant and the spec shapes; the
 *  engine routes nothing on it (no finding classification, no dispatch branch) — it is
 *  prompt text, judged by the reviewer. */
export const CLOSED_WAVE_DISCIPLINE =
  "Closed waves are history: a finding on the content face of an already-closed task block is answered by amending the document to align with the delivered split — never by carrying work into or out of a closed task, and a finding that would rewrite the historical split is not raised.";

/** The spec-shaped documents' narrative criteria body — the phase-spec line's URC
 *  + its program-conformance clause, the ONE body both spec-shaped target rows
 *  select (the filled rubric is what differs per row). The charter's own criteria
 *  body is `docCharterAxes` — never a second narrative copy alongside this one.
 *  The `Claimed→pin` clause names the three claim SHAPES a spec may state (a symbol,
 *  a guarded count, a condition that must hold) instead of accepting whatever shape
 *  today's tree happens to have: a line number is not a pin, a prose count is the
 *  guard's business, and a present-tense description of today's shape belongs to the
 *  plan. Nothing gates the writing moment — the review is where a violation surfaces. */
const docNarrativeAxes = (guide: string): string =>
  `Follow URC: single-cycle, lens-tagged findings (completeness/consistency/clarity) + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence + Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin by module path + symbol name — a line number is not a pin; a count ("N places" · "N rows" · "N modules") must be stated as pinned by the named guard or test; a present-tense description of today's shape belongs to the plan — in a design spec a measurement input is a lens-tagged finding unless restated as a condition that must hold — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding + program conformance (phase-spec only — a single-spec carries no \`program:\` and no \`INPUT_OVERALL\`, and is not a phase) — judge the phase against its parent overall at \`INPUT_OVERALL\` (the charter its \`program:\` names): the phase must sit inside the scope the overall's Phase inventory registered for it, and a phase that reaches beyond it is a completeness finding. ${CLOSED_WAVE_DISCIPLINE} ${guide}`;

/** The charter's criteria body — the six things a program charter owns, and only
 *  those. It carries none of the implementation-face evidence duty the narrative
 *  body carries (running the repository's commands, pinning every claim): a charter
 *  is judged on the program's shape, never on a phase's code. */
const docCharterAxes = (guide: string): string =>
  `Follow URC: single-cycle, lens-tagged findings (scope/inventory/dependency/acceptance/boundary) — judge the charter as a program charter, on six criteria and nothing it does not own. (1) Scope is a program increment — every phase's Scope names what the PROGRAM gains there (a capability, a boundary, a contract), never implementation detail such as a file list or a step-by-step walkthrough; a scope that descends to code is a scope finding. (2) Inventory, graph and order agree — every Phase inventory row has a Dependency graph node and every node a row, each edge is marked hard or soft and matches the row's Dependency cell, and the documented execution order is one the edges allow: a soft edge that hides a serial dependency, or an order no edge set permits, is a dependency finding. (3) Acceptance cells are phase-judgeable — each row's acceptance names an outcome a reviewer can decide when that phase closes, never a placeholder (TBD, a restated goal, a criterion only the program's end can settle); an undecidable cell is an acceptance finding. (4) Non-goals fence the program — every registered phase sits inside the boundary the Non-goals draw, and a non-goal drawn so loosely that it excludes nothing is a boundary finding. (5) The change record is a decision record — each entry states what was decided and why (its decision id where the program keeps one), never a work log of rounds and dispatches; a diary entry is an inventory finding. (6) Ledger and reality agree — a phase the tree shows closed is marked Done, a phase still in flight is not, and work no registered phase carries never appears as a delivered increment; a drift between the inventory and the tree is an inventory finding. ${guide}`;

/** The per-key review criteria — the review prompts' fixed criteria body (P4; the
 *  document shapes' URC rows migrated from the dispatch table at the v1.8 closeout —
 *  their single typed home; the charter body lands here at P22). The shared
 *  calibration tail rides `reviewGuideOf` (one fragment per row), never a per-key
 *  copy. */
export const REVIEWS = {
  wave: {
    lensEnum: ["standards", "spec", "buildability"],
    axesGuide: `Standards axis (repo coding standards + code-review smell baseline) + Spec axis (wave brief / plan requirements) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — \`tsc --noEmit\`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): run \`git diff origin/<BASE_BRANCH>..HEAD\` yourself (BASE_BRANCH as named in the round context; on a missing artifact judge the working tree) — every changed file must fall within the wave brief's file surface (\`**Files:**\` seams) or be attributable to the plan / reviewed intent; an unattributable changed file is a candidate finding (severity by your judgment). The reviewer is the changed-surface judge — the engine reconciles nothing. ${reviewGuideOf("wave")}`,
  },
  branch: {
    lensEnum: ["standards", "spec", "buildability"],
    axesGuide: `Same four axes as the wave review (branch-wide health: run \`git diff origin/<BASE_BRANCH>..HEAD\` + plan conformance) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — \`tsc --noEmit\`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): branch review IS the full diff — every changed file must be attributable to a finding, a plan requirement, or the reviewed intent; unrelated surface = candidate finding (severity by your judgment), normal finding → fix loop. ${reviewGuideOf("branch")} Three things a green run cannot show you: design — does the changed structure fit this codebase and is it the simplest structure that solves the plan's problem (over-engineering is a finding, not a preference); test adequacy — would these tests fail if the code broke (a run that cannot go red is not evidence); migration — does every breaking change name the path a not-yet-migrated consumer takes.`,
  },
  spec: {
    lensEnum: ["completeness", "consistency", "clarity"],
    axesGuide: docNarrativeAxes(reviewGuideOf("spec")),
  },
  overall: {
    lensEnum: ["scope", "inventory", "dependency", "acceptance", "boundary"],
    axesGuide: docCharterAxes(reviewGuideOf("overall")),
  },
  plan: {
    lensEnum: ["completeness", "decomposition", "buildability"],
    axesGuide: `Follow URC: single-cycle, lens-tagged findings (completeness/decomposition/buildability) + spec conformance — the plan is judged against its design spec at \`INPUT_SPEC\` (the plan's \`spec\` front-matter target): every spec requirement must map to a task, and a spec requirement with no owning task is a completeness finding + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence + Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin (path:line + the assertion face) — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding. ${CLOSED_WAVE_DISCIPLINE} ${reviewGuideOf("plan")}`,
  },
} as const satisfies ReviewGuides;

/** The criteria-body selection — the ONE target → criteria map. Four targets select
 *  the body of their own name; the two spec-shaped document targets share the ONE
 *  narrative body (`spec`). Keeping the mapping here (never in the row literals)
 *  means a target cannot silently drift onto another target's criteria. */
export const reviewBodyOf = (type: TargetType): ReviewKey =>
  type === "phase-spec" || type === "single-spec" ? "spec" : type;

/** One review variant row (§3.7) — the fixed prefix folds the SELECTED criteria
 *  body + its lens INLINE (the `INPUT_CRITERIA`/`INPUT_LENS` round-context tokens
 *  are gone) and shares the REVIEW_CONTEXT dynamic tail. The target word labels the
 *  criteria line, so the row speaks the same vocabulary the CLI's `--type`
 *  declares while the body comes from the criteria selection. */
const reviewRow = (type: TargetType): ModePromptRow => {
  const criteria = REVIEWS[reviewBodyOf(type)];
  return {
    mode: "review",
    shell: [
      "# CDD dispatch — review round",
      "",
      "## Instructions",
      "",
      ...FRAME_ITEMS,
      REVIEW_ITEM,
      `**Lens labels:** one of \`${criteria.lensEnum.join(" | ")}\` — every finding MUST carry its \`lens\`.`,
      `**Criteria — ${type}:** ${criteria.axesGuide}`,
      ...LICENSE_ITEMS,
      ...SCHEMA_SECTION,
    ],
    roundContext: REVIEW_CONTEXT,
  };
};

/** The review mode's six per-target rows — one per `TargetType` (§3.7). */
const REVIEW_VARIANTS: Readonly<Record<TargetType, ModePromptRow>> = {
  wave: reviewRow("wave"),
  branch: reviewRow("branch"),
  "phase-spec": reviewRow("phase-spec"),
  overall: reviewRow("overall"),
  plan: reviewRow("plan"),
  "single-spec": reviewRow("single-spec"),
};

/** The `## Return` zone — the single plain-prose contract block (P11: the child
 *  narrates the round in prose; nothing downstream parses its stdout — the handoff
 *  draft at `OUTPUT_HANDOFF` is the round's machine-readable result). */
const RETURN_ZONE: TemplatePrompt["return"] = {
  RETURN_PROSE: [
    "## Return",
    "",
    "Report in a few plain sentences what this round did, whether it succeeded, and — if it",
    "did not — what blocked it. Nothing downstream parses this text; the handoff draft at",
    "`OUTPUT_HANDOFF` is the round's machine-readable result. Do not emit key-value lines,",
    "JSON, or any fixed block.",
    "",
    "(fail: an uncaught failure → exit non-zero with a one-line reason)",
  ],
};

/** The token registry — the union across every mode's round context + the shell's
 *  schema slot (the v1.8 normalized vocabulary; the assembly face supplies every
 *  declared slot, empty where the mode does not consume it — the round-context
 *  renderer drops the empty-valued lines). TARGET_TYPE is the target discriminant:
 *  it selects the review row AND renders on every targeted face. */
const TOKENS: readonly TemplateToken[] = [
  { name: "BASE_BRANCH", zone: "round-context" },
  { name: "HANDOFF_SCHEMA", zone: "shell" },
  { name: "INPUT_PLAN", zone: "round-context" },
  { name: "INPUT_SPEC", zone: "round-context" },
  { name: "INPUT_OVERALL", zone: "round-context" },
  { name: "INPUT_REVIEWS", zone: "round-context" },
  // P31 — the fix round's ruling sidecar (the source carrier's `.rulings.json`
  // sibling); a review writes its own draft, so its round context never carries it.
  { name: "INPUT_RULINGS", zone: "round-context" },
  { name: "INPUT_WAVE_BRIEF", zone: "round-context" },
  // find #5 — the prescribed artifact write paths (the {family}-{key}-{artifact}
  // single naming; the brief is a pure read input with no write slot).
  { name: "OUTPUT_REPORT", zone: "round-context" },
  { name: "OUTPUT_EVIDENCE", zone: "round-context" },
  { name: "OUTPUT_HANDOFF", zone: "round-context" },
  { name: "ROLE", zone: "round-context" },
  // P33 T1 — the target discriminant RENDERS, immediately below ROLE: the child
  // reads the target word the CLI `--type` declared. Implement is the one role
  // without a target, so its layout carries no such line and its value is empty.
  { name: "TARGET_TYPE", zone: "round-context" },
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
  "cl:bash-stall-limit": `Put a \`timeout\` on every Bash command — no single invocation may run longer than ${TerminationPolicy.CHILD_BASH_TIMEOUT_MS / 60_000} minutes; a command that stalls without progress is terminated and replaced with an equivalent, lighter command.`,
  "cl:no-infinite-loop":
    "Never run an unbounded loop — no `while True: pass`, no `while true; do …; done`, no spin-wait or tail-follow that only a human can stop. A wait must carry a bounded exit condition (a timeout, a max-attempt counter, or a terminating predicate) that ends the loop on its own.",
  "cl:plan-freeze":
    "Approved plan/spec files are frozen beyond the round's declared `capability: may.amend` scope — without that declaration a needed change goes out through findings, never an in-place edit; the structure face is outside amending authority in every round.",
  "cl:atomic-commit":
    "Commit each round's change as one atomic conventional commit scoped to the round — no mixed or out-of-scope content, no AI-generation trailers. A read-only round has nothing to commit: its only writes are the prescribed `OUTPUT_*` artifacts, and committing belongs to the orchestrator.",
  "cl:self-validate":
    "Self-validate before returning: run the validation/checks your change requires and record the evidence (command + exit code + result) in the report.",
  "cl:no-secret-access":
    "Never read, print, or derive a user secret — no keychain access (`security find-generic-password` / `security dump-keychain` / `login.keychain-db`), no `~/.ssh/*`, `~/.aws/credentials`, `~/.netrc`, no host CLI credential store, and no token-bearing environment variable (`*_TOKEN` / `*_API_KEY` / `*_SECRET`). A missing or failing credential is never yours to obtain: report it as `status: BLOCKED` on a work round or as a finding on a review round, then continue with the rest. A secret that reaches a report, evidence file, handoff draft, commit, or issue body has leaked — if one is already visible in your inputs, redact it as `[REDACTED]` and never echo its value.",
  "cl:sync-completion":
    "This dispatch is one-shot and non-interactive: end your turn with anything still running and the process exits — the work and the handoff die with it. So do not end your turn — a background command, a background subagent, or any yield-and-wait path such as `bg_run` / `bg_delegate` — before the handoff draft is written. Finish nested work in this same turn: complete it synchronously in this process turn, then write the handoff and finish.",
} as const;

/** The dispatch-prompt data plane — the typed template-contract surface. $version 23
 *  calibrates the shared body's five faces (§2.6 G · H · I · J · K): the freeze
 *  clause limits itself to the round's declared `capability: may.amend` scope and
 *  the commit clause names the read-only round's absent commit; the capability
 *  declaration names the judged document families (phase-spec / single-spec /
 *  overall charter / plan); the program-conformance clause is scoped to phase-spec;
 *  the branch criteria speak `wave`, not the retired `task`; the charter's rubric
 *  slots read charter / phase author. $version 22
 *  calibrates the referent face of the three instruction shells (§2.5 A · B · D):
 *  the review item splits the branch review out of the plan review (the live tree
 *  against `BASE_BRANCH`, with `INPUT_PLAN` as its plan-conformance reference) and
 *  names the charter anchor; the fix shell drops the unreachable spec line and
 *  marks the branch line's `INPUT_SPEC` as a conformance reference; the docs-fix
 *  shell marks the plan-doc line's `INPUT_SPEC` un-editable and names the overall
 *  line's `INPUT_OVERALL` anchor. The overall face's `INPUT_SPEC` value went empty
 *  in the same batch (C2 — one charter anchor). $version 21
 *  renames the target discriminant token to TARGET_TYPE and RENDERS it as a
 *  round-context line (`- \`TARGET_TYPE\`: <target word>`) immediately below ROLE on
 *  every face that has a target — the review variants, the two fix rows (wave ·
 *  branch) and the two document-fix rows' plan/spec types (plan · phase-spec ·
 *  overall · single-spec). Implement is the one role without a target, so its layout
 *  carries no such line and the empty value is dropped. $version 20
 *  gives the charter its own review criteria body (the six charter criteria, with
 *  none of the implementation-face evidence duty) and makes the criteria-body
 *  selection explicit — the two spec-shaped document targets share the ONE narrative
 *  body under the `spec` key, so the `overall` row's fixed prefix changed. $version 19
 *  extends the work plane's ONE capability declaration (`capability: may.amend =
 *  content`) to the docs-fix row as well: the fix face's spec / plan dispatch IS
 *  docs-fix, so the authorization (and the structure-face ban that rides with it)
 *  must reach the one row that edits those documents. $version 18
 *  adds the work plane's ONE capability declaration (`capability: may.amend =
 *  content` — an implement / fix round may amend the spec's and plan's content face,
 *  never the structure face the engine snapshots and judges at the close; the review
 *  variants declare nothing). $version 17
 *  adds the no-secret-access discipline clause (issue #390 — a dispatched child holds
 *  the harness's full authority, so the fixed prefix bar it from user credentials:
 *  keychain / credential files / token env vars; a missing credential is reported as
 *  BLOCKED or a finding, never self-acquired). $version 16
 *  unifies the handoff carrier on one op-derived plane (work / judge — implement /
 *  fix author a status-bearing work carrier, review a findings-only judge carrier)
 *  and gives the docs-fix round a `status` to report its outcome in. $version 15
 *  carries the `INPUT_OVERALL` read face (the parent charter a spec's `program:`
 *  names, mirroring `INPUT_SPEC` — a face without `program:` drops the slot) and
 *  adds the spec axis's program-scope conformance criterion (the phase judged against
 *  the scope its charter's Phase inventory registered for it). $version 14
 *  rewrites the sync-completion clause to name the one-shot fact (ending your turn with
 *  work still running exits the process — the work and the handoff die with it) and the
 *  subagent class (a background subagent is a yield-and-wait path, exactly like a
 *  background command; `bg_run` / `bg_delegate` were the only names before). $version 13
 *  adds the two hard review disciplines (read-only — a review mutates no tracked
 *  content, index, HEAD, or branch state; single agent — a review never spawns a
 *  subagent) and the branch axis's three judgment points (design · test adequacy ·
 *  migration). $version 12 adds the bounded-loop discipline clause (no `while True: pass` /
 *  spin-wait — every wait carries its own terminating condition). $version 11 makes the Bash discipline
 *  clause a hard per-command ceiling (every Bash run carries a `timeout`, no invocation
 *  longer than `CHILD_BASH_TIMEOUT_MS`). $version 10 adds the sync-completion discipline
 *  clause (P14 — one-shot CDD children must finish nested work in-process before writing
 *  the handoff; no bg_run / bg_delegate yield).
 *  $version 9 was the kind-named doc-anchor shape (INPUT_PLAN / INPUT_SPEC replace the
 *  generic INPUT_DOC; INPUT_WAVE_BRIEF), the branch scope anchor BASE_BRANCH, the single
 *  prose return contract (`RETURN_PROSE` — nothing downstream parses the child's
 *  stdout), and the per-type review criterion shells. */
export const TEMPLATE_PROMPT = {
  $version: 23,
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
 * (the review mode by ROLE + TARGET_TYPE) — the row's fixed prefix + the single
 * return contract + its reduced round context (empty-value keys not emitted).
 */
export class TemplateAssembler {
  readonly #contract: TemplatePrompt;

  constructor() {
    this.#contract = TEMPLATE_PROMPT;
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
      return: this.#joinLines(this.#contract.return.RETURN_PROSE),
      "round-context": this.#contextLines(row, values),
    };
    return this.#fill([zones.shell, zones.return, zones["round-context"]].join("\n\n"), values);
  }

  #joinLines(lines: readonly string[]): string {
    return lines.join("\n");
  }

  /** The row of a ROLE — the review mode's per-type variant (selected by the
   *  TARGET_TYPE discriminant), the work modes from the modes table. */
  #rowOf(values: TemplateValues): ModePromptRow {
    if (values.ROLE === "review") {
      const row = this.#contract.reviews[values.TARGET_TYPE as TargetType];
      if (row === undefined) {
        throw new Error(
          `template review type not declared: ${values.TARGET_TYPE === undefined || values.TARGET_TYPE === "" ? "(missing TARGET_TYPE)" : values.TARGET_TYPE}`,
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

  /** The hard gates — a known ROLE (+ its TARGET_TYPE for reviews), every declared
   *  token supplied (empty allowed — a mode's non-consumed slots are legitimately
   *  empty and merely not emitted), no undeclared values, the single return
   *  contract declared, and every round-context name the mode's shell prose
   *  references carried by that mode's layout (shell↔layout consistency). */
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
          ? `template review type not declared: ${values.TARGET_TYPE === undefined || values.TARGET_TYPE === "" ? "(missing TARGET_TYPE)" : values.TARGET_TYPE}`
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
    this.#assertShellLayout(row);
  }

  /** The shell↔layout consistency assertion (§3.6): every round-context name the
   *  mode's shell prose references (`INPUT_*` / `OUTPUT_*` / `BASE_BRANCH`) must be
   *  carried by that mode's round-context layout ∪ the shared return tail — a shell
   *  claiming a slot its layout never carries is a construction error. This closes
   *  the "claimed but not carried" blind spot the token gates cannot see (the shell
   *  prose is not `{{slot}}`-templated). */
  #assertShellLayout(row: ModePromptRow): void {
    const naming = /\b(?:INPUT_[A-Z0-9_]+|OUTPUT_[A-Z0-9_]+|BASE_BRANCH)\b/g;
    const namesOf = (text: string): string[] => text.match(naming) ?? [];
    const allowed = new Set<string>([
      ...row.roundContext.flatMap((line) => namesOf(line)),
      ...namesOf(this.#joinLines(this.#contract.return.RETURN_PROSE)),
    ]);
    for (const name of new Set(namesOf(this.#joinLines(row.shell)))) {
      if (!allowed.has(name)) {
        throw new Error(
          `template mode ${row.mode} shell references ${name} not carried by its round context`,
        );
      }
    }
  }

  /** The review variant of a TARGET_TYPE (verified in the gate). */
  #reviewRow(values: TemplateValues): ModePromptRow | undefined {
    return this.#contract.reviews[values.TARGET_TYPE as TargetType];
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
