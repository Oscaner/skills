// packages/cdd-engine/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    pool: "forks", // node:test compatibility mode (avoids worker_threads interference with execa mocks)
    // The CLI black-box cases spawn `node packages/cdd-engine/src/bin.ts` straight
    // (Node ≥22.18 native type stripping) — no dist materialization exists and none is
    // needed. The suite runs on a bare checkout: the binary entry is the source file itself.
    // Memory-bounded concurrency (2026-09-17): the previous default spawned one
    // fork per CPU (10) with no per-file cap; each fork loads the full engine
    // module graph and spawns node CLI + git subprocesses, so a full `pnpm test`
    // could OOM the host (observed on 2026-09-17 while running validate during a
    // P5 task dispatch). Bound to a single worker running one file at a time;
    // subprocess-heavy tests are further capped in-file. Folded into the P6 plan as
    // the engine-side test-run memory guard (overall v1.28).
    maxWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 2,
    testTimeout: 20000,
    coverage: { provider: "v8" },
    // One tree, one collection root: the engine's own source is `src/`, and every test is
    // colocated with the slice it defends (`src/**/__tests__/`).
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
