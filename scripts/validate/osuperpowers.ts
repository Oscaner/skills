#!/usr/bin/env node

// scripts/validate/osuperpowers.ts — 5b block: osuperpowers plugin validation.
// Five step descriptors in original run order — marker / skills-count / node:test
// trees / wiring guard (ci-validate.test.mjs) / pi-package well-formed. The
// cdd-engine Vitest suite lives in engine.ts; index.ts splices it after the first
// four steps of this block, leaving the pi-package check to close the block.

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

// Authoritative skills count — module-level single source of truth shared by the skills-count
// check below and the manifest contract pin (packages/osuperpowers/tests/pi-package.test.mjs).
export const EXPECTED = 8; // init (deleted at T10) + 3 new spec-writers (T12 writing-{single,overall,phase}-spec)

function checkOsuperpowersSkillsCount() {
  const p = path.join(ROOT, "packages/osuperpowers");
  const manifest = JSON.parse(readFileSync(path.join(p, ".claude-plugin/plugin.json"), "utf8"));
  const skills = manifest.skills;
  const EMITTERS_LABEL = `${EXPECTED} skills`; // pure count label (no re-listing; EXPECTED is the only count truth)
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

// First-class pi-package guard (C2): the package.json#pi source-field contract
// checked statically — five assertions, zero subprocesses, zero engine invocation
// — sharing the skills-count truth with checkOsuperpowersSkillsCount via the
// module-level EXPECTED export (no local literal: a count change must update one
// symbol only). The files-closure check is the static subset per the closure
// contract (./ stripped, then directory/file prefix coverage); pack-truth is
// verified separately by the install smoke.
function checkPiPackageWellFormed(pkgRoot) {
  const pkg = JSON.parse(readFileSync(path.join(pkgRoot, "package.json"), "utf8"));

  // 1. Keywords carry the pi-package marker.
  assert(
    Array.isArray(pkg.keywords) && pkg.keywords.includes("pi-package"),
    "package keywords must contain the literal pi-package",
  );

  // 2. pi.skills is a non-empty string[] of ./<path> glob shapes.
  const declared = pkg.pi?.skills;
  assert(Array.isArray(declared) && declared.length > 0, "pi.skills must be a non-empty array");
  for (const s of declared) {
    assert(
      typeof s === "string" && s.startsWith("./") && s.length > 2 && !s.includes(".."),
      `pi.skills entries must be ./<path> glob shapes, got: ${s}`,
    );
  }

  // 3. pi declares no extensions/prompts keys (R0 invariant).
  for (const key of ["extensions", "prompts"]) {
    assert(!Object.hasOwn(pkg.pi ?? {}, key), `pi must not declare an ${key} key`);
  }

  // 4. Each declared skills path resolves to exactly EXPECTED SKILL.md dirs — the
  //    count is read from the shared module export, never a local literal.
  for (const s of declared) {
    const dir = path.join(pkgRoot, s.replace(/^\.\//, "").replace(/\/\*$/, ""));
    assert(existsSync(dir), `pi.skills path must resolve on disk: ${s}`);
    const n = countSkillsWithMarkdown(dir);
    assert(n === EXPECTED, `expected ${EXPECTED} osuperpowers skills under ${s}, got ${n}`);
  }

  // 5. Files closure: each pi-declared path is a static subset of the pkg.files
  //    whitelist (directory or file prefix coverage after stripping ./ and /).
  const whitelist = (pkg.files ?? []).map((p) => p.replace(/\/$/, ""));
  for (const s of declared) {
    const d = s.replace(/^\.\//, "");
    assert(
      whitelist.some((w) => d === w || d.startsWith(`${w}/`)),
      `pi-declared path ${d} must be covered by a package files whitelist entry`,
    );
  }

  console.log(
    `OK — osuperpowers pi-package well-formed (${EXPECTED} skills via ${declared.join(", ")})`,
  );
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
  new CheckBlock({
    name: "osuperpowers pi-package well-formed",
    run: () => checkPiPackageWellFormed(path.join(ROOT, "packages/osuperpowers")),
  }),
];

validateRunner.runIfMain(import.meta.url, steps);
