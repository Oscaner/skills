// packages/cdd-engine/src-next/face/__tests__/repo-root.guard.test.ts
// P9 T7 (spec §2.9) — the STRUCTURAL pin. It guards the conversion point, not
// the spawn: the engine production code must read the working directory exactly
// ONCE and resolve it to the repo root exactly ONCE. The historical lesson is
// that a single source + a single conversion point alone did not hold — the pin
// was dropped alongside them, so a stray second `process.cwd()` (or a second
// `git.topLevel` conversion) could re-seam the resolution silently. This guard
// fails the moment a second site appears.
//
// The pin stands apart from the BEHAVIOR pin (cli.test.ts `FakeSync` `call.cwd
// === repoRoot`): the structural pin guards the conversion point (§2.4/§2.9),
// the behavior pin guards the spawn cwd — two different facts, two separate pins.
//
// The scan reads the engine's OWN source face (the src-next production tree,
// `__tests__/` excluded — test fixtures spawn with their own `cwd` argv and are
// not production conversion points). Comments are stripped before the count so a
// docstring mentioning the symbol never builds a hit; string literals are NOT
// stripped (a `process.cwd()` inside a string would be a real defect).
//
// Zero module-level bare functions — the walk/strip/count helpers are `const`
// (the plan's zero-`function`-declaration discipline).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The src-next plane root — the engine's own source face (the scan set). */
const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The two tokens the structural pin counts, each pinned to exactly ONE hit:
 *  the working-directory read (`process.cwd()`) and the root conversion
 *  (`git.topLevel(` — the call, so a bare mention of the method name in prose
 *  does not build a hit once comments are stripped). */
const PINNED = [
  { token: "process.cwd()", label: "the working-directory read" },
  { token: "git.topLevel(", label: "the repo-root conversion" },
] as const;

/** Walk the production tree collecting `.ts` files under `__tests__` excluded
 *  (the test plane is not the production conversion face). */
const collectProductionTs = (dir: string, out: string[]): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      collectProductionTs(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".ts")) {
      out.push(path.join(dir, entry.name));
    }
  }
};

/** Strip block + line comments, preserving line count (block bodies collapse to
 *  blank lines) so a reported hit line stays true. A line comment is recognized
 *  by a `//` not preceded by `:` — the URL-safe guard (`https://…` keeps its
 *  `//`). String literals are never stripped: a symbol inside a string is a real
 *  occurrence, not prose. */
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Every `file:line` hit of one token over the production face (comments stripped). */
const hitsOf = (token: string): string[] => {
  const files: string[] = [];
  collectProductionTs(SRC_ROOT, files);
  const hits: string[] = [];
  for (const file of files) {
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index]!.includes(token)) hits.push(`${path.relative(SRC_ROOT, file)}:${index + 1}`);
    }
  }
  return hits;
};

describe("the structural pin — the engine resolves the repo root through exactly one conversion point (spec §2.9)", () => {
  for (const { token, label } of PINNED) {
    it(`${label} occurs exactly once on the engine production face — ${token}`, () => {
      const hits = hitsOf(token);
      // The pin is a count of ONE: zero hits would strand the resolution (no
      // conversion at all), a second hit would re-seam it. Either way the guard
      // is the machine check the spec's single-conversion invariant rides on.
      expect(hits, `"${token}" must occur exactly once (found ${hits.length})`).toHaveLength(1);
    });
  }
});
