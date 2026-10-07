// packages/cdd-engine/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    pool: "forks", // node:test compatibility mode (avoids worker_threads interference with execa mocks)
    // 5b CLI black-box self-supply face (T7): the black-box tests spawn
    // `node packages/cdd-engine/src/bin.ts` straight (Node ≥22.18 native type stripping) — no dist
    // materialization exists and none is needed. The suite runs on a bare checkout: the binary
    // entry is the source file itself.
    // Memory-bounded concurrency (2026-09-17): the previous default spawned one
    // fork per CPU (10) with no per-file cap; each fork loads the full engine
    // module graph and spawns node CLI + git
    // subprocesses, so a full `pnpm test` could OOM the host (observed on
    // 2026-09-17 while running validate during a P5 task dispatch). Bound to a
    // single worker running one file at a time; subprocess-heavy tests are
    // further capped in-file. Folded into the P6 plan as the engine-side
    // test-run memory guard (overall v1.28).
    maxWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 2,
    // G4③ (P6 Task 17) closure: the real (non-dry-run) dispatch cases — lifecycle.wiring.test.ts's CLI
    // signal cases — run on a standalone mkdtemp clean temp repo (cwd = the temp repo; the entry gate
    // resolves the temp repo's worktree), so the suite is insensitive to the current worktree state (the
    // worktree is necessarily dirty at pre-commit time; the pre-commit hook now only runs the
    // tree-independent subset `pnpm run precommit` — see scripts/validate/pre-commit.ts and .husky/pre-commit).
    // The suite spawns many node CLI + git subprocesses under a 20-file forks pool; per-test
    // wall time inflates under load (observed >5s on a busy machine). 20s guards the
    // default 5s budget without masking genuinely stuck tests.
    testTimeout: 20000,
    coverage: { provider: "v8" },
    // P3.2 dual-face build (T1): the new tree (src-next/) runs as an independent vitest
    // project alongside the old tree (src/). Vitest's `projects` mode makes the root test
    // config a shared base merged into every listed project, so each face's include set
    // lives on its own project (a root-level include would bleed into every project). Both
    // projects inherit the pool/parallelism/timeout defaults above and must stay green on
    // every commit until the cutover (the plan's dual-face build constraint).
    projects: [
      {
        test: {
          name: "src",
          // Explicit include for the migrated colocated suite (P6 Task 3): every test node now
          // lives at src/**/__tests__/**/*.test.ts (tests/ retired; .mjs plane is zero).
          // All tests are TypeScript (vitest transforms TS via esbuild); any .mjs regressing
          // back into the engine is caught by the residue mjs-terminal-state guard (block 5c).
          include: ["src/**/__tests__/**/*.test.ts"],
          // 5b CLI black-box cases depend on the entry-gate sense of a clean tree (E2②/G4①/P6 T10 —
          // documented prerequisite): some dry-run cases in cdd.test.ts / docs-task.test.ts / cli-shape.test.ts
          // run black-box with REPO_ROOT as cwd — the entry gate passes in either of two states: a genuinely
          // clean tree, or the CDD_WARN downgrade of dirty + dry-run. Do not run this suite's black-box cases
          // with a dirty dev tree (uncommitted changes) unless you expect them to assert the CDD_WARN downgrade
          // path; semantic changes to the entry gate / dry-run protocol must sync-review the case expectations
          // of these three files.
        },
      },
      {
        test: {
          name: "src-next",
          include: ["src-next/**/__tests__/**/*.test.ts"],
        },
      },
    ],
  },
});
