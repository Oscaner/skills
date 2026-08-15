// gate/tests/configs-parse.test.mjs — P4b T7: gate/configs/** 模板 parse 校验。
// JSON 模板 JSON.parse；TOML 模板结构冒烟（[[hooks]] / type="pre_tool" / command=）；
// 原生模板（trae/vibe/kiro/grok）必须带 {{GATE_ADAPTER}} 占位符 —— 安装时由
// install-gates.mjs 替换为包内 adapter 绝对路径（缺占位符 = 安装写出的 config 指向空串）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

test("原生模板（trae/vibe/kiro/grok）带 {{GATE_ADAPTER}} 占位符", () => {
  const native = [
    path.join(CONFIGS, "trae", "hooks.json"),
    path.join(CONFIGS, "vibe", "hooks.toml"),
    path.join(CONFIGS, "kiro", "hooks.json"),
    path.join(CONFIGS, "grok", "engineering.json"),
  ];
  for (const p of native) {
    assert.ok(readFileSync(p, "utf8").includes("{{GATE_ADAPTER}}"), `placeholder missing: ${p}`);
  }
});
