// packages/cdd-engine/tests/lifecycle.proc.test.mjs — Process-Lifecycle Manager 单测。
// spec §2.2 A–D：spawnManaged（detached 进程组 + run 级 registry）/ teardownAll（run 边界连根回收）
// / reapDone（进程内 idle 监视）/ reapStale（跨 run 孤儿兜底）。用真进程树验证组隔离与回收。
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));

// 延迟导入，便于每用例重建 registry 状态
let proc;
async function loadModule() {
  proc = await import("../lib/lifecycle/proc.mjs");
}

const markerAlive = m => Number(execSync(`pgrep -f ${m} | wc -l`).toString().trim());
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error("waitFor timeout"); };

describe("proc-lifecycle spawnManaged", () => {
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
    const before = execSync("pgrep -f P1LLWC | wc -l").toString().trim();
    expect(Number(before)).toBeGreaterThan(0);
    await proc.teardownAll({ graceMs: 500 });
    const after = execSync("pgrep -f P1LLWC | wc -l").toString().trim();
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
});
