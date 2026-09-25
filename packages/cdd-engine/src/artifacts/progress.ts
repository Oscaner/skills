// packages/cdd-engine/src/artifacts/progress.ts — ProgressLedger class (Task 8 port of progress.mjs;
// ex lib/state/progress.mjs; Task 6 ③ OOP restructure — the six-key progress.json ledger is ONE
// class: read/write/create/migrate + the round/scope derivations + the rowFor/entryFor single-source
// pair are instance methods, zero bare function exports). Replaces the progress.md-based
// timeoutCount with structured JSON. Transparent migration: read auto-migrates progress.md →
// progress.json.
// six-key ledger: plan / timeoutCount / contractViolationCount / engineSelfWrittenCount /
// engineRecoveryCount / tasks — the fixed top-level key set (COUNTER_ZERO satisfies-checks the
// counter arm; drift fails to compile, AC14). Write invariant: every write goes through #write —
// the retired-field strip (dead top-level keys + the retired tasks[N].status) converges there, so
// no caller can re-introduce a legacy field.
// P6 T24 B: the return block's `counters:` line construction moved to
// src/artifacts/return-block.ts#returnCountersLine (its single point) — progress drops the
// counters() import, breaking the failure⇄progress mutual import (counters() stays the
// rules/failure.ts owner; progress only reads/writes).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { GitClient } from "../infra/git.ts";

// The progress schema dropped lastDispatchHead/degradationLog (T8: dead fields; check-head/
// engine-recovery degradation, superseded by deriveReviewStatus/engineRecoveryCount);
// degradationLogItem retired with degradationLog.

/** progress.json row — keyed by scalar `task` for single-task groups (`--tasks 1` — backward
 * compatible with every per-task consumer) or by the group key string for multi-task groups
 * (`--tasks 1,2` → `{ group: "1,2" }` — the P4.3/P4.4 group is the dispatch unit; the key IS the
 * TaskGroup key — comma-joined, no second form — round/handoff/progress/residue land per group). */
export type TaskLedgerRow =
  | { task: number; rounds?: Record<string, number>; scope_base?: string }
  | { group: string; rounds?: Record<string, number>; scope_base?: string };

/** progress.json shape — top-level keys only (plan / counters / tasks). Counters derive from the
 * canonical failure-categories table (create writes all counter fields at 0). Typed carrier
 * (P4.4 Task 5): all members declared, no index-signature surface. */
export interface ProgressData {
  plan?: string;
  timeoutCount?: number;
  contractViolationCount?: number;
  engineSelfWrittenCount?: number;
  engineRecoveryCount?: number;
  tasks: TaskLedgerRow[];
}

/** COUNTER_ZERO — the fixed counter-member key set, a single typed source beside ProgressData.
 * Identifier (unquoted) object keys over the declared members, `satisfies`-checked against the
 * counter arm of ProgressData (Omit plan/tasks): adding a counter member to ProgressData without
 * this table fails to compile (loud drift, AC14). CounterKey is `keyof` this table — the type-level
 * authority the dispatch surface (rules/failure.ts incrementFailureCounter) resolves canonical
 * `.counter` field names against; construction points carry zero quoted counter-name literals
 * (channel audit row 13). */
export const COUNTER_ZERO = {
  timeoutCount: 0,
  contractViolationCount: 0,
  engineSelfWrittenCount: 0,
  engineRecoveryCount: 0,
} as const satisfies Record<keyof Omit<ProgressData, "plan" | "tasks">, 0>;

/** CounterKey — the four declared counter members as a literal union (derived, never quoted). */
export type CounterKey = keyof typeof COUNTER_ZERO;

/** Ledger lookup key — a scalar task number (single-task group) or the group key string. */
export type LedgerKey = number | string;

// ---- tasks[N].scope_base — task-level contribution anchor — the scope ledger (T27 spec T7.6) ----
// `base` one name, two meanings (T26 defect): roundBase is this round's commit seat (correct per-round), scopeBase
// is the task's TRUE contribution start — must survive round death and stay stable across re-dispatches
// (converge in the normal flow, diverge on resume rounds). The ledger is the engine's sole writer;
// it is NOT an agent-authored handoff key. Seed = first-round implement's brief TASK_BASE via
// seedScopeBase at materialization time (earliest-wins); a resume-declared base may only move the
// ledger STRICTLY earlier (via moveTaskScopeBaseEarlier — recovered commits sit below any round's
// brief snapshot). Read fallback: taskScopeBase → null, then dispatch/task.ts falls back to the
// legacy prev.commits.base chain (zero behavior change for tasks without a ledger).
export const SHA40_RE = /^[0-9a-f]{40}$/;

/** ProgressLedger — the progress.json single owner (Task 6 ③ six-key ledger). All reads/writes and the
 *  round/scope derivations are instance methods; the rowFor/entryFor pair is the ledger's single
 *  single/group row lookup source (the dispatch layer's ensure-row writeback consumes the same
 *  methods). Constructor-injected git seam (the scope-ledger ancestry judgment), defaulting to a
 *  fresh GitClient. */
export class ProgressLedger {
  readonly #git: GitClient;

  constructor(git: GitClient = new GitClient()) {
    this.#git = git;
  }

  /** isCounterKey(field): type guard admitting only canonical field names that name a declared
   * ProgressData counter member. A drift field (engine-config naming a key ProgressData does not
   * declare) fails the guard and the caller throws — the typed carrier never takes a dynamic-key
   * write (no Record<string, unknown> view / no index-signature travel on ProgressData). */
  isCounterKey(field: string): field is CounterKey {
    return Object.hasOwn(COUNTER_ZERO, field);
  }

  /** rowFor(data, key) — the ledger row lookup single point: a number key or a single-task group key
   * (`"1"`) resolves the `{ task: N }` row (post-migration single groups keep the legacy row shape);
   * a multi-task group key (`"1,2"`) resolves the `{ group }` row. Exported as the shared single/group
   * row lookup — dispatch/task.ts uses it for the APPROVED-review ensure-row writeback (single source,
   * no inline re-implementation of the dichotomy). */
  rowFor(data: ProgressData, key: LedgerKey): TaskLedgerRow | undefined {
    if (typeof key === "number") return data.tasks.find((t) => "task" in t && t.task === key);
    const single = /^\d+$/.test(key) ? Number(key) : null;
    return single != null
      ? data.tasks.find((t) => "task" in t && t.task === single)
      : data.tasks.find((t) => "group" in t && t.group === key);
  }

  /** entryFor(key) — constructs a fresh row for a key absent from the ledger (single key → task row;
   * multi group key → group row). Exported alongside rowFor — the single-source pair the dispatch
   * layer shares for the ensure-row writeback. */
  entryFor(key: LedgerKey): TaskLedgerRow {
    const single = typeof key === "number" || /^\d+$/.test(key);
    return single ? { task: Number(key) } : { group: String(key) };
  }

  /** read(progressDir, plan): read progress.json from progressDir.
   * Transparent migration: if progress.json is missing but progress.md exists, migrate first.
   * If neither exists, return empty progress.
   * plan (T7 optional 2nd arg): recorded into progress on first create/migrate via
   * create(plan) — the absolute path of the `--plan` arg. Single-arg consumers
   * (incrementRound / incrementRecovery internals) are unchanged: at their call time progress.json
   * already exists and plan does not participate in derivation. */
  read(progressDir: string, plan?: string): ProgressData {
    const jsonPath = path.join(progressDir, "progress.json");
    if (existsSync(jsonPath)) {
      try {
        return JSON.parse(readFileSync(jsonPath, "utf8")) as ProgressData;
      } catch {
        // Corrupted file — fall through to migration
      }
    }
    return this.migrateIfNeeded(progressDir, plan);
  }

  /** write(progressDir, data): write data to progress.json in progressDir.
   * The dead fields (lastDispatchHead/degradationLog) are dropped on write — a legacy progress.json
   * (a live pre-degradation file) carrying the old keys gets a one-time GC on first write-back.
   * Task 30 ②: tasks[N].status is retired from the schema — any legacy row still carrying it
   * converges on the first write-back (deriveTaskState is the single TaskState source; the row keeps
   * only facts). Strips on a serialization copy, never mutates the caller's object. Typed carrier
   * (P4.4 Task 5): the strip is expressed as typed member writes over the declared ProgressData keys
   * — the two legacy top-level keys and the retired row status are dropped BY CONSTRUCTION without a
   * Record<string, unknown> view / bare `delete` against the typed carrier. */
  write(progressDir: string, data: ProgressData): void {
    const jsonPath = path.join(progressDir, "progress.json");
    const clean: ProgressData = { tasks: [] };
    if (data.plan !== undefined) clean.plan = data.plan;
    if (data.timeoutCount !== undefined) clean.timeoutCount = data.timeoutCount;
    if (data.contractViolationCount !== undefined)
      clean.contractViolationCount = data.contractViolationCount;
    if (data.engineSelfWrittenCount !== undefined)
      clean.engineSelfWrittenCount = data.engineSelfWrittenCount;
    if (data.engineRecoveryCount !== undefined)
      clean.engineRecoveryCount = data.engineRecoveryCount;
    if (Array.isArray(data.tasks)) {
      clean.tasks = data.tasks.map((t) => {
        const row: TaskLedgerRow = "group" in t ? { group: t.group } : { task: t.task };
        if (t.rounds !== undefined) row.rounds = t.rounds;
        if (t.scope_base !== undefined) row.scope_base = t.scope_base;
        return row;
      });
    }
    writeFileSync(jsonPath, JSON.stringify(clean, null, 2));
  }

  /** create(plan): fresh progress object for a given plan.
   * T8: dead fields deleted — progress.json top level is plan/timeoutCount/engineRecoveryCount/tasks.
   * T6: contractViolationCount / engineSelfWrittenCount added (init 0) — the six keys match the
   * canonical counter column (engine-config.json#failureCategories) verbatim
   * (src/artifacts/__tests__/progress.test.ts six-key assertion). */
  create(plan?: string): ProgressData {
    return {
      plan: plan || "",
      timeoutCount: 0,
      contractViolationCount: 0,
      engineSelfWrittenCount: 0,
      engineRecoveryCount: 0,
      tasks: [],
    };
  }

  /** getRound: the round number to dispatch next (last completed + 1, or 1 if none). Keyed by the
   * dispatch unit — a scalar task number or a group key string (P4.3: the group is the dispatch unit;
   * single groups resolve the per-task row, multi-task groups the `{ group }` row). */
  getRound(progressData: ProgressData, key: LedgerKey, mode: string): number {
    const taskEntry = this.rowFor(progressData, key);
    const lastCompleted = taskEntry?.rounds?.[mode] ?? 0;
    return lastCompleted + 1;
  }

  /** incrementRound: record that a round has been dispatched (call after any handoff is written to
   * disk, including BLOCKED/TIMEOUT). Creates the row (task or group kind) if absent. */
  incrementRound(progressDir: string, key: LedgerKey, mode: string): void {
    const data = this.read(progressDir);
    let taskEntry = this.rowFor(data, key);
    if (!taskEntry) {
      taskEntry = this.entryFor(key);
      data.tasks.push(taskEntry);
    }
    taskEntry.rounds ??= {}; // migrate pre-rounds task entries that lack the field
    taskEntry.rounds[mode] = (taskEntry.rounds[mode] ?? 0) + 1;
    this.write(progressDir, data);
  }

  /** incrementRecovery: engineRecoveryCount increments (D14 — every progress.json field is
   * engine-written). The runner calls this whenever the engine writes a BLOCKED handoff
   * (BLOCKED/engine-error path); the orchestrator-layer skill (cli-driven-development
   * §engine-recovery) only READS it to decide retry (count < 2 → re-dispatch; count ≥ 2 → terminal
   * engine-error), never increments itself. */
  incrementRecovery(progressDir: string): void {
    const data = this.read(progressDir);
    data.engineRecoveryCount = (data.engineRecoveryCount ?? 0) + 1;
    this.write(progressDir, data);
  }

  /** taskScopeBase: the ledger's current scope_base for the key, or null when absent/invalid
   *  (a non-40-hex stored value is treated as a missing ledger — dispatch falls back to legacy). */
  taskScopeBase(progressDir: string, key: LedgerKey): string | null {
    const entry = this.rowFor(this.read(progressDir), key);
    const v = entry?.scope_base;
    return typeof v === "string" && SHA40_RE.test(v) ? v : null;
  }

  /** seedScopeBase: earliest-wins seed of the ledger for the key. Creates the row on demand.
   *  Returns the ledger value AFTER the call: an existing valid anchor wins (the return equals the
   *  current value, the change is a no-op); an invalid stored value is healed by the first valid seed;
   *  a non-40-hex/absent input never writes (returns the current ledger value — null when empty). */
  seedScopeBase(progressDir: string, key: LedgerKey, base: string): string | null {
    const data = this.read(progressDir);
    const current = this.rowFor(data, key)?.scope_base;
    if (typeof current === "string" && SHA40_RE.test(current)) return current; // earliest-wins
    if (!SHA40_RE.test(base)) return current ?? null;
    let taskEntry = this.rowFor(data, key);
    if (!taskEntry) {
      taskEntry = this.entryFor(key);
      data.tasks.push(taskEntry);
    }
    taskEntry.scope_base = base;
    this.write(progressDir, data);
    return base;
  }

  /** moveTaskScopeBaseEarlier: the resume-declared-base move lane. Only a candidate that is a strict
   *  HEAD ancestor AND a strict (candidate !== current) ancestor of the current ledger value may pull
   *  the ledger earlier — a descendant/later commit, a ==head value (fraud lane), a non-ancestor
   *  forgery (checked via git merge-base output comparison — see infra/git.ts mergeBaseIsAncestor),
   *  and a non-40-hex candidate all leave the ledger intact. Ledger missing → falls back to the seed
   *  lane. Returns the ledger value after the call. */
  async moveTaskScopeBaseEarlier(
    progressDir: string,
    key: LedgerKey,
    candidate: string,
    cwd: string,
    head: string,
  ): Promise<string | null> {
    const current = this.taskScopeBase(progressDir, key);
    if (current === null) return this.seedScopeBase(progressDir, key, candidate);
    if (!SHA40_RE.test(candidate) || candidate === current || candidate === head) return current;
    const isAncestorOfCurrent = await this.#git.mergeBaseIsAncestor(cwd, candidate, current);
    const isAncestorOfHead = await this.#git.mergeBaseIsAncestor(cwd, candidate, head);
    if (!isAncestorOfCurrent || !isAncestorOfHead) return current;
    const data = this.read(progressDir);
    const taskEntry = this.rowFor(data, key);
    if (taskEntry) {
      taskEntry.scope_base = candidate;
      this.write(progressDir, data);
      return candidate;
    }
    return current;
  }

  /** migrateFromProgressMD: parse progress.md and return a structured progress object.
   * Returns null when progress.md does not exist. */
  migrateFromProgressMD(progressDir: string): ProgressData | null {
    const mdPath = path.join(progressDir, "progress.md");
    if (!existsSync(mdPath)) return null;
    const content = readFileSync(mdPath, "utf8");

    // Parse timeoutCount from `# timeoutCount: N` (single hash, matching runner.mjs's write format)
    const timeoutMatch = content.match(/^# timeoutCount: (\d+)/m);
    const timeoutCount = timeoutMatch ? parseInt(timeoutMatch[1], 10) : 0;

    // Parse engineRecoveryCount from `# engine-recovery-count: N` (single hash)
    const recoveryMatch = content.match(/^# engine-recovery-count: (\d+)/m);
    const engineRecoveryCount = recoveryMatch ? parseInt(recoveryMatch[1], 10) : 0;

    // Parse completed tasks: `Task N: complete` — Task 30 ②: migrated rows are status-free (the
    // legacy complete/pending marker is subsumed by deriveTaskState).
    const tasks: Array<{ task: number }> = [];
    const taskLines = content.match(/Task (\d+): complete/g) || [];
    for (const line of taskLines) {
      const num = parseInt(line.match(/Task (\d+)/)![1], 10);
      tasks.push({ task: num }); // completedAt omitted for pre-migration tasks
    }

    // Fill in missing tasks (up to the max completed task number)
    const maxTask = tasks.length > 0 ? Math.max(...tasks.map((t) => t.task)) : 0;
    for (let i = 1; i <= maxTask; i++) {
      if (!tasks.find((t) => t.task === i)) tasks.push({ task: i });
    }

    return {
      plan: "",
      timeoutCount,
      engineRecoveryCount,
      tasks: tasks.sort((a, b) => a.task - b.task),
    };
  }

  /** migrateIfNeeded(progressDir, plan): transparent migration.
   * 1. progress.json exists → return it (T6: backfill the two counters when absent and write back —
   *    a legacy four-key object read out must already carry contractViolationCount /
   *    engineSelfWrittenCount for the stdout counters line's value source to be complete)
   * 2. progress.md exists → migrate to progress.json, return migrated data
   * 3. neither → create empty progress (T7: plan recorded via create at the init point;
   *    legacy no-plan semantics fall back to create(plan || "")) */
  migrateIfNeeded(progressDir: string, plan?: string): ProgressData {
    const jsonPath = path.join(progressDir, "progress.json");
    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, "utf8")) as ProgressData;
        // Backfill the two counters (init 0), only writing when actually backfilled (T6) — no no-op
        // overwrite without change (same line as persistFinalized). Judgment by missing/non-numeric
        // rather than unconditional write: a legacy valid number (e.g. existing 5) must not be zeroed.
        let changed = false;
        if (typeof data.contractViolationCount !== "number") {
          data.contractViolationCount = 0;
          changed = true;
        }
        if (typeof data.engineSelfWrittenCount !== "number") {
          data.engineSelfWrittenCount = 0;
          changed = true;
        }
        if (changed) this.write(progressDir, data);
        return data;
      } catch {
        // Corrupted — treat as missing, try migration
      }
    }
    const mdData = this.migrateFromProgressMD(progressDir);
    if (mdData) {
      this.write(progressDir, mdData);
      return mdData;
    }
    const empty = this.create(plan);
    this.write(progressDir, empty);
    return empty;
  }
}
