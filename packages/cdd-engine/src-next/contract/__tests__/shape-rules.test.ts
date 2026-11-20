// packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts
// P41 T2/T3 — the shape gate's four variable classes and the record face's date shape.
// Every arm is a PAIR: one form is reported and the neighbouring legal form is silent,
// so a rule cannot pass by judging everything (or by judging nothing).
//
// The scan face is the row source's body text (`JudgeContext.text`): the front-matter
// head is data, and a head line belongs to no registered section — scanning the file
// through the filesystem seam would turn a clean body into a face gap. The four grammars
// judge the DECISION face only; a line under an undeclared heading yields the gap
// verdict, and a `#### 7.5.1` item inherits its `### 7.` group's role through the
// heading stack (the pair: a two-argument face read falls to the gap).
//
// Zero module-level bare functions — the helpers are `const` (the repository's
// zero-`function`-declaration discipline).

import { describe, expect, it } from "vitest";
import { FaceMap } from "../declare.ts";
import type { DocFs } from "../invariants.ts";
import { ProseLines } from "../invariants.ts";
import { Contract } from "../judge.ts";
import { PinSpans } from "../pins.ts";
import type { DocKey } from "../project.ts";
import { RULE_REGISTRY } from "../rules.ts";

/** The hermetic filesystem seam — the shape rules read no file, but the sibling
 *  strategies on the same policy do (they must not touch the real tree). */
const FS: DocFs = { exists: () => false, read: () => null, list: () => [] };

/** The four shape rows this file judges, plus the date row — all `warn` at landing. */
const SHAPE_RULE_IDS = [
  "measure-literal",
  "line-coordinate",
  "live-arithmetic",
  "temporal-indicator",
  "single-home",
  "change-history-date-shape",
] as const;

/** One phase-spec carrier over the given body lines — a parseable document whose
 *  body is exactly what the arms below place. */
const specDoc = (body: readonly string[]): string =>
  [
    "---",
    "title: Shape Fixture",
    "doc-type: phase-spec",
    "version: v0.1",
    "date: 2026-11-20",
    "slug: x-shape",
    "program: x-program",
    "---",
    "",
    ...body,
  ].join("\n");

/** A phase-spec whose `## Design` group carries the given lines — the decision face. */
const designDoc = (lines: readonly string[]): string =>
  specDoc([
    "## Design",
    "",
    "### 1. 目标",
    "",
    ...lines,
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v0.1 | 2026-11-20 | init | [human] |",
  ]);

/** A phase-spec whose given lines land in a RECORD section — the exempt face. */
const recordDoc = (lines: readonly string[]): string =>
  specDoc([
    "## Design",
    "",
    "### 1. 目标",
    "",
    "判据面正文。",
    "",
    "## Notes for downstream",
    "",
    ...lines,
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v0.1 | 2026-11-20 | init | [human] |",
  ]);

/** An overall carrier whose `## Constraints` (decision) and `### 设计决策留存`
 *  (registration) each carry the given lines. */
const overallDoc = (decision: readonly string[], registration: readonly string[]): string =>
  [
    "---",
    "title: Shape Charter",
    "doc-type: overall",
    "version: v1.0",
    "date: 2026-11-20",
    "slug: x-charter",
    "---",
    "",
    "## Constraints",
    "",
    ...decision,
    "",
    "## Phase inventory",
    "",
    "### 设计决策留存（2026-10-10 —— 元层裁定 + 注册）",
    "",
    ...registration,
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v1.0 | 2026-11-20 | init | [human] |",
  ].join("\n");

/** A plan carrier whose `#### Steps` — a DECISION face — carries the given lines. The
 *  plan face is the one the shape rows had no carrier for: `line-coordinate` declares
 *  `docKeys: "all"`, and a plan owns its work item (`- Modify: <path>`), never a prose
 *  coordinate (P41 §4). */
const planStepsDoc = (lines: readonly string[]): string =>
  [
    "---",
    "title: Steps Fixture",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-11-20",
    "slug: x-steps",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    "### Task 1: task",
    "- **DependsOn**: none",
    "",
    "#### Steps",
    "",
    ...lines,
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v1.0 | 2026-11-20 | init | [human] |",
  ].join("\n");

/** A plan carrier whose single Change-history row carries `date` in its date cell. */
const planDoc = (date: string): string =>
  [
    "---",
    "title: Date Fixture",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: x-date",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    "### Task 1: task",
    "- **DependsOn**: none",
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    `| v1.0 | ${date} | init | [human] |`,
  ].join("\n");

/** The findings of one kind over one content — the arms never read other rules. */
const findingsOf = (
  content: string,
  kind: string,
  docKey: DocKey = "phase-spec",
  path: string = `docs/kairos/specs/x-shape.md`,
): readonly { field: string; message: string }[] =>
  new Contract()
    .validate({ docKey, path, content, root: "/repo", fs: FS })
    .filter((finding) => finding.kind === kind);

/** The measure-literal findings of one decision-face line. */
const measure = (line: string) => findingsOf(designDoc([line]), "measure-literal");

/** The temporal-indicator findings of one decision-face line. */
const temporal = (line: string) => findingsOf(designDoc([line]), "temporal-indicator");

describe("P41 T2 — the six shape rows carry `block` and skip a closed document", () => {
  it("declares every shape row with `severity: block` and `skipWhenClosed: true`", () => {
    const byId = new Map(RULE_REGISTRY.map((row) => [row.id, row]));
    for (const id of SHAPE_RULE_IDS) {
      const row = byId.get(id);
      if (row === undefined) throw new Error(`the registry dropped the shape row ${id}`);
      expect(row.severity, id).toBe("block");
      expect(row.skipWhenClosed, id).toBe(true);
    }
  });
});

describe("P41 T2 — ProseLines splits the prose face (the fence is one judgment)", () => {
  it("drops a fenced line and keeps the same string outside the fence", () => {
    const content = ["前言", "```", "见第 41 行", "```", "见第 41 行"].join("\n");
    // One fence judgment, two faces: the text read and the line read `ProseLines`
    // builds on it agree on which lines are prose.
    const texts = PinSpans.proseOf(content);
    expect(texts.filter((line) => line.includes("第 41 行"))).toHaveLength(1);
    expect(ProseLines.of(content).map((line) => line.raw)).toEqual(texts);
  });

  it("keeps the source line number of every prose line it returns", () => {
    // The declared line read carries the coordinate, so a caller never scans the body
    // a second time to recover it.
    const lines = ProseLines.of(["前言", "```", "示例", "```", "正文"].join("\n"));
    expect(lines.map((line) => line.line)).toEqual([1, 5]);
  });

  it("blanks an inline code span to the same width, so the claim stays a citation", () => {
    const [line] = ProseLines.of("见 `第 41 行` 一处坐标");
    expect(line?.blanked).not.toContain("第 41 行");
    expect(line?.blanked).toHaveLength("见 `第 41 行` 一处坐标".length);
  });

  it("reads a block quote by the line's `>` opener", () => {
    expect(ProseLines.isQuoted("> 引用")).toBe(true);
    expect(ProseLines.isQuoted("正文")).toBe(false);
  });
});

describe("P41 T2 — the scan face is the row source's body, never the front-matter head", () => {
  const headCarrier = (headLine: string, bodyLines: readonly string[]): string =>
    specDoc(["## Design", "", "### 1. 目标", "", ...bodyLines]).replace(
      "slug: x-shape",
      `slug: x-shape\n${headLine}`,
    );

  it("yields zero shape findings for a measurement and a coordinate in the head", () => {
    const content = headCarrier("note: 97 passed 第 41 行", ["判据面正文。"]);
    expect(findingsOf(content, "measure-literal")).toEqual([]);
    expect(findingsOf(content, "line-coordinate")).toEqual([]);
  });

  it("reports the same strings once they sit on the decision face (the pair)", () => {
    const content = headCarrier("note: 判据面正文。", ["97 passed 与 contract/judge.ts:41"]);
    expect(findingsOf(content, "measure-literal")).toHaveLength(1);
    expect(findingsOf(content, "line-coordinate")).toHaveLength(1);
  });
});

describe("P41 T2 — measure-literal: an independent integer beside a closed-set unit", () => {
  it("reports a bare count", () => {
    const findings = measure("本相位补了 97 passed 的用例。");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("97 passed");
  });

  it("leaves the census reference form alone", () => {
    expect(measure("计数写成 census:<id> = <n> 的形态。")).toEqual([]);
    expect(measure("读数写成 census:pin.files = 42 files 的形态。")).toEqual([]);
  });

  it("leaves a Chinese numeral alone", () => {
    expect(measure("豁免面共七处。")).toEqual([]);
  });

  it("leaves the fractional part of a decimal alone", () => {
    expect(measure("覆盖 0.5 rows 的一档。")).toEqual([]);
  });

  it("leaves the number inside a dotted id alone", () => {
    expect(measure("v1.2 rows 不是整数。")).toEqual([]);
  });
});

describe("P41 T2 — line-coordinate: the three declared shapes", () => {
  it("reports `第 N 行`, `line N` and a path with `:N`, each with its own kind", () => {
    const findings = findingsOf(
      designDoc(["第 41 行 与 line 41 与 contract/judge.ts:41 三种写法。"]),
      "line-coordinate",
    );
    expect(findings).toHaveLength(3);
    for (const finding of findings) expect(finding.message).toContain("line coordinate");
  });

  it("reports a prose `path:line` on a plan's `#### Steps` — the plan face is not exempt", () => {
    // The plan owns the work item, not a coordinate (P41 §4): `line-coordinate` is
    // declared `docKeys: "all"` and a plan's `#### Steps` is a decision face, so the
    // sentence a spec may not carry is refused in a plan too. This is the plan-face
    // carrier the arms above never built — `phase-spec` and `overall` only.
    const findings = findingsOf(
      planStepsDoc(["对照 face/cli.ts:120 的现有读法。"]),
      "line-coordinate",
      "plan",
      "docs/kairos/plans/x-steps.md",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("face/cli.ts:120");
  });

  it("leaves the plan's work item and an inline-coded coordinate alone (the pair)", () => {
    const path = "docs/kairos/plans/x-steps.md";
    // The form the plan does own: a work item naming the file, with no line number.
    expect(
      findingsOf(planStepsDoc(["- Modify: face/cli.ts 的读法。"]), "line-coordinate", "plan", path),
    ).toEqual([]);
    // The same coordinate inside an inline code span is a citation, not a claim.
    expect(
      findingsOf(
        planStepsDoc(["对照 `face/cli.ts:120` 的现有读法。"]),
        "line-coordinate",
        "plan",
        path,
      ),
    ).toEqual([]);
  });

  it("reports nothing when the same coordinates sit on a record section (the pair)", () => {
    expect(findingsOf(recordDoc(["第 41 行 与 line 41"]), "line-coordinate")).toEqual([]);
  });

  it("reports nothing inside `## Change history`'s own prose (the record face)", () => {
    // `## Change history` is the recorded face named by the brief, not a decision
    // section: the coordinate it carries is a record of what was measured, so it is
    // silent. The same fixture proves the table still parses — the date row is read.
    const content = specDoc([
      "## Design",
      "",
      "### 1. 目标",
      "",
      "判据面正文。",
      "",
      "## Change history",
      "",
      "第 41 行 与 line 41 的读数留在这一节里。",
      "",
      "| Version | date | summary | author |",
      "|---|---|---|---|",
      "| v0.1 | xxx | init | [human] |",
    ]);
    expect(findingsOf(content, "line-coordinate")).toEqual([]);
    expect(findingsOf(content, "change-history-date-shape")).toHaveLength(1);
  });
});

describe("P41 T2 — live-arithmetic: three glyphs, one verdict", () => {
  it.each(["249 - 1777 = 0", "249 – 1777 = 0", "249 − 1777 = 0"])(
    "reports the arithmetic %s once",
    (line) => {
      expect(findingsOf(designDoc([`差值口径：${line}`]), "live-arithmetic")).toHaveLength(1);
    },
  );
});

describe("P41 T2 — temporal-indicator: the mount is a grammar", () => {
  it("leaves an isolated adverb alone", () => {
    expect(temporal("豁免面清单仍为空。")).toEqual([]);
  });

  it("reports the clause that mounts the adverb on a symbol", () => {
    expect(temporal("今日形面 `schema get` 输出骨架。")).toHaveLength(1);
  });

  it("splits clauses at a doubled em dash only", () => {
    expect(temporal("豁免面仍为空——形面 `schema get` 已冻结。")).toEqual([]);
    expect(temporal("豁免面仍为空—形面 `schema get`。")).toHaveLength(1);
  });
});

describe("P41 T2 — the four grammars judge the decision face alone", () => {
  it("reports an overall `## Constraints` coordinate", () => {
    const content = overallDoc(["第 41 行"], ["登记面正文。"]);
    expect(
      findingsOf(content, "line-coordinate", "overall", "docs/kairos/overalls/x.md"),
    ).toHaveLength(1);
  });

  it("reports nothing for the same line in the registration face, and calls it no gap", () => {
    const content = overallDoc(["判据面正文。"], ["第 41 行"]);
    const path = "docs/kairos/overalls/x.md";
    expect(findingsOf(content, "line-coordinate", "overall", path)).toEqual([]);
    const shape = new Contract()
      .validate({ docKey: "overall", path, content, root: "/repo", fs: FS })
      .filter((finding) => SHAPE_RULE_IDS.some((id) => id === finding.kind));
    expect(shape.some((finding) => finding.message.includes("no declared face"))).toBe(false);
  });
});

describe("P41 T2 — the role is inherited through the heading stack", () => {
  const INHERITED = designDoc(["### 7. 某节", "", "#### 7.5.1 某条", "", "详见第 41 行。"]);

  it("reads the `### 7.` group and its `#### 7.5.1` item as the decision face", () => {
    expect(FaceMap.roleOf("phase-spec", "### 7. 某节")).toBe("decision");
    // The item's own title shape is not declared (`#### N.M` stops at two levels) —
    // the role arrives through the ancestor stack alone.
    expect(FaceMap.roleOf("phase-spec", "#### 7.5.1 某条")).toBe("unmapped");
    expect(FaceMap.roleOf("phase-spec", "#### 7.5.1 某条", ["### 7. 某节"])).toBe("decision");
  });

  it("reports the inherited line's coordinate with the rule's own kind", () => {
    const findings = findingsOf(INHERITED, "line-coordinate");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("第 41 行");
  });

  it("falls to the gap verdict when the face read carries no heading stack", () => {
    // The pair: with the two-argument read the same line has no face, so the coordinate
    // rule reports NOTHING on it and the line's only verdict is the map's gap — reported
    // once, by the family's first row, under that row's name (never `line-coordinate`).
    const unmapped = designDoc(["## Review Focus", "", "详见第 41 行。"]);
    expect(findingsOf(unmapped, "line-coordinate")).toEqual([]);
    const gaps = findingsOf(unmapped, "measure-literal");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.field).toBe("## Review Focus");
    expect(gaps[0]?.message).toContain("no declared face");
    expect(gaps[0]?.message).not.toContain("第 41 行");
  });
});

describe("P41 T3 — change-history-date-shape: the record face's date cell", () => {
  it("reports a non-ISO date cell", () => {
    expect(findingsOf(planDoc("xxx"), "change-history-date-shape", "plan")).toHaveLength(1);
  });

  it("reports nothing once the cell is an ISO date (the pair)", () => {
    expect(findingsOf(planDoc("2026-11-20"), "change-history-date-shape", "plan")).toEqual([]);
  });

  it("borrows neither neighbour's verdict on the same fixture", () => {
    const content = planDoc("xxx");
    expect(findingsOf(content, "change-history-row-shape", "plan")).toEqual([]);
    expect(findingsOf(content, "change-history-header-columns", "plan")).toEqual([]);
  });

  it("reports nothing for a history row that carries no measurement column", () => {
    // The four declared columns are all the row owes; "how the reading was taken"
    // belongs to the commit message, not to the document. The fixture carries an EXTRA
    // trailing column, so what is proved is the date rule's indifference to the column
    // set — not the ISO date, which the pair above already owns.
    const content = planDoc("2026-11-20").replace(
      "| v1.0 | 2026-11-20 | init | [human] |",
      "| v1.0 | 2026-11-20 | init | [human] | 由评审轮记录 |",
    );
    expect(findingsOf(content, "change-history-date-shape", "plan")).toEqual([]);
    // The row's width is its own rules' question, so the extra column is not silent:
    // this arm proves the date rule and the row-shape rule judge different facts.
    expect(findingsOf(content, "change-history-row-shape", "plan")).toHaveLength(1);
  });
});
