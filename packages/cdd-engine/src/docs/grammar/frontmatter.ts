// packages/cdd-engine/src/docs/grammar/frontmatter.ts
// The front-matter head: a `---` fence split over the `yaml` engine, and a typed head
// that carries only scalar facts.
//
// A parse failure is a TYPED, POSITIONED throw — never a null head. The distinction
// matters: a null head reads as "this document declares no doc-type", which turns a
// broken YAML block into the wrong finding, while a positioned failure names the line
// the author has to fix. The position comes from the engine's own `LineCounter`, so it
// is the parser's answer and not a re-parse of its message.
//
// The head keeps the document's raw bytes: front matter is data, so nothing here
// normalizes or localizes a value.

import { LineCounter, parse as parseYaml } from "yaml";

/** A front-matter YAML parse failure, carrying the position inside the block. */
export class FrontMatterError extends Error {
  /** The 1-based line inside the front-matter block. */
  readonly line: number;
  /** The 1-based column on that line. */
  readonly column: number;
  /** The offending source line, verbatim. */
  readonly source: string;

  constructor(line: number, column: number, reason: string, source: string) {
    super(`front matter: ${reason} at line ${line}, column ${column}: ${source}`);
    this.name = "FrontMatterError";
    this.line = line;
    this.column = column;
    this.source = source;
  }
}

/** The closing/opening fence of a YAML head block. */
const FENCE = "---";

/** The ONE fence walk of a head boundary — the head's own split and the body projection
 *  both read it, so `---` means one thing in this slice. Recognition only: no YAML is
 *  parsed here, so a document whose head will not parse still projects its body. */
export const headFenceOf = (lines: readonly string[]): number => {
  if ((lines[0] ?? "").trim() !== FENCE) return -1;
  return lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
};

/** Split a document into lines on `\n` alone — the ONE spelling of a document's line
 *  form in this slice. The `\r` of a CRLF text belongs to the line it ends, so
 *  `lineJoinOf` restores the input byte for byte and a projected body stays equal to
 *  the old tree's projection. */
export const lineSplitOf = (content: string): readonly string[] => content.split("\n");

/** Join lines back with `\n` separators — the inverse of `lineSplitOf`, keeping every
 *  `\r` a line still carries. */
export const lineJoinOf = (lines: readonly string[]): string => lines.join("\n");

/** Narrow a thrown YAML error to the typed, positioned failure. */
const errorOf = (raw: unknown, block: readonly string[]): FrontMatterError => {
  const message = raw instanceof Error ? raw.message : "YAML parse error";
  const cut = message.indexOf("\n");
  const reason = cut === -1 ? message : message.slice(0, cut);
  const position = (raw as { linePos?: readonly { line: number; col: number }[] }).linePos?.[0];
  const line = position?.line ?? 0;
  return new FrontMatterError(
    line,
    position?.col ?? 0,
    reason.trim(),
    line > 0 ? (block[line - 1] ?? "") : "",
  );
};

/**
 * FrontMatter — one document's typed head. Invariant: every accessor answers a scalar
 * fact of the declared record, or null — a list, a mapping and a number are not head
 * values, and a document with no head answers null everywhere.
 */
export class FrontMatter {
  readonly #record: Readonly<Record<string, unknown>> | null;

  constructor(record: Readonly<Record<string, unknown>> | null) {
    this.#record = record;
  }

  /** The declared key names, in document order. */
  keys(): readonly string[] {
    return this.#record === null ? [] : Object.keys(this.#record);
  }

  /** One key's scalar value, or null when the key is missing or its value is not a
   *  string. */
  value(key: string): string | null {
    if (this.#record === null) return null;
    const raw = this.#record[key];
    return typeof raw === "string" ? raw : null;
  }

  /** The document identity (`slug:`). */
  get slug(): string | null {
    return this.value("slug");
  }

  /** The document class (`doc-type:`). */
  get docType(): string | null {
    return this.value("doc-type");
  }

  /** The program slug reference (`program:`). */
  get program(): string | null {
    return this.value("program");
  }

  /** The version token (`version:`). */
  get version(): string | null {
    return this.value("version");
  }

  /** The document title (`title:`). */
  get title(): string | null {
    return this.value("title");
  }
}

/** One document split into its head and its body. */
export interface FrontMatterSplit {
  /** The typed head — empty when the document carries none. */
  readonly head: FrontMatter;
  /** Everything after the closing fence (the whole document when there is no head). */
  readonly body: string;
}

/** Split a document into its typed head and body. Unparseable YAML throws a positioned
 *  `FrontMatterError`; a non-record block (a bare scalar, a sequence) is not a head and
 *  answers the empty head with the original body. */
export const frontmatterOf = (content: string): FrontMatterSplit => {
  const lines = lineSplitOf(content);
  const closing = headFenceOf(lines);
  if (closing === -1) return { head: new FrontMatter(null), body: content };
  const block = lines.slice(1, closing);
  const counter = new LineCounter();
  let parsed: unknown;
  try {
    parsed = parseYaml(lineJoinOf(block), { lineCounter: counter });
  } catch (raw) {
    throw errorOf(raw, block);
  }
  if (parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) {
    return { head: new FrontMatter(null), body: content };
  }
  return {
    head: new FrontMatter(parsed as Record<string, unknown> | null),
    body: lineJoinOf(lines.slice(closing + 1)),
  };
};
