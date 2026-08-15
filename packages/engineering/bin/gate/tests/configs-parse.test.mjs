// gate/tests/configs-parse.test.mjs — P4b T7: gate/configs/** 模板 parse 校验。
// JSON 模板 JSON.parse；TOML 模板结构冒烟（[[hooks]] / type="pre_tool" / command=）；
// 原生模板集合从 configs/ 派生（native-harnesses.mjs —— 含 {{GATE_ADAPTER}} 占位符的目录），
// 安装时由 install-gates.mjs 替换为包内 adapter 绝对路径（缺占位符 = 安装写出的 config 指向空串）。
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
    ["pi", "package.json"],
  ];
  for (const rel of jsonFiles) {
    const p = path.join(CONFIGS, ...rel);
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    assert.ok(parsed && typeof parsed === "object", `parse ok: ${p}`);
  }
});

test("TOML 模板含 pre_tool 结构", () => {
  const text = readFileSync(path.join(CONFIGS, "vibe", "hooks.toml"), "utf8");
  assert.match(text, /\[\[hooks\]\]/);
  assert.match(text, /type\s*=\s*"pre_tool"/);
  assert.match(text, /command\s*=\s*"/);
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
  for (const known of ["trae", "vibe", "kiro", "grok"]) {
    assert.ok(derived.includes(known), `known native ${known} 应被派生`);
  }
  // 包通道目录（pi 无占位符）不得派生为原生。
  assert.ok(!derived.includes("pi"), "pi 无占位符模板 → 不派生为原生");
});
