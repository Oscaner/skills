// engine/lib/contract/commit.mjs — CDD commit-contract validator + git helpers（Node port of
// cdd_validate_commit_contract / _cdd_rewrite_handoff_blocked；spec §4.2 "commit-contract validator"）。
// contract.mjs 符号拆分（spec §2.3）：commit 五件（validateCommitContract / gitToplevel /
// gitRevParseHead / gitCatFileCommitExists / rewriteHandoffBlocked）归本文件；
// readJson/writeHandoff 现从 ../handoff/write.mjs 导入（唯一鉴权实现，无本地副本）。
import { execFileSync } from "node:child_process";

import { writeHandoff } from "../handoff/write.mjs";
import { readJson } from "../handoff/write.mjs";

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

// 对齐 _cdd_rewrite_handoff_blocked：把 handoff 重写为 status=BLOCKED + blocker + artifacts: {}。
// Guard: 当 handoffPath 为空/未定义时 no-op（caller 未提供 path，不写文件）。
export function rewriteHandoffBlocked(handoffPath, reason) {
  if (!handoffPath) return;
  writeHandoff(handoffPath, { status: "BLOCKED", blocker: reason, artifacts: {} });
}

// ---- commit-contract validator ----

// Core commit-contract validator（spec §4.2，port cdd_validate_commit_contract）。
// T8: 全 task mode 接线 —— implement/fix 校验 dirty + head（F1）；review（归一后）
//     仅校验 dirty（review handoff 的 commits 语义为被审 commit，非本 dispatch 产物 → 跳过 head）。
//     非三种 mode → no-op。非 git / git-error / 无 repoRoot → fail-open。
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
    const handoffHead = readJson(handoffPath)?.commits?.head;
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