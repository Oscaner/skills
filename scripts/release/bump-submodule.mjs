#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execaCommandSync } from "execa";
import {
  TAG_PATTERNS,
  SUBMODULE_PATHS,
  fetchTags,
  latestTag,
  pinnedSha,
  nearestTag,
} from "./submodule-tags.mjs";

const VALID = new Set(Object.keys(SUBMODULE_PATHS));

const root = process.cwd();

/** @param {string} p */
function readJson(p) {
  return JSON.parse(readFileSync(join(root, p), "utf8"));
}

/** @param {string} tag @param {string} submodulePath */
function checkoutTag(tag, submodulePath) {
  execaCommandSync(`git -C ${submodulePath} checkout ${tag}`, { stdio: "inherit" });
}

/**
 * @param {string} bumpName
 * @param {{ oldSuperpowersVer?: string, semverChanged: boolean, files: string[] }} result
 * @param {string} newTag
 * @param {string} submodulePath
 */
function applyBump(bumpName, result, newTag, submodulePath) {
  if (bumpName === "superpowers") {
    const oldVer = result.oldSuperpowersVer;
    checkoutTag(newTag, submodulePath);
    const newVer = readJson("vendors/superpowers/.claude-plugin/plugin.json").version;
    result.semverChanged = oldVer !== newVer;
    // marketplace/source.json is a derived emit product — emit re-derives the
    // superpowers version from the vendored plugin.json, so no direct
    // source.json write (aligned with the mattpocock-skills / impeccable paths).
    execaCommandSync("pnpm run emit", { stdio: "inherit", cwd: root });
    return;
  }

  checkoutTag(newTag, submodulePath);

  if (bumpName === "mattpocock-skills") {
    execaCommandSync("pnpm run emit", { stdio: "inherit", cwd: root });
    return;
  }

  if (bumpName === "impeccable") {
    // marketplace/source.json is a derived emit product — the emit below
    // re-derives the impeccable version from the vendored plugin.json, so no
    // direct source.json write.
    execaCommandSync("pnpm run emit", { stdio: "inherit", cwd: root });
  }
}

/**
 * Bump a vendored submodule to its latest release tag.
 * @param {string} name submodule name (mattpocock-skills | superpowers | impeccable)
 * @param {{ dryRun?: boolean }} opts
 * @returns {number} exit code (1 = usage error)
 */
export function main(name, { dryRun = false } = {}) {
  if (!name || !VALID.has(name)) {
    console.error(
      "Usage: run.mjs bump-submodule <mattpocock-skills|superpowers|impeccable> [--dry-run]",
    );
    return 1;
  }
  const submodulePath = SUBMODULE_PATHS[name];
  const pattern = TAG_PATTERNS[name];

  const oldPinSha = pinnedSha(submodulePath).slice(0, 7);
  const oldTag = nearestTag(submodulePath, pattern);
  fetchTags(submodulePath);
  const { tag: newTag, sha: newSha } = latestTag(submodulePath, pattern);

  if (pinnedSha(submodulePath) === newSha) {
    if (dryRun) console.log(JSON.stringify({ updated: false, submodule: name }));
    return 0;
  }

  /** @type {{ updated: boolean, submodule: string, oldPinSha: string, oldTag: string | null, newTag: string, semverChanged: boolean, files: string[], oldSuperpowersVer?: string }} */
  const result = {
    updated: true,
    submodule: name,
    oldPinSha,
    oldTag,
    newTag,
    semverChanged: false,
    files: [submodulePath],
  };

  if (name === "superpowers") {
    const source = readJson("marketplace/source.json");
    result.oldSuperpowersVer = source.plugins.find(
      (p) => p.name === "superpowers",
    ).version;
    const newVerAtTag = JSON.parse(
      execaCommandSync(
        `git -C ${submodulePath} show ${newTag}:.claude-plugin/plugin.json`,
      ).stdout.trim(),
    ).version;
    result.semverChanged = result.oldSuperpowersVer !== newVerAtTag;
  }

  if (dryRun) {
    console.log(JSON.stringify(result));
    return 0;
  }

  applyBump(name, result, newTag, submodulePath);
  console.log(JSON.stringify(result));
  return 0;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  const name = process.argv.find((a) => VALID.has(a));
  const dryRun = process.argv.includes("--dry-run");
  process.exit(main(name, { dryRun }));
}