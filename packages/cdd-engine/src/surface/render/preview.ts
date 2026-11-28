// packages/cdd-engine/src/surface/render/preview.ts
// The `--dry-run` face — three blocks over the values the preview read produced.
//
// INVARIANT — a preview states what the next real invocation would do and nothing else: no
// round is consumed, no brief is landed, no child is spawned, and no conclusion is
// fabricated (a preview has no `status:` line because the round has not been judged).
//
// Three entries, one per `kind` the preview read answers:
//   · the PASS block — the header plus five rows (`step:` · `reads:` · `would write:` ·
//     `would record:` · `child:`). The `checked:` rows a real dispatch prints are NOT in
//     this block: a passing preview reports them on the diagnostic stream, exactly where
//     the real dispatch reports them;
//   · the HELD block — the header, the `lock:` row (holder · unreadable lock · free), the
//     dead holder's takeover hint, the corrupt-lock sentence when the lock is still on
//     disk, then the checked rows at the tail;
//   · the BLOCKED block — the header, the refusal row, the verdict's own detail rows, then
//     the checked rows at the tail. The row's body and details are RENDERED ELSEWHERE (the
//     route face owns both), so a preview can never print a second wording of one refusal.
//
// Every word a block prints is a row of the word table: the lock rows and the two hints are
// the in-flight family's, the labels are this file's column layout, and the checkpoint
// heading with its per-row values is the checked family's. What this file owns is layout
// only.
//
// The pass block's VALUES arrive as facts, never as names this file derives: the read input,
// the paths the round would write and the ledger row it would record all come from the read
// that produced them (`Run#previewOf`). A render face that spelled a carrier name or a
// ledger coordinate would be a second home for the naming rule and the document's row shape.
//
// Module-level exports are the types and the class — zero bare functions.

import { HOSTS } from "../../env/process/host.ts";
import type { FrameFacts } from "../../run/advance/frame.ts";
import type { RouteTarget } from "../../run/advance/target-faces.ts";
import type { RoundPhase } from "../../run/dispatch/child.ts";
import type { InFlightState } from "../../run/dispatch/inflight.ts";
import type { CheckedRow } from "../../run/gate/preflight.ts";
import type { RoundWrite } from "../../run/ledger/ledger.ts";
import type { Words } from "../words/words.ts";
import type { RouteRenderer } from "./route.ts";

/** The preview row's label column — `  ` plus the label padded to this width, so every
 *  value starts at the same column (`would record:` is the longest label). */
const LABEL_WIDTH = 12;

/** The header's one shared tail. */
const HEADER_TAIL = "preview (no repo changes)";

/** The one passing preview's facts — the read's own values plus the orphan drafts the
 *  workspace carries (the `reads:` row's suffix). */
export interface PreviewPass {
  /** The round's frame — the step row, the record's own cells and the write-back leg. */
  readonly frame: FrameFacts;
  /** The dispatch host fact (`""` when no harness marker matched). */
  readonly host: string;
  /** The round's read input, on the repo-relative basis (`""` off the task face). */
  readonly brief: string;
  /** The paths the round would write, repo-relative, in the naming rule's order — the
   *  draft, the report and (where one is prescribed) the test-evidence file. */
  readonly writes: readonly string[];
  /** The ledger write the round would land. */
  readonly ledger: RoundWrite;
  /** The workspace names no recorded round claims. */
  readonly orphans?: readonly string[];
}

/**
 * Preview — the dry-run face's three blocks. Invariant: one value renders one block, and no
 * block writes, dispatches or records (see the file's header).
 */
export class Preview {
  readonly #words: Words;
  readonly #route: RouteRenderer;

  constructor(words: Words, route: RouteRenderer) {
    this.#words = words;
    this.#route = route;
  }

  /** The passing block — the header plus the five rows, and nothing else. */
  passBlock(pass: PreviewPass): readonly string[] {
    const frame = pass.frame;
    const rows: readonly (readonly [string, string])[] = [
      ["step:", this.#stepOf(frame)],
      ["reads:", `${this.#readsOf(frame, pass.brief)}${this.#orphanSuffix(pass.orphans ?? [])}`],
      ["would write:", this.#writesOf(pass.writes)],
      ["would record:", this.#recordsOf(frame, pass.ledger)],
      ["child:", this.#childOf(pass.host)],
    ];
    return [
      this.#header(frame.command),
      ...rows.map(([label, value]) => `  ${label.padEnd(LABEL_WIDTH)} ${value}`),
    ];
  }

  /** The held block — the lock row, the two hints, then the checked rows at the tail. */
  heldBlock(verb: string, state: InFlightState, checked: readonly CheckedRow[]): readonly string[] {
    const rows = [this.#header(verb), `  lock: ${this.#lockValueOf(state)}`];
    if (state.kind === "held" && !state.alive) {
      rows.push(this.#words.inFlightTakeoverHint(state.targetGone));
    }
    if (state.kind === "corrupt" && state.locked)
      rows.push(this.#words.inFlightWords().corruptLocked);
    return [...rows, ...this.#route.checkedBlock(checked)];
  }

  /** The blocked block — the refusal row, the verdict's detail rows, then the checked rows.
   *  `body` and `details` arrive from the route face, which owns both. */
  blockedBlock(
    verb: string,
    body: string,
    details: readonly string[],
    checked: readonly CheckedRow[],
  ): readonly string[] {
    const row = this.#words.refusalWords();
    return [
      this.#header(verb),
      `  ${row.token}${row.gap}${body}`,
      ...details,
      ...this.#route.checkedBlock(checked),
    ];
  }

  /** The block header — `cdd <verb>: preview (no repo changes)`. */
  #header(verb: string): string {
    return `cdd ${verb}: ${HEADER_TAIL}`;
  }

  /** The `lock:` row's value — the holder's identity, the lock-without-record shape, or the
   *  free sentence (one row, three facts). */
  #lockValueOf(state: InFlightState): string {
    const inFlight = this.#words.inFlightWords();
    if (state.kind === "held") return this.#words.inFlightLock(state.record);
    if (state.kind === "corrupt") return inFlight.lockOnly;
    return inFlight.free;
  }

  /** The next step's identity — `<phase> round <round> — <target>`. */
  #stepOf(frame: FrameFacts): string {
    return `${frame.phase} round ${frame.round} — ${Preview.#targetOf(frame)}`;
  }

  /** The step's target word — the wave's task group on the task face, the line's type
   *  word everywhere else. */
  static #targetOf(frame: FrameFacts): string {
    return frame.target?.type === "wave" ? `wave ${frame.target.id}` : frame.type;
  }

  /** Whether a target names a document (the four document faces; the branch line names the
   *  plan instead, and the wave line names a task group). */
  static #isDocTarget(target: RouteTarget | null): boolean {
    if (target === null) return false;
    return target.type !== "wave" && target.type !== "branch";
  }

  /** The round's read input — the brief a wave dispatch re-renders from the current plan,
   *  or the document the round judges. */
  #readsOf(frame: FrameFacts, brief: string): string {
    if (frame.target?.type === "wave") return `${brief} (would re-render from the current plan)`;
    if (Preview.#isDocTarget(frame.target)) return frame.doc ?? "";
    return frame.planPath ?? "";
  }

  /** The orphan draft suffix of the `reads:` row — zero bytes when there is none. */
  #orphanSuffix(orphans: readonly string[]): string {
    if (orphans.length === 0) return "";
    return `${this.#words.boardWords().reads.orphanDrafts}${orphans.join(this.#words.boardWords().reads.join)}`;
  }

  /** The artifacts the round would write — the paths the read handed over, joined in the
   *  order it named them. */
  #writesOf(writes: readonly string[]): string {
    return writes.join(" · ");
  }

  /** The ledger writes the round would record — the row the read named, the round's own
   *  coordinate, plus the leg a completed round binds (a wave line its brief projection, a
   *  document line its document, the branch line its plan). */
  #recordsOf(frame: FrameFacts, ledger: RoundWrite): string {
    const parts = [
      `${ledger.row}.rounds += { op: ${ledger.op}, cycle: ${frame.round}, attempt: ${frame.attempt} }`,
    ];
    const leg = Preview.#reviewedLegOf(frame.phase, frame.target?.type ?? null);
    if (leg !== null) parts.push(leg);
    return parts.join(" · ");
  }

  /** The write-back leg one phase binds — or none. */
  static #reviewedLegOf(phase: RoundPhase, kind: string | null): string | null {
    if (phase !== "review" && phase !== "branch-review" && phase !== "fix") return null;
    if (kind === "wave") return "reviewedRevision(brief)";
    if (kind === "plan" || kind === "phase-spec" || kind === "single-spec" || kind === "overall")
      return "reviewedRevision(doc)";
    if (kind === "branch") return "reviewedRevision(doc)";
    return null;
  }

  /** The child invocation the real run would spawn — `<host> <invoke>`. A host-less tree
   *  never reaches a forecast (the gate refuses that dispatch first), so the row reads the
   *  host table directly. */
  #childOf(host: string): string {
    if (host === "") return "";
    const row = HOSTS[host as keyof typeof HOSTS];
    return row === undefined ? "" : `${host} ${row.invoke}`;
  }
}
