// packages/cdd-engine/src-next/contract/frontmatter.ts
// T1 — the front-matter head extraction chain (design spec §2.1/§2.2): a typed
// head value object plus a thin `---` fence split over the `yaml` engine. The
// extractor reads the RAW content (never the canonicalize view — front matter is
// data, not structure; the canonicalized view would silently rewrite registered
// Chinese aliases inside header values). The registry keeps the declared value
// shapes (spec §2.3); this file only carries the parse channel (fence split +
// `yaml.parse`) and the typed accessors.
//
// Zero bare functions and zero new regexes are hard guarantees of this module:
// the line split/join and the parse-error message slices are hand-rolled string
// walks, and the YAML engine does all value parsing.

import { LineCounter, parse } from "yaml";

/** A front-matter YAML parse failure — the typed, position-carrying reason a
 *  `FrontMatterExtractor.split` did not produce a head (D1, the position-carrying error contract:
 *  the extractor never swallows a parse error into a null head — the review gate
 *  surfaces the real failure, `yaml`'s `YAMLParseError` fed through a `LineCounter`
 *  carries the line/column for free, we only stop throwing it away). */
export class FrontMatterParseError {
  /** The one-based line of the failure inside the front-matter block. */
  readonly line: number;
  /** The one-based column of the failure on that line. */
  readonly column: number;
  /** The engine's reason, without the position clause (`Unexpected scalar at node
   *  end` — the position rides the typed fields, never a re-parse of the message). */
  readonly reason: string;
  /** The offending front-matter source line (the human-facing excerpt). */
  readonly source: string;

  constructor(line: number, column: number, reason: string, source: string) {
    this.line = line;
    this.column = column;
    this.reason = reason;
    this.source = source;
  }
}

/** A parsed front-matter head — the typed accessor surface over the YAML record.
 *  A missing key, a non-scalar value (a list, a mapping, a bare number) and an
 *  unparseable block all read as `null`: the head carries only scalar facts. An
 *  UNPARSEABLE block additionally carries its `parseError` — the gate distinguishes
 *  a genuinely absent key from a malformed block (D1, the false-positive fix). */
export class FrontMatterHead {
  /** The parsed front-matter record, or null when no head was extracted. */
  readonly #data: Record<string, unknown> | null;
  /** The front-matter parse failure that prevented a head, or null. */
  readonly #parseError: FrontMatterParseError | null;

  /** Wrap one parsed front-matter record (null for "no head"); the parse error the
   *  head carries when the block could not be parsed (null by default). */
  constructor(
    data: Record<string, unknown> | null,
    parseError: FrontMatterParseError | null = null,
  ) {
    this.#data = data;
    this.#parseError = parseError;
  }

  /** The front-matter parse failure, or null when the block parsed (or no head). */
  get parseError(): FrontMatterParseError | null {
    return this.#parseError;
  }

  /** The scalar value of one front-matter key — null for a missing key, a
   *  non-scalar YAML value (list / mapping / number / boolean) or a null literal. */
  value(key: string): string | null {
    if (this.#data === null) return null;
    const raw = this.#data[key];
    if (typeof raw !== "string") return null;
    return raw;
  }

  /** The document title (`title:`). */
  get title(): string | null {
    return this.value("title");
  }

  /** The machine doc-type identity (`doc-type:`) — a `DOC_TYPE_VALUES` member in a conforming document. */
  get docType(): string | null {
    return this.value("doc-type");
  }

  /** The version token (`version:`, the `v<major>.<minor>` form). */
  get version(): string | null {
    return this.value("version");
  }

  /** The ISO date (`date:`, the `yyyy-mm-dd` form). */
  get date(): string | null {
    return this.value("date");
  }

  /** The status literal (`status:`, the declared per-doc-type enum). */
  get status(): string | null {
    return this.value("status");
  }

  /** The author line (`author:`). */
  get author(): string | null {
    return this.value("author");
  }

  /** The plan's design-spec target path (`spec:`). */
  get spec(): string | null {
    return this.value("spec");
  }

  /** The Class-B parent-overall target path (`parent-program:`). */
  get parentProgram(): string | null {
    return this.value("parent-program");
  }

  /** The Class-B version token (`parent-version:`, the `v<major>.<minor>` form). */
  get parentVersion(): string | null {
    return this.value("parent-version");
  }

  /** The `depends-on:` front-matter key value. */
  get dependsOn(): string | null {
    return this.value("depends-on");
  }

  /** The plan base-line value (`base:`). */
  get base(): string | null {
    return this.value("base");
  }

  /** The single-spec issues line (`issues:`). */
  get issues(): string | null {
    return this.value("issues");
  }
}

/** The front-matter split of a document — the fence split + `yaml.parse` (spec
 *  §2.2's selection: one YAML engine for the whole repo, a ~10-line fence split,
 *  no front-matter library). Reads the RAW original content verbatim; the body is
 *  everything after the second `---` fence. */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated static split surface — the zero-bare-function discipline admits no standalone split helpers.
export class FrontMatterExtractor {
  /** Split one document into its typed head and body. With no opening fence on
   *  line zero, no closing fence, an unparseable block or a non-record block,
   *  every head value reads null and the body is the original content. An
   *  UNPARSEABLE block (D1) additionally carries its `FrontMatterParseError` on
   *  the head — the failure is typed and positioned, never a silent null. */
  static split(content: string): { head: FrontMatterHead; body: string } {
    const lines = FrontMatterExtractor.lineSplit(content);
    if (lines.length === 0 || lines[0].trim() !== "---") {
      return { head: new FrontMatterHead(null), body: content };
    }
    const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (closing === -1) return { head: new FrontMatterHead(null), body: content };
    const yamlLines = lines.slice(1, closing);
    const yamlText = FrontMatterExtractor.lineJoin(yamlLines);
    const lineCounter = new LineCounter();
    let parsed: unknown;
    try {
      parsed = parse(yamlText, { lineCounter });
    } catch (err) {
      return {
        // D1: the parse failure travels as a typed, positioned error — the gate
        // reports the real YAML failure, never the "no doc-type" misread a null
        // head would otherwise trigger.
        head: new FrontMatterHead(null, FrontMatterExtractor.#parseErrorOf(err, yamlLines)),
        body: content,
      };
    }
    // A non-record parse (a scalar block, a sequence) is not a head — every
    // value reads null and the body stays the original content. A null parse
    // (an empty front-matter block) yields the empty head with the post-fence
    // body: the fence split itself succeeded.
    if (parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) {
      return { head: new FrontMatterHead(null), body: content };
    }
    return {
      head: new FrontMatterHead(parsed as Record<string, unknown> | null),
      body: FrontMatterExtractor.lineJoin(lines.slice(closing + 1)),
    };
  }

  /** One thrown YAML parse error → the typed failure: the position from the
   *  engine's `linePos` (fed by the `LineCounter`), the reason without its
   *  position clause (string ops — this module carries zero regexes) and the
   *  offending source line from the block itself. */
  static #parseErrorOf(err: unknown, yamlLines: readonly string[]): FrontMatterParseError {
    const message = err instanceof Error ? err.message : "YAML parse error";
    // The engine's message head ends with " at line <n>, column <m>: " — the
    // position is a typed field below, so the reason drops the clause. Both
    // slices are hand-rolled string walks: this module carries zero regexes and
    // the Task 1 checkable also pins the whole `String#split` family to zero.
    const reason = FrontMatterExtractor.#beforeFirst(
      FrontMatterExtractor.#beforeFirst(message, "\n"),
      " at line ",
    ).trim();
    const position = (err as { linePos?: readonly { line: number; col: number }[] }).linePos?.[0];
    const line = position?.line ?? 0;
    const source = line > 0 ? (yamlLines[line - 1] ?? "") : "";
    return new FrontMatterParseError(line, position?.col ?? 0, reason, source);
  }

  /** The text before the first occurrence of `separator` — the hand-rolled
   *  slice (the whole string on no occurrence), the string-walk counterpart of
   *  the retired `String#split` calls. */
  static #beforeFirst(text: string, separator: string): string {
    const index = text.indexOf(separator);
    return index === -1 ? text : text.slice(0, index);
  }

  /** Split a document into its lines — the hand-rolled split (the zero-regex
   *  discipline bans `String#split`'s word here). */
  static lineSplit(content: string): string[] {
    const lines: string[] = [];
    let start = 0;
    for (let index = 0; index < content.length; index++) {
      if (content[index] !== "\n") continue;
      lines.push(content.slice(start, index));
      start = index + 1;
    }
    lines.push(content.slice(start));
    return lines;
  }

  /** Join lines with single `\n` separators — the hand-rolled join. */
  static lineJoin(lines: readonly string[]): string {
    let out = "";
    for (let index = 0; index < lines.length; index++) {
      if (index > 0) out += "\n";
      out += lines[index];
    }
    return out;
  }
}
