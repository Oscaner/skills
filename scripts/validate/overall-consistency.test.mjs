// scripts/validate/overall-consistency.test.mjs — P4 Task 1: overall-consistency
// parser core + table well-formedness checks (③ change-history ascending +
// dup / ④b dependency membership / ④c issue ref well-formed + phase membership).
// clean fixture exercises all green paths; drift fixtures pin each throw;
// malformed + legacy fixtures pin ok:false / canonical:false skip paths.

import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadOverallFile,
  checkVersionAscending,
  checkIssueRefsWellFormed,
  checkDepGraphMembership,
} from "./overall-consistency.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "overall-consistency", "specs");

const clean = () => loadOverallFile(join(FIX, "clean-canonic-overall.md"));

describe("overall-consistency：canonical 头 + 四表 parse（brief Step 1）", () => {
  it("canonical 头 → canonical=true + phases 解析（id/design/plan 三列）", () => {
    const o = clean();
    expect(o.ok).toBe(true);
    expect(o.canonical).toBe(true);
    expect(o.phases.map((p) => p.id)).toEqual(["P1", "P2"]);
    // design 列/plan 列原文保留（含 [Pending]）
    expect(o.phases[0].plan).toBe("Done");
    expect(o.phases[1].plan).toBe("[Pending]");
  });
  it("slug 由文件名剥离日期前缀 + -overall 后缀", () => {
    const o = clean();
    expect(o.slug).toBe("clean-canonic");
  });
});

describe("overall-consistency：检查 ③ version ascending", () => {
  it("Version: vX.Y + 升序（v1.0→v1.1→v1.2）→ 通过", () => {
    const o = clean();
    expect(() => checkVersionAscending(o.historyRows)).not.toThrow();
  });
  it("升序破坏（v1.1 后 v1.0）→ throw", () => {
    const o = loadOverallFile(join(FIX, "drift-descending-overall.md"));
    expect(() => checkVersionAscending(o.historyRows)).toThrow(/ascending|version/i);
  });
  it("版本重复（两行 v1.1）→ throw（③ 重复检测）", () => {
    const o = loadOverallFile(join(FIX, "drift-dup-version-overall.md"));
    expect(() => checkVersionAscending(o.historyRows)).toThrow(/duplicate|repeat|version/i);
  });
});

describe("overall-consistency：§2.4 malformed skip + legacy skip", () => {
  it("表损坏 → loadOverallFile 返回 ok=false（§2.4 malformed skip，main 不 exit）", () => {
    const o = loadOverallFile(join(FIX, "drift-malformed-overall.md"));
    expect(o.ok).toBe(false);
    expect(o.canonical).toBe(false);
  });
  it("非 canonical 头 → canonical=false（不 throw）", () => {
    const o = loadOverallFile(join(FIX, "legacy-format-overall.md"));
    expect(o.ok).toBe(true);
    expect(o.canonical).toBe(false);
  });
});

describe("overall-consistency：检查 ④b / ④c 交叉引用", () => {
  it("graph 引用 P9（inventory 无）→ throw（④b）", () => {
    const o = loadOverallFile(join(FIX, "drift-graphdangling-overall.md"));
    expect(() => checkDepGraphMembership(o.graphTokens, o.phases.map((p) => p.id), o.phases)).toThrow(/P9/i);
  });
  it("dependency 列传 P1 前驱 → 通过（④b）", () => {
    const o = clean();
    expect(() => checkDepGraphMembership(o.graphTokens, o.phases.map((p) => p.id), o.phases)).not.toThrow();
  });
  it("issue ref 畸形（#246#issuecomment-abc）→ throw（④c）", () => {
    const o = loadOverallFile(join(FIX, "drift-badref-overall.md"));
    expect(() => checkIssueRefsWellFormed(o.issues, o.phases.map((p) => p.id))).toThrow(/.+/);
  });
  it("④c 宽松：`#246（session master body）` + `none` 行放行", () => {
    const o = clean(); // fixture 内含这两种形态
    expect(() => checkIssueRefsWellFormed(o.issues, o.phases.map((p) => p.id))).not.toThrow();
  });
  it("issue ref Phase 列 ∈ phaseIds → 通过（④c）", () => {
    const o = clean();
    const phaseIds = o.phases.map((p) => p.id);
    expect(() => checkIssueRefsWellFormed(o.issues, phaseIds)).not.toThrow();
  });
});