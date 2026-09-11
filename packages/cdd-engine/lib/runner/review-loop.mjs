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

// Review Stopping 错误单点（reason 分场景消息，§2.5 item 7/8）：
// - "legacy" — 无 doc_hash 的既有 handoff：内容状态未知 → 保险硬停，不给「改 doc」指引（不可达）。
// - "unchanged" — 同路径 + 同 doc_hash：内容未变 → 同 ref，提示改内容或开新 doc。
// - 缺省 — 无内容维度上下文（task/branch 族调用面）：保留现文案不变。
// 保持 `/blocker=0/` 前缀 + `Review Stopping:` 不变量（既有断言依赖）。
export function reviewStoppedError(type, round, ref, { reason } = {}) {
  const prev = Math.max(round - 1, 1);
  const tail = reason === "legacy"
    ? `Review Stopping: do not re-run — pre-content-hash review handoff (no doc_hash) at round ${prev}; content state unknown: open a new doc or remove the stale round-${prev} review handoff to re-review`
    : reason === "unchanged"
      ? `Review Stopping: do not re-run — doc content unchanged since round ${prev} clean review: edit the doc content or open a new doc to start a new review`
      : "Review Stopping: do not re-run; change ref to open a new review";
  return new Error(`round ${round} (${type}, ${ref}) already blocker=0 — ${tail}`);
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
