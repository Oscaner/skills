// packages/kairos/tests/pi-package.test.ts — C1 source fields + C3 manifest contract pin.
// Pins the live packages/kairos/package.json manifest contract for the pi harness:
// the `pi-package` keyword, the `pi.skills` declaration, the R0 invariant (no extensions /
// prompts keys), the skills-count truth (the shared countSkillsWithMarkdown + module-level
// EXPECTED export from scripts/validate/kairos.ts — never a local literal), and the
// static files closure (pi-declared paths ⊆ pkg.files whitelist). Pure static fs +
// node:assert; zero subprocesses, zero engine invocation at runtime.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { countSkillsWithMarkdown, EXPECTED } from "../../../scripts/validate/kairos.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(HERE, "..");
const PKG_JSON = path.join(PKG_DIR, "package.json");

function loadPackage(): {
  pi?: { skills?: string[] };
  files?: string[];
  keywords?: string[];
} {
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
    assert.ok(!Object.hasOwn(pkg.pi ?? {}, key), `pi must not declare an ${key} key`);
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

test("pi.skills glob resolution set == the {dir, name} scan set (exactly 8 cdd-*)", () => {
  const pkg = loadPackage();
  const skillsDir = path.join(PKG_DIR, "skills");
  // Anchor the glob side to the canonical skills face it must resolve: project every
  // declared pi.skills glob through the same normalizer (strip `./`, strip trailing
  // `/*`) and require it to equal the canonical skills dir. A glob that drifts to a
  // different directory fails here instead of passing by re-reading whatever directory
  // that glob now points at.
  const resolvedRoots = (pkg.pi?.skills ?? []).map((glob) =>
    path.join(PKG_DIR, glob.replace(/^\.\//, "").replace(/\/\*$/, "")),
  );
  assert.deepEqual(
    resolvedRoots,
    [skillsDir],
    "pi.skills globs must resolve to the canonical skills dir",
  );
  // The resolution side: the declared globs, expanded to their SKILL.md-bearing dirs.
  const resolved = resolvedRoots
    .flatMap((dir) =>
      readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md")))
        .map((e) => e.name),
    )
    .sort();
  // The scan side: the canonical skills/ directory (dir × SKILL.md name: double-pin).
  const scanned = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(skillsDir, e.name, "SKILL.md")))
    .map((e) => e.name)
    .sort();
  assert.equal(resolved.length, 8, "pi.skills globs must resolve exactly the 8 shipped skills");
  assert.deepEqual(
    resolved,
    scanned,
    "pi.skills glob resolution set must equal the skills/ dir scan",
  );
  for (const name of scanned) {
    assert.match(name, /^cdd-/, `every pi-resolved skill must be a cdd-* family name: ${name}`);
    const md = readFileSync(path.join(skillsDir, name, "SKILL.md"), "utf8");
    const picked = md.match(/^name:\s*(.+)$/m);
    assert.ok(picked, `SKILL.md in ${name} missing a name: front-matter field`);
    assert.equal(
      picked[1].trim(),
      name,
      `SKILL.md front-matter name: must equal its directory name ${name}`,
    );
  }
});
