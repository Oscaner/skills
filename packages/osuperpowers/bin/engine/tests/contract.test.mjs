// engine/tests/contract.test.mjs — T2: commit-contract + handoff write 模块单测（Node port）。
// 移植 cdd-commit-gate-smoke.sh（16 断言）的核心行为：
//   dirty-tree → blocked + handoff.status=BLOCKED；head-mismatch → blocked（F1）；
//   clean-tree → pass；非 git → fail-open ok:true；review 模式 → no-op。
// 移植 cdd-severity-contract.test.sh（30 断言）的语义核心（非 grep 散文，而是可执行契约）：
//   classifySeverity：blocker→CHANGES_REQUESTED；warn/nit→deferred；unverifiable/needs_context→STOP。
//   rollupStatus：warn/nit→APPROVED；含 blocker→CHANGES_REQUESTED；unverifiable/plan_conflicts→BLOCKED。
//   markDeferred：warn/nit 无条件 deferred:true。
// writeHandoff：按 docs/handoff-schema.md 写 + 合并已有（H6 链 update 语义）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  validateCommitContract,
  writeHandoff,
  classifySeverity,
  rollupStatus,
  markDeferred,
} from "../lib/contract.mjs";

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// setup_repo —— port 自 cdd-commit-gate-smoke.sh：新 git repo，.gitignore 忽略 cdd/（workspace 目录）。
function setupRepo() {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-contract-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(dest, "-c", "user.name=cdd-gate-test", "-c", "user.email=cdd-gate-test@example.com", "commit", "--allow-empty", "-qm", "fixture");
  return dest;
}

// seedHandoff —— 在 gitignored cdd/ 下种 handoff（不弄脏 tracked tree）。
function seedHandoff(repo, task, commits) {
  const dir = path.join(repo, "cdd");
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `task-${task}-handoff.json`);
  writeFileSync(p, JSON.stringify({ status: "DONE", phase: "implement", task, commits }));
  return p;
}

function headOf(repo) {
  return git(repo, "rev-parse", "HEAD");
}

test("commit-contract: dirty tree → ok:false + handoff.status=BLOCKED", () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const handoff = seedHandoff(repo, 1, { base: head, head });
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");

  const r = validateCommitContract("fix", repo, { handoffPath: handoff });
  assert.equal(r.ok, false);
  assert.match(r.blocker, /uncommitted changes at return/);
  assert.equal(JSON.parse(readFileSync(handoff, "utf8")).status, "BLOCKED");
});

test("commit-contract: dirty tree implement → ok:false（D3b 同样适用 implement）", () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const r = validateCommitContract("implement", repo);
  assert.equal(r.ok, false);
  assert.match(r.blocker, /uncommitted changes at return/);
});

test("commit-contract: clean tree → ok:true（handoff 不重写）", () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const handoff = seedHandoff(repo, 1, { base: head, head });
  const r = validateCommitContract("fix", repo, { handoffPath: handoff });
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(readFileSync(handoff, "utf8")).status, "DONE");
});

test("commit-contract: clean tree + 无 handoff → ok:true（fail-open）", () => {
  const repo = setupRepo();
  const r = validateCommitContract("implement", repo, { handoffPath: path.join(repo, "cdd", "no-such.json") });
  assert.equal(r.ok, true);
});

test("commit-contract: clean tree + handoff.head ≠ HEAD → ok:false（F1）", () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const wrong = "0000000000000000000000000000000000000000";
  const handoff = seedHandoff(repo, 1, { base: head, head: wrong });
  const r = validateCommitContract("fix", repo, { handoffPath: handoff });
  assert.equal(r.ok, false);
  assert.match(r.blocker, /handoff commits.head .* does not match HEAD/);
  assert.equal(JSON.parse(readFileSync(handoff, "utf8")).status, "BLOCKED");
});

test("commit-contract: handoff.head=dry-run → head-mismatch（哨兵已移除，对齐 bash）", () => {
  const repo = setupRepo();
  const handoff = seedHandoff(repo, 1, { base: "dry-run", head: "dry-run" });
  const r = validateCommitContract("fix", repo, { handoffPath: handoff });
  assert.equal(r.ok, false);
  assert.match(r.blocker, /handoff commits.head dry-run does not match HEAD/);
});

// #186 SHA prefix 兼容：handoff.head 是实际 HEAD 的前缀 → ok:true（兼容历史 7-char handoff）
test("commit-contract #186: handoff.head=7-char prefix of HEAD → ok:true（prefix fallback）", () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const prefix = head.slice(0, 7);
  const handoff = seedHandoff(repo, 1, { base: head, head: prefix });
  const r = validateCommitContract("fix", repo, { handoffPath: handoff });
  assert.equal(r.ok, true, `prefix ${prefix} should match full HEAD ${head}`);
});

test("commit-contract #186: handoff.head=non-prefix 7-char → ok:false（mismatch）", () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const wrong = "0000000";
  const handoff = seedHandoff(repo, 1, { base: head, head: wrong });
  const r = validateCommitContract("fix", repo, { handoffPath: handoff });
  assert.equal(r.ok, false);
  assert.match(r.blocker, /does not match HEAD/);
});

test("commit-contract: 非 git 目录 → fail-open ok:true", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-nogit-"));
  const r = validateCommitContract("fix", dir, { handoffPath: path.join(dir, "task-1-handoff.json") });
  assert.equal(r.ok, true);
});

test("commit-contract: task-review 模式 → no-op ok:true", () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const r = validateCommitContract("task-review", repo);
  assert.equal(r.ok, true);
});

test("classifySeverity: blocker → CHANGES_REQUESTED", () => {
  assert.equal(classifySeverity("blocker"), "CHANGES_REQUESTED");
});

test("classifySeverity: warn/nit → deferred", () => {
  assert.equal(classifySeverity("warn"), "deferred");
  assert.equal(classifySeverity("nit"), "deferred");
});

test("classifySeverity: unverifiable / needs_context → STOP", () => {
  assert.equal(classifySeverity("unverifiable"), "STOP");
  assert.equal(classifySeverity("needs_context"), "STOP");
});

test("classifySeverity: 未知 severity → 抛错（契约违规）", () => {
  assert.throws(() => classifySeverity("critical"), /unknown severity/);
});

test("rollupStatus: 空 / 仅 warn·nit → APPROVED", () => {
  assert.equal(rollupStatus([]), "APPROVED");
  assert.equal(rollupStatus([{ severity: "warn" }, { severity: "nit" }]), "APPROVED");
});

test("rollupStatus: 含 blocker（即使兼有 warn/nit）→ CHANGES_REQUESTED", () => {
  assert.equal(rollupStatus([{ severity: "warn" }, { severity: "blocker" }]), "CHANGES_REQUESTED");
  assert.equal(rollupStatus([{ severity: "blocker" }]), "CHANGES_REQUESTED");
});

test("rollupStatus: unverifiable / plan_conflicts 非空 → BLOCKED", () => {
  assert.equal(rollupStatus([], ["cannot verify"]), "BLOCKED");
  assert.equal(rollupStatus([], [], [{ plan_section: "§2", finding_summary: "x" }]), "BLOCKED");
});

test("markDeferred: warn/nit 无条件 deferred:true，blocker 不标", () => {
  const out = markDeferred([{ severity: "warn" }, { severity: "nit" }, { severity: "blocker" }]);
  assert.equal(out[0].deferred, true);
  assert.equal(out[1].deferred, true);
  assert.equal(out[2].deferred, undefined);
});

test("writeHandoff: 按 schema 写入 + 合并已有（保留 commits）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-handoff-"));
  const p = path.join(dir, "task-1-handoff.json");
  writeHandoff(p, {
    task: 1,
    phase: "implement",
    status: "DONE",
    commits: { base: "b", head: "h" },
    complexity: "simple",
    review_scope: "task",
    artifacts: { brief: "b.md", report: "r.md", test_evidence: "t.json" },
    test_evidence: { command: "node --test", passed: true, exit_code: 0, warnings_count: 0 },
    findings: [],
    unverifiable: [],
    plan_conflicts: [],
  });
  const h = JSON.parse(readFileSync(p, "utf8"));
  assert.equal(h.status, "DONE");
  assert.equal(h.commits.head, "h");
  assert.deepEqual(h.findings, []);

  // H6 链 update：只改 status/blocker，其余字段保留
  writeHandoff(p, { status: "BLOCKED", blocker: "uncommitted changes at return" });
  const h2 = JSON.parse(readFileSync(p, "utf8"));
  assert.equal(h2.status, "BLOCKED");
  assert.equal(h2.commits.head, "h");
  assert.equal(h2.task, 1);
  assert.equal(h2.blocker, "uncommitted changes at return");
});

test("writeHandoff: 父目录不存在自动创建 + 已有非 JSON 覆盖为合法 JSON", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-handoff2-"));
  const p = path.join(dir, "sub", "task-2-handoff.json");
  writeHandoff(p, { task: 2, status: "DONE" });
  assert.ok(existsSync(p));
  assert.equal(JSON.parse(readFileSync(p, "utf8")).status, "DONE");

  writeFileSync(p, "garbage");
  writeHandoff(p, { status: "BLOCKED" });
  assert.equal(JSON.parse(readFileSync(p, "utf8")).status, "BLOCKED");
});
