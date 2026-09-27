/**
 * osuperpowers emit — per-harness thin manifests (.claude-plugin / .cursor-plugin).
 * The OsuperpowersEmitter domain service (Task 9, Criterion ②: stateless, constructor injection — composes
 * MarketplaceService + ManifestService + EmitOrchestrator). `generatedPaths` records every
 * repo-relative path produced (the emit-check drift diff input); no module-level state.
 *
 * The canonical skills list is directory-discovered by the VALIDATE side
 * (scripts/validate/osuperpowers.ts EXPECTED/EMITTERS_LABEL — the count truth); this emitter
 * deliberately keeps no count and no skill-name inventory here.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MarketplaceService } from "../lib/marketplace-utils.ts";
import { type ManifestService, manifestService } from "./manifests.ts";
import { type EmitOrchestrator, emitOrchestrator } from "./orchestrate.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export class OsuperpowersEmitter {
  /** injected marketplace domain service (lib) — version resolution. */
  readonly marketplace: MarketplaceService;
  /** injected manifest service — per-harness manifest builders. */
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

    this.writer.writeJsonDoc(
      outRoot,
      `${contentRoot}/.claude-plugin/plugin.json`,
      this.manifests.claudePluginManifest(plugin, version),
      generatedPaths,
    );
    this.writer.writeJsonDoc(
      outRoot,
      `${contentRoot}/.cursor-plugin/plugin.json`,
      this.manifests.cursorPluginManifest(plugin, version),
      generatedPaths,
    );
  }
}

export const osuperpowersEmitter = new OsuperpowersEmitter(
  new MarketplaceService(root),
  manifestService,
  emitOrchestrator,
);
