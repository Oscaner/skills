// gate/tests/cdd-gate-core.test.mjs — P4b T2: gateDecide 语义移植测试。
// 从 bin/lib/cdd-orchestrator-gate.sh 的行为移植语义（行为为准），pending 路径对齐引擎
// （CDD_PENDING_ROOT 默认 ${TMPDIR:-/tmp}/oscaner-engineering/pending-cdd）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import { gateDecide, isWriteTool, isShellTool, readonlyGitVerbs, gitVerbAllowed } from "../cdd-gate-core.mjs";
import { sha256, sessionKeyFromJson } from "../adapters/lib.mjs";

const root = mkdtempSync("/tmp/gate-test-");
const pendingRoot = `${root}/pending`;
mkdirSync(pendingRoot, { recursive: true });
process.env.CDD_PENDING_ROOT = pendingRoot;
// 封闭测试环境：TTL 用默认值（86400），fixtures root 不设（保留 .superpowers/sdd 回退）。
delete process.env.CDD_PENDING_TTL;
delete process.env.CDD_GATE_FIXTURES_ROOT;

const now = () => Math.floor(Date.now() / 1000);
function writePending(key, data) {
  writeFileSync(`${pendingRoot}/${key}.json`, JSON.stringify(data));
}

// 建一个一次性 git 仓库，返回真实对象 SHA 用作 brief 的 TASK_BASE。
function gitFixtureRoot() {
  const dir = `${root}/git-${Math.random().toString(36).slice(2)}`;
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "config", "user.email", "gate-test@example.com"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "Gate Test"]);
  execFileSync("git", ["-C", dir, "commit", "-q", "--allow-empty", "-m", "init"]);
  const sha = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  return { dir, sha };
}

test("fail-open: 无 pending → allow", () => {
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: {}, sessionKey: "s-no-pending", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test("expired pending (>24h) → clear + allow", () => {
  writePending("s-expired", { repo_root: root, detected_at: now() - 25 * 3600, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: root }, sessionKey: "s-expired", repoRoot: root });
  assert.equal(r.decision, "allow");
  assert.ok(!existsSync(`${pendingRoot}/s-expired.json`));
});

test("mode in-session → Write allow（repo 编辑放行）", () => {
  writePending("s-in-session", { repo_root: root, detected_at: now(), mode: "in-session" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${root}/x.md` }, sessionKey: "s-in-session", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test("cli 严格 + Write 出 workspace → deny + reason", () => {
  const ws = `${root}/ws`; mkdirSync(ws, { recursive: true });
  writePending("s-cli-write", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Edit", toolInput: { file_path: `${root}/outside.md` }, sessionKey: "s-cli-write", repoRoot: root });
  assert.equal(r.decision, "deny");
  assert.ok(r.reason.length > 0);
  assert.equal(r.context.taskNum, 1); // 锁定 deny 结构化上下文
});

test("shell + git 只读动词（status）→ allow", () => {
  writePending("s-status", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git status" }, sessionKey: "s-status", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test("shell + git 变更动词（commit）→ deny", () => {
  writePending("s-commit", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git commit -m x" }, sessionKey: "s-commit", repoRoot: root });
  assert.equal(r.decision, "deny");
  assert.match(r.reason, /cdd-run/); // 锁定 deny 文案含恢复指引（等价 cdd_deny_message）
});

test("shell 复合命令（git status && rm x）→ deny", () => {
  writePending("s-compound", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git status && rm x" }, sessionKey: "s-compound", repoRoot: root });
  assert.equal(r.decision, "deny");
});

test("shell git diff → allow", () => {
  writePending("s-diff", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git diff" }, sessionKey: "s-diff", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test("shell git branch -D x → deny", () => {
  writePending("s-branch", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git branch -D x" }, sessionKey: "s-branch", repoRoot: root });
  assert.equal(r.decision, "deny");
});

test("无 repo_root → allow", () => {
  writePending("s-no-root", { detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Edit", toolInput: { file_path: `${root}/x.md` }, sessionKey: "s-no-root", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test(".superpowers/sdd 回退 workspace 解析 → task_active 出 workspace deny", () => {
  const { dir, sha } = gitFixtureRoot();
  const planDir = `${dir}/.superpowers/sdd/plan-fallback`;
  mkdirSync(planDir, { recursive: true });
  writeFileSync(`${planDir}/task-1-brief.md`, `TASK_BASE: ${sha}\n`);
  writePending("s-sdd", { repo_root: dir, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${dir}/outside.md` }, sessionKey: "s-sdd", repoRoot: dir });
  assert.equal(r.decision, "deny");
  assert.equal(r.context.taskNum, 1);
  assert.equal(r.context.planBase, "plan-fallback");
});

test("task_complete phase → Write allow", () => {
  const { dir, sha } = gitFixtureRoot();
  const planDir = `${dir}/.superpowers/cdd/plan-done`;
  mkdirSync(planDir, { recursive: true });
  writeFileSync(`${planDir}/task-1-brief.md`, `TASK_BASE: ${sha}\n`);
  writeFileSync(`${planDir}/task-1-handoff.json`, JSON.stringify({ status: "APPROVED" }));
  writePending("s-complete", { repo_root: dir, detected_at: now(), mode: "cli", workspace: planDir });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${dir}/anywhere.md` }, sessionKey: "s-complete", repoRoot: dir });
  assert.equal(r.decision, "allow");
});

test("helper exports: 工具集 + 只读 git 动词", () => {
  assert.ok(isWriteTool("Write"));
  assert.ok(isWriteTool("Edit"));
  assert.ok(isWriteTool("MultiEdit"));
  assert.ok(!isWriteTool("Bash"));
  assert.ok(isShellTool("Bash"));
  assert.ok(isShellTool("Shell"));
  assert.ok(!isShellTool("Write"));
  assert.ok(readonlyGitVerbs.includes("status"));
  assert.ok(readonlyGitVerbs.includes("diff"));
  assert.ok(readonlyGitVerbs.includes("ls-files"));
  assert.ok(gitVerbAllowed("git status"));
  assert.ok(gitVerbAllowed("git -C /tmp/x status"));
  assert.ok(!gitVerbAllowed("git commit -m x"));
  assert.ok(!gitVerbAllowed("git status && rm x"));
  assert.ok(!gitVerbAllowed("git branch -D x"));
});

test("adapters/lib: sha256 截断 + session key 解析", () => {
  assert.equal(sha256("").length, 16);
  assert.equal(sessionKeyFromJson({ conversation_id: "c1" }), "c1");
  assert.equal(sessionKeyFromJson({ session_id: "sess" }), "sess");
  assert.equal(sessionKeyFromJson({ prompt: "hello" }), sha256("hello"));
});

test("CLI: stdin JSON → stdout JSON（薄 CLI 冒烟）", () => {
  const cli = path.join(import.meta.dirname, "../cdd-gate-decide.mjs");
  const input = JSON.stringify({ harness: "claude", toolName: "Bash", toolInput: { command: "git status" }, sessionKey: "s-cli-smoke", repoRoot: root });
  const out = execFileSync("node", [cli], { input, encoding: "utf8" });
  const r = JSON.parse(out);
  assert.equal(r.decision, "allow");
});
