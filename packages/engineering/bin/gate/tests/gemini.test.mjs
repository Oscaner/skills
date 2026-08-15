// gate/tests/gemini.test.mjs — P4b T4: Gemini CLI BeforeTool hook adapter I/O。
// stdin hook JSON（tool_name/tool_input）→ stdout { decision, reason }。gemini BeforeTool
// 阻塞形状：{"decision":"block","reason":...}（decision "deny"/"block" 等价，brief 定 block；
// reason denied 时必需）；allow → {"decision":"allow"}。fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeGateTestEnv, gitFixtureRoot, writePending, runAdapter, now, activePlan } from "./helpers.mjs";

const ADAPTER = fileURLToPath(new URL("../adapters/gemini.mjs", import.meta.url));
const { root, pendingRoot } = makeGateTestEnv();

test("gemini hook: 无 pending → allow", () => {
  const out = runAdapter(ADAPTER, {}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.deepEqual(out, { decision: "allow" });
});

test("gemini hook: cli 严格 + Bash git commit → block + reason 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-cli-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = runAdapter(
    ADAPTER,
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { conversation_id: "s-cli-commit", tool_name: "Bash", tool_input: { command: "git commit -m x" } },
  );
  assert.equal(out.decision, "block");
  assert.match(out.reason, /cdd-run\.sh --harness gemini/);
  assert.match(out.reason, /plan-a/);
});

test("gemini hook: 畸形 stdin（非 JSON）→ 抛错 → fail-open allow", () => {
  const out = runAdapter(ADAPTER, {}, "not-json", true);
  assert.deepEqual(out, { decision: "allow" });
});
