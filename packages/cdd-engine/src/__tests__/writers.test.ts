// packages/cdd-engine/src/__tests__/writers.test.ts
// The composed process's TWO standard writers, judged on the descriptor they write to.
//
// INVARIANT — the standard stream is written synchronously while the descriptor accepts bytes,
// and a FULL pipe is absorbed by the stream's own queue rather than turned into the command's
// failure. A full pipe is an OS state no test can arrange portably (the buffer is the kernel's,
// and filling it means flooding a real reader), so this case substitutes the ONE call that
// observes it: `node:fs#writeSync`. The writer under test is the composed process's real
// default — `main` with no injected `io` — so the arm below reads the production object rather
// than a copy of it.
//
// The paired arm is the reason the first one is not just "swallow every write error": a
// descriptor answer that is NOT backpressure must still end the command, with its errno on the
// error channel and a failing exit code.

import { describe, expect, it, vi } from "vitest";

/** The substituted descriptor answers — hoisted above the module mock, which vitest lifts
 *  above every import, so the factory can read them. */
const descriptor = vi.hoisted(() => ({
  writeSync: vi.fn<(fd: number, text: string) => number>(),
}));

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  writeSync: (fd: number, text: string) => descriptor.writeSync(fd, text),
}));

const { main } = await import("../bin.ts");

/** The error a descriptor answers when the pipe's reader is slower than the writer. */
const FULL_PIPE = Object.assign(new Error("EAGAIN: resource temporarily unavailable, write"), {
  code: "EAGAIN",
});

/** The error a descriptor answers when the write is genuinely broken (a closed descriptor,
 *  a bad state) — the shape the writer must never absorb. */
const BROKEN = Object.assign(new Error("EBADF: bad file descriptor, write"), { code: "EBADF" });

/** One stream's collected bytes, by spying the process's own writer. */
const capture = (stream: "stdout" | "stderr"): { bytes: string[]; restore: () => void } => {
  const bytes: string[] = [];
  const spy = vi
    .spyOn(process[stream], "write")
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      bytes.push(String(chunk));
      return true;
    });
  return { bytes, restore: () => spy.mockRestore() };
};

describe("the composed process's default writers", () => {
  it("flushes synchronously, then absorbs a full pipe into the stream's own queue", async () => {
    descriptor.writeSync.mockReset();
    // The first row lands synchronously — the `init` progress row's ordering cell.
    descriptor.writeSync.mockImplementationOnce(() => 1);
    // …and the pipe is then full. Every later call would answer the same errno, but the
    // writer must not make it again: a second synchronous attempt after the latch would
    // reorder the buffered tail underneath it.
    descriptor.writeSync.mockImplementationOnce(() => {
      throw FULL_PIPE;
    });
    descriptor.writeSync.mockImplementation(() => {
      throw new Error("the latched writer attempted a second synchronous write");
    });
    const out = capture("stdout");
    try {
      const code = await main(["board", "--help"]);
      expect(code).toBe(0);
      // The tail rode `process.stdout.write`: the run kept its exit code and its bytes never
      // became an internal error.
      expect(out.bytes.join("").length).toBeGreaterThan(0);
      expect(descriptor.writeSync).toHaveBeenCalledTimes(2);
    } finally {
      out.restore();
    }
  });

  it("still ends the command on a write error that is not backpressure", async () => {
    descriptor.writeSync.mockReset();
    descriptor.writeSync.mockImplementation(() => {
      throw BROKEN;
    });
    const err = capture("stderr");
    try {
      const code = await main(["board", "--help"]);
      expect(code).toBe(1);
      expect(err.bytes.join("")).toContain("EBADF");
      // The error channel is the STREAM's writer, never the synchronous one: a writer that
      // reported its own failure through the call that just failed would lose the sentence.
      expect(descriptor.writeSync).toHaveBeenCalledTimes(1);
    } finally {
      err.restore();
    }
  });
});
