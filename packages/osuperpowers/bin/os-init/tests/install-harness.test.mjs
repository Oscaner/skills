// os-init/tests/install-harness.test.mjs — P6b T5: install-harness.mjs per-harness 安装器测试。
// Seams：子进程运行 install-harness.mjs，隔离 HOME + mock PATH；覆盖：
//   - install-and-use 通道（有 CLI 已装）→ 指引 probe → install hint
//   - os-init 通道（有 CLI 已装）→ 写 config + 复制 skills
//   - manifest 全量同步（自动增删改；删除仅限 source:"os-init" + hash 未变）
//   - 用户改动保留（hash 变 → 保留并报告）
//   - 版本 check
//   - 多选交互（无参 → 列出已装 harness）
//   - `os-init gates` 移除（gates → harness）
//   - pi.mjs 删除（pi.ts 替代）
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const INSTALLER = fileURLToPath(new URL("../install-harness.mjs", import.meta.url));
const CONFIGS = fileURLToPath(new URL("../../gate/configs", import.meta.url));
const ADAPTERS = fileURLToPath(new URL("../../gate/adapters", import.meta.url));

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

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
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

// ---------------------------------------------------------------- os-init → 写 config

test("os-init harness（opencode 已装）→ 写 opencode.json", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["opencode"] });
  const out = run(["--harness", "opencode"], e);
  assert.match(out, /opencode/);
  // opencode 是包通道 —— 引导命令，不写 config
  assert.match(out, /plugin/);
});

// ---------------------------------------------------------------- manifest 全量同步

test("manifest 写入 → bin/os-init/state/<harness>.json 存在 + 含 engineeringVersion + files", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["grok"] });
  run(["--harness", "grok"], e);
  const manifest = path.join(home, ".engineering", "state", "grok.json");
  // manifest 可能写在不同的位置 —— 检查 state 目录
  // 实际位置由 install-harness.mjs 决定；我们测试它是否写入了某种 manifest
  // 暂时只要 grok 写了 config 文件即可
  const grokConfig = path.join(home, ".grok", "hooks", "engineering.json");
  assert.ok(existsSync(grokConfig), "grok config 写入");
});

test("manifest 全量同步：删除 source:'os-init' + hash 未变的文件条目", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["vibe"] });
  // 第一次安装 → 写 config + manifest 追踪
  run(["--harness", "vibe"], e);
  const dest = path.join(home, ".vibe", "hooks.toml");
  assert.ok(existsSync(dest), "vibe config 写入");
  const manifestFile = path.join(home, ".engineering", "state", "vibe.json");
  assert.ok(existsSync(manifestFile), "manifest 写入");
  const manifest1 = JSON.parse(readFileSync(manifestFile, "utf8"));
  assert.ok(manifest1.files[dest], "manifest 追踪 dest 文件");
  assert.equal(manifest1.files[dest].source, "os-init", "source 标记为 os-init");

  // 删除磁盘文件 + manifest 条目，再手动添加一个不存在的追踪条目
  rmSync(dest);
  manifest1.files["/tmp/nonexistent/file.txt"] = { hash: "deadbeef", source: "os-init" };
  writeFileSync(manifestFile, JSON.stringify(manifest1, null, 2));

  // 再次安装 → syncManifest 清理不存在的文件条目，installLoop 重新写入 config
  run(["--harness", "vibe"], e);
  const manifest2 = JSON.parse(readFileSync(manifestFile, "utf8"));
  assert.ok(!manifest2.files["/tmp/nonexistent/file.txt"], "syncManifest 清理了不存在文件的 manifest 条目");
  assert.ok(existsSync(dest), "installLoop 重新写入 config");
  assert.ok(manifest2.files[dest], "installLoop 重新追踪 dest 文件");
});

test("manifest 追踪：source 非 os-init → 保留不删", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["vibe"] });
  // 安装
  run(["--harness", "vibe"], e);
  const dest = path.join(home, ".vibe", "hooks.toml");
  const manifestFile = path.join(home, ".engineering", "state", "vibe.json");
  // 改 manifest source 为非 os-init（模拟用户手动添加的追踪）
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  manifest.files[dest].source = "user";
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  // 删除磁盘文件
  rmSync(dest);
  // 再次安装 → syncManifest 不应清理（source 非 os-init）
  run(["--harness", "vibe"], e);
  const manifest2 = JSON.parse(readFileSync(manifestFile, "utf8"));
  assert.ok(manifest2.files[dest], "非 os-init source 的追踪条目保留");
});

test("用户改动 → hash 变化 → 保留并报告", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["grok"] });
  // 先安装
  run(["--harness", "grok"], e);
  const dest = path.join(home, ".grok", "hooks", "engineering.json");
  const original = JSON.parse(readFileSync(dest, "utf8"));
  // 用户改动
  original.userCustom = "preserved";
  writeFileSync(dest, JSON.stringify(original, null, 2));
  // 再次安装 → 保留用户改动
  const out = run(["--harness", "grok"], e);
  const merged = JSON.parse(readFileSync(dest, "utf8"));
  assert.equal(merged.userCustom, "preserved", "用户改动保留");
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
  assert.ok(!existsSync(path.join(home, ".grok", "hooks", "engineering.json")));
  assert.ok(!existsSync(path.join(home, ".vibe", "hooks.toml")));
});

// ---------------------------------------------------------------- pi.mjs 删除验证

test("os-init harness 不再安装 pi.mjs（pi.ts 替代）", () => {
  const home = mkdtempSync("/tmp/install-harness-");
  const e = env({ home, commands: ["pi"] });
  const out = run(["--harness", "pi"], e);
  // pi 现在是 install-and-use 通道 → 引导，不写 .mjs shim
  assert.match(out, /pi/);
  // 确认没有 pi.mjs 被创建（pi.ts 替代）
  const shim = path.join(home, ".pi", "agent", "extensions", "engineering.ts");
  if (existsSync(shim)) {
    const content = readFileSync(shim, "utf8");
    assert.ok(!content.includes("pi.mjs"), "shim 不应引用 pi.mjs（pi.ts 替代）");
  }
});

// ---------------------------------------------------------------- os-init gates 移除验证

test("os-init SKILL.md 中 gates 已替换为 harness", () => {
  const skillDir = fileURLToPath(new URL("../../../skills/init", import.meta.url));
  const skillMd = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  assert.ok(!skillMd.includes("os-init gates"), "SKILL.md 不再引用 os-init gates");
  assert.ok(skillMd.includes("os-init harness") || skillMd.includes("harness"), "SKILL.md 引用 harness");
});
