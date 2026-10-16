// packages/cdd-engine/src-next/face/__tests__/install-rows.guard.test.ts
// T13 ⑦ (spec §3.3 ⑦) — the INSTALL_ROWS ↔ README gate. `face/host.ts`'s
// `INSTALL_ROWS` docstring declared "the README upstream dependency table renders
// from these rows", but no consumer actually read them for the README — a vacuous
// claim. This gate makes the claim true: it pins the `packages/kairos/README.md`
// upstream dependency table (and its zh mirror) to `INSTALL_ROWS` —
//   · the table's row key set equals the `INSTALL_ROWS` key set;
//   · each row's Claude Code cell equals `INSTALL_ROWS[key].join("；")` (the declared
//     install banners, semicolon-joined — the README's cell shape).
// A README install-command drift fails here, never silently.
// Domicile: engine suite (§3.6 — the engine-internal ⑦ fact, single-sourced at host.ts).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { INSTALL_ROWS } from "../host.ts";

const README_ROOT = fileURLToPath(new URL("../../../../kairos/", import.meta.url));
const read = (rel: string): string => readFileSync(`${README_ROOT}/${rel}`, "utf8");

/** The upstream dependency table's rows keyed by package name — the Claude Code cell
 *  (2nd column) of each `| <pkg> | … | … | … |` row, backticks stripped. The header +
 *  separator rows are skipped (their first cell is not a registered package key). */
const tableRows = (src: string): Map<string, string> => {
  const rows = new Map<string, string>();
  for (const line of src.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    // A `| a | b | c | d |` row splits into ["", "a", "b", "c", "d", ""].
    if (cells.length < 6) continue;
    const key = cells[1]!;
    if (!(key in INSTALL_ROWS)) continue;
    rows.set(key, cells[2]!.replace(/`/g, ""));
  }
  return rows;
};

describe("INSTALL_ROWS ↔ the kairos README upstream dependency table (spec §3.3 ⑦)", () => {
  it("the declared docstring claim holds — the table's key set equals the INSTALL_ROWS key set", () => {
    for (const rel of ["README.md", "README.zh-CN.md"]) {
      const keys = [...tableRows(read(rel)).keys()].sort();
      expect(keys, `${rel}: the install table's package rows must match INSTALL_ROWS`).toEqual(
        Object.keys(INSTALL_ROWS).sort(),
      );
    }
  });

  it("each table row's Claude Code cell equals the INSTALL_ROWS banners (semicolon-joined)", () => {
    for (const rel of ["README.md", "README.zh-CN.md"]) {
      const rows = tableRows(read(rel));
      for (const [key, banners] of Object.entries(INSTALL_ROWS)) {
        expect(rows.get(key), `${rel}: row "${key}" renders from INSTALL_ROWS["${key}"]`).toBe(
          banners.join("；"),
        );
      }
    }
  });
});
