// packages/cdd-engine/src-next/infra/resource.ts
// T12 — the logical-name path locator (the RESOURCE_SPECS-style single path truth).
// Every steady-data read of the new tree (engine-config / harness-contract /
// template-contract — the external contract JSONs the plan reads as steady data)
// resolves through this table, never a bare path literal at a consumption site.
// import.meta.url lands at a different depth depending on the file state (dev runs
// the source directly under Node >=22.18; the published package runs the emitted
// JS under dist/), so the package root is resolved by the nearest-ancestor
// package.json walk and a resource is addressed BY LOGICAL NAME.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** One resource's package-root-relative segment list. The new tree's dev face runs
 *  the source tree directly — the source home is the only home (no dist mirror). */
export interface ResourceSpec {
  source: readonly string[];
}

/** The logical-name path table — the single path truth. */
export const RESOURCE_SPECS = {
  "engine-config": { source: ["config", "engine-config.json"] },
  "harness-contract": { source: ["config", "harness-contract.json"] },
  "template-contract": { source: ["config", "template-contract.json"] },
} as const;

/** The logical resource names the new tree reads. */
export type ResourceName = keyof typeof RESOURCE_SPECS;

/**
 * The resource locator — resolves the package root and the logical resource paths.
 * Construction is cheap; a fromDir override lets tests exercise the walk against
 * fabricated install layouts.
 */
export class ResourceResolver {
  readonly #fromDir: string;

  constructor(fromDir = path.dirname(fileURLToPath(import.meta.url))) {
    this.#fromDir = fromDir;
  }

  /** The nearest ancestor of the construction dir that carries package.json. */
  packageRoot(maxDepth = 16): string {
    let dir = this.#fromDir;
    for (let i = 0; i < maxDepth; i++) {
      if (existsSync(path.join(dir, "package.json"))) return dir;
      const next = path.dirname(dir);
      if (next === dir) break;
      dir = next;
    }
    throw new Error(`cdd-engine package root not found while walking up from ${this.#fromDir}`);
  }

  /** The absolute path of a logical resource (the source home joined to the root). */
  resolve(name: ResourceName): string {
    return path.join(this.packageRoot(), ...RESOURCE_SPECS[name].source);
  }

  /** Whether the resolved resource exists on disk. */
  has(name: ResourceName): boolean {
    return existsSync(this.resolve(name));
  }
}
