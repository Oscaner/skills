// packages/cdd-engine/bin/lib/cli-shared.mjs
import { execa } from 'execa';

// Default timeouts by mode (30 minutes).
const DEFAULT_TIMEOUTS = { task: 1_800_000, review: 1_800_000, research: 1_800_000 };
const STEP_SECONDS = 1800;
const LEGACY_MODE_ENV = { research: 'RESEARCH_TIMEOUT' };

export function resolveTimeoutMs(env, mode) {
  const modeEnv = { task: 'CDD_TASK_TIMEOUT', review: 'CDD_REVIEW_TIMEOUT', research: 'CDD_RESEARCH_TIMEOUT' };
  const modeKey = modeEnv[mode];
  const perMode = modeKey ? env[modeKey] : undefined;
  if (perMode !== undefined) return Math.max(1, Number(perMode)) * 1000;
  const globalRaw = env.CDD_CLI_TIMEOUT;
  if (globalRaw !== undefined) {
    const seconds = Math.max(1, Math.ceil(Number(globalRaw) / STEP_SECONDS) * STEP_SECONDS);
    return seconds * 1000;
  }
  const legacyKey = LEGACY_MODE_ENV[mode];
  const legacy = legacyKey ? env[legacyKey] : undefined;
  if (legacy !== undefined) return Math.max(1, Number(legacy)) * 1000;
  if (DEFAULT_TIMEOUTS[mode] != null) return DEFAULT_TIMEOUTS[mode];
  return undefined;
}

// Strip credentials from subprocess env (#137 security fix).
function cleanEnv(env) {
  const e = { ...env };
  delete e.CLAUDE_CODE_SUBAGENT_MODEL;
  delete e.ANTHROPIC_API_KEY;
  return e;
}

// Raw subprocess capture via execa (reject:false = never throws).
// Returns {ok, code, stdout, stderr, timedOut}.
export async function spawnCapture(command, args, opts = {}) {
  const { cwd, env, timeoutMs } = opts;
  const res = await execa(command, args, {
    cwd,
    env: cleanEnv(env ?? process.env),
    timeout: timeoutMs,             // execa built-in watchdog
    forceKillAfterDelay: 5000,      // SIGKILL fallback (#137)
    reject: false,                  // never throws
    all: false,
  });
  const timedOut = res.timedOut ?? false;
  return {
    ok:      res.exitCode === 0 && !timedOut,
    code:    res.exitCode ?? 1,
    stdout:  res.stdout ?? '',
    stderr:  res.stderr ?? '',
    timedOut,
  };
}

// Invoke CLI: build args from entry, handle stream-json output mode.
export async function invokeCli(entry, prompt, mode, env, cwd, timeoutMs) {
  const { cli, invoke, output, task_review_prefix } = entry;
  const promptArg = mode === 'task-review' && task_review_prefix
    ? `${task_review_prefix} ${prompt}` : prompt;
  const args = [...invoke.split(/\s+/).filter(Boolean), promptArg];
  const res = await spawnCapture(cli, args, { cwd, env, timeoutMs });
  if (res.ok && output === 'stream-json') {
    const finalText = extractStreamJsonFinal(res.stdout);
    if (!finalText) {
      return { ok: false, code: 1, stdout: res.stdout,
               stderr: 'stream-json produced no completion finalText', timedOut: false };
    }
    return { ok: true, code: 0, stdout: finalText, stderr: res.stderr, timedOut: false };
  }
  return res;
}

// NDJSON line-by-line parser — replaces hand-written scanner (#139 fix).
// Claude stream-json output: one JSON object per line.
function extractStreamJsonFinal(raw) {
  let last = null;
  for (const line of String(raw).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const ev = JSON.parse(trimmed);
      if (ev.type === 'completion' && ev.finalText != null) last = ev.finalText;
    } catch { /* skip non-JSON lines */ }
  }
  return last;
}

// Transient retry wrapper for invokeCli (#109 fix).
// Retries only on overloaded/rate_limit/529 stderr, never on timeout.
const RETRY_DELAYS_MS = [5_000, 15_000];

export async function invokeCliWithRetry(entry, prompt, mode, env, cwd, timeoutMs) {
  const MAX_RETRIES = RETRY_DELAYS_MS.length;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await invokeCli(entry, prompt, mode, env, cwd, timeoutMs);
    if (result.ok || result.timedOut) return result;
    const isTransient = /overloaded|rate_limit|529/.test(result.stderr ?? '');
    if (isTransient && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      continue;
    }
    return result;
  }
}
