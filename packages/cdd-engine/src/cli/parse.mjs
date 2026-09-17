// packages/cdd-engine/src/cli/parse.mjs — Commander program definition（src/bin.ts 薄入口的唯一命令面）。
// spec §2.3 拆分：program 装配（exitOverride / configureOutput / 子命令注册与 action）+ SUBCOMMAND_USAGE /
// usageError（parse 错误归一）归本文件；runReview/runFix 为静态导入的 action 主体。
// 本文件可被测试静态读（cli-shape），import 后无副作用 —— parseAsync 由 bin/cdd.mjs 薄入口 isMain 触发。
import { Command } from "commander";

import { runReview } from "./review.mjs";
import { runFix } from "./fix.mjs";
import { requireHostHarness, intTask, DRY_RUN } from "./shared.mjs";
import { runBaseBranchSet, runBaseBranchGet } from "./base-branch.mjs";

// Per-subcommand usage lines (print on parse/usage errors in place of Commander's own output).
const SUBCOMMAND_USAGE = {
  implement: "usage: cdd implement --task <n> [--plan <path>]",
  review: "usage: cdd review --type <task|branch|spec|plan> [--task <n>] (--plan <path> | --spec <path>) [--base <sha> --head <sha>] [--round <n>]",
  fix: "usage: cdd fix --type <task|spec|plan> [--task <n>] [--findings <path>] (--plan <path> | --spec <path>)",
  // base-branch: usageError 只读 process.argv[2] 首 token —— 二级命令 (set/get) 的坏 flag/未知
  // 子命令全部回退到 base-branch 单词键这一行，双词键 `base-branch set` 永不可达。
  "base-branch": "usage: cdd base-branch <set|get> --plan <path> [set: --base <branch> --source <source>] [--force]",
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
  .description("CDD engine CLI — implement/review/fix/base-branch")
  .option("--dry-run", "simulate without writing handoff artifacts")
  .helpOption("-h, --help", "display help for command");

// --- implement (formerly cdd-task --mode implement) ---
program
  .command("implement")
  .requiredOption("--task <n>", "task number", intTask)
  .option("--plan <path>", "plan file path")
  .action(async (opts) => {
    const harness = requireHostHarness();
    const { runTask } = await import("../dispatch/task.mjs");
    await runTask(harness, opts.task, {
      mode: "implement",
      dryRun: DRY_RUN(),
      planFile: opts.plan,
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
//     converged to claude/cursor-agent.

// --- base-branch (P5 spec §2.3): 纯 artifact 命令 —— 单一 --plan 目标 base-branch.json 读写（无 harness/lifecycle 依赖）。
//    set: --base <branch> --source <enum> --plan <path> [--force]
//    get: --plan <path>
//    flag 边界（缺 --plan → 明确报错）裁决在 base-branch.mjs resolveBaseBranchWorkspace 单一落点。
const baseBranch = program
  .command("base-branch")
  .description("read/write base-branch.json (single CDD --plan target)");

baseBranch
  .command("set")
  .option("--base <branch>", "base branch name")
  .option("--source <source>", "base-branch source (plan-field|branch-upstream|conversation-context|user-confirmed)")
  .option("--plan <path>", "plan file → resolveWorkspace(plan)")
  .option("--force", "override an existing base-branch with a different base")
  .action(async (opts) => { await runBaseBranchSet(opts); });

baseBranch
  .command("get")
  .option("--plan <path>", "plan file → resolveWorkspace(plan)")
  .action(async (opts) => { await runBaseBranchGet(opts); });

export { program };
