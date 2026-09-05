#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execaCommandSync } from "execa";
import {
  TAG_PATTERNS,
  SUBMODULE_PATHS,
  fetchTags,
  latestTag,
  pinnedSha,
  nearestTag,
} from "./lib/submodule-tags.mjs";

const VALID = new Set(Object.keys(SUBMODULE_PATHS));
const dryRun = process.argv.includes("--dry-run");
const name = process.argv.find((a) => VALID.has(a));

if (!name) {
  console.error(
    "Usage: bump-submodule.mjs <mattpocock-skills|superpowers|impeccable> [--dry-run]",
  );
  process.exit(1);
}

const root = process.cwd();
const submodulePath = SUBMODULE_PATHS[name];
const pattern = TAG_PATTERNS[name];

/** @param {string} p */
function readJson(p) {
  return JSON.parse(readFileSync(join(root, p), "utf8"));
}

/** @param {string} tag */
function checkoutTag(tag) {
  execaCommandSync(`git -C ${submodulePath} checkout ${tag}`, { stdio: "inherit" });
}

/**
 * @param {string} bumpName
 * @param {{ oldSuperpowersVer?: string, semverChanged: boolean, files: string[] }} result
 * @param {string} newTag
 */
function applyBump(bumpName, result, newTag) {
  if (bumpName === "superpowers") {
    const oldVer = result.oldSuperpowersVer;
    checkoutTag(newTag);
    const newVer = readJson("vendors/superpowers/.claude-plugin/plugin.json").version;
    result.semverChanged = oldVer !== newVer;
    return;
  }

  checkoutTag(newTag);

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

function main() {
  const oldPinSha = pinnedSha(submodulePath).slice(0, 7);
  const oldTag = nearestTag(submodulePath, pattern);
  fetchTags(submodulePath);
  const { tag: newTag, sha: newSha } = latestTag(submodulePath, pattern);

  if (pinnedSha(submodulePath) === newSha) {
    if (dryRun) console.log(JSON.stringify({ updated: false, submodule: name }));
    return;
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
    return;
  }

  applyBump(name, result, newTag);
  console.log(JSON.stringify(result));
}

main();
