import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

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
