---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P7 — brand unification + legacy-naming cleanup (zero tech debt).

**P7a — package dir rename + emit adaptation**: `packages/engineering` → `packages/osuperpowers`, `packages/superpowers-overrides` → `packages/osuperpowers-router`; package.json (name/repository.directory/description), `scripts/emit.mjs`, `scripts/ci-validate.mjs` and emit tests synced; `pnpm run emit` regenerates every derived manifest.

**P7b — skill dir rename + namespace**: 9 `skills/os-*` directories lose the `os-` prefix (`os-brainstorming` → `brainstorming`, etc.); namespace unified to `osuperpowers:*` (router target table, SKILL.md references, `skills/init/` self-check table, `.agents/skills` copies); emit namespace name updated.

**P7c — version management + release pipeline**: `version-packages.mjs` package name → `@oscaner-skills/osuperpowers`; `release.yml` tag prefixes → `osuperpowers-router@`/`osuperpowers@`; opencode config, issue-template labels, GitHub labels, `.changeset/README.md` residual references cleaned; consumed changesets removed.

**P7d — legacy-naming zero-tech-debt purge**: emit function names (`engineeringClaudeHooks`/`engineeringCursorHooks`/`engineeringHooksFor`/`emitOsEngineering` → `osuperpowers*`) + metadata (category/keywords/description); runtime pending root `${TMPDIR}/osuperpowers/pending-cdd` (hard cut — fail-open safe); harness channel `os-init` → `init` (hints unified to `osuperpowers:init harness <name>`); install surface `bin/os-init` → `bin/init`, manifest `~/.osuperpowers/state/`, artifact names `osuperpowers.json`/`osuperpowers.ts`, `osuperpowersVersion`/`OSUPERPOWERS_VERSION`, vibe hook `osuperpowers-cdd-gate`; plugin docs / skill bodies / router docs fully cleaned (incl. deleting the SUPERSEDED `sdd-h6-reference.md`); acceptance lanes redesigned (`-i` token patterns + filename scan + whitelists, replacing the easy-to-miss per-line `-v` grep); historical P7 docs + overall spec closed out (rename-record mapping tables exempt). `version-packages.mjs` gains a real `--dry-run` and rejects unknown arguments.