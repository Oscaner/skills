// gate/tests/cursor.test.mjs — P4b T3: Cursor preToolUse hook adapter I/O。
// 行为为准）：hook JSON → stdout **顶层** { permission }（{ permission: "allow" } /
// { permission: "deny", agent_message }，勿改格式）。deny 断言 agent_message 含恢复指引；
// fixture 布局复用 cdd-gate-core.test.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ADAPTER = fileURLToPath(new URL("../adapters/cursor.mjs", import.meta.url));

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

function run(env, input) {
  return JSON.parse(
    execFileSync("node", [ADAPTER], {
      input: JSON.stringify(input),
      env: { ...process.env, ...env },
      encoding: "utf8",
    }),
  );
}

test("cursor hook: 无 pending → allow", () => {
  const out = run({}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { path: "/tmp/x.md" } });
  assert.deepEqual(Object.keys(out).sort(), ["permission"]);
  assert.equal(out.permission, "allow");
});

test("cursor hook: cli 严格 + Write 出 workspace → deny + agent_message 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot();
  const planDir = path.join(dir, ".superpowers", "cdd", "plan-a");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(path.join(planDir, "task-1-brief.md"), `TASK_BASE: ${sha}\n`);
  writePending("s-cli-write", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = run(
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { session_id: "s-cli-write", tool_name: "Write", tool_input: { path: path.join(dir, "outside.md") } },
  );
  assert.equal(out.permission, "deny");
  assert.ok(out.agent_message, "deny 需携带 agent_message 恢复指引");
  assert.match(out.agent_message, /cdd-run\.sh --harness cursor/);
  assert.match(out.agent_message, /plan-a/);
});

test("cursor hook: 异常 → fail-open allow", () => {
  const out = run({}, { tool_name: "Write" });
  assert.deepEqual(Object.keys(out).sort(), ["permission"]);
  assert.equal(out.permission, "allow");
});
