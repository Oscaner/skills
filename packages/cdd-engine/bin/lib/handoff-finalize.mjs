// packages/cdd-engine/bin/lib/handoff-finalize.mjs — handoff 载体定稿单点（T7）：
// agent 内容 → 定稿 handoff → 全量替换写盘 → H1 重发。与 handoff-naming 平级（定稿是独立关切）。
// 架构：engine 是载体唯一作者（T5/T6/T7 统一），agent 只贡献内容分片（findings/blocker/artifacts/notes）。
// 按 canonical family `status` 规则分派（plan-constraints「status 单一权威」）：
//   review.* → rollup 派生（applyDerivedStatus；SP-4 失败轮次豁免）；
//   implement → 实体化（无 agentHandoff 输入槽位——残留无通道附着；T6 实体化逻辑迁入本模块）；
//   fix       → work 型：agent 声明保留，契约在 commit-contract 层否决。
// 无残留兼容层：不为「agent 写残缺 handoff」这一在正确模型下不存在的路径写任何维护逻辑
// （runner 8.8 的 implement 门控 + writeOwnHandoff 全量覆盖从结构上消灭该路径）。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { applyDerivedStatus, gitRevParseHead, readJson, writeOwnHandoff } from "./contract.mjs";

// 定稿单点入口：按 mode 分派返回 { handoff, exitCode }。H1 由消费方从定稿 h1FromHandoff 重发。
// 三消费方（runner.mjs step 13 / docs-runner.mjs 读回 / cdd.mjs branch review 读回）共享同一实现。
export function finalizeHandoff({ mode, h1 = [], agentHandoff = null, brief, repoRoot, workspace, taskNum } = {}) {
  if (mode === "review") {
    const derived = applyDerivedStatus(agentHandoff ?? {});
    if (derived) return { handoff: derived, exitCode: 0 };
    return { handoff: agentHandoff, exitCode: 0 };
  }
  if (mode === "implement") {
    // 输入无 agentHandoff 槽位：从 H1 + brief TASK_BASE + git HEAD 实体化（T6 逻辑迁入）。
    // evidence-gate（behavior_change:true → hard）保留；H1 从定稿重发。
    return finalizeImplement({ h1, brief, repoRoot, workspace, taskNum });
  }
  if (mode === "fix") {
    // work 型：agent 声明保留，契约在 commit-contract 层否决（validateCommitContract）。
    return { handoff: agentHandoff, exitCode: 0 };
  }
  throw new Error(`finalizeHandoff: unknown mode ${mode}`);
}

// 定稿写回单点（branch nit③：docs-runner/runner 共用，去重两处近-verbatim write-back）：
//   finalized.handoff 与 local 同引用（派生无变化）→ skip 写盘（不产生 no-op 覆盖），返回 false；
//   否则 writeOwnHandoff 全量覆盖 + sync local.status 到定稿值，返回 true。
export function persistFinalized(handoffPath, local, finalized) {
  if (!finalized?.handoff || finalized.handoff === local) return false;
  writeOwnHandoff(handoffPath, finalized.handoff);
  local.status = finalized.handoff.status;
  return true;
}

// ---- implement 实体化（T6 实体化块迁入，保持现有 behavior）----
// readJson 收口 contract.mjs（T7 nit2：三处私有副本统一单点）。

// TASK_BASE → implement commits.base 唯一权威。brief 缺失 / 无 TASK_BASE 行 → null
//（降级不实体化：dry-run 与 smoke 链均走此处，绝不允许 ENOENT 崩溃 runner）。
function taskBaseFromBrief(briefPath) {
  if (!briefPath || !existsSync(briefPath)) return null;
  try {
    return readFileSync(briefPath, "utf8").match(/^TASK_BASE: (\S+)/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

// H1 `artifacts:` 行（key=value 空白分隔）→ artifacts 对象；缺行/空值 → {}。
function artifactsFromH1Line(line) {
  const m = String(line).match(/^artifacts:\s*(.*)$/);
  if (!m || !m[1].trim()) return {};
  const artifacts = {};
  for (const pair of m[1].trim().split(/\s+/)) {
    const eq = pair.indexOf("=");
    if (eq > 0) artifacts[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return artifacts;
}

// H1 `status:` 行 → 实体化 status。schema 只收 APPROVED/BLOCKED —— 非 APPROVED
//（NEEDS_CONTEXT / <missing> 等）一律折叠为 BLOCKED，raw 供 blocker 透传（H1 与 handoff/exit 一致）。
function implementStatusFromH1(line) {
  const raw = String(line).replace(/^status:\s*/, "").trim();
  return { status: raw === "APPROVED" ? "APPROVED" : "BLOCKED", raw };
}

// H1 `blocker:` 行 → blocker。缺行（<missing>）/ 成功缺省（none）→ ""（不落 blocker 字段，
// h1FromHandoff 按 defaultBlockerFor(status) 缺省呈显层）。
function h1Blocker(line) {
  const v = String(line).replace(/^blocker:\s*/, "").trim();
  return v && v !== "<missing>" && v !== "none" ? v : "";
}

// Evidence gate（仅 implement 非 dry-run 实体化路径）：机械硬档唯一触发源 = test-evidence 的
// behavior_change:true（brief.mjs 只输出 ### Task N 段 + TASK_BASE 行，仓库无复杂度档位机械来源）。
// hard → 覆写 BLOCKED；其余（simple / 无 behavior_change / 文件缺失不可解析）→ soft WARN 注记。
function evidenceGate(workspace, taskNum) {
  const ev = readJson(path.join(workspace, `task-${taskNum}-test-evidence.json`));
  if (!ev) return { hard: false, warn: `test-evidence missing or unparseable for task ${taskNum} (soft WARN)` };
  if (ev.behavior_change !== true) return { hard: false, warn: "" };
  const missing = ["command", "passed", "exit_code"].filter((k) => !(k in ev));
  if (missing.length > 0) {
    return { hard: true, warn: `test_evidence gate: hard 要求 command/passed/exit_code (missing: ${missing.join(", ")})` };
  }
  return { hard: false, warn: "" };
}

// 实体化：brief TASK_BASE → commits.base（唯一权威）；git HEAD → commits.head（repoRoot 可 null → 省略 head）。
// 降级 fail-open：brief 缺失 / 无 TASK_BASE → { handoff: null, exitCode: 0 }（不实体化；runner
// 保留 agent 原样 H1，stderr CDD_WARN 注记）。hard gate / status BLOCKED → exitCode 1。
export function finalizeImplement({ h1 = [], brief, repoRoot, workspace, taskNum }) {
  const base = taskBaseFromBrief(brief);
  if (!base) {
    process.stderr.write(`CDD_WARN: implement handoff not materialized — brief missing or no TASK_BASE line: ${brief}\n`);
    return { handoff: null, exitCode: 0 };
  }
  // T6 nit3: 解构命名替代 h1[0]/[2]/[3] 魔数下标（commits 行按设计忽略——实体化 head 以 git 权威）。
  const [statusLine, , artifactsLine, blockerLine] = h1;
  const { status, raw } = implementStatusFromH1(statusLine ?? "");
  let blocker = h1Blocker(blockerLine ?? "");
  if (raw !== "APPROVED" && !blocker) blocker = `implement H1 status "${raw}" without blocker`;
  const head = repoRoot ? gitRevParseHead(repoRoot) : null;
  const gate = evidenceGate(workspace, taskNum);
  if (gate.hard) {
    blocker = gate.warn;
    // hard gate → CDD_BLOCKED 诊断（对齐 runner 旧实现 finish(…, gate.warn, …) 的 stderr 输出）。
    process.stderr.write(`CDD_BLOCKED: ${gate.warn}\n`);
  } else if (gate.warn) {
    process.stderr.write(`CDD_WARN: ${gate.warn}\n`);
  }
  const handoff = {
    task: taskNum,
    phase: "implement",
    status: gate.hard ? "BLOCKED" : status,
    artifacts: artifactsFromH1Line(artifactsLine ?? ""),
    findings: [],
    commits: { base, ...(head ? { head } : {}) },
  };
  if (blocker) handoff.blocker = blocker;
  const exitCode = gate.hard || handoff.status === "BLOCKED" ? 1 : 0;
  return { handoff, exitCode };
}
