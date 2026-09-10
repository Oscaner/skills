#!/usr/bin/env node
// scripts/validate/residue.mjs — block 5c: engine zero-residue + stale-lexicon + gate-lexicon grep.
// (sdd_/SDD_/sdd-run-/spor- must not regress in engine executable products; the
// stale-lexicon checks pin the P4/P6 migration end-state — old docs-review
// filenames, PASS=< lens params, D1|D2|D3 lens names, resolve-hit / gh issue
// reopen resolver vocabulary, the task-review mode, and P4 degraded filenames —
// plus the P5 gate-lexicon checks pin the cdd-gate subsystem removal (bin/gate/
// path, CDD_GATE env, cdd-gate-core, gateDecide, deleted gate adapters) — must
// not creep back into mechanism/document positions.)
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
const CDD_ENGINE_BIN = ["packages/cdd-engine/bin"];
const CDD_ENGINE = [...CDD_ENGINE_BIN, "packages/cdd-engine/templates"];
// T9 nit3（DRY）：跨 skills + cdd-engine（bin+templates）的机制位置集合 —— 5 个 check 共享。
const ALL_MECH_POSITIONS = [...OSKILLS, ...CDD_ENGINE];

const RESIDUE_TARGETS = [
  "packages/osuperpowers/bin",
  "packages/osuperpowers/skills",
  "packages/cdd-engine/bin",
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
  // T9 nit6：task-review 旧 mode 名 scope 用 CDD_ENGINE（bin+templates）而非仅 CDD_ENGINE_BIN ——
  // templates（implement/fix/review）历史引用旧 mode 名已成回渗源，templates 也须入扫。
  { label: "old mode task-review", re: /task-review/, scope: CDD_ENGINE },
  { label: "P4 degraded names", re: /(spec|plan)-1\.json|doc-fix-/, scope: CDD_ENGINE },
  { label: "flat docs-review root 回退", re: /\.superpowers\/docs-review/, scope: CDD_ENGINE_BIN },
  { label: "dogfood as label", re: /labels [^\n]*dogfood|"dogfood",/, scope: OSKILLS },
];

// T6（P5）：gate 专属语汇零豁免（镜像 P6 F5 stale-lexicon 守卫；与 T7 grep1 口径一致）。
// cdd-gate 子系统（packages/osuperpowers/bin/gate/ 全树删除）后，语汇不得回渗机制/文档表层：
// cdd-engine bin + osuperpowers skills + docs/maintainers + 根 README。豁免（注册非目标）：
// docs/superpowers/（spec/plan 描述删除面必携 gate 语汇）、packages/osuperpowers/CHANGELOG.md
// （历史记录，非机制位置）、osuperpowers/cdd-engine tests/（no-gate.test.mjs 反向守卫须
// 引用该语汇，collectGateLexiconHits 不经其扫描）——与 T2 Step 4 docs-runner CDD_GATE 注释
// 清理口径一致，靠「模式取紧致形（路径/门字形）」而非裸 `gate`/`cdd-gate-` 避免误报：
// ship gate / evidence-gate / {{HARD_GATE}} / cdd-gate-test git 身份均零命中。
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
// T7 N③: 缺失 target → statSync ENOENT 晦涩崩溃；改为带 target 的清晰 Error（对齐 G7/G8
// 「deleted path has returned」风格），未来文件改名/删除以可读 guard 失败呈现而非 crash。
export function scanTargets(targets, re) {
  const hits = [];
  for (const t of targets) {
    const abs = path.isAbsolute(t) ? t : path.join(ROOT, t);
    if (!existsSync(abs)) {
      throw new Error(`scanTargets: target missing — ${t} (deleted file? adjust target set or this sweep scope)`);
    }
    const paths = statSync(abs).isDirectory()
      ? globSync("**/*", { cwd: abs, absolute: true, dot: true })
      : [abs];
    for (const f of paths) {
      const buf = readFileSync(f);
      if (buf.includes(0)) continue; // binary — grep -rn reports, doesn't content-match
      if (re.test(buf.toString("utf8"))) hits.push(path.relative(ROOT, f));
    }
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

export function collectStaleLexiconHits() {
  const hits = [];
  for (const { label, re, scope } of STALE_LEXICON_CHECKS) {
    for (const f of scanTargets(scope, re)) hits.push({ label, file: f });
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

// 块数不变（12）：checkStaleLexicon 与 T6 的 checkGateLexicon 并入既有 5c.run 同一步内部 ——
// 先 checkZeroResidue 再 checkStaleLexicon 后 checkGateLexicon；grepTargets 扩为含
// cdd-engine bin+templates 供 wiring guard 钉死。
export const steps = [
  {
    name: "5c. engine zero-residue grep",
    run: () => {
      checkZeroResidue();
      checkStaleLexicon();
      checkGateLexicon();
    },
    grepTargets: RESIDUE_TARGETS,
  },
];

runIfMain(import.meta.url, steps);