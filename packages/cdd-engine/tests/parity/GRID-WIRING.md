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

**The three states** (spec §2.4): `GAP` — the producer has not landed, so the cell has no
judge yet; `DIFF` — the cell is wired and its bytes differ from the recording, red;
`MISSING` — the recorded state and the tree disagree, red. The per-wave judgment is
"wired cells show zero diffs, and the GAP set is exactly the set the baseline recorded as
unwired". "The GAP set is empty" is the cutover's judgment, not every wave's.

**Read sources are not second wiring tasks.** A cell whose bytes are produced by one
landing may read values from another: the wave gate's verdict rows come from T13, the
station names and yield conditions from T11, the wording from T14, the closed-document
judgment from T10, the preview's input from T13's `Run#previewOf`, the `init` step data
from T8. The wiring task is the landing that produces the cell's bytes; the read source
supplies a value to it.

**Two cells are shapes, not bytes.** `f3.skeleton-landing.*` records the landing FACT
(does the target file get written, and is it non-empty) rather than a byte string: the
skeleton's `date:` line is read from the system clock by the CLI face, so a cross-day
byte baseline for that cell would be a lie. Its content face is `f3.skeleton.*`, which is
recorded in-process under the corpus's frozen date.

## Recorded readings

The corpus's bytes live in `baseline/src-next.json`, recorded once from the live old tree
with `pnpm exec tsx tests/parity/record.ts` (or `recordBaseline` from `harness.ts`). The
recording dies with the old tree at the cutover (spec §3.3), in the same batch that
deletes this home.

## The roster

| cell | wiring task | producer | route |
| --- | --- | --- | --- |
| f1.implement.normal.stdout | T16 | surface/commands/implement.ts#ImplementCommand | normal |
| f1.implement.normal.stderr | T16 | surface/commands/implement.ts#ImplementCommand | normal |
| f1.implement.normal.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | normal |
| f1.implement.refusal.stdout | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.stderr | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.refusal.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | refusal |
| f1.implement.failure.stdout | T16 | surface/commands/implement.ts#ImplementCommand | failure |
| f1.implement.failure.stderr | T16 | surface/commands/implement.ts#ImplementCommand | failure |
| f1.implement.failure.exit-code | T16 | surface/commands/implement.ts#ImplementCommand | failure |
| f1.review.normal.stdout | T16 | surface/commands/review.ts#ReviewCommand | normal |
| f1.review.normal.stderr | T16 | surface/commands/review.ts#ReviewCommand | normal |
| f1.review.normal.exit-code | T16 | surface/commands/review.ts#ReviewCommand | normal |
| f1.review.refusal.stdout | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.refusal.stderr | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.refusal.exit-code | T16 | surface/commands/review.ts#ReviewCommand | refusal |
| f1.review.failure.stdout | T16 | surface/commands/review.ts#ReviewCommand | failure |
| f1.review.failure.stderr | T16 | surface/commands/review.ts#ReviewCommand | failure |
| f1.review.failure.exit-code | T16 | surface/commands/review.ts#ReviewCommand | failure |
| f1.fix.normal.stdout | T16 | surface/commands/fix.ts#FixCommand | normal |
| f1.fix.normal.stderr | T16 | surface/commands/fix.ts#FixCommand | normal |
| f1.fix.normal.exit-code | T16 | surface/commands/fix.ts#FixCommand | normal |
| f1.fix.refusal.stdout | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.refusal.stderr | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.refusal.exit-code | T16 | surface/commands/fix.ts#FixCommand | refusal |
| f1.fix.failure.stdout | T16 | surface/commands/fix.ts#FixCommand | failure |
| f1.fix.failure.stderr | T16 | surface/commands/fix.ts#FixCommand | failure |
| f1.fix.failure.exit-code | T16 | surface/commands/fix.ts#FixCommand | failure |
| f1.base-set.normal.stdout | T16 | surface/commands/baseset.ts# BaseCommand | normal |
| f1.base-set.normal.stderr | T16 | surface/commands/baseset.ts# BaseCommand | normal |
| f1.base-set.normal.exit-code | T16 | surface/commands/baseset.ts# BaseCommand | normal |
| f1.base-set.refusal.stdout | T16 | surface/commands/baseset.ts# BaseCommand | refusal |
| f1.base-set.refusal.stderr | T16 | surface/commands/baseset.ts# BaseCommand | refusal |
| f1.base-set.refusal.exit-code | T16 | surface/commands/baseset.ts# BaseCommand | refusal |
| f1.base-set.failure.stdout | T16 | surface/commands/baseset.ts# BaseCommand | failure |
| f1.base-set.failure.stderr | T16 | surface/commands/baseset.ts# BaseCommand | failure |
| f1.base-set.failure.exit-code | T16 | surface/commands/baseset.ts# BaseCommand | failure |
| f1.base-get.normal.stdout | T16 | surface/commands/baseget.ts# BaseCommand | normal |
| f1.base-get.normal.stderr | T16 | surface/commands/baseget.ts# BaseCommand | normal |
| f1.base-get.normal.exit-code | T16 | surface/commands/baseget.ts# BaseCommand | normal |
| f1.base-get.refusal.stdout | — | — (route not applicable) | not-applicable |
| f1.base-get.refusal.stderr | — | — (route not applicable) | not-applicable |
| f1.base-get.refusal.exit-code | — | — (route not applicable) | not-applicable |
| f1.base-get.failure.stdout | T16 | surface/commands/baseget.ts# BaseCommand | failure |
| f1.base-get.failure.stderr | T16 | surface/commands/baseget.ts# BaseCommand | failure |
| f1.base-get.failure.exit-code | T16 | surface/commands/baseget.ts# BaseCommand | failure |
| f1.schema-get.normal.stdout | T16 | surface/commands/schemaget.ts# SchemaCommand | normal |
| f1.schema-get.normal.stderr | T16 | surface/commands/schemaget.ts# SchemaCommand | normal |
| f1.schema-get.normal.exit-code | T16 | surface/commands/schemaget.ts# SchemaCommand | normal |
| f1.schema-get.refusal.stdout | — | — (route not applicable) | not-applicable |
| f1.schema-get.refusal.stderr | — | — (route not applicable) | not-applicable |
| f1.schema-get.refusal.exit-code | — | — (route not applicable) | not-applicable |
| f1.schema-get.failure.stdout | T16 | surface/commands/schemaget.ts# SchemaCommand | failure |
| f1.schema-get.failure.stderr | T16 | surface/commands/schemaget.ts# SchemaCommand | failure |
| f1.schema-get.failure.exit-code | T16 | surface/commands/schemaget.ts# SchemaCommand | failure |
| f1.issue-render.normal.stdout | T16 | surface/commands/issuerender.ts# IssueCommand | normal |
| f1.issue-render.normal.stderr | T16 | surface/commands/issuerender.ts# IssueCommand | normal |
| f1.issue-render.normal.exit-code | T16 | surface/commands/issuerender.ts# IssueCommand | normal |
| f1.issue-render.refusal.stdout | — | — (route not applicable) | not-applicable |
| f1.issue-render.refusal.stderr | — | — (route not applicable) | not-applicable |
| f1.issue-render.refusal.exit-code | — | — (route not applicable) | not-applicable |
| f1.issue-render.failure.stdout | T16 | surface/commands/issuerender.ts# IssueCommand | failure |
| f1.issue-render.failure.stderr | T16 | surface/commands/issuerender.ts# IssueCommand | failure |
| f1.issue-render.failure.exit-code | T16 | surface/commands/issuerender.ts# IssueCommand | failure |
| f1.board.normal.stdout | T16 | surface/commands/board.ts#BoardCommand | normal |
| f1.board.normal.stderr | T16 | surface/commands/board.ts#BoardCommand | normal |
| f1.board.normal.exit-code | T16 | surface/commands/board.ts#BoardCommand | normal |
| f1.board.refusal.stdout | T16 | surface/commands/board.ts#BoardCommand | refusal |
| f1.board.refusal.stderr | T16 | surface/commands/board.ts#BoardCommand | refusal |
| f1.board.refusal.exit-code | T16 | surface/commands/board.ts#BoardCommand | refusal |
| f1.board.failure.stdout | T16 | surface/commands/board.ts#BoardCommand | failure |
| f1.board.failure.stderr | T16 | surface/commands/board.ts#BoardCommand | failure |
| f1.board.failure.exit-code | T16 | surface/commands/board.ts#BoardCommand | failure |
| f1.init.normal.stdout | T15 | surface/render/init.ts#InitRender | normal |
| f1.init.normal.stderr | T15 | surface/render/usage.ts#UsageFace | normal |
| f1.init.normal.exit-code | T16 | surface/commands/init.ts#InitCommand | normal |
| f1.init.refusal.stdout | T15 | surface/render/init.ts#InitRender | refusal |
| f1.init.refusal.stderr | T15 | surface/render/usage.ts#UsageFace | refusal |
| f1.init.refusal.exit-code | T16 | surface/commands/init.ts#InitCommand | refusal |
| f1.init.failure.stdout | T15 | surface/render/init.ts#InitRender | failure |
| f1.init.failure.stderr | T15 | surface/render/usage.ts#UsageFace | failure |
| f1.init.failure.exit-code | T16 | surface/commands/init.ts#InitCommand | failure |
| f2.help.stdout | T16 | surface/commands/cli.ts#Cli | normal |
| f2.help.stderr | T16 | surface/commands/cli.ts#Cli | normal |
| f2.help.exit-code | T16 | surface/commands/cli.ts#Cli | normal |
| f2.usage.stdout | T16 | surface/commands/cli.ts#Cli | refusal |
| f2.usage.stderr | T16 | surface/commands/cli.ts#Cli | refusal |
| f2.usage.exit-code | T16 | surface/commands/cli.ts#Cli | refusal |
| f2.misuse.stdout | T16 | surface/commands/cli.ts#Cli | failure |
| f2.misuse.stderr | T16 | surface/commands/cli.ts#Cli | failure |
| f2.misuse.exit-code | T16 | surface/commands/cli.ts#Cli | failure |
| f3.skeleton.overall.stdout | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.overall.stderr | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.overall.exit-code | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.plan.stdout | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.plan.stderr | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.plan.exit-code | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.phase-spec.stdout | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.phase-spec.stderr | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.phase-spec.exit-code | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.single-spec.stdout | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.single-spec.stderr | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton.single-spec.exit-code | T9 | docs/skeleton/index.ts#Skeletons | normal |
| f3.skeleton-landing.stdout | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f3.skeleton-landing.stderr | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f3.skeleton-landing.exit-code | T16 | surface/commands/schema.ts#SchemaCommand | normal |
| f4.prompt.implement.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.prompt.implement.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.prompt.implement.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.prompt.fix.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.prompt.fix.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.prompt.fix.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.prompt.docs-fix.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.prompt.docs-fix.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.prompt.docs-fix.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.wave.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.wave.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.wave.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.branch.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.branch.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.branch.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.phase-spec.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.phase-spec.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.phase-spec.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.overall.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.overall.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.overall.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.plan.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.plan.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.plan.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.single-spec.stdout | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.single-spec.stderr | T15 | surface/render/prompt.ts#PromptRender | normal |
| f4.review.single-spec.exit-code | T15 | surface/render/prompt.ts#PromptRender | normal |
| f5.capsule.success.stdout | T15 | surface/render/capsule.ts#CapsuleRender | normal |
| f5.capsule.success.stderr | T15 | surface/render/capsule.ts#CapsuleRender | normal |
| f5.capsule.success.exit-code | T15 | surface/render/capsule.ts#CapsuleRender | normal |
| f5.capsule.failure.stdout | T15 | surface/render/capsule.ts#CapsuleRender | normal |
| f5.capsule.failure.stderr | T15 | surface/render/capsule.ts#CapsuleRender | normal |
| f5.capsule.failure.exit-code | T15 | surface/render/capsule.ts#CapsuleRender | normal |
| f6.board.unexpanded.stdout | T15 | surface/render/board.ts#BoardRender | normal |
| f6.board.unexpanded.stderr | T15 | surface/render/board.ts#BoardRender | normal |
| f6.board.unexpanded.exit-code | T15 | surface/render/board.ts#BoardRender | normal |
| f6.board.expanded.stdout | T15 | surface/render/board.ts#BoardRender | normal |
| f6.board.expanded.stderr | T15 | surface/render/board.ts#BoardRender | normal |
| f6.board.expanded.exit-code | T15 | surface/render/board.ts#BoardRender | normal |
| f7.preview.passing.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.passing.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.passing.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-absent.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-absent.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-absent.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-held.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-held.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-held.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-corrupt.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-corrupt.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.holding-corrupt.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.blocking.stdout | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.blocking.stderr | T15 | surface/render/preview.ts#Preview | normal |
| f7.preview.blocking.exit-code | T15 | surface/render/preview.ts#Preview | normal |
| f8.blocked.message.stdout | T14 | surface/words/index.ts#Words | refusal |
| f8.blocked.message.stderr | T14 | surface/words/index.ts#Words | refusal |
| f8.blocked.message.exit-code | T14 | surface/words/index.ts#Words | refusal |
| f8.blocked.checked.stdout | T14 | surface/words/index.ts#Words | refusal |
| f8.blocked.checked.stderr | T14 | surface/words/index.ts#Words | refusal |
| f8.blocked.checked.exit-code | T14 | surface/words/index.ts#Words | refusal |
| f8.blocked.station.stdout | T11 | run/gate/preflight.ts#PreFlightGate | refusal |
| f8.blocked.station.stderr | T11 | run/gate/preflight.ts#PreFlightGate | refusal |
| f8.blocked.station.exit-code | T11 | run/gate/preflight.ts#PreFlightGate | refusal |
| f8.blocked.yielding.stdout | T11 | run/gate/preflight.ts#PreFlightGate | refusal |
| f8.blocked.yielding.stderr | T11 | run/gate/preflight.ts#PreFlightGate | refusal |
| f8.blocked.yielding.exit-code | T11 | run/gate/preflight.ts#PreFlightGate | refusal |
