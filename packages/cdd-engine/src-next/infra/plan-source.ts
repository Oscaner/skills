// packages/cdd-engine/src-next/infra/plan-source.ts
// The plan read + parse + classify seam (design spec §2.1 · §2.4 · §2.7): ONE deep
// class (`PlanSource`) with TWO entries — the derived face (`readFor`,
// `entry.slug` → the index's plan row) and the argv face (`readPath`) — and ONE value
// (`PlanRead`) that carries the behaviour the seven call sites used to re-spell. The
// tri-state is a class (a private discriminant field + a `kind` getter + the
// accessors), never a bare discriminated union: no consumer writes
// `switch (read.kind)` to recover a fact the value already owns.
//
//   · The path basis is the `RepoRoot` conversion pair: every `DocFs` call takes
//     `root.resolve(root.relativize(rel))`, so a plan under a repository sub-
//     directory reads against the injected root — never `process.cwd()` (NodeFs
//     resolves a literal against the process cwd, which would silently read a
//     healthy plan as unreadable).
//   · IDENTITY, NEVER A NAME (§2.7): both legs ask the injected `SlugIndex`. The
//     derived face takes the slug's plan ROW (`docsOf(slug)`, the plan `doc-type`)
//     and reads that row's declared `rel`; it derives no `<slug>.md`. The reverse
//     lookup asks whether the index holds an IDENTITY document for the slug, and
//     whether the three doc roots' scan surface is clean enough to answer an
//     absence at all. Zero filename derivation survives in this file.
//   · The tri-state is `undeclared` / `unreadable` / `ready`. `undeclared` carries
//     its REASON (`clean` — the root's surface answered "no plan"; `indeterminate` —
//     the plans root dropped or failed to register candidates, so "no plan" is not
//     available and the assembly face says so in one `CDD_WARN:` line). The
//     undecided identity lookup rides the ready state the same way (`undecided`).
//     The fourth shape, `duplicated`, is NOT part of that tri-state: `locate` answers
//     `null` for both zero and two plans, so a caller reading `null` as "no plan"
//     would answer "there is none" about a set of two — the one licence §2.7 forbids.
//     It carries the found set instead, and the board's identity marker face renders
//     it (never a first pick).
//   · `undeclared` has exactly one producer family — `readFor`'s set question. There
//     is no `undeclared` factory: "this phase has no plan yet" is a real read result,
//     not a value a caller can mint. `readPath` never asks the plans root, so an
//     absent argv path is an io read failure — the dispatch face keeps today's bytes.
//
// Module-level exports are types / the class family — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { DocSyntaxError, PlanDocType, type PlanParsed } from "../contract/doc.ts";
import { FrontMatterExtractor, type FrontMatterHead } from "../contract/frontmatter.ts";
import { type DocFs, NodeFs } from "../contract/invariants.ts";
import { TaskGraph } from "../session/graph.ts";
import type { RepoRoot } from "./root.ts";
import { ENGINE_RUNTIME } from "./runtime.ts";
import { type DiscardedCandidates, type DocEntry, SlugIndex } from "./slug-index.ts";

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
  /** The spec-absent orphan diagnostic — the plan's slug, and NO derived path (the
   *  identity is the slug; there is no file name to print). */
  planOrphanSpec(slug: string): string;
  /** The slug-absent diagnostic — the plan parses but declares no identity key. */
  planSlugMissing(): string;
  /** The orphan mark the doc face, the program cell and the plan row fold into. */
  planOrphanWord(): string;
  /** The undecided-scan diagnostic — the doc roots that dropped candidates and the
   *  count of them (the fact that forbids answering "no plan" / "no identity"). */
  planDiscardedWord(roots: readonly string[], discarded: number): string;
  /** The program face's undeclared cell (`""` — the "no plan" program cell only). */
  readonly cellEmpty: string;
  /** The stderr diagnostic prefix (`CDD_WARN:`), delegated to the station row. */
  readonly warnPrefix: string;
}

/** One plan-read failure — the `unreadable` state's three facts, the ONE place the
 *  accessors take them from. `cause` is a first-class field, not a proxy: a null
 *  `stationPath()` answers both `io` and `undeclared`, and the scene assembly needs
 *  exactly that distinction. `field` is `string | null` (not optional) so "no
 *  field" and "never read" stay distinct in the type. The diagnostic text is NOT
 *  carried here: `DocSyntaxError#message` is that grammar fact's single source, and
 *  the rendered sentence is composed from the word port + `path` + `field`
 *  (`#failureWords`) — a copied string would be a second source no consumer reads. */
export interface PlanFailure {
  /** The plan's repo-relative path (present for both causes). */
  readonly path: string;
  /** The failure class. */
  readonly cause: "io" | "syntax";
  /** The anchored field of a grammar break; null for an io failure. */
  readonly field: string | null;
}

/** The reverse-lookup read fact (§2.7): does this plan name a phase? `spec-absent`
 *  is the foldable cause (`! no-spec` + the doc-contract refusal); `slug-absent` is
 *  only a read fact — the identity channel owns its exit code, so this value never
 *  folds it. There is NO path here: the identity is the slug, and the retired
 *  `<slug>-design.md` derivation has no consumer left to print it for. */
export interface PlanOrphan {
  /** The two causes. */
  readonly cause: "spec-absent" | "slug-absent";
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

/** The surfaces that dropped candidates — the undecided read's observable fact. */
interface Undecided {
  /** The doc-root paths whose scan surface was not clean. */
  readonly roots: readonly string[];
  /** How many candidates those roots dropped or could not register. */
  readonly discarded: number;
}

/** Why no plan document answered the derived face's set question. */
type UndeclaredReason =
  /** The plans root's surface is clean: "this phase has no plan" is a fact. */
  | { readonly kind: "clean" }
  /** The plans root dropped or failed to register candidates: the absence is not
   *  available, only the undecided read. */
  | { readonly kind: "indeterminate"; readonly undecided: Undecided };

/** The `undeclared` state — the phase carries no plan (the normal forward gap), plus
 *  the reason the absence was (or was not) answerable. */
interface UndeclaredState {
  readonly kind: "undeclared";
  readonly reason: UndeclaredReason;
}

/** The `duplicated` state — the slug names TWO plans: no single document answers, and
 *  "no plan" is a licence this read does not hold (§2.7 (d)). */
interface DuplicatedState {
  readonly kind: "duplicated";
  readonly found: readonly string[];
}

/** The `unreadable` state — a plan file exists (or was named by argv) but did not
 *  become a document: the bytes did not read, or the grammar refused them. */
interface UnreadableState {
  readonly kind: "unreadable";
  readonly path: string;
  readonly cause: "io" | "syntax";
  readonly field: string | null;
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
  readonly undecided: Undecided | null;
}

/** The state brand: a module-private symbol key that `PlanRead`'s constructor
 *  requires, so "exactly one producer family" is judged by `tsc` rather than by a
 *  comment. The symbol is not exported, therefore no other module can spell the key
 *  and a structural object literal there fails to type-check; every mint lives in
 *  this file (`PlanSource`'s states and the fallbacks it threads). */
const READ_STATE_BRAND: unique symbol = Symbol("cdd.plan-read-state");

/** The module-private state union carried by `PlanRead`, sealed by the brand above. */
type PlanReadState = (UndeclaredState | DuplicatedState | UnreadableState | ReadyState) & {
  readonly [READ_STATE_BRAND]: true;
};

/** The read's discriminant — the tri-state plus the duplicated set (which is not a
 *  fourth absence, it is the refusal to answer an absence). */
type PlanReadKind = PlanReadState["kind"];

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

  /** The constructor takes the branded state, so a `PlanRead` can only be built from
   *  a value minted in this module — the single-producer claim is a type, not a
   *  convention. */
  constructor(state: PlanReadState) {
    this.#state = state;
  }

  /** The read's discriminant (`undeclared` / `unreadable` / `ready`, plus the
   *  `duplicated` set that answers no absence). */
  get kind(): PlanReadKind {
    return this.#state.kind;
  }

  /** The plan row's fact (§2.1): `undeclared` and `duplicated` → null (no single
   *  document); `unreadable` and `ready` → the path (unreadable does not mean
   *  pathless). An empty string would disguise "no document" as "an empty path" and
   *  render half a plan row. */
  path(): string | null {
    const state = this.#state;
    if (state.kind === "undeclared" || state.kind === "duplicated") return null;
    return state.path;
  }

  /** The frontier's path (§2.1 · §2.5): the document reads out (its front matter
   *  parsed), NOT "it parses into a graph". `undeclared` / `duplicated` → null (no
   *  document, and no single one to follow); `io` → null (no slug key, so no face is
   *  assemblable); `syntax` → the path (the front matter read out, the plan face
   *  assembles, and its doc-contract refusal is exactly the next face to point at);
   *  `ready` → the path. This is today's per-cause distribution, now a value
   *  behaviour. */
  stationPath(): string | null {
    const state = this.#state;
    if (state.kind === "ready") return state.path;
    if (state.kind === "unreadable" && state.cause === "syntax") return state.path;
    return null;
  }

  /** The failure's three facts, the ONE place they are taken from; null unless the
   *  read was `unreadable`. The rendered sentence is the word port's, not this
   *  value's. */
  failure(): PlanFailure | null {
    const state = this.#state;
    if (state.kind !== "unreadable") return null;
    return { path: state.path, cause: state.cause, field: state.field };
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

  /** The ready read's two document values in ONE hand-off — the kind contract
   *  written in the type, so a caller that already guarded `kind` never re-narrows
   *  what the read decided. `text` and `doc` are non-null exactly when `kind` is
   *  `ready`; any other kind is a BROKEN invariant (the caller's guard is the only
   *  legal entry), so it throws instead of degrading the fact to "no document". */
  document(): { readonly text: string; readonly doc: PlanParsed } {
    const state = this.#state;
    if (state.kind !== "ready")
      throw new Error("cdd: a plan read outside the ready state carries no document");
    return { text: state.text, doc: state.doc };
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

  /** The plan rows the slug names when TWO or more answered — the set the identity
   *  marker face renders; empty for every other read. This is the one accessor that
   *  makes "two plans" distinguishable from "no plan" (§2.7 (d)). */
  found(): readonly string[] {
    const state = this.#state;
    return state.kind === "duplicated" ? state.found : [];
  }

  /** The board's wave data; the empty set when not ready (an empty set is NOT a
   *  render signal — `degradedWaveRow` / `cell` own the literals). */
  waves(): readonly TaskBatch[] {
    const state = this.#state;
    return state.kind === "ready" ? state.graph.batches() : [];
  }

  /** The doc-face wave row's degradation literal (§2.4 + the §2.7 fold); null means
   *  "the healthy row is the assembler's", never "nothing to show". A duplicated set
   *  keeps today's `(none)` here: the plan CELL carries the marker, the wave segment
   *  carries no plan fact. */
  degradedWaveRow(words: PlanReadWords): string | null {
    return this.#degradedWord(words, UNDECLARED_WAVE);
  }

  /** The program-face wave cell's literal (§2.4 + the §2.7 fold); `""` is the
   *  undeclared program cell only, and null again hands the healthy cell back. */
  cell(words: PlanReadWords): string | null {
    return this.#degradedWord(words, words.cellEmpty);
  }

  /** The plan row's cell content (§2.1): the degraded shapes carry the path plus
   *  the mark; a healthy `ready` is the bare path; `undeclared` / `slug-absent` /
   *  `duplicated` return null (the identity bookkeeping owns those rows). */
  planLine(words: PlanReadWords): string | null {
    const state = this.#state;
    if (state.kind === "undeclared" || state.kind === "duplicated") return null;
    if (state.kind === "unreadable")
      return `${state.path}${MARK_SEPARATOR}${words.planReadWord(state.cause)}`;
    const cause = this.#orphanCause();
    if (cause === "spec-absent") return `${state.path}${MARK_SEPARATOR}${words.planOrphanWord()}`;
    if (cause === "slug-absent") return null;
    return state.path;
  }

  /** The spec row's cell content — the spec-absent orphan only; every other state
   *  (healthy, non-ready, `slug-absent`, undecided) returns null. The undecided read
   *  is exactly the case that may NOT print `! no-spec`: the index held nothing, but
   *  a doc root could not be read. */
  specLine(words: PlanReadWords): string | null {
    return this.#orphanCause() === "spec-absent" ? words.planOrphanWord() : null;
  }

  /** The board's `CDD_WARN:` line (stderr): the two unreadable causes, the
   *  `spec-absent` orphan, the `slug-absent` fact and the UNDECIDED scan each
   *  produce one; `undeclared`-clean, `duplicated` and a healthy `ready` produce null
   *  ("no plan yet" is normal, not a failure; the duplicated set is an identity
   *  marker on stdout, not a read diagnostic). */
  warnLine(words: PlanReadWords): string | null {
    const diagnostic = this.#diagnostic(words) ?? this.#undecidedWords(words);
    return diagnostic === null ? null : `${words.warnPrefix} ${diagnostic}`;
  }

  /** The pre-flight refusal (§2.3): the two unreadable causes and the spec-absent
   *  orphan; `slug-absent` is stopped earlier by the identity channel, the undecided
   *  scan refuses nothing (§2.7 (c): zero refusal), the duplicated set is the
   *  identity gate's, and the healthy / undeclared states have nothing to refuse. */
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
    if (state.kind === "undeclared" || state.kind === "duplicated") return undeclared;
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

  /** The orphan diagnostic of the ready state — the `spec-absent` sentence (the slug
   *  alone, zero derived path) or the `slug-absent` one; null when neither applies. */
  #orphanWords(words: PlanReadWords): string | null {
    const orphan = this.orphan();
    if (orphan === null) return null;
    if (orphan.cause === "slug-absent") return words.planSlugMissing();
    const slug = this.#slugOf();
    return slug === null ? null : words.planOrphanSpec(slug);
  }

  /** The undecided-scan diagnostic — one line naming the dirty doc roots and their
   *  discarded count; null for every decided read. */
  #undecidedWords(words: PlanReadWords): string | null {
    const state = this.#state;
    const undecided =
      state.kind === "undeclared"
        ? state.reason.kind === "indeterminate"
          ? state.reason.undecided
          : null
        : state.kind === "ready"
          ? state.undecided
          : null;
    return undecided === null
      ? null
      : words.planDiscardedWord(undecided.roots, undecided.discarded);
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
 * command preamble (after the repo root AND the command's ONE identity index exist)
 * and passed down as a parameter. It owns the read + parse + classify path both
 * entries share; BOTH of its questions are identity questions and both are answered
 * by the injected index. It never builds one: a second index would be a second
 * snapshot of the disk, and the tri-state's "clean or not" answer must come from the
 * same scan the rest of the command reads.
 */
export class PlanSource {
  /** The path basis — the injected repo root (required: the root is a per-command fact). */
  readonly #root: RepoRoot;
  /** The command's ONE identity index — both legs ask it (zero self-built scan). */
  readonly #index: SlugIndex;
  /** The filesystem seam (defaults to node:fs). */
  readonly #fs: DocFs;
  /** The ONE plan parser this source reads through (the plan doc type's single
   *  read point, beside the `docTypeParsers` registry row). */
  readonly #parser = new PlanDocType("plan");

  constructor(root: RepoRoot, index: SlugIndex, fs: DocFs = new NodeFs()) {
    this.#root = root;
    this.#index = index;
    this.#fs = fs;
  }

  /** The derived face — the slug's PLAN ROW, never a derived file name (§2.7). The
   *  set answers, and only its single element is read: zero rows is the clean
   *  `undeclared` gap when the plans root's surface can answer an absence, the
   *  undecided read when it cannot; two or more rows is the `duplicated` set (a
   *  first pick here would answer "the plan" about a document the slug does not
   *  single out). A null entry (an identity the index did not register) carries no
   *  slug, so it reads exactly like a slug-less entry: `undeclared`, clean. */
  readFor(entry: DocEntry | null): PlanRead {
    const slug = entry?.slug ?? null;
    if (slug === null || !SlugIndex.isLegalSlug(slug)) return this.#undeclaredClean();
    const plans = this.#index.docsOf(slug).filter((doc) => doc.docType === "plan");
    if (plans.length === 0) return this.#undeclaredAtPlansRoot();
    if (plans.length > 1)
      return new PlanRead({
        kind: "duplicated",
        found: plans.map((doc) => doc.rel),
        [READ_STATE_BRAND]: true,
      });
    const rel = plans[0]!.rel;
    const content = this.#fs.read(this.#abs(rel));
    if (content === null) return this.#ioFailure(rel);
    return this.#classify(rel, content, null, null);
  }

  /** The argv face: the caller names the path, so a failed read is NEVER
   *  `undeclared` — the dispatch face keeps today's usage bytes. The reverse
   *  lookup runs once, here, and its result rides into the shared tail as a
   *  parameter; the tail itself probes nothing. */
  readPath(rel: string): PlanRead {
    const path = this.#root.relativize(rel);
    const content = this.#fs.read(this.#root.resolve(path));
    if (content === null) return this.#ioFailure(path);
    const { head } = FrontMatterExtractor.split(content);
    const lookup = this.#lookupOf(head);
    return this.#classify(path, content, lookup.orphan, lookup.undecided);
  }

  // -------------------------------------------------------------------------
  // the private read chain
  // -------------------------------------------------------------------------

  /** The absolute syscall form of one repo-relative path — the ONE conversion pair
   *  every `DocFs` call goes through (never a bare path resolved by the process cwd). */
  #abs(rel: string): string {
    return this.#root.resolve(this.#root.relativize(rel));
  }

  /** The clean undeclared read — the phase carries no plan and the surface said so. */
  #undeclaredClean(): PlanRead {
    return new PlanRead({
      kind: "undeclared",
      reason: { kind: "clean" },
      [READ_STATE_BRAND]: true,
    });
  }

  /** The undeclared read at the plans root: a clean surface is the real gap, a dirty
   *  one only the undecided reading of it (spec §2.7). */
  #undeclaredAtPlansRoot(): PlanRead {
    const discard = this.#index.discarded().plans;
    const discarded = discard.unreadable + discard.unregistered;
    if (discarded === 0) return this.#undeclaredClean();
    return new PlanRead({
      kind: "undeclared",
      reason: {
        kind: "indeterminate",
        undecided: { roots: [ENGINE_RUNTIME.docRoots.plans], discarded },
      },
      [READ_STATE_BRAND]: true,
    });
  }

  /** The io read failure — the bytes did not read. `DocFs.read` carries no errno,
   *  so the failure records the path and the cause only; the sentence the reader
   *  sees is composed by the diagnostics (`#failureWords`), never stored. */
  #ioFailure(path: string): PlanRead {
    return new PlanRead({
      kind: "unreadable",
      path,
      cause: "io",
      field: null,
      [READ_STATE_BRAND]: true,
    });
  }

  /** The shared read tail: front-matter split, ONE parse, the eager graph. The
   *  reverse-lookup result arrives as parameters (`null` on the derived face), so
   *  this tail contains no probe. A grammar break is the typed `DocSyntaxError` and
   *  becomes the `syntax` failure; any other throw is a programming break. */
  #classify(
    path: string,
    content: string,
    orphan: PlanOrphan | null,
    undecided: Undecided | null,
  ): PlanRead {
    const { head } = FrontMatterExtractor.split(content);
    try {
      const doc = this.#parser.parse(content.split("\n"), head);
      const graph = new TaskGraph(doc);
      return new PlanRead({
        kind: "ready",
        path,
        text: content,
        doc,
        graph,
        orphan,
        undecided,
        [READ_STATE_BRAND]: true,
      });
    } catch (error) {
      if (!(error instanceof DocSyntaxError)) throw error;
      return new PlanRead({
        kind: "unreadable",
        path,
        cause: "syntax",
        field: error.field,
        [READ_STATE_BRAND]: true,
      });
    }
  }

  /** The reverse lookup (§2.7) — an IDENTITY question, never a name probe: does the
   *  index hold an identity document for this slug, and if not, may the three doc
   *  roots answer that absence? A legal slug is the only shape worth asking (an
   *  illegal one is the identity channel's judgment, not an orphan); an absent slug
   *  is the `slug-absent` read fact. */
  #lookupOf(head: FrontMatterHead): {
    readonly orphan: PlanOrphan | null;
    readonly undecided: Undecided | null;
  } {
    const slug = head.slug;
    if (slug === null) return { orphan: { cause: "slug-absent" }, undecided: null };
    if (!SlugIndex.isLegalSlug(slug)) return { orphan: null, undecided: null };
    if (this.#index.hasIdentity(slug)) return { orphan: null, undecided: null };
    const undecided = PlanSource.#undecidedOf(this.#index.discarded());
    if (undecided !== null) return { orphan: null, undecided };
    return { orphan: { cause: "spec-absent" }, undecided: null };
  }

  /** The dirty doc roots of one scan — null when every root could answer an absence.
   *  A root that dropped a candidate, or indexed one without a registered doc type,
   *  cannot: its silence is not the disk's (spec §2.7). */
  static #undecidedOf(discarded: DiscardedCandidates): Undecided | null {
    const rows: readonly (readonly [string, { unreadable: number; unregistered: number }])[] = [
      [ENGINE_RUNTIME.docRoots.overalls, discarded.overalls],
      [ENGINE_RUNTIME.docRoots.specs, discarded.specs],
      [ENGINE_RUNTIME.docRoots.plans, discarded.plans],
    ];
    const roots: string[] = [];
    let total = 0;
    for (const [root, discard] of rows) {
      const count = discard.unreadable + discard.unregistered;
      if (count === 0) continue;
      roots.push(root);
      total += count;
    }
    return roots.length === 0 ? null : { roots, discarded: total };
  }
}
