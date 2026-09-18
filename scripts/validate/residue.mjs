#!/usr/bin/env node
// scripts/validate/residue.mjs — block 5c: engine zero-residue + stale-lexicon + gate-lexicon grep.
// (sdd_/SDD_/sdd-run-/spor- must not regress in engine executable products; the
// stale-lexicon checks pin the P4/P6 migration end-state — old docs-review
// filenames, PASS=< lens params, D1|D2|D3 lens names, resolve-hit / gh issue
// reopen resolver vocabulary, the task-review mode, P4 degraded filenames, and
// the old docs root (pre-P2), the removed cdd subcommands `brief` / `research`
// (pre-P3, command-form only — bare words stay legal), and the removed research
// timeout envs — plus the P5 gate-lexicon checks pin the cdd-gate
// subsystem removal (bin/gate/
// path, CDD_GATE env, cdd-gate-core, gateDecide, deleted gate adapters) — must
// not creep back into mechanism/document positions.)
// Task 16（P5）追加 report-issues 旧模型残留守卫（p5 design §2.8「residue 守卫」条 —— AC1 词边界
// 零命中 / AC5 renderer 零残留 的机制侧落点）：裸 report-issue（词边界，复数 report-issues skill
// 名放行）/ --mode 词形 / renderComment / renderTitle / resolveDropdownOptions / sessionTypes /
// execFileSync("git")（手写 git 回渗）——全部机制位置零豁免。
// T10 追加 shipped 面反向守卫两条（§2.8 行 19-20）：① shipped 非 emit 面（skills/** · 插件
// README）零 osuperpowers-version 版本字面量；② shipped 面（根 README · 插件 README）+ 协作者面
// （.changeset/README.md）零 `/init` 引用——init 删除 + 版本戳机制删除后的逆向残留检查。
// T11 追加 handoff-schema 零命中守卫（§2.8 行 14）：`(?<!-)handoff-schema`（裸名/路径形）零命中，
// 负向后顾豁免 canonical schema 文件名——handoff-schema.md 删除动作与守卫同 commit。
// The grepTargets meta is consumed by the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) to pin the target set.

import { readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "tinyglobby";

import { runIfMain } from "./runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const OSKILLS = ["packages/osuperpowers/skills"];
// re-org（spec §2.13）：cdd-engine 机制文件已自 lib/ 迁入 src/ 目标树 —— scope 常量统一收拢为 src
//（bin/ 已删；lib/ 拓扑迁散为 src/{cli,dispatch,rules,artifacts,render,infra}，模板位于独立 templates/）。
const CDD_ENGINE_BIN = ["packages/cdd-engine/src"];
const CDD_ENGINE = [...CDD_ENGINE_BIN, "packages/cdd-engine/templates"];
// T9 nit3（DRY）：跨 skills + cdd-engine（src+templates）的机制位置集合 —— 5 个 check 共享。
const ALL_MECH_POSITIONS = [...OSKILLS, ...CDD_ENGINE];
// Task 5（P2）：文档表层 target —— 治理文件面（旧 docs 根残留最可能的回渗点）：
// 根 CLAUDE.md（活跃约定入口）、根 README.md / 插件 README.md（发布面）、maintainer 文档目录。
// 路径字面一律不写入本文件（守卫本体不得成为被守卫语汇的载体，见 GATE_TARGETS 旁注释）。
export const DOC_SURFACE_TARGETS = ["CLAUDE.md", "README.md", "packages/osuperpowers/README.md", "docs/maintainers"];

const RESIDUE_TARGETS = [
  "packages/osuperpowers/bin",
  "packages/osuperpowers/skills",
  "packages/cdd-engine/src",
  "packages/cdd-engine/templates",
];
const RESIDUE_RE = /\b(sdd_|_sdd_|SDD_|sdd-run-|spor-)/;

// stale-lexicon 零豁免（P4/P6 命名归一后）：只查机制位置，白名单为空 —— 通过「grep 模式
// 本身不匹配 canonical 语汇」避免误报：finding-meta.json `dogfood (CDD session)` 下拉
// （`"dogfood",` / `labels ....dogfood` 才命）、spec-review-{R}.json 家族名
// （退化 `(spec|plan)-1\.json` 才命）、contract.mjs 现存合法注释「spec D1/D4/D5a」与
// 「dirty working tree（D2）」（lens 语境限 `D[123]:` 前缀形式才命）。
const STALE_LEXICON_CHECKS = [
  { label: "old docs-review filename", re: /docs-review\.md/, scope: ALL_MECH_POSITIONS },
  { label: "PASS= lens param", re: /PASS=</, scope: ALL_MECH_POSITIONS },
  { label: "lens names D1|D2|D3 (lens-context)", re: /\bD[123][:：]/, scope: ALL_MECH_POSITIONS },
  { label: "resolve-hit", re: /resolve-hit/, scope: ALL_MECH_POSITIONS },
  { label: "gh issue reopen", re: /gh issue reopen/, scope: ALL_MECH_POSITIONS },
  // T9 nit6：task-review 旧 mode 名 scope 用 CDD_ENGINE（src+templates）而非仅 CDD_ENGINE_BIN ——
  // templates（implement/fix/review）历史引用旧 mode 名已成回渗源，templates 也须入扫。
  // T15（design §2.8 行 21）：scope 扩至 ALL_MECH_POSITIONS —— skills 面裸 task-review 已由
  // T11/T14/T15 三批清零（handoff-schema.md → cli-driven-development SKILL.md → _docs/review.md），
  // 本 scope 为常驻防回归面；正则收敛为旧 mode 名形（负向后顾豁免新图节点名 run-task-review）。
  { label: "old mode task-review", re: /(?<!run-)task-review/, scope: ALL_MECH_POSITIONS },
  { label: "P4 degraded names", re: /(spec|plan)-1\.json|doc-fix-/, scope: CDD_ENGINE },
  { label: "flat docs-review root 回退", re: /\.superpowers\/docs-review/, scope: CDD_ENGINE_BIN },
  { label: "old runtime root .superpowers/cdd", re: /\.superpowers\/cdd/, scope: ALL_MECH_POSITIONS },
  { label: "deleted standalone root", re: /\.superpowers\/standalone/, scope: ALL_MECH_POSITIONS },
  { label: "dogfood as label", re: /labels [^\n]*dogfood|"dogfood",/, scope: OSKILLS },
  // Task 5（P2）：旧 docs 根（pre-P2 归一前的 superpowers 布局）守卫 —— 机制位置零豁免
  // 并入文档表层（DOC_SURFACE_TARGETS）；正则以 `\/` 转义、label 不含路径字面，守卫本体
  // 因此不会把被守卫的旧根字面写回 scripts/（否则全仓校验会多出第三类命中）。
  { label: "old docs root (pre-P2)", re: /docs\/superpowers/, scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS] },
  // Task 5（P3）：已删 cdd 子命令（**命令形**，非裸词——P4 合法的 /mattpocock-skills:research
  // 会话调用与活体文本 cli-driven-development/SKILL.md:66 的 `brief-dependent plan sections`
  // 均须放行）+ research 专属 timeout env（随 LEGACY_MODE_ENV/modeEnv.research 连根删除）。
  { label: "removed cdd subcommand (pre-P3)", re: /\bcdd (brief|research)\b/, scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS] },
  //   `RESEARCH_TIMEOUT` 单分支即覆盖两种被删形态（`CDD_RESEARCH_TIMEOUT` 与 legacy 裸名）
  //   ——无锚定 alternation 的子串语义使 `CDD_` 前缀分支为死分支（T5 review-1 nit，实测等价），
  //   故取后缀单分支；`CDD_TASK_TIMEOUT` / `CDD_REVIEW_TIMEOUT` 不命中（保留面）。
  { label: "removed research timeout env", re: /RESEARCH_TIMEOUT/, scope: CDD_ENGINE },
  // Task 16（P5）：report-issues 旧模型残留守卫 —— 旧模型语汇（--mode flag / renderComment /
  // renderTitle / resolveDropdownOptions / sessionTypes / 裸 report-issue）已清零（rewrite 收口轮），
  // 常驻防回归。`report-issue` 必须词边界（\b）——复数 `report-issues` skill 名与 `report-links-only`
  // 节点均合法（substring 会误报复数）。`--mode` 取词形（负向后顾/前瞻豁免内部 `mode:` 属性与
  // --modeYaml 一类衍生 token）。`execFileSync("git")` 防手写 git 回渗（engine 唯一 spawn 通道 =
  // proc.mjs 的 execa）。scope 全在机制位置（ALL_MECH_POSITIONS），scripts/ 不在任一 scope，
  // 本文件写字面无自噬。
  { label: "裸 report-issue（词边界；复数 report-issues 放行）", re: /\breport-issue\b/, scope: ALL_MECH_POSITIONS },
  { label: "旧 --mode flag（任务级 mode 已删）", re: /(?<![\w-])--mode(?![-\w])/, scope: ALL_MECH_POSITIONS },
  { label: "renderComment 旧 renderer 语汇", re: /\brenderComment\b/, scope: ALL_MECH_POSITIONS },
  { label: "renderTitle 旧 renderer 语汇", re: /\brenderTitle\b/, scope: ALL_MECH_POSITIONS },
  { label: "resolveDropdownOptions 旧 dropdown 解析", re: /\bresolveDropdownOptions\b/, scope: ALL_MECH_POSITIONS },
  { label: "sessionTypes 旧 session 分类", re: /\bsessionTypes\b/, scope: ALL_MECH_POSITIONS },
  { label: 'execFileSync("git") 手写 git 回渗', re: /\bexecFileSync\(\s*["']git["']/, scope: ALL_MECH_POSITIONS },
  // Task 2（P6）：vendors 自维护面撤除 —— 防回渗语汇守卫（B12）。scope = ALL_MECH_POSITIONS
  // 零豁免（docs/maintainers 的 vendor-reference 清理经 spec F7 延后至 F 域重组，不在此面）。
  // 词形守紧致形：`vendors/`（路径形，非裸 vendor 词）、`publish-vendor`（词形，含文件/步/
  // 子命令名）、`submodule[s]`（词形——git submodule / submodules: recursive 均命中）。
  { label: "vendors/ 自维护路径形回渗", re: /vendors\//, scope: ALL_MECH_POSITIONS },
  { label: "publish-vendor 词形回渗", re: /\bpublish-vendor\b/, scope: ALL_MECH_POSITIONS },
  { label: "submodule 词形回渗", re: /\bsubmodule[s]?\b/, scope: ALL_MECH_POSITIONS },
];

// T6（P5）：gate 专属语汇零豁免（镜像 P6 F5 stale-lexicon 守卫；与 T7 grep1 口径一致）。
// cdd-gate 子系统（packages/osuperpowers/bin/gate/ 全树删除）后，语汇不得回渗机制/文档表层：
// cdd-engine bin + osuperpowers skills + docs/maintainers + 根 README。豁免（注册非目标）：
// docs/osuperpowers/{specs,plans}（历史文档新落点；spec/plan 描述删除面必携 gate 语汇，
// 且不在 gate targets 内）、packages/osuperpowers/CHANGELOG.md
// （历史记录，非机制位置）、osuperpowers/cdd-engine tests/（no-gate.test.mjs 反向守卫须
// 引用该语汇，collectGateLexiconHits 不经其扫描）——与 T2 Step 4 docs-runner CDD_GATE 注释
// 清理口径一致，靠「模式取紧致形（路径/门字形）」而非裸 `gate`/`cdd-gate-` 避免误报：
// ship gate / evidence-gate / {{HARD_GATE}} / cdd-gate-test git 身份均零命中。
// Task 5（P2）：GATE_TARGETS 与 DOC_SURFACE_TARGETS 有 2 项**刻意重叠**（`docs/maintainers`
// / 根 `README.md`）—— 两者服务不同语汇（gate 子系统移除 vs 旧 docs 根），非重复声明；
// 根 `README.md` 对 stale-lexicon 属新增覆盖（GATE_TARGETS 仅被 GATE_LEXICON_CHECKS 消费）。
// 命中面须同步重指向，不得静默漂移。
const GATE_TARGETS = [...CDD_ENGINE_BIN, ...OSKILLS, "docs/maintainers", "README.md"];
const GATE_LEXICON_CHECKS = [
  { label: "deleted gate dir bin/gate/", re: /\bbin\/gate\b/, scope: GATE_TARGETS },
  { label: "CDD_GATE env", re: /CDD_GATE/, scope: GATE_TARGETS },
  { label: "cdd-gate-core module", re: /cdd-gate-core\b/, scope: GATE_TARGETS },
  { label: "gateDecide callable", re: /\bgateDecide\b/, scope: GATE_TARGETS },
  { label: "deleted gate adapters", re: /gate\/adapters\//, scope: GATE_TARGETS },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 复用扫描：tinyglobby 替换手写递归；`dot: true` 扫隐藏子目录（.claude-plugin/）。
// T6：目录 target glob **/*，单文件 target（根 README.md）直接读；target 可取仓库相对
// 路径或绝对路径（后者供 collectGateLexiconHits 测试注入临时目录）。
// T7：export 供 smoke-cdd.mjs 最终核对（deletion-surface sweep）复用，不重复实现。
// review-1 warn（Duplicated Code）：统一遍历辅助 —— scanTargets / scanLines / listTargetFiles
// 原三份近相同 walk（target 解析 → 缺失 throw → glob 展开 → 二进制跳过）逐行复制，仅改其一
// 即静默漂移；现收敛为单一 walkTargetFiles，三个消费端只做各自的匹配/映射。
// 缺失 target → 带 target 的清晰 Error（对齐 G7/G8「deleted path has returned」风格），
// 未来文件改名/删除以可读 guard 失败呈现而非 statSync ENOENT 晦涩崩溃。
function walkTargetFiles(targets) {
  const out = [];
  for (const t of targets) {
    const abs = path.isAbsolute(t) ? t : path.join(ROOT, t);
    if (!existsSync(abs)) {
      throw new Error(`walkTargetFiles: target missing — ${t} (deleted file? adjust target set or this sweep scope)`);
    }
    const paths = statSync(abs).isDirectory()
      ? globSync("**/*", { cwd: abs, absolute: true, dot: true })
      : [abs];
    for (const f of paths) {
      if (readFileSync(f).includes(0)) continue; // binary — grep -rn reports, doesn't content-match
      out.push(f);
    }
  }
  return out;
}

export function scanTargets(targets, re) {
  const hits = [];
  for (const f of walkTargetFiles(targets)) {
    if (re.test(readFileSync(f).toString("utf8"))) hits.push(path.relative(ROOT, f));
  }
  return hits;
}

function checkZeroResidue() {
  const hits = scanTargets(RESIDUE_TARGETS, RESIDUE_RE);
  assert(hits.length === 0, `RESIDUE FOUND — sdd_/SDD_/sdd-run-/spor- in engine executable products:\n  ${hits.join("\n  ")}`);
  console.log("OK — zero residue in engine executable products");
}

export function hasHit(lines) {
  return [...STALE_LEXICON_CHECKS, ...GATE_LEXICON_CHECKS].some(({ re }) => lines.some((line) => re.test(line)));
}

// targetsOverride 与 collectGateLexiconHits 同构——供测试注入临时目标，验证 **doc-surface 面**
// （DOC_SURFACE_TARGETS）确实在扫面内（否则该 scope 缩小不会被任何断言察觉）。
export function collectStaleLexiconHits(targetsOverride) {
  const hits = [];
  for (const { label, re, scope } of STALE_LEXICON_CHECKS) {
    for (const f of scanTargets(targetsOverride ?? scope, re)) hits.push({ label, file: f });
  }
  return hits;
}

// T6：与 collectStaleLexiconHits 同构；`targetsOverride` 供测试注入临时目录验证扫描命中。
export function collectGateLexiconHits(targetsOverride) {
  const hits = [];
  for (const { label, re, scope } of GATE_LEXICON_CHECKS) {
    for (const f of scanTargets(targetsOverride ?? scope, re)) hits.push({ label, file: f });
  }
  return hits;
}

// =====================================================================
// Task 8 — channel audit（design §2.8 行 1–11、13，engine 侧 12 条）
// =====================================================================
// 守卫面与 canonical 同源：env 直读白名单（行 2）/ argv flag 集（行 9）/ 失败类目与计数器（行 13）
// 一律经 cdd-engine 的唯一读取入口取（loadContract / FAILURE_CATEGORIES / counters），本文件不写
// 字面第二份 —— 守卫自身因此不成为被守卫语汇的载体。行 5 的两个旧根解析名按拼接构造（⑤ 的 target
// 集含 scripts/，守卫本体不得书写被守词汇的连续字面，否则自命中）。
import { loadContract } from "../../packages/cdd-engine/src/infra/context.ts";
import { mainCommand } from "../../packages/cdd-engine/src/cli/parse.ts";
import { FAILURE_CATEGORIES, counters as canonicalCounters } from "../../packages/cdd-engine/src/rules/failure.ts";

const CONTRACT = loadContract();
// 行 2 白名单 = canonical channels.env 的 var + markers（§2.4.4-① 7 键）。
export const ENV_DIRECT_READ_WHITELIST = new Set(
  Object.values(CONTRACT.channels.env).flatMap((ch) => [ch.var, ...(ch.markers ?? [])].filter(Boolean)),
);
// 行 9 canonical argv flag 集（channels.argv 的 flag 字段；含 program 级 --dry-run 与 -h/--help）。
export const CANONICAL_ARGV_FLAGS = new Set(Object.values(CONTRACT.channels.argv).map((a) => a.flag).filter(Boolean));
// 行 5 旧根解析名（拼接构造：⑤ scope 含 scripts/，守卫本体零连续字面）。
const ROOT_FROM_DOC = "root" + "FromDoc" + "Path";
const RESOLVE_REPO_ROOT = "resolve" + "Repo" + "Root";

// 逐行扫描辅助（建立在 walkTargetFiles 的文件面之上）：命中行回 { file, lineNo, text }。
export function scanLines(targets, re) {
  const hits = [];
  for (const f of walkTargetFiles(targets)) {
    const lines = readFileSync(f).toString("utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) hits.push({ file: path.relative(ROOT, f), lineNo: i + 1, text: lines[i] });
    }
  }
  return hits;
}

// 文件清单辅助（scanLines 的文件面）：目标集内全部非二进制文件的仓储相对路径（供结构断言/跨文件比对）。
function listTargetFiles(targets) {
  return walkTargetFiles(targets).map((f) => path.relative(ROOT, f));
}

/** ① 行 1：engine src 内 process.cwd() 计数 = 1 且唯一命中文件 = src/bin.ts（两项都写）。 */
export function collectProcessCwdAudit(targetsOverride = CDD_ENGINE_BIN) {
  const m = scanLines(targetsOverride, /process\.cwd\(\)/);
  const hits = [];
  if (m.length !== 1) {
    for (const { file, lineNo } of m) {
      hits.push({ label: "process.cwd() 非单点（期望 engine src 恰 1 处）", file: `${file}:${lineNo}` });
    }
    if (m.length === 0) {
      hits.push({ label: "process.cwd() 缺失（src/bin.ts initRoot 的转换点被移除或改名）", file: "packages/cdd-engine/src/bin.ts" });
    }
    return hits;
  }
  if (!m[0].file.endsWith(path.join("src", "bin.ts"))) {
    hits.push({ label: "process.cwd() 未收口到 src/bin.ts（唯一命中的转换点在别处）", file: `${m[0].file}:${m[0].lineNo}` });
  }
  return hits;
}

// ② 行 2 三种直读形（process.env.X / process.env["X"] / env.X）；非白名单键 → hit。
const ENV_READ_RE = /(?:\bprocess\.env|\benv)\.([A-Za-z_][A-Za-z0-9_]*)|(?:\bprocess\.env|\benv)\[["']([^"']+)["']\]/;
export function collectEnvDirectReadHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  const g = new RegExp(ENV_READ_RE.source, "g"); // 逐行全捕获（一行可多形）
  for (const { file, lineNo, text } of scanLines(targetsOverride, ENV_READ_RE)) {
    let m;
    while ((m = g.exec(text)) !== null) {
      const key = m[1] ?? m[2];
      if (key && !ENV_DIRECT_READ_WHITELIST.has(key)) {
        hits.push({ label: `process.env/env 直读键非白名单（§2.4.4-①）: ${key}`, file: `${file}:${lineNo}` });
      }
    }
  }
  return hits;
}

// ③ 行 3a 整表透传点 ⊆ §2.4.4-② 清单（4 处，逐 site 形态分类；全行注释非透传点）。
const ENV_PASSTHROUGH_SITES = [
  { file: "packages/cdd-engine/src/dispatch/task.ts", re: /#opts\.env \?\? process\.env/ },
  { file: "packages/cdd-engine/src/dispatch/docs.ts", re: /resolveTimeoutMs\(process\.env, "review"\)|invokeCli\(entry, prompt, \{ op: mode, type \}, process\.env, this\.ctx\.repoRoot/ },
  { file: "packages/cdd-engine/src/cli/shared.ts", re: /detectCurrentHarness\(process\.env\)/ },
  { file: "packages/cdd-engine/src/cli/branch-review.ts", re: /resolveTimeoutMs\(process\.env, "review"\)|invokeCliWithRetry\([^)]*process\.env, / },
];
const ENV_WHOLE_RE = /process\.env([^.\w[]|$)/;
export function collectEnvPassThroughHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, ENV_WHOLE_RE)) {
    if (text.trimStart().startsWith("//")) continue; // 注释提及非透传点
    const san = ENV_PASSTHROUGH_SITES.find((s) => s.file === file && s.re.test(text));
    if (!san) hits.push({ label: `整表透传点不在 §2.4.4-② 清单（4 处）: ${text.trim().slice(0, 48)}`, file: `${file}:${lineNo}` });
  }
  return hits;
}

/** ③ 行 3b 零 spread 注入（{ ...process.env, … }）。 */
export function collectEnvSpreadHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo } of scanLines(targetsOverride, /\.\.\.process\.env/)) {
    hits.push({ label: "process.env spread 注入（§2.4.4 整表经参数传递，不 spread 拼对象）", file: `${file}:${lineNo}` });
  }
  return hits;
}

/** ③ 行 3c 六键名零命中（CDD_LIFECYCLE_PATH / CDD_REGISTRY_PATH / NODE_ENV / CDD_DRY_RUN / PLAN_FILE / CDD_HANDOFF_PATH；grep -rnE 含注释行）。 */
export function collectSixEnvKeyHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo } of scanLines(targetsOverride, /CDD_LIFECYCLE_PATH|CDD_REGISTRY_PATH|NODE_ENV|CDD_DRY_RUN|PLAN_FILE|CDD_HANDOFF_PATH/)) {
    hits.push({ label: "env 通道键名回渗（六键零命中）", file: `${file}:${lineNo}` });
  }
  return hits;
}

// ④ 行 4：路径类实参（--plan/--spec/--findings）全部经唯一 resolver。负断言 = 直用原参（绕过
// resolveDocArg 归一）；正断言 = 5 个 call-site 文件（T2「归一入口闭包」）必须都引用 resolveDocArg。
const PATH_ARG_SCOPE = ["packages/cdd-engine/src/cli", "packages/cdd-engine/src/dispatch/task.ts"];
// review-1 nit：旁路面补全 —— readFileSync 的 fs/promises 异步同胞 `readFile(opts.*)` 与动态
// import 求值同一路径参（`import(opts.*)`）先前不在面内（机械面按实现者自选，此面须完整）。
const PATH_ARG_BYPASS_RE = /resolveWorkspace\(opts\.(plan|spec|findings)|workspaceSlug\(opts\.(plan|spec|findings)|readFileSync\(opts\.(plan|spec|findings)|readFile\(opts\.(plan|spec|findings)|existsSync\(opts\.(plan|spec|findings)|import\(opts\.(plan|spec|findings)|path\.join\([^)]*opts\.(plan|spec|findings)/;
const RESOLVER_FILES = [
  "packages/cdd-engine/src/cli/shared.ts",
  "packages/cdd-engine/src/cli/fix.ts",
  "packages/cdd-engine/src/cli/review.ts",
  "packages/cdd-engine/src/cli/base-branch.ts",
  "packages/cdd-engine/src/dispatch/task.ts",
];
export function collectPathArgResolverHits(scopeOverride, resolverFilesOverride) {
  const scope = scopeOverride ?? PATH_ARG_SCOPE;
  const files = resolverFilesOverride ?? RESOLVER_FILES;
  const hits = [];
  for (const { file, lineNo, text } of scanLines(scope, PATH_ARG_BYPASS_RE)) {
    hits.push({ label: `路径实参绕过解析器（resolveDocArg 归一缺失）直用: ${text.trim().slice(0, 48)}`, file: `${file}:${lineNo}` });
  }
  for (const f of files) {
    const text = readFileSync(path.isAbsolute(f) ? f : path.join(ROOT, f), "utf8");
    if (!/\bresolveDocArg\b/.test(text)) {
      hits.push({ label: "--plan/--spec/--findings 读取点缺少 resolveDocArg（归一入口闭包缺员）", file: f });
    }
  }
  return hits;
}

// ⑤ 行 5：全仓零旧根解析名（二件套，含 tests；scope 与 T15 的「『全仓』落实口径」同表）。
// label 按变量拼接（⑤ 的 target 集含 scripts/，label 若写连续字面即自命中）。
const CHANNEL_ROOT_TARGETS = [...ALL_MECH_POSITIONS, "packages/cdd-engine/tests", "scripts"];
const ROOT_RESOLVER_TOKENS = [
  { label: `${ROOT_FROM_DOC} 回渗（旧按路径猜根的第二权威）`, re: new RegExp(ROOT_FROM_DOC) },
  { label: `${RESOLVE_REPO_ROOT} 回渗（旧根解析函数整函数删除）`, re: new RegExp(RESOLVE_REPO_ROOT) },
];
export function collectRootResolverHits(targetsOverride) {
  const targets = targetsOverride ?? CHANNEL_ROOT_TARGETS;
  const hits = [];
  for (const { label, re } of ROOT_RESOLVER_TOKENS) {
    for (const f of scanTargets(targets, re)) hits.push({ label, file: f });
  }
  return hits;
}

// ⑥ 行 6：测试零旁路缝（filteredEnv / baseEnv / __*ForTest 三类补丁模式）。lib 侧只查 __*ForTest
//（T3 Step 5-2 已删净 lib/lifecycle/proc.mjs 的 TEST_SEAM 缝，lib 面零命中成立）。
const TEST_SEAM_CHECKS = [
  { label: "filteredEnv 补丁模式", re: /\bfilteredEnv\b/, scope: ["packages/cdd-engine/tests"] },
  { label: "baseEnv 补丁模式", re: /\bbaseEnv\b/, scope: ["packages/cdd-engine/tests"] },
  { label: "__*ForTest 缝", re: /__\w*ForTest\b/, scope: ["packages/cdd-engine/tests", ...CDD_ENGINE_BIN] },
];
export function collectTestSeamHits(targetsOverride) {
  const hits = [];
  for (const { label, re, scope } of TEST_SEAM_CHECKS) {
    for (const f of scanTargets(targetsOverride ?? scope, re)) hits.push({ label, file: f });
  }
  return hits;
}

// ⑦ 行 7 前半：零手写 handoff 形状 —— templates.mjs 零 switch（renderHandoffStub 原手写 schema 字段
// 清单形）；finalize.mjs 写盘不经内联对象字面量 且 implement 实体化写侧必须过 normalizeHandoff
//（schema 键集唯一权威，AC6）。文件作用域按 basename 判（override 供测试注入）。
export function collectHandoffShapeHits(filesOverride = [
  "packages/cdd-engine/src/render/templates.ts",
  "packages/cdd-engine/src/artifacts/handoff/finalize.ts",
]) {
  const hits = [];
  for (const f of filesOverride) {
    const text = readFileSync(path.isAbsolute(f) ? f : path.join(ROOT, f), "utf8");
    const base = path.basename(f);
    if (base === "templates.ts" && /\bswitch\s*\(/.test(text)) {
      hits.push({ label: "手写 schema 字段清单（renderHandoffStub 原 switch 形态回渗）", file: f });
    }
    if (base === "finalize.ts") {
      if (/write(?:Own)?Handoff\([^,]+,\s*\{/.test(text)) {
        hits.push({ label: "finalize 写侧内联手写 handoff 对象字面量（应经 schema / 单点构造）", file: f });
      }
      if (!/\bnormalizeHandoff\b/.test(text)) {
        hits.push({ label: "finalize 实体化写侧未过 normalizeHandoff（schema 键集不再承重）", file: f });
      }
    }
  }
  return hits;
}

// ⑦ 行 7 后半：零 res.timedOut 单点依赖（AC6/AC7 超时判定请引擎自持）——res.timedOut 不作为独立判定
// 条件（判定 = spawnManaged 自持组合），且自持的信号子句（res.signal === "SIGTERM"）必须在 proc.mjs。
const TIMED_OUT_CONDITION_RE = /if\s*\(\s*!?\s*res\.timedOut\b/;
export function collectTimedOutSoleHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, TIMED_OUT_CONDITION_RE)) {
    hits.push({ label: `res.timedOut 作独立判定条件（超时判定非自持）: ${text.trim().slice(0, 48)}`, file: `${file}:${lineNo}` });
  }
  const procFile = "packages/cdd-engine/src/infra/proc.ts";
  const proc = readFileSync(path.join(ROOT, procFile), "utf8");
  if (!proc.includes('res.signal === "SIGTERM"')) {
    hits.push({ label: "超时自持判定缺失（proc.ts#spawnManaged 无 res.signal === SIGTERM 子句）", file: procFile });
  }
  return hits;
}

// ⑧ 行 8：engine 内零「写 context 到任意路径」调用（运行期 context 零落盘，AC4）。
const CONTEXT_WRITE_RE = /write\w*Context\b|writeFileSync\([^)]*\bcontext\b|writeFileSync\([^,]+,\s*(?:JSON\.stringify\()?\s*(?:ctx|context)\.?/;
export function collectContextWriteHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo } of scanLines(targetsOverride, CONTEXT_WRITE_RE)) {
    hits.push({ label: "「写 context 到任意路径」调用（运行期 context 零落盘）", file: `${file}:${lineNo}` });
  }
  return hits;
}

// ⑨ 行 9：cdd <sub> --help 的 Options 面 ⊆ canonical argv 的 flag 集。-h/--help 在扫面内不设
// 豁免（canonical 显式声明 help）。Task 9 迁移到 citty 声明——commander 的 program +
// helpInformation() 文本解析随 parser 一并删除：citty 下帮助的 OPTIONS 面即 defineCommand 的
// args 声明（renderUsage 由声明生成），守卫直接遍历声明树取 args 键（kebab → --flag），零子进程。
// citty 内建 --help/-h 不是声明 arg，逐命令追加进 flag 集。
export function helpOptionFlags(argDef) {
  const flags = Object.keys(argDef ?? {}).map((key) => `--${key}`);
  flags.push("--help");
  return flags;
}

export function helpFlagsNotInCanonical(flags) {
  return flags.filter((f) => !CANONICAL_ARGV_FLAGS.has(f));
}

export function collectHelpFlagHits() {
  const hits = [];
  const stack = [[mainCommand, "cdd"]];
  while (stack.length > 0) {
    const [cmd, name] = stack.pop();
    for (const f of helpOptionFlags(cmd.args)) {
      if (!CANONICAL_ARGV_FLAGS.has(f)) {
        hits.push({ label: `cdd ${name} --help Options 出现 canonical argv 外 flag: ${f}`, file: `cdd ${name} --help` });
      }
    }
    for (const [sub, def] of Object.entries(cmd.subCommands ?? {})) {
      stack.push([def, `${name} ${sub}`]);
    }
  }
  return hits;
}

// ⑩ 行 10：lib/context.mjs 内 canonical 键名零硬编码 —— flag / env / git 事实名与 canonical 全量键名
// 集合逐项比对，零字面（canonical「承重而非装饰」；本模块只承载读取，AC4）。
function canonicalFactTokens() {
  const toks = [];
  for (const a of Object.values(CONTRACT.channels.argv)) {
    if (a.flag) toks.push(a.flag);
    // review-1 nit：单字符短别名（-h 一形）跳过裸 includes —— 两字符子串会对注释里偶发的
    // "-h1" / "-handler" 一类连字符词误红；其长名 flag（--help）独立入 tok 集，守卫不失守。
    if (a.alias && !/^-[^-]$/.test(a.alias)) toks.push(a.alias);
  }
  for (const ch of Object.values(CONTRACT.channels.env)) {
    if (ch.var) toks.push(ch.var);
    for (const m of ch.markers ?? []) toks.push(m);
  }
  for (const g of Object.values(CONTRACT.channels.git)) {
    if (g.derivation) toks.push(g.derivation);
  }
  return toks.filter(Boolean);
}

export function collectContextModuleHardcodeHits(fileOverride = "packages/cdd-engine/src/infra/context.ts") {
  const abs = path.isAbsolute(fileOverride) ? fileOverride : path.join(ROOT, fileOverride);
  const text = readFileSync(abs, "utf8");
  const hits = [];
  for (const tok of canonicalFactTokens()) {
    if (text.includes(tok)) {
      hits.push({ label: `src/infra/context.ts 硬编码 canonical 事实名: ${tok}（承重 → 装饰的回退）`, file: fileOverride });
    }
  }
  return hits;
}

// ⑪ 行 11：engine src 内零「派生值经残留文件回读为输入」的调用点。读侧全枚举白名单
//（progress 计数器 · prev-round handoff——皆显式路径参数）锚在承重面；「最近一次」扫描语汇零命中。
const RESIDUAL_SCAN_RE = /latestHandoff|latestReview|latestRound|mostRecent|findLast|mtime|scanLatest|resolveLatest/i;
export function collectResidualRereadHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, RESIDUAL_SCAN_RE)) {
    hits.push({ label: `「最近一次」残留回读扫描（读侧须全枚举白名单）: ${text.trim().slice(0, 48)}`, file: `${file}:${lineNo}` });
  }
  const dirs = listTargetFiles(targetsOverride);
  for (const f of dirs) {
    const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    if (readFileSync(abs, "utf8").includes("readdirSync") && f !== "packages/cdd-engine/src/artifacts/handoff/naming.ts") {
      hits.push({ label: "readdirSync 白名单外（以目录扫描替代显式路径参数即「最近一次」回渗）", file: f });
    }
  }
  const rtFile = "packages/cdd-engine/src/dispatch/task.ts";
  const rt = readFileSync(path.join(ROOT, rtFile), "utf8");
  if (!rt.includes("prevHandoffPath")) {
    hits.push({ label: "prev-round handoff 显式路径读取（prevHandoffPath）缺失", file: rtFile });
  }
  return hits;
}

// ⑫ 行 13：stdout counters 行由 canonical 类目表派生 —— 构造点零手写计数器名/标签；六类名「以类目身份
// 出现」面零手写（failure_category 赋值 / isIncompleteDispatch 判定）；counters 不进 handoff 契约且
// properties 计数不变（14 / 9，除 failure_category 外零新增）。四字段名与标签经 failure-categories.json。
const COUNTER_FIELDS = canonicalCounters().map((c) => c.field);
const COUNTER_LABELS = canonicalCounters().map((c) => c.label);
const CATEGORY_IDS = Object.values(FAILURE_CATEGORIES).map((c) => c.id);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function collectCountersContractHits({
  constructFiles = ["packages/cdd-engine/src/artifacts/progress.ts", "packages/cdd-engine/src/rules/failure.ts"],
  engineScope = CDD_ENGINE_BIN,
  taskSchema = "packages/cdd-engine/templates/schema/task-handoff-schema.json",
  docsSchema = "packages/cdd-engine/templates/schema/docs-handoff-schema.json",
} = {}) {
  const hits = [];
  // 构造点零手写：双引号紧邻计数器字段名/H1 标签即手写（"timeoutCount=" 一类也是）。单行限定
  //（按行扫描，不做跨行区间匹配）；\b 锚标签短名（"timeout" …）不误伤 "timeout-exhausted" 语义词。
  const quoted = new RegExp(`"(${[...COUNTER_FIELDS, ...COUNTER_LABELS].map(escRe).join("|")})\\b`);
  for (const f of constructFiles) {
    const text = readFileSync(path.isAbsolute(f) ? f : path.join(ROOT, f), "utf8");
    const m = quoted.exec(text);
    if (m) {
      hits.push({ label: `counters 构造点手写计数器名/标签字面量: ${m[1]}`, file: f });
    }
  }
  // 类目以字符串字面量身份出现（六类名作 failure_category 字面值 / isIncompleteDispatch 字面参 /
  // incrementFailureCounter 字面参；status 枚举值不属此类，故不锚 status 键）。类目名单经 canonical。
  const failureCategoryRe = new RegExp(
    `failure_category:\\s*["'](?:${CATEGORY_IDS.map(escRe).join("|")})["']|isIncompleteDispatch\\(["']|incrementFailureCounter\\([^,]+,\\s*["']`,
  );
  for (const { file, lineNo, text } of scanLines(engineScope, failureCategoryRe)) {
    hits.push({ label: `类目以字符串字面量身份出现（应经 FAILURE_CATEGORIES 承重）: ${text.trim().slice(0, 48)}`, file: `${file}:${lineNo}` });
  }
  for (const [name, schemaPath] of [["task", taskSchema], ["docs", docsSchema]]) {
    const abs = path.isAbsolute(schemaPath) ? schemaPath : path.join(ROOT, schemaPath);
    const schema = JSON.parse(readFileSync(abs, "utf8"));
    const props = Object.keys(schema.properties ?? {});
    for (const fld of COUNTER_FIELDS) {
      if (props.includes(fld)) hits.push({ label: `counter ${fld} 泄漏进 ${name} handoff schema（counters 不进契约）`, file: schemaPath });
    }
    const expected = name === "task" ? 14 : 9;
    if (props.length !== expected || !props.includes("failure_category")) {
      hits.push({ label: `${name} handoff schema properties 计数 ${props.length} ≠ ${expected}（除 failure_category 外不得增减）`, file: schemaPath });
    }
  }
  return hits;
}

// 汇总：行 14（(?<!-)handoff-schema）归 T11（collectHandoffSchemaHits，见下节），不在本组 ——
// 12 条 engine 侧 + live-repo 零残留断言。
export function collectChannelAuditHits() {
  return [
    ...collectProcessCwdAudit(),
    ...collectEnvDirectReadHits(),
    ...collectEnvPassThroughHits(),
    ...collectEnvSpreadHits(),
    ...collectSixEnvKeyHits(),
    ...collectPathArgResolverHits(),
    ...collectRootResolverHits(),
    ...collectTestSeamHits(),
    ...collectHandoffShapeHits(),
    ...collectTimedOutSoleHits(),
    ...collectContextWriteHits(),
    ...collectHelpFlagHits(),
    ...collectContextModuleHardcodeHits(),
    ...collectResidualRereadHits(),
    ...collectCountersContractHits(),
  ];
}

export function checkChannelAudit() {
  const hits = collectChannelAuditHits();
  assert(
    hits.length === 0,
    `CHANNEL AUDIT FOUND — engine 契约面守卫（§2.8 行 1–11、13）:\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — channel audit（§2.8 行 1–11、13）零违规");
}

// 守卫面并集（wiring guard 钉死 scope 缩小即 fail）。
export const CHANNEL_AUDIT_TARGETS = [
  "packages/cdd-engine/src",
  "packages/cdd-engine/templates/schema",
  "packages/cdd-engine/tests",
  "packages/osuperpowers/skills",
  "scripts",
];

function checkStaleLexicon() {
  const hits = collectStaleLexiconHits();
  assert(
    hits.length === 0,
    `STALE LEXICON FOUND — mechanism positions (zero-exemption):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — stale-lexicon zero in mechanism positions");
}

function checkGateLexicon() {
  const hits = collectGateLexiconHits();
  assert(
    hits.length === 0,
    `GATE LEXICON FOUND — mechanism positions (zero-exemption):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — gate-lexicon zero in mechanism positions");
}

// =====================================================================
// Task 10 — init 删除 + 版本戳机制删除 反向守卫（design §2.6.2 / §2.8 行 19-20）
// =====================================================================
// ① shipped 非 emit 面（skills/** · 插件 README——contentRoot: "." 的发布面）零版本字面量
//（osuperpowers-version 戳——写方 release/version-packages.mjs 与读方 validate/version-sync.mjs
// 已连根删除，版本真相收敛为 package.json + emit 产物）；② shipped 面（根 README.md · 插件
// README）+ 协作者面（.changeset/README.md）零 `/init` 引用（marketplace 安装指引已内联进
// README 安装节，`/init` 入口不存在）。scope 与 §2.6.2 反向守卫行、§2.8 行 19/20 逐字同一；
// `.changeset/README.md` 属协作者面（发布的是 packages/*/），不进 shipped 断言 scope。
export const SHIPPED_SURFACE_TARGETS = [
  "packages/osuperpowers/skills",
  "packages/osuperpowers/README.md",
];
export const INIT_REFERENCE_TARGETS = [
  "README.md",
  "packages/osuperpowers/README.md",
  ".changeset/README.md",
];

// 戳字面（机制唯一载体 = HTML 注释形 `<!-- osuperpowers-version: X -->`，子串匹配覆盖
// 注释外的不规范形；与 R2 的「唯一载体 = skills/init/SKILL.md:6」删除面口径一致）。
const VERSION_STAMP_RE = /osuperpowers-version/;
const INIT_REFERENCE_RE = /\/init/;

/** ① shipped 非 emit 面零版本字面量。targetsOverride 供测试注入临时目标。 */
export function collectVersionStampHits(targetsOverride) {
  const hits = [];
  for (const f of scanTargets(targetsOverride ?? SHIPPED_SURFACE_TARGETS, VERSION_STAMP_RE)) {
    hits.push({ label: "shipped 非 emit 面版本字面量（osuperpowers-version 戳）", file: f });
  }
  return hits;
}

/** ② shipped 面 + 协作者面零 `/init` 引用。targetsOverride 供测试注入临时目标。 */
export function collectInitReferenceHits(targetsOverride) {
  const hits = [];
  for (const f of scanTargets(targetsOverride ?? INIT_REFERENCE_TARGETS, INIT_REFERENCE_RE)) {
    hits.push({ label: "/init 引用（shipped + 协作者面）", file: f });
  }
  return hits;
}

/** 汇总（checkShippedGuards 与测试共用）：两条 guards 的命中 { label, file } 列表。 */
export function collectShippedGuardHits() {
  return [...collectVersionStampHits(), ...collectInitReferenceHits()];
}

function checkShippedGuards() {
  const hits = collectShippedGuardHits();
  assert(
    hits.length === 0,
    `SHIPPED GUARD FOUND — init/版本戳机制逆向残留（§2.8 行 19-20）:\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — shipped-surface guards（版本字面量 + /init 零残留）");
}

// =====================================================================
// Task 11 — handoff-schema.md 删除 反向守卫（design §2.8 行 14）
// =====================================================================
// `(?<!-)handoff-schema` 零命中条目（行 14 由本任务唯一承接，删除动作与守卫同 commit）：
// 裸名形（`// 对齐 …表` cite）与路径形（`docs/handoff-schema.md` / `skills/cli-driven-development/
// docs/handoff-schema.md`）一律命中；负向后顾豁免 canonical schema 文件名（`task-handoff-schema.json`
// / `docs-handoff-schema.json` 的 `handoff-schema` 均前接 `-`）。scope = packages/cdd-engine/​{bin,lib}
// + tests + packages/osuperpowers 全目录。
// 本条目不计入 T8 的 collectChannelAuditHits（其 12 条指 §2.8 行 1–11、13）；行 21 的 task-review
// 守卫归 T15 Step 4b，不在此。scripts/ 不在 scope 内，本文件写字面无自噬风险。
export const HANDOFF_SCHEMA_TARGETS = [...CDD_ENGINE_BIN, "packages/cdd-engine/tests", "packages/osuperpowers"];
const HANDOFF_SCHEMA_RE = /(?<!-)handoff-schema/;

/** targetsOverride 供测试注入临时目录；hits = { label, file } 列表。 */
export function collectHandoffSchemaHits(targetsOverride) {
  const hits = [];
  for (const f of scanTargets(targetsOverride ?? HANDOFF_SCHEMA_TARGETS, HANDOFF_SCHEMA_RE)) {
    hits.push({ label: "handoff-schema 回渗（已删文件/路径名，应指 engine canonical schema JSON）", file: f });
  }
  return hits;
}

function checkHandoffSchema() {
  const hits = collectHandoffSchemaHits();
  assert(
    hits.length === 0,
    `HANDOFF SCHEMA LEXICON FOUND — deleted handoff-schema.md path/name (§2.8 行 14):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — handoff-schema（§2.8 行 14）零残留");
}

// =====================================================================
// Task 16 — skills 面守卫（design §2.8 行 12/15/16/17/18；AC5/AC11/AC14 的 skills 侧落点）
// =====================================================================
// 五条守卫并入 collectSkillSurfaceHits()（与 T8 的 collectChannelAuditHits() 同构），由
// checkSkillSurface() 并入既有 5c 步（块数不变）。守卫 scope 全部落在 packages/osuperpowers/skills/
// 内；scripts/ 不在任一 scope——守卫本体不成为被守卫语汇的载体。
//   行 17 — 零上游文档 read（\bvendors\/ · \bsuperpowers\/.*SKILL\.md · Read[- ]Upstream ·
//            \bread upstream\b）+ 上游引用一律 `/<plugin>:<skill>` 斜杠形（无斜杠前缀的上游
//            plugin:skill 引用 → hit；同插件 `osuperpowers:` 引用不属上游）。
//   行 15 — 零引擎内部结构依赖（\bCDD_[A-Z_]+\b · \bprogress\.json\b · task-\d+-(review|fix|
//            implement)-\d*\.?json）。scope = design AC5 的 7 个编排型 skill 逐名枚举（见
//            ORCHESTRATOR_SKILLS）。report-issues 显式排除——AC5 原文：「例外（设计内，非缺口）：
//            report-issues 的 progress.json#plan 读取是 program 通道的首跳（§2.5.4 的目的正是使其
//            可用），不属「引擎内部结构依赖」——该处的去留归 P5 的目标流程（届时可改指命令输出
//            契约）」。排除只作用于本条；report-issues 仍在本组其余 4 条的 skills 面 scope 内
//            （实测其对 CDD_* / fix-inline / vendors/ / _docs/ 均零命中）。7 名枚举（含 finishing，
//            不是 6 个）为逐字同源清单，不得用 skills/** 通配覆盖——通配会让 guard 在 report-issues
//            上不可达且漏扫未来新 skill。
//   行 16 — 零 fix-inline（修复一律 `cdd fix` 形，§2.7.3）；且每个评审循环 fix 节点（mermaid 节点
//            label 含 fix——fix-task / branch-fix / fix-spec / fix-plan）的 `### `label`` 节须出现
//            `cdd fix` 命令形。
//   行 12 — ① cli-driven-development/SKILL.md 的 `## Failure Modes` 短表数据行首列 ⊆ canonical
//            类目集（FAILURE_CATEGORIES，本文件经 cdd-engine 唯一读取入口取，不写字面第二份）∪
//            handoff 状态枚举白名单（声明点 = task-handoff-schema.json 的 status.enum；防御性放行，
//            与 failure_category 的 enum 是两处独立声明——TIMEOUT 的重名不构成类目身份）；
//            ② 类目语义零复述——engineRecoveryCount / countsTowardStopping / timeout-exhausted /
//            计入 Stopping 措辞在 skills 面零命中（skills 只可引用类目名）。
//   行 18 — 零 _docs/ 引用（\b_docs\/ 路径形 + rule-review-stopping 锚点形/裸提及）——T15
//            一次性删除的常驻化；scope 恰为 skills 面（不扩至 engine 注入面 / 治理入口面）。
export const ORCHESTRATOR_SKILLS = [
  "packages/osuperpowers/skills/brainstorming/SKILL.md",
  "packages/osuperpowers/skills/writing-single-spec/SKILL.md",
  "packages/osuperpowers/skills/writing-overall-spec/SKILL.md",
  "packages/osuperpowers/skills/writing-phase-spec/SKILL.md",
  "packages/osuperpowers/skills/writing-plans/SKILL.md",
  "packages/osuperpowers/skills/cli-driven-development/SKILL.md",
  "packages/osuperpowers/skills/finishing/SKILL.md",
];
const CDD_SKILL = "packages/osuperpowers/skills/cli-driven-development/SKILL.md";

// 负向语汇取「token 形」而非「/ 前缀形」：历史违规形态是反引号/空白前导的路径引用
//（`vendors/mattpocock-skills/…` · `_docs/review.md`），`/` 前缀正则放行这些真形态；
// \b（_ 为词字符）仍拒绝对含连字符的衍生词（如 svendors/）误报。
const UPSTREAM_READ_RE = /\bvendors\/|\bsuperpowers\/.*SKILL\.md|Read[- ]Upstream|\bread upstream\b/i;
const UPSTREAM_REF_SLASH_RE = /(?<!\/)\b(?:superpowers|mattpocock-skills|impeccable):[a-z0-9-]+\b/;
const INTERNAL_DEP_RE = /\bCDD_[A-Z_]+\b|\bprogress\.json\b|task-\d+-(?:review|fix|implement)-\d*\.?json/;
const FIX_INLINE_RE = /fix-inline/;
const FAILURE_SEMANTICS_RE = /engineRecoveryCount|countsTowardStopping|timeout-exhausted|计入\s*Stopping/;
const DOCS_REF_RE = /\b_docs\/|rule-review-stopping/;

/** handoff 状态枚举白名单（声明点 = task-handoff-schema.json 的 status.enum；防御性放行）。 */
function handoffStatusWhitelist() {
  const schema = JSON.parse(
    readFileSync(path.join(ROOT, "packages/cdd-engine/templates/schema/task-handoff-schema.json"), "utf8"),
  );
  return new Set(schema.properties.status.enum ?? []);
}

/** 行 12 ① 抽取：`## Failure Modes` 短表数据行首列（§2.5.2 派生通道 ② 的唯一消费方 =
 *  cli-driven-development；抽取面为裁定面，实现不得自行发明扫面）。 */
export function failureModeCandidates(skillText) {
  const candidates = [];
  const lines = skillText.split("\n");
  let inSection = false;
  let afterHeader = false;
  for (const line of lines) {
    if (/^## /.test(line)) {
      if (inSection) break;
      inSection = /^## Failure Modes\b/.test(line);
      continue;
    }
    if (!inSection) continue;
    const t = line.trim();
    if (t.startsWith("|") && t !== "|") {
      if (afterHeader) {
        const cell = t.split("|")[1]?.trim();
        if (cell) candidates.push(cell);
      } else {
        // markdown 分隔行（|---|---| 与 | --- |）：去掉 | 与空白后只剩 -/:/* 即分隔行。
        const stripped = t.replace(/\|/g, "").trim();
        if (stripped !== "" && /^[\s:*-]+$/.test(stripped)) afterHeader = true;
      }
    }
  }
  return candidates;
}

/** 行 12 ① 失败类目名集合 ⊆ canonical 类目集 ∪ 状态枚举白名单。fileOverride 供测试注入临时文件。 */
export function collectFailureModeCategoryHits(fileOverride = CDD_SKILL) {
  const abs = path.isAbsolute(fileOverride) ? fileOverride : path.join(ROOT, fileOverride);
  const text = readFileSync(abs, "utf8");
  const allowed = new Set([
    ...Object.values(FAILURE_CATEGORIES).map((c) => c.id),
    ...handoffStatusWhitelist(),
  ]);
  const hits = [];
  for (const cand of failureModeCandidates(text)) {
    if (!allowed.has(cand)) {
      hits.push({ label: `失败类目名不在 canonical（§2.8 行 12）: ${cand}`, file: fileOverride });
    }
  }
  return hits;
}

/** 行 12 ② 类目语义零复述（skills 面；skills 只可引用类目名）。 */
export function collectFailureModeSemanticsHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, FAILURE_SEMANTICS_RE)) {
    hits.push({ label: `类目语义复述（skills 只可引用类目名）: ${text.trim().slice(0, 48)}`, file: `${file}:${lineNo}` });
  }
  return hits;
}

/** 行 17（负）零上游文档 read（skills 面）。 */
export function collectUpstreamReadHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const f of scanTargets(targetsOverride, UPSTREAM_READ_RE)) {
    hits.push({ label: "上游文档 read 回渗（vendors/ · 上游 SKILL.md · Read-Upstream）", file: f });
  }
  return hits;
}

/** 行 17（正）上游引用一律 `/plugin:skill` 斜杠形（skills 面；同插件 osuperpowers: 引用不属上游）。 */
export function collectUpstreamSlashFormHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, UPSTREAM_REF_SLASH_RE)) {
    hits.push({ label: `上游引用非 /plugin:skill 斜杠形: ${text.trim().slice(0, 48)}`, file: `${file}:${lineNo}` });
  }
  return hits;
}

/** 行 15 零引擎内部结构依赖。filesOverride = 7 个编排型 skill 的显式文件清单（测试注入临时文件）。 */
export function collectInternalDependencyHits(filesOverride = ORCHESTRATOR_SKILLS) {
  const hits = [];
  for (const f of scanTargets(filesOverride, INTERNAL_DEP_RE)) {
    hits.push({ label: "编排型 skill 引擎内部结构依赖（CDD_* · progress.json · handoff 文件名）", file: f });
  }
  return hits;
}

/** 行 16（负）零 fix-inline（skills 面）。 */
export function collectFixInlineHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const f of scanTargets(targetsOverride, FIX_INLINE_RE)) {
    hits.push({ label: "fix-inline 回渗（修复一律 cdd fix 形，§2.7.3）", file: f });
  }
  return hits;
}

/** mermaid 图内含 "fix" 的节点 label（评审循环的修节点形：fix-task / branch-fix / fix-spec / fix-plan）。 */
function extractFixNodeLabels(src) {
  const m = src.match(/```mermaid\n([\s\S]*?)```/);
  if (!m) return [];
  const labels = [];
  for (const lm of m[1].matchAll(/(\w+)\[([^\]]+)\]/g)) {
    const label = lm[2].trim();
    if (/\bfix\b/.test(label)) labels.push(label);
  }
  return labels;
}

/** 行 16（正）每个评审循环 fix 节点（mermaid label 含 fix）的 `### `label`` 节须出现 `cdd fix`。 */
export function collectReviewLoopFixCddHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const f of walkTargetFiles(targetsOverride)) {
    if (!f.endsWith("SKILL.md")) continue;
    const src = readFileSync(f).toString("utf8");
    for (const label of extractFixNodeLabels(src)) {
      const lines = src.split("\n");
      const head = `### \`${label}\``;
      const start = lines.findIndex((l) => l === head);
      if (start === -1) {
        hits.push({ label: `评审循环节点 ${label} 缺失 ### 节（digraph 已声明）`, file: path.relative(ROOT, f) });
        continue;
      }
      let section = [];
      // 断界取 /^#{1,3} /（### 级别即停）：同一 ## 区块内的后续 ### `node` 节
      // 是相邻节点、不属本节点散文——若只按 ## 断界，前一 fix 节点缺 cdd fix 会被
      // 后一（含 cdd fix 的）fix 节点的节内容掩蔽而假绿（review-1 nit）。
      for (let i = start + 1; i < lines.length; i++) {
        if (/^#{1,3} /.test(lines[i])) break;
        section.push(lines[i]);
      }
      if (!/cdd fix/.test(section.join("\n"))) {
        hits.push({ label: `评审循环节点 ${label} 缺少 cdd fix 命令形（§2.8 行 16）`, file: path.relative(ROOT, f) });
      }
    }
  }
  return hits;
}

/** 行 18 零 _docs/ 引用（skills 面；T15 一次性删除的常驻化）。 */
export function collectDocsRefHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const f of scanTargets(targetsOverride, DOCS_REF_RE)) {
    hits.push({ label: "_docs/ 引用回渗（含 rule-review-stopping 锚点形/裸提及，§2.8 行 18）", file: f });
  }
  return hits;
}

/** 汇总（checkSkillSurface 与测试共用）：五条 skills 面守卫的命中 { label, file } 列表。 */
export function collectSkillSurfaceHits() {
  return [
    ...collectUpstreamReadHits(),
    ...collectUpstreamSlashFormHits(),
    ...collectInternalDependencyHits(),
    ...collectFixInlineHits(),
    ...collectReviewLoopFixCddHits(),
    ...collectFailureModeCategoryHits(),
    ...collectFailureModeSemanticsHits(),
    ...collectDocsRefHits(),
  ];
}

function checkSkillSurface() {
  const hits = collectSkillSurfaceHits();
  assert(
    hits.length === 0,
    `SKILL SURFACE FOUND — skills 面守卫（§2.8 行 12/15/16/17/18）:\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — skills 面守卫（§2.8 行 12/15/16/17/18）零违规");
}

// 块数不变（12）：checkStaleLexicon 与 T6 的 checkGateLexicon 并入既有 5c.run 同一步内部 —
// 先 checkZeroResidue 再 checkStaleLexicon 后 checkGateLexicon；T8 追加 checkChannelAudit（§2.8
// 行 1–11、13 的 engine 侧 12 条守卫）；T10 追加 checkShippedGuards（§2.8 行 19-20 的
// shipped 面两条反向守卫）；T11 追加 checkHandoffSchema（§2.8 行 14 的零命中守卫）；T16 追加
// checkSkillSurface（§2.8 行 12/15/16/17/18 的 skills 面五条守卫）；grepTargets
// 扩为含 cdd-engine src+templates 供 wiring guard 钉死。channelTargets = channel-audit
// 守卫面并集（wiring guard 钉死 scope 缩小即 fail）。
export const steps = [
  {
    name: "5c. engine zero-residue + channel-audit grep",
    run: () => {
      checkZeroResidue();
      checkStaleLexicon();
      checkGateLexicon();
      checkChannelAudit();
      checkShippedGuards();
      checkHandoffSchema();
      checkSkillSurface();
    },
    grepTargets: RESIDUE_TARGETS,
    channelTargets: CHANNEL_AUDIT_TARGETS,
  },
];

runIfMain(import.meta.url, steps);