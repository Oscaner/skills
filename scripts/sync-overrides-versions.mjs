#!/usr/bin/env node
/**
 * Sync the superpowers-overrides version into the two hand-edited version SOTs
 * (the overrides `.claude-plugin/plugin.json` and `marketplace/source.json`),
 * then regenerate every committed emit product via `pnpm run emit`.
 *
 * Deliberately does NOT rewrite repo dogfood (CLAUDE.md / `.cursor/rules/*`).
 * os-init owns the dogfood now and stamps it with the engineering version;
 * a script that stamped it with the overrides version would fight os-init.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const pkg = JSON.parse(
  readFileSync(join(root, "plugins/superpowers-overrides/package.json"), "utf8"),
);
const version = pkg.version;

const pluginPath = join(
  root,
  "plugins/superpowers-overrides/.claude-plugin/plugin.json",
);
const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
plugin.version = version;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");

const sourcePath = join(root, "marketplace/source.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const entry = source.plugins.find((p) => p.name === "superpowers-overrides");
if (!entry) {
  throw new Error("superpowers-overrides not in marketplace/source.json");
}
entry.version = version;
writeFileSync(sourcePath, JSON.stringify(source, null, 2) + "\n");

execSync("pnpm run emit", { stdio: "inherit", cwd: root });

console.log(`OK — synced ${version}`);
