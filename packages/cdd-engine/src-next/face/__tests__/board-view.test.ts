// packages/cdd-engine/src-next/face/__tests__/board-view.test.ts
// The board face's colocated pins (T2 slice): the slug → node-tree infrastructure
//   · Workspace.docsOfSlug — the reverse derivation over a hermetic tmp repo
//     (program slug → overall path · phase slug → spec/plan paths · deep-phase
//     suffix parse);
//   · BoardView.scanPhases — the phase-suffix set from the specs dir, sorted by the
//     dot-separated numeric path, with NO on-disk-absent parent synthesized;
//   · the artifact header read — `{version, status, docType}` from the doc's
//     header block, the doc type read from the `- **Doc type**:` declaration line
//     (spec §12 · D34 — null when absent, zero filename-suffix inference).
// Fixtures are hermetic tmp dirs (no git needed — pure file-system reads).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Workspace } from "../../infra/workspace.ts";
import { BoardView } from "../board-view.ts";

describe("Workspace.docsOfSlug — the slug → doc-tree reverse derivation", () => {
  let repo: string;
  let prevCwd: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-view-"));
    prevCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(prevCwd);
    rmSync(repo, { recursive: true, force: true });
  });

  it("a phase slug derives the overall + spec + plan paths from what exists on disk", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-overall.md"), "# P\n");
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p7-design.md"), "# S\n");
    writeFileSync(path.join(repo, "docs/kairos/plans/prog-p7.md"), "# Plan\n");

    const docs = Workspace.docsOfSlug("prog-p7", repo);

    expect(docs.phaseSuffix).toBe("-p7");
    expect(docs.overall).toBe(path.join(repo, "docs/kairos/specs/prog-overall.md"));
    expect(docs.spec).toBe(path.join(repo, "docs/kairos/specs/prog-p7-design.md"));
    expect(docs.plan).toBe(path.join(repo, "docs/kairos/plans/prog-p7.md"));
  });

  it("a phase slug with the overall absent carries null — nothing synthesized", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p7-design.md"), "# S\n");

    const docs = Workspace.docsOfSlug("prog-p7", repo);

    expect(docs.overall).toBeNull();
    expect(docs.spec).not.toBeNull();
    expect(docs.plan).toBeNull();
  });

  it("a deep-phase suffix parses whole and anchors the nearest existing overall", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p7-overall.md"), "# O\n");

    const docs = Workspace.docsOfSlug("prog-p7.1", repo);

    expect(docs.phaseSuffix).toBe("-p7.1");
    expect(docs.overall).toBe(path.join(repo, "docs/kairos/specs/prog-p7-overall.md"));
    expect(docs.spec).toBeNull();
  });

  it("a deep-phase suffix falls through to the program overall when no sub-overall exists", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-overall.md"), "# O\n");

    const docs = Workspace.docsOfSlug("prog-p3.2.1", repo);

    expect(docs.phaseSuffix).toBe("-p3.2.1");
    expect(docs.overall).toBe(path.join(repo, "docs/kairos/specs/prog-overall.md"));
  });

  it("a deepest suffix parses whole (`-p3.2.1`)", () => {
    const docs = Workspace.docsOfSlug("prog-p3.2.1", repo);
    expect(docs.phaseSuffix).toBe("-p3.2.1");
  });

  it("a program slug (no phase suffix) derives only the overall", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-overall.md"), "# O\n");

    const docs = Workspace.docsOfSlug("prog", repo);

    expect(docs.phaseSuffix).toBeNull();
    expect(docs.overall).toBe(path.join(repo, "docs/kairos/specs/prog-overall.md"));
    expect(docs.spec).toBeNull();
    expect(docs.plan).toBeNull();
  });
});

describe("BoardView.scanPhases — the phase-suffix scan (no absent parent synthesized)", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-view-scan-"));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("only the on-disk suffixes return — a lone `-p4.1` mounts without `-p4`", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, "docs/kairos/specs/prog-p4.1-design.md"), "# S\n");

    expect(BoardView.scanPhases("prog", repo)).toEqual(["-p4.1"]);
  });

  it("suffixes sort by the dot-separated numeric path (2 before 10, p4 before p4.1)", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    for (const name of ["prog-p10", "prog-p2", "prog-p4", "prog-p4.1"])
      writeFileSync(path.join(repo, "docs/kairos/specs", `${name}-design.md`), "# S\n");

    expect(BoardView.scanPhases("prog", repo)).toEqual(["-p2", "-p4", "-p4.1", "-p10"]);
  });

  it("an absent specs dir scans empty (a bare repo is a valid board input)", () => {
    expect(BoardView.scanPhases("prog", repo)).toEqual([]);
  });
});

describe("BoardView.readHeader — the artifact header `{version, status, docType}` read", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "board-view-head-"));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("reads the Version/Status/Doc type markers from a plan doc's header block", () => {
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    const planPath = path.join(repo, "docs/kairos/plans/prog-p8.md");
    writeFileSync(
      planPath,
      [
        "# The plan",
        "",
        "- **Version**: v0.9 · …",
        "- **Status**: Done",
        "- **Doc type**: plan",
        "",
        "## Constraints",
        "",
      ].join("\n"),
    );

    expect(BoardView.readHeader(planPath)).toEqual({
      version: "v0.9",
      status: "Done",
      docType: "plan",
    });
  });

  it("reads the declared docType from a phase-spec's `- **Doc type**:` declaration line", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    const specPath = path.join(repo, "docs/kairos/specs/prog-p8-design.md");
    writeFileSync(
      specPath,
      [
        "# The phase spec",
        "",
        "- **Version**: v1.2 · 2026-10-15",
        "- **Status**: In review",
        "- **Doc type**: phase-spec",
        "",
        "## 1. The design group",
        "",
      ].join("\n"),
    );

    expect(BoardView.readHeader(specPath)).toEqual({
      version: "v1.2",
      status: "In review",
      docType: "phase-spec",
    });
    expect(BoardView.readDocType(specPath)).toBe("phase-spec");
  });

  it("a doc without a Doc type declaration reads docType null — the consumer blocks, no suffix fallback", () => {
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    const specPath = path.join(repo, "docs/kairos/specs/prog-p8-design.md");
    writeFileSync(
      specPath,
      ["# The phase spec", "", "- **Version**: v1.0", "- **Status**: Draft", ""].join("\n"),
    );

    expect(BoardView.readHeader(specPath)).toEqual({
      version: "v1.0",
      status: "Draft",
      docType: null,
    });
    expect(BoardView.readDocType(specPath)).toBeNull();
  });

  it("an out-of-domain Doc type value reads null — present facts, never a fabricated type", () => {
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    const planPath = path.join(repo, "docs/kairos/plans/prog-p8.md");
    writeFileSync(planPath, ["# The plan", "", "- **Doc type**: memo", ""].join("\n"));

    expect(BoardView.readDocType(planPath)).toBeNull();
  });

  it("an absent doc yields nulls — never a fabricated value", () => {
    expect(BoardView.readHeader(path.join(repo, "docs/kairos/plans/ghost-p8.md"))).toEqual({
      version: null,
      status: null,
      docType: null,
    });
  });

  it("a doc whose first line is not the `# Title` still reads its metadata block", () => {
    mkdirSync(path.join(repo, "docs/kairos/plans"), { recursive: true });
    const planPath = path.join(repo, "docs/kairos/plans/prog-p8.md");
    writeFileSync(
      planPath,
      [
        "- **Version**: v0.9 · …",
        "- **Status**: Done",
        "- **Doc type**: plan",
        "",
        "## Constraints",
        "",
      ].join("\n"),
    );

    expect(BoardView.readHeader(planPath)).toEqual({
      version: "v0.9",
      status: "Done",
      docType: "plan",
    });
  });
});
