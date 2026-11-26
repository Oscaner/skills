// packages/cdd-engine/src/docs/grammar/__tests__/grammar.test.ts
// The grammar's pins:
//   · fence awareness — a `## Heading` and a table inside a fenced block are sample
//     prose, not structure, while the same shapes outside it are structure;
//   · index determinism — one text parses to the same headings and the same table cell
//     sets twice, and the fenced table never enters;
//   · front matter — a legal block reads its key set, an illegal one throws a failure
//     that carries the line it broke on;
//   · the record face — `## Change history` and the YAML head are outside the reviewed
//     body, while a fenced sample of that heading stays inside it;
//   · the injected read face — two readers over one coordinate read two documents, and
//     `docs/**` imports no `node:fs` and no `judging/`;
//   · home-driven extraction — moving an element's declared home moves the result;
//   · task blocks — a `DependsOn` line reads its id list, `none` reads empty, and a
//     dependency cycle is read out.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RepoPath } from "../../../env/paths/root.ts";
import { Documents } from "../../index.ts";
import { docBodyOf } from "../doc-body.ts";
import { type HomeElement, HomeExtractor } from "../extract.ts";
import { FrontMatterError, frontmatterOf } from "../frontmatter.ts";
import { MarkdownDocument } from "../markdown-document.ts";
import { MarkdownTree } from "../markdown-tree.ts";
import { TaskBlocks } from "../task-blocks.ts";

/** The docs slice's root — the import-face scan's basis. */
const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** One fixture document: a head, a fenced block that quotes structure and a table, an
 *  accepted-shape table, and the registration section. */
const DOC = [
  "---",
  "title: Fixture",
  "doc-type: phase-spec",
  "slug: fixture",
  "version: v0.1",
  "---",
  "",
  "## Design",
  "",
  "A paragraph citing `the-anchor` inline.",
  "",
  "```md",
  "## Fenced heading",
  "",
  "| fenced-a | fenced-b |",
  "| --- | --- |",
  "| fenced-c | fenced-d |",
  "```",
  "",
  "## Acceptance criteria",
  "",
  "| rule | verdict |",
  "| --- | --- |",
  "| one | green |",
  "",
  "## Change history",
  "",
  "| Version | date |",
  "| --- | --- |",
  "| v0.1 | 2026-01-01 |",
  "",
].join("\n");

/** A plan carrying two mutually dependent tasks and one task with no dependency. */
const PLAN = [
  "## Constraints",
  "",
  "- keep it small",
  "",
  "### Task 1: one",
  "",
  "#### Objective",
  "",
  "objective one",
  "",
  "#### DependsOn",
  "",
  "2",
  "",
  "### Task 2: two",
  "",
  "#### DependsOn",
  "",
  "1（and some prose）",
  "",
  "### Task 3: three",
  "",
  "#### DependsOn",
  "",
  "none",
  "",
].join("\n");

/** A document whose inventory is SPLIT by an interior blank line — the shape the
 *  repository's own Phase / Issue inventories are written in — plus a fenced sample that
 *  shows the row shape and is therefore never data. */
const SPLIT = [
  "# Overall",
  "",
  "## Issue inventory",
  "| Phase | Issue (ref) | Title summary |",
  "| --- | --- | --- |",
  "| P1 | none | first |",
  "",
  "| P2 | none | second |",
  "```",
  "| P9 | none | sample prose |",
  "```",
  "| P3 | none | escaped \\| pipe |",
  "| P4 | none | fourth |",
  "",
  "## Change history",
  "| Version | date |",
  "| --- | --- |",
  "| v0.1 | 2026-01-01 |",
  "",
].join("\n");

/** A fake reader over one fixed text. */
const readerOf = (text: string) => {
  return (target: RepoPath) => ({ kind: "text" as const, target, value: text });
};

describe("fence awareness", () => {
  it("keeps a fenced `## Heading` out of the heading tree and the same shape outside it in", () => {
    const tree = MarkdownTree.parse(DOC);
    const headings = tree.headings().map((heading) => heading.text);
    expect(headings).toContain("## Design");
    expect(headings).toContain("## Acceptance criteria");
    expect(headings).not.toContain("## Fenced heading");
    // The nesting answers the same fact: three rank-2 sections, no fourth from the fence.
    expect(tree.branches().length).toBe(3);
    expect(tree.isCodeLine(13)).toBe(true);
  });
});

describe("the document index", () => {
  it("parses one text to the same headings and table cells twice, with the fenced table excluded", () => {
    const first = MarkdownDocument.parse(DOC);
    const second = MarkdownDocument.parse(DOC);
    expect(first.headings().map((heading) => heading.text)).toEqual(
      second.headings().map((heading) => heading.text),
    );
    expect(first.tables().map((table) => table.body.map((row) => row.cells))).toEqual(
      second.tables().map((table) => table.body.map((row) => row.cells)),
    );
    // Two real tables are indexed (acceptance criteria and change history); the fenced
    // one is sample prose, so no cell of it reaches the index.
    const cells = first.tables().flatMap((table) => table.body.flatMap((row) => row.cells));
    expect(cells).toEqual(["one", "green", "v0.1", "2026-01-01"]);
    expect(cells.some((cell) => cell.startsWith("fenced"))).toBe(false);
  });

  it("removes the inline-code spans from a line's bare view", () => {
    const index = MarkdownDocument.parse(DOC);
    expect(index.bareOf(10)).not.toContain("`the-anchor`");
    expect(index.line(10)).toContain("`the-anchor`");
  });

  it("recovers the rows a blank line detaches as headerless records on the face every consumer reads", () => {
    // A GFM table ends at a blank line and a continuation run carries no delimiter row, so
    // mdast reads the run as a paragraph; the section span is the table's real boundary.
    // The recovery lives HERE, on the index every table consumer reads, so a second
    // consumer cannot inherit the short table.
    const index = MarkdownDocument.parse(SPLIT);
    const records = index.tables();
    expect(records.map((table) => table.header === null)).toEqual([false, true, true, false]);
    // The section's whole row set, in document order, as any consumer of `tables()` sees it.
    expect(records.flatMap((table) => table.body.map((row) => row.cells))).toEqual([
      ["P1", "none", "first"],
      ["P2", "none", "second"],
      ["P3", "none", "escaped | pipe"],
      ["P4", "none", "fourth"],
      ["v0.1", "2026-01-01"],
    ]);
    // The fenced sample that shows the row shape is prose, never a row.
    expect(records.flatMap((table) => table.body.flatMap((row) => row.cells))).not.toContain(
      "sample prose",
    );
    // A detached record's span covers the run's own lines, so a scope test above it still
    // finds every one of its rows.
    expect(records[2]?.from).toBe(12);
    expect(records[2]?.to).toBe(13);
  });
});

describe("front matter", () => {
  it("reads the declared key set of a legal block", () => {
    const { head, body } = frontmatterOf(DOC);
    expect(head.keys()).toEqual(["title", "doc-type", "slug", "version"]);
    expect(head.slug).toBe("fixture");
    expect(head.docType).toBe("phase-spec");
    expect(body).toContain("## Design");
    expect(body).not.toContain("doc-type: phase-spec");
    // A value outside the scalar set is not a head value.
    expect(head.value("title")).toBe("Fixture");
  });

  it("throws a positioned failure on an illegal block", () => {
    const broken = ["---", "title: Fixture", "slug: [unclosed", "---", "", "## Design", ""].join(
      "\n",
    );
    let thrown: unknown;
    try {
      frontmatterOf(broken);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FrontMatterError);
    const failure = thrown as FrontMatterError;
    expect(failure.line).toBeGreaterThan(0);
    expect(failure.message).toContain(`line ${failure.line}`);
    // The position rides the typed fields exactly once: `reason` is the engine's own
    // sentence without its position clause, so a renderer composing the blocked face
    // from `reason` / `line` / `column` / `source` never re-parses the message and the
    // sentence never repeats the clause.
    expect(failure.reason.length).toBeGreaterThan(0);
    expect(failure.reason).not.toContain(" at line ");
    expect(failure.message.split("at line").length).toBe(2);
    expect(failure.message).toContain(`at line ${failure.line}, column ${failure.column}`);
    expect(failure.source).toBe("slug: [unclosed");
  });
});

describe("the record face", () => {
  it("drops the head and the change-history section from the reviewed body", () => {
    const body = docBodyOf(DOC);
    expect(body).not.toContain("doc-type: phase-spec");
    expect(body).not.toContain("## Change history");
    expect(body).not.toContain("| v0.1 | 2026-01-01 |");
    expect(body).toContain("## Design");
    expect(body).toContain("## Acceptance criteria");
  });

  it("keeps a fenced sample of the registration heading inside the body", () => {
    const fenced = [
      "## Design",
      "",
      "```md",
      "## Change history",
      "```",
      "",
      "## Change history",
      "",
      "| v0.1 |",
      "",
    ].join("\n");
    const body = docBodyOf(fenced);
    expect(body).toContain("```md\n## Change history\n```");
  });

  it("returns a document with neither face verbatim", () => {
    const plain = "## Design\n\nbody\n";
    expect(docBodyOf(plain)).toBe(plain);
  });

  it("keeps a CRLF document's line endings — the body is the same byte slice the old tree took", () => {
    // The head boundary has ONE spelling in this slice (`headFenceOf`) and the line form
    // has ONE (`lineSplitOf` / `lineJoinOf`): a CRLF document splits on `\n` alone, so
    // each `\r` stays with the line it ends. A projection that normalized line endings
    // would change a reviewed document's digest, and with it the drift verdict built on
    // that digest.
    const crlf = [
      "---",
      "title: Fixture",
      "slug: fixture",
      "---",
      "",
      "## Design",
      "",
      "body",
      "",
    ].join("\r\n");
    const body = docBodyOf(crlf);
    expect(body).not.toContain("title: Fixture");
    expect(body).toBe("\r\n## Design\r\n\r\nbody\r\n");
    // The head boundary is one walk for both faces: the split the head parser takes.
    expect(frontmatterOf(crlf).body).toBe("\r\n## Design\r\n\r\nbody\r\n");
  });
});

describe("the injected read face", () => {
  it("reads two different documents through one coordinate, one per reader", () => {
    const target = "docs/kairos/specs/fixture.md" as RepoPath;
    const first = new Documents({ readText: readerOf(DOC) }).parse(target);
    const second = new Documents({ readText: readerOf(PLAN) }).parse(target);
    expect(first.kind).toBe("document");
    expect(second.kind).toBe("document");
    if (first.kind !== "document" || second.kind !== "document") throw new Error("unreachable");
    expect(first.index.headings().length).not.toBe(second.index.headings().length);
  });

  it("returns the reader's failure unchanged, never an empty document", () => {
    const target = "docs/kairos/specs/gone.md" as RepoPath;
    const documents = new Documents({
      readText: (asked) => ({ kind: "read-failure", target: asked }),
    });
    expect(documents.parse(target)).toEqual({ kind: "read-failure", target });
  });

  it("imports no `node:fs` and no `judging/` anywhere under `docs/`", () => {
    const scan = new SliceScan(DOCS_ROOT);
    expect(scan.filesImporting("node:fs")).toEqual([]);
    expect(scan.filesImporting("judging")).toEqual([]);
  });
});

describe("home-driven extraction", () => {
  it("moves with the element's declared home", () => {
    const tree = MarkdownTree.parse(DOC);
    const elements: HomeElement[] = [
      { anchor: "design", home: "design-body", heading: "Design" },
      { anchor: "acceptance", home: "section", heading: "Acceptance criteria" },
    ];
    const extractor = new HomeExtractor(elements);
    expect(extractor.extract(tree, ["design-body"])).toEqual({ design: ["## Design"] });
    expect(extractor.extract(tree, ["section"])).toEqual({
      acceptance: ["## Acceptance criteria"],
    });
    // The SAME element read through another home yields the other surface's anchors,
    // which is the projection following the registry rather than a hard-coded list.
    const moved = new HomeExtractor([{ ...elements[0]!, home: "section" }]);
    expect(moved.extract(tree, ["section"])).toEqual({ design: ["## Design"] });
    expect(moved.extract(tree, ["design-body"])).toEqual({});
  });
});

describe("task blocks", () => {
  it("reads a comma-set dependency line as ids, and `none` as the empty set", () => {
    const blocks = TaskBlocks.parse(PLAN);
    expect(blocks.blocks().map((block) => block.id)).toEqual([1, 2, 3]);
    expect(blocks.dependsOn(2)).toEqual([1]);
    expect(blocks.dependsOn(3)).toEqual([]);
    const multi = TaskBlocks.parse(
      ["### Task 9: nine", "", "#### DependsOn", "", "2, 3", ""].join("\n"),
    );
    expect(multi.dependsOn(9)).toEqual([2, 3]);
  });

  it("reads a dependency cycle out", () => {
    const blocks = TaskBlocks.parse(PLAN);
    expect(blocks.cycles()).toEqual([[1, 2]]);
  });
});

/** The `docs/**` scan: which non-test modules carry one import specifier fragment. */
class SliceScan {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  /** The repo-slice-relative paths whose non-test text mentions `needle`. */
  filesImporting(needle: string): string[] {
    const found: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") walk(child);
          continue;
        }
        if (!entry.name.endsWith(".ts")) continue;
        const text = readFileSync(child, "utf8");
        const imports = text
          .split("\n")
          .filter((line) => line.startsWith("import ") || line.startsWith("} from "));
        if (imports.some((line) => line.includes(needle))) {
          found.push(path.relative(this.#root, child));
        }
      }
    };
    walk(this.#root);
    return found.sort();
  }
}
