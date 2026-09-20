// packages/cdd-engine/src/infra/__tests__/exit.test.ts
// 退出码契约：0=OK；1=BLOCKED；2=CLI missing。消息前缀 CDD_BLOCKED: / CDD_CLI_MISSING:。
// T3 review warn 修复后 exit helpers throw ExitRequested（先展开 finally，bin 边界才 exit）——
// 单测改为捕获该哨兵读退出码；stderr 捕获写入文本。
// P6 T24（F 错误收编）: CddExitError 家族 + invariant 工厂 + cliUsageError 的语义分界——
// 前者是 CLI 契约（exitCode + kind，bin 按 kind 落码），invariant 是库内不变量（抛裸 Error，
// 不退出），cliUsageError 是 kind=usage 的 exit-2 面（CLIError 名 + E_UNKNOWN_OPTION 码保持
// citty-parse-error parity）。
import { it, expect } from 'vitest';

import {
  exitOk, exitBlocked, exitCliMissing, ExitRequested,
  CddExitError, invariant, cliUsageError,
} from "../exit.ts";

// 捕获 fn(...args) 触发的 ExitRequested(code) + stderr 写入；返回 { code, stderr }。
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

it("exitOk: exit 0，无 stderr", () => {
  const { code, stderr } = captureExit(exitOk);
  expect(code).toBe(0);
  expect(stderr).toBe("");
});

it("exitBlocked: 带消息 → CDD_BLOCKED 前缀 + exit 1", () => {
  const { code, stderr } = captureExit(exitBlocked, "boom");
  expect(code).toBe(1);
  expect(stderr).toBe("CDD_BLOCKED: boom\n");
});

it("exitBlocked: 空消息 → 不写 stderr，仅 exit 1", () => {
  const { code, stderr } = captureExit(exitBlocked);
  expect(code).toBe(1);
  expect(stderr).toBe("");
});

it("exitCliMissing: 带消息 → CDD_CLI_MISSING 前缀 + exit 2", () => {
  const { code, stderr } = captureExit(exitCliMissing, "pi not found in PATH");
  expect(code).toBe(2);
  expect(stderr).toBe("CDD_CLI_MISSING: pi not found in PATH\n");
});

it("exitCliMissing: 空消息 → 不写 stderr，仅 exit 2", () => {
  const { code, stderr } = captureExit(exitCliMissing);
  expect(code).toBe(2);
  expect(stderr).toBe("");
});

// ---- P6 T24: CddExitError 家族 + invariant + cliUsageError ----

it("CddExitError: exitCode 默认 1 / kind 默认 blocked，kind 字段可读", () => {
  const e = new CddExitError("boom", { exitCode: 1, kind: "blocked" });
  expect(e.name).toBe("CddExitError");
  expect(e.exitCode).toBe(1);
  expect(e.kind).toBe("blocked");
});

it("CddExitError: 自定义 exitCode/kind（如 RunBlocked 面）", () => {
  const e = new CddExitError("cli-failed", { exitCode: 1, kind: "run-blocked" });
  expect(e.exitCode).toBe(1);
  expect(e.kind).toBe("run-blocked");
});

it("invariant: 条件为真 → 不带副作用通过；为假 → 抛裸 Error 且消息逐字保留（库内不变量，非进程退出）", () => {
  expect(() => invariant(true, "nope")).not.toThrow();
  expect(() => invariant(false, "unknown review type: task")).toThrowError("unknown review type: task");
});

it("cliUsageError: exit 2 + kind usage，CLIError 名 + E_UNKNOWN_OPTION 码（citty-parse parity）", () => {
  const err = cliUsageError("unknown option: --no-plan");
  expect(err).toBeInstanceOf(CddExitError);
  expect(err.exitCode).toBe(2);
  expect(err.kind).toBe("usage");
  expect(err.name).toBe("CLIError");
  expect((err as CddExitError & { code: string }).code).toBe("E_UNKNOWN_OPTION");
  // instanceof 家族判定仍真 —— bin 顶层 catch 先按 kind 分流
  expect(err).toBeInstanceOf(CddExitError);
});