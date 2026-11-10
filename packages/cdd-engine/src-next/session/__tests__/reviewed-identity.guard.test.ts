// packages/cdd-engine/src-next/session/__tests__/reviewed-identity.guard.test.ts
// P25 T1 — the reviewed-revision write-back judgment has ONE home
// (`session/reviewed-identity.ts`). Both faces that state the write-back — the
// lifecycle's `#bookkeep` (the record a real run appends) and the preview renderer's
// `#recordsOf` (the `would record:` forecast) — read the same judgment; neither
// re-spells the phase whitelist nor the kind → leg mapping. Two STRUCTURE gates hold
// that, plus text pins on the two call sites and on the judgment's own purity.
//
// Limits, stated where the gates live (a literal gate cannot catch every shape): a
// copy that rewrites the comparison — `includes([...])`, a `Set`, or a
// single-quoted literal — slips past the literal count. This phase deliberately adds
// no static analysis beyond these counts. The runtime grid in the second half of this
// file is the pin that a wrong JUDGMENT fails; the literal gates are the pin that a
// second COPY cannot appear silently.
//
// Zero module-level bare functions — every helper is an arrow const (the repo's
// zero-`function` declaration discipline).

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { RoundPhase } from "../ledger.ts";
import { REVIEWED_WRITE_PHASES, ReviewedIdentity, type ReviewedLeg } from "../reviewed-identity.ts";
import type { AuditTarget } from "../run.ts";

/** `src-next/` — every path in this file resolves against the engine source root. */
const SRC = fileURLToPath(new URL("../../", import.meta.url));

const read = (relative: string): string => readFileSync(`${SRC}${relative}`, "utf8");

const occurrences = (text: string, literal: string): number => text.split(literal).length - 1;

/** One import statement's clause (the specifier list) and module specifier — wide
 *  enough to span a multi-line specifier list. */
const importStatements = (source: string): Array<{ clause: string; module: string }> =>
  [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g)].map((match) => ({
    clause: match[1] ?? "",
    module: match[2] ?? "",
  }));

/** Strip line comments and block comments, leaving the code text the purity gate
 *  asserts on. The judgment's docstrings NAME the verdict flag and the plan path on
 *  purpose (they are its stated non-inputs), so the gate reads code only. */
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

/** The two faces that state the write-back — the gate's whole scope. Scoping the
 *  count to these two files (never a repo-wide sweep) keeps the gate's own pattern
 *  string out of its own tally. */
const WRITE_BACK_FACES: readonly string[] = ["face/preview.ts", "session/run.ts"];

/** The whitelist's comparison literal as the two faces spelled it. */
const WHITELIST_LITERAL = 'frame.phase === "branch-review"';

/** The judgment file — the whitelist's ONE home. */
const JUDGMENT_FILE = "session/reviewed-identity.ts";

/** The judgment's own import modules — the two types it may take, type-only. */
const JUDGMENT_MODULES: readonly string[] = ["./ledger.ts", "./run.ts"];

/** Every non-test engine source file (the `__tests__/` trees are excluded, so the
 *  gate's own pattern strings never self-match). */
const engineSourceFiles = (): string[] =>
  readdirSync(SRC, { recursive: true })
    .map((entry) => String(entry))
    .filter((relative) => relative.endsWith(".ts") && !relative.includes("__tests__"));

/** The number of `REVIEWED_WRITE_PHASES` declarations in one source text. */
const declarationCount = (text: string): number =>
  [...text.matchAll(/(?:export\s+)?const\s+REVIEWED_WRITE_PHASES\b/g)].length;

/** `#bookkeep`'s body — sliced from its SIGNATURE line (never from the first textual
 *  occurrence, which is the call site inside `advance`) to the next two-space `}`. */
const BOOKKEEP_SLICE = /^ {2}#bookkeep\(frame: OpenFrame[\s\S]*?\n {2}\}/m;

const bookkeepBody = (): string => {
  const match = BOOKKEEP_SLICE.exec(read("session/run.ts"));
  if (match === null) throw new Error("run.ts #bookkeep signature slice not found");
  return match[0];
};

/** The kind → leg mapping, HAND-WRITTEN: never derived by iterating the constant the
 *  judgment exports (a wrong constant would then grow wrong expectations with it). */
const KIND_LEG: ReadonlyArray<readonly [AuditTarget["kind"], ReviewedLeg]> = [
  ["wave", "brief"],
  ["plan", "doc"],
  ["spec", "doc"],
  ["branch", "branch"],
];

/** The whitelist phases, HAND-WRITTEN from the specification. The equality with
 *  `REVIEWED_WRITE_PHASES` has its own cell in the grid below — neither list is read
 *  off the other. */
const TABLE_PHASES: readonly RoundPhase[] = ["review", "branch-review", "fix"];

describe("gate ① — phase whitelist-disappearance (the judgment owns it, no face copy)", () => {
  it("neither write-back face re-spells the branch-review phase comparison", () => {
    for (const relative of WRITE_BACK_FACES) {
      expect(
        occurrences(read(relative), WHITELIST_LITERAL),
        `${relative} re-spells the whitelist`,
      ).toBe(0);
    }
  });
});

describe("gate ② — REVIEWED_WRITE_PHASES declaration single-source", () => {
  it("is declared exactly once across the non-test engine source, in the judgment file", () => {
    const counts: Array<[string, number]> = engineSourceFiles().map(
      (relative): [string, number] => [relative, declarationCount(read(relative))],
    );
    const declaring = counts.filter(([, count]) => count > 0);
    expect(declaring.map(([relative]) => relative)).toEqual([JUDGMENT_FILE]);
    expect(declaring.reduce((total, [, count]) => total + count, 0)).toBe(1);
  });
});

describe("the judgment's runtime grid — hand-written cells, never derived", () => {
  for (const phase of TABLE_PHASES) {
    it(`${phase} binds the same kind → leg mapping on every target kind`, () => {
      for (const [kind, leg] of KIND_LEG) {
        expect(ReviewedIdentity.legOf(phase, kind), `${phase} × ${kind}`).toBe(leg);
      }
    });
  }

  it("a phase outside the whitelist binds nothing — implement × all four kinds is null", () => {
    // The four cells are the pin for "a phase outside the whitelist never writes";
    // they belong to this task, not to the acceptance matrix task.
    for (const [kind] of KIND_LEG) {
      expect(ReviewedIdentity.legOf("implement", kind), `implement × ${kind}`).toBeNull();
    }
  });

  it("REVIEWED_WRITE_PHASES is exactly the three binding phases", () => {
    expect([...REVIEWED_WRITE_PHASES]).toEqual(["review", "branch-review", "fix"]);
  });

  it("the conservative chain answers null for a kind the target union does not list", () => {
    expect(ReviewedIdentity.legOf("review", "bogus" as AuditTarget["kind"])).toBeNull();
  });
});

/** P32 T1 — the `touchedDoc` gate's phases, HAND-WRITTEN from the specification:
 *  the gate's reason is whether the phase is EXPECTED to rewrite the document it
 *  judges, and only `fix` is. A review / branch-review judges bytes it never writes,
 *  so a claim of "touched nothing" must not void its own conclusion; `implement`
 *  binds nothing at all. */
const TOUCHED_DOC_GATED: readonly RoundPhase[] = ["fix"];
const TOUCHED_DOC_FREE: readonly RoundPhase[] = ["review", "branch-review", "implement"];

describe("P32 T1 — gatedByTouchedDoc is phase-scoped, fix alone", () => {
  for (const phase of TOUCHED_DOC_GATED) {
    it(`${phase} is gated by touchedDoc`, () => {
      expect(ReviewedIdentity.gatedByTouchedDoc(phase)).toBe(true);
    });
  }

  for (const phase of TOUCHED_DOC_FREE) {
    it(`${phase} is NOT gated by touchedDoc`, () => {
      expect(ReviewedIdentity.gatedByTouchedDoc(phase)).toBe(false);
    });
  }
});

describe("P32 T1 — #bookkeep reads the phase-scoped gate from the judgment, never re-spells it", () => {
  it("the write-back gate calls ReviewedIdentity.gatedByTouchedDoc", () => {
    expect(bookkeepBody()).toContain("ReviewedIdentity.gatedByTouchedDoc(");
  });

  it("no face compares the fix phase against touchedDoc on its own", () => {
    for (const relative of WRITE_BACK_FACES) {
      expect(
        occurrences(read(relative), 'frame.phase === "fix"'),
        `${relative} re-spells the phase-scoped gate`,
      ).toBe(0);
    }
  });
});

describe("purity — the judgment reads nothing but (phase, kind)", () => {
  const code = stripComments(read(JUDGMENT_FILE));

  it("strips to non-empty code that still holds the judgment (the stripper is not vacuous)", () => {
    expect(code).toContain("class ReviewedIdentity");
    expect(code).toContain("static legOf(");
    expect(code).toContain("static gatedByTouchedDoc(");
    expect(code).toContain("REVIEWED_WRITE_PHASES");
  });

  it("reads no file — no `node:fs`, no `readFile` / `readFileSync`", () => {
    expect(code).not.toContain("node:fs");
    expect(code).not.toContain("readFile");
  });

  it("takes its two types through `import type` only — no runtime static cycle", () => {
    const module = read(JUDGMENT_FILE);
    const statements = importStatements(module);
    for (const target of JUDGMENT_MODULES) {
      expect(
        statements.some((statement) => statement.module === target),
        `the judgment imports ${target}`,
      ).toBe(true);
    }
    // Zero value imports: every import line naming the ledger or the lifecycle opens
    // with the `import type {` prefix, so the judgment cannot reach their runtime
    // faces (the ledger, the frame) at all.
    const importLines = module
      .split("\n")
      .filter((line) => /\bfrom\s+"\.\/(?:run|ledger)\.ts"/.test(line));
    expect(importLines.length).toBeGreaterThanOrEqual(JUDGMENT_MODULES.length);
    for (const line of importLines) expect(line.startsWith("import type {")).toBe(true);
  });

  it("names neither the verdict flag nor the plan path in its code", () => {
    expect(code).not.toContain("targetAction");
    expect(code).not.toContain("planPath");
  });
});

describe("acceptance pin ① — #bookkeep carries zero kind branch of its own", () => {
  it("dispatches through ReviewedIdentity.legOf and never compares the target kind", () => {
    const body = bookkeepBody();
    // The slice must be the METHOD (not the call site): self-check that it holds the
    // judgment call, so a mis-anchored slice fails loudly instead of passing as an
    // empty body.
    expect(body).toContain("ReviewedIdentity.legOf(");
    expect(occurrences(body, "frame.target.kind ===")).toBe(0);
  });
});

describe("acceptance pin ② — zero value import on either side of the judgment", () => {
  it("run.ts imports the judgment's value face and any ReviewedLeg specifier as `type`", () => {
    const statements = importStatements(read("session/run.ts")).filter(
      (statement) => statement.module === "./reviewed-identity.ts",
    );
    expect(statements.length, "run.ts imports the judgment").toBeGreaterThan(0);
    expect(statements.some((statement) => /\bReviewedIdentity\b/.test(statement.clause))).toBe(
      true,
    );
    for (const statement of statements) {
      if (!/\bReviewedLeg\b/.test(statement.clause)) continue;
      expect(statement.clause, "ReviewedLeg rides the `type` modifier").toMatch(
        /\btype\s+ReviewedLeg\b/,
      );
    }
  });
});
