// gate/tests/helpers.mjs — P4b T11: 共享 adapter 测试 fixture。
// 从 cdd-gate-core.test.mjs / 各 adapter 测试提取的公共帮手（pending-root 环境设置、
// gitFixtureRoot / writePending / runAdapter / now / activePlan），消除 10+ 份逐字复制
//（对应 T3–T5 的 Duplicated Code 记录）。所有 adapter 测试签名保持一致：
//   const { root, pendingRoot } = makeGateTestEnv();
//   gitFixtureRoot(root) / writePending(pendingRoot, key, data)
//   runAdapter(ADAPTER, env, input, raw?)
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// 隔离测试环境：CDD_PENDING_ROOT 指向临时 pending 目录，TTL 用默认值（86400），
// fixtures root 由各 deny 用例显式传入（不全局设）。
export function makeGateTestEnv() {
  const root = mkdtempSync("/tmp/gate-adapter-");
  const pendingRoot = path.join(root, "pending");
  mkdirSync(pendingRoot, { recursive: true });
  process.env.CDD_PENDING_ROOT = pendingRoot;
  delete process.env.CDD_PENDING_TTL;
  delete process.env.CDD_GATE_FIXTURES_ROOT;
  return { root, pendingRoot };
}

export const now = () => Math.floor(Date.now() / 1000);

// 一次性 git 仓库，返回真实对象 SHA 用作 brief 的 TASK_BASE（对齐 cdd-gate-core 布局）。
export function gitFixtureRoot(root) {
  const dir = path.join(root, `git-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "config", "user.email", "gate-test@example.com"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "Gate Test"]);
  execFileSync("git", ["-C", dir, "commit", "-q", "--allow-empty", "-m", "init"]);
  const sha = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  return { dir, sha };
}

export function writePending(pendingRoot, key, data) {
  writeFileSync(path.join(pendingRoot, `${key}.json`), JSON.stringify(data));
}

// 以子进程运行 CLI adapter（stdin hook JSON → stdout 决策 JSON）。
// raw=true 时原样喂 stdin（测 JSON.parse 抛错 → fail-open allow）。
export function runAdapter(adapterPath, env, input, raw = false) {
  return JSON.parse(
    execFileSync("node", [adapterPath], {
      input: raw ? input : JSON.stringify(input),
      env: { ...process.env, ...env },
      encoding: "utf8",
    }),
  );
}

// 建一个活跃 plan fixture（cdd-root 布局）：写 task-1-brief.md 返回 planDir。
export function activePlan(dir, sha) {
  const planDir = path.join(dir, ".superpowers", "cdd", "plan-a");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(path.join(planDir, "task-1-brief.md"), `TASK_BASE: ${sha}\n`);
  return planDir;
}
