// gate/tests/opencode.test.mjs — P4b T5: OpenCode TS plugin adapter。
// opencode 无 hooks.json；插件模块导出 plugin 函数（loader 扫描函数导出并以 PluginInput
// 调用 → Hooks）。校准自 opencode plugins 文档：hook 签名 (input, output)，
// input.tool / input.sessionID / input.callID，output.args；deny 抛 Error 阻断。
// fixture 帮手来自 ./helpers.mjs。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { cddGate } from "../adapters/opencode.mjs";
import { makeGateTestEnv, gitFixtureRoot, writePending, now, activePlan } from "./helpers.mjs";

const { root, pendingRoot } = makeGateTestEnv();

test("package.json main 解析到 opencode adapter 模块（import 包入口 → cddGate plugin 函数）", async () => {
  const pkgPath = fileURLToPath(new URL("../../../package.json", import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  assert.equal(pkg.main, "./bin/gate/adapters/opencode.mjs");
  const mainPath = path.resolve(path.dirname(pkgPath), pkg.main);
  const mod = await import(pathToFileURL(mainPath).href);
  assert.equal(typeof mod.cddGate, "function");
});

test("opencode plugin: cli 严格 + Bash git commit → throw 阻断", async () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-oc-commit", { repo_root: dir, detected_at: now(), mode: "cli" });
  const hooks = await cddGate({ directory: dir });
  const before = hooks["tool.execute.before"];
  await assert.rejects(
    () => before({ tool: "bash", sessionID: "s-oc-commit", callID: "c1" }, { args: { command: "git commit -m x" } }),
    (e) => {
      assert.match(e.message, /CDD orchestrator gate/);
      assert.match(e.message, /cdd-task.mjs --harness opencode/);
      assert.match(e.message, /plan-a/);
      return true;
    },
  );
});

test("opencode plugin: cli 严格 + Bash git status → allow（不 throw）", async () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-oc-status", { repo_root: dir, detected_at: now(), mode: "cli" });
  const hooks = await cddGate({ directory: dir });
  const before = hooks["tool.execute.before"];
  await assert.doesNotReject(
    () => before({ tool: "bash", sessionID: "s-oc-status", callID: "c2" }, { args: { command: "git status" } }),
  );
});

test("opencode plugin: cli 严格 + Write 出 workspace → throw 阻断", async () => {
  const { dir, sha } = gitFixtureRoot(root);
  activePlan(dir, sha);
  writePending(pendingRoot, "s-oc-write", { repo_root: dir, detected_at: now(), mode: "cli" });
  const hooks = await cddGate({ directory: dir });
  const before = hooks["tool.execute.before"];
  await assert.rejects(
    () => before({ tool: "write", sessionID: "s-oc-write", callID: "c4" }, { args: { filePath: `${dir}/outside.md`, content: "x" } }),
    (e) => {
      assert.match(e.message, /CDD orchestrator gate/);
      assert.match(e.message, /plan-a/);
      return true;
    },
  );
});

test("opencode plugin: 无 pending → allow（不 throw）", async () => {
  const hooks = await cddGate({ directory: root });
  const before = hooks["tool.execute.before"];
  await assert.doesNotReject(
    () => before({ tool: "bash", sessionID: "s-oc-none", callID: "c3" }, { args: { command: "git commit -m x" } }),
  );
});

test("opencode plugin: 畸形 input（undefined）→ allow（不抛错）", async () => {
  const hooks = await cddGate({ directory: root });
  const before = hooks["tool.execute.before"];
  await assert.doesNotReject(() => before(undefined, undefined));
});

test("opencode plugin: 畸形 sessionID（Symbol）→ gateDecide 抛错 → catch → fail-open allow（不 throw）", async () => {
  // Symbol sessionID 在 pendingPathFor 的模板字面量处抛 TypeError（Symbol 不能插值）——
  // 穿过 gateDecide 落到 adapter 的 catch → fail-open allow。验证 catch 分支真实可达。
  const hooks = await cddGate({ directory: root });
  const before = hooks["tool.execute.before"];
  await assert.doesNotReject(
    () => before({ tool: "bash", sessionID: Symbol("malformed"), callID: "c5" }, { args: { command: "git commit -m x" } }),
  );
});
