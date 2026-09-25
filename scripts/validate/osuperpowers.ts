#!/usr/bin/env node

// scripts/validate/osuperpowers.ts — 5b block: osuperpowers plugin validation.
// Five step descriptors in original run order (the 5b1 cdd-engine Vitest suite
// lives in engine.ts and is spliced between the node:test tree and the wiring
// guard by index.ts):
//   marker / skills-count / node:test trees /
//   wiring guard (ci-validate.test.mjs).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execaSync } from "execa";

import { runIfMain } from "./runner.ts";

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

// block marker — plugin resolution.
checkStep("osuperpowers plugin resolution", () =>
  console.log("OK — osuperpowers plugin resolution"),
);

function countSkillsWithMarkdown(dir) {
  return readdirSync(dir, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md")),
  ).length;
}

function checkOsuperpowersSkillsCount() {
  const p = path.join(ROOT, "packages/osuperpowers");
  const manifest = JSON.parse(readFileSync(path.join(p, ".claude-plugin/plugin.json"), "utf8"));
  const skills = manifest.skills;
  const EXPECTED = 8; // 5（init 已删 T10）+ 3 新 spec-writer（T12 writing-{single,overall,phase}-spec）
  const EMITTERS_LABEL = `${EXPECTED} skills`; // 纯计数标签（T16 去枚举——不重复写数值，EXPECTED 为唯一计数真相）
  let n: number;
  if (skills === null || skills === undefined) {
    const dir = path.join(p, "skills");
    assert(existsSync(dir), `missing default skills dir: ${dir}`);
    n = countSkillsWithMarkdown(dir);
    assert(
      n === EXPECTED,
      `expected ${EXPECTED} osuperpowers skills (${EMITTERS_LABEL}), got ${n}`,
    );
    console.log(`OK — ${n} osuperpowers skills (default skills/ discovery)`);
  } else if (typeof skills === "string") {
    const dir = path.join(p, skills.replace(/^\.\//, ""));
    assert(existsSync(dir), `missing skills dir: ${dir}`);
    n = countSkillsWithMarkdown(dir);
    assert(
      n === EXPECTED,
      `expected ${EXPECTED} osuperpowers skills (${EMITTERS_LABEL}), got ${n}`,
    );
    console.log(`OK — ${n} osuperpowers skills (directory ${skills})`);
  } else {
    const missing = skills.filter((s) => !existsSync(path.join(p, s.replace(/^\.\//, ""))));
    assert(missing.length === 0, `skills[] points to missing dirs: ${missing}`);
    assert(
      skills.length === EXPECTED,
      `expected ${EXPECTED} osuperpowers skills (${EMITTERS_LABEL}), got ${skills.length}`,
    );
    console.log(`OK — ${skills.length} osuperpowers skills (explicit list)`);
  }
}
checkStep("osuperpowers skills inventory count", checkOsuperpowersSkillsCount);

// node:test trees: behavior/integration (packages/osuperpowers/tests: helpers.mjs
// + ci-validate.test.mjs). T16 removed the rule-reference suite (semantic mode)
// with its wiring. T2 removed the harness selection/detection/install layers — the init-suite and utils-suite globs (bin/init/tests, bin/utils/tests)
// are gone with them. Globs rather than bare directories — node --test <dir> loads the
// dir as a module here and fails; the runner expands the globs. The legacy bash engine
// tests were fully migrated, so their Node equivalents are covered by the
// runner/registry/templates/exec module tests.
subprocessStep("osuperpowers node:test behavior tree", "node", [
  "--test",
  "packages/osuperpowers/tests/*.test.mjs",
]);

subprocessStep("validate wiring guard (ci-validate.test.mjs)", "node", [
  "--test",
  "packages/osuperpowers/tests/ci-validate.test.mjs",
]);

runIfMain(import.meta.url, steps);
