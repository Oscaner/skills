import { execSync } from "node:child_process";

export const TAG_PATTERNS = {
  "mattpocock-skills": /^v(\d+\.\d+\.\d+)$/,
  superpowers: /^v(\d+\.\d+\.\d+)$/,
  impeccable: /^skill-v(\d+\.\d+\.\d+)$/,
};

export const SUBMODULE_PATHS = {
  "mattpocock-skills": "plugins/mattpocock-skills",
  superpowers: "plugins/superpowers",
  impeccable: "plugins/impeccable",
};

/** @param {string} tag @param {RegExp} pattern */
export function parseSemverFromTag(tag, pattern) {
  const m = pattern.exec(tag);
  return m ? m[1] : null;
}

/** @param {string[]} tags @param {RegExp} pattern */
export function sortTagsBySemver(tags, pattern) {
  return [...tags].sort((a, b) => {
    const pa = parseSemverFromTag(a, pattern)?.split(".").map(Number) ?? [];
    const pb = parseSemverFromTag(b, pattern)?.split(".").map(Number) ?? [];
    for (let i = 0; i < 3; i++) {
      if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
    }
    return 0;
  });
}

/** @param {string} submodulePath @param {string} args */
function git(submodulePath, args) {
  return execSync(`git -C ${submodulePath} ${args}`, { encoding: "utf8" }).trim();
}

/** @param {string} submodulePath */
export function fetchTags(submodulePath) {
  git(submodulePath, "fetch --tags origin");
}

/** @param {string} submodulePath @param {RegExp} pattern */
export function listMatchingTags(submodulePath, pattern) {
  const raw = git(submodulePath, "tag -l");
  if (!raw) return [];
  return raw.split("\n").filter((t) => t && pattern.test(t));
}

/** @param {string} submodulePath @param {string} tag */
export function resolveTagSha(submodulePath, tag) {
  return git(submodulePath, `rev-parse ${tag}^{commit}`);
}

/** @param {string} submodulePath */
export function pinnedSha(submodulePath) {
  return git(submodulePath, "rev-parse HEAD");
}

/** @param {string} submodulePath @param {RegExp} pattern */
export function nearestTag(submodulePath, pattern) {
  try {
    const tag = git(submodulePath, "describe --tags --abbrev=0");
    return pattern.test(tag) ? tag : null;
  } catch {
    return null;
  }
}

/** @param {string} submodulePath @param {RegExp} pattern */
export function latestTag(submodulePath, pattern) {
  const tags = sortTagsBySemver(
    listMatchingTags(submodulePath, pattern),
    pattern,
  );
  if (tags.length === 0) {
    throw new Error(`No tags matching ${pattern} in ${submodulePath}`);
  }
  const tag = tags.at(-1);
  return { tag, sha: resolveTagSha(submodulePath, tag) };
}

/** @param {string} submodulePath @param {RegExp} pattern */
export function semverFromNearestTag(submodulePath, pattern) {
  const tag = nearestTag(submodulePath, pattern);
  if (!tag) return null;
  return parseSemverFromTag(tag, pattern);
}

/** @param {string} submodulePath @param {RegExp} pattern */
export function hasUpdate(submodulePath, pattern) {
  fetchTags(submodulePath);
  const latest = latestTag(submodulePath, pattern);
  return pinnedSha(submodulePath) !== latest.sha;
}
