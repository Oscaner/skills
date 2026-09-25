/**
 * Emit orchestration helpers extracted from the pre-P2 emit orchestrator so
 * they can be unit-tested in isolation. All take their inputs as parameters —
 * no module state, no repo-root closure.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { globSync } from "tinyglobby";

/**
 * Write a text product into `outRoot` (mkdir -p the parent) and record the
 * repo-relative path in `generatedPaths` so the --check diff sees it.
 */
export function writeText(outRoot, rel, content, generatedPaths) {
  const p = join(outRoot, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  generatedPaths.push(rel);
}

/** `writeText` for JSON documents (pretty-printed + trailing newline). */
export function writeJsonDoc(outRoot, rel, data, generatedPaths) {
  writeText(outRoot, rel, `${JSON.stringify(data, null, 2)}\n`, generatedPaths);
}

/**
 * Detect committed product files the generator no longer produces (stale).
 * `productRoots` are repo-relative directories fully owned by emit (every file
 * inside is generator output); `productFiles` are standalone repo-relative
 * files. `extraStale` holds whole-directory staleness markers — a repo-relative
 * dir that must be gone entirely (e.g. the retired cursor wrapper) — pushed
 * with a trailing slash when present.
 *
 * A single tinyglobby scan across `root` replaces the hand-written per-root
 * recursive walk; `dot: true` is mandatory because product roots like
 * `.claude-plugin/` and `.cursor-plugin/` are hidden directories.
 */
export function findStaleCommittedFiles({
  generatedSet,
  productRoots,
  productFiles,
  extraStale = [],
  root,
}) {
  const stale = [];
  for (const abs of globSync("**/*", { cwd: root, absolute: true, dot: true })) {
    const rel = relative(root, abs);
    if (!productRoots.some((r) => rel.startsWith(`${r}/`))) continue;
    if (!generatedSet.has(rel)) stale.push(rel);
  }
  for (const rel of productFiles) {
    if (existsSync(join(root, rel)) && !generatedSet.has(rel)) stale.push(rel);
  }
  for (const rel of extraStale) {
    if (existsSync(join(root, rel))) stale.push(rel);
  }
  return stale;
}
