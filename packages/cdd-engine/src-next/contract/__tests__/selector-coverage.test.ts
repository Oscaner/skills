// packages/cdd-engine/src-next/contract/__tests__/selector-coverage.test.ts
// P21 §7.5 — the selector coverage matrix. Every declared element of the four
// registries (111 rows) carries a `selector`, every selector is a well-formed
// query that terminates at the document root, and every selector RESOLVES on a
// conforming document of its own type.
//
// The fixtures are four SYNTHETIC conforming documents, one per doc type, living in
// `fixtures/` beside this file. Each is the registry-derived skeleton the engine itself
// renders, so every field name answers the declared registry and the carrier is
// conforming by construction; the overall's optional `## File paths` facet rides the
// declared conforming form. Each one is judged by the same doc-contract a consumer
// document meets — no exemption, and no corpus arm over this repository's own
// documents. The canonicalization through the translation layer stays: it is the tree's
// input contract (the normalized view), not a property of the old fixtures.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Words } from "../../face/words.ts";
import { type DocType, declaredRegistries, RegistryGuard } from "../declare.ts";
import { Contract } from "../judge.ts";
import { MarkdownTree } from "../markdown-tree.ts";
import { Translator } from "../translate.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

/** The four synthetic carriers — one conforming document per doc type. */
const FIXTURE_DIR = path.resolve(import.meta.dirname, "fixtures");

/** One fixture's repo-relative path — the coordinate the judgment reads. */
const fixturePath = (docType: DocType): string =>
  path.relative(REPO_ROOT, path.join(FIXTURE_DIR, `${docType}.md`));

/** The four doc types — the fixture set and the registry walk share this one list. */
const DOC_TYPES: readonly DocType[] = ["overall", "plan", "phase-spec", "single-spec"];

/** The fixture documents — one synthetic conforming carrier per doc type, canonicalized
 *  through the same translation face the judgment plane applies. */
class Fixtures {
  readonly #translator = new Translator(new Words());

  /** The raw fixture text of one doc type (`fixtures/<doc-type>.md`). */
  text(docType: DocType): string {
    return this.#read(fixturePath(docType));
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

  it("declares a well-formed selector on all 112 elements", () => {
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
    expect(total).toBe(112);
  });

  it("resolves all 112 elements on a conforming document of their own type", () => {
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
    expect(total).toBe(112);
  });

  it("judges each synthetic carrier clean — doc-contract reports nothing on any of the four", () => {
    // The carriers are conforming by construction (a skeleton render plus the declared
    // optional facets), and they are judged by the SAME entry a consumer document meets:
    // one finding here would mean the fixture props up the coverage matrix with a
    // document the engine itself refuses.
    const offenders: string[] = [];
    for (const docType of DOC_TYPES) {
      const findings = new Contract().validate({
        docKey: docType,
        path: path.join(REPO_ROOT, fixturePath(docType)),
        content: fixtures.text(docType),
        root: REPO_ROOT,
      });
      for (const finding of findings) {
        offenders.push(`${docType} · ${finding.kind} · ${finding.field} · ${finding.message}`);
      }
    }
    expect(offenders, `carriers with findings: ${offenders.join(" | ")}`).toEqual([]);
  });

  it("keeps the selector face and the declared value shape aligned — zero domain findings on the synthetic carriers", () => {
    // The coverage matrix above proves a selector RESOLVES; it cannot see a
    // selector that resolves onto a node its own element's `valuePattern` rejects —
    // or a cell selector that resolves a SIBLING column. This arm runs the real
    // domain judgment over every doc type's carrier and pins the overall fixture, the
    // one carrier where the two Phase-inventory faces can disagree.
    const carriers: Record<DocType, string> = {
      overall: fixtures.text("overall"),
      plan: fixtures.canonicalizedText("plan", SAMPLE_FORMS.plan),
      "phase-spec": fixtures.canonicalizedText("phase-spec", SAMPLE_FORMS["phase-spec"]),
      "single-spec": fixtures.canonicalizedText("single-spec", SAMPLE_FORMS["single-spec"]),
    };
    const offenders: string[] = [];
    for (const docType of Object.keys(carriers) as DocType[]) {
      const findings = new Contract().validate({
        docKey: docType,
        path: path.join(REPO_ROOT, fixturePath(docType)),
        content: carriers[docType],
        root: REPO_ROOT,
      });
      for (const finding of findings) {
        if (finding.kind !== "domain") continue;
        offenders.push(`${docType} · ${finding.field} · ${finding.message}`);
      }
    }
    expect(offenders, `out-of-domain resolved nodes: ${offenders.join(" | ")}`).toEqual([]);
  });

  it("locates every overall table, then reads the fixture's rules clean", () => {
    const fixture = path.join(REPO_ROOT, fixturePath("overall"));
    const tree = fixtures.tree("overall");
    // What this covers is the SELECTOR (does `tableUnder` still land on the real table
    // and read its body?), not how many rows the charter happens to carry: an exact row
    // count is a copy of the document that rots on every charter append and forces a
    // re-anchor commit per appended row. A table that stops being found reads 0, so the
    // non-empty floor keeps the discriminating power and drops the churn.
    for (const heading of [
      "## Phase inventory",
      "## Issue inventory",
      "## Change history",
      "## File paths",
    ]) {
      const table = tree.tableUnder(heading);
      expect(table, `${heading} is located`).toBeDefined();
      expect(table?.body.length, `${heading} carries rows`).toBeGreaterThan(0);
      expect(table?.header?.length ?? 0, `${heading} carries columns`).toBeGreaterThan(1);
    }
    const findings = new Contract().validate({
      docKey: "overall",
      path: fixture,
      content: fixtures.text("overall"),
      root: REPO_ROOT,
    });
    // The subject here is the SELECTOR read — the rules that judge the located nodes —
    // not the fixture's history. The synthetic carrier's change-history rows are as
    // wide as their header, so this gate asserts agreement with the document's OWN
    // ragged count (0; a row that goes ragged reds here by name). The leg's LIVENESS is
    // asserted separately below against a synthetic ragged table — a dead leg can no
    // longer hide behind a clean document.
    const changeHistory = tree.tableUnder("## Change history");
    const width = changeHistory?.header?.length ?? 0;
    const ragged = (changeHistory?.body ?? []).filter((row) => row.length !== width).length;
    const shape = findings.filter((finding) => finding.kind === "change-history-row-shape");
    expect(shape, "the shape leg agrees with the fixture's own ragged-row count").toHaveLength(
      ragged,
    );
    expect(
      shape.every((finding) => finding.field === "Change history"),
      "every shape finding is anchored on the ## Change history table",
    ).toBe(true);
    expect(
      findings
        .filter((finding) => finding.kind !== "change-history-row-shape")
        .map((finding) => `${finding.kind} · ${finding.field} · ${finding.message}`),
      "the synthetic overall judges clean (its shape state is no longer exempt)",
    ).toEqual([]);
  });

  it("reports one shape finding per width-ragged change-history row (synthetic fixture)", () => {
    // Liveness of the `change-history-row-shape` leg, independent of any repo document:
    // a uniform row passes, a row whose cell count differs from the header is named.
    const content = [
      "---",
      "title: synthetic overall",
      "doc-type: overall",
      "version: v0.1",
      "date: 2026-01-01",
      "slug: synthetic-overall-probe",
      "---",
      "",
      "## Change history",
      "",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
      "| v0.1 | 2026-01-01 | a uniform row | someone |",
      "| v0.1 | 2026-01-01 | a short row |",
      "",
    ].join("\n");
    const findings = new Contract().validate({
      docKey: "overall",
      path: "synthetic-overall-probe.md",
      content,
      root: REPO_ROOT,
    });
    const shape = findings.filter((finding) => finding.kind === "change-history-row-shape");
    expect(shape, "one shape finding per ragged row, none for the uniform row").toHaveLength(1);
  });

  it("keeps the two Phase-inventory cell elements on their own columns", () => {
    // The design-spec and implementation-plan cells share the decorated
    // `✔ Done（…）` shape, so an unguarded locator judges 40 nodes over a 21-row
    // table and the design element reports the plan cell. The column guard makes
    // each element judge its own column only.
    const registry = declaredRegistries.overall;
    const tree = fixtures.tree("overall");
    const columnsOf = (anchor: string): readonly (number | undefined)[] => {
      const element = registry.elements.find((entry) => entry.anchor === anchor);
      expect(element, `${anchor} is registered`).toBeDefined();
      if (element === undefined) return [];
      return tree.occurrences(element.selector).map((node) => node.column);
    };
    const design = columnsOf("Design spec cell");
    const plan = columnsOf("Implementation plan cell");
    expect(design.length).toBeGreaterThan(0);
    expect(plan.length).toBeGreaterThan(0);
    expect(new Set(design)).toEqual(new Set([4]));
    expect(new Set(plan)).toEqual(new Set([5]));
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
