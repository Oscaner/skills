# Phase Spec Template

**Increment only** — what a single phase spec contains. Program-level charter lives in [overall-spec-template.md](./overall-spec-template.md).

> **GATE:** This phase spec is produced by a **full brainstorm -> plan -> dev cycle**. Jumping straight to implementation after overall approval alone is a violation of the overall flow.

---

## Header

```
- **Version**, **Status** (Draft | Approved | Plan pending | Shipped)
- **Author**, **Parent program** (link + version), **Depends on** (upstream + tags)
```

---

## Section 0: Incremental warning

> Phase N increment only. Cross-phase conventions in [overall](link); overall wins on conflict.

---

## Section 1: Constraints pointer

> Does not repeat overall conventions. Overall wins on conflict.

---

## Section 2: Design body

This phase's increment: approaches, architecture, components, data flow, errors, testing, **Acceptance criteria**.

### Acceptance criteria

Verifiable completion conditions (each independently testable). Example shape:
- `artifact X exists at path Y with property Z`
- `command C exits 0 with output matching regex R`
- `no stale references to removed path P remain`

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| ... | ... | Yes — vX.Y · date |

Required when phase diverges on cross-phase matters. **Overall updated? must be Yes before review.**

---

## Section 4: Notes for downstream

Later-phase scope shifts. Decomposition changes -> update overall + re-run approval (GATE).

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and writing-plans.
