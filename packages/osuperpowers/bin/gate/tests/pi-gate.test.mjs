// gate/tests/pi-gate.test.mjs — P6b T2: pi.ts TS extension gate adapter tests。
// Port of pi.test.mjs for the .ts gate extension.
// pi auto-discovers *.ts extensions; gate adapter .ts replaces .mjs as pi channel。
import { test } from "node:test";
import assert from "node:assert/strict";

import piExtension from "../adapters/pi.ts";
import { makeGateTestEnv, gitFixtureRoot, writePending, now, activePlan } from "./helpers.mjs";

const { root, pendingRoot } = makeGateTestEnv();

function makePi() {
  const handlers = {};
  const pi = { on: (name, handler) => { handlers[name] = handler; } };
  return { pi, handlers };
}

function ctxFor(cwd, sessionId) {
  return { cwd, sessionManager: { getSessionId: async () => sessionId } };
}

test("pi.ts extension: cli 严格 + Bash git commit → { block: true, reason }", async () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-pi-ts-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "bash", toolCallId: "c1", input: { command: "git commit -m x" } },
    ctxFor(dir, "s-pi-ts-commit"),
  );
  assert.equal(out.block, true);
  assert.match(out.reason, /cdd-task.mjs --harness pi/);
  assert.match(out.reason, /plan-a/);
});

test("pi.ts extension: cli 严格 + Write 出 workspace → { block: true, reason }", async () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-pi-ts-write", { repo_root: dir, detected_at: now(), mode: "cli" });
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "write", toolCallId: "c2", input: { path: `${dir}/outside.md`, content: "x" } },
    ctxFor(dir, "s-pi-ts-write"),
  );
  assert.equal(out.block, true);
  assert.match(out.reason, /plan-a/);
});

test("pi.ts extension: cli 严格 + Bash git status → allow（{}）", async () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-pi-ts-status", { repo_root: dir, detected_at: now(), mode: "cli" });
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "bash", toolCallId: "c3", input: { command: "git status" } },
    ctxFor(dir, "s-pi-ts-status"),
  );
  assert.deepEqual(out, {});
});

test("pi.ts extension: 无 pending → allow（{}）", async () => {
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(
    { toolName: "bash", toolCallId: "c4", input: { command: "git commit -m x" } },
    ctxFor(root, "s-pi-ts-none"),
  );
  assert.deepEqual(out, {});
});

test("pi.ts extension: 畸形 event（undefined）→ 抛错 → fail-open allow（{}）", async () => {
  const { pi, handlers } = makePi();
  piExtension(pi);
  const out = await handlers.tool_call(undefined, undefined);
  assert.deepEqual(out, {});
});
