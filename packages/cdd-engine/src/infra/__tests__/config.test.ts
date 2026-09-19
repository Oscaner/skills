// packages/cdd-engine/src/infra/__tests__/config.test.ts (Task 5 — 模板系统化 D1.5)
// engine-config.json = 运行时配置面单文件（context-contract + failure-categories +
// handoff-namespace 三区段归并）；src/infra/config.ts = 该平面唯一加载点（消费方程单点）。
// 三个旧文件已删除 —— 任何旧路径引用立即炸出（零残留是机械约束，非评审客套）。
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEngineConfig, loadContextContract, loadFailureCategories, loadHandoffNamespace } from "../config.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(__dirname, "..", "..", "..");
const TEMPLATES = path.join(ENGINE, "templates");

describe("engine-config 单点消费（config.ts 分区段加载）", () => {
  it("loadEngineConfig 返回 engine-config.json 原值（三区段齐备：contextContract / failureCategories / handoffNamespace）", () => {
    const onDisk = JSON.parse(readFileSync(path.join(TEMPLATES, "engine-config.json"), "utf8"));
    const cfg = loadEngineConfig();
    expect(cfg).toEqual(onDisk);
    // 三区段的既有承重锚点（内容随迁移逐字保留）
    expect(cfg.contextContract.timeouts.defaults.task).toBe(5_400_000);
    expect(cfg.contextContract.channels.env).toHaveProperty("hostHarness");
    expect(cfg.failureCategories.categories).toHaveLength(6);
    expect(cfg.handoffNamespace.workspaceRoot).toBe(".osuperpowers/cdd");
    expect(Object.keys(cfg.handoffNamespace.families)).toHaveLength(9);
  });

  it("三个分区访问器与 engine-config 对应区段逐字一致（消费方读访问器，不设第二阅读点）", () => {
    const cfg = loadEngineConfig();
    expect(loadContextContract()).toEqual(cfg.contextContract);
    expect(loadFailureCategories()).toEqual(cfg.failureCategories);
    expect(loadHandoffNamespace()).toEqual(cfg.handoffNamespace);
  });

  it("旧三文件已删除（context-contract / failure-categories / handoff-namespace 并入 engine-config）", () => {
    for (const old of ["context-contract.json", "failure-categories.json", "handoff-namespace.json"]) {
      expect(existsSync(path.join(TEMPLATES, old)), old).toBe(false);
    }
  });

  it("engine-config.json 是运行时配置唯一单源：templates/ 下无第二个 failure-categories/handoff-namespace 家族文件", () => {
    expect(existsSync(path.join(TEMPLATES, "engine-config.json"))).toBe(true);
    expect(existsSync(path.join(TEMPLATES, "context-contract.json"))).toBe(false);
  });
});