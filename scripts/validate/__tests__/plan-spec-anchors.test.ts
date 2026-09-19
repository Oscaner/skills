// scripts/validate/plan-spec-anchors.test.ts — Task 13 (P6): plan/spec anchor
// terminal-state check (spec E2⑥/F1). Fixture-driven behavior for the three
// anchor classes (A `**Spec:**` · B Parent program + version lineage · C file
// path) + pure predicate units + live-repo zero-drift acceptance.
// Fixtures mirror the real docs layout under fixtures/plan-spec-anchors/<set>/
// so repo-root-relative anchors resolve with an injected repoRoot — no
// production special-casing.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { DOC_SPECS_SEGMENTS, DOC_PLANS_SEGMENTS } from "../../lib/doc-root.ts";
import {
  collectPlanSpecAnchorHits,
  checkPlanSpecAnchors,
  isPlaceholderOrTemplateTarget,
  isLegacyRef,
  makeBasenameIndex,
  isRescuedByBasename,
} from "../plan-spec-anchors.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "..", "fixtures", "plan-spec-anchors");
const CLEAN = join(FIX, "clean");

const dirSet = (name: string) => {
  const root = join(FIX, "drift", name);
  return {
    specs: join(root, ...DOC_SPECS_SEGMENTS),
    plans: join(root, ...DOC_PLANS_SEGMENTS),
    root,
  };
};

const kinds = (hits: { kind: string }[]) => hits.map((h) => h.kind);

describe("plan-spec-anchors：Class A `**Spec:**`（plan 锚对实态 design，label==basename）", () => {
  it("clean：repo-root 形 + 相对形 Spec 链接（label==basename）→ 零漂移", () => {
    const hits = collectPlanSpecAnchorHits(
      join(CLEAN, ...DOC_SPECS_SEGMENTS),
      join(CLEAN, ...DOC_PLANS_SEGMENTS),
      CLEAN,
    );
    expect(hits).toEqual([]);
  });
  it("目标文档不存在 → spec-unresolved", () => {
    const d = dirSet("spec-src");
    const hits = collectPlanSpecAnchorHits(d.specs, d.plans, d.root);
    expect(kinds(hits)).toContain("spec-unresolved");
  });
  it("目标存在但 label≠basename → spec-label", () => {
    const d = dirSet("spec-label");
    const hits = collectPlanSpecAnchorHits(d.specs, d.plans, d.root);
    expect(kinds(hits)).toContain("spec-label");
  });
});

describe("plan-spec-anchors：Class B Parent program（目标为 -overall + 版本行迹）", () => {
  it("clean：../specs/ 相对形 + v1.1/v1.2 行迹 → 零漂移", () => {
    const hits = collectPlanSpecAnchorHits(
      join(CLEAN, ...DOC_SPECS_SEGMENTS),
      join(CLEAN, ...DOC_PLANS_SEGMENTS),
      CLEAN,
    );
    expect(hits).toEqual([]);
  });
  it("目标文档不存在 → parent-unresolved", () => {
    const d = dirSet("parent-miss");
    const hits = collectPlanSpecAnchorHits(d.specs, d.plans, d.root);
    expect(kinds(hits)).toContain("parent-unresolved");
  });
  it("目标存在但非 -overall.md → parent-notoverall", () => {
    const d = dirSet("parent-notoverall");
    const hits = collectPlanSpecAnchorHits(d.specs, d.plans, d.root);
    expect(kinds(hits)).toContain("parent-notoverall");
  });
  it("行内 vX.Y ∉ 目标 overall 版本行迹（header ∪ Change history）→ parent-version", () => {
    const d = dirSet("parent-version");
    const hits = collectPlanSpecAnchorHits(d.specs, d.plans, d.root);
    expect(kinds(hits)).toContain("parent-version");
    const v = hits.find((h) => h.kind === "parent-version");
    expect(v?.detail).toContain("v9.9");
  });
});

describe("plan-spec-anchors：Class C 文件路径（file-relative + repo-root 双基 + 豁免）", () => {
  it("path-miss：死锚报 path-unresolved，存活兄弟（repo-root 形自链）不报", () => {
    const d = dirSet("path-miss");
    const hits = collectPlanSpecAnchorHits(d.specs, d.plans, d.root);
    const dead = hits.filter((h) => h.target === "../specs/missing-plan-d-target.md");
    expect(dead.map((h) => h.kind)).toEqual(["path-unresolved"]);
    expect(hits.filter((h) => h.target === "docs/osuperpowers/plans/plan-d.md")).toEqual([]);
    expect(hits.map((h) => h.target)).not.toContain("url");
  });
});

describe("plan-spec-anchors：checkPlanSpecAnchors 抛错聚合（block 12 run 接线）", () => {
  it("clean → 不抛", () => {
    expect(() =>
      checkPlanSpecAnchors(join(CLEAN, ...DOC_SPECS_SEGMENTS), join(CLEAN, ...DOC_PLANS_SEGMENTS), CLEAN),
    ).not.toThrow();
  });
  it("drift → 抛 ANCHOR DRIFT（含 kind/file:line/target）", () => {
    const d = dirSet("parent-version");
    expect(() => checkPlanSpecAnchors(d.specs, d.plans, d.root)).toThrow(/ANCHOR DRIFT.*parent-version/s);
  });
});

describe("plan-spec-anchors：纯谓词（placeholder / legacy / basename-rescue）", () => {
  it("isPlaceholderOrTemplateTarget — 模板/正则/方案/锚点/空格非锚", () => {
    for (const t of [
      "url",
      "<docs/item-{id}.md>",
      "docs/osuperpowers/specs/*.md",
      "[a-z]+",
      "docs/x a.md",
      "docs/a?b",
      "…",
      "#section",
      "https://github.com/x/y/docs/a.md",
      "mailto:dev@example.com",
      "/abs/root/a.md",
      "docs/a{b}.md",
      "docs/a|b.md",
    ]) {
      expect(isPlaceholderOrTemplateTarget(t), `placeholder: ${t}`).toBe(true);
    }
  });
  it("isPlaceholderOrTemplateTarget — 真实相对路径非占位", () => {
    for (const t of [
      "../specs/phase-a-design.md",
      "docs/osuperpowers/specs/phase-a-design.md",
      "../../assets/flow.png",
      "docs/osuperpowers/plans/plan-d.md",
    ]) {
      expect(isPlaceholderOrTemplateTarget(t), `anchor: ${t}`).toBe(false);
    }
  });
  it("isLegacyRef — 已删/迁面（_docs/ · pre-P2 docs/superpowers/ · controller-handoff.md）豁免", () => {
    for (const t of [
      "../_docs/review.md",
      "../../docs/superpowers/specs/2026-09-04-x-overall.md",
      "controller-handoff.md",
    ]) {
      expect(isLegacyRef(t), `legacy: ${t}`).toBe(true);
    }
    expect(isLegacyRef("../specs/program-overall.md")).toBe(false);
  });
  it("makeBasenameIndex + isRescuedByBasename — 迁入 governed 面同名文档 rescues", () => {
    const tmp = mkdtempSync(join(tmpdir(), "psa-anchors-"));
    const specs = join(tmp, "docs", "osuperpowers", "specs");
    const plans = join(tmp, "docs", "osuperpowers", "plans");
    mkdirSync(specs, { recursive: true });
    mkdirSync(plans, { recursive: true });
    writeFileSync(join(specs, "relocated-design.md"), "");
    try {
      const index = makeBasenameIndex(specs, plans);
      expect(index.has("relocated-design.md")).toBe(true);
      expect(isRescuedByBasename("../../old/root/relocated-design.md", index)).toBe(true);
      expect(isRescuedByBasename("../../old/root/typo-design.md", index)).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("plan-spec-anchors：实态 git 树（acceptance 全量锚通过）", () => {
  it("既有 spec/plan 全量锚对实态零漂移（A/B/C 三类）", () => {
    const hits = collectPlanSpecAnchorHits();
    expect(hits).toEqual([]);
  });
});
