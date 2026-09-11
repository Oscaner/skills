// packages/cdd-engine/lib/cli/fix.mjs — `cdd fix`（task/spec/plan 三型）。
// spec §2.3 拆分（原 bin/cdd.mjs 合并面）：runFix 归本文件；共享守卫从 ./review.mjs 导入。
import path from "node:path";

import { requireHostHarness, resolveTargetDoc, DRY_RUN } from "./review.mjs";
import * as handoffNaming from "../handoff/naming.mjs";
import { gitToplevel } from "../contract/commit.mjs";

// 导出（测试 seam）：cdd.test.mjs 注入 docs-runner mock 断言 runDocsTask 参数。
export async function runFix(opts) {
  // Host harness gate — harness 不再由 CLI 参数传入（T3），由环境 host 判定并向下传入。
  const harness = requireHostHarness();
  const { runTask } = await import("../runner/run-task.mjs");
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
    await runTask(harness, opts.task, {
      mode: "fix", dryRun: DRY_RUN(),
      findingsPath: opts.findings,
      env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
    });
    return;
  }
  // spec/plan: fix 模板从 canonical fix.{type} 族读 fixTemplate（T2 裁轴后 reviews.json 不再承载 artifact）。
  if (opts.type !== "spec" && opts.type !== "plan") {
    process.stderr.write(`unknown fix --type: ${opts.type}\n`);
    process.exit(2);
  }
  // D11: type-self-describing target param — type=spec fixes the --spec doc;
  // type=plan fixes the --plan doc.
  const doc = resolveTargetDoc(opts, "fix");
  // fix round 从 --findings 源解析：roundPattern("review", type) 匹配 findings 文件名
  // （<type>-review-{R}.json）→ 提取 R 作为 fix 轮次（fix 输出 <type>-fix-{R}.json）。
  // findings 缺失或文件名不匹配 → 提示 + exit 2（无源不可推导轮次）。
  const findingsBase = opts.findings ? path.basename(opts.findings) : null;
  const roundMatch = findingsBase ? findingsBase.match(handoffNaming.roundPattern("review", opts.type)) : null;
  if (!roundMatch) {
    process.stderr.write(`cdd fix --type ${opts.type}: --findings must name a ${opts.type}-review-{R}.json file (round derived from the source review); got: ${opts.findings ?? "(missing)"}\n`);
    process.exit(2);
  }
  const fixRound = Number(roundMatch[1]);
  if (!Number.isInteger(fixRound) || fixRound < 1) {
    process.stderr.write(`cdd fix --type ${opts.type}: --findings round must be >= 1 (round derived from the source review); got: ${opts.findings}\n`);
    process.exit(2);
  }
  // fix 模板统一走 canonical fix.{type} 族 fixTemplate（spec/plan → "doc-fix" 共享壳）；
  // workspace 与 review 同源 resolveWorkspace(doc)；handoffPath 显式传 canonical fix.{type} 名。
  const template = handoffNaming.familyConfig("fix", opts.type).fixTemplate;
  const ws = handoffNaming.resolveWorkspace(doc);
  const { runDocsTask } = await import("../runner/run-docs.mjs");
  await runDocsTask({
    harness, mode: "fix", template, type: opts.type, doc,
    findingsPath: opts.findings, repoRoot: gitToplevel(process.cwd()), dryRun: DRY_RUN(),
    handoffPath: path.join(ws, handoffNaming.handoffName("fix", opts.type, { round: fixRound })),
  });
}