// packages/cdd-engine/src-next/render/__tests__/brief.test.ts
// The brief fingerprint-stability pin (P21 D30): the wave line's reviewed identity is
// the RENDERED brief's content hash, so the brief's bytes are a review contract —
// a header line, a version prefix or any other "helpful" preamble would move every
// already-reviewed wave's `brief-revision` and reopen the whole gate. These pins hold
// the two invariants that keep the fingerprint stable:
//   · the same plan renders byte-identically twice (and the same hash the ledger's
//     `recordReviewedBrief` binds — one hash face, no second derivation);
//   · the brief's first line is the first requested `### Task …` heading — zero
//     preamble lines, so the task sections start the document.
// The render/materialize pins of `BriefRenderer` proper stay in render.test.ts.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../../session/ledger.ts";
import { BriefRenderer } from "../brief.ts";

/** A two-task plan with a `## Constraints` section (the complete-mirror input). */
const PLAN = [
  "---",
  "title: Test Plan",
  "doc-type: plan",
  "version: v1.0",
  "date: 2026-10-09",
  "slug: x-p3",
  "---",
  "",
  "## Constraints",
  "",
  "- keep the engine single-authored",
  "",
  "### Task 1: first task",
  "- **Objective**: do the first thing",
  "- **Steps**:",
  "  - touch the file — checkable: the file exists",
  "",
  "### Task 2: second task",
  "- **Objective**: do the second thing",
  "- **Steps**:",
  "  - touch the second file — checkable: the file exists",
  "",
].join("\n");

describe("BriefRenderer — the reviewed-fingerprint stability (D30)", () => {
  it("renders the same plan to the same bytes twice — the fingerprint never depends on render state", () => {
    const renderer = new BriefRenderer();
    const first = renderer.render(PLAN, [1]);
    const second = renderer.render(PLAN, [1]);
    expect(second).toBe(first);
    const refs = new Ledger(
      new Workspace(new WorkspaceRoot("/repo", ".kairos/cdd"), "p3"),
      new ConfigLoader(),
    ).refs();
    expect(refs.briefRevision("p.md", second).brief_hash).toBe(
      refs.briefRevision("p.md", first).brief_hash,
    );
  });

  it("starts with the first requested `### Task …` heading — zero preamble, zero version line", () => {
    const brief = new BriefRenderer().render(PLAN, [1]);
    expect(brief.split("\n")[0]).toBe("### Task 1: first task");
    // The rendered brief opens the task section verbatim (no injected header), so a
    // pre-existing plan's reviewed hash stays derivable.
    expect(brief.startsWith("### Task ")).toBe(true);
    expect(brief).not.toMatch(/^---/);
  });

  it("binds the SAME hash the ledger records — recordReviewedBrief reads the one render face", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "brief-"));
    try {
      const workspace = new Workspace(
        new WorkspaceRoot(repo, ".kairos/cdd"),
        "brief-slug",
      ).ensure();
      const planPath = path.join(repo, "p3.md");
      writeFileSync(planPath, PLAN, "utf8");
      const ledger = new Ledger(workspace, new ConfigLoader());
      ledger.recordReviewedBrief("1", planPath);
      const recorded = ledger.reviewedRevisionOf("1");
      expect(recorded?.kind).toBe("brief-revision");
      if (recorded?.kind !== "brief-revision") return;
      const rendered = new BriefRenderer().render(PLAN, [1]);
      const direct = new Ledger(workspace, new ConfigLoader()).refs().briefRevision("x", rendered);
      expect(recorded.brief_hash).toBe(direct.brief_hash);
      expect(recorded.plan).toBe("p3.md");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
