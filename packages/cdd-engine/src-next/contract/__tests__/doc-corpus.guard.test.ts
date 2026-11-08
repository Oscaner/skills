// packages/cdd-engine/src-next/contract/__tests__/doc-corpus.guard.test.ts
// P30 T3 — the in-repo doc corpus as the change-history hardening's real acceptance
// surface. Every stored spec / plan / overall is judged by the FULL doc contract, and
// the three lineage legs are read back.
//
// The gate is a red-able full scan, never a dry-run sample: a document that starts
// tripping a leg, or trips it harder than it did when the hardening landed, fails here
// and is NAMED. The three legs' corpus state at that landing is recorded as a CEILING
// (`DRIFT_CEILING`) because the pre-existing drift is a corpus fact, not a regression of
// this round: the Change-history tables of fifteen historical documents declare one
// column count in the header while older rows carry another (the overall alone carries
// 110 such rows), and those documents are frozen history — the spec forbids a migration.
// A ceiling keeps the gate honest in both directions: repairing a table is green (the
// count drops below its ceiling), while any NEW drifted doc, any NEW wrapped row and any
// sharper count is red by name. The assertions stay scoped to the lineage legs — the
// corpus also carries an unrelated pre-existing red (`p19-design`'s presence face),
// which this gate neither swallows nor repairs.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ENGINE_DOC_ROOTS } from "../../infra/doc-roots.ts";
import { FrontMatterExtractor } from "../frontmatter.ts";
import type { Finding } from "../invariants.ts";
import { Contract } from "../judge.ts";
import { DOC_KEYS, type DocKey } from "../project.ts";

/** The repo root — the doc roots are declared relative to it. */
const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));

/** The lineage legs this gate reads — the two new rules plus the uniqueness leg whose
 *  false red the hardening removes. */
const PINNED_KINDS = [
  "change-history-row-shape",
  "change-history-latest-matches-front-matter",
  "change-history-version-unique",
] as const;

/** The program's own two documents — the docs this phase writes, which carry no drift
 *  at all (the hardening's positive acceptance face). */
const PROGRAM_DOCS = [
  "docs/kairos/specs/2026-10-10-engine-doc-tooling-p30-design.md",
  "docs/kairos/plans/2026-10-10-engine-doc-tooling-p30.md",
] as const;

/** The corpus's pre-existing Change-history drift, measured when the hardening landed —
 *  a per-document CEILING, never a lower bound: a repaired table passes, more drift does
 *  not. Absent document = zero tolerated findings. */
const DRIFT_CEILING: Readonly<
  Record<(typeof PINNED_KINDS)[number], Readonly<Record<string, number>>>
> = {
  "change-history-row-shape": {
    "docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md": 110,
    "docs/kairos/specs/2026-10-10-engine-doc-tooling-p5-design.md": 2,
    "docs/kairos/specs/2026-10-10-engine-doc-tooling-p8-design.md": 1,
    "docs/kairos/specs/2026-10-10-engine-doc-tooling-p12-design.md": 1,
    "docs/kairos/specs/2026-10-10-engine-doc-tooling-p20-design.md": 2,
    "docs/kairos/specs/2026-10-10-engine-doc-tooling-p21-design.md": 1,
    "docs/kairos/specs/2026-10-10-engine-doc-tooling-p24-design.md": 26,
    "docs/kairos/specs/2026-10-10-engine-doc-tooling-p25-design.md": 1,
    "docs/kairos/plans/2026-10-10-engine-doc-tooling-p8.md": 1,
    "docs/kairos/plans/2026-10-10-engine-doc-tooling-p11.md": 1,
    "docs/kairos/plans/2026-10-10-engine-doc-tooling-p12.md": 1,
    "docs/kairos/plans/2026-10-10-engine-doc-tooling-p20.md": 2,
    "docs/kairos/plans/2026-10-10-engine-doc-tooling-p21.md": 1,
    "docs/kairos/plans/2026-10-10-engine-doc-tooling-p22.md": 1,
    "docs/kairos/plans/2026-10-10-engine-doc-tooling-p24.md": 24,
  },
  // The two rows the shape ceiling starves out of those lineages: the newest row of
  // each p24 Change-history table is one of its own shape-drifted rows.
  "change-history-latest-matches-front-matter": {
    "docs/kairos/specs/2026-10-10-engine-doc-tooling-p24-design.md": 1,
    "docs/kairos/plans/2026-10-10-engine-doc-tooling-p24.md": 1,
  },
  // Zero: no stored doc registers a version twice, so the uniqueness leg is a plain
  // full-corpus pin.
  "change-history-version-unique": {},
};

/** One judged corpus document — its identity plus the full doc judgment's findings. */
interface JudgedDoc {
  readonly rel: string;
  readonly docKey: DocKey;
  readonly findings: readonly Finding[];
}

/** The in-repo doc corpus, judged once over the three declared doc roots. */
class JudgedCorpus {
  /** Load and judge every markdown doc of the three roots (`repo`-relative). */
  static load(repo: string): JudgedCorpus {
    const contract = new Contract();
    const docs: JudgedDoc[] = [];
    const undocumented: string[] = [];
    for (const dir of Object.values(ENGINE_DOC_ROOTS)) {
      for (const name of readdirSync(path.join(repo, dir)).sort()) {
        if (!name.endsWith(".md")) continue;
        const rel = `${dir}/${name}`;
        const content = readFileSync(path.join(repo, rel), "utf8");
        const docKey = JudgedCorpus.docKeyOf(content);
        if (docKey === null) {
          undocumented.push(rel);
          continue;
        }
        docs.push({
          rel,
          docKey,
          findings: contract.validate({ docKey, path: rel, content, root: repo }),
        });
      }
    }
    return new JudgedCorpus(docs, undocumented);
  }

  /** The doc key a document's front-matter `doc-type:` declares (null when absent or
   *  outside the declared domain — such a file is not judged as a corpus doc). */
  private static docKeyOf(content: string): DocKey | null {
    const declared = FrontMatterExtractor.split(content).head.docType;
    return DOC_KEYS.find((key) => key === declared) ?? null;
  }

  /** The judged docs, in root-then-name order. */
  readonly docs: readonly JudgedDoc[];
  /** The corpus files whose front-matter declares no doc key. */
  readonly undocumented: readonly string[];

  private constructor(docs: readonly JudgedDoc[], undocumented: readonly string[]) {
    this.docs = docs;
    this.undocumented = undocumented;
  }

  /** The finding count per document of one rule kind (docs with zero are omitted). */
  countsOf(kind: string): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const doc of this.docs) {
      const hits = doc.findings.filter((finding) => finding.kind === kind).length;
      if (hits > 0) counts[doc.rel] = hits;
    }
    return counts;
  }

  /** The documents whose counts EXCEED their ceiling (`<file>: <count> > <ceiling>`), in
   *  path order — the failing document is named, never reduced to a bare count. */
  excessOver(kind: string, ceiling: Readonly<Record<string, number>>): readonly string[] {
    const counts = this.countsOf(kind);
    return Object.keys(counts)
      .sort()
      .filter((rel) => (counts[rel] ?? 0) > (ceiling[rel] ?? 0))
      .map((rel) => `${rel}: ${counts[rel]} > ${ceiling[rel] ?? 0}`);
  }

  /** The findings of one rule kind on one document. */
  findingsOn(rel: string, kind: string): readonly Finding[] {
    return (
      this.docs.find((doc) => doc.rel === rel)?.findings.filter((row) => row.kind === kind) ?? []
    );
  }
}

const CORPUS = JudgedCorpus.load(REPO);

describe("P30 T3 — the doc corpus's change-history lineage legs", () => {
  it("judges a non-empty corpus, and every corpus doc declares a doc key", () => {
    // Non-vacuity: an empty walk would make every pin below trivially green.
    expect(CORPUS.docs.length).toBeGreaterThan(0);
    expect(CORPUS.undocumented).toEqual([]);
    // Per-root non-vacuity: each of the three declared roots must contribute at least
    // one judged doc, so a root that silently empties out cannot leave its lineage legs
    // unpinned while the global count still reads non-zero.
    for (const dir of Object.values(ENGINE_DOC_ROOTS)) {
      expect(
        CORPUS.docs.filter((doc) => doc.rel.startsWith(`${dir}/`)).length,
        `${dir} contributed no judged doc`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the program's own spec and plan clean on both new legs", () => {
    for (const rel of PROGRAM_DOCS) {
      expect(
        CORPUS.docs.some((doc) => doc.rel === rel),
        rel,
      ).toBe(true);
      expect(CORPUS.findingsOn(rel, "change-history-row-shape"), rel).toEqual([]);
      expect(CORPUS.findingsOn(rel, "change-history-latest-matches-front-matter"), rel).toEqual([]);
      expect(CORPUS.findingsOn(rel, "change-history-version-unique"), rel).toEqual([]);
    }
  });

  for (const kind of PINNED_KINDS) {
    it(`keeps ${kind} within its recorded ceiling`, () => {
      expect(CORPUS.excessOver(kind, DRIFT_CEILING[kind])).toEqual([]);
    });
  }
});
