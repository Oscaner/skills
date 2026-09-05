#!/usr/bin/env node
// scripts/ci-validate.mjs — P5 T4: Node validate orchestration (12 blocks).
//
// The marketplace's "does the manifest chain still resolve" IS the test — this
// orchestrator runs every sub-check that guards it. Subprocess steps use
// execa (emit/version/marketplace/node:test); structural checks run
// in-process. Failure is structured:
// `console.error("== FAIL: <step> ==")` + message, exit code 1.
//
// The step list is exported (steps) so the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) can assert osuperpowers coverage
// is not dropped — mirroring the legacy bash wiring guard.

import { execaSync } from "execa";
import { accessSync, constants, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "tinyglobby";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isExecutable(p) {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function countSkillsWithMarkdown(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md")))
    .length;
}

// ---------------------------------------------------------------------------
// steps — registered in run order; exported for the wiring guard
// ---------------------------------------------------------------------------

export const steps = [];

function subprocessStep(name, cmd, args, opts = {}) {
  steps.push({
    name,
    cmd,
    args,
    run: () => execaSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts }),
  });
}

function checkStep(name, fn, meta = {}) {
  steps.push({ name, run: fn, ...meta });
}

// 0. unified emit freshness — emit-check against committed products (no write)
subprocessStep("0. unified emit freshness (emit-check)", "node", ["scripts/run.mjs", "emit-check"]);

// 5b. osuperpowers plugin validation
checkStep("5b. osuperpowers plugin validation", () => console.log("OK — osuperpowers plugin validation"));

function checkOsuperpowersSkillsCount() {
  const p = path.join(ROOT, "packages/osuperpowers");
  const manifest = JSON.parse(readFileSync(path.join(p, ".claude-plugin/plugin.json"), "utf8"));
  const skills = manifest.skills;
  const EXPECTED = 8; // 7 emitters + init (P5 removed three legacy skills, #169 removed cli-task, P2 removed debugging+verification, P11 added cli-research)
  const EMITTERS_LABEL = "7 emitters + init";
  let n;
  if (skills === null || skills === undefined) {
    const dir = path.join(p, "skills");
    assert(existsSync(dir), `missing default skills dir: ${dir}`);
    n = countSkillsWithMarkdown(dir);
    assert(n === EXPECTED, `expected ${EXPECTED} osuperpowers skills (${EMITTERS_LABEL}), got ${n}`);
    console.log(`OK — ${n} osuperpowers skills (default skills/ discovery)`);
  } else if (typeof skills === "string") {
    const dir = path.join(p, skills.replace(/^\.\//, ""));
    assert(existsSync(dir), `missing skills dir: ${dir}`);
    n = countSkillsWithMarkdown(dir);
    assert(n === EXPECTED, `expected ${EXPECTED} osuperpowers skills (${EMITTERS_LABEL}), got ${n}`);
    console.log(`OK — ${n} osuperpowers skills (directory ${skills})`);
  } else {
    const missing = skills.filter((s) => !existsSync(path.join(p, s.replace(/^\.\//, ""))));
    assert(missing.length === 0, `skills[] points to missing dirs: ${missing}`);
    assert(skills.length === EXPECTED, `expected ${EXPECTED} osuperpowers skills (${EMITTERS_LABEL}), got ${skills.length}`);
    console.log(`OK — ${skills.length} osuperpowers skills (explicit list)`);
  }
}
checkStep("5b. osuperpowers skills-count", checkOsuperpowersSkillsCount);

subprocessStep("5b. rule-reference.test.mjs (semantic)", "node", [
  "--test",
  "packages/osuperpowers/tests/rule-reference.test.mjs",
]);

// node:test 两棵树：行为/集成树 packages/osuperpowers/tests/（helpers.mjs + rule-reference +
// ci-validate.test.mjs）+ 模块树 bin/engine/tests/ + gate + init + utils。
// 用 glob 而非裸目录（本环境 node --test <dir> 会把目录当模块加载而失败；glob 由 runner 展开）。
// 旧 bash engine 测试已全部迁移 → Node 等价实现由 runner/registry/templates/exec 模块测试覆盖。
subprocessStep("5b. node:test engine + gate + init + utils + behavior", "node", [
  "--test",
  "packages/osuperpowers/tests/*.test.mjs",
  "packages/osuperpowers/bin/gate/tests/*.test.mjs",
  "packages/osuperpowers/bin/init/tests/*.test.mjs",
  "packages/osuperpowers/bin/utils/tests/*.test.mjs",
]);

// 5b1. cdd-engine Vitest suite (engine code moved out of bin/engine in Task 11)
subprocessStep("5b1. cdd-engine Vitest engine suite", "pnpm", [
  "-C",
  "packages/cdd-engine",
  "test",
]);

subprocessStep("5b. wiring guard: ci-validate.test.mjs", "node", ["--test", "packages/osuperpowers/tests/ci-validate.test.mjs"]);

// 5b2. osuperpowers gate hooks
function checkOsuperpowersGateHooks() {
  const p = path.join(ROOT, "packages/osuperpowers");
  for (const f of ["hooks/hooks.json", "hooks/hooks-cursor.json"]) {
    assert(existsSync(path.join(p, f)), `missing: ${f}`);
  }
  for (const f of [
    "bin/gate/adapters/claude.mjs",
    "bin/gate/adapters/cursor.mjs",
  ]) {
    assert(isExecutable(path.join(p, f)), `not executable: ${f}`);
  }
  console.log("OK — osuperpowers gate hooks executable");
}
checkStep("5b2. osuperpowers gate hooks executable", checkOsuperpowersGateHooks);

// 5c. engine zero-residue grep (sdd_/spor- — must not regress)
const RESIDUE_TARGETS = [
  "packages/osuperpowers/bin",
  "packages/osuperpowers/skills",
];
const RESIDUE_RE = /\b(sdd_|_sdd_|SDD_|sdd-run-|spor-)/;
function checkZeroResidue() {
  const hits = [];
  for (const t of RESIDUE_TARGETS) {
    // tinyglobby replaces the hand-written recursive walk; `dot: true` is
    // required so hidden dirs (e.g. .claude-plugin/) are scanned too.
    for (const f of globSync("**/*", { cwd: path.join(ROOT, t), absolute: true, dot: true })) {
      const buf = readFileSync(f);
      if (buf.includes(0)) continue; // binary — grep -rn reports, doesn't content-match
      if (RESIDUE_RE.test(buf.toString("utf8"))) hits.push(path.relative(ROOT, f));
    }
  }
  assert(hits.length === 0, `RESIDUE FOUND — sdd_/SDD_/sdd-run-/spor- in engine executable products:\n  ${hits.join("\n  ")}`);
  console.log("OK — zero residue in engine executable products");
}
checkStep("5c. engine zero-residue grep", checkZeroResidue, { grepTargets: RESIDUE_TARGETS });

// 6. marketplace validate
subprocessStep("6. marketplace validate", "node", ["scripts/validate-marketplace.mjs"]);

// 7. scripts unit tests (vitest) — vitest.config.mjs include: scripts/**/*.test.mjs
subprocessStep("7. scripts unit tests (vitest)", "pnpm", ["exec", "vitest", "run"]);

// 8–10. version sync
subprocessStep("8-10. version sync", "node", ["scripts/validate-version-sync.mjs"]);

// 11. mattpocock-skills resolvable（bash-lenient 对齐：submodule 缺失 → warn 不 fail ——
// fresh clone 未 `git submodule update --init`；真正解析错误由 validate-version-sync 兜住）。
function checkSubmodule() {
  if (!existsSync(path.join(ROOT, "vendors/mattpocock-skills/skills"))) {
    console.warn("WARN — vendors/mattpocock-skills/skills missing (bash-lenient: skipped; fresh clone needs `git submodule update --init`)");
    return;
  }
  console.log("OK");
}
checkStep("11. mattpocock-skills resolvable", checkSubmodule);

// ---------------------------------------------------------------------------
// runner — main() returns 0/1 (the CLI wrapper sets exitCode); importable for tests
// ---------------------------------------------------------------------------

export function main(stepsArg = steps) {
  for (const s of stepsArg) {
    try {
      console.log(`== ${s.name} ==`);
      s.run();
      console.log("OK");
    } catch (e) {
      console.error(`== FAIL: ${s.name} ==`);
      console.error(e?.message ?? String(e));
      return 1;
    }
  }
  console.log("ALL PASS");
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  Promise.resolve(main()).then(code => process.exit(code != null ? code : 1)).catch(() => process.exit(1));
}
