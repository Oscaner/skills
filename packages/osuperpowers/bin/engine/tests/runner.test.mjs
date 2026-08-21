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
         findSuperpowersScriptsDir, byVersion, runReviewPackage } from "../lib/runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));

// No-op probeSkills stub — environment independence for all existing runTask calls
// (brief Step 3: `probeSkills: async () => ({ missing: [], probeFailed: false })`).
const NOOP_PROBE = async () => ({ missing: [], probeFailed: false });

// 非 git 临时 workspace —— 对齐 cdd-cli-dry-run-smoke（CDD_WORKSPACE 指向 TMPDIR，commit-contract fail-open）。
function setupWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger — plan: /tmp/plan.md\n");
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n"); // ← 加 TASK_BASE
  return ws;
}

// 测试 env：清掉外部会话可能继承的 CDD_*（本测试进程运行在 orchestrator env 下 —— CDD_HANDOFF_PATH
// 等若泄漏，runTask 会写到真实 workspace）；仅保留测试可控的 CDD_WORKSPACE（+extra）。
// PLAN_FILE 同样清除：CDD 宿主 env 中的 PLAN_FILE 若泄漏，会影响 plan-backfill 逻辑（test 4 依赖无 plan）。
function baseEnv(ws, extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_") && k !== "PLAN_FILE") env[k] = v;
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

test("runTask: dry-run implement → H1 四行 DONE + 不写 handoff（对齐 bash）", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  assert.equal(res.exitCode, 0);
  assert.equal(res.h1.length, 4);
  assert.equal(res.h1[0], "status: DONE");
  assert.equal(res.h1[1], "commits: base=dry-run head=dry-run");
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
  assert.equal(lines[0], "status: DONE");
  assert.equal(lines[3], "blocker: none");
});

test("runTask: dry-run task-review/fix 三模式 → H1 DONE + 不写 handoff（对齐 bash）", async () => {
  for (const mode of ["task-review", "fix"]) {
    const ws = setupWorkspace();
    const res = await runTask("claude", 1, { mode, dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
    assert.equal(res.exitCode, 0, `mode ${mode}`);
    assert.equal(res.h1[0], "status: DONE", `mode ${mode}`);
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
  assert.equal(handoffStatus(handoff), "DONE");
  assert.equal(isTaskPending(1, ledger, handoff), true);

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

test("runTask: Mode A commit-contract 拦截 → stderr CDD_BLOCKED + exit 1（对齐 bash cdd_validate_commit_contract）", async () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-contract-stderr-")));
  execFileSync("git", ["init", "-q", dir]);
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger — plan: /tmp/plan.md\n");
  writeFileSync(path.join(dir, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(dir, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n");
  writeFileSync(path.join(dir, "dirty.txt"), "uncommitted\n"); // 脏工作树信号

  const { code, stderr } = await capture(() =>
    runTask("claude", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(dir) }),
  );
  assert.equal(code, 1);
  assert.match(stderr, /CDD_BLOCKED: uncommitted changes at return \(implement\)/);
});

test("runTask: task-review 模式 review-package 不可执行 → CDD_BLOCKED + exit 1（对齐 bash [[ -x ]]）", async () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-reviewpkg-")));
  writeFileSync(path.join(dir, "plan.md"), "# Plan\n### Task 1: test\n");
  writeFileSync(path.join(dir, "progress.md"), `# CDD ledger — plan: ${path.join(dir, "plan.md")}\n`);
  writeFileSync(path.join(dir, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(dir, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n");
  // HOME → fake plugin cache：review-package 存在但不可执行（无 chmod +x）。
  const scripts = path.join(
    dir, ".claude", "plugins", "cache", "oscaner", "superpowers", "1.0.0",
    "skills", "subagent-driven-development", "scripts",
  );
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, "sdd-workspace"), "");
  writeFileSync(path.join(scripts, "review-package"), "#!/usr/bin/env bash\necho should-not-run\n");
  // fake claude 过 preflight（review-package 抛错前不会真的 invoke）。
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-review-bin-"));
  writeFileSync(path.join(binDir, "claude"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "claude"), 0o755);

  const origPath = process.env.PATH;
  const origHome = process.env.HOME;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  process.env.HOME = dir;
  try {
    const { code, stderr } = await capture(() =>
      runTask("claude", 1, {
        mode: "task-review",
        probeSkills: NOOP_PROBE,
        env: baseEnv(dir, {
          CDD_TASK_REVIEW_FIXED_POINT: "HEAD~1",
          PATH: `${binDir}${path.delimiter}${origPath}`,
        }),
        cwd: dir,
        registryPath: REG_PATH,
      }),
    );
    assert.equal(code, 1);
    assert.match(stderr, /CDD_BLOCKED: review-package not executable:/);
  } finally {
    process.env.PATH = origPath;
    process.env.HOME = origHome;
  }
});

test("runTask: brief 已存在 + 含 TASK_BASE: → pass（dry-run exit 0）", async () => {
  const ws = setupWorkspace(); // brief 已含 TASK_BASE: abc123
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
  });
  assert.equal(res.exitCode, 0);
  assert.equal(res.h1[0], "status: DONE");
});

test("runTask: brief 已存在 + 缺 TASK_BASE: → BLOCKED exit 1", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger — plan: /tmp/plan.md\n");
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\n"); // no TASK_BASE
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
  });
  assert.equal(res.exitCode, 1);
});

test("runTask: brief 不存在 + plan 可用 → auto-generate + exit 0", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger\n"); // no plan in ledger
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  // no brief file
  const planDir = mkdtempSync(path.join(tmpdir(), "plan-"));
  const planFile = path.join(planDir, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: Do something\nTask body\n");
  const env = baseEnv(ws, {
    CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md"),
    PLAN_FILE: planFile,
  });
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env, cwd: REPO_ROOT, noExit: true,
  });
  assert.equal(res.exitCode, 0);
  assert.ok(existsSync(path.join(ws, "task-1-brief.md")), "brief should be auto-generated");
  assert.match(readFileSync(path.join(ws, "task-1-brief.md"), "utf8"), /^TASK_BASE: /m);
});

test("runTask: brief 不存在 + plan 不可用 → BLOCKED exit 1", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger\n"); // no plan
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  // no brief, no plan
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
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
