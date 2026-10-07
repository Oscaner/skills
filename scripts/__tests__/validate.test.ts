// scripts/__tests__/validate.test.ts — the validate checkables: the validate
// subprocess steps test green — the step-runner loop (the single data table) with
// green + failing steps and the subprocess step face (a real child process).

import { describe, expect, it } from "vitest";
import {
  CheckBlock,
  engineSuiteStep,
  precommitSteps,
  SubprocessBlock,
  steps,
  ValidateRunner,
} from "../validate.ts";

describe("ValidateRunner — the single data-table runner", () => {
  it("runs every step to ALL PASS + exit 0 (green face)", async () => {
    let ran = 0;
    const runner = new ValidateRunner();
    const code = await runner.run([
      new CheckBlock({ name: "a", run: () => void ran++ }),
      new CheckBlock({ name: "b", run: () => void ran++ }),
    ]);
    expect(code).toBe(0);
    expect(ran).toBe(2);
  });

  it("stops at the first failing step with exit 1 (the FAIL face)", async () => {
    let ran = 0;
    const runner = new ValidateRunner();
    const code = await runner.run([
      new CheckBlock({ name: "ok", run: () => void ran++ }),
      new CheckBlock({
        name: "boom",
        run: () => {
          throw new Error("boom");
        },
      }),
      new CheckBlock({ name: "never", run: () => void ran++ }),
    ]);
    expect(code).toBe(1);
    expect(ran).toBe(1);
  });

  it("the subprocess step face — a real child command runs at the repo root", () => {
    const block = new SubprocessBlock({
      name: "trivial",
      cmd: "node",
      args: ["-e", "process.exit(0)"],
    });
    expect(() => block.run()).not.toThrow();
  });

  it("the composed step set is the data table — the nine steps in order", () => {
    expect(steps.map((s) => s.name)).toEqual([
      "emit freshness (scripts emit, byte-checked)",
      "kairos skill anatomy (the typed skill-anatomy contract)",
      "word-face audit (the guard-ban vocabulary from the word-table export)",
      "engine channel audit (CLI × runtime · host markers · dispatch/refs)",
      "cdd-engine engine test suite (vitest, src-next)",
      "scripts unit tests (root vitest run)",
      "kairos node:test behavior tree",
      "type-check (tsc --noEmit × 3 projects)",
      "package version sync",
    ]);
  });

  it("the pre-commit subset is the composed set minus the engine suite", () => {
    expect(precommitSteps).not.toContain(engineSuiteStep);
    expect(precommitSteps.length).toBe(steps.length - 1);
    for (const s of steps) {
      if (s !== engineSuiteStep) expect(precommitSteps).toContain(s);
    }
  });
});
