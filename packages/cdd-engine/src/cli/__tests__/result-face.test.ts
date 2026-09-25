// packages/cdd-engine/src/cli/__tests__/result-face.test.ts
// Seam: the shared docs-family result-face renderer (design §2.9 — the stdout "status / blocker /
// handoff" line the orchestrator can grep without opening the handoff file). The blocker count reuses
// the canonical Convergence single source (rules/convergence.ts#blockerCount) — findings with severity
// "blocker" — so this test pins the Ø-face reading, not a duplicate count.
import { expect, it } from "vitest";
import { docsResultFace } from "../result-face.ts";

it("docsResultFace: renders status / blocker count / local handoff path", () => {
  const face = docsResultFace(
    {
      exitCode: 0,
      handoff: {
        status: "APPROVED",
        findings: [
          { severity: "warn", summary: "w" },
          { severity: "nit", summary: "n" },
        ],
        artifacts: {},
      },
    },
    "/repo/.osuperpowers/cdd/foo/spec-review-1.json",
  );
  expect(face).toBe(
    "status: APPROVED · blocker: 0 · handoff: /repo/.osuperpowers/cdd/foo/spec-review-1.json",
  );
});

it("docsResultFace: counts blocker-severity findings (canonical blockerCount semantics)", () => {
  const face = docsResultFace(
    {
      exitCode: 0,
      handoff: {
        status: "CHANGES_REQUESTED",
        findings: [
          { severity: "blocker", summary: "b1" },
          { severity: "blocker", summary: "b2" },
          { severity: "warn", summary: "w" },
        ],
        artifacts: {},
      },
    },
    "/repo/.osuperpowers/cdd/foo/spec-review-1.json",
  );
  expect(face).toBe(
    "status: CHANGES_REQUESTED · blocker: 2 · handoff: /repo/.osuperpowers/cdd/foo/spec-review-1.json",
  );
});

it("docsResultFace: null handoff → empty status + blocker 0 (defensive; runDocsTask always sets it)", () => {
  const face = docsResultFace(
    { exitCode: 1, handoff: null },
    "/repo/.osuperpowers/cdd/foo/plan-fix-1.json",
  );
  expect(face).toBe("status:  · blocker: 0 · handoff: /repo/.osuperpowers/cdd/foo/plan-fix-1.json");
});
