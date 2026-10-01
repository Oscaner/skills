// packages/cdd-engine/src/infra/__tests__/lifecycle.proc.test.ts
// spec §2.2 A–D：spawnManaged（detached 进程组 + run 级 registry）/ teardownAll（run 边界连根回收）
// / reapDone（进程内 idle 监视）/ reapStale（跨 run 孤儿兜底）。用真进程树验证组隔离与回收。

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgrepCount, processGroupReapingSupported } from "./helpers.ts";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
// spec §2.6「环境不允许时 skip 保护」：CI 容器（Ubuntu runner sandbox）下 detached 组 + kill(-pgid)
// 不可靠（组提升/组信号不达成员），导致 teardownAll 后标记进程仍存活。探针实测支持才运行。
const GROUP_SUPPORTED = processGroupReapingSupported();

// 延迟导入，便于每用例重建 registry 状态
let proc: typeof import("../proc.ts");
async function loadModule() {
  proc = await import("../proc.ts");
}

const markerAlive = (m) => pgrepCount(m); // the bracket trick removes pgrep -f self-matching (helpers.ts, verified on CI Linux)
const waitFor = async (fn, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("waitFor timeout");
};

// 本文件专用落盘 registry 路径（每用例经真实边界重建，见 beforeEach）。
const DISK = path.join(os.tmpdir(), `p1lifecycle-${process.pid}.json`);

// The reapStale enumeration-target fixture (T6): a git repo with workspace slug dirs
// (`.kairos/cdd/<slug>/`).
// The sweep enumerates every slug's `lifecycle.json` (WorkspaceRoot.enumerate) — read → filter →
// kill → write-back per slug file, never a repo-level single path.
function tmpReapRepo(slugs: string[]): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), "cdd-reap-repo-"));
  execSync(`git init -q "${repo}"`);
  execSync(`git -C "${repo}" -c user.name=t -c user.email=t@t commit --allow-empty -qm fixture`);
  for (const s of slugs) {
    mkdirSync(path.join(repo, ".kairos", "cdd", s), { recursive: true });
  }
  return repo;
}
function slugLifecycle(repo: string, slug: string): string {
  return path.join(repo, ".kairos", "cdd", slug, "lifecycle.json");
}

describe.skipIf(!GROUP_SUPPORTED)("proc-lifecycle spawnManaged", () => {
  beforeEach(async () => {
    await loadModule();
    // registry 由 run 边界自持（§2.3.1 规则⑤：无 `__*ForTest` 后门缝）——initProcLifecycle 重建落盘态，
    // 随后一轮真实 teardownAll 把模块态内存 registry 连根收回，得到每条用例的干净初态。
    proc.initProcLifecycle({ diskPath: DISK });
    await proc.teardownAll();
  });
  afterEach(async () => {
    await proc.teardownAll();
  });

  it("预算到期连根回收：monitor killGroup 令驻留孙进程同组必死（T26 组语义异于 execa 单 pid kill）", async () => {
    // child 触发孙进程（P1LLWC）后驻留——组内后代验证：预算到期时 killGroup(-pgid) 把
    // 整个组连根回收，未 detached 的孙进程随组同死；execa 的 timeout 只杀 leader（单 pid），
    // 这正是 T26 引入 monitor 自持 killGroup 的理由之一。
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();setInterval(()=>{},10000)`;
    const r = await proc.spawnManaged("node", ["-e", script], { termination: { budgetMs: 800 } });
    expect(typeof r.code).toBe("number");
    expect(r.timedOut).toBe(true);
    await waitFor(() => markerAlive("P1LLWC") === 0, 2000); // 孙进程随组连根回收（组信号送达）
  });

  it("teardownAll 后 registry 为空（可观测边界结果：组连根死 + 盘上记录清零）", async () => {
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1EMPTY']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { termination: { budgetMs: 5000 } });
    // 注册即时化：in-flight 组亦在盘上（spawn 成功即入组，早于 dispatch 返回）
    expect(JSON.parse(readFileSync(DISK, "utf8")).length).toBe(1);
    expect(markerAlive("P1EMPTY")).toBeGreaterThan(0);
    await proc.teardownAll({ graceMs: 500 });
    expect(markerAlive("P1EMPTY")).toBe(0); // in-group descendants are reaped wholesale via pgid
    expect(JSON.parse(readFileSync(DISK, "utf8"))).toEqual([]); // registry 清空并落盘（不再有在册组）
  });

  it("reapStale 对已消失组 fail-open（枚举条目不炸，逐 slug 写回清空）", async () => {
    const repo = tmpReapRepo(["gone"]);
    await proc.initRoot(repo);
    // A group long gone (no pgid / no owner) — the filter roots nothing; the write-back sweeps it.
    writeFileSync(
      slugLifecycle(repo, "gone"),
      JSON.stringify([{ pgid: 99999999, ownerPid: 99999999 }]),
    );
    await expect(proc.reapStale()).resolves.toBeUndefined(); // does not throw
    expect(JSON.parse(readFileSync(slugLifecycle(repo, "gone"), "utf8"))).toEqual([]); // the gone entry is written back cleared
  });

  it("T8 reapStale 枚举 stale crash records 清理（artifact 枚举而非 stash 考古；round 已解析删除、仍在死亡保留）", async () => {
    const repo = tmpReapRepo(["ws-crash"]);
    await proc.initRoot(repo);
    const wsDir = path.join(repo, ".kairos", "cdd", "ws-crash");
    const resolvedHp = path.join(wsDir, "tasks-1-implement.json");
    const deadHp = path.join(wsDir, "tasks-2-implement.json");
    // A stale record — its round resolved at the normal face (the attemptedHandoff now holds a
    // non-dead carrier).
    writeFileSync(
      path.join(wsDir, "crash-implement-1.json"),
      JSON.stringify({ exitCode: 3, attemptedHandoff: resolvedHp, cause: "child-exit" }),
    );
    // A live record — its round is still dead (the attemptedHandoff holds a TIMEOUT/HARNESS_ABORT
    // termination carrier).
    writeFileSync(
      path.join(wsDir, "crash-implement-2.json"),
      JSON.stringify({ exitCode: 1, attemptedHandoff: deadHp, cause: "engine-over-budget" }),
    );
    writeFileSync(resolvedHp, JSON.stringify({ status: "APPROVED", findings: [], artifacts: {} }));
    writeFileSync(deadHp, JSON.stringify({ status: "TIMEOUT", failure_category: "TIMEOUT" }));
    await expect(proc.reapStale()).resolves.toBeUndefined();
    expect(existsSync(path.join(wsDir, "crash-implement-1.json"))).toBe(false); // stale → cleaned
    expect(existsSync(path.join(wsDir, "crash-implement-2.json"))).toBe(true); // live → kept
  });

  it("reapStale 对存活超时组执行回收（stale 分支：own owner + 在途组连根回收，逐 slug 写回）", async () => {
    // P1LLWC detaches a grandchild then the leader exits → the group stays alive in the registry;
    // reapStale roots it via the stale branch. Registration lands directly in THIS slug's
    // lifecycle.json (the T6 relocation shape) — reapStale reads the same file via enumeration.
    const repo = tmpReapRepo(["ws-stale"]);
    await proc.initRoot(repo);
    await proc.initProcLifecycle({ diskPath: slugLifecycle(repo, "ws-stale") });
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { termination: { budgetMs: 5000 } });
    expect(markerAlive("P1LLWC")).toBeGreaterThan(0);
    await proc.reapStale({ graceMs: 500 });
    expect(markerAlive("P1LLWC")).toBe(0); // own-process owner + alive → stale branch roots the group
    expect(JSON.parse(readFileSync(slugLifecycle(repo, "ws-stale"), "utf8"))).toEqual([]); // swept + written back per-slug
  });

  it("跨 run 父死回收：外部引擎落盘 registry 被 SIGKILL → 新 proc 实例 reapStale 枚举连根回收", async () => {
    const repo = tmpReapRepo(["orphan"]);
    await proc.initRoot(repo);
    const lifecycle = slugLifecycle(repo, "orphan");
    // 1) an independent engine subprocess (fixtures/proc-oracle-engine.ts, this dir):
    //    initProcLifecycle(lifecycle) → spawnManaged spawns the marked lingering group (P1ORPHAN)
    //    → persistRegistry → the engine lingers, simulating an engine killed while still alive.
    const engine = spawn(process.execPath, [
      path.join(TESTS_DIR, "fixtures", "proc-oracle-engine.ts"),
      lifecycle,
    ]);
    await waitFor(() => {
      try {
        return (
          markerAlive("P1ORPHAN") > 0 &&
          JSON.parse(readFileSync(lifecycle, "utf8"))[0]?.ownerPid != null
        );
      } catch {
        return false;
      }
    }, 8000);
    expect(JSON.parse(readFileSync(lifecycle, "utf8"))[0].ownerPid).toBe(engine.pid);
    engine.kill("SIGKILL"); // simulates the engine being killed: no teardown runs
    await new Promise((r) => setTimeout(r, 500));
    // 2) this process reaps via a fresh proc module instance (ownerPid differs → the orphans
    //    branch; the enumeration reads only this slug's file)
    await proc.reapStale({ graceMs: 500 });
    expect(markerAlive("P1ORPHAN")).toBe(0); // the orphan group (including the grandchild session server) is reaped wholesale
  });

  it("reapStale 排除并发引擎在途组 + 逐 slug 独立写回（foreign owner 存活不回收、owner 已死才回收）", async () => {
    const repo = tmpReapRepo(["in-flight", "orphan"]);
    await proc.initRoot(repo);
    const pgAlive = (pgid) => {
      try {
        process.kill(-pgid, 0);
        return true;
      } catch {
        return false;
      }
    };
    // 两个驻留组（detached 组 = 独立 pgid）+ 一个「并发引擎」存活进程（foreign in-flight owner）。
    const g1 = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      detached: true,
      stdio: "ignore",
    });
    const g2 = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      detached: true,
      stdio: "ignore",
    });
    const foreignOwnerAlive = spawn(process.execPath, ["-e", "setInterval(()=>{},5000)"], {
      detached: true,
      stdio: "ignore",
    });
    // Hand-written per-slug registry files: in-flight is owned by a foreign LIVE owner (a concurrent
    // in-flight engine) → skipped; orphan is owned by a dead pid → reaped.
    writeFileSync(
      slugLifecycle(repo, "in-flight"),
      JSON.stringify([{ pgid: g1.pid, ownerPid: foreignOwnerAlive.pid }]),
    );
    writeFileSync(
      slugLifecycle(repo, "orphan"),
      JSON.stringify([{ pgid: g2.pid, ownerPid: 99999999 }]),
    );
    await proc.reapStale({ graceMs: 300 });
    expect(pgAlive(g2.pid)).toBe(false); // owner confirmed dead → the orphan is reaped
    expect(pgAlive(g1.pid)).toBe(true); // owner alive → no collateral kill of concurrent in-flight groups
    // read-filter-kill-write-back runs PER slug file: in-flight keeps its survivor entry, orphan's sweeps.
    expect(JSON.parse(readFileSync(slugLifecycle(repo, "in-flight"), "utf8"))).toHaveLength(1);
    expect(JSON.parse(readFileSync(slugLifecycle(repo, "orphan"), "utf8"))).toEqual([]);
    try {
      process.kill(-g1.pid, "SIGKILL");
    } catch {}
    try {
      process.kill(-foreignOwnerAlive.pid, "SIGKILL");
    } catch {}
  });

  it("reapDone 清 dispatch 已返回仍存活组（idle 监视语义）", async () => {
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { termination: { budgetMs: 5000 } });
    await proc.markAllDispatchesDone(); // dispatch returns → the group is marked done
    await proc.reapDone({ graceMs: 500 });
    expect(markerAlive("P1LLWC")).toBe(0); // done + a still-alive group is reaped wholesale (observable boundary result)
    expect(JSON.parse(readFileSync(DISK, "utf8"))).toEqual([]); // the on-disk registry deregisters the group in sync
  });
});
