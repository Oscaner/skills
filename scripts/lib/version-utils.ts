// scripts/lib/version-utils.ts — the scripts version domain service (Task 9, 判定标准②:
// pure computation rules → a stateless domain service class, zero bare-function module).
// Shared by release/version-packages.ts; the method names are the versioning rules of the
// monorepo's independent-semver release flow.

import { inc as semverInc, parse as semverParse } from "semver";

const BUMP_LEVELS = new Set(["major", "minor", "patch"]);

const BUMP_RANK: Record<string, number> = { patch: 0, minor: 1, major: 2 };

export class VersionService {
  /** @param {string} version e.g. "0.1.0" */
  parseSemver(version) {
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
  computeNextIndependentVersion(current, bumpLevel) {
    // Preserve the legacy error contract: unknown bumpLevel → "Unknown bump level".
    // semver.inc returns null for illegal levels, so validate bumpLevel up front.
    if (!BUMP_LEVELS.has(bumpLevel)) throw new Error(`Unknown bump level: ${bumpLevel}`);
    const next = semverInc(current, bumpLevel);
    if (!next) throw new Error(`Invalid semver: ${current}`);
    return next;
  }

  /** @param {string[]} types changeset bump types */
  highestBumpLevel(types) {
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
  changesetsForPlugin(changesets, pluginName) {
    return changesets.filter((cs) => cs.releases?.some((r) => r.name === pluginName));
  }
}

export const versionService = new VersionService();
