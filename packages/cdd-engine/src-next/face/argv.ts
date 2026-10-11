// packages/cdd-engine/src-next/face/argv.ts
// T11 — the typed argv parse channel: tokenize + component-value validation
// (int-list tasks, enum type/source, sha base/head, int round) + the guardArgs
// semantics (every flag the command did not declare is rejected — the acceptance's
// unknown-flag BLOCK). The flag/value-type table is derived from the CLI
// declaration single surface (face/declare.ts §2.4 — the single source: a channel
// rename fails the guard scan), and the SAME resolved table is handed to the run
// face (cli.ts), which passes it to the capsule so a `next:` literal renders
// through the declared spellings. parse() throws CliUsageError; the run face's
// runArgv normalizes it to the usage line + message + exit 2 (the steady exit-code
// table). The parse channel is retired at T6 (the commander projection owns the
// parse + validation face from T3 on); the channel's usage bytes are the
// commander-native first-line shape (the declaration rows no longer carry a usage
// corpus — the six-line usage product retires with the registry at T2).
//
// Module-level exports are types / the parser class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { ConfigLoader } from "../infra/config.ts";
import {
  type ChannelArg,
  type ChannelValueType,
  CLI_COMMANDS,
  type CliArgSpec,
  type CliCommandSpec,
  type CliLeafName,
  type CliLeafSpec,
  type CliVerb,
  SCHEMA_TYPE_KEYS,
} from "./declare.ts";

/** One parsed command — the validated verb + values (undefined = the flag absent). */
export interface ParsedCommand {
  verb: CliVerb;
  leaf: CliLeafName | null;
  leafSpec: CliLeafSpec | null;
  args: Record<string, string>;
  positionals: readonly string[];
  dryRun: boolean;
  help: boolean;
}

/** The usage-error surface — parse rejects with the command's usage line attached
 *  (the run face prints `usage` then the message and exits 2 — the steady exit-code
 *  table's usage row), plus the command/leaf surface the error occurred on: base
 *  set and get share ONE usage line, so only the carried surface separates them —
 *  the did-you-mean scope (a leaf error never suggests a sibling leaf's flag). */
export class CliUsageError extends Error {
  readonly usage: string;
  readonly surface?: CliCommandSpec | CliLeafSpec;

  constructor(message: string, usage: string, surface?: CliCommandSpec | CliLeafSpec) {
    super(message);
    this.usage = usage;
    this.surface = surface;
  }
}

/**
 * ArgvParser — the typed argv parse face. `parse()` validates the verb + the leaf +
 * the flagged values (each by its component type) and rejects unknown flags (the
 * guardArgs semantics) + missing required keys; the verb/leaf/type data come from
 * the shared declaration surface (face/declare.ts), the flag spellings/type/enum
 * domains from the same argv channel. The program scopes (−-dry-run / −-help) are
 * accepted at any position; −-help pre-empts the leaf/argument scan on the parsed
 * command.
 */
export class ArgvParser {
  /** The injected dry-run default — the program scope's initial value (per-invocation
   *  `--dry-run` / `--no-dry-run` flags override it inside parse). */
  readonly #dryRun: boolean;
  /** The projector's doc-key set — the schema get leaf's value-domain hint. */
  readonly #docKeys: readonly string[];
  /** The resolved argv-channel table — the single flag/type/enum source. */
  readonly #channels: Record<string, ChannelArg>;

  constructor(opts: { config: ConfigLoader; dryRun?: boolean; docKeys: readonly string[] }) {
    this.#dryRun = opts.dryRun ?? false;
    this.#docKeys = opts.docKeys;
    this.#channels = this.#channelTableOf(opts.config);
  }

  /** The resolved channel table — the run face passes this SAME table to the
   *  capsule (the `next:` literal's declared flag spellings, never a hard-coded
   *  second format string). */
  channels(): Readonly<Record<string, ChannelArg>> {
    return this.#channels;
  }

  /** parse(argv) — the verb → (leaf) → flag/positional scan: every flag checked
   *  against the command's declared keys (the declare argv channel is the single
   *  flag/type source), every value validated by its component type, program
   *  scopes (−-dry-run / −-help) accepted at any position. Throws CliUsageError. */
  parse(raw: readonly string[]): ParsedCommand {
    const toks = [...raw];
    let dryRun = this.#dryRun;
    const help = toks.includes("--help") || toks.includes("-h");

    // The verb — the first non-flag token; anything before it must be program-level.
    let index = 0;
    while (index < toks.length && toks[index]!.startsWith("-")) {
      const name = this.#flagName(toks[index]!);
      if (name === "dry-run" || name === "no-dry-run" || name === "help" || name === "h") {
        if (name === "dry-run") dryRun = true;
        else if (name === "no-dry-run") dryRun = false;
        index += 1;
        continue;
      }
      throw this.#usage(`unknown option: ${toks[index]}`, "Usage: cdd [options] [command]");
    }
    const verbWord = toks[index];
    const spec =
      typeof verbWord === "string"
        ? CLI_COMMANDS.find((command) => command.name === verbWord)
        : undefined;
    if (spec === undefined) {
      throw this.#usage(
        typeof verbWord === "string"
          ? `unknown command: ${verbWord}`
          : "missing command — expected implement | review | fix | base | schema | issue",
        "Usage: cdd [options] [command]",
      );
    }
    index += 1;

    // The help pre-screen — a help flag anywhere pre-empts the leaf/argument scan
    // (the steady `cdd <command> --help` face renders the command's usage, never a
    // missing-subcommand or required-value error on top of the help the user asked
    // for — `cdd base --help` shows the leaf command's usage, no leaf word).
    if (help) {
      return {
        verb: spec.name,
        leaf: null,
        leafSpec: null,
        args: {},
        positionals: [],
        dryRun,
        help,
      };
    }

    // The nested leaf (base set|get · schema get · issue render).
    let leafSpec: CliLeafSpec | null = null;
    if (spec.leaves !== undefined) {
      const leafWord = toks[index];
      if (leafWord === undefined || leafWord.startsWith("-")) {
        throw this.#usage(
          `cdd ${spec.name}: missing subcommand — ${spec.leaves.map((l) => l.name).join(" | ")}`,
          this.#usageLine(spec, null),
        );
      }
      leafSpec = spec.leaves.find((l) => l.name === leafWord) ?? null;
      if (leafSpec === null)
        throw this.#usage(
          `cdd ${spec.name}: unknown subcommand: ${leafWord}`,
          this.#usageLine(spec, null),
        );
      index += 1;
    }
    const surface = leafSpec ?? spec;

    // The flag/positional scan.
    const args: Record<string, string> = {};
    const positionals: string[] = [];
    for (; index < toks.length; index += 1) {
      const tok = toks[index]!;
      if (tok === "--") {
        positionals.push(...toks.slice(index + 1));
        break;
      }
      if (!tok.startsWith("-")) {
        positionals.push(tok);
        continue;
      }
      const eq = tok.indexOf("=");
      const flag = eq === -1 ? tok : tok.slice(0, eq);
      const inline = eq === -1 ? null : tok.slice(eq + 1);
      const norm = this.#flagName(flag);
      if (norm === "dry-run" || norm === "no-dry-run" || norm === "help" || norm === "h") {
        if (inline !== null)
          throw this.#usage(
            `unexpected value for ${flag}`,
            this.#usageLine(spec, leafSpec),
            surface,
          );
        if (norm === "dry-run") dryRun = true;
        else if (norm === "no-dry-run") dryRun = false;
        continue;
      }
      const key = this.#declaredKey(surface, norm);
      const channel = key === null ? undefined : this.#channels[key];
      if (key === null || channel === undefined)
        throw this.#usage(`unknown option: ${tok}`, this.#usageLine(spec, leafSpec), surface);
      let value: string;
      if (channel.type === "bool") {
        if (inline !== null)
          throw this.#usage(
            `unexpected value for ${flag}`,
            this.#usageLine(spec, leafSpec),
            surface,
          );
        value = norm.startsWith("no-") ? "false" : "true";
      } else if (inline !== null) {
        value = inline;
      } else {
        index += 1;
        value = toks[index] ?? "";
        if (value.length === 0)
          throw this.#usage(`missing value for ${flag}`, this.#usageLine(spec, leafSpec), surface);
      }
      args[key] = this.#validate(spec, surface, key, channel, value);
    }

    // Required declared keys + positionals; extra positionals rejected.
    for (const declared of surface.keys) {
      if (declared.required === true && args[declared.key] === undefined) {
        const flag = this.#channels[declared.key]?.flag ?? `--${declared.key}`;
        throw this.#usage(
          `cdd ${spec.name}: missing required ${flag}`,
          this.#usageLine(spec, leafSpec),
        );
      }
    }
    for (const positional of surface.positionals ?? []) {
      if (positional.required === true && positionals.length === 0) {
        throw this.#usage(
          `cdd ${spec.name}: missing required <${positional.key}>`,
          this.#usageLine(spec, leafSpec),
        );
      }
    }
    if ((surface.positionals ?? []).length < positionals.length) {
      throw this.#usage(
        `cdd ${spec.name}: unexpected argument: ${positionals[(surface.positionals ?? []).length]}`,
        this.#usageLine(spec, leafSpec),
      );
    }

    return {
      verb: spec.name,
      leaf: leafSpec?.name ?? null,
      leafSpec,
      args,
      positionals: this.#positionalsOf(spec, leafSpec, positionals),
      dryRun,
      help,
    };
  }

  /** The engine-config argv channel as the key → flag/type/values table. */
  #channelTableOf(config: ConfigLoader): Record<string, ChannelArg> {
    const out: Record<string, ChannelArg> = {};
    const argv = config.engineConfig().contextContract?.channels?.argv;
    if (argv === undefined) return out;
    for (const [key, entry] of Object.entries(argv)) {
      const row = entry as {
        flag?: string;
        type?: string;
        values?: readonly string[];
        help?: string;
      };
      out[key] = {
        key,
        flag: row.flag ?? `--${key}`,
        type: (row.type as ChannelValueType) ?? "string",
        values: row.values,
        help: row.help,
      };
    }
    return out;
  }

  /** The normalized flag name of a token (`--tasks=1` → `tasks`). */
  #flagName(token: string): string {
    return token.replace(/^-{1,2}/, "").split("=")[0]!;
  }

  /** Resolve a normalized flag to its declared channel key (with the bool `--no-…`
   *  negation spelling); null = the flag is not declared → the unknown-option guard. */
  #declaredKey(surface: CliCommandSpec | CliLeafSpec, norm: string): string | null {
    if (norm.startsWith("no-")) {
      const key = norm.slice(3);
      return this.#channels[key]?.type === "bool" ? key : null;
    }
    for (const declared of surface.keys) {
      const channel = this.#channels[declared.key];
      if (channel !== undefined && channel.flag.replace(/^-{1,2}/, "") === norm)
        return declared.key;
    }
    return null;
  }

  /** Component-value validation — the channel type's shape (with the declared
   *  value-type override); a violation is the usage error of the command's surface. */
  #validate(
    spec: CliCommandSpec,
    surface: CliCommandSpec | CliLeafSpec,
    key: string,
    channel: ChannelArg,
    value: string,
  ): string {
    const leaf = surface === spec ? null : (surface as CliLeafSpec);
    const override = (surface.keys as readonly CliArgSpec[]).find(
      (declared) => declared.key === key,
    )?.valueType;
    const type = override === "branch" ? "string" : channel.type;
    switch (type) {
      case "int-list": {
        const tokens = value.split(",").map((part) => part.trim());
        const invalid = tokens.find((part) => !/^\d+$/.test(part));
        if (invalid !== undefined) {
          throw this.#usage(
            `cdd ${spec.name}: --${key} must be comma-separated integers: ${invalid}`,
            this.#usageLine(spec, leaf),
          );
        }
        return [...new Set(tokens.map(Number))].sort((a, b) => a - b).join(",");
      }
      case "enum":
        if (channel.values === undefined || !channel.values.includes(value)) {
          throw this.#usage(
            `cdd ${spec.name}: --${key} must be one of ${channel.values?.join(" | ")}`,
            this.#usageLine(spec, leaf),
          );
        }
        return value;
      case "sha":
        // find #10 (spec §6.6 · the user's ruling: no long shas anywhere in the
        // engine): the CLI sha channel accepts the 8-char short form (40-char
        // full shas retired).
        if (!/^[0-9a-f]{8}$/.test(value)) {
          throw this.#usage(
            `cdd ${spec.name}: --${key} must be an 8-char sha`,
            this.#usageLine(spec, leaf),
          );
        }
        return value;
      case "int":
        if (!/^\d+$/.test(value))
          throw this.#usage(
            `cdd ${spec.name}: --${key} must be an integer`,
            this.#usageLine(spec, leaf),
          );
        return value;
      case "bool":
        // the value already carries the parsed spelling ("true" for --force · "false"
        // for --no-force) — pass it through, never force the positive.
        return value;
      case "path":
      case "string":
        return value;
    }
  }

  /** The declared positional values, validated per leaf — `schema get`'s and
   *  `schema gen`'s <type> ride the SAME vocabulary (`SCHEMA_TYPE_KEYS` — the one
   *  table, two faces, spec §5.3): the legacy `phaseSpec` alias normalizes to
   *  the kebab key on both leaves. The get leaf additionally routes `plan-graph`
   *  (a display type, never a doc key); the gen leaf does not — each leaf's
   *  missing/unknown faces name the leaf's own values (get: overall, plan,
   *  phase-spec, plan-graph · gen: overall, plan, phase-spec). */
  #positionalsOf(
    spec: CliCommandSpec,
    leafSpec: CliLeafSpec | null,
    positionals: readonly string[],
  ): string[] {
    const surface = leafSpec ?? spec;
    const declared = surface.positionals ?? [];
    return declared.map((positional, index) => {
      const value = positionals[index];
      if (positional.key === "type" && surface.name === "gen") {
        if (value === undefined) {
          throw this.#usage("cdd schema gen: missing <type>", this.#usageLine(spec, leafSpec));
        }
        const key = SCHEMA_TYPE_KEYS[value];
        if (key === undefined) {
          throw this.#usage(
            `cdd schema gen: unknown schema type: ${value} (available: overall, plan, phase-spec)`,
            this.#usageLine(spec, leafSpec),
          );
        }
        return key;
      }
      // The get leaf — the one shared vocabulary plus the plan-graph display route.
      if (positional.key === "type" && value !== "plan-graph") {
        const key = SCHEMA_TYPE_KEYS[value!];
        if (key === undefined) {
          throw this.#usage(
            `cdd schema get: unknown schema type: ${value} (available: ${[...this.#docKeys, "plan-graph"].join(", ")})`,
            this.#usageLine(spec, leafSpec),
          );
        }
        return key;
      }
      return value!;
    });
  }

  /** The commander-native usage line of the errored surface — the transitional
   *  parse channel's usage byte (`Usage: cdd <verb>[ <leaf>] [options]` — the
   *  surface's helpInformation() first-line shape; the declaration rows carry no
   *  usage corpus and the T3+ product is the projection's commander-native face).
   *  Retired with the parse channel at T6. */
  #usageLine(spec: CliCommandSpec, leaf: CliLeafSpec | null): string {
    const leafName = leaf === null ? "" : ` ${leaf.name}`;
    return `Usage: cdd ${spec.name}${leafName} [options]`;
  }

  /** The usage-error constructor shorthand (the command's usage line + the error's
   *  command/leaf surface ride the error — the surface is the did-you-mean scope). */
  #usage(message: string, usage: string, surface?: CliCommandSpec | CliLeafSpec): CliUsageError {
    return new CliUsageError(message, usage, surface);
  }
}
