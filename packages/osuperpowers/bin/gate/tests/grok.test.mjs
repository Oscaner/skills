// gate/tests/grok.test.mjs — P4b T4: Grok Build PreToolUse hook adapter I/O。
// stdin hook JSON → stdout 顶层 { decision }（grok 唯一阻塞事件 PreToolUse 的 deny 形状
// {"decision":"deny"}；allow → {"decision":"allow"}）。fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeGateTestEnv, gitFixtureRoot, writePending, runAdapter, now, activePlan } from "./helpers.mjs";

const ADAPTER = fileURLToPath(new URL("../adapters/grok.mjs", import.meta.url));
const { root, pendingRoot } = makeGateTestEnv();

test("grok hook: 无 pending → allow", () => {
  const out = runAdapter(ADAPTER, {}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.deepEqual(out, { decision: "allow" });
});

test("grok hook: cli 严格 + Bash git commit → deny", () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-cli-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = runAdapter(
    ADAPTER,
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { conversation_id: "s-cli-commit", tool_name: "Bash", tool_input: { command: "git commit -m x" } },
  );
  assert.deepEqual(out, { decision: "deny" });
});

test("grok hook: 畸形 stdin（非 JSON）→ 抛错 → fail-open allow", () => {
  const out = runAdapter(ADAPTER, {}, "not-json", true);
  assert.deepEqual(out, { decision: "allow" });
});
