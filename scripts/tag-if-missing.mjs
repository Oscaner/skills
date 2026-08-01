#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");
const root = process.cwd();
const version = JSON.parse(
  readFileSync(join(root, "plugins/superpowers-overrides/package.json"), "utf8"),
).version;
const tag = `superpowers-overrides@${version}`;

function tagExists() {
  try {
    execSync(`git rev-parse ${tag}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

if (tagExists()) {
  console.log(`OK — ${tag} already exists`);
  process.exit(0);
}

if (dryRun) {
  console.log(`DRY-RUN — would create ${tag} and GitHub Release`);
  process.exit(0);
}

execSync(`git tag ${tag}`, { stdio: "inherit" });
execSync(`git push origin ${tag}`, { stdio: "inherit" });
execSync(`gh release create ${tag} --generate-notes`, { stdio: "inherit" });
console.log(`OK — released ${tag}`);
