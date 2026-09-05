/**
 * vendor-assembly — build-time assembly of the vendored submodule plugins as
 * scoped npm packages (`@oscaner-skills/<name>`).
 *
 * Each vendor is an upstream git submodule (`vendors/<name>`, never edited
 * in-tree). This module reads the submodule content and stages a copy with a
 * scoped package.json (name/version/contentRoot/pi key, preserving the upstream
 * LICENSE) for the publish-vendor orchestration.
 *
 * The version is resolved by `resolveVendorVersion` with one priority shared
 * with the marketplace emit chain (source.mjs deriveVendor and marketplace-utils
 * resolveVersion delegate here): the vendored `.claude-plugin/plugin.json`
 * version at the assembly contentRoot first, then the `vX.Y.Z` release tag at
 * the submodule HEAD.
 *
 * `ASSEMBLY_TEMPLATE` is the single owner of the per-vendor assembly
 * `contentRoot` — source.mjs derives repo-relative paths from it rather than
 * duplicating the template.
 */

import {
  readFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, basename } from "node:path";
import {
  SUBMODULE_PATHS,
  TAG_PATTERNS,
  semverFromNearestTag,
} from "./submodule-tags.mjs";
import { thinGeminiExtension, geminiMarkdown } from "../emit/manifests.mjs";

/**
 * Assembly template per vendor — single source of truth for the assembly
 * `contentRoot` (relative to the assembled package root). source.mjs imports
 * this and prefixes the repo submodule path (`vendors/<name>`).
 */
export const ASSEMBLY_TEMPLATE = {
  "mattpocock-skills": { contentRoot: "." },
  superpowers: { contentRoot: "." },
  impeccable: { contentRoot: "plugin" },
};

/**
 * Assembly template for a vendor, with a descriptive guard: a `vendors/` dir
 * exists (listVendors derived it) but the assembly owner has no template entry
 * for it — throw a clear error instead of a bare TypeError at the first
 * `ASSEMBLY_TEMPLATE[name]` dereference.
 * @param {string} name vendor name
 */
export function assemblyTemplate(name) {
  const tpl = ASSEMBLY_TEMPLATE[name];
  if (!tpl) {
    throw new Error(
      `${name}: no ASSEMBLY_TEMPLATE entry in scripts/release/vendor-assembly.mjs — ` +
        "add the vendor's contentRoot to assemble it (and SUBMODULE_PATHS/TAG_PATTERNS " +
        "in scripts/release/submodule-tags.mjs)",
    );
  }
  return tpl;
}

/**
 * Dynamically derive the `pi` key for a vendored submodule. Probes the
 * actual submodule structure instead of hardcoding — upstream structural
 * changes are picked up automatically.
 *
 * Detection priority (pi convention first, plugin.json last):
 *   1. `package.json` top-level `pi` (superpowers — preserve upstream extensions+skills)
 *   2. `.pi/skills/` directory (impeccable — pi convention, not plugin.json)
 *   3. `.claude-plugin/plugin.json` skills array (mattpocock — no .pi/ dir)
 *   4. Fallback: glob `skills/` directory at contentRoot
 *
 * @param {string} submodulePath absolute path to the vendored submodule root
 * @param {string} contentRoot relative contentRoot (e.g. "." or "plugin")
 * @returns {{ skills?: string[], extensions?: string[] }} pi key value
 */
export function derivePiKey(submodulePath, contentRoot) {
  // 1. package.json top-level pi (superpowers — upstream carries extensions+skills)
  const pkgPath = join(submodulePath, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg.pi && typeof pkg.pi === "object") {
      return { ...pkg.pi };
    }
  }

  // 2. .pi/skills/ directory (pi convention — impeccable hits here)
  const piSkillsDir = join(submodulePath, ".pi", "skills");
  if (existsSync(piSkillsDir)) {
    const entries = readdirSync(piSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `./.pi/skills/${e.name}`);
    if (entries.length > 0) {
      return { skills: entries };
    }
  }

  // 3. .claude-plugin/plugin.json skills array (mattpocock — no .pi/ dir)
  const manifestPath = join(
    submodulePath,
    contentRoot,
    ".claude-plugin",
    "plugin.json",
  );
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (Array.isArray(manifest.skills) && manifest.skills.length > 0) {
      return { skills: [...manifest.skills] };
    }
  }

  // 4. Fallback: glob skills/ directory at contentRoot
  const skillsDir = join(submodulePath, contentRoot, "skills");
  if (existsSync(skillsDir)) {
    const entries = readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `./skills/${e.name}`);
    if (entries.length > 0) {
      return { skills: entries };
    }
  }

  // Nothing found — return empty skills (graceful degradation)
  return { skills: [] };
}

/**
 * Resolve the assembled package version for a vendor with a single priority,
 * shared with the marketplace emit chain so a published npm version never
 * disagrees with the marketplace declaration:
 *   1. the vendored `.claude-plugin/plugin.json` `version` at the assembly
 *      contentRoot (impeccable's SOT — its HEAD carries ext-v / cli-v /
 *      skill-v prefixed tags, so a plain v-tag lookup would return null);
 *   2. otherwise the semver from the `vX.Y.Z` release tag at the submodule
 *      HEAD (mattpocock-skills / superpowers carry no plugin.json version).
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function resolveVendorVersion(name, root) {
  const { contentRoot } = assemblyTemplate(name);
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  const manifestPath = join(
    submodulePath,
    contentRoot,
    ".claude-plugin",
    "plugin.json",
  );
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.version) return manifest.version;
  }
  // Release-tag fallback only makes sense for a checked-out submodule (a `.git`
  // marker — dir for a normal checkout, file for a gitlinked submodule). A bare
  // dir (no checkout) can't carry tags, so throw directly instead of running
  // git and letting the subprocess stderr leak.
  if (existsSync(join(submodulePath, ".git"))) {
    const version = semverFromNearestTag(submodulePath, TAG_PATTERNS[name]);
    if (version) return version;
  }
  throw new Error(
    `${name}: no version in ${manifestPath} and no ${TAG_PATTERNS[name]} ` +
      `release tag on submodule HEAD (${SUBMODULE_PATHS[name]})`,
  );
}

/**
 * Build the scoped package.json for a vendor assembly. Carries descriptive
 * metadata from the vendored files (`.claude-plugin/plugin.json` at contentRoot
 * takes precedence over the submodule-root package.json), drops upstream
 * publish controls (`private`, scripts), and adds the `oscaner-plugin` key
 * (contentRoot + pi key). The LICENSE file is preserved separately by the
 * staging copy — `license` here mirrors the upstream SPDX id.
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function assemblePackageJson(name, root) {
  const { contentRoot } = assemblyTemplate(name);
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  const read = (rel) => {
    const p = join(submodulePath, rel);
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  };
  const pkg = read("package.json");
  const manifest = read(join(contentRoot, ".claude-plugin", "plugin.json"));
  const merged = { ...pkg, ...manifest };

  const out = {
    name: `@oscaner-skills/${name}`,
    version: resolveVendorVersion(name, root),
  };
  for (const field of [
    "description",
    "license",
    "author",
    "homepage",
    "keywords",
  ]) {
    if (merged[field] !== undefined) out[field] = merged[field];
  }
  if (merged.repository !== undefined) out.repository = merged.repository;
  out["oscaner-plugin"] = { contentRoot };
  // Dynamic pi derivation from vendored structure (priority: package.json pi →
  // .pi/skills/ → plugin.json skills → fallback skills/ glob)
  const pi = derivePiKey(submodulePath, contentRoot);
  if (pi && Object.keys(pi).length > 0) out.pi = pi;
  return out;
}

/** Dir entries never copied into the staged assembly. */
const COPY_EXCLUDE = new Set([".git", "node_modules"]);

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

/**
 * Fail fast if a vendor submodule isn't checked out (vendors/<name> has no
 * `.git` marker — either missing entirely or never initialized).
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function assertSubmoduleCheckedOut(name, root) {
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  if (!existsSync(join(submodulePath, ".git"))) {
    throw new Error(
      `${name}: submodule not checked out at ${SUBMODULE_PATHS[name]} — ` +
        "run `git submodule update --init`",
    );
  }
}

/**
 * Fail fast if a vendor has no LICENSE file to preserve in the assembly.
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function assertLicensePresent(name, root) {
  const licensePath = join(root, SUBMODULE_PATHS[name], "LICENSE");
  if (!existsSync(licensePath)) {
    throw new Error(
      `${name}: LICENSE missing at ${SUBMODULE_PATHS[name]}/LICENSE — aborting`,
    );
  }
}

/**
 * Fail fast if a vendor already ships its own `gemini-extension.json` — the
 * assembly must not silently overwrite an upstream extension definition.
 * Only checked for vendors that receive a thin gemini-extension during
 * assembly (currently mattpocock-skills).
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function assertNoUpstreamGeminiExtension(name, root) {
  const extPath = join(root, SUBMODULE_PATHS[name], "gemini-extension.json");
  if (existsSync(extPath)) {
    throw new Error(
      `${name}: upstream already has gemini-extension.json at ` +
        `${SUBMODULE_PATHS[name]}/gemini-extension.json — use the upstream version instead`,
    );
  }
}

/**
 * Stage a vendor into `<stageRoot>/<name>`: copy the submodule content (minus
 * `.git`/`node_modules`) and write the scoped package.json. The staged dir is
 * the npm package root — the upstream LICENSE is preserved by the copy.
 * For mattpocock-skills: also generates a thin `gemini-extension.json`
 * (no BeforeTool hooks) and `GEMINI.md` (skill imports).
 * @param {string} name vendor name
 * @param {string} root repo root
 * @param {string} stageRoot parent dir for the staged package
 */
export function stageVendor(name, root, stageRoot) {
  assemblyTemplate(name);
  // Guard: mattpocock-skills must not already ship gemini-extension.json
  if (name === "mattpocock-skills") {
    assertNoUpstreamGeminiExtension(name, root);
  }
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  const dest = join(stageRoot, name);
  rmSync(dest, { recursive: true, force: true });
  // cpSync (recursive, filter) replaces the former hand-written recursive copy —
  // submodule checkouts carry `.git` (the gitlink file) and often a populated
  // `node_modules`; neither belongs in a published npm package. Symlink delta
  // vs. the former copy: with `verbatimSymlinks` false (default) a staged
  // symlink is re-targeted to the *source submodule's* realpath rather than
  // keeping its original relative link text (e.g. `AGENTS.md` →
  // `/…/vendors/superpowers/CLAUDE.md`), so the staged link is only valid while
  // the source checkout exists — pack before the source moves. The published
  // tarball is unaffected: npm drops symlinks.
  cpSync(submodulePath, dest, {
    recursive: true,
    filter: (p) => !COPY_EXCLUDE.has(basename(p)),
  });
  const pkg = assemblePackageJson(name, root);
  writeFileSync(join(dest, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  // mattpocock-skills: thin gemini-extension.json + GEMINI.md
  if (name === "mattpocock-skills") {
    const skillDirs = pkg.pi?.skills ?? [];
    const ext = thinGeminiExtension(pkg.name, pkg.version, skillDirs);
    writeFileSync(join(dest, "gemini-extension.json"), JSON.stringify(ext, null, 2) + "\n");
    // Extract skill directory names from pi.skills paths (e.g. "./skills/tdd" → "tdd")
    const skillNames = [...new Set(skillDirs.map((d) => d.split("/").filter(Boolean).pop()))];
    const geminiMd = geminiMarkdown(pkg.name, skillNames);
    writeFileSync(join(dest, "GEMINI.md"), geminiMd);
  }
  return dest;
}