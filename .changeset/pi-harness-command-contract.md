---
"@oscaner-skills/cdd-engine": major
---

feat: harness identity set pinned to `{claude, cursor, pi}` + single-capsule command contract.

- **Harness ids** — the harness-registry row keys are exactly `claude` / `cursor` / `pi`. The cursor row was renamed from the external binary name to the harness id `cursor`; the binary name survives only as that row's `cli` data value. `pi` joins the ambient-detection set: it reuses the existing `AI_AGENT` host-marker channel (zero new env keys) and spawns as `pi -p --mode text`.
- **Single command capsule (breaking)** — every op (implement / review / fix) now prints one status capsule (`status · blocker · handoff`) plus the engine-derived `next:` suggestion line; the former multi-line return block on stdout is retired (the counters stay on in the handoff / progress.json). BLOCKED reasons remain exclusive to the stderr `CDD_BLOCKED:` channel + the handoff `failure_category`.
- **Contract Lexicon (new data plane)** — `contract-lexicon.json` ships to `dist/resources/`: the single vocabulary source for the harness identity set, the status vocab + dual-axis (judgment/work) mapping, the stdout capsule / route tokens / banned old-shape names, and the G2 residue allowance set.

Consumers scripting the old stdout shape or reading the old `cursor-agent` registry row key must migrate to the status capsule and the `cursor` row key (breaking).