#!/usr/bin/env node
// cdd-session-activate.mjs — write pending-cdd JSON for CDD orchestrator sessions.
// Node port of cdd-session-activate.sh; spec §E 模式感知（--mode 优先于 CDD_SESSION_MODE env；
// 空 → fail-open 省略 mode；非法 → exit 2 不写）。
//   usage: cdd-session-activate.mjs minimal <session_key> <repo_root> [--mode <in-session|subagent|cli>]
//          cdd-session-activate.mjs bind <session_key> <repo_root> <plan_path> <workspace> [--mode <in-session|subagent|cli>]
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exitOk, exitCliMissing } from "../utils/exit.mjs";

const NAME = path.basename(fileURLToPath(import.meta.url));

// 对齐 cdd-common.sh 的 `${CDD_PENDING_ROOT:-${TMPDIR:-/tmp}/oscaner-engineering/pending-cdd}`
// 与 gate core 的 pendingPathFor（空串回退默认）。CDD_SESSION_MODE 用 `??`（空串视为显式空）。
const PENDING_ROOT = process.env.CDD_PENDING_ROOT?.trim()
  || path.join(process.env.TMPDIR?.trim() || "/tmp", "oscaner-engineering", "pending-cdd");

const args = process.argv.slice(2);
const subcommand = args[0] ?? "";
const sessionKey = args[1] ?? "";
const repoRoot = args[2] ?? "";
const planPath = args[3] ?? "";
const workspace = args[4] ?? "";

function usage() {
  process.stderr.write(
    `usage: ${NAME} minimal <session_key> <repo_root> [--mode <in-session|subagent|cli>]\n`,
  );
  process.stderr.write(
    `       ${NAME} bind <session_key> <repo_root> <plan_path> <workspace> [--mode <in-session|subagent|cli>]\n`,
  );
  exitCliMissing();
}

// 模式感知：--mode 优先于 CDD_SESSION_MODE env；遍历全部 args（对齐 bash while $*，位置参数后置）。
let sessionMode = process.env.CDD_SESSION_MODE ?? "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--mode") {
    if (i + 1 >= args.length) usage();
    sessionMode = args[++i];
  } else if (args[i].startsWith("--mode=")) {
    sessionMode = args[i].slice("--mode=".length);
  }
}

// 模式枚举单一来源：in-session|subagent|cli（spec §E）。空 → fail-open（pending 省略 mode）。
if (!["", "in-session", "subagent", "cli"].includes(sessionMode)) {
  process.stderr.write(`error: invalid mode: ${sessionMode} (expected in-session|subagent|cli)\n`);
  exitCliMissing();
}

if (!subcommand || !sessionKey || !repoRoot) usage();

function safeParse(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

const pendingPath = path.join(PENDING_ROOT, `${sessionKey}.json`);
const now = Math.floor(Date.now() / 1000);

mkdirSync(PENDING_ROOT, { recursive: true });

if (subcommand === "minimal") {
  const obj = {
    trigger: "cdd-orchestrator",
    detected_at: now,
    session_key: sessionKey,
    repo_root: repoRoot,
  };
  if (sessionMode) obj.mode = sessionMode;
  writeFileSync(pendingPath, `${JSON.stringify(obj)}\n`);
} else if (subcommand === "bind") {
  if (!planPath || !workspace) usage();
  const existing = existsSync(pendingPath) ? safeParse(pendingPath) : null;
  // 保留既有会话模式（hook 已写 --mode cli）；显式 --mode/env 优先。省略 --mode 的
  // rebind 保留 prior pending.mode —— 保护 cli 严格性不被无意识 rebind 冲掉。
  let mode = sessionMode;
  if (existing && !mode) {
    mode = typeof existing.mode === "string" ? existing.mode : "";
  }
  // 对齐 bash bind 分支：existing 用 base 字段回退（detected_at // 0、session_key // ""），
  // fresh 用位置参数 + now。
  const obj = existing
    ? {
        trigger: existing.trigger ?? "cdd-orchestrator",
        detected_at: existing.detected_at ?? 0,
        session_key: existing.session_key ?? "",
        repo_root: existing.repo_root ?? "",
        plan_path: planPath,
        workspace,
        active_task: null,
      }
    : {
        trigger: "cdd-orchestrator",
        detected_at: now,
        session_key: sessionKey,
        repo_root: repoRoot,
        plan_path: planPath,
        workspace,
        active_task: null,
      };
  if (mode) obj.mode = mode;
  writeFileSync(pendingPath, `${JSON.stringify(obj)}\n`);
} else {
  usage();
}

exitOk();
