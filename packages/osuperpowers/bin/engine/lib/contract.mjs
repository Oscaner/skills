// engine/lib/contract.mjs — CDD commit-contract validator + handoff write（Node port of
// cdd_validate_commit_contract / _cdd_rewrite_handoff_blocked + skills/cli-driven-development/docs/handoff-schema.md 写入）。
// classifySeverity / rollupStatus / markDeferred 是 severity→status+deferred 决策的 Node 钉死契约
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

// 对齐 _cdd_rewrite_handoff_blocked：把 handoff 重写为 status=BLOCKED + blocker。文件不存在 → no-op。
export function rewriteHandoffBlocked(handoffPath, reason) {
  if (handoffPath && existsSync(handoffPath)) {
    writeHandoff(handoffPath, { status: "BLOCKED", blocker: reason });
  }
}

// ---- severity 契约 ----

// severity → 决策。契约钉死（spec D1/D4/D5a）：
//   "blocker" → "CHANGES_REQUESTED"；"warn"|"nit" → "deferred"（APPROVED 且 findings deferred）；
//   "unverifiable" / "needs_context" → "STOP"（BLOCKED）。未知 → 抛错（契约违规）。
export function classifySeverity(sev) {
  const s = String(sev).toLowerCase().replaceAll("-", "_");
  switch (s) {
    case "blocker":
      return "CHANGES_REQUESTED";
    case "warn":
    case "nit":
      return "deferred";
    case "unverifiable":
    case "needs_context":
      return "STOP";
    default:
      throw new Error(`unknown severity: ${sev}`);
  }
}

// findings[] roll-up → handoff status（对齐 handoff-schema「Severity → status mapping」表）：
//   空 → APPROVED；仅 warn/nit（deferred）→ APPROVED；含 blocker → CHANGES_REQUESTED；
//   unverifiable[] / plan_conflicts[] 非空 → BLOCKED。
export function rollupStatus(findings = [], unverifiable = [], planConflicts = []) {
  if (unverifiable.length > 0 || planConflicts.length > 0) return "BLOCKED";
  const hasBlocker = findings.some((f) => f?.severity === "blocker");
  return hasBlocker ? "CHANGES_REQUESTED" : "APPROVED";
}

// 任何 warn/nit finding 无条件标 deferred:true（防止 minor 被错误拖入 fix loop）。
export function markDeferred(findings = []) {
  return findings.map((f) =>
    f?.severity === "warn" || f?.severity === "nit" ? { ...f, deferred: true } : f,
  );
}

// ---- commit-contract validator ----

// Core commit-contract validator（spec §4.2，port cdd_validate_commit_contract）。
// mode implement/fix 才校验；task-review → no-op。非 git / git-error → fail-open。
// 两个正交信号：dirty working tree（D2）；干净树但 handoff.commits.head ≠ 真实 HEAD（F1）。
// 任一击中 → rewriteHandoffBlocked + 返回 { ok:false, blocker }。
// repoRoot = 传入目录（对齐 `git -C "${CDD_WORKSPACE:-.}"`）；handoff 路径取 opts.handoffPath
// 或 env CDD_HANDOFF_PATH。head 校验对齐 bash：无哨兵特殊值（dry-run 不写 handoff，
// 任何 handoff.commits.head ≠ 真实 HEAD 一律视为 mismatch）。
export function validateCommitContract(mode, repoRoot, opts = {}) {
  if (mode !== "implement" && mode !== "fix") return { ok: true, blocker: "" };
  const handoffPath = opts.handoffPath ?? process.env.CDD_HANDOFF_PATH ?? "";

  const root = gitToplevel(repoRoot);
  if (!root) return { ok: true, blocker: "" };
  const porcelain = gitStatusPorcelain(root);
  if (porcelain === null) return { ok: true, blocker: "" };

  if (porcelain === "") {
    // 干净树：校验 handoff 的 commits.head 是否等于真实 HEAD（F1）。
    const handoffHead = safeParse(handoffPath)?.commits?.head;
    if (handoffHead) {
      const actualHead = gitRevParseHead(root);
      if (actualHead && handoffHead !== actualHead) {
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
