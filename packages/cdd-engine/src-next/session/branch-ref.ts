// packages/cdd-engine/src-next/session/branch-ref.ts
// T26 ⑦ + P4.1 find #10 — the single branch-range identity. A BranchRef holds
// the 8-char shas (base8..head8) of one branch ref and renders every display/name
// surface in short form from ONE decision: the review INPUT_RANGE, the evidence
// file-name spine {base8}..{head8}, the workspace slug. find #10 (user ruling —
// "all commit refs use 8-char short shas, the engine never holds long shas"):
// full 40-char shas are retired engine-wide — the CLI review face validates
// 8-char flags, revParseHead returns `--short=8`, and the carrier stores them.
// The branch ref is DECLARED at one place — `cdd review --type branch --base
// --head` (the range's birth face) — and DERIVED by every other face (fix reads
// the source review handoff's commits; the re-review re-declares because the
// head moved). Zero naked shas slices outside this class.

export class BranchRef {
  readonly base: string;

  readonly head: string;

  constructor(base: string, head: string) {
    this.base = base;
    this.head = head;
  }

  get base8(): string {
    return this.base.slice(0, 8);
  }

  get head8(): string {
    return this.head.slice(0, 8);
  }

  /** The short range — the spine of file names, workspace slugs, INPUT_RANGE. */
  short(): string {
    return `${this.base8}..${this.head8}`;
  }

  /** The command flags — the branch review face's 8-char CLI consumption (find
   *  #10 — 40-char full shas retired engine-wide). */
  args(): string {
    return `--base ${this.base8} --head ${this.head8}`;
  }

  /** The short range of two shas (8-char form) — the string-only call sites. */
  static short(base: string, head: string): string {
    return new BranchRef(base, head).short();
  }

  /** Derive the ref from a review handoff's JSON text — the fix face's single
   *  carrier (the review persisted its reviewed range in `commits`). Malformed /
   *  ref-less → null (the cli gate then names the declaration flags). */
  static fromHandoff(text: string): BranchRef | null {
    try {
      const carried = JSON.parse(text) as {
        commits?: { base?: unknown; head?: unknown };
      };
      if (typeof carried.commits?.base === "string" && typeof carried.commits?.head === "string") {
        return new BranchRef(carried.commits.base, carried.commits.head);
      }
    } catch {
      // malformed → null
    }
    return null;
  }
}
