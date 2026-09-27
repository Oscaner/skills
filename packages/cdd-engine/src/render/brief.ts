// packages/cdd-engine/src/render/brief.ts — BriefRenderer class (Task 8 port of brief.mjs; ex
// lib/brief.mjs; Task 7 OOP restructure Criterion ② — the task brief generator is an instance-method
// class with constructor-injected file/git judgments; `generateBrief` public face → `#render`, zero bare function exports).
// render: mechanically extract the `### Task N:` sections from the plan (one per requested
// task — the P4.3 group dispatch briefs the whole group in one file), append TASK_BASE,
// write the file. The out-of-bounds guard (the invariant below) is GROUP-level: it runs after the
// plan-disk read (the task count is known from the heading scan), BLOCKs the whole group, and lists
// each missing task individually — the single-missing face keeps the legacy `/task N not found/`
// contract verbatim.
//   The repoRoot param resolves the repo's HEAD as TASK_BASE (#173 — decoupled from the caller's cwd);
//   the git judgment rides the injected GitClient (Task 5 bottom-swap: infra/git.ts simple-git
//   single point, no hand-written git helpers).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { type ResidueAppendixInput, ResidueManager } from "../artifacts/residue.ts";
import { DOC_TOKENS } from "../documents/tokens.ts";
import { invariant } from "../infra/exit.ts";
import { GitClient } from "../infra/git.ts";

export interface BriefRendererDeps {
  /** injected file/git judgments (determinism + test seam — the constructor-injected file/git judgments). */
  git?: GitClient;
  residue?: ResidueManager;
}

/** BriefRenderer — the task brief single generator (Criterion ②; constructor injection — the GitClient + the
 *  ResidueManager appendix renderer, both defaulting to fresh instances). */
export class BriefRenderer {
  readonly #git: GitClient;
  readonly #residue: ResidueManager;

  constructor(deps: BriefRendererDeps = {}) {
    this.#git = deps.git ?? new GitClient();
    this.#residue = deps.residue ?? new ResidueManager();
  }

  /** render(planFile, tasks, outPath, repoRoot, residue) — the brief single renderer. `tasks` is a
   * scalar task number or the dispatch group list (the group briefs as one unit: every requested
   * task's `### Task N:` section lands in the one file, then one TASK_BASE line). Any requested task
   * with no matching heading BLOCKs the whole group — the invariant lists every missing task
   * (per-item listing), preserving the `/task N not found/` contract for the single-missing case;
   * nothing is written on the BLOCK path. */
  async render(
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
    const sha = await this.#git.revParseHead(repoRoot);
    invariant(sha, "cannot resolve HEAD: not in a git repo");
    // Resume-from-residue (T26): when the pre-flight applied a salvaged stash, the brief appends the
    // data-driven `## Residue status` section (residue.ts renderResidueAppendix — prompt semantic
    // self-sufficiency §35: the prose states the WIP facts itself, zero external anchors) so the next
    // agent audits the restored WIP and continues instead of rewriting from zero.
    let content = `${sections.join("\n\n")}\nTASK_BASE: ${sha}\n`;
    if (residue) {
      content += `\n${this.#residue.renderResidueAppendix(residue)}\n`;
    }
    writeFileSync(outPath, content, "utf8");
  }
}
