// packages/cdd-engine/src/docs/identity/__tests__/identity.test.ts
// The identity segment's pins:
//   · four document types, each with its own registry; an unknown type throws; the slug
//     domain answers both a legal value and an escaping one;
//   · the declared face table covers its domain, and a face set that disagrees with the
//     sections a document actually carries is red;
//   · all six projections derive from the registry — a doctored registry row moves the
//     projection it feeds;
//   · the json face answers the same bytes twice, and refuses a target as a declared
//     value (never a throw, never a rendered schema);
//   · `identity/` imports nothing from `judging/` — the parse faces extract, they do not
//     judge;
//   · the recognition layer is table-driven: an edited row set changes what is
//     recognized (zero hard-coded branches);
//   · the `SKILL.md` anatomy contract is one declaration, readable as data;
//   · the four parse faces extract what the grammar holds (a task block, a design group,
//     a phase row) and nothing more.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RepoPath } from "../../../env/paths/root.ts";
import { FrontMatter } from "../../grammar/frontmatter.ts";
import { MarkdownTree } from "../../grammar/markdown-tree.ts";
import { Documents } from "../../index.ts";
import {
  type DesignGroup,
  docTypeParsers,
  OverallParser,
  PhaseSpecParser,
  PlanParser,
  SingleSpecParser,
} from "../doc-parse.ts";
import { Projector } from "../project.ts";
import { DOC_FACES, declaredRegistries, FaceMap, isLegalSlug } from "../registry.ts";
import { SKILL_ANATOMY } from "../skill-anatomy.ts";
import { Translator } from "../translate.ts";
import { type DeclaredRegistries, DOC_TYPE_VALUES, type DocType } from "../types.ts";

/** The engine package root — the `src/**` scans' basis. */
const ENGINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The docs slice root. */
const DOCS_ROOT = path.join(ENGINE_ROOT, "src", "docs");

/** A `Documents` facade over a reader that never has a file to read. */
const documents = (): Documents =>
  new Documents({ readText: (target) => ({ kind: "read-failure", target }) });

/** The typed head of a fixture body. */
const headOf = (head: Record<string, string>): FrontMatter =>
  new FrontMatter(head as Record<string, unknown>);

/** A single-spec body: the five declared sections, one line each. */
const SINGLE_SPEC_BODY = [
  "# Single spec",
  "",
  "## Background & root cause",
  "prose",
  "",
  "## Design decisions",
  "prose",
  "",
  "## Acceptance",
  "prose",
  "",
  "## Constraints",
  "prose",
  "",
  "## Change history",
  "| Version | date | summary | author |",
  "| --- | --- | --- | --- |",
  "| v0.1 | 2026-01-15 | first | author |",
].join("\n");

/** A plan body: the constraint surface and one task block. */
const PLAN_BODY = [
  "# Plan",
  "",
  "## Constraints",
  "- rule one",
  "",
  "### Task 1: the first task",
  "",
  "#### Objective",
  "one sentence",
  "",
  "#### Files",
  "- `a.ts`",
  "",
  "#### DependsOn",
  "none",
].join("\n");

/** A phase-spec body: the design double layer and the acceptance surface. */
const PHASE_SPEC_BODY = [
  "# Phase spec",
  "",
  "## Design",
  "",
  "### 1. The first layer",
  "",
  "#### 1.1 The first item",
  "",
  "## Acceptance criteria",
  "- it passes",
].join("\n");

/** An overall body: the charter scope and the phase inventory table. */
const OVERALL_BODY = [
  "# Overall",
  "",
  "## Document scope",
  "prose",
  "",
  "## Phase inventory",
  "| Phase | Design spec | Implementation plan | Dependency |",
  "| --- | --- | --- | --- |",
  "| P1 | [spec](docs/kairos/specs/p1.md) | [plan](docs/kairos/plans/p1.md) | none |",
  "",
  "## Change history",
  "| Version | date | summary | author |",
  "| --- | --- | --- | --- |",
].join("\n");

describe("the document identity", () => {
  it("declares one registry per document type, and the type set is the one tuple", () => {
    expect(DOC_TYPE_VALUES.map((type) => declaredRegistries[type].docType)).toEqual([
      ...DOC_TYPE_VALUES,
    ]);
    for (const type of DOC_TYPE_VALUES) {
      expect(declaredRegistries[type].elements.length).toBeGreaterThan(0);
    }
  });

  it("throws on a type the declaration does not carry", () => {
    expect(() => documents().registryOf("nope" as DocType)).toThrow(/unknown document type/);
    expect(documents().registryOf("plan").docType).toBe("plan");
  });

  it("answers the slug domain with a legal value and an escaping one", () => {
    expect(isLegalSlug("2026-11-25-engine-doc-tooling-p39-design")).toBe(true);
    expect(isLegalSlug("a.b_c-1")).toBe(true);
    expect(isLegalSlug("../escape")).toBe(false);
    expect(isLegalSlug("..")).toBe(false);
    expect(isLegalSlug("with space")).toBe(false);
    expect(isLegalSlug("")).toBe(false);
  });
});

describe("the registry and the doc faces", () => {
  it("covers its domain — every heading element carries a role", () => {
    expect(FaceMap.gaps()).toEqual([]);
    for (const type of DOC_TYPE_VALUES) {
      expect(DOC_FACES[type].length).toBeGreaterThan(0);
    }
  });

  it("is red when a face declaration disagrees with the sections the body carries", () => {
    // The fixture supplies BOTH arms: one body that carries exactly the declared
    // single-spec sections, and one that dropped a section.
    const declared = DOC_FACES["single-spec"]
      .filter((entry) => entry.anchor.startsWith("## "))
      .map((entry) => entry.anchor);
    const parsed = new SingleSpecParser("single-spec").parse(MarkdownTree.parse(SINGLE_SPEC_BODY));
    expect(parsed.sections.map((section) => section.heading)).toEqual(declared);
    for (const heading of parsed.sections.map((section) => section.heading)) {
      expect(FaceMap.roleOf("single-spec", heading)).not.toBe("unmapped");
    }
    const trimmed = SINGLE_SPEC_BODY.replace("## Acceptance\nprose\n\n", "");
    const short = new SingleSpecParser("single-spec").parse(MarkdownTree.parse(trimmed));
    expect(short.sections.map((section) => section.heading)).not.toEqual(declared);
    // A role removed from the declaration is reported as a gap, not silently dropped.
    const doctored = {
      ...DOC_FACES,
      "single-spec": DOC_FACES["single-spec"].filter((entry) => entry.anchor !== "## Acceptance"),
    };
    expect(FaceMap.gaps(doctored)).toEqual([{ docType: "single-spec", anchor: "## Acceptance" }]);
  });

  it("places a field under its task block, so the innermost heading wins", () => {
    expect(FaceMap.roleOf("plan", "### Task 1: the first task")).toBe("decision");
    expect(FaceMap.roleOf("plan", "#### Objective")).toBe("decision");
    expect(FaceMap.roleOf("plan", "#### Undeclared", ["### Task 1: x"])).toBe("decision");
    expect(FaceMap.roleOf("plan", "#### Undeclared")).toBe("unmapped");
  });
});

describe("the six projections", () => {
  const projector = new Projector(declaredRegistries);

  it("derives every face for every document type", () => {
    for (const type of DOC_TYPE_VALUES) {
      expect(projector.shape()[type].structure.length).toBeGreaterThan(0);
      expect(projector.schema()[type].required.length).toBeGreaterThan(0);
      expect(projector.slices()[type].slices.length).toBe(declaredRegistries[type].elements.length);
      expect(projector.tokens()[type].tokens.length).toBe(declaredRegistries[type].elements.length);
      expect(projector.reference()[type].entries.length).toBe(
        declaredRegistries[type].elements.length,
      );
      expect(projector.skeleton()[type].slots.length).toBeGreaterThan(0);
      expect(projector.skeleton()[type].frontmatter.length).toBeGreaterThan(0);
    }
    // The task-block heading pattern is a property of the PLAN document, read off its own
    // slice table rather than re-declared by a renderer.
    expect(projector.slices().plan.taskHeadingPattern()).toBeInstanceOf(RegExp);
    expect(projector.slices().overall.taskHeadingPattern()).toBeUndefined();
  });

  it("derives the projection from the table — a doctored row moves it", () => {
    const base = projector.schema().plan.required;
    const doctored: DeclaredRegistries = {
      ...declaredRegistries,
      plan: {
        docType: "plan",
        elements: declaredRegistries.plan.elements.filter(
          (element) => element.anchor !== "## Constraints",
        ),
      },
    };
    const moved = new Projector(doctored).schema().plan.required;
    expect(base).toContain("## Constraints");
    expect(moved).not.toContain("## Constraints");
    expect(moved.length).toBe(base.length - 1);
  });
});

describe("the json face", () => {
  it("answers the same bytes twice, and refuses a target as a value", () => {
    const first = documents().projectOf("phase-spec", undefined);
    const second = documents().projectOf("phase-spec", undefined);
    expect(first.kind).toBe("projection");
    expect(first).toEqual(second);
    if (first.kind !== "projection") throw new Error("unreachable");
    expect(first.text.endsWith("\n")).toBe(true);
    expect(JSON.parse(first.text).title).toBe("phase-spec document structure");
    expect(documents().projectOf("phase-spec", "docs/x.md" as RepoPath)).toEqual({
      kind: "extra-target",
      target: "docs/x.md",
    });
  });
});

describe("the parse faces", () => {
  it("extracts the plan's task blocks and their dependency lines", () => {
    const parsed = new PlanParser("plan").parse(MarkdownTree.parse(PLAN_BODY));
    expect(parsed.taskBlocks.map((block) => block.id)).toEqual([1]);
    expect(parsed.chain).toEqual({
      docType: "plan",
      programLink: null,
      parentTokens: [],
      phases: [],
    });
  });

  it("extracts the phase-spec's design double layer and the head's chain anchors", () => {
    const parser = new PhaseSpecParser("phase-spec");
    const parsed = parser.parse(
      MarkdownTree.parse(PHASE_SPEC_BODY),
      headOf({ program: "p-program", "parent-version": "v0.1" }),
    );
    expect(parsed.design).toEqual<DesignGroup[]>([
      {
        number: "1",
        heading: "The first layer",
        items: [{ number: "1.1", heading: "The first item" }],
      },
    ]);
    expect(parsed.chain.programLink).toEqual({ target: "p-program" });
    expect(parsed.chain.parentTokens).toEqual(["v0.1"]);
  });

  it("extracts the overall's phase rows into the chain's anchor set", () => {
    const parsed = new OverallParser("overall").parse(MarkdownTree.parse(OVERALL_BODY));
    expect(parsed.chain.phases).toEqual([
      {
        id: "P1",
        designCell: "[spec](docs/kairos/specs/p1.md)",
        planCell: "[plan](docs/kairos/plans/p1.md)",
        dependencyCell: "none",
      },
    ]);
  });

  it("composes the four parsers by the one document-type tuple", () => {
    expect(Object.keys(docTypeParsers).sort()).toEqual([...DOC_TYPE_VALUES].sort());
    for (const type of DOC_TYPE_VALUES) {
      expect(docTypeParsers[type].registry.docType).toBe(type);
    }
  });
});

describe("the recognition layer", () => {
  it("recognizes through its injected rows and changes when the rows change", () => {
    const rows = [
      { en: "## Design", zh: "## 设计" },
      { en: "## Constraints", zh: "## 约束" },
    ];
    const translator = new Translator(rows);
    expect(translator.canonicalize("## 设计")).toBe("## Design");
    expect(translator.canonicalize("## 约束与边界")).toBe("## Constraints与边界");
    expect(translator.canonicalize("## Design")).toBe("## Design");
    // A rewritten table recognizes a different alias — no branch knows the words.
    const rewritten = new Translator([{ en: "## 约束", zh: "## 边界" }]);
    expect(rewritten.canonicalize("## 边界")).toBe("## 约束");
    expect(rewritten.canonicalize("## 设计")).toBe("## 设计");
    expect(translator.localize("## Design", "zh")).toBe("## 设计");
    expect(translator.localize("## Design", "en")).toBe("## Design");
    expect(translator.localize("## Design", "ja")).toBeNull();
    expect(translator.localize("never declared", "en")).toBeNull();
  });
});

describe("the anatomy contract", () => {
  it("declares the section allowlist as readable data, in one place", () => {
    const registry = SKILL_ANATOMY.sectionRegistry;
    const declared = [...registry.public, ...registry.conditional].sort();
    expect(declared).toEqual(Object.keys(registry.sections).sort());
    for (const [key, row] of Object.entries(registry.sections)) {
      expect(row.heading.startsWith("## ")).toBe(true);
      expect(`${key}`.length).toBeGreaterThan(0);
    }
    expect(SKILL_ANATOMY.digraph.sectionHeading).toBe(
      SKILL_ANATOMY.sectionRegistry.sections.flowDigraph.heading,
    );
    // One declaration in `src/**`: the guard's constant has no second home.
    expect(new Scan().filesUsing("const SKILL_ANATOMY")).toEqual([
      "docs/identity/skill-anatomy.ts",
    ]);
  });
});

describe("the segment boundary", () => {
  it("imports nothing from `judging/` — the parse faces extract, they do not judge", () => {
    expect(new SpecifierScan("identity").reaches("judging")).toEqual([]);
  });
});

/** The `src/**` scan: which non-test modules mention one identifier. */
class Scan {
  /** The `src`-relative paths whose non-test text mentions the needle. */
  filesUsing(needle: string): string[] {
    const root = path.join(ENGINE_ROOT, "src");
    const found: string[] = [];
    Scan.#walk(root, root, needle, found);
    return found.sort();
  }

  /** Collect a directory's non-test TypeScript files, or test one file. */
  static #walk(target: string, root: string, needle: string, found: string[]): void {
    const stats = statSync(target);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(target, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name === "__tests__") continue;
        Scan.#walk(path.join(target, entry.name), root, needle, found);
      }
      return;
    }
    if (!target.endsWith(".ts")) return;
    if (readFileSync(target, "utf8").includes(needle)) found.push(path.relative(root, target));
  }
}

/** The import-face scan: the specifiers of one `docs/` segment that land in another. */
class SpecifierScan {
  readonly #segment: string;

  constructor(segment: string) {
    this.#segment = segment;
  }

  /** One row per offending edge — `<file> -> <specifier>`, nothing when the segment does
   *  not reach the named sibling. */
  reaches(sibling: string): string[] {
    const from = path.join(DOCS_ROOT, this.#segment);
    const to = path.join(DOCS_ROOT, sibling);
    const offences: string[] = [];
    for (const file of SpecifierScan.#files(from)) {
      for (const specifier of SpecifierScan.#specifiersIn(readFileSync(file, "utf8"))) {
        if (!specifier.startsWith(".")) continue;
        const resolved = path.resolve(path.dirname(file), specifier);
        if (resolved === to || resolved.startsWith(`${to}${path.sep}`)) {
          offences.push(`${path.relative(ENGINE_ROOT, file)} -> ${specifier}`);
        }
      }
    }
    return offences;
  }

  /** Every non-test TypeScript file under one directory. */
  static #files(directory: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") found.push(...SpecifierScan.#files(child));
        continue;
      }
      if (entry.name.endsWith(".ts")) found.push(child);
    }
    return found;
  }

  /** The module specifiers a file's text carries. */
  static #specifiersIn(text: string): readonly string[] {
    const found: string[] = [];
    for (const match of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier !== undefined) found.push(specifier);
    }
    return found;
  }
}
