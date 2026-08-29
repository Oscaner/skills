// engine/tests/cli-shared.test.mjs — T1: cli-shared 模块单测。
// 测试从 runner.mjs 提取的共享 CLI 函数：spawnCapture 基本功能 + invokeCli 参数传递。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { spawnCapture, invokeCli } from "../lib/cli-shared.mjs";

const { delimiter } = path;

test("spawnCapture: echo 命令 → ok:true + stdout 包含输出", async () => {
  const res = await spawnCapture("echo", ["hello cli-shared"], { cwd: process.cwd(), env: process.env });
  assert.equal(res.ok, true);
  assert.equal(res.code, 0);
  assert.match(res.stdout.trim(), /hello cli-shared/);
});

test("spawnCapture: 不存在的命令 → ok:false + stderr 有错误信息", async () => {
  const res = await spawnCapture("no-such-command-xyz", [], { cwd: process.cwd(), env: process.env });
  assert.equal(res.ok, false);
  assert.ok(res.stderr.length > 0, "stderr should contain error message");
});

test("spawnCapture: 非零退出码 → ok:false + code 为退出码", async () => {
  const res = await spawnCapture("sh", ["-c", "exit 42"], { cwd: process.cwd(), env: process.env });
  assert.equal(res.ok, false);
  assert.equal(res.code, 42);
});

test("invokeCli: text 模式 → passthrough stdout", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-cs-cli-"));
  const binDir = path.join(dir, "bin");
  mkdirSync(binDir);
  const cliPath = path.join(binDir, "echo-cli");
  writeFileSync(cliPath, "#!/usr/bin/env bash\necho \"arg2=$2\"\n");
  chmodSync(cliPath, 0o755);

  const entry = { cli: cliPath, invoke: "-p", output: "text", task_review_prefix: "" };
  const res = await invokeCli(entry, "my prompt", "implement", process.env, dir);
  assert.equal(res.ok, true);
  assert.match(res.stdout, /arg2=my prompt/);
});

test("invokeCli: task-review 模式 + task_review_prefix → prompt 前缀合成", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-cs-review-"));
  const binDir = path.join(dir, "bin");
  mkdirSync(binDir);
  const cliPath = path.join(binDir, "echo-cli");
  writeFileSync(cliPath, "#!/usr/bin/env bash\necho \"arg2=$2\"\n");
  chmodSync(cliPath, 0o755);

  const entry = { cli: cliPath, invoke: "-p", output: "text", task_review_prefix: "REVIEW_PREFIX" };
  const res = await invokeCli(entry, "the prompt", "task-review", process.env, dir);
  assert.equal(res.ok, true);
  assert.match(res.stdout, /arg2=REVIEW_PREFIX the prompt/);
});

test("invokeCli: stream-json 模式 → 提取最后 completion finalText", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-cs-stream-"));
  const binDir = path.join(dir, "bin");
  mkdirSync(binDir);
  const event = JSON.stringify({ type: "completion", finalText: "streamed result" });
  const cliPath = path.join(binDir, "stream-cli");
  writeFileSync(cliPath, `#!/usr/bin/env bash\necho '${event}'\n`);
  chmodSync(cliPath, 0o755);

  const entry = { cli: cliPath, invoke: "-p", output: "stream-json", task_review_prefix: "" };
  const res = await invokeCli(entry, "prompt", "implement", process.env, dir);
  assert.equal(res.ok, true);
  assert.equal(res.stdout, "streamed result");
});
