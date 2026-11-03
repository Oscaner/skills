// scripts/__tests__/next-loop-twin.test.ts — the repo-level twin pin for the
// graded convergence loop (P22 · design spec §5, acceptance "分级判收敛").
//
// The method's spine — "a blocker sends the line back to fix and re-review, warn/nit
// only converges as REVIEW_FIX, and a run of REVIEW_CYCLE_CAP consecutive blocker
// cycles defers to the user" — is drawn TWICE: `next-loop.{en,zh-CN}.json` carries all
// three statements plus the cycle count, while `architecture.{en,zh-CN}.json` carries
// only the first two. This pin asserts that division of labour (the third statement
// and its number live ONLY in the two next-loop sources), that the number the diagram
// states equals the runtime constant, and that the runtime source still carries the
// symbols the diagrams point at — so changing either side turns the pin red.
//
// Zero module-level bare functions — the reader is a class (the repo's zero-`function`
// discipline applies to `scripts/`).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REVIEW_CYCLE_CAP } from "../../packages/cdd-engine/src-next/session/next.ts";

/** The repo root — the diagram sources and the runtime source both resolve under it. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIAGRAM_SRC = path.join(ROOT, "docs", "diagrams", "src");
const NEXT_SOURCE = path.join(ROOT, "packages", "cdd-engine", "src-next", "session", "next.ts");

/** The three statements the twin pin covers — the phrases each one may be written in
 *  (the diagrams are bilingual, so a statement matches either locale's wording). */
const STATEMENTS = {
  blockerReReview: [/blocker[^"]*re-review/i, /blocker[^"]*重新评审/],
  warnNitReviewFix: [/warn\s*\/\s*nit/i],
  cycleSoftCap: [/(\d+)\s+consecutive blocker cycles/i, /连续\s*(\d+)\s*个\s*blocker\s*周期/],
} as const;

/** The `REVIEW_FIX` closing word a warn/nit-only closure must name. */
const REVIEW_FIX_WORD = "REVIEW_FIX";

/** The soft-cap vocabulary — the third statement's own words (used to prove the
 *  architecture sources carry NONE of it). */
const SOFT_CAP_VOCABULARY = /soft ?cap|软上限|REVIEW_CYCLE_CAP/i;

/**
 * One diagram source — its file name plus every string value it carries (the
 * statement text lives in states / transitions / cards, so the walk collects them
 * all rather than guessing a section).
 */
class DiagramSource {
  readonly name: string;
  readonly strings: readonly string[];

  private constructor(name: string, strings: readonly string[]) {
    this.name = name;
    this.strings = strings;
  }

  /** Read one source under `docs/diagrams/src` and flatten its string values. */
  static of(name: string): DiagramSource {
    const text = readFileSync(path.join(DIAGRAM_SRC, `${name}.json`), "utf8");
    return new DiagramSource(name, DiagramSource.#stringsOf(JSON.parse(text)));
  }

  /** Every string value a statement may live in, whichever wording it was written in. */
  static #stringsOf(node: unknown): string[] {
    if (typeof node === "string") return [node];
    if (Array.isArray(node)) return node.flatMap((item) => DiagramSource.#stringsOf(item));
    if (node !== null && typeof node === "object") {
      return Object.values(node).flatMap((value) => DiagramSource.#stringsOf(value));
    }
    return [];
  }

  /** The strings that carry a statement (all patterns are alternatives). */
  carrying(patterns: readonly RegExp[]): readonly string[] {
    return this.strings.filter((text) => patterns.some((pattern) => pattern.test(text)));
  }

  /** The consecutive-blocker-cycle numbers this source states. */
  cycleCounts(): readonly number[] {
    const counts: number[] = [];
    for (const text of this.strings) {
      for (const pattern of STATEMENTS.cycleSoftCap) {
        for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
          const value = match[1] ?? match[2];
          if (value !== undefined) counts.push(Number(value));
        }
      }
    }
    return counts;
  }
}

/** The four sources of the twin — two next-loop + two architecture, one pair per locale. */
const NEXT_LOOP = [DiagramSource.of("next-loop.en"), DiagramSource.of("next-loop.zh-CN")];
const ARCHITECTURE = [DiagramSource.of("architecture.en"), DiagramSource.of("architecture.zh-CN")];
const SOURCES = [...NEXT_LOOP, ...ARCHITECTURE];

describe("the graded convergence loop — the diagrams and the runtime agree (the twin pin)", () => {
  it("the four sources together cover all three statements", () => {
    expect(SOURCES.length).toBe(4);
    for (const [statement, patterns] of Object.entries(STATEMENTS)) {
      const carriers = SOURCES.filter((source) => source.carrying(patterns).length > 0);
      expect(carriers.length, `no source carries the ${statement} statement`).toBeGreaterThan(0);
    }
  });

  it("the two next-loop sources carry all three statements (the loop's full truth)", () => {
    for (const source of NEXT_LOOP) {
      expect(
        source.carrying(STATEMENTS.blockerReReview).length,
        `${source.name} misses the blocker → re-review statement`,
      ).toBeGreaterThan(0);
      expect(
        source.carrying(STATEMENTS.warnNitReviewFix).some((text) => text.includes(REVIEW_FIX_WORD)),
        `${source.name} misses the warn/nit → ${REVIEW_FIX_WORD} statement`,
      ).toBe(true);
      expect(
        source.cycleCounts().length,
        `${source.name} misses the consecutive-cycle soft cap`,
      ).toBeGreaterThan(0);
    }
  });

  it("the two architecture sources carry only the first two statements", () => {
    for (const source of ARCHITECTURE) {
      expect(
        source.carrying(STATEMENTS.blockerReReview).length,
        `${source.name} misses the blocker → re-review statement`,
      ).toBeGreaterThan(0);
      expect(
        source.carrying(STATEMENTS.warnNitReviewFix).some((text) => text.includes(REVIEW_FIX_WORD)),
        `${source.name} misses the warn/nit → ${REVIEW_FIX_WORD} statement`,
      ).toBe(true);
      // the cycle count and the soft-cap vocabulary live ONLY in the next-loop pair
      expect(source.cycleCounts(), `${source.name} states the cycle count`).toEqual([]);
      expect(
        source.strings.filter((text) => SOFT_CAP_VOCABULARY.test(text)),
        `${source.name} states the soft cap`,
      ).toEqual([]);
    }
  });

  it("the stated cycle count equals REVIEW_CYCLE_CAP — either side changing turns this red", () => {
    for (const source of NEXT_LOOP) {
      const counts = source.cycleCounts();
      expect(counts.length).toBeGreaterThan(0);
      for (const count of counts)
        expect(count, `${source.name} states ${count}`).toBe(REVIEW_CYCLE_CAP);
    }
  });

  it("the runtime source the diagrams point at still carries the three symbols", () => {
    const source = readFileSync(NEXT_SOURCE, "utf8");
    expect(source).toContain("#blockerCount(");
    expect(source).toContain("#close(");
    expect(source).toContain("export const REVIEW_CYCLE_CAP");
    expect(Number.isInteger(REVIEW_CYCLE_CAP)).toBe(true);
  });
});
