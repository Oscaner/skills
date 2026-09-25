// scripts/lib/english-comments.ts — the repo comment-language guard domain service.
// English-primary discipline (repo CLAUDE.md): code comments are written in English;
// CJK prose in a comment is a regression. This module is the single scanner used by
// the guard (scripts/validate/__tests__/english-comments.test.ts) — stateless pure
// rules, zero bare-function side effects.
//
// The comment walker is string/template/regex-aware (`//` and `/* */` open a comment
// only outside quoted, template or regex literal surfaces; a ${…} interpolation is
// walked opaque so a nested directive cannot open a comment). Provenance: the same
// walker algorithm as scripts/validate/residue.ts `commentUnits`, adapted with
// per-line tracking so the guard can bound its scan to a diff's added lines.
//
// One data-operand carve-out: CJK inside a backticked span of a comment (e.g. "the
// `- **验收**:` marker", "matches `计划` in a plan doc") names a literal document
// token the engine consumes verbatim — it is data, not prose, and is exempt.

const CJK_PATTERN = /[㐀-鿿]/;

export interface EnglishGuardViolation {
  file: string; // repo-relative path
  line: number; // 1-indexed, the comment unit's first line
  fragment: string; // the offending comment content (trimmed, ellipsized)
}

interface CommentUnit {
  startLine: number;
  endLine: number;
  content: string;
}

/** Extract every comment unit from a source file, line-tracked. */
export function commentUnitsOf(text: string): CommentUnit[] {
  const units: CommentUnit[] = [];
  const countNewlines = (s: string) => (s.match(/\n/g) ?? []).length;
  let i = 0;
  let line = 1;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      const startLine = line;
      const eol = text.indexOf("\n", i);
      const end = eol === -1 ? n : eol;
      units.push({ startLine, endLine: startLine, content: text.slice(i + 2, end) });
      if (eol === -1) i = n;
      else {
        i = eol + 1;
        line += 1;
      }
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const startLine = line;
      const end = text.indexOf("*/", i + 2);
      const content = text.slice(i + 2, end === -1 ? n : end);
      units.push({ startLine, endLine: startLine + countNewlines(content), content });
      line += countNewlines(content);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i += 1;
      while (i < n) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === q) {
          i += 1;
          break;
        }
        if (text[i] === "\n") line += 1;
        i += 1;
      }
      continue;
    }
    if (c === "`") {
      i += 1;
      while (i < n) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === "`") {
          i += 1;
          break;
        }
        if (text[i] === "$" && text[i + 1] === "{") {
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
              const q = text[i];
              i += 1;
              while (i < n) {
                if (text[i] === "\\") {
                  i += 2;
                  continue;
                }
                if (text[i] === q) {
                  i += 1;
                  break;
                }
                if (text[i] === "\n") line += 1;
                i += 1;
              }
              continue;
            }
            if (text[i] === "\n") line += 1;
            if (text[i] === "}") depth -= 1;
            if (text[i] === "{") depth += 1;
            i += 1;
          }
          continue;
        }
        if (text[i] === "\n") line += 1;
        i += 1;
      }
      continue;
    }
    if (c === "\n") line += 1;
    i += 1;
  }
  return units;
}

/** CJK chars inside backticked spans of a comment are data operands — masked out. */
function maskedContent(content: string): string {
  return content.replace(/`[^`]*`/g, "``");
}

/** True when the comment carries CJK prose outside its backticked data operands. */
export function hasCjkProse(content: string): boolean {
  return CJK_PATTERN.test(maskedContent(content));
}

/** The offending comment fragment for the guard message (trimmed, ellipsized). */
export function cjkFragmentOf(content: string): string {
  const masked = maskedContent(content);
  const idx = masked.search(CJK_PATTERN);
  if (idx === -1) return "";
  return masked.slice(idx, idx + 12).trim();
}

/**
 * Parse a `git diff -U0` text into a per-file set of added line numbers. Context and
 * removed lines never enter the set.
 */
export function diffAddedLineSets(diffText: string): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  let current: string | null = null;
  let cursor = 0;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ b/")) {
      current = line.slice(6).trim();
      cursor = 0;
      continue;
    }
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk && current) {
      cursor = Number(hunk[2]);
      if (!result.has(current)) result.set(current, new Set());
      continue;
    }
    if (!current) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      result.get(current)!.add(cursor);
      cursor += 1;
    } else if (line.startsWith(" ")) {
      cursor += 1;
    }
  }
  return result;
}

/**
 * The guard's single judgment: given a source file's whole text and the set of added
 * line numbers (the working/range diff), list every comment unit that carries CJK
 * prose on an added line.
 */
export function englishGuardViolations(
  file: string,
  sourceText: string,
  addedLines: Set<number>,
): EnglishGuardViolation[] {
  const violations: EnglishGuardViolation[] = [];
  for (const unit of commentUnitsOf(sourceText)) {
    const onAddedLine = Array.from(addedLines).some(
      (ln) => ln >= unit.startLine && ln <= unit.endLine,
    );
    if (!onAddedLine || !hasCjkProse(unit.content)) continue;
    violations.push({ file, line: unit.startLine, fragment: cjkFragmentOf(unit.content) });
  }
  return violations;
}
