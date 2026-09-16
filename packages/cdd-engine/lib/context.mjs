// packages/cdd-engine/lib/context.mjs — 读 canonical 构造内存 context。零落盘。
// `templates/context-contract.json` 是引擎 context 面的唯一声明点（channels / derived / transport /
// timeouts）；本模块是它的唯一读写入口——所有消费方经 loadContract() 取值，不得另立字面副本。
//
// 单一坐标系：ctx 的构造者是 T3 的 buildCtx(root, taskNum, opts)（lib/runner/run-task.mjs），
// 本模块不提供第二个 buildContext（同一事实的第二实现）——它只承载 canonical 的读取。
import { readFileSync } from "node:fs";

const CONTRACT = JSON.parse(readFileSync(new URL("../templates/context-contract.json", import.meta.url), "utf8"));

export function loadContract() { return CONTRACT; }