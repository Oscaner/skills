// packages/cdd-engine/src-next/contract/__tests__/selector-coverage.test.ts
// P21 §7.5 — the selector coverage matrix. Every declared element of the four
// registries (112 elements) carries a `selector`, every selector is a well-formed
// query that terminates at the document root, and every selector RESOLVES on a
// conforming document of its own type.
//
// The fixtures are four SYNTHETIC conforming documents, one per doc type, living in
// `fixtures/` beside this file. Each is the registry-derived skeleton the engine itself
// renders, so every field name answers the declared registry and the carrier is
// conforming by construction; the overall's optional `## File paths` facet rides the
// declared conforming form. Each one is judged by the same doc-contract a consumer
// document meets — no exemption.
//
// The judgment's RIGHT DOMAIN is the four carriers themselves, mounted into an in-memory
// corpus this file owns (the judge context's `fs` seam). `single-home` is the one rule
// that sweeps neighbours, and it reads them through that seam: pointing the judgment at
// the checkout instead would make the matrix's silence a claim about this repository's
// own records — the surface this phase retires — and a contributor editing an internal
// record would redden a test that never named that document. The canonicalization
// through the translation layer stays: it is the tree's input contract (the normalized
// view), not a property of the old fixtures.
//
// Every optional and conditional form the registry lets a document omit rides the
// carrier itself, never a block appended for the matrix's benefit: a form carried by
// material no arm judges would let the matrix read as complete while one class of
// finding went unasserted. Presence, the full contract and the drop cells therefore all
// read the same four documents.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryFs } from "../../__tests__/support/memory-fs.ts";
import { Words } from "../../face/words.ts";
import { ENGINE_DOC_ROOTS } from "../../infra/doc-roots.ts";
import { type DocType, declaredRegistries, RegistryGuard } from "../declare.ts";
import type { Finding } from "../invariants.ts";
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

/** The doc root each carrier's own type belongs to — the mount point that makes the
 *  carriers a neighbour corpus `single-home` actually sweeps (a document outside the doc
 *  roots is invisible to that rule's right domain). */
const DOC_ROOT: Readonly<Record<DocType, string>> = {
  overall: ENGINE_DOC_ROOTS.overalls,
  "phase-spec": ENGINE_DOC_ROOTS.specs,
  plan: ENGINE_DOC_ROOTS.plans,
  "single-spec": ENGINE_DOC_ROOTS.specs,
};

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

  /** Every finding doc-contract reports on one carrier text (`text` is a mutation of the
   *  fixture, so a drop cell can judge what the engine says about the mutated carrier).
   *  The right domain is the corpus below, never the checkout. */
  findings(docType: DocType, text = this.text(docType)): readonly Finding[] {
    return new Contract().validate({
      docKey: docType,
      path: path.join(REPO_ROOT, fixturePath(docType)),
      content: text,
      root: REPO_ROOT,
      fs: this.#corpus(docType),
    });
  }

  /** The right domain one judgment sweeps — the OTHER three carriers, mounted under the
   *  doc root their own type belongs to. The file owns this material, so the matrix's
   *  silence is a statement about the corpus it writes.
   *
   *  The mounted copies carry a slug of their own, and that is load-bearing: a document
   *  and its same-slug sibling are the two faces of ONE design (a spec and its plan), and
   *  `single-home` skips that pair on purpose — four carriers still on the skeleton's
   *  `:::fill slug` would compare nothing and read clean for the wrong reason. */
  #corpus(excluded: DocType): MemoryFs {
    const files: Record<string, string> = {};
    for (const docType of DOC_TYPES) {
      if (docType === excluded) continue;
      const mounted = path.join(REPO_ROOT, DOC_ROOT[docType], `${docType}-fixture.md`);
      files[mounted] = this.text(docType).replace(
        "slug: ':::fill slug'",
        `slug: '${docType}-fixture'`,
      );
    }
    return new MemoryFs(files);
  }

  /** The declared elements of one doc type that resolve on no node of the carrier text —
   *  the presence reading, in registry order. */
  unresolved(docType: DocType, text = this.text(docType)): readonly string[] {
    const tree = MarkdownTree.parse(this.#translator.canonicalize(text));
    return declaredRegistries[docType].elements
      .filter((element) => tree.occurrences(element.selector).length === 0)
      .map((element) => element.anchor);
  }

  #read(relative: string): string {
    return readFileSync(path.join(REPO_ROOT, relative), "utf8");
  }
}

/** One drop cell — a carrier text with one declared form removed, plus the anchors that
 *  removal is expected to take with it (`[anchor]` when the form stands alone). */
interface DropCell {
  /** The doc type whose carrier the mutation edits. */
  readonly docType: DocType;
  /** The declared form this cell removes (registry anchor, named in the failure). */
  readonly form: string;
  /** The carrier with the form gone — throws when the carrier does not carry it, so a
   *  cell can never pass by mutating nothing. */
  readonly mutate: (text: string) => string;
  /** The anchors the presence arm reads after the mutation, in registry order. */
  readonly lost: readonly string[];
}

/** Replace the one occurrence of `needle` with `replacement`; a needle the carrier does
 *  not carry throws rather than passing the cell silently. */
const replacing = (needle: string, replacement = ""): ((text: string) => string) => {
  const mutate = (text: string): string => {
    if (!text.includes(needle)) throw new Error(`the carrier does not carry "${needle}"`);
    return text.replace(needle, replacement);
  };
  return mutate;
};

/** The per-form drop cells — one for every optional and conditional element the four
 *  carriers supply, plus one required form. Dropping any of these must redden the
 *  presence arm for exactly the anchors listed and for nothing else: that is the red
 *  side the matrix had no way to show while the optional forms lived in an appended
 *  block. `plan · Constraint delta sub-heading` is the one omit-capable element with no
 *  cell of its own: its occurrence is the `### Task N:` heading another element owns, so
 *  no mutation drops it alone. */
const DROP_CELLS: readonly DropCell[] = [
  {
    docType: "overall",
    form: "## File paths",
    mutate: replacing("## File paths", "## Artifact paths"),
    lost: ["## File paths", "File path row"],
  },
  {
    docType: "overall",
    form: "### 设计决策留存",
    mutate: replacing("### 设计决策留存（2026-11-23）", "### 设计留存（2026-11-23）"),
    lost: ["### 设计决策留存"],
  },
  {
    docType: "overall",
    form: "#### [MFRBEN] group",
    mutate: replacing("#### M group", "#### Q group"),
    lost: ["#### [MFRBEN] group"],
  },
  {
    docType: "overall",
    form: "#### Upstream Endorsements",
    mutate: replacing("#### Upstream Endorsements", "#### Upstream endorsement"),
    lost: ["#### Upstream Endorsements"],
  },
  {
    docType: "overall",
    form: "issuecomment anchor",
    mutate: replacing("#123#issuecomment-456", "none"),
    lost: ["issuecomment anchor"],
  },
  {
    docType: "overall",
    form: "Soft edge",
    mutate: replacing("P2 -> P1   (soft)\n", ""),
    lost: ["Soft edge"],
  },
  {
    docType: "overall",
    form: "Backfill clause",
    mutate: replacing("| Pending → v0.1 |", "| v0.0 → v0.1 |"),
    lost: ["Backfill clause"],
  },
  {
    docType: "overall",
    form: "Design claim token",
    mutate: replacing("| P1-design |", "| Done |"),
    lost: ["Design claim token"],
  },
  {
    docType: "overall",
    form: "Phase range ref",
    mutate: replacing("| P1–P2 |", "| the phase |"),
    lost: ["Phase range ref"],
  },
  {
    docType: "plan",
    form: "base",
    mutate: replacing("base: ':::fill base'\n", ""),
    lost: ["base"],
  },
  {
    docType: "plan",
    form: "DependsOn none",
    mutate: replacing("#### DependsOn\nnone\n", "#### DependsOn\n\n"),
    lost: ["DependsOn none"],
  },
  {
    docType: "plan",
    form: "DependsOn id",
    mutate: replacing("#### DependsOn\n1\n", "#### DependsOn\n\n"),
    lost: ["DependsOn id"],
  },
  {
    docType: "plan",
    form: "Task prose reference",
    mutate: replacing("the shape Task 2 builds on", "the shape the second task builds on"),
    lost: ["Task prose reference"],
  },
  {
    docType: "phase-spec",
    form: "parent-version",
    mutate: replacing("parent-version: v0.1\n", ""),
    lost: ["parent-version"],
  },
  {
    docType: "phase-spec",
    form: "## Deviations",
    mutate: replacing("## Deviations", "## Deviation"),
    lost: ["## Deviations"],
  },
  {
    docType: "phase-spec",
    form: "Deviations columns",
    mutate: replacing(
      "| Overall assumption | Phase decision | Overall updated? |",
      "| Overall assumption | Phase decision | Overall updated |",
    ),
    lost: ["Deviations columns"],
  },
  {
    docType: "phase-spec",
    form: "Deviations row",
    mutate: replacing("| :::fill overall-assumption | :::fill phase-decision | Yes |\n", ""),
    lost: ["Deviations row", "Overall updated answer"],
  },
  {
    docType: "phase-spec",
    form: "Overall updated answer",
    mutate: replacing("| :::fill phase-decision | Yes |", "| :::fill phase-decision | No |"),
    lost: ["Overall updated answer"],
  },
  {
    docType: "phase-spec",
    form: "## Incremental warning",
    mutate: replacing("## Incremental warning", "## Incremental risk"),
    lost: ["## Incremental warning"],
  },
  {
    docType: "phase-spec",
    form: "## Notes for downstream",
    mutate: replacing("## Notes for downstream", "## Notes downstream"),
    lost: ["## Notes for downstream"],
  },
  {
    docType: "phase-spec",
    form: "## Review record",
    mutate: replacing("## Review record", "## Review log"),
    lost: ["## Review record"],
  },
  {
    docType: "single-spec",
    form: "issues",
    mutate: replacing("issues: ':::fill issues'\n", ""),
    lost: ["issues"],
  },
  {
    docType: "plan",
    form: "## Constraints (required)",
    mutate: replacing("## Constraints", "## Constraint"),
    lost: ["## Constraints", "Constraint delta bullet", "Constraint delta sub-heading"],
  },
];

describe("selector coverage — every declared element carries a resolvable locator", () => {
  const fixtures = new Fixtures();

  it("keeps the module header's figure equal to the four registries' own lengths", () => {
    // The header's figure is a claim about the tree, and a hand-written one is what went
    // stale here before: it read 111 against 112 declared elements. The arm reads the
    // header off this file's own bytes and compares it with the registries' lengths, so
    // the figure has one subject and one red.
    const header = readFileSync(
      path.join(import.meta.dirname, "selector-coverage.test.ts"),
      "utf8",
    ).match(/registries \((\d+) elements\)/);
    // the pair: a header without the figure leaves this comparison no subject
    expect(header).not.toBeNull();
    const total = Object.values(declaredRegistries).reduce(
      (sum, registry) => sum + registry.elements.length,
      0,
    );
    // the pair: a neighbour value in the header is red
    expect(Number(header?.[1])).toBe(total);
  });

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

  it("resolves all 112 elements on the conforming carrier of their own type", () => {
    // The matrix reads the four synthetic carriers and nothing else; every optional and
    // conditional form lives on the carrier, so "no occurrence" never passes as coverage
    // and the failure names the exact form that went missing.
    const missing: string[] = [];
    let total = 0;
    for (const docType of DOC_TYPES) {
      total += declaredRegistries[docType].elements.length;
      for (const anchor of fixtures.unresolved(docType)) missing.push(`${docType} · ${anchor}`);
    }
    expect(missing, `unresolved elements: ${missing.join(" | ")}`).toEqual([]);
    expect(total).toBe(112);
  });

  it("judges each synthetic carrier clean — doc-contract reports nothing of any kind", () => {
    // The carriers are conforming by construction (a skeleton render plus the declared
    // optional and conditional forms), and they are judged by the SAME entry a consumer
    // document meets. EVERY finding kind is asserted here, not the domain class alone: a
    // form carried only so a selector can resolve, but never judged, is the bypass this
    // file exists to prevent.
    const offenders: string[] = [];
    for (const docType of DOC_TYPES) {
      for (const finding of fixtures.findings(docType)) {
        offenders.push(`${docType} · ${finding.kind} · ${finding.field} · ${finding.message}`);
      }
    }
    expect(offenders, `carriers with findings: ${offenders.join(" | ")}`).toEqual([]);
  });

  it("reddens the presence arm for exactly the form a carrier drops — one cell per declared form", () => {
    // The red side of the presence arm, cell by cell. A dropped form must be reported by
    // name and must take only the anchors it owns with it; a cell whose needle is gone
    // throws, so the table cannot rot into a row that mutates nothing.
    const offenders: string[] = [];
    for (const cell of DROP_CELLS) {
      const lost = fixtures.unresolved(cell.docType, cell.mutate(fixtures.text(cell.docType)));
      if (lost.join(" | ") !== cell.lost.join(" | ")) {
        offenders.push(
          `${cell.docType} · ${cell.form}: expected [${cell.lost.join(" | ")}], read [${lost.join(" | ")}]`,
        );
      }
    }
    expect(offenders, `drop cells out of step: ${offenders.join(" ; ")}`).toEqual([]);
  });

  it("keeps the selector face and the declared value shape aligned — zero domain findings on the synthetic carriers", () => {
    // The narrower reading of the full-contract arm above: the `domain` class alone sees a
    // selector that resolves onto a node its own element's `valuePattern` rejects — or a
    // cell selector that resolves a SIBLING column. Both Phase-inventory faces the column
    // guard separates (`P1-design` and `✔ Done`) ride the overall carrier, so a locator
    // that judges the wrong column reddens here.
    const offenders: string[] = [];
    for (const docType of DOC_TYPES) {
      for (const finding of fixtures.findings(docType)) {
        if (finding.kind !== "domain") continue;
        offenders.push(`${docType} · ${finding.field} · ${finding.message}`);
      }
    }
    expect(offenders, `out-of-domain resolved nodes: ${offenders.join(" | ")}`).toEqual([]);
  });

  it("reddens the domain arm for a value outside the declared vocabulary", () => {
    // The domain arm's red side: a value the element's `valuePattern` refuses is a
    // `domain` finding, so the arm above is a judgment and not a restatement of "the
    // selector resolved". `doc-type` is the strict enum shape, the narrowest carrier of
    // the declared domain.
    const mutated = replacing(
      "doc-type: overall",
      "doc-type: not-a-doc-type",
    )(fixtures.text("overall"));
    const domain = fixtures
      .findings("overall", mutated)
      .filter((finding) => finding.kind === "domain")
      .map((finding) => finding.field);
    expect(domain, "an out-of-vocabulary doc-type is judged").toContain("doc-type");
    expect(
      fixtures.findings("overall").filter((finding) => finding.kind === "domain"),
      "the unmutated carrier stays silent",
    ).toEqual([]);
  });

  it("locates every overall table, then reads the fixture's rules clean", () => {
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
    const findings = fixtures.findings("overall");
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
      root: "/repo",
      fs: new MemoryFs({}),
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
