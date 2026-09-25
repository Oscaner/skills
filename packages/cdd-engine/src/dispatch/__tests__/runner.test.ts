// packages/cdd-engine/src/dispatch/__tests__/runner.test.ts
// runTask dry-run: return block 5-line + no handoff written (aligns bash — bash dry-run branch does not write handoff).
// Also locks: ship gate (unknown/not-supported → blocked exit 1); invalid mode rejected;
// nested CLI failed no handoff → write BLOCKED handoff (stderr into blocker) + exit 1 (aligns bash;
// stderr-surfacing handoff write is the only sanctioned divergence); commit-contract intercepted → stderr CDD_BLOCKED.
// review-package / findSuperpowersScriptsDir 已随 branch-review warn 3 删除（生产零调用死码）。
// invokeCliOverride seam removed (§ P1 Task 5) — CLI simulation now uses real fake-cli shell scripts.
// P4 §2.3.1 根注入契约：runTask 的 root 一律经 `opts.root` 显式注入（真 mkdtemp 仓根）；workspace 纯由
// `--plan` 派生 —— 无 env 缝、无 initRoot()、无 chdir、无 ForTest 后门。同一文件内多仓只靠 opts.root 切换。

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { materializeWorkspace } from "../../artifacts/handoff/naming.ts";
import { TaskGroup } from "../../domain/task-group.ts";
import { ExitRequested } from "../../infra/exit.ts";
import { markAllDispatchesDone, spawnManaged } from "../../infra/proc.ts";
import { REG_PATH } from "../../infra/registry.ts";
// The runner-level writeback contract is verified against the derivation —
// deriveTaskState is the single TaskState source (progress rows carry no status) (Task 30 ②/④).
import { StatusJudge } from "../../rules/status.ts";

const statusJudge = new StatusJudge();

import { DocumentsValidator } from "../../rules/documents.ts";
import { buildPromptParams, handoffStatus, isTaskPending, TaskLifecycle } from "../task.ts";

const documentsValidator = new DocumentsValidator();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const _REPO_ROOT = path.resolve(HERE, "../../../../..");

// git init + empty commit.
import {
  commitValidDocs,
  gitCommit,
  gitInit,
  pgrepCount,
  processGroupReapingSupported,
} from "../../infra/__tests__/helpers.ts";

const GROUP_SUPPORTED = processGroupReapingSupported(); // spec §2.6 skip 保护（CI 容器组语义不可靠）

// gitInit + realpath normalization (macOS /tmp → /private/tmp).
function gitInitReal(dir) {
  const real = realpathSync(dir);
  gitInit(real);
  return real;
}

// ---- real-repo fixture (root injection) ----

// 仓根相对的 plan 路径（`--plan` 参数形态；engine 经 resolveDocArg 归一到 root 坐标系）。
const PLAN_REL = path.join("docs", "osuperpowers", "plans", "plan.md");

// 真仓 fixture：gitInit + 仓根内 plan（已 commit，工作树干净 —— commit-contract 前提）+ 预置 workspace
// 元数据（progress.json / plan-constraints.md）。workspace 派生 = <repo>/.osuperpowers/cdd/plan
//（slug 取 plan.md 去扩展名）；`.osuperpowers/cdd/.gitignore` 的 `*` 让 ws 产物不进 tracked 树。
function setupWorkspace() {
  const repo = gitInitReal(mkdtempSync(path.join(tmpdir(), "cdd-task-runner-")));
  // doc-contract-valid chain: plan + its spec + parent overall (the dispatch gate requires it)
  commitValidDocs(repo);
  const cddDir = path.join(repo, ".osuperpowers", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(path.join(cddDir, ".gitignore"), "*\n");
  const ws = path.join(cddDir, "plan");
  mkdirSync(ws, { recursive: true });
  writeFileSync(
    path.join(ws, "progress.json"),
    JSON.stringify({ plan: PLAN_REL, timeoutCount: 0, engineRecoveryCount: 0, tasks: [] }, null, 2),
  );
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  return { repo, planFile: PLAN_REL, ws };
}

// Commit a doc-contract-valid plan into an already-initialized repo (add + commit) — keeps working
// tree clean.
function commitPlan(repoDir, planFile) {
  commitValidDocs(repoDir, path.relative(repoDir, planFile));
  return planFile;
}

// fake-cli（registry cli 名遮蔽）：写脚本 + 注入 PATH，返回还原函数。
function withFakeCli(binDir, name, body) {
  writeFileSync(path.join(binDir, name), body);
  chmodSync(path.join(binDir, name), 0o755);
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  return () => {
    process.env.PATH = origPath;
  };
}

// ghost registry：真实 harness-registry.json + 追加 fake-cli 条目。
function ghostRegistry(ws, { prefix, suffix } = {}) {
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = {
    cli: "fake-cli",
    invoke: "-p",
    output: "text",
    ship: "full",
    ...(prefix ? { prefix } : {}),
    ...(suffix ? { suffix } : {}),
  };
  writeFileSync(regPath, JSON.stringify(reg));
  return regPath;
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
      if (e instanceof ExitRequested) {
        code = e.code;
      } // exit helpers 现 throw 哨兵（Task 3 review warn 修复）
      else if (!/process\.exit/.test(e.message)) throw e;
    }
  } finally {
    process.exit = origExit;
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return { code, stdout, stderr };
}

// ---- dry-run scenarios ----

it("runTask: dry-run implement → return block 5-line APPROVED + no handoff written (aligns bash)", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock.length).toBe(5);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  expect(res.returnBlock[1]).toBe("commits: base=dry-run");
  expect(res.returnBlock[2]).toMatch(/^artifacts: brief=/);
  expect(res.returnBlock[3]).toBe("blocker: none");
  expect(res.returnBlock[4]).toMatch(
    /^counters: timeout=\d+ contract-violation=\d+ engine-self-written=\d+ recovery=\d+$/,
  );
  expect(existsSync(path.join(ws, "tasks-1-implement.json"))).toBe(false);
});

it("runTask: dry-run outputs return block 5 lines to stdout + exit 0", async () => {
  const { repo, planFile } = setupWorkspace();
  const { code, stdout } = await capture(() =>
    TaskLifecycle.run("claude", 1, { mode: "implement", dryRun: true, planFile, root: repo }),
  );
  expect(code).toBe(0);
  const lines = stdout.trim().split("\n");
  expect(lines.length).toBe(5);
  // 可区分形态：五行各自是一键行（防退化回恒真行数断言）
  expect(lines.filter((l) => /^(status|commits|artifacts|blocker|counters):/.test(l)).length).toBe(
    5,
  );
  expect(lines[0]).toBe("status: APPROVED");
  expect(lines[3]).toBe("blocker: none");
  expect(lines[4]).toMatch(
    /^counters: timeout=\d+ contract-violation=\d+ engine-self-written=\d+ recovery=\d+$/,
  );
});

it.skipIf(!GROUP_SUPPORTED)(
  "runTask: 正常 exit（noExit=false）→ finally teardownAll 先于 ExitRequested 传播（residual group reaped）",
  async () => {
    // Regression guard for the Task 3 review warn: process.exit does not unwind try/finally, so after
    // exit helpers switched to throwing, the run-boundary finally (teardownAll) must reap the dispatch
    // residual group by the root first before the sentinel propagates outward (Task 3).
    const { repo, planFile } = setupWorkspace();
    // 模拟 dispatch 留下的 session server：leader 触发孙进程 P1EXIT 后退出，孙进程驻留（组 pgid 存活语义）。
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1EXIT']).unref();process.exit(0)`;
    await spawnManaged("node", ["-e", script], { timeoutMs: 5000 });
    const p1exitAlive = () => pgrepCount("P1EXIT"); // 括号技巧消 pgrep 自匹配（helpers.ts）
    expect(p1exitAlive()).toBeGreaterThan(0);
    let code = null;
    try {
      await TaskLifecycle.run("claude", 1, {
        mode: "implement",
        dryRun: true,
        planFile,
        root: repo,
      }); // noExit=false
    } catch (e) {
      if (e instanceof ExitRequested) code = e.code;
      else throw e;
    }
    expect(code).toBe(0); // 出口码语义保留（0=OK）
    expect(p1exitAlive()).toBe(0); // 驻留组已随 finally teardownAll 连根回收
  },
);

it("runTask: dry-run review/fix modes → return block APPROVED + no handoff written (aligns bash)", async () => {
  for (const mode of ["review", "fix"]) {
    const { repo, planFile, ws } = setupWorkspace();
    const res = await TaskLifecycle.run("claude", 1, {
      mode,
      dryRun: true,
      planFile,
      root: repo,
      noExit: true,
    });
    expect(res.exitCode).toBe(0);
    expect(res.returnBlock[0]).toBe("status: APPROVED");
    expect(existsSync(path.join(ws, "tasks-1-implement.json"))).toBe(false);
  }
});

// ---- mode validation ----

it("runTask: invalid mode → rejected (non-zero exit)", async () => {
  const { repo, planFile } = setupWorkspace();
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "handoff",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(1);
});

// ---- ship gate ----

it("runTask: unknown harness → blocked exit 1", async () => {
  const { repo, planFile } = setupWorkspace();
  const res = await TaskLifecycle.run("no-such-harness", 1, {
    mode: "implement",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(1);
});

it("runTask: 两键 registry 下 codex（原 not-supported 键）→ unknown harness blocked exit 1", async () => {
  const { repo, planFile } = setupWorkspace();
  const res = await TaskLifecycle.run("codex", 1, {
    mode: "implement",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(1);
});

// ---- CLI failure + BLOCKED handoff ----

it("runTask: nested CLI failed no handoff → BLOCKED handoff (stderr into blocker) + exit 1", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bin-"));
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    "#!/usr/bin/env bash\necho 'boom from fake cli' >&2\nexit 3\n",
  );
  const regPath = ghostRegistry(ws);
  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const handoff = JSON.parse(readFileSync(path.join(ws, "tasks-1-implement.json"), "utf8"));
    expect(handoff.status).toBe("BLOCKED");
    expect(handoff.blocker).toMatch(/cli exited 3 without writing handoff/);
    // The EXECUTION_FAILURE arm carries the resume-or-discard contract — resume via the implement
    // re-dispatch, or abandon the salvage (T26 §⑤)
    expect(handoff.blocker).toMatch(
      /resume or discard: cdd implement --tasks 1 re-dispatch auto-resumes \(recovery.residue_ref\), or git stash drop to abandon/,
    );
  } finally {
    restore();
  }
});

// ---- group dispatch (in-process, non-dry-run): the group is the dispatch unit — one BLOCKED
// carrier keyed tasks-{a}-{b} (no per-task decomposition), the whole-group re-dispatch advice ----

it("runTask: group [1,2] implement failure → tasks-1,2-implement.json BLOCKED carrier (task + tasks fields, whole-group re-dispatch)", async () => {
  const { repo } = setupWorkspace();
  // a two-task plan so the group brief is in-bounds (task 1 + task 2 both exist); commitValidDocs
  // is called with the custom body (commitPlan would clobber it with the default single-task body)
  const twoTaskPlanRel = "docs/osuperpowers/plans/plan-two.md";
  const twoTaskBody = readFileSync(
    path.join(repo, "docs", "osuperpowers", "plans", "plan.md"),
    "utf8",
  ).replace("### Task 1: x", "### Task 1: x\n\n### Task 2: y");
  commitValidDocs(repo, twoTaskPlanRel, twoTaskBody);
  const twoTaskPlan = path.join(repo, twoTaskPlanRel);
  const wsTwo = path.join(repo, ".osuperpowers", "cdd", "plan-two");
  mkdirSync(wsTwo, { recursive: true });
  writeFileSync(
    path.join(wsTwo, "progress.json"),
    JSON.stringify(
      { plan: twoTaskPlanRel, timeoutCount: 0, engineRecoveryCount: 0, tasks: [] },
      null,
      2,
    ),
  );
  writeFileSync(path.join(wsTwo, "plan-constraints.md"), "constraints\n");
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bin-group-"));
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    "#!/usr/bin/env bash\necho 'boom from fake cli' >&2\nexit 3\n",
  );
  const regPath = ghostRegistry(wsTwo);
  try {
    const res = await TaskLifecycle.run("ghost", [1, 2], {
      mode: "implement",
      planFile: path.relative(repo, twoTaskPlan),
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const hp = path.join(wsTwo, "tasks-1,2-implement.json");
    expect(existsSync(hp)).toBe(true);
    const handoff = JSON.parse(readFileSync(hp, "utf8"));
    expect(handoff.tasks).toEqual([1, 2]); // the group reference (P4.3)
    expect(handoff.status).toBe("BLOCKED");
    // No per-task carrier side-branches (the group is the unit — no task-1-implement.json / task-2-implement.json)
    expect(existsSync(path.join(wsTwo, "task-1-implement.json"))).toBe(false);
    // The whole-group shape rides the advice surface — the advised --tasks is exactly the group key 1-2 (no subset dispatch; zero legacy single-task residue)
    expect(handoff.blocker).toMatch(/cdd implement --tasks 1,2 re-dispatch auto-resumes/);
    const adviceTasks = /cdd implement --tasks ([^ ]+) re-dispatch/.exec(handoff.blocker)?.[1];
    expect(adviceTasks).toBe("1,2"); // whole-group re-dispatch advice — never a per-task subset
    // Progress ledger: one row per group (round at group level)
    const progress = JSON.parse(readFileSync(path.join(wsTwo, "progress.json"), "utf8"));
    expect(progress.tasks).toEqual([{ group: "1,2", rounds: { implement: 1 } }]);
  } finally {
    restore();
  }
});

// ---- pure function tests ----

it("taskNumbersFromPlan: extracts ### Task N: and sorts (including 0)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-plan-"));
  const plan = path.join(dir, "plan.md");
  writeFileSync(plan, "# P\n### Task 3: a\n### Task 1: b\n### Task 0: skip\n### Task 2: c\n");
  expect(documentsValidator.taskNumbersFromPlan(plan)).toEqual([0, 1, 2, 3]);
});

it("isTaskPending / handoffStatus: rounds[review] round 0 → MISSING / pending; APPROVED/DONE → not pending", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-pending-"));

  const noReviewProgress = { tasks: [] };
  expect(handoffStatus(1, dir, noReviewProgress)).toBe("MISSING");
  expect(isTaskPending(1, dir, noReviewProgress)).toBe(true);

  const progressR1 = { tasks: [{ task: 1, rounds: { review: 1 } }] };
  writeFileSync(path.join(dir, "tasks-1-review-1.json"), JSON.stringify({ status: "DONE" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("APPROVED");
  expect(isTaskPending(1, dir, progressR1)).toBe(false);

  writeFileSync(path.join(dir, "tasks-1-review-1.json"), JSON.stringify({ status: "APPROVED" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("APPROVED");
  expect(isTaskPending(1, dir, progressR1)).toBe(false);

  writeFileSync(path.join(dir, "tasks-1-review-1.json"), JSON.stringify({ status: "BLOCKED" }));
  expect(handoffStatus(1, dir, progressR1)).toBe("BLOCKED");
  expect(isTaskPending(1, dir, progressR1)).toBe(true);
});

it("materializeWorkspace: plan xxx-p5-plan.md 与 xxx-p5.md slug 收敛同 workspace（run-task 派生点回归）", () => {
  const base = mkdtempSync(path.join(tmpdir(), "cdd-rw-"));
  const wsPlan = materializeWorkspace({ plan: path.join(base, "xxx-p5-plan.md"), repoRoot: base });
  const wsPlain = materializeWorkspace({ plan: path.join(base, "xxx-p5.md"), repoRoot: base });
  expect(wsPlan).toBe(wsPlain);
  expect(wsPlain).toBe(path.join(base, ".osuperpowers", "cdd", "xxx-p5"));
});

// ---- brief self-provision ----

it("runTask: plan given → brief self-provisioned with TASK_BASE, dry-run exit 0", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  expect(readFileSync(path.join(ws, "tasks-1-brief.md"), "utf8")).toMatch(
    /^TASK_BASE: [0-9a-f]{40}$/m,
  );
});

it("runTask: plan path does not exist → '--plan not found' exit 1（resolveDocArg 三行诊断）", async () => {
  const { repo } = setupWorkspace();
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    planFile: "/nonexistent/plan.md",
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(1);
  expect(res.returnBlock).toEqual([]);
});

// ---- Single root authority (injected), no cwd fallback (P1 #173) ----

it("runTask #173: plan in repo A + root=repo A → workspace lands in A, unrelated repo B untouched", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-a-")));
  const repoB = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-b-")));
  gitInit(repoA);
  gitInit(repoB);
  const planFile = commitPlan(repoA, path.join(repoA, PLAN_REL));
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    planFile,
    root: repoA,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(existsSync(path.join(repoA, ".osuperpowers", "cdd", "plan"))).toBe(true);
  expect(existsSync(path.join(repoB, ".osuperpowers"))).toBe(false);
});

it("runTask #173: no --plan → 'cannot resolve repo root' exit 1（plan 是唯一 workspace 源）", async () => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-bare-")));
  gitInit(repo);
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(1);
});

it("runTask #173: root 注入决定落点（无第二坐标系）→ workspace 恒在 root 派生的 plan 路径下", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-both-")));
  gitInit(repoA);
  const planFile = commitPlan(repoA, path.join(repoA, PLAN_REL));
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    planFile,
    root: repoA,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(existsSync(path.join(repoA, ".osuperpowers", "cdd", "plan"))).toBe(true);
});

// ---- spawnManaged env leak regression (P5 - re-targeted from spawnCapture) ----

it("spawnManaged: strips CLAUDE_CODE_SUBAGENT_MODEL from child env", async () => {
  const env = { ...process.env, CLAUDE_CODE_SUBAGENT_MODEL: "qwen3.7-max" };
  const res = await spawnManaged("printenv", ["CLAUDE_CODE_SUBAGENT_MODEL"], {
    cwd: process.cwd(),
    env,
  });
  markAllDispatchesDone(); // registry 双写内省态无落盘；dispatch 返回即标 done（不扰动后续用例 in-flight 计数）
  // cleanEnv removes CLAUDE_CODE_SUBAGENT_MODEL from the passed env — injected value must not leak.
  // Note: execa v9 extendEnv:true merges back process.env; we verify our VALUE (qwen3.7-max) is stripped.
  expect(res.stdout.includes("qwen3.7-max")).toBe(false);
});

it("spawnManaged: preserves non-subagent env vars", async () => {
  const env = { ...process.env, CDD_CUSTOM_VAR: "hello-test" };
  const res = await spawnManaged("printenv", ["CDD_CUSTOM_VAR"], { cwd: process.cwd(), env });
  markAllDispatchesDone();
  expect(res.ok).toBe(true);
  expect(res.stdout.trim()).toMatch(/hello-test/);
});

// ---- buildCtx / buildPromptParams ----

it("buildCtx: fix mode → findingsPath = review handoff path (no scope filter)", () => {
  const { repo, planFile } = setupWorkspace();
  const ctx = TaskLifecycle.buildContext(repo, TaskGroup.fromNumbers([1]), {
    mode: "fix",
    harness: "claude",
    planFile,
    round: 1,
  });
  expect(ctx.findingsPath).toMatch(/tasks-1-review-1\.json$/);
  expect(ctx.findingsPath).not.toMatch(/open-findings/);
  expect(ctx.findingsScope).toBeUndefined();
});

it("buildCtx: implement mode → findingsPath = open-findings path, no scope key", () => {
  const { repo, planFile } = setupWorkspace();
  const ctx = TaskLifecycle.buildContext(repo, TaskGroup.fromNumbers([1]), {
    mode: "implement",
    harness: "claude",
    planFile,
  });
  expect(ctx.findingsPath).toMatch(/tasks-1-open-findings\.json$/);
  expect(ctx.findingsScope).toBeUndefined();
});

// ---- CLI succeeds + no handoff → BLOCKED (Pζ) ----

it("runTask #187→Pζ: review CLI 成功 + 无 handoff → BLOCKED（10.5 仍守卫 review/fix；implement 由 T6 实体化接管）", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-ok-cli-"));
  const restore = withFakeCli(binDir, "fake-cli", "#!/usr/bin/env bash\nexit 0\n");
  const regPath = ghostRegistry(ws);
  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const handoff = JSON.parse(readFileSync(path.join(ws, "tasks-1-review-1.json"), "utf8"));
    expect(handoff.status).toBe("BLOCKED");
    expect(handoff.phase).toBe("review");
    expect(handoff.blocker).toMatch(/not written after exit 0/);
  } finally {
    restore();
  }
});

// ---- handoffStatus DONE/OK/COMPLETED normalization ----

function makeHandoffStatusFixture(status) {
  const dir = mkdtempSync(path.join(tmpdir(), "runner-hs-"));
  const progressData = { tasks: [{ task: 1, rounds: { review: 1 } }] };
  writeFileSync(path.join(dir, "tasks-1-review-1.json"), JSON.stringify({ status }));
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

// ---- Timeout path (P12) ----

it("normalizeHandoffStatus: TIMEOUT passthrough", async () => {
  const { normalizeHandoffStatus } = await import("../../artifacts/handoff/finalize.ts");
  expect(normalizeHandoffStatus("TIMEOUT")).toBe("TIMEOUT");
});

it("runTask: timeout → handoff status TIMEOUT + blocker + partial findings", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-timeout-"));
  const restore = withFakeCli(binDir, "fake-cli", "#!/usr/bin/env bash\nexec sleep 5\nexit 0\n");
  const regPath = ghostRegistry(ws);
  try {
    const _res = await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      termination: { budgetMs: 1000 }, // effective budget via the deterministic timing seam
      registryPath: regPath,
      noExit: true,
    });
    const hp = path.join(ws, "tasks-1-implement.json");
    expect(existsSync(hp)).toBe(true);
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("TIMEOUT");
    expect(h.blocker).toMatch(/timed out after 1000ms/);
    expect(h.tasks).toEqual([1]);
  } finally {
    restore();
  }
}, 10_000);

it("runTask: timeout → timeoutCount incremented in progress.json", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-tc-inc-"));
  const restore = withFakeCli(binDir, "fake-cli", "#!/usr/bin/env bash\nexec sleep 5\nexit 0\n");
  const regPath = ghostRegistry(ws);
  const env = { ...process.env };
  try {
    await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      termination: { budgetMs: 1000 },
      env,
      registryPath: regPath,
      noExit: true,
    });
    const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress.timeoutCount).toBe(1);
    await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      termination: { budgetMs: 1000 },
      env,
      registryPath: regPath,
      noExit: true,
    });
    const progress2 = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress2.timeoutCount).toBe(2);
  } finally {
    restore();
  }
}, 15_000);

it.skipIf(!GROUP_SUPPORTED)(
  "runTask: stall → TIMEOUT handoff + resume-or-discard blocker + timeoutCount incremented (T26)",
  async () => {
    // The fake CLI runs forever with no CPU and writes nothing — the stall signal must kill the
    // group past the idle window (LONG BEFORE the budget), and the handoff must carry the T26
    // resume-or-discard contract (recovery salvage + cdd implement re-dispatch auto-resume).
    const { repo, planFile, ws } = setupWorkspace();
    const binDir = mkdtempSync(path.join(tmpdir(), "cdd-stall-"));
    const restore = withFakeCli(
      binDir,
      "fake-cli",
      "#!/usr/bin/env bash\nexec sleep 1000\nexit 0\n",
    );
    const regPath = ghostRegistry(ws);
    try {
      const _res = await TaskLifecycle.run("ghost", 1, {
        mode: "implement",
        planFile,
        root: repo,
        termination: { sampleIntervalMs: 200, idleWindowMs: 1500 }, // timing override = deterministic test seam
        registryPath: regPath,
        noExit: true,
      });
      const hp = path.join(ws, "tasks-1-implement.json");
      expect(existsSync(hp)).toBe(true);
      const h = JSON.parse(readFileSync(hp, "utf8"));
      expect(h.status).toBe("TIMEOUT");
      expect(h.failure_category).toBe("TIMEOUT"); // stall stays in the TIMEOUT category (extended semantics — not a new category)
      expect(h.blocker).toMatch(/stalled/);
      expect(h.blocker).toMatch(
        /resume or discard: cdd implement --tasks 1 re-dispatch auto-resumes/,
      );
      expect(h.blocker).toMatch(/git stash drop to abandon/);
      expect(h.tasks).toEqual([1]);
      const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
      expect(progress.timeoutCount).toBe(1); // stall counts toward the normal timeout quota
    } finally {
      restore();
    }
  },
  20_000,
);

it("runTask: unkillable → handoff status BLOCKED + blocker process unkillable", async () => {
  // SIGKILL always kills on modern Unix; test contract-level behavior via writeHandoff directly.
  const { writeHandoff } = await import("../../artifacts/handoff/write.ts");
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-unkillable-ho-"));
  const hp = path.join(dir, "tasks-1-handoff.json");
  writeHandoff(hp, {
    tasks: [1],
    phase: "implement",
    status: "BLOCKED",
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
  const { repo, planFile, ws } = setupWorkspace();
  const findingsPath = path.join(ws, "tasks-1-open-findings.json");
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(existsSync(findingsPath)).toBe(false);
});

// ---- Pε #218: step 8.8 schema-validation BLOCKED handoff must include phase ----
// T7: 8.8 对 implement 门控（not 输入通道）—— 本用例迁移到 review（review/fix 保留读取校验内容契约）。

it("runTask #218 (T7→review): step 8.8 schema-validation BLOCKED → handoff contains phase field", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-sv-blocked-"));
  // Fake CLI exits 0 but writes a schema-invalid handoff (missing required 'findings').
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","artifacts":{}}' > "${path.join(ws, "tasks-1-review-1.json")}"\n` +
      `exit 0\n`,
  );
  const regPath = ghostRegistry(ws);
  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const hp = path.join(ws, "tasks-1-review-1.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.phase).toBe("review");
    expect(h.blocker).toMatch(/must have required property/);
  } finally {
    restore();
  }
});

it("runTask #218 (T7→review): step 8.8 unknown-property handoff → normalized and continues (exit 0, APPROVED)", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-sv-unk-"));
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","artifacts":{},"findings":[],"unknownField":"bad"}' > "${path.join(ws, "tasks-1-review-1.json")}"\n` +
      `exit 0\n`,
  );
  const regPath = ghostRegistry(ws);
  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    // CONTRACT_VIOLATION recovery is exercised at AC7 category level (spec §2.5.2):
    // `additionalProperties` violating keys normalize away → re-validation passes → the round
    // continues normally (no longer judged dead wholesale). The old assertion (exit 1 + BLOCKED +
    // blocker text) pinned the pre-normalization behavior and has been superseded (T5).
    expect(res.exitCode).toBe(0);
    const hp = path.join(ws, "tasks-1-review-1.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h).not.toHaveProperty("unknownField"); // 违规键被写侧同源剥除，不留盘
    expect(h.phase).toBe("review");
    expect(h.status).toBe("APPROVED");
    expect(res.returnBlock[0]).toBe("status: APPROVED");
  } finally {
    restore();
  }
});

it("runTask #218 (T7→review): step 8.8 归一化不可救（缺 required 'tasks'）→ 仍 BLOCKED 但保留原 findings", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-sv-keep-"));
  // 缺 required 'tasks'（归一化无从补齐）+ 违规键 unknownField（可剥）→ 剥键后仍失败 → BLOCKED；
  // 已解析出的 findings 必须全额保留（A4 缺陷面：此前该分支硬编码 findings: []，把内容一并清空）。
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"phase":"review","status":"CHANGES_REQUESTED","artifacts":{},"unknownField":"bad","findings":[{"severity":"blocker","summary":"keep me"}]}' > "${path.join(ws, "tasks-1-review-1.json")}"\n` +
      `exit 0\n`,
  );
  const regPath = ghostRegistry(ws);
  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const h = JSON.parse(readFileSync(path.join(ws, "tasks-1-review-1.json"), "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.phase).toBe("review");
    expect(h.blocker).toMatch(/must have required property 'tasks'/);
    expect(h.findings).toEqual([{ severity: "blocker", summary: "keep me" }]); // 全额保留
    expect(h).not.toHaveProperty("unknownField"); // 归一化先剥违规键
  } finally {
    restore();
  }
});

it("runTask #218 (T7→review): step 8.8 findings 非数组 + review 族缺 status → BLOCKED（非崩溃）", async () => {
  // fix round 1（review-1 finding 1）：agent 写的 `findings: "none"`（非数组）+ review 族缺 status
  //（schema `allOf[0].then.required: []` 明确许可）曾让归一化单点直接调 rollupStatus →
  // `TypeError: findings.some is not a function` → 沿 withLifecycle（仅 try/finally）逃到 bin 顶层
  // catch → exit 2、**不写 handoff**、findings 全丢。恢复路径在最该生效的输入类上失效且为净回归。
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-sv-nonarr-"));
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"tasks":[1],"phase":"review","artifacts":{},"findings":"none","unknownField":"bad"}' > "${path.join(ws, "tasks-1-review-1.json")}"\n` +
      `exit 0\n`,
  );
  const regPath = ghostRegistry(ws);
  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1); // 不是崩溃逃逸（exit 2）
    expect(res.returnBlock[0]).toBe("status: BLOCKED");
    const h = JSON.parse(readFileSync(path.join(ws, "tasks-1-review-1.json"), "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.phase).toBe("review");
    expect(h.findings).toEqual([]); // 非数组 → 数组守卫成 []
    expect(h.blocker).toMatch(/unexpected key: unknownField/); // 违规键名进 blocker 文案
    expect(h).not.toHaveProperty("unknownField");
  } finally {
    restore();
  }
});

// ---- Pζ T3: cross-phase fixed-point derivation ----

it("runTask Pζ T3: review dry-run without prior implement handoff → exits 0", async () => {
  const { repo, planFile } = setupWorkspace();
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "review",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
});

it("runTask Pζ T3: review fake-CLI round 1 → FIXED_POINT (brief/reference 注入) = implement.json commits.base", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-fp-cli-"));
  const promptLog = path.join(ws, "fp-prompt-log.txt");
  // FIXED_POINT 的观测面 = 渲染后的 prompt（模板 REFERENCE 参数）——引擎内部状态经 ctx 传递，
  // 不再经子进程 env（零 CDD_* 注入）；故捕获末位 prompt 实参而非 printenv。
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\nprintf '%s' "\${@: -1}" > "${promptLog}"\nprintf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "${path.join(ws, "tasks-1-review-1.json")}"\nexit 0\n`,
  );
  const regPath = ghostRegistry(ws);

  const implBase = "aabbccddeeff1234567890aabbccddeeff12345678";
  writeFileSync(
    path.join(ws, "tasks-1-implement.json"),
    JSON.stringify({
      tasks: [1],
      phase: "implement",
      status: "APPROVED",
      commits: { base: implBase, head: "deadbeefdeadbeefdeadbeef1234567890abcdef" },
      findings: [],
      artifacts: {},
    }),
  );

  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(0);
    expect(existsSync(promptLog)).toBe(true);
    expect(readFileSync(promptLog, "utf8")).toMatch(new RegExp(implBase));
  } finally {
    restore();
  }
});

it("runTask Pζ T3: prior handoff with commits.base='unknown' → FIXED_POINT not set (template gets empty string)", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  writeFileSync(
    path.join(ws, "tasks-1-implement.json"),
    JSON.stringify({
      tasks: [1],
      phase: "implement",
      status: "BLOCKED",
      commits: { base: "unknown" },
      findings: [],
      artifacts: {},
    }),
  );
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "review",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
});

it("runTask Pζ T3: review round 2 → FIXED_POINT from task-N-fix-1.json (cross-phase fix round), not implement.json", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  // Set progress so review dispatches round 2 (last completed fix round = 1).
  writeFileSync(
    path.join(ws, "progress.json"),
    JSON.stringify(
      {
        plan: PLAN_REL,
        timeoutCount: 0,
        engineRecoveryCount: 0,
        tasks: [{ task: 1, rounds: { implement: 1, review: 1, fix: 1 } }],
      },
      null,
      2,
    ),
  );

  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-fp-cli-r2-"));
  const promptLog = path.join(ws, "fp-prompt-log-r2.txt");
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\nprintf '%s' "\${@: -1}" > "${promptLog}"\nprintf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "${path.join(ws, "tasks-1-review-2.json")}"\nexit 0\n`,
  );
  const regPath = ghostRegistry(ws);

  // Round-1 fix handoff exists; round-2 review must NOT read implement.json's base.
  const fixBase = "5588aabbccddeeff1234567890aabbccddeeff1234";
  writeFileSync(
    path.join(ws, "tasks-1-implement.json"),
    JSON.stringify({
      tasks: [1],
      phase: "implement",
      status: "APPROVED",
      commits: {
        base: "implement-base-should-not-win-00000000000000",
        head: "deadbeefdeadbeefdeadbeef1234567890abcdef",
      },
      findings: [],
      artifacts: {},
    }),
  );
  writeFileSync(
    path.join(ws, "tasks-1-fix-1.json"),
    JSON.stringify({
      tasks: [1],
      phase: "fix",
      status: "APPROVED",
      commits: { base: fixBase, head: "deadbeefdeadbeefdeadbeef1234567890abcdef" },
      findings: [],
      artifacts: {},
    }),
  );

  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(0);
    expect(existsSync(promptLog)).toBe(true);
    // FIXED_POINT comes from tasks-1-fix-1.json round, NOT implement.json
    expect(readFileSync(promptLog, "utf8")).toMatch(new RegExp(fixBase));
    expect(readFileSync(promptLog, "utf8")).not.toContain("implement-base-should-not-win");
  } finally {
    restore();
  }
});

// ---- Mode → (op, type) injection mapping at the runner invokeCliWithRetry call site (Task 5) ----

it("runTask Task 5: review → invokeCli (op=review,type=task) → code-review prefix 注入 prompt 首行", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-inj-cli-"));
  const promptLog = path.join(ws, "prompt-log.txt");
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\nprintf '%s' "\${@: -1}" > "${promptLog}"\nprintf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "${path.join(ws, "tasks-1-review-1.json")}"\nexit 0\n`,
  );
  const regPath = ghostRegistry(ws, {
    prefix: {
      implement: "/mattpocock-skills:tdd",
      review: {
        task: "/mattpocock-skills:code-review",
        branch: "/mattpocock-skills:code-review",
        spec: "",
        plan: "",
      },
      fix: "/mattpocock-skills:tdd",
    },
    suffix: {},
  });

  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(0);
    const logged = readFileSync(promptLog, "utf8");
    expect(logged.split("\n")[0]).toBe("/mattpocock-skills:code-review");
  } finally {
    restore();
  }
});

// ---- Status single-authority: review read-back overwrites (agent wrote warn-only CHANGES_REQUESTED → overwritten to REVIEW_FIX — Task 8 收口态) (T5) ----

it("runner review 读回覆写：task-N-review-1.json agent 写 CHANGES_REQUESTED warn-only → 覆写 REVIEW_FIX", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-review-derive-"));
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"tasks":[1],"phase":"review","status":"CHANGES_REQUESTED","findings":[{"severity":"warn","summary":"w"},{"severity":"nit","summary":"n"}],"artifacts":{}}' > "${path.join(ws, "tasks-1-review-1.json")}"\n` +
      `exit 0\n`,
  );
  const regPath = ghostRegistry(ws);

  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(0);
    const hp = path.join(ws, "tasks-1-review-1.json");
    expect(existsSync(hp)).toBe(true);
    const h = JSON.parse(readFileSync(hp, "utf8"));
    // warn/nit = 0 blocker → status 被引擎派生覆写为 REVIEW_FIX（收口态，findings 保留）
    expect(h.status).toBe("REVIEW_FIX");
    expect(h.findings).toEqual([
      { severity: "warn", summary: "w" },
      { severity: "nit", summary: "n" },
    ]);
    // return block 同步从 handoff 重发（returnFromHandoff）— 状态一致，不携带 agent 的 CHANGES_REQUESTED
    expect(res.returnBlock[0]).toBe("status: REVIEW_FIX");
    // Review success-round blocker defaults to none (not the commit-contract default text); a
    // counters line still follows the blocker (returnBlock[3] or returnBlock[2] depending on
    // artifacts — the **last line is always counters**) (T5 nit)
    expect(res.returnBlock.at(-2)).toMatch(/^blocker: none$/);
    expect(res.returnBlock.at(-1)).toMatch(/^counters: /);
  } finally {
    restore();
  }
});

// ---- Unverifiable folds to BLOCKED — mandatory carrier + exit 1, reversing the previous exit 0 (Task 23 ①③, T14 recreated scenario) ----

it("runTask Task 23 T14 复现场景: review 写 unverifiable → BLOCKED + UNVERIFIABLE + 真实 blocker（未验什么/为什么）+ exit 1", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t14-rescene-"));
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"tasks":[1],"phase":"review","findings":[],"unverifiable":[{"claim":"90min 无拖死实证","why":"现场已恢复，无法复核"}],"artifacts":{}}' > "${path.join(ws, "tasks-1-review-1.json")}"\n` +
      `exit 0\n`,
  );
  const regPath = ghostRegistry(ws);

  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    const hp = path.join(ws, "tasks-1-review-1.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    // ① 三面正交：裸折已死 — carrier 必带 failure_category + 真实 blocker
    expect(h.status).toBe("BLOCKED");
    expect(h.failure_category).toBe("UNVERIFIABLE");
    expect(h.blocker).toContain("90min 无拖死实证");
    expect(h.blocker).toContain("现场已恢复");
    // ③ T14 反转: BLOCKED review → exit 1（不再是 exit 0）
    expect(res.exitCode).toBe(1);
    // return block 同步: 真实汇总, 不伪造「uncommitted changes at return」
    expect(res.returnBlock[0]).toBe("status: BLOCKED");
    expect(res.returnBlock.at(-2)).toBe(
      "blocker: could not verify: 90min 无拖死实证; 现场已恢复，无法复核",
    );
    expect(res.returnBlock.at(-1)).toMatch(/^counters: /);
    // Failed round still counts its round (re-dispatch must stop there) but carries zero status — no complete marker, no other state field
    const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress.tasks[0]).toEqual({ task: 1, rounds: { review: 1 } });
  } finally {
    restore();
  }
});

// ---- §-term dev-measured acceptance items → accepted-noted (recorded in notes; zero unverifiable, zero BLOCK) (Task 23 ② / Task 8 — the warn finding closes as REVIEW_FIX 收口态) ----

it("runTask Task 23 §口径: dev-measured 验收项 accepted-noted → notes 记录, 零 unverifiable 零 BLOCK, warn finding 收口 REVIEW_FIX, exit 0", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-dev-measured-"));
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\n` +
      `printf '%s' '{"tasks":[1],"phase":"review","findings":[{"severity":"warn","summary":"w"}],"notes":"§口径 dev-measured items accepted-noted (evidence-contract); 每一项删除面有残留守卫","artifacts":{}}' > "${path.join(ws, "tasks-1-review-1.json")}"\n` +
      `exit 0\n`,
  );
  const regPath = ghostRegistry(ws);

  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(0);
    const h = JSON.parse(readFileSync(path.join(ws, "tasks-1-review-1.json"), "utf8"));
    // 零 unverifiable 零 BLOCK；warn finding 收口为 REVIEW_FIX（零 blocker 的三值结论，Task 8 #278）
    expect(h.status).toBe("REVIEW_FIX");
    expect(h.unverifiable).toBeUndefined();
    expect(h.blocker).toBeUndefined();
    expect(res.returnBlock[0]).toBe("status: REVIEW_FIX");
  } finally {
    restore();
  }
});

// ---- step 10 CLI failed no handoff → BLOCKED ----

it("runTask: step 10 (cli failed no handoff) BLOCKED has artifacts + action message", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-fail-no-handoff-"));
  const restore = withFakeCli(binDir, "fake-cli", "#!/usr/bin/env bash\nexit 1\n");
  const regPath = ghostRegistry(ws);

  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    const hp = path.join(ws, "tasks-1-implement.json");
    expect(existsSync(hp)).toBe(true);
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.artifacts).toBeDefined();
    expect(h.blocker).toMatch(/→/);
  } finally {
    restore();
  }
});

// ---- per-round buildCtx ----

it("runTask: per-round buildCtx — review derives tasks-1-review-1.json", () => {
  const { repo, planFile } = setupWorkspace();
  const ctx = TaskLifecycle.buildContext(repo, TaskGroup.fromNumbers([1]), {
    mode: "review",
    harness: "claude",
    planFile,
    round: 1,
  });
  expect(ctx.handoffPath.endsWith("tasks-1-review-1.json")).toBe(true);
});

it("runTask: implement derives tasks-1-implement.json (no round suffix)", () => {
  const { repo, planFile } = setupWorkspace();
  const ctx = TaskLifecycle.buildContext(repo, TaskGroup.fromNumbers([1]), {
    mode: "implement",
    harness: "claude",
    planFile,
    round: 1,
  });
  expect(ctx.handoffPath.endsWith("tasks-1-implement.json")).toBe(true);
});

it("runTask: round-2 buildCtx derives tasks-1-review-2.json + buildPromptParams 参数面同源", () => {
  const { repo, planFile, ws } = setupWorkspace();
  const ctx = TaskLifecycle.buildContext(repo, TaskGroup.fromNumbers([1]), {
    mode: "review",
    harness: "claude",
    planFile,
    round: 2,
  });
  expect(ctx.handoffPath.endsWith("tasks-1-review-2.json")).toBe(true);

  const params = buildPromptParams(ctx, TaskGroup.fromNumbers([1]));
  expect(params.WORKSPACE).toBe(ws);
  expect(params.WORKSPACE_SLUG).toBe(path.basename(ws)); // canonical slug slot, same source as workspaceSlug (Task 20 ⑦)
  expect(params.HANDOFF_TARGET).toBe(ctx.handoffPath);
  expect(params.BRIEF).toBe(ctx.briefPath);
  expect(params.CONSTRAINTS).toBe(ctx.constraintsPath);
  expect(params.FINDINGS).toBe(ctx.findingsPath);
  expect(params.DISPATCH_UNIT).toBe("1");
  expect(params.REVIEW_PLAN_LINE).toBe(`**Plan:** ${ctx.plan}`);
});

// ---- Mode normalization (review) (T4) ----

it("runTask: 未知 mode → rejected：CDD_MODE must be implement|review|fix", async () => {
  const { repo, planFile } = setupWorkspace();
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "bogus",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(1);
  expect(res.returnBlock).toEqual([]);
});

it("runTask: mode review dry-run → return block APPROVED + no handoff written", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "review",
    dryRun: true,
    planFile,
    root: repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  expect(existsSync(path.join(ws, "tasks-1-review-1.json"))).toBe(false);
});

it("schema: phase 'review' handoff 通过 Ajv 校验（phase enum 已归一）", async () => {
  const { HandoffSchemaValidator } = await import("../../rules/schema.ts");
  const schemaValidator = new HandoffSchemaValidator(); // validation stays on the schema face (Task 7 ① — instance method)
  expect(
    schemaValidator.validateHandoffSchema({
      tasks: [1],
      phase: "review",
      status: "APPROVED",
      commits: { base: "a".repeat(40), head: "b".repeat(40) },
      findings: [],
      artifacts: {},
    }),
  ).toEqual({ valid: true });
  // 非法 phase 不再合法（未归一会被 runner 8.8 Ajv 判 invalid 覆写 BLOCKED）
  expect(
    schemaValidator.validateHandoffSchema({
      tasks: [1],
      phase: "bogus",
      status: "APPROVED",
      findings: [],
      artifacts: {},
    }).valid,
  ).toBe(false);
});

// ---- Implement handoff materialization + evidence-gate + return block returnFromHandoff (commits single authority) (T6) ----

// Fixture (T6): git repo + git-committed plan at the repo root (`--plan`) + clean tracked tree
// (the commit-contract precondition). Returns the registry / HEAD scene; root is injected via
// opts.root; workspace purely derived = <repo>/.osuperpowers/cdd/plan.
function t6Workspace(extraFiles = {}) {
  const repo = gitInitReal(mkdtempSync(path.join(tmpdir(), "cdd-t6-ws-")));
  commitValidDocs(repo);
  const cddDir = path.join(repo, ".osuperpowers", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(path.join(cddDir, ".gitignore"), "*\n");
  const ws = path.join(cddDir, "plan");
  mkdirSync(ws, { recursive: true });
  writeFileSync(
    path.join(ws, "progress.json"),
    JSON.stringify(
      {
        plan: PLAN_REL,
        timeoutCount: 0,
        engineRecoveryCount: 0,
        tasks: [],
      },
      null,
      2,
    ),
  );
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  for (const [f, v] of Object.entries(extraFiles)) writeFileSync(path.join(ws, f), v);
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t6-bin-"));
  const regPath = ghostRegistry(ws);
  const actualHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: ws,
    encoding: "utf8",
  }).trim();
  // brief 由 engine 自供应（plan 定稿处 generateBrief），TASK_BASE 恒 = git HEAD → commits.base 权威即 HEAD。
  // （旧 fixture 用 CDD_WORKSPACE 直设 + 手写 brief，故可自定 TASK_BASE；该通道已随直设分支删除。）
  const taskBase = actualHead;
  return { repo, ws, taskBase, actualHead, binDir, regPath, planFile: PLAN_REL };
}

// Ghost-run wrapper: write fake-cli (body) → inject PATH to run runTask (implement/non-dry) → restore PATH (T6)
async function runT6Ghost(t6, body) {
  const restore = withFakeCli(t6.binDir, "fake-cli", body);
  try {
    return await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile: t6.planFile,
      root: t6.repo,
      registryPath: t6.regPath,
      noExit: true,
    });
  } finally {
    restore();
  }
}

it("runTask T6: implement 成功路径 — runner 实体化 tasks-1-implement.json（return block stdout → 文件；commits 单一权威）", async () => {
  const t6 = t6Workspace();
  const report = path.join(t6.ws, "tasks-1-report.md");
  const tev = path.join(t6.ws, "tasks-1-test-evidence.json");
  writeFileSync(report, "report body\n");
  // evidence 齐 command/passed/exit_code（behavior_change 非 true 或齐全是 soft）→ 不拦
  writeFileSync(
    tev,
    JSON.stringify({ command: "npx vitest run", exit_code: 0, passed: true, warnings_count: 0 }),
  );
  const res = await runT6Ghost(
    t6,
    [
      "#!/usr/bin/env bash",
      "printf '%s\\n' 'status: APPROVED'",
      "printf '%s\\n' 'commits: base=agent-wrong-base head=agent-wrong-head'",
      `printf '%s\\n' 'artifacts: report=${report} test_evidence=${tev}'`,
      "printf '%s\\n' 'blocker: none'",
      "exit 0",
    ].join("\n"),
  );
  expect(res.exitCode).toBe(0);
  const hp = path.join(t6.ws, "tasks-1-implement.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  expect(h.tasks).toEqual([1]);
  expect(h.phase).toBe("implement");
  expect(h.status).toBe("APPROVED");
  expect(h.commits.base).toBe(t6.taskBase); // brief TASK_BASE 权威（agent 行被忽略）
  expect(h.commits.head).toBe(t6.actualHead); // git HEAD 权威
  expect(h.findings).toEqual([]);
  expect(h.artifacts.report).toBe(report);
  expect(h.blocker).toBeUndefined(); // blocker: none → 省略（returnFromHandoff 按 APPROVED 缺省 none）
  // return block 由实体化 handoff 重发（returnFromHandoff）
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  expect(res.returnBlock[1]).toBe(`commits: base=${t6.taskBase} head=${t6.actualHead}`);
});

it("runTask T6: implement 提交真实改动 → 实体化 carrier 持存 changed-surface ledger origin note（writeBoundary 记账）", async () => {
  const t6 = t6Workspace();
  const report = path.join(t6.ws, "tasks-1-report.md");
  const tev = path.join(t6.ws, "tasks-1-test-evidence.json");
  writeFileSync(report, "report body\n");
  writeFileSync(
    tev,
    JSON.stringify({ command: "npx vitest run", exit_code: 0, passed: true, warnings_count: 0 }),
  );
  // Ghost agent commits a REAL deliverable (wip.md) — the first T25-era dispatch round ran on an
  // engine without writeBoundary, so its materialized carrier carried no ledger-origin note; the
  // full-dispatch regression pins the note surviving materialization (reconcile runs after it).
  const res = await runT6Ghost(
    t6,
    [
      "#!/usr/bin/env bash",
      "printf 'agent deliverable\\n' > wip.md",
      "git add wip.md",
      "git -c user.name=cdd-test -c user.email=cdd-test@example.com commit -qm 'agent deliverable'",
      "printf '%s\\n' 'status: APPROVED'",
      "printf '%s\\n' 'commits: base=x head=y'",
      `printf '%s\\n' 'artifacts: report=${report} test_evidence=${tev}'`,
      "printf '%s\\n' 'blocker: none'",
      "exit 0",
    ].join("\n"),
  );
  expect(res.exitCode).toBe(0);
  const hp = path.join(t6.ws, "tasks-1-implement.json");
  const h = JSON.parse(readFileSync(hp, "utf8"));
  expect(h.status).toBe("APPROVED");
  expect(h.commits.base).toBe(t6.taskBase); // dispatch-time HEAD (plan commit) — diff base..HEAD is exactly wip.md
  // writeBoundary reconcile: implement writes no changes[] → the pure-soft ledger records the diff
  // fileset verbatim as the ledger origin (zero warn; the review scope axis reuses the same surface)
  expect(h.notes).toContain("changed-surface ledger origin (no changes[] declared)");
  expect(h.notes).toContain("wip.md");
  // agent committed before exiting → the tree is clean → the exit gate passes (exit 0 asserted above)
  expect(execFileSync("git", ["-C", t6.repo, "status", "--porcelain"], { encoding: "utf8" })).toBe(
    "",
  );
}, 30_000);

it("runTask T6: implement 不写 handoff 也不触发 10.5 BLOCKED（runner 实体化兜底）", async () => {
  // fake-cli 只回 return block 四行、不写任何文件（连 test-evidence 都没有 → evidence-gate soft WARN）→ 仍 exit 0 + 实体化。
  const t6 = t6Workspace();
  const res = await runT6Ghost(
    t6,
    [
      "#!/usr/bin/env bash",
      "printf '%s\\n' 'status: APPROVED'",
      "printf '%s\\n' 'commits: base=x head=y'",
      `printf '%s\\n' 'artifacts: report=${path.join(t6.ws, "tasks-1-report.md")}'`,
      "printf '%s\\n' 'blocker: none'",
      "exit 0",
    ].join("\n"),
  );
  expect(res.exitCode).toBe(0);
  const hp = path.join(t6.ws, "tasks-1-implement.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  // 10.5 未触发：status 为 APPROVED（若命中 10.5 会被覆写 BLOCKED + exit 1）
  expect(h.status).toBe("APPROVED");
  expect(h.phase).toBe("implement");
  expect(h.commits.base).toBe(t6.taskBase);
});

it("runTask T6: evidence-gate — behavior_change:true 缺 command/passed/exit_code → handoff 覆写 BLOCKED + exit 1", async () => {
  const t6 = t6Workspace();
  const res = await runT6Ghost(
    t6,
    [
      "#!/usr/bin/env bash",
      // 模拟 agent 写了 test-evidence：behavior_change:true 但缺必需三键
      `printf '%s' '{"behavior_change":true,"warnings_count":0}' > "${path.join(t6.ws, "tasks-1-test-evidence.json")}"`,
      "printf '%s\\n' 'status: APPROVED'",
      "printf '%s\\n' 'commits: base=x head=y'",
      `printf '%s\\n' 'artifacts: report=${path.join(t6.ws, "tasks-1-report.md")}'`,
      "printf '%s\\n' 'blocker: none'",
      "exit 0",
    ].join("\n"),
  );
  expect(res.exitCode).toBe(1);
  const hp = path.join(t6.ws, "tasks-1-implement.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  expect(h.status).toBe("BLOCKED");
  expect(h.blocker).toMatch(/test_evidence gate: hard/);
  expect(h.blocker).toContain("command");
  // return block 同步为 BLOCKED（returnFromHandoff 与覆写后 handoff 一致）
  expect(res.returnBlock[0]).toBe("status: BLOCKED");
  // N② (T9) → T6: implement 实体化 BLOCKED = 引擎自写 BLOCKED → engineSelfWrittenCount
  //（六类分派后不再消耗 recovery 额度 —— engineRecoveryCount 只被 EXECUTION_FAILURE 消耗）
  const progress = JSON.parse(readFileSync(path.join(t6.ws, "progress.json"), "utf8"));
  expect(progress.engineSelfWrittenCount).toBe(1);
  expect(progress.engineRecoveryCount).toBe(0);
});

it("runTask T6: return block 输出改用 returnFromHandoff — agent stdout 的 commits/缺省 blocker 由实体化 handoff 重发覆写", async () => {
  const t6 = t6Workspace();
  // agent 谎报 commits + 无 blocker 行 → 最终 return block 必须来自实体化 handoff（brief TASK_BASE + git HEAD + blocker: none）
  const res = await runT6Ghost(
    t6,
    [
      "#!/usr/bin/env bash",
      "printf '%s\\n' 'status: APPROVED'",
      "printf '%s\\n' 'commits: base=fakefakefakefakefakefakefakefakefakefake head=fakefakefakefakefakefakefakefakefakefake'",
      `printf '%s\\n' 'artifacts: report=${path.join(t6.ws, "tasks-1-report.md")}'`,
      "exit 0",
    ].join("\n"),
  );
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock.length).toBe(5);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  expect(res.returnBlock[1]).toBe(`commits: base=${t6.taskBase} head=${t6.actualHead}`);
  expect(res.returnBlock[3]).toBe("blocker: none");
  expect(res.returnBlock[4]).toMatch(
    /^counters: timeout=\d+ contract-violation=\d+ engine-self-written=\d+ recovery=\d+$/,
  );
  const h = JSON.parse(readFileSync(path.join(t6.ws, "tasks-1-implement.json"), "utf8"));
  expect(h.commits.base).toBe(t6.taskBase);
  expect(h.blocker).toBeUndefined();
});

// ---- Implement 8.8 gate: HANDOFF is not an implement input channel (#232 residual path eliminated structurally) (T7) ----

it("runTask T7: implement 8.8 不读 existing handoff → schema-invalid 残留被实体化 writeOwnHandoff 全量覆盖 APPROVED", async () => {
  // 旧 P1 假设：agent 手写残缺 handoff（缺 findings）→ 8.8 无差别校验 → 误拦 BLOCKED（#232）。
  // T7：engine 是载体唯一作者，implement 的 HANDOFF 路径对 agent 不是输入通道，8.8 门控跳过；
  // step 13 finalizeHandoff 实体化 + writeOwnHandoff 全量覆盖 → APPROVED（残留进不了载体）。
  const t6 = t6Workspace();
  const res = await runT6Ghost(
    t6,
    [
      "#!/usr/bin/env bash",
      // 模拟旧 P1 agent 残留：schema-invalid（缺 findings）existing handoff
      `printf '%s' '{"tasks":[1],"phase":"implement","status":"APPROVED","artifacts":{}}' > "${path.join(t6.ws, "tasks-1-implement.json")}"`,
      "printf '%s\\n' 'status: APPROVED'",
      "printf '%s\\n' 'commits: base=x head=y'",
      `printf '%s\\n' 'artifacts: report=${path.join(t6.ws, "tasks-1-report.md")}'`,
      "printf '%s\\n' 'blocker: none'",
      "exit 0",
    ].join("\n"),
  );
  expect(res.exitCode).toBe(0);
  const hp = path.join(t6.ws, "tasks-1-implement.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  // 未被 8.8 判 invalid 覆写 BLOCKED：最终载体是实体化结果（commits.base = brief TASK_BASE 权威）
  expect(h.status).toBe("APPROVED");
  expect(h.phase).toBe("implement");
  expect(h.commits.base).toBe(t6.taskBase);
  expect(h.findings).toEqual([]);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
});

// ---- Post-run validateCommitContract (all modes) + ensure-row writeback (no status field) (T8, Task 30 ②) ----

// Fixture (T8): git repo (tracked source + committed plan + ws adopted under .osuperpowers/cdd/plan);
// dirty=true appends to tracked.txt (porcelain ` M`) → the post-run commit-contract must BLOCK.
function t8Workspace({ dirty = false } = {}) {
  const repo = gitInitReal(mkdtempSync(path.join(tmpdir(), "cdd-t8-ws-")));
  writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
  gitCommit(repo);
  commitValidDocs(repo);
  const cddDir = path.join(repo, ".osuperpowers", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(path.join(cddDir, ".gitignore"), "*\n");
  const ws = path.join(cddDir, "plan");
  mkdirSync(ws, { recursive: true });
  writeFileSync(
    path.join(ws, "progress.json"),
    JSON.stringify(
      {
        plan: PLAN_REL,
        timeoutCount: 0,
        engineRecoveryCount: 0,
        tasks: [],
      },
      null,
      2,
    ),
  );
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  if (dirty) appendFileSync(path.join(repo, "tracked.txt"), "dirty\n");
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t8-bin-"));
  const regPath = ghostRegistry(ws);
  const actualHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: ws,
    encoding: "utf8",
  }).trim();
  return { repo, ws, actualHead, binDir, regPath, planFile: PLAN_REL };
}

// Review ghost-run wrapper: fake-cli writes an APPROVED review handoff → run runTask review (non-dry) → restore PATH (T8)
async function runT8ReviewGhost(t8, body) {
  const restore = withFakeCli(t8.binDir, "fake-cli", body);
  try {
    return await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      planFile: t8.planFile,
      root: t8.repo,
      registryPath: t8.regPath,
      noExit: true,
    });
  } finally {
    restore();
  }
}

it("runTask T8/T30: review APPROVED → ensure-row writeback (rounds[review]=1, no status field) + deriveTaskState=complete", async () => {
  const t8 = t8Workspace();
  const res = await runT8ReviewGhost(
    t8,
    [
      "#!/usr/bin/env bash",
      `printf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "${path.join(t8.ws, "tasks-1-review-1.json")}"`,
      "exit 0",
    ].join("\n"),
  );
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  const progress = JSON.parse(readFileSync(path.join(t8.ws, "progress.json"), "utf8"));
  // The row carries facts only — rounds on record, zero status field; the complete verdict is
  // deriveTaskState's sole authority (the T29-flip blackbox: review-APPROVED → complete) (Task 30 ②).
  expect(progress.tasks[0]).toEqual({ task: 1, rounds: { review: 1 } });
  expect(progress.tasks[0]).not.toHaveProperty("status");
  expect(statusJudge.deriveTaskState(t8.ws, 1)).toBe("complete");
  // handoff 保持 APPROVED（clean tree 通过 post-run validate；review 跳过 head 校验）
  const h = JSON.parse(readFileSync(path.join(t8.ws, "tasks-1-review-1.json"), "utf8"));
  expect(h.status).toBe("APPROVED");
});

it("runTask T8: post-run validateCommitContract — dirty tree → handoff BLOCKED（review 亦校验）+ exit 1", async () => {
  // The entry gate enforces a clean tree before dispatch — a dirty start is BLOCKED at entry, so
  // the exit gate never fires. The fixture dirties the tree during dispatch (inside fake-cli)
  // instead: clean entry, dirty exit → the exit gate decides (Task 8).
  const t8 = t8Workspace();
  const res = await runT8ReviewGhost(
    t8,
    [
      "#!/usr/bin/env bash",
      `printf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "${path.join(t8.ws, "tasks-1-review-1.json")}"`,
      `printf '%s\n' 'dirty' >> "${path.join(t8.repo, "tracked.txt")}"`,
      "exit 0",
    ].join("\n"),
  );
  expect(res.exitCode).toBe(1);
  expect(res.returnBlock[0]).toBe("status: BLOCKED");
  const hp = path.join(t8.ws, "tasks-1-review-1.json");
  expect(existsSync(hp)).toBe(true);
  const h = JSON.parse(readFileSync(hp, "utf8"));
  expect(h.status).toBe("BLOCKED");
  expect(h.blocker).toMatch(/uncommitted changes at return/);
  // Failed round touches nothing: the exit-gate failure returns before incrementRound → the row is absent, and a fortiori carries no complete/state field
  const progress = JSON.parse(readFileSync(path.join(t8.ws, "progress.json"), "utf8"));
  expect(progress.tasks).toEqual([]);
});

it("runTask T8: post-run validateCommitContract — implement dirty tree → 实体化 handoff 覆写 BLOCKED + exit 1", async () => {
  // Same as the review case — clean entry, tree dirtied during dispatch (inside fake-cli),
  // the exit gate fires (Task 8)
  const t8 = t8Workspace();
  const restore = withFakeCli(
    t8.binDir,
    "fake-cli",
    [
      "#!/usr/bin/env bash",
      "printf '%s\\n' 'status: APPROVED'",
      "printf '%s\\n' 'commits: base=x head=y'",
      `printf '%s\\n' 'artifacts: report=${path.join(t8.ws, "tasks-1-report.md")}'`,
      `printf '%s\\n' 'dirty' >> "${path.join(t8.repo, "tracked.txt")}"`,
      "exit 0",
    ].join("\n"),
  );
  try {
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile: t8.planFile,
      root: t8.repo,
      registryPath: t8.regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    expect(res.returnBlock[0]).toBe("status: BLOCKED");
    const hp = path.join(t8.ws, "tasks-1-implement.json");
    const h = JSON.parse(readFileSync(hp, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.blocker).toMatch(/uncommitted changes at return/);
  } finally {
    restore();
  }
});

// ---- Plan-constraints materialization + implement pre-flight existence gate (T22) ----

// Fixture (T22/§T7.1): git repo + committed plan (parametrized content) + workspace WITHOUT a
// pre-written plan-constraints.md — the materializer's "generate once" surface is exercised by
// letting runTask self-provision it (like F11's generateBrief, same resolveContext point).
function t22Workspace(planContent: string) {
  const repo = gitInitReal(mkdtempSync(path.join(tmpdir(), "cdd-t22-ws-")));
  commitValidDocs(repo, PLAN_REL, planContent);
  const cddDir = path.join(repo, ".osuperpowers", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(path.join(cddDir, ".gitignore"), "*\n");
  const ws = path.join(cddDir, "plan");
  mkdirSync(ws, { recursive: true });
  writeFileSync(
    path.join(ws, "progress.json"),
    JSON.stringify(
      {
        plan: PLAN_REL,
        timeoutCount: 0,
        engineRecoveryCount: 0,
        tasks: [],
      },
      null,
      2,
    ),
  );
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t22-bin-"));
  const regPath = ghostRegistry(ws);
  return { repo, planFile: PLAN_REL, ws, binDir, regPath };
}

// A committed plan carrying the prose-pointer constraint anchors (the four **bold** paragraphs) —
// the plan-declared Constraints source the materializer extracts deterministically.
const T22_PROSE_PLAN = [
  "# Plan",
  "",
  "**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)",
  "",
  "**口径**：mouthpiece constraint",
  "",
  "**commit 边界机制**：commit-boundary constraint",
  "",
  "**Flow Atomicity**：flow-atomicity constraint",
  "",
  "**顺序原则**：ordering-principle constraint",
  "",
  "---",
  "",
  "### Task 1: x",
  "body",
].join("\n");

// 黑盒 ①：implement pre-flight 无 plan-constraints.md → 自 plan 声明源生成（含 plan hash 锚）→ 门过 → 绿色。
it("runTask T22: implement pre-flight 缺失 constraints → 自 plan 声明源物料化 + 门过 + 绿色", async () => {
  const t22 = t22Workspace(T22_PROSE_PLAN);
  const report = path.join(t22.ws, "tasks-1-report.md");
  const tev = path.join(t22.ws, "tasks-1-test-evidence.json");
  writeFileSync(report, "report body\n");
  writeFileSync(
    tev,
    JSON.stringify({ command: "npx vitest run", exit_code: 0, passed: true, warnings_count: 0 }),
  );
  const restore = withFakeCli(
    t22.binDir,
    "fake-cli",
    [
      "#!/usr/bin/env bash",
      "printf '%s\\n' 'status: APPROVED'",
      "printf '%s\\n' 'commits: base=x head=y'",
      `printf '%s\\n' 'artifacts: report=${report} test_evidence=${tev}'`,
      "printf '%s\\n' 'blocker: none'",
      "exit 0",
    ].join("\n"),
  );
  try {
    const cpPath = path.join(t22.ws, "plan-constraints.md");
    expect(existsSync(cpPath)).toBe(false); // 前置：缺失
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile: t22.planFile,
      root: t22.repo,
      registryPath: t22.regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(0); // 门过 → 绿色走完 dispatch
    // 物料化：plan hash 锚 + 四段声明面 + 无绝对路径（可复算确定性字节）
    expect(existsSync(cpPath)).toBe(true);
    const text = readFileSync(cpPath, "utf8");
    expect(text).toMatch(/plan hash: [0-9a-f]{64}/);
    expect(text).toContain("**口径**：mouthpiece constraint");
    expect(text).toContain("**顺序原则**：ordering-principle constraint");
    expect(text).not.toContain(t22.repo);
    // dispatch 照常完成（实体化 handoff 同样落地）
    expect(existsSync(path.join(t22.ws, "tasks-1-implement.json"))).toBe(true);
  } finally {
    restore();
  }
});

// 黑盒 ②：implement pre-flight plan 无约束源声明（无 ## Constraints、无散文锚）→ BLOCK exit 1，
// 非静默 fallback（E27 批量根因的门判面）；提示可行动文案。
it("runTask T22: implement pre-flight 约束源未声明 → BLOCK exit 1（可行动文案，无 handoff 落地）", async () => {
  const t22 = t22Workspace("# Plan\n\n### Task 1: x\nbody\n");
  // 非 dry-run 需要可解析的 harness（ghost 走 fake registry + fake-cli，CI 无 claude 亦确定性）；
  // 该测试只测 pre-flight 门——fake cli 永不 spawn。
  const restore = withFakeCli(t22.binDir, "fake-cli", ["#!/usr/bin/env bash", "exit 1"].join("\n"));
  let code: number | null = null;
  let stderr = "";
  let stdout = "";
  try {
    ({ code, stderr, stdout } = await capture(() =>
      TaskLifecycle.run("ghost", 1, {
        mode: "implement",
        planFile: t22.planFile,
        root: t22.repo,
        registryPath: t22.regPath,
        noExit: false,
      }),
    ));
    expect(code).toBe(1);
    expect(stderr).toMatch(/CDD_BLOCKED/);
    expect(stderr).toMatch(/Constraints source undeclared|plan-constraints\.md missing/);
    expect(existsSync(path.join(t22.ws, "tasks-1-implement.json"))).toBe(false); // pre-flight 未达 dispatch
    expect(existsSync(path.join(t22.ws, "plan-constraints.md"))).toBe(false); // 不写残缺产物
    expect(existsSync(path.join(t22.ws, "tasks-1-brief.md"))).toBe(false); // 门先于 F11：BLOCK 零残留（brief 不落盘）
    expect(stdout).toBe("");
  } finally {
    restore();
  }
});

// 黑盒 ③：dry-run 豁免 —— 同一无源 plan 走 dry-run 零 BLOCK（零副作用模拟：不物料化、不落文件）。
it("runTask T22: dry-run 豁免 — 无源 plan 走 dry-run 零 BLOCK + 零 constraints 副作用", async () => {
  const t22 = t22Workspace("# Plan\n\n### Task 1: x\nbody\n");
  const res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    planFile: t22.planFile,
    root: t22.repo,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  expect(existsSync(path.join(t22.ws, "plan-constraints.md"))).toBe(false);
});

// ---- Resume-from-residue black-box (T26, spec T7.5) ----
// Real dispatch through the ghost fake-cli: ① a dead round (budget TIMEOUT with tracked WIP)
// must salvage the WIP into a stash and ride recovery.residue_ref on the carrier; ② the re-dispatch
// pre-flight (resolveContext, after the entry gate) must apply the salvage back, and the regenerated
// brief must carry the data-driven residue appendix — the next agent continues on the restored WIP
// (incremental addition), it does not rewrite from zero (the T25 0→727 story). Budget path (not
// stall) keeps the suite group-support-independent like the timeout test above.

// git stash needs a repo-local identity (helpers' gitInit sets it only inline on the commit command)
// — real repos always have one.
function configureGitIdentity(repo) {
  execFileSync("git", ["-C", repo, "config", "user.name", "cdd-test"]);
  execFileSync("git", ["-C", repo, "config", "user.email", "cdd-test@example.com"]);
}

// The continuing round-2 fake CLI body (shared by both scenarios): append an incremental line to the
// restored WIP, commit (clean exit-gate baseline), then emit the 4-line return block.
function continuingCli(ws) {
  return (
    `#!/usr/bin/env bash\n` +
    `printf 'line3-agent-increment\n' >> wip.md\n` +
    `git add wip.md\n` +
    `git -c user.name=cdd-test -c user.email=cdd-test@example.com commit -qm "agent incremental continuation"\n` +
    `printf 'status: APPROVED\\ncommits: base=0000000000000000000000000000000000000000 head=0000000000000000000000000000000000000000\\n'\n` +
    `printf 'artifacts: brief=${path.join(ws, "tasks-1-brief.md")}\\nblocker: none\\n'\n` +
    `exit 0\n`
  );
}

it("T26 black-box: TIMEOUT → salvage → re-dispatch resumes WIP + brief appendix + increment on top", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  configureGitIdentity(repo);
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-rr-"));
  const regPath = ghostRegistry(ws);
  // Round 1 agent: writes a tracked WIP file then hangs → budget TIMEOUT (cause over-budget).
  // (no opts.env — hostEnv() reads the LIVE process.env, which withFakeCli PATH-shims below)
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\nprintf 'line2-round1-agent-wip\n' > wip.md\ngit add wip.md\nexec sleep 100\n`,
  );
  try {
    await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      termination: { budgetMs: 1000 },
      registryPath: regPath,
      noExit: true,
    });
    const hp = path.join(ws, "tasks-1-implement.json");
    const h1 = JSON.parse(readFileSync(hp, "utf8"));
    expect(h1.status).toBe("TIMEOUT");
    expect(h1.recovery.residue_ref).toMatch(/^[0-9a-f]{40}$/); // settleResidue output rides the carrier
    expect(h1.recovery.stash_message).toBe("cdd-implement-task-task-1-r1-over-budget");
    expect(h1.recovery.residue_scope).toMatch(/file changed/); // scope data-driven from git shortstat
    expect(existsSync(path.join(repo, "wip.md"))).toBe(false); // salvage moved the WIP OUT of the tree
    // T28 dual-trigger black-box (spec T7.7): the implement lane's inline settleResidue pre-wrote
    // preserved=true, so the base settleResidue template hook's adapter (which follows in
    // post-flight, same carrier) sees recovery.preserved and idempotently skips — an implement
    // TIMEOUT round writes EXACTLY ONE stash, never two (the pre-T28 double-owner defect produced
    // a second, bespoke-message stash for the same round).
    expect(h1.recovery.preserved).toBe(true);
    expect(
      execFileSync("git", ["-C", repo, "stash", "list"], { encoding: "utf8" })
        .trim()
        .split("\n")
        .filter(Boolean),
    ).toHaveLength(1);
    // Round 2 agent: continues on the restored WIP (increment), commits, returns the block.
    writeFileSync(path.join(binDir, "fake-cli"), continuingCli(ws));
    chmodSync(path.join(binDir, "fake-cli"), 0o755);
    const res2 = await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      termination: { budgetMs: 5000 },
      registryPath: regPath,
      noExit: true,
    });
    expect(res2.exitCode).toBe(0);
    const h2 = JSON.parse(readFileSync(hp, "utf8"));
    expect(h2.status).toBe("APPROVED");
    expect(h2.artifacts.brief).toBe(path.join(ws, "tasks-1-brief.md"));
    // WIP restored AND extended — 续作（increment on top）, not a rewrite from zero
    expect(readFileSync(path.join(repo, "wip.md"), "utf8")).toBe(
      "line2-round1-agent-wip\nline3-agent-increment\n",
    );
    // the regenerated brief carries the data-driven residue appendix (status/cause/stash/scope)
    const brief = readFileSync(path.join(ws, "tasks-1-brief.md"), "utf8");
    expect(brief).toContain("## Residue status from the previous dispatch");
    expect(brief).toContain("ended in TIMEOUT (cause: over-budget)");
    expect(brief).toContain("cdd-implement-task-task-1-r1-over-budget");
    expect(brief).toContain("1 file changed, 1 insertion(+)");
    // apply ≠ pop — the salvage stays in the stash list for the operator to inspect/drop
    expect(execFileSync("git", ["-C", repo, "stash", "list"], { encoding: "utf8" })).toContain(
      "cdd-implement-task-task-1-r1-over-budget",
    );
  } finally {
    restore();
  }
}, 30_000);

it("T26 black-box: legacy fallback — pre-schema TIMEOUT carrier (no recovery) + standardized stash → scan → apply → appendix", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  configureGitIdentity(repo);
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-rr-legacy-"));
  const regPath = ghostRegistry(ws);
  const restore = withFakeCli(
    binDir,
    "fake-cli",
    `#!/usr/bin/env bash\nprintf 'legacy-wip\n' > wip.md\ngit add wip.md\nexec sleep 100\n`,
  );
  try {
    await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      termination: { budgetMs: 1000 },
      registryPath: regPath,
      noExit: true,
    });
    const hp = path.join(ws, "tasks-1-implement.json");
    const h1 = JSON.parse(readFileSync(hp, "utf8"));
    expect(h1.recovery.residue_ref).toMatch(/^[0-9a-f]{40}$/);
    // 模拟 pre-schema carrier：T25 时代的 TIMEOUT handoff 无 recovery 键（settleResidue 未落地、
    // ref 未入 schema），仅 status + failure_category 机制面。
    delete h1.recovery;
    writeFileSync(hp, JSON.stringify(h1));
    // Round 2: swap in the continuing agent, then re-dispatch.
    writeFileSync(path.join(binDir, "fake-cli"), continuingCli(ws));
    chmodSync(path.join(binDir, "fake-cli"), 0o755);
    const res2 = await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      termination: { budgetMs: 5000 },
      registryPath: regPath,
      noExit: true,
    });
    expect(res2.exitCode).toBe(0);
    // 检索兜底命中 standardized stash message → WIP 恢复（resume input = stash@{0} list ref）
    expect(readFileSync(path.join(repo, "wip.md"), "utf8")).toBe(
      "legacy-wip\nline3-agent-increment\n",
    );
    const brief = readFileSync(path.join(ws, "tasks-1-brief.md"), "utf8");
    expect(brief).toContain("## Residue status from the previous dispatch");
    expect(brief).toContain("stash@{0}"); // legacy resume keyed on the list ref (no index-independent SHA)
    expect(brief).toContain("cdd-implement-task-task-1-r1-over-budget");
  } finally {
    restore();
  }
}, 30_000);

// ---- Scope ledger black-box (T27, spec T7.6) ----
// Real dispatch through the ghost fake-cli: the resume-signature round (materialization base==head)
// whose return block DECLARES the true scope start must see that base adopted as commits.base and
// moved strictly earlier in the ledger → the next review therefore renders REVIEW_REFERENCE =
// `declared..HEAD` (the T26 fix: a non-empty real range, never the collapse). Fresh implement
// (base≠head) never adopts, and a normal task's review/fix REVIEW_REFERENCE is bit-identical to the
// legacy chain (ledger == carrier base) — zero behavior change. REVIEW_REFERENCE is observed via
// the rendered prompt (last CLI arg), the same seam the Pζ T3 fixed-point tests use.

describe("T27 scope ledger black-box（spec T7.6）", () => {
  it("resume declared base → carrier adopts + ledger moves earlier → next review REVIEW_REFERENCE = declared..HEAD", async () => {
    const { repo, planFile, ws } = setupWorkspace();
    configureGitIdentity(repo);
    const t0 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    // Dead round's deliverable already landed on HEAD (the T26 defect shape: the re-dispatch brief
    // TASK_BASE == HEAD). The resume round makes no new commit; it DECLARES the true scope start t0.
    writeFileSync(path.join(repo, "wip.md"), "line2-round1-agent-wip\n");
    execFileSync("git", ["-C", repo, "add", "wip.md"]);
    execFileSync("git", ["-C", repo, "commit", "-qm", "round-1 deliverable"]);
    const t1 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(t0).not.toBe(t1);

    const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t27-resume-"));
    const regPath = ghostRegistry(ws);
    const hp = path.join(ws, "tasks-1-implement.json");
    const restore = withFakeCli(
      binDir,
      "fake-cli",
      `#!/usr/bin/env bash\n` +
        `printf 'status: APPROVED\\ncommits: base=${t0} head=${t1}\\n'\n` +
        `printf 'artifacts: brief=${path.join(ws, "tasks-1-brief.md")}\\nblocker: none\\n'\n` +
        `exit 0\n`,
    );
    try {
      const res1 = await TaskLifecycle.run("ghost", 1, {
        mode: "implement",
        planFile,
        root: repo,
        registryPath: regPath,
        noExit: true,
      });
      expect(res1.exitCode).toBe(0);
      const h1 = JSON.parse(readFileSync(hp, "utf8"));
      expect(h1.commits.base).toBe(t0); // declared base adopted (!= HEAD, HEAD ancestor, base==head)
      expect(h1.commits.head).toBe(t1);
      const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
      expect(progress.tasks[0].scope_base).toBe(t0); // ledger seeded at base(t1) then moved to t0
      // Next review: fixed point = ledger t0 → REVIEW_REFERENCE `t0..HEAD` (t0..t1 — non-empty real
      // range over the deliverable, the exact T26 collapse this task kills).
      const promptLog = path.join(ws, "t27-resume-review-prompt.txt");
      writeFileSync(
        path.join(binDir, "fake-cli"),
        `#!/usr/bin/env bash\nprintf '%s' "\${@: -1}" > "${promptLog}"\nprintf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "${path.join(ws, "tasks-1-review-1.json")}"\nexit 0\n`,
      );
      chmodSync(path.join(binDir, "fake-cli"), 0o755);
      const res2 = await TaskLifecycle.run("ghost", 1, {
        mode: "review",
        planFile,
        root: repo,
        registryPath: regPath,
        noExit: true,
      });
      expect(res2.exitCode).toBe(0);
      expect(existsSync(promptLog)).toBe(true);
      expect(readFileSync(promptLog, "utf8")).toContain(`${t0}..HEAD`);
    } finally {
      restore();
    }
  }, 30_000);

  it("fresh implement (base≠head) never adopts a declared valid-earlier base → carrier keeps brief TASK_BASE", async () => {
    const { repo, planFile, ws } = setupWorkspace();
    configureGitIdentity(repo);
    const t0 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    // Pre-dispatch commit so the fresh brief TASK_BASE (t1) differs from the agent-declared base
    // (t0, a legitimate earlier ancestor) — makes the rejection observable: had the fresh lane
    // (wrongly) adopted, carrier base would be t0, not t1.
    writeFileSync(path.join(repo, "wip.md"), "pre-existing\n");
    execFileSync("git", ["-C", repo, "add", "wip.md"]);
    execFileSync("git", ["-C", repo, "commit", "-qm", "pre-dispatch setup"]);
    const t1 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

    const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t27-fresh-"));
    const regPath = ghostRegistry(ws);
    const hp = path.join(ws, "tasks-1-implement.json");
    const restore = withFakeCli(
      binDir,
      "fake-cli",
      `#!/usr/bin/env bash\n` +
        `printf 'fresh-agent-work\\n' >> wip.md\n` +
        `git add wip.md\n` +
        `git -c user.name=cdd-test -c user.email=cdd-test@example.com commit -qm "fresh implement round"\n` +
        `printf 'status: APPROVED\\ncommits: base=${t0} head=$(git rev-parse HEAD)\\n'\n` +
        `printf 'artifacts: brief=${path.join(ws, "tasks-1-brief.md")}\\nblocker: none\\n'\n` +
        `exit 0\n`,
    );
    try {
      const res = await TaskLifecycle.run("ghost", 1, {
        mode: "implement",
        planFile,
        root: repo,
        registryPath: regPath,
        noExit: true,
      });
      expect(res.exitCode).toBe(0);
      const h = JSON.parse(readFileSync(hp, "utf8"));
      expect(h.commits.base).toBe(t1); // brief TASK_BASE authority; base!=head closes the adoption lane
      expect(h.commits.base).not.toBe(t0); // the valid t0 declaration is never adopted on a fresh round
      const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
      expect(progress.tasks[0].scope_base).toBe(t1); // ledger seeded at the brief base (earliest-wins)
    } finally {
      restore();
    }
  }, 30_000);

  it("normal task (no recovery): review AND fix REVIEW_REFERENCE unchanged — ledger == legacy chain (zero behavior change)", async () => {
    const { repo, planFile, ws } = setupWorkspace();
    configureGitIdentity(repo);
    const t0 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const binDir = mkdtempSync(path.join(tmpdir(), "cdd-t27-normal-"));
    const regPath = ghostRegistry(ws);
    const hp = path.join(ws, "tasks-1-implement.json");

    // Implement: a plain round committing work, declaring the brief base (the perfectly normal shape).
    const restore = withFakeCli(
      binDir,
      "fake-cli",
      `#!/usr/bin/env bash\n` +
        `printf 'impl-work\\n' >> wip.md\n` +
        `git add wip.md\n` +
        `git -c user.name=cdd-test -c user.email=cdd-test@example.com commit -qm "implement round"\n` +
        `printf 'status: APPROVED\\ncommits: base=${t0} head=$(git rev-parse HEAD)\\n'\n` +
        `printf 'artifacts: brief=${path.join(ws, "tasks-1-brief.md")}\\nblocker: none\\n'\n` +
        `exit 0\n`,
    );
    try {
      const resI = await TaskLifecycle.run("ghost", 1, {
        mode: "implement",
        planFile,
        root: repo,
        registryPath: regPath,
        noExit: true,
      });
      expect(resI.exitCode).toBe(0);
      const h = JSON.parse(readFileSync(hp, "utf8"));
      expect(h.commits.base).toBe(t0); // legacy authority on a normal task
      const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
      expect(progress.tasks[0].scope_base).toBe(t0); // ledger = brief base — identical to the chain

      // Review round: fixed point = ledger t0 (legacy chain would also read t0 — no observable delta).
      const promptLogR = path.join(ws, "t27-normal-review-prompt.txt");
      writeFileSync(
        path.join(binDir, "fake-cli"),
        `#!/usr/bin/env bash\nprintf '%s' "\${@: -1}" > "${promptLogR}"\nprintf '%s' '{"tasks":[1],"phase":"review","status":"APPROVED","findings":[],"artifacts":{}}' > "${path.join(ws, "tasks-1-review-1.json")}"\nexit 0\n`,
      );
      chmodSync(path.join(binDir, "fake-cli"), 0o755);
      const resR = await TaskLifecycle.run("ghost", 1, {
        mode: "review",
        planFile,
        root: repo,
        registryPath: regPath,
        noExit: true,
      });
      expect(resR.exitCode).toBe(0);
      expect(readFileSync(promptLogR, "utf8")).toContain(`${t0}..HEAD`);

      // Fix round: same ledger-first fixed point → `t0..HEAD` again (no review-findings churn).
      const promptLogF = path.join(ws, "t27-normal-fix-prompt.txt");
      writeFileSync(
        path.join(binDir, "fake-cli"),
        `#!/usr/bin/env bash\n` +
          `printf '%s' "\${@: -1}" > "${promptLogF}"\n` +
          `printf '%s' '{"tasks":[1],"phase":"fix","status":"APPROVED","commits":{"base":"'${t0}'","head":"'${h.commits.head}'"},"findings":[],"artifacts":{"report":"r.md"}}' > "${path.join(ws, "tasks-1-fix-1.json")}"\n` +
          `printf 'status: APPROVED\\ncommits: base=${t0} head=${h.commits.head}\\n'\n` +
          `printf 'artifacts: report=r.md\\nblocker: none\\n'\n` +
          `exit 0\n`,
      );
      chmodSync(path.join(binDir, "fake-cli"), 0o755);
      const resF = await TaskLifecycle.run("ghost", 1, {
        mode: "fix",
        planFile,
        root: repo,
        registryPath: regPath,
        noExit: true,
      });
      expect(resF.exitCode).toBe(0);
      expect(existsSync(promptLogF)).toBe(true);
      // The fix template carries the fixed-point in the `FIXED_POINT` round-context slot (the
      // REVIEW_REFERENCE range composition is review-only) — the ledger value lands there unchanged.
      expect(readFileSync(promptLogF, "utf8")).toContain(`\`FIXED_POINT\`: ${t0}`);
      const fixHandoff = JSON.parse(readFileSync(path.join(ws, "tasks-1-fix-1.json"), "utf8"));
      expect(fixHandoff.commits.base).toBe(t0);
    } finally {
      restore();
    }
  }, 30_000);
});
