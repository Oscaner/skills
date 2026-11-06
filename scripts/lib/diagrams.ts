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

  /** Render every product, then write the complete set into `outRoot`. A failing
   *  render (or a missing bin) throws before the first write. */
  emit(outRoot: string, generatedPaths: string[]): void {
    const staged = this.stageAll();
    for (const { outRel, content } of staged) this.write(outRoot, outRel, content, generatedPaths);
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
  private stageAll(): Array<{ outRel: string; content: string }> {
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
        return { outRel: product.outRel, content: readFileSync(outAbs, "utf8") };
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
