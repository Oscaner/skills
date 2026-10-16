// packages/cdd-engine/src-next/__tests__/zero-dep.test.ts
// P3.2 zero-dependency guard (T1 → cutover): during the two-tree coexistence window the
// old tree (src) and the new tree (src-next) had to stay mutually import-free. The
// cutover (T15) deleted the old tree — the guard now pins the post-cutover terminal
// state: the retired planes of this package (the src and config planes) are absent from
// disk, and no src-next module specifier may address them (a dangling reference into a
// deleted plane is a hard violation of the plan's zero-residue constraint). The two-way
// scan becomes one-way: src-next is the only live plane left.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { stripComments } from "./support/strip-comments.ts";

const SRC_NEXT = fileURLToPath(new URL("../", import.meta.url));
const PKG_ROOT = fileURLToPath(new URL("../../", import.meta.url)); // packages/cdd-engine/

// The retired-plane discriminant: which deleted plane a module specifier addresses.
// The bare dirnames (no trailing slash — a slash-prefixed form would itself trip the
// cutover's zero-residue grep) are the only retired-plane tokens the guard names.
type RetiredPlane = "src" | "config";
const RETIRED_PLANES: readonly RetiredPlane[] = ["src", "config"];

/** Which retired plane a first path segment names, or null. */
const retiredBySegment = (head: string | undefined): RetiredPlane | null =>
  head === "src" || head === "config" ? head : null;

/** The retired plane a resolved path falls into (by the package-root-relative first
 *  segment), or null when the path lives in a live plane or outside the package. */
const retiredByResolved = (resolved: string): RetiredPlane | null => {
  return retiredBySegment(relative(PKG_ROOT, resolved).split(sep)[0]);
};

// Module specifier patterns: `from "..."` (static import + re-export), dynamic
// `import("...")`, and side-effect `import "..."`.
const SPECIFIER_PATTERN = /(?:from\s+|import\s*\(\s*)(['"])([^'"]+)\1/g;
const SIDE_EFFECT_PATTERN = /^\s*import\s+(['"])([^'"]+)\1/gm;

// Comment elision (line + block) with string literals kept verbatim — the shared
// length-preserving stripper (P9 branch-review-1 F4: one stripper for both source
// guards, `./support/strip-comments.ts`), so prose that quotes a `from "../src/x"`
// idiom never trips the guard and its heuristic boundary can never drift apart from
// the structural pin's copy.

const listTsFiles = (dir: string, files: string[]): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listTsFiles(full, files);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
};

const extractSpecifiers = (text: string): string[] => {
  const specifiers = new Set<string>();
  const cleaned = stripComments(text);
  for (const match of cleaned.matchAll(SPECIFIER_PATTERN)) specifiers.add(match[2]);
  for (const match of cleaned.matchAll(SIDE_EFFECT_PATTERN)) specifiers.add(match[2]);
  return [...specifiers];
};

// Result: the retired plane a module specifier addresses, or null when it addresses
// neither (a live plane, a bare package, a node: builtin, or an external module).
const addressedRetiredPlane = (specifier: string, importer: string): RetiredPlane | null => {
  if (!specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("/")) {
    return retiredBySegment(specifier.split("/")[0]);
  }
  const resolved = specifier.startsWith("/") ? specifier : resolve(dirname(importer), specifier);
  return retiredByResolved(resolved);
};

it("the retired src and config planes are deleted from the package (the cutover terminal pin)", () => {
  const entries = readdirSync(PKG_ROOT);
  for (const name of RETIRED_PLANES) {
    expect(entries, `deleted plane ${name} must be absent from the package root`).not.toContain(
      name,
    );
  }
});

it("src-next carries zero module specifiers addressing the retired src or config planes", () => {
  const files = listTsFiles(SRC_NEXT, []);
  const violations: string[] = [];
  for (const file of files) {
    for (const specifier of extractSpecifiers(readFileSync(file, "utf8"))) {
      const target = addressedRetiredPlane(specifier, file);
      if (target !== null) violations.push(`${file} imports "${specifier}"`);
    }
  }
  const message =
    violations.length > 0 ? violations.join("\n") : "src-next has no retired-plane references";
  expect(violations, message).toEqual([]);
});
