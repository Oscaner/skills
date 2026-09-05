// gate/tests/claude.test.mjs — P4b T3: Claude PreToolUse hook adapter I/O。
// hook JSON → stdout hookSpecificOutput.permissionDecision。fixture 帮手来自
// ./helpers.mjs（git init + 真实 SHA brief + pending），CDD_GATE_FIXTURES_ROOT
// 指向临时 repo 的 cdd root。
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeGateTestEnv, gitFixtureRoot, writePending, runAdapter, now, activePlan } from "./helpers.mjs";

const ADAPTER = fileURLToPath(new URL("../adapters/claude.mjs", import.meta.url));
const { root, pendingRoot } = makeGateTestEnv();

test("claude hook: 无 pending → allow", () => {
  const out = runAdapter(ADAPTER, {}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(out.hookSpecificOutput.permissionDecisionReason, "");
});

test("claude hook: cli 严格 + Write 出 workspace → deny + 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-cli-write", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = runAdapter(
    ADAPTER,
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { conversation_id: "s-cli-write", tool_name: "Edit", tool_input: { file_path: path.join(dir, "outside.md") } },
  );
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /cdd-task --harness claude/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /plan-a/);
});

test("claude hook: 畸形 stdin（非 JSON）→ 抛错 → fail-open allow", () => {
  const out = runAdapter(ADAPTER, {}, "not-json", true);
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});
