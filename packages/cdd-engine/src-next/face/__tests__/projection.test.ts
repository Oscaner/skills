// packages/cdd-engine/src-next/face/__tests__/projection.test.ts
// T2 — the CommandTreeBuilder projection suite (spec §2.1/§4): the constructor
// assembles the whole command tree from the declare single surface — the six
// commands + the nested leaves, the binding rules (command keys → .option() /
// .requiredOption() · positionals → .argument() · bool rows single-spelling · the
// program scope merged into every node · the built-in help row un-projected), the
// value-domain validation through the commander pipeline (parseArg →
// commander.invalidArgument · §4.1) and the conditional-required preAction hook
// (REQUIRED_GROUPS · §4.2). Instance-level assertions — the projections are read
// off the assembled program, never a re-declared expectation list.

import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { describe, expect, it } from "vitest";

import type { ChannelArgRow } from "../declare.ts";
import { VALUE_SHAPES } from "../declare.ts";
import { CommandTreeBuilder } from "../projection.ts";
import { negatedOf } from "./negation.ts";

/** The command node of one verb. */
function commandOf(program: Command, verb: string): Command {
  const node = program.commands.find((command) => command.name() === verb);
  expect(node, `the ${verb} command node exists`).toBeDefined();
  return node!;
}

/** The leaf node of one parent command. */
function leafOf(parent: Command, name: string): Command {
  const node = parent.commands.find((command) => command.name() === name);
  expect(node, `the ${name} leaf exists`).toBeDefined();
  return node!;
}

/** The code + message of the commander error `fn` rejects with (the builder's
 *  program carries the throwing exitOverride — the composed parse rejects, never
 *  process.exit). */
function commanderError(fn: () => void): { code: string; message: string } {
  let raw: unknown = null;
  try {
    fn();
  } catch (caught) {
    raw = caught;
  }
  const error = raw as { code?: unknown; message?: unknown };
  expect(error, "expected the commander pipeline to reject").toBeTruthy();
  expect(typeof error.code, "the rejection carries a commander error code").toBe("string");
  return {
    code: error.code as string,
    message: typeof error.message === "string" ? error.message : "",
  };
}

describe("CommandTreeBuilder — the declaration projection (the constructor is the assembly)", () => {
  it("assembles the six subcommand nodes from the CLI_COMMANDS rows, in the declared order", () => {
    const { program } = new CommandTreeBuilder();
    expect(program.commands.map((command) => command.name())).toEqual([
      "implement",
      "review",
      "fix",
      "base",
      "schema",
      "issue",
    ]);
  });

  it("projects the review surface — every declared key option, --type as a requiredOption", () => {
    const { program } = new CommandTreeBuilder();
    const review = commandOf(program, "review");
    for (const key of [
      "--type",
      "--tasks",
      "--plan",
      "--spec",
      "--base",
      "--head",
      "--round",
      "--root",
    ]) {
      expect(
        review.options.some((option) => option.flags.startsWith(key)),
        `review declares ${key}`,
      ).toBe(true);
    }
    const typeOption = review.options.find((option) => option.attributeName() === "type");
    expect(typeOption?.mandatory, "--type rides .requiredOption()").toBe(true);
    const tasksOption = review.options.find((option) => option.attributeName() === "tasks");
    expect(tasksOption?.mandatory, "--tasks stays a plain .option()").toBe(false);
  });

  it("registers the program scope --dry-run on the program and on every node — the positive spelling only (the negated form is never registered)", () => {
    const { program } = new CommandTreeBuilder();
    // the retired negated spelling is composed via the shared synthesizer —
    // the literal token never appears in the tree (the zero-consumption pin)
    expect(program.options.some((option) => option.flags === "--dry-run")).toBe(true);
    expect(program.options.some((option) => option.flags === negatedOf("--dry-run"))).toBe(false);
    const nodes = [program, ...program.commands, ...program.commands.flatMap((c) => c.commands)];
    for (const node of nodes) {
      expect(
        node.options.some((option) => option.flags === "--dry-run"),
        `the ${node.name()} node is usable with --dry-run`,
      ).toBe(true);
    }
  });

  it("never re-registers the built-in -h/--help (the help channel row is not projected)", () => {
    const { program } = new CommandTreeBuilder();
    const nodes = [program, ...program.commands, ...program.commands.flatMap((c) => c.commands)];
    for (const node of nodes) {
      for (const option of node.options) {
        // The built-in helpOption's flags string — the only spelling that would
        // indicate a duplicated help option (the --head option is not a help flag).
        expect(option.flags, `the ${node.name()} node duplicates no help flag`).not.toContain(
          "-h, --help",
        );
      }
    }
  });

  it("nests base set|get — each leaf holds its own declared keys (set --force, get without)", () => {
    const { program } = new CommandTreeBuilder();
    const base = commandOf(program, "base");
    expect(base.commands.map((command) => command.name())).toEqual(["set", "get"]);
    const set = leafOf(base, "set");
    const get = leafOf(base, "get");
    expect(set.options.some((option) => option.flags.startsWith("--force"))).toBe(true);
    expect(get.options.some((option) => option.flags.startsWith("--force"))).toBe(false);
    expect(get.options.some((option) => option.flags.startsWith("--plan"))).toBe(true);
    // base set's --base carries the branch override domain, never the sha face.
    const baseOption = set.options.find((option) => option.flags.startsWith("--base"));
    expect(baseOption?.flags).toBe("--base <branch>");
    // …and its description swaps to the branch domain too — the review range's
    // sha row ("8-char sha") would contradict the <branch> token on one option.
    expect(baseOption?.description).toBe("the base branch of the range (required)");
  });

  it("nests schema get|gen and issue render", () => {
    const { program } = new CommandTreeBuilder();
    const schema = commandOf(program, "schema");
    expect(schema.commands.map((command) => command.name())).toEqual(["get", "gen"]);
    const issue = commandOf(program, "issue");
    expect(issue.commands.map((command) => command.name())).toEqual(["render"]);
  });

  it("projects the positionals — schema get requires <type>, schema gen takes it optionally", () => {
    const { program } = new CommandTreeBuilder();
    const schema = commandOf(program, "schema");
    const get = leafOf(schema, "get");
    const gen = leafOf(schema, "gen");
    expect(get.registeredArguments[0]?.required).toBe(true);
    expect(gen.registeredArguments[0]?.required).toBe(false);
  });
});

describe("the commander pipeline — parseArg value-domain rejection + the normalized value (§4.1)", () => {
  it("rejects a non-integer --tasks token with commander.invalidArgument — the domain and the raw value in the message", () => {
    const { program } = new CommandTreeBuilder();
    const { code, message } = commanderError(() =>
      program.parse(["review", "--tasks", "abc"], { from: "user" }),
    );
    expect(code).toBe("commander.invalidArgument");
    expect(message).toContain("--tasks <n|n,n,…>");
    expect(message).toContain("abc");
  });

  it("normalizes --tasks to the sorted deduped comma string (2,1,1 → 1,2)", () => {
    const { program } = new CommandTreeBuilder();
    const review = commandOf(program, "review");
    program.parse(["review", "--type", "wave", "--tasks", "2,1,1", "--plan", "docs/x.md"], {
      from: "user",
    });
    expect(review.getOptionValue("tasks")).toBe("1,2");
  });

  it("rejects an out-of-enum --type and a bogus schema <type>", () => {
    const program = new CommandTreeBuilder().program;
    expect(
      commanderError(() => program.parse(["review", "--type", "bogus"], { from: "user" })).code,
    ).toBe("commander.invalidArgument");
    expect(
      commanderError(() => program.parse(["schema", "get", "bogus"], { from: "user" })).code,
    ).toBe("commander.invalidArgument");
  });

  it("accepts the schema <type> vocabulary — the phaseSpec alias normalizes, plan-graph passes through", () => {
    const schemaProgram = new CommandTreeBuilder();
    const get = leafOf(commandOf(schemaProgram.program, "schema"), "get");
    schemaProgram.program.parse(["schema", "get", "phaseSpec"], { from: "user" });
    expect(get.processedArgs[0]).toBe("phase-spec");
    const graphProgram = new CommandTreeBuilder();
    const getGraph = leafOf(commandOf(graphProgram.program, "schema"), "get");
    graphProgram.program.parse(["schema", "get", "plan-graph"], { from: "user" });
    expect(getGraph.processedArgs[0]).toBe("plan-graph");
  });
});

describe("the preAction conditional-required groups (§4.2 · REQUIRED_GROUPS)", () => {
  it("rejects review --type wave without --plan, accepts it with both --plan and --spec (non-exclusive)", () => {
    const { program } = new CommandTreeBuilder();
    // commander's preAction fires only for commands with an action handler — the
    // T3 composition root wires the .action thin shells; the test attaches a
    // no-op action to observe the hook the way the root will.
    commandOf(program, "review").action(() => undefined);
    const { code, message } = commanderError(() =>
      program.parse(["review", "--type", "wave"], { from: "user" }),
    );
    expect(code).toBe("commander.invalidArgument");
    expect(message).toContain("--plan required when --type wave");
    expect(() =>
      program.parse(["review", "--type", "wave", "--plan", "docs/x.md", "--spec", "docs/y.md"], {
        from: "user",
      }),
    ).not.toThrow();
  });

  it("rejects fix --type branch without --findings (the fix branch face)", () => {
    const { program } = new CommandTreeBuilder();
    commandOf(program, "fix").action(() => undefined);
    const { code, message } = commanderError(() =>
      program.parse(["fix", "--type", "branch"], { from: "user" }),
    );
    expect(code).toBe("commander.invalidArgument");
    expect(message).toContain("--findings required when --type branch");
  });
});

describe("the value-domain table declaration — VALUE_SHAPES (T7)", () => {
  it("the shaped-channel key set — the four validated types, and only those (the table-source pin)", () => {
    // The value-domain shape derives from the declaration table, never a second
    // hand-written list: the key set is exactly the validated subset of the
    // channel type vocabulary (string/path/bool faces carry no parser — the
    // shaped-channel record face excludes them by construction).
    expect(Object.keys(VALUE_SHAPES)).toEqual(["enum", "int-list", "sha", "int"]);
    for (const key of Object.keys(VALUE_SHAPES)) {
      expect(typeof VALUE_SHAPES[key as keyof typeof VALUE_SHAPES].parse).toBe("function");
    }
  });

  it("the enum domain reads the row's declared values — an out-of-domain raw rejects", () => {
    const row: ChannelArgRow = { flag: "--type", type: "enum", values: ["wave", "branch"] };
    expect(VALUE_SHAPES.enum.parse("wave", row)).toBe("wave");
    const { code, message } = commanderError(() => VALUE_SHAPES.enum.parse("plan", row));
    expect(code).toBe("commander.invalidArgument");
    expect(message).toBe("must be one of wave | branch");
  });

  it("the int-list normalizes to the sorted deduped comma string and rejects non-integers", () => {
    const row: ChannelArgRow = { flag: "--tasks", type: "int-list" };
    expect(VALUE_SHAPES["int-list"].parse("3,1,3,2", row)).toBe("1,2,3");
    const { code, message } = commanderError(() => VALUE_SHAPES["int-list"].parse("1,x", row));
    expect(code).toBe("commander.invalidArgument");
    expect(message).toBe("--tasks <n|n,n,…> — must be comma-separated integers: x");
  });

  it("the sha + int faces reject a non-conforming raw with the pinned byte messages", () => {
    const shaRow: ChannelArgRow = { flag: "--base", type: "sha" };
    expect(VALUE_SHAPES.sha.parse("0f3be2a1", shaRow)).toBe("0f3be2a1");
    const { code: shaCode, message: shaMessage } = commanderError(() =>
      VALUE_SHAPES.sha.parse("nope", shaRow),
    );
    expect(shaCode).toBe("commander.invalidArgument");
    expect(shaMessage).toBe("must be an 8-char sha");

    const intRow: ChannelArgRow = { flag: "--round", type: "int" };
    expect(VALUE_SHAPES.int.parse("7", intRow)).toBe("7");
    const { code: intCode, message: intMessage } = commanderError(() =>
      VALUE_SHAPES.int.parse("-1", intRow),
    );
    expect(intCode).toBe("commander.invalidArgument");
    expect(intMessage).toBe("must be an integer");
  });

  it("the hand-written replication is destroyed — the four #parse* methods are gone from the projection (the grep pin)", () => {
    const source = readFileSync(new URL("../projection.ts", import.meta.url), "utf8");
    for (const method of ["#parseEnum", "#parseInts", "#parseSha8", "#parseInt"] as const) {
      expect(
        source.includes(method),
        `${method} must not survive the table migration (the value-domain rules live in VALUE_SHAPES)`,
      ).toBe(false);
    }
  });

  it("the schema <type> vocabulary is retained — #parseTypeKey + SCHEMA_TYPE_KEYS stay out of the destroy list (T9)", () => {
    const projection = readFileSync(new URL("../projection.ts", import.meta.url), "utf8");
    const declare = readFileSync(new URL("../declare.ts", import.meta.url), "utf8");
    // The retention disposition (plan T7 — the spec §6.3 cross-reference): the pair
    // is §6.3-listed but T7 records it as RETAINED, never on the destroy list —
    // SCHEMA_TYPE_KEYS is the schema gen/get <type> doc-key vocabulary, orthogonal
    // to the ChannelValueType value-shape table (merging it into VALUE_SHAPES does
    // not fit); #parseTypeKey derives through it (the get leaf also routes the
    // plan-graph display type).
    expect(projection).toContain("#parseTypeKey");
    expect(projection).toContain("SCHEMA_TYPE_KEYS");
    expect(declare).toContain("SCHEMA_TYPE_KEYS");
  });
});
