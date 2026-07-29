import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pkg = JSON.parse(
  readFileSync(join(root, "superpowers-overrides/package.json"), "utf8"),
);
const version = pkg.version;

const pluginPath = join(
  root,
  "superpowers-overrides/.claude-plugin/plugin.json",
);
const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
plugin.version = version;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");

const marketplacePath = join(root, ".claude-plugin/marketplace.json");
const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
const entry = marketplace.plugins.find((p) => p.name === "superpowers-overrides");
if (!entry) {
  throw new Error("superpowers-overrides not in marketplace.json");
}
entry.version = version;
writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");

console.log(`OK — synced ${version}`);
