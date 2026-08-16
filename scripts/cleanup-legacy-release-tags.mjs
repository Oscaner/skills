#!/usr/bin/env node
// scripts/cleanup-legacy-release-tags.mjs — Node port of
// cleanup-legacy-release-tags.sh.
//
// Deletes legacy single-counter release tags (`superpowers-overrides@<v>
// -overrides.N`) left over from the pre-three-segment version scheme. Tag list
// comes from `git tag -l 'superpowers-overrides@*'` filtered by the legacy
// `-overrides.<counter>` suffix; each tag is removed via `gh release delete`
// (best-effort) then `gh api` delete, falling back to `git push origin
// :refs/tags/<tag>`.
//
// Not wired into any package.json script — it is a one-time maintenance helper
// referenced from CLAUDE.md (Branch protection section).
import { execFileSync } from "node:child_process";

const REPO = process.env.GITHUB_REPOSITORY || "Oscaner/skills";

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}

function main() {
  run("git", ["fetch", "--tags", "origin"]);
  const tagsOut = run("git", ["tag", "-l", "superpowers-overrides@*"]);
  const tags = tagsOut.split("\n").filter((t) => /-overrides\.[0-9]+$/.test(t));

  if (tags.length === 0) {
    console.log("No legacy single-counter tags found.");
    return;
  }

  for (const tag of tags) {
    console.log(`Deleting ${tag}...`);
    try {
      run("gh", ["release", "delete", tag, "-y", "--repo", REPO]);
    } catch {
      // release may not exist — the tag deletion below is authoritative
    }
    try {
      run("gh", ["api", "-X", "DELETE", `repos/${REPO}/git/refs/tags/${tag}`]);
    } catch {
      run("git", ["push", "origin", `:refs/tags/${tag}`]);
    }
  }

  console.log(`Done. Removed ${tags.length} legacy tag(s).`);
}

main();
