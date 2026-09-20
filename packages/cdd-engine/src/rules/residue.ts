// packages/cdd-engine/src/rules/residue.ts — residue settlement (settleResidue): the single
// judgment-and-preserve point for a failed dispatch's leftover working-tree residue. An eligible
// failure (recovery cause ∈ the preserved set below) with a dirty tree gets its residue stashed
// (git stash push -u — pure object-store preservation, zero ref pollution) and the recovery
// carrier gains residue_ref / wip_stat / preserved. CONTRACT_VIOLATION-class causes are
// deliberately NOT in the set: discipline failures surface explicitly, never auto-swallowed.
// The eligibility set is derived from FAILURE_CATEGORIES — no hand-written category literals
// (same AC14 discipline as rules/failure.ts); a canonical category added later becomes eligible
// only by explicit edit here.
import { readJson, writeHandoff } from "../artifacts/handoff/write.ts";
import { FAILURE_CATEGORIES } from "./failure.ts";
import { gitStashPreserve, type WipStat } from "../infra/git.ts";
import path from "node:path";

/** Recovery-carrier causes whose residue the engine auto-preserves: EXECUTION_FAILURE (agent died
 * before writing its handoff — exit 1 / SIGTERM 143) and TIMEOUT (budget / liveness stall). The
 * recovery-quota consumer pair (incrementRecovery) — preservation follows the same frontier. */
export const RESIDUE_PRESERVED_CAUSES: ReadonlyArray<string> = [
  FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
  FAILURE_CATEGORIES.TIMEOUT.id,
];

/** True when `cause` is a preserved class (recovery-eligible). null / undefined / unknown → false. */
export function recoveryEligible(cause: string | null | undefined): boolean {
  return typeof cause === "string" && RESIDUE_PRESERVED_CAUSES.includes(cause);
}

/**
 * Preserve a failed round's residue into the recovery carrier:
 *   1. read the carrier — no handoff / no recovery / ineligible cause / already preserved → null
 *      (fail-open, zero output);
 *   2. dirty tree → `git stash push -u` with a round annotation
 *      (`cdd residue: <cause> <handoff basename>` — the stash list's human pointer);
 *   3. write residue_ref + wip_stat + preserved=true back into the carrier's recovery object
 *      (structure in the carrier, prose stays in the blocker — T23 same-law).
 * Returns the stash facts when preserved, null otherwise.
 */
export async function preserveRoundResidue(
  handoffPath: string,
  repoRoot: string | null,
): Promise<{ ref: string; wip: WipStat } | null> {
  if (!repoRoot) return null;
  const carrier = readJson(handoffPath);
  if (!carrier) return null;
  const recovery = carrier.recovery;
  if (!recovery || typeof recovery !== "object") return null;
  const rec = recovery as Record<string, unknown>;
  if (!recoveryEligible(typeof rec.cause === "string" ? rec.cause : undefined)) return null;
  // Already-preserved rounds never double-stash (preserveRoundResidue is re-runnable).
  if (rec.preserved === true) return null;

  const message = `cdd residue: ${String(rec.cause)} ${path.basename(handoffPath)}`;
  // The engine-authored carrier is pass-through residue: exclude it from the stash snapshot
  // when it lives inside the repo (path.relative starts with ".." when it's outside — no
  // exclusion needed, it can't be stashed anyway). Keeps the WIP stat to the agent's residue
  // only and lets `git stash apply` restore the full diff against the surviving carrier.
  const relative = path.relative(repoRoot, handoffPath);
  const exclude = relative === "" || relative.startsWith("..") || path.isAbsolute(relative) ? undefined : relative;
  const res = await gitStashPreserve(repoRoot, message, exclude);
  if (!res) return null; // clean tree / git error → nothing preserved

  rec.residue_ref = res.ref;
  rec.wip_stat = res.wip;
  rec.preserved = true;
  writeHandoff(handoffPath, carrier);
  return res;
}

/** preserveRoundResidue + a stderr CDD_WARN announcement. Shared by the base settleResidue template
 * step AND the branch failure lanes (which abort via exitWithCode and never reach the template
 * step — they call this inline before exiting). One announcement shape, no per-lane prose drift. */
export async function preserveAndAnnounceResidue(
  handoffPath: string,
  repoRoot: string | null,
): Promise<{ ref: string; wip: WipStat } | null> {
  const res = await preserveRoundResidue(handoffPath, repoRoot);
  if (res) {
    process.stderr.write(
      `CDD_WARN: worktree residue preserved for recovery — stash ${res.ref.slice(0, 7)} ` +
        `(${res.wip.files} file(s), +${res.wip.insertions}/-${res.wip.deletions}); ` +
        `see the recovery carrier (residue_ref / wip_stat)\n`,
    );
  }
  return res;
}