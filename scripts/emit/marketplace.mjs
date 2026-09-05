/**
 * Marketplace documents (repo root) + vendored cursor wrappers.
 *
 * Non-plugin-root plugins get a cursor wrapper under `cursor-plugins/<name>`.
 * The wrapper roots this run emits are returned so the caller can fold them
 * into the drift-check product roots (`emit/compare.mjs` owns the base set).
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveVersion,
  claudeMarketplaceEntry,
  cursorWrapperManifest,
  assertCursorPathsExist,
  claudeMarketplaceDocument,
  cursorMarketplaceDocument,
  isPluginRoot,
} from "../lib/marketplace-utils.mjs";
import { generatedBanner } from "./manifests.mjs";
import { writeJsonDoc } from "./orchestrate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Write the repo-root marketplace docs + cursor-wrapper manifests.
 * @returns {string[]} `cursor-plugins/<name>` roots emitted for non-plugin-root
 *   plugins (folded into the drift-check product roots by the caller)
 */
export function emitMarketplaceDocs(outRoot, source, generatedPaths) {
  const claudePlugins = [];
  const cursorMarketplacePlugins = [];
  const wrapperRoots = [];

  for (const plugin of source.plugins) {
    const resolved = resolveVersion(root, plugin);
    assertCursorPathsExist(root, plugin);

    claudePlugins.push(claudeMarketplaceEntry(plugin, resolved));
    cursorMarketplacePlugins.push({
      _generated: generatedBanner,
      name: plugin.name,
      source: isPluginRoot(plugin)
        ? `./${plugin.contentRoot}`
        : `cursor-plugins/${plugin.name}`,
      description: plugin.description,
    });

    if (!isPluginRoot(plugin)) {
      wrapperRoots.push(`cursor-plugins/${plugin.name}`);
      writeJsonDoc(
        outRoot,
        `cursor-plugins/${plugin.name}/.cursor-plugin/plugin.json`,
        cursorWrapperManifest(plugin, resolved),
        generatedPaths,
      );
    }
  }

  writeJsonDoc(
    outRoot,
    ".claude-plugin/marketplace.json",
    claudeMarketplaceDocument(source, claudePlugins),
    generatedPaths,
  );
  writeJsonDoc(
    outRoot,
    ".cursor-plugin/marketplace.json",
    cursorMarketplaceDocument(source, cursorMarketplacePlugins),
    generatedPaths,
  );

  return wrapperRoots;
}
