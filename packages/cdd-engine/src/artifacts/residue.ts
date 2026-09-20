// packages/cdd-engine/src/artifacts/residue.ts — resume-from-residue single point (T26, spec T7.5):
// the THIRD leg of the dispatch lifecycle (termination → salvage → resume). When a dead round
// (TIMEOUT / EXECUTION_FAILURE) leaves uncommitted work behind, settleResidue stashes it into a
// git stash and records `recovery.{residue_ref, stash_message, residue_scope, cause, round}` in the
// failure carrier; the re-dispatch's resume pre-flight reads that carrier, applies the stash back
// to the working tree, and the regenerated brief carries a residue-status appendix so the next
// agent audits WIP and continues instead of rewriting from zero.
//
//   ∂/salvage : settleResidue  — TIMEOUT/EXECUTION_FAILURE round end (dispatch/task.ts call site).
//   ∂/resume  : findResumeResidue + resumeFromResidue — implement re-dispatch pre-flight
//               (resolveContext, AFTER the entry gate verified a clean tree: the stash apply needs
//               a gate-clean baseline to land without conflict).
//   ∂/appendix: renderResidueAppendix — data-driven `## Residue status` brief section (prompt
//               semantic self-sufficiency, §35 — the prose states the WIP facts itself, zero
//               external anchors).
//
// Legacy stash-scan fallback (v1.9 defect fix): carriers written by rounds before the `recovery`
// field existed (e.g. T25 — its stash@{0} is the treasury artifact) carry no residue_ref. The
// fallback scans `git stash list` for the STANDARDIZED stash message and matches by it. The scan
// is scoped to the standardized `cdd-<op>-<type>-<task>-r<round>-<cause>` name only — the T25
// bespoke stash ("cdd-T25-… 2026-09-20 …") is a one-off narrative artifact, NOT a match target;
// its WIP is restorable by manual `git stash apply stash@{0}`.
import { gitDiffShortstat, gitStashApply, gitStashList, gitStashPush } from "../infra/git.ts";
import { readJson } from "./handoff/write.ts";

// ---- standardized stash message (settleResidue output ≡ resume input, spec T7.5) ----

export const STASH_MESSAGE_PREFIX = "cdd-";

/** The canonical salvage stash name — the one naming contract both sides share: settleResidue
 *  produces it, the legacy resume scan matches it. `<round>` renders as r<round> (r1 = first round). */
export function stashMessage(op: string, type: string, task: number, round: number, cause: string): string {
  return `cdd-${op}-${type}-task-${task}-r${round}-${cause}`;
}

/** Match regex for the legacy scan — mirrors stashMessage() (op ∈ implement/review/fix; type ∈
 *  task/branch/spec/plan; cause ∈ the termination trio + the EXECUTION_FAILURE salvage cause). */
const LEGACY_STASH_RE =
  /^cdd-(implement|review|fix)-(task|branch|spec|plan)-task-(\d+)-r(\d+)-(stalled|over-budget|signal|exec-failure)$/;

export function matchesStandardStashMessage(message: string): boolean {
  return LEGACY_STASH_RE.test(message);
}

// ---- salvage (round end) ----

/** Engine-written salvage record that rides the failure carrier (schema: task-handoff-schema.json
 *  `recovery` property). settleResidue returns this on a dirty tree, null when there was nothing to
 *  preserve. */
export interface RecoveryInfo {
  /** the stash commit SHA (index-independent: `stash@{N}` indices shift on every push/drop). */
  residue_ref: string;
  /** the standardized `cdd-<op>-<type>-task-<N>-r<round>-<cause>` stash message. */
  stash_message: string;
  /** WIP scope summary (`git diff HEAD --shortstat`), data-driven appendix input. */
  residue_scope: string;
  cause: string;
  round: number;
}

/** The salvage happy face: stash the round's uncommitted work so a re-dispatch can restore it.
 *  Fail-open: clean tree (nothing to stash) → null; git error → null (salvage must never crash the
 *  round-terminal write — the carrier writes regardless, without the recovery record). */
export async function settleResidue(
  cwd: string,
  opts: { op: string; type?: string; task: number; round: number; cause: string },
): Promise<RecoveryInfo | null> {
  const type = opts.type ?? "task";
  const message = stashMessage(opts.op, type, opts.task, opts.round, opts.cause);
  // The scope must be read BEFORE the stash push — after it the tree is clean and
  // `git diff HEAD --shortstat` is empty (the appendix would lose its WIP facts).
  const scope = (await gitDiffShortstat(cwd)) ?? "";
  const ref = await gitStashPush(cwd, message);
  if (!ref) return null;
  return { residue_ref: ref, stash_message: message, residue_scope: scope, cause: opts.cause, round: opts.round };
}

// ---- resume (re-dispatch pre-flight) ----

/** The dead-round carrier reads (implement re-dispatch pre-flight): status + failure_category +
 *  recovery from the prior implement handoff. Missing / unparseable file → null (no resume). */
export interface DeadCarrierRead {
  status: string;
  failureCategory: string;
  recovery: RecoveryInfo & Record<string, unknown>;
}

export function readDeadCarrier(handoffPath: string): DeadCarrierRead | null {
  const obj = readJson(handoffPath);
  if (!obj) return null;
  const status = typeof obj.status === "string" ? obj.status : "";
  const failureCategory =
    typeof obj.failure_category === "string" ? obj.failure_category : "";
  if (status !== "TIMEOUT" && failureCategory !== "EXECUTION_FAILURE") return null; // only dead rounds resume
  const recovery = (obj.recovery ?? {}) as RecoveryInfo & Record<string, unknown>;
  return { status, failureCategory, recovery };
}

/** Resume resolution:
 *  ① primary — carrier.recovery.residue_ref (index-independent SHA from settleResidue);
 *  ② legacy fallback — `recovery` absent (pre-schema carriers): scan `git stash list` for the
 *     standardized stash message. First match (newest-first) wins.
 *  Returns { ref, message } the caller can `git stash apply`, or null when nothing can be restored. */
export async function findResumeResidue(
  cwd: string,
  carrier: DeadCarrierRead,
  task: number,
): Promise<{ ref: string; message: string } | null> {
  const ref = carrier.recovery?.residue_ref;
  if (typeof ref === "string" && ref.length > 0) {
    return { ref, message: (carrier.recovery?.stash_message as string | undefined) ?? "" };
  }
  // Legacy fallback: standardized-message scan, pinned to THIS task (a legacy TIMEOUT/EXEC_FAILURE
  // carrier for task N resumes the stash named for task N — any standard cause/round matches; the
  // newest-first scan order picks the latest salvage for the task).
  const list = await gitStashList(cwd);
  if (!list) return null;
  for (const entry of list) {
    if (!matchesStandardStashMessage(entry.message)) continue;
    const match = LEGACY_STASH_RE.exec(entry.message);
    const mTask = Number(match![3]);
    if (mTask === task) {
      return { ref: entry.ref, message: entry.message };
    }
  }
  return null;
}

/** Apply the salvage back onto the working tree (`git stash apply`). false on failure — fail-open:
 *  a refused resume must never block the dispatch. */
export async function resumeFromResidue(cwd: string, ref: string): Promise<boolean> {
  return gitStashApply(cwd, ref);
}

// ---- appendix (brief) ----

/** The data-driven `## Residue status` brief section (§35 prompt self-sufficiency — the prose states
 *  the applied-WIP facts itself; no external anchor). Built from the resume's recoverable facts:
 *  status/cause of the dead round + the applied stash + the WIP scope. */
export function renderResidueAppendix(info: {
  status: string;
  cause: string;
  ref: string;
  message: string;
  scope: string;
}): string {
  const scopeNote = info.scope ? `: ${info.scope}` : "";
  return [
    "## Residue status from the previous dispatch",
    "",
    `The previous dispatch for this task ended in ${info.status} (cause: ${info.cause}). Its uncommitted work was salvaged and has been applied to the working tree for this round:`,
    "",
    `- stash: ${info.ref}${info.message ? ` (message: ${info.message})` : ""}`,
    `- scope${scopeNote}`,
    "",
    "Continue from the existing work instead of rewriting from scratch: audit the applied changes against this brief first, then add only what is missing.",
  ].join("\n");
}

// ---- typed appendix input for generateBrief (render/brief.ts) ----

/** The resume pre-flight's distilled appendix input — what the brief appends when a stash was
 *  applied (+ the dead round's status/cause). null = no residue → no appendix section. */
export interface ResidueAppendixInput {
  status: string;
  cause: string;
  ref: string;
  message: string;
  scope: string;
}

export function appendixFromRecovery(carrier: DeadCarrierRead, found: { ref: string; message: string }): ResidueAppendixInput {
  return {
    status: carrier.status || carrier.failureCategory,
    cause: (carrier.recovery?.cause as string | undefined) ?? carrier.failureCategory,
    ref: found.ref,
    message: found.message || ((carrier.recovery?.stash_message as string | undefined) ?? ""),
    scope: (carrier.recovery?.residue_scope as string | undefined) ?? "",
  };
}