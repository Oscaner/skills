// packages/cdd-engine/src-next/contract/__tests__/markdown-spans.test.ts
// The markdown span reader's own face — the four entry points `ProseSpans` carries and
// the one fence judgment they all ride. The pins guard read this same reader through the
// pin scan; here it is judged on its own terms, so the reader survives the pin module
// (Task 1 of the retirement moves it to the rule plane, and Task 4 removes its old home).
//
// Three pairs, each with the neighbouring read beside it:
//   · a fence hides its lines from the prose face, and the same bytes outside the fence
//     arrive;
//   · a span run is closed only by a run of the SAME width (`one` vs ``two``), and an
//     unmatched run opens nothing;
//   · a blanked line keeps its columns, so a claim quoted in a span stays a citation.

import { describe, expect, it } from "vitest";
import { ProseSpans } from "../markdown-spans.ts";

describe("ProseSpans — one fence judgment, four read faces", () => {
  it("keeps the prose lines and their source coordinates", () => {
    const content = ["前言", "```", "示例", "```", "正文"].join("\n");
    expect(ProseSpans.proseEntriesOf(content)).toEqual([
      { line: 1, text: "前言" },
      { line: 5, text: "正文" },
    ]);
    // the pair: the text projection is the SAME walk, not a second judgment
    expect(ProseSpans.proseOf(content)).toEqual(["前言", "正文"]);
  });

  it("reads the span content between a backtick run and the next run of the same width", () => {
    expect(ProseSpans.tokensOf("a `one` and ``two`` end")).toEqual(["one", "two"]);
    // the pair: a fence carries no claim at all, so the same span inside one vanishes
    expect(ProseSpans.tokensOf("```\na `ghost`\n```")).toEqual([]);
  });

  it("blanks a span to the same width, so the column positions survive", () => {
    const line = "见 `第 41 行` 的约定";
    const blanked = ProseSpans.blankedOf(line);
    expect(blanked.length).toBe(line.length);
    expect(blanked).not.toContain("第 41 行");
    expect(blanked.startsWith("见 ")).toBe(true);
    // the pair: a line with no span reads back unchanged
    expect(ProseSpans.blankedOf("见第 41 行的约定")).toBe("见第 41 行的约定");
  });

  it("opens no span on an unmatched run — never an invented one", () => {
    expect(ProseSpans.tokensOf("a `unclosed line")).toEqual([]);
    expect(ProseSpans.blankedOf("a `unclosed line")).toBe("a `unclosed line");
  });
});
