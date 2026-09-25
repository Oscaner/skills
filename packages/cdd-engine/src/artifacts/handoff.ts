// packages/cdd-engine/src/artifacts/handoff.ts — Handoff typed carrier class (Task 6 ④): build /
// name / persist / finalize — the engine's handoff identity+IO carrier, layered over the canonical
// naming (naming.ts) + write (write.ts) + finalization (finalize.ts) single points. Schema
// validation stays on the schema face (HandoffSchemaValidator — rules/schema.ts); this class never
// adds a second enforcement implementation (Task 5 ② / Task 6 ④ 口径).

import { finalizeHandoff } from "./handoff/finalize.ts";
import { type HandoffParams, handoffName } from "./handoff/naming.ts";
import { readJson, writeHandoff, writeOwnHandoff } from "./handoff/write.ts";

export interface HandoffInit {
  workspace: string;
  /** dispatch phase (implement / review / fix / branch-review). */
  phase: string;
  /** family type (task / branch / spec / plan). */
  type: string;
  round?: number;
  /** per-family params ({ tasks } for task; { base7, head7 } for branch). */
  params?: HandoffParams;
}

export interface HandoffFinalizeOptions {
  mode?: string;
  returnBlock?: string[];
  agentHandoff?: Record<string, unknown> | null;
  brief?: string;
  repoRoot?: string | null;
  workspace?: string;
  tasks?: number[];
  resumeScopeBase?: string | null;
}

/** Handoff — the typed carrier for a handoff artifact (Task 6 ④): construct with an identity, read
 *  the carrier / persist a payload (merge or full-replace) / run the canonical finalization. The
 *  name/path derive from handoff-naming's single truth; the write side goes through write.ts's two
 *  contracts (writeHandoff shallow-merge, writeOwnHandoff full-replace); the finalize side
 *  delegates to finalizeHandoff (the single finalization point). */
export class Handoff {
  readonly workspace: string;
  readonly phase: string;
  readonly type: string;
  readonly round?: number;
  readonly params: HandoffParams;

  constructor(init: HandoffInit) {
    this.workspace = init.workspace;
    this.phase = init.phase;
    this.type = init.type;
    this.round = init.round;
    this.params = init.params ?? {};
  }

  /** Task-family factory — `tasks` is the dispatch group's key string (the CLI `--tasks` form). */
  static forTask(
    workspace: string,
    phase: string,
    options: { tasks: string; round?: number },
  ): Handoff {
    return new Handoff({
      workspace,
      phase,
      type: "task",
      round: options.round,
      params: { tasks: options.tasks },
    });
  }

  /** Docs-family factory (spec/plan review/fix). */
  static forDocs(workspace: string, phase: string, type: "spec" | "plan", round: number): Handoff {
    return new Handoff({ workspace, phase, type, round });
  }

  /** The canonical file name for this identity (handoff-naming single truth). */
  get name(): string {
    return handoffName(this.phase, this.type, {
      ...this.params,
      ...(this.round != null ? { round: this.round } : {}),
    });
  }

  /** The canonical on-disk path (workspace + name). */
  get path(): string {
    return `${this.workspace}/${this.name}`.replace(/\/{2,}/g, "/");
  }

  /** Read the carrier; missing / corrupt → null (readJson fail-open). */
  read(): Record<string, unknown> | null {
    return readJson(this.path);
  }

  /** Persist a payload: default full-replace (the engine is the carrier's sole author, T7);
   *  replace:false → shallow-merge (the H6 chain-update semantics — writeHandoff). */
  persist(
    data: Record<string, unknown>,
    opts: { replace?: boolean } = {},
  ): Record<string, unknown> {
    return opts.replace === false
      ? writeHandoff(this.path, data)
      : writeOwnHandoff(this.path, data);
  }

  /** Run the canonical finalization (finalizeHandoff — the single finalization entry). */
  async finalize(opts: HandoffFinalizeOptions = {}): Promise<{
    handoff: Record<string, unknown> | null;
    exitCode: number;
  }> {
    return finalizeHandoff({
      mode: opts.mode,
      returnBlock: opts.returnBlock ?? [],
      agentHandoff: opts.agentHandoff ?? null,
      brief: opts.brief,
      repoRoot: opts.repoRoot,
      workspace: opts.workspace ?? this.workspace,
      tasks: opts.tasks,
      resumeScopeBase: opts.resumeScopeBase ?? null,
    });
  }
}
