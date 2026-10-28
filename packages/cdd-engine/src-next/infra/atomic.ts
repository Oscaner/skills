// packages/cdd-engine/src-next/infra/atomic.ts
// The ONE atomic write implementation of the engine (P21 §6.1): every JSON artifact
// the engine persists — progress / crash / handoff / in-flight — rides
// `Workspace.writeJson`, which delegates here. `write-file-atomic` writes a temporary
// sibling and renames it into place (aligning the mode of an existing target), so a
// process killed mid-write leaves the previous whole document, never half a JSON
// body. The seam is one instance method: zero behavior-carrying bare functions.

import writeFileAtomic from "write-file-atomic";

/** The atomic file writer — temp file + rename, through `write-file-atomic`'s synchronous face. */
export class AtomicWriter {
  /** Write `text` to `file` atomically (UTF-8). */
  write(file: string, text: string): void {
    writeFileAtomic.sync(file, text, { encoding: "utf8" });
  }
}
