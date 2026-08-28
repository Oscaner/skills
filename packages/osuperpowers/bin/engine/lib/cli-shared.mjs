// engine/lib/cli-shared.mjs — Shared CLI utilities extracted from runner.mjs.
// spawnCapture: raw spawn + stdout/stderr capture.
// invokeCli: $cli $invoke "$prompt" with stream-json normalization.
import { spawn } from "node:child_process";

// Raw spawn + capture stdout/stderr. exit code 0 → ok:true; otherwise ok:false.
// opts.onSpawn(proc) — optional callback fired after spawn, before close/error.
export function spawnCapture(command, args, { cwd, env, onSpawn }) {
  // Strip subagent model env vars to prevent leakage into nested CLI sessions.
  const cleanEnv = { ...env };
  delete cleanEnv.CLAUDE_CODE_SUBAGENT_MODEL;
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, env: cleanEnv, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    if (onSpawn) onSpawn(proc);
    proc.stdout.on("data", (d) => {
      stdout += d;
    });
    proc.stderr.on("data", (d) => {
      stderr += d;
    });
    proc.on("error", (err) => {
      resolve({ ok: false, code: 1, stdout, stderr: stderr || `spawn failed: ${err.message}` });
    });
    proc.on("close", (code) => {
      resolve({ ok: code === 0, code: code ?? 1, stdout, stderr });
    });
  });
}

// $cli $invoke "$prompt_arg" (task-review prefix synthesis) + output mode normalization
// (text passthrough / stream-json → last completion finalText preserved).
export async function invokeCli(entry, prompt, mode, env, cwd) {
  const { cli, invoke, output, task_review_prefix } = entry;
  const promptArg = mode === "task-review" && task_review_prefix ? `${task_review_prefix} ${prompt}` : prompt;
  const args = [...invoke.split(/\s+/).filter(Boolean), promptArg];
  const res = await spawnCapture(cli, args, { cwd, env });
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
