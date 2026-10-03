#!/usr/bin/env node

// scripts/validate/kairos.ts — 5b block: kairos plugin validation.
// Five step descriptors in original run order — marker / skills-count / node:test
// trees / wiring guard (ci-validate.test.ts) / pi-package well-formed. The
// cdd-engine Vitest suite lives in engine.ts; index.ts splices it after the first
// four steps of this block, leaving the pi-package check to close the block.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { piHarness } from "../lib/harness-registry.ts";
import { CheckBlock, SubprocessBlock, validateRunner } from "./runner.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Single definition of "a skill = directory containing SKILL.md" — shared by the skills-count
// check below, the pi-package well-formed guard, and the behavior tests (pi-package.test.ts,
// pi-install-smoke.test.ts): a definition change needs this one edit only.
export function countSkillsWithMarkdown(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md")),
  ).length;
}

// Authoritative skills count — module-level single source of truth shared by the skills-count
// check below and the behavior tests (packages/kairos/tests/pi-package.test.ts,
// packages/kairos/tests/pi-install-smoke.test.ts).
export const EXPECTED = 8; // init (deleted at T10) + 3 spec-writer skills (cdd-spec / cdd-charter / cdd-phase)

function checkKairosSkillsCount() {
  const p = path.join(ROOT, "packages/kairos");
  const manifest = JSON.parse(readFileSync(path.join(p, ".claude-plugin/plugin.json"), "utf8")) as {
    skills?: string[] | string | null;
  };
  const skills = manifest.skills;
  const EMITTERS_LABEL = `${EXPECTED} skills`; // pure count label (no re-listing; EXPECTED is the only count truth)
  let n: number;
  if (skills === null || skills === undefined) {
    const dir = path.join(p, "skills");
    assert(existsSync(dir), `missing default skills dir: ${dir}`);
    n = countSkillsWithMarkdown(dir);
    assert(n === EXPECTED, `expected ${EXPECTED} kairos skills (${EMITTERS_LABEL}), got ${n}`);
    console.log(`OK — ${n} kairos skills (default skills/ discovery)`);
  } else if (typeof skills === "string") {
    const dir = path.join(p, skills.replace(/^\.\//, ""));
    assert(existsSync(dir), `missing skills dir: ${dir}`);
    n = countSkillsWithMarkdown(dir);
    assert(n === EXPECTED, `expected ${EXPECTED} kairos skills (${EMITTERS_LABEL}), got ${n}`);
    console.log(`OK — ${n} kairos skills (directory ${skills})`);
  } else {
    const missing = skills.filter((s) => !existsSync(path.join(p, s.replace(/^\.\//, ""))));
    assert(missing.length === 0, `skills[] points to missing dirs: ${missing}`);
    assert(
      skills.length === EXPECTED,
      `expected ${EXPECTED} kairos skills (${EMITTERS_LABEL}), got ${skills.length}`,
    );
    console.log(`OK — ${skills.length} kairos skills (explicit list)`);
  }
}

// First-class pi-package guard (C2): the package.json#pi source-field contract
// checked statically — five assertions, zero subprocesses, zero engine invocation
// — delegating the assertion body to the harness registry's PiHarness
// (PiHarness.validatePackage). This function is a thin proxy: the count and count
// function are injected via ctx (EXPECTED / countSkillsWithMarkdown stay module
// exports here — the lib never imports the validate side), the assertion surface
// is unchanged, and the log text keeps the block's established marker. The
// files-closure check is the static subset per the closure contract (./ stripped,
// then directory/file prefix coverage); pack-truth is verified separately by the
// install smoke.
function checkPiPackageWellFormed(pkgRoot: string) {
  const pkg = JSON.parse(readFileSync(path.join(pkgRoot, "package.json"), "utf8")) as {
    pi?: { skills?: string[] };
    [key: string]: unknown;
  };
  const declared = pkg.pi?.skills ?? [];
  piHarness.validatePackage(pkg, {
    pkgRoot,
    expectedCount: EXPECTED,
    countSkills: countSkillsWithMarkdown,
  });
  console.log(`OK — kairos pi-package well-formed (${EXPECTED} skills via ${declared.join(", ")})`);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

// node:test trees: behavior/integration (packages/kairos/tests: helpers.ts
// + ci-validate.test.ts). T16 removed the rule-reference suite (semantic mode)
// with its wiring. T2 removed the harness selection/detection/install layers — the init-suite and utils-suite globs (bin/init/tests, bin/utils/tests)
// are gone with them. Globs rather than bare directories — node --test <dir> loads the
// dir as a module here and fails; the runner expands the globs. The legacy bash engine
// tests were fully migrated, so their Node equivalents are covered by the
// runner/registry/templates/exec module tests.
export const steps = [
  // block marker — plugin resolution.
  new CheckBlock({
    name: "kairos plugin resolution",
    run: () => console.log("OK — kairos plugin resolution"),
  }),
  new CheckBlock({
    name: "kairos skills inventory count",
    run: checkKairosSkillsCount,
  }),
  new SubprocessBlock({
    name: "kairos node:test behavior tree",
    cmd: "node",
    args: ["--test", "packages/kairos/tests/*.test.ts"],
  }),
  new SubprocessBlock({
    name: "validate wiring guard (ci-validate.test.ts)",
    cmd: "node",
    args: ["--test", "packages/kairos/tests/ci-validate.test.ts"],
  }),
  new CheckBlock({
    name: "kairos pi-package well-formed",
    run: () => checkPiPackageWellFormed(path.join(ROOT, "packages/kairos")),
  }),
];

validateRunner.runIfMain(import.meta.url, steps);
