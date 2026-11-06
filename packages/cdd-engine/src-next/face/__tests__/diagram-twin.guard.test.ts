// packages/cdd-engine/src-next/face/__tests__/diagram-twin.guard.test.ts
// P26 T2 (#418) — the six-source diagram twin gate. The diagram plane ships six
// sources (architecture / journey / next-loop, each en + zh-CN) and until now each
// pair was only half-pinned: `journey` had no pin at all, `next-loop` had no HTML leg,
// so "edit the source, never regenerate" was invisible. This gate gives every source
// the SAME three legs:
//   · the citation twin — every node's `sources[]` (path, line, end_line) must equal
//     the artifact's embedded `archify-source-evidence-data` references
//     (path, line, endLine) as a MULTISET (a duplicate reference is still a
//     reference), with `referenceCount` equal to that count and the artifact's
//     `repository.revision` equal to the source's pin;
//   · the copy twin — every node `label` / `sublabel` / `tag`, every card `title` and
//     every card `items[]` entry appears in the artifact (HTML-escaped), so a source
//     edit without a regeneration turns red;
//   · the artifact identity — `meta.output` names the artifact this gate read.
// The three `diagram_type` roots (architecture → `components`, lifecycle → `states`,
// workflow → `nodes`) share ONE normalization; the six sources cover all three, so a
// gate hard-wired to `components` cannot silently pass.
//
// Reverse injections (spec acceptance 5) are asserted against IN-MEMORY copies — a
// mutated source object or a mutated evidence block re-parsed through the same
// `DiagramTwin` — never against the working tree: the gate is read-only by
// construction, and `docs/diagrams/*.html` stays untouchable (no hand-edited
// artifact, no restore dance).
//
// Rule zero (over the 200-line class/limit): the reader stays one class because every
// leg is a pure projection of the SAME (source, artifact) pair.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));

/** One `sources[]` citation as a source file writes it. */
interface SourceCitation {
  readonly path: string;
  readonly line: number;
  readonly end_line: number;
}

/** One diagram node as far as this gate reads it. */
interface SourceNode {
  readonly id: string;
  readonly label?: string;
  readonly sublabel?: string;
  readonly tag?: string;
  readonly sources?: readonly SourceCitation[];
}

/** One summary card as far as this gate reads it. */
interface SourceCard {
  readonly title: string;
  readonly items?: readonly string[];
}

/** One diagram source — the three roots are read by `diagram_type`. */
interface DiagramSourceDoc {
  readonly diagram_type: string;
  readonly meta: { readonly output: string; readonly repository: { readonly revision: string } };
  readonly components?: readonly SourceNode[];
  readonly states?: readonly SourceNode[];
  readonly nodes?: readonly SourceNode[];
  readonly cards?: readonly SourceCard[];
}

/** One embedded evidence citation as the artifact writes it. */
interface EvidenceCitation {
  readonly path: string;
  readonly line: number;
  readonly endLine: number;
}

/** The artifact's embedded `archify-source-evidence-data` block. */
interface EvidenceDoc {
  readonly repository: { readonly revision: string };
  readonly referenceCount: number;
  readonly nodes: Readonly<Record<string, readonly EvidenceCitation[]>>;
}

/** One flattened reference — the shared shape both sides normalize onto. */
type Reference = readonly [path: string, line: number, end: number];

const EVIDENCE_SCRIPT =
  /<script id="archify-source-evidence-data" type="application\/json">([\s\S]*?)<\/script>/;

/**
 * DiagramTwin — one (source, artifact) pair judged on the three legs. Pure reads:
 * every assertion method returns the mismatches it found, and its message carries the
 * leg token (`revision:` / `reference:` / `copy:` / `card-title:`) so a failure names
 * the leg that broke.
 */
class DiagramTwin {
  /** The source's structural root per `diagram_type` — one normalization, three roots. */
  static readonly ROOT_BY_TYPE: Readonly<Record<string, "components" | "states" | "nodes">> = {
    architecture: "components",
    lifecycle: "states",
    workflow: "nodes",
  };

  /** The six shipped sources — every diagram this repo draws. */
  static readonly SOURCES = [
    "docs/diagrams/src/architecture.en.json",
    "docs/diagrams/src/architecture.zh-CN.json",
    "docs/diagrams/src/journey.en.json",
    "docs/diagrams/src/journey.zh-CN.json",
    "docs/diagrams/src/next-loop.en.json",
    "docs/diagrams/src/next-loop.zh-CN.json",
  ] as const;

  readonly #source: DiagramSourceDoc;
  readonly #html: string;
  readonly #evidence: EvidenceDoc | null;

  private constructor(source: DiagramSourceDoc, html: string) {
    this.#source = source;
    this.#html = html;
    this.#evidence = DiagramTwin.#evidenceOf(html);
  }

  /** Read one shipped source and the artifact its `meta.output` names. */
  static of(rel: string): DiagramTwin {
    const source = JSON.parse(readFileSync(`${REPO}${rel}`, "utf8")) as DiagramSourceDoc;
    return new DiagramTwin(source, readFileSync(`${REPO}${source.meta.output}`, "utf8"));
  }

  /** Pair an in-memory source copy with an artifact — the reverse-injection entry. */
  static withSource(source: DiagramSourceDoc, html: string): DiagramTwin {
    return new DiagramTwin(source, html);
  }

  /** The artifact path the source declares (the artifact-identity leg). */
  get output(): string {
    return this.#source.meta.output;
  }

  /** The declared diagram type — the root this pair normalizes through. */
  get diagramType(): string {
    return this.#source.diagram_type;
  }

  /** The artifact's own text (the copy leg reads it). */
  get html(): string {
    return this.#html;
  }

  /** The revision pair — source pin vs the artifact's embedded revision. */
  revisionMismatches(): string[] {
    const pinned = this.#source.meta.repository.revision;
    const embedded = this.#evidence?.repository.revision ?? "<no evidence block>";
    return pinned === embedded ? [] : [`revision: source ${pinned} ≠ artifact ${embedded}`];
  }

  /** The citation twin as a multiset comparison, plus the artifact's `referenceCount`. */
  referenceMismatches(): string[] {
    const evidence = this.#evidence;
    if (evidence === null) return ["reference: the artifact carries no evidence block"];
    const expected = this.#sourceReferences();
    const actual = this.#artifactReferences(evidence);
    const out: string[] = [];
    const keys = new Set([...expected, ...actual].map((ref) => DiagramTwin.#keyOf(ref)));
    for (const key of keys) {
      const want = expected.filter((ref) => DiagramTwin.#keyOf(ref) === key).length;
      const got = actual.filter((ref) => DiagramTwin.#keyOf(ref) === key).length;
      if (want !== got) out.push(`reference: source ${want}× vs artifact ${got}× ${key}`);
    }
    if (evidence.referenceCount !== actual.length) {
      out.push(
        `reference: referenceCount ${evidence.referenceCount} ≠ ${actual.length} embedded references`,
      );
    }
    return out;
  }

  /** The copy twin — every source string must appear in the artifact, escaped or raw. */
  copyMismatches(): string[] {
    const out: string[] = [];
    for (const node of this.#nodes()) {
      for (const [field, value] of [
        ["label", node.label],
        ["sublabel", node.sublabel],
        ["tag", node.tag],
      ] as const) {
        if (!value) continue;
        if (!this.#carries(value)) out.push(`copy: ${node.id} ${field} "${value}" is absent`);
      }
    }
    for (const card of this.#source.cards ?? []) {
      if (!this.#carries(card.title)) out.push(`card-title: "${card.title}" is absent`);
      for (const item of card.items ?? []) {
        if (!item) continue;
        if (!this.#carries(item)) out.push(`copy: card "${card.title}" item "${item}" is absent`);
      }
    }
    return out;
  }

  /** Every card title the source declares — the card-title leg's own list. */
  cardTitles(): readonly string[] {
    return (this.#source.cards ?? []).map((card) => card.title);
  }

  /** The source's nodes under its `diagram_type` root (never a hard-wired `components`). */
  #nodes(): readonly SourceNode[] {
    const root = DiagramTwin.ROOT_BY_TYPE[this.#source.diagram_type];
    if (root === undefined) throw new Error(`unknown diagram_type "${this.#source.diagram_type}"`);
    return this.#source[root] ?? [];
  }

  /** The source-side references, every node's `sources[]` flattened. */
  #sourceReferences(): Reference[] {
    return this.#nodes().flatMap((node) =>
      (node.sources ?? []).map((cited): Reference => [cited.path, cited.line, cited.end_line]),
    );
  }

  /** The artifact-side references, every evidence-node array flattened. */
  #artifactReferences(evidence: EvidenceDoc): Reference[] {
    return Object.values(evidence.nodes).flatMap((citations) =>
      citations.map((cited): Reference => [cited.path, cited.line, cited.endLine]),
    );
  }

  /** Whether the artifact carries a string, raw or HTML-escaped (archify escapes `'`). */
  #carries(text: string): boolean {
    return this.#html.includes(text) || this.#html.includes(DiagramTwin.#escaped(text));
  }

  /** The reference multiset key — path plus its inclusive line span. */
  static #keyOf(reference: Reference): string {
    return `${reference[0]}:${reference[1]}-${reference[2]}`;
  }

  /** The artifact's embedded evidence block, or null when the artifact carries none. */
  static #evidenceOf(html: string): EvidenceDoc | null {
    const script = EVIDENCE_SCRIPT.exec(html);
    return script === null ? null : (JSON.parse(script[1]) as EvidenceDoc);
  }

  /** One string as an HTML text node — the artifact's own escaping (`'` → `&#39;`). */
  static #escaped(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

/** One artifact with its evidence block rewritten — the reference-leg injection. */
const withEvidence = (
  twin: DiagramTwin,
  mutate: (evidence: EvidenceDoc) => EvidenceDoc,
): string => {
  const script = EVIDENCE_SCRIPT.exec(twin.html);
  if (script === null) throw new Error("the artifact carries no evidence block");
  const rewritten = JSON.stringify(mutate(JSON.parse(script[1]) as EvidenceDoc));
  return twin.html.replace(
    EVIDENCE_SCRIPT,
    () => `<script id="archify-source-evidence-data" type="application/json">${rewritten}</script>`,
  );
};

/** The source document behind one shipped twin — the reverse-injection base copy. */
const sourceOf = (rel: string): DiagramSourceDoc =>
  JSON.parse(readFileSync(`${REPO}${rel}`, "utf8")) as DiagramSourceDoc;

/** One node list copy with the first node's field replaced — the copy-leg injection. */
const withSublabel = (
  source: DiagramSourceDoc,
  root: "components" | "states" | "nodes",
): DiagramSourceDoc => {
  const nodes = [...(source[root] ?? [])];
  const [first] = nodes;
  expect(first, "the source carries no node to mutate").toBeDefined();
  nodes[0] = { ...first, sublabel: "a sublabel that was never regenerated" };
  return { ...source, [root]: nodes };
};

const ARCHITECTURE = "docs/diagrams/src/architecture.en.json";

describe("the six diagram twins — citation, copy and revision legs (P26 T2)", () => {
  it("covers six sources and all three diagram_type roots", () => {
    const twins = DiagramTwin.SOURCES.map((rel) => DiagramTwin.of(rel));
    expect(twins.length).toBe(6);
    const types = [...new Set(twins.map((twin) => twin.diagramType))].sort();
    expect(types).toEqual(["architecture", "lifecycle", "workflow"]);
    for (const twin of twins)
      expect(Object.keys(DiagramTwin.ROOT_BY_TYPE)).toContain(twin.diagramType);
  });

  for (const rel of DiagramTwin.SOURCES) {
    describe(rel, () => {
      const twin = DiagramTwin.of(rel);

      it("names the artifact it was read from", () => {
        expect(twin.output).toBe(rel.replace("src/", "").replace(/\.json$/, ".html"));
      });

      it("pins the same revision on both sides", () => {
        expect(twin.revisionMismatches()).toEqual([]);
      });

      it("twins the citation multiset and its referenceCount", () => {
        expect(twin.referenceMismatches()).toEqual([]);
      });

      it("twins every label, sublabel, tag, card title and card item", () => {
        expect(twin.copyMismatches()).toEqual([]);
      });
    });
  }
});

describe("the twin legs go red when one side moves (reverse injection)", () => {
  it("a hand-edited artifact reference turns the citation leg red (and only that leg)", () => {
    const twin = DiagramTwin.of(ARCHITECTURE);
    const html = withEvidence(twin, (evidence) => {
      const [first] = Object.keys(evidence.nodes);
      const [cited] = evidence.nodes[first];
      return {
        ...evidence,
        nodes: {
          ...evidence.nodes,
          [first]: [{ ...cited, line: cited.line + 1 }, ...evidence.nodes[first].slice(1)],
        },
      };
    });
    const drifted = DiagramTwin.withSource(sourceOf(ARCHITECTURE), html);
    const references = drifted.referenceMismatches();
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((message) => message.startsWith("reference:"))).toBe(true);
    expect(drifted.revisionMismatches()).toEqual([]);
    expect(drifted.copyMismatches()).toEqual([]);
  });

  it("a source sublabel edit without a regeneration turns the copy leg red", () => {
    const twin = DiagramTwin.of(ARCHITECTURE);
    const drifted = DiagramTwin.withSource(
      withSublabel(sourceOf(ARCHITECTURE), "components"),
      twin.html,
    );
    const copy = drifted.copyMismatches();
    expect(
      copy.some((message) => message.startsWith("copy:") && message.includes("never regenerated")),
    ).toBe(true);
    expect(drifted.referenceMismatches()).toEqual([]);
    expect(drifted.cardTitles()).toEqual(twin.cardTitles());
  });

  it("a card-title edit without a regeneration turns the card-title leg red", () => {
    const twin = DiagramTwin.of(ARCHITECTURE);
    const source = sourceOf(ARCHITECTURE);
    const cards = [...(source.cards ?? [])];
    cards[0] = { ...cards[0], title: "A title that was never regenerated" };
    const drifted = DiagramTwin.withSource({ ...source, cards }, twin.html);
    const copy = drifted.copyMismatches();
    expect(copy.some((message) => message.startsWith("card-title:"))).toBe(true);
    // the items leg stays green for every card whose title did not move
    expect(copy.filter((message) => message.startsWith("copy:"))).toEqual([]);
    expect(drifted.referenceMismatches()).toEqual([]);
  });
});
