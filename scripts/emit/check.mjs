#!/usr/bin/env node
/**
 * Unified emit — drift check mode (`scripts/run.mjs emit-check`).
 *
 * Regenerates the full product set into a temp tree (no writes to the working
 * tree), diffs every produced path against the committed tree via
 * `compareTrees`, and flags committed product files the generator no longer
 * produces. Emit products are committed, so a fresh clone has them for the
 * comparison — any drift/omission throws and the process exits 1.
 */

import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emitAll } from "./all.mjs";
import { compareTrees } from "./compare.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function main() {
  const generatedPaths = [];
  const tempRoot = mkdtempSync(join(tmpdir(), "oscaner-emit-"));
  try {
    const wrapperRoots = emitAll(tempRoot, { generatedPaths });
    compareTrees(root, tempRoot, { generatedPaths, wrapperRoots });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
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