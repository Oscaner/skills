#!/usr/bin/env node
// scripts/ci-validate.mjs — P5 T4: Node validate orchestration (12 blocks).
//
// The marketplace's "does the manifest chain still resolve" IS the test — this
// orchestrator runs every sub-check that guards it. Subprocess steps use
// execFileSync (emit/version/marketplace/node:test); structural checks run
// in-process. Failure is structured:
// `console.error("== FAIL: <step> ==")` + message, exit code 1.
//
// The step list is exported (steps) so the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) can assert osuperpowers coverage
// is not dropped — mirroring the legacy bash wiring guard.

import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile()) out.push(p);
  }
  return out;
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
    run: () => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts }),
  });
}

function checkStep(name, fn, meta = {}) {
  steps.push({ name, run: fn, ...meta });
}

// 0. unified emit freshness — --check against committed products (no write)
subprocessStep("0. unified emit freshness (--check)", "node", ["scripts/emit.mjs", "--check"]);

// 1. plugin.json skills resolve
function checkOverridesPluginSkills() {
  const p = path.join(ROOT, "packages/osuperpowers-router");
  const manifest = JSON.parse(readFileSync(path.join(p, ".claude-plugin/plugin.json"), "utf8"));
  const skills = manifest.skills;
  if (skills === null || skills === undefined) {
    // overrides = trigger router — no skill bodies. skills/ may be absent or empty.
    const dir = path.join(p, "skills");
    if (existsSync(dir)) {
      const n = countSkillsWithMarkdown(dir);
      assert(n === 0, `expected 0 overrides skills (trigger router, no skill bodies), got ${n}`);
    }
    console.log("OK — 0 skills (trigger router, no skill bodies)");
  } else if (typeof skills === "string") {
    const dir = path.join(p, skills.replace(/^\.\//, ""));
    assert(existsSync(dir), `skills path missing: ${dir}`);
    const n = countSkillsWithMarkdown(dir);
    console.log(`OK — ${n} skills (directory ${skills})`);
  } else {
    const missing = skills.filter((s) => !existsSync(path.join(p, s.replace(/^\.\//, ""))));
    assert(missing.length === 0, `skills[] points to missing dirs: ${missing}`);
    console.log(`OK — ${skills.length} skills`);
  }
}
checkStep("1. plugin.json skills resolve", checkOverridesPluginSkills);

// 2. every skill dir has SKILL.md (skip when none)
function checkSkillsMarkdown() {
  const dir = path.join(ROOT, "packages/osuperpowers-router/skills");
  if (!existsSync(dir)) {
    console.log("OK — no skills dir");
    return;
  }
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const md = path.join(dir, ent.name, "SKILL.md");
    assert(existsSync(md), `MISSING: packages/osuperpowers-router/skills/${ent.name}/SKILL.md`);
  }
  console.log("OK");
}
checkStep("2. every skill dir has SKILL.md", checkSkillsMarkdown);

// 3. no orphan skill dirs
function checkNoOrphanSkills() {
  const dir = path.join(ROOT, "packages/osuperpowers-router/skills");
  if (!existsSync(dir)) {
    console.log("OK — no skill dirs (trigger router)");
    return;
  }
  const dirs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  assert(dirs.length === 0, `overrides plugin must have no skill dirs (trigger router): ${dirs.map((d) => d.name).join(", ")}`);
  console.log("OK — no skill dirs (trigger router)");
}
checkStep("3. no orphan skill dirs", checkNoOrphanSkills);

// 4. hooks executable（bash-lenient 对齐：hooks 文件缺失 → warn 不 fail（步骤可跳过）；
// hooks 文件存在 → 其引用 handler 必须存在且可执行（真正错误 → exit 1））。
function checkOverridesHooks() {
  const p = path.join(ROOT, "packages/osuperpowers-router");
  // hooks 文件 → 其引用 bin handler（hooks matrix：claude hooks.json → prompt-expansion；
  // cursor hooks-cursor.json → cursor-detect/cursor-enforce）。
  const handlers = {
    "hooks/hooks.json": ["bin/prompt-expansion.mjs"],
    "hooks/hooks-cursor.json": ["bin/cursor-detect.mjs", "bin/cursor-enforce.mjs"],
  };
  let missing = 0;
  for (const [hookFile, binScripts] of Object.entries(handlers)) {
    if (!existsSync(path.join(p, hookFile))) {
      // 对齐 bash `[ -f ] && echo`：缺则静默跳过 → Node warn 不 fail。
      console.warn(`WARN — overrides ${hookFile} missing (bash-lenient: skipped)`);
      missing += 1;
      continue;
    }
    for (const bin of binScripts) {
      assert(existsSync(path.join(p, bin)), `missing: ${bin} (referenced by ${hookFile})`);
      assert(isExecutable(path.join(p, bin)), `not executable: ${bin} (referenced by ${hookFile})`);
    }
  }
  console.log(
    missing === 0
      ? "OK — hooks.json + hooks-cursor.json + router bin scripts executable"
      : "OK — overrides hooks partially missing (lenient); present hooks' handlers executable",
  );
}
checkStep("4. overrides hooks + bin executable", checkOverridesHooks);

// 5. overrides build validation
subprocessStep("5. overrides build validation", "node", [
  path.join(ROOT, "packages/osuperpowers-router/tests/validate-overrides-build.mjs"),
]);

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
  "packages/osuperpowers/bin/engine/tests/*.test.mjs",
  "packages/osuperpowers/bin/gate/tests/*.test.mjs",
  "packages/osuperpowers/bin/init/tests/*.test.mjs",
  "packages/osuperpowers/bin/utils/tests/*.test.mjs",
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
    "bin/engine/cdd-task.mjs",
    "bin/engine/cdd-review.mjs",
    "bin/engine/cdd-select.mjs",
    "bin/engine/cdd-session-activate.mjs",
  ]) {
    assert(isExecutable(path.join(p, f)), `not executable: ${f}`);
  }
  console.log("OK — osuperpowers gate hooks + engine entries executable");
}
checkStep("5b2. osuperpowers gate hooks + engine entries executable", checkOsuperpowersGateHooks);

// 5c. engine + router zero-residue grep (sdd_/spor- — must not regress)
const RESIDUE_TARGETS = [
  "packages/osuperpowers/bin",
  "packages/osuperpowers/skills",
  "packages/osuperpowers-router/bin",
  "packages/osuperpowers-router/hooks",
  "packages/osuperpowers-router/build/generated",
];
const RESIDUE_RE = /\b(sdd_|_sdd_|SDD_|sdd-run-|spor-)/;
function checkZeroResidue() {
  const hits = [];
  for (const t of RESIDUE_TARGETS) {
    for (const f of walk(path.join(ROOT, t))) {
      const buf = readFileSync(f);
      if (buf.includes(0)) continue; // binary — grep -rn reports, doesn't content-match
      if (RESIDUE_RE.test(buf.toString("utf8"))) hits.push(path.relative(ROOT, f));
    }
  }
  assert(hits.length === 0, `RESIDUE FOUND — sdd_/SDD_/sdd-run-/spor- in engine + router executable products:\n  ${hits.join("\n  ")}`);
  console.log("OK — zero residue in engine + router executable products");
}
checkStep("5c. engine + router zero-residue grep", checkZeroResidue, { grepTargets: RESIDUE_TARGETS });

// 6. marketplace validate
subprocessStep("6. marketplace validate", "node", ["scripts/validate-marketplace.mjs"]);

// 7. lib unit tests
subprocessStep("7. lib unit tests", "node", [
  "--test",
  "scripts/lib/version-utils.test.mjs",
  "scripts/lib/emit/emit.test.mjs",
  "scripts/lib/publish-vendor.test.mjs",
  "scripts/lib/bump-chain.test.mjs",
  "scripts/lib/first-party-publish.test.mjs",
  "scripts/lib/submodule-tags.test.mjs",
]);

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
