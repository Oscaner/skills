// packages/cdd-engine/src/__tests__/slice-invariants.test.ts
// The phase's three checkable faces, each read off a registration surface the tree already
// holds — never off a second roster written here:
//
//   ① the eight entry-class invariants, judged by CONTENT: the comment block immediately
//      above each entry class, folded into paragraphs, must still carry the one sentence
//      that slice declares. Rewriting that sentence goes red; rewording the same block's other
//      paragraphs does not — and that neighbour arm locates those paragraphs by structure (a
//      run the sentence is not in), never by a phrase a legal reword may drop. An "the first
//      paragraph exists" assertion could not demonstrate that arm at all, because every one
//      of these blocks has a continuation below it;
//   ② the depth criterion — one forwarding row of the entry class per implementation module
//      of its slice. The counted set is the PROTOTYPE's function-valued members: the
//      constructor is not a row, an accessor is not a row (a getter has no `value`), and an
//      injected collaborator is an instance field, so it is not a row either;
//   ③ the three deletability registrations — the command shells, the board's tree-fact word
//      rows and the rule registry — where deleting one unit costs exactly its own row. Each is
//      read against a SECOND source (the shell files on disk, the word table, the strategy
//      roster the judging module declares), never against a second copy of its own rows: a
//      registration compared with itself stays green through the deletion it exists to catch.
//
// Zero module-level bare functions — every helper below is a `const` arrow.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Documents } from "../docs/index.ts";
import * as invariants from "../docs/judging/invariants.ts";
import { RULE_REGISTRY } from "../docs/judging/rules.ts";
import { Env } from "../env/index.ts";
import type { BoardFacts } from "../run/index.ts";
import { Run } from "../run/index.ts";
import { CLI_COMMANDS } from "../surface/commands/declare.ts";
import { Cli } from "../surface/index.ts";
import { WORDS } from "../surface/words/words.ts";

/** The engine's `src` root — every read below is relative to it. */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** One `src`-relative module's text. */
const textOf = (rel: string): string => readFileSync(path.join(SRC, rel), "utf8");

/** Whether a line is comment prose — the three spellings this tree's headers use: a `//`
 *  block, a jsdoc line (` *`), and the `/` form that OPENS a jsdoc block (`/**`). */
const isCommentLine = (line: string): boolean => /^\s*(?:\/\/|\*|\/\*)/.test(line);

/** One comment line's prose: the block marker stripped, the rest trimmed. */
const proseOf = (line: string): string =>
  line
    .replace(/^\s*\/\*\*/, "")
    .replace(/\*\/\s*$/, "")
    .replace(/^\s*(?:\/\/|\*)/, "")
    .trim();

/** The comment block immediately above one `export class <entry>` — nothing else. */
const blockAbove = (rel: string, entry: string): readonly string[] => {
  const lines = textOf(rel).split("\n");
  const at = lines.findIndex((line) => line.startsWith(`export class ${entry} `));
  expect(at, `${rel} declares no \`export class ${entry}\``).toBeGreaterThan(0);
  const block: string[] = [];
  for (let index = at - 1; index >= 0; index -= 1) {
    const line = lines[index] as string;
    if (!isCommentLine(line)) break;
    block.unshift(line);
  }
  return block;
};

/** A comment block folded into paragraphs: soft wraps joined, markers stripped, runs of
 *  spaces collapsed. A blank comment line separates two paragraphs. */
const paragraphsOf = (block: readonly string[]): readonly string[] => {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of block) {
    const prose = proseOf(line);
    if (prose === "") {
      if (current.length > 0) paragraphs.push(current.join(" ").replace(/\s+/g, " "));
      current = [];
      continue;
    }
    current.push(prose);
  }
  if (current.length > 0) paragraphs.push(current.join(" ").replace(/\s+/g, " "));
  return paragraphs;
};

/** One comment block's paragraphs as line-index runs — the fold's own grouping, so a reword
 *  can be driven by "a paragraph other than the invariant's" instead of by a literal phrase a
 *  legal reword is free to drop. */
const paragraphRunsOf = (block: readonly string[]): readonly (readonly number[])[] => {
  const runs: number[][] = [];
  let current: number[] = [];
  block.forEach((line, index) => {
    if (proseOf(line) === "") {
      if (current.length > 0) runs.push(current);
      current = [];
      return;
    }
    current.push(index);
  });
  if (current.length > 0) runs.push(current);
  return runs;
};

/** The prose one paragraph run folds to, by the same fold `paragraphsOf` makes. */
const paragraphTextOf = (block: readonly string[], run: readonly number[]): string =>
  run
    .map((index) => proseOf(block[index] as string))
    .join(" ")
    .replace(/\s+/g, " ");

/** Whether one block still carries the slice's invariant sentence. The criterion is
 *  CONTAINMENT — the label's spelling and which paragraph the sentence lands in are free. */
const carriesInvariant = (block: readonly string[], sentence: string): boolean =>
  paragraphsOf(block).some((paragraph) => paragraph.includes(sentence));

// ---------------------------------------------------------------------------
// ① the eight entry-class invariants
// ---------------------------------------------------------------------------

/** One slice entry's declared invariant: the module, the class, and the one sentence that
 *  slice states — the table is the ONE declaration, indexed by module path, never by
 *  "which entry comes first". */
interface SliceInvariant {
  readonly module: string;
  readonly entry: string;
  /** The invariant sentence, verbatim. `Env`'s block states it as the whole sentence with no
   *  label; the other seven follow `<Class> — <what this is>. Invariant: <the sentence>`. */
  readonly sentence: string;
}

const SLICE_INVARIANTS: readonly SliceInvariant[] = [
  {
    module: "env/index.ts",
    entry: "Env",
    sentence:
      "Every write goes through one declared, atomic, previewable path — the workspace is the engine's only landing place, and `Env` is the one adapter that holds it.",
  },
  {
    module: "docs/index.ts",
    entry: "Documents",
    sentence: "a document's shape is judged by the registry, and every judgment reads text only",
  },
  {
    module: "run/index.ts",
    entry: "Run",
    sentence: "facts first, and every advance is derived from them",
  },
  {
    module: "surface/index.ts",
    entry: "Cli",
    sentence:
      "every byte a consumer reads comes from the ONE word table this door holds, so a second table is unreachable by construction",
  },
  {
    module: "run/ledger/ledger.ts",
    entry: "Ledger",
    sentence: "one fact, one home, one writer",
  },
  {
    module: "run/gate/preflight.ts",
    entry: "PreFlight",
    sentence:
      "one `vet` call walks the face's row set in judgment order, the first refusing row owns the verdict, and the tree's ONE record is settled from that verdict by `settle` alone — never by the judgment",
  },
  {
    module: "run/dispatch/child.ts",
    entry: "Child",
    sentence: "the engine authorises and attributes, it never signals",
  },
  {
    module: "run/advance/pipeline.ts",
    entry: "Pipeline",
    sentence: "every face cell is a reading of the line facts and the four rules only order them",
  },
];

describe("the entry classes state their slice's invariant, judged by content", () => {
  it("declares one row per entry — the four slices and `run/`'s four segments", () => {
    expect(SLICE_INVARIANTS).toHaveLength(8);
    expect(new Set(SLICE_INVARIANTS.map((row) => row.module)).size).toBe(8);
  });

  for (const row of SLICE_INVARIANTS) {
    it(`${row.module}#${row.entry} still carries its declared sentence`, () => {
      expect(carriesInvariant(blockAbove(row.module, row.entry), row.sentence)).toBe(true);
    });
  }

  it("stays green when a paragraph other than the invariant's is reworded", () => {
    const block = blockAbove("surface/index.ts", "Cli");
    const sentence = SLICE_INVARIANTS[3]?.sentence ?? "";
    // The paragraphs to reword are found SYNTACTICALLY — every run the invariant sentence does
    // not sit in — never by a literal phrase. A reword driven by a phrase stops demonstrating
    // its own point the moment that phrase is legally reworded, and the Rule-zero paragraph is
    // exactly the prose a later wave is free to rewrite.
    const outside = new Set(
      paragraphRunsOf(block)
        .filter((run) => !paragraphTextOf(block, run).includes(sentence))
        .flat(),
    );
    expect(outside.size, "the block carries a paragraph besides the invariant's").toBeGreaterThan(
      0,
    );
    const reworded = block.map((line, index) =>
      outside.has(index) && proseOf(line) !== ""
        ? " * A size rule stated in words this test cannot know in advance."
        : line,
    );
    expect(reworded).not.toEqual(block);
    expect(carriesInvariant(reworded, sentence)).toBe(true);
  });

  it("goes red when the invariant sentence itself is rewritten or dropped", () => {
    const block = blockAbove("run/dispatch/child.ts", "Child");
    // The sentence spans a soft wrap in the source, so the arm rewords a fragment of it and
    // lets the fold do the joining: the rewritten block no longer carries the sentence.
    const rewritten = block.map((line) => line.replace("it never", "it always"));
    expect(rewritten).not.toEqual(block);
    expect(carriesInvariant(rewritten, SLICE_INVARIANTS[6]?.sentence ?? "")).toBe(false);
    expect(carriesInvariant([], SLICE_INVARIANTS[6]?.sentence ?? "")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ② the depth criterion
// ---------------------------------------------------------------------------

/** The prototype's function-valued members — a forwarding row. The constructor is not a row,
 *  an accessor carries no `value` and so is not a row, and an injected collaborator is an
 *  instance field and so never reaches the prototype. */
const forwardingRowsOf = (entry: { readonly prototype: object }): readonly string[] =>
  Object.getOwnPropertyNames(entry.prototype).filter((name) => {
    if (name === "constructor") return false;
    return typeof Object.getOwnPropertyDescriptor(entry.prototype, name)?.value === "function";
  });

/** One slice's non-test modules, the entry's own file excluded: the entry is where the rows
 *  live, not a module that backs them. */
const implementationFilesOf = (slice: string): readonly string[] => {
  const root = path.join(SRC, slice);
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .filter((rel) => !rel.includes("__tests__"))
    .filter((rel) => rel.split(path.sep).join("/") !== "index.ts");
};

/** One slice's entry face and its folder. */
interface SliceDepth {
  readonly slice: string;
  readonly entry: { readonly prototype: object };
  readonly name: string;
}

const SLICE_DEPTHS: readonly SliceDepth[] = [
  { slice: "env", entry: Env, name: "Env" },
  { slice: "docs", entry: Documents, name: "Documents" },
  { slice: "run", entry: Run, name: "Run" },
  { slice: "surface", entry: Cli, name: "Cli" },
];

/** The criterion: a slice's forwarding rows never outnumber the modules that back them. */
const exceedsDepth = (rows: readonly string[], files: readonly string[]): boolean =>
  rows.length > files.length;

describe("a slice's entry forwards one row per module, never more", () => {
  for (const row of SLICE_DEPTHS) {
    it(`${row.slice}/#${row.name} stays within its own implementation count`, () => {
      const rows = forwardingRowsOf(row.entry);
      const files = implementationFilesOf(row.slice);
      expect(files.length, `${row.slice}/ backs nothing — the read is not empty`).toBeGreaterThan(
        0,
      );
      expect(
        rows.length,
        `${row.slice}/#${row.name} forwards ${rows.join(", ")}`,
      ).toBeLessThanOrEqual(files.length);
    });
  }

  it("counts prototype functions only — not the constructor, an accessor, an injected field", () => {
    const rows = forwardingRowsOf(Cli);
    expect(rows).not.toContain("constructor");
    // An accessor is on the prototype and is NOT a row: `get program` is the builder
    // implementation's read-only handle, not a line of its own.
    expect(Object.getOwnPropertyDescriptor(Cli.prototype, "program")?.get).toBeTypeOf("function");
    expect(rows).not.toContain("program");
    // An injected collaborator is an instance field, so it never reaches the prototype.
    const injected = Object.keys(new Cli());
    expect(injected.length).toBeGreaterThan(0);
    for (const field of injected) expect(rows).not.toContain(field);
    // The facade's own command / output / progress rows ARE rows: dropping them would put
    // the count below the module count and the boundary arm could no longer go red.
    for (const row of ["run", "report", "progress"]) expect(rows).toContain(row);
  });

  it("goes red one row past the count, and green when that row's module lands with it", () => {
    const rows = forwardingRowsOf(Cli);
    const files = implementationFilesOf("surface");
    // Today `surface/` is the one slice where the two sides are equal, which is why this is
    // where the boundary arm bites; the other three sit below their own count.
    expect(exceedsDepth(rows, files)).toBe(false);
    expect(exceedsDepth([...rows, "anExtraRow"], files)).toBe(true);
    expect(exceedsDepth([...rows, "anExtraRow"], [...files, "render/extra.ts"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ③ the three deletability registrations
// ---------------------------------------------------------------------------

/** One unit family's two spellings: the rows its registration face holds, and the units
 *  those rows register. Deleting one unit must cost exactly its own row. */
interface Registration {
  readonly family: string;
  readonly rows: () => readonly string[];
  readonly units: () => readonly string[];
}

/** The rows a face holds with no unit behind them, and the units no row registers. */
const unbalanced = (registration: Registration): readonly string[] => {
  const rows = new Set(registration.rows());
  const units = new Set(registration.units());
  return [
    ...[...rows]
      .filter((row) => !units.has(row))
      .map((row) => `${registration.family}: row ${row}`),
    ...[...units]
      .filter((unit) => !rows.has(unit))
      .map((unit) => `${registration.family}: unit ${unit}`),
  ];
};

/** The command folder's modules that are NOT shells: the declaration table every shell reads
 *  and the projection that joins it. Two names, stated once. */
const NON_SHELL_MODULES: readonly string[] = ["declare.ts", "projection.ts"];

/** The shells on disk — one file per command verb. */
const shellFiles = (): readonly string[] =>
  readdirSync(path.join(SRC, "surface", "commands"))
    .filter((name) => name.endsWith(".ts"))
    .filter((name) => !NON_SHELL_MODULES.includes(name))
    .map((name) => name.slice(0, -".ts".length))
    .sort();

/** The command shells: `CLI_COMMANDS`'s row set and the shell files are the same set. */
const SHELL_REGISTRATION: Registration = {
  family: "command shells",
  rows: () => CLI_COMMANDS.map((command) => command.name).sort(),
  units: shellFiles,
};

/** The two scope bases a strategy class sits under — `Invariant` for the doc rows,
 *  `LedgerRuleBase` for the ledger rows. Neither is itself a strategy. */
const STRATEGY_BASES: readonly (abstract new () => object)[] = [
  invariants.Invariant,
  invariants.LedgerRuleBase,
];

/** Whether one export of the judging module is a strategy class — a function whose prototype
 *  sits under a scope base. The bases themselves, the abstract helper types and the value
 *  classes the family happens to export all fail this test for their own reason. */
const isStrategyClass = (declared: unknown): boolean => {
  if (typeof declared !== "function") return false;
  if (STRATEGY_BASES.some((base) => (declared as unknown) === base)) return false;
  const prototype = (declared as unknown as { readonly prototype: object }).prototype;
  return STRATEGY_BASES.some((base) => prototype instanceof base);
};

/** The strategy roster the judging module DECLARES, read off that module's own export table.
 *  A strategy's `name` is verbatim its rule id, so this roster compares to the registry's ids
 *  name for name — and because it is a DIFFERENT source, a deleted row leaves its class
 *  standing here and the orphan is named. */
const strategyRoster = (): readonly string[] => {
  const roster: string[] = [];
  for (const declared of Object.values(invariants) as readonly unknown[]) {
    if (!isStrategyClass(declared)) continue;
    const strategy = new (declared as new () => { readonly name: string })();
    roster.push(strategy.name);
  }
  return roster.sort();
};

/** The judging family: the registry's row set and the strategies the judging module declares,
 *  the same set spelled twice by two different sources. */
const RULE_REGISTRATION: Registration = {
  family: "judging rules",
  rows: () => RULE_REGISTRY.map((row) => row.id).sort(),
  units: strategyRoster,
};

/** One board tree-fact cell and the word row that renders it. The three cells are the
 *  `BoardFacts` keys; the roster is type-checked against them, never a free list. */
interface BoardFactRow {
  readonly cell: keyof BoardFacts;
  readonly word: () => string;
}

const BOARD_FACT_ROWS: readonly BoardFactRow[] = [
  { cell: "orphans", word: () => WORDS.board.facts.orphan.label },
  { cell: "crashed", word: () => WORDS.board.facts.crashed.label },
  { cell: "refusal", word: () => WORDS.refusal.token },
];

/** The cells whose word row is absent or empty — the row the deletion would cost. */
const unworded = (rows: readonly BoardFactRow[]): readonly string[] =>
  rows.filter((row) => row.word().trim() === "").map((row) => row.cell);

describe("deleting one unit costs exactly its own registration row", () => {
  it("keeps the command shells and `CLI_COMMANDS` the same set, both ways", () => {
    expect(unbalanced(SHELL_REGISTRATION)).toEqual([]);
    // The red arm: a shell file gone while its row still registers it names that one row.
    const missing = {
      ...SHELL_REGISTRATION,
      units: () => shellFiles().filter((verb) => verb !== "board"),
    };
    expect(unbalanced(missing)).toEqual(["command shells: row board"]);
  });

  it("keeps the rule registry's row set and its strategy classes the same set", () => {
    expect(unbalanced(RULE_REGISTRATION)).toEqual([]);
    // The arm the plan names: the ROW is gone while its strategy class still stands. The units
    // side reads the declaring module, so the class outlives the deletion and is named here —
    // one orphan, no more, and the *other* direction is silent. Had both sides been mapped from
    // `RULE_REGISTRY`, this arm would read [] and confirm nothing.
    const missing = {
      ...RULE_REGISTRATION,
      rows: () =>
        RULE_REGISTRY.filter((row) => row.id !== "presence")
          .map((row) => row.id)
          .sort(),
    };
    expect(unbalanced(missing)).toEqual(["judging rules: unit presence"]);
    // The mirror arm: the class is gone while its row still registers it.
    const orphanless = {
      ...RULE_REGISTRATION,
      units: () => strategyRoster().filter((name) => name !== "presence"),
    };
    expect(unbalanced(orphanless)).toEqual(["judging rules: row presence"]);
    // The neighbour arm: one added row plus its class keeps the two sides level.
    const extended = {
      ...RULE_REGISTRATION,
      rows: () => [...RULE_REGISTRY.map((row) => row.id), "an-added-rule"].sort(),
      units: () => [...strategyRoster(), "an-added-rule"].sort(),
    };
    expect(unbalanced(extended)).toEqual([]);
  });

  it("gives each board tree-fact cell its own word row", () => {
    expect(BOARD_FACT_ROWS.map((row) => row.cell).sort()).toEqual([
      "crashed",
      "orphans",
      "refusal",
    ]);
    expect(unworded(BOARD_FACT_ROWS)).toEqual([]);
    // The red arm: one word row dropped while its fact cell still stands names that cell.
    const missing = BOARD_FACT_ROWS.map((row) =>
      row.cell === "crashed" ? { ...row, word: (): string => "" } : row,
    );
    expect(unworded(missing)).toEqual(["crashed"]);
  });
});
