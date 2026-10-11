// packages/cdd-engine/src-next/face/registry.ts
// T11 — the command registry: the six subcommand declarations (name · usage · the
// declared arg keys) as pure data rows, plus the per-command usage lines. The flag
// spellings, value types and enum domains are NOT a second hand-written list: every
// key resolves through the engine-config argv channel (the single data source), so
// a channel rename fails the guard scan. Three consumers share the SAME rows — the
// parse face (argv.ts) tokenizes against them, the run face (cli.ts) dispatches by
// them (and renders their usage on the error/help faces), and the guard audit
// (scripts/lib/guard.ts, via the cli.ts re-export) asserts the channel closure —
// one registry, zero parallel lists.
//
// Module-level exports are types / constant data — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

/** The six subcommand words — the CLI command face (steady: implement · review ·
 *  fix · schema · issue · base). T20 converges the base command face: `cdd base
 *  set|get` rides the six-command surface (unchanged in count). */
export type CliVerb = "implement" | "review" | "fix" | "schema" | "issue" | "base";

/** The nested leaf words — the sub-command surfaces of the pure commands. */
export type CliLeafName = "get" | "set" | "render" | "gen";

/** The per-command usage lines — the steady consumption face (byte-stable across
 *  the tree generations; a typo in a usage line is a red consumer-side test). */
export const CLI_USAGE: Record<CliVerb, string> = {
  implement: "usage: cdd implement --tasks <n|n,n,…> --plan <path>",
  review:
    "usage: cdd review --type <wave|branch|spec|plan> [--tasks <n|n,n,…>] (--plan <path> | --spec <path> | branch: --base <sha> --head <sha>) [--round <n>]",
  fix: "usage: cdd fix --type <wave|branch|spec|plan> [--tasks <n|n,n,…>] [--findings <path>] (--plan <path> | --spec <path>)",
  base: "usage: cdd base <set|get> --plan <path> [set: --base <branch> --source <source>] [--force]",
  schema: "usage: cdd schema <get|gen> <type>",
  issue: "usage: cdd issue render",
};

/** A per-command value-type override — a declared key whose value shape differs
 *  from the channel's global typing for that key (base set's `--base` carries
 *  a branch name, never the review range's 8-char sha). */
export type CliValueOverride = "branch";

/** One declared arg of a command — the key + how strictly the run requires it. */
export interface CliArgSpec {
  /** The canonical engine-config argv-channel key. */
  key: string;
  /** Whether the run requires the value (enforced at parse). */
  required?: boolean;
  /** The value-type override (only where the command's use differs from the channel). */
  valueType?: CliValueOverride;
}

/** One nested leaf command (base set|get · schema get · issue render). */
export interface CliLeafSpec {
  name: CliLeafName;
  usage: string;
  description: string;
  keys: readonly CliArgSpec[];
  positionals?: readonly CliArgSpec[];
}

/** One subcommand declaration — the command face's data row. */
export interface CliCommandSpec {
  name: CliVerb;
  usage: string;
  description: string;
  keys: readonly CliArgSpec[];
  positionals?: readonly CliArgSpec[];
  leaves?: readonly CliLeafSpec[];
}

/** The six subcommand declarations — implement, review, fix (the lifecycle work
 *  commands) plus the pure base / schema / issue artifact commands. */
export const CLI_COMMANDS: readonly CliCommandSpec[] = [
  {
    name: "implement",
    usage: CLI_USAGE.implement,
    description: "run the task implement phase",
    keys: [{ key: "tasks", required: true }, { key: "plan", required: true }, { key: "root" }],
  },
  {
    name: "review",
    usage: CLI_USAGE.review,
    description: "run a review — task | branch | spec | plan",
    keys: [
      { key: "type", required: true },
      { key: "tasks" },
      { key: "plan" },
      { key: "spec" },
      { key: "base" },
      { key: "head" },
      { key: "round" },
      { key: "root" },
    ],
  },
  {
    name: "fix",
    usage: CLI_USAGE.fix,
    description: "fix review findings — task | branch | spec | plan",
    keys: [
      { key: "type", required: true },
      { key: "tasks" },
      { key: "findings" },
      { key: "spec" },
      { key: "plan" },
      { key: "root" },
    ],
  },
  {
    name: "base",
    usage: CLI_USAGE.base,
    description: "read/write base.json (single CDD --plan target)",
    keys: [],
    leaves: [
      {
        name: "set",
        usage: CLI_USAGE.base,
        description: "write the base artifact",
        keys: [
          { key: "plan", required: true },
          { key: "base", required: true, valueType: "branch" },
          { key: "source", required: true },
          { key: "force" },
        ],
      },
      {
        name: "get",
        usage: CLI_USAGE.base,
        description: "read the base artifact",
        keys: [{ key: "plan", required: true }],
      },
    ],
  },
  {
    name: "schema",
    usage: CLI_USAGE.schema,
    description: "read canonical doc-structure schemas (discovery, zero enforcement)",
    keys: [{ key: "plan" }],
    leaves: [
      {
        name: "get",
        usage: CLI_USAGE.schema,
        description: "print the derived doc-structure schema for <type> (or the plan-graph read)",
        keys: [{ key: "plan" }],
        positionals: [{ key: "type", required: true }],
      },
      {
        name: "gen",
        usage: CLI_USAGE.schema,
        description:
          "render the derived doc skeleton for <type> to stdout (the writing-start scaffold)",
        keys: [{ key: "plan" }],
        positionals: [{ key: "type" }],
      },
    ],
  },
  {
    name: "issue",
    usage: CLI_USAGE.issue,
    description: "aggregate issue-body rendering (cdd issue render, zero enforcement)",
    keys: [],
    leaves: [
      {
        name: "render",
        usage: CLI_USAGE.issue,
        description: "render the aggregate issue body (stdin findings JSON → stdout)",
        keys: [],
      },
    ],
  },
];
