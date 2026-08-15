// engine/tests/runner.test.mjs — T2: runner 模块单测（Node port of cdd-cli-dry-run-smoke.sh）。
// runTask dry-run：H1 四行 + handoff 写（dry-run 由 runner 写 handoff —— Node 增强，bash dry-run 不写）。
// 另锁：ship gate（unknown/not-supported → blocked exit 1）；invalid mode 拒绝；
// 嵌套 CLI 失败无 handoff → 写 BLOCKED handoff（stderr 进 blocker）+ exit 2（唯一 sanctioned divergence）。
// runPlan 的构建块：taskNumbersFromPlan / isTaskPending / handoffStatus（纯函数）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTask, taskNumbersFromPlan, isTaskPending, handoffStatus } from "../lib/runner.mjs";

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));

// 非 git 临时 workspace —— 对齐 cdd-cli-dry-run-smoke（CDD_WORKSPACE 指向 TMPDIR，commit-contract fail-open）。
function setupWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger — plan: /tmp/plan.md\n");
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\n");
  return ws;
}

// 测试 env：清掉外部会话可能继承的 CDD_*（本测试进程运行在 orchestrator env 下 —— CDD_HANDOFF_PATH
// 等若泄漏，runTask 会写到真实 workspace）；仅保留测试可控的 CDD_WORKSPACE（+extra）。
function baseEnv(ws, extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, CDD_WORKSPACE: ws, ...extra };
}

// 捕获 runTask（noExit:false）的 process.exit + stdout/stderr。
async function capture(runFn) {
  const origExit = process.exit;
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  let code = null;
  let stdout = "";
  let stderr = "";
  process.exit = (c) => {
    code = c;
    throw new Error(`process.exit(${c})`);
  };
  process.stdout.write = (s) => {
    stdout += s;
    return true;
  };
  process.stderr.write = (s) => {
    stderr += s;
    return true;
  };
  try {
    try {
      await runFn();
    } catch (e) {
      if (!/process\.exit/.test(e.message)) throw e;
    }
  } finally {
    process.exit = origExit;
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return { code, stdout, stderr };
}

test("runTask: dry-run implement → H1 四行 DONE + handoff 写", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "implement", dryRun: true, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 0);
  assert.equal(res.h1.length, 4);
  assert.equal(res.h1[0], "status: DONE");
  assert.equal(res.h1[1], "commits: base=dry-run head=dry-run");
  assert.match(res.h1[2], /^artifacts: brief=/);
  assert.equal(res.h1[3], "blocker: none");

  const handoff = JSON.parse(readFileSync(path.join(ws, "task-1-handoff.json"), "utf8"));
  assert.equal(handoff.status, "DONE");
  assert.equal(handoff.phase, "implement");
  assert.equal(handoff.commits.base, "dry-run");
});

test("runTask: dry-run 输出 H1 四行到 stdout + exit 0", async () => {
  const ws = setupWorkspace();
  const { code, stdout } = await capture(() =>
    runTask("claude", 1, { mode: "implement", dryRun: true, env: baseEnv(ws) }),
  );
  assert.equal(code, 0);
  const lines = stdout.trim().split("\n");
  assert.equal(lines.length, 4);
  assert.equal(lines[0], "status: DONE");
  assert.equal(lines[3], "blocker: none");
});

test("runTask: dry-run review/fix 三模式 → H1 DONE + handoff phase", async () => {
  for (const mode of ["review", "fix"]) {
    const ws = setupWorkspace();
    const res = await runTask("claude", 1, { mode, dryRun: true, env: baseEnv(ws), noExit: true });
    assert.equal(res.exitCode, 0, `mode ${mode}`);
    assert.equal(res.h1[0], "status: DONE", `mode ${mode}`);
    const handoff = JSON.parse(readFileSync(path.join(ws, "task-1-handoff.json"), "utf8"));
    assert.equal(handoff.phase, mode);
  }
});

test("runTask: 非法 mode → 拒绝（非零退出）", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "handoff", dryRun: true, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 1);
});

test("runTask: unknown harness → blocked exit 1", async () => {
  const ws = setupWorkspace();
  const res = await runTask("no-such-harness", 1, { mode: "implement", dryRun: true, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 1);
});

test("runTask: not-supported harness → blocked exit 1", async () => {
  const ws = setupWorkspace();
  const res = await runTask("codex", 1, { mode: "implement", dryRun: true, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 1);
});

test("runTask: 嵌套 CLI 失败无 handoff → BLOCKED handoff（stderr 进 blocker）+ exit 2", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bin-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\necho 'boom from fake cli' >&2\nexit 3\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const res = await (async () => {
    // checkHarness 的 CLI preflight 读 process.env.PATH（T1 registry 契约）—— 临时把 fake-cli 的
    // binDir 加进 PATH，跑完还原（node --test 每文件独立进程，同文件内顺序执行，安全）。
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    try {
      return await runTask("ghost", 1, {
        mode: "implement",
        env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
        registryPath: regPath,
        noExit: true,
      });
    } finally {
      process.env.PATH = origPath;
    }
  })();
  assert.equal(res.exitCode, 2);
  const handoff = JSON.parse(readFileSync(path.join(ws, "task-1-handoff.json"), "utf8"));
  assert.equal(handoff.status, "BLOCKED");
  assert.match(handoff.blocker, /boom from fake cli/);
  assert.match(handoff.blocker, /exit/);
});

test("taskNumbersFromPlan: 提取 ### Task N: 并排序（含 0）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-plan-"));
  const plan = path.join(dir, "plan.md");
  writeFileSync(plan, "# P\n### Task 3: a\n### Task 1: b\n### Task 0: skip\n### Task 2: c\n");
  assert.deepEqual(taskNumbersFromPlan(plan), [0, 1, 2, 3]);
});

test("isTaskPending / handoffStatus: ledger complete / APPROVED → false；DONE / MISSING → true", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-pending-"));
  const ledger = path.join(dir, "progress.md");
  const handoff = path.join(dir, "task-1-handoff.json");

  assert.equal(handoffStatus(handoff), "MISSING");
  assert.equal(isTaskPending(1, ledger, handoff), true);

  writeFileSync(handoff, JSON.stringify({ status: "DONE" }));
  assert.equal(handoffStatus(handoff), "DONE");
  assert.equal(isTaskPending(1, ledger, handoff), true);

  writeFileSync(handoff, JSON.stringify({ status: "APPROVED" }));
  assert.equal(handoffStatus(handoff), "APPROVED");
  assert.equal(isTaskPending(1, ledger, handoff), false);

  writeFileSync(ledger, "# CDD ledger\nTask 1: complete (commits a..b, review clean)\n");
  assert.equal(isTaskPending(1, ledger, handoff), false);
});
