// engine/tests/research.test.mjs — T1: research 模块单测。
// 测试 RESEARCH_METHODOLOGY 常量 + buildResearchPrompt + writeFindings。
import { it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { RESEARCH_METHODOLOGY, buildResearchPrompt, writeFindings } from "../lib/research.mjs";

it("RESEARCH_METHODOLOGY: 包含五步框架关键词", () => {
  expect(RESEARCH_METHODOLOGY).toMatch(/Scope/);
  expect(RESEARCH_METHODOLOGY).toMatch(/Investigate/);
  expect(RESEARCH_METHODOLOGY).toMatch(/Synthesize/);
  expect(RESEARCH_METHODOLOGY).toMatch(/Verify/);
  expect(RESEARCH_METHODOLOGY).toMatch(/Write/);
});

it("buildResearchPrompt: 输出包含 methodology + brief 内容", () => {
  const brief = "## Task: Analyze auth module\nFocus on JWT validation";
  const prompt = buildResearchPrompt(brief);
  expect(prompt.includes(RESEARCH_METHODOLOGY)).toBe(true);
  expect(prompt.includes(brief)).toBe(true);
});

it("writeFindings: 创建文件并写入内容", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-research-"));
  const outPath = path.join(dir, "findings.md");
  const content = "# Research Findings\n\nAuth module uses JWT.";
  writeFindings(outPath, content);
  expect(existsSync(outPath)).toBe(true);
  expect(readFileSync(outPath, "utf8")).toBe(content);
});

it("writeFindings: 覆盖已有文件", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-research-ov-"));
  const outPath = path.join(dir, "findings.md");
  writeFindings(outPath, "old content");
  writeFindings(outPath, "new content");
  expect(readFileSync(outPath, "utf8")).toBe("new content");
});
