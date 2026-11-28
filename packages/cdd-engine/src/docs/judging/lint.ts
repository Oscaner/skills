// packages/cdd-engine/src/docs/judging/lint.ts
// The reference lint — the WARN observation face. It runs at the dispatch gate beside the
// judgment and is NEVER part of it: a warning never refuses a round, and forcing one changes
// no finding count.
//
// The reference vocabulary it applies is the derived projection (`Projector.reference()`, the
// per-element reference rows) — zero self-copied reference patterns. The lint consumes the
// SAME parse context the judgment built (parse once, reuse everywhere), so its observations are
// anchored on the parsed task blocks, never a re-scan of raw text.
//
// The WARN families (plan only):
//   · missing-edge suspect — a backward `Task N` / `T<N>` prose reference inside a task's
//     Objective / Acceptance value that has no matching `DependsOn` declaration. The graph's
//     edge classes never fire here: unregistered targets (`missing-id`) and self-edges
//     (`self-loop`) stay silent — a suspect is always an existing task with a lower id whose
//     edge was simply not declared (forward references are legal).
//   · numbering advisory — a declared dependency on a higher-numbered task (legal, but the
//     numbering no longer follows the topological reading order).
//   · transitive advisory — a declared dependency already reachable through another declared
//     dependency (inert for the wave derivation, but it clutters the graph).
//
// Module-level exports are the type and the class — zero behaviour-carrying bare functions.

import type { RepoPath } from "../../env/paths/root.ts";
import { TaskBlocks } from "../grammar/task-blocks.ts";
import type { TaskBlock } from "../grammar/types.ts";
import type { PlanParsed } from "../identity/doc-parse.ts";
import type { ReferenceEntry, ReferenceProjection } from "../identity/project.ts";
import { Projector } from "../identity/project.ts";
import { declaredRegistries } from "../identity/registry.ts";
import type { JudgeContext } from "./invariants.ts";

/** One reference-lint warning — a WARN-only observation, never a judge finding. */
export interface Warn {
  /** The doc coordinate the warning refers to. */
  path: RepoPath;
  /** The anchored surface the warning anchors to (a `Task N` block or a field name). */
  field: string;
  /** The one-line warning message — what the observation suspects. */
  message: string;
  /** The actionable fix. */
  fix: string;
  /** The lint family that produced the warning. */
  kind: "reference-lint";
}

/**
 * LintPass — the WARN observation face over the derived reference vocabulary. Invariant: every
 * reference pattern it applies is read from the projection and every edge it reads is the
 * grammar's own `DependsOn` normalization, so a warning can never disagree with the judgment
 * about the same plan.
 */
export class LintPass {
  /** The derived reference vocabulary — the single source the lint applies. */
  readonly #reference: ReferenceProjection;
  /** The derived `Task prose reference` token pattern (global — matchAll over prose lines). */
  readonly #proseToken: RegExp;
  /** The prose-owning task sections of the plan — the scanning-semantics surface (the reader's
   *  field keys; the declared anchors are the `#### Key` headings). */
  readonly #proseFields: readonly string[] = ["Objective", "Acceptance"];

  constructor() {
    this.#reference = new Projector(declaredRegistries).reference();
    const planEntries = this.#reference.plan.entries;
    this.#proseToken = new RegExp(
      `${LintPass.#valuePatternOf(planEntries, "Task prose reference")}`,
      "g",
    );
    for (const key of this.#proseFields) {
      LintPass.#valuePatternOf(planEntries, `#### ${key}`);
    }
  }

  /** run — the single observation entry: one Warn per offending surface. */
  run(ctx: JudgeContext): readonly Warn[] {
    if (ctx.parsed.docType !== "plan") return [];
    const warns: Warn[] = [];
    // One block parse for the three families: the grammar's `DependsOn` read and the parsed
    // task records come from the SAME tree, so a family never re-reads the document.
    const blocks = TaskBlocks.of(ctx.tree);
    warns.push(...this.#missingEdgeWarns(ctx, ctx.parsed, blocks));
    warns.push(...this.#numberingAdvisories(ctx, ctx.parsed, blocks));
    warns.push(...this.#transitiveAdvisories(ctx, ctx.parsed, blocks));
    return warns;
  }

  // -------------------------------------------------------------------------
  // the missing-edge suspect scan
  // -------------------------------------------------------------------------

  /** One WARN per task block whose prose references an existing lower task with no edge. */
  #missingEdgeWarns(ctx: JudgeContext, parsed: PlanParsed, blocks: TaskBlocks): Warn[] {
    const warns: Warn[] = [];
    const registered = new Set(parsed.taskBlocks.map((block) => block.id));
    for (const block of parsed.taskBlocks) {
      const declared = LintPass.#declaredEdgesOf(block, blocks);
      const suspects = this.#suspectRefsOf(block, declared, registered);
      if (suspects.length === 0) continue;
      const list = suspects.map((id) => `Task ${id}`).join(" and ");
      warns.push({
        path: ctx.path,
        field: `Task ${block.id}`,
        message: `task ${block.id} prose-references ${list} with no matching **DependsOn** declaration — a suspected missing edge (WARN: the author's intent is authoritative, never a gate)`,
        fix: `declare the edge in the block's **DependsOn** line, or treat the reference as prose (task ${list})`,
        kind: "reference-lint",
      });
    }
    return warns;
  }

  /** One WARN per forward reference (a dep on a higher-numbered task) — the numbering
   *  read-order advisory. */
  #numberingAdvisories(ctx: JudgeContext, parsed: PlanParsed, blocks: TaskBlocks): Warn[] {
    const warns: Warn[] = [];
    for (const block of parsed.taskBlocks) {
      for (const dep of LintPass.#declaredEdgesOf(block, blocks)) {
        if (dep <= block.id) continue;
        warns.push({
          path: ctx.path,
          field: `Task ${block.id}`,
          message: `task ${block.id} depends on the higher-numbered Task ${dep} — legal (forward references), but the numbering no longer follows the topological reading order; consider renumbering (advisory only)`,
          fix: "renumber the pair for a linear reading order, or keep the forward dependency — the engine derives waves from **DependsOn** alone",
          kind: "reference-lint",
        });
      }
    }
    return warns;
  }

  /** One WARN per transitively-redundant declaration (a dep reachable from another declared
   *  dep) — the direct-only advisory. */
  #transitiveAdvisories(ctx: JudgeContext, parsed: PlanParsed, blocks: TaskBlocks): Warn[] {
    const warns: Warn[] = [];
    const declared = new Map<number, Set<number>>();
    for (const block of parsed.taskBlocks) {
      declared.set(block.id, LintPass.#declaredEdgesOf(block, blocks));
    }
    const reachOf = (from: number): Set<number> => {
      const seen = new Set<number>();
      const stack = [...(declared.get(from) ?? [])];
      while (stack.length > 0) {
        const current = stack.pop() as number;
        if (seen.has(current)) continue;
        seen.add(current);
        stack.push(...(declared.get(current) ?? []));
      }
      return seen;
    };
    const reach = new Map<number, Set<number>>();
    for (const id of declared.keys()) reach.set(id, reachOf(id));
    for (const block of parsed.taskBlocks) {
      for (const dep of declared.get(block.id) ?? []) {
        const redundantVia = [...(declared.get(block.id) ?? [])].find(
          (other) => other !== dep && (reach.get(other) ?? new Set()).has(dep),
        );
        if (redundantVia === undefined) continue;
        warns.push({
          path: ctx.path,
          field: `Task ${block.id}`,
          message: `task ${block.id} depends on Task ${dep}, already reachable via declared dependency Task ${redundantVia} — declare direct prerequisites only (advisory: redundant edges are inert for the wave derivation, but clutter the graph)`,
          fix: `drop ${dep} from the block's **DependsOn** (or keep it — the engine reduces the display, the closure is unchanged)`,
          kind: "reference-lint",
        });
      }
    }
    return warns;
  }

  // -------------------------------------------------------------------------
  // construction helpers
  // -------------------------------------------------------------------------

  /** The block's declared edge ids — the grammar's own `DependsOn` read, so the lint and the
   *  graph can never disagree about which edges a block declares. */
  static #declaredEdgesOf(block: TaskBlock, blocks: TaskBlocks): Set<number> {
    return new Set(blocks.dependsOnOf(block));
  }

  /** The backward prose references of a block that exist, are undeclared and are not a
   *  code-span citation — the missing-edge suspects. */
  #suspectRefsOf(
    block: TaskBlock,
    declared: ReadonlySet<number>,
    registered: ReadonlySet<number>,
  ): number[] {
    const suspects: number[] = [];
    const seenId = new Set<number>();
    for (const section of block.sections) {
      if (!this.#proseFields.includes(section.key)) continue;
      for (const line of section.lines) {
        const prose = LintPass.#withoutCodeSpans(line);
        for (const match of prose.matchAll(this.#proseToken)) {
          const id = Number(match[1]);
          if (id >= block.id) continue; // forward / self — undeclareable, never a suspect
          if (!registered.has(id)) continue; // missing-id — the graph's class, never a suspect
          if (declared.has(id) || seenId.has(id)) continue;
          seenId.add(id);
          suspects.push(id);
        }
      }
    }
    return suspects.sort((left, right) => left - right);
  }

  /** The line with its backtick-delimited inline code spans removed (a span cites a symbol,
   *  never prose). */
  static #withoutCodeSpans(line: string): string {
    return line.replace(/`+[^`\n]*`+/g, "");
  }

  /** The value pattern of a registered reference entry — a lookup that fails loudly when the
   *  declaration renames an anchor the lint consumes. */
  static #valuePatternOf(entries: readonly ReferenceEntry[], anchor: string): string {
    const entry = entries.find((row) => row.anchor === anchor);
    if (entry === undefined) {
      throw new Error(`reference-lint requires the registered reference entry "${anchor}"`);
    }
    return entry.valuePattern ?? "";
  }
}
