#!/usr/bin/env node
// scripts/rulesets/apply.mjs — GitHub Rulesets domain.
//
// Applies a GitHub Ruleset idempotently to the repo (Node port of
// gh-branch-rulesets.sh): if a ruleset with the given name already exists it
// prints the delete/recreate commands and exits 1 (no silent overwrite — match
// the .sh); otherwise POSTs the payload from configs/{develop,main}.json.
//
// Wired into run.mjs:
//   node scripts/run.mjs apply-rules <protect-develop|protect-main>
import { execaSync } from "execa";
import path from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.GITHUB_REPOSITORY || "Oscaner/skills";

// target → payload file (ruleset name == target; file is relative to HERE).
export const TARGETS = {
  "protect-develop": "configs/develop.json",
  "protect-main": "configs/main.json",
};

function gh(args, opts = {}) {
  return execaSync("gh", args, { stdio: ["ignore", "pipe", "pipe"], ...opts }).stdout;
}

function applyRuleset(name, file) {
  const out = gh(["api", `repos/${REPO}/rulesets`, "--jq", `.[] | select(.name=="${name}") | .id`]);
  const id = out.split("\n").map((l) => l.trim()).find((l) => l !== "");
  if (id) {
    console.log(`Ruleset ${name} already exists (${id}) — delete and recreate, or PATCH manually`);
    console.log(`  gh api repos/${REPO}/rulesets/${id} -X DELETE`);
    console.log(`  gh api repos/${REPO}/rulesets -X POST --input ${file}`);
    process.exit(1);
  }
  gh(["api", `repos/${REPO}/rulesets`, "-X", "POST", "--input", file], { stdio: "inherit" });
  console.log(`Created ruleset ${name}`);
}

/**
 * Apply a branch-protection ruleset.
 * @param {string} target ruleset name (protect-develop | protect-main)
 * @returns {number} exit code (1 = usage error)
 */
export function main(target) {
  const file = TARGETS[target];
  if (!file) {
    console.error("Usage: run.mjs apply-rules <protect-develop|protect-main>");
    return 1;
  }
  applyRuleset(target, path.join(HERE, file));
  return 0;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  process.exit(main(process.argv[2]));
}