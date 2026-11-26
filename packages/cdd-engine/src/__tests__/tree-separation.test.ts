// packages/cdd-engine/src/__tests__/tree-separation.test.ts
// The bidirectional import gate (spec §3.1): `src/` never imports into `src-next/` and
// `src-next/` never imports into `src/`. Without it the two trees silently fuse through
// one convenient import, and the cutover finds the new tree still on the old tree's
// umbilical. The domain is product code — each tree with its `__tests__` folders removed.
// The test surface is deliberately outside the domain: it is the gate's positive control
// (a parity corpus reads both trees and must stay legal), never a hole in the ban.
//
// The reading is per file, over the module specifiers the text can actually load — static
// import, re-export, side-effect import and dynamic import. Each specifier is resolved
// against its own file's directory, so a relative reach of any spelling lands on a real
// path and is judged there; a bare package specifier names no file in either tree.
//
// Prose is not an edge. A comment that quotes the idiom it forbids (`// never write
// import x from "../src-next/bin.ts"`) and a doc string that does the same are the two
// shapes a correct product file takes to record the ban, so both must read as no edge at
// all; `tests/support/module-specifiers.ts` is the one scanner that carries that boundary,
// and it lives outside both trees so this gate does not reach across the one it judges.
//
// The verdict therefore carries no line numbers and no file list of its own to maintain:
// it re-derives both from the trees it reads, which is the only form that stays true.
//
// Retirement: the cutover deletes `src-next/` outright (spec §3.3), and this file goes with
// it in that same batch. The `src-next/` direction of the ban cannot outlive its own
// subject — enumerating a deleted directory throws rather than passing, and an `existsSync`
// guard that passes on a missing tree is exactly the false green D101 forbids. The surviving
// direction then lives in `src-next/__tests__/zero-dep.test.ts`, whose specifier scan refuses
// a src-next reach into `src/` whether or not that directory exists.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { specifiersIn } from "../../tests/support/module-specifiers.ts";

/** The engine package root — both trees' shared parent. */
const ENGINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC_ROOT = join(ENGINE_ROOT, "src");
const SRC_NEXT_ROOT = join(ENGINE_ROOT, "src-next");

/** The `__tests__` folder name — the single boundary between product and test surface. */
const TEST_SURFACE = "__tests__";

/**
 * ProductFiles — one tree's product modules. Invariant: the enumeration holds the tree's
 * loadable source files and nothing else; any file under a `__tests__` folder is test
 * surface and is dropped, and directories are descended rather than listed.
 */
class ProductFiles {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  /** The tree's product modules, absolute and sorted so a verdict reads the same twice. */
  absolutePaths(): string[] {
    const found: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const child = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== TEST_SURFACE) walk(child);
          continue;
        }
        if (entry.isFile() && entry.name.endsWith(".ts")) found.push(child);
      }
    };
    walk(this.root);
    return found.sort();
  }
}

/**
 * CrossTreeReach — the verdict for one direction of the ban. Invariant: it lists exactly
 * the import edges that leave the judged tree and land inside the foreign one, and stays
 * empty for a specifier that stays home or names no file at all.
 */
class CrossTreeReach {
  private readonly judged: ProductFiles;
  private readonly foreignRoot: string;

  constructor(judged: ProductFiles, foreignRoot: string) {
    this.judged = judged;
    this.foreignRoot = foreignRoot;
  }

  /** One row per offending edge — `<judged file> -> <specifier>`, nothing when clean. */
  rows(): string[] {
    const offending: string[] = [];
    for (const file of this.judged.absolutePaths()) {
      for (const specifier of specifiersIn(readFileSync(file, "utf8"))) {
        if (!landsIn(dirname(file), specifier, this.foreignRoot)) continue;
        offending.push(`${relative(ENGINE_ROOT, file)} -> ${specifier}`);
      }
    }
    return offending;
  }
}

/**
 * True when `specifier`, read from a module in `fromDirectory`, resolves into the tree
 * rooted at `treeRoot`. A bare package specifier resolves into no tree; the `sep`
 * suffix keeps a sibling like `src-next/` from satisfying a prefix test for `src/`.
 */
const landsIn = (fromDirectory: string, specifier: string, treeRoot: string): boolean => {
  if (!specifier.startsWith(".")) return false;
  const resolved = resolve(fromDirectory, specifier);
  return resolved === treeRoot || resolved.startsWith(`${treeRoot}${sep}`);
};

describe("the two trees never mix — a product import stays in its own tree", () => {
  it("no `src/**` product module imports into `src-next/`, and the judged domain is not empty", () => {
    const judged = new ProductFiles(SRC_ROOT);
    expect(judged.absolutePaths().length).toBeGreaterThan(0);
    expect(new CrossTreeReach(judged, SRC_NEXT_ROOT).rows()).toEqual([]);
  });

  it("no `src-next/**` product module imports into `src/`, and the judged domain is not empty", () => {
    const judged = new ProductFiles(SRC_NEXT_ROOT);
    expect(judged.absolutePaths().length).toBeGreaterThan(0);
    expect(new CrossTreeReach(judged, SRC_ROOT).rows()).toEqual([]);
  });
});
