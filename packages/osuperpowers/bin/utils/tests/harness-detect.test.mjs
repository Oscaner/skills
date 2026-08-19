// bin/utils/tests/harness-detect.test.mjs — P6b T5: harness-detect util 测试。
// Seams（测试边界）：detectInstalledHarnesses(config) 纯函数 —— mock PATH 内的
//   fake 二进制模拟 command -v；config 传入，返回 installed harnesses 列表。
//   不测：真实 harness CLI、cdd-select 集成。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { detectInstalledHarnesses } from "../harness-detect.mjs";

// 写可执行假 CLI 到 mockdir（对齐 skills-probe.test.mjs makeMockDir 模式）。
function makeMockDir(scripts = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "harness-detect-mock-"));
  for (const [name, body] of Object.entries(scripts)) {
    const p = path.join(dir, name);
    writeFileSync(p, `#!/bin/sh\n${body}\n`);
    chmodSync(p, 0o755);
  }
  return dir;
}

// hermetic env：mock PATH 仅含 mockdir（隔离真实 CLI）。
function envWith(mockDir, home) {
  return {
    ...process.env,
    PATH: mockDir,
    HOME: home ?? mkdtempSync(path.join(tmpdir(), "harness-detect-home-")),
  };
}

// config fixture：12 harness，有 cli 字段 + channel 分类。
const CONFIG = {
  channel: {
    "install-and-use": ["claude", "cursor-agent", "droid", "grok", "qoder", "codex", "gemini", "pi"],
    "init": ["opencode", "trae", "vibe", "kiro"],
  },
  harnesses: {
    claude: { cli: "claude", probe: "plugin-list" },
    "cursor-agent": { cli: "cursor-agent", probe: "skill-dir", dirs: [".agents/skills"] },
    droid: { cli: "droid", probe: "skill-dir", dirs: [".agents/skills"] },
    grok: { cli: "grok", probe: "plugin-list" },
    qoder: { cli: "qoder", probe: "skill-dir", dirs: [".qoder/skills"] },
    codex: { cli: "codex", probe: "skill-dir", dirs: [".agents/skills"] },
    gemini: { cli: "gemini", probe: "skill-dir", dirs: [".gemini/skills"] },
    pi: { cli: "pi", probe: "package-list" },
    opencode: { cli: "opencode", probe: "skill-dir", dirs: [".opencode/skills"] },
    trae: { cli: "trae", probe: "skill-dir", dirs: [".agents/skills"] },
    vibe: { cli: "vibe", probe: "skill-dir", dirs: [".agents/skills"] },
    kiro: { cli: "kiro", probe: "skill-dir", dirs: [".kiro/skills"] },
  },
};

// ---------------------------------------------------------------- cli 字段优先

test("detectInstalledHarnesses: cli 字段优先（cli 存在 → installed）", () => {
  const mock = makeMockDir({ claude: "exit 0", droid: "exit 0" });
  const result = detectInstalledHarnesses(CONFIG, { env: envWith(mock) });
  const names = result.filter((h) => h.installed).map((h) => h.name);
  assert.ok(names.includes("claude"));
  assert.ok(names.includes("droid"));
});

test("detectInstalledHarnesses: cli 字段优先（cli 不存在 → not installed）", () => {
  const mock = makeMockDir({}); // 无 fake CLI
  const result = detectInstalledHarnesses(CONFIG, { env: envWith(mock) });
  const names = result.filter((h) => h.installed).map((h) => h.name);
  assert.ok(!names.includes("claude"));
  assert.ok(!names.includes("droid"));
});

test("detectInstalledHarnesses: 无 cli 字段 → 回退 harness name（name 即 CLI）", () => {
  // 造一个没有 cli 字段的 config
  const cfgNoCli = {
    harnesses: {
      myharness: { probe: "skill-dir", dirs: [".agents/skills"] },
    },
  };
  const mock = makeMockDir({ myharness: "exit 0" });
  const result = detectInstalledHarnesses(cfgNoCli, { env: envWith(mock) });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "myharness");
  assert.equal(result[0].installed, true);
});

// ---------------------------------------------------------------- channel 标记

test("detectInstalledHarnesses: install-and-use 通道的已装 harness 标记 channel=install-and-use", () => {
  const mock = makeMockDir({ claude: "exit 0", pi: "exit 0" });
  const result = detectInstalledHarnesses(CONFIG, { env: envWith(mock) });
  const claude = result.find((h) => h.name === "claude");
  assert.ok(claude);
  assert.equal(claude.installed, true);
  assert.equal(claude.channel, "install-and-use");
  const pi = result.find((h) => h.name === "pi");
  assert.ok(pi);
  assert.equal(pi.channel, "install-and-use");
});

test("detectInstalledHarnesses: init 通道的已装 harness 标记 channel=init", () => {
  const mock = makeMockDir({ opencode: "exit 0", trae: "exit 0" });
  const result = detectInstalledHarnesses(CONFIG, { env: envWith(mock) });
  const oc = result.find((h) => h.name === "opencode");
  assert.ok(oc);
  assert.equal(oc.channel, "init");
  const tr = result.find((h) => h.name === "trae");
  assert.ok(tr);
  assert.equal(tr.channel, "init");
});

// ---------------------------------------------------------------- 返回 shape

test("detectInstalledHarnesses: 返回全部 12 harness（installed true/false）", () => {
  const mock = makeMockDir({ claude: "exit 0" });
  const result = detectInstalledHarnesses(CONFIG, { env: envWith(mock) });
  assert.equal(result.length, 12, "应返回全部 12 harness");
  const claude = result.find((h) => h.name === "claude");
  assert.equal(claude.installed, true);
  const droid = result.find((h) => h.name === "droid");
  assert.equal(droid.installed, false);
});

// ---------------------------------------------------------------- command -v 对齐

test("detectInstalledHarnesses: 不可执行文件不视为已装", () => {
  const mock = makeMockDir({ claude: "exit 0" });
  // 手动写一个不可执行文件
  const p = path.join(mock, "droid");
  writeFileSync(p, "#!/bin/sh\nexit 0\n");
  // 不 chmod → 不可执行；hermetic PATH 仅含 mockdir
  const result = detectInstalledHarnesses(CONFIG, { env: envWith(mock) });
  const droid = result.find((h) => h.name === "droid");
  assert.equal(droid.installed, false, "不可执行文件应为 not installed");
});
