#!/usr/bin/env node
// scripts/validate/smoke-cdd.mjs — CDD engine dry-run smoke (`node scripts/run.mjs smoke-cdd`).
// Runs the four-command chain (cdd-task implement / task-review / fix + branch-review) with
// CDD_DRY_RUN=1 and asserts each command's last stdout block is the 4-line H1 contract
// (status/commits/artifacts/blocker). Depends only on Node built-ins + execa (no engine imports).
//
// Prereq: the cdd-task / branch-review bins must be on PATH — run `cd packages/cdd-engine && npm link`
// first (CI does this via the link-cdd-engine action). Failures surface a clear retry hint below.

import { execaCommandSync } from "execa";

const root = process.cwd(); // repo toplevel（run.mjs 以仓库根为 cwd 调用）

// Clear hint when the engine bins are not linked (npm link prerequisite).
function requireBin(bin) {
  try {
    execaCommandSync(`command -v ${bin}`, { cwd: root });
  } catch {
    throw new Error(
      `${bin} not found on PATH — run \`cd packages/cdd-engine && npm link\` first, then retry smoke-cdd`,
    );
  }
}

export function main() {
  requireBin("cdd-task");
  requireBin("branch-review");

  const plan = "packages/cdd-engine/bin/tests/fixtures/smoke-plan.md";
  const head = execaCommandSync("git rev-parse HEAD", { cwd: root }).stdout.trim();
  const cmds = [
    ["cdd-task", "--harness", "claude", "--task", "1", "--mode", "implement", "--plan", plan],
    ["cdd-task", "--harness", "claude", "--task", "1", "--mode", "task-review", "--plan", plan],
    ["cdd-task", "--harness", "claude", "--task", "1", "--mode", "fix", "--plan", plan],
    ["branch-review", "--harness", "claude", "--plan", plan, "--base", head, "--head", head],
  ];
  for (const [i, args] of cmds.entries()) {
    const out = execaCommandSync(args.join(" "), { env: { ...process.env, CDD_DRY_RUN: "1" }, cwd: root });
    const lastBlock = out.stdout.trim().split(/\n{2,}/).at(-1) ?? "";
    const ok = /status: APPROVED/m.test(lastBlock)
      && /commits: base=/.test(lastBlock)
      && /artifacts: /.test(lastBlock)
      && /blocker: /.test(lastBlock);
    if (!ok) throw new Error(`smoke step ${i + 1}: last block is not the 4-line H1 contract: ${JSON.stringify(lastBlock)}`);
  }
  console.log("OK — cdd-engine dry-run smoke (4 commands)");
}