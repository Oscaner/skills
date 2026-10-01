// packages/cdd-engine/src/infra/resource.ts — package-resource path resolution (P2 T1 ④; the
// logical-name single-path truth, P4 C7). The engine ships read-only static data in two homes:
//   config/  — read-as-data (engine-config / harness-contract / contract-lexicon /
//              template-contract + config/schema/), mirrored to dist/config by the build so the
//              consumer install resolves the published face first;
//   templates/ — render/copy content seeds only (report/issue-body.json), shipped as-is.
// import.meta.url lands at different depths depending on the file state (dev:stub / vitest load
// from src/** via jiti; the real build bundles into dist/cli.mjs), so every loader resolves the
// package root via the nearest-ancestor package.json marker walk and the resource BY LOGICAL NAME
// through resolveResource — the single locator table (dev tree + dist pack tree isomorphic, no
// scattered path.join(resolvePackageRoot(...), "...") literals) — published (dist) first, source
// as the dev fallback. Six engine consumption points (infra/config.ts · infra/registry.ts ·
// render/templates.ts · documents/schema.ts · rules/schema.ts · domain/issue-renderer.ts) plus
// infra/runtime.ts resolve here.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

/** One entry of the locator table: package-root-relative segment lists. `published` is the dist
 *  mirror (the consumer-install face, checked first); `source` is the dev tree home. A resource
 *  without `published` ships as-is from `source` (the content seeds under templates/). */
interface ResourceSpec {
  published?: readonly string[];
  source: readonly string[];
}

/** The logical-name path table — the single path truth (C7). A resource is addressed by name,
 *  never by a bare path.join(resolvePackageRoot(...), "...") literal at a consumption site. The
 *  table is exported so the scripts-side validation pins (smoke-cdd tarball members / residue
 *  paths / the contract-lexicon data source) derive from the same locator — a resource move
 *  (like the C7 config/ re-home) propagates to every pin, zero second literal path list. */
export const RESOURCE_SPECS = {
  "engine-config": {
    published: ["dist", "config", "engine-config.json"],
    source: ["config", "engine-config.json"],
  },
  "harness-contract": {
    published: ["dist", "config", "harness-contract.json"],
    source: ["config", "harness-contract.json"],
  },
  "contract-lexicon": {
    published: ["dist", "config", "contract-lexicon.json"],
    source: ["config", "contract-lexicon.json"],
  },
  "template-contract": {
    published: ["dist", "config", "template-contract.json"],
    source: ["config", "template-contract.json"],
  },
  /** Generic schema namespace — every JSON Schema (doc-structure + handoff + cache-profile) lives
   *  under config/schema/; consumers join the file name. */
  schema: {
    published: ["dist", "config", "schema"],
    source: ["config", "schema"],
  },
  "issue-body": {
    source: ["templates", "report", "issue-body.json"],
  },
} as const;

export type ResourceName = keyof typeof RESOURCE_SPECS;

/** Logical-name → path resolution (the single path truth): published copy (dist mirror, the
 *  consumer face) first when it exists, the source tree as the dev fallback. fromDir defaults to
 *  path.dirname(fileURLToPath(import.meta.url)) — tests exercise the resolver against fabricated
 *  install layouts by passing the dir. */
export function resolveResource(
  name: ResourceName,
  fromDir = path.dirname(fileURLToPath(import.meta.url)),
): string {
  const root = resolvePackageRoot(fromDir);
  const spec: ResourceSpec = RESOURCE_SPECS[name];
  if (spec.published !== undefined) {
    const published = path.join(root, ...spec.published);
    if (existsSync(published)) return published;
  }
  return path.join(root, ...spec.source);
}

/** Source-home resolution (the pinned validate face — the scripts guards always read the repo
 *  tree's canonical config/, never a stale dist mirror): the `source` segments joined to the
 *  package root. */
export function resolveResourceSrc(
  name: ResourceName,
  fromDir = path.dirname(fileURLToPath(import.meta.url)),
): string {
  return path.join(resolvePackageRoot(fromDir), ...RESOURCE_SPECS[name].source);
}

/** Published-home resolution (the consumer face — used by the build/pack pin assertions): the
 *  `published` segments joined to the package root. */
export function resolveResourcePublished(
  name: ResourceName,
  fromDir = path.dirname(fileURLToPath(import.meta.url)),
): string {
  return path.join(resolvePackageRoot(fromDir), ...RESOURCE_SPECS[name].published!);
}
