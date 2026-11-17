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
// The three shapes are judged on their own terms: a path by the THREE-TIER resolution
// of §7.1 (exact entry → unique suffix → ambiguity, never a first hit) and never by
// content — content matching cannot be mechanical; a bare symbol against an
// identifier index of the engine / kairos / scripts trees (built once, cached, and
// read from DECLARATIONS — `PinSource` — never from raw bytes); and a test title
// against the named test file's bytes.
//
// The time face (§7.3) rides the same judgment: a path a plan's `Create:` line
// declares, that the tree has not landed, and that the plan has not been closed on is
// PENDING — not dead. `ForwardPaths` computes that table once and all three corpora
// read it, so one pending path answers identically wherever it is judged.
//
// A MEMBER reference is a spelling of the bare-symbol shape, not a fourth shape (§7.1):
// the symbol index is a flat identifier set, so a member written with its carrier in one
// token (`HandoffSchema.gradingViolations` · `BoardView#summaryToken`) is judged in two
// halves — the carrier by the bare path / bare symbol sieve, the member by the same
// symbol shape test — and either half failing to resolve is one finding. The shape stays
// `symbol`, so the census reading is unchanged by this spelling. An empty carrier is not
// a member reference (`#reconstruct` names its own symbol, `#` is its prefix), so that
// token falls back to the whole-token symbol judgment.
//
// The corpus declaration (§7.1) lives HERE as `corpusOf(root)`, so the scan, the
// structural test and the census read one declaration rather than three copies of a
// list. The README half expands `packages/` at CALL time: `face/lifecycle.ts` imports
// this module on every `cdd` command, and a consumer's installed tree has no
// `packages/` directory, so a module-scope file-system read would throw on load.
//
// `PinAudit.census` is the ONE census accessor (§8.2): four readings off the same scan,
// never a second parse. The registry that exposes them is `contract/census.ts`.
//
// Zero document structure and zero semantics are judged here: this is the narrow form
// of the P28 reversal, not a docs corpus validator.
//
// Module-level exports are types / the declared vocabularies / the classes — zero
// behavior-carrying bare functions.

import { readdirSync, readFileSync, type Stats, statSync } from "node:fs";
import path from "node:path";
import { ENGINE_DOC_ROOTS } from "../infra/doc-roots.ts";
import { SlugIndex } from "../infra/slug-index.ts";
import { ArtifactRegistry } from "../session/round-artifacts.ts";
import { docTypeParsers, type OverallParsed } from "./doc.ts";
import { FrontMatterExtractor, type FrontMatterHead } from "./frontmatter.ts";

/** Which of the three pin shapes failed to resolve (§7.1). A member reference is
 *  reported as `symbol` — it is that shape written across two halves. */
export type PinShape = "path" | "symbol" | "test";

/** One dead pin — the token, the shape, the document and the finding summary the
 *  read-back injects (warn · the judged face's own declared pin lens, see
 *  `render/templates.ts#pinLensOf`). */
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

/** One member reference: the carrier half and the member half of one symbol token. */
export interface PinMember {
  readonly carrier: string;
  readonly member: string;
}

/** The four census readings (§8.2) — one number each, taken off ONE scan and ONE
 *  corpus walk: `symbol` and `path` are the finding counts by shape (`path` covers the
 *  test pins too), `total` is that scan's finding count, and `files` is the corpus
 *  SIZE — a volume, never a fifth finding count. */
export interface PinCensus {
  readonly symbol: number;
  readonly path: number;
  readonly total: number;
  readonly files: number;
}

/** The three tiers of path resolution (§7.1): the exact entry wins, else the unique
 *  suffix, else the pin is ambiguous — the gate never picks a candidate for the
 *  document. */
export type PathResolution =
  | { readonly kind: "resolved"; readonly entry: string }
  | { readonly kind: "ambiguous"; readonly candidates: readonly string[] }
  | { readonly kind: "absent" };

/** One plan's forward declarations (§7.3 condition ①): the `slug:` it declares, the
 *  `program:` values its same-slug identity documents declare, and the paths its
 *  `Create:` lines write. */
interface PlanForward {
  readonly slug: string;
  readonly programs: readonly string[];
  readonly paths: readonly string[];
}

/** One document of the three doc roots — its front matter plus its body, the DECLARED
 *  facts §7.3 reads (never a file name). */
interface DocHead {
  readonly rel: string;
  readonly head: FrontMatterHead;
  readonly body: string;
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

/** The directories a walk never descends into — build output, VCS internals and the
 *  machine-local workspace products name no pin (and reading them would let a local
 *  `.kairos/` file make a coordinate resolve, which is exactly the reading §7.3's
 *  migration exists to stop depending on). */
const SKIP_DIRS: ReadonlySet<string> = new Set([".git", ".kairos", "node_modules", "dist", ".pi"]);

/** The README family's package half — every `packages/<dir>/README*.md`, expanded from
 *  the tree at CALL time so the declaration stays a rule and never a list. A caller
 *  whose root carries no `packages/` directory (a consumer's installed tree) gets no
 *  package READMEs instead of a throw: the expansion is a corpus question, not a load
 *  precondition. */
const packageReadmesOf = (root: string): readonly string[] => {
  try {
    return readdirSync(path.join(root, "packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) =>
        readdirSync(path.join(root, "packages", entry.name))
          .filter((name) => /^README.*\.md$/.test(name))
          .map((name) => `packages/${entry.name}/${name}`),
      );
  } catch {
    return [];
  }
};

/** The §7.1 corpus declaration — the ONE place the judged markdown roots are written:
 *  the docs tree plus the README family, no baseline, no allowlist, no exemption. The
 *  root comes from the caller (`face/cli.ts#rootOf()` in production, the test's own
 *  `import.meta.url` root in the suite); this module never resolves one for itself. */
export const corpusOf = (root: string): readonly string[] => [
  "docs/kairos",
  "README.md",
  "README.zh-CN.md",
  ...packageReadmesOf(root),
];

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

  /** A member reference — the bare-symbol shape written across two halves (§7.1). The
   *  trailing call arguments are prose about the call, so they are peeled first. A token
   *  carrying a `#` splits at its LAST `#` (a path carrier carries dots of its own),
   *  otherwise at its FIRST `.`. An EMPTY carrier is not a member reference: a token that
   *  starts with `#` puts the boundary at index 0, and there `#` is the symbol's own
   *  prefix — the caller falls back to the whole-token symbol judgment rather than
   *  reading an empty carrier. Both halves must pass their own sieve; a half that is
   *  prose makes the whole token prose.
   */
  static memberOf(token: string): PinMember | null {
    const head = token.replace(/\([^()]*\)$/, "");
    const boundary = head.lastIndexOf("#") !== -1 ? head.lastIndexOf("#") : head.indexOf(".");
    if (boundary <= 0) return null;
    const carrier = head.slice(0, boundary);
    const member = head.slice(boundary + 1);
    if (PinVocabulary.pathOf(carrier) === null && !PinVocabulary.isSymbol(carrier)) return null;
    if (!PinVocabulary.isSymbol(member)) return null;
    return { carrier, member };
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

  /** The repo entry a pin's path resolves to, across §7.1's three tiers. A suffix
   *  match lets a doc write the tail of a long path; tier ① keeps an EXACT spelling
   *  from falling into a shorter same-tailed sibling (`README.md` is the repo root
   *  copy, never `.changeset/README.md`), and tier ③ reports every candidate instead
   *  of silently choosing a first hit. */
  resolve(pinPath: string): PathResolution {
    const normalized = PinIndex.normalize(pinPath);
    if (normalized.length === 0) return { kind: "absent" };
    const entries = this.entries();
    if (entries.includes(normalized)) return { kind: "resolved", entry: normalized };
    const candidates = entries.filter((entry) => entry.endsWith(`/${normalized}`));
    if (candidates.length === 1) return { kind: "resolved", entry: candidates[0]! };
    if (candidates.length > 1) return { kind: "ambiguous", candidates };
    return { kind: "absent" };
  }

  /** The ONE spelling of a pin path's normalization — a leading `./` and trailing
   *  slashes are prose, not coordinates. */
  static normalize(pinPath: string): string {
    return pinPath.replace(/^\.\//, "").replace(/\/+$/, "");
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
 * ForwardPaths — §7.3's time face: the paths a plan's `Create:` lines declare while the
 * tree has not landed them yet. The judgment lives HERE, once, and the three corpora
 * (`scan` · `scanText` · `pathResolves`) read the same table — a pending path therefore
 * answers identically wherever it is judged, which is what lets the pin census be one
 * reading rather than three.
 *
 * Three conditions, all read from DECLARED values (§7.3): the declaring plan shares an
 * identity key with the judged document, the path is absent from the tree (the caller
 * asks only after resolution failed), and the plan has not been closed by its program's
 * `## Phase inventory` row. A repository with no closure face — a single-spec, or a
 * charter without that table — is bounded by the DECLARATION itself: a plan still on the
 * tree and still writing the line is not closed.
 *
 * The identity facts are read from the documents' own front matter, never from file names
 * and never through a second `SlugIndex`: P36's guard keeps the identity index to the
 * command preamble's three sites, and `#reconstruct` builds none (its own note), so this
 * face reads the same DECLARED values that index groups by. The slug grammar is still
 * `SlugIndex.isLegalSlug` — one spelling of the value judgment.
 */
export class ForwardPaths {
  readonly #index: PinIndex;
  #heads: readonly DocHead[] | null = null;
  #plans: readonly PlanForward[] | null = null;
  readonly #pending = new Map<string, readonly string[]>();

  constructor(index: PinIndex) {
    this.#index = index;
  }

  /** Whether the judged document's own plan declares this absent path and has not been
   *  closed on it (§7.3). A `null` judged document — a wave / branch round — has no
   *  subject for condition ①, so the skip never holds there. */
  skips(pinPath: string, judged: string | null): boolean {
    if (judged === null) return false;
    const normalized = PinIndex.normalize(pinPath);
    return this.#pendingOf(judged).some(
      (declared) => declared === normalized || declared.endsWith(`/${normalized}`),
    );
  }

  /** The pending paths of one judged document — one table per identity, memoized, so a
   *  corpus scan pays one computation rather than one per token. */
  #pendingOf(judged: string): readonly string[] {
    const cached = this.#pending.get(judged);
    if (cached !== undefined) return cached;
    const slug = this.#headsOf().find((head) => head.rel === judged)?.head.slug ?? null;
    const paths =
      slug === null
        ? []
        : this.#plansOf()
            .filter((plan) => ForwardPaths.#shares(plan, slug) && !this.#isClosed(plan))
            .flatMap((plan) => plan.paths);
    this.#pending.set(judged, paths);
    return paths;
  }

  /** Condition ① — the judged document's `slug:` equals the plan's, or the `program:`
   *  its same-slug identity document declares. */
  static #shares(plan: PlanForward, slug: string): boolean {
    return plan.slug === slug || plan.programs.includes(slug);
  }

  /** Condition ③ — the plan's program charter names it in a `✔ Done（…）` row. */
  #isClosed(plan: PlanForward): boolean {
    return plan.programs.some((program) => this.#closedBy(program, plan.slug));
  }

  /** Whether one program's charter closes the plan: the `Implementation plan` cell is
   *  written `✔ Done（`file` · date）` and that FILE NAME resolves to exactly one
   *  indexed document whose `slug:` is the plan's. Zero or several hits read as CLOSED —
   *  a registration that no longer resolves cannot establish "not closed", so a dead
   *  `✔ Done` row never buys a silent skip. */
  #closedBy(program: string, slug: string): boolean {
    const heads = this.#headsOf();
    const charter = heads.find(
      (head) => head.head.slug === program && head.head.docType === "overall",
    );
    if (charter === undefined) return false;
    const parsed = docTypeParsers.overall.parse(
      charter.body.split("\n"),
      charter.head,
    ) as OverallParsed;
    if (parsed.tables["Phase inventory"].headerRow === null) return false;
    for (const phase of parsed.chain.phases) {
      const done = /✔ Done（`(?<file>[^`]+)`/.exec(phase.planCell)?.groups?.file;
      if (done === undefined) continue;
      const hits = heads.filter((head) => path.basename(head.rel) === done);
      if (hits.length !== 1 || hits[0]?.head.slug === slug) return true;
    }
    return false;
  }

  /** One declaration table per audit instance — every plan that writes a `Create:`
   *  line, with the identity keys condition ① compares. */
  #plansOf(): readonly PlanForward[] {
    if (this.#plans !== null) return this.#plans;
    const heads = this.#headsOf();
    const plans: PlanForward[] = [];
    for (const head of heads) {
      const slug = head.head.slug;
      if (head.head.docType !== "plan" || !SlugIndex.isLegalSlug(slug)) continue;
      const paths = ForwardPaths.#declaredPathsOf(head.body);
      if (paths.length === 0) continue;
      plans.push({ slug, programs: ForwardPaths.#programsOf(heads, slug), paths });
    }
    this.#plans = plans;
    return plans;
  }

  /** The `program:` values the plan's same-slug identity documents declare — the second
   *  identity key, which lives on the identity document and never on the plan. */
  static #programsOf(heads: readonly DocHead[], slug: string): readonly string[] {
    const programs: string[] = [];
    for (const head of heads) {
      if (head.head.slug !== slug || head.head.docType === "plan") continue;
      const program = head.head.program;
      if (program === null || programs.includes(program)) continue;
      programs.push(program);
    }
    return programs;
  }

  /** The paths one plan body's `Create:` lines write — path-shaped spans only, so the
   *  parenthetical prose beside a declaration is never mistaken for one. */
  static #declaredPathsOf(body: string): readonly string[] {
    const paths: string[] = [];
    for (const line of body.split("\n")) {
      if (!/^\s*[-*]\s+Create:/.test(line)) continue;
      for (const token of PinSpans.tokensOf(line)) {
        const form = PinVocabulary.pathOf(token);
        if (form === null || paths.includes(form.path)) continue;
        paths.push(form.path);
      }
    }
    return paths;
  }

  /** The declared heads of the three doc roots — one read pass, memoized. */
  #headsOf(): readonly DocHead[] {
    if (this.#heads !== null) return this.#heads;
    const heads: DocHead[] = [];
    for (const rel of this.#index.entries()) {
      if (!rel.endsWith(".md") || !ForwardPaths.#inDocRoots(rel)) continue;
      const text = this.#index.textOf(rel);
      if (text === null) continue;
      const { head, body } = FrontMatterExtractor.split(text);
      heads.push({ rel, head, body });
    }
    this.#heads = heads;
    return heads;
  }

  /** Whether one repo-relative path lies inside a declared doc root — path grammar only. */
  static #inDocRoots(rel: string): boolean {
    return Object.values(ENGINE_DOC_ROOTS).some((root) => rel.startsWith(`${root}/`));
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
  readonly #forward: ForwardPaths;

  constructor(root: string) {
    this.#root = root;
    this.#index = new PinIndex(root);
    this.#forward = new ForwardPaths(this.#index);
  }

  /** One corpus file's text — the read the scan and the census gate share, so a second
   *  reader never opens the corpus through a mechanism of its own. */
  textOf(entry: string): string | null {
    return this.#index.textOf(entry);
  }

  /** The four census readings (§8.2) — one scan and one corpus walk, so `total` is
   *  that scan's length rather than a second count and `files` is the corpus volume.
   *  The roots are the caller's already-resolved corpus (`corpusOf(root)`); this class
   *  never names a root of its own. */
  census(roots: readonly string[]): PinCensus {
    // Rule zero (class-size limit): this file is past the limit and predates it —
    // splitting it is P39's work (design spec D95 ②), not this round's.
    const findings = this.scan(roots);
    const files = this.filesOf(roots);
    const symbol = findings.filter((finding) => finding.shape === "symbol").length;
    const path = findings.filter(
      (finding) => finding.shape === "path" || finding.shape === "test",
    ).length;
    return { symbol, path, total: findings.length, files: files.length };
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
      const finding = this.#judge(token, source, source);
      if (finding !== null) findings.push(finding);
    }
    return findings;
  }

  /** Whether one declared coordinate resolves — the `contract.path` corpus' one
   *  question. A path with a line suffix is judged on its path alone (the handoff
   *  anchor owns the line, the gate owns the coordinate). §7.3's time face applies
   *  here too: a pending `Create:` declaration of the JUDGED document's own plan is
   *  not dead — `null` judged (a wave / branch round) has no subject for that
   *  condition, so a pending path stays a finding there. */
  pathResolves(pinPath: string, judged: string | null): boolean {
    const form = PinVocabulary.pathOf(pinPath);
    const path = form?.path ?? pinPath;
    if (this.#index.resolve(path).kind === "resolved") return true;
    return this.#forward.skips(path, judged);
  }

  /** One token's judgment — the test shape first (it also ends in `.ts`), then the path
   *  shape, then the bare symbol; anything else is prose, not a pin. `judged` is the
   *  document the round judges (§7.3 condition ①'s subject) — `scan` and `scanText`
   *  pass their own `source`, because that source IS the judged document. */
  #judge(token: string, source: string, judged: string | null): PinFinding | null {
    if (!PinVocabulary.isPin(token)) return null;
    const test = PinVocabulary.testOf(token);
    if (test !== null) {
      const file = this.#index.resolve(test.file);
      if (file.kind !== "resolved") {
        return PinAudit.#finding(
          token,
          "test",
          source,
          file.kind === "ambiguous"
            ? `its test file \`${test.file}\` matches ${file.candidates.length} entries (${file.candidates.join(" · ")})`
            : `its test file \`${test.file}\` is not in the tree`,
        );
      }
      if (this.#index.testContains(file.entry, test.title)) return null;
      return PinAudit.#finding(
        token,
        "test",
        source,
        `\`${file.entry}\` carries no test titled \`${test.title}\``,
      );
    }
    const form = PinVocabulary.pathOf(token);
    if (form !== null) {
      const resolution = this.#index.resolve(form.path);
      if (resolution.kind === "absent") {
        if (this.#forward.skips(form.path, judged)) return null;
        return PinAudit.#finding(
          token,
          "path",
          source,
          `the path \`${form.path}\` is not in the tree`,
        );
      }
      if (resolution.kind === "ambiguous") {
        return PinAudit.#finding(
          token,
          "path",
          source,
          `the path \`${form.path}\` names ${resolution.candidates.length} entries (${resolution.candidates.join(" · ")}), so it points at no single file`,
        );
      }
      const named = form.lastLine ?? form.firstLine;
      const lines = this.#index.lineCountOf(resolution.entry);
      if (named !== undefined && named > lines) {
        return PinAudit.#finding(
          token,
          "path",
          source,
          `\`${resolution.entry}\` has ${lines} lines, so line ${named} does not exist`,
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
    const member = PinVocabulary.memberOf(token);
    if (member === null) return null;
    const carrier =
      PinVocabulary.pathOf(member.carrier) !== null
        ? this.#index.resolve(member.carrier).kind === "resolved"
        : this.#index.symbols().has(member.carrier);
    const memberExists = this.#index.symbols().has(member.member);
    if (carrier && memberExists) return null;
    return PinAudit.#finding(
      token,
      "symbol",
      source,
      carrier
        ? `no symbol named \`${member.member}\` exists in the engine, kairos or scripts trees`
        : `its carrier \`${member.carrier}\` resolves nowhere in the tree`,
    );
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
