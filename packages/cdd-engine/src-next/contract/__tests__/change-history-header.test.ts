// packages/cdd-engine/src-next/contract/__tests__/change-history-header.test.ts
// P31 T1 — the Change-history HEADER column set is an invariant of its own. The
// lineage row-shape leg judges a body row against whatever the header declares, so a
// header that quietly grows, loses or renames a column leaves every row "conforming"
// while the table stops being the declared four-column lineage. The two legs are
// orthogonal: this file pins the header alone (its own kind), and the row-shape pins
// live in `judge.test.ts` / `doc-corpus.guard.test.ts` untouched.

import { describe, expect, it } from "vitest";

import type { DocFs } from "../invariants.ts";
import { CHANGE_HISTORY_COLUMNS } from "../invariants.ts";
import { Contract } from "../judge.ts";

/** The kind under test — its own row in the rule registry. */
const KIND = "change-history-header-columns";

/** The hermetic fs seam — the header leg reads no file, but the sibling strategies
 *  on the same policy do (they must not touch the real tree). */
const FS: DocFs = { exists: () => false, read: () => null, list: () => [] };

/** A plan whose `## Change history` table carries `header` verbatim (the separator
 *  row matches its width, so only the header leg can object). */
const planDoc = (header: readonly string[]): string =>
  [
    "---",
    "title: Test Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: x-p31",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    "### Task 1: task 1",
    "- **DependsOn**: none",
    "",
    "## Change history",
    "",
    `| ${header.join(" | ")} |`,
    `|${header.map(() => "---").join("|")}|`,
    "| v1.0 | 2026-10-10 | prior | [human] |",
  ].join("\n");

/** The header leg's findings over one declared header. */
const headerFindings = (header: readonly string[]): readonly { field: string; message: string }[] =>
  new Contract()
    .validate({
      docKey: "plan",
      path: "docs/kairos/plans/x-p31.md",
      content: planDoc(header),
      root: "/repo",
      fs: FS,
    })
    .filter((finding) => finding.kind === KIND);

/** The declared column set as the plan states it. */
const DECLARED: readonly string[] = ["Version", "date", "summary", "author"];

describe("change-history-header-columns — the declared header set", () => {
  it("declares the four columns in order", () => {
    expect([...CHANGE_HISTORY_COLUMNS]).toEqual([...DECLARED]);
  });

  it("is silent on the declared four-column header", () => {
    expect(headerFindings(DECLARED)).toEqual([]);
  });

  it("reports exactly one finding when the header carries an extra column", () => {
    const findings = headerFindings([...DECLARED, "status"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.field).toBe("Change history");
  });

  it("reports exactly one finding when the header loses a column", () => {
    const findings = headerFindings(DECLARED.slice(0, 3));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.field).toBe("Change history");
  });

  it("reports exactly one finding when a column name drifts (`Date` for `date`)", () => {
    const findings = headerFindings(["Version", "Date", "summary", "author"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("Date");
  });

  it("is silent on a document with no Change-history section", () => {
    const content = planDoc(DECLARED).replace("## Change history", "## Notes");
    const findings = new Contract()
      .validate({
        docKey: "plan",
        path: "docs/kairos/plans/x-p31.md",
        content,
        root: "/repo",
        fs: FS,
      })
      .filter((finding) => finding.kind === KIND);
    expect(findings).toEqual([]);
  });
});
