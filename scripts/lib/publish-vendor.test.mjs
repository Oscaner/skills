import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  resolveVendorVersion,
  assemblePackageJson,
  copyTree,
  assertSubmoduleCheckedOut,
  assertLicensePresent,
  stageVendor,
  listVendors,
  assemblyTemplate,
  derivePiKey,
} from "./publish-vendor.mjs";
import { thinGeminiExtension } from "./emit/manifests.mjs";

let dir;
function makeRoot() {
  dir = mkdtempSync(join(tmpdir(), "publish-vendor-test-"));
  return dir;
}

/** Create a temp git repo with a single commit tagged `tag`. */
function makeGitRepo(path, tag) {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "tracked.txt"), "x\n");
  execSync(`git init -q`, { cwd: path });
  execSync(`git config user.email t@t.t`, { cwd: path });
  execSync(`git config user.name t`, { cwd: path });
  execSync(`git add -A`, { cwd: path });
  execSync(`git commit -qm init`, { cwd: path });
  execSync(`git tag ${tag}`, { cwd: path });
}

function makeSuperpowersFixture() {
  const root = makeRoot();
  const p = join(root, "vendors", "superpowers");
  makeGitRepo(p, "v6.2.0");
  writeFileSync(
    join(p, "package.json"),
    JSON.stringify({
      name: "superpowers",
      version: "6.2.0",
      description: "root desc",
      pi: {
        extensions: ["./.pi/extensions/superpowers.ts"],
        skills: ["./skills"],
      },
    }),
  );
  mkdirSync(join(p, ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(p, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "superpowers",
      version: "6.2.0",
      description: "Core skills library for Claude Code",
      author: { name: "Jesse Vincent", email: "jesse@fsck.com" },
      homepage: "https://github.com/obra/superpowers",
      repository: "https://github.com/obra/superpowers",
      license: "MIT",
      keywords: ["skills", "tdd"],
    }),
  );
  writeFileSync(join(p, "LICENSE"), "MIT\n");
  return root;
}

function makeImpeccableFixture() {
  const root = makeRoot();
  const p = join(root, "vendors", "impeccable");
  mkdirSync(join(p, "plugin", ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(p, "package.json"),
    JSON.stringify({
      name: "impeccable",
      version: "3.5.0",
      description: "root desc",
      license: "Apache-2.0",
      author: "Paul Bakaus",
    }),
  );
  writeFileSync(
    join(p, "plugin", ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "impeccable",
      version: "4.0.4",
      description: "Design fluency for frontend development",
      author: { name: "Paul Bakaus", email: "paul@paulbakaus.com" },
    }),
  );
  // pi convention: .pi/skills/impeccable/ with SKILL.md
  mkdirSync(join(p, ".pi", "skills", "impeccable"), { recursive: true });
  writeFileSync(
    join(p, ".pi", "skills", "impeccable", "SKILL.md"),
    "# impeccable skill\n",
  );
  writeFileSync(join(p, "LICENSE"), "Apache-2.0\n");
  return root;
}

function makeMattpocockFixture() {
  const root = makeRoot();
  const p = join(root, "vendors", "mattpocock-skills");
  makeGitRepo(p, "v1.1.0");
  writeFileSync(
    join(p, "package.json"),
    JSON.stringify({
      name: "mattpocock-skills",
      version: "1.1.0",
      private: true,
      description: "Matt Pocock's agent skills for real engineering",
      license: "MIT",
    }),
  );
  // plugin.json with skills array (priority 3: no package.json pi, no .pi/skills/)
  mkdirSync(join(p, ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(p, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "mattpocock-skills",
      version: "1.1.0",
      skills: [
        "./skills/claude-api",
        "./skills/codebase-design",
        "./skills/code-review",
        "./skills/diagnosing-bugs",
        "./skills/domain-modeling",
        "./skills/finishing-a-development-branch",
        "./skills/grilling",
        "./skills/managing-ai-agents",
        "./skills/mcp",
        "./skills/mental-models",
        "./skills/opening-requests",
        "./skills/planning",
        "./skills/prototype",
        "./skills/receiving-code-review",
        "./skills/requesting-code-review",
        "./skills/research",
        "./skills/simplifying",
        "./skills/subagent-driven-development",
        "./skills/tdd",
        "./skills/test-driven-development",
        "./skills/to-tickets",
      ],
    }),
  );
  writeFileSync(join(p, "LICENSE"), "MIT\n");
  // Skill directories for gemini-extension assembly verification
  mkdirSync(join(p, "skills", "tdd"), { recursive: true });
  writeFileSync(join(p, "skills", "tdd", "SKILL.md"), "# tdd\n");
  mkdirSync(join(p, "skills", "grilling"), { recursive: true });
  writeFileSync(join(p, "skills", "grilling", "SKILL.md"), "# grilling\n");
  return root;
}

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// resolveVendorVersion — per-vendor version strategy
// ---------------------------------------------------------------------------

test("resolveVendorVersion — superpowers from submodule v-tag", () => {
  const root = makeSuperpowersFixture();
  assert.equal(resolveVendorVersion("superpowers", root), "6.2.0");
});

test("resolveVendorVersion — mattpocock-skills from submodule v-tag", () => {
  const root = makeMattpocockFixture();
  assert.equal(resolveVendorVersion("mattpocock-skills", root), "1.1.0");
});

test("resolveVendorVersion — impeccable from plugin.json truth (non-v tags)", () => {
  const root = makeImpeccableFixture();
  assert.equal(resolveVendorVersion("impeccable", root), "4.0.4");
});

test("resolveVendorVersion — non-v tag on submodule HEAD throws (no matching release)", () => {
  const root = makeRoot();
  const repo = join(root, "vendors", "superpowers");
  makeGitRepo(repo, "ext-v1.3.1");
  // Hermetic origin: `semverFromNearestTag` falls back to `git fetch --tags
  // origin` when no local tag matches — point it at an empty local bare repo
  // so the fetch succeeds (no network / no stderr noise) yet finds no tag.
  execSync(`git init -q --bare ${join(root, "bare-origin.git")}`);
  execSync(`git remote add origin ${join(root, "bare-origin.git")}`, {
    cwd: repo,
  });
  assert.throws(() => resolveVendorVersion("superpowers", root), /release tag/);
});

test("resolveVendorVersion — impeccable without plugin.json version throws", () => {
  const root = makeRoot();
  const p = join(root, "vendors", "impeccable", "plugin", ".claude-plugin");
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, "plugin.json"), JSON.stringify({ name: "impeccable" }));
  assert.throws(() => resolveVendorVersion("impeccable", root), /version/);
});

// ---------------------------------------------------------------------------
// listVendors — vendored plugin set derived from the vendors/ dir
// ---------------------------------------------------------------------------

test("listVendors returns sorted vendor dir names from vendors/", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "superpowers"), { recursive: true });
  mkdirSync(join(root, "vendors", "impeccable"), { recursive: true });
  mkdirSync(join(root, "vendors", "mattpocock-skills"), { recursive: true });
  assert.deepEqual(listVendors(root), [
    "impeccable",
    "mattpocock-skills",
    "superpowers",
  ]);
});

test("listVendors ignores non-directory entries in vendors/", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors"), { recursive: true });
  writeFileSync(join(root, "vendors", ".DS_Store"), "");
  mkdirSync(join(root, "vendors", "superpowers"), { recursive: true });
  assert.deepEqual(listVendors(root), ["superpowers"]);
});

// ---------------------------------------------------------------------------
// assemblyTemplate — ASSEMBLY_TEMPLATE guard (clear error, never a bare TypeError)
// ---------------------------------------------------------------------------

test("assemblyTemplate returns the template entry for a known vendor", () => {
  assert.deepEqual(assemblyTemplate("impeccable"), { contentRoot: "plugin" });
  assert.deepEqual(assemblyTemplate("superpowers"), { contentRoot: "." });
});

test("assemblyTemplate throws a clear error for a vendor without a template", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "mystery"), { recursive: true });
  assert.deepEqual(listVendors(root), ["mystery"]);
  assert.throws(
    () => assemblyTemplate("mystery"),
    /no ASSEMBLY_TEMPLATE entry.*publish-vendor\.mjs/s,
  );
});

test("resolveVendorVersion surfaces the template guard for an unknown vendor", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "mystery"), { recursive: true });
  assert.throws(
    () => resolveVendorVersion("mystery", root),
    /no ASSEMBLY_TEMPLATE entry.*publish-vendor\.mjs/s,
  );
});

// ---------------------------------------------------------------------------
// derivePiKey — dynamic pi detection from vendored structure
// ---------------------------------------------------------------------------

test("derivePiKey — superpowers preserves upstream pi from package.json", () => {
  const root = makeSuperpowersFixture();
  const pi = derivePiKey(join(root, "vendors", "superpowers"), ".");
  assert.deepEqual(pi, {
    extensions: ["./.pi/extensions/superpowers.ts"],
    skills: ["./skills"],
  });
});

test("derivePiKey — mattpocock reads skills from .claude-plugin/plugin.json", () => {
  const root = makeMattpocockFixture();
  const pi = derivePiKey(join(root, "vendors", "mattpocock-skills"), ".");
  assert.ok(Array.isArray(pi.skills));
  assert.ok(pi.skills.length >= 21);
});

test("derivePiKey — impeccable derives from .pi/skills/impeccable (pi convention)", () => {
  const root = makeImpeccableFixture();
  const pi = derivePiKey(join(root, "vendors", "impeccable"), "plugin");
  assert.deepEqual(pi.skills, ["./.pi/skills/impeccable"]);
});

test("derivePiKey — no pi source returns empty skills", () => {
  const root = makeRoot();
  const p = join(root, "vendors", "bare-vendor");
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, "package.json"), JSON.stringify({ name: "bare" }));
  const pi = derivePiKey(p, ".");
  assert.deepEqual(pi, { skills: [] });
});

test("derivePiKey — fallback skills/ directory glob picks subdirectories", () => {
  const root = makeRoot();
  const p = join(root, "vendors", "skills-only");
  mkdirSync(join(p, "skills", "alpha"), { recursive: true });
  mkdirSync(join(p, "skills", "beta"), { recursive: true });
  writeFileSync(join(p, "package.json"), JSON.stringify({ name: "skills-only" }));
  const pi = derivePiKey(p, ".");
  assert.deepEqual(pi, { skills: ["./skills/alpha", "./skills/beta"] });
});

// ---------------------------------------------------------------------------
// assemblePackageJson — scoped package.json
// ---------------------------------------------------------------------------

test("assemblePackageJson — superpowers scoped pkg (tags + plugin.json metadata)", () => {
  const root = makeSuperpowersFixture();
  const pkg = assemblePackageJson("superpowers", root);
  assert.equal(pkg.name, "@oscaner-skills/superpowers");
  assert.equal(pkg.version, "6.2.0");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.description, "Core skills library for Claude Code");
  // pi at top level (not nested in oscaner-plugin), preserving upstream
  assert.deepEqual(pkg["oscaner-plugin"], { contentRoot: "." });
  assert.deepEqual(pkg.pi, {
    extensions: ["./.pi/extensions/superpowers.ts"],
    skills: ["./skills"],
  });
});

test("assemblePackageJson — impeccable version from plugin.json truth, contentRoot plugin", () => {
  const root = makeImpeccableFixture();
  const pkg = assemblePackageJson("impeccable", root);
  assert.equal(pkg.name, "@oscaner-skills/impeccable");
  assert.equal(pkg.version, "4.0.4");
  assert.equal(pkg.license, "Apache-2.0");
  assert.deepEqual(pkg.author, {
    name: "Paul Bakaus",
    email: "paul@paulbakaus.com",
  });
  // pi at top level, derived from .pi/skills/impeccable (not plugin.json)
  assert.deepEqual(pkg["oscaner-plugin"], { contentRoot: "plugin" });
  assert.deepEqual(pkg.pi, { skills: ["./.pi/skills/impeccable"] });
});

test("assemblePackageJson — mattpocock drops upstream private flag", () => {
  const root = makeMattpocockFixture();
  const pkg = assemblePackageJson("mattpocock-skills", root);
  assert.equal(pkg.version, "1.1.0");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.private, undefined);
  // pi at top level, derived from .claude-plugin/plugin.json skills array
  assert.deepEqual(pkg["oscaner-plugin"], { contentRoot: "." });
  assert.ok(Array.isArray(pkg.pi.skills));
  assert.ok(pkg.pi.skills.length >= 21);
});

// ---------------------------------------------------------------------------
// copyTree — stage copy exclusions
// ---------------------------------------------------------------------------

test("copyTree excludes .git and node_modules, preserves files and symlinks", () => {
  const root = makeRoot();
  const src = join(root, "src");
  const dest = join(root, "dest");
  mkdirSync(join(src, ".git"), { recursive: true });
  mkdirSync(join(src, "node_modules"), { recursive: true });
  mkdirSync(join(src, "plugin", "skills"), { recursive: true });
  writeFileSync(join(src, ".git", "HEAD"), "ref\n");
  writeFileSync(join(src, "node_modules", "x"), "x\n");
  writeFileSync(join(src, "LICENSE"), "MIT\n");
  writeFileSync(join(src, "plugin", "skills", "impeccable.md"), "# skill\n");
  symlinkSync("LICENSE", join(src, "LICENSE.link"));

  copyTree(src, dest);

  assert.ok(existsSync(join(dest, "LICENSE")));
  assert.ok(existsSync(join(dest, "plugin", "skills", "impeccable.md")));
  assert.ok(existsSync(join(dest, "LICENSE.link")));
  assert.equal(existsSync(join(dest, ".git")), false);
  assert.equal(existsSync(join(dest, "node_modules")), false);
});

// ---------------------------------------------------------------------------
// preflight checks
// ---------------------------------------------------------------------------

test("assertSubmoduleCheckedOut throws with update hint when submodule missing", () => {
  const root = makeRoot();
  assert.throws(
    () => assertSubmoduleCheckedOut("superpowers", root),
    /git submodule update --init/,
  );
});

test("assertSubmoduleCheckedOut throws when dir exists but not checked out", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "impeccable"), { recursive: true });
  assert.throws(
    () => assertSubmoduleCheckedOut("impeccable", root),
    /git submodule update --init/,
  );
});

test("assertSubmoduleCheckedOut passes for a checked-out submodule", () => {
  const root = makeSuperpowersFixture();
  assert.doesNotThrow(() => assertSubmoduleCheckedOut("superpowers", root));
});

test("assertLicensePresent throws when LICENSE missing", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "mattpocock-skills"), { recursive: true });
  writeFileSync(join(root, "vendors", "mattpocock-skills", "package.json"), "{}\n");
  assert.throws(() => assertLicensePresent("mattpocock-skills", root), /LICENSE/);
});

test("assertLicensePresent passes when LICENSE present", () => {
  const root = makeSuperpowersFixture();
  assert.doesNotThrow(() => assertLicensePresent("superpowers", root));
});

// ---------------------------------------------------------------------------
// stageVendor — staged assembly artifact
// ---------------------------------------------------------------------------

test("stageVendor copies content, writes scoped package.json + LICENSE", () => {
  const root = makeImpeccableFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("impeccable", root, stageRoot);

  assert.equal(dest, join(stageRoot, "impeccable"));
  assert.ok(existsSync(join(dest, "LICENSE")));
  assert.ok(existsSync(join(dest, "plugin", ".claude-plugin", "plugin.json")));
  const pkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf8"));
  assert.equal(pkg.name, "@oscaner-skills/impeccable");
  assert.equal(pkg.version, "4.0.4");
  // pi at top level, derived from .pi/skills/impeccable
  assert.deepEqual(pkg.pi, { skills: ["./.pi/skills/impeccable"] });
});

// ---------------------------------------------------------------------------
// thinGeminiExtension — mattpocock thin extension (no BeforeTool hooks)
// ---------------------------------------------------------------------------

test("thinGeminiExtension produces name/version/skills/contextFileName, no hooks", () => {
  const ext = thinGeminiExtension("mattpocock-skills", "1.1.0", [
    "./skills/tdd",
    "./skills/grilling",
  ]);
  assert.equal(ext.name, "mattpocock-skills");
  assert.equal(ext.version, "1.1.0");
  assert.deepEqual(ext.skills, ["./skills/tdd", "./skills/grilling"]);
  assert.equal(ext.contextFileName, "GEMINI.md");
  assert.equal(ext.hooks, undefined);
});

test("thinGeminiExtension omits description when not provided", () => {
  const ext = thinGeminiExtension("x", "0.0.1", []);
  assert.equal(ext.description, undefined);
  assert.equal(ext.hooks, undefined);
});

// ---------------------------------------------------------------------------
// stageVendor gemini-extension — mattpocock assembly produces thin extension + GEMINI.md
// ---------------------------------------------------------------------------

test("stageVendor mattpocock produces thin gemini-extension.json", () => {
  const root = makeMattpocockFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("mattpocock-skills", root, stageRoot);

  const geminiPath = join(dest, "gemini-extension.json");
  assert.ok(existsSync(geminiPath), "gemini-extension.json should exist");
  const ext = JSON.parse(readFileSync(geminiPath, "utf8"));
  // Name is the scoped package name (from assemblePackageJson)
  assert.equal(ext.name, "@oscaner-skills/mattpocock-skills");
  assert.equal(ext.version, "1.1.0");
  assert.equal(ext.contextFileName, "GEMINI.md");
  assert.ok(Array.isArray(ext.skills), "skills should be an array");
  assert.ok(ext.skills.length >= 2, "skills should include fixture dirs");
  // No BeforeTool hooks in the thin extension
  assert.equal(ext.hooks, undefined);
});

test("stageVendor mattpocock produces GEMINI.md with skill imports", () => {
  const root = makeMattpocockFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("mattpocock-skills", root, stageRoot);

  const geminiMdPath = join(dest, "GEMINI.md");
  assert.ok(existsSync(geminiMdPath), "GEMINI.md should exist");
  const content = readFileSync(geminiMdPath, "utf8");
  // Skills come from the fixture's .claude-plugin/plugin.json skills array
  assert.ok(content.includes("@./skills/claude-api/SKILL.md"), "should import claude-api skill");
  assert.ok(content.includes("@./skills/grilling/SKILL.md"), "should import grilling skill");
  assert.ok(!content.includes("hooks"), "thin extension GEMINI.md should not reference hooks");
});

// ---------------------------------------------------------------------------
// stageVendor upstream guard — upstream gemini-extension.json triggers error
// ---------------------------------------------------------------------------

test("stageVendor throws when upstream already has gemini-extension.json", () => {
  const root = makeMattpocockFixture();
  // Plant an upstream gemini-extension.json in the vendor
  writeFileSync(
    join(root, "vendors", "mattpocock-skills", "gemini-extension.json"),
    JSON.stringify({ name: "upstream" }),
  );
  const stageRoot = join(root, "stage");
  assert.throws(
    () => stageVendor("mattpocock-skills", root, stageRoot),
    /gemini-extension\.json/,
  );
});

// ---------------------------------------------------------------------------
// stageVendor unaffected — superpowers/impeccable don't get gemini-extension
// ---------------------------------------------------------------------------

test("stageVendor superpowers does not produce gemini-extension.json", () => {
  const root = makeSuperpowersFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("superpowers", root, stageRoot);
  assert.ok(!existsSync(join(dest, "gemini-extension.json")));
});

test("stageVendor impeccable does not produce gemini-extension.json", () => {
  const root = makeImpeccableFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("impeccable", root, stageRoot);
  assert.ok(!existsSync(join(dest, "gemini-extension.json")));
});
