/**
 * Emit orchestration helpers extracted from `scripts/emit.mjs` so they can be
 * unit-tested in isolation. All take their inputs as parameters — no module
 * state, no repo-root closure.
 */

import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Recursively collect repo-relative file paths under a directory root. */
export function collectFilesUnder(relRoot, root) {
  const abs = join(root, relRoot);
  const files = [];
  if (!existsSync(abs)) return files;
  const walk = (rel, absDir) => {
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(childRel, join(absDir, entry.name));
      } else {
        files.push(childRel);
      }
    }
  };
  walk(relRoot, abs);
  return files;
}

/**
 * Detect committed product files the generator no longer produces (stale).
 * `productRoots` are repo-relative directories fully owned by emit (every file
 * inside is generator output); `productFiles` are standalone repo-relative
 * files. `extraStale` holds whole-directory staleness markers — a repo-relative
 * dir that must be gone entirely (e.g. the retired cursor wrapper) — pushed
 * with a trailing slash when present.
 */
export function findStaleCommittedFiles({
  generatedSet,
  productRoots,
  productFiles,
  extraStale = [],
  root,
}) {
  const stale = [];
  for (const relRoot of productRoots) {
    for (const rel of collectFilesUnder(relRoot, root)) {
      if (!generatedSet.has(rel)) stale.push(rel);
    }
  }
  for (const rel of productFiles) {
    if (existsSync(join(root, rel)) && !generatedSet.has(rel)) stale.push(rel);
  }
  for (const rel of extraStale) {
    if (existsSync(join(root, rel))) stale.push(rel);
  }
  return stale;
}

/**
 * Prune stale namespace dirs from the shared `.agents/skills/` tree. A
 * namespace is stale when it no longer maps to an existing source dir (source
 * deleted, or a namespace no longer emitted). Returns the removed names.
 */
export function pruneStaleAgentsNamespaces(outAgents, namespaces) {
  const removed = [];
  if (!existsSync(outAgents)) return removed;
  for (const entry of readdirSync(outAgents, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const src = namespaces.find(([ns]) => ns === entry.name)?.[1];
    if (!src || !existsSync(src)) {
      rmSync(join(outAgents, entry.name), { recursive: true, force: true });
      removed.push(entry.name);
    }
  }
  return removed;
}
