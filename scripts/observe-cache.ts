#!/usr/bin/env node
// scripts/observe-cache.ts — spec D-3 C7 dev-side cache observation tool. Measures prompt-cache
// read/write tokens across ≥2 consecutive same-(harness, op, type) dispatch rounds so a dev can
// assert "consecutive same-type round read tok > 0" within the TTL window. Honest boundary:
//   · measurement is dev-side + documented, NOT a CI gate (CI has no live harness);
//   · claims accrue only inside the TTL window across consecutive same-type dispatches —
//     cross-window / absolute hit rates are never claimed (see maintainers/context-caching-doctrine);
//   · this run is measurement-only: it renders the engine's prompt and spawns the harness CLI with
//     a usage/cost flag appended — it writes no handoffs and mutates no workspace (real rounds run
//     through `cdd …`, whose commit double-gate keeps the tree stable per C5).
//
// Usage:
//   node scripts/observe-cache.ts [options] -- <workspace> <task> <mode>
//     --harness claude|cursor-agent   (default: claude)
//     --rounds 2                     (default: 2 — the brief's ≥2 consecutive same-type rounds)
//     --cost | --debug               (flag appended to the harness invoke; default --cost)
//   e.g.
//   node scripts/observe-cache.ts --rounds 2 \
//     -- .osuperpowers/cdd/2026-09-13-osuperpowers-overhaul-p6 7 implement
import { execa } from "execa";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderModePrompt, resetTemplateCaches } from "../packages/cdd-engine/src/render/templates.ts";
import { loadRegistry, REG_PATH, resolveInjection } from "../packages/cdd-engine/src/infra/registry.ts";
import { buildInvokeArgs, promptArgText } from "../packages/cdd-engine/src/infra/invoke.ts";

export type CacheUsage = { readTokens: number; writeTokens: number };

// Last-occurrence parser: harnesses may print cost several times (retries / streaming updates);
// the final summary of the round is the value that matters for a before/after comparison.
const READ_PATTERNS: RegExp[] = [
  /cache_read_input_tokens"?\s*(?:[=:]\s*)(\d+)/g,
  /prompt_cache_read_tokens"?\s*(?:[=:]\s*)(\d+)/g,
  /prompt cache read tokens?\s*(?:[=:]\s*)([\d,]+)/gi,
  /cache read tokens?\s*(?:[=:]\s*)([\d,]+)/gi,
];
const WRITE_PATTERNS: RegExp[] = [
  /cache_creation_input_tokens"?\s*(?:[=:]\s*)(\d+)/g,
  /prompt_cache_write_tokens"?\s*(?:[=:]\s*)(\d+)/g,
  /prompt cache (?:write|creation) tokens?\s*(?:[=:]\s*)([\d,]+)/gi,
  /cache (?:write|creation) tokens?\s*(?:[=:]\s*)([\d,]+)/gi,
];

function lastValue(log: string, patterns: RegExp[]): number | null {
  let value: number | null = null;
  for (const re of patterns) {
    for (const m of log.matchAll(re)) value = Number(m[1].replace(/,/g, ""));
  }
  return value;
}

/** Extract the round's final prompt-cache usage from `/cost` / `--debug` output; null when the
 * harness produced no cache fields (not a measurable round). */
export function extractCacheUsage(log: string): CacheUsage | null {
  const readTokens = lastValue(log, READ_PATTERNS);
  const writeTokens = lastValue(log, WRITE_PATTERNS);
  if (readTokens === null && writeTokens === null) return null;
  return { readTokens: readTokens ?? 0, writeTokens: writeTokens ?? 0 };
}

// ---- driver ----

function parseArgs(argv: string[]): {
  harness: string;
  rounds: number;
  flag: string;
  workspace: string;
  task: number;
  mode: string;
} {
  const opts: Record<string, string> = {};
  const rest: string[] = [];
  let afterFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { afterFlag = true; continue; }
    if (!afterFlag && a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq >= 0) opts[a.slice(2, eq)] = a.slice(eq + 1);
      else opts[a.slice(2)] = argv[i + 1] ?? "";
      if (!a.includes("=")) i++;
      continue;
    }
    rest.push(a);
  }
  const [workspace, taskStr, mode] = rest;
  const task = Number(taskStr);
  if (!workspace || !task || !mode) {
    throw new Error(
      "usage: observe-cache [--harness claude] [--rounds 2] [--cost|--debug] -- <workspace> <task> <mode>",
    );
  }
  return {
    harness: opts.harness ?? "claude",
    rounds: Number(opts.rounds ?? 2),
    flag: opts.debug ? "--debug" : "--cost",
    workspace,
    task,
    mode,
  };
}

function renderRoundPrompt(state: { workspace: string; task: number; mode: string; round: number }): string {
  // Measurement-only render: the same params buildCtx would derive for this (op,type) round
  // (workspace-relative paths, round-suffixed review/fix handoff targets, fixed implement target).
  const handoffBase = `${state.workspace}/task-${state.task}`;
  const handoff =
    state.mode === "implement"
      ? `${handoffBase}-implement.json`
      : `${handoffBase}-${state.mode}-${state.round}.json`;
  const params = {
    TASK_WORKSPACE: state.workspace,
    TASK_BRIEF: `${handoffBase}-brief.md`,
    HANDOFF_TARGET: handoff,
    TASK_FINDINGS: state.mode === "fix" ? `${handoffBase}-open-findings.json` : "",
    TASK_CONSTRAINTS: `${state.workspace}/plan-constraints.md`,
    TASK_FIXED_POINT: state.round > 1 ? "cbaed2377b7548a3221bbb4307d6d5ee1287cb1e" : "",
    TASK_NUMBER: String(state.task),
    REVIEW_PLAN_LINE: "",
  };
  return renderModePrompt(state.mode, params);
}

async function main(): Promise<void> {
  const { harness, rounds, flag, workspace, task, mode } = parseArgs(process.argv.slice(2));
  const entry = loadRegistry(REG_PATH)[harness];
  if (!entry) {
    console.error(`observe-cache: unknown harness "${harness}" — registry at ${REG_PATH}`);
    process.exit(2);
  }

  resetTemplateCaches(); // one cold static-zone render, then measure the hot re-dispatches
  console.log(`observe-cache: ${harness} · ${mode} · task ${task} · ${rounds} rounds (flag ${flag})`);
  console.log(`workspace: ${workspace}\n`);

  const rows: Array<{ round: number; promptBytes: number; read: number; write: number }> = [];
  for (let round = 1; round <= rounds; round++) {
    const prompt = renderRoundPrompt({ workspace, task, mode, round });
    // Resolve the op×type injection the exact way the engine does (registry resolver — C5 parity:
    // the observed invoke set mirrors what cdd dispatches, with only the measurement flag added).
    const promptArg = promptArgText(resolveInjection(entry, mode, mode === "review" || mode === "fix" ? "task" : undefined), prompt, "");
    const args = [...buildInvokeArgs(entry.invoke ?? "", promptArg)];
    args.splice(args.length - 1, 0, flag); // usage/cost flag right before the prompt arg
    const result = await execa(entry.cli, args, {
      cwd: workspace,
      env: { ...process.env },
      timeout: 10 * 60 * 1000,
      reject: false,
    });
    const usage = extractCacheUsage(`${result.stdout}\n${result.stderr}`);
    rows.push({ round, promptBytes: prompt.length, read: usage?.readTokens ?? -1, write: usage?.writeTokens ?? -1 });
    console.log(
      `round ${round}: prompt=${prompt.length}B exit=${result.exitCode} cache read=${usage?.readTokens ?? "—"} write=${usage?.writeTokens ?? "—"}`,
    );
    if (usage && round < rounds) {
      console.log(`  (round ${round} written ${usage.writeTokens} cache tokens — next round reads within TTL should hit)`);
    }
  }

  console.log("\nsummary:");
  for (const r of rows) console.log(`  round ${r.round}: read=${r.read} write=${r.write}`);
  const later = rows.slice(1);
  const hit = later.some((r) => r.read > 0);
  const measurable = rows.some((r) => r.read > 0 || r.write > 0);
  if (measurable && hit) {
    console.log("\nverdict: cache OBSERVED — a later same-type round read tok > 0 (TTL window hit path).");
  } else if (measurable) {
    console.log("\nverdict: measurable but no read>0 hit recorded (TTL window may have elapsed between rounds).");
  } else {
    console.log("\nverdict: not measurable (no cache fields) or below minTokens — record honestly, do not claim.");
    process.exit(1);
  }
}

// Executable entry (test imports only the parser — main must not run under vitest).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`observe-cache: ${(err as Error).message}`);
    process.exit(2);
  });
}