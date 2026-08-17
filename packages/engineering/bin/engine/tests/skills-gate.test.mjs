// engine/tests/skills-gate.test.mjs — T2: skills-missing gate 集成单测。
// DI seam: runTask opts.probeSkills — 测试注入 fake probeSkills，不触碰真实 CLI/list。
// 覆盖场景：
//   1. install-and-use 通道缺失 → exit 3 + stderr installHint（implement/review/fix 全 mode）
//   2. os-init 通道缺失 → stderr 提示（非 exit 3），任务照跑（exit 0）
//   3. probeFailed → fail-open（exit 0，不阻塞）
//   4. brief/templates 缺失 → BLOCKED exit 1（非 exit 3，复用 finish(1,...)）
// 复用 runner.test.mjs 的 capture + baseEnv 模式（内联 helper，保持测试独立）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runTask } from "../lib/runner.mjs";
import { config } from "../../utils/skills-probe.config.mjs";

// ---- helpers（对齐 runner.test.mjs 惯例）----

function setupWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-skills-gate-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger — plan: /tmp/plan.md\n");
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\n");
  return ws;
}

function baseEnv(ws, extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, CDD_WORKSPACE: ws, ...extra };
}

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

// ---- tests ----

// Slice 1: install-and-use 通道（claude）缺失 → exit 3 + stderr installHint + 不调嵌套 CLI
test("implement: superpowers missing → exit 3 + stderr install hint, no CLI invoke", async () => {
  const ws = setupWorkspace();
  const missing = [{ plugin: "superpowers", installHint: "/plugin install superpowers@oscaner" }];
  const fakeProbe = async () => ({ missing, probeFailed: false });
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "implement",
      probeSkills: fakeProbe,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  assert.equal(r.code, 3);
  assert.match(r.stderr, /plugin install/);
});

test("review: install-and-use missing → exit 3 + stderr install hint", async () => {
  const ws = setupWorkspace();
  const missing = [{ plugin: "engineering", installHint: "/plugin install engineering@oscaner" }];
  const fakeProbe = async () => ({ missing, probeFailed: false });
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "review",
      probeSkills: fakeProbe,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  assert.equal(r.code, 3);
  assert.match(r.stderr, /plugin install/);
});

test("fix: install-and-use missing → exit 3 + stderr install hint", async () => {
  const ws = setupWorkspace();
  const missing = [{ plugin: "mattpocock-skills", installHint: "/plugin install mattpocock-skills@oscaner" }];
  const fakeProbe = async () => ({ missing, probeFailed: false });
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "fix",
      probeSkills: fakeProbe,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  assert.equal(r.code, 3);
  assert.match(r.stderr, /plugin install/);
});

test("implement: 多个缺失 → exit 3 + 所有 installHint 出现于 stderr", async () => {
  const ws = setupWorkspace();
  const missing = [
    { plugin: "superpowers", installHint: "/plugin install superpowers@oscaner" },
    { plugin: "engineering", installHint: "/plugin install engineering@oscaner" },
  ];
  const fakeProbe = async () => ({ missing, probeFailed: false });
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "implement",
      probeSkills: fakeProbe,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  assert.equal(r.code, 3);
  assert.match(r.stderr, /superpowers.*plugin install/s);
  assert.match(r.stderr, /engineering.*plugin install/s);
});

// Slice 2: os-init 通道缺失 → stderr 提示（非 exit 3），任务照跑（exit 0）
// 用 channelMap 把 claude 放进 os-init 通道来测试 os-init 分支（claude 在 registry 中通过 ship gate）。
test("implement: os-init 通道缺失 → stderr 提示 + exit 0（任务照跑）", async () => {
  const ws = setupWorkspace();
  const missing = [{ plugin: "superpowers", installHint: "os-init harness opencode" }];
  const fakeProbe = async () => ({ missing, probeFailed: false });
  // channelMap 把 claude 放进 os-init 通道（跳过 exit 3）
  const osInitChannel = { "install-and-use": [], "os-init": ["claude"] };
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "implement",
      dryRun: true,
      probeSkills: fakeProbe,
      channelMap: osInitChannel,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  assert.equal(r.code, 0);
  assert.match(r.stderr, /os-init harness opencode/);
  // dry-run 正常产出 H1
  assert.match(r.stdout, /status: DONE/);
});

// 真实 os-init 通道测试：验证 channelMap 驱动 gate 分支逻辑
test("implement: os-init 通道（channelMap 驱动）→ stderr 提示 + 任务照跑", async () => {
  const ws = setupWorkspace();
  const missing = [
    { plugin: "superpowers", installHint: "os-init harness trae" },
    { plugin: "engineering", installHint: "os-init harness trae" },
  ];
  const fakeProbe = async () => ({ missing, probeFailed: false });
  const osInitChannel = { "install-and-use": [], "os-init": ["claude"] };
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "implement",
      dryRun: true,
      probeSkills: fakeProbe,
      channelMap: osInitChannel,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  assert.equal(r.code, 0);
  // 所有缺失提示都出现于 stderr
  assert.match(r.stderr, /superpowers.*os-init harness trae/s);
  assert.match(r.stderr, /engineering.*os-init harness trae/s);
  // 任务照跑
  assert.match(r.stdout, /status: DONE/);
});

// 无缺失 → gate 不触发 → 正常 dry-run（os-init 通道）
test("implement: os-init 无缺失 → gate 不触发 + exit 0", async () => {
  const ws = setupWorkspace();
  const fakeProbe = async () => ({ missing: [], probeFailed: false });
  const osInitChannel = { "install-and-use": [], "os-init": ["claude"] };
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "implement",
      dryRun: true,
      probeSkills: fakeProbe,
      channelMap: osInitChannel,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  assert.equal(r.code, 0);
  assert.match(r.stdout, /status: DONE/);
});

// Slice 3: probeFailed → fail-open（exit 0，任务照跑）
test("implement: probeFailed → fail-open + exit 0（dry-run）", async () => {
  const ws = setupWorkspace();
  const fakeProbe = async () => ({ missing: [{ plugin: "x", installHint: "y" }], probeFailed: true });
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "implement",
      dryRun: true,
      probeSkills: fakeProbe,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  // probeFailed → fail-open → gate 不阻塞 → dry-run 正常 → exit 0
  assert.equal(r.code, 0);
  assert.match(r.stdout, /status: DONE/);
  // fail-open 诊断出现在 stderr
  assert.match(r.stderr, /probe failed.*claude/);
});

// Slice 4: 无缺失 → gate 不触发 → 正常 dry-run
test("implement: 无缺失 → gate 不触发 + exit 0（dry-run）", async () => {
  const ws = setupWorkspace();
  const fakeProbe = async () => ({ missing: [], probeFailed: false });
  const r = await capture(() =>
    runTask("claude", 1, {
      mode: "implement",
      dryRun: true,
      probeSkills: fakeProbe,
      noExit: true,
      env: baseEnv(ws),
    }),
  );
  assert.equal(r.code, 0);
  assert.match(r.stdout, /status: DONE/);
});
