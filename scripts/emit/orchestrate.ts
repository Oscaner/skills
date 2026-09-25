/**
 * Emit orchestration helpers — the EmitOrchestrator domain service (Task 9, 判定标准②: stateless
 * service class, zero bare-function module). Methods take their inputs as parameters — no module
 * state, no repo-root closure. Unit-tested in isolation.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { globSync } from "tinyglobby";

export class EmitOrchestrator {
  /**
   * Write a text product into `outRoot` (mkdir -p the parent) and record the
   * repo-relative path in `generatedPaths` so the --check diff sees it.
   */
  writeText(outRoot, rel, content, generatedPaths): void {
    const p = join(outRoot, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
    generatedPaths.push(rel);
  }

  /** `writeText` for JSON documents (pretty-printed + trailing newline). */
  writeJsonDoc(outRoot, rel, data, generatedPaths): void {
    this.writeText(outRoot, rel, `${JSON.stringify(data, null, 2)}\n`, generatedPaths);
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
  findStaleCommittedFiles({
    generatedSet,
    productRoots,
    productFiles,
    extraStale = [],
    root,
  }): string[] {
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
}

export const emitOrchestrator = new EmitOrchestrator();
