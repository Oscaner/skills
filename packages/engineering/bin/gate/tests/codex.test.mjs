// gate/tests/codex.test.mjs — P4b T4: Codex PreToolUse hook adapter I/O。
// stdin hook JSON（tool_name/tool_input/session_id）→ stdout hookSpecificOutput
//（codex 现行 deny 形状：{"hookSpecificOutput":{"hookEventName":"PreToolUse",
// "permissionDecision":"deny","permissionDecisionReason":...}}；legacy decision:block
// 亦被接受，但现行主形状是 wrapper）。fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeGateTestEnv, gitFixtureRoot, writePending, runAdapter, now, activePlan } from "./helpers.mjs";

const ADAPTER = fileURLToPath(new URL("../adapters/codex.mjs", import.meta.url));
const { root, pendingRoot } = makeGateTestEnv();

test("codex hook: 无 pending → allow", () => {
  const out = runAdapter(ADAPTER, {}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});

test("codex hook: cli 严格 + Bash git commit → deny + 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-cli-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = runAdapter(
    ADAPTER,
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { session_id: "s-cli-commit", tool_name: "Bash", tool_input: { command: "git commit -m x" } },
  );
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /cdd-run\.sh --harness codex/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /plan-a/);
});

test("codex hook: 畸形 stdin（非 JSON）→ 抛错 → fail-open allow", () => {
  const out = runAdapter(ADAPTER, {}, "not-json", true);
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});
