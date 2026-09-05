#!/usr/bin/env node
// scripts/gh-branch-rulesets.mjs — Node port of gh-branch-rulesets.sh.
//
// Applies GitHub Rulesets idempotently to the repo: if a ruleset with the
// given name already exists it prints the delete/recreate commands and exits 1
// (no silent overwrite — match the .sh); otherwise POSTs the payload from
// scripts/gh-branch-rulesets/{develop,main}.json.
//
// Not wired into any package.json script — it is a maintenance helper
// referenced from CLAUDE.md (Branch protection section).
import { execaSync } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.GITHUB_REPOSITORY || "Oscaner/skills";

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

applyRuleset("protect-develop", path.join(HERE, "gh-branch-rulesets/develop.json"));
applyRuleset("protect-main", path.join(HERE, "gh-branch-rulesets/main.json"));
