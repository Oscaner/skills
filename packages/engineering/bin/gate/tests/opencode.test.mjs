// gate/tests/opencode.test.mjs — P4b T5: OpenCode TS plugin adapter。
// opencode 无 hooks.json；插件模块导出 plugin 函数（loader 扫描函数导出并以 PluginInput
// 调用 → Hooks）。校准自 opencode plugins 文档：hook 签名 (input, output)，
// input.tool / input.sessionID / input.callID，output.args；deny 抛 Error 阻断。
// fixture 布局复用 cdd-gate-core.test.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { cddGate } from "../adapters/opencode.mjs";

const root = mkdtempSync("/tmp/gate-adapter-");
const pendingRoot = path.join(root, "pending");
mkdirSync(pendingRoot, { recursive: true });
process.env.CDD_PENDING_ROOT = pendingRoot;
delete process.env.CDD_PENDING_TTL;
delete process.env.CDD_GATE_FIXTURES_ROOT;

const now = () => Math.floor(Date.now() / 1000);

function gitFixtureRoot() {
  const dir = path.join(root, `git-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "config", "user.email", "gate-test@example.com"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "Gate Test"]);
  execFileSync("git", ["-C", dir, "commit", "-q", "--allow-empty", "-m", "init"]);
  const sha = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  return { dir, sha };
}

function writePending(key, data) {
  writeFileSync(path.join(pendingRoot, `${key}.json`), JSON.stringify(data));
}

function activePlan(dir, sha) {
  const planDir = path.join(dir, ".superpowers", "cdd", "plan-a");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(path.join(planDir, "task-1-brief.md"), `TASK_BASE: ${sha}\n`);
  return planDir;
}

test("opencode plugin: cli 严格 + Bash git commit → throw 阻断", async () => {
  const { dir, sha } = gitFixtureRoot();
  activePlan(dir, sha);
  writePending("s-oc-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const hooks = await cddGate({ directory: dir });
  const before = hooks["tool.execute.before"];
  await assert.rejects(
    () => before({ tool: "bash", sessionID: "s-oc-commit", callID: "c1" }, { args: { command: "git commit -m x" } }),
    (e) => {
      assert.match(e.message, /CDD orchestrator gate/);
      assert.match(e.message, /cdd-run\.sh --harness opencode/);
      assert.match(e.message, /plan-a/);
      return true;
    },
  );
});

test("opencode plugin: cli 严格 + Bash git status → allow（不 throw）", async () => {
  const { dir, sha } = gitFixtureRoot();
  activePlan(dir, sha);
  writePending("s-oc-status", { repo_root: dir, detected_at: now(), mode: "cli" });
  const hooks = await cddGate({ directory: dir });
  const before = hooks["tool.execute.before"];
  await assert.doesNotReject(
    () => before({ tool: "bash", sessionID: "s-oc-status", callID: "c2" }, { args: { command: "git status" } }),
  );
});

test("opencode plugin: cli 严格 + Write 出 workspace → throw 阻断", async () => {
  const { dir, sha } = gitFixtureRoot();
  activePlan(dir, sha);
  writePending("s-oc-write", { repo_root: dir, detected_at: now(), mode: "cli" });
  const hooks = await cddGate({ directory: dir });
  const before = hooks["tool.execute.before"];
  await assert.rejects(
    () => before({ tool: "write", sessionID: "s-oc-write", callID: "c4" }, { args: { filePath: `${dir}/outside.md`, content: "x" } }),
    (e) => {
      assert.match(e.message, /CDD orchestrator gate/);
      assert.match(e.message, /plan-a/);
      return true;
    },
  );
});

test("opencode plugin: 无 pending → allow（不 throw）", async () => {
  const hooks = await cddGate({ directory: root });
  const before = hooks["tool.execute.before"];
  await assert.doesNotReject(
    () => before({ tool: "bash", sessionID: "s-oc-none", callID: "c3" }, { args: { command: "git commit -m x" } }),
  );
});
