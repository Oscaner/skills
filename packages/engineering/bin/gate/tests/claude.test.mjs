// gate/tests/claude.test.mjs — P4b T3: Claude PreToolUse hook adapter I/O。
// 从 tests/override-claude-cdd-gate.test.sh 的行为迁移（行为为准）：hook JSON → stdout
// hookSpecificOutput.permissionDecision。fixture 布局复用 cdd-gate-core.test.mjs
// （git init + 真实 SHA brief + pending），CDD_GATE_FIXTURES_ROOT 指向临时 repo 的 cdd root。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ADAPTER = fileURLToPath(new URL("../adapters/claude.mjs", import.meta.url));

const root = mkdtempSync("/tmp/gate-adapter-");
const pendingRoot = path.join(root, "pending");
mkdirSync(pendingRoot, { recursive: true });
process.env.CDD_PENDING_ROOT = pendingRoot;
// 封闭测试环境：TTL 用默认值，fixtures root 由各 deny 用例显式传入（不全局设）。
delete process.env.CDD_PENDING_TTL;
delete process.env.CDD_GATE_FIXTURES_ROOT;

const now = () => Math.floor(Date.now() / 1000);

// 一次性 git 仓库，返回真实对象 SHA 用作 brief 的 TASK_BASE（对齐 cdd-gate-core 布局）。
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

// 以子进程运行 adapter（hook 形态：stdin hook JSON → stdout 决策 JSON）。
function run(env, input) {
  return JSON.parse(
    execFileSync("node", [ADAPTER], {
      input: JSON.stringify(input),
      env: { ...process.env, ...env },
      encoding: "utf8",
    }),
  );
}

test("claude hook: 无 pending → allow", () => {
  const out = run({}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(out.hookSpecificOutput.permissionDecisionReason, "");
});

test("claude hook: cli 严格 + Write 出 workspace → deny + 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot();
  const planDir = path.join(dir, ".superpowers", "cdd", "plan-a");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(path.join(planDir, "task-1-brief.md"), `TASK_BASE: ${sha}\n`);
  writePending("s-cli-write", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = run(
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { conversation_id: "s-cli-write", tool_name: "Edit", tool_input: { file_path: path.join(dir, "outside.md") } },
  );
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /cdd-run\.sh --harness claude/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /plan-a/);
});

test("claude hook: 异常 → fail-open allow", () => {
  // 无 session key（conversation_id/session_id/prompt）→ sha256 兜底 key → 无 pending → allow；
  // 该路径无抛错，但仍须输出 allow（fail-open 契约）。
  const out = run({}, { tool_name: "Write" });
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});
