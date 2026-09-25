// packages/cdd-engine/src/cli/__tests__/cdd.test.ts
// 覆盖：帮助/用法、review 的 round+Convergence 接线（dry-run smoke）、fix --findings 接线、
// contract 模块转发。黑盒用例经 argv 前置 `--dry-run` 跳过真实 harness 调用；in-process 用例经
// setDryRun(true) 注入（argv 对它们物理不适用）。

import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execaSync } from "execa";
import { afterAll, describe, expect, it, vi } from "vitest";
import { ExitRequested } from "../../infra/exit.ts";
import { DRY_RUN_DIRTY_WARN } from "../../rules/commit.ts";
import { setDryRun } from "../shared.ts";

// Repo-root derivation via fileURLToPath (task.test.mjs convention) — no hardcoded machine
// path, so the suite also passes under CI checkouts (STD-4). CDD_MJS must be absolute:
// contract tests switch cwd to a temp repo and a relative path would break there.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const CDD_MJS = path.join(REPO_ROOT, "packages/cdd-engine/dist/cli.mjs");
const SMOKE_PLAN = "packages/cdd-engine/src/cli/__tests__/fixtures/smoke-plan.md";
// SMOKE_PLAN's derived workspace is .osuperpowers/cdd/smoke/ (the engine workspaceSlug strips a
// trailing -plan: smoke-plan.md → smoke) — a T10 warn. Do not clean smoke/: the engine creates
// the workspace while running tests, and cli-shape / docs-task / host-detection / lifecycle.wiring
// share the same slug — an afterAll delete in any one file races the other files' brief
// self-supply (directory removed between resolveWorkspace's mkdirSync and generateBrief's write
// → ENOENT false red; reproduced in this repo). `.osuperpowers` is gitignored, so residue never
// pollutes the version tree — only clean the slug exclusive to this file.
afterAll(() => {
  rmSync(path.join(REPO_ROOT, ".osuperpowers", "cdd", "plan"), { recursive: true, force: true }); // 其他 fixture slug
});
const NODE = process.execPath;

// Test env: strip 任何从 orchestrator session 继承的 CDD_*，再叠加测试 extras（与 task.test.mjs 一致）。
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra };
}

function runCli(args = [], opts = {}) {
  const { env: extraEnv = {}, cwd = REPO_ROOT, noHost = false } = opts;
  const env = cleanEnv(extraEnv);
  // Host detection is ambient-env driven (CLAUDE_CODE_SESSION_ID / AI_AGENT) — a no-host case
  // must explicitly delete the three host markers; stripping CDD_* alone leaks detection through
  // the parent session (see host-detection.test.mjs B1 blocker) (T3).
  if (noHost) {
    delete env.CLAUDE_CODE_SESSION_ID;
    delete env.CURSOR_TRACE_ID;
    delete env.AI_AGENT;
  }
  try {
    // extendEnv:false —— execa 默认 extendEnv:true 会把父进程 env 合入 child，覆盖 cleanEnv 的
    // CDD_* 剥离（orchestrator 携带的 CDD_* 键泄漏回测试 child，T8 回归：秒值 ×1000 溢出 setTimeout
    // 32 位上限 → ~1ms 瞬时 SIGTERM → 非 dry-run 用例确定性 FAIL；T26 三超时键已删，机理由整族
    // CDD_* 键承担）。关闭 extendEnv 后 child 只见 cleanEnv 显式清单，测试与调度侧环境变量零耦合。
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd, env, encoding: "utf8", extendEnv: false });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    return { exitCode: e.exitCode ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

// Unit seam: vi.mock the docs-runner's dynamic import to assert directly what runReview/runFix
// passes to DocsLifecycle — handoffPath/workspace/findingsPath (canonical derived naming) (P6 T3).
// review.ts/fix.ts load `await import("../../dispatch/docs.ts")` dynamically and call the class
// public face DocsLifecycle.run (Task 7 ② export reorder — runDocsTask is no longer a bare
// export), so vitest intercepts the same module by resolved id and surfaces `run` as the static
// face. CLI black-box cases run as standalone node child processes and bypass this mock.
const docsRunnerMock = vi.hoisted(() => ({
  run: vi.fn(async () => ({
    exitCode: 0,
    handoff: { phase: "review", status: "APPROVED", findings: [], artifacts: {}, doc_path: "" },
  })),
}));
vi.mock("../../dispatch/docs.ts", () => ({
  DocsLifecycle: { run: docsRunnerMock.run },
}));

// 根权威（src/infra/root.ts）在本文件**不再打桩**：in-process 用例一律经 `root` 注入位（T3 根注入契约：
// 无 reset / 无 env / 无 ForTest 缝）显式传入真仓路径，getRoot() 单例在这些路径上不再被消费。
// 黑盒用例走独立 node 子进程，由 bin 的 preAction → initRoot() 初始化真实单例。

describe("cdd CLI", () => {
  it("-h → help", () => {
    const r = execaSync(NODE, [CDD_MJS, "--help"], {
      cwd: REPO_ROOT,
      env: cleanEnv(),
      extendEnv: false,
    });
    expect(r.stdout).toMatch(/implement\/review\/fix\/base-branch/);
    expect(r.stdout).not.toMatch(/\bbrief\b|\bresearch\b/);
  });

  it("review missing --type → usage exit 2", () => {
    expect(() =>
      execaSync(NODE, [CDD_MJS, "review"], { cwd: REPO_ROOT, env: cleanEnv(), extendEnv: false }),
    ).toThrow(/required option|--type/);
  });

  it("dry-run review --type task → return block + exit 0", () => {
    const r = runCli(
      ["--dry-run", "review", "--type", "task", "--tasks", "1", "--plan", SMOKE_PLAN],
      { env: { CLAUDE_CODE_SESSION_ID: "1" } },
    );
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/status: APPROVED/);
  });

  it("dry-run review --type branch → return block + exit 0（随机 base/head 避免 Review Convergence 误拒；tmp git repo 内 plan 供 resolveWorkspace 推导，避免向真实 workspace 写副作用）", () => {
    const base = `base${Date.now().toString(16).slice(-4)}`;
    const head = `head${Date.now().toString(16).slice(-8, -4)}`;
    const dir = tmpGitRepo();
    try {
      const tmpPlan = path.join(dir, "plan.md");
      writeFileSync(tmpPlan, "### Task 1:\n- base: develop\n");
      const r = runCli(
        [
          "--dry-run",
          "review",
          "--type",
          "branch",
          "--plan",
          tmpPlan,
          "--base",
          base,
          "--head",
          head,
        ],
        { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: "1" } },
      );
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/status: APPROVED/);
      expect(r.stdout).toMatch(new RegExp(`commits: base=${base} head=${head}`));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("dry-run review --type spec → exit 0 + stdout result face（docs-family 结果面，AC9）", () => {
    // Design §2.9: the docs review completion prints the one-line stdout result face — the
    // orchestrator routes on the `status:`/`blocker:` line without opening the handoff file.
    const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", SMOKE_PLAN], {
      env: { CLAUDE_CODE_SESSION_ID: "1" },
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/status: APPROVED/);
    expect(r.stdout).toMatch(/· blocker: 0/);
    expect(r.stdout).toMatch(/· handoff:/);
  });

  it("dry-run fix --type task → return block + exit 0", () => {
    const r = runCli(
      [
        "--dry-run",
        "fix",
        "--type",
        "task",
        "--tasks",
        "1",
        "--findings",
        SMOKE_PLAN,
        "--plan",
        SMOKE_PLAN,
      ],
      { env: { CLAUDE_CODE_SESSION_ID: "1" } },
    );
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/status: APPROVED/);
  });

  it("fix --type spec|plan 非 dry-run：无 host env → CDD_BLOCKED exit 1（T3 — 无 harness 停闸，host 由环境判定）", () => {
    // 原"unknown harness 停闸"用例已随 harness 参数删除淘汰：entry 层 host 判定为空即 BLOCK，
    // 不再存在未知 harness 需停闸（host 必然是 claude/cursor-agent 两合法键）——T3 改断言无-host BLOCK。
    // 保留 not.toMatch(/template/)：BLOCK 消息不得来自 doc-fix 模板渲染错误。
    for (const [type, reviewFile] of [
      ["spec", "spec-review-1.json"],
      ["plan", "plan-review-1.json"],
    ]) {
      // D11 target param: type=spec → --spec, type=plan → --plan（type 自解释）。
      const targetParam = type === "spec" ? "--spec" : "--plan";
      const r = runCli(
        [
          "fix",
          "--type",
          type,
          targetParam,
          SMOKE_PLAN,
          "--findings",
          path.join(REPO_ROOT, ".osuperpowers", "cdd", "smoke", reviewFile),
        ],
        { noHost: true },
      );
      expect(r.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
      expect(r.stderr).not.toMatch(/template/);
    }
  });

  it("review --type spec 非 dry-run：无 host env → CDD_BLOCKED exit 1（原 harness-gate 停闸用例，T3 改断言）", () => {
    // runDocsTask 原在 harness gate 前 render 共享壳 review.md；host 判定现于 entry 先发 BLOCK。
    // 渲染崩（缺参/模板缺失）→ stderr 出现 template → not.toMatch(/template/) 仍拦截。
    const r = runCli(["review", "--type", "spec", "--spec", SMOKE_PLAN], { noHost: true });
    expect(r.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
    expect(r.stderr).not.toMatch(/template/);
  });

  it("review --type branch 缺 --base/--head → 必填守卫 exit 2（SP-2）", () => {
    const r = runCli(["--dry-run", "review", "--type", "branch", "--plan", SMOKE_PLAN], {
      env: { CLAUDE_CODE_SESSION_ID: "1" },
    });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/--base/);
  });

  it("review --type plan 非 dry-run：无 host env → CDD_BLOCKED exit 1（原 harness-gate 停闸用例，T3 改断言）", () => {
    // Plan review once rendered through the shared review.md shell and stopped at the harness
    // gate (Task 4); after that the host-check entry BLOCKs first (T3). --spec stays an optional
    // parameter; both call shapes must hit CDD_BLOCKED (exit 1), not a render crash.
    const r = runCli(["review", "--type", "plan", "--plan", SMOKE_PLAN], { noHost: true });
    expect(r.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
    expect(r.stderr).not.toMatch(/template/);
    const r2 = runCli(["review", "--type", "plan", "--plan", SMOKE_PLAN, "--spec", SMOKE_PLAN], {
      noHost: true,
    });
    expect(r2.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
    expect(r2.stderr).not.toMatch(/template/);
  });

  it("dry-run review --type plan --spec → exit 0（SP-3 --spec 接线）", () => {
    const r = runCli(
      ["--dry-run", "review", "--type", "plan", "--plan", SMOKE_PLAN, "--spec", SMOKE_PLAN],
      { env: { CLAUDE_CODE_SESSION_ID: "1" } },
    );
    expect(r.exitCode).toBe(0);
  });

  it("--tasks non-integer token → parse-layer rejection exit 2 (Bug A regression, upgraded message)", () => {
    // parseInt NaN must not leak into runTask (task-NaN-* garbage + fake APPROVED return block);
    // the parse layer rejects at parse time → exit 2 (legacy cdd-task contract; P4.3 list model).
    const r = runCli(
      ["--dry-run", "review", "--type", "task", "--tasks", "abc", "--plan", SMOKE_PLAN],
      { env: { CLAUDE_CODE_SESSION_ID: "1" } },
    );
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/must be comma-separated integers: abc/);
  });

  // --- SP-4 Review Convergence status criterion: a BLOCKED/TIMEOUT failure round (findings:[])
  //     must remain re-dispatchable; only an APPROVED round with blocker=0 stops a re-run. ---

  // Seed helper: temp git repo + plan file + a seeded task-N-review-N.json round.
  function seedTaskReviewHandoff(status) {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-stop-"));
    execaSync("git", ["-C", dir, "init", "-q"]);
    execaSync("git", [
      "-C",
      dir,
      "-c",
      "user.name=cdd-test",
      "-c",
      "user.email=cdd-test@example.com",
      "commit",
      "--allow-empty",
      "-qm",
      "fixture",
    ]);
    // Dispatch entry gate (pre-commit clean tree): the workspace is absorbed into .gitignore
    // (mirroring the repo-root .osuperpowers ignore rule) and the plan committed; subsequent
    // hand-written handoff overwrites keep the tree clean (Task 8).
    writeFileSync(path.join(dir, ".gitignore"), ".osuperpowers/\n");
    const plan = path.join(dir, "zz-stop-test.md");
    writeFileSync(plan, "### Task 1: fixture\n");
    const ws = path.join(dir, ".osuperpowers", "cdd", "zz-stop-test");
    mkdirSync(ws, { recursive: true });
    writeFileSync(
      path.join(ws, "tasks-1-review-1.json"),
      JSON.stringify({
        tasks: [1],
        phase: "review",
        status,
        artifacts: {},
        findings: [],
        ...(status !== "APPROVED" ? { blocker: "boom" } : {}),
      }),
    );
    // 入口门干净树：种子提交（workspace 已收编 .gitignore；后续手写 handoff 覆写不弄脏树）。
    execaSync("git", ["-C", dir, "add", "-A"]);
    execaSync("git", [
      "-C",
      dir,
      "-c",
      "user.name=cdd-test",
      "-c",
      "user.email=cdd-test@example.com",
      "commit",
      "-qm",
      "seed",
    ]);
    return { dir, plan };
  }

  it("review --type task：status:BLOCKED 失败轮 → 可重派（SP-4）", () => {
    const { dir, plan } = seedTaskReviewHandoff("BLOCKED");
    try {
      const r = runCli(["--dry-run", "review", "--type", "task", "--tasks", "1", "--plan", plan], {
        cwd: dir,
        env: { CLAUDE_CODE_SESSION_ID: "1" },
      });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/status: APPROVED/);
      expect(r.stderr).not.toMatch(/already APPROVED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("review --type task：status:APPROVED + blocker=0 已通过轮 → 拒绝重派 exit 3（SP-4 保留 Convergence）", () => {
    const { dir, plan } = seedTaskReviewHandoff("APPROVED");
    try {
      const r = runCli(["--dry-run", "review", "--type", "task", "--tasks", "1", "--plan", plan], {
        cwd: dir,
        env: { CLAUDE_CODE_SESSION_ID: "1" },
      });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/already blocker=0 — Review Convergence/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---- `cdd contract` subcommand removed + branch-review read-back overwrite (T5 nit4 regression coverage; T8) ----

  it("cdd contract 子命令不存在（check-dirty/check-head/clear-findings 全灭）→ 未知命令 exit 2", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-cli-contract-"));
    try {
      execaSync("git", ["-C", dir, "init", "-q"]);
      execaSync("git", [
        "-C",
        dir,
        "-c",
        "user.name=cdd-test",
        "-c",
        "user.email=cdd-test@example.com",
        "commit",
        "--allow-empty",
        "-qm",
        "fixture",
      ]);
      // 已删除子命令不得仍可调用（旧 contract --check-dirty 会 exit 0）
      for (const args of [
        ["contract", "--check-dirty"],
        ["contract", "--check-head"],
        ["contract", "--clear-findings"],
        ["contract"],
      ]) {
        const r = runCli(args, { cwd: dir });
        expect(r.exitCode).not.toBe(0);
        expect(r.stderr).toMatch(/usage: cdd/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("branch-review 读回定稿（T5/T7 finalizeHandoff 单点）：fake harness CLI 写 warn-only CHANGES_REQUESTED branch-review handoff → 引擎覆写为 REVIEW_FIX（Task 8 收口态）", () => {
    const dir = tmpGitRepo();
    try {
      const plan = path.join(dir, "plan.md");
      writeFileSync(plan, "### Task 1:\n- base: develop\n");
      const binDir = mkdtempSync(path.join(tmpdir(), "cdd-br-fake-"));
      const ws = path.join(dir, ".osuperpowers", "cdd", "plan");
      const handoffPath = path.join(ws, "branch-review-eeee555..ffff666-r1.json");
      // fake claude：PATH 遮蔽 registry cli 名（cdd.mjs REG_PATH 无 registry override seam）。
      // 非 dry-run 真实走 runReview（branch 通道并入组合根）：agent 写 warn-only CHANGES_REQUESTED
      // → engine finalizeHandoff（三消费方共享定稿单点）rollup 派生覆写 REVIEW_FIX + writeOwnHandoff 持久化。
      writeFileSync(
        path.join(binDir, "claude"),
        "#!/usr/bin/env bash\n" +
          `mkdir -p "${ws}"\n` +
          `printf '%s' '{"tasks":[1],"phase":"branch-review","status":"CHANGES_REQUESTED","findings":[{"severity":"warn","summary":"w"}],"artifacts":{}}' > "${handoffPath}"\n` +
          "exit 0\n",
      );
      chmodSync(path.join(binDir, "claude"), 0o755);
      const r = runCli(
        ["review", "--type", "branch", "--plan", plan, "--base", "eeee555", "--head", "ffff666"],
        {
          cwd: dir,
          env: {
            PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
            CLAUDE_CODE_SESSION_ID: "1",
          },
        },
      );
      expect(r.exitCode).toBe(0);
      const h = JSON.parse(readFileSync(handoffPath, "utf8"));
      // warn/nit = 0 blocker → status 被 finalizeHandoff（applyDerivedStatus rollup）覆写为 REVIEW_FIX（收口态）
      expect(h.status).toBe("REVIEW_FIX");
      expect(h.findings).toEqual([{ severity: "warn", summary: "w" }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- Docs naming unified (P6 T3): spec/plan/branch handoff goes through the derived layer (canonical naming + resolveWorkspace) ----
// The unit seam (docsRunnerMock) asserts the handoffPath/workspace that runReview/runFix passes to runDocsTask;
// CLI black-box drives Review Convergence / rounds with canonical seeds, verifying naming + workspace wiring end to end.

// 临时 git 仓库：供 resolveWorkspace 推导 git root；每个用例独立 seed，不留真实 repo 副作用。
function tmpGitRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-p6-"));
  execaSync("git", ["-C", dir, "init", "-q"]);
  execaSync("git", [
    "-C",
    dir,
    "-c",
    "user.name=cdd-test",
    "-c",
    "user.email=cdd-test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  ]);
  // Dispatch entry gate: workspace absorbed into .gitignore, the seeded doc/plan committed
  // (later handoff overwrites do not dirty the tree) (Task 8).
  writeFileSync(path.join(dir, ".gitignore"), ".osuperpowers/\n");
  return dir;
}

// seed 一条 canonical <type>-review-1.json（status APPROVED + blocker=0）→ 命中 Review Convergence。
// ws = <repo>/.osuperpowers/cdd/foo —— 覆盖 spec（foo-design.md 去 -design）与 plan（foo.md）同 slug 收敛。
// doc 父目录一并创建：resolveWorkspace 从 dirname(doc) 走 gitToplevel，父目录缺失会回退失败。
// content 实写 doc 文件（hashFile 读实时文件）：默认 content="" → 既有 legacy seed 调用写空 doc，
// 语义（status APPROVED + blocker=0）不变仍 exit 3；docHash 显式传入才落 handoff.doc_hash。
function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}
function seedDocsReviewRound(repo, doc, fileName, { docHash, content = "" } = {}) {
  const ws = path.join(repo, ".osuperpowers", "cdd", "foo");
  mkdirSync(path.dirname(doc), { recursive: true });
  mkdirSync(ws, { recursive: true });
  writeFileSync(doc, content); // hashFile 读实时文件——内容由用例显式控制
  const handoff = {
    task: 0,
    phase: "review",
    status: "APPROVED",
    findings: [],
    artifacts: {},
    doc_path: doc,
  };
  if (docHash) handoff.doc_hash = docHash;
  writeFileSync(path.join(ws, fileName), JSON.stringify(handoff));
  // 入口门干净树：种子内容提交（workspace 已被 .gitignore 收编；handoff 后续覆写不弄脏树）。
  execaSync("git", ["-C", repo, "add", "-A"]);
  execaSync("git", [
    "-C",
    repo,
    "-c",
    "user.name=cdd-test",
    "-c",
    "user.email=cdd-test@example.com",
    "commit",
    "-qm",
    "seed",
  ]);
  return ws;
}

describe("P6 T3: docs handoff 命名走派生层", () => {
  // ---- 单元 seam：runReview/runFix（cdd.mjs 导出）→ mocked runDocsTask 参数断言 ----
  // 合规通道（P4 §2.3.1 根注入契约）：真仓（mkdtemp + gitInit）+ 真 doc + `root: repo` 注入。
  // 假路径 `/repo/root/docs/...` 在 T2 后必红（resolveDocArg 查盘 → exit 1 打死 worker），故全部作废。
  // dry-run 通道：in-process 不解析 argv（program 级 `--dry-run` 对其物理不适用），故经
  // `setDryRun(true)` 注入模块态，finally 内 `setDryRun(false)` 复位（防模块态泄漏到同文件其它用例）。

  it("review --type spec → runDocsTask handoffPath=<ws>/spec-review-1.json + workspace=<ws>（canonical 派生命名，非 flat-root/旧体）", async () => {
    const repo = tmpGitRepo();
    setDryRun(true);
    process.env.CLAUDE_CODE_SESSION_ID = "1"; // in-process seam: runReview resolves host from process.env
    try {
      const doc = path.join(repo, "docs/osuperpowers/specs/foo-design.md");
      mkdirSync(path.dirname(doc), { recursive: true });
      writeFileSync(doc, "# foo design\n");
      const { runReview } = await import("../review.ts");
      // D11: type=spec target param is --spec (opts.spec); opts.doc retired.
      // Docs review completion now routes through the exit helper (result face + ExitRequested):
      // the mocked runDocsTask returns exitCode 0 → exitOkWith(face) throws ExitRequested(0).
      let exitCode: number | null = null;
      try {
        await runReview({ type: "spec", spec: doc, root: repo });
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      expect(exitCode).toBe(0);
      const call = docsRunnerMock.run.mock.calls.at(-1)?.[0] ?? {};
      const ws = path.join(repo, ".osuperpowers", "cdd", "foo");
      expect(call.handoffPath).toBe(path.join(ws, "spec-review-1.json"));
      expect(call.workspace).toBe(ws);
    } finally {
      setDryRun(false);
      delete process.env.CLAUDE_CODE_SESSION_ID;
      docsRunnerMock.run.mockClear();
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("resolveWorkspace: plan foo.md 与 spec foo-design.md 收敛同一 workspace", async () => {
    const { resolveWorkspace } = await import("../../artifacts/handoff/naming.ts");
    // root 显式注入（不调 initRoot()、不 chdir）——POSIX 路径字面量，无盘上依赖。
    expect(resolveWorkspace("/repo/root/docs/osuperpowers/plans/foo.md", "/repo/root")).toBe(
      "/repo/root/.osuperpowers/cdd/foo",
    );
    expect(resolveWorkspace("/repo/root/docs/osuperpowers/specs/foo-design.md", "/repo/root")).toBe(
      "/repo/root/.osuperpowers/cdd/foo",
    );
  });

  it("fix --findings spec-review-2.json → runDocsTask handoffPath=<ws>/spec-fix-2.json（round 从 findings 名经 roundPattern 解析）", async () => {
    const repo = tmpGitRepo();
    setDryRun(true);
    process.env.CLAUDE_CODE_SESSION_ID = "1"; // in-process seam: runFix resolves host from process.env
    try {
      const doc = path.join(repo, "docs/osuperpowers/specs/foo-design.md");
      mkdirSync(path.dirname(doc), { recursive: true });
      writeFileSync(doc, "# foo design\n");
      const findings = path.join(repo, ".osuperpowers", "cdd", "foo", "spec-review-2.json");
      mkdirSync(path.dirname(findings), { recursive: true });
      writeFileSync(findings, JSON.stringify({ status: "CHANGES_REQUESTED", findings: [] }));
      const { runFix } = await import("../fix.ts");
      // D11: type=spec target param is --spec (opts.spec); opts.doc retired.
      // Docs fix completion routes through the exit helper (result face + ExitRequested(0)).
      let exitCode: number | null = null;
      try {
        await runFix({ type: "spec", spec: doc, findings, root: repo });
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      expect(exitCode).toBe(0);
      const call = docsRunnerMock.run.mock.calls.at(-1)?.[0] ?? {};
      const ws = path.join(repo, ".osuperpowers", "cdd", "foo");
      expect(call.handoffPath).toBe(path.join(ws, "spec-fix-2.json"));
      expect(call.workspace).toBeUndefined(); // docs-runner no longer receives workspace (handoffPath is authoritative) — T3 r1 nit
      expect(call.findingsPath).toBe(findings);
    } finally {
      setDryRun(false);
      delete process.env.CLAUDE_CODE_SESSION_ID;
      docsRunnerMock.run.mockClear();
      rmSync(repo, { recursive: true, force: true });
    }
  });

  // ---- CLI 黑盒：canonical seed 驱动 Convergence / 轮次 ----

  it("review --type spec：canonical spec-review-1.json（doc_path 同 doc）于 .osuperpowers/cdd/foo/ → Convergence exit 3", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "docs", "foo-design.md");
      seedDocsReviewRound(dir, doc, "spec-review-1.json");
      const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", doc], {
        cwd: dir,
        env: { CLAUDE_CODE_SESSION_ID: "1" },
      });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/Review Convergence/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("review --type plan：canonical plan-review-1.json（doc_path 同 doc，foo.md → 同 slug foo）→ Convergence exit 3", () => {
    const dir = tmpGitRepo();
    try {
      const doc = path.join(dir, "plans", "foo.md");
      seedDocsReviewRound(dir, doc, "plan-review-1.json");
      const r = runCli(["--dry-run", "review", "--type", "plan", "--plan", doc], {
        cwd: dir,
        env: { CLAUDE_CODE_SESSION_ID: "1" },
      });
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/Review Convergence/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fix --type spec 缺 --findings（round 无源）→ exit 2 提示 <type>-review-{R}.json", () => {
    const r = runCli(["--dry-run", "fix", "--type", "spec", "--spec", SMOKE_PLAN], {
      env: { CLAUDE_CODE_SESSION_ID: "1" },
    });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/spec-review-\{R\}\.json/);
  });

  it("fix --findings spec-review-0.json（round<1）→ exit 2 拒（round 须 >= 1）", () => {
    const r = runCli(
      [
        "--dry-run",
        "fix",
        "--type",
        "spec",
        "--spec",
        SMOKE_PLAN,
        "--findings",
        path.join(REPO_ROOT, ".osuperpowers", "cdd", "smoke", "spec-review-0.json"),
      ],
      { env: { CLAUDE_CODE_SESSION_ID: "1" } },
    );
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/round must be >= 1/);
  });

  it("review --type branch 同 ref 已 APPROVED r1 → Convergence exit 3（prev 经 concrete base7..head7 匹配）", () => {
    const dir = tmpGitRepo();
    try {
      const plan = path.join(dir, "plan.md");
      writeFileSync(plan, "### Task 1:\n- base: develop\n");
      const wsPath = path.join(dir, ".osuperpowers", "cdd", "plan");
      mkdirSync(wsPath, { recursive: true });
      writeFileSync(
        path.join(wsPath, "branch-review-eeee555..ffff666-r1.json"),
        JSON.stringify({
          tasks: [1],
          phase: "branch-review",
          status: "APPROVED",
          findings: [],
          artifacts: {},
          blocker: "",
        }),
      );
      const r = runCli(
        [
          "--dry-run",
          "review",
          "--type",
          "branch",
          "--plan",
          plan,
          "--base",
          "eeee555",
          "--head",
          "ffff666",
        ],
        { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: "1" } },
      );
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toMatch(/Review Convergence/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("review --type branch 轮次 per-ref：他 ref 已有 r1 时，新 ref dry-run 产出 -r1（非全局递增 r2）", () => {
    const dir = tmpGitRepo();
    try {
      const plan = path.join(dir, "plan.md");
      writeFileSync(plan, "### Task 1:\n- base: develop\n");
      const wsPath = path.join(dir, ".osuperpowers", "cdd", "plan");
      mkdirSync(wsPath, { recursive: true });
      // 他 ref（aaaa111..bbbb222）已有 r1 —— 全局轮次已被推到 r2；新 ref 应各自从 r1 起（ref 名内嵌）。
      writeFileSync(path.join(wsPath, "branch-review-aaaa111..bbbb222-r1.json"), "{}");
      const newHead = "cccc333";
      const newBase = "dddd444";
      const r = runCli(
        [
          "--dry-run",
          "review",
          "--type",
          "branch",
          "--plan",
          plan,
          "--base",
          newBase,
          "--head",
          newHead,
        ],
        { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: "1" } },
      );
      expect(r.exitCode).toBe(0);
      expect(existsSync(path.join(wsPath, `branch-review-${newBase}..${newHead}-r1.json`))).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("P2 F5: spec/plan Convergence ref 内容状态维度（doc_hash 双签名矩阵）", () => {
    it("内容未变 + doc_hash 相等 + APPROVED+0 → exit 3（U1 保留；unchanged 消息，无旧 impossible 措辞）", () => {
      const dir = tmpGitRepo();
      try {
        const doc = path.join(dir, "docs", "foo-design.md");
        seedDocsReviewRound(dir, doc, "spec-review-1.json", {
          docHash: sha256("v1"),
          content: "v1",
        });
        const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", doc], {
          cwd: dir,
          env: { CLAUDE_CODE_SESSION_ID: "1" },
        });
        expect(r.exitCode).toBe(3);
        expect(r.stderr).toMatch(/already blocker=0 — Review Convergence/);
        expect(r.stderr).toMatch(/doc content unchanged/);
        expect(r.stderr).toMatch(/edit the doc content or open a new doc/);
        expect(r.stderr).not.toMatch(/change ref to open a new review/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("内容演进 + doc_hash 异 + APPROVED+0 → 放行新一轮（round 2 + CDD_INFO）", () => {
      const dir = tmpGitRepo();
      try {
        const doc = path.join(dir, "docs", "foo-design.md");
        seedDocsReviewRound(dir, doc, "spec-review-1.json", {
          docHash: sha256("v1"),
          content: "v2",
        }); // 内容实为 v2，旧 review 验的是 v1
        const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", doc], {
          cwd: dir,
          env: { CLAUDE_CODE_SESSION_ID: "1" },
        });
        expect(r.exitCode).toBe(0);
        expect(r.stderr).toMatch(/CDD_INFO: doc content changed since round-1 clean review/);
        expect(r.stderr).toMatch(/new review round 2/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("legacy handoff（无 doc_hash）+ APPROVED+0 → exit 3（内容状态未知硬停；legacy 消息不给改动指引）", () => {
      const dir = tmpGitRepo();
      try {
        const doc = path.join(dir, "docs", "foo-design.md");
        seedDocsReviewRound(dir, doc, "spec-review-1.json", { content: "v1" }); // 不传 docHash → legacy
        const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", doc], {
          cwd: dir,
          env: { CLAUDE_CODE_SESSION_ID: "1" },
        });
        expect(r.exitCode).toBe(3);
        expect(r.stderr).toMatch(/content state unknown/);
        expect(r.stderr).toMatch(/open a new doc or remove the stale/);
        expect(r.stderr).not.toMatch(/edit the doc content/); // legacy 不给不可达改动指引
        expect(r.stderr).not.toMatch(/change ref to open a new review/); // §2.5 item 8 双场景禁用（与 case 1 对称）
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("CHANGES_REQUESTED prev + 同内容同 hash → 无声放行（SP-4；CDD_INFO 抑制）", () => {
      const dir = tmpGitRepo();
      try {
        const doc = path.join(dir, "docs", "foo-design.md");
        const ws = seedDocsReviewRound(dir, doc, "spec-review-1.json", {
          docHash: sha256("v1"),
          content: "v1",
        });
        // 覆写 status = CHANGES_REQUESTED（同 hash 同内容）→ 应无声放行、无 CDD_INFO
        const hf = path.join(ws, "spec-review-1.json");
        const h = JSON.parse(readFileSync(hf, "utf8"));
        h.status = "CHANGES_REQUESTED";
        writeFileSync(hf, JSON.stringify(h));
        const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", doc], {
          cwd: dir,
          env: { CLAUDE_CODE_SESSION_ID: "1" },
        });
        expect(r.exitCode).toBe(0); // 放行（blocker>0 重审权 SP-4）
        expect(r.stderr).not.toMatch(/CDD_INFO/); // 非 clean prev → 自文档化抑制（§2.3.2）
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("BLOCKED prev + 内容演进（hash 异）→ 无声放行、无 CDD_INFO（SP-4 §2.4 失败轮照旧；else-if 不进入）", () => {
      const dir = tmpGitRepo();
      try {
        const doc = path.join(dir, "docs", "foo-design.md");
        const ws = seedDocsReviewRound(dir, doc, "spec-review-1.json", {
          docHash: sha256("v1"),
          content: "v2",
        });
        // 覆写 status = BLOCKED（内容 v2 ≠ 旧 review 验的 v1）→ 无声放行，else-if（仅 clean prev）不进入 → 无 CDD_INFO
        const hf = path.join(ws, "spec-review-1.json");
        const h = JSON.parse(readFileSync(hf, "utf8"));
        h.status = "BLOCKED";
        writeFileSync(hf, JSON.stringify(h));
        const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", doc], {
          cwd: dir,
          env: { CLAUDE_CODE_SESSION_ID: "1" },
        });
        expect(r.exitCode).toBe(0); // 失败轮重派（SP-4）
        expect(r.stderr).not.toMatch(/CDD_INFO/); // 非 clean prev → 自文档化抑制
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("内容演进 + 显式 --round 2（= engine 推导）→ 放行；--round 1（≠ 推导）→ exit 2 backfill 冲突", () => {
      const dir = tmpGitRepo();
      try {
        const doc = path.join(dir, "docs", "foo-design.md");
        seedDocsReviewRound(dir, doc, "spec-review-1.json", {
          docHash: sha256("v1"),
          content: "v2",
        });
        const ok = runCli(
          ["--dry-run", "review", "--type", "spec", "--spec", doc, "--round", "2"],
          { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: "1" } },
        );
        expect(ok.exitCode).toBe(0);
        expect(ok.stderr).toMatch(/new review round 2/);
        const bad = runCli(
          ["--dry-run", "review", "--type", "spec", "--spec", doc, "--round", "1"],
          { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: "1" } },
        );
        expect(bad.exitCode).toBe(2);
        expect(bad.stderr).toMatch(/≠ engine round/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("plan 家族镜像：内容未变 → exit 3；内容演进 → 放行（plan-review 族同矩阵）", () => {
      const dir = tmpGitRepo();
      try {
        const plan = path.join(dir, "plans", "foo.md");
        seedDocsReviewRound(dir, plan, "plan-review-1.json", {
          docHash: sha256("p1"),
          content: "p1",
        });
        const same = runCli(["--dry-run", "review", "--type", "plan", "--plan", plan], {
          cwd: dir,
          env: { CLAUDE_CODE_SESSION_ID: "1" },
        });
        expect(same.exitCode).toBe(3);
        // 内容演进写的是 tracked 文件 → 提交后再重派（入口门干净树；演进本身就是一次 commit 动作）
        writeFileSync(plan, "p2-different");
        execaSync("git", ["-C", dir, "add", "-A"]);
        execaSync("git", [
          "-C",
          dir,
          "-c",
          "user.name=cdd-test",
          "-c",
          "user.email=cdd-test@example.com",
          "commit",
          "-qm",
          "evolve",
        ]);
        const ev = runCli(["--dry-run", "review", "--type", "plan", "--plan", plan], {
          cwd: dir,
          env: { CLAUDE_CODE_SESSION_ID: "1" },
        });
        expect(ev.exitCode).toBe(0);
        expect(ev.stderr).toMatch(/CDD_INFO.*new review round 2/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("doc 文件缺失 → resolveDocArg 拦在 Convergence gate 之前（exit 1 三行诊断；幽灵 doc 静默放行不再可达）", () => {
      const dir = tmpGitRepo();
      try {
        const doc = path.join(dir, "docs", "foo-design.md");
        seedDocsReviewRound(dir, doc, "spec-review-1.json", {
          docHash: sha256("v1"),
          content: "v1",
        });
        rmSync(doc); // 删除现档——T2 单一坐标系下已无法进入 gate
        const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", doc], {
          cwd: dir,
          env: { CLAUDE_CODE_SESSION_ID: "1" },
        });
        // 内容路径归一（read point ⑤）是 Convergence gate 的前置：不存在 → exit 1（§2.4.2「运行期不可继续」）。
        // hashFile 的空串哨兵分支因此在本 CLI 路径上不可达（无 ghost doc 能到 gate）。
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toMatch(/CDD_BLOCKED: --spec not found/);
        expect(r.stderr).not.toMatch(/CDD_INFO/); // 空串哨兵抑制「内容演进」误导消息（gate `&& docHash` 条款）
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});

// ---- Dry-run gate downgraded to WARN on dirty trees (E2②/G4①) — dirty-tree CLI black-box sweep across shapes (P6 T10) ----
// The base-class default entry gate (dispatch/base.ts commitPreCheck → rules/commit.ts entryGateCleanTree)
// is the single-point downgrade for both task and docs: dirty + dryRun → no BLOCK; after a stderr CDD_WARN
// it exits 0 through the simulation. Real-dispatch BLOCKED semantics stay pinned by dispatch.*.test.ts.
// Here each CLI shape runs one real-repo dirty-tree case — implement + review/fix × task/spec/plan, 7 shapes
// total; any shape that slips past the single-point path goes red. dry-run's zero-liveness (no spawn / no
// TIMEOUT) assertions live in the dispatch layer (T14 interface disambiguation, dispatch.task/dirs.test.ts);
// this layer only asserts "CLI exit 0 + stderr exposes the WARN".

// 脏树真仓：基础 fixture 全量提交（干净 Tree 起点）→ tracked.txt 追加造脏（porcelain ` M`）→
// workspace（.gitignore 收编）对 porcelain 零影响，/种子 findings 不弄脏也非 dirty 源。
function dirtyFixtureRepo() {
  const repo = tmpGitRepo();
  for (const dir of ["docs", "plans"]) mkdirSync(path.join(repo, dir), { recursive: true });
  writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
  writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
  writeFileSync(path.join(repo, "docs", "foo-design.md"), "# foo spec\n");
  writeFileSync(path.join(repo, "plans", "foo.md"), "# P\n\n### Task 1: t\n");
  execaSync("git", ["-C", repo, "add", "-A"]);
  execaSync("git", [
    "-C",
    repo,
    "-c",
    "user.name=cdd-test",
    "-c",
    "user.email=cdd-test@example.com",
    "commit",
    "-qm",
    "base",
  ]);
  appendFileSync(path.join(repo, "tracked.txt"), "dirty\n"); // 造脏：确定性 ` M tracked.txt`
  return repo;
}

// 种子 findings 文件（fix --type task 透传 + fix --type spec/plan 的 resolveDocArg 要求存在；
// 名字需匹配 <type>-review-{n}.json 以派生轮次）。落 .osuperpowers/（gitignored）。
function seedFindings(repo: string, rel: string): string {
  const p = path.join(repo, ".osuperpowers", "cdd", rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(
    p,
    JSON.stringify({ status: "CHANGES_REQUESTED", findings: [], artifacts: {}, doc_path: "" }),
  );
  return p;
}

describe("P6 T10: E2② dry-run 脏树降级 — CLI 黑盒各型 sweep", () => {
  const assertDryRunWarn = (r: { exitCode: number; stdout: string; stderr: string }) => {
    expect(r.exitCode).toBe(0);
    // 断言引 src 侧单点常量 DRY_RUN_DIRTY_WARN（dist 为 jiti 即时加载桩 → 措辞即源措辞）：
    // mount 前缀 `CDD_WARN: ` 之外的消息文本不再在各测试文件重复编码。
    expect(r.stderr).toContain(`CDD_WARN: ${DRY_RUN_DIRTY_WARN}`);
  };

  it("implement --dry-run（task 面）: 脏树 exit 0 + return block APPROVED + WARN", () => {
    const dir = dirtyFixtureRepo();
    try {
      const r = runCli(["--dry-run", "implement", "--tasks", "1", "--plan", "docs/plan.md"], {
        cwd: dir,
        env: { CLAUDE_CODE_SESSION_ID: "1" },
      });
      assertDryRunWarn(r);
      expect(r.stdout).toMatch(/status: APPROVED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("review/fix --type task --dry-run: 脏树 exit 0 + WARN（各一条）", () => {
    const dir = dirtyFixtureRepo();
    try {
      const r = runCli(
        ["--dry-run", "review", "--type", "task", "--tasks", "1", "--plan", "docs/plan.md"],
        { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: "1" } },
      );
      assertDryRunWarn(r);
      expect(r.stdout).toMatch(/status: APPROVED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const dir2 = dirtyFixtureRepo();
    try {
      const findings = seedFindings(dir2, "plan/tasks-1-review-1.json");
      const r = runCli(
        [
          "--dry-run",
          "fix",
          "--type",
          "task",
          "--tasks",
          "1",
          "--plan",
          "docs/plan.md",
          "--findings",
          findings,
        ],
        { cwd: dir2, env: { CLAUDE_CODE_SESSION_ID: "1" } },
      );
      assertDryRunWarn(r);
      expect(r.stdout).toMatch(/status: APPROVED/);
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it("review/fix --type spec --dry-run: 脏树 exit 0 + WARN（各一条）", () => {
    const dir = dirtyFixtureRepo();
    try {
      const r = runCli(["--dry-run", "review", "--type", "spec", "--spec", "docs/foo-design.md"], {
        cwd: dir,
        env: { CLAUDE_CODE_SESSION_ID: "1" },
      });
      assertDryRunWarn(r);
      // docs-family result face (AC9): review completion prints the stdout face even on the
      // dirty-tree downgrade path.
      expect(r.stdout).toMatch(/status: APPROVED/);
      expect(r.stdout).toMatch(/· blocker: 0/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const dir2 = dirtyFixtureRepo();
    try {
      const findings = seedFindings(dir2, "foo/spec-review-1.json");
      const r = runCli(
        [
          "--dry-run",
          "fix",
          "--type",
          "spec",
          "--spec",
          "docs/foo-design.md",
          "--findings",
          findings,
        ],
        { cwd: dir2, env: { CLAUDE_CODE_SESSION_ID: "1" } },
      );
      assertDryRunWarn(r);
      // docs-fix result face (AC9 — fix completion now also carries the stdout face).
      expect(r.stdout).toMatch(/status: APPROVED/);
      expect(r.stdout).toMatch(/· blocker: 0/);
      expect(r.stdout).toMatch(/· handoff:/);
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it("review/fix --type plan --dry-run: 脏树 exit 0 + WARN（各一条）", () => {
    const dir = dirtyFixtureRepo();
    try {
      const r = runCli(["--dry-run", "review", "--type", "plan", "--plan", "plans/foo.md"], {
        cwd: dir,
        env: { CLAUDE_CODE_SESSION_ID: "1" },
      });
      assertDryRunWarn(r);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const dir2 = dirtyFixtureRepo();
    try {
      const findings = seedFindings(dir2, "foo/plan-review-1.json");
      const r = runCli(
        ["--dry-run", "fix", "--type", "plan", "--plan", "plans/foo.md", "--findings", findings],
        { cwd: dir2, env: { CLAUDE_CODE_SESSION_ID: "1" } },
      );
      assertDryRunWarn(r);
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });
});
