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
// What this file deliberately does NOT do: assert the closure over the real tree. Two
// occurrences still live outside the matrix (`session/next.ts`'s read-back sentence and
// `session/carrier-rulings.ts`'s acceptance set), and their single remover lands later;
// a whole-tree assertion today would be red for work no task in this wave owns. The
// real-tree cases join THIS file with that removal — the predicate is ready for them.
//
// The judgment and its value types are module-local (a test file exports nothing): the
// real-tree cases join THIS file with the removal they belong to. Zero behavior-carrying
// bare functions — the judgment is an arrow const.

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

/** The door's judgment: every code line carrying the tail outside the two admitted
 *  surfaces. Comments are stripped first (a docstring naming the tail is prose, a
 *  literal in code is a real name), so the door never argues with documentation. */
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
