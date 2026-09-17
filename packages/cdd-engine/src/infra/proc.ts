// packages/cdd-engine/src/infra/proc.ts — Process-Lifecycle Manager (TS port of proc.mjs; spec §2.13
// proc row, execa retained). Same contract as the .mjs module (checked by lifecycle.proc.test.mjs):
// spawnManaged (detached group + run-scoped registry) / teardownAll (run-boundary root reaping) /
// reapDone (in-process idle reaping) / reapStale (cross-run orphan fallback). Registry double-writes
// memory + disk (.osuperpowers/cdd/lifecycle.json), so a parent-killed run is swept on next start.
// Seam note (channel audit ③): env is an EXPLICIT parameter here — the .mjs / `env ?? process.env`
// fallback is a whitelisted passthrough site pinned to proc.mjs/invoke.mjs; the rebuild passes env
// down from its own callers instead of reading process.env at this depth.
import { execa } from "execa";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const KILL_SIGNAL = "SIGTERM";
const FORCE_SIGNAL = "SIGKILL";

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
}

export interface SpawnOpts {
  cwd?: string;
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
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
// { ok, code, stdout, stderr, timedOut }.
export async function spawnManaged(command: string, args: string[], opts: SpawnOpts): Promise<SpawnResult> {
  const { cwd, env, timeoutMs } = opts;
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
  const res = await sub;
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
  if (inFlight.length > 1) {
    throw new Error(
      "CDD_ASSERT: markAllDispatchesDone assumes strictly serial dispatch — " +
      `${inFlight.length} in-flight groups (concurrency requires pgid-exact marking)`);
  }
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