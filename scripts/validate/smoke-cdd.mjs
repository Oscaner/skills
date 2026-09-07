#!/usr/bin/env node
// scripts/validate/smoke-cdd.mjs — CDD engine dry-run smoke (`node scripts/run.mjs smoke-cdd`).
// Runs the four-command chain (`cdd implement` / `cdd review --type task` /
// `cdd fix --type task` / `cdd review --type branch`) with CDD_DRY_RUN=1 and asserts each
// command's last stdout block is the 4-line H1 contract (status/commits/artifacts/blocker).
// Depends only on Node built-ins + execa (no engine imports).
//
// Bin resolution: PATH-first (exercises the `npm link` install when the bin is linked — CI
// link-cdd-engine asserts `command -v cdd`), falling back to the repo-relative node entry
// (`node packages/cdd-engine/bin/cdd.mjs`) so the smoke is robust to runner PATH quirks.

import { execaCommandSync, execaSync } from "execa";
import { rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd(); // repo toplevel (run.mjs invokes with the repo root as cwd)

const ENTRIES = { cdd: "packages/cdd-engine/bin/cdd.mjs" };

// Resolve the bin to its argv prefix: PATH bin when present, else `node <repo-relative entry>`.
function resolveBin(bin) {
  try {
    execaCommandSync(`command -v ${bin}`, { cwd: root });
    return [bin];
  } catch {
    return ["node", ENTRIES[bin]];
  }
}

export function main() {
  const cdd = resolveBin("cdd");
  if (cdd[0] !== "cdd") {
    console.log(`smoke: PATH bin unavailable — using repo-relative node entry (${cdd.slice(1).join(" ")})`);
  }

  const plan = "packages/cdd-engine/bin/tests/fixtures/smoke-plan.md";
  const slug = path.basename(plan, ".md");
  const head = execaCommandSync("git rev-parse HEAD", { cwd: root }).stdout.trim();
  // Branch-review dry-run writes a handoff into the (gitignored) smoke workspace — drop any
  // stale round so a re-run never trips Review Stopping on the previous APPROVED round.
  rmSync(path.join(root, ".superpowers", "cdd", slug), { recursive: true, force: true });

  // review --type task would produce .superpowers/cdd/<slug>/task-1-task-review-1.json in a
  // real run; fix consumes it via --findings (parseReview→fix wiring). Under dry-run neither
  // writes nor reads the file — only the arg plumbing is exercised.
  const cmds = [
    [...cdd, "implement", "--harness", "claude", "--task", "1", "--plan", plan],
    [...cdd, "review", "--type", "task", "--harness", "claude", "--task", "1", "--plan", plan],
    [...cdd, "fix", "--type", "task", "--harness", "claude", "--task", "1", "--plan", plan,
      "--findings", path.join(".superpowers", "cdd", slug, "task-1-task-review-1.json")],
    [...cdd, "review", "--type", "branch", "--harness", "claude", "--plan", plan, "--base", head, "--head", head],
  ];
  for (const [i, args] of cmds.entries()) {
    // Array form (no shell join) — every arg is a fixed constant today; keeps arg quoting if they ever change.
    const out = execaSync(args[0], args.slice(1), { env: { ...process.env, CDD_DRY_RUN: "1" }, cwd: root });
    const lastBlock = out.stdout.trim().split(/\n{2,}/).at(-1) ?? "";
    // The four literals mirror the engine's 4-line H1 contract verbatim. Authoritative emitters:
    // packages/cdd-engine/bin/lib/runner.mjs dryRunH1Block (implement/review/fix) and
    // packages/cdd-engine/bin/cdd.mjs runBranchReview DRY_RUN block — coordinate H1 shape there too.
    const ok = /status: APPROVED/m.test(lastBlock)
      && /commits: base=/.test(lastBlock)
      && /artifacts: /.test(lastBlock)
      && /blocker: /.test(lastBlock);
    if (!ok) throw new Error(`smoke step ${i + 1}: last block is not the 4-line H1 contract: ${JSON.stringify(lastBlock)}`);
  }
  console.log("OK — cdd-engine dry-run smoke (4 commands)");
}
