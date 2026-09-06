#!/usr/bin/env node
// bin/cdd.mjs — the single CDD engine CLI (URC merge surface). Commander.js v15.
// Subcommands = operation × (type | no type). All legacy bins (cdd-task / docs-task /
// branch-review / cdd-select / cdd-research) converge here; Task 3 removes the sources.
//   cdd implement --harness <name> --task <n> [--plan <path>]
//   cdd review --type <task|branch|spec|plan> --harness <name> [...]
//   cdd fix --type <task|spec|plan> --harness <name> [...]
//   cdd select | cdd research --harness <name> --brief <path> --output <path>
//   cdd brief --task <n> --plan <path> [--output <path>]
//   cdd contract [--check-dirty] [--check-head] [--handoff <path>] [--progress <path>] [--clear-findings]
import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadRegistry, checkHarness, CddBlockedError } from "./lib/registry.mjs";
import { renderTemplate, renderHandoffStub } from "./lib/templates.mjs";
import { loadHandoffSchema, validateHandoffSchema } from "./lib/schema-utils.mjs";
import { resolveNextRound } from "./lib/review-loop.mjs";
import { writeHandoff, gitToplevel } from "./lib/contract.mjs";
import { invokeCliWithRetry, resolveTimeoutMs, spawnCapture } from "./lib/cli-shared.mjs";
import { buildResearchPrompt, writeFindings } from "./lib/research.mjs";
import { runBriefCli } from "./lib/brief.mjs";
import { runContractCli } from "./lib/contract.mjs";
import { detectInstalledHarnesses } from "./utils/harness-detect.mjs";
import { config } from "./utils/skills-probe.config.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "./utils/exit.mjs";

const REG_PATH = fileURLToPath(new URL("./harness-registry.json", import.meta.url));
const DRY_RUN = () => process.env.CDD_DRY_RUN === "1";

// Per-subcommand usage lines (print on parse/usage errors in place of Commander's own output).
const SUBCOMMAND_USAGE = {
  implement: "usage: cdd implement --harness <name> --task <n> [--plan <path>]",
  review: "usage: cdd review --type <task|branch|spec|plan> --harness <name> [--task <n>] [--doc <path>] [--plan <path>] [--base <sha> --head <sha>] [--round <n>]",
  fix: "usage: cdd fix --type <task|spec|plan> --harness <name> [--task <n>] [--findings <path>] [--doc <path>] [--plan <path>]",
  select: "usage: cdd select",
  research: "usage: cdd research --harness <name> --brief <path> --output <path>",
  brief: "usage: cdd brief --task <n> --plan <path> [--output <path>]",
  contract: "usage: cdd contract [--check-dirty] [--check-head] [--handoff <path>] [--progress <path>] [--clear-findings]",
};

function usageError(command) {
  process.stderr.write((SUBCOMMAND_USAGE[command] ?? "usage: cdd <command> [options]") + "\n");
}

// ---- review/fix shared helpers ----

// Docs review workspace: <repoRoot>/.superpowers/docs-review/ (matches docs-task Bug K fix).
function docsReviewWorkspace() {
  return path.join(gitToplevel(process.cwd()), ".superpowers", "docs-review");
}

function existingRoundHandoff(ws, type, round) {
  if (round < 1) return null;
  const p = path.join(ws, `${type}-${round}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

function blockerCount(handoff) {
  return (handoff?.findings ?? []).filter((f) => f?.severity === "blocker").length;
}

// Review Stopping: reject a re-dispatch of a (type, ref) whose previous round reached blocker=0.
function stoppedExit3(type, round, ref, blocker) {
  process.stderr.write(
    `${ref} round ${round} (${type}) already blocker=0 — Review Stopping: do not re-run (exit 3)\n` +
    (blocker ? `last blocker: ${blocker}` : ""));
  process.exit(3);
}

// ---- review dispatch ----

async function runReview(opts) {
  // type=branch: independent git-diff-level path (inline of branch-review.mjs action + AC15 wiring).
  if (opts.type === "branch") {
    if (!opts.plan) {
      process.stderr.write("cdd review --type branch: missing required --plan <path>\n");
      process.exit(2);
    }
    return await runBranchReview(opts);
  }

  if (opts.type === "spec" || opts.type === "plan") {
    if (!opts.doc) {
      process.stderr.write(`cdd review --type ${opts.type}: missing required --doc <path>\n`);
      process.exit(2);
    }
    const { runDocsTask } = await import("./lib/docs-runner.mjs");
    // spec/plan: round = engine auto-increment; --round only validates backfill (conflict → exit 2).
    const ws = docsReviewWorkspace();
    const round = resolveNextRound(ws, opts.type);
    if (opts.round && Number(opts.round) !== round) {
      process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
      process.exit(2);
    }
    const prev = existingRoundHandoff(ws, opts.type, round - 1);
    // Stopping only rejects a re-run of the SAME ref (doc); a changed ref = a new review.
    if (prev && (prev.doc_path ?? "") === opts.doc && blockerCount(prev) === 0) {
      stoppedExit3(opts.type, round, opts.doc, prev?.blocker);
    }
    // Pre-Task-4: legacy spec-review/plan-review templates require {{PASS}} — pass a placeholder
    // to avoid renderTemplate throwing on a missing param (Task 4 swaps to review.md params).
    const template = opts.type === "spec" ? "spec-review" : "plan-review";
    const extra = { PASS: "completeness" };
    await runDocsTask({
      harness: opts.harness, mode: "review", template, doc: opts.doc,
      round, handoffPath: path.join(ws, `${opts.type}-${round}.json`),
      params: extra, workspace: ws, repoRoot: gitToplevel(process.cwd()),
      dryRun: DRY_RUN(),
    });
    return;
  }

  // type=task: task review (runner internally tracks task-N-task-review-{R}.json round sequence).
  if (opts.type !== "task") {
    process.stderr.write(`unknown review --type: ${opts.type}\n`);
    process.exit(2);
  }
  if (!opts.plan) {
    process.stderr.write("cdd review --type task: missing required --plan <path> (workspace slug + Stopping)\n");
    process.exit(2);
  }
  if (opts.task == null) {
    process.stderr.write("cdd review --type task: missing required --task <n>\n");
    process.exit(2);
  }
  // Workspace slug derives from the plan filename; task Stopping reads the latest
  // task-{N}-task-review-{R}.json and rejects when its blockers = 0.
  const slug = path.basename(opts.plan, ".md");
  const taskWs = path.join(gitToplevel(process.cwd()), ".superpowers", "cdd", slug);
  const reviewFiles = existsSync(taskWs)
    ? readdirSync(taskWs).filter((f) => f.match(new RegExp(`^task-${opts.task}-task-review-(\\d+)\\.json$`)))
    : [];
  const latestRound = reviewFiles
    .map((f) => Number(f.match(/(\d+)\.json$/)[1]))
    .sort((a, b) => a - b).at(-1);
  if (latestRound) {
    const th = JSON.parse(readFileSync(path.join(taskWs, `task-${opts.task}-task-review-${latestRound}.json`), "utf8"));
    if (blockerCount(th) === 0) stoppedExit3("task", latestRound, opts.plan, th?.blocker);
  }
  const { runTask } = await import("./lib/runner.mjs");
  await runTask(opts.harness, parseInt(opts.task, 10), {
    mode: "task-review", dryRun: DRY_RUN(),
    env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
  });
}

// Inline of the branch-review.mjs action body, wired with AC15 round sequence +
// Review Stopping (previous-round lookup filtered by base7..head7 embedded in the filename;
// a ref change = a new review, never falsely rejected).
async function runBranchReview(opts) {
  const { harness, plan, base, head } = opts;

  // Harness registry gate.
  let entry;
  try {
    entry = checkHarness(loadRegistry(REG_PATH), harness, { dryRun: DRY_RUN() });
  } catch (e) {
    if (e instanceof CddBlockedError) {
      process.stderr.write(`${e.message}\n`);
      e.kind === "cli-missing" ? exitCliMissing() : exitBlocked();
    }
    throw e;
  }

  const repoRoot = gitToplevel(process.cwd());
  if (!repoRoot) { process.stderr.write("cdd review: not in a git repo\n"); exitBlocked(); }
  const slug = path.basename(plan, ".md");
  const base7 = String(base).slice(0, 7);
  const head7 = String(head).slice(0, 7);
  const workspace = path.join(repoRoot, ".superpowers", "cdd", slug);

  // AC15 wiring: engine round seq (branch-review-*-r{round} pattern) + --round backfill
  // validation (conflict → exit 2) + Stopping on the previous round for THIS ref.
  const round = resolveNextRound(workspace, "branch");
  if (opts.round && Number(opts.round) !== round) {
    process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
    process.exit(2);
  }
  const prevPath = path.join(workspace, `branch-review-${base7}..${head7}-r${round - 1}.json`);
  const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : null;
  if (prev && blockerCount(prev) === 0) {
    stoppedExit3("branch", round, `${base7}..${head7}`, prev?.blocker);
  }

  // Per-round handoff filename (branch-fix-loop re-reviews reuse distinct files).
  const handoffFile = `branch-review-${base7}..${head7}-r${round}.json`;
  const handoffPath = path.join(workspace, handoffFile);
  mkdirSync(workspace, { recursive: true });

  if (DRY_RUN()) {
    writeHandoff(handoffPath, {
      task: 1, phase: "branch-review", status: "APPROVED",
      commits: { base, head }, findings: [], artifacts: {}, blocker: "dry-run",
    });
    process.stdout.write(`status: APPROVED\ncommits: base=${base} head=${head}\nartifacts: \nblocker: dry-run\n`);
    exitOk();
    return;
  }

  // Render branch-review template.
  const schema = loadHandoffSchema();
  const handoffStub = renderHandoffStub(schema, "branch-review", 1); // task minimum 1 in CDD schema
  const prompt = renderTemplate("branch-review", {
    BASE: base, HEAD: head, PLAN: plan,
    HANDOFF: handoffPath, HANDOFF_STUB: handoffStub,
  }, "cdd review");

  // Invoke harness CLI.
  const timeoutMs = resolveTimeoutMs(process.env, "review");
  const res = await invokeCliWithRetry(entry, prompt, "branch-review", process.env, repoRoot, timeoutMs);

  if (!res.ok) {
    if (!existsSync(handoffPath)) {
      writeHandoff(handoffPath, {
        task: 1, phase: "branch-review", status: "BLOCKED",
        commits: { base, head }, findings: [], artifacts: {},
        blocker: `cli exited ${res.code} without writing handoff`,
      });
    }
    process.stderr.write(`CDD_BLOCKED: branch-review failed (exit ${res.code})\n`);
    exitWithCode(1);
  }

  // Agent exited 0 but never wrote the handoff — BLOCKED (mirrors runner step 10.5).
  if (!existsSync(handoffPath)) {
    writeHandoff(handoffPath, {
      task: 1, phase: "branch-review", status: "BLOCKED",
      commits: { base, head }, findings: [], artifacts: {},
      blocker: `${path.basename(handoffPath)} not written after exit 0 → re-run branch-review`,
    });
    process.stderr.write(`CDD_BLOCKED: branch-review handoff not written\n`);
    exitWithCode(1);
  }

  // Agent wrote handoff — validate against the CDD schema (mirrors runner step 8.8).
  if (existsSync(handoffPath)) {
    const agentHandoff = JSON.parse(readFileSync(handoffPath, "utf8"));
    const sv = validateHandoffSchema(agentHandoff, "cdd");
    if (!sv.valid) {
      writeHandoff(handoffPath, {
        task: 1, phase: "branch-review", status: "BLOCKED",
        commits: { base, head }, findings: [], artifacts: {},
        blocker: `branch-review handoff schema invalid: ${sv.reason} → fix and re-run branch-review`,
      });
      process.stderr.write(`CDD_BLOCKED: branch-review handoff schema invalid\n`);
      exitWithCode(1);
    }
  }

  exitOk();
}

// ---- fix dispatch ----

async function runFix(opts) {
  const { runTask } = await import("./lib/runner.mjs");
  // type=task fix: --findings is plumbed through runTask's `findingsPath` opt — the runner
  // overrides env.CDD_FINDINGS with the previous-phase handoff in fix mode, so the opt takes
  // precedence inside buildTaskEnv (otherwise --findings would be dead code).
  if (opts.type === "task") {
    if (!opts.plan) {
      process.stderr.write("cdd fix --type task: missing required --plan <path>\n");
      process.exit(2);
    }
    if (opts.task == null) {
      process.stderr.write("cdd fix --type task: missing required --task <n>\n");
      process.exit(2);
    }
    await runTask(opts.harness, parseInt(opts.task, 10), {
      mode: "fix", dryRun: DRY_RUN(),
      findingsPath: opts.findings,
      env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
    });
    return;
  }
  // spec/plan: fix template comes from reviews.json fixTemplate (Task 4); pre-Task-4,
  // reviewTypeConfig doesn't exist yet → fall back to the legacy spec-fix/plan-fix templates.
  if (opts.type !== "spec" && opts.type !== "plan") {
    process.stderr.write(`unknown fix --type: ${opts.type}\n`);
    process.exit(2);
  }
  if (!opts.doc) {
    process.stderr.write(`cdd fix --type ${opts.type}: missing required --doc <path>\n`);
    process.exit(2);
  }
  let template;
  try {
    const { reviewTypeConfig } = await import("./lib/templates.mjs");
    template = reviewTypeConfig(opts.type).fixTemplate;
  } catch {
    template = opts.type === "spec" ? "spec-fix" : "plan-fix";
  }
  const { runDocsTask } = await import("./lib/docs-runner.mjs");
  await runDocsTask({
    harness: opts.harness, mode: "fix", template, doc: opts.doc,
    findingsPath: opts.findings, workspace: docsReviewWorkspace(),
    repoRoot: gitToplevel(process.cwd()), dryRun: DRY_RUN(),
  });
}

// ---- select / research (inline of cdd-select.mjs / cdd-research.mjs action logic) ----

// detect_current_harness: CURSOR_TRACE_ID → cursor-agent; CLAUDE_CODE_SESSION_ID → claude;
// AI_AGENT=claude-code* → claude; otherwise empty.
function detectCurrentHarness(env) {
  if (env.CURSOR_TRACE_ID) return "cursor-agent";
  if (env.CLAUDE_CODE_SESSION_ID) return "claude";
  if ((env.AI_AGENT ?? "").startsWith("claude-code")) return "claude";
  return "";
}

function runSelect() {
  const detected = detectInstalledHarnesses(config, { env: process.env });
  const available = detected.filter((h) => h.installed && h.channel === "install-and-use").map((h) => h.name);
  const unsupported = detected.filter((h) => h.installed && h.channel !== "install-and-use").map((h) => h.name);

  if (available.length === 0) {
    process.stdout.write("available:\n");
    process.stdout.write(`unsupported_installed:${unsupported.join(",")}\n`);
    process.stdout.write("recommended:\n");
    process.stderr.write(`BLOCKED: no full harness installed (registry: ${detected.map((h) => h.name).join(" ")} )\n`);
    exitBlocked();
  }

  // Recommendation priority: droid > pi > current harness (full) > first alphabetic available.
  let recommended = "";
  if (available.includes("droid")) {
    recommended = "droid";
  } else if (available.includes("pi")) {
    recommended = "pi";
  } else {
    const current = detectCurrentHarness(process.env);
    if (current && available.includes(current)) recommended = current;
    else recommended = available[0];
  }

  process.stdout.write(`available:${available.join(",")}\n`);
  process.stdout.write(`unsupported_installed:${unsupported.join(",")}\n`);
  process.stdout.write(`recommended:${recommended}\n`);
}

// Standalone research runner (spawnCapture, not invokeCli — research output is written verbatim).
async function runResearch(opts) {
  const NAME = "cdd research";

  // Brief validation (before the harness gate — pure file check, no PATH dependency).
  let briefContent;
  try {
    briefContent = readFileSync(opts.brief, "utf8");
  } catch (err) {
    process.stderr.write(`${NAME}: cannot read brief: ${err.message}\n`);
    exitBlocked();
  }

  // Harness registry gate.
  let entry;
  try {
    const reg = loadRegistry(process.env.CDD_REGISTRY_PATH || REG_PATH);
    entry = checkHarness(reg, opts.harness, { dryRun: DRY_RUN() });
  } catch (err) {
    if (err instanceof CddBlockedError) {
      if (err.kind === "cli-missing") exitCliMissing(err.message);
      exitBlocked(err.message);
    }
    process.stderr.write(`${NAME}: ${err.message}\n`);
    exitWithCode(err.exitCode ?? 1);
  }

  const prompt = buildResearchPrompt(briefContent);

  // Dry-run short-circuit (argument parsing / smoke tests only).
  if (DRY_RUN()) exitOk();

  const cli = entry.cli;
  const cliArgs = [...entry.invoke.split(/\s+/).filter(Boolean), prompt];
  const timeoutMs = resolveTimeoutMs(process.env, "research");

  let result;
  try {
    // #137 subprocess-security posture: strip credentials from the harness env.
    const secureEnv = { ...process.env };
    delete secureEnv.ANTHROPIC_API_KEY;
    delete secureEnv.CLAUDE_CODE_SUBAGENT_MODEL;
    result = await spawnCapture(cli, cliArgs, { cwd: process.cwd(), env: secureEnv, timeoutMs });
  } catch (err) {
    process.stderr.write(`${NAME}: spawn error: ${err.message}\n`);
    exitWithCode(1);
  }

  // Timeout path: write partial findings + TIMEOUT frontmatter + exit 1.
  if (result.timedOut) {
    process.stderr.write(`${NAME}: timeout after ${timeoutMs}ms\n`);
    writeFindings(opts.output, `${result.stdout}\n---\nstatus: TIMEOUT\n`);
    exitWithCode(1);
  }

  if (!result.ok) {
    process.stderr.write(`${NAME}: harness failed (exit ${result.code})\n`);
    if (result.stderr) process.stderr.write(result.stderr);
    exitWithCode(1);
  }

  writeFindings(opts.output, result.stdout);
  exitOk();
}

// ---- commander program ----

const program = new Command();
// Configure BEFORE registering subcommands: Commander copies exitOverride / output
// configuration to each subcommand at creation time (copyInheritedSettings), so a
// subcommand's parse error would otherwise fall through to Commander's own
// process.exit(1) instead of our usage + exit 2.
program.exitOverride();
program.configureOutput({ outputError: () => {} });
program
  .name("cdd")
  .description("CDD engine CLI — implement/review/fix/select/research/brief/contract")
  .helpOption("-h, --help", "display help for command");

// --- implement (formerly cdd-task --mode implement) ---
program
  .command("implement")
  .requiredOption("--harness <name>", "harness name")
  .requiredOption("--task <n>", "task number")
  .option("--plan <path>", "plan file path")
  .action(async (opts) => {
    const { runTask } = await import("./lib/runner.mjs");
    await runTask(opts.harness, parseInt(opts.task, 10), {
      mode: "implement",
      dryRun: DRY_RUN(),
      env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
    });
  });

// --- review (formerly cdd-task --mode task-review / docs-task review / branch-review) ---
program
  .command("review")
  .requiredOption("--type <t>", "task|branch|spec|plan")
  .requiredOption("--harness <name>", "harness name")
  .option("--task <n>", "task number (type=task)")
  .option("--doc <path>", "document path (type=spec|plan)")
  .option("--plan <path>", "plan path")
  .option("--base <sha>", "base commit (type=task|branch)")
  .option("--head <sha>", "head commit (type=task|branch)")
  .option("--round <n>", "round backfill (validate against engine auto-increment)")
  .action(async (opts) => {
    await runReview(opts);
  });

// --- fix (formerly cdd-task --mode fix / docs-task fix) ---
program
  .command("fix")
  .requiredOption("--type <t>", "task|spec|plan")
  .requiredOption("--harness <name>", "harness name")
  .option("--task <n>", "task number (type=task)")
  .option("--findings <path>", "findings handoff path for this fix round")
  .option("--doc <path>", "document path (type=spec|plan)")
  .option("--plan <path>", "plan path")
  .action(async (opts) => {
    await runFix(opts);
  });

// --- select / research (inline action logic; no library module) ---
program
  .command("select")
  .description("Detect installed harness CLIs and recommend default")
  .action(() => { runSelect(); });

program
  .command("research")
  .description("Standalone research runner (independent of implement/review)")
  .requiredOption("--harness <name>", "harness name")
  .requiredOption("--brief <path>", "path to research brief markdown")
  .requiredOption("--output <path>", "path to write findings markdown")
  .action(async (opts) => {
    await runResearch(opts);
  });

// --- brief / contract (delegated to lib module CLI entries) ---
program
  .command("brief")
  .requiredOption("--task <n>", "task number")
  .requiredOption("--plan <path>", "plan path")
  .option("--output <path>", "brief output path")
  .action(() => runBriefCli(process.argv.slice(3)));

program
  .command("contract")
  .option("--check-dirty")
  .option("--check-head")
  .option("--handoff <path>")
  .option("--progress <path>")
  .option("--clear-findings")
  .action(() => runContractCli(process.argv.slice(3)));

// Only parse argv when executed as the main entry (imports from tests must be inert).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  program.parseAsync(process.argv).catch((e) => {
    if (e.code === "commander.helpDisplayed") {
      exitOk();
    }
    // Commander parse/usage errors (missing required option, unknown option, unknown command, ...) → usage + exit 2.
    if (typeof e.code === "string" && e.code.startsWith("commander.")) {
      usageError(process.argv[2]);
    } else {
      // Action errors → error message + exit 2.
      process.stderr.write(`${e.message}\n`);
    }
    exitCliMissing();
  });
}