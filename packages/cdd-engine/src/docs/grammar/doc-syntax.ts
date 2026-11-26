// packages/cdd-engine/src/docs/grammar/doc-syntax.ts
// The document-syntax rejection: a structural break of a document's OWN grammar (a reserved
// task section declared twice) is a value the judgment face turns into a finding, never a
// bare `Error` a consumer has to interpret.
//
// The type lives in the grammar layer because the grammar is its thrower: the task-block
// parse refuses a duplicated reserved section in the `plan` scope, and the identity parse
// face re-exports the class for the public surface. A type declared beside a reader that
// cannot throw it is a rejection nothing can raise.

/**
 * DocSyntaxError — the document-syntax rejection. The anchored field, the message and the
 * fix all ride the rejection, so the judgment face materializes one finding without
 * re-deriving any of the three from a string.
 */
export class DocSyntaxError extends Error {
  /** The anchored field the break sits on. */
  readonly field: string;
  /** The one-line message — what is structurally wrong. */
  readonly detail: string;
  /** The actionable fix. */
  readonly fix: string;

  constructor(field: string, detail: string, fix: string) {
    super(detail);
    this.name = "DocSyntaxError";
    this.field = field;
    this.detail = detail;
    this.fix = fix;
  }
}
