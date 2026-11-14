// packages/cdd-engine/src-next/session/__tests__/carrier-path.guard.test.ts
// P34 T1 — a record's carrier identity has ONE read face: `Ledger#carrierPathOf`
// (spec §2.12). Step ① returns the path the record remembers; steps ②③ resolve the
// read ladder the record's own line/op/cycle/attempt seeds, so a row that names no
// path still resolves the final it wrote. A second reader spelling a bare
// `.carrierPath` skips that ladder — and the ledger's own `--reviews` read did.
//
// Two gates: inside the ledger — the record store itself — the carrier-field read
// lands at exactly ONE site (the accessor's step ①), and the review leg's
// `#reviewsPathOf` routes through the accessor instead of carrying its own copy of
// step ①.
//
// Limits, stated where the gates live: the scan reads the ledger's production source
// with comments stripped, so a read re-spelled through a destructure
// (`const { carrierPath } = record`) does not register. The routing gate is the
// backstop for that shape on the one consumer this round repaired. Records handed to
// another plane's judgment (`contract/completion-criterion.ts` reads the requester's
// carrier as an INPUT fact, not to resolve a path) are outside this gate's scope —
// they never resolve a name, so they cannot skip the ladder.
//
// Zero module-level bare functions — every helper is an arrow const (the repo's
// zero-`function` declaration discipline).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../__tests__/support/strip-comments.ts";

/** `src-next/` — every path in this file resolves against the engine source root. */
const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const read = (relative: string): string => readFileSync(`${SRC_ROOT}${relative}`, "utf8");

/** The ledger's production code lines that READ a record's carrier field — a
 *  `something.carrierPath` read that is not the write seed `init.carrierPath` (a new
 *  record's initial path, written never resolved). */
const carrierReads = (): string[] =>
  stripComments(read("session/ledger.ts"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /[\w$]+\.carrierPath\b/.test(line))
    .filter((line) => !/\binit\.carrierPath\b/.test(line));

/** One method's body text — from its signature line to the first closing brace in the
 *  method's own indentation (the class methods close at two spaces). */
const methodBody = (source: string, signature: string): string => {
  const start = source.indexOf(signature);
  expect(start, signature).toBeGreaterThanOrEqual(0);
  const rest = source.slice(start);
  const end = rest.indexOf("\n  }\n");
  return stripComments(end < 0 ? rest : rest.slice(0, end));
};

describe("the record's carrier identity — ONE read face (spec §2.12)", () => {
  it("spells the bare carrier-field read at exactly ONE site — the accessor's step ①", () => {
    // Zero hits: the accessor lost its step ①, so a record's remembered path (the
    // historical fact — a pre-P34 row keeps its own spelling) stops being read and
    // every row falls to the ladder. A second hit: a consumer re-seamed step ① and
    // now skips steps ②③ on the rows that need them.
    expect(carrierReads()).toEqual(["const recorded = record.carrierPath;"]);
  });

  it("routes the review leg's `--reviews` read through the accessor", () => {
    const body = methodBody(read("session/ledger.ts"), "#reviewsPathOf(");
    expect(body).toContain("this.carrierPathOf(");
    // the shape this round repaired: the bare latest-record read, steps ②③ skipped
    expect(body).not.toContain("?.carrierPath");
    expect(body).not.toContain("?.carrierDigest");
  });
});
