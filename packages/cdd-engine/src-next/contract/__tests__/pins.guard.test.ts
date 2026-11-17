// packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts
// P37 T6 — the pin parseability gate's structural face (design spec §7.1 · §7.2 ·
// §7.4). One criterion, three corpora, two execution faces; this file owns the
// suite-side face:
//
//   · the gate can go RED and be repaired — a seeded dead markdown pin is reported,
//     and removing it clears the gate;
//   · the pin DEFINITION's three exclusions each have a pair — the exclusion form
//     reports nothing while a real dead reference in the same position does;
//   · the three SHAPES each resolve against their own corpus (a path with its line
//     bound, a bare symbol, a test title);
//   · the declared corpus is the whole docs corpus plus the README family, and its
//     file count is a constant: a document entering or leaving the corpus goes red.
//
// The corpus IS clean, and this file holds it there: the scan over the declared corpus
// reports zero findings (§7.3's AFTER-migration condition), the file list is a pinned
// constant, and a document entering or leaving the corpus goes red. The seeded case below
// keeps the other direction alive on its own — a dead pin is reported, and removing it
// clears the gate — so the gate is proven able to go red without the corpus being dirty.
//
// §7.1's three tiers are pinned as three cells (exact entry · unique suffix · ambiguity),
// and §7.3's time face has its own paired cells: the same pending `Create:` path answers
// identically on all three corpora, and loses that answer the moment the declaration, the
// identity or the closure changes. Condition ③'s closure is read three ways — an
// exactly-one-hit `✔ Done` row, a row naming no indexed document, and a row naming
// several — because the last two must read as CLOSED: a registration that no longer
// resolves cannot establish "not closed".
//
// P37 T8 adds three legs to this face: the member spelling of the bare-symbol shape
// (§7.1) with its paired cells, the corpus identity pin that holds `pin.files` and
// `pin.total` to the SAME declaration and the same scan, and §7.1's reverse test-shape
// leg — a path token and a title token are two tokens, so only the path is judged.
//
// The other two corpora (the judged document's body, the finding's `contract.path`)
// are pinned where they execute: `face/__tests__/lifecycle.test.ts`.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { corpusOf, PinAudit, PinIndex, PinSpans } from "../pins.ts";

/** The repo root of THIS checkout — the guard's corpus basis. */
const REPO_ROOT = path.resolve(fileURLToPath(new URL("../../../../..", import.meta.url)));

/** The corpus declaration (§7.1) — read from `contract/pins.ts`, the ONE place it is
 *  written. This file declares no list of its own, so the scan, the structural test and
 *  `PinAudit.census` cannot disagree about what the corpus is. */
const CORPUS_ROOTS: readonly string[] = corpusOf(REPO_ROOT);

/** The corpus size — pinned HERE, as a literal, so a document entering or leaving the
 *  corpus is red. It is deliberately not derived from `filesOf`: a number computed out
 *  of the same walk would agree with any corpus the walk returned, and re-emitting it
 *  could never turn this file red. */
const CORPUS_SIZE = 79;

/** The scratch fixture's source file — the symbol index's only corpus in these cases. */
const SAMPLE_SOURCE = "export const PresentSymbol = 1;\n";

/** The scratch fixture's test file — the test-title shape's only corpus. */
const SAMPLE_TEST = 'it("a declared test title", () => {});\n';

/** A pending `Create:` declaration — the path a plan writes and the tree has not landed. */
const PENDING = "packages/cdd-engine/src-next/pending/forward.ts";

/** One document's front matter over the identity facts the time face reads. */
const front = (docType: string, slug: string, program?: string): string =>
  [
    "---",
    `doc-type: ${docType}`,
    `slug: ${slug}`,
    ...(program === undefined ? [] : [`program: ${program}`]),
    "version: v0.1",
    "---",
    "",
  ].join("\n");

/** A plan body: one task block whose `Files` row declares the pending path. */
const planBody = (slug: string, pending: string | null): string =>
  [
    front("plan", slug),
    "### Task 1: the declared work",
    "",
    "#### Files",
    ...(pending === null ? [] : [`- Create: \`${pending}\``]),
    "",
    "#### DependsOn",
    "none",
    "",
  ].join("\n");

/** A charter body: one `## Phase inventory` row, closed or pending by the cell text. */
const charterBody = (planCell: string): string =>
  [
    front("overall", "prog"),
    "## Phase inventory",
    "",
    "| Phase | Scope | Design spec | Implementation plan | Acceptance | Dependency |",
    "| --- | --- | --- | --- | --- | --- |",
    `| P1 | scope | design | ${planCell} | ok | none |`,
    "",
  ].join("\n");

/** A dead reference in the migration's own shape — the `-overall.md` suffix that the
 *  template exclusion must NOT swallow (§7.3's renamed-charter path). */
const STALE_CHARTER_REFERENCE = "docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md";

interface Scratch {
  readonly root: string;
  readonly audit: PinAudit;
  readonly write: (rel: string, text: string) => void;
}

/** The fixture's carrier declaration — the two halves the member cells judge are
 *  declared HERE, inside the scratch tree, so the dead halves stay names the test writes
 *  rather than names the scan's own corpus would resolve (a string literal in a suite
 *  file IS a declaration to `PinSource`, so a dead name must live outside that tree). */
const MEMBER_SOURCE = [
  "export class HandoffSchema {",
  "  static gradingViolations(): void {}",
  "  #summaryToken = 1;",
  "  #reconstruct(): void {}",
  "}",
  "",
].join("\n");

/** One scratch root's write face — the ONE place a fixture file lands. */
const writerOf =
  (root: string): Scratch["write"] =>
  (rel, text) => {
    const at = path.join(root, rel);
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(at, text, "utf8");
  };

/** A hermetic repo — a docs tree, one source file and one test file. */
const scratch = (): Scratch => {
  const root = mkdtempSync(path.join(tmpdir(), "pin-gate-"));
  mkdirSync(path.join(root, "docs", "kairos", "plans"), { recursive: true });
  mkdirSync(path.join(root, "packages", "cdd-engine", "src-next", "__tests__"), {
    recursive: true,
  });
  writeFileSync(
    path.join(root, "packages", "cdd-engine", "src-next", "sample.ts"),
    SAMPLE_SOURCE,
    "utf8",
  );
  writeFileSync(
    path.join(root, "packages", "cdd-engine", "src-next", "__tests__", "sample.test.ts"),
    SAMPLE_TEST,
    "utf8",
  );
  return { root, audit: new PinAudit(root), write: writerOf(root) };
};

let scratchDirs: string[] = [];

const fixture = (): Scratch => {
  const f = scratch();
  scratchDirs.push(f.root);
  return f;
};

/** One hermetic repo whose symbol corpus declares a carrier with its members. */
const memberFixture = (): Scratch => {
  const f = fixture();
  f.write("packages/cdd-engine/src-next/members.ts", MEMBER_SOURCE);
  // the audit is rebuilt over the file just written — the index reads the tree lazily,
  // but the fixture's first audit predates the write
  return { ...f, audit: new PinAudit(f.root) };
};

/** A consumer tree's own source — the symbol corpus there names no `packages/` path. */
const CONSUMER_SOURCE = "export const ordersOf = (id: string): number => Number(id);\n";

/** The shape the engine is INSTALLED into: `@oscaner-skills/cdd-engine` lands in a
 *  consumer's `node_modules`, so the reviewed root has no `packages/cdd-engine/src-next`,
 *  no `packages/kairos` and no `scripts` — its own sources live wherever its authors put
 *  them (`src/` here). */
const consumerFixture = (): Scratch => {
  const root = mkdtempSync(path.join(tmpdir(), "pin-gate-consumer-"));
  scratchDirs.push(root);
  const write = writerOf(root);
  write("src/orders.ts", CONSUMER_SOURCE);
  // built after the write for the same laziness reason as `memberFixture`
  return { root, audit: new PinAudit(root), write };
};

afterEach(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
  scratchDirs = [];
});

/** One markdown body over a list of inline tokens. */
const bodyOf = (tokens: readonly string[]): string =>
  `# fixture\n\n${tokens.map((token) => `- \`${token}\`\n`).join("")}`;

describe("P37 T6 — `pin-parseability`: the gate goes red on a dead pin and green once it is repaired", () => {
  it("reports the seeded dead pins and stops reporting them after the repair", () => {
    const f = fixture();
    f.write(
      "docs/kairos/plans/seeded.md",
      bodyOf(["docs/kairos/plans/absent.md", "AbsentSymbolName", "sample.ts", "PresentSymbol"]),
    );
    const red = f.audit.scan(["docs/kairos"]);
    expect(red.map((finding) => finding.pin)).toEqual([
      "docs/kairos/plans/absent.md",
      "AbsentSymbolName",
    ]);
    for (const finding of red) {
      expect(finding.summary).toContain(finding.pin);
      expect(finding.summary).toContain("resolves nowhere");
    }
    // the same position, repaired: the path exists and the symbol resolves
    f.write("docs/kairos/plans/seeded.md", bodyOf(["sample.ts", "PresentSymbol"]));
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
  });

  it("judges the three shapes on their own terms — a path's line bound, a bare symbol, a test title", () => {
    const f = fixture();
    const source = "packages/cdd-engine/src-next/sample.ts";
    const test = "packages/cdd-engine/src-next/__tests__/sample.test.ts";
    f.write(
      "docs/kairos/plans/shapes.md",
      bodyOf([
        source,
        `${source}:1`,
        `${source}:99`,
        "PresentSymbol",
        "AbsentSymbolName",
        `${test}::a declared test title`,
        `${test}::a retired test title`,
      ]),
    );
    const findings = f.audit.scan(["docs/kairos"]);
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([
      [`${source}:99`, "path"],
      ["AbsentSymbolName", "symbol"],
      [`${test}::a retired test title`, "test"],
    ]);
    // the line bound is judged against the file, not the number alone
    expect(findings[0]?.summary).toContain("does not exist");
    expect(findings[1]?.summary).toContain("no symbol named");
    expect(findings[2]?.summary).toContain("carries no test titled");
  });

  it("resolves DECLARATIONS, not prose — a name surviving in a comment or a guard regex is not a symbol", () => {
    const f = fixture();
    // the two places a deleted name outlives its declaration: the typed prose of a
    // comment, and a retirement guard's own regex text (the measured case — five
    // members deleted by P36 still named by the test that proves them gone)
    f.write(
      "packages/cdd-engine/src-next/retired.ts",
      [
        "// RetiredInComment",
        "const guard = /RetiredInRegex/;",
        'export const entry = "AWordTableEntry";',
        "export class PresentClass {",
        "  #presentMember(): void {}",
        "}",
        "",
      ].join("\n"),
    );
    // a string / template literal stays a declaration: this tree declares live
    // vocabulary that way (`face/words.ts` spells `CDD_BLOCKED:` as a literal,
    // `contract/lint.ts` derives `DependsOn id` from one), so blanking literals would
    // report live coordinates as dead
    const findings = f.audit.scanText(
      bodyOf([
        "RetiredInComment",
        "RetiredInRegex",
        "PresentClass",
        "#presentMember",
        "AWordTableEntry",
      ]),
      "declarations.md",
    );
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([
      ["RetiredInComment", "symbol"],
      ["RetiredInRegex", "symbol"],
    ]);
  });

  it("declares the whole corpus, pins its size, and holds it at zero findings", () => {
    const audit = new PinAudit(REPO_ROOT);
    const files = audit.filesOf(CORPUS_ROOTS);
    expect(files).toHaveLength(CORPUS_SIZE);
    for (const file of files) expect(file.endsWith(".md"), file).toBe(true);
    // the corpus is judged by the same criterion the read-back uses — a scan reads
    // exactly the declared files (no second corpus, no baseline, no exemption list) —
    // and every pin in it resolves: the migration's delivery condition, held from now on.
    expect(audit.scan(CORPUS_ROOTS).length).toBe(0);
  });

  it("reads the corpus ONE way — its file count is the size pin, its total the same scan", () => {
    const audit = new PinAudit(REPO_ROOT);
    const census = audit.census(CORPUS_ROOTS);
    // §7.1's declaration is imported, not restated: the size pin and `pin.files` are two
    // readings of ONE declaration, and `pin.total` is the length of the scan the same
    // audit runs over it — never a third count
    expect(census.files).toBe(CORPUS_SIZE);
    expect(census.total).toBe(audit.scan(CORPUS_ROOTS).length);
    expect(census.total).toBe(census.symbol + census.path);
    // a corpus of nothing measures nothing: on an empty corpus the same readings fall
    // away from the declared size, so a census that never reaches a file is red
    const empty = audit.census([]);
    expect(empty.files).toBe(0);
    expect(empty.files).not.toBe(CORPUS_SIZE);
    expect(empty.total).toBe(0);
  });

  it("judges a test pin only when file and title share ONE token — a title of its own is never a pin", () => {
    const f = fixture();
    const test = "packages/cdd-engine/src-next/__tests__/sample.test.ts";
    // a resolvable path token plus an independent title token: only the path is judged
    const findings = f.audit.scanText(bodyOf([test, "a declared test title"]), "reverse.md");
    expect(findings).toEqual([]);
    expect(findings.some((finding) => finding.shape === "test")).toBe(false);
    // rewriting the title token leaves the result byte-identical — the title never enters
    // the judgment's input. Broadening `testOf` into a two-token pair, or letting the
    // classifier take a bare title first, is exactly what turns this cell red
    const rewritten = f.audit.scanText(bodyOf([test, "a retired test title"]), "reverse.md");
    expect(rewritten).toEqual(findings);
    // the pair that gives the leg its meaning: inside ONE token the same title IS judged
    const joined = f.audit.scanText(bodyOf([`${test}::a retired test title`]), "reverse.md");
    expect(joined.map((finding) => [finding.pin, finding.shape])).toEqual([
      [`${test}::a retired test title`, "test"],
    ]);
  });
});

describe("P37 T6 — the pin definition's three exclusions, each with its pair", () => {
  it("excludes the non-repo-root-relative forms — `./` · `../` · a `...` elision", () => {
    const f = fixture();
    f.write("docs/kairos/plans/rel.md", bodyOf(["./absent.md", "../absent.md", ".../absent.md"]));
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
    const shape = f.audit.scanText(bodyOf(["docs/kairos/plans/absent.md"]), "rel.md");
    expect(shape).toHaveLength(1);
  });

  it("excludes the product family by SHAPE — a machine-local artifact names no coordinate", () => {
    const f = fixture();
    f.write(
      "docs/kairos/plans/product.md",
      bodyOf([
        "progress.json",
        ".kairos/cdd/ws/base.json",
        ".kairos/cdd/ws/liveness.json",
        ".kairos/cdd/ws/in-flight.json",
        ".kairos/cdd/ws/plan-fix-1.c1.rulings.json",
        "tasks-1-fix-1-a2.c1.json",
        "tasks-<N>-<op>.json",
      ]),
    );
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
  });

  it("excludes the template family only when the token IS the entry — a real `-overall.md` path is judged", () => {
    const f = fixture();
    // the bare vocabulary words are not coordinates
    f.write("docs/kairos/plans/template.md", bodyOf(["X.md", "-overall.md", "-design.md"]));
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
    // the same SUFFIX inside a real path is a claim, and this one is dead: a suffix rule
    // would have swallowed exactly the stale charter path §7.3 migrates
    f.write("docs/kairos/plans/template.md", bodyOf([STALE_CHARTER_REFERENCE]));
    const findings = f.audit.scan(["docs/kairos"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.pin).toBe(STALE_CHARTER_REFERENCE);
    expect(findings[0]?.shape).toBe("path");
  });

  it("excludes the ephemeral `.changeset/*.md` reference — a record, not a claim", () => {
    const f = fixture();
    f.write("docs/kairos/plans/ephemeral.md", bodyOf([".changeset/p37-grading-boundary.md"]));
    expect(f.audit.scan(["docs/kairos"])).toEqual([]);
    // a dead path outside the consumed directory is still judged
    const findings = f.audit.scanText(bodyOf(["changeset/absent.md"]), "ephemeral.md");
    expect(findings).toHaveLength(1);
  });

  it("judges inline spans only — a fenced block is example code, never a claim", () => {
    const f = fixture();
    f.write(
      "docs/kairos/plans/fenced.md",
      '# fixture\n\n```json\n{ "pin": `docs/kairos/plans/absent.md` }\n```\n\n`docs/kairos/plans/absent.md`\n',
    );
    const findings = f.audit.scan(["docs/kairos"]);
    expect(findings).toHaveLength(1);
    expect(PinSpans.tokensOf("a `one` and ``two`` end")).toEqual(["one", "two"]);
  });
});

describe("P37 T7 — §7.1's three tiers: exact entry, unique suffix, ambiguity", () => {
  it("tier ① — an exact entry wins, and the line bound is judged on THAT file", () => {
    const f = fixture();
    f.write("README.md", "one\ntwo\nthree\n");
    f.write(".changeset/README.md", "short\n");
    // the repo copy has three lines, so line 3 is legal there and nowhere else — a
    // first-hit resolver lands on the shorter sibling and reports this legal pin red
    expect(f.audit.scanText(bodyOf(["README.md:3"]), "tiers.md")).toEqual([]);
    // …and a line past ITS end is red, never judged against the sibling's length
    const findings = f.audit.scanText(bodyOf(["README.md:5"]), "tiers.md");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.summary).toContain("has 4 lines");
  });

  it("tier ② — a unique suffix resolves to its one candidate", () => {
    expect(new PinIndex(REPO_ROOT).resolve("face/declare.ts")).toEqual({
      kind: "resolved",
      entry: "packages/cdd-engine/src-next/face/declare.ts",
    });
  });

  it("tier ③ — two candidates are reported, never silently chosen", () => {
    const f = fixture();
    f.write("packages/cdd-engine/src-next/contract/declare.ts", "export const a = 1;\n");
    f.write("packages/cdd-engine/src-next/face/declare.ts", "export const b = 2;\n");
    const findings = f.audit.scanText(bodyOf(["declare.ts"]), "tiers.md");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.shape).toBe("path");
    expect(findings[0]?.summary).toContain("packages/cdd-engine/src-next/contract/declare.ts");
    expect(findings[0]?.summary).toContain("packages/cdd-engine/src-next/face/declare.ts");
  });
});

describe("P37 T7 — §7.3's time face: one pending table, three corpora, one answer", () => {
  const JUDGED = "docs/kairos/specs/s1-design.md";

  /** A single-spec-shaped scratch repo: the judged spec declares `slug: s1` and carries
   *  the pin in its own body, and one plan declares the pending path. */
  const pendingFixture = (options: {
    readonly planSlug?: string;
    readonly pending?: string | null;
    readonly program?: string;
    readonly charter?: string;
  }): Scratch => {
    const f = fixture();
    f.write(JUDGED, `${front("phase-spec", "s1", options.program)}\n# spec\n\n- \`${PENDING}\`\n`);
    f.write(
      "docs/kairos/plans/s1.md",
      planBody(options.planSlug ?? "s1", options.pending === undefined ? PENDING : options.pending),
    );
    if (options.charter !== undefined) {
      f.write("docs/kairos/overalls/prog.md", options.charter);
    }
    return f;
  };

  const pinsOf = (findings: readonly { pin: string }[]): readonly string[] =>
    findings.map((finding) => finding.pin);

  it("skips the pending path on all three corpora — scan, scanText and pathResolves agree", () => {
    const f = pendingFixture({});
    expect(pinsOf(f.audit.scan(["docs/kairos"]))).toEqual([]);
    expect(f.audit.scanText(`# spec\n\n- \`${PENDING}\`\n`, JUDGED)).toEqual([]);
    expect(f.audit.pathResolves(PENDING, JUDGED)).toBe(true);
  });

  it("skips the pending path as a MEMBER carrier too — one pending path, one answer", () => {
    const f = pendingFixture({});
    // §7.1 sieves the carrier half by the bare path form, so the carrier IS the pending
    // path: the bare spelling and the member spelling are the same coordinate and must
    // answer alike, or one corpus answers a pending path two ways
    expect(f.audit.scanText(bodyOf(["pending/forward.ts#PresentSymbol"]), JUDGED)).toEqual([]);
    expect(f.audit.scanText(bodyOf([`${PENDING}#PresentSymbol`]), JUDGED)).toEqual([]);
    // the pair: with no `Create:` declaration the same member carrier is reported, exactly
    // as the bare path is — the skip belongs to the plan, never to the spelling
    const undeclared = pendingFixture({ pending: null });
    const findings = undeclared.audit.scanText(
      bodyOf(["pending/forward.ts#PresentSymbol"]),
      JUDGED,
    );
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([
      ["pending/forward.ts#PresentSymbol", "symbol"],
    ]);
    expect(findings[0]?.summary).toContain("resolves nowhere in the tree");
  });

  it("answers `null` judged on the `contract.path` corpus alone — the other two readings hold", () => {
    const f = pendingFixture({});
    // a wave / branch round has no judged document: condition ① has no subject
    expect(f.audit.pathResolves(PENDING, null)).toBe(false);
    expect(f.audit.scanText(`# spec\n\n- \`${PENDING}\`\n`, JUDGED)).toEqual([]);
    expect(pinsOf(f.audit.scan(["docs/kairos"]))).toEqual([]);
  });

  it("drops the skip when the declaring plan stops writing the line", () => {
    const f = pendingFixture({ pending: null });
    expect(pinsOf(f.audit.scan(["docs/kairos"]))).toEqual([PENDING]);
    expect(f.audit.pathResolves(PENDING, JUDGED)).toBe(false);
  });

  it("drops the skip when the declaring plan shares no identity key with the judged document", () => {
    const f = pendingFixture({ planSlug: "s2" });
    expect(pinsOf(f.audit.scan(["docs/kairos"]))).toEqual([PENDING]);
    expect(f.audit.pathResolves(PENDING, JUDGED)).toBe(false);
  });

  it("drops the skip once the plan's program charter names it in a `✔ Done（…）` row", () => {
    const closed = pendingFixture({
      program: "prog",
      charter: charterBody("✔ Done（`s1.md` · 2026-01-01）"),
    });
    // closed ⇒ the skip is gone on BOTH corpora: the judged spec's body and the plan's
    // own `Create:` line report the same absent path
    expect(pinsOf(closed.audit.scan(["docs/kairos"]))).toEqual([PENDING, PENDING]);
    const pending = pendingFixture({ program: "prog", charter: charterBody("[Pending]") });
    expect(pinsOf(pending.audit.scan(["docs/kairos"]))).toEqual([]);
  });

  it("reads a `✔ Done` row naming ZERO indexed documents as CLOSED — registration rot never buys a skip", () => {
    const dead = pendingFixture({
      program: "prog",
      charter: charterBody("✔ Done（`gone.md` · 2026-01-01）"),
    });
    // the row's FILE NAME resolves to nothing, so it cannot establish "not closed": the
    // skip is lost and the pending path is reported on BOTH corpora — the judged spec's
    // body and the plan's own `Create:` line. The dead registration's own name is a dead
    // pin as well, which is the same fact read from the other side. The intuitive refactor
    // (`hits.length === 1 && hits[0].head.slug === slug`) turns this row into a silent skip
    // instead — the failure condition ③ exists to stop
    const pins = pinsOf(dead.audit.scan(["docs/kairos"]));
    expect(pins.filter((pin) => pin === PENDING)).toHaveLength(2);
    expect(pins).toContain("gone.md");
    expect(dead.audit.pathResolves(PENDING, JUDGED)).toBe(false);
  });

  it("reads a `✔ Done` row naming SEVERAL indexed documents as CLOSED — no single plan is named", () => {
    const f = pendingFixture({
      program: "prog",
      charter: charterBody("✔ Done（`s1.md` · 2026-01-01）"),
    });
    // a second indexed document carries the same FILE NAME, so the cell names no ONE
    // plan — several hits read as CLOSED, exactly like zero
    f.write("docs/kairos/specs/s1.md", front("phase-spec", "s1-other"));
    const pins = pinsOf(f.audit.scan(["docs/kairos"]));
    expect(pins.filter((pin) => pin === PENDING)).toHaveLength(2);
    expect(pins).toContain("s1.md");
    expect(f.audit.pathResolves(PENDING, JUDGED)).toBe(false);
  });
});

describe("P37 T8 — §7.1's member spelling: carrier and member judged in ONE token", () => {
  it("reads a carrier + member token whose halves both resolve as a pin", () => {
    const f = memberFixture();
    // both halves are declarations in the fixture, so the token is one coordinate rather
    // than two words — the flat identifier set is what makes the member spelling work
    expect(f.audit.scanText(bodyOf(["HandoffSchema.gradingViolations"]), "member.md")).toEqual([]);
    // the private-member separator and the trailing arguments are spellings, not shapes
    expect(f.audit.scanText(bodyOf(["HandoffSchema#summaryToken"]), "member.md")).toEqual([]);
  });

  it("reports exactly ONE finding when the member half is not in the index", () => {
    const f = memberFixture();
    const token = "HandoffSchema.ZzNoMemberQq";
    const findings = f.audit.scanText(bodyOf([token]), "member.md");
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([[token, "symbol"]]);
    // the summary names the dead half, not the whole token twice
    expect(findings[0]?.summary).toContain("ZzNoMemberQq");
  });

  it("reports exactly ONE finding when the carrier half is not in the index", () => {
    const f = memberFixture();
    const token = "ZzNoCarrierQq#summaryToken";
    const findings = f.audit.scanText(bodyOf([token]), "member.md");
    // the member resolves; the carrier does not — still one finding for the one token
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([[token, "symbol"]]);
    expect(findings[0]?.summary).toContain("ZzNoCarrierQq");
    // an ABSENT carrier keeps the "nowhere" wording — the pair for the ambiguous cell
    expect(findings[0]?.summary).toContain("resolves nowhere in the tree");
  });

  it("names EVERY candidate when the carrier half is AMBIGUOUS — tier ③ does not pick one", () => {
    const audit = new PinAudit(REPO_ROOT);
    const token = "declare.ts#SCHEMA_TYPE_KEYS";
    // `declare.ts` names two entries, and the member is live in both — reporting
    // "resolves nowhere" here would invite deleting a live pin instead of qualifying
    // its basename
    const findings = audit.scanText(bodyOf([token]), "member.md");
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([[token, "symbol"]]);
    const summary = findings[0]?.summary ?? "";
    expect(summary).toContain("contract/declare.ts");
    expect(summary).toContain("face/declare.ts");
    expect(summary).toContain("names 2 entries");
    expect(summary).not.toContain("its carrier `declare.ts` resolves nowhere");
  });

  it("reads a lowercase member name as prose — the separator never rewrites the shape test", () => {
    const f = memberFixture();
    // `impact.scenario` and a bare lowercase word are judged by the SAME rule: prose.
    // Reading the member half as a name merely because a separator precedes it would
    // make every dotted phrase in the corpus a claim
    expect(f.audit.scanText(bodyOf(["impact.scenario", "wave"]), "member.md")).toEqual([]);
  });

  it("peels trailing call arguments before the split", () => {
    const f = memberFixture();
    const bare = f.audit.scanText(bodyOf(["HandoffSchema#summaryToken"]), "member.md");
    const called = f.audit.scanText(bodyOf(["HandoffSchema#summaryToken()"]), "member.md");
    expect(called).toEqual(bare);
    // the peel is a peel, not a pass: the same token with a dead member still reports
    const dead = f.audit.scanText(bodyOf(["HandoffSchema#ZzNoMemberQq()"]), "member.md");
    expect(dead.map((finding) => finding.pin)).toEqual(["HandoffSchema#ZzNoMemberQq()"]);
  });

  it("reads an EMPTY carrier as no member reference — `#` is that symbol's own prefix", () => {
    const f = memberFixture();
    // the pair: a `#`-prefixed dead name is one symbol finding, a live one is none.
    // Splitting at the last `#` and calling the empty half a carrier would read BOTH as
    // prose, and a batch of such tokens would silently lose its judgment
    const dead = f.audit.scanText(bodyOf(["#ZzNoMemberQq"]), "member.md");
    expect(dead.map((finding) => [finding.pin, finding.shape])).toEqual([
      ["#ZzNoMemberQq", "symbol"],
    ]);
    expect(f.audit.scanText(bodyOf(["#reconstruct"]), "member.md")).toEqual([]);
  });

  it("resolves the spelling against the REAL corpus too — it is not a fixture-only shape", () => {
    const audit = new PinAudit(REPO_ROOT);
    expect(audit.scanText(bodyOf(["HandoffSchema.gradingViolations"]), "member.md")).toEqual([]);
    expect(audit.scanText(bodyOf(["BoardView#summaryToken()"]), "member.md")).toEqual([]);
  });
});

describe("P37 — the symbol corpus is the reviewed repo's own sources, not this repo's trees", () => {
  it("resolves a consumer tree's live symbol and still reports the dead one beside it", () => {
    const f = consumerFixture();
    f.write("docs/kairos/specs/c1-design.md", bodyOf(["ordersOf", "ordersAbsent"]));
    // the pair: a symbol live in the tree the review RUNS IN is not dead, and a symbol
    // nobody declares still is. An index built from this repo's three tree names is empty
    // in a consumer root, which would report BOTH as dead and land the round REVIEW_FIX
    expect(f.audit.scan(["docs/kairos"]).map((finding) => [finding.pin, finding.shape])).toEqual([
      ["ordersAbsent", "symbol"],
    ]);
  });

  it("judges a consumer tree's member spelling against the same corpus", () => {
    const f = consumerFixture();
    f.write(
      "src/schema.ts",
      "export class HandoffSchema {\n  static gradingViolations(): void {}\n}\n",
    );
    const audit = new PinAudit(f.root);
    expect(audit.scanText(bodyOf(["HandoffSchema.gradingViolations"]), "c1-design.md")).toEqual([]);
    const dead = audit.scanText(bodyOf(["HandoffSchema.gradingGone"]), "c1-design.md");
    expect(dead.map((finding) => [finding.pin, finding.shape])).toEqual([
      ["HandoffSchema.gradingGone", "symbol"],
    ]);
  });

  it("reads a tree's own source files, not its build output or its workspace products", () => {
    const f = consumerFixture();
    f.write(
      "node_modules/@oscaner-skills/cdd-engine/dist/pins.ts",
      "export const zzPackedQq = 1;\n",
    );
    f.write(".kairos/cdd/ws/tasks-1-implement.json", '{"zzProductQq": 1}\n');
    const findings = f.audit.scanText(bodyOf(["zzPackedQq", "zzProductQq"]), "c1-design.md");
    // both are dead: a vendored copy of the engine and a machine-local product name are
    // not declarations of the reviewed tree, and reading them would let an installed
    // copy resolve a pin the consumer's own sources never make
    expect(findings.map((finding) => [finding.pin, finding.shape])).toEqual([
      ["zzPackedQq", "symbol"],
      ["zzProductQq", "symbol"],
    ]);
  });
});
