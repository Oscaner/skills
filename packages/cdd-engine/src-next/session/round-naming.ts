// packages/cdd-engine/src-next/session/round-naming.ts
// P34 T1 — the naming single source: ONE round identity renders every artifact name
// (draft · final · report · log · crash · evidence) through `renderName`, so a kind's
// spelling and its siblings' can never drift, and the reverse attribution
// (`Ledger#handoffOwner`) parses back exactly the identity this face renders.
//
// The identity is a triple: the LINE (`tasks-{tasks}` · `branch` · the doc word), the
// OP (`implement` · `review` · `fix` — branch-review rides the review family), the
// CYCLE and the ATTEMPT. Every kind shares one stem, so the carrier's draft, its
// final beside it, the round's report, log, crash record and test-evidence file all
// name the same round. The attempt rides the stem as `-a{n}` and is omitted on the
// first attempt; a cycle-less identity (an inferred params with no round) omits the
// cycle segment too, never a `-undefined` token.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.
// One module-level value: the compiled carrier predicate below (`CARRIER`).

import type { Workspace } from "../infra/workspace.ts";
import { TargetFaceTable, type TargetType, targetFaces } from "./faces.ts";
import type { HandoffParams, OpType } from "./ledger.ts";
import type { OpenFrame } from "./run.ts";

/** The two carrier-name shapes this engine MINTS — the draft and its final twin.
 *  Both accept the `-a{n}` attempt segment and the final's `.c{cycle}` suffix; every
 *  other artifact (report · log · crash · evidence) is deliberately outside the
 *  predicate, so the seal sweep can never touch it. The legacy cycle-less implement
 *  spelling (`tasks-{tasks}-implement.json`) stays accepted for the drafts a
 *  pre-P34 engine left on disk.
 *
 *  Module scope, not a `static readonly #CARRIER` field: tsc down-levels a static
 *  field initializer that reads the class's own private static member into a temp
 *  (`static #CARRIER = _a.#carrierPattern()`) assigned only AFTER the class body, so
 *  the module threw `Receiver must be class RoundNaming` at import. Reading a plain
 *  const keeps the pattern out of that transform's reach.
 *
 *  A wave line takes the wave-only `tasks-` spine, every other line word takes the
 *  round-bearing ops; the op set and the line words come from the ONE target-face
 *  table, so neither is re-spelled here. The `.c{cycle}` final suffix hangs off the
 *  CYCLE-BEARING alternatives alone — a cycle-less identity has no cycle to suffix, so
 *  `tasks-1-implement.c1.json` is a shape the renderer can never mint. */
const carrierPattern = (): RegExp => {
  const lines = Object.keys(targetFaces).filter((word) => word !== "wave");
  const attempt = "(?:-a\\d+)?";
  const final = "(?:\\.c\\d+)?";
  const cycleBearing = [
    "tasks-.+?-implement-\\d+",
    "tasks-.+?-(?:review|fix)-\\d+",
    `(?:${lines.join("|")})-(?:review|fix)-\\d+`,
  ].join("|");
  // The legacy cycle-less implement draft: a draft on disk, never a final and never
  // an attempt — this engine mints neither on a cycle-less identity.
  const legacy = "tasks-.+?-implement";
  return new RegExp(`^(?:(?:${cycleBearing})${attempt}${final}|${legacy})\\.json$`);
};

const CARRIER = carrierPattern();

/** One round's attempt-allocation slice — `RoundRecord` structurally satisfies it,
 *  so the naming table reads the ledger's records without depending on the ledger's
 *  record type (naming stays the single source). */
export type AttemptIdentity = {
  readonly op: OpType;
  readonly cycle: number;
  readonly attempt: number;
};

/** The artifact kinds one round identity renders — the six names a round can land. */
export type ArtifactKind = "draft" | "final" | "report" | "log" | "crash" | "evidence";

/** One round's naming identity — the line word, the op, the cycle and the attempt.
 *  `cycle` / `attempt` are optional so a legacy caller whose params carry no round
 *  (an inferred family) still renders the cycle-less name it always asked for. */
export interface RoundArtifact {
  /** The line word — `tasks-{tasks}` for a wave, `branch`, or the doc-type word. */
  readonly line: string;
  /** The round's op (branch-review already mapped onto `review`). */
  readonly op: OpType;
  /** The round number (a padded string is accepted, never re-typed). */
  readonly cycle?: number | string;
  /** The attempt number (1 = the first attempt; the segment is omitted there). */
  readonly attempt?: number;
}

/**
 * RoundNaming — the one home of a round's prescribed artifact names. A frame's
 * report / log / crash / evidence / carrier names derive here, so every consumer
 * (the lifecycle's write-back and read-back, the ledger's carrier persist, the dry-run
 * preview, the seal sweep) names the same artifacts by the same rule — one fact, one
 * place. The class holds only the workspace the names resolve against.
 */
export class RoundNaming {
  readonly #workspace: Workspace;

  constructor(workspace: Workspace) {
    this.#workspace = workspace;
  }

  /** The identity of one (op, type, params) triple — the ONE adapter from the
   *  params-carrying surface (`Ledger#handoffName`, the seal legs) onto the renderer. */
  static artifactOf(op: OpType, type: string, params: HandoffParams): RoundArtifact {
    return {
      line: RoundNaming.lineOf(type, params),
      op,
      cycle: params.round,
      attempt: params.attempt,
    };
  }

  /** The line word of a (type, params) pair — the wave line's `tasks-{tasks}` spine,
   *  every other type its own word. */
  static lineOf(type: string, params: HandoffParams): string {
    return type === "wave" ? `tasks-${params.tasks ?? ""}` : type;
  }

  /** Render one round identity as one artifact name — the ONE naming rule. The four
   *  segments (`line` · `op` · cycle · attempt) join in this order for every kind, so
   *  a kind only picks its own prefix/suffix around the shared stem. A `final` has no
   *  cycle to key on when the identity carries none: it renders the draft name back,
   *  never a malformed `.cundefined` suffix. The stem's cycle segment is omitted for a
   *  cycle-less identity; its attempt segment is omitted on the first attempt (an
   *  `-a1` never appears). */
  static renderName(artifact: RoundArtifact, kind: ArtifactKind): string {
    const cycle = artifact.cycle === undefined || artifact.cycle === "" ? "" : `-${artifact.cycle}`;
    const attempt =
      artifact.attempt === undefined || artifact.attempt <= 1 ? "" : `-a${artifact.attempt}`;
    const stem = `${artifact.line}-${artifact.op}${cycle}${attempt}`;
    switch (kind) {
      case "draft":
        return `${stem}.json`;
      case "final":
        return artifact.cycle === undefined || artifact.cycle === ""
          ? `${stem}.json`
          : `${stem}.c${artifact.cycle}.json`;
      case "report":
        return `${stem}-report.md`;
      case "log":
        return `${stem}.log`;
      case "crash":
        return `crash-${stem}.json`;
      case "evidence":
        return `${stem}-test-evidence.json`;
    }
  }

  /** The carrier-name predicate's compiled pattern — a wave line takes the wave-only
   *  `tasks-` spine, every other line word takes the round-bearing ops. The op set and
   *  the line words come from the ONE target-face table, so neither is re-spelled here.
   *  Only `implement` has a cycle-less spelling (the pre-P34 draft on disk); `review`
   *  and `fix` always carry their cycle, so a `tasks-1-review.json` is no carrier at all.
   *  The `.c{cycle}` final suffix hangs off the CYCLE-BEARING alternatives alone — a
   *  cycle-less identity has no cycle to suffix, so `tasks-1-implement.c1.json` is a
   *  shape the renderer can never mint. */
  /** The rendered name resolved against the workspace — the read/write syscall form. */
  renderPath(artifact: RoundArtifact, kind: ArtifactKind): string {
    return this.#workspace.resolve(RoundNaming.renderName(artifact, kind));
  }

  /** Whether a workspace file name is one of the two carrier shapes this engine mints.
   *  Every neighbouring artifact — `progress.json` · `base.json` · the test-evidence
   *  sibling · a carrier's `.rulings.json` sidecar · a report · a crash record — is NOT
   *  a carrier, so the sweep that seals carriers can never touch them. Static: the
   *  judgment reads a NAME and nothing else, so the seal sweep (`CarrierSeal`) applies
   *  the same predicate without holding a workspace. */
  static isCarrierName(name: string): boolean {
    return CARRIER.test(name);
  }

  /** The handoff-family op of a frame — branch-review rides the review family. The
   *  artifact names embed this op, so the mapping is a naming fact owned here (the
   *  lifecycle's op read delegates, never a second copy of the rule). */
  op(frame: OpenFrame): OpType {
    return frame.phase === "branch-review" ? "review" : frame.phase;
  }

  /** The engine-rendered brief path of a wave's task group —
   *  `tasks-{tasks}-brief.md` (the implement dispatch's read input; its producer is
   *  `CliGate#renderBrief`). The brief is the dispatch's INPUT, not a round artifact:
   *  it carries no cycle or attempt. */
  brief(tasks: string): string {
    return this.#workspace.resolve(this.briefName(tasks));
  }

  /** The brief's workspace-relative NAME — the write face takes the name, the read
   *  faces take the resolved path (one derivation, both spellings). */
  briefName(tasks: string): string {
    return `tasks-${tasks}-brief.md`;
  }

  /** The prescribed report path of a round — the shared stem with `-report.md`. */
  report(frame: OpenFrame): string {
    return this.renderPath(this.#artifact(frame), "report");
  }

  /** The prescribed test-evidence path of a round — "" off the evidence rounds (the doc
   *  lines and the review rounds prescribe no evidence file). */
  evidence(frame: OpenFrame): string {
    const name = this.evidenceName(frame);
    return name === "" ? "" : this.#workspace.resolve(name);
  }

  /** The test-evidence file NAME of a work frame — the shared stem with
   *  `-test-evidence.json`. "" off the evidence rounds — the doc shapes (phase-spec ·
   *  overall · plan · single-spec) and the review phase prescribe none. */
  evidenceName(frame: OpenFrame): string {
    if (TargetFaceTable.isDocShape(frame.type)) return "";
    if (frame.phase !== "implement" && frame.phase !== "fix") return "";
    return RoundNaming.renderName(this.#artifact(frame), "evidence");
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

  /** The per-round log file NAME of a round — the shared stem with `.log`, carrying
   *  `-a{attempt}` when the dispatch is a re-attempt (so attempt 1's log is never
   *  overwritten). The attempt is allocated by `attemptOf` and passed in, never
   *  extrapolated here. */
  logName(op: OpType, type: TargetType, params: HandoffParams, attempt: number): string {
    const artifact = RoundNaming.artifactOf(op, type, { ...params, attempt });
    return RoundNaming.renderName(artifact, "log");
  }

  /** The crash record's workspace-relative name — the shared stem with its own
   *  `crash-` prefix, so a wave's implement and review round crash records never
   *  overwrite each other. */
  crashName(frame: OpenFrame): string {
    return RoundNaming.renderName(this.#artifact(frame), "crash");
  }

  /** The crash record's on-disk path — the same derivation as `crashName` (one
   *  name, one rule; the read and write faces agree by construction). */
  crashPath(frame: OpenFrame): string {
    return this.#workspace.resolve(this.crashName(frame));
  }

  /** A frame's naming identity — the ONE adapter from the frame onto the renderer.
   *  `op` defaults to the frame's own (`op()`), and the attempt falls back to the
   *  params' cell so a caller that only carried it there still names its round. */
  #artifact(frame: OpenFrame, op: OpType = this.op(frame)): RoundArtifact {
    return {
      line: RoundNaming.lineOf(frame.type, frame.params),
      op,
      cycle: frame.round,
      attempt: frame.attempt ?? frame.params.attempt,
    };
  }
}
