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
import {
  type DocContext,
  type DocLifecycleFacts,
  DocType,
  type DocValidateFailure,
} from "../doctype.ts";
import { docTypeRegistry } from "../registry.ts";
import { DOC_TOKENS } from "../tokens.ts";
import { DOC_WORDS } from "../words.ts";
import { mergeParentConstraints, overallConstraintsOf } from "./body/constraints.ts";
import type { PlanBody } from "./body/plan-body.ts";
import { planBody } from "./body/plan-body.ts";
import { Task, type TaskStep } from "./body/task.ts";
import { PLAN_BODY_VIEW } from "./body-views.ts";
import type { OverallParse } from "./overall.ts";
import {
  constraintsSectionOf,
  isPlaceholderOrTemplateTarget,
  linksOnLine,
  ownDesignToken,
  resolveAny,
  sectionBoundaryRe,
} from "./shared.ts";

// ---- plan-contract atoms (module-private — one consumer: the plan doc type) ----

const SPEC_MARK = DOC_TOKENS.specMark;
const SPEC_FIELD = DOC_TOKENS.specField;
const PLACEHOLDER_RE = /{{\s*[^{}>\n]+\s*}}/g;

// The standard section stop set — the structural boundary that closes a `##`-level section: a
// `#`/`##` heading or a `---` rule (the `### Task ` heading clause — DOC_TOKENS.taskHeadingPrefixRe —
// rides alongside where the section must not swallow task atoms). The base set is the SHARED
// doctype-layer constant (sectionBoundaryRe in shared.ts — ONE definition for every section parser:
// the Form-A constraints-section extractor / this prose-block array / the task-groups walk), so a
// boundary edit lands once instead of drifting per-parser.

// Block boundary for the prose-pointer form (composes the shared sectionBoundaryRe set): a
// `---` rule or a `#`/`##` heading, a `### Task ` heading — or another `**…**：` declaration heading
// (any prose-pointer-style bold heading begins a new declaration block).
const PROSE_BLOCK_STOP = [
  sectionBoundaryRe,
  DOC_TOKENS.taskHeadingPrefixRe,
  /^\*\*[^*]+\*\*[：:]/,
] as const;

// The canonical Form-A constraints-section extraction — the shared doctype atom
// (`constraintsSectionOf` in shared.ts: the literal top-level `## Constraints` section, bounded by
// the next `#`/`##` heading, a `### Task ` heading or a `---` rule; `###` sub-sections stay
// inside; an empty section → null).

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

// ---- task-record atoms (design C3 — the data-shaped task block parse) ----

/** Split a comma-separated list value into its trimmed non-empty items (the files / consumes /
 *  produces field lists of a data-shaped task record). */
function splitListValue(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Parse one `### Task N:` block's lines into a Task data record (design C3) — empty return for a
 *  legacy block carrying no data-field markers (the dual-read contract: the legacy `- **Do**:` face
 *  is left untouched, a new-shape block's objective/steps/acceptance fields are the single source).
 *  A step entry that drops the ` — checkable:` separator still parses (its action is kept) with the
 *  checkable capture empty — the validate face fails on it, the field is never silently dropped. */
function parseTaskBlock(lines: readonly string[]): Task | null {
  const slices = planBody.projectSlicePatterns();
  let objective = "";
  const files: string[] = [];
  const consumes: string[] = [];
  const produces: string[] = [];
  const steps: TaskStep[] = [];
  const acceptance: string[] = [];
  let sawData = false;
  let mode: "steps" | "acceptance" | null = null;
  for (const line of lines) {
    // Field markers take priority (a marker line switches the parse mode / captures its single-line
    // value) — the acceptance-entry form can never swallow a sibling marker line.
    if (slices.objective.test(line)) {
      objective = line.replace(slices.objective, "").trim();
      sawData = true;
      mode = null;
    } else if (slices.files.test(line)) {
      files.push(...splitListValue(line.replace(slices.files, "").trim()));
      sawData = true;
      mode = null;
    } else if (slices.consumes.test(line)) {
      consumes.push(...splitListValue(line.replace(slices.consumes, "").trim()));
      sawData = true;
      mode = null;
    } else if (slices.produces.test(line)) {
      produces.push(...splitListValue(line.replace(slices.produces, "").trim()));
      sawData = true;
      mode = null;
    } else if (slices.steps.test(line)) {
      sawData = true;
      mode = "steps";
    } else if (slices.acceptance.test(line)) {
      sawData = true;
      mode = "acceptance";
    } else if (mode === "steps") {
      const m = line.match(slices.stepEntry);
      if (m) steps.push({ action: m[1]!.trim(), checkable: (m[2] ?? "").trim() });
    } else if (mode === "acceptance") {
      if (line.match(slices.acceptanceEntry)) {
        acceptance.push(line.replace(slices.acceptanceEntry, "").trim());
      }
    }
  }
  if (!sawData) return null; // a legacy block — no data-field markers, no task record
  return new Task({
    objective,
    files,
    interface: { consumes, produces },
    steps,
    acceptance,
  });
}

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
  /** The injected body — the shape + slice single source for this doc type's checks (constructor
   *  injection, no default parameterization: the body is the live wiring of the shape domain). */
  readonly body: PlanBody;

  constructor(body: PlanBody) {
    super({
      kind: "plan",
      // Shape domain — the plan output schema content (P2 T3: derived from the injected body's
      // projectSchemaShape() — the only contract chain DocBody.projectSchemaShape() → DocType.shape →
      // SchemaFactory; the retired plan shape constant is gone). Words — the shared engine lexicon
      // content. BodyView — the docs-family body forms + the plan review config. instructions /
      // refKind stay the P1 placeholder state (P5 lands the concrete content).
      shape: body.projectSchemaShape(),
      words: DOC_WORDS,
      instructions: [],
      refKind: { kind: "" },
      bodyView: PLAN_BODY_VIEW,
      // The plan's routed review/fix face (S4): `--type plan` / the `--plan` next-step flag.
      route: { reviewType: "plan", argKey: "plan", targetFlag: "--plan" },
    });
    this.body = body;
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

  /** The plan's routed review/fix lifecycle handling (S4/T6): the docs review's REVIEW_PLAN_LINE —
   *  the plan's upstream design-spec reference (the caller-supplied `--spec`, D11 — the
   *  `**Spec:**`-markered line the review agent reads the upstream against); empty when the
   *  dispatch carries no upstream reference. */
  lifecycle(_entry: string, ctx: DocContext): DocLifecycleFacts | null {
    const upstream = ctx.upstreamSpec ?? "";
    return { reviewPlanLine: upstream ? `${DOC_TOKENS.specMark} ${upstream}` : "" };
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
   * non-trivial merged group exists, so its absence IS the default). Section boundary = the shared
   * sectionBoundaryRe stop set (a `#`/`##` heading, a `### Task ` heading, or a `---` rule). */
  taskGroupsFromPlan(planFile: string): TaskGroup[] {
    const lines = readFileSync(planFile, "utf8").split("\n");
    const start = lines.findIndex((l) => DOC_TOKENS.taskGroupsHeadingRe.test(l));
    if (start === -1) return [];
    const groups: TaskGroup[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (sectionBoundaryRe.test(lines[i]) || DOC_TOKENS.taskHeadingPrefixRe.test(lines[i])) break;
      const m = lines[i].match(DOC_TOKENS.taskGroupsLineRe);
      if (!m) continue;
      groups.push(TaskGroup.fromNumbers(m[1].split(",").map((s) => Number(s.trim()))));
    }
    return groups;
  }

  /** tasksFromPlan(planFile) — the plan's Task data records (design C3): one record per `### Task N:`
   * block that carries the data-field markers (objective / steps / acceptance … the body's projected
   * task-block slice single source). A legacy block (`- **Do**:` face, no data markers) returns no
   * record — the dual-read contract: the legacy tree parses task-free, the new task-handoff brief
   * renders from these records. A step entry without its ` — checkable:` separator still parses with
   * the checkable capture empty — the validate face fails on it, the field is never silently dropped. */
  tasksFromPlan(planFile: string): Task[] {
    const lines = readFileSync(planFile, "utf8").split("\n");
    const slices = this.body.projectSlicePatterns();
    const blocks: Array<{ start: number; end: number }> = [];
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (slices.taskHeading.test(lines[i])) {
        if (start >= 0) blocks.push({ start, end: i });
        start = i;
      }
    }
    if (start >= 0) blocks.push({ start, end: lines.length });
    const tasks: Task[] = [];
    for (const block of blocks) {
      const task = parseTaskBlock(lines.slice(block.start, block.end));
      if (task !== null) tasks.push(task);
    }
    return tasks;
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
    const literal = constraintsSectionOf(planContent);
    if (literal !== null) return literal;
    return extractProseConstraints(planContent);
  }

  /** The plan's merged constraints read (design C4 — the plan side of the delta-only inheritance
   *  machine): Form A — the plan's own `## Constraints` delta joined with the parent overall's
   *  conventions (the constitution auto-applies; the chain = Class-A `**Spec:**` → the spec's
   *  Class-B `**Parent program**` → the overall's `**Constraints**:` block). Form B (legacy) — the
   *  prose-pointer extraction, unchanged (the dual-read exemption: legacy Form B plans keep their
   *  old read with no merge). A chain that cannot resolve the parent overall degrades to the
   *  plan's own delta — resolution is the validate face (Class A/B + the spec's inheritance-point
   *  linkage), never this read. Returns the merged presentation or null when the plan declares no
   *  Constraints source (the BLOCK face — the facade's ConstraintsSourceUndeclared materializer). */
  planConstraintsOf(planPath: string, root: string): string | null {
    const content = readFileSync(planPath, "utf8");
    const ownDelta = constraintsSectionOf(content);
    if (ownDelta === null) return extractProseConstraints(content); // legacy Form B — unchanged read
    const { specPath } = this.#resolveSpecOf(planPath, root);
    const overallPath = specPath
      ? docTypeRegistry.resolve("spec").parentChain(specPath, root)
      : null;
    const parentConstraints = overallPath
      ? overallConstraintsOf(readFileSync(overallPath, "utf8"))
      : null;
    return mergeParentConstraints({ ownDelta, parentConstraints });
  }

  /** plan contract: `### Task N:` continuous extractability · `**Spec:**` exists + resolves ·
   * constraints source declaration extractable · no placeholders · the data-shaped task steps carry
   * their checkable (missing checkable = a validate failure, never an author's discretion).
   * Necessary subset — always runs. */
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

    // 4. Data-shaped task steps — every parsed step carries its checkable outcome (design C3: the
    //    step checkable is a validate requirement, never an author's discretion). Legacy blocks
    //    (no `- **Steps**:` marker) parse no steps — the dual-read tree is unaffected; a step whose
    //    action line drops the ` — checkable:` separator parses with an empty checkable and fails.
    for (const task of this.tasksFromPlan(planPath)) {
      for (const step of task.steps) {
        if (!step.checkable) {
          failures.push({
            artifact: "plan",
            file: planPath,
            field: "`checkable`",
            missing: `task step "${step.action}" carries no checkable outcome`,
            fix: "end every `- **Steps**:` entry's action with ` — checkable: <outcome>` (the verifiable outcome is the step's acceptance evidence)",
          });
        }
      }
    }

    // 5. Form-B prohibition on new-shape plans (design C4 — the delta-only constraint surface):
    //    the Form B prose-pointer headings are the LEGACY constraint read. A new-shape plan —
    //    recognized by the data-shaped task records (the T3 Task data face) or the literal
    //    `## Constraints` delta section — must never declare Form B: the delta section is the
    //    single new-shape surface (the inherited spec/overall conventions auto-apply). The legacy
    //    tree keeps the dual-read exemption — a plan with neither marker (the Form B prose-pointer
    //    era docs) is untouched.
    const newShape =
      this.tasksFromPlan(planPath).length > 0 || constraintsSectionOf(content) !== null;
    if (newShape && extractProseConstraints(content) !== null) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: "Constraints source",
        missing: `a new-shape plan declares the legacy Form B prose pointer headings (${DOC_TOKENS.proseAnchorTokens.map((t) => `\`${t}\``).join(" / ")})`,
        fix: `drop the Form B prose headings and declare the plan's delta under a literal ${DOC_TOKENS.constraintsHeading} section (the parent-overall conventions auto-apply)`,
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
