import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GENERATED = "scripts/emit-marketplace.mjs — do not edit";

/** @param {string} root */
export function readSource(root) {
  const path = join(root, "marketplace/source.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * @param {string} root
 * @param {{ name: string, version?: string }} plugin
 */
export function resolveVersion(root, plugin) {
  const truthPaths = {
    "mattpocock-skills": join(
      root,
      "mattpocock-skills/.claude-plugin/plugin.json",
    ),
    impeccable: join(root, "impeccable/plugin/.claude-plugin/plugin.json"),
    superpowers: join(root, "superpowers/.claude-plugin/plugin.json"),
    "superpowers-overrides": join(root, "superpowers-overrides/package.json"),
  };

  const truthPath = truthPaths[plugin.name];
  if (!truthPath || !existsSync(truthPath)) {
    throw new Error(`Missing truth source for ${plugin.name}: ${truthPath}`);
  }

  const truth = JSON.parse(readFileSync(truthPath, "utf8"));
  const truthVersion = truth.version;
  if (!truthVersion) {
    throw new Error(`No version in truth source: ${truthPath}`);
  }

  if (plugin.name === "mattpocock-skills") {
    if (plugin.version !== undefined && plugin.version !== truthVersion) {
      throw new Error(
        `Version mismatch for ${plugin.name}: source=${plugin.version} truth=${truthVersion} (${truthPath})`,
      );
    }
    return { version: truthVersion, includeInClaude: plugin.version !== undefined };
  }

  if (plugin.version === undefined) {
    throw new Error(
      `Missing version in source for ${plugin.name} (required)`,
    );
  }
  if (plugin.version !== truthVersion) {
    throw new Error(
      `Version mismatch for ${plugin.name}: source=${plugin.version} truth=${truthVersion} (${truthPath})`,
    );
  }
  return { version: truthVersion, includeInClaude: true };
}

/** @param {object} source @param {object} plugin @param {{ version: string, includeInClaude: boolean }} resolved */
export function claudeMarketplaceEntry(plugin, resolved) {
  const entry = {
    name: plugin.name,
    source: `./${plugin.contentRoot}`,
    description: plugin.description,
    author: plugin.author,
  };
  if (plugin.homepage) entry.homepage = plugin.homepage;
  if (plugin.repository) entry.repository = plugin.repository;
  if (plugin.license) entry.license = plugin.license;
  if (resolved.includeInClaude && resolved.version) {
    entry.version = resolved.version;
  }
  if (plugin.claude?.category) entry.category = plugin.claude.category;
  if (plugin.claude?.keywords?.length) entry.keywords = plugin.claude.keywords;
  if (plugin.claude?.tags?.length) entry.tags = plugin.claude.tags;
  return entry;
}

/** @param {object} plugin @param {{ version: string }} resolved */
export function cursorWrapperManifest(plugin, resolved) {
  const manifest = {
    _generated: GENERATED,
    name: plugin.name,
    displayName: plugin.cursor.displayName,
    description: plugin.description,
    author: plugin.author,
    skills: plugin.cursor.skills,
    version: resolved.version,
  };
  if (plugin.homepage) manifest.homepage = plugin.homepage;
  if (plugin.repository) manifest.repository = plugin.repository;
  if (plugin.license) manifest.license = plugin.license;
  if (plugin.cursor.hooks) manifest.hooks = plugin.cursor.hooks;
  return manifest;
}

/**
 * @param {string} root
 * @param {object} plugin
 */
export function assertCursorPathsExist(root, plugin) {
  const wrapperRoot = join(root, "cursor-plugins", plugin.name);
  for (const [field, rel] of [
    ["skills", plugin.cursor.skills],
    ["hooks", plugin.cursor.hooks],
  ]) {
    if (!rel) continue;
    const abs = resolve(wrapperRoot, rel);
    if (!existsSync(abs)) {
      throw new Error(
        `Missing ${field} path for ${plugin.name}: ${rel} → ${abs}`,
      );
    }
  }
}

/** @param {string} root @param {object} source */
export function assertPrereleasePrefix(root, source) {
  const overrides = source.plugins.find((p) => p.name === "superpowers-overrides");
  const superpowers = source.plugins.find((p) => p.name === "superpowers");
  if (!overrides?.version || !superpowers?.version) return;
  const prefix = `${superpowers.version}-overrides.`;
  if (!overrides.version.startsWith(prefix)) {
    throw new Error(
      `${overrides.version} must start with ${prefix}`,
    );
  }
}

export function claudeMarketplaceDocument(source, plugins) {
  return {
    _generated: GENERATED,
    $schema: "https://www.schemastore.org/claude-code-marketplace.json",
    name: source.name,
    metadata: source.metadata,
    owner: source.owner,
    plugins,
  };
}

export function cursorMarketplaceDocument(source, plugins) {
  return {
    _generated: GENERATED,
    name: source.name,
    owner: source.owner,
    metadata: source.metadata,
    plugins,
  };
}

/** @param {string} root */
export function repoRootFromImportMeta(importMetaUrl) {
  return resolve(dirname(fileURLToPath(importMetaUrl)), "..");
}
