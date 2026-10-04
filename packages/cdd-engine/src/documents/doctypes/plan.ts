// packages/cdd-engine/src/documents/doctypes/plan.ts — the PlanDocType subclass (P1 T2; plan §T2
// · design C1: the plan doc type — `### Task N:` detection + the plan contract face + the dispatch
// phase-id/group extractors). The DocumentsValidator's per-type plan branch (validatePlanContract /
// Class-A `**Spec:**` resolution / task extractors / phase-id resolution) homes here as instance
// methods; the full plan-entry audit (validate) composes its own plan faces then reaches the spec
// chain through the registry (the S3 parent walk — spec → parent overall). The plan holds the
// routed review/fix face (`"plan"` review type — S4).

import { readFileSync } from "node:fs";
import path from "node:path";
import { TaskGroup } from "../../domain/task-group.ts";
import { type DocContext, DocType, type DocValidateFailure } from "../doctype.ts";
import { docTypeRegistry } from "../registry.ts";
import { DOC_TOKENS } from "../tokens.ts";
import type { OverallParse } from "./overall.ts";
import { PLAN_SHAPE } from "./shapes/plan.ts";
import {
  isPlaceholderOrTemplateTarget,
  linksOnLine,
  ownDesignToken,
  resolveAny,
} from "./shared.ts";

// ---- plan-contract atoms (module-private — one consumer: the plan doc type) ----

const SPEC_MARK = DOC_TOKENS.specMark;
const SPEC_FIELD = DOC_TOKENS.specField;
const PLACEHOLDER_RE = /{{\s*[^{}>\n]+\s*}}/g;

// The standard section stop set — the structural boundary that closes a `##`-level section: a
// `#`/`##` heading or a `---` rule (the `### Task ` heading clause — DOC_TOKENS.taskHeadingPrefixRe —
// rides alongside where the section must not swallow task atoms). ONE shared definition for every
// section parser (task-groups / literal constraints / the prose-block boundary array), so a
// boundary edit lands once instead of drifting per-parser.
const PLAN_SECTION_BOUNDARY = /^(#{1,2}\s|---\s*$)/;

// Block boundary for the prose-pointer form (composes the shared PLAN_SECTION_BOUNDARY set): a
// `---` rule or a `#`/`##` heading, a `### Task ` heading — or another `**…**：` declaration heading
// (any prose-pointer-style bold heading begins a new declaration block).
const PROSE_BLOCK_STOP = [
  PLAN_SECTION_BOUNDARY,
  DOC_TOKENS.taskHeadingPrefixRe,
  /^\*\*[^*]+\*\*[：:]/,
] as const;

// Deterministic extraction for the canonical form: `## Constraints` heading + content to the first
// structural boundary — a `#`/`##` heading, a `### Task ` heading (the brief-extraction atom the
// constraints section must not swallow), or a `---` rule (the preamble/task separator). `###`
// sub-sections stay inside. An empty section → null (declared-but-empty is not a constraint
// declaration).
function extractLiteralConstraints(content: string): string | null {
  const lines = content.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (DOC_TOKENS.constraintsHeadingRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (PLAN_SECTION_BOUNDARY.test(lines[i]) || DOC_TOKENS.taskHeadingPrefixRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  const body = lines
    .slice(start + 1, end)
    .join("\n")
    .trimEnd();
  if (!body) return null;
  return `${lines[start]}\n${body}\n`;
}

// Prose-pointer anchor heading regex: `**<anchor>(?:（qualifier）)?**：` — the in-repo qualifier
// forms are full-width parentheticals; a bare `**<anchor>**：` matches too (the `(?:…)` group is a
// REAL regex group and optional — `（[^）]*）?` would quantify only the closing paren and demand a
// literal `（`). No gap is allowed between the anchor and the closing `**`, so a prefix-collision
// heading (`**<anchor> 补充**：`) can never occupy the anchor's slot.
function proseAnchorRe(anchor: string): RegExp {
  return new RegExp(`^\\*\\*${anchor}(?:（[^）]*）)?\\*\\*[：:]`);
}

// Legacy prose-pointer extraction: the anchored `**<anchor>…**：` lines in canonical order, each
// followed by its continuation paragraphs — a body spanning blank-line-separated paragraphs is
// captured in FULL. Block boundaries: the next declaration heading (or structural boundary) ends
// the block; present anchors are taken verbatim (first match per anchor), missing ones omitted.
function extractProseConstraints(content: string): string | null {
  const lines = content.split("\n");
  const out: string[] = [];
  for (const anchor of DOC_TOKENS.proseAnchors) {
    const re = proseAnchorRe(anchor);
    const start = lines.findIndex((line) => re.test(line));
    if (start < 0) continue;
    const block: string[] = [lines[start]];
    for (let i = start + 1; i < lines.length; i++) {
      if (PROSE_BLOCK_STOP.some((stop) => stop.test(lines[i]))) break;
      block.push(lines[i]);
    }
    while (block.length > 0 && block[block.length - 1].trim() === "") block.pop();
    out.push(block.join("\n"));
  }
  if (out.length === 0) return null;
  return `${out.join("\n\n")}\n`;
}

// Segment-preserving spec→phase identity (④'s own-token strand): the canonical phase-id token in
// its spec-filename form — `…-p2.1-design.md` owns `P2.1`, never its numeric base P2.
const SPEC_PHASE_ID_RE = new RegExp(
  `-(${DOC_TOKENS.phaseTokenScanRe.source.replace(/^\b/, "")})-design\\.md$`,
  "i",
);

function phaseIdFromSpecBasename(specPath: string): string | null {
  const m = path.basename(specPath).match(SPEC_PHASE_ID_RE);
  // the spec-filename id is lowercased — slice off the leading P to normalize case, the dotted
  // ridge preserved verbatim (`p2.1` → `P2.1`)
  return m ? `P${m[1].slice(1)}` : null;
}

/** The plan doc type's parse result — the aggregate of its extractor surfaces (the basename
 *  phase-id scans + the task-group/task-number face). */
export interface PlanParse {
  /** The basename-scan phase id (`…-p<digits>(.digits)*` canonical id); null when the plan
   *  filename carries no phase token. */
  phaseId: string | null;
  /** The dispatch phase id resolved through the canonical chain (④'s identity) — falls back to the
   *  basename scan when the chain cannot resolve a row. */
  dispatchPhaseId: string | null;
  /** The continuously-extractable task headings (`### Task N:`), sorted ascending. */
  taskNumbers: number[];
  /** The declared dispatch groups (`## Task Groups`), empty default. */
  taskGroups: TaskGroup[];
}

/** The plan doc type — `### Task N:` detection, the plan contract face (task continuity /
 *  `**Spec:**` Class-A resolution / constraints source / placeholder residue) + the dispatch
 *  phase-id and task-group extractors, and the full entry audit (the plan's own face → the reached
 *  spec chain → the parent overall). The plan is a routed review target (`"plan"` review type).
 */
export class PlanDocType extends DocType {
  constructor() {
    super({
      kind: "plan",
      // Shape domain — the plan output schema content (T3: the concrete per-type shape, the
      // SchemaFactory's projection source). words / instructions / refKind / bodyView stay the P1
      // placeholder state (T4/T5/P5 land the concrete content).
      shape: PLAN_SHAPE,
      words: { reference: "" },
      instructions: [],
      refKind: { kind: "" },
      bodyView: { format: "" },
      // The plan's routed review/fix face (S4): `--type plan` / the `--plan` next-step flag.
      route: { reviewType: "plan", argKey: "plan", targetFlag: "--plan" },
    });
  }

  /** Plan detection: the `### Task N:` heading feature (DOC_TOKENS.taskNumberRe) — the fallback
   *  scan order (overall → plan → spec) asks this type second. */
  detect(_fileName: string, content: string): boolean {
    return content.split("\n").some((l) => DOC_TOKENS.taskNumberRe.test(l));
  }

  /** The plan parse surface — the basename phase-id scans + the task extractors (the dispatch
   *  layer re-exports these identities through the DocumentsValidator facade). */
  parse(entry: string, ctx: DocContext): PlanParse {
    return {
      phaseId: this.phaseIdFromPlan(entry),
      dispatchPhaseId: this.phaseIdForDispatch(entry, ctx.root),
      taskNumbers: this.taskNumbersFromPlan(entry),
      taskGroups: this.taskGroupsFromPlan(entry),
    };
  }

  /** The full plan-entry audit — the necessary subset (plan contract + Class A) always runs, then
   *  the reached spec chain carries the spec face + the parent overall contract + four tables. */
  validate(entry: string, ctx: DocContext): DocValidateFailure[] {
    const failures: DocValidateFailure[] = [...this.validatePlanContract(entry)];
    const { specPath, failures: specRefFailures } = this.#resolveSpecOf(entry, ctx.root);
    failures.push(...specRefFailures);
    if (!specPath) return failures;
    failures.push(
      ...docTypeRegistry
        .resolve("spec")
        .validate(specPath, { root: ctx.root, phaseId: this.phaseIdForDispatch(entry, ctx.root) }),
    );
    return failures;
  }

  /** The plan's routed review/fix lifecycle dispatch key (S4) — `"plan"` (the review `--type`). */
  lifecycle(_entry: string, _ctx: DocContext): unknown {
    return this.route.reviewType;
  }

  /** The S3 parent walk: the plan's `**Spec:**` spec → the spec's Parent program overall. */
  parentChain(entry: string, root: string): string | null {
    const { specPath } = this.#resolveSpecOf(entry, root);
    if (!specPath) return null;
    return docTypeRegistry.resolve("spec").parentChain(specPath, root);
  }

  /** Task-heading scan (`^### Task N:` → numeric sort; tolerant titles after the colon are kept).
   * The heading token is schema-derived (plan schema taskHeadings pattern). */
  taskNumbersFromPlan(planFile: string): number[] {
    const nums: number[] = [];
    for (const line of readFileSync(planFile, "utf8").split("\n")) {
      const m = line.match(DOC_TOKENS.taskNumberRe);
      if (m) nums.push(Number(m[1]));
    }
    return nums.sort((a, b) => a - b);
  }

  /** Task-Groups section parse: the `## Task Groups` heading (canonical heading token) → the declared
   * merged groups as TaskGroup[] — one `- **Task 1, 2**: <note>` line per group (the captured comma-
   * space number list, the `--tasks <a>,<b>` join form), each parsed to sorted unique integers.
   * No section / empty section → [] (the empty default — the section is written ONLY when a
   * non-trivial merged group exists, so its absence IS the default). Section boundary = the standard
   * PLAN_SECTION_BOUNDARY stop set (a `#`/`##` heading, a `### Task ` heading, or a `---` rule). */
  taskGroupsFromPlan(planFile: string): TaskGroup[] {
    const lines = readFileSync(planFile, "utf8").split("\n");
    const start = lines.findIndex((l) => DOC_TOKENS.taskGroupsHeadingRe.test(l));
    if (start === -1) return [];
    const groups: TaskGroup[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (PLAN_SECTION_BOUNDARY.test(lines[i]) || DOC_TOKENS.taskHeadingPrefixRe.test(lines[i]))
        break;
      const m = lines[i].match(DOC_TOKENS.taskGroupsLineRe);
      if (!m) continue;
      groups.push(TaskGroup.fromNumbers(m[1].split(",").map((s) => Number(s.trim()))));
    }
    return groups;
  }

  /** effectiveGroups(planPath) — the SINGLE dispatch-group derivation (TaskGroup[]): declared groups
   * ∪ implicit single-task groups for any plan task an empty-or-partial declaration leaves uncovered
   * (`taskGroups.length ? … : singletons` under the P4.3 model — the P4.4 partition keeps the union
   * == the full plan task number set). The empty default (no `## Task Groups` section) yields the
   * per-task singletons [[1],[2],…,[N]] — exactly the pre-P4.3 per-task dispatch (zero migration); a
   * non-empty declaration replaces the singleton set only for the tasks it covers — an uncovered
   * plan task still lands as its implicit singleton (by task-number order: groups ordered by their lowest
   * task number), so the EFFECTIVE partition always covers the full plan task set (the union ==
   * taskNumbersFromPlan guard asserted by the engine tests, unchanged). A length-1 declared line is
   * parse-tolerated and surfaces in effectiveGroups as declared — the parser never drops a declared
   * task; the >= 2 floor is the schema minItems + the write-back judgment (a length-1 group is
   * redundant and never lands on disk), never this derivation. The iteration surfaces
   * (derivePlanVerdict / base.ts statusValidate progress lines) consume this one derivation — no
   * second implementation. */
  effectiveGroups(planPath: string): TaskGroup[] {
    const all = this.taskNumbersFromPlan(planPath); // sorted ascending
    const declared = this.taskGroupsFromPlan(planPath);
    if (declared.length === 0) return all.map((n) => TaskGroup.fromNumbers([n]));
    const covered = new Set<number>();
    for (const g of declared) for (const n of g) covered.add(n);
    const uncovered = all.filter((n) => !covered.has(n)).map((n) => TaskGroup.fromNumbers([n]));
    if (uncovered.length === 0) return declared;
    // by task-number order: declared groups + implicit singletons, ordered by each group's lowest task number.
    return [...declared, ...uncovered].sort((a, b) => (a.numbers[0] ?? 0) - (b.numbers[0] ?? 0));
  }

  /** Deterministic extraction from the plan's declared Constraints source: canonical Form A — a
   * literal top-level `## Constraints` section; legacy Form B — the prose-pointer headings
   * (measurement contract / commit boundary mechanism / Flow Atomicity / ordering principle), extracted in canonical order. Returns the
   * constraints body verbatim (single trailing newline) or null when the plan declares no constraint
   * source (the BLOCK face). */
  extractPlanConstraints(planContent: string): string | null {
    const literal = extractLiteralConstraints(planContent);
    if (literal !== null) return literal;
    return extractProseConstraints(planContent);
  }

  /** plan contract: `### Task N:` continuous extractability · `**Spec:**` exists + resolves ·
   * constraints source declaration extractable · no placeholders. Necessary subset — always runs. */
  validatePlanContract(planPath: string): DocValidateFailure[] {
    const failures: DocValidateFailure[] = [];
    const content = readFileSync(planPath, "utf8");

    // 1. Task headings — continuously extractable (canonical taskNumbersFromPlan).
    const tasks = this.taskNumbersFromPlan(planPath);
    const taskHeadingLbl = `\`${DOC_TOKENS.taskHeadingFormat}\``;
    if (tasks.length === 0) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: "Task headings",
        missing: `no ${taskHeadingLbl} headings in the plan`,
        fix: `add ${taskHeadingLbl} task headings, 1-indexed and contiguous (e.g. \`### Task 1:\` through \`### Task N:\`)`,
      });
    } else if (new Set(tasks).size !== tasks.length) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: "Task headings",
        missing: `duplicate task heading(s): ${tasks.join(", ")}`,
        fix: `make each ${taskHeadingLbl} heading present exactly once`,
      });
    } else {
      const max = tasks[tasks.length - 1];
      const expected = Array.from({ length: max }, (_, i) => i + 1);
      if (tasks.length !== expected.length || tasks.some((n, i) => n !== expected[i])) {
        failures.push({
          artifact: "plan",
          file: planPath,
          field: "Task headings",
          missing: `task headings not contiguous from 1 (got ${tasks.join(", ")}; expected 1..${max})`,
          fix: `renumber the task headings so every ${taskHeadingLbl} from 1 to the max is present exactly once`,
        });
      }
    }

    // 2. Constraints source — the declared source must be extractable (the materializer's own face;
    //    the implement non-dry existence gate already blocks on it; this check is mode-independent).
    if (this.extractPlanConstraints(content) === null) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: "Constraints source",
        missing: "plan declares no Constraints source",
        fix: `declare a literal \`${DOC_TOKENS.constraintsHeading}\` section (canonical Form A) or the prose pointer headings ${DOC_TOKENS.proseAnchorTokens.map((t) => `\`${t}\``).join(" / ")} (Form B)`,
      });
    }

    // 3. Placeholders — unfilled template tokens (`{{…}}`) are authoring debt; handlebars partials
    //    `{{> …}}` are the in-repo template mechanism and stay exempt.
    for (const m of content.matchAll(PLACEHOLDER_RE)) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: "placeholders",
        missing: `unfilled template token ${m[0]}`,
        fix: "replace the placeholder with the real content (or drop the template syntax)",
      });
    }
    return failures;
  }

  /** phaseIdFromPlan(planPath) — the basename-scan phase id (`…-p<digits>(.digits)*`, the canonical
   * id's filename form) — a `…-p2.1.md` filename yields `P2.1`, never the base `P2`. This is the
   * FALLBACK for four-table face ④ when the canonical chain cannot resolve the phase (see
   * phaseIdForDispatch); null → the "dispatch phase registered" check (four-table face ④) is skipped
   * (fail-open — a phase-less plan has no registration obligation); the structural overall checks
   * still run fully. Token shape is schema-derived (the canonical phase-id pattern's filename form). */
  phaseIdFromPlan(planPath: string): string | null {
    const m = path.basename(planPath).match(DOC_TOKENS.phaseIdScanRe);
    return m ? `P${m[1]}` : null;
  }

  /** phaseIdForDispatch(planPath, root) — the dispatch phase id resolved through the canonical chain
   * (④ identity, design §2.1 item 2 ④: a phase's identity resolves via the overall Phase inventory, not from basename
   *  numbering): the plan's `**Spec:**` design spec → the parent overall's Phase-inventory row whose
   * Design-spec column carries that spec — by resolved link equality, or by an own
   * `P<digits>(.digits)*-design` token matching the spec filename's phase — and that row's REGISTERED
   * id (sub-phase ids preserved: a `P2.1` row yields `P2.1`, never the collapsed `P2` a base-only
   * basename scan would produce). Falls back to the basename scan only when the chain cannot resolve
   * a row (spec missing / no parent overall / no row carries the spec) — the null semantics (skip ④)
   * are unchanged. */
  phaseIdForDispatch(planPath: string, root: string): string | null {
    const { specPath } = this.#resolveSpecOf(planPath, root);
    const overallPath = specPath
      ? docTypeRegistry.resolve("spec").parentChain(specPath, root)
      : null;
    if (specPath && overallPath) {
      const o = docTypeRegistry.resolve("overall").parse(overallPath, { root }) as OverallParse;
      if (o.kernelOk) {
        const specPhase = phaseIdFromSpecBasename(specPath);
        const specsDir = path.dirname(overallPath);
        for (const r of o.rows) {
          // Link-equality strand: the Design-spec cell links to the resolved spec file (the overall's
          // dir first, the repo root as the repo-form fallback — the same bases Class A walks).
          for (const { target } of linksOnLine(r.design)) {
            if (isPlaceholderOrTemplateTarget(target)) continue;
            if (resolveAny(target, [specsDir, root]) === specPath) return r.id;
          }
          // Own-token strand: the cell carries its own `P<n>-design` token matching the spec's phase
          // (tokenized cells without a file link — cross-referenced tokens for OTHER phases mismatch).
          if (specPhase && ownDesignToken(r.design, specPhase) !== null) return r.id;
        }
      }
    }
    return this.phaseIdFromPlan(planPath);
  }

  /** Class A — `**Spec:**` resolution — mirrors plan-spec-anchors (repo-root form primary, file-relative
   * fallback; holder targets skipped). Returns the resolved spec path + its failures (unresolved /
   * label drift). Class A keeps its failure surface at every resolution attempt — `**Spec:**` is a
   * plan's own line, not part of the (optional) parent lineage. */
  #resolveSpecOf(
    planPath: string,
    root: string,
  ): { specPath: string | null; failures: DocValidateFailure[] } {
    const failures: DocValidateFailure[] = [];
    const lines = readFileSync(planPath, "utf8").split("\n");
    const lineIdx = lines.findIndex((l) => l.includes(SPEC_MARK));
    if (lineIdx === -1) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: SPEC_FIELD,
        missing: `no ${SPEC_FIELD} reference`,
        fix: `add a ${SPEC_FIELD} line pointing at the phase design spec, e.g. ${SPEC_FIELD} [<name>-design.md](docs/kairos/specs/<name>-design.md)`,
      });
      return { specPath: null, failures };
    }
    let firstResolved: string | null = null;
    for (const { label, target } of linksOnLine(lines[lineIdx])) {
      if (isPlaceholderOrTemplateTarget(target)) continue;
      const resolved = resolveAny(target, [root, path.dirname(planPath)]);
      if (!resolved) {
        failures.push({
          artifact: "plan",
          file: planPath,
          field: SPEC_FIELD,
          missing: `target does not resolve (${target})`,
          fix: "fix the link target to an existing spec file (repo-root form docs/kairos/specs/<file> or a file-relative path)",
        });
        continue;
      }
      if (firstResolved === null) firstResolved = resolved;
      if (label.trim() !== path.basename(resolved)) {
        failures.push({
          artifact: "plan",
          file: planPath,
          field: SPEC_FIELD,
          missing: `link label ${label.trim()} != resolved basename ${path.basename(resolved)}`,
          fix: "make the link label equal the resolved file's basename",
        });
      }
    }
    if (firstResolved === null && failures.length === 0) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: SPEC_FIELD,
        missing: `no resolvable ${SPEC_FIELD} link`,
        fix: `add a ${SPEC_FIELD} link to an existing spec file`,
      });
    }
    return { specPath: firstResolved, failures };
  }
}
