// packages/cdd-engine/src-next/face/words.ts
// T10 — the single word table (design spec §1.2: one table, one derivation chain).
// The five-way lexicon split of the old tree (words content → contract-lexicon.json
// → schema shape → word-table accessor → guard-lexicon) converges into ONE word
// table with three families served by one class:
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
//
// The vocabulary is English-primary and death-stable: v1 keeps the same word face
// the consumers already read (status · blocker · handoff · next:) — a steady state,
// never a compatibility shim. The capsule class reads ALL its words through this
// instance (constructor injection) — the guaranteed "one table, zero second table".
//
// Module-level exports are types / the declared word data / the class — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import { declaredRegistries } from "../contract/declare.ts";
import type { DocKey } from "../contract/project.ts";
import { Projector } from "../contract/project.ts";

// ---------------------------------------------------------------------------
// capsule — the station-word family (the declared steady word face)
// ---------------------------------------------------------------------------

/** The capsule emit keys — the pinned `status · blocker · handoff` order. */
export type CapsuleKey = "status" | "blocker" | "handoff";

/** The route station kinds — the addressed channels of the command surface. */
export type StationKind = "next" | "blocked" | "warn" | "cliMissing";

/** The route classifier words — the station vocabulary the `next:` line renders. */
export type RouteWordKind = "none" | "review" | "fix";

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
    none: "none",
    review: "review",
    fix: "fix",
  } as const,
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

/**
 * Words — the single word table + accessor face. One instance serves every family:
 * the doc words (derived from the T2 registries through the projection face), the
 * capsule station words (declared steady data) and the guard ban words (declared
 * data). The capsule reads its whole vocabulary through this class — the second
 * table is excluded by construction.
 */
export class Words {
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

  /** One route classifier word (`none` / `review` / `fix`). */
  routeWord(kind: RouteWordKind): string {
    return CAPSULE_WORDS.routeWords[kind];
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
