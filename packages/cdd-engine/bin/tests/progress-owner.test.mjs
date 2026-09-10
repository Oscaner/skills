// packages/cdd-engine/bin/tests/progress-owner.test.mjs — D14: progress.json 所有权收归 engine。
// engineRecoveryCount 由 engine 在 BLOCKED/engine-error 判定路径自增（runner.mjs 写 BLOCKED handoff 时），
// orchestrator 层 skill（cli-driven-development §engine-recovery / §timeout-decision）只读判 retry，
// 不再写 progress.json（[#232 comment 5612106797]：orchestrator 手写 tasks 当数组 → dispatch 失败）。
import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTask } from "../lib/runner.mjs";
import { readProgressJSON, incrementRecovery } from "../lib/progress.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));

// Non-git temp workspace（commit-contract fail-open）→ CDD_WORKSPACE 指向 TMPDIR。
function setupWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-progress-owner-"));
  const progressData = { plan: "/tmp/plan.md", timeoutCount: 0, engineRecoveryCount: 0, tasks: [] };
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify(progressData, null, 2));
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n");
  return ws;
}

// 剥 CDD_* 继承环境（测试进程在 orchestrator env 下运行，泄漏 CDD_HANDOFF_PATH 等会写真实 workspace），
// 只留测试控制的 CDD_WORKSPACE。
function filteredEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_") && k !== "PLAN_FILE") env[k] = v;
  }
  return env;
}

function baseEnv(ws, extra = {}) {
  return { ...filteredEnv(), CDD_WORKSPACE: ws, ...extra };
}

it("engine BLOCKED dispatch 后 engineRecoveryCount 自增（engine 写，orchestrator 只读）", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-progress-owner-bin-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\necho 'boom from fake cli' >&2\nexit 3\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  // 前置：engineRecoveryCount == 0
  expect(readProgressJSON(ws).engineRecoveryCount).toBe(0);

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    // 触发一次 engine-level BLOCKED：嵌套 CLI 失败（exit 3）且未写 handoff → runner 自写 BLOCKED handoff
    const res = await runTask("ghost", 1, {
      mode: "implement",
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    expect(res.h1[0]).toBe("status: BLOCKED");

    // 断言：重读 progress.json engineRecoveryCount == 1（engine 自增写盘；无需 orchestrator 写）
    const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress.engineRecoveryCount).toBe(1);
  } finally {
    process.env.PATH = origPath;
  }
});

it("incrementRecovery: 自增并持久化 engineRecoveryCount（缺省 0 → 1 → 2）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-recovery-help-"));
  expect(readProgressJSON(dir).engineRecoveryCount).toBe(0);
  incrementRecovery(dir);
  expect(readProgressJSON(dir).engineRecoveryCount).toBe(1);
  incrementRecovery(dir);
  const saved = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  expect(saved.engineRecoveryCount).toBe(2);
});