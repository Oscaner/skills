// packages/cdd-engine/src/domain/task-group.ts — TaskGroup: the group-identity value object
// (P4.4 Task 3 ①, plan "TaskGroup group-identity unification"). The dispatch group `--tasks <n|n,n,…>` normalizes
// to ONE value object; `key()` is the canonical serialization (comma-joined, no space — singleton
// `"1"`, merged `"1,2"`): the repo's single group identity — the CLI argument string IS the key,
// there is no second form. `GROUP_KEY_PATTERN` is the single key grammar source (consumed by the
// handoff roundPattern scan and the contract token descriptions — zero second implementation).
// Domain-layer discipline: this module carries no infra/cli coupling (no clone of the CLI usage
// error) — an illegal token throws IllegalTaskTokenError carrying the offending token; the CLI
// boundary (parseTaskList) translates it to the exit-2 usage face.

/** Strict single-token integer test — the hyphen form (`1-2`) and any non-integer token are
 * illegal. Deliberately NOT parseInt (parseInt("1-2") === 1 — the legacy acceptance bug this value
 * object exists to kill). */
const INTEGER_TOKEN_RE = /^\d+$/;

/** Illegal task-group token — fromTokens' domain-level rejection. `.token` carries the raw
 * offending token; the CLI boundary re-frames the message (exit-2 usage face). */
export class IllegalTaskTokenError extends Error {
  readonly token: string;
  constructor(token: string) {
    super(`task group token must be an integer: ${JSON.stringify(token)}`);
    this.name = "IllegalTaskTokenError";
    this.token = token;
  }
}

function toInteger(n: unknown): number {
  if (typeof n !== "number") throw new IllegalTaskTokenError(String(n));
  return n;
}

/** TaskGroup — the dispatch group's value object (numeric identity = the sorted unique task
 * number multiset; key form = comma-joined). Immutable; all factories dedupe + sort ascending. */
export class TaskGroup {
  /** The single key grammar: comma-separated integers, no range/hyphen/space form. Exported for
   * the handoff roundPattern scan shape and the template-contract token descriptions — the key
   * grammar's single source (an edit here re-shapes every consumer; no second implementation). */
  static readonly GROUP_KEY_PATTERN: RegExp = /^\d+(?:,\d+)*$/;

  readonly #nums: readonly number[];

  private constructor(numbers: readonly number[]) {
    this.#nums = Object.freeze([...numbers]) as readonly number[];
  }

  /** fromNumbers — factory over a numeric list: validates integers, dedupes, sorts ascending. */
  static fromNumbers(numbers: readonly number[]): TaskGroup {
    if (numbers.length === 0) throw new IllegalTaskTokenError("<empty>");
    const unique = new Set<number>();
    for (const n of numbers) {
      const i = toInteger(n);
      if (!Number.isSafeInteger(i) || i < 1) throw new IllegalTaskTokenError(String(i));
      unique.add(i);
    }
    return new TaskGroup([...unique].sort((a, b) => a - b));
  }

  /** fromTokens — factory over raw (already comma-split) tokens: trims, validates the FULL token as
   * an integer (non-integer / empty → IllegalTaskTokenError), dedupes, sorts ascending. */
  static fromTokens(tokens: readonly string[]): TaskGroup {
    const nums: number[] = [];
    for (const raw of tokens) {
      const token = raw.trim();
      if (!INTEGER_TOKEN_RE.test(token)) throw new IllegalTaskTokenError(raw);
      nums.push(Number(token));
    }
    return TaskGroup.fromNumbers(nums);
  }

  /** canonical serialization — comma-joined, no space: the repo's single group identity. */
  key(): string {
    return this.#nums.join(",");
  }

  /** template-literal interop: `${group}` === group.key(). */
  toString(): string {
    return this.key();
  }

  /** the sorted unique task numbers (readonly view). */
  get numbers(): readonly number[] {
    return this.#nums;
  }

  /** member assertion — does the group contain the task number? */
  includes(taskNum: number): boolean {
    return this.#nums.includes(taskNum);
  }

  /** group size (1 = singleton group). */
  get length(): number {
    return this.#nums.length;
  }

  /** singleton test — a one-number group (the pre-P4.3 per-task dispatch identity). */
  isSingleton(): boolean {
    return this.#nums.length === 1;
  }

  /** iterable — `for (const n of group)` / spreads read the canonical number list. */
  *[Symbol.iterator](): IterableIterator<number> {
    yield* this.#nums;
  }
}

/** toTaskGroup — the CLI/lifecycle boundary normalization: scalar | array | TaskGroup → TaskGroup.
 * The single place an external scalar/array enters the group-identity plane. */
export function toTaskGroup(tasks: number | readonly number[] | TaskGroup): TaskGroup {
  if (tasks instanceof TaskGroup) return tasks;
  return TaskGroup.fromNumbers(
    Array.isArray(tasks) ? (tasks as readonly number[]) : [tasks as number],
  );
}
