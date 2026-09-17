import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Memory-bounded concurrency (2026-09-17): scripts/* suites spawn overlay
    // processes (emit / gh / test runners); keep workers low so validate never
    // OOMs alongside the engine suite.
    include: ["scripts/**/*.test.mjs"],
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 2,
  },
});
