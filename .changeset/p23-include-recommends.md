---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/kairos": patch
---

**`cdd init --include-recommends` — the recommended plugin tier (P23).** The three core
packages remain the install contract and the six recommended pi capability packages are
opt-in: `PLUGINS` grows one `tier` field (`"core" | "recommended"`) and six rows
(`@ff-labs/pi-fff` · `@juicesharp/rpiv-todo` · `@juicesharp/rpiv-ask-user-question` ·
`pi-web-access` · `pi-background-tasks` · `pi-agentsmd`), in roster order, and the single
flatten point filters on `tier === "core"` unless the flag is present.

Consumer-visible effects. `cdd init --harness=pi` without the flag is byte-identical to
before: three steps, `init: 3 steps ok (pi · install)`, the same failure line and the same
`--update` hint. With the flag, `--harness=pi` runs nine steps and the summary reads
`<c> core + <r> recommended`; `--harness=claude` gains no step (the six capabilities are
native there, so its recommended column is an empty array and the README renders `—`) and
prints `init: no recommended packages for claude`. A recommended-tier failure stops at the
first failure with exit 1 and appends one line naming the package as recommended —
`init: <package> is a recommended package — the core plugin set is already installed` for
the install shape, `init: <package> is a recommended package — run cdd init
--harness=<host> --include-recommends without --update first` for `--update` — after the
existing failure line and before the unchanged hint. The engine never parses harness
output, so no step is skipped on the strength of what a subprocess printed.

The kairos README family carries the consumer face: a tier-split lead-in, the nine-row
install table (every recommended claude cell `—`), one grouped six-line rationale below the
table, and the `cdd init --harness=pi --update --include-recommends` usage line; the
root READMEs name the flag once in Installation and the engine READMEs' `init` row reads
`cdd init --harness=<claude|pi> [--update] [--include-recommends]`. Zero `SKILL.md`
change: the install surface belongs to the READMEs, and a guard sweeps the shipped skill
prose (six `SKILL.md` plus `cdd-dev/docs/base.md`) for the flag literal and the six
package names.
