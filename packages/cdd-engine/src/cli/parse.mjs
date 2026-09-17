// packages/cdd-engine/src/cli/parse.mjs — citty command surface (Task 9; spec §2.3. The commander
// program definition is retired — the full command tree lives here as ONE citty defineCommand
// (mainCommand) with its four subcommands declared as citty subCommands: implement / review / fix
// and base-branch with its nested set|get surface preserved via citty subCommands. Each action
// run() assembles the DispatchLifecycle subclass
// (TaskLifecycle / DocsLifecycle via runTask / runDocsTask / runBranchReview) and guards its flag
// surface (guardArgs, src/cli/shared.mjs). src/bin.ts boots this tree: runCommand + the
// --help pre-screen + parse/usage error normalization（exit code table §2.4.2）— the subcommand
// usage lines (SUBCOMMAND_USAGE) still print for usage errors, while the `--help` surface renders
// from these declarations via citty renderUsage.
//
// This file is statically readable by tests (cli-shape) and imports trigger no side effects —
// runCommand is only invoked by the bin thin entry.
import { defineCommand } from "citty";

import { runReview } from "./review.mjs";
import { runFix } from "./fix.mjs";
import { runBaseBranchSet, runBaseBranchGet } from "./base-branch.mjs";
import { requireHostHarness, guardArgs, intTask, DRY_RUN } from "./shared.mjs";

// Per-subcommand usage lines (print on parse/usage errors in place of citty's own error text;
// the commander-era wording is kept — the black-box face contracts pin it). Program-level
// --dry-run does NOT appear here: it is declared on the main command only.
const SUBCOMMAND_USAGE = {
  implement: "usage: cdd implement --task <n> [--plan <path>]",
  review: "usage: cdd review --type <task|branch|spec|plan> [--task <n>] (--plan <path> | --spec <path>) [--base <sha> --head <sha>] [--round <n>]",
  fix: "usage: cdd fix --type <task|spec|plan> [--task <n>] [--findings <path>] (--plan <path> | --spec <path>)",
  // base-branch: a bad flag / unknown subcommand inside set|get resolves to this single-word key
  // (the bin wrapper maps a nested citty leaf to its parent command — see commandUsageKey).
  "base-branch": "usage: cdd base-branch <set|get> --plan <path> [set: --base <branch> --source <source>] [--force]",
};

// Print the usage line for the resolved parse/usage-error context; default = the top-level line.
export function usageError(command) {
  process.stderr.write((Object.hasOwn(SUBCOMMAND_USAGE, command) ? SUBCOMMAND_USAGE[command] : "usage: cdd <command> [options]") + "\n");
}

// Map a resolveSubCommand result to its SUBCOMMAND_USAGE key: a nested citty leaf (set|get) maps
// to its parent command key (base-branch), a direct child maps to itself, the root maps to null
// (→ the default "usage: cdd <command> [options]" line).
export function commandUsageKey(cmd, parent) {
  if (parent && parent !== mainCommand) return parent.meta?.name ?? null;
  if (cmd !== mainCommand) return cmd.meta?.name ?? null;
  return null;
}

// ---- deepest-command resolution (help / usage-error context) ----
// citty's runMain keeps an internal resolveSubCommand (not exported); the bin wrapper needs the
// same deep resolution to know WHICH command's usage to render / key on error. Replicates the
// matching semantics for our tree: the first non-flag position (skipping value-flag values) is
// looked up in subCommands, recursing into the match. Returns [deepestCmd, parentCmd].
function subcommandIndex(rawArgs, argDef) {
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

async function resolveDeepest(rawArgs, cmd, parent) {
  const subCommands = cmd?.subCommands ?? {};
  if (Object.keys(subCommands).length > 0) {
    const idx = subcommandIndex(rawArgs, cmd.args ?? {});
    const name = idx >= 0 ? rawArgs[idx] : undefined;
    if (name && Object.hasOwn(subCommands, name)) {
      return resolveDeepest(rawArgs.slice(idx + 1), subCommands[name], cmd);
    }
  }
  return [cmd, parent];
}

export async function deepestCommand(rawArgs, cmd = mainCommand) {
  return resolveDeepest(rawArgs, cmd, null);
}

// ---- flags ----
// Arg keys are the kebab flag spellings (canonical channels.argv names, see
// templates/context-contract.json channels.argv) — the residue ⑨ guard reads these declarations
// as the help surface.

export const MAIN_ARGS = {
  // Program-level — the bin wrapper resolves it from the FULL argv (position-independent).
  "dry-run": { type: "boolean", description: "simulate without writing handoff artifacts" },
};

const implementCmd = defineCommand({
  meta: { name: "implement", description: "run the task implement phase (cdd implement)" },
  args: {
    task: { type: "string", required: true, valueHint: "n", description: "task number" },
    plan: { type: "string", valueHint: "path", description: "plan file path" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, implementCmd.args);
    const harness = requireHostHarness();
    const { runTask } = await import("../dispatch/task.ts");
    await runTask(harness, intTask(args.task), {
      mode: "implement", dryRun: DRY_RUN(), planFile: args.plan,
    });
  },
});

const reviewCmd = defineCommand({
  meta: { name: "review", description: "run a review — task | branch | spec | plan (consolidates the former cdd-task / docs-task review modes)" },
  args: {
    type: { type: "string", required: true, valueHint: "task|branch|spec|plan", description: "review type" },
    task: { type: "string", valueHint: "n", description: "task number (type=task)" },
    plan: { type: "string", valueHint: "path", description: "plan path (type=task|branch; type=plan: review target)" },
    base: { type: "string", valueHint: "sha", description: "base commit (type=task|branch)" },
    head: { type: "string", valueHint: "sha", description: "head commit (type=task|branch)" },
    round: { type: "string", valueHint: "n", description: "round backfill (validate against engine auto-increment)" },
    spec: { type: "string", valueHint: "path", description: "spec document path (type=spec: review target; type=plan: upstream reference pointer)" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, reviewCmd.args);
    const task = args.task != null ? intTask(args.task) : undefined;
    await runReview({ ...args, task });
  },
});

const fixCmd = defineCommand({
  meta: { name: "fix", description: "fix review findings — task | spec | plan (formerly cdd-task / docs-task fix modes)" },
  args: {
    type: { type: "string", required: true, valueHint: "task|spec|plan", description: "fix type" },
    task: { type: "string", valueHint: "n", description: "task number (type=task)" },
    findings: { type: "string", valueHint: "path", description: "findings handoff path for this fix round" },
    spec: { type: "string", valueHint: "path", description: "spec document path (type=spec)" },
    plan: { type: "string", valueHint: "path", description: "plan path (type=task|plan)" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, fixCmd.args);
    const task = args.task != null ? intTask(args.task) : undefined;
    await runFix({ ...args, task });
  },
});

// base-branch — 纯 artifact 命令（P5 spec §2.3）: single --plan target base-branch.json read/write;
// the nested set|get surface is declared as citty subCommands (no harness / lifecycle dependency).
const setCmd = defineCommand({
  meta: { name: "set", description: "write the base-branch artifact" },
  args: {
    base: { type: "string", valueHint: "branch", description: "base branch name" },
    source: { type: "string", valueHint: "source", description: "base-branch source (plan-field|branch-upstream|conversation-context|user-confirmed)" },
    plan: { type: "string", valueHint: "path", description: "plan file → resolveWorkspace(plan)" },
    force: { type: "boolean", description: "override an existing base-branch with a different base" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, setCmd.args);
    await runBaseBranchSet(args);
  },
});

const getCmd = defineCommand({
  meta: { name: "get", description: "read the base-branch artifact" },
  args: {
    plan: { type: "string", valueHint: "path", description: "plan file → resolveWorkspace(plan)" },
  },
  run: async ({ args, rawArgs }) => {
    guardArgs(rawArgs, getCmd.args);
    await runBaseBranchGet(args);
  },
});

const baseBranchCmd = defineCommand({
  meta: { name: "base-branch", description: "read/write base-branch.json (single CDD --plan target)" },
  subCommands: { set: setCmd, get: getCmd },
});

// The single citty command tree — the only command surface the bin thin entry boots.
export const mainCommand = defineCommand({
  meta: {
    name: "cdd",
    description: "CDD engine CLI — implement/review/fix/base-branch",
  },
  args: MAIN_ARGS,
  subCommands: {
    implement: implementCmd,
    review: reviewCmd,
    fix: fixCmd,
    "base-branch": baseBranchCmd,
  },
});
