// scripts/lib/marketplace-utils.ts — the marketplace domain service (Task 9, Criterion ②: pure
// computation rules → a stateless domain service class, zero bare-function module). Constructed
// with the repo root; every method takes the remaining inputs as parameters — no module state,
// no repo-root closure. Consumed by the emit toolchain (scripts/emit/marketplace.ts +
// scripts/emit/osuperpowers.ts).

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const GENERATED = "scripts/run.ts emit — do not edit";

export class MarketplaceService {
  /** repo root the service resolves manifests against (constructor-injected). */
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  /**
   * @param {{ name: string, version?: string }} plugin
   */
  resolveVersion(plugin) {
    // First-party: package.json is the version SOT. The vendor branch (listVendors
    // + resolveVendorVersion) was retired with the self-maintenance surface (P6 B9).
    const truthPath = join(this.root, "packages", plugin.name, "package.json");
    if (!existsSync(truthPath)) {
      throw new Error(`Missing truth source for ${plugin.name}: ${truthPath}`);
    }

    const truth = JSON.parse(readFileSync(truthPath, "utf8"));
    const truthVersion = truth.version;

    if (!truthVersion) {
      throw new Error(`No version in truth source: ${truthPath}`);
    }

    if (plugin.version === undefined) {
      throw new Error(`Missing version in source for ${plugin.name} (required)`);
    }
    if (plugin.version !== truthVersion) {
      throw new Error(
        `Version mismatch for ${plugin.name}: source=${plugin.version} truth=${truthVersion} (${truthPath})`,
      );
    }
    return { version: truthVersion, includeInClaude: true };
  }

  /** @param {object} plugin @param {{ version: string, includeInClaude: boolean }} resolved */
  claudeMarketplaceEntry(plugin, resolved) {
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
  isPluginRoot(plugin) {
    return plugin.cursor?.emitMode === "plugin-root";
  }

  /** @param {object} plugin @param {{ version: string }} resolved */
  cursorWrapperManifest(plugin, resolved) {
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
   * @param {object} plugin
   */
  assertCursorPathsExist(plugin) {
    if (this.isPluginRoot(plugin)) {
      const contentRoot = join(this.root, plugin.contentRoot);
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

    const wrapperRoot = join(this.root, "cursor-plugins", plugin.name);
    for (const [field, rel] of [
      ["skills", plugin.cursor.skills],
      ["hooks", plugin.cursor.hooks],
    ]) {
      if (!rel) continue;
      const abs = resolve(wrapperRoot, rel);
      if (!existsSync(abs)) {
        throw new Error(`Missing ${field} path for ${plugin.name}: ${rel} → ${abs}`);
      }
    }
  }

  claudeMarketplaceDocument(source, plugins) {
    return {
      _generated: GENERATED,
      $schema: "https://www.schemastore.org/claude-code-marketplace.json",
      name: source.name,
      metadata: source.metadata,
      owner: source.owner,
      plugins,
    };
  }

  cursorMarketplaceDocument(source, plugins) {
    return {
      _generated: GENERATED,
      name: source.name,
      owner: source.owner,
      metadata: source.metadata,
      plugins,
    };
  }
}
