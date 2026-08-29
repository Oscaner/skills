// engine/tests/research.test.mjs — T1: research 模块单测。
// 测试 RESEARCH_METHODOLOGY 常量 + buildResearchPrompt + writeFindings。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { RESEARCH_METHODOLOGY, buildResearchPrompt, writeFindings } from "../lib/research.mjs";

test("RESEARCH_METHODOLOGY: 包含五步框架关键词", () => {
  assert.match(RESEARCH_METHODOLOGY, /Scope/);
  assert.match(RESEARCH_METHODOLOGY, /Investigate/);
  assert.match(RESEARCH_METHODOLOGY, /Synthesize/);
  assert.match(RESEARCH_METHODOLOGY, /Verify/);
  assert.match(RESEARCH_METHODOLOGY, /Write/);
});

test("buildResearchPrompt: 输出包含 methodology + brief 内容", () => {
  const brief = "## Task: Analyze auth module\nFocus on JWT validation";
  const prompt = buildResearchPrompt(brief);
  assert.ok(prompt.includes(RESEARCH_METHODOLOGY), "prompt should include methodology");
  assert.ok(prompt.includes(brief), "prompt should include brief content");
});

test("writeFindings: 创建文件并写入内容", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-research-"));
  const outPath = path.join(dir, "findings.md");
  const content = "# Research Findings\n\nAuth module uses JWT.";
  writeFindings(outPath, content);
  assert.ok(existsSync(outPath), "findings file should exist");
  assert.equal(readFileSync(outPath, "utf8"), content);
});

test("writeFindings: 覆盖已有文件", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-research-ov-"));
  const outPath = path.join(dir, "findings.md");
  writeFindings(outPath, "old content");
  writeFindings(outPath, "new content");
  assert.equal(readFileSync(outPath, "utf8"), "new content");
});
