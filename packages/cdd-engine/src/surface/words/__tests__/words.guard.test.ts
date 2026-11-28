// packages/cdd-engine/src/surface/words/__tests__/words.guard.test.ts
// The engine-literal half of the word-face audit: the surfaces this tree owns must carry
// zero of the retired vocabulary. The token set is the table's own exported data
// (`GUARD_BAN_WORDS`), never a hand-written list, and the scan release-masks the table's own
// home — its quoted rows ARE the release form, which is where a ban word legitimately lives.
//
// Two further legs ride beside the ban scan:
//   · the takeover flag's hard cut — `--recover` replaced `--steal-stale`, and the retired
//     lexeme appears nowhere on the source plane but a test's own negative assertion;
//   · the fourth state's row has ONE renderer — no face reads the row's cells instead of
//     asking the table's renderer, so the sentence cannot be assembled in two places.
//
// Zero module-level bare functions — the walk/scan helpers are `const` arrows.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Clock } from "../../../env/process/clock.ts";
import { TARGET_FACTS } from "../../../run/dispatch/inflight.ts";
import { GUARD_BAN_WORDS, Words } from "../words.ts";

/** The engine's `src` root — the engine's own source face (the scan set). */
const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** The ban vocabulary's data home — the file whose quoted rows are the release form. */
const RELEASE_FILES = new Set([path.join("surface", "words", "words.ts")]);

/** Every production `.ts` source under `src`, as its repo-relative plane path. */
const productionSources = (): readonly { readonly rel: string; readonly path: string }[] =>
  readdirSync(SRC_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .filter((entry) => !entry.parentPath.includes("__tests__"))
    .map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return { rel: file.slice(SRC_ROOT.length + 1), path: file };
    });

/** Whether a line carries the token only inside quoted strings — a data row that lists the
 *  value, never a face that restates it bare. */
const isQuotedDataRow = (line: string, token: string): boolean =>
  !line
    .replace(/"[^"]*"/g, "")
    .replace(/'[^']*'/g, "")
    .includes(token);

/** One token's hits over the source plane (the release form aside). */
const scanHits = (token: string): string[] => {
  const hits: string[] = [];
  for (const source of productionSources()) {
    const release = RELEASE_FILES.has(source.rel);
    const lines = readFileSync(source.path, "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      if (!line.includes(token)) continue;
      if (release && isQuotedDataRow(line, token)) continue;
      hits.push(`${source.rel}:${index + 1}`);
    }
  }
  return hits;
};

describe("the engine-literal word-face audit", () => {
  it("carries zero stale-family ban tokens on the source face (release-masked at the data home)", () => {
    for (const row of GUARD_BAN_WORDS.stale) {
      expect(scanHits(row.token), `the source face carries "${row.token}"`).toEqual([]);
    }
  });

  it("carries zero gate-family ban tokens on the source face (release-masked at the data home)", () => {
    for (const row of GUARD_BAN_WORDS.gate) {
      expect(scanHits(row.token), `the source face carries "${row.token}"`).toEqual([]);
    }
  });

  it("the data home does carry its rows — the mask is the release form, never a blind skip", () => {
    const home = readFileSync(path.join(SRC_ROOT, "surface", "words", "words.ts"), "utf8");
    for (const row of [...GUARD_BAN_WORDS.stale, ...GUARD_BAN_WORDS.gate]) {
      expect(home.includes(row.token), `the data home lists "${row.token}"`).toBe(true);
    }
    // The mask is not vacuous: a BARE restatement of a row would build a hit.
    expect(
      isQuotedDataRow(
        `const x = "${GUARD_BAN_WORDS.gate[0].token}";`,
        GUARD_BAN_WORDS.gate[0].token,
      ),
    ).toBe(true);
    expect(
      isQuotedDataRow(`const x = ${GUARD_BAN_WORDS.gate[0].token};`, GUARD_BAN_WORDS.gate[0].token),
    ).toBe(false);
  });
});

describe("the takeover flag's hard cut — `--recover` replaced `--steal-stale`, zero alias", () => {
  it("renders the hint rows under the current spelling", () => {
    const words = new Words({ clock: new Clock(() => 0) });
    const rows = [
      words.inFlightWords().stealable,
      words.inFlightWords().corruptLocked,
      words.inFlightWords().corruptUnlocked,
      words.checkedWords().inFlight.stale,
      words.inFlightTargetGone([...TARGET_FACTS]),
    ];
    for (const row of rows) {
      expect(row).toContain("--recover");
      expect(row).not.toContain("--steal-stale");
    }
  });

  it("leaves the retired lexeme nowhere on the source plane", () => {
    expect(scanHits("--steal-stale")).toEqual([]);
  });
});

/** The faces reading the row's cells directly — the table's home aside. */
const readersOfRowCells = (
  sources: readonly { readonly rel: string; readonly text: string }[],
): readonly string[] =>
  sources
    .filter((source) => !RELEASE_FILES.has(source.rel))
    .filter((source) => source.text.includes("targetGone.cells"))
    .map((source) => source.rel);

describe("the fourth state's row has ONE renderer", () => {
  it("keeps the row's cells behind the table's renderer", () => {
    // The row's cells are reachable by name, so a face that rendered them itself would
    // spell one sentence a second time. The four observation faces ask the renderer.
    const sources = productionSources().map((source) => ({
      rel: source.rel,
      text: readFileSync(source.path, "utf8"),
    }));
    expect(sources.length).toBeGreaterThan(10);
    expect(readersOfRowCells(sources)).toEqual([]);
  });

  it("sees a face reading the cells when there is one — the scan is not vacuous", () => {
    // The violation arm: the plausible hand-rolled row, assembled where the board renders.
    const offender = {
      rel: "surface/render/board.ts",
      text: "WORDS.inFlight.targetGone.cells.plan",
    };
    expect(readersOfRowCells([offender])).toEqual(["surface/render/board.ts"]);
    // …and the table's own home is the one legitimate reader, so it is exempt by path.
    expect(readersOfRowCells([{ rel: "surface/words/words.ts", text: "row.cells[fact]" }])).toEqual(
      [],
    );
  });
});
