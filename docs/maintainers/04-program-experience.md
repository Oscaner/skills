# Program Experience — P1 → P6

Maintainer-only record of the hard-won lessons from the kairos-overhaul program (P1 runtime layout → P6 convergence); the baking input for skill document templates and the context for any future program touching this codebase.

## 1. Organization & process

1. **Delete-anything-that-isn't-consumed** — dead workspaces/files/surfaces are removed, not frozen.
2. **Deletion must sync its only caller** — removing a command/artifact without removing its caller is orphan-debt.
3. **Anti-residue guards on every deletion** — a stale-lexicon guard prevents the vocabulary from creeping back.
4. **Backfill-as-version** — mid-phase requirement changes land in the overall first (version bump + change history + phase tables) before implementation continues.
5. **Single-root authority** — every derived surface converges on one root: workspace root, docs root, schema, finding-meta, labels SOT, context contract.
6. **Mechanical guard beats verbal discipline** — double gates, validators, residue, byte-invariants: discipline that cannot be tested does not execute.
7. **Shrink capability claims** — unproven capabilities are withdrawn, not parked.
8. **The program turns the lens on itself** — cdd-design/grilling flows must honestly describe single-session reality (session-call semantics), or they erode.

## 2. Engineering & architecture

9. Destructive change, high-dimension abstraction, freely changeable code structure/directory layout is this program's governing principle.
10. **Bounded-plane model** — publish surface / engine source / orchestration / data / docs each have explicit boundaries, languages, and contracts.
11. **Full TypeScript + unbuild** — abstract base classes become compile-time constraints; erasable-only syntax runs natively on Node.
12. **Commit double-gate** — entry (clean tree before dispatch) + exit (changes committed); the review baseline = committed state.
13. **Third-party convergence** — use a package before hand-writing; maintain only functional logic; every dependency (and the not-included list) in a maintainer doc.
14. **Dependency-axis directories** — cli → dispatch → {rules, artifacts, render} → infra; "which layer am I changing" is self-locating.
15. **Output-contract single source, schema-verbatim** — zero hand-written renders; compact injection saves tokens.
16. **Three input channels, zero-disk context** — argv / git facts / env policy; context is per-call memory, never a persistent runtime store.
17. **Failure categories + quota isolation + engine-held timeouts** — categories get isolated retry quotas; the engine owns timeout judgment.
18. **Test colocation + memory guard** — `src/<dir>/__tests__/<file>.test.ts`; vitest is bounded so full-batch runs don't OOM the host.

## 3. Caching / context

19. **Six cross-provider axioms** — static-first, byte-stability, volatile-to-tail, breakpoint-surface-limited, hit-rate-observability, write economics. See `03-context-caching-doctrine.md`.
20. **Byte-plane over breakpoint-plane** — the engine can only stabilize bytes; the harness CLI places breakpoints.
21. **Honest boundaries** — claims scoped to TTL-window consecutive rounds, measured not assumed; unobservable harnesses unclaimed.
22. **Capability as data** — registry cache profiles make new harnesses a data row, zero contract changes.

## 4. Prompts & templates

23. **Template systematization, five layers** — JSON schema-verbatim · one skeleton · naming · description · structural skeleton + clause library + token registry. See `01-template-doctrine.md`.
24. **Naming doctrine** — scoped semantics, full words, one word one meaning (the retired `H1_BLOCK`-rename lesson). See `02-naming-conventions.md`.
25. **Discipline dual-track** — mechanically-checkable discipline becomes an assertion; only genuinely uncheckable rules live as single-point annotations.

## 5. Anti-patterns

26. Undefined `.mjs`/`.ts` plane boundaries are debt — declare them.
27. **Spec numbers must be verified** — `git ls-files` / `grep` before writing any count into a spec.
28. Undocumented test prerequisites replicate as one-root-cause batches (an early phase's 14 failed tests shared one undocumented cause).
29. **pre-commit full-validate vs dirty tree is a structural contradiction** — align the gate to its boundary (tree-independent subset) rather than breaking it.
30. **Variant tokens splitting the static prefix kill the cache** — round labels, timestamps, target paths belong in the variant tail.
31. An overall registration is not what a sub-agent reads — discipline must land in the executing surface (templates/clauses), not only in the charter.

## 6. Architecture discipline

32. **Layered dependency boundary** — `infra → rules → artifacts → dispatch → cli`; imports flow up, a lower layer never imports a higher one (one carve-out: `rules → artifacts`).
33. **Mechanisms anchor the template method — zero island dispatch** — gate / liveness / carrier / residue hang on `DispatchLifecycle` overridden hooks; a flat dispatch body that re-implements lifecycle logic is the third-island failure.
34. **Error consolidation — `infra/exit.ts`** — recoverable orchestration errors throw the `CddExitError` family (`exitCode` + `kind`); invariants assert via `invariant(cond, msg)`. Zero bare `throw new Error` in production code.
35. **Semantic self-sufficiency — zero stage anchors in injection surfaces** — agent-visible surfaces (prompt, shell prose, schemas) carry meaning in the name; task numbers / phase refs are orchestrator-internal and prohibited. The residue guard pins zero `T\d+|P\d+` tokens there.
36. **Unified abstraction before patching** — first ask "what is the single concept behind these two implementations?"; collapse duplicates into one mechanism and one owner first.
37. **Never edit the working tree while a dispatch is in flight** — the engine treats the live git tree as ground truth at the dispatch boundary; a mid-round doc edit looks like a forgetful agent → the exit gate rewrites the round BLOCKED.
38. **"Uncommitted changes at return" ≠ gate fired** — cross-check: tree clean? handoff findings intact? counter unchanged? An intact handoff means the BLOCKED came from the agent's `unverifiable`/`plan_conflicts` rollup.
39. **Engine-materialized implement handoffs are resilient to return drift** — a mis-formatted return is rewritten BLOCKED even with a perfect committed deliverable; re-dispatch the same brief (`base==head` legal).
40. **"Zero legacy residue" must enumerate surfaces** — name the planes (tokens · content prose · identifiers) before checking, and pin each plane with a mechanical guard.
41. **Shared template hooks need explicit context wiring** — a subclass overriding a base template step must thread the resolved context into the lifecycle ctx (a `handoffPath` left `""` silently no-ops).
42. **Crash recovery = the commit ledger — zero stash** — a 403 root cause was a stale cross-branch stash mis-hit; recovery = crash-only snapshot + crash record, resume via the BLOCKED `next:`.
43. **Host-harness black-box tests must mock the harness for CI** — a real host name fails on a runner lacking the binary (pre-flight gate exits 2 first); use the fake-CLI + ghost-registry pattern.
44. **Skills are consumer-operating surfaces — zero design-history / mechanism narration** — SKILL.md specifies the executable flow and nothing else; design history, mechanism explanation, and internal-program refs are forbidden. Enforced by the skill-anatomy schema's consumer-purity facet.

## 7. Consumer-parity program norms (P3 closeout, 2026-09-22)

Operational norms fixed by the consumer-parity P3 rebuild; each item is grep-verifiable. Item numbering continues section 6.

45. **Zero product-path fixtures** — unit/e2e suites are functional verification; no repo product path may serve as a test fixture. Canary evidence belongs to runtime dispatch, never product-path fixtures.
46. **Zero numbered step anchors** — validate step names are semantic, not opaque numbers (the `5b0` / `5b1` / `5c` / `12.` family is retired); `ci-validate.test.ts` pins digit-led families at zero residue.
47. **Zero legacy-exemption dead code** — C3-hit code is deleted, never exempted (`plan-spec-anchors`' Class C legacy exemption and `isLegacyRef` were repo-only carve-outs, deleted).
48. **Phase-id syntax A** — canonical phase ids are dotted numeric `P<digits>(.digits)*` (split phases climb the dot hierarchy, e.g. `P2.1`); letters or hyphens are prohibited.
49. **Single enforcement face** — the four-table charter adjudication has exactly one implementation: the engine lifecycle; `pnpm run validate` has no four-table block.
50. **Validate 11-block structure snapshot** — `pnpm run validate` composes 11 semantic blocks: emit freshness / plugin resolution · skills inventory · behavior tree · wiring guard / dev stub · engine suite / zero residue + channel audit / marketplace / scripts unit / version sync. The pre-commit subset is 9 blocks — the engine pair is tree-coupled and excluded.
51. **cdd output zero-filtering** — any skill calling the cdd CLI reads the full stdout/stderr; `tail` / `head` / `2>&1 |` / `EXIT=$?` capture wrappers are forbidden.
52. **Result-face visibility + exit.ts single source** — every op prints the single status capsule (`status:` / `blocker:` / `handoff:` + `next:`); the orchestrator reads the verdict without opening the handoff; command-level exits single-source through `infra/exit.ts` (0/1/2/3 unchanged).
53. **Signal-safe exit latch** — the CLI signal contract (SIGINT/SIGTERM/SIGHUP → teardownAll → exit 128+signo) must beat a concurrent run-boundary exit (`process.exit` is first-call-decides). Pinned in `src/bin.ts`: a module-level `signalExitCode` latch set **synchronously** at signal entry (before any await), plus a single `finalExit(code) = process.exit(signalExitCode ?? code)` used at every process.exit site.
54. **Same-signature CI batch failure = real-defect signal, not random flake** — an N/N failure on the same assertion is a reachability signal, not noise. Attribute before labeling: reproduce locally and pin the mechanism; a reviewer "flake" label requires reproduction.

## 8. Consumer-sim release gate (P4.2, 2026-09-26)

**smoke-cdd positioning** — `smoke-cdd` (`scripts/validate/smoke-cdd.ts`) is the **consumer-sim = the cdd-engine published-artifact consumer black-box**: real build → pack → tarball → consumer install → `cdd schema get` + 5-command dry-run chain; the only CI face installing the packed artifact into an ephemeral consumer repo. Exclusive to cdd-engine; kairos ships via normal npm (pack allowlist + emit + version-sync).

**Release-only gate** — build + pack + install cost keeps it off the daily PR surface; push→main runs emit freshness + the dual consumer gates in `release.yml`, wired **before** the changesets action:

- pre-version baseline gate — `node scripts/run.ts smoke-cdd` (version-agnostic); failure leaves a clean tree to roll back from;
- post-version gate — `changeset status` (zero pending) then `smoke-cdd --expect-version 1.0.0` (tarball + installed package.json `== 1.0.0`), ahead of `changeset publish` — the released artifact is the verified artifact.

**Restore** — to move the consumer black-box back onto the daily PR face, add `smoke-cdd` to `pr-validate.yml` and drop the pre-version gate from `release.yml`.

55. **Validate ↔ smoke-cdd serial discipline** — both write `packages/cdd-engine/dist/` (validate materializes the dev stub, the engine suite reads dist; smoke-cdd rebuilds the directory): a P4.2 concurrent run ENOENTed the engine suite (reproduced; serial re-run green). Run `pnpm run validate` + `node scripts/run.ts smoke-cdd` serially.

## 9. Contract Lexicon (P3, 2026-09-30)

56. **Contract Lexicon single source** — command-contract vocab (harness keys · status vocab+axes · stdout tokens+banned shapes · G2 residue allowance) in `contract-lexicon.json`; `ContractLexiconGuard` runs its check faces as one validate block — change the word table, never the code. Zero-debt/read-back vocab single-sourced with engine output; orchestrators keep zero restates.

57. **Consumer-facing description strings carry zero program history** — schema `description` values and exported doc comments state semantics only: phase-anchor adjectives and lifecycle words (`extension bit`/`declared surface`/`zero read/write at P2`) barred; `P<digits>` legal in domain-role (phase-id grammar). Mirrors 35/44; pinned at P3 T9.

---

**Use**: bake these into scaffolds (templates), consult before touching the program's mechanisms, and treat item 27 as a standing rule for every document this program produces.
