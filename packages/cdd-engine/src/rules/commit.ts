// packages/cdd-engine/src/rules/commit.ts — commit boundary double-gate judgment (Task 5
// rules-layer rebuild; spec §2.12 第二部分). THE task 5 "API bottom-swap" owner: the legacy
// hand-written git subprocess helpers of rules/commit.mjs are gone — every git answer here
// comes from infra/git.ts (simple-git single point, fail-open null/false on non-repo or git
// error, no exception crosses this seam).
//
//   Entry gate (pre-commit, P5-new): working tree must be clean before a dispatch starts;
//   dirty → BLOCKED signal { ok:false }. Mounting (dispatch/base.ts) is Task 7's — this module
//   only provides the judgment.
//   Exit gate (post-commit, T8-legacy): validateCommitContract — dirty tree → BLOCKED; for
//   implement/fix additionally handoff.commits.head must equal actual HEAD (F1); review skips
//   the head check (its commits describe the reviewed commit, not this dispatch's output).
//   Both failure arms rewrite the handoff to BLOCKED via rewriteHandoffBlocked.
//
// repoRoot is always the passed directory (mirrors `git -C <dir>`; a non-git workspace →
// fail-open ok, never a silent fallback to the caller's cwd). The handoff path is exclusively
// opts.handoffPath (derived by the engine through ctx — zero env channel).
import { gitTopLevel, gitRevParseHead, gitStatusPorcelain } from "../infra/git.ts";
import { writeHandoff, readJson } from "../artifacts/handoff/write.mjs";

export interface CommitGateResult {
  ok: boolean;
  blocker: string;
}

export interface CommitContractOptions {
  handoffPath?: string;
}

// Aligns with the legacy _cdd_rewrite_handoff_blocked: rewrite the handoff to
// status=BLOCKED + blocker + artifacts:{}. Guard: empty/undefined path → no-op (the caller did
// not provide a path; nothing written).
export function rewriteHandoffBlocked(handoffPath: string | undefined, reason: string): void {
  if (!handoffPath) return;
  writeHandoff(handoffPath, { status: "BLOCKED", blocker: reason, artifacts: {} });
}

// Entry gate judgment (spec §2.12): pre-commit clean-tree check — dispatch must start from a
// committed state so the exit gate can rely on a clean tree. Dirty → { ok:false, blocker } (the
// BLOCKED signal; the mount writes the blocked handoff / CDD_BLOCKED diagnostic). Non-git or
// git error → fail-open ok (same fail-open contract as the exit gate).
export async function entryGateCleanTree(
  repoRoot: string | null | undefined,
): Promise<CommitGateResult> {
  if (!repoRoot) return { ok: true, blocker: "" };
  const root = await gitTopLevel(repoRoot);
  if (!root) return { ok: true, blocker: "" };
  const porcelain = await gitStatusPorcelain(root);
  if (porcelain === null) return { ok: true, blocker: "" };
  if (porcelain !== "") {
    return { ok: false, blocker: "uncommitted changes at entry: dirty working tree — commit or discard changes before dispatch" };
  }
  return { ok: true, blocker: "" };
}

// Exit gate judgment (spec §4.2, port of the legacy validateCommitContract; bottom layer now
// simple-git). Two orthogonal signals: dirty working tree (D2); clean tree but
// handoff.commits.head ≠ actual HEAD (F1). Either hit → rewriteHandoffBlocked + { ok:false }.
// Non-git / git-error / no repoRoot → fail-open. Modes outside implement/fix/review → no-op.
// Head check only for implement/fix (review skips — its commits describe the reviewed range).
export async function validateCommitContract(
  mode: string,
  repoRoot: string | null | undefined,
  opts: CommitContractOptions = {},
): Promise<CommitGateResult> {
  if (mode !== "implement" && mode !== "fix" && mode !== "review") return { ok: true, blocker: "" };
  const handoffPath = opts.handoffPath ?? "";

  if (!repoRoot) return { ok: true, blocker: "" }; // direct-set non-git workspace → fail-open (never checks the caller's cwd)
  const root = await gitTopLevel(repoRoot);
  if (!root) return { ok: true, blocker: "" };
  const porcelain = await gitStatusPorcelain(root);
  if (porcelain === null) return { ok: true, blocker: "" };

  if (porcelain === "") {
    // Clean tree: the head check covers implement/fix only — review skips it.
    if (mode === "review") return { ok: true, blocker: "" };
    // Validate handoff.commits.head against actual HEAD (F1).
    // strict equal primary; prefix fallback for legacy 7-char handoffs (#186)
    const handoffHead = readJson(handoffPath)?.commits?.head as string | undefined;
    if (handoffHead) {
      const actualHead = await gitRevParseHead(root);
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