// packages/cdd-engine/src/cli/parse.ts — citty command surface (Task 9; spec §2.3. The commander
// program definition is retired — the full command tree lives here as ONE citty defineCommand
// (mainCommand) with its six subcommands declared as citty subCommands: implement / review / fix,
// base-branch with its nested set|get surface, the discovery pair schema (get) and help. Each action
// run() assembles the DispatchLifecycle subclass
// (TaskLifecycle / DocsLifecycle via runTask / runDocsTask / runBranchReview) and guards its flag
// surface (guardArgs, src/cli/shared.ts). src/bin.ts boots this tree: runCommand + the
// --help pre-screen + parse/usage error normalization (exit code table §2.4.2) — the subcommand
// usage lines (SUBCOMMAND_USAGE) still print for usage errors, while the `--help` surface renders
// from these declarations via citty renderUsage.
//
// This file is statically readable by tests (cli-shape) and imports trigger no side effects —
// runCommand is only invoked by the bin thin entry.
import { defineCommand } from "citty";
import type { ArgsDef, CommandDef, CommandMeta, SubCommandsDef } from "citty";

import { runReview } from "./review.ts";
import { runFix } from "./fix.ts";
import { runBaseBranchSet, runBaseBranchGet } from "./base-branch.ts";
import { runSchemaGet } from "./schema.ts";
import { runHelp } from "./help.ts";
import { requireHostHarness, guardArgs, parseTaskList, DRY_RUN } from "./shared.ts";

// Per-subcommand usage lines (print on parse/usage errors in place of citty's own error text;
// the commander-era wording is kept — the black-box face contracts pin it). Program-level
// --dry-run does NOT appear here: it is declared on the main command only.
const SUBCOMMAND_USAGE: Record<string, string> = {
  implement: "usage: cdd implement --tasks <n|n,n,…> [--plan <path>]",
  review: "usage: cdd review --type <task|branch|spec|plan> [--tasks <n|n,n,…>] (--plan <path> | --spec <path>) [--base <sha> --head <sha>] [--round <n>]",
  fix: "usage: cdd fix --type <task|branch|spec|plan> [--tasks <n|n,n,…>] [--findings <path>] (--plan <path> | --spec <path>)",
  // base-branch: a bad flag / unknown subcommand inside set|get resolves to this single-word key
  // (the bin wrapper maps a nested citty leaf to its parent command — see commandUsageKey).
  "base-branch": "usage: cdd base-branch <set|get> --plan <path> [set: --base <branch> --source <source>] [--force]",
  // help is the engine's one discovery subcommand (overall v1.10 Non-goal#1 carve-out — the only
  // new subcommand in the P2 program).
  help: "usage: cdd help",
  // schema — discovery: the canonical doc-structure schema printer (P4.3 Task 5). A nested leaf
  // (get) resolves to this key via commandUsageKey's parent mapping (same as base-branch set|get).
  schema: "usage: cdd schema get <type>",
};

// Print the usage line for the resolved parse/usage-error context; default = the top-level line.
export function usageError(command: string | null): void {
  process.stderr.write((Object.hasOwn(SUBCOMMAND_USAGE, command ?? "") ? SUBCOMMAND_USAGE[command ?? ""] : "usage: cdd <command> [options]") + "\n");
}

// The citty types model meta as Resolvable<CommandMeta> (T | Promise<T> | ()=>T); this tree
// always declares metas as plain objects, so unwrap the union for the narrow name read.
function metaName(def: CommandDef<any> | undefined): string | null {
  const meta = def?.meta as CommandMeta | undefined;
  return meta?.name ?? null;
}

// Map a resolveSubCommand result to its SUBCOMMAND_USAGE key: a nested citty leaf (set|get) maps
// to its parent command key (base-branch), a direct child maps to itself, the root maps to null
// (→ the default "usage: cdd <command> [options]" line).
export function commandUsageKey(cmd: CommandDef<any>, parent: CommandDef<any> | undefined): string | null {
  if (parent && parent !== mainCommand) return metaName(parent);
  if (cmd !== mainCommand) return metaName(cmd);
  return null;
}

// ---- deepest-command resolution (help / usage-error context) ----
// citty's runMain keeps an internal resolveSubCommand (not exported); the bin wrapper needs the
// same deep resolution to know WHICH command's usage to render / key on error. Replicates the
// matching semantics for our tree: the first non-flag position (skipping value-flag values) is
// looked up in subCommands, recursing into the match. Returns [deepestCmd, parentCmd].
function subcommandIndex(rawArgs: string[], argDef: ArgsDef | undefined): number {
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--") return -1;               // everything after -- is positional
    if (arg.startsWith("-")) {
      const name = arg.replace(/^-{1,2}/, "").split("=")[0];
      const isValue = Object.entries(argDef ?? {}).some(([key, d]) =>
        (d.type === "string" || d.type === "enum") &&
        (name === key || (Array.isArray(d.alias) ? d.alias : d.alias ? [d.alias] : []).includes(name)));
      if (!arg.includes("=") && isValue) i++;  // skip the value token of a value flag
      continue;
    }
    return i;
  }
  return -1;
}

async function resolveDeepest(
  rawArgs: string[],
  cmd: CommandDef<any>,
  parent: CommandDef<any> | undefined,
): Promise<[CommandDef<any>, CommandDef<any> | undefined]> {
  const subCommands: SubCommandsDef = (cmd.subCommands as SubCommandsDef | undefined) ?? {};
  if (Object.keys(subCommands).length > 0) {
    const idx = subcommandIndex(rawArgs, cmd.args as ArgsDef | undefined);
    const name = idx >= 0 ? rawArgs[idx] : undefined;
    if (name && Object.hasOwn(subCommands, name)) {
      return resolveDeepest(rawArgs.slice(idx + 1), subCommands[name] as CommandDef<any>, cmd);
    }
  }
  return [cmd, parent];
}

export async function deepestCommand(
  rawArgs: string[],
  cmd: CommandDef<any> = mainCommand,
): Promise<[CommandDef<any>, CommandDef<any> | undefined]> {
  return resolveDeepest(rawArgs, cmd, undefined);
}

// ---- flags ----
// Arg keys are the kebab flag spellings (canonical channels.argv names, see
// engine-config.json#contextContract channels.argv) — the residue ⑨ guard reads these declarations
// as the help surface.

export const MAIN_ARGS = {
  // Program-level — the bin wrapper resolves it from the FULL argv (position-independent).
  "dry-run": { type: "boolean", description: "simulate without writing handoff artifacts" },
} as const;

// The citty types model args as Resolvable<T> (T | Promise<T> | ()=>T); guardArgs expects the
// concrete plain ArgsDef, which is exactly what each command declares.
function argsOf(def: CommandDef<any>): ArgsDef | undefined {
  return def.args as ArgsDef | undefined;
}

const implementCmd = defineCommand({
  meta: { name: "implement", description: "run the task implement phase (cdd implement)" },
  args: {
    tasks: { type: "string", required: true, valueHint: "n|n,n,…", description: "task number(s) — comma-separated list" },
    plan: { type: "string", valueHint: "path", description: "plan file path" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, argsOf(implementCmd));
    const harness = requireHostHarness();
    const { runTask } = await import("../dispatch/task.ts");
    // The --tasks value parses to the canonical task list — the dispatch group is the unit
    // (the whole group dispatches as one; handoff/brief/progress are group-keyed — P4.3).
    await runTask(harness, parseTaskList(args.tasks), {
      mode: "implement", dryRun: DRY_RUN(), planFile: args.plan,
    });
  },
});

const reviewCmd = defineCommand({
  meta: { name: "review", description: "run a review — task | branch | spec | plan (consolidates the former cdd-task / docs-task review modes)" },
  args: {
    type: { type: "string", required: true, valueHint: "task|branch|spec|plan", description: "review type" },
    tasks: { type: "string", valueHint: "n|n,n,…", description: "task number(s) — comma-separated list (type=task)" },
    plan: { type: "string", valueHint: "path", description: "plan path (type=task|branch; type=plan: review target)" },
    base: { type: "string", valueHint: "sha", description: "base commit (type=task|branch)" },
    head: { type: "string", valueHint: "sha", description: "head commit (type=task|branch)" },
    round: { type: "string", valueHint: "n", description: "round backfill (validate against engine auto-increment)" },
    spec: { type: "string", valueHint: "path", description: "spec document path (type=spec: review target; type=plan: upstream reference pointer)" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, argsOf(reviewCmd));
    const tasks = args.tasks != null ? parseTaskList(args.tasks) : undefined;
    await runReview({ ...args, tasks });
  },
});

const fixCmd = defineCommand({
  meta: { name: "fix", description: "fix review findings — task | branch | spec | plan (formerly cdd-task / docs-task fix modes)" },
  args: {
    type: { type: "string", required: true, valueHint: "task|branch|spec|plan", description: "fix type" },
    tasks: { type: "string", valueHint: "n|n,n,…", description: "task number(s) — comma-separated list (type=task)" },
    findings: { type: "string", valueHint: "path", description: "findings handoff path for this fix round" },
    spec: { type: "string", valueHint: "path", description: "spec document path (type=spec)" },
    plan: { type: "string", valueHint: "path", description: "plan path (type=task|branch|plan)" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, argsOf(fixCmd));
    const tasks = args.tasks != null ? parseTaskList(args.tasks) : undefined;
    await runFix({ ...args, tasks });
  },
});

// base-branch — pure artifact command (P5 spec §2.3): the single --plan target base-branch.json
// read/write; the nested set|get surface is declared as citty subCommands (no harness / lifecycle
// dependency).
const setCmd = defineCommand({
  meta: { name: "set", description: "write the base-branch artifact" },
  args: {
    base: { type: "string", valueHint: "branch", description: "base branch name" },
    source: { type: "string", valueHint: "source", description: "base-branch source (plan-field|branch-upstream|conversation-context|user-confirmed)" },
    plan: { type: "string", valueHint: "path", description: "plan file → resolveWorkspace(plan)" },
    force: { type: "boolean", description: "override an existing base-branch with a different base" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, argsOf(setCmd));
    await runBaseBranchSet(args);
  },
});

const getCmd = defineCommand({
  meta: { name: "get", description: "read the base-branch artifact" },
  args: {
    plan: { type: "string", valueHint: "path", description: "plan file → resolveWorkspace(plan)" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, argsOf(getCmd));
    await runBaseBranchGet(args);
  },
});

const baseBranchCmd = defineCommand({
  meta: { name: "base-branch", description: "read/write base-branch.json (single CDD --plan target)" },
  subCommands: { set: setCmd, get: getCmd },
});

// schema — discovery-only canonical schema output (P4.3 Task 5): `cdd schema get <type>` prints
// the requested doc-structure schema's canonical JSON byte-identical (the file content is the
// result face). The single positional `<type>` is the DOC_SCHEMA_NAMES registry — no new flag, so
// the canonical argv channel / residue ⑨ guard are untouched by this surface. Unknown type →
// cliUsageError → exit 2 + the registry enumeration (see cli/schema.ts); a missing type is citty's
// required-positional rejection, both normalized to the schema usage line by the bin wrapper.
const schemaGetCmd = defineCommand({
  meta: { name: "get", description: "print the canonical doc-structure schema for <type> (overall | plan | phase-spec | add-phase-protocol)" },
  args: {
    type: { type: "positional", required: true, description: "schema type — one of overall | plan | phase-spec | add-phase-protocol" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, argsOf(schemaGetCmd));
    runSchemaGet(args.type);
  },
});

const schemaCmd = defineCommand({
  meta: { name: "schema", description: "read canonical doc-structure schemas (discovery, zero enforcement)" },
  subCommands: { get: schemaGetCmd },
});

// `cdd help` — discovery subcommand (overall v1.10 Non-goal#1 carve-out: the P2 era's ONE new
// subcommand, zero enforcement logic). Prints the cdd CLI's absolute directory + the required
// doc-resource directories (schemas / templates). The bin thin entry intercepts `cdd help` before
// the root bootstrap (repo-independent, zero lifecycle writes); this declared command is the
// surface fallback and the `--help`/usage rendering face (landed in P2 T1 ②). The sibling
// discovery face `cdd schema get` (P4.3 Task 5) rides the normal bootstrap — only help is
// pre-boot intercepted.
const helpCmd = defineCommand({
  meta: { name: "help", description: "print CDD CLI + doc-resource directory discovery (schemas/templates)" },
  args: {},
  run: async ({ rawArgs }) => {
    guardArgs(rawArgs, argsOf(helpCmd));
    runHelp();
  },
});

// The single citty command tree — the only command surface the bin thin entry boots.
export const mainCommand = defineCommand({
  meta: {
    name: "cdd",
    description: "CDD engine CLI — implement/review/fix/base-branch/schema/help",
  },
  args: MAIN_ARGS,
  subCommands: {
    implement: implementCmd,
    review: reviewCmd,
    fix: fixCmd,
    "base-branch": baseBranchCmd,
    schema: schemaCmd,
    help: helpCmd,
  },
});
