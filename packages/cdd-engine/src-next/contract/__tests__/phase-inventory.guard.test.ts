// packages/cdd-engine/src-next/contract/__tests__/phase-inventory.guard.test.ts
// Branch review 5 / F1-F2 — the Phase inventory's two closure columns record identity
// and closure, never a mirror of the registered document's `version:`; the charter's
// own inventory header states that contract. Its only execution surface used to be a
// human grep inside a closed task, pointed at one row, so the claim shipped false: the
// conversion had covered the cells a positional scan could reach, and the rows it could
// not reach kept `✔ Done(spec v0.10 …)`. A bare `|` inside such a row splits it into
// more cells than the header declares — which is exactly why the positional scan reads a
// Scope fragment where the Done cell should be. Two legs, both named by row:
//   1. SHAPE — a row must resolve to the header's cell count (a bare pipe is a cell
//      boundary, so an unescaped one is the defect);
//   2. IDENTITY — the Design spec / Implementation plan cell must carry zero
//      `v<major>.<minor>` literal.
// The identity leg runs only on rows that resolve: on a mis-shaped row the column
// positions are not the header's, so the shape leg owns that row — and the shape leg is
// the reason the identity leg may be positional at all. Coverage is pinned against the
// raw section too: a blank line between rows must not hide a row from the table read
// (the section's merged read is the one the doc parsers use, and a row it drops is a row
// no gate judges).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ENGINE_DOC_ROOTS } from "../../infra/doc-roots.ts";
import { MarkdownTree } from "../markdown-tree.ts";

/** The repo root — the doc roots are declared relative to it. */
const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));

/** The two columns that record closure — the header wording the charter declares. */
const DONE_COLUMNS = ["Design spec", "Implementation plan"] as const;

/** The `## Phase inventory` section heading — the one anchor this gate locates. */
const INVENTORY_HEADING = "## Phase inventory";

/** One document's Phase inventory, as the doc parsers read it. */
class PhaseInventory {
  /** The `v<major>.<minor>` literal grammar the identity leg forbids in a Done cell. */
  static readonly VERSION_LITERAL = /v\d+\.\d+/;

  /** Every inventory under the overall doc root, in name order — a document that
   *  carries no inventory section is skipped (the gate judges inventories, not
   *  charters; the corpus gate judges the documents themselves). */
  static readAll(repo: string): readonly PhaseInventory[] {
    const dir = ENGINE_DOC_ROOTS.overalls;
    const inventories: PhaseInventory[] = [];
    for (const name of readdirSync(path.join(repo, dir)).sort()) {
      if (!name.endsWith(".md")) continue;
      const rel = `${dir}/${name}`;
      const inventory = PhaseInventory.of(rel, readFileSync(path.join(repo, rel), "utf8"));
      if (inventory !== null) inventories.push(inventory);
    }
    return inventories;
  }

  /** The inventory of one document's content — the ONE construction path (the corpus
   *  read and the fixture pin both come through it), null when the document carries no
   *  inventory table. */
  static of(rel: string, content: string): PhaseInventory | null {
    const table = MarkdownTree.parse(content).tableUnder(INVENTORY_HEADING);
    if (table === null || table.header === null) return null;
    return new PhaseInventory(
      rel,
      table.header,
      table.body.map((row) => [...row]),
    );
  }

  /** The raw inventory data rows of one document — every `| P<n> |` line between the
   *  inventory heading and the next rank-2 heading, read without the table parse so a
   *  row the parse drops is still counted. */
  static rawRowCount(content: string): number {
    const lines = content.split("\n");
    const start = lines.indexOf(INVENTORY_HEADING);
    if (start < 0) return 0;
    let count = 0;
    for (let index = start + 1; index < lines.length; index++) {
      const line = lines[index];
      if (line.startsWith("## ")) break;
      if (/^\|\s*P\d+\s*\|/.test(line)) count++;
    }
    return count;
  }

  /** The document's repo-relative path (the name every finding starts with). */
  readonly rel: string;
  /** The section's header cells — the declared column set. */
  readonly header: readonly string[];
  /** The section's body rows, one cell array per row. */
  readonly rows: readonly (readonly string[])[];

  private constructor(
    rel: string,
    header: readonly string[],
    rows: readonly (readonly string[])[],
  ) {
    this.rel = rel;
    this.header = header;
    this.rows = rows;
  }

  /** Every defect of this inventory, in row order — the shape leg first, then the
   *  identity leg. An empty array is the conforming inventory. */
  defects(): readonly string[] {
    return this.rows.flatMap((row) => this.#rowDefects(row));
  }

  /** The defects of one row — named by its phase id, never reduced to a bare count. */
  #rowDefects(row: readonly string[]): readonly string[] {
    const name = `${this.rel} · ${row[0]?.trim() ?? "(row with no id)"}`;
    if (row.length !== this.header.length) {
      return [
        `${name}: the row resolves to ${row.length} cells while the header declares ${this.header.length} — escape the bare \`|\` inside its cells (an unescaped one is a cell boundary, and it moves the Done cells out from under their columns)`,
      ];
    }
    const defects: string[] = [];
    for (const column of DONE_COLUMNS) {
      const index = this.header.findIndex(
        (cell) => cell.trim().toLowerCase() === column.toLowerCase(),
      );
      if (index < 0) continue;
      const literal = row[index]?.match(PhaseInventory.VERSION_LITERAL)?.[0];
      if (literal !== undefined) {
        defects.push(
          `${name} · ${column}: the cell carries the version literal ${literal} — the registry records identity and closure, never a mirror of \`version:\``,
        );
      }
    }
    return defects;
  }
}

const INVENTORIES = PhaseInventory.readAll(REPO);

describe("branch review 5 — the Phase inventory records identity, not a version mirror", () => {
  it("reads the program charter's inventory, and every phase row of the section", () => {
    // Non-vacuity: an empty read would make both legs below trivially green.
    const charter = INVENTORIES.find((entry) => entry.rows.length > 0);
    expect(charter, "no overall document carried a Phase inventory").toBeDefined();
    expect(charter?.header).toEqual([
      "#",
      "Phase",
      "Scope",
      "Design spec",
      "Implementation plan",
      "Acceptance criteria",
      "Dependency",
    ]);
    const ids = (charter?.rows ?? []).map((row) => row[0]?.trim() ?? "");
    expect(ids.every((id) => /^P\d+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // Coverage: the section's merged table read must reach every raw `| P<n> |` line —
    // an interior blank line that hid a row is the class of defect this gate exists
    // for (a row no read reaches is a row no leg judges).
    for (const inventory of INVENTORIES) {
      const content = readFileSync(path.join(REPO, inventory.rel), "utf8");
      expect(inventory.rows.length, inventory.rel).toBe(PhaseInventory.rawRowCount(content));
    }
  });

  it("leaves the corpus with zero shape and zero version-mirror defects", () => {
    expect(INVENTORIES.flatMap((inventory) => inventory.defects())).toEqual([]);
  });

  it("goes red on a bare pipe and on a version literal in a Done cell", () => {
    // The predicate's own red-able pin: the fixture carries one clean row, one row split
    // by a bare pipe (the P25 shape) and one row whose cells resolve but whose Done cell
    // still mirrors `version:`.
    const fixture = [
      INVENTORY_HEADING,
      "",
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "|---|---|---|---|---|---|---|",
      "| P1 | clean | scope | ✔ Done（`a-design.md` · 2026-11-05） | ✔ Done（`a.md` · 2026-11-05） | ok | none |",
      "| P2 | bare pipe | `review | fix)` | ✔ Done（`b-design.md` · 2026-11-05） | ✔ Done（`b.md` · 2026-11-05） | ok | none |",
      "| P3 | version mirror | scope | ✔ Done(spec v0.10 · 2026-11-05) | ✔ Done（`c.md` · 2026-11-05） | ok | none |",
      "",
      "## Next section",
      "",
    ].join("\n");
    const inventory = PhaseInventory.of("fixture.md", fixture);
    expect(inventory?.rows.length).toBe(3);
    const defects = inventory?.defects() ?? [];
    expect(defects.some((line) => line.includes("fixture.md · P1"))).toBe(false);
    expect(
      defects.some((line) => line.includes("fixture.md · P2") && line.includes("8 cells")),
    ).toBe(true);
    expect(
      defects.some(
        (line) => line.includes("fixture.md · P3 · Design spec") && line.includes("v0.10"),
      ),
    ).toBe(true);
  });
});
