// packages/cdd-engine/vitest.config.mjs
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    pool: 'forks',            // node:test 兼容模式（避免 worker_threads 干扰 execa mock）
    // Memory-bounded concurrency (2026-09-17): the previous default spawned one
    // fork per CPU (10) with no per-file cap; each fork loads the full engine
    // (jiti stub → simple-git / handlebars / …) and spawns node CLI + git
    // subprocesses, so a full `pnpm test` could OOM the host (observed on
    // 2026-09-17 while running validate during a P5 task dispatch). Bound to a
    // single worker running one file at a time; subprocess-heavy tests are
    // further capped in-file. Folded into the P6 plan as the engine-side
    // test-run memory guard (overall v1.28).
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 2,
    // Explicit include for the migrated colocated suite (P6 Task 3): every test node now
    // lives at src/**/__tests__/**/*.test.ts (tests/ retired; .mjs plane is zero).
    // All tests are TypeScript (vitest transforms TS via esbuild); any .mjs regressing
    // back into the engine is caught by the residue mjs-terminal-state guard (block 5c).
    include: ['src/**/__tests__/**/*.test.ts'],
    // The suite spawns many node CLI + git subprocesses under a 20-file forks pool; per-test
    // wall time inflates under load (observed >5s on a busy machine). 20s guards the
    // default 5s budget without masking genuinely stuck tests.
    testTimeout: 20000,
    coverage: { provider: 'v8' },
  },
});
