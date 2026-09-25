#!/usr/bin/env node

/**
 * Repo automation dispatcher — the single top-level entry for scripts/.
 * citty command surface (Task 21; engine src/cli/parse.ts isomorphism): ONE
 * defineCommand tree (mainCommand with the seven subcommands emit / emit-check /
 * validate / precommit / smoke-cdd / version / apply-rules), each subcommand
 * assembled from a `Command` instance (scripts/lib/command.ts) with its kind
 * declared by the invocation contract, and subcommand handlers lazy-loading via
 * dynamic import — each command's dependency graph loads only on first use.
 *
 * This file is the composition root (Task 9): it declares the seven Command
 * instances as data (CommandMeta) and assembles mainCommand — no inline command
 * factory, no forwarding shell (a forwarding shell = a defect — delete it; assembly/invoke/meta live in
 * the Command class, Criterion ⑤).
 *
 * Exit-code table (P5 §2.4.2, engine parity): 0 = OK (incl. --help); 1 = command
 * failure; 2 = usage/parse error. `--help` is pre-screened (deepest matched
 * command's usage rendered from the citty declarations, plain-texted, exit 0)
 * and parse/usage errors (citty CLIError — unknown command, missing required
 * positional) normalize to exit 2 — citty's own parse errors exit 1, so this
 * wrapper is what keeps the documented table intact (same judgment as
 * packages/cdd-engine/src/bin.ts).
 *
 * The tree is exported for the colocated CLI test (scripts/__tests__/run.test.ts);
 * the executable boots only when run directly (isMain guard — see the bottom of
 * the file).
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandDef, SubCommandsDef } from "citty";
import { defineCommand, renderUsage, runCommand } from "citty";

import { Command, type CommandMeta } from "./lib/command.ts";

// citty renders usage/help with ANSI color — this entry prints plain text (Commander-era parity +
// deterministic test surface). Stripping happens at the two print points below, never via env
// mutation.
// plain()/ANSI_RE duplicate engine src/bin.ts's by design: importing bin.ts boots its signal
// handlers + main(), and parse.ts pulls the whole dispatch graph — both defeat the lazy-load
// requirement (Task 21 ①). This copy is the fuller CSI/OSC pattern (citty emits title-escapes);
// keep the two in sync.
const ANSI_RE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: citty emits ANSI escapes (ESC/CSI charset) — control characters are the regex's entire domain; no control-free representation exists.
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
function plain(text: unknown): string {
  return String(text).replace(ANSI_RE, "");
}

// ---- composition root (Task 9): the seven subcommands as Command instances ----
// CommandMeta is data (the brief's meta facet); assemble/invoke live on the Command class. The
// modulePath is the lazy import target — the subcommand's dependency graph loads only on invoke.
const SUBCOMMANDS: CommandMeta[] = [
  {
    name: "emit",
    description: "regenerate unified first-party manifests",
    modulePath: "./emit/all.ts",
    kind: "none",
  },
  {
    name: "emit-check",
    description: "verify emitted products are fresh (drift → exit 1)",
    modulePath: "./emit/check.ts",
    kind: "none",
  },
  {
    name: "validate",
    description: "run the full validate suite (11 blocks)",
    modulePath: "./validate/index.ts",
    kind: "none",
  },
  {
    name: "precommit",
    description:
      "run the tree-independent pre-commit subset (emit/osuperpowers/residue/marketplace/unit/version-sync)",
    modulePath: "./validate/pre-commit.ts",
    kind: "none",
  },
  {
    name: "smoke-cdd",
    description:
      "run the cdd-engine consumer-sim (build → pack → consumer install → 5-command dry-run chain)",
    modulePath: "./validate/smoke-cdd.ts",
    kind: "none",
  },
  {
    name: "version",
    description: "apply changesets to bump versions (--dry-run supported)",
    modulePath: "./release/version-packages.ts",
    kind: "dry-run",
  },
  {
    name: "apply-rules",
    description: "apply a GitHub branch Ruleset (protect-develop | protect-main)",
    modulePath: "./rulesets/apply.ts",
    kind: "target",
  },
];

export const mainCommand = defineCommand({
  meta: {
    name: "run",
    description: "repo automation",
  },
  args: {},
  subCommands: Object.fromEntries(
    SUBCOMMANDS.map((meta) => [meta.name, new Command(meta, import.meta.url).assemble()]),
  ) as SubCommandsDef,
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
  process.stderr.write(
    `${name ? `usage: run ${name} [options]` : "usage: run <command> [options]"}\n`,
  );
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  // `--help` / `-h` at ANY position is handled BEFORE any dispatch (a subcommand dependency
  // graph must not load for a help request): renders the deepest matched command's usage from
  // the citty declarations, plain-texted, exit 0.
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    const [cmd, parent] = await deepestCommand(rawArgs);
    process.stdout.write(`${plain(await renderUsage(cmd, parent))}\n`);
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

// Executable entry (tests import the tree only — main must not run under vitest).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
