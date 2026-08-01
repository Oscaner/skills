import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

const s = readJson("marketplace/source.json");
const m = readJson(".claude-plugin/marketplace.json");
const p = readJson("plugins/superpowers-overrides/package.json");
const j = readJson("plugins/superpowers-overrides/.claude-plugin/plugin.json");
const src = s.plugins.find((x) => x.name === "superpowers-overrides");
const entry = m.plugins.find((x) => x.name === "superpowers-overrides");
const v = [p.version, src.version, j.version, entry.version];
if (new Set(v).size !== 1) {
  throw new Error(`version mismatch: ${v.join(" ")}`);
}
console.log("OK —", p.version);

const sp = s.plugins.find((x) => x.name === "superpowers").version;
if (!p.version.startsWith(`${sp}-overrides.`)) {
  throw new Error(`${p.version} not aligned to superpowers ${sp}`);
}
console.log("OK");

const sj = readJson("plugins/superpowers/.claude-plugin/plugin.json");
const srcSp = s.plugins.find((x) => x.name === "superpowers").version;
const entrySp = m.plugins.find((x) => x.name === "superpowers").version;
if (sj.version !== srcSp || srcSp !== entrySp) {
  throw new Error(
    `superpowers mismatch: submodule=${sj.version} source=${srcSp} emitted=${entrySp}`,
  );
}
console.log("OK — superpowers", srcSp);
