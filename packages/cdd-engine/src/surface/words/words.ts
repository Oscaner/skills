// packages/cdd-engine/src/surface/words/words.ts
// The ONE word table of the consumer surface.
//
// INVARIANT — one fact, one home, one rendering: every byte a consumer reads of a fact this
// engine states is declared here ONCE, and a renderer only CONNECTS the table. A second
// spelling anywhere else is a defect with no visible symptom — both copies look right alone
// and drift apart silently — so the segment's guard scans for exactly that.
//
// The families, one per face:
//   · `capsule`  — the capsule's stations, slots and status vocabulary;
//   · `refusal`  — the `CDD_BLOCKED:` face: the anchor, the four refusal stations (the
//                  gate's own `RowStation` SET, keyed by that type so a station the gate
//                  adopts cannot be missing here), the five refusal reasons (two of them
//                  references into the in-flight family — the held report and the
//                  corrupt-lock sentence), and the `refused:` row the board and the
//                  preview share;
//   · `checked`  — the `checked:` face's heading, the per-rule result words and one skip row
//                  per declared yield reason;
//   · `inFlight` — the held report, the takeover hints, the fourth state's clause cells, the
//                  two corrupt shapes, the lock rows and the three recovery sentences;
//   · `summary`  — the capsule's summary cell: the fix round's disposition counts;
//   · `board`    — the progress markers and the two legend tails (one template, two scopes),
//                  the three section titles, the tree fact block and the preview's `reads:`
//                  row;
//   · `artifacts`— the `art:` row: its label, its joins, the coordinate form, the four state
//                  words (`ok` · `absent` · `misplaced` · `invalid`, one per artifact read
//                  state) and the continuation labels the BOARD prints;
//   · `refusal.artifact` — the gate's own continuation rows. Deliberately a SECOND group:
//                  the gate's rows are `  derived:  <value>` and the board's are
//                  `           derived  <value>` — two byte contracts, so the two label sets
//                  are declared apart rather than one standing in for the other;
//   · `route`    — the `next:` classifier's words and the skill-ref instruction template.
//
// NOT here, by the same rule: the re-grade note's mark, separator, reason fold and synthesis
// live with the criteria that judge it (`docs/judging/criteria.ts`), and the board connects
// that composition into its token tail. A note row here would be a second copy of one
// judgment.
//
// The re-grade note is the only entry in this header about a rule that is NOT the table's:
// it is named so the next reader does not add it.
//
// The clock is injected: the in-flight report's `{startedAt}` and `{uptime}` are computed
// through it, so this file reads no wall clock of its own and a pinned clock pins the row.
//
// Module-level exports are types, the declared data and the class — zero
// behaviour-carrying bare functions.

import type { Clock } from "../../env/process/clock.ts";
import type { TargetFact } from "../../run/dispatch/inflight.ts";
import type {
  PreFlightGateName,
  PreFlightReason,
  RowStation,
  SkipReason,
} from "../../run/gate/preflight.ts";

// ---------------------------------------------------------------------------
// capsule
// ---------------------------------------------------------------------------

/** The capsule emit keys — the pinned `status · handoff` order. */
export type CapsuleKey = "status" | "handoff";

/** One capsule slot, in the order the capsule prints them. */
export type CapsuleSlot = "status" | "summary" | "next" | "reason";

/** One route station kind — the addressed channels of the command surface. */
export type StationKind = "next" | "reason" | "blocked" | "warn" | "cliMissing";

/** The `next:` classifier's words. `handoffRef` is an INSTRUCTION phrase (route to a
 *  skill), never a pseudo-command; `{ref}` carries the per-host reference form. */
export type RouteWordKind =
  | "done"
  | "review"
  | "fix"
  | "implement"
  | "handoffRef"
  | "docType"
  | "docTypeValue"
  | "slugMissing"
  | "slugInvalid"
  | "slugDuplicated"
  | "slugUnreadable"
  | "frontmatterParse";

/** One workspace-key refusal — the closed set the pre-command identity gate answers: no
 *  declared slug, a value outside the grammar, a slug two documents declare, or a target
 *  whose bytes never read. */
export type SlugRefusal =
  | { readonly kind: "missing" }
  | { readonly kind: "illegal"; readonly slug: string }
  | { readonly kind: "duplicated"; readonly slug: string }
  | { readonly kind: "unreadable"; readonly target: string };

/** The capsule family. */
export interface CapsuleWords {
  readonly keys: {
    readonly success: readonly CapsuleKey[];
    readonly failure: readonly CapsuleKey[];
    readonly handoff: CapsuleKey;
  };
  /** The failure statuses — a failure capsule prints `status` alone. */
  readonly failureStatuses: readonly string[];
  /** The five-value status vocabulary — the conclusion a round can print. */
  readonly statuses: readonly string[];
  /** The `·` separator of the capsule line. */
  readonly separator: string;
  /** The three slots' own words. `summary` is the capsule's content cell (no `:`). */
  readonly slots: Readonly<Record<"status" | "handoff" | "summary", string>>;
  /** The two route stations' labels — the `: `-suffixed anchors. */
  readonly lines: Readonly<Record<"next" | "reason", string>>;
  /** The printed slot order — the capsule contract's sequence. */
  readonly order: readonly CapsuleSlot[];
  /** The stderr anchors of the diagnostics channels. */
  readonly stations: Readonly<Record<StationKind, string>>;
}

// ---------------------------------------------------------------------------
// refusal
// ---------------------------------------------------------------------------

/** The gate's artifact report rows — the `derived:` / `found:` / `identity:` / `reason:`
 *  continuation contract. Two-space column, colon inside it: the §2.4 bytes, distinct from
 *  the board's own continuation labels below. */
export interface ArtifactReportWords {
  /** A present-but-unreadable sidecar — the reason word over the row. */
  readonly invalid: string;
  /** The misplaced sidecar's conclusion line. */
  readonly reason: string;
  readonly derived: string;
  readonly found: string;
  readonly identity: string;
  /** The join between several found names. */
  readonly foundJoin: string;
  /** The empty found set. */
  readonly emptyFound: string;
  /** The repair instruction — fixed text: the engine only refuses. */
  readonly repair: readonly string[];
}

/** The `dispatch-input` station's one line — `{row} · {token} · {reason}` per failing cell,
 *  so a refused dispatch is repaired in one pass. */
export interface DispatchInputWords {
  readonly station: string;
  readonly segment: string;
  readonly separator: string;
}

/** The refusal family — the `CDD_BLOCKED:` face and the `refused:` row. */
export interface RefusalWords {
  /** The stderr anchor. */
  readonly prefix: string;
  /** The station → conclusion join. */
  readonly join: string;
  /** The four pre-dispatch stations' own words, keyed by the gate's set: a station the gate
   *  adopts must be named here or the table does not type-check. */
  readonly stations: Readonly<Record<RowStation, string>>;
  /** The five named reasons' words, keyed by the gate's own reason set. The `held` row is
   *  the in-flight report's TEMPLATE — a renderer fills it through `Words#inFlightHeld` and
   *  never prints it raw — and `corrupt-record` is the in-flight family's corrupt-lock
   *  sentence: one fact, one spelling, so both rows reference the family. */
  readonly reasons: Readonly<Record<PreFlightReason, string>>;
  /** The `refused:` row's token — the board and the preview share it. */
  readonly token: string;
  /** The two-space value gap the preview prints after the token. */
  readonly gap: string;
  /** A refusal record on disk that cannot be read — a fact, never "no refusal". */
  readonly corrupt: string;
  readonly dispatchInput: DispatchInputWords;
  readonly artifact: ArtifactReportWords;
  /** The `no-host` station's sentence — the one pre-dispatch row whose conclusion is a
   *  whole sentence rather than a fill of the round's own facts. */
  readonly noHost: string;
  /** The carrier-mismatch station's token (the sentence itself is the carrier line's). */
  readonly carrier: string;
}

// ---------------------------------------------------------------------------
// checked
// ---------------------------------------------------------------------------

/** The checked family — the `checked:` face. */
export interface CheckedWords {
  /** The block's heading row. */
  readonly heading: string;
  /** The rule ran and found nothing. */
  readonly passed: string;
  /** The rule ran and found a blocking finding. */
  readonly failed: string;
  /** The rule ran and reported warnings only (`{count}` fill slot). */
  readonly warned: string;
  /** One row per declared yield reason — keyed by the gate's own set, so a new yield cannot
   *  render as a blank row. */
  readonly skipped: Readonly<Record<SkipReason, string>>;
  /** The `plan-ledger` gate row's plan-ahead info (`{count}` fill slot). */
  readonly planAhead: string;
  /** The in-flight gate row's five state words. The fourth state (a stale holder whose
   *  target is gone) does NOT ride a row of its own: it renders through
   *  `inFlight.targetGone`, and a sixth row here would be a second spelling of it. */
  readonly inFlight: Readonly<
    Record<"free" | "held" | "stale" | "corruptLocked" | "corruptUnlocked", string>
  >;
}

// ---------------------------------------------------------------------------
// in-flight
// ---------------------------------------------------------------------------

/** The fourth state's clause cells — one per target fact, the separator, the lead and the
 *  takeover sentence the row ends with. A cell renders only where its fact read out
 *  missing. */
export interface TargetGoneWords {
  readonly lead: string;
  readonly cells: Readonly<Record<TargetFact, string>>;
  readonly separator: string;
  readonly takeover: string;
}

/** The in-flight family — the held report and everything a reader says about it. */
export interface InFlightWords {
  /** The held report (`{pid}` · `{command}` · `{startedAt}` · `{uptime}` · `{wave}` ·
   *  `{slug}` fill slots). */
  readonly held: string;
  /** The takeover hint — the holder is gone and the target still stands. */
  readonly stealable: string;
  readonly targetGone: TargetGoneWords;
  readonly corruptLocked: string;
  readonly corruptUnlocked: string;
  /** The `lock:` row of one holder record. */
  readonly lockHeld: string;
  /** A lock with no readable record behind it. */
  readonly lockOnly: string;
  readonly free: string;
  /** The three canonical recovery sentences (byte-stable: the shipped skills quote them). */
  readonly recovery: readonly [string, string, string];
}

// ---------------------------------------------------------------------------
// board
// ---------------------------------------------------------------------------

/** One tree-fact row of the board — its label and the join between its own cells. */
export interface BoardFactRowWords {
  /** The row's label, colon included (`orphan:`). */
  readonly label: string;
  /** The join between THIS row's cells. */
  readonly join: string;
}

/** The tree fact block. The two rows do NOT share a join — the orphan row separates its
 *  name from the sentence with an em dash and the crashed row joins its tokens with a
 *  middle dot — so each row declares its own byte. One join for both would change one of
 *  the two shipped board lines. */
export interface BoardFactWords {
  /** `orphan: {name} — no recorded round owns it`. */
  readonly orphan: BoardFactRowWords & {
    /** The sentence an orphan draft's row ends with. */
    readonly unowned: string;
  };
  /** `crashed: {token} · {token}`. */
  readonly crashed: BoardFactRowWords;
}

/** The board's progress vocabulary — the glyphs, the two scopes, the row annotation and the
 *  ONE legend template the two boards fill. */
export interface ProgressWords {
  readonly markers: Readonly<Record<"done" | "current" | "pending", string>>;
  /** The one word the two boards differ by — the LEGEND's scope word, and nothing else. */
  readonly scopes: Readonly<Record<"board" | "graph", string>>;
  /** The current wave's ROW annotation (`← <annotation>`) — a different word from the
   *  legend's scope, so the two cells can never be read as one. */
  readonly annotation: string;
  /** The legend tail's ONE template — the three markers and the scope word filled in. */
  readonly legend: string;
}

/** One round token's vocabulary — the judgement glyph column and its three appends. */
export interface BoardTokenWords {
  /** The three judgement glyphs: a completed round, a failed attempt, a recovered one. */
  readonly judgement: Readonly<Record<"passed" | "failed" | "recovered", string>>;
  /** The re-dispatch superscript (`a{attempt}`) — `attempt === 1` prints none of it. */
  readonly attempts: string;
  /** A count cell (`+{count}`) — the graded findings and the note rows share the template. */
  readonly count: string;
  /** The folded note segment's word (`notes +M`). */
  readonly notes: string;
}

/** One cell key a phase row can print — the line it summarises. */
export type PhaseCellKey = "spec" | "plan" | "wave" | "branch";

/** The program board's row cells — the phase label, its status fallback, the wave cell, the
 *  title annotation, and the cell order with its ONE join. */
export interface BoardProgramWords {
  readonly phase: string;
  readonly title: string;
  /** The phase's wave cell — the derived wave label plus the ellipsis that stands for the
   *  phase's further waves (`W1…`). */
  readonly wave: string;
  /** The status a phase row prints when its document declares none. */
  readonly pending: string;
  /** The phase row's cell ORDER — the frozen face prints the wave cell between `plan` and
   *  `branch`, never last. */
  readonly cells: readonly PhaseCellKey[];
  /** The join between two of those cells — the row's own separator, never a note
   *  composer's. */
  readonly join: string;
}

/** The board family. */
export interface BoardWords {
  /** The three section titles. */
  readonly titles: Readonly<Record<"graph" | "waveBoard" | "progress", string>>;
  readonly progress: ProgressWords;
  readonly facts: BoardFactWords;
  /** The document lines' label words — a phase specification and a single specification are
   *  both the `spec` line. */
  readonly lines: Readonly<Record<"overall" | "spec" | "plan", string>>;
  /** The board's ONE absence word — a document row whose document does not read and a wave
   *  segment with no wave row both print it. */
  readonly absent: string;
  /** The two line-state words the branch row prints. */
  readonly states: Readonly<Record<"closed" | "open", string>>;
  readonly tokens: BoardTokenWords;
  readonly program: BoardProgramWords;
  /** The preview's `reads:` row and its orphan-draft suffix. */
  readonly reads: {
    readonly label: string;
    readonly orphanDrafts: string;
    readonly join: string;
  };
}

// ---------------------------------------------------------------------------
// artifacts
// ---------------------------------------------------------------------------

/** The `art:` row's family — the BOARD's continuation contract, deliberately distinct from
 *  `refusal.artifact`'s colon row. */
export interface ArtifactWords {
  readonly label: string;
  /** The row's own cells' join (`<line> · <kind>`). */
  readonly join: string;
  /** The coordinate a `--artifacts` row ends its head with. */
  readonly coordinate: string;
  /** The gap between the head and the state word. */
  readonly gap: string;
  /** The four state words — one per artifact read state. */
  readonly states: Readonly<Record<"ok" | "absent" | "misplaced" | "invalid", string>>;
  /** The prefix the two ANOMALOUS states carry (health and absence carry none). */
  readonly anomalyPrefix: string;
  /** The continuation rows' labels (no colon, the board's own column). */
  readonly continuation: Readonly<Record<"derived" | "found" | "reason", string>>;
}

// ---------------------------------------------------------------------------
// the table
// ---------------------------------------------------------------------------

/** The fix round's disposition summary — ONE template. The two counts and their filling are
 *  the criteria's; only the word face lives here. It shares the capsule's summary cell with
 *  the re-grade note. */
export const FIX_DISPOSITIONS_SUMMARY = "fixed {fixed} · rejected {rejected}";

// ---------------------------------------------------------------------------
// the in-flight family
// ---------------------------------------------------------------------------

/** The in-flight family — declared ahead of the table because two of its rows ARE other
 *  facts' words: the gate's `held` refusal carries the held report (filled from the
 *  record's own cells), and its `corrupt-record` refusal carries the corrupt-lock
 *  sentence. Referencing them keeps one spelling per fact; a row repeated here would be a
 *  second sentence no face could print. */
const IN_FLIGHT = {
  held: "a dispatch is already in flight — pid {pid} · command: {command} · started: {startedAt} · running for {uptime} · wave: {wave} · slug: {slug}",
  stealable:
    "the holding process is gone — re-run the same command with --recover to take the in-flight record over",
  targetGone: {
    lead: "the dispatch's target is gone —",
    cells: {
      plan: "the plan the record names is not on this tree",
      workspace: "the record's workspace directory is not on this tree",
    },
    separator: " · ",
    takeover: "re-run the same command with --recover to take the in-flight record over",
  },
  corruptLocked:
    "the in-flight record is unreadable and its lock is still on disk — re-run with --recover to take it over",
  corruptUnlocked:
    "the in-flight record is unreadable and no lock is left behind — re-run with --recover to take it over",
  lockHeld:
    "held by pid {pid} · command: {command} · started: {startedAt} · wave: {wave} · slug: {slug}",
  lockOnly: "held by an unreadable in-flight record — the lock is still on disk",
  free: "free — no dispatch holds this tree",
  recovery: [
    "look at the working tree first",
    "commit the changes that work",
    "discard the ones that are broken",
  ],
} as const;

/** The one word table. */
export const WORDS = {
  capsule: {
    /** The emit key rows — one declaration per status class. A success status renders
     *  `status · handoff`; a failure status renders `status` alone, plus `handoff` only when
     *  the round wrote a crash record. */
    keys: {
      success: ["status", "handoff"],
      failure: ["status"],
      handoff: "handoff",
    },
    failureStatuses: ["BLOCKED", "TIMEOUT"],
    /** The five handoff-conclusion values. */
    statuses: ["APPROVED", "BLOCKED", "CHANGES_REQUESTED", "REVIEW_FIX", "TIMEOUT"],
    separator: " · ",
    slots: { status: "status", handoff: "handoff", summary: "summary" },
    lines: { next: "next:", reason: "reason:" },
    /** The printed slot order — `status` → summary → `next:` → `reason:`. */
    order: ["status", "summary", "next", "reason"],
    stations: {
      next: "next:",
      reason: "reason:",
      blocked: "CDD_BLOCKED:",
      warn: "CDD_WARN:",
      cliMissing: "CDD_CLI_MISSING:",
    },
  },
  refusal: {
    prefix: "CDD_BLOCKED:",
    join: " · ",
    /** The four stations' words. The station word IS the row's own name, so the row set and
     *  the printed vocabulary cannot disagree. */
    stations: {
      "no-host": "no-host",
      carrier: "carrier",
      "dispatch-input": "dispatch-input",
      artifact: "artifact",
    },
    /** The five named reasons — each row is the sentence the reason stands for. Two rows are
     *  NOT a sentence but the in-flight family's own word: `held` is the held report's
     *  template (the gate's detail for that reason is the report filled from the record's
     *  cells, so a sentence here would print without the holder's pid, command and uptime)
     *  and `corrupt-record` is the corrupt-lock sentence verbatim. */
    reasons: {
      "dirty-tree":
        "the working tree is dirty — commit or discard your changes (recovery is the orchestrator's job; the engine only refuses — it never stashes, makes a temporary commit, or resumes a dirty tree), then re-run the same command",
      held: IN_FLIGHT.held,
      "corrupt-record": IN_FLIGHT.corruptLocked,
      graph: "the plan graph has {count} edge violation(s) — fix the **DependsOn** edges first",
      "doc-contract":
        "the target document fails the doc-contract — fix its structural findings first",
    },
    token: "refused:",
    gap: "  ",
    corrupt: "unreadable refusal record",
    dispatchInput: {
      station: "dispatch-input",
      segment: "{row} · {token} · {reason}",
      separator: "; ",
    },
    /** The gate's continuation rows — `  derived:  <value>` (the §2.4 contract). */
    artifact: {
      invalid: "rulings sidecar — {reason}",
      reason: "artifact-identity · the round's `{kind}` sidecar sits off its rendered name",
      derived: "  derived:  {derived}",
      found: "  found:    {found}",
      identity: "  identity: {identity}",
      foundJoin: " · ",
      emptyFound: "(none)",
      repair: [
        "  repair:   rename the found file to the derived name — the engine never moves,",
        "            rewrites or deletes an artifact; the workspace is yours",
      ],
    },
    carrier: "carrier-mismatch",
    noHost: "no host harness detected (run cdd from within a supported harness)",
  },
  checked: {
    heading: "checked:",
    passed: "passed",
    failed: "failed",
    warned: "warned — {count} warning(s)",
    skipped: {
      "no-doc-target": "skipped (no doc target)",
      "doc-not-judged": "skipped (not judged)",
      "unreadable-doc": "skipped (unreadable doc)",
      "closed-document": "skipped (closed document)",
      "no-plan-layers": "info (plan layers: unavailable)",
      "no-ledger-facts": "skipped (no ledger facts)",
      "no-input-face": "skipped (no input face)",
    },
    planAhead: "plan-ledger: info (plan leads ledger by {count} tasks)",
    inFlight: {
      free: "free — no dispatch holds this tree",
      held: "held — pid {pid}",
      stale: "stale holder — pid {pid} (re-run with --recover to take over)",
      corruptLocked: "unreadable record — lock on disk",
      corruptUnlocked: "unreadable record — no lock behind",
    },
  },
  inFlight: IN_FLIGHT,
  summary: {
    fixDispositions: FIX_DISPOSITIONS_SUMMARY,
  },
  board: {
    titles: { graph: "graph:", waveBoard: "wave board:", progress: "progress:" },
    progress: {
      markers: { done: "✔", current: "▶", pending: "○" },
      /** The one word the two boards' LEGENDS differ by. */
      scopes: { board: "current", graph: "current wave" },
      /** The current wave's row annotation — the graph view's own mark. It is NOT the
       *  legend's scope word: the two cells are different facts of the same board, so one
       *  word cannot serve both. */
      annotation: "in-flight",
      /** The legend tail's ONE template — `{done}` / `{current}` / `{pending}` are the
       *  declared markers and `{scope}` is the board's own scope word. */
      legend: "progress: {done} done · {current} {scope} · {pending} pending",
    },
    facts: {
      /** The orphan row's join is an em dash — the record has no round, so the name and the
       *  sentence are not two list cells. */
      orphan: { label: "orphan:", join: " — ", unowned: "no recorded round owns it" },
      /** The crashed row joins its round tokens with a middle dot (a cause stays
       *  space-separated inside a token, so the join never splits one). */
      crashed: { label: "crashed:", join: " · " },
    },
    reads: { label: "reads:", orphanDrafts: " · orphan drafts: ", join: " · " },
    /** The document lines' own words. */
    lines: { overall: "overall", spec: "spec", plan: "plan" },
    /** The absence a row prints rather than a cell it never had. */
    absent: "(none)",
    /** The branch row's two state words — the reopened state prints `open` because the line
     *  IS open again. */
    states: { closed: "closed", open: "open" },
    /** One round token's vocabulary. */
    tokens: {
      judgement: { passed: "✓", failed: "✗", recovered: "✗→✓" },
      attempts: "a{attempt}",
      count: "+{count}",
      notes: "notes",
    },
    /** The program board's row cells — the order and the join included, so a renderer
     *  fills a layout instead of choosing one. */
    program: {
      phase: "phase",
      title: "title:",
      wave: "{label}…",
      pending: "Pending",
      cells: ["spec", "plan", "wave", "branch"],
      join: " · ",
    },
  },
  artifacts: {
    label: "art:",
    join: " · ",
    coordinate: "c{cycle}·a{attempt}",
    gap: "   ",
    states: { ok: "ok", absent: "absent", misplaced: "misplaced", invalid: "invalid" },
    anomalyPrefix: "! ",
    /** The board's continuation labels — `derived  <value>`, no colon (a different byte
     *  contract from `refusal.artifact`'s rows). */
    continuation: { derived: "derived", found: "found", reason: "reason" },
  },
  route: {
    done: "done",
    review: "review",
    fix: "fix",
    implement: "implement",
    handoffRef: "route to {ref} skill",
    /** The fix hop's readback sentence — the finding-to-ruling instruction the fix round
     *  owes, with `{path}` the rulings sidecar the hop consumed. A RESULT sentence, never a
     *  naming rule: the path arrives as a value, so no reader derives one from it. */
    fixReadback: "(confirm the reviews handoff · if a finding needs a ruling, record it at {path})",
    docType:
      "the doc declares no `doc-type:` key — add `doc-type: <overall|phase-spec|single-spec|plan>` to the doc's front-matter (spec §12 · D34) and re-run",
    docTypeValue:
      "the doc declares `doc-type: {value}`, which is outside the declared domain — use one of {domain} and re-run",
    slugMissing:
      "the doc declares no `slug:` key — add `slug: <workspace-key>` to the doc's front-matter (the identity key the board and every work command share) and re-run",
    slugInvalid:
      'the doc\'s `slug:` value "{slug}" is illegal — use 1–128 characters, an alphanumeric first character, then alphanumerics, `.`, `_`, or `-` (the slug is the workspace directory name), then re-run',
    slugDuplicated:
      'the slug "{slug}" is declared by more than one document — keep exactly one identity document and at most one plan per slug, then re-run',
    slugUnreadable:
      "the target document {target} is unreadable — its declared `slug:` is the workspace key",
    frontmatterParse:
      "the doc's front-matter is not valid YAML: {reason} on line {line}, column {column} (`{source}`) — quote values that start with `[` or `{` (a YAML flow-sequence start) and re-run",
  },
} as const;

// ---------------------------------------------------------------------------
// guard
// ---------------------------------------------------------------------------

/** One guard-ban row — a retired token the live faces must not carry. */
export interface GuardBanWord {
  readonly token: string;
}

/** The retired-vocabulary ban rows, one family per retired mechanism. The shape family is
 *  the consumer-skill surface's concern and rides no engine scan; it is declared here so
 *  the ban vocabulary has ONE home for every consumer that needs it. */
export const GUARD_BAN_WORDS = {
  stale: [
    { token: "cursor-agent" },
    { token: "@ts-ignore" },
    { token: "@ts-expect-error" },
    { token: "build.config" },
    { token: "dev:stub" },
    { token: "@typescript/typescript6" },
    { token: "globalSetup" },
    { token: ".mjs" },
  ],
  gate: [{ token: "CDD_GATE" }, { token: "cdd-gate-core" }, { token: "gateDecide" }],
  shape: [
    { token: "3-line return block" },
    { token: "4th line counters" },
    { token: "return block" },
  ],
} as const satisfies Readonly<Record<string, readonly GuardBanWord[]>>;

/** One guard-ban family. */
export type GuardFamily = keyof typeof GUARD_BAN_WORDS;

// ---------------------------------------------------------------------------
// issue types
// ---------------------------------------------------------------------------

/** The issue type set — the ONE source an issue body's `types` derives from (a consumer's
 *  declared type domain reads this, never a second hand-written list). */
export const ISSUE_TYPES = ["bug", "enhancement", "chore"] as const;

/** One issue type. */
export type IssueType = (typeof ISSUE_TYPES)[number];

/**
 * Words — the word table's access face. Invariant: every accessor answers a row of `WORDS`
 * (or a row of it filled), so a caller never holds a second copy of a byte this table owns.
 */
export class Words {
  readonly #clock: Clock;

  constructor(opts: { readonly clock: Clock }) {
    this.#clock = opts.clock;
  }

  /** The capsule emit keys of one status class, in the pinned order. */
  capsuleKeys(status: string, withHandoff: boolean): readonly CapsuleKey[] {
    const rows = WORDS.capsule.keys;
    const failure = (WORDS.capsule.failureStatuses as readonly string[]).includes(status);
    if (!failure) return rows.success;
    return withHandoff ? [...rows.failure, rows.handoff] : rows.failure;
  }

  /** The capsule line's `·` separator. */
  capsuleSeparator(): string {
    return WORDS.capsule.separator;
  }

  /** The printed slot order — `status` → summary → `next:` → `reason:`. */
  capsuleOrder(): readonly CapsuleSlot[] {
    return WORDS.capsule.order;
  }

  /** One capsule slot's word (`status` · `handoff` · `summary`). */
  capsuleSlot(slot: "status" | "handoff" | "summary"): string {
    return WORDS.capsule.slots[slot];
  }

  /** One route line label (`next:` · `reason:`). */
  capsuleLine(line: "next" | "reason"): string {
    return WORDS.capsule.lines[line];
  }

  /** The status vocabulary — the five handoff-conclusion values. */
  statusVocab(): readonly string[] {
    return WORDS.capsule.statuses;
  }

  /** One stderr/route station by its semantic kind. */
  station(kind: StationKind): string {
    return WORDS.capsule.stations[kind];
  }

  /** The capsule's summary cell for a fix round — the one template, filled with the two
   *  counts the criteria supply. */
  dispositionsSummary(fixed: number, rejected: number): string {
    return WORDS.summary.fixDispositions
      .replace("{fixed}", String(fixed))
      .replace("{rejected}", String(rejected));
  }

  /** One identity refusal's sentence — the workspace key has no source, a value outside the
   *  declared slug grammar, a slug two documents declare, or a target the read could not
   *  reach. The four are the closed set the pre-command identity gate answers. */
  slugRefusal(verdict: SlugRefusal): string {
    switch (verdict.kind) {
      case "missing":
        return WORDS.route.slugMissing;
      case "illegal":
        return WORDS.route.slugInvalid.replace("{slug}", verdict.slug);
      case "duplicated":
        return WORDS.route.slugDuplicated.replace("{slug}", verdict.slug);
      case "unreadable":
        return WORDS.route.slugUnreadable.replace("{target}", verdict.target);
    }
  }

  /** One round coordinate in the words plane's own spelling — the `identity:` row the
   *  artifact report carries. The facts are the round's four cells, so the caller hands the
   *  identity over and this table owns the byte. */
  identityWords(facts: {
    readonly line: string;
    readonly op: string;
    readonly cycle: number;
    readonly attempt: number;
  }): string {
    return `line=${facts.line} · op=${facts.op} · cycle=${facts.cycle} · attempt=${facts.attempt}`;
  }

  /** The whole refusal family. */
  refusalWords(): RefusalWords {
    return WORDS.refusal;
  }

  /** One pre-dispatch station's word. */
  refusalStation(station: RowStation): string {
    return WORDS.refusal.stations[station];
  }

  /** One gate ROW's word — the four stations have rows in the table; the structure legs are
   *  their own names (the gate's closed vocabulary IS the printed word). */
  refusalRow(row: PreFlightGateName): string {
    return (WORDS.refusal.stations as Readonly<Record<string, string>>)[row] ?? row;
  }

  /** One named refusal reason's word. `held` answers the held report's template (the
   *  caller fills it through `inFlightHeld`) and `corrupt-record` the corrupt-lock
   *  sentence — neither is a second spelling of the in-flight row. */
  refusalReason(reason: PreFlightReason): string {
    return WORDS.refusal.reasons[reason];
  }

  /** The whole checked family. */
  checkedWords(): CheckedWords {
    return WORDS.checked;
  }

  /** One declared yield reason's row. */
  checkedSkip(reason: SkipReason): string {
    return WORDS.checked.skipped[reason];
  }

  /** The whole in-flight family. */
  inFlightWords(): InFlightWords {
    return WORDS.inFlight;
  }

  /** The held report of one record — the single filler of the row's slots. The two instants
   *  are the injected clock's: `startedAt` formatted, `uptime` the holder process's age in
   *  whole minutes. */
  inFlightHeld(facts: {
    readonly pid: number;
    readonly command: string;
    readonly startedAt: number;
    readonly wave: string | null;
    readonly slug: string;
  }): string {
    const uptimeMinutes = Math.max(0, Math.floor((this.#clock.now() - facts.startedAt) / 60_000));
    return WORDS.inFlight.held
      .replace("{pid}", String(facts.pid))
      .replace("{command}", facts.command)
      .replace("{startedAt}", this.#clock.isoOf(facts.startedAt))
      .replace("{uptime}", `${uptimeMinutes}m`)
      .replace("{wave}", facts.wave ?? "none")
      .replace("{slug}", facts.slug);
  }

  /** The fourth state's naked line — the ONE renderer the four observation faces read. Only
   *  the cells that read out missing render, and no `held` prefix: the caller owns the row's
   *  own spelling. */
  inFlightTargetGone(gone: readonly TargetFact[]): string {
    const row = WORDS.inFlight.targetGone;
    const cells = gone.map((fact) => row.cells[fact]);
    return `${row.lead} ${cells.join(row.separator)} — ${row.takeover}`;
  }

  /** The dead holder's takeover hint — the fourth state's line when a target fact read out
   *  missing, else the ordinary `stealable` sentence. */
  inFlightTakeoverHint(gone: readonly TargetFact[]): string {
    return gone.length > 0 ? this.inFlightTargetGone(gone) : WORDS.inFlight.stealable;
  }

  /** The preview / board lock row of one holder record. */
  inFlightLock(record: {
    readonly pid: number;
    readonly command: string;
    readonly startedAt: number;
    readonly wave: string | null;
    readonly slug: string;
  }): string {
    return WORDS.inFlight.lockHeld
      .replace("{pid}", String(record.pid))
      .replace("{command}", record.command)
      .replace("{startedAt}", this.#clock.isoOf(record.startedAt))
      .replace("{wave}", record.wave ?? "none")
      .replace("{slug}", record.slug);
  }

  /** The whole board family. */
  boardWords(): BoardWords {
    return WORDS.board;
  }

  /** One board's legend tail — the ONE template, filled from the declared markers and that
   *  board's scope word. */
  legendTail(scope: "board" | "graph"): string {
    const progress = WORDS.board.progress;
    return progress.legend
      .replace("{done}", progress.markers.done)
      .replace("{current}", progress.markers.current)
      .replace("{pending}", progress.markers.pending)
      .replace("{scope}", progress.scopes[scope]);
  }

  /** The current wave's row annotation (`← <word>`) — never the legend's scope word. */
  currentWaveAnnotation(): string {
    return WORDS.board.progress.annotation;
  }

  /** The whole artifact family. */
  artifactWords(): ArtifactWords {
    return WORDS.artifacts;
  }

  /** One artifact row state word — the anomaly prefix rides the two anomalous states and
   *  never the healthy or absent one. */
  artifactState(state: "ok" | "absent" | "misplaced" | "invalid"): string {
    const word = WORDS.artifacts.states[state];
    const anomalous = state === "misplaced" || state === "invalid";
    return anomalous ? `${WORDS.artifacts.anomalyPrefix}${word}` : word;
  }

  /** One route classifier word. */
  routeWord(kind: RouteWordKind): string {
    return WORDS.route[kind];
  }

  /** The pipeline skill-ref instruction phrase, filled with the per-host reference form. */
  handoffRefWord(ref: string): string {
    return WORDS.route.handoffRef.replace("{ref}", ref);
  }

  /** The fix hop's readback sentence, with the rulings sidecar's path in its slot. */
  fixReadbackWord(path: string): string {
    return WORDS.route.fixReadback.replace("{path}", path);
  }

  /** The issue type set — derived from its ONE declaration, never re-typed. */
  issueTypes(): readonly IssueType[] {
    return ISSUE_TYPES;
  }

  /** The guard ban rows of one family. */
  guardBanWords(family: GuardFamily): readonly GuardBanWord[] {
    return GUARD_BAN_WORDS[family];
  }

  /** Every banned token, flat — the one scan set the guards consume. */
  guardBanTokens(): readonly string[] {
    return Object.values(GUARD_BAN_WORDS).flatMap((family) => family.map((row) => row.token));
  }
}
