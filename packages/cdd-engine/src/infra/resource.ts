// packages/cdd-engine/src/infra/resource.ts — package-resource path resolution (P2 T1 ④).
// The engine ships non-code resources (templates/, dist/documents/schema/) that loaders resolve
// against the package root. import.meta.url lands at different depths depending on the file state:
//   dev:stub / vitest — modules load from src/** (jiti), import.meta.url = <pkg>/src/...
//   real build / consumer install — everything bundles into dist/cli.mjs, import.meta.url = <pkg>/dist/cli.mjs
// The nearest-ancestor package.json marker walk makes the resolution state-independent — the single
// point resource loaders resolve through (infra/config.ts now, documents/schema.ts for the
// canonical doc-structure schemas). Optional fromDir = path.dirname(fileURLToPath(import.meta.url))
// default; tests exercise the resolver against fabricated install layouts by passing the dir.
import { existsSync } from "node:fs";
import path from "node:path";
import { invariant } from "./exit.ts";

/** Nearest ancestor of fromDir that carries package.json — the cdd-engine package root in every
 * file state (src tree, stub symlinks, bundle, consumer install). */
export function resolvePackageRoot(fromDir: string, maxDepth = 16): string {
  let dir = fromDir;
  for (let i = 0; i < maxDepth; i++) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    const next = path.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  invariant(false, `cdd-engine package root not found while walking up from ${fromDir}`);
  return ""; // unreachable — invariant throws
}
