#!/usr/bin/env node
// src/bin.ts — CDD engine CLI entry (spec §2.3; citty surface from Task 9, retired commander).
// The full command tree lives in src/cli/parse.ts as one citty defineCommand (mainCommand with
// the five subcommands implement / review / fix / base-branch [set|get] / help). This file only
// boots it: `--help` pre-screen → `cdd help` discovery intercept → root/proc bootstrap →
// runCommand → parse/usage error normalization (exit code table §2.4.2: 0 = OK incl. --help;
// 1 = dispatch failure / blocked; 2 = usage or parse error; 3 = review convergence — citty's own
// parse errors exit 1, so this wrapper is what keeps the subroutine's documented table intact).
//   cdd implement --task <n> [--plan <path>]
//   cdd review --type <task|branch|spec|plan> [...]
//   cdd fix --type <task|spec|plan> [...]
//   cdd base-branch <set|get> --plan <path> [...]
//   cdd help
//
// Unconditional boot (no isMain guard): this artifact is only ever executed directly by node as
// the CLI entry (package.json bin/main/exports all point at dist/cli.mjs; no library consumer
// import surface). `unbuild --stub`'s dist/cli.mjs jiti-loads this file at runtime, argv[1] points
// into dist/ while import.meta.url points into src/, so the import.meta.url main check is always
// false — unconditional boot is the only reliable way (Task 1 §4.2 placeholder forwarding, same
// judgment). The leading #! makes the artifact (both build and stub shapes) directly runnable
// without a node prefix (unbuild passes it through natively, Task 1 §4.6).
//
// process.cwd single-site anchor: the initRoot call below is the ONLY production cwd read in
// engine src/ (validate's channel audit ① pins it here since the P5 infra/root.mjs retirement
// moved the anchor out of src/infra/root.ts).
import process from "node:process";
import path from "node:path";

import { parseArgs, renderUsage, runCommand } from "citty";
import { initProcLifecycle, reapStale, teardownAll } from "./infra/proc.ts";
import { mainCommand, MAIN_ARGS, usageError, commandUsageKey, deepestCommand } from "./cli/parse.ts";
import { runHelp } from "./cli/help.ts";
import { setDryRun } from "./cli/shared.ts";
import { initRoot } from "./infra/root.ts";
import { ExitRequested, CddExitError } from "./infra/exit.ts";

// citty renders usage/help with ANSI color — this entry prints plain text (commander-era parity +
// deterministic test surface). Stripping happens at the two print points below, never via env
// mutation (the engine's env surface guard pins zero non-whitelisted reads).
const ANSI_RE = /\u001B\u009B[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
function plain(text: unknown): string {
  return String(text).replace(ANSI_RE, "");
}

// Signal-safe exit: SIGINT/SIGTERM/SIGHUP → teardownAll → exit with the signal-mapped code.
// Exit code = 128 + signo, matching the shell convention (SIGINT=2→130, SIGTERM=15→143,
// SIGHUP=1→129) — a blanket 130 only holds for SIGINT; SIGTERM/SIGHUP each need their own
// 128+signo, never the shared constant 130.
const SIGNAL_EXIT = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
// Signal latch: set SYNCHRONOUSLY at signal entry (before any await) so the single exit mapping
// below can turn "signal arrived while the run was already tearing down" into the signal-mapped
// code even when the run-boundary's own exit wins the process.exit race (both the handler and the
// run-boundary ExitRequested unwind await teardownAll() concurrently; without the latch the normal
// path's exit code — e.g. a docs-review non-zero result — could clobber 128+signo).
let signalExitCode: number | null = null;
/** Single exit mapping: a caught signal always wins over the run's exit code (128+signo). */
function finalExit(code: number): never {
  process.exit(signalExitCode ?? code);
}
for (const [sig, code] of Object.entries(SIGNAL_EXIT)) {
  process.on(sig, async () => {
    signalExitCode = code;
    process.stderr.write(`CDD: caught ${sig} — teardownAll + exit ${code}\n`);
    try { await teardownAll({ graceMs: 2000 }); } finally { finalExit(code); }
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);

  // `--help` / `-h` at ANY position is handled BEFORE the root bootstrap: cdd --help must exit 0
  // even outside a git repo (§2.4.2; root.test.mjs). Renders the deepest matched command's usage
  // from the citty declarations (deepestCommand → renderUsage), plain-texted.
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    const [cmd, parent] = await deepestCommand(rawArgs);
    const rendered = await renderUsage(cmd, parent);
    process.stdout.write(plain(rendered) + "\n");
    finalExit(0);
  }

  // `cdd help` — P2 discovery subcommand (overall v1.10 Non-goal#1 carve-out: the engine's ONE new
  // subcommand, zero enforcement logic — no audit, no exit-semantics change). Intercepted BEFORE the
  // root bootstrap like the `--help` pre-screen: pure resource discovery works outside git repos and
  // writes no lifecycle state (initRoot's repo gate / initProcLifecycle's lifecycle.json persist both
  // stay out of its path). RunHelp prints the CLI directory + the required doc-resource directories
  // (canonical schemas / templates), each verified to exist at render time. The declared citty help
  // command (parse.ts) is the surface fallback for --help/usage rendering; this intercept is what
  // runs in production.
  const firstCommand = rawArgs.find((a) => !a.startsWith("-"));
  if (firstCommand === "help") {
    runHelp();
    finalExit(0);
  }

  // Boot (the former commander preAction hook, the action precondition): program-level `--dry-run`
  // resolves position-independent from the FULL argv (parseArgs over the main args def tolerates
  // the subcommand surface), then the engine root + process lifecycle are initialized once per run.
  // Flow: cross-run sweep at startup (reap orphan groups a previous engine left behind after
  // SIGKILL/crash) + signal-safe exit (spec §2.2 A / §2.6). The lifecycle path is pure derivation:
  // fixed relative paths under the single root authority (src/infra/root.ts, anchored via the
  // initRoot(cwd) call here) — no env override seam, no other cwd reads (P4 §2.4.1).
  try {
    // Program-level --dry-run from the FULL argv (parseArgs is tolerant of the subcommand
    // surface; only the program-level key is read here). MAIN_ARGS is the same plain object the
    // tree's argument declaration uses — single source for the boot read (parse.ts imports the
    // plain def via the concrete ArgsDef shape parseArgs expects).
    const bootArgs = parseArgs(rawArgs, MAIN_ARGS as unknown as Parameters<typeof parseArgs>[1]);
    setDryRun(bootArgs["dry-run"] === true);
  } catch (e: unknown) {
    if (e instanceof ExitRequested) finalExit(e.code);
    process.stderr.write(`${(e as { message?: unknown })?.message ?? String(e)}\n`);
    finalExit(2);
  }
  const repoRoot = await initRoot(process.cwd());
  initProcLifecycle({ diskPath: path.join(repoRoot, ".osuperpowers", "cdd", "lifecycle.json") });
  await reapStale({ graceMs: 2000 });   // startup sweep: root orphan groups across runs (before any action / dispatch)

  try {
    await runCommand(mainCommand, { rawArgs });
  } catch (raw: unknown) {
    // Normal run* exit path: exit helpers throw ExitRequested (unwinding the run-boundary
    // try/finally → teardownAll first), intercepted here → process.exit(code). Direct
    // process.exit is boundary semantics: no finally left to unwind. Without it, spec §2.2 B
    // "root reap at the run boundary" would be dead code on the CLI mainline (the process exit
    // does not unwind our own finally blocks).
    if (raw instanceof ExitRequested) finalExit(raw.code);
    // The CddExitError family (P6 T24, F error consolidation): orchestration errors (registry gate /
    // DispatchBlocked / RunBlocked / usage) all land here and exit by their own exitCode. The
    // kind=usage face (shared.ts guardArgs/intTask → cliUsageError) keeps the citty-usage parity:
    // usage line (the resolved command context via deepestCommand) + message + exit 2. All other
    // kinds → message + exit raw.exitCode (1 = blocked / run-blocked; the code is the family's
    // field, never recomputed here — the 0/1/2/3 table is the family's contract).
    if (raw instanceof CddExitError) {
      if (raw.kind === "usage") {
        const [cmd, parent] = await deepestCommand(rawArgs);
        usageError(commandUsageKey(cmd, parent));
        process.stderr.write(`${plain(raw.message)}\n`);
      } else {
        process.stderr.write(`${plain(raw.message)}\n`);
      }
      finalExit(raw.exitCode);
    }
    const e = raw as { message?: unknown; name?: unknown };
    // citty parse/usage errors (CLIError name — citty's own parse errors, outside the engine
    // family): the usage line (the resolved command context via deepestCommand) + message + exit 2.
    if (e && e.name === "CLIError") {
      const [cmd, parent] = await deepestCommand(rawArgs);
      usageError(commandUsageKey(cmd, parent));
      process.stderr.write(`${plain(e.message)}\n`);
    } else {
      // Non-CLIError action/arg errors (e.g. a library invariant escaping its caller — the plain
      // Error invariant() throws) — existing semantics unified to exit 2.
      process.stderr.write(`${e?.message ?? String(e)}\n`);
    }
    finalExit(2);
  }
}

main();
