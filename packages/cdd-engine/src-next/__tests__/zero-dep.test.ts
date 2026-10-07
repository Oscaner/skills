// packages/cdd-engine/src-next/__tests__/zero-dep.test.ts
// P3.2 zero-dependency guard (T1): while the old tree (src/) and the new tree
// (src-next/) coexist, they must stay mutually import-free (the plan's zero-dependency
// constraint, T1-T17). This test scans both trees' module specifiers - static imports, imports
// with side effects, re-exports and dynamic import() - and fails if any specifier
// resolves into the sibling tree, in either direction. Every src-next file importing
// an old-tree symbol, or any old src file importing src-next, is a hard violation.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const SRC_NEXT = fileURLToPath(new URL("../", import.meta.url));
const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

// The two-tree plane discriminant: which tree a module specifier addresses.
type TreePlane = "src" | "src-next";

// Module specifier patterns: `from "..."` (static import + re-export), dynamic
// `import("...")`, and side-effect `import "..."`.
const SPECIFIER_PATTERN = /(?:from\s+|import\s*\(\s*)(['"])([^'"]+)\1/g;
const SIDE_EFFECT_PATTERN = /^\s*import\s+(['"])([^'"]+)\1/gm;

// Strip comments conservatively (line + block) while keeping string literals, so
// prose that quotes a `from "../src/x"` idiom never trips the guard.
// Heuristic boundary: comment elision applies only in code scope — string-literal
// contents are kept verbatim, and nested template literals are not tracked (a
// backtick inside `${ }` prematurely closes the outer template).
function stripComments(code: string): string {
  let out = "";
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inString: "'" | '"' | "`" | null = null;
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        out += c;
      }
      i++;
    } else if (inBlockComment) {
      if (c === "*" && next === "/") inBlockComment = false;
      i++;
    } else if (inString) {
      if (c === "\\") {
        out += c + (next ?? "");
        i += 2;
      } else {
        out += c;
        if (c === inString) inString = null;
        i++;
      }
    } else if (c === "/" && next === "/") {
      inLineComment = true;
      i += 2;
    } else if (c === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
    } else {
      if (c === "'" || c === '"' || c === "`") inString = c;
      out += c;
      i++;
    }
  }
  return out;
}

function listTsFiles(dir: string, files: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listTsFiles(full, files);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

function extractSpecifiers(text: string): string[] {
  const specifiers = new Set<string>();
  const cleaned = stripComments(text);
  for (const match of cleaned.matchAll(SPECIFIER_PATTERN)) specifiers.add(match[2]);
  for (const match of cleaned.matchAll(SIDE_EFFECT_PATTERN)) specifiers.add(match[2]);
  return [...specifiers];
}

// Result: the tree a module specifier addresses, or null when it addresses neither
// tree (bare package, node: builtin, external module).
function addressedTree(specifier: string, importer: string): TreePlane | null {
  if (specifier === "src" || specifier.startsWith("src/")) return "src";
  if (specifier === "src-next" || specifier.startsWith("src-next/")) return "src-next";
  if (!specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("/")) {
    return null;
  }
  const resolved = specifier.startsWith("/") ? specifier : resolve(dirname(importer), specifier);
  if (resolved.startsWith(SRC)) return "src";
  if (resolved.startsWith(SRC_NEXT)) return "src-next";
  return null;
}

it("src-next and src stay mutually import-free (bidirectional zero-dependency guard)", () => {
  const files = [...listTsFiles(SRC_NEXT, []), ...listTsFiles(SRC, [])];
  const violations: string[] = [];
  for (const file of files) {
    const fromNext = file.startsWith(SRC_NEXT);
    for (const specifier of extractSpecifiers(readFileSync(file, "utf8"))) {
      const target = addressedTree(specifier, file);
      if (target === null) continue;
      const crossing = fromNext ? target === "src" : target === "src-next";
      if (crossing) violations.push(`${file} imports "${specifier}"`);
    }
  }
  const message =
    violations.length > 0 ? violations.join("\n") : "src-next <-> src are import-free";
  expect(violations, message).toEqual([]);
});
