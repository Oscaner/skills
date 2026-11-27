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
//     review prompts are six declared rows rather than one row with a branch.
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

const REVIEW_SHELLS = {
  wave: [
    "# CDD dispatch — review round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**review:** review the criteria below against the reference face named in the round context. A wave review judges `INPUT_WAVE_BRIEF` (the complete plan mirror, plus the previous review round's `## Notes` section when it left any — a note changes no conclusion); the plan review judges the plan at `INPUT_PLAN`; the branch review judges the live tree against its base branch (`INPUT_PLAN` is its plan-conformance reference); the spec review judges the spec at `INPUT_SPEC`; the overall review judges the charter at `INPUT_OVERALL`; and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn → REVIEW_FIX · none → APPROVED) — a review never declares its own status. **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review. **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.\n\nAnything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "**Lens labels:** one of `standards | spec | buildability | scope` — every finding MUST carry its `lens`.",
    "**Criteria — wave:** Standards axis (repo coding standards + code-review smell baseline) + Spec axis (wave brief / plan requirements) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — `tsc --noEmit`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): run `git diff origin/<BASE_BRANCH>..HEAD` yourself (BASE_BRANCH as named in the round context; on a missing artifact judge the working tree) — every changed file must fall within the wave brief's file surface (`**Files:**` seams) or be attributable to the plan / reviewed intent; an unattributable changed file is a candidate finding. The reviewer is the changed-surface judge — the engine reconciles nothing. Calibrate findings by real severity — not everything is a blocker. A finding is a blocker when the functional result departs from expectation or sows a functional defect: the bytes, exit code or rendering a consumer receives contradict the declared contract, or a legal input reaches an undeclared outcome. The four typical instances: a declared acceptance gate, contract or prompt is violated where the consumer can see it; a legal input escapes the declared failure face (a blank input returns 500, an unknown id is not a 404); the gate fails or the suite can never go red (an inert grep · a dead guard · an unconditional skip); a security or privacy defect. Violating a written sentence while the bytes a consumer receives stay unchanged is a warn, not a blocker — citing a clause is not the same as affecting behaviour. A blocker owes a reproducible scenario: the legal input or condition → what actually happens → what was expected, one sentence the next reviewer can refute on the spot. A deviation you can describe but cannot back with a scenario (which legal input → what actually happens → what was expected) is a warn, not a blocker: an unrefutable deviation is not yet a functional impact, so the finding is graded by the consequence its own description states. A finding is missing evidence when it is graded blocker yet names no place its claim can be re-run: `evidence.repro` must carry a command or a `doc.md#section` pointer, and a blank string is as absent as a missing key. The blocker tier is the only one that forces a decision, so it is the only one that owes readable bytes — an unreadable blocker is adopted on trust. A blocker owes a non-blank `evidence.repro`: the reader re-runs it and either confirms or refutes the finding. An absent one refuses the round, and every offending row is named at once. A warn may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check. A finding is a warn when it leaves this round's functional result unchanged but makes the next person do the wrong thing: debt (a duplicated policy · a stale docstring · a missing coverage case), a misleading claim no consumer is hurt by, a gap nobody verifies, or dead code that tempts a later reader to believe it still runs. A warn owes the consequence: not a failure today, but who will take which step wrongly, and when. Dead code that nothing calls today and no output depends on is a warn: it changes what the next reader believes, which is the warn boundary itself. Pure expression — naming, line-wrapping, comment wording, ordering inside one file — is a `notes` line, not a finding: it changes neither behaviour nor anyone's judgment, and a finding that stays must name the judgment it changes. A warn here owes two halves: the judgment it changes, and this tier's price — a fix round owed, and no re-grade of that round. A naming inconsistency that stays self-consistent inside one file is a `notes` line, not a finding: no cross-surface reader is misled. A finding is downgraded without a regrade reason when the same defect returns one tier lower and the new round states no reason for the change: the reader can no longer tell a re-grade from a changed defect, while the round's own conclusion stays what it was. The mark is a display fact: it rides the board's verb token after its `+N` count and the capsule summary line, never a finding row, never a carrier entry, and never the round's conclusion. A downgrade whose previous round carried no scenario has no reference to hold it against, so the finding is read as a changed defect and carries no mark. Within one run, a defect already graded in the same class keeps that grade; crossing grades names its reason in the finding. The reviewed artifact is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable user would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger. Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside. Report every axis separately — never merge several axes into one 'most severe' finding: a cross-axis ranking hides which axis the finding actually speaks for. Acknowledge what was done well before listing findings (accurate praise earns the rest of the report trust).\n\n1. Does the change break the repository's own standard on a surface a consumer reads — a public shape, prompt bytes, a documented command, or a contract an existing test pins?\n2. Does the change depart from the reviewed contract (the wave brief / plan / design spec) while the behaviour a consumer receives changes with it — and does a requirement look implemented while the implementation looks wrong: are the places that claim to implement it actually right?\n3. Is the reviewer's own typecheck / test run red, or would it go red on a path the plan declares?\n4. Does the change land outside the wave brief's `**Files:**` surface and the plan's intent, and is that out-of-scope change consumed?",
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
  branch: [
    "# CDD dispatch — review round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**review:** review the criteria below against the reference face named in the round context. A wave review judges `INPUT_WAVE_BRIEF` (the complete plan mirror, plus the previous review round's `## Notes` section when it left any — a note changes no conclusion); the plan review judges the plan at `INPUT_PLAN`; the branch review judges the live tree against its base branch (`INPUT_PLAN` is its plan-conformance reference); the spec review judges the spec at `INPUT_SPEC`; the overall review judges the charter at `INPUT_OVERALL`; and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn → REVIEW_FIX · none → APPROVED) — a review never declares its own status. **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review. **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.\n\nAnything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "**Lens labels:** one of `standards | spec | buildability | scope` — every finding MUST carry its `lens`.",
    "**Criteria — branch:** Same four axes as the wave review (branch-wide health: run `git diff origin/<BASE_BRANCH>..HEAD` + plan conformance) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — `tsc --noEmit`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): branch review IS the full diff — every changed file must be attributable to a finding, a plan requirement, or the reviewed intent; unrelated surface = candidate finding, normal finding → fix loop. Calibrate findings by real severity — not everything is a blocker. A finding is a blocker when the functional result departs from expectation or sows a functional defect: the bytes, exit code or rendering a consumer receives contradict the declared contract, or a legal input reaches an undeclared outcome. The four typical instances: a declared acceptance gate, contract or prompt is violated where the consumer can see it; a legal input escapes the declared failure face (a blank input returns 500, an unknown id is not a 404); the gate fails or the suite can never go red (an inert grep · a dead guard · an unconditional skip); a security or privacy defect. Violating a written sentence while the bytes a consumer receives stay unchanged is a warn, not a blocker — citing a clause is not the same as affecting behaviour. A blocker owes a reproducible scenario: the legal input or condition → what actually happens → what was expected, one sentence the next reviewer can refute on the spot. A deviation you can describe but cannot back with a scenario (which legal input → what actually happens → what was expected) is a warn, not a blocker: an unrefutable deviation is not yet a functional impact, so the finding is graded by the consequence its own description states. A finding is missing evidence when it is graded blocker yet names no place its claim can be re-run: `evidence.repro` must carry a command or a `doc.md#section` pointer, and a blank string is as absent as a missing key. The blocker tier is the only one that forces a decision, so it is the only one that owes readable bytes — an unreadable blocker is adopted on trust. A blocker owes a non-blank `evidence.repro`: the reader re-runs it and either confirms or refutes the finding. An absent one refuses the round, and every offending row is named at once. A warn may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check. A finding is a warn when it leaves this round's functional result unchanged but makes the next person do the wrong thing: debt (a duplicated policy · a stale docstring · a missing coverage case), a misleading claim no consumer is hurt by, a gap nobody verifies, or dead code that tempts a later reader to believe it still runs. A warn owes the consequence: not a failure today, but who will take which step wrongly, and when. Dead code that nothing calls today and no output depends on is a warn: it changes what the next reader believes, which is the warn boundary itself. Pure expression — naming, line-wrapping, comment wording, ordering inside one file — is a `notes` line, not a finding: it changes neither behaviour nor anyone's judgment, and a finding that stays must name the judgment it changes. A warn here owes two halves: the judgment it changes, and this tier's price — a fix round owed, and no re-grade of that round. A naming inconsistency that stays self-consistent inside one file is a `notes` line, not a finding: no cross-surface reader is misled. A finding is downgraded without a regrade reason when the same defect returns one tier lower and the new round states no reason for the change: the reader can no longer tell a re-grade from a changed defect, while the round's own conclusion stays what it was. The mark is a display fact: it rides the board's verb token after its `+N` count and the capsule summary line, never a finding row, never a carrier entry, and never the round's conclusion. A downgrade whose previous round carried no scenario has no reference to hold it against, so the finding is read as a changed defect and carries no mark. Within one run, a defect already graded in the same class keeps that grade; crossing grades names its reason in the finding. The reviewed artifact is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable user would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger. Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside. Report every axis separately — never merge several axes into one 'most severe' finding: a cross-axis ranking hides which axis the finding actually speaks for. Acknowledge what was done well before listing findings (accurate praise earns the rest of the report trust). Three things a green run cannot show you: design — does the changed structure fit this codebase and is it the simplest structure that solves the plan's problem (over-engineering is a finding, not a preference); test adequacy — would these tests fail if the code broke (a run that cannot go red is not evidence); migration — does every breaking change name the path a not-yet-migrated consumer takes.\n\n1. Does the change break the repository's own standard on a surface a consumer reads — a public shape, prompt bytes, a documented command, or a contract an existing test pins?\n2. Does the change depart from the reviewed contract (the wave brief / plan / design spec) while the behaviour a consumer receives changes with it — and does a requirement look implemented while the implementation looks wrong: are the places that claim to implement it actually right?\n3. Is the reviewer's own typecheck / test run red, or would it go red on a path the plan declares?\n4. Does the change land outside the wave brief's `**Files:**` surface and the plan's intent, and is that out-of-scope change consumed?",
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
  "phase-spec": [
    "# CDD dispatch — review round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**review:** review the criteria below against the reference face named in the round context. A wave review judges `INPUT_WAVE_BRIEF` (the complete plan mirror, plus the previous review round's `## Notes` section when it left any — a note changes no conclusion); the plan review judges the plan at `INPUT_PLAN`; the branch review judges the live tree against its base branch (`INPUT_PLAN` is its plan-conformance reference); the spec review judges the spec at `INPUT_SPEC`; the overall review judges the charter at `INPUT_OVERALL`; and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn → REVIEW_FIX · none → APPROVED) — a review never declares its own status. **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review. **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.\n\nAnything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "**Lens labels:** one of `completeness | consistency | clarity` — every finding MUST carry its `lens`.",
    "**Criteria — phase-spec:** Follow URC: single-cycle, lens-tagged findings (completeness/consistency/clarity) + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence + Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin by module path + symbol name — a line number is not a pin; a count carries no mechanical face — no census registry exists and no gate compares the value; a bare integer plus a count unit in prose is the writing convention, not a refusal — while an arithmetic over live counts still is; naming the guard that maintains the value is the reason for the reference, not its form; a present-tense description of the tree as it stands is refused in a spec and in a plan alike — what belongs to the plan is the work item (`- Modify: <path>`), never a prose `path:line`, while the condition that must hold belongs to the spec; restate such a description as that condition — and in a design spec a measurement input is a lens-tagged finding unless it is restated as a condition that must hold — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding + program conformance (phase-spec only — a single-spec carries no `program:` and no `INPUT_OVERALL`, and is not a phase) — judge the phase against its parent overall at `INPUT_OVERALL` (the charter its `program:` names): the phase must sit inside the scope the overall's Phase inventory registered for it, and a phase that reaches beyond it is a completeness finding. Closed waves are history: a finding on the content face of an already-closed task block is answered by amending the document to align with the delivered split — never by carrying work into or out of a closed task, and a finding that would rewrite the historical split is not raised. Calibrate findings by real severity — not everything is a blocker. A finding is a blocker when the functional result departs from expectation or sows a functional defect: the bytes, exit code or rendering a consumer receives contradict the declared contract, or a legal input reaches an undeclared outcome. The four typical instances: a declared acceptance gate, contract or prompt is violated where the consumer can see it; a legal input escapes the declared failure face (a blank input returns 500, an unknown id is not a 404); the gate fails or the suite can never go red (an inert grep · a dead guard · an unconditional skip); a security or privacy defect. Violating a written sentence while the bytes a consumer receives stay unchanged is a warn, not a blocker — citing a clause is not the same as affecting behaviour. A blocker owes a reproducible scenario: the legal input or condition → what actually happens → what was expected, one sentence the next reviewer can refute on the spot. A deviation you can describe but cannot back with a scenario (which legal input → what actually happens → what was expected) is a warn, not a blocker: an unrefutable deviation is not yet a functional impact, so the finding is graded by the consequence its own description states. A finding is missing evidence when it is graded blocker yet names no place its claim can be re-run: `evidence.repro` must carry a command or a `doc.md#section` pointer, and a blank string is as absent as a missing key. The blocker tier is the only one that forces a decision, so it is the only one that owes readable bytes — an unreadable blocker is adopted on trust. A blocker owes a non-blank `evidence.repro`: the reader re-runs it and either confirms or refutes the finding. An absent one refuses the round, and every offending row is named at once. A warn may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check. A finding is a warn when it leaves this round's functional result unchanged but makes the next person do the wrong thing: debt (a duplicated policy · a stale docstring · a missing coverage case), a misleading claim no consumer is hurt by, a gap nobody verifies, or dead code that tempts a later reader to believe it still runs. A warn owes the consequence: not a failure today, but who will take which step wrongly, and when. Dead code that nothing calls today and no output depends on is a warn: it changes what the next reader believes, which is the warn boundary itself. Pure expression — naming, line-wrapping, comment wording, ordering inside one file — is a `notes` line, not a finding: it changes neither behaviour nor anyone's judgment, and a finding that stays must name the judgment it changes. A warn here owes two halves: the judgment it changes, and this tier's price — a fix round owed, and no re-grade of that round. A naming inconsistency that stays self-consistent inside one file is a `notes` line, not a finding: no cross-surface reader is misled. A finding is downgraded without a regrade reason when the same defect returns one tier lower and the new round states no reason for the change: the reader can no longer tell a re-grade from a changed defect, while the round's own conclusion stays what it was. The mark is a display fact: it rides the board's verb token after its `+N` count and the capsule summary line, never a finding row, never a carrier entry, and never the round's conclusion. A downgrade whose previous round carried no scenario has no reference to hold it against, so the finding is read as a changed defect and carries no mark. Within one run, a defect already graded in the same class keeps that grade; crossing grades names its reason in the finding. The reviewed spec is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable downstream author would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger. Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside. Report every axis separately — never merge several axes into one 'most severe' finding: a cross-axis ranking hides which axis the finding actually speaks for. Acknowledge what was done well before listing findings (accurate praise earns the rest of the report trust).\n\n1. Is a condition that must hold left unwritten, so the downstream author can only guess — and guessing wrong changes behaviour?\n2. Do two places state the same fact differently, so the downstream reader goes wrong whichever one is taken — and when a document gives a reading (a count, a list, an enumeration), which items does it count, and are those items still on the tree?\n3. Can a statement be read two reasonable ways, and do the two readings derive different implementations?",
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
  overall: [
    "# CDD dispatch — review round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**review:** review the criteria below against the reference face named in the round context. A wave review judges `INPUT_WAVE_BRIEF` (the complete plan mirror, plus the previous review round's `## Notes` section when it left any — a note changes no conclusion); the plan review judges the plan at `INPUT_PLAN`; the branch review judges the live tree against its base branch (`INPUT_PLAN` is its plan-conformance reference); the spec review judges the spec at `INPUT_SPEC`; the overall review judges the charter at `INPUT_OVERALL`; and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn → REVIEW_FIX · none → APPROVED) — a review never declares its own status. **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review. **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.\n\nAnything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "**Lens labels:** one of `scope | inventory | dependency | acceptance | boundary` — every finding MUST carry its `lens`.",
    "**Criteria — overall:** Follow URC: single-cycle, lens-tagged findings (scope/inventory/dependency/acceptance/boundary) — judge the charter as a program charter, on six criteria and nothing it does not own. (1) Scope is a program increment — every phase's Scope names what the PROGRAM gains there (a capability, a boundary, a contract), never implementation detail such as a file list or a step-by-step walkthrough; a scope that descends to code is a scope finding. (2) Inventory, graph and order agree — every Phase inventory row has a Dependency graph node and every node a row, each edge is marked hard or soft and matches the row's Dependency cell, and the documented execution order is one the edges allow: a soft edge that hides a serial dependency, or an order no edge set permits, is a dependency finding. (3) Acceptance cells are phase-judgeable — each row's acceptance names an outcome a reviewer can decide when that phase closes, never a placeholder (TBD, a restated goal, a criterion only the program's end can settle); an undecidable cell is an acceptance finding. (4) Non-goals fence the program — every registered phase sits inside the boundary the Non-goals draw, and a non-goal drawn so loosely that it excludes nothing is a boundary finding. (5) The change record is a decision record — each entry states what was decided and why (its decision id where the program keeps one), never a work log of rounds and dispatches; a diary entry is an inventory finding. (6) Ledger and reality agree — a phase the tree shows closed is marked Done, a phase still in flight is not, and work no registered phase carries never appears as a delivered increment; a drift between the inventory and the tree is an inventory finding. Calibrate findings by real severity — not everything is a blocker. A finding is a blocker when the functional result departs from expectation or sows a functional defect: the bytes, exit code or rendering a consumer receives contradict the declared contract, or a legal input reaches an undeclared outcome. The four typical instances: a declared acceptance gate, contract or prompt is violated where the consumer can see it; a legal input escapes the declared failure face (a blank input returns 500, an unknown id is not a 404); the gate fails or the suite can never go red (an inert grep · a dead guard · an unconditional skip); a security or privacy defect. Violating a written sentence while the bytes a consumer receives stay unchanged is a warn, not a blocker — citing a clause is not the same as affecting behaviour. A blocker owes a reproducible scenario: the legal input or condition → what actually happens → what was expected, one sentence the next reviewer can refute on the spot. A deviation you can describe but cannot back with a scenario (which legal input → what actually happens → what was expected) is a warn, not a blocker: an unrefutable deviation is not yet a functional impact, so the finding is graded by the consequence its own description states. A finding is missing evidence when it is graded blocker yet names no place its claim can be re-run: `evidence.repro` must carry a command or a `doc.md#section` pointer, and a blank string is as absent as a missing key. The blocker tier is the only one that forces a decision, so it is the only one that owes readable bytes — an unreadable blocker is adopted on trust. A blocker owes a non-blank `evidence.repro`: the reader re-runs it and either confirms or refutes the finding. An absent one refuses the round, and every offending row is named at once. A warn may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check. A finding is a warn when it leaves this round's functional result unchanged but makes the next person do the wrong thing: debt (a duplicated policy · a stale docstring · a missing coverage case), a misleading claim no consumer is hurt by, a gap nobody verifies, or dead code that tempts a later reader to believe it still runs. A warn owes the consequence: not a failure today, but who will take which step wrongly, and when. Dead code that nothing calls today and no output depends on is a warn: it changes what the next reader believes, which is the warn boundary itself. Pure expression — naming, line-wrapping, comment wording, ordering inside one file — is a `notes` line, not a finding: it changes neither behaviour nor anyone's judgment, and a finding that stays must name the judgment it changes. A warn here owes two halves: the judgment it changes, and this tier's price — a fix round owed, and no re-grade of that round. A naming inconsistency that stays self-consistent inside one file is a `notes` line, not a finding: no cross-surface reader is misled. A finding is downgraded without a regrade reason when the same defect returns one tier lower and the new round states no reason for the change: the reader can no longer tell a re-grade from a changed defect, while the round's own conclusion stays what it was. The mark is a display fact: it rides the board's verb token after its `+N` count and the capsule summary line, never a finding row, never a carrier entry, and never the round's conclusion. A downgrade whose previous round carried no scenario has no reference to hold it against, so the finding is read as a changed defect and carries no mark. Within one run, a defect already graded in the same class keeps that grade; crossing grades names its reason in the finding. The reviewed charter is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable phase author would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger. Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside. Report every axis separately — never merge several axes into one 'most severe' finding: a cross-axis ranking hides which axis the finding actually speaks for. Acknowledge what was done well before listing findings (accurate praise earns the rest of the report trust).\n\n1. Does the phase's scope descend to implementation detail, leaving the increment that phase delivers undecidable?\n2. Does the registry disagree with the tree, so \"delivered\" stops being credible?\n3. Does a dependency edge disagree with the actual serial order, so the schedule collides?\n4. Is an acceptance cell undecidable when the phase closes?\n5. Is a non-goal drawn so loosely that it filters nothing?",
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
  plan: [
    "# CDD dispatch — review round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**review:** review the criteria below against the reference face named in the round context. A wave review judges `INPUT_WAVE_BRIEF` (the complete plan mirror, plus the previous review round's `## Notes` section when it left any — a note changes no conclusion); the plan review judges the plan at `INPUT_PLAN`; the branch review judges the live tree against its base branch (`INPUT_PLAN` is its plan-conformance reference); the spec review judges the spec at `INPUT_SPEC`; the overall review judges the charter at `INPUT_OVERALL`; and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn → REVIEW_FIX · none → APPROVED) — a review never declares its own status. **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review. **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.\n\nAnything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "**Lens labels:** one of `completeness | decomposition | buildability` — every finding MUST carry its `lens`.",
    "**Criteria — plan:** Follow URC: single-cycle, lens-tagged findings (completeness/decomposition/buildability) + spec conformance — the plan is judged against its design spec at `INPUT_SPEC` (the plan's `spec` front-matter target): every spec requirement must map to a task, and a spec requirement with no owning task is a completeness finding + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence + Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin (path:line + the assertion face) — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding. Closed waves are history: a finding on the content face of an already-closed task block is answered by amending the document to align with the delivered split — never by carrying work into or out of a closed task, and a finding that would rewrite the historical split is not raised. Calibrate findings by real severity — not everything is a blocker. A finding is a blocker when the functional result departs from expectation or sows a functional defect: the bytes, exit code or rendering a consumer receives contradict the declared contract, or a legal input reaches an undeclared outcome. The four typical instances: a declared acceptance gate, contract or prompt is violated where the consumer can see it; a legal input escapes the declared failure face (a blank input returns 500, an unknown id is not a 404); the gate fails or the suite can never go red (an inert grep · a dead guard · an unconditional skip); a security or privacy defect. Violating a written sentence while the bytes a consumer receives stay unchanged is a warn, not a blocker — citing a clause is not the same as affecting behaviour. A blocker owes a reproducible scenario: the legal input or condition → what actually happens → what was expected, one sentence the next reviewer can refute on the spot. A deviation you can describe but cannot back with a scenario (which legal input → what actually happens → what was expected) is a warn, not a blocker: an unrefutable deviation is not yet a functional impact, so the finding is graded by the consequence its own description states. A finding is missing evidence when it is graded blocker yet names no place its claim can be re-run: `evidence.repro` must carry a command or a `doc.md#section` pointer, and a blank string is as absent as a missing key. The blocker tier is the only one that forces a decision, so it is the only one that owes readable bytes — an unreadable blocker is adopted on trust. A blocker owes a non-blank `evidence.repro`: the reader re-runs it and either confirms or refutes the finding. An absent one refuses the round, and every offending row is named at once. A warn may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check. A finding is a warn when it leaves this round's functional result unchanged but makes the next person do the wrong thing: debt (a duplicated policy · a stale docstring · a missing coverage case), a misleading claim no consumer is hurt by, a gap nobody verifies, or dead code that tempts a later reader to believe it still runs. A warn owes the consequence: not a failure today, but who will take which step wrongly, and when. Dead code that nothing calls today and no output depends on is a warn: it changes what the next reader believes, which is the warn boundary itself. Pure expression — naming, line-wrapping, comment wording, ordering inside one file — is a `notes` line, not a finding: it changes neither behaviour nor anyone's judgment, and a finding that stays must name the judgment it changes. A warn here owes two halves: the judgment it changes, and this tier's price — a fix round owed, and no re-grade of that round. A naming inconsistency that stays self-consistent inside one file is a `notes` line, not a finding: no cross-surface reader is misled. A finding is downgraded without a regrade reason when the same defect returns one tier lower and the new round states no reason for the change: the reader can no longer tell a re-grade from a changed defect, while the round's own conclusion stays what it was. The mark is a display fact: it rides the board's verb token after its `+N` count and the capsule summary line, never a finding row, never a carrier entry, and never the round's conclusion. A downgrade whose previous round carried no scenario has no reference to hold it against, so the finding is read as a changed defect and carries no mark. Within one run, a defect already graded in the same class keeps that grade; crossing grades names its reason in the finding. The reviewed plan is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable implementer would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger. Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside. Report every axis separately — never merge several axes into one 'most severe' finding: a cross-axis ranking hides which axis the finding actually speaks for. Acknowledge what was done well before listing findings (accurate praise earns the rest of the report trust).\n\n1. Is a spec requirement owned by no task, so implementation skips it silently and the requirement never ships?\n2. Does the task granularity make a step impossible to verify on its own, so a defect crosses steps with nobody noticing?\n3. Is a step of the plan not executable against the tree as it stands — a missing prerequisite, a command that does not exist, an order no edge permits?",
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
  "single-spec": [
    "# CDD dispatch — review round",
    "",
    "## Instructions",
    "",
    "**Fixed contract:** everything above `## Round context` is this mode's fixed text — byte-identical per dispatch. `## Round context` is the only dynamic region; resolve every symbol from it — nothing real rides above.",
    "**Scope lock:** use only this round's inputs in `## Round context`. No full plan reads. No extra features, no tangential refactors, no scope creep.",
    "**review:** review the criteria below against the reference face named in the round context. A wave review judges `INPUT_WAVE_BRIEF` (the complete plan mirror, plus the previous review round's `## Notes` section when it left any — a note changes no conclusion); the plan review judges the plan at `INPUT_PLAN`; the branch review judges the live tree against its base branch (`INPUT_PLAN` is its plan-conformance reference); the spec review judges the spec at `INPUT_SPEC`; the overall review judges the charter at `INPUT_OVERALL`; and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`. Write findings into the draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them); empty `findings` = approved. The engine derives the conclusion from the draft's findings (blocker → CHANGES_REQUESTED · warn → REVIEW_FIX · none → APPROVED) — a review never declares its own status. **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review. **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.\n\nAnything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.",
    "**Lens labels:** one of `completeness | consistency | clarity` — every finding MUST carry its `lens`.",
    "**Criteria — single-spec:** Follow URC: single-cycle, lens-tagged findings (completeness/consistency/clarity) + the writing-plans self-check + verification evidence — the reviewer runs the repository's typecheck and test commands and self-reports the dual evidence + Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin by module path + symbol name — a line number is not a pin; a count carries no mechanical face — no census registry exists and no gate compares the value; a bare integer plus a count unit in prose is the writing convention, not a refusal — while an arithmetic over live counts still is; naming the guard that maintains the value is the reason for the reference, not its form; a present-tense description of the tree as it stands is refused in a spec and in a plan alike — what belongs to the plan is the work item (`- Modify: <path>`), never a prose `path:line`, while the condition that must hold belongs to the spec; restate such a description as that condition — and in a design spec a measurement input is a lens-tagged finding unless it is restated as a condition that must hold — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding + program conformance (phase-spec only — a single-spec carries no `program:` and no `INPUT_OVERALL`, and is not a phase) — judge the phase against its parent overall at `INPUT_OVERALL` (the charter its `program:` names): the phase must sit inside the scope the overall's Phase inventory registered for it, and a phase that reaches beyond it is a completeness finding. Closed waves are history: a finding on the content face of an already-closed task block is answered by amending the document to align with the delivered split — never by carrying work into or out of a closed task, and a finding that would rewrite the historical split is not raised. Calibrate findings by real severity — not everything is a blocker. A finding is a blocker when the functional result departs from expectation or sows a functional defect: the bytes, exit code or rendering a consumer receives contradict the declared contract, or a legal input reaches an undeclared outcome. The four typical instances: a declared acceptance gate, contract or prompt is violated where the consumer can see it; a legal input escapes the declared failure face (a blank input returns 500, an unknown id is not a 404); the gate fails or the suite can never go red (an inert grep · a dead guard · an unconditional skip); a security or privacy defect. Violating a written sentence while the bytes a consumer receives stay unchanged is a warn, not a blocker — citing a clause is not the same as affecting behaviour. A blocker owes a reproducible scenario: the legal input or condition → what actually happens → what was expected, one sentence the next reviewer can refute on the spot. A deviation you can describe but cannot back with a scenario (which legal input → what actually happens → what was expected) is a warn, not a blocker: an unrefutable deviation is not yet a functional impact, so the finding is graded by the consequence its own description states. A finding is missing evidence when it is graded blocker yet names no place its claim can be re-run: `evidence.repro` must carry a command or a `doc.md#section` pointer, and a blank string is as absent as a missing key. The blocker tier is the only one that forces a decision, so it is the only one that owes readable bytes — an unreadable blocker is adopted on trust. A blocker owes a non-blank `evidence.repro`: the reader re-runs it and either confirms or refutes the finding. An absent one refuses the round, and every offending row is named at once. A warn may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check. A finding is a warn when it leaves this round's functional result unchanged but makes the next person do the wrong thing: debt (a duplicated policy · a stale docstring · a missing coverage case), a misleading claim no consumer is hurt by, a gap nobody verifies, or dead code that tempts a later reader to believe it still runs. A warn owes the consequence: not a failure today, but who will take which step wrongly, and when. Dead code that nothing calls today and no output depends on is a warn: it changes what the next reader believes, which is the warn boundary itself. Pure expression — naming, line-wrapping, comment wording, ordering inside one file — is a `notes` line, not a finding: it changes neither behaviour nor anyone's judgment, and a finding that stays must name the judgment it changes. A warn here owes two halves: the judgment it changes, and this tier's price — a fix round owed, and no re-grade of that round. A naming inconsistency that stays self-consistent inside one file is a `notes` line, not a finding: no cross-surface reader is misled. A finding is downgraded without a regrade reason when the same defect returns one tier lower and the new round states no reason for the change: the reader can no longer tell a re-grade from a changed defect, while the round's own conclusion stays what it was. The mark is a display fact: it rides the board's verb token after its `+N` count and the capsule summary line, never a finding row, never a carrier entry, and never the round's conclusion. A downgrade whose previous round carried no scenario has no reference to hold it against, so the finding is read as a changed defect and carries no mark. Within one run, a defect already graded in the same class keeps that grade; crossing grades names its reason in the finding. The reviewed spec is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable downstream author would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger. Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside. Report every axis separately — never merge several axes into one 'most severe' finding: a cross-axis ranking hides which axis the finding actually speaks for. Acknowledge what was done well before listing findings (accurate praise earns the rest of the report trust).\n\n1. Is a condition that must hold left unwritten, so the downstream author can only guess — and guessing wrong changes behaviour?\n2. Do two places state the same fact differently, so the downstream reader goes wrong whichever one is taken — and when a document gives a reading (a count, a list, an enumeration), which items does it count, and are those items still on the tree?\n3. Can a statement be read two reasonable ways, and do the two readings derive different implementations?",
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
} as const;

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
