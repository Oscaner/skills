// packages/osuperpowers/tests/pi-package.test.mjs — C1 source fields + C3 manifest contract pin.
// Pins the live packages/osuperpowers/package.json manifest contract for the pi harness:
// the `pi-package` keyword, the `pi.skills` declaration, the R0 invariant (no extensions /
// prompts keys), the skills-count truth (the shared countSkillsWithMarkdown + module-level
// EXPECTED export from scripts/validate/osuperpowers.ts — never a local literal), and the
// static files closure (pi-declared paths ⊆ pkg.files whitelist). Pure static fs +
// node:assert; zero subprocesses, zero engine invocation at runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { countSkillsWithMarkdown, EXPECTED } from "../../../scripts/validate/osuperpowers.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(HERE, "..");
const PKG_JSON = path.join(PKG_DIR, "package.json");

function loadPackage() {
  return JSON.parse(readFileSync(PKG_JSON, "utf8"));
}

test("live package.json declares the pi source fields", () => {
  const pkg = loadPackage();
  assert.ok(
    Array.isArray(pkg.keywords) && pkg.keywords.includes("pi-package"),
    "keywords must contain the literal pi-package",
  );
  assert.deepEqual(pkg.pi?.skills, ["./skills"]);
});

test("pi declares no extensions/prompts keys (R0 invariant)", () => {
  const pkg = loadPackage();
  for (const key of ["extensions", "prompts"]) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(pkg.pi ?? {}, key),
      `pi must not declare an ${key} key`,
    );
  }
});

test("./skills resolves EXPECTED SKILL.md (count from the shared export)", () => {
  const skillsDir = path.join(PKG_DIR, "skills");
  assert.ok(existsSync(skillsDir), "skills directory must exist");
  const count = countSkillsWithMarkdown(skillsDir);
  assert.strictEqual(count, EXPECTED);
});

test("files closure: pi-declared paths are a static subset of the files whitelist", () => {
  const pkg = loadPackage();
  const declared = (pkg.pi?.skills ?? []).map((p) => p.replace(/^\.\//, ""));
  const whitelist = (pkg.files ?? []).map((p) => p.replace(/\/$/, ""));
  assert.ok(declared.length > 0, "pi.skills must declare at least one path");
  for (const d of declared) {
    assert.ok(
      whitelist.some((w) => d === w || d.startsWith(`${w}/`)),
      `pi-declared path ${d} must be covered by a package files whitelist entry`,
    );
  }
});
