// packages/cdd-engine/src-next/infra/plan-source.ts
// Task 2 — the plan read + parse + classify seam (design spec §2.1 · §2.4 · §2.7):
// ONE deep class (`PlanSource`) with TWO entries — the derived face (`readFor`,
// `entry.slug` → `${docRoots.plans}/<slug>.md`) and the argv face (`readPath`) —
// and ONE value (`PlanRead`) that carries the behaviour the seven call sites used
// to re-spell. The tri-state is a class (a private discriminant field + a `kind`
// getter + the accessors), never a bare discriminated union: no consumer writes
// `switch (read.kind)` to recover a fact the value already owns.
//
//   · The path basis is the `RepoRoot` conversion pair: every `DocFs` call takes
//     `root.resolve(root.relativize(rel))`, so a plan under a repository sub-
//     directory reads against the injected root — never `process.cwd()` (NodeFs
//     resolves a literal against the process cwd, which would silently read a
//     healthy plan as unreadable).
//   · `undeclared` has exactly one producer — the derived face's own read (a null
//     slug, or a derived path that is not on disk). There is no `undeclared`
//     factory: "this phase has no plan yet" is a real read result, not a value a
//     caller can mint. `readPath` never probes existence, so an absent argv path
//     is an io read failure — the dispatch face keeps today's usage bytes.
//   · The reverse lookup is part of the READ (§2.7): whether `<slug>-design.md`
//     exists decides if this plan names a phase. It is a read fact, not a doc-shape
//     violation — zero rules registered, zero `Finding`, zero new `kind` token. It
//     runs on the argv face only (`readFor`'s entry IS the identity document, so
//     `spec-absent` is structurally unreachable there) and it only probes
//     existence (`DocFs.exists`), never a content predicate.
//
// Module-level exports are types / the class family — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { DocSyntaxError, PlanDocType, type PlanParsed } from "../contract/doc.ts";
import { FrontMatterExtractor, type FrontMatterHead } from "../contract/frontmatter.ts";
import { type DocFs, NodeFs } from "../contract/invariants.ts";
import { TaskGraph } from "../session/graph.ts";
import type { RepoRoot } from "./root.ts";
import { ENGINE_RUNTIME } from "./runtime.ts";
import { type DocEntry, SlugIndex } from "./slug-index.ts";

/** One topological wave of task ids — the plan's `waves()` element (the same
 *  shape `TaskGraph#batches()` derives, named here so the port reads as the spec
 *  spells it). */
export type TaskBatch = readonly number[];

/** The plan-read word port (declared HERE, implemented by `face/words.ts`'s
 *  `Words`): the dependency direction stays face → infra, and the vocabulary stays
 *  single-sourced in the word table. `planReadWord` owns the two read-failure
 *  marks only; the healthy-but-empty mark and the empty program cell are peers,
 *  never folded into the failure vocabulary. */
export interface PlanReadWords {
  /** The read-failure mark of one cause (`io` → `! unreadable`, `syntax` → `! unparseable`). */
  planReadWord(cause: "io" | "syntax"): string;
  /** The healthy plan that carries no task block yet (`(empty plan)`). */
  planEmptyWord(): string;
  /** The spec-absent orphan diagnostic — the plan's slug and the derived spec path. */
  planOrphanSpec(slug: string, specPath: string): string;
  /** The slug-absent diagnostic — the plan parses but declares no identity key. */
  planSlugMissing(): string;
  /** The orphan mark the doc face, the program cell and the plan row fold into. */
  planOrphanWord(): string;
  /** The program face's undeclared cell (`""` — the "no plan" program cell only). */
  readonly cellEmpty: string;
  /** The stderr diagnostic prefix (`CDD_WARN:`), delegated to the station row. */
  readonly warnPrefix: string;
}

/** One plan-read failure — the `unreadable` state's four facts, the ONE place the
 *  accessors take them from. `cause` is a first-class field, not a proxy: a null
 *  `stationPath()` answers both `io` and `undeclared`, and the scene assembly needs
 *  exactly that distinction. `field` is `string | null` (not optional) so "no
 *  field" and "never read" stay distinct in the type. */
export interface PlanFailure {
  /** The plan's repo-relative path (present for both causes). */
  readonly path: string;
  /** The failure class. */
  readonly cause: "io" | "syntax";
  /** The anchored field of a grammar break; null for an io failure. */
  readonly field: string | null;
  /** The grammar break's message, or the io read-failure detail. */
  readonly message: string;
}

/** The reverse-lookup read fact (§2.7): does this plan name a phase? `spec-absent`
 *  is the foldable cause (`! no-spec` + the doc-contract refusal); `slug-absent` is
 *  only a read fact — the identity channel owns its exit code, so this value never
 *  folds it. */
export interface PlanOrphan {
  /** The two causes. */
  readonly cause: "spec-absent" | "slug-absent";
  /** The derived spec path (`spec-absent`), or null when no slug existed to derive from. */
  readonly specPath: string | null;
}

/** The doc-contract refusal — the plan-carrier refusal leg's input (§2.3): the
 *  existing gate id and reason token, never a new one. */
export interface PlanRefusal {
  /** The existing gate id. */
  readonly gate: "doc-contract";
  /** The existing reason token. */
  readonly reason: "doc-contract";
  /** The rendered refusal message (the failure words or the orphan diagnostic). */
  readonly message: string;
}

/** The `undeclared` state — the phase carries no plan (the normal forward gap). */
interface UndeclaredState {
  readonly kind: "undeclared";
}

/** The `unreadable` state — a plan file exists (or was named by argv) but did not
 *  become a document: the bytes did not read, or the grammar refused them. */
interface UnreadableState {
  readonly kind: "unreadable";
  readonly path: string;
  readonly cause: "io" | "syntax";
  readonly field: string | null;
  readonly message: string;
}

/** The `ready` state — one read, one parse, and the eager derivations (§2.1: the
 *  graph is derived from THIS parse, never a second lazy fact source). */
interface ReadyState {
  readonly kind: "ready";
  readonly path: string;
  readonly text: string;
  readonly doc: PlanParsed;
  readonly graph: TaskGraph;
  readonly orphan: PlanOrphan | null;
}

/** The module-private tri-state carried by `PlanRead`. */
type PlanReadState = UndeclaredState | UnreadableState | ReadyState;

/** The undeclared doc-face wave row (`(none)` — today's bytes for "no plan yet"). */
const UNDECLARED_WAVE = "(none)";

/** The cell separator of the plan row (`<path> · <mark>`). */
const MARK_SEPARATOR = " · ";

/**
 * PlanRead — the plan read value, one per document read. Every accessor answers one
 * question the call sites used to re-derive with a `switch`; the producer's share is
 * the degradation literal only (a healthy row / a healthy cell returns `null`, and
 * the assembler keeps its byte-identical path).
 */
export class PlanRead {
  /** The private discriminant — the state is the single source of every accessor. */
  readonly #state: PlanReadState;

  constructor(state: PlanReadState) {
    this.#state = state;
  }

  /** The tri-state discriminant (`undeclared` / `unreadable` / `ready`). */
  get kind(): PlanReadState["kind"] {
    return this.#state.kind;
  }

  /** The plan row's fact (§2.1): `undeclared` → null; `unreadable` and `ready` →
   *  the path (unreadable does not mean pathless). An empty string would disguise
   *  "no document" as "an empty path" and render half a plan row. */
  path(): string | null {
    const state = this.#state;
    return state.kind === "undeclared" ? null : state.path;
  }

  /** The frontier's path (§2.1 · §2.5): the document reads out (its front matter
   *  parsed), NOT "it parses into a graph". `undeclared` → null (no document);
   *  `io` → null (no slug key, so no face is assemblable); `syntax` → the path (the
   *  front matter read out, the plan face assembles, and its doc-contract refusal
   *  is exactly the next face to point at); `ready` → the path. This is today's
   *  per-cause distribution, now a value behaviour. */
  stationPath(): string | null {
    const state = this.#state;
    if (state.kind === "ready") return state.path;
    if (state.kind === "unreadable" && state.cause === "syntax") return state.path;
    return null;
  }

  /** The failure's four facts, the ONE place they are taken from; null unless the
   *  read was `unreadable`. */
  failure(): PlanFailure | null {
    const state = this.#state;
    if (state.kind !== "unreadable") return null;
    return { path: state.path, cause: state.cause, field: state.field, message: state.message };
  }

  /** The document text (the wave brief's and `#targetSlug`'s source); null when not ready. */
  text(): string | null {
    const state = this.#state;
    return state.kind === "ready" ? state.text : null;
  }

  /** The parsed document (the brief's data face); null when not ready. */
  doc(): PlanParsed | null {
    const state = this.#state;
    return state.kind === "ready" ? state.doc : null;
  }

  /** The task graph (the gate's / frontier's / board's one graph input), derived
   *  eagerly from the same parse; null when not ready. */
  graph(): TaskGraph | null {
    const state = this.#state;
    return state.kind === "ready" ? state.graph : null;
  }

  /** The reverse-lookup read fact (§2.7); only an argv-face `ready` read can carry one. */
  orphan(): PlanOrphan | null {
    const state = this.#state;
    return state.kind === "ready" ? state.orphan : null;
  }

  /** The board's wave data; the empty set when not ready (an empty set is NOT a
   *  render signal — `degradedWaveRow` / `cell` own the literals). */
  waves(): readonly TaskBatch[] {
    const state = this.#state;
    return state.kind === "ready" ? state.graph.batches() : [];
  }

  /** The doc-face wave row's degradation literal (§2.4 + the §2.7 fold); null means
   *  "the healthy row is the assembler's", never "nothing to show". */
  degradedWaveRow(words: PlanReadWords): string | null {
    return this.#degradedWord(words, UNDECLARED_WAVE);
  }

  /** The program-face wave cell's literal (§2.4 + the §2.7 fold); `""` is the
   *  undeclared program cell only, and null again hands the healthy cell back. */
  cell(words: PlanReadWords): string | null {
    return this.#degradedWord(words, words.cellEmpty);
  }

  /** The plan row's cell content (§2.1): the degraded shapes carry the path plus
   *  the mark; a healthy `ready` is the bare path; `undeclared` / `slug-absent`
   *  return null (the row falls back to the existing identity bookkeeping). */
  planLine(words: PlanReadWords): string | null {
    const state = this.#state;
    if (state.kind === "undeclared") return null;
    if (state.kind === "unreadable")
      return `${state.path}${MARK_SEPARATOR}${words.planReadWord(state.cause)}`;
    const cause = this.#orphanCause();
    if (cause === "spec-absent") return `${state.path}${MARK_SEPARATOR}${words.planOrphanWord()}`;
    if (cause === "slug-absent") return null;
    return state.path;
  }

  /** The spec row's cell content — the spec-absent orphan only; every other state
   *  (healthy, non-ready, `slug-absent`, undecided) returns null. */
  specLine(words: PlanReadWords): string | null {
    return this.#orphanCause() === "spec-absent" ? words.planOrphanWord() : null;
  }

  /** The board's `CDD_WARN:` line (stderr): the two unreadable causes, the
   *  `spec-absent` orphan and the `slug-absent` fact each produce one; `undeclared`
   *  and a healthy `ready` produce null ("no plan yet" is normal, not a failure). */
  warnLine(words: PlanReadWords): string | null {
    const diagnostic = this.#diagnostic(words);
    return diagnostic === null ? null : `${words.warnPrefix} ${diagnostic}`;
  }

  /** The pre-flight refusal (§2.3): the two unreadable causes and the spec-absent
   *  orphan; `slug-absent` is stopped earlier by the identity channel and the
   *  healthy / undeclared states have nothing to refuse. */
  refusal(words: PlanReadWords): PlanRefusal | null {
    const state = this.#state;
    const message =
      state.kind === "unreadable"
        ? this.#failureWords(words, state)
        : this.#orphanCause() === "spec-absent"
          ? this.#orphanWords(words)
          : null;
    return message === null ? null : { gate: "doc-contract", reason: "doc-contract", message };
  }

  // -------------------------------------------------------------------------
  // the private behaviour — one place per semantic
  // -------------------------------------------------------------------------

  /** The degraded literal both faces share; the undeclared word is the only cell
   *  the two faces spell differently (`(none)` vs the empty program cell). */
  #degradedWord(words: PlanReadWords, undeclared: string): string | null {
    const state = this.#state;
    if (state.kind === "undeclared") return undeclared;
    if (state.kind === "unreadable") return words.planReadWord(state.cause);
    const cause = this.#orphanCause();
    if (cause === "spec-absent") return words.planOrphanWord();
    if (cause === "slug-absent") return null;
    return state.doc.taskBlocks.length === 0 ? words.planEmptyWord() : null;
  }

  /** The ready state's orphan cause, or null (non-ready / healthy / undecided). */
  #orphanCause(): PlanOrphan["cause"] | null {
    const state = this.#state;
    if (state.kind !== "ready") return null;
    return state.orphan?.cause ?? null;
  }

  /** The ready state's declared slug, read off the parsed head it already carries. */
  #slugOf(): string | null {
    const state = this.#state;
    if (state.kind !== "ready") return null;
    return state.doc.head?.slug ?? null;
  }

  /** The failure message of one unreadable state: `<word> <path>[: <field>]`. The
   *  io cause has no field, so it never renders a `null` tail. */
  #failureWords(words: PlanReadWords, state: UnreadableState): string {
    const head = `${words.planReadWord(state.cause)} ${state.path}`;
    return state.field === null ? head : `${head}: ${state.field}`;
  }

  /** The orphan diagnostic of the ready state — the `spec-absent` sentence (slug +
   *  derived path) or the `slug-absent` one; null when neither applies. */
  #orphanWords(words: PlanReadWords): string | null {
    const orphan = this.orphan();
    if (orphan === null) return null;
    if (orphan.cause === "slug-absent") return words.planSlugMissing();
    const slug = this.#slugOf();
    const specPath = orphan.specPath;
    if (slug === null || specPath === null) return null;
    return words.planOrphanSpec(slug, specPath);
  }

  /** The one diagnostic source `warnLine` and `refusal` share. */
  #diagnostic(words: PlanReadWords): string | null {
    const state = this.#state;
    if (state.kind === "unreadable") return this.#failureWords(words, state);
    return this.#orphanWords(words);
  }
}

/**
 * PlanSource — the plan read seam: one instance per command, constructed in the
 * command preamble (after the repo root resolves) and passed down as a parameter.
 * It owns the read + parse + classify path both entries share; the reverse lookup
 * rides the argv entry only.
 */
export class PlanSource {
  /** The path basis — the injected repo root (required: the root is a per-command fact). */
  readonly #root: RepoRoot;
  /** The filesystem seam (defaults to node:fs). */
  readonly #fs: DocFs;
  /** The ONE plan parser this source reads through (the plan doc type's single
   *  read point, beside the `docTypeParsers` registry row). */
  readonly #parser = new PlanDocType("plan");

  constructor(root: RepoRoot, fs: DocFs = new NodeFs()) {
    this.#root = root;
    this.#fs = fs;
  }

  /** The derived face: `entry.slug` is the whole identity, the path is derived from
   *  it. An absent derived path is `undeclared` (this phase has no plan yet); an
   *  existing path whose bytes do not read is `unreadable`/`io`. No reverse lookup
   *  and no index: the entry IS the identity document. */
  readFor(entry: DocEntry): PlanRead {
    const slug = entry.slug;
    if (slug === null) return new PlanRead({ kind: "undeclared" });
    const rel = `${ENGINE_RUNTIME.docRoots.plans}/${slug}.md`;
    if (!this.#fs.exists(this.#abs(rel))) return new PlanRead({ kind: "undeclared" });
    const content = this.#fs.read(this.#abs(rel));
    if (content === null) return this.#ioFailure(rel);
    return this.#classify(rel, content, false);
  }

  /** The argv face: the caller names the path, so a failed read is NEVER
   *  `undeclared` — the dispatch face keeps today's usage bytes. The reverse
   *  lookup runs once, here, before the value is returned. */
  readPath(rel: string): PlanRead {
    const path = this.#root.relativize(rel);
    const content = this.#fs.read(this.#root.resolve(path));
    if (content === null) return this.#ioFailure(path);
    return this.#classify(path, content, true);
  }

  // -------------------------------------------------------------------------
  // the private read chain
  // -------------------------------------------------------------------------

  /** The absolute syscall form of one repo-relative path — the ONE conversion pair
   *  every `DocFs` call goes through (never a bare path resolved by the process cwd). */
  #abs(rel: string): string {
    return this.#root.resolve(this.#root.relativize(rel));
  }

  /** The io read failure — the bytes did not read. `DocFs.read` carries no errno,
   *  so the message names the path with the existing usage wording (one source). */
  #ioFailure(path: string): PlanRead {
    return new PlanRead({
      kind: "unreadable",
      path,
      cause: "io",
      field: null,
      message: `cannot read file: ${path}`,
    });
  }

  /** The shared read tail: front-matter split, ONE parse, the eager graph, and the
   *  argv-only reverse lookup. A grammar break is the typed `DocSyntaxError` and
   *  becomes the `syntax` failure; any other throw is a programming break. */
  #classify(path: string, content: string, reverse: boolean): PlanRead {
    const { head } = FrontMatterExtractor.split(content);
    try {
      const doc = this.#parser.parse(content.split("\n"), head);
      const graph = new TaskGraph(doc);
      const orphan = reverse ? this.#orphanOf(head) : null;
      return new PlanRead({ kind: "ready", path, text: content, doc, graph, orphan });
    } catch (error) {
      if (!(error instanceof DocSyntaxError)) throw error;
      return new PlanRead({
        kind: "unreadable",
        path,
        cause: "syntax",
        field: error.field,
        message: error.message,
      });
    }
  }

  /** The reverse lookup (§2.7) — existence only. A legal slug derives
   *  `<slug>-design.md` and the probe answers "does this plan name a phase"; an
   *  illegal slug derives nothing (that is an identity break, not an orphan), and
   *  an absent slug is the `slug-absent` read fact. */
  #orphanOf(head: FrontMatterHead): PlanOrphan | null {
    const slug = head.slug;
    if (slug === null) return { cause: "slug-absent", specPath: null };
    if (!SlugIndex.isLegalSlug(slug)) return null;
    const specRel = `${ENGINE_RUNTIME.docRoots.specs}/${slug}-design.md`;
    if (this.#fs.exists(this.#abs(specRel))) return null;
    return { cause: "spec-absent", specPath: specRel };
  }
}
