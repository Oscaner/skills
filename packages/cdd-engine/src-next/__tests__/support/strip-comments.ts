// packages/cdd-engine/src-next/__tests__/support/strip-comments.ts
// The shared length-preserving comment/string stripper for the src-next source
// guards (P9 branch-review-1 F4 — one stripper, one home). Two guards read the
// engine's own source text and must ignore prose comments while still counting a
// token that lives inside a string literal (a `process.cwd()` quoted in code is a
// real occurrence; the same text in a `//` comment is not) — the structural pin
// (face/__tests__/repo-root.guard.test.ts) and the retired-plane guard
// (__tests__/zero-dep.test.ts) both ride this ONE implementation, so their
// hand-written heuristic boundary can never drift apart.
//
// The stripper preserves length and line count (a stripped comment collapses to
// blank chars, its line terminator survives) so a reported `line:col` hit stays
// true after stripping. It tracks string and template-literal interiors (never
// blanked — a token inside a string is a real occurrence) and regex-literal
// bodies (so a backtick inside `/`+…`/` never desyncs the string tracker).
//
// Documented heuristic boundary: a template literal's `${ … }` nesting is not
// tracked, so a backtick inside an interpolation closes the outer template early.
//
// Zero module-level bare functions — the strip/regex-may-start pair are `const`
// arrows (the plan's zero-`function`-declaration discipline).

/** Whether a `/` at `previous` (the last non-space code char, "" at file start)
 *  may open a regex literal rather than being a division operator. */
const regexMayStart = (previous: string): boolean =>
  previous === "" || !/[A-Za-z0-9_$)\]]/.test(previous);

/** Strip line + block comments, preserving length and line count. The scan tracks
 *  string / template-literal interiors (kept verbatim — a symbol inside a string
 *  is a real occurrence, not prose) and regex-literal bodies (so a backtick inside
 *  `/`+…`/` never desyncs the string tracker); a `//` inside a string or template
 *  therefore never truncates the line. See the module header for the documented
 *  interpolation-nesting boundary. */
export const stripComments = (source: string): string => {
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
