import { test, afterEach, expect } from "vitest";
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
  decideProbe,
  collectGaps,
  resolveUpstreamTag,
  classifyProbeError,
  PROBE,
  PROBE_CLASS,
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
  if (dir) rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// decideProbe — 三态判定
// ---------------------------------------------------------------------------

test("decideProbe — published → skip", () => {
  expect(decideProbe(PROBE.PUBLISHED)).toBe(PROBE_CLASS.PUBLISHED);
});

test("decideProbe — unpublished → publish", () => {
  expect(decideProbe(PROBE.UNPUBLISHED)).toBe(PROBE_CLASS.SHOULD_PUBLISH);
});

test("decideProbe — error → throws", () => {
  expect(() => decideProbe(PROBE.ERROR)).toThrow(/probe error.*aborting release/);
});

// ---------------------------------------------------------------------------
// collectGaps — 全量差集
// ---------------------------------------------------------------------------

test("collectGaps — version with tag+release → excluded", () => {
  const tagIdx = new Set(["6.2.0"]);
  const relIdx = new Set(["6.2.0"]);
  expect(collectGaps(["6.2.0"], tagIdx, relIdx)).toEqual([]);
});

test("collectGaps — missing tag → included", () => {
  const tagIdx = new Set();
  const relIdx = new Set(["6.2.0"]);
  expect(collectGaps(["6.2.0"], tagIdx, relIdx)).toEqual([{ version: "6.2.0" }]);
});

test("collectGaps — missing release → included", () => {
  const tagIdx = new Set(["6.2.0"]);
  const relIdx = new Set();
  expect(collectGaps(["6.2.0"], tagIdx, relIdx)).toEqual([{ version: "6.2.0" }]);
});

test("collectGaps — TOCTOU union via caller: registry+publishedThisRun both included", () => {
  const allVersions = ["6.0.0", "6.2.0"];
  const tagIdx = new Set(["6.0.0"]);
  const relIdx = new Set(["6.0.0", "6.2.0"]);
  expect(collectGaps(allVersions, tagIdx, relIdx)).toEqual([{ version: "6.2.0" }]);
});

test("collectGaps — all present → empty", () => {
  const allVersions = ["1.0.0", "1.1.0"];
  const tagIdx = new Set(["1.0.0", "1.1.0"]);
  const relIdx = new Set(["1.0.0", "1.1.0"]);
  expect(collectGaps(allVersions, tagIdx, relIdx)).toEqual([]);
});

// ---------------------------------------------------------------------------
// resolveUpstreamTag — 三级链
// ---------------------------------------------------------------------------

test("resolveUpstreamTag — version matches HEAD → returns headTag", () => {
  const tag = resolveUpstreamTag("6.2.0", { headVersion: "6.2.0", headTag: "v6.2.0" }, () => false);
  expect(tag).toBe("v6.2.0");
});

test("resolveUpstreamTag — fall through to upstream probe → returns matched tag", () => {
  const probe = (ref) => ref === "refs/tags/v6.0.0";
  const tag = resolveUpstreamTag("6.0.0", { headVersion: "6.2.0", headTag: "v6.2.0" }, probe);
  expect(tag).toBe("v6.0.0");
});

test("resolveUpstreamTag — skill-v HEAD match (impeccable current version)", () => {
  const probe = (ref) => ref === "refs/tags/skill-v4.0.4";
  const tag = resolveUpstreamTag("4.0.4", { headVersion: "4.0.4", headTag: "skill-v4.0.4" }, probe);
  expect(tag).toBe("skill-v4.0.4");
});

test("resolveUpstreamTag — v-candidate fails, skill-v succeeds via probe loop (historical impeccable)", () => {
  // HEAD version differs → short-circuit skipped → enters candidate loop
  // v<version> fails at tier-1 → skill-v<version> succeeds at tier-2
  const probe = (ref) => ref === "refs/tags/skill-v4.0.0";
  const tag = resolveUpstreamTag("4.0.0", { headVersion: "4.0.4", headTag: "skill-v4.0.4" }, probe);
  expect(tag).toBe("skill-v4.0.0");
});

test("resolveUpstreamTag — both probes fail → returns null", () => {
  const tag = resolveUpstreamTag("2.0.0", { headVersion: "1.0.0", headTag: "v1.0.0" }, () => false);
  expect(tag).toBe(null);
});

// ---------------------------------------------------------------------------
// resolveVendorVersion — per-vendor version strategy
// ---------------------------------------------------------------------------

test("resolveVendorVersion — superpowers from submodule v-tag", () => {
  const root = makeSuperpowersFixture();
  expect(resolveVendorVersion("superpowers", root)).toBe("6.2.0");
});

test("resolveVendorVersion — mattpocock-skills from submodule v-tag", () => {
  const root = makeMattpocockFixture();
  expect(resolveVendorVersion("mattpocock-skills", root)).toBe("1.1.0");
});

test("resolveVendorVersion — impeccable from plugin.json truth (non-v tags)", () => {
  const root = makeImpeccableFixture();
  expect(resolveVendorVersion("impeccable", root)).toBe("4.0.4");
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
  expect(() => resolveVendorVersion("superpowers", root)).toThrow(/release tag/);
});

test("resolveVendorVersion — impeccable without plugin.json version throws", () => {
  const root = makeRoot();
  const p = join(root, "vendors", "impeccable", "plugin", ".claude-plugin");
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, "plugin.json"), JSON.stringify({ name: "impeccable" }));
  expect(() => resolveVendorVersion("impeccable", root)).toThrow(/version/);
});

// ---------------------------------------------------------------------------
// listVendors — vendored plugin set derived from the vendors/ dir
// ---------------------------------------------------------------------------

test("listVendors returns sorted vendor dir names from vendors/", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "superpowers"), { recursive: true });
  mkdirSync(join(root, "vendors", "impeccable"), { recursive: true });
  mkdirSync(join(root, "vendors", "mattpocock-skills"), { recursive: true });
  expect(listVendors(root)).toEqual([
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
  expect(listVendors(root)).toEqual(["superpowers"]);
});

// ---------------------------------------------------------------------------
// assemblyTemplate — ASSEMBLY_TEMPLATE guard (clear error, never a bare TypeError)
// ---------------------------------------------------------------------------

test("assemblyTemplate returns the template entry for a known vendor", () => {
  expect(assemblyTemplate("impeccable")).toEqual({ contentRoot: "plugin" });
  expect(assemblyTemplate("superpowers")).toEqual({ contentRoot: "." });
});

test("assemblyTemplate throws a clear error for a vendor without a template", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "mystery"), { recursive: true });
  expect(listVendors(root)).toEqual(["mystery"]);
  expect(
    () => assemblyTemplate("mystery"),
  ).toThrow(/no ASSEMBLY_TEMPLATE entry.*publish-vendor\.mjs/s);
});

test("resolveVendorVersion surfaces the template guard for an unknown vendor", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "mystery"), { recursive: true });
  expect(
    () => resolveVendorVersion("mystery", root),
  ).toThrow(/no ASSEMBLY_TEMPLATE entry.*publish-vendor\.mjs/s);
});

// ---------------------------------------------------------------------------
// derivePiKey — dynamic pi detection from vendored structure
// ---------------------------------------------------------------------------

test("derivePiKey — superpowers preserves upstream pi from package.json", () => {
  const root = makeSuperpowersFixture();
  const pi = derivePiKey(join(root, "vendors", "superpowers"), ".");
  expect(pi).toEqual({
    extensions: ["./.pi/extensions/superpowers.ts"],
    skills: ["./skills"],
  });
});

test("derivePiKey — mattpocock reads skills from .claude-plugin/plugin.json", () => {
  const root = makeMattpocockFixture();
  const pi = derivePiKey(join(root, "vendors", "mattpocock-skills"), ".");
  expect(Array.isArray(pi.skills)).toBeTruthy();
  expect(pi.skills.length >= 21).toBeTruthy();
});

test("derivePiKey — impeccable derives from .pi/skills/impeccable (pi convention)", () => {
  const root = makeImpeccableFixture();
  const pi = derivePiKey(join(root, "vendors", "impeccable"), "plugin");
  expect(pi.skills).toEqual(["./.pi/skills/impeccable"]);
});

test("derivePiKey — no pi source returns empty skills", () => {
  const root = makeRoot();
  const p = join(root, "vendors", "bare-vendor");
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, "package.json"), JSON.stringify({ name: "bare" }));
  const pi = derivePiKey(p, ".");
  expect(pi).toEqual({ skills: [] });
});

test("derivePiKey — fallback skills/ directory glob picks subdirectories", () => {
  const root = makeRoot();
  const p = join(root, "vendors", "skills-only");
  mkdirSync(join(p, "skills", "alpha"), { recursive: true });
  mkdirSync(join(p, "skills", "beta"), { recursive: true });
  writeFileSync(join(p, "package.json"), JSON.stringify({ name: "skills-only" }));
  const pi = derivePiKey(p, ".");
  expect(pi).toEqual({ skills: ["./skills/alpha", "./skills/beta"] });
});

// ---------------------------------------------------------------------------
// assemblePackageJson — scoped package.json
// ---------------------------------------------------------------------------

test("assemblePackageJson — superpowers scoped pkg (tags + plugin.json metadata)", () => {
  const root = makeSuperpowersFixture();
  const pkg = assemblePackageJson("superpowers", root);
  expect(pkg.name).toBe("@oscaner-skills/superpowers");
  expect(pkg.version).toBe("6.2.0");
  expect(pkg.license).toBe("MIT");
  expect(pkg.description).toBe("Core skills library for Claude Code");
  // pi at top level (not nested in oscaner-plugin), preserving upstream
  expect(pkg["oscaner-plugin"]).toEqual({ contentRoot: "." });
  expect(pkg.pi).toEqual({
    extensions: ["./.pi/extensions/superpowers.ts"],
    skills: ["./skills"],
  });
});

test("assemblePackageJson — impeccable version from plugin.json truth, contentRoot plugin", () => {
  const root = makeImpeccableFixture();
  const pkg = assemblePackageJson("impeccable", root);
  expect(pkg.name).toBe("@oscaner-skills/impeccable");
  expect(pkg.version).toBe("4.0.4");
  expect(pkg.license).toBe("Apache-2.0");
  expect(pkg.author).toEqual({
    name: "Paul Bakaus",
    email: "paul@paulbakaus.com",
  });
  // pi at top level, derived from .pi/skills/impeccable (not plugin.json)
  expect(pkg["oscaner-plugin"]).toEqual({ contentRoot: "plugin" });
  expect(pkg.pi).toEqual({ skills: ["./.pi/skills/impeccable"] });
});

test("assemblePackageJson — mattpocock drops upstream private flag", () => {
  const root = makeMattpocockFixture();
  const pkg = assemblePackageJson("mattpocock-skills", root);
  expect(pkg.version).toBe("1.1.0");
  expect(pkg.license).toBe("MIT");
  expect(pkg.private).toBe(undefined);
  // pi at top level, derived from .claude-plugin/plugin.json skills array
  expect(pkg["oscaner-plugin"]).toEqual({ contentRoot: "." });
  expect(Array.isArray(pkg.pi.skills)).toBeTruthy();
  expect(pkg.pi.skills.length >= 21).toBeTruthy();
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

  expect(existsSync(join(dest, "LICENSE"))).toBeTruthy();
  expect(existsSync(join(dest, "plugin", "skills", "impeccable.md"))).toBeTruthy();
  expect(existsSync(join(dest, "LICENSE.link"))).toBeTruthy();
  expect(existsSync(join(dest, ".git"))).toBe(false);
  expect(existsSync(join(dest, "node_modules"))).toBe(false);
});

// ---------------------------------------------------------------------------
// preflight checks
// ---------------------------------------------------------------------------

test("assertSubmoduleCheckedOut throws with update hint when submodule missing", () => {
  const root = makeRoot();
  expect(
    () => assertSubmoduleCheckedOut("superpowers", root),
  ).toThrow(/git submodule update --init/);
});

test("assertSubmoduleCheckedOut throws when dir exists but not checked out", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "impeccable"), { recursive: true });
  expect(
    () => assertSubmoduleCheckedOut("impeccable", root),
  ).toThrow(/git submodule update --init/);
});

test("assertSubmoduleCheckedOut passes for a checked-out submodule", () => {
  const root = makeSuperpowersFixture();
  expect(() => assertSubmoduleCheckedOut("superpowers", root)).not.toThrow();
});

test("assertLicensePresent throws when LICENSE missing", () => {
  const root = makeRoot();
  mkdirSync(join(root, "vendors", "mattpocock-skills"), { recursive: true });
  writeFileSync(join(root, "vendors", "mattpocock-skills", "package.json"), "{}\n");
  expect(() => assertLicensePresent("mattpocock-skills", root)).toThrow(/LICENSE/);
});

test("assertLicensePresent passes when LICENSE present", () => {
  const root = makeSuperpowersFixture();
  expect(() => assertLicensePresent("superpowers", root)).not.toThrow();
});

// ---------------------------------------------------------------------------
// stageVendor — staged assembly artifact
// ---------------------------------------------------------------------------

test("stageVendor copies content, writes scoped package.json + LICENSE", () => {
  const root = makeImpeccableFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("impeccable", root, stageRoot);

  expect(dest).toBe(join(stageRoot, "impeccable"));
  expect(existsSync(join(dest, "LICENSE"))).toBeTruthy();
  expect(existsSync(join(dest, "plugin", ".claude-plugin", "plugin.json"))).toBeTruthy();
  const pkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf8"));
  expect(pkg.name).toBe("@oscaner-skills/impeccable");
  expect(pkg.version).toBe("4.0.4");
  // pi at top level, derived from .pi/skills/impeccable
  expect(pkg.pi).toEqual({ skills: ["./.pi/skills/impeccable"] });
});

// ---------------------------------------------------------------------------
// thinGeminiExtension — mattpocock thin extension (no BeforeTool hooks)
// ---------------------------------------------------------------------------

test("thinGeminiExtension produces name/version/skills/contextFileName, no hooks", () => {
  const ext = thinGeminiExtension("mattpocock-skills", "1.1.0", [
    "./skills/tdd",
    "./skills/grilling",
  ]);
  expect(ext.name).toBe("mattpocock-skills");
  expect(ext.version).toBe("1.1.0");
  expect(ext.skills).toEqual(["./skills/tdd", "./skills/grilling"]);
  expect(ext.contextFileName).toBe("GEMINI.md");
  expect(ext.hooks).toBe(undefined);
});

test("thinGeminiExtension omits description when not provided", () => {
  const ext = thinGeminiExtension("x", "0.0.1", []);
  expect(ext.description).toBe(undefined);
  expect(ext.hooks).toBe(undefined);
});

// ---------------------------------------------------------------------------
// stageVendor gemini-extension — mattpocock assembly produces thin extension + GEMINI.md
// ---------------------------------------------------------------------------

test("stageVendor mattpocock produces thin gemini-extension.json", () => {
  const root = makeMattpocockFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("mattpocock-skills", root, stageRoot);

  const geminiPath = join(dest, "gemini-extension.json");
  expect(existsSync(geminiPath)).toBeTruthy();
  const ext = JSON.parse(readFileSync(geminiPath, "utf8"));
  // Name is the scoped package name (from assemblePackageJson)
  expect(ext.name).toBe("@oscaner-skills/mattpocock-skills");
  expect(ext.version).toBe("1.1.0");
  expect(ext.contextFileName).toBe("GEMINI.md");
  expect(Array.isArray(ext.skills)).toBeTruthy();
  expect(ext.skills.length >= 2).toBeTruthy();
  // No BeforeTool hooks in the thin extension
  expect(ext.hooks).toBe(undefined);
});

test("stageVendor mattpocock produces GEMINI.md with skill imports", () => {
  const root = makeMattpocockFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("mattpocock-skills", root, stageRoot);

  const geminiMdPath = join(dest, "GEMINI.md");
  expect(existsSync(geminiMdPath)).toBeTruthy();
  const content = readFileSync(geminiMdPath, "utf8");
  // Skills come from the fixture's .claude-plugin/plugin.json skills array
  expect(content.includes("@./skills/claude-api/SKILL.md")).toBeTruthy();
  expect(content.includes("@./skills/grilling/SKILL.md")).toBeTruthy();
  expect(!content.includes("hooks")).toBeTruthy();
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
  expect(
    () => stageVendor("mattpocock-skills", root, stageRoot),
  ).toThrow(/gemini-extension\.json/);
});

// ---------------------------------------------------------------------------
// stageVendor unaffected — superpowers/impeccable don't get gemini-extension
// ---------------------------------------------------------------------------

test("stageVendor superpowers does not produce gemini-extension.json", () => {
  const root = makeSuperpowersFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("superpowers", root, stageRoot);
  expect(!existsSync(join(dest, "gemini-extension.json"))).toBeTruthy();
});

test("stageVendor impeccable does not produce gemini-extension.json", () => {
  const root = makeImpeccableFixture();
  const stageRoot = join(root, "stage");
  const dest = stageVendor("impeccable", root, stageRoot);
  expect(!existsSync(join(dest, "gemini-extension.json"))).toBeTruthy();
});

// ---------------------------------------------------------------------------
// classifyProbeError — stderr regex 判定 (Task 2)
// ---------------------------------------------------------------------------

test("classifyProbeError — E404 → unpublished", () => {
  expect(classifyProbeError("npm ERR! code E404\nnpm ERR! 404 Not found - GET https://registry.npmjs.org/@oscaner-skills%2fimpeccable")).toBe(PROBE.UNPUBLISHED);
});

test("classifyProbeError — Not found → E404", () => {
  expect(classifyProbeError("npm ERR! 404 Not found")).toBe(PROBE.UNPUBLISHED);
});

test("classifyProbeError — other error → error", () => {
  expect(classifyProbeError("npm ERR! code E403\nnpm ERR! 403 Forbidden")).toBe(PROBE.ERROR);
});

test("classifyProbeError — empty stderr → error", () => {
  expect(classifyProbeError("")).toBe(PROBE.ERROR);
});

// ---------------------------------------------------------------------------
// dry-run stdout contract
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { repoRootFromImportMeta } from "./marketplace-utils.mjs";

test("publish-vendor --dry-run stdout is exactly []", () => {
  const root = repoRootFromImportMeta(import.meta.url);
  const binPath = join(root, "publish-vendor.mjs");
  const { status, stdout, stderr } = spawnSync(
    "node",
    [binPath, "--dry-run"],
    { encoding: "utf8", cwd: root },
  );
  expect(status).toBe(0);
  expect(stdout.trim()).toBe("[]");
  expect(stderr.includes("OK — dry-run complete")).toBeTruthy();
  expect(stderr.includes("staged at")).toBeTruthy();
});
