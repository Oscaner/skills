// packages/cdd-engine/src-next/session/branch-ref.ts
// T26 ⑦ — the single branch-range identity. A BranchRef holds the full shas
// (base..head) of one branch ref and renders every display/name surface in short
// form from ONE decision (base7..head7): the review INPUT_RANGE, the evidence
// file-name spine {base7}..{head7}, the workspace slug. The only full-form
// consumer is the CLI review face (40-char validated flags) and the command text
// that feeds it (#resumeOf). The branch ref is DECLARED at one place — `cdd
// review --type branch --base --head` (the range's birth face) — and DERIVED by
// every other face (fix reads the source review handoff's commits; the re-review
// re-declares because the head moved). Zero naked shas slices outside this class.

export class BranchRef {
  readonly base: string;

  readonly head: string;

  constructor(base: string, head: string) {
    this.base = base;
    this.head = head;
  }

  get base7(): string {
    return this.base.slice(0, 7);
  }

  get head7(): string {
    return this.head.slice(0, 7);
  }

  /** The short range — the spine of file names, workspace slugs, INPUT_RANGE. */
  short(): string {
    return `${this.base7}..${this.head7}`;
  }

  /** The full command flags — `cdd review`'s 40-char CLI consumption. */
  args(): string {
    return `--base ${this.base} --head ${this.head}`;
  }

  /** The short range of two full shas — the string-only call sites (zero naked
   *  shas slices outside this class). */
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
