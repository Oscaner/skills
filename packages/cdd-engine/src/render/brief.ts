// packages/cdd-engine/src/render/brief.ts — CDD task brief generator (Task 8 port of brief.mjs;
// ex lib/brief.mjs; pure library module).
// generateBrief: mechanically extract the `### Task N:` sections from the plan (one per requested
// task — the P4.3 group dispatch briefs the whole group in one file), append TASK_BASE,
// write the file. The out-of-bounds guard (the invariant below) is GROUP-level: it runs after the
// plan-disk read (the task count is known from the heading scan), BLOCKs the whole group, and lists
// each missing task individually — the single-missing face keeps the legacy `/task N not found/`
// contract verbatim.
//   The 4th param repoRoot: resolves the repo's HEAD as TASK_BASE (#173 — decoupled from the
//   caller's cwd).
// Task 5 bottom-swap: git judgment via infra/git.ts (simple-git single point), no hand-written
// git helpers.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { type ResidueAppendixInput, renderResidueAppendix } from "../artifacts/residue.ts";
import { DOC_TOKENS } from "../documents/tokens.ts";
import { invariant } from "../infra/exit.ts";
import { gitRevParseHead } from "../infra/git.ts";

/** generateBrief(planFile, tasks, outPath, repoRoot, residue) — the task brief single generator.
 * `tasks` is a scalar task number or the dispatch group list (the group briefs as one unit: every
 * requested task's `### Task N:` section lands in the one file, then one TASK_BASE line). Any
 * requested task with no matching heading BLOCKs the whole group — the invariant lists every
 * missing task (per-item listing), preserving the `/task N not found/` contract for the
 * single-missing case; nothing is written on the BLOCK path. */
export async function generateBrief(
  planFile: string,
  tasks: number | number[],
  outPath: string,
  repoRoot: string,
  residue: ResidueAppendixInput | null = null,
): Promise<void> {
  invariant(existsSync(planFile), `plan file not found: ${planFile}`);
  const lines = readFileSync(planFile, "utf8").split("\n");
  const numList = Array.isArray(tasks) ? tasks : [tasks];
  // Index every task heading once (the group's disk-read task count): each entry is the
  // [line of `### Task N:`, line of the next task heading / EOF) range. No re-scan per request.
  const ranges: Array<{ start: number; end: number }> = [];
  let headStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (DOC_TOKENS.taskHeadingRe.test(lines[i])) {
      if (headStart >= 0) ranges.push({ start: headStart, end: i });
      headStart = i;
    }
  }
  if (headStart >= 0) ranges.push({ start: headStart, end: lines.length });
  const missing: number[] = [];
  const sections: string[] = [];
  for (const n of numList) {
    // The task-heading token is schema-derived (plan schema taskHeadings format); the n-th task's
    // heading = the canonical `### Task N:` format instantiated for this task number.
    const header = DOC_TOKENS.taskHeadingFor(n);
    const range = ranges.find((r) => lines[r.start].startsWith(header));
    if (!range) {
      missing.push(n);
      continue;
    }
    sections.push(lines.slice(range.start, range.end).join("\n").replace(/\n+$/, ""));
  }
  // Group-level out-of-bounds BLOCK: the whole dispatch is refused when ANY requested task is
  // absent, and each missing task is listed by number (the multi-missing face a group can produce).
  invariant(
    missing.length === 0,
    `task${missing.length > 1 ? "s" : ""} ${missing.join(", ")} not found (CDD-level index; plan must contain '${DOC_TOKENS.taskHeadingFormat}' heading) in plan: ${planFile}`,
  );
  const sha = await gitRevParseHead(repoRoot);
  invariant(sha, "cannot resolve HEAD: not in a git repo");
  // Resume-from-residue (T26): when the pre-flight applied a salvaged stash, the brief appends the
  // data-driven `## Residue status` section (residue.ts renderResidueAppendix — prompt semantic
  // self-sufficiency §35: the prose states the WIP facts itself, zero external anchors) so the next
  // agent audits the restored WIP and continues instead of rewriting from zero.
  let content = `${sections.join("\n\n")}\nTASK_BASE: ${sha}\n`;
  if (residue) {
    content += `\n${renderResidueAppendix(residue)}\n`;
  }
  writeFileSync(outPath, content, "utf8");
}
