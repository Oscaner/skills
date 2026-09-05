// bin/tests/cdd-research.test.mjs — T2: cdd-research CLI 单测。
// 测试 --help 退出码、必需参数校验、dry-run 模式、端到端 mock harness。
import { it, expect } from 'vitest';
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

it("cdd-research: --help 退出 exit 0", () => {
  const r = runCli(["--help"]);
  expect(r.exitCode).toBe(0);
});

it("cdd-research: 缺少 --harness 退出 exit 2", () => {
  const r = runCli(["--brief", "/tmp/x.md", "--output", "/tmp/o.md"]);
  expect(r.exitCode).toBe(2);
});

it("cdd-research: 缺少 --brief 退出 exit 2", () => {
  const r = runCli(["--harness", "claude", "--output", "/tmp/o.md"]);
  expect(r.exitCode).toBe(2);
});

it("cdd-research: 缺少 --output 退出 exit 2", () => {
  const r = runCli(["--harness", "claude", "--brief", "/tmp/x.md"]);
  expect(r.exitCode).toBe(2);
});

it("cdd-research: 未知 --harness 退出 exit 1", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-harness-"));
  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "# test brief\n");
  const outputPath = path.join(dir, "findings.md");
  const r = runCli([
    "--harness", "nonexistent-harness-xyz",
    "--brief", briefPath,
    "--output", outputPath,
  ]);
  expect(r.exitCode).toBe(1);
});

// --- Slice 2: Dry-run mode ---

it("cdd-research: dry-run 跳过 harness 执行 (exit 0)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-dry-"));
  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "# test brief\n");
  const outputPath = path.join(dir, "findings.md");
  const r = runCli([
    "--harness", "claude",
    "--brief", briefPath,
    "--output", outputPath,
  ], { env: { CDD_DRY_RUN: "1" } });
  expect(r.exitCode).toBe(0);
});

// --- Slice 3: End-to-end mock harness ---

it("cdd-research: mock harness + 有效 brief → dry-run 验证参数解析", () => {
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
  expect(r.exitCode).toBe(0);
});

it("cdd-research: 端到端 mock harness → stdout 写入 output 文件", () => {
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
  expect(r.exitCode).toBe(0);
  expect(existsSync(outputPath), "output file should exist").toBe(true);
  const content = readFileSync(outputPath, "utf8");
  expect(content).toContain("Research Findings");
  expect(content).toContain("JWT validation");
});

// --- Slice 4: Error paths ---

it("cdd-research: brief 文件不存在 → exit 1", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-nobrief-"));
  const outputPath = path.join(dir, "findings.md");
  const r = runCli([
    "--harness", "claude",
    "--brief", "/nonexistent/brief.md",
    "--output", outputPath,
  ]);
  expect(r.exitCode).toBe(1);
});

it("cdd-research: 未知参数 → exit 2", () => {
  const r = runCli(["--unknown-flag"]);
  expect(r.exitCode).toBe(2);
});

// --- Slice 5: timeout reuse (spawnCapture) + partial TIMEOUT findings ---

// 挂起 harness（sleep 长时）+ 极短 timeout → spawnCapture 触发 timedOut。
// 用 `exec sleep` 替换 shell 进程（而非 fork 子进程）：被 timeout SIGTERM 后无
// 孤儿孙进程持有 stdout 管道，execa/close 能立即 resolve（否则拖到 sleep 结束）。
function makeHangHarness(dir) {
  const mockCli = path.join(dir, "hang-harness.sh");
  writeFileSync(mockCli, "#!/bin/sh\nexec sleep 30\n");
  chmodSync(mockCli, 0o755);
  return mockCli;
}

function makeTimeoutRegistry(dir) {
  const registryPath = path.join(dir, "registry.json");
  writeFileSync(registryPath, JSON.stringify({
    "mock-timeout-harness": {
      ship: "full",
      cli: "hang-harness.sh",
      invoke: "-p",
      output: "text",
    },
  }));
  return registryPath;
}

it("cdd-research: timeout → 写 partial findings + TIMEOUT frontmatter + exit 1", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-timeout-"));
  makeHangHarness(dir);
  const registryPath = makeTimeoutRegistry(dir);
  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "Analyze the auth module.");
  const outputPath = path.join(dir, "findings.md");

  const r = runCli([
    "--harness", "mock-timeout-harness",
    "--brief", briefPath,
    "--output", outputPath,
  ], {
    env: {
      CDD_REGISTRY_PATH: registryPath,
      PATH: `${dir}:${process.env.PATH}`,
      CDD_RESEARCH_TIMEOUT: "1",
    },
  });
  expect(r.exitCode).toBe(1);
  expect(existsSync(outputPath), "partial findings file should exist on timeout").toBe(true);
  const content = readFileSync(outputPath, "utf8");
  expect(content).toContain("TIMEOUT");
});

it("cdd-research: 旧 RESEARCH_TIMEOUT 向后兼容（秒级，仍生效）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-legacy-"));
  makeHangHarness(dir);
  const registryPath = makeTimeoutRegistry(dir);
  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "Analyze the auth module.");
  const outputPath = path.join(dir, "findings.md");

  // RESEARCH_TIMEOUT=1（秒）→ 极短 timeout → 挂起 harness 超时退出 1。
  // 若旧 env 未被读取，会退回 1800000ms 默认，sleep 30 在 execFileSync 10s 截断内未超时 → exit 0 ≠ 1。
  const r = runCli([
    "--harness", "mock-timeout-harness",
    "--brief", briefPath,
    "--output", outputPath,
  ], {
    env: {
      CDD_REGISTRY_PATH: registryPath,
      PATH: `${dir}:${process.env.PATH}`,
      RESEARCH_TIMEOUT: "1",
    },
  });
  expect(r.exitCode).toBe(1, "legacy RESEARCH_TIMEOUT=1 should trigger timeout");
  expect(existsSync(outputPath), "partial findings file should exist").toBe(true);
  expect(readFileSync(outputPath, "utf8")).toContain("TIMEOUT");
});

it("cdd-research: CDD_RESEARCH_TIMEOUT 优先于旧 RESEARCH_TIMEOUT（秒级）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-prio-"));
  makeHangHarness(dir);
  const registryPath = makeTimeoutRegistry(dir);
  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "Analyze the auth module.");
  const outputPath = path.join(dir, "findings.md");

  // CDD_RESEARCH_TIMEOUT=1（优先）→ 超时；RESEARCH_TIMEOUT=900 不应生效（否则 30s 内 sleep 完成 exit 0）。
  const r = runCli([
    "--harness", "mock-timeout-harness",
    "--brief", briefPath,
    "--output", outputPath,
  ], {
    env: {
      CDD_REGISTRY_PATH: registryPath,
      PATH: `${dir}:${process.env.PATH}`,
      CDD_RESEARCH_TIMEOUT: "1",
      RESEARCH_TIMEOUT: "900",
    },
  });
  expect(r.exitCode).toBe(1, "new CDD_RESEARCH_TIMEOUT=1 should win over RESEARCH_TIMEOUT=900");
  expect(readFileSync(outputPath, "utf8")).toContain("TIMEOUT");
});

it("cdd-research: 充足 timeout 下挂起 harness 正常完成（不误判 timeout）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-res-okto-"));
  const mockCli = path.join(dir, "sleep-harness.sh");
  writeFileSync(mockCli, "#!/bin/sh\necho \"# Research Findings\n\nSlept then finished.\"\n");
  chmodSync(mockCli, 0o755);
  const registryPath = path.join(dir, "registry.json");
  writeFileSync(registryPath, JSON.stringify({
    "mock-timeout-harness": { ship: "full", cli: "sleep-harness.sh", invoke: "-p", output: "text" },
  }));
  const briefPath = path.join(dir, "brief.md");
  writeFileSync(briefPath, "Analyze the auth module.");
  const outputPath = path.join(dir, "findings.md");

  // RESEARCH_TIMEOUT=900（足够）→ 立即完成的 echo harness → exit 0，无 TIMEOUT。
  const r = runCli([
    "--harness", "mock-timeout-harness",
    "--brief", briefPath,
    "--output", outputPath,
  ], {
    env: {
      CDD_REGISTRY_PATH: registryPath,
      PATH: `${dir}:${process.env.PATH}`,
      RESEARCH_TIMEOUT: "900",
    },
  });
  expect(r.exitCode).toBe(0, "sufficient timeout should not trigger timeout path");
  expect(readFileSync(outputPath, "utf8")).toContain("Research Findings");
});