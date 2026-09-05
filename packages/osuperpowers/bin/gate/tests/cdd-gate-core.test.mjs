// gate/tests/cdd-gate-core.test.mjs — P4b T2: gateDecide 语义移植测试。
// Bug O Step 5b: gate 状态经 env（CDD_GATE_WORKSPACE / CDD_GATE_MODE / CDD_GATE_PLAN，
// runner spawn env 传播）读取，TMPDIR pending 文件已删除。repo_root 由 workspace 的
// git toplevel 推导。fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gateDecide, isWriteTool, isShellTool, readonlyGitVerbs, gitVerbAllowed } from "../cdd-gate-core.mjs";
import { sessionKeyHash, sessionKeyFromJson } from "../adapters/lib.mjs";
import { makeGateTestEnv, gitFixtureRoot, writePending, clearGateEnv, activePlan } from "./helpers.mjs";

const { root, pendingRoot } = makeGateTestEnv();
const coreUrl = fileURLToPath(new URL("../cdd-gate-core.mjs", import.meta.url));

// active plan-a workspace fixture（git 仓库 + 含真实 TASK_BASE 的 brief）。
function activeWorkspace() {
  const { dir, sha } = gitFixtureRoot(root);
  const ws = activePlan(dir, sha);
  return { dir, ws };
}

test("fail-open: 无 CDD_GATE_WORKSPACE env → allow", () => {
  clearGateEnv();
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${root}/x.md` } });
  assert.equal(r.decision, "allow");
});

test("fail-open: workspace 非 git 仓库（无法推导 repo_root）→ allow", () => {
  writePending(pendingRoot, "s-not-git", { workspace: root, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${root}/outside.md` } });
  assert.equal(r.decision, "allow");
});

test("mode in-session → Write allow（repo 编辑放行）", () => {
  const { dir, ws } = activeWorkspace();
  writePending(pendingRoot, "s-in-session", { workspace: ws, mode: "in-session" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${dir}/x.md` } });
  assert.equal(r.decision, "allow");
});

test("cli 严格 + Write 出 workspace → deny + reason", () => {
  const { dir, ws } = activeWorkspace();
  writePending(pendingRoot, "s-cli-write", { workspace: ws, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Edit", toolInput: { file_path: `${dir}/outside.md` } });
  assert.equal(r.decision, "deny");
  assert.ok(r.reason.length > 0);
  assert.equal(r.context.taskNum, 1); // 锁定 deny 结构化上下文
  assert.equal(r.context.planBase, "plan-a");
});

test("CDD_GATE_PLAN 覆盖 deny 文案的 plan basename", () => {
  const { dir, ws } = activeWorkspace();
  writePending(pendingRoot, "s-plan", { workspace: ws, mode: "cli", plan_path: "/tmp/spec-doc.md" });
  const r = gateDecide({ harness: "claude", toolName: "Edit", toolInput: { file_path: `${dir}/outside.md` } });
  assert.equal(r.decision, "deny");
  assert.equal(r.context.planBase, "spec-doc");
});

test("cli 严格 + workspace 内 Write → allow", () => {
  const { dir: _dir, ws } = activeWorkspace();
  writePending(pendingRoot, "s-inside", { workspace: ws, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${ws}/ok.md` } });
  assert.equal(r.decision, "allow");
});

test("shell + git 只读动词（status）→ allow", () => {
  const { ws } = activeWorkspace();
  writePending(pendingRoot, "s-status", { workspace: ws, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git status" } });
  assert.equal(r.decision, "allow");
});

test("shell + git 变更动词（commit）→ deny", () => {
  const { ws } = activeWorkspace();
  writePending(pendingRoot, "s-commit", { workspace: ws, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git commit -m x" } });
  assert.equal(r.decision, "deny");
  assert.match(r.reason, /cdd-task/); // 锁定 deny 文案含恢复指引（等价 cdd_deny_message）
});

test("shell 复合命令（git status && rm x）→ deny", () => {
  const { ws } = activeWorkspace();
  writePending(pendingRoot, "s-compound", { workspace: ws, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git status && rm x" } });
  assert.equal(r.decision, "deny");
});

test("shell git diff → allow", () => {
  const { ws } = activeWorkspace();
  writePending(pendingRoot, "s-diff", { workspace: ws, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git diff" } });
  assert.equal(r.decision, "allow");
});

test("shell git branch -D x → deny", () => {
  const { ws } = activeWorkspace();
  writePending(pendingRoot, "s-branch", { workspace: ws, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Bash", toolInput: { command: "git branch -D x" } });
  assert.equal(r.decision, "deny");
});

test("task_complete phase → Write allow", () => {
  const { dir, ws } = activeWorkspace();
  // Node runner writes per-round task-review handoffs (latest approved → task complete)
  writeFileSync(path.join(ws, "task-1-task-review-1.json"), JSON.stringify({ status: "APPROVED" }));
  writePending(pendingRoot, "s-complete", { workspace: ws, mode: "cli" });
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { file_path: `${dir}/anywhere.md` } });
  assert.equal(r.decision, "allow");
});

test("path 提取：path 优先于 file_path（两者都出现，bash .path // .file_path 优先级）", () => {
  const { dir, ws } = activeWorkspace();
  writePending(pendingRoot, "s-path-priority", { workspace: ws, mode: "cli" });
  // path 指向 workspace 内、file_path 指向外部 → allow（说明 path 生效）
  const inside = gateDecide({ harness: "claude", toolName: "Write", toolInput: { path: `${ws}/ok.md`, file_path: `${dir}/outside.md` } });
  assert.equal(inside.decision, "allow");
  // 反向：path 指向外部、file_path 指向 workspace 内 → deny（path 仍生效）
  const outside = gateDecide({ harness: "claude", toolName: "Write", toolInput: { path: `${dir}/outside.md`, file_path: `${ws}/ok.md` } });
  assert.equal(outside.decision, "deny");
});

test("path 提取：file_path 空串 + 真实 path → 取 path（空串不 bypass gate → allow）", () => {
  const { dir, ws } = activeWorkspace();
  writePending(pendingRoot, "s-fp-empty", { workspace: ws, mode: "cli" });
  // file_path 空串（部分 harness 总是发空串）+ path 指向 workspace 外 → deny（path 生效）
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { path: `${dir}/outside.md`, file_path: "" } });
  assert.equal(r.decision, "deny");
});

test("path 提取：path 空串 + 真实 file_path → 取 file_path（而非空 → allow）", () => {
  const { dir, ws } = activeWorkspace();
  writePending(pendingRoot, "s-path-empty", { workspace: ws, mode: "cli" });
  // path 空串 + file_path 指向 workspace 外 → deny（file_path 生效）
  const r = gateDecide({ harness: "claude", toolName: "Write", toolInput: { path: "", file_path: `${dir}/outside.md` } });
  assert.equal(r.decision, "deny");
  // path 空串 + file_path 空串 → 无路径 → allow
  const none = gateDecide({ harness: "claude", toolName: "Write", toolInput: { path: "", file_path: "" } });
  assert.equal(none.decision, "allow");
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

test("CLI: stdin JSON → stdout JSON（薄 CLI 冒烟）", () => {
  clearGateEnv();
  const cli = fileURLToPath(new URL("../cdd-gate-decide.mjs", import.meta.url));
  const input = JSON.stringify({ harness: "claude", toolName: "Bash", toolInput: { command: "git status" }, sessionKey: "s-cli-smoke", repoRoot: root });
  const out = execFileSync("node", [cli], { input, encoding: "utf8" });
  const r = JSON.parse(out);
  assert.equal(r.decision, "allow");
});

// 确认 cdd-gate-core 不再含 pending 文件路径逻辑（Bug O Step 5b 验证的一半）。
test("core 不再导出 pendingPathFor（pending 文件机制已删除）", async () => {
  const core = await import(coreUrl);
  assert.equal(typeof core.pendingPathFor, "undefined");
});