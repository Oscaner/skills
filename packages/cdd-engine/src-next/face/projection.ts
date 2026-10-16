// packages/cdd-engine/src-next/face/projection.ts
// §2.1 — the single projection class: the declare single surface (face/declare.ts
// — the argv channel + the seven-command rows + REQUIRED_GROUPS) assembles the
// commander command tree, ENTIRELY in the constructor (the constructor-is-the-
// assembly stance · §2.1/§2.3):
// the top-level `cdd` program · the seven commands with their descriptions · the
// nested leaves (base set|get · schema get|gen · issue render) · the binding rules
// (command keys → .option()/.requiredOption() · positionals → .argument() ·
// bool rows single-spelling · the program scope merged into every node · the help
// channel row un-projected — the built-in helpOption) · the parseArg value-domain
// validation (commander.InvalidArgumentError · §4.1 · the retired validator) ·
// the program-level preAction conditional-required hook (REQUIRED_GROUPS · §4.2)
// · the help injections (§5.1 — Examples + the --dry-run tail note).
//
// The class's one exit is `readonly program: Command` — the T3 composition root
// parses through it and Its help/usage bytes are the commander-native product (the
// self-built usage corpus never existed here). Zero module-level behavior-
// carrying bare functions — the projection algorithm lives in the single
// CommandTreeBuilder class; the value-domain rules are declaration data
// (declare.ts VALUE_SHAPES), read by the builder's one table-driven executor
// (the plan's zero-bare-function discipline).

import { Command, InvalidArgumentError } from "commander";

import {
  ARGV_CHANNEL,
  type ChannelArgRow,
  CLI_COMMANDS,
  type CliArgSpec,
  type CliCommandSpec,
  type CliLeafSpec,
  type CliValueOverride,
  REQUIRED_GROUPS,
  SCHEMA_TYPE_KEYS,
  VALUE_SHAPES,
} from "./declare.ts";

/** The primary schema <type> spellings — the self-mapping vocabulary rows (the
 *  argument description's value list; derived from the one table, never a
 *  hand-written second list). */
const SCHEMA_PRIMARY_KEYS: readonly string[] = Object.entries(SCHEMA_TYPE_KEYS)
  .filter(([spelling, key]) => spelling === key)
  .map(([spelling]) => spelling);

/** The channel table widened to its record face — the literal const stays the
 *  declaration's data source (its `satisfies` pins the row type at declare.ts);
 *  the projection indexes it by declared key at runtime. */
const CHANNEL_TABLE: Readonly<Record<string, ChannelArgRow>> = ARGV_CHANNEL;

/** The value-domain table widened to its lookup face — the literal const stays
 *  the declaration's data source; the projection indexes it by the row's
 *  declared type and absence (the string/path/bool faces) registers no parser. */
const SHAPE_TABLE: Readonly<
  Record<string, { parse(raw: string, row: ChannelArgRow): string } | undefined>
> = VALUE_SHAPES;

/**
 * CommandTreeBuilder — the declaration → commander projection. The constructor
 * performs the whole assembly; `program` is the complete tree (parse + help +
 * validation + the preAction groups all wired). The value-domain rejections throw
 * commander.InvalidArgumentError (the composed pipeline names the option + value
 * with the commander-native bytes — the usage domain's exit 2 is the run face's
 * normalization, §3.1).
 */
export class CommandTreeBuilder {
  /** The assembled commander program — the composition root's parse + help face. */
  readonly program: Command;

  constructor() {
    this.program = new Command("cdd");
    // The exit override is wired FIRST — every .command() copies the inherited
    // settings (incl. the callback), so a parse rejection anywhere in the tree
    // throws the CommanderError instead of process.exit (the discrimination face
    // of §3.1: err.code + err.exitCode). The projection tests assert through the
    // same thrown errors.
    this.program.exitOverride();
    this.program.description("the CDD engine's command line");
    this.program.addHelpText("afterAll", "program flags (accepted at any position): --dry-run");
    this.#bindProgramScopes(this.program);
    this.#injectProgramExamples();
    for (const spec of CLI_COMMANDS) this.#projectCommand(spec);
    this.program.hook("preAction", (_thisCommand, actionCommand) =>
      this.#assertRequiredGroups(actionCommand),
    );
  }

  // ---------------------------------------------------------------------------
  // the command-tree projection
  // ---------------------------------------------------------------------------

  /** One command node — the description + the option/argument binding + the
   *  program scopes + the Examples injection + the nested leaves. */
  #projectCommand(spec: CliCommandSpec): void {
    const node = this.program.command(spec.name);
    node.description(spec.description);
    this.#bindOptions(node, spec.keys);
    this.#bindArguments(node, spec.positionals);
    this.#bindProgramScopes(node);
    if (spec.example !== undefined) {
      node.addHelpText("after", `Examples:\n  ${spec.example}`);
    }
    for (const leaf of spec.leaves ?? []) this.#projectLeaf(node, leaf);
  }

  /** One leaf node (base set|get · schema get|gen · issue render) — the leaf
   *  granularity is structural: each leaf binds its OWN declared keys (the §5.3
   *  did-you-mean candidate sets follow the errored node, never a sibling's). */
  #projectLeaf(parent: Command, leaf: CliLeafSpec): void {
    const node = parent.command(leaf.name);
    node.description(leaf.description);
    this.#bindOptions(node, leaf.keys);
    this.#bindArguments(node, leaf.positionals);
    this.#bindProgramScopes(node);
  }

  /** The option binding — the surface's declared keys → .option() /
   *  .requiredOption() (the row's flag + the value-domain token + the channel
   *  help text; the required rows ride .requiredOption()). */
  #bindOptions(node: Command, keys: readonly CliArgSpec[]): void {
    for (const declared of keys) {
      const row = CHANNEL_TABLE[declared.key];
      // The channel audit (guard §2.2) closes every declared key — an absent row
      // here is structurally unreachable; the guard stays the single check.
      if (row === undefined) continue;
      this.#registerOption(node, declared, row);
    }
  }

  /** One option registration on a node — the flags string (the value-domain token
   *  rides the option's own suffix, §5.2), the channel description (+ the
   *  required marker) and the value-domain parseArg (when the type validates). */
  #registerOption(node: Command, declared: CliArgSpec, row: ChannelArgRow): void {
    const token = this.#valueToken(row, declared.valueType);
    const flags = `${row.flag}${token === "" ? "" : ` ${token}`}`;
    const help = `${this.#optionHelp(row, declared.valueType)}${declared.required === true ? " (required)" : ""}`;
    const parseArg = this.#parseArgOf(row, declared.valueType);
    if (declared.required === true) {
      if (parseArg === undefined) node.requiredOption(flags, help);
      else node.requiredOption(flags, help, parseArg);
    } else if (parseArg === undefined) {
      node.option(flags, help);
    } else {
      node.option(flags, help, parseArg);
    }
  }

  /** The positional binding — one .argument() per declared positional (required →
   *  `<name>`, optional → `[name]`; the schema <type> argument validates through
   *  the typeKey vocabulary). */
  #bindArguments(node: Command, positionals: readonly CliArgSpec[] | undefined): void {
    for (const positional of positionals ?? []) {
      const raw = positional.key;
      const bracket = positional.required === true ? `<${raw}>` : `[${raw}]`;
      const description = this.#argumentDescription(raw);
      const parseArg = raw === "type" ? (value: string) => this.#parseTypeKey(value) : undefined;
      if (parseArg === undefined) {
        if (description === "") node.argument(bracket);
        else node.argument(bracket, description);
      } else {
        node.argument(bracket, description, parseArg);
      }
    }
  }

  /** The program-scope merge — every `scope: "program"` channel row registers on
   *  the node (the any-position program-flag semantics, §2.1 cli.test.ts pins
   *  494/698); the help row is skipped (the built-in helpOption face — never
   *  re-registered). Each node registers its own copy once (never re-registered). */
  #bindProgramScopes(node: Command): void {
    for (const [key, row] of Object.entries(CHANNEL_TABLE)) {
      if (row.scope !== "program") continue;
      if (key === "help") continue;
      this.#registerOption(node, { key, required: false }, row);
    }
  }

  // ---------------------------------------------------------------------------
  // the value-domain validation (parseArg · commander.InvalidArgumentError · §4.1)
  // ---------------------------------------------------------------------------

  /** The value-domain token of one option — the display suffix (`<path>` ·
   *  `<n|n,n,…>` · `<a|b|c>` · `<n>`); the branch value-type override carries its
   *  own domain, the bool/string faces carry none. */
  #valueToken(row: ChannelArgRow, override: CliValueOverride | undefined): string {
    if (override === "branch") return "<branch>";
    switch (row.type) {
      case "path":
        return "<path>";
      case "int-list":
        return "<n|n,n,…>";
      case "enum":
        return `<${[...(row.values ?? [])].join("|")}>`;
      case "int":
        return "<n>";
      default:
        // bool / string — the flag alone carries the value domain face.
        return "";
    }
  }

  /** The option's help text — the channel row's single-source flag-level line;
   *  the branch value-type override swaps it for its own domain (the base-set
   *  face names the branch — the same override family as #valueToken's `<branch>`
   *  token). */
  #optionHelp(row: ChannelArgRow, override: CliValueOverride | undefined): string {
    if (override === "branch") return "the base branch name";
    return row.help ?? "";
  }

  /** The option's custom parser — the value-domain check of the validated
   *  types, table-driven from the declaration's VALUE_SHAPES (the branch
   *  override and the string/path/bool faces register none — a row without a
   *  shape gets no parser; absence is the registered face). */
  #parseArgOf(
    row: ChannelArgRow,
    override: CliValueOverride | undefined,
  ): ((value: string) => string) | undefined {
    if (override === "branch") return undefined;
    const shape = SHAPE_TABLE[row.type];
    if (shape === undefined) return undefined;
    return (value) => shape.parse(value, row);
  }

  /** The schema `<type>` vocabulary check — the primary spellings validate and
   *  normalize to themselves, the legacy `phaseSpec` alias normalizes to the kebab
   *  key, an out-of-vocabulary type rejects (spec §5.3). */
  #parseTypeKey(raw: string): string {
    const key = SCHEMA_TYPE_KEYS[raw];
    if (key === undefined) {
      throw new InvalidArgumentError(
        `unknown schema type: ${raw} (available: ${SCHEMA_PRIMARY_KEYS.join(", ")})`,
      );
    }
    return key;
  }

  /** The argument's help description — the schema <type> face names its primary
   *  vocabulary (single-sourced at SCHEMA_TYPE_KEYS). */
  #argumentDescription(raw: string): string {
    if (raw === "type") return `the schema type — ${SCHEMA_PRIMARY_KEYS.join(" | ")}`;
    return "";
  }

  // ---------------------------------------------------------------------------
  // the conditional-required groups (preAction · §4.2)
  // ---------------------------------------------------------------------------

  /** The preAction assertion — the review/fix work commands' REQUIRED_GROUPS
   *  data: the target type's required face must be present on the action command's
   *  opts; a missing face throws the same InvalidArgumentError pipeline as a
   *  parseArg rejection (the run face normalizes it into the usage domain's exit
   *  2). Non-exclusive — both `--plan` and `--spec` stay accepted together
   *  (no mutual-exclusion rejection). */
  #assertRequiredGroups(actionCommand: Command): void {
    const verb = actionCommand.name();
    if (verb !== "review" && verb !== "fix") return;
    const type = actionCommand.opts().type as string | undefined;
    if (type === undefined) return;
    const group = REQUIRED_GROUPS[verb][type];
    if (group === undefined) return;
    const missing = group.filter((flag) => actionCommand.opts()[flag.slice(2)] === undefined);
    if (missing.length > 0) {
      throw new InvalidArgumentError(`${missing.join(" ")} required when --type ${type}`);
    }
  }

  // ---------------------------------------------------------------------------
  // the help injections (§5.1 — Examples + the --dry-run tail note)
  // ---------------------------------------------------------------------------

  /** The program face's Examples section — the rows' example lines (the P1
   *  sentences, single-sourced at the CLI_COMMANDS `example` fields). */
  #injectProgramExamples(): void {
    const examples: string[] = [];
    for (const spec of CLI_COMMANDS) {
      if (spec.example !== undefined) examples.push(`  ${spec.example}`);
    }
    if (examples.length > 0) {
      this.program.addHelpText("after", `Examples:\n${examples.join("\n")}`);
    }
  }
}
