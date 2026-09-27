#!/usr/bin/env node

// scripts/validate/osuperpowers.ts — 5b block: osuperpowers plugin validation.
// Four step descriptors in original run order — marker / skills-count /
// node:test trees / wiring guard (ci-validate.test.mjs). The 5b1 cdd-engine
// Vitest suite lives in engine.ts and is spliced between the node:test tree and
// the wiring guard by index.ts.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CheckBlock, SubprocessBlock, validateRunner } from "./runner.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

// node:test trees: behavior/integration (packages/osuperpowers/tests: helpers.mjs
// + ci-validate.test.mjs). T16 removed the rule-reference suite (semantic mode)
// with its wiring. T2 removed the harness selection/detection/install layers — the init-suite and utils-suite globs (bin/init/tests, bin/utils/tests)
// are gone with them. Globs rather than bare directories — node --test <dir> loads the
// dir as a module here and fails; the runner expands the globs. The legacy bash engine
// tests were fully migrated, so their Node equivalents are covered by the
// runner/registry/templates/exec module tests.
export const steps = [
  // block marker — plugin resolution.
  new CheckBlock({
    name: "osuperpowers plugin resolution",
    run: () => console.log("OK — osuperpowers plugin resolution"),
  }),
  new CheckBlock({
    name: "osuperpowers skills inventory count",
    run: checkOsuperpowersSkillsCount,
  }),
  new SubprocessBlock({
    name: "osuperpowers node:test behavior tree",
    cmd: "node",
    args: ["--test", "packages/osuperpowers/tests/*.test.mjs"],
  }),
  new SubprocessBlock({
    name: "validate wiring guard (ci-validate.test.mjs)",
    cmd: "node",
    args: ["--test", "packages/osuperpowers/tests/ci-validate.test.mjs"],
  }),
];

validateRunner.runIfMain(import.meta.url, steps);
