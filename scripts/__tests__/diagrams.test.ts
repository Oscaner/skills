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
import { DIAGRAM_SRC_DIR, type DiagramProduct, DiagramProducts } from "../lib/diagrams.ts";

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
