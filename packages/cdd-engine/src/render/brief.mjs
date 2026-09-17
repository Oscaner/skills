// packages/cdd-engine/src/render/brief.mjs（ex lib/brief.mjs）— CDD task brief generator（纯库模块）。
// generateBrief: mechanically extract ### Task N: section from plan, append TASK_BASE, write file.
//   第 4 参数 repoRoot：取该目录所在仓库的 HEAD 作 TASK_BASE（#173 —— 与调用方 cwd 解耦）。
// Task 5 换底：git 判定经 infra/git.ts（simple-git 单点），不再经 rules/commit.mjs 手写 helper。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gitRevParseHead } from "../infra/git.ts";

export async function generateBrief(planFile, taskNum, outPath, repoRoot) {
  if (!existsSync(planFile)) throw new Error(`plan file not found: ${planFile}`);
  const lines = readFileSync(planFile, "utf8").split("\n");
  const header = `### Task ${taskNum}:`;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && lines[i].startsWith(header)) { start = i; continue; }
    if (start >= 0 && /^### Task \d+:/.test(lines[i])) { end = i; break; }
  }
  if (start < 0) throw new Error(`task ${taskNum} not found (CDD-level index; plan must contain '### Task N:' heading) in plan: ${planFile}`);
  const sha = await gitRevParseHead(repoRoot);
  if (!sha) throw new Error("cannot resolve HEAD: not in a git repo");
  const content = lines.slice(start, end).join("\n").replace(/\n+$/, "") + "\nTASK_BASE: " + sha + "\n";
  writeFileSync(outPath, content, "utf8");
}
