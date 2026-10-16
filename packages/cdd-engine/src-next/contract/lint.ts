// packages/cdd-engine/src-next/contract/lint.ts
// T5 — the reference lint WARN pass (design spec §2.3): an independent observation
// face that runs at the dispatch gate, never part of the judgment definition.
// The reference vocabulary it applies is the derived projection (project.ts —
// `Projector.reference()`, the per-element reference rows) — zero self-copied
// reference patterns. The lint consumes the SAME doc.ts parse record the dispatch
// and the graph read (parse once, reuse everywhere), so its observations are
// anchored on the parsed task blocks and the chain root, never a re-scan of raw
// text.
//
// The WARN families:
//   · missing-edge suspect (plan) — a backward `Task N` / `T<N>` prose reference
//     inside a task's Objective/Acceptance value that has no matching
//     `- **DependsOn**:` declaration. The graph's edge classes never fire here:
//     unregistered targets (missing-id) and self-edges (self-loop) stay silent —
//     a suspect is always an existing task with a lower id whose edge was simply
//     not declared (forward references are legal — no contradiction class).
//   · cross-doc label drift (plan / phase-spec) — the Class-B `**Parent
//     program**` link whose label (version tokens stripped) drifts from the
//     target's basename. The Class-A `**Spec:**` drift is the cross-doc-chain
//     invariant's BLOCK, never re-observed here.
//
// Every warning is a Warn — a WARN-only observation, never a Finding, never a
// BLOCK. Module-level exports are types / the class — zero behavior-carrying
// bare functions (the plan's zero-bare-function discipline).

import path from "node:path";
import { declaredRegistries } from "./declare.ts";
import type { ChainLink, ParsedDoc, PlanParsed, TaskBlock } from "./doc.ts";
import { MarkdownPrimitives } from "./doc.ts";
import type { ReferenceEntry, ReferenceProjection } from "./project.ts";
import { Projector } from "./project.ts";

/** One reference-lint warning — a WARN-only observation, never a judge Finding. */
export interface Warn {
  /** The doc file the warning refers to. */
  path: string;
  /** The anchored surface the warning anchors to (a `Task N` block or a field name). */
  field: string;
  /** The one-line warning message — what the observation suspects. */
  message: string;
  /** The actionable fix. */
  fix: string;
  /** The lint family that produced the warning. */
  kind: "reference-lint";
}

/** The lint input — the document's path + the shared doc.ts parse instance (the
 *  doc type rides the parsed record's docType, never a re-typed key — no field
 *  the pass does not read). */
export interface LintInput {
  /** The document's file path (message attribution). */
  path: string;
  /** The shared parsed record — the same instance the dispatch and the graph read. */
  parsed: ParsedDoc;
}

/**
 * The reference-lint pass — the WARN observation face over the derived reference
 * vocabulary. One instance; every reference pattern it applies is read from the
 * projection, never re-typed. The prose scan surface (Objective / Acceptance) is
 * a scanning-semantics decision, tied to the vocabulary by a construction guard
 * that fails loudly if the plan registry renames either prose field.
 */
export class LintPass extends MarkdownPrimitives {
  /** The derived reference vocabulary — the single source the lint applies. */
  readonly #reference: ReferenceProjection;
  /** The derived `Task prose reference` token pattern (global — matchAll over prose lines). */
  readonly #proseToken: RegExp;
  /** The derived `DependsOn id` value pattern (whole-token — the declared-edge values). */
  readonly #depIdToken: RegExp;
  /** The prose-owning task fields of the plan — the scanning-semantics surface. */
  readonly #proseFieldKeys: readonly string[] = ["Objective", "Acceptance"];

  constructor() {
    super();
    this.#reference = new Projector(declaredRegistries).reference();
    const planEntries = this.#reference.plan.entries;
    this.#proseToken = new RegExp(this.#valuePatternOf(planEntries, "Task prose reference"), "g");
    this.#depIdToken = new RegExp(this.#valuePatternOf(planEntries, "DependsOn id"));
    for (const key of this.#proseFieldKeys) {
      this.#valuePatternOf(planEntries, `**${key}**`);
    }
  }

  /** run — the single observation entry: one Warn per offending surface. */
  run(input: LintInput): Warn[] {
    const warns: Warn[] = [];
    if (input.parsed.docType === "plan") {
      warns.push(...this.#missingEdgeWarns(input, input.parsed));
      warns.push(...this.#numberingAdvisories(input, input.parsed));
      warns.push(...this.#transitiveAdvisories(input, input.parsed));
    }
    warns.push(...this.#crossDocDriftWarns(input, input.parsed.chain.parentLink));
    return warns;
  }

  // -------------------------------------------------------------------------
  // the missing-edge suspect scan (plan)
  // -------------------------------------------------------------------------

  /** One WARN per task block whose prose references an existing lower task with no edge. */
  #missingEdgeWarns(input: LintInput, parsed: PlanParsed): Warn[] {
    const warns: Warn[] = [];
    const registered = new Set(parsed.taskBlocks.map((block) => block.id));
    for (const block of parsed.taskBlocks) {
      const declared = this.#declaredEdgesOf(block);
      const suspects = this.#suspectRefsOf(block, declared, registered);
      if (suspects.length === 0) continue;
      const list = suspects.map((id) => `Task ${id}`).join(" and ");
      warns.push({
        path: input.path,
        field: `Task ${block.id}`,
        message: `task ${block.id} prose-references ${list} with no matching **DependsOn** declaration — a suspected missing edge (WARN: the author's intent is authoritative, never a gate)`,
        fix: `declare the edge in the block's **DependsOn** line, or treat the reference as prose (task ${list})`,
        kind: "reference-lint",
      });
    }
    return warns;
  }

  /** One WARN per forward reference (a dep on a higher-numbered task) — the numbering
   *  read-order advisory (T24: legal after the anti-dependency gate retired, but a
   *  hint that the numbering no longer follows the topological reading order). */
  #numberingAdvisories(input: LintInput, parsed: PlanParsed): Warn[] {
    const warns: Warn[] = [];
    for (const block of parsed.taskBlocks) {
      for (const dep of this.#declaredEdgesOf(block)) {
        if (dep <= block.id) continue;
        warns.push({
          path: input.path,
          field: `Task ${block.id}`,
          message: `task ${block.id} depends on the higher-numbered Task ${dep} — legal (forward references), but the numbering no longer follows the topological reading order; consider renumbering (advisory only)`,
          fix: "renumber the pair for a linear reading order, or keep the forward dependency — the engine derives waves from **DependsOn** alone",
          kind: "reference-lint",
        });
      }
    }
    return warns;
  }

  /** One WARN per transitively-redundant declaration (a dep d reachable from another
   *  declared dep) — the direct-only advisory: redundant edges are harmless (the
   *  waves derive over the closure) but clutter the display, so the engine hints
   *  the author to declare direct prerequisites only. */
  #transitiveAdvisories(input: LintInput, parsed: PlanParsed): Warn[] {
    const warns: Warn[] = [];
    const declared = new Map<number, Set<number>>();
    for (const block of parsed.taskBlocks) declared.set(block.id, this.#declaredEdgesOf(block));
    const reachOf = (from: number): Set<number> => {
      const seen = new Set<number>();
      const stack = [...(declared.get(from) ?? [])];
      while (stack.length > 0) {
        const current = stack.pop()!;
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
          path: input.path,
          field: `Task ${block.id}`,
          message: `task ${block.id} depends on Task ${dep}, already reachable via declared dependency Task ${redundantVia} — declare direct prerequisites only (advisory: redundant edges are inert for the wave derivation, but clutter the graph)`,
          fix: `drop ${dep} from the block's **DependsOn** (or keep it — the engine reduces the display, the closure is unchanged)`,
          kind: "reference-lint",
        });
      }
    }
    return warns;
  }

  /** The block's declared edge ids — read from its **DependsOn** VALUE PREFIX only
   *  (the first `(`/`（` truncates — a trailing parenthetical's numbers are prose,
   *  never an edge; the same §3.8 value-domain contract the graph's extractor keeps). */
  #declaredEdgesOf(block: TaskBlock): Set<number> {
    const edges = new Set<number>();
    const field = block.fields.find((entry) => entry.key === "DependsOn");
    if (field === undefined) return edges;
    for (const line of field.lines) {
      const prefix = line.split(/[（(]/)[0]!;
      for (const token of prefix.split(/[,\s]+/)) {
        if (this.#depIdToken.test(token.trim())) edges.add(Number(token.trim()));
      }
    }
    return edges;
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
    for (const field of block.fields) {
      if (!this.#proseFieldKeys.includes(field.key)) continue;
      for (const line of field.lines) {
        const prose = this.#withoutCodeSpans(line);
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
    return suspects.sort((a, b) => a - b);
  }

  /** The line with its backtick-delimited inline code spans removed (a span cites a symbol, never prose). */
  #withoutCodeSpans(line: string): string {
    return line.replace(/`+[^`\n]*`+/g, "");
  }

  // -------------------------------------------------------------------------
  // the cross-doc drift observation (plan / phase-spec)
  // -------------------------------------------------------------------------

  /** The Class-B `**Parent program**` link whose label (version tokens stripped)
   *  drifts from the target basename — one WARN per offending link. */
  #crossDocDriftWarns(input: LintInput, parent: ChainLink | null): Warn[] {
    if (parent === null || parent.target.trim() === "") return [];
    if (this.#labelWithoutVersion(parent.label) !== path.basename(parent.target)) {
      return [
        {
          path: input.path,
          field: "**Parent program**",
          message: `the **Parent program** label ${JSON.stringify(parent.label.trim())} does not resolve to the target basename ${path.basename(parent.target)}`,
          fix: "make the link label equal the resolved file's basename (a trailing version token is allowed)",
          kind: "reference-lint",
        },
      ];
    }
    return [];
  }

  /** The label with a trailing version-token segment stripped (the canonical
   *  `basename v<m>.<n>` Class-B form) — the shared token primitive parses the
   *  tokens, never a re-typed version regex. */
  #labelWithoutVersion(label: string): string {
    const stripped = label.trim();
    const tokens = this.versionTokens(stripped);
    if (tokens.length === 0) return stripped;
    const last = tokens[tokens.length - 1];
    const index = stripped.lastIndexOf(last);
    return index <= 0 ? "" : stripped.slice(0, index).trimEnd();
  }

  // -------------------------------------------------------------------------
  // construction helpers
  // -------------------------------------------------------------------------

  /** The value pattern of a registered reference entry — a lookup that fails
   *  loudly when the declaration renames an anchor the lint consumes. */
  #valuePatternOf(entries: readonly ReferenceEntry[], anchor: string): string {
    const entry = entries.find((row) => row.anchor === anchor);
    if (entry === undefined) {
      throw new Error(`reference-lint requires the registered reference entry "${anchor}"`);
    }
    return entry.valuePattern ?? "";
  }
}
