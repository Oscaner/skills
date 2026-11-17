// packages/cdd-engine/src-next/contract/__tests__/census.guard.test.ts
// P37 T8 — the census execution face (design spec §8). A measured number is allowed in
// a document only with a `census:<id>` reference beside it, and this file owns the
// mechanical face of that rule:
//
//   · the seven registered rows — one number each, the four `pin.*` readings taken off
//     the ONE `PinAudit.census` accessor so `pin.total` is a scan's length rather than a
//     second computation;
//   · the gate — a reference whose `<n>` disagrees with its row is red, an unregistered
//     id throws, and the placeholder form the corpus writes about the form itself is
//     prose rather than a reference;
//   · the floor (§8.3) — a gate that compared zero references has judged nothing, so the
//     compared count is a reading the suite asserts a minimum on.
//
// The red cells run over a scratch corpus: the shipped docs corpus is green, and a test
// that edited it to go red would be editing the evidence. The green cells run over both
// the scratch corpus and the shipped one, so the gate is not a fixture-only claim.
//
// The same-source pin needs a LOADED fixture: the shipped corpus reads
// `0 = 0 + 0 = 0`, which holds for a correct implementation and for one that silently
// drops the test-shaped pins alike. The fixture carries one dead path pin, one dead
// symbol pin and one test pin whose title is not in its file, so `path` must read 2 —
// counting only `"path"` would read 1 and `total` 2.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CensusGate, type CensusRow, censusTableOf } from "../census.ts";
import { corpusOf, PinAudit } from "../pins.ts";
import type { Refuses } from "./type-refusal.ts";

/** The repo root of THIS checkout — the shipped-corpus basis. */
const REPO_ROOT = path.resolve(fileURLToPath(new URL("../../../../..", import.meta.url)));

/** The seven registered ids, in declaration order (§8.2). */
const CENSUS_IDS: readonly string[] = [
  "pin.symbol",
  "pin.path",
  "pin.total",
  "pin.files",
  "criteria.rows",
  "questions.rows",
  "questions.cells",
];

/** The scratch corpus root — one markdown file the cases write references into. */
const CORPUS = ["docs"];

/** The fixture's declaration corpus: a live symbol plus a test file whose one title is
 *  `a declared test title`. */
const SAMPLE_SOURCE = "export const PresentSymbol = 1;\n";
const SAMPLE_TEST = 'it("a declared test title", () => {});\n';

interface Scratch {
  readonly root: string;
  readonly audit: PinAudit;
  readonly write: (rel: string, text: string) => void;
}

let scratchDirs: string[] = [];

const fixture = (): Scratch => {
  const root = mkdtempSync(path.join(tmpdir(), "census-gate-"));
  scratchDirs.push(root);
  mkdirSync(path.join(root, "docs"), { recursive: true });
  mkdirSync(path.join(root, "packages", "cdd-engine", "src-next", "__tests__"), {
    recursive: true,
  });
  writeFileSync(
    path.join(root, "packages", "cdd-engine", "src-next", "sample.ts"),
    SAMPLE_SOURCE,
    "utf8",
  );
  writeFileSync(
    path.join(root, "packages", "cdd-engine", "src-next", "__tests__", "sample.test.ts"),
    SAMPLE_TEST,
    "utf8",
  );
  return {
    root,
    audit: new PinAudit(root),
    write: (rel, text) => {
      const at = path.join(root, rel);
      mkdirSync(path.dirname(at), { recursive: true });
      writeFileSync(at, text, "utf8");
    },
  };
};

afterEach(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
  scratchDirs = [];
});

/** One corpus document: three dead pins (a path, a symbol, a test title) and the one
 *  reference the case declares. */
const loadedDoc = (reference: string): string =>
  [
    "# fixture",
    "",
    "- `docs/absent.md`",
    "- `AbsentSymbolName`",
    "- `packages/cdd-engine/src-next/__tests__/sample.test.ts::a retired title`",
    "",
    `- \`${reference}\``,
    "",
  ].join("\n");

/** A loaded fixture — the corpus whose scan reads `symbol` 1 · `path` 2 · `total` 3. */
const loaded = (): Scratch => {
  const f = fixture();
  f.write("docs/loaded.md", loadedDoc("census:pin.total = 3"));
  return f;
};

/** The gate over the caller's own resolved corpus — the composition point these cases
 *  stand in for. */
const gateOf = (f: Scratch): CensusGate => {
  // `CENSUS` is the table's name at the composition point — the instance a caller builds
  // from its OWN resolved root, never a module singleton
  const CENSUS = censusTableOf({ audit: f.audit, corpus: CORPUS });
  return new CensusGate({ table: CENSUS, audit: f.audit, corpus: CORPUS });
};

describe("P37 T8 — the census registry: one row, one number", () => {
  it("registers the seven ids, each measuring an integer", () => {
    const audit = new PinAudit(REPO_ROOT);
    const corpus = corpusOf(REPO_ROOT);
    const CENSUS = censusTableOf({ audit, corpus });
    expect(CENSUS.rows().map((row) => row.id)).toEqual([...CENSUS_IDS]);
    for (const row of CENSUS.rows()) {
      // the readings are numbers a document can restate, never a record the gate would
      // have to pick a field out of
      expect(Number.isInteger(row.measure()), row.id).toBe(true);
    }
    expect(CENSUS.of("pin.files").measure()).toBe(audit.filesOf(corpus).length);
  });

  it("throws for an id nobody registered — the unregistered-lookup shape", () => {
    const CENSUS = censusTableOf({
      audit: new PinAudit(REPO_ROOT),
      corpus: corpusOf(REPO_ROOT),
    });
    expect(() => CENSUS.of("pin.deadband")).toThrow(
      /no census row is registered for `pin.deadband`/,
    );
  });

  it("refuses a row measuring a record at the TYPE layer, not at runtime", () => {
    // A `measure()` returning a record would leave the gate's single `<n>` comparison
    // without a meaning (§8.2) — so the row type is ONE number, and a record-returning
    // `measure` is not a row. `tsc` is the gate that reads this: widen `CensusRow` to
    // accept a record and `Refuses` turns into `never`, so the assignment below stops
    // compiling
    type RecordRow = { readonly id: string; measure(): { readonly symbol: number } };
    const refused: Refuses<RecordRow, CensusRow> = true;
    expect(refused).toBe(true);
    // the runtime twin: a row is read for its one number
    const row: CensusRow = { id: "fixture.number", measure: () => 1 };
    expect(row.measure()).toBe(1);
  });

  it("reads the four pin rows off ONE scan — `total` is that scan's length, `path` covers test pins", () => {
    const f = loaded();
    const census = f.audit.census(CORPUS);
    // one dead path · one dead test title · one dead symbol
    expect(census).toEqual({ symbol: 1, path: 2, total: 3, files: 1 });
    // the same-source pin, read twice: equal to the addition AND to the scan it came from
    expect(census.total).toBe(census.symbol + census.path);
    expect(census.total).toBe(f.audit.scan(CORPUS).length);
  });
});

describe("P37 T8 — the gate: compare the fixed form, throw on an unregistered id", () => {
  it("goes red on one changed digit and green on the measured number", () => {
    const f = loaded();
    const green = gateOf(f).report();
    expect(green.mismatches).toEqual([]);
    expect(green.compared).toBe(1);
    // the implementation is untouched; one digit moves
    f.write("docs/loaded.md", loadedDoc("census:pin.total = 4"));
    const red = gateOf(f).report();
    expect(red.mismatches).toHaveLength(1);
    expect(red.mismatches[0]).toMatchObject({ id: "pin.total", declared: 4, measured: 3 });
    expect(red.mismatches[0]?.source).toBe("docs/loaded.md");
  });

  it("throws for a well-formed id nobody registered — the grammar is not a filter", () => {
    const f = fixture();
    f.write("docs/unknown.md", "# unknown\n\n- `census:unknown.id = 3`\n");
    expect(() => gateOf(f).report()).toThrow(/no census row is registered for `unknown.id`/);
  });

  it("reads the placeholder form as prose — a `census:` word outside the grammar is no reference", () => {
    // the form's own two faces: the placeholder and the grep pattern the plan writes
    expect(
      CensusGate.referencesOf(
        "`census:<id> = <n>` · `census:[a-z][a-z0-9]* = [0-9]\\+`",
        "form.md",
      ),
    ).toEqual([]);
    const f = fixture();
    f.write("docs/form.md", "# form\n\n- `census:<id> = <n>`\n");
    // not parsed, not compared, and above all not thrown on: the placeholder sits inside
    // the gate's own corpus
    const report = gateOf(f).report();
    expect(report).toEqual({ compared: 0, mismatches: [] });
  });

  it("reads a fractional or qualified value as prose — `<n>` is a decimal integer", () => {
    // §8.3's grammar reads `<n>` as `^\d+$`. A value that carries anything after its
    // digits is a different form: truncating it to the leading digits would judge a
    // sentence the grammar puts outside the gate — `3.5` would read as `3` and go red,
    // `0.5` would read as `0` and go green
    expect(CensusGate.referencesOf("`census:pin.total = 3.5`", "form.md")).toEqual([]);
    expect(CensusGate.referencesOf("`census:pin.total = 3abc`", "form.md")).toEqual([]);
    expect(CensusGate.referencesOf("`census:pin.total = 0x10`", "form.md")).toEqual([]);
    const f = fixture();
    f.write("docs/form.md", "# form\n\n- `census:pin.total = 3.5`\n- `census:pin.total = 3abc`\n");
    expect(gateOf(f).report()).toEqual({ compared: 0, mismatches: [] });
    // the pair: the integer form beside those is a reference and IS compared
    f.write("docs/form.md", "# form\n\n- `census:pin.total = 0`\n");
    expect(gateOf(f).report()).toEqual({ compared: 1, mismatches: [] });
  });

  it("reads `<n>` only from the right-hand side of the form — a neighbouring number is no second reading", () => {
    const f = loaded();
    f.write("docs/loaded.md", loadedDoc("census:pin.total = 3 · 9 other places"));
    const report = gateOf(f).report();
    // the `9` beside the reference is prose the gate never compares
    expect(report).toEqual({ compared: 1, mismatches: [] });
  });

  it("compares the shipped corpus and holds §8.3's floor at one real reference", () => {
    const audit = new PinAudit(REPO_ROOT);
    const corpus = corpusOf(REPO_ROOT);
    const CENSUS = censusTableOf({ audit, corpus });
    const report = new CensusGate({ table: CENSUS, audit, corpus }).report();
    // the corpus is not merely free of disagreements — it was actually compared
    expect(report.mismatches).toEqual([]);
    expect(report.compared).toBeGreaterThanOrEqual(1);
    // the delete direction: a corpus carrying no reference reads zero compared, so the
    // same floor assertion above would fail — zero is a gate that judged nothing
    const f = loaded();
    f.write("docs/loaded.md", "# fixture\n\nno count claim here\n");
    const red = gateOf(f).report();
    expect(red.compared).toBe(0);
    expect(red.compared >= 1).toBe(false);
  });
});
