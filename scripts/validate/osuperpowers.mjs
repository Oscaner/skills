#!/usr/bin/env node
// scripts/validate/osuperpowers.mjs — 5b block: osuperpowers plugin validation.
// Five step descriptors in original run order (the 5b1 cdd-engine Vitest suite
// lives in engine.mjs and is spliced between the node:test tree and the wiring
// guard by index.mjs):
//   marker / skills-count / rule-reference (semantic) / node:test trees /
//   wiring guard (ci-validate.test.mjs).

import { execaSync } from "execa";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runIfMain } from "./runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

export const steps = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function checkStep(name, fn, meta = {}) {
  steps.push({ name, run: fn, ...meta });
}

function subprocessStep(name, cmd, args) {
  steps.push({ name, cmd, args, run: () => execaSync(cmd, args, { cwd: ROOT, stdio: "inherit" }) });
}

// 5b marker.
checkStep("5b. osuperpowers plugin validation", () => console.log("OK — osuperpowers plugin validation"));

function countSkillsWithMarkdown(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md")))
    .length;
}

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

// node:test trees: behavior/integration (packages/osuperpowers/tests: helpers.mjs +
// rule-reference + ci-validate.test.mjs) and module (bin/engine/tests/ + gate + init
// + utils). Globs rather than bare directories — node --test <dir> loads the dir as a
// module here and fails; the runner expands the globs. The legacy bash engine tests
// were fully migrated, so their Node equivalents are covered by the
// runner/registry/templates/exec module tests.
subprocessStep("5b. node:test engine + gate + init + utils + behavior", "node", [
  "--test",
  "packages/osuperpowers/tests/*.test.mjs",
  "packages/osuperpowers/bin/gate/tests/*.test.mjs",
  "packages/osuperpowers/bin/init/tests/*.test.mjs",
  "packages/osuperpowers/bin/utils/tests/*.test.mjs",
]);

subprocessStep("5b. wiring guard: ci-validate.test.mjs", "node", ["--test", "packages/osuperpowers/tests/ci-validate.test.mjs"]);

runIfMain(import.meta.url, steps);