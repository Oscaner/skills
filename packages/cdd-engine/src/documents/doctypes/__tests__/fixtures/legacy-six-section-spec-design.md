# Demo Dual Read P1 — Phase Spec

- **Version**: v1.0 · 2026-09-21
- **Status**: Draft
- **Author**: test

## Section 0: Incremental warning

本 spec 承诺恰好一个 phase（demo dual-read）。

## Section 1: Constraints pointer

跨 phase 约定以 parent overall 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **破坏性变更授权**: constitutional rule (pointed at the parent overall, never restated)

## Section 2: Design body

#### 2.1 目标与范围

The legacy six-section shape: no `## Design` marker, no `## Constraints` inheritance point. Its
constraint source stays the `## Section 1: Constraints pointer` prose — the dual-read exemption
keeps this read machine-free (no merge applied).

## Section 3: Deviations

No deviations.

## Section 4: Notes for downstream

后续 phase 注意 demo 双读保持。

## Section 5: Review record

- v1.0 · 2026-09-21 · initial draft
