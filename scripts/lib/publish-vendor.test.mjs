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
} from "./publish-vendor.mjs";

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
    JSON.stringify({ name: "superpowers", version: "6.2.0", description: "root desc" }),
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
  writeFileSync(join(p, "LICENSE"), "MIT\n");
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
// assemblePackageJson — scoped package.json
// ---------------------------------------------------------------------------

test("assemblePackageJson — superpowers scoped pkg (tags + plugin.json metadata)", () => {
  const root = makeSuperpowersFixture();
  const pkg = assemblePackageJson("superpowers", root);
  assert.equal(pkg.name, "@oscaner-skills/superpowers");
  assert.equal(pkg.version, "6.2.0");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.description, "Core skills library for Claude Code");
  assert.deepEqual(pkg["oscaner-plugin"], {
    contentRoot: ".",
    pi: { skills: ["./skills"] },
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
  assert.deepEqual(pkg["oscaner-plugin"], {
    contentRoot: "plugin",
    pi: { skills: ["./skills"] },
  });
});

test("assemblePackageJson — mattpocock drops upstream private flag", () => {
  const root = makeMattpocockFixture();
  const pkg = assemblePackageJson("mattpocock-skills", root);
  assert.equal(pkg.version, "1.1.0");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.private, undefined);
  assert.deepEqual(pkg["oscaner-plugin"], {
    contentRoot: ".",
    pi: { skills: ["./skills"] },
  });
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
  assert.deepEqual(pkg["oscaner-plugin"].pi, { skills: ["./skills"] });
});
