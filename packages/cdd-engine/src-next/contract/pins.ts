// packages/cdd-engine/src-next/contract/pins.ts
// P37 T6 — the pin parseability gate (design spec §7.1 · §7.2 · §7.4). A pin is a
// claim a document makes about the tree: a path, a bare symbol, or a test title. A
// pin that resolves nowhere leaves a claim nobody can re-check, so the gate reports
// it — one criterion, fed by three corpora, executed on two faces:
//
//   · the engine suite's structural test over the whole docs corpus (`scan`);
//   · the document review's read-back over the JUDGED document's own body
//     (`scanText`, called from `face/lifecycle.ts#reconstruct`);
//   · the handoff read-back over each finding's `contract.path` (`pathResolves`,
//     the same `#reconstruct` — `PinAudit`'s markdown scan never carries that cell).
//
// WHAT IS A PIN is part of the gate (§7.1): a backticked token is judged only when it
// is repo-root relative, is not product vocabulary, and is not an ephemeral artifact.
// Without those three exclusions the scanner would treat prose vocabulary as a claim.
// The product family is matched by SHAPE (its concrete instances are machine-local
// names — `plan-fix-1.c1.rulings.json`, `tasks-1-fix-1-a2.c1.json` — which can never
// resolve in another clone), while the template family is excluded only when the token
// IS the entry: a real `<dir>/<slug>-overall.md` reference is still a judged
// coordinate, and it is exactly the stale-path case §7.3 migrates.
//
// The three shapes are judged on their own terms: a path by suffix resolution (never
// by content — content matching cannot be mechanical), a bare symbol against an
// identifier index of the engine / kairos / scripts trees (built once, cached, and
// read from DECLARATIONS — `PinSource` — never from raw bytes), and a test title
// against the named test file's bytes.
//
// Zero document structure and zero semantics are judged here: this is the narrow form
// of the P28 reversal, not a docs corpus validator.
//
// Module-level exports are types / the declared vocabularies / the classes — zero
// behavior-carrying bare functions.

import { readdirSync, readFileSync, type Stats, statSync } from "node:fs";
import path from "node:path";
import { ArtifactRegistry } from "../session/round-artifacts.ts";

/** Which of the three pin shapes failed to resolve (§7.1). */
export type PinShape = "path" | "symbol" | "test";

/** One dead pin — the token, the shape, the document and the finding summary the
 *  read-back injects (warn · lens `consistency`). */
export interface PinFinding {
  /** The token as the document writes it (backticks stripped). */
  readonly pin: string;
  readonly shape: PinShape;
  /** The document the pin sits in — repo-relative, or the caller's own source label. */
  readonly source: string;
  /** The one-sentence summary the round injects — it names the dead pin and why. */
  readonly summary: string;
}

/** One path-shaped pin: the path plus the optional line / range it names. */
export interface PinPath {
  readonly path: string;
  readonly firstLine?: number;
  readonly lastLine?: number;
}

/** One test-title pin: the test file plus the title it must contain. */
export interface PinTest {
  readonly file: string;
  readonly title: string;
}

/** The retired workspace name that no matrix row owns any more — vocabulary, never a
 *  coordinate (§7.1 exclusion ②). Every LIVE artifact name is answered by the matrix
 *  itself (`ArtifactRegistry.ownsName`), so this set stays a list of names the tree no
 *  longer renders rather than a second naming table. */
const RETIRED_PRODUCT_NAMES: ReadonlySet<string> = new Set(["liveness.json"]);

/** The template vocabulary — excluded only when the token IS the entry (§7.1): a real
 *  `docs/kairos/specs/<slug>-overall.md` is still a judged path. */
const TEMPLATE_WORDS: ReadonlySet<string> = new Set(["X.md", "-overall.md", "-design.md"]);

/** The extensions a path-shaped token may carry — a dotted member name
 *  (`HandoffSchema.findingsOf`) is a symbol, not a file. */
const FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  "ts",
  "tsx",
  "js",
  "mjs",
  "cjs",
  "json",
  "md",
  "yml",
  "yaml",
  "sh",
  "toml",
  "txt",
  "css",
  "html",
]);

/** The trees the symbol index reads (§7.1) — engine source, the skills package and
 *  the repo automation. A symbol outside them is unresolvable by definition. */
const SYMBOL_ROOTS: readonly string[] = [
  "packages/cdd-engine/src-next",
  "packages/kairos",
  "scripts",
];

/** The directories a walk never descends into — build output and VCS internals name no
 *  pin (and reading them would cost the index more than it buys). */
const SKIP_DIRS: ReadonlySet<string> = new Set([".git", "node_modules", "dist", ".pi"]);

/**
 * PinVocabulary — the pin DEFINITION (§7.1). A token is judged only when the three
 * exclusions leave it a claim; the shape classifiers then say which of the three
 * shapes (if any) the token belongs to, so a command word, a flag or a placeholder is
 * never mistaken for a coordinate.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the pin DEFINITION is a declared static vocabulary and a shape classifier set — the repo's zero-bare-function discipline admits no standalone predicates.
export class PinVocabulary {
  /** Whether a backticked token is a pin at all — the three exclusions, in order. */
  static isPin(token: string): boolean {
    if (token.length === 0) return false;
    // ① repo-root relative: a `./` / `../` shorthand or a `...` elision is prose.
    if (/^\.\.?\//.test(token) || /^\.\.\./.test(token)) return false;
    // ② not product vocabulary (the product family by shape, the template family only
    //    when the token is the entry itself).
    if (PinVocabulary.#isProduct(token) || TEMPLATE_WORDS.has(token)) return false;
    // ③ not an ephemeral artifact: a `.changeset/*.md` is consumed at release.
    if (token.startsWith(".changeset/") && token.endsWith(".md")) return false;
    return true;
  }

  /** The product-family judgment (§7.1 exclusion ②, by shape): a basename the artifact
   *  matrix owns (the workspace literals, every round family, the sidecar) or one of the
   *  retired names the tree no longer renders. Matched on the BASENAME, so
   *  `.kairos/cdd/<workspace>/progress.json` is product vocabulary while a real
   *  `<dir>/<slug>-overall.md` stays a judged coordinate. */
  static #isProduct(token: string): boolean {
    const base = token.split("/").pop() ?? token;
    return RETIRED_PRODUCT_NAMES.has(base) || ArtifactRegistry.ownsName(base);
  }

  /** The placeholder metacharacters — a token carrying one is a PATTERN, and a pattern
   *  is none of the three shapes: `*-overall.md` names a family, `<slug>-design.md`
   *  names a rule for deriving a path. Neither is a coordinate a reader can follow. */
  static isPattern(token: string): boolean {
    return /[*<>{}|\s]/.test(token);
  }

  /** The path shape `path.ext[:line[-line]]`, or null when the token is not
   *  path-shaped. The extension is required — `BLOCKED/TIMEOUT`, `--spec/--plan` and
   *  `findings/artifacts/notes` are prose compounds, and `ReviewKey` is a symbol. */
  static pathOf(token: string): PinPath | null {
    if (PinVocabulary.isPattern(token)) return null;
    const match = /^(?<file>[^\s:]+)(?::(?<first>\d+)(?:-(?<last>\d+))?)?$/.exec(token);
    const groups = match?.groups;
    if (groups === undefined) return null;
    const file = groups.file;
    // A leading-dot or leading-dash token with no separator names a SUFFIX
    // (`.rulings.json` · `.md` · `-overall.md`), which §7.1's second exclusion lists as
    // vocabulary: it is a word about names, not a name. A prefixed PATH
    // (`.github/workflows/x.yml`, `docs/kairos/specs/<slug>-overall.md`) still carries
    // its separator and stays a coordinate.
    if ((file.startsWith(".") || file.startsWith("-")) && !file.includes("/")) return null;
    const extension = /\.([A-Za-z0-9]+)$/.exec(file)?.[1] ?? "";
    if (!FILE_EXTENSIONS.has(extension)) return null;
    const first = groups.first === undefined ? undefined : Number(groups.first);
    const last = groups.last === undefined ? undefined : Number(groups.last);
    return {
      path: file,
      ...(first === undefined ? {} : { firstLine: first }),
      ...(last === undefined ? {} : { lastLine: last }),
    };
  }

  /** The test-title shape `file.test.ts::title`, or null. The FILE half must be a
   *  coordinate (no placeholder metacharacter); the title half is prose and may carry
   *  spaces — that is what a test title is. */
  static testOf(token: string): PinTest | null {
    const at = token.indexOf("::");
    if (at === -1) return null;
    const file = token.slice(0, at);
    const title = token.slice(at + 2).trim();
    if (/[*<>{}|]/.test(file) || !file.endsWith(".test.ts") || title.length === 0) return null;
    return { file, title };
  }

  /** A bare symbol — a code identifier, not an English word. The shape admits three
   *  spellings: a private member (`#member`), a name with an underscore
   *  (`INPUT_FINDINGS`), or a camel / Pascal name (`findingsOf`, `ReviewKey`). An
   *  all-lowercase word (`wave`) and a hex prefix (`b69bb177`) are prose, not symbols —
   *  judging them would report every backticked noun in the corpus. */
  static isSymbol(token: string): boolean {
    if (!/^#?[A-Za-z_$][A-Za-z0-9_$]*$/.test(token)) return false;
    if (token.startsWith("#")) return token.length > 1;
    if (token.includes("_")) return true;
    return /[A-Z]/.test(token.slice(1));
  }
}

/**
 * PinSpans — the markdown reader. Only INLINE code spans are claims: a fenced block is
 * example code (its bytes are not a document's assertion), and the span's content is
 * the text between a backtick run and the next run of the same length.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the markdown span reader is a declared static reader set — the repo's zero-bare-function discipline admits no standalone parser.
export class PinSpans {
  /** Every inline code span of one markdown body, in document order. */
  static tokensOf(text: string): readonly string[] {
    const tokens: string[] = [];
    let fenced = false;
    for (const line of text.split("\n")) {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      for (const span of PinSpans.#spansIn(line)) tokens.push(span);
    }
    return tokens;
  }

  /** The inline spans of one line — a run of `n` backticks closed by the next run of
   *  the same length; an unmatched run ends the line's scan (never an invented span). */
  static #spansIn(line: string): readonly string[] {
    const spans: string[] = [];
    let index = 0;
    while (index < line.length) {
      const open = line.indexOf("`", index);
      if (open === -1) break;
      let width = 0;
      while (line[open + width] === "`") width += 1;
      const closer = line.indexOf("`".repeat(width), open + width);
      if (closer === -1) break;
      spans.push(line.slice(open + width, closer));
      index = closer + width;
    }
    return spans;
  }
}

/**
 * PinSource — the declaration reader behind the symbol index (§7.1). A name resolves
 * only when it survives in CODE: comment bodies and regex-literal bodies are blanked
 * first (length- and line-preserving, so a later reader's position stays true) — the
 * two places a deleted name outlives its declaration, namely the typed prose of a
 * comment and a retirement guard's own pattern text.
 *
 * String and template literals are deliberately KEPT: in this tree they are where live
 * vocabulary is declared (`face/words.ts` spells `CDD_BLOCKED:` as a literal ·
 * `contract/lint.ts` derives `DependsOn id` from a literal · the round-context tokens
 * are emitted from prompt literals). Blanking them reported 82 live `CDD_BLOCKED` pins
 * and 94 `DependsOn` pins as dead, so a literal is a value the code carries, not prose
 * about a name.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the declaration reader is a declared static reader set — the repo's zero-bare-function discipline admits no standalone parser.
export class PinSource {
  /** One source text with every comment and regex literal body blanked — the
   *  declaration corpus the identifier index tokenizes. */
  static codeOf(source: string): string {
    const out = source.split("");
    const blank = (from: number, to: number): void => {
      for (let at = from; at < to && at < out.length; at += 1) {
        if (out[at] !== "\n") out[at] = " ";
      }
    };
    let index = 0;
    let previous = "";
    while (index < source.length) {
      const char = source[index]!;
      const next = source[index + 1];
      if (char === "/" && next === "/") {
        const start = index;
        while (index < source.length && source[index] !== "\n") index += 1;
        blank(start, index);
      } else if (char === "/" && next === "*") {
        const start = index;
        index += 2;
        while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
          index += 1;
        }
        index += 2;
        blank(start, index);
      } else if (char === "'" || char === '"' || char === "`") {
        // kept verbatim — see the class header: a literal is a value, not prose
        const quote = char;
        index += 1;
        while (index < source.length && source[index] !== quote) {
          if (source[index] === "\\") index += 1;
          index += 1;
        }
        index += 1;
      } else if (char === "/" && PinSource.#regexMayStart(previous)) {
        const start = index;
        index += 1;
        let inClass = false;
        while (index < source.length) {
          const inner = source[index]!;
          if (inner === "\n") break;
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
          index += 1;
          if (inner === "/" && !inClass) break;
        }
        blank(start, index);
      } else {
        if (char.trim() !== "") previous = char;
        index += 1;
      }
    }
    return out.join("");
  }

  /** Whether a `/` at `previous` (the last non-space code char, "" at file start) may
   *  open a regex literal rather than being a division operator. */
  static #regexMayStart(previous: string): boolean {
    return previous === "" || !/[A-Za-z0-9_$)\]]/.test(previous);
  }
}

/**
 * PinIndex — the resolution face: the repo's own entry list (files and directories, for
 * suffix resolution), the identifier index of the three source trees, and the per-file
 * reads the line-count and test-title shapes need. Everything is built lazily and
 * cached, so one audit instance pays the walk once.
 */
export class PinIndex {
  readonly #root: string;
  #entries: readonly string[] | null = null;
  #symbols: ReadonlySet<string> | null = null;
  readonly #lineCounts = new Map<string, number>();

  constructor(root: string) {
    this.#root = root;
  }

  /** Every repo entry (file or directory), repo-relative — the path shape's corpus. */
  entries(): readonly string[] {
    this.#entries ??= PinIndex.#walk(this.#root, this.#root);
    return this.#entries;
  }

  /** The identifier set of the engine / kairos / scripts trees — the symbol shape's
   *  corpus. Identifiers come from DECLARATIONS (`PinSource.codeOf`), never from raw
   *  bytes: a name kept alive only by a comment or a guard test's own regex is prose
   *  about the name, not the name being there. A private member indexes as
   *  `artifactCellOf` (`#` is not an identifier character), which is why `isSymbol`
   *  strips it too. */
  symbols(): ReadonlySet<string> {
    if (this.#symbols !== null) return this.#symbols;
    const symbols = new Set<string>();
    for (const root of SYMBOL_ROOTS) {
      for (const entry of PinIndex.#walk(path.join(this.#root, root), this.#root)) {
        if (!PinIndex.#isSource(entry)) continue;
        const text = this.textOf(entry);
        if (text === null) continue;
        for (const match of PinSource.codeOf(text).matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
          symbols.add(match[0]);
        }
      }
    }
    this.#symbols = symbols;
    return symbols;
  }

  /** The repo entry a pin's path resolves to (suffix match, so a doc may write the tail
   *  of a long path), or null when nothing in the tree ends with it. */
  resolvePath(pinPath: string): string | null {
    const normalized = pinPath.replace(/^\.\//, "").replace(/\/+$/, "");
    if (normalized.length === 0) return null;
    return (
      this.entries().find((entry) => entry === normalized || entry.endsWith(`/${normalized}`)) ??
      null
    );
  }

  /** One entry's text, null when it cannot be read (a directory, a vanished file). */
  textOf(entry: string): string | null {
    try {
      return readFileSync(path.join(this.#root, entry), "utf8");
    } catch {
      return null;
    }
  }

  /** One entry's line count — 0 when it cannot be read. */
  lineCountOf(entry: string): number {
    const cached = this.#lineCounts.get(entry);
    if (cached !== undefined) return cached;
    const text = this.textOf(entry);
    const count = text === null ? 0 : text.split("\n").length;
    this.#lineCounts.set(entry, count);
    return count;
  }

  /** Whether one test file contains the named title's bytes. */
  testContains(entry: string, title: string): boolean {
    const text = this.textOf(entry);
    return text?.includes(title) ?? false;
  }

  /** Whether one entry is a source file the symbol index reads. */
  static #isSource(entry: string): boolean {
    return /\.(ts|tsx|js|mjs|cjs|json)$/.test(entry);
  }

  /** Every entry under one directory (or the file itself), repo-relative — one walk,
   *  skipping the build / VCS directories. */
  static #walk(target: string, root: string): readonly string[] {
    const entries: string[] = [];
    let stat: Stats;
    try {
      stat = statSync(target);
    } catch {
      return entries;
    }
    if (!stat.isDirectory()) return [path.relative(root, target)];
    for (const dirent of readdirSync(target, { withFileTypes: true })) {
      if (SKIP_DIRS.has(dirent.name)) continue;
      const at = path.join(target, dirent.name);
      entries.push(path.relative(root, at));
      if (dirent.isDirectory()) entries.push(...PinIndex.#walk(at, root));
    }
    return entries;
  }
}

/**
 * PinAudit — the gate. `scan` judges a declared corpus of markdown roots, `scanText`
 * judges one document body, and `pathResolves` judges a declared coordinate on its own
 * (the handoff `contract.path` corpus). The three entry points share one criterion and
 * one index; each corpus keeps its own read point.
 */
export class PinAudit {
  readonly #root: string;
  readonly #index: PinIndex;

  constructor(root: string) {
    this.#root = root;
    this.#index = new PinIndex(root);
  }

  /** The corpus the scan would read — the file list, so a structural test can pin its
   *  size instead of hoping the glob is stable. */
  filesOf(roots: readonly string[]): readonly string[] {
    const files: string[] = [];
    for (const root of roots) {
      const at = path.resolve(this.#root, root);
      for (const entry of PinAudit.#walkFiles(at, this.#root)) files.push(entry);
    }
    return files;
  }

  /** Every dead pin of a markdown corpus — one finding per unresolvable token. */
  scan(roots: readonly string[]): readonly PinFinding[] {
    const findings: PinFinding[] = [];
    for (const file of this.filesOf(roots)) {
      const text = this.#index.textOf(file);
      if (text === null) continue;
      for (const finding of this.scanText(text, file)) findings.push(finding);
    }
    return findings;
  }

  /** Every dead pin of one document body — the document review's read-back corpus. */
  scanText(text: string, source: string): readonly PinFinding[] {
    const findings: PinFinding[] = [];
    for (const token of PinSpans.tokensOf(text)) {
      const finding = this.#judge(token, source);
      if (finding !== null) findings.push(finding);
    }
    return findings;
  }

  /** Whether one declared coordinate resolves — the `contract.path` corpus' one
   *  question. A path with a line suffix is judged on its path alone (the handoff
   *  anchor owns the line, the gate owns the coordinate). */
  pathResolves(pinPath: string): boolean {
    const form = PinVocabulary.pathOf(pinPath);
    return this.#index.resolvePath(form?.path ?? pinPath) !== null;
  }

  /** One token's judgment — the test shape first (it also ends in `.ts`), then the path
   *  shape, then the bare symbol; anything else is prose, not a pin. */
  #judge(token: string, source: string): PinFinding | null {
    if (!PinVocabulary.isPin(token)) return null;
    const test = PinVocabulary.testOf(token);
    if (test !== null) {
      const file = this.#index.resolvePath(test.file);
      if (file === null)
        return PinAudit.#finding(
          token,
          "test",
          source,
          `its test file \`${test.file}\` is not in the tree`,
        );
      if (this.#index.testContains(file, test.title)) return null;
      return PinAudit.#finding(
        token,
        "test",
        source,
        `\`${file}\` carries no test titled \`${test.title}\``,
      );
    }
    const form = PinVocabulary.pathOf(token);
    if (form !== null) {
      const entry = this.#index.resolvePath(form.path);
      if (entry === null) {
        return PinAudit.#finding(
          token,
          "path",
          source,
          `the path \`${form.path}\` is not in the tree`,
        );
      }
      const named = form.lastLine ?? form.firstLine;
      const lines = this.#index.lineCountOf(entry);
      if (named !== undefined && named > lines) {
        return PinAudit.#finding(
          token,
          "path",
          source,
          `\`${entry}\` has ${lines} lines, so line ${named} does not exist`,
        );
      }
      return null;
    }
    if (PinVocabulary.isSymbol(token)) {
      const name = token.startsWith("#") ? token.slice(1) : token;
      if (this.#index.symbols().has(name)) return null;
      return PinAudit.#finding(
        token,
        "symbol",
        source,
        `no symbol named \`${name}\` exists in the engine, kairos or scripts trees`,
      );
    }
    return null;
  }

  /** One finding's summary — the ONE wording the guard test and the round's injected
   *  warn share. */
  static #finding(token: string, shape: PinShape, source: string, reason: string): PinFinding {
    return {
      pin: token,
      shape,
      source,
      summary: `the pin \`${token}\` in ${source} resolves nowhere — ${reason}`,
    };
  }

  /** The markdown files under one corpus root (or the root itself when it is a file). */
  static #walkFiles(at: string, root: string): readonly string[] {
    let stat: Stats;
    try {
      stat = statSync(at);
    } catch {
      return [];
    }
    if (!stat.isDirectory()) return [path.relative(root, at)];
    const files: string[] = [];
    for (const dirent of readdirSync(at, { withFileTypes: true })) {
      if (SKIP_DIRS.has(dirent.name)) continue;
      const child = path.join(at, dirent.name);
      if (dirent.isDirectory()) {
        files.push(...PinAudit.#walkFiles(child, root));
      } else if (dirent.name.endsWith(".md")) {
        files.push(path.relative(root, child));
      }
    }
    return files;
  }
}
