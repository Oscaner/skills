// packages/cdd-engine/src-next/contract/__tests__/scan-coverage.test.ts
// P42 T9 — the pin scan's COVERAGE proof (design spec §6). The delivery corpus is
// clean, so "the scan reports zero findings" is true of a gate that walks every
// document and of a gate that walks none: the two reads are indistinguishable there.
// This file separates them on a KNOWN small tree — two documents, exactly one dead
// pin — so both numbers are read against a fixture whose answer is not the corpus's:
// a census that never reaches a document cannot report the volume, and a scan that
// stops short cannot report the pin.
//
// The tree's roots are declared HERE rather than derived from `corpusOf(REPO)`: the
// pair this file exists for is that dropping one root changes both readings, which a
// derived list could never show.
//
// Zero module-level bare functions — the fixture builders are `const` arrows (the
// repository's zero-`function`-declaration discipline).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PinAudit } from "../pins.ts";

/** The two roots the fixture declares — the whole tree this file judges. */
const ROOTS = ["docs/kairos/overalls", "docs/kairos/plans"] as const;

/** The scratch trees one case builds — removed after each case. */
let scratchRoots: string[] = [];

afterEach(() => {
  for (const root of scratchRoots) rmSync(root, { recursive: true, force: true });
  scratchRoots = [];
});

/** One document body over a list of inline tokens. */
const bodyOf = (tokens: readonly string[]): string =>
  `# fixture\n\n${tokens.map((token) => `- \`${token}\`\n`).join("")}`;

/** A two-document tree: one clean charter, one plan carrying a single dead pin. */
const smallTree = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), "pin-scan-coverage-"));
  scratchRoots.push(root);
  for (const dir of ROOTS) mkdirSync(path.join(root, dir), { recursive: true });
  writeFileSync(path.join(root, ROOTS[0], "charter.md"), bodyOf([]), "utf8");
  writeFileSync(
    path.join(root, ROOTS[1], "plan.md"),
    bodyOf(["docs/kairos/plans/absent.md"]),
    "utf8",
  );
  return root;
};

describe("P42 T9 — the pin scan's coverage is proven on a known small tree", () => {
  it("reads both documents and exactly the one dead pin", () => {
    const audit = new PinAudit(smallTree());
    // The volume: two documents, read off the same declaration the scan walks.
    expect(audit.filesOf(ROOTS)).toHaveLength(2);
    // The judgment: one dead pin, named — a scan that stopped short would read zero.
    expect(audit.scan(ROOTS).map((finding) => finding.pin)).toEqual([
      "docs/kairos/plans/absent.md",
    ]);
    // The census is that same scan, so its total is the same one finding.
    const census = audit.census(ROOTS);
    expect(census.files).toBe(2);
    expect(census.total).toBe(1);
    expect(census.path).toBe(1);
    expect(census.symbol).toBe(0);
  });

  it("loses both readings when a corpus root leaves the declaration (the pair)", () => {
    const audit = new PinAudit(smallTree());
    // Only the clean charter is in the declaration now: the volume drops and the pinned
    // document is unreachable, so the same assertion would go red.
    expect(audit.filesOf(["docs/kairos/overalls"])).toHaveLength(1);
    expect(audit.scan(["docs/kairos/overalls"])).toEqual([]);
    // Restoring the root restores the reading — the two arms differ by the root alone.
    expect(audit.filesOf(ROOTS)).toHaveLength(2);
    expect(audit.scan(ROOTS)).toHaveLength(1);
  });
});
