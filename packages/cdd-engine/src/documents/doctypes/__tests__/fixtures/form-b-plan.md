# Demo dual-read P1 — Implement plan

**Spec:** [legacy-six-section-spec-design.md](legacy-six-section-spec-design.md)

**Goal:** the legacy Form B plan shape — prose-pointer constraint deltas + `- **Do**:` task bodies
(no data-shaped task records), the dual-read exemption's plan face.

**口径**：mouthpiece constraint

**commit 边界机制（本 program 全 phase 生效）**：commit-boundary constraint

**Flow Atomicity**：flow-atomicity constraint

**顺序原则（spec §2.4）**：ordering-principle constraint

---

### Task 1: keep the legacy read

**Do:** keep the legacy prose-pointer read working.

### Task 2: keep the task-heading parse

**Do:** keep `### Task N:` extraction working for legacy plans.
