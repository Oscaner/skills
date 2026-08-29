// engine/tests/cdd-research.test.mjs — T2: cdd-research CLI 单测。
// 测试 --help 退出码、必需参数校验、dry-run 模式、端到端 mock harness。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CLI = path.resolve(import.meta.dirname, "../cdd-research.mjs");

function runCli(args = [], opts = {}) {
  const { env: extraEnv, ...spawnOpts } = opts;
  const env = { ...process.env, ...extraEnv };
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      timeout: 10_000,
      encoding: "utf8",
      env,
      ...spawnOpts,
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

// --- Slice 1: CLI exit codes ---

test("cdd-research: --help 退出 exit 0", () => {
  const r = runCli(["--help"]);
  assert.equal(r.exitCode, 0);
});

test("cdd-research: 缺少 --harness 退出 exit 2", () => {
  const r = runCli(["--brief", "/tmp/x.md", "--output", "/tmp/o.md"]);
  assert.equal(r.exitCode, 2);
});

test("cdd-research: 缺少 --brief 退出 exit 2", () => {
  const r = runCli(["--harness", "claude", "--output", "/tmp/o.md"]);
  assert.equal(r.exitCode, 2);
});

test("cdd-research: 缺少 --output 退出 exit 2", () => {
  const r = runCli(["--harness", "claude", "--brief", "/tmp/x.md"]);
  assert.equal(r.exitCode, 2);
});

test("cdd-research: 未知 --harness 退出 exit 1", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-harness-"));
  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "# test brief\n");
  const outputPath = path.join(dir, "findings.md");
  const r = runCli([
    "--harness", "nonexistent-harness-xyz",
    "--brief", briefPath,
    "--output", outputPath,
  ]);
  assert.equal(r.exitCode, 1);
});

// --- Slice 2: Dry-run mode ---

test("cdd-research: dry-run 跳过 harness 执行 (exit 0)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-dry-"));
  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "# test brief\n");
  const outputPath = path.join(dir, "findings.md");
  const r = runCli([
    "--harness", "claude",
    "--brief", briefPath,
    "--output", outputPath,
  ], { env: { CDD_DRY_RUN: "1" } });
  assert.equal(r.exitCode, 0);
});

// --- Slice 3: End-to-end mock harness ---

test("cdd-research: mock harness + 有效 brief → dry-run 验证参数解析", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-e2e-"));

  // 创建 mock harness binary
  const mockCli = path.join(dir, "mock-harness.sh");
  writeFileSync(
    mockCli,
    '#!/bin/sh\necho "# Research Findings\n\nMock harness output for testing."\n',
  );
  chmodSync(mockCli, 0o755);

  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "# Research Brief\n\nAnalyze the auth module.");
  const outputPath = path.join(dir, "findings.md");

  // 创建 mock registry（cli 字段用 basename，靠 PATH 指向 dir）
  const registryPath = path.join(dir, "registry.json");
  writeFileSync(registryPath, JSON.stringify({
    "mock-test-harness": {
      ship: "full",
      cli: "mock-harness.sh",
      invoke: "-p",
      output: "text",
    },
  }));

  const r = runCli([
    "--harness", "mock-test-harness",
    "--brief", briefPath,
    "--output", outputPath,
  ], { env: { CDD_DRY_RUN: "1", CDD_REGISTRY_PATH: registryPath } });
  assert.equal(r.exitCode, 0);
});

test("cdd-research: 端到端 mock harness → stdout 写入 output 文件", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-e2e-write-"));

  // 创建 mock harness binary（输出 research findings 内容）
  const mockCli = path.join(dir, "mock-harness.sh");
  writeFileSync(
    mockCli,
    '#!/bin/sh\necho "# Research Findings\n\nAuth module uses JWT validation."',
  );
  chmodSync(mockCli, 0o755);

  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "Analyze the auth module.");
  const outputPath = path.join(dir, "findings.md");

  // 创建 mock registry（cli 字段用 basename，靠 PATH 指向 dir）
  const registryPath = path.join(dir, "registry.json");
  writeFileSync(registryPath, JSON.stringify({
    "mock-test-harness": {
      ship: "full",
      cli: "mock-harness.sh",
      invoke: "-p",
      output: "text",
    },
  }));

  const r = runCli([
    "--harness", "mock-test-harness",
    "--brief", briefPath,
    "--output", outputPath,
  ], { env: { CDD_REGISTRY_PATH: registryPath, PATH: `${dir}:${process.env.PATH}` } });
  assert.equal(r.exitCode, 0);
  assert.ok(existsSync(outputPath), "output file should exist");
  const content = readFileSync(outputPath, "utf8");
  assert.ok(content.includes("Research Findings"), "output should contain findings");
  assert.ok(content.includes("JWT validation"), "output should contain harness output");
});

// --- Slice 4: Error paths ---

test("cdd-research: brief 文件不存在 → exit 1", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-nobrief-"));
  const outputPath = path.join(dir, "findings.md");
  const r = runCli([
    "--harness", "claude",
    "--brief", "/nonexistent/brief.md",
    "--output", outputPath,
  ]);
  assert.equal(r.exitCode, 1);
});

test("cdd-research: 未知参数 → exit 2", () => {
  const r = runCli(["--unknown-flag"]);
  assert.equal(r.exitCode, 2);
});
