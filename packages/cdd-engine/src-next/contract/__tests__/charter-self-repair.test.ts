// packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts
// P41 T7 — the program charter's self-repair (design spec §1.4). The flip turns the
// shape rows into `block` rows, and an overall's decision sections would then refuse a
// charter that states the tree as it stands instead of the condition it keeps.
// `single-home` reports nothing on the repaired charter — its right domain holds the
// phase documents, which repeat the charter's gate / release / backfill sentences, so the
// charter states each of those once as a POINTER at its holder.
//
// `## Phase inventory` is the REGISTRATION face, never a family of its own: its P41 row
// carries the same two domain narrowings as the phase spec (`Scope ③` measures prose,
// `Acceptance ⑥` skips work items), so the registration states the criterion the
// implementation writes. It is read where it is registered, not counted as a family.
//
// Both sides of every comparison are material THIS FILE writes: the carrier is a SYNTHETIC
// charter (`charterBody`), and `single-home`'s right domain is a fixture corpus delivered
// through the judge context's filesystem seam (`MemoryFs`), so no arm reads the repository's
// own document tree and a renamed or reworded document out there can never redden this file.
// Every arm names the sentence it reads, and each carries its counter-arm: a copy that
// keeps the duplicated sentences still refused (single-home) · the pointers themselves
// passing · a labelled restatement beside the pointer caught (the same home twice) · a
// copy that keeps ONLY the backfill family named by its holders · a holder muted in the
// corpus dropping out of that naming · an empty corpus reporting nothing, so the
// greenness is the fixture's and never the tree's · an unplaceable heading reported as the
// face map's gap, by `line-coordinate` — the row that owns the gate's zero-candidate arm.

import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryFs } from "../../__tests__/support/memory-fs.ts";
import { ENGINE_DOC_ROOTS } from "../../infra/doc-roots.ts";
import type { DocFs } from "../invariants.ts";
import { Contract } from "../judge.ts";

/** The fixture root — a path no checkout carries: every judgment below resolves inside
 *  the memory filesystem the arms build, never against this working tree. */
const FIXTURE_ROOT = "/x-fixture";

/** The program charter under judgment — a fixture path, never a file this checkout
 *  carries: the arms assert the synthetic carrier they build. */
const CHARTER_PATH = "x-charter-fixture.md";

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

/** The three duplicated criteria as the charter used to state them — verbatim copies of
 *  the sentences the phase documents hold. */
const GATE_CRITERION =
  "- **gate 零例外底线**：doc-contract 判定语义不变——骨架生成不是 gate 豁免通道（骨架 by construction 绿 · 填后 gate 仍终判兜底）";
const RELEASE_CRITERION =
  "- **不发布**：changesets 收尾到可发布态即止；版本应用 / tag / publish = 独立动作";
const BACKFILL_CRITERION = "- 变更先回填本 overall（backfill-as-version），再继续实现";

/** The repaired sections — the same five headings, conditional throughout, with the three
 *  families collapsed into pointers at their holders. The holders are named by their
 *  file under the doc root (`specs/` · `plans/`), so the fixture stays a document about
 *  the tree without embedding a corpus path a scan would read as an assertion. */
const GATE_POINTER =
  "- **gate 零例外底线**：判据住 `specs/2026-10-10-engine-doc-tooling-p3-design.md` 与 `plans/2026-10-10-engine-doc-tooling-p4.md` 各自的 `## Constraints` 一节";
const RELEASE_POINTER =
  "- **不发布**：发布姿态住 `specs/2026-10-10-engine-doc-tooling-p13-design.md` 的 `## Constraints`";
const BACKFILL_POINTER =
  "- 回填纪律住 `specs/2026-10-10-engine-doc-tooling-p9-design.md` 的 `## Constraints`";

/** The repaired sections — the shape the charter carries. */
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

/** The four documents the backfill family's refusal names — the identity substrings the
 *  arm reads in the finding messages. */
const BACKFILL_HOLDERS = ["p9-design", "p10-design", "tooling-p1.md", "tooling-p2.md"];

/** One corpus document: the doc root it lives under, its file name, and the criterion
 *  sentences it holds in its `## Constraints` section. The names are the identities the
 *  charter's pointers name, so the corpus stands in for the holders they point at. */
const HOLDERS: readonly (readonly [string, string, readonly string[]])[] = [
  [ENGINE_DOC_ROOTS.specs, "2026-10-10-engine-doc-tooling-p3-design.md", [GATE_CRITERION]],
  [ENGINE_DOC_ROOTS.plans, "2026-10-10-engine-doc-tooling-p4.md", [GATE_CRITERION]],
  [ENGINE_DOC_ROOTS.specs, "2026-10-10-engine-doc-tooling-p9-design.md", [BACKFILL_CRITERION]],
  [ENGINE_DOC_ROOTS.specs, "2026-10-10-engine-doc-tooling-p10-design.md", [BACKFILL_CRITERION]],
  [ENGINE_DOC_ROOTS.specs, "2026-10-10-engine-doc-tooling-p13-design.md", [RELEASE_CRITERION]],
  [ENGINE_DOC_ROOTS.plans, "2026-10-10-engine-doc-tooling-p1.md", [BACKFILL_CRITERION]],
  [ENGINE_DOC_ROOTS.plans, "2026-10-10-engine-doc-tooling-p2.md", [BACKFILL_CRITERION]],
];

/** A fixture file name's own identity — `2026-10-10-engine-doc-tooling-p9-design.md` reads
 *  `x-p9-design`, distinct from the judged charter's slug so no neighbour is filtered as a
 *  same-slug sibling. */
const slugOf = (name: string): string =>
  `x-${name.replace(/^\d{4}-\d{2}-\d{2}-engine-doc-tooling-/, "").replace(/\.md$/, "")}`;

/** One fixture phase document — its identity head plus the criteria it holds. */
const heldDoc = (dir: string, name: string, criteria: readonly string[]): string =>
  [
    "---",
    `title: ${name}`,
    `doc-type: ${dir === ENGINE_DOC_ROOTS.plans ? "plan" : "phase-spec"}`,
    "version: v1.0",
    "date: 2026-10-10",
    `slug: ${slugOf(name)}`,
    "---",
    "",
    "## Constraints",
    "",
    ...criteria,
    "",
  ].join("\n");

/** The right domain these arms own — every holder document, in memory, under
 *  `FIXTURE_ROOT`. `bodies` replaces one document's body by file name, so an arm can
 *  mutate the corpus it owns and watch the judgment follow. */
const corpusOf = (bodies: Readonly<Record<string, string>> = {}): DocFs =>
  new MemoryFs(
    Object.fromEntries(
      HOLDERS.map(([dir, name, criteria]) => [
        path.join(FIXTURE_ROOT, dir, name),
        bodies[name] ?? heldDoc(dir, name, criteria),
      ]),
    ),
  );

/** The copy that keeps ONLY the backfill discipline — the gate and release families stay
 *  pointers, so exactly one family can report and its holders are readable in the names. */
const backfillOnlyBody = (): string => {
  const sections = [
    ...REPAIRED_SECTIONS.slice(0, 4),
    ["## Constraints", [BACKFILL_CRITERION, "- 面间派生单源：`next:` 派生恰住一处"]] as const,
  ];
  return charterBody(sections as readonly (readonly [string, readonly string[]])[]);
};

/** The findings of one document's judgment over the fixture body — the right domain is the
 *  arm's own corpus, so the judgment reads no document this checkout carries. */
const findingsOf = (body: string, fs: DocFs = corpusOf(), rel = CHARTER_PATH) =>
  new Contract().validate({
    docKey: "overall",
    path: path.join(FIXTURE_ROOT, rel),
    content: body,
    root: FIXTURE_ROOT,
    fs,
  });

/** The kinds of one document's judgment over the fixture body. */
const kindsOf = (body: string, fs: DocFs = corpusOf(), rel = CHARTER_PATH): string[] =>
  findingsOf(body, fs, rel).map((finding) => finding.kind);

/** The single-home findings of one body over one corpus. */
const singleHomeOf = (body: string, fs: DocFs = corpusOf()) =>
  findingsOf(body, fs).filter((finding) => finding.kind === "single-home");

describe("P41 T7 — the charter states conditions, not the tree as it stands", () => {
  it("still reports a copy that keeps the three duplicated criteria (single-home)", () => {
    const duplicated = REPAIRED_SECTIONS.map(([heading, lines]) =>
      heading === "### Cross-cutting"
        ? ([heading, [GATE_POINTER, GATE_CRITERION, RELEASE_CRITERION]] as const)
        : ([heading, lines] as const),
    );
    const kinds = kindsOf(charterBody([...duplicated, ["## Constraints", [BACKFILL_CRITERION]]]));
    expect(kinds.filter((kind) => kind === "single-home").length).toBeGreaterThanOrEqual(1);
  });

  it("passes the repaired pointers themselves", () => {
    const kinds = kindsOf(charterBody(REPAIRED_SECTIONS));
    expect(kinds.filter((kind) => kind === "single-home")).toHaveLength(0);
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
    // pointers and restates the backfill discipline alone: the four corpus documents that
    // hold that sentence are the refusal's own evidence, so a right domain that quietly
    // dropped the family would redden here by name.
    const findings = findingsOf(backfillOnlyBody());
    const singleHome = findings.filter((finding) => finding.kind === "single-home");
    expect(singleHome.length).toBeGreaterThanOrEqual(1);
    for (const neighbour of BACKFILL_HOLDERS) {
      expect(
        singleHome.some((finding) => finding.message.includes(neighbour)),
        `the backfill family names its ${neighbour} holder`,
      ).toBe(true);
    }
  });
});

describe("P41 T7 — the charter's gaps are measured on its fixture", () => {
  // P42 T9 — the gate's zero-candidate reading, carried by `line-coordinate` since the
  // count row retired: "zero findings" is true of a clean charter and of a face map that
  // never ran, so the gap is measured on the same synthetic carrier the arms above read.
  it("reads the gap arm's candidate face — an unplaceable heading is a gap, not a silence", () => {
    const gapsOf = (body: string): readonly string[] =>
      findingsOf(body)
        .filter(
          (finding) =>
            finding.kind === "line-coordinate" && finding.message.includes("no declared face"),
        )
        .map((finding) => finding.field ?? "");
    /** The five repaired sections plus one registered decision face to move. */
    const sections: readonly (readonly [string, readonly string[]])[] = [
      ...REPAIRED_SECTIONS,
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

describe("P41 T7 — the right domain is the fixture corpus, never the tree", () => {
  // The rule's other two arms: the neighbour falls silent once it stops copying, and the
  // zero-candidate read goes red instead of passing for "nothing to compare".
  it("drops a holder from the naming when its corpus document stops stating the sentence", () => {
    const muted = corpusOf({
      "2026-10-10-engine-doc-tooling-p1.md": heldDoc(
        ENGINE_DOC_ROOTS.plans,
        "2026-10-10-engine-doc-tooling-p1.md",
        ["- **P1 的评审面**：干净树上先复审，再落实现；两件事不并作一轮，作者判定后由编排器登记"],
      ),
    });
    const named = BACKFILL_HOLDERS.filter((holder) =>
      singleHomeOf(backfillOnlyBody(), muted).some((finding) => finding.message.includes(holder)),
    );
    expect(named).toEqual(BACKFILL_HOLDERS.filter((holder) => holder !== "tooling-p1.md"));
  });

  it("reports nothing over an empty corpus — the greenness is the fixture's, not the tree's", () => {
    // A right domain that quietly fell back to the checkout's own document tree would
    // report here, because this copy restates a sentence four of our documents hold.
    expect(singleHomeOf(backfillOnlyBody(), new MemoryFs({}))).toEqual([]);
  });
});
