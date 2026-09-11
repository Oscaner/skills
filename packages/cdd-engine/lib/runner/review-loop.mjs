import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// engine/lib/review-loop.mjs — shared review→fix loop (CDD + docs).
// runReviewLoop → Promise<handoff>
// runFix(round, findings) → Promise<handoff>
// getBlockers(handoff) → finding[]
// onRoundDone(round, findings) → void (optional)

// Wiring model:
// - CDD orchestrator (AI following CDD SKILL.md): calls `cdd review --type task`
//   then `cdd fix --type task` directly, following the Review Stopping digraph.
//   runReviewLoop is available for test harnesses and future CLI wrappers.
// - Docs orchestrator (AI following brainstorming/writing-plans SKILL.md): calls
//   `cdd review --type spec|plan` then `cdd fix --type spec|plan`.
// Production wiring is via the AI orchestrator making tool calls, not via Node imports.
// This module provides: (a) a testable reference implementation, (b) a shared abstraction
//   for future cdd-run-review.mjs / docs-run-review.mjs CLI wrappers.

// T9 branch nit④: round-pattern 派生已移交 handoff-naming（T3 后生产统一走
// `handoff-naming.roundPattern/resolveNextRound`；reviewRoundPattern/resolveNextRound
// 薄委托已删 — 不再保留第二命名面）。

export function reviewStoppedError(type, round, ref) {
  return new Error(
    `round ${round} (${type}, ${ref}) already blocker=0 — Review Stopping: do not re-run; change ref to open a new review`,
  );
}

// 内容状态 token（spec §2.1/§2.3.1）：被审文档的全字节 sha256 hex。
// 尺度选择（§2.2 bullet 1）：不归一化——白空格/行尾异动会触发新一轮，单轮 review dispatch 是良性代价。
// 缺失/读失败 → "" 哨兵（与真实 hex 永不等）：gate 按「ref 变了」放行，下游 runDocsTask 对幽灵 doc 自然失败。
export function hashFile(doc) {
  try {
    return createHash("sha256").update(readFileSync(doc)).digest("hex");
  } catch {
    return "";
  }
}

export async function runReviewLoop({ runReview, runFix, getBlockers, onRoundDone }) {
  let round = 1;
  while (true) {
    const reviewHandoff = await runReview(round);
    const blockers = getBlockers(reviewHandoff);
    await runFix(round, reviewHandoff.findings ?? []);
    if (blockers.length === 0) {
      onRoundDone?.(round, reviewHandoff.findings ?? []);
      break;
    }
    round++;
  }
}
