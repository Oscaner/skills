// packages/cdd-engine/src-next/session/carrier-integrity.ts
// P31 §2.2 — the carrier content digest and its ONE checked read.
//
// A carrier is the engine's own artifact (handoff draft or finalized round carrier):
// the engine writes it, the round's `RoundRecord` remembers the digest of the payload
// it wrote, and every engine seam that READS a carrier again compares the bytes it
// finds against that record. A mismatch is a hard stop (`CDD_BLOCKED`, the
// `carrier-mismatch` line, no child) — the tampered carrier is never judged as if the
// round had produced those bytes.
//
// The rule is single-sourced here, never re-spelled at a call site:
//   · `digestOf` is THE payload-digest rule — the payload re-serialized exactly as the
//     workspace write seam serializes it, minus the optional top-level `contentSha256`
//     key (a FINAL carrier's own embedded digest must not fold itself into its own
//     value; a draft carries no such key, so for a draft `digestOf` equals the sha256
//     of the written bytes).
//   · `read` is THE checked read — absent (`null`), ok (bytes), or mismatch (a thrown
//     `CarrierMismatchError`). A record that predates the digest column is a
//     present-facts read: its bytes are returned with zero comparison (zero migration).
//
// The class depends on no session module (the ledger never enters this import graph), so
// the contract plane and the face plane can both read through it without a cycle: the
// payload rule here is layered over the workspace plane's one digest primitive.

import { readFileSync } from "node:fs";
import { sha256Hex } from "../infra/workspace.ts";

/** The shasum prefix the diagnostic line prints — the `doc-drift` form's recorded /
 *  current pair, shortened to the 8 hex chars a human can actually compare. */
const PREFIX_LENGTH = 8;

/** The carrier-read refusal — the bytes at `line` no longer digest to the value the
 *  round recorded. The message IS the diagnostic line (one shape, one station):
 *  `carrier-mismatch · line=<path> · recorded=<sha8> · current=<sha8>`. */
export class CarrierMismatchError extends Error {
  /** The carrier's path (absolute, as recorded) — the `line` the message names. */
  readonly line: string;
  /** The digest the round's record carries (full hex). */
  readonly recorded: string;
  /** The digest the bytes on disk compute to now (full hex). */
  readonly current: string;

  constructor(line: string, recorded: string, current: string) {
    super(
      `carrier-mismatch · line=${line} · recorded=${CarrierIntegrity.sha8(recorded)} · current=${CarrierIntegrity.sha8(current)}`,
    );
    this.name = "CarrierMismatchError";
    this.line = line;
    this.recorded = recorded;
    this.current = current;
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated carrier read surface — the zero-bare-function discipline admits no standalone predicate functions.
export class CarrierIntegrity {
  /** The raw-bytes sha256 (hex) — the workspace plane's single primitive, delegated
   *  here so a caller of this class need not know where the bytes live. */
  static sha256(bytes: string): string {
    return sha256Hex(bytes);
  }

  /** The first 8 hex chars — the diagnostic line's recorded / current pair. */
  static sha8(digest: string): string {
    return digest.slice(0, PREFIX_LENGTH);
  }

  /** THE carrier payload digest — the payload re-serialized exactly as the workspace
   *  write seam does (`JSON.stringify(payload, null, 2)` + one trailing newline),
   *  minus the optional top-level `contentSha256` key. Single rule: a final carrier's
   *  embedded digest covers its payload, never the file bytes that hold it. */
  static digestOf(value: unknown): string {
    return CarrierIntegrity.sha256(
      `${JSON.stringify(CarrierIntegrity.#payloadOf(value), null, 2)}\n`,
    );
  }

  /** The recorded / current pair when the two digests disagree — null when either side
   *  is unknown (a legacy record: nothing to compare) or when they agree. */
  static mismatch(
    recorded: string | null,
    current: string | null,
  ): { readonly recorded: string; readonly current: string } | null {
    if (recorded === null || current === null) return null;
    return recorded === current ? null : { recorded, current };
  }

  /** THE checked read — three distinct outcomes, never folded together:
   *   · the file is absent → `null` (a present-facts absence, never a throw);
   *   · no recorded digest (a legacy round) → the bytes verbatim, zero comparison;
   *   · both known → the bytes when the recomputed payload digest equals the recorded
   *     one, a `CarrierMismatchError` when it does not.
   *  Any other read error (EACCES, EISDIR …) propagates: a present-but-unreadable
   *  carrier is the caller's own unreadable fact, never a silent absence. */
  static read(path: string, recordedDigest: string | null): string | null {
    const bytes = CarrierIntegrity.#bytesAt(path);
    if (bytes === null || recordedDigest === null) return bytes;
    const gap = CarrierIntegrity.mismatch(recordedDigest, CarrierIntegrity.#currentOf(bytes));
    if (gap === null) return bytes;
    throw new CarrierMismatchError(path, gap.recorded, gap.current);
  }

  /** The record-shaped thin shell — the `RoundRecord`'s own two cells, so a caller
   *  holding a record never re-derives "which digest belongs to this path". A record
   *  with no carrier path reads `null` without touching the disk. */
  static readFor(record: {
    readonly carrierPath: string | null;
    readonly carrierDigest?: string | null;
  }): string | null {
    if (record.carrierPath === null) return null;
    return CarrierIntegrity.read(record.carrierPath, record.carrierDigest ?? null);
  }

  /** The payload view `digestOf` hashes — a shallow copy with the top-level
   *  `contentSha256` key dropped (a non-object payload is returned as it stands). */
  static #payloadOf(value: unknown): unknown {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const payload: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    delete payload.contentSha256;
    return payload;
  }

  /** The carrier's bytes; `null` when the path holds no file. Any other I/O failure
   *  propagates (the caller names it unreadable — never absent). */
  static #bytesAt(path: string): string | null {
    try {
      return readFileSync(path, "utf8");
    } catch (raw) {
      if ((raw as { code?: unknown }).code === "ENOENT") return null;
      throw raw;
    }
  }

  /** The digest of one carrier's bytes — the payload rule when the bytes parse, the
   *  raw-bytes digest when they do not (an unparseable payload matches no recorded
   *  payload digest, and the raw digest still names the difference honestly). */
  static #currentOf(bytes: string): string {
    try {
      return CarrierIntegrity.digestOf(JSON.parse(bytes));
    } catch {
      return CarrierIntegrity.sha256(bytes);
    }
  }
}
