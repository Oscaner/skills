#!/usr/bin/env node
/**
 * publish-vendor — assemble the vendored submodule plugins as scoped npm
 * packages (`@oscaner-skills/<name>`) and run `npm publish`.
 *
 * Usage:
 *   node scripts/publish-vendor.mjs          # real publish (needs npm auth)
 *   node scripts/publish-vendor.mjs --dry-run # stage + npm publish --dry-run
 *
 * Each vendor is staged under `tmp/publish-vendor/<name>` (gitignored): a copy
 * of the submodule content with a scoped package.json (name/version/contentRoot
 * + pi key) and the upstream LICENSE preserved. Submodule not checked out or a
 * missing LICENSE aborts the run before any publish.
 */

import { publishAll } from "./lib/publish-vendor.mjs";
import { repoRootFromImportMeta } from "./lib/marketplace-utils.mjs";

const root = repoRootFromImportMeta(import.meta.url);
const dryRun = process.argv.includes("--dry-run");

try {
  const stageRoot = publishAll(root, { dryRun });
  console.log(`OK — ${dryRun ? "dry-run" : "publish"} complete for @oscaner-skills/*`);
  console.log(`staged at ${stageRoot}`);
} catch (err) {
  console.error(`publish-vendor failed: ${err.message}`);
  process.exit(1);
}
