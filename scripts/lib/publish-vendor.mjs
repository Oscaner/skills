/**
 * publish-vendor — build-time assembly of the vendored submodule plugins as
 * scoped npm packages (`@oscaner-skills/<name>`).
 *
 * Each vendor is an upstream git submodule (`vendors/<name>`, never edited
 * in-tree). This module reads the submodule content, stages a copy with a
 * scoped package.json (name/version/contentRoot/pi key, preserving the
 * upstream LICENSE), and runs `npm publish [--dry-run]`.
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

import { execSync } from "node:child_process";
import {
  readFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  symlinkSync,
  readlinkSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import {
  SUBMODULE_PATHS,
  TAG_PATTERNS,
  semverFromNearestTag,
} from "./submodule-tags.mjs";
import { piPackageKey } from "./emit/manifests.mjs";

/**
 * Discover the vendored plugin set from the `vendors/` directory, sorted.
 * cwd-independent — the caller passes the repo root. A vendor is any
 * subdirectory (submodule checkout); non-directory entries (e.g. `.DS_Store`)
 * are ignored. A dir present here but missing an `ASSEMBLY_TEMPLATE` entry
 * fails later via `assemblyTemplate` with a clear error, never a bare
 * TypeError.
 * @param {string} root repo root
 */
export function listVendors(root) {
  return readdirSync(join(root, "vendors"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

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
      `${name}: no ASSEMBLY_TEMPLATE entry in scripts/lib/publish-vendor.mjs — ` +
        "add the vendor's contentRoot to assemble it (and SUBMODULE_PATHS/TAG_PATTERNS " +
        "in scripts/lib/submodule-tags.mjs)",
    );
  }
  return tpl;
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
  // git and letting the execSync stderr leak.
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
  out["oscaner-plugin"] = { contentRoot, pi: piPackageKey() };
  return out;
}

/** Dir entries never copied into the staged assembly. */
const COPY_EXCLUDE = new Set([".git", "node_modules"]);

/**
 * Recursively copy `src` into `dest` (created if missing), skipping `.git` and
 * `node_modules` and preserving symlinks. Submodule checkouts carry `.git`
 * (the gitlink file) and often a populated `node_modules` — neither belongs in
 * a published npm package.
 * @param {string} src
 * @param {string} dest
 */
export function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (COPY_EXCLUDE.has(entry.name)) continue;
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(d, { recursive: true });
      copyTree(s, d);
    } else if (entry.isSymbolicLink()) {
      symlinkSync(readlinkSync(s), d);
    } else if (entry.isFile()) {
      copyFileSync(s, d);
    }
  }
}

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
 * Stage a vendor into `<stageRoot>/<name>`: copy the submodule content (minus
 * `.git`/`node_modules`) and write the scoped package.json. The staged dir is
 * the npm package root — the upstream LICENSE is preserved by the copy.
 * @param {string} name vendor name
 * @param {string} root repo root
 * @param {string} stageRoot parent dir for the staged package
 */
export function stageVendor(name, root, stageRoot) {
  assemblyTemplate(name);
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  const dest = join(stageRoot, name);
  rmSync(dest, { recursive: true, force: true });
  copyTree(submodulePath, dest);
  const pkg = assemblePackageJson(name, root);
  writeFileSync(join(dest, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  return dest;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Stage one vendor and run `npm publish` in the staged dir.
 * @param {string} name vendor name
 * @param {string} root repo root
 * @param {{ dryRun?: boolean, stageRoot: string }} opts
 */
export function publishVendor(name, root, { dryRun = false, stageRoot }) {
  assemblyTemplate(name);
  assertSubmoduleCheckedOut(name, root);
  assertLicensePresent(name, root);
  const dest = stageVendor(name, root, stageRoot);
  const flags = ["publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])];
  execSync(`npm ${flags.join(" ")}`, { cwd: dest, stdio: "inherit" });
  return dest;
}

/** Default staging parent for all assembled vendor packages. */
export function defaultStageRoot(root) {
  return join(root, "tmp", "publish-vendor");
}

/**
 * Assemble + publish every vendor. Fresh staging root each run (stale staged
 * packages from a previous run are removed first). Returns the staging root.
 * @param {string} root repo root
 * @param {{ dryRun?: boolean }} opts
 */
export function publishAll(root, { dryRun = false } = {}) {
  const stageRoot = defaultStageRoot(root);
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });
  for (const name of listVendors(root)) {
    publishVendor(name, root, { dryRun, stageRoot });
  }
  return stageRoot;
}
