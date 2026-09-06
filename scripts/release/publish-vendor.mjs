#!/usr/bin/env node
/**
 * publish-vendor — assemble the vendored submodule plugins as scoped npm
 * packages (`@oscaner-skills/<name>`) and run `npm publish`.
 *
 * Orchestration only: registry/upstream probing lives in vendor-registry.mjs,
 * assembly (template / package.json / staging) in vendor-assembly.mjs.
 *
 * Usage:
 *   node scripts/run.mjs publish-vendor            # real publish (needs npm auth)
 *   node scripts/run.mjs publish-vendor --dry-run  # stage + npm publish --dry-run
 *
 * Each vendor is staged under `tmp/publish-vendor/<name>` (gitignored): a copy
 * of the submodule content with a scoped package.json (name/version/contentRoot
 * + pi key) and the upstream LICENSE preserved. Submodule not checked out or a
 * missing LICENSE aborts the run before any publish.
 */

import { $ } from "execa";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  PROBE_CLASS,
  decideProbe,
  probeRegistryVersion,
  listRegistryVersions,
  probeTagExists,
  probeReleaseExists,
  readGitmodules,
  probeUpstreamTagExists,
  headTagAtHead,
  listVendors,
  collectGaps,
  resolveUpstreamTag,
} from "./vendor-registry.mjs";
import {
  assemblyTemplate,
  assertSubmoduleCheckedOut,
  assertLicensePresent,
  stageVendor,
  resolveVendorVersion,
} from "./vendor-assembly.mjs";
import { repoRootFromImportMeta } from "../lib/marketplace-utils.mjs";

/**
 * Stage one vendor and run `npm publish` in the staged dir.
 * @param {string} name vendor name
 * @param {string} root repo root
 * @param {{ dryRun?: boolean, stageRoot: string }} opts
 */
export function publishVendor(name, root, { dryRun = false, stageRoot }) {
  assemblyTemplate(name);
  assertSubmoduleCheckedOut(name, root);
  assertLicensePresent(name, root);
  const dest = stageVendor(name, root, stageRoot);
  const flags = ["publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])];
  $.sync({ cwd: dest, stdio: "inherit" })`npm ${flags}`;
  return dest;
}

/** Default staging parent for all assembled vendor packages. */
export function defaultStageRoot(root) {
  return join(root, "tmp", "publish-vendor");
}

/**
 * Assemble + publish every vendor; print the full registry gap diff to stdout.
 * @param {string} root repo root
 * @param {{ dryRun?: boolean }} opts
 */
export function publishAll(root, { dryRun = false } = {}) {
  const stageRoot = defaultStageRoot(root);
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });

  // Cache the vendor list + versions — avoids repeating listVendors + resolveVendorVersion I/O in the publish and gap loops
  const vendorList = listVendors(root);
  const vendorData = vendorList.map((name) => ({ name, version: resolveVendorVersion(name, root) }));

  const publishedThisRun = []; // vendor names normalized as published (success or EPUBLISHCONFLICT)

  // ── Phase 1: stage + publish ────────────────────────────────────────────
  for (const { name, version } of vendorData) {
    const dest = stageVendor(name, root, stageRoot);

    if (dryRun) {
      // dry-run: nothing probed or published — stdout prints [] at the end of the function
      continue;
    }

    // probe (tri-state)
    const probe = probeRegistryVersion(`@oscaner-skills/${name}`, version);
    const decision = decideProbe(probe); // E404→publish / exit0→skip / error→throw (aborts the release)

    if (decision === PROBE_CLASS.PUBLISHED) {
      process.stderr.write(`[skip] @oscaner-skills/${name}@${version} already published\n`);
      // Continue: this version may lack a tag/Release — rebuilt out by the gap diff
    }

    if (decision === PROBE_CLASS.SHOULD_PUBLISH) {
      try {
        const { stderr } = $.sync({ cwd: dest })`npm publish --access public`;
        // Always write npm logs to stderr (keeps stdout clean)
        if (stderr) process.stderr.write(stderr);
        process.stderr.write(`[publish] @oscaner-skills/${name}@${version} → npm\n`);
        publishedThisRun.push(name);
      } catch (e) {
        const stdout = e.stdout ?? "";
        const stderr = e.stderr ?? "";
        // Always write npm logs to stderr (keeps stdout clean)
        if (stderr) process.stderr.write(stderr);
        if (/EPUBLISHCONFLICT/i.test(stdout + stderr)) {
          // TOCTOU normalization: skip as already published + record into publishedThisRun (goes into the gap diff)
          process.stderr.write(`[skip] @oscaner-skills/${name}@${version} already published (EPUBLISHCONFLICT)\n`);
          publishedThisRun.push(name);
        } else {
          throw new Error(`npm publish failed for ${name}@${version}: ${stdout + stderr}`);
        }
      }
    }
  }

  if (dryRun) {
    process.stdout.write("[]\n");
    return stageRoot;
  }

  // ── Phase 2: registry gap diff ─────────────────────────────────────────
  const items = [];
  for (const { name, version: currentVersion } of vendorData) {
    const registryVersions = listRegistryVersions(`@oscaner-skills/${name}`);
    // union: registry + this run's publishes (protects against TOCTOU registry index lag)
    const publishedVersion = publishedThisRun.includes(name) ? currentVersion : null;
    const allVersions = [...new Set([...registryVersions, ...(publishedVersion ? [publishedVersion] : [])])];
    if (allVersions.length === 0) continue;

    // build the in-repo tag/release index
    const tagIndex = new Set();
    const releaseIndex = new Set();
    for (const v of allVersions) {
      if (probeTagExists(name, v)) tagIndex.add(v);
      if (probeReleaseExists(name, v)) releaseIndex.add(v);
    }

    const gaps = collectGaps(allVersions, tagIndex, releaseIndex);
    const upstreamRepo = readGitmodules(root, name);
    const headTag = headTagAtHead(root, name);

    for (const gap of gaps) {
      const upstreamTag = resolveUpstreamTag(gap.version, { headVersion: currentVersion, headTag }, (ref) =>
        probeUpstreamTagExists(root, name, ref),
      );
      items.push({ name, version: gap.version, upstreamRepo, upstreamTag });
    }
  }

  // ── stdout contract: single-line valid JSON array (the bin no longer writes stdout) ──
  process.stdout.write(JSON.stringify(items) + "\n");
  return stageRoot;
}

/** run.mjs dispatcher entry (`node scripts/run.mjs publish-vendor [--dry-run]`). */
export function main({ dryRun } = {}) {
  const root = repoRootFromImportMeta(import.meta.url);
  // Forwarded commander option wins under run.mjs dispatch; the argv read
  // covers the isMain direct-run path, which passes no options.
  const isDryRun = dryRun ?? process.argv.includes("--dry-run");

  try {
    const stageRoot = publishAll(root, { dryRun: isDryRun });
    process.stderr.write(`OK — ${isDryRun ? "dry-run" : "publish"} complete for @oscaner-skills/*\n`);
    process.stderr.write(`staged at ${stageRoot}\n`);
  } catch (err) {
    process.stderr.write(`publish-vendor failed: ${err.message}\n`);
    process.exit(1);
  }
}