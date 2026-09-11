// packages/cdd-engine/tests/lifecycle.proc.test.mjs — Process-Lifecycle Manager 单测。
// spec §2.2 A–D：spawnManaged（detached 进程组 + run 级 registry）/ teardownAll（run 边界连根回收）
// / reapDone（进程内 idle 监视）/ reapStale（跨 run 孤儿兜底）。用真进程树验证组隔离与回收。
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { processGroupReapingSupported, pgrepCount } from "./helpers.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
// spec §2.6「环境不允许时 skip 保护」：CI 容器（Ubuntu runner sandbox）下 detached 组 + kill(-pgid)
// 不可靠（组提升/组信号不达成员），导致 teardownAll 后标记进程仍存活。探针实测支持才运行。
const GROUP_SUPPORTED = processGroupReapingSupported();

// 延迟导入，便于每用例重建 registry 状态
let proc;
async function loadModule() {
  proc = await import("../lib/lifecycle/proc.mjs");
}

const markerAlive = m => pgrepCount(m);   // 括号技巧消除 pgrep -f 自匹配（helpers.mjs，CI Linux 实测）
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error("waitFor timeout"); };

describe.skipIf(!GROUP_SUPPORTED)("proc-lifecycle spawnManaged", () => {
  beforeEach(async () => {
    await loadModule();
    proc.__resetForTest?.();
    proc.initProcLifecycle({ diskPath: path.join(os.tmpdir(), `p1lifecycle-${process.pid}.json`) });
  });
  afterEach(async () => { await proc.teardownAll(); });

  it("派生组触发隔离：teardownAll 后孙进程必死", async () => {
    // child 触发孙进程（P1LLWC 标记）后驻留——组内后代验证
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();setInterval(()=>{},10000)`;
    const r = await proc.spawnManaged("node", ["-e", script], { timeoutMs: 5000 });
    expect(typeof r.code).toBe("number");
    const before = String(pgrepCount("P1LLWC"));
    expect(Number(before)).toBeGreaterThan(0);
    await proc.teardownAll({ graceMs: 500 });
    const after = String(pgrepCount("P1LLWC"));
    expect(Number(after)).toBe(0);
  });

  it("teardownAll 后 registry 为空", async () => {
    await proc.spawnManaged("sleep", ["1"], {});
    await proc.teardownAll();
    expect(proc.__registryForTest().length).toBe(0);
  });

  it("reapStale 对已消失组 fail-open", async () => {
    await proc.spawnManaged("sleep", ["0.1"], {});
    await new Promise(r => setTimeout(r, 300));   // 组已自然退出
    await expect(proc.reapStale()).resolves.toBeUndefined();  // 不抛
  });

  it("reapStale 对存活超时组执行回收（非仅 fail-open）", async () => {
    // P1LLWC 派生孙组后 leader 退出 → 组存活留 registry；reapStale 走 stale 分支连根回收
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { timeoutMs: 5000 });
    expect(markerAlive("P1LLWC")).toBeGreaterThan(0);
    await proc.reapStale({ graceMs: 500 });
    expect(markerAlive("P1LLWC")).toBe(0);
  });

  it("reapDone 清 dispatch 已返回仍存活组（idle 监视语义）", async () => {
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { timeoutMs: 5000 });
    await proc.markAllDispatchesDone();            // dispatch 返回 → 组标 done
    expect(proc.__registryForTest().every(g => g.done)).toBe(true);
    await proc.reapDone({ graceMs: 500 });
    expect(markerAlive("P1LLWC")).toBe(0);
    expect(proc.__registryForTest().length).toBe(0);
  });

  it("跨 run 父死回收：外部引擎落盘 registry 被 SIGKILL → 新 proc 实例 reapStale 连根回收", async () => {
    const disk = path.join(os.tmpdir(), `p1oracle-${process.pid}-${Date.now()}.json`);
    // 1) 独立引擎子进程（tests/fixtures/proc-oracle-engine.mjs）：initProcLifecycle(disk) →
    //    spawnManaged 派生标记驻留组（P1ORPHAN）→ persistRegistry → 引擎驻留模拟「引擎被杀前仍活着」
    //    P1ORPHAN 由 execa 子进程在运行期触发（先于 spawnManaged 落盘）——disk 须与 marker 同时就绪再读，
    //    否则 readFileSync 会撞 ENOENT 竞态。
    const engine = spawn(process.execPath, [path.join(TESTS_DIR, "fixtures", "proc-oracle-engine.mjs"), disk]);
    await waitFor(() => {
      try { return markerAlive("P1ORPHAN") > 0 && JSON.parse(readFileSync(disk, "utf8"))[0]?.ownerPid != null; } catch { return false; }
    }, 8000);
    expect(JSON.parse(readFileSync(disk, "utf8"))[0].ownerPid).toBe(engine.pid);
    engine.kill("SIGKILL");                        // 模拟引擎被杀：无 teardown 执行
    await new Promise(r => setTimeout(r, 500));
    // 2) 本进程以新 proc 模块实例回收（ownerPid 异 → 命中 orphans 分支）
    await proc.initProcLifecycle({ diskPath: disk });
    await proc.reapStale({ graceMs: 500 });
    expect(markerAlive("P1ORPHAN")).toBe(0);       // 孤儿组（含孙代 session server）被连根收回
  });

  it("reapStale 排除并发引擎在途组：foreign owner 存活不回收、owner 已死才回收（branch-review warn 4）", async () => {
    const disk = path.join(os.tmpdir(), `p1owner-${process.pid}-${Date.now()}.json`);
    await proc.initProcLifecycle({ diskPath: disk });
    const pgAlive = (pgid) => { try { process.kill(-pgid, 0); return true; } catch { return false; } };
    // 两个驻留组（detached 组 = 独立 pgid）+ 一个「并发引擎」存活进程（foreign in-flight owner）。
    const g1 = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { detached: true, stdio: "ignore" });
    const g2 = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { detached: true, stdio: "ignore" });
    const foreignOwnerAlive = spawn(process.execPath, ["-e", "setInterval(()=>{},5000)"], { detached: true, stdio: "ignore" });
    // 手写落盘 registry：g1 归 foreign-存活 owner（并发在途组）→ 跳过；g2 归必死 pid → 回收。
    writeFileSync(disk, JSON.stringify([
      { pgid: g1.pid, ownerPid: foreignOwnerAlive.pid },
      { pgid: g2.pid, ownerPid: 99999999 },
    ]));
    await proc.reapStale({ graceMs: 300 });
    expect(pgAlive(g2.pid)).toBe(false);   // owner 确证已死 → 孤儿回收
    expect(pgAlive(g1.pid)).toBe(true);    // owner 存活 → 不误杀并发在途组
    try { process.kill(-g1.pid, "SIGKILL"); } catch {}
    try { process.kill(-foreignOwnerAlive.pid, "SIGKILL"); } catch {}
  });
});
