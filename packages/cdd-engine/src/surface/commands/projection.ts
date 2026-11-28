// packages/cdd-engine/src/surface/commands/projection.ts
// The declaration's ONE projection: the command tree, its value-domain checks, its
// conditional-required hook, its help injections, and the TWO faces derived from it.
//
// INVARIANT — the commander tree, the usage line and the scope rejection are all read off
// the SAME declaration (`declare.ts`), so a flag's help byte, the usage line a refusal
// prefixes and the node a caller parses through can never be three different trees. The
// class assembles the whole tree in its constructor; `program` is the one exit.
//
// Two derived faces, and why they live here:
//   · `usageLineOf(commandPath)` — the first line of THAT node's `helpInformation()`. The
//     usage face injects this function, so the `error:` prefix a body-layer refusal prints
//     and the node's own `--help` first line are the same assembly and not two spellings.
//     It is the ONE derivation point: a table that spelled the line would only ever assert
//     itself;
//   · `ScopeGuard` — a command the declaration marks `pure`, handed the program flag, is a
//     usage rejection. The row set is `SCOPE_ROWS` (derived from the declaration), and every
//     row translates into the SAME usage member, so the rejection is a declared fact rather
//     than `commander`'s default `unknown option` byte.
//
// The value-domain rules are declaration DATA (`VALUE_SHAPES`); this file only reads them.
// A malformed value is re-shaped into `commander`'s own `InvalidArgumentError`, so the parse
// layer's byte stays the library's and the exit code stays the run face's normalization.
//
// Module-level exports are types and classes — zero behaviour-carrying bare functions.

import { Command, InvalidArgumentError } from "commander";
import type { Usage, UsageReason } from "../../run/advance/frame.ts";
import {
  ARGV_CHANNEL,
  type ChannelArgRow,
  CLI_COMMANDS,
  type CliArgSpec,
  type CliCommandSpec,
  type CliLeafSpec,
  type CliValueOverride,
  InvalidArgumentValue,
  keyOfFlag,
  REQUIRED_GROUPS,
  SCHEMA_PRIMARY_KEYS,
  SCHEMA_TYPE_KEYS,
  SCOPE_ROWS,
  type ScopeRow,
  VALUE_SHAPES,
} from "./declare.ts";

/** The channel table widened to its lookup face — the declared literal stays the data
 *  source; the builder indexes it by a row's key at run time. */
const CHANNEL_TABLE: Readonly<Record<string, ChannelArgRow>> = ARGV_CHANNEL;

/**
 * CommandTreeBuilder — the declaration → commander projection. Invariant: the constructor
 * performs the whole assembly, so `program` is complete (parse, help, value checks and the
 * conditional-required hook) and no caller can hold half a tree.
 */
export class CommandTreeBuilder {
  /** The assembled program — the composition root's parse and help face. */
  readonly program: Command;

  constructor() {
    this.program = new Command("cdd");
    // The exit override is wired FIRST: every `.command()` copies the inherited settings,
    // so a rejection anywhere in the tree throws instead of exiting the process.
    this.program.exitOverride();
    this.program.description("the CDD engine's command line");
    this.program.addHelpText(
      "afterAll",
      "program flags (accepted at any position): --dry-run (implement/review/fix/init)",
    );
    this.#bindProgramScopes(this.program);
    this.#injectProgramExamples();
    for (const spec of CLI_COMMANDS) this.#projectCommand(spec);
    this.program.hook("preAction", (_parent, action) => this.#assertRequiredGroups(action));
  }

  /** One command node's first help line — the usage byte every body-layer refusal
   *  prefixes, derived from the node itself. `commandPath` is the space-joined node path
   *  (`board` · `base set` · `schema get`); an unknown path answers the empty line, which
   *  the usage face renders as no line at all rather than a fabricated one. */
  usageLineOf(commandPath: string): string {
    const line = this.#nodeOf(commandPath).helpInformation().split("\n")[0] ?? "";
    return line;
  }

  /** The node one command path names — each segment a child of the one before it. An
   *  unresolvable path answers the program node, whose help line is the caller's business. */
  #nodeOf(commandPath: string): Command {
    let node = this.program;
    for (const segment of commandPath.split(" ")) {
      if (segment === "") continue;
      const child = node.commands.find((candidate) => candidate.name() === segment);
      if (child === undefined) return this.program;
      node = child;
    }
    return node;
  }

  /** One command node — description, option/argument binding, program scopes, the Examples
   *  injection and the nested leaves. */
  #projectCommand(spec: CliCommandSpec): void {
    const node = this.program.command(spec.name);
    node.description(spec.description);
    this.#bindOptions(node, spec.keys);
    this.#bindArguments(node, spec.positionals);
    this.#bindProgramScopes(node);
    if (spec.example !== undefined) node.addHelpText("after", `Examples:\n  ${spec.example}`);
    for (const leaf of spec.leaves ?? []) this.#projectLeaf(node, leaf);
  }

  /** One leaf node — each leaf binds its OWN declared keys, so the did-you-mean candidate
   *  set follows the errored node and never a sibling's. */
  #projectLeaf(parent: Command, leaf: CliLeafSpec): void {
    const node = parent.command(leaf.name);
    node.description(leaf.description);
    this.#bindOptions(node, leaf.keys);
    this.#bindArguments(node, leaf.positionals);
    this.#bindProgramScopes(node);
  }

  /** The option binding — declared keys → `.option()` / `.requiredOption()`. */
  #bindOptions(node: Command, keys: readonly CliArgSpec[]): void {
    for (const declared of keys) {
      const row = CHANNEL_TABLE[declared.key];
      // The channel guard closes every declared key; an absent row is structurally
      // unreachable and the guard, not this line, is the check.
      if (row === undefined) continue;
      this.#registerOption(node, declared, row);
    }
  }

  /** One option registration — the flags string with its value token, the channel help line
   *  (plus the required marker) and the value-domain parser when the row has a shape. */
  #registerOption(node: Command, declared: CliArgSpec, row: ChannelArgRow): void {
    const token = CommandTreeBuilder.#valueToken(row, declared.valueType);
    const flags = `${row.flag}${token === "" ? "" : ` ${token}`}`;
    const help = `${CommandTreeBuilder.#optionHelp(row, declared.valueType)}${
      declared.required === true ? " (required)" : ""
    }`;
    const parseArg = CommandTreeBuilder.#parseArgOf(row, declared.valueType);
    if (declared.required === true) {
      if (parseArg === undefined) node.requiredOption(flags, help);
      else node.requiredOption(flags, help, parseArg);
    } else if (parseArg === undefined) {
      node.option(flags, help);
    } else {
      node.option(flags, help, parseArg);
    }
  }

  /** The positional binding — `<name>` when required, `[name]` otherwise; the schema `type`
   *  argument validates through the one vocabulary. */
  #bindArguments(node: Command, positionals: readonly CliArgSpec[] | undefined): void {
    for (const positional of positionals ?? []) {
      const raw = positional.key;
      const bracket = positional.required === true ? `<${raw}>` : `[${raw}]`;
      const description = CommandTreeBuilder.#argumentDescription(raw);
      if (raw === "type") {
        node.argument(bracket, description, CommandTreeBuilder.#parseTypeKey);
      } else if (description === "") {
        node.argument(bracket);
      } else {
        node.argument(bracket, description);
      }
    }
  }

  /** The program-scope merge — every `program` row registers on the node, so a program flag
   *  is accepted at any position. The help row is skipped: `commander`'s built-in help
   *  option is that channel, and re-registering it would double the flag. */
  #bindProgramScopes(node: Command): void {
    for (const [key, row] of Object.entries(CHANNEL_TABLE)) {
      if (row.scope !== "program") continue;
      if (key === "help") continue;
      this.#registerOption(node, { key }, row);
    }
  }

  /** The conditional-required groups — the review/fix rows of `REQUIRED_GROUPS`: the target
   *  type's required face must be present. Non-exclusive, and a rejection is `commander`'s
   *  own error so the exit-code normalization needs no second branch. */
  #assertRequiredGroups(action: Command): void {
    const verb = action.name();
    if (verb !== "review" && verb !== "fix") return;
    const opts = action.opts();
    const type = typeof opts.type === "string" ? opts.type : undefined;
    if (type === undefined) return;
    const group = REQUIRED_GROUPS[verb][type];
    if (group === undefined) return;
    const missing = group.filter((flag) => opts[keyOfFlag(flag)] === undefined);
    if (missing.length > 0) {
      throw new InvalidArgumentError(`${missing.join(" ")} required when --type ${type}`);
    }
  }

  /** The program face's Examples section — the rows' example lines, single-sourced from the
   *  command declarations. */
  #injectProgramExamples(): void {
    const examples = CLI_COMMANDS.filter((spec) => spec.example !== undefined).map(
      (spec) => `  ${spec.example}`,
    );
    if (examples.length > 0) this.program.addHelpText("after", `Examples:\n${examples.join("\n")}`);
  }

  /** The value token of one option — the display suffix `commander` prints in the flags
   *  string. The branch override carries its own domain; the bool and string faces carry
   *  none. */
  static #valueToken(row: ChannelArgRow, override: CliValueOverride | undefined): string {
    if (override === "branch") return "<branch>";
    if (row.type === "path") return "<path>";
    if (row.type === "int-list") return "<n|n,n,…>";
    if (row.type === "enum") return `<${row.values.join("|")}>`;
    if (row.type === "int") return "<n>";
    return "";
  }

  /** One option's help line — the channel row's own text, or the branch override's domain
   *  sentence (the same override family as its `<branch>` token). */
  static #optionHelp(row: ChannelArgRow, override: CliValueOverride | undefined): string {
    return override === "branch" ? "the base branch name" : row.help;
  }

  /** One option's value-domain parser — table-driven, and absent for a row with no shape
   *  (or for the branch override, which registers none). */
  static #parseArgOf(
    row: ChannelArgRow,
    override: CliValueOverride | undefined,
  ): ((value: string) => string) | undefined {
    if (override === "branch") return undefined;
    const shape = (VALUE_SHAPES as Readonly<Record<string, { parse: ShapeParse } | undefined>>)[
      row.type
    ];
    if (shape === undefined) return undefined;
    return (value: string): string => {
      try {
        return shape.parse(value, row);
      } catch (raw) {
        if (raw instanceof InvalidArgumentValue) throw new InvalidArgumentError(raw.message);
        throw raw;
      }
    };
  }

  /** The schema `<type>` vocabulary check — primary spellings normalize to themselves, the
   *  legacy alias to its kebab key, and an unknown type rejects with the one vocabulary
   *  list. */
  static #parseTypeKey(raw: string): string {
    const key = SCHEMA_TYPE_KEYS[raw];
    if (key === undefined) {
      throw new InvalidArgumentError(
        `unknown schema type: ${raw} (available: ${SCHEMA_PRIMARY_KEYS.join(", ")})`,
      );
    }
    return key;
  }

  /** The `type` argument's description — the primary vocabulary, single-sourced from the
   *  alias table. */
  static #argumentDescription(raw: string): string {
    return raw === "type" ? `the schema type — ${SCHEMA_PRIMARY_KEYS.join(" | ")}` : "";
  }
}

/** The shape row's executor, as the builder reads it (a local alias so the cast above stays
 *  one line). */
type ShapeParse = (raw: string, row: ChannelArgRow) => string;

/** The program flag a `pure` command accepts at parse time — `ScopeGuard`'s request. */
export interface ScopeRequest {
  /** The command path the caller typed (`board` · `base set` · `schema get`). */
  readonly commandPath: string;
  /** Whether the program `--dry-run` flag was given. */
  readonly dryRun: boolean;
}

/**
 * ScopeGuard — the pure commands' `--dry-run` rejection. Invariant: the row set is
 * `SCOPE_ROWS` and every row answers the SAME usage member, so a refusal can never name a
 * reason of its own invention.
 */
export class ScopeGuard {
  readonly #rows: ReadonlyMap<string, string>;

  constructor(rows: readonly ScopeRow[] = SCOPE_ROWS) {
    this.#rows = new Map(rows.map((row) => [row.verb, row.flag]));
  }

  /** The rejection one request earns, or null when the command takes the flag. */
  rejectionOf(request: ScopeRequest): Usage | null {
    const verb = request.commandPath.split(" ")[0] ?? "";
    if (this.#rows.get(verb) === undefined) return null;
    if (!request.dryRun) return null;
    const reason: UsageReason = { kind: "dry-run-scope", command: request.commandPath };
    return { kind: "usage", reason };
  }
}
