// packages/cdd-engine/src-next/face/declare.ts
// §2.4 — the CLI declaration single surface: the argv channel table, the seven-command
// declarations, every CLI face type and the conditional-required group table cohere
// in ONE file (the user ruling 2026-10-11: the declaration was scattered across
// runtime/registry/argv → one surface). The migration converges:
//
//   · ARGV_CHANNEL / ChannelValueType / ChannelArgRow — from infra/runtime.ts (the
//     engine-config face keeps only the version + the handoff-namespace facts).
//   · CliVerb / CliLeafName / CliValueOverride / CliArgSpec / CliLeafSpec /
//     CliCommandSpec / CLI_COMMANDS — from face/registry.ts (the registry file is
//     deleted; the rows drop the `usage` field — the usage semantics merge into the
//     projection's .description(), and the six-line usage corpus retires here).
//   · REQUIRED_GROUPS — from face/validate.ts (the preAction data face; the
//     retired validator component retires — the value-domain semantics move to the
//     builder's parseArg method family).
//   · SCHEMA_TYPE_KEYS — from face/argv.ts (the schema <type> vocabulary; consumed
//     by the builder's #parseTypeKey — the argv.ts parse channel died at T6).
//
// Module-level exports are types / declared constant data — zero behavior-carrying
// bare functions (the plan's zero-bare-function discipline); the projection
// algorithm lives in the single CommandTreeBuilder class (face/projection.ts).

import { InvalidArgumentError } from "commander";

import type { DocKey } from "../contract/project.ts";

/** The component-value types of the argv channel (the CLI parse validates by these). */
export type ChannelValueType = "string" | "path" | "int-list" | "enum" | "int" | "bool";

/** One argv-channel row — the flag/type/enum declaration of one CLI key. */
export interface ChannelArgRow {
  /** The `--flag` spelling. */
  flag: string;
  /** The complement alias (help's `-h`), when the channel declares one. */
  alias?: string;
  /** The component-value type the CLI parse validates by. */
  type: ChannelValueType;
  /** The enum domain, when the type is enum. */
  values?: readonly string[];
  /** The program-scope marker (dry-run/help — accepted at any position). */
  scope?: "program";
  /** The flag-level help line — the commander option description (one global key
   *  text, single-sourced at the channel). */
  help?: string;
}

/** The argv channel table — the CLI flag/type/enum single source (the engine-config
 *  argv channel verbatim: flag spellings, value types and enum domains ride these
 *  rows, and the command declarations + the channel audit read them from here). The
 *  `help` rows are the flag-level descriptions of the commander Options face (one
 *  text per key, shared by every command that declares it). */
export const ARGV_CHANNEL = {
  plan: { flag: "--plan", type: "path", help: "the CDD plan document path" },
  spec: { flag: "--spec", type: "path", help: "the design-spec document path" },
  findings: {
    flag: "--findings",
    type: "path",
    help: "the source review handoff JSON path",
  },
  tasks: {
    flag: "--tasks",
    type: "int-list",
    help: "the task ids of the wave group (comma-separated)",
  },
  type: {
    flag: "--type",
    type: "enum",
    values: ["wave", "branch", "spec", "plan"],
    help: "the target face of the round",
  },
  base: { flag: "--base", type: "string", help: "the base artifact branch name" },
  round: { flag: "--round", type: "int", help: "the review/fix round number" },
  source: {
    flag: "--source",
    type: "enum",
    values: ["plan-field", "branch-upstream", "conversation-context", "user-confirmed"],
    help: "the base artifact's source channel",
  },
  force: { flag: "--force", type: "bool", help: "override the existing base artifact" },
  dryRun: {
    flag: "--dry-run",
    type: "bool",
    scope: "program",
    help: "synthetic dispatch — book the round without a child spawn",
  },
  help: {
    flag: "--help",
    alias: "-h",
    type: "bool",
    scope: "program",
    help: "show this help",
  },
  output: {
    flag: "--output",
    type: "enum",
    values: ["json", "skeleton"],
    help: "the schema render face — json (the derived declaration, default) or skeleton (the scaffold written into <target>)",
  },
} as const satisfies Readonly<Record<string, ChannelArgRow>>;

/** The shaped channel subset — the value-domain-validated channel types
 *  (string/path/bool carry no parser — the unshaped faces register absent). */
export type ShapedChannelValueType = "enum" | "int-list" | "int";

/** The value-domain shapes — the parsed raw's check + normalization per shaped
 *  channel type: the parseArg family's single executor source (§4.1). Each rule
 *  validates the raw against the row's declared domain and returns the normalized
 *  value; a non-conforming raw throws commander.InvalidArgumentError with the
 *  pinned error bytes (the value-domain error messages are a pinned surface —
 *  zero byte drift across the retired method family). The enum rule reads the
 *  row's declared `values`; the int-list normalization rewrites the consumed
 *  shape, never the run face's own normalization. Data rows, never bare
 *  functions — one executor reads them (face/projection.ts #parseArgOf). */
export const VALUE_SHAPES: Readonly<
  Record<ShapedChannelValueType, { parse(raw: string, row: ChannelArgRow): string }>
> = {
  enum: {
    parse(raw, row) {
      if (!(row.values ?? []).includes(raw)) {
        throw new InvalidArgumentError(`must be one of ${(row.values ?? []).join(" | ")}`);
      }
      return raw;
    },
  },
  "int-list": {
    parse(raw) {
      const parts = raw.split(",").map((part) => part.trim());
      const invalid = parts.find((part) => !/^\d+$/.test(part));
      if (invalid !== undefined) {
        throw new InvalidArgumentError(
          `--tasks <n|n,n,…> — must be comma-separated integers: ${invalid}`,
        );
      }
      return [...new Set(parts.map(Number))].sort((a, b) => a - b).join(",");
    },
  },
  int: {
    parse(raw) {
      if (!/^\d+$/.test(raw)) {
        throw new InvalidArgumentError("must be an integer");
      }
      return raw;
    },
  },
};

/** The seven subcommand words — the CLI command face (implement · review · fix ·
 *  schema · issue · base · board). */
export type CliVerb = "implement" | "review" | "fix" | "schema" | "issue" | "base" | "board";

/** The nested leaf words — the sub-command surfaces of the pure commands. */
export type CliLeafName = "get" | "set" | "render";

/** A per-command value-type override — a declared key whose value shape differs
 *  from the channel's global typing for that key (base set's `--base` carries a
 *  branch name — the branch-domain display token/help). */
export type CliValueOverride = "branch";

/** One declared arg of a command — the key + how strictly the run requires it. */
export interface CliArgSpec {
  /** The canonical engine-config argv-channel key. */
  key: string;
  /** Whether the run requires the value (enforced at parse — .requiredOption() /
   *  a required .argument()). */
  required?: boolean;
  /** The value-type override (only where the command's use differs from the channel). */
  valueType?: CliValueOverride;
}

/** One nested leaf command (base set|get · schema get · issue render). */
export interface CliLeafSpec {
  name: CliLeafName;
  description: string;
  keys: readonly CliArgSpec[];
  positionals?: readonly CliArgSpec[];
}

/** One subcommand declaration — the command face's data row. */
export interface CliCommandSpec {
  name: CliVerb;
  description: string;
  keys: readonly CliArgSpec[];
  positionals?: readonly CliArgSpec[];
  leaves?: readonly CliLeafSpec[];
  /** One minimal runnable example (the help face's Examples section — projected by
   *  the builder's .addHelpText(); the P1 example sentences). */
  example?: string;
}

/** The seven subcommand declarations — implement, review, fix (the lifecycle work
 *  commands) plus the pure base / schema / issue artifact commands and the board
 *  observability command. */
export const CLI_COMMANDS: readonly CliCommandSpec[] = [
  {
    name: "implement",
    description: "run the task implement phase",
    example: "cdd implement --tasks 1,2 --plan docs/kairos/plans/p3.md",
    keys: [
      { key: "tasks", required: true },
      { key: "plan", required: true },
    ],
  },
  {
    name: "review",
    description: "run a review — task | branch | spec | plan",
    example: "cdd review --type spec --spec docs/kairos/specs/p3-design.md",
    keys: [
      { key: "type", required: true },
      { key: "tasks" },
      { key: "plan" },
      { key: "spec" },
      { key: "round" },
    ],
  },
  {
    name: "fix",
    description: "fix review findings — task | branch | spec | plan",
    example: "cdd fix --type wave --tasks 1 --findings tasks-1-review-1.json",
    keys: [
      { key: "type", required: true },
      { key: "tasks" },
      { key: "findings" },
      { key: "spec" },
      { key: "plan" },
    ],
  },
  {
    name: "base",
    description: "read/write base.json (single CDD --plan target)",
    example: "cdd base set --plan docs/kairos/plans/p3.md --base develop --source plan-field",
    keys: [],
    leaves: [
      {
        name: "set",
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
        description: "read the base artifact",
        keys: [{ key: "plan", required: true }],
      },
    ],
  },
  {
    name: "schema",
    description: "read canonical doc-structure schemas (discovery, zero enforcement)",
    example: "cdd schema get phase-spec",
    keys: [{ key: "plan" }],
    leaves: [
      {
        name: "get",
        description:
          "print the derived doc-structure schema for <type> (the --output json face, default) or render the derived doc skeleton into <target> (the --output skeleton face)",
        keys: [{ key: "plan" }, { key: "output" }],
        positionals: [{ key: "type", required: true }, { key: "target" }],
      },
    ],
  },
  {
    name: "issue",
    description: "aggregate issue-body rendering (cdd issue render, zero enforcement)",
    example: "cdd issue render < findings.json",
    keys: [],
    leaves: [
      {
        name: "render",
        description: "render the aggregate issue body (stdin findings JSON → stdout)",
        keys: [],
      },
    ],
  },
  {
    name: "board",
    description: "render the slug progress board (overall/spec/plan/wave/branch)",
    example: "cdd board 2026-10-10-engine-doc-tooling-p7",
    keys: [],
    positionals: [{ key: "slug", required: true }],
  },
];

/** The schema `<type>` vocabulary — the get leaf's ONE table (spec §5.3): the
 *  primary DocKey spellings (overall-spec | plan | phase-spec | single-spec) plus
 *  the legacy `phaseSpec` alias row normalized to the kebab key. One normalizing
 *  vocabulary, never a second hand-written list — the builder's #parseTypeKey
 *  validates through it. */
export const SCHEMA_TYPE_KEYS: Readonly<Record<string, DocKey>> = {
  "overall-spec": "overall-spec",
  plan: "plan",
  "phase-spec": "phase-spec",
  "single-spec": "single-spec",
  phaseSpec: "phase-spec",
};

/** The conditional required group per work verb + target type — the preAction hook's
 *  data face (spec §4.2): review `{plan}` / `{spec}` / `{plan}` · fix `{plan}` /
 *  `{spec}` / `{findings, plan}` — every branch face carries the `--plan` workspace
 *  identity (the branch line holds no commit ref: the review judges the live tree,
 *  the scope anchor BASE_BRANCH is engine-injected at dispatch). Keyed by declared
 *  flag spelling; non-exclusive — a round declaring both `--plan` and `--spec`
 *  stays accepted (no mutual-exclusion rejection). */
export const REQUIRED_GROUPS: Readonly<
  Record<"review" | "fix", Readonly<Record<string, readonly string[]>>>
> = {
  review: {
    wave: ["--plan"],
    spec: ["--spec"],
    plan: ["--plan"],
    branch: ["--plan"],
  },
  fix: {
    wave: ["--plan"],
    spec: ["--spec"],
    plan: ["--plan"],
    branch: ["--findings", "--plan"],
  },
};
