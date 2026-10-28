// packages/cdd-engine/src-next/contract/__tests__/selector-coverage.test.ts
// P21 §7.5 — the selector coverage matrix. Every declared element of the four
// registries (114 rows) carries a `selector`, every selector is a well-formed
// query that terminates at the document root, and every selector RESOLVES on a
// conforming document of its own type.
//
// The fixtures are the repository's own documents, canonicalized through the
// translation layer first (the tree's input contract: the normalized view, so a
// legacy Chinese charter marker matches its English canonical element). The
// single-spec has no document in this repository, so its fixture is the
// registry-derived skeleton — the conforming carrier the engine itself renders.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Words } from "../../face/words.ts";
import { SkeletonAssembler } from "../../render/skeleton.ts";
import { type DocType, declaredRegistries, RegistryGuard } from "../declare.ts";
import { MarkdownTree } from "../markdown-tree.ts";
import { Projector } from "../project.ts";
import { Translator } from "../translate.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

/** The fixture document of one doc type — the repository's own doc, canonicalized
 *  through the same translation face the judgment plane applies. */
class Fixtures {
  readonly #translator = new Translator(new Words());

  /** The raw fixture text of one doc type (a repository document, or the rendered
   *  skeleton where the repository carries no document of the type). */
  text(docType: DocType): string {
    switch (docType) {
      case "overall":
        return this.#read("docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md");
      case "plan":
        return this.#read("docs/kairos/plans/2026-10-10-engine-doc-tooling-p21.md");
      case "phase-spec":
        return this.#read("docs/kairos/specs/2026-10-10-engine-doc-tooling-p21-design.md");
      case "single-spec":
        return new SkeletonAssembler(
          new Projector(declaredRegistries).skeleton()["single-spec"],
          "2026-10-10",
        ).render();
    }
  }

  /** The canonicalized tree of one doc type — the normalized view the tree reads. */
  tree(docType: DocType): MarkdownTree {
    return MarkdownTree.parse(this.#translator.canonicalize(this.text(docType)));
  }

  /** The canonicalized view of a fixture text plus one appended sample block. */
  canonicalizedText(docType: DocType, sample: string): string {
    return this.#translator.canonicalize(`${this.text(docType)}\n\n${sample}\n`);
  }

  #read(relative: string): string {
    return readFileSync(path.join(REPO_ROOT, relative), "utf8");
  }
}

describe("selector coverage — every declared element carries a resolvable locator", () => {
  const fixtures = new Fixtures();

  it("declares a well-formed selector on all 114 elements", () => {
    let total = 0;
    for (const registry of Object.values(declaredRegistries)) {
      for (const element of registry.elements) {
        total += 1;
        expect(
          RegistryGuard.isSelector(element.selector),
          `${registry.docType} · ${element.anchor} has a malformed selector`,
        ).toBe(true);
      }
    }
    expect(total).toBe(114);
  });

  it("resolves all 114 elements on a conforming document of their own type", () => {
    // The matrix reads the repository's own document of each type first; an element
    // the document legitimately leaves out (an optional facet, a conditional
    // section) resolves on the declared sample block of that type — a CONFORMING
    // carrier, so "no occurrence" never passes as coverage.
    const missing: string[] = [];
    let total = 0;
    for (const registry of Object.values(declaredRegistries)) {
      const tree = fixtures.tree(registry.docType);
      const sample = MarkdownTree.parse(
        fixtures.canonicalizedText(registry.docType, SAMPLE_FORMS[registry.docType as DocType]),
      );
      for (const element of registry.elements) {
        total += 1;
        if (tree.occurrences(element.selector).length > 0) continue;
        if (sample.occurrences(element.selector).length > 0) continue;
        missing.push(`${registry.docType} · ${element.anchor}`);
      }
    }
    expect(missing, `unresolved elements: ${missing.join(" | ")}`).toEqual([]);
    expect(total).toBe(114);
  });
});

/** The per-doc-type sample block carrying the optional / conditional forms the
 *  repository's own fixtures do not happen to declare (a conditional section, an
 *  optional facet, a parenthetical lineage cell). One declared sample per doc type
 *  — never a second fixture document. */
const SAMPLE_FORMS: Record<DocType, string> = {
  overall: [
    "## File paths",
    "",
    "| Artifact | Path |",
    "| --- | --- |",
    "| engine | `packages/cdd-engine/src-next/bin.ts` |",
    "",
    "#### M group",
    "",
    "A decision group leaf.",
    "",
    "#### Upstream Endorsements",
    "",
    "An endorsement leaf.",
    "",
    "## Issue inventory",
    "",
    "| Phase | Issue (ref) | Title summary |",
    "| --- | --- | --- |",
    "| P1 | #123#issuecomment-456 | an issue title |",
    "",
    "## Phase inventory",
    "",
    "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| P9 | scope | P1–P3 | P9-design | ✔ Done | criteria | P1 -> P9 |",
    "",
    "## Dependency graph",
    "",
    "```",
    "P1 -> P9   (soft)",
    "```",
    "",
    "| v2.86 | 2026-10-26 | backfill | someone |",
  ].join("\n"),
  plan: [
    "#### Files",
    "",
    "packages/cdd-engine/src-next/contract/markdown-tree.ts",
    "",
    "#### DependsOn",
    "",
    "none",
  ].join("\n"),
  "phase-spec": [
    "## Incremental warning",
    "",
    "prose",
    "",
    "## Deviations",
    "",
    "| Overall assumption | Phase decision | Overall updated? |",
    "| --- | --- | --- |",
    "| an assumption | a decision | Yes |",
    "",
    "## Notes for downstream",
    "",
    "prose",
    "",
    "## Review record",
    "",
    "prose",
  ].join("\n"),
  "single-spec": "",
};
