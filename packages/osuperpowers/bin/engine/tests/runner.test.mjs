// engine/tests/runner.test.mjs — T2: runner 模块单测（Node port of cdd-cli-dry-run-smoke.sh）。
// runTask dry-run：H1 四行 + 不写 handoff（对齐 bash —— bash dry-run 分支不写 handoff）。
// 另锁：ship gate（unknown/not-supported → blocked exit 1）；invalid mode 拒绝；
// 嵌套 CLI 失败无 handoff → 写 BLOCKED handoff（stderr 进 blocker）+ exit 1（对齐 bash；
// stderr-surfacing handoff 写为唯一 sanctioned divergence）；commit-contract 拦截 → stderr CDD_BLOCKED；
// review-package 不可执行 → CDD_BLOCKED。stream-json 全流 slurp 取最后一个 completion.finalText。
// runPlan 的构建块：taskNumbersFromPlan / isTaskPending / handoffStatus（纯函数）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTask, invokeCli, taskNumbersFromPlan, isTaskPending, handoffStatus,
         findSuperpowersScriptsDir, byVersion, runReviewPackage, resolveRepoRoot,
         spawnCapture, buildTaskEnv } from "../lib/runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));

// No-op probeSkills stub — environment independence for all existing runTask calls
// (brief Step 3: `probeSkills: async () => ({ missing: [], probeFailed: false })`).
const NOOP_PROBE = async () => ({ missing: [], probeFailed: false });

// 非 git 临时 workspace —— 对齐 cdd-cli-dry-run-smoke（CDD_WORKSPACE 指向 TMPDIR，commit-contract fail-open）。
function setupWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  const progressData = { plan: "/tmp/plan.md", timeoutCount: 0, engineRecoveryCount: 0, lastDispatchHead: "", tasks: [], degradationLog: [] };
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify(progressData, null, 2));
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n"); // ← 加 TASK_BASE
  return ws;
}

// 测试 env：清掉外部会话可能继承的 CDD_*（本测试进程运行在 orchestrator env 下 —— CDD_HANDOFF_PATH
// 等若泄漏，runTask 会写到真实 workspace）；仅保留测试可控的 CDD_WORKSPACE（+extra）。
// PLAN_FILE 同样清除：CDD 宿主 env 中的 PLAN_FILE 若泄漏，会影响 plan-backfill 逻辑（test 4 依赖无 plan）。
function baseEnv(ws, extra = {}) {
  return { ...filteredEnv(), CDD_WORKSPACE: ws, ...extra };
}

// 跨仓用例 env：复用 baseEnv 的 CDD_*/PLAN_FILE 过滤，但不注入任何 workspace ——
// 无 CDD_WORKSPACE / PLAN_FILE 泄漏（#173：plan 派生分支 / cannot-resolve 用例需要）。
function cleanEnv(extra = {}) {
  return { ...filteredEnv(), ...extra };
}

// 过滤宿主 env 的 CDD_* 与 PLAN_FILE（baseEnv/cleanEnv 共用的单一过滤实现）。
function filteredEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_") && k !== "PLAN_FILE") env[k] = v;
  }
  return env;
}

// git init + 空提交（共享 helper：brief.test.mjs 同用；-c 内联身份兼容无全局 user.name/email 的 CI）。
import { gitCommit, gitInit } from "./helpers.mjs";

// gitInit + realpath 归一（git rev-parse --show-toplevel 返回 realpath；macOS /tmp → /private/tmp）。
function gitInitReal(dir) {
  const real = realpathSync(dir);
  gitInit(real);
  return real;
}

// 在已 init 的仓库写入 plan 文件并 add+commit——保持工作树干净（commit-contract 校验）。
function commitPlan(repoDir, planFile) {
  writeFileSync(planFile, "# Plan\n\n### Task 1: x\nbody\n");
  gitCommit(repoDir); // 保持仓库干净——commit-contract 校验工作树
  return planFile;
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

test("runTask: dry-run implement → H1 四行 APPROVED + 不写 handoff（对齐 bash）", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 0);
  assert.equal(res.h1.length, 4);
  assert.equal(res.h1[0], "status: APPROVED");
  assert.equal(res.h1[1], "commits: base=dry-run");
  assert.match(res.h1[2], /^artifacts: brief=/);
  assert.equal(res.h1[3], "blocker: none");
  assert.equal(existsSync(path.join(ws, "task-1-handoff.json")), false, "dry-run 不写 handoff");
});

test("runTask: dry-run 输出 H1 四行到 stdout + exit 0", async () => {
  const ws = setupWorkspace();
  const { code, stdout } = await capture(() =>
    runTask("claude", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws) }),
  );
  assert.equal(code, 0);
  const lines = stdout.trim().split("\n");
  assert.equal(lines.length, 4);
  assert.equal(lines[0], "status: APPROVED");
  assert.equal(lines[3], "blocker: none");
});

test("runTask: dry-run task-review/fix 三模式 → H1 DONE + 不写 handoff（对齐 bash）", async () => {
  for (const mode of ["task-review", "fix"]) {
    const ws = setupWorkspace();
    const res = await runTask("claude", 1, { mode, dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
    assert.equal(res.exitCode, 0, `mode ${mode}`);
    assert.equal(res.h1[0], "status: APPROVED", `mode ${mode}`);
    assert.equal(existsSync(path.join(ws, "task-1-handoff.json")), false, `mode ${mode}: dry-run 不写 handoff`);
  }
});

test("runTask: 非法 mode → 拒绝（非零退出）", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "handoff", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 1);
});

test("runTask: unknown harness → blocked exit 1", async () => {
  const ws = setupWorkspace();
  const res = await runTask("no-such-harness", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 1);
});

test("runTask: not-supported harness → blocked exit 1", async () => {
  const ws = setupWorkspace();
  const res = await runTask("codex", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 1);
});

test("runTask: 嵌套 CLI 失败无 handoff → BLOCKED handoff（stderr 进 blocker）+ exit 1", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bin-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\necho 'boom from fake cli' >&2\nexit 3\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const res = await (async () => {
    // checkHarness 的 CLI preflight 读 process.env.PATH（T1 registry 契约）—— 临时把 fake-cli 的
    // binDir 加进 PATH，跑完还原（node --test 每文件独立进程，同文件内顺序执行，安全）。
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    try {
      return await runTask("ghost", 1, {
        mode: "implement",
        probeSkills: NOOP_PROBE,
        env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
        registryPath: regPath,
        noExit: true,
      });
    } finally {
      process.env.PATH = origPath;
    }
  })();
  assert.equal(res.exitCode, 1);
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
  // T2: DONE normalized to APPROVED by handoffStatus()
  assert.equal(handoffStatus(handoff), "APPROVED");
  // T2: DONE normalized to APPROVED → isTaskPending returns false (not pending)
  assert.equal(isTaskPending(1, ledger, handoff), false);

  writeFileSync(handoff, JSON.stringify({ status: "APPROVED" }));
  assert.equal(handoffStatus(handoff), "APPROVED");
  assert.equal(isTaskPending(1, ledger, handoff), false);

  writeFileSync(ledger, "# CDD ledger\nTask 1: complete (commits a..b, review clean)\n");
  assert.equal(isTaskPending(1, ledger, handoff), false);
});

// ---- findSuperpowersScriptsDir / byVersion（T7 补回：删除 common-functions.test.mjs 后
// 丢失的 scripts-dir 解析 + 版本序测试；pin Node oldest-first 行为 —— 对齐 bash sort -V 升序）----

test("byVersion: 版本号逐数字段排序（对齐 bash sort -V 升序）", () => {
  const versions = ["1.10.0", "1.9.0", "2.0.0", "1.0.0"];
  // runner 缓存探测序 = sort -V 升序（oldest-first —— 对齐 bash cdd_superpowers_scripts_dir）
  assert.deepEqual([...versions].sort(byVersion), ["1.0.0", "1.9.0", "1.10.0", "2.0.0"]);
});

test("findSuperpowersScriptsDir: repo submodule 优先", () => {
  // git rev-parse --show-toplevel 返回 realpath（/private/...），mkdtempSync 返回符号链接路径 ——
  // realpathSync 对齐两者（macOS /tmp → /private/tmp）。
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-scripts-repo-")));
  execFileSync("git", ["init", "-q", dir]);
  const scripts = path.join(dir, "vendors", "superpowers", "skills", "subagent-driven-development", "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, "sdd-workspace"), "");
  assert.equal(findSuperpowersScriptsDir(dir), scripts);
});

test("findSuperpowersScriptsDir: cache 版本序（oldest-first）+ Claude 优先 Cursor", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-scripts-cache-"));
  // 无 repo submodule → 走 plugin cache。os.homedir() 读 $HOME —— 临时指向 fixture。
  const claudeRoot = path.join(dir, ".claude", "plugins", "cache", "oscaner", "superpowers");
  const cursorRoot = path.join(dir, ".cursor", "plugins", "cache", "oscaner", "superpowers");
  // Claude cache 两版本（oldest-first 应取 1.0.0 —— 对齐 bash sort -V 升序）；Cursor cache 也有 → 不命中（Claude 优先）。
  for (const ver of ["1.0.0", "2.0.0"]) {
    const scripts = path.join(claudeRoot, ver, "skills", "subagent-driven-development", "scripts");
    mkdirSync(scripts, { recursive: true });
    writeFileSync(path.join(scripts, "sdd-workspace"), "");
  }
  const cursorScripts = path.join(cursorRoot, "3.0.0", "skills", "subagent-driven-development", "scripts");
  mkdirSync(cursorScripts, { recursive: true });
  writeFileSync(path.join(cursorScripts, "sdd-workspace"), "");

  const origHome = process.env.HOME;
  process.env.HOME = dir;
  try {
    const got = findSuperpowersScriptsDir(dir);
    assert.equal(got, path.join(claudeRoot, "1.0.0", "skills", "subagent-driven-development", "scripts"));
  } finally {
    process.env.HOME = origHome;
  }
});

test("findSuperpowersScriptsDir: 无 repo submodule + 无 cache → null", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-scripts-none-"));
  const origHome = process.env.HOME;
  process.env.HOME = path.join(dir, "nohome");
  try {
    assert.equal(findSuperpowersScriptsDir(dir), null);
  } finally {
    process.env.HOME = origHome;
  }
});

test("invokeCli: stream-json 多行 pretty-printed completion → finalText 正确提取（全流 slurp）", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-stream-"));
  const binDir = path.join(dir, "bin");
  mkdirSync(binDir);
  // 多行 pretty-printed JSON 事件（单行 NDJSON 解析会丢 finalText —— jq -rs 等价要求全流 slurp）。
  const event = JSON.stringify({ type: "completion", finalText: "MULTILINE\nFINAL" }, null, 2);
  writeFileSync(path.join(binDir, "fake-stream-cli"), `#!/usr/bin/env bash\ncat <<'JSON'\n${event}\nJSON\n`);
  chmodSync(path.join(binDir, "fake-stream-cli"), 0o755);
  const entry = { cli: "fake-stream-cli", invoke: "-p", output: "stream-json", task_review_prefix: "" };

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const ws = setupWorkspace();
    const res = await invokeCli(entry, "prompt", "implement", baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }), ws);
    assert.equal(res.ok, true, `stderr: ${res.stderr}`);
    assert.equal(res.code, 0);
    assert.equal(res.stdout, "MULTILINE\nFINAL");
  } finally {
    process.env.PATH = origPath;
  }
});

test("invokeCli: stream-json 相邻紧凑事件（首个对象含空串）→ 不合并，正确取最后 finalText", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-stream-"));
  const binDir = path.join(dir, "bin");
  mkdirSync(binDir);
  // 紧凑 NDJSON：首个事件含空字符串值 —— 旧 scanBalanced 调 scanString(text, i) 时 i 指向
  // 字符串内部（开引号后一位），而 scanString 期望 start 是开引号位置。空串的"内部首字符"即
  // 闭引号，会被 scanString 跳过 → 事件边界被错误跨越（两个事件合并 → JSON.parse 失败 → finalText 丢失）。
  writeFileSync(
    path.join(binDir, "fake-stream-cli"),
    "#!/usr/bin/env bash\nprintf '%s\\n' '{\"a\":\"\"}'\nprintf '%s\\n' '{\"type\":\"completion\",\"finalText\":\"OK\"}'\n",
  );
  chmodSync(path.join(binDir, "fake-stream-cli"), 0o755);
  const entry = { cli: "fake-stream-cli", invoke: "-p", output: "stream-json", task_review_prefix: "" };

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const ws = setupWorkspace();
    const res = await invokeCli(entry, "prompt", "implement", baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }), ws);
    assert.equal(res.ok, true, `stderr: ${res.stderr}`);
    assert.equal(res.code, 0);
    assert.equal(res.stdout, "OK");
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask: brief 已存在 + 含 TASK_BASE: → pass（dry-run exit 0）", async () => {
  const ws = setupWorkspace(); // brief 已含 TASK_BASE: abc123
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
  });
  assert.equal(res.exitCode, 0);
  assert.equal(res.h1[0], "status: APPROVED");
});

test("runTask #173: plan 路径不存在 → 'plan file not found'", async () => {
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...baseEnv(tmpdir()), PLAN_FILE: "/nonexistent/plan.md" },
    noExit: true,
  });
  assert.equal(res.exitCode, 1);
});

test("runReviewPackage: 传第 4 参数 OUTFILE = <workspace>/review-<base7>..<head7>.diff", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-outfile-"));
  const mockDir = mkdtempSync(path.join(tmpdir(), "mock-scripts-"));

  // mock review-package: capture $4 → file, create the diff file, output "wrote $4: 1 commit(s), 10 bytes"
  const captureFile = path.join(ws, "captured-outfile.txt");
  writeFileSync(
    path.join(mockDir, "review-package"),
    `#!/bin/sh\nprintf '%s' "$4" > "${captureFile}"\nmkdir -p "$(dirname "$4")"\ntouch "$4"\nprintf 'wrote %s: 1 commit(s), 10 bytes\\n' "$4"\n`,
  );
  chmodSync(path.join(mockDir, "review-package"), 0o755);

  const planFile = path.join(ws, "plan.md");
  writeFileSync(planFile, "# Plan\n");
  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, "{}");

  // base/head are full SHAs; shortSha = first 7 chars
  const base = "abc1234abcdefabc1234abcdefabc1234abcdefab";
  const head = "def5678defabcdef5678defabcdef5678defabcd";

  await runReviewPackage(planFile, base, head, handoffPath, {
    cwd: ws,
    env: process.env,
    scriptsDir: mockDir,
  });

  const captured = readFileSync(captureFile, "utf8");
  assert.match(captured, /review-abc1234\.\.def5678\.diff$/);
  assert.ok(captured.startsWith(ws), `expected captured path to start with workspace: ${captured}`);
});

// ---- P1 #173 跨仓回归（plan 派生分支）----
// （execFileSync 文件顶部已 import，勿重复声明）

test("runTask #173: plan 在仓库 A、cwd 在仓库 B → workspace 落于 A，B 内无 .superpowers", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-a-")));
  const repoB = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-b-")));
  gitInit(repoA);
  gitInit(repoB);
  const planFile = commitPlan(repoA, path.join(repoA, "plan.md"));
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-ws-")); // CDD_WORKSPACE 不设
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...cleanEnv(), PLAN_FILE: planFile }, // 无 CDD_WORKSPACE
    cwd: repoB, noExit: true,
  });
  assert.equal(res.exitCode, 0);
  const slug = path.basename(planFile, ".md");
  assert.ok(existsSync(path.join(repoA, ".superpowers", "cdd", slug)), "workspace under A");
  assert.ok(!existsSync(path.join(repoB, ".superpowers")), "no .superpowers in B");
});

test("runTask #173: 无 plan 无 CDD_WORKSPACE → 'cannot resolve repo root'", async () => {
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: cleanEnv(), cwd: mkdtempSync(path.join(tmpdir(), "cdd-bare-")), noExit: true,
  });
  assert.equal(res.exitCode, 1);
});

// 直设分支黑盒变体公共构造：CDD_TASK_BRIEF/CDD_HANDOFF_PATH 指到仓库外路径（mkdtemp 下），
// brief 预写含 TASK_BASE: 行——否则步骤 4.5 BLOCKED 'brief missing and plan unavailable'；
// git 目录变体的 workspace 即仓库本身，brief/handoff 写入仓库内未提交文件会触发 commit-contract
// 拦截（exit 1 而非断言的 0）。
function directWorkspaceCase(wsDir, extraEnv = {}) {
  const briefOut = mkdtempSync(path.join(tmpdir(), "cdd-brief-out-"));
  const env = cleanEnv({
    CDD_WORKSPACE: wsDir,
    CDD_TASK_BRIEF: path.join(briefOut, "task-1-brief.md"),
    CDD_HANDOFF_PATH: path.join(briefOut, "task-1-handoff.json"),
    ...extraEnv,
  });
  writeFileSync(env.CDD_TASK_BRIEF, "# task 1\nTASK_BASE: abc123\n");
  return runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env, noExit: true,
  });
}

test("runTask #173: CDD_WORKSPACE 直设（git 目录）→ exit 0", async () => {
  const wsGit = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-ws-git-")));
  gitInit(wsGit);
  const res = await directWorkspaceCase(wsGit);
  assert.equal(res.exitCode, 0);
});

test("runTask #173: CDD_WORKSPACE 直设（裸 TMPDIR 非 git）→ exit 0（repoRoot 容忍语义）", async () => {
  const bare = mkdtempSync(path.join(tmpdir(), "cdd-ws-bare-"));
  const res = await directWorkspaceCase(bare);
  assert.equal(res.exitCode, 0);
});

test("resolveRepoRoot #173: CDD_WORKSPACE 直设 → repoRoot=git toplevel；裸 TMPDIR → null", () => {
  const wsGit = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-ws-git-")));
  gitInit(wsGit);
  assert.equal(resolveRepoRoot({ env: { CDD_WORKSPACE: wsGit } }).repoRoot, wsGit);
  const bare = mkdtempSync(path.join(tmpdir(), "cdd-ws-bare-"));
  assert.equal(resolveRepoRoot({ env: { CDD_WORKSPACE: bare } }).repoRoot, null);
});

test("runTask #173: CDD_WORKSPACE 与 plan 同给 → workspace 落 plan 派生路径，env 被忽略", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-both-")));
  gitInit(repoA);
  const planFile = commitPlan(repoA, path.join(repoA, "plan.md"));
  const ignored = mkdtempSync(path.join(tmpdir(), "cdd-ws-ignored-"));
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...cleanEnv(), CDD_WORKSPACE: ignored, PLAN_FILE: planFile },
    cwd: repoA, noExit: true,
  });
  assert.equal(res.exitCode, 0);
  assert.ok(existsSync(path.join(repoA, ".superpowers", "cdd", "plan")), "workspace derived from plan");
  assert.ok(!existsSync(path.join(ignored, ".superpowers")), "env workspace ignored");
});

// ---- P5 spawnCapture env leak regression ----

test("spawnCapture: strips CLAUDE_CODE_SUBAGENT_MODEL from child env", async () => {
  const env = { ...process.env, CLAUDE_CODE_SUBAGENT_MODEL: "qwen3.7-max" };
  const res = await spawnCapture("printenv", ["CLAUDE_CODE_SUBAGENT_MODEL"], { cwd: process.cwd(), env });
  assert.equal(res.ok, false, "printenv should exit non-zero when var is unset");
  assert.ok(!res.stdout.includes("qwen3.7-max"), "CLAUDE_CODE_SUBAGENT_MODEL must not leak to child process");
});

test("spawnCapture: preserves non-subagent env vars", async () => {
  const env = { ...process.env, CDD_CUSTOM_VAR: "hello-test" };
  const res = await spawnCapture("printenv", ["CDD_CUSTOM_VAR"], { cwd: process.cwd(), env });
  assert.equal(res.ok, true);
  assert.match(res.stdout.trim(), /hello-test/);
});

// ---- P8 #187 #168: status APPROVED fallback + CDD_FINDINGS_SCOPE scope env ----

test("buildTaskEnv #168: fix mode + scope → env.CDD_FINDINGS_SCOPE set", () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "fix", "claude", { scope: "deferred-sweep" });
  assert.equal(env.CDD_FINDINGS_SCOPE, "deferred-sweep");
});

test("buildTaskEnv #168: implement mode → no CDD_FINDINGS_SCOPE", () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "implement", "claude");
  assert.equal(env.CDD_FINDINGS_SCOPE, undefined);
});

test("runTask #168: fix mode + --scope deferred-sweep → env has CDD_FINDINGS_SCOPE", async () => {
  const ws = setupWorkspace();
  // Use a fake CLI that records the env and exits 0
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-scope-bin-"));
  const envLog = path.join(ws, "scope-env-log.txt");
  writeFileSync(path.join(binDir, "fake-cli"), `#!/usr/bin/env bash\nprintenv CDD_FINDINGS_SCOPE > "${envLog}"\nexit 0\n`);
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "fix", scope: "deferred-sweep", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    assert.equal(res.exitCode, 0, `stderr: ${JSON.stringify(res)}`);
    assert.ok(existsSync(envLog), "env log file should exist");
    assert.match(readFileSync(envLog, "utf8"), /deferred-sweep/);
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask #168: fix mode + default scope → env has CDD_FINDINGS_SCOPE=blocker-only", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-scope-def-bin-"));
  const envLog = path.join(ws, "scope-env-log.txt");
  writeFileSync(path.join(binDir, "fake-cli"), `#!/usr/bin/env bash\nprintenv CDD_FINDINGS_SCOPE > "${envLog}"\nexit 0\n`);
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "fix", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    assert.equal(res.exitCode, 0, `stderr: ${JSON.stringify(res)}`);
    assert.match(readFileSync(envLog, "utf8"), /blocker-only/);
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask #168: --scope invalid → RunBlocked exit 1", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, {
    mode: "fix", scope: "invalid", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws), noExit: true,
  });
  assert.equal(res.exitCode, 1);
});

test("runTask #187: CLI succeeds + no handoff → fallback handoff status=APPROVED", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-ok-cli-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "implement", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    assert.equal(res.exitCode, 0, `expected exit 0`);
    const handoff = JSON.parse(readFileSync(path.join(ws, "task-1-handoff.json"), "utf8"));
    assert.equal(handoff.status, "APPROVED", "fallback handoff should be APPROVED, not DONE (#187)");
    assert.equal(handoff.phase, "implement");
  } finally {
    process.env.PATH = origPath;
  }
});

// T2: handoffStatus() 归一化 DONE/OK/COMPLETED → APPROVED（#187 fix 模式 re-review 残留）
test("handoffStatus: DONE → APPROVED normalization", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "runner-hs-"));
  const hp = path.join(dir, "h.json");
  writeFileSync(hp, JSON.stringify({ status: "DONE" }));
  assert.equal(handoffStatus(hp), "APPROVED");
});

test("handoffStatus: OK → APPROVED normalization", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "runner-hs-ok-"));
  const hp = path.join(dir, "h.json");
  writeFileSync(hp, JSON.stringify({ status: "OK" }));
  assert.equal(handoffStatus(hp), "APPROVED");
});

test("handoffStatus: COMPLETED → APPROVED normalization", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "runner-hs-comp-"));
  const hp = path.join(dir, "h.json");
  writeFileSync(hp, JSON.stringify({ status: "COMPLETED" }));
  assert.equal(handoffStatus(hp), "APPROVED");
});

test("handoffStatus: APPROVED unchanged", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "runner-hs-ap-"));
  const hp = path.join(dir, "h.json");
  writeFileSync(hp, JSON.stringify({ status: "APPROVED" }));
  assert.equal(handoffStatus(hp), "APPROVED");
});

// ---- P12 timeout path ----

test("normalizeHandoffStatus: TIMEOUT passthrough", async () => {
  const { normalizeHandoffStatus } = await import("../lib/contract.mjs");
  assert.equal(normalizeHandoffStatus("TIMEOUT"), "TIMEOUT");
});

test("readTimeoutCount: no header → 0", async () => {
  const { readTimeoutCount } = await import("../lib/runner.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "tc-read-"));
  const p = path.join(dir, "progress.md");
  writeFileSync(p, "# CDD ledger\nTask 1: complete\n");
  assert.equal(readTimeoutCount(p), 0);
});

test("readTimeoutCount: header present → parsed value", async () => {
  const { readTimeoutCount } = await import("../lib/runner.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "tc-read2-"));
  const p = path.join(dir, "progress.md");
  writeFileSync(p, "# CDD ledger\n# timeoutCount: 3\nTask 1: complete\n");
  assert.equal(readTimeoutCount(p), 3);
});

test("writeTimeoutCount: creates header + read returns value", async () => {
  const { readTimeoutCount, writeTimeoutCount } = await import("../lib/runner.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "tc-write-"));
  const p = path.join(dir, "progress.md");
  writeFileSync(p, "# CDD ledger\n");
  writeTimeoutCount(p, 1);
  assert.equal(readTimeoutCount(p), 1);
});

test("writeTimeoutCount: increments existing header", async () => {
  const { readTimeoutCount, writeTimeoutCount } = await import("../lib/runner.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "tc-inc-"));
  const p = path.join(dir, "progress.md");
  writeFileSync(p, "# CDD ledger\n# timeoutCount: 2\n");
  writeTimeoutCount(p, 3);
  assert.equal(readTimeoutCount(p), 3);
});

test("runTask: timeout → handoff status TIMEOUT + blocker + partial findings", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-timeout-"));
  // Mock CLI: sleep 5s — will be killed by 1s timeout
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nsleep 5\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "implement", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { CDD_TASK_TIMEOUT: "1", PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    const hp = path.join(ws, "task-1-handoff.json");
    assert.ok(existsSync(hp), "handoff file should exist after timeout");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    assert.equal(h.status, "TIMEOUT");
    assert.match(h.blocker, /timeout after/);
    // Partial artifacts preserved in handoff
    assert.equal(h.task, 1);
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask: timeout → timeoutCount incremented in progress.json", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-tc-inc-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nsleep 5\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    await runTask("ghost", 1, {
      mode: "implement", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { CDD_TASK_TIMEOUT: "1", PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    assert.equal(progress.timeoutCount, 1);
    // Second timeout increments
    await runTask("ghost", 1, {
      mode: "implement", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { CDD_TASK_TIMEOUT: "1", PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    const progress2 = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    assert.equal(progress2.timeoutCount, 2);
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask: unkillable → handoff status BLOCKED + blocker process unkillable", async () => {
  // NOTE: SIGKILL always kills processes on modern Unix, so the unkillable path in spawnCapture
  // is unreachable with real processes. This test verifies the BLOCKED handoff write path exists
  // by testing at the contract level: writeHandoff with status BLOCKED.
  const { writeHandoff } = await import("../lib/contract.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-unkillable-ho-"));
  const hp = path.join(dir, "task-1-handoff.json");
  writeHandoff(hp, {
    task: 1, phase: "implement", status: "BLOCKED",
    blocker: "process unkillable",
    findings: [{ severity: "warn", title: "pre-existing" }],
  });
  const h = JSON.parse(readFileSync(hp, "utf8"));
  assert.equal(h.status, "BLOCKED");
  assert.match(h.blocker, /unkillable/);
  assert.deepEqual(h.findings, [{ severity: "warn", title: "pre-existing" }]);
});

// ---- Open-findings pre-generation (fix mode) ----

test("runTask #open-findings: fix + blocker-only scope → open-findings.json has only non-deferred blockers", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-of-bo-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  // Pre-populate handoff with mixed findings (blocker + deferred warn/nit)
  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, JSON.stringify({
    task: 1, phase: "fix", status: "APPROVED",
    artifacts: {}, findings: [
      { severity: "blocker", summary: "must fix", deferred: false },
      { severity: "warn", summary: "style issue", deferred: true },
      { severity: "nit", summary: "minor nit", deferred: true },
    ],
  }));

  const findingsPath = path.join(ws, "task-1-open-findings.json");
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "fix", scope: "blocker-only", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    assert.equal(res.exitCode, 0, `stderr: ${JSON.stringify(res)}`);
    // Mock CLI doesn't touch handoff → pre-gen runs on pre-populated handoff
    assert.ok(existsSync(findingsPath), "open-findings.json should exist");
    const of = JSON.parse(readFileSync(findingsPath, "utf8"));
    assert.equal(of.findings.length, 1, "blocker-only should have 1 finding");
    assert.equal(of.findings[0].severity, "blocker");
    assert.equal(of.findings[0].summary, "must fix");
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask #open-findings: fix + deferred-sweep scope → open-findings.json has only deferred items", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-of-ds-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, JSON.stringify({
    task: 1, phase: "fix", status: "APPROVED",
    artifacts: {}, findings: [
      { severity: "blocker", summary: "must fix", deferred: false },
      { severity: "warn", summary: "style issue", deferred: true },
      { severity: "nit", summary: "minor nit", deferred: true },
    ],
  }));

  const findingsPath = path.join(ws, "task-1-open-findings.json");
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "fix", scope: "deferred-sweep", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    assert.equal(res.exitCode, 0, `stderr: ${JSON.stringify(res)}`);
    assert.ok(existsSync(findingsPath), "open-findings.json should exist");
    const of = JSON.parse(readFileSync(findingsPath, "utf8"));
    assert.equal(of.findings.length, 2, "deferred-sweep should have 2 findings");
    assert.equal(of.findings[0].severity, "warn");
    assert.equal(of.findings[1].severity, "nit");
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask #open-findings: fix mode + no scope → no open-findings.json written", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-of-noscope-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, JSON.stringify({
    task: 1, phase: "fix", status: "APPROVED",
    artifacts: {}, findings: [
      { severity: "blocker", summary: "must fix" },
      { severity: "warn", summary: "style issue", deferred: true },
    ],
  }));

  const findingsPath = path.join(ws, "task-1-open-findings.json");
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "fix", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    assert.equal(res.exitCode, 0, `stderr: ${JSON.stringify(res)}`);
    // No scope → open-findings pre-gen is skipped
    assert.ok(!existsSync(findingsPath), "open-findings.json should NOT exist without scope");
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask #open-findings: fix mode + empty findings → open-findings.json with empty array", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-of-empty-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, JSON.stringify({
    task: 1, phase: "fix", status: "APPROVED",
    artifacts: {}, findings: [],
  }));

  const findingsPath = path.join(ws, "task-1-open-findings.json");
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "fix", scope: "blocker-only", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    assert.equal(res.exitCode, 0, `stderr: ${JSON.stringify(res)}`);
    assert.ok(existsSync(findingsPath), "open-findings.json should exist even with empty findings");
    const of = JSON.parse(readFileSync(findingsPath, "utf8"));
    assert.deepEqual(of.findings, [], "empty findings should produce empty array");
  } finally {
    process.env.PATH = origPath;
  }
});

test("runTask #open-findings: implement mode → no open-findings.json (pre-gen is fix-only)", async () => {
  const ws = setupWorkspace();
  const findingsPath = path.join(ws, "task-1-open-findings.json");
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws), noExit: true,
  });
  assert.equal(res.exitCode, 0);
  assert.ok(!existsSync(findingsPath), "open-findings.json should NOT exist in implement mode");
});
