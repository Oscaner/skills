// gate/tests/pi.test.mjs — P4b T5: Pi TS extension adapter。
// pi 无 CLI hooks manifest；扩展为 TS 模块，default export factory 接收 ExtensionAPI，
// pi.on("tool_call", handler) 注册阻塞处理器。校准自 pi extensions 文档：
// handler(event, ctx)，event.toolName / event.input（可变更），ctx.cwd，
// ctx.sessionManager.getSessionId()；deny → { block: true, reason }。
// fixture 布局复用 cdd-gate-core.test.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import piExtension from "../adapters/pi.mjs";

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

// 捕获 pi.on 注册的 handler —— fake ExtensionAPI。
function makePi() {
  const handlers = {};
  const pi = { on: (name, handler) => { handlers[name] = handler; } };
  return { pi, handlers };
}

function ctxFor(cwd, sessionId) {
  return { cwd, sessionManager: { getSessionId: async () => sessionId } };
}

test("pi extension: cli 严格 + Bash git commit → { block: true, reason }", async () => {
  const { dir, sha } = gitFixtureRoot();
  activePlan(dir, sha);
  writePending("s-pi-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "bash", toolCallId: "c1", input: { command: "git commit -m x" } },
    ctxFor(dir, "s-pi-commit"),
  );
  assert.equal(out.block, true);
  assert.match(out.reason, /cdd-run\.sh --harness pi/);
  assert.match(out.reason, /plan-a/);
});

test("pi extension: cli 严格 + Write 出 workspace → { block: true, reason }", async () => {
  const { dir, sha } = gitFixtureRoot();
  activePlan(dir, sha);
  writePending("s-pi-write", { repo_root: dir, detected_at: now(), mode: "cli" });
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "write", toolCallId: "c2", input: { path: `${dir}/outside.md`, content: "x" } },
    ctxFor(dir, "s-pi-write"),
  );
  assert.equal(out.block, true);
  assert.match(out.reason, /plan-a/);
});

test("pi extension: cli 严格 + Bash git status → allow（{}）", async () => {
  const { dir, sha } = gitFixtureRoot();
  activePlan(dir, sha);
  writePending("s-pi-status", { repo_root: dir, detected_at: now(), mode: "cli" });
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "bash", toolCallId: "c3", input: { command: "git status" } },
    ctxFor(dir, "s-pi-status"),
  );
  assert.deepEqual(out, {});
});

test("pi extension: 无 pending → allow（{}）", async () => {
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "bash", toolCallId: "c4", input: { command: "git commit -m x" } },
    ctxFor(root, "s-pi-none"),
  );
  assert.deepEqual(out, {});
});
