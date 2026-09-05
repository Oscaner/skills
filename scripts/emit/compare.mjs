/**
 * Emit drift check — compares a freshly generated tree against the committed
 * tree (`scripts/run.mjs emit-check`). Owns the emit product-root/file
 * constants and the osuperpowers `.version-bump.json` consistency guard.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execaSync } from "execa";
import { findStaleCommittedFiles } from "./orchestrate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Base repo-relative directories fully owned by the emit tool — every file
 * inside is generator output. The check walks these to flag stale committed
 * product files the generator no longer produces (compareTrees alone iterates
 * only generated paths, so a vanished product would silently linger on disk).
 * Wrapper roots (`cursor-plugins/<name>`) for non-plugin-root plugins are
 * computed per emit run by `emitMarketplaceDocs`; `compareTrees` folds them
 * into this base set via its `wrapperRoots` option. Never mutated.
 */
export const BASE_PRODUCT_ROOTS = [
  ".claude-plugin",
  ".cursor-plugin",
  "packages/osuperpowers/.claude-plugin",
  "packages/osuperpowers/.cursor-plugin",
  "packages/osuperpowers/.codex-plugin",
  "packages/osuperpowers/.kimi-plugin",
  "packages/osuperpowers/.qoder-plugin",
  "packages/osuperpowers/hooks",
  "packages/osuperpowers/.agents",
];

/** Standalone repo-relative product files (not inside a product root). */
export const productFiles = [
  "marketplace/source.json",
  "packages/osuperpowers/gemini-extension.json",
  "packages/osuperpowers/GEMINI.md",
];

function readJson(committedRoot, rel) {
  return JSON.parse(readFileSync(join(committedRoot, rel), "utf8"));
}

// ---------------------------------------------------------------------------
// Version consistency (mimic superpowers .version-bump.json)
// ---------------------------------------------------------------------------

export function assertVersionBump(committedRoot) {
  const plugin = "packages/osuperpowers";
  const bumpPath = join(committedRoot, plugin, ".version-bump.json");
  if (!existsSync(bumpPath)) return;
  const bump = JSON.parse(readFileSync(bumpPath, "utf8"));
  const pkgVersion = readJson(committedRoot, "packages/osuperpowers/package.json").version;
  for (const f of bump.files) {
    const abs = join(committedRoot, plugin, f.path);
    if (!existsSync(abs)) continue; // not materialized on disk — checked via --check diff
    const doc = JSON.parse(readFileSync(abs, "utf8"));
    const val = f.field.split(".").reduce((o, k) => o?.[k], doc);
    if (val !== pkgVersion) {
      throw new Error(
        `version drift: ${plugin}/${f.path} ${val} != ${pkgVersion} (run pnpm run emit)`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Drift comparison
// ---------------------------------------------------------------------------

/**
 * Diff every `generatedPaths` entry between the committed tree and a freshly
 * generated tree, then flag committed product files the generator no longer
 * produces. Failure → throws (the CLI wrapper exits 1).
 * @param {string} committedRoot repo root whose committed products are authoritative
 * @param {string} generatedRoot temp root holding the freshly generated tree
 * @param {{ generatedPaths: string[], wrapperRoots?: string[] }} opts
 *   repo-relative paths produced by the last emitAll, plus the cursor wrapper
 *   roots it emitted (folded into the base `BASE_PRODUCT_ROOTS` set)
 */
export function compareTrees(committedRoot, generatedRoot, { generatedPaths, wrapperRoots = [] }) {
  const generatedSet = new Set(generatedPaths);
  const productRoots = [...BASE_PRODUCT_ROOTS, ...wrapperRoots];
  for (const rel of generatedPaths) {
    const committed = join(committedRoot, rel);
    const generated = join(generatedRoot, rel);
    if (!existsSync(committed)) {
      throw new Error(`MISSING committed file: ${rel} — run pnpm run emit`);
    }
    if (!existsSync(generated)) {
      throw new Error(`MISSING generated file: ${rel}`);
    }
    try {
      execaSync("diff", ["-u", committed, generated], {
        stdio: "pipe",
        cwd: committedRoot,
      });
    } catch (e) {
      throw new Error(`DRIFT: ${rel}\n${e.stdout?.toString() ?? ""}`);
    }
  }
  const stale = findStaleCommittedFiles({
    generatedSet,
    productRoots,
    productFiles,
    extraStale: [],
    root: committedRoot,
  });
  if (stale.length > 0) {
    throw new Error(
      "STALE committed product file(s) — generator no longer produces them (delete):\n" +
        `  ${stale.join("\n  ")}`,
    );
  }
  assertVersionBump(committedRoot);
  console.log("OK — emit fresh");
}
