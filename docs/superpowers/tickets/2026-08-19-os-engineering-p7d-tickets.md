# Tickets: P7d legacy naming cleanup

Zero-tech-debt purge of `os-*` / `engineering` / `oscaner-engineering` / `engineeringVersion` names from all first-party files. Source: [P7d design spec](../specs/2026-08-18-os-engineering-p7d-design.md) + [P7d implementation plan](../plans/2026-08-19-os-engineering-p7d.md). The single canonical replacement mapping lives in the spec §1; tickets reference it rather than duplicating paths.

Work the **frontier**: any ticket whose blockers are all done. T1/T2/T3 have no blockers — start there. T4 waits on T3; T5 waits on T1+T4; T6 waits on T5; T7 closes.

## T1 — Metadata + emit functions renamed to osuperpowers

**What to build:** The osuperpowers plugin's marketplace metadata (category/keywords/description), the emit machinery's public functions, and the emit test fixtures all speak `osuperpowers` instead of `engineering`; the vestigial cursor-plugins stale-wrapper guard is gone; running emit regenerates every derived artifact with the new names and `emit:check` reports no drift.

**Blocked by:** None — can start immediately.

- [ ] `packages/osuperpowers/package.json` oscaner-plugin.claude category/keywords + description use `osuperpowers` (no `engineering`, no `os-*`)
- [ ] `engineeringClaudeHooks`/`engineeringCursorHooks`/`engineeringHooksFor`/`emitOsEngineering` renamed to `osuperpowers*` in `manifests.mjs`, `emit.mjs`, `emit.test.mjs`; stale-wrapper guard deleted
- [ ] Vendored hook-factory entry is published; `source.mjs` VENDOR_FALLBACK (mattpocock) untouched
- [ ] `pnpm run emit` + `emit:check` green; derived artifacts (marketplace jsons, per-plugin manifests, gemini-extension.json, `.agents/skills` copies) regenerated

## T2 — Runtime pending path renamed to osuperpowers

**What to build:** The CDD gate and engine agree on a single pending root `${TMPDIR:-/tmp}/osuperpowers/pending-cdd`; old `oscaner-engineering` root gone from code and test fixtures; hard cut (no legacy read) — missing pending fail-open is safe by design; `CDD_PENDING_ROOT` override retained.

**Blocked by:** None — can start immediately.

- [ ] `cdd-gate-core.mjs` + `cdd-session-activate.mjs` pending root uses `osuperpowers`; `cdd-gate-core.mjs:231` comment updated
- [ ] `cdd-gate-core.test.mjs` + `session-activate.test.mjs` fixtures assert the new root; gate/engine node:test suites pass
- [ ] No `oscaner-engineering` in `packages/osuperpowers/bin/gate` + `bin/engine` (vibe hooks.toml residual is T4-owned)

## T3 — Harness channel renamed from os-init to init

**What to build:** The harness channel classification key is `init` (opencode/trae/vibe/kiro), with user-visible hints reading `osuperpowers:init harness <name>`; engine/tooling comments and test fixtures agree; the rule-reference scanner fixtures stop using `os-` model names.

**Blocked by:** None — can start immediately.

- [ ] `skills-probe.config.mjs` channel key `init`; hints `osuperpowers:init harness <name>`; `skills-probe.mjs`/`harness-detect.mjs` comments; engine comments (`runner.mjs`/`templates.mjs`/`cdd-run.mjs`)
- [ ] utils/engine/skill-gate test fixtures (`osInitChannel`/`config.channel["init"]`) consistent; rule-reference fixture dirs `aaa`/`bbb` + prefix-scoped negative assert + `rule-ref-` tmpdir
- [ ] Channel semantics unchanged: exactly 4 init-channel harnesses; utils+engine+rule-reference node:test suites pass

## T4 — os-init install surface renamed to init

**What to build:** The `init harness` installer lives at `bin/init/`, writes its manifest to `~/.osuperpowers/state/`, exposes the version as `OSUPERPOWERS_VERSION`/`osuperpowersVersion`, and installs user-harness artifacts named `osuperpowers.json`/`osuperpowers.ts`; ci-validate labels, step names, and checker functions use `osuperpowers`; the grok template file is renamed; the gates-compat test file is renamed with fixtures updated.

**Blocked by:** T3 (installer references the renamed channel key).

- [ ] `bin/init/` (git mv) + `install-gates.test.mjs` → `install-harness-gates.test.mjs` + `configs/grok/osuperpowers.json`
- [ ] `install-harness.mjs`: `OSUPERPOWERS_VERSION`/`osuperpowersVersion`, `source: "init"`, `~/.osuperpowers/state/`, `PI_TS_MARKER`, installed-artifact names, `osuperpowers:init harness:` CLI messages; header manifest-path comment matches real path
- [ ] grok/kiro/pi config dests + pi.ts header + vibe hook name `osuperpowers-cdd-gate` + configs-parse fixture
- [ ] `ci-validate.mjs` labels + `checkOsuperpowersSkillsCount`/`checkOsuperpowersGateHooks`; `ci-validate.test.mjs` (lines 1/3 + 96/97/101)
- [ ] Both install test files fixtures updated; init/gate/ci-validate test suites + full `pnpm run validate` green

## T5 — Plugin docs, skill bodies, and router speak osuperpowers

**What to build:** Every first-party live document and skill body says `osuperpowers` (root + package CLAUDE/README bilingual pairs, cdd-reference plugins list, gate-install manifest doc, cross-harness-overrides full pass, report-issue/init/writing-plans/brainstorming/subagent-lifecycle bodies); the SUPERSEDED `sdd-h6-reference.md` transition copy is deleted; router tests updated; script comments renamed; re-emit regenerates `.agents/skills` copies and derived manifests clean. Whitelisted: mattpocock `skills/engineering/` path refs, root CLAUDE.md:14 genre descriptor, VENDOR_FALLBACK.

**Blocked by:** T1, T4 (naming finalized; re-emit depends on T1 pipeline).

- [ ] cdd-reference(+zh) plugins list, gate-install manifest path/field, cross-harness-overrides (29 refs incl. `os-<slug>` schema + pending path + version stamp), root/package README+CLAUDE literals (incl. README.md:5 tagline), skill bodies (`{plugin-root}` wording, dogfood comments, `init/harness.md`), subagent-lifecycle
- [ ] `sdd-h6-reference.md` deleted; router tests (`validate-overrides-build.mjs` labels, `cursor-enforce.test.mjs` SKILL_SUFFIX) updated
- [ ] version/emit scripts comments renamed; avoided-whitelist untouched
- [ ] Re-emit + `emit:check` + full validate green; T5-scope grep (excluding whitelist lanes) clean; router node:test passes

## T6 — Historical P7a/b/c docs + overall spec synced

**What to build:** The overall spec (§2 P7a/P7b/P7d rows → completed + links, Header v4.2, change history v4.2) reflects the finished P7 series. The P7a/b/c docs are **rename-record documents** — per execution decision A, their old→new mapping tables and filename-slug references are exempt (they ARE the record); no token purge, no forward-stale content exists (verified 296 matches minus exempt classes = 0). Filenames intentionally kept.

**Blocked by:** T5 (final names settled).

- [ ] Overall spec updated: P7a/P7b rows ✅ + links; P7d row ✅ + links + acceptance points to design §8 lanes; v4.2 changelog entry
- [ ] D lane (exempt-class classifier: `os-engineering-p7` slug refs + `→`/`->` mapping records excluded) on the 8 existing p7 files → no residual; D2 markers (`P7d.*✅` + plan/design links) present in overall

## T7 — Final acceptance: zero legacy naming + green validation

**What to build:** The design-spec §8 acceptance, run end-to-end, proves zero legacy naming survives in first-party files: lane A (case-insensitive content grep with documented whitelist lanes incl. root CLAUDE.md:14 + upstream path refs), lane A2 (filename token scan incl. `cursor-plugins/`), lane D/D2 (P7 docs + overall markers), full node:test suites, `pnpm run validate`, and the version-script dry-run.

**Blocked by:** T1-T6.

- [ ] Lane A residual = ∅ (only whitelist: `skills/engineering/to-tickets`, source.mjs VENDOR_FALLBACK, publish-vendor fixture, CLAUDE.md:14); lane A2 no stale filenames
- [ ] D lane residual = ∅ after exempt-class filters (`os-engineering-p7` slug refs + `→`/`->` mapping records); D2 markers present
- [ ] All node:test suites + `pnpm run validate` green; `version-packages.mjs --dry-run` no error
- [ ] No derived file hand-edited (emit-only); vendors/ untouched