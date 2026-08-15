// packages/engineering/tests/common-functions.test.mjs — T5: cdd-common.sh 共享函数行为测试
// （Node port of cdd-common-functions.test.sh 剩余函数家族）。
//
// 树关系（沿用 T1 钉死）：bin/engine/tests/（T1-T3 模块单测）已覆盖 runner/contract/exec/
// select/templates/registry 的 **Node 引擎** 行为；本文件在 **bash 边界**（spawn
// `bash -c 'source cdd-common.sh; …'`）守护 bash 引擎（T7 前仍为生产 runner）中未被模块
// 测试吸收的函数家族，按函数家族命名：
//   cdd_pending_path / CDD_PENDING_ROOT（F0 + I4 override）
//   cdd_plugin_root（插件根上溯解析）
//   cdd_superpowers_scripts_dir（repo submodule → 插件 cache 解析）
//   cdd_require_env（env 校验：必需集 + mode 特例 + 非法 mode）
//   cdd_render_mode_prompt（单参渲染首行）
//   cdd_check_cli（dry-run 跳过 / 真实 cli / 缺失 exit 2）
//   _cdd_invoke_cli（review 前缀合成 —— fake claude + harnessFreePath 隔离）
//
// 子进程 env 清掉 orchestrator 会话可能继承的 CDD_*（对齐 runner.test.mjs baseEnv ——
// 否则会话泄漏的 CDD_WORKSPACE/CDD_MODE 会让 require_env 误判）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { harnessFreePath, setupRepo } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, "../bin/engine/lib/cdd-common.sh");

// 测试 env：清掉外部会话可能继承的 CDD_*，再叠加测试可控的 extra。
function cleanEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra };
}

// bashFn —— spawn `bash -c 'source "$0"; <script>' <LIB>`，返回 { status, stdout, stderr }。
// 子进程 env 走 cleanEnv（CDD_* 隔离）；PATH 默认继承，可经 env.PATH 覆盖。
function bashFn(script, { env = {} } = {}) {
  const res = spawnSync("bash", ["-c", `source "$0"; ${script}`, LIB], {
    env: cleanEnv(env),
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

// mkCacheScripts — 在 fake HOME 下造插件 cache 版本目录 + sdd-workspace 探针，返回 scripts 路径。
function mkCacheScripts(home, cacheRel, ver) {
  const scripts = path.join(home, cacheRel, "oscaner", "superpowers", ver, "skills", "subagent-driven-development", "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, "sdd-workspace"), "#!/usr/bin/env bash\n");
  return scripts;
}

// makeMockCli — 写可执行 mock CLI 到 mockdir（对齐 exec.test.mjs makeMock）。
function makeMockCli(dir, name, body) {
  writeFileSync(path.join(dir, name), `#!/bin/sh\n${body}\n`);
  chmodSync(path.join(dir, name), 0o755);
}

////////////////////////////////////////////////////////////////////////////////
// cdd_pending_path / CDD_PENDING_ROOT（F0 + I4 override）
////////////////////////////////////////////////////////////////////////////////

test("cdd_pending_path: 默认 root（TMPDIR 派生）+ TTL + 路径派生", () => {
  const r = bashFn('printf "%s|%s|%s" "$CDD_PENDING_ROOT" "$CDD_PENDING_TTL" "$(cdd_pending_path sess-1)"');
  assert.equal(r.status, 0, r.stderr);
  const [root, ttl, p] = r.stdout.split("|");
  const expectedRoot = `${process.env.TMPDIR ?? "/tmp"}/oscaner-engineering/pending-cdd`;
  assert.equal(root, expectedRoot);
  assert.equal(ttl, "86400");
  assert.equal(p, `${root}/sess-1.json`);
});

test("cdd_pending_path: 用户设 CDD_PENDING_ROOT 覆盖（I4）", () => {
  const r = bashFn('export CDD_PENDING_ROOT=/custom/pending; printf "%s|%s" "$CDD_PENDING_ROOT" "$(cdd_pending_path sess-i4)"');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "/custom/pending|/custom/pending/sess-i4.json");
});

////////////////////////////////////////////////////////////////////////////////
// cdd_plugin_root（插件根上溯解析）
////////////////////////////////////////////////////////////////////////////////

test("cdd_plugin_root: 自 cdd-common.sh 解析 engineering 插件根", () => {
  const r = bashFn("cdd_plugin_root");
  assert.equal(r.status, 0, r.stderr);
  const expected = path.resolve(HERE, ".."); // packages/engineering
  assert.equal(r.stdout.trim(), expected);
});

test("cdd_plugin_root: 无插件根 → stderr 消息 + rc 1", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "cdd-noroot-"));
  const r = bashFn(`cdd_plugin_root "${tmp}/x.sh"; echo "rc=$?"`);
  assert.equal(r.status, 0); // echo 是最后命令
  assert.equal(r.stdout.trim(), "rc=1");
  assert.match(r.stderr, /^cdd_plugin_root: no plugin root \(\.claude-plugin\/plugin\.json\) found from /);
  assert.ok(r.stderr.includes(tmp), `stderr 应含调用者路径: ${r.stderr}`);
});

////////////////////////////////////////////////////////////////////////////////
// cdd_superpowers_scripts_dir（repo submodule → 插件 cache 解析）
////////////////////////////////////////////////////////////////////////////////

test("cdd_superpowers_scripts_dir: repo submodule 优先解析", () => {
  const repo = setupRepo();
  const scripts = path.join(repo, "vendors", "superpowers", "skills", "subagent-driven-development", "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, "sdd-workspace"), "#!/usr/bin/env bash\n");
  const home = mkdtempSync(path.join(tmpdir(), "cdd-home-")); // 空 cache，防回退干扰

  const r = bashFn(`cdd_superpowers_scripts_dir "${repo}"`, { env: { HOME: home } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), scripts);
});

test("cdd_superpowers_scripts_dir: 插件 cache 解析 —— Claude 优先于 Cursor", () => {
  const home = mkdtempSync(path.join(tmpdir(), "cdd-home-"));
  const claudeScripts = mkCacheScripts(home, ".claude/plugins/cache", "1.0.0");
  mkCacheScripts(home, ".cursor/plugins/cache", "2.0.0"); // 同时存在 → Claude 赢

  const r = bashFn("cdd_superpowers_scripts_dir /definitely/not/a/repo", { env: { HOME: home } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), claudeScripts);
});

test("cdd_superpowers_scripts_dir: 无 submodule 无 cache → rc 1", () => {
  const home = mkdtempSync(path.join(tmpdir(), "cdd-home-")); // 空 cache
  const r = bashFn("cdd_superpowers_scripts_dir /definitely/not/a/repo; echo \"rc=$?\"", { env: { HOME: home } });
  assert.equal(r.status, 0); // echo 是最后命令
  assert.equal(r.stdout.trim(), "rc=1");
  assert.equal(r.stderr, "");
});

////////////////////////////////////////////////////////////////////////////////
// cdd_require_env（env 校验：必需集 + mode 特例 + 非法 mode）
////////////////////////////////////////////////////////////////////////////////

test("cdd_require_env: 全缺 → CDD_BLOCKED + exit 1 + 完整缺失列表", () => {
  const r = bashFn("cdd_require_env; echo unreachable");
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.equal(
    r.stderr.trim(),
    "CDD_BLOCKED: Missing required env: CDD_WORKSPACE CDD_TASK_BRIEF CDD_LEDGER CDD_MODE CDD_HANDOFF_PATH CDD_PLAN_CONSTRAINTS CDD_MODE",
  );
});

test("cdd_require_env: implement 必需集全齐 → rc 0", () => {
  const r = bashFn(
    'export CDD_WORKSPACE=/w CDD_TASK_BRIEF=/w/tb CDD_LEDGER=/w/progress CDD_MODE=implement CDD_HANDOFF_PATH=/w/h CDD_PLAN_CONSTRAINTS=/w/pc; cdd_require_env; echo "rc=$?"',
  );
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "rc=0");
});

test("cdd_require_env: review 缺 CDD_REVIEW_FIXED_POINT → 缺失列表含它", () => {
  const r = bashFn(
    'export CDD_WORKSPACE=/w CDD_TASK_BRIEF=/w/tb CDD_LEDGER=/w/progress CDD_MODE=review CDD_HANDOFF_PATH=/w/h CDD_PLAN_CONSTRAINTS=/w/pc; cdd_require_env',
  );
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), "CDD_BLOCKED: Missing required env: CDD_REVIEW_FIXED_POINT");
});

test("cdd_require_env: fix 缺 CDD_FINDINGS → 缺失列表含它", () => {
  const r = bashFn(
    'export CDD_WORKSPACE=/w CDD_TASK_BRIEF=/w/tb CDD_LEDGER=/w/progress CDD_MODE=fix CDD_HANDOFF_PATH=/w/h CDD_PLAN_CONSTRAINTS=/w/pc; cdd_require_env',
  );
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), "CDD_BLOCKED: Missing required env: CDD_FINDINGS");
});

test("cdd_require_env: 非法 mode → CDD_BLOCKED + exit 1", () => {
  const r = bashFn(
    'export CDD_WORKSPACE=/w CDD_TASK_BRIEF=/w/tb CDD_LEDGER=/w/progress CDD_MODE=handoff CDD_HANDOFF_PATH=/w/h CDD_PLAN_CONSTRAINTS=/w/pc; cdd_require_env',
  );
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), "CDD_BLOCKED: CDD_MODE must be implement|review|fix (got: handoff)");
});

////////////////////////////////////////////////////////////////////////////////
// cdd_render_mode_prompt（单参渲染首行）
////////////////////////////////////////////////////////////////////////////////

test("cdd_render_mode_prompt: implement 首行渲染", () => {
  const r = bashFn("cdd_render_mode_prompt implement");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.split("\n")[0], "# CDD implement — CLI session");
});

////////////////////////////////////////////////////////////////////////////////
// cdd_check_cli（dry-run 跳过 / 真实 cli / 缺失 exit 2）
////////////////////////////////////////////////////////////////////////////////

test("cdd_check_cli: CDD_DRY_RUN=1 → 跳过 PATH 检查（bogus cli rc 0）", () => {
  const r = bashFn('CDD_DRY_RUN=1 cdd_check_cli definitely-not-a-real-cli-$$; echo "rc=$?"');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "rc=0");
});

test("cdd_check_cli: 真实 cli 在 PATH → rc 0", () => {
  const r = bashFn('CDD_DRY_RUN=0 cdd_check_cli sh; echo "rc=$?"');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "rc=0");
});

test("cdd_check_cli: 缺失 cli（非 dry-run）→ CDD_CLI_MISSING exit 2", () => {
  const r = bashFn("CDD_DRY_RUN=0 cdd_check_cli definitely-not-a-real-cli-$$; echo unreachable");
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  assert.match(r.stderr.trim(), /^CDD_CLI_MISSING: definitely-not-a-real-cli-\d+ not found in PATH$/);
});

////////////////////////////////////////////////////////////////////////////////
// _cdd_invoke_cli（review 前缀合成 —— fake claude + harnessFreePath 隔离）
////////////////////////////////////////////////////////////////////////////////

// harness_free_path 的隔离语义（test-lib.sh）：mock 目录 + 丢弃所有含真实 registry CLI
// 的 PATH 目录，保证 fake claude 是唯一可解析的 claude（宿主真实 CLI 不泄漏）。
test("_cdd_invoke_cli: review mode → prompt 前置 review_prefix", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-common-mock-"));
  makeMockCli(mock, "claude", 'for a in "$@"; do last="$a"; done; printf "%s\\n" "$last"');
  const pathValue = `${mock}${path.delimiter}${harnessFreePath()}`;

  const r = bashFn('export CDD_HARNESS=claude CDD_MODE=review; _cdd_invoke_cli "hello"', { env: { PATH: pathValue } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "Skill(mattpocock-skills:code-review) hello");
});

test("_cdd_invoke_cli: implement mode → 无前缀透传", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-common-mock-"));
  makeMockCli(mock, "claude", 'for a in "$@"; do last="$a"; done; printf "%s\\n" "$last"');
  const pathValue = `${mock}${path.delimiter}${harnessFreePath()}`;

  const r = bashFn('export CDD_HARNESS=claude CDD_MODE=implement; _cdd_invoke_cli "hello"', { env: { PATH: pathValue } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "hello");
});
