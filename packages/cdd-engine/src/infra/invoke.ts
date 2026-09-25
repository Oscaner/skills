// packages/cdd-engine/src/infra/invoke.ts — CLI invoke contract (TS port of invoke.mjs; spec §2.13
// invoke row). Same contract as the .mjs module (checked by cli-shared.test.mjs): injection /
// timeout / retry / NDJSON parsing; spawn delegation converges through proc.spawnManaged.
// Seam note (channel audit ③): env is an EXPLICIT parameter here — the .mjs `env ?? process.env`
// fallback is a whitelisted passthrough site pinned to invoke.mjs; the rebuild threads env down
// from its own callers instead of reading process.env at this depth.
import { loadContract } from "./context.ts";
import { invariant } from "./exit.ts";
import {
  DEFAULT_IDLE_WINDOW_MS,
  DEFAULT_SAMPLE_INTERVAL_MS,
  markAllDispatchesDone,
  type SpawnResult,
  spawnManaged,
  type TerminationConfig,
} from "./proc.ts";
import { resolveInjection, resolveSuffix } from "./registry.ts";

export interface TimeoutDefaults {
  [mode: string]: number | undefined;
}

// Termination config source of truth: canonical `engine-config.json#contextContract` (loadContract()
// is the unique reader). The budget defaults + stall cadence come from the canonical — editing the
// canonical edits behavior. T26 deletion surface: the env override keys (CDD_TASK_TIMEOUT /
// CDD_REVIEW_TIMEOUT / CDD_CLI_TIMEOUT) and the perModeOverride/globalOverride config segments are
// REMOVED — runtime budget tuning had zero real scenarios and violated the T14 zero-new-env-key
// principle; the config defaults + the explicit opts.termination seam are the only budget sources.
const CONTRACT = loadContract();
const DEFAULT_TIMEOUTS: TimeoutDefaults = CONTRACT.timeouts.defaults;

// Stall-cadence surface (T26): the stall detector's sample cadence + idle window read from canonical
// timeouts.liveness (defaults are honored the same way the mode budgets are — a config file edit
// edits behavior). No env override: the documented seams for tests are the injectable
// TaskRunOptions.termination (dispatch) and SpawnOpts.termination (proc).
const LIVENESS_DEFAULTS: Record<string, number | undefined> =
  (CONTRACT.timeouts.liveness as Record<string, number | undefined> | undefined) ?? {};

/**
 * resolveTerminationConfig — the single resolver for the unified termination param (T26: replaces
 * resolveTimeoutMs + resolveLivenessConfig). Returns the full TerminationConfig the three dispatch
 * islands (task / docs / branch) thread into invokeCli/spawnManaged:
 *   budgetMs       = overrides?.budgetMs ?? canonical default for mode (no env reads);
 *   progressPath   = overrides?.progressPath ?? progressPath arg (the workspace tree signal);
 *   sampleInterval = overrides?.sampleIntervalMs ?? canonical timeouts.liveness;
 *   idleWindowMs   = overrides?.idleWindowMs ?? canonical timeouts.liveness.
 */
export function resolveTerminationConfig(
  mode: string,
  overrides: Partial<TerminationConfig> | undefined = undefined,
  progressPath: string | undefined = undefined,
): TerminationConfig {
  return {
    budgetMs: overrides?.budgetMs ?? DEFAULT_TIMEOUTS[mode],
    progressPath: overrides?.progressPath ?? progressPath,
    sampleIntervalMs:
      overrides?.sampleIntervalMs ??
      LIVENESS_DEFAULTS.sampleIntervalMs ??
      DEFAULT_SAMPLE_INTERVAL_MS,
    idleWindowMs:
      overrides?.idleWindowMs ?? LIVENESS_DEFAULTS.idleWindowMs ?? DEFAULT_IDLE_WINDOW_MS,
  };
}

// Credentials stripping lives at the single spawn choke point in proc.ts (spawnManaged) — invoke.ts
// keeps no duplicate cleanEnv (branch-review warn 1 of the .mjs era: double stripping is dead code).

export interface InvokeParams {
  op: string;
  type?: string;
}

// ---- spec D-3 C5: dispatch-set composition (pure, deterministic — the C4 memo precondition) ----
// The engine-controlled dispatch set = { cli, args (invoke string), cwd, env }; model is
// harness-decided and never set here. same (harness, op, type) + same inputs → byte-identical set
// (registry-driven prefix/suffix resolution, zero env sway). composeDispatchSet is the single
// assembly point invokeCli spawns from.

export interface DispatchSet {
  cli: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

/** [registry prefix, prompt, suffix] joined on newlines (C1: prefix precedes the prompt). */
export function promptArgText(prefix: string, prompt: string, suffix: string): string {
  return [prefix, prompt, suffix].filter(Boolean).join("\n");
}

/** invoke-spec words + the prompt arg last (the exact legacy args shape). */
export function buildInvokeArgs(invokeSpec: string, promptArg: string): string[] {
  return [...invokeSpec.split(/\s+/).filter(Boolean), promptArg];
}

/** Resolve the op×type prefix/suffix and compose the full dispatch set. */
export function composeDispatchSet(
  entry: { cli: string; invoke: string; prefix?: unknown; suffix?: unknown },
  params: InvokeParams | string,
  prompt: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
): DispatchSet {
  const paramsObj: InvokeParams = typeof params === "string" ? { op: params } : (params ?? {});
  const { op, type } = paramsObj;
  const p = resolveInjection(entry, op, type);
  const s = resolveSuffix(entry, op, type);
  const promptArg = promptArgText(p, prompt, s);
  return { cli: entry.cli, args: buildInvokeArgs(entry.invoke, promptArg), cwd, env };
}

// Invoke CLI: build args from entry, handle stream-json output mode.
// params = { op, type? } — operation×type injection replaces the positional mode arg. op:
// implement|review|fix (review carries type: task|branch|spec|plan). Resolution happens in
// registry.ts resolveInjection/resolveSuffix (entry.{prefix,suffix}[op][type?]), never inlined here.
// Legacy compat: a flat string mode key hits directly through the same resolver.
export async function invokeCli(
  entry: { cli: string; invoke: string; output?: string; prefix?: unknown; suffix?: unknown },
  prompt: string,
  params: InvokeParams | string,
  env: NodeJS.ProcessEnv,
  cwd: string,
  termination?: TerminationConfig, // unified budget + stall termination opts (single param; T26)
): Promise<SpawnResult> {
  const set = composeDispatchSet(entry, params, prompt, cwd, env);
  const res = await spawnManaged(set.cli, set.args, { cwd: set.cwd, env: set.env, termination });
  markAllDispatchesDone(); // dispatch (incl. every retry attempt) returned → group done
  if (res.ok && entry.output === "stream-json") {
    const finalText = extractStreamJsonFinal(res.stdout);
    // timedOut passes the spawnManaged determination through — plus the cause it recorded (T26
    // three-cause surface), so the stream-json exit never drops the termination shape.
    if (!finalText) {
      return {
        ok: false,
        code: 1,
        stdout: res.stdout,
        stderr: "stream-json produced no completion finalText",
        timedOut: res.timedOut === true,
        cause: res.cause,
      };
    }
    return {
      ok: true,
      code: 0,
      stdout: finalText,
      stderr: res.stderr,
      timedOut: res.timedOut === true,
      cause: res.cause,
    };
  }
  return res;
}

// NDJSON line-by-line parser — one JSON object per line (Claude stream-json output shape).
function extractStreamJsonFinal(raw: string): string | null {
  let last: string | null = null;
  for (const line of String(raw).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const ev = JSON.parse(trimmed);
      if (ev.type === "completion" && ev.finalText != null) last = ev.finalText;
    } catch {
      /* non-JSON line — skip */
    }
  }
  return last;
}

// Transient retry wrapper for invokeCli (#109 fix). Retries only overloaded/rate_limit/529 stderr,
// never on timeout. params { op, type? } threads the same signature as invokeCli.
export const RETRY_DELAYS_MS = [5_000, 15_000];

export async function invokeCliWithRetry(
  entry: { cli: string; invoke: string; output?: string; prefix?: unknown; suffix?: unknown },
  prompt: string,
  params: InvokeParams | string,
  env: NodeJS.ProcessEnv,
  cwd: string,
  termination?: TerminationConfig,
): Promise<SpawnResult> {
  const MAX_RETRIES = RETRY_DELAYS_MS.length;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await invokeCli(entry, prompt, params, env, cwd, termination);
    if (result.ok || result.timedOut) return result;
    const isTransient = /overloaded|rate_limit|529/.test(result.stderr ?? "");
    if (isTransient && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      continue;
    }
    return result;
  }
  invariant(false, "unreachable: retry loop always returns");
}
