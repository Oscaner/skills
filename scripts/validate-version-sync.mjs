import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

const s = readJson("marketplace/source.json");
const m = readJson(".claude-plugin/marketplace.json");
const p = readJson("packages/superpowers-overrides/package.json");
const j = readJson("packages/superpowers-overrides/.claude-plugin/plugin.json");
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

const sj = readJson("vendors/superpowers/.claude-plugin/plugin.json");
const srcSp = s.plugins.find((x) => x.name === "superpowers").version;
const entrySp = m.plugins.find((x) => x.name === "superpowers").version;
if (sj.version !== srcSp || srcSp !== entrySp) {
  throw new Error(
    `superpowers mismatch: submodule=${sj.version} source=${srcSp} emitted=${entrySp}`,
  );
}
console.log("OK — superpowers", srcSp);

// engineering — independent semver. package.json is the SOT; the
// per-harness manifests are committed emit products, re-stamped by `pnpm run
// emit` (run before this check). The manifest set is taken from
// .version-bump.json#files so a newly-added harness manifest can't slip past
// the equality check.
const oePkg = readJson("packages/engineering/package.json");
const oeSrc = s.plugins.find((x) => x.name === "engineering");
const oeEntry = m.plugins.find((x) => x.name === "engineering");
const SEMVER = /^\d+\.\d+\.\d+$/;
if (!SEMVER.test(oePkg.version)) {
  throw new Error(`Invalid engineering version format: ${oePkg.version}`);
}
const oeVersions = [oePkg.version, oeSrc.version, oeEntry.version];
if (new Set(oeVersions).size !== 1) {
  throw new Error(`engineering version mismatch: ${oeVersions.join(" ")}`);
}
const oeBump = readJson("packages/engineering/.version-bump.json");
for (const f of oeBump.files) {
  const abs = join(root, "packages/engineering", f.path);
  if (!existsSync(abs)) {
    throw new Error(
      `missing generated manifest packages/engineering/${f.path} — run pnpm run emit`,
    );
  }
  const doc = JSON.parse(readFileSync(abs, "utf8"));
  const val = f.field.split(".").reduce((o, k) => o?.[k], doc);
  if (val !== oePkg.version) {
    throw new Error(
      `engineering ${f.path} ${val} != ${oePkg.version} — run pnpm run emit`,
    );
  }
}
console.log("OK —", oePkg.version);

// os-init stamps: SKILL.md (version marker) + spor.md (written-table template).
// Both carry the engineering version and both are synced by version-packages.mjs.
for (const rel of [
  "packages/engineering/skills/os-init/SKILL.md",
  "packages/engineering/skills/os-init/spor.md",
]) {
  const oeInit = readFileSync(join(root, rel), "utf8");
  const stamp = oeInit.match(/<!-- engineering-version: ([^ ]+) -->/);
  if (!stamp || stamp[1] !== oePkg.version) {
    throw new Error(
      `${rel} version stamp mismatch: ${stamp?.[1]} vs ${oePkg.version}`,
    );
  }
}
console.log("OK — os-init SKILL.md/spor.md stamp", oePkg.version);
