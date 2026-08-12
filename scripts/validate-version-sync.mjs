import { readFileSync, existsSync } from "node:fs";
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
const THREE_SEG = /^\d+\.\d+\.\d+-overrides\.\d+\.\d+\.\d+$/;
if (!THREE_SEG.test(p.version)) {
  throw new Error(`Invalid overrides version format: ${p.version}`);
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

// os-engineering — independent semver. package.json is the SOT; the
// per-harness manifests are emit products (gitignored, materialized by
// `pnpm run emit` — run before this check).
const oePkg = readJson("plugins/os-engineering/package.json");
const oeSrc = s.plugins.find((x) => x.name === "os-engineering");
const oeEntry = m.plugins.find((x) => x.name === "os-engineering");
const SEMVER = /^\d+\.\d+\.\d+$/;
if (!SEMVER.test(oePkg.version)) {
  throw new Error(`Invalid os-engineering version format: ${oePkg.version}`);
}
const oeVersions = [oePkg.version, oeSrc.version, oeEntry.version];
if (new Set(oeVersions).size !== 1) {
  throw new Error(`os-engineering version mismatch: ${oeVersions.join(" ")}`);
}
for (const rel of [
  ".claude-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  ".kimi-plugin/plugin.json",
  "gemini-extension.json",
]) {
  const abs = join(root, "plugins/os-engineering", rel);
  if (!existsSync(abs)) {
    throw new Error(
      `missing generated manifest plugins/os-engineering/${rel} — run pnpm run emit`,
    );
  }
  const doc = JSON.parse(readFileSync(abs, "utf8"));
  if (doc.version !== oePkg.version) {
    throw new Error(
      `os-engineering ${rel} version ${doc.version} != ${oePkg.version} — run pnpm run emit`,
    );
  }
}
console.log("OK —", oePkg.version);

const oeInit = readFileSync(
  join(root, "plugins/os-engineering/skills/os-init/SKILL.md"),
  "utf8",
);
const stamp = oeInit.match(/<!-- os-engineering-version: ([^ ]+) -->/);
if (!stamp || stamp[1] !== oePkg.version) {
  throw new Error(
    `os-init SKILL.md version stamp mismatch: ${stamp?.[1]} vs ${oePkg.version}`,
  );
}
console.log("OK — os-init SKILL.md stamp", oePkg.version);
