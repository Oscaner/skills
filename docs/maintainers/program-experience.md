# Program Experience — P1 → P6

Maintainer-only record of the hard-won lessons from the osuperpowers-overhaul program (P1 runtime layout → P6 convergence). Used as the baking input for skill document templates and as context for any future program touching this codebase. Condensed reference of the spec §2.6 list; each item is a claim about how this program actually failed or succeeded.

## A. Organization & process

1. **Delete-anything-that-isn't-consumed** — dead workspaces/files/surfaces are removed, not frozen (the legacy runtime-workspace tree under the old root was purged).
2. **Deletion must sync its only caller** — removing a command/artifact without removing its caller is an orphan-debt (the cli-research skill was deleted together with its only calling subcommand).
3. **Anti-residue guards on every deletion** — a stale-lexicon guard prevents the vocabulary from creeping back (across the program's phases; this convergence phase swept vendors, the `.agents` emit-surface, and the droid/pi keywords).
4. **Backfill-as-version** — mid-phase requirement changes are recorded in the overall first (version bump + change history + synced phase tables) before implementation continues (Boundary rules).
5. **Single-root authority** — every derived surface converges on one root: workspace root, docs root, schema, finding-meta, labels SOT, context contract.
6. **Mechanical guard beats verbal discipline** — double gates, validators, residue, byte-invariants: discipline that cannot be tested does not execute.
7. **Shrink capability claims** — unproven capabilities are withdrawn, not parked (decision C: 8 harnesses → 2 proven).
8. **The program turns the lens on itself** — brainstorming/grilling flows must honestly describe single-session reality (session-call semantics), or they erode.

## B. Engineering & architecture

9. Destructive change, high-dimension abstraction, freely changeable code structure/directory layout (this convergence phase's governing principle).
10. **Bounded-plane model** — publish surface / engine source / orchestration / data / docs each have explicit boundaries, languages, and contracts.
11. **Full TypeScript + unbuild** — abstract base classes become compile-time constraints; erasable-only syntax + explicit `.ts` extensions run natively on Node.
12. **Commit double-gate** — entry (clean tree before dispatch) + exit (changes committed); mechanical, owner-agnostic; review baseline = committed state.
13. **Third-party convergence** — use a package before hand-writing; maintain only functional logic; every dependency (and the not-included list) in a maintainer doc.
14. **Dependency-axis directories** — cli → dispatch → {rules, artifacts, render} → infra; "which layer am I changing" is self-locating.
15. **Output-contract single source, schema-verbatim** — zero hand-written renders; compact injection saves tokens.
16. **Three input channels, zero-disk context** — argv / git facts / env policy; context is per-call memory (a persistent runtime context is a second source of truth).
17. **Failure categories + quota isolation + engine-held timeouts** — categories get isolated retry quotas; the engine owns timeout judgment.
18. **Test colocation + memory guard** — `src/<dir>/__tests__/<file>.test.ts`; vitest bounded so full-batch runs don't OOM the host.

## C. Caching / context

19. **Six cross-provider axioms** — static-first, byte-stability, volatile-to-tail, breakpoint-surface-limited, hit-rate-observability, write economics. See `context-caching-doctrine.md`.
20. **Byte-plane over breakpoint-plane** — the engine can only stabilize bytes; the harness CLI places breakpoints.
21. **Honest boundaries** — claims scoped to TTL-window consecutive rounds, measured not assumed; unobservable harnesses unclaimed.
22. **Capability as data** — registry cache profiles make new harnesses a data row, zero contract changes.

## D. Prompts & templates

23. **Template systematization, five layers** — JSON schema-verbatim · one skeleton · naming · description · structural skeleton + clause library + token registry. See `template-doctrine.md`.
24. **Naming doctrine** — scoped semantics, full words, one word one meaning (the retired `H1_BLOCK`-rename lesson). See `naming-conventions.md`.
25. **Discipline dual-track** — mechanically-checkable discipline becomes an assertion; only genuinely uncheckable rules live as single-point annotations (prose annotates, never enforces).

## E. Anti-patterns

26. Undefined `.mjs`/`.ts` plane boundaries are debt — declare them.
27. **Spec numbers must be verified** — count corrections in one brainstorm: 15→14 (`.agents/` files), ~17→19 (session-call nodes), 17→19 (template tokens; the registry holds 19 today = 17 round-context + 2 return). `git ls-files` / `grep` before writing numbers into a spec.
28. Undocumented test prerequisites replicate as one-root-cause batches (an early phase's 14 failed tests shared one root cause: the undocumented clean-tree prerequisite).
29. **pre-commit full-validate vs dirty tree is a structural contradiction** — align the gate to its boundary (tree-independent subset) rather than breaking it.
30. **Variant tokens splitting the static prefix kill the cache** — round labels, timestamps, target paths belong in the variant tail.
31. An overall registration is not what a sub-agent reads — discipline must land in the executing surface (templates/clauses), not only in the charter (EOF ×9, CJK ×3 recurrences).

## F. Architecture discipline

32. **Layered dependency boundary** — `infra → rules → artifacts → dispatch → cli`; imports flow up the chain, a lower layer never imports a higher one (dispatch reads `rules/convergence.ts` — its owner — never the `cli/shared.ts` re-export; a cli-local fact like `DRY_RUN()` is injected at the CLI wrapper boundary, not read from the dispatch layer). A cross-layer link that would close a cycle is broken toward the layer that owns the semantics (schema⇄finalize, failure⇄progress — one-way edges remain). The boundary is enforced as **cycle-freedom with a semantic-ownership carve-out**: a lower layer may import one layer up only where the mechanism's semantic home sits in that upper layer — the blessed `rules → artifacts` one-way edge (`failure.ts` counters reading `progress.ts` state) is exactly such a carve-out, since it closes no cycle; beyond that the strict rule (a lower layer never imports a higher one) holds.
33. **Mechanisms anchor the template method — zero island dispatch** — gate / liveness / carrier / residue all hang on `DispatchLifecycle` overridden hooks (`commitPreCheck` entry gate → resolveContext → dispatch → schemaValidate → normalizeResult → `commitPostCheck` exit gate; phases recorded in the timeline). A flat hand-written dispatch body, or one that re-implements exit/round/schema logic outside the lifecycle, is the third-island failure — the branch family escaped the abstraction for two generations, silently missing the dispatch-liveness monitor, the status/failure-carrier orthogonalization, and every later mechanism those shipped. New dispatch channels extend the lifecycle and inherit the default gates rather than re-deriving them.
34. **Error consolidation in one place — `infra/exit.ts`** — recoverable orchestration errors throw the `CddExitError` family (`exitCode` + `kind`; the bin maps kind → code: 0 = OK, 1 = BLOCKED, 2 = usage/CLI-missing, 3 = review convergence); library invariants assert through the `invariant(cond, msg)` factory (plain `Error`, narrowing, no process exit). Zero bare `throw new Error` in production code; the exit table is a stable contract the black-box tests pin.

35. **Semantic self-sufficiency — zero stage anchors in injection surfaces** — the agent-visible surfaces (rendered prompt, `template-contract.json` shell prose, `schema/*.json` `description` fields, task brief) must carry the mechanism's meaning in the name itself (`changes[]` = "changed-file attribution ledger", the recovery carrier = "residue recovery carrier", scope adjudication = "changed-surface reasonableness"/"scope-composition axis"). Plan/phase stage anchors (task numbers, program-phase refs) are orchestrator-internal references — the model reading the prompt has no table of what a task-numbered clause means, so it is noise and drift risk, never semantics. In `src/` code comments the same rule holds with a softer carve-out: the comment's **meaning-bearing prose comes first** and a stage anchor may appear only as a trailing provenance suffix (`T8: dead fields dropped — progress.json top level is task/interfaces/…`); a comment whose only content is the anchor (`// T5 fixed`) is prohibited. Enforcement: the engine residue guard pins the injection surfaces at zero `T\d+|P\d+` tokens (stale-lexicon scope), and the T-style "fidelity to the task document" expectation means a prompt/schema edit tagged with a stage anchor must still resolve to a semantic name in the visible text.

36. **Unified abstraction before patching** — when a defect or new mechanism appears, first ask "what is the single concept behind these two implementations?"; collapse duplicates into one mechanism and one owner before writing the next branch. The status/failure-carrier orthogonalization, the third-island dispatch absorption, the residue-settlement/recovery-carrier step, and the dispatch-termination contract are all instances — every one replaced a "fix forward in one face, leave the other two broken" patch.
37. **Never edit the working tree while a dispatch is in flight** — the engine treats the live git tree, not a handoff, as ground truth at the dispatch boundary; an orchestrator-side doc edit during a `cdd implement|review|fix` round is indistinguishable from an agent that forgot to commit, and the exit gate rewrites the round BLOCKED (`uncommitted changes at return`). Finish and commit any spec/plan/overall backfill before dispatching, or hold it until the round returns; a round landing BLOCKED with that dirty-tree blocker is orchestrator interference, not an agent defect — commit and re-dispatch the same round.
38. **"Uncommitted changes at return" does not always mean the gate fired** — for a review/fix round whose blocker reads that phrase, first cross-check the three signals: working tree clean? handoff findings intact? engine-self-written counter unchanged? If the tree is clean and the findings survived, the BLOCKED status came from the agent's own `unverifiable`/`plan_conflicts` declaration through the status rollup — a content verdict routed to the orchestrator for arbitration, not a commit-contract failure. (The gate's rewrite wipes findings/artifacts; an intact handoff is the tell.)
39. **Engine-materialized implement handoffs are resilient to return-format drift** — an implement round whose four-line return block mis-format (a literal `<missing>` status) is rewritten BLOCKED by the engine even when the deliverable committed perfectly; re-dispatch with the same brief, verify the committed deliverable on the clean tree, and re-return a concrete `status: APPROVED`. On that re-dispatch the brief's `TASK_BASE` equals `HEAD` — `base==head` is legal, do not create a duplicate commit.
40. **Acceptance "zero legacy residue" must enumerate surfaces, not just files** — a sweep that greps the data plane but misses the prompt prose or the src identifiers claims "zero" falsely; name the planes (tokens · content prose · identifiers) before checking, and add a mechanical guard that pins each plane at zero so the claim outlives the review.
41. **Shared template hooks still need explicit context wiring** — a task-family subclass that overrides a base template step (`settleResidue` / `writeBoundary`) must thread the resolved context into the lifecycle ctx: derived values that live only in the internal ctx never reach the public ctx unless the hook explicitly assigns them (a `handoffPath` left `""` sends the inherited exit-gate checks and the changed-surface reconcile reading an empty path — silently no-op, only surfaced later as a missing-notes / untested-path bug).
42. **The resume stash contract is a full canonical token, not a prefix** — the salvage/resume pairing matches the exact standardized message (`cdd-<op>-<type>-task-<N>-r<round>-<cause>`; for the task family that is `…-task-task-<N>-…` — two `task` segments), and re-creating a stash entry with `git stash store -m` is unreliable (a silent no-op that leaves the entry's displayed message unchanged). To re-message a stash, `git stash push` a fresh entry under the canonical message (then drop the old), and always anchor stash operations by message, never by the shifting `stash@{N}` index.
43. **Host-harness black-box tests must mock the harness for CI** — an engine black-box test that passes a real host name fails on a CI runner that lacks the binary: the pre-flight harness gate exits 2 (CLI missing) before the tested gate runs (a "expected 1, got 2" that is environmental, not a product defect). Use the fake-CLI + ghost-registry pattern so the tested gate — not the host check — is what the assertion covers; dry-run variants already bypass the gate.
44. **Skills are consumer-operating surfaces — zero design-history / mechanism narration** — a skill's SKILL.md specifies the executable flow (digraph · nodes · invariants · failure modes) and nothing else. Design history (when/why a step moved), mechanism explanation (gate rationale, timing derivations), and internal-program references (spec titles/versions like "consumer-parity P2 v1.12", repo-internal ledger jargon) are forbidden: a consumer who never saw the program cannot resolve them, and they drift as the program evolves. Deleting a flow step means editing the digraph — not annotating the removal. (2026-09-21 dogfood: a backfill-timing note quoting an internal spec entered the finishing skill and was removed the same day; canonicalized at docs/maintainers/skill-authoring.md §10.)

---

**Use**: bake these into scaffolds (templates), consult before touching the program's mechanisms, and treat item 27 as a standing rule for every document this program produces.
