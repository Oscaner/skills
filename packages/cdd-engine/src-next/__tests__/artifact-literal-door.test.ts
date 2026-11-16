// packages/cdd-engine/src-next/__tests__/artifact-literal-door.test.ts
// P36 T5 — the SKELETON of the artifact-literal door (design spec §2.9 ⑤): one pure
// judgment over candidate sources, plus the positive and negative cases that fix its
// release surface.
//
// The door's subject is a LITERAL spelling that belongs to exactly one declaration
// site — today the `.rulings.json` tail, which the matrix's `rulings` row renders.
// A second spelling of it in the production plane is the double expression this phase
// retires, so the door admits exactly two kinds of sample:
//
//   · the MATRIX row file — the declaration site itself (`renderRound` mints the tail);
//   · a FIXTURE (`__tests__`) — a fixture may spell the literal it asserts on.
//
// Everything else that carries the tail in CODE (a comment naming it is prose and is
// stripped first) is a violation with its own location.
//
// The REAL TREE closure joins the predicate (P36 T9 · §2.9 ⑤): both former
// matrix-external occurrences are gone — `session/next.ts`'s read-back sentence became a
// value slot, and `session/carrier-rulings.ts` consumes the matrix row's identifier
// vocabulary instead of re-declaring it. The suite therefore asserts the whole production
// tree, not just fixtures.
//
// The judgment and its value types are module-local (a test file exports nothing). Zero
// behavior-carrying bare functions — the judgment is an arrow const.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "./support/strip-comments.ts";

/** One candidate source file, as the door sees it (repo-relative path + bytes). */
type LiteralSample = {
  readonly file: string;
  readonly source: string;
};

/** The literal the door judges — one spelling, one declaration site. */
const RULINGS_TAIL = ".rulings.json";

/** The matrix's row file — the ONE declaration site the door admits. */
const MATRIX_FILE = "session/round-artifacts.ts";

/** Whether a sample is a fixture — a test may spell the literal it asserts on. */
const isFixture = (file: string): boolean => file.includes("__tests__/");

/** Whether a sample is the matrix row file — the literal's own home. */
const isMatrixRow = (file: string): boolean => file.endsWith(MATRIX_FILE);

/** One violation — the file and the 1-based line that carries the literal in code. */
type LiteralViolation = {
  readonly file: string;
  readonly line: number;
};

/** `src-next/` — every production path resolves against the engine source root. */
const SRC_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The identifier vocabulary's ONE declaration spelling — the matrix's row answers
 *  `canonical` plus `accepts`, and no read face may grow a second list. */
const ACCEPTANCE_DECL = /accepts:\s*\[/g;

/** The reviewed round's identity construction — `op` fixed to `review` on a round
 *  coordinate. The union annotations (`op: "review" | "fix"`) are a different fact:
 *  a parameter's domain, not a derived identity. */
const REVIEWED_IDENTITY = /op: "review"(?!\s*\|)/;

/** The production surface: every engine TypeScript file under `src-next` that is not a
 *  fixture, comments stripped, one deterministic order (the same scan the doc-type
 *  constructor gate reads). */
const loadProduction = (): readonly LiteralSample[] =>
  readdirSync(SRC_ROOT, { recursive: true, encoding: "utf8" })
    .filter((rel) => rel.endsWith(".ts") && !rel.split("/").includes("__tests__"))
    .map((rel) => ({
      file: rel,
      source: stripComments(readFileSync(`${SRC_ROOT}${rel}`, "utf8")),
    }))
    .sort((left, right) => left.file.localeCompare(right.file));

/** The door's judgment: every code line carrying the tail outside the two admitted
 *  surfaces. Samples may arrive raw or pre-stripped — the tree scan strips at load time
 *  (so the sibling whole-source scans over the same samples see code alone) and the
 *  judgment strips again, which is a no-op on already-stripped text. One predicate,
 *  both callers. */
const literalDoorViolations = (samples: readonly LiteralSample[]): readonly LiteralViolation[] => {
  const violations: LiteralViolation[] = [];
  for (const sample of samples) {
    if (isFixture(sample.file) || isMatrixRow(sample.file)) continue;
    for (const [index, line] of stripComments(sample.source).split("\n").entries()) {
      if (!line.includes(RULINGS_TAIL)) continue;
      violations.push({ file: sample.file, line: index + 1 });
    }
  }
  return violations;
};

describe("the artifact-literal door — the release surface (P36 T5 · §2.9 ⑤)", () => {
  it("admits the matrix row file — the literal's ONE declaration site", () => {
    const sample = [
      {
        file: "session/round-artifacts.ts",
        source: ['    case "rulings":', '      return stem + closing + ".rulings.json";'].join(
          "\n",
        ),
      },
    ];
    expect(literalDoorViolations(sample)).toEqual([]);
  });

  it("admits a fixture — a test may spell the literal it asserts on", () => {
    const sample = [
      {
        file: "session/__tests__/carrier-rulings.test.ts",
        source: 'const SIDECAR_NAME = CARRIER.replace(/\\.json$/, ".rulings.json");',
      },
    ];
    expect(literalDoorViolations(sample)).toEqual([]);
  });

  it("flags a matrix-external production literal with its own location", () => {
    const sample = [
      {
        file: "session/next.ts",
        source: "const readback = 'same path with .json replaced by .rulings.json';\n",
      },
    ];
    expect(literalDoorViolations(sample)).toEqual([{ file: "session/next.ts", line: 1 }]);
  });

  it("ignores a comment — prose names the tail, code carries the spelling", () => {
    const sample = [
      {
        file: "session/next.ts",
        // A line comment, a block comment and a docstring: all prose.
        source: [
          "// the orchestrator writes a .rulings.json sidecar",
          "/** the `.rulings.json` tail belongs to the matrix */",
          "const nothing = true;",
        ].join("\n"),
      },
    ];
    expect(literalDoorViolations(sample)).toEqual([]);
  });

  it("judges each sample on its own — one violation does not hide the next", () => {
    const sample = [
      { file: "session/next.ts", source: "const a = '.rulings.json';" },
      { file: "session/round-artifacts.ts", source: "const b = '.rulings.json';" },
      { file: "infra/x.ts", source: "const c = '.rulings.json';" },
    ];
    expect(literalDoorViolations(sample)).toEqual([
      { file: "session/next.ts", line: 1 },
      { file: "infra/x.ts", line: 1 },
    ]);
  });
});

describe("the artifact-literal door — the REAL tree closure (P36 T9 · §2.9 ⑤)", () => {
  const production = loadProduction();

  it("admits no production literal outside the matrix row — the real tree is closed", () => {
    expect(literalDoorViolations(production)).toEqual([]);
    // the scan found a tree, not an empty directory (a broken root would pass silently)
    expect(production.length).toBeGreaterThan(50);
  });

  it("declares the identifier acceptance set exactly once — in the matrix row", () => {
    const declaring = production.filter(
      (file) => [...file.source.matchAll(ACCEPTANCE_DECL)].length > 0,
    );
    expect(declaring.map((file) => file.file)).toEqual(["session/round-artifacts.ts"]);
  });

  it("composes the two levels at ONE seam — the schema's strict verdict has one production caller", () => {
    // The board and the lifecycle are two CONSUMERS of one composition, never two
    // composers: a second `CarrierRulings.verdict(` in production is the double
    // expression the seam exists to retire.
    const callers = production.filter((file) => file.source.includes("CarrierRulings.verdict("));
    expect(callers.map((file) => file.file)).toEqual(["session/artifact-reads.ts"]);
  });

  it("keeps the sidecar schema's identifier read OUT of carrier-rulings — it consumes the row", () => {
    const schema = production.find((file) => file.file.endsWith("session/carrier-rulings.ts"));
    expect(schema).toBeDefined();
    expect(schema?.source).toContain("ArtifactRegistry.identifierOf(");
    // The alias spelling lives in the matrix row alone: a hand-written `id` key here
    // would be the second acceptance list this door exists to retire.
    expect(schema?.source).not.toContain('"id"');
  });

  it("derives the REVIEWED round's identity in ONE production file — the matrix", () => {
    // The sidecar seam and the router both ask "which round does this carrier review?".
    // A second construction site is the second name this phase exists to retire, so the
    // entry (`ArtifactRegistry#reviewedIdentityOf`) is the only place allowed to write it.
    const builders = production.filter((file) => REVIEWED_IDENTITY.test(file.source));
    expect(builders.map((file) => file.file)).toEqual(["session/round-artifacts.ts"]);
  });
});
