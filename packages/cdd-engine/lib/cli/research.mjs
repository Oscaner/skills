// packages/cdd-engine/lib/cli/research.mjs — `cdd research` 独立研究 runner + research 模块。
// spec §2.3 拆分：原 bin/cdd.mjs runResearch（L412-476）与 lib/cli/research-core.mjs 的
// RESEARCH_METHODOLOGY / buildResearchPrompt / writeFindings 并入本文件（research-core 可删，
// 符号全量归位本文件；测试 seam 从本文件导入）。
import { readFileSync, writeFileSync } from "node:fs";

import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../registry.mjs";
import { spawnManaged, markAllDispatchesDone, stopIdleMonitor, teardownAll } from "../lifecycle/proc.mjs";
import { resolveTimeoutMs } from "../lifecycle/cli.mjs";
import { requireHostHarness, DRY_RUN } from "./review.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../exit.mjs";

export const RESEARCH_METHODOLOGY = `## Research Methodology

Follow this 5-step research framework:

### 1. Scope
Define the research question precisely. Identify what needs to be discovered and why.

### 2. Investigate
Gather information from available sources: code, docs, tests, configs, external references.
Follow leads systematically — don't stop at the first answer.

### 3. Synthesize
Organize findings into coherent themes. Identify patterns, relationships, and contradictions.

### 4. Verify
Cross-reference findings against multiple sources. Challenge assumptions.
Identify confidence levels for each conclusion.

### 5. Write
Produce clear, actionable findings with evidence and confidence levels.
Distinguish facts from inferences. Note open questions.`;

// Build a complete research prompt from brief content + methodology.
export function buildResearchPrompt(briefContent) {
  return `${RESEARCH_METHODOLOGY}

---

## Research Brief

${briefContent}`;
}

// Write findings to a Markdown file.
export function writeFindings(outputPath, content) {
  writeFileSync(outputPath, content, "utf8");
}

// Standalone research runner (spawnManaged, not invokeCli — research output is written verbatim).
export async function runResearch(opts) {
  try {
  const NAME = "cdd research";
  // Host harness gate — the registry is indexed by the resolved host key (T3; resolved from host).
  const harness = requireHostHarness();

  // Brief validation (before the registry gate — pure file check, no PATH dependency).
  let briefContent;
  try {
    briefContent = readFileSync(opts.brief, "utf8");
  } catch (err) {
    process.stderr.write(`${NAME}: cannot read brief: ${err.message}\n`);
    exitBlocked();
  }

  // Harness registry gate (host key → registry entry).
  let entry;
  try {
    const reg = loadRegistry(process.env.CDD_REGISTRY_PATH || REG_PATH);
    entry = checkHarness(reg, harness, { dryRun: DRY_RUN() });
  } catch (err) {
    if (err instanceof CddBlockedError) {
      if (err.kind === "cli-missing") exitCliMissing(err.message);
      exitBlocked(err.message);
    }
    process.stderr.write(`${NAME}: ${err.message}\n`);
    exitWithCode(err.exitCode ?? 1);
  }

  const prompt = buildResearchPrompt(briefContent);

  // Dry-run short-circuit (argument parsing / smoke tests only).
  if (DRY_RUN()) exitOk();

  const cli = entry.cli;
  const cliArgs = [...entry.invoke.split(/\s+/).filter(Boolean), prompt];
  const timeoutMs = resolveTimeoutMs(process.env, "research");

  let result;
  try {
    // #137 subprocess-security posture: strip credentials from the harness env.
    const secureEnv = { ...process.env };
    delete secureEnv.ANTHROPIC_API_KEY;
    delete secureEnv.CLAUDE_CODE_SUBAGENT_MODEL;
    result = await spawnManaged(cli, cliArgs, { cwd: process.cwd(), env: secureEnv, timeoutMs });
    markAllDispatchesDone();          // dispatch 返回 → 组标 done（registry 恒为「dispatch 已返回」集合）
  } catch (err) {
    process.stderr.write(`${NAME}: spawn error: ${err.message}\n`);
    exitWithCode(1);
  }

  // Timeout path: write partial findings + TIMEOUT frontmatter + exit 1.
  if (result.timedOut) {
    process.stderr.write(`${NAME}: timeout after ${timeoutMs}ms\n`);
    writeFindings(opts.output, `${result.stdout}\n---\nstatus: TIMEOUT\n`);
    exitWithCode(1);
  }

  if (!result.ok) {
    process.stderr.write(`${NAME}: harness failed (exit ${result.code})\n`);
    if (result.stderr) process.stderr.write(result.stderr);
    exitWithCode(1);
  }

  writeFindings(opts.output, result.stdout);
  exitOk();
  } finally {
    stopIdleMonitor();
    await teardownAll({ graceMs: 5000 });   // research 出口 finally 兜底（spawn 底改已在 Task 2 完成，本步仅补出口）
  }
}