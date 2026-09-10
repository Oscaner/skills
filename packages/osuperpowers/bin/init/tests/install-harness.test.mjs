// init/tests/install-harness.test.mjs — P6b T5: install-harness.mjs per-harness 安装器测试。
// Seams：子进程运行 install-harness.mjs，隔离 HOME + mock PATH；覆盖：
//   - install-and-use 通道（有 CLI 已装）→ 指引 probe → install hint
//   - 未知 harness → exit 非零
//   - dry-run 不写文件
//   - `init gates` 移除（gates → harness）
//（P5 T1 删 Gate 子系统后：原生 gate config 写安装测试随 configs/ 一并移除；
//  install-harness.mjs 仅存 install-and-use 引导通道，本文件随后续任务整体删除。）
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INSTALLER = fileURLToPath(new URL("../install-harness.mjs", import.meta.url));

// 造隔离 HOME + PATH 上的 fake 命令。
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

function run(args, e) {
  return execFileSync("node", [INSTALLER, ...args], { env: e, encoding: "utf8", timeout: 30000 });
}

// ---------------------------------------------------------------- install-and-use → 指引

test("install-and-use harness（claude 已装）→ 指引 probe + install hint，不写文件", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["claude"] });
  const out = run(["--harness", "claude"], e);
  // install-and-use 通道 → 打印 probe hint（不写 config 文件）
  assert.match(out, /claude/);
  assert.ok(!existsSync(path.join(home, ".claude")), "不写 ~/.claude 文件");
});

// ---------------------------------------------------------------- install-and-use → 指引

test("opencode 已装 → 包通道引导 install hint", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["opencode"] });
  const out = run(["--harness", "opencode"], e);
  assert.match(out, /opencode/);
  // opencode 是包通道 —— 引导命令，不写 config
  assert.match(out, /plugin/);
});

// ---------------------------------------------------------------- 未知 harness

test("未知 harness → 退出非零", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  assert.throws(() => run(["--harness", "foo"], env({ home })));
});

// ---------------------------------------------------------------- dry-run

test("dry-run：不写任何机器文件", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["grok", "vibe"] });
  const out = run(["--dry-run", "--harness", "grok,vibe"], e);
  assert.match(out, /dry-run/);
  assert.ok(!existsSync(path.join(home, ".grok", "hooks", "osuperpowers.json")));
  assert.ok(!existsSync(path.join(home, ".vibe", "hooks.toml")));
});

// ---------------------------------------------------------------- pi.mjs 删除验证

test("init harness 不再安装 pi.mjs（pi.ts 替代）", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["pi"] });
  const out = run(["--harness", "pi"], e);
  // pi 现在是 install-and-use 通道 → 引导，不写 .mjs shim
  assert.match(out, /pi/);
  // 确认没有 pi.mjs 被创建（pi.ts 替代）
  const shim = path.join(home, ".pi", "agent", "extensions", "osuperpowers.ts");
  if (existsSync(shim)) {
    const content = readFileSync(shim, "utf8");
    assert.ok(!content.includes("pi.mjs"), "shim 不应引用 pi.mjs（pi.ts 替代）");
  }
});

// ---------------------------------------------------------------- init gates 移除验证

test("init SKILL.md 中 gates 已替换为 harness", () => {
  const skillDir = fileURLToPath(new URL("../../../skills/init", import.meta.url));
  const skillMd = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  assert.ok(!skillMd.includes("init gates"), "SKILL.md 不再引用 init gates");
  assert.ok(skillMd.includes("init harness") || skillMd.includes("harness"), "SKILL.md 引用 harness");
});
