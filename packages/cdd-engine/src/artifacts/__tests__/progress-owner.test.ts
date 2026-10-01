// packages/cdd-engine/src/artifacts/__tests__/progress-owner.test.ts
// engineRecoveryCount 由 engine 在 BLOCKED/engine-error 判定路径自增（runner.mjs 写 BLOCKED handoff 时），
// orchestrator 层 skill（cli-driven-development §engine-recovery / §timeout-decision）只读判 retry，
// 不再写 progress.json（[#232 comment 5612106797]：orchestrator 手写 tasks 当数组 → dispatch 失败）。

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { TaskLifecycle } from "../../dispatch/task.ts";
import { commitValidDocs, gitCommit, gitInit } from "../../infra/__tests__/helpers.ts";
import { REG_PATH } from "../../infra/registry.ts";
import { Workspace } from "../../infra/workspace.ts";
import { ProgressLedger } from "../progress.ts";

const ledgerFor = (dir: string) => new ProgressLedger(Workspace.fromPath(dir));

// 真仓 fixture（P4 §2.3.1 根注入契约）：root 经 runTask 的 `opts.root` 显式注入（真 mkdtemp 仓根），
// 不调 initRoot()、不 chdir、无 env 缝。workspace 纯由 `--plan` 派生（<repo>/.osuperpowers/cdd/<slug>）。
function setupWorkspace() {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-progress-owner-")));
  gitInit(repo);
  // doc-contract-valid chain (plan + spec + parent overall) — the docContractValidate gate requires them
  const planRel = commitValidDocs(repo);
  const planFile = path.join(repo, planRel);
  const cddDir = path.join(repo, ".osuperpowers", "cdd");
  mkdirSync(cddDir, { recursive: true });
  writeFileSync(path.join(cddDir, ".gitignore"), "*\n");
  const ws = path.join(cddDir, "plan");
  mkdirSync(ws, { recursive: true });
  writeFileSync(
    path.join(ws, "progress.json"),
    JSON.stringify(
      {
        plan: planFile,
        timeoutCount: 0,
        engineRecoveryCount: 0,
        harnessAbortCount: 0,
        tasks: [],
      },
      null,
      2,
    ),
  );
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  return { repo, planFile, ws };
}

it("engine BLOCKED dispatch 后 harnessAbortCount 自增（engine 写，orchestrator 只读；T7 改判 HARNESS_ABORT）", async () => {
  const { repo, planFile, ws } = setupWorkspace();
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-progress-owner-bin-"));
  writeFileSync(
    path.join(binDir, "fake-cli"),
    "#!/usr/bin/env bash\necho 'boom from fake cli' >&2\nexit 3\n",
  );
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const regPath = path.join(ws, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));

  // Precondition: harnessAbortCount == 0 (engineRecoveryCount also 0 — child-failure rejudgment
  // no longer consumes the recovery quota)
  expect(ledgerFor(ws).read().harnessAbortCount).toBe(0);
  expect(ledgerFor(ws).read().engineRecoveryCount).toBe(0);

  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  try {
    // Trigger one engine-level BLOCKED: nested CLI failure (exit 3) without a handoff → the
    // HARNESS_ABORT teardown
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "implement",
      planFile,
      root: repo,
      registryPath: regPath,
      noExit: true,
    });
    expect(res.exitCode).toBe(1);
    expect(res.returnBlock[0]).toMatch(/^status: BLOCKED · blocker: 0 · handoff: /);

    // Assert: re-reading progress.json harnessAbortCount == 1 (engine increments + writes; no
    // orchestrator write needed), and engineRecoveryCount stays 0 (per-category quota independent
    // — the EXECUTION_FAILURE quota is not consumed)
    const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress.harnessAbortCount).toBe(1);
    expect(progress.engineRecoveryCount).toBe(0);
  } finally {
    process.env.PATH = origPath;
  }
});

it("incrementRecovery: 自增并持久化 engineRecoveryCount（缺省 0 → 1 → 2；EXECUTION_FAILURE 额度独立保留）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-recovery-help-"));
  expect(ledgerFor(dir).read().engineRecoveryCount).toBe(0);
  ledgerFor(dir).incrementRecovery();
  expect(ledgerFor(dir).read().engineRecoveryCount).toBe(1);
  ledgerFor(dir).incrementRecovery();
  const saved = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  expect(saved.engineRecoveryCount).toBe(2);
});

it("progress.json#plan 与 --plan 入参一致（program 通道首跳可解析）", async () => {
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-plan-pass-"));
  gitInit(repo);
  const planRel = "docs/osuperpowers/plans/x.md";
  mkdirSync(path.join(repo, "docs/osuperpowers/plans"), { recursive: true });
  writeFileSync(path.join(repo, planRel), "# P\n\n### Task 1: t\n");
  // 根经 opts.root 注入（T3 的根注入契约）——不调 initRoot()、不 process.chdir()
  // Task 8: 入口门（pre-commit 干净树）先于 dispatch —— plan 必须已提交，否则起点 dirty 直接 BLOCKED。
  gitCommit(repo);
  const _res = await TaskLifecycle.run("claude", 1, {
    mode: "implement",
    dryRun: true,
    planFile: planRel,
    root: repo,
    noExit: true,
  });
  const p = JSON.parse(readFileSync(path.join(repo, ".osuperpowers/cdd/x/progress.json"), "utf8"));
  expect(p.plan).toBe(path.join(repo, planRel));
});
