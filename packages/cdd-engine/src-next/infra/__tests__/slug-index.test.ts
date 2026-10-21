// packages/cdd-engine/src-next/infra/__tests__/slug-index.test.ts
// T2 — the identity index pins (spec §2.1/§2.2): one scan over the doc roots
// groups every document by its front-matter `slug:` and derives the identity
// lookups the board and the dispatch pre-flight share. The suites pin:
//   · the lookup surface (identityDoc / planOf / phaseSpecsOf / overallOf / entryAt);
//   · the five violation kinds (duplicate-identity / duplicate-plan / missing-slug /
//     invalid-slug / missing-program-target) plus the legal spec-plan pair;
//   · the four-way identity gate the pre-flight and the dispatch carrier share
//     (missing / illegal / duplicated) plus the doc-root membership probe;
//   · the filename-independence boundaries — a `slug:` value wins over the file
//     name, and a document's directory never decides its identity class.

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeFs } from "../../contract/invariants.ts";
import { SlugIndex } from "../slug-index.ts";

const repos: string[] = [];

/** A fresh temp repo — the doc roots are created lazily by the writer below. */
const newRepo = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "slug-index-"));
  repos.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Write one front-matter document at its repo-relative path. */
const writeDoc = (repo: string, rel: string, fields: Readonly<Record<string, string>>): void => {
  const abs = path.join(repo, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  const head = ["---", ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`), "---"];
  writeFileSync(abs, `${head.join("\n")}\n## Body\n`, "utf8");
};

const SPECS = "docs/kairos/specs";
const PLANS = "docs/kairos/plans";
const OVERALLS = "docs/kairos/overalls";
const PROGRAM = "prog";

/** The program fixture: one overall + two phase-specs + one paired plan. */
const seedProgram = (repo: string): void => {
  writeDoc(repo, `${SPECS}/prog-overall.md`, {
    title: "Program",
    "doc-type": "overall",
    version: "v1.0",
    status: "Draft",
    slug: PROGRAM,
  });
  writeDoc(repo, `${SPECS}/prog-p1-design.md`, {
    title: "Phase one",
    "doc-type": "phase-spec",
    version: "v0.1",
    status: "Draft",
    slug: "prog-p1",
    program: PROGRAM,
  });
  writeDoc(repo, `${SPECS}/prog-p2-design.md`, {
    title: "Phase two",
    "doc-type": "phase-spec",
    version: "v0.2",
    status: "Approved",
    slug: "prog-p2",
    program: PROGRAM,
  });
  writeDoc(repo, `${PLANS}/prog-p1.md`, {
    title: "Phase one plan",
    "doc-type": "plan",
    version: "v0.3",
    status: "Draft",
    slug: "prog-p1",
  });
};

describe("SlugIndex — the lookup surface", () => {
  it("indexes every document and resolves identity, plan, phase and overall lookups", () => {
    const repo = newRepo();
    seedProgram(repo);
    const index = SlugIndex.build(repo);

    expect(index.entries).toHaveLength(4);
    expect(index.identityDoc("prog")?.rel).toBe(`${SPECS}/prog-overall.md`);
    expect(index.identityDoc("prog-p1")?.rel).toBe(`${SPECS}/prog-p1-design.md`);
    expect(index.planOf("prog-p1")?.rel).toBe(`${PLANS}/prog-p1.md`);
    expect(index.phaseSpecsOf(PROGRAM).map((entry) => entry.rel)).toEqual([
      `${SPECS}/prog-p1-design.md`,
      `${SPECS}/prog-p2-design.md`,
    ]);
    expect(index.overallOf(PROGRAM)?.rel).toBe(`${SPECS}/prog-overall.md`);
    expect(index.entryAt(`${PLANS}/prog-p1.md`)?.docType).toBe("plan");
    expect(index.entryAt(`${PLANS}/absent.md`)).toBeNull();
  });

  it("carries every front-matter fact on the entry, with an absolute path and a repo-relative rel", () => {
    const repo = newRepo();
    seedProgram(repo);
    const index = SlugIndex.build(repo);

    const entry = index.entryAt(`${SPECS}/prog-p2-design.md`);
    expect(entry).not.toBeNull();
    expect(entry?.title).toBe("Phase two");
    expect(entry?.docType).toBe("phase-spec");
    expect(entry?.slug).toBe("prog-p2");
    expect(entry?.program).toBe(PROGRAM);
    expect(entry?.version).toBe("v0.2");
    expect(entry?.status).toBe("Approved");
    expect(path.isAbsolute(entry?.path ?? "")).toBe(true);
    expect(entry?.path).toBe(path.join(repo, SPECS, "prog-p2-design.md"));
  });

  it("reads an out-of-domain doc-type as null and keeps the document indexed", () => {
    const repo = newRepo();
    writeDoc(repo, `${SPECS}/odd.md`, { title: "Odd", "doc-type": "memo", slug: "odd" });
    const index = SlugIndex.build(repo);
    expect(index.entryAt(`${SPECS}/odd.md`)?.docType).toBeNull();
    expect(index.identityDoc("odd")).toBeNull();
    expect(index.violations()).toEqual([]);
  });

  it("indexes only readable .md documents — a directory named `x.md` and a non-md file are not documents", () => {
    const repo = newRepo();
    seedProgram(repo);
    mkdirSync(path.join(repo, SPECS, "dir.md"), { recursive: true });
    writeFileSync(path.join(repo, SPECS, "notes.txt"), "not a document\n", "utf8");
    const index = SlugIndex.build(repo);
    expect(index.entries).toHaveLength(4);
    expect(index.entryAt(`${SPECS}/dir.md`)).toBeNull();
  });

  it("indexes an absent doc root as empty instead of throwing", () => {
    const repo = newRepo();
    expect(SlugIndex.build(repo).entries).toEqual([]);
    expect(SlugIndex.build(repo, new NodeFs()).entries).toEqual([]);
  });
});

describe("SlugIndex — the scan seam's two legs judge the same document set", () => {
  /** One doc root seeded with every entry shape the scan has to classify: a
   *  regular document, a symlink to it, a directory named `*.md`, a non-md file. */
  const seedEntryShapes = (repo: string): void => {
    seedProgram(repo);
    const real = path.join(repo, SPECS, "prog-overall.md");
    symlinkSync(real, path.join(repo, SPECS, "link.md"));
    mkdirSync(path.join(repo, SPECS, "dir.md"), { recursive: true });
    writeFileSync(path.join(repo, SPECS, "notes.txt"), "not a document\n", "utf8");
  };

  it("indexes the identical rel set through the node:fs leg and the injected leg", () => {
    const repo = newRepo();
    seedEntryShapes(repo);
    const nodeFsLeg = SlugIndex.build(repo).entries.map((entry) => entry.rel);
    const injected = SlugIndex.build(repo, new NodeFs()).entries.map((entry) => entry.rel);
    expect(injected).toEqual(nodeFsLeg);
  });

  it("rethrows a non-ENOENT scan failure through either leg — never a silently empty index", () => {
    const repo = newRepo();
    // A doc root that exists but is not a directory: the scan's shape failure.
    mkdirSync(path.join(repo, "docs/kairos"), { recursive: true });
    writeFileSync(path.join(repo, SPECS), "not a directory\n", "utf8");
    expect(() => SlugIndex.build(repo)).toThrow();
    expect(() => SlugIndex.build(repo, new NodeFs())).toThrow();
  });
});

describe("SlugIndex — the violation classes", () => {
  it("flags each of the five violation kinds", () => {
    const repo = newRepo();
    // the program target the phase-specs below legitimately point at.
    writeDoc(repo, `${SPECS}/prog-overall.md`, { "doc-type": "overall", slug: PROGRAM });
    // duplicate identity documents — one slug, two identity docs.
    writeDoc(repo, `${SPECS}/dup-a-design.md`, {
      "doc-type": "phase-spec",
      slug: "dup",
      program: PROGRAM,
    });
    writeDoc(repo, `${SPECS}/dup-b-design.md`, {
      "doc-type": "phase-spec",
      slug: "dup",
      program: PROGRAM,
    });
    // duplicate plans — one slug, two plan docs.
    writeDoc(repo, `${PLANS}/pair-a.md`, { "doc-type": "plan", slug: "pair" });
    writeDoc(repo, `${PLANS}/pair-b.md`, { "doc-type": "plan", slug: "pair" });
    // a document without `slug:`.
    writeDoc(repo, `${PLANS}/no-slug.md`, { title: "No slug", "doc-type": "plan" });
    // an illegal slug value.
    writeDoc(repo, `${SPECS}/bad-slug.md`, { "doc-type": "overall", slug: "../x" });
    // a phase-spec whose program target does not exist.
    writeDoc(repo, `${SPECS}/orphan-design.md`, {
      "doc-type": "phase-spec",
      slug: "orphan",
      program: "ghost",
    });

    const violations = SlugIndex.build(repo).violations();
    const kinds = violations.map((violation) => violation.kind);
    for (const kind of [
      "duplicate-identity",
      "duplicate-plan",
      "missing-slug",
      "invalid-slug",
      "missing-program-target",
    ] as const)
      expect(kinds).toContain(kind);

    const duplicateIdentity = violations.find((v) => v.kind === "duplicate-identity");
    expect(duplicateIdentity?.rel).toBe(`${SPECS}/dup-b-design.md`);
    expect(duplicateIdentity?.slug).toBe("dup");
    expect(violations.find((v) => v.kind === "duplicate-plan")?.rel).toBe(`${PLANS}/pair-b.md`);

    const missingSlug = violations.find((v) => v.kind === "missing-slug");
    expect(missingSlug?.rel).toBe(`${PLANS}/no-slug.md`);
    expect(missingSlug?.slug).toBeNull();

    const invalidSlug = violations.find((v) => v.kind === "invalid-slug");
    expect(invalidSlug?.rel).toBe(`${SPECS}/bad-slug.md`);
    expect(invalidSlug?.slug).toBe("../x");

    const missingTarget = violations.find((v) => v.kind === "missing-program-target");
    expect(missingTarget?.rel).toBe(`${SPECS}/orphan-design.md`);
    expect(missingTarget?.program).toBe("ghost");
  });

  it("accepts the legal identity-document + plan pair sharing one slug", () => {
    const repo = newRepo();
    seedProgram(repo);
    expect(SlugIndex.build(repo).violations()).toEqual([]);
  });

  it("does not group an invalid slug value as a duplicate", () => {
    const repo = newRepo();
    writeDoc(repo, `${SPECS}/bad-a.md`, { "doc-type": "overall", slug: "../x" });
    writeDoc(repo, `${SPECS}/bad-b.md`, { "doc-type": "overall", slug: "../x" });
    const kinds = SlugIndex.build(repo)
      .violations()
      .map((violation) => violation.kind);
    expect(kinds).toEqual(["invalid-slug", "invalid-slug"]);
  });

  it("reads the duplicate roles off the ONE judgment — per role, empty when unique", () => {
    const repo = newRepo();
    seedProgram(repo);
    writeDoc(repo, `${SPECS}/dup-b-design.md`, {
      "doc-type": "phase-spec",
      slug: "prog-p1",
      program: PROGRAM,
    });
    writeDoc(repo, `${PLANS}/prog-p1-copy.md`, { "doc-type": "plan", slug: "prog-p1" });
    const index = SlugIndex.build(repo);

    expect(index.duplicatedRolesOf("prog-p1")).toEqual(["identity", "plan"]);
    expect(index.duplicatedRolesOf(PROGRAM)).toEqual([]);
  });
});

describe("SlugIndex — the four-way identity gate", () => {
  it("accepts the unique legal slug of an indexed document", () => {
    const repo = newRepo();
    seedProgram(repo);
    const index = SlugIndex.build(repo);
    expect(index.slugVerdict(`${SPECS}/prog-p1-design.md`, "prog-p1")).toEqual({
      kind: "accepted",
      slug: "prog-p1",
    });
  });

  it("refuses a missing, illegal or duplicated slug with its own kind", () => {
    const repo = newRepo();
    writeDoc(repo, `${SPECS}/no-slug.md`, { "doc-type": "overall" });
    writeDoc(repo, `${SPECS}/bad-slug.md`, { "doc-type": "overall", slug: "../x" });
    writeDoc(repo, `${SPECS}/dup-a.md`, { "doc-type": "overall", slug: "dup" });
    writeDoc(repo, `${SPECS}/dup-b.md`, { "doc-type": "overall", slug: "dup" });
    const index = SlugIndex.build(repo);

    expect(index.slugVerdict(`${SPECS}/no-slug.md`, null)).toEqual({ kind: "missing" });
    expect(index.slugVerdict(`${SPECS}/bad-slug.md`, "../x")).toEqual({
      kind: "illegal",
      slug: "../x",
    });
    expect(index.slugVerdict(`${SPECS}/dup-b.md`, "dup")).toEqual({
      kind: "duplicated",
      slug: "dup",
    });
  });

  it("recognises a path inside any doc root and nothing else", () => {
    expect(SlugIndex.insideDocRoots(`${OVERALLS}/x.md`)).toBe(true);
    expect(SlugIndex.insideDocRoots(`${SPECS}/x.md`)).toBe(true);
    expect(SlugIndex.insideDocRoots(`${PLANS}/x.md`)).toBe(true);
    expect(SlugIndex.insideDocRoots("notes.md")).toBe(false);
    expect(SlugIndex.insideDocRoots(`${SPECS}-archive/x.md`)).toBe(false);
  });

  it("scans the overalls root into the index (the third doc root)", () => {
    const repo = newRepo();
    writeDoc(repo, `${OVERALLS}/prog-overall.md`, {
      "doc-type": "overall",
      slug: PROGRAM,
    });
    const index = SlugIndex.build(repo);
    expect(index.overallOf(PROGRAM)?.rel).toBe(`${OVERALLS}/prog-overall.md`);
    expect(index.entryAt(`${OVERALLS}/prog-overall.md`)?.docType).toBe("overall");
  });
});

describe("SlugIndex — the uncovered input faces", () => {
  it("reads identity from `slug:`, never from the file name (face ①)", () => {
    const repo = newRepo();
    writeDoc(repo, `${SPECS}/x-design.md`, { "doc-type": "overall", slug: "y" });
    const index = SlugIndex.build(repo);
    expect(index.identityDoc("y")?.rel).toBe(`${SPECS}/x-design.md`);
    expect(index.identityDoc("x")).toBeNull();
  });

  it("judges identity by doc-type, never by the directory it lives in (face ②)", () => {
    const repo = newRepo();
    writeDoc(repo, `${SPECS}/prog-overall.md`, { "doc-type": "overall", slug: PROGRAM });
    // The legal pair split across the two roots stays legal.
    writeDoc(repo, `${SPECS}/split-design.md`, {
      "doc-type": "phase-spec",
      slug: "split",
      program: PROGRAM,
    });
    writeDoc(repo, `${PLANS}/split.md`, { "doc-type": "plan", slug: "split" });
    expect(SlugIndex.build(repo).violations()).toEqual([]);

    // Two identity documents split across the two roots are still duplicates —
    // the plan-root file is an identity document because its doc-type says so.
    writeDoc(repo, `${PLANS}/split-overall.md`, { "doc-type": "overall", slug: "split" });
    const violations = SlugIndex.build(repo).violations();
    expect(violations.map((violation) => violation.kind)).toEqual(["duplicate-identity"]);
    expect(violations[0]?.rel).toBe(`${SPECS}/split-design.md`);
  });
});
