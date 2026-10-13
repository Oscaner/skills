# Doctrine — Template Contract, Skill Nodes, Program Experience

Maintainer-only doctrine (English-primary; not shipped to consumers): the non-mechanical judgment the mechanisms and tests do **not** enforce. The §3 items are gate-less judgment calls.

## 1. The template contract

`canonical → renderer → {emit, runtime} → round-trip guard`:

- **R1 Single source of truth** — template body text has one canonical; consumers hold zero hardcoded copies. Enumerations, labels, paragraph order, form-name sets are canonical-driven (`Object.keys(canonical)`, never a second list).
- **R2 Renderer determinism** — the renderer is pure (same in, constant out); paragraph structure (headings, punctuation, escaping, EOF) is the renderer's, never copy-paste's.
- **R3 Emit-generated products** — produced and committed only by `pnpm run emit`; every product path is in `generatedPaths`, and `pnpm run emit:check` is the CI drift guard.
- **R4 Two-stage round-trip** — migration-type changes: ① first render diffs empty; ② content migration re-renders and commits independently.
- **R5 Consumer-side usable** — products are consumable in the consumer environment (GitHub form yml, plugin manifests); no monorepo layout or toolchain dependency.

| # | Invariant |
|---|---|
| I1 | canonical locatable — fixed, greppable path; no md copy (grep hits only canonical + renderer) |
| I2 | renderer single point — one renderer function per product class; no second assembly path |
| I3 | `pnpm run emit:check` drift=0 — standing guard, green in CI and before commit |
| I4 | derived products never hand-edited — a hand-edit is overwritten at emit + CI drift; every change goes canonical → emit |

Doc-structure derives from the declaration plane (`declare.ts` → `project.schema()` · `projector.slices()` · `projector.tokens()`); edits land in the registry, not the derived files. The cached prefix is the slot-free shell (`## Instructions` + `## Handoff`) + the frozen `## Return` constant (see `03-cache-doctrine.md`).

## 2. Skill-node discipline — facts only

Every Node Definition (Do / Read / Exit / Fail) states only the facts **that node owns**; a fact a declaration already carries lives there, in exactly one of the four surfaces (**Flow Digraph → Node Definitions → Invariants → Failure Modes**). A node never restates the target skill's role, the `Review Convergence` invariant, commit discipline, or cross-node failure behavior. Keep a sentence only if it names behavior this node performs **and** is not the echo of an Invariant, a Failure Modes row, the Invocation discipline, or the target's `description`.

## 3. Program experience (non-mechanical)

- **Verify spec numbers before writing them.** `git ls-files` / `grep` any count entering a spec.
- **Variant tokens split the static prefix and kill the cache.** Round labels, timestamps, target paths belong in the variant tail.
- **Never edit the working tree while a dispatch is in flight.** The engine reads the live git tree as truth at the dispatch boundary; a mid-round edit exits the round BLOCKED.
- **"Uncommitted changes at return" ≠ a gate fired.** Cross-check the handoff (tree clean? findings intact? counter unchanged?).
- **Shared template hooks need explicit context wiring.** A subclass overriding a base step must thread the resolved context into the lifecycle ctx, or it silently no-ops.
- **Host-harness black-box tests must mock the harness for CI.** A real host name fails on a runner lacking the binary; use the fake-CLI + ghost-registry pattern.
- **A same-signature CI batch failure is a real-defect signal, not flake.** Reproduce locally and pin the mechanism.
- **A CI check rename must re-point the GitHub rulesets in the same change.** A stale `required_status_checks` leaves every PR "Expected — pending".

## 4. Engine smoke positioning

The release gate is the test-plane integration test (`smoke.integration.test.ts`): it boots the source bin (`node src-next/bin.ts`) over a fixture repo and asserts the status-capsule contract on the `--help` face plus the implement/review dry-run chain (`pnpm -C packages/cdd-engine run smoke`). The P4.2 consumer-sim (build → pack → tarball → install) is retired; the shared sentence — **consumer-sim = the cdd-engine published-artifact consumer black-box** — survives.
