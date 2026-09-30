// packages/cdd-engine/src/artifacts/handoff.ts — Handoff typed carrier class (Task 6 ④): build /
// name / persist / finalize — the engine's handoff identity+IO carrier, layered over the canonical
// naming (handoff-namespace families) + write (Workspace.writeJson) + finalization (finalize.ts)
// single points. Schema validation stays on the schema face (HandoffSchemaValidator —
// rules/schema.ts); this class never adds a second enforcement implementation (Task 5 ② / Task 6 ④
// measurement contract).
//
// T6 (the workspace-domain consolidation): the handoff-namespace family-naming surface (formerly handoff/naming.ts)
// migrates here as HANDOFF STATICS — handoffName / familyConfig / roundPattern / resolveNextRound /
// prevHandoffPath + the HandoffParams type are the single naming-point, zero bare function exports
// (Criterion ②). The workspace derivation surface (workspaceSlug / resolveWorkspace /
// materializeWorkspace) moves to infra/workspace.ts (WorkspaceRoot/Workspace — the slug-derivation
// single entry is WorkspaceRoot#for). The constructor's `workspace` is now the canonical Workspace
// object — path derivation is owned by the class (name → path(workspace + name)).

import path from "node:path";
import { globSync } from "tinyglobby";
import { TaskGroup } from "../domain/task-group.ts";
import { ConfigLoader } from "../infra/config.ts";
import { invariant } from "../infra/exit.ts";
import type { Workspace } from "../infra/workspace.ts";
import { finalizeHandoff } from "./handoff/finalize.ts";
import { writeHandoff } from "./handoff/write.ts";

const NAMESPACE = new ConfigLoader().handoffNamespace();
const { families } = NAMESPACE;

export interface HandoffParams {
  /** The dispatch group's canonical key string (TaskGroup#key() — comma-joined full list:
   * `--tasks 1` → `"1"` · `--tasks 1,2` → `"1,2"`) — fills the canonical `{tasks}` placeholder of
   * the task handoff families. The key IS the group identity (no second form). */
  tasks?: string;
  base7?: string;
  head7?: string;
  round?: number | string;
}

/** Scan-shape key grammar: the TaskGroup key pattern's body without its ^…$ anchors (the
 * roundPattern scan placeholder — the key grammar's single source is GROUP_KEY_PATTERN; no second
 * hand-written scan regex). */
function scanGroupKeyPattern(): string {
  const src = TaskGroup.GROUP_KEY_PATTERN.source;
  return src.startsWith("^") && src.endsWith("$") ? src.slice(1, -1) : src;
}

function familyKey(op: string, type: string): string {
  return `${op}.${type}`;
}

function family(
  op: string,
  type: string,
): { name: string; round?: string; prev?: Record<string, string> } {
  const f = families[familyKey(op, type)] as
    | { name: string; round?: string; prev?: Record<string, string> }
    | undefined;
  invariant(f, `unknown handoff family: ${op}.${type}`);
  return f;
}

// Placeholder concrete replacement (regexp escaping is roundPattern's concern, not applied here).
function fillName(name: string, params: HandoffParams = {}): string {
  return name
    .replaceAll("{tasks}", params.tasks ?? "")
    .replaceAll("{base7}", params.base7 ?? "")
    .replaceAll("{head7}", params.head7 ?? "")
    .replaceAll("{round}", String(params.round ?? ""));
}

export interface HandoffInit {
  workspace: Workspace;
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
  workspace?: Workspace;
  tasks?: number[];
}

/** Handoff — the typed carrier for a handoff artifact (Task 6 ④): construct with an identity, read
 *  the carrier / persist a payload (merge or full-replace) / run the canonical finalization. The
 *  name/path derive from the handoff-namespace families' single truth; the write side goes through
 *  the workspace JSON pair (Workspace.readJson/writeJson — mkdir + stringify + writeFileSync);
 *  the finalize side delegates to finalizeHandoff (the single finalization point). */
export class Handoff {
  readonly workspace: Workspace;
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
    workspace: Workspace,
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
  static forDocs(
    workspace: Workspace,
    phase: string,
    type: "spec" | "plan",
    round: number,
  ): Handoff {
    return new Handoff({ workspace, phase, type, round });
  }

  // ---- handoff-namespace family naming (formerly artifacts/handoff/naming.ts — statics) ----

  /** familyConfig(op, type) → canonical family config (live reference to the canonical families
   * object — readonly contract, callers must not mutate the returned object). The schema/return/
   * fixTemplate data (templates.ts reviewArtifactConfig and cdd fix read through this surface;
   * naming never duplicates the literals). */
  static familyConfig(
    op: string,
    type: string,
  ): { name: string; round?: string; prev?: Record<string, string> } {
    return family(op, type);
  }

  /** roundPattern(op, type, params) → ^...$ RegExp, two shapes:
   *   scan shape (params.tasks absent — workspace round scanning): {round}→(\d+), {tasks}→ the
   *     TaskGroup key grammar (GROUP_KEY_PATTERN body: \d+(?:,\d+)* — any task group of the family
   *     hits the round capture group), {base7}/{head7}→[0-9a-f]{7} — wide (any group/ref of the
   *     family hits the round capture group);
   *   concrete shape (params provides {tasks}/{base7}/{head7} — Convergence prev / round validation):
   *     placeholders → literals, exact-ref match.
   * Shape discrimination = params.tasks presence (task family), no probe flag.
   * Note: the single `.` escape below also covers `..` (branch's base7..head7 segment is escaped
   * char-by-char to `\.\.`) — no separate handling needed. */
  static roundPattern(op: string, type: string, params: HandoffParams = {}): RegExp {
    const f = family(op, type);
    const groupPinned = ["task"].includes(type) && params.tasks != null;
    const pattern = f.name
      .replaceAll("{round}", "(\\d+)")
      .replaceAll("{tasks}", groupPinned ? String(params.tasks) : scanGroupKeyPattern())
      .replaceAll("{base7}", params.base7 ? params.base7 : "[0-9a-f]{7}")
      .replaceAll("{head7}", params.head7 ? params.head7 : "[0-9a-f]{7}")
      .replaceAll(".", "\\.");
    return new RegExp(`^${pattern}$`);
  }

  /** handoffName(op, type, params) → concrete file name (the handoff artifact's naming single
   * truth = canonical name + parameter filling). */
  static handoffName(op: string, type: string, params: HandoffParams = {}): string {
    return fillName(family(op, type).name, params);
  }

  /** resolveNextRound(workspace, op, type, opts) → maxR+1 (for round:"increment" families).
   * Shape discrimination via opts: no tasks pin → wide scan (cross-group rounds); task family with
   * {tasks} → groupPinned exact-group rounds (cdd task review derivation prevents cross-group mixing);
   * branch with concrete base7/head7 → per-ref rounds. All cdd consumers (spec/plan/branch/task)
   * go through this layer.
   * glob via tinyglobby: a top-level `*` scan of the workspace (onlyFiles) replaces the legacy
   * hand-written directory walk — same result set, shared toolchain. Missing workspace (ENOENT)
   * → default round 1; real errors rethrow (same fail-open semantics as the legacy catch). */
  static resolveNextRound(
    workspace: string,
    op: string,
    type: string,
    opts: HandoffParams = {},
  ): number {
    const re = Handoff.roundPattern(op, type, opts);
    let max = 0;
    let files: string[];
    try {
      files = globSync("*", {
        cwd: workspace,
        onlyFiles: true,
        dot: true,
        expandDirectories: false,
      });
    } catch (err) {
      // Only a missing workspace (ENOENT) collapses to default round 1; real errors rethrow.
      if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
      return 1;
    }
    for (const f of files) {
      const m = path.basename(f).match(re);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max + 1;
  }

  /** prevHandoffPath(workspace, op, type, round, opts) → previous-round handoff path | null.
   * Two-mechanism boundary (canonical prev table): the cross-family prev table (review.task + all
   * fix families — runner fixed-point reads) wins; other review families → same-family round-1
   * arithmetic (Convergence prev). Work-type with no prev (implement) → null. */
  static prevHandoffPath(
    workspace: string,
    op: string,
    type: string,
    round: number,
    opts: HandoffParams = {},
  ): string | null {
    const f = family(op, type);
    // Cross-family dependency table first (prev table exists only on review.task and fix families).
    // round1 has no dedicated row (fix families) → falls back to the roundR entry — the dependency
    // expression is identical across rounds.
    const prevExpr = f.prev?.[round === 1 ? "round1" : "roundR"] ?? f.prev?.roundR;
    if (prevExpr) {
      const [prevFamily, roundRef] = prevExpr.split(":");
      const [prevOp, prevType] = prevFamily.split(".");
      let prevRound = round;
      if (roundRef === "R-1") prevRound = round - 1; // :R / :R-1 relative-round conversion
      const prevParams: HandoffParams & { round?: number | string } = { ...opts, round: prevRound };
      if (families[prevFamily].round === "fixed") delete prevParams.round; // implement has no round
      return path.join(workspace, Handoff.handoffName(prevOp!, prevType!, prevParams));
    }
    // Same-family round-1 arithmetic (Convergence prev): only for review families without a prev
    // table (spec/plan/branch).
    if (op === "review" && round > 1) {
      return path.join(workspace, Handoff.handoffName(op, type, { ...opts, round: round - 1 }));
    }
    return null;
  }

  // ---- carrier surface (over the canonical Workspace) ----

  /** The canonical file name for this identity (handoff-namespace single truth). */
  get name(): string {
    return Handoff.handoffName(this.phase, this.type, {
      ...this.params,
      ...(this.round != null ? { round: this.round } : {}),
    });
  }

  /** The canonical on-disk path (workspace.path + name). */
  get path(): string {
    return path.join(this.workspace.path, this.name);
  }

  /** Read the carrier; missing / corrupt → null (readJson fail-open). */
  read(): Record<string, unknown> | null {
    return this.workspace.readJson<Record<string, unknown>>(this.name);
  }

  /** Persist a payload: default full-replace (the engine is the carrier's sole author, T7);
   *  replace:false → shallow-merge (the H6 chain-update semantics — the former writeHandoff).
   *  Both route through Workspace.writeJson (ensure + stringify + writeFileSync). */
  persist(
    data: Record<string, unknown>,
    opts: { replace?: boolean } = {},
  ): Record<string, unknown> {
    if (opts.replace === false) {
      // Shallow-merge path (the H6 chain-update semantics) routes through the single merge
      // implementation — writeHandoff, never a second read-modify-write copy.
      return writeHandoff(path.join(this.workspace.path, this.name), data);
    }
    this.workspace.writeJson(this.name, data);
    return data;
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
    });
  }
}
