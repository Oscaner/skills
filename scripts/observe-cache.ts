#!/usr/bin/env node
// scripts/observe-cache.ts — spec D-3 C7 dev-side cache observation tool. Measures prompt-cache
// read/write tokens across ≥2 consecutive same-(harness, op, type) dispatch rounds so a dev can
// assert "consecutive same-type round read tok > 0" within the TTL window. What "same-type round"
// means per mode (see maintainers/context-caching-doctrine § static-zone semantics):
//   · implement rounds are BYTE-IDENTICAL (buildCtx's implement fixedPoint is always "" and the
//     template declares no TASK_FIXED_POINT) — the read>0 hit measures the whole prompt;
//   · fix/review rounds diverge at their round-suffixed Handoff slots (handoff target / findings /
//     fixed point) — the shared harness prefix covers the invariant title/context/instructions
//     bytes only; record read flips honestly rather than claiming whole-prompt reuse.
// Honest boundary:
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
//     --cost | --debug               (flag appended to the harness invoke; default --debug —
//                                     the only real non-interactive claude -p flag; --cost is an
//                                     explicit opt-in for harnesses that accept it)
//   e.g.
//   node scripts/observe-cache.ts --rounds 2 \
//     -- .osuperpowers/cdd/2026-09-13-osuperpowers-overhaul-p6 7 implement
import { execa } from "execa";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
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
//
// citty args def (Task 21; engine src/cli/parse.ts isomorphism — the hand-rolled argv loop is
// retired, citty is the single parser). Boolean declarations are naturally presence-based: a flag
// absent from argv stays `undefined`, and a present `--cost` never consumes the following token —
// in natural usage (without the `--` separator) `--debug ws 7 implement` must not swallow `ws`.
// Value-taking options (--harness / --rounds) alone consume the next token; the workspace/task/mode
// trio are declared positionals (after `--` or bare).
import { parseArgs as parseArgsCitty } from "citty";
import type { ArgsDef } from "citty";

export const ARGS = {
  harness: { type: "string", description: "harness entry to observe (claude | cursor-agent)", default: "claude" },
  rounds: { type: "string", description: "number of consecutive same-type rounds to measure", default: "2" },
  cost: { type: "boolean", description: "append --cost measurement flag (explicit opt-in, harnesses that accept it)" },
  debug: { type: "boolean", description: "append --debug measurement flag (default)" },
  workspace: { type: "positional", description: "CDD workspace directory" },
  task: { type: "positional", description: "task number" },
  mode: { type: "positional", description: "implement | review | fix" },
} as const satisfies ArgsDef;

export function parseArgs(argv: string[]): {
  harness: string;
  rounds: number;
  flag: string;
  workspace: string;
  task: number;
  mode: string;
} {
  const args = parseArgsCitty(argv, ARGS);
  // `--debug` is the real non-interactive claude -p flag (emits usage/cache stats to stderr);
  // `--cost` only survives as an explicit opt-in for harnesses that accept it. Presence, not
  // value: `--cost=false` still opts in (the forwarded flag spelling is the only thing measured).
  return {
    harness: args.harness,
    rounds: Number(args.rounds ?? 2),
    flag: args.cost !== undefined ? "--cost" : "--debug",
    workspace: args.workspace,
    task: Number(args.task),
    mode: args.mode,
  };
}

// Read a nested JSON field (commits.base) from a handoff file; missing file/field → "" — mirrors
// dispatch/task.ts readJsonField, the same cross-phase read the engine performs for a fix dispatch.
function readJsonField(filePath: string, keys: string[]): string {
  try {
    let v: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    for (const k of keys) v = (v as Record<string, unknown> | null)?.[k];
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

// Cross-phase derivation for measurement-mode rounds — an approximation of the params buildCtx
// derives for this (op, type) round (dispatch/task.ts prev-table semantics):
//   · implement: buildCtx never derives a fixed point and the round-context slot TASK_FIXED_POINT
//     pre-fills "" (mode-union prefill; the per-template files are gone — a single round-context
//     zone serves all modes) — the rendered prompt is byte-identical across rounds (EXACT parity
//     for the C7 read>0 claim);
//   · fix round R: findings + fixed point come from the same-round review handoff (fix.task prev =
//     review.task:R; the engine reads its commits.base as the fixed point);
//   · review round R: fixed point from the prior phase (review.task round1 = implement.task,
//     roundR = fix.task:R-1).
// Absent a real prior handoff in the workspace, fixedPoint falls back to "" (the engine's
// readJsonField contract) — a documented measurement-mode approximation, not buildCtx's exact
// resolution. Exact for implement; best-effort for review/fix until real prior handoffs exist.
export function priorHandoffPaths(state: {
  workspace: string;
  task: number;
  mode: string;
  round: number;
}): { findingsPath: string; fixedPoint: string } {
  const handoffBase = `${state.workspace}/task-${state.task}`;
  if (state.mode === "implement") return { findingsPath: "", fixedPoint: "" };
  const reviewHandoff = `${handoffBase}-review-${state.round}.json`;
  const prior =
    state.mode === "review"
      ? state.round === 1
        ? `${handoffBase}-implement.json`
        : `${handoffBase}-fix-${state.round - 1}.json`
      : reviewHandoff;
  return {
    findingsPath: state.mode === "fix" ? reviewHandoff : "",
    fixedPoint: existsSync(prior) ? readJsonField(prior, ["commits", "base"]) : "",
  };
}

function renderRoundPrompt(state: { workspace: string; task: number; mode: string; round: number }): string {
  // Measurement-only render: workspace-relative paths, round-suffixed review/fix handoff targets,
  // fixed implement target, and the cross-phase findings/fixed-point above.
  const handoffBase = `${state.workspace}/task-${state.task}`;
  const { findingsPath, fixedPoint } = priorHandoffPaths(state);
  const handoff =
    state.mode === "implement"
      ? `${handoffBase}-implement.json`
      : `${handoffBase}-${state.mode}-${state.round}.json`;
  const params = {
    TASK_WORKSPACE: state.workspace,
    WORKSPACE_SLUG: basename(state.workspace),
    TASK_BRIEF: `${handoffBase}-brief.md`,
    HANDOFF_TARGET: handoff,
    TASK_FINDINGS: findingsPath,
    TASK_CONSTRAINTS: `${state.workspace}/plan-constraints.md`,
    TASK_FIXED_POINT: fixedPoint,
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
    args.splice(args.length - 1, 0, flag); // measurement flag (--debug default) right before the prompt arg
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