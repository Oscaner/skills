// packages/cdd-engine/src-next/face/__tests__/diagram-twin.guard.test.ts
// The twin legs' own pins — the three legs a (source, artifact) pair is judged on:
//   · the citation twin — every node's `sources[]` (path, line, end_line) must equal
//     the artifact's embedded `archify-source-evidence-data` references
//     (path, line, endLine) as a MULTISET (a duplicate reference is still a
//     reference), with `referenceCount` equal to that count and the artifact's
//     `repository.revision` equal to the source's pin;
//   · the copy twin — every node `label` / `sublabel` / `tag`, every card `title` and
//     every card `items[]` entry appears in the artifact (HTML-escaped), so a source
//     edit without a regeneration turns red;
//   · the repair path (P28 T2) — every leg's red means the same thing: the source moved
//     and the artifact did not follow, so every mismatch string ends with `pnpm run
//     emit`. The semantic gate (`diagrams.guard.test.ts`) deliberately carries no such
//     suffix: there the source itself is wrong.
//
// The shipped six sources against their rendered artifacts are NOT read here. That
// judgment belongs to `scripts/lib/diagrams.ts#DiagramTwins`, executed by
// `pnpm run emit:check`: a byte comparison of a committed artifact with a re-render of
// the same source cannot see a dropped tag, citation or copy cell, so the reading moved
// to the one face that judges source against a fresh render. Every arm below pairs an
// IN-MEMORY source with an IN-MEMORY artifact — never `docs/diagrams/*.html`, which is
// a committed product and stays untouchable (no hand-edited artifact, no restore dance).
//
// Rule zero (over the 200-line class/limit): the reader stays one class because every
// leg is a pure projection of the SAME (source, artifact) pair.

import { describe, expect, it } from "vitest";

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

/** One diagram source — the three roots are read by `diagram_type`. The artifact name is
 *  NOT declared here: these arms pair in-memory copies, so no artifact path is read. */
interface DiagramSourceDoc {
  readonly diagram_type: string;
  readonly meta: { readonly repository: { readonly revision: string } };
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
 * every assertion method returns the mismatches it found, and each message carries the
 * leg token (`revision:` / `reference:` / `copy:` / `card-title:`) so a failure names
 * the leg that broke, then closes with `REPAIR_HINT` — the repair is one command.
 */
class DiagramTwin {
  /** The repair suffix every mismatch ends with — see `#withRepair`. */
  static readonly REPAIR_HINT = "— regenerate: pnpm run emit";

  /** The source's structural root per `diagram_type` — one normalization, three roots. */
  static readonly ROOT_BY_TYPE: Readonly<Record<string, "components" | "states" | "nodes">> = {
    architecture: "components",
    lifecycle: "states",
    workflow: "nodes",
  };

  readonly #source: DiagramSourceDoc;
  readonly #html: string;
  readonly #evidence: EvidenceDoc | null;

  private constructor(source: DiagramSourceDoc, html: string) {
    this.#source = source;
    this.#html = html;
    this.#evidence = DiagramTwin.#evidenceOf(html);
  }

  /** Pair an in-memory source copy with an in-memory artifact — the ONE entry point. */
  static withSource(source: DiagramSourceDoc, html: string): DiagramTwin {
    return new DiagramTwin(source, html);
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
    return pinned === embedded
      ? []
      : this.#withRepair([`revision: source ${pinned} ≠ artifact ${embedded}`]);
  }

  /** The citation twin as a multiset comparison, plus the artifact's `referenceCount`. */
  referenceMismatches(): string[] {
    const evidence = this.#evidence;
    if (evidence === null)
      return this.#withRepair(["reference: the artifact carries no evidence block"]);
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
    return this.#withRepair(out);
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
    return this.#withRepair(out);
  }

  /** The repair suffix, appended once per mismatch: a twin red always means the source
   *  moved and the artifact did not follow, and `emit` is the repair that needs no
   *  extra install. One wording for all three legs. */
  #withRepair(mismatches: readonly string[]): string[] {
    return mismatches.map((message) => `${message} ${DiagramTwin.REPAIR_HINT}`);
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

/** The repair suffix every twin mismatch ends with — one wording for all three legs. */
const REPAIR_HINT = "— regenerate: pnpm run emit";

/** One in-memory source — the copy cells cover all three fields, a card, an item and an
 *  apostrophe (so the escaped-or-raw judgment has both branches). */
const FIXTURE_SOURCE: DiagramSourceDoc = {
  diagram_type: "architecture",
  meta: { repository: { revision: "a".repeat(40) } },
  components: [
    {
      id: "engine",
      label: "Engine",
      sublabel: "one dispatch",
      tag: "8 commands",
      sources: [{ path: "packages/cdd-engine/src-next/bin.ts", line: 1, end_line: 9 }],
    },
  ],
  cards: [{ title: "Execution", items: ["the engine's own judgment"] }],
};

/** One string as the artifact writes a text node. */
const escapeOf = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** The artifact one in-memory source renders to: its copy cells as escaped text nodes
 *  plus one evidence block carrying the same citations and the same revision pin. */
const artifactOf = (source: DiagramSourceDoc): string => {
  const nodes = [...(source.components ?? []), ...(source.states ?? []), ...(source.nodes ?? [])];
  const copy = nodes.flatMap((node) => [node.label, node.sublabel, node.tag]);
  const cards = (source.cards ?? []).flatMap((card) => [card.title, ...(card.items ?? [])]);
  const references = nodes.flatMap((node) =>
    (node.sources ?? []).map((cited) => ({
      path: cited.path,
      line: cited.line,
      endLine: cited.end_line,
    })),
  );
  const evidence: EvidenceDoc = {
    repository: source.meta.repository,
    referenceCount: references.length,
    nodes: { [nodes[0]?.id ?? "node"]: references },
  };
  return [
    "<!doctype html><html><body>",
    ...[...copy, ...cards]
      .filter((text): text is string => typeof text === "string")
      .map((text) => `<span>${escapeOf(text)}</span>`),
    `<script id="archify-source-evidence-data" type="application/json">${JSON.stringify(evidence)}</script>`,
    "</body></html>",
    "",
  ].join("\n");
};

/** One artifact with its evidence block rewritten — the reference- and revision-leg
 *  injection. */
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

/** One node list copy with the first node's field replaced — the copy-leg injection. */
const withNodeField = (
  source: DiagramSourceDoc,
  root: "components" | "states" | "nodes",
  field: "sublabel",
  value: string,
): DiagramSourceDoc => {
  const nodes = [...(source[root] ?? [])];
  const [first] = nodes;
  expect(first, "the source carries no node to mutate").toBeDefined();
  nodes[0] = { ...first, [field]: value };
  return { ...source, [root]: nodes };
};

/** The faithful pair's baseline — one source, one artifact rendered from it. */
const twinOf = (source: DiagramSourceDoc = FIXTURE_SOURCE): DiagramTwin =>
  DiagramTwin.withSource(source, artifactOf(source));

describe("a faithful pair keeps every leg silent", () => {
  it("pairs the in-memory source with its own rendering — three legs, zero mismatches", () => {
    const twin = twinOf();
    expect(twin.diagramType).toBe("architecture");
    expect(twin.revisionMismatches()).toEqual([]);
    expect(twin.referenceMismatches()).toEqual([]);
    expect(twin.copyMismatches()).toEqual([]);
    expect(twin.cardTitles()).toEqual(["Execution"]);
  });
});

describe("the twin legs go red when one side moves (reverse injection)", () => {
  it("a drifted artifact reference turns the citation leg red (and only that leg)", () => {
    const twin = twinOf();
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
    const drifted = DiagramTwin.withSource(FIXTURE_SOURCE, html);
    const references = drifted.referenceMismatches();
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((message) => message.startsWith("reference:"))).toBe(true);
    expect(references.every((message) => message.endsWith(REPAIR_HINT))).toBe(true);
    expect(drifted.revisionMismatches()).toEqual([]);
    expect(drifted.copyMismatches()).toEqual([]);
  });

  it("a source revision pin without a regeneration names the repair", () => {
    const twin = twinOf();
    const html = withEvidence(twin, (evidence) => ({
      ...evidence,
      repository: { revision: "0".repeat(40) },
    }));
    const drifted = DiagramTwin.withSource(FIXTURE_SOURCE, html);
    const revisions = drifted.revisionMismatches();
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions.every((message) => message.startsWith("revision:"))).toBe(true);
    expect(revisions.every((message) => message.endsWith(REPAIR_HINT))).toBe(true);
    expect(drifted.copyMismatches()).toEqual([]);
  });

  it("a source sublabel edit without a regeneration turns the copy leg red", () => {
    const twin = twinOf();
    const drifted = DiagramTwin.withSource(
      withNodeField(
        FIXTURE_SOURCE,
        "components",
        "sublabel",
        "a sublabel that was never regenerated",
      ),
      twin.html,
    );
    const copy = drifted.copyMismatches();
    expect(
      copy.some((message) => message.startsWith("copy:") && message.includes("never regenerated")),
    ).toBe(true);
    expect(copy.every((message) => message.endsWith(REPAIR_HINT))).toBe(true);
    expect(drifted.referenceMismatches()).toEqual([]);
    expect(drifted.cardTitles()).toEqual(twin.cardTitles());
  });

  it("a card-title edit without a regeneration turns the card-title leg red", () => {
    const twin = twinOf();
    const cards = [...(FIXTURE_SOURCE.cards ?? [])];
    cards[0] = { ...cards[0], title: "A title that was never regenerated" };
    const drifted = DiagramTwin.withSource({ ...FIXTURE_SOURCE, cards }, twin.html);
    const copy = drifted.copyMismatches();
    expect(copy.some((message) => message.startsWith("card-title:"))).toBe(true);
    expect(copy.every((message) => message.endsWith(REPAIR_HINT))).toBe(true);
    // the items leg stays green for every card whose title did not move
    expect(copy.filter((message) => message.startsWith("copy:"))).toEqual([]);
    expect(drifted.referenceMismatches()).toEqual([]);
  });

  it("drops the evidence block — the citation leg reads an absent candidate, not a pass", () => {
    const twin = twinOf();
    const drifted = DiagramTwin.withSource(
      FIXTURE_SOURCE,
      twin.html.replace(EVIDENCE_SCRIPT, "<p>no evidence</p>"),
    );
    expect(drifted.referenceMismatches()).toEqual([
      `reference: the artifact carries no evidence block ${REPAIR_HINT}`,
    ]);
    expect(drifted.revisionMismatches().length).toBeGreaterThan(0);
  });
});
