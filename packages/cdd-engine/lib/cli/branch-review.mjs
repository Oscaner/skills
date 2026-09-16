// packages/cdd-engine/lib/cli/branch-review.mjs — `cdd review --type branch`（原 branch-review bin 动作体）。
// spec §2.3 拆分：runBranchReview + writeBranchBlocked 归本文件。AC15 round sequence + Review
// Stopping（previous-round lookup filtered by base7..head7 embedded in the filename）。
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../registry.mjs";
import { renderTemplate, reviewTypeConfig, reviewArtifactConfig, REVIEW_H1_BLOCK, reviewHardGate, renderHandoffStub } from "../templates.mjs";
import * as handoffNaming from "../handoff/naming.mjs";
import { validateHandoffSchema, loadHandoffSchema, recoverHandoff } from "../handoff/schema.mjs";
import { writeHandoff, writeOwnHandoff } from "../handoff/write.mjs";
import { finalizeHandoff } from "../handoff/finalize.mjs";
import { getRoot } from "../root.mjs";
import { invokeCliWithRetry, resolveTimeoutMs } from "../lifecycle/cli.mjs";
import { withLifecycle } from "../lifecycle/proc.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../exit.mjs";
import { DRY_RUN, reviewStoppingGuard } from "./shared.mjs";
import { h1CountersLine } from "../state/progress.mjs";

// BLOCKED 写盘单点。T5：`findings` 入参（默认 `[]`）+ `baseHandoff` = 已解析出的 handoff
// （schema 无效分支传入归一化结果）→ writeOwnHandoff 全量覆盖，违规键不留盘、findings 全额保留。
// 另两处调用点（`:107` CLI 未写 handoff / `:115` exit 0 后无 handoff）无已解析内容可留 → 仍是 `[]`。
// review-3 finding 1（warn）：payload 不再 `...(baseHandoff ?? {})` spread（已声明键的 agent 原值
// 不得进载体）；`commits` 仅在 `base` 满足 schema 的 `^[0-9a-f]{40}$` 时写入——short 形 base（`abc1234`）
// 经 AC15 的 base7..head7 文件名承载，载体省略 commits 仍合法；BLOCKED 载荷必须恒过自家校验。
export function writeBranchBlocked(handoffPath, { base, head, code, reason, findings = [], baseHandoff = null }) {
  const fullBase = typeof base === "string" && /^[0-9a-f]{40}$/.test(base) ? base : null;
  const payload = {
    task: 1, phase: "branch-review", status: "BLOCKED",
    ...(fullBase ? { commits: { base: fullBase, ...(typeof head === "string" && head ? { head } : {}) } } : {}),
    findings,
    artifacts: {},
    blocker: reason ?? `cli exited ${code} without writing handoff`,
  };
  if (baseHandoff) writeOwnHandoff(handoffPath, payload);
  else writeHandoff(handoffPath, payload);
}

// Inline of the former branch-review bin action body, wired with AC15 round sequence +
// Review Stopping (previous-round lookup filtered by base7..head7 embedded in the filename;
// a ref change = a new review, never falsely rejected).
export async function runBranchReview(opts) {
  return withLifecycle(async () => {
  const { harness, plan, base, head } = opts;
  // 注册表路径测试缝（与 runTask 的 opts.registryPath 同形）：进程内用例注入 ghost registry，
  // 黑盒路径回落 REG_PATH 单源（engine 不自算第二来源）。
  const registryPath = opts.registryPath ?? REG_PATH;

  // Harness registry gate.
  let entry;
  try {
    entry = checkHarness(loadRegistry(registryPath), harness, { dryRun: DRY_RUN() });
  } catch (e) {
    if (e instanceof CddBlockedError) {
      process.stderr.write(`${e.message}\n`);
      e.kind === "cli-missing" ? exitCliMissing() : exitBlocked();
    }
    throw e;
  }

  // root 单一权威（lib/root.mjs）：initRoot() 已在 bin 的 preAction 内完成「非 git 仓 → BLOCKED exit 1」
  // 判定，故本处无守卫——getRoot() 恒返回非空串，空值回退（第二 root 来源）已随收口删净。
  // 根注入契约（P4 §2.3.1，与 runReview/runFix 同形）：进程内调用方经 opts.root 显式注入，
  // 黑盒路径回落 initRoot() 已初始化的单例——runReview 的 branch 分支转交本函数时原样透传 opts.root，
  // 此处若只读单例即形成「接受但忽略」的静默缝（未 initRoot() 的进程内调用方拿到 throw）。
  const repoRoot = opts.root ?? getRoot();
  const base7 = String(base).slice(0, 7);
  const head7 = String(head).slice(0, 7);
  // workspace 与其他 review 型同源：resolveWorkspace(plan)（.osuperpowers/cdd/<slug>/）。
  const workspace = handoffNaming.resolveWorkspace(plan, repoRoot);

  // AC15 wiring: per-ref round seq（ref 内嵌文件名 → resolveNextRound 传 concrete base7/head7
  // 做 per-ref 轮次，他 ref 的轮次不干扰本 ref）+ --round backfill 校验（conflict → exit 2）+
  // Stopping 读上一轮（prevHandoffPath concrete 匹配同一 ref）。
  const round = handoffNaming.resolveNextRound(workspace, "review", "branch", { base7, head7 });
  if (opts.round && Number(opts.round) !== round) {
    process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
    exitWithCode(2);
  }
  const prevPath = handoffNaming.prevHandoffPath(workspace, "review", "branch", round, { base7, head7 });
  const prev = prevPath && existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : null;
  // Stop only on an APPROVED round with blocker=0 (SP-4) — a BLOCKED/TIMEOUT branch review
  // round with findings:[] must be re-dispatchable, not rejected as "already done".
  if (prev) reviewStoppingGuard(prev, "branch", round, `${base7}..${head7}`);

  // Per-round handoff filename（canonical review.branch 族；branch-fix-loop re-reviews reuse distinct files）。
  const handoffPath = path.join(workspace, handoffNaming.handoffName("review", "branch", { base7, head7, round }));
  mkdirSync(workspace, { recursive: true });

  if (DRY_RUN()) {
    writeHandoff(handoffPath, {
      task: 1, phase: "branch-review", status: "APPROVED",
      commits: { base, head }, findings: [], artifacts: {}, blocker: "dry-run",
    });
    // T7（第三个 H1 生产者）：branch dry-run 的 H1 由数组拼接，末尾经 h1CountersLine(workspace) 追加
    // counters 第 5 行 —— 与 h1FourLines / h1FromHandoff 同源于 lib/state/progress.mjs#h1CountersLine
    //（唯一构造点）；不同步则 task 族 5 行、branch 族 4 行分叉（scripts/validate/smoke-cdd.mjs 的
    // 第 5 条 counters presence 断言即守此处）。workspace 已在 :72-75 的 writeHandoff 作用域内。
    const h1 = [
      "status: APPROVED",
      `commits: base=${base} head=${head}`,
      "artifacts: ",
      "blocker: dry-run",
      h1CountersLine(workspace),
    ];
    for (const line of h1) process.stdout.write(`${line}\n`);
    exitOk();
    return;
  }

  // branch review 走共享壳 review.md（reviews.json type=branch 内容配置 + canonical branch 族 artifact 参数）+ H1 四行合同。
  const cfg = reviewTypeConfig("branch");
  const art = reviewArtifactConfig("branch");
  let prompt = renderTemplate("review", {
    TYPE: "branch",
    WORKSPACE: workspace,
    LENS_GUIDE: cfg.lensEnum.join(" · "),
    REFERENCE: `${base}..${head}`,
    AXES: cfg.axesGuide,
    HANDOFF: handoffPath,
    HANDOFF_TYPE: art.schema,
    RETURN_MODE: art.return,
    H1_BLOCK: REVIEW_H1_BLOCK,
    PLAN_LINE: opts.plan ? `**Plan:** ${opts.plan}` : "",
    HARD_GATE: reviewHardGate(art.return, handoffPath),
  }, "cdd review");
  // HANDOFF_STUB：共享壳槽位在此路径须显式替换（docs 路径 runDocsTask 自理、runner 路径 renderModePrompt 自理）。
  // Task 18：stub = schema 原样注入（零 render；phase/review_scope/commits.base 等真值面已随
  // 手写 render 一并删除 —— 契约由 schema 本体 + 其 description 承载）。
  prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g,
    renderHandoffStub(loadHandoffSchema("task")));

  // Invoke harness CLI. (op,type) 注入解析到 prefix.review.branch（旧 branch-review 独立 bin 已删除，逻辑内联于此）。
  const timeoutMs = resolveTimeoutMs(process.env, "review");
  const res = await invokeCliWithRetry(entry, prompt, { op: "review", type: "branch" }, process.env, repoRoot, timeoutMs);

  if (!res.ok) {
    if (!existsSync(handoffPath)) {
      writeBranchBlocked(handoffPath, { base, head, code: res.code });
    }
    process.stderr.write(`CDD_BLOCKED: branch-review failed (exit ${res.code})\n`);
    exitWithCode(1);
  }

  // Agent exited 0 but never wrote the handoff — BLOCKED (mirrors runner step 10.5).
  if (!existsSync(handoffPath)) {
    writeBranchBlocked(handoffPath, { base, head, code: 0, reason: `${path.basename(handoffPath)} not written after exit 0 → re-run branch-review` });
    process.stderr.write(`CDD_BLOCKED: branch-review handoff not written\n`);
    exitWithCode(1);
  }

  // Agent wrote handoff — validate against the CDD schema (mirrors runner step 8.8).
  if (existsSync(handoffPath)) {
    const agentHandoff = JSON.parse(readFileSync(handoffPath, "utf8"));
    const sv = validateHandoffSchema(agentHandoff, "task");
    // T5 CONTRACT_VIOLATION 恢复（spec §2.5.2，AC7 类目级：branch 派发与 task/spec/plan 同策略）：
    // 归一化 → 重校验（最多一轮，不循环）。命中 → 写侧同源落盘 + 按归一化对象定稿；
    // 仍失败 → BLOCKED 且保留已解析出的 findings（此前硬编码 findings: []，即 A4 缺陷）。
    let handoff = agentHandoff;
    if (!sv.valid) {
      // 恢复单点 = lib/handoff/schema.mjs#recoverHandoff（归一化 → 重校验，最多一轮；违规键名后缀与
      // findings 数组守卫在那里写一次，本路径只保留自己的失败载荷差异）。
      const rec = recoverHandoff(agentHandoff, "task");
      if (!rec.valid) {
        writeBranchBlocked(handoffPath, {
          base, head, code: 0,
          baseHandoff: rec.handoff,
          findings: rec.preservedFindings,
          reason: `branch-review handoff schema invalid${rec.reason} → fix and re-run branch-review`,
        });
        process.stderr.write(`CDD_BLOCKED: branch-review handoff schema invalid\n`);
        exitWithCode(1);
      }
      writeOwnHandoff(handoffPath, rec.handoff);
      handoff = rec.handoff;
    }
    // T5/T7: status 单一权威 — branch review（review 族）读回经 finalizeHandoff 定稿（rollup 派生
    // 覆写，SP-4 豁免失败轮次）；定稿写盘用 writeOwnHandoff（engine 载体唯一作者，全量覆盖替换）。
    // 三消费方（runner/docs-runner/cdd）共享同一 finalizeHandoff 单点，非各自接线。
    const finalized = finalizeHandoff({ mode: "review", agentHandoff: handoff });
    if (finalized.handoff && finalized.handoff !== handoff) writeOwnHandoff(handoffPath, finalized.handoff);
  }

  exitOk();
  });
}
