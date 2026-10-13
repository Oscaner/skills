# Doctrine — Template Contract, Skill Nodes, Program Experience

Maintainer-only doctrine for this monorepo's developers (English-primary; not shipped to consumers). It collects the durable, non-mechanical judgment the engine's mechanisms and tests do **not** enforce on their own: the template contract, the skill-node authoring discipline, and the hard-won lessons from the kairos-overhaul program. Where a rule is mechanically checked, the check is the source of truth and this document does not restate it.

## 1. The template contract

Every template-shaped content converges on one source of truth: canonical data → one renderer → derived products. The lifecycle is a five-node chain — `canonical → renderer → {emit product, runtime product} → round-trip guard`:

- **R1 — Single source of truth.** Template body text has exactly one canonical; consumers hold zero hardcoded copies. Enumerations, labels, paragraph order, and form-name sets are canonical-driven (name sets via `Object.keys(canonical)`, never a second literal list).
- **R2 — Renderer determinism.** The renderer is a pure function: same canonical in, constant output out. Paragraph structure (headings, punctuation, escaping, EOF) is decided by the renderer, never by copy-paste.
- **R3 — Derived products are emit-generated.** Derived products are produced and committed only by `pnpm run emit`; every product path is registered in `generatedPaths`, and `pnpm run emit:check` is the CI-slung drift guard (drift=0).
- **R4 — Two-stage round-trip.** Migration-type changes verify in two stages: ① first render diffs empty; ② content migration re-renders and commits in one independent step.
- **R5 — Consumer-side usable.** Derived products are consumable in the consumer environment (GitHub form yml, plugin manifests); no monorepo layout or this-repo toolchain dependency.

| # | Invariant |
|---|---|
| I1 | canonical locatable — the canonical path is fixed and greppable; the same body has no md copy (grep hits only canonical + renderer) |
| I2 | renderer single point — each derived-product class has exactly one renderer function; no second assembly path |
| I3 | `pnpm run emit:check` drift=0 — standing guard, green in CI and before commit |
| I4 | derived products never hand-edited — a hand-edit is overwritten at next emit + CI drift; every change goes canonical → emit |

**Cache integration.** The segment attribute is the cache contract's landing spot: the shell (`## Instructions` + `## Handoff`, slot-free) plus the frozen `## Return` constant are the cached prefix fuel, and `## Round context` is the single dynamic zone — per-dispatch tokens render nowhere else. See `03-cache-doctrine.md`.

**Doc-structure single source.** Doc-structure content derives from the engine's declaration plane: the registries (`src-next/contract/declare.ts`) project the schema (`project.schema()` → the byte-pinned snapshots), the slices (`projector.slices()`, consumed by `doc.ts`), and the token plane (`projector.tokens()`). Content edits land in the registry, never the derived files; skills consume the schema face via `cdd schema get <type>`. One plan/spec grammar: legacy faces block at the structural judgment (`judge.ts`, over the declared anchors), dispatch groups derive from the tasks' single `- **DependsOn**:` edge (lower-numbered only), and legacy docs migrate into the canonical grammar until zero residue.

## 2. Skill-node discipline — facts only

Every Node Definition (Do / Read / Exit / Fail) in an orchestrator SKILL.md states only the facts **that node owns**; a fact a single declaration already carries lives there, in exactly one of the four surfaces (**Flow Digraph → Node Definitions → Invariants → Failure Modes**). A node never restates: the target skill's role (its own `description`), the `Review Convergence` invariant, commit discipline (the Invariants row), or cross-node failure behavior (the skill's own `## Failure Modes` table). Keep a sentence only if it names behavior this node performs **and** is not the echo of an Invariant, a Failure Modes row, the Invocation discipline, or the target's description — otherwise promote the fact once and delete the node copy.

## 3. Program experience (non-mechanical)

The lessons below are judgment calls no gate can test; they are the standing rules for work on this repo.

- **Verify spec numbers before writing them.** `git ls-files` / `grep` any count that enters a spec — an unverified figure is a defect waiting to surface.
- **Variant tokens split the static prefix and kill the cache.** Round labels, timestamps, and target paths belong in the variant tail, never before the static zone.
- **Never edit the working tree while a dispatch is in flight.** The engine treats the live git tree as ground truth at the dispatch boundary; a mid-round edit looks like a forgetful agent and the exit gate rewrites the round BLOCKED.
- **"Uncommitted changes at return" ≠ a gate fired.** Cross-check before diagnosing: is the tree clean? is the handoff findings set intact? is the counter unchanged? An intact handoff means the BLOCKED came from the agent's own rollup.
- **Shared template hooks need explicit context wiring.** A subclass overriding a base template step must thread the resolved context into the lifecycle ctx, or the step silently no-ops.
- **Host-harness black-box tests must mock the harness for CI.** A real host name fails on a runner lacking the binary; use the fake-CLI + ghost-registry pattern.
- **A same-signature CI batch failure is a real-defect signal, not flake.** Attribute before labeling — reproduce locally and pin the mechanism; a "flake" label requires reproduction.
- **A CI check rename must re-point the GitHub rulesets in the same change.** Dissolving or renaming a required status check without updating `required_status_checks` leaves every PR on an eternal "Expected — pending" placeholder, invisible to every in-tree pin.

## 4. Engine smoke positioning

The engine's release gate is the cdd-engine test-plane integration test (`packages/cdd-engine/src-next/__tests__/smoke.integration.test.ts`): it boots the source bin (`node src-next/bin.ts`) over a fixture repo and asserts the status-capsule contract on the `--help` face plus the implement/review dry-run chain, run as `pnpm -C packages/cdd-engine run smoke`. The P4.2 consumer-sim (real build → pack → tarball → consumer install) is retired; the positioning sentence they share — **consumer-sim = the cdd-engine published-artifact consumer black-box** — survives as the family definition. The smoke's subprocess cost keeps it off the daily PR surface; push→main runs it as a pre-version gate in `release.yml`, wired before the changesets action, so a failure leaves a clean tree to roll back from.
