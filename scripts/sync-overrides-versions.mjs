#!/usr/bin/env node
/**
 * Align the superpowers-overrides version to the vendored superpowers base and
 * regenerate every committed emit product.
 *
 * `packages/superpowers-overrides/package.json` is the single version SOT (the
 * scheme is `{superpowers}-overrides.{major}.{minor}.{patch}`). The script
 * reads that SOT, and when its superpowers base no longer matches the vendored
 * superpowers `.claude-plugin/plugin.json` version, resets the overrides
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
 * os-init owns the dogfood now and stamps it with the engineering version;
 * a script that stamped it with the overrides version would fight os-init.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { parseOverridesVersion } from "./lib/version-utils.mjs";

const root = process.cwd();
const pkgPath = join(root, "packages/superpowers-overrides/package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

// The superpowers base is the vendored plugin.json version — deriveVendor and
// resolveVersion both prefer it over the release tag, so the alignment target
// is the same source the marketplace emit resolves against.
const superpowersPath = join(
  root,
  "vendors/superpowers/.claude-plugin/plugin.json",
);
const superpowers = JSON.parse(readFileSync(superpowersPath, "utf8"));
const base = superpowers.version;
if (!base) {
  throw new Error(`no version in ${superpowersPath}`);
}

const parsed = parseOverridesVersion(pkg.version);
const next =
  parsed && parsed.base === base ? pkg.version : `${base}-overrides.0.0.0`;

if (pkg.version !== next) {
  pkg.version = next;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

execSync("pnpm run emit", { stdio: "inherit", cwd: root });

console.log(`OK — synced ${next}`);
