// packages/cdd-engine/src/infra/invoke.ts — CLI invoke contract (TS port of invoke.mjs; spec §2.13
// invoke row). Same contract as the .mjs module (checked by cli-shared.test.mjs): injection /
// timeout / retry / NDJSON parsing; spawn delegation converges through proc.spawnManaged.
// Seam note (channel audit ③): env is an EXPLICIT parameter here — the .mjs `env ?? process.env`
// fallback is a whitelisted passthrough site pinned to invoke.mjs; the rebuild threads env down
// from its own callers instead of reading process.env at this depth.
import { loadContract } from "./context.ts";
import { resolveInjection, resolveSuffix } from "./registry.ts";
import { spawnManaged, markAllDispatchesDone, type SpawnResult } from "./proc.ts";

export interface TimeoutDefaults {
  [mode: string]: number | undefined;
}

// Timeout and env-name source of truth: canonical `engine-config.json#contextContract` (loadContract()
// is the unique reader). Any default / per-mode / global-override env name here comes from the
// canonical — editing the canonical edits behavior. MAX_TIMEOUT_MS stays a module constant on
// purpose: it is the safe ceiling below the setTimeout 32-bit limit, not canonical behavior.
const CONTRACT = loadContract();
const DEFAULT_TIMEOUTS: TimeoutDefaults = CONTRACT.timeouts.defaults;
const PER_MODE_ENV = CONTRACT.timeouts.perModeOverride.env;
const GLOBAL_ENV = CONTRACT.timeouts.globalOverride.env;
const STEP_SECONDS = CONTRACT.timeouts.globalOverride.stepSeconds;
const MAX_TIMEOUT_MS = 2_000_000_000;

// seconds → ms unified clamp: valid numbers (incl. huge) never cross the setTimeout ceiling
// (invalid → default, resolved by the caller).
function scaleToMs(seconds: number): number {
  return Math.min(Math.max(1, seconds) * 1000, MAX_TIMEOUT_MS);
}

// per-mode env (CDD_TASK_TIMEOUT / CDD_REVIEW_TIMEOUT) is in seconds — 45 min is 2700, not 2700000
// (an ms value ≥ 8.3e8 overflows the clamp and turns into a ~1ms instant SIGTERM).
export function resolveTimeoutMs(env: NodeJS.ProcessEnv, mode: string): number | undefined {
  const modeKey = PER_MODE_ENV[mode];
  const perMode = modeKey ? env[modeKey] : undefined;
  if (perMode !== undefined) {
    const n = Number(perMode);
    if (Number.isNaN(n)) return DEFAULT_TIMEOUTS[mode]; // invalid input → default, never ~1ms kill
    return scaleToMs(n);
  }
  const globalRaw = env[GLOBAL_ENV];
  if (globalRaw !== undefined) {
    const n = Number(globalRaw);
    if (Number.isNaN(n)) return DEFAULT_TIMEOUTS[mode];
    const seconds = Math.max(1, Math.ceil(n / STEP_SECONDS) * STEP_SECONDS);
    return scaleToMs(seconds);
  }
  if (DEFAULT_TIMEOUTS[mode] != null) return DEFAULT_TIMEOUTS[mode];
  return undefined;
}

// Credentials stripping lives at the single spawn choke point in proc.ts (spawnManaged) — invoke.ts
// keeps no duplicate cleanEnv (branch-review warn 1 of the .mjs era: double stripping is dead code).

export interface InvokeParams {
  op: string;
  type?: string;
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
  timeoutMs: number | undefined,
): Promise<SpawnResult> {
  // Fallback: string params (legacy positional mode) normalize to { op } — a flat mode key resolves
  // directly (unmigrated registry), avoiding a silent empty injection; truly-absent → empty injection.
  const paramsObj: InvokeParams = typeof params === "string" ? { op: params } : (params ?? {});
  const { op, type } = paramsObj;
  const p = resolveInjection(entry, op, type);
  const s = resolveSuffix(entry, op, type);
  const promptArg = [p, prompt, s].filter(Boolean).join("\n");
  const args = [...entry.invoke.split(/\s+/).filter(Boolean), promptArg];
  const res = await spawnManaged(entry.cli, args, { cwd, env, timeoutMs });
  markAllDispatchesDone();          // dispatch (incl. every retry attempt) returned → group done
  if (res.ok && entry.output === "stream-json") {
    const finalText = extractStreamJsonFinal(res.stdout);
    // timedOut passes the spawnManaged self-held determination through — previously two hardcoded
    // false branches dropped the timeout shape at the stream-json exit.
    if (!finalText) {
      return { ok: false, code: 1, stdout: res.stdout,
               stderr: "stream-json produced no completion finalText", timedOut: res.timedOut === true };
    }
    return { ok: true, code: 0, stdout: finalText, stderr: res.stderr, timedOut: res.timedOut === true };
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
  timeoutMs: number | undefined,
): Promise<SpawnResult> {
  const MAX_RETRIES = RETRY_DELAYS_MS.length;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await invokeCli(entry, prompt, params, env, cwd, timeoutMs);
    if (result.ok || result.timedOut) return result;
    const isTransient = /overloaded|rate_limit|529/.test(result.stderr ?? "");
    if (isTransient && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      continue;
    }
    return result;
  }
  throw new Error("unreachable: retry loop always returns");
}
