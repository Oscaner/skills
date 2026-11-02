// packages/cdd-engine/src-next/infra/round-log.ts
// P22 T2 — the per-round log file: one append stream per dispatched round, opened
// BEFORE the child spawn and closed after the child exits. The file is the round's
// silent, append-only channel — nothing is echoed to the engine's own stdio face.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import { createWriteStream, statSync, type WriteStream } from "node:fs";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * RoundLog — one round's append-only log file. `create` opens the stream (and creates
 * the `logs/` directory the workspace does not own), `write` appends a chunk,
 * `close` drains the stream and resolves once the file handle is closed. The static
 * observers read the file's size/mtime for the liveness legs; an unreadable path is
 * `null` (an absent observation, never a throw).
 */
export class RoundLog {
  readonly #path: string;
  readonly #stream: WriteStream;
  #closed: Promise<void> | null = null;

  private constructor(target: string, stream: WriteStream) {
    this.#path = target;
    this.#stream = stream;
  }

  /** Open a round log at `target`, creating its parent directory (the `logs/` dir
   *  lives here, never in the workspace's own root/slug creation). The resolved
   *  promise means the file exists and is open — zero bytes at spawn time. */
  static async create(target: string): Promise<RoundLog> {
    await mkdir(path.dirname(target), { recursive: true });
    const stream = createWriteStream(target, { flags: "a" });
    await once(stream, "open");
    return new RoundLog(target, stream);
  }

  /** The log file's absolute path. */
  get path(): string {
    return this.#path;
  }

  /** Append one chunk — the child's stdout/stderr byte face, never prefixed. */
  write(chunk: string): void {
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
   *  after this point sees the complete file. Idempotent. */
  close(): Promise<void> {
    if (this.#closed === null) {
      this.#closed = new Promise<void>((resolve, reject) => {
        this.#stream.once("close", () => resolve());
        this.#stream.once("error", reject);
        this.#stream.end();
      });
    }
    return this.#closed;
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