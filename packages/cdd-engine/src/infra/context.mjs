// packages/cdd-engine/src/infra/context.mjs — canonical（templates/context-contract.json）的唯一读取入口。纯读、零落盘。
// `templates/context-contract.json` 是引擎 context 面的唯一声明点（channels / derived / transport /
// timeouts）；本模块是它的唯一读取入口——所有消费方经 loadContract() 取值，不得另立字面副本。
//
// 单一坐标系：运行期 ctx 的构造者是 T3 的 buildCtx(root, taskNum, opts)（src/dispatch/task.mjs），
// 本模块不提供第二个 buildContext（同一事实的第二实现）——它只承载 canonical 的读取。
import { readFileSync } from "node:fs";

const CONTRACT = JSON.parse(readFileSync(new URL("../../templates/context-contract.json", import.meta.url), "utf8"));

export function loadContract() { return CONTRACT; }
