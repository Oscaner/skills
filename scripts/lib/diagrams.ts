// scripts/lib/diagrams.ts — the diagram regeneration plane. The product list is
// DERIVED from `docs/diagrams/src/*.json` (each source declares its own
// `diagram_type` / `meta.output` / `meta.quality_profile`), so the emit carries zero
// mapping table: adding or removing a diagram touches the source and nothing here.
// The renderer is injected (the default spawns the pinned Archify bin directly through
// `process.execPath` — never PATH, never a shell shim), so a pin can stub the real
// process. The write-back is ALL OR NOTHING: every artifact renders into a system temp
// directory first, and only a fully successful set reaches the output root — a half
// product set would rob the byte comparison of its ability to localize a drift.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";

/** The diagrams plane's source directory (repo-relative). */
export const DIAGRAM_SRC_DIR = "docs/diagrams/src";

/** The diagrams plane's artifact directory (repo-relative). */
export const DIAGRAM_OUT_DIR = "docs/diagrams";

/** The hand-written language switcher — never a product, never an orphan. */
export const DIAGRAM_HANDWRITTEN = `${DIAGRAM_OUT_DIR}/index.html`;

/** The pinned Archify entry point, relative to the repository root. */
const ARCHIFY_BIN = join("node_modules", "archify", "bin", "archify.mjs");

/** One diagram product — one source and the artifact it derives. */
export interface DiagramProduct {
  readonly type: string;
  readonly srcRel: string;
  readonly outRel: string;
  readonly quality: string;
}

/** One source of one emit pass, paired with the artifact the renderer staged for it —
 *  the pair the twin assertions judge (never a committed product: both sides come out
 *  of the same pass, so a byte comparison alone cannot see a dropped tag or citation). */
export interface DiagramRendering {
  readonly srcRel: string;
  readonly outRel: string;
  readonly content: string;
}

/** What a renderer is handed: the derived product plus the resolved absolute paths. */
export interface DiagramRenderRequest {
  readonly type: string;
  readonly srcRel: string;
  readonly srcAbs: string;
  readonly outAbs: string;
  readonly quality: string;
  readonly repoRoot: string;
}

/** The injected renderer — the one seam a pin stubs. */
export type DiagramRenderer = (request: DiagramRenderRequest) => void;

/** The injected write-back — the emit orchestrator binds this to `EmitService.writeText`
 *  so the whole product set shares ONE record face. */
export type DiagramWriter = (
  outRoot: string,
  rel: string,
  content: string,
  generatedPaths: string[],
) => void;

/**
 * DiagramProducts — the derivation + render + write-back of the diagram artifacts.
 * Construct once per repository root; the two collaborators default to the real
 * renderer and the plain file writer, so a test injects only what it stubs.
 */
export class DiagramProducts {
  private readonly repoRoot: string;
  private readonly render: DiagramRenderer;
  private readonly write: DiagramWriter;

  constructor(
    repoRoot: string,
    dependencies: { render?: DiagramRenderer; write?: DiagramWriter } = {},
  ) {
    this.repoRoot = repoRoot;
    this.render = dependencies.render ?? DiagramProducts.spawnRenderer;
    this.write = dependencies.write ?? DiagramProducts.fileWriter;
  }

  /** The product list derived from the sources — sorted by source file name. */
  list(): DiagramProduct[] {
    const dir = join(this.repoRoot, DIAGRAM_SRC_DIR);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => this.readProduct(name));
  }

  /** Render every product, write the complete set into `outRoot`, and hand the staged
   *  pairs back: one render feeds both the write-back and the twin assertions, so the
   *  judged artifact is exactly the artifact that was written. A failing render (or a
   *  missing bin) throws before the first write. */
  emit(outRoot: string, generatedPaths: string[]): readonly DiagramRendering[] {
    const staged = this.stageAll();
    for (const { outRel, content } of staged) this.write(outRoot, outRel, content, generatedPaths);
    return staged;
  }

  /** The orphan walk — artifact html the derivation no longer produces. */
  orphanHtml(root: string, generatedOutRels: Iterable<string>): string[] {
    const dir = join(root, DIAGRAM_OUT_DIR);
    if (!existsSync(dir)) return [];
    const generated = new Set(generatedOutRels);
    return readdirSync(dir)
      .filter((name) => name.endsWith(".html"))
      .map((name) => posix.join(DIAGRAM_OUT_DIR, name))
      .filter((rel) => rel !== DIAGRAM_HANDWRITTEN && !generated.has(rel))
      .sort();
  }

  /** One source's product face — the derivation, never a mapping table. */
  private readProduct(name: string): DiagramProduct {
    const srcRel = posix.join(DIAGRAM_SRC_DIR, name);
    const doc = JSON.parse(readFileSync(join(this.repoRoot, srcRel), "utf8")) as {
      diagram_type?: string;
      meta?: { output?: string; quality_profile?: string };
    };
    const { diagram_type: type, meta } = doc;
    if (type === undefined || meta?.output === undefined || meta.quality_profile === undefined) {
      throw new Error(
        `${srcRel}: each diagram source must declare diagram_type + meta.output + meta.quality_profile`,
      );
    }
    return { type, srcRel, outRel: posix.normalize(meta.output), quality: meta.quality_profile };
  }

  /** Render the whole set into a throwaway staging root and read it back. */
  private stageAll(): readonly DiagramRendering[] {
    const products = this.list();
    const staging = mkdtempSync(join(tmpdir(), "diagrams-emit-"));
    try {
      return products.map((product) => {
        const outAbs = join(staging, product.outRel);
        mkdirSync(dirname(outAbs), { recursive: true });
        this.render({
          type: product.type,
          srcRel: product.srcRel,
          srcAbs: join(this.repoRoot, product.srcRel),
          outAbs,
          quality: product.quality,
          repoRoot: this.repoRoot,
        });
        return {
          srcRel: product.srcRel,
          outRel: product.outRel,
          content: readFileSync(outAbs, "utf8"),
        };
      });
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }

  /** The default renderer — the pinned Archify bin through `process.execPath`. A
   *  missing bin (an uninstalled checkout) is a hard error: skipping it silently
   *  would strand the artifacts on their previous revision. */
  private static readonly spawnRenderer: DiagramRenderer = ({
    type,
    srcRel,
    srcAbs,
    outAbs,
    quality,
    repoRoot,
  }) => {
    const bin = join(repoRoot, ARCHIFY_BIN);
    if (!existsSync(bin)) throw new Error(`Archify missing — run pnpm install (expected ${bin})`);
    const result = spawnSync(
      process.execPath,
      [bin, "render", type, srcAbs, outAbs, "--quality", quality, "--repo-root", repoRoot],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      const stderr = (result.stderr ?? "").trim().split("\n").slice(-3).join(" ");
      throw new Error(`Diagram render failed for ${srcRel} (exit ${result.status}): ${stderr}`);
    }
  };

  /** The default write-back — the plain file writer (`EmitService.writeText`'s shape). */
  private static readonly fileWriter: DiagramWriter = (outRoot, rel, content, generatedPaths) => {
    const target = join(outRoot, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
    generatedPaths.push(rel);
  };
}

/** One `sources[]` citation as a diagram source writes it. */
interface SourceCitation {
  readonly path: string;
  readonly line: number;
  readonly end_line: number;
}

/** One diagram node — the copy cells and the citations the assertions read. */
interface SourceNode {
  readonly id: string;
  readonly label?: string;
  readonly sublabel?: string;
  readonly tag?: string;
  readonly sources?: readonly SourceCitation[];
}

/** One summary card. */
interface SourceCard {
  readonly title: string;
  readonly items?: readonly string[];
}

/** One diagram source document — the structural root is selected by `diagram_type`. */
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

/** One flattened reference — the shape both sides normalize onto. */
type Reference = readonly [path: string, line: number, end: number];

/** The artifact's one machine-readable carrier — the embedded evidence block. */
const EVIDENCE_SCRIPT =
  /<script id="archify-source-evidence-data" type="application\/json">([\s\S]*?)<\/script>/;

/** The declared structural root per `diagram_type` — one normalization, three roots. */
const ROOT_BY_TYPE: Readonly<Record<string, "components" | "states" | "nodes">> = {
  architecture: "components",
  lifecycle: "states",
  workflow: "nodes",
};

/** The retired seven-command spellings — the diagram surface states eight commands now.
 *  The English `seven` form is in the set because the tag alone cannot catch it: a tag
 *  saying eight beside a body saying "runs seven commands" is a two-voice surface. The
 *  table lives here beside the product derivation because its only reader is the render
 *  comparison — the source bytes are the engine semantic gate's subject, the rendered
 *  artifact is this module's. */
export const DIAGRAM_RETIRED_SPELLINGS: readonly string[] = [
  "7 commands",
  "7 条命令",
  "七条命令",
  "seven commands",
  "runs seven",
  "七条",
];

/**
 * DiagramTwins — the generation-consistency assertions over ONE emit pass. They used to
 * live in the engine suite and read the COMMITTED artifacts, which made a renderer that
 * drops a tag, a citation or a copy cell invisible: the byte comparison compares the
 * committed artifact with the re-render of the same source, so both sides move together.
 * Here every leg judges the source against the artifact the renderer just staged, and
 * `emit:check` is the one execution face.
 *
 * Five legs, each tagged with its own token in the message:
 *   · `tag:` — every node `tag` the source declares appears in that source's artifact
 *     (the node MARKER is the corresponding face; the execution card's first line
 *     carries `detail` prose, never the tag, and stays a source-content arm);
 *   · `retired-tag:` — no retired spelling survives in the rendering;
 *   · `revision:` — the source's `meta.repository.revision` equals the evidence block's
 *     `repository.revision`;
 *   · `reference:` — the source's citation multiset and the evidence block's
 *     `referenceCount` agree with the artifact's own references;
 *   · `copy:` / `card-title:` — every declared copy cell appears, verbatim or
 *     HTML-escaped (the artifact escapes `'` to `&#39;`, so presence is the judgment,
 *     never byte equality).
 *
 * Artifact naming and diagram-type coverage are NOT re-asserted here: `emit:check`'s
 * tree comparison catches an extra or renamed product, and `orphanHtml` catches html the
 * derivation no longer produces.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the twin assertions are a declared static judgment set — the repo's zero-bare-function discipline admits no standalone predicate.
export class DiagramTwins {
  /** Every leg's mismatches over one pass — empty when every source and its artifact
   *  agree. */
  static mismatchesOf(root: string, renderings: readonly DiagramRendering[]): readonly string[] {
    const out: string[] = [];
    for (const rendering of renderings) {
      const source = JSON.parse(
        readFileSync(join(root, rendering.srcRel), "utf8"),
      ) as DiagramSourceDoc;
      out.push(
        ...DiagramTwins.#tagMismatches(source, rendering),
        ...DiagramTwins.#retiredMismatches(rendering),
        ...DiagramTwins.#revisionMismatches(source, rendering),
        ...DiagramTwins.#referenceMismatches(source, rendering),
        ...DiagramTwins.#copyMismatches(source, rendering),
      );
    }
    return out;
  }

  /** The tag leg — the node marker the source declares must be ON the artifact. */
  static #tagMismatches(source: DiagramSourceDoc, rendering: DiagramRendering): readonly string[] {
    const out: string[] = [];
    for (const node of DiagramTwins.#nodesOf(source)) {
      const tag = node.tag;
      if (tag === undefined || tag.length === 0) continue;
      if (DiagramTwins.#carries(rendering.content, tag)) continue;
      out.push(
        `tag: ${rendering.srcRel}: node "${node.id}" tag "${tag}" is absent from ${rendering.outRel}`,
      );
    }
    return out;
  }

  /** The retired-spelling leg — the rendering must state the current command count only. */
  static #retiredMismatches(rendering: DiagramRendering): readonly string[] {
    return DIAGRAM_RETIRED_SPELLINGS.filter((spelling) => rendering.content.includes(spelling)).map(
      (spelling) => `retired-tag: ${rendering.outRel} still states "${spelling}"`,
    );
  }

  /** The revision leg — the source's pin and the artifact's evidence block must agree. */
  static #revisionMismatches(
    source: DiagramSourceDoc,
    rendering: DiagramRendering,
  ): readonly string[] {
    const evidence = DiagramTwins.#evidenceOf(rendering);
    if (evidence === null) return [`revision: ${rendering.outRel} carries no evidence block`];
    const pinned = source.meta.repository.revision;
    if (evidence.repository.revision === pinned) return [];
    return [
      `revision: ${rendering.srcRel} pins ${pinned} but ${rendering.outRel} embeds ${evidence.repository.revision}`,
    ];
  }

  /** The citation leg — the reference multiset plus the artifact's own count. */
  static #referenceMismatches(
    source: DiagramSourceDoc,
    rendering: DiagramRendering,
  ): readonly string[] {
    const evidence = DiagramTwins.#evidenceOf(rendering);
    if (evidence === null) return [`reference: ${rendering.outRel} carries no evidence block`];
    const expected = DiagramTwins.#sourceReferencesOf(source);
    const actual = DiagramTwins.#artifactReferencesOf(evidence);
    const out: string[] = [];
    const keys = new Set([...expected, ...actual].map((ref) => DiagramTwins.#keyOf(ref)));
    for (const key of keys) {
      const want = expected.filter((ref) => DiagramTwins.#keyOf(ref) === key).length;
      const got = actual.filter((ref) => DiagramTwins.#keyOf(ref) === key).length;
      if (want !== got) {
        out.push(`reference: ${rendering.outRel}: source ${want}× vs artifact ${got}× ${key}`);
      }
    }
    if (evidence.referenceCount !== actual.length) {
      out.push(
        `reference: ${rendering.outRel}: referenceCount ${evidence.referenceCount} ≠ ${actual.length} embedded references`,
      );
    }
    return out;
  }

  /** The copy leg — every label, sublabel, tag, card title and card item is present. */
  static #copyMismatches(source: DiagramSourceDoc, rendering: DiagramRendering): readonly string[] {
    const out: string[] = [];
    for (const node of DiagramTwins.#nodesOf(source)) {
      for (const [field, value] of [
        ["label", node.label],
        ["sublabel", node.sublabel],
        ["tag", node.tag],
      ] as const) {
        if (value === undefined || value.length === 0) continue;
        if (DiagramTwins.#carries(rendering.content, value)) continue;
        out.push(`copy: ${rendering.outRel}: node "${node.id}" ${field} "${value}" is absent`);
      }
    }
    for (const card of source.cards ?? []) {
      if (!DiagramTwins.#carries(rendering.content, card.title)) {
        out.push(`card-title: ${rendering.outRel}: "${card.title}" is absent`);
      }
      for (const item of card.items ?? []) {
        if (item.length === 0 || DiagramTwins.#carries(rendering.content, item)) continue;
        out.push(`copy: ${rendering.outRel}: card "${card.title}" item "${item}" is absent`);
      }
    }
    return out;
  }

  /** The source's nodes under its `diagram_type` root — never a hard-wired `components`. */
  static #nodesOf(source: DiagramSourceDoc): readonly SourceNode[] {
    const root = ROOT_BY_TYPE[source.diagram_type];
    if (root === undefined) throw new Error(`unknown diagram_type "${source.diagram_type}"`);
    return source[root] ?? [];
  }

  /** The source-side references, every node's `sources[]` flattened. */
  static #sourceReferencesOf(source: DiagramSourceDoc): readonly Reference[] {
    return DiagramTwins.#nodesOf(source).flatMap((node) =>
      (node.sources ?? []).map((cited): Reference => [cited.path, cited.line, cited.end_line]),
    );
  }

  /** The artifact-side references, every evidence-node array flattened. */
  static #artifactReferencesOf(evidence: EvidenceDoc): readonly Reference[] {
    return Object.values(evidence.nodes).flatMap((citations) =>
      citations.map((cited): Reference => [cited.path, cited.line, cited.endLine]),
    );
  }

  /** Whether the artifact carries a string, raw or HTML-escaped. */
  static #carries(html: string, text: string): boolean {
    return html.includes(text) || html.includes(DiagramTwins.#escaped(text));
  }

  /** The reference multiset key — path plus its inclusive line span. */
  static #keyOf(reference: Reference): string {
    return `${reference[0]}:${reference[1]}-${reference[2]}`;
  }

  /** The artifact's embedded evidence block, or null when the artifact carries none. */
  static #evidenceOf(rendering: DiagramRendering): EvidenceDoc | null {
    const script = EVIDENCE_SCRIPT.exec(rendering.content);
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
