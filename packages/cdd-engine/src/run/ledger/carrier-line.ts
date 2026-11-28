// packages/cdd-engine/src/run/ledger/carrier-line.ts
// The carrier-integrity line — the ONE composition point of a carrier-mismatch fact.
//
// Two callers print this sentence: the thrown `CarrierMismatchError` (what a caught
// tampered read says) and the pre-flight `carrier` row (the refusal a gate reports). One
// format, one home: a second copy is a second chance for the two faces to drift, and the
// drift would be invisible — both spellings look right on their own.
//
// The line carries FACTS (the carrier's path and two 8-hex prefixes), never a
// pre-rendered sentence: a snapshot that stored the rendered string would render the same
// fact twice. The shortening to 8 hex chars happens here alone, so no reader can shorten
// the digests differently.
//
// The payload digest and the checked read live here too. The carrier is the engine's own
// artifact: it writes it, the round's record remembers the digest of the payload it wrote,
// and every seam that reads it again compares. A mismatch is a hard stop — the tampered
// carrier is never judged as if the round had produced those bytes. The read takes the
// BYTES, never a path: `env/` is the one filesystem boundary, so this file is pure text.

import { createHash } from "node:crypto";

/** The three facts the line names — the carrier's path and the recorded / current digests
 *  already shortened to their 8-hex diagnostic prefix. */
export interface CarrierFacts {
  /** The carrier's path, as recorded. */
  readonly line: string;
  /** The digest the round's record carries (the 8-hex prefix). */
  readonly recorded: string;
  /** The digest the bytes hold now (the 8-hex prefix). */
  readonly current: string;
}

/** The two full digests behind one mismatch. */
export interface DigestPair {
  /** The digest the record carries, full hex. */
  readonly recorded: string;
  /** The digest the bytes compute to now, full hex. */
  readonly current: string;
}

/** The carrier-read refusal — the bytes at `line` no longer digest to the value the round
 *  recorded. The message IS the diagnostic line, composed by `CarrierLine`: the sentence
 *  this error throws and the refusal the pre-flight `carrier` row reports can never be two
 *  spellings of one fact. */
export class CarrierMismatchError extends Error {
  /** The carrier's path — the `line` the message names. */
  readonly line: string;
  /** The digest the round's record carries (full hex). */
  readonly recorded: string;
  /** The digest the bytes on disk compute to now (full hex). */
  readonly current: string;

  constructor(facts: DigestPair & { readonly line: string }) {
    super(
      CarrierLine.of({
        line: facts.line,
        recorded: CarrierLine.sha8(facts.recorded),
        current: CarrierLine.sha8(facts.current),
      }),
    );
    this.name = "CarrierMismatchError";
    this.line = facts.line;
    this.recorded = facts.recorded;
    this.current = facts.current;
  }

  /** The same three facts as FLAT values (the carrier path and the two 8-hex prefixes) —
   *  what a contract-plane snapshot carries instead of the rendered sentence. */
  facts(): CarrierFacts {
    return {
      line: this.line,
      recorded: CarrierLine.sha8(this.recorded),
      current: CarrierLine.sha8(this.current),
    };
  }
}

/**
 * CarrierLine — the carrier-mismatch station's one composer. Invariant: the station word,
 * the path and the two 8-hex prefixes have exactly one spelling, so the thrown sentence
 * and the printed row are the same bytes.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the line's single composer and the ONE digest rule — the zero-bare-function discipline admits no standalone functions.
export class CarrierLine {
  /** The station word the line leads with — the gate's row name and the error's first
   *  token. */
  static readonly STATION = "carrier-mismatch";

  /** The diagnostic prefix length — the 8 hex chars a human can actually compare. */
  static readonly PREFIX_LENGTH = 8;

  /** The carrier-integrity diagnostic — the station, the carrier's path and the two
   *  8-hex prefixes (recorded / current). */
  static of(facts: CarrierFacts): string {
    return `${CarrierLine.STATION} · line=${facts.line} · recorded=${facts.recorded} · current=${facts.current}`;
  }

  /** The first 8 hex chars — the line's recorded / current pair. */
  static sha8(digest: string): string {
    return digest.slice(0, CarrierLine.PREFIX_LENGTH);
  }

  /** THE carrier payload digest — the payload re-serialized exactly as the workspace
   *  write seam does (`JSON.stringify(payload, null, 2)` + one trailing newline), minus
   *  the optional top-level `contentSha256` key. One rule: a final carrier's embedded
   *  digest covers its payload, never the file bytes that hold it. */
  static digestOf(value: unknown): string {
    return CarrierLine.#sha256(`${JSON.stringify(CarrierLine.#payloadOf(value), null, 2)}\n`);
  }

  /** The recorded / current pair when the two digests disagree — null when either side is
   *  unknown (a legacy record: nothing to compare) or when they agree. */
  static mismatch(recorded: string | null, current: string | null): DigestPair | null {
    if (recorded === null || current === null) return null;
    return recorded === current ? null : { recorded, current };
  }

  /** THE checked read over one carrier's bytes — `null` for an absent carrier, the bytes
   *  when nothing was recorded (a present-facts read, zero comparison) or when they still
   *  digest to the record, and a `CarrierMismatchError` when they do not. An unparseable
   *  payload digests by its raw bytes: it matches no recorded payload digest, so the
   *  difference is named honestly instead of silently passing. */
  static read(text: string | null, line: string, recorded: string | null): string | null {
    if (text === null || recorded === null) return text;
    const pair = CarrierLine.mismatch(recorded, CarrierLine.currentOf(text));
    if (pair === null) return text;
    throw new CarrierMismatchError({ line, ...pair });
  }

  /** One carrier text's current payload digest — the payload rule when the bytes parse,
   *  the raw-bytes digest when they do not. */
  static currentOf(text: string): string {
    try {
      return CarrierLine.digestOf(JSON.parse(text));
    } catch {
      return CarrierLine.#sha256(text);
    }
  }

  /** The raw-bytes sha256 (hex). */
  static #sha256(bytes: string): string {
    return createHash("sha256").update(bytes, "utf8").digest("hex");
  }

  /** The payload view `digestOf` hashes — a shallow copy with the top-level
   *  `contentSha256` key dropped (a non-object payload is returned as it stands). */
  static #payloadOf(value: unknown): unknown {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const payload: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    delete payload.contentSha256;
    return payload;
  }
}
