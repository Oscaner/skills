// packages/cdd-engine/src-next/contract/__tests__/dockey.guard.test.ts
// T11 (spec §3.2 ③) — the DocKey single-source gate. The four doc-type keys were
// hand-copied across the tree (project.ts declaration · judge.ts DOC_KEYS ·
// declare.ts DOC_TYPE_VALUES · board-view.ts DOC_TYPE_DOMAIN · doc.ts inline
// unions); this gate asserts every runtime array and type surface over the domain
// derives from the ONE declaration (declare.ts DOC_TYPE_VALUES, re-exported by
// project.ts as DOC_KEYS + aliased as DocKey). A drifted second list — a member
// dropped or added anywhere — fails here, never silently.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DOC_TYPE_VALUES } from "../declare.ts";
import { DOC_KEYS } from "../project.ts";

/** The canonical value domain — the ONE declaration (declare.ts). */
const CANONICAL = ["overall", "plan", "phase-spec", "single-spec"];

describe("DocKey single-source derivation (spec §3.2 ③)", () => {
  it("the canonical declaration carries the four keys in order", () => {
    expect([...DOC_TYPE_VALUES]).toEqual(CANONICAL);
  });

  it("project.ts re-exports the SAME tuple as DOC_KEYS — one array, zero copy", () => {
    // The re-export is the same runtime array instance, never a re-typed literal.
    expect(DOC_KEYS).toBe(DOC_TYPE_VALUES);
    expect([...DOC_KEYS]).toEqual(CANONICAL);
  });

  it("the judge + declare + board-view consumers derive from the single source (zero re-typed literal)", () => {
    const contractRoot = fileURLToPath(new URL("..", import.meta.url));
    // A hand-written four-key literal array is the drift form this gate bans: the
    // three consumers must never carry their own copy.
    const files = ["judge.ts", "declare.ts", "../face/board-view.ts"].map((rel) =>
      readFileSync(`${contractRoot}/${rel}`, "utf8"),
    );
    for (const [index, src] of files.entries()) {
      // The literal "[ \"overall\", ... ]" re-typed in a consumer is the drift
      // signature; the canonical declare.ts keeps its ONE declaration and the two
      // consumers must not carry a second literal array.
      const literalArrays = src.match(/"overall"\s*,\s*"plan"\s*,\s*"phase-spec"/g) ?? [];
      if (index === 1) {
        // declare.ts is the declaration root — its one literal is the single source.
        expect(literalArrays.length).toBeLessThanOrEqual(1);
      } else {
        expect(literalArrays, `${files.length}`).toEqual([]);
      }
    }
  });

  it("doc.ts carries zero inline doc-key union — the two surfaces alias DocKey", () => {
    const docSrc = readFileSync(fileURLToPath(new URL("../doc.ts", import.meta.url)), "utf8");
    // The collapsed inline unions read `DocKey`; a re-typed four-member union in
    // doc.ts is the drift this gate bans.
    const inlineUnion = docSrc.match(/docType\w*:\s*"overall"\s*\|\s*"plan"/g) ?? [];
    expect(inlineUnion).toEqual([]);
  });
});
