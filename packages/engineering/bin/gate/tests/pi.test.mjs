// gate/tests/pi.test.mjs — P4b T5: Pi TS extension adapter。
// pi 无 CLI hooks manifest；扩展为 TS 模块，default export factory 接收 ExtensionAPI，
// pi.on("tool_call", handler) 注册阻塞处理器。校准自 pi extensions 文档：
// handler(event, ctx)，event.toolName / event.input（可变更），ctx.cwd，
// ctx.sessionManager.getSessionId()；deny → { block: true, reason }。
// fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";

import piExtension from "../adapters/pi.mjs";
import { makeGateTestEnv, gitFixtureRoot, writePending, now, activePlan } from "./helpers.mjs";

const { root, pendingRoot } = makeGateTestEnv();

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
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-pi-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "bash", toolCallId: "c1", input: { command: "git commit -m x" } },
    ctxFor(dir, "s-pi-commit"),
  );
  assert.equal(out.block, true);
  assert.match(out.reason, /cdd-run.mjs --harness pi/);
  assert.match(out.reason, /plan-a/);
});

test("pi extension: cli 严格 + Write 出 workspace → { block: true, reason }", async () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-pi-write", { repo_root: dir, detected_at: now(), mode: "cli" });
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
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-pi-status", { repo_root: dir, detected_at: now(), mode: "cli" });
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

test("pi extension: 畸形 event（undefined）→ 抛错 → fail-open allow（{}）", async () => {
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(undefined, undefined);
  assert.deepEqual(out, {});
});
