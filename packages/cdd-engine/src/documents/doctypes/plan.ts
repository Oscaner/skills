// packages/cdd-engine/src/documents/doctypes/plan.ts — the PlanDocType subclass (P1 T2; plan §T2
// · design C1: the plan doc type — `### Task N:` detection + the plan contract face + the dispatch
// phase-id/group extractors). The DocumentsValidator's per-type plan branch (Class-A `**Spec:**`
// resolution / task extractors / phase-id resolution) homes here as instance methods; the plan's
// contract assertion face (task continuity · record data + checkable · constraints source · legacy
// sections + placeholders) migrated to the plan body's rule data at P3.1 T2 (body/plan-body.ts
// structureRules — the single-interpreter plane); the full plan-entry audit (validate) composes the
// Class-A surface then reaches the spec chain through the registry (the S3 parent walk — spec →
// parent overall). The plan holds the routed review/fix face (`"plan"` review type — S4).

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
import { GraphFailure, GraphVerdict, GraphViolationError, TaskGraph } from "./body/task-graph.ts";
import { PLAN_BODY_VIEW } from "./body-views.ts";
import type { OverallParse } from "./overall.ts";
import {
  constraintsSectionOf,
  isPlaceholderOrTemplateTarget,
  linksOnLine,
  ownDesignToken,
  resolveAny,
} from "./shared.ts";

// ---- plan-contract atoms (module-private — one consumer: the plan doc type) ----

const SPEC_MARK = DOC_TOKENS.specMark;
const SPEC_FIELD = DOC_TOKENS.specField;

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

/** Parse one `### Task N:` block's lines into a Task data record (design C3) — the single-form
 *  grammar: EVERY task block is a data-shaped record, so the parse always returns a Task (a block
 *  carrying no data-field markers parses to an empty record — the ORPHAN task block, a validate
 *  failure, never a silently dropped block). The single directed edge `- **DependsOn**:` (P3.1 T3
 *  — the unilateral edge model) reads as a comma-table number
 *  array into the Task's dependsOn — `none`/empty → `[]`, and a block whose line is ABSENT carries
 *  `hasDependsOn: false` (the TaskGraph missing-edge record — the sixth failure class). A step
 *  entry that drops the ` — checkable:` separator still parses (its action is kept) with the
 *  checkable capture empty — the validate face fails on it, the field is never silently dropped. */
function parseTaskBlock(lines: readonly string[]): Task {
  const slices = planBody.projectSlicePatterns();
  let objective = "";
  const files: string[] = [];
  const consumes: string[] = [];
  const produces: string[] = [];
  const steps: TaskStep[] = [];
  const acceptance: string[] = [];
  const dependsOn: number[] = [];
  let hasDependsOn = false;
  let mode: "steps" | "acceptance" | null = null;
  for (const line of lines) {
    // Field markers take priority (a marker line switches the parse mode / captures its single-line
    // value) — the acceptance-entry form can never swallow a sibling marker line.
    if (slices.objective.test(line)) {
      objective = line.replace(slices.objective, "").trim();
      mode = null;
    } else if (slices.files.test(line)) {
      files.push(...splitListValue(line.replace(slices.files, "").trim()));
      mode = null;
    } else if (slices.consumes.test(line)) {
      consumes.push(...splitListValue(line.replace(slices.consumes, "").trim()));
      mode = null;
    } else if (slices.produces.test(line)) {
      produces.push(...splitListValue(line.replace(slices.produces, "").trim()));
      mode = null;
    } else if (slices.dependsOn.test(line)) {
      hasDependsOn = true;
      const value = line.replace(slices.dependsOn, "").trim();
      // `none`/empty → the empty edge list (the explicit no-dependency declaration); any other
      // token passes through the Number gate (a non-integer `abc`/`1;2` parses to NaN — the
      // effectiveGroups integer gate rejects it, never silently swallowed).
      if (value !== "" && value !== "none") {
        dependsOn.push(...splitListValue(value).map(Number));
      }
      mode = null;
    } else if (slices.steps.test(line)) {
      mode = "steps";
    } else if (slices.acceptance.test(line)) {
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
  return new Task({
    objective,
    files,
    interface: { consumes, produces },
    steps,
    acceptance,
    // the edge field is default-`[]`: a `none`/empty declaration lands the empty list; the
    // line-presence fact rides hasDependsOn (missing → the TaskGraph missing-edge BLOCK).
    dependsOn,
    hasDependsOn,
  });
}

function phaseIdFromSpecBasename(specPath: string): string | null {
  const m = path.basename(specPath).match(SPEC_PHASE_ID_RE);
  // the spec-filename id is lowercased — slice off the leading P to normalize case, the dotted
  // ridge preserved verbatim (`p2.1` → `P2.1`)
  return m ? `P${m[1].slice(1)}` : null;
}

/** The plan doc type's parse result — the aggregate of its extractor surfaces (the basename
 *  phase-id scans + the task-heading face). */
export interface PlanParse {
  /** The basename-scan phase id (`…-p<digits>(.digits)*` canonical id); null when the plan
   *  filename carries no phase token. */
  phaseId: string | null;
  /** The dispatch phase id resolved through the canonical chain (④'s identity) — falls back to the
   *  basename scan when the chain cannot resolve a row. */
  dispatchPhaseId: string | null;
  /** The continuously-extractable task headings (`### Task N:`), sorted ascending. */
  taskNumbers: number[];
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

  /** Plan detection: the `### Task N:` heading feature (the body's projected `taskHeading` slice —
   *  the same parse-pattern single source the continuity scan reads) — the fallback scan order
   *  (overall → plan → spec) asks this type second. */
  detect(_fileName: string, content: string): boolean {
    const taskHeading = this.body.projectSlicePatterns().taskHeading;
    return content.split("\n").some((l) => taskHeading.test(l));
  }

  /** The plan parse surface — the basename phase-id scans + the task extractors (the dispatch
   *  layer re-exports these identities through the DocumentsValidator facade). */
  parse(entry: string, ctx: DocContext): PlanParse {
    return {
      phaseId: this.phaseIdFromPlan(entry),
      dispatchPhaseId: this.phaseIdForDispatch(entry, ctx.root),
      taskNumbers: this.taskNumbersFromPlan(entry),
    };
  }

  /** The full plan-entry audit — the necessary subset (the Class-A `**Spec:**` surface) always
   *  runs, then the reached spec chain carries the spec face + the parent overall contract + four
   *  tables. The plan-contract structural assertion face (task continuity / record data / checkable
   *  / constraints source / legacy sections / placeholders) migrated to the plan body's rule data
   *  (`plan-body.structureRules` — the P3.1 T2 single-interpreter plane the doc-contract gate
   *  judges); the Class-A `**Spec:**` chain stays here (cross-document — P5 boundary). */
  validate(entry: string, ctx: DocContext): DocValidateFailure[] {
    const failures: DocValidateFailure[] = [];
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
   * The heading token is the body's projected `taskHeading` slice (the number captured — the same
   * parse-pattern single source `tasksFromPlan` / detection read). */
  taskNumbersFromPlan(planFile: string): number[] {
    return this.#scanTaskNumbers(planFile).sort((a, b) => a - b);
  }

  /** Task-heading scan in FILE order (unsorted — the raw heading sequence a plan author wrote).
   * The graph feed gates on it: TaskGraph's ascending-array contract (index i+1 = task id i+1)
   * holds only when the `### Task N:` headings run 1..N in file order, so a plan whose blocks leave
   * ascending order would mis-map every edge — the file-order gate falls back to the per-task
   * singleton run instead (never a silently wrong dispatch group order). */
  #scanTaskNumbers(planFile: string): number[] {
    const nums: number[] = [];
    const taskHeading = this.body.projectSlicePatterns().taskHeading;
    for (const line of readFileSync(planFile, "utf8").split("\n")) {
      const m = line.match(taskHeading);
      if (m) nums.push(Number(m[1]));
    }
    return nums;
  }

  /** tasksFromPlan(planFile) — the plan's Task data records (design C3): one record per `### Task N:`
   * block (objective / files / steps / acceptance / the single directed dependsOn … the body's
   * projected task-block slice single source). Under the single-form grammar EVERY block is a
   * data-shaped record — a block carrying no data markers parses to an EMPTY record (the orphan
   * task block, a validate failure — never a silently dropped block). A step entry without its
   * ` — checkable:` separator still parses with the checkable capture empty — the validate face
   * fails on it, the field is never silently dropped. */
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
    return blocks.map((block) => parseTaskBlock(lines.slice(block.start, block.end)));
  }

  /** effectiveGroups(planPath) — the SINGLE dispatch-group derivation (TaskGroup[]), derived from
   *  the TaskGraph wave batches over the plan's task data records: the wave is the dispatch group — each becomes one
   *  dispatch group (ascending task numbers within a wave; waves in ascending depth order). The
   *  dispatch groups are the graph's edge declarations — nothing else composes them. The graph's
   *  batches() gate runs first — a broken edge model (missing-edge / missing-id / malformed
   *  non-integer / self-loop / contradiction (anti-dependency) / cycle / duplicate) throws
   *  GraphViolationError carrying the GraphVerdict, never a silently emitted order. A plan without
   *  the full 1..N task-record set (the headings not running 1..N in FILE order — a TaskGraph
   *  mis-map) yields the per-task singleton run [[1],[2],…,[N]] — never a silently mis-mapped wave.
   *  The iteration surfaces (derivePlanVerdict / base.ts statusValidate progress lines / the
   *  next-step router) consume this one derivation —
   *  no second implementation. */
  effectiveGroups(planPath: string): TaskGroup[] {
    const fileOrder = this.#scanTaskNumbers(planPath);
    const tasks = this.tasksFromPlan(planPath);
    // The TaskGraph indexes its task array by the task id (index i+1 = task i+1) — the graph feed
    // needs the full 1..N record set in ascending FILE order. A plan whose headings don't run 1..N
    // in file order (a mis-mapped graph) keeps the per-task singleton run [[1],…,[N]].
    if (tasks.length !== fileOrder.length || !fileOrder.every((n, i) => n === i + 1)) {
      return [...fileOrder].sort((a, b) => a - b).map((n) => TaskGroup.fromNumbers([n]));
    }
    // Edge-model integer gate at the graph feed: a malformed value declaration (a `- **DependsOn**:
    // foo` non-integer parses to NaN) must surface here as GraphViolationError (missing-id class) —
    // never a raw TaskGraph throw.
    const failures = this.#edgeIntegerFailures(tasks, fileOrder.length);
    if (failures.length > 0) throw new GraphViolationError(new GraphVerdict(failures));
    // TaskGraph.batches() validates the edge model first — a non-null GraphVerdict throws
    // GraphViolationError (the failures aggregate in the verdict) instead of emitting a broken order.
    return new TaskGraph(tasks).groupBatches();
  }

  /** Edge-model integer gate (the plan seam — the malformed-value surface): every dependsOn value is
   *  a task id, so a non-integer declaration is broken. The root NaN hole lives in TaskGraph.validate
   *  (all five checks compare numbers — NaN survives); this gate turns the malformed value into the
   *  same GraphViolationError block face (missing-id class) instead. The failure anchors `id` to the
   *  declaring task id — a real number (the malformed value parses to NaN, which would serialize as
   *  null against GraphFailure.id's number contract; the offending literal already rides the
   *  description). */
  #edgeIntegerFailures(tasks: readonly Task[], taskCount: number): GraphFailure[] {
    const failures: GraphFailure[] = [];
    tasks.forEach((task, i) => {
      const declaring = i + 1;
      for (const v of task.dependsOn) {
        if (Number.isInteger(v)) continue;
        failures.push(
          new GraphFailure({
            class: "missing-id",
            field: "dependsOn",
            id: declaring,
            description: `task ${declaring} declares a non-integer dependsOn task id (${v}) — edge ids are integers (1..${taskCount})`,
          }),
        );
      }
    });
    return failures;
  }

  /** Deterministic extraction from the plan's declared Constraints source: the literal top-level
   * `## Constraints` section — the single source (the legacy Form B prose-pointer read is retired).
   * Returns the constraints body verbatim (single trailing newline) or null when the plan declares
   * no Constraints source (the BLOCK face). */
  extractPlanConstraints(planContent: string): string | null {
    return constraintsSectionOf(planContent, this.body.projectSlicePatterns().constraintsHeading);
  }

  /** The plan's merged constraints read (design C4 — the plan side of the delta-only inheritance
   *  machine): the plan's own `## Constraints` delta joined with the parent overall's conventions
   *  (the constitution auto-applies; the chain = Class-A `**Spec:**` → the spec's Class-B
   *  `**Parent program**` → the overall's `**Constraints**:` block). A chain that cannot resolve
   *  the parent overall degrades to the plan's own delta — resolution is the validate face
   *  (Class A/B + the spec's inheritance-point linkage), never this read. Returns the merged
   *  presentation or null when the plan declares no Constraints source (the BLOCK face — the
   *  facade's ConstraintsSourceUndeclared materializer). */
  planConstraintsOf(planPath: string, root: string): string | null {
    const content = readFileSync(planPath, "utf8");
    const ownDelta = constraintsSectionOf(
      content,
      this.body.projectSlicePatterns().constraintsHeading,
    );
    if (ownDelta === null) return null; // no `## Constraints` source → no merged read (the undeclared face)
    const { specPath } = this.#resolveSpecOf(planPath, root);
    const overallPath = specPath
      ? docTypeRegistry.resolve("spec").parentChain(specPath, root)
      : null;
    const parentConstraints = overallPath
      ? overallConstraintsOf(readFileSync(overallPath, "utf8"))
      : null;
    return mergeParentConstraints({ ownDelta, parentConstraints });
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
