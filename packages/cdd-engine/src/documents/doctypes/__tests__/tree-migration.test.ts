// packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts — the single-form
// tree suite's TERMINAL state (doc-architecture-v2-p3 T8): the migration queue is closed and the
// whole docs/kairos tree walks green with zero exclusions. The legacy dual-read runtime is retired,
// so every tree document validates on its own single-form surface — carrying a legacy face
// (`- **Do**:` task block / Form B anchor / `## Task Groups` section / spec `## Section 1`) BLOCKS
// (decommissioned surface, never ignored).
//   - The walk set = 50 files: 23 plan + 22 design + 4 overall + 1 one-off. Of these, 49 are the
//     validation files (23 + 22 + 4 — plans/ includes this program's own p3 + p3.1 plans). The
//     one-off (specs/2026-09-28-cdd-review-contract-fix.md — a historical single-spec with no
//     parent overall / canonical schema, the engine no longer recognises it) is detached from the
//     green/red assertions: walked, detect-only, never counted, never migrated.
//   - All 49 validation files are canonical — the queue holds zero pending-migration documents.
//     Every plan (23) and design (22) validates clean on its OWN validate surface (zero owned
//     failures) and its validate chain carries EXACTLY its resolved parent's own output (the
//     one-off spec's documented 4 failures ride the cdd-review-contract-fix plan's chain — one-off
//     tolerance, never a plan-owned failure; the frozen legacy overalls' backfill-claim residue rides
//     their child designs' chains — recorded below, never a transcription-introduced failure).
//   - The rule plane (P3.1 T2 step 4): the walk judgs every validation file's STRUCTURE through
//     structureFindings(kind, content) — the tree's structural judgments are the body rule sets,
//     never a self-written walk; content-fidelity pins and the migration-queue closure assertions
//     stay as direct reads/pins.
//   - The 4 overalls walk with zero exclusion: pi-harness + doc-architecture-v2 validate clean;
//     the two frozen legacy overalls (osuperpowers-overhaul · consumer-parity) carry exactly their
//     documented pre-existing backfill-claim residue (7 / 14 — the closeout-accounting axis, not a
//     single-form violation; the frozen programs' change history is history — pinned as the walk's
//     recorded terminal boundary, never excluded, never rewritten).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DocumentsValidator, UnknownDocKindError } from "../../../rules/documents.ts";
import { docTypeRegistry } from "../../registry.ts";
import { phaseSpecBody } from "../body/phase-spec-body.ts";
import type { PlanDocType } from "../plan.ts";
import {
  isPlaceholderOrTemplateTarget,
  linksOnLine,
  resolveAny,
  resolveParentOverall,
} from "../shared.ts";

const HERE = import.meta.dirname; // …/documents/doctypes/__tests__
// The repo root — 6 levels up from src/documents/doctypes/__tests__ (the real docs tree the
// migration queue walks).
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..", "..");
const SPECS_DIR = path.join(REPO_ROOT, "docs", "kairos", "specs");
const PLANS_DIR = path.join(REPO_ROOT, "docs", "kairos", "plans");

/** A tree document's migration state — canonical (zero migration objects, the single grammar,
 *  validate clean on its own surface) or pending (the legacy face, validate BLOCK until its
 *  family migrates). */
type MigrationState = "canonical" | "pending";

const PLAN_MIGRATION: Readonly<Record<string, MigrationState>> = {
  "2026-09-13-osuperpowers-overhaul-p1.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p2.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p3.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p4.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p5.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p6.md": "canonical",
  "2026-09-21-consumer-parity-p1.md": "canonical",
  "2026-09-21-consumer-parity-p2.md": "canonical",
  "2026-09-21-consumer-parity-p3.md": "canonical",
  "2026-09-21-consumer-parity-p4.1.md": "canonical",
  "2026-09-21-consumer-parity-p4.2.md": "canonical",
  "2026-09-21-consumer-parity-p4.3.md": "canonical",
  "2026-09-21-consumer-parity-p4.4.md": "canonical",
  "2026-09-27-pi-harness-p1.md": "canonical",
  "2026-09-27-pi-harness-p2.md": "canonical",
  "2026-09-27-pi-harness-p3.md": "canonical",
  "2026-09-27-pi-harness-p4.md": "canonical",
  "2026-09-27-pi-harness-p5.md": "canonical",
  "2026-09-28-cdd-review-contract-fix.md": "canonical",
  "2026-10-02-doc-architecture-v2-p1.md": "canonical",
  "2026-10-02-doc-architecture-v2-p2.md": "canonical",
  "2026-10-02-doc-architecture-v2-p3.md": "canonical",
  "2026-10-02-doc-architecture-v2-p3.1.md": "canonical",
};

// The T7 prose-period plan family — the 4 pre-Do-form osuperpowers plans the prose-period describe
// asserts on (task-number continuity · `## Global Constraints` zero presence · the constraint-text
// verbatim pin · the derived-acceptance completion product · single-form validate). The Do-form
// family's MIGRATED_PLANS filter excludes them so its acceptance/constraints/groups verbatim pins
// stay scoped to the 17 Do-form transcription targets.
const PROSE_PERIOD_PLANS = [
  "2026-09-13-osuperpowers-overhaul-p1.md",
  "2026-09-13-osuperpowers-overhaul-p2.md",
  "2026-09-13-osuperpowers-overhaul-p3.md",
  "2026-09-13-osuperpowers-overhaul-p4.md",
];

/** Resolve the plan's `**Spec:**` target to its spec file — repo-root form primary, file-relative
 *  fallback, holder targets skipped (the same Class-A bases the plan doc-type walks). Shared by the
 *  plan-Do family and the prose-period family. */
function resolveSpecFromPlan(planPath: string): string {
  const lines = readFileSync(planPath, "utf8").split("\n");
  const lineIdx = lines.findIndex((l) => l.includes("**Spec:**"));
  expect(lineIdx, `${planPath} must carry a **Spec:** line`).toBeGreaterThanOrEqual(0);
  for (const { target } of linksOnLine(lines[lineIdx]!)) {
    if (isPlaceholderOrTemplateTarget(target)) continue;
    const resolved = resolveAny(target, [REPO_ROOT, path.dirname(planPath)]);
    if (resolved) return resolved;
  }
  throw new Error(`no resolvable **Spec:** link in ${planPath}`);
}

/** The migrated plan's `## Constraints` section body, canonicalized — `###` sub-heading lines kept
 *  structural (verbatim), prose lines shell-normalized (bullet/blockquote shells stripped) — the
 *  compare atom of the constraints pin. Read through the SAME reader for the plan-Do family and the
 *  prose-period family (a plan's `## Global Constraints` → `## Constraints` re-shell lands here). */
function constraintsBody(content: string): string[] {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => /^## Constraints\s*$/.test(l.trim()));
  if (start < 0) return [];
  const end = lines.findIndex(
    (l, i) => i > start && (/^### Task \d+:/.test(l) || /^## [^#]/.test(l)),
  );
  const out: string[] = [];
  for (let i = start + 1; i < (end < 0 ? lines.length : end); i++) {
    const t = lines[i].trim();
    if (t === "" || t === "---") continue;
    if (t.startsWith("### ")) out.push(t);
    else out.push(canonLine(lines[i]));
  }
  return out;
}

const SPEC_MIGRATION: Readonly<Record<string, MigrationState>> = {
  "2026-09-13-osuperpowers-overhaul-p1-design.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p2-design.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p3-design.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p4-design.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p5-design.md": "canonical",
  "2026-09-13-osuperpowers-overhaul-p6-design.md": "canonical",
  "2026-09-21-consumer-parity-p1-design.md": "canonical",
  "2026-09-21-consumer-parity-p2-design.md": "canonical",
  "2026-09-21-consumer-parity-p3-design.md": "canonical",
  "2026-09-21-consumer-parity-p4.1-design.md": "canonical",
  "2026-09-21-consumer-parity-p4.2-design.md": "canonical",
  "2026-09-21-consumer-parity-p4.3-design.md": "canonical",
  "2026-09-21-consumer-parity-p4.4-design.md": "canonical",
  "2026-09-27-pi-harness-p1-design.md": "canonical",
  "2026-09-27-pi-harness-p2-design.md": "canonical",
  "2026-09-27-pi-harness-p3-design.md": "canonical",
  "2026-09-27-pi-harness-p4-design.md": "canonical",
  "2026-09-27-pi-harness-p5-design.md": "canonical",
  "2026-10-02-doc-architecture-v2-p1-design.md": "canonical",
  "2026-10-02-doc-architecture-v2-p2-design.md": "canonical",
  "2026-10-02-doc-architecture-v2-p3-design.md": "canonical",
  "2026-10-02-doc-architecture-v2-p3.1-design.md": "canonical",
};

const ONE_OFF = "2026-09-28-cdd-review-contract-fix.md";

// The two frozen legacy overalls' recorded terminal residue (their own validate output): the
// closeout-accounting face — change-history claims written inside `（…）` parentheticals are masked
// by the strict claim-window scan (C2 ⑤), so the shipped plan/design columns owe forward-declared
// claims the frozen change history never declared. Pre-existing program residue (the frozen
// programs' change history is history), pinned exactly here — the tree walk asserts them as the
// measured counts below (7 = osuperpowers-overhaul: P1/P2/P3/P6 plan + P1/P2/P6 design;
// 14 = consumer-parity: P1–P4.4 plan + design), field `backfill claim` and nothing else.
const FROZEN_OVERALL_RESIDUE: Readonly<Record<string, number>> = {
  "2026-09-13-osuperpowers-overhaul-overall.md": 7,
  "2026-09-21-consumer-parity-overall.md": 14,
};

// The pre-transcription verbatim pins (T5 machine pin — token fidelity): each migrated spec's
// acceptance entries and Section-1 constraints text AS WRITTEN BEFORE the transcription, in the
// shell-agnostic canonical form canonLine() reads both the pin and the migrated section body
// with. A pin mismatch = the transcription dropped / edited / reordered accepted or constrained
// text — the content-fidelity contract for the spec family.
const SPEC_VERBATIM: Readonly<
  Record<string, Readonly<{ acceptance: readonly string[]; constraints: readonly string[] }>>
> = {
  "2026-09-13-osuperpowers-overhaul-p1-design.md": {
    acceptance: [
      '[ ] `templates/handoff-namespace.json#workspaceRoot = ".osuperpowers/cdd"`，engine 产物（handoff / progress / lifecycle / base-branch / report-target）全部落到 `.osuperpowers/cdd/<slug>/`；`resolveWorkspace` 单源派生，不依赖任何硬编码替换',
      "[ ] `cdd base-branch set|get` 仅接受 `--plan <path>`；`--scope` / `--slug` 标识不存在（usage 面 + 行为面）",
      "[ ] `.superpowers/` 下仅存 `sdd/`（docs-review / cdd 全部 workspace / archive / lifecycle / smoke 已删）；`git status` 干净（全 gitignored）",
      "[ ] engine 运行期零 `.superpowers` 写入（`.superpowers/sdd` 保留面除外）",
      "[ ] finish ing read-base：有 cdd artifact → 读新根；无 artifact → 推断 base 传给 present-menu 不落盘（SKILL 文本 + 行为一致）",
      "[ ] root `.gitignore` 含 `.superpowers` + `.osuperpowers`",
      "[ ] 新增 stale-lexicon 守卫（`.superpowers/cdd` / `.superpowers/standalone`）在机制位置零命中；`.superpowers/sdd` 引用放行（residue.test.mjs 断言）",
      "[ ] `pnpm run validate` 13 块全绿 + `pnpm run emit:check` 无 drift",
      "[ ] changeset（cdd-engine minor）落盘",
    ],
    constraints: [
      "不重复 overall 约定（仓库语言政策 / 不 commit 除非显式 / vendored 不可改 / 破坏性重构授权 / `pnpm run validate` 13 块 + `emit:check` 无 drift）。冲突时 overall 优先。",
    ],
  },
  "2026-09-13-osuperpowers-overhaul-p2-design.md": {
    acceptance: [
      "`AC1` `docs/superpowers/` 目录不存在（`ls docs/` = `maintainers/` + `osuperpowers/`）；`docs/osuperpowers/specs/` = 24 文件（21 历史 + overall + P1-design + P2-design）、`docs/osuperpowers/plans/` = 20 文件（18 历史 + P1 + P2 plan）——**P2 完成时点**度量；39 文件 git mv 历史保留（`git log --follow` 可追溯）",
      '`AC2` `rootFromDocPath("/repo/docs/osuperpowers/specs/foo-design.md")` → `/repo`；`rootFromDocPath("/repo/.osuperpowers/cdd/x/review-1.json")` → null（运行根不误匹配）；`naming.mjs` 零 `docs/superpowers` 字符串',
      '`AC3` 21 个历史文件 54 次 `docs/superpowers` 出现（53 行）已重写为 `docs/osuperpowers`；`grep -rl "docs/superpowers" docs/osuperpowers/` 命中 == 在途 `2026-09-13-osuperpowers-overhaul*` 文件集（§2.7 度量口径）；**全部 plan 的 `**Spec:**` 头链接迁移后均指向存在文件**（行为性断言，实测量 10 处以 plan 阶段为准，不作为计数验收）',
      "`AC4` `node scripts/run.mjs validate` 13 块全绿；residue 5c 新增 `docs/superpowers` stale-lexicon 机制位置零命中；grep-sweep 各 sweep（old bin 名 / cdd-reference / subagent-driven-development / HARD-GATE / --prompt）在过滤移除后仍 0 命中",
      "`AC5` active 约定文档（writing-plans / brainstorming SKILL.md、overall-spec-template、finding-meta、根 CLAUDE.md、packages/osuperpowers/README.md、maintainer-doc）零 `docs/superpowers` 路径字符串；tickets 移除面 **10 处**全部落地——零 `ticket`/`tickets` 引用（范围外：vendored 物理目录 + 在途程序文档的移除叙述）",
      "`AC6` overall-consistency 对 4 个 overall 全过（新 overall 首次入守卫不误报）；`pnpm run emit` fresh / `emit:check` drift 0",
      "`AC7` engine suite vitest 全绿（handoff-naming / cdd / docs-runner 新布局 fixture）",
    ],
    constraints: [
      "仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）",
      "不 commit 除非用户明确要求；changeset 逐 phase 建",
      "vendored 子模块不可改",
      "**破坏性重构已授权**（遗留即删）：39 历史文件 git-mv + rootFromDocPath drop 旧 marker + `docs/superpowers/` 目录删除",
      "所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；skills/*.md 与 skills/*/docs/*.md 改动后必跑 `pnpm run emit`",
      "P1 定案引用：`workspaceRoot` 单源 `.osuperpowers/cdd`（`templates/handoff-namespace.json`）；`.superpowers/sdd/` 保留不属于本 phase 域",
    ],
  },
  "2026-09-13-osuperpowers-overhaul-p3-design.md": {
    acceptance: [
      '**AC1** `cdd --help` 子命令集合**恰为** `{implement, review, fix, base-branch}`：`lib/cli/parse.mjs` **顶层**命令静态集合断言——首选 `program.commands.map(c => c.name())`（见 §2.5 ①；`base-branch` 经 `const baseBranch = program` 换行链式注册，纯文本正则须用 `/^(?:const \\w+ = )?program\\b\\s*\\.command\\("([^"]+)"\\)/gm` 才能收全，无锚全集正则与字面锚均误判）+ 黑盒 `cdd brief` / `cdd research` → unknown command exit 2',
      "**AC2** engine 机制位置 `packages/cdd-engine/{bin,lib,templates}` 零残留：`cdd brief` / `cdd research` / `CDD_RESEARCH_TIMEOUT` / `RESEARCH_TIMEOUT` / `validateBrief` / `LEGACY_MODE_ENV` / `lib/cli/brief.mjs` / `lib/cli/research.mjs`。**`tests` 面另口径**（不与 §2.5 ② 互斥）：仅 `validateBrief` / `LEGACY_MODE_ENV` / `lib/cli/brief.mjs` / `lib/cli/research.mjs` 四项符号/文件面零残留；**命令字面 `cdd brief` / `cdd research` 允许且必须存在于 `tests/cli-shape.test.mjs` 的退役断言中**（守卫测试本体不得成为被守卫语汇载体的既有先例只约束 live 语汇——命令形守卫的 scope 亦刻意不含 tests）",
      "**AC3** `packages/osuperpowers/skills/cli-research/` 不存在；`packages/osuperpowers/.agents/skills/osuperpowers/cli-research/` 不存在（emit prune；**全仓相对路径**——根 `.agents/` 本不存在，写根相对路径会假通过）；历史 plan/spec 文档豁免",
      "**AC4** 新守卫：注入临时文件正例命中 + 反射例（`/mattpocock-skills:research`、`brief-dependent plan sections`）零误报 + live-repo `collectStaleLexiconHits() === []`",
      "**AC5** `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（含 `tests/lifecycle.wiring.test.mjs`——六派发模块收敛为五后的接线守卫）；`pnpm run validate` 13 块全绿；`pnpm run emit:check` 无 drift",
      '**AC6** `.changeset/` 无裸包名 `"osuperpowers"`；本程序 P1/P2/P3 各一条；归并后仍含全部 `closes #NNN`；`pnpm run version --dry-run` 的 next 版本仍为 `1.0.0`',
      "**AC7** overall 四表同步至 v1.11，`overall-consistency`（块 12）通过",
    ],
    constraints: [
      "仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）",
      "不 commit 除非用户明确要求；changeset 逐 phase 建",
      "vendored 子模块不可改（`vendors/mattpocock-skills` 的 `research` skill 属其自身资产，本 phase 不触碰）",
      "**破坏性重构已授权**（2026-09-13 用户显式：允许破坏性变更、确保最佳实践、不留技术债务、遗留即删）——本 phase 的两处删除、级联死配置连根、backlog changeset 归并均在此授权内",
      "所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；skills 改动后必跑 `pnpm run emit`",
      "**不改变引擎评审语义本体**（overall non-goal）：review/fix/handoff 生命周期、Stopping 判定、commit-contract、doc_hash 双签名不动；本 phase 仅收敛命令面与随删死配置",
    ],
  },
  "2026-09-13-osuperpowers-overhaul-p4-design.md": {
    acceptance: [
      "**AC1** engine `bin`+`lib` 内 `process.cwd()` **计数 = 1**（且在 `lib/root.mjs`）；零 `gitToplevel(process.cwd())` 副本；零 `rootFromDocPath`；全仓零 `resolveRepoRoot`（含 tests）",
      "**AC2** 子目录 + 仓根相对 `--plan`/`--spec`/`--findings` → 正常执行且 artifact 落**仓根** workspace；零幽灵 `<子目录>/.osuperpowers`；路径不存在 → **exit 1** + BLOCKED 诊断（首行 `CDD_BLOCKED: --<flag> not found: <arg>`，含仓根相对指导；退出码语义见 §2.4.2 退出码表：1 = 运行期不可继续 / 2 = 用法·环境 / 3 = Review Stopping，skills 只按 code 粗分流、具体路由读 stderr 首行前缀）",
      "**AC3** `process.env` 取值直读 ⊆ canonical 白名单（**7 键**：3 宿主识别 + `PATH` + 3 timeouts；见 §2.4.4 ①）+ 整表透传点 ⊆ §2.4.4 ② 清单（8 处）+ 零 spread 注入；`packages/cdd-engine/templates/` 内零 `$CDD` 引用；子进程零 `CDD_*` 注入；测试零旁路缝（`filteredEnv` 类补丁零命中）；`CDD_LIFECYCLE_PATH` / `CDD_REGISTRY_PATH` / `NODE_ENV` / `CDD_DRY_RUN` / `PLAN_FILE` / `CDD_HANDOFF_PATH` 键名零命中",
      "**AC4** `packages/cdd-engine/templates/context-contract.json`（**声明**）存在且被**运行期组合**消费（**承重**——`lib/context.mjs` 内 flag 名 / env 白名单 / timeout 默认值零硬编码）；**运行期 context 零落盘**——engine 内零「写 context 到任意路径」调用",
      "**AC5** 每次派发输出 `status`/`commits`/`artifacts`（绝对路径）/`blocker`/`counters`；engine **零回读自身输出**；**编排型 skill**（brainstorming / writing-{single,overall,phase}-spec / writing-plans / cli-driven-development / finishing）零 `CDD_*` 名、零 `progress.json`、零 handoff 文件名模式。**例外（设计内，非缺口）**：`report-issue` 的 `progress.json#plan` 读取是 **program 通道的首跳**（§2.5.4 的目的正是使其可用），不属「引擎内部结构依赖」——该处的去留归 P5 的目标流程（届时可改指命令输出契约）",
      "**AC6** **输出契约单源**：提示词注入的 handoff 结构由 **schema 派生**（携带允许键集 / `type` / `enum` / 嵌套形状 / `allOf` 条件）；**engine 写侧经同一 schema 构造**；校验报错含**违规键名 + JSON 指针**；engine 内零手写 schema 字段清单、零手写 handoff 对象字面量",
      "**AC7** **失败类目化**：`TIMEOUT` / `CONTRACT_VIOLATION` / `ENGINE_SELF_WRITTEN` / `EXECUTION_FAILURE` / `UNVERIFIABLE` / `PLAN_CONFLICT` 六类显式声明；`CONTRACT_VIOLATION` 走**归一化重校验**且 findings **全额保留**；`ENGINE_SELF_WRITTEN` **不计入 Review Stopping**；**仅 `EXECUTION_FAILURE` 消耗 recovery 额度**；超时判定**引擎自持**（零 `res.timedOut` 单点依赖）；默认 `task 90 / review 60` 分钟",
      "**AC8** `progress.json#plan` 与 `--plan` 入参一致（program 通道首跳可解析）",
      "**AC9** `init` / 版本戳 / `handoff-schema.md` / `_docs/review.md` 零残留；版本真相收敛为 `package.json` + emit 产物；shipped 非 emit 面零版本字面量",
      "**AC10** finding-meta 枚举**仅顶层单源** + 渲染器注入；**同一 canonical 枚举输入 → `.github/ISSUE_TEMPLATE` 渲染字节不变**（单源化行为中性）；枚举**取值已同步**（`osuperpowers:init` 移除、3 个新 spec-writer 加入；`report-issue` 保留旧名待 P5 改名）；`emit:check` 绿",
      "**AC11** 8 skill 全节点锚定（digraph + 节点定义）；**三个 spec-writer 按 §2.7.2 的同一骨架图逐项裁剪**（骨架 + 四项差异表，`read-template` / `scope changed?` / `sync-overall` 在不适用处显式「无此节点」——零未定义指涉）；委托型**零上游文档 read**（零 `vendors/` 路径、零上游 SKILL.md 路径、零 `Read-Upstream` 措辞；上游引用一律 `/plugin:skill` 斜杠形）；两类形态落地；**各 skill 保留 `## Invariants` 节**（跨节点不变量 / **上限 5** / 超出降级节点 Fail 字段——`report-issue` 的 `I4` Never Reopen 即按此降级为 `dedup` 节点 Do/Exit，表内余 5 条，见 §2.7.3），Review Stopping 入 Invariants（承载者 = 三个 spec-writer + `writing-plans` + `cli-driven-development`，§2.7.4）；零 `_docs/` 引用（含裸提及）；**零 `fix-inline`**（修复一律 `cdd fix` 形）；`digraph-consistency` 无 init 豁免；`rule-reference.test` 删除且三处接线移除（validate step + 头注释 + ci-validate 用例）",
      "**AC12** `skill-authoring.md` 按「唯一执法点」重写（session-call 语义 + 两类形态 + 删 §7/§9 + §4 例外口子收敛）",
      "**AC13** `pnpm run validate` 13 块全绿 + `emit:check` 无 drift + engine 套件全绿",
      "**AC14** **失败类目 canonical**：类目表落 `packages/cdd-engine/templates/failure-categories.json`（类目 / 是否计入 Stopping / 各自计数器 / 恢复策略）；**engine 侧从 canonical 读取**（承重，非装饰）；**skills 侧**短 Failure Modes 表的**类目名集合 ⊆ canonical**，且不复述类目语义（见 §2.5.2 通道 ② 两条断言）",
      "**AC15** **templates 结构与命名单源**（§2.5.5）：4 个提示词模板**同一文档骨架**（段名与段序一致：`# Title` / `## Instructions` / `## Handoff` / `## Return`；功能差异只在 `## Instructions`；`Self-validate` 并入 `## Handoff`；`review/doc-fix.md` 补齐 `## Return`）；`## Handoff` 与 `## Return` **各为一份共享壳**；**Handoff 段为 schema 原样注入**（`JSON.stringify`）；**engine 内零手写 render**（零 `stubAnnotation` / `satisfiesProp` / `patternSample` / `requiredKeys` / `stubScalar`，零第二校验器，零手写 schema 字段清单）；两份 schema **均含 `description`** 且模板内**零重复 Handoff Rules**；schema 前缀统一为作用域名（`task-handoff-schema.json` / `docs-handoff-schema.json`）；模板目录分组与 (op,type) 派发面对齐",
    ],
    constraints: [
      "仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）",
      "不 commit 除非用户明确要求；changeset 逐 phase 建",
      "vendored 子模块不可改（`superpowers` / `mattpocock-skills` / `impeccable` 的 skill 属其自身资产）",
      "**破坏性重构已授权**（用户 2026-09-13 / 2026-09-15 重复确认：允许破坏性变更、确保最佳实践、不留技术债务、遗留即删）",
      "所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；skills / emit 源改动后必跑 `pnpm run emit`",
      "**不改变引擎评审语义本体**（overall non-goal）：review/fix/handoff 生命周期、**Review Stopping 的判据**、commit-contract、`doc_hash` 双签名不动。P4 对引擎的实质改动限定在**契约面**（输入信道 / 输出契约 / 失败类目 / 超时分类），不改判定逻辑",
      "**legacy 只作参考，不作主体**（用户 2026-09-15）",
    ],
  },
  "2026-09-13-osuperpowers-overhaul-p5-design.md": {
    acceptance: [
      "1. `grep -E '\\breport-issue\\b'`（单数，**词边界**——不带 \\b 的裸词形会 substring 命中新复数名 `report-issues`）机制面零命中（历史 plan/spec + CHANGELOG 豁免；作用域 = skills 目录 / finding-meta / renderer / emit / README / tests；复数 `report-issues` 不在此守卫命中面）",
      "2. `.github/ISSUE_TEMPLATE` = **bug_report/enhancement 两份表单** + `emit:check` drift=0（`formFieldDefs` 2 键、零 `sessionTypes`/session_report 产物）",
      "3. **E 族 6 条各有锚点**（§2.9 表逐行对照）",
      "4. **report-meta 终态 2+1**：metaFields = `skill`·`step` 两字段 + masterDef Session 段 `Harness` 一行；renderer 零 `- Kind:`/`- Date:`/`- Source:` 行；I7 不变式删除",
      "5. **renderer 零残留**：无 `--mode` 标志 · 零 `renderComment`/`renderTitle`/`resolveDropdownOptions`/`sessionTypes` · 裸调用单入口",
      "6. **brainstorming #explore-context 零「固定 4 渠道」表述**（E-7）",
      "7. **handoff schema 紧凑注入**（E-8）：`renderHandoffStub` = `JSON.stringify(schema)`；`templates.test.mjs` 格式 drift 断言绿；task 注入省 ~265 tok 断言（可选）",
      "8. **repo label rename 已执行**：`gh label list` 有 `cdd-engine` 无 `cdd`；历史 issue 标签随迁",
      "9. `pnpm run validate` 全绿 + `pnpm run emit:check` 无 drift",
      "10. **commit 边界管控落地**（AC 10）：`dispatch/task.ts`/`docs.ts` 继承 DispatchLifecycle（`dispatch/base.ts`，落点面 = §2.13 目标树）——入口门（pre-commit 干净树）+ 出口门（post-commit validateCommitContract）为基类模板方法/默认 hook，两实现继承覆写（**docs review/fix dispatch 同消费双门**，见 P5 落点 2/3）· `fix/docs.md` 含提交指令（agent 完成时 commit 被修文档，conventional + 无 attribution + 无改动 skip）· 6 个 review-fix skill 的 review 前「工作树干净」措辞",
      '11. **第三方依赖收敛落地**（AC 11）：`packages/cdd-engine` src 零 `execFileSync("git")` 手写 git（经 simple-git）· 零 `emitScalar`/`isPlainUnsafe`（osuperpowers 经 `yaml`）· 零 `PLACEHOLDERS` 手写替换循环（经 handlebars）· cdd-engine glob 经 tinyglobby · husky 零 cdd-engine 依赖声明（仅 root devDependencies 存续）· `docs/maintainers/third-party-dependencies.md` 存在且登记全部 pkg（含不引清单与理由）；engine suite 全绿（simple-git/handlebars/yaml 换算后原语义不变）',
    ],
    constraints: [
      "仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）",
      "不 commit 除非用户明确要求；changeset 逐 phase 建",
      "vendored 子模块不可改（本 phase 不触达任何 vendor）",
      "**破坏性重构已授权**（用户 2026-09-13 / 2026-09-16 重复确认：允许破坏性变更、确保最佳实践、不留技术债务、遗留即删）",
      "所有改动须过 `pnpm run validate` 全绿 + `pnpm run emit:check` 无 drift；skills / emit 源改动后必跑 `pnpm run emit`",
      "**不改变引擎评审语义本体**（overall non-goal）：E-8 仅改注入序列化（`JSON.stringify(schema)` 紧凑），不碰 schema 内容 / 校验 / commit-contract / doc_hash",
      "**principle 定案（用户 2026-09-17）**：「任何信息保留都必须是面向运维人员的高价值信息」——本 phase 的报删判据：无消费者即删、与平台原生重复即删、兜底概念即删、标注性而非决策性即删；「自动 vs 手动来源可辨性由结构信号天然承载（Report meta + dedup + 聚合形态），零字段成本」",
    ],
  },
  "2026-09-13-osuperpowers-overhaul-p6-design.md": {
    acceptance: [
      "**总不变量（第一条）**：**零纸面宣称**——本 spec 的每一项删除面有残留守卫、每一项收敛面有机械断言、每一项纪律有执法位（断言或单点注解）；validate 全链覆盖全部执法断言。",
      "**零纸面宣称总校验**：residue/validator 断言面扩展（digraph 三断言 · 字节不变式 · 残留守卫 · 锚点 · 内存守卫 · pre-commit 子集）全绿；「无机械执法即无宣称」评审可核对每 spec 项 ↔ 执法位映射",
      "**能力宣称**：README/zh/CLAUDE.md 零 8-harness、零死引用；keywords 零 droid/pi、零 `#pi` 死字段；`emit:check` drift=0",
      "**`.agents/` 移除**：git **零跟踪**、emit 零产出、代码零 `emitAgentsSkillsCopy`/`pruneStaleAgentsNamespaces` 引用；产出集合 = 4 项；CLAUDE.md 零派生提示",
      "**vendors 全撤**：marketplace/产物零 vendor 条目；零 publish-vendor（代码/workflow/步）；validate **12 块**；workflow 零 submodule-sync/bump；checkout 零 recursive；`.gitmodules` 零条目、`vendors/` 不存在；version-sync 零 superpowers 检查；README/zh 零自维护面（仅官方命令引用标上游）；守卫零命中",
      "**测试就近 + `.mjs` 终态**：`src/**/__tests__/**/*.test.ts`；`tests/` 退役；src 恒真 0 `.mjs` + tests 32→0；osuperpowers scripts 保留 `.mjs` 隔离（显式留存记录）；repo scripts/ 全量 `.ts`（44→0，`node scripts/run.ts validate` 直跑，留存例外零）；engine suite 全绿（含新守卫）",
      "**模板系统化 + cache C1–C7**：4 模板抗骨架数据校验一致（章节序/段名/segments 归属恒等）；条款库零重复（clauses 单源）；token registry 全收敛（**18 令牌实测** → 新命名规范，**零遗留旧态名**：H1_BLOCK / HANDOFF 三义旧名 HANDOFF·HANDOFF_TYPE·HANDOFF_STUB / TYPE / LENS_GUIDE…）；`engine-config.json`/`template-contract.json` 存在且消费方程单点（`config.ts`/`templates.ts`）· 测试引用路径随迁；组装序恒为「registry prefix → 静态壳 → 变体载荷」；壳单源字节恒等零漂移；schema canonical 序列化；重派发零重渲染；同 (harness,op,type) 派发集逐字节同集；静态区最薄；registry 条含 cache profile（claude explicit/512/0.1/1.25/5/observable；cursor-agent auto pending）且 schema 校验；dev 观测脚本就位，连续同类型 round `/cost` 读 tok > 0 可测（验收记录实测值）；收益边界入文档；**C1-max 终态（v1.8）**——四 .md 并入 contract（零手写模板文件，或 emit 派生 + drift 守卫）；段序恒为「壳 → Return → Round context」且 Return 字节常数（动态区唯一绝对尾）；token zone 归属断言「壳零注入 + 槽仅现所属区」全绿；C4 壳无参常数（staticShellKey 消除、重派发零重渲染断言强化）；跨模板字面头字节恒等断言 · WORKSPACE_SLUG 就位（plan/spec 收敛）；**scripts CLI 框架统一 + 测试就近落地（v1.9）**——run.ts/observe-cache 全 citty（零 Commander/手写 parseArgs · 退出码表对齐 engine）· scripts 测试全 `__tests__/` 就近（root include 收敛 + 内存守卫不变）· commander 零依赖 · parse/presence 断言全绿；**plan-constraints 物料化落地（v1.10）**——implement pre-flight 自 plan 声明源生成（确定性提取 + plan hash 锚）、存在性门缺失/不可解均 BLOCK（零 fallback note 实证）、dry-run 豁免；**H1 内容级零残留**——prompt 正文零 `H1` + src 零 `h1*` 标识符 + `\\bH1\\b` 守卫零命中；**执行层 WIP 保全合同落地（v1.12）**——非 exit-0 + 树脏派发自动 stash 保全（BLOCKED blocker 含 stash ref + 规模，可 apply 评审/抢救）· fix/review diff 越 findings 文件集 → BLOCK · EXECUTION_FAILURE blocker 诊断三件 · T23/branch-fix 死因可归档重放；**架构收敛落地（v1.13）**——branch 族继承 DispatchLifecycle（T14 liveness / T23 carrier / T24 残局自动落到 branch）· rules⇄artifacts 纠缠带拆解（循环依赖零）· Convergence/writeBlocked/workspace/return-block/hashFile 各单点 · 死代码零 · 手动 throw 全经 exit.ts（CddExitError 家族 + invariant 工厂）· 运维文档含架构三纪律；**终止契约 + 续传落地（v1.14）**——单一 termination monitor（stall+budget 两信号、cause 化 blocker）· 三 env 键/config 两段/execa 通道删净 · resolver 并一 · TIMEOUT→保全→重派→WIP 落回新工作树 + brief 附言（黑盒实证：agent 增量续作非全量重写）· 退出码表不变；**lifecycle 状态正交化落地（v1.11）**——`unverifiable`/`plan_conflicts` 不再裸折 BLOCKED（折入必带 failure_category + 真实 blocker）· 契约在 schema field description（prompt 零散文）· 真·unverifiable → BLOCKED+UNVERIFIABLE+真实 blocker → 编排者上报用户（failure-modes 条目生效）· §口径 dev-measured accepted-noted 零复位评审 · BLOCKED 任何通道 exit 1（T14 现场用例反转红→绿）· schema allOf 强制「BLOCKED ⇒ blocker 或 failure_category」",
      "**skill 文档模板系统化（D-2）**：4 文件（base-branch / overall-spec-template / add-phase-protocol / phase-spec-template）统一骨架 + 条款引用 + P1–P6 经验烘焙（§2.6 引用）；与 engine 模板同 doctrine；emit 时间窗已序；`program-experience.md` 存在为全文",
      "**skill 流程原子性**：skill-authoring.md 含 flow 变更纪律；digraph 三断言（双向完整 · 骨架同构 · 增长信号）全绿",
      "**cdd 缺口**：**branch 级 review-fix loop 落地**——`cdd fix --type branch` 命令面可用 + cli-driven-development digraph 为 canon shape（`branch-review → {blocker=0?} → branch-fix →（blocker>0 → re-review / blocker=0 → finishing）`，与 spec/plan/task 族同构，零编排 inline）· branch findings 全 engine 闭环；**dry-run 脏树 EXIT 0 + stderr 脏树 WARN 可断言**（dry-run 黑盒全绿——docs-task/cli-shape 相关用例，出处 = R3 实证）；黑盒前置文档化；跨 Task 收编走 pending-acceptance-patch（fix agent 零 plan 修改权）；纪律条款入库（模板正文零内联纪律散文）；锚点终态校验零漂移",
      "**stall 探测器**：卡死 >IDLE_WINDOW 被杀 + TIMEOUT handoff blocker 含清偿指引；无 90min 拖死；liveness 双信号测试绿",
      "**内存守卫**：`maxWorkers=1 + fileParallelism=false + maxConcurrency=2` 持久配置不变式，engine 全量套件 + 新增守卫全绿、正常负载无 OOM（基线 567 出处 = P5 终验 2026-09-18）",
      "**v1.13 收口**：smoke flake 稳定；changeset 消费后版本落地已验证",
      "**自省四修**：**session-call 实测 19 处零虚假 run 措辞**（6/4/3/3/2/1 分布，全部内联消费 + 产物记载 + authoring 原语修订）；grilling 含需求全量枚举；validate 边界记录于 maintainer docs；**pre-commit 脏树零结构性失败**（dry-run WARN 化 + 黑盒隔离/CI-only + 树无关子集）",
      "**收口复核**：全 plan/spec 锚点对实态零漂移；残留守卫零命中；changeset 齐备 + `version --dry-run` 落地；**4 份方法论 doc（naming-conventions / context-caching-doctrine / template-doctrine / program-experience）存在且与落地一致**；**F7 运维文档整理重组完成**（无用文档零、文件/目录按内容域重划、CLAUDE.md 链接与 validate doc-surface 同步）；**F8 术语优化落地**——`Review Convergence` 全 live 面就位（**5 skills 17 处** · CLAUDE.md · overall · maintainer docs · `rules/convergence.ts`）· `review-cycle-cap`/`dispatch-timeout-cap` 就位 · **术语第一仲裁生效**（机制标识符面：src 零 `stopping` 模块/标识符、零 `*-exhausted` 字面；术语登记出口 = 机制一致）· residue 断言 `Review Stopping`/`*-exhausted` 全平面零残留 · naming-conventions 含 terminology registry（含 mechanismNames）· **父整体 P6 行残留审计三件已修入 v1.44**（豁免词形 / 15→14 / 17→18 复核）· 历史 changelog 豁免（记录当时用语）；maintainer docs 与落地一致（exemplars/skill-authoring/third-party-deps/CLAUDE.md dev 段零陈旧）；`pnpm run validate` **12 块全绿** + `emit:check` 无 drift",
    ],
    constraints: [
      "仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）",
      "不 commit 除非程序机制要求（spec/plan 审批即提交——writing-phase-spec I2）；changeset 逐 phase 建",
      "vendored 子模块不可改（**本 phase 的 vendored 是撤离对象**——撤离 ≠ 修改，`git submodule deinit` + `.gitmodules` 移除）",
      "所有改动须过 `pnpm run validate` + `pnpm run emit:check` 无 drift；skills / emit 源改动后必跑 `pnpm run emit`",
      "不改变引擎评审语义本体（overall non-goal）——但命令面允许收敛（新增 `cdd fix --type branch` 是修复闭环，非语义变更）",
      "**engine 黑盒用例「工作树干净」结构性前置 + pre-commit 结构性矛盾**（域 E5/G4）：本仓库 pre-commit 全量 validate 在脏树上的失败是**待修矛盾**（G4 修复面），提交边界 = 干净树验证 + CI gate",
    ],
  },
  "2026-09-21-consumer-parity-p1-design.md": {
    acceptance: [
      "AC1 **判定表落盘**：本节 §2.1 判定表 + §2.2 shim 清单构成 P1 design 产物（`table/清单` 以上表为准）；§2.1 判定表每行含判据命中列 → 判定可复现（判据操作性定义见 §2.1 前置 C1/C2/C3 简写，完整落点 = overall v1.8 Cross-cutting「判据定式」段）。",
      'AC2 **13 件零现行主张**：`grep -rnE "overall-consistency|plan-spec-anchors" docs/osuperpowers/specs/2026-09-13-* docs/osuperpowers/plans/2026-09-13-*`（committed tree 实测 **26 命中行 / 8 文件**）命中逐处可划类——§2.3 处置表已逐处登记（J1 4 处 / J2·J3 22 行）；J1 类改写后 `grep` J1 残留 = 0（13 件现行主张残留 = 0，全部命中行归入 J1 改写态或 J2/J3 保留态）；J2/J3 保留登记齐备。**block 12 自检 2/2 仍绿**（改动不破坏 canonical four-table 结构）。',
      "AC3 **cdd 链 review**：本 spec 经 `cdd review --type spec` 收敛（blocker=0 + 全 finding 落地）后提交；文字改动面（§2.5 表）与 pe 判定表同步经 review。",
      "AC4 **S5 落地**：`scripts/run.ts:89` 描述与 smoke-cdd.ts 实际五命令一致；`pnpm run validate`（scripts unit 面）全绿。",
      "AC5 **零实现改动**：P1 不触碰 engine 源码、不新增 CLI 子命令、不退役守卫代码（退役 = P3）；唯一代码面改动 = S5 单行文本。",
    ],
    constraints: [
      "不重复 overall 约定；overall 冲突时 overall 胜。",
      "引下列 overall v1.8 条目，不重述正文：",
      "**判据定式**（C1 可达性 / C2 结构性 / C3 退化——useless 必删、无历史叙述豁免）：overall v1.8 Program charter · Cross-cutting constraints「判据定式」段（三判据操作性定义完整落点；P1 逐项 triage 与 P2/P3 处置的记在案判定规则）",
      "**Non-goals**：不新增 cdd CLI 子命令 · 不改 emit/marketplace/changeset 内部流水（doc-structure 渲染目标例外）· 不把本仓 GitHub issue 注册语义强加消费者 · 不改 README/CLAUDE.md harness 宣称类",
      "**约束**：允许 breaking · 唯一执法面 = engine lifecycle（本仓无 scripts 侧兜底）· spec/plan 结构定义同源派生（P2 载体）· engine 零文档写入 · 本仓=canary",
      "**语言**：Strategy B（spec/plan 中文）",
    ],
  },
  "2026-09-21-consumer-parity-p2-design.md": {
    acceptance: [
      "AC1 **全量审计落地面**：任意 dispatch（implement/review/fix/docs/branch 家族——含 branch-review / branch-fix）涉 parent overall 四表结构性不合法 → BLOCKED（exit 1）+ 逐项指引；真实 dispatch 树不洁之外无豁免；lineage 未 resolve → 四表 no-op、necessary-subset（plan 契约 + Class A）恒跑；dry-run → CDD_WARN 降级。（终态欠账面另则：AC3 · §2.2 终态欠账硬门。）",
      "AC2 **全通道挂门**：task/docs/branch 三通道 docContractValidate / statusValidate 均生效（base 默认 override，测试断言）；overall 自身为 review 对象时自审。",
      "AC3 **closeout 统一规则**：声明源 ↔ 列双向全列（forward + reverse，plan + design，无 plan-only 遗留）且 engine 派生终态并入声明源；mismatch 集单一推断模块（无第二实现，断言）；pre-flight 结构性 mismatch 非空 → BLOCKED + 指引、**终态欠账（plan-complete 未回填）→ plan-bearing dispatch（含 branch-review）pre-flight BLOCKED + 指引**（v1.3 两门面皆硬门；回填 = branch-review 前置义务）、post-flight plan-complete 且未回填 → 高亮回填 recommand（同源输出；exit 语义不变）；**finishing 撤销回填机制**（finishing 仅存 merge/PR 决策 + close-issues）；engine 零文档写入（回填由 orchestration 执行）。",
      "AC4 **doc-structure 单源实证**：改 canonical 定义一处 → engine 校验/抽取同步生效 + skills 经 `cdd help` 消费同源产物；grep 零 md 模板副本、零第二处手工 token（**scope**：engine 包内手动 token + SKILL.md 散文 token + repo/skill md 模板副本；`scripts/validate` 侧残留 token 归 §4 P3 退役面 S1/S2 + F8a 处置位，非 AC4 断言对象）；`templates/` schema 随包可寻址。",
      "AC5 **`cdd help` 落地面**：打印 CLI 绝对目录 + 必要文档目录正确；零执法逻辑；skills 零硬编码路径。",
      "AC6 **harness 契约确定性**：docs-handoff `commits{base,head}` 字段落地（逆转旧声明段）+ **status enum 增 TIMEOUT**（与 task-family 同枚举、核心块统一）；round-context docs base token 落地；同契约束轮次行为一致（提交 → APPROVED；未提交 → BLOCKED + stdout 可见诊断）。",
      "AC7 **零债断言**：无 plan-only 遗留 · closeout 推断无第二实现 · 无豁免例外常量（声明源缺席语义替代）· handoff schema 无双核心块 · base 默认 override 全通道生效。",
      "AC8 **breaking 版本面**：cdd-engine major bump 面明确（handoff schema + round-context + lifecycle 契约结构升级）；本仓与消费者同一条 engine 执法路径（无 scripts 侧兜底依赖）。",
      "AC9 **存量 md 模板退役**：overall-spec-template / phase-spec-template / add-phase-protocol md 模板删除，结构事实归 canonical（grep 零残留）。",
    ],
    constraints: [
      "不重复 overall 约定；overall 冲突时 overall 胜。",
      "引下列 overall v1.12 条目，不重述正文：",
      "**判据定式**（C1 可达性 / C2 结构性——v1.10 扩展：repo/skill 侧 md 模板副本全禁、schema 为唯一结构事实 / C3 退化——useless 必删、无历史叙述豁免）：overall Program charter · Cross-cutting「判据定式」段",
      "**Non-goals（v1.10 修订）**：不新增 cdd CLI 子命令——**唯一例外 = `cdd help`**（发现型信息子命令：打印 CLI 绝对目录 + 必要文档目录，零执法逻辑）；不改 emit 对 doc-structure（v1.10：参与面归零）、marketplace / changeset 流水",
      "**Cross-cutting（v1.10 修订）**：允许 breaking · spec/plan 结构定义同源派生（schema 唯一结构事实，skills 经 `cdd help` 直取，emit 不参与）· engine 零文档写入（只判只指引，回填由作者/orchestration 执行）· 本仓四表仍受 `scripts/validate/overall-consistency.ts` 机器校验直至 P3 · 本仓 = canary",
      "**四表纪律 #7（closeout 统一规则）**：overall v1.10/v1.12 定义（声明源 ↔ 列双向全列 + engine 派生终态并入声明源 + pre-flight 硬门 + post-flight 高亮 recommand + 回填由 orchestration 执行；**v1.12 两门面皆硬门**——结构性面 mismatch 非空 → BLOCK、终态欠账（plan-complete 未回填）→ plan-bearing dispatch（含 branch-review）pre-flight BLOCKED + 指引，回填 = branch-review 前置义务、终态源 = parent overall 下所有 plan workspace，见 §2.2）",
      "**语言**：Strategy B（spec/plan 中文）；SKILL.md / docs 英文主源不动（语义化在 P2 内英文落地）",
    ],
  },
  "2026-09-21-consumer-parity-p3-design.md": {
    acceptance: [
      'AC1 **守卫退役零残留**：`scripts/validate/overall-consistency.ts` / `plan-spec-anchors.ts` / `__tests__/{overall-consistency,plan-spec-anchors}.test.ts` 删除；`grep -rE "overall-consistency|plan-spec-anchors" scripts/` 零命中（`-E` 交替，非 BRE 字面 `|`）；42 行逐案对照表由 P3 plan T2 落盘本 design（每条 repo 断言 → engine 对应用例:行 → 覆盖判定，证实零功能损失——本版未落表，T2 落表后收口复核）',
      'AC2 **engine 套件零产物 fixture**：`canary-dogfood.test.ts` 删除；`grep -r "2026-09-21-consumer-parity" packages/cdd-engine/src/**/__tests__/` 零命中（engine 测试面零本仓程序产物引用）；**`docs/osuperpowers` 布局字符串排除**——14 文件在 mkdtemp 临时仓复刻消费者等效布局属合法 fixture，不属产物引用（§2.2 排除口径）；canary 实证 = P3 文档链（P3 plan → p3 design → overall）经 P3 全程 dispatch 审计零失败（运行期实证，测试面自造链承载）',
      "AC3 **phase-id 语法 A 落地**：canonical overall.json **全部 8 处 phase-id 承载 pattern** 单点迁移 `^P\\d+(\\.\\d+)*$`（issueInventory.row.phaseId · rowShape.idFormat · cells.dependency · hardEdge · softEdge · claimPatterns.designToken · phaseReference.single · range=single 派生 `\\s*[-–—]\\s*` 连接）+ description 全写 · engine 消费面（ownDesignToken / phaseIdFromPlan / designDocTail / split-phase 测试 `P1a`→`P2.1` 改造）零误伤 · 本仓存量文档零迁移 · engine 套件含语法新用例（P2.1 claim / P2.1-design / P2.1–P2.3 range / `…-p2.1.md` glob / **dependency cell `P2.1 -> P2.2` · hardEdge · softEdge**）",
      "AC4 **validate 净化**：12 → 11 块 · step 名全语义名零编号 anchor（**探针改前缀锚定/整串判定**：`(?:^| )\\b(?:[0-9]+\\.|5b\\d*|5c|8-10)[. ]+[A-Za-z(]` 在 step name 面零残留——数字前缀步名全捕获、语义名零误报；node 断言「现名全命中 / 语义名全 miss」防白绿（`0. unified emit freshness (emit-check)`/`6. marketplace validate`/`7. scripts unit tests`/`12. overall consistency`/`5b`/`5c`/`8-10` 族 HIT，`emit freshness (checked against regenerated products)` 等语义名 miss——旧式 `[0-9]+[. ]`+尾 `\\b` 失效：尾 `\\b` 在「.」→「 」non-word→non-word 边界断、吞点后备选项失配即漏检）；或对每个 step 名整串 match 语义名正则——二选一，杜绝白绿）· ci-validate.test.mjs / pre-commit.test.ts 钉死值 11 同步 · index.ts / pre-commit.ts import 面清洁 · `pnpm run validate` 全绿",
      'AC5 **S3 残留改写**：overall 四条 + osuperpowers-plugin.md:116-120 + CLAUDE.md:47 + overall-spec SKILL:54 改写为 engine 执法位/历史时态表述；`grep "scripts/validate.*guard\\|block 12.*consisten"` shipped docs/skills 面零现行主张（历史时态句允许）',
      "AC6 **consumer-sim**：`prepare: dev:stub` 钩子已移除（`pnpm publish` 不再重桩 dist——发布品 = 显式 build 产物）；先 `pnpm --filter @oscaner-skills/cdd-engine build`（真实 unbuild 产物，`dist/cli.mjs` 实测 71.7 kB）→ 包目录 `pnpm pack --pack-destination <out>`（备防 `--config.ignore-scripts=true`；实证失效不收：`--ignore-scripts` 旗标 / `npm_config_ignore_scripts` env / workspace root 相对路径 pack）→ **tarball 内容断言（防白绿）**：`dist/cli.mjs` grep stub 标识（`createJiti` / `node_modules/.pnpm`）零命中 **且** 字节数 > 10 kB（实测：桩 614 B、真实产物 71.7 kB——禁用「>100 kB」阈值，会误判真实产物）→ mkdtemp 临时仓安装（消费者布局，零仓内路径依赖；不读 `docs/osuperpowers/`、不引用本仓 node_modules——`dist/` = 显式 build 门生成的发布品机制，非前提假设）→ 安装链入口 `node <installed>/dist/cli.mjs`（或 `node_modules/.bin/cdd`）+ schema 目录落点（`<installed>/dist/documents/schema/` + `<installed>/templates/schema/`）可寻址实证 → 消费者链（`cdd help` + 5-command dry-run）在发布门与 PR 门可跑、输出消费者等效结果；fixture plan 二选一（临时仓派生 / `templates/` 内置由安装面读取）落 P3 plan 并实证；run.ts `smoke-cdd` 子命令语义 = consumer-sim",
      "AC7 **运维规范落档**：Program experience（或同族 maintainer 档）新增**八项**裁决条目（零产物 fixture · 零编号 anchor · 零 legacy 豁免 · phase-id 语法 A · 唯一执法面 · validate 11 块结构 · cdd 输出零过滤 · **docs-family 结果可见性 + 命令出口 exit.ts 单源（sequenced 于 §2.9 之后）**），英文主源、可 grep Verify",
      'AC8 **cdd 输出零过滤 + mid-flight backfill 落点（§2.8/§2.10）**：`grep -rE "cdd[^\\"\']{0,40}(tail|head|EXIT=|2>&1[[:space:]]*\\|)" packages/osuperpowers/skills/*/SKILL.md` 零命中；SKILL.md 中 cdd 调用节点含「direct invocation — read full output；cdd 自身优化输出长度」表述（或确认既有表述已符合）；五件 SKILL.md（cdd + writing-* 四件）Invariants 表各含「Mid-Flight Backfill」条目 + cdd 件 Engine Semantics 含「Entry gate reads the tree, not the committed range」；`pnpm run emit` 后零 drift',
      'AC9 **docs-family 出口统一（§2.9）**：docs-family review/fix 完成后 stdout 含 result 面（`status:` 行；`cdd.test.ts` docs-family 断言面同步更新为断 stdout status/blocker/handoff）；`grep -rn "^\\s*return;$" packages/cdd-engine/src/cli/*.ts` = 0（命令级裸 return 零命中）；`cli/*.ts` 出口统一走 `exit.ts` 族（`exitOkWith`/`exitWithCode`/`exitOk` 等，grep 实证 cli 层出口调用面 = exit.ts 单源）；exit table 0/1/2/3 不变；engine vitest 全绿',
      "AC10 **全链收口**：`pnpm run validate` 全绿（11 块，干净已提交树）· `emit:check` 零 drift · precommit 11 块绿灯 · engine vitest 全绿 · AC1–AC9 逐条可复核",
    ],
    constraints: [
      "不重复 overall 约定；overall 冲突时 overall 胜。",
      "引下列 overall v1.17 条目，不重述正文：",
      "**判据定式**（C1 可达性 / C2 结构性 / C3 退化——useless 必删、无历史叙述豁免）：overall v1.8 Cross-cutting「判据定式」段",
      "**Non-goals**：不新增 cdd CLI 子命令（唯一例外 `cdd help` 已于 P2 落地）· 不改 emit/marketplace/changeset 内部流水 · 不把本仓 GitHub issue 注册语义强加消费者 · 不改 README/CLAUDE.md harness 宣称类",
      "**约束**：允许 breaking · 唯一执法面 = engine lifecycle（本仓无 scripts 侧兜底）· spec/plan 结构定义同源派生（canonical schema 单源）· engine 零文档写入 · 本仓=canary（运行期形态）",
      "**语言**：Strategy B（spec/plan 中文）",
      "**2026-09-22 用户裁决（binding，v1.14/v1.15/v1.16 回填）**：unit/e2e 测试 = 功能性验证，**零本仓产物为 fixture**（产物删即测试废 = 耦合病）· **零编号 anchor**（`5b0/5b1/5b/12.` 族退役，steps 语义名，不利运维）· **canonical phase-id 语法严格 A**（`^P\\d+(\\.\\d+)*$` 点分分层，弃字母后缀）· **零 legacy 豁免死代码**（C3 直接命中）· 运维规范落档 docs/maintainers · **skills 调用 cdd 输出零过滤**（禁 `tail`/`head`/`2>&1 \\|`/`EXIT=$?`——cdd 已自身优化输出长度，v1.15 补充）· **命令级出口统一走 exit.ts**（引擎所有运行函数成功路径禁止裸 `return;`，exit.ts 统一出口族 + 结果可见性——§2.9，v1.16 补充）",
    ],
  },
  "2026-09-21-consumer-parity-p4.1-design.md": {
    acceptance: [
      "`docs/maintainers/` 内容文件全部为 `NN-name.md` 形式（`^[0-9]{2}-` 两位零填充编号；`README.md` 例外为索引），`README.md` 内含全族编号表（编号 · 文件名 · 定位 · 读者块）",
      "docs/maintainers 全族相对 `.md` 链接（`](….md)`）全部解析到存在文件、零断裂，既有 11 处全部迁移（node 遍历断言）",
      "`README.md` / `CLAUDE.md` / `README.zh-CN.md` + 包级 README（osuperpowers / cdd-engine 各 `.md` / `.zh-CN.md`）按 §2 目标骨架重写/新建落地（目标顶层章节标题逐条命中：grep 断言 8 段 / 5 段骨架 / 包级骨架）",
      "根 + 两包三件 `README.zh-CN.md` 头部含 mirror 声明行（mirror 关系 + 同步时间戳）；全仓 `.zh-CN.md` = 三件零其他（grep 断言）",
      "`pnpm run validate` 全绿（11 块）+ `pnpm run emit:check` 无 drift（重写未动 emit 派生面）",
      "本 spec 的 Parent program v1.24 版本行 lineage 合法；P4.1 行 Design-spec / Implementation plan 列随 phase 推进正确回填（backfill-overall，branch-review 前完成）",
      "重写后 README/CLAUDE.md/包级 README 宣称面（harness 支持面 · 安装/来源 · 行为描述）与落地行为零分歧（逐条人工对照 + review 记档）",
      "docs/maintainers 整理后编号连续无缺号、总件数 < 迁移后现值（精简实证）、`07-osuperpowers-plugin.md` 已删除（ls 反例）且 live 引用零残留（frozen specs/plans 豁免）；唯一值面 release 流程仍由 `.changeset/README.md` 承载",
      "根 + 两包 `README.md` 语言切换行维持 `[English](README.md) | [中文](README.zh-CN.md)` 原样（node 断言三件一致）；English README 面 `Simplified Chinese` 零命中（显式 `-E`；切换行豁免 claim）",
    ],
    constraints: [
      "Cross-phase 规则以 parent overall v1.25 为准（overall wins on conflict）：",
      "Charter Non-goal #4 已修订（v1.19/v1.20）：README/CLAUDE.md 全面重写归 P4.1 承担，覆盖全部宣称面（harness 支持面 · 安装/来源宣称 · 行为描述类陈述），重写后与落地行为零分歧；README.zh-CN.md = 同步 mirror（repo 对外宣讲面）",
      "判据三定式（C1 可达性 / C2 结构性 / C3 退化）适用于本 phase 一切处置判断",
      "四表纪律：回填 = branch-review 前置义务；结构性 mismatch → BLOCK",
      "语言政策：程序文档中文主源（Strategy B）；maintainers / README / CLAUDE.md 英文主源（Strategy A / B extension），**mirror = 根 `README.zh-CN.md` + 各包宣讲面（osuperpowers / cdd-engine 各 `README.zh-CN.md`），全仓其余零 `.zh-CN.md`**（政策修订随本 phase 落笔）",
      "本 phase 零 engine 变更、零 scripts/validate 变更——纯文档面；改动限 `docs/maintainers/`、根 `README.md`、`README.zh-CN.md`、`CLAUDE.md` + **包级宣讲面**（`packages/osuperpowers/README.md` 重写 · `packages/osuperpowers/README.zh-CN.md` 新建 · `packages/cdd-engine/README.md` 新建 · `packages/cdd-engine/README.zh-CN.md` 新建），均非 emit 派生输入（scripts/emit grep 零 README 引用实证；aff5c809 实证：docs/maintainers 修改后 precommit emit freshness 全绿）。**范围例外一条**（原二条中 (2) 升格为主面，见 §3 deviation）：(1) parent overall（`2026-09-21-consumer-parity-overall.md`）的 backfill-overall / v-bump 更新——AC6 · 四表纪律的 branch-review 前前置义务；包级 README 的 maintainers 入链引用口径同步随其重写一体承办",
    ],
  },
  "2026-09-21-consumer-parity-p4.2-design.md": {
    acceptance: [
      "`packages/cdd-engine/package.json` 声明值 = `0.1.0`（降值落盘）；`pnpm exec changeset version` 双包一次过（cdd-engine → 1.0.0 · osuperpowers → 0.2.0，DRY 层可验）",
      "`scripts/release/version-packages.ts` / `scripts/lib/version-utils.ts` / `.changeset/versioned-plugins.json` 机制零残留（grep 断言）；`scripts/run.ts version` 入口已退役",
      "`.changeset/consumer-parity-p2-major.md` 无 `1.0.0 → 2.0.0` / `归 P4，` 字样；`backlog-*` ×6 零残留（git ls-files 断言）",
      "`cdd issue render` 确定性实证：原 repo 侧 report-templates 黄金样本迁移到 engine（同字节）；`packages/osuperpowers` 内 `scripts/` + `bin/` 面零残留（grep 断言）+ `.superpowers/` 已清除",
      "`scripts/emit/issue-templates.ts` 从 engine import finding-meta 权威（无 `packages/osuperpowers/skills/.../finding-meta.json` 直引）+ emit 重生成后 `emit:check` 零 drift",
      "白名单 probe：`npm pack --dry-run`（osuperpowers）文件集合 == 7 项白名单（零 `tests/`、`bin/`、`scripts/`、`.superpowers/`、`.version-bump.json`）",
      "workflows：`pr-validate.yml` = checkout + setup + validate 三步 compose（零 link-cdd-engine、零 smoke-cdd）；`.github/actions/link-cdd-engine/` 已删除；release.yml 无 `npm link` 字样（grep `.github/` 断言）+ 无 node-version 22 + 复用 setup action + release-plugin 矩阵含 `cdd-engine` 双条目",
      "`smoke-cdd --expect-version` 接线实证：tarball version 断言 + release.yml publish 前 post-version 门存在 + 安装后版本身份断言",
      "README 三段式骨架（定位 → 理念 → 行为，grep 断言）+ 定位句无 harness 字样 + gh 元信息（description/topics 值与裁决一致，gh 实证）+ zh mirror 三件同步（emit:check / 一致性探针）",
      "`docs/maintainers` 6 → 5 内容文档（01+02 合并为 `01-template-doctrine`，剩余连续重编号 01-05：naming→02 / context-caching→03 / program-experience→04 / third-party-dependencies→05）、62.6KB → ~42KB（收敛前后对照）+ `02`/`05`（原 03/06）更新到 P4.4 终态 + 互链零断裂（含重编号编号引用同步，链接探针）+ smoke-cdd 定位说明存在",
      "**plan-constraints 每 TG 再生实证（mid-backfill 追加）**：`materializePlanConstraints` 无 generate-once 早退 · implement pre-flight 无 `existsSync` 跳过（每 implement dispatch 必调）· `isPlanConstraintsStale` 零残留（grep 断言）· 同 plan 二次调用覆写同字节（确定性保持）· engine 测试全绿（`pnpm --filter @oscaner-skills/cdd-engine test`）",
      "首次发布执行：`cdd-engine@1.0.0` / `osuperpowers@0.2.0` 双 tag + GH Release ×2 + npm 发布实证（`npm view` 可达）",
    ],
    constraints: [
      "跨 phase 约定看 parent overall（overall wins on conflict）：",
      "**宪章 Non-goal #1**（**v1.44 修订后**）：不新增 cdd CLI 子命令，唯一例外 = 信息发现型 `cdd schema get <type>` + 纯渲染型 `cdd issue render` **零执法**子命令；除外仍零新增（执法型）子命令",
      "**宪章宪法语**（v1.44）：repo scripts → engine 单向依赖铁律——repo 治理面可依赖 engine；**shipped 包 → repo scripts 禁止**，shipped 包必须自包含消费者面",
      "**宪章主句**（v1.44）：repo 定位改述「基于 cdd 理念的方法论」，harness 宣称面维持 P6 B1 中性「多 harness 可消费」，定位叙事零 harness 枚举",
      "语言政策：spec/plans 中文（Strategy B）；README/skills/docs 英文-primary（Strategy A）",
      "发布纪律：版本动作 = 原生 `changeset version`（main 上 changesets/action）；`.` 手写版本一律不做",
    ],
  },
  "2026-09-21-consumer-parity-p4.3-design.md": {
    acceptance: [
      "`cdd implement --tasks 1` 与 `--tasks 1,2` 走同一 dispatch 路径、行为正确（engine 测试绿 + dispatch 实证）；`--task` 单数旗标零残留：`packages/cdd-engine/src` · `scripts/` · `skills/` · 两包 README grep `--task` 零命中（frozen 历史 docs 豁免）",
      "`--tasks` 值边界正确：`--tasks 1, 2` 容忍空格（trim）· `--tasks 1,1` 去重 · `--tasks 1,`（尾逗号空 slice）exit 2 拒绝（与格式面一致）· `--tasks 1,9`（9 超界）整体 BLOCK + 缺失列示 · `--tasks abc` 非整数 exit 2（Bug-A 升级消息 `must be comma-separated integers`）",
      "`cdd review --type task --tasks 1,2` 一轮审整组（round/blocker/findings 组级归因）；`cdd fix --type task --tasks 1,2 --findings <handoff>` 整组修；re-dispatch 建议串为整组面（`cdd fix --tasks 1,2` 形态，无子集）",
      "plan 无 taskGroups 节（空默认）时 loop 逐 `--tasks 1`、`--tasks 2` 推进且与 P4.3 前现状等价（实证）；非空 taskGroups 按声明组 dispatch",
      "`plan.json` schema 含 `taskGroups` 属性（`optional` · `default: []` · item `minItems ≥ 2`）；`effectiveGroups` 在 `taskNumbersFromPlan`/`base.ts` 单处派生、无第二实现",
      "cli-driven-development flow digraph 含 task-groups 裁定节点（`C --> T --> D` 边）、`{more-groups?}` 判定、loop 入口以用户确认门控（拒答 BLOCKED）；组列表流入 `cdd implement --tasks a,b`",
      "Mid-Flight Backfill 文本五面（writing-single-spec · writing-overall-spec · writing-phase-spec · writing-plans + cli-driven-development）一致、语义无歧义（含四点顺序：返回即落地 → 独立 commit → 暂停至树净 → 恢复后 in-band 审；grep 五面同文 + 措辞核对）",
      "`templates/engine-config.json` argv `tasks` 通道（flag `--tasks` · type `int-list`）与 parse.ts 锁步（residue Row-9/10 守卫绿，validate 过）",
      "`pnpm run emit` 后 `emit:check` 无 drift；`pnpm run validate` 11 块全绿；本 spec 的 Parent program v1.30 版本行 lineage 合法；P4.3 行 Design-spec / Implementation plan 列随 phase 推进正确回填（backfill-overall，branch-review 前完成）",
      "`[In-flight]` 计划列状态合法（`isInflightText` · 无 reverse claim 义务 · 非 mismatch cell）；`[Pending]` → `[In-flight]` → `**Done**` 三态语义 + claim 只在 closeout 出现（engine 测试自造链 + P3.8 触发现场回归）",
      "Link 形态 plan cell 与 claim 双向等值（ownDesignToken 对齐：link 指向同一 plan 文档即等，弃逐字符严格相等）；子句 prose 提及 phase 不再整体作 claim 目标（诊断提示到位）",
      "overall.json 描述与 enforcement 三处同形（change-history 表头首格 `version` · issue-ref 合法枚举 · Phase 行 6 内容列；`documents.ts`↔schema 对拍断言）+ 三处报错附 `should look like:` 正确形态（bad/empty version · unrecognized issue ref · not a Phase-inventory id）+ 误导的 7 列提示移除",
      "`cdd schema get <type>`（type ∈ 四件：overall / plan / phase-spec / add-phase-protocol，对齐 `DOC_SCHEMA_NAMES` 全量）stdout 与 canonical schema 同字节（engine 测试断言）；未知 doc-type → usage exit 2 + 可用名枚举（= 该四件、与命令形枚举同源）；零执法逻辑（黑盒断言无校验面）；`cdd help` 功能不回归（cli/templates 两行保留 · `schemas:` 行零命中）",
      "writing-* read-schema 直取：三件 schema-bearing 技能（writing-overall-spec / writing-phase-spec / writing-plans）read-schema 节点改 `cdd schema get <type>`；writing-single-spec read-schema 显式 N/A（零 canonical 结构 schema）、无改。（grep：三件命中 `cdd schema get` · 零残留 `cdd help` 定位串——`cdd help` → `schemas:` directory 与 `cdd help` → `overall.json` / `phase-spec.json` / `plan.json`（read-schema 节点 + 节点外 role-note、pending-patch zone 全清））+ `pnpm run emit` 后 `emit:check` 无 drift",
      "Non-goal #1 双发现型修订落地（`cdd help` + `cdd schema get` 均零执法逻辑；其余零新增子命令不变，grep 断言）",
    ],
    constraints: [
      "Cross-phase 规则以 parent overall v1.30 为准（overall wins on conflict）：",
      "**允许破坏性变更**（charter 约束 bullet）：cdd-engine 0.1.0 基准，P4.2 1.0.0 首次稳定开版前为破口窗口；breaking 收进 P4.2 changelog",
      "判据三定式（C1 可达性 / C2 结构性 / C3 退化）适用于本 phase 一切处置判断",
      "四表纪律：回填 = branch-review 前置义务；结构性 mismatch → BLOCK",
      "语言政策：本 spec 中文主源（Strategy B 内部程序文档）；SKILL.md / docs 英文主源（Strategy A）——I4 文本重写为英文原文面",
      "`skills/` 是 **emit 输入面**：SKILL.md 改动后必须 `pnpm run emit` + `emit:check` 无 drift + 产物重生成（AC 已含）",
      "engine 直调：`node packages/cdd-engine/dist/cli.mjs`（dev:stub 材料化，不走 global register）；skills 调用 cdd **输出零过滤**（P3 裁决：禁 `tail`/`head`/`2>&1 |`/`EXIT=$?`）",
      "零产物 fixture：engine 测试不得以本仓产物为 fixture（P3 裁决）",
      "相续 phase 边界：P4.4 全面 OOP 化承接 TaskGroup 扩展；P4.2 发布面消费 `--tasks`/flow 修订完成态",
    ],
  },
  "2026-09-21-consumer-parity-p4.4-design.md": {
    acceptance: [
      "`pnpm outdated` 零落后（全树 latest）：execa 10.0.1 · typescript 7.0.2 · vitest 5.0.1 · @types/node 26.6.2 + 全树 caret floor 刷新实证；4 个 dependabot PR（execa / typescript / vitest / @types/node）已 closed（superseded by P4.4，gh 断言）；`pnpm install --frozen-lockfile` 绿（lockfile 与依赖面一致）",
      "4 major deps 破坏行为逐项实证登记（execa@10 API 破坏面 · vitest@5 迁移面 · TS@7 编译/类型行为 · @types/node@26 类型面——engine 测试绿 + dispatch 实证 + 登记 changelog）",
      "全面 OOP 化按「零纯函数模块」口径实证：域规则服务类全类化（convergence / failure / status / closeout / documents / parse 零独立纯函数导出模块，grep 断言）；判定标准六条 sweep 实证（零模块级裸函数导出 · 零模块级可变态 · 零裸标量 裸 Record 域接口穿行 · 零转发壳 / 零空壳 class —— sweep + 代码评审）",
      "`CddRuntime` 构造注入实证（dryRun / root / proc 状态 / exit signalling / memo 全收编；engine 测试注入替身绿）",
      '`TaskGroup` 类化：五个历史散点派生统一收进 `TaskGroup` 单源（`--tasks` 解析 · `effectiveGroups` · progress ledger key · handoff 文件名 · `TaskLifecycle#tasks/#groupKey`）——与 §2.2 类自身能力面五枚举（静态工厂 · dedup · 排序 · `key()` · 成员断言）互补，零 `number[]` / 裸串穿行（sweep）；**规范序列化 `#key()="1,2"` 单形（用户 2026-09-25 裁决：不用 `1-2`）**——六命名面（brief / implement·review·fix handoff / report / test-evidence）+ 契约 token 面 + roundPattern 扫描正则单源派生 + 描述/注释面全同步；`--tasks 1-2` 连字符形 exit 2 拒绝（双形歧义根除）',
      "CLI 长链迁入 lifecycle 类步骤（`runReview` / `runFix` / `buildCtx` 主体逻辑入类；`cli/*.ts` 退化为组合根——argv 解析 + 构造 + dispatch + 出口；无转发壳实证）",
      "progress / residue / handoff 载体类化（`ProgressLedger` 六 key + `rowFor/entryFor` 单源不变量 · `ResidueManager` 状态机 · `Handoff` typed 载体；schema 校验仍在 engine schema 面、无双实现实证）",
      "engine 导出函数面破坏性重排到位 + engine 测试套件随类化全绿（breaking 允许、无薄壳）；CLI argv 契约（`--tasks` / `--type` / `--plan` / `--findings`）不变——skills 与消费者调用面零回归（smoke 实证）",
      "scripts 侧同构实证：`Command` 类族 + `ValidateBlock` 类族落地；11 步名/序/`grepTargets`/`channelTargets` 域事实保持（`ci-validate.test.mjs` 断言全绿，或同域演化后对齐）；`run.test.ts` 命令树断言同域对齐",
      "biomejs 全面接入实证：biome.json 随仓发布（recommended）· husky pre-commit 触发 `biome check --write` 零违规通过（pre-commit 输出断言）· 覆盖 src + scripts + 全仓 ts 面（配置断言）",
      "`pnpm run validate` 11 块全绿；`emit:check` 无 drift；破坏面（OOP restructure + 4 major deps + review 三段结案状态词汇新值 `REVIEW_FIX` + Pending Acceptance Patch 移除——plan.json/skill-anatomy 节点删 · 标签约定出技能文本）登记 changelog，1.0.0 收口就绪；本 spec Parent program v1.42 版本行 lineage 合法；P4.4 Design-spec / Implementation plan 列随 phase 推进正确回填（backfill-overall，branch-review 前）",
      "review 状态词汇三值落地实证：S1 blocker 循环（现状回归）· S2 收口态（`REVIEW_FIX`）→ 复用现有 `cdd fix --findings` 一轮 → complete（无 re-review）· S3 零 finding fast path——engine 测试自造链 + 现场回归",
      "S2 fix 轮复用现有 `cdd fix --findings`、零 per-finding disposition 新机制、零 tag 路由（`targets later task` 标签约定已整体移除，见 §2.10；当前 task 有 findings 即修全）实证",
      "skills 五面 Review Convergence 文本改三段表述（writing-single-spec · writing-overall-spec · writing-phase-spec · writing-plans + cli-driven-development；`REVIEW_FIX` 同名入五面文本；emit 输入面，改后 `pnpm run emit` + `emit:check` 无 drift）；breaking = handoff `status` 词汇新值（`REVIEW_FIX`）登记 changelog、1.0.0 收口、历史终态不回滚",
      "Pending Acceptance Patch 移除实证（zone / `accepts pending-acceptance-patch` / `targets later task` / `## Pending Acceptance Patch` 条件节 heading 零活面 grep（frozen 豁免）· `plan.json` schema 无 `pendingAcceptancePatch` 节点 · `skill-anatomy` 注册表无该条件节 · cli-development 无 I6 且 I7 改指 Plan Sole Writer（mid-flight 路由语义）· writing-plans I3 改述落地（Plan Sole Writer 保留）· writing-plans / cli SKILL.md fix 节点 tag 句删 · engine tests 断言随删）",
      "跨 task 裁决直写 Do/验收实证（orchestrator 直写目标 task `**Do**` 与 `**验收**` 后 brief 逐字携带——行为入 Do · 验证入 验收）",
      "task groups 裁定迁移实证（writing-plans author-plan 内 tasks 写毕即**非交互**裁定分组落盘「Task Groups」节 + plan `taskGroups` 声明 · 无 AskUserQuestion · 零分组无节；cli-driven-development digraph 无 `adjudicate-task-groups` 节点 / 无 `task-groups-undecided` 终端 · `C → D` 直连 · **loop 节点更名 group-*（`implement-group` / `run-group-review` / `fix-group`）** · `{more-groups?}` 循环内保留 · 组列表自 plan 记录读取 · skill-anatomy growth 注册表不再携带 cli-driven-development 越界 rationale（移除后 13 节点/17 边落回边界内、注册条目删除）；两件 skill `pnpm run emit` 后 `emit:check` 无 drift）",
    ],
    constraints: [
      "Cross-phase 约定以 parent overall（v1.42）为准，conflict 时 overall wins（此处不重复）。本 phase 生效的整体约定：",
      "**允许破坏性变更**（charter bullet）：cdd-engine 0.1.0 基准，P4.2 1.0.0 首次稳定开版前为破口窗口；本 phase breaking（OOP restructure + 4 major deps + review 三段结案状态词汇新值 `REVIEW_FIX` + Pending Acceptance Patch 移除）登记 changelog、1.0.0 收口",
      "本仓文档合规判据面 = engine lifecycle（dispatch 运行时审计 + engine 套件），无 repo 侧 charter 守卫",
      "语言政策：spec/plan 中文（Strategy B）· SKILL.md / docs / README 英文主源",
      "不 commit 除非用户明确要求；spec/plan 交付除外（I2 立即提交）",
      "changeset 逐 phase 建；breaking 变更面归属清晰",
      "开发期引擎调用：`node packages/cdd-engine/dist/cli.mjs` 直调（`pnpm --filter @oscaner-skills/cdd-engine dev:stub` 后），不走 global register",
      "零新增执法子命令（charter Non-goal #1；唯一发现型 = `cdd schema get`）",
    ],
  },
  "2026-09-27-pi-harness-p1-design.md": {
    acceptance: [
      '`packages/osuperpowers/package.json` 含 `keywords: ["pi-package"]` 与 `pi: { skills: ["./skills"] }`（手维护源字段，emit 产物零变更）',
      "validate 增「osuperpowers pi-package well-formed」CheckBlock，`checkPiPackageWellFormed` 五组断言对当前树全过",
      "`packages/osuperpowers/tests/pi-package.test.mjs` 在 behavior glob 内通过（manifest 契约 + R0 不变式 pin）",
      "`pi-install-smoke.test.mjs` 通过：pack → 解包 → `pi install <dir> --local --approve` 退出 0 · 安装产物含恰 8 个 SKILL.md · 项目 `.pi/settings.json` 写入该包",
      "`ci-validate.test.mjs` 与 `pre-commit.test.ts` 以 name-set 断言 validate steps（11→12，含新 step），`pnpm run validate` 与 precommit 全绿",
      "`.github/workflows/release.yml` **不含** pi smoke 步骤（C6 已删于 v1.4；npm-source 解析风险 = 已知残余，P4 承接）",
      "`pnpm run validate` 全块全绿（新增守卫与测试在内）",
    ],
    constraints: [
      "跨 phase 约定以 parent overall v1.3 为准（overall wins on conflict），本 phase 不重复表述，仅指针：",
      "**D2 源侧手维护**：`pi` 字段与 `version`/`description`/`files` 同源，emit 产物面零新增（pi 无独立 manifest 文件）",
      "**D4 事实/规则**：`AI_AGENT=pi` 即宿主检测，检测链路归 P3；本 phase 零运行时扩展、零 peerDependencies",
      "**harness 命名统一**：`claude` / `cursor` / `pi`（`cursor-agent` 退役归 P3）",
      "**开发期引擎直调** `node packages/cdd-engine/dist/cli.mjs`；spec 中文（Strategy B）",
      "仓库 language policy / commit discipline / changeset 义务不因本 phase 变更",
    ],
  },
  "2026-09-27-pi-harness-p2-design.md": {
    acceptance: [
      '`packages/osuperpowers/package.json` 以 `oscaner` 键声明：`harnesses: ["claude","cursor","pi"]` + 插件级 `keywords` + claude `category`；`oscaner-plugin` / `harnessesNote` 零残留（历史豁免除外）',
      "`scripts/lib/harness-registry.ts` 交付：`Harness` 抽象 + `ClaudeHarness`/`CursorHarness`/`PiHarness` + `HarnessRegistry`（resolve 未知即 throw · assertBidirectional 双射）；`harness-registry.test.ts` 全过",
      "`source.ts` 删 `FIRST_PARTY_CURSOR`、经 registry 派生描述子；`marketplace/source.json` 字节与回填前一致（emit:check 零漂移）",
      "通用 emitter 落地：`PluginManifestEmitter`（`plugin-manifests.ts`）+ `all.ts` 零 name-dispatch；重 emit 后 `.claude-plugin/plugin.json` / `.cursor-plugin/plugin.json` 字节与既有一致",
      "`manifests.ts` keywords fallback 链删除；claude/cursor manifest keywords 同源于 `oscaner.keywords`",
      "validate block 6 一致守卫全绿（对活树实测三断言：声明⊆注册表 · 注册⊆声明并集 · emit-harness 产物存在）",
      "P1 pi-package well-formed 在 `PiHarness.validatePackage` 宿主下全绿（block 5b 薄代理；`pi-package.test.mjs` 原样通过）",
      "零残留：代码/文档/测试零 `oscaner-plugin`（CHANGELOG + 2026-09-13 family 历史豁免登记于 overall v1.9）",
      "commit 门：`.husky/pre-commit` 单行 `pnpm exec lint-staged` + `lint-staged.config.mjs`（`*.ts → biome check` **无 `--write`** · `* → pnpm run precommit`）；staged TS 带 format/lint violation 提交 → 拦截 fail 实证一次；`biome-wiring.test.ts` 重写全绿（pin no-fix + validate catch-all）；`pnpm run precommit` 门控保持全绿",
      "`pnpm run validate` 全块全绿（新守卫在内）；changeset 建（breaking——osuperpowers 按 version scheme 判定）",
    ],
    constraints: [
      "跨 phase 约定以 parent overall v1.9 为准（overall wins on conflict），本 phase 不重复表述，仅指针：",
      "**破坏性授权（2026-09-29，Constraints 登记）**：`oscaner-plugin` → `oscaner` key rename（发布面 breaking，changeset 记 breaking）+ `oscaner.harnesses` 全配送面语义 + P1 pi-package 守卫宿主迁移",
      "**Non-goal：注册表分层不破**——新注册表是 emit/脚本分发面产物，不合并 engine `harness-registry.json`（反向耦合破坏包边界）",
      "**Non-goal：source.json 面不扩 pi 条目**（它服务于 claude/cursor 两个 marketplace）——pi 描述子 undefined 即此语义的机器表达",
      '**D2 源侧手维护**：`pi` 字段 + 顶层 `keywords: ["pi-package"]` 与 `version`/`description`/`files` 同源；emit 产物面零新增 pi 文件（pi 的 manifest = 发布 package.json 的 `pi` 字段本体）',
      "**D4 检测链路归 P3**：本 phase 不触碰 engine 宿主检测面",
      "开发期引擎直调 `node packages/cdd-engine/dist/cli.mjs`；spec 中文（Strategy B）；changeset/commit 纪律不因本 phase 变更",
    ],
  },
  "2026-09-27-pi-harness-p3-design.md": {
    acceptance: [
      "`harness-registry.json` 行键集合断言恰 `{claude, cursor, pi}`（registry / infra.registry 测试 name-set，G1）",
      "`detectCurrentHarness` 表驱动测试全绿：cursor/claude-session/claude-AI_AGENT/pi/unknown + 优先级矩阵（CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT；pi = GENERIC 末位）",
      'pi 行 `invoke` = `"-p --mode text"`，cache = `{mechanism: "auto-prefix", minTokens: "pending", observable: false}`，过全行迭代 schema 校验（registry.cache.test）',
      "residue live 面守卫：engine src/tests + scripts + docs/maintainers 三面扫描 `cursor-agent` 零命中（唯一允许 = registry `cli` 数据值），validate 全绿——README 家族与 osuperpowers tests 残留面（`packages/osuperpowers/README.md:72` / `README.zh-CN.md:74` · `tests/helpers.mjs:16` · `tests/presentation-surface.test.mjs:274`）零化及纳入守卫随 P4 激活，P3 不承诺此二面归零",
      "`scripts/observe-cache.ts` + 测试使用 `cursor` 行键（零 `cursor-agent`）",
      "docs/maintainers 引擎 registry 行键镜像（`03-context-caching-doctrine.md` Baseline entries）改行键 `cursor` + pi 行，零 `cursor-agent`",
      "host-marker 白名单恰 4 键断言不变（`AI_AGENT`/`CLAUDE_CODE_SESSION_ID`/`CURSOR_TRACE_ID`/`PATH`）",
      "engine 测试套件（cdd-engine `pnpm test`）全绿，无回归",
      "**命令契约测试全绿**：`StatusDeriver` 判定轴/工作轮推导（review 三态 + implement/fix `COMPLETED`）· `NextStepRouter` C5 决策表 instance-method 等价（next-step.test 迁移后全绿）· `ResultFace` 单胶囊 shape 钉死（result-face.test.ts）——review 输出判定轴 + 自身 findings blocker；implement 输出工作轮 COMPLETED + `blocker: 0`（无判定源）；fix 输出工作轮 + 源-review blocker 计数；task/docs 两族同形",
      "**Contract Lexicon 守卫全绿**：`contract-lexicon.json` 五域词表存在且与引擎事实一致（单词表 = 单一事实源）· `ContractLexiconGuard` 四检查（checkAnatomy/checkResidue/checkWording/checkConfig）在 validate 单 block 下全绿 · 三先例 test 入口收敛后无回归（digraph-consistency/residue.test/context.test 断言经 guard 同源通过）",
      "**消费面措辞同步**：`cli-driven-development/SKILL.md` 零引擎形状 restate（`3-line return block` / `4th line counters` 类字面量清零），仅锚路由 token（`next:`/`CDD_BLOCKED:`/handoff `findings`）；`contract-wording` 检查零命中",
      "**运维文档 + CLAUDE.md 同步落地**：docs/maintainers 全家族（01/02/03/04）与契约面/词表一致、行键镜像零 cursor-agent · 根 CLAUDE.md emit/validate 描述随 Contract Lexicon 单 block 与 C5 单胶囊更新 · `pnpm run emit` + `emit:check` 零漂移（skill 文本变化后重新 emit）",
      "**T7 崩溃恢复全绿**：failureCategories 含 `HARNESS_ABORT`（harnessAbortCount / harness-abort terminal）· NextStepRouter 决策表含 recovery 行（BLOCKED + crashRecord → 同命令 resume `next:`，next-step.test 钉死）· teardown 集成测试（模拟 child exit 1 无 handoff → child tail 保留 + crash-only snapshot + crash record 落 `Workspace.crashPath` + BLOCKED capsule 带 next:）· commitSnapshot 行为测试（树干净 no-op / `--no-verify` 语义）· **stash 平面零残留**（grep `stash apply`/`recovery.residue_ref`/「git stash drop」零命中，含 SKILL/maintainers/CLAUDE.md 措辞）· `pnpm run validate` 全绿 + precommit 面绿",
      "**T8 统一终止模型全绿**：teardown 触发谓词 = **任意 exit gate 前终止**——over-budget/timeout 与 child-exit/child-signal **同一实现路径**（teardown 矩阵测试：四类终止模拟 → 同路 snapshot + crash record（含 `cause`）+ BLOCKED capsule next 同命令 resume，非并行第二套）· crash record 含 `cause`（child-exit/child-signal/engine-over-budget/engine-timeout/unknown）且行为零分叉 · crash record 三方统一（teardown 写 / resume 读 / reapStale 枚举 stale crash records，`WorkspaceRoot.enumerate()` 复用）· `recovery.residue_ref` / 旧独立 recovery 持久化面零残留（grep 零命中 + channel-audit 计数断言）· resume 软帽：3 次 → `BLOCKED: crash-recovery-cap` 用户裁决，FailureResolver 类别 cap 面不动 · `pnpm run validate` 全绿 + precommit 面绿",
      '**T9 预算维度统一全绿**：`timeouts.defaults` = `{implement: 21600000, review: 10800000, fix: 21600000}` 且**无 `task` key**（config 读断言 + grep 兜底）· 三岛接线断言全绿（7 op 组合 spawn 传出 budget = 对应 op 默认值——task.implement 6h / task.review 3h / task.fix 6h / branch.review 3h / branch.fix 6h / docs.review 3h / docs.fix 6h）· resolver 单测迁完（`"task"` budget 断言零残留）· `DispatchOp` union 编译期禁 `"unknown"`（unknown 防御语义保留为 config 缺 key fail-safe）· `pnpm run validate` 全绿 + precommit 面绿',
    ],
    constraints: [
      "跨 phase 约定以 parent overall v1.13 为准（overall wins on conflict），本 phase 不重复表述，仅指针：",
      "**P3 破坏性变更授权（2026-09-29，Constraints 登记）**：engine 数据面可重写代码 / 重整文件——约束 = 高维思考 / 抽象统一（OOP）/ 最佳实践 / 零技术债务",
      "**命令契约面授权（2026-09-29，v1.13 Constraints 登记）**：implement/review/fix 语义双轴分离（判定轴 review 独占 / 工作轮 implement·fix 打 `COMPLETED`）· `blocker:` 判定源计数 · 全 op 单胶囊 stdout 面 · Contract Lexicon 机制（contract-lexicon.json 单词表 + `ContractLexiconGuard` OOP 守卫）· 消费面（orchestrator skills）零引擎形状 restate · 运维文档 + CLAUDE.md 同步交付",
      "**豁免概念废除**：守卫扫 live 面（engine src/tests + scripts + docs/maintainers + README 家族 + osuperpowers tests）零 `cursor-agent`，唯一允许命中 = registry `cli` 数据值；历史正文（2026-09-13 family / change-history 行）即史实，不 retro-rename、无豁免机制。**P3 分期实施**：守卫扫面率先落三面（engine src/tests + scripts + docs/maintainers，本 phase 可归零面），README 家族与 osuperpowers tests 随 P4 文档统一验收纳入——program 终态五面归零定律不破（见 G2/C3/§4）",
      "**CLI 二进制名不可改**（外部事实）：`cli` 字段保留 `claude` / `cursor-agent` / `pi`；名义映射表（标识符 ↔ 二进制 ↔ 宿主 marker）P4 落 README 渲染",
      "**Non-goal：注册表分层不破**——本 phase 的 engine registry（spawn 契约面）与 emit 分发注册表 `scripts/lib/harness-registry.ts`（分发 manifest 面）不合并（P2 定案延续）",
      '**host-marker 白名单恰 4 键不变**：`channels.env.hostHarness.markers` = `["AI_AGENT","CLAUDE_CODE_SESSION_ID","CURSOR_TRACE_ID"]` + `PATH`（engine-config.json:80-87，`context.test.ts:36` 钉死）——pi 检测复用 `AI_AGENT` 通道，零新键',
      "开发期引擎直调 `node packages/cdd-engine/dist/cli.mjs`；spec/plans 中文（Strategy B）；changeset/commit 纪律不因本 phase 变更",
    ],
  },
  "2026-09-27-pi-harness-p4-design.md": {
    acceptance: [
      "`packages/kairos/skills/`（目录迁移后）下 8 目录重命名（`brainstorming/`→`cdd-design/` 等），各 `SKILL.md` `name:` == 目录名 == cdd-* 八名集合（`cdd-design` / `cdd-spec` / `cdd-charter` / `cdd-phase` / `cdd-plan` / `cdd-dev` / `cdd-close` / `cdd-report`），目录/字段双钉死守卫生；flow 内 `/kairos:*` 互引同步为新名，上游 import（`/superpowers:*` / `/mattpocock-skills:*`）不变；全仓 grep 零旧目录/旧名 skill 路径引用与字面量（含 test 文件名内嵌旧名——`writing-plans-spec.test.mjs` → `cdd-plan-spec.test.mjs` 等；历史正文除外）",
      "两目录 `git mv` 迁移完成（`packages/osuperpowers/` → `packages/kairos/` · `docs/osuperpowers/` → `docs/kairos/`）＋ engine workspace 根 `.osuperpowers` → `.kairos`（engine-config workspaceRoot 单源值改迁 + 三面同步，存量磁盘态惰性不动）——零迁移机制、零存量处理；live 面零 `osuperpowers`（历史正文即史实不 retro-rename）",
      "`.claude-plugin/` / `.cursor-plugin/` / `marketplace/` emit 产物重生成（插件名/contentRoot/source 等 token 随包身份改；产物 skills 引用 = `./skills/` glob、不逐目录列举）后 `emit:check` 零漂移",
      "文档标识符面（README 家族 + CLAUDE.md + docs/maintainers live 档）零 `cursor-agent`（豁免锚已废，历史正文即史实）",
      "名义映射表 = 数据渲染：README 表与 lexicon markers / registry 数据一致（presentation-surface 漂移守卫绿）；`checkMarkers` 三方一致（markers ↔ detect() ↔ engine-config）绿",
      "D5 消费故事交付：README 含 cdd-* 零冲突 by-construction 说明 + inline import harness 条件化语义（claude/cursor 限定引用恒落属主包 · pi 纯 bare name 唯一）",
      "`presentation-surface.test.mjs` / `pi-package.test.mjs` / `contract-lexicon.test.ts` 三文件 pin 全绿（verified triple + 技能清单 == 目录扫描 + markers 三方 + 名义表漂移；外国声称禁令保留）",
      "双镜像同步：root + kairos 各 zh 结构 parallel + 镜像声明时间戳校准",
      "`pnpm run precommit` 与 `pnpm run validate` 全块全绿（零新 validate step；ci-validate 编排断言零新 step，assertion-set 随 token 扫改名）",
      "kairos changeset（major）+ cdd-engine changeset（patch）已建（pending manifest-pin 包字段重定向 `@oscaner-skills/kairos`）；CHANGELOG 记录由 Version PR 流程承接",
      "P4 closeout 时四表回填一致（phase spec / plan 列 → Done，change-history v1.22+ 行）",
      '**engine 静态数据面重组（v1.5 增）**：`config/` 落位（读作数据全归位——engine-config / harness-contract / contract-lexicon / template-contract + `schema/` 子目全部 JSON Schema：doc 5 / handoff 2 / cache-profile）且 `templates/` 仅含内容种子（issue-body.json）；`resolveResource()` = 唯一路径真相——engine 六消费面零散落 `path.join(pkgRoot, "…")` 硬编码、smoke-cdd / residue / contract-lexicon pin 全从 locator 数据派生、dev 树 ↔ dist 打包树 `config/` 同构（旧 `dist/resources` 零残留）；`package.json#files` 随发 config；engine/scripts 测试 + precommit 全绿（T6 终验兜）',
      "**harness 契约收敛（v1.6 增）**：registry = 唯一 harness 契约（行含 detect/install/refs · prefix 零字面改派生 · cli 单源）；lexicon 纯词表（harness 域零残留）；`checkHarness` 四向全绿（detect ↔ 谓词 ↔ 白名单 · refs ↔ SKILL 文本 26 处双形态 · prefix 派生 ↔ 注入 · install ↔ README 渲染）；SKILL 文本引用全双形态 + 零裸 `/ns:name` 残留（pin）；README 上游依赖表 = install/refs 数据渲染零手写（用户提供命令只此一份）；T3/T4/T5 交付面 re-anchor 全绿（presentation-surface 名义表数据源 lexicon→registry · checkMarkers 家换）；`cdd init` 就绪（未来 phase 消费同一契约）",
    ],
    constraints: [
      "跨 phase 约定以 parent overall v1.22 为准（overall wins on conflict），本 phase 不重复表述，仅指针：",
      "**P4 破坏性变更授权**（Constraints v1.22）：技能全量改名 `cdd-*`——8 skills 三 harness breaking（changeset 记 major）· **命名全面退役 `osuperpowers` → `kairos`**：插件包 `@oscaner-skills/kairos` / namespace `/kairos:` / workspace 根 `.kairos`（engine-config 单源）/ 程序文档树 `docs/kairos/` —— `cdd`·`cdd-engine`·CLI 保留（方法论层）；**零存量迁移**（实现当时 `git mv` 直迁，不建迁移机制）· 允许破坏性变更 / 重写代码 / 重组目录 · 约束 = 高维思考 / 抽象统一 / 最佳实践 / 零技术债务",
      "**D5 事实（复核于 2026-10-01）**：pi 对同名 skill 按确定性 first-wins 处置（从不拒绝；败者静默丢弃 + warning）；**pi 无命名空间修饰技能引用**（仅 `/skill:<bare-name>`）→ 改名理由 = flat-namespace 下 bare-name 唯一性最佳实践，非「pi 不许同名」",
      "**D2 / D4**：`pi` 字段源侧手维护 · `AI_AGENT=pi` 宿主检测（P3 已闭环，本 phase 不动 engine 运行面）",
      "**命名机制授权**：SKILL.md `name` = 单一事实源 + 目录扫描守卫（README / 测试派生断言零手写名单）；不建镜像注册面",
      "**分层纪律**：技能名 = kairos 包面（不归 engine lexicon）；harness markers = engine 语义（归 lexicon harness 域）——两域分居，Non-goal #2 不可破",
      "**消费面纯度**：SKILL.md 是零程序历史指令文档；改名 rationale / 决策历史只落本 spec 与 docs/maintainers，不进消费面",
      "仓库 language policy / commit discipline / changeset 义务不因本 phase 变更",
    ],
  },
  "2026-09-27-pi-harness-p5-design.md": {
    acceptance: [
      "`pnpm run typecheck`（engine + scripts + kairos-tests 三项目）exit 0：engine 787→0、scripts 零错、kairos-tests 零错",
      "validate 与 precommit 均含 `type-check` 块且全绿（双接点）",
      "全仓源面零 `.mjs`（residue 守卫绿，产物面除外）；`packages/kairos/tests`、`scripts/emit`、vitest/lint-staged configs 全 `.ts`",
      "零构建删除面 **live 面** grep 零命中：`build.config` / `dev:stub` / `@typescript/typescript6` / `globalSetup` / `@ts-ignore` / `@ts-expect-error`（live 面 = CLAUDE.md · `docs/maintainers/05` · engine README 对 · 源面/config 面；历史 spec/plan 正文与发布面 schema/产物除外）",
      "`tsc --emit` 发布面：`pnpm pack` → 临时项目 `npm install` → `.bin/cdd` 执行成功（`--help` exit 0，走真实引擎栈）",
      "CLAUDE.md + engine README 对（EN/zh）dev 链均 = `node packages/cdd-engine/src/bin.ts`、零 `dev:stub`/`dist/cli.mjs` 引用；`docs/maintainers/05` unbuild 登记 retired（被禁 token 一律转述，非原文）",
      'buildability 双证据：`reviews.task/branch.lensEnum` 含 `"buildability"`（REVIEW_LENS_GUIDE 自动派生）且 axesGuide 含 buildability 双证据文句（`templates.test.ts`/`registry.test.ts` 断言绿）；implement evidence 扩 `typecheck` 项且 engine 读回机检（缺 → BLOCKED 测试绿）',
      "review `next:` fix 建议附 `(read <handoff> back to confirm)` 说明（C5 `NextStepRouter` next-line 生成 + result-face/next-step 测试断言绿）——user 2026-10-02 mid-flight",
      '三项目零错成立前提落地：`packages/kairos/package.json` 含 `"type": "module"`（ESM 检测前置；2.1/2.3 联动）',
      "engine vitest 黑盒 exec 全指 `src/bin.ts`（live 面 `dist/cli.mjs` 引用零命中，发布面 schema/产物除外）",
      "`pnpm run validate` 全绿",
    ],
    constraints: [
      "Cross-phase 约定属 parent overall，本 spec 不复述（overall wins on conflict）。引用要点：",
      "**P5 破坏性变更授权**（overall Constraints v1.27 登记，2026-10-02 用户拍板）：允许破坏性变更 / 重写代码 / 重组目录；约束 = 高维思考 / OOP 抽象统一 / 最佳实践 / **零技术债务 + 死壳即删**",
      "事实定稿（v1.27 Constraints）：Node `node_modules` 下类型剥离永久禁止（发布必 JS）· Node ≥22.18 strip 默认（dev 零构建）· `typescript@7` 单工具兼判官 + 发射",
      "不 commit 除非用户明确要求；spec 交付除外（I2 立即提交）· changeset 逐 phase 建",
    ],
  },
  "2026-10-02-doc-architecture-v2-p1-design.md": {
    acceptance: [
      "`src/documents/` 交付：`abstract DocType`（五域字段 + route + 抽象 validate/parse + detect 骨架）+ `PhaseSpecDocType`/`PlanDocType`/`OverallDocType` 三子类 + `DocTypeRegistry`（三实例可构造 · `resolve` 未知即 throw）+ `SchemaFactory`（A1 落地）",
      "A3 收敛（8 散点全口径）：散点 S1–S7 面（docKindOf / validateDispatchDocuments 入口 / parentOverallOf 链 / CLI review+fix `--type` / resolveTargetDoc / next-step 建议表 / render 家判别）**零 per-type 手写分支**——grep 实证仅经注册表调度；DocumentsValidator 中 per-type 私有裸函数收编为子类实例方法（Criterion ② 类面无裸函数）；S8 = `deriveDocTokens` live 派生语义经 `DocType.shape` 域访问器承载（path 导航保留，tokens.test 等价回归全绿）",
      "`SchemaFactory` 渲染产物与回填前 `config/schema/{phase-spec,plan,overall}.json` **字节一致**（diff 钉测试 ×3 全绿）",
      "`config/contract-lexicon.json` 派生等价（字节断言绿）；`infra/word-table.ts` 零改动、WordTable 构造自校验仍绿",
      "template-contract 分型面迁入后 `TemplateLoader` 渲染输出等价（templates 测试全绿）；`config/template-contract.json` reviews 块迁出、shell/tokens/clauses 保留",
      "`pnpm run validate` 全块全绿（新守卫在内）；residue/lexicon guard 零回归（A4）",
      "死牵引零残留：CLAUDE.md 与 `src/documents/tokens.ts` 注释引 `config/schema/`（零 `src/documents/schema/` 引用）；`ex lib/` 残留注释清理",
      "超纲线零越界：add-phase-protocol / skill-anatomy 手写 JSON 原样保留 + schema.test 全绿（Q6 显式列守）；P2/P3/P5 内容（样板 / TaskGraph / DispatchContract 正文）零实现",
    ],
    constraints: [
      "跨 phase 约定以 parent overall v1.2 为准（overall wins on conflict），本 phase 不重复表述，仅指针：",
      "**破坏性变更授权 + 空壳死代码即删（overall Constraints，2026-10-02 用户拍板）**：允许重写代码 / 重组目录；空壳、死代码、已废面即删不留残壳",
      "**Criterion ②（零裸函数）延续**：所有新抽象以类 + 构造注入落地；本 phase 的收敛落点 = DocumentsValidator 等模块中 per-type 私有裸函数收编为 DocType 子类实例方法",
      "**对象 word = ref word（DocContract 同契约面）**：doc 身份、ref 身份、技能引用、正文视图同一契约面，零手写重复映射",
      "**尽量复用上游规则（fit 判定）**：本 phase 收编的是文档内容组织平面，非上游方法论平面；不引上游 skill",
      "**消费者链渐进兼容 + 历史零 retro-rename**：schema 产物路径零迁移（`config/schema/` 原位），消费者（`deriveDocTokens` / `cdd schema get` / `DocumentValidator` 审计 / scripts `ContractLexiconGuard`）零回归",
      "方法论文档 = 中文（Strategy B）；消费面 skill 文本 = 英文主源（Strategy A）——本 phase 产出全部为引擎内部面，无消费面文本",
      "开发期引擎直调 `node packages/cdd-engine/src/bin.ts`（零构建 dev face）；changeset/commit 纪律不因本 phase 变更",
      "**开线 GATE（overall Boundary rules）**：本整体批准 ≠ P1 已启动——pi-harness P5 必须先 closeout、任一 phase 才能开线，P1 启动即该 GATE 生效点（「Depends on: 无」仅指 phase 依赖结构，非即刻可启动）",
    ],
  },
  "2026-10-02-doc-architecture-v2-p2-design.md": {
    acceptance: [
      "新 phase-spec 骨架被 docContractValidate 接受：元数据头五元（`**Version**` 行在位——detect 特征 / backfill-as-version / R2 versionToken 锚）+ 三真骨架（`## Design` 含唯一 `### Acceptance criteria` · `## Constraints`）fixture 绿；条件段正反例 fixture（condition=true 落盘 / condition=false 零残留段）断言通过（零残留段 = 段落存在性断言、机器可达；「语义性 condition 为假却落段 → fail」不机器判，schema 只断言结构性后果）",
      "plan Task 数据化：`Task{objective, files[], interface{consumes,produces}, steps[]{action,checkable}, acceptance[], dependsOn?, atomicWith?}` fixture parse 全绿（`dependsOn?`/`atomicWith?` = P3 扩展位字段面、零消费）；brief/task-handoff = Task 数据渲染零散文雕刻（新形 fixture 零 `- **Do**:` 面）",
      "step checkable 类型约束：缺 checkable 的 steps fixture 断言 fail（schema 校验）",
      "约束继承 delta-only（plan / phase-spec 双侧）：新 plan `## Constraints` 仅 delta + plan-parse 读整体约束 + delta 合并断言（宪法 auto-applies）+ 新 doc Form B 禁断言；新 phase-spec `## Constraints` 同规 delta-only + spec-parse 沿 Parent program 读父整体约束 + delta 合并呈现断言（继承点指针目标解析）；legacy Form B / 旧六段双读保持",
      "shape 域投影重派生：DocBody.projectSchemaShape() → DocType.shape → SchemaFactory，`config/schema/{phase-spec,plan}.json` 为派生产物；diff 钉 deliberate update 登记（新 golden 断言 · 字节保真渲染面保持）· deriveDocTokens 续接 DocType.shape（P1 T7 live 派生面不变；DOC_TOKENS 生产值随 shape 域内容变更以 deliberate update 重 pin，token 面变动由 tokens.test 钉断言）",
      "双读契约：legacy 六段 spec / Form B plan fixture 仍过 validate + parse；既有 18 design + 19 plan 文档树零改动（validate 全绿）",
      "DOC_TOKENS / 词表续接 DocType.shape（P1 T7 live 派生不变；shape 域内容随投影更新 → 重 pin + deliberate update 登记 · validate 全绿）",
      "bodyView 评审轴同步：plan decomposition 轴引用 `interface{consumes,produces}` 新字段（body-views.ts 更新 + 断言）",
      "P2 自身 spec/plan 按当前规范形（Section 0–5 / Form A）写成且过 doc-contract validate（评审 gate 绿）",
      "skill 连带：cdd-spec / cdd-phase SKILL.md 骨架指导语同步新骨架（English-primary）；skill-anatomy registry 新段登记同步（validate 全绿）",
      "零越界执行：P3 边模型 / P5 DispatchPacket join / P4 acceptance 机械化面零实现（代码面零 `depends_on`/`atomic_with` 新增消费——`dependsOn?`/`atomicWith?` 仅字段面声明、零读写）",
      "`pnpm run validate` 全块全绿（新守卫在内）· typecheck 三项目绿 · biome clean · emit 新鲜 · changesets（cdd-engine + kairos 视文案变面）",
    ],
    constraints: [
      "跨 phase 约定以 parent overall v1.3 为准（overall wins on conflict），本 phase 不重复表述，仅指针：",
      "**破坏性变更授权 + 空壳死代码即删（overall Constraints，2026-10-02 拍板；2026-10-05 P2 会话复确）**：允许重写代码 / 重组目录——约束 = 高维思考 / 抽象统一（OOP）/ 确保最佳实践 / 零技术债务；空壳、死代码、已废面即删不留残壳",
      "**Criterion ②（零裸函数）延续**：所有新抽象（`DocBody` 类族 / `Task` 模型）以类 + 构造注入落地；本 phase 的收敛落点 = 手写同构 SchemaShape 常量与散装解析切片收编为 DocBody 实例方法/投影",
      "**对象 word = ref word（DocContract 同契约面）**：`Task.files/interface` 字段类型化即 P5 DispatchPacket 的同源字段（零手写重复映射）；token 面（DOC_TOKENS / 词表）随 shape 变更重 pin",
      "**尽量复用上游规则（fit 判定）**：文档结构平面无上游 fit（cdd-doc-review 一产化先例 M4b 不动），不引 upstream skill",
      "**消费者链渐进兼容 + 历史零 retro-rename**：doc 文件路径面零触碰（`docs/kairos/specs|plans/*` 文件名契约与 detect 特征不动）；legacy 六段 / Form B 双读保持；既有 18 design + 19 plan 文档树零改动",
      "方法论文档 = 中文（Strategy B 内部 docs）；消费面 skill 文本 = 英文主源（Strategy A）——本 phase 的 SKILL.md 骨架指导语随新骨架同步（English）",
      "开发期引擎直调 `node packages/cdd-engine/src/bin.ts`（零构建 dev face）；`fnm use`（.nvmrc）；引擎零 `.mjs` 平面 + 测试 colocated vitest；三项目 typecheck 绿；changeset/commit 纪律不变",
    ],
  },
};

const validator = new DocumentsValidator();
const planType = (): PlanDocType => docTypeRegistry.resolve("plan") as PlanDocType;
const specType = () => docTypeRegistry.resolve("spec");
const overallType = () => docTypeRegistry.resolve("overall");

/** The shell-agnostic canonical form of a content line — strips the bullet / checkbox / blockquote
 *  shells the transcription legitimately re-flagged (`- ` / `- [ ] ` / `> `) so the verbatim pin
 *  compares the CONTENT tokens, never the shell. Both the pinned original and the migrated section
 *  body run through this, one shared atom. */
function canonLine(l: string): string {
  let t = l.trim();
  if (t.startsWith("> ")) t = t.slice(2);
  while (t.startsWith("- ")) t = t.slice(2);
  return t.trim();
}

/** The non-empty canon'd body lines of a section — from the section heading to the next `## `
 *  heading / `---` rule (the same structural boundary the shared Form-A extraction reads). */
function sectionBody(content: string, headingRe: RegExp): string[] {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^## /.test(t)) break;
    if (t === "" || t === "---") continue;
    out.push(canonLine(lines[i]));
  }
  return out;
}

describe("迁移队列期望态 — the single-form tree's migration state table (T8 terminal)", () => {
  it("the walk set is the full tree: 50 files = 23 plan + 22 design + 4 overall + 1 one-off; the 49 validation files are declared canonical with zero exclusions", () => {
    const plans = readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"));
    const designs = readdirSync(SPECS_DIR).filter((f) => f.endsWith("-design.md"));
    const overalls = readdirSync(SPECS_DIR).filter((f) => f.endsWith("-overall.md"));
    const oneOffs = readdirSync(SPECS_DIR).filter(
      (f) => f.endsWith(".md") && !f.endsWith("-design.md") && !f.endsWith("-overall.md"),
    );
    expect(plans).toHaveLength(23);
    expect(designs).toHaveLength(22);
    expect(overalls).toHaveLength(4);
    expect(oneOffs).toEqual([ONE_OFF]);
    // validation files = the walk set minus the one-off tolerance (49 = 23 + 22 + 4); every
    // validation file is declared on the migration tables — a missing row breaks the
    // zero-exclusion coverage claim (no file is walked around).
    expect(plans.length + designs.length + overalls.length).toBe(49);
    for (const f of plans)
      expect(PLAN_MIGRATION[f], `${f} missing from PLAN_MIGRATION`).toBeDefined();
    for (const f of designs)
      expect(SPEC_MIGRATION[f], `${f} missing from SPEC_MIGRATION`).toBeDefined();
    // The 37 migrated objects (20 migrated specs + 17 migrated plans) and the p3 + p3.1
    // zero-migration pairs are FULLY canonical in the T8 terminal state — every validation file is
    // single-form green and the queue holds zero pending-migration documents.
    expect(SPEC_MIGRATION["2026-10-02-doc-architecture-v2-p3-design.md"]).toBe("canonical");
    expect(PLAN_MIGRATION["2026-10-02-doc-architecture-v2-p3.md"]).toBe("canonical");
    expect(SPEC_MIGRATION["2026-10-02-doc-architecture-v2-p3.1-design.md"]).toBe("canonical");
    expect(PLAN_MIGRATION["2026-10-02-doc-architecture-v2-p3.1.md"]).toBe("canonical");
    expect(Object.values(PLAN_MIGRATION).filter((s) => s === "canonical")).toHaveLength(23);
    expect(Object.values(SPEC_MIGRATION).filter((s) => s === "canonical")).toHaveLength(22);
    // Every canonical plan + spec (the 37 migrated + the p3/p3.1 zero-migration pairs) validates zero
    // plan/spec-owned failures — the validate surfaces pin the per-file green baseline.
    for (const f of plans) {
      if (PLAN_MIGRATION[f] !== "canonical") continue;
      expect(
        planType()
          .validate(path.join(PLANS_DIR, f), { root: REPO_ROOT })
          .filter((x) => x.file === path.join(PLANS_DIR, f)),
        `${f} plan-owned validate failure`,
      ).toEqual([]);
    }
    for (const f of designs) {
      if (SPEC_MIGRATION[f] !== "canonical") continue;
      expect(
        specType()
          .validate(path.join(SPECS_DIR, f), { root: REPO_ROOT })
          .filter((x) => x.file === path.join(SPECS_DIR, f)),
        `${f} spec-owned validate failure`,
      ).toEqual([]);
    }
  });

  it("the rule plane walks the whole 49-file validation tree — structureFindings(kind, content) = 0 (the tree's structural judgments are the body rule set, never a self-written walk; P3.1 T2 step 4)", () => {
    const plans = readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"));
    const designs = readdirSync(SPECS_DIR).filter((f) => f.endsWith("-design.md"));
    const overalls = readdirSync(SPECS_DIR).filter((f) => f.endsWith("-overall.md"));
    expect(plans.length + designs.length + overalls.length).toBe(49);
    for (const file of plans) {
      expect(
        validator.structureFindings("plan", readFileSync(path.join(PLANS_DIR, file), "utf8")),
        `${file} plan structure findings`,
      ).toEqual([]);
    }
    for (const file of designs) {
      expect(
        validator.structureFindings("spec", readFileSync(path.join(SPECS_DIR, file), "utf8")),
        `${file} spec structure findings`,
      ).toEqual([]);
    }
    for (const file of overalls) {
      expect(
        validator.structureFindings("overall", readFileSync(path.join(SPECS_DIR, file), "utf8")),
        `${file} overall structure findings`,
      ).toEqual([]);
    }
  });

  it("the zero-migration canonical pairs validate clean (the p3 + p3.1 plans and designs)", () => {
    for (const f of [
      "2026-10-02-doc-architecture-v2-p3.md",
      "2026-10-02-doc-architecture-v2-p3.1.md",
    ]) {
      expect(
        planType().validate(path.join(PLANS_DIR, f), {
          root: REPO_ROOT,
        }),
      ).toEqual([]);
    }
    for (const f of [
      "2026-10-02-doc-architecture-v2-p3-design.md",
      "2026-10-02-doc-architecture-v2-p3.1-design.md",
    ]) {
      expect(
        specType().validate(path.join(SPECS_DIR, f), {
          root: REPO_ROOT,
        }),
      ).toEqual([]);
    }
  });

  it("the migration queue is closed — zero pending-migration documents remain (plan + spec families, the T8 terminal state)", () => {
    expect(Object.values(PLAN_MIGRATION).some((s) => s === "pending")).toBe(false);
    expect(Object.values(SPEC_MIGRATION).some((s) => s === "pending")).toBe(false);
  });
});

/** The migration-queue pins fixture — the plan family's shared pin source: per migrated plan, the
 *  pre-transcription acceptance (per task number) + the constraints body (canon'd) + the
 *  dispatch-group expectations of the 4 ## Task Groups plans. For the 17 Do-form targets it carries
 *  the verbatim acceptance + constraints pins; for the 4 prose-period targets, the constraints-only
 *  pins (their acceptance is asserted as a derived product by the prose-period describe, never a
 *  verbatim pin — the source carried no acceptance text). It is DATA (a JSON fixture under the
 *  scanned tree), so the guard-release site (isPlanPinDataFile) releases it wholesale — the frozen
 *  legacy vocabulary the pins carry is history, never a live-code regression (the guard sites spell
 *  the released tokens without carrying them in this body). */
const PLAN_PINS = JSON.parse(
  readFileSync(path.join(HERE, "fixtures", "plan-migration-pins.json"), "utf8"),
) as {
  acceptance: Readonly<Record<string, Readonly<Record<number, readonly string[]>>>>;
  constraints: Readonly<Record<string, readonly string[]>>;
  groups: Readonly<Record<string, readonly (readonly number[])[]>>;
};

// The double-layer migration pins (P3.1 T4 — the 22 design specs' design-body heading sequence:
// the `### N.` group heading + every `#### N.M` item, in document order, EXACT). Pins the count
// (171 migrated items + one group per migrated file + the p3.1 zero-migration pair's already-ranked
// groups/items), the group numbers, the item ownership (each item's N is its group's), and the
// title text verbatim (a title-edit breaks this pin). It is a JSON fixture under the scanned tree,
// like PLAN_PINS — DATA, released wholesale at the guard-release sites.
const SPEC_DOUBLE_LAYER_PINS = JSON.parse(
  readFileSync(path.join(HERE, "fixtures", "spec-double-layer-pins.json"), "utf8"),
) as Readonly<Record<string, readonly string[]>>;

describe("the migrated plan-Do family — 17 data-shaped plans (内容保真 transcription, T6)", () => {
  // The Do-form family's migrated canonical plans — every PLAN_MIGRATION row flipped pending →
  // canonical at T6 (all but the p3 zero-migration plan, which was already canonical), EXCLUDING
  // the 4 prose-period plans (their assertions live in the prose-period describe below) and the
  // p3.1 zero-migration plan (this program's own — never a migration target).
  const MIGRATED_PLANS = Object.keys(PLAN_MIGRATION).filter(
    (f) =>
      f !== "2026-10-02-doc-architecture-v2-p3.md" &&
      f !== "2026-10-02-doc-architecture-v2-p3.1.md" &&
      !PROSE_PERIOD_PLANS.includes(f) &&
      PLAN_MIGRATION[f] === "canonical",
  );

  it("every migrated plan keeps contiguous 1..N task numbering (the numbers verbatim)", () => {
    for (const file of MIGRATED_PLANS) {
      const planPath = path.join(PLANS_DIR, file);
      const nums = planType().taskNumbersFromPlan(planPath);
      const max = Math.max(...nums, 0);
      expect(nums, file).toEqual(Array.from({ length: max }, (_, i) => i + 1));
    }
  });

  it("acceptance is token-verbatim under the `- **Acceptance**:` data field — the parsed per-task acceptance equals the pinned pre-transcription text", () => {
    for (const file of MIGRATED_PLANS) {
      const planPath = path.join(PLANS_DIR, file);
      const tasks = planType().tasksFromPlan(planPath);
      for (let i = 0; i < tasks.length; i++) {
        const n = i + 1;
        expect(tasks[i]!.acceptance, `${file} task ${n} acceptance`).toEqual(
          PLAN_PINS.acceptance[file]![n] ?? [],
        );
      }
    }
  });

  it("constraints text is verbatim under ## Constraints (re-shelled — ### 口径 / prose)", () => {
    for (const file of MIGRATED_PLANS) {
      const content = readFileSync(path.join(PLANS_DIR, file), "utf8");
      expect(constraintsBody(content), file).toEqual(PLAN_PINS.constraints[file]);
    }
  });

  it("single-form docContractValidate green — zero plan-owned failures; the chain carries EXACTLY the resolved spec's own validate output (the documented residue, never a transcription-introduced failure)", () => {
    for (const file of MIGRATED_PLANS) {
      const planPath = path.join(PLANS_DIR, file);
      const failures = planType().validate(planPath, { root: REPO_ROOT });
      // (a) the plan's OWN single-form face is clean — the legacy Do-face / unknown-section BLOCK is
      //     gone (the p3 zero-migration plan stays the documented clean baseline, excluded here).
      expect(
        failures.filter((f) => f.file === planPath),
        `${file} plan-owned failures`,
      ).toEqual([]);
      // (b) the chain = exactly the resolved spec's own validate output — a one-off spec (the
      //     cdd-review-contract-fix plan's parent) carries the documented 4 one-off failures, a
      //     clean-parent spec zero, a legacy-overall spec the frozen backfill-claim residue.
      const specPath = resolveSpecFromPlan(planPath);
      expect(specPath, `${file} spec must resolve`).not.toBeNull();
      const specFails = specType().validate(specPath, { root: REPO_ROOT });
      const chain = failures.filter((f) => f.file !== planPath);
      expect(chain, `${file} chain`).toEqual(specFails);
    }
  });

  it("the 4 ## Task Groups plans moved their group semantics into edges — the graph-derived groups equal the original merged groups (group 等势)", () => {
    for (const [file, expected] of Object.entries(PLAN_PINS.groups)) {
      const planPath = path.join(PLANS_DIR, file);
      const groups = planType()
        .effectiveGroups(planPath)
        .map((g) => [...g.numbers]);
      expect(groups, file).toEqual(expected);
    }
    expect(Object.keys(PLAN_PINS.groups).length).toBe(4);
  });

  it("`## Task Groups` holds zero line-anchored-heading presence across the 17 migration targets (^## Task Groups\\s*$ — the engine heading token's family)", () => {
    const re = /^## Task Groups\s*$/;
    for (const file of MIGRATED_PLANS) {
      const lines = readFileSync(path.join(PLANS_DIR, file), "utf8").split("\n");
      expect(
        lines.some((l) => re.test(l)),
        file,
      ).toBe(false);
    }
  });

  it("the pending-migration set is EMPTY in the T8 terminal state — the 4 prose-period plans (osuperpowers p1–p4) closed the queue", () => {
    const pending = Object.entries(PLAN_MIGRATION)
      .filter(([, s]) => s === "pending")
      .map(([f]) => f);
    expect(pending).toEqual([]);
  });
});

describe("the migrated prose-period plan family — osuperpowers p1–p4 (约束原文逐字换壳 · acceptance 推导补全, T7)", () => {
  it("every prose-period plan keeps contiguous 1..N task numbering (the numbers verbatim)", () => {
    for (const file of PROSE_PERIOD_PLANS) {
      const planPath = path.join(PLANS_DIR, file);
      const nums = planType().taskNumbersFromPlan(planPath);
      const max = Math.max(...nums, 0);
      expect(nums, file).toEqual(Array.from({ length: max }, (_, i) => i + 1));
    }
  });

  it("`## Global Constraints` holds zero line-anchored-heading presence across the 4 migration targets (^## Global Constraints\\s*$ — the retired heading's line-anchored family)", () => {
    const re = /^## Global Constraints\s*$/;
    for (const file of PROSE_PERIOD_PLANS) {
      const lines = readFileSync(path.join(PLANS_DIR, file), "utf8").split("\n");
      expect(
        lines.some((l) => re.test(l)),
        file,
      ).toBe(false);
    }
  });

  it("constraints text is verbatim under ## Constraints — the ## Global Constraints → ## Constraints re-shell keeps the original constraint lines (the pre-transcription pin)", () => {
    for (const file of PROSE_PERIOD_PLANS) {
      const content = readFileSync(path.join(PLANS_DIR, file), "utf8");
      expect(constraintsBody(content), file).toEqual(PLAN_PINS.constraints[file]);
    }
  });

  it("acceptance is a derived completion product: non-empty, covers the task body's step-declared verifiable outcomes, and carries no placeholders (非逐字 pin — coverage, never text equality)", () => {
    for (const file of PROSE_PERIOD_PLANS) {
      const planPath = path.join(PLANS_DIR, file);
      const tasks = planType().tasksFromPlan(planPath);
      for (let i = 0; i < tasks.length; i++) {
        const n = i + 1;
        const task = tasks[i]!;
        expect(task.acceptance.length, `${file} task ${n} acceptance empty`).toBeGreaterThan(0);
        // coverage — every step's checkable outcome (the task body's machine-declared verifiable
        // result, the same face the brief renderer shows) appears as a criterion: a derived product
        // never drops a declared outcome.
        for (const step of task.steps) {
          expect(
            task.acceptance.includes(step.checkable),
            `${file} task ${n} acceptance must cover the step outcome`,
          ).toBe(true);
        }
        // no placeholders in the derived criterion text.
        for (const a of task.acceptance) {
          expect(a, `${file} task ${n} acceptance placeholder`).not.toMatch(/{{\s*[^{}>\n]+\s*}}/);
        }
      }
    }
  });

  it("single-form docContractValidate green — zero plan-owned failures; the chain carries EXACTLY the resolved spec's own validate output", () => {
    for (const file of PROSE_PERIOD_PLANS) {
      const planPath = path.join(PLANS_DIR, file);
      const failures = planType().validate(planPath, { root: REPO_ROOT });
      expect(
        failures.filter((f) => f.file === planPath),
        `${file} plan-owned failures`,
      ).toEqual([]);
      const specPath = resolveSpecFromPlan(planPath);
      expect(specPath, `${file} spec must resolve`).not.toBeNull();
      const specFails = specType().validate(specPath, { root: REPO_ROOT });
      const chain = failures.filter((f) => f.file !== planPath);
      expect(chain, `${file} chain`).toEqual(specFails);
    }
  });
});

describe("the migrated design-spec family — 20 three-truth skeletons (内容保真 transcription, T5)", () => {
  it("every migrated spec walks the rule plane clean (the three-truth skeleton = the body rule set — ## Design presence · unique ### Acceptance criteria · ## Constraints presence)", () => {
    for (const file of Object.keys(SPEC_VERBATIM)) {
      const content = readFileSync(path.join(SPECS_DIR, file), "utf8");
      expect(
        validator.structureFindings("spec", content),
        `${file} spec skeleton structure findings`,
      ).toEqual([]);
      // the acceptance subsection sits inside ## Design and before ## Constraints (the layout pin —
      // the rule plane judges existence/uniqueness, never the nested position).
      const slices = phaseSpecBody.projectSlicePatterns();
      const lines = content.split("\n");
      const designIdx = lines.findIndex((l) => slices.designHeading.test(l));
      const accIdx = lines.findIndex((l) => slices.acceptanceCriteriaHeading.test(l));
      const constraintsIdx = lines.findIndex((l) => slices.constraintsHeading.test(l));
      expect(accIdx).toBeGreaterThan(designIdx);
      expect(constraintsIdx).toBeGreaterThan(accIdx);
      // the **Version** line survives the transcription (the spec contract's structural face).
      expect(content.match(/^- \*\*Version\*\*: v\d+\.\d+/m), `${file} **Version**`).not.toBeNull();
    }
  });

  it("acceptance + constraints text is token-verbatim under the canonical sections (the machine pin)", () => {
    const slices = phaseSpecBody.projectSlicePatterns();
    for (const [file, pin] of Object.entries(SPEC_VERBATIM)) {
      const content = readFileSync(path.join(SPECS_DIR, file), "utf8");
      expect(sectionBody(content, slices.acceptanceCriteriaHeading), `${file} acceptance`).toEqual(
        pin.acceptance,
      );
      expect(sectionBody(content, slices.constraintsHeading), `${file} constraints`).toEqual(
        pin.constraints,
      );
    }
  });

  it("single-form docContractValidate green — zero spec-owned failures; the only residue is the frozen parent-overall backfill-claim results (13 docs, recorded — never T5 scope)", () => {
    for (const [file, state] of Object.entries(SPEC_MIGRATION)) {
      if (
        state !== "canonical" ||
        file === "2026-10-02-doc-architecture-v2-p3-design.md" ||
        file === "2026-10-02-doc-architecture-v2-p3.1-design.md"
      )
        continue;
      const specPath = path.join(SPECS_DIR, file);
      const failures = specType().validate(specPath, { root: REPO_ROOT });
      // (a) the migrated spec's OWN single-form surface is clean — the spec's own validate faces
      //     (version line · deviations · parent linkage) emit zero; the skeleton judgment rides the
      //     rule-plane walk asserted above.
      expect(
        failures.filter((f) => f.file === specPath),
        `${file} spec-owned single-form failures`,
      ).toEqual([]);
      // (b) the chain carries EXACTLY the parent overall's own validate output — nothing the
      //     transcription introduced, nothing swallowed.
      const parent = resolveParentOverall(specPath, REPO_ROOT);
      expect(parent.overallPath, `${file} parent must resolve`).not.toBeNull();
      const parentFails = overallType().validate(parent.overallPath as string, { root: REPO_ROOT });
      const chain = failures.filter((f) => f.file !== specPath);
      expect(chain.length, `${file} parent-chain residue`).toBe(parentFails.length);
      // (c) and that residue is, family-wide, the documented frozen backfill-claim results of the
      //     two legacy overalls (osuperpowers-overhaul: 7 · consumer-parity: 14) — a spec under a
      //     clean parent (pi-harness / doc-architecture-v2) has ZERO chain residue.
      for (const f of chain) expect(f.field, `${file} residue class`).toBe("backfill claim");
    }
  });
});

describe("the double-layer design-item plane — 22 designs ranked (P3.1 T4: 19 份双层迁移 + p3.1 已秩化 + p3 零独立)", () => {
  it("every design's design-body heading sequence equals the double-layer pin — `### N.` group(s) + `#### N.M` items, in document order, EXACT (count 171 + group numbers + ownership + titles verbatim)", () => {
    for (const file of readdirSync(SPECS_DIR).filter((f) => f.endsWith("-design.md"))) {
      const content = readFileSync(path.join(SPECS_DIR, file), "utf8");
      const lines = content.split("\n");
      let inDesign = false;
      const heads: string[] = [];
      for (const l of lines) {
        if (/^## Design/.test(l)) {
          inDesign = true;
          continue;
        }
        if (inDesign && /^### Acceptance criteria/.test(l)) break;
        if (inDesign && /^(?:### \d+\. |#### \d+\.\d+ )/.test(l)) heads.push(l);
      }
      expect(heads, file).toEqual(SPEC_DOUBLE_LAYER_PINS[file]);
      // Ownership is the pin's structural side: every `#### N.M` item's `N` matches its group.
      // The machine assertion rides the rule-plane walk (structureFindings = 0 above); the pin here
      // makes the per-file surface explicit.
    }
  });

  it("the migration count reconciles the spec §2.4 count-reconciliation — 19 files x 171 migrated items (numbered 78 / section-mark 87 / other 6)", () => {
    // Numbered leader 78 (13 files) + section-mark leader 87 (7 files incl. the deep-leader items) + other 6 (3 files) =
    // 171; the two zero-independent files (cp-p4.1 / doc-arch-p3 — the lead-in-bold-only pair) and
    // the already-ranked p3/p3.1 designs carry no migration (their pin rows are zero-item or the
    // p3.1 already-ranked items — excluded from the migrated count below).
    const MIGRATED_FILES = Object.keys(SPEC_MIGRATION).filter(
      (f) =>
        f !== "2026-10-02-doc-architecture-v2-p3-design.md" &&
        f !== "2026-10-02-doc-architecture-v2-p3.1-design.md",
    );
    let migratedTotal = 0;
    for (const file of MIGRATED_FILES) {
      migratedTotal += SPEC_DOUBLE_LAYER_PINS[file]!.filter((h) => /^#### /.test(h)).length;
    }
    expect(migratedTotal).toBe(171);
    expect(
      MIGRATED_FILES.filter((f) => SPEC_DOUBLE_LAYER_PINS[f]!.some((h) => /^#### /.test(h))).length,
    ).toBe(19);
    expect(SPEC_DOUBLE_LAYER_PINS["2026-09-21-consumer-parity-p4.1-design.md"]).toEqual([]);
    expect(SPEC_DOUBLE_LAYER_PINS["2026-10-02-doc-architecture-v2-p3-design.md"]).toEqual([]);
  });

  it("whole-tree pseudo-heading zero-residue — the strict pattern `^**…**s*$` hits EXACTLY the 3 pinned exempt prose lines (2 in-tree specs + the one-off), 法外零残留 (spec §2.4 计数对账)", () => {
    const STRICT = /^\*\*.+\*\*\s*$/;
    const exempt: readonly [string, string, number][] = [
      // [file, exact line content, original line number (pinned)]
      [
        "2026-09-13-osuperpowers-overhaul-p1-design.md",
        "**All Overall updated? = Yes before review.**",
        113,
      ],
      [
        "2026-09-13-osuperpowers-overhaul-p5-design.md",
        "**删除面**（旧模型归零）：`resolve-destination` 节点（程序归属降为 Related 链接，不入 digraph）· `ensure-session`（无 master 复用）· `append-comment`（无 per-finding 评论）· report-target 缓存 schema（含 kind）· 「master」概念改名 → 「aggregate issue / report issue」· **`.superpowers/sdd/*/progress.md` ledger 源（归 superpowers 域，collect 不再扫描）**",
        88,
      ],
      [
        "2026-09-28-cdd-review-contract-fix.md",
        "**实测根因（#302 原文叙述需修正）**: stdout `blocker:` 不是「执行层契约计数」——执行层失败计数器在 task/branch 面的 `counters:` 行。真正碰撞是 **跨 face 同 token 异义**：docs 面 `blocker:` = M2 计数；task/branch 面 `blocker:` = M3 prose（非 BLOCKED 轮默认 `none`，`returnFromHandoff:180` 经 `blockerDefaultFor` 输出）。实测证据按 face 分列两条、各自标注来源：status 面首行 **`status: CHANGES_REQUESTED`**（task return-block 第一行）——由 ≥1 blocker-severity finding 汇总而来（`finalize.ts` `classifySeverity`/`rollupStatus`）；prose 面 **`blocker: none`**（M3 默认值，`blockerDefaultFor` 输出）——不是 docs 结果行 `status: <s> · blocker: <n>` 的「· 分隔」记法（该行只印 M2 数值计数、从不印 none）。歧义由此产生：orchestrator 按判读指令「读 blocker count」命中 M3 prose 行（`none`）而非 M2 计数 → 得到 0 → 误路由 S2（收口轮不 re-review）。**task/branch 评审的 S1「必 re-review」守门被静默禁用。**",
        22,
      ],
    ];
    const all = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".md"));
    const hits: Array<[string, number, string]> = [];
    for (const f of all) {
      readFileSync(path.join(SPECS_DIR, f), "utf8")
        .split("\n")
        .forEach((l, i) => {
          if (STRICT.test(l)) hits.push([f, i + 1, l]);
        });
    }
    expect(hits).toHaveLength(3);
    expect(hits.map(([f]) => f).sort()).toEqual(exempt.map(([f]) => f).sort());
    for (const [f, exemptContent, originalLine] of exempt) {
      const actual = hits.find(([hf]) => hf === f)!;
      expect(actual[2], `${f} exempt line content`).toBe(exemptContent);
      // The line number is pinned at the ORIGINAL pre-migration position (the migration moves each
      // file's lines by the inserted group heading(s) — the pinned content is the source of truth).
      void originalLine;
    }
  });
});

describe("the four overalls' charter rank — the facets `###` / decision leaves `####` (P3.1 T5: F7 charter 结构秩)", () => {
  it("each overall's `## Program charter` carries its facet headings at the `###` rank (the family-parameterized anchor names — presence is what the rule plane judges)", () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
      "2026-10-02-doc-architecture-v2-overall.md": [
        "### Goal",
        "### Non-goals",
        "### Cross-cutting（程序级横切约束，先立后执行）",
      ],
      "2026-09-27-pi-harness-overall.md": [
        "### Goal",
        "### Non-goals（非目标，明确不发散）",
        "### Cross-cutting（程序级横切约束，先立后执行）",
      ],
      "2026-09-21-consumer-parity-overall.md": [
        "### Goal",
        "### Non-goals",
        "### Cross-cutting constraints",
      ],
      "2026-09-13-osuperpowers-overhaul-overall.md": [
        "### cdd-engine 服务化主线（2026-09-13 用户升维）",
        "### Non-goals",
        "### Cross-cutting constraints",
      ],
    };
    for (const [name, facets] of Object.entries(expected)) {
      const lines = readFileSync(path.join(SPECS_DIR, name), "utf8").split("\n");
      let inCharter = false;
      const charterHeads: string[] = [];
      for (const l of lines) {
        if (/^## Program charter/.test(l)) inCharter = true;
        else if (inCharter && /^## /.test(l)) inCharter = false;
        if (inCharter && /^### /.test(l)) charterHeads.push(l.trim());
      }
      for (const facet of facets) expect(charterHeads, `${name} facets`).toContain(facet);
    }
  });

  it("doc-architecture-v2's decision-retention face is ranked (the 决策留存 `###` + the decision-group / endorsement leaves `####`) — the family with the full decision surface (存在才执法 enumeration)", () => {
    const lines = readFileSync(
      path.join(SPECS_DIR, "2026-10-02-doc-architecture-v2-overall.md"),
      "utf8",
    ).split("\n");
    let inCharter = false;
    const heads: string[] = [];
    for (const l of lines) {
      if (/^## Program charter/.test(l)) inCharter = true;
      else if (inCharter && /^## /.test(l)) inCharter = false;
      if (inCharter && /^(###|####) /.test(l)) heads.push(l);
    }
    expect(heads).toContain(
      "### 设计决策留存（brainstorm grilling 定案 2026-10-02 —— 全量记录，不遗漏细节）",
    );
    for (const g of [
      "M 组（skill-ref 映射，M1–M4 全关）",
      "F 组（文档平面结构，提案）",
      "R 组（ref 统一身份，提案）",
      "B 组（正文内容，提案）",
      "E 组（经验债，驱动本整体）",
    ]) {
      expect(heads, `decision group ${g}`).toContain(`#### ${g}`);
    }
    expect(heads, "endorsement leaf").toContain("#### 上游先例背书");
  });

  it("the three legacy overalls carry NO decision-retention face (existence-only — the absence is the documented non-enumeration state)", () => {
    for (const name of [
      "2026-09-27-pi-harness-overall.md",
      "2026-09-21-consumer-parity-overall.md",
      "2026-09-13-osuperpowers-overhaul-overall.md",
    ]) {
      const lines = readFileSync(path.join(SPECS_DIR, name), "utf8").split("\n");
      let inCharter = false;
      const heads: string[] = [];
      for (const l of lines) {
        if (/^## Program charter/.test(l)) inCharter = true;
        else if (inCharter && /^## /.test(l)) inCharter = false;
        if (inCharter && /^(###|####) /.test(l)) heads.push(l);
      }
      expect(
        heads.some((h) => h.includes("决策留存")),
        name,
      ).toBe(false);
      expect(
        heads.every(
          (h) =>
            h === "### Goal" ||
            h === "### Non-goals" ||
            h === "### Cross-cutting" ||
            /^### Cross-cutting（/.test(h) ||
            /^### Non-goals（/.test(h) ||
            h === "### cdd-engine 服务化主线（2026-09-13 用户升维）" ||
            h === "### Cross-cutting constraints",
        ),
        name,
      ).toBe(true);
    }
  });
});

describe("the four overalls walk with zero exclusion — the rule plane judges the four tables' structure clean; the frozen legacy overalls carry exactly their documented backfill-claim residue on the accounting validate side (T8 terminal)", () => {
  it("the rule plane walks all four overalls — structureFindings(overall, content) = 0 (the four tables' structural judgment; the frozen overalls' STRUCTURE is clean, no exclusion, no silent skip)", () => {
    for (const name of readdirSync(SPECS_DIR).filter((f) => f.endsWith("-overall.md"))) {
      expect(
        validator.structureFindings("overall", readFileSync(path.join(SPECS_DIR, name), "utf8")),
        `${name} overall structure findings`,
      ).toEqual([]);
    }
  });

  it("the frozen osuperpowers-overhaul (7) and consumer-parity (14) carry ONLY the recorded backfill-claim residue on the accounting validate surface (the closeout-accounting face — the plan's documented terminal boundary); pi-harness + doc-architecture-v2 validate clean", () => {
    for (const name of readdirSync(SPECS_DIR).filter((f) => f.endsWith("-overall.md"))) {
      const fails = overallType().validate(path.join(SPECS_DIR, name), { root: REPO_ROOT });
      const expected = FROZEN_OVERALL_RESIDUE[name];
      if (expected === undefined) {
        expect(fails, name).toEqual([]);
      } else {
        expect(fails.length, name).toBe(expected);
        for (const f of fails) expect(f.field, name).toBe("backfill claim");
      }
    }
  });
});

describe("the unilateral wave model — every plan's batch split pin (P3.1 T3: 组 = 波次)", () => {
  // The per-plan wave decomposition (effectiveGroups = TaskGraph.batches → one dispatch group per
  // wave, ascending task numbers). The 4 real-value plans' waves preserve their retired pairing
  // components same-layer (the group-equal-power face — pinned above per plan); the sequential plans run
  // the task-number chain; p3.1 (this program's own) derives its declared schedule
  // T1→T2→{T3,T4,T5}→T6→T7→T8 → six waves.
  const WAVE_SPLITS: Readonly<Record<string, readonly (readonly number[])[]>> = {
    "2026-09-13-osuperpowers-overhaul-p1.md": [[1], [2], [3], [4], [5]],
    "2026-09-13-osuperpowers-overhaul-p2.md": [[1], [2], [3], [4], [5], [6]],
    "2026-09-13-osuperpowers-overhaul-p3.md": [[1], [2], [3], [4], [5], [6]],
    "2026-09-13-osuperpowers-overhaul-p4.md": [
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [10],
      [11],
      [12],
      [13],
      [14],
      [15],
      [16],
      [17],
      [18],
    ],
    "2026-09-13-osuperpowers-overhaul-p5.md": [
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [10],
      [11],
      [12],
      [13],
      [14],
      [15],
      [16],
      [17],
      [18],
      [19],
    ],
    "2026-09-13-osuperpowers-overhaul-p6.md": [
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [10],
      [11],
      [12],
      [13],
      [14],
      [15],
      [16],
      [17],
      [18],
      [19],
      [20],
      [21],
      [22],
      [23],
      [24],
      [25],
      [26],
      [27],
      [28],
      [29],
      [30],
      [31],
    ],
    "2026-09-21-consumer-parity-p1.md": [[1], [2], [3]],
    "2026-09-21-consumer-parity-p2.md": [[1], [2], [3], [4], [5], [6]],
    "2026-09-21-consumer-parity-p3.md": [[1], [2], [3], [4], [5], [6], [7], [8]],
    "2026-09-21-consumer-parity-p4.1.md": [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]],
    "2026-09-21-consumer-parity-p4.2.md": [[1, 2, 3], [4, 5], [6, 7], [8], [9], [10], [11], [12]],
    "2026-09-21-consumer-parity-p4.3.md": [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11]],
    "2026-09-21-consumer-parity-p4.4.md": [[1], [2], [3, 4, 5], [6, 7, 8], [9], [10, 11]],
    "2026-09-27-pi-harness-p1.md": [[1], [2], [3], [4]],
    "2026-09-27-pi-harness-p2.md": [[1], [2], [3], [4], [5], [6]],
    "2026-09-27-pi-harness-p3.md": [[1], [2], [3], [4], [5], [6], [7], [8], [9]],
    "2026-09-27-pi-harness-p4.md": [[1, 2], [3], [4, 5], [6], [7, 8]],
    "2026-09-27-pi-harness-p5.md": [[1], [2], [3], [4], [5], [6], [7, 8], [9]],
    "2026-09-28-cdd-review-contract-fix.md": [[1], [2], [3], [4], [5], [6], [7], [8], [9]],
    "2026-10-02-doc-architecture-v2-p1.md": [[1], [2], [3], [4], [5], [6], [7]],
    "2026-10-02-doc-architecture-v2-p2.md": [[1], [2], [3], [4], [5], [6], [7]],
    "2026-10-02-doc-architecture-v2-p3.md": [[1], [2], [3], [4], [5], [6], [7], [8], [9]],
    "2026-10-02-doc-architecture-v2-p3.1.md": [[1], [2], [3, 4, 5], [6], [7], [8]],
  };

  it("every migration-target plan's effectiveGroups derives exactly its pinned wave split (the wave = the dispatch group)", () => {
    for (const [file, expected] of Object.entries(WAVE_SPLITS)) {
      const groups = planType()
        .effectiveGroups(path.join(PLANS_DIR, file))
        .map((g) => [...g.numbers]);
      expect(groups, file).toEqual(expected);
    }
    expect(Object.keys(WAVE_SPLITS).length).toBe(23); // every plan in the tree is pinned
  });

  it("the p3.1 plan itself derives the six-wave schedule (T1→T2→{T3,T4,T5}→T6→T7→T8 — 3‖4‖5 same wave)", () => {
    const groups = planType()
      .effectiveGroups(path.join(PLANS_DIR, "2026-10-02-doc-architecture-v2-p3.1.md"))
      .map((g) => [...g.numbers]);
    expect(groups).toEqual([[1], [2], [3, 4, 5], [6], [7], [8]]);
  });
});

describe("the one-off spec is the sole tolerated non-canonical tree doc — never counted, detect only", () => {
  it("the one-off spec (2026-09-28-cdd-review-contract-fix.md) throws unknown-doc-kind — absent from the canonical counts", () => {
    const oneOffPath = path.join(SPECS_DIR, ONE_OFF);
    expect(() => validator.detectDocKind(oneOffPath)).toThrow(UnknownDocKindError);
    expect(() => validator.detectDocKind(oneOffPath)).toThrow(/no registered doc type/);
    // not a design/overall member — absent from both canonical counts (the tolerance's shape).
    expect(ONE_OFF.endsWith("-design.md")).toBe(false);
    expect(ONE_OFF.endsWith("-overall.md")).toBe(false);
  });
});
