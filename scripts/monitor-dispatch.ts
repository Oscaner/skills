#!/usr/bin/env node
// scripts/monitor-dispatch.ts — the dispatch monitor: a DIAGNOSIS, not a gate.
//
// Every dispatch hands a child one prompt through the harness. A malformed assembly has
// happened before with the spawn answering fine while the prompt never arrived — so "the
// spawn succeeded" is not evidence. This tool reads the session log a dispatch leaves behind
// and answers whether the prompt actually landed, and where it broke when it did not. It is
// deliberately NOT wired into `precommit` / `validate`: it judges no tree, and this phase adds
// no judging surface.
//
// THE READ FACE, stated rather than left to the reader: the judge is "this band" — a prompt
// whose first line is `$version <n>` with the version THIS file's `TEMPLATE_PROMPT` declares.
// A prompt from an older band answers `not-applicable`: it is neither `OK` (it is not this
// band's object) nor `MISSING` (its prompt is not "never arrived"), and `MISSING` keeps its
// one meaning only if older bands stop impersonating a red. The same scoping is why rule ③
// judges the version line by EQUALITY rather than presence, and why rule ④'s required set is
// taken from the same band's row table.
//
// THE FOUR RULES, each independently red:
//   ① a record with `type: "message"` and `role: "user"` exists — absent is exactly "the
//      prompt never arrived";
//   ② that record's body is not blank — an empty prompt and "the shell arrived, the round
//      context did not" are two different faults, and the second one belongs to ③;
//   ③ the structure lines are LINES (`$version <n>`, `# CDD dispatch —`, `## Round context`),
//      not a backticked mention in prose;
//   ④ the round context's owed cells are present and the COMPARABLE ones agree.
//
// Rule ④ compares only what the ledger and the workspace can witness: the identity cell
// (`ROLE`, through its one fold), the artifact cells (against `ArtifactIdentity#nameOf` — this
// file keeps no second naming rule), and the path cells. The scenario cells (`WAVE` ·
// `BASE_BRANCH` · `TARGET_TYPE` · `INPUT_WAVE_BRIEF` · `HANDOFF_SCHEMA`) live in
// `DispatchSceneFacts` and never reach the ledger, so they read `not-applicable` — printed,
// never silently green. A cell whose only hitting arm carries a `when` precondition reads
// `not-applicable` for the same reason: its premise is one of `FrameFacts`' two cells, which
// neither the prompt nor the ledger carries.
//
// The REQUIRED SET is derived from this round's mode, never written down here: the row
// families live in `packages/cdd-engine/src/surface/render/templates.ts#TEMPLATE_PROMPT`, and
// a cell declared `requiredOn: NEVER` with `absent: "none"` (the ruling sidecar) is present
// and NOT owed — a hand-copied roster of cell names has already been wrong once by flattening
// that row into "required on the fix faces", which would fail most legal rounds.
//
// Fixtures are synthetic and live in `scripts/__tests__/monitor-dispatch.test.ts`; no fragment
// of a real session is committed — this repository is public and a session file is a whole
// conversation. Zero module-level bare functions: every helper is a `const` arrow.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ArtifactIdentity,
  type ArtifactKind,
} from "../packages/cdd-engine/src/run/ledger/artifacts.ts";
import {
  ROUND_OPS,
  RoundIdentity,
  type RoundOp,
} from "../packages/cdd-engine/src/run/ledger/identity.ts";
import {
  type ContextLine,
  TEMPLATE_PROMPT,
} from "../packages/cdd-engine/src/surface/render/templates.ts";

/** The three verdict words. `not-applicable` is a STATE, not a soft `OK`: it says the prompt
 *  is outside this read face, or that one cell cannot be compared on it. */
export type DispatchVerdict = "OK" | "MISSING" | "not-applicable";

/** The four rules, in the order a dispatch breaks them. */
export type DispatchRule = "record" | "body" | "structure" | "cells";

/** Each rule's own label — a `MISSING` reading always says where it stopped. */
export const RULE_LABELS: Readonly<Record<DispatchRule, string>> = {
  record: "① the user message exists",
  body: "② its body is not blank",
  structure: "③ the structure lines are lines",
  cells: "④ the owed cells are present and the comparable ones agree",
};

/** One cell's printed reading. `not-applicable` carries its reason, so an unjudged cell is
 *  never mistaken for a passing one. */
export interface CellReading {
  readonly token: string;
  readonly state: "present" | "not-applicable";
  readonly detail?: string;
}

/** One session file's whole reading. */
export interface DispatchReading {
  readonly file: string;
  readonly verdict: DispatchVerdict;
  readonly rule: DispatchRule | null;
  readonly detail: string;
  readonly cells: readonly CellReading[];
}

/** The version line, as a line. */
const VERSION_LINE = /^\$version (\d+)$/;

/** The band's own heading, as a line PREFIX (the row's title follows it). */
const DISPATCH_HEADING = "# CDD dispatch —";

/** One round-context cell line: `- \`TOKEN\`: <value>`. */
const CELL_LINE = /^- `([A-Z0-9_]+)`: ?(.*)$/;

/** The token one declared layout line renders, when it renders one at all. */
const TOKEN_IN_LINE = /\{\{([A-Z0-9_]+)\}\}/;

/** The scenario cells — the ones `DispatchSceneFacts` holds and the ledger has no column
 *  for. They read `not-applicable`, named, never silently green. */
const SCENE_HOLES: readonly string[] = [
  "WAVE",
  "BASE_BRANCH",
  "TARGET_TYPE",
  "INPUT_WAVE_BRIEF",
  "HANDOFF_SCHEMA",
];

/** The token → artifact-kind association the dispatch's value assembly makes
 *  (`run/dispatch/values.ts#DispatchValues#compose`: the report, the FINAL carrier the draft
 *  is finalized as, and the evidence file). The NAME itself always comes from
 *  `ArtifactIdentity#nameOf` — this table holds no spelling. */
const ARTIFACT_CELLS: Readonly<Record<string, ArtifactKind>> = {
  OUTPUT_REPORT: "report",
  OUTPUT_HANDOFF: "final",
  OUTPUT_EVIDENCE: "evidence",
};

/** The path cells whose value must name a file the workspace really holds. The brief is
 *  declared `written: "engine"` (the engine lands it), so it is a scenario hole instead. */
const PATH_CELLS: readonly string[] = ["INPUT_PLAN", "INPUT_SPEC", "INPUT_OVERALL"];

/** The two spellings of the workspace directory a dispatch carries. */
const WORKSPACE_CELLS: readonly string[] = ["WORKSPACE_DIR", "WORKSPACE_ID"];

/** The three `not-applicable` reasons a cell can carry. */
const NEVER_OWED = "declared never-required on this row";
const NOT_OWED = "no arm on this row covers the dispatch's target type";
const FRAME_ONLY = "only a frame-fact arm hits, and the prompt carries no frame facts";

/** One laid-out cell and what this dispatch owes it. */
interface CellPlan {
  readonly token: string;
  readonly state: "required" | "not-applicable";
  readonly detail: string;
}

/** One declared arm's hit test. The two `when` preconditions are never read here: an arm that
 *  carries one is never counted as a plain hit. */
const armIsPlainHit = (arm: ContextLine["requiredOn"][number], type: string): boolean =>
  arm.when === undefined &&
  (arm.types === "always" || (arm.types as readonly string[]).includes(type));

/** Whether an arm covers this dispatch's target type at all — the precondition aside. */
const armCoversType = (arm: ContextLine["requiredOn"][number], type: string): boolean =>
  arm.types === "always" || (arm.types as readonly string[]).includes(type);

/** The owed set of one row's layout, derived from the declarations and this dispatch's target
 *  type. Nothing here names a cell: the roster is the table's. */
const planOf = (layout: readonly ContextLine[], type: string): readonly CellPlan[] => {
  const plans: CellPlan[] = [];
  for (const line of layout) {
    const token = TOKEN_IN_LINE.exec(line.line)?.[1];
    if (token === undefined) continue;
    if (line.requiredOn.some((arm) => armIsPlainHit(arm, type))) {
      plans.push({ token, state: "required", detail: "" });
      continue;
    }
    const neverOwed = line.requiredOn.every(
      (arm) => arm.types !== "always" && arm.types.length === 0,
    );
    const covered = line.requiredOn.some((arm) => armCoversType(arm, type));
    const detail = neverOwed ? NEVER_OWED : covered ? FRAME_ONLY : NOT_OWED;
    plans.push({ token, state: "not-applicable", detail });
  }
  return plans;
};

// ---------------------------------------------------------------------------
// the prompt side
// ---------------------------------------------------------------------------

/** The round context zone — the prompt's one dynamic region, read as `token → value`. A
 *  dropped line is simply absent, and its value reads `""`. */
class RoundContext {
  static readonly HEADING = "## Round context";

  readonly #values: ReadonlyMap<string, string>;

  static of(lines: readonly string[]): RoundContext | null {
    const at = lines.indexOf(RoundContext.HEADING);
    if (at === -1) return null;
    const values = new Map<string, string>();
    for (const line of lines.slice(at + 1)) {
      if (line.startsWith("## ")) break;
      const parsed = CELL_LINE.exec(line);
      if (parsed === null) continue;
      values.set(parsed[1] as string, parsed[2] ?? "");
    }
    return new RoundContext(values);
  }

  private constructor(values: ReadonlyMap<string, string>) {
    this.#values = values;
  }

  /** One cell's value; `""` for a dropped line and for a cell the row never declared. */
  valueOf(token: string): string {
    return this.#values.get(token) ?? "";
  }
}

/** One prompt, as the child received it. */
class DispatchPrompt {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  get lines(): readonly string[] {
    return this.text.split("\n");
  }

  /** An empty prompt: the shell arrived and nothing followed it. */
  get blank(): boolean {
    return this.text.trim() === "";
  }

  /** The band's version, or null when the first line is not a version line at all. */
  get bandVersion(): number | null {
    const match = VERSION_LINE.exec(this.lines[0] ?? "");
    return match === null ? null : Number(match[1]);
  }

  get context(): RoundContext | null {
    return RoundContext.of(this.lines);
  }

  /** The structure lines this prompt lacks, each named as the line it should be. The version
   *  line is judged by EQUALITY with THIS band's version. */
  structureMissing(version: number): readonly string[] {
    const lines = this.lines;
    const missing: string[] = [];
    if (!lines.some((line) => line.startsWith(DISPATCH_HEADING))) missing.push(DISPATCH_HEADING);
    if (!lines.includes(RoundContext.HEADING)) missing.push(RoundContext.HEADING);
    if (this.bandVersion !== version) missing.push(`$version ${version}`);
    return missing;
  }
}

/** A session log's records — the harness's own jsonl face. */
export class SessionLog {
  readonly #records: readonly unknown[];

  static of(text: string): SessionLog {
    const records: unknown[] = [];
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      try {
        records.push(JSON.parse(line) as unknown);
      } catch {
        // A truncated tail line is not a record: the appended log may end mid-write.
      }
    }
    return new SessionLog(records);
  }

  static read(file: string): SessionLog {
    return SessionLog.of(readFileSync(file, "utf8"));
  }

  private constructor(records: readonly unknown[]) {
    this.#records = records;
  }

  /** The dispatch prompt this log carries, or null when no user message exists. A harness that
   *  prepends its own bootstrap to the first user turn still reads: the record carrying the
   *  band's heading is the dispatch, and when NO record carries it the first user record is
   *  what rule ③ judges — so a prompt whose heading was mangled stays red. */
  userPrompt(): string | null {
    const texts = this.#records.filter(isUserMessage).map(textOfMessage);
    return texts.find((text) => text.includes(DISPATCH_HEADING)) ?? texts[0] ?? null;
  }
}

/** Whether one record is a user message. */
const isUserMessage = (record: unknown): boolean => {
  const shaped = record as { type?: unknown; message?: { role?: unknown } } | null;
  return shaped?.type === "message" && shaped.message?.role === "user";
};

/** One message record's body — a plain string, or the harness's text parts joined. */
const textOfMessage = (record: unknown): string => {
  const content = (record as { message?: { content?: unknown } } | null)?.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      const shaped = part as { type?: unknown; text?: unknown } | null;
      return shaped?.type === "text" && typeof shaped.text === "string" ? shaped.text : "";
    })
    .join("");
};

// ---------------------------------------------------------------------------
// the ledger side
// ---------------------------------------------------------------------------

/** One recorded round, as the ledger's own row holds it. */
interface LedgerRound {
  readonly op: RoundOp;
  readonly cycle: number;
  readonly attempt: number;
}

/** One row of the ledger document. */
interface LedgerRow {
  readonly wave: string;
  readonly rounds: readonly LedgerRound[];
}

/** The ledger facts rule ④ compares against — the workspace's `progress.json`, or a synthetic
 *  document in a test. An absent document answers the empty set, and the comparison face says
 *  so instead of inventing a red. */
export class LedgerFacts {
  static readonly FILE = "progress.json";

  readonly #rows: readonly LedgerRow[];
  readonly #source: string;

  /** A synthetic document, in the same shape the workspace file holds. */
  static of(document: unknown, source = "<synthetic>"): LedgerFacts {
    const rows = (document as { waves?: unknown } | null)?.waves;
    return new LedgerFacts(Array.isArray(rows) ? rows.map(rowOf).filter(isRow) : [], source);
  }

  /** The workspace's own document, when there is one. */
  static read(workspaceDir: string, repoRoot: string): LedgerFacts {
    const file = path.resolve(repoRoot, workspaceDir, LedgerFacts.FILE);
    if (!existsSync(file)) return new LedgerFacts([], "no ledger document");
    return LedgerFacts.of(JSON.parse(readFileSync(file, "utf8")) as unknown, file);
  }

  private constructor(rows: readonly LedgerRow[], source: string) {
    this.#rows = rows;
    this.#source = source;
  }

  /** Whether the document exists at all — a missing document has no comparison face. */
  get present(): boolean {
    return this.#source !== "no ledger document";
  }

  get source(): string {
    return this.#source;
  }

  /** The record of one round, keyed by the line's persisted key — never by a second spelling
   *  of the line word. */
  recordOf(round: RoundIdentity): LedgerRound | null {
    const key = RoundIdentity.rowKeyOf(round.line);
    const row = this.#rows.find((candidate) => candidate.wave === key);
    const found = row?.rounds.find(
      (record) =>
        record.op === round.op && record.cycle === round.cycle && record.attempt === round.attempt,
    );
    return found ?? null;
  }

  /** The FIRST record at one coordinate, the OP aside — the identity cell's comparison needs
   *  the recorded op itself, so that face must not filter by it. */
  recordAt(round: RoundIdentity): LedgerRound | null {
    const key = RoundIdentity.rowKeyOf(round.line);
    const row = this.#rows.find((candidate) => candidate.wave === key);
    return (
      row?.rounds.find(
        (record) => record.cycle === round.cycle && record.attempt === round.attempt,
      ) ?? null
    );
  }

  /** The review record that REQUESTED a fix round: same line, same cycle, newest attempt. */
  latestReviewOf(line: string, cycle: number): LedgerRound | null {
    const key = RoundIdentity.rowKeyOf(line);
    const row = this.#rows.find((candidate) => candidate.wave === key);
    const reviews = (row?.rounds ?? []).filter(
      (record) => record.op === "review" && record.cycle === cycle,
    );
    return reviews.reduce<LedgerRound | null>(
      (newest, candidate) =>
        newest === null || candidate.attempt >= newest.attempt ? candidate : newest,
      null,
    );
  }
}

/** One document row, folded to the shape the readers index without a guard. */
const rowOf = (row: unknown): LedgerRow | null => {
  const shaped = row as { wave?: unknown; rounds?: unknown } | null;
  if (typeof shaped?.wave !== "string") return null;
  const rounds = Array.isArray(shaped.rounds) ? shaped.rounds.map(roundOf).filter(isRound) : [];
  return { wave: shaped.wave, rounds };
};

/** One recorded round, or null when the cell set is not a round's. */
const roundOf = (record: unknown): LedgerRound | null => {
  const shaped = record as { op?: unknown; cycle?: unknown; attempt?: unknown } | null;
  if (!ROUND_OPS.includes(shaped?.op as RoundOp)) return null;
  if (typeof shaped?.cycle !== "number" || typeof shaped?.attempt !== "number") return null;
  return { op: shaped.op as RoundOp, cycle: shaped.cycle, attempt: shaped.attempt };
};

const isRow = (row: LedgerRow | null): row is LedgerRow => row !== null;
const isRound = (round: LedgerRound | null): round is LedgerRound => round !== null;

// ---------------------------------------------------------------------------
// rule ④ — the cell face
// ---------------------------------------------------------------------------

/** One comparison's answer. */
interface CellVerdict {
  readonly state: "ok" | "not-applicable" | "mismatch";
  readonly detail: string;
}

const OK: CellVerdict = { state: "ok", detail: "" };
const NOT_APPLICABLE = (detail: string): CellVerdict => ({ state: "not-applicable", detail });
const MISMATCH = (detail: string): CellVerdict => ({ state: "mismatch", detail });

/** One round coordinate, spelled as a human reads it (the identity key's separators aside). */
const coordinateOf = (round: RoundIdentity): string =>
  `${round.line} ${round.op} ${round.cycle}\u00b7a${round.attempt}`;

/** One dispatch's comparable scope: the values, the round its carrier names, and the record
 *  that round left behind. */
interface CellScope {
  readonly values: RoundContext;
  readonly round: RoundIdentity | null;
  readonly ledger: LedgerFacts;
  readonly repoRoot: string;
}

/** The four comparable families. Each answers `ok`, `not-applicable` or `mismatch`; a value no
 *  family claims is `not-applicable` with its own reason (a scene hole). */
class CellComparisons {
  /** One present cell's reading. */
  of(token: string, scope: CellScope): CellVerdict {
    if (SCENE_HOLES.includes(token))
      return NOT_APPLICABLE("a scenario cell the ledger does not hold");
    if (token === "ROLE") return this.#roleOf(scope);
    if (token === "INPUT_REVIEWS") return this.#reviewsOf(scope);
    if (token === "INPUT_RULINGS") return this.#rulingsOf(scope);
    if (token in ARTIFACT_CELLS) return this.#artifactOf(token, scope);
    if (PATH_CELLS.includes(token)) return this.#pathOf(token, scope);
    if (WORKSPACE_CELLS.includes(token)) return this.#workspaceOf(token, scope);
    return NOT_APPLICABLE("no comparable fact declared for this cell");
  }

  /** The identity cell: `ROLE` against the record's `op`, through the ONE fold the engine makes
   *  (`values.ts#roleOf` answers `docs-fix` on a document type where `lifecycle.ts#opOf`
   *  records `fix`, so the two spellings are one cell). */
  #roleOf(scope: CellScope): CellVerdict {
    if (!scope.ledger.present) return NOT_APPLICABLE(scope.ledger.source);
    if (scope.round === null)
      return MISMATCH("the handoff names no round, so no record answers ROLE");
    const record = scope.ledger.recordOf(scope.round) ?? scope.ledger.recordAt(scope.round);
    if (record === null)
      return MISMATCH(`the ledger records no round at ${coordinateOf(scope.round)}`);
    const role = scope.values.valueOf("ROLE");
    const folded = role === "docs-fix" ? "fix" : role;
    return folded === record.op
      ? OK
      : MISMATCH(`ROLE ${role} against a recorded \`${record.op}\` round`);
  }

  /** The requesting carrier: the review record on the same line and cycle, newest attempt,
   *  rendered through the same naming rule. No such record, or a round that is not a fix,
   *  reads `not-applicable` — the cell is owed but names no round of its own. */
  #reviewsOf(scope: CellScope): CellVerdict {
    if (scope.round === null) return NOT_APPLICABLE("the handoff names no round");
    if (!scope.ledger.present) return NOT_APPLICABLE(scope.ledger.source);
    if (scope.round.op !== "fix") return NOT_APPLICABLE("this round requested no review");
    const review = scope.ledger.latestReviewOf(scope.round.line, scope.round.cycle);
    if (review === null) return NOT_APPLICABLE("the ledger records no review on this cycle");
    const expected = ArtifactIdentity.nameOf(
      new RoundIdentity({
        line: scope.round.line,
        op: "review",
        cycle: review.cycle,
        attempt: review.attempt,
      }),
      "final",
    );
    return scope.values.valueOf("INPUT_REVIEWS").endsWith(expected)
      ? OK
      : MISMATCH(`INPUT_REVIEWS against \`${expected}\``);
  }

  /** The ruling sidecar: the literal `none` is the declared `absent: "none"` form and is never
   *  owed, so it reads `not-applicable`; a path compares against the round's own rulings name. */
  #rulingsOf(scope: CellScope): CellVerdict {
    const value = scope.values.valueOf("INPUT_RULINGS");
    if (value === "none")
      return NOT_APPLICABLE("the declared `none` form — the row is present and not owed");
    if (scope.round === null) return NOT_APPLICABLE("the handoff names no round");
    const expected = ArtifactIdentity.nameOf(scope.round, "rulings");
    return value.endsWith(expected) ? OK : MISMATCH(`INPUT_RULINGS against \`${expected}\``);
  }

  /** One artifact cell against `nameOf` for this round and that kind. */
  #artifactOf(token: string, scope: CellScope): CellVerdict {
    if (!scope.ledger.present) return NOT_APPLICABLE(scope.ledger.source);
    if (scope.round === null) {
      return MISMATCH(`${token} names no round: \`${scope.values.valueOf(token)}\``);
    }
    if (scope.ledger.recordOf(scope.round) === null) {
      return MISMATCH(`the ledger records no round at ${coordinateOf(scope.round)}`);
    }
    const expected = ArtifactIdentity.nameOf(scope.round, ARTIFACT_CELLS[token] as ArtifactKind);
    return scope.values.valueOf(token).endsWith(expected)
      ? OK
      : MISMATCH(`${token} against \`${expected}\``);
  }

  /** One document reference: the file must exist on the repository basis. */
  #pathOf(token: string, scope: CellScope): CellVerdict {
    const value = scope.values.valueOf(token);
    return existsSync(path.resolve(scope.repoRoot, value))
      ? OK
      : MISMATCH(`${token} names no file on disk: \`${value}\``);
  }

  /** The workspace's two spellings, compared to each other: one directory, two names. */
  #workspaceOf(token: string, scope: CellScope): CellVerdict {
    const dir = scope.values.valueOf("WORKSPACE_DIR");
    const id = scope.values.valueOf("WORKSPACE_ID");
    if (dir === "" || id === "")
      return MISMATCH(`${token} has no counterpart: \`${dir}\` / \`${id}\``);
    const same = dir === id || path.basename(dir) === id;
    return same ? OK : MISMATCH(`WORKSPACE_DIR \`${dir}\` does not name WORKSPACE_ID \`${id}\``);
  }
}

// ---------------------------------------------------------------------------
// the monitor
// ---------------------------------------------------------------------------

/** One monitor's construction facts. */
export interface DispatchMonitorOptions {
  /** The ledger facts rule ④ compares against. Defaults to the prompt's own workspace. */
  readonly ledger?: LedgerFacts;
  /** The repository basis the path cells resolve on. Defaults to the process cwd. */
  readonly repoRoot?: string;
}

/**
 * DispatchMonitor — one session log in, one reading out. Invariant: every reading is a
 * verdict plus the rule it broke (null when it broke none), and a cell this read face cannot
 * witness reads `not-applicable` rather than passing quietly — so `OK` always means "judged
 * and clean", never "not looked at".
 */
export class DispatchMonitor {
  readonly #ledger: LedgerFacts | null;
  readonly #repoRoot: string;
  readonly #comparisons = new CellComparisons();

  constructor(opts: DispatchMonitorOptions = {}) {
    this.#ledger = opts.ledger ?? null;
    this.#repoRoot = opts.repoRoot ?? process.cwd();
  }

  /** One session file. */
  judgeFile(file: string): DispatchReading {
    return this.judge(SessionLog.read(file), file);
  }

  /** One session log — the test's door, and `judgeFile`'s body. */
  judge(log: SessionLog, file = "<memory>"): DispatchReading {
    const prompt = log.userPrompt();
    if (prompt === null) {
      return blocked(file, "record", `no \`type:"message"\` record with \`role:"user"\``);
    }
    const dispatch = new DispatchPrompt(prompt);
    const version = TEMPLATE_PROMPT.$version;
    if (dispatch.bandVersion !== null && dispatch.bandVersion !== version) {
      return {
        file,
        verdict: "not-applicable",
        rule: null,
        detail: `band $version ${dispatch.bandVersion}`,
        cells: [],
      };
    }
    if (dispatch.blank) return blocked(file, "body", "the user message's body is blank");
    const missing = dispatch.structureMissing(version);
    if (missing.length > 0) {
      return blocked(file, "structure", `missing the line(s): ${missing.join(" · ")}`);
    }
    return this.#judgeCells(file, dispatch);
  }

  /** Rule ④ — the owed set, then the comparable cells over the present ones. */
  #judgeCells(file: string, dispatch: DispatchPrompt): DispatchReading {
    const context = dispatch.context;
    if (context === null) return blocked(file, "structure", "no round context zone");
    const type = context.valueOf("TARGET_TYPE");
    const layout = this.#layoutOf(context, type);
    if (layout === null) {
      return blocked(
        file,
        "cells",
        `ROLE \`${context.valueOf("ROLE")}\` names no declared band row`,
      );
    }
    const ledger =
      this.#ledger ?? LedgerFacts.read(context.valueOf("WORKSPACE_DIR"), this.#repoRoot);
    const scope = {
      values: context,
      round: roundOfValues(context),
      ledger,
      repoRoot: this.#repoRoot,
    };
    const cells: CellReading[] = [];
    const failures: string[] = [];
    for (const plan of planOf(layout, type)) {
      const value = context.valueOf(plan.token);
      if (plan.state === "not-applicable") {
        cells.push({ token: plan.token, state: "not-applicable", detail: plan.detail });
        continue;
      }
      if (value === "") {
        failures.push(`${plan.token} is owed on this row and the prompt does not carry it`);
        cells.push({ token: plan.token, state: "present", detail: "absent" });
        continue;
      }
      const verdict = this.#comparisons.of(plan.token, scope);
      const notApplicable = verdict.state === "not-applicable";
      cells.push({
        token: plan.token,
        state: notApplicable ? "not-applicable" : "present",
        detail: verdict.detail,
      });
      if (verdict.state === "mismatch") failures.push(verdict.detail);
    }
    if (failures.length > 0) {
      return { file, verdict: "MISSING", rule: "cells", detail: failures.join("; "), cells };
    }
    return { file, verdict: "OK", rule: null, detail: `${cells.length} cells read`, cells };
  }

  /** The declared row one dispatch's mode renders, or null when the mode names no row. */
  #layoutOf(context: RoundContext, type: string): readonly ContextLine[] | null {
    const role = context.valueOf("ROLE");
    if (role === "review") {
      const row = TEMPLATE_PROMPT.reviews[type as keyof typeof TEMPLATE_PROMPT.reviews];
      return row?.context ?? null;
    }
    const row = TEMPLATE_PROMPT.modes[role as keyof typeof TEMPLATE_PROMPT.modes];
    return row?.context ?? null;
  }
}

/** The round a prompt's own carrier names, read through the ONE name grammar. */
const roundOfValues = (context: RoundContext): RoundIdentity | null => {
  const handoff = context.valueOf("OUTPUT_HANDOFF");
  if (handoff === "") return null;
  return ArtifactIdentity.attribute(path.basename(handoff))?.round ?? null;
};

/** A reading that stopped at a rule. */
const blocked = (file: string, rule: DispatchRule, detail: string): DispatchReading => ({
  file,
  verdict: "MISSING",
  rule,
  detail,
  cells: [],
});

// ---------------------------------------------------------------------------
// the entry
// ---------------------------------------------------------------------------

/** The harness's own session directory spelling for one repository root. */
const sessionsDirOf = (repoRoot: string): string =>
  path.join(
    homedir(),
    ".pi",
    "agent",
    "sessions",
    `--${repoRoot.replace(/^\//, "").replaceAll("/", "-")}--`,
  );

/** The session files one argument names: a file, or a directory's `.jsonl` children. */
const sessionFilesOf = (target: string): readonly string[] => {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return [target];
  return readdirSync(target)
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
    .map((name) => path.join(target, name));
};

/** One reading's lines — the verdict, the rule it broke, and every cell's state. */
const linesOf = (reading: DispatchReading): readonly string[] => {
  const head =
    reading.rule === null
      ? `${reading.file}: ${reading.verdict}`
      : `${reading.file}: ${reading.verdict} at ${reading.rule} — ${RULE_LABELS[reading.rule]}`;
  const body = reading.detail === "" ? [] : [`    ${reading.detail}`];
  const cells = reading.cells.map(
    (cell) =>
      `    · ${cell.token}: ${cell.state}${cell.detail === undefined || cell.detail === "" ? "" : ` — ${cell.detail}`}`,
  );
  return [head, ...body, ...cells];
};

// biome-ignore lint/complexity/noStaticOnlyClass: the tool's entry face — the dispatch is a static member (zero-bare-function discipline).
export class MonitorCli {
  static main(argv: readonly string[] = process.argv.slice(2)): void {
    const target = argv[0] ?? sessionsDirOf(process.cwd());
    const files = sessionFilesOf(target);
    if (files.length === 0) {
      console.log(`nothing to read at ${target}`);
      return;
    }
    const monitor = new DispatchMonitor();
    const verdicts = new Map<DispatchVerdict, number>();
    for (const file of files) {
      const reading = monitor.judgeFile(file);
      for (const line of linesOf(reading)) console.log(line);
      verdicts.set(reading.verdict, (verdicts.get(reading.verdict) ?? 0) + 1);
    }
    const tally = [...verdicts].map(([verdict, count]) => `${verdict} ${count}`).join(" · ");
    console.log(`\n${tally} · ${files.length} session(s) read`);
  }
}

/** Whether this module is the process entry — a test importing it must not print a report. */
const invokedDirectly = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url);
};

if (invokedDirectly()) MonitorCli.main();
