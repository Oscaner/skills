# The grid → wiring roster

Every cell the parity corpus records, one row each: the cell, the ONE task that wires it
on the new tree, the producer's landing (`<src-relative module>#<export name>`), and the
route it exercises. A cell names exactly one wiring task — several cells may share a
task, but no cell has two. A route a command genuinely does not have is written
`not-applicable` with `—` in the task column: no cell is left blank and none is left for
a later wave to fill.

**What "wired" means.** A cell is wired when its producer's landing already exists on the
new tree and exports the named symbol. That is the whole reading — so the moment a
producer lands, every cell it owns that is still recorded as `GAP` turns the corpus red
(the producer arrived and nobody wired its cell), and every cell it owns that is recorded
as wired starts comparing bytes. A producer that does not exist yet is a `GAP`: counted,
neither skipped nor red.

**Four states, and a route that has none** (spec §2.4): `GAP` — the producer has not
landed, so the cell has no judge yet; `DIFF` — the cell is wired and its new-tree bytes
differ from the recording, red; `NAMED-DEFERRED` — the producer HAS landed and its kind has
no driver yet, but the kind carries a declared registration wave (`REGISTRATION_WAVES` in
`harness.ts`), so the cell is counted with that wave's name; `MISSING` — the recording and
the tree disagree (a cell recorded `GAP` whose producer has landed, a wired cell whose kind
declares NO registration wave, a recording taken under another frozen date), red;
`not-applicable` — the command has no such route, which is a state of its own and never a
GAP. The per-wave judgment is "wired cells show zero diffs, every owed driver is either
declared or named missing, and the GAP set is exactly the roster's unwired applicable
cells" — a condition read off the tree, never a snapshot of the wave that recorded it.
"The GAP set is empty" is the cutover's judgment, not every wave's.

**The skeleton cells are wired.** `f3.skeleton.*` names `docs/skeleton/assembler.ts#SkeletonAssembler`
at T9, and the `render:skeleton` driver drives it in process under the corpus's frozen date —
so the four families are byte-compared, `date:` line included, instead of counted as gaps. The
landing cell (`f3.skeleton-landing.*`) stays T16's: it judges the shell's write, not the bytes.

**A deferred driver is a schedule fact, an undeclared one is a hole.** The registration
table is the one place that answers "when does this kind grow its driver": `entry` in T17,
`seam` in T16, `render:skeleton` in T9, the remaining render families in T15. Its key set is
pinned to the kinds the grid actually derives, so a new probe kind cannot arrive without a
declared wave. A driver the new tree does not register is therefore never reported as a
diff, and never silently counted: it is either deferred with its wave named, or missing.

**The expectation is the old tree; the reading is the new one.** A cell's baseline value is
the old tree's recorded bytes; its actual bytes come from the new tree, through the drivers
of `NewTree` — the same fixture, the same argv, the same injected day. A driver is
registered by the wave that owns its entry (the in-process `seam` in T16, one
`render:<family>` per renderer family, the process `entry` in T17 after its placeholder was
retired), and a kind with no driver yet is a named absence — declared in
`REGISTRATION_WAVES`, or reported missing when it declares none.
No cell ever falls back to a second old-tree run, which is what makes "the new tree
reproduces the old one" a judgment rather than a tautology.

**The refusal route is declared per cause.** The wave gate's five reasons
(`mixed-batch` · `wave-too-wide` · `too-many-tasks` · `split` · `wrong-phase`) and the
four pre-dispatch stations (`no-host` · `carrier` · `dispatch-input` · `artifact`) each
own their row, because a gate row that stopped refusing is invisible inside a single
"refusal" cell. The `in-flight` gate row and the document gates own rows of their own for
the same reason.

**The failure route is the round's own `BLOCKED` conclusion.** A work command's failure
face is the dispatch's termination fact (`DispatchOutcome`), not an unhandled throw: the
engine catches its own faults, and the old tree's only uncaught path is a malformed
ledger document whose V8 `TypeError` text would freeze a crash into the corpus. That
shape is written `not-applicable` instead. The two commands with a deliberate injected
fault (`init`'s step runner) or an input contract (`issue render`'s stdin JSON) carry the
failure route on their own rows.

**Read sources are not second wiring tasks.** A cell whose bytes are produced by one
landing may read values from another: the wave gate's verdict rows come from T13, the
station names and yield conditions from T11, the wording from T14, the closed-document
judgment from T10, the preview's input from T13's `Run#previewOf`, the `init` step data
from T8. The wiring task is the landing that produces the cell's bytes; the read source
supplies a value to it.

**The landing cells are judged within the run, not against the baseline.**
`f3.skeleton-landing.*` judges whether `schema get … --output skeleton <target>` really
writes its target: both trees write in this pass — same fixture, same argv, same clock —
and the two targets must both be there and carry equal bytes. The written file holds the
wall clock's `date:` line, so a cross-day byte baseline for this cell would be a lie; the
content face is `f3.skeleton.*`, recorded in-process under the corpus's frozen date. Each
landing is taken INSIDE the run — the fixture tree is removed the moment the run ends.

## Recorded readings

The corpus's bytes live in `baseline/src-next.json`, recorded once from the live old tree
with `node --experimental-strip-types packages/cdd-engine/tests/parity/record.ts` (or
`recordCorpus` from `harness.ts`). The recording dies with the old tree at the cutover
(spec §3.3), in the same batch that deletes this home.

## The roster

One row per cell, rendered from the grid's own `UNITS` table (`grid.ts`) — the table and
the roster are one declaration and one rendering, and the parity suite fails the moment
they disagree. A landing task that exports a symbol other than the one named here rewrites
its row in `grid.ts` and re-renders this file with
`node --experimental-strip-types packages/cdd-engine/tests/parity/roster.ts`; until then
the row names the plan's declared landing, which is what makes a producer arriving unwired
go red.

| cell | task | producer | route |
| --- | --- | --- | --- |
| f1.implement.normal.stdout | T16 | surface/commands/implement.ts#ImplementCommand | normal |
| f1.implement.normal.stderr | T16 | surface/commands/implement.ts#ImplementCommand | normal |
| f1.implement.normal.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | normal |
| f1.implement.refusal.wrong-phase.stdout | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.wrong-phase.stderr | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.wrong-phase.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.split.stdout | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.split.stderr | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.split.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.wave-too-wide.stdout | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.wave-too-wide.stderr | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.wave-too-wide.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.too-many-tasks.stdout | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.too-many-tasks.stderr | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.too-many-tasks.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.mixed-batch.stdout | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.mixed-batch.stderr | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.mixed-batch.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.in-flight.stdout | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.in-flight.stderr | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.in-flight.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.no-host.stdout | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.no-host.stderr | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.no-host.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.failure.stdout | T16 | surface/commands/implement.ts#ImplementCommand | failure |
| f1.implement.failure.stderr | T16 | surface/commands/implement.ts#ImplementCommand | failure |
| f1.implement.failure.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | failure |
| f1.review.normal.stdout | T16 | surface/commands/review.ts#ReviewCommand | normal |
| f1.review.normal.stderr | T16 | surface/commands/review.ts#ReviewCommand | normal |
| f1.review.normal.exit-code | T16 | surface/commands/review.ts#ReviewCommand | normal |
| f1.review.refusal.dispatch-input.stdout | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.refusal.dispatch-input.stderr | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.refusal.dispatch-input.exit-code | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.refusal.unreadable-document.stdout | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.refusal.unreadable-document.stderr | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.refusal.unreadable-document.exit-code | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.failure.stdout | T16 | surface/commands/review.ts#ReviewCommand | failure |
| f1.review.failure.stderr | T16 | surface/commands/review.ts#ReviewCommand | failure |
| f1.review.failure.exit-code | T16 | surface/commands/review.ts#ReviewCommand | failure |
| f1.fix.normal.stdout | T16 | surface/commands/fix.ts#FixCommand | normal |
| f1.fix.normal.stderr | T16 | surface/commands/fix.ts#FixCommand | normal |
| f1.fix.normal.exit-code | T16 | surface/commands/fix.ts#FixCommand | normal |
| f1.fix.refusal.carrier.stdout | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.refusal.carrier.stderr | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.refusal.carrier.exit-code | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.refusal.artifact.stdout | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.refusal.artifact.stderr | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.refusal.artifact.exit-code | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.failure.stdout | T16 | surface/commands/fix.ts#FixCommand | failure |
| f1.fix.failure.stderr | T16 | surface/commands/fix.ts#FixCommand | failure |
| f1.fix.failure.exit-code | T16 | surface/commands/fix.ts#FixCommand | failure |
| f1.base-set.normal.stdout | T16 | surface/commands/base.ts#BaseCommand | normal |
| f1.base-set.normal.stderr | T16 | surface/commands/base.ts#BaseCommand | normal |
| f1.base-set.normal.exit-code | T16 | surface/commands/base.ts#BaseCommand | normal |
| f1.base-set.refusal.stdout | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-set.refusal.stderr | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-set.refusal.exit-code | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-set.failure.stdout | — | — | not-applicable |
| f1.base-set.failure.stderr | — | — | not-applicable |
| f1.base-set.failure.exit-code | — | — | not-applicable |
| f1.base-get.normal.stdout | T16 | surface/commands/base.ts#BaseCommand | normal |
| f1.base-get.normal.stderr | T16 | surface/commands/base.ts#BaseCommand | normal |
| f1.base-get.normal.exit-code | T16 | surface/commands/base.ts#BaseCommand | normal |
| f1.base-get.refusal.absent.stdout | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-get.refusal.absent.stderr | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-get.refusal.absent.exit-code | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-get.refusal.corrupt.stdout | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-get.refusal.corrupt.stderr | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-get.refusal.corrupt.exit-code | T16 | surface/commands/base.ts#BaseCommand | refusal |
| f1.base-get.failure.stdout | — | — | not-applicable |
| f1.base-get.failure.stderr | — | — | not-applicable |
| f1.base-get.failure.exit-code | — | — | not-applicable |
| f1.schema-get.normal.stdout | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f1.schema-get.normal.stderr | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f1.schema-get.normal.exit-code | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f1.schema-get.refusal.stdout | — | — | not-applicable |
| f1.schema-get.refusal.stderr | — | — | not-applicable |
| f1.schema-get.refusal.exit-code | — | — | not-applicable |
| f1.schema-get.failure.stdout | — | — | not-applicable |
| f1.schema-get.failure.stderr | — | — | not-applicable |
| f1.schema-get.failure.exit-code | — | — | not-applicable |
| f1.issue-render.normal.stdout | T16 | surface/commands/issue.ts#IssueCommand | normal |
| f1.issue-render.normal.stderr | T16 | surface/commands/issue.ts#IssueCommand | normal |
| f1.issue-render.normal.exit-code | T16 | surface/commands/issue.ts#IssueCommand | normal |
| f1.issue-render.refusal.stdout | — | — | not-applicable |
| f1.issue-render.refusal.stderr | — | — | not-applicable |
| f1.issue-render.refusal.exit-code | — | — | not-applicable |
| f1.issue-render.failure.stdout | T16 | surface/commands/issue.ts#IssueCommand | failure |
| f1.issue-render.failure.stderr | T16 | surface/commands/issue.ts#IssueCommand | failure |
| f1.issue-render.failure.exit-code | T16 | surface/commands/issue.ts#IssueCommand | failure |
| f1.board.normal.stdout | T16 | surface/commands/board.ts#BoardCommand | normal |
| f1.board.normal.stderr | T16 | surface/commands/board.ts#BoardCommand | normal |
| f1.board.normal.exit-code | T16 | surface/commands/board.ts#BoardCommand | normal |
| f1.board.refusal.carrier.stdout | T16 | surface/commands/board.ts#BoardCommand | refusal |
| f1.board.refusal.carrier.stderr | T16 | surface/commands/board.ts#BoardCommand | refusal |
| f1.board.refusal.carrier.exit-code | T16 | surface/commands/board.ts#BoardCommand | refusal |
| f1.board.failure.stdout | — | — | not-applicable |
| f1.board.failure.stderr | — | — | not-applicable |
| f1.board.failure.exit-code | — | — | not-applicable |
| f1.init.normal.stdout | T15 | surface/render/init.ts#InitRenderer | normal |
| f1.init.normal.stderr | T15 | surface/render/init.ts#InitRenderer | normal |
| f1.init.normal.exit-code | T15 | surface/render/init.ts#InitRenderer | normal |
| f1.init.refusal.stdout | — | — | not-applicable |
| f1.init.refusal.stderr | — | — | not-applicable |
| f1.init.refusal.exit-code | — | — | not-applicable |
| f1.init.failure.stdout | T15 | surface/render/init.ts#InitRenderer | failure |
| f1.init.failure.stderr | T15 | surface/render/init.ts#InitRenderer | failure |
| f1.init.failure.exit-code | T15 | surface/render/init.ts#InitRenderer | failure |
| f2.help.stdout | T16 | surface/index.ts#Cli | normal |
| f2.help.stderr | T16 | surface/index.ts#Cli | normal |
| f2.help.exit-code | T16 | surface/index.ts#Cli | normal |
| f2.usage.stdout | T16 | surface/index.ts#Cli | refusal |
| f2.usage.stderr | T16 | surface/index.ts#Cli | refusal |
| f2.usage.exit-code | T16 | surface/index.ts#Cli | refusal |
| f2.misuse.stdout | T16 | surface/index.ts#Cli | failure |
| f2.misuse.stderr | T16 | surface/index.ts#Cli | failure |
| f2.misuse.exit-code | T16 | surface/index.ts#Cli | failure |
| f3.skeleton.overall.stdout | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.overall.stderr | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.overall.exit-code | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.plan.stdout | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.plan.stderr | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.plan.exit-code | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.phase-spec.stdout | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.phase-spec.stderr | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.phase-spec.exit-code | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.single-spec.stdout | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.single-spec.stderr | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton.single-spec.exit-code | T9 | docs/skeleton/assembler.ts#SkeletonAssembler | normal |
| f3.skeleton-landing.stdout | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f3.skeleton-landing.stderr | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f3.skeleton-landing.exit-code | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f4.prompt.implement.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.prompt.implement.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.prompt.implement.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.prompt.fix.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.prompt.fix.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.prompt.fix.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.prompt.docs-fix.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.prompt.docs-fix.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.prompt.docs-fix.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.wave.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.wave.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.wave.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.branch.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.branch.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.branch.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.phase-spec.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.phase-spec.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.phase-spec.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.overall.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.overall.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.overall.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.plan.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.plan.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.plan.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.single-spec.stdout | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.single-spec.stderr | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f4.review.single-spec.exit-code | T15 | surface/render/templates.ts#TEMPLATE_PROMPT | normal |
| f5.capsule.success.stdout | T15 | surface/render/capsule.ts#Capsule | normal |
| f5.capsule.success.stderr | T15 | surface/render/capsule.ts#Capsule | normal |
| f5.capsule.success.exit-code | T15 | surface/render/capsule.ts#Capsule | normal |
| f5.capsule.failure.stdout | T15 | surface/render/capsule.ts#Capsule | normal |
| f5.capsule.failure.stderr | T15 | surface/render/capsule.ts#Capsule | normal |
| f5.capsule.failure.exit-code | T15 | surface/render/capsule.ts#Capsule | normal |
| f5.capsule.summary.stdout | T15 | surface/render/capsule.ts#Capsule | normal |
| f5.capsule.summary.stderr | T15 | surface/render/capsule.ts#Capsule | normal |
| f5.capsule.summary.exit-code | T15 | surface/render/capsule.ts#Capsule | normal |
| f6.board.unexpanded.stdout | T16 | surface/render/board.ts#BoardView | normal |
| f6.board.unexpanded.stderr | T16 | surface/render/board.ts#BoardView | normal |
| f6.board.unexpanded.exit-code | T16 | surface/render/board.ts#BoardView | normal |
| f6.board.expanded.stdout | T16 | surface/render/board.ts#BoardView | normal |
| f6.board.expanded.stderr | T16 | surface/render/board.ts#BoardView | normal |
| f6.board.expanded.exit-code | T16 | surface/render/board.ts#BoardView | normal |
| f6.board.refused.stdout | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.refused.stderr | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.refused.exit-code | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.orphan.stdout | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.orphan.stderr | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.orphan.exit-code | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.crashed.stdout | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.crashed.stderr | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.crashed.exit-code | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.art.anomalous.stdout | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.art.anomalous.stderr | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.art.anomalous.exit-code | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.art.all.stdout | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.art.all.stderr | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.art.all.exit-code | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.program.stdout | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.program.stderr | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.program.exit-code | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.program.art.stdout | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.program.art.stderr | T15 | surface/render/board.ts#BoardView | normal |
| f6.board.program.art.exit-code | T15 | surface/render/board.ts#BoardView | normal |
| f7.preview.passing.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.passing.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.passing.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-live.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-live.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-live.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-dead.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-dead.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-dead.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-corrupt.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-corrupt.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-corrupt.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.init.stdout | T15 | surface/render/init.ts#InitRenderer | normal |
| f7.preview.init.stderr | T15 | surface/render/init.ts#InitRenderer | normal |
| f7.preview.init.exit-code | T15 | surface/render/init.ts#InitRenderer | normal |
| f7.preview.blocking.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.blocking.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.blocking.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f8.blocked.message.stdout | T14 | surface/words/words.ts#Words | refusal |
| f8.blocked.message.stderr | T14 | surface/words/words.ts#Words | refusal |
| f8.blocked.message.exit-code | T14 | surface/words/words.ts#Words | refusal |
| f8.blocked.checked.stdout | T14 | surface/words/words.ts#Words | refusal |
| f8.blocked.checked.stderr | T14 | surface/words/words.ts#Words | refusal |
| f8.blocked.checked.exit-code | T14 | surface/words/words.ts#Words | refusal |
| f8.blocked.station.stdout | T11 | run/gate/preflight.ts#PreFlight | refusal |
| f8.blocked.station.stderr | T11 | run/gate/preflight.ts#PreFlight | refusal |
| f8.blocked.station.exit-code | T11 | run/gate/preflight.ts#PreFlight | refusal |
| f8.blocked.yielding.stdout | T11 | run/gate/preflight.ts#PreFlight | refusal |
| f8.blocked.yielding.stderr | T11 | run/gate/preflight.ts#PreFlight | refusal |
| f8.blocked.yielding.exit-code | T11 | run/gate/preflight.ts#PreFlight | refusal |
