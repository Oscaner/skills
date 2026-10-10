// packages/cdd-engine/src-next/face/words.ts
// T10 — the single word table (design spec §1.2: one table, one derivation chain).
// The five-way lexicon split of the old tree (words content → contract-lexicon.json
// → schema shape → word-table accessor → guard-lexicon) converges into ONE word
// table with four families served by one class:
//
//   doc   — the document structural words: the T2 registries' anchor lexicon
//           (derived through the projection face — the DOC_TOKENS plane, never a
//           hand-written second list).
//   capsule — the capsule-station words: the capsule keys (status · blocker ·
//           handoff, the pinned emit order), the `next:` route station + the stderr
//           stations, the status vocabulary and the route classifier words. Every
//           byte the capsule emits rides this family — a reorder is a red test.
//   guard — the guard-ban words: the retired-vocabulary ban rows (STALE / GATE /
//           shape) the guards assert absent from the live faces. This is the ban
//           table's data-source face — the guard scan releases these rows as its
//           own data, so the words can live in the shipped table (the
//           data-row-release stance of the retired residue guard).
//   locale — the locale face (T19, the P7 translation system): each row carries
//           `{ en: canonical, zh?: Chinese alias }`, the locale key set is the `langs`
//           projection source (locale-consuming faces derive from it, never a
//           hardcoded list), and the issue-label rows are the human-readable
//           rendering face's locale words. The Translator (contract/translate.ts)
//           speaks the whole plane from this face — the word table is the single
//           translation data (a new word is a new data row, never a code branch).
//
// The vocabulary is English-primary and death-stable: v1 keeps the same word face
// the consumers already read (status · blocker · handoff · next:) — a steady state,
// never a compatibility shim. The capsule class reads ALL its words through this
// instance (constructor injection) — the guaranteed "one table, zero second table".
// The capsule machine face (status · next: · CDD_BLOCKED:) is never a locale row —
// the machine surface stays English-constant, never localizeable.
//
// Module-level exports are types / the declared word data / the class — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import { declaredRegistries } from "../contract/declare.ts";
import type { DocKey } from "../contract/project.ts";
import { Projector } from "../contract/project.ts";
import type { LocalizedWord, WordLocaleFace } from "../contract/translate.ts";

// ---------------------------------------------------------------------------
// capsule — the station-word family (the declared steady word face)
// ---------------------------------------------------------------------------

/** The capsule emit keys — the pinned `status · blocker · handoff` order. */
export type CapsuleKey = "status" | "blocker" | "handoff";

/** The route station kinds — the addressed channels of the command surface. */
export type StationKind = "next" | "blocked" | "warn" | "cliMissing";

/** The route classifier words — the station vocabulary the `next:` line renders
 *  (v1.20: the `none` word is retired — closure is `done`, never "no suggestion";
 *  v1.25: `implement` — the dispatch-ready `next:` literal's verb for a ready wave). */
export type RouteWordKind = "done" | "review" | "fix" | "implement";

/** The wave-gate BLOCK wording rows — the vocabulary the WaveGate verdicts render
 *  (the v1.21 word-table pin: the gate's prompt wording rides the word table, never a CLI literal).
 *  Each row is a placeholder template verbatim-filled by the wave gate; the braces
 *  ({requested}/{open}/{phase}) are the fill slots, part of the row. (v1.28 — the
 *  heterogeneous row retired: the wave-unitary ledger holds one row per wave, so a
 *  mixed-phase anomaly is structurally impossible.) */
export interface WaveGateWords {
  /** The split/subset BLOCK — a `--tasks` set that splits or mismatches the derived wave. */
  split: string;
  /** The wrong-phase BLOCK — the open wave is at a phase different from the requested verb. */
  wrongPhase: string;
}

/** The pre-flight BLOCK wording rows — the lifecycle pre-flight seam's refusal
 *  vocabulary (P4.1 T1 — the word-table pin: the seam's CDD_BLOCKED wording rides
 *  the table, never a CLI restate). The braces are fill slots ({count}); the
 *  wave-gate rows above stay the wave gate's own surface. */
export interface PreflightWords {
  /** The dirty-tree BLOCK — a dirty working tree refuses every work dispatch. */
  dirtyTree: string;
  /** The plan-graph BLOCK — the plan's DependsOn graph fails to validate. */
  planGraph: string;
  /** The doc-contract BLOCK — the target doc fails the structural contract. */
  docContract: string;
}

/** The capsule word rows — every word the capsule face emits, one table. */
export const CAPSULE_WORDS = {
  /** The capsule emit keys in order (a reorder is a red test — the pinned face). */
  keys: ["status", "blocker", "handoff"] as const satisfies readonly CapsuleKey[],
  /** The `·`-separator token of the capsule line. */
  separator: " · ",
  /** The status vocabulary — the five handoff-conclusion values. */
  status: ["APPROVED", "BLOCKED", "CHANGES_REQUESTED", "REVIEW_FIX", "TIMEOUT"] as const,
  /** The route stations — the `: `-suffixed channel anchors. */
  stations: {
    next: "next:",
    blocked: "CDD_BLOCKED:",
    warn: "CDD_WARN:",
    cliMissing: "CDD_CLI_MISSING:",
  } as const,
  /** The route classifier words of the `next:` line. */
  routeWords: {
    done: "done",
    review: "review",
    fix: "fix",
    implement: "implement",
  } as const,
  /** The wave-gate BLOCK wording rows (v1.21) — the highest-arity pre-flight refusal
   *  vocabulary, single-sourced (the gate fills the placeholders, never a re-type). */
  waveGate: {
    split:
      "the requested wave ({requested}) splits/mismatches the derived wave ({open}) — dispatch the full derived wave",
    wrongPhase: "the open wave is at {phase} — run cdd {phase} first",
  } as const satisfies WaveGateWords,
  /** The pre-flight BLOCK wording rows (P4.1 T1) — the seam's refusal vocabulary,
   *  single-sourced (the seam fills the {count} slot, never a re-type). */
  preflight: {
    dirtyTree:
      "the working tree is dirty — commit or discard your changes, then re-run the same command",
    planGraph: "the plan graph has {count} edge violation(s) — fix the **DependsOn** edges first",
    docContract: "the target document fails the doc-contract — fix its structural findings first",
  } as const satisfies PreflightWords,
} as const;

// ---------------------------------------------------------------------------
// guard — the ban-word family (the retired-vocabulary ban rows, self-declared)
// ---------------------------------------------------------------------------

/** The guard-ban row shape — one banned token of the guard-vocabulary families. */
export interface GuardBanWord {
  /** The banned token the live faces must not carry. */
  token: string;
}

/** The guard-ban vocabulary — the STALE / GATE / shape ban rows the guards assert
 *  absent from the live faces (the single-source ban table; the guard scan releases
 *  this data source — the retired residue guard's data-row-release stance). */
export const GUARD_BAN_WORDS = {
  /** The stale retired-mechanism tokens (the migration residue bans). */
  stale: [
    { token: "cursor-agent" },
    { token: "@ts-ignore" },
    { token: "@ts-expect-error" },
    { token: "build.config" },
    { token: "dev:stub" },
    { token: "@typescript/typescript6" },
    { token: "globalSetup" },
    { token: ".mjs" },
  ] as const satisfies readonly GuardBanWord[],
  /** The retired-gate channel tokens. */
  gate: [
    { token: "CDD_GATE" },
    { token: "cdd-gate-core" },
    { token: "gateDecide" },
  ] as const satisfies readonly GuardBanWord[],
  /** The retired engine-shape names the consumer surfaces must not restate. */
  shape: [
    { token: "3-line return block" },
    { token: "4th line counters" },
    { token: "return block" },
  ] as const satisfies readonly GuardBanWord[],
} as const;

/** The guard-ban family keys (stale / gate / shape). */
export type GuardFamily = keyof typeof GUARD_BAN_WORDS;

// ---------------------------------------------------------------------------
// locale — the word-table locale face (the P7 translation-system data plane)
// ---------------------------------------------------------------------------

/** The locale key set — the word table's declared language keys. This is the
 *  `langs` projection source: every locale-consuming face derives its language
 *  vocabulary from this set (and its aliases from the rows below), never from a
 *  hardcoded list — a locale-key change here re-projects the whole plane. */
export const LOCALE_KEYS = ["en", "zh"] as const;

/** One locale word row id — the issue-label family's word-id shape (`${type}.${segment}`). */
export type LocaleWordId = `${string}.${string}`;

/** The issue-body label rows — the human-readable rendering face's locale words, one
 *  row per finding type × segment (keyed `${type}.${segment}`). Every label value the
 *  issue renderer emits rides these rows — the word table's locale family (the label
 *  set is data, never a second rendering table). The finding type × segment matrix is
 *  complete (word-table test pins it); the capsule machine words are deliberately
 *  absent — the machine face is not a translation surface. */
export const ISSUE_LABEL_WORDS = {
  "bug.context": { en: "## Context", zh: "## 场景" },
  "bug.problem": { en: "## Problem", zh: "## 问题" },
  "bug.impact": { en: "## Impact", zh: "## 影响" },
  "bug.suggestedFix": { en: "## Suggested fix", zh: "## 建议修复" },
  "enhancement.context": { en: "## Context", zh: "## 场景" },
  "enhancement.problem": { en: "## Gap", zh: "## 差距" },
  "enhancement.impact": { en: "## Impact", zh: "## 影响" },
  "enhancement.suggestedFix": { en: "## Suggested direction", zh: "## 建议方向" },
  "chore.context": { en: "## Context", zh: "## 场景" },
  "chore.problem": { en: "## Gap", zh: "## 差距" },
  "chore.impact": { en: "## Impact", zh: "## 影响" },
  "chore.suggestedFix": { en: "## Suggested direction", zh: "## 建议方向" },
} as const satisfies Readonly<Record<LocaleWordId, LocalizedWord>>;

/** The charter anchor rows — the P7 canonicalize data plane: one row per legacy
 *  Chinese charter marker the structure judge matches through the canonicalize view
 *  (the doc-arch overall 决策组叶 / 上游先例背书). The family prefix `charter.` sits
 *  parallel to the issue-label family — every row flows through localeRows() (the zh
 *  knowledge lives ONLY here, never in a code branch or an element-table pattern). */
export const CHARTER_WORDS = {
  "charter.group-leaf": { en: "group", zh: "组" },
  "charter.upstream-endorsements": { en: "Upstream Endorsements", zh: "上游先例背书" },
} as const satisfies Readonly<Record<LocaleWordId, LocalizedWord>>;

/**
 * Words — the single word table + accessor face. One instance serves every family:
 * the doc words (derived from the T2 registries through the projection face), the
 * capsule station words (declared steady data), the guard ban words (declared data)
 * and the locale words (the translation/label data — the WordLocaleFace the
 * Translator and the locale consumers read). The capsule reads its whole vocabulary
 * through this class — the second table is excluded by construction.
 */
export class Words implements WordLocaleFace {
  /** The projection face the doc words derive through (T3 — the DOC_TOKENS plane). */
  readonly #projector: Projector;

  constructor(projector = new Projector(declaredRegistries)) {
    this.#projector = projector;
  }

  // -------------------------------------------------------------------------
  // doc — the DOC_TOKENS face
  // -------------------------------------------------------------------------

  /** The doc words of one doc type — the T2 registries' anchors, derived through
   *  the projection face (the DOC_TOKENS plane — never a hand-written second list). */
  docWords(docKey: DocKey): readonly string[] {
    return this.#projector.tokens()[docKey].tokens.map((token) => token.anchor);
  }

  /** Whether one anchor token is a doc word of one doc type. */
  hasDocWord(docKey: DocKey, anchor: string): boolean {
    return this.docWords(docKey).includes(anchor);
  }

  // -------------------------------------------------------------------------
  // capsule — the station-word family
  // -------------------------------------------------------------------------

  /** The capsule emit keys in order — status · blocker · handoff (the pinned byte
   *  order the capsule renders by). */
  capsuleKeys(): readonly CapsuleKey[] {
    return CAPSULE_WORDS.keys;
  }

  /** The `·`-separator token of the capsule line. */
  capsuleSeparator(): string {
    return CAPSULE_WORDS.separator;
  }

  /** The status vocabulary — the five handoff-conclusion values. */
  statusVocab(): readonly string[] {
    return CAPSULE_WORDS.status;
  }

  /** One route station by its semantic kind (`next:` / `CDD_BLOCKED:` / …). */
  station(kind: StationKind): string {
    return CAPSULE_WORDS.stations[kind];
  }

  /** One route classifier word (`done` / `review` / `fix` / `implement`). */
  routeWord(kind: RouteWordKind): string {
    return CAPSULE_WORDS.routeWords[kind];
  }

  /** The wave-gate BLOCK wording rows — the vocabulary the WaveGate verdicts render
   *  (single source: the gate fills the placeholders from these rows, never re-types). */
  waveGateWords(): WaveGateWords {
    return CAPSULE_WORDS.waveGate;
  }

  /** The pre-flight BLOCK wording rows — the seam's refusal vocabulary (single
   *  source: the seam fills the placeholders from these rows, never re-types). */
  preflightWords(): PreflightWords {
    return CAPSULE_WORDS.preflight;
  }

  // -------------------------------------------------------------------------
  // locale — the word-table locale face (the langs projection + the label rows)
  // -------------------------------------------------------------------------

  /** The locale key set — the word table's declared languages (the `langs`
   *  projection every locale-consuming face derives its vocabulary from). */
  localeKeys(): readonly string[] {
    return LOCALE_KEYS;
  }

  /** Every locale row of the word table, flat (the Translator's row index source —
   *  the single translation data, zero second table: the issue-label rows + the
   *  charter anchor rows). */
  localeRows(): readonly LocalizedWord[] {
    return [...Object.values(ISSUE_LABEL_WORDS), ...Object.values(CHARTER_WORDS)];
  }

  /** One locale row by its word id (`${type}.${segment}` or a charter row id);
   *  null for an unknown id. */
  localeRow(id: string): LocalizedWord | null {
    const row =
      (ISSUE_LABEL_WORDS as Readonly<Record<string, LocalizedWord>>)[id] ??
      (CHARTER_WORDS as Readonly<Record<string, LocalizedWord>>)[id];
    return row ?? null;
  }

  // -------------------------------------------------------------------------
  // guard — the ban-word family
  // -------------------------------------------------------------------------

  /** The guard ban rows of one family — the STALE / GATE / shape ban words. */
  guardBanWords(family: GuardFamily): readonly GuardBanWord[] {
    return GUARD_BAN_WORDS[family];
  }

  /** The full guard ban token set — every banned word, flat (the single-source
   *  scan set the guards consume). */
  guardBanTokens(): readonly string[] {
    return Object.values(GUARD_BAN_WORDS).flatMap((family) => family.map((row) => row.token));
  }
}
