// packages/cdd-engine/src-next/contract/__tests__/closed-document.test.ts
// The PROVEN-closure reading and its ONE construction point (design spec §1.4). Two
// faces, both pinned here:
//
//   · `ClosedDocument#closed`: a phase inventory's two NAMED cells (`Design spec` ·
//     `Implementation plan`) each close a document, and the naming file name must
//     resolve to EXACTLY one indexed document — zero hits and several hits prove
//     nothing. The polarity was the pin face's private `#closedBy` reversed (its dead
//     rows read CLOSED) — that face retired with the pin gate, and the pairs below keep
//     this reading positive-only. The document set comes from `SlugIndex` (the command
//     preamble's ONE identity scan), never from a second tree walk;
//   · the composition root's closure accessor: ONE reader per dispatch, asked by the
//     pre-flight closure port (the value `Contract.validate` receives) and — on a doc
//     fix round — by the lifecycle's own doc gate, and never constructed on a dispatch
//     that asks neither. The counting arms drive the real CLI — the accessor is not
//     injectable, and a hand-composed seam would prove only that the test can memoize.
//
// A lifecycle built WITHOUT the accessor owes no edit: its doc gate constructs the
// reader over the rule plane's default index read, and the last arm pins that this
// fallback expression answers the same closure as the injected one.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { Cli } from "../../face/cli.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../../face/termination.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { RepoRoot } from "../../infra/root.ts";
import { SlugIndex } from "../../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../../session/ledger.ts";
import { ArtifactRegistry } from "../../session/round-artifacts.ts";
import { ClosedDocument } from "../closed-document.ts";
import { identityIndexOf } from "../invariants.ts";

/** The closure observations the mocked reader records — constructions and the one ask
 *  point (`closed` is the reading the shape gate's `Contract.validate` receives). */
const closureLog = vi.hoisted(() => ({
  builds: 0,
  closed: [] as string[],
}));

vi.mock("../closed-document.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../closed-document.ts")>();
  class RecordingClosedDocument extends actual.ClosedDocument {
    constructor(index: ConstructorParameters<typeof actual.ClosedDocument>[0]) {
      super(index);
      closureLog.builds += 1;
    }
    override closed(rel: string): boolean {
      closureLog.closed.push(rel);
      return super.closed(rel);
    }
  }
  return { ...actual, ClosedDocument: RecordingClosedDocument };
});

/** One scratch repo — every fixture directory is removed after the file's cases. */
const scratchDirs: string[] = [];

/** The scratch root writer. */
const write = (root: string, rel: string, text: string): void => {
  const at = path.join(root, rel);
  mkdirSync(path.dirname(at), { recursive: true });
  writeFileSync(at, text, "utf8");
};

/** One document's front matter over the identity facts the closure read needs. */
const front = (docType: string, slug: string): string =>
  ["---", `doc-type: ${docType}`, `slug: ${slug}`, "version: v0.1", "---", ""].join("\n");

/** A `✔ Done` cell naming one file (the full-width parentheses the grammar reads). */
const doneCell = (file: string): string => `✔ Done（\`${file}\` · 2026-11-20）`;

/** A charter whose Phase-inventory row carries both NAMED cells. */
const charterOf = (designCell: string, planCell: string): string =>
  [
    front("overall", "prog"),
    "## Phase inventory",
    "",
    "| Phase | Scope | Design spec | Implementation plan | Dependency |",
    "| --- | --- | --- | --- | --- |",
    `| P1 | scope | ${designCell} | ${planCell} | none |`,
    "",
  ].join("\n");

/** A phase spec and its plan — the two faces of one closure registration. */
const SPEC_REL = "docs/kairos/specs/x-design.md";
const PLAN_REL = "docs/kairos/plans/x.md";

/** One hermetic repo with a phase spec and its plan, plus the given charter. */
const closureFixture = (charter: string | null, planSlug = "x"): string => {
  const root = mkdtempSync(path.join(tmpdir(), "closure-"));
  scratchDirs.push(root);
  write(root, SPEC_REL, front("phase-spec", "x"));
  write(root, PLAN_REL, front("plan", planSlug));
  if (charter !== null) write(root, "docs/kairos/overalls/x-overall.md", charter);
  return root;
};

/** One reader over a fixture's own identity scan — the same construction the command
 *  preamble makes. */
const readerOf = (root: string): ClosedDocument => new ClosedDocument(SlugIndex.build(root));

describe("P41 T5 — `closed` reads the two named cells and demands exactly one hit", () => {
  it("closes through EITHER named cell — the design cell alone, the plan cell alone", () => {
    // The design cell names the spec; the plan cell stays pending.
    const designOnly = readerOf(closureFixture(charterOf(doneCell("x-design.md"), "[Pending]")));
    expect(designOnly.closed(SPEC_REL)).toBe(true);
    expect(designOnly.closed(PLAN_REL)).toBe(false);

    // The plan cell names the plan; the design cell stays pending — the opposite face of
    // the same registration, so a reading that only watched one cell would go red here.
    const planOnly = readerOf(closureFixture(charterOf("[Pending]", doneCell("x.md"))));
    expect(planOnly.closed(PLAN_REL)).toBe(true);
    expect(planOnly.closed(SPEC_REL)).toBe(false);
  });

  it("closes both faces at once when both cells name their file", () => {
    const both = readerOf(closureFixture(charterOf(doneCell("x-design.md"), doneCell("x.md"))));
    expect(both.closed(SPEC_REL)).toBe(true);
    expect(both.closed(PLAN_REL)).toBe(true);
  });

  it("normalizes the judged path through the rule plane's ONE spelling — `./` and a trailing slash still close", () => {
    const root = closureFixture(charterOf(doneCell("x-design.md"), "[Pending]"));
    const reader = readerOf(root);
    // The judged path carries prose the indexed entries never do: a leading `./` and a
    // trailing slash are writing, not coordinates. A second normalizer inside the
    // closure chain would be a second home for that rule, so the same document written
    // three ways has to answer the same reading.
    expect(reader.closed(`./${SPEC_REL}`)).toBe(true);
    expect(reader.closed(`${SPEC_REL}/`)).toBe(true);
    expect(reader.closed(`./${SPEC_REL}/`)).toBe(true);
  });

  it("proves nothing on zero hits or several hits", () => {
    // Zero: the cell names a document the tree does not hold.
    const ghost = readerOf(closureFixture(charterOf(doneCell("ghost-design.md"), "[Pending]")));
    expect(ghost.closed(SPEC_REL)).toBe(false);

    // Several: two indexed documents share the base name, so the registration no longer
    // identifies one document — the shape gate never inherits the retired face's tolerance.
    const severalRoot = closureFixture(charterOf(doneCell("x-design.md"), "[Pending]"));
    write(severalRoot, "docs/kairos/plans/x-design.md", front("plan", "y"));
    const several = readerOf(severalRoot);
    expect(several.closed(SPEC_REL)).toBe(false);
    expect(several.closed("docs/kairos/plans/x-design.md")).toBe(false);
  });

  it("answers the same closure through the fallback index read — the un-injected construction", () => {
    const root = closureFixture(charterOf(doneCell("x-design.md"), "[Pending]"));
    // The lifecycle's fallback builds exactly this: the rule plane's default index read,
    // no `JudgeContext` and no second `SlugIndex.build` literal of its own.
    const fallback = new ClosedDocument(identityIndexOf(root));
    expect(fallback.closed(SPEC_REL)).toBe(true);
    // the pair: the same reader says the same thing about the unregistered face
    expect(fallback.closed(PLAN_REL)).toBe(false);
  });
});

afterEach(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
  scratchDirs.length = 0;
});

// ---------------------------------------------------------------------------
// the ONE closure reading per dispatch — the composition root's accessor, driven by
// the real CLI
// ---------------------------------------------------------------------------

/** The captured io of a CLI fixture. */
class CaptureIo {
  stdoutText = "";
  stderrText = "";
  stdout(text: string): void {
    this.stdoutText += text;
  }
  stderr(text: string): void {
    this.stderrText += text;
  }
}

/** The test-evidence file an implement round must land (the work plane's completion
 *  criterion reads it) — the minimal schema-passing record. */
const EVIDENCE = {
  command: "true",
  exit_code: 0,
  passed: true,
  warnings_count: 0,
  typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
};

/** A child stand-in that writes the round's draft at the prompt's own `OUTPUT_HANDOFF`
 *  cell and exits clean — the read-back therefore judges a REAL draft. The prompt's
 *  `ROLE` cell picks the face: a work round also lands its evidence file and one commit
 *  (the implement completion criterion reads both), a judge round writes findings. */
class DraftRunner implements ChildRunner {
  readonly calls: ChildRun[] = [];

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    const prompt = run.args.at(-1) ?? "";
    const handoff = /^- `OUTPUT_HANDOFF`: (.+)$/m.exec(prompt)?.[1];
    const evidence = /^- `OUTPUT_EVIDENCE`: (.+)$/m.exec(prompt)?.[1];
    const work = /^- `ROLE`: implement$/m.test(prompt);
    const draft = work ? implementDraft() : reviewDraft();
    if (handoff !== undefined) this.#write(handoff, draft);
    if (!work) return { code: 0, stdout: "", stderr: "", termination: null };
    if (evidence !== undefined) this.#write(evidence, EVIDENCE);
    // The implement criterion's other half: the round committed something since its
    // baseline. The fixture's ignored prefixes keep this commit out of the gates' faces.
    writeFileSync(path.join(process.cwd(), "work.txt"), "work\n", "utf8");
    for (const args of [
      ["add", "-A"],
      ["commit", "-q", "-m", "round work"],
    ]) {
      spawnSync("git", args, { cwd: process.cwd() });
    }
    return { code: 0, stdout: "", stderr: "", termination: null };
  }

  /** Write one prompt-declared artifact (the value is repo-relative already). */
  #write(rel: string, value: unknown): void {
    const at = path.join(process.cwd(), rel.trim());
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(at, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}

/** Record the DOC preamble rounds (the phase-spec and plan reviews production always
 *  has) — the pipeline frontier then announces the wave face, not the doc face. */
const seedDocRounds = (repo: string): void => {
  const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "p3").ensure();
  const ledger = new Ledger(
    workspace,
    new ConfigLoader(),
    planSourceOf(new RepoRoot(repo)),
    new ArtifactRegistry(),
  );
  for (const type of ["phase-spec", "plan"]) {
    ledger.persistHandoff("review", type, { round: 1 }, { findings: [] });
    ledger.recordRound(type, { op: "review" });
  }
};

/** A hermetic git repo + the CLI over it (the fixture chdirs: the engine resolves the
 *  repo root from the working directory). */
const cliFixture = (
  runner: ChildRunner,
): { repo: string; command: Cli; io: CaptureIo; cleanup: () => void } => {
  const origin = process.cwd();
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "closure-cli-")));
  process.chdir(repo);
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "closure@test"],
    ["config", "user.name", "closure-test"],
  ]) {
    spawnSync("git", args, { cwd: repo });
  }
  writeFileSync(path.join(repo, ".gitignore"), ".kairos\n/docs/\n", "utf8");
  writeFileSync(path.join(repo, "seed.txt"), "seed\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repo });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repo });
  const io = new CaptureIo();
  return {
    io,
    repo,
    command: Cli.create({ io: io, sync: runner }),
    cleanup: () => {
      process.chdir(origin);
      rmSync(repo, { recursive: true, force: true });
    },
  };
};

/** The wave-line plan — one task, no dependencies (the wave gate's ready plan). */
const planOf = (): string =>
  [
    "---",
    "title: Closure Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-11-20",
    "slug: p3",
    "base: develop",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    "### Task 1: the one task",
    "- **Objective**: objective",
    "- **Files**: a.ts",
    "- **Consumes**: x",
    "- **Produces**: y",
    "- **Steps**:",
    "  - step — checkable: yes",
    "- **Acceptance**: ok",
    "- **DependsOn**: none",
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v1.0 | 2026-11-20 | init | [human] |",
  ].join("\n");

/** A contract-clean phase spec — the doc face's own subject. */
const specOf = (): string =>
  [
    "---",
    "title: Closure Spec",
    "doc-type: phase-spec",
    "version: v1.0",
    "date: 2026-11-20",
    "slug: s1",
    "program: x-overall",
    "status: Draft",
    "author: x",
    "---",
    "",
    "## Design",
    "",
    "Design intro — the double-layer skeleton semantics.",
    "",
    "### 1. Data plane",
    "#### 1.1 Registry",
    "- text",
    "",
    "### Acceptance criteria",
    "",
    "- `c`",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v1.0 | 2026-11-20 | init | [human] |",
  ].join("\n");

/** A review draft whose one WARN finding carries the optional repair anchor
 *  (`contract.path` · `anchor`) — a non-blocking, schema-valid judge carrier, so the
 *  review read-backs below judge a REAL draft. */
const reviewDraft = (): Record<string, unknown> => ({
  findings: [
    {
      severity: "warn",
      lens: "standards",
      summary: "the fixture's own finding",
      contract: { path: "packages/cdd-engine/src-next/face/cli.ts", anchor: "Cli" },
    },
  ],
});

/** The implement draft — a work carrier's declared status. */
const implementDraft = (): Record<string, unknown> => ({ status: "APPROVED", artifacts: {} });

describe("P41 T5 — one closure reading per dispatch, asked by the shape gate", () => {
  it("constructs no reader on a wave implement dispatch (work plane)", async () => {
    const runner = new DraftRunner();
    const fixture = cliFixture(runner);
    process.env.CLAUDE_CODE_SESSION_ID = "closure-fixture";
    try {
      const plan = path.join(fixture.repo, "docs", "kairos", "plans", "p3.md");
      write(fixture.repo, "docs/kairos/plans/p3.md", planOf());
      write(fixture.repo, "docs/kairos/specs/p3-design.md", front("phase-spec", "p3"));
      write(fixture.repo, "docs/kairos/specs/p3-overall.md", front("overall", "p3-overall"));
      const before = closureLog.builds;
      const closedBefore = closureLog.closed.length;
      expect(await fixture.command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      // A work-plane round has no doc target: the closure port is never asked, so no
      // doc scan is paid.
      expect(closureLog.builds - before).toBe(0);
      expect(closureLog.closed.length - closedBefore).toBe(0);
    } finally {
      delete process.env.CLAUDE_CODE_SESSION_ID;
      fixture.cleanup();
    }
  });

  it("constructs exactly ONE reader on a review dispatch, and that reading IS the contract argument", async () => {
    const runner = new DraftRunner();
    const fixture = cliFixture(runner);
    process.env.CLAUDE_CODE_SESSION_ID = "closure-fixture";
    try {
      const spec = path.join(fixture.repo, "docs", "kairos", "specs", "s1-design.md");
      write(fixture.repo, "docs/kairos/specs/s1-design.md", specOf());
      // The spec's declared parent charter — a registered overall, so closure is
      // UNPROVEN here (not unprovable): the port is asked and answers false.
      write(fixture.repo, "docs/kairos/specs/x-overall.md", front("overall", "x-overall"));
      const buildsBefore = closureLog.builds;
      const closedBefore = closureLog.closed.length;
      expect(
        await fixture.command.runArgv(["review", "--type", "phase-spec", "--spec", spec]),
      ).toBe(0);
      // ONE construction, ONE reading — the value the shape gate handed `Contract.validate`
      // is the one this reader answered, on the judged document itself.
      expect(closureLog.builds - buildsBefore).toBe(1);
      expect(closureLog.closed.length - closedBefore).toBe(1);
      expect(closureLog.closed.at(-1)).toBe("docs/kairos/specs/s1-design.md");
    } finally {
      delete process.env.CLAUDE_CODE_SESSION_ID;
      fixture.cleanup();
    }
  });

  it("never asks the closure port on a wave review dispatch", async () => {
    const runner = new DraftRunner();
    const fixture = cliFixture(runner);
    process.env.CLAUDE_CODE_SESSION_ID = "closure-fixture";
    try {
      const plan = path.join(fixture.repo, "docs", "kairos", "plans", "p3.md");
      write(fixture.repo, "docs/kairos/plans/p3.md", planOf());
      write(fixture.repo, "docs/kairos/specs/p3-design.md", front("phase-spec", "p3"));
      write(fixture.repo, "docs/kairos/specs/p3-overall.md", front("overall", "p3-overall"));
      seedDocRounds(fixture.repo);
      expect(
        await fixture.command.runArgv([
          "base",
          "set",
          "--plan",
          plan,
          "--base",
          "develop",
          "--source",
          "plan-field",
        ]),
      ).toBe(0);
      expect(await fixture.command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      const buildsBefore = closureLog.builds;
      const closedBefore = closureLog.closed.length;
      expect(
        await fixture.command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
      ).toBe(0);
      // The wave face has no doc target, so neither the pre-flight closure port nor the
      // lifecycle's doc gate asks: the reader is never constructed.
      expect(closureLog.builds - buildsBefore).toBe(0);
      expect(closureLog.closed.length - closedBefore).toBe(0);
    } finally {
      delete process.env.CLAUDE_CODE_SESSION_ID;
      fixture.cleanup();
    }
  });
});
