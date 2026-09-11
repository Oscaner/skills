// packages/cdd-engine/lib/lifecycle/proc.mjs — Process-Lifecycle Manager.
// 引擎全部派生点的出生与回收单点：spawnManaged（detached 进程组 + run 级 registry）
// / teardownAll（run 边界 + CLI 信号连根回收）/ reapDone（进程内 idle 监视低频回收）
// / reapStale（跨 run 孤儿兜底）。registry 双写内存 + 落盘（.superpowers/cdd/lifecycle.json），
// 父死场景由下次启动跨 run 扫回。
// `__registryForTest` / `__resetForTest` 为测试内省导出（vitest seam）；`__` 前缀标记测试专用，
// 随包发布但无副作用（仅读内置 registry / 重置模块态，非正式 API）。
import { execa } from "execa";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const KILL_SIGNAL = "SIGTERM";
const FORCE_SIGNAL = "SIGKILL";

// ---- registry（内存 + 落盘双写）----
// 条目 { pgid, label, createdAt, ownerPid, done } —— ownerPid 支撑跨 run 孤儿判定。
// 注册即时化：spawn 成功即入组（in-flight done=false 亦在盘上——信号 teardownAll / 跨 run 兜底
// 的前提）；done = dispatch 已返回（idle 监视回收依据）。弃设计初稿的 dispatch 字段（spec §2.2 A v1.1 定案）。
let registry = [];            // [{ pgid, label, createdAt, ownerPid, done }]
let diskPath = "";            // initProcLifecycle 设置；未设置则不落盘（测试内省态）
let idleTimer = null;

export function initProcLifecycle({ diskPath: dp }) {
  diskPath = dp ?? "";
}

// 测试内省 seam（vitest NODE_ENV=test 才导出；生产/发布态为 undefined —— 不构成发布面测试表）。
// `__registryForTest` / `__resetForTest`：`__` 前缀标记测试专用；随包发布但仅在测试环境有值。
const TEST_SEAM = process.env.NODE_ENV === "test";
export const __registryForTest = TEST_SEAM ? () => registry : undefined;
export const __resetForTest = TEST_SEAM
  ? () => { registry = []; stopIdleMonitor(); }
  : undefined;

export async function persistRegistry() {
  if (!diskPath) return;
  try {
    mkdirSync(path.dirname(diskPath), { recursive: true });
    writeFileSync(diskPath, JSON.stringify(registry, null, 2) + "\n");
  } catch { /* 落盘失败 fail-open：下一 run 靠 ps 扫描兜底 */ }
}

function pgidAlive(pgid) {
  try { process.kill(-pgid, 0); return true; } catch { return false; }
}

// owner 进程 liveness（branch-review warn 4）：并发同 cwd 引擎的在途组（ownerPid ≠ 本进程但 owner 存活）
// 不得被启动 reapStale 当跨 run 孤儿杀。孤儿判定 = foreign AND owner 确证已死（kill(ownerPid,0) 抛 ESRCH）。
function pidAlive(pid) {
  if (pid == null) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function killGroup(pgid, signal) {
  try { process.kill(-pgid, signal); } catch { /* 组已亡：幂等 */ }
}

function cleanEnv(env) {
  const e = { ...env };
  delete e.CLAUDE_CODE_SUBAGENT_MODEL;
  delete e.ANTHROPIC_API_KEY;
  return e;
}

// 统一工厂：detached 进程组 + 即时注册。保持五字段契约 {ok, code, stdout, stderr, timedOut}。
export async function spawnManaged(command, args, opts = {}) {
  const { cwd, env, timeoutMs } = opts;
  // execa 返回体 = subprocess（promise × child_process 混合体）：pid 挂在 subprocess 上，
  // await 后的结果对象不携带 pid（res.pid === undefined）—— 必须先取 sub.pid 再 await。
  const sub = execa(command, args, {
    cwd,
    env: cleanEnv(env ?? process.env),
    timeout: timeoutMs,
    forceKillAfterDelay: 5000,
    detached: true,            // 独立进程组：pgid = 子 PID，孙代同组
    reject: false,
    all: false,
  });
  const pid = sub.pid;
  // 注册即时化（spawn 成功即入 registry，早于 execa resolve）——两个消费方依赖：
  // 1) CLI 信号 teardownAll 连根回收 in-flight 组（spec §2.6）；
  // 2) 跨 run 孤儿兜底登记「引擎中途被杀」的组——若等 resolve 才 push，mid-dispatch 崩溃的
  //     detached 组永不落盘、永久泄漏（spec §2.2 A 父死场景由下次启动扫回的前提即在飞组已在盘上）。
  // 派生失败（reject:false 下 ENOENT 等令 pid 缺失）仍不注册组条目——空的 pgid/owner 对孤儿
  // 判定无意义，避免污染磁盘 registry（spec §2.2 A 条目契约：pgid 必须有值）。
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
  const timedOut = res.timedOut ?? false;
  return { ok: res.exitCode === 0 && !timedOut, code: res.exitCode ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "", timedOut };
}

// dispatch（含 retry 的每个 attempt）返回后调用：组标 done，供 idle 监视 reapDone 回收。
// registry 从 spawn 即时注册（spec §2.2 A：in-flight 亦在盘上——信号 teardownAll / 跨 run
// 孤儿兜底的前提）；done 标记「该组 dispatch 已返回」。
// **显式不变式（spec §2.2 C，lifecycle 层集中此语义）**：派发严格串行——任一时刻 in-flight
// 组至多一批（invokeCli 每 dispatch 单 spawn）。「全量标记未 done 组 = 标记刚返回的这批组」仅
// 在该不变式下成立；未来若引入重迭派发，须改按 spawnManaged 返回的组标识精确标 done，否则进程内
// idle 监视的 reapDone 会误标并连根回收 in-flight 组。断言在打破不变式时立即炸出，而非静默泄漏。
export function markAllDispatchesDone() {
  const inFlight = registry.filter(g => !g.done);
  if (inFlight.length > 1) {
    throw new Error(
      "CDD_ASSERT: markAllDispatchesDone assumes strictly serial dispatch — " +
      `${inFlight.length} in-flight groups (concurrency requires pgid-exact marking)`);
  }
  for (const g of inFlight) g.done = true;
  if (registry.length) { void persistRegistry(); }
}

// 回收一组：SIGTERM → 宽限（cap 1s/组）→ SIGKILL → 等待组真正消失。组已亡幂等。
async function reapGroup(g, graceMs) {
  if (!pgidAlive(g.pgid)) { g.done = true; return; }
  killGroup(g.pgid, KILL_SIGNAL);
  await new Promise(r => setTimeout(r, Math.min(graceMs, 1000)));
  killGroup(g.pgid, FORCE_SIGNAL);
  await waitForDeath([g], 2000);
  g.done = true;
}

// SIGKILL 后轮询等组消失（进程表清空，含 init 收尸窗口）。回收完成的确定语义：
// 返回时该组不再被 pgrep/kill(-pgid,0) 观察到 —— 调用方的「组已死」断言因此确定成立。
async function waitForDeath(groups, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (!groups.some(g => pgidAlive(g.pgid))) return;
    await new Promise(r => setTimeout(r, 25));
  }
}

// 统一回收点：SIGTERM → 宽限 graceMs → SIGKILL → 等组消失，批内全部组；registry 清空（幂等、reentrant）。
// 抛错不吞主流程（spec §2.5）：内部 catch 全部异常 + stderr 记录，调用方流程不受影响。
// 宽限仅在有存活组时消耗（组已亡则跳过 grace 睡眠——run 边界回收不白等）。
export async function teardownAll({ graceMs = 5000 } = {}) {
  const groups = [...registry];
  registry = [];
  try {
    for (const g of groups) killGroup(g.pgid, KILL_SIGNAL);
    if (graceMs > 0 && groups.some(g => pgidAlive(g.pgid))) {
      await new Promise(r => setTimeout(r, graceMs));
    }
    for (const g of groups) killGroup(g.pgid, FORCE_SIGNAL);
    await waitForDeath(groups, 2000);
    await persistRegistry();
  } catch (err) {
    process.stderr.write(`CDD_WARN: teardownAll partial failure: ${err?.message ?? err}\n`);
  }
}

// 进程内 idle 监视（spec §2.2 C / §2.4）：run 入口 startIdleMonitor 启动低频定时器，
// 周期 reapDone 清 done+存活组——长 run 中 retry 失败 attempt / 残留 server 不等到 run 边界。
export function startIdleMonitor({ intervalMs = 30_000 } = {}) {
  if (idleTimer) return;                 // 幂等：已启动 no-op
  idleTimer = setInterval(() => {
    reapDone({ graceMs: 1000 }).catch(err =>
      process.stderr.write(`CDD_WARN: reapDone tick failed: ${err?.message ?? err}\n`));
  }, intervalMs);
  idleTimer.unref?.();
}

export function stopIdleMonitor() {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
}

// 回收 done 且存活的组（idle 监视语义）；注销 + 落盘。

// 共享生命周期包装（branch-review nit C 抽取）：startIdleMonitor → fn → finally stop + teardownAll。
// 六个派发模块（run-task / run-docs / review / branch-review / fix / research）统一经此出口，
// 清除各模块重复的 finally 双行样板；wiring guard 断言使用而非 token 匹配 6 文件。
export async function withLifecycle(fn, { intervalMs = 30_000, graceMs = 5000 } = {}) {
  startIdleMonitor({ intervalMs });
  try {
    return await fn();
  } finally {
    stopIdleMonitor();
    await teardownAll({ graceMs });
  }
}

export async function reapDone({ graceMs = 1000 } = {}) {
  const targets = registry.filter(g => g.done);
  for (const g of targets) await reapGroup(g, graceMs);
  registry = registry.filter(g => !g.done);
  await persistRegistry();
}

// 跨 run 孤儿兜底 + 存活超时组清理：读落盘 registry，两类——
// orphans（ownerPid 非本进程 = 引擎已换/被杀）+ stale（本进程 dispatch 已返回仍存活）。
// 引擎启动时调用兜上次 SIGKILL 残留；组 leader 已死而组仍存活者在此连根回收。
export async function reapStale({ graceMs = 5000 } = {}) {
  let pending = [];
  try {
    if (diskPath && existsSync(diskPath)) {
      pending = JSON.parse(readFileSync(diskPath, "utf8")) ?? [];
    }
  } catch { pending = []; }
  // 语义：orphans（foreign AND owner 确证已死 —— 并发引擎在途组被排除，branch-review warn 4）
  // 与 stale（本进程 dispatch 已返回仍存活）两集合交汇后统一连根回收（组内全部进程随 pgid 清除）。
  const orphans = pending.filter(g => g.ownerPid !== process.pid && !pidAlive(g.ownerPid));
  const stale = pending.filter(g => g.ownerPid === process.pid && pgidAlive(g.pgid));
  const targets = [];
  for (const g of [...orphans, ...stale]) {
    if (pgidAlive(g.pgid)) {
      killGroup(g.pgid, KILL_SIGNAL);
      await new Promise(r => setTimeout(r, Math.min(graceMs, 1000)));
      killGroup(g.pgid, FORCE_SIGNAL);
      targets.push(g);
    }
  }
  await waitForDeath(targets, 2000);              // 孤儿/超时组确定消失（含 init 收尸窗口）
  // 收完写回：仅保留「尚未确认消亡」的条目（SIGKILL 未遂 / D-state 未随窗口消失）——
  // 跨 run 兜底对未回收组永久失联即失去兜底价值，保留下次启动再兜。
  const survivors = pending.filter(g => pgidAlive(g.pgid));
  if (diskPath) {
    try { writeFileSync(diskPath, JSON.stringify(survivors, null, 2) + "\n"); } catch {}
  }
}
