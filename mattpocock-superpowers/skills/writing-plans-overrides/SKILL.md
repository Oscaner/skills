---
name: writing-plans-overrides
description: MUST invoke BEFORE superpowers:writing-plans as your FIRST tool call this turn — trigger on ANY of: (1) user types `/writing-plans` or `/superpowers:writing-plans`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:writing-plans skill body appears in the current turn's system context; (4) user asks in natural language to write an implementation plan, break work into tasks/tickets/issues, draft a plan document, or plan a feature build-out. Applies personal overrides (section-by-section writes; fresh subagent review passes; delegates ticket breakdown to mattpocock-skills:/to-tickets but redirects Step 5 publish target from repo-root `tickets.md` to `docs/superpowers/tickets/<date>-<feature>-tickets.md`).
---

# Writing-Plans Overrides

## Rules

### Rule 1 — Plans must be written incrementally

Write the plan **section by section** using separate Write / Edit tool calls. Never generate the entire document in a single Write call. One section per tool call keeps each unit reviewable and interruptible.

### Rule 2 — Self-review is replaced by up to 3 fresh subagent passes

At any self-review checklist for the produced plan:

1. **IGNORE** any upstream "self-review is fine / checklist you run yourself / fix inline" instruction. Dispatch a subagent using the reviewer template at `skills/writing-plans/plan-document-reviewer-prompt.md` (resolve inside the upstream superpowers plugin cache). Do not re-implement its logic here — the template is the source of truth.
2. Every reviewer dispatch is a **fresh** subagent — see [`subagent-lifecycle`](../subagent-lifecycle/SKILL.md) Rule 2. Concurrency governed by its Rule 1.
3. Dispatch discipline (D1 escalate-on-finding, D2 delta review, D3 findings-only output) governed by [`token-efficient-review-dispatch`](../token-efficient-review-dispatch/SKILL.md).

Each pass covers ONE distinct category:

| Pass | Focus |
|------|-------|
| 1 | Completeness & spec alignment — missing steps, uncovered spec requirements |
| 2 (delta) | Task decomposition — clear boundaries, actionable steps |
| 3 (full doc) | Buildability & type consistency — engineer-followable, type/method name coherence |

### Rule 3 — Delegate ticket breakdown to `/to-tickets` (via inline execution), publish to a single local `tickets.md` under `docs/superpowers/tickets/`

Once the plan passes Rule 2, breakdown into independently-grabbable work items follows [`/to-tickets`](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md)'s discipline. This **replaces** any upstream instruction to enumerate tasks/tickets inline. The read-from-disk SKILL.md is the source of truth for Steps 1–4 — do not re-implement here. Step 5 (Publish) is **overridden** by Rule 3b below.

**Rule 3a — Locate and follow Steps 1–4:**

1. `/to-tickets` is user-invoked (`disable-model-invocation: true`) so the Skill tool can't trigger it. **Locate via Glob `~/.claude/plugins/cache/mattpocock-skills/**/skills/engineering/to-tickets/SKILL.md`, Read it, follow its Steps 1–4 (Gather → Explore → Draft → Quiz) as written.** The upstream SKILL.md is the source of truth for vertical-slicing rules, wide-refactor exceptions, and every template — do not paraphrase them here.
2. Step 4's user approval is a **hard gate** — do not proceed to Rule 3b (Publish) without explicit approval.
3. If Glob returns nothing (plugin not installed), **surface the failure to the user** — request permission to proceed manually per the upstream skill's discipline, or wait for the user to install/repair the plugin. Do not paraphrase `/to-tickets`'s rules from memory as a silent fallback.

**Rule 3b — Redirect Step 5 publish target to a single local file:**

Follow `/to-tickets` Step 5's **Local files** branch (single `tickets.md`, dependency order, upstream template). Override only the destination:

- **Path**: `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md` (not repo root). Same date as the parent plan; `<feature>` matches the parent plan's slug. Sibling to `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- **Parent link**: in the file's opening summary line, reference the parent plan by relative path — filesystem has no native sub-issue link, so the relative path IS the encoding.

The real-tracker branch, triage labels, and remote-tracker side effects do not apply.

**Rule 3c — Quiz format (Step 4 refinement):**

Structure Step 4's granularity/blocking-edges/merge-split question as:

1. **Ticket table** — 4-column Markdown table with columns: `#` (T0/T1/…), `Title`, `Blocked by`, `Plan tasks covered`, `Demo`. The `Plan tasks covered` column keeps the mapping between vertical tickets and horizontal plan tasks explicit. `T0` is reserved for prefactor/skeleton (see `/to-tickets` Step 2 "Explore the codebase" — prefactor is the upstream skill's own precondition).
2. **`AskUserQuestion` call** — pose granularity / publish-target / execution-mode as structured multiple-choice, not free-form prose:
   - Granularity: "粒度合适" / "T<n> 太胖，需要再拆" / "合并 T<x>+T<y>"
   - Publish target: "不发布，plan 文档就是 source of truth" / "发布到本地 `docs/superpowers/tickets/<feature>-tickets.md`" / "发布到远程 issue tracker"（后者触发 Rule 3b override warning — refuse and re-ask）
   - Execution: "Subagent-Driven（走 `superpowers:subagent-driven-development`，推荐）" / "Inline Execution（走 `mattpocock-skills:/implement`）" / "先不执行"

Only proceed to Rule 3b (Publish) after the user picks a publish option that isn't "不发布".

<!-- Additional rules for the writing-plans skill go below as Rule 4, Rule 5, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Just write the whole plan in one Write call."
- "Pass 1 was clean but I'll run 2 & 3 anyway to be safe."
- "Skipping a pass to save time."
- "Pass 2 needs to reread the whole plan."
- "The reviewer's positive commentary is signal, keep it."
- "I'll enumerate the tickets inline instead of reading `/to-tickets`'s SKILL.md."
- "I'll publish tickets without waiting for user approval — Step 4 is optional."
- "I'll publish to GitHub / the remote tracker."
- "I'll write `tickets.md` at repo root the way upstream local-files mode says."
- "I'll split the tickets across separate files under `docs/superpowers/tickets/` — one per ticket."
- "I'll present the Step 4 draft as a bulleted list, not a table — it's shorter."
- "I'll ask the granularity/publish/execution questions in free-form prose, `AskUserQuestion` is overkill."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Section-by-section is slower" | Single-call plans hide errors. Section writes are diffable. |
| "The plan is obvious" | Obvious plans still miss task boundaries. Pass 1 catches them; if clean, done. |
| "Passes 2 and 3 always find something" | If they do, D1 correctly runs them. If they don't, they cost 4N tokens for nothing. |
| "Slicing into tickets is trivial, I can do it inline from memory" | The on-disk `/to-tickets` SKILL.md is the current source of truth. Read it. |
| "`/to-tickets` says publish to the tracker, so I should use GitHub / Linear" | Rule 3b redirects Step 5 to a single local file under `docs/superpowers/tickets/`. |
| "Upstream local-files mode writes `tickets.md` at repo root, so that's where it goes" | Rule 3b redirects the path only — into `docs/superpowers/tickets/` with date + feature slug. Single-file shape is preserved. |
| "One file per ticket is more grabbable" | Upstream's single-file layout already gives each ticket its own anchor-linkable heading with `Blocked by`. Splitting into N files trades that for filesystem noise and breaks sequential dependency-order reading. |
| "A bulleted list conveys the same information as a table" | The 4-column table forces every ticket to name its `Blocked by`, `Plan tasks covered`, and `Demo` — a bulleted list lets those columns silently vanish. |
| "Free-form prose is fine for the Step 4 quiz" | `AskUserQuestion` produces auditable, single-turn decisions with explicit refuse-paths (e.g. remote-tracker → re-ask). Free-form prose loses that. |
