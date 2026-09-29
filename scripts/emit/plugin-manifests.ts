/**
 * Plugin manifests emit — per-harness thin manifests (.claude-plugin / .cursor-plugin).
 * The PluginManifestEmitter domain service (Criterion ②: stateless, constructor injection —
 * composes MarketplaceService + ManifestService + EmitOrchestrator). `generatedPaths` records
 * every repo-relative path produced (the emit-check drift diff input); no module-level state.
 *
 * The harness declaration set is read directly from each plugin's package.json
 * (`pkg.oscaner.harnesses`), never from the source.json row. Each declared id is
 * resolved in the harness registry; a harness without a product document (pi is
 * an inline distribution) contributes nothing — skipped by the product guard,
 * not by any plugin-name branch. The manifest builders and the count truth stay
 * in their own single sources (the registry / scripts/validate/osuperpowers.ts):
 * this emitter keeps no inventory of either.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harnessRegistry } from "../lib/harness-registry.ts";
import { MarketplaceService } from "../lib/marketplace-utils.ts";
import { type ManifestService, manifestService } from "./manifests.ts";
import { type EmitOrchestrator, emitOrchestrator } from "./orchestrate.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export class PluginManifestEmitter {
  /** injected marketplace domain service (lib) — version resolution. */
  readonly marketplace: MarketplaceService;
  /** injected manifest service — first-party name discovery delegate. */
  readonly manifests: ManifestService;
  /** injected emit writer service — product writes + generatedPaths tracking. */
  readonly writer: EmitOrchestrator;

  constructor(
    marketplace: MarketplaceService,
    manifests: ManifestService,
    writer: EmitOrchestrator,
  ) {
    this.marketplace = marketplace;
    this.manifests = manifests;
    this.writer = writer;
  }

  emit(outRoot, plugin, generatedPaths): void {
    const version = this.marketplace.resolveVersion(plugin).version;
    const contentRoot = plugin.contentRoot;

    // Declaration set straight from the package (C2) — missing declaration means
    // default-absent (D5): a package without `oscaner.harnesses` ships no
    // per-harness manifests, without throwing or falling back.
    const pkg = JSON.parse(readFileSync(join(root, contentRoot, "package.json"), "utf8"));
    for (const id of pkg.oscaner?.harnesses ?? []) {
      const harness = harnessRegistry.resolve(id, plugin.name);
      // A harness without a product (pi — inline distribution) is skipped here;
      // no special-casing by plugin name.
      if (harness.product) {
        this.writer.writeJsonDoc(
          outRoot,
          `${contentRoot}/${harness.product.rel}`,
          harness.manifest(plugin, version),
          generatedPaths,
        );
      }
    }
  }
}

export const pluginManifestEmitter = new PluginManifestEmitter(
  new MarketplaceService(root),
  manifestService,
  emitOrchestrator,
);
