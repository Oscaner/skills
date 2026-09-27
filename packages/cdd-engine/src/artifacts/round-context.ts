// packages/cdd-engine/src/artifacts/round-context.ts — RoundContext class (Task 6 ②): the review/fix
// round's unique context — the round base / base token / round anchor. Wraps the canonical handoff-naming
// atoms (naming.ts single point) so every review/fix round derivation (task dispatch buildContext /
// cli review type=task round scan) shares ONE anchor object: the op/type/workspace/round identity,
// the per-family params ({tasks} for task, {base7,head7} for branch), the base token (the round's
// fixed-point / FIX_BASE anchor), and the derived name/path/previous-round surfaces.
import path from "node:path";
import { type HandoffParams, handoffName, prevHandoffPath } from "./handoff/naming.ts";

export type RoundOp = "review" | "fix";
export type RoundType = "task" | "branch" | "spec" | "plan";

export interface RoundContextInit {
  workspace: string;
  op: RoundOp;
  type: RoundType;
  round: number;
  /** per-family round-identity params ({ tasks } for task; { base7, head7 } for branch). */
  params?: HandoffParams;
  /** The base token — the round's fixed-point / FIX_BASE anchor ("" = unset). */
  base?: string;
}

/** RoundContext — the review/fix round anchor (Task 6 ②; the review round's unique context). */
export class RoundContext {
  readonly workspace: string;
  readonly op: RoundOp;
  readonly type: RoundType;
  readonly round: number;
  readonly params: HandoffParams;
  readonly base: string;

  constructor(init: RoundContextInit) {
    this.workspace = init.workspace;
    this.op = init.op;
    this.type = init.type;
    this.round = init.round;
    this.params = init.params ?? {};
    this.base = init.base ?? "";
  }

  /** Canonical review-round factory (round baseline builder). */
  static review(
    workspace: string,
    type: RoundType,
    round: number,
    params: HandoffParams = {},
    base?: string,
  ): RoundContext {
    return new RoundContext({ workspace, op: "review", type, round, params, base });
  }

  /** Canonical fix-round factory (the round rides the source review's identity). */
  static fix(
    workspace: string,
    type: RoundType,
    round: number,
    params: HandoffParams = {},
    base?: string,
  ): RoundContext {
    return new RoundContext({ workspace, op: "fix", type, round, params, base });
  }

  /** A copy of this anchor with a different round number (same workspace/op/type/params). */
  withRound(round: number): RoundContext {
    return new RoundContext({
      workspace: this.workspace,
      op: this.op,
      type: this.type,
      round,
      params: this.params,
      base: this.base,
    });
  }

  /** The canonical handoff file name for this round (handoff-naming single truth). */
  get name(): string {
    return handoffName(this.op, this.type, {
      ...this.params,
      ...(this.round != null ? { round: this.round } : {}),
    });
  }

  /** The canonical handoff path (workspace + name). */
  get handoffPath(): string {
    return path.join(this.workspace, this.name);
  }

  /** The round's previous-phase handoff path (the canonical prev table — fix → the source review;
   *  same-family round-1 arithmetic for review). null → no previous phase on record. */
  prevHandoffPath(): string | null {
    return prevHandoffPath(this.workspace, this.op, this.type, this.round, this.params);
  }

  /** The previous review/fix round anchor (round-1 when one exists), null at round 1 /
   *  implement-family rounds. */
  previousRound(): RoundContext | null {
    if (this.round <= 1) return null;
    return new RoundContext({
      workspace: this.workspace,
      op: this.op,
      type: this.type,
      round: this.round - 1,
      params: this.params,
      base: this.base,
    });
  }
}
