// packages/cdd-engine/src-next/contract/carrier-line.ts
// P40 T3 — the ONE composition point of the carrier-integrity line. Two callers print
// this sentence: the thrown `CarrierMismatchError` (the message a caught tampered
// read speaks) and the pre-flight `carrier` row (the refusal the gate reports). One
// format, one home: a second copy is a second chance for the two faces to drift.
//
// The line carries FACTS (the carrier path and the two 8-hex prefixes), never a
// pre-rendered sentence — a snapshot that stored the rendered string would render the
// same fact twice. The shortening to 8 hex chars happens in `CarrierIntegrity` alone;
// this module only formats what it is handed.

/** The three facts the line names — the carrier's path and the recorded / current
 *  digests already shortened to their 8-hex diagnostic prefix. */
export interface CarrierFacts {
  /** The carrier's path, as recorded. */
  readonly line: string;
  /** The digest the round's record carries (the 8-hex prefix). */
  readonly recorded: string;
  /** The digest the bytes on disk compute to now (the 8-hex prefix). */
  readonly current: string;
}

// biome-ignore lint/complexity/noStaticOnlyClass: the line's single composer — the zero-bare-function discipline admits no standalone functions.
export class CarrierLine {
  /** The carrier-integrity diagnostic — the `carrier-mismatch` station, the carrier's
   *  path and the two 8-hex prefixes (recorded / current). */
  static of(facts: CarrierFacts): string {
    return `carrier-mismatch · line=${facts.line} · recorded=${facts.recorded} · current=${facts.current}`;
  }
}
