// scripts/validate/residue.test.mjs — T9: stale-lexicon 断言组行为（unit）+ live-repo 零残留。
// hasHit 模拟 residue.mjs 5c 步的扫描语义（任一 check 正则命中任一行即 hit），钉死
// canonical 合法语汇（finding-meta.json `dogfood (CDD session)` 下拉、spec-review-1.json 家族名、
// contract.mjs spec D1/D4/D5a 与 dirty working tree（D2）注释）不得误报。collectStaleLexiconHits()
// 与 validate 5c 步同源扫描 —— unit 绿 + live-repo 零残留等于该 step 双断言行为。
import { describe, it, expect } from "vitest";

import { hasHit, collectStaleLexiconHits } from "./residue.mjs";

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
  it("len 语境 D[123]: 命中；spec/工作树注释非语境不误报", () => {
    expect(hasHit(["lens D1: 重复"])).toBe(true);
    expect(hasHit(["spec D1/D4/D5a"])).toBe(false);
    expect(hasHit(["dirty working tree（D2）"])).toBe(false);
  });
});

describe("live repo：5c 同源扫描零残留", () => {
  it("collectStaleLexiconHits() === []（templates/fix.md 与 engine 测试同样入扫）", () => {
    expect(collectStaleLexiconHits()).toEqual([]);
  });
});