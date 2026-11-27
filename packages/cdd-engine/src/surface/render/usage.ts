// packages/cdd-engine/src/surface/render/usage.ts
// The usage face — every misuse byte the command body prints, and the two shapes they take.
//
// INVARIANT — one declared value, one row of the byte table: the members of the usage union
// and the rows of `USAGE_BYTES` are the same set (both are typed against one union, so a
// member without a row does not compile and a row without a member does not either), and no
// shell spells a byte of its own.
//
// The two shapes are not one shape. Judged by the SHAPE, never by what the value lacks:
//   · the usage shape — the command node's own usage line, then `error: <message>`, exit 2.
//     A missing `--tasks`, a missing or extra skeleton target, a `--plan`/`--spec`
//     combination miss, a task the plan does not declare, a pure command taking `--dry-run`,
//     an unreadable or unwritable file and a base conflict all ride it;
//   · the single-line shape — one line, no usage line, no `error:` prefix, exit 2 (the board's
//     two attribution faces and the base artifact's absence) or exit 1 (a work command with
//     no dispatchable frame). Folding these into the usage shape would change two frozen
//     faces at once.
//
// THE USAGE LINE IS INJECTED, never spelled here. The line is the command node's
// `helpInformation()` first line — a value only the command tree can produce — so this file
// takes a `usageLine(commandPath)` face and renders whatever it answers. A literal of that
// line in this file would be the second assembly point of one byte, and a table row that
// spelled it could only ever assert itself.
//
// The translation table (`FAILURE_REASONS`) is the OTHER half: the round layer's declared
// failure values are not usage members — a `read-failure` value carries a coordinate, and the
// base artifact's read answers two of its own variants — so each declared value is translated
// into the member whose row prints its bytes. A value that reached no row would be a silent
// drop; a member that translated from nothing would be a row nobody can reach.
//
// Module-level exports are the types, the two tables and the class — zero bare functions.

import type { BaseRead } from "../../env/workspace/base-artifact.ts";
import type { UsageReason } from "../../run/advance/frame.ts";
import type { Words } from "../words/words.ts";

/** One command's reportable answer: the stream, the bytes and the exit code. */
export interface UsageReport {
  readonly stream: "stdout" | "stderr";
  readonly text: string;
  readonly exitCode: number;
}

/** The usage union's member names, as the one runtime companion of the type. Both
 *  directions are checked at compile time: `satisfies` refuses a name the union does not
 *  declare, and the table below is typed `Record<UsageReason["kind"], …>`, so a member with
 *  no row fails to compile. */
export const USAGE_REASON_KINDS = [
  "missing-tasks",
  "missing-skeleton-target",
  "extra-target",
  "missing-plan-or-spec",
  "unknown-task",
  "dry-run-scope",
  "read-failure",
  "write-failure",
  "base-conflict",
  "board-unmatched",
  "board-unreadable",
  "base-absent",
  "no-frame",
] as const satisfies readonly UsageReason["kind"][];

/** The declared failure values the round layer produces — the translation table's domain.
 *  `kind` collides with the usage union's member names on purpose where the value and the
 *  member are the same fact (`read-failure` · `write-failure`); the two base-read variants
 *  and the document slice's two declared values are their own names. */
export type FailureValue =
  | { readonly kind: "read-failure"; readonly target: string }
  | { readonly kind: "write-failure"; readonly target: string }
  | { readonly kind: "base-conflict"; readonly existing: string }
  | { readonly kind: "absent"; readonly target: string }
  | { readonly kind: "corrupt"; readonly target: string }
  | { readonly kind: "missing-target" }
  | { readonly kind: "extra-target"; readonly target: string };

/** The declared failure values, as the one runtime companion of the type (the translation
 *  table's key set is typed against the union, so both directions are compile-checked). */
export const FAILURE_VALUE_KINDS = [
  "read-failure",
  "write-failure",
  "base-conflict",
  "absent",
  "corrupt",
  "missing-target",
  "extra-target",
] as const satisfies readonly FailureValue["kind"][];

/** The context one row renders with — the command path a message names and the injected
 *  usage line. */
export interface UsageContext {
  /** The command path the caller typed (`implement` · `review --type wave` · `base set`). */
  readonly commandPath: string;
  /** The command node's own first help line — the injected face, never a literal. */
  readonly usageLine: (commandPath: string) => string;
}

/** One byte row: the shape, the exit code, the producer and the message. */
export interface UsageByteRow {
  /** `usage` prepends the injected usage line and the `error: ` anchor; `single` prints the
   *  message alone. */
  readonly shape: "usage" | "single";
  readonly stream: "stderr";
  readonly exitCode: number;
  /** The member's producer landing — `<src-relative module>#<export name>`, two non-empty
   *  parts, so a pin can resolve it. */
  readonly producer: string;
  /** The member's message — the bytes after the shape's own prefix. */
  readonly message: (reason: UsageReason, context: UsageContext) => string;
}

/** The board's missed-target list, as one byte: the items joined by ` and `. */
const missesOf = (misses: readonly { readonly flag: string; readonly target: string }[]): string =>
  misses.map((miss) => `${miss.flag} ${miss.target}`).join(" and ");

/** The one message a `--dry-run` scope refusal prints. */
const DRY_RUN_SCOPE =
  "--dry-run previews the next dispatch step and its expected artifacts — it applies to implement / review / fix / init only";

/** The extra skeleton target's one message. */
const EXTRA_TARGET =
  "cdd schema get: unexpected {target} — the json render takes no target (use --output skeleton <target> to render the scaffold into a document)";

/** THE byte table — one row per usage member, keyed by the member's own name. */
export const USAGE_BYTES: Readonly<Record<UsageReason["kind"], UsageByteRow>> = {
  "missing-tasks": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "run/advance/frame.ts#Frame",
    message: (_reason, context) =>
      `cdd ${context.commandPath} --type wave: missing required --tasks <n|n,n,…>`,
  },
  "missing-skeleton-target": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "docs/index.ts#Documents",
    message: () => "cdd schema get --output skeleton: missing <target>",
  },
  "extra-target": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "docs/index.ts#Documents",
    message: (reason) =>
      EXTRA_TARGET.replace("{target}", reason.kind === "extra-target" ? reason.target : ""),
  },
  "missing-plan-or-spec": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "run/index.ts#Run",
    message: () => "cdd board: pass --plan and/or --spec",
  },
  "unknown-task": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "run/advance/frame.ts#Frame",
    message: (reason) =>
      reason.kind === "unknown-task"
        ? `cdd ${reason.command}: task ${reason.task} not found in the plan`
        : "",
  },
  "dry-run-scope": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "surface/commands/projection.ts#ScopeGuard",
    message: () => DRY_RUN_SCOPE,
  },
  "read-failure": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "env/workspace/workspace.ts#Workspace",
    message: (reason) => `cannot read file: ${reason.kind === "read-failure" ? reason.target : ""}`,
  },
  "write-failure": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "docs/index.ts#Documents",
    message: (reason) =>
      `cannot write file: ${reason.kind === "write-failure" ? reason.target : ""}`,
  },
  "base-conflict": {
    shape: "usage",
    stream: "stderr",
    exitCode: 2,
    producer: "env/workspace/base-artifact.ts#BaseArtifact",
    message: (reason) =>
      `cdd base set: base already set to ${reason.kind === "base-conflict" ? reason.existing : ""} — pass --force to override`,
  },
  "board-unmatched": {
    shape: "single",
    stream: "stderr",
    exitCode: 2,
    producer: "run/advance/frame.ts#Frame",
    message: (reason) =>
      `cdd board: no docs match ${reason.kind === "board-unmatched" ? missesOf(reason.misses) : ""}`,
  },
  "board-unreadable": {
    shape: "single",
    stream: "stderr",
    exitCode: 2,
    producer: "run/index.ts#Run",
    message: (reason) =>
      reason.kind === "board-unreadable"
        ? `cdd board: cannot read ${reason.flag} ${reason.target}`
        : "",
  },
  "base-absent": {
    shape: "single",
    stream: "stderr",
    exitCode: 2,
    producer: "env/workspace/base-artifact.ts#BaseArtifact",
    message: (reason) =>
      `cdd base get: missing or corrupt base artifact at ${reason.kind === "base-absent" ? reason.target : ""}`,
  },
  "no-frame": {
    shape: "single",
    stream: "stderr",
    exitCode: 1,
    producer: "run/index.ts#Run",
    message: (reason) =>
      `cdd ${reason.kind === "no-frame" ? reason.command : ""}: nothing to dispatch — the line holds no open frame`,
  },
};

/** THE translation table — one row per declared failure value, each answering the member
 *  whose byte row prints it. The base artifact's two read variants both land on `base-absent`
 *  (its `at <path>` cell is the value's own `target`), and the document slice's two declared
 *  values land on the two skeleton rows. */
export const FAILURE_REASONS: Readonly<
  Record<FailureValue["kind"], (value: FailureValue) => UsageReason>
> = {
  "read-failure": (value) => ({
    kind: "read-failure",
    target: value.kind === "read-failure" ? value.target : "",
  }),
  "write-failure": (value) => ({
    kind: "write-failure",
    target: value.kind === "write-failure" ? value.target : "",
  }),
  "base-conflict": (value) => ({
    kind: "base-conflict",
    existing: value.kind === "base-conflict" ? value.existing : "",
  }),
  absent: (value) => ({
    kind: "base-absent",
    target: value.kind === "absent" || value.kind === "corrupt" ? value.target : "",
  }),
  corrupt: (value) => ({
    kind: "base-absent",
    target: value.kind === "absent" || value.kind === "corrupt" ? value.target : "",
  }),
  "missing-target": () => ({ kind: "missing-skeleton-target" }),
  "extra-target": (value) => ({
    kind: "extra-target",
    target: value.kind === "extra-target" ? value.target : "",
  }),
};

/** What `report` accepts: a usage value, or one of the declared failure values. */
export type UsageInput = { readonly kind: "usage"; readonly reason: UsageReason } | FailureValue;

/**
 * UsageFace — the usage bytes' ONE carrier. Invariant: one declared value answers one report,
 * and the usage line it prefixes is the injected face's own answer (see the file's header).
 */
export class UsageFace {
  readonly #words: Words;
  readonly #usageLine: (commandPath: string) => string;

  constructor(opts: {
    readonly words: Words;
    readonly usageLine: (commandPath: string) => string;
  }) {
    this.#words = opts.words;
    this.#usageLine = opts.usageLine;
  }

  /** The word table this face renders through — the one instance a caller also hands the
   *  command tree's projection. */
  get words(): Words {
    return this.#words;
  }

  /** The base artifact's read variants, as the translation table names them — one helper so
   *  the two variant kinds stay spelled in one place. */
  static baseReadOf(read: BaseRead): FailureValue {
    return read.kind === "artifact" ? { kind: "missing-target" } : read;
  }

  /** One value's report — the usage member's row, or the member a declared failure value
   *  translates into. */
  report(value: UsageInput, commandPath = ""): UsageReport {
    const reason = value.kind === "usage" ? value.reason : UsageFace.translate(value);
    const row = USAGE_BYTES[reason.kind];
    const context: UsageContext = { commandPath, usageLine: this.#usageLine };
    const message = row.message(reason, context);
    if (row.shape === "single")
      return { stream: row.stream, text: `${message}\n`, exitCode: row.exitCode };
    const usage = this.#usageLine(commandPath);
    const head = usage === "" ? "" : `${usage}\n`;
    return {
      stream: row.stream,
      text: `${head}error: ${message}\n`,
      exitCode: row.exitCode,
    };
  }

  /** A successful command's report — the echoed path and the ONE trailing newline. The
   *  success face rides the same entry so a shell never composes a second stdout byte. */
  confirm(echo: string): UsageReport {
    return { stream: "stdout", text: `${echo}\n`, exitCode: 0 };
  }

  /** The declared failure value's member — through the translation table, which is the only
   *  place a value becomes a member. */
  static translate(value: FailureValue): UsageReason {
    return FAILURE_REASONS[value.kind](value);
  }
}
