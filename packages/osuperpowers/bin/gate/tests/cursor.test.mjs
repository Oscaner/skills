// gate/tests/cursor.test.mjs — P4b T3: Cursor preToolUse hook adapter I/O。
// hook JSON → stdout **顶层** { permission }（{ permission: "allow" } /
// { permission: "deny", agent_message }，勿改格式）。deny 断言 agent_message 含恢复指引；
// fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeGateTestEnv, gitFixtureRoot, writePending, runAdapter, now, activePlan } from "./helpers.mjs";

const ADAPTER = fileURLToPath(new URL("../adapters/cursor.mjs", import.meta.url));
const { root, pendingRoot } = makeGateTestEnv();

test("cursor hook: 无 pending → allow", () => {
  const out = runAdapter(ADAPTER, {}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { path: "/tmp/x.md" } });
  assert.deepEqual(Object.keys(out).sort(), ["permission"]);
  assert.equal(out.permission, "allow");
});

test("cursor hook: cli 严格 + Write 出 workspace → deny + agent_message 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-cli-write", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = runAdapter(
    ADAPTER,
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { session_id: "s-cli-write", tool_name: "Write", tool_input: { path: path.join(dir, "outside.md") } },
  );
  assert.equal(out.permission, "deny");
  assert.ok(out.agent_message, "deny 需携带 agent_message 恢复指引");
  assert.match(out.agent_message, /cdd-run.mjs --harness cursor/);
  assert.match(out.agent_message, /plan-a/);
});

test("cursor hook: 畸形 stdin（非 JSON）→ 抛错 → fail-open allow", () => {
  const out = runAdapter(ADAPTER, {}, "not-json", true);
  assert.deepEqual(Object.keys(out).sort(), ["permission"]);
  assert.equal(out.permission, "allow");
});
