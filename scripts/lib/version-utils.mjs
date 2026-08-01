/** @param {string} version e.g. "6.2.0-overrides.3" */
export function parseOverridesVersion(version) {
  const m = /^(\d+\.\d+\.\d+)-overrides\.(\d+)$/.exec(version);
  if (!m) return null;
  return { base: m[1], n: Number(m[2]) };
}

/** @param {string} current @param {string} superpowersVersion */
export function computeNextVersion(current, superpowersVersion) {
  const parsed = parseOverridesVersion(current);
  if (!parsed || parsed.base !== superpowersVersion) {
    return `${superpowersVersion}-overrides.0`;
  }
  return `${parsed.base}-overrides.${parsed.n + 1}`;
}
