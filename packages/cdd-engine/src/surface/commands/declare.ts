// packages/cdd-engine/src/surface/commands/declare.ts
// The CLI declaration — the ONE surface where a flag, a value domain and a command row exist.
//
// INVARIANT — a flag is declared once: its spelling, its value shape, its domain and the
// commands that take it all live in this file, and every other module (the projection, the
// route renderer, the channel guard) READS these rows instead of spelling a second copy. A
// second spelling is how two faces start disagreeing about one option.
//
// The declaration DECLARES and does not fill. Three consequences that shape the rows:
//   · a flag row carries the parse-time facts `commander` needs (spelling, value token,
//     enum domain, help line) and nothing about a round. The bytes a *body-layer* refusal
//     prints are not here: those come from the value the command's own entry returned, and
//     the byte table that renders them lives in `surface/render/usage.ts`. Binding a reason
//     onto a flag row would be a field no reader can reach — the parse layer and the
//     conditional-required layer answer at parse time, through `commander`'s own bytes, and
//     never through the usage union;
//   · a required flag is a `required: true` cell the projection turns into
//     `.requiredOption()`; its refusal is `commander`'s, so the row says nothing about why;
//   · a command row names its SCOPE — `dispatch` (a work round), `preview` (a command that
//     accepts `--dry-run` as a forecast) or `pure` (a command `--dry-run` does not apply
//     to). The third is what `SCOPE_ROWS` is derived from: the scope rejection is a
//     DECLARED row, never `commander`'s default `unknown option` byte.
//
// Two spellings are derived rather than typed, because a typed copy drifts:
//   · the `--type` domain is the two node faces followed by the four document faces in
//     their canonical order — one order, read off the two declarations that already hold
//     the value sets;
//   · `SCOPE_ROWS` is the `pure` command set, with the program flag's own spelling.
//
// Module-level exports are types and declared constant data — zero behaviour-carrying bare
// functions (the projection algorithm lives in the one builder class beside this file).

import { TARGET_TYPE_VALUES } from "../../docs/identity/types.ts";
import type { ProjectionResult, SkeletonWrite } from "../../docs/index.ts";
import { MAX_TASKS_PER_WAVE } from "../../docs/judging/wave-width.ts";
import { HOST_IDS } from "../../env/process/host.ts";
import type { BaseRead, BaseWrite } from "../../env/workspace/base-artifact.ts";
import type { FrameRequest } from "../../run/advance/frame.ts";
import type { AdvanceOutcome, BoardOutcome, PreviewOutcome } from "../../run/index.ts";
import type { BoardDisplay } from "../render/board.ts";
import type { InitLine } from "../render/init.ts";
import type { IssueReport } from "../render/issue.ts";
import type { UsageInput } from "../render/usage.ts";

/** The component-value types of the argv channel (the CLI parse validates by these). */
export type ChannelValueType = "string" | "path" | "int-list" | "enum" | "int" | "bool";

/** One argv-channel row — one flag's declaration. */
export interface ChannelArgRow {
  /** The `--flag` spelling. */
  readonly flag: string;
  /** The complement alias (help's `-h`), when the channel declares one. */
  readonly alias?: string;
  /** The component-value type the CLI parse validates by. */
  readonly type: ChannelValueType;
  /** The enum domain, when the type is enum. */
  readonly values: readonly string[];
  /** The program-scope marker — registered on every command node. */
  readonly scope?: "program";
  /** The flag-level help line, single-sourced here. */
  readonly help: string;
}

/** The `--type` domain: the two node faces, then the four document faces in canonical
 *  order. The order is the value token's own rendering, so it is read off the declaration
 *  that holds the set rather than typed a second time. */
const TYPE_VALUES: readonly string[] = [
  "wave",
  "branch",
  ...TARGET_TYPE_VALUES.filter((value) => value !== "wave" && value !== "branch"),
];

/** The argv channel — the flag / type / domain single source. */
export const ARGV_CHANNEL: Readonly<Record<string, ChannelArgRow>> = {
  plan: { flag: "--plan", type: "path", values: [], help: "the CDD plan document path" },
  spec: {
    flag: "--spec",
    type: "path",
    values: [],
    help: "the document under review — a phase-spec, an overall charter or a single-spec",
  },
  reviews: {
    flag: "--reviews",
    type: "path",
    values: [],
    help: "the source review handoff JSON path",
  },
  tasks: {
    flag: "--tasks",
    type: "int-list",
    values: [],
    help: `the task ids of the wave group (comma-separated) — at most ${MAX_TASKS_PER_WAVE} tasks per wave`,
  },
  type: {
    flag: "--type",
    type: "enum",
    values: TYPE_VALUES,
    help: "the target face of the round",
  },
  base: { flag: "--base", type: "string", values: [], help: "the base artifact branch name" },
  round: { flag: "--round", type: "int", values: [], help: "the review/fix round number" },
  source: {
    flag: "--source",
    type: "enum",
    values: ["plan-field", "branch-upstream", "conversation-context", "user-confirmed"],
    help: "the base artifact's source channel",
  },
  force: { flag: "--force", type: "bool", values: [], help: "override the existing base artifact" },
  recover: {
    flag: "--recover",
    type: "bool",
    values: [],
    help: "take over a standing in-flight record whose holder is dead (the only takeover path)",
  },
  harness: {
    flag: "--harness",
    type: "enum",
    values: HOST_IDS,
    help: "the harness whose plugin set is installed or updated",
  },
  update: {
    flag: "--update",
    type: "bool",
    values: [],
    help: "update the installed plugin set instead of installing it",
  },
  includeRecommends: {
    flag: "--include-recommends",
    type: "bool",
    values: [],
    help: "also install/update the recommended pi capability packages",
  },
  dryRun: {
    flag: "--dry-run",
    type: "bool",
    values: [],
    scope: "program",
    help: "preview the next dispatch step and its expected artifacts — zero repo writes, no round consumed (implement/review/fix/init)",
  },
  help: {
    flag: "--help",
    alias: "-h",
    type: "bool",
    values: [],
    scope: "program",
    help: "show this help",
  },
  artifacts: {
    flag: "--artifacts",
    type: "bool",
    values: [],
    help: "expand the board's artifact inventory — one row per observed review round (a troubleshooting view, off by default)",
  },
  notes: {
    flag: "--notes",
    type: "bool",
    values: [],
    help: "expand the board's child-note bodies — the default prints the `notes +M` count alone (a troubleshooting view, off by default)",
  },
  output: {
    flag: "--output",
    type: "enum",
    values: ["json", "skeleton"],
    help: "the schema render face — json (the derived declaration, default) or skeleton (the scaffold written into <target>)",
  },
};

/** The shaped channel types — the ones whose raw value has a domain to check. A `string`,
 *  a `path` and a `bool` carry no parser, so their absence is the registered face. */
export type ShapedChannelValueType = "enum" | "int-list" | "int";

/** One shaped row's executor — the parsed raw's check and normalization. */
export interface ShapeRule {
  /** Validate the raw against the row's declared domain and answer the normalized value; a
   *  non-conforming raw throws the projection's `InvalidArgumentError`. */
  parse(raw: string, row: ChannelArgRow): string;
}

/** The value-domain shapes — the ONE executor table, keyed by the row's declared type. Data
 *  rows, never bare functions: the projection reads a row and calls its `parse`. */
export const VALUE_SHAPES: Readonly<Record<ShapedChannelValueType, ShapeRule>> = {
  enum: {
    parse(raw, row) {
      if (!row.values.includes(raw)) {
        throw new InvalidArgumentValue(`must be one of ${row.values.join(" | ")}`);
      }
      return raw;
    },
  },
  "int-list": {
    parse(raw) {
      const parts = raw.split(",").map((part) => part.trim());
      const invalid = parts.find((part) => !/^\d+$/.test(part));
      if (invalid !== undefined) {
        throw new InvalidArgumentValue(
          `--tasks <n|n,n,…> — must be comma-separated integers: ${invalid}`,
        );
      }
      return [...new Set(parts.map(Number))].sort((left, right) => left - right).join(",");
    },
  },
  int: {
    parse(raw) {
      if (!/^\d+$/.test(raw)) throw new InvalidArgumentValue("must be an integer");
      return raw;
    },
  },
};

/**
 * InvalidArgumentValue — the value-domain refusal's own error. It is raised HERE (this file
 * owns the domains) and re-shaped by the projection into `commander`'s own error, so the
 * parse layer's byte stays `commander`'s and this file imports no CLI library.
 */
export class InvalidArgumentValue extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidArgumentValue";
  }
}

/** The eight subcommand words — the command face. */
export type CliVerb =
  | "implement"
  | "review"
  | "fix"
  | "schema"
  | "issue"
  | "base"
  | "board"
  | "init";

/** The nested leaf words — the sub-command surfaces of the pure commands. */
export type CliLeafName = "get" | "set" | "render";

/** A per-command value-type override — the one declared key whose value shape differs from
 *  the channel's global typing (`base set`'s `--base` carries a branch name). */
export type CliValueOverride = "branch";

/** One declared arg of a command. */
export interface CliArgSpec {
  /** The canonical argv-channel key. */
  readonly key: string;
  /** Whether the parse requires the value. */
  readonly required?: boolean;
  /** The value-type override, where the command's use differs from the channel. */
  readonly valueType?: CliValueOverride;
}

/** One nested leaf command (`base set|get` · `schema get` · `issue render`). */
export interface CliLeafSpec {
  readonly name: CliLeafName;
  readonly description: string;
  readonly keys: readonly CliArgSpec[];
  readonly positionals?: readonly CliArgSpec[];
}

/** A command's `--dry-run` relation — the one cell `SCOPE_ROWS` reads. */
export type CommandScope =
  /** A work round: `--dry-run` forecasts its next dispatch. */
  | "dispatch"
  /** A preview-capable command that dispatches nothing: `--dry-run` renders its step plan. */
  | "preview"
  /** A pure command: `--dry-run` does not apply, so it is a usage rejection. */
  | "pure";

/** One subcommand declaration. */
export interface CliCommandSpec {
  readonly name: CliVerb;
  readonly description: string;
  /** The `--dry-run` relation — see `CommandScope`. */
  readonly scope: CommandScope;
  readonly keys: readonly CliArgSpec[];
  readonly positionals?: readonly CliArgSpec[];
  readonly leaves?: readonly CliLeafSpec[];
  /** One minimal runnable example (the help face's Examples section). */
  readonly example?: string;
}

/** The eight subcommand declarations. */
export const CLI_COMMANDS: readonly CliCommandSpec[] = [
  {
    name: "implement",
    description: `run the task implement phase — at most ${MAX_TASKS_PER_WAVE} tasks per wave`,
    scope: "dispatch",
    example: "cdd implement --tasks 1,2 --plan <path>",
    keys: [{ key: "tasks", required: true }, { key: "plan", required: true }, { key: "recover" }],
  },
  {
    name: "review",
    description: "run a review — wave | branch | phase-spec | overall | plan | single-spec",
    scope: "dispatch",
    example: "cdd review --type phase-spec --spec <path>",
    keys: [
      { key: "type", required: true },
      { key: "tasks" },
      { key: "plan" },
      { key: "spec" },
      { key: "round" },
      { key: "recover" },
    ],
  },
  {
    name: "fix",
    description: "fix review findings — wave | branch | phase-spec | overall | plan | single-spec",
    scope: "dispatch",
    example: "cdd fix --type wave --tasks 1 --reviews .kairos/cdd/<slug>/tasks-1-review-1.json",
    keys: [
      { key: "type", required: true },
      { key: "tasks" },
      { key: "reviews" },
      { key: "spec" },
      { key: "plan" },
      { key: "recover" },
    ],
  },
  {
    name: "base",
    description: "read/write base.json (single CDD --plan target)",
    scope: "pure",
    example: "cdd base set --plan <path> --base develop --source plan-field",
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
    scope: "pure",
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
    scope: "pure",
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
    description:
      "render the progress board from a --plan or --spec entry (overall/phase-spec/single-spec/plan/wave/branch)",
    scope: "pure",
    example: "cdd board --plan <path>",
    keys: [{ key: "plan" }, { key: "spec" }, { key: "artifacts" }, { key: "notes" }],
  },
  {
    name: "init",
    description: "install or update the kairos plugin set for a harness",
    scope: "preview",
    example: "cdd init --harness=claude",
    keys: [{ key: "harness", required: true }, { key: "update" }, { key: "includeRecommends" }],
  },
];

/** One scope row — a pure command and the program flag its parse accepts but its body
 *  refuses. Derived from the command declarations, never typed. */
export interface ScopeRow {
  /** The command whose `--dry-run` is a usage rejection. */
  readonly verb: CliVerb;
  /** The program flag's spelling, as the channel declares it. */
  readonly flag: string;
}

/** The scope rejection's row set — the `pure` commands, with the program flag's own
 *  spelling. Every row translates into the SAME usage member (the scope rejection), so a
 *  command can never be refused on a scope row of its own invention. */
export const SCOPE_ROWS: readonly ScopeRow[] = CLI_COMMANDS.filter(
  (spec) => spec.scope === "pure",
).map((spec) => ({ verb: spec.name, flag: ARGV_CHANNEL.dryRun.flag }));

/** The schema `<type>` vocabulary — the `get` leaf's ONE table: the primary document keys
 *  plus the legacy `phaseSpec` alias normalized to the kebab spelling. */
export const SCHEMA_TYPE_KEYS: Readonly<Record<string, string>> = {
  overall: "overall",
  plan: "plan",
  "phase-spec": "phase-spec",
  "single-spec": "single-spec",
  phaseSpec: "phase-spec",
};

/** The primary schema spellings — the alias-free rows, in the table's own order (the
 *  argument description's value list). */
export const SCHEMA_PRIMARY_KEYS: readonly string[] = Object.entries(SCHEMA_TYPE_KEYS)
  .filter(([spelling, key]) => spelling === key)
  .map(([spelling]) => spelling);

/** The conditional required group per work verb and target type — the preAction hook's data
 *  face. The document shapes carry `--spec`, the wave / plan / branch faces carry `--plan`,
 *  and the branch fix carries the requesting carrier too. Non-exclusive: a round declaring
 *  both `--plan` and `--spec` stays accepted. */
export const REQUIRED_GROUPS: Readonly<
  Record<"review" | "fix", Readonly<Record<string, readonly string[]>>>
> = {
  review: {
    wave: ["--plan"],
    branch: ["--plan"],
    "phase-spec": ["--spec"],
    overall: ["--spec"],
    plan: ["--plan"],
    "single-spec": ["--spec"],
  },
  fix: {
    wave: ["--plan"],
    branch: ["--reviews", "--plan"],
    "phase-spec": ["--spec"],
    overall: ["--spec"],
    plan: ["--plan"],
    "single-spec": ["--spec"],
  },
};

/** A declared flag's key by its spelling (`--plan` → `plan`), for the group hook's lookup. */
export const keyOfFlag = (flag: string): string => flag.replace(/^--/, "");

/** One parsed invocation, as a shell reads it — the command path the caller typed, the
 *  leaf word (null on a verb), every declared flag's value (booleans as `"true"` /
 *  `"false"`), the positionals and the program flag's own value. This is the whole of
 *  "取参": a shell maps these cells onto the ONE entry's request and calls it. */
export interface ParsedCommand {
  /** The space-joined node path (`implement` · `base set` · `schema get`). */
  readonly commandPath: string;
  /** The nested leaf word; null on a verb. */
  readonly leaf: CliLeafName | null;
  /** The declared flags' values, keyed by channel key. */
  readonly args: Readonly<Record<string, string>>;
  /** The positional values, in declaration order. */
  readonly positionals: readonly string[];
  /** The program `--dry-run` flag. */
  readonly dryRun: boolean;
}

// ---------------------------------------------------------------------------
// the value vocabulary a shell hands its output face
// ---------------------------------------------------------------------------

/** One command's declared answer, as a shell hands it back — the union of everything a
 *  `run/`, `docs/` or `env/` entry can return. A shell composes nothing: it calls one entry
 *  and hands the value over, and the surface's ONE output face decides which stream the
 *  bytes belong on. The three wrapped arms name WHICH entry produced the value, because two
 *  entries answer disjoint-but-overlapping kind sets (`held` · `blocked`) and the shell is
 *  the only place that knows which one it called. */
export type CliOutcome =
  /** A work command's dispatch step, with the request it was handed — the verb and the target
   *  type the refusal bytes and the capsule's step row are read from. The shell already holds
   *  this value, so handing it over spells nothing twice. */
  | {
      readonly kind: "advance-entry";
      readonly value: AdvanceOutcome;
      readonly request: FrameRequest;
    }
  /** A work command's `--dry-run` forecast, with the request it was handed — the command
   *  word the forecast's header and its usage values name. */
  | {
      readonly kind: "preview-entry";
      readonly value: PreviewOutcome;
      readonly request: FrameRequest;
    }
  /** The board's read. `display` is the two display switches the caller typed — the shell
   *  passes the flag VALUES down and judges neither which family prints nor which round is
   *  anomalous. */
  | {
      readonly kind: "board-entry";
      readonly value: BoardOutcome;
      readonly display: BoardDisplay;
    }
  /** A declared misuse or declared failure, handed over unchanged. */
  | UsageInput
  /** The base artifact's read. */
  | { readonly kind: "base-read"; readonly value: BaseRead }
  /** The base artifact's write. */
  | { readonly kind: "base-write"; readonly value: BaseWrite }
  /** The json schema face. */
  | { readonly kind: "projection"; readonly value: ProjectionResult }
  /** The skeleton landing. */
  | { readonly kind: "skeleton"; readonly value: SkeletonWrite }
  /** The issue body's own report (its three cells are the renderer's, not a `kind`). */
  | { readonly kind: "issue-report"; readonly report: IssueReport }
  /** One `init` render's lines, each carrying its own stream, and the run's exit code. */
  | { readonly kind: "init"; readonly lines: readonly InitLine[]; readonly exitCode: number };

/** The ONE output face a shell holds — the surface door's report method, as a shell sees it.
 *  `commandPath` is the caller's own node path, handed over rather than re-derived so the
 *  bytes name the command the caller typed. */
export interface CommandReporter {
  /** Write one declared answer through its own stream and answer the exit code. */
  report(outcome: CliOutcome, commandPath: string): number;
  /** Write lines a long-running step produced BEFORE its next action — the `init` face's
   *  progress row, which must land ahead of the spawn it announces. Each line carries its own
   *  stream, so this is the same pair writers `report` uses and not a second spellout. */
  progress(lines: readonly InitLine[]): void;
}

/** One text stream writer. */
export type TextWriter = (text: string) => void;

/** The two writers the surface writes through — one pair, so a shell that needs both (the
 *  `init` face's progress and failure lines) cannot be handed a second spelling of either. */
export interface TextStreams {
  readonly stdout: TextWriter;
  readonly stderr: TextWriter;
}
