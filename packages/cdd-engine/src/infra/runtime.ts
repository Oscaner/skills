// packages/cdd-engine/src/infra/runtime.ts — CddRuntime: the engine's single mutable-state owner
// (P4.4 Task 4 「CddRuntime 模块态收编」). Every module-level mutable variable the engine carried
// (— dryRun / the repo-root singleton / the proc lifecycle registry+diskPath+idleTimer / the
// signal-exit code / the cache-profile validator memo / the templates cache) converges into ONE
// class instance; `runtime` (the module singleton) is the process default and the read/write
// surface every legacy import resolves through. The class is the ONLY mutable surface — domain
// interfaces flow through the instance, never a second module-level `let`:
//   · cli/shared.ts  DRY_RUN/setDryRun        → runtime.isDryRun()/setDryRun()
//   · infra/root.ts  initRoot/getRoot          → runtime.initRoot()/getRoot()
//   · infra/proc.ts  (lifecycle exports)        → runtime.* methods (spawnManaged/teardownAll/…)
//   · bin.ts         signalExitCode            → runtime.signalExitCode
//   · infra/registry.ts validateCacheProfile   → runtime (memoized validator)
//   · render/templates.ts CACHE                → runtime.templateCache (the frozen render cache)
// Constructor injection (②): dispatch options carry `runtime?: CddRuntimeLike`; the injected
// instance substitutes the singleton for dryRun/root/proc/templates — engine tests inject a stub
// stand-in to prove every channel goes through the class face.
//
// Layout: this module owns the full process-lifecycle implementation (formerly infra/proc.ts —
// pure stall/termination judges stay module exports, the stateful operations became class
// methods), and proc.ts is now a thin re-export (`export * from ./runtime.ts`) so every legacy
// `../infra/proc.ts` import resolves through the singleton unchanged.
import { execFileSync } from "node:child_process";
import {
  type Dirent,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, { type ValidateFunction } from "ajv";
import { execa } from "execa";

import { exitWithCode, invariant } from "./exit.ts";
import { gitTopLevel } from "./git.ts";

const KILL_SIGNAL = "SIGTERM";
const FORCE_SIGNAL = "SIGKILL";

// ---- unified termination monitor (T26, spec T7.5; configured via engine-config.json#contextContract.timeouts) ----
// Dispatch-phase termination detector: while a spawnManaged dispatch is in flight, one decision
// layer weighs two signals — ① STALL (the dual-signal liveness judge: no growth in process-group
// cumulative CPU nor in the newest workspace mtime for idleWindowMs → presumed hung tool call) and
// ② BUDGET (wall-clock elapsed >= budgetMs → last-resort cap; the sole defense when the stall
// signal fails open — unreadable CPU/tree — or when a dispatch is busy but never finishes). On
// either signal the group is killed and the spawn result surfaces timedOut with the cause
// ("stalled" / "over-budget"); an EXTERNAL SIGTERM (exit shape, monitor never fired) folds in as
// cause "signal". Three distinguishable causes → blockers/notes archive and replay death rounds
// precisely (death can be archived and replayed). The dual-signal criterion stays deliberately
// conservative (precise criterion): a SINGLE unavailable signal (unreadable CPU, missing dir)
// fails open — unknown never kills. The monitor runs when opts.termination is provided.

export interface TerminationConfig {
  /** Wall-clock hard cap (ms) — the budget signal; kills the group when elapsed >= budgetMs. */
  budgetMs?: number;
  /** Directory whose newest file mtime is the tree-progress signal (the dispatch workspace) —
   *  the stall signal's tree leg. Omitted → the stall signal rests on CPU alone. */
  progressPath?: string;
  sampleIntervalMs?: number;
  idleWindowMs?: number;
}

// Code-default termination timings — the SINGLE canonical source for the fallback sites
// (spawnManaged inline fallbacks below, invoke.ts resolveTerminationConfig, rules/failure.ts
// timeoutBlocker). The canonical engine-config.json#contextContract.timeouts overrides them; these
// only fire for callers that pass a bare TerminationConfig without resolved values (tests / direct
// spawnManaged callers). Editing a config-file value must not silently drift from a hand-duplicated
// code constant, so no module re-declares these literals.
export const DEFAULT_SAMPLE_INTERVAL_MS = 60_000;
export const DEFAULT_IDLE_WINDOW_MS = 900_000;

export interface ManagedGroup {
  pgid: number;
  label: string;
  createdAt: number;
  ownerPid: number;
  done: boolean;
}

export interface SpawnResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Unified termination cause (T26): "stalled" (stall signal killed the group), "over-budget"
   *  (budget cap reached), "signal" (external SIGTERM, monitor never fired). Absent when the
   *  process ended naturally. */
  cause?: TerminationCause;
}

export interface SpawnOpts {
  cwd?: string;
  env: NodeJS.ProcessEnv;
  termination?: TerminationConfig;
}

// ---- stall judge (pure, unit-test seam) ----
// The dual-signal criterion lives here as a pure state machine so both acceptance faces
// ("stationary-over-window killed · active never false-killed") are deterministically testable
// without real processes.

export type StallVerdict = "progress" | "unknown" | "idled" | "stalled";

export interface StallSample {
  /** process-group cumulative CPU (ms), summed across group members; null = unreadable. */
  cpuMs: number | null;
  /** newest file mtime (epoch ms) under the progress path; null = unreadable. */
  latestMtimeMs: number | null;
  /** wall-clock sample time (epoch ms). */
  at: number;
}

export interface StallState {
  /** CPU growth is judged against THIS last observed group-cpu sample. The group CPU is a sum
   *  over currently-listed members (`ps -o time= -g`), so it DROPS when a member exits — an
   *  all-time max would stay inflated by an exited heavy tool call and a busy but moderate
   *  survivor burning below that stale max would read 'idled' forever (false-stall vector on the
   *  never-false-killed face). A per-sample baseline re-detects growth the moment the survivors
   *  re-accumulate past their own last reading. */
  lastCpuMs: number | null;
  /** mtime growth is judged against the max ever seen: the newest-file mtime regresses on delete,
   *  so a max baseline is the safe monotone proxy for "files keep being written". */
  maxMtimeMs: number | null;
  /** last sample whose signals showed progress or were unknown (window anchor). */
  idleSince: number | null;
}

export function initialStallState(): StallState {
  return { lastCpuMs: null, maxMtimeMs: null, idleSince: null };
}

export function evaluateStall(
  state: StallState,
  s: StallSample,
  idleWindowMs: number,
): { state: StallState; verdict: StallVerdict } {
  // Fail-open: an unavailable signal (permissions / unreadable dir / process gone) never counts
  // toward the idle window — unknown restarts the anchor, so a decidable stall requires BOTH
  // signals measurable. This is the no-false-kill guard for the "hung tool call CPU≈0" shape: the
  // kill fires only when both signals are demonstrably flat over the whole window.
  if (s.cpuMs == null || s.latestMtimeMs == null) {
    return { state: { ...state, idleSince: s.at }, verdict: "unknown" };
  }
  // Baselines differ per signal (see StallState). CPU: group sum dips on member exit, so growth
  // is judged against the PREVIOUS sample, never the all-time max. mtime: newest-file stamp
  // regresses on delete, so growth is judged against the max ever seen — the safe monotone
  // "files keep being written" proxy.
  const cpuGrew = state.lastCpuMs == null || s.cpuMs > state.lastCpuMs;
  const mtimeAdvanced = state.maxMtimeMs == null || s.latestMtimeMs > state.maxMtimeMs;
  const next: StallState = {
    lastCpuMs: s.cpuMs,
    maxMtimeMs:
      state.maxMtimeMs == null ? s.latestMtimeMs : Math.max(state.maxMtimeMs, s.latestMtimeMs),
    idleSince: cpuGrew || mtimeAdvanced ? s.at : state.idleSince,
  };
  if (cpuGrew || mtimeAdvanced) return { state: next, verdict: "progress" };
  if (next.idleSince == null || s.at - next.idleSince < idleWindowMs) {
    return { state: next, verdict: "idled" };
  }
  return { state: next, verdict: "stalled" };
}

// ---- unified termination judge (T26: one decision layer, two signals) ----
// settleResidue/resume interface (spec T7.5): the dispatch's death is classified into exactly three
// distinguishable causes — the stall signal (dual-signal judge above), the budget signal (wall-clock
// cap, last-resort: liveness fail-open + "busy but never done" sole defense), and an external
// SIGTERM (the exit shape, not this judge). First-cause-wins: a cause is overridden when its own
// condition was provable later than the other's (idle-end vs budget-end). Keep this folding pure and
// unit-testable — spawnManaged feeds real verdicts into it (integration seam, liveness.monitor.test.ts).

export type TerminationCause = "stalled" | "over-budget" | "signal";

export interface TerminationJudge {
  start: number;
  at: number;
  budgetMs: number | undefined;
  stall: StallVerdict;
  idleSince: number | null;
  idleWindowMs: number;
}

/** Pure two-cause judgment (never "signal" — that is derived from the exit shape after await).
 *  Both conditions false → null (dispatch still viable). A declared stall terminates regardless of
 *  the budget — the cap only picks the cause label: stalled wins when the idle window ended first;
 *  over-budget fires when the budget ended earlier or the stall signal failed open (verdict
 *  "unknown" can never become "stalled", leaving the cap as the only defense). */
export function terminationCause(s: TerminationJudge): TerminationCause | null {
  const budgetMs = s.budgetMs ?? null;
  const stalled = s.stall === "stalled";
  if (stalled && budgetMs == null) return "stalled";
  if (stalled && budgetMs != null) {
    if (s.at - s.start < budgetMs) return "stalled"; // budget not yet reached — stall is the real cause
    if ((s.idleSince ?? s.at) + s.idleWindowMs <= s.start + budgetMs) return "stalled"; // idle ended first
    return "over-budget"; // budget ended first
  }
  if (budgetMs != null && s.at - s.start >= budgetMs) return "over-budget";
  return null;
}

// ---- signal samplers ----

// ps time= → ms. Accepts [HH:]MM:SS[.cc] (GNU and BSD ps) and sums multi-line output (the whole
// process group: every member's cumulative CPU — a long-running descendant tool burns group CPU and
// correctly counts as activity, while a hung tool call leaves it flat).
export function parsePsCpuTime(output: string): number | null {
  let totalMs = 0;
  let any = false;
  for (const line of output.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(":");
    let seconds = 0;
    if (parts.length === 2) seconds = Number(parts[0]) * 60 + Number(parts[1]);
    else if (parts.length === 3)
      seconds = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
    else continue;
    if (Number.isNaN(seconds) || seconds < 0) continue;
    totalMs += seconds * 1000;
    any = true;
  }
  return any ? Math.round(totalMs) : null;
}

/** Whole-group cumulative CPU (ms): `ps -o time= -g <pgid>` summed. null on any failure (fail-open
 * fuel — an unreadable CPU signal never causes a kill by itself). */
export function sampleGroupCpuMs(pgid: number): number | null {
  try {
    const out = execFileSync("ps", ["-o", "time=", "-g", String(pgid)], { encoding: "utf8" });
    return parsePsCpuTime(out);
  } catch {
    return null;
  }
}

/** Newest file mtime (epoch ms) under dir, recursively, skipping .git and symlinks, bounded by
 * maxDepth. null when the dir is missing/unreadable (fail-open: an unobserved tree never stalls). */
export function latestFileMtimeMs(dir: string, maxDepth = 8): number | null {
  let maxMs: number | null = null;
  const walk = (d: string, depth: number): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return; // unreadable subtree — keep scanning siblings, no throw
    }
    for (const e of entries) {
      if (e.name === ".git") continue;
      const full = path.join(d, e.name);
      try {
        if (e.isDirectory() && !e.isSymbolicLink() && depth < maxDepth) walk(full, depth + 1);
        else if (e.isFile()) maxMs = Math.max(maxMs ?? 0, statSync(full).mtimeMs);
      } catch {
        /* raced removal — skip */
      }
    }
  };
  walk(dir, 0);
  return maxMs;
}

// ---- monitor orchestration ----
// Runs while spawnManaged awaits the child. Two optional signals, one decision layer, first cause
// wins: each tick samples both progress signals and feeds the pure judge (stall leg); a wall-clock
// timer fires at budgetMs (budget leg). On either, onTerminate (kill the group) fires once; the
// stop() function returns the recorded cause (or null if neither signal ever fired — the child
// ended naturally). stop() cancels the timers the moment the child resolves — a dispatch that
// simply took longer than a few sample ticks is never penalized after the fact.
export interface TerminationMonitorOpts {
  pgid: number;
  /** Dispatch start clock (epoch ms) — the budget's elapsed anchor. */
  start: number;
  progressPath?: string;
  budgetMs?: number;
  sampleIntervalMs: number;
  idleWindowMs: number;
  /** Kill the group. Returns false when the group is already gone (a just-finished dispatch must
   *  never be tainted as terminated) — then no cause is recorded. */
  onTerminate: (cause: "stalled" | "over-budget") => boolean;
}

export function startTerminationMonitor(
  opts: TerminationMonitorOpts,
): () => TerminationCause | null {
  const { pgid, start, progressPath, budgetMs, sampleIntervalMs, idleWindowMs, onTerminate } = opts;
  let state = initialStallState();
  let lastVerdict: StallVerdict = "unknown";
  let cause: TerminationCause | null = null;
  let stallTimer: NodeJS.Timeout | null = null;
  let budgetTimer: NodeJS.Timeout | null = null;
  const fire = (c: "stalled" | "over-budget"): void => {
    if (cause) return; // first-cause-wins
    if (!onTerminate(c)) return; // group gone before the signal resolved — never taint
    cause = c;
    if (stallTimer) clearInterval(stallTimer);
    if (budgetTimer) clearTimeout(budgetTimer);
  };
  const tick = (): void => {
    if (cause) return;
    const s: StallSample = {
      cpuMs: sampleGroupCpuMs(pgid),
      latestMtimeMs: progressPath ? latestFileMtimeMs(progressPath) : null,
      at: Date.now(),
    };
    const { state: next, verdict } = evaluateStall(state, s, idleWindowMs);
    state = next;
    lastVerdict = verdict;
    // The pure judge is the single decision point: it folds the current stall verdict + budget
    // into a cause — a declared stall wins when its idle window ended before the budget (or the
    // budget has not yet arrived); when the budget ended first the SAME tick surfaces over-budget.
    const c = terminationCause({
      start,
      at: s.at,
      budgetMs,
      stall: verdict,
      idleSince: next.idleSince,
      idleWindowMs,
    });
    // narrow the judge's termination cause to the monitor's two kill signals
    if (c === "stalled" || c === "over-budget") fire(c);
  };
  if (progressPath) {
    tick(); // first sample lands immediately (the window anchor starts at dispatch, not the first tick)
    stallTimer = setInterval(tick, sampleIntervalMs);
    stallTimer.unref?.();
  }
  if (budgetMs != null) {
    // The budget leg consults the SAME judge — it must not double-book the stall leg's verdict.
    // Recompute the verdict a tick landing exactly at the budget boundary would derive from the
    // current stall state: when the last sample was "idled" (both signals measurable and flat since
    // the anchor) and the idle window completed at or before the budget end (idleSince + window <=
    // start + budgetMs), that boundary tick would have declared "stalled" — idle ended first, so
    // first-cause-wins labels the death a stall, not a budget expiry. This closes the
    // (0, sampleIntervalMs] gap between the last tick and the budget, where the window can complete
    // with no tick in flight to observe it. "progress" / "unknown" / uncompleted "idled" stay on
    // lastVerdict → the judge resolves them to over-budget at the boundary (budget reached first).
    budgetTimer = setTimeout(() => {
      if (cause) return;
      const at = start + (budgetMs as number);
      const stalledAtBudget =
        lastVerdict === "idled" && state.idleSince != null && state.idleSince + idleWindowMs <= at;
      const c = terminationCause({
        start,
        at,
        budgetMs,
        stall: stalledAtBudget ? "stalled" : lastVerdict,
        idleSince: state.idleSince,
        idleWindowMs,
      });
      // narrow the judge's termination cause to the monitor's two kill signals
      if (c === "stalled" || c === "over-budget") fire(c);
    }, budgetMs);
  }
  return () => {
    if (stallTimer) clearInterval(stallTimer);
    if (budgetTimer) clearTimeout(budgetTimer);
    return cause;
  };
}

// ---- the templates render cache slots (P4.4 Task 4: the former render/templates.ts module-level
// CACHE object — the class owns the object; the render helpers read/write it through the field). ----
// The render-specific members (contract / compiled handlebars delegate) are typed loosely here and
// narrowed inside render/templates.ts (the shared shape carries the counters the process-wide
// memoization stats surface reports).
export interface TemplateCacheSlots {
  contract: unknown; // TemplateContract | null — render/templates.ts narrows
  shells: Map<string, string>;
  returns: Map<string, string>;
  compiledRound: unknown; // handlebars compiled delegate | null — render/templates.ts narrows
  roundTokens: string[];
  rounds: Map<string, string>;
  /** The shared shell frame compiled + rendered once (T12, D1.2 — clause partial refs resolved). */
  shellFrameRendered: string | null;
  reads: number;
  compiles: number;
  tailRenders: number;
}

export interface TemplateCacheStats {
  reads: number;
  compiles: number;
  tailRenders: number;
}

// ---- cache-profile validator memo (formerly infra/registry.ts) ----
const CACHE_PROFILE_SCHEMA_PATH = fileURLToPath(
  new URL("../../templates/schema/cache-profile-schema.json", import.meta.url),
);

/** CddRuntime — the engine's single mutable-state owner (P4.4 Task 4). Every module-level mutable
 *  variable converges here; the module singleton `runtime` is the process default and the injected
 *  `runtime?: CddRuntimeLike` option on every dispatch surface substitutes a stand-in (the
 *  constructor-injection test seam). Pure/stateless helpers stay module exports; the lifecycle
 *  operations are instance methods over the class's private state. */
export class CddRuntime {
  // dryRun (former cli/shared.ts `let dryRun`)
  #dryRun = false;
  setDryRun(enabled: boolean): void {
    this.#dryRun = enabled === true;
  }
  isDryRun(): boolean {
    return this.#dryRun;
  }

  // repo-root singleton (former infra/root.ts `let _root`)
  #root: string | null = null;
  async initRoot(cwd: string): Promise<string> {
    const root = await gitTopLevel(cwd);
    if (!root) {
      process.stderr.write(
        "CDD_BLOCKED: not in a git repository\n  Run cdd from within a git repository.\n",
      );
      exitWithCode(1);
    }
    this.#root = root;
    return root;
  }
  getRoot(): string {
    invariant(this.#root, "initRoot() not called — call from bin/cdd.mjs entry first");
    return this.#root;
  }

  // signal-safe exit code (former bin.ts `let signalExitCode`)
  signalExitCode: number | null = null;

  // proc lifecycle state (former infra/proc.ts `let registry/diskPath/idleTimer`)
  #registry: ManagedGroup[] = [];
  #diskPath = ""; // set via initProcLifecycle; when empty we never persist (test introspection state)
  #idleTimer: NodeJS.Timeout | null = null;

  /** initProcLifecycle({ diskPath }) — bind the on-disk lifecycle registry path. */
  initProcLifecycle({ diskPath: dp }: { diskPath?: string }): void {
    this.#diskPath = dp ?? "";
  }

  /** persistRegistry — registry double-write (memory + disk). */
  async persistRegistry(): Promise<void> {
    if (!this.#diskPath) return;
    try {
      mkdirSync(path.dirname(this.#diskPath), { recursive: true });
      writeFileSync(this.#diskPath, `${JSON.stringify(this.#registry, null, 2)}\n`);
    } catch {
      /* disk-write failure fails open: the next run's ps scan is the fallback */
    }
  }

  #pgidAlive(pgid: number): boolean {
    try {
      process.kill(-pgid, 0);
      return true;
    } catch {
      return false;
    }
  }

  // owner process liveness: a concurrent in-flight group (foreign owner) must not be reaped as a
  // cross-run orphan. Orphan = foreign AND owner verifiably dead (kill(ownerPid,0) throws ESRCH).
  #pidAlive(pid: number | null | undefined): boolean {
    if (pid == null) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  #killGroup(pgid: number, signal: NodeJS.Signals): void {
    try {
      process.kill(-pgid, signal);
    } catch {
      /* group already gone: idempotent */
    }
  }

  #cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const e = { ...env };
    delete e.CLAUDE_CODE_SUBAGENT_MODEL;
    delete e.ANTHROPIC_API_KEY;
    return e;
  }

  // Unified factory: detached process group + immediate registration. Six-field contract
  // { ok, code, stdout, stderr, timedOut } (+ cause when the termination monitor killed the group
  // or an external SIGTERM ended it — T26 replaces the T14 boolean stalled with the cause).
  async spawnManaged(command: string, args: string[], opts: SpawnOpts): Promise<SpawnResult> {
    const { cwd, env, termination } = opts;
    // execa: the return value is a subprocess (promise × child_process blend); pid is on the
    // subprocess, not on the awaited result (res.pid === undefined) — grab sub.pid before awaiting.
    // timeout / forceKillAfterDelay are deliberately NOT passed: the termination monitor owns both
    // signals (budget kill + stall kill); execa's own timeout channel is redundant with it (T26
    // deletion surface — the self-held elapsed re-read dies with it, the monitor's cause is the
    // single timing authority).
    const sub = execa(command, args, {
      cwd,
      env: this.#cleanEnv(env),
      detached: true, // independent group: pgid = child pid, grandchildren join it
      reject: false,
      all: false,
    });
    const pid = sub.pid;
    // Immediate registration (before execa resolves) — two consumers depend on it:
    // 1) CLI signal teardown roots the in-flight group (spec §2.6);
    // 2) cross-run orphan sweep registers groups a crashed mid-dispatch run left behind (a group
    //    never on disk is a permanent leak — register-before-resolve is the premise).
    // A spawn failure (ENOENT etc under reject:false → pid missing) registers no entry — an empty
    // pgid/owner is meaningless and would pollute the disk registry.
    if (pid != null) {
      this.#registry.push({
        pgid: pid,
        label: `${command} ${(args ?? []).join(" ")}`.slice(0, 80),
        createdAt: Date.now(),
        ownerPid: process.pid,
        done: false,
      });
      await this.persistRegistry();
    }
    // Termination monitor (T26): opt-in, unified stall + budget detection. Runs between registration
    // and the child's resolution; on either signal it kills the process group and records the cause
    // so the caller writes the cause-specific TIMEOUT blocker (resume-or-discard recovery contract
    // in rules/failure.ts timeoutBlocker).
    let monitorCause: TerminationCause | null = null;
    let stopTermination: (() => TerminationCause | null) | null = null;
    const start = Date.now();
    if (pid != null && termination) {
      stopTermination = startTerminationMonitor({
        pgid: pid,
        start,
        progressPath: termination.progressPath,
        budgetMs: termination.budgetMs,
        sampleIntervalMs: termination.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS,
        idleWindowMs: termination.idleWindowMs ?? DEFAULT_IDLE_WINDOW_MS,
        onTerminate: () => {
          // Never taint a group that completed right before the signal resolved — the kill fires
          // only while the group is still observable as alive (a just-finished dispatch must not
          // become a terminated one).
          if (!this.#pgidAlive(pid)) return false;
          this.#killGroup(pid, KILL_SIGNAL);
          // The killed tool call may ignore SIGTERM — force the group down after the grace window.
          // Not unref'd on purpose: a SIGTERM-ignoring child keeps the await pending until SIGKILL.
          setTimeout(() => this.#killGroup(pid, FORCE_SIGNAL), 500);
          return true;
        },
      });
    }
    const res = await sub;
    monitorCause = stopTermination?.() ?? null;
    // Cause determination, two sources, monitor first (a monitor kill surfaces the child's death as
    // SIGTERM/SIGKILL — its own recorded cause must win over the exit-shape read):
    //   ① the monitor recorded a stall/budget kill before the child resolved;
    //   ② an EXTERNAL SIGTERM (exit shape res.signal === "SIGTERM", monitor never fired) → "signal".
    //   Never judged on exit code 143 — execa 9.x's res.code only carries spawn errors (ENOENT…).
    const cause: TerminationCause | undefined =
      monitorCause ?? (res.signal === "SIGTERM" ? "signal" : undefined);
    const timedOut = cause != null;
    return {
      ok: res.exitCode === 0 && !timedOut,
      code: res.exitCode ?? 1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
      timedOut,
      cause,
    };
  }

  // Mark every dispatch (incl. each retry attempt) done on return, for the idle sweep to reap.
  // Explicit invariant (spec §2.2 C; lifecycle semantics concentrated here): dispatch is strictly
  // serial — at most one in-flight group at any time. "Mark all not-done groups = mark the just-
  // returned batch" only holds under that invariant; overlapping dispatch would need pgid-exact
  // marking or the in-process reap mis-marks and roots an in-flight group.
  markAllDispatchesDone(): void {
    const inFlight = this.#registry.filter((g) => !g.done);
    invariant(
      inFlight.length <= 1,
      "CDD_ASSERT: markAllDispatchesDone assumes strictly serial dispatch — " +
        `${inFlight.length} in-flight groups (concurrency requires pgid-exact marking)`,
    );
    for (const g of inFlight) g.done = true;
    if (this.#registry.length) {
      void this.persistRegistry();
    }
  }

  // Reap one group: SIGTERM → grace (cap 1s/group) → SIGKILL → wait for the group to vanish.
  // Idempotent when the group is already gone.
  async #reapGroup(g: ManagedGroup, graceMs: number): Promise<void> {
    if (!this.#pgidAlive(g.pgid)) {
      g.done = true;
      return;
    }
    this.#killGroup(g.pgid, KILL_SIGNAL);
    await new Promise((r) => setTimeout(r, Math.min(graceMs, 1000)));
    this.#killGroup(g.pgid, FORCE_SIGNAL);
    await this.#waitForDeath([g], 2000);
    g.done = true;
  }

  // After SIGKILL, poll until the group is gone from the process table (includes the init
  // reaping window). Deterministic completion: on return the group is no longer observable via
  // pgrep / kill(-pgid,0) — the caller's "group is dead" assertion is therefore sound.
  async #waitForDeath(groups: ManagedGroup[], timeoutMs: number): Promise<void> {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (!groups.some((g) => this.#pgidAlive(g.pgid))) return;
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  // Unified reap point: SIGTERM → grace → SIGKILL → wait for death across the batch; registry cleared
  // (idempotent, reentrant). Errors are swallowed to stderr (spec §2.5) — the caller flow is not
  // derailed. Grace is consumed only when a live group remains.
  async teardownAll({ graceMs = 5000 }: { graceMs?: number } = {}): Promise<void> {
    const groups = [...this.#registry];
    this.#registry = [];
    try {
      for (const g of groups) this.#killGroup(g.pgid, KILL_SIGNAL);
      if (graceMs > 0 && groups.some((g) => this.#pgidAlive(g.pgid))) {
        await new Promise((r) => setTimeout(r, graceMs));
      }
      for (const g of groups) this.#killGroup(g.pgid, FORCE_SIGNAL);
      await this.#waitForDeath(groups, 2000);
      await this.persistRegistry();
    } catch (err) {
      process.stderr.write(
        `CDD_WARN: teardownAll partial failure: ${String((err as Error)?.message ?? err)}\n`,
      );
    }
  }

  // In-process idle monitor (spec §2.2 C / §2.4): started at run entry, periodically reaps
  // done-and-alive groups — retry-failed attempts / lingering servers do not wait until the run boundary.
  startIdleMonitor({ intervalMs = 30_000 }: { intervalMs?: number } = {}): void {
    if (this.#idleTimer) return;
    this.#idleTimer = setInterval(() => {
      this.reapDone({ graceMs: 1000 }).catch((err: unknown) =>
        process.stderr.write(
          `CDD_WARN: reapDone tick failed: ${String((err as Error)?.message ?? err)}\n`,
        ),
      );
    }, intervalMs);
    this.#idleTimer.unref?.();
  }

  stopIdleMonitor(): void {
    if (this.#idleTimer) {
      clearInterval(this.#idleTimer);
      this.#idleTimer = null;
    }
  }

  // Shared lifecycle wrapper (branch-review nit C extraction): startIdleMonitor → fn → finally
  // stop + teardownAll. The five dispatch modules (task / docs / review / branch-review / fix)
  // exit via this one gateway, clearing repeated finally boilerplate.
  async withLifecycle<T>(
    fn: () => Promise<T>,
    { intervalMs = 30_000, graceMs = 5000 }: { intervalMs?: number; graceMs?: number } = {},
  ): Promise<T> {
    this.startIdleMonitor({ intervalMs });
    try {
      return await fn();
    } finally {
      this.stopIdleMonitor();
      await this.teardownAll({ graceMs });
    }
  }

  async reapDone({ graceMs = 1000 }: { graceMs?: number } = {}): Promise<void> {
    const targets = this.#registry.filter((g) => g.done);
    for (const g of targets) await this.#reapGroup(g, graceMs);
    this.#registry = this.#registry.filter((g) => !g.done);
    await this.persistRegistry();
  }

  // Cross-run orphan fallback + timed-out-group cleanup: read the disk registry and handle two
  // shapes — orphans (foreign owner whose engine is verifiably dead) + stale (live groups whose
  // dispatch already returned in this process). Called at engine start to sweep the previous run's
  // SIGKILL residue; a group whose leader is dead but members survive is rooted here.
  async reapStale({ graceMs = 5000 }: { graceMs?: number } = {}): Promise<void> {
    let pending: ManagedGroup[] = [];
    try {
      if (this.#diskPath && existsSync(this.#diskPath)) {
        pending = JSON.parse(readFileSync(this.#diskPath, "utf8")) ?? [];
      }
    } catch {
      pending = [];
    }
    // orphans (foreign AND owner confirmed dead — concurrent engines' in-flight groups are excluded,
    // branch-review warn 4) and stale (own-process dispatch returned but group alive) unite into one
    // batch, rooted as a whole (every process in the group goes with the pgid).
    const orphans = pending.filter(
      (g) => g.ownerPid !== process.pid && !this.#pidAlive(g.ownerPid),
    );
    const stale = pending.filter((g) => g.ownerPid === process.pid && this.#pgidAlive(g.pgid));
    const targets: ManagedGroup[] = [];
    for (const g of [...orphans, ...stale]) {
      if (this.#pgidAlive(g.pgid)) {
        this.#killGroup(g.pgid, KILL_SIGNAL);
        await new Promise((r) => setTimeout(r, Math.min(graceMs, 1000)));
        this.#killGroup(g.pgid, FORCE_SIGNAL);
        targets.push(g);
      }
    }
    await this.#waitForDeath(targets, 2000);
    // Write back only entries not yet confirmed dead (SIGKILL-failed / D-state survivors) — a group
    // never reaped loses the fallback permanently; keep it for the next start.
    const survivors = pending.filter((g) => this.#pgidAlive(g.pgid));
    if (this.#diskPath) {
      try {
        writeFileSync(this.#diskPath, `${JSON.stringify(survivors, null, 2)}\n`);
      } catch {}
    }
  }

  // ---- cache-profile validator memo (infra/registry.ts ownership) ----
  // Lazy ajv validator over the canonical cache-profile schema (same pattern as rules/schema.ts).
  // Not called on the dispatch hot path — exercised by tests/validate against the shipped registry.
  #cacheProfileValidator: ValidateFunction | null = null;
  validateCacheProfile(profile: unknown): { valid: true } | { valid: false; reason: string } {
    if (!this.#cacheProfileValidator) {
      const schema = JSON.parse(readFileSync(CACHE_PROFILE_SCHEMA_PATH, "utf8"));
      this.#cacheProfileValidator = new Ajv({ allErrors: true }).compile(schema);
    }
    const valid = this.#cacheProfileValidator(profile);
    if (valid) return { valid: true };
    const reason = (this.#cacheProfileValidator.errors ?? [])
      .map((e) => `${e.instancePath || "/"} ${e.message}`)
      .join("; ");
    return { valid: false, reason };
  }

  // ---- templates render cache (render/templates.ts ownership — the module-level CACHE state
  // migrated here, P4.4 Task 4; a later TemplateLoader class-ification (plan Task 7 ①) may deepen
  // the shape without re-introducing module-level mutable state). ----
  readonly templateCache: TemplateCacheSlots = {
    contract: null,
    shells: new Map(),
    returns: new Map(),
    compiledRound: null,
    roundTokens: [],
    rounds: new Map(),
    shellFrameRendered: null,
    reads: 0,
    compiles: 0,
    tailRenders: 0,
  };
  resetTemplateCaches(): void {
    this.templateCache.contract = null;
    this.templateCache.shells.clear();
    this.templateCache.returns.clear();
    this.templateCache.compiledRound = null;
    this.templateCache.roundTokens = [];
    this.templateCache.rounds.clear();
    this.templateCache.shellFrameRendered = null;
    this.templateCache.reads = 0;
    this.templateCache.compiles = 0;
    this.templateCache.tailRenders = 0;
  }
  templateCacheStats(): TemplateCacheStats {
    return {
      reads: this.templateCache.reads,
      compiles: this.templateCache.compiles,
      tailRenders: this.templateCache.tailRenders,
    };
  }
}

/** The process singleton — the default read/write surface for every legacy import; inject a
 * CddRuntimeLike stand-in via the dispatch options to substitute it. */
export const runtime = new CddRuntime();

// ---- module delegators (the former proc/shared/root export surface — call sites unchanged) ----

export const initProcLifecycle = (opts: { diskPath?: string }): void =>
  runtime.initProcLifecycle(opts);
export const persistRegistry = (): Promise<void> => runtime.persistRegistry();
export const spawnManaged = (
  command: string,
  args: string[],
  opts: SpawnOpts,
): Promise<SpawnResult> => runtime.spawnManaged(command, args, opts);
export const markAllDispatchesDone = (): void => runtime.markAllDispatchesDone();
export const startIdleMonitor = (opts?: { intervalMs?: number }): void =>
  runtime.startIdleMonitor(opts);
export const stopIdleMonitor = (): void => runtime.stopIdleMonitor();
export const teardownAll = (opts?: { graceMs?: number }): Promise<void> =>
  runtime.teardownAll(opts);
export const reapDone = (opts?: { graceMs?: number }): Promise<void> => runtime.reapDone(opts);
export const reapStale = (opts?: { graceMs?: number }): Promise<void> => runtime.reapStale(opts);
export const withLifecycle = <T>(
  fn: () => Promise<T>,
  opts?: { intervalMs?: number; graceMs?: number },
): Promise<T> => runtime.withLifecycle(fn, opts);

export const initRoot = (cwd: string): Promise<string> => runtime.initRoot(cwd);
export const getRoot = (): string => runtime.getRoot();
export const DRY_RUN = (): boolean => runtime.isDryRun();
export const setDryRun = (enabled: boolean): void => runtime.setDryRun(enabled);
export const validateCacheProfile = (
  profile: unknown,
): { valid: true } | { valid: false; reason: string } => runtime.validateCacheProfile(profile);
export const templateCacheStats = (): TemplateCacheStats => runtime.templateCacheStats();
export const resetTemplateCaches = (): void => runtime.resetTemplateCaches();

/** CddRuntimeLike — the injection seam's structural interface (a stub stand-in only needs the
 * surface the dispatch/lifecycle face touches; full parity = extends CddRuntime). */
export type CddRuntimeLike = Pick<
  CddRuntime,
  | "isDryRun"
  | "setDryRun"
  | "initRoot"
  | "getRoot"
  | "withLifecycle"
  | "teardownAll"
  | "startIdleMonitor"
  | "stopIdleMonitor"
  | "reapStale"
  | "signalExitCode"
>;
