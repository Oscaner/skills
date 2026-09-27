import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Memory-bounded concurrency (2026-09-17): scripts/* suites spawn overlay
    // processes (emit / gh / test runners); keep workers low so validate never
    // OOMs alongside the engine suite. Colocation-glob (Task 21): scripts tests
    // live at scripts/<dir>/__tests__/<file>.test.ts (engine isomorphism, T3).
    include: ["scripts/**/__tests__/**/*.test.ts"],
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 2,
  },
});
