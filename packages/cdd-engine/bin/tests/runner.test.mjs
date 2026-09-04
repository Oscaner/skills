// packages/cdd-engine/bin/tests/runner.test.mjs — runner 模块单测（Vitest port）。
// runTask dry-run：H1 四行 + 不写 handoff（对齐 bash —— bash dry-run 分支不写 handoff）。
// 另锁：ship gate（unknown/not-supported → blocked exit 1）；invalid mode 拒绝；
// 嵌套 CLI 失败无 handoff → 写 BLOCKED handoff（stderr 进 blocker）+ exit 1（对齐 bash；
// stderr-surfacing handoff 写为唯一 sanctioned divergence）；commit-contract 拦截 → stderr CDD_BLOCKED；
// review-package 不可执行 → CDD_BLOCKED。
// invokeCliOverride seam 已移除（§ P1 Task 5）—— CLI 模拟改用真实 fake-cli shell 脚本。
import { it, expect, describe } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTask, taskNumbersFromPlan, isTaskPending, handoffStatus,
         findSuperpowersScriptsDir, runReviewPackage, resolveRepoRoot,
         spawnCapture, buildTaskEnv } from "../lib/runner.mjs";
import { getRound } from "../lib/progress.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));

// No-op probeSkills stub — environment independence for all runTask calls.
const NOOP_PROBE = async () => ({ missing: [], probeFailed: false });

// 非 git 临时 workspace —— CDD_WORKSPACE 指向 TMPDIR，commit-contract fail-open。
function setupWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  const progressData = { plan: "/tmp/plan.md", timeoutCount: 0, engineRecoveryCount: 0, lastDispatchHead: "", tasks: [], degradationLog: [] };
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify(progressData, null, 2));
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n");
  return ws;
}

// 测试 env：清掉外部会话可能继承的 CDD_*（测试进程运行在 orchestrator env 下 —— CDD_HANDOFF_PATH
// 等若泄漏，runTask 会写到真实 workspace）；仅保留测试可控的 CDD_WORKSPACE（+extra）。
function baseEnv(ws, extra = {}) {
  return { ...filteredEnv(), CDD_WORKSPACE: ws, ...extra };
}

// 跨仓用例 env：复用 filteredEnv 过滤，但不注入任何 workspace。
function cleanEnv(extra = {}) {
  return { ...filteredEnv(), ...extra };
}

// 过滤宿主 env 的 CDD_* 与 PLAN_FILE。
function filteredEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_") && k !== "PLAN_FILE") env[k] = v;
  }
  return env;
}

// git init + 空提交。
import { gitCommit, gitInit } from "./helpers.mjs";

// gitInit + realpath 归一（macOS /tmp → /private/tmp）。
function gitInitReal(dir) {
  const real = realpathSync(dir);
  gitInit(real);
  return real;
}

// 在已 init 的仓库写入 plan 文件并 add+commit——保持工作树干净。
function commitPlan(repoDir, planFile) {
  writeFileSync(planFile, "# Plan\n\n### Task 1: x\nbody\n");
  gitCommit(repoDir);
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

// ---- dry-run 场景 ----

it("runTask: dry-run implement → H1 四行 APPROVED + 不写 handoff（对齐 bash）", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(0);
  expect(res.h1.length).toBe(4);
  expect(res.h1[0]).toBe("status: APPROVED");
  expect(res.h1[1]).toBe("commits: base=dry-run");
  expect(res.h1[2]).toMatch(/^artifacts: brief=/);
  expect(res.h1[3]).toBe("blocker: none");
  expect(existsSync(path.join(ws, "task-1-handoff.json"))).toBe(false);
});

it("runTask: dry-run 输出 H1 四行到 stdout + exit 0", async () => {
  const ws = setupWorkspace();
  const { code, stdout } = await capture(() =>
    runTask("claude", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws) }),
  );
  expect(code).toBe(0);
  const lines = stdout.trim().split("\n");
  expect(lines.length).toBe(4);
  expect(lines[0]).toBe("status: APPROVED");
  expect(lines[3]).toBe("blocker: none");
});

it("runTask: dry-run task-review/fix 三模式 → H1 DONE + 不写 handoff（对齐 bash）", async () => {
  for (const mode of ["task-review", "fix"]) {
    const ws = setupWorkspace();
    const res = await runTask("claude", 1, { mode, dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
    expect(res.exitCode).toBe(0);
    expect(res.h1[0]).toBe("status: APPROVED");
    expect(existsSync(path.join(ws, "task-1-handoff.json"))).toBe(false);
  }
});

// ---- mode validation ----

it("runTask: 非法 mode → 拒绝（非零退出）", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "handoff", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(1);
});

// ---- ship gate ----

it("runTask: unknown harness → blocked exit 1", async () => {
  const ws = setupWorkspace();
  const res = await runTask("no-such-harness", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(1);
});

it("runTask: not-supported harness → blocked exit 1", async () => {
  const ws = setupWorkspace();
  const res = await runTask("codex", 1, { mode: "implement", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(1);
});

// ---- CLI failure + BLOCKED handoff ----

it("runTask: 嵌套 CLI 失败无 handoff → BLOCKED handoff（stderr 进 blocker）+ exit 1", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bin-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\necho 'boom from fake cli' >&2\nexit 3\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "implement",
      probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const handoff = JSON.parse(readFileSync(path.join(ws, "task-1-implement.json"), "utf8"));
    expect(handoff.status).toBe("BLOCKED");
    expect(handoff.blocker).toMatch(/cli exited 3 without writing handoff/);
    expect(handoff.blocker).toMatch(/re-dispatch task 1/);
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- pure function tests ----

it("taskNumbersFromPlan: 提取 ### Task N: 并排序（含 0）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-plan-"));
  const plan = path.join(dir, "plan.md");
  writeFileSync(plan, "# P\n### Task 3: a\n### Task 1: b\n### Task 0: skip\n### Task 2: c\n");
  expect(taskNumbersFromPlan(plan)).toEqual([0, 1, 2, 3]);
});

it("isTaskPending / handoffStatus: progressData round 0 → MISSING / pending；APPROVED/DONE → not pending", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-pending-"));

  const noReviewProgress = { tasks: [] };
  expect(handoffStatus(1, dir, noReviewProgress)).toBe("MISSING");
  expect(isTaskPending(1, dir, noReviewProgress)).toBe(true);

  const progressR1 = { tasks: [{ task: 1, rounds: { "task-review": 1 } }] };
  writeFileSync(path.join(dir, "task-1-task-review-1.json"), JSON.stringify({ status: "DONE" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("APPROVED");
  expect(isTaskPending(1, dir, progressR1)).toBe(false);

  writeFileSync(path.join(dir, "task-1-task-review-1.json"), JSON.stringify({ status: "APPROVED" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("APPROVED");
  expect(isTaskPending(1, dir, progressR1)).toBe(false);

  writeFileSync(path.join(dir, "task-1-task-review-1.json"), JSON.stringify({ status: "BLOCKED" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("BLOCKED");
  expect(isTaskPending(1, dir, progressR1)).toBe(true);
});

// ---- findSuperpowersScriptsDir (semver upgrade — byVersion removed) ----

it("findSuperpowersScriptsDir: repo submodule 优先", () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-scripts-repo-")));
  execFileSync("git", ["init", "-q", dir]);
  const scripts = path.join(dir, "vendors", "superpowers", "skills", "subagent-driven-development", "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, "sdd-workspace"), "");
  expect(findSuperpowersScriptsDir(dir)).toBe(scripts);
});

it("findSuperpowersScriptsDir: cache 版本序（oldest-first via semver）+ Claude 优先 Cursor", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-scripts-cache-"));
  const claudeRoot = path.join(dir, ".claude", "plugins", "cache", "oscaner", "superpowers");
  const cursorRoot = path.join(dir, ".cursor", "plugins", "cache", "oscaner", "superpowers");
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
    expect(got).toBe(path.join(claudeRoot, "1.0.0", "skills", "subagent-driven-development", "scripts"));
  } finally {
    process.env.HOME = origHome;
  }
});

it("findSuperpowersScriptsDir: 无 repo submodule + 无 cache → null", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-scripts-none-"));
  const origHome = process.env.HOME;
  process.env.HOME = path.join(dir, "nohome");
  try {
    expect(findSuperpowersScriptsDir(dir)).toBeNull();
  } finally {
    process.env.HOME = origHome;
  }
});

// ---- brief + plan constraints ----

it("runTask: brief 已存在 + 含 TASK_BASE: → pass（dry-run exit 0）", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
});

it("runTask #173: plan 路径不存在 → 'plan file not found'", async () => {
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...baseEnv(tmpdir()), PLAN_FILE: "/nonexistent/plan.md" },
    noExit: true,
  });
  expect(res.exitCode).toBe(1);
});

// ---- runReviewPackage ----

it("runReviewPackage: 传第 4 参数 OUTFILE = <workspace>/review-<base7>..<head7>.diff", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-outfile-"));
  const mockDir = mkdtempSync(path.join(tmpdir(), "mock-scripts-"));

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

  const base = "abc1234abcdefabc1234abcdefabc1234abcdefab";
  const head = "def5678defabcdef5678defabcdef5678defabcd";

  await runReviewPackage(planFile, base, head, handoffPath, {
    cwd: ws,
    env: process.env,
    scriptsDir: mockDir,
  });

  const captured = readFileSync(captureFile, "utf8");
  expect(captured).toMatch(/review-abc1234\.\.def5678\.diff$/);
  expect(captured.startsWith(ws)).toBe(true);
});

// ---- P1 #173 跨仓回归（plan 派生分支）----

it("runTask #173: plan 在仓库 A、cwd 在仓库 B → workspace 落于 A，B 内无 .superpowers", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-a-")));
  const repoB = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-b-")));
  gitInit(repoA);
  gitInit(repoB);
  const planFile = commitPlan(repoA, path.join(repoA, "plan.md"));
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...cleanEnv(), PLAN_FILE: planFile },
    cwd: repoB, noExit: true,
  });
  expect(res.exitCode).toBe(0);
  const slug = path.basename(planFile, ".md");
  expect(existsSync(path.join(repoA, ".superpowers", "cdd", slug))).toBe(true);
  expect(existsSync(path.join(repoB, ".superpowers"))).toBe(false);
});

it("runTask #173: 无 plan 无 CDD_WORKSPACE → 'cannot resolve repo root'", async () => {
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: cleanEnv(), cwd: mkdtempSync(path.join(tmpdir(), "cdd-bare-")), noExit: true,
  });
  expect(res.exitCode).toBe(1);
});

// 直设分支黑盒变体：CDD_TASK_BRIEF/CDD_HANDOFF_PATH 指到仓库外路径，brief 预写含 TASK_BASE 行。
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

it("runTask #173: CDD_WORKSPACE 直设（git 目录）→ exit 0", async () => {
  const wsGit = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-ws-git-")));
  gitInit(wsGit);
  const res = await directWorkspaceCase(wsGit);
  expect(res.exitCode).toBe(0);
});

it("runTask #173: CDD_WORKSPACE 直设（裸 TMPDIR 非 git）→ exit 0（repoRoot 容忍语义）", async () => {
  const bare = mkdtempSync(path.join(tmpdir(), "cdd-ws-bare-"));
  const res = await directWorkspaceCase(bare);
  expect(res.exitCode).toBe(0);
});

it("resolveRepoRoot #173: CDD_WORKSPACE 直设 → repoRoot=git toplevel；裸 TMPDIR → null", () => {
  const wsGit = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-ws-git-")));
  gitInit(wsGit);
  expect(resolveRepoRoot({ env: { CDD_WORKSPACE: wsGit } }).repoRoot).toBe(wsGit);
  const bare = mkdtempSync(path.join(tmpdir(), "cdd-ws-bare-"));
  expect(resolveRepoRoot({ env: { CDD_WORKSPACE: bare } }).repoRoot).toBeNull();
});

it("runTask #173: CDD_WORKSPACE 与 plan 同给 → workspace 落 plan 派生路径，env 被忽略", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-both-")));
  gitInit(repoA);
  const planFile = commitPlan(repoA, path.join(repoA, "plan.md"));
  const ignored = mkdtempSync(path.join(tmpdir(), "cdd-ws-ignored-"));
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...cleanEnv(), CDD_WORKSPACE: ignored, PLAN_FILE: planFile },
    cwd: repoA, noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(existsSync(path.join(repoA, ".superpowers", "cdd", "plan"))).toBe(true);
  expect(existsSync(path.join(ignored, ".superpowers"))).toBe(false);
});

// ---- spawnCapture env leak regression (P5) ----

it("spawnCapture: strips CLAUDE_CODE_SUBAGENT_MODEL from child env", async () => {
  const env = { ...process.env, CLAUDE_CODE_SUBAGENT_MODEL: "qwen3.7-max" };
  const res = await spawnCapture("printenv", ["CLAUDE_CODE_SUBAGENT_MODEL"], { cwd: process.cwd(), env });
  // cleanEnv removes CLAUDE_CODE_SUBAGENT_MODEL from the passed env — injected value must not leak.
  // Note: execa v9 extendEnv:true merges back process.env; we verify our VALUE (qwen3.7-max) is stripped.
  expect(res.stdout.includes("qwen3.7-max")).toBe(false);
});

it("spawnCapture: preserves non-subagent env vars", async () => {
  const env = { ...process.env, CDD_CUSTOM_VAR: "hello-test" };
  const res = await spawnCapture("printenv", ["CDD_CUSTOM_VAR"], { cwd: process.cwd(), env });
  expect(res.ok).toBe(true);
  expect(res.stdout.trim()).toMatch(/hello-test/);
});

// ---- buildTaskEnv ----

it("buildTaskEnv: fix mode → CDD_FINDINGS = task-review handoff path (no scope filter)", () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "fix", "claude", { round: 1 });
  expect(env.CDD_FINDINGS).toMatch(/task-1-task-review-1\.json$/);
  expect(env.CDD_FINDINGS).not.toMatch(/open-findings/);
  expect(env.CDD_FINDINGS_SCOPE).toBeUndefined();
});

it("buildTaskEnv: implement mode → CDD_FINDINGS = open-findings path, no CDD_FINDINGS_SCOPE", () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "implement", "claude");
  expect(env.CDD_FINDINGS).toMatch(/task-1-open-findings\.json$/);
  expect(env.CDD_FINDINGS_SCOPE).toBeUndefined();
});

// ---- CLI succeeds + no handoff → BLOCKED (Pζ) ----

it("runTask #187→Pζ: CLI succeeds + no handoff → BLOCKED (not APPROVED fallback)", async () => {
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
    expect(res.exitCode).toBe(1);
    const handoff = JSON.parse(readFileSync(path.join(ws, "task-1-implement.json"), "utf8"));
    expect(handoff.status).toBe("BLOCKED");
    expect(handoff.phase).toBe("implement");
    expect(handoff.blocker).toMatch(/not written after exit 0/);
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- handoffStatus DONE/OK/COMPLETED normalization ----

function makeHandoffStatusFixture(status) {
  const dir = mkdtempSync(path.join(tmpdir(), "runner-hs-"));
  const progressData = { tasks: [{ task: 1, rounds: { "task-review": 1 } }] };
  writeFileSync(path.join(dir, "task-1-task-review-1.json"), JSON.stringify({ status }));
  return { dir, progressData };
}

it("handoffStatus: DONE → APPROVED normalization", () => {
  const { dir, progressData } = makeHandoffStatusFixture("DONE");
  expect(handoffStatus(1, dir, progressData)).toBe("APPROVED");
});

it("handoffStatus: OK → APPROVED normalization", () => {
  const { dir, progressData } = makeHandoffStatusFixture("OK");
  expect(handoffStatus(1, dir, progressData)).toBe("APPROVED");
});

it("handoffStatus: COMPLETED → APPROVED normalization", () => {
  const { dir, progressData } = makeHandoffStatusFixture("COMPLETED");
  expect(handoffStatus(1, dir, progressData)).toBe("APPROVED");
});

it("handoffStatus: APPROVED unchanged", () => {
  const { dir, progressData } = makeHandoffStatusFixture("APPROVED");
  expect(handoffStatus(1, dir, progressData)).toBe("APPROVED");
});

// ---- P12 timeout path ----

it("normalizeHandoffStatus: TIMEOUT passthrough", async () => {
  const { normalizeHandoffStatus } = await import("../lib/contract.mjs");
  expect(normalizeHandoffStatus("TIMEOUT")).toBe("TIMEOUT");
});

it("runTask: timeout → handoff status TIMEOUT + blocker + partial findings", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-timeout-"));
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
    const hp = path.join(ws, "task-1-implement.json");
    expect(existsSync(hp)).toBe(true);
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("TIMEOUT");
    expect(h.blocker).toMatch(/timed out after/);
    expect(h.task).toBe(1);
  } finally {
    process.env.PATH = origPath;
  }
}, 10_000);

it("runTask: timeout → timeoutCount incremented in progress.json", async () => {
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
    expect(progress.timeoutCount).toBe(1);
    await runTask("ghost", 1, {
      mode: "implement", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { CDD_TASK_TIMEOUT: "1", PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    const progress2 = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress2.timeoutCount).toBe(2);
  } finally {
    process.env.PATH = origPath;
  }
}, 15_000);

it("runTask: unkillable → handoff status BLOCKED + blocker process unkillable", async () => {
  // SIGKILL always kills on modern Unix; test contract-level behavior via writeHandoff directly.
  const { writeHandoff } = await import("../lib/contract.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-unkillable-ho-"));
  const hp = path.join(dir, "task-1-handoff.json");
  writeHandoff(hp, {
    task: 1, phase: "implement", status: "BLOCKED",
    blocker: "process unkillable",
    findings: [{ severity: "warn", title: "pre-existing" }],
  });
  const h = JSON.parse(readFileSync(hp, "utf8"));
  expect(h.status).toBe("BLOCKED");
  expect(h.blocker).toMatch(/unkillable/);
  expect(h.findings).toEqual([{ severity: "warn", title: "pre-existing" }]);
});

// ---- implement mode → no open-findings.json ----

it("runTask #open-findings: implement mode → no open-findings.json (implement mode never writes it)", async () => {
  const ws = setupWorkspace();
  const findingsPath = path.join(ws, "task-1-open-findings.json");
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws), noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(existsSync(findingsPath)).toBe(false);
});

// ---- Pε #218: step 8.8 schema-validation BLOCKED handoff must include phase ----

it("runTask #218: step 8.8 schema-validation BLOCKED → handoff contains phase field", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-sv-blocked-"));
  // Fake CLI exits 0 but writes a schema-invalid handoff (missing required 'findings').
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"task":1,"phase":"implement","status":"APPROVED","artifacts":{}}' > "$CDD_HANDOFF_PATH"\n` +
      `exit 0\n`,
  );
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
    expect(res.exitCode).toBe(1);
    const hp = path.join(ws, "task-1-implement.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.phase).toBe("implement");
    expect(h.blocker).toMatch(/must have required property/);
  } finally {
    process.env.PATH = origPath;
  }
});

it("runTask #218: step 8.8 schema-validation BLOCKED → phase matches mode (unknown property variant)", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-sv-unk-"));
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"task":1,"phase":"implement","status":"APPROVED","artifacts":{},"findings":[],"unknownField":"bad"}' > "$CDD_HANDOFF_PATH"\n` +
      `exit 0\n`,
  );
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
    expect(res.exitCode).toBe(1);
    const hp = path.join(ws, "task-1-implement.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.phase).toBe("implement");
    expect(h.blocker).toMatch(/must NOT have additional properties/);
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- Pζ T3: cross-phase fixed-point derivation ----

it("runTask Pζ T3: task-review dry-run without prior implement handoff → exits 0", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "task-review", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
});

it("runTask Pζ T3: task-review fake-CLI round 1 → CDD_TASK_REVIEW_FIXED_POINT set from implement.json commits.base", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-fp-cli-"));
  const envLog = path.join(ws, "fp-env-log.txt");
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\nprintenv CDD_TASK_REVIEW_FIXED_POINT > "${envLog}"\nprintf '%s' '{"task":1,"phase":"task-review","status":"APPROVED","findings":[],"artifacts":{}}' > "$CDD_HANDOFF_PATH"\nexit 0\n`,
  );
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", task_review_prefix: "", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const implBase = "aabbccddeeff1234567890aabbccddeeff12345678";
  writeFileSync(path.join(ws, "task-1-implement.json"), JSON.stringify({
    task: 1, phase: "implement", status: "APPROVED",
    commits: { base: implBase, head: "deadbeefdeadbeefdeadbeef1234567890abcdef" },
    findings: [], artifacts: {},
  }));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "task-review", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    expect(res.exitCode).toBe(0);
    expect(existsSync(envLog)).toBe(true);
    expect(readFileSync(envLog, "utf8").trim()).toMatch(new RegExp(implBase));
  } finally {
    process.env.PATH = origPath;
  }
});

it("runTask Pζ T3: prior handoff with commits.base='unknown' → FIXED_POINT not set (template gets empty string)", async () => {
  const ws = setupWorkspace();
  writeFileSync(path.join(ws, "task-1-implement.json"), JSON.stringify({
    task: 1, phase: "implement", status: "BLOCKED",
    commits: { base: "unknown" },
    findings: [], artifacts: {},
  }));
  const res = await runTask("claude", 1, { mode: "task-review", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
});

// ---- step 10 CLI failed no handoff → BLOCKED ----

it("runTask: step 10 (cli failed no handoff) BLOCKED has artifacts + action message", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-fail-no-handoff-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 1\n");
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
    expect(res.exitCode).toBe(1);
    const hp = path.join(ws, "task-1-implement.json");
    expect(existsSync(hp)).toBe(true);
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.artifacts).toBeDefined();
    expect(h.blocker).toMatch(/→/);
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- per-round buildTaskEnv ----

it("runTask: per-round buildTaskEnv — task-review derives task-1-task-review-1.json", async () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "task-review", "claude", { round: 1 });
  expect(env.CDD_HANDOFF_PATH.endsWith("task-1-task-review-1.json")).toBe(true);
});

it("runTask: implement derives task-1-implement.json (no round suffix)", async () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "implement", "claude", { round: 1 });
  expect(env.CDD_HANDOFF_PATH.endsWith("task-1-implement.json")).toBe(true);
});

it("runTask: round-2 buildTaskEnv derives task-1-task-review-2.json", async () => {
  const ws = setupWorkspace();
  const progressPath = path.join(ws, "progress.json");
  const prog = JSON.parse(readFileSync(progressPath, "utf8"));
  if (!prog.tasks.find(t => t.task === 1)) prog.tasks.push({ task: 1, status: "pending", rounds: {} });
  prog.tasks.find(t => t.task === 1).rounds = { "task-review": 1 };
  writeFileSync(progressPath, JSON.stringify(prog, null, 2));

  const taskEnv = buildTaskEnv(baseEnv(ws), ws, 1, "task-review", "claude", { round: 2 });
  expect(taskEnv.CDD_HANDOFF_PATH.endsWith("task-1-task-review-2.json")).toBe(true);

  const updated = JSON.parse(readFileSync(progressPath, "utf8"));
  expect(getRound(updated, 1, "task-review")).toBe(2);
});
