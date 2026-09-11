// packages/cdd-engine/lib/cli/parse.mjs — Commander program definition（bin/cdd.mjs 薄入口的唯一命令面）。
// spec §2.3 拆分：program 装配（exitOverride / configureOutput / 子命令注册与 action）+ SUBCOMMAND_USAGE /
// usageError（parse 错误归一）归本文件；runReview/runFix/runResearch 为静态导入的 action 主体。
// 本文件可被测试静态读（cli-shape），import 后无副作用 —— parseAsync 由 bin/cdd.mjs 薄入口 isMain 触发。
import { Command } from "commander";

import { runReview } from "./review.mjs";
import { runFix } from "./fix.mjs";
import { runResearch } from "./research.mjs";
import { requireHostHarness, intTask, DRY_RUN } from "./review.mjs";
import { runBriefCli } from "../brief.mjs";

// Per-subcommand usage lines (print on parse/usage errors in place of Commander's own output).
const SUBCOMMAND_USAGE = {
  implement: "usage: cdd implement --task <n> [--plan <path>]",
  review: "usage: cdd review --type <task|branch|spec|plan> [--task <n>] (--plan <path> | --spec <path>) [--base <sha> --head <sha>] [--round <n>]",
  fix: "usage: cdd fix --type <task|spec|plan> [--task <n>] [--findings <path>] (--plan <path> | --spec <path>)",
  research: "usage: cdd research --brief <path> --output <path>",
  brief: "usage: cdd brief --task <n> --plan <path> [--output <path>]",
};

export function usageError(command) {
  process.stderr.write((SUBCOMMAND_USAGE[command] ?? "usage: cdd <command> [options]") + "\n");
}

const program = new Command();
// Configure BEFORE registering subcommands: Commander copies exitOverride / output
// configuration to each subcommand at creation time (copyInheritedSettings), so a
// subcommand's parse error would otherwise fall through to Commander's own
// process.exit(1) instead of our usage + exit 2.
program.exitOverride();
program.configureOutput({ outputError: () => {} });
program
  .name("cdd")
  .description("CDD engine CLI — implement/review/fix/research/brief")
  .helpOption("-h, --help", "display help for command");

// --- implement (formerly cdd-task --mode implement) ---
program
  .command("implement")
  .requiredOption("--task <n>", "task number", intTask)
  .option("--plan <path>", "plan file path")
  .action(async (opts) => {
    const harness = requireHostHarness();
    const { runTask } = await import("../runner/run-task.mjs");
    await runTask(harness, opts.task, {
      mode: "implement",
      dryRun: DRY_RUN(),
      env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
    });
  });

// --- review (consolidates the former cdd-task / docs-task / branch-review commands) ---
program
  .command("review")
  .requiredOption("--type <t>", "task|branch|spec|plan")
  .option("--task <n>", "task number (type=task)", intTask)
  .option("--plan <path>", "plan path (type=task|branch; type=plan: review target)")
  .option("--base <sha>", "base commit (type=task|branch)")
  .option("--head <sha>", "head commit (type=task|branch)")
  .option("--round <n>", "round backfill (validate against engine auto-increment)")
  .option("--spec <path>", "spec document path (type=spec: review target; type=plan: upstream reference pointer)")
  .action(async (opts) => {
    await runReview(opts);
  });

// --- fix (formerly cdd-task --mode fix / docs-task fix) ---
program
  .command("fix")
  .requiredOption("--type <t>", "task|spec|plan")
  .option("--task <n>", "task number (type=task)", intTask)
  .option("--findings <path>", "findings handoff path for this fix round")
  .option("--spec <path>", "spec document path (type=spec)")
  .option("--plan <path>", "plan path (type=task|plan)")
  .action(async (opts) => {
    await runFix(opts);
  });

// --- select removed (T2): harness selection/detection/install layer deleted — registry
//     converged to claude/cursor-agent; research remains (inline action logic; no library module).
program
  .command("research")
  .description("Standalone research runner (independent of implement/review)")
  .requiredOption("--brief <path>", "path to research brief markdown")
  .requiredOption("--output <path>", "path to write findings markdown")
  .action(async (opts) => {
    await runResearch(opts);
  });

// --- brief (delegated to lib module CLI entry; Commander opts → 结构化 argv，不二次解析 process.argv) ---
program
  .command("brief")
  .requiredOption("--task <n>", "task number")
  .requiredOption("--plan <path>", "plan path")
  .option("--output <path>", "brief output path")
  .action((opts) => runBriefCli([
    "--task", String(opts.task),
    "--plan", opts.plan,
    ...(opts.output ? ["--output", opts.output] : []),
  ]));

export { program };