// scripts/validate/residue.test.mjs — T9: stale-lexicon 断言组行为（unit）+ live-repo 零残留；
// T6（P5）补 gate-lexicon 断言组（正例命中 + 反射例零误报 + 临时文件扫描命中）。
// hasHit 模拟 residue.mjs 5c 步的扫描语义（任一 check 正则命中任一行即 hit），钉死
// canonical 合法语汇（finding-meta.json `dogfood (CDD session)` 下拉、spec-review-1.json 家族名、
// contract.mjs spec D1/D4/D5a 与 dirty working tree（D2）注释）不得误报；gate 反射例
// （validateCommitContract / HARD GATE / cdd-commit-gate-smoke / ship gate / cdd-gate-test git 身份）
// 同为合法语汇。collectStaleLexiconHits()/collectGateLexiconHits() 与 validate 5c 步同源扫描
// —— unit 绿 + live-repo 零残留等于该 step 双断言行为。
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { hasHit, collectStaleLexiconHits, collectGateLexiconHits } from "./residue.mjs";

describe("stale-lexicon：断言组行为（brief Step 1）", () => {
  it("dogfood (CDD session) 下拉不误报（非裸 \"dogfood\" label）", () => {
    expect(hasHit(['"dogfood (CDD session)"'])).toBe(false);
  });
  it("labels bug, dogfood, osuperpowers 命中（label 语法位）", () => {
    expect(hasHit(["labels bug, dogfood, osuperpowers"])).toBe(true);
  });
  it("旧 mode task-review 命中（cdd-engine）", () => {
    expect(hasHit(["CDD_MODE must be implement|task-review|fix"])).toBe(true);
  });
  it("doc-fix- 退化名命中（P4 degraded filename）", () => {
    expect(hasHit(['const h = "doc-fix-1.json"'])).toBe(true);
  });
  it("canonical 家族名不误报：spec-review-1.json 合法", () => {
    expect(hasHit(['"spec-review-1.json"'])).toBe(false);
  });
});

describe("stale-lexicon：机制位置精确性", () => {
  it("PASS=< 旧 lens 参数命中；{{PASS}} 花括号形式不命中", () => {
    expect(hasHit(["PASS=<completeness>"])).toBe(true);
    expect(hasHit(["{{PASS}}"])).toBe(false);
  });
  it("旧文档名 docs-review.md 命中", () => {
    expect(hasHit(["and write docs-review.md"])).toBe(true);
  });
  it("解析器旧词汇 resolve-hit / gh issue reopen 命中", () => {
    expect(hasHit(["resolve-hit: 2"])).toBe(true);
    expect(hasHit(["gh issue reopen 42"])).toBe(true);
  });
  it("lens 语境 D[123]: 命中；spec/工作树注释非语境不误报", () => {
    expect(hasHit(["lens D1: 重复"])).toBe(true);
    expect(hasHit(["spec D1/D4/D5a"])).toBe(false);
    expect(hasHit(["dirty working tree（D2）"])).toBe(false);
  });
  it("flat docs-review root 回退路径命中（T9 nit4 补测）", () => {
    expect(hasHit([".superpowers/docs-review/task-1.json"])).toBe(true);
    expect(hasHit([".superpowers/cdd/foo/spec-review-1.json"])).toBe(false); // 规范家族名不误报
  });
});

describe("live repo：5c 同源扫描零残留", () => {
  it("collectStaleLexiconHits() === []（templates/fix.md 与 engine 测试同样入扫）", () => {
    expect(collectStaleLexiconHits()).toEqual([]);
  });
});

describe("gate-lexicon：正例命中（T6 Step 2）", () => {
  it("bin/gate/ 路径命中（deleted gate dir，含 adapters/configs 下端）", () => {
    expect(hasHit(["cdd-gate 子系统已删 packages/osuperpowers/bin/gate/adapters/kiro.mjs"])).toBe(true);
    expect(hasHit(["ref bin/gate/cdd-gate-core.mjs"])).toBe(true);
  });
  it("CDD_GATE env 命中（含带后缀形式）", () => {
    expect(hasHit(["export CDD_GATE_WORKSPACE=…"])).toBe(true);
    expect(hasHit(["gate activation via CDD_GATE_MODE"])).toBe(true);
  });
  it("cdd-gate-core 模块名命中", () => {
    expect(hasHit(["import { decide } from './cdd-gate-core.mjs'"])).toBe(true);
  });
  it("gateDecide 可调用命中", () => {
    expect(hasHit(["gateDecide({ mode, workspace }) → gate 决断"])).toBe(true);
  });
  it("被删 adapter 文件名命中（gate/adapters/ 前缀）", () => {
    expect(hasHit(["bin/gate/adapters/pi.ts"])).toBe(true);
    expect(hasHit(["gate/adapters/kiro.mjs"])).toBe(true);
  });
});

describe("gate-lexicon：合法语汇零误报（T6 Step 4 反射例）", () => {
  it("validateCommitContract 不误报", () => {
    expect(hasHit(["validateCommitContract(base, head)"])).toBe(false);
  });
  it("HARD GATE / {{HARD_GATE}} 不误报", () => {
    expect(hasHit(["HARD GATE 归一"])).toBe(false);
    expect(hasHit(["{{HARD_GATE}}"])).toBe(false);
  });
  it("cdd-commit-gate-smoke（retired 脚本名）不误报", () => {
    expect(hasHit(["port 自 cdd-commit-gate-smoke.sh（16 断言）"])).toBe(false);
  });
  it("现役 ship gate / evidence-gate / cdd-gate-test git 身份不误报", () => {
    expect(hasHit(["Registry ship gate + CLI preflight"])).toBe(false);
    expect(hasHit(["evidence-gate（behavior_change:true → hard）"])).toBe(false);
    expect(hasHit(["user.name=cdd-gate-test"])).toBe(false);
  });
});

describe("gate-lexicon：扫描行为（T6 Step 2 临时文件）+ live-repo", () => {
  it("含 bin/gate/ 引用的临时文件被 collectGateLexiconHits 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-gate-"));
    const f = path.join(dir, "note.md");
    writeFileSync(f, "cdd-gate 子系统已删（packages/osuperpowers/bin/gate/）\n", "utf8");
    try {
      const hits = collectGateLexiconHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toBe("deleted gate dir bin/gate/");
      expect(hits[0].file).toContain("note.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("collectGateLexiconHits() === []（机制/文档表层零残留；docs/superpowers + CHANGELOG 豁免）", () => {
    expect(collectGateLexiconHits()).toEqual([]);
  });
});
