// packages/cdd-engine/src/run/dispatch/frame-assembly.ts
// One dispatch's frame, assembled from declared inputs — and refused when its prompt is empty.
//
// INVARIANT — the child receives ITS task: the rendered prompt enters the argv as exactly ONE
// positional, and an empty render never becomes a spawn. "The spawn succeeded" is not the
// evidence a dispatch worked; "the child received a task it can execute" is. The failure this
// invariant was written from is a round that spawned cleanly, exited cleanly and had no prompt
// at all — the harness then inventoried the whole spec and plan on its own.
//
// Every value the frame carries has an OWNER named in the input object, and this file derives
// none of them: the template values ride the pre-frame assembly (`DispatchValues`), the host
// rides the one detection probe, the spawn directory rides the path basis, and the log's two
// spellings ride the workspace. The frame itself carries only the two cells this assembly reads
// (`phase`, `type`), so a `FrameFacts` satisfies the cell structurally — and the segment keeps
// its boundary: nothing here reaches `run/advance` (the frontier) or `surface` (the bytes).
//
// The prompt band and the two bytes it is joined from belong to the render face, so they arrive
// as an injected READ (the same convention the brief face follows): the composition root hands
// the `surface/render/templates.ts` renderer in, and this file names only the four reads it
// uses. The row is selected by the record's own `ROLE` / `TARGET_TYPE` cells, and the assembly
// only fills the `{{TOKEN}}` slots that record carries — the expansion the prompt table
// delegates to the dispatch input. A record that names no declared row renders nothing, and
// nothing is a refusal.
//
// The host difference is DATA: the command, the invoke prefix, the prompt form and the child env
// are four columns of the harness contract, so the only branch here is "which host row", and the
// slash-ref prefix is resolved from the dispatch table plus the per-host reference table rather
// than spelled.
//
// Module-level exports are the declared types and the two compositions (the frame assembly and
// the one-positional prompt form) — zero behaviour-carrying bare functions.

import type { TargetType } from "../../docs/identity/types.ts";
import type { RepoPath } from "../../env/paths/root.ts";
import { DISPATCH, HOSTS, type HostId, type PromptForm, REFS } from "../../env/process/host.ts";
import type { DispatchFrame, DispatchLog, RoundPhase } from "./child.ts";

/** One round-context record — the flat `string` record the pre-frame assembly composes
 *  (`run/dispatch/values.ts#DispatchValues`). */
export type DispatchValuesRecord = Readonly<Record<string, string>>;

/** The frame cells this assembly reads, and the only ones it may: the round's phase (the
 *  dispatch cell) and its target type (which column of the dispatch table applies). A
 *  `run/advance/frame.ts#FrameFacts` satisfies this shape structurally, so the segment never
 *  imports the frontier it is handed. */
export interface DispatchFrameSource {
  /** The dispatch phase this frame runs. */
  readonly phase: RoundPhase;
  /** The target type the round was asked for. */
  readonly type: TargetType;
}

/** The prompt band read — the injected render face's four reads, one per declared prompt
 *  family (`surface/render/templates.ts#PromptBandsRenderer` satisfies it). Declared here so
 *  the dispatch segment names no byte and no render implementation. */
export interface PromptBandRead {
  /** The work modes the table declares (`implement` · `fix` · `docs-fix`). */
  modes(): readonly string[];
  /** One work mode's band. */
  prompt(mode: string): string;
  /** The target types the review band declares. */
  reviewTypes(): readonly string[];
  /** One review target's band. */
  review(type: string): string;
}

/** The declared inputs of one assembly. Every cell names its supplier and none is derived from
 *  another: the frame knows no host, no template value and no log coordinate. */
export interface DispatchAssembly {
  /** The round's own facts — the phase comes from here, and the target type with it. */
  readonly frame: DispatchFrameSource;
  /** The brief's repo-relative path, as the dispatch face handed it back at landing time. */
  readonly briefPath: RepoPath;
  /** The template render's ONLY value input — the round-context record. */
  readonly values: DispatchValuesRecord;
  /** The prompt band's renderer, injected by the composition root (the render face's own
   *  instance, never a second one built here). */
  readonly prompts: PromptBandRead;
  /** The host the one detection probe read; a dispatch without a host is refused upstream, so
   *  a dispatch always has one. */
  readonly host: HostId;
  /** The spawn directory — the path basis' absolute root (the tree leg's scan root). */
  readonly cwd: string;
  /** The round log's two spellings of one file — the workspace's coordinate and its absolute
   *  open point. */
  readonly log: DispatchLog;
}

/** What one assembly answers: the frame to hand the child, or the refusal of an empty render
 *  (the brief whose bytes the round was measured against still rides the value). */
export type DispatchAssemblyOutcome =
  | { readonly kind: "frame"; readonly frame: DispatchFrame }
  | { readonly kind: "empty-prompt"; readonly briefPath: RepoPath };

/** One round's prompt band: the record's own `ROLE` / `TARGET_TYPE` cells select the declared
 *  row, and a record naming no row renders nothing (the empty render the caller refuses). */
const bandOf = (prompts: PromptBandRead, values: DispatchValuesRecord): string => {
  const role = values.ROLE ?? "";
  if (role === "review") {
    const type = values.TARGET_TYPE ?? "";
    return prompts.reviewTypes().includes(type) ? prompts.review(type) : "";
  }
  return prompts.modes().includes(role) ? prompts.prompt(role) : "";
};

/** The band with its `{{TOKEN}}` slots filled from the record — a slot the record does not
 *  carry keeps its spelling, so an unfilled token stays visible instead of printing empty. A
 *  clause slot (`{{> cl:…}}`) is not a value slot: it expands from the clause declaration the
 *  prompt data carries, never from this record, so this fill leaves it alone. */
const filledBand = (band: string, values: DispatchValuesRecord): string =>
  band.replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, name: string) => values[name] ?? whole);

/** The dispatch slot of one frame — the review faces read the phase/type row of the dispatch
 *  table, the implement face reads its single string slot, and the fix face plus the spec /
 *  plan reviews carry none (their discipline rides the prompt body). */
const dispatchSlotOf = (frame: DispatchFrameSource): string | null => {
  if (frame.phase === "implement") return DISPATCH.implement;
  if (frame.phase === "review" || frame.phase === "branch-review") {
    const rows: Readonly<Record<string, { readonly ref: string }>> = DISPATCH.review;
    return rows[frame.type]?.ref ?? null;
  }
  return null;
};

/** The frame's skill-ref in the host's own slash form, or null when the frame resolves no slot
 *  (no slot, no prefix — never a guessed reference). */
const skillRefOf = (host: HostId, frame: DispatchFrameSource): string | null => {
  const slot = dispatchSlotOf(frame);
  if (slot === null) return null;
  return REFS[slot]?.[host] ?? null;
};

/** The child's single prompt argument, per the host's `promptForm` column: the ref-prefixed form
 *  carries the slash ref at the head of the one positional, the plain form hands the prompt over
 *  verbatim. Both declared values are exercised by the colocated pin — the form is a column, not
 *  a constant of this file. */
export const childPromptOf = (form: PromptForm, ref: string | null, prompt: string): string =>
  form === "ref-prefixed" && ref !== null ? `${ref} ${prompt}` : prompt;

/**
 * Assemble one dispatch's frame from its declared inputs. Invariant: exactly one rendered prompt
 * enters the argv, and an empty render answers the refusal instead of a frame (see the file's
 * header).
 */
export const assembleDispatchFrame = (inputs: DispatchAssembly): DispatchAssemblyOutcome => {
  const prompt = filledBand(bandOf(inputs.prompts, inputs.values), inputs.values);
  if (prompt.trim().length === 0) return { kind: "empty-prompt", briefPath: inputs.briefPath };
  const row = HOSTS[inputs.host];
  const invokePrefix = row.invoke.split(" ").filter((part) => part.length > 0);
  const positional = childPromptOf(row.promptForm, skillRefOf(inputs.host, inputs.frame), prompt);
  return {
    kind: "frame",
    frame: {
      command: row.cli,
      args: [...invokePrefix, positional],
      env: row.env,
      phase: inputs.frame.phase,
      cwd: inputs.cwd,
      log: inputs.log,
    },
  };
};
