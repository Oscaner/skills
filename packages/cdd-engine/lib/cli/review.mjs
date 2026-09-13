// packages/cdd-engine/lib/cli/review.mjs — `cdd review`（task/branch/spec/plan 四型派发）。
// spec §2.3 拆分（原 bin/cdd.mjs 合并面）：review 分发归本文件；共享 host 检测 + Stopping 守卫簇
// （detectCurrentHarness/requireHostHarness/DRY_RUN/intTask/resolveTargetDoc/blockerCount/
// stoppedExit3/reviewStoppingGuard）已迁 lib/cli/shared.mjs（spec §2.6 拆 shared，闭包完备性定归属），
// 4 消费方（fix/parse/branch-review/research）与本文件经 shared 复用（单一 host 事实源）。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../registry.mjs";
import { renderTemplate, reviewTypeConfig, reviewArtifactConfig, reviewHardGate } from "../templates.mjs";
import * as handoffNaming from "../handoff/naming.mjs";
import { hashFile } from "../runner/review-loop.mjs";
import { gitToplevel } from "../contract/commit.mjs";
import { exitWithCode } from "../exit.mjs";
import { withLifecycle } from "../lifecycle/proc.mjs";
import { DRY_RUN, requireHostHarness, resolveTargetDoc, reviewStoppingGuard } from "./shared.mjs";

// ---- review-specific helpers ----

// Docs workspace 全走 handoff-naming.resolveWorkspace(doc)（.superpowers/cdd/<slug>/，slug 经 slugRule
// 派生；Phase-0 flat root 已废弃，engine 代码零引用）。
export function existingRoundHandoff(ws, type, round) {
  if (round < 1) return null;
  const p = path.join(ws, handoffNaming.handoffName("review", type, { round }));
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    // corrupt prev → 视为无 prev（fail-open：不因 corrupted prev 锁死重审；最坏多一轮 review，绝不自锁）。
    // P4 健壮性 hardening：诊断落 stderr，避免静默吞错（corrupt 的 round-1 被忽略时，重派为何未触发
    // Stopping 锁定对用户透明）。
    process.stderr.write(`CDD_INFO: corrupt prev handoff ${p} ignored → fail-open (new review round)\n`);
    return null;
  }
}

// review --type task 的 task workspace 派生（task 派生点：与 run-task resolveWorkspace 同源 workspaceSlug）。
// plan 文件名 → <repoRoot>/<workspaceRoot>/<slug>——slug 经 handoff-naming.workspaceSlug 收敛
// （-design/-plan 单层 strip），基路径经 workspaceRoot 常量（不硬编码字面量），两派生点防分叉回归
// 见 tests/cli-shared.test.mjs（§2.9 row 6）。导出为纯函数（test seam）：gitToplevel 由调用方注入。
export function taskReviewWorkspace(plan, repoRoot) {
  return path.join(repoRoot, handoffNaming.workspaceRoot, handoffNaming.workspaceSlug(plan));
}

// ---- review dispatch ----

// 导出（测试 seam）：cdd.test.mjs 注入 docs-runner mock 断言 runDocsTask 参数。
export async function runReview(opts) {
  return withLifecycle(async () => {
  // Host harness gate — harness 不再由 CLI 参数传入（T3），由环境 host 判定并向下传入。
  const harness = requireHostHarness();
  // type=branch: independent git-diff-level path (former branch-review bin action + AC15 wiring).
  if (opts.type === "branch") {
    if (!opts.plan) {
      process.stderr.write("cdd review --type branch: missing required --plan <path>\n");
      exitWithCode(2);
    }
    // --base/--head were requiredOption in the old branch-review bin; the inline keeps
    // that contract — missing values would otherwise render garbage ("undefin" file slugs  + undefined in H1).
    if (!opts.base || !opts.head) {
      process.stderr.write("cdd review --type branch: missing required --base <sha> and --head <sha>\n");
      exitWithCode(2);
    }
    const { runBranchReview } = await import("./branch-review.mjs");   // lazy: breaks review↔branch-review import cycle
    return await runBranchReview({ ...opts, harness });
  }

  if (opts.type === "spec" || opts.type === "plan") {
    // D11: type-self-describing target param — type=spec reviews the --spec doc;
    // type=plan reviews the --plan doc (optional --spec carries the upstream reference).
    const doc = resolveTargetDoc(opts, "review");
    const { runDocsTask } = await import("../runner/run-docs.mjs");
    // spec/plan: round = engine auto-increment（canonical review.{type} 族模式扫描）；--round only
    // validates backfill (conflict → exit 2).
    const ws = handoffNaming.resolveWorkspace(doc);
    const round = handoffNaming.resolveNextRound(ws, "review", opts.type);
    if (opts.round && Number(opts.round) !== round) {
      process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
      exitWithCode(2);
    }
    const prev = existingRoundHandoff(ws, opts.type, round - 1);
    // Stopping ref 状态绑定位（spec §2.3.2）：同路径 + 同 doc_hash → 同 ref（U1 硬停）；
    // 内容演进 → 新 ref（自动放行新一轮）；legacy（无 doc_hash）→ 内容状态未知 → 保险硬停（§2.2 bullet 3）。
    // BLOCKED/TIMEOUT 失败轮无视 hash 无声放行（SP-4）。
    if (prev && (prev.doc_path ?? "") === doc) {
      const docHash = hashFile(doc);
      const legacy = prev.doc_hash == null;
      const contentSame = !legacy && prev.doc_hash === docHash;
      if (legacy || contentSame) {
        reviewStoppingGuard(prev, opts.type, round, doc, { reason: legacy ? "legacy" : "unchanged" });
      } else if (prev.status === "APPROVED" && docHash) {
        // 内容演进 + 既有 clean review → 新 ref → 放行 + 自文档化。
        // docHash 空串哨兵（ghost doc，§2.4）不印 CDD_INFO —— 已删文档非「演进」：静默放行、下游自然失败。
        process.stderr.write(`CDD_INFO: doc content changed since round-${round - 1} clean review (${prev.doc_hash.slice(0, 8)} → ${docHash.slice(0, 8)}) → new review round ${round}\n`);
      }
    }
    // review 模板数据化 — spec/plan 走共享壳 review.md（reviews.json type=spec|plan 配置）。
    // REFERENCE 注入具体 doc 路径（cfg.ref "doc vs spec" 是关系概念，类比 task/branch 的 git-range
    // 符号经具体化注入）；内容占位（lensEnum/axesGuide）由 reviews.json 配置注入，artifact 参数
    // （HANDOFF_TYPE/RETURN_MODE）读 canonical review.{type} 族（renderTemplate 缺参即抛）。
    const cfg = reviewTypeConfig(opts.type);
    const art = reviewArtifactConfig(opts.type);
    const handoffPath = path.join(ws, handoffNaming.handoffName("review", opts.type, { round }));
    await runDocsTask({
      harness, mode: "review", template: "review", type: opts.type, doc,
      handoffPath,
      params: {
        TYPE: opts.type,
        LENS_GUIDE: cfg.lensEnum.join(" · "),
        WORKSPACE: ws,
        REFERENCE: doc,
        AXES: cfg.axesGuide,
        RETURN_MODE: art.return,
        HANDOFF_TYPE: art.schema,
        H1_BLOCK: "",
        // type=plan: PLAN_LINE 注入上游 spec 参照；type=spec 无 plan 参照，保持空串。
        PLAN_LINE: opts.type === "plan" && opts.spec ? `**Spec:** ${opts.spec}` : "",
        HARD_GATE: reviewHardGate(art.return, handoffPath),
      },
      workspace: ws, repoRoot: gitToplevel(process.cwd()),
      dryRun: DRY_RUN(),
    });
    return;
  }

  // type=task: task review (runner internally tracks task-N-review-{R}.json round sequence).
  if (opts.type !== "task") {
    process.stderr.write(`unknown review --type: ${opts.type}\n`);
    exitWithCode(2);
  }
  if (!opts.plan) {
    process.stderr.write("cdd review --type task: missing required --plan <path> (workspace slug + Stopping)\n");
    exitWithCode(2);
  }
  if (opts.task == null) {
    process.stderr.write("cdd review --type task: missing required --task <n>\n");
    exitWithCode(2);
  }
  // Workspace slug derives from the plan filename (workspaceSlug 收敛 -design/-plan 单层 strip);
  // task Stopping reads the latest task-{N}-review-{R}.json and rejects when its blockers = 0.
  const taskWs = taskReviewWorkspace(opts.plan, gitToplevel(process.cwd()));
  // task round 经 canonical 派生层 type-aware resolveNextRound 推导（op/type 四参签名；
  // 显式透传 {task} pin → 防 scan 形态 {task}→\d+ 跨 task 混计 rounds）。
  const nextTaskRound = handoffNaming.resolveNextRound(taskWs, "review", "task", { task: opts.task });
  // --round 校验回填（task 侧：next round 推导值；冲突 exit 2，对齐 spec/plan/branch）。
  if (opts.round && Number(opts.round) !== nextTaskRound) {
    process.stderr.write(`--round ${opts.round} ≠ engine round ${nextTaskRound}\n`);
    exitWithCode(2);
  }
  if (nextTaskRound > 1) {
    const prevR = nextTaskRound - 1;
    // Stopping prev 读同族 round-1 算术（canonical review.task 名 → task-{N}-review-{prevR}.json）。
    // 不得用 prevHandoffPath：该函数对此族解析跨族 prev 表（round1=implement / fix:R-1），
    // 会读到实体化 implement 的 APPROVED+[] → Stopping 误锁。
    const th = JSON.parse(readFileSync(path.join(taskWs, handoffNaming.handoffName("review", "task", { task: opts.task, round: prevR })), "utf8"));
    reviewStoppingGuard(th, "task", prevR, opts.plan);   // only APPROVED+blocker=0 stops (SP-4)
  }
  const { runTask } = await import("../runner/run-task.mjs");
  await runTask(harness, opts.task, {
    mode: "review", dryRun: DRY_RUN(),
    env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
  });
  });
}
