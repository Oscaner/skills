#!/usr/bin/env node
// scripts/validate/version-sync.ts — blocks 8-10: version sync (moved up from the
// scripts/ root). Verifies every kairos emit product carries the package.json
// version (run after `pnpm run emit`). The vendored-plugin submodule ↔ marketplace
// version check was removed with the self-maintenance surface withdrawal
// (P6 B8 — that check carried the v1.13 resolver flake). Single step descriptor;
// standalone (`node scripts/validate/version-sync.ts`) runs the same checks.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CheckBlock, validateRunner } from "./runner.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

function checkVersionSync() {
  const s = readJson("marketplace/source.json");
  const m = readJson(".claude-plugin/marketplace.json");

  // router deleted — router version sync section removed (#209)

  // kairos — independent semver. package.json is the SOT; the
  // per-harness manifests are committed emit products, re-stamped by `pnpm run
  // emit` (run before this check). The manifest set is taken from
  // .version-bump.json#files so a newly-added harness manifest can't slip past
  // the equality check.
  const kairosPkg = readJson("packages/kairos/package.json");
  const kairosSrc = s.plugins.find((x) => x.name === "kairos");
  const kairosEntry = m.plugins.find((x) => x.name === "kairos");
  const SEMVER = /^\d+\.\d+\.\d+$/;
  if (!SEMVER.test(kairosPkg.version)) {
    throw new Error(`Invalid kairos version format: ${kairosPkg.version}`);
  }
  const kairosVersions = [kairosPkg.version, kairosSrc.version, kairosEntry.version];
  if (new Set(kairosVersions).size !== 1) {
    throw new Error(`kairos version mismatch: ${kairosVersions.join(" ")}`);
  }
  const kairosBump = readJson("packages/kairos/.version-bump.json");
  for (const f of kairosBump.files) {
    const abs = join(root, "packages/kairos", f.path);
    if (!existsSync(abs)) {
      throw new Error(`missing generated manifest packages/kairos/${f.path} — run pnpm run emit`);
    }
    const doc = JSON.parse(readFileSync(abs, "utf8"));
    const val = f.field.split(".").reduce((o, k) => o?.[k], doc);
    if (val !== kairosPkg.version) {
      throw new Error(`kairos ${f.path} ${val} != ${kairosPkg.version} — run pnpm run emit`);
    }
  }

  // cdd-engine — independent semver with no emit products, so there is no sync surface to
  // stamp the version into (under the native `changeset version` pipeline the version lives in
  // its own package.json only). The published-state version identity is asserted by the release
  // post-version gate `smoke-cdd --expect-version` (P4.2 Task 4) — not duplicated here. Only
  // the declared version format is asserted: strict x.y.z, which also excludes prerelease (-X)
  // and build (+X) suffixes.
  const cddEnginePkg = readJson("packages/cdd-engine/package.json");
  if (!SEMVER.test(cddEnginePkg.version)) {
    throw new Error(`Invalid cdd-engine version format: ${cddEnginePkg.version}`);
  }
  console.log("OK —", kairosPkg.version, "· cdd-engine", cddEnginePkg.version);
}

// Single in-process step (not a `node scripts/validate/version-sync.ts` subprocess,
// plan Step 2's literal form): a self-spawning run() would recurse infinitely on the
// standalone path, where main() IS this module's main. In-process keeps suite and
// standalone output byte-identical.
export const steps = [
  new CheckBlock({
    name: "package version sync",
    run: checkVersionSync,
  }),
];

validateRunner.runIfMain(import.meta.url, steps);
