// engine/tests/session-activate.test.mjs — T3: cdd-session-activate.mjs pending 写行为。
// Node port of cdd-session-activate.sh（spec §E 模式感知）：minimal/bind 子命令、
// --mode 优先于 CDD_SESSION_MODE env、空 → fail-open 省略 mode、非法 mode → exit 2、
// bind-existing 保留既有 mode（保护 cli 严格性）、CDD_PENDING_ROOT / TMPDIR 派生默认根。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/osuperpowers/bin/engine/tests
const REPO_ROOT = path.resolve(HERE, "../../../../..");
const ACTIVATE_MJS = path.join(REPO_ROOT, "packages/osuperpowers/bin/engine/cdd-session-activate.mjs");

// 测试 env：清掉外部会话可能继承的 CDD_*（session-activate 读 CDD_SESSION_MODE / CDD_PENDING_ROOT）。
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra };
}

function runActivate(args, extraEnv = {}) {
  const res = spawnSync("node", [ACTIVATE_MJS, ...args], {
    cwd: REPO_ROOT,
    env: cleanEnv(extraEnv),
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function readPending(root, key) {
  return JSON.parse(readFileSync(path.join(root, `${key}.json`), "utf8"));
}

test("cdd-session-activate.mjs: minimal → pending 写 trigger/session_key/repo_root/detected_at（无 mode）", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  const res = runActivate(["minimal", "sess-1", "/repo/root"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const p = readPending(root, "sess-1");
  assert.equal(p.trigger, "cdd-orchestrator");
  assert.equal(p.session_key, "sess-1");
  assert.equal(p.repo_root, "/repo/root");
  assert.equal(typeof p.detected_at, "number");
  assert.ok(!("mode" in p), "fail-open：无 mode 时省略 mode 字段");
});

test("cdd-session-activate.mjs: minimal --mode cli → mode 字段写 cli", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  const res = runActivate(["minimal", "sess-2", "/repo", "--mode", "cli"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(readPending(root, "sess-2").mode, "cli");
});

test("cdd-session-activate.mjs: minimal --mode=subagent → mode 字段写 subagent", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  const res = runActivate(["minimal", "sess-3", "/repo", "--mode=subagent"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(readPending(root, "sess-3").mode, "subagent");
});

test("cdd-session-activate.mjs: bind fresh → plan_path/workspace/active_task:null + trigger", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  const res = runActivate(["bind", "sess-b", "/repo", "/plan.md", "/ws"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const p = readPending(root, "sess-b");
  assert.equal(p.trigger, "cdd-orchestrator");
  assert.equal(p.session_key, "sess-b");
  assert.equal(p.repo_root, "/repo");
  assert.equal(p.plan_path, "/plan.md");
  assert.equal(p.workspace, "/ws");
  assert.equal(p.active_task, null);
});

test("cdd-session-activate.mjs: bind-existing 无 --mode → 保留既有 mode cli", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  assert.equal(runActivate(["minimal", "sess-bx", "/repo", "--mode", "cli"], { CDD_PENDING_ROOT: root }).status, 0);
  const res = runActivate(["bind", "sess-bx", "/repo", "/plan.md", "/ws"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const p = readPending(root, "sess-bx");
  assert.equal(p.mode, "cli", "rebind 缺 mode 不得降级为 fail-open");
  assert.equal(p.plan_path, "/plan.md");
  assert.equal(p.workspace, "/ws");
  assert.equal(p.active_task, null);
});

test("cdd-session-activate.mjs: bind-existing 显式 --mode subagent → 覆盖既有 mode", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  assert.equal(runActivate(["minimal", "sess-bo", "/repo", "--mode", "cli"], { CDD_PENDING_ROOT: root }).status, 0);
  const res = runActivate(["bind", "sess-bo", "/repo", "/plan.md", "/ws", "--mode", "subagent"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(readPending(root, "sess-bo").mode, "subagent");
});

test("cdd-session-activate.mjs: 非法 mode → exit 2 且不写 pending", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  const res = runActivate(["minimal", "sess-bad", "/repo", "--mode", "bogus"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /invalid mode: bogus \(expected in-session\|subagent\|cli\)/);
  assert.equal(existsSync(path.join(root, "sess-bad.json")), false);
});

test("cdd-session-activate.mjs: 缺位置参数 → usage exit 2", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  const res = runActivate(["minimal", "only-key"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /^usage: /);
});

test("cdd-session-activate.mjs: 非法子命令 → usage exit 2", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cdd-pend-"));
  const res = runActivate(["frobnicate", "sess-x", "/repo"], { CDD_PENDING_ROOT: root });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /^usage: /);
});

test("cdd-session-activate.mjs: CDD_PENDING_ROOT 缺省 → TMPDIR 派生默认根", () => {
  const t = mkdtempSync(path.join(tmpdir(), "cdd-tmp-"));
  const res = runActivate(["minimal", "sess-def", "/repo"], { TMPDIR: t });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const p = JSON.parse(
    readFileSync(path.join(t, "oscaner-engineering", "pending-cdd", "sess-def.json"), "utf8"),
  );
  assert.equal(p.session_key, "sess-def");
});
