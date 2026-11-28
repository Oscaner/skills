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
// the `surface/render/templates.ts` renderer in, and this file names only the reads it uses.
// The row is selected by the record's own `ROLE` / `TARGET_TYPE` cells, and THIS file composes
// the three zones the child reads — the band's fixed prefix, the shared return zone, and the
// row's declared round context — resolving each cell three-state (a value renders the line, an
// empty value drops it or prints the bare literal `none`) and expanding the shell's two slot
// forms (the declared `{{> cl:…}}` clause partials and the record's `{{TOKEN}}` cells). The
// layout and the clauses are the render face's DATA, so no clause sentence and no context line
// is spelled here. A record that names no declared row renders nothing, and nothing is a
// refusal.
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

/** One round-context line, as the render face declares it — the line with its `{{TOKEN}}`
 *  slot, and what an empty value prints (`drop` the line, or the bare literal `none`).
 *  `surface/render/templates.ts#ContextLine` satisfies it structurally. These two cells are the
 *  whole of what this COMPOSITION reads: the declaration's exigibility arms are a gate input
 *  (the station-row producer, `run/advance/reads.ts`, task T17), so this shape stays narrower
 *  than the declaration on purpose — widening it here would hand the composition a judgment it
 *  has no use for. */
export interface PromptBandLine {
  readonly line: string;
  readonly absent: "drop" | "none";
}

/** One band's three declared parts, as the render face hands them over: the fixed prefix (the
 *  version line and the row's shell), the ONE shared return zone, and the row's round-context
 *  layout. The assembly composes the prompt from these; none of them is re-spelled here. */
export interface PromptBandParts {
  readonly fixed: readonly string[];
  readonly returning: readonly string[];
  readonly layout: readonly PromptBandLine[];
}

/** The prompt band read — the injected render face's declared rows, clauses and families
 *  (`surface/render/templates.ts#PromptBandsRenderer` satisfies it). Declared here so the
 *  dispatch segment names no byte and no render implementation. */
export interface PromptBandRead {
  /** The work modes the table declares (`implement` · `fix` · `docs-fix`). */
  modes(): readonly string[];
  /** The target types the review band declares. */
  reviewTypes(): readonly string[];
  /** One declared band's three parts, by family and key. */
  bandOf(family: "work" | "review", key: string): PromptBandParts;
  /** The `{{> cl:…}}` clause partials the shells name. */
  clauses(): Readonly<Record<string, string>>;
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
 *  row, and a record naming no row selects none (the empty render the caller refuses). */
const bandOf = (prompts: PromptBandRead, values: DispatchValuesRecord): PromptBandParts | null => {
  const role = values.ROLE ?? "";
  if (role === "review") {
    const type = values.TARGET_TYPE ?? "";
    return prompts.reviewTypes().includes(type) ? prompts.bandOf("review", type) : null;
  }
  return prompts.modes().includes(role) ? prompts.bandOf("work", role) : null;
};

/** One declared round-context line, resolved three-state: a value renders the line, an empty
 *  one drops it, unless the line declares `none` — then absence is itself the fact and the
 *  bare literal prints in the slot's place. */
const laidOut = (
  layout: readonly PromptBandLine[],
  values: DispatchValuesRecord,
): readonly string[] =>
  layout.flatMap((decl) => {
    const slot = /\{\{([A-Z0-9_]+)\}\}/.exec(decl.line)?.[1];
    if (slot === undefined) return [decl.line];
    if ((values[slot] ?? "") !== "") return [decl.line];
    return decl.absent === "none" ? [decl.line.replace(/\{\{[A-Z0-9_]+\}\}/, "none")] : [];
  });

/** The two slot forms, in ONE pass: a `{{> cl:<key>}}` partial resolves to the clause table's
 *  bytes, a `{{TOKEN}}` slot to the record's own cell. An unresolved spelling stays visible
 *  rather than printing empty — a prompt missing a clause must read as broken, not as done. */
const filled = (
  text: string,
  values: DispatchValuesRecord,
  clauses: Readonly<Record<string, string>>,
): string =>
  text
    .replace(
      /\{\{> cl:([A-Za-z0-9-]+)\}\}/g,
      (whole, name: string) => clauses[`cl:${name}`] ?? whole,
    )
    .replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, name: string) => values[name] ?? whole);

/** The three-zone prompt the child receives — the band's fixed prefix, blank line, the shared
 *  return zone, blank line, the row's declared round context — filled in one pass. */
const promptOf = (
  parts: PromptBandParts,
  values: DispatchValuesRecord,
  clauses: Readonly<Record<string, string>>,
): string => {
  const zones = [
    parts.fixed.join("\n"),
    parts.returning.join("\n"),
    laidOut(parts.layout, values).join("\n"),
  ];
  return filled(zones.join("\n\n"), values, clauses);
};

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
  const parts = bandOf(inputs.prompts, inputs.values);
  const prompt = parts === null ? "" : promptOf(parts, inputs.values, inputs.prompts.clauses());
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
