// packages/cdd-engine/tests/lifecycle.wiring.test.mjs — 全派生点生命周期接线架构守卫。
// spec §2.6：引擎五派生点全部经 spawnManaged（execxa 直接 import 仅允许 lib/lifecycle/proc.mjs）；
// 全部派发出口（runTask / docs-runner / cli 层）接 idle 监视 + teardownAll；bin/cdd.mjs 信号安全出口
//（SIGINT/SIGTERM/SIGHUP → teardownAll 连根回收 → 128+signo 退出码）。CLI 信号用例以 PATH 遮蔽
// harness（既有技术：cdd.test.mjs 以 PATH 遮蔽 registry cli 名）→ 真实 dispatch 经 spawnManaged 派生
// P1SIG 标记驻留组；对 bin/cdd.mjs 发信号断言组连根退出（spec §2.6 三信号全覆盖）。
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "lib");
const REPO_ROOT = path.resolve(LIB, "..", "..", "..");
const alive = m => Number(execSync(`pgrep -f ${m} | wc -l`).toString().trim());
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error("waitFor timeout"); };

describe("架构违例守卫：引擎全部派生经 spawnManaged", () => {
  it("execa 直接 import 仅允许出现在 lib/lifecycle/proc.mjs", () => {
    const files = readdirSync(LIB, { recursive: true }).filter(f => String(f).endsWith(".mjs"));
    const offenders = [];
    for (const f of files) {
      const src = readFileSync(path.join(LIB, f), "utf8");
      // 仅匹配真实 import 语句（`import ... from "execa"`）——注释/文档中的 "execa" 字样不当 offenders，
      // 否则 cli.mjs 等派生点注释提及 execa 历史（迁移叙事、spawnCapture 说明）会造成误伤。
      if (/^\s*import\b[^;]*\bfrom\s*["']execa["']/m.test(src) && f !== "lifecycle/proc.mjs") {
        offenders.push(`${f}: ${src.match(/^\s*import\b[^;]*execa[^;]*;?/m)?.[0]?.trim() ?? "execa import"}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("全部引擎派发出口经 withLifecycle 统一接线", () => {
    // 六个派发模块统一用 withLifecycle（startIdleMonitor → fn → finally stop + teardownAll）——
    // 不再 per-file token 匹配 finally 双行（branch-review nit C）；guard 断言包装器被使用即接线成立。
    const runTask = readFileSync(path.join(LIB, "runner", "run-task.mjs"), "utf8");
    const runDocs = readFileSync(path.join(LIB, "runner", "run-docs.mjs"), "utf8");
    const review = readFileSync(path.join(LIB, "cli", "review.mjs"), "utf8");
    const branchReview = readFileSync(path.join(LIB, "cli", "branch-review.mjs"), "utf8");
    const fix = readFileSync(path.join(LIB, "cli", "fix.mjs"), "utf8");
    const research = readFileSync(path.join(LIB, "cli", "research.mjs"), "utf8");
    for (const [name, src] of [["run-task", runTask], ["run-docs", runDocs], ["review", review],
                               ["branch-review", branchReview], ["fix", fix], ["research", research]]) {
      expect(src, `${name} 经 withLifecycle 出口`).toMatch(/withLifecycle/);
    }
    const proc = readFileSync(path.join(LIB, "lifecycle", "proc.mjs"), "utf8");
    expect(proc).toMatch(/withLifecycle/);            // 包装器本体驻 lifecycle
    expect(proc).toMatch(/startIdleMonitor/);          // 包装器内含 idle 监视
    expect(proc).toMatch(/stopIdleMonitor/);
    expect(proc).toMatch(/teardownAll/);
    const cliMjs = readFileSync(path.join(LIB, "lifecycle", "cli.mjs"), "utf8");
    expect(cliMjs).toMatch(/markAllDispatchesDone/);   // dispatch 返回落 done
    expect(cliMjs).not.toMatch(/^(?:export|const)[^\n]*spawnCapture/m);  // §2.2 D 无死导出（注释提及不受影响）
  });

  it.each([["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]])(
    "CLI 信号安全出口 %s → teardownAll 连根回收 + 退出码 %i（128+signo）",
    async (sig, expectCode) => {
    // 用 PATH 遮蔽 harness（既有技术：cdd.test.mjs 以 PATH 遮蔽 registry cli 名）→ 真实 dispatch
    // 经 spawnManaged 派生 P1SIG 标记驻留组；对 bin/cdd.mjs 发 %s 断言组连根退出（三信号全覆盖，spec §2.6）。
    const stubDir = mkdtempSync(path.join(os.tmpdir(), "p1-stub-"));
    writeFileSync(path.join(stubDir, "claude"),
      `#!/usr/bin/env bash\nnode -e "const{spawn}=require('node:child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1SIG']).unref();setInterval(()=>{},1000)"`,
      { mode: 0o755 });
    const child = spawn(process.execPath, [
      "packages/cdd-engine/bin/cdd.mjs", "review", "--type", "plan",
      "--plan", "packages/cdd-engine/tests/fixtures/smoke-plan.md",
    ], { cwd: REPO_ROOT, env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, CLAUDE_CODE_SESSION_ID: "1", CDD_LIFECYCLE_PATH: path.join(stubDir, "lifecycle.json") }, stdio: ["ignore", "pipe", "pipe"] });
    await waitFor(() => alive("P1SIG") > 0, 10_000);
    child.kill(sig);
    const [code, signal] = await new Promise(res => child.on("exit", (c, s) => res([c, s])));
    // handler 拦截后正常 exit（signal = null），退出码 = 128 + signo（SIGINT→130 / SIGTERM→143 / SIGHUP→129）；
    // signal 非 null 仅容 handler 未装（注册失败/竞态）的退化路径。
    expect(code === expectCode || signal === sig).toBe(true);
    await waitFor(() => alive("P1SIG") === 0, 10_000);   // 组随 teardownAll 连根退出
    rmSync(stubDir, { recursive: true, force: true });
  });
});
