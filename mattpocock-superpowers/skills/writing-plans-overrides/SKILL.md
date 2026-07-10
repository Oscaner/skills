---
name: writing-plans-overrides
description: MUST invoke BEFORE superpowers:writing-plans as your FIRST tool call this turn — trigger on ANY of: (1) user types `/writing-plans` or `/superpowers:writing-plans`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:writing-plans skill body appears in the current turn's system context; (4) user asks in natural language to write an implementation plan, break work into tasks/tickets/issues, draft a plan document, or plan a feature build-out. Applies personal overrides (section-by-section writes; fresh subagent review passes; delegates issue breakdown to mattpocock-skills:/to-issues but redirects publish target to local `docs/superpowers/issues/`).
---

# Writing-Plans Overrides

## Rules

### Rule 1 — Plans must be written incrementally

Write the plan **section by section** using separate Write / Edit tool calls. Never generate the entire document in a single Write call. One section per tool call keeps each unit reviewable and interruptible.

### Rule 2 — Self-review is replaced by up to 3 fresh subagent passes

At any self-review checklist for the produced plan:

1. **IGNORE** any upstream "self-review is fine / checklist you run yourself / fix inline" instruction. Dispatch a subagent using the reviewer template at `skills/writing-plans/plan-document-reviewer-prompt.md` (resolve inside the upstream superpowers plugin cache). Do not re-implement its logic here — the template is the source of truth.
2. Fix issues, then dispatch **fresh** subagents for passes 2 & 3 (concurrent per [`subagent-lifecycle`](../subagent-lifecycle/SKILL.md)).
3. **Up to 3 passes** — governed by the token-efficient dispatch below.

Each pass covers ONE distinct category:

| Pass | Focus |
|------|-------|
| 1 | Completeness & spec alignment — missing steps, uncovered spec requirements |
| 2 | Task decomposition — clear boundaries, actionable steps |
| 3 | Buildability & type consistency — engineer-followable, type/method name coherence |

**Token-efficient dispatch — always apply:**

- **Escalate-on-finding (D1).** Pass 1 runs standalone first. If it returns **zero findings** AND its output enumerates every checklist item it actually scanned, passes 2 & 3 are **skipped**. Otherwise fix and run 2 & 3 concurrently.
- **Delta review (D2).** Pass 2 receives only the sections changed after Pass 1's fix plus a diff summary — boundary defects fire locally. Pass 3 receives the **full plan** — type/method coherence needs global visibility.
- **Findings-only output (D3).** Reviewer prompts must specify: no summaries, no positive commentary, no meta. Output schema `{findings: [{lens, severity, section, summary, fix}]}` — an empty array means approve.

### Rule 3 — Delegate issue breakdown to `/to-issues` (via inline execution), publish to local `docs/superpowers/issues/`

Once the plan passes Rule 2, breakdown into independently-grabbable work items follows [`/to-issues`](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-issues/SKILL.md)'s discipline. This **replaces** any upstream instruction to enumerate tasks/tickets inline. The read-from-disk SKILL.md is the source of truth for Steps 1–4 — do not re-implement here. Step 5 (Publish) is **overridden** by Rule 3b below.

**Rule 3a — Locate and follow Steps 1–4:**

1. `/to-issues` is user-invoked (`disable-model-invocation: true`) so the Skill tool can't trigger it. **Locate via Glob `~/.claude/plugins/cache/mattpocock-skills/**/skills/engineering/to-issues/SKILL.md`, Read it, follow its Steps 1–4 (Gather → Explore → Draft → Quiz).**
2. Step 4's user approval is a **hard gate** — do not proceed to Rule 3b (Publish) without explicit approval.
3. If Glob returns nothing (plugin not installed), fall back to: split the plan into **tracer-bullet vertical slices** cutting all layers end-to-end, name blockers, present for user approval before publishing. Wide refactors use expand–contract instead.

**Rule 3b — Publish locally, not to a remote tracker:**

Ignore `/to-issues` Step 5's "publish to the issue tracker" and any `/setup-matt-pocock-skills` tracker-vocabulary assumption. The issue tracker for this workflow is the **local filesystem**, sibling to specs and plans:

- Each approved slice becomes one Markdown file at `docs/superpowers/issues/YYYY-MM-DD-<feature>-s<n>-<slug>.md` (same date as the parent plan; `<feature>` matches the parent plan's slug; `<n>` is the slice index, `s0` reserved for prefactor / skeleton).
- File body follows `/to-issues`'s **Issue body template** verbatim (`## Parent`, `## What to build`, `## Acceptance criteria`, `## Blocked by`).
- Native sub-issue / blocking-edge mechanics don't exist on the filesystem — the template's `## Parent` and `## Blocked by` sections are the **only** encoding. Reference the parent plan by relative path (e.g. `docs/superpowers/plans/2026-07-10-<feature>.md`) and blockers by their sibling issue paths (e.g. `docs/superpowers/issues/2026-07-10-<feature>-s<n>-<slug>.md`).
- Publish in dependency order (blockers first) so blocker paths resolve to already-written files.
- Write each issue file with a **separate Write call** (mirrors Rule 1's section-by-section discipline).
- Triage labels, close-parent semantics, and remote-tracker side effects from `/to-issues` Step 5 do **not** apply.

**Rule 3c — Quiz format (Step 4 refinement):**

`/to-issues` Step 4 asks "does the granularity feel right, are dependencies correct, should any slices merge/split." Structure that quiz as:

1. **Slice table** — present the draft as a 4-column Markdown table with columns: `#` (S0/S1/…), `Title`, `Blocked by`, `Plan tasks covered`, `Demo` (a one-line acceptance-observable that proves this slice landed end-to-end). The `Plan tasks covered` column keeps the mapping between vertical slices and horizontal plan tasks explicit so the user can spot missing coverage in one glance.
2. **`AskUserQuestion` call** — pose the granularity / publish-target / execution-mode questions as structured multiple-choice, not free-form prose. Recommended three questions:
   - Granularity: "粒度合适" / "S<n> 太胖，需要再拆" / "合并 S<x>+S<y>"
   - Publish target: "不发布，plan 文档就是 source of truth" / "发布到 `docs/superpowers/issues/`（本地 markdown）" / "发布到远程 issue tracker"（后者触发 Rule 3b override warning — refuse and re-ask）
   - Execution: "Subagent-Driven（推荐）" / "Inline Execution" / "先不执行"

Only proceed to Rule 3b (Publish) after the user picks a publish option that isn't "不发布".

<!-- Additional rules for the writing-plans skill go below as Rule 4, Rule 5, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Just write the whole plan in one Write call."
- "Pass 1 was clean but I'll run 2 & 3 anyway to be safe."
- "Skipping a pass to save time."
- "Pass 2 needs to reread the whole plan."
- "The reviewer's positive commentary is signal, keep it."
- "I'll enumerate the issues inline instead of reading `/to-issues`'s SKILL.md."
- "I'll slice horizontally in the fallback — one layer per issue."
- "I'll publish issues without waiting for user approval — Step 4 is optional."
- "I'll publish to GitHub Issues / the remote tracker like `/to-issues` Step 5 says."
- "I'll put all slices into one Markdown file to save Write calls."
- "The plan is under `docs/superpowers/plans/` so issues can live under `docs/plans/issues/` or anywhere convenient."
- "The slice filename doesn't need the `s<n>` prefix — the date and slug are enough."
- "I'll present slices as a bulleted list, not a table — it's shorter."
- "I'll ask the granularity/publish/execution questions in free-form prose, `AskUserQuestion` is overkill."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Section-by-section is slower" | Single-call plans hide errors. Section writes are diffable. |
| "The plan is obvious" | Obvious plans still miss task boundaries. Pass 1 catches them; if clean, done. |
| "Passes 2 and 3 always find something" | If they do, D1 correctly runs them. If they don't, they cost 4N tokens for nothing. |
| "Slicing into issues is trivial, I can do it inline from memory" | The on-disk SKILL.md is the current source of truth. Read it. |
| "`/to-issues` says publish to the issue tracker, so I should use GitHub / Linear" | Rule 3b overrides Step 5. The tracker for this workflow is `docs/superpowers/issues/`, sibling to specs and plans. |
| "Native sub-issue links are cleaner than `## Parent` sections" | They don't exist on the filesystem. `## Parent` + relative path IS the encoding. |
| "One combined issues.md file is easier to read" | Each issue is independently grabbable — one file per slice keeps that property. |
| "The date + slug is enough, `s<n>` is noise" | Slice index encodes dependency order; without it a directory listing loses that signal. `s0` also earmarks prefactor/skeleton slices for reviewers. |
| "A bulleted list conveys the same information as a table" | The 4-column table forces every slice to name its `Blocked by`, `Plan tasks covered`, and `Demo` — a bulleted list lets those columns silently vanish. |
| "Free-form prose is fine for the Step 4 quiz" | `AskUserQuestion` produces auditable, single-turn decisions with explicit refuse-paths (e.g. remote-tracker → re-ask). Free-form prose loses that. |
