#!/usr/bin/env node
// bin/cdd-select.mjs — detect installed harness CLIs + recommended default.
// Commander.js v15 (help + arg container); cdd-select takes no explicit args, so the
// detection logic runs as the parse() side effect below. Prints:
//   available: <csv of channel=install-and-use AND command -v found>
//   unsupported_installed: <csv of non-install-and-use AND found>
//   recommended: <name>
// BLOCKED (exit 1) when no full harness is installed.
import { Command } from 'commander';
import { detectInstalledHarnesses } from './utils/harness-detect.mjs';
import { config } from './utils/skills-probe.config.mjs';
import { exitBlocked, exitCliMissing } from './utils/exit.mjs';

// Note: cdd-select forwards harness-detect from osuperpowers utils (migrated into
// the import path may need adjustment.

const program = new Command();
program
  .name('cdd-select')
  .description('Detect installed harness CLIs and recommend default')
  .action(() => { /* no-op: action defined by program.parse() side effect below */ });

program.exitOverride();
program.configureOutput({ outputError: () => {} });
try {
  program.parse(process.argv);
} catch (e) {
  if (typeof e.code === 'string' && e.code.startsWith('commander.')) {
    process.stderr.write('usage: cdd-select [--help]\n');
    exitCliMissing();
  }
  throw e;
}

// detect_current_harness：CURSOR_TRACE_ID → cursor-agent；CLAUDE_CODE_SESSION_ID → claude；
// AI_AGENT=claude-code* → claude；否则空。
function detectCurrentHarness(env) {
  if (env.CURSOR_TRACE_ID) return 'cursor-agent';
  if (env.CLAUDE_CODE_SESSION_ID) return 'claude';
  if ((env.AI_AGENT ?? '').startsWith('claude-code')) return 'claude';
  return '';
}

const detected = detectInstalledHarnesses(config, { env: process.env });
const available = detected.filter((h) => h.installed && h.channel === 'install-and-use').map((h) => h.name);
const unsupported = detected.filter((h) => h.installed && h.channel !== 'install-and-use').map((h) => h.name);

if (available.length === 0) {
  process.stdout.write('available:\n');
  process.stdout.write(`unsupported_installed:${unsupported.join(',')}\n`);
  process.stdout.write('recommended:\n');
  process.stderr.write(`BLOCKED: no full harness installed (registry: ${detected.map((h) => h.name).join(' ')} )\n`);
  exitBlocked();
}

// 推荐优先级: droid > pi > 当前 harness(full) > 字母序第一个可用。
let recommended = '';
if (available.includes('droid')) {
  recommended = 'droid';
} else if (available.includes('pi')) {
  recommended = 'pi';
} else {
  const current = detectCurrentHarness(process.env);
  if (current && available.includes(current)) recommended = current;
  else recommended = available[0];
}

process.stdout.write(`available:${available.join(',')}\n`);
process.stdout.write(`unsupported_installed:${unsupported.join(',')}\n`);
process.stdout.write(`recommended:${recommended}\n`);