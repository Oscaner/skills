// packages/cdd-engine/src-next/face/board-view.ts
// The board face — the entry document → node progress board. The front-matter
// identity index (`SlugIndex`) is the ONLY node source: the entry document's
// `doc-type:` picks the board shape (overall → program board; phase-spec /
// single-spec / plan → node board), and every related node resolves through the
// index by slug (`program:` → overall; same slug → paired spec / plan). Identity
// comes from the front-matter `slug:` alone: zero file-name derivation, zero path
// guessing.
//
// This module carries the header `{version, status, docType}` read, the per-node
// progress projection, the render face (the phase/program board layouts) and the
// pipeline OBSERVATION (`pipelineFacts`). The doc type is the DECLARED fact — the
// front-matter `doc-type:` head key (spec §12 · D34) — never a filename-suffix
// derivation; an absent key reads null and the consumer blocks (zero dual-read
// fallback).
//
// P22 §5.2 — the board's `next:` line renders an INJECTED `NextHop` and judges
// nothing: the pipeline traversal (the four face-order rules) lives in the session
// plane (`session/pipeline.ts` `PipelineFrontier`), the ONE derivation is
// `NextStepRouter#nextHop`, and the ONE literal renderer is `RouteRenderer` (shared
// with the capsule). The board only OBSERVES each face's facts (`pipelineFacts`)
// and renders.
//
// P22 §5.3 — the default layout aggregates each line's rounds BY VERB (the judgement
// glyph is mandatory, the findings count rides a `+N` suffix, a plain token carries the
// last record's `a{attempt}` superscript); range forms never render (there is no
// `--verbose` in this phase). P24 §12 splits that aggregation into two shapes: the
// success face merges per verb — an `{ok}/{attempts}` ratio with NO superscript once
// the verb has a failed attempt — and the anomaly face expands one token per failed
// attempt, each naming its own cycle and, past the first, its own `a{attempt}`
// (`fix 12 ✗→✓` when that cycle's next attempt completed). Each wave line's label
// carries the wave's task scope in braces (`W1 {5,11}`) with the ✔/▶/○ marker
// column fixed-width aligned.
//
// Module-level exports are types / constants / the classes — zero behavior-carrying
// bare functions (the plan's zero-bare-function discipline).

import { readFileSync } from "node:fs";
import path from "node:path";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import type { DocKey } from "../contract/project.ts";
import { DOC_KEYS } from "../contract/project.ts";
import { displayReason, REGRADE_NOTE_SEPARATOR, regradeNote } from "../contract/review-criteria.ts";
import { ConfigLoader } from "../infra/config.ts";
import type { PlanRead, PlanSource } from "../infra/plan-source.ts";
import { type RepoPath, RepoRoot } from "../infra/root.ts";
import { ENGINE_RUNTIME } from "../infra/runtime.ts";
import { type DocEntry, SlugIndex, type SlugRole } from "../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { type ArtifactReadOf, ArtifactReads } from "../session/artifact-reads.ts";
import { CarrierIntegrity, CarrierMismatchError } from "../session/carrier-integrity.ts";
import type { RouteTarget, TargetType } from "../session/faces.ts";
import { HandoffSchema } from "../session/handoff-schema.ts";
import type { InFlightState } from "../session/inflight.ts";
import {
  Ledger,
  type ProgressData,
  type RoundFinding,
  type RoundRecord,
  RoundRecords,
} from "../session/ledger.ts";
import type { DocClassVerdict, NextHop } from "../session/next.ts";
import { PipelineFrontier, type PipelineFrontierInput } from "../session/pipeline.ts";
import type { RefusalState } from "../session/refusal.ts";
import type { ArtifactRegistry, Kind } from "../session/round-artifacts.ts";
import { PROGRESS_LEGEND, PROGRESS_MARKERS } from "./graph-view.ts";
import { type RouteChannelRow, RouteRenderer } from "./route-render.ts";
import type { Words } from "./words.ts";

/** The verb render order of a line's rounds tokens — the stable display order the
 *  board's aggregated cells follow (an unexpected verb appends after these, never
 *  dropped). */
const VERB_ORDER: readonly string[] = ["implement", "review", "branch-review", "fix"];

/** The judgement glyphs of one aggregated token (spec §5.3 — the mark is MANDATORY:
 *  `✓` a completed round, `✗` a round that failed its target action). */
const JUDGEMENT_MARKERS = { passed: "✓", failed: "✗", recovered: "✗→✓" } as const;

/** One verb's two judgement faces (P24 §12) — the success face, which merges into at
 *  most one token per verb, and the anomaly face, which expands one token per failed
 *  attempt. */
interface VerdictFaces {
  readonly successes: readonly RoundRecord[];
  readonly failures: readonly RoundRecord[];
}

/** One rendered board — the stdout lines + the process exit code (0 on a clean
 *  board, 2 when a present doc line carried no `doc-type:` declaration). */
export interface BoardRender {
  /** The board's stdout lines (the header, the body, the legend) — joined with `\n`. */
  lines: readonly string[];
  /** The board's process exit code: 0 (clean) or 2 (a missing doc-type declaration). */
  exitCode: number;
}

/** One board line's projected data — a doc line (`overall` / `spec` / `plan`), the
 *  `branch` line, or one derived wave line. Each line carries its own round RECORDS
 *  (the `progress.json` row of its key) and, for wave lines, the derived ✔/▶/○
 *  marker. */
export interface BoardLine {
  /** The line's label — `overall` / `spec` / `plan` / `branch`, or the wave label (`W1`). */
  label: string;
  /** The line's doc version (null for the branch/wave lines — no doc). */
  version: string | null;
  /** The line's doc status (null for the branch/wave lines). */
  status: string | null;
  /** The line's declared doc type (spec §12 · D34; null for the branch/wave lines). */
  docType: DocKey | null;
  /** The line's round records (identity + verdict), the aggregation's input — never
   *  a count and never a pre-grouped map (the record is the ONE read shape). */
  rounds: readonly RoundRecord[];
  /** The line's carrier facts — the `+N` count's whole read face, bound to THIS
   *  line's ledger + identity (the accessor, the ownership judgment, the checked
   *  read). */
  carriers: LineCarriers;
  /** The derived ✔/▶/○ marker — wave lines only; null otherwise. */
  marker: string | null;
  /** The line's LEDGER coordinate — the `type` its carriers resolve through
   *  (`wave` for a wave line, the line word otherwise) and the row `key` it records
   *  under. The `art:` projection reads its rounds and carriers off this pair, so the
   *  board never re-derives a coordinate from a rendered label. */
  type: string;
  key: string;
}

/** One node's line set bound to the workspace it observes — the `art:` projection's
 *  scope. A node board renders the program's overall line from the PROGRAM workspace
 *  and its own lines from the node's, so the scope carries the ledger seat rather than
 *  resolving every line against one workspace. */
interface ArtifactScope {
  readonly lines: readonly BoardLine[];
  readonly seat: LedgerSeat;
}

/** The board's artifact projection — the matrix seam every ledger resolves its names
 *  through plus whether the full inventory is open (`--artifacts`). The two facts ride
 *  the render chain as ONE value: a board that holds the registry but loses the flag
 *  would silently render the default view, and one that holds the flag but loses the
 *  registry would silently render nothing (spec §2.6 — both halves fail silently, so
 *  the pair is one parameter, never two positionals with two defaults). */
export interface ArtifactProjection {
  readonly registry: ArtifactRegistry | null;
  readonly showAll: boolean;
}

/** The closed projection — no matrix, default view. The value a caller that observes
 *  no artifacts passes (a `null` registry answers zero `art:` rows). */
export const NO_ARTIFACTS: ArtifactProjection = { registry: null, showAll: false };

/** The board's PRINTING face — the switches that change what the board prints and
 *  nothing it judges. `notes` opens the child-note bodies the folded default keeps as a
 *  count (`--notes`): the default token stays `notes +M`, and the expanded token appends
 *  the same folded rows at the same position, so only the bytes after the count move. */
export interface BoardDisplay {
  readonly notes: boolean;
}

/** The folded default — no note bodies, the count alone. */
export const FOLDED_NOTES: BoardDisplay = { notes: false };

/** One ledger's construction facts — the `progress.json` read face and the workspace
 *  every name in it resolves inside. Built in ONE place (`#ledgerOf`) so the ledger and
 *  the artifact read seam share one workspace instance instead of deriving two. */
interface LedgerSeat {
  readonly ledger: Ledger;
  readonly workspace: Workspace;
}

/** One observed review round — the `art:` row source: the reviewed coordinate, the
 *  kind the gate resolves today, the composed judgment the read seam answered, and the
 *  TWO render closures the facts need (a workspace NAME relativized through the seat's
 *  workspace, an absolute PATH relativized through the ONE basis). */
interface ObservedArtifact {
  readonly line: string;
  readonly kind: Kind;
  readonly cycle: number;
  readonly attempt: number;
  readonly read: ArtifactReadOf;
  readonly relName: (name: string) => string;
  readonly relPath: (value: string) => string;
}

/** One doc slot's source — the identity index's SET answer, narrowed by class. The
 *  three arms are the whole judgment (spec §2.3 · §4.4): `one` is the only arm whose
 *  entry may lend a cell its header facts, and `many` carries the whole set so the row
 *  can NAME it instead of picking a first document. */
type DocSlot =
  | { readonly kind: "none" }
  | { readonly kind: "one"; readonly entry: DocEntry }
  | { readonly kind: "many"; readonly found: readonly DocEntry[] };

/** The empty slot — one shared value, never a freshly minted arm. */
const NO_DOC: DocSlot = { kind: "none" };

/** The node's identity chain — the three indexed documents a board row set reads
 *  (spec §2.2). `programMissing` is the phase-spec hard gate, surfaced on the spec
 *  line as `program: missing (BLOCKED)`. */
interface NodeSources {
  readonly spec: DocSlot;
  readonly plan: DocSlot;
  readonly overall: DocEntry | null;
  readonly programMissing: boolean;
}

/** The board's pipeline FACTS (spec §5.2) — the ledger and the pipeline frontier's
 *  declared input, read off the ledger and the plan: the ledger itself (the round
 *  records' own read point) and the frontier's whole input (the declared identity
 *  + the guarded plan read). Pure facts, nothing else: the per-face observations, the
 *  four face-order rules AND the six-cell hop assembly live in the session plane
 *  (`PipelineFrontier#next` / `#hopOf`), and the board renders the result. */
export interface BoardPipelineFacts {
  /** The node's ledger — the round/closure read face the hop derivation consumes. */
  readonly ledger: Ledger;
  /** The pipeline frontier's whole input (the declared identity + the guarded plan read). */
  readonly input: PipelineFrontierInput;
}

/** The DocKey domain of the `doc-type:` declaration — the declared value must
 *  be one of the four keys; anything else reads null (present facts, never a
 *  fabricated type). Derived from the ONE DocKey declaration (contract/project.ts
 *  re-exports declare.ts's canonical tuple) — never a second copy (spec §3.2 ③). */
const DOC_TYPE_DOMAIN: readonly DocKey[] = DOC_KEYS;

/** The board's blocked-marker vocabulary (spec §3.1) — one anchor + one `(BLOCKED)`
 *  suffix per violation class, never a merged prose. */
const MARK_SLUG_MISSING = "slug: missing (BLOCKED)";
const MARK_SLUG_INVALID = "slug: invalid (BLOCKED)";
const MARK_SLUG_DUPLICATED = "slug: duplicated (BLOCKED)";
const MARK_PROGRAM_MISSING = "program: missing (BLOCKED)";
const MARK_DOC_TYPE_MISSING = "doc-type: missing (BLOCKED)";

/** The program board's phase-title annotation cap — the `title:` note renders
 *  truncated to this many characters (an ellipsis marks the cut). */
const PHASE_TITLE_MAX = 60;

/** The label column of the board's line rows — `  ` + the label padded to this
 *  width (`overall` is the longest verb at 7), so every value starts in one column. */
const LABEL_WIDTH = 9;

/** The `art:` fact block's continuation keys — the board's OWN spelling of the three
 *  facts a judgment carries (spec §2.6). Deliberately independent of
 *  `Words#artifactIdentity`: that row is the gate's §2.4 contract (`derived:  `,
 *  a colon inside its own two-space column), while the board's rows are the §2.6
 *  contract (`derived`, no colon, the board's continuation column). One source per
 *  contract, and the board's half is pinned by its byte assertions. */
const ARTIFACT_FACT_LABELS = {
  derived: "derived",
  found: "found",
  reason: "reason",
} as const;

/** The engine's own note families (P42 §2.2) — three, joined as byte PREFIXES: the two
 *  decorative families' literal openings and the artifact family's sentence shape
 *  (`artifact <slot>: declared path `, the two slots `#prescribedArtifact` books). A
 *  carrier already on disk still carries them (a pre-P42 round wrote them into `notes`),
 *  so the READ face drops them here rather than waiting on the write side's promise.
 *  Byte prefix, never substring: the same words mid-sentence are a child's own note. */
const ENGINE_NOTE_PREFIXES: readonly string[] = [
  "dropped decorative draft field(s)",
  "dropped non-declared draft field(s)",
  ...["report", "test_evidence"].map((slot) => `artifact ${slot}: declared path `),
];

/** One carrier's `notes` slot projected as the CHILD's observations: string rows only,
 *  blanks dropped, the engine's three families dropped by their byte prefixes. The
 *  author's bytes are kept (no fold — the brief prints them verbatim; the board folds at
 *  its own display site), so this projection is one value with two readers. */
const childNotesOf = (notes: unknown): readonly string[] =>
  (Array.isArray(notes) ? notes : [])
    .filter((note): note is string => typeof note === "string")
    .filter((note) => note.trim().length > 0)
    .filter((note) => !ENGINE_NOTE_PREFIXES.some((prefix) => note.startsWith(prefix)));

/** One board line's carrier facts — the `+N` count's WHOLE read face (spec §2.7 ·
 *  §2.10). The record's path comes from the ledger's ONE accessor, bound to this
 *  line's type + key; ownership excludes a legacy record whose path a later round of
 *  the same line overwrote (present facts, no comparison); the read is the ONE checked
 *  seam against the record's own digest. A line with no ledger (no workspace to
 *  observe) resolves no path, so every record counts zero. */
export class LineCarriers {
  readonly #records: readonly RoundRecord[];
  readonly #pathOf: (record: RoundRecord) => string;
  /** The ONE per-record read's cache — the carrier bytes are read (and parsed) once
   *  per record, then both projections (`countOf` / `findingsOf`) take their cell from
   *  the same value (P37 §5.2). */
  readonly #content = new Map<RoundRecord, LineCarrierContent>();
  /** The findings projection's schema face — the SAME `HandoffSchema.findingsOf` the
   *  round read-back uses (one projection, two consumers). */
  readonly #schema = new HandoffSchema();

  private constructor(records: readonly RoundRecord[], pathOf: (record: RoundRecord) => string) {
    this.#records = records;
    this.#pathOf = pathOf;
  }

  /** The judgment over one line's records, with the caller supplying each record's
   *  carrier path — the board's own derivation is `ofLedger` below. */
  static of(
    records: readonly RoundRecord[],
    pathOf: (record: RoundRecord) => string,
  ): LineCarriers {
    return new LineCarriers(records, pathOf);
  }

  /** The board's derivation — the ledger's ONE accessor, bound to this line's type +
   *  key. No ledger (no workspace to observe) resolves no path for every record. */
  static ofLedger(
    ledger: Ledger | null,
    type: string,
    key: string,
    records: readonly RoundRecord[],
  ): LineCarriers {
    return LineCarriers.of(records, (record) => ledger?.carrierPathOf(type, key, record) ?? "");
  }

  /** One record's graded findings count — zero for a record that resolves no path or
   *  whose path a later round overwrote; a tampered carrier THROWS (the checked read). */
  countOf(record: RoundRecord): number {
    return this.#contentOf(record).count;
  }

  /** One record's findings as the round-finding projection (P37 §5.2) — the board's
   *  per-record read face, sharing `countOf`'s ONE carrier read and ONE parse. The
   *  projection is `HandoffSchema.findingsOf` (unknown severities still dropped), so
   *  the count's native array length and this filtered row set are two cells of the
   *  same read, never two reads. */
  findingsOf(record: RoundRecord): readonly RoundFinding[] {
    return this.#contentOf(record).findings;
  }

  /** One record's declared notes (P42 §2.1) — the carrier's `notes` slot as the child
   *  wrote it, minus the engine's own sentences (P42 §2.2). Shares `countOf`'s ONE
   *  carrier read and ONE parse, so the board's token and the next brief's section read
   *  one projection, never two. */
  notesOf(record: RoundRecord): readonly string[] {
    return this.#contentOf(record).notes;
  }

  /** One record's downgrade note (P37 §5.1 · §5.2) — its findings judged against the
   *  nearest EARLIER record on this line whose findings projection is non-empty (an
   *  implement / fix record with no findings never resets the reference, so a downgrade
   *  cannot slip through a clean neighbour). `undefined` when nothing was downgraded,
   *  the mark when a row owes its reason, the stated reason when the row carries one. */
  regradeNoteOf(record: RoundRecord): string | undefined {
    const prior = this.#priorOf(record);
    const current = this.findingsOf(record);
    return regradeNote(
      HandoffSchema.downgrades(prior, current).length,
      HandoffSchema.regradeReasons(prior, current),
    );
  }

  /** The earlier records of this line, newest first — the "previous round" walk's
   *  candidate list (the nearest one with a non-empty findings projection wins). */
  #priorOf(record: RoundRecord): readonly RoundFinding[] {
    const earlier = this.#records
      .filter((other) => LineCarriers.#earlierRound(other, record))
      .sort((left, right) =>
        left.cycle === right.cycle ? right.attempt - left.attempt : right.cycle - left.cycle,
      );
    for (const other of earlier) {
      const findings = this.findingsOf(other);
      if (findings.length > 0) return findings;
    }
    return [];
  }

  /** Whether `other` precedes `record` on the line — the `(cycle, attempt)` order. */
  static #earlierRound(other: RoundRecord, record: RoundRecord): boolean {
    return other.cycle === record.cycle
      ? other.attempt < record.attempt
      : other.cycle < record.cycle;
  }

  /** One record's carrier content, read ONCE — the path guard, the ownership judgment,
   *  the digest-checked read and the JSON parse all live here, so a second projection
   *  can never become a second read. */
  #contentOf(record: RoundRecord): LineCarrierContent {
    const cached = this.#content.get(record);
    if (cached !== undefined) return cached;
    const content = this.#readFresh(record);
    this.#content.set(record, content);
    return content;
  }

  /** The read behind `#contentOf` — zeroes for a record with no path or an overwritten
   *  one, and for bytes that hold neither a findings array nor a declared note. A work
   *  round's carrier declares no findings at all, so the gate is BOTH slots: reading
   *  `findings` alone would render every work round's note as zero (P42 §2.1). */
  #readFresh(record: RoundRecord): LineCarrierContent {
    const path = this.#pathOf(record);
    if (path === "" || !RoundRecords.ownerOf(this.#records, record, this.#pathOf)) {
      return EMPTY_CARRIER_CONTENT;
    }
    const text = CarrierIntegrity.read(path, record.carrierDigest ?? null);
    if (text === null) return EMPTY_CARRIER_CONTENT;
    try {
      const value: unknown = JSON.parse(text);
      const findings = (value as { findings?: unknown } | null)?.findings;
      const notes = childNotesOf((value as { notes?: unknown } | null)?.notes);
      if (!Array.isArray(findings) && notes.length === 0) return EMPTY_CARRIER_CONTENT;
      return {
        count: Array.isArray(findings) ? findings.length : 0,
        findings: Array.isArray(findings) ? this.#schema.findingsOf(findings) : [],
        notes,
      };
    } catch {
      return EMPTY_CARRIER_CONTENT;
    }
  }
}

/** One record's carrier content — the THREE cells the board reads from one read (P37
 *  §5.2 · P42 §2.1): the native findings count (`+N`), the projected rows (the
 *  downgrade mark) and the child's notes (`notes +M`). */
interface LineCarrierContent {
  readonly count: number;
  readonly findings: readonly RoundFinding[];
  readonly notes: readonly string[];
}

/** The unreadable / content-free carrier — a shared frozen value (no allocation per
 *  empty record). */
const EMPTY_CARRIER_CONTENT: LineCarrierContent = { count: 0, findings: [], notes: [] };

/**
 * BoardView — the entry-document → board face. The identity index (`SlugIndex`)
 * is the ONLY node source: the entry document's declared `doc-type:` picks the
 * board shape and every related node resolves by slug. Pure reads — zero tree
 * writes, zero ledger writes, zero child dispatch.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the board fact-read surface — the zero-bare-function discipline admits no standalone predicate functions.
export class BoardView {
  /** readDocType(root, rel) — the doc's declared type alone (the front-matter
   *  `doc-type:` key, spec §12 · D34): the ONE declaration reading face shared
   *  by the board and the capsule's doc-class discrimination. An absent file, a
   *  missing key or an out-of-domain value reads null — the consumer
   *  blocks (zero filename-suffix fallback, zero dual-read layer). The path is the
   *  repoRoot-relative branded `RepoPath`, erased to the absolute syscall form
   *  through the ONE value object (`root.resolve`) just before the read — the brand
   *  is REAL (the absolute state is unrepresentable as a `RepoPath`, T4 §2.2), the
   *  same shape as `artifacts.readText(node, root, file)`). */
  static readDocType(root: RepoRoot, rel: RepoPath): DocKey | null {
    return BoardView.#docTypeOf(
      FrontMatterExtractor.split(BoardView.#read(root.resolve(rel)) ?? "").head.docType,
    );
  }

  /** docClassOf(root, target) — the pipeline-station discrimination of one render
   *  target (spec §5.2 · D33): a doc shape's class reads its DECLARED type (the
   *  front-matter `doc-type:` key — the ONE declaration reading face above), never
   *  the filename suffix or the `--type` spelling; the node shapes key by their own
   *  type. `blocked` — the key is missing (the renderer prints the BLOCKED face).
   *  Every declared class is a pipeline key, a standalone `single-spec` included: its
   *  closure hands off to `cdd-plan`, never to a terminus. This is the injected seam
   *  of the ONE hop derivation: `session/next.ts` never imports a face class, and
   *  every read face shares this ONE judgment. The basis is REQUIRED — an unrooted
   *  resolve would read the target against `process.cwd()`, so an engine invoked from
   *  a subdirectory could report a declared line as `doc-class-blocked`; the root is
   *  always the value object the read face holds. */
  static docClassOf(root: RepoRoot, target: RouteTarget): DocClassVerdict {
    if (target.type === "plan") return "plan";
    if (target.type === "wave") return "wave";
    if (target.type === "branch") return "branch";
    const declared = BoardView.readDocType(root, root.relativize(target.id));
    return declared === null ? "blocked" : declared;
  }

  /** The doc file's raw text — an absent/unreadable file reads null (the reads
   *  above degrade to null facts, never a throw). */
  static #read(docPath: string): string | null {
    try {
      return readFileSync(docPath, "utf8");
    } catch {
      return null;
    }
  }

  /** The declared doc type constrained to the DocKey domain (null otherwise). */
  static #docTypeOf(declared: string | null): DocKey | null {
    if (declared === null) return null;
    return (DOC_TYPE_DOMAIN as readonly string[]).includes(declared) ? (declared as DocKey) : null;
  }

  // -------------------------------------------------------------------------
  // the progress projection (spec §5) — the per-node progress.json single-source read
  // -------------------------------------------------------------------------

  /** The node's identity chain, resolved through the index by slug (spec §2.2):
   *  the identity document (an overall/single/phase spec), the same-slug plan, and
   *  the program overall the identity's `program:` names. An entry that is itself
   *  a plan contributes the plan and resolves its spec by the same slug. The
   *  `programMissing` fact is the phase-spec hard gate: a `program:` that names no
   *  on-disk overall (or no `program:` at all). Zero filename derivation and zero
   *  "first document": each slot is the index's SET answer (0 / 1 / n).
   *
   *  Naming the entry document on argv (`cdd board --spec` / `--plan`) does NOT
   *  exempt its slot from the set: the entry's identity is still its slug, so a
   *  second same-class document makes that slot `many` and the row renders the
   *  marker plus every declared home. `own` survives only where the set cannot be
   *  asked — no legal slug, or an undeclared `doc-type:` that no class can hold. */
  static #nodeSources(index: SlugIndex, entry: DocEntry): NodeSources {
    const slug = BoardView.#validSlug(entry);
    const isPlan = entry.docType === "plan";
    const own: DocSlot = { kind: "one", entry };
    const spec =
      slug === null
        ? isPlan
          ? NO_DOC
          : own
        : entry.docType === null
          ? own
          : BoardView.#docSlotOf(index, slug, "identity");
    const plan =
      slug === null ? (isPlan ? own : NO_DOC) : BoardView.#docSlotOf(index, slug, "plan");
    const specEntry = BoardView.#slotEntry(spec);
    const overall =
      specEntry?.docType === "phase-spec" && specEntry.program !== null
        ? index.overallOf(specEntry.program)
        : null;
    return {
      spec,
      plan,
      overall,
      programMissing: specEntry !== null && BoardView.#programMissing(index, specEntry),
    };
  }

  /** One doc slot — the index's SET answer for a class, filtered and then counted,
   *  never searched with `.find`. Two documents of the class are `many`, and every
   *  caller renders the marker and the whole set instead of choosing one. */
  static #docSlotOf(index: SlugIndex, slug: string, role: SlugRole): DocSlot {
    const docs = index
      .docsOf(slug)
      .filter((doc) =>
        role === "plan" ? doc.docType === "plan" : doc.docType !== null && doc.docType !== "plan",
      );
    if (docs.length === 0) return NO_DOC;
    if (docs.length === 1) return { kind: "one", entry: docs[0]! };
    return { kind: "many", found: docs };
  }

  /** The single document a slot carries — `null` for both the empty and the
   *  ambiguous arm: neither has ONE document to speak about. */
  static #slotEntry(slot: DocSlot): DocEntry | null {
    return slot.kind === "one" ? slot.entry : null;
  }

  /** One document slot's violation marker — the single arm asks `#entryMark` (the ONE
   *  duplicate / identity judgment the pre-flight gate shares), and an ambiguous set
   *  renders the same `duplicated` marker the doc domain's `read` refuses on. */
  static #slotMark(index: SlugIndex, slot: DocSlot, role: SlugRole): string | null {
    if (slot.kind === "one") return BoardView.#entryMark(index, slot.entry, role);
    return slot.kind === "many" ? MARK_SLUG_DUPLICATED : null;
  }

  /** The cell of a doc row whose slug names MORE than one document of its class: the
   *  existing duplicate marker plus every path of the set. No version, no status, no
   *  rounds — those are facts of ONE document, and this identity has none. */
  static #duplicateDocLine(label: string, found: readonly DocEntry[]): string {
    const paths = found.map((doc) => doc.rel).join(" · ");
    return `  ${label.padEnd(LABEL_WIDTH)}${MARK_SLUG_DUPLICATED}   ${paths}`;
  }

  /** The entry's valid slug — the workspace key, or null when the declaration is
   *  absent or illegal (an illegal value is a violation, never a directory name). */
  static #validSlug(entry: DocEntry | null): string | null {
    if (entry === null) return null;
    return SlugIndex.isLegalSlug(entry.slug) ? entry.slug : null;
  }

  /** The line's violation marker (spec §3.1) — slug missing / illegal / duplicated,
   *  then the missing type declaration. The duplicate probe reads the SAME index
   *  judgment the dispatch pre-flight consumes (one fact, one place). */
  static #entryMark(index: SlugIndex, entry: DocEntry | null, role: SlugRole): string | null {
    if (entry === null) return null;
    if (entry.slug === null) return MARK_SLUG_MISSING;
    if (!SlugIndex.isLegalSlug(entry.slug)) return MARK_SLUG_INVALID;
    if (entry.docType === null) return MARK_DOC_TYPE_MISSING;
    return index.duplicatedRolesOf(entry.slug).includes(role) ? MARK_SLUG_DUPLICATED : null;
  }

  /** The identity document's line word — its DECLARED `doc-type:` (spec §12 · D34), the
   *  ONE word the line keys under (`run.ts`'s `#lineKey`) and the word the pipeline
   *  station follows. `phase-spec` is the degradation default for an absent or
   *  undeclared document (that line renders `(none)` / its BLOCKED marker anyway) — it
   *  is never a translation of a declared word. */
  static #lineWordOf(entry: DocEntry | null): TargetType {
    return entry?.docType ?? "phase-spec";
  }

  /** One doc line — the header facts read from the indexed entry + the row's round
   *  RECORDS keyed by the line's `progress.json` key, resolved with the line's DECLARED
   *  word as the retired-key alias basis (a charter's pre-rename `spec` row is its own
   *  `overall` line). The ledger is the one that OWNS `progress` — a node board reads
   *  the overall line from the program's workspace, never the node's. */
  static #lineOf(
    label: string,
    key: string,
    entry: DocEntry | null,
    progress: ProgressData | null,
    ledger: Ledger | null,
  ): BoardLine {
    const rounds = BoardView.#rowRounds(progress, key);
    return {
      label,
      version: entry?.version ?? null,
      status: entry?.status ?? null,
      docType: entry?.docType ?? null,
      rounds,
      carriers: LineCarriers.ofLedger(ledger, key, key, rounds),
      marker: null,
      type: key,
      key,
    };
  }

  /** summaryCell(records) — the line's aggregated rounds cell (P24 §12): the SUCCESS
   *  face of each verb merges into at most one token (never rendered at zero successes),
   *  the ANOMALY face expands one token per failed attempt. Tokens are verb-major in
   *  `VERB_ORDER`, a verb's success token before its failures, those in stored order. The
   *  range form (`review 1–10 ✓`) never renders: the aggregation IS the count. `display`
   *  is the printing face alone: the notes segment prints its count either way and its
   *  bodies only when `--notes` is open. */
  static summaryCell(
    records: readonly RoundRecord[],
    carriers: LineCarriers,
    display: BoardDisplay = FOLDED_NOTES,
  ): string {
    const tokens: string[] = [];
    const extra = [...new Set(records.map((record) => record.op))].filter(
      (op) => !VERB_ORDER.includes(op),
    );
    for (const verb of [...VERB_ORDER, ...extra]) {
      const faces = BoardView.#judgementRuns(records.filter((record) => record.op === verb));
      tokens.push(...BoardView.#verbTokens(verb, faces, carriers, display));
    }
    return tokens.join(" · ");
  }

  /** One verb's tokens — its success token (absent at zero successes) followed by one
   *  token per failed attempt, so a failure never drifts to the line's tail (P24 §12). */
  static #verbTokens(
    verb: string,
    faces: VerdictFaces,
    carriers: LineCarriers,
    display: BoardDisplay,
  ): readonly string[] {
    const tokens: string[] = [];
    const success = BoardView.#successToken(verb, faces, carriers, display);
    if (success !== null) tokens.push(success);
    for (const record of faces.failures) {
      tokens.push(BoardView.#failureToken(verb, record, faces.successes, carriers, display));
    }
    return tokens;
  }

  /** One verb's success token — absent when no round of the verb succeeded (a
   *  failure-only verb renders its `✗` tokens alone), the plain count plus the LAST
   *  success's attempt superscript when the verb has no failed attempt, and the
   *  `{succeeded}/{attempts}` ratio — never a superscript — once it has one (P24 §12).
   *  Its `+N` counts the SUCCESS records' carriers alone; a failed attempt's findings
   *  already ride that attempt's own token. */
  static #successToken(
    verb: string,
    faces: VerdictFaces,
    carriers: LineCarriers,
    display: BoardDisplay,
  ): string | null {
    const count = faces.successes.length;
    if (count === 0) return null;
    const last = faces.successes[count - 1]!;
    const body =
      faces.failures.length === 0
        ? `${count}${BoardView.attemptSuffix(last)}`
        : `${count}/${count + faces.failures.length}`;
    return BoardView.#summaryToken(
      verb,
      body,
      JUDGEMENT_MARKERS.passed,
      faces.successes,
      carriers,
      display,
    );
  }

  /** One failed attempt's token — `{verb} {cycle}{aN} ✗{+N}`, the cycle naming the round
   *  that failed rather than a re-counted segment, and `✗→✓` when the SAME cycle's next
   *  attempt (`attempt + 1`) completed: recovery reads exactly that one edge — a later
   *  cycle's success and a further same-cycle attempt are historical failures. The `+N`
   *  counts this record's own carrier alone, never erased by a later success (P24 §12). */
  static #failureToken(
    verb: string,
    record: RoundRecord,
    successes: readonly RoundRecord[],
    carriers: LineCarriers,
    display: BoardDisplay,
  ): string {
    const recovered = successes.some(
      (other) => other.cycle === record.cycle && other.attempt === record.attempt + 1,
    );
    const mark = recovered ? JUDGEMENT_MARKERS.recovered : JUDGEMENT_MARKERS.failed;
    const body = `${record.cycle}${BoardView.attemptSuffix(record)}`;
    return BoardView.#summaryToken(verb, body, mark, [record], carriers, display);
  }

  /** One token of a verb's success face or of one failed attempt, `{verb} {body} {mark}`
   *  (P24 §12). The `+N` suffix counts the run's graded FINDINGS, read from each round's
   *  own carrier (`LineCarriers` — the derived path + the record's own digest, spec
   *  §2.10) — never the round's hard/soft contract violations, which are a different
   *  fact. A record that resolves no carrier (a legacy row, or a work-plane round whose
   *  carrier declares no findings) contributes zero. */
  static #summaryToken(
    verb: string,
    body: string,
    mark: string,
    run: readonly RoundRecord[],
    carriers: LineCarriers,
    display: BoardDisplay,
  ): string {
    // Rule zero (class-size limit): this file is well past the limit and predates it —
    // splitting it is P39's work (design spec D95 ②), not this round's.
    const findings = run.reduce((total, record) => total + carriers.countOf(record), 0);
    const suffix = findings === 0 ? "" : `+${findings}`;
    // P37 §5.2 — the downgrade note rides the SAME token, after its `+N`: the mark when
    // a row owes its reason, the stated reason when the row carries one (both composed
    // by the criteria module's ONE note). One token, one line, no new entry — the note is
    // display, never a finding.
    const notes = run.flatMap((record) => carriers.regradeNoteOf(record) ?? []);
    const note = notes.length === 0 ? "" : ` ${notes.join(REGRADE_NOTE_SEPARATOR)}`;
    // P42 §2.1 — the child's own notes ride the SAME token at its VERY END, after the
    // downgrade note: `notes +M` counts the run's note rows (the same `run` the `+N`
    // counts, so a merged success token counts its group and a failure token its one
    // record). The count is ALWAYS printed and the bodies are printed only under
    // `--notes` (the folded default), folded row by row through the criteria module's
    // one display fold. The join order `verb · body · mark · +N · regrade note · notes
    // +M` never moves, and folding never removes the segment — it prints the count
    // alone, so an expanded token is the folded token plus the same bytes appended.
    const noteRows = run.flatMap((record) => carriers.notesOf(record));
    const noteBodies = display.notes
      ? noteRows.map((row) => `${REGRADE_NOTE_SEPARATOR}${displayReason(row)}`).join("")
      : "";
    const notesSegment = noteRows.length === 0 ? "" : ` notes +${noteRows.length}${noteBodies}`;
    return `${verb} ${body} ${mark}${suffix}${note}${notesSegment}`;
  }

  /** attemptSuffix(record) — the re-dispatch superscript: `attempt === 1` renders
   *  nothing (an `a1` never appears), otherwise `a{attempt}`. */
  static attemptSuffix(record: RoundRecord): string {
    return record.attempt === 1 ? "" : `a${record.attempt}`;
  }

  /** The judgement faces of one verb — the success face and the anomaly face, each in
   *  the stored (chronological) order: successes merge into ONE token per verb while
   *  failed attempts expand one token each (P24 §12). */
  static #judgementRuns(records: readonly RoundRecord[]): VerdictFaces {
    return {
      successes: records.filter((record) => record.verdict.targetAction),
      failures: records.filter((record) => !record.verdict.targetAction),
    };
  }

  /** nextLine(hop, renderer) — the board's `next:` row rendered from the INJECTED
   *  hop through the shared hop renderer (`RouteRenderer#renderHop`), so the board's
   *  line and the capsule's line are byte-identical by construction. Every embedded
   *  path value renders repoRoot-relative (the renderer's own basis). A hop the
   *  renderer renders as no line degrades to the same `(none)` bytes the absent-hop
   *  row carries — the row is never built from a null value. */
  static nextLine(hop: NextHop, renderer: RouteRenderer): string {
    const value = renderer.renderHop(hop) ?? "(none)";
    return `  next:    ${value}`;
  }

  /** reasonLine(hop) — the board's `reason:` row under `next:`: the hop's OWN named
   *  fact (`NextHop.reason`), the same field the capsule's `renderReason` row prints,
   *  so the two faces state one value by construction. The PREFIX is this face's own
   *  layout literal (`  reason:  ` — the same 11-column shape `nextLine` uses); the
   *  capsule takes its prefix from the word table instead, so each face keeps its own
   *  prefix and only the token is shared. A row exists only for an existing hop: the
   *  absent hop renders `  next:    (none)` and NO reason row at all (the caller's
   *  null-next branch), never a half-built one. */
  static reasonLine(hop: NextHop): string {
    return `  reason:  ${hop.reason}`;
  }

  /** inFlightRows(state, orphans, words) — the tree's dispatch fact + the
   *  workspace's orphan handoff drafts, as board lines. The held row names the
   *  holder's IDENTITY facts alone (the operating verb, the round's cycle + attempt
   *  cells a takeover has to answer for, the wave key and the pid, spec §5.3): the
   *  child's command line, its start instant and its plan path are dispatch
   *  narrative, not board facts. A DEAD holder adds the takeover hint — the fourth
   *  state's line when the record's own target facts read out missing, else the
   *  ordinary `stealable` sentence (`Words.inFlightTakeoverHint` is that ONE choice).
   *  The free and
   *  corrupt rows are the word table's declared rows — the board's hint is the same
   *  bytes the preview face and the gate print (one vocabulary, never a board
   *  literal). The orphan rows are the drafts no recorded round owns — the board
   *  lists them, never writes or deletes them. */
  static inFlightRows(
    state: InFlightState,
    orphans: readonly string[],
    words: Words,
    crashes: readonly string[] = [],
  ): readonly string[] {
    const rows: string[] = [];
    if (state.kind === "held") {
      const record = state.record;
      const dead = state.alive ? "" : ` — ${words.inFlightTakeoverHint(state.targetGone)}`;
      const identity = [
        `pid ${record.pid}`,
        `op: ${record.phase ?? "dispatch"}`,
        record.cycle === null ? null : `cycle: ${record.cycle}`,
        record.attempt === null ? null : `attempt: ${record.attempt}`,
        `slug: ${record.slug}`,
        `wave: ${record.wave ?? "none"}`,
      ].filter((cell): cell is string => cell !== null);
      rows.push(`  in-flight: ${identity.join(" · ")}${dead}`);
    } else if (state.kind === "corrupt") {
      const inFlight = words.inFlightWords();
      rows.push(`  in-flight: ${state.locked ? inFlight.corruptLocked : inFlight.corruptUnlocked}`);
    } else {
      rows.push(`  in-flight: ${words.checkedWords().inFlight.free}`);
    }
    for (const orphan of orphans) rows.push(`  orphan: ${orphan} — no recorded round owns it`);
    rows.push(...crashes);
    return rows;
  }

  /** refusalRows(state, words) — the tree's OWN refusal record as board lines (P40 T7,
   *  spec §3.1's two rows). The record is the tree's fact, so the row names the round
   *  identity the refused dispatch would have consumed in the SAME spelling the
   *  `crashed:` row uses (`{cycle}·a{attempt}`), then the station and the record's one
   *  stored line — two facts of one refusal, never a second history.
   *
   *  Three states, three answers: `absent` prints NOTHING (no refusal stands — the
   *  board's other rows are already the whole truth), a standing record prints its row,
   *  and a CORRUPT record prints its own line: a record the reader cannot parse is a
   *  fact about the tree, and rendering it as "no refusal" would swallow exactly the
   *  damage the record exists to report.
   *
   *  The row is an observation only: it joins no aggregation, and the counts, the legend
   *  and the `next:` hop stay byte-identical with and without it (the same rule the
   *  `crashed:` row follows). */
  static refusalRows(state: RefusalState, words: Words): readonly string[] {
    if (state.kind === "absent") return [];
    const row = words.refusalWords();
    if (state.kind === "corrupt") return [`  ${row.token} ${row.corrupt}`];
    const facts = state.facts;
    return [
      `  ${row.token} ${facts.op} ${facts.cycle}·a${facts.attempt} ${facts.station} · ${facts.detail}`,
    ];
  }

  /** crashedRows(records) — the node's CRASHED rounds as ONE board line, one token per
   *  round: `crashed: {op} {cycle}·a{attempt} {cause} · {op} {cycle}·a{attempt} {cause}`.
   *  A round crashed when its booked verdict withheld the target action AND at least one
   *  of its violations is HARD; the cause is the FIRST hard entry in record order — the
   *  round's own narrative never re-orders it. The tokens read `(cycle, attempt)` — the
   *  session's own sequence, never the progress file's write order (spec §2.13) — and one
   *  round identity yields ONE token even when a recovery re-booked it. The ` · ` is the
   *  INTER-TOKEN separator alone (a cause stays space-separated, so a token never splits),
   *  and zero crashed rounds render no line at all. The row is an observation only: it
   *  joins no aggregation, the counts, the legend and the `next:` hop stay byte-identical
   *  with and without it (spec §5.3 — a failed round is never hidden, never re-counted). */
  static crashedRows(records: readonly RoundRecord[]): readonly string[] {
    const tokens = BoardView.#crashTokens(records);
    return tokens.length === 0 ? [] : [`  crashed: ${tokens.join(" · ")}`];
  }

  /** The crashed rounds as ordered, de-duplicated tokens — the ONE line's cells. */
  static #crashTokens(records: readonly RoundRecord[]): readonly string[] {
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const record of BoardView.#byRound(records.filter((entry) => BoardView.#crashed(entry)))) {
      const identity = `${record.op}:${record.cycle}:${record.attempt}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const cause = record.violations.find((violation) => violation.grade === "hard")!;
      tokens.push(`${record.op} ${record.cycle}·a${record.attempt} ${cause.cause}`);
    }
    return tokens;
  }

  /** The records in board order — `(cycle, attempt)`, the round identity's own sequence.
   *  A copy: the caller's array (a progress row's records) stays untouched. */
  static #byRound(records: readonly RoundRecord[]): readonly RoundRecord[] {
    return [...records].sort(
      (left, right) => left.cycle - right.cycle || left.attempt - right.attempt,
    );
  }

  /** Whether one round crashed — the verdict withheld the target action AND a HARD
   *  violation is booked (a soft-only failure stays the anomaly face's `✗` token). */
  static #crashed(record: RoundRecord): boolean {
    return (
      record.verdict?.targetAction === false &&
      record.violations.some((violation) => violation.grade === "hard")
    );
  }

  /** The node's every booked round — one flat read over the progress rows' records
   *  (the normalizer folds the legacy forms), so the crash scan needs no key grammar.
   *  An absent progress row carries no rounds. */
  static #nodeRecordsOf(progress: ProgressData | null): readonly RoundRecord[] {
    return progress === null ? [] : progress.waves.flatMap((row) => RoundRecords.of(row));
  }

  // -------------------------------------------------------------------------
  // the render face (spec §5.3) — the entry document → board layout + next render
  // -------------------------------------------------------------------------

  /** render(readTable, plan, index, entry, repoRoot, words, host, channels, holding,
   *  next, projection) — the entry document's board (spec §3.1): the declared `doc-type:`
   *  picks the shape — `overall` → the program board, every other type → the node
   *  board. The index supplies every related node (`program:` → overall; same slug →
   *  spec / plan), so no filename grammar participates. `next` is the INJECTED
   *  `NextHop` the node board's `next:` row renders (null = the board holds no
   *  derivable hop, the `(none)` degradation). The argv channel is threaded into the
   *  shared `RouteRenderer` (the SAME channel the capsule's route render reads, so the
   *  board's `next:` and the engine's `next:` literal compose their argv from ONE
   *  flag-spelling source). A present doc line carrying a violation renders the
   *  matching `(BLOCKED)` marker and the board exits 2 (spec §3.1 — the board's reject
   *  face is exit 2, never the dispatch CDD_BLOCKED channel). Pure reads — zero tree
   *  writes, zero ledger writes, zero child dispatch.
   *
   *  `readTable` is the caller's ORDERED per-phase plan value table (spec §2.1 ·
   *  §2.4): `Cli#runBoard` builds it once, in `index.phaseSpecsOf` row order, so an
   *  overall board's every phase cell and every `CDD_WARN:` line reads the SAME value
   *  the wave segment reads. A single-document board is a table of length 1 — its one
   *  row is the argv face's read (solo `--plan`) or the derived face's (`--spec`).
   *  The board therefore holds no plan-reading seam of its own: the ONE read point is
   *  the injected `PlanSource`, and a value is never re-read here.
   *
   *  `projection` is the artifact observation's ONE input (the matrix seam plus the
   *  `--artifacts` switch) — the two halves travel together so neither can arrive
   *  without the other. `display` is the PRINTING face (`--notes`): it changes the
   *  notes segment's bytes, never the count, the segment order or any judgment. */
  static render(
    readTable: readonly PlanRead[],
    plan: PlanSource,
    index: SlugIndex,
    entry: DocEntry,
    repoRoot: string,
    words: Words,
    host: string,
    refusal: RefusalState,
    channels: Readonly<Record<string, RouteChannelRow>> = {},
    holding: InFlightState = { kind: "absent" },
    next: NextHop | null = null,
    projection: ArtifactProjection = NO_ARTIFACTS,
    display: BoardDisplay = FOLDED_NOTES,
  ): BoardRender {
    const lines: string[] = [`cdd board: ${entry.slug ?? "(none)"}`, ""];
    // The repo-basis value object — constructed ONCE at this boundary, the ONE
    // conversion exit the doc cells and the `next:` render normalize their embedded
    // paths through (T1 `RepoRoot` · D47). The raw string is threaded no further:
    // the board renders read the basis through `root.absolute` (F2 — one basis,
    // one form).
    const root = new RepoRoot(repoRoot);
    const exitCode =
      entry.docType === "overall"
        ? BoardView.#programBoard(
            readTable,
            plan,
            lines,
            index,
            entry,
            root,
            words,
            projection,
            display,
          )
        : BoardView.#nodeBoard(
            // A node board is ONE document: the caller's single row. An empty table
            // means no document was read at all — the seam's own undeclared value is
            // that read result (no file is opened, so this mints no second read).
            readTable[0] ?? plan.readFor(null),
            plan,
            lines,
            index,
            entry,
            root,
            words,
            host,
            refusal,
            channels,
            holding,
            next,
            projection,
            display,
          );
    lines.push("", PROGRESS_LEGEND.board);
    return { lines, exitCode };
  }

  /** The node board render — the overall/spec/plan/wave/branch rows + the next
   *  render (spec §3.1.1). The node's identity chain comes from the index
   *  (`program:` → overall; same slug → spec / plan); a missing link renders
   *  `(none)` and stays exit 0, while a violated line renders its marker and exits
   *  2. The repo-basis `root` is threaded alone (F2) — its `absolute` feeds the
   *  fs-facing helpers, its value object the path renders. `read` is the caller's
   *  ONE plan value (spec §2.1): the plan row, the wave row and the `! no-spec`
   *  spec row all take their facts from it, so the document the board names and
   *  the document it read are one fact. */
  static #nodeBoard(
    read: PlanRead,
    plan: PlanSource,
    lines: string[],
    index: SlugIndex,
    entry: DocEntry,
    root: RepoRoot,
    words: Words,
    host: string,
    refusal: RefusalState,
    channels: Readonly<Record<string, RouteChannelRow>>,
    holding: InFlightState,
    next: NextHop | null,
    projection: ArtifactProjection,
    display: BoardDisplay,
  ): number {
    const repoRoot = root.absolute;
    const sources = BoardView.#nodeSources(index, entry);
    const nodeSlug = BoardView.#validSlug(entry);
    const nodeSeat =
      nodeSlug === null ? null : BoardView.#ledgerOf(plan, nodeSlug, repoRoot, projection.registry);
    const ledger = nodeSeat?.ledger ?? null;
    const progress = ledger?.readProgress() ?? null;
    const overallSlug = BoardView.#validSlug(sources.overall);
    const overallSeat =
      overallSlug === null
        ? null
        : BoardView.#ledgerOf(plan, overallSlug, repoRoot, projection.registry);
    const overallLedger = overallSeat?.ledger ?? null;
    const overallProgress = overallLedger?.readProgress() ?? null;
    // The tree's dispatch fact + the node workspace's orphan drafts + the node's
    // crashed rounds render before the line rows (a reader answers "is anyone working
    // here?" before reading progress).
    const orphans = ledger?.orphanHandoffs() ?? [];
    // The node's OWN rounds — the overall document's records belong to the program
    // board, never to this node's crash observation (a parent's failed round is not
    // this node's work). `crashedRows` dedupes by round identity itself.
    const crashes = BoardView.crashedRows(BoardView.#nodeRecordsOf(progress));
    for (const row of BoardView.inFlightRows(holding, orphans, words, crashes)) lines.push(row);
    // The tree-level fact block ends here: the refusal row sits AFTER it (`in-flight:` ·
    // `orphan:` · `crashed:` are one block, so a crashed round or an orphan draft stands
    // between the two when it exists) — the assembly position IS the asserted position.
    for (const row of BoardView.refusalRows(refusal, words)) lines.push(row);
    if (
      holding.kind !== "absent" ||
      orphans.length > 0 ||
      crashes.length > 0 ||
      refusal.kind !== "absent"
    )
      lines.push("");

    // The two identity marks the read-value ladder consults (spec §2.7's first two
    // layers): a non-empty mark keeps the EXISTING `#docCell` accounting and exit 2 —
    // identity breakage outranks the read value, so neither the plan row nor the spec
    // row asks a `PlanRead` accessor, and no `! no-spec` literal (the orphan fold or
    // the degraded wave row) can appear beside a broken identity.
    const specMark =
      BoardView.#slotMark(index, sources.spec, "identity") ??
      (sources.programMissing ? MARK_PROGRAM_MISSING : null);
    const planMark = BoardView.#slotMark(index, sources.plan, "plan");
    const specEntry = BoardView.#slotEntry(sources.spec);
    const planEntry = BoardView.#slotEntry(sources.plan);
    const planIdentityClean = planMark === null;
    const identityClean = planIdentityClean && specMark === null;
    const docRows: Array<{
      readonly label: string;
      readonly slot: DocSlot;
      readonly line: BoardLine;
      readonly mark: string | null;
      /** The cell content a `PlanRead` accessor owns; null hands the row to
       *  `#docCell` (the index-derived bytes). */
      readonly override: string | null;
    }> = [
      {
        label: "overall",
        slot: sources.overall === null ? NO_DOC : { kind: "one", entry: sources.overall },
        line: BoardView.#lineOf(
          "overall",
          "overall",
          sources.overall,
          overallProgress,
          overallLedger,
        ),
        mark: BoardView.#entryMark(index, sources.overall, "identity"),
        override: null,
      },
      {
        label: "spec",
        slot: sources.spec,
        line: BoardView.#lineOf(
          "spec",
          BoardView.#lineWordOf(specEntry),
          specEntry,
          progress,
          ledger,
        ),
        mark: specMark,
        // The reverse-lookup orphan's spec row (spec §2.7 ①): the identity-clean
        // row bypasses `#entryMark` / `#docCell` accounting — landing in the mark
        // channel would make it `blocked: true` and flip the orphan board to exit 2.
        override: identityClean ? read.specLine(words) : null,
      },
      {
        label: "plan",
        slot: sources.plan,
        line: BoardView.#lineOf("plan", "plan", planEntry, progress, ledger),
        mark: planMark,
        override: BoardView.#planCellOf(read, planEntry, planMark, words),
      },
    ];
    // The doc-name column is fixed-width: every name is padded to the widest one, so
    // the version column aligns down the block (spec §5.3).
    const nameWidth = Math.max(
      0,
      ...docRows.flatMap((row) =>
        row.slot.kind === "one" ? [path.basename(row.slot.entry.path).length] : [],
      ),
    );
    let blocked = false;
    for (const row of docRows) {
      // An ambiguous set is its own row: the marker plus every path, never one
      // document's header facts (spec §2.3 — the read face answers a set with a set).
      if (row.slot.kind === "many") {
        lines.push(BoardView.#duplicateDocLine(row.label, row.slot.found));
        blocked = true;
        continue;
      }
      if (row.override !== null) {
        lines.push(`  ${row.label.padEnd(LABEL_WIDTH)}${row.override}`.trimEnd());
        continue;
      }
      const cell = BoardView.#docCell(
        BoardView.#slotEntry(row.slot),
        row.line,
        nameWidth,
        row.mark,
        display,
      );
      lines.push(`  ${row.label.padEnd(LABEL_WIDTH)}${cell.text}`.trimEnd());
      blocked ||= cell.blocked;
    }

    // The doc face asks the READ first and the assembler second (spec §2.4): a
    // degradation literal is the value's, the healthy row stays byte-identical to
    // today's (`waves()` + `graph.report(ledger.closedWaves())` + `#rowRounds` +
    // `LineCarriers`). `waves()` being empty is never the `(none)` signal. The ONE
    // literal an identity break bans is `! no-spec` (`spec-absent` beside a rendered
    // `(BLOCKED)` marker); `! unparseable` / `! unreadable` / `(empty plan)` still
    // render, so a reader can tell a missing plan from a plan that does not read.
    const specAbsent = read.orphan()?.cause === "spec-absent";
    const degraded = specAbsent && !planIdentityClean ? null : read.degradedWaveRow(words);
    // The wave segment is derived ONCE — the rendered rows and the `art:` projection's
    // record set read the same lines (never a second derivation over the same read).
    const waves = degraded === null ? BoardView.#waveLines(read, progress, ledger) : [];
    if (degraded !== null) {
      lines.push(`  ${"wave".padEnd(LABEL_WIDTH)}${degraded}`);
    } else {
      if (waves.length === 0) {
        lines.push(`  ${"wave".padEnd(LABEL_WIDTH)}(none)`);
      } else {
        // The marker column is fixed-width: every wave label is padded to the widest
        // label so the ✔/▶/○ markers align into one column (spec §5.3 · D40).
        const labelWidth = Math.max(...waves.map((wave) => wave.label.length));
        waves.forEach((wave, index) => {
          const prefix =
            index === 0 ? `  ${"wave".padEnd(LABEL_WIDTH)}` : " ".repeat(2 + LABEL_WIDTH);
          const cell = BoardView.summaryCell(wave.rounds, wave.carriers, display);
          const label = wave.label.padEnd(labelWidth);
          lines.push(
            `${prefix}${label}  ${wave.marker ?? ""}${cell === "" ? "" : `  ${cell}`}`.trimEnd(),
          );
        });
      }
    }

    const branchLine = BoardView.#roundsLine("branch", "branch", progress, ledger);
    // The branch line's mark is the SAME drift-aware judgment its pipeline facts read
    // (`Ledger#lineStateAt`, identity document = the plan): a drifted plan reopens the
    // branch face, so the mark can never print `✔ closed` while `next:` names the
    // review the gate accepts — the reopened line renders as the CURRENT face (`▶`).
    const branchState = ledger?.lineStateAt("branch", "branch", planEntry?.path ?? null) ?? "open";
    const branchMark =
      branchState === "closed"
        ? `${PROGRESS_MARKERS.done} closed`
        : branchState === "reopened"
          ? `${PROGRESS_MARKERS.current} open`
          : `${PROGRESS_MARKERS.pending} open`;
    const branchRounds = BoardView.summaryCell(branchLine.rounds, branchLine.carriers, display);
    lines.push(
      `  ${"branch".padEnd(LABEL_WIDTH)}${branchMark}${branchRounds === "" ? "" : `  ${branchRounds}`}`.trimEnd(),
    );

    // The `art:` fact block — the artifact inventory this node's rounds resolve to,
    // rendered AFTER the line rows and BEFORE `next:` / `reason:` (the two last rows
    // stay last, spec §2.6). A healthy tree adds zero bytes: only a `misplaced` /
    // `invalid` judgment prints, and `--artifacts` alone opens the full inventory. The
    // block never joins the tail counts — the findings axis and the artifact axis are
    // two axes.
    const artifactRows = BoardView.#artifactRows(
      BoardView.#artifactScopes({
        docLines: docRows.map((row) => row.line),
        waves,
        branchLine,
        nodeSeat,
        overallSeat,
      }),
      projection,
    );
    if (artifactRows.length > 0) {
      lines.push("");
      lines.push(...artifactRows);
    }

    lines.push("");
    if (next === null) {
      lines.push("  next:    (none)");
    } else {
      const renderer = new RouteRenderer(words, channels, host, root);
      lines.push(BoardView.nextLine(next, renderer));
      lines.push(BoardView.reasonLine(next));
    }
    return blocked ? 2 : 0;
  }

  /** The program board render — the overall line (its own rounds) + one summary line
   *  per phase-spec whose `program:` names this overall + `next: done` (cross-phase
   *  never participates in next, spec §6.5). The phase set derives from the ONE
   *  index (`program:` grouping — no overall child-list array). A phase row's primary
   *  key is its `slug:`, annotated with the truncated `title:`; any overall/phase
   *  violation renders its marker and exits 2 (spec §3.1 — zero silent fallback).
   *
   *  The `art:` projection is the SAME one the node board renders (spec §2.4 · §2.6):
   *  the overall line is dispatched from the program workspace, so its own review
   *  rounds are the rounds a docs-fix gate judges, and the board must show that
   *  judgment before the dispatch. The scope binds the overall line to the program
   *  seat — the seat this render already holds — and `--artifacts` therefore opens the
   *  same inventory view here as on a node board (never a silent no-op). */
  static #programBoard(
    readTable: readonly PlanRead[],
    plan: PlanSource,
    lines: string[],
    index: SlugIndex,
    entry: DocEntry,
    root: RepoRoot,
    words: Words,
    projection: ArtifactProjection,
    display: BoardDisplay,
  ): number {
    const repoRoot = root.absolute;
    const overallSlug = BoardView.#validSlug(entry);
    const seat =
      overallSlug === null
        ? null
        : BoardView.#ledgerOf(plan, overallSlug, repoRoot, projection.registry);
    const ledger = seat?.ledger ?? null;
    const overallLine = BoardView.#lineOf(
      "overall",
      "overall",
      entry,
      ledger?.readProgress() ?? null,
      ledger,
    );
    const overallDoc = BoardView.#docCell(
      entry,
      overallLine,
      path.basename(entry.path).length,
      BoardView.#entryMark(index, entry, "identity"),
      display,
    );
    lines.push(`  ${"overall".padEnd(LABEL_WIDTH)}${overallDoc.text}`);
    lines.push("");
    let blocked = overallDoc.blocked;
    const phases = overallSlug === null ? [] : index.phaseSpecsOf(overallSlug);
    for (const [pos, phase] of phases.entries()) {
      // The phase's ONE plan value: `Cli#runBoard` builds the table in THIS row order
      // (spec §2.1), so the cell and the `CDD_WARN:` line can never describe two
      // different documents. A short table is a BROKEN caller contract — the board
      // never mints a second read to cover it (`PlanRead#document()` sets the same
      // posture), so the invariant answers by throwing.
      if (pos >= readTable.length)
        throw new Error("cdd: the board's per-phase plan table is shorter than its phase list");
      const read = readTable[pos];
      const phaseSlug = BoardView.#validSlug(phase);
      const phaseLedger =
        phaseSlug === null
          ? null
          : BoardView.#ledgerOf(plan, phaseSlug, repoRoot, projection.registry).ledger;
      const phaseProgress = phaseLedger?.readProgress() ?? null;
      const specLine = BoardView.#lineOf("spec", "phase-spec", phase, phaseProgress, phaseLedger);
      const planSlot = phaseSlug === null ? NO_DOC : BoardView.#docSlotOf(index, phaseSlug, "plan");
      const planEntry = BoardView.#slotEntry(planSlot);
      const planLine = BoardView.#lineOf("plan", "plan", planEntry, phaseProgress, phaseLedger);
      const branchLine = BoardView.#roundsLine("branch", "branch", phaseProgress, phaseLedger);
      const mark =
        BoardView.#entryMark(index, phase, "identity") ??
        (BoardView.#programMissing(index, phase) ? MARK_PROGRAM_MISSING : null);
      const planMark = BoardView.#slotMark(index, planSlot, "plan");
      blocked ||= mark !== null || planMark !== null;
      const status = mark ?? phase.status ?? "Pending";
      // The phase's wave summary token (spec §5.3): the wave segment's first wave
      // number + an ellipsis (`wave W1…`) — the phase's wave progress at a glance,
      // derived from the SAME wave segment the phase board renders (no second read).
      // The READ owns the degradation literal (spec §2.4): `cell(words)` answers
      // `""` only for a true undeclared phase, and null hands the healthy cell back
      // to today's derivation.
      const waveCell = read.cell(words) ?? BoardView.#waveCellOf(read, phaseProgress, phaseLedger);
      // The plan cell of a phase whose slug names TWO plans: the marker plus both
      // paths, never the first plan's summary (spec §2.3 — a set is answered by a set).
      const planCell =
        planSlot.kind === "many"
          ? [MARK_SLUG_DUPLICATED, planSlot.found.map((doc) => doc.rel).join(" · ")].join("   ")
          : BoardView.summaryCell(planLine.rounds, planLine.carriers, display);
      const parts: string[] = [];
      const cells: Array<[string, string]> = [
        ["spec", BoardView.summaryCell(specLine.rounds, specLine.carriers, display)],
        ["plan", planCell],
        ["wave", waveCell],
        ["branch", BoardView.summaryCell(branchLine.rounds, branchLine.carriers, display)],
      ];
      for (const [key, cell] of cells) if (cell !== "") parts.push(`${key} ${cell}`);
      const tail = parts.join(" · ");
      const note = BoardView.#titleNote(phase.title);
      lines.push(
        `  phase ${phase.slug ?? "(none)"}  ${status}${tail === "" ? "" : `   ${tail}`}${note === "" ? "" : `   title: ${note}`}`,
      );
    }
    // The `art:` fact block, after the phase rows and before the rows that stay last
    // (spec §2.6). One scope: the overall line, bound to the program seat — a phase's
    // rounds belong to the phase's own board, exactly as a node board reads the
    // program line through the program seat alone.
    const artifactRows = BoardView.#artifactRows(
      seat === null ? [] : [{ lines: [overallLine], seat }],
      projection,
    );
    if (artifactRows.length > 0) {
      lines.push("");
      lines.push(...artifactRows);
    }
    lines.push("");
    lines.push("  next:    done");
    return blocked ? 2 : 0;
  }

  /** The plan row's cell content when the READ owns the row — the STATUS-FIRST
   *  ladder of spec §2.1 · §2.7 (identity → read value → index):
   *
   *   ① `mark !== null` (`slug: invalid` / `duplicated` / `missing`) → null: the
   *      row goes back to `#docCell`, which renders the marker and keeps exit 2.
   *      Identity breakage outranks the read value, so no accessor is asked.
   *   ② a non-ready read, or the `spec-absent` orphan → `planLine(words)` — the repo
   *      relative path plus the mark, never `#docCell`. Reason: a plan whose BODY
   *      breaks the grammar is still an indexed document (the index reads front
   *      matter only), so an index-first ladder would render `name version · status`
   *      and drop the `! unparseable` mark this phase's AC pins. The `slug-absent`
   *      read lands here too and its accessor answers null — the row then falls back
   *      to `#docCell`'s `MARK_SLUG_MISSING`, exit 2 untouched.
   *   ③ a healthy `ready` whose path IS this node's indexed plan entry → null: the
   *      row is today's `#docCell` bytes. A healthy `ready` the index does not name
   *      as this node's plan renders the bare path instead of `(none)` or another
   *      document's header — the registered `slug`-is-identity consequence.
   *
   *  Null therefore means "`#docCell` owns this row", never "nothing to show". */
  static #planCellOf(
    read: PlanRead,
    planEntry: DocEntry | null,
    mark: string | null,
    words: Words,
  ): string | null {
    if (mark !== null) return null;
    const unread = read.kind !== "ready" || read.orphan()?.cause === "spec-absent";
    if (unread) return read.planLine(words);
    const docPath = read.path();
    // `DocEntry.path` is the absolute syscall form and the read's path is repo
    // relative — `rel` is the ONE comparable identity (`entryAt`'s own key).
    const indexed = planEntry !== null && planEntry.rel === docPath;
    return indexed ? null : read.planLine(words);
  }

  /** The healthy program-face wave cell — the wave segment's first wave number plus
   *  an ellipsis (`W1…`, spec §5.3), derived from the SAME wave segment the phase
   *  board renders. Only a `cell(words) === null` (healthy) value reaches here. */
  static #waveCellOf(read: PlanRead, progress: ProgressData | null, ledger: Ledger | null): string {
    const first = BoardView.#waveLines(read, progress, ledger)[0];
    return first === undefined ? "" : `${first.label.split(" ")[0]}…`;
  }

  /** The phase-spec's `program:` gate (spec §2.2): a phase-spec naming no overall
   *  (or carrying no `program:` at all) is a hard cancellation of the node. */
  static #programMissing(index: SlugIndex, entry: DocEntry): boolean {
    if (entry.docType !== "phase-spec") return false;
    return entry.program === null || index.overallOf(entry.program) === null;
  }

  /** The phase row's `title:` annotation — trimmed and truncated to
   *  `PHASE_TITLE_MAX` characters (an ellipsis marks the cut). An absent/blank
   *  title notes nothing. */
  static #titleNote(title: string | null): string {
    if (title === null) return "";
    const trimmed = title.trim();
    if (trimmed === "") return "";
    return trimmed.length <= PHASE_TITLE_MAX
      ? trimmed
      : `${trimmed.slice(0, PHASE_TITLE_MAX - 1)}…`;
  }

  /** One doc line's cell text — the doc NAME (directory omitted, spec §5.3), the
   *  header facts and the line's aggregated rounds (`spec  prog-p1-design.md   v0.14 ·
   *  Draft   review 2 ✓`). The name is padded to the block's name column so the
   *  version column aligns; a violated line renders its `(BLOCKED)` marker in place
   *  of the rounds (blocked = true). An absent doc renders `(none)` (degradation,
   *  never a throw). */
  static #docCell(
    entry: DocEntry | null,
    line: BoardLine,
    nameWidth: number,
    mark: string | null,
    display: BoardDisplay,
  ): { text: string; blocked: boolean } {
    if (entry === null) return { text: "(none)", blocked: false };
    const name = path.basename(entry.path).padEnd(nameWidth);
    const meta = [line.version, line.status].filter((part) => part !== null).join(" · ");
    if (mark !== null) {
      const head = meta === "" ? "" : `${meta}  `;
      return { text: `${name}   ${head}${mark}`, blocked: true };
    }
    const cells: string[] = [name];
    if (meta !== "") cells.push(meta);
    const rounds = BoardView.summaryCell(line.rounds, line.carriers, display);
    if (rounds !== "") cells.push(rounds);
    return { text: cells.join("   "), blocked: false };
  }

  // -------------------------------------------------------------------------
  // the artifact projection (spec §2.6) — the matrix's judgment as an `art:` fact row
  // -------------------------------------------------------------------------

  /** The `art:` projection's scopes — the node's own lines bound to the node seat and
   *  the program's overall line bound to the program seat. The board OBSERVES names;
   *  it never mints one: every observed round's carrier path comes from the ledger's
   *  ONE accessor and every judgment from `ArtifactReads`. One record in, one scope set
   *  out (the two seats are told apart by name, never by argument position). */
  static #artifactScopes(input: {
    readonly docLines: readonly BoardLine[];
    readonly waves: readonly BoardLine[];
    readonly branchLine: BoardLine;
    readonly nodeSeat: LedgerSeat | null;
    readonly overallSeat: LedgerSeat | null;
  }): readonly ArtifactScope[] {
    const scopes: ArtifactScope[] = [];
    const overall = input.docLines[0];
    if (input.overallSeat !== null && overall !== undefined) {
      scopes.push({ lines: [overall], seat: input.overallSeat });
    }
    if (input.nodeSeat !== null) {
      scopes.push({
        lines: [...input.docLines.slice(1), ...input.waves, input.branchLine],
        seat: input.nodeSeat,
      });
    }
    return scopes;
  }

  /** The `art:` fact rows — one observed REVIEW round per record of each scope's lines,
   *  in `(cycle, attempt)` order. The observed set is the record sequence, never the
   *  workspace's name list: a `*.rulings.json` no record claims stays an `orphan:`
   *  observation and never enters this block (one name, one face). The judgment is the
   *  dispatch gate's own kind — `rulings` — read through the frame-free seam, so the
   *  board composes nothing a gate would compose differently.
   *
   *  Default (no `--artifacts`): only the anomalous rounds render, so a healthy tree
   *  adds zero bytes. `--artifacts` opens the whole inventory: one row per observed
   *  round, one column per kind. */
  static #artifactRows(
    scopes: readonly ArtifactScope[],
    projection: ArtifactProjection,
  ): readonly string[] {
    const artifacts = projection.registry;
    if (artifacts === null) return [];
    const reads = (seat: LedgerSeat): ArtifactReads => new ArtifactReads(artifacts, seat.workspace);
    const observed = scopes.flatMap((scope) =>
      BoardView.#observedOf(scope, artifacts, reads(scope.seat)),
    );
    observed.sort((left, right) => left.cycle - right.cycle || left.attempt - right.attempt);
    return observed.flatMap((entry) => BoardView.#artifactBlockOf(entry, projection.showAll));
  }

  /** One scope's observed review rounds — the round records carrying a resolvable
   *  carrier, each read through the seam. A tampered carrier (a digest mismatch) is the
   *  `invalid` arm carrying the integrity message, never a thrown board. */
  static #observedOf(
    scope: ArtifactScope,
    artifacts: ArtifactRegistry,
    reads: ArtifactReads,
  ): readonly ObservedArtifact[] {
    const basis = scope.seat.workspace.root.basis;
    const observed: ObservedArtifact[] = [];
    for (const line of scope.lines) {
      for (const record of line.rounds) {
        if (record.op !== "review") continue;
        const carrier = scope.seat.ledger.carrierPathOf(line.type, line.key, record);
        if (carrier === "") continue;
        observed.push({
          line: BoardView.#artifactLineOf(artifacts, carrier, line.type),
          kind: "rulings",
          cycle: record.cycle,
          attempt: record.attempt,
          read: BoardView.#artifactReadOf(reads, carrier, record.carrierDigest ?? null),
          relName: (name) => basis.relativize(scope.seat.workspace.resolve(name)),
          relPath: (value) => basis.relativize(value),
        });
      }
    }
    return observed;
  }

  /** The observed round's line word — the carrier's OWN attributed identity (the
   *  reviewed round), falling back to the rendering line's word for a name the matrix
   *  cannot place. */
  static #artifactLineOf(artifacts: ArtifactRegistry, carrier: string, fallback: string): string {
    const attributed = artifacts.attribute(path.basename(carrier));
    return attributed !== null && attributed.identity.domain === "round"
      ? attributed.identity.line
      : fallback;
  }

  /** One composed read, with the integrity refusal folded into the `invalid` arm: a
   *  tampered carrier is a fact the board reports, never a crash of the read face. */
  static #artifactReadOf(
    reads: ArtifactReads,
    carrier: string,
    digest: string | null,
  ): ArtifactReadOf {
    try {
      return reads.read("rulings", carrier, digest);
    } catch (raw) {
      if (!(raw instanceof CarrierMismatchError)) throw raw;
      return { read: { kind: "invalid", path: "", reason: raw.message }, rulings: [] };
    }
  }

  /** One observed round's `art:` block — the fact row plus its continuation lines. The
   *  default face prints anomalies alone; `--artifacts` prints every observed round and
   *  names its coordinate, so a troubleshooting view is one row per round while the
   *  daily view keeps its bytes. */
  static #artifactBlockOf(entry: ObservedArtifact, showAll: boolean): readonly string[] {
    const read = entry.read.read;
    const anomalous = read.kind === "misplaced" || read.kind === "invalid";
    if (!showAll && !anomalous) return [];
    const coordinate = showAll ? ` · c${entry.cycle}·a${entry.attempt}` : "";
    const arm = anomalous ? `! ${read.kind}` : read.kind;
    const header = `  ${"art:".padEnd(LABEL_WIDTH)}${entry.line} · ${entry.kind}${coordinate}   ${arm}`;
    return [header, ...BoardView.#artifactFactsOf(entry, read)];
  }

  /** One `art:` block's continuation lines — the same facts the dispatch gate's
   *  `derived:` / `found:` report prints, on the board's own 9-column continuation
   *  shape. A healthy round carries none.
   *
   *  The labels come from `ARTIFACT_FACT_LABELS`, NOT from `Words#artifactIdentity`:
   *  the two faces are two pinned contracts with different bytes — §2.4 fixes the
   *  gate's rows as `  derived:  <value>` (colon, two-space column) while §2.6 fixes
   *  the board's as `           derived  <value>` (no colon, the board's own
   *  continuation column). Sharing a label source would force one contract's bytes
   *  into the other; the words are therefore deliberately re-declared here once and
   *  pinned by the board's byte assertions. */
  static #artifactFactsOf(
    entry: ObservedArtifact,
    read: ArtifactReadOf["read"],
  ): readonly string[] {
    const labels = ARTIFACT_FACT_LABELS;
    const value = (key: string, fact: string): string =>
      `           ${key.padEnd(LABEL_WIDTH)}${fact}`;
    if (read.kind === "misplaced") {
      const found = read.found.map((name) => entry.relName(name)).join(" · ");
      return [value(labels.derived, entry.relName(read.derived)), value(labels.found, found)];
    }
    if (read.kind === "invalid") {
      const derived = read.path === "" ? [] : [value(labels.derived, entry.relPath(read.path))];
      return [...derived, value(labels.reason, read.reason)];
    }
    return [];
  }

  /** The node's ledger — the progress.json read face the render's closure/next
   *  derivation consumes (each node reads its OWN workspace). The plan read seam is
   *  the caller's per-command instance, threaded down unchanged: the board never
   *  mints a second `PlanSource`. */
  static #ledgerOf(
    plan: PlanSource,
    nodeSlug: string,
    repoRoot: string,
    artifacts: ArtifactRegistry | null = null,
  ): LedgerSeat {
    const root = new WorkspaceRoot(repoRoot, ENGINE_RUNTIME.handoffNamespace.workspaceRoot);
    // ONE workspace instance per node: the ledger resolves names inside it and the
    // `art:` projection's read seam takes the SAME instance (`ArtifactReads` binds its
    // base at construction), so a board never observes two spellings of one directory.
    const workspace = new Workspace(root, nodeSlug);
    return { ledger: new Ledger(workspace, new ConfigLoader(), plan, artifacts), workspace };
  }

  /** pipelineFacts(read, plan, index, entry, root, projection) — the board's FACTS
   *  about the pipeline (spec §5.2): the node's ledger and the pipeline frontier's declared
   *  input (the spec word and path, the plan path, the plan read). The board reports
   *  facts only — the per-face observations and the four face-order rules live in the
   *  session plane's `PipelineFrontier`. Null when the node holds no legal slug (no
   *  workspace to observe).
   *
   *  `read` is the caller's ONE plan read (the same `PlanSource` instance): the
   *  frontier's graph input is the value's own `graph()`, and the declared `planPath`
   *  is that same value's `stationPath()` — the document the board read and the path
   *  the frontier receives are ONE fact, with no fallback to a second plan lookup.
   *  The wave segment reads the same value through `#waveLines`; the board has no
   *  second plan read point. */
  static pipelineFacts(
    read: PlanRead,
    plan: PlanSource,
    index: SlugIndex,
    entry: DocEntry,
    root: RepoRoot,
    projection: ArtifactProjection = NO_ARTIFACTS,
  ): BoardPipelineFacts | null {
    const nodeSlug = BoardView.#validSlug(entry);
    if (nodeSlug === null) return null;
    const ledger = BoardView.#ledgerOf(plan, nodeSlug, root.absolute, projection.registry).ledger;
    const sources = BoardView.#nodeSources(index, entry);
    const specPath = BoardView.#slotEntry(sources.spec)?.path ?? null;
    // The path the frontier receives IS the path of the document this read opened —
    // never a second index-derived candidate that could name another file.
    const planPath = read.stationPath();
    // The identity line's OWN word — the document's DECLARED `doc-type:` — keys the
    // line and names the pipeline station (`single-spec` closes onto its `done` row).
    const specType = BoardView.#lineWordOf(BoardView.#slotEntry(sources.spec));
    return {
      ledger,
      input: { specType, specPath, planPath, plan: read },
    };
  }

  /** The branch line — a docless line whose rounds ride the `branch` row. */
  static #roundsLine(
    label: string,
    key: string,
    progress: ProgressData | null,
    ledger: Ledger | null,
  ): BoardLine {
    const rounds = BoardView.#rowRounds(progress, key);
    return {
      label,
      version: null,
      status: null,
      docType: null,
      rounds,
      carriers: LineCarriers.ofLedger(ledger, key, key, rounds),
      marker: null,
      type: key,
      key,
    };
  }

  /** The node's round RECORDS for one key — read through the ledger's ONE row lookup
   *  (`Ledger.rowFor`, literal: a retired `spec` row answers no document word) and the
   *  ONE record normalizer (`RoundRecords.of`, legacy COUNT forms folded); the
   *  aggregation and the judgement glyphs read these records, never a pre-grouped cycle
   *  map. Failed rounds stay on the board (they consumed an identity slot); an absent row
   *  yields an empty list. */
  static #rowRounds(progress: ProgressData | null, key: string): readonly RoundRecord[] {
    const row = progress === null ? undefined : Ledger.rowFor(progress, key);
    return RoundRecords.of(row);
  }

  /** The node's wave segment — one line per derived wave (its ✔/▶/○ marker rides the
   *  SAME `TaskGraph.report(closedWaves())` read the board and the pre-flight gate
   *  share — the same source GraphView renders from), the wave's own `progress.json`
   *  row spread alongside. The batch list is the READ's own `waves()` (spec §2.4) and
   *  the graph is only the `report(...)` input; both are the read's eager derivation
   *  (spec §2.1), never a second file read. A non-ready read has no graph and the
   *  segment is empty. */
  static #waveLines(
    read: PlanRead,
    progress: ProgressData | null,
    ledger: Ledger | null,
  ): BoardLine[] {
    const graph = read.graph();
    if (graph === null) return [];
    const waves = read.waves();
    const report = graph.report(ledger === null ? new Set<number>() : ledger.closedWaves());
    const done = new Set(report.done);
    const currentIndex = waves.findIndex((wave) => wave.some((id) => !done.has(id)));
    return waves.map((wave, index) => {
      const closed = wave.every((id) => done.has(id));
      const marker = closed
        ? PROGRESS_MARKERS.done
        : index === currentIndex
          ? PROGRESS_MARKERS.current
          : PROGRESS_MARKERS.pending;
      const key = wave.join(",");
      const rounds = BoardView.#rowRounds(progress, key);
      return {
        label: `W${index + 1} {${key}}`,
        version: null,
        status: null,
        docType: null,
        rounds,
        carriers: LineCarriers.ofLedger(ledger, "wave", key, rounds),
        marker,
        type: "wave",
        key,
      };
    });
  }
}

/**
 * BoardNext — the board's hop entry point (P22 §5.2 · P24 §11): the board (`BoardView`)
 *  REPORTS the pipeline facts, and the session plane's `PipelineFrontier` both decides
 *  the next pipeline step and ASSEMBLES the hop (`PipelineFrontier#hopOf`, the ONE
 *  assembly the capsule renders too), so the board's `next:` and the capsule's `next:`
 *  render one object by construction. This class fills no cell and makes no judgment:
 *  it hands the facts over and returns what the assembly answered. The composition
 *  root's board assembly point (`face/cli.ts` `#runBoard`) constructs it.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the board's assembly fact surface — the zero-bare-function discipline admits no standalone functions here.
export class BoardNext {
  /** The board's ONE `NextHop` — null when the entry holds no legal slug (no
   *  workspace to observe), when the board is the program board (cross-phase never
   *  participates in next, spec §6.5), or when the plan read carries no evidence to
   *  route on (spec §2.3): an `unreadable` plan, a `spec-absent` orphan and the
   *  `duplicated` set short-circuit to the existing hop-less shape (`  next:
   *  (none)`, no `reason:` row). The predicate is the SAME pair §2.3 uses, never a
   *  third condition; `undeclared` is NOT in it ("spec written, no plan yet" is the
   *  standing `kairos:cdd-plan` route — and so is the undecided read, whose board
   *  bytes are today's) and `slug-absent` is not either (the identity channel owns
   *  its exit code). The duplicated set is not: two plans answer no single
   *  document, so the plan route may not be printed (§2.7 (d)). */
  static of(
    read: PlanRead,
    plan: PlanSource,
    index: SlugIndex,
    entry: DocEntry,
    root: RepoRoot,
    projection: ArtifactProjection = NO_ARTIFACTS,
  ): NextHop | null {
    if (read.kind === "duplicated") return null;
    if (read.kind === "unreadable" || read.orphan()?.cause === "spec-absent") return null;
    const facts =
      entry.docType === "overall"
        ? null
        : BoardView.pipelineFacts(read, plan, index, entry, root, projection);
    return facts === null ? null : BoardNext.#hopOf(facts, root);
  }

  /** The session plane's ONE assembly, called with the board's facts and the face
   *  plane's declaration-reading station port. The board contributes no cell of its
   *  own — the hop is whatever the assembly answers. */
  static #hopOf(facts: BoardPipelineFacts, root: RepoRoot): NextHop {
    return new PipelineFrontier(facts.ledger).hopOf(facts.input, {
      docClassOf: (candidate) => BoardView.docClassOf(root, candidate),
    });
  }
}
