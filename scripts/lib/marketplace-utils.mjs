import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TAG_PATTERNS,
  SUBMODULE_PATHS,
  semverFromNearestTag,
} from "./submodule-tags.mjs";

const GENERATED = "scripts/emit.mjs — do not edit";

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
      "plugins/mattpocock-skills/.claude-plugin/plugin.json",
    ),
    impeccable: join(
      root,
      "plugins/impeccable/plugin/.claude-plugin/plugin.json",
    ),
    superpowers: join(root, "plugins/superpowers/.claude-plugin/plugin.json"),
    "superpowers-overrides": join(
      root,
      "plugins/superpowers-overrides/package.json",
    ),
    "os-engineering": join(root, "plugins/os-engineering/package.json"),
  };

  const truthPath = truthPaths[plugin.name];
  if (!truthPath || !existsSync(truthPath)) {
    throw new Error(`Missing truth source for ${plugin.name}: ${truthPath}`);
  }

  const truth = JSON.parse(readFileSync(truthPath, "utf8"));
  const truthVersion = truth.version;

  if (plugin.name === "mattpocock-skills") {
    const submodulePath = join(root, SUBMODULE_PATHS["mattpocock-skills"]);
    const pattern = TAG_PATTERNS["mattpocock-skills"];
    const effectiveVersion =
      truthVersion ?? semverFromNearestTag(submodulePath, pattern);
    if (!effectiveVersion) {
      throw new Error(
        `No version in ${truthPath} and no v* release tag on submodule HEAD`,
      );
    }
    if (plugin.version !== undefined && plugin.version !== effectiveVersion) {
      throw new Error(
        `Version mismatch for ${plugin.name}: source=${plugin.version} truth=${effectiveVersion} (${truthPath})`,
      );
    }
    return {
      version: effectiveVersion,
      includeInClaude: plugin.version !== undefined,
    };
  }

  if (!truthVersion) {
    throw new Error(`No version in truth source: ${truthPath}`);
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

/** @param {object} plugin */
export function isPluginRoot(plugin) {
  return plugin.cursor?.emitMode === "plugin-root";
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
  };
  if (resolved.version) manifest.version = resolved.version;
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
  if (isPluginRoot(plugin)) {
    const contentRoot = join(root, plugin.contentRoot);
    const manifestPath = join(contentRoot, ".cursor-plugin/plugin.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`Missing plugin-root manifest: ${manifestPath}`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const field of ["skills", "hooks"]) {
      if (!manifest[field]) continue;
      const abs = resolve(contentRoot, manifest[field]);
      if (!existsSync(abs)) {
        throw new Error(`Missing ${field} for ${plugin.name}: ${abs}`);
      }
    }
    return;
  }

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
