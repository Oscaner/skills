// packages/cdd-engine/lib/failure.mjs — 失败类目 canonical（templates/failure-categories.json）的运行期读取点
// （与 lib/context.mjs 同形：纯读、零落盘）。六类名与语义的唯一声明点 = canonical 静态契约数据；
// 本模块是唯一读取入口 —— engine 内所有以「类目身份」出现的引用（failure_category 赋值点 /
// reviewStoppingGuard 判定点 / 计数器 increment 落点）一律经本模块取值。类目若被 canonical 编辑，
// 引用方对不上（undefined / 实测断言红）即炸出 —— 承重，非装饰（AC14）。
import { readFileSync } from "node:fs";

const CAT = JSON.parse(readFileSync(new URL("../templates/failure-categories.json", import.meta.url), "utf8"));

export const FAILURE_CATEGORIES = Object.fromEntries(CAT.categories.map(c => [c.id, c]));
export const counterFor  = (id) => FAILURE_CATEGORIES[id]?.counter ?? null;
export const terminalFor = (id) => FAILURE_CATEGORIES[id]?.terminal ?? null;
export const isIncompleteDispatch = (id) => FAILURE_CATEGORIES[id]?.dispatchIncomplete === true;   // B3 的判定源在 canonical

// counters() — H1 `counters` 行的唯一取值面：canonical 中 counter 非空的类目，按表内序返回 { field, label }。
// 供 T7 的 h1CountersLine 消费：四个字段名与标签一律出自 canonical，调用侧零手写字面量。
export const counters = () => CAT.categories.filter(c => c.counter).map(c => ({ field: c.counter, label: c.h1Label }));