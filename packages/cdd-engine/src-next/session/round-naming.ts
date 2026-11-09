// packages/cdd-engine/src-next/session/round-naming.ts
// P11 T4 — the round-naming single source: the frame → artifact-name derivations
// (report · evidence · brief) the lifecycle's read-back and the dry-run preview
// share, plus the frame → family-op mapping those names key on. The handoff carrier's
// DRAFT name is NOT derived here — it stays with the Ledger's HANDOFF_FAMILIES table
// (the naming table is the single truth, never a second list); the FINAL name (P31
// §2.3) is that name with its suffix swapped, so the rule runs on the filled name.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import type { Workspace } from "../infra/workspace.ts";
import { TargetFaceTable, type TargetType, targetFaces } from "./faces.ts";
import type { HandoffParams, OpType } from "./ledger.ts";
import type { OpenFrame } from "./run.ts";

/** One round's identity slice — the attempt-allocation input. `RoundRecord`
 *  structurally satisfies it, so the naming table reads the ledger's records
 *  without depending on the ledger's record type (naming stays the single source). */
export type AttemptIdentity = {
  readonly op: OpType;
  readonly cycle: number;
  readonly attempt: number;
};

/**
 * RoundNaming — the one home of a round's prescribed artifact names. A frame's
 * report / evidence / brief names derive here, so every consumer (the lifecycle's
 * write-back and read-back, the dry-run preview, the brief render) names the same
 * artifacts by the same rule — one fact, one place. The class holds only the
 * workspace the names resolve against.
 */
export class RoundNaming {
  readonly #workspace: Workspace;

  constructor(workspace: Workspace) {
    this.#workspace = workspace;
  }

  /** The two carrier-name shapes this engine MINTS — the draft family spelling
   *  (`{line}-{op}[-{round}].json`) and its final twin (`…[-{round}].c{N}.json`). The
   *  line words come from the ONE target-face table (the wave line's spelling is the
   *  `tasks-` spine, never the `wave` word itself) and the ops from the ONE op
   *  vocabulary, so neither set is re-spelled here. */
  static readonly #CARRIER = RoundNaming.#carrierPattern();

  /** The carrier-name predicate's compiled pattern — `tasks-{tasks}` is the one
   *  wave-only line (implement exists there alone), the other line words take the
   *  round-bearing ops. */
  static #carrierPattern(): RegExp {
    const lines = Object.keys(targetFaces).filter((word) => word !== "wave");
    return new RegExp(
      `^(?:tasks-.+-(?:implement|review|fix)(?:-\\d+)?|(?:${lines.join("|")})-(?:review|fix)(?:-\\d+)?)(?:\\.c\\d+)?\\.json$`,
    );
  }

  /** The carrier's FINAL name of one round — the draft family name with its `.json`
   *  suffix swapped for `.c{round}.json` (P31 §2.3: the finalized carrier never
   *  overwrites the child's draft, so the two names share the stem and differ in the
   *  suffix). The draft spelling stays the Ledger's family table (`handoffName` — the
   *  naming truth); this rule runs on the name that table filled, so the two spellings
   *  cannot drift. A round-less family has no cycle to key on: the family name comes
   *  back unchanged, never a `.c.json` malformed suffix. */
  finalName(draftName: string, round: HandoffParams["round"] = undefined): string {
    if (round === undefined) return draftName;
    return `${draftName.replace(/\.json$/, "")}.c${round}.json`;
  }

  /** The final carrier's on-disk path — `finalName` resolved against the workspace
   *  (the name is the input, so an absolute path is never re-joined). */
  finalPath(draftName: string, round: HandoffParams["round"] = undefined): string {
    return this.#workspace.resolve(this.finalName(draftName, round));
  }

  /** Whether a workspace file name is one of the two carrier shapes this engine mints.
   *  Every neighbouring artifact — `progress.json` · `base.json` · the test-evidence
   *  sibling · a carrier's `.rulings.json` sidecar · a report · a crash record — is NOT
   *  a carrier, so the sweep that seals carriers can never touch them. Static: the
   *  judgment reads a NAME and nothing else, so the seal sweep (`CarrierSeal`) applies
   *  the same predicate without holding a workspace. */
  static isCarrierName(name: string): boolean {
    return RoundNaming.#CARRIER.test(name);
  }

  /** The handoff-family op of a frame — branch-review rides the review family. The
   *  artifact stems embed this op, so the mapping is a naming fact owned here (the
   *  lifecycle's op read delegates, never a second copy of the rule). */
  op(frame: OpenFrame): OpType {
    return frame.phase === "branch-review" ? "review" : frame.phase;
  }

  /** The engine-rendered brief path of a wave's task group —
   *  `tasks-{tasks}-brief.md` (the implement dispatch's read input; its producer is
   *  `CliGate#renderBrief`). */
  brief(tasks: string): string {
    return this.#workspace.resolve(this.briefName(tasks));
  }

  /** The brief's workspace-relative NAME — the write face takes the name, the read
   *  faces take the resolved path (one derivation, both spellings). */
  briefName(tasks: string): string {
    return `tasks-${tasks}-brief.md`;
  }

  /** The prescribed report path of a round — the doc line's
   *  `{type}-{op}-{round}-report.md` stem, the wave/branch line's
   *  `{family}-{op}{-round}-report.md` (the implement round carries no round token:
   *  the line keys the implement round alone). */
  report(frame: OpenFrame): string {
    const params: HandoffParams = { tasks: frame.params.tasks, round: frame.round };
    return this.#workspace.resolve(`${this.#stem(this.op(frame), frame.type, params)}-report.md`);
  }

  /** The prescribed test-evidence path of a round — "" off the evidence rounds (the doc
   *  lines and the review rounds prescribe no evidence file). */
  evidence(frame: OpenFrame): string {
    const name = this.evidenceName(frame);
    return name === "" ? "" : this.#workspace.resolve(name);
  }

  /** The test-evidence file NAME of a work frame — the workspace-relative face the
   *  read-back gate reads it by (`{line}-test-evidence.json`: the task families key
   *  the line, the branch line names the family alone). "" off the evidence rounds
   *  — the doc shapes (phase-spec · overall · plan · single-spec) prescribe none. */
  evidenceName(frame: OpenFrame): string {
    if (TargetFaceTable.isDocShape(frame.type)) return "";
    if (frame.phase !== "implement" && frame.phase !== "fix") return "";
    const key = frame.type === "wave" ? (frame.params.tasks ?? "") : "";
    const line = key === "" ? this.prefix(frame) : `${this.prefix(frame)}-${key}`;
    return `${line}-test-evidence.json`;
  }

  /** The evidence file's family prefix — `tasks` for the wave families, `branch`
   *  for the branch line (never the misleading tasks- spine). */
  prefix(frame: OpenFrame): string {
    return frame.type === "wave" ? "tasks" : "branch";
  }

  /** The attempt number a dispatch of one op/cycle would take — the max attempt
   *  already on record for that identity plus one (1 when the cycle was never
   *  dispatched). The ledger's records are the input slice, so the naming table
   *  allocates the attempt ONCE for both the record and the log name. */
  attemptOf(records: readonly AttemptIdentity[], op: OpType, cycle: number): number {
    let latest = 0;
    for (const record of records) {
      if (record.op === op && record.cycle === cycle && record.attempt > latest) {
        latest = record.attempt;
      }
    }
    return latest + 1;
  }

  /** The per-round log file NAME of a round — the report stem with `.log` instead
   *  of `-report.md`, carrying `-a{attempt}` when the dispatch is a re-attempt (so
   *  attempt 1's log is never overwritten). The attempt is allocated by `attemptOf`
   *  and passed in, never extrapolated here. */
  logName(op: OpType, type: TargetType, params: HandoffParams, attempt: number): string {
    const attemptSuffix = attempt > 1 ? `-a${attempt}` : "";
    return `${this.#stem(op, type, params)}${attemptSuffix}.log`;
  }

  /** The round's artifact STEM — the ONE derivation the report and the log name read
   *  (`{type}-{op}-{round}` on the doc lines, `{family}-{op}{-round}` on the
   *  wave/branch lines). The round-token decision keys on the FAMILY OP (implement is
   *  the round-less family), so the report and its log can never diverge. */
  #stem(op: OpType, type: TargetType, params: HandoffParams): string {
    if (TargetFaceTable.isDocShape(type)) return `${type}-${op}-${params.round}`;
    const family = type === "wave" ? `tasks-${params.tasks ?? ""}` : "branch";
    const suffix = op === "implement" ? "" : `-${params.round}`;
    return `${family}-${op}${suffix}`;
  }

  /** The crash record's workspace-relative name — `crash-{line}-{op}-{round}.json`.
   *  The `line` derives from the frame's ONE identity (wave → `tasks-{tasks}`;
   *  branch / the doc shapes → the line-type constant), the `op` keeps the verb
   *  (`RoundNaming.op`: branch-review rides the review family) — so a wave's
   *  implement-2 and review-2 crash records never overwrite each other. */
  crashName(frame: OpenFrame): string {
    return `crash-${this.#line(frame)}-${this.op(frame)}-${frame.round}.json`;
  }

  /** The crash record's on-disk path — the same derivation as `crashName` (one
   *  name, one rule; the read and write faces agree by construction). */
  crashPath(frame: OpenFrame): string {
    return this.#workspace.resolve(this.crashName(frame));
  }

  /** A frame's line identity — the dispatch unit the crash record keys on: the
   *  wave's task group (`tasks-{tasks}`), the branch line, or the doc-type line. */
  #line(frame: OpenFrame): string {
    return frame.type === "wave" ? `tasks-${frame.params.tasks ?? ""}` : frame.type;
  }
}
