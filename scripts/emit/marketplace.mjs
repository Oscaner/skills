/**
 * Marketplace documents (repo root) + vendored cursor wrappers.
 *
 * Non-plugin-root plugins get a cursor wrapper under `cursor-plugins/<name>`;
 * the wrapper product root is appended to the shared `productRoots` constant
 * (owned by `emit/compare.mjs`) so the stale-extra walk covers it.
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
import { productRoots } from "./compare.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function emitMarketplaceDocs(outRoot, source, generatedPaths) {
  const claudePlugins = [];
  const cursorMarketplacePlugins = [];

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
      productRoots.push(`cursor-plugins/${plugin.name}`);
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
}