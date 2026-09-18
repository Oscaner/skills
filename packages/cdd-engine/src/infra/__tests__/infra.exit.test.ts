// packages/cdd-engine/src/infra/__tests__/infra.exit.test.ts
// Mirrors the .mjs exit.test.mjs contract exactly: ExitRequested sentinel is THROWN (not
// process.exit) so run-boundary finally blocks (teardown/reap) still unwind; bin boundary maps
// code → process.exit. Codes: 0=OK; 1=BLOCKED; 2=CLI missing.
import { it, expect } from "vitest";

import { exitOk, exitBlocked, exitCliMissing, ExitRequested } from "../exit.ts";

// Capture the ExitRequested code + stderr writes (same helper shape as the .mjs suite).
function captureExit(fn: (...args: never[]) => void, ...args: never[]): { code: number | null; stderr: string } {
  const origWrite = process.stderr.write.bind(process.stderr);
  let code: number | null = null;
  let stderr = "";
  // stderr.write receives a string | Uint8Array; keep the string contract for assertions.
  process.stderr.write = ((s: unknown) => { stderr += String(s); return true; }) as typeof process.stderr.write;
  try {
    try {
      fn(...args);
    } catch (e) {
      if (e instanceof ExitRequested) code = e.code;
      else throw e;
    }
  } finally {
    process.stderr.write = origWrite;
  }
  return { code, stderr };
}

it("exitOk: exit 0, no stderr", () => {
  const { code, stderr } = captureExit(exitOk as () => void);
  expect(code).toBe(0);
  expect(stderr).toBe("");
});

it("exitBlocked: with message → CDD_BLOCKED prefix + exit 1", () => {
  const { code, stderr } = captureExit(exitBlocked as () => void, "boom");
  expect(code).toBe(1);
  expect(stderr).toBe("CDD_BLOCKED: boom\n");
});

it("exitBlocked: empty message → no stderr, exit 1 only", () => {
  const { code, stderr } = captureExit(exitBlocked as () => void);
  expect(code).toBe(1);
  expect(stderr).toBe("");
});

it("exitCliMissing: with message → CDD_CLI_MISSING prefix + exit 2", () => {
  const { code, stderr } = captureExit(exitCliMissing as () => void, "pi not found in PATH");
  expect(code).toBe(2);
  expect(stderr).toBe("CDD_CLI_MISSING: pi not found in PATH\n");
});

it("exitCliMissing: empty message → no stderr, exit 2 only", () => {
  const { code, stderr } = captureExit(exitCliMissing as () => void);
  expect(code).toBe(2);
  expect(stderr).toBe("");
});
