import { parse as semverParse, inc as semverInc } from "semver";

const BUMP_LEVELS = new Set(["major", "minor", "patch"]);

/** @param {string} version e.g. "0.1.0" */
export function parseSemver(version) {
  const p = semverParse(version);
  return p && !p.prerelease.length && !p.build.length
    ? { major: p.major, minor: p.minor, patch: p.patch }
    : null;
}

/**
 * osuperpowers independent semver bump.
 * @param {string} current e.g. "0.1.0"
 * @param {"patch"|"minor"|"major"} bumpLevel
 */
export function computeNextIndependentVersion(current, bumpLevel) {
  // 保留既有错误契约：未知 bumpLevel → Unknown bump level（semver.inc 对非法 level 返回 null，需前置校验）
  if (!BUMP_LEVELS.has(bumpLevel)) throw new Error(`Unknown bump level: ${bumpLevel}`);
  const next = semverInc(current, bumpLevel);
  if (!next) throw new Error(`Invalid semver: ${current}`);
  return next;
}

const BUMP_RANK = { patch: 0, minor: 1, major: 2 };

/** @param {string[]} types changeset bump types */
export function highestBumpLevel(types) {
  let best = "patch";
  for (const type of types) {
    if ((BUMP_RANK[type] ?? 0) > BUMP_RANK[best]) best = type;
  }
  return best;
}

/**
 * @param {Array<{ releases?: Array<{ name: string, type: string }> }>} changesets
 * @param {string} pluginName
 */
export function changesetsForPlugin(changesets, pluginName) {
  return changesets.filter((cs) =>
    cs.releases?.some((r) => r.name === pluginName),
  );
}
