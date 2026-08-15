#!/usr/bin/env node
// scripts/ci-validate.mjs — P5 T4: Node validate orchestration (12 blocks).
//
// Port of scripts/ci-validate.sh. The marketplace's "does the manifest chain still
// resolve" IS the test — this orchestrator runs every sub-check that guards it.
// Subprocess steps use execFileSync (emit/version/marketplace/node:test + the
// retained bash engine tests); structural checks run in-process. Failure is
// structured: `console.error("== FAIL: <step> ==")` + message, exit code 1.
//
// The step list is exported (steps) so the wiring guard
// (packages/engineering/tests/ci-validate.test.mjs) can assert engineering coverage
// is not dropped — mirroring ci-validate-wiring.test.sh for the bash orchestrator.

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
  const p = path.join(ROOT, "packages/superpowers-overrides");
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
  const dir = path.join(ROOT, "packages/superpowers-overrides/skills");
  if (!existsSync(dir)) {
    console.log("OK — no skills dir");
    return;
  }
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const md = path.join(dir, ent.name, "SKILL.md");
    assert(existsSync(md), `MISSING: packages/superpowers-overrides/skills/${ent.name}/SKILL.md`);
  }
  console.log("OK");
}
checkStep("2. every skill dir has SKILL.md", checkSkillsMarkdown);

// 3. no orphan skill dirs
function checkNoOrphanSkills() {
  const dir = path.join(ROOT, "packages/superpowers-overrides/skills");
  if (!existsSync(dir)) {
    console.log("OK — no skill dirs (trigger router)");
    return;
  }
  const dirs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  assert(dirs.length === 0, `overrides plugin must have no skill dirs (trigger router): ${dirs.map((d) => d.name).join(", ")}`);
  console.log("OK — no skill dirs (trigger router)");
}
checkStep("3. no orphan skill dirs", checkNoOrphanSkills);

// 4. hooks executable
function checkOverridesHooks() {
  const p = path.join(ROOT, "packages/superpowers-overrides");
  for (const f of ["hooks/hooks.json", "hooks/hooks-cursor.json"]) {
    assert(existsSync(path.join(p, f)), `missing: ${f}`);
  }
  for (const f of ["bin/prompt-expansion.mjs", "bin/cursor-detect.mjs", "bin/cursor-enforce.mjs"]) {
    assert(isExecutable(path.join(p, f)), `not executable: ${f}`);
  }
  console.log("OK — hooks.json + hooks-cursor.json + router bin scripts executable");
}
checkStep("4. overrides hooks + bin executable", checkOverridesHooks);

// 5. overrides build validation
subprocessStep("5. overrides build validation", path.join(ROOT, "packages/superpowers-overrides/tests/validate-overrides-build.sh"), []);

// 5b. engineering plugin validation
checkStep("5b. engineering plugin validation", () => console.log("OK — engineering plugin validation"));

function checkEngineeringSkillsCount() {
  const p = path.join(ROOT, "packages/engineering");
  const manifest = JSON.parse(readFileSync(path.join(p, ".claude-plugin/plugin.json"), "utf8"));
  const skills = manifest.skills;
  const EXPECTED = 13; // 12 emitters + os-init
  let n;
  if (skills === null || skills === undefined) {
    const dir = path.join(p, "skills");
    assert(existsSync(dir), `missing default skills dir: ${dir}`);
    n = countSkillsWithMarkdown(dir);
    assert(n === EXPECTED, `expected ${EXPECTED} engineering skills (12 emitters + os-init), got ${n}`);
    console.log(`OK — ${n} engineering skills (default skills/ discovery)`);
  } else if (typeof skills === "string") {
    const dir = path.join(p, skills.replace(/^\.\//, ""));
    assert(existsSync(dir), `missing skills dir: ${dir}`);
    n = countSkillsWithMarkdown(dir);
    assert(n === EXPECTED, `expected ${EXPECTED} engineering skills (12 emitters + os-init), got ${n}`);
    console.log(`OK — ${n} engineering skills (directory ${skills})`);
  } else {
    const missing = skills.filter((s) => !existsSync(path.join(p, s.replace(/^\.\//, ""))));
    assert(missing.length === 0, `skills[] points to missing dirs: ${missing}`);
    assert(skills.length === EXPECTED, `expected ${EXPECTED} engineering skills (12 emitters + os-init), got ${skills.length}`);
    console.log(`OK — ${skills.length} engineering skills (explicit list)`);
  }
}
checkStep("5b. engineering skills-count (13)", checkEngineeringSkillsCount);

subprocessStep("5b. rule-reference.test.py (semantic)", "python3", [
  "packages/engineering/tests/rule-reference.test.py",
  "--skills",
  "packages/engineering/skills:semantic",
]);

// node:test 两棵树（T5）：行为/集成树 packages/engineering/tests/（helpers.mjs +
// common-functions.test.mjs + ci-validate.test.mjs）+ 模块树 bin/engine/tests/ + gate + os-init。
// 用 glob 而非裸目录（本环境 node --test <dir> 会把目录当模块加载而失败；glob 由 runner 展开）。
// 旧 6 个 shell engine 测试 + line-budget 已迁移：registry-schema/select/cli-dry-run/
// commit-gate/severity 由模块测试吸收；common-functions 剩余家族（pending path / plugin
// root / superpowers scripts dir / env 校验 / render / check cli / invoke cli）由
// common-functions.test.mjs 在 bash 边界守护。
subprocessStep("5b. node:test engine + gate + os-init + behavior", "node", [
  "--test",
  "packages/engineering/tests/*.test.mjs",
  "packages/engineering/bin/engine/tests/*.test.mjs",
  "packages/engineering/bin/gate/tests/*.test.mjs",
  "packages/engineering/bin/os-init/tests/*.test.mjs",
]);

subprocessStep("5b. wiring guard: ci-validate.test.mjs", "node", ["--test", "packages/engineering/tests/ci-validate.test.mjs"]);

// 5b2. engineering gate hooks
function checkEngineeringGateHooks() {
  const p = path.join(ROOT, "packages/engineering");
  for (const f of ["hooks/hooks.json", "hooks/hooks-cursor.json"]) {
    assert(existsSync(path.join(p, f)), `missing: ${f}`);
  }
  for (const f of [
    "bin/gate/adapters/claude.mjs",
    "bin/gate/adapters/cursor.mjs",
    "bin/engine/cdd-session-activate.sh", // bash entry retained until T7
    "bin/engine/cdd-run.mjs",
    "bin/engine/cdd-exec.mjs",
    "bin/engine/cdd-select.mjs",
    "bin/engine/cdd-session-activate.mjs",
  ]) {
    assert(isExecutable(path.join(p, f)), `not executable: ${f}`);
  }
  console.log("OK — engineering gate hooks + engine entries executable");
}
checkStep("5b2. engineering gate hooks + engine entries executable", checkEngineeringGateHooks);

// 5c. engine + router zero-residue grep (sdd_/spor- — must not regress)
const RESIDUE_TARGETS = [
  "packages/engineering/bin",
  "packages/engineering/skills",
  "packages/superpowers-overrides/bin",
  "packages/superpowers-overrides/hooks",
  "packages/superpowers-overrides/build/generated",
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

// 11. mattpocock-skills resolvable
function checkSubmodule() {
  assert(existsSync(path.join(ROOT, "vendors/mattpocock-skills/skills")), "vendors/mattpocock-skills/skills missing");
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
  process.exitCode = main();
}
