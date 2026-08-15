// os-init/tests/install-gates.test.mjs — P4b T7: install-gates.mjs 安装器测试。
// 隔离 HOME：以子进程运行安装器，HOME 指向临时目录；检测通过 PATH 上的 fake 命令
// （vibe/kiro/grok/pi/opencode/gemini/qoder/codex）与 ~/.trae 目录存在来驱动。
// 覆盖：--dry-run 不写、无包通道 4 个（trae/vibe/kiro/grok）写原生 config、
// 包通道 5 个只引导命令、未知 harness 退出非零、幂等、保留用户非冲突内容。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INSTALLER = fileURLToPath(new URL("../install-gates.mjs", import.meta.url));
const ALL_HARNESSES = ["trae", "vibe", "kiro", "grok", "pi", "opencode", "gemini", "qoder", "codex"];

// 造隔离 HOME + PATH 上的 fake 命令（executable 占位）。
function env({ home, commands = [] }) {
  const bin = path.join(home, "bin");
  mkdirSync(bin, { recursive: true });
  for (const name of commands) {
    writeFileSync(path.join(bin, name), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  }
  return {
    ...process.env,
    HOME: home,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
  };
}

// 以子进程运行安装器；非零退出 → execFileSync 抛错（供 assert.throws 用）。
function run(args, e) {
  return execFileSync("node", [INSTALLER, ...args], { env: e, encoding: "utf8", timeout: 30000 });
}

test("dry-run：不写任何机器文件", () => {
  const home = mkdtempSync("/tmp/os-init-");
  const e = env({ home, commands: ["vibe", "kiro", "grok"] });
  mkdirSync(path.join(home, ".trae"), { recursive: true });
  const out = run(["--dry-run", "--harness", "trae,vibe,kiro,grok"], e);
  assert.match(out, /dry-run/);
  assert.ok(!existsSync(path.join(home, ".trae", "hooks.json")));
  assert.ok(!existsSync(path.join(home, ".vibe", "hooks.toml")));
  assert.ok(!existsSync(path.join(home, ".kiro", "hooks", "engineering.json")));
  assert.ok(!existsSync(path.join(home, ".grok", "hooks", "engineering.json")));
});

test("vibe 检测到 → 写 ~/.vibe/hooks.toml（复制 configs/vibe/hooks.toml）", () => {
  const home = mkdtempSync("/tmp/os-init-");
  const e = env({ home, commands: ["vibe"] });
  run(["--harness", "vibe"], e);
  const p = path.join(home, ".vibe", "hooks.toml");
  assert.ok(existsSync(p), `expected ${p} written`);
  assert.ok(readFileSync(p, "utf8").includes("pre_tool"));
});

test("未知 harness → 退出非零", () => {
  const home = mkdtempSync("/tmp/os-init-");
  assert.throws(() => run(["--harness", "foo"], env({ home })));
});

test("grok 已装 → 写 ~/.grok/hooks/engineering.json + 打印/执行 `grok --trust`", () => {
  const home = mkdtempSync("/tmp/os-init-");
  const e = env({ home, commands: ["grok"] });
  const out = run(["--harness", "grok"], e);
  const p = path.join(home, ".grok", "hooks", "engineering.json");
  assert.ok(existsSync(p), `expected ${p} written`);
  assert.match(out, /grok --trust/);
});

test("trae/vibe/kiro/grok 是唯一写原生 config 的；pi/opencode/gemini/qoder/codex 只引导命令", () => {
  const home = mkdtempSync("/tmp/os-init-");
  const e = env({ home, commands: ALL_HARNESSES });
  mkdirSync(path.join(home, ".trae"), { recursive: true });
  const out = run(["--harness", ALL_HARNESSES.join(",")], e);
  // 无包通道 4 个写原生 config
  assert.ok(existsSync(path.join(home, ".trae", "hooks.json")));
  assert.ok(existsSync(path.join(home, ".vibe", "hooks.toml")));
  assert.ok(existsSync(path.join(home, ".kiro", "hooks", "engineering.json")));
  assert.ok(existsSync(path.join(home, ".grok", "hooks", "engineering.json")));
  // 包通道 5 个只引导命令 —— 不写文件
  for (const h of ["pi", "opencode", "gemini", "qoder", "codex"]) {
    assert.ok(!existsSync(path.join(home, `.${h}`)), `expected no ~/.${h} dir`);
  }
  assert.match(out, /pi install @oscaner-skills\/engineering/);
  assert.match(out, /opencode\.json/);
  assert.match(out, /gemini extensions install/);
  assert.match(out, /\.qoder-plugin/);
  assert.match(out, /\.codex-plugin/);
});

test("幂等：重复运行覆盖原生 config 不报错", () => {
  const home = mkdtempSync("/tmp/os-init-");
  const e = env({ home, commands: ["grok"] });
  run(["--harness", "grok"], e);
  run(["--harness", "grok"], e); // 第二次不抛错
  const p = path.join(home, ".grok", "hooks", "engineering.json");
  assert.ok(existsSync(p));
  assert.ok(readFileSync(p, "utf8").includes("grok.mjs"));
});

test("grok config 已存在 → 保留用户非冲突内容（merge 而非覆盖）", () => {
  const home = mkdtempSync("/tmp/os-init-");
  const e = env({ home, commands: ["grok"] });
  const dir = path.join(home, ".grok", "hooks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "engineering.json"),
    JSON.stringify({
      custom: "user-value",
      hooks: {
        PreToolUse: [
          { matcher: "Other", hooks: [{ type: "command", command: "/usr/bin/custom-gate" }] },
        ],
      },
    }),
  );
  run(["--harness", "grok"], e);
  const merged = JSON.parse(readFileSync(path.join(dir, "engineering.json"), "utf8"));
  assert.equal(merged.custom, "user-value"); // 用户顶层 key 保留
  assert.ok(merged.hooks.PreToolUse.some((h) => h.matcher === "Write|Edit")); // 我们的 Write|Edit gate 加入
  assert.ok(merged.hooks.PreToolUse.some((h) => h.matcher === "Other")); // 用户条目保留
});
