// packages/kairos/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    pool: "forks", // node:test compatibility mode (avoids worker_threads interference with execa/git child processes — the kairos suite is subprocess-heavy)
    // Memory-bounded concurrency (mirrors the engine config, P5): the kairos suite
    // spawns git + node CLI subprocesses per test file, so a single worker running
    // one file at a time keeps validate from OOMing the host next to the engine
    // suite. Subprocess-heavy tests are further capped in-file.
    maxWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 2,
    testTimeout: 20000,
    include: ["tests/**/*.test.ts"],
  },
});
