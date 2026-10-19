// packages/cdd-engine/src-next/session/round-naming.ts
// P11 T4 — the round-naming single source: the frame → artifact-name derivations
// (report · evidence · brief) the lifecycle's read-back and the dry-run preview
// share, plus the frame → family-op mapping those names key on. The handoff carrier
// name is NOT derived here — it stays with the Ledger's HANDOFF_FAMILIES table (the
// naming table is the single truth, never a second list).
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import type { Workspace } from "../infra/workspace.ts";
import type { OpType } from "./ledger.ts";
import type { OpenFrame } from "./run.ts";

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
    if (frame.type === "spec" || frame.type === "plan") {
      return this.#workspace.resolve(`${frame.type}-${this.op(frame)}-${frame.round}-report.md`);
    }
    const family = frame.type === "wave" ? `tasks-${frame.params.tasks ?? ""}` : "branch";
    const suffix = frame.phase === "implement" ? "" : `-${frame.round}`;
    return this.#workspace.resolve(`${family}-${this.op(frame)}${suffix}-report.md`);
  }

  /** The prescribed test-evidence path of a round — "" off the delivery faces (the doc
   *  lines and the review rounds prescribe no evidence file). */
  evidence(frame: OpenFrame): string {
    const name = this.evidenceName(frame);
    return name === "" ? "" : this.#workspace.resolve(name);
  }

  /** The test-evidence file NAME of a work frame — the workspace-relative face the
   *  read-back gate reads it by (`{line}-test-evidence.json`: the task families key
   *  the line, the branch line names the family alone). "" off the delivery faces. */
  evidenceName(frame: OpenFrame): string {
    if (frame.type === "spec" || frame.type === "plan") return "";
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
}
