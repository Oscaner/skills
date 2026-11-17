// packages/cdd-engine/src-next/contract/__tests__/type-refusal.ts
// The compile-time twin of a refusal — the negative direction a runtime `expect` cannot
// hold. `expectTypeOf(...).not.toMatchTypeOf` reports its mismatch only under
// `vitest --typecheck`, which this package does not run, and the TS "expect an error"
// pragma is a banned token on the engine source face (`face/words.ts`
// GUARD_BAN_WORDS). A refusal is therefore written the way this tree already pins a
// compile-time fact — as an ASSIGNMENT that `tsc -p packages/cdd-engine --noEmit`
// evaluates: `Refuses<T, U>` is `true` while `T` stays outside `U`, and `never` once `T`
// becomes assignable to it, whereupon the `true` assignment stops compiling.
//
// Read a use of it as the type-level `expect(...).toBe(true)` of a cell: it is test
// support, never a production alias, and it lives beside the two suites that read it.

/** `true` while `T` is NOT assignable to `U`, `never` once it is. */
export type Refuses<T, U> = [T] extends [U] ? never : true;
