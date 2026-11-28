// packages/cdd-engine/src/surface/render/capsule.ts
// The capsule — one round's `status · handoff` line and the route rows that follow it.
//
// INVARIANT — the slot ORDER is the contract, and this class only CONNECTS it: the status
// line, then the summary cell (when the round's facts carry one), then `next:` with its
// `reason:`. Nothing here counts, composes or judges, so the fix round's disposition
// summary and a judge round's re-grade note arrive as one already-rendered value and cannot
// grow a second composition point.
//
// Four shapes, and each is a different fact:
//   · a success status prints `status: <status> · handoff: <path>`;
//   · a failure status (`BLOCKED` · `TIMEOUT`) prints `status: <status>`, plus the handoff
//     only when the round wrote a crash record;
//   · a summary row prints between the status line and `next:` — its absence shortens the
//     frame by one ROW, never by one slot;
//   · a frame with no hop prints no route row at all.
//
// The key words ride the word table's key set (`capsuleKeys`), the separator its own row,
// and the two route rows the shared route renderer, so a capsule and a board print one hop
// with one spelling.
//
// Module-level exports are the type and the class — zero bare functions.

import type { NextHop } from "../../run/advance/next.ts";
import type { CapsuleKey, Words } from "../words/words.ts";
import type { RouteRenderer } from "./route.ts";

/** One round's capsule facts — the values the slot order is filled from. */
export interface CapsuleFacts {
  /** The round's conclusion word (`APPROVED` · `BLOCKED` · `CHANGES_REQUESTED` · …). */
  readonly status: string;
  /** The round's carrier coordinate (the `handoff:` cell). */
  readonly handoff: string;
  /** The summary cell — the fix round's disposition counts or a judge round's re-grade
   *  note, already composed by the round that judged it. Absent when the round contributed
   *  none. */
  readonly summary?: string;
  /** Whether the round wrote a crash record — the failure status's second key. */
  readonly crashRecord?: boolean;
  /** The line's one next hop; absent on the failure face. */
  readonly hop?: NextHop | null;
}

/**
 * Capsule — the capsule face. Invariant: one facts value renders the slot order declared by
 * the word table and nothing else (see the file's header).
 */
export class Capsule {
  readonly #words: Words;
  readonly #route: RouteRenderer;

  constructor(words: Words, route: RouteRenderer) {
    this.#words = words;
    this.#route = route;
  }

  /** One round's capsule rows. */
  emit(facts: CapsuleFacts): readonly string[] {
    const words = this.#words;
    const cells: Record<CapsuleKey, string> = {
      status: facts.status,
      handoff: facts.handoff,
    };
    const statusLine = words
      .capsuleKeys(facts.status, facts.crashRecord === true)
      .map((key) => `${key}: ${cells[key]}`)
      .join(words.capsuleSeparator());
    const rows: string[] = [statusLine];
    if (facts.summary !== undefined) rows.push(facts.summary);
    rows.push(...this.#route.capsuleRows(facts.hop ?? null));
    return rows;
  }
}
