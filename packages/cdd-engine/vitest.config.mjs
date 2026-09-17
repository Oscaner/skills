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
    // Explicit include for the .mjs suite plus TS test support (vitest transforms TS via esbuild):
    // migrating lib→src tasks will land tests at tests/**/*.test.ts or src/**/*.test.ts.
    include: ['tests/**/*.test.{mjs,ts}', 'src/**/*.test.ts'],
    // The suite spawns many node CLI + git subprocesses under a 20-file forks pool; per-test
    // wall time inflates under load (observed >5s on a busy machine). 20s guards the
    // default 5s budget without masking genuinely stuck tests.
    testTimeout: 20000,
    coverage: { provider: 'v8' },
  },
});
