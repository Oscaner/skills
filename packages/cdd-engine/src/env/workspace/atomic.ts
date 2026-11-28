// packages/cdd-engine/src/env/workspace/atomic.ts
// The ONE atomic write algorithm of the engine: write a temporary sibling, then
// rename it over the target. A process killed mid-write therefore leaves the previous
// whole document behind, never half a body.
//
// The class carries the ALGORITHM and no syscall: `FileOps` is the injected seam, and
// the concrete implementation lives in `workspace.ts` — so the module that decides
// "how a write becomes atomic" is not the module that calls `fs`, and a test can inject
// a writer that fails after emitting half its bytes and prove the target is untouched.
//
// The temp name is a sibling of the target (a rename across filesystems is not atomic),
// unique per write (a counter, so two writes in one process never collide), and always
// removed on failure so a failed write leaves no stray.

/** The syscall seam an atomic write is built on. */
export interface FileOps {
  /** Write `text` to `file` (UTF-8), creating or truncating it. */
  write(file: string, text: string): void;
  /** Move `from` over `to`, replacing it. */
  rename(from: string, to: string): void;
  /** Remove `file`; a missing file is not a failure. */
  remove(file: string): void;
  /** Whether `file` exists. */
  exists(file: string): boolean;
}

/**
 * Atomic — the temp-then-rename write. Invariant: after any write, the target holds
 * either its previous whole bytes or the new whole bytes; a failure leaves the
 * previous bytes and no temporary sibling behind.
 */
export class Atomic {
  /** The temporary sibling's suffix — one spelling, so a sweep can recognise one. */
  static readonly TEMP_SUFFIX = ".tmp";

  readonly #ops: FileOps;
  #counter = 0;

  constructor(ops: FileOps) {
    this.#ops = ops;
  }

  /** Write `text` to `target` atomically. A failing write or rename propagates after
   *  the temporary sibling is removed — the target keeps its previous bytes. */
  write(target: string, text: string): void {
    const temporary = this.#temporaryOf(target);
    try {
      this.#ops.write(temporary, text);
      this.#ops.rename(temporary, target);
    } catch (raw) {
      this.#ops.remove(temporary);
      throw raw;
    }
  }

  /** Whether `target` exists — the write face's "was there anything to preserve"
   *  question, answered through the same seam. */
  exists(target: string): boolean {
    return this.#ops.exists(target);
  }

  /** A unique sibling name for one write: the target's own name plus a
   *  per-process counter, so two concurrent writes never share a temp file. */
  #temporaryOf(target: string): string {
    this.#counter += 1;
    return `${target}.${this.#counter}${Atomic.TEMP_SUFFIX}`;
  }
}
