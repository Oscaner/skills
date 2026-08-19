// init/tests/install-harness-gates.test.mjs — P4b T7: install-gates.mjs 安装器测试（T5: 已迁移至 install-harness.mjs）。
// 保留向后兼容路径：所有测试改为指向 install-harness.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveNativeHarnesses } from "../../gate/configs/native-harnesses.mjs";

const INSTALLER = fileURLToPath(new URL("../install-harness.mjs", import.meta.url));
const ALL_HARNESSES = ["trae", "vibe", "kiro", "grok", "pi", "opencode", "gemini", "qoder", "codex"];
const CONFIGS = fileURLToPath(new URL("../../gate/configs", import.meta.url));
// native 集合派生自 configs/（与安装器同一 SOT —— 新增原生 harness 只加目录）。
const NATIVE = deriveNativeHarnesses(CONFIGS);
const PACKAGE_CHANNEL = ALL_HARNESSES.filter((h) => !NATIVE.includes(h));

// 各原生 harness 的机器目标文件（per-harness 具体信息，非集合级硬编码）。
const NATIVE_DEST = {
  trae: (home) => path.join(home, ".trae", "hooks.json"),
  vibe: (home) => path.join(home, ".vibe", "hooks.toml"),
  kiro: (home) => path.join(home, ".kiro", "hooks", "osuperpowers.json"),
  grok: (home) => path.join(home, ".grok", "hooks", "osuperpowers.json"),
  pi: (home) => path.join(home, ".pi", "agent", "extensions", "osuperpowers.ts"),
};

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
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["vibe", "kiro", "grok"] });
  mkdirSync(path.join(home, ".trae"), { recursive: true });
  const out = run(["--dry-run", "--harness", "trae,vibe,kiro,grok"], e);
  assert.match(out, /dry-run/);
  assert.ok(!existsSync(path.join(home, ".trae", "hooks.json")));
  assert.ok(!existsSync(path.join(home, ".vibe", "hooks.toml")));
  assert.ok(!existsSync(path.join(home, ".kiro", "hooks", "osuperpowers.json")));
  assert.ok(!existsSync(path.join(home, ".grok", "hooks", "osuperpowers.json")));
});

test("vibe 检测到 → 写 ~/.vibe/hooks.toml（复制 configs/vibe/hooks.toml）", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["vibe"] });
  run(["--harness", "vibe"], e);
  const p = path.join(home, ".vibe", "hooks.toml");
  assert.ok(existsSync(p), `expected ${p} written`);
  assert.ok(readFileSync(p, "utf8").includes("pre_tool"));
});

test("未知 harness → 退出非零", () => {
  const home = mkdtempSync("/tmp/init-");
  assert.throws(() => run(["--harness", "foo"], env({ home })));
});

test("grok 已装 → 写 ~/.grok/hooks/osuperpowers.json + 打印/执行 `grok --trust`", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["grok"] });
  const out = run(["--harness", "grok"], e);
  const p = path.join(home, ".grok", "hooks", "osuperpowers.json");
  assert.ok(existsSync(p), `expected ${p} written`);
  assert.match(out, /grok --trust/);
});

test("pi 已装 → 写 ~/.pi/agent/extensions/osuperpowers.ts（manual extension copy，re-export 包内 adapter）", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["pi"] });
  run(["--harness", "pi"], e);
  const p = path.join(home, ".pi", "agent", "extensions", "osuperpowers.ts");
  assert.ok(existsSync(p), `expected ${p} written`);
  const text = readFileSync(p, "utf8");
  assert.match(text, /export/);
  assert.ok(text.includes("pi.ts"), "shim 指向包内 pi adapter（.ts，T5 删除 pi.mjs）");
});

test("pi 目标已存在且非模板生成 → 跳过不覆盖（幂等 guard，保留用户文件）", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["pi"] });
  const dir = path.join(home, ".pi", "agent", "extensions");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "osuperpowers.ts"), "export const user = true;\n");
  const out = run(["--harness", "pi"], e);
  const p = path.join(dir, "osuperpowers.ts");
  assert.equal(readFileSync(p, "utf8"), "export const user = true;\n", "用户文件不被覆盖");
  assert.match(out, /跳过/);
});

test("pi 目标已存在且为模板生成 → 幂等覆盖更新（指回包内 adapter）", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["pi"] });
  const dir = path.join(home, ".pi", "agent", "extensions");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "osuperpowers.ts"),
    "// osuperpowers harness — Pi TS extension（manual extension copy）。\nexport { default } from \"/old/path/pi.ts\";\n",
  );
  run(["--harness", "pi"], e);
  const p = path.join(dir, "osuperpowers.ts");
  const text = readFileSync(p, "utf8");
  assert.ok(text.includes("pi.ts"), "模板生成文件被覆盖更新");
  assert.ok(
    text.includes(path.join("bin", "gate", "adapters", "pi.ts")),
    "覆盖后指向包内 adapter 路径（.ts，T5 删除 pi.mjs）",
  );
});

test("原生集合（configs/ 派生）写原生 config；包通道只引导命令", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ALL_HARNESSES });
  mkdirSync(path.join(home, ".trae"), { recursive: true });
  const out = run(["--harness", ALL_HARNESSES.join(",")], e);
  // 派生出的原生 harness 各自写原生 config
  for (const name of NATIVE) {
    assert.ok(NATIVE_DEST[name], `test 需知道 ${name} 的目标文件`);
    const dest = NATIVE_DEST[name](home);
    assert.ok(existsSync(dest), `expected ${dest} written for native ${name}`);
  }
  // 包通道 harness 只引导命令 —— 不写文件
  for (const h of PACKAGE_CHANNEL) {
    assert.ok(!existsSync(path.join(home, `.${h}`)), `expected no ~/.${h} dir`);
  }
  // pi 已是原生 config（manual extension copy）—— 写 ~/.pi/agent/extensions/osuperpowers.ts
  assert.match(out, /opencode\.json/);
  assert.match(out, /gemini extensions install/);
  assert.match(out, /\.qoder-plugin/);
  assert.match(out, /\.codex-plugin/);
});

test("codex/gemini 引导时打印 trust 下一步（/hooks / 首次指纹）", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["codex", "gemini"] });
  const out = run(["--harness", "codex,gemini"], e);
  assert.match(out, /codex/);
  assert.match(out, /\/hooks 审查并信任 osuperpowers 钩子/);
  assert.match(out, /gemini/);
  assert.match(out, /首次使用接受项目 hook 指纹确认/);
});

test("幂等：重复运行覆盖原生 config 不报错", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["grok"] });
  run(["--harness", "grok"], e);
  run(["--harness", "grok"], e); // 第二次不抛错
  const p = path.join(home, ".grok", "hooks", "osuperpowers.json");
  assert.ok(existsSync(p));
  assert.ok(readFileSync(p, "utf8").includes("grok.mjs"));
});

test("grok config 已存在 → 保留用户非冲突内容（merge 而非覆盖）", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["grok"] });
  const dir = path.join(home, ".grok", "hooks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "osuperpowers.json"),
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
  const merged = JSON.parse(readFileSync(path.join(dir, "osuperpowers.json"), "utf8"));
  assert.equal(merged.custom, "user-value"); // 用户顶层 key 保留
  assert.ok(merged.hooks.PreToolUse.some((h) => h.matcher === "Write|Edit")); // 我们的 Write|Edit gate 加入
  assert.ok(merged.hooks.PreToolUse.some((h) => h.matcher === "Other")); // 用户条目保留
});

test("grok config 已存在且 hooks[event] 为对象形 → 保留用户对象（模板数组不覆盖）", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["grok"] });
  const dir = path.join(home, ".grok", "hooks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "osuperpowers.json"),
    JSON.stringify({
      hooks: {
        PreToolUse: { matcher: "user-object-form", custom: true },
      },
    }),
  );
  run(["--harness", "grok"], e);
  const merged = JSON.parse(readFileSync(path.join(dir, "osuperpowers.json"), "utf8"));
  assert.equal(merged.hooks.PreToolUse.matcher, "user-object-form", "用户对象形值保留");
  assert.equal(merged.hooks.PreToolUse.custom, true);
  assert.ok(!Array.isArray(merged.hooks.PreToolUse), "对象形不被模板数组覆盖");
});

test("kiro config 已存在（数组形）→ 保留用户非冲突条目（merge 数组形 hooks）", () => {
  const home = mkdtempSync("/tmp/init-");
  const e = env({ home, commands: ["kiro"] });
  const dir = path.join(home, ".kiro", "hooks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "osuperpowers.json"),
    JSON.stringify({
      hooks: [{ trigger: "PreToolUse", command: "/usr/bin/custom-gate" }],
    }),
  );
  run(["--harness", "kiro"], e);
  const merged = JSON.parse(readFileSync(path.join(dir, "osuperpowers.json"), "utf8"));
  assert.ok(Array.isArray(merged.hooks), "kiro hooks 保持数组形");
  assert.ok(merged.hooks.some((h) => h.command === "/usr/bin/custom-gate"), "用户条目保留");
  assert.ok(merged.hooks.some((h) => typeof h.command === "string" && h.command.includes("kiro.mjs")), "我们的 gate 加入");
});
