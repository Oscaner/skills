// packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts
// P41 T7 — the program charter's self-repair (design spec §1.4). The flip turns the
// shape rows into `block` rows, so an overall's decision sections must be PLACED: a
// heading the face map cannot name leaves every line beneath it faceless.
//
// `## Phase inventory` is the REGISTRATION face, never a family of its own: its P41 row
// carries the same two domain narrowings as the phase spec (`Scope ③` measures prose,
// `Acceptance ⑥` skips work items), so the registration states the criterion the
// implementation writes. It is read where it is registered, not counted as a family.
//
// Both sides of the judgment are material THIS FILE writes: the carrier is a SYNTHETIC
// charter (`charterBody`) and the neighbour corpus is an empty filesystem seam, so no arm
// reads the repository's own document tree and a renamed or reworded document out there
// can never redden this file. `line-coordinate` carries the gate's zero-candidate arm,
// and the arm names the heading it reports.

import { describe, expect, it } from "vitest";
import type { DocFs } from "../invariants.ts";
import { Contract } from "../judge.ts";

/** The fixture root — a path no checkout carries: every judgment below resolves inside
 *  the seam this file supplies, never against this working tree. */
const FIXTURE_ROOT = "/x-fixture";

/** The program charter under judgment — a fixture path, never a file this checkout
 *  carries: the arms assert the synthetic carrier they build. */
const CHARTER_PATH = "x-charter-fixture.md";

/** The neighbour corpus — empty by construction: no arm here judges a comparison. */
const NO_NEIGHBOURS: DocFs = { exists: () => false, read: () => null, list: () => [] };

/** One fixture document's front matter — an overall whose identity parses. */
const OVERALL_HEAD = [
  "---",
  "title: Charter Fixture",
  "doc-type: overall",
  "version: v1.0",
  "date: 2026-11-20",
  "slug: x-charter-fixture",
  "---",
  "",
].join("\n");

/** The five decision sections as one overall body, from the caller's section lines. */
const charterBody = (sections: readonly (readonly [string, readonly string[]])[]): string =>
  [OVERALL_HEAD, ...sections.flatMap(([heading, lines]) => [heading, "", ...lines, ""])].join("\n");

/** The charter's registered decision sections — the shape the carrier carries. */
const SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  [
    "### Goal",
    ["② 写文档方案重设计（骨架生成 · 声明面 = `schema get --output skeleton` 的骨架档）"],
  ],
  [
    "### Non-goals",
    [
      "- **引擎行为变化在册**：动词清单读 `face/declare.ts#CLI_COMMANDS`（八命令），运行时依赖读 `package.json#dependencies`（逐条入册：`commander` · `yaml`）",
    ],
  ],
  [
    "### Cross-cutting",
    ["- **gate 零例外底线**：doc-contract 判定语义不变——骨架生成不是 gate 豁免通道"],
  ],
  [
    "## Boundary rules",
    [
      "- **模板结构保真**：骨架（声明面 = `schema get <type> --output skeleton <target>`）= declare.ts 派生",
    ],
  ],
  [
    "## Constraints",
    [
      "- 变更先回填本 overall（backfill-as-version），再继续实现",
      "- 面间派生单源：`next:` 派生恰住一处",
    ],
  ],
];

/** The findings of one document's judgment over the fixture body. */
const findingsOf = (body: string) =>
  new Contract().validate({
    docKey: "overall",
    path: `${FIXTURE_ROOT}/${CHARTER_PATH}`,
    content: body,
    root: FIXTURE_ROOT,
    fs: NO_NEIGHBOURS,
  });

describe("P41 T7 — the charter's gaps are measured on its fixture", () => {
  // P42 T9 — the gate's zero-candidate reading, carried by `line-coordinate` since the
  // count row retired: "zero findings" is true of a clean charter and of a face map that
  // never ran, so the gap is measured on the same synthetic carrier.
  it("reads the gap arm's candidate face — an unplaceable heading is a gap, not a silence", () => {
    const gapsOf = (body: string): readonly string[] =>
      findingsOf(body)
        .filter(
          (finding) =>
            finding.kind === "line-coordinate" && finding.message.includes("no declared face"),
        )
        .map((finding) => finding.field ?? "");
    /** The five registered sections plus one decision face to move. */
    const sections: readonly (readonly [string, readonly string[]])[] = [
      ...SECTIONS,
      ["## Maintenance", ["维护面正文。"]],
    ];
    // the registered heading places its own prose, so the family reports no gap
    expect(gapsOf(charterBody(sections))).toEqual([]);
    // The heading renamed to a name the face map cannot place: every line beneath it
    // becomes `unmapped`, and the family's first row reports the gap.
    const renamed = sections.map(([heading, lines]): readonly [string, readonly string[]] =>
      heading === "## Maintenance" ? ["## Upkeep", lines] : [heading, lines],
    );
    expect(gapsOf(charterBody(renamed))).toContain("## Upkeep");
  });
});
