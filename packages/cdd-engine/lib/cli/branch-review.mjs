// packages/cdd-engine/lib/cli/branch-review.mjs — `cdd review --type branch`（原 branch-review bin 动作体）。
// spec §2.3 拆分：runBranchReview + writeBranchBlocked 归本文件。AC15 round sequence + Review
// Stopping（previous-round lookup filtered by base7..head7 embedded in the filename）。
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../registry.mjs";
import { renderTemplate, reviewTypeConfig, reviewArtifactConfig, REVIEW_H1_BLOCK, reviewHardGate, renderHandoffStub } from "../templates.mjs";
import * as handoffNaming from "../handoff/naming.mjs";
import { validateHandoffSchema, loadHandoffSchema } from "../handoff/schema.mjs";
import { writeHandoff, writeOwnHandoff } from "../handoff/write.mjs";
import { gitToplevel } from "../contract/commit.mjs";
import { finalizeHandoff } from "../handoff/finalize.mjs";
import { invokeCliWithRetry, resolveTimeoutMs } from "../lifecycle/cli.mjs";
import { withLifecycle } from "../lifecycle/proc.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../exit.mjs";
import { DRY_RUN, reviewStoppingGuard } from "./shared.mjs";

export function writeBranchBlocked(handoffPath, { base, head, code, reason }) {
  writeHandoff(handoffPath, {
    task: 1, phase: "branch-review", status: "BLOCKED",
    commits: { base, head }, findings: [], artifacts: {},
    blocker: reason ?? `cli exited ${code} without writing handoff`,
  });
}

// Inline of the former branch-review bin action body, wired with AC15 round sequence +
// Review Stopping (previous-round lookup filtered by base7..head7 embedded in the filename;
// a ref change = a new review, never falsely rejected).
export async function runBranchReview(opts) {
  return withLifecycle(async () => {
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
  const base7 = String(base).slice(0, 7);
  const head7 = String(head).slice(0, 7);
  // workspace 与其他 review 型同源：resolveWorkspace(plan)（.superpowers/cdd/<slug>/）。
  const workspace = handoffNaming.resolveWorkspace(plan);

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
    process.stdout.write(`status: APPROVED\ncommits: base=${base} head=${head}\nartifacts: \nblocker: dry-run\n`);
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
  prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g,
    renderHandoffStub(loadHandoffSchema("cdd"), "review", 1, {}));

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
    const sv = validateHandoffSchema(agentHandoff, "cdd");
    if (!sv.valid) {
      writeBranchBlocked(handoffPath, { base, head, code: 0, reason: `branch-review handoff schema invalid: ${sv.reason} → fix and re-run branch-review` });
      process.stderr.write(`CDD_BLOCKED: branch-review handoff schema invalid\n`);
      exitWithCode(1);
    }
    // T5/T7: status 单一权威 — branch review（review 族）读回经 finalizeHandoff 定稿（rollup 派生
    // 覆写，SP-4 豁免失败轮次）；定稿写盘用 writeOwnHandoff（engine 载体唯一作者，全量覆盖替换）。
    // 三消费方（runner/docs-runner/cdd）共享同一 finalizeHandoff 单点，非各自接线。
    const finalized = finalizeHandoff({ mode: "review", agentHandoff });
    if (finalized.handoff && finalized.handoff !== agentHandoff) writeOwnHandoff(handoffPath, finalized.handoff);
  }

  exitOk();
  });
}
