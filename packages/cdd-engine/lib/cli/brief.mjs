// packages/cdd-engine/lib/cli/brief.mjs — `cdd brief` CLI 处理器（runBriefCli）。
// spec §2.6 归位：runBriefCli 自 lib/brief.mjs 迁出 —— CLI 处理器归 cli 簇，lib/brief.mjs 留纯
// 库模块（generateBrief/validateBrief，直调 guard 随迁本文件）。Commander 经 parse.mjs action 以
// 结构化 argv 转发；直接 node 调用（brief.test CLI 用例 + 手工）仍支持。
import { gitToplevel } from "../contract/commit.mjs";
import { exitWithCode, ExitRequested } from "../exit.mjs";
import { generateBrief } from "../brief.mjs";

export function runBriefCli(args) {
  const taskIdx = args.indexOf("--task");
  const planIdx = args.indexOf("--plan");
  const outputIdx = args.indexOf("--output");
  const taskNum = parseInt(args[taskIdx + 1]);
  const planPath = planIdx >= 0 ? args[planIdx + 1] : undefined;
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;

  try {
    const repoRoot = gitToplevel();
    generateBrief(planPath, taskNum, outputPath, repoRoot);
    process.stdout.write(JSON.stringify({ brief: outputPath }));
    exitWithCode(0);
  } catch (e) {
    // exit helpers throw ExitRequested —— 不得被本层 catch 误当成生成失败（Task 3 review warn 机制）。
    if (e instanceof ExitRequested) throw e;
    process.stderr.write(e.message);
    exitWithCode(1);
  }
}

// 直接 node 调用（brief.test CLI 用例等 fixture 路径）—— exit helpers throw ExitRequested，此处边界拦截 → exit(code)。
if (process.argv[1] && process.argv[1].endsWith("brief.mjs") && process.argv.length > 2) {
  try {
    runBriefCli(process.argv.slice(2));
  } catch (e) {
    if (e instanceof ExitRequested) process.exit(e.code);
    throw e;
  }
}