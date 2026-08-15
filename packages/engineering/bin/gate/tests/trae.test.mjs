// gate/tests/trae.test.mjs — P4b T4: Trae PreToolUse hook adapter I/O。
// stdin hook JSON（Cursor 形 tool_name/tool_input）→ stdout hookSpecificOutput
//（trae PreToolUse deny 形状：{"hookSpecificOutput":{"permissionDecision":"deny"}}）。
// fixture 布局复用 cdd-gate-core.test.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ADAPTER = fileURLToPath(new URL("../adapters/trae.mjs", import.meta.url));

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

// 以子进程运行 adapter（hook 形态：stdin hook JSON → stdout 决策 JSON）。
// raw=true 时原样喂 stdin（测 JSON.parse 抛错 → fail-open allow）。
function run(env, input, raw = false) {
  return JSON.parse(
    execFileSync("node", [ADAPTER], {
      input: raw ? input : JSON.stringify(input),
      env: { ...process.env, ...env },
      encoding: "utf8",
    }),
  );
}

test("trae hook: 无 pending → allow", () => {
  const out = run({}, { session_id: "s-no-pending", tool_name: "Write", tool_input: { file_path: "/tmp/x.md" } });
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});

test("trae hook: cli 严格 + Bash git commit → deny + 恢复指引", () => {
  const { dir, sha } = gitFixtureRoot();
  const planDir = path.join(dir, ".superpowers", "cdd", "plan-a");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(path.join(planDir, "task-1-brief.md"), `TASK_BASE: ${sha}\n`);
  writePending("s-cli-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const out = run(
    { CDD_GATE_FIXTURES_ROOT: path.join(dir, ".superpowers", "cdd") },
    { session_id: "s-cli-commit", tool_name: "Bash", tool_input: { command: "git commit -m x" } },
  );
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /cdd-run\.sh --harness trae/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /plan-a/);
});

test("trae hook: 异常 → fail-open allow", () => {
  const out = run({}, "not-json", true);
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
});
