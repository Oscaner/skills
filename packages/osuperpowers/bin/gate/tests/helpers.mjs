// gate/tests/helpers.mjs — P4b T11: 共享 adapter 测试 fixture。
// Bug O Step 5b: gate 状态改经 env 传播（CDD_GATE_WORKSPACE / CDD_GATE_MODE /
// CDD_GATE_PLAN，由 runner 在 spawn env 设置、hook 在 CLI 子进程内继承），
// pending 文件 / CDD_PENDING_ROOT 已删除。所有 adapter 测试签名保持一致：
//   const { root, pendingRoot } = makeGateTestEnv();
//   gitFixtureRoot(root) / writePending(pendingRoot, key, data) / clearGateEnv()
//   runAdapter(ADAPTER, env, input, raw?)
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// 隔离测试环境：清空 gate env（初始 fail-open allow），fixtures root 由各 deny 用例显式传。
// pendingRoot 为向后兼容保留（writePending 已不再写文件），仅用于标识老签名的 root。
export function makeGateTestEnv() {
  const root = mkdtempSync("/tmp/gate-adapter-");
  const pendingRoot = path.join(root, "pending");
  clearGateEnv();
  delete process.env.CDD_GATE_FIXTURES_ROOT;
  return { root, pendingRoot };
}

// 清空 gate env —— allow 用例（无 gate 上下文 → fail-open allow）必须在 gateDecide 前调用，
// 避免先前 writePending 的 env 泄漏（node:test 同文件内串行执行）。
export function clearGateEnv() {
  process.env.CDD_GATE_WORKSPACE = "";
  process.env.CDD_GATE_MODE = "";
  process.env.CDD_GATE_PLAN = "";
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

// Bug O Step 5b: writePending 从写 pending 文件改为设置 gate env（签名保持
// `writePending(pendingRoot, key, data)` 向后兼容；pendingRoot/key 参数已不使用）。
//   { mode, workspace, plan_path } → CDD_GATE_WORKSPACE / CDD_GATE_MODE / CDD_GATE_PLAN。
// workspace 缺省时按 repo_root 推导到 activePlan 的默认 slug（plan-a）—— 与 adapter
// deny 用例的 fixture 布局一致。
export function writePending(_pendingRoot, _key, data) {
  process.env.CDD_GATE_WORKSPACE = data.workspace ?? defaultWorkspace(data.repo_root);
  process.env.CDD_GATE_MODE = data.mode ?? "";
  process.env.CDD_GATE_PLAN = data.plan_path ?? "";
}

function defaultWorkspace(repoRoot) {
  return repoRoot ? path.join(repoRoot, ".superpowers", "cdd", "plan-a") : "";
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