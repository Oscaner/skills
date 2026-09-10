#!/usr/bin/env node
// scripts/validate/smoke-cdd.mjs — CDD engine dry-run smoke (`node scripts/run.mjs smoke-cdd`).
// Runs the four-command chain (`cdd implement` / `cdd review --type task` /
// `cdd fix --type task` / `cdd review --type branch`) with CDD_DRY_RUN=1 and asserts each
// command's last stdout block is the 4-line H1 contract (status/commits/artifacts/blocker).
// Then runs the T7 deletion-surface sweep — the P5 clearance inventory as a durable gate
// (retired gate/harness/select vocab must stay out of mechanism/document positions, dead
// artifacts must stay absent). Depends on Node built-ins + execa + the sibling residue.mjs
// scanner (no engine imports).

import { execaCommandSync, execaSync } from "execa";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { collectGateLexiconHits, scanTargets } from "./residue.mjs";

const root = process.cwd(); // repo toplevel (run.mjs invokes with the repo root as cwd)

const ENTRIES = { cdd: "packages/cdd-engine/bin/cdd.mjs" };

// Resolve the bin to its argv prefix: PATH bin when present (exercises the `npm link`
// install — CI link-cdd-engine asserts `command -v cdd`), else `node <repo-relative entry>`
// so the smoke is robust to runner PATH quirks.
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

  // review --type task would produce .superpowers/cdd/<slug>/task-1-review-1.json in a
  // real run; fix consumes it via --findings (parseReview→fix wiring). Under dry-run neither
  // writes nor reads the file — only the arg plumbing is exercised.
  const cmds = [
    [...cdd, "implement", "--task", "1", "--plan", plan],
    [...cdd, "review", "--type", "task", "--task", "1", "--plan", plan],
    [...cdd, "fix", "--type", "task", "--task", "1", "--plan", plan,
      "--findings", path.join(".superpowers", "cdd", slug, "task-1-review-1.json")],
    [...cdd, "review", "--type", "branch", "--plan", plan, "--base", head, "--head", head],
  ];
  for (const [i, args] of cmds.entries()) {
    // Array form (no shell join) — every arg is a fixed constant today; keeps arg quoting if they ever change.
    // T3: harness flag removed — host resolution is env-driven; inject CLAUDE_CODE_SESSION_ID=1
    // so the smoke's four commands resolve the host as claude deterministically (CI has no session markers).
    const out = execaSync(args[0], args.slice(1), { env: { ...process.env, CDD_DRY_RUN: "1", CLAUDE_CODE_SESSION_ID: "1" }, cwd: root });
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
  checkDeletionSurface();
}

// T7 final check — P5 deletion-surface sweep (the clearance inventory as a durable gate):
// retired gate/harness/select vocab must stay out of mechanism/document positions, deleted
// paths must stay deleted, and per-harness artifacts must keep the kept/retired baseline.
// Vocab scopes cover mechanism/document positions only; guard/test positions and this
// package's own dir (scripts/validate) self-exempt, mirroring the residue.mjs gate guard's
// target design — guards must reference retired tokens to assert their absence.
const OSKILLS = ["packages/osuperpowers/skills"];
const ENGINE = ["packages/cdd-engine/bin"];      // N②: 不含 bin/tests —— cli-shape.test 必携 --doc 断言拒绝，G2/G3 扫描 scope 须与「guard/test 自豁免」doctrine 对齐（同 residue G1）
const MAINTAINERS = ["docs/maintainers"];
const MAINTAINERS_DOC = [path.join("docs", "maintainers", "osuperpowers-plugin.md")];
const ROOT_README = [path.join("packages", "osuperpowers", "README.md")];

function assertNoResidue(label, re, targets) {
  const hits = scanTargets(targets, re);
  if (hits.length) throw new Error(`${label} is not zero-residue:\n  ${hits.join("\n  ")}`);
}

function checkDeletionSurface() {
  // G1 gate lexicon — reuse the residue.mjs zero-exemption guard rather than duplicating it.
  const gate = collectGateLexiconHits();
  if (gate.length) {
    throw new Error(`G1 gate lexicon is not zero-residue:\n  ${gate.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`);
  }

  // G2 --harness — engine + shipped skills + maintainers. scripts/validate self-exempts
  // (this guard and residue.mjs carry the retired token by design).
  assertNoResidue("G2 --harness flag", /--harness/, [...ENGINE, ...OSKILLS, ...MAINTAINERS]);

  // G3 --doc — shipped skills + engine entry + maintainers. bin/tests is out of scope:
  // cli-shape.test.mjs must pass the retired token to assert its rejection (exit 2).
  assertNoResidue("G3 --doc flag", /--doc/, [...OSKILLS, path.join("packages", "cdd-engine", "bin", "cdd.mjs"), ...MAINTAINERS]);

  // G4 select vocab in shipped skills.
  assertNoResidue("G4 cli-select/select-harness", /cli-select|select-harness/, OSKILLS);

  // G5 skills-missing/skills-probe in package docs.
  assertNoResidue("G5 skills-missing/skills-probe", /skills-missing|skills-probe/, [...MAINTAINERS_DOC, ...ROOT_README]);

  // G6 harness-select vocab in the consumer-facing README (cli-select / droid / pi).
  // N④: `pi` 用词边界符（\bpi\b）防 pipeline/principle 等英文词误报（裸 `pi` 子串在 durability gate 对任意未来编辑敏感）。
  assertNoResidue("G6 README cli-select/droid/pi", /cli-select|droid|\bpi\b/, ROOT_README);

  // G7 deleted paths stay deleted.
  for (const gone of [path.join("docs", "gate-install.md"), path.join(".github", "actions", "install-harness")]) {
    if (existsSync(path.join(root, gone))) throw new Error(`G7 deleted path has returned: ${gone}`);
  }

  // G8 per-harness artifact baseline — kept harnesses present, retired ones absent.
  for (const kept of [".claude-plugin", ".cursor-plugin"]) {
    if (!existsSync(path.join(root, kept))) throw new Error(`G8 kept harness artifact missing: ${kept}`);
  }
  for (const removed of [".codex-plugin", ".qoder-plugin", ".kimi-plugin", "gemini-extension.json"]) {
    if (existsSync(path.join(root, removed))) throw new Error(`G8 retired harness artifact present: ${removed}`);
  }

  console.log("OK — deletion-surface zero residue (T7 final check)");
}
