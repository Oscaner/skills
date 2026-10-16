// packages/cdd-engine/src-next/__tests__/phase-suffix.guard.test.ts
// T12 (spec §3.2 ⑬) — the phase-suffix consistency gate. The slug phase-suffix
// grammar is ONE fact with two consumption surfaces:
//   · Workspace.phaseSuffixOf — the trailing `-p<major>(.<minor>)*` parse
//     (the `-p…$` form, infra/workspace.ts).
//   · BoardView.scanPhases — the suffix-only match over the specs dir
//     (the `^p…$` form, face/board-view.ts, via PHASE_SUFFIX_BARE).
// Both MUST compose from the shared `PHASE_SUFFIX_CORE` fragment so the two forms
// cannot drift. (The doc-contract design-unit syntax `P\d+(\.\d+)*-design` is
// ANOTHER fact — uppercase + `-design` tail — never merged here.) This gate pins
// the single source structurally and the two surfaces behaviorally (in-grammar
// agrees, out-of-grammar rejected at both).

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BoardView } from "../face/board-view.ts";
import { PHASE_SUFFIX_BARE, PHASE_SUFFIX_CORE, Workspace } from "../infra/workspace.ts";

const SRC = fileURLToPath(new URL("../", import.meta.url));
const read = (rel: string): string => readFileSync(`${SRC}/${rel}`, "utf8");

describe("the phase-suffix grammar holds one shared source (spec §3.2 ⑬)", () => {
  it("both regex forms are composed from PHASE_SUFFIX_CORE — zero second literal", () => {
    // The shared fragment is the ONE grammar: the suffix-only form is built from it
    // (`^${PHASE_SUFFIX_CORE}$` — asserted behaviorally below), and the board's scan
    // imports that derived form rather than re-spelling the pattern.
    expect(PHASE_SUFFIX_BARE.source).toBe(`^${PHASE_SUFFIX_CORE}$`);
    const boardSrc = read("face/board-view.ts");
    expect(boardSrc).toContain("PHASE_SUFFIX_BARE");
    // no raw phase-suffix regex literal re-spelled in the board face
    expect(boardSrc).not.toMatch(/p\\d\+/);
  });

  it("in-grammar suffixes parse identically at both surfaces", () => {
    // the tail parse captures the dash-bearing `-p…` segment; the board's bare
    // match takes the dash-less `p…` segment (same grammar, different input form).
    for (const suffix of ["p2", "p4.1", "p10"]) {
      expect(Workspace.phaseSuffixOf(`prog-${suffix}`), `phaseSuffixOf prog-${suffix}`).toBe(
        `-${suffix}`,
      );
      expect(PHASE_SUFFIX_BARE.test(suffix), `board bare test ${suffix}`).toBe(true);
    }
  });

  it("out-of-grammar suffixes are rejected at both surfaces (uppercase is another fact)", () => {
    for (const suffix of ["P7", "p", "p7x", "pp7"]) {
      expect(Workspace.phaseSuffixOf(`prog-${suffix}`), `phaseSuffixOf prog-${suffix}`).toBeNull();
      expect(PHASE_SUFFIX_BARE.test(suffix), `board bare test ${suffix}`).toBe(false);
    }
  });

  describe("behavioral agreement over the on-disk scan", () => {
    let repo: string;
    beforeEach(() => {
      repo = mkdtempSync(path.join(tmpdir(), "phase-suffix-guard-"));
    });
    afterEach(() => {
      rmSync(repo, { recursive: true, force: true });
    });

    it("scanPhases admits exactly the suffixes phaseSuffixOf accepts", () => {
      mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
      // in-grammar → admitted; out-of-grammar (uppercase `P7`) → not a phase
      for (const name of ["prog-p7", "prog-p7.1", "prog-P7"])
        writeFileSync(path.join(repo, "docs/kairos/specs", `${name}-design.md`), "# S\n");
      expect(BoardView.scanPhases("prog", repo)).toEqual(["-p7", "-p7.1"]);
    });
  });
});
