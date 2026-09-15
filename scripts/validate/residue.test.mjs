// scripts/validate/residue.test.mjs — T9: stale-lexicon 断言组行为（unit）+ live-repo 零残留；
// T6（P5）补 gate-lexicon 断言组（正例命中 + 反射例零误报 + 临时文件扫描命中）。
// T5（P2/P3）补 old-docs-root 与 removed-cdd-subcommand 守卫断言组（命令形正例 + 反射例零误报 + 临时文件扫描命中）。
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

import { hasHit, collectStaleLexiconHits, collectGateLexiconHits, DOC_SURFACE_TARGETS } from "./residue.mjs";

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
  it("flat docs-review root 回退路径命中（T9 nit4 补测）+ 新 <cdd> / standalone 守卫 + sdd 放行", () => {
    expect(hasHit([".superpowers/docs-review/task-1.json"])).toBe(true);
    expect(hasHit([".superpowers/cdd/foo/spec-review-1.json"])).toBe(true); // 新 <cdd> 守卫命中
    expect(hasHit([".superpowers/standalone/x/base-branch.json"])).toBe(true); // standalone 守卫命中
    expect(hasHit([".superpowers/sdd/foo/progress.json"])).toBe(false);      // sdd 保留面放行
  });
});

// Task 5（P2）：old docs root 守卫（机制位置 + 文档表层）。测试自身同样不得写回字面 ——
// 经字符串拼接构造旧根，否则本文件会成为 Task 6 全仓 grep 的第三类命中。
describe("stale-lexicon：old docs root 守卫（Task 5）", () => {
  const OLD_DOCS_ROOT = "docs" + "/superpowers";
  it("旧 docs 根命中（机制/文档表层）；新根 docs/osuperpowers/ 放行", () => {
    expect(hasHit([`${OLD_DOCS_ROOT}/specs/foo.md`])).toBe(true); // 新守卫命中
    expect(hasHit(["docs/osuperpowers/specs/foo.md"])).toBe(false); // 新根放行
  });
});

// Task 5（P3）：已删 cdd 子命令守卫。字面经字符串拼接构造（P2 先例）——本文件不在任何
// 守卫 scope 内（守卫 scope = OSKILLS + CDD_ENGINE + DOC_SURFACE_TARGETS，无 scripts/），
// 但守卫测试保持零字面，可在 scope 未来扩张时不反噬自身。
describe("stale-lexicon：removed cdd subcommand 守卫（Task 5）", () => {
  const CDD = "cd" + "d";
  it("命令形命中；裸 research / brief 放行（P4 合法调用面）", () => {
    expect(hasHit([`Run \`${CDD} research --brief x --output y\``])).toBe(true);
    expect(hasHit([`Run \`${CDD} brief --task 1 --plan p --output o\``])).toBe(true);
    expect(hasHit(["/mattpocock-skills:research 会话调用"])).toBe(false);
    expect(hasHit(["brief-dependent plan sections"])).toBe(false);
    expect(hasHit(["cddr research"])).toBe(false);        // 词边界：非 `cdd ` 前缀
  });
  it("research timeout env 命中（单分支覆盖两种被删形态）；task/review timeout 放行", () => {
    // `RESEARCH_TIMEOUT` 为无锚定子串匹配 → `CDD_RESEARCH_TIMEOUT` 由其覆盖（T5 review-1 nit：
    // 原 alternation 的 `CDD_` 前缀分支为死分支，两行断言实际等价）。此处显式断言两形态同源覆盖。
    expect(hasHit([`${"CDD_RESEARCH"}_TIMEOUT=2700`])).toBe(true); // CDD_ 前缀形态（由后缀分支覆盖）
    expect(hasHit([`${"RESEARCH"}_TIMEOUT=2700`])).toBe(true);     // legacy 裸名形态
    expect(hasHit(["CDD_TASK_TIMEOUT=60"])).toBe(false);
    expect(hasHit(["CDD_REVIEW_TIMEOUT=60"])).toBe(false);
  });
  it("含命令形的临时文件被 collectStaleLexiconHits 命中（扫描面在扫）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-p3-"));
    const f = path.join(dir, "note.md");
    writeFileSync(f, `Run \`${CDD} research --brief b\`\n`, "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toBe("removed cdd subcommand (pre-P3)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
  it("单文件 target 分支命中（README.md 场景；scanTargets isDirectory()===false → [abs]）", () => {
    const f = path.join(mkdtempSync(path.join(tmpdir(), "residue-gate-file-")), "single.md");
    writeFileSync(f, "cdd-gate bin/gate/adapters/pi.ts\n", "utf8");
    try {
      const hits = collectGateLexiconHits([f]);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].file.endsWith("single.md")).toBe(true);
    } finally {
      rmSync(path.dirname(f), { recursive: true, force: true });
    }
  });
  it("含旧 docs 根字面（拼接构造）的临时文件被 collectStaleLexiconHits 命中——doc-surface 面在扫面内", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-docroot-"));
    const f = path.join(dir, "CLAUDE.md");
    writeFileSync(f, "Strategy B: `" + ["docs", "superpowers"].join("/") + "/specs/*.md`\n", "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toBe("old docs root (pre-P2)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("DOC_SURFACE_TARGETS 覆盖治理文件面（scope 缩小即失败）", () => {
    for (const p of ["CLAUDE.md", "README.md", "packages/osuperpowers/README.md", "docs/maintainers"]) {
      expect(DOC_SURFACE_TARGETS).toContain(p);
    }
  });
  it("collectGateLexiconHits() === []（机制/文档表层零残留；docs/osuperpowers/{specs,plans} 历史文档 + CHANGELOG 豁免）", () => {
    expect(collectGateLexiconHits()).toEqual([]);
  });
});
