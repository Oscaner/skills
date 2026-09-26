// packages/cdd-engine/src/infra/__tests__/infra.exit.test.ts
// Mirrors the .mjs exit.test.mjs contract exactly: ExitRequested sentinel is THROWN (not
// process.exit) so run-boundary finally blocks (teardown/reap) still unwind; bin boundary maps
// code → process.exit. Codes: 0=OK; 1=BLOCKED; 2=CLI missing.
import { expect, it } from "vitest";

import { ExitRequested, exitBlocked, exitCliMissing, exitOk, exitOkWith } from "../exit.ts";

// Capture the ExitRequested code + stderr writes (same helper shape as the .mjs suite).
function captureExit(
  fn: (...args: never[]) => void,
  ...args: never[]
): { code: number | null; stderr: string } {
  const origWrite = process.stderr.write.bind(process.stderr);
  let code: number | null = null;
  let stderr = "";
  // stderr.write receives a string | Uint8Array; keep the string contract for assertions.
  process.stderr.write = ((s: unknown) => {
    stderr += String(s);
    return true;
  }) as typeof process.stderr.write;
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

// Capture the ExitRequested code + stdout writes — the exitOkWith success+result-face single call
// (design §2.9 D2): writes `resultLine + "\n"` to stdout, then exits 0 via the ExitRequested unwind.
function captureExitStdout(fn: () => void): { code: number | null; stdout: string } {
  const origWrite = process.stdout.write.bind(process.stdout);
  let code: number | null = null;
  let stdout = "";
  process.stdout.write = ((s: unknown) => {
    stdout += String(s);
    return true;
  }) as typeof process.stdout.write;
  try {
    try {
      fn();
    } catch (e) {
      if (e instanceof ExitRequested) code = e.code;
      else throw e;
    }
  } finally {
    process.stdout.write = origWrite;
  }
  return { code, stdout };
}

it("exitOkWith: writes the result line + exit 0 (success + stdout result face in one call)", () => {
  const line =
    "status: APPROVED · blocker: 0 · handoff: /repo/.osuperpowers/cdd/foo/spec-review-1.json";
  const { code, stdout } = captureExitStdout(() => exitOkWith(line));
  expect(code).toBe(0);
  expect(stdout).toBe(`${line}\n`);
});
