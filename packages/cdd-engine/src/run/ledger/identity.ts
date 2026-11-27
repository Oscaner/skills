// packages/cdd-engine/src/run/ledger/identity.ts
// The round identity and the line identity it hangs on.
//
// A round is ONE coordinate: the line it was dispatched on, the op it ran, its cycle and
// its attempt. `RoundIdentity` is that coordinate lifted to a value — the ledger's
// records, the artifact names and the `(cycle, attempt)` ordering all read it, and none
// of them re-spells the four cells.
//
// Invariant: the four cells are INJECTIVE — one key names one round. A `(line, op, cycle,
// attempt)` recorded twice is the same cell (the ledger replaces it), and a different
// attempt is a different round. The key is the one spelling every map in the ledger and
// the artifact index keys on; a second spelling would let one round be two rows.
//
// The line word is a plain string here on purpose: `run/ledger` is the fact layer, and it
// knows no document type — a line is a KEY to it, never a shape it judges. The waves'
// `tasks-<ids>` spine, the four document words and `branch` are what a caller passes; the
// only grammar this file owns is the one that reads a wave's task ids back off its own
// word.

/** The three dispatch verbs a round records. Branch review rides `review`. */
export type RoundOp = "implement" | "review" | "fix";

/** The declared op words, in the order a refusal names them — the runtime companion of
 *  `RoundOp`, so no consumer re-types the list. */
export const ROUND_OPS = ["implement", "review", "fix"] as const satisfies readonly RoundOp[];

/** The line kinds the ledger keys on: a wave (a task group), a document, or the branch. */
export type LineKind = "wave" | "doc" | "branch";

/** The four document words a doc line may carry — the ledger names no `DocType`, it only
 *  knows which line words are documents. */
export const DOC_LINE_WORDS = ["overall", "plan", "phase-spec", "single-spec"] as const;

/** The branch line's word. */
export const BRANCH_LINE_WORD = "branch";

/** The wave line word's spine — `tasks-<comma-separated ids>`. */
export const WAVE_LINE_PREFIX = "tasks-";

/** The wave row's KEY shape — the task-group ids, comma-separated. The progress document
 *  keys a wave row by this cell (the frozen `wave` cell), so the fold below is the only
 *  place the persisted key and the ledger's line word meet. A document word and `branch`
 *  never match it. */
const WAVE_KEY = /^\d+(,\d+)*$/;

/** The cells one round identity carries. */
export interface RoundIdentityFacts {
  /** The line word (`tasks-1,2` · `phase-spec` · `branch`). */
  readonly line: string;
  /** The op the round ran. */
  readonly op: RoundOp;
  /** The round number on its line (1-based). */
  readonly cycle: number;
  /** The attempt number of that cycle (1-based). */
  readonly attempt: number;
}

/**
 * RoundIdentity — one round's `(line, op, cycle, attempt)` coordinate. Invariant: the
 * four cells are injective, so `key` names exactly one round; a constructed identity is
 * immutable, and the sequence rules (`compare` / `later`) read the same two cells.
 *
 * Rule zero (over the 200-line class limit): the identity is one value with its two
 * derivations (the key and the line word) — splitting the line grammar out would put the
 * coordinate in two files that always change together.
 */
export class RoundIdentity {
  readonly line: string;
  readonly op: RoundOp;
  readonly cycle: number;
  readonly attempt: number;

  constructor(facts: RoundIdentityFacts) {
    if (facts.line.trim().length === 0) {
      throw new Error("RoundIdentity: a round carries no empty line word");
    }
    if (!ROUND_OPS.includes(facts.op)) {
      throw new Error(`RoundIdentity: "${String(facts.op)}" is not a declared round op`);
    }
    RoundIdentity.#assertPositive(facts.cycle, "cycle");
    RoundIdentity.#assertPositive(facts.attempt, "attempt");
    this.line = facts.line;
    this.op = facts.op;
    this.cycle = facts.cycle;
    this.attempt = facts.attempt;
  }

  /** The identity's injective key — the ONE spelling every map keys on. */
  get key(): string {
    return `${this.line}\u0000${this.op}\u0000${this.cycle}\u0000${this.attempt}`;
  }

  /** The line kind this identity hangs on, derived from its own word. */
  get lineKind(): LineKind {
    if (this.line.startsWith(WAVE_LINE_PREFIX)) return "wave";
    if (this.line === BRANCH_LINE_WORD) return "branch";
    return "doc";
  }

  /** The wave task ids this line declares, ascending and deduped. A non-wave line
   *  declares none: the ids are a fact of the line word, never of a second field. */
  get taskIds(): readonly number[] {
    return this.lineKind === "wave" ? RoundIdentity.taskIdsOfWord(this.line) : [];
  }

  /** The task ids one line word declares — the static face of `taskIds`, for a reader
   *  that holds a word and not an identity (a wave row's key). */
  static taskIdsOfWord(word: string): readonly number[] {
    if (!word.startsWith(WAVE_LINE_PREFIX)) return [];
    const ids = new Set<number>();
    for (const token of word.slice(WAVE_LINE_PREFIX.length).split(",")) {
      const trimmed = token.trim();
      if (/^\d+$/.test(trimmed)) ids.add(Number(trimmed));
    }
    return [...ids].sort((left, right) => left - right);
  }

  /** The round sequence — `(cycle, attempt)`, the session's own order. */
  static compare(left: RoundIdentity, right: RoundIdentity): number {
    return left.cycle === right.cycle ? left.attempt - right.attempt : left.cycle - right.cycle;
  }

  /** Whether `other` is the LATER round of the two — identical coordinates are not
   *  later (a re-record of one cell is the same round, never a successor). */
  static later(other: RoundIdentity, record: RoundIdentity): boolean {
    return RoundIdentity.compare(other, record) > 0;
  }

  /** The line word of a target type word and its task group. A wave target keys the task
   *  group (`tasks-1,2`); every other word is its own line. */
  static lineWordOf(type: string, tasks?: string): string {
    return type === "wave" ? `${WAVE_LINE_PREFIX}${tasks ?? ""}` : type;
  }

  /** The `(kind, key)` a line word decomposes into — the wave's ids are the line's own
   *  spine, never a second key. */
  static splitLineWord(word: string): { readonly kind: LineKind; readonly key: string } {
    return word.startsWith(WAVE_LINE_PREFIX)
      ? { kind: "wave", key: word.slice(WAVE_LINE_PREFIX.length) }
      : { kind: word === BRANCH_LINE_WORD ? "branch" : "doc", key: word };
  }

  /** The persisted ROW key of one line word — the cell the progress document holds. A wave
   *  row is keyed by its task group (`1,2`), every other row by its own word. The inverse
   *  of `lineWordOfRowKey`, and the ONE fold between the document's cell and the ledger's
   *  line grammar. */
  static rowKeyOf(word: string): string {
    return RoundIdentity.splitLineWord(word).key;
  }

  /** The line kind one persisted row key names, read off the key's own shape. */
  static lineKindOfRowKey(key: string): LineKind {
    if (WAVE_KEY.test(key)) return "wave";
    return key === BRANCH_LINE_WORD ? "branch" : "doc";
  }

  /** The line word a persisted row key spells — `rowKeyOf`'s inverse, so a reader of the
   *  document never re-spells the wave spine. */
  static lineWordOfRowKey(key: string): string {
    return RoundIdentity.lineKindOfRowKey(key) === "wave" ? `${WAVE_LINE_PREFIX}${key}` : key;
  }

  static #assertPositive(value: number, cell: string): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(
        `RoundIdentity: the ${cell} must be a positive integer, got ${String(value)}`,
      );
    }
  }
}
