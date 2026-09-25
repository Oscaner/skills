// packages/cdd-engine/src/artifacts/residue.ts — ResidueManager class (T26/T28, spec T7.5; Task 6 ⑤
// OOP restructure): the residue SAVE + DETECT + RESTORE state machine as ONE instance class — the
// THIRD leg of the dispatch lifecycle (termination → salvage → resume). When a dead round
// (TIMEOUT / EXECUTION_FAILURE) leaves uncommitted work behind, settleResidue stashes it into a
// git stash and records `recovery.{residue_ref, stash_message, residue_scope, wip_stat, preserved,
// cause, round}` in the failure carrier; the re-dispatch's resume pre-flight reads that carrier,
// applies the stash back to the working tree, and the regenerated brief carries a residue-status
// appendix so the next agent audits WIP and continues instead of rewriting from zero.
// 收编: the carrier types (RecoveryInfo / DeadCarrierRead / ResidueAppendixInput) are declared here —
// the class's single type surface.
//
// T28 (spec T7.7) convergence: this module is the single owner of the SAVE family too — eligibility
// (recoveryEligible / RESIDUE_PRESERVED_CAUSES), the carrier-anchored adapter
// (settleFromCarrier — base settleResidue template hook + branch inline lanes), the preserved
// idempotence guard, and the CDD_WARN announce wrapper (preserveAndAnnounceResidue). One stash
// contract everywhere: the standardized `cdd-<op>-<type>-task-<N>-r<round>-<cause>` message the
// legacy resume scan can restart recovery from (the exit-1 rules/residue.ts landform is deleted).
//
//   ∂/salvage : settleResidue — TIMEOUT/EXECUTION_FAILURE round end (dispatch/task.ts call site;
//               the adapter's leaf). Writes preserved=true so a coexisting template hook never
//               double-stashes (recovery.preserved idempotence guard).
//   ∂/save    : settleFromCarrier — reads a dead-round carrier and repairs its WIP into a stash
//               + recovery facts (base settleResidue template step for review/fix/docs lanes and
//               the branch inline lane; a no-op when already preserved / ineligible / clean tree).
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

import path from "node:path";
import { ConfigLoader } from "../infra/config.ts";
import { GitClient, type WipStat } from "../infra/git.ts";
import { FAILURE_CATEGORIES } from "../rules/failure.ts";
import { roundPattern } from "./handoff/naming.ts";
import { readJson, writeHandoff } from "./handoff/write.ts";
import { SHA40_RE } from "./progress.ts";

// ---- standardized stash message (settleResidue output ≡ resume input, spec T7.5) ----

export const STASH_MESSAGE_PREFIX = "cdd-";

/** Match regex for the legacy scan — mirrors stashMessage() (op ∈ implement/review/fix; type ∈
 *  task/branch/spec/plan; cause ∈ the termination trio + the EXECUTION_FAILURE salvage cause). */
const LEGACY_STASH_RE =
  /^cdd-(implement|review|fix)-(task|branch|spec|plan)-task-(\d+)-r(\d+)-(stalled|over-budget|signal|exec-failure)$/;

/** The canonical salvage stash name — the one naming contract both sides share: settleResidue
 *  produces it, the legacy resume scan matches it. `<round>` renders as r<round> (r1 = first round). */
export function stashMessage(
  op: string,
  type: string,
  task: number,
  round: number,
  cause: string,
): string {
  return `cdd-${op}-${type}-task-${task}-r${round}-${cause}`;
}

/** Recovery-carrier causes whose residue the engine auto-preserves: EXECUTION_FAILURE (agent died
 * before writing its handoff — exit 1 / SIGTERM 143) and TIMEOUT (budget / liveness stall). */
export const RESIDUE_PRESERVED_CAUSES: ReadonlyArray<string> = [
  FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
  FAILURE_CATEGORIES.TIMEOUT.id,
];

/** The engine-written salvage record that rides the failure carrier (schema: task-handoff-schema.json
 *  `recovery` property). settleResidue returns this on a dirty tree, null when there was nothing to
 *  preserve. The carrier merge (task lane / settleFromCarrier) writes preserved=true so a coexisting
 *  save lane (template hook + task lane on the same round) never double-stashes. */
export interface RecoveryInfo {
  /** the stash commit SHA (index-independent: `stash@{N}` indices shift on every push/drop). */
  residue_ref: string;
  /** the standardized `cdd-<op>-<type>-task-<N>-r<round>-<cause>` stash message. */
  stash_message: string;
  /** WIP scope summary (`git diff HEAD --shortstat`), data-driven appendix input. */
  residue_scope: string;
  /** structured WIP scale (files / +M/-M, incl. brand-new untracked files) — the carrier's archivable
   *  magnitude beside residue_scope (gitDiffNumstat + gitUntrackedStat, read BEFORE the push). */
  wip_stat: WipStat;
  cause: string;
  round: number;
  /** The save-family idempotence flag (T28): the round's residue IS in the object store — an
   *  already-preserved carrier (recovery.preserved === true) is never stashed again. */
  preserved: true;
  /** The task-level scope anchor at salvage time (T27, spec T7.6: ledger value priority /
   *  fallback dead-round brief TASK_BASE). Resume restores the same anchor — the round-BASE
   *  (resume-declared) adoption and scope identity stay consistent across round death. */
  scope_base?: string;
}

/** The dead-round carrier read (implement re-dispatch pre-flight): status + failure_category +
 *  recovery from the prior implement handoff. Missing / unparseable file → null (no resume). */
export interface DeadCarrierRead {
  status: string;
  failureCategory: string;
  recovery: RecoveryInfo & Record<string, unknown>;
}

/** The typed appendix input for BriefRenderer — what the brief appends when a stash was applied
 *  (+ the dead round's status/cause). null = no residue → no appendix section. */
export interface ResidueAppendixInput {
  status: string;
  cause: string;
  ref: string;
  message: string;
  scope: string;
}

/** ResidueManager — the residue state machine (Task 6 ⑤; 构造注入 — the GitClient + ConfigLoader
 *  seams, defaulting to fresh instances). Detection, settlement and recovery are all instance
 *  methods; the carrier types (RecoveryInfo / DeadCarrierRead / ResidueAppendixInput) live here. */
export class ResidueManager {
  readonly #git: GitClient;
  readonly #config: ConfigLoader;

  constructor(git: GitClient = new GitClient(), config: ConfigLoader = new ConfigLoader()) {
    this.#git = git;
    this.#config = config;
  }

  matchesStandardStashMessage(message: string): boolean {
    return LEGACY_STASH_RE.test(message);
  }

  /** True when `cause` is a preserved class (recovery-eligible). null / undefined / unknown → false. */
  recoveryEligible(cause: string | null | undefined): boolean {
    return typeof cause === "string" && RESIDUE_PRESERVED_CAUSES.includes(cause);
  }

  /** The basename → handoff-family classification (the adapter's op/type/round source). For each
   * canonical family (engine-config.json#handoffNamespace — naming.ts roundPattern as the single
   * pattern source, never a hand-parallel regex), classify the carrier basename: the matching family
   * yields op/type; round = the name's `{round}` slot when the family has one, else 1 (the lone
   * round-slot-less family implement.task — implement rounds are always 1; buildCtx hard-codes it).
   * Unclassifiable basenames → null (the save is never fabricated for a foreign carrier). */
  #familyFromBasename(basename: string): { op: string; type: string; round: number } | null {
    const { families } = this.#config.handoffNamespace();
    for (const [key] of Object.entries(families)) {
      const [op, type] = key.split(".");
      if (!op || !type) continue;
      const m = basename.match(roundPattern(op, type));
      if (!m) continue;
      return { op, type, round: m[1] !== undefined ? Number(m[1]) : 1 };
    }
    return null;
  }

  /** The carrier basename's salvage round number (T28 contract: the standardized stash message embeds
   * the round for EVERY family — implement → 1, round-bearing names carry their own; unclassifiable →
   * null). Semantics migrate from rules/residue.ts roundFromCarrierBasename; the old "round-bearing →
   * null" marker shape died with the bespoke snapshot message it annotated (the T25-era save path,
   * deleted in this convergence). */
  roundFromCarrierBasename(basename: string): number | null {
    return this.#familyFromBasename(basename)?.round ?? null;
  }

  /** The adapter's derived salvage params — the canonical settleResidue opts keyed by the carrier's
   * own identity (the three paths — task lane / base hook / branch inline — share this derivation so
   * their stash messages agree). task comes from the carrier's `tasks[0]` (the P4.3 single-data-model
   * group identity; the stash primitive is per-carrier), falling back to 1 for doc-family carriers
   * (spec/plan have no task number); the message's `-task-` literal is a namespace marker, and
   * doc-family stashes keep a category-id cause that the legacy resume scan (resume lane = implement
   * only) never matches. */
  #salvageFromCarrier(
    basename: string,
    carrier: Record<string, unknown>,
  ): { op: string; type: string; task: number; round: number; cause: string } | null {
    const fam = this.#familyFromBasename(basename);
    if (!fam) return null;
    const groupTasks = Array.isArray(carrier.tasks) ? carrier.tasks : [];
    const task =
      typeof groupTasks[0] === "number" &&
      Number.isInteger(groupTasks[0]) &&
      (groupTasks[0] as number) >= 1
        ? groupTasks[0]
        : 1;
    const cause = (carrier.recovery as Record<string, unknown> | undefined)?.cause;
    if (typeof cause !== "string" || !cause) return null;
    return { op: fam.op, type: fam.type, task, round: fam.round, cause };
  }

  // ---- salvage (round end) ----

  /** The salvage happy face: stash the round's uncommitted work so a re-dispatch can restore it.
   *  Fail-open: clean tree (nothing to stash) → null; git error → null (salvage must never crash the
   *  round-terminal write — the carrier writes regardless, without the recovery record). */
  async settleResidue(
    cwd: string,
    opts: {
      op: string;
      type?: string;
      task: number;
      round: number;
      cause: string;
      scopeBase?: string | null;
    },
  ): Promise<RecoveryInfo | null> {
    const type = opts.type ?? "task";
    const message = stashMessage(opts.op, type, opts.task, opts.round, opts.cause);
    // The scope must be read BEFORE the stash push — after it the tree is clean and
    // `git diff HEAD --shortstat` is empty (the appendix would lose its WIP facts). The stash push
    // sweeps brand-new untracked files too (`-u`), so the scope must cover them: `git diff
    // --shortstat` omits untracked paths — extend the summary with the untracked-file count read off
    // the SAME porcelain snapshot (untrackedStat's returned `files`, computed from the porcelain
    // this call already fetched) so the tree is walked exactly once for both the scope text and the
    // structured scale below.
    const scope = (await this.#git.diffShortstat(cwd)) ?? "";
    const porcelain = await this.#git.statusPorcelain(cwd);
    const untracked = await this.#git.untrackedStat(cwd, porcelain);
    const residueScope =
      untracked.files > 0
        ? `${scope}${scope ? "; " : ""}${untracked.files} untracked file(s)`
        : scope;
    // The structured scale (tracked numstat + untracked line counts) is read BEFORE the push too —
    // recovery.wip_stat archives the pre-stash tree's magnitude (the carrier itself never counts:
    // it lives in the gitignored .osuperpowers/cdd workspace, invisible to `??` and to -u).
    const wip = await this.#git.diffNumstat(cwd);
    wip.files += untracked.files;
    wip.insertions += untracked.insertions;
    wip.deletions += untracked.deletions;
    const ref = await this.#git.stashPush(cwd, message);
    if (!ref) return null;
    return {
      residue_ref: ref,
      stash_message: message,
      residue_scope: residueScope,
      wip_stat: wip,
      cause: opts.cause,
      round: opts.round,
      preserved: true,
      // The write side enforces the same 40-hex shape its read side validates (T27, spec T7.6 —
      // resume pre-flight): a malformed brief TASK_BASE must never ship a schema-violating
      // recovery.scope_base (fail-open: skip the key, the salvage record still writes).
      ...(opts.scopeBase && SHA40_RE.test(opts.scopeBase) ? { scope_base: opts.scopeBase } : {}),
    };
  }

  // ---- save adapter (T28, spec T7.7; ex rules/residue.ts preserveRoundResidue) ----

  /** The dead-round carrier save: derive the salvage params from the CARRIER + its filename
   *  (op/type/round via the canonical family classification — roundFromCarrierBasename semantics —,
   *  task from the carrier, cause from recovery.cause) and run the canonical settleResidue, then merge
   *  the recovery facts (residue_ref / stash_message / residue_scope / wip_stat / cause / round /
   *  preserved) back into the carrier's recovery so every save lane carries the same contract.
   *  The preserved idempotence guard runs FIRST: an already-preserved carrier (template hook + task
   *  lane coexisting on one round — e.g. an implement TIMEOUT whose lane pre-wrote preserved=true) is
   *  never stashed a second time. Then eligibility: CONTRACT_VIOLATION-class causes are not
   *  auto-swallowed (the tree stays dirty and the discipline failure surfaces explicitly). Fail-open:
   *  !cwd / missing carrier / clean tree / git error → null with zero output.
   *  The pass-through carrier never joins the stash: it lives in the gitignored `.osuperpowers/cdd/`
   *  workspace (materializeWorkspace writes an in-dir `.gitignore`), and `git stash push -u` sweeps
   *  untracked, not ignored, files — no pathspec exclusion needed. */
  async settleFromCarrier(
    cwd: string,
    handoffPath: string,
    repoRoot?: string | null,
  ): Promise<RecoveryInfo | null> {
    if (!cwd) return null;
    // repoRoot records the pass-through-carrier context (the canonical engine root every call site
    // passes); it is documentation + future-proofing, never a pathspec.
    void repoRoot;
    const carrier = readJson(handoffPath);
    if (!carrier) return null;
    const recovery = carrier.recovery;
    if (!recovery || typeof recovery !== "object") return null;
    const rec = recovery as Record<string, unknown>;
    // Idempotence first: an already-preserved round is never re-examined (double-stash defense).
    if (rec.preserved === true) return null;
    const cause = typeof rec.cause === "string" ? rec.cause : undefined;
    if (!this.recoveryEligible(cause)) return null;
    const salvage = this.#salvageFromCarrier(path.basename(handoffPath), carrier);
    if (!salvage) return null;
    const info = await this.settleResidue(cwd, salvage);
    if (!info) return null; // clean tree / git error — the carrier keeps its death diagnosis only
    rec.residue_ref = info.residue_ref;
    rec.stash_message = info.stash_message;
    rec.residue_scope = info.residue_scope;
    rec.wip_stat = info.wip_stat;
    rec.cause = info.cause;
    rec.round = info.round;
    rec.preserved = true;
    writeHandoff(handoffPath, carrier);
    return info;
  }

  /** settleFromCarrier + a stderr CDD_WARN announcement. Shared by the base settleResidue template
   * step AND the branch failure lanes (which abort via exitWithCode and never reach the template
   * step — they call this inline before exiting). One announcement shape, no per-lane prose drift. */
  async preserveAndAnnounceResidue(
    cwd: string,
    handoffPath: string,
    repoRoot?: string | null,
  ): Promise<RecoveryInfo | null> {
    const res = await this.settleFromCarrier(cwd, handoffPath, repoRoot);
    if (res) {
      process.stderr.write(
        `CDD_WARN: worktree residue preserved for recovery — stash ${res.residue_ref.slice(0, 7)} ` +
          `(${res.wip_stat.files} file(s), +${res.wip_stat.insertions}/-${res.wip_stat.deletions}); ` +
          `see the recovery carrier (residue_ref / stash_message / wip_stat)\n`,
      );
    }
    return res;
  }

  // ---- resume (re-dispatch pre-flight) ----

  readDeadCarrier(handoffPath: string): DeadCarrierRead | null {
    const obj = readJson(handoffPath);
    if (!obj) return null;
    const status = typeof obj.status === "string" ? obj.status : "";
    const failureCategory = typeof obj.failure_category === "string" ? obj.failure_category : "";
    if (status !== "TIMEOUT" && failureCategory !== "EXECUTION_FAILURE") return null; // only dead rounds resume
    const recovery = (obj.recovery ?? {}) as RecoveryInfo & Record<string, unknown>;
    return { status, failureCategory, recovery };
  }

  /** Resume resolution:
   *  ① primary — carrier.recovery.residue_ref (index-independent SHA from settleResidue);
   *  ② legacy fallback — `recovery` absent (pre-schema carriers): scan `git stash list` for the
   *     standardized stash message. First match (newest-first) wins.
   *  Returns { ref, message } the caller can `git stash apply`, or null when nothing can be restored. */
  async findResumeResidue(
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
    const list = await this.#git.stashList(cwd);
    if (!list) return null;
    for (const entry of list) {
      if (!this.matchesStandardStashMessage(entry.message)) continue;
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
  async resumeFromResidue(cwd: string, ref: string): Promise<boolean> {
    return this.#git.stashApply(cwd, ref);
  }

  // ---- appendix (brief) ----

  /** The data-driven `## Residue status` brief section (§35 prompt self-sufficiency — the prose states
   *  the applied-WIP facts itself; no external anchor). Built from the resume's recoverable facts:
   *  status/cause of the dead round + the applied stash + the WIP scope. */
  renderResidueAppendix(info: {
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

  /** The resume pre-flight's distilled appendix input — what the brief appends when a stash was
   *  applied (+ the dead round's status/cause). */
  appendixFromRecovery(
    carrier: DeadCarrierRead,
    found: { ref: string; message: string },
  ): ResidueAppendixInput {
    return {
      status: carrier.status || carrier.failureCategory,
      cause: (carrier.recovery?.cause as string | undefined) ?? carrier.failureCategory,
      ref: found.ref,
      message: found.message || ((carrier.recovery?.stash_message as string | undefined) ?? ""),
      scope: (carrier.recovery?.residue_scope as string | undefined) ?? "",
    };
  }
}
