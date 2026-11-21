// packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts
// P42 T4 — the declaration SET behind `Files` (design spec §1.2). Two faces answer for
// one row: the VERB face says what its label states (five values, `other` catching every
// spelling outside the vocabulary), and the CLAIM face says whether the row declares its
// path at all (two closed label sets, everything else claiming nothing). The rule reads
// the second face, so one defect's two legal spellings get one verdict.
//
// Every arm is a PAIR: the form reported and the neighbouring legal form silent. The
// fixtures differ only in the task id, the verb or the path, so a rule that judged
// everything (or nothing) could not pass.
//
// Zero module-level bare functions — the helpers are `const` (the repository's
// zero-`function`-declaration discipline).

import { describe, expect, it } from "vitest";
import type { DocFs } from "../invariants.ts";
import { Contract } from "../judge.ts";
import { PinVocabulary } from "../pins.ts";
import { PlanTaskBlocksReader, type TaskBlock } from "../task-blocks.ts";

/** The hermetic filesystem seam — the policy's sibling strategies read no real file. */
const FS: DocFs = { exists: () => false, read: () => null, list: () => [] };

/** One declared task of the fixture — the id plus its `Files` value lines. */
interface TaskFixture {
  readonly id: number;
  readonly files: readonly string[];
}

/** One plan carrier over the given tasks — a parseable plan whose task blocks carry
 *  exactly the `Files` rows the arms below place. */
const planDoc = (tasks: readonly TaskFixture[]): string =>
  [
    "---",
    "title: Single Create Fixture",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-11-20",
    "slug: x-single",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...tasks.flatMap((task) => [
      `### Task ${task.id}: the declared work`,
      "",
      "#### Objective",
      "do x",
      "",
      "#### Files",
      ...task.files,
      "",
      "#### Consumes",
      "none",
      "",
      "#### Produces",
      "y",
      "",
      "#### Steps",
      "- one — checkable: green",
      "",
      "#### Acceptance",
      "ok",
      "",
      "#### DependsOn",
      "none",
      "",
    ]),
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v1.0 | 2026-11-20 | init | [human] |",
  ].join("\n");

/** The `single-create` findings of one plan — the arms never read another rule. */
const singleCreateOf = (
  tasks: readonly TaskFixture[],
): readonly { field: string; message: string }[] =>
  new Contract()
    .validate({
      docKey: "plan",
      path: "docs/kairos/plans/x-single.md",
      content: planDoc(tasks),
      root: "/repo",
      fs: FS,
    })
    .filter((finding) => finding.kind === "single-create");

/** One task block of the fixture, parsed — the reader arms' surface. */
const blockOf = (files: readonly string[]): TaskBlock =>
  new PlanTaskBlocksReader().parse(planDoc([{ id: 1, files }]))[0]!;

/** The (verb, claim, path) triples of one `Files` line. */
const declarationsOf = (line: string): readonly string[] =>
  new PlanTaskBlocksReader()
    .fileDeclarationsOf(blockOf([line]))
    .map((declaration) => `${declaration.verb}/${declaration.claim}/${declaration.path}`);

describe("P42 T4 — the `Files` row grammar and its dialect projection", () => {
  it("reads the three labelled dialects — the canonical, the qualified and the legacy field", () => {
    expect(declarationsOf("- Create: `a.ts`")).toEqual(["create/create/a.ts"]);
    expect(declarationsOf("- Modify (diagram evidence): `b.ts`")).toEqual(["modify/modify/b.ts"]);
    expect(declarationsOf("- **Files**: Create `c.ts`；Modify `d.ts`")).toEqual([
      "create/create/c.ts",
      "modify/modify/d.ts",
    ]);
  });

  it("reads the inline dialect as three segments — two claiming paths and the test row", () => {
    expect(
      declarationsOf("- **Files**: Modify: `a.ts`；Create: `b.ts`、`c.ts`；Test: `d.ts`"),
    ).toEqual(["modify/modify/a.ts", "create/create/b.ts", "create/create/c.ts", "test/none/d.ts"]);
  });

  it("buckets an out-of-vocabulary spelling as `other` while the claim face still reads it", () => {
    // the verb face peels the ASCII colon only, so the full-width spelling is `other`;
    // the claim face peels both and claims the modify set
    expect(declarationsOf("- 修改：`a.ts`")).toEqual(["other/modify/a.ts"]);
    expect(declarationsOf("- Modified `b.ts`")).toEqual(["other/modify/b.ts"]);
    // the pair: a spelling outside both sets claims nothing
    expect(declarationsOf("- Script：`c.ts`")).toEqual(["other/none/c.ts"]);
  });

  it("splits an unquoted remainder at the separators — three paths, never one synthesized one", () => {
    expect(declarationsOf("- Create: a.ts、b.ts、c.ts")).toEqual([
      "create/create/a.ts",
      "create/create/b.ts",
      "create/create/c.ts",
    ]);
    // the pair: the same group written both ways is the same token set
    expect(
      new PlanTaskBlocksReader().filePathsOf(blockOf(["- Create: `a.ts`、`b.ts`、`c.ts`"])),
    ).toEqual(new PlanTaskBlocksReader().filePathsOf(blockOf(["- Create: a.ts、b.ts、c.ts"])));
  });
});

describe("P42 T4 — the path shape filter", () => {
  it("counts only path-shaped tokens — a placeholder, a bare word and a member claim nothing", () => {
    for (const token of ["<slug>", "someword", "session/ledger.ts#Round"]) {
      expect(PinVocabulary.pathOf(token)).toBeNull();
    }
    expect(
      singleCreateOf([
        { id: 3, files: ["- Create: `<slug>`"] },
        { id: 5, files: ["- Create: `<slug>`"] },
      ]),
    ).toEqual([]);
  });

  it("judges two different `.changeset` files as no conflict and the same one as a conflict", () => {
    // a `.changeset` path is a coordinate here even though §7.1's pin vocabulary leaves
    // it out: the pin exclusion is about what a reader can chase, not about identity
    expect(
      singleCreateOf([
        { id: 3, files: ["- Create: `.changeset/p42-a.md`"] },
        { id: 5, files: ["- Create: `.changeset/p42-b.md`"] },
      ]),
    ).toEqual([]);
    const conflict = singleCreateOf([
      { id: 3, files: ["- Create: `.changeset/p42-a.md`"] },
      { id: 5, files: ["- Create: `.changeset/p42-a.md`"] },
    ]);
    expect(conflict).toHaveLength(1);
    expect(conflict[0]?.message).toContain(".changeset/p42-a.md");
  });
});

describe("P42 T4 — the declaration set, not a line count", () => {
  it("reads one path written twice on one row as one declaration", () => {
    expect(
      singleCreateOf([{ id: 3, files: ["- Create: `a.ts`、`a.ts`", "- Modify: `a.ts`"] }]),
    ).toEqual([]);
    // the pair: the same second occurrence in a LATER task is a second declaration
    expect(
      singleCreateOf([
        { id: 3, files: ["- Create: `a.ts`"] },
        { id: 5, files: ["- Create: `a.ts`"] },
      ]),
    ).not.toEqual([]);
  });

  it("judges the three declaration shapes — increment is legal, two creates and a late create are not", () => {
    // Create: then Modify: is the normal increment
    expect(
      singleCreateOf([
        { id: 3, files: ["- Create: `a.ts`"] },
        { id: 5, files: ["- Modify: `a.ts`"] },
      ]),
    ).toEqual([]);
    // two creates are one path created twice
    expect(
      singleCreateOf([
        { id: 3, files: ["- Create: `a.ts`"] },
        { id: 5, files: ["- Create: `a.ts`"] },
      ]),
    ).toHaveLength(1);
    // a create AFTER an earlier declaration claims a path it no longer owns
    const late = singleCreateOf([
      { id: 3, files: ["- Modify: `a.ts`"] },
      { id: 5, files: ["- Create: `a.ts`"] },
    ]);
    expect(late).toHaveLength(1);
    expect(late[0]?.message).toContain("task 5");
  });
});

describe("P42 T4 — the claim whitelist", () => {
  it("claims through the two closed label sets — `Add:` and `修改：` claim, an unclaimed spelling does not", () => {
    // `Add:` is outside the verb vocabulary and inside the create set
    expect(
      singleCreateOf([
        { id: 3, files: ["- Add: `a.ts`"] },
        { id: 5, files: ["- Create: `a.ts`"] },
      ]),
    ).toHaveLength(1);
    // two `Add:` rows create nothing (no `Create:` line exists), so they never conflict
    expect(
      singleCreateOf([
        { id: 3, files: ["- Add: `a.ts`"] },
        { id: 5, files: ["- Add: `a.ts`"] },
      ]),
    ).toEqual([]);
    // `Add:` then `Modify:` is the same increment the vocabulary spells
    expect(
      singleCreateOf([
        { id: 3, files: ["- Add: `a.ts`"] },
        { id: 5, files: ["- Modify: `a.ts`"] },
      ]),
    ).toEqual([]);
  });

  it("reaches the same verdict through the full-width and the `Modified` spelling", () => {
    const canonical = singleCreateOf([
      { id: 3, files: ["- Modify: `a.ts`"] },
      { id: 5, files: ["- Create: `a.ts`"] },
    ]);
    for (const spelling of ["- 修改：`a.ts`", "- Modified `a.ts`"]) {
      expect(
        singleCreateOf([
          { id: 3, files: [spelling] },
          { id: 5, files: ["- Create: `a.ts`"] },
        ]),
      ).toEqual(canonical);
    }
  });
});

describe("P42 T4 — the three silent arms", () => {
  it("ignores a parenthetical example beside the row's own path", () => {
    // task 3 cites `b.ts` as an example inside the parenthetical of its own row; task 7
    // creates `b.ts`. Reading the example as a declaration would blame task 7 for it.
    expect(
      singleCreateOf([
        { id: 3, files: ["- Modify: `a.ts`（例如 `b.ts` 的同类文件）"] },
        { id: 7, files: ["- Create: `b.ts`"] },
      ]),
    ).toEqual([]);
  });

  it("ignores an exempt label that names another task's path", () => {
    expect(
      singleCreateOf([
        { id: 3, files: ["- Not in this task: `b.ts`", "- Modify: `a.ts`"] },
        { id: 7, files: ["- Create: `b.ts`"] },
      ]),
    ).toEqual([]);
  });

  it("judges two different paths as no conflict, the same path as one", () => {
    expect(
      singleCreateOf([
        { id: 3, files: ["- Modify: `a.ts`"] },
        { id: 7, files: ["- Create: `b.ts`"] },
      ]),
    ).toEqual([]);
    // the pair: the same two tasks creating one path are a conflict
    expect(
      singleCreateOf([
        { id: 3, files: ["- Create: `b.ts`"] },
        { id: 7, files: ["- Create: `b.ts`"] },
      ]),
    ).toHaveLength(1);
  });
});
