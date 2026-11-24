// packages/cdd-engine/src-next/__tests__/support/memory-fs.ts
// The test-side `DocFs` — an in-memory corpus the caller owns, keyed by absolute path.
// Two contract fixtures need a right domain the test itself writes (P41 T4's
// single-home pairs, P41 T7's charter fixture): both inject this seam, so neither
// judgment reads `docs/kairos/**` on disk. One implementation, one home — a second
// hand-written double would drift from this one on the `list` contract below.
//
// `list` answers the immediate child NAMES under a directory (never paths), the shape
// `DocFs.list` promises, and only the files the corpus actually carries.
//
// Zero module-level bare functions — the class carries the state and its behaviour.

import type { DocFs } from "../../contract/invariants.ts";

/** A memory filesystem seam — the right domain's list/read/exists face, keyed by
 *  absolute path so a case can place its documents in any doc root. */
export class MemoryFs implements DocFs {
  readonly #files: ReadonlyMap<string, string>;

  constructor(files: Readonly<Record<string, string>>) {
    this.#files = new Map(Object.entries(files));
  }

  exists(at: string): boolean {
    return this.#files.has(at);
  }

  read(at: string): string | null {
    return this.#files.get(at) ?? null;
  }

  list(at: string): readonly string[] {
    const prefix = at.endsWith("/") ? at : `${at}/`;
    const names = new Set<string>();
    for (const file of this.#files.keys()) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      if (rest.includes("/")) continue;
      names.add(rest);
    }
    return [...names];
  }
}
