// gate/tests/vibe.test.mjs — P4b T4: Mistral Vibe pre_tool hook adapter I/O。
// stdin hook JSON（tool_name/tool_input）→ stdout { decision, reason }。vibe pre_tool
// 阻塞形状：{"decision":"deny","reason":...}；allow → {"decision":"allow"}。
// fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeGateTestEnv, gitFixtureRoot, writePending, runAdapter, now, activePlan } from "./helpers.mjs";

const ADAPTER = fileURLToPath(new URL("../adapters/vibe.mjs", import.meta.url));
const { root, pendingRoot } = makeGateTestEnv();

test("vibe hook: 无 pending → allow", () => {
  const out = runAdapter(ADAPTER, {}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.deepEqual(out, { decision: "allow" });
});

test("vibe hook: cli 严格 + Bash git commit → deny + reason 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-cli-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = runAdapter(
    ADAPTER,
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { session_id: "s-cli-commit", tool_name: "Bash", tool_input: { command: "git commit -m x" } },
  );
  assert.equal(out.decision, "deny");
  assert.match(out.reason, /cdd-run\.sh --harness vibe/);
  assert.match(out.reason, /plan-a/);
});

test("vibe hook: 畸形 stdin（非 JSON）→ 抛错 → fail-open allow", () => {
  const out = runAdapter(ADAPTER, {}, "not-json", true);
  assert.deepEqual(out, { decision: "allow" });
});
