#!/usr/bin/env node
// scripts/validate/smoke-cdd.mjs — CDD engine dry-run smoke (`node scripts/run.mjs smoke-cdd`).
// Runs the four-command chain (cdd-task implement / task-review / fix + branch-review) with
// CDD_DRY_RUN=1 and asserts each command's last stdout block is the 4-line H1 contract
// (status/commits/artifacts/blocker). Depends only on Node built-ins + execa (no engine imports).
//
// Bin resolution: PATH-first (exercises the `npm link` install when the bin is linked — CI
// link-cdd-engine asserts `command -v cdd-task`), falling back to the repo-relative node entry
// (`node packages/cdd-engine/bin/<entry>.mjs`) so the smoke is robust to runner PATH quirks.

import { execaCommandSync, execaSync } from "execa";

const root = process.cwd(); // repo toplevel (run.mjs invokes with the repo root as cwd)

const ENTRIES = {
  "cdd-task": "packages/cdd-engine/bin/cdd-task.mjs",
  "branch-review": "packages/cdd-engine/bin/branch-review.mjs",
};

// Resolve a bin to its argv prefix: PATH bin when present, else `node <repo-relative entry>`.
function resolveBin(bin) {
  try {
    execaCommandSync(`command -v ${bin}`, { cwd: root });
    return [bin];
  } catch {
    return ["node", ENTRIES[bin]];
  }
}

export function main() {
  const cddTask = resolveBin("cdd-task");
  const branchReview = resolveBin("branch-review");
  const viaPath = cddTask[0] === "cdd-task" && branchReview[0] === "branch-review";
  if (!viaPath) {
    console.log(`smoke: PATH bins not linked — falling back to repo-relative node entries (${cddTask[0]} / ${branchReview[0]})`);
  }

  const plan = "packages/cdd-engine/bin/tests/fixtures/smoke-plan.md";
  const head = execaCommandSync("git rev-parse HEAD", { cwd: root }).stdout.trim();
  const cmds = [
    [...cddTask, "--harness", "claude", "--task", "1", "--mode", "implement", "--plan", plan],
    [...cddTask, "--harness", "claude", "--task", "1", "--mode", "task-review", "--plan", plan],
    [...cddTask, "--harness", "claude", "--task", "1", "--mode", "fix", "--plan", plan],
    [...branchReview, "--harness", "claude", "--plan", plan, "--base", head, "--head", head],
  ];
  for (const [i, args] of cmds.entries()) {
    // Array form (no shell join) — every arg is a fixed constant today; keeps arg quoting if they ever change.
    const out = execaSync(args[0], args.slice(1), { env: { ...process.env, CDD_DRY_RUN: "1" }, cwd: root });
    const lastBlock = out.stdout.trim().split(/\n{2,}/).at(-1) ?? "";
    // The four literals mirror the engine's 4-line H1 contract verbatim. Authoritative emitters:
    // packages/cdd-engine/bin/lib/runner.mjs dryRunH1Block (cdd-task modes) and
    // packages/cdd-engine/bin/branch-review.mjs DRY_RUN block — coordinate H1 shape changes there too.
    const ok = /status: APPROVED/m.test(lastBlock)
      && /commits: base=/.test(lastBlock)
      && /artifacts: /.test(lastBlock)
      && /blocker: /.test(lastBlock);
    if (!ok) throw new Error(`smoke step ${i + 1}: last block is not the 4-line H1 contract: ${JSON.stringify(lastBlock)}`);
  }
  console.log("OK — cdd-engine dry-run smoke (4 commands)");
}