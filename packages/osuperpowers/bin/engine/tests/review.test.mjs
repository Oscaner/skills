// engine/tests/review.test.mjs — T3: cdd-review.mjs 一次性自由任务入口行为（hermetic mock PATH）。
// Node port of the legacy bash test（6 scenarios）：参数分派、text passthrough、stream-json
// last-finalText、unsupported BLOCKED、missing CLI exit 2、review-prefix 合成。
// + --template / --param 渲染路径（T3-ext: template 渲染、missing 文件、missing placeholder、互斥）
// Hermetic PATH：丢弃所有含 registry CLI 二进制的 PATH 目录（host 真实 CLI 不泄漏）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, statSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/osuperpowers/bin/engine/tests
const REPO_ROOT = path.resolve(HERE, "../../../../..");
const ENGINE_DIR = path.join(REPO_ROOT, "packages/osuperpowers/bin/engine");
const REVIEW_MJS = path.join(ENGINE_DIR, "cdd-review.mjs");
const REG = JSON.parse(readFileSync(path.join(ENGINE_DIR, "harness-registry.json"), "utf8"));

// 测试 env：清掉外部会话可能继承的 CDD_*（cdd-review 读 CDD_MODE 做 task-review-prefix）。
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
  const res = spawnSync("node", [REVIEW_MJS, ...args], { cwd: REPO_ROOT, env, encoding: "utf8" });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

test("cdd-review.mjs: 缺 --prompt / 未知 flag → exit 2", () => {
  const noPrompt = runExec(["--harness", "claude"]);
  assert.equal(noPrompt.status, 2);
  assert.match(noPrompt.stderr, /^usage: /);

  const bogus = runExec(["--bogus", "x", "--prompt", "y"]);
  assert.equal(bogus.status, 2);
  assert.match(bogus.stderr, /unknown argument: --bogus/);
});

test("cdd-review.mjs: text passthrough — claude (output=text) → stdout == prompt", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  makeMock(mock, "claude", 'for a in "$@"; do last="$a"; done; printf "%s\\n" "$last"');
  const fp = harnessFreePath();
  const res = runExec(["--harness", "claude", "--prompt", "hello world"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(res.stdout.trim(), "hello world");
});

test("cdd-review.mjs: stream-json — droid → stdout == 最后 completion.finalText", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
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

test("cdd-review.mjs: unsupported harness (codex) → BLOCKED exit 1", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  makeMock(mock, "codex", "exit 0");
  const fp = harnessFreePath();
  const res = runExec(["--harness", "codex", "--prompt", "x"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /CDD_BLOCKED/);
});

test("cdd-review.mjs: missing CLI (pi, full) → CDD_CLI_MISSING exit 2", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  const fp = harnessFreePath();
  const res = runExec(["--harness", "pi", "--prompt", "x"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /CDD_CLI_MISSING/);
});

test("cdd-review.mjs: CDD_DRY_RUN=1 跳过 CLI preflight 但仍 invoke CLI（对齐 bash cdd-review.sh）", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  const fp = harnessFreePath();
  // pi 是 full harness，mock PATH 无 pi 二进制 —— CDD_DRY_RUN=1 仅跳过 preflight（无 CDD_CLI_MISSING）；
  // 但 cdd-review 不跳过 CLI 调用（bash cdd-review.sh 无 dry-run 分支）→ spawn 失败 exit 1。
  const res = runExec(["--harness", "pi", "--prompt", "x"], {
    mockPath: `${mock}${path.delimiter}${fp}`,
    extraEnv: { CDD_DRY_RUN: "1" },
  });
  assert.equal(res.status, 1, `stderr: ${res.stderr}`);
  assert.doesNotMatch(res.stderr, /CDD_CLI_MISSING/, "dry-run 跳过 CLI preflight");
});

test("cdd-review.mjs: task-review-prefix 合成 — CDD_MODE=task-review 时 prompt 前置 task_review_prefix", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  makeMock(mock, "claude", 'for a in "$@"; do last="$a"; done; printf "%s\\n" "$last"');
  const fp = harnessFreePath();
  const res = runExec(["--harness", "claude", "--prompt", "hello world"], {
    mockPath: `${mock}${path.delimiter}${fp}`,
    extraEnv: { CDD_MODE: "task-review" },
  });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(res.stdout.trim(), "Skill(mattpocock-skills:code-review) hello world");
});

// --template / --param 渲染路径（T3-ext）
test("cdd-review.mjs: --template 渲染 spec-review + params → 输出含模板内容", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  makeMock(mock, "claude", 'for a in "$@"; do last="$a"; done; printf "%s\\n" "$last"');
  const fp = harnessFreePath();
  const res = runExec(
    ["--harness", "claude", "--template", "spec-review", "--param", "DOC=/test.md", "--param", "PASS=completeness"],
    { mockPath: `${mock}${path.delimiter}${fp}` },
  );
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  // 渲染后 prompt 含模板标题
  assert.match(res.stdout, /Spec Review/);
  // 占位符已替换
  assert.match(res.stdout, /\/test\.md/);
  assert.match(res.stdout, /completeness/);
});

test("cdd-review.mjs: --template 不存在文件 → exit 1 + template not found", () => {
  const fp = harnessFreePath();
  const res = runExec(["--harness", "claude", "--template", "nonexistent-xyz"], { mockPath: fp });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /template not found/);
});

test("cdd-review.mjs: --template 缺少 placeholder → exit 1 + missing param", () => {
  const fp = harnessFreePath();
  // spec-review 需要 DOC 和 PASS；只传 DOC → PASS 未替换 → 报错
  const res = runExec(
    ["--harness", "claude", "--template", "spec-review", "--param", "DOC=/test.md"],
    { mockPath: fp },
  );
  assert.equal(res.status, 1);
  assert.match(res.stderr, /missing param/);
});

test("cdd-review.mjs: --template + --prompt 互斥 → exit 2", () => {
  const fp = harnessFreePath();
  const res = runExec(
    ["--harness", "claude", "--template", "spec-review", "--prompt", "hello"],
    { mockPath: fp },
  );
  assert.equal(res.status, 2);
  assert.match(res.stderr, /mutually exclusive/);
});

test("cdd-review.mjs: --param 值含等号 → KEY=VALUE 正确解析（value 可含 =）", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  makeMock(mock, "claude", 'for a in "$@"; do last="$a"; done; printf "%s\\n" "$last"');
  const fp = harnessFreePath();
  // DOC=/path/to/file?a=b: eq = 分隔第一个 = 即可，value 含 = 号合法
  const res = runExec(
    ["--harness", "claude", "--template", "spec-review", "--param", "DOC=/path/to?a=b", "--param", "PASS=completeness"],
    { mockPath: `${mock}${path.delimiter}${fp}` },
  );
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /\/path\/to\?a=b/);
});

test("cdd-review.mjs: --handoff + mock exit 0 → handoff 含 status DONE", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  const handoffDir = mkdtempSync(path.join(tmpdir(), "cdd-handoff-"));
  makeMock(mock, "claude", 'printf "ok\\n"');
  const fp = harnessFreePath();
  const handoffPath = path.join(handoffDir, "test-handoff.json");
  const res = runExec(
    ["--harness", "claude", "--prompt", "hello", "--handoff", handoffPath],
    { mockPath: `${mock}${path.delimiter}${fp}` },
  );
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.ok(existsSync(handoffPath), "handoff file should exist");
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.equal(h.status, "DONE");
});

test("cdd-review.mjs: --handoff + mock exit 1 → handoff 含 status BLOCKED + blocker", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  const handoffDir = mkdtempSync(path.join(tmpdir(), "cdd-handoff-"));
  makeMock(mock, "claude", 'printf "error output\\n" >&2; exit 1');
  const fp = harnessFreePath();
  const handoffPath = path.join(handoffDir, "test-handoff.json");
  const res = runExec(
    ["--harness", "claude", "--prompt", "hello", "--handoff", handoffPath],
    { mockPath: `${mock}${path.delimiter}${fp}` },
  );
  assert.notEqual(res.status, 0);
  assert.ok(existsSync(handoffPath), "handoff file should exist even on failure");
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.equal(h.status, "BLOCKED");
  assert.ok(h.blocker, "blocker field should be non-empty");
});

test("cdd-review.mjs: 无 --handoff → 不写文件", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  makeMock(mock, "claude", 'printf "ok\\n"');
  const fp = harnessFreePath();
  const handoffPath = path.join(mkdtempSync(path.join(tmpdir(), "cdd-handoff-")), "should-not-exist.json");
  runExec(["--harness", "claude", "--prompt", "hello"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.equal(existsSync(handoffPath), false, "handoff file should NOT exist without --handoff");
});
