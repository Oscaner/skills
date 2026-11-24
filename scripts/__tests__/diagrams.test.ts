// scripts/__tests__/diagrams.test.ts — the diagram regeneration plane's pins. The
// product list is DERIVED from `docs/diagrams/src/*.json` (zero mapping table), the
// hand-written `index.html` is never a product and never an orphan, the write-back is
// all-or-nothing (a failing render leaves the output root and `generatedPaths`
// untouched), and a missing Archify bin is a hard error rather than a silent skip.
// Fixtures are temp trees — the plane is exercised without touching `docs/diagrams/`.

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
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitService, REPO_ROOT } from "../emit.ts";
import {
  DIAGRAM_SRC_DIR,
  type DiagramProduct,
  DiagramProducts,
  DiagramTwins,
} from "../lib/diagrams.ts";

/** One source document's product face, read straight from the source bytes. */
const sourceFace = (file: string): { type: string; out: string; quality: string } => {
  const doc = JSON.parse(readFileSync(path.join(REPO_ROOT, DIAGRAM_SRC_DIR, file), "utf8")) as {
    diagram_type: string;
    meta: { output: string; quality_profile: string };
  };
  return { type: doc.diagram_type, out: doc.meta.output, quality: doc.meta.quality_profile };
};

/** The six source file names, sorted — the derivation base. */
const sourceFiles = (): string[] =>
  readdirSync(path.join(REPO_ROOT, DIAGRAM_SRC_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort();

/** A disposable repo root seeded with copies of the real diagram sources. */
const fixtureRoot = (files: readonly string[] = sourceFiles()): string => {
  const root = mkdtempSync(path.join(tmpdir(), "diagrams-fixture-"));
  mkdirSync(path.join(root, DIAGRAM_SRC_DIR), { recursive: true });
  for (const file of files) {
    writeFileSync(
      path.join(root, DIAGRAM_SRC_DIR, file),
      readFileSync(path.join(REPO_ROOT, DIAGRAM_SRC_DIR, file), "utf8"),
      "utf8",
    );
  }
  return root;
};

/** A disposable output root — the write-back target. */
const outputRoot = (): string => mkdtempSync(path.join(tmpdir(), "diagrams-out-"));

/** The repo-relative html files under an output root's diagram directory. */
const writtenHtml = (root: string): string[] => {
  const dir = path.join(root, "docs", "diagrams");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".html"))
    .sort();
};

/** A stub renderer that produces a marker artifact per product and can fail on one. */
const stubRenderer = (failing: string | undefined) => {
  return (args: { outAbs: string; type: string }): void => {
    if (failing !== undefined && args.type === failing)
      throw new Error(`render failed: ${args.type}`);
    mkdirSync(path.dirname(args.outAbs), { recursive: true });
    writeFileSync(args.outAbs, `<html data-type="${args.type}"></html>\n`, "utf8");
  };
};

describe("DiagramProducts — the product list derived from the sources", () => {
  it("derives exactly the six sources' meta.output (zero mapping table)", () => {
    const products = new DiagramProducts(REPO_ROOT).list();
    const expected = sourceFiles()
      .map((file) => sourceFace(file).out)
      .sort();
    expect(products.map((p) => p.outRel).sort()).toEqual(expected);
    expect(products).toHaveLength(6);
    const faces = new Map(
      sourceFiles().map((name) => [path.basename(sourceFace(name).out), sourceFace(name)] as const),
    );
    for (const product of products) {
      const face = faces.get(path.basename(product.outRel));
      expect(face, product.outRel).toBeDefined();
      expect(product.type).toBe(face?.type);
      expect(product.quality).toBe(face?.quality);
    }
  });

  it("follows the source set — dropping a source drops its product (reverse red)", () => {
    const dropped = sourceFiles()[0] as string;
    const root = fixtureRoot(sourceFiles().filter((name) => name !== dropped));
    try {
      const outs = new DiagramProducts(root).list().map((p) => p.outRel);
      expect(outs).not.toContain(sourceFace(dropped).out);
      expect(outs).toHaveLength(5);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never lists the hand-written index.html — even when it sits in the output dir", () => {
    const root = fixtureRoot();
    const out = outputRoot();
    try {
      mkdirSync(path.join(out, "docs", "diagrams"), { recursive: true });
      writeFileSync(path.join(out, "docs", "diagrams", "index.html"), "<html></html>\n", "utf8");
      const products = new DiagramProducts(root).list();
      expect(products.map((p) => p.outRel)).not.toContain("docs/diagrams/index.html");
      // The orphan walk exempts the same hand-written page.
      expect(new DiagramProducts(root).orphanHtml(out, [])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("DiagramProducts.emit — all-or-nothing write-back", () => {
  it("writes every product and records the paths on success", () => {
    const out = outputRoot();
    try {
      const products = new DiagramProducts(REPO_ROOT, { render: stubRenderer(undefined) });
      const generatedPaths: string[] = [];
      products.emit(out, generatedPaths);
      expect(generatedPaths.sort()).toEqual(
        products
          .list()
          .map((p) => p.outRel)
          .sort(),
      );
      expect(writtenHtml(out)).toHaveLength(6);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("writes nothing when one render fails — zero html, zero recorded paths", () => {
    const out = outputRoot();
    try {
      const products = new DiagramProducts(REPO_ROOT, { render: stubRenderer("lifecycle") });
      const generatedPaths: string[] = [];
      expect(() => products.emit(out, generatedPaths)).toThrow(/render failed/);
      expect(writtenHtml(out)).toEqual([]);
      expect(generatedPaths).toEqual([]);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("fails hard when the Archify bin is missing — never a silent skip", () => {
    const root = fixtureRoot();
    const out = outputRoot();
    try {
      const products = new DiagramProducts(root);
      const generatedPaths: string[] = [];
      expect(() => products.emit(out, generatedPaths)).toThrow(
        /Archify missing — run pnpm install/,
      );
      expect(writtenHtml(out)).toEqual([]);
      expect(generatedPaths).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("DiagramProducts — the orphan walk and its stale leg", () => {
  it("reports html the derivation no longer produces, exempting index.html", () => {
    const out = outputRoot();
    try {
      const dir = path.join(out, "docs", "diagrams");
      mkdirSync(dir, { recursive: true });
      for (const name of ["index.html", "architecture.en.html", "orphan.en.html"]) {
        writeFileSync(path.join(dir, name), "<html></html>\n", "utf8");
      }
      expect(
        new DiagramProducts(REPO_ROOT).orphanHtml(out, ["docs/diagrams/architecture.en.html"]),
      ).toEqual(["docs/diagrams/orphan.en.html"]);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("hangs off findStaleCommittedFiles — one seam, no second call point", () => {
    const root = fixtureRoot();
    try {
      const generated: readonly DiagramProduct[] = new DiagramProducts(REPO_ROOT).list();
      const dir = path.join(root, "docs", "diagrams");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "orphan.en.html"), "<html></html>\n", "utf8");
      const stale = emitService.findStaleCommittedFiles(
        new Set(generated.map((p) => p.outRel)),
        root,
      );
      expect(stale).toEqual(["docs/diagrams/orphan.en.html"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("DiagramProducts — the default renderer's call face", () => {
  it("spawns the pinned bin through process.execPath — no PATH, no shell shim", () => {
    const source = readFileSync(new URL("../lib/diagrams.ts", import.meta.url), "utf8");
    expect(source).toContain("process.execPath");
    expect(source).toContain('join("node_modules", "archify", "bin", "archify.mjs")');
    expect(source).toContain("Archify missing — run pnpm install");
    expect(source).not.toMatch(/shell:\s*true/);
    expect(source).not.toContain("execSync");
  });
});

/**
 * P43 T8 — the twin assertions' execution face. `emit:check` is the ONE place a source
 * is judged against its rendered artifact, so every arm here drives
 * `DiagramTwins.mismatchesOf` through an INJECTED renderer: the artifact the stub writes
 * is the artifact the assertions read, and the committed product is never touched.
 * Each leg gets a pair — a faithful render stays silent, one tampered render turns that
 * leg red — because a leg that cannot report is worth nothing, and a leg that always
 * reports is worth less.
 */

/** The evidence block's script tag — the artifact's machine-readable carrier. */
const EVIDENCE_SCRIPT =
  /<script id="archify-source-evidence-data" type="application\/json">([\s\S]*?)<\/script>/;

/** One source document as the twin assertions read it. */
interface TwinSource {
  readonly diagram_type: string;
  readonly meta: { readonly repository: { readonly revision: string } };
  readonly components?: readonly TwinNode[];
  readonly states?: readonly TwinNode[];
  readonly nodes?: readonly TwinNode[];
  readonly cards?: readonly TwinCard[];
}

/** One node of a source document. */
interface TwinNode {
  readonly id: string;
  readonly label?: string;
  readonly sublabel?: string;
  readonly tag?: string;
  readonly sources?: readonly { path: string; line: number; end_line: number }[];
}

/** One summary card of a source document. */
interface TwinCard {
  readonly title: string;
  readonly items?: readonly string[];
}

/** The artifact-side evidence block. */
interface TwinEvidence {
  readonly repository: { readonly revision: string };
  readonly referenceCount: number;
  readonly nodes: Readonly<
    Record<string, readonly { path: string; line: number; endLine: number }[]>
  >;
}

/** One string as the artifact writes a text node. */
const escapeOf = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** The nodes of one source under its declared root. */
const nodesOfSource = (source: TwinSource): readonly TwinNode[] => [
  ...(source.components ?? []),
  ...(source.states ?? []),
  ...(source.nodes ?? []),
];

/** Every copy cell one source declares — labels, sublabels, tags, card titles and card
 *  items, in the order the artifact writes them. */
const copyCellsOf = (source: TwinSource): readonly string[] => {
  const nodes = nodesOfSource(source);
  const cells = [...nodes.flatMap((node) => [node.label, node.sublabel, node.tag])];
  for (const card of source.cards ?? []) cells.push(card.title, ...(card.items ?? []));
  return cells.filter((text): text is string => typeof text === "string" && text.length > 0);
};

/** The artifact one source renders to: its copy cells as escaped text nodes plus one
 *  evidence block carrying the same citations and the same revision pin. */
const artifactOfSource = (source: TwinSource): string => {
  const nodes = nodesOfSource(source);
  const references = nodes.flatMap((node) =>
    (node.sources ?? []).map((cited) => ({
      path: cited.path,
      line: cited.line,
      endLine: cited.end_line,
    })),
  );
  const evidence: TwinEvidence = {
    repository: source.meta.repository,
    referenceCount: references.length,
    nodes: { [nodes[0]?.id ?? "node"]: references },
  };
  return [
    "<!doctype html><html><body>",
    ...copyCellsOf(source).map((text) => `<span>${escapeOf(text)}</span>`),
    `<script id="archify-source-evidence-data" type="application/json">${JSON.stringify(evidence)}</script>`,
    "</body></html>",
    "",
  ].join("\n");
};

/** Rewrite the evidence block of one artifact. */
const withEvidence = (html: string, mutate: (evidence: TwinEvidence) => TwinEvidence): string => {
  const script = EVIDENCE_SCRIPT.exec(html);
  if (script === null) throw new Error("the stub artifact carries no evidence block");
  const rewritten = JSON.stringify(mutate(JSON.parse(script[1]) as TwinEvidence));
  return html.replace(
    EVIDENCE_SCRIPT,
    () => `<script id="archify-source-evidence-data" type="application/json">${rewritten}</script>`,
  );
};

/** The six ways a renderer can disagree with its source — one per asserted leg, plus
 *  the faithful pass every pair is measured against. */
type Tamper =
  | "none"
  | "drop-tag"
  | "retired-spelling"
  | "drop-reference"
  | "change-copy"
  | "other-revision";

/** One renderer that writes a faithful artifact and then applies one tamper. */
const tamperingRenderer =
  (tamper: Tamper) =>
  (request: { srcAbs: string; outAbs: string }): void => {
    const source = JSON.parse(readFileSync(request.srcAbs, "utf8")) as TwinSource;
    const faithful = artifactOfSource(source);
    const html = twinTampered(faithful, source, tamper);
    mkdirSync(path.dirname(request.outAbs), { recursive: true });
    writeFileSync(request.outAbs, html, "utf8");
  };

/** One tamper applied to a faithful artifact. */
const twinTampered = (faithful: string, source: TwinSource, tamper: Tamper): string => {
  switch (tamper) {
    case "none":
      return faithful;
    case "drop-tag": {
      const tag = nodesOfSource(source).find((node) => (node.tag ?? "").length > 0)?.tag ?? "";
      return faithful.split(escapeOf(tag)).join("");
    }
    case "retired-spelling":
      return faithful.replace("</body>", "<p>7 commands</p></body>");
    case "drop-reference":
      return withEvidence(faithful, (evidence) => {
        const [first] = Object.keys(evidence.nodes);
        return {
          ...evidence,
          nodes: { ...evidence.nodes, [first]: evidence.nodes[first]?.slice(1) ?? [] },
        };
      });
    case "change-copy": {
      const [first] = copyCellsOf(source);
      return faithful.replace(
        `<span>${escapeOf(first ?? "")}</span>`,
        "<span>rewritten, never regenerated</span>",
      );
    }
    case "other-revision":
      return withEvidence(faithful, (evidence) => ({
        ...evidence,
        repository: { revision: "0".repeat(40) },
      }));
  }
};

/** One emit pass with the given renderer, judged — the mismatches it reports. */
const judgedPass = (tamper: Tamper): readonly string[] => {
  const out = outputRoot();
  try {
    const products = new DiagramProducts(REPO_ROOT, { render: tamperingRenderer(tamper) });
    const renderings = products.emit(out, []);
    return DiagramTwins.mismatchesOf(REPO_ROOT, renderings);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
};

/** The mismatches of one leg — the message prefix names the leg. */
const legOf = (mismatches: readonly string[], leg: string): readonly string[] =>
  mismatches.filter((message) => message.startsWith(`${leg}:`));

describe("DiagramTwins — the five generation-consistency legs (emit:check's face)", () => {
  it("stays silent when the renderer reproduces every source", () => {
    expect(judgedPass("none")).toEqual([]);
  });

  it("reports a node tag the rendering dropped — the node marker is the corresponding face", () => {
    const mismatches = judgedPass("drop-tag");
    expect(legOf(mismatches, "tag").length).toBeGreaterThan(0);
    // the copy leg reads the same absence: dropping a tag also empties its copy cell
    expect(legOf(mismatches, "copy").length).toBeGreaterThan(0);
    expect(legOf(mismatches, "revision")).toEqual([]);
    expect(legOf(mismatches, "reference")).toEqual([]);
  });

  it("reports a retired command spelling that survived the render", () => {
    const mismatches = judgedPass("retired-spelling");
    expect(legOf(mismatches, "retired-tag").length).toBeGreaterThan(0);
    expect(legOf(mismatches, "tag")).toEqual([]);
    expect(legOf(mismatches, "reference")).toEqual([]);
    expect(legOf(mismatches, "copy")).toEqual([]);
  });

  it("reports a source citation the rendering lost — the multiset and its count", () => {
    const mismatches = judgedPass("drop-reference");
    expect(legOf(mismatches, "reference").length).toBeGreaterThan(0);
    expect(legOf(mismatches, "revision")).toEqual([]);
    expect(legOf(mismatches, "copy")).toEqual([]);
  });

  it("reports a copy cell the rendering rewrote", () => {
    const mismatches = judgedPass("change-copy");
    expect(legOf(mismatches, "copy").length).toBeGreaterThan(0);
    expect(legOf(mismatches, "card-title")).toEqual([]);
    expect(legOf(mismatches, "reference")).toEqual([]);
  });

  it("reports an evidence revision the source does not pin", () => {
    const mismatches = judgedPass("other-revision");
    expect(legOf(mismatches, "revision").length).toBeGreaterThan(0);
    expect(legOf(mismatches, "reference")).toEqual([]);
    expect(legOf(mismatches, "copy")).toEqual([]);
  });

  it("names the leg in the message — a red says which comparison failed, never just that one did", () => {
    for (const [tamper, leg] of [
      ["drop-reference", "reference"],
      ["other-revision", "revision"],
      ["change-copy", "copy"],
    ] as const) {
      const [first] = legOf(judgedPass(tamper), leg);
      expect(first).toBeDefined();
      expect(first?.startsWith(`${leg}:`)).toBe(true);
    }
  });
});
