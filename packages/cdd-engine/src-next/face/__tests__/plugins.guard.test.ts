// packages/cdd-engine/src-next/face/__tests__/plugins.guard.test.ts
// The plugin roster ↔ README gate — the install surface is a RENDERING of
// `face/plugins.ts`, so this gate makes that claim true instead of aspirational:
//   · the table's CORE span — its first three body rows — carries the core roster's
//     row names, INCLUDING order (the roster order is the execution order and the
//     README row order);
//   · each core row's host column is compared by COLUMN POSITION against `HOST_IDS` —
//     the column order is derived, never a copied host vocabulary — and against the
//     row OBJECT it came from (never the README row index indexing the roster);
//   · each cell equals that row's `install` argv, one command per argv tuple, joined
//     with the full-width `；` the README cell uses;
//   · the table's RECOMMENDED span — the body rows after the core span — carries the
//     recommended roster's row names in roster order, renders each empty claude
//     column as the `—` glyph (the empty array is the fact; `—` is its only
//     spelling) and each pi cell as the install argv;
//   · the two spans conserve the body: core rows + recommended rows == body row
//     count, so a missing or extra row fails the gate;
//   · the header cells equal the pinned `Package | Claude Code | Pi` labels. These
//     two display labels are written ONCE, in this assertion: `HOST_IDS`'s
//     `claude` / `pi` values do not determine `Claude Code` / `Pi`, and inventing a
//     label map here would be exactly the second host vocabulary the single-source
//     discipline forbids — so the labels are pinned as literal data instead;
//   · the four README claim files (root EN + zh, kairos EN + zh) each carry both
//     `cdd init --harness=<id>` command bytes, per file and per host id;
//   · each engine README's `init` usage row carries `[--include-recommends]`.
// The `update` shape stays out of the READMEs by design: its argv is pinned by the
// engine unit suite (`face/__tests__/init.test.ts`), so the README table never holds
// a second copy of it.
// Domicile: engine suite (the same cross-plane READ precedent the retired
// `install-rows.guard.test.ts` set — the roster's fact, gated at its source).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { HOST_IDS, type HostId } from "../host.ts";
import { PLUGINS, type PluginRow } from "../plugins.ts";

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

/** The roster's CORE rows — the row set the table's core span renders. Sliced by
 *  tier, never by table position: the tier is the roster's own fact. */
const CORE_ROWS: readonly PluginRow[] = PLUGINS.filter((row) => row.tier === "core");

/** The roster's RECOMMENDED rows — the row set the table's recommended span renders. */
const RECOMMENDED_ROWS: readonly PluginRow[] = PLUGINS.filter((row) => row.tier === "recommended");

/** The empty-cell literal — the ONE spelling of "this harness needs no package here".
 *  The row's empty `install` array is the fact; the README renders it as this glyph. */
const EMPTY_CELL = "—";

/** The two engine READMEs — the CLI reference carrying the `init` usage row. */
const ENGINE_READMES = ["packages/cdd-engine/README.md", "packages/cdd-engine/README.zh-CN.md"];

/** The core span of one README's install table — its first `CORE_ROWS.length` body
 *  rows. */
const coreSpan = (rel: string): string[][] => installTable(rel).rows.slice(0, CORE_ROWS.length);

/** The recommended span of one README's install table — the body rows after the core
 *  span (the split derives from the roster's tier counts, never from a table index). */
const recommendedSpan = (rel: string): string[][] => installTable(rel).rows.slice(CORE_ROWS.length);

/** The install argv of one roster ROW on one host, rendered the way the README cell
 *  does — one command per argv tuple, `；`-joined. It takes the row OBJECT: indexing
 *  the roster by the README's row number would silently mix the spans once the
 *  table grows past the core three. */
const renderCell = (row: PluginRow, host: HostId): string =>
  row[host].install.map((argv) => argv.join(" ")).join("；");

describe("PLUGINS ↔ the kairos README install table (the four-combination gate)", () => {
  it("the table's core span carries the core roster's row names, in roster order", () => {
    for (const rel of INSTALL_TABLES) {
      expect(
        coreSpan(rel).map((row) => row[0]),
        `${rel}: the install table's core package rows drifted`,
      ).toEqual(CORE_ROWS.map((row) => row.name));
    }
  });

  it("each core row's host columns, by column position == HOST_IDS order, equal the install argv", () => {
    for (const rel of INSTALL_TABLES) {
      const rows = coreSpan(rel);
      for (const [rowIndex, row] of rows.entries()) {
        const rosterRow = CORE_ROWS[rowIndex]!;
        for (const [hostIndex, host] of HOST_IDS.entries()) {
          const cell = row[hostIndex + 1];
          expect(
            cell,
            `${rel}: row "${row[0]}" column "${host}" must render the core row's install argv`,
          ).toBe(renderCell(rosterRow, host));
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

describe("PLUGINS ↔ the kairos README install table (the recommended span)", () => {
  it("the table's recommended span carries the recommended roster's row names, in roster order", () => {
    for (const rel of INSTALL_TABLES) {
      expect(
        recommendedSpan(rel).map((row) => row[0]),
        `${rel}: the install table's recommended package rows drifted`,
      ).toEqual(RECOMMENDED_ROWS.map((row) => row.name));
    }
  });

  it("each recommended row renders the `—` empty cell on claude and the install argv on pi", () => {
    for (const rel of INSTALL_TABLES) {
      for (const [rowIndex, row] of recommendedSpan(rel).entries()) {
        const rosterRow = RECOMMENDED_ROWS[rowIndex]!;
        for (const [hostIndex, host] of HOST_IDS.entries()) {
          // An empty `install` array renders as the empty-cell glyph, everything else
          // as the argv join — the empty array is the fact, `—` is its only spelling.
          const expected =
            rosterRow[host].install.length === 0 ? EMPTY_CELL : renderCell(rosterRow, host);
          expect(
            row[hostIndex + 1],
            `${rel}: row "${row[0]}" column "${host}" must render its recommended cell`,
          ).toBe(expected);
        }
      }
    }
  });

  it("the two spans conserve the table body — core + recommended equals the body row count", () => {
    for (const rel of INSTALL_TABLES) {
      const { rows } = installTable(rel);
      expect(
        rows.length,
        `${rel}: the install table body must be the core span plus the recommended span`,
      ).toBe(CORE_ROWS.length + RECOMMENDED_ROWS.length);
    }
  });
});

describe("the cdd init usage row on the engine README claim surfaces", () => {
  it("each engine README's init usage row carries the --include-recommends flag", () => {
    const usage = "cdd init --harness=<claude\\|pi> [--update] [--include-recommends]";
    for (const rel of ENGINE_READMES) {
      const row = read(rel)
        .split("\n")
        .find((line) => line.startsWith("| `init` |"));
      expect(row, `${rel}: no cdd init usage row in the CLI table`).toBeDefined();
      expect(row!.includes(usage), `${rel}: the init usage row must carry "${usage}"`).toBeTruthy();
    }
  });
});
