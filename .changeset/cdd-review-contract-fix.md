---
"@oscaner-skills/cdd-engine": patch
---

fix: cdd review output-contract unification — status-anchored routing, single-meaning `blocker`, and the `next:` suggestion line.

- **T1** — task/branch return block drops the `blocker:` prose column; BLOCKED reasons route exclusively to stderr `CDD_BLOCKED:` + `failure_category` (the return block now carries the 4-line `status`/`commits`/`artifacts`/`counters` contract).
- **T2** — status↔severity equivalence pinned in engine tests (`CHANGES_REQUESTED` ⟺ ≥1 `severity=blocker`), guarding the S1/S2/S3 convergence Judgements from pass-through dilution.
- **T4/T5** — claim-scan discrimination is structural (head-clause `Pending`/`[Pending]` + non-parenthetical), ranges declare multi-target only at the declaration slot with an expanded-phase diagnostic payload, letter-suffixed phase-ids report illegal (bounded dotted forms only), and doc-contract failures carry the diagnostic trio (clause excerpt + parsed phase + mechanism, category-scoped suggestion, executable action).
- **T6** — branch-review real mode emits the return block through the single return-block point; the doc-audit gate runs on the branch path (missing-root real mode → `CDD_BLOCKED` exit 1, dry-run → WARN); `--root` whitelisted on implement/review/fix.
- **T7** — branch-fix receipts are engine-materialized facts (commits/phase/status authoritative; agent handoff is input); a committed fix with no code-plane error self-heals to APPROVED; the injected schema writes only the writable subset (no `$schema`, no dispatch-stamped fields).
- **T8** — new `next:` suggestion line on all three output faces (docs result face / task / branch return blocks) derived by the pure `next-step.ts`; on fix, the next hop is judged by the input findings' `convergence.blockerCount` (blocker>0 → re-review on the moved ref, warn/nit-only → `next: none` closure, soft-cap exhausted → `next: BLOCKED: review-cycle-cap`). Suggestion semantics: a default next hop the mid-flight world state may override — not a hard action.