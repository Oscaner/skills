#!/usr/bin/env node

/**
 * Unified emit — write mode (`scripts/run.ts emit`).
 *
 * The EmitService domain service (Task 9, Criterion ②: stateless service class) — the emit
 * composition root that derives `marketplace/source.json` (package-as-source) and guides every
 * first-party artifact into the repo root: osuperpowers per-harness manifests, the repo-root
 * marketplace documents, wrappers, and the data-driven `.github/ISSUE_TEMPLATE` forms. It
 * composes the module-level emitter singletons (each emitter is itself a stateless domain
 * service). The `generatedPaths` array records every repo-relative path produced (input for the
 * emit-check drift diff).
 *
 * The downstream emitters each take `(outRoot, ..., generatedPaths)` — no
 * module-level state, so a full tree can be generated into a temp root by
 * `emit/check.ts` without touching the working tree. `emitAll` returns the
 * cursor wrapper roots it emitted so the caller can fold them into the
 * drift-check product-root set (`emit/compare.ts` owns the base set).
 */

import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { issueTemplatesEmitter } from "./issue-templates.ts";
import { marketplaceDocsEmitter } from "./marketplace.ts";
import { emitOrchestrator } from "./orchestrate.ts";
import { osuperpowersEmitter } from "./osuperpowers.ts";
import { sourceService } from "./source.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export class EmitService {
  /**
   * Generate the full emit product set into `outRoot`.
   * @param {string} outRoot absolute output root (repo root in write mode, a temp tree in check mode)
   * @param {{ generatedPaths: string[] }} opts repo-relative paths produced by this run
   * @returns {string[]} `cursor-plugins/<name>` wrapper roots emitted (see
   *   the marketplace docs emitter) — folded into the drift-check product roots by the caller
   */
  emitAll(outRoot, { generatedPaths }): string[] {
    const source = sourceService.derive(root);

    for (const plugin of source.plugins) {
      if (plugin.name === "osuperpowers") {
        osuperpowersEmitter.emit(outRoot, plugin, generatedPaths);
      }
    }

    const wrapperRoots = marketplaceDocsEmitter.emit(outRoot, source, generatedPaths);

    // Repo-root data-driven forms, rendered from the canonical finding-meta.json
    // (single source of truth) via the report-issues renderer.
    issueTemplatesEmitter.emit(outRoot, source, { generatedPaths });

    // source.json is itself a derived emit product (package-as-source).
    emitOrchestrator.writeJsonDoc(outRoot, "marketplace/source.json", source, generatedPaths);

    return wrapperRoots;
  }
}

export const emitService = new EmitService();

export function main() {
  const generatedPaths = [];
  emitService.emitAll(root, { generatedPaths });
  console.log("OK — emitted unified first-party manifests");
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  try {
    main();
  } catch (e) {
    console.error(e?.message ?? String(e));
    process.exit(1);
  }
}
