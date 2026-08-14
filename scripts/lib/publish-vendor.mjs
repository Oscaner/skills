/**
 * publish-vendor — build-time assembly of the vendored submodule plugins as
 * scoped npm packages (`@oscaner-skills/<name>`).
 *
 * Each vendor is an upstream git submodule (`vendors/<name>`, never edited
 * in-tree). This module reads the submodule content, stages a copy with a
 * scoped package.json (name/version/contentRoot/pi key, preserving the
 * upstream LICENSE), and runs `npm publish [--dry-run]`.
 *
 * Version source is per-vendor:
 *   - mattpocock-skills / superpowers → the semver from the `vX.Y.Z` release
 *     tag at the submodule HEAD (submodule-tags).
 *   - impeccable → `.claude-plugin/plugin.json` is the version SOT (its HEAD
 *     tags are ext-v / cli-v / skill-v prefixed — a plain v-tag lookup returns
 *     null, so the plugin.json truth is used instead).
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

/** Vendors republished by publish-vendor (stable order). */
export const VENDORS = ["mattpocock-skills", "impeccable", "superpowers"];

/**
 * Assembly template per vendor. `contentRoot` is relative to the assembled
 * package root (mirrors `VENDOR_PLUGINS` in emit/source.mjs).
 */
export const ASSEMBLY_TEMPLATE = {
  "mattpocock-skills": { contentRoot: "." },
  superpowers: { contentRoot: "." },
  impeccable: { contentRoot: "plugin" },
};

/** Where each vendor's package version comes from. */
const VERSION_SOURCE = {
  "mattpocock-skills": "submodule-tags",
  superpowers: "submodule-tags",
  impeccable: "plugin.json",
};

/**
 * Resolve the assembled package version for a vendor.
 * - submodule-tags: semver from the `vX.Y.Z` tag at submodule HEAD.
 * - plugin.json: the vendored `.claude-plugin/plugin.json` `version` field is
 *   the source of truth (impeccable's HEAD carries ext-v / cli-v / skill-v
 *   prefixed tags — a plain v-tag lookup returns null).
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function resolveVendorVersion(name, root) {
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  if (VERSION_SOURCE[name] === "plugin.json") {
    const manifestPath = join(
      submodulePath,
      ASSEMBLY_TEMPLATE[name].contentRoot,
      ".claude-plugin",
      "plugin.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (!manifest.version) {
      throw new Error(`${name}: no version in ${manifestPath}`);
    }
    return manifest.version;
  }
  const version = semverFromNearestTag(submodulePath, TAG_PATTERNS[name]);
  if (!version) {
    throw new Error(
      `${name}: no ${TAG_PATTERNS[name]} release tag on submodule HEAD ` +
        `(${SUBMODULE_PATHS[name]})`,
    );
  }
  return version;
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
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  const { contentRoot } = ASSEMBLY_TEMPLATE[name];
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
  for (const name of VENDORS) {
    publishVendor(name, root, { dryRun, stageRoot });
  }
  return stageRoot;
}
