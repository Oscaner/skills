// engine/tests/exit.test.mjs — T1: exit helpers 模块单测（Node port of cdd_exit_*）。
// 退出码契约：0=OK；1=BLOCKED；2=CLI missing。消息前缀 CDD_BLOCKED: / CDD_CLI_MISSING:。
// process.exit 会终结进程 —— 测试内 stub 并捕获退出码，stderr 捕获写入文本。
import { test } from "node:test";
import assert from "node:assert/strict";

import { exitOk, exitBlocked, exitCliMissing } from "../lib/exit.mjs";

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
    assert.throws(() => fn(...args), /process\.exit/);
  } finally {
    process.exit = origExit;
    process.stderr.write = origWrite;
  }
  return { code, stderr };
}

test("exitOk: exit 0，无 stderr", () => {
  const { code, stderr } = captureExit(exitOk);
  assert.equal(code, 0);
  assert.equal(stderr, "");
});

test("exitBlocked: 带消息 → CDD_BLOCKED 前缀 + exit 1", () => {
  const { code, stderr } = captureExit(exitBlocked, "boom");
  assert.equal(code, 1);
  assert.equal(stderr, "CDD_BLOCKED: boom\n");
});

test("exitBlocked: 空消息 → 不写 stderr，仅 exit 1", () => {
  const { code, stderr } = captureExit(exitBlocked);
  assert.equal(code, 1);
  assert.equal(stderr, "");
});

test("exitCliMissing: 带消息 → CDD_CLI_MISSING 前缀 + exit 2", () => {
  const { code, stderr } = captureExit(exitCliMissing, "pi not found in PATH");
  assert.equal(code, 2);
  assert.equal(stderr, "CDD_CLI_MISSING: pi not found in PATH\n");
});

test("exitCliMissing: 空消息 → 不写 stderr，仅 exit 2", () => {
  const { code, stderr } = captureExit(exitCliMissing);
  assert.equal(code, 2);
  assert.equal(stderr, "");
});
