// packages/cdd-engine/src-next/face/__tests__/plugins.guard.test.ts
// The plugin roster ↔ README gate — the install surface is a RENDERING of
// `face/plugins.ts`, so this gate makes that claim true instead of aspirational:
//   · row keys equal the `PLUGINS` row names, INCLUDING order (the roster order is
//     the execution order and the README row order);
//   · each row's host column is compared by COLUMN POSITION against `HOST_IDS` — the
//     column order is derived, never a copied host vocabulary;
//   · each cell equals that row's `install` argv, one command per argv tuple, joined
//     with the full-width `；` the README cell uses;
//   · the header cells equal the pinned `Package | Claude Code | Pi` labels. These
//     two display labels are written ONCE, in this assertion: `HOST_IDS`'s
//     `claude` / `pi` values do not determine `Claude Code` / `Pi`, and inventing a
//     label map here would be exactly the second host vocabulary the single-source
//     discipline forbids — so the labels are pinned as literal data instead;
//   · the four README claim files (root EN + zh, kairos EN + zh) each carry both
//     `cdd init --harness=<id>` command bytes, per file and per host id.
// The `update` shape stays out of the READMEs by design: its argv is pinned by the
// engine unit suite (`face/__tests__/init.test.ts`), so the README table never holds
// a second copy of it.
// Domicile: engine suite (the same cross-plane READ precedent the retired
// `install-rows.guard.test.ts` set — the roster's fact, gated at its source).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { HOST_IDS } from "../host.ts";
import { PLUGINS } from "../plugins.ts";

const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));

/** The two READMEs that render the per-package install table (EN source + zh mirror). */
const INSTALL_TABLES = ["packages/kairos/README.md", "packages/kairos/README.zh-CN.md"];

/** The four README claim files that must carry the `cdd init` command bytes. */
const INIT_SURFACES = [
  "README.md",
  "README.zh-CN.md",
  "packages/kairos/README.md",
  "packages/kairos/README.zh-CN.md",
];

/** The pinned install-table header — the two display labels' ONLY home (see the
 *  file header: a host-id → label map is the forbidden second vocabulary). */
const HEADER = ["Package", "Claude Code", "Pi"];

/** The separator cell shape of a markdown table's delimiter row. */
const SEPARATOR = /^:?-{3,}:?$/;

const read = (rel: string): string => {
  return readFileSync(`${REPO}${rel}`, "utf8");
};

/** One markdown row's cells (backticks stripped) — `null` for a non-table line. */
const cellsOf = (line: string): string[] | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim().replace(/`/g, ""));
};

/** The install table of one README — located by its first body row (the roster's
 *  first package), so the header assertion below judges the labels instead of
 *  assuming them. Returns the header cells and the body rows in document order. */
const installTable = (rel: string): { header: string[]; rows: string[][] } => {
  const lines = read(rel).split("\n");
  const first = lines.findIndex((line) => cellsOf(line)?.[0] === PLUGINS[0].name);
  expect(
    first > 1,
    `${rel}: no install table row for the roster's first package "${PLUGINS[0].name}"`,
  ).toBeTruthy();
  const separator = cellsOf(lines[first - 1] ?? "") ?? [];
  expect(
    separator.length > 0 && separator.every((cell) => SEPARATOR.test(cell)),
    `${rel}: the row for "${PLUGINS[0].name}" is not preceded by a table delimiter row`,
  ).toBeTruthy();
  const rows: string[][] = [];
  for (const line of lines.slice(first)) {
    const cells = cellsOf(line);
    if (cells === null) break;
    rows.push(cells);
  }
  return { header: cellsOf(lines[first - 2] ?? "") ?? [], rows };
};

/** The install argv of one row on one host, rendered the way the README cell does —
 *  one command per argv tuple, `；`-joined. */
const renderCell = (rowIndex: number, hostIndex: number): string => {
  const row = PLUGINS[rowIndex]!;
  const host = HOST_IDS[hostIndex]!;
  return row[host].install.map((argv) => argv.join(" ")).join("；");
};

describe("PLUGINS ↔ the kairos README install table (the four-combination gate)", () => {
  it("the table's row keys equal the PLUGINS row names, in roster order", () => {
    for (const rel of INSTALL_TABLES) {
      const rows = installTable(rel).rows;
      expect(
        rows.map((row) => row[0]),
        `${rel}: the install table's package rows drifted`,
      ).toEqual(PLUGINS.map((row) => row.name));
    }
  });

  it("each row's host columns, by column position == HOST_IDS order, equal the install argv", () => {
    for (const rel of INSTALL_TABLES) {
      const rows = installTable(rel).rows;
      for (const [rowIndex, row] of rows.entries()) {
        for (const hostIndex of HOST_IDS.keys()) {
          const cell = row[hostIndex + 1];
          const expected = renderCell(rowIndex, hostIndex);
          expect(
            cell,
            `${rel}: row "${row[0]}" column "${HOST_IDS[hostIndex]}" must render PLUGINS install argv`,
          ).toBe(expected);
        }
      }
    }
  });

  it("the table header cells equal the pinned Package | Claude Code | Pi labels", () => {
    for (const rel of INSTALL_TABLES) {
      const { header, rows } = installTable(rel);
      expect(header, `${rel}: install table header drifted from the pinned labels`).toEqual(HEADER);
      for (const row of rows) {
        expect(row.length, `${rel}: row "${row[0]}" must carry exactly three cells`).toBe(
          HEADER.length,
        );
      }
    }
  });
});

describe("the cdd init command bytes on the four README claim surfaces", () => {
  it("every claim surface carries the init command for every host id", () => {
    for (const rel of INIT_SURFACES) {
      const md = read(rel);
      for (const host of HOST_IDS) {
        const bytes = `npx -y @oscaner-skills/cdd-engine@latest init --harness=${host}`;
        expect(md.includes(bytes), `${rel}: missing the cdd init bytes "${bytes}"`).toBeTruthy();
      }
    }
  });
});
