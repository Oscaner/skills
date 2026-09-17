// packages/cdd-engine/vitest.config.mjs
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    pool: 'forks',            // node:test 兼容模式（避免 worker_threads 干扰 execa mock）
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
