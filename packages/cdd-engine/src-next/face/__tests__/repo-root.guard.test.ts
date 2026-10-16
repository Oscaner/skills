// packages/cdd-engine/src-next/face/__tests__/repo-root.guard.test.ts
// P9 T7 (spec §2.9) — the STRUCTURAL pin. It guards the conversion point, not
// the spawn: the engine production code must read the working directory exactly
// ONCE and resolve it to the repo root exactly ONCE. The historical lesson is
// that a single source + a single conversion point alone did not hold — the pin
// was dropped alongside them, so a stray second `process.cwd()` (or a second
// repo-root conversion) could re-seam the resolution silently. This guard fails
// the moment a second site appears.
//
// The pin stands apart from the BEHAVIOR pin (cli.test.ts `FakeSync` `call.cwd
// === repoRoot`): the structural pin guards the conversion point (§2.4/§2.9),
// the behavior pin guards the spawn cwd — two different facts, two separate pins.
//
// The scan reads the engine's OWN source face (the src-next production tree,
// `__tests__/` excluded — test fixtures spawn with their own `cwd` argv and are
// not production conversion points). Comments are stripped before the count so a
// docstring mentioning the symbol never builds a hit; string literals are NOT
// stripped (a `process.cwd()` inside a string would be a real defect). The
// stripper is string/template/regex-aware so a `//` inside a string, or a
// backtick-bearing regex literal, never truncates or desyncs the scan.
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

/** Whether a `/` at `previous` (the last non-space code char, "" at file start)
 *  may open a regex literal rather than being a division operator. */
const regexMayStart = (previous: string): boolean =>
  previous === "" || !/[A-Za-z0-9_$)\]]/.test(previous);

/** Strip line + block comments, preserving length and line count (block bodies
 *  collapse to blank chars, a stripped comment's line terminator survives) so a
 *  reported hit line stays true. The scan tracks string and template-literal
 *  interiors (never blanked — a symbol inside a string is a real occurrence, not
 *  prose) and regex-literal bodies (so a backtick inside `/`+…`/` never desyncs
 *  the string tracker); a `//` inside a string or template therefore never
 *  truncates the line. Documented boundary: a template literal's `${ … }` nesting
 *  is not tracked, so a backtick inside an interpolation closes the outer
 *  template early (the same heuristic boundary the zero-dep guard records). */
const stripComments = (source: string): string => {
  const out = source.split("");
  let index = 0;
  let previous = "";
  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        out[index] = "";
        index += 1;
      }
    } else if (char === "/" && next === "*") {
      out[index] = "";
      out[index + 1] = "";
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] !== "\n") out[index] = "";
        index += 1;
      }
      if (index < source.length) {
        out[index] = "";
        out[index + 1] = "";
        index += 2;
      }
    } else if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") index += 1;
        index += 1;
      }
      index += 1;
    } else if (char === "/" && regexMayStart(previous)) {
      index += 1;
      let inClass = false;
      while (index < source.length) {
        const inner = source[index]!;
        if (inner === "\\") {
          index += 2;
          continue;
        }
        if (inner === "[") {
          inClass = true;
          index += 1;
          continue;
        }
        if (inner === "]") {
          inClass = false;
          index += 1;
          continue;
        }
        if (inner === "/" && !inClass) {
          index += 1;
          break;
        }
        if (inner === "\n") break;
        index += 1;
      }
    } else {
      if (char.trim() !== "") previous = char;
      index += 1;
    }
  }
  return out.join("");
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
