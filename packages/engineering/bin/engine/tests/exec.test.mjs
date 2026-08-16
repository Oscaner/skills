// engine/tests/exec.test.mjs — T3: cdd-exec.mjs 一次性自由任务入口行为（hermetic mock PATH）。
// Node port of cdd-exec.test.sh（6 scenarios）：参数分派、text passthrough、stream-json
// last-finalText、unsupported BLOCKED、missing CLI exit 2、review-prefix 合成。
// Hermetic PATH：丢弃所有含 registry CLI 二进制的 PATH 目录（host 真实 CLI 不泄漏）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/engineering/bin/engine/tests
const REPO_ROOT = path.resolve(HERE, "../../../../..");
const ENGINE_DIR = path.join(REPO_ROOT, "packages/engineering/bin/engine");
const EXEC_MJS = path.join(ENGINE_DIR, "cdd-exec.mjs");
const REG = JSON.parse(readFileSync(path.join(ENGINE_DIR, "harness-registry.json"), "utf8"));

// 测试 env：清掉外部会话可能继承的 CDD_*（cdd-exec 读 CDD_MODE 做 review-prefix）。
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra };
}

// make_mock <name> <body> — 写可执行 mock CLI 到 mockdir。
function makeMock(dir, name, body) {
  writeFileSync(path.join(dir, name), `#!/bin/sh\n${body}\n`);
  chmodSync(path.join(dir, name), 0o755);
}

// harness_free_path 的 Node 版：丢弃含 registry CLI 二进制的 PATH 目录（对齐 test-lib.sh）。
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

function runExec(args, { mockPath, extraEnv = {} } = {}) {
  const env = cleanEnv(extraEnv);
  if (mockPath) env.PATH = mockPath;
  const res = spawnSync("node", [EXEC_MJS, ...args], { cwd: REPO_ROOT, env, encoding: "utf8" });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

test("cdd-exec.mjs: 缺 --prompt / 未知 flag → exit 2", () => {
  const noPrompt = runExec(["--harness", "claude"]);
  assert.equal(noPrompt.status, 2);
  assert.match(noPrompt.stderr, /^usage: /);

  const bogus = runExec(["--bogus", "x", "--prompt", "y"]);
  assert.equal(bogus.status, 2);
  assert.match(bogus.stderr, /unknown argument: --bogus/);
});

test("cdd-exec.mjs: text passthrough — claude (output=text) → stdout == prompt", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-exec-mock-"));
  makeMock(mock, "claude", 'for a in "$@"; do last="$a"; done; printf "%s\\n" "$last"');
  const fp = harnessFreePath();
  const res = runExec(["--harness", "claude", "--prompt", "hello world"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(res.stdout.trim(), "hello world");
});

test("cdd-exec.mjs: stream-json — droid → stdout == 最后 completion.finalText", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-exec-mock-"));
  makeMock(
    mock,
    "droid",
    'printf "%s\\n" "{\\"type\\":\\"event\\",\\"finalText\\":\\"partial\\"}"\nprintf "%s\\n" "{\\"type\\":\\"completion\\",\\"finalText\\":\\"FINAL RESULT\\"}"',
  );
  const fp = harnessFreePath();
  const res = runExec(["--harness", "droid", "--prompt", "task"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(res.stdout.trim(), "FINAL RESULT");
});

test("cdd-exec.mjs: unsupported harness (codex) → BLOCKED exit 1", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-exec-mock-"));
  makeMock(mock, "codex", "exit 0");
  const fp = harnessFreePath();
  const res = runExec(["--harness", "codex", "--prompt", "x"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /CDD_BLOCKED/);
});

test("cdd-exec.mjs: missing CLI (pi, full) → CDD_CLI_MISSING exit 2", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-exec-mock-"));
  const fp = harnessFreePath();
  const res = runExec(["--harness", "pi", "--prompt", "x"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /CDD_CLI_MISSING/);
});

test("cdd-exec.mjs: CDD_DRY_RUN=1 跳过 CLI preflight 但仍 invoke CLI（对齐 bash cdd-exec.sh）", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-exec-mock-"));
  const fp = harnessFreePath();
  // pi 是 full harness，mock PATH 无 pi 二进制 —— CDD_DRY_RUN=1 仅跳过 preflight（无 CDD_CLI_MISSING）；
  // 但 cdd-exec 不跳过 CLI 调用（bash cdd-exec.sh 无 dry-run 分支）→ spawn 失败 exit 1。
  const res = runExec(["--harness", "pi", "--prompt", "x"], {
    mockPath: `${mock}${path.delimiter}${fp}`,
    extraEnv: { CDD_DRY_RUN: "1" },
  });
  assert.equal(res.status, 1, `stderr: ${res.stderr}`);
  assert.doesNotMatch(res.stderr, /CDD_CLI_MISSING/, "dry-run 跳过 CLI preflight");
});

test("cdd-exec.mjs: review-prefix 合成 — CDD_MODE=review 时 prompt 前置 review_prefix", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-exec-mock-"));
  makeMock(mock, "claude", 'for a in "$@"; do last="$a"; done; printf "%s\\n" "$last"');
  const fp = harnessFreePath();
  const res = runExec(["--harness", "claude", "--prompt", "hello world"], {
    mockPath: `${mock}${path.delimiter}${fp}`,
    extraEnv: { CDD_MODE: "review" },
  });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(res.stdout.trim(), "Skill(mattpocock-skills:code-review) hello world");
});
