---
"@oscaner-skills/kairos": minor
"@oscaner-skills/cdd-engine": minor
---

The review face closes on **two severity tiers**. `nit` retires from the write vocabulary: `FindingSeverity`, `CriteriaTier` and the carrier's `findings.severity` enum accept `blocker` | `warn` only, and the third tier survives on the READ face alone (a stored `nit` row keeps its cell and still rolls up to `REVIEW_FIX`). The two criteria rows that carried `nit` stay as rows and are re-graded `warn` — `census:criteria.rows` does not move — so the rubric still teaches where a light observation goes: it is a `notes` line, not a finding.

`notes` becomes a real carrying face: the wave brief lists the previous review round's notes verbatim, and the board's line token appends `notes +M` after the regrade mark. Engine-written prose (dropped draft fields, artifact deviations) moves to the existing soft-violation channel and never rides a carrier's `notes`.

Four new `doc-contract` rows land at `block`, closing the phase's own gate on itself: `single-create` (one `Create:` per path, never later than another claim on it), `dangling-task-ref` (`(Task N)` naming an undeclared task in `Consumes` / `Produces`), `depends-on-cycle` (`DependsOn` edges that close a cycle) and `change-history-newest-last` (the lineage's version sequence must be monotonic — either direction; the id is historical). `RuleDeclarationBase` gains a `seat` column declaring every place a row executes.

Two retractions, which is why this is a minor and not merely an addition: a decision-face document that `line-coordinate` used to refuse for a decimal ratio (`4.5:1`, `2.25:1`, `1.5:1`) now passes, because a coordinate needs a letter before the colon; and `temporal-indicator` retires whole — its row, its class, its vocabulary, its fixtures and its `checked:` line — so a decision-face document carrying `今天` / `仍` beside a symbol passes instead of being refused. The claim-shape vocabulary the authoring skills carry names `line-coordinate` for its narrative shape again, and its `count` shape keeps `measure-literal` · `live-arithmetic`.

One more consumer-visible strictness, and it is a refusal rather than a new shape: a member pin is judged in the file its carrier names — a path carrier by resolution, a bare class name by its single declaration site, zero or several declarers reading as one finding rather than a guess — so a `path#member` or `Class.member` pin that passed at the previous version is refused when the carrier's own file does not declare the member. The finding's shape and tier do not move, and a data-file carrier (`package.json`) judges nothing.

The re-review gate moves inside the round: a `docs-fix` round re-runs `doc-contract` at its close-out, refuses to advance on any finding the round itself added (a multiset difference over `kind@field@message`), and reuses the existing `contract-violation` cause and `CDD_BLOCKED` channel — no new message shape, no new exit code. `next:` lines and existing refusal messages are byte-identical.
