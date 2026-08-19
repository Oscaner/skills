/** @param {string} version e.g. "6.2.0-router.0.15.0" */
export function parseRouterVersion(version) {
  const m = /^(\d+\.\d+\.\d+)-router\.(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) return null;
  return {
    base: m[1],
    major: Number(m[2]),
    minor: Number(m[3]),
    patch: Number(m[4]),
  };
}

/** @param {string} current @param {string} superpowersVersion */
export function computeNextVersion(current, superpowersVersion) {
  const parsed = parseRouterVersion(current);
  if (!parsed || parsed.base !== superpowersVersion) {
    return `${superpowersVersion}-router.0.0.0`;
  }
  return `${parsed.base}-router.${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

/** @param {string} version e.g. "0.1.0" */
export function parseSemver(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

/**
 * osuperpowers independent semver bump.
 * @param {string} current e.g. "0.1.0"
 * @param {"patch"|"minor"|"major"} bumpLevel
 */
export function computeNextIndependentVersion(current, bumpLevel) {
  const parsed = parseSemver(current);
  if (!parsed) throw new Error(`Invalid semver: ${current}`);
  switch (bumpLevel) {
    case "major":
      return `${parsed.major + 1}.0.0`;
    case "minor":
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case "patch":
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    default:
      throw new Error(`Unknown bump level: ${bumpLevel}`);
  }
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
