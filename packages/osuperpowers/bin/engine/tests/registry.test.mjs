// engine/tests/registry.test.mjs — T1: harness-registry 模块单测（Node port）。
// 从 cdd-common-functions.test.sh（cdd_check_harness / _cdd_registry_field）与
// registry-schema.test.sh 移植行为断言。ship gate 语义：
//   unknown / not-supported → blocked（exitCode 1）；CLI 存在校验失败 → cli-missing（exitCode 2）。
// 真实 claude 二进制不在 PATH 的 CI 上，ship-gate 通过用例用 dryRun 跳过 CLI 校验（确定性）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { loadRegistry, checkHarness, registryField } from "../lib/registry.mjs";

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));

test("loadRegistry: 读取 7 harness", () => {
  const reg = loadRegistry(REG_PATH);
  assert.equal(Object.keys(reg).length, 7);
  for (const name of ["claude", "cursor-agent", "droid", "pi", "codex", "copilot", "gemini"]) {
    assert.ok(reg[name], `missing harness: ${name}`);
  }
});

test("checkHarness: claude 通过 ship gate（dryRun 跳过 PATH 校验）", () => {
  const reg = loadRegistry(REG_PATH);
  const entry = checkHarness(reg, "claude", { dryRun: true });
  assert.equal(entry.cli, "claude");
  assert.equal(entry.ship, "full");
});

test("checkHarness: not-supported harness → blocked（exitCode 1）", () => {
  const reg = loadRegistry(REG_PATH);
  assert.throws(
    () => checkHarness(reg, "codex"),
    (e) => e.kind === "blocked" && e.exitCode === 1 && /harness not supported: codex/.test(e.message),
  );
  assert.throws(
    () => checkHarness(reg, "gemini"),
    (e) => e.kind === "blocked" && e.exitCode === 1,
  );
});

test("checkHarness: unknown harness → blocked", () => {
  const reg = loadRegistry(REG_PATH);
  assert.throws(
    () => checkHarness(reg, "no-such-harness"),
    (e) => e.kind === "blocked" && e.exitCode === 1 && /unknown harness/.test(e.message),
  );
});

test("checkHarness: CLI preflight — full harness 缺二进制 → cli-missing（exitCode 2）", () => {
  const reg = loadRegistry(REG_PATH);
  const ghost = "cdd-nonexistent-cli-xyz";
  const fixture = {
    ...reg,
    ghost: { cli: ghost, invoke: "-p", output: "text", task_review_prefix: "", ship: "full" },
  };
  assert.throws(
    () => checkHarness(fixture, "ghost"),
    (e) => e.kind === "cli-missing" && e.exitCode === 2 && e.message.includes(`${ghost} not found in PATH`),
  );
});

test("checkHarness: dryRun 跳过 CLI 存在校验", () => {
  const reg = loadRegistry(REG_PATH);
  const fixture = {
    ...reg,
    ghost: { cli: "cdd-nonexistent-cli-xyz", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" },
  };
  const entry = checkHarness(fixture, "ghost", { dryRun: true });
  assert.equal(entry.cli, "cdd-nonexistent-cli-xyz");
});

test("registryField: 字段读取 + 缺失回退空串", () => {
  const reg = loadRegistry(REG_PATH);
  assert.equal(registryField(reg, "claude", "cli"), "claude");
  assert.equal(registryField(reg, "claude", "invoke"), "-p --output-format text --dangerously-skip-permissions");
  assert.equal(registryField(reg, "claude", "task_review_prefix"), "Skill(mattpocock-skills:code-review)");
  assert.equal(registryField(reg, "claude", "no-such-field"), "");
  assert.equal(registryField(reg, "no-such-harness", "cli"), "");
  assert.equal(registryField(reg, "codex", "invoke"), ""); // not-supported 不带 invoke（schema）
});
