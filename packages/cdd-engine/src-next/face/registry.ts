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

/** The per-command usage lines — the display face's product line (the friendly
 *  syntax: flag value domains · leaf expansion · phase semantics — the deliberate
 *  Task 4 pin break of the old "byte-stable across tree generations" steadiness;
 *  a usage-line change is now a re-pin, never a red consumer test). The
 *  `usage: cdd <command>` prefix is a stable anchor the black-box smoke tests
 *  read (`scripts/smoke-cdd.ts`). */
export const CLI_USAGE: Record<CliVerb, string> = {
  implement:
    "usage: cdd implement --tasks <n|n,n,…> --plan <path> [--root <path>] — implement the plan wave's task group",
  review:
    "usage: cdd review --type <wave|branch|spec|plan> [--tasks <n|n,n,…>] [--round <n>] (--plan <path> | --spec <path> | --base <sha> --head <sha>) [--root <path>] — run the review round",
  fix: "usage: cdd fix --type <wave|branch|spec|plan> [--tasks <n|n,n,…>] [--findings <path>] (--plan <path> | --spec <path>) [--root <path>] — run the fix round on the review findings",
  base: "usage: cdd base <set|get> --plan <path> [set: --base <branch> --source <source>] [--force] — read/write the base.json artifact",
  schema:
    "usage: cdd schema <get|gen> <type> — <type> is overall | plan | phase-spec (get also accepts plan-graph)",
  issue: "usage: cdd issue render — render the aggregate issue body from stdin findings JSON",
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
  /** One minimal runnable example (the `--help` render's example section). */
  example?: string;
}

/** The six subcommand declarations — implement, review, fix (the lifecycle work
 *  commands) plus the pure base / schema / issue artifact commands. */
export const CLI_COMMANDS: readonly CliCommandSpec[] = [
  {
    name: "implement",
    usage: CLI_USAGE.implement,
    description: "run the task implement phase",
    example: "cdd implement --tasks 1,2 --plan docs/kairos/plans/p3.md",
    keys: [{ key: "tasks", required: true }, { key: "plan", required: true }, { key: "root" }],
  },
  {
    name: "review",
    usage: CLI_USAGE.review,
    description: "run a review — task | branch | spec | plan",
    example: "cdd review --type spec --spec docs/kairos/specs/p3-design.md",
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
    example: "cdd fix --type wave --tasks 1 --findings tasks-1-review-1.json",
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
    example: "cdd base set --plan docs/kairos/plans/p3.md --base develop --source plan-field",
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
    example: "cdd schema get phase-spec",
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
    example: "cdd issue render < findings.json",
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
