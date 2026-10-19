// packages/cdd-engine/src-next/face/__tests__/repo-root.guard.test.ts
// P9 T7 (spec §2.9) — the STRUCTURAL pin. It guards the conversion point, not
// the spawn: the engine production code must read the working directory exactly
// ONCE and resolve it to the repo root exactly ONCE. The historical lesson is
// that a single source + a single conversion point alone did not hold — the pin
// was dropped alongside them, so a stray second `process.cwd()` (or a second
// repo-root conversion) could re-seam the resolution silently. This guard fails
// the moment a second site appears.
//
// The pin stands apart from the BEHAVIOR pin (cli.test.ts's spawn-cwd behavior
// pin — the child is constructed with `call.cwd === repoRoot`): the structural
// pin guards the conversion point (§2.4/§2.9), the behavior pin guards the
// spawn cwd — two different facts, two separate pins.
//
// The scan reads the engine's OWN source face (the src-next production tree,
// `__tests__/` excluded — test fixtures spawn with their own `cwd` argv and are
// not production conversion points). Comments are stripped before the count so a
// docstring mentioning the symbol never builds a hit; string literals are NOT
// stripped (a `process.cwd()` inside a string would be a real defect). The
// stripper (shared with the retired-plane guard — `__tests__/support/strip-comments
// .ts`, F4) is string/template/regex-aware so a `//` inside a string, or a
// backtick-bearing regex literal, never truncates or desyncs the scan.
//
// Zero module-level bare functions — the walk/count helpers are `const`
// (the plan's zero-`function`-declaration discipline).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../__tests__/support/strip-comments.ts";

/** The src-next plane root — the engine's own source face (the scan set). */
const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The two tokens the structural pin counts, each pinned to exactly ONE hit:
 *  the working-directory read (`process.cwd()`) and the root conversion (the
 *  `.topLevel(` member-call form — receiver-agnostic, so a conversion through a
 *  renamed or destructured receiver still builds a hit; the method DEFINITION
 *  `async topLevel(` has no leading dot and stays outside the count). */
const PINNED = [
  { token: "process.cwd()", label: "the working-directory read" },
  { token: ".topLevel(", label: "the repo-root conversion" },
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

describe("the structural pin's comment stripper — strings are counted, comments are not", () => {
  it("counts a token inside a string literal but not one inside a line comment", () => {
    // The header's contract, pinned behaviorally: a symbol inside a string is a
    // real occurrence (the defect the guard exists to catch); a comment is not.
    expect(stripComments('const a = "process.cwd()";').includes("process.cwd()")).toBe(true);
    expect(stripComments("// process.cwd()").includes("process.cwd()")).toBe(false);
    expect(stripComments("/* .topLevel( in prose */").includes(".topLevel(")).toBe(false);
  });

  it("does not let a `//` inside a string literal truncate the line (a real token after it still counts)", () => {
    // The regression the stripper's string-awareness closes: a naive `//`-strip
    // would drop everything after the in-string `//`, silently missing the real
    // conversion call on the same line.
    const line = 'const note = "see // the cwd"; const c = process.cwd();';
    expect(stripComments(line).includes("process.cwd()")).toBe(true);
  });

  it("does not let a backtick-bearing regex literal desync the scan (later real tokens still count)", () => {
    // A non-regex-aware tracker reads the backtick inside `/`+[^`]*`/` as a
    // template-literal opener and swallows the rest of the file as a string,
    // falsely reporting following comment tokens (or missing real ones).
    const source = [
      "const r = /`+[^`\\n]*`+/g;",
      "// process.cwd()",
      "const c = process.cwd();",
    ].join("\n");
    const stripped = stripComments(source);
    expect(stripped.split("\n")[1]!.includes("process.cwd()")).toBe(false);
    expect(stripped.split("\n")[2]!.includes("process.cwd()")).toBe(true);
  });

  it("preserves line count so a reported hit line stays true", () => {
    const source = ["const a = 1;", "/* x", "y */", "// z", "const b = 2;"].join("\n");
    expect(stripComments(source).split("\n")).toHaveLength(5);
  });
});
