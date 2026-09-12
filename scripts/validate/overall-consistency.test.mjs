// scripts/validate/overall-consistency.test.mjs — P4 Task 1 + Task 2:
// parser core + table well-formedness checks (③ change-history ascending +
// dup / ④b dependency membership / ④c issue ref well-formed + phase membership)
// and semantic checks (① backfill claim↔column / ② plan+design doc existence
// via slug suffix glob / ④a anchor registry). clean fixture exercises all green
// paths; drift fixtures pin each throw; malformed + legacy fixtures pin
// ok:false / canonical:false skip paths; span-mixed pins cross-date + range +
// bracket-optional + design cross-ref green paths. Task 6: plan-suffix dual-form
// glob (bare + -plan variant) cross-check on checkDocExistence + anchorScanFiles.

import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadOverallFile,
  checkVersionAscending,
  checkIssueRefsWellFormed,
  checkDepGraphMembership,
  checkBackfillClaims,
  extractClaimRows,
  checkDocExistence,
  checkAnchorRegistry,
  anchorScanFiles,
} from "./overall-consistency.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "overall-consistency");
const SPECS = join(FIX, "specs");
const PLANS = join(FIX, "plans");

const clean = () => loadOverallFile(join(SPECS, "clean-canonic-overall.md"));

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
    const o = loadOverallFile(join(SPECS, "drift-descending-overall.md"));
    expect(() => checkVersionAscending(o.historyRows)).toThrow(/ascending|version/i);
  });
  it("版本重复（两行 v1.1）→ throw（③ 重复检测）", () => {
    const o = loadOverallFile(join(SPECS, "drift-dup-version-overall.md"));
    expect(() => checkVersionAscending(o.historyRows)).toThrow(/duplicate|repeat|version/i);
  });
});

describe("overall-consistency：§2.4 malformed skip + legacy skip", () => {
  it("表损坏 → loadOverallFile 返回 ok=false（§2.4 malformed skip，main 不 exit）", () => {
    const o = loadOverallFile(join(SPECS, "drift-malformed-overall.md"));
    expect(o.ok).toBe(false);
    expect(o.canonical).toBe(false);
  });
  it("非 canonical 头 → canonical=false（不 throw）", () => {
    const o = loadOverallFile(join(SPECS, "legacy-format-overall.md"));
    expect(o.ok).toBe(true);
    expect(o.canonical).toBe(false);
  });
});

describe("overall-consistency：检查 ④b / ④c 交叉引用", () => {
  it("graph 引用 P9（inventory 无）→ throw（④b）", () => {
    const o = loadOverallFile(join(SPECS, "drift-graphdangling-overall.md"));
    expect(() => checkDepGraphMembership(o.graphTokens, o.phases.map((p) => p.id), o.phases)).toThrow(/P9/i);
  });
  it("dependency 列传 P1 前驱 → 通过（④b）", () => {
    const o = clean();
    expect(() => checkDepGraphMembership(o.graphTokens, o.phases.map((p) => p.id), o.phases)).not.toThrow();
  });
  it("issue ref 畸形（#246#issuecomment-abc）→ throw（④c）", () => {
    const o = loadOverallFile(join(SPECS, "drift-badref-overall.md"));
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

describe("overall-consistency：① 回填声明 ↔ 列 双向（Task 2）", () => {
  it("①正向：plan-claim 列 [Pending] → throw", () => {
    const o = loadOverallFile(join(SPECS, "drift-claimvs-pending-overall.md"));
    expect(() => checkBackfillClaims(o.phases, o.historyRows)).toThrow(/P1/);
  });
  it("①括号可选：`Implementation plan Pending → Done` 实为 claim → 列 Done 通过（无 claim 报错）", () => {
    const o = loadOverallFile(join(SPECS, "span-mixed-overall.md"));
    expect(() => checkBackfillClaims(o.phases, o.historyRows)).not.toThrow();
  });
  it("①区间展开：P1–P4/P6 声明 → P1..P4+P6 全列 Done 断言", () => {
    const o = loadOverallFile(join(SPECS, "span-mixed-overall.md"));
    expect(() => checkBackfillClaims(o.phases, o.historyRows)).not.toThrow();
  });
  it("①单行混合（cdd v1.27 形态）：同一行 plan 区间 + design 声明 → 全断言", () => {
    const o = loadOverallFile(join(SPECS, "one-row-mixed-overall.md"));
    expect(() => checkBackfillClaims(o.phases, o.historyRows)).not.toThrow();
  });
  it("①CLAIM_RE 尾随标点防御（warn fix 回归）：`Pending → Done。` / `→ Done——` 目标不含标点", () => {
    const { planClaims } = extractClaimRows([
      { summary: "P1 四表回填：Implementation plan 列 Pending → Done。但 P2 未同步——" },
      { summary: "P2 回填：plan 列 Pending → Done——后续处理", version: [1,1], date: "2026-09-05" },
    ]);
    expect(planClaims.get("P1")).toBe("Done");
    expect(planClaims.get("P2")).toBe("Done");
  });
  it("①design-claim 列 [Pending] → throw（指定 §2.5 item 8）", () => {
    const o = loadOverallFile(join(SPECS, "drift-designclaim-fail-overall.md"));
    expect(() => checkBackfillClaims(o.phases, o.historyRows)).toThrow(/P\d+/);
  });
  it("①反向：plan 列 Done 但全史无 plan-claim → throw", () => {
    const o = loadOverallFile(join(SPECS, "drift-noclaim-done-overall.md"));
    expect(() => checkBackfillClaims(o.phases, o.historyRows)).toThrow(/claim/i);
  });
});

describe("overall-consistency：② 文档存在性 slug glob（Task 2）", () => {
  it("②文档存在：slug glob 命中跨日期文档（overall 2026-09-05 → p2 2026-09-07）→ 通过", () => {
    const o = loadOverallFile(join(SPECS, "span-mixed-overall.md"));
    expect(o.slug).toBe("span-mixed");
    expect(() => checkDocExistence(o.phases, o.slug, SPECS, PLANS)).not.toThrow();
    const miss = loadOverallFile(join(SPECS, "drift-missingdoc-overall.md"));
    expect(() => checkDocExistence(miss.phases, miss.slug, SPECS, PLANS)).toThrow(/plan/i);
  });
  it("②design 跨引用忽略：P2 列含 `（源 P3-design）` 只断言 p2 design 文档", () => {
    const o = loadOverallFile(join(SPECS, "span-mixed-overall.md"));
    expect(() => checkDocExistence(o.phases, o.slug, SPECS, PLANS)).not.toThrow();
  });
});

describe("overall-consistency：④a 锚点注册域（Task 2）", () => {
  it("④a：phase 文档锚点 #999#issuecomment-… 不在注册域 → throw", () => {
    const o = loadOverallFile(join(SPECS, "drift-anchor-unregistered-overall.md"));
    const scan = [
      join(SPECS, "drift-anchor-unregistered-overall.md"),
      join(SPECS, "drift-anchor-unregistered-p1.md"),
    ];
    expect(() => checkAnchorRegistry(o.issues, scan)).toThrow(/999/);
  });
});

describe("overall-consistency：②/④a 双形 glob（Task 6: P5 -plan 命名）", () => {
  it("②plan 双形：无后缀 plan 命中（既有 shipped 路径 span-mixed 回归）→ 通过", () => {
    const phases = [{ id: "P1", design: "Pending", plan: "Done", dependency: "" }];
    expect(() => checkDocExistence(phases, "span-mixed", SPECS, PLANS)).not.toThrow();
  });
  it("②plan 双形：`-plan.md` 变体命中（planvar p2 仅 -plan 形）→ 通过", () => {
    const phases = [{ id: "P2", design: "Pending", plan: "Done", dependency: "" }];
    expect(() => checkDocExistence(phases, "planvar", SPECS, PLANS)).not.toThrow();
  });
  it("②plan 双形：两形并存（bare + -plan）→ duplicate（跨形并存重复检测）", () => {
    const phases = [{ id: "P1", design: "Pending", plan: "Done", dependency: "" }];
    expect(() => checkDocExistence(phases, "planvar", SPECS, PLANS)).toThrow(/duplicate|dup|重复/i);
  });
  it("④a anchorScanFiles 双形：scan 面含 -plan 变体 + bare 形，跨 slug 不串", () => {
    const overall = join(SPECS, "span-mixed-overall.md");
    const files = anchorScanFiles(overall, "planvar", SPECS, PLANS);
    expect(files[0]).toBe(overall);
    expect(files).toContain(join(PLANS, "2026-09-07-planvar-p1.md"));
    expect(files).toContain(join(PLANS, "2026-09-07-planvar-p1-plan.md"));
    expect(files).toContain(join(PLANS, "2026-09-07-planvar-p2-plan.md"));
    // planvar glob 不命中 span-mixed 文档（跨 slug 隔离）
    expect(files).not.toContain(join(PLANS, "2026-09-07-span-mixed-p1.md"));
  });
});
