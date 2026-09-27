// packages/cdd-engine/src/cli/issue.ts — `cdd issue render` action (P4.2 Task 6): the aggregate
// issue-body renderer subcommand. Reads the findings JSON from stdin, validates the input contract
// (non-empty findings · type/lang enums · per-finding fields · meta.skill/step · related shape) and
// renders the deterministic aggregate body straight to stdout — no mode flag, no per-finding
// comment mode, zero enforcement (no harness gate, no dispatch, no audit). Violations exit 1 with
// the offending field path (the E-3 / R2 early-report contract the retired report-templates.mjs
// CLI established — byte-identical stderr face, no regression); malformed stdin exits 1 with the
// input path. The renderer carries zero third-party deps (plain text — the emit-only yaml lives in
// the repo scripts/emit plane, never here).

import { readFileSync } from "node:fs";

import { type IssueReportInput, issueBodyRenderer } from "../domain/issue-renderer.ts";
import { exitBlocked, exitOk } from "../infra/exit.ts";

/** `cdd issue render`: stdin findings JSON → aggregate body → stdout (the renderer's only CLI
 *  entry; a bare call, no flags). Exits through the exit.ts family — no bare process.exit. */
export function runIssueRender(): never {
  let input: unknown;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch (err) {
    process.stderr.write(
      `input: invalid JSON — ${err instanceof Error ? err.message : String(err)}\n`,
    );
    exitBlocked();
  }
  const violations = issueBodyRenderer.validateInput(input);
  if (violations.length > 0) {
    process.stderr.write(
      `Invalid report-issues input:\n${violations.map((v) => `  ${v}`).join("\n")}\n`,
    );
    exitBlocked();
  }
  process.stdout.write(`${issueBodyRenderer.renderBody(input as IssueReportInput)}\n`);
  exitOk();
}
