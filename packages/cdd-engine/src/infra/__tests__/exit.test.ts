// packages/cdd-engine/src/infra/__tests__/exit.test.ts
// Exit-code contract: 0=OK; 1=BLOCKED; 2=CLI missing. Message prefixes CDD_BLOCKED: / CDD_CLI_MISSING:.
// After the T3 review-warn fix the exit helpers throw ExitRequested (unwinding finally blocks first,
// the bin boundary exits) — tests capture that sentinel and read the exit code; stderr capture is
// written to text.
// P6 T24 (F error consolidation): the semantic boundary between the CddExitError family, the
// invariant factory, and cliUsageError — the family is the CLI contract (exitCode + kind, bin maps
// by kind), invariant is a library invariant (throws an Error, no process exit), cliUsageError is
// the kind=usage exit-2 face (CLIError name + E_UNKNOWN_OPTION code keep citty-parse-error parity).
import { it, expect } from 'vitest';

import {
  exitOk, exitBlocked, exitCliMissing, ExitRequested,
  CddExitError, invariant, cliUsageError,
} from "../exit.ts";

// Capture the ExitRequested(code) that fn(...args) throws + the stderr it wrote; returns { code, stderr }.
function captureExit(fn, ...args) {
  const origWrite = process.stderr.write.bind(process.stderr);
  let code = null;
  let stderr = "";
  process.stderr.write = (s) => {
    stderr += s;
    return true;
  };
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

it("exitOk: exits 0 with no stderr", () => {
  const { code, stderr } = captureExit(exitOk);
  expect(code).toBe(0);
  expect(stderr).toBe("");
});

it("exitBlocked: with message → CDD_BLOCKED prefix + exit 1", () => {
  const { code, stderr } = captureExit(exitBlocked, "boom");
  expect(code).toBe(1);
  expect(stderr).toBe("CDD_BLOCKED: boom\n");
});

it("exitBlocked: empty message → no stderr, only exit 1", () => {
  const { code, stderr } = captureExit(exitBlocked);
  expect(code).toBe(1);
  expect(stderr).toBe("");
});

it("exitCliMissing: with message → CDD_CLI_MISSING prefix + exit 2", () => {
  const { code, stderr } = captureExit(exitCliMissing, "pi not found in PATH");
  expect(code).toBe(2);
  expect(stderr).toBe("CDD_CLI_MISSING: pi not found in PATH\n");
});

it("exitCliMissing: empty message → no stderr, only exit 2", () => {
  const { code, stderr } = captureExit(exitCliMissing);
  expect(code).toBe(2);
  expect(stderr).toBe("");
});

// ---- P6 T24: CddExitError family + invariant + cliUsageError ----

it("CddExitError: exitCode defaults to 1 / kind defaults to blocked; the kind field is readable", () => {
  const e = new CddExitError("boom", { exitCode: 1, kind: "blocked" });
  expect(e.name).toBe("CddExitError");
  expect(e.exitCode).toBe(1);
  expect(e.kind).toBe("blocked");
});

it("CddExitError: custom exitCode/kind (e.g. the RunBlocked face)", () => {
  const e = new CddExitError("cli-failed", { exitCode: 1, kind: "run-blocked" });
  expect(e.exitCode).toBe(1);
  expect(e.kind).toBe("run-blocked");
});

it("invariant: true condition passes with no side effects; false → throws a plain Error with the exact message (library invariant, not a process exit)", () => {
  expect(() => invariant(true, "nope")).not.toThrow();
  expect(() => invariant(false, "unknown review type: task")).toThrowError("unknown review type: task");
});

it("cliUsageError: exit 2 + kind usage, CLIError name + E_UNKNOWN_OPTION code (citty-parse parity)", () => {
  const err = cliUsageError("unknown option: --no-plan");
  expect(err).toBeInstanceOf(CddExitError);
  expect(err.exitCode).toBe(2);
  expect(err.kind).toBe("usage");
  expect(err.name).toBe("CLIError");
  expect((err as CddExitError & { code: string }).code).toBe("E_UNKNOWN_OPTION");
  // instanceof family check holds — the bin top-level catch branches on kind first
  expect(err).toBeInstanceOf(CddExitError);
});
