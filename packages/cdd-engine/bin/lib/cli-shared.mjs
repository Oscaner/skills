// packages/cdd-engine/bin/lib/cli-shared.mjs
import { execa } from 'execa';
import { resolveInjection, resolveSuffix } from './registry.mjs';

// Default timeouts by mode (30 minutes).
const DEFAULT_TIMEOUTS = { task: 1_800_000, review: 1_800_000, research: 1_800_000 };
const STEP_SECONDS = 1800;
const LEGACY_MODE_ENV = { research: 'RESEARCH_TIMEOUT' };
// setTimeout 32 位上限（2^31-1 ≈ 24.8 天）内的安全天花板。任何数值输入 ×1000 一旦越过该界，
// V8 触发 TimeoutOverflowWarning 把 timer 钳到 ~1ms —— 一次正常 dispatch 会被瞬时 SIGTERM 秒杀
// （T8 回归：CDD_REVIEW_TIMEOUT=2700000 泄漏 → timeout 2.7e9 ms → fake claude 被即时强杀）。
const MAX_TIMEOUT_MS = 2_000_000_000;

// 秒 → ms 出口统一钳制：合法数字（含巨大值）永不越过 setTimeout 上限（invalid → default 在调用方）。
function scaleToMs(seconds) {
  return Math.min(Math.max(1, seconds) * 1000, MAX_TIMEOUT_MS);
}

// per-mode env（CDD_TASK_TIMEOUT / CDD_REVIEW_TIMEOUT / CDD_RESEARCH_TIMEOUT）契约单位为秒 ——
// 45 分钟写 2700 而不是 2700000（ms 会 ≥8.3e8 → 溢出钳成 ~1ms 秒杀）。调度侧取值必须按秒契约。
export function resolveTimeoutMs(env, mode) {
  const modeEnv = { task: 'CDD_TASK_TIMEOUT', review: 'CDD_REVIEW_TIMEOUT', research: 'CDD_RESEARCH_TIMEOUT' };
  const modeKey = modeEnv[mode];
  const perMode = modeKey ? env[modeKey] : undefined;
  if (perMode !== undefined) {
    const n = Number(perMode);
    if (Number.isNaN(n)) return DEFAULT_TIMEOUTS[mode]; // invalid input → default, not ~1ms SIGTERM
    return scaleToMs(n);
  }
  const globalRaw = env.CDD_CLI_TIMEOUT;
  if (globalRaw !== undefined) {
    const n = Number(globalRaw);
    if (Number.isNaN(n)) return DEFAULT_TIMEOUTS[mode]; // invalid → default
    const seconds = Math.max(1, Math.ceil(n / STEP_SECONDS) * STEP_SECONDS);
    return scaleToMs(seconds);
  }
  const legacyKey = LEGACY_MODE_ENV[mode];
  const legacy = legacyKey ? env[legacyKey] : undefined;
  if (legacy !== undefined) {
    const n = Number(legacy);
    if (Number.isNaN(n)) return DEFAULT_TIMEOUTS[mode];
    return scaleToMs(n);
  }
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
// params = { op, type? } — operation×type injection replaces the positional mode
//   arg. op: implement|review|fix（review 带 type: task|branch|spec|plan）。解析在
//   registry.mjs resolveInjection/resolveSuffix（entry.{prefix,suffix}[op][type?]）统一解析，不再调用点内联镜像。
//   legacy 兼容：op 传扁平 mode 键（"task-review" 等）时 resolveInjection 直接命中旧键。
// joined with `\n` so the prefix forms its own first line.
// Bug O Step 5b: workspace propagates to the spawned CLI via CDD_GATE_WORKSPACE /
// CDD_GATE_MODE env (gate hooks run inside the CLI subprocess and inherit them).
// Nested task agents are ORCHESTRATOR SUBAGENTS (implement/task-review/fix must edit
// the repo, run git) — default CDD_GATE_MODE=subagent (gate allows). Only an explicit
// CDD_SESSION_MODE=cli re-arms strict gating (operator-CLI threat model).
export async function invokeCli(entry, prompt, params, env, cwd, timeoutMs) {
  const { cli, invoke, output } = entry;
  // 兜底：params 为 string（旧位置 mode 参数）时归一为 { op } —— op=扁平米键直解
  // （未迁移 registry 的 "task-review" 等键），避免静默空注入；真正缺席时回退空注入。
  const paramsObj = typeof params === "string" ? { op: params } : (typeof params === "object" && params ? params : {});
  const { op, type } = paramsObj;
  const p = resolveInjection(entry, op, type);
  const s = resolveSuffix(entry, op, type);
  const promptArg = [p, prompt, s].filter(Boolean).join('\n');
  const args = [...invoke.split(/\s+/).filter(Boolean), promptArg];
  const workspace = env?.CDD_WORKSPACE ?? '';
  const gateEnv = {
    ...cleanEnv(env ?? process.env),
    ...(workspace ? { CDD_GATE_WORKSPACE: workspace, CDD_GATE_MODE: process.env.CDD_SESSION_MODE ?? 'subagent' } : {}),
  };
  const res = await spawnCapture(cli, args, { cwd, env: gateEnv, timeoutMs });
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
// params { op, type? } 签名与 invokeCli 同步透传。
const RETRY_DELAYS_MS = [5_000, 15_000];

export async function invokeCliWithRetry(entry, prompt, params, env, cwd, timeoutMs) {
  const MAX_RETRIES = RETRY_DELAYS_MS.length;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await invokeCli(entry, prompt, params, env, cwd, timeoutMs);
    if (result.ok || result.timedOut) return result;
    const isTransient = /overloaded|rate_limit|529/.test(result.stderr ?? '');
    if (isTransient && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      continue;
    }
    return result;
  }
}
