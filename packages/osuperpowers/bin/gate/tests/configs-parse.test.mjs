// gate/tests/configs-parse.test.mjs — P4b T7: gate/configs/** 模板 parse 校验。
// JSON 模板 JSON.parse；TOML 模板结构冒烟（[[hooks]] / type="pre_tool" / command=）；
// 原生模板集合从 configs/ 派生（native-harnesses.mjs —— 含 {{GATE_ADAPTER}} 占位符的目录），
// 安装时由 install-harness.mjs 替换为包内 adapter 绝对路径（缺占位符 = 安装写出的 config 指向空串）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveNativeHarnesses, GATE_ADAPTER_PLACEHOLDER } from "../configs/native-harnesses.mjs";

const CONFIGS = fileURLToPath(new URL("../configs", import.meta.url));

test("JSON config 模板 parse", () => {
  const jsonFiles = [
    ["trae", "hooks.json"],
    ["kiro", "hooks.json"],
    ["grok", "engineering.json"],
    ["opencode.json"],
  ];
  for (const rel of jsonFiles) {
    const p = path.join(CONFIGS, ...rel);
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    assert.ok(parsed && typeof parsed === "object", `parse ok: ${p}`);
  }
});

test("pi 原生模板：configs/pi/pi.ts 含 {{GATE_ADAPTER}} 占位符 re-export shim", () => {
  const p = path.join(CONFIGS, "pi", "pi.ts");
  const text = readFileSync(p, "utf8");
  assert.match(text, /export\s*\{[^}]*default[^}]*\}\s*from/);
  assert.ok(text.includes(GATE_ADAPTER_PLACEHOLDER), "模板应含 {{GATE_ADAPTER}} 占位符");
});

test("TOML 模板含 pre_tool 结构", () => {
  const text = readFileSync(path.join(CONFIGS, "vibe", "hooks.toml"), "utf8");
  assert.match(text, /\[\[hooks\]\]/);
  assert.match(text, /type\s*=\s*"pre_tool"/);
  assert.match(text, /command\s*=\s*"/);
});

test("kiro config 用文档化 hooks[] 数组形（trigger PascalCase + command，无 type:action）", () => {
  const parsed = JSON.parse(readFileSync(path.join(CONFIGS, "kiro", "hooks.json"), "utf8"));
  assert.ok(Array.isArray(parsed.hooks), "hooks 应为数组");
  for (const entry of parsed.hooks) {
    assert.equal(entry.type, undefined, "去掉非文档 type:action");
    assert.ok(typeof entry.trigger === "string" && /^[A-Z]/.test(entry.trigger), "trigger 事件名 PascalCase");
    assert.ok(typeof entry.command === "string" && entry.command.includes(GATE_ADAPTER_PLACEHOLDER), "command 含占位符");
  }
});

test("原生模板集合派生：含 {{GATE_ADAPTER}} 占位符的目录 = 原生 harness", () => {
  const derived = deriveNativeHarnesses(CONFIGS);
  // 派生与目录扫描一致（非 tautological：校验占位符谓词在真实文件上成立）。
  for (const name of derived) {
    const dir = path.join(CONFIGS, name);
    const hasPlaceholder = readdirSync(dir).some((f) =>
      readFileSync(path.join(dir, f), "utf8").includes(GATE_ADAPTER_PLACEHOLDER));
    assert.ok(hasPlaceholder, `derived native ${name} 应含占位符`);
  }
  // 回归护栏：已知原生 harness 必须在派生集合内（新增原生只需加目录，不改此断言）。
  for (const known of ["trae", "vibe", "kiro", "grok", "pi"]) {
    assert.ok(derived.includes(known), `known native ${known} 应被派生`);
  }
  // 无 config 目录的包通道 harness（opencode 走 opencode.json 插件行）不得派生为原生。
  assert.ok(!derived.includes("opencode"), "opencode 无 configs/ 模板 → 不派生为原生");
});
