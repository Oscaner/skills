// packages/cdd-engine/src-next/face/preview.ts
// P11 T5 — the `--dry-run` preview renderer (spec §3.3): the read-only next-step
// forecast becomes ONE renderer class instead of a simulated run. The preview states
// the step the next real invocation would dispatch, the artifacts it would write and
// the ledger writes it would record — and nothing else: zero repo writes, no round
// consumed, no child spawned. The retired synthetic dispatch (`() => ({ status:
// "APPROVED", findings: [] })`) is gone with it — a preview never fabricates a
// conclusion, so no `status:` / `next:` line is ever printed.
//
// The renderer reads the assembled scene (the same DispatchScene the lifecycle
// dispatch reads — one scene shape, never a second) and names every artifact through
// RoundNaming (session/round-naming.ts), the ONE naming source the lifecycle's
// write-back and read-back share (T4): the preview and the real dispatch name the
// same files by one rule. The `child:` row is the harness contract's own data
// (face/host.ts) — the host id + the row's invoke argument string — never a
// detection-dependent spawn.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import process from "node:process";
import type { RepoRoot } from "../infra/root.ts";
import type { InFlightState } from "../session/inflight.ts";
import { RoundNaming } from "../session/round-naming.ts";
import type { OpenFrame } from "../session/run.ts";
import type { CliVerb } from "./declare.ts";
import { HOSTS, HostDetect, type HostId } from "./host.ts";
import type { DispatchScene, ProcessEnvLike } from "./lifecycle.ts";
import { Words } from "./words.ts";

/** The preview row's label column width — `  ` + the label padded to this width +
 *  one space places every value at the same column (`would record:` — the longest
 *  label — overflows by its own one character, exactly as the §3.3 block reads). */
const LABEL_WIDTH = 12;

/**
 * Preview — the `--dry-run` read-only preview renderer. One instance renders one
 * invocation's block over the scene the work command already assembled; the host is
 * detected once at construction (the injectable-env adapter over the harness
 * contract's own judgment). Nothing in this class writes, dispatches or records.
 */
export class Preview {
  readonly #scene: DispatchScene;
  /** The round-naming single source (P11 T4) — the same derivations the lifecycle's
   *  write-back and read-back read, so the preview never invents a name. */
  readonly #naming: RoundNaming;
  /** The detected host id ("" when no harness marker matched) — read by the `child:`
   *  row only. */
  readonly #host: HostId | "";
  /** The held-face wording rows (the lock row + the takeover hint) — the SAME rows
   *  the pre-flight gate and the board fill, never a preview-only paraphrase. */
  readonly #words: Words;

  constructor(opts: { scene: DispatchScene; env?: ProcessEnvLike; words?: Words }) {
    this.#scene = opts.scene;
    this.#naming = new RoundNaming(opts.scene.workspace);
    this.#host = HostDetect.detect(opts.env ?? process.env);
    this.#words = opts.words ?? new Words();
  }

  /** The invocation's stdout block — the header plus the five rows (§3.3). Every
   *  path token is repoRoot-relative (D47's ONE shape — the same basis the round
   *  context speaks). No `status:` / `next:` line is emitted: the round's conclusion
   *  is not yet decided (printing one would fabricate it) and the cross-round next
   *  hop belongs to `cdd board <slug>`. */
  render(verb: CliVerb, frame: OpenFrame): readonly string[] {
    const rows: readonly (readonly [string, string])[] = [
      ["step:", this.#stepOf(frame)],
      ["reads:", this.#readsOf(frame)],
      ["would write:", this.#writesOf(frame)],
      ["would record:", this.#recordsOf(frame)],
      ["child:", this.#childOf()],
    ];
    return [
      `cdd ${verb}: preview (no repo changes)`,
      ...rows.map(([label, value]) => `  ${label.padEnd(LABEL_WIDTH)} ${value}`),
    ];
  }

  /** The read-only held block — the in-flight gate REFUSED this dispatch: the preview
   *  renders the gate's own holder facts as a `lock:` row (the dead holder carries the
   *  takeover hint), exits 1 at the caller, and touches nothing: no acquire, no steal,
   *  no release. The `--steal-stale` flag has no write channel here. */
  heldBlock(verb: CliVerb, state: InFlightState): readonly string[] {
    const lines = [`cdd ${verb}: preview (no repo changes)`, `  lock: ${this.#lockValueOf(state)}`];
    if (state.kind === "held" && !state.alive) lines.push(this.#words.inFlightWords().stealable);
    if (state.kind === "corrupt" && state.locked)
      lines.push(this.#words.inFlightWords().corruptLocked);
    return lines;
  }

  /** The `lock:` row's value — the holder's identity facts, the lock-without-record
   *  shape, or the free state (one row, three facts). */
  #lockValueOf(state: InFlightState): string {
    if (state.kind === "held") return this.#words.inFlightLock(state.record);
    if (state.kind === "corrupt") return this.#words.inFlightWords().lockOnly;
    return this.#words.inFlightWords().free;
  }

  /** The next dispatch step's identity — `<phase> round <round> — <target>`, the
   *  target being the wave unit (`wave 1,2`) or the line's own type word. */
  #stepOf(frame: OpenFrame): string {
    return `${frame.phase} round ${frame.round} — ${this.#targetOf(frame)}`;
  }

  /** The step's target word — the wave-unitary unit (the whole ready batch) on the
   *  task face, the line type elsewhere. */
  #targetOf(frame: OpenFrame): string {
    return frame.target.kind === "wave" ? `wave ${frame.target.tasks.join(",")}` : frame.type;
  }

  /** The round's read input — the wave face's brief (the ONE engine-rendered brief
   *  the real dispatch re-extracts from the CURRENT plan; the preview does not render
   *  it, so the row states what that render would produce) and the doc/branch faces'
   *  judged document. */
  #readsOf(frame: OpenFrame): string {
    const base =
      frame.target.kind === "wave"
        ? `${this.#rel(this.#naming.brief(frame.target.tasks.join(",")))} (would re-render from the current plan)`
        : frame.target.kind === "plan" || frame.target.kind === "spec"
          ? this.#rel(frame.target.doc)
          : this.#rel(this.#scene.planPath ?? "");
    return `${base}${this.#orphanSuffix()}`;
  }

  /** The orphan handoff drafts the workspace carries — a draft no recorded round
   *  owns is listed on the `reads:` row (the preview reads it, never touches it). */
  #orphanSuffix(): string {
    const orphans = this.#scene.ledger.orphanHandoffs();
    return orphans.length === 0 ? "" : ` · orphan drafts: ${orphans.join(" · ")}`;
  }

  /** The artifacts the round would write — the frame's prescribed output set (the
   *  handoff carrier, the round report and the evidence rounds' test evidence), named by
   *  the ONE naming source. A slot the frame's family does not consume (a review
   *  round prescribes no evidence file) is dropped, never rendered blank. */
  #writesOf(frame: OpenFrame): string {
    return [
      this.#scene.ledger.handoffPath(this.#naming.op(frame), frame.type, frame.params),
      this.#naming.report(frame),
      this.#naming.evidence(frame),
    ]
      .filter((artifact) => artifact !== "")
      .map((artifact) => this.#rel(artifact))
      .join(" · ");
  }

  /** The ledger writes the round would record — the progress cycle (the frame's OWN
   *  round identity, never a flattened ordinal) plus, on a completed review, the
   *  reviewed-revision write-back. The three legs are `#bookkeep`'s own: the doc line
   *  binds its document's revision, the wave line its RENDERED brief's, and the
   *  branch line binds none (its review judges the live tree). */
  #recordsOf(frame: OpenFrame): string {
    const parts = [`progress.waves["${frame.key}"].rounds.${frame.phase} += [${frame.round}]`];
    if (frame.phase === "review") {
      if (frame.target.kind === "wave") parts.push("reviewedRevision(brief)");
      else if (frame.target.kind === "plan" || frame.target.kind === "spec")
        parts.push("reviewedRevision(doc)");
    }
    return parts.join(" · ");
  }

  /** The child invocation the real run would spawn — `<HostId> <invoke>`: the host
   *  id then the harness row's invoke argument string verbatim (the binary name is a
   *  separate row column and never rides the invoke value). With no host detected the
   *  real run would BLOCK before any spawn — the row states that literal rather than
   *  indexing an absent host row. */
  #childOf(): string {
    if (this.#host === "") return "(no host detected — real run would BLOCK)";
    return `${this.#host} ${HOSTS[this.#host].invoke}`;
  }

  /** The repoRoot-relative form of one path token (D47). The empty value stays
   *  empty — a dropped slot is never rendered as the repo root. */
  #rel(value: string): string {
    return value === "" ? "" : this.#repoRootValue().relativize(value);
  }

  /** The repo-basis value object of this scene — the ONE conversion entry every path
   *  token normalizes through (the workspace root's OWN value object, never
   *  re-wrapped here). */
  #repoRootValue(): RepoRoot {
    return this.#scene.workspace.root.basis;
  }
}
