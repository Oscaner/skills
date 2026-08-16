// bin/utils/tests/skills-probe.test.mjs — P6a T1: skills-probe 探测库单测（fixture 驱动）。
// 探测路径 SOT：docs/research/2026-08-16-harness-plugin-availability.md。
// Seams（测试边界）：probeSkills(harness, {requiredPlugins, cwd, env}) 纯函数 —— mock PATH 内的
//   claude/pi 假二进制 + mock HOME 缓存 + mock cwd 技能目录；探测顺序只断言 CLI/list → glob 两档
//   （env 层为 hook-context-only 扩展，P6a 不实现）。不测：真实 claude/pi 二进制、真实 ~/.claude 缓存。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { probeSkills } from "../skills-probe.mjs";
import { config } from "../skills-probe.config.mjs";

// 写可执行假 CLI 到 mockdir（对齐 engine/tests/exec.test.mjs makeMock 模式）。
function makeMockDir(scripts = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "skills-probe-mock-"));
  for (const [name, body] of Object.entries(scripts)) {
    const p = path.join(dir, name);
    writeFileSync(p, `#!/bin/sh\n${body}\n`);
    chmodSync(p, 0o755);
  }
  return dir;
}

// hermetic env：mock PATH 优先（假 claude/pi 命中）+ HOME 指向临时目录（缓存 glob 不泄漏 host）。
function envWith(mockDir, home) {
  return {
    ...process.env,
    PATH: `${mockDir}${path.delimiter}${process.env.PATH ?? ""}`,
    HOME: home ?? mkdtempSync(path.join(tmpdir(), "skills-probe-home-")),
  };
}

function fakeClaudePluginList({ enabled = [], home } = {}) {
  const json = JSON.stringify({ enabledPlugins: enabled });
  const mockDir = makeMockDir({ claude: `printf '%s\\n' '${json}'` });
  return { env: envWith(mockDir, home) };
}

function fakePiList({ packages = [] } = {}) {
  const body = packages.map((p) => `printf '%s\\n' '${p}'`).join("\n");
  const mockDir = makeMockDir({ pi: body });
  return { env: envWith(mockDir) };
}

function fakeCwdWithDirs(relDirs = []) {
  const cwd = mkdtempSync(path.join(tmpdir(), "skills-probe-cwd-"));
  for (const rel of relDirs) mkdirSync(path.join(cwd, rel), { recursive: true });
  return cwd;
}

// ---------------------------------------------------------------- config shape

test("config: requiredPlugins 含 4 插件 + harnesses 表", () => {
  assert.deepEqual(config.requiredPlugins, ["superpowers", "mattpocock-skills", "engineering", "superpowers-overrides"]);
  for (const h of ["claude", "cursor-agent", "droid", "pi", "opencode"]) {
    assert.ok(config.harnesses[h], `missing harness config: ${h}`);
  }
});

// ---------------------------------------------------------------- claude plugin-list

test("claude: enabledPlugins 缺 superpowers → missing + install hint", async () => {
  const fake = fakeClaudePluginList({ enabled: ["engineering"] });
  const r = await probeSkills("claude", { requiredPlugins: config.requiredPlugins, env: fake.env });
  assert.equal(r.probeFailed, false);
  const sup = r.missing.find((m) => m.plugin === "superpowers");
  assert.ok(sup, "superpowers 应在 missing");
  assert.equal(sup.reason, "not-installed");
  assert.match(sup.installHint, /\/plugin install superpowers@oscaner/);
});

test("claude: enabledPlugins 含全部 → 不在 missing", async () => {
  const fake = fakeClaudePluginList({
    enabled: ["superpowers@oscaner", "mattpocock-skills@oscaner", "engineering@oscaner", "superpowers-overrides@oscaner"],
  });
  const r = await probeSkills("claude", { requiredPlugins: config.requiredPlugins, env: fake.env });
  assert.equal(r.probeFailed, false);
  assert.deepEqual(r.missing, []);
});

test("claude: 缓存 glob 有但 enabled 无 → installed-but-disabled", async () => {
  const home = mkdtempSync(path.join(tmpdir(), "skills-probe-home-"));
  mkdirSync(path.join(home, ".claude/plugins/cache/oscaner/superpowers/1.2.3/skills"), { recursive: true });
  const fake = fakeClaudePluginList({ enabled: [], home });
  const r = await probeSkills("claude", { requiredPlugins: ["superpowers"], env: fake.env });
  const sup = r.missing.find((m) => m.plugin === "superpowers");
  assert.equal(sup.reason, "installed-but-disabled");
  assert.match(sup.installHint, /\/plugin install superpowers@oscaner/);
});

test("claude: CLI enabled 优先于 glob（探测顺序 CLI/list → glob）", async () => {
  const home = mkdtempSync(path.join(tmpdir(), "skills-probe-home-"));
  mkdirSync(path.join(home, ".claude/plugins/cache/oscaner/superpowers/9.9.9/skills"), { recursive: true });
  const fake = fakeClaudePluginList({ enabled: ["superpowers@oscaner"], home });
  const r = await probeSkills("claude", { requiredPlugins: ["superpowers"], env: fake.env });
  assert.equal(r.probeFailed, false);
  assert.ok(!r.missing.some((m) => m.plugin === "superpowers"));
});

test("claude: CLI 报错 → probeFailed true（fail-open）", async () => {
  const mockDir = makeMockDir({ claude: "exit 1" });
  const env = envWith(mockDir);
  const r = await probeSkills("claude", { requiredPlugins: ["superpowers"], env });
  assert.equal(r.probeFailed, true);
  assert.deepEqual(r.missing, []);
});

// ---------------------------------------------------------------- skill-dir (cursor/droid/opencode)

test("cursor-agent: .agents/skills 无 superpowers → missing + copy hint", async () => {
  const cwd = fakeCwdWithDirs([".agents/skills/engineering"]);
  const r = await probeSkills("cursor-agent", { requiredPlugins: config.requiredPlugins, cwd });
  const sup = r.missing.find((m) => m.plugin === "superpowers");
  assert.ok(sup, "superpowers 应在 missing");
  assert.match(sup.installHint, /copy skills 到 \.agents\/skills/);
});

test("cursor-agent: .agents/skills 有 superpowers → 不在 missing", async () => {
  const cwd = fakeCwdWithDirs([".agents/skills/superpowers"]);
  const r = await probeSkills("cursor-agent", { requiredPlugins: ["superpowers"], cwd });
  assert.ok(!r.missing.some((m) => m.plugin === "superpowers"));
});

test("droid: .agents/skills 无 superpowers → missing + copy hint", async () => {
  const cwd = fakeCwdWithDirs([]);
  const r = await probeSkills("droid", { requiredPlugins: ["superpowers"], cwd });
  const sup = r.missing.find((m) => m.plugin === "superpowers");
  assert.ok(sup, "superpowers 应在 missing");
  assert.match(sup.installHint, /copy skills 到 \.agents\/skills/);
});

test("opencode: .opencode/skills 无 superpowers → missing", async () => {
  const cwd = fakeCwdWithDirs([]);
  const r = await probeSkills("opencode", { requiredPlugins: ["superpowers"], cwd });
  const sup = r.missing.find((m) => m.plugin === "superpowers");
  assert.ok(sup, "superpowers 应在 missing");
  assert.match(sup.installHint, /\.opencode\/skills/);
});

// ---------------------------------------------------------------- pi package-list

test("pi: pi list 无 @oscaner-skills/superpowers → missing + pi install hint", async () => {
  const fake = fakePiList({ packages: [] });
  const r = await probeSkills("pi", { requiredPlugins: ["superpowers"], env: fake.env });
  assert.equal(r.probeFailed, false);
  const sup = r.missing.find((m) => m.plugin === "superpowers");
  assert.ok(sup, "superpowers 应在 missing");
  assert.equal(sup.installHint, "pi install npm:@oscaner-skills/superpowers");
});

test("pi: pi list 含 @oscaner-skills/superpowers → 不在 missing", async () => {
  const fake = fakePiList({ packages: ["@oscaner-skills/superpowers"] });
  const r = await probeSkills("pi", { requiredPlugins: ["superpowers"], env: fake.env });
  assert.ok(!r.missing.some((m) => m.plugin === "superpowers"));
});

test("pi: engineering（无 pi key）→ 目录复制探测 + copy hint", async () => {
  const fake = fakePiList({ packages: [] });
  const cwd = fakeCwdWithDirs([]);
  const r = await probeSkills("pi", { requiredPlugins: ["engineering"], cwd, env: fake.env });
  const eng = r.missing.find((m) => m.plugin === "engineering");
  assert.ok(eng, "engineering 应在 missing（无 pi key）");
  assert.match(eng.installHint, /copy skills 到 \.pi\/skills/);
});

// ---------------------------------------------------------------- fail-open / unknown

test("unknown harness → probeFailed true（不阻断）", async () => {
  const r = await probeSkills("no-such-harness", { requiredPlugins: ["superpowers"] });
  assert.equal(r.probeFailed, true);
  assert.deepEqual(r.missing, []);
});
