/**
 * vendor-registry — registry/repository probing for the vendored plugin
 * publish flow (split out of the pre-P2 monolithic publish script in the
 * release domain extraction).
 *
 * Probe family (all fail-closed: an unexpected registry/network error throws
 * or returns PROBE.ERROR, aborting the release rather than skipping a publish),
 * the registry-gap diff (collectGaps + resolveUpstreamTag), and the vendored
 * plugin set discovery (listVendors / readGitmodules).
 */

import { $ } from "execa";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SUBMODULE_PATHS, TAG_PATTERNS } from "./submodule-tags.mjs";

/** @enum {string} probe result constants */
export const PROBE = Object.freeze({ PUBLISHED: "published", UNPUBLISHED: "unpublished", ERROR: "error" });

/** classifyProbe return values */
export const PROBE_CLASS = Object.freeze({ PUBLISHED: "skip", SHOULD_PUBLISH: "publish" });

/** @param {typeof PROBE[keyof typeof PROBE]} probeResult */
export function decideProbe(probeResult) {
  if (probeResult === PROBE.PUBLISHED) return PROBE_CLASS.PUBLISHED;
  if (probeResult === PROBE.UNPUBLISHED) return PROBE_CLASS.SHOULD_PUBLISH;
  throw new Error(`probe error (${probeResult}) — aborting release`);
}

/**
 * @param {string[]} allVersions   merged version list (registryVersions ∪ publishedThisRun, deduplicated)
 * @param {Set<string>} tagIndex   the `version` set that already has a tag
 * @param {Set<string>} releaseIndex  the `version` set that already has a Release
 * @returns {{ version: string }[]}
 */
export function collectGaps(allVersions, tagIndex, releaseIndex) {
  return allVersions
    .filter((v) => !tagIndex.has(v) || !releaseIndex.has(v))
    .map((version) => ({ version }));
}

/**
 * @param {string}   version current version
 * @param {{ headVersion: string|null, headTag: string|null }} ctx
 * @param {(tagRef: string) => boolean} tagExists  injected tag probe (pure function — stubbable)
 * @returns {string|null} upstreamTag (null = both candidates fail → omitted)
 */
export function resolveUpstreamTag(version, ctx, tagExists) {
  if (ctx.headVersion === version && ctx.headTag) return ctx.headTag;
  const candidates = [`v${version}`, `skill-v${version}`];
  for (const tag of candidates) {
    if (tagExists(`refs/tags/${tag}`)) return tag;
  }
  return null;
}

/** Classify npm view stderr: E404/Not found → PROBE.UNPUBLISHED; otherwise → PROBE.ERROR */
export function classifyProbeError(stderr) {
  if (/E404|Not found/i.test(stderr)) return PROBE.UNPUBLISHED;
  return PROBE.ERROR;
}

/** Tri-state probe: npm view <name>@<version> → PROBE.PUBLISHED | PROBE.UNPUBLISHED | PROBE.ERROR */
export function probeRegistryVersion(name, version) {
  try {
    $.sync`npm view ${name + "@" + version} version`;
    return PROBE.PUBLISHED;
  } catch (e) {
    return classifyProbeError(e.stderr ?? "");
  }
}

/** List published versions; E404 → [] (not yet first-published); other errors → throw (fail-closed, like the probes) */
export function listRegistryVersions(name) {
  try {
    const { stdout } = $.sync`npm view ${name} versions --json`;
    return JSON.parse(stdout ?? "[]");
  } catch (e) {
    if (/E404|Not found/i.test(e.stderr ?? "")) return [];
    throw new Error(
      `npm view versions failed for ${name}: ${(e.stdout ?? "") + (e.stderr ?? "")}`,
    );
  }
}

/** git ls-remote: check whether the tag exists on origin */
export function probeTagExists(name, version) {
  try {
    $.sync({ stdio: "ignore" })`git ls-remote --exit-code --tags origin refs/tags/${name}@${version}`;
    return true;
  } catch {
    return false;
  }
}

/** gh release view: check whether the Release exists (the runner injects the GITHUB_TOKEN env) */
export function probeReleaseExists(name, version) {
  try {
    $.sync({ stdio: "ignore" })`gh release view ${name + "@" + version}`;
    return true;
  } catch {
    return false;
  }
}

/** Parse .gitmodules, returning the vendor upstream owner/repo (GitHub → "owner/repo"; non-GitHub → null) */
export function readGitmodules(root, vendorName) {
  const content = readFileSync(join(root, ".gitmodules"), "utf8");
  const sectionRegex = /\[submodule "([^"]+)"\][^[]*?url\s*=\s*([^\n]+)/gs;
  for (const [, subName, url] of content.matchAll(sectionRegex)) {
    if (subName === vendorName) {
      const m = url.trim().match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      return m ? `${m[1]}/${m[2]}` : null;
    }
  }
  return null;
}

/** git ls-remote: probe whether the upstream repo has the given tag (non-GitHub host → false) */
export function probeUpstreamTagExists(root, vendorName, tagRef) {
  const upstreamRepo = readGitmodules(root, vendorName);
  if (!upstreamRepo) return false;
  const url = `https://github.com/${upstreamRepo}.git`;
  try {
    $.sync({ stdio: "ignore" })`git ls-remote --exit-code --tags ${url} ${tagRef}`;
    return true;
  } catch {
    return false;
  }
}

/** Find the tag on the submodule HEAD that matches TAG_PATTERNS (null = no match) */
export function headTagAtHead(root, vendorName) {
  const submodulePath = join(root, SUBMODULE_PATHS[vendorName]);
  try {
    const { stdout } = $.sync`git -C ${submodulePath} tag --points-at HEAD`;
    return (
      stdout.split("\n").find((t) => t && TAG_PATTERNS[vendorName].test(t)) ??
      null
    );
  } catch {
    return null;
  }
}

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