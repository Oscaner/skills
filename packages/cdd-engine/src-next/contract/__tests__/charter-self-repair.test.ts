// packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts
// P41 T7 — the program charter's self-repair (design spec §1.4). The flip turns the five
// shape rules into `block` rows, and the charter is a JUDGED corpus document: its five
// decision sections would then refuse the program's own charter unless they stop
// stating the tree as it stands. The delivery is two families at zero, not one:
//
//   · the measurement grammar (`measure-literal`) reports nothing on the five sections;
//   · `single-home` reports nothing on the charter — its right domain holds the phase
//     documents, which repeat the charter's gate / release / backfill sentences, so the
//     charter states each of those once as a POINTER at its holder.
//
// `## Phase inventory` is the REGISTRATION face, never a third family: its P41 row carries
// the same two domain narrowings as the phase spec (`Scope ③` measures prose,
// `Acceptance ⑥` skips work items), so the registration states the criterion the
// implementation writes. It is read where it is registered, not counted as a family.
//
// Every arm names the sentence it reads, and each carries its counter-arm: the original
// wording reported (the measurement grammar) · a grammar-clean copy that keeps the
// duplicated sentences still refused (single-home) · the pointers themselves passing ·
// a labelled restatement beside the pointer caught (the same home twice) · a copy that
// keeps ONLY the backfill family named by its holders.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Contract } from "../judge.ts";
import type { DocKey } from "../project.ts";

/** The repo root of THIS checkout — the charter's corpus basis. */
const REPO_ROOT = path.resolve(fileURLToPath(new URL("../../../../..", import.meta.url)));

/** The program charter under judgment. */
const CHARTER_REL = "docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md";

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

/** The original sentences — the pre-repair charter's own wording, one carrier line per
 *  reported hit, so the counter-arm counts what the five sections used to say. The
 *  measurement carrier states its count in the closed measurement set: the Chinese
 *  quantifier the charter actually wrote left the grammar at P42 §8, and a verbatim
 *  carrier would stop reporting the family this arm exists to read. */
const ORIGINAL_SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  ["### Goal", ["② 写文档方案重设计（骨架生成 · 今日形面 `schema get --output skeleton`）"]],
  [
    "### Non-goals",
    [
      "- **引擎行为变化在册**：动词清单读 `face/declare.ts#CLI_COMMANDS`（今日八命令：implement · review · fix · base · schema · issue · board · init），运行时依赖读 `package.json#dependencies`（13 rows in that file：`commander` · `yaml`）",
    ],
  ],
  [
    "### Cross-cutting",
    ["- **CLAUDE.md pin 修订先行**：例外面扩骨架生成面（今日落在 `schema get --output skeleton`）"],
  ],
  [
    "## Boundary rules",
    [
      "- **模板结构保真**：骨架（今日形面 `schema get <type> --output skeleton <target>`）= declare.ts 派生",
    ],
  ],
  [
    "## Constraints",
    [
      "- **今日例外面按声明面读**（`face/declare.ts#CLI_COMMANDS`）：`schema get` · `issue render`",
      "- P2 定案：骨架渲染落盘由编排器承担（注册期形面 `cdd schema gen phase-spec` · 今日形面 `cdd schema get phase-spec --output skeleton <target>`）",
    ],
  ],
];

/** The three duplicated criteria as the charter used to state them — verbatim copies of
 *  the sentences the phase documents hold. */
const GATE_CRITERION =
  "- **gate 零例外底线**：doc-contract 判定语义不变——骨架生成不是 gate 豁免通道（骨架 by construction 绿 · 填后 gate 仍终判兜底）";
const RELEASE_CRITERION =
  "- **不发布**：changesets 收尾到可发布态即止；版本应用 / tag / publish = 独立动作";
const BACKFILL_CRITERION = "- 变更先回填本 overall（backfill-as-version），再继续实现";

/** The repaired sections — the same five headings, conditional throughout, with the three
 *  families collapsed into pointers at their holders. */
const GATE_POINTER =
  "- **gate 零例外底线**：判据住 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p3-design.md` 与 `docs/kairos/plans/2026-10-10-engine-doc-tooling-p4.md` 各自的 `## Constraints` 一节";
const RELEASE_POINTER =
  "- **不发布**：发布姿态住 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p13-design.md` 的 `## Constraints`";
const BACKFILL_POINTER =
  "- 回填纪律住 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p9-design.md` 的 `## Constraints`";

/** The repaired five sections — the shape the charter carries. */
const REPAIRED_SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  [
    "### Goal",
    ["② 写文档方案重设计（骨架生成 · 声明面 = `schema get --output skeleton` 的骨架档）"],
  ],
  [
    "### Non-goals",
    [
      RELEASE_POINTER,
      "- **引擎行为变化在册**：动词清单读 `face/declare.ts#CLI_COMMANDS`（八命令），运行时依赖读 `package.json#dependencies`（逐条入册：`commander` · `yaml`）",
    ],
  ],
  ["### Cross-cutting", [GATE_POINTER]],
  [
    "## Boundary rules",
    [
      "- **模板结构保真**：骨架（声明面 = `schema get <type> --output skeleton <target>`）= declare.ts 派生",
    ],
  ],
  ["## Constraints", [BACKFILL_POINTER, "- 面间派生单源：`next:` 派生恰住一处"]],
];

/** The findings of one document's judgment over the fixture body. */
const findingsOf = (body: string, rel = "docs/kairos/overalls/x-charter-fixture.md") =>
  new Contract().validate({
    docKey: "overall",
    path: path.join(REPO_ROOT, rel),
    content: body,
    root: REPO_ROOT,
  });

/** The kinds of one document's judgment over the fixture body. */
const kindsOf = (body: string, rel = "docs/kairos/overalls/x-charter-fixture.md"): string[] =>
  findingsOf(body, rel).map((finding) => finding.kind);

/** One body judged as the charter — the same doc key, path and root the charter reads. */
const charterFindingsOf = (content: string) =>
  new Contract().validate({
    docKey: "overall",
    path: path.join(REPO_ROOT, CHARTER_REL),
    content,
    root: REPO_ROOT,
  });

/** One kind's findings of the real charter — the AFTER-migration read. */
const charterFindings = (docKey: DocKey = "overall") => {
  const rel = CHARTER_REL;
  return new Contract().validate({
    docKey,
    path: path.join(REPO_ROOT, rel),
    content: readFileSync(path.join(REPO_ROOT, rel), "utf8"),
    root: REPO_ROOT,
  });
};

describe("P41 T7 — the charter states conditions, not the tree as it stands", () => {
  it("reports the original wording: one bare measurement", () => {
    const kinds = kindsOf(charterBody(ORIGINAL_SECTIONS));
    expect(kinds.filter((kind) => kind === "measure-literal")).toHaveLength(1);
  });

  it("still reports a grammar-clean copy that keeps the three duplicated criteria (single-home)", () => {
    const duplicated = REPAIRED_SECTIONS.map(([heading, lines]) =>
      heading === "### Cross-cutting"
        ? ([heading, [GATE_POINTER, GATE_CRITERION, RELEASE_CRITERION]] as const)
        : ([heading, lines] as const),
    );
    const kinds = kindsOf(charterBody([...duplicated, ["## Constraints", [BACKFILL_CRITERION]]]));
    // The measurement grammar is silent on this copy — the refusal is the missing home,
    // not a token shape.
    expect(kinds.filter((kind) => kind === "measure-literal")).toHaveLength(0);
    expect(kinds.filter((kind) => kind === "single-home").length).toBeGreaterThanOrEqual(1);
  });

  it("passes the repaired pointers themselves", () => {
    const kinds = kindsOf(charterBody(REPAIRED_SECTIONS));
    expect(kinds.filter((kind) => kind === "single-home")).toHaveLength(0);
    expect(kinds.filter((kind) => kind === "measure-literal")).toHaveLength(0);
  });

  it("catches a labelled restatement beside the pointer (the same home twice)", () => {
    const restated = REPAIRED_SECTIONS.map(([heading, lines]) =>
      heading === "## Boundary rules"
        ? ([heading, [...lines, GATE_CRITERION]] as const)
        : [heading, lines],
    );
    const kinds = kindsOf(
      charterBody(restated as readonly (readonly [string, readonly string[]])[]),
    );
    expect(kinds.filter((kind) => kind === "single-home").length).toBeGreaterThanOrEqual(1);
  });

  it("catches the copy that keeps ONLY the backfill family (one family, one arm)", () => {
    // The arm above restores all three families at once, so it stays green while any ONE
    // of them stops being read. This copy keeps the gate and release families as
    // pointers and restates the backfill discipline alone: the four neighbours that hold
    // that sentence are the refusal's own evidence, so a right domain that quietly
    // dropped the family would redden here by name.
    const backfillOnly = [
      ...REPAIRED_SECTIONS.slice(0, 4),
      ["## Constraints", [BACKFILL_CRITERION, "- 面间派生单源：`next:` 派生恰住一处"]] as const,
    ];
    const findings = findingsOf(
      charterBody(backfillOnly as readonly (readonly [string, readonly string[]])[]),
    );
    const singleHome = findings.filter((finding) => finding.kind === "single-home");
    expect(singleHome.length).toBeGreaterThanOrEqual(1);
    for (const neighbour of ["p9-design", "p10-design", "tooling-p1.md", "tooling-p2.md"]) {
      expect(
        singleHome.some((finding) => finding.message.includes(neighbour)),
        `the backfill family names its ${neighbour} holder`,
      ).toBe(true);
    }
    // The measurement grammar stays silent — the refusal is the missing home, never a token.
    expect(findings.filter((finding) => finding.kind === "measure-literal")).toHaveLength(0);
  });
});

describe("P41 T7 — the charter judges zero on both families, and its gaps are measured", () => {
  it("reports nothing on the real charter — both families at zero", () => {
    expect(charterFindings()).toEqual([]);
  });

  // P42 T9 — the candidate reading of the `measure-literal` family: "zero findings" is
  // true of a clean charter and of a face map that never ran, so the gap is measured.
  it("reads measure-literal's candidate face — an unplaceable heading is a gap, not a silence", () => {
    const text = readFileSync(path.join(REPO_ROOT, CHARTER_REL), "utf8");
    const gapsOf = (body: string): readonly string[] =>
      charterFindingsOf(body)
        .filter(
          (finding) =>
            finding.kind === "measure-literal" && finding.message.includes("no declared face"),
        )
        .map((finding) => finding.field ?? "");
    // The registered heading renamed to a name the face map cannot place: every line
    // beneath it becomes `unmapped`, and the family's first row reports the gap.
    const renamed = text.replace("## Maintenance", "## Upkeep");
    expect(renamed).not.toBe(text);
    expect(gapsOf(renamed).length).toBeGreaterThan(0);
    // the pair: the registered heading itself reports no gap
    expect(gapsOf(text)).toEqual([]);
  });
});
