// gate/tests/cdd-gate-core.test.mjs — P4b T2: gateDecide 语义移植测试。
// 从 bin/lib/cdd-orchestrator-gate.sh 的行为移植语义（行为为准），pending 路径对齐引擎
// （CDD_PENDING_ROOT 默认 ${TMPDIR:-/tmp}/oscaner-engineering/pending-cdd）。fixture
// 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gateDecide, isWriteTool, isShellTool, readonlyGitVerbs, gitVerbAllowed, pendingPathFor } from "../cdd-gate-core.mjs";
import { sessionKeyHash, sessionKeyFromJson } from "../adapters/lib.mjs";
import { makeGateTestEnv, gitFixtureRoot, writePending, now } from "./helpers.mjs";

const { root, pendingRoot } = makeGateTestEnv();
const coreUrl = fileURLToPath(new URL("../cdd-gate-core.mjs", import.meta.url));

test("fail-open: 无 pending → allow", () => {
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: {}, sessionKey: "s-no-pending", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test("expired pending (>24h) → clear + allow", () => {
  writePending(pendingRoot, "s-expired", { repo_root: root, detected_at: now() - 25 * 3600, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: root }, sessionKey: "s-expired", repoRoot: root });
  assert.equal(r.decision, "allow");
  assert.ok(!existsSync(path.join(pendingRoot, "s-expired.json")));
});

test("mode in-session → Write allow（repo 编辑放行）", () => {
  writePending(pendingRoot, "s-in-session", { repo_root: root, detected_at: now(), mode: "in-session" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${root}/x.md` }, sessionKey: "s-in-session", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test("cli 严格 + Write 出 workspace → deny + reason", () => {
  const ws = `${root}/ws`; mkdirSync(ws, { recursive: true });
  writePending(pendingRoot, "s-cli-write", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Edit", toolInput: { file_path: `${root}/outside.md` }, sessionKey: "s-cli-write", repoRoot: root });
  assert.equal(r.decision, "deny");
  assert.ok(r.reason.length > 0);
  assert.equal(r.context.taskNum, 1); // 锁定 deny 结构化上下文
});

test("shell + git 只读动词（status）→ allow", () => {
  writePending(pendingRoot, "s-status", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git status" }, sessionKey: "s-status", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test("shell + git 变更动词（commit）→ deny", () => {
  writePending(pendingRoot, "s-commit", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git commit -m x" }, sessionKey: "s-commit", repoRoot: root });
  assert.equal(r.decision, "deny");
  assert.match(r.reason, /cdd-run/); // 锁定 deny 文案含恢复指引（等价 cdd_deny_message）
});

test("shell 复合命令（git status && rm x）→ deny", () => {
  writePending(pendingRoot, "s-compound", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git status && rm x" }, sessionKey: "s-compound", repoRoot: root });
  assert.equal(r.decision, "deny");
});

test("shell git diff → allow", () => {
  writePending(pendingRoot, "s-diff", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git diff" }, sessionKey: "s-diff", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test("shell git branch -D x → deny", () => {
  writePending(pendingRoot, "s-branch", { repo_root: root, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git branch -D x" }, sessionKey: "s-branch", repoRoot: root });
  assert.equal(r.decision, "deny");
});

test("无 repo_root → allow", () => {
  writePending(pendingRoot, "s-no-root", { detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Edit", toolInput: { file_path: `${root}/x.md` }, sessionKey: "s-no-root", repoRoot: root });
  assert.equal(r.decision, "allow");
});

test(".superpowers/sdd 回退 workspace 解析 → task_active 出 workspace deny", () => {
  const { dir, sha } = gitFixtureRoot(root);
  const planDir = `${dir}/.superpowers/sdd/plan-fallback`;
  mkdirSync(planDir, { recursive: true });
  writeFileSync(`${planDir}/task-1-brief.md`, `TASK_BASE: ${sha}\n`);
  writePending(pendingRoot, "s-sdd", { repo_root: dir, detected_at: now(), mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${dir}/outside.md` }, sessionKey: "s-sdd", repoRoot: dir });
  assert.equal(r.decision, "deny");
  assert.equal(r.context.taskNum, 1);
  assert.equal(r.context.planBase, "plan-fallback");
});

test("task_complete phase → Write allow", () => {
  const { dir, sha } = gitFixtureRoot(root);
  const planDir = `${dir}/.superpowers/cdd/plan-done`;
  mkdirSync(planDir, { recursive: true });
  writeFileSync(`${planDir}/task-1-brief.md`, `TASK_BASE: ${sha}\n`);
  writeFileSync(`${planDir}/task-1-handoff.json`, JSON.stringify({ status: "APPROVED" }));
  writePending(pendingRoot, "s-complete", { repo_root: dir, detected_at: now(), mode: "cli", workspace: planDir });
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

test("adapters/lib: sessionKeyHash 截断 + session key 解析", () => {
  assert.equal(sessionKeyHash("").length, 16);
  assert.equal(sessionKeyFromJson({ conversation_id: "c1" }), "c1");
  assert.equal(sessionKeyFromJson({ session_id: "sess" }), "sess");
  assert.equal(sessionKeyFromJson({ prompt: "hello" }), sessionKeyHash("hello"));
});

test("TMPDIR 空串 → 默认 pending root 落到 /tmp（bash :- 语义）", () => {
  // DEFAULT_PENDING_ROOT 在模块加载时求值 —— 子进程带空 TMPDIR 全新 import 验证。
  const out = execFileSync("node", ["--input-type=module", "-e",
    `import { pendingPathFor } from ${JSON.stringify(coreUrl)}; process.stdout.write(pendingPathFor("s"));`],
    { env: { ...process.env, TMPDIR: "", CDD_PENDING_ROOT: "" }, encoding: "utf8" });
  assert.ok(out.startsWith("/tmp/oscaner-engineering/"), `expected /tmp default root, got: ${out}`);
});

test("CDD_PENDING_ROOT 空串 → 回退默认 root（bash :- 语义）", () => {
  const out = execFileSync("node", ["--input-type=module", "-e",
    `import { pendingPathFor } from ${JSON.stringify(coreUrl)}; process.stdout.write(pendingPathFor("s"));`],
    { env: { ...process.env, TMPDIR: "/tmp", CDD_PENDING_ROOT: "" }, encoding: "utf8" });
  assert.ok(out.startsWith("/tmp/oscaner-engineering/"), `expected /tmp default root, got: ${out}`);
});

test("CLI: stdin JSON → stdout JSON（薄 CLI 冒烟）", () => {
  const cli = fileURLToPath(new URL("../cdd-gate-decide.mjs", import.meta.url));
  const input = JSON.stringify({ harness: "claude", toolName: "Bash", toolInput: { command: "git status" }, sessionKey: "s-cli-smoke", repoRoot: root });
  const out = execFileSync("node", [cli], { input, encoding: "utf8" });
  const r = JSON.parse(out);
  assert.equal(r.decision, "allow");
});
