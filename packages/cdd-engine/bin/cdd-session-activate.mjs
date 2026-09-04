#!/usr/bin/env node
// bin/cdd-session-activate.mjs — write pending-cdd JSON for CDD orchestrator sessions.
// Commander.js v15 port of the legacy cdd-session-activate CLI (spec §E mode-aware):
//   cdd-session-activate minimal <session_key> <repo_root> [--mode <in-session|subagent|cli>]
//   cdd-session-activate bind <session_key> <repo_root> <plan_path> <workspace> [--mode <in-session|subagent|cli>]
// --mode wins over CDD_SESSION_MODE env; empty → fail-open (mode omitted); invalid → exit 2
// without writing. bind-existing without --mode preserves the prior pending.mode.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { exitOk, exitCliMissing } from './utils/exit.mjs';

const VALID_MODES = ['in-session', 'subagent', 'cli'];

// Aligns cdd-common.sh `${CDD_PENDING_ROOT:-${TMPDIR:-/tmp}/osuperpowers/pending-cdd}` and the
// gate core's pendingPathFor. CDD_SESSION_MODE uses `??` (empty string is an explicit empty).
const PENDING_ROOT = process.env.CDD_PENDING_ROOT?.trim()
  || path.join(process.env.TMPDIR?.trim() || '/tmp', 'osuperpowers', 'pending-cdd');

function usage() {
  process.stderr.write('usage: cdd-session-activate minimal <session_key> <repo_root> [--mode <in-session|subagent|cli>]\n');
  process.stderr.write('       cdd-session-activate bind <session_key> <repo_root> <plan_path> <workspace> [--mode <in-session|subagent|cli>]\n');
}

function safeParse(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Shared minimal/bind writer — mirrors the legacy performActivate logic.
// mode: '' (fail-open, omitted) | 'in-session' | 'subagent' | 'cli'.
function performActivate({ subcommand, sessionKey, repoRoot, planPath, workspace, mode }) {
  // 模式枚举单一来源：in-session|subagent|cli（spec §E）。空 → fail-open（pending 省略 mode）。
  if (!['', ...VALID_MODES].includes(mode)) {
    process.stderr.write(`error: invalid mode: ${mode} (expected in-session|subagent|cli)\n`);
    exitCliMissing();
  }

  const pendingPath = path.join(PENDING_ROOT, `${sessionKey}.json`);
  const now = Math.floor(Date.now() / 1000);

  mkdirSync(PENDING_ROOT, { recursive: true });

  if (subcommand === 'minimal') {
    const obj = {
      trigger: 'cdd-orchestrator',
      detected_at: now,
      session_key: sessionKey,
      repo_root: repoRoot,
    };
    if (mode) obj.mode = mode;
    writeFileSync(pendingPath, `${JSON.stringify(obj)}\n`);
  } else if (subcommand === 'bind') {
    const existing = existsSync(pendingPath) ? safeParse(pendingPath) : null;
    // 保留既有会话模式（hook 已写 --mode cli）；显式 --mode/env 优先。省略 --mode 的
    // rebind 保留 prior pending.mode —— 保护 cli 严格性不被无意识 rebind 冲掉。
    let m = mode;
    if (existing && !m) {
      m = typeof existing.mode === 'string' ? existing.mode : '';
    }
    const obj = existing
      ? {
          trigger: existing.trigger ?? 'cdd-orchestrator',
          detected_at: existing.detected_at ?? 0,
          session_key: existing.session_key ?? '',
          repo_root: existing.repo_root ?? '',
          plan_path: planPath,
          workspace,
          active_task: null,
        }
      : {
          trigger: 'cdd-orchestrator',
          detected_at: now,
          session_key: sessionKey,
          repo_root: repoRoot,
          plan_path: planPath,
          workspace,
          active_task: null,
        };
    if (m) obj.mode = m;
    writeFileSync(pendingPath, `${JSON.stringify(obj)}\n`);
  } else {
    usage();
  }

  exitOk();
}

const program = new Command();
program
  .name('cdd-session-activate')
  .description('Write pending-cdd JSON for CDD orchestrator sessions (spec §E mode-aware)');

const minimalCmd = program
  .command('minimal <sessionKey> <repoRoot>')
  .description('write a minimal pending record (session_key + repo_root)')
  .option('--mode <mode>', 'in-session|subagent|cli (default: CDD_SESSION_MODE env, omitted when unset)')
  .action((sessionKey, repoRoot, opts) => {
    performActivate({
      subcommand: 'minimal',
      sessionKey,
      repoRoot,
      mode: opts.mode ?? process.env.CDD_SESSION_MODE ?? '',
    });
  });

const bindCmd = program
  .command('bind <sessionKey> <repoRoot> <planPath> <workspace>')
  .description('write/extend a bound pending record (plan_path + workspace)')
  .option('--mode <mode>', 'in-session|subagent|cli (default: CDD_SESSION_MODE env, prior mode on rebind)')
  .action((sessionKey, repoRoot, planPath, workspace, opts) => {
    performActivate({
      subcommand: 'bind',
      sessionKey,
      repoRoot,
      planPath,
      workspace,
      mode: opts.mode ?? process.env.CDD_SESSION_MODE ?? '',
    });
  });

// Only parse argv when executed as the main entry (imports from tests must be inert).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  program.exitOverride();
  minimalCmd.exitOverride();
  bindCmd.exitOverride();
  // Silence Commander's own error lines (subcommands included) — usage is printed below.
  program.configureOutput({ outputError: () => {} });
  minimalCmd.configureOutput({ outputError: () => {} });
  bindCmd.configureOutput({ outputError: () => {} });
  program.parseAsync(process.argv).catch((e) => {
    if (e.code === 'commander.helpDisplayed') {
      exitOk();
    }
    if (typeof e.code === 'string' && e.code.startsWith('commander.')) {
      usage();
    } else {
      process.stderr.write(`${e.message}\n`);
    }
    exitCliMissing();
  });
}