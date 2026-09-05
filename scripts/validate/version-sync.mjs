#!/usr/bin/env node
// scripts/validate/version-sync.mjs — blocks 8-10: version sync (moved up from the
// scripts/ root). Verifies superpowers submodule ↔ marketplace versions agree and every
// osuperpowers emit product carries the package.json version (run after `pnpm run emit`).
// Single step descriptor; standalone (`node scripts/validate/version-sync.mjs`) runs the
// same checks.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runIfMain } from "./runner.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

function checkVersionSync() {
  const s = readJson("marketplace/source.json");
  const m = readJson(".claude-plugin/marketplace.json");

  // router deleted — router version sync section removed (#209)

  const sj = readJson("vendors/superpowers/.claude-plugin/plugin.json");
  const srcSp = s.plugins.find((x) => x.name === "superpowers").version;
  const entrySp = m.plugins.find((x) => x.name === "superpowers").version;
  if (sj.version !== srcSp || srcSp !== entrySp) {
    throw new Error(
      `superpowers mismatch: submodule=${sj.version} source=${srcSp} emitted=${entrySp}`,
    );
  }
  console.log("OK — superpowers", srcSp);

  // osuperpowers — independent semver. package.json is the SOT; the
  // per-harness manifests are committed emit products, re-stamped by `pnpm run
  // emit` (run before this check). The manifest set is taken from
  // .version-bump.json#files so a newly-added harness manifest can't slip past
  // the equality check.
  const osuperpowersPkg = readJson("packages/osuperpowers/package.json");
  const osuperpowersSrc = s.plugins.find((x) => x.name === "osuperpowers");
  const osuperpowersEntry = m.plugins.find((x) => x.name === "osuperpowers");
  const SEMVER = /^\d+\.\d+\.\d+$/;
  if (!SEMVER.test(osuperpowersPkg.version)) {
    throw new Error(`Invalid osuperpowers version format: ${osuperpowersPkg.version}`);
  }
  const osuperpowersVersions = [osuperpowersPkg.version, osuperpowersSrc.version, osuperpowersEntry.version];
  if (new Set(osuperpowersVersions).size !== 1) {
    throw new Error(`osuperpowers version mismatch: ${osuperpowersVersions.join(" ")}`);
  }
  const osuperpowersBump = readJson("packages/osuperpowers/.version-bump.json");
  for (const f of osuperpowersBump.files) {
    const abs = join(root, "packages/osuperpowers", f.path);
    if (!existsSync(abs)) {
      throw new Error(
        `missing generated manifest packages/osuperpowers/${f.path} — run pnpm run emit`,
      );
    }
    const doc = JSON.parse(readFileSync(abs, "utf8"));
    const val = f.field.split(".").reduce((o, k) => o?.[k], doc);
    if (val !== osuperpowersPkg.version) {
      throw new Error(
        `osuperpowers ${f.path} ${val} != ${osuperpowersPkg.version} — run pnpm run emit`,
      );
    }
  }
  console.log("OK —", osuperpowersPkg.version);

  // init stamp: SKILL.md (version marker). router.md (written-table template) was
  // deleted in P9 task 1 (design spec §1.1 — init router removed), so the stamp
  // check covers SKILL.md only.
  for (const rel of [
    "packages/osuperpowers/skills/init/SKILL.md",
  ]) {
    const oeInit = readFileSync(join(root, rel), "utf8");
    const stamp = oeInit.match(/<!-- osuperpowers-version: ([^ ]+) -->/);
    if (!stamp || stamp[1] !== osuperpowersPkg.version) {
      throw new Error(
        `${rel} version stamp mismatch: ${stamp?.[1]} vs ${osuperpowersPkg.version}`,
      );
    }
  }
  console.log("OK — init SKILL.md stamp", osuperpowersPkg.version);
}

// Single in-process step (not a `node scripts/validate/version-sync.mjs` subprocess,
// plan Step 2's literal form): a self-spawning run() would recurse infinitely on the
// standalone path, where main() IS this module's main. In-process keeps suite and
// standalone output byte-identical.
export const steps = [
  {
    name: "8-10. version sync",
    run: checkVersionSync,
  },
];

runIfMain(import.meta.url, steps);