// packages/cdd-engine/src/rules/commit.ts — commit boundary double-gate judgment (Task 5
// rules-layer rebuild; spec §2.12 第二部分). THE task 5 "API bottom-swap" owner: the legacy
// hand-written git subprocess helpers of rules/commit.mjs are gone — every git answer here
// comes from infra/git.ts (simple-git single point, fail-open null/false on non-repo or git
// error, no exception crosses this seam).
//
//   Entry gate (pre-commit, P5-new): working tree must be clean before a dispatch starts;
//   dirty → BLOCKED signal { ok:false }. Mounting (dispatch/base.ts) is Task 7's — this module
//   only provides the judgment. P6 T10 (E2②/G4①): the judgment ALSO knows dry-run — a dirty tree
//   under dryRun downgrades to a warn (not the BLOCKED signal), because a zero-side-effect
//   simulation cannot be corrupted by uncommitted changes; real dispatch keeps the hard BLOCKED.
//   Exit gate (post-commit, T8-legacy): validateCommitContract — dirty tree → BLOCKED; for
//   implement/fix additionally handoff.commits.head must equal actual HEAD (F1); review skips
//   the head check (its commits describe the reviewed commit, not this dispatch's output).
//   Both failure arms rewrite the handoff to BLOCKED via rewriteHandoffBlocked.
//
// repoRoot is always the passed directory (mirrors `git -C <dir>`; a non-git workspace →
// fail-open ok, never a silent fallback to the caller's cwd). The handoff path is exclusively
// opts.handoffPath (derived by the engine through ctx — zero env channel).
import { gitTopLevel, gitRevParseHead, gitStatusPorcelain } from "../infra/git.ts";
import { writeHandoff, readJson } from "../artifacts/handoff/write.ts";

export interface CommitGateResult {
  ok: boolean;
  blocker: string;
  /** set only by the entry gate's dry-run downgrade (E2②): dirty tree + dryRun → warn instead
   * of the BLOCKED signal; the mount prints it as a stderr CDD_WARN and continues. */
  warn?: string;
}

export interface CommitContractOptions {
  handoffPath?: string;
}

export interface EntryGateOptions {
  /** dry-run (simulation): the entry gate keeps its information value but downgrades the dirty
   * BLOCK to a warn — a zero-side-effect simulation cannot be corrupted by uncommitted changes
   * (E2② / G4①; spec §2.12 第二部分 dry-run 门判 WARN 化). Real dispatch keeps the hard BLOCKED. */
  dryRun?: boolean;
}

/** Warning text for the dry-run downgrade (E2②). Single definition shared by the judgment and
 * tests. */
export const DRY_RUN_DIRTY_WARN =
  "working tree contains uncommitted changes; dry-run is pure simulation and unaffected, but real dispatch requires a clean tree";

/** Exit-gate dirty-tree blocker marker, composed into the validateCommitContract blocker. The
 * docs exit-gate stdout diagnosis (dispatch/docs.ts commitPostCheck) and the determinism tests match
 * on this marker; keeping it shared means a future rewording of the blocker cannot silently drop
 * the commit-before-returning guidance. */
export const UNCOMMITTED_RETURN_MARKER = "uncommitted changes at return";

// Aligns with the legacy _cdd_rewrite_handoff_blocked: rewrite the handoff to
// status=BLOCKED + blocker + artifacts:{}. Guard: empty/undefined path → no-op (the caller did
// not provide a path; nothing written).
export function rewriteHandoffBlocked(handoffPath: string | undefined, reason: string): void {
  if (!handoffPath) return;
  writeHandoff(handoffPath, { status: "BLOCKED", blocker: reason, artifacts: {} });
}

// Shared fail-open resolver for both gates — single definition of the three absent conditions
// (no repoRoot / non-repo gitTopLevel / gitStatusPorcelain null → absent) so the entry and exit
// gates' fail-open arms cannot drift independently in this high-risk rules layer. present →
// { root, porcelain }: root is the resolved git top-level, reused by the exit gate's head check
// (no second gitTopLevel call).
type CleanTreeResolution =
  | { present: false }
  | { present: true; root: string; porcelain: string };

async function resolveCleanTree(
  repoRoot: string | null | undefined,
): Promise<CleanTreeResolution> {
  if (!repoRoot) return { present: false };
  const root = await gitTopLevel(repoRoot);
  if (!root) return { present: false };
  const porcelain = await gitStatusPorcelain(root);
  if (porcelain === null) return { present: false };
  return { present: true, root, porcelain };
}

// Entry gate judgment (spec §2.12): pre-commit clean-tree check — dispatch must start from a
// committed state so the exit gate can rely on a clean tree. Dirty → { ok:false, blocker } (the
// BLOCKED signal; the mount writes the blocked handoff / CDD_BLOCKED diagnostic) — EXCEPT on the
// dry-run path (E2②): dryRun downgrades the dirty BLOCK to a warn (`warn` field; the mount prints
// a stderr CDD_WARN and the simulation runs to completion — a zero-side-effect dry run cannot be
// corrupted by uncommitted changes, and the downgrade keeps the gate's information value rather
// than skipping it). Non-git or git error → fail-open ok (same fail-open contract as the exit gate).
export async function entryGateCleanTree(
  repoRoot: string | null | undefined,
  opts: EntryGateOptions = {},
): Promise<CommitGateResult> {
  const tree = await resolveCleanTree(repoRoot);
  if (!tree.present) return { ok: true, blocker: "" };
  if (tree.porcelain !== "") {
    if (opts.dryRun) {
      return { ok: true, blocker: "", warn: DRY_RUN_DIRTY_WARN };
    }
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

  // Any absent condition (no repoRoot / non-repo / git error) → fail-open. A direct-set non-git
  // workspace never checks the caller's cwd.
  const tree = await resolveCleanTree(repoRoot);
  if (!tree.present) return { ok: true, blocker: "" };

  if (tree.porcelain === "") {
    // Clean tree: the head check covers implement/fix only — review skips it.
    if (mode === "review") return { ok: true, blocker: "" };
    // Validate handoff.commits.head against actual HEAD (F1).
    // strict equal primary; prefix fallback for legacy 7-char handoffs (#186)
    const handoffHead = (((readJson(handoffPath) as Record<string, unknown> | null)?.commits as Record<string, unknown> | undefined)?.head) as string | undefined;
    if (handoffHead) {
      const actualHead = await gitRevParseHead(tree.root);
      if (actualHead && handoffHead !== actualHead && !actualHead.startsWith(handoffHead)) {
        const blocker = `handoff commits.head ${handoffHead} does not match HEAD ${actualHead} (${mode})`;
        rewriteHandoffBlocked(handoffPath, blocker);
        return { ok: false, blocker };
      }
    }
    return { ok: true, blocker: "" };
  }

  const blocker = `${UNCOMMITTED_RETURN_MARKER} (${mode}): dirty working tree`;
  rewriteHandoffBlocked(handoffPath, blocker);
  return { ok: false, blocker };
}
