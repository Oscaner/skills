/**
 * Marketplace documents (repo root) + cursor wrappers — the MarketplaceDocsEmitter domain
 * service (Task 9, Criterion ②: stateless, constructor injection — composes MarketplaceService + EmitOrchestrator).
 *
 * Non-plugin-root plugins get a cursor wrapper under `cursor-plugins/<name>`.
 * The wrapper roots this emitter produces are returned so the caller can fold
 * them into the drift-check product roots (`emit/compare.ts` owns the base set).
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MarketplaceService } from "../lib/marketplace-utils.ts";
import { generatedBanner } from "./manifests.ts";
import { type EmitOrchestrator, emitOrchestrator } from "./orchestrate.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export class MarketplaceDocsEmitter {
  /** injected marketplace domain service (lib) — manifest derivation + path assertions. */
  readonly marketplace: MarketplaceService;
  /** injected emit writer service — product writes + generatedPaths tracking. */
  readonly writer: EmitOrchestrator;

  constructor(marketplace: MarketplaceService, writer: EmitOrchestrator) {
    this.marketplace = marketplace;
    this.writer = writer;
  }

  /**
   * Write the repo-root marketplace docs + cursor-wrapper manifests.
   * @returns {string[]} `cursor-plugins/<name>` roots emitted for non-plugin-root
   *   plugins (folded into the drift-check product roots by the caller)
   */
  emit(outRoot, source, generatedPaths): string[] {
    const claudePlugins = [];
    const cursorMarketplacePlugins = [];
    const wrapperRoots = [];

    for (const plugin of source.plugins) {
      const resolved = this.marketplace.resolveVersion(plugin);
      this.marketplace.assertCursorPathsExist(plugin);

      claudePlugins.push(this.marketplace.claudeMarketplaceEntry(plugin, resolved));
      cursorMarketplacePlugins.push({
        _generated: generatedBanner,
        name: plugin.name,
        source: this.marketplace.isPluginRoot(plugin)
          ? `./${plugin.contentRoot}`
          : `cursor-plugins/${plugin.name}`,
        description: plugin.description,
      });

      if (!this.marketplace.isPluginRoot(plugin)) {
        wrapperRoots.push(`cursor-plugins/${plugin.name}`);
        this.writer.writeJsonDoc(
          outRoot,
          `cursor-plugins/${plugin.name}/.cursor-plugin/plugin.json`,
          this.marketplace.cursorWrapperManifest(plugin, resolved),
          generatedPaths,
        );
      }
    }

    this.writer.writeJsonDoc(
      outRoot,
      ".claude-plugin/marketplace.json",
      this.marketplace.claudeMarketplaceDocument(source, claudePlugins),
      generatedPaths,
    );
    this.writer.writeJsonDoc(
      outRoot,
      ".cursor-plugin/marketplace.json",
      this.marketplace.cursorMarketplaceDocument(source, cursorMarketplacePlugins),
      generatedPaths,
    );

    return wrapperRoots;
  }
}

export const marketplaceDocsEmitter = new MarketplaceDocsEmitter(
  new MarketplaceService(root),
  emitOrchestrator,
);
