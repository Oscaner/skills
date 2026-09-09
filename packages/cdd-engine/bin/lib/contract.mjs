// engine/lib/contract.mjs — CDD commit-contract validator + handoff write（Node port of
// cdd_validate_commit_contract / _cdd_rewrite_handoff_blocked + skills/cli-driven-development/docs/handoff-schema.md 写入）。
// classifySeverity / rollupStatus 是 severity→status 决策的 Node 钉死契约
// （spec D1/D4/D5a；port 自 cdd-severity-contract.test.sh 的语义而非其 grep 散文）。
// runner.mjs（T2）在嵌套 CLI 失败时用 writeHandoff 捕获 stderr 进 blocker（唯一 sanctioned divergence）。
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ---- git helpers（行为对齐 `git -C <dir> ...`；命令失败 → null，fail-open）----

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// git repo root（对齐 `_cdd_repo_root`：`git rev-parse --show-toplevel`；失败 → null）。
export function gitToplevel(cwd) {
  return git(["rev-parse", "--show-toplevel"], cwd);
}

// git HEAD（`git rev-parse HEAD`；失败 → null）。
export function gitRevParseHead(cwd) {
  return git(["rev-parse", "HEAD"], cwd);
}

// git cat-file -e 验证 SHA 是否为真实可达的 commit 对象（#200 phantom SHA 防护）；返回 boolean。
export function gitCatFileCommitExists(sha, cwd) {
  if (!sha) return false;
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function gitStatusPorcelain(cwd) {
  return git(["status", "--porcelain"], cwd);
}

// ---- handoff read/write ----

function safeParse(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// 按 skills/cli-driven-development/docs/handoff-schema.md 写 handoff。已有文件 → 浅合并（H6 链 update 语义：
// review/validator 改 status/blocker 时保留 task/commits/findings 等字段）。
// 父目录不存在自动创建；返回合并后的完整对象。
export function writeHandoff(handoffPath, data) {
  const existing = existsSync(handoffPath) ? safeParse(handoffPath) : null;
  const merged = { ...(existing ?? {}), ...data };
  mkdirSync(path.dirname(handoffPath), { recursive: true });
  writeFileSync(handoffPath, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

// 对齐 _cdd_rewrite_handoff_blocked：把 handoff 重写为 status=BLOCKED + blocker + artifacts: {}。
// Guard: 当 handoffPath 为空/未定义时 no-op（caller 未提供 path，不写文件）。
export function rewriteHandoffBlocked(handoffPath, reason) {
  if (!handoffPath) return;
  writeHandoff(handoffPath, { status: "BLOCKED", blocker: reason, artifacts: {} });
}

// ---- severity 契约 ----

// handoff status 归一化（T2: runner.mjs validator 归一化）：
// DONE/OK/COMPLETED → APPROVED；其余不变（UNKNOWN/MISSING/CHANGES_REQUESTED/BLOCKED 保持原行为）。
export function normalizeHandoffStatus(status) {
  switch (status) {
    case "DONE":
    case "OK":
    case "COMPLETED":
      return "APPROVED";
    default:
      return status;
  }
}

// severity → 决策。契约钉死（spec D1/D4/D5a）：
//   "blocker" → "CHANGES_REQUESTED"；"warn"|"nit" → "APPROVED"（warn/nit 同样全量进入 fix loop 修复）；
//   "unverifiable" / "needs_context" → "STOP"（BLOCKED）。未知 → 抛错（契约违规）。
export function classifySeverity(sev) {
  const s = String(sev).toLowerCase().replaceAll("-", "_");
  switch (s) {
    case "blocker":
      return "CHANGES_REQUESTED";
    case "warn":
    case "nit":
      return "APPROVED";
    case "unverifiable":
    case "needs_context":
      return "STOP";
    default:
      throw new Error(`unknown severity: ${sev}`);
  }
}

// findings[] roll-up → handoff status（对齐 handoff-schema「Severity → status mapping」表）：
//   空 → APPROVED；仅 warn/nit → APPROVED；含 blocker → CHANGES_REQUESTED；
//   unverifiable[] / plan_conflicts[] 非空 → BLOCKED。
export function rollupStatus(findings = [], unverifiable = [], planConflicts = []) {
  if (unverifiable.length > 0 || planConflicts.length > 0) return "BLOCKED";
  const hasBlocker = findings.some((f) => f?.severity === "blocker");
  return hasBlocker ? "CHANGES_REQUESTED" : "APPROVED";
}

// ---- review 型 handoff status 派生（T5 status 单一权威）----

// review 型 handoff status 派生（唯 engine 权威）：schema 校验后由 findings roll-up 覆写 agent 声明的 status。
// SP-4 豁免：失败轮次（engine 自写 BLOCKED/TIMEOUT、agent status ∈ {BLOCKED, TIMEOUT}）不覆写。
// 仅 findings.length > 0 时触发 rollup（plan-constraints「status 单一权威」）；findings 空时
// CHANGES_REQUESTED（0 blocker）→ APPROVED（URC：无 findings 即无 blocker），APPROVED 空载保持，缺省 → APPROVED。
export function deriveReviewStatus(handoff = {}) {
  const { status, findings = [], unverifiable = [] } = handoff;
  // schema 字段为 snake_case：plan_conflicts（勿解构 camelCase planConflicts — 永空）
  const planConflicts = handoff.plan_conflicts ?? [];
  if (status === "BLOCKED" || status === "TIMEOUT") return status;
  if (findings.length === 0) return status === "CHANGES_REQUESTED" ? "APPROVED" : status ?? "APPROVED";
  return rollupStatus(findings, unverifiable, planConflicts);
}

// 读回路径统一入口：status 需覆写 → 返回覆写后的新 handoff（原对象不变）；无变化 → null（caller 不写盘）。
export function applyDerivedStatus(handoff = {}) {
  const d = deriveReviewStatus(handoff);
  return d === handoff.status ? null : { ...handoff, status: d };
}

// ---- commit-contract validator ----

// Core commit-contract validator（spec §4.2，port cdd_validate_commit_contract）。
// T7: 全 task mode 接线 —— implement/fix 校验 dirty + head（F1）；review（归一后 task-review）
//     仅校验 dirty（review handoff 的 commits 语义为被审 commit，非本 dispatch 产物 → 跳过 head）。
//     非三种 mode（含旧名 task-review）→ no-op。非 git / git-error / 无 repoRoot → fail-open。
// 两个正交信号：dirty working tree（D2）；干净树但 handoff.commits.head ≠ 真实 HEAD（F1）。
// 任一击中 → rewriteHandoffBlocked + 返回 { ok:false, blocker }。
// repoRoot = 传入目录（对齐 `git -C "${CDD_WORKSPACE:-.}"`，direct-set 非 git workspace → null
//   即 fail-open，不得回退检查 caller cwd）；handoff 路径取 opts.handoffPath 或 env CDD_HANDOFF_PATH。
// head 校验对齐 bash：无哨兵特殊值（dry-run 不写 handoff，任何 handoff.commits.head ≠ 真实 HEAD
// 一律视为 mismatch）。
export function validateCommitContract(mode, repoRoot, opts = {}) {
  if (mode !== "implement" && mode !== "fix" && mode !== "review") return { ok: true, blocker: "" };
  const handoffPath = opts.handoffPath ?? process.env.CDD_HANDOFF_PATH ?? "";

  if (!repoRoot) return { ok: true, blocker: "" }; // 直接-set 非 git workspace → fail-open（不得误检 caller cwd）
  const root = gitToplevel(repoRoot);
  if (!root) return { ok: true, blocker: "" };
  const porcelain = gitStatusPorcelain(root);
  if (porcelain === null) return { ok: true, blocker: "" };

  if (porcelain === "") {
    // 干净树：head 校验仅 implement/fix —— review 跳过（commits = 被审 commit，非本 dispatch 产物）。
    if (mode === "review") return { ok: true, blocker: "" };
    // 干净树：校验 handoff 的 commits.head 是否等于真实 HEAD（F1）。
    // strict equal primary; prefix fallback for legacy 7-char handoffs (#186)
    const handoffHead = safeParse(handoffPath)?.commits?.head;
    if (handoffHead) {
      const actualHead = gitRevParseHead(root);
      if (actualHead && handoffHead !== actualHead && !actualHead.startsWith(handoffHead)) {
        const blocker = `handoff commits.head ${handoffHead} does not match HEAD ${actualHead} (${mode})`;
        rewriteHandoffBlocked(handoffPath, blocker);
        return { ok: false, blocker };
      }
    }
    return { ok: true, blocker: "" };
  }

  const blocker = `uncommitted changes at return (${mode}): dirty working tree`;
  rewriteHandoffBlocked(handoffPath, blocker);
  return { ok: false, blocker };
}
