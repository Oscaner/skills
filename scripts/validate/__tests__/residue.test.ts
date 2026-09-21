// scripts/validate/residue.test.ts — T9: stale-lexicon 断言组行为（unit）+ live-repo 零残留；
// T6（P5）补 gate-lexicon 断言组（正例命中 + 反射例零误报 + 临时文件扫描命中）。
// T5（P2/P3）补 old-docs-root 与 removed-cdd-subcommand 守卫断言组（命令形正例 + 反射例零误报 + 临时文件扫描命中）。
// hasHit 模拟 residue.ts 5c 步的扫描语义（任一 check 正则命中任一行即 hit），钉死
// canonical 合法语汇（finding-meta.json `dogfood (CDD session)` 下拉、spec-review-1.json 家族名、
// contract.mjs spec D1/D4/D5a 与 dirty working tree（D2）注释）不得误报；gate 反射例
// （validateCommitContract / HARD GATE / cdd-commit-gate-smoke / ship gate / cdd-gate-test git 身份）
// 同为合法语汇。collectStaleLexiconHits()/collectGateLexiconHits() 与 validate 5c 步同源扫描
// —— unit 绿 + live-repo 零残留等于该 step 双断言行为。
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import {
  hasHit,
  collectStaleLexiconHits,
  collectGateLexiconHits,
  DOC_SURFACE_TARGETS,
  collectChannelAuditHits,
  collectProcessCwdAudit,
  collectEnvDirectReadHits,
  collectEnvPassThroughHits,
  collectEnvSpreadHits,
  collectSixEnvKeyHits,
  collectPathArgResolverHits,
  collectRootResolverHits,
  collectTestSeamHits,
  collectHandoffShapeHits,
  collectTimedOutSoleHits,
  collectContextWriteHits,
  helpOptionFlags,
  helpFlagsNotInCanonical,
  collectContextModuleHardcodeHits,
  collectResidualRereadHits,
  collectCountersContractHits,
  collectVersionStampHits,
  collectInitReferenceHits,
  collectShippedGuardHits,
  SHIPPED_SURFACE_TARGETS,
  INIT_REFERENCE_TARGETS,
  collectHandoffSchemaHits,
  HANDOFF_SCHEMA_TARGETS,
  collectUpstreamReadHits,
  collectUpstreamSlashFormHits,
  collectInternalDependencyHits,
  collectFixInlineHits,
  collectReviewLoopFixCddHits,
  collectFailureModeCategoryHits,
  collectFailureModeSemanticsHits,
  collectDocsRefHits,
  collectSkillSurfaceHits,
  ORCHESTRATOR_SKILLS,
  collectMjsTerminalStateViolations,
  collectMemoryGuardViolations,
  collectCommentAnchorHits,
  scanTargets,
} from "../residue.ts";

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

// ---- Task 23（P6 / spec F8a）：H1 无语义名守卫 —— 大写词形 + 小写驼峰标识符互补 ----

describe("stale-lexicon：H1 语汇守卫（Task 23 / F8a）", () => {
  it("大写词形 H1 命中；新语汇 return block 放行", () => {
    expect(hasHit(["the H1 four-line parse"])).toBe(true);
    // 下划线是词字符 —— `\bH1\b` 不锚 H1_BLOCK 形（match 语义；补覆盖由 h1 驼峰标识符正则承担，
    // 大写嵌入形本就不作标识符使用）。断言钉死边界，避免误以为守卫覆盖面更宽。
    expect(hasHit(["H1_BLOCK"])).toBe(false);
    expect(hasHit(["return block parse"])).toBe(false);
    expect(hasHit(["return block `status: BLOCKED`"])).toBe(false);
  });
  it("小写 h1 驼峰标识符命中；return* 标识符放行", () => {
    expect(hasHit(["h1FourLines("])).toBe(true);
    expect(hasHit(["h1FromHandoff("])).toBe(true);
    expect(hasHit(["const h1 = ["])).toBe(true);
    expect(hasHit(["res.h1[0]"])).toBe(true);
    expect(hasHit(["returnFromHandoff("])).toBe(false);
    expect(hasHit(["returnCountersLine("])).toBe(false);
    expect(hasHit(["returnBlock"])).toBe(false);
  });
  it("含 h1 标识符的临时文件被 collectStaleLexiconHits 命中（CDD_ENGINE_BIN 面在扫）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-h1-"));
    writeFileSync(path.join(dir, "note.ts"), "h1FourLines(...)\n", "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      const labels = hits.map((x) => x.label).join("\n");
      expect(labels).toContain("h1* identifiers (residual)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- Task 18（P6 / spec F8）：Review Convergence 术语改名守卫 —— 旧名组合形 + 引擎面零残留 ----
// 旧术语字面经字符串拼接构造（P2/P3 先例）：本文件不在任一守卫 scope 内，但守卫测试保持
// 零字面，可在 scope 未来扩张时不反噬自身。
describe("stale-lexicon：Review Convergence 改名守卫（Task 18 / F8）", () => {
  const OLD_TERM = "Review " + "Stopping";
  const OLD_MARKER = "timeout-" + "exhausted";
  const OLD_CAP = "fix-loop-" + "exhausted";
  it("旧术语 Review Stopping 命中；新语汇 Review Convergence 放行", () => {
    expect(hasHit([`the ${OLD_TERM} guard`])).toBe(true);
    // 组合形（下划线）为旧名禁止表注册形——词边界不锚（与 H1_BLOCK 先例一致），治理面可安全引用。
    expect(hasHit(["review_stopping 禁止表"])).toBe(false);
    expect(hasHit(["Review Convergence entry"])).toBe(false);
  });
  it("小写 stopping 模块/标识符命中（CDD_ENGINE 面）；stop/stops/stopped 及 convergence 放行", () => {
    expect(hasHit(["export function stopping("])).toBe(true);
    expect(hasHit([".superpowers stopping.json"])).toBe(true);
    expect(hasHit(["stops the re-dispatch"])).toBe(false);
    expect(hasHit(["stop retrying"])).toBe(false);
    expect(hasHit(["convergedExit3"])).toBe(false);
    expect(hasHit(["reviewConvergenceGuard"])).toBe(false);
  });
  it("已废失败面字面（fix-loop-exhausted / timeout-exhausted）命中；新 cap 名放行", () => {
    expect(hasHit([`blocker=${OLD_MARKER}`])).toBe(true);
    expect(hasHit([`${OLD_CAP} 计数`])).toBe(true);
    expect(hasHit(["dispatch-timeout-cap"])).toBe(false);
    expect(hasHit(["review-cycle-cap"])).toBe(false);
  });
  it("含旧术语的临时文件被 collectStaleLexiconHits 命中（机制面在扫）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-f8-"));
    writeFileSync(path.join(dir, "SKILL.md"), `${OLD_TERM} in Invariants\n`, "utf8");
    writeFileSync(path.join(dir, "mechanism.ts"), "request.stopping = true;\n", "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      const labels = hits.map((x) => x.label).join("\n");
      expect(labels).toContain("Review Stopping retired term");
      expect(labels).toContain("stopping modules/identifiers");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("live repo：5c 同源扫描零残留", () => {
  it("collectStaleLexiconHits() === []（template-contract.json 与 engine 测试同样入扫）", () => {
    expect(collectStaleLexiconHits()).toEqual([]);
  });
});

// ---- Task 2（P6）：vendors 自维护面撤除 —— 防回渗语汇守卫（B12）----
// spec F7 明确 docs/maintainers 的 vendor-reference 清理延后至后续 F 域重组 —— 三条守卫
// scope 取 ALL_MECH_POSITIONS（机制位置零豁免），不含 DOC_SURFACE_TARGETS（README/CLAUDE
// 的 vendored-submodule 描述由 B10/B11 自管）。反射例：裸 superpowers（上游名）与普通英文
// vendor 一词均放行 —— 守卫只盯 `vendors/` 路径形、`publish-vendor` 词形、`submodule` 词。
describe("stale-lexicon：vendors 自维护语汇（P6 Task 2 / B12）", () => {
  it("vendors/ 路径形命中", () => {
    expect(hasHit(["read ../../vendors/mattpocock-skills/SKILL.md"])).toBe(true);
  });
  it("publish-vendor 词形命中（含文件名形）", () => {
    expect(hasHit(["steps 自 publish-vendor.mjs"])).toBe(true);
  });
  it("submodule 词命中（git submodule update · submodules: recursive 等）", () => {
    expect(hasHit(["git submodule update --init"])).toBe(true);
    expect(hasHit(["checkout submodules: recursive"])).toBe(true);
  });
  it("合法语汇零误报：裸 superpowers / 普通 vendor 英文词放行", () => {
    expect(hasHit(["superpowers orchestration 编排"])).toBe(false);
    expect(hasHit(["vendors 撤除后 vendor 依赖已散"])).toBe(false);
  });
  it("含 vendors/ 路径的临时文件被 collectStaleLexiconHits 命中（机制扫描面在扫）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-vendors-"));
    writeFileSync(
      path.join(dir, "SKILL.md"),
      "read `vendors/superpowers/.claude-plugin/plugin.json`\n",
      "utf8",
    );
    try {
      const hits = collectStaleLexiconHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/vendors\//);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- Task 19（P6）：F2 全量断言 —— .agents emit 面（A5）+ droid/pi keywords（A3）防回渗 ----
// .agents 守卫 scope = ALL_MECH_POSITIONS（机制位置零豁免；docs/maintainers 的 stale 引用
// 清理延后至 F7 重组合并面）；droid/pi 守卫只守 A3 落点 package.json（`\bpi\b` 同时覆盖
// 死 `#pi` 字段形与 keywords 的 pi 词）。反例：无 `.` 前缀的 agents、英文词 pipeline/
// principal/piper、版本号 0.1.1 均放行。
describe("stale-lexicon：.agents + droid/pi 语汇（P6 Task 19 / spec F2）", () => {
  it(".agents/ 路径形命中（emit 副本面回渗）", () => {
    expect(hasHit(["packages/osuperpowers/.agents/skills/writing-single-spec/SKILL.md"])).toBe(true);
  });
  it(".agents 行尾形命中（裸目录名回渗）", () => {
    expect(hasHit(["retired emit tree at packages/osuperpowers/.agents"])).toBe(true);
  });
  it("无 `.` 前缀的 agents 与普通散文放行", () => {
    expect(hasHit(["the shared agents namespace"])).toBe(false);
    expect(hasHit(["multi-agent orchestration"])).toBe(false);
  });
  it("droid/pi keywords 命中（含死 #pi 字段形）", () => {
    expect(hasHit(['"keywords": ["ped", "pi"]'])).toBe(true);
    expect(hasHit(['"droid"'])).toBe(true);
    expect(hasHit(['"#pi": {…}'])).toBe(true);
  });
  it("英文词零误报：pipeline/principal/piper/版本号放行", () => {
    expect(hasHit(["pipeline of rollouts"])).toBe(false);
    expect(hasHit(["principal maintainer"])).toBe(false);
    expect(hasHit(['"version": "0.1.1"'])).toBe(false);
  });
  it("含 .agents/ 路径的临时文件被 collectStaleLexiconHits 命中（机制扫描面在扫）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-agents-"));
    writeFileSync(path.join(dir, "SKILL.md"), "copy `.agents/skills/` namespace\n", "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/\.agents/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("含 droid keyword 的临时 package.json 被 collectStaleLexiconHits 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-droid-"));
    writeFileSync(path.join(dir, "package.json"), '{"keywords": ["osuperpowers", "droid"]}\n', "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/droid\/pi/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

// ---- Task 15: old mode task-review 守卫扩容（design §2.8 行 21）----
// 正则由裸子串收敛为 /(?<!run-)task-review/（负向后顾豁免新图节点名 run-task-review，scope
// 由 CDD_ENGINE 扩至 ALL_MECH_POSITIONS——skills 面裸 task-review 已由 T11/T14/T15 三批清零，
// 常驻防回归）。scripts/ 不在 scope 内，本文件直接写字面无自噬风险。
describe("stale-lexicon：old mode task-review（T15 行 21 扩容）", () => {
  it("裸 task-review 命中（旧 mode 名形，含 CDD_MODE 赋值形）", () => {
    expect(hasHit(["CDD_MODE must be implement|task-review|fix"])).toBe(true);
    expect(hasHit(['CDD_MODE = "task-review"'])).toBe(true);
    expect(hasHit(["spec-review/plan-review 之外的 task-review 旧 mode"])).toBe(true);
  });
  it("新图节点名 run-task-review 不命中（负向后顾豁免）", () => {
    expect(hasHit(["run-task-review 重新派发"])).toBe(false);
    expect(hasHit(["exit run-task-review → cli-fix-all-findings"])).toBe(false);
  });
  it("含裸 task-review 的临时文件被 collectStaleLexiconHits 命中；仅 run-task-review 不命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t15-"));
    writeFileSync(path.join(dir, "a.mjs"), "export const MODES = 'implement|task-review|fix';\n", "utf8");
    writeFileSync(path.join(dir, "b.mjs"), "export const NODE = 'run-task-review';\n", "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toBe("old mode task-review");
      expect(hits[0].file).toContain("a.mjs");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- Task 8: channel audit（design §2.8 行 1–11、13，engine 侧 12 条）----
// 每个收集函数注入临时目录/文件构造违规形态 → 断言命中（Step 1 正例）；合法形 → 反射零命中；
// 末尾 live-repo 断言 `collectChannelAuditHits() === []`（Step 3）。⑤ 的两个旧根语汇按拼接构造
//（本测试文件位于 ⑤ target 集 scripts/ 内，连续字面会反噬守卫自身）。
const ROOT_FROM_DOC = "root" + "FromDoc" + "Path";
const RESOLVE_REPO_ROOT = "resolve" + "Repo" + "Root";

describe("channel audit：① process.cwd() 单点收口", () => {
  it("bin+lib 内 2 处 process.cwd() → 命中（期望恰 1 处）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-cwd-2-"));
    writeFileSync(path.join(dir, "a.mjs"), "gitToplevel(process.cwd())\n", "utf8");
    writeFileSync(path.join(dir, "b.mjs"), "another = process.cwd()\n", "utf8");
    try {
      const hits = collectProcessCwdAudit([dir]);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].label).toMatch(/non-single/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("唯一 1 处但不在 src/bin.ts → 命中（未收口到 bin.ts）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-cwd-1-"));
    writeFileSync(path.join(dir, "other.mjs"), "const r = process.cwd();\n", "utf8");
    try {
      const hits = collectProcessCwdAudit([dir]);
      expect(hits.length).toBe(1);
      expect(hits[0].label).toMatch(/not converged to src\/bin\.ts/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：src/bin.ts 内恰 1 处 → 零命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-cwd-ok-"));
    const chain = path.join(dir, "src");
    require("node:fs").mkdirSync(chain, { recursive: true });
    writeFileSync(path.join(chain, "bin.ts"), "const repoRoot = await initRoot(process.cwd());\n", "utf8");
    try {
      expect(collectProcessCwdAudit([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：② process.env 取值直读 ⊆ canonical 白名单（三形）", () => {
  it("process.env.X 非白名单键 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-env-"));
    writeFileSync(path.join(dir, "leak.mjs"), "const k = process.env.ANTHROPIC_API_KEY;\n", "utf8");
    try {
      const hits = collectEnvDirectReadHits([dir]);
      expect(hits.length).toBe(1);
      expect(hits[0].label).toMatch(/ANTHROPIC_API_KEY/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("process.env[\"X\"] 与 env.X 非白名单键 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-env-2-"));
    writeFileSync(path.join(dir, "leak.mjs"), `a = process.env["CDD_LEDGER"]; b = env.TEST_SEAM;\n`, "utf8");
    try {
      const hits = collectEnvDirectReadHits([dir]);
      expect(hits.length).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：白名单键（markers / var）三形全放行", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-env-ok-"));
    writeFileSync(
      path.join(dir, "ok.mjs"),
      'a = process.env.PATH; b = process.env["AI_AGENT"]; c = env.CURSOR_TRACE_ID; d = env.CLAUDE_CODE_SESSION_ID;\n',
      "utf8",
    );
    try {
      expect(collectEnvDirectReadHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：③ 整表透传点 ⊆ §2.4.4-② 清单 + 零 spread + 六键零命中", () => {
  it("裸 process.env 整表透传不在清单内 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-passthru-"));
    writeFileSync(path.join(dir, "x.mjs"), "const e = process.env;\n", "utf8");
    try {
      const hits = collectEnvPassThroughHits([dir]);
      expect(hits.length).toBe(1);
      expect(hits[0].label).toMatch(/inventory/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("process.env spread 注入 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-spread-"));
    writeFileSync(path.join(dir, "x.mjs"), "const e = { ...process.env, PLAN_FILE: plan };\n", "utf8");
    try {
      const hits = collectEnvSpreadHits([dir]);
      expect(hits.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("六键名（含注释行）→ 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-sixkey-"));
    writeFileSync(path.join(dir, "x.mjs"), "// CDD_LIFECYCLE_PATH / NODE_ENV 曾为 env 通道键名\n", "utf8");
    try {
      const hits = collectSixEnvKeyHits([dir]);
      expect(hits.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：④ 路径实参必须过唯一 resolver", () => {
  it("opts.plan 绕过 resolver 直读文件 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-arg-"));
    writeFileSync(path.join(dir, "bypass.mjs"), "const x = readFileSync(opts.plan, \"utf8\");\n", "utf8");
    try {
      const hits = collectPathArgResolverHits([dir], []);
      expect(hits.length).toBe(1);
      expect(hits[0].label).toMatch(/resolver/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("resolveWorkspace 收到原始 opts.spec → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-arg-2-"));
    writeFileSync(path.join(dir, "bypass.mjs"), "const ws = resolveWorkspace(opts.spec, root);\n", "utf8");
    try {
      const hits = collectPathArgResolverHits([dir], []);
      expect(hits.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("readFile（fs/promises）与 import(opts.*) 旁路形 → 命中（review-1 nit 补测）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-arg-4-"));
    writeFileSync(path.join(dir, "bypass.mjs"), "const p = readFile(opts.plan, \"utf8\");\nconst doc = await import(opts.findings);\n", "utf8");
    try {
      const hits = collectPathArgResolverHits([dir], []);
      expect(hits.length).toBe(2);
      expect(hits[0].label).toMatch(/resolver/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("call-site 文件缺 resolveDocArg 引用 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-arg-3-"));
    const f = path.join(dir, "base-branch.ts");
    writeFileSync(f, "export function resolveBaseBranchWorkspace(opts) { return opts.plan; }\n", "utf8");
    try {
      const hits = collectPathArgResolverHits([], [f]);
      expect(hits.length).toBe(1);
      expect(hits[0].label).toMatch(/resolveDocArg/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：⑤ 全仓零旧根解析函数（拼接形字面）", () => {
  it(`${ROOT_FROM_DOC} 命中（含 tests 与 scripts 的 target 集）`, () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-root1-"));
    writeFileSync(path.join(dir, "x.mjs"), `import { ${ROOT_FROM_DOC} } from "./doc-root.ts";\n`, "utf8");
    try {
      const hits = collectRootResolverHits([dir]);
      expect(hits.length).toBe(1);
      expect(new RegExp(ROOT_FROM_DOC).test(hits[0].label)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it(`${RESOLVE_REPO_ROOT} 命中`, () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-root2-"));
    writeFileSync(path.join(dir, "y.mjs"), `const r = ${RESOLVE_REPO_ROOT}();\n`, "utf8");
    try {
      const hits = collectRootResolverHits([dir]);
      expect(hits.length).toBe(1);
      expect(new RegExp(RESOLVE_REPO_ROOT).test(hits[0].label)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：无旧根语汇 → 零命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-root-ok-"));
    writeFileSync(path.join(dir, "z.mjs"), "const root = gitToplevel(cwd);\n", "utf8");
    try {
      expect(collectRootResolverHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：⑥ 测试零旁路缝（filteredEnv / baseEnv / __*ForTest）", () => {
  it("三类补丁模式 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-seam-"));
    writeFileSync(
      path.join(dir, "x.test.mjs"),
      "const filteredEnv = { ...process.env }; const baseEnv = {}; const reg = __registryForTest();\n",
      "utf8",
    );
    try {
      const hits = collectTestSeamHits([dir]);
      expect(hits.length).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("lib 侧 __*ForTest 缝也入扫 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-seam-lib-"));
    writeFileSync(path.join(dir, "proc.mjs"), "export const __resetForTest = () => (registry = []);\n", "utf8");
    try {
      const hits = collectTestSeamHits([dir]);
      expect(hits.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：合法 env 使用 → 零命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-seam-ok-"));
    writeFileSync(path.join(dir, "x.test.mjs"), "const hostEnv = { ...process.env };\n", "utf8");
    try {
      expect(collectTestSeamHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：⑦ 零手写 handoff 形状 / 零 res.timedOut 单点依赖", () => {
  it("templates.ts 手写 schema 字段清单（switch 形）→ 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-shape-"));
    writeFileSync(path.join(dir, "templates.ts"), "switch (key) { case \"task\": return `task: <n>`; }\n", "utf8");
    try {
      const hits = collectHandoffShapeHits([path.join(dir, "templates.ts")]);
      expect(hits.length).toBe(1);
      expect(hits[0].label).toMatch(/hand-written schema field inventory/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("finalize 写侧内联手写对象字面量 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-shape-2-"));
    const f = path.join(dir, "finalize.ts");
    writeFileSync(f, "writeOwnHandoff(p, { status: \"BLOCKED\", findings: [] });\n", "utf8");
    try {
      const hits = collectHandoffShapeHits([f]);
      expect(hits.length).toBe(2); // 内联手写字面量 + 缺 normalizeHandoff 双命中
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("res.timedOut 作 if 判定条件 → 命中（超时判定非自持）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-timedout-"));
    writeFileSync(path.join(dir, "x.mjs"), "if (res.timedOut) { timeoutCount = timeoutCount + 1; }\n", "utf8");
    try {
      const hits = collectTimedOutSoleHits([dir]);
      expect(hits.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：⑧ 运行期 context 零落盘", () => {
  it("写 context 到任意路径 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-ctx-"));
    writeFileSync(path.join(dir, "x.mjs"), "writeFileSync(path.join(root, \"context.json\"), JSON.stringify(ctx));\n", "utf8");
    try {
      const hits = collectContextWriteHits([dir]);
      expect(hits.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：写 registry / progress.json → 零命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-ctx-ok-"));
    writeFileSync(path.join(dir, "x.mjs"), "writeFileSync(ledgerPath, JSON.stringify(registry));\n", "utf8");
    try {
      expect(collectContextWriteHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：⑨ citty 声明 Options ⊆ canonical argv（单元）", () => {
  it("Options 面 = 声明 args 键（kebab → --flag）+ citty 内建 --help", () => {
    expect(helpOptionFlags({ type: { type: "string" }, spec: { type: "path" } }))
      .toEqual(["--type", "--spec", "--help"]);
    expect(helpOptionFlags({ "dry-run": { type: "boolean" } })).toEqual(["--dry-run", "--help"]);
    expect(helpOptionFlags(undefined)).toEqual(["--help"]);
  });
  it("canonical argv 之外的 flag → 集合差出现在谓词结果", () => {
    expect(helpFlagsNotInCanonical(["--plan", "--help", "--ghost"])).toEqual(["--ghost"]);
    expect(helpFlagsNotInCanonical(["--plan"])).toEqual([]);
  });
});

describe("channel audit：⑩ src/infra/context.ts 零 canonical 事实名硬编码", () => {
  it("硬编码 flag/env 事实名 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-ctxmod-"));
    const f = path.join(dir, "context.mjs");
    writeFileSync(f, "export const PLAN_FLAG = \"--dry-run\"; // CDD_TASK_TIMEOUT 手动副本\n", "utf8");
    try {
      const hits = collectContextModuleHardcodeHits(f);
      expect(hits.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：零事实名字面 → 零命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-ctxmod-ok-"));
    const f = path.join(dir, "context.mjs");
    writeFileSync(f, "export function loadContract() { return CONTRACT; }\n", "utf8");
    try {
      expect(collectContextModuleHardcodeHits(f)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：单字符短别名不作裸子串 —— -h1 / -handler 注释不误红（review-1 nit 补测）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-ctxmod-alias-"));
    const f = path.join(dir, "context.mjs");
    writeFileSync(f, "// per -h1 handoff note: use -handler-style naming\n", "utf8");
    try {
      expect(collectContextModuleHardcodeHits(f)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("channel audit：⑪ 零「最近一次」残留回读", () => {
  it("mtime / latest 复合扫描 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-latest-"));
    writeFileSync(path.join(dir, "x.mjs"), "const p = pickByMtime(dir) ?? findLatestHandoff(dir);\n", "utf8");
    try {
      const hits = collectResidualRereadHits([dir]);
      expect(hits.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：散文 latest review handoff 不命中（非扫描语汇）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-latest-ok-"));
    writeFileSync(path.join(dir, "x.mjs"), "// Read the status of the latest review handoff (round).\n", "utf8");
    try {
      expect(collectResidualRereadHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("T14 白名单：liveness 探针页 proc.ts 零残留命中 + 探针语汇仍在（白名单不空置）", () => {
    // spec E3 的 stall 探针是 brief 强制的活体采样，⑪ 白名单按文件级枚举到 infra/proc.ts ——
    // 扫真实仓储路径断言白名单有效（同 golden 测试证明的「探针外 mtime 照旧命中」互补）。
    const here = path.dirname(fileURLToPath(import.meta.url));
    const procAbs = path.join(here, "..", "..", "..", "packages", "cdd-engine", "src", "infra", "proc.ts");
    expect(collectResidualRereadHits(["packages/cdd-engine/src/infra/proc.ts"])).toEqual([]);
    const proc = readFileSync(procAbs, "utf8");
    expect(proc).toMatch(/export function latestFileMtimeMs/);   // 探针仍在地 → 白名单不放空
    expect(proc).toMatch(/mtimeAdvanced/);
  });
});

describe("channel audit：⑫ counters 行契约（canonical 派生 + 零手写 + 不进 handoff 契约）", () => {
  it("counters 构造点手写计数器字面量 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-cnt-"));
    const f = path.join(dir, "progress.ts");
    writeFileSync(f, 'const parts = ["timeoutCount=" + n];\n', "utf8");
    try {
      const hits = collectCountersContractHits({ constructFiles: [f] });
      expect(hits.length).toBe(1);
      expect(hits[0].label).toMatch(/timeoutCount/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("类目以字符串字面量身份出现（failure_category 赋值）→ 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-cat-"));
    writeFileSync(path.join(dir, "run-task.ts"), "failure_category: \"TIMEOUT\",\n", "utf8");
    try {
      const hits = collectCountersContractHits({ engineScope: [dir] });
      expect(hits.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("counter 泄漏进 handoff schema properties → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-schema-"));
    const f = path.join(dir, "task-handoff-schema.json");
    writeFileSync(f, '{ "properties": { "timeoutCount": { "type": "integer" }, "status": {} } }\n', "utf8");
    try {
      const hits = collectCountersContractHits({ taskSchema: f });
      expect(hits.some((h) => h.label.match(/leaked/))).toBe(true); // 泄漏 + 计数 14 双重命中，按泄漏面断言
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("properties 计数漂移 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "audit-schema-2-"));
    const f = path.join(dir, "docs-handoff-schema.json");
    // properties 8 键（缺 failure_category）≠ 9
    writeFileSync(f, '{ "properties": { "phase": {}, "status": {}, "doc_path": {}, "doc_hash": {}, "findings": {}, "artifacts": {}, "round": {}, "blocker": {} } }\n', "utf8");
    try {
      const hits = collectCountersContractHits({ docsSchema: f });
      expect(hits.length).toBe(1);
      expect(hits[0].label).toMatch(/count|≠/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("live repo：Task 8 channel audit（§2.8 行 1–11、13）零残留", () => {
  it("collectChannelAuditHits() === []（12 条 engine 侧守卫全绿）", () => {
    expect(collectChannelAuditHits()).toEqual([]);
  });
});

// ---- Task 10: init 删除 + 版本戳机制删除 反向守卫（design §2.6.2 / §2.8 行 19-20）----
// ① shipped 非 emit 面（skills/** · 插件 README）零版本字面量（osuperpowers-version 戳——
// 版本真相收敛到 package.json + emit 产物后，戳写方/读方均已连根删除）；② shipped 面
//（根 README · 插件 README）+ 协作者面（.changeset/README.md）零 `/init` 引用（marketplace
// 安装指引已内联进 README 安装节）。scripts/ 不在两个 scope 内，本文件直接写字面无自噬风险。
describe("shipped guards：版本字面量 + /init 引用（T10）", () => {
  it("osuperpowers-version 戳命中（shipped 非 emit 面）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t10-ver-"));
    const f = path.join(dir, "SKILL.md");
    writeFileSync(f, "<!-- osuperpowers-version: 0.1.1 -->\n", "utf8");
    try {
      const hits = collectVersionStampHits([dir]);
      expect(hits.length).toBe(1);
      expect(hits[0].file.endsWith("SKILL.md")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("散文「osuperpowers version」不误报（非戳字面；无连字符）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t10-ver-ok-"));
    writeFileSync(path.join(dir, "README.md"), "osuperpowers version is synced across manifests\n", "utf8");
    try {
      expect(collectVersionStampHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("`/init` 引用命中（shipped + 协作者面）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t10-init-"));
    writeFileSync(path.join(dir, "README.md"), "2. Run **`/init`** in each project\n", "utf8");
    try {
      const hits = collectInitReferenceHits([dir]);
      expect(hits.length).toBe(1);
      expect(hits[0].file.endsWith("README.md")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("路径形 skills/init/SKILL.md 内含 /init 也命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t10-init-2-"));
    writeFileSync(path.join(dir, "note.md"), "stamp in packages/osuperpowers/skills/init/SKILL.md\n", "utf8");
    try {
      expect(collectInitReferenceHits([dir])).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("裸词 init / initialize 不误报（无斜杠前缀）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t10-init-ok-"));
    writeFileSync(path.join(dir, "note.md"), "the init skill initialized the project\n", "utf8");
    try {
      expect(collectInitReferenceHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("SHIPPED_SURFACE_TARGETS / INIT_REFERENCE_TARGETS 覆盖既定 scope（scope 缩小即失败）", () => {
    for (const p of ["packages/osuperpowers/skills", "packages/osuperpowers/README.md"]) {
      expect(SHIPPED_SURFACE_TARGETS).toContain(p);
    }
    for (const p of ["README.md", "packages/osuperpowers/README.md", ".changeset/README.md"]) {
      expect(INIT_REFERENCE_TARGETS).toContain(p);
    }
  });
  it("live repo：shipped 非 emit 面零版本字面量 + shipped/协作者面零 /init", () => {
    expect(collectShippedGuardHits()).toEqual([]);
  });
});

// ---- Task 11: handoff-schema.md 删除 反向守卫（design §2.8 行 14）----
// `(?<!-)handoff-schema` 零命中条目：裸名形（`// 对齐 handoff-schema…表` cite）与路径形
//（`docs/handoff-schema.md` / `skills/cli-driven-development/docs/handoff-schema.md`）一律命中；
// canonical schema 文件名（`task-handoff-schema.json` / `docs-handoff-schema.json`）的
// `handoff-schema` 均前接 `-` → 负向后顾豁免。scope 覆盖测试钉死 {bin,lib,tests} + osuperpowers
// 全目录（含 .agents/ emit 副本面 —— 副本由 emit prune，删除动作与守卫同 commit）。
// 行 21 的 task-review 守卫归 T15 Step 4b，本组不写其单测（写入会在本任务内不可转绿）。
// scripts/ 不在 line-14 scope 内，本文件直接写字面无自噬风险。
describe("handoff-schema（§2.8 行 14）：正例命中 + canonical 豁免 + scope 钉死", () => {
  it("裸名形 handoff-schema → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t11-bare-"));
    writeFileSync(path.join(dir, "note.md"), "// 对齐 handoff-schema「Severity → status mapping」表\n", "utf8");
    try {
      const hits = collectHandoffSchemaHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/handoff-schema/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("路径形 docs/handoff-schema.md 与 skills/…/handoff-schema.md → 各命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t11-path-"));
    writeFileSync(
      path.join(dir, "w.mjs"),
      "// 按 skills/cli-driven-development/docs/handoff-schema.md（命名/workspace 见 handoff-namespace.json）写入\n",
      "utf8",
    );
    writeFileSync(path.join(dir, "t.mjs"), "// docs/handoff-schema.md 是 agent 据实声明的字段\n", "utf8");
    try {
      const hits = collectHandoffSchemaHits([dir]);
      expect(hits).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：canonical schema 文件（cdd/docs-handoff-schema.json）不命中（负向后顾豁免）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t11-canon-"));
    writeFileSync(
      path.join(dir, "ok.mjs"),
      "// schema → packages/cdd-engine/templates/schema/task-handoff-schema.json + docs-handoff-schema.json\n",
      "utf8",
    );
    try {
      expect(collectHandoffSchemaHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("HANDOFF_SCHEMA_TARGETS 覆盖既定 scope（scope 缩小即失败）", () => {
    for (const p of [
      "packages/cdd-engine/src",
      "packages/osuperpowers",
    ]) {
      expect(HANDOFF_SCHEMA_TARGETS).toContain(p);
    }
    // P6 Task 3：tests/ 已退役，src 面 walk 默认 __tests__ 自豁免 —— 不再单列根路径
    expect(HANDOFF_SCHEMA_TARGETS).not.toContain("packages/cdd-engine/tests");
  });
  it("live repo：collectHandoffSchemaHits() === []（handoff-schema.md 已删 + 引用改指 engine canonical）", () => {
    expect(collectHandoffSchemaHits()).toEqual([]);
  });
});

// ---- Task 16: skills 面守卫（design §2.8 行 12/15/16/17/18；AC5/AC11/AC14 的 skills 侧落点）----
// 五条守卫并入 collectSkillSurfaceHits()（与 T8 的 collectChannelAuditHits() 同构）。守卫 scope 全部
// 落在 packages/osuperpowers/skills/ 内，scripts/ 不在任一 scope——本文件直接写字面无自噬风险（T11 先例）。
// 各行权威文本：行 17 零上游文档 read + 上游引用 /plugin:skill 斜杠形 · 行 15 零 CDD_*/progress.json/
// handoff 文件名（AC5 七个编排型 skill 逐名枚举，report-issues 按 AC5 显式例外排除）· 行 16 零 fix-inline
// + 评审循环 fix 节点须含 cdd fix 命令形 · 行 12 类目名 ⊆ canonical ∪ 状态枚举白名单 + 类目语义零复述
//· 行 18 零 _docs/ 引用（含 rule-review-convergence 锚点形与裸提及）。
describe("skills 面守卫（T16）：行 17 零上游文档 read + 上游引用一律 /plugin:skill 斜杠形", () => {
  it("vendors/ 路径 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-vendors-"));
    writeFileSync(path.join(dir, "a.md"), "**Read**: `vendors/mattpocock-skills/skills/productivity/grilling/SKILL.md`\n", "utf8");
    try {
      const hits = collectUpstreamReadHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/upstream-document read/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("上游 SKILL.md 路径（superpowers/…SKILL.md）→ 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-upstream-"));
    writeFileSync(path.join(dir, "b.md"), "- **Do**: Read `superpowers/skills/brainstorming/SKILL.md` to load the framework\n", "utf8");
    try {
      expect(collectUpstreamReadHits([dir])).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("Read-Upstream / read upstream 措辞 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-rup-"));
    writeFileSync(path.join(dir, "c.md"), "Read-Upstream missing → BLOCKED\n", "utf8");
    try {
      expect(collectUpstreamReadHits([dir])).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("上游引用非斜杠形（superpowers:brainstorming 前无 /）→ 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-noslash-"));
    writeFileSync(path.join(dir, "e.md"), "Delegates to a superpowers:brainstorming session.\n", "utf8");
    try {
      const hits = collectUpstreamSlashFormHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].file).toContain("e.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：slash 形 Run a /<plugin>:<skill> session 与同插件 osuperpowers:… 引用均不命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-ok-"));
    writeFileSync(path.join(dir, "d.md"), "- **Do**: Run a /superpowers:brainstorming session — the harness loads the upstream skill and runs its flow.\n", "utf8");
    writeFileSync(path.join(dir, "f.md"), "hands off to osuperpowers:writing-plans\n", "utf8");
    try {
      expect(collectUpstreamReadHits([dir])).toEqual([]);
      expect(collectUpstreamSlashFormHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("skills 面守卫（T16）：行 15 零引擎内部结构依赖（AC5 七个编排型 skill 逐名枚举）", () => {
  it("ORCHESTRATOR_SKILLS = AC5 全枚举（7 个，含 finishing；不含 report-issues），不用 skills/** 通配", () => {
    const names = ORCHESTRATOR_SKILLS.map((p) => p.split("/").slice(-2).join("/"));
    expect(names).toEqual([
      "brainstorming/SKILL.md",
      "writing-single-spec/SKILL.md",
      "writing-overall-spec/SKILL.md",
      "writing-phase-spec/SKILL.md",
      "writing-plans/SKILL.md",
      "cli-driven-development/SKILL.md",
      "finishing/SKILL.md",
    ]);
  });
  it("CDD_* 名 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-cdd-"));
    const file = path.join(dir, "writing-plans", "SKILL.md");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "**Read**: `CDD_HANDOFF_PATH`\n", "utf8");
    try {
      const hits = collectInternalDependencyHits([file]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/CDD_\*|internal-structure|CDD_HANDOFF_PATH/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("progress.json → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-prog-"));
    const file = path.join(dir, "writing-plans", "SKILL.md");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "- **Read**: `progress.json#plan`;\n", "utf8");
    try {
      expect(collectInternalDependencyHits([file])).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("handoff 文件名模式（task-N-implement.json）→ 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-handoff-"));
    const file = path.join(dir, "writing-plans", "SKILL.md");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "读 `task-3-implement.json` 与 `task-2-review-1.json`\n", "utf8");
    try {
      const hits = collectInternalDependencyHits([file]);
      expect(hits.length).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：合法的输出契约语汇（every task goes through implement → review → fix）不命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-int-ok-"));
    const file = path.join(dir, "cli-driven-development", "SKILL.md");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "Every task goes through implement → review → (fix if blockers); routes by `status` + `findings[]` from the output contract.\n", "utf8");
    try {
      expect(collectInternalDependencyHits([file])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("skills 面守卫（T16）：行 16 零 fix-inline + 评审循环 fix 节点须含 cdd fix 命令形", () => {
  const SKILL_MD = (graphLines, sections) =>
    `# X\n\n## Flow Digraph\n\n\`\`\`mermaid\nflowchart TD\n${graphLines}\n\`\`\`\n\n${sections}\n`;
  it("fix-inline → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-inline-"));
    writeFileSync(path.join(dir, "s.md"), "fix-inline 修复禁止（§2.7.3）\n", "utf8");
    try {
      expect(collectFixInlineHits([dir])).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("评审循环 fix 节点节缺 cdd fix → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-fixnode-"));
    writeFileSync(path.join(dir, "SKILL.md"), SKILL_MD("  A[fix-spec] --> B((done))", "### `fix-spec`\n\n- **Do**: Fix all findings via the editor.\n"), "utf8");
    try {
      const hits = collectReviewLoopFixCddHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/fix-spec/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("前一 fix 节点缺 cdd fix、后一 fix 节点含 → 前一节点必须命中（节断界 ### 级即停，review-1 nit 回归）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-fixnode-boundary-"));
    writeFileSync(
      path.join(dir, "SKILL.md"),
      SKILL_MD(
        "  A[fix-spec] --> B[fix-task]\n  B --> C((done))",
        "### `fix-spec`\n\n- **Do**: Fix all findings via the editor.\n\n### `fix-task`\n\n- **Do**: Fix ALL findings via `cdd fix --type task --task <id>`.\n",
      ),
      "utf8",
    );
    try {
      const hits = collectReviewLoopFixCddHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/fix-spec/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("评审循环 fix 节点节含 cdd fix → 零命中（反射例）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-fixnode-ok-"));
    writeFileSync(path.join(dir, "SKILL.md"), SKILL_MD("  A[fix-spec] --> B((done))", "### `fix-spec`\n\n- **Do**: Fix ALL findings via `cdd fix --type spec --spec <path>`.\n"), "utf8");
    try {
      expect(collectReviewLoopFixCddHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("非 fix 节点不参与正面检查（零命中）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-nofix-"));
    writeFileSync(path.join(dir, "SKILL.md"), SKILL_MD("  A[run-review] --> B((done))", "### `run-review`\n\n- **Do**: Dispatch `cdd review`.\n"), "utf8");
    try {
      expect(collectReviewLoopFixCddHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("skills 面守卫（T16）：行 12 失败类目名 ⊆ canonical ∪ 状态枚举白名单 + 类目语义零复述", () => {
  const FM = (rows) => `# X\n\n## Failure Modes\n\n| category | handling |\n|---|---|\n${rows}\n\n## Elsewhere\n`;
  it("canonical 六类首列 → 零违规", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-fm-"));
    const f = path.join(dir, "SKILL.md");
    writeFileSync(
      f,
      FM([
        "| TIMEOUT | routed from output contract |",
        "| CONTRACT_VIOLATION | blocker |",
        "| ENGINE_SELF_WRITTEN | blocker |",
        "| EXECUTION_FAILURE | blocker |",
        "| UNVERIFIABLE | blocker |",
        "| PLAN_CONFLICT | surface to user |",
      ].join("\n")),
      "utf8",
    );
    try {
      expect(collectFailureModeCategoryHits(f)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("handoff 状态枚举白名单值（APPROVED 等）放行", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-fm-ok-"));
    const f = path.join(dir, "SKILL.md");
    writeFileSync(f, FM("| APPROVED | 终态 |"), "utf8");
    try {
      expect(collectFailureModeCategoryHits(f)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("canonical 外类目名 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-fm-bad-"));
    const f = path.join(dir, "SKILL.md");
    writeFileSync(f, FM("| TIMEOUTS | 拼写漂移 |"), "utf8");
    try {
      const hits = collectFailureModeCategoryHits(f);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/TIMEOUTS/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("类目语义复述（engineRecoveryCount / countsTowardConvergence / dispatch-timeout-cap / 计入 Convergence）→ 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-sem-"));
    writeFileSync(path.join(dir, "a.md"), "engineRecoveryCount 上限与终止态\n", "utf8");
    writeFileSync(path.join(dir, "b.md"), "countsTowardConvergence=false 属语义复述\n", "utf8");
    writeFileSync(path.join(dir, "c.md"), "BLOCKED: dispatch-timeout-cap\n", "utf8");
    writeFileSync(path.join(dir, "d.md"), "该失败不计入 Convergence\n", "utf8");
    try {
      const hits = collectFailureModeSemanticsHits([dir]);
      expect(hits.length).toBeGreaterThanOrEqual(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：只引用类目名（TIMEOUT 裸名）不命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-sem-ok-"));
    writeFileSync(path.join(dir, "a.md"), "| TIMEOUT | blocker from output contract |\n", "utf8");
    try {
      expect(collectFailureModeSemanticsHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("skills 面守卫（T16）：行 18 零 _docs/ 引用（含 rule-review-convergence 锚点形/裸提及）", () => {
  it("_docs/ 路径形 → 命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-docs-"));
    writeFileSync(path.join(dir, "a.md"), "见 _docs/review.md 的 Review Convergence\n", "utf8");
    try {
      const hits = collectDocsRefHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toMatch(/_docs/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("rule-review-convergence 锚点形与裸提及 → 各命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-rule-"));
    writeFileSync(path.join(dir, "a.md"), "#rule-review-convergence\n", "utf8");
    writeFileSync(path.join(dir, "b.md"), "rule-review-convergence 裸提及\n", "utf8");
    try {
      expect(collectDocsRefHits([dir])).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("反射例：无 _docs 语汇零命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skf-docs-ok-"));
    writeFileSync(path.join(dir, "a.md"), "Review Convergence 入 Invariants\n", "utf8");
    try {
      expect(collectDocsRefHits([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- Task 16（P5）：report-issues 旧模型残留守卫 ----
// 旧模型语汇（resolve-destination / ensure-session / append-comment / --mode /
// renderComment / renderTitle / resolveDropdownOptions / sessionTypes）已清零（rewrite 收口轮），
// 此处为常驻防回归。`report-issue` 必须词边界（\b）——复数 `report-issues` skill 名合法（裸
// substring 会误报复数）。`--mode` 取词形（负向后顾/前瞻豁免内部 `mode:` 属性与 --modeYaml 一类
// 衍生 token）。`execFileSync("git")` 防手写 git 回渗（engine 唯一 spawn 通道 = proc.mjs 的
// execa）。scope = ALL_MECH_POSITIONS（机制面零豁免）；scripts/ 不在 scope，本文件直接写字面
// 无自噬风险（T15 先例）。
describe("stale-lexicon：report-issues 旧模型语汇守卫（Task 16·P5）", () => {
  it("裸 report-issue（词边界）命中；复数 report-issues skill 名放行", () => {
    expect(hasHit(["report-issue 旧流程名"])).toBe(true);
    expect(hasHit(["`report-issue` 节点"])).toBe(true);
    expect(hasHit(["osuperpowers:report-issues skill 名"])).toBe(false);
    expect(hasHit(["packages/osuperpowers/skills/report-issues/SKILL.md"])).toBe(false);
  });
  it("--mode 词形命中（旧 flag）；内部 mode 属性 / --modeYaml 衍生形放行", () => {
    expect(hasHit(["cdd-task --mode implement"])).toBe(true);
    expect(hasHit(["render --mode 报告 body"])).toBe(true);
    expect(hasHit(['runTask(harness, n, { mode: "implement" })'])).toBe(false);
    expect(hasHit(["report-templates --modeYaml"])).toBe(false);
  });
  it("旧 renderer/session 语汇命中：renderComment / renderTitle / resolveDropdownOptions / sessionTypes", () => {
    expect(hasHit(["renderComment(body, findings)"])).toBe(true);
    expect(hasHit(["renderTitle generated"])).toBe(true);
    expect(hasHit(["resolveDropdownOptions(id)"])).toBe(true);
    expect(hasHit(["sessionTypes 分类"])).toBe(true);
  });
  it('execFileSync("git") 命中（引号双形）；execa/其他命令放行', () => {
    expect(hasHit(['execFileSync("git", ["rev-parse", "--show-toplevel"])'])).toBe(true);
    expect(hasHit(["execFileSync('git', ['log'])"])).toBe(true);
    expect(hasHit(['execa("git", ["log"])'])).toBe(false);
    expect(hasHit(['execFileSync("node", ["x"])'])).toBe(false);
  });
  it("含旧 renderer 语汇的临时文件被 collectStaleLexiconHits 命中；复数/内部属性/execa 放行", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-t16-"));
    writeFileSync(path.join(dir, "a.mjs"), "render --mode implement\nrenderComment gone\n", "utf8");
    writeFileSync(path.join(dir, "b.mjs"), "osuperpowers:report-issues\nmode: \"implement\"\nexeca(\"git\", x)\n", "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      expect(hits).toHaveLength(2); // --mode + renderComment（a.mjs）；b.mjs 全放行
      expect(hits[0].file).toContain("a.mjs");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("live repo：T16 skills 面守卫 5 条零残留", () => {
  it("collectSkillSurfaceHits() === []（§2.8 行 12/15/16/17/18 全绿）", () => {
    expect(collectSkillSurfaceHits()).toEqual([]);
  });
});

// ---- Task 3（P6）：.mjs 终态 + vitest 内存守卫双 config + walk 自豁免（spec 域 C，M5/M6）----
// M5（brief ⑤）：src 恒真 0 `.mjs`（48 测试节点 + helpers + fixtures 全转 `.ts`）+ tests/ 退役 0。
// M6（brief ⑥）：engine root + 仓库根 双 vitest.config.mjs 固化 maxWorkers=1/fileParallelism=false/
// maxConcurrency=2（2026-09-17 CPU 级 fork 池 OOM 后收敛）。self-exempt doctrine：walkTargetFiles
// 默认跳过 `**/__tests__/`（迁就近后测试位并入 src 树），机制扫描不得采信测试位断言（其必携被守
// 语汇）；需扫测试位的守卫（seam 缝 / 旧根解析名）经 `{ includeTests: true }` 显式打开。
describe("P6 Task 3 M5：.mjs 终态（src 0 .mjs + tests/ 0）", () => {
  it("live repo：collectMjsTerminalStateViolations() === []", () => {
    expect(collectMjsTerminalStateViolations()).toEqual([]);
  });
  it("临时仓库：src .mjs 复现 → 命中（.mjs 平面守护）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-m5-"));
    try {
      // 注入假 src 布局：sub/src/{bin.mjs,__tests__/node.mjs} + sub/tests/old.mjs —— 均须命中
      mkdirSync(path.join(dir, "sub", "src", "__tests__"), { recursive: true });
      mkdirSync(path.join(dir, "sub", "tests"), { recursive: true });
      writeFileSync(path.join(dir, "sub", "src", "bin.mjs"), "console.log(1)\n", "utf8");
      writeFileSync(path.join(dir, "sub", "src", "__tests__", "node.mjs"), "import x from '../bin.mjs'\n", "utf8");
      writeFileSync(path.join(dir, "sub", "tests", "old.mjs"), "// retired tests/ dir\n", "utf8");
      const hits = collectMjsTerminalStateViolations(path.join(dir, "sub", "src"));
      expect(hits.map((h) => h.file).sort()).toEqual(["__tests__/node.mjs", "bin.mjs", "tests"].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("P6 Task 3 M6：vitest 双 config 内存守卫", () => {
  it("live repo：collectMemoryGuardViolations() === []（engine + root 双处同值）", () => {
    expect(collectMemoryGuardViolations()).toEqual([]);
  });
});

describe("P6 Task 3：walkTargetFiles `__tests__` 自豁免 doctrine", () => {
  it("默认跳过 __tests__；{ includeTests: true } 打开后可命中", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-walk-"));
    try {
      mkdirSync(path.join(dir, "m", "__tests__"), { recursive: true });
      writeFileSync(path.join(dir, "mech.ts"), "// pkg/foo 字面\n", "utf8");
      writeFileSync(path.join(dir, "m", "mech2.ts"), "pkg/foo\n", "utf8");
      writeFileSync(path.join(dir, "m", "__tests__", "t.test.ts"), "pkg/foo 测试断言必须引用\n", "utf8");
      const re = /pkg\/foo/;
      const defaultHits = scanTargets([dir], re);
      const withTests = scanTargets([dir], re, { includeTests: true });
      // scanTargets 文件名为 ROOT 相对（tmpdir 前缀不定）——按相对末端断言
      expect(defaultHits.map((f) => f.replace(/^.*?residue-walk.*?\//, "")).sort())
        .toEqual(["m/mech2.ts", "mech.ts"].sort());
      expect(withTests.map((f) => f.replace(/^.*?residue-walk.*?\//, "")).sort())
        .toEqual(["m/__tests__/t.test.ts", "m/mech2.ts", "mech.ts"].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("seam 缝守卫（filteredEnv/baseEnv/__*ForTest）经 includeTests 扫测试位——live repo 零命中", () => {
    expect(collectTestSeamHits()).toEqual([]);
  });
});

// ---- Src-comment anchor-first ban — semantic body first (Task 31, P6 / spec T7.10) ----
// collectCommentAnchorHits scans packages/cdd-engine/src/** including __tests__ (the §35 rule
// makes no test carve-out). One unit = a /* */ block or a run of adjacent `//` lines; a unit is
// a hit when its first valid token is a phase anchor (P\d+ / T\d+(.\d+)? / Task \d+ /
// spec T\d+(.\d+)?). The file-header carve-out applies only when the header's first unit's first
// token is not an anchor (path/module-led) — an anchor-led header comment stays a violation.
// Tests inject a mkdtemp via targetsOverride.
describe("src 注释锚首禁（Task 31 / spec T7.10）", () => {
  function anchorHits(content: string): number {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-ca-"));
    try {
      writeFileSync(path.join(dir, "sample.ts"), content, "utf8");
      return collectCommentAnchorHits([dir]).length;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  it("锚首单位命中（首有效 token = 相位锚）", () => {
    expect(anchorHits("// T7.10: prose\n")).toBe(1);
    expect(anchorHits("// P6 T24 B: prose\n")).toBe(1);
    expect(anchorHits("// Task 29 (spec T7.8) prose\n")).toBe(1);
    expect(anchorHits("/** T27 (spec T7.6): prose */\n")).toBe(1);
    expect(anchorHits("// spec T7.8 prose\n")).toBe(1);
  });
  it("合法尾锚形式放行（锚仅在句尾 traceability）", () => {
    expect(anchorHits("// prose (T7.10)\n")).toBe(0);
    expect(anchorHits("// prose — T26\n")).toBe(0);
    expect(anchorHits("// (prose) (T26)\n")).toBe(0);
    expect(anchorHits("const x = 1;\n// prose trailing (Task 20 ⑦)\n")).toBe(0);
  });
  it("代码后的注释走 body 扫描；非锚编号语汇（F11/D14/E27）零误报", () => {
    expect(anchorHits("const x = 1;\n// T7.10: prose\n")).toBe(1);
    expect(anchorHits("const x = 1;\n// F11: self-provisioned brief\n")).toBe(0);
    expect(anchorHits("const x = 1;\n// D14: engine-written fields\n")).toBe(0);
    expect(anchorHits("const x = 1;\n// E27: source-less fallback\n")).toBe(0);
  });
  it("文件头豁免仅用于路径/模块开头头注（行内尾锚合法）", () => {
    expect(anchorHits(
      "// packages/cdd-engine/src/dispatch/x.ts — CDD dispatch plumbing (Task 20 ⑦)\n" +
      "// heritage port of run.mjs\n" +
      "import path from \"node:path\";\n",
    )).toBe(0);
  });
  it("锚首头注不放行（豁免以头注首 token 非锚为前提）", () => {
    expect(anchorHits("// T26: header prose\nimport x from \"y\";\n")).toBe(1);
  });
  it("块粒度：相邻 `//` 行组整体一计数（paren 续行不误报）", () => {
    // Counter-example (the finalize.ts:387 lesson): a continuation line opening with an open
    // paren continues the previous line's semantics — the group's first token is the decision
    // point.
    expect(anchorHits(
      "// No agentHandoff authority is implied\n" +
      "// (T6 logic moved in) completes the open paren\n",
    )).toBe(0);
    expect(anchorHits(
      "// T6 logic moved in\n" +
      "// No agentHandoff authority\n",
    )).toBe(1);
  });
  it("${} 内插值串内的 {/} 不动插值深度（防注释误吞）", () => {
    // A { inside an interpolated string must not over-extend the ${} walk past the template
    // close — a later // comment would otherwise be swallowed (false negative).
    expect(anchorHits("const x = `a${ \"{\" }b`; // T7.10: prose\n")).toBe(1);
    expect(anchorHits("const x = `a${ \"}\" }b`; // T7.10: prose\n")).toBe(1);
  });
  it("includeTests 入扫测试位（§35 无测试豁免）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-ca-t-"));
    try {
      mkdirSync(path.join(dir, "__tests__"), { recursive: true });
      writeFileSync(path.join(dir, "__tests__", "x.test.ts"), "// T7.10: prose\n", "utf8");
      expect(collectCommentAnchorHits([dir])).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("live repo：collectCommentAnchorHits() === []（engine src 零锚首）", () => {
    expect(collectCommentAnchorHits()).toEqual([]);
  });
});
