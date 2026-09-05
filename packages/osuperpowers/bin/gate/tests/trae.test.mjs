// gate/tests/trae.test.mjs — P4b T4: Trae PreToolUse hook adapter I/O。
// stdin hook JSON（Cursor 形 tool_name/tool_input）→ stdout hookSpecificOutput
//（trae PreToolUse deny 形状：{"hookSpecificOutput":{"permissionDecision":"deny"}}）。
// fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeGateTestEnv, gitFixtureRoot, writePending, runAdapter, now, activePlan } from "./helpers.mjs";

const ADAPTER = fileURLToPath(new URL("../adapters/trae.mjs", import.meta.url));
const { root, pendingRoot } = makeGateTestEnv();

test("trae hook: 无 pending → allow", () => {
  const out = runAdapter(ADAPTER, {}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});

test("trae hook: cli 严格 + Bash git commit → deny + 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-cli-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = runAdapter(
    ADAPTER,
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { session_id: "s-cli-commit", tool_name: "Bash", tool_input: { command: "git commit -m x" } },
  );
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /cdd-task --harness trae/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /plan-a/);
});

test("trae hook: 畸形 stdin（非 JSON）→ 抛错 → fail-open allow", () => {
  const out = runAdapter(ADAPTER, {}, "not-json", true);
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});
