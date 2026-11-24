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
// content — content matching cannot be mechanical; a bare symbol against an identifier
// index of the reviewed repo's OWN sources (built once, cached, and read from the code
// body — `PinSource` — never from raw bytes); and a test title against the named test
// file's bytes. The symbol corpus is the repo the judge runs in, because the engine is
// installed into consumer trees that carry none of this repo's paths: a hard-wired root
// list would leave the index empty there and report every live symbol-shaped pin dead.
//
// The time face (§7.3) rides the same judgment: a path a plan's `Create:` line
// declares, that the tree has not landed, and that the plan has not been closed on is
// PENDING — not dead. `ForwardPaths` computes that table once and all three corpora
// read it, so one pending path answers identically wherever it is judged.
//
// A MEMBER reference is a spelling of the bare-symbol shape, not a fourth shape (§7.1):
// a member written with its carrier in one token (`HandoffSchema.gradingViolations` ·
// `BoardView#summaryToken`) is judged in two halves — the carrier names ONE file, and
// the member is judged THERE (§9). A path carrier resolves to its entry; a bare class
// name rides the same table's reverse direction (`PinIndex.declaringEntries`), which
// lands on the file that DECLARES it — zero or several declarers name no single file,
// and that is one finding, never a picked candidate. The member itself is read by
// `PinDeclarations`, a declaration recognizer rather than the identifier index: a name
// counts as "in that file" when it is BOUND there or declared as a body key, so a
// fixture string spelling a class declares nothing, and a name a file merely calls is
// not one of its members. A carrier that resolves to a DATA file (`package.json`) has
// no member slot — the recognizer reads code bodies and a data file's keys are string
// literals — so that form judges ZERO findings: a narrowed domain, registered in §9,
// not a pass. §7.3's time face rides the carrier half unchanged: §7.1 sieves that half
// by the bare path form, so the carrier IS the pending path a plan's `Create:` line
// declares, and it answers here as it answers there (the member half is not consulted —
// a path the tree has not landed declares no members). The shape stays `symbol`, so the
// census reading is unchanged by this spelling. An empty carrier is not a member
// reference (`#reconstruct` names its own symbol, `#` is its prefix), so that token
// falls back to the whole-token symbol judgment.
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
import { ClosedDocument } from "./closed-document.ts";
import { docTypeParsers, type OverallParsed } from "./doc.ts";
import { FrontMatterExtractor, type FrontMatterHead } from "./frontmatter.ts";
import { ProseSpans } from "./markdown-spans.ts";
import { PathShape } from "./shape-rules.ts";

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

/** One code file's declaration reading (§9): the two columns the member face reads.
 *  `bindings` is the declaration column — a class / interface / type / const / function /
 *  enum declared HERE, at any scope, so a function-local `const` is a binding too (the
 *  bare-carrier reverse lookup needs that: `const planSource` in two files is two
 *  declarations). An import clause declares nothing, so it is never read. `members` is
 *  the member column — a property or method key of a class body, an interface body, a
 *  type literal or an object literal, with a leading `#` stripped so a private member
 *  answers to the name its pin writes. */
export interface PinDeclarationSet {
  readonly bindings: ReadonlySet<string>;
  readonly members: ReadonlySet<string>;
}

/** The four census readings (§8.2) — one number each, taken off ONE scan and one file
 *  listing: `symbol` and `path` are the finding counts by shape (`path` covers the test
 *  pins too), `total` is that scan's finding count, and `files` is the corpus SIZE — a
 *  volume, never a fifth finding count. */
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

/** The directories a walk never descends into — build output, VCS internals and the
 *  machine-local workspace products name no pin (and reading them would let a local
 *  `.kairos/` file make a coordinate resolve, which is exactly the reading §7.3's
 *  migration exists to stop depending on). The same list keeps an installed copy of the
 *  engine out of the symbol index: `node_modules/` is a dependency, not a declaration of
 *  the reviewed tree. */
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

  // The placeholder judgment (`isPattern`) and the path shape (`pathOf`) moved to
  // `contract/shape-rules.ts#PathShape` — the rule plane owns them now, and this module
  // retires with the pin gate. Nothing is re-spelled here.

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
    if (PathShape.pathOf(carrier) === null && !PinVocabulary.isSymbol(carrier)) return null;
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

// The markdown reader moved to `contract/markdown-spans.ts#ProseSpans` — the fence and
// span judgments live there once, and the shape rules, the sentence index and this
// module's scan all read them from that one place.

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
 * PinDeclarations — the declaration recognizer (§9): what a source file BINDS and what
 * its bodies DECLARE as keys. Its input is the code body, not the raw bytes —
 * `PinSource.codeOf` first (comments and regex bodies blanked, so a name kept alive only
 * by a comment is not a declaration), then one step further: string and template
 * literals are blanked too. That second step is the recognizer's own, and it is why the
 * reader is not the identifier index at all: `PinSource` KEEPS literals because the
 * symbol face reads values (`CDD_BLOCKED:` is declared as a literal), while a member
 * face wants bindings — a fixture string spelling `export class HandoffSchema {` declares
 * nothing in the file that quotes it.
 *
 * Two columns, one scan. The declaration column is the six binding forms a name can be
 * introduced by (class · interface · type · const · function · enum) wherever they
 * appear; an `import` clause is skipped whole, because it names a binding rather than
 * making one. The member column is the four body shapes a key is declared in — a class
 * body, an interface body, a type literal, and an object literal's property keys — read
 * by brace scope, so a name merely CALLED inside a method body is not a member of the
 * class that holds it.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the declaration reader is a declared static reader set — the repo's zero-bare-function discipline admits no standalone parser.
export class PinDeclarations {
  /** One source text's two columns. */
  static of(source: string): PinDeclarationSet {
    const tokens = PinDeclarations.#tokensOf(
      PinDeclarations.#literalFreeOf(PinSource.codeOf(source)),
    );
    const bindings = new Set<string>();
    const members = new Set<string>();
    const scopes: { readonly kind: string; readonly parens: number }[] = [];
    let parens = 0;
    let pending: string | null = null;
    let previous = "";
    for (let at = 0; at < tokens.length; at += 1) {
      const token = tokens[at]!;
      if (token === "import") {
        // an import clause names a binding, it never makes one — skip to its terminator
        while (at < tokens.length && tokens[at] !== ";") at += 1;
        previous = ";";
        continue;
      }
      if (token === "(" || token === "[") parens += 1;
      else if (token === ")" || token === "]") parens -= 1;
      else if (token === "{") {
        scopes.push({ kind: pending ?? PinDeclarations.#braceKindOf(previous), parens });
        pending = null;
      } else if (token === "}") scopes.pop();
      else if (token === "class" || token === "interface") pending = token;
      else if (token === "type" && PinDeclarations.#isAliasHead(tokens, at)) pending = "type";
      PinDeclarations.#readBinding(tokens, at, bindings);
      PinDeclarations.#readMember(tokens, at, scopes, parens, members);
      previous = token;
    }
    return { bindings, members };
  }

  /** The declaration column's six binding forms — the keyword plus the name it introduces. */
  static #readBinding(tokens: readonly string[], at: number, bindings: Set<string>): void {
    const keyword = tokens[at];
    if (keyword === undefined) return;
    const known =
      keyword === "class" ||
      keyword === "interface" ||
      keyword === "enum" ||
      keyword === "function" ||
      keyword === "const" ||
      (keyword === "type" && PinDeclarations.#isAliasHead(tokens, at));
    if (!known) return;
    if (keyword === "const") {
      PinDeclarations.#readConstBindings(tokens, at + 1, bindings);
      return;
    }
    const name = PinDeclarations.#nameAfter(tokens, at + 1);
    if (name !== null) bindings.add(name);
  }

  /** Every name one `const` introduces — a plain identifier, or each name a DESTRUCTURING
   *  pattern binds (`const { Cli } = require("../dist/cli.cjs")`, the everyday `.cjs`
   *  idiom). A destructured `const` is one of the six declared forms, so a pattern that
   *  binds nothing reads a bound carrier as "resolves nowhere in the tree". */
  static #readConstBindings(tokens: readonly string[], at: number, bindings: Set<string>): void {
    const head = tokens[at];
    if (head === "{" || head === "[") {
      for (const name of PinDeclarations.#patternBindingsOf(tokens, at)) bindings.add(name);
      return;
    }
    const name = PinDeclarations.#nameAfter(tokens, at);
    if (name !== null) bindings.add(name);
  }

  /** Every name a destructuring pattern BINDS — a shorthand key, a renamed key's value
   *  half, a default's target and a rest element all answer one rule, so `{ a }` ·
   *  `{ a: b }` · `{ a = 1 }` · `{ ...rest }` · `[{ a: { b } }]` each read. A pattern's own
   *  KEYS bind nothing. */
  static #patternBindingsOf(tokens: readonly string[], at: number): readonly string[] {
    const names: string[] = [];
    let depth = 0;
    for (let cursor = at; cursor < tokens.length; cursor += 1) {
      const token = tokens[cursor]!;
      if (token === "{" || token === "[") depth += 1;
      else if (token === "}" || token === "]") {
        depth -= 1;
        if (depth === 0) break;
      } else if (depth > 0 && IDENTIFIER.test(token)) {
        if (PinDeclarations.#bindsInPattern(tokens, cursor)) names.push(token);
      }
    }
    return names;
  }

  /** Whether one identifier inside a destructuring pattern sits in BINDING position — a
   *  shorthand key, a renamed key's value half, a default's target, or a rest element. */
  static #bindsInPattern(tokens: readonly string[], at: number): boolean {
    const next = tokens[at + 1];
    const previous = tokens[at - 1];
    return (
      next === "," ||
      next === "}" ||
      next === "]" ||
      next === "=" ||
      previous === ":" ||
      previous === "..."
    );
  }

  /** The member column — a key read at the TOP level of a class / interface / type / object
   *  brace, in a declaration shape (`key:` · `key?:` · `key(` · `key<T>(` · `key =`). The
   *  key must also sit in KEY POSITION: the follower alone cannot tell a key from the type
   *  or value beside it (`readonly d: MissingType;` ends on `;` exactly as a shorthand key
   *  does, and a name after a colon is neither a binding nor a member). */
  static #readMember(
    tokens: readonly string[],
    at: number,
    scopes: readonly { readonly kind: string; readonly parens: number }[],
    parens: number,
    members: Set<string>,
  ): void {
    const token = tokens[at];
    const scope = scopes[scopes.length - 1];
    if (token === undefined || scope === undefined) return;
    if (!PinDeclarations.#isBody(scope.kind) || scope.parens !== parens) return;
    if (!IDENTIFIER.test(token)) return;
    const next = tokens[at + 1];
    if (next === undefined || !MEMBER_KEY_FOLLOWERS.has(next)) return;
    if (!PinDeclarations.#opensMember(tokens[at - 1])) return;
    members.add(token.replace(/^#/, ""));
  }

  /** Whether a token can PRECEDE a member key — a body's brace, a separator, a decorator's
   *  `@`, a generator's `*`, a modifier keyword, or the file's own start. Any other
   *  token sits inside the previous member's type or value, so the name after it is a
   *  type or a value and never a key. */
  static #opensMember(previous: string | undefined): boolean {
    if (previous === undefined) return true;
    return MEMBER_KEY_PRECEDERS.has(previous) || MEMBER_MODIFIERS.has(previous);
  }

  /** The name one keyword introduces, skipping a generator's `*`. */
  static #nameAfter(tokens: readonly string[], at: number): string | null {
    const first = tokens[at] === "*" ? tokens[at + 1] : tokens[at];
    if (first === undefined || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(first)) return null;
    return first;
  }

  /** Whether a `type` token opens an ALIAS (`type X = …` · `type X<…> = …`) rather than
   *  naming a re-exported or imported binding (`export type { X }` · `{ type X }`). */
  static #isAliasHead(tokens: readonly string[], at: number): boolean {
    const name = tokens[at + 1];
    const after = tokens[at + 2];
    return (
      name !== undefined &&
      /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) &&
      (after === "=" || after === "<")
    );
  }

  /** Whether a brace of this kind carries member keys. */
  static #isBody(kind: string): boolean {
    return kind === "class" || kind === "interface" || kind === "type" || kind === "object";
  }

  /** The kind of one `{`, read from the token before it: an expression position opens an
   *  OBJECT literal, everything else opens a block (a body, a statement). */
  static #braceKindOf(previous: string): string {
    return OBJECT_BRACE_STARTS.has(previous) ? "object" : "block";
  }

  /** One text with every string / template literal blanked, length- and line-preserving.
   *  This is the recognizer's own step ON TOP of `PinSource.codeOf`: a literal is a value
   *  the symbol face reads and a declaration the member face must not invent. */
  static #literalFreeOf(code: string): string {
    const out = code.split("");
    let at = 0;
    while (at < code.length) {
      const char = code[at]!;
      if (char !== "'" && char !== '"' && char !== "`") {
        at += 1;
        continue;
      }
      const start = at;
      at += 1;
      while (at < code.length && code[at] !== char) {
        if (code[at] === "\\") at += 1;
        at += 1;
      }
      at += 1;
      for (let blank = start; blank < Math.min(at, out.length); blank += 1) {
        if (out[blank] !== "\n") out[blank] = " ";
      }
    }
    return out.join("");
  }

  /** One code body as tokens — identifiers (`#`-prefixed kept whole), the multi-character
   *  operators the brace and key readers distinguish, and single punctuation characters.
   *  Numbers are consumed and dropped: no column reads a quantity. */
  static #tokensOf(code: string): readonly string[] {
    const tokens: string[] = [];
    let at = 0;
    while (at < code.length) {
      const char = code[at]!;
      const head = code.slice(at, at + 3);
      const operator = MULTI_CHAR_OPERATORS.find((candidate) => head.startsWith(candidate));
      if (operator !== undefined) {
        tokens.push(operator);
        at += operator.length;
        continue;
      }
      if (char === "#" && /[A-Za-z_$]/.test(code[at + 1] ?? "")) {
        const start = at;
        at += 1;
        while (/[A-Za-z0-9_$]/.test(code[at] ?? "")) at += 1;
        tokens.push(code.slice(start, at));
        continue;
      }
      if (/[A-Za-z_$]/.test(char)) {
        const start = at;
        while (/[A-Za-z0-9_$]/.test(code[at] ?? "")) at += 1;
        tokens.push(code.slice(start, at));
        continue;
      }
      if (/[0-9]/.test(char)) {
        while (/[0-9._]/.test(code[at] ?? "")) at += 1;
        continue;
      }
      if (/\s/.test(char)) {
        at += 1;
        continue;
      }
      tokens.push(char);
      at += 1;
    }
    return tokens;
  }
}

/** The operators one token wide enough to matter to the brace and key readers — a spread
 *  opens an expression position, `=>` opens a BODY, and the three logical operators both
 *  continue an expression and test it. */
const MULTI_CHAR_OPERATORS: readonly string[] = ["...", "=>", "&&", "||", "??"];

/** One identifier token — the shape both declaration columns read, `#`-prefixed for a
 *  private name. */
const IDENTIFIER = /^#?[A-Za-z_$][A-Za-z0-9_$]*$/;

/** The tokens that follow a member key in a declaration shape — a colon, an optional
 *  marker, a call / generic head, an initializer, or a body terminator (the shorthand a
 *  key's own line ends on). */
const MEMBER_KEY_FOLLOWERS: ReadonlySet<string> = new Set([
  ":",
  "?",
  "(",
  "<",
  "=",
  "!",
  ",",
  ";",
  "}",
]);

/** The tokens a member key can FOLLOW — a body's brace, a separator, a decorator's `@`,
 *  or a generator's `*`. Without this half the follower alone reads a field's TYPE as a
 *  key, because `readonly d: MissingType;` ends on `;` exactly as a shorthand key does. */
const MEMBER_KEY_PRECEDERS: ReadonlySet<string> = new Set(["{", "}", ";", ",", "*", "@"]);

/** The modifier keywords a member key follows inside one member sequence. */
const MEMBER_MODIFIERS: ReadonlySet<string> = new Set([
  "readonly",
  "static",
  "get",
  "set",
  "async",
  "public",
  "private",
  "protected",
  "override",
  "abstract",
  "declare",
  "accessor",
]);

/** The tokens an object literal's `{` can follow — an expression position, as opposed to
 *  a body (`)` · `=>` · `else` · a statement start). */
const OBJECT_BRACE_STARTS: ReadonlySet<string> = new Set([
  "=",
  "(",
  ",",
  ":",
  "[",
  "?",
  "??",
  "&&",
  "||",
  "...",
  "as",
  "satisfies",
  "return",
  "default",
  "const",
  "let",
  "var",
]);

/** The empty declaration reading — a data file (a `package.json`) declares no binding and
 *  no member key this reader can see, which is what makes its member pins judge ZERO
 *  (design spec §9's narrowed domain), not one. */
const EMPTY_DECLARATIONS: PinDeclarationSet = { bindings: new Set(), members: new Set() };

/**
 * PinIndex — the resolution face: the repo's own entry list (files and directories, for
 * suffix resolution and the symbol index's source files), and the per-file reads the
 * line-count and test-title shapes need. Everything is built lazily and cached, so one
 * audit instance pays the walk once.
 */
export class PinIndex {
  readonly #root: string;
  #entries: readonly string[] | null = null;
  #symbols: ReadonlySet<string> | null = null;
  readonly #lineCounts = new Map<string, number>();
  readonly #declarations = new Map<string, PinDeclarationSet>();
  #declarers: ReadonlyMap<string, readonly string[]> | null = null;

  constructor(root: string) {
    this.#root = root;
  }

  /** Every repo entry (file or directory), repo-relative — the path shape's corpus. */
  entries(): readonly string[] {
    this.#entries ??= PinIndex.#walk(this.#root, this.#root);
    return this.#entries;
  }

  /** The identifier set of the reviewed repo's own sources — the symbol shape's corpus.
   *  It rides the entry walk the path shape already pays for, so the symbols the gate
   *  accepts are declared in the tree the judged documents describe; no root list is
   *  hard-wired, because the engine runs inside consumer repos whose sources live under
   *  paths this repo never names (`src/`, `lib/`), and an index built from such a list is
   *  empty there. Identifiers come from the code body (`PinSource.codeOf`), never from raw
   *  bytes: a name kept alive only by a comment or a guard test's own regex is prose
   *  about the name, not the name being there. A private member indexes as
   *  `artifactCellOf` (`#` is not an identifier character), which is why `isSymbol`
   *  strips it too. */
  symbols(): ReadonlySet<string> {
    if (this.#symbols !== null) return this.#symbols;
    const symbols = new Set<string>();
    for (const entry of this.entries()) {
      if (!PinIndex.#isSource(entry)) continue;
      const text = this.textOf(entry);
      if (text === null) continue;
      for (const match of PinSource.codeOf(text).matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
        symbols.add(match[0]);
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
    const normalized = PathShape.normalize(pinPath);
    if (normalized.length === 0) return { kind: "absent" };
    const entries = this.entries();
    if (entries.includes(normalized)) return { kind: "resolved", entry: normalized };
    const candidates = entries.filter((entry) => entry.endsWith(`/${normalized}`));
    if (candidates.length === 1) return { kind: "resolved", entry: candidates[0]! };
    if (candidates.length > 1) return { kind: "ambiguous", candidates };
    return { kind: "absent" };
  }

  /** One entry's text, null when it cannot be read (a directory, a vanished file). */
  textOf(entry: string): string | null {
    try {
      return readFileSync(path.join(this.#root, entry), "utf8");
    } catch {
      return null;
    }
  }

  /** One entry's line count — 0 when it cannot be read. A closing newline ENDS the last
   *  line instead of opening a phantom one, so a pin naming `last + 1` is dead rather
   *  than one-line lenient. */
  lineCountOf(entry: string): number {
    const cached = this.#lineCounts.get(entry);
    if (cached !== undefined) return cached;
    const text = this.textOf(entry);
    const count = text === null ? 0 : PinIndex.#linesOf(text);
    this.#lineCounts.set(entry, count);
    return count;
  }

  /** The real lines of one text — its newlines, plus a tail only when the tail is not
   *  empty (`""` has none, `"a\\n"` has one, `"a"` has one). */
  static #linesOf(text: string): number {
    if (text.length === 0) return 0;
    const lines = text.split("\n").length;
    return text.endsWith("\n") ? lines - 1 : lines;
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

  /** One CODE file's declaration reading (§9) — parsed once per entry, memoized, and empty
   *  for anything that is not a code body: a `package.json` carries no binding and no
   *  member key (its keys are string literals), which is the narrowed domain §9 registers
   *  — its member pins judge ZERO rather than a missing member. */
  declarationsOf(entry: string): PinDeclarationSet {
    const cached = this.#declarations.get(entry);
    if (cached !== undefined) return cached;
    const text = PinIndex.isCode(entry) ? this.textOf(entry) : null;
    const parsed = text === null ? EMPTY_DECLARATIONS : PinDeclarations.of(text);
    this.#declarations.set(entry, parsed);
    return parsed;
  }

  /** Whether one file DECLARES the name — a binding or a body key (§9's one member
   *  criterion). An import clause contributes neither: it names a binding, it makes none. */
  declares(entry: string, name: string): boolean {
    const parsed = this.declarationsOf(entry);
    return parsed.bindings.has(name) || parsed.members.has(name);
  }

  /** Every code entry that DECLARES this name — §9's reverse direction, the lookup a bare
   *  class-name carrier rides. Zero or several hits name NO single file, and the caller
   *  reports that rather than picking a candidate (the path shape's tier ③ reading). */
  declaringEntries(name: string): readonly string[] {
    this.#declarers ??= PinIndex.#declarersOf(this);
    return this.#declarers.get(name) ?? [];
  }

  /** The name → declaring entries table, built once off the entry walk the other faces
   *  already pay for. Only BINDINGS are indexed: a member key answers "is it in that
   *  file", never "which file declares this name". */
  static #declarersOf(index: PinIndex): ReadonlyMap<string, readonly string[]> {
    const table = new Map<string, string[]>();
    for (const entry of index.entries()) {
      if (!PinIndex.isCode(entry)) continue;
      for (const name of index.declarationsOf(entry).bindings) {
        const at = table.get(name);
        if (at === undefined) table.set(name, [entry]);
        else at.push(entry);
      }
    }
    return table;
  }

  /** Whether one entry carries a code body the declaration reader can read — the source
   *  vocabulary MINUS the data files (`package.json` is indexed for the symbol face, and
   *  declares nothing for the member face). */
  static isCode(entry: string): boolean {
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry);
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
    const normalized = PathShape.normalize(pinPath);
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
   *  `✔ Done` row never buys a silent skip. The cell GRAMMAR is `ClosedDocument.fileOf`'s
   *  (one spelling of the form, shared with the shape gate's positive reading); only the
   *  polarity (zero / several ⇒ closed) and the plan-cell-only surface are this reader's
   *  own. */
  #closedBy(program: string, slug: string): boolean {
    const charter = this.#headsOf().find(
      (head) => head.head.slug === program && head.head.docType === "overall",
    );
    if (charter === undefined) return false;
    const parsed = docTypeParsers.overall.parse(
      charter.body.split("\n"),
      charter.head,
    ) as OverallParsed;
    if (parsed.tables["Phase inventory"].headerRow === null) return false;
    for (const phase of parsed.chain.phases) {
      const named = ClosedDocument.fileOf(phase.planCell);
      if (named === null) continue;
      const hits = this.#headsOf().filter((head) => path.basename(head.rel) === named);
      const [only] = hits;
      if (hits.length !== 1 || only === undefined) return true;
      if (only.head.slug === slug) return true;
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
      for (const token of ProseSpans.tokensOf(line)) {
        const form = PathShape.pathOf(token);
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
 *
 * Rule zero (over the 200-line class limit): the gate stays one class because the three
 * entry points are ONE criterion over ONE index and ONE pending-path table — `census`
 * reads `scan`'s own length (§8.2), and splitting along the judge / resolve / read seams
 * would hand that same index through a second seam without removing a variation.
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

  /** The four census readings (§8.2) — one scan and one file listing, so `total` is
   *  that scan's length rather than a second count and `files` is the corpus volume.
   *  The roots are the caller's already-resolved corpus (`corpusOf(root)`); this class
   *  never names a root of its own. */
  census(roots: readonly string[]): PinCensus {
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
    for (const token of ProseSpans.tokensOf(text)) {
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
   *  condition, so a pending path stays a finding there.
   *
   *  The pin DEFINITION gates this corpus as it gates the other two: a token the three
   *  §7.1 exclusions leave out (product vocabulary such as `.kairos/cdd/<workspace>/
   *  tasks-1-brief.md`, an ephemeral `.changeset/*.md`) names no tree coordinate, so
   *  there is nothing to resolve. Without that screen a round that anchors a finding on
   *  its own brief reads a dead pin for every such finding. */
  pathResolves(pinPath: string, judged: string | null): boolean {
    if (!PinVocabulary.isPin(pinPath)) return true;
    const form = PathShape.pathOf(pinPath);
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
    const form = PathShape.pathOf(token);
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
        `no symbol named \`${name}\` exists in the sources of this tree`,
      );
    }
    const member = PinVocabulary.memberOf(token);
    if (member === null) return null;
    // the carrier half is sieved by the bare path form, whose three tiers are explicit:
    // an ambiguous basename names EVERY candidate instead of resolving nowhere (tier ③
    // never picks one), exactly as the bare-path branch above reads it
    const carrierResolution =
      PathShape.pathOf(member.carrier) === null ? null : this.#index.resolve(member.carrier);
    if (carrierResolution?.kind === "ambiguous") {
      return PinAudit.#finding(
        token,
        "symbol",
        source,
        `its carrier \`${member.carrier}\` names ${carrierResolution.candidates.length} entries (${carrierResolution.candidates.join(" · ")}), so it points at no single file`,
      );
    }
    // §7.3's time face rides this half too: §7.1 sieves a member's carrier by the bare
    // path form, so the carrier IS that path — a pending `Create:` declaration of the
    // judged document's own plan must answer here exactly as the bare-path branch above
    // answers it, or one pending path answers two ways inside one corpus. The member half
    // is not consulted: a path the tree has not landed declares no members, so demanding
    // one would ask for exactly the coordinate loss the skip exists to prevent.
    // That skip has ONE site — `#carrierEntryOf`'s `absent` arm, which answers it for
    // both carrier spellings. A second test here could only disagree with it later.
    //
    // §9's file attribution: the carrier names ONE file and the member is judged THERE.
    // A path carrier resolves to its entry; a bare class name is looked up in the SAME
    // table's reverse direction, which lands on the file that DECLARES it — zero or
    // several declarers name no single file, and the gate reports that instead of
    // choosing (the bare path's tier ③ reading, one shape over).
    const carrierEntry = this.#carrierEntryOf(member, carrierResolution, judged);
    if (carrierEntry === null) return null;
    if (carrierEntry.kind === "dead") {
      return PinAudit.#finding(
        token,
        "symbol",
        source,
        `its carrier \`${member.carrier}\` resolves nowhere in the tree`,
      );
    }
    if (carrierEntry.kind === "ambiguous") {
      return PinAudit.#finding(
        token,
        "symbol",
        source,
        `its carrier \`${member.carrier}\` is declared in ${carrierEntry.candidates.length} files (${carrierEntry.candidates.join(" · ")}), so it points at no single file`,
      );
    }
    // §9's narrowed domain: a carrier that resolves to a DATA file has no member slot —
    // the recognizer reads code bodies, and a data file's keys are string literals. That
    // form judges zero findings, and the zero is the domain's edge, not a pass.
    if (!PinIndex.isCode(carrierEntry.entry)) return null;
    if (this.#index.declares(carrierEntry.entry, member.member)) return null;
    // The sentence names what was READ — the carrier's own body — because §9's criterion
    // is file-local: "no symbol named X exists in the sources of this tree" is false for
    // the canonical failure (`gate.ts#carrierPath`, the member one file over) and sends
    // the reader grepping a tree that does declare the name.
    return PinAudit.#finding(
      token,
      "symbol",
      source,
      `its carrier \`${member.carrier}\` declares no member \`${member.member}\``,
    );
  }

  /** The ONE file a member pin's carrier half names (§9) — `null` when §7.3's pending skip
   *  already answered, `dead` / `ambiguous` when the carrier resolves to no single file.
   *  Both spellings ride the same reading: a path carrier by `resolve`, a bare class name by
   *  `declaringEntries`, which is the same table read the other way. */
  #carrierEntryOf(
    member: PinMember,
    resolution: PathResolution | null,
    judged: string | null,
  ):
    | { readonly kind: "resolved"; readonly entry: string }
    | { readonly kind: "dead" }
    | { readonly kind: "ambiguous"; readonly candidates: readonly string[] }
    | null {
    if (resolution === null) {
      const declarers = this.#index.declaringEntries(member.carrier);
      const [only] = declarers;
      if (declarers.length === 1 && only !== undefined) return { kind: "resolved", entry: only };
      if (declarers.length === 0) return { kind: "dead" };
      return { kind: "ambiguous", candidates: declarers };
    }
    if (resolution.kind === "resolved") return { kind: "resolved", entry: resolution.entry };
    if (resolution.kind === "absent") {
      return this.#forward.skips(member.carrier, judged) ? null : { kind: "dead" };
    }
    return { kind: "ambiguous", candidates: resolution.candidates };
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
