// packages/cdd-engine/src/render/brief.ts — CDD task brief generator (Task 8 port of brief.mjs;
// ex lib/brief.mjs; pure library module).
// generateBrief: mechanically extract the `### Task N:` section from the plan, append TASK_BASE,
// write the file.
//   The 4th param repoRoot: resolves the repo's HEAD as TASK_BASE (#173 — decoupled from the
//   caller's cwd).
// Task 5 bottom-swap: git judgment via infra/git.ts (simple-git single point), no hand-written
// git helpers.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gitRevParseHead } from "../infra/git.ts";
import { invariant } from "../infra/exit.ts";

export async function generateBrief(planFile: string, taskNum: number, outPath: string, repoRoot: string): Promise<void> {
  invariant(existsSync(planFile), `plan file not found: ${planFile}`);
  const lines = readFileSync(planFile, "utf8").split("\n");
  const header = `### Task ${taskNum}:`;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && lines[i].startsWith(header)) { start = i; continue; }
    if (start >= 0 && /^### Task \d+:/.test(lines[i])) { end = i; break; }
  }
  invariant(
    start >= 0,
    `task ${taskNum} not found (CDD-level index; plan must contain '### Task N:' heading) in plan: ${planFile}`,
  );
  const sha = await gitRevParseHead(repoRoot);
  invariant(sha, "cannot resolve HEAD: not in a git repo");
  const content = lines.slice(start, end).join("\n").replace(/\n+$/, "") + "\nTASK_BASE: " + sha + "\n";
  writeFileSync(outPath, content, "utf8");
}