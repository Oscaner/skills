// packages/cdd-engine/lib/cli/shared.mjs — 共享 host 检测 + Review Stopping 守卫簇（多消费方复用）。
// spec §2.6 拆分：detectCurrentHarness/requireHostHarness/DRY_RUN/intTask/resolveTargetDoc/
// blockerCount/stoppedExit3/reviewStoppingGuard 自 lib/cli/review.mjs 迁出——归属按**闭包完备性**定：
// reviewStoppingGuard 内部调用 stoppedExit3 + blockerCount + reviewStoppedError（自 runner/review-loop
// import），三者须随迁以避免 shared→review 反向依赖；existingRoundHandoff 仅 runReview 消费 → 留
// review.mjs 私有（review.mjs runReview 仍经本簇导入，shared 零反向依赖）。
import { reviewStoppedError } from "../runner/review-loop.mjs";
import { exitWithCode } from "../exit.mjs";

export const DRY_RUN = () => process.env.CDD_DRY_RUN === "1";

// ---- host harness detection ----

// detect_current_harness: CURSOR_TRACE_ID → cursor-agent; CLAUDE_CODE_SESSION_ID → claude;
// AI_AGENT=claude-code* → claude; otherwise empty. T3 扩展：唯一 host 事实源（空 → BLOCK）。
// Exported (test seam) — the CLI resolves the harness here and no longer accepts a harness flag.
export function detectCurrentHarness(env) {
  if (env.CURSOR_TRACE_ID) return "cursor-agent";
  if (env.CLAUDE_CODE_SESSION_ID) return "claude";
  if ((env.AI_AGENT ?? "").startsWith("claude-code")) return "claude";
  return "";
}

// Host harness gate: 全部子命令 action 的唯一 harness 来源（CLI 负责解析，runner 签名不动）。
// 空 host → CDD_BLOCKED + exit 1 —— cdd 必须从受支持的 harness 会话内运行，registry 由该 host 键查找。
export function requireHostHarness() {
  const harness = detectCurrentHarness(process.env);
  if (!harness) {
    process.stderr.write("CDD_BLOCKED: no host harness detected (run cdd from within a supported harness)\n");
    exitWithCode(1);
  }
  return harness;
}

// ---- review/fix shared helpers ----

// D11（review/fix 共享）：被审目标解析 + 缺参守卫单点。type=spec → --spec（被审文档本身）；
// type=plan → --plan（被审 plan，可选 --spec 携带上游参照）；缺参 → `cdd <verb> --type <type>:
// missing required --<type> <path>` + exit 2。runReview / runFix 双调用点共用，禁止重复。
export function resolveTargetDoc(opts, verb) {
  const doc = opts.type === "spec" ? opts.spec : opts.plan;
  if (!doc) {
    process.stderr.write(`cdd ${verb} --type ${opts.type}: missing required --${opts.type} <path>\n`);
    exitWithCode(2);
  }
  return doc;
}

// Bug A (legacy cdd-task contract): --task must parse as an integer. Rejects NaN at parse
// time (exit 2 + message) instead of letting parseInt leak NaN into runTask and fabricate
// task-NaN-* artifacts with a false APPROVED H1 (STD-3).
export function intTask(v) {
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`--task must be an integer, got: ${v}`);
  return n;
}

export function blockerCount(handoff) {
  return (handoff?.findings ?? []).filter((f) => f?.severity === "blocker").length;
}

// Review Stopping: reject a re-dispatch of a (type, ref) whose previous round reached
// APPROVED with blocker=0. A failure round (status BLOCKED/TIMEOUT) is NOT "done" — it
// must be re-dispatchable, so the gate requires status === "APPROVED" in addition to
// blockerCount === 0 (SP-4): runner 8.5/8.8/10/10.5 and docs-runner failure paths write
// status:BLOCKED|TIMEOUT with findings:[] → blockerCount alone would misjudge them as passed.
export function stoppedExit3(type, round, ref, blocker, opts) {
  const e = reviewStoppedError(type, round, ref, opts);   // structured error + message, single authority
  process.stderr.write(`${e.message}\n` + (blocker ? `last blocker: ${blocker}\n` : ""));
  exitWithCode(3);
}

// Unified Stopping gate: only APPROVED + blocker=0 stops a re-run; a BLOCKED/TIMEOUT failure
// round (findings:[]) must stay re-dispatchable (SP-4). ref is the type's target signature.
// opts 透传 reviewStoppedError reason（legacy/unchanged）——task/branch 调用面无 opts → 缺省文案不变。
export function reviewStoppingGuard(prev, type, round, ref, opts) {
  if (prev && prev.status === "APPROVED" && blockerCount(prev) === 0) stoppedExit3(type, round, ref, prev?.blocker, opts);
}
