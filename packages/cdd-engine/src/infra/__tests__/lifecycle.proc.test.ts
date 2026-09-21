// packages/cdd-engine/src/infra/__tests__/lifecycle.proc.test.ts
// spec §2.2 A–D：spawnManaged（detached 进程组 + run 级 registry）/ teardownAll（run 边界连根回收）
// / reapDone（进程内 idle 监视）/ reapStale（跨 run 孤儿兜底）。用真进程树验证组隔离与回收。
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { processGroupReapingSupported, pgrepCount } from "./helpers.ts";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
// spec §2.6「环境不允许时 skip 保护」：CI 容器（Ubuntu runner sandbox）下 detached 组 + kill(-pgid)
// 不可靠（组提升/组信号不达成员），导致 teardownAll 后标记进程仍存活。探针实测支持才运行。
const GROUP_SUPPORTED = processGroupReapingSupported();

// 延迟导入，便于每用例重建 registry 状态
let proc;
async function loadModule() {
  proc = await import("../proc.ts");
}

const markerAlive = m => pgrepCount(m);   // 括号技巧消除 pgrep -f 自匹配（helpers.ts，CI Linux 实测）
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error("waitFor timeout"); };

// 本文件专用落盘 registry 路径（每用例经真实边界重建，见 beforeEach）。
const DISK = path.join(os.tmpdir(), `p1lifecycle-${process.pid}.json`);

describe.skipIf(!GROUP_SUPPORTED)("proc-lifecycle spawnManaged", () => {
  beforeEach(async () => {
    await loadModule();
    // registry 由 run 边界自持（§2.3.1 规则⑤：无 `__*ForTest` 后门缝）——initProcLifecycle 重建落盘态，
    // 随后一轮真实 teardownAll 把模块态内存 registry 连根收回，得到每条用例的干净初态。
    proc.initProcLifecycle({ diskPath: DISK });
    await proc.teardownAll();
  });
  afterEach(async () => { await proc.teardownAll(); });

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
    expect(markerAlive("P1EMPTY")).toBe(0);                    // 组内后代随 pgid 连根回收
    expect(JSON.parse(readFileSync(DISK, "utf8"))).toEqual([]); // registry 清空并落盘（不再有在册组）
  });

  it("reapStale 对已消失组 fail-open", async () => {
    await proc.spawnManaged("sleep", ["0.1"], {});
    await new Promise(r => setTimeout(r, 300));   // 组已自然退出
    await expect(proc.reapStale()).resolves.toBeUndefined();  // 不抛
  });

  it("reapStale 对存活超时组执行回收（非仅 fail-open）", async () => {
    // P1LLWC 派生孙组后 leader 退出 → 组存活留 registry；reapStale 走 stale 分支连根回收
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { termination: { budgetMs: 5000 } });
    expect(markerAlive("P1LLWC")).toBeGreaterThan(0);
    await proc.reapStale({ graceMs: 500 });
    expect(markerAlive("P1LLWC")).toBe(0);
  });

  it("reapDone 清 dispatch 已返回仍存活组（idle 监视语义）", async () => {
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { termination: { budgetMs: 5000 } });
    await proc.markAllDispatchesDone();            // dispatch 返回 → 组标 done
    await proc.reapDone({ graceMs: 500 });
    expect(markerAlive("P1LLWC")).toBe(0);         // done + 存活的组被连根回收（可观测边界结果）
    expect(JSON.parse(readFileSync(DISK, "utf8"))).toEqual([]);  // 盘上 registry 同步注销该组
  });

  it("跨 run 父死回收：外部引擎落盘 registry 被 SIGKILL → 新 proc 实例 reapStale 连根回收", async () => {
    const disk = path.join(os.tmpdir(), `p1oracle-${process.pid}-${Date.now()}.json`);
    // 1) 独立引擎子进程（fixtures/proc-oracle-engine.ts，本次目录下）：initProcLifecycle(disk) →
    //    spawnManaged 派生标记驻留组（P1ORPHAN）→ persistRegistry → 引擎驻留模拟「引擎被杀前仍活着」
    //    P1ORPHAN 由 execa 子进程在运行期触发（先于 spawnManaged 落盘）——disk 须与 marker 同时就绪再读，
    //    否则 readFileSync 会撞 ENOENT 竞态。
    const engine = spawn(process.execPath, [path.join(TESTS_DIR, "fixtures", "proc-oracle-engine.ts"), disk]);
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
