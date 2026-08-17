// engine/tests/select.test.mjs — T3/T5: cdd-select.mjs 检测 + 推荐逻辑（hermetic mock PATH）。
// Node port of cdd-select.test.sh（3 scenarios）+ 当前 harness 检测（droid > pi > current > 字母序）。
// T5: 复用 harness-detect util（基于 skills-probe.config.mjs channel 分类）。
// 丢弃含 harness CLI 二进制的 PATH 目录，使 mock CLI 与真实 CLI 都不泄漏。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "../../utils/skills-probe.config.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/engineering/bin/engine/tests
const REPO_ROOT = path.resolve(HERE, "../../../../..");
const ENGINE_DIR = path.join(REPO_ROOT, "packages/engineering/bin/engine");
const SELECT_MJS = path.join(ENGINE_DIR, "cdd-select.mjs");

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

// harness_free_path：丢弃含 harness CLI 二进制的 PATH 目录（T5: 从 config 取 cli 列表）。
function harnessFreePath() {
  const clis = Object.values(config.harnesses).map((h) => h.cli).filter(Boolean);
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

// T5: codex/gemini 现在归 install-and-use 通道（P6b §2.5），available 而非 unsupported。
test("cdd-select.mjs: droid+pi+claude+codex 已装 → available 字母序 + recommended=droid", () => {
  resetMock(["droid", "pi", "claude", "codex"]);
  const res = runSelect();
  assert.equal(res.status, 0);
  assert.match(res.stdout, /available:claude,codex,droid,pi/);
  assert.match(res.stdout, /unsupported_installed:$/m);
  assert.match(res.stdout, /recommended:droid/);
});

test("cdd-select.mjs: 只 pi 已装 → recommended=pi", () => {
  resetMock(["pi"]);
  const res = runSelect();
  assert.equal(res.status, 0);
  assert.match(res.stdout, /recommended:pi/);
});

test("cdd-select.mjs: 无可装 harness → BLOCKED exit 1", () => {
  resetMock([]); // 无 fake CLI
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
