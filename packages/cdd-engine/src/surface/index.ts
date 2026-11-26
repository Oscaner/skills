// packages/cdd-engine/src/surface/index.ts
// `surface/` — the consumer surface: the one word table and the renderers that connect it.
//
// INVARIANT (the slice's one sentence, from the phase spec): one fact, one word table, one
// rendering — every byte a consumer reads of a fact the engine states is declared once, and
// a renderer only connects the table.
//
// This entrance exposes what the wave that landed the table owns: the declared words, the
// guard-ban vocabulary and the issue type set, behind `Cli` — the surface's one door. The
// renderers (the board, the graph view, the capsule and the route lines) arrive with their
// own waves and join this door rather than being reached where they are built, so a consumer
// never learns the tree's internal layout.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { Clock } from "../env/process/clock.ts";
import { Words } from "./words/words.ts";

export {
  type ArtifactReportWords,
  type ArtifactWords,
  type BoardFactWords,
  type BoardWords,
  type CapsuleKey,
  type CapsuleSlot,
  type CapsuleWords,
  type CheckedWords,
  FIX_DISPOSITIONS_SUMMARY,
  GUARD_BAN_WORDS,
  type GuardBanWord,
  type GuardFamily,
  type InFlightWords,
  ISSUE_TYPES,
  type IssueType,
  type ProgressWords,
  type RefusalWords,
  type RouteWordKind,
  type StationKind,
  type TargetGoneWords,
  WORDS,
  Words,
} from "./words/words.ts";

/** The surface's construction facts — the injected clock the in-flight rows are computed
 *  through (the words table reads no wall clock itself). */
export interface CliOptions {
  /** The clock a pinned run injects. */
  readonly clock?: Clock;
}

/**
 * Cli — the consumer surface's one door. Invariant: every byte a consumer reads comes from
 * the ONE word table this door holds, so a second table is unreachable by construction.
 */
export class Cli {
  /** The word table this surface renders through. */
  readonly words: Words;

  constructor(opts: CliOptions = {}) {
    this.words = new Words({ clock: opts.clock ?? new Clock() });
  }
}
