// packages/cdd-engine/src-next/contract/__tests__/doc-body.test.ts
// P26 T1 (spec §1.2/§1.3) — the doc-body projection: every `doc-revision` hashes the
// reviewed BODY only. Bookkeeping writes (the front-matter `version:` bump and an
// appended `## Change history` line) leave the projection byte-identical, while a
// substantive body edit still moves it. The projection strips exactly two faces —
// the opening YAML block (fence split, no YAML parse) and the ONE rank-2
// `## Change history` section located through `MarkdownTree.sections()` — so a
// fenced sample of the heading inside the body is never mistaken for the section.

import { describe, expect, it } from "vitest";
import { DocBodyProjection } from "../doc-body.ts";

/** A plan-shaped document: YAML head + constraints + one task + change history. */
const planDoc = (version: string, historyLine: string): string =>
  [
    "---",
    "title: Plan X",
    "doc-type: plan",
    `version: ${version}`,
    "---",
    "",
    "## Constraints",
    "",
    "- keep the face narrow",
    "",
    "### Task 1: A",
    "",
    "do the thing",
    "",
    "## Change history",
    "",
    `- ${historyLine}`,
    "",
  ].join("\n");

describe("DocBodyProjection — bookkeeping is not identity (spec §1.2)", () => {
  const projection = new DocBodyProjection();

  it("① a version bump + an appended change-history line project to identical bytes", () => {
    const before = planDoc("v0.1", "v0.1 initial");
    const after = planDoc("v0.2", "v0.2 bookkeeping only");
    expect(projection.project(after)).toBe(projection.project(before));
    // neither stripped face survives the projection
    expect(projection.project(before)).not.toContain("Change history");
    expect(projection.project(before)).not.toContain("version:");
  });

  it("② a one-sentence task-body edit projects differently", () => {
    const before = planDoc("v0.1", "v0.1 initial");
    const after = before.replace("do the thing", "do the other thing");
    expect(projection.project(after)).not.toBe(projection.project(before));
  });

  it("③ a document with NO front matter still strips the change-history section", () => {
    const content = [
      "## Constraints",
      "",
      "- keep the face narrow",
      "",
      "## Change history",
      "",
      "- v0.1 initial",
      "",
    ].join("\n");
    const projected = projection.project(content);
    expect(projected).toContain("## Constraints");
    expect(projected).not.toContain("Change history");
    expect(projected).not.toContain("v0.1 initial");
  });

  it("④ a document with NO change history still strips the front matter", () => {
    const content = [
      "---",
      "doc-type: phase-spec",
      "version: v0.1",
      "---",
      "",
      "## Constraints",
      "",
      "- keep the face narrow",
      "",
    ].join("\n");
    const projected = projection.project(content);
    expect(projected).not.toContain("doc-type:");
    expect(projected).not.toContain("version:");
    expect(projected).not.toContain("---");
    expect(projected).toContain("## Constraints");
  });

  it("⑤ a fenced `## Change history` sample in the body stays; only the real section goes", () => {
    const content = [
      "## Constraints",
      "",
      "an example:",
      "",
      "```md",
      "## Change history",
      "",
      "- fenced sample line",
      "```",
      "",
      "## Change history",
      "",
      "- the real registration",
      "",
    ].join("\n");
    const projected = projection.project(content);
    expect(projected).toContain("```md");
    expect(projected).toContain("- fenced sample line");
    expect(projected).not.toContain("- the real registration");
  });

  it("⑥ a plain body with neither face is returned byte-identical (never an empty string)", () => {
    const content = "## Constraints\n\n- keep the face narrow\n\n### Task 1: A\n\ndo the thing\n";
    const projected = projection.project(content);
    expect(projected).toBe(content);
    expect(projected.length).toBeGreaterThan(0);
  });

  it("a `---` that is not the opening fence is body, not front matter", () => {
    const content = ["## Constraints", "", "before", "", "---", "", "after", ""].join("\n");
    expect(projection.project(content)).toBe(content);
  });
});
