// engine/tests/select.test.mjs — T3: cdd-select.mjs 检测 + 推荐逻辑（hermetic mock PATH）。
// Node port of cdd-select.test.sh（3 scenarios）+ 当前 harness 检测（droid > pi > current > 字母序）。
// 丢弃含 registry CLI 二进制的 PATH 目录，使 mock CLI 与真实 CLI 都不泄漏。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, statSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/engineering/bin/engine/tests
const REPO_ROOT = path.resolve(HERE, "../../../../..");
const ENGINE_DIR = path.join(REPO_ROOT, "packages/engineering/bin/engine");
const SELECT_MJS = path.join(ENGINE_DIR, "cdd-select.mjs");
const REG = JSON.parse(readFileSync(path.join(ENGINE_DIR, "harness-registry.json"), "utf8"));

// 测试 env：清掉外部会话可能继承的 CDD_*（select 不读 CDD_*，但避免 orchestrator env 泄漏）。
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra };
}

function mockDirWithBins(bins) {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-select-mock-"));
  for (const b of bins) {
    writeFileSync(path.join(dir, b), "#!/bin/sh\nexit 0\n");
    chmodSync(path.join(dir, b), 0o755);
  }
  return dir;
}

// harness_free_path 的 Node 版（对齐 test-lib.sh）：丢弃含 registry CLI 二进制的 PATH 目录。
function harnessFreePath() {
  const clis = Object.values(REG).map((e) => e.cli).filter(Boolean);
  return process.env.PATH.split(path.delimiter)
    .filter((d) => d && !clis.some((b) => {
      try {
        const st = statSync(path.join(d, b));
        return st.isFile() && (st.mode & 0o111) !== 0;
      } catch {
        return false;
      }
    }))
    .join(path.delimiter);
}

function runSelect(extraEnv = {}) {
  const env = cleanEnv(extraEnv);
  env.PATH = `${mock}${path.delimiter}${harnessFreePath()}`;
  const res = spawnSync("node", [SELECT_MJS], { cwd: REPO_ROOT, env, encoding: "utf8" });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

let mock;
function resetMock(bins) {
  if (mock) rmSync(mock, { recursive: true, force: true });
  mock = mockDirWithBins(bins);
}

test("cdd-select.mjs: droid+pi+claude 已装 → available 字母序 + recommended=droid", () => {
  resetMock(["droid", "pi", "claude", "codex"]);
  const res = runSelect();
  assert.equal(res.status, 0);
  assert.match(res.stdout, /available:claude,droid,pi/);
  assert.match(res.stdout, /unsupported_installed:codex/);
  assert.match(res.stdout, /recommended:droid/);
});

test("cdd-select.mjs: 只 pi 已装 → recommended=pi", () => {
  resetMock(["pi"]);
  const res = runSelect();
  assert.equal(res.status, 0);
  assert.match(res.stdout, /recommended:pi/);
});

test("cdd-select.mjs: 只 not-supported (codex) → BLOCKED exit 1", () => {
  resetMock(["codex"]);
  const res = runSelect();
  assert.notEqual(res.status, 0);
  assert.match(res.stdout, /^available:$/m);
  assert.match(res.stderr, /BLOCKED: no full harness installed/);
});

test("cdd-select.mjs: current harness 检测 — CURSOR_TRACE_ID → cursor-agent", () => {
  resetMock(["claude", "cursor-agent"]);
  const res = runSelect({ CURSOR_TRACE_ID: "1" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /recommended:cursor-agent/);
});

test("cdd-select.mjs: 无 current → 字母序第一个可用", () => {
  resetMock(["claude", "cursor-agent"]);
  const res = runSelect({});
  assert.equal(res.status, 0);
  assert.match(res.stdout, /recommended:claude/);
});
