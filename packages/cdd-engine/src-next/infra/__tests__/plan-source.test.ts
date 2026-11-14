// packages/cdd-engine/src-next/infra/__tests__/plan-source.test.ts
// Task 2 — the PlanSource / PlanRead pins (design spec §2.1 · §2.4 · §2.7): one
// read + one parse + one tri-state classification serves BOTH entries, and the
// derived value carries the behaviour (no consumer writes `switch (read.kind)`).
// The suites pin:
//   · the tri-state × both entries (readFor derivation, readPath argv);
//   · the derivation boundaries (a null slug / an absent plan file → `undeclared`;
//     an existing-but-unreadable file → `unreadable`/`io`);
//   · every accessor's value table, one cell at a time;
//   · the reverse lookup's two causes and its existence-only probe;
//   · the eager derivation (exactly one parse per read) and the root anchoring
//     (paths go through the RepoRoot conversion pair, never `process.cwd()`).
//
// Every case constructs through the injected recipe
// `new PlanSource(new RepoRoot(tmpDir), injectedFs)` — the real fs rooted at the
// temp repo (counted + able to refuse one read), never the process cwd.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanDocType } from "../../contract/doc.ts";
import { type DocFs, NodeFs } from "../../contract/invariants.ts";
import { Words } from "../../face/words.ts";
import { PlanSource } from "../plan-source.ts";
import { RepoRoot } from "../root.ts";
import { type DocEntry, SlugIndex } from "../slug-index.ts";

const PLAN_ROOT = "docs/kairos/plans";
const SPEC_ROOT = "docs/kairos/specs";

const repos: string[] = [];

/** A fresh temp repo — the doc roots are created lazily by the writer below. */
const newRepo = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "plan-source-"));
  repos.push(dir);
  return dir;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Write one front-matter document at its repo-relative path. */
const writeDoc = (
  repo: string,
  rel: string,
  fields: Readonly<Record<string, string>>,
  body = "## Body\n",
): void => {
  const abs = path.join(repo, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  const head = ["---", ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`), "---"];
  writeFileSync(abs, `${head.join("\n")}\n${body}`, "utf8");
};

/** A two-task plan body: task 2 depends on 1, so the graph derives two waves. */
const TWO_TASK_BODY = [
  "## Constraints",
  "",
  "- none",
  "",
  "### Task 1: First",
  "",
  "#### Objective",
  "",
  "do the first thing",
  "",
  "#### DependsOn",
  "",
  "none",
  "",
  "### Task 2: Second",
  "",
  "#### DependsOn",
  "",
  "1",
  "",
].join("\n");

/** A plan body whose one task block repeats a reserved section — the grammar break. */
const DUPLICATE_SECTION_BODY = [
  "### Task 1: Broken",
  "",
  "#### Files",
  "",
  "a.ts",
  "",
  "#### Files",
  "",
  "b.ts",
  "",
].join("\n");

/** The plan front matter — the healthy shape. */
const planHead = (slug: string): Readonly<Record<string, string>> => ({
  title: "Phase one plan",
  "doc-type": "plan",
  version: "v0.3",
  slug,
});

/** The phase-spec front matter — the plan's reverse-lookup target. */
const specHead = (slug: string, program = "prog"): Readonly<Record<string, string>> => ({
  title: "Phase one",
  "doc-type": "phase-spec",
  version: "v0.1",
  slug,
  program,
});

/** Seed the healthy pair: one phase spec + its plan. */
const seedPair = (repo: string, body = TWO_TASK_BODY): void => {
  writeDoc(repo, `${SPEC_ROOT}/prog-p1-design.md`, specHead("prog-p1"));
  writeDoc(repo, `${PLAN_ROOT}/prog-p1.md`, planHead("prog-p1"), body);
};

/** The plan entry the derivation face reads — the index is the entry source, and
 *  the index is NOT a PlanSource input (the signature takes one DocEntry). */
const entryOf = (repo: string, slug: string): DocEntry => {
  const entry = SlugIndex.build(repo).planOf(slug);
  if (entry === null) throw new Error(`no indexed plan entry for ${slug}`);
  return entry;
};

/** The injected fs: the real disk rooted at the temp repo, counted, and able to
 *  refuse one path's read (the "exists but unreadable" shape NodeFs cannot show). */
class CountingFs implements DocFs {
  readonly reads: string[] = [];
  readonly existsCalls: string[] = [];
  readonly #inner: DocFs;
  readonly #refused: ReadonlySet<string>;

  constructor(refused: readonly string[] = [], inner: DocFs = new NodeFs()) {
    this.#inner = inner;
    this.#refused = new Set(refused);
  }

  exists(p: string): boolean {
    this.existsCalls.push(p);
    return this.#inner.exists(p);
  }

  read(p: string): string | null {
    this.reads.push(p);
    return this.#refused.has(p) ? null : this.#inner.read(p);
  }

  list(p: string): readonly string[] {
    return this.#inner.list(p);
  }
}

/** One concern's word table — the PlanReadWords port, hand-counted so every
 *  literal the value emits is visible in one place. The five members the value
 *  reaches through the port carry SENTINELS, not the shipped bytes: were the
 *  fixture to repeat the production table, a hardcoded literal inside
 *  `infra/plan-source.ts` would keep every assertion green. `planOrphanSpec` and
 *  `planSlugMissing` already return a distinguishable shape and keep it. */
const WORDS = {
  planReadWord: (cause: "io" | "syntax"): string => (cause === "io" ? "!w-io" : "!w-syntax"),
  planEmptyWord: (): string => "(empty!)",
  planOrphanSpec: (slug: string, specPath: string): string => `orphan ${slug} -> ${specPath}`,
  planSlugMissing: (): string => "slug missing",
  planOrphanWord: (): string => "!orphan!",
  cellEmpty: "<cell>",
  warnPrefix: "WARN:",
};

describe("PlanSource.readFor — the derived face's tri-state", () => {
  it("reads a healthy plan into the ready state with the eager graph", () => {
    const repo = newRepo();
    seedPair(repo);
    const read = new PlanSource(new RepoRoot(repo), new CountingFs()).readFor(
      entryOf(repo, "prog-p1"),
    );
    expect(read.kind).toBe("ready");
    expect(read.path()).toBe(`${PLAN_ROOT}/prog-p1.md`);
    expect(read.waves()).toHaveLength(2);
    expect(read.graph()?.batches()).toHaveLength(2);
  });

  it("reads a null slug as undeclared — never a second construction path", () => {
    const repo = newRepo();
    const read = new PlanSource(new RepoRoot(repo), new CountingFs()).readFor({
      path: "",
      rel: "",
      docType: "phase-spec",
      slug: null,
      program: null,
      version: null,
      status: null,
      title: null,
    });
    expect(read.kind).toBe("undeclared");
    expect(read.path()).toBeNull();
  });

  it("reads a slug whose derived plan file is absent as undeclared", () => {
    const repo = newRepo();
    writeDoc(repo, `${SPEC_ROOT}/prog-p1-design.md`, specHead("prog-p1"));
    const read = new PlanSource(new RepoRoot(repo), new CountingFs()).readFor({
      path: "",
      rel: `${SPEC_ROOT}/prog-p1-design.md`,
      docType: "phase-spec",
      slug: "prog-p1",
      program: "prog",
      version: "v0.1",
      status: null,
      title: null,
    });
    expect(read.kind).toBe("undeclared");
  });

  it("reads an existing-but-unreadable plan file as unreadable/io", () => {
    const repo = newRepo();
    seedPair(repo);
    const abs = path.join(repo, PLAN_ROOT, "prog-p1.md");
    const read = new PlanSource(new RepoRoot(repo), new CountingFs([abs])).readFor(
      entryOf(repo, "prog-p1"),
    );
    expect(read.kind).toBe("unreadable");
    expect(read.failure()).toEqual({
      path: `${PLAN_ROOT}/prog-p1.md`,
      cause: "io",
      field: null,
      message: `cannot read file: ${PLAN_ROOT}/prog-p1.md`,
    });
  });

  it("reads a grammar break as unreadable/syntax with the field and the refusal message", () => {
    const repo = newRepo();
    seedPair(repo, DUPLICATE_SECTION_BODY);
    const read = new PlanSource(new RepoRoot(repo), new CountingFs()).readFor(
      entryOf(repo, "prog-p1"),
    );
    expect(read.kind).toBe("unreadable");
    const failure = read.failure();
    expect(failure?.cause).toBe("syntax");
    expect(failure?.path).toBe(`${PLAN_ROOT}/prog-p1.md`);
    expect(failure?.field).toBe("#### Files");
    expect(failure?.message.length).toBeGreaterThan(0);
    const refusal = read.refusal(WORDS);
    expect(refusal?.gate).toBe("doc-contract");
    expect(refusal?.reason).toBe("doc-contract");
    expect(refusal?.message).toContain(`${PLAN_ROOT}/prog-p1.md`);
    expect(refusal?.message).toContain("#### Files");
  });

  it("never reverse-looks-up on the derived face — a non `-design` spec file is healthy", () => {
    const repo = newRepo();
    writeDoc(repo, `${SPEC_ROOT}/phase-one.md`, specHead("prog-p1"));
    writeDoc(repo, `${PLAN_ROOT}/prog-p1.md`, planHead("prog-p1"));
    const index = SlugIndex.build(repo);
    const specEntry = index.identityDoc("prog-p1");
    expect(specEntry).not.toBeNull();
    const fs = new CountingFs();
    const read = new PlanSource(new RepoRoot(repo), fs).readFor(specEntry!);
    expect(read.kind).toBe("ready");
    expect(read.orphan()).toBeNull();
    // One existence probe (the plan path) and one read — zero spec probe.
    expect(fs.existsCalls).toEqual([path.join(repo, PLAN_ROOT, "prog-p1.md")]);
    expect(fs.reads).toEqual([path.join(repo, PLAN_ROOT, "prog-p1.md")]);
  });
});

describe("PlanSource.readPath — the argv face", () => {
  it("produces the same path and waves as the derived face", () => {
    const repo = newRepo();
    seedPair(repo);
    const source = new PlanSource(new RepoRoot(repo), new CountingFs());
    const derived = source.readFor(entryOf(repo, "prog-p1"));
    const argv = source.readPath(`${PLAN_ROOT}/prog-p1.md`);
    expect(argv.kind).toBe("ready");
    expect(argv.path()).toBe(derived.path());
    expect(argv.waves()).toEqual(derived.waves());
  });

  it("reads an absent path as unreadable/io — no existence probe, no undeclared", () => {
    const repo = newRepo();
    const fs = new CountingFs();
    const read = new PlanSource(new RepoRoot(repo), fs).readPath(`${PLAN_ROOT}/ghost.md`);
    expect(read.kind).toBe("unreadable");
    expect(read.failure()?.cause).toBe("io");
    expect(read.path()).toBe(`${PLAN_ROOT}/ghost.md`);
    expect(fs.existsCalls).toEqual([]);
    expect(fs.reads).toEqual([path.join(repo, PLAN_ROOT, "ghost.md")]);
  });
});

describe("PlanRead — the accessor value tables", () => {
  /** Build the five fixture reads the tables below are assembled from. */
  const fixture = () => {
    const repo = newRepo();
    seedPair(repo);
    writeDoc(repo, `${PLAN_ROOT}/prog-p2.md`, planHead("prog-p2"));
    writeDoc(repo, `${SPEC_ROOT}/prog-p2-design.md`, specHead("prog-p2"));
    writeDoc(repo, `${PLAN_ROOT}/orphan.md`, planHead("prog-p3"), TWO_TASK_BODY);
    writeDoc(
      repo,
      `${PLAN_ROOT}/slugless.md`,
      { title: "No slug", "doc-type": "plan" },
      TWO_TASK_BODY,
    );
    writeDoc(repo, `${PLAN_ROOT}/illegal.md`, planHead("Foo Bar"), TWO_TASK_BODY);
    writeDoc(repo, `${PLAN_ROOT}/broken.md`, planHead("prog-p5"), DUPLICATE_SECTION_BODY);
    const abs = path.join(repo, PLAN_ROOT, "prog-p1.md");
    const unreadableFs = new CountingFs([abs]);
    return {
      ready: new PlanSource(new RepoRoot(repo), new CountingFs()).readFor(entryOf(repo, "prog-p1")),
      empty: new PlanSource(new RepoRoot(repo), new CountingFs()).readFor(entryOf(repo, "prog-p2")),
      io: new PlanSource(new RepoRoot(repo), unreadableFs).readFor(entryOf(repo, "prog-p1")),
      syntax: new PlanSource(new RepoRoot(repo), new CountingFs()).readPath(
        `${PLAN_ROOT}/broken.md`,
      ),
      undeclared: new PlanSource(new RepoRoot(repo), new CountingFs()).readFor({
        ...entryOf(repo, "prog-p1"),
        slug: null,
      }),
      orphan: new PlanSource(new RepoRoot(repo), new CountingFs()).readPath(
        `${PLAN_ROOT}/orphan.md`,
      ),
      slugless: new PlanSource(new RepoRoot(repo), new CountingFs()).readPath(
        `${PLAN_ROOT}/slugless.md`,
      ),
      illegal: new PlanSource(new RepoRoot(repo), new CountingFs()).readPath(
        `${PLAN_ROOT}/illegal.md`,
      ),
      source: new PlanSource(new RepoRoot(repo), new CountingFs()),
      repo,
    };
  };

  it("failure() answers only the unreadable state — null for every other read", () => {
    const { ready, empty, undeclared, orphan, slugless } = fixture();
    for (const read of [ready, empty, undeclared, orphan, slugless]) {
      expect(read.failure()).toBeNull();
    }
  });

  it("text / doc / graph are null for every non-ready state", () => {
    const { ready, empty, io, syntax, undeclared } = fixture();
    expect(ready.text()).not.toBeNull();
    expect(ready.doc()).not.toBeNull();
    expect(ready.graph()).not.toBeNull();
    expect(empty.doc()).not.toBeNull();
    expect(empty.graph()).not.toBeNull();
    for (const read of [io, syntax, undeclared]) {
      expect(read.text()).toBeNull();
      expect(read.doc()).toBeNull();
      expect(read.graph()).toBeNull();
    }
  });

  it("waves() is the graph's own derivation, empty for every non-ready state", () => {
    const { ready, empty, io, syntax, undeclared } = fixture();
    expect(ready.waves()).toEqual([[1], [2]]);
    expect(empty.waves()).toEqual([]);
    for (const read of [io, syntax, undeclared]) expect(read.waves()).toEqual([]);
  });

  it("orphan() is a readPath fact only — spec-absent, slug-absent, illegal and healthy", () => {
    const { ready, orphan, slugless, illegal, io } = fixture();
    expect(ready.orphan()).toBeNull();
    expect(orphan.orphan()).toEqual({
      cause: "spec-absent",
      specPath: `${SPEC_ROOT}/prog-p3-design.md`,
    });
    expect(slugless.orphan()).toEqual({ cause: "slug-absent", specPath: null });
    expect(illegal.orphan()).toBeNull();
    expect(io.orphan()).toBeNull();
  });

  it("degradedWaveRow / cell render the four semantics plus the orphan fold", () => {
    const { ready, empty, io, syntax, undeclared, orphan, slugless, repo, source } = fixture();
    // undeclared: (none) on the doc face, the empty program cell.
    expect(undeclared.degradedWaveRow(WORDS)).toBe("(none)");
    expect(undeclared.cell(WORDS)).toBe("<cell>");
    // ready with zero task blocks: the healthy-but-empty word on both faces.
    expect(empty.degradedWaveRow(WORDS)).toBe("(empty!)");
    expect(empty.cell(WORDS)).toBe("(empty!)");
    // the two unreadable causes, one mark each.
    expect(io.degradedWaveRow(WORDS)).toBe("!w-io");
    expect(io.cell(WORDS)).toBe("!w-io");
    expect(syntax.degradedWaveRow(WORDS)).toBe("!w-syntax");
    expect(syntax.cell(WORDS)).toBe("!w-syntax");
    // healthy ready with waves: null (the assembler owns the healthy bytes).
    expect(ready.degradedWaveRow(WORDS)).toBeNull();
    expect(ready.cell(WORDS)).toBeNull();
    // spec-absent orphan folds BEFORE (empty plan) — both faces, including an empty plan.
    expect(orphan.degradedWaveRow(WORDS)).toBe("!orphan!");
    expect(orphan.cell(WORDS)).toBe("!orphan!");
    writeDoc(repo, `${PLAN_ROOT}/orphan-empty.md`, planHead("prog-p4"), "## Constraints\n");
    const orphanEmpty = source.readPath(`${PLAN_ROOT}/orphan-empty.md`);
    expect(orphanEmpty.degradedWaveRow(WORDS)).toBe("!orphan!");
    expect(orphanEmpty.cell(WORDS)).toBe("!orphan!");
    // slug-absent: null on both — the identity channel speaks, not this value.
    expect(slugless.degradedWaveRow(WORDS)).toBeNull();
    expect(slugless.cell(WORDS)).toBeNull();
  });

  it("planLine / specLine carry the cell content the assembler pads", () => {
    const { ready, io, syntax, undeclared, orphan, slugless, empty } = fixture();
    expect(ready.planLine(WORDS)).toBe(`${PLAN_ROOT}/prog-p1.md`);
    expect(empty.planLine(WORDS)).toBe(`${PLAN_ROOT}/prog-p2.md`);
    expect(io.planLine(WORDS)).toBe(`${PLAN_ROOT}/prog-p1.md · !w-io`);
    expect(syntax.planLine(WORDS)).toBe(`${PLAN_ROOT}/broken.md · !w-syntax`);
    expect(undeclared.planLine(WORDS)).toBeNull();
    expect(orphan.planLine(WORDS)).toBe(`${PLAN_ROOT}/orphan.md · !orphan!`);
    expect(slugless.planLine(WORDS)).toBeNull();
    // specLine speaks only for the spec-absent orphan.
    expect(orphan.specLine(WORDS)).toBe("!orphan!");
    for (const read of [ready, empty, io, syntax, undeclared, slugless]) {
      expect(read.specLine(WORDS)).toBeNull();
    }
  });

  it("warnLine and refusal share one message source and differ only on the fold", () => {
    const { ready, empty, io, syntax, undeclared, orphan, slugless } = fixture();
    expect(undeclared.warnLine(WORDS)).toBeNull();
    expect(ready.warnLine(WORDS)).toBeNull();
    expect(empty.warnLine(WORDS)).toBeNull();
    expect(io.warnLine(WORDS)).toBe(`WARN: !w-io ${PLAN_ROOT}/prog-p1.md`);
    expect(syntax.warnLine(WORDS)).toBe(`WARN: !w-syntax ${PLAN_ROOT}/broken.md: #### Files`);
    expect(orphan.warnLine(WORDS)).toBe(`WARN: orphan prog-p3 -> ${SPEC_ROOT}/prog-p3-design.md`);
    expect(slugless.warnLine(WORDS)).toBe("WARN: slug missing");
    // refusal: the two unreadable causes and the spec-absent orphan only.
    expect(io.refusal(WORDS)?.message).toBe(`!w-io ${PLAN_ROOT}/prog-p1.md`);
    expect(syntax.refusal(WORDS)?.message).toBe(`!w-syntax ${PLAN_ROOT}/broken.md: #### Files`);
    expect(orphan.refusal(WORDS)?.message).toBe(`orphan prog-p3 -> ${SPEC_ROOT}/prog-p3-design.md`);
    for (const read of [ready, empty, undeclared, slugless]) {
      expect(read.refusal(WORDS)).toBeNull();
    }
  });

  it("path() is the plan row's fact; stationPath() is the frontier's", () => {
    const { ready, io, syntax, undeclared, orphan } = fixture();
    expect(ready.path()).toBe(`${PLAN_ROOT}/prog-p1.md`);
    expect(io.path()).toBe(`${PLAN_ROOT}/prog-p1.md`);
    expect(syntax.path()).toBe(`${PLAN_ROOT}/broken.md`);
    expect(orphan.path()).toBe(`${PLAN_ROOT}/orphan.md`);
    expect(undeclared.path()).toBeNull();
    // The frontier path drops io and undeclared, keeps syntax and ready.
    expect(ready.stationPath()).toBe(`${PLAN_ROOT}/prog-p1.md`);
    expect(syntax.stationPath()).toBe(`${PLAN_ROOT}/broken.md`);
    expect(io.stationPath()).toBeNull();
    expect(undeclared.stationPath()).toBeNull();
  });
});

describe("PlanSource — the read contract", () => {
  it("parses exactly once per read and derives the graph eagerly from that parse", () => {
    const repo = newRepo();
    seedPair(repo);
    const spy = vi.spyOn(PlanDocType.prototype, "parse");
    const read = new PlanSource(new RepoRoot(repo), new CountingFs()).readPath(
      `${PLAN_ROOT}/prog-p1.md`,
    );
    expect(read.kind).toBe("ready");
    expect(spy).toHaveBeenCalledTimes(1);
    // The public graph/waves/doc reads never re-parse.
    read.waves();
    read.graph();
    read.doc();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("anchors every path on the injected root, never on process.cwd()", () => {
    const repo = newRepo();
    seedPair(repo, DUPLICATE_SECTION_BODY);
    const cwd = process.cwd();
    expect(path.relative(cwd, repo).startsWith("..")).toBe(true);
    const read = new PlanSource(new RepoRoot(repo), new CountingFs()).readPath(
      `${PLAN_ROOT}/prog-p1.md`,
    );
    expect(read.kind).toBe("unreadable");
    expect(read.failure()?.path).toBe(`${PLAN_ROOT}/prog-p1.md`);
    // A different (empty) root reads the same relative path as an io failure —
    // proof the read went through RepoRoot, not the process cwd.
    const other = newRepo();
    const elsewhere = new PlanSource(new RepoRoot(other), new CountingFs()).readPath(
      `${PLAN_ROOT}/prog-p1.md`,
    );
    expect(elsewhere.kind).toBe("unreadable");
    expect(elsewhere.failure()?.cause).toBe("io");
  });

  it("reverse-looks-up with an existence probe only — an unreadable spec is not an orphan", () => {
    const repo = newRepo();
    writeDoc(repo, `${PLAN_ROOT}/prog-p1.md`, planHead("prog-p1"), TWO_TASK_BODY);
    writeDoc(repo, `${SPEC_ROOT}/prog-p1-design.md`, specHead("prog-p1"));
    const specAbs = path.join(repo, SPEC_ROOT, "prog-p1-design.md");
    const fs = new CountingFs([specAbs]);
    const read = new PlanSource(new RepoRoot(repo), fs).readPath(`${PLAN_ROOT}/prog-p1.md`);
    expect(read.kind).toBe("ready");
    expect(read.orphan()).toBeNull();
    expect(fs.existsCalls).toEqual([specAbs]);
    // The spec file is never read — the reverse lookup is a probe.
    expect(fs.reads).toEqual([path.join(repo, PLAN_ROOT, "prog-p1.md")]);
  });
});

describe("Words — the PlanReadWords port", () => {
  it("serves the seven rows from the one word table", () => {
    const words = new Words();
    expect(words.planReadWord("io")).toBe("! unreadable");
    expect(words.planReadWord("syntax")).toBe("! unparseable");
    expect(words.planEmptyWord()).toBe("(empty plan)");
    expect(words.planOrphanWord()).toBe("! no-spec");
    expect(words.cellEmpty).toBe("");
    expect(words.warnPrefix).toBe(words.station("warn"));
    expect(words.planSlugMissing()).toContain("slug");
    const orphan = words.planOrphanSpec("prog-p1", "docs/kairos/specs/prog-p1-design.md");
    expect(orphan).toContain("prog-p1");
    expect(orphan).toContain("docs/kairos/specs/prog-p1-design.md");
  });

  it("feeds the value's own literals through the real table", () => {
    const repo = newRepo();
    seedPair(repo, DUPLICATE_SECTION_BODY);
    const words = new Words();
    const read = new PlanSource(new RepoRoot(repo), new CountingFs()).readPath(
      `${PLAN_ROOT}/prog-p1.md`,
    );
    expect(read.degradedWaveRow(words)).toBe("! unparseable");
    expect(read.planLine(words)).toBe(`${PLAN_ROOT}/prog-p1.md · ! unparseable`);
    expect(read.warnLine(words)?.startsWith(words.warnPrefix)).toBe(true);
  });
});
