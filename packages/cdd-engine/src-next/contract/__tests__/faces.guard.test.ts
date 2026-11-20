// packages/cdd-engine/src-next/contract/__tests__/faces.guard.test.ts
// P41 T1 — the doc-face map guard (design spec §1.1). The map is DERIVED: a declared
// role per heading-anchored registry element, joined with that element's own title
// matcher. Three legs are pinned here, each with the counter-arm that would go red if
// the implementation took the shortcut:
//
//   · COVERAGE — every domain element of the four doc keys has a role; removing one
//     role surfaces that element as a gap (the gap is the judgment, not a silence);
//   · RESOLUTION — the face of a heading is read through the element's `valuePattern`
//     (or its selector's heading judgment), never its `anchor` literal, so a grouped
//     heading (`### Task 1: …` · `### N. …` · `#### N.M …`) and a suffixed one
//     (`### 设计决策留存（…）`) both resolve; a heading no element places inherits the
//     role of its nearest registered ancestor (`#### 7.5.1` under `### 7.` inside
//     `## Design` reads `decision`), and only a heading with no registered ancestor
//     at all reads `unmapped`;
//   · LOCATION — one body line gets two faces depending on the section it sits in, and
//     the map never grows a second list for the inherited (list-item, token) anchors.
//
// Zero module-level bare functions — the read helpers are `const` (the repository's
// zero-`function`-declaration discipline).

import { describe, expect, it } from "vitest";
import { DOC_FACES, type DocFaceEntry, declaredRegistries, FaceMap } from "../declare.ts";
import type { DocKey } from "../project.ts";

const DOC_KEYS: readonly DocKey[] = ["overall", "plan", "phase-spec", "single-spec"];

/** The heading a body line sits under — the fixture's own location read, so one pair
 *  differs in the line's SECTION and in nothing else. */
const headingOf = (doc: string, body: string, occurrence = 0): string => {
  const lines = doc.split("\n");
  let seen = 0;
  let at = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim() !== body) continue;
    if (seen === occurrence) {
      at = index;
      break;
    }
    seen += 1;
  }
  if (at < 0) throw new Error(`the fixture carries no line \`${body}\``);
  for (let index = at; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (/^#{2,4} /.test(line)) return line;
  }
  throw new Error(`the line \`${body}\` sits under no heading`);
};

/** The declared table with one role taken away — the counter-arm's doctored copy, run
 *  through the SAME derivation `gaps()` runs on the real table. */
const withoutRole = (docKey: DocKey, anchor: string) => {
  const table = {} as Record<DocKey, readonly DocFaceEntry[]>;
  for (const key of DOC_KEYS) {
    table[key] =
      key === docKey ? DOC_FACES[key].filter((entry) => entry.anchor !== anchor) : DOC_FACES[key];
  }
  return table;
};

/** A phase-spec fixture carrying the same body line twice, once per section. */
const SPEC_FIXTURE = [
  "---",
  "title: S",
  "doc-type: phase-spec",
  "version: v0.1",
  "date: 2026-11-20",
  "slug: x-p1",
  "program: x",
  "---",
  "",
  "## Design",
  "",
  "第 41 行",
  "",
  "## Change history",
  "",
  "第 41 行",
  "",
].join("\n");

/** A phase-spec fixture mirroring the corpus arm: a four-part design sub-heading that no
 *  registered element places (`#### 7.5.1` — the phase-spec level-4 pattern is `N.M`),
 *  sitting under `### 7.` inside `## Design`. The line beneath it belongs to that design
 *  section, so the face map must reach it through the heading stack. */
const NESTED_SPEC = [
  "---",
  "title: S",
  "doc-type: phase-spec",
  "version: v0.1",
  "date: 2026-11-20",
  "slug: x-p1",
  "program: x",
  "---",
  "",
  "## Design",
  "",
  "### 7. 定案：计划 Task 块契约（格式面）",
  "",
  "#### 7.5.1 身份与定位是两件事（B2 的裁定）",
  "",
  "第 41 行",
  "",
].join("\n");

/** The heading stack above a body line — innermost first, exactly the order `roleOf`
 *  walks when a heading matches no row. */
const enclosingHeadingsOf = (doc: string, body: string): string[] => {
  const lines = doc.split("\n");
  const at = lines.findIndex((line) => line.trim() === body);
  if (at < 0) throw new Error(`the fixture carries no line \`${body}\``);
  const stack: string[] = [];
  for (let index = at - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (/^#{2,4} /.test(line)) stack.push(line);
  }
  return stack;
};

describe("P41 T1 — the doc-face map is declared data derived from the element registry", () => {
  it("places every heading-anchored element of the four doc keys — zero gaps", () => {
    expect(FaceMap.gaps()).toEqual([]);
    // Every domain element is a ROW, so the derivation reached the whole domain.
    for (const docKey of DOC_KEYS) {
      const domain = declaredRegistries[docKey].elements
        .map((element) => element.anchor)
        .filter((anchor) => /^#{2,4} /.test(anchor));
      expect(
        FaceMap.ROWS.filter((row) => row.docKey === docKey)
          .map((row) => row.anchor)
          .sort(),
        docKey,
      ).toEqual([...domain].sort());
    }
  });

  it("reads a removed role as a gap — the gap itself is the judgment", () => {
    expect(FaceMap.gaps(withoutRole("overall", "### Goal"))).toEqual([
      { docKey: "overall", anchor: "### Goal" },
    ]);
  });

  it("resolves grouped headings through the element's own value pattern, never its anchor", () => {
    // The `### Task N:` element's pattern matches the CONCRETE task heading — the
    // anchor literal is `### Task N:` and would read `unmapped` on a literal compare.
    expect(FaceMap.roleOf("plan", "### Task 1: 面图")).toBe("decision");
    expect(FaceMap.ROWS.map((row) => row.anchor)).not.toContain("### Task 1: 面图");

    // The design sub-headings follow their `## Design` element's role.
    expect(FaceMap.roleOf("phase-spec", "## Design")).toBe("decision");
    expect(FaceMap.roleOf("phase-spec", "### 1. 形状面")).toBe("decision");
    expect(FaceMap.roleOf("phase-spec", "#### 1.1 面图是声明")).toBe("decision");
    expect(FaceMap.ROWS.map((row) => row.anchor)).not.toContain("### 1. 形状面");
    expect(FaceMap.ROWS.map((row) => row.anchor)).not.toContain("#### 1.1 面图是声明");
  });

  it("gives one body line two faces, decided by the section it sits in", () => {
    const underDesign = headingOf(SPEC_FIXTURE, "第 41 行", 0);
    const inRecord = headingOf(SPEC_FIXTURE, "第 41 行", 1);
    expect(FaceMap.roleOf("phase-spec", underDesign)).toBe("decision");
    expect(FaceMap.roleOf("phase-spec", inRecord)).toBe("record");
    expect(FaceMap.roleOf("phase-spec", "## Unregistered section")).toBe("unmapped");
  });

  it("resolves the suffixed registration heading of the overall charter", () => {
    const suffixed = "### 设计决策留存（2026-10-10 —— 元层裁定 + 注册）";
    expect(FaceMap.roleOf("overall", suffixed)).toBe("registration");
    expect(FaceMap.roleOf("overall", "## Constraints")).toBe("decision");
    // The suffix is what a literal anchor comparison would miss.
    expect(FaceMap.ROWS.map((row) => row.anchor)).not.toContain(suffixed);
  });

  it("inherits the nearest registered ancestor for a sub-heading no element places", () => {
    const subHeading = "#### 7.5.1 身份与定位是两件事（B2 的裁定）";
    const stack = enclosingHeadingsOf(NESTED_SPEC, "第 41 行");
    expect(stack).toEqual([subHeading, "### 7. 定案：计划 Task 块契约（格式面）", "## Design"]);
    // The sub-heading itself matches no row, so its own read is the gap.
    expect(FaceMap.roleOf("phase-spec", subHeading)).toBe("unmapped");
    // Through its heading stack it reads what `### 7.` inside `## Design` reads.
    expect(FaceMap.roleOf("phase-spec", subHeading, stack.slice(1))).toBe("decision");
    // An unregistered ancestor places it no better than none at all.
    expect(
      FaceMap.roleOf("phase-spec", subHeading, ["#### 7.5.1 无登记的祖先", "### 未登记的节"]),
    ).toBe("unmapped");
  });

  it("lays no second list for the inherited anchors — list items and tokens carry no row", () => {
    expect(FaceMap.ROWS.filter((row) => row.anchor.startsWith("- "))).toEqual([]);
    expect(FaceMap.gaps()).toEqual([]);
  });
});
