// packages/cdd-engine/bin/tests/runner.test.mjs — runner module unit tests (Vitest port).
// runTask dry-run: H1 4-line + no handoff written (aligns bash — bash dry-run branch does not write handoff).
// Also locks: ship gate (unknown/not-supported → blocked exit 1); invalid mode rejected;
// nested CLI failed no handoff → write BLOCKED handoff (stderr into blocker) + exit 1 (aligns bash;
// stderr-surfacing handoff write is the only sanctioned divergence); commit-contract intercepted → stderr CDD_BLOCKED;
// review-package not executable → CDD_BLOCKED.
// invokeCliOverride seam removed (§ P1 Task 5) — CLI simulation now uses real fake-cli shell scripts.
import { it, expect, describe } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, appendFileSync, chmodSync, existsSync, mkdirSync, realpathSync } from "node:fs";
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

// Non-git temp workspace — CDD_WORKSPACE points to TMPDIR, commit-contract fails open.
function setupWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  const progressData = { plan: "/tmp/plan.md", timeoutCount: 0, engineRecoveryCount: 0, tasks: [] };
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify(progressData, null, 2));
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n");
  return ws;
}

// Test env: strip CDD_* vars that may be inherited from an outer session (test process runs under orchestrator env —
// leaked CDD_HANDOFF_PATH etc. would cause runTask to write to real workspaces); keep only test-controlled CDD_WORKSPACE (+extra).
function baseEnv(ws, extra = {}) {
  return { ...filteredEnv(), CDD_WORKSPACE: ws, ...extra };
}

// Cross-repo test env: reuses filteredEnv filtering, but does not inject any workspace.
function cleanEnv(extra = {}) {
  return { ...filteredEnv(), ...extra };
}

// Filter CDD_* and PLAN_FILE from the host env.
function filteredEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_") && k !== "PLAN_FILE") env[k] = v;
  }
  return env;
}

// git init + empty commit.
import { gitCommit, gitInit } from "./helpers.mjs";

// gitInit + realpath normalization (macOS /tmp → /private/tmp).
function gitInitReal(dir) {
  const real = realpathSync(dir);
  gitInit(real);
  return real;
}

// Commit a plan file into an already-initialized repo (add + commit) — keeps working tree clean.
function commitPlan(repoDir, planFile) {
  writeFileSync(planFile, "# Plan\n\n### Task 1: x\nbody\n");
  gitCommit(repoDir);
  return planFile;
}

// Capture process.exit + stdout/stderr from runTask (noExit:false).
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

// ---- dry-run scenarios ----

it("runTask: dry-run implement → H1 4-line APPROVED + no handoff written (aligns bash)", async () => {
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

it("runTask: dry-run outputs H1 4 lines to stdout + exit 0", async () => {
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

it("runTask: dry-run review/fix modes → H1 APPROVED + no handoff written (aligns bash)", async () => {
  for (const mode of ["review", "fix"]) {
    const ws = setupWorkspace();
    const res = await runTask("claude", 1, { mode, dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
    expect(res.exitCode).toBe(0);
    expect(res.h1[0]).toBe("status: APPROVED");
    expect(existsSync(path.join(ws, "task-1-handoff.json"))).toBe(false);
  }
});

// ---- mode validation ----

it("runTask: invalid mode → rejected (non-zero exit)", async () => {
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

it("runTask: nested CLI failed no handoff → BLOCKED handoff (stderr into blocker) + exit 1", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bin-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\necho 'boom from fake cli' >&2\nexit 3\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
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

it("taskNumbersFromPlan: extracts ### Task N: and sorts (including 0)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-plan-"));
  const plan = path.join(dir, "plan.md");
  writeFileSync(plan, "# P\n### Task 3: a\n### Task 1: b\n### Task 0: skip\n### Task 2: c\n");
  expect(taskNumbersFromPlan(plan)).toEqual([0, 1, 2, 3]);
});

it("isTaskPending / handoffStatus: rounds[review] round 0 → MISSING / pending; APPROVED/DONE → not pending", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-pending-"));

  const noReviewProgress = { tasks: [] };
  expect(handoffStatus(1, dir, noReviewProgress)).toBe("MISSING");
  expect(isTaskPending(1, dir, noReviewProgress)).toBe(true);

  const progressR1 = { tasks: [{ task: 1, rounds: { review: 1 } }] };
  writeFileSync(path.join(dir, "task-1-review-1.json"), JSON.stringify({ status: "DONE" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("APPROVED");
  expect(isTaskPending(1, dir, progressR1)).toBe(false);

  writeFileSync(path.join(dir, "task-1-review-1.json"), JSON.stringify({ status: "APPROVED" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("APPROVED");
  expect(isTaskPending(1, dir, progressR1)).toBe(false);

  writeFileSync(path.join(dir, "task-1-review-1.json"), JSON.stringify({ status: "BLOCKED" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("BLOCKED");
  expect(isTaskPending(1, dir, progressR1)).toBe(true);
});

// ---- findSuperpowersScriptsDir (semver upgrade — byVersion removed) ----

it("findSuperpowersScriptsDir: repo submodule takes priority", () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-scripts-repo-")));
  execFileSync("git", ["init", "-q", dir]);
  const scripts = path.join(dir, "vendors", "superpowers", "skills", "subagent-driven-development", "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, "sdd-workspace"), "");
  expect(findSuperpowersScriptsDir(dir)).toBe(scripts);
});

it("findSuperpowersScriptsDir: cache version order (oldest-first via semver) + Claude before Cursor", () => {
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

it("findSuperpowersScriptsDir: no repo submodule + no cache → null", () => {
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

it("runTask: brief exists + contains TASK_BASE: → pass (dry-run exit 0)", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
});

it("runTask #173: plan path does not exist → 'plan file not found'", async () => {
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...baseEnv(tmpdir()), PLAN_FILE: "/nonexistent/plan.md" },
    noExit: true,
  });
  expect(res.exitCode).toBe(1);
});

// ---- runReviewPackage ----

it("runReviewPackage: passes 4th arg OUTFILE = <workspace>/review-<base7>..<head7>.diff", async () => {
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

// ---- P1 #173 cross-repo regression (plan-derived branch) ----

it("runTask #173: plan in repo A, cwd in repo B → workspace lands in A, B has no .superpowers", async () => {
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

it("runTask #173: no plan no CDD_WORKSPACE → 'cannot resolve repo root'", async () => {
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: cleanEnv(), cwd: mkdtempSync(path.join(tmpdir(), "cdd-bare-")), noExit: true,
  });
  expect(res.exitCode).toBe(1);
});

// Direct-set branch black-box variant: CDD_TASK_BRIEF/CDD_HANDOFF_PATH point outside the repo, brief pre-written with TASK_BASE line.
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

it("runTask #173: CDD_WORKSPACE direct-set (git directory) → exit 0", async () => {
  const wsGit = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-ws-git-")));
  gitInit(wsGit);
  const res = await directWorkspaceCase(wsGit);
  expect(res.exitCode).toBe(0);
});

it("runTask #173: CDD_WORKSPACE direct-set (bare TMPDIR, non-git) → exit 0 (repoRoot tolerance semantics)", async () => {
  const bare = mkdtempSync(path.join(tmpdir(), "cdd-ws-bare-"));
  const res = await directWorkspaceCase(bare);
  expect(res.exitCode).toBe(0);
});

it("resolveRepoRoot #173: CDD_WORKSPACE direct-set → repoRoot=git toplevel; bare TMPDIR → null", () => {
  const wsGit = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-ws-git-")));
  gitInit(wsGit);
  expect(resolveRepoRoot({ env: { CDD_WORKSPACE: wsGit } }).repoRoot).toBe(wsGit);
  const bare = mkdtempSync(path.join(tmpdir(), "cdd-ws-bare-"));
  expect(resolveRepoRoot({ env: { CDD_WORKSPACE: bare } }).repoRoot).toBeNull();
});

it("runTask #173: CDD_WORKSPACE + plan both given → workspace lands at plan-derived path, env ignored", async () => {
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

it("buildTaskEnv: fix mode → CDD_FINDINGS = review handoff path (no scope filter)", () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "fix", "claude", { round: 1 });
  expect(env.CDD_FINDINGS).toMatch(/task-1-review-1\.json$/);
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

it("runTask #187→Pζ: review CLI 成功 + 无 handoff → BLOCKED（10.5 仍守卫 review/fix；implement 由 T6 实体化接管）", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-ok-cli-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "review", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const handoff = JSON.parse(readFileSync(path.join(ws, "task-1-review-1.json"), "utf8"));
    expect(handoff.status).toBe("BLOCKED");
    expect(handoff.phase).toBe("review");
    expect(handoff.blocker).toMatch(/not written after exit 0/);
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- handoffStatus DONE/OK/COMPLETED normalization ----

function makeHandoffStatusFixture(status) {
  const dir = mkdtempSync(path.join(tmpdir(), "runner-hs-"));
  const progressData = { tasks: [{ task: 1, rounds: { review: 1 } }] };
  writeFileSync(path.join(dir, "task-1-review-1.json"), JSON.stringify({ status }));
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
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexec sleep 5\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
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
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexec sleep 5\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
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
// T7: 8.8 对 implement 门控（not 输入通道）—— 本用例迁移到 review（review/fix 保留读取校验内容契约）。

it("runTask #218 (T7→review): step 8.8 schema-validation BLOCKED → handoff contains phase field", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-sv-blocked-"));
  // Fake CLI exits 0 but writes a schema-invalid handoff (missing required 'findings').
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"task":1,"phase":"review","status":"APPROVED","artifacts":{}}' > "$CDD_HANDOFF_PATH"\n` +
      `exit 0\n`,
  );
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "review", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const hp = path.join(ws, "task-1-review-1.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.phase).toBe("review");
    expect(h.blocker).toMatch(/must have required property/);
  } finally {
    process.env.PATH = origPath;
  }
});

it("runTask #218 (T7→review): step 8.8 schema-validation BLOCKED → phase matches mode (unknown property variant)", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-sv-unk-"));
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"task":1,"phase":"review","status":"APPROVED","artifacts":{},"findings":[],"unknownField":"bad"}' > "$CDD_HANDOFF_PATH"\n` +
      `exit 0\n`,
  );
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "review", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const hp = path.join(ws, "task-1-review-1.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.phase).toBe("review");
    expect(h.blocker).toMatch(/must NOT have additional properties/);
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- Pζ T3: cross-phase fixed-point derivation ----

it("runTask Pζ T3: review dry-run without prior implement handoff → exits 0", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "review", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
});

it("runTask Pζ T3: review fake-CLI round 1 → CDD_TASK_REVIEW_FIXED_POINT set from implement.json commits.base", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-fp-cli-"));
  const envLog = path.join(ws, "fp-env-log.txt");
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\nprintenv CDD_TASK_REVIEW_FIXED_POINT > "${envLog}"\nprintf '%s' '{"task":1,"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "$CDD_HANDOFF_PATH"\nexit 0\n`,
  );
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
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
      mode: "review", probeSkills: NOOP_PROBE,
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
  const res = await runTask("claude", 1, { mode: "review", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
});

it("runTask Pζ T3: review round 2 → FIXED_POINT from task-N-fix-1.json (cross-phase fix round), not implement.json", async () => {
  const ws = setupWorkspace();
  // Set progress so review dispatches round 2 (last completed fix round = 1).
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify({
    plan: "/tmp/plan.md", timeoutCount: 0, engineRecoveryCount: 0,
    tasks: [{ task: 1, status: "in-progress", rounds: { implement: 1, review: 1, fix: 1 } }],
  }, null, 2));

  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-fp-cli-r2-"));
  const envLog = path.join(ws, "fp-env-log-r2.txt");
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\nprintenv CDD_TASK_REVIEW_FIXED_POINT > "${envLog}"\nprintf '%s' '{"task":1,"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "$CDD_HANDOFF_PATH"\nexit 0\n`,
  );
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  // Round-1 fix handoff exists; round-2 review must NOT read implement.json's base.
  const fixBase = "5588aabbccddeeff1234567890aabbccddeeff1234";
  writeFileSync(path.join(ws, "task-1-implement.json"), JSON.stringify({
    task: 1, phase: "implement", status: "APPROVED",
    commits: { base: "implement-base-should-not-win-00000000000000", head: "deadbeefdeadbeefdeadbeef1234567890abcdef" },
    findings: [], artifacts: {},
  }));
  writeFileSync(path.join(ws, "task-1-fix-1.json"), JSON.stringify({
    task: 1, phase: "fix", status: "APPROVED",
    commits: { base: fixBase, head: "deadbeefdeadbeefdeadbeef1234567890abcdef" },
    findings: [], artifacts: {},
  }));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "review", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    expect(res.exitCode).toBe(0);
    expect(existsSync(envLog)).toBe(true);
    // FIXED_POINT comes from task-1-fix-1.json round, NOT implement.json
    expect(readFileSync(envLog, "utf8").trim()).toMatch(new RegExp(fixBase));
    expect(readFileSync(envLog, "utf8")).not.toContain("implement-base-should-not-win");
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- Task 5: mode → (op, type) 注入映射（runner invokeCliWithRetry 调用点） ----

it("runTask Task 5: review → invokeCli (op=review,type=task) → code-review prefix 注入 prompt 首行", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-inj-cli-"));
  const promptLog = path.join(ws, "prompt-log.txt");
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\nprintf '%s' "\${@: -1}" > "${promptLog}"\nprintf '%s' '{"task":1,"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "$CDD_HANDOFF_PATH"\nexit 0\n`,
  );
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = {
    cli: "fake-cli", invoke: "-p", output: "text", ship: "full",
    prefix: {
      implement: "/mattpocock-skills:tdd",
      review: { task: "/mattpocock-skills:code-review", branch: "/mattpocock-skills:code-review", spec: "", plan: "" },
      fix: "/mattpocock-skills:tdd",
    },
    suffix: {},
  };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "review", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    expect(res.exitCode).toBe(0);
    const logged = readFileSync(promptLog, "utf8");
    expect(logged.split("\n")[0]).toBe("/mattpocock-skills:code-review");
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- T5: status 单一权威 — review 读回覆写（agent 写 CHANGES_REQUESTED warn-only → 覆写 APPROVED） ----

it("runner review 读回覆写：task-N-review-1.json agent 写 CHANGES_REQUESTED warn-only → 覆写 APPROVED", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-review-derive-"));
  writeFileSync(
    path.join(binDir, "fake-cli"),
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"task":1,"phase":"review","status":"CHANGES_REQUESTED","findings":[{"severity":"warn","summary":"w"},{"severity":"nit","summary":"n"}],"artifacts":{}}' > "$CDD_HANDOFF_PATH"\n` +
      `exit 0\n`,
  );
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "review", probeSkills: NOOP_PROBE,
      env: baseEnv(ws, { PATH: `${binDir}${path.delimiter}${origPath}` }),
      registryPath: regPath, noExit: true,
    });
    expect(res.exitCode).toBe(0);
    const hp = path.join(ws, "task-1-review-1.json");
    expect(existsSync(hp)).toBe(true);
    const h = JSON.parse(readFileSync(hp, "utf8"));
    // warn/nit = 0 blocker → status 被引擎派生覆写为 APPROVED（findings 保留）
    expect(h.status).toBe("APPROVED");
    expect(h.findings).toEqual([
      { severity: "warn", summary: "w" }, { severity: "nit", summary: "n" },
    ]);
    // H1 同步从 handoff 重发（h1FromHandoff）— 状态一致，不携带 agent 的 CHANGES_REQUESTED
    expect(res.h1[0]).toBe("status: APPROVED");
    // T5 nit：review 成功 round 缺省 blocker → none（非 commit-contract 缺省文案）
    // blocker 是 h1 最后一行（artifacts 存在时为 h1[3]，absent 时为 h1[2]）
    expect(res.h1.at(-1)).toMatch(/^blocker: none$/);
  } finally {
    process.env.PATH = origPath;
  }
});

// ---- step 10 CLI failed no handoff → BLOCKED ----

it("runTask: step 10 (cli failed no handoff) BLOCKED has artifacts + action message", async () => {
  const ws = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-fail-no-handoff-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 1\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
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

it("runTask: per-round buildTaskEnv — review derives task-1-review-1.json", async () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "review", "claude", { round: 1 });
  expect(env.CDD_HANDOFF_PATH.endsWith("task-1-review-1.json")).toBe(true);
  expect(env.CDD_HANDOFF_PATH.includes("task-review")).toBe(false); // 旧 task-review 命名零产出
});

it("runTask: implement derives task-1-implement.json (no round suffix)", async () => {
  const ws = setupWorkspace();
  const env = buildTaskEnv(baseEnv(ws), ws, 1, "implement", "claude", { round: 1 });
  expect(env.CDD_HANDOFF_PATH.endsWith("task-1-implement.json")).toBe(true);
});

it("runTask: round-2 buildTaskEnv derives task-1-review-2.json", async () => {
  const ws = setupWorkspace();
  const progressPath = path.join(ws, "progress.json");
  const prog = JSON.parse(readFileSync(progressPath, "utf8"));
  if (!prog.tasks.find(t => t.task === 1)) prog.tasks.push({ task: 1, status: "pending", rounds: {} });
  prog.tasks.find(t => t.task === 1).rounds = { review: 1 };
  writeFileSync(progressPath, JSON.stringify(prog, null, 2));

  const taskEnv = buildTaskEnv(baseEnv(ws), ws, 1, "review", "claude", { round: 2 });
  expect(taskEnv.CDD_HANDOFF_PATH.endsWith("task-1-review-2.json")).toBe(true);

  const updated = JSON.parse(readFileSync(progressPath, "utf8"));
  expect(getRound(updated, 1, "review")).toBe(2);
});

// ---- T4: mode 归一（task-review → review）----

it("runTask: mode task-review（旧名）→ rejected：CDD_MODE must be implement|review|fix", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "task-review", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(1);
  expect(res.h1).toEqual([]);
});

it("runTask: mode review dry-run → H1 APPROVED + no handoff written", async () => {
  const ws = setupWorkspace();
  const res = await runTask("claude", 1, { mode: "review", dryRun: true, probeSkills: NOOP_PROBE, env: baseEnv(ws), noExit: true });
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
  expect(existsSync(path.join(ws, "task-1-review-1.json"))).toBe(false);
});

it("schema: phase 'review' task-review handoff 通过 Ajv 校验（phase enum 已归一）", async () => {
  const { validateHandoffSchema } = await import("../lib/schema-utils.mjs");
  expect(validateHandoffSchema({
    task: 1, phase: "review", status: "APPROVED",
    commits: { base: "a".repeat(40), head: "b".repeat(40) },
    findings: [], artifacts: {},
  })).toEqual({ valid: true });
  // 旧 task-review phase 不再合法（未归一会被 runner 8.8 Ajv 判 invalid 覆写 BLOCKED）
  expect(validateHandoffSchema({ task: 1, phase: "task-review", status: "APPROVED", findings: [], artifacts: {} }).valid).toBe(false);
});

// ---- T6: implement handoff 实体化 + evidence-gate + H1 h1FromHandoff（commits 单一权威）----

// T6 fixture：git repo workspace + 40-hex TASK_BASE brief（commits.base 唯一权威）。返回 registry/HEAD 现场。
// workspace 收编 .superpowers/cdd/plan（对齐生产：.superpowers/cdd/.gitignore `*` gitignore 整棵 ws 树）
// —— T7 post-run commit-contract 的 dirty 校验要求 tracked tree 干净，ws 未提交产物不得误触发 BLOCKED。
function t6Workspace(extraFiles = {}) {
  const repo = gitInitReal(mkdtempSync(path.join(tmpdir(), "cdd-t6-ws-")));
  const cddDir = path.join(repo, ".superpowers", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(path.join(cddDir, ".gitignore"), "*\n");
  const ws = path.join(cddDir, "plan");
  mkdirSync(ws, { recursive: true });
  const taskBase = "9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63";
  writeFileSync(path.join(ws, "task-1-brief.md"), `# task 1\nTASK_BASE: ${taskBase}\n`);
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify({
    plan: "/tmp/plan.md", timeoutCount: 0, engineRecoveryCount: 0, tasks: [],
  }, null, 2));
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  for (const [f, v] of Object.entries(extraFiles)) writeFileSync(path.join(ws, f), v);
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t6-bin-"));
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));
  const actualHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ws, encoding: "utf8" }).trim();
  return { ws, taskBase, actualHead, binDir, regPath };
}

// T6 ghost 运行封装：写 fake-cli（body）→ 注入 PATH 运行 runTask（implement/non-dry）→ 还原 PATH。
async function runT6Ghost(t6, body) {
  const cli = path.join(t6.binDir, "fake-cli");
  writeFileSync(cli, body);
  chmodSync(cli, 0o755);
  const origPath = process.env.PATH;
  process.env.PATH = `${t6.binDir}${path.delimiter}${origPath}`;
  try {
    return await runTask("ghost", 1, {
      mode: "implement", probeSkills: NOOP_PROBE,
      env: baseEnv(t6.ws, { PATH: `${t6.binDir}${path.delimiter}${origPath}` }),
      registryPath: t6.regPath, noExit: true,
    });
  } finally {
    process.env.PATH = origPath;
  }
}

it("runTask T6: implement 成功路径 — runner 实体化 task-1-implement.json（H1 stdout → 文件；commits 单一权威）", async () => {
  const t6 = t6Workspace();
  const report = path.join(t6.ws, "task-1-report.md");
  const tev = path.join(t6.ws, "task-1-test-evidence.json");
  writeFileSync(report, "report body\n");
  // evidence 齐 command/passed/exit_code（behavior_change 非 true 或齐全是 soft）→ 不拦
  writeFileSync(tev, JSON.stringify({ command: "npx vitest run", exit_code: 0, passed: true, warnings_count: 0 }));
  const res = await runT6Ghost(t6, [
    "#!/usr/bin/env bash",
    "printf '%s\\n' 'status: APPROVED'",
    "printf '%s\\n' 'commits: base=agent-wrong-base head=agent-wrong-head'",
    `printf '%s\\n' 'artifacts: report=${report} test_evidence=${tev}'`,
    "printf '%s\\n' 'blocker: none'",
    "exit 0",
  ].join("\n"));
  expect(res.exitCode).toBe(0);
  const hp = path.join(t6.ws, "task-1-implement.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  expect(h.task).toBe(1);
  expect(h.phase).toBe("implement");
  expect(h.status).toBe("APPROVED");
  expect(h.commits.base).toBe(t6.taskBase);      // brief TASK_BASE 权威（agent 行被忽略）
  expect(h.commits.head).toBe(t6.actualHead);    // git HEAD 权威
  expect(h.findings).toEqual([]);
  expect(h.artifacts.report).toBe(report);
  expect(h.blocker).toBeUndefined();             // blocker: none → 省略（h1FromHandoff 按 APPROVED 缺省 none）
  // H1 由实体化 handoff 重发（h1FromHandoff）
  expect(res.h1[0]).toBe("status: APPROVED");
  expect(res.h1[1]).toBe(`commits: base=${t6.taskBase} head=${t6.actualHead}`);
});

it("runTask T6: implement 不写 handoff 也不触发 10.5 BLOCKED（runner 实体化兜底）", async () => {
  // fake-cli 只回 H1 四行、不写任何文件（连 test-evidence 都没有 → evidence-gate soft WARN）→ 仍 exit 0 + 实体化。
  const t6 = t6Workspace();
  const res = await runT6Ghost(t6, [
    "#!/usr/bin/env bash",
    "printf '%s\\n' 'status: APPROVED'",
    "printf '%s\\n' 'commits: base=x head=y'",
    `printf '%s\\n' 'artifacts: report=${path.join(t6.ws, "task-1-report.md")}'`,
    "printf '%s\\n' 'blocker: none'",
    "exit 0",
  ].join("\n"));
  expect(res.exitCode).toBe(0);
  const hp = path.join(t6.ws, "task-1-implement.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  // 10.5 未触发：status 为 APPROVED（若命中 10.5 会被覆写 BLOCKED + exit 1）
  expect(h.status).toBe("APPROVED");
  expect(h.phase).toBe("implement");
  expect(h.commits.base).toBe(t6.taskBase);
});

it("runTask T6: evidence-gate — behavior_change:true 缺 command/passed/exit_code → handoff 覆写 BLOCKED + exit 1", async () => {
  const t6 = t6Workspace();
  const res = await runT6Ghost(t6, [
    "#!/usr/bin/env bash",
    // 模拟 agent 写了 test-evidence：behavior_change:true 但缺必需三键
    `printf '%s' '{"behavior_change":true,"warnings_count":0}' > "$CDD_WORKSPACE/task-1-test-evidence.json"`,
    "printf '%s\\n' 'status: APPROVED'",
    "printf '%s\\n' 'commits: base=x head=y'",
    `printf '%s\\n' 'artifacts: report=${path.join(t6.ws, "task-1-report.md")}'`,
    "printf '%s\\n' 'blocker: none'",
    "exit 0",
  ].join("\n"));
  expect(res.exitCode).toBe(1);
  const hp = path.join(t6.ws, "task-1-implement.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  expect(h.status).toBe("BLOCKED");
  expect(h.blocker).toMatch(/test_evidence gate: hard/);
  expect(h.blocker).toContain("command");
  // H1 同步为 BLOCKED（h1FromHandoff 与覆写后 handoff 一致）
  expect(res.h1[0]).toBe("status: BLOCKED");
});

it("runTask T6: H1 输出改用 h1FromHandoff — agent stdout 的 commits/缺省 blocker 由实体化 handoff 重发覆写", async () => {
  const t6 = t6Workspace();
  // agent 谎报 commits + 无 blocker 行 → 最终 H1 必须来自实体化 handoff（brief TASK_BASE + git HEAD + blocker: none）
  const res = await runT6Ghost(t6, [
    "#!/usr/bin/env bash",
    "printf '%s\\n' 'status: APPROVED'",
    "printf '%s\\n' 'commits: base=fakefakefakefakefakefakefakefakefakefake head=fakefakefakefakefakefakefakefakefakefake'",
    `printf '%s\\n' 'artifacts: report=${path.join(t6.ws, "task-1-report.md")}'`,
    "exit 0",
  ].join("\n"));
  expect(res.exitCode).toBe(0);
  expect(res.h1.length).toBe(4);
  expect(res.h1[0]).toBe("status: APPROVED");
  expect(res.h1[1]).toBe(`commits: base=${t6.taskBase} head=${t6.actualHead}`);
  expect(res.h1[3]).toBe("blocker: none");
  const h = JSON.parse(readFileSync(path.join(t6.ws, "task-1-implement.json"), "utf8"));
  expect(h.commits.base).toBe(t6.taskBase);
  expect(h.blocker).toBeUndefined();
});

// ---- T7: implement 8.8 门控 — HANDOFF 非 implement 输入通道（#232 残留路径从结构上消灭）----

it("runTask T7: implement 8.8 不读 existing handoff → schema-invalid 残留被实体化 writeOwnHandoff 全量覆盖 APPROVED", async () => {
  // 旧 P1 假设：agent 手写残缺 handoff（缺 findings）→ 8.8 无差别校验 → 误拦 BLOCKED（#232）。
  // T7：engine 是载体唯一作者，implement 的 HANDOFF 路径对 agent 不是输入通道，8.8 门控跳过；
  // step 13 finalizeHandoff 实体化 + writeOwnHandoff 全量覆盖 → APPROVED（残留进不了载体）。
  const t6 = t6Workspace();
  const res = await runT6Ghost(t6, [
    "#!/usr/bin/env bash",
    // 模拟旧 P1 agent 残留：schema-invalid（缺 findings）existing handoff
    `printf '%s' '{"task":1,"phase":"implement","status":"APPROVED","artifacts":{}}' > "$CDD_HANDOFF_PATH"`,
    "printf '%s\\n' 'status: APPROVED'",
    "printf '%s\\n' 'commits: base=x head=y'",
    `printf '%s\\n' 'artifacts: report=${path.join(t6.ws, "task-1-report.md")}'`,
    "printf '%s\\n' 'blocker: none'",
    "exit 0",
  ].join("\n"));
  expect(res.exitCode).toBe(0);
  const hp = path.join(t6.ws, "task-1-implement.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  // 未被 8.8 判 invalid 覆写 BLOCKED：最终载体是实体化结果（commits.base = brief TASK_BASE 权威）
  expect(h.status).toBe("APPROVED");
  expect(h.phase).toBe("implement");
  expect(h.commits.base).toBe(t6.taskBase);
  expect(h.findings).toEqual([]);
  expect(res.h1[0]).toBe("status: APPROVED");
});

// ---- T7: post-run validateCommitContract（全 mode 接线）+ task.status=complete 回写 ----

// T7 fixture：git repo（tracked source + ws 收编 .superpowers/cdd/plan）。
// dirty=true → tracked.txt 追加（porcelain ` M`）→ post-run commit-contract 必 BLOCKED。
// 返回 { repo, ws, actualHead, binDir, regPath }。
function t7Workspace({ dirty = false } = {}) {
  const repo = gitInitReal(mkdtempSync(path.join(tmpdir(), "cdd-t7-ws-")));
  writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
  gitCommit(repo);
  const cddDir = path.join(repo, ".superpowers", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(path.join(cddDir, ".gitignore"), "*\n");
  const ws = path.join(cddDir, "plan");
  mkdirSync(ws, { recursive: true });
  writeFileSync(path.join(ws, "progress.json"), JSON.stringify({
    plan: "plan.md", timeoutCount: 0, engineRecoveryCount: 0, tasks: [],
  }, null, 2));
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\nTASK_BASE: 9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63\n");
  if (dirty) appendFileSync(path.join(repo, "tracked.txt"), "dirty\n");
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t7-bin-"));
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));
  const actualHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ws, encoding: "utf8" }).trim();
  return { repo, ws, actualHead, binDir, regPath };
}

// T7 review ghost 运行封装：fake-cli 写 APPROVED review handoff → 运行 runTask review（non-dry）→ 还原 PATH。
async function runT7ReviewGhost(t7, body) {
  const cli = path.join(t7.binDir, "fake-cli");
  writeFileSync(cli, body);
  chmodSync(cli, 0o755);
  const origPath = process.env.PATH;
  process.env.PATH = `${t7.binDir}${path.delimiter}${origPath}`;
  try {
    return await runTask("ghost", 1, {
      mode: "review", probeSkills: NOOP_PROBE,
      env: baseEnv(t7.ws, { PATH: `${t7.binDir}${path.delimiter}${origPath}` }),
      registryPath: t7.regPath, noExit: true,
    });
  } finally {
    process.env.PATH = origPath;
  }
}

it("runTask T7: task-review APPROVED → progress task.status=complete（rounds[review]=1）", async () => {
  const t7 = t7Workspace();
  const res = await runT7ReviewGhost(t7, [
    "#!/usr/bin/env bash",
    `printf '%s' '{"task":1,"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "$CDD_HANDOFF_PATH"`,
    "exit 0",
  ].join("\n"));
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
  const progress = JSON.parse(readFileSync(path.join(t7.ws, "progress.json"), "utf8"));
  expect(progress.tasks[0].status).toBe("complete");
  expect(progress.tasks[0].rounds["review"]).toBe(1);
  // handoff 保持 APPROVED（clean tree 通过 post-run validate；review 跳过 head 校验）
  const h = JSON.parse(readFileSync(path.join(t7.ws, "task-1-review-1.json"), "utf8"));
  expect(h.status).toBe("APPROVED");
});

it("runTask T7: post-run validateCommitContract — dirty tree → handoff BLOCKED（task-review 亦校验）+ exit 1", async () => {
  const t7 = t7Workspace({ dirty: true });
  const res = await runT7ReviewGhost(t7, [
    "#!/usr/bin/env bash",
    `printf '%s' '{"task":1,"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "$CDD_HANDOFF_PATH"`,
    "exit 0",
  ].join("\n"));
  expect(res.exitCode).toBe(1);
  expect(res.h1[0]).toBe("status: BLOCKED");
  const hp = path.join(t7.ws, "task-1-review-1.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  expect(h.status).toBe("BLOCKED");
  expect(h.blocker).toMatch(/uncommitted changes at return/);
  // 失败轮不误标 complete（APPROVED 判定在 post-run validate 之后）
  const progress = JSON.parse(readFileSync(path.join(t7.ws, "progress.json"), "utf8"));
  expect(progress.tasks[0]?.status).not.toBe("complete");
});

it("runTask T7: post-run validateCommitContract — implement dirty tree → 实体化 handoff 覆写 BLOCKED + exit 1", async () => {
  const t7 = t7Workspace({ dirty: true });
  const cli = path.join(t7.binDir, "fake-cli");
  writeFileSync(cli, [
    "#!/usr/bin/env bash",
    "printf '%s\\n' 'status: APPROVED'",
    "printf '%s\\n' 'commits: base=x head=y'",
    `printf '%s\\n' 'artifacts: report=${path.join(t7.ws, "task-1-report.md")}'`,
    "exit 0",
  ].join("\n"));
  chmodSync(cli, 0o755);
  const origPath = process.env.PATH;
  process.env.PATH = `${t7.binDir}${path.delimiter}${origPath}`;
  try {
    const res = await runTask("ghost", 1, {
      mode: "implement", probeSkills: NOOP_PROBE,
      env: baseEnv(t7.ws, { PATH: `${t7.binDir}${path.delimiter}${origPath}` }),
      registryPath: t7.regPath, noExit: true,
    });
    expect(res.exitCode).toBe(1);
    expect(res.h1[0]).toBe("status: BLOCKED");
    const hp = path.join(t7.ws, "task-1-implement.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.blocker).toMatch(/uncommitted changes at return/);
  } finally {
    process.env.PATH = origPath;
  }
});
