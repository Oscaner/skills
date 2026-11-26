// packages/cdd-engine/tests/support/module-specifiers.ts
// The one reader of module specifiers for the two-tree gate, and the reason its home sits
// outside both trees: `src-next/__tests__/support/strip-comments.ts` belongs to the old
// tree and dies with it, while the gate may not reach across the boundary it judges. A
// home under `tests/` is neither tree, so the gate keeps a single reader until the cutover
// retires gate and reader together.
//
// Why one scanner rather than that stripper plus a specifier regex: the gate judges EDGES,
// not tokens. Comments are not the only false edge — a `from "./x"` quoted inside a doc
// string reads exactly like a real import once comments are blanked, so the two stages
// would need the same string / template / regex state machine and could drift apart, in
// opposite directions: a drift toward leniency greens the gate on a real import. Here one
// pass carries the whole state: comments are skipped, a literal outside a specifier
// position is skipped, and a literal the module loader would actually resolve is recorded.
//
// Heuristic boundary, inherited from the old tree's stripper: template-literal `${ … }`
// nesting is not tracked, and a regex literal is recognised by what may precede it.
// Zero module-level bare functions — the helpers below are `const` arrows.

/** Characters that continue an identifier or a numeric literal. */
const IDENTIFIER_PART = /[A-Za-z0-9_$]/;

/** Whether a `/` reached after `previous` (the last non-space code char, "" at file start)
 *  may open a regex literal rather than being a division operator. */
const regexMayStart = (previous: string): boolean =>
  previous === "" || !/[A-Za-z0-9_$)\]]/.test(previous);

/** The quote characters a module specifier may arrive in. */
const isQuote = (char: string): boolean => char === '"' || char === "'" || char === "`";

/**
 * The index after the comment opening at `index` (which holds a `/`), or -1 when those two
 * characters open no comment. Line and block forms both end past their terminator.
 */
const commentEnd = (source: string, index: number): number => {
  const next = source[index + 1];
  if (next === "/") {
    let cursor = index + 2;
    while (cursor < source.length && source[cursor] !== "\n") cursor += 1;
    return cursor;
  }
  if (next !== "*") return -1;
  let cursor = index + 2;
  while (cursor < source.length && !(source[cursor] === "*" && source[cursor + 1] === "/")) {
    cursor += 1;
  }
  return Math.min(cursor + 2, source.length);
};

/** The index just past the string / template literal opening at `index`, escapes honoured. */
const literalEnd = (source: string, index: number): number => {
  const quote = source[index];
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) return cursor + 1;
    cursor += 1;
  }
  return source.length;
};

/** The index just past the regex literal opening at `index`; `index + 1` when the `/` is a
 *  division after all (no terminator on the line), so the caller keeps scanning the code. */
const regexEnd = (source: string, index: number): number => {
  let cursor = index + 1;
  let inClass = false;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\\") {
      cursor += 2;
      continue;
    }
    if (char === "\n") return index + 1;
    if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass) return cursor + 1;
    cursor += 1;
  }
  return index + 1;
};

/** The index of the first character at or after `index` that is neither whitespace nor a
 *  comment — a specifier may sit behind either. */
const afterTrivia = (source: string, index: number): number => {
  let cursor = index;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      cursor += 1;
      continue;
    }
    const comment = char === "/" ? commentEnd(source, cursor) : -1;
    if (comment < 0) return cursor;
    cursor = comment;
  }
  return cursor;
};

/**
 * Every module specifier the loader would resolve from `source`, deduplicated in
 * first-seen order: `from "…"` (static import and re-export), `import("…")` and
 * `import "…"`. Prose — a comment or any other string — contributes no specifier, and a
 * bare package name is returned as written; resolving it against the trees is the caller's
 * job. Invariant: an entry is present exactly when the text loads it, so the gate's verdict
 * can only be red on a real edge.
 */
export const specifiersIn = (source: string): string[] => {
  const found: string[] = [];
  const seen = new Set<string>();
  let index = 0;
  let previous = "";

  const record = (cursor: number): number => {
    const end = literalEnd(source, cursor);
    const specifier = source.slice(cursor + 1, end - 1);
    if (!seen.has(specifier)) {
      seen.add(specifier);
      found.push(specifier);
    }
    return end;
  };

  while (index < source.length) {
    const char = source[index];
    const comment = char === "/" ? commentEnd(source, index) : -1;
    if (comment >= 0) {
      index = comment;
      continue;
    }
    if (isQuote(char)) {
      index = literalEnd(source, index);
      previous = ")";
      continue;
    }
    if (char === "/" && regexMayStart(previous)) {
      index = regexEnd(source, index);
      previous = ")";
      continue;
    }
    if (!IDENTIFIER_PART.test(char)) {
      if (char.trim() !== "") previous = char;
      index += 1;
      continue;
    }

    let wordEnd = index;
    while (wordEnd < source.length && IDENTIFIER_PART.test(source[wordEnd])) wordEnd += 1;
    const word = source.slice(index, wordEnd);
    previous = source[wordEnd - 1];
    index = wordEnd;
    if (word !== "from" && word !== "import") continue;

    let cursor = afterTrivia(source, index);
    if (word === "import" && source[cursor] === "(") cursor = afterTrivia(source, cursor + 1);
    if (cursor >= source.length || !isQuote(source[cursor])) continue;
    index = record(cursor);
    previous = ")";
  }

  return found;
};
