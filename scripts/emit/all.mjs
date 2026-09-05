#!/usr/bin/env node
/**
 * Unified emit — write mode (`scripts/run.mjs emit`).
 *
 * Derives `marketplace/source.json` (package-as-source) and generates every
 * first-party artifact into the repo root: osuperpowers per-harness manifests,
 * hooks, shared `.agents/skills/` copy, plus the repo-root marketplace
 * documents and vendored cursor wrappers. The `generatedPaths` array records
 * every repo-relative path produced (input for the emit-check drift diff).
 *
 * The downstream emitters each take `(outRoot, ..., generatedPaths)` — no
 * module-level state, so a full tree can be generated into a temp root by
 * `emit/check.mjs` without touching the working tree.
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import { assertPrereleasePrefix } from "../lib/marketplace-utils.mjs";
import { deriveSource } from "./source.mjs";
import { writeJsonDoc } from "./orchestrate.mjs";
import { emitOsuperpowers } from "./osuperpowers.mjs";
import { emitMarketplaceDocs } from "./marketplace.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Generate the full emit product set into `outRoot`.
 * @param {string} outRoot absolute output root (repo root in write mode, a temp tree in check mode)
 * @param {{ generatedPaths: string[] }} opts repo-relative paths produced by this run
 */
export function emitAll(outRoot, { generatedPaths }) {
  const source = deriveSource(root);
  assertPrereleasePrefix(root, source);

  for (const plugin of source.plugins) {
    if (plugin.name === "osuperpowers") {
      emitOsuperpowers(outRoot, plugin, generatedPaths);
    }
  }

  emitMarketplaceDocs(outRoot, source, generatedPaths);

  // source.json is itself a derived emit product (package-as-source).
  writeJsonDoc(outRoot, "marketplace/source.json", source, generatedPaths);
}

export function main() {
  const generatedPaths = [];
  emitAll(root, { generatedPaths });
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