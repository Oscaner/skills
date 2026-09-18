#!/usr/bin/env node
/**
 * Repo automation dispatcher — the single top-level entry for scripts/.
 * citty command surface (Task 21; engine src/cli/parse.ts isomorphism): ONE
 * defineCommand tree (mainCommand with the six subcommands emit / emit-check /
 * validate / smoke-cdd / version / apply-rules), each subcommand's argsDef
 * declared citty, and subcommand handlers lazy-loading via dynamic import — each
 * command's dependency graph loads only on first use.
 *
 * Exit-code table (P5 §2.4.2, engine parity): 0 = OK (incl. --help); 1 = command
 * failure; 2 = usage/parse error. `--help` is pre-screened (deepest matched
 * command's usage rendered from the citty declarations, plain-texted, exit 0)
 * and parse/usage errors (citty CLIError — unknown command, missing required
 * positional) normalize to exit 2 — citty's own parse errors exit 1, so this
 * wrapper is what keeps the documented table intact (same judgment as
 * packages/cdd-engine/src/bin.ts).
 *
 * The tree + invocation mapper are exported for the colocated CLI test
 * (scripts/__tests__/run.test.ts); the executable boots only when run directly
 * (isMain guard — see the bottom of the file).
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { defineCommand, renderUsage, runCommand } from "citty";
import type { CommandDef, SubCommandsDef } from "citty";

// citty renders usage/help with ANSI color — this entry prints plain text (Commander-era parity +
// deterministic test surface). Stripping happens at the two print points below, never via env
// mutation.
// plain()/ANSI_RE duplicate engine src/bin.ts's by design: importing bin.ts boots its signal
// handlers + main(), and parse.ts pulls the whole dispatch graph — both defeat the lazy-load
// requirement (Task 21 ①). This copy is the fuller CSI/OSC pattern (citty emits title-escapes);
// keep the two in sync.
const ANSI_RE = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
function plain(text: unknown): string {
  return String(text).replace(ANSI_RE, "");
}

// Subcommand value passing — the contract between the run() handlers and the lazily-loaded module
// mains (exported for the colocated test; the args here are the parsed citty args named by the
// subcommand's own argsDef):
//   "none"    → main() — zero-arg mains (emit/emit-check/validate/smoke-cdd must never see an
//              options object in that slot);
//   "dry-run" → main({ dryRun }) — version's destructured option (presence-based boolean: absent
//              → false, present → true);
//   "target"  → main(target) — apply-rules' single mandatory positional.
export function invocationArgs(kind: "none" | "dry-run" | "target", args: Record<string, unknown>): unknown[] {
  switch (kind) {
    case "none":
      return [];
    case "dry-run":
      return [{ dryRun: args["dry-run"] === true }];
    case "target":
      return [args.target];
  }
}

function command(name: string, description: string, mod: string, kind: "none" | "dry-run" | "target") {
  return defineCommand({
    meta: { name, description },
    args:
      kind === "dry-run"
        ? { "dry-run": { type: "boolean", description: "preview without writing" } }
        : kind === "target"
          ? { target: { type: "positional", description: "protect-develop | protect-main" } }
          : {},
    run: async ({ args }) => {
      const code = await import(mod).then((m) => m.main(...invocationArgs(kind, args as Record<string, unknown>)));
      // A numeric return is an exit code (validate/version/apply-rules main → 1 on failure);
      // undefined returners (emit/emit-check/smoke-cdd) rely on the top-level catch for non-zero.
      if (typeof code === "number") process.exitCode = code;
    },
  });
}

export const mainCommand = defineCommand({
  meta: {
    name: "run",
    description: "repo automation",
  },
  args: {},
  subCommands: {
    emit: command("emit", "regenerate unified first-party manifests", "./emit/all.ts", "none"),
    "emit-check": command("emit-check", "verify emitted products are fresh (drift → exit 1)", "./emit/check.ts", "none"),
    validate: command("validate", "run the full validate suite (12 blocks)", "./validate/index.ts", "none"),
    "smoke-cdd": command("smoke-cdd", "run cdd-engine dry-run smoke (4-command H1 chain)", "./validate/smoke-cdd.ts", "none"),
    version: command("version", "apply changesets to bump versions (--dry-run supported)", "./release/version-packages.ts", "dry-run"),
    "apply-rules": command("apply-rules", "apply a GitHub branch Ruleset (protect-develop | protect-main)", "./rulesets/apply.ts", "target"),
  },
});

// ---- deepest-command resolution (help / usage-error context) ----
// citty's runMain keeps an internal resolveSubCommand (not exported); this wrapper needs the same
// resolution to know WHICH command's usage to render / key on error. run.ts has no program-level
// value flags and no nested subcommands, so the first non-flag token (before `--`) is the
// subcommand name — replicate the engine parse.ts subcommandIndex shape for this tree.
function subcommandIndex(rawArgs: string[]): number {
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--") return -1; // everything after -- is positional
    if (arg.startsWith("-")) continue;
    return i;
  }
  return -1;
}

async function deepestCommand(
  rawArgs: string[],
): Promise<[CommandDef<any>, CommandDef<any> | undefined]> {
  const subCommands = (mainCommand.subCommands ?? {}) as SubCommandsDef;
  const idx = subcommandIndex(rawArgs);
  const name = idx >= 0 ? rawArgs[idx] : undefined;
  if (name && Object.hasOwn(subCommands, name)) {
    return [subCommands[name] as CommandDef<any>, mainCommand];
  }
  return [mainCommand, undefined];
}

function usageError(command: CommandDef<any> | undefined): void {
  const name = (command?.meta as { name?: string } | undefined)?.name;
  process.stderr.write((name ? `usage: run ${name} [options]` : "usage: run <command> [options]") + "\n");
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  // `--help` / `-h` at ANY position is handled BEFORE any dispatch (a subcommand dependency
  // graph must not load for a help request): renders the deepest matched command's usage from
  // the citty declarations, plain-texted, exit 0.
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    const [cmd, parent] = await deepestCommand(rawArgs);
    process.stdout.write(plain(await renderUsage(cmd, parent)) + "\n");
    process.exit(0);
  }

  try {
    await runCommand(mainCommand, { rawArgs });
  } catch (raw: unknown) {
    const e = raw as { message?: unknown; name?: unknown };
    // citty parse/usage errors (CLIError — unknown command / missing required positional):
    // the resolved command's usage line + the citty message, exit 2 (§2.4.2).
    if (e && e.name === "CLIError") {
      const [cmd] = await deepestCommand(rawArgs);
      usageError(cmd === mainCommand ? undefined : cmd);
      process.stderr.write(`${plain(e.message)}\n`);
      process.exit(2);
    }
    // Command failure — the handler's own error, exit 1.
    process.stderr.write(`${e?.message ?? String(e)}\n`);
    process.exit(1);
  }
}

// Executable entry (tests import the tree + invocationArgs only — main must not run under vitest).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}