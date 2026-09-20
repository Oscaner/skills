// packages/cdd-engine/src/infra/proc.ts — Process-Lifecycle Manager (TS port of proc.mjs; spec §2.13
// proc row, execa retained). Same contract as the .mjs module (checked by lifecycle.proc.test.mjs):
// spawnManaged (detached group + run-scoped registry) / teardownAll (run-boundary root reaping) /
// reapDone (in-process idle reaping) / reapStale (cross-run orphan fallback). Registry double-writes
// memory + disk (.osuperpowers/cdd/lifecycle.json), so a parent-killed run is swept on next start.
// Seam note (channel audit ③): env is an EXPLICIT parameter here — the .mjs / `env ?? process.env`
// fallback is a whitelisted passthrough site pinned to proc.mjs/invoke.mjs; the rebuild passes env
// down from its own callers instead of reading process.env at this depth.
import { execa } from "execa";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { invariant } from "./exit.ts";

const KILL_SIGNAL = "SIGTERM";
const FORCE_SIGNAL = "SIGKILL";

// ---- T14 liveness monitor (spec E3; configured via engine-config.json#contextContract.timeouts.liveness) ----
// Dispatch-phase stall detector: while a spawnManaged dispatch is in flight, a monitor samples two
// progress signals every sampleIntervalMs — the child process-group cumulative CPU and the newest
// file mtime under the observed progress path (the dispatch workspace). No measurable growth in
// EITHER signal for idleWindowMs → the dispatch is presumed stuck (hung tool call) → the group is
// killed and the spawn result surfaces timedOut + stalled (task.ts writes the stall-specific
// TIMEOUT blocker with the residue-cleanup contract). The dual-signal criterion is deliberately
// conservative (precise criterion): a SINGLE unavailable signal (unreadable CPU, missing dir)
// fails open — unknown never kills; thinking/file reads burn CPU, so active-thinking dispatches
// are never false-killed; only the truly silent case (CPU≈0 AND tree quiet over the whole window)
// stalls. The monitor is opt-in: spawnManaged runs it only when opts.liveness is provided.

export interface LivenessConfig {
  /** Directory whose newest file mtime is the tree-progress signal (the dispatch workspace). */
  progressPath: string;
  sampleIntervalMs?: number;
  idleWindowMs?: number;
}

// Code-default liveness timings — the SINGLE canonical source for the three fallback sites
// (spawnManaged inline fallbacks below, invoke.ts resolveLivenessConfig, rules/failure.ts
// timeoutBlocker). The canonical engine-config.json#contextContract.timeouts.liveness overrides
// them; these only fire for callers that pass a bare LivenessConfig without resolved values
// (tests / direct spawnManaged callers). Editing a config-file value must not silently drift
// from a hand-duplicated code constant, so no module re-declares these literals.
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
  /** true when the liveness monitor killed the group (dispatch stalled past idleWindowMs). */
  stalled?: boolean;
}

export interface SpawnOpts {
  cwd?: string;
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
  liveness?: LivenessConfig;
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
    maxMtimeMs: state.maxMtimeMs == null ? s.latestMtimeMs : Math.max(state.maxMtimeMs, s.latestMtimeMs),
    idleSince: cpuGrew || mtimeAdvanced ? s.at : state.idleSince,
  };
  if (cpuGrew || mtimeAdvanced) return { state: next, verdict: "progress" };
  if (next.idleSince == null || s.at - next.idleSince < idleWindowMs) {
    return { state: next, verdict: "idled" };
  }
  return { state: next, verdict: "stalled" };
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
    else if (parts.length === 3) seconds = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
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
    let entries;
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
// Runs while spawnManaged awaits the child. Each tick samples both signals and feeds the pure
// judge; on "stalled" the onStall callback (kill the group + taint the result) fires once. stop()
// cancels the timer (spawnManaged calls it the moment the child resolves — a dispatch that simply
// took longer than a few sample ticks is never penalized after the fact).
export interface LivenessMonitorOpts {
  pgid: number;
  progressPath: string;
  sampleIntervalMs: number;
  idleWindowMs: number;
  onStall: () => void;
}

export function startLivenessMonitor({
  pgid,
  progressPath,
  sampleIntervalMs,
  idleWindowMs,
  onStall,
}: LivenessMonitorOpts): () => void {
  let state = initialStallState();
  let fired = false;
  let timer: NodeJS.Timeout | null = null;
  // First sample lands immediately (the window anchor starts at dispatch, not at the first tick).
  const tick = (): void => {
    if (fired) return;
    const s: StallSample = {
      cpuMs: sampleGroupCpuMs(pgid),
      latestMtimeMs: latestFileMtimeMs(progressPath),
      at: Date.now(),
    };
    const { state: next, verdict } = evaluateStall(state, s, idleWindowMs);
    state = next;
    if (verdict === "stalled") {
      fired = true;
      if (timer) clearInterval(timer);
      onStall();
    }
  };
  tick();
  timer = setInterval(tick, sampleIntervalMs);
  timer.unref?.();
  return () => { if (!fired && timer) clearInterval(timer); };
}

// registry: entries { pgid, label, createdAt, ownerPid, done } — ownerPid backs cross-run orphan
// determination. Registration is immediate: a spawn lands in the group as soon as it succeeds
// (in-flight done=false is on disk too — the premise of signal teardown / cross-run sweep).
let registry: ManagedGroup[] = [];
let diskPath = ""; // set via initProcLifecycle; when empty we never persist (test introspection state)
let idleTimer: NodeJS.Timeout | null = null;

export function initProcLifecycle({ diskPath: dp }: { diskPath?: string }): void {
  diskPath = dp ?? "";
}

export async function persistRegistry(): Promise<void> {
  if (!diskPath) return;
  try {
    mkdirSync(path.dirname(diskPath), { recursive: true });
    writeFileSync(diskPath, JSON.stringify(registry, null, 2) + "\n");
  } catch {
    /* disk-write failure fails open: the next run's ps scan is the fallback */
  }
}

function pgidAlive(pgid: number): boolean {
  try { process.kill(-pgid, 0); return true; } catch { return false; }
}

// owner process liveness: a concurrent in-flight group (foreign owner) must not be reaped as a
// cross-run orphan. Orphan = foreign AND owner verifiably dead (kill(ownerPid,0) throws ESRCH).
function pidAlive(pid: number | null | undefined): boolean {
  if (pid == null) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function killGroup(pgid: number, signal: NodeJS.Signals): void {
  try { process.kill(-pgid, signal); } catch { /* group already gone: idempotent */ }
}

function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const e = { ...env };
  delete e.CLAUDE_CODE_SUBAGENT_MODEL;
  delete e.ANTHROPIC_API_KEY;
  return e;
}

// Unified factory: detached process group + immediate registration. Five-field contract
// { ok, code, stdout, stderr, timedOut } (+ stalled when the liveness monitor killed the group).
export async function spawnManaged(command: string, args: string[], opts: SpawnOpts): Promise<SpawnResult> {
  const { cwd, env, timeoutMs, liveness } = opts;
  // Self-held timeout (T6, AC7): record a start clock at spawn; on return re-check elapsed vs the
  // timeout budget and exit shape — res.timedOut alone has proven unreliable (30-min dispatches
  // SIGTERM-terminated return exit-143 with res.timedOut unset, landing in the agentRc!=0 branch).
  const start = Date.now();
  // execa: the return value is a subprocess (promise × child_process blend); pid is on the
  // subprocess, not on the awaited result (res.pid === undefined) — grab sub.pid before awaiting.
  const sub = execa(command, args, {
    cwd,
    env: cleanEnv(env),
    timeout: timeoutMs,
    forceKillAfterDelay: 5000,
    detached: true,          // independent group: pgid = child pid, grandchildren join it
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
    registry.push({
      pgid: pid,
      label: `${command} ${(args ?? []).join(" ")}`.slice(0, 80),
      createdAt: Date.now(),
      ownerPid: process.pid,
      done: false,
    });
    await persistRegistry();
  }
  // T14 liveness monitor: opt-in dispatch-phase stall detection. Runs between registration and the
  // child's resolution; on stall it kills the process group and taints the result so the caller
  // writes the stall-specific TIMEOUT blocker (recovery contract in rules/failure.ts timeoutBlocker).
  let stalled = false;
  let stopLiveness: (() => void) | null = null;
  if (pid != null && liveness) {
    stopLiveness = startLivenessMonitor({
      pgid: pid,
      progressPath: liveness.progressPath,
      sampleIntervalMs: liveness.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS,
      idleWindowMs: liveness.idleWindowMs ?? DEFAULT_IDLE_WINDOW_MS,
      onStall: () => {
        // Never taint a group that completed right before the tick — the kill fires only while the
        // group is still observable as alive (a just-finished dispatch must not become a stalled one).
        if (!pgidAlive(pid)) return;
        stalled = true;
        killGroup(pid, KILL_SIGNAL);
        // The stalled tool call may ignore SIGTERM — force the group down after the grace window.
        // Not unref'd on purpose: a SIGTERM-ignoring child keeps the await pending until SIGKILL.
        setTimeout(() => killGroup(pid, FORCE_SIGNAL), 500);
      },
    });
  }
  const res = await sub;
  stopLiveness?.();
  // Stall override: the monitor killed the group before the budget — the child's death shape (a
  // SIGTERM/SIGKILL from us) must surface as a TIMEOUT, and the stalled flag must reach the caller
  // so the TIMEOUT blocker carries the residue-cleanup contract. Handled BEFORE the self-held
  // determination: a stalled dispatch's elapsed is well under the budget by design (idle window
  // ≪ total timeout), so the normal timedOut math would read it as a plain agent failure.
  if (stalled) {
    return { ok: false, code: res.exitCode ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "", timedOut: true, stalled: true };
  }
  // Self-held determination: any of three shapes ⇒ timedOut (res.timedOut is not the sole source).
  //   ① elapsed >= timeoutMs - ε. ε=100ms pulls the line EARLIER than the budget — on-the-boundary
  //      completions are conservatively timed out, catching SIGTERM-race / SIGKILL shapes that
  //      otherwise land in agentRc. ε is far below real timeouts (smallest test timeout = 1s).
  //   ② signal === "SIGTERM": SIGTERM shape is judged on res.signal (killed-or-swallowed both
  //      report it). Never on exit code 143 — execa 9.x's res.code only carries spawn errors
  //      (ENOENT…), the real code is res.exitCode; a natural 143-exit within budget is NOT a timeout.
  const TIMEOUT_EPSILON_MS = 100;
  const timedOut = res.timedOut === true
    || (timeoutMs != null && Date.now() - start >= timeoutMs - TIMEOUT_EPSILON_MS)
    || res.signal === "SIGTERM";
  return { ok: res.exitCode === 0 && !timedOut, code: res.exitCode ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "", timedOut };
}

// Mark every dispatch (incl. each retry attempt) done on return, for the idle sweep to reap.
// Explicit invariant (spec §2.2 C; lifecycle semantics concentrated here): dispatch is strictly
// serial — at most one in-flight group at any time. "Mark all not-done groups = mark the just-
// returned batch" only holds under that invariant; overlapping dispatch would need pgid-exact
// marking or the in-process reap mis-marks and roots an in-flight group.
export function markAllDispatchesDone(): void {
  const inFlight = registry.filter((g) => !g.done);
  invariant(
    inFlight.length <= 1,
    "CDD_ASSERT: markAllDispatchesDone assumes strictly serial dispatch — " +
      `${inFlight.length} in-flight groups (concurrency requires pgid-exact marking)`,
  );
  for (const g of inFlight) g.done = true;
  if (registry.length) { void persistRegistry(); }
}

// Reap one group: SIGTERM → grace (cap 1s/group) → SIGKILL → wait for the group to vanish.
// Idempotent when the group is already gone.
async function reapGroup(g: ManagedGroup, graceMs: number): Promise<void> {
  if (!pgidAlive(g.pgid)) { g.done = true; return; }
  killGroup(g.pgid, KILL_SIGNAL);
  await new Promise((r) => setTimeout(r, Math.min(graceMs, 1000)));
  killGroup(g.pgid, FORCE_SIGNAL);
  await waitForDeath([g], 2000);
  g.done = true;
}

// After SIGKILL, poll until the group is gone from the process table (includes the init
// reaping window). Deterministic completion: on return the group is no longer observable via
// pgrep / kill(-pgid,0) — the caller's "group is dead" assertion is therefore sound.
async function waitForDeath(groups: ManagedGroup[], timeoutMs: number): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (!groups.some((g) => pgidAlive(g.pgid))) return;
    await new Promise((r) => setTimeout(r, 25));
  }
}

// Unified reap point: SIGTERM → grace → SIGKILL → wait for death across the batch; registry cleared
// (idempotent, reentrant). Errors are swallowed to stderr (spec §2.5) — the caller flow is not
// derailed. Grace is consumed only when a live group remains.
export async function teardownAll({ graceMs = 5000 }: { graceMs?: number } = {}): Promise<void> {
  const groups = [...registry];
  registry = [];
  try {
    for (const g of groups) killGroup(g.pgid, KILL_SIGNAL);
    if (graceMs > 0 && groups.some((g) => pgidAlive(g.pgid))) {
      await new Promise((r) => setTimeout(r, graceMs));
    }
    for (const g of groups) killGroup(g.pgid, FORCE_SIGNAL);
    await waitForDeath(groups, 2000);
    await persistRegistry();
  } catch (err) {
    process.stderr.write(`CDD_WARN: teardownAll partial failure: ${String((err as Error)?.message ?? err)}\n`);
  }
}

// In-process idle monitor (spec §2.2 C / §2.4): started at run entry, periodically reaps
// done-and-alive groups — retry-failed attempts / lingering servers do not wait until the run boundary.
export function startIdleMonitor({ intervalMs = 30_000 }: { intervalMs?: number } = {}): void {
  if (idleTimer) return;
  idleTimer = setInterval(() => {
    reapDone({ graceMs: 1000 }).catch((err: unknown) =>
      process.stderr.write(`CDD_WARN: reapDone tick failed: ${String((err as Error)?.message ?? err)}\n`));
  }, intervalMs);
  idleTimer.unref?.();
}

export function stopIdleMonitor(): void {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
}

// Shared lifecycle wrapper (branch-review nit C extraction): startIdleMonitor → fn → finally
// stop + teardownAll. The five dispatch modules (task / docs / review / branch-review / fix)
// exit via this one gateway, clearing repeated finally boilerplate.
export async function withLifecycle<T>(
  fn: () => Promise<T>,
  { intervalMs = 30_000, graceMs = 5000 }: { intervalMs?: number; graceMs?: number } = {},
): Promise<T> {
  startIdleMonitor({ intervalMs });
  try {
    return await fn();
  } finally {
    stopIdleMonitor();
    await teardownAll({ graceMs });
  }
}

export async function reapDone({ graceMs = 1000 }: { graceMs?: number } = {}): Promise<void> {
  const targets = registry.filter((g) => g.done);
  for (const g of targets) await reapGroup(g, graceMs);
  registry = registry.filter((g) => !g.done);
  await persistRegistry();
}

// Cross-run orphan fallback + timed-out-group cleanup: read the disk registry and handle two
// shapes — orphans (foreign owner whose engine is verifiably dead) + stale (live groups whose
// dispatch already returned in this process). Called at engine start to sweep the previous run's
// SIGKILL residue; a group whose leader is dead but members survive is rooted here.
export async function reapStale({ graceMs = 5000 }: { graceMs?: number } = {}): Promise<void> {
  let pending: ManagedGroup[] = [];
  try {
    if (diskPath && existsSync(diskPath)) {
      pending = JSON.parse(readFileSync(diskPath, "utf8")) ?? [];
    }
  } catch { pending = []; }
  // orphans (foreign AND owner confirmed dead — concurrent engines' in-flight groups are excluded,
  // branch-review warn 4) and stale (own-process dispatch returned but group alive) unite into one
  // batch, rooted as a whole (every process in the group goes with the pgid).
  const orphans = pending.filter((g) => g.ownerPid !== process.pid && !pidAlive(g.ownerPid));
  const stale = pending.filter((g) => g.ownerPid === process.pid && pgidAlive(g.pgid));
  const targets: ManagedGroup[] = [];
  for (const g of [...orphans, ...stale]) {
    if (pgidAlive(g.pgid)) {
      killGroup(g.pgid, KILL_SIGNAL);
      await new Promise((r) => setTimeout(r, Math.min(graceMs, 1000)));
      killGroup(g.pgid, FORCE_SIGNAL);
      targets.push(g);
    }
  }
  await waitForDeath(targets, 2000);
  // Write back only entries not yet confirmed dead (SIGKILL-failed / D-state survivors) — a group
  // never reaped loses the fallback permanently; keep it for the next start.
  const survivors = pending.filter((g) => pgidAlive(g.pgid));
  if (diskPath) {
    try { writeFileSync(diskPath, JSON.stringify(survivors, null, 2) + "\n"); } catch {}
  }
}
