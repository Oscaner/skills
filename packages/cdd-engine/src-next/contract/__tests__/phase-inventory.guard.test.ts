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
//      `v<major>.<minor>` literal;
//   3. FORM — the same cells must write the convention's positive half,
//      `✔ Done（`<file>.md` · <date>）`, with the header's two exemptions (`[Pending]`
//      and the hotfix row). Without this leg only the negative half was enforced while
//      the identity leg's two collisions with a positional scan are exactly the ones an
//      anonymous `spec` / `plan` cell hides behind — the same asymmetry branch review 6
//      named, measured on the two rows v3.88 repaired by hand.
// The identity and form legs run only on rows that resolve: on a mis-shaped row the column
// positions are not the header's, so the shape leg owns that row — and the shape leg is
// the reason the identity leg may be positional at all. Coverage is pinned against the
// raw section too: a blank line between rows must not hide a row from the table read
// (the section's merged read is the one the doc parsers use, and a row it drops is a row
// no gate judges).
// Overall review 1 / F1 — the shape leg and the form leg were each half a gate, and the
// two halves let one row live: the P20 row dropped a separator while its acceptance text
// carried an unescaped `|`, so the cell count still matched the header (the stray pipe
// paid for the dropped one) and the form leg — anchored at `^` — accepted a Done cell that
// swallowed the rest of the row as trailing body. A parse looser than the format it guards
// is not a gate, so the form leg now requires the WHOLE trimmed cell (`startsWith` the
// declared form AND `endsWith` its closing paren), and a fixture row pins the green side of
// the other half: a `\|` inside a cell is content, not a cell boundary, so an escape that
// keeps the count right cannot be mistaken for the defect.

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

  /** The Done form the charter's inventory header declares: `✔ Done（`<file>` · <date>）`
   *  in full-width parentheses, judged WHOLE. A closeout note may follow the date inside
   *  the parens (the P5 row carries one), so the note is `[^）]*` — a note cannot itself
   *  contain a closing paren — and the cell must end at its own closing paren. That is the
   *  half a `^`-anchored prefix left open: the swallowed-tail row passed it because a
   *  dropped separator leaves the next column's body sitting inside the Done cell, and that
   *  body may well end with a paren of its own. The filename and the date are not optional,
   *  and the filename rides in backticks so a placeholder (`<file>`) cannot pass as one. */
  static readonly DONE_FORM = /^✔ Done（`[^`\s]+\.md` · \d{4}-\d{2}-\d{2}[^）]*）$/;

  /** The two cell spellings the header exempts: a phase that has not landed, and the
   *  hotfix row (no design/plan document to point at, so the delivery facts stand in). The
   *  hotfix form is anchored at both ends by the same rule as the Done form. */
  static readonly PENDING_CELL = "[Pending]";
  static readonly HOTFIX_FORM = /^✔ Done（hotfix[^）]*）$/;

  /** The Done form as the header spells it — quoted verbatim in the form leg's defect. */
  static readonly DONE_FORM_TEXT = "✔ Done（`<file>.md` · <date>）";

  /** The form leg's verdict on one Done cell — undefined when the cell conforms, a named
   *  defect otherwise. The cell is judged WHOLE: a prefix match plus a stray closing paren
   *  was enough to accept a cell whose tail carried the next column's body, which is the
   *  defect a dropped separator leaves behind (`^`-anchored alone is not a form). */
  static formDefectOf(cell: string, where: string): string | undefined {
    const trimmed = cell.trim();
    if (trimmed === PhaseInventory.PENDING_CELL) return undefined;
    if (PhaseInventory.HOTFIX_FORM.test(trimmed)) return undefined;
    if (PhaseInventory.DONE_FORM.test(trimmed)) return undefined;
    return `${where}: the cell reads ${trimmed} — a Done cell writes ${PhaseInventory.DONE_FORM_TEXT} and nothing else (the header's hotfix / [Pending] forms aside), so a trailing body after the closing paren, an anonymous spelling, a placeholder or a bare date is the defect`;
  }

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

  /** The defects of this inventory, in row order — the shape leg first, then the
   *  identity and form legs over the same two cells. An empty array is the conforming
   *  inventory. */
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
      const cell = row[index] ?? "";
      const literal = cell.match(PhaseInventory.VERSION_LITERAL)?.[0];
      if (literal !== undefined) {
        defects.push(
          `${name} · ${column}: the cell carries the version literal ${literal} — the registry records identity and closure, never a mirror of \`version:\``,
        );
      }
      const form = PhaseInventory.formDefectOf(cell, `${name} · ${column}`);
      if (form !== undefined) defects.push(form);
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

  it("goes red on a bare pipe, a version literal, a cell that skips the declared form, and a Done cell with a trailing body", () => {
    // The predicate's own red-able pin, one row per defect class: a row split by a bare
    // pipe (the P25 shape), a Done cell that mirrors `version:`, and the four spellings
    // that keep the identity column but drop its identity — no filename, no date, a
    // placeholder, and the ASCII-parens form the convention replaced. The last two rows
    // pin the header's exemptions so the form leg cannot harden into a false red, the
    // P10 row pins the green side of the escape (`\|` is content, not a boundary, so the
    // row still resolves), and the P11 row pins the whole-cell anchor: its Done cell
    // carries the NEXT column's body after the closing paren, which is what a dropped
    // separator leaves behind.
    const fixture = [
      INVENTORY_HEADING,
      "",
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "|---|---|---|---|---|---|---|",
      "| P1 | clean | scope | ✔ Done（`a-design.md` · 2026-11-05） | ✔ Done（`a.md` · 2026-11-05） | ok | none |",
      "| P2 | bare pipe | `review | fix)` | ✔ Done（`b-design.md` · 2026-11-05） | ✔ Done（`b.md` · 2026-11-05） | ok | none |",
      "| P3 | version mirror | scope | ✔ Done(spec v0.10 · 2026-11-05) | ✔ Done（`c.md` · 2026-11-05） | ok | none |",
      "| P4 | no filename | scope | ✔ Done（spec · 2026-11-05） | ✔ Done（`d.md` · 2026-11-05） | ok | none |",
      "| P5 | no date | scope | ✔ Done（`e-design.md` · 2026-11-05） | ✔ Done（`e.md`） | ok | none |",
      "| P6 | placeholder | scope | ✔ Done（<file> · <date>） | ✔ Done（`f.md` · 2026-11-05） | ok | none |",
      "| P7 | ascii parens | scope | ✔ Done（`g-design.md` · 2026-11-05） | ✔ Done(`g.md` · 2026-11-05) | ok | none |",
      "| P8 | hotfix | scope | ✔ Done（hotfix · delivered PR #1 2026-11-05） | ✔ Done（hotfix · delivered PR #1 2026-11-05） | ok | none |",
      "| P9 | pending | scope | [Pending] | [Pending] | ok | none |",
      "| P10 | escaped pipe | `cdd init --harness=<claude\\|pi>` | ✔ Done（`j-design.md` · 2026-11-05） | ✔ Done（`j.md` · 2026-11-05） | ok | none |",
      "| P11 | swallowed tail | scope | ✔ Done（`k-design.md` · 2026-11-05）  acceptance body 蚕食 | ✔ Done（`k.md` · 2026-11-05） | ok | none |",
      "| P12 | tail ends in a paren | scope | ✔ Done（`l-design.md` · 2026-11-05）  body（note） | ✔ Done（`l.md` · 2026-11-05） | ok | none |",
      "",
      "## Next section",
      "",
    ].join("\n");
    const inventory = PhaseInventory.of("fixture.md", fixture);
    expect(inventory?.rows.length).toBe(12);
    // The three new rows all resolve: each defect below is a cell-level verdict, not a count.
    expect(inventory?.rows[9]?.length).toBe(7);
    expect(inventory?.rows[10]?.length).toBe(7);
    expect(inventory?.rows[11]?.length).toBe(7);
    const defects = inventory?.defects() ?? [];
    /** Whether any defect line names this row (optionally this column) — the messages
     *  read `fixture.md · P4 · Design spec: …` (legs over a cell) or
     *  `fixture.md · P2: …` (the shape leg). */
    const namesRow = (id: string, column?: string): boolean =>
      defects.some((line) =>
        column === undefined
          ? line.startsWith(`fixture.md · ${id} ·`) || line.startsWith(`fixture.md · ${id}:`)
          : line.startsWith(`fixture.md · ${id} · ${column}:`),
      );
    expect(namesRow("P1"), "the clean row is a false red").toBe(false);
    expect(namesRow("P8"), "the hotfix exemption is a false red").toBe(false);
    expect(namesRow("P9"), "the [Pending] exemption is a false red").toBe(false);
    expect(namesRow("P10"), "the escaped pipe is a false red").toBe(false);
    expect(namesRow("P11", "Design spec"), "the swallowed tail is a false green").toBe(true);
    expect(namesRow("P12", "Design spec"), "a tail that ends in a paren is a false green").toBe(
      true,
    );
    expect(
      defects.some((line) => line.includes("fixture.md · P2: ") && line.includes("8 cells")),
    ).toBe(true);
    expect(namesRow("P3", "Design spec")).toBe(true);
    expect(defects.some((line) => line.includes("v0.10"))).toBe(true);
    for (const [id, column] of [
      ["P4", "Design spec"],
      ["P5", "Implementation plan"],
      ["P6", "Design spec"],
      ["P7", "Implementation plan"],
    ] as const) {
      expect(namesRow(id, column), id).toBe(true);
    }
  });
});
