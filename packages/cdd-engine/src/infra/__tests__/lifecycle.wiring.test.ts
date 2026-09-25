// packages/cdd-engine/src/infra/__tests__/lifecycle.wiring.test.ts
// spec §2.6：引擎全派生点全部经 spawnManaged（execa 直接 import 仅允许 src/infra/proc.ts）；
// 全部派发出口（runTask / docs-runner / cli 层）接 idle 监视 + teardownAll；dist/cli.mjs 信号安全出口
//（SIGINT/SIGTERM/SIGHUP → teardownAll 连根回收 → 128+signo 退出码）。CLI 信号用例以 PATH 遮蔽
// harness（既有技术：cdd.test.mjs 以 PATH 遮蔽 registry cli 名）→ 真实 dispatch 经 spawnManaged 派生
// P1SIG 标记驻留组；对 dist/cli.mjs 发信号断言组连根退出（spec §2.6 三信号全覆盖）。
// G4 (P6 Task 17): the signal cases are REAL (non-dry-run) dispatches, so the entry gate
// (rules/commit.ts entryGateCleanTree) previously BLOCKed them whenever the ambient working
// tree was dirty — and pre-commit commits on a dirty tree by definition. They now dispatch
// against an isolated mkdtemp clean repo (cwd = temp repo, engine binary stays the repo's
// dist/cli.mjs via absolute path): the gate resolves a clean tree regardless of the ambient
// repo state, so the suite is tree-independent end-to-end (spec G4③ black-box isolation;
// pre-commit runs only the tree-independent subset — scripts/validate/pre-commit.ts).

import { execSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { pgrepCount, processGroupReapingSupported } from "./helpers.ts";

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO_ROOT = path.resolve(LIB, "..", "..", "..");
// spec §2.6「环境不允许时 skip 保护」：信号用例依赖真进程组回收（P1SIG 组随 teardownAll 连根退出），
// CI 容器下组语义不可靠 → skipIf 门控；形构守卫（execa 收敛 / withLifecycle 接线）不受影响始终运行。
const GROUP_SUPPORTED = processGroupReapingSupported();
const alive = (m) => pgrepCount(m); // 括号技巧消 pgrep -f 自匹配（helpers.ts）
const waitFor = async (fn, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("waitFor timeout");
};

// G4 (P6 Task 17): an isolated clean repo for real-dispatch tests — the entry gate resolves
// the CWD repo's tree, so a committed baseline + gitignored `.osuperpowers/` keeps it clean
// no matter what state the ambient working tree is in (pre-commit is dirty by definition).
// Engine workspace writes land under the gitignored `.osuperpowers/` and never dirty the
// tracked tree the gate read.
function tmpDispatchRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cdd-wiring-"));
  execSync(`git init -q "${dir}"`);
  execSync(
    `git -C "${dir}" -c user.name=cdd-test -c user.email=cdd-test@example.com commit --allow-empty -qm "fixture"`,
  );
  writeFileSync(path.join(dir, ".gitignore"), ".osuperpowers/\n");
  execSync(`git -C "${dir}" add -A`);
  execSync(
    `git -C "${dir}" -c user.name=cdd-test -c user.email=cdd-test@example.com commit -qm "seed"`,
  );
  return dir;
}

afterAll(() => {
  // 失败用例（waitFor 超时路径无显式 cleanup）残留的标记进程清理 —— 防跨 run pgrep 命名空间污染。
  // 括号技巧：pkill -f '[P]1SIG' 不匹配执行 shell 自身 cmdline。
  try {
    execSync("pkill -9 -f '[P]1SIG' || true");
  } catch {}
});

describe("架构违例守卫：引擎全部派生经 spawnManaged", () => {
  it("execa 直接 import 仅允许出现在 src/infra/proc.ts", () => {
    // After the colocation move into the src tree (P6 Task 3), the scan must exclude __tests__
    // subdirectories (guard/test self-exemption doctrine — tests intentionally derive via execa
    // orchestration, which is not part of the mechanism's execa import surface; helpers/fixtures
    // also live under __tests__).
    const files = readdirSync(LIB, { recursive: true })
      .filter((f) => String(f).endsWith(".mjs") || String(f).endsWith(".ts"))
      .filter((f) => !f.split(path.sep).includes("__tests__"));
    const offenders = [];
    for (const f of files) {
      const src = readFileSync(path.join(LIB, f), "utf8");
      // 仅匹配真实 import 语句（`import ... from "execa"`）——注释/文档中的 "execa" 字样不当 offenders，
      // 否则 invoke.mjs 等派生点注释提及 execa 历史（迁移叙事、spawnCapture 说明）会造成误伤。
      if (/^\s*import\b[^;]*\bfrom\s*["']execa["']/m.test(src) && f !== "infra/proc.ts") {
        offenders.push(
          `${f}: ${src.match(/^\s*import\b[^;]*execa[^;]*;?/m)?.[0]?.trim() ?? "execa import"}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("全部引擎派发出口经 withLifecycle 统一接线", () => {
    // 五个派发模块统一用 withLifecycle（startIdleMonitor → fn → finally stop + teardownAll）——
    // 不再 per-file token 匹配 finally 双行（branch-review nit C）；guard 断言包装器被使用即接线成立。
    const runTask = readFileSync(path.join(LIB, "dispatch", "task.ts"), "utf8");
    const runDocs = readFileSync(path.join(LIB, "dispatch", "docs.ts"), "utf8");
    const review = readFileSync(path.join(LIB, "cli", "review.ts"), "utf8");
    const branchReview = readFileSync(path.join(LIB, "cli", "branch-review.ts"), "utf8");
    const fix = readFileSync(path.join(LIB, "cli", "fix.ts"), "utf8");
    for (const [name, src] of [
      ["run-task", runTask],
      ["run-docs", runDocs],
      ["review", review],
      ["branch-review", branchReview],
      ["fix", fix],
    ]) {
      expect(src, `${name} 经 withLifecycle 出口`).toMatch(/withLifecycle/);
    }
    const proc = readFileSync(path.join(LIB, "infra", "proc.ts"), "utf8");
    expect(proc).toMatch(/withLifecycle/); // 包装器本体驻 infra/proc.ts
    expect(proc).toMatch(/startIdleMonitor/); // 包装器内含 idle 监视
    expect(proc).toMatch(/stopIdleMonitor/);
    expect(proc).toMatch(/teardownAll/);
    const invoke = readFileSync(path.join(LIB, "infra", "invoke.ts"), "utf8");
    expect(invoke).toMatch(/markAllDispatchesDone/); // dispatch 返回落 done
    expect(invoke).not.toMatch(/^(?:export|const)[^\n]*spawnCapture/m); // §2.2 D 无死导出（注释提及不受影响）
  });

  describe.skipIf(!GROUP_SUPPORTED)("CLI 信号安全出口（进程组依赖）", () => {
    it.each([
      ["SIGINT", 130],
      ["SIGTERM", 143],
      ["SIGHUP", 129],
    ])(
      "CLI 信号安全出口 %s → teardownAll 连根回收 + 退出码 %i（128+signo）",
      async (sig, expectCode) => {
        // 真实 dispatch 隔离在 mkdtemp 干净仓（G4/Task 17）：cwd = temp repo，CLI 二进制 = 本仓
        // dist/cli.mjs（绝对路径）→ 入口门解析 temp repo 的干净树，天然不受本仓脏树影响
        //（pre-commit 提交时工作树必然 dirty —— 该硬 BLOCK 曾是 pre-commit 的结构性失败点）。
        const repo = tmpDispatchRepo();
        const stubDir = mkdtempSync(path.join(os.tmpdir(), "p1-stub-"));
        try {
          writeFileSync(
            path.join(stubDir, "claude"),
            `#!/usr/bin/env bash\nnode -e "const{spawn}=require('node:child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1SIG']).unref();setInterval(()=>{},1000)"`,
            { mode: 0o755 },
          );
          const child = spawn(
            process.execPath,
            [
              path.join(REPO_ROOT, "packages/cdd-engine/dist/cli.mjs"),
              "review",
              "--type",
              "plan",
              "--plan",
              path.join(REPO_ROOT, "packages/cdd-engine/src/cli/__tests__/fixtures/smoke-plan.md"),
            ],
            {
              cwd: repo,
              env: {
                ...process.env,
                PATH: `${stubDir}:${process.env.PATH}`,
                CLAUDE_CODE_SESSION_ID: "1",
              },
              stdio: ["ignore", "pipe", "pipe"],
            },
          );
          await waitFor(() => alive("P1SIG") > 0, 30_000);
          child.kill(sig);
          const [code, signal] = await new Promise((res) =>
            child.on("exit", (c, s) => res([c, s])),
          );
          // handler 拦截后正常 exit（signal = null），退出码 = 128 + signo（SIGINT→130 / SIGTERM→143 / SIGHUP→129）；
          // signal 非 null 仅容 handler 未装（注册失败/竞态）的退化路径。
          expect(code === expectCode || signal === sig).toBe(true);
          await waitFor(() => alive("P1SIG") === 0, 30_000); // 组随 teardownAll 连根退出（全套负载下给足预算）
        } finally {
          rmSync(stubDir, { recursive: true, force: true });
          rmSync(repo, { recursive: true, force: true });
        }
      },
    );
  });
});
