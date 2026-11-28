// packages/cdd-engine/src/env/workspace/seal.ts
// The write-protection bit of the engine's own carriers: a carrier lands read-only,
// the dispatch that owns it opens exactly its own names, and every terminal seals
// again. Which names are carriers is the artifact matrix's judgment — this file owns
// the permission bits and the one chmod seam, and nothing about naming.
//
// Invariant: sealing is idempotent and an absent target is the round's own absence,
// never a seal failure; every other failure surfaces.

import { chmodSync, statSync } from "node:fs";

/** Seal — one path's permission bit. */
export class Seal {
  /** The mode a carrier lands in: owner, group and other all read-only. The engine
   *  rewrites a carrier by unsealing it first, never by writing through the bit. */
  static readonly SEALED = 0o444;

  /** The mode a dispatch opens its own names with. */
  static readonly WRITABLE = 0o644;

  readonly #target: string;

  constructor(target: string) {
    this.#target = target;
  }

  /** Make the target read-only. Idempotent; a never-written target is not an error. */
  seal(): void {
    this.#chmod(Seal.SEALED);
  }

  /** Open the target for writing. */
  open(): void {
    this.#chmod(Seal.WRITABLE);
  }

  /** Whether the target currently carries the sealed mode; an unreadable target
   *  answers false (there is no bit to report). */
  get sealed(): boolean {
    try {
      return (statSync(this.#target).mode & 0o777) === Seal.SEALED;
    } catch {
      return false;
    }
  }

  /** The one chmod seam — a missing target is an absence, any other failure throws. */
  #chmod(mode: number): void {
    try {
      chmodSync(this.#target, mode);
    } catch (raw) {
      if ((raw as NodeJS.ErrnoException).code === "ENOENT") return;
      throw raw;
    }
  }
}
