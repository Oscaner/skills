// packages/cdd-engine/bin/lib/brief.mjs — CDD task brief generator + validator.
// generateBrief: mechanically extract ### Task N: section from plan, append TASK_BASE, write file.
//   第 4 参数 repoRoot：取该目录所在仓库的 HEAD 作 TASK_BASE（#173 —— 与调用方 cwd 解耦）。
// validateBrief: check brief contains TASK_BASE: line.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gitRevParseHead, gitToplevel } from "./contract.mjs";

export function generateBrief(planFile, taskNum, outPath, repoRoot) {
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
  const sha = gitRevParseHead(repoRoot);
  if (!sha) throw new Error("cannot resolve HEAD: not in a git repo");
  const content = lines.slice(start, end).join("\n").replace(/\n+$/, "") + "\nTASK_BASE: " + sha + "\n";
  writeFileSync(outPath, content, "utf8");
}

export function validateBrief(briefPath) {
  if (!existsSync(briefPath)) return false;
  return readFileSync(briefPath, "utf8").split("\n").some((l) => l.startsWith("TASK_BASE:"));
}

// --- CLI entry point (orchestrator calls via node brief.mjs --task N --plan <path> --output <path>) ---
if (process.argv[1] && process.argv[1].endsWith("brief.mjs") && process.argv.length > 2) {
  const args = process.argv.slice(2);
  const taskIdx = args.indexOf("--task");
  const planIdx = args.indexOf("--plan");
  const outputIdx = args.indexOf("--output");
  const taskNum = parseInt(args[taskIdx + 1]);
  const planPath = planIdx >= 0 ? args[planIdx + 1] : undefined;
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;

  try {
    const repoRoot = gitToplevel();
    generateBrief(planPath, taskNum, outputPath, repoRoot);
    process.stdout.write(JSON.stringify({ brief: outputPath }));
    process.exit(0);
  } catch (e) {
    process.stderr.write(e.message);
    process.exit(1);
  }
}
