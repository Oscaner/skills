// engine/lib/ledger.mjs — CDD ledger 追加 + plan constraints 提取（Node port of
// cdd-common.sh `_append_ledger` deferred roll-up / `_cdd_write_plan_constraints`）。
// 无 jq 降级行（bash 特有，Node 内建 JSON 无此问题）不移植。
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";

// 追加 ledger 行（对齐 `_append_ledger`）：deferred 取 `.deferred === true` 项 roll-up；
// 空 → "review clean"。base/head 截断 7 位（对齐 `:0:7`）。status 为 ledger 状态词
// （bash 恒为 "complete"）。
export function appendLedger(ledgerPath, task, status, range, deferred = []) {
  const base = (range?.base ?? "unknown").slice(0, 7);
  const head = (range?.head ?? "unknown").slice(0, 7);
  const items = (deferred ?? []).filter((f) => f?.deferred === true);
  let line;
  if (items.length > 0) {
    const oneline = items.map((f) => f.summary ?? "").join("; ");
    line = `Task ${task}: ${status} (commits ${base}..${head}, ${items.length} deferred: ${oneline})`;
  } else {
    line = `Task ${task}: ${status} (commits ${base}..${head}, review clean)`;
  }
  appendFileSync(ledgerPath, `\n${line}\n`);
}

// 提取 plan 的 `## Global Constraints` 段写到 out（对齐 `_cdd_write_plan_constraints` 的
// awk：遇 `## ` 标题或 `---` 终止，输出文件已存在则不重写）。不写结尾换行。
export function writePlanConstraints(plan, out) {
  if (existsSync(out)) return;
  const lines = readFileSync(plan, "utf8").split("\n");
  const captured = [];
  let inSection = false;
  for (const line of lines) {
    if (/^## Global Constraints/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^---$/.test(line) || /^## /.test(line)) break;
      captured.push(line);
    }
  }
  writeFileSync(out, captured.join("\n"));
}
