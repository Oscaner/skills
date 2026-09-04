// bin/tests/exit.test.mjs — T1: exit helpers 模块单测（Node port of cdd_exit_*）。
// 退出码契约：0=OK；1=BLOCKED；2=CLI missing。消息前缀 CDD_BLOCKED: / CDD_CLI_MISSING:。
// process.exit 会终结进程 —— 测试内 stub 并捕获退出码，stderr 捕获写入文本。
import { it, expect } from 'vitest';

import { exitOk, exitBlocked, exitCliMissing } from "../utils/exit.mjs";

// 捕获 fn(...args) 触发的 process.exit(code) + stderr 写入；返回 { code, stderr }。
function captureExit(fn, ...args) {
  const origExit = process.exit;
  const origWrite = process.stderr.write.bind(process.stderr);
  let code = null;
  let stderr = "";
  process.exit = (c) => {
    code = c;
    throw new Error(`process.exit(${c})`);
  };
  process.stderr.write = (s) => {
    stderr += s;
    return true;
  };
  try {
    expect(() => fn(...args)).toThrow(/process\.exit/);
  } finally {
    process.exit = origExit;
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