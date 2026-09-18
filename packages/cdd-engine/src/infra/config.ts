// packages/cdd-engine/src/infra/config.ts — Task 5 配置单点消费（D1.5 ⑤）：engine-config.json =
// 运行时配置面单文件（context-contract + failure-categories + handoff-namespace 三区段归并）。
// 本模块是该平面**唯一**加载点 —— 消费方经 loadEngineConfig / 分区访问器取值，引擎内再无第二
// 个 `readFileSync(...engine-config…)`。三个旧 JSON 已删（config.test 断言零残留）；删文件即
// 炸出任何未迁移引用（机械约束，非评审客套）。
import { readFileSync } from "node:fs";

export interface EngineConfig {
  contextContract: Record<string, any>;
  failureCategories: { categories: Array<Record<string, any>> };
  handoffNamespace: {
    workspaceRoot: string;
    families: Record<string, Record<string, any>>;
  };
}

// 模块加载期单读（与既有 context.ts/failure.ts/naming.ts 的 load-time 读取语义一致）——
// 分区访问器共享同一对象引用，不设第二阅读点。
const CONFIG = JSON.parse(
  readFileSync(new URL("../../templates/engine-config.json", import.meta.url), "utf8"),
) as EngineConfig;

export function loadEngineConfig(): EngineConfig {
  return CONFIG;
}

export function loadContextContract(): EngineConfig["contextContract"] {
  return CONFIG.contextContract;
}

export function loadFailureCategories(): EngineConfig["failureCategories"] {
  return CONFIG.failureCategories;
}

export function loadHandoffNamespace(): EngineConfig["handoffNamespace"] {
  return CONFIG.handoffNamespace;
}
