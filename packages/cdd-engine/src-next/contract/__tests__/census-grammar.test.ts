// packages/cdd-engine/src-next/contract/__tests__/census-grammar.test.ts
// The census reference grammar — the ONE face `contract/census.ts` still carries. A
// `census:<id> = <n>` word is a reference only in the fixed form (§8.3): a dotted
// lowercase id and a decimal integer on the right of `=`. Everything else is prose ABOUT
// the form, so the reader neither parses it nor throws on it.
//
// Three arms, each red-able on its own:
//   · the placeholder the form writes about itself — an illegal id is no reference;
//   · a value carrying a fraction or a suffix — `<n>` is a decimal integer, judged whole;
//   · a neighbouring number beside the reference — `<n>` is read from the right-hand side
//     of the fixed form, never from the digits around it.

import { describe, expect, it } from "vitest";
import { CensusGate, type CensusReference } from "../census.ts";

/** The references one text writes, reduced to the reading faces the arms assert. */
const referencesOf = (text: string): readonly Pick<CensusReference, "id" | "declared" | "text">[] =>
  CensusGate.referencesOf(text, "form.md").map(({ id, declared, text }) => ({
    id,
    declared,
    text,
  }));

describe("CensusGate.referencesOf — the reference grammar", () => {
  it("reads the placeholder form as prose — a `census:` word outside the grammar is no reference", () => {
    // The form's own two faces: the placeholder and the grep pattern a plan writes. Both
    // carry metacharacters in the id, so neither is a reference at all.
    expect(referencesOf("`census:<id> = <n>` · `census:[a-z][a-z0-9]* = [0-9]\\+`")).toEqual([]);
  });

  it("reads a fractional or suffixed value as prose — `<n>` is a decimal integer", () => {
    // Truncating the value to its leading digits would judge a sentence the grammar puts
    // outside the gate: `3.5` would read as `3` and go red, `0.5` as `0` and go green.
    for (const value of ["3.5", "3abc", "0x10"]) {
      expect(referencesOf(`\`census:pin.total = ${value}\``), value).toEqual([]);
    }
    // the pair: the integer form beside those IS a reference, judged whole
    expect(referencesOf("`census:pin.total = 3`")).toEqual([
      { id: "pin.total", declared: 3, text: "census:pin.total = 3" },
    ]);
  });

  it("reads `<n>` only from the right-hand side of the form — a neighbouring number is no second reading", () => {
    expect(referencesOf("`census:pin.total = 3` · 9 other places")).toEqual([
      { id: "pin.total", declared: 3, text: "census:pin.total = 3" },
    ]);
    // the reading keeps its attribution: the source it came from and the line it sits on
    expect(CensusGate.referencesOf("head\n\n`census:pin.total = 3`", "form.md")).toMatchObject([
      { source: "form.md", line: 3 },
    ]);
  });
});
