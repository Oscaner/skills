#!/usr/bin/env node
/**
 * Align the osuperpowers-router version to the vendored superpowers base and
 * regenerate every committed emit product.
 *
 * `packages/osuperpowers-router/package.json` is the single version SOT (the
 * scheme is `{superpowers}-router.{major}.{minor}.{patch}`). The script
 * reads that SOT, and when its superpowers base no longer matches the vendored
 * superpowers `.claude-plugin/plugin.json` version, resets the router
 * suffix to `.0.0.0` per the documented bump contract. Then `pnpm run emit`
 * re-derives every downstream product (`.claude-plugin/plugin.json`,
 * `marketplace/source.json`, hooks, self-check tables) from the SOT — no other
 * file is written here.
 *
 * Callers that already computed and wrote the next version into package.json
 * (bump-submodule.mjs, version-packages.mjs) are unaffected: when the base
 * matches, the version is left untouched and the script only re-emits.
 *
 * Deliberately does NOT rewrite repo dogfood (CLAUDE.md / `.cursor/rules/*`).
 * init owns the dogfood now and stamps it with the osuperpowers version;
 * a script that stamped it with the overrides version would fight init.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { parseRouterVersion } from "./lib/version-utils.mjs";
import { resolveVendorVersion } from "./lib/publish-vendor.mjs";

const root = process.cwd();
const pkgPath = join(root, "packages/osuperpowers-router/package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

// The superpowers base is the vendored plugin.json version — resolveVendorVersion
// (shared with the marketplace emit chain) prefers plugin.json over the release
// tag, so the alignment target is the same source the marketplace resolves against.
const base = resolveVendorVersion("superpowers", root);

const parsed = parseRouterVersion(pkg.version);
const next =
  parsed && parsed.base === base ? pkg.version : `${base}-router.0.0.0`;

if (pkg.version !== next) {
  pkg.version = next;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

execSync("pnpm run emit", { stdio: "inherit", cwd: root });

console.log(`OK — synced ${next}`);
