# Program Experience — P1 → P6

Maintainer-only record of the hard-won lessons from the osuperpowers-overhaul program (P1 runtime layout → P6 convergence). Used as the baking input for skill document templates and as context for any future program touching this codebase. Condensed reference of the spec §2.6 list; each item is a claim about how this program actually failed or succeeded.

## A. Organization & process

1. **Delete-anything-that-isn't-consumed** — dead workspaces/files/surfaces are removed, not frozen (P1 `.superpowers/cdd/*` purged).
2. **Deletion must sync its only caller** — removing a command/artifact without removing its caller is an orphan-debt (P3 `cli-research` deleted with `cdd research`).
3. **Anti-residue guards on every deletion** — a stale-lexicon guard prevents the vocabulary from creeping back (P1/P2/P3, P6 vendors/`.agents`).
4. **Backfill-as-version** — mid-phase requirement changes are recorded in the overall first (version bump + change history + synced phase tables) before implementation continues (Boundary rules).
5. **Single-root authority** — every derived surface converges on one root: workspace root, docs root, schema, finding-meta, labels SOT, context contract.
6. **Mechanical guard beats verbal discipline** — double gates, validators, residue, byte-invariants: discipline that cannot be tested does not execute.
7. **Shrink capability claims** — unproven capabilities are withdrawn, not parked (decision C: 8 harnesses → 2 proven).
8. **The program turns the lens on itself** — brainstorming/grilling flows must honestly describe single-session reality (session-call semantics), or they erode.

## B. Engineering & architecture

9. Destructive change, high-dimension abstraction, freely changeable code structure/directory layout (P6 principle).
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
24. **Naming doctrine** — scoped semantics, full words, one word one meaning (`H1` lesson). See `naming-conventions.md`.
25. **Discipline dual-track** — mechanically-checkable discipline becomes an assertion; only genuinely uncheckable rules live as single-point annotations (prose annotates, never enforces).

## E. Anti-patterns

26. Undefined `.mjs`/`.ts` plane boundaries are debt — declare them.
27. **Spec numbers must be verified** — three count corrections in one brainstorm: 15→14 (`.agents/` files), ~17→19 (session-call nodes), 17→18 (template tokens). `git ls-files` / `grep` before writing numbers into a spec.
28. Undocumented test prerequisites replicate as one-root-cause batches (P5's 14 tests, one cause: the clean-tree prerequisite).
29. **pre-commit full-validate vs dirty tree is a structural contradiction** — align the gate to its boundary (tree-independent subset) rather than breaking it.
30. **Variant tokens splitting the static prefix kill the cache** — round labels, timestamps, target paths belong in the variant tail.
31. An overall registration is not what a sub-agent reads — discipline must land in the executing surface (templates/clauses), not only in the charter (EOF ×9, CJK ×3 recurrences).

---

**Use**: bake these into scaffolds (templates), consult before touching the program's mechanisms, and treat item 27 as a standing rule for every document this program produces.