// engine/lib/cli-shared.mjs — Shared CLI utilities extracted from runner.mjs.
// spawnCapture: raw spawn + stdout/stderr capture.
// invokeCli: $cli $invoke "$prompt" with stream-json normalization.
import { spawn } from "node:child_process";

// Default timeouts by mode (30 minutes each).
const DEFAULT_TIMEOUTS = { task: 1800_000, review: 1800_000, research: 1800_000 };

// 30-minute step boundary in seconds. Non-boundary values round up.
const STEP_SECONDS = 1800;

// Old env names retained for backward-compat (per-mode scope only).
const LEGACY_MODE_ENV = { research: "RESEARCH_TIMEOUT" };

/**
 * Resolve timeout in milliseconds for a given mode.
 * Priority: per-mode env (no stepping) > CDD_CLI_TIMEOUT (stepped) > legacy per-mode env (no stepping) > DEFAULT_TIMEOUTS[mode] (stepped).
 * 30-minute stepping: non-boundary seconds round up to next step boundary.
 * @param {Record<string, string|undefined>} env
 * @param {string} mode
 * @returns {number|undefined} timeout in ms, or undefined if no default for mode
 */
export function resolveTimeoutMs(env, mode) {
  const modeEnv = { task: "CDD_TASK_TIMEOUT", review: "CDD_REVIEW_TIMEOUT", research: "CDD_RESEARCH_TIMEOUT" };
  const modeKey = modeEnv[mode];
  const perMode = modeKey ? env[modeKey] : undefined;
  if (perMode !== undefined) {
    // Per-mode values are used as-is (no stepping)
    return Math.max(1, Number(perMode)) * 1000;
  }
  const globalRaw = env.CDD_CLI_TIMEOUT;
  if (globalRaw !== undefined) {
    const seconds = Math.max(1, Math.ceil(Number(globalRaw) / STEP_SECONDS) * STEP_SECONDS);
    return seconds * 1000;
  }
  // Legacy env name (e.g. RESEARCH_TIMEOUT) — backward-compat, used as-is (no stepping).
  const legacyKey = LEGACY_MODE_ENV[mode];
  const legacy = legacyKey ? env[legacyKey] : undefined;
  if (legacy !== undefined) {
    return Math.max(1, Number(legacy)) * 1000;
  }
  if (DEFAULT_TIMEOUTS[mode] != null) {
    return DEFAULT_TIMEOUTS[mode];
  }
  return undefined;
}

const SIGKILL_DELAY_MS = 5000;

// Raw spawn + capture stdout/stderr. exit code 0 → ok:true; otherwise ok:false.
// opts.onSpawn(proc) — optional callback fired after spawn, before close/error.
// opts.timeoutMs — optional watchdog timeout in ms; undefined = no timeout (backward-compatible).
export function spawnCapture(command, args, opts = {}) {
  const { cwd, env, onSpawn, timeoutMs } = opts;
  // Strip subagent model env vars to prevent leakage into nested CLI sessions.
  const cleanEnv = { ...env };
  delete cleanEnv.CLAUDE_CODE_SUBAGENT_MODEL;
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, env: cleanEnv, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timer = null;
    let killTimer = null;
    let resolved = false;
    let timeoutTriggered = false;

    function finish(result) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve(result);
    }

    if (onSpawn) onSpawn(proc);
    proc.stdout.on("data", (d) => {
      stdout += d;
    });
    proc.stderr.on("data", (d) => {
      stderr += d;
    });
    proc.on("error", (err) => {
      finish({ ok: false, code: 1, stdout, stderr: stderr || `spawn failed: ${err.message}`, timedOut: false });
    });
    proc.on("close", (code) => {
      if (timeoutTriggered) {
        finish({ ok: false, code: -1, stdout, stderr, timedOut: true });
      } else {
        finish({ ok: code === 0, code: code ?? 1, stdout, stderr, timedOut: false });
      }
    });

    // Watchdog timer: SIGTERM → SIGKILL fallback
    if (timeoutMs !== undefined) {
      timer = setTimeout(() => {
        timeoutTriggered = true;
        proc.kill("SIGTERM");
        killTimer = setTimeout(() => {
          proc.kill("SIGKILL");
          // After SIGKILL, if no exit event follows, resolve with unkillable flag
          const unkillableCheck = setTimeout(() => {
            finish({ ok: false, code: -1, stdout, stderr, timedOut: true, unkillable: true });
          }, 2000);
          unkillableCheck.unref?.();
        }, SIGKILL_DELAY_MS).unref?.();
      }, timeoutMs).unref?.();
    }
  });
}

// $cli $invoke "$prompt_arg" (task-review prefix synthesis) + output mode normalization
// (text passthrough / stream-json → last completion finalText preserved).
export async function invokeCli(entry, prompt, mode, env, cwd, timeoutMs) {
  const { cli, invoke, output, task_review_prefix } = entry;
  const promptArg = mode === "task-review" && task_review_prefix ? `${task_review_prefix} ${prompt}` : prompt;
  const args = [...invoke.split(/\s+/).filter(Boolean), promptArg];
  const res = await spawnCapture(cli, args, { cwd, env, timeoutMs });
  if (res.ok && output === "stream-json") {
    const finalText = extractStreamJsonFinal(res.stdout);
    if (!finalText) {
      return { ok: false, code: 1, stdout: res.stdout, stderr: "stream-json produced no completion finalText" };
    }
    return { ok: true, code: 0, stdout: finalText, stderr: res.stderr };
  }
  return res;
}

// ---- internal helpers (not exported) ----

// Full-stream slurp for stream-json: parse all JSON values, keep last completion.finalText.
function extractStreamJsonFinal(raw) {
  const text = String(raw);
  let last = null;
  let pos = 0;
  const n = text.length;
  while (pos < n) {
    while (pos < n && /\s/.test(text[pos])) pos++;
    if (pos >= n) break;
    const end = jsonValueEnd(text, pos);
    try {
      const ev = JSON.parse(text.slice(pos, end));
      if (ev.type === "completion" && ev.finalText != null) last = ev.finalText;
    } catch {
      // non-JSON text skipped
    }
    pos = Math.max(end, pos + 1);
  }
  return last;
}

// Scan JSON string from start (first ") to closing ". Returns index after closing ".
function scanString(text, start) {
  let i = start + 1;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === "\\") i += 2;
    else if (ch === '"') return i + 1;
    else i++;
  }
  return n;
}

// Return index after one complete JSON value starting at start.
function jsonValueEnd(text, start) {
  const first = text[start];
  if (first === "{") return scanBalanced(text, start, "{", "}");
  if (first === "[") return scanBalanced(text, start, "[", "]");
  if (first === '"') return scanString(text, start);
  let i = start;
  const n = text.length;
  while (i < n && !/\s/.test(text[i]) && !",}]".includes(text[i])) i++;
  return i;
}

function scanBalanced(text, start, openCh, closeCh) {
  const n = text.length;
  let depth = 0;
  for (let i = start; i < n; i++) {
    const ch = text[i];
    if (ch === '"') {
      i = scanString(text, i) - 1;
    } else if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return n;
}
