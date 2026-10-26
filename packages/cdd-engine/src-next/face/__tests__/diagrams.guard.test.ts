// packages/cdd-engine/src-next/face/__tests__/diagrams.guard.test.ts
// The architecture-diagram pin — the diagram is a consumer surface, and no validation
// step reads it (`.github/workflows/static.yml` only uploads the directory), so this
// gate is what keeps the picture honest:
//   · the command surface — both source JSONs tag the engine node with the eight-command
//     count AND state it in the Execution card's first line, with zero residue of the
//     retired seven-command spellings. A tag saying eight next to prose saying "runs
//     seven commands" would otherwise reach consumers silently, because nothing else
//     reads either string;
//   · the citations — the three evidence anchors (`upstream` / `host` / `engine`) point
//     INSIDE the declaration they name, and the cited span really contains that
//     identifier. This judgment lives here rather than in the Archify finalize pass,
//     which only verifies that a cited range EXISTS — a stale range still exists after
//     the declaration it used to name moved away;
//   · the generated artifacts — both HTMLs carry the eight-command surface and no
//     seven-command residue, so editing a source without regenerating (or hand-editing
//     an artifact) fails here.
// Domicile: engine suite (the cross-plane read precedent: the gate reads the diagram
// plane, the way the retired `install-rows.guard.test.ts` read the README plane).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));

const read = (rel: string): string => readFileSync(`${REPO}${rel}`, "utf8");

/** One `sources` citation — the evidence span of a diagram node. */
interface DiagramCitation {
  readonly path: string;
  readonly line: number;
  readonly end_line: number;
}

/** One diagram node as far as this gate reads it. */
interface DiagramComponent {
  readonly id: string;
  readonly tag?: string;
  readonly sources: readonly DiagramCitation[];
}

/** One summary card as far as this gate reads it. */
interface DiagramCard {
  readonly title: string;
  readonly items: readonly string[];
}

/** The parts of an Archify architecture source this gate pins. */
interface DiagramSource {
  readonly components: readonly DiagramComponent[];
  readonly cards: readonly DiagramCard[];
}

/** One language's pins — the count wording in both places it is written, the card the
 *  detail line rides, and the artifact that must carry the same surface. */
interface DiagramPin {
  readonly tag: string;
  readonly detail: string;
  readonly card: string;
  readonly html: string;
  readonly retiredTag: string;
}

const SOURCES: Readonly<Record<string, DiagramPin>> = {
  "docs/diagrams/src/architecture.en.json": {
    tag: "8 commands",
    detail: "eight commands",
    card: "Execution",
    html: "docs/diagrams/architecture.en.html",
    retiredTag: "7 commands",
  },
  "docs/diagrams/src/architecture.zh-CN.json": {
    tag: "8 条命令",
    detail: "八条命令",
    card: "执行",
    html: "docs/diagrams/architecture.zh-CN.html",
    retiredTag: "7 条命令",
  },
};

/** The retired seven-command spellings — the English `seven` form is included because
 *  the tag alone cannot catch it: a tag saying 8 with a body saying "runs seven
 *  commands" is a two-voice surface no other check reads. */
const RETIRED_SPELLINGS = [
  "7 commands",
  "7 条命令",
  "七条命令",
  "seven commands",
  "runs seven",
  "七条",
];

/** One evidence citation's home declaration — the node id, the file it cites, the
 *  opening/closing line patterns of the named declaration, and the identifier the
 *  cited span must contain. */
interface CitationPin {
  readonly node: string;
  readonly path: string;
  readonly anchor: RegExp;
  readonly close: RegExp;
  readonly identifier: string;
}

const CITATIONS: readonly CitationPin[] = [
  {
    node: "upstream",
    path: "packages/cdd-engine/src-next/face/plugins.ts",
    anchor: /^export const PLUGINS = \[$/,
    close: /^\] as const satisfies readonly PluginRow\[\];$/,
    identifier: "PLUGINS",
  },
  {
    node: "host",
    path: "packages/cdd-engine/src-next/face/host.ts",
    anchor: /^export const HOSTS = \{$/,
    close: /^\} as const satisfies Readonly<Record<HostId, HostRow>>;$/,
    identifier: "HOSTS",
  },
  {
    node: "engine",
    path: "packages/cdd-engine/src-next/face/cli.ts",
    anchor: /^ {4}commandNode\("init"\)\.action\(/,
    close: /^ {4}\}\);$/,
    identifier: 'commandNode("init")',
  },
];

/** The 1-based inclusive line span of the declaration opening at `anchor` and closing
 *  at the next `close` line — derived from the file text, never hand-copied, so the
 *  citation pins below cannot drift with the source. */
const blockSpan = (rel: string, anchor: RegExp, close: RegExp): { start: number; stop: number } => {
  const lines = read(rel).split("\n");
  const start = lines.findIndex((line) => anchor.test(line));
  expect(start !== -1, `${rel}: the declaration opening ${anchor} is missing`).toBeTruthy();
  const stop = lines.findIndex((line, index) => index > start && close.test(line));
  expect(stop !== -1, `${rel}: the declaration closing ${close} is missing`).toBeTruthy();
  return { start: start + 1, stop: stop + 1 };
};

/** The engine node of one source — the node whose tag carries the command count. */
const engineNode = (source: DiagramSource): DiagramComponent => {
  const node = source.components.find((component) => component.id === "engine");
  expect(node, "the engine node is missing from the diagram source").toBeTruthy();
  return node!;
};

/** The first item of the named summary card — where the `:251` detail line lives. */
const cardLead = (source: DiagramSource, title: string): string => {
  const card = source.cards.find((entry) => entry.title === title);
  expect(card, `the summary card "${title}" is missing from the diagram source`).toBeTruthy();
  const lead = card!.items[0];
  expect(lead, `the summary card "${title}" carries no first item`).toBeTruthy();
  return lead!;
};

for (const [rel, pin] of Object.entries(SOURCES)) {
  describe(`architecture diagram: ${rel}`, () => {
    const text = read(rel);
    const source = JSON.parse(text) as DiagramSource;

    it("tags the engine node with the eight-command count", () => {
      expect(engineNode(source).tag, `${rel}: the engine node tag drifted`).toBe(pin.tag);
    });

    it("states the eight-command surface in the execution card's first line", () => {
      const lead = cardLead(source, pin.card);
      expect(lead, `${rel}: the execution card must state the eight-command surface`).toContain(
        pin.detail,
      );
      expect(lead, `${rel}: the execution card must enumerate the bootstrap command`).toContain(
        "init",
      );
      for (const retired of RETIRED_SPELLINGS) {
        expect(lead.includes(retired), `${rel}: "${retired}" survives in the execution card`).toBe(
          false,
        );
      }
    });

    it("carries zero residue of the retired seven-command spellings", () => {
      for (const retired of RETIRED_SPELLINGS) {
        expect(text.includes(retired), `${rel}: "${retired}" survives in the diagram source`).toBe(
          false,
        );
      }
    });

    it("anchors the evidence citations inside the declarations they name", () => {
      for (const citation of CITATIONS) {
        const node = source.components.find((component) => component.id === citation.node);
        expect(node, `${rel}: the "${citation.node}" node is missing`).toBeTruthy();
        const cited = node!.sources[0];
        expect(cited, `${rel}: the "${citation.node}" node carries no citation`).toBeTruthy();
        expect(cited!.path, `${rel}: the "${citation.node}" node cites the wrong file`).toBe(
          citation.path,
        );
        const span = blockSpan(citation.path, citation.anchor, citation.close);
        expect(
          cited!.line >= span.start && cited!.end_line <= span.stop,
          `${rel}: the "${citation.node}" citation ${cited!.line}..${cited!.end_line} must fall inside ${citation.path}:${span.start}-${span.stop}`,
        ).toBe(true);
        const citedText = read(citation.path)
          .split("\n")
          .slice(cited!.line - 1, cited!.end_line)
          .join("\n");
        expect(
          citedText.includes(citation.identifier),
          `${rel}: the "${citation.node}" citation must contain ${citation.identifier}`,
        ).toBe(true);
      }
    });

    it("regenerates the artifact with the eight-command surface and no residue", () => {
      const html = read(pin.html);
      expect(html.includes(pin.tag), `${pin.html}: the artifact must carry "${pin.tag}"`).toBe(
        true,
      );
      expect(
        html.includes(pin.retiredTag),
        `${pin.html}: the artifact must not carry "${pin.retiredTag}" — regenerate, never hand-edit`,
      ).toBe(false);
    });
  });
}
