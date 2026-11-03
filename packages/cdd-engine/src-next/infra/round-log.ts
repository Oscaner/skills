// packages/cdd-engine/src-next/infra/round-log.ts
// P22 T2 — the per-round log file: one append stream per dispatched round, opened
// BEFORE the child spawn and closed after the child exits. The file is the round's
// silent, append-only channel — nothing is echoed to the engine's own stdio face.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import { once } from "node:events";
import { createWriteStream, statSync, type WriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * RoundLog — one round's append-only log file. `create` opens the stream (and creates
 * the `logs/` directory the workspace does not own), `write` appends a chunk,
 * `close` drains the stream and resolves once the file handle is closed. The static
 * observers read the file's size/mtime for the liveness legs; an unreadable path is
 * `null` (an absent observation, never a throw).
 *
 * The channel is an OBSERVATION face: a fault on it (ENOSPC, EIO, a late chunk after
 * close) kills the log leg alone. A standing `error` listener marks the log dead —
 * every later `write` is a silent no-op and the fault is reported ONCE, naming the
 * path — and `close` never rejects, so a round's conclusion is never rewritten by a
 * log that could not be written.
 */
export class RoundLog {
  readonly #path: string;
  readonly #stream: WriteStream;
  readonly #report: (target: string) => void;
  #opened = false;
  #dead = false;
  #closed: Promise<void> | null = null;

  private constructor(target: string, stream: WriteStream, report?: (target: string) => void) {
    this.#path = target;
    this.#stream = stream;
    this.#report = report ?? (() => {});
    stream.on("error", () => this.#fault());
  }

  /** Open a round log at `target`, creating its parent directory (the `logs/` dir
   *  lives here, never in the workspace's own root/slug creation). The resolved
   *  promise means the file exists and is open — zero bytes at spawn time. An open
   *  failure rejects (the caller's creating leg); the `onFault` notice covers the
   *  faults that arrive AFTER the channel is live. */
  static async create(target: string, onFault?: (target: string) => void): Promise<RoundLog> {
    await mkdir(path.dirname(target), { recursive: true });
    const stream = createWriteStream(target, { flags: "a" });
    const log = new RoundLog(target, stream, onFault);
    await once(stream, "open");
    log.#opened = true;
    return log;
  }

  /** The log file's absolute path. */
  get path(): string {
    return this.#path;
  }

  /** Append one chunk — the child's stdout/stderr bytes, never prefixed and never
   *  re-decoded (a chunk boundary must not tear a multi-byte character). A dead log
   *  swallows the chunk: the round it observes keeps running. */
  write(chunk: Buffer | string): void {
    if (this.#dead) return;
    this.#stream.write(chunk);
  }

  /** The file's size in bytes, or null when it cannot be read. */
  static sizeOf(target: string): number | null {
    return RoundLog.#statOf(target)?.size ?? null;
  }

  /** The file's mtime in milliseconds, or null when it cannot be read. */
  static mtimeOf(target: string): number | null {
    return RoundLog.#statOf(target)?.mtimeMs ?? null;
  }

  /** Drain and close the stream — resolves only once the handle is closed, so a read
   *  after this point sees the complete file. Idempotent and NEVER rejecting: a dead
   *  channel must not change the conclusion of the round it was observing. */
  close(): Promise<void> {
    if (this.#closed !== null) return this.#closed;
    this.#closed = this.#stream.destroyed
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          this.#stream.once("close", () => resolve());
          this.#stream.once("error", () => resolve());
          this.#stream.end();
        });
    return this.#closed;
  }

  /** Mark the channel dead and report it once, naming the path. A fault during the
   *  open itself is the creating leg's failure (the reject), never a second notice. */
  #fault(): void {
    if (this.#dead) return;
    this.#dead = true;
    if (this.#opened) this.#report(this.#path);
  }

  /** The file's stat, or null on any read failure (fail-open observation). */
  static #statOf(target: string): { size: number; mtimeMs: number } | null {
    try {
      const statOf = statSync(target);
      return { size: statOf.size, mtimeMs: statOf.mtimeMs };
    } catch {
      return null;
    }
  }
}
