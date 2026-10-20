// packages/cdd-engine/src-next/render/__tests__/render.test.ts
// T12 render suite — the brief's checkables: template assembly over the
// template-contract data plane (with the hard gates) + the task-brief data
// rendering with the step-checkable gate.
// T19 lands the IssueBodyRenderer suite here — the renderer's home is render/ (the
// P7 translation-system render landing): the body render (en/zh label faces through
// the Translator), the langs projection (the word-table locale key projection —
// never a hardcoded list), the input validation, and the type × segment label-data
// completeness pin over the word table.

import { describe, expect, it } from "vitest";
import { Translator } from "../../contract/translate.ts";
import { DISPATCH } from "../../face/host.ts";
import { TerminationPolicy } from "../../face/termination.ts";
import { Words } from "../../face/words.ts";
import { BriefRenderer } from "../brief.ts";
import { IssueBodyRenderer, type IssueReportInput } from "../issue-body.ts";
import { TEMPLATE_PROMPT, TemplateAssembler } from "../templates.ts";

/** The full per-dispatch slot values — every declared template token (the v1.8
 *  INPUT_/OUTPUT_/WORKSPACE_/BASE_BRANCH/ROLE/WAVE vocabulary), optional slots
 *  legitimately empty (an implement dispatch carries no review/fix slots; the
 *  review criteria/lens are NOT values — they fold into the review type's fixed
 *  prefix, §3.7). */
const ALL_VALUES: Record<string, string> = {
  ROLE: "implement",
  WAVE: "4,12",
  INPUT_WAVE_BRIEF: "/ws/tasks-4,12-brief.md",
  INPUT_REVIEWS: "",
  INPUT_PLAN: "",
  INPUT_SPEC: "",
  BASE_BRANCH: "",
  OUTPUT_REPORT: "/ws/tasks-4,12-implement-report.md",
  OUTPUT_EVIDENCE: "/ws/tasks-4,12-test-evidence.json",
  OUTPUT_HANDOFF: "/ws/tasks-4,12-implement.json",
  REVIEW_TYPE: "",
  WORKSPACE_DIR: "/ws",
  WORKSPACE_ID: "2026-10-02-x",
  HANDOFF_SCHEMA: "$$SCHEMA$$",
};

describe("TemplateAssembler — the template assembly + hard gates", () => {
  const assembler = new TemplateAssembler();

  it("declares the four-mode dispatch table and the token registry", () => {
    // v1.8 — the mode dispatch table; v1.9 — RETURN_JSON / DOCS_FIX retired; the
    // review criteria/lens tokens are gone (§3.7).
    expect(assembler.workModes()).toEqual(["implement", "fix", "review", "docs-fix"]);
    expect(assembler.declaredTokens()).toContain("ROLE");
    expect(assembler.declaredTokens()).toContain("OUTPUT_HANDOFF");
    expect(assembler.declaredTokens()).toContain("OUTPUT_REPORT");
    expect(assembler.declaredTokens()).toContain("OUTPUT_EVIDENCE");
    expect(assembler.declaredTokens()).toContain("BASE_BRANCH");
    expect(assembler.declaredTokens()).toContain("HANDOFF_SCHEMA");
    // the retired reference tokens — the range/brief tokens are gone; INPUT_PLAN is
    // resurrected as the semantic plan-doc anchor (the kind-named round context)
    expect(assembler.declaredTokens()).not.toContain("INPUT_RANGE");
    expect(assembler.declaredTokens()).toContain("INPUT_PLAN");
    expect(assembler.declaredTokens()).not.toContain("FIX_BASE");
    expect(assembler.declaredTokens()).not.toContain("OUTPUT_BRIEF");
    expect(assembler.declaredTokens()).not.toContain("INPUT_CRITERIA");
    expect(assembler.declaredTokens()).not.toContain("INPUT_LENS");
    expect(assembler.declaredTokens()).not.toContain("HANDOFF_WRITE_GATE");
    expect(assembler.declaredTokens()).not.toContain("INPUT_RULES");
  });

  it("renders the single prose return contract — the retired status/artifacts key block is gone (§2.4)", () => {
    // P11 §2.1: the `## Return` zone is ONE plain-prose contract block — the child
    // narrates the round in prose and nothing downstream parses its stdout (the
    // handoff draft at OUTPUT_HANDOFF is the machine-readable result). The retired
    // two-line key block (`status:` / `artifacts:` inside a fence) must not survive
    // anywhere in the assembled prompt.
    const out = assembler.render(ALL_VALUES);
    const returnZone = out.split("## Return")[1];
    expect(returnZone).toBeDefined();
    // the prose contract is present, byte-anchored on the RETURN_PROSE zone
    expect(returnZone).toContain(
      "Report in a few plain sentences what this round did, whether it succeeded",
    );
    expect(returnZone).toContain("`OUTPUT_HANDOFF` is the round's machine-readable result");
    expect(returnZone).toContain("Do not emit key-value lines");
    // zero key-value residue — no fenced command block, no `status:`/`artifacts:` line
    expect(out).not.toContain("```");
    expect(out).not.toContain("commits:");
    expect(out).not.toMatch(/^status: /m);
    expect(out).not.toMatch(/^artifacts: /m);
  });

  it("assembles the implement mode — the fixed prefix + the reduced round context", () => {
    const out = assembler.render(ALL_VALUES);
    expect(out.startsWith("# CDD dispatch — implement round")).toBe(true);
    expect(out).toContain("## Instructions");
    expect(out).toContain("## Handoff schema");
    expect(out).toContain("## Return");
    expect(out).toContain("## Round context");
    expect(out).toContain("- `ROLE`: implement");
    expect(out).toContain("- `WAVE`: 4,12");
    expect(out).toContain("- `INPUT_WAVE_BRIEF`: /ws/tasks-4,12-brief.md");
    expect(out).toContain("$$SCHEMA$$"); // the injected writable-subset fence slot
    expect(out).not.toContain("{{"); // zero unresolved slots
    // the implement reminder reads the complete plan mirror (INPUT_WAVE_BRIEF) —
    // the plan's ## Constraints rides the brief; the OUTPUT_* write paths are
    // prescribed (find #5), the brief is a pure read input (no OUTPUT_BRIEF)
    expect(out).not.toContain("INPUT_RULES");
    expect(out).toContain("the complete plan mirror");
    expect(out).not.toContain("- `OUTPUT_BRIEF`");
    expect(out).toContain("- `OUTPUT_REPORT`: /ws/tasks-4,12-implement-report.md");
    expect(out).toContain("- `OUTPUT_EVIDENCE`: /ws/tasks-4,12-test-evidence.json");
    // the v1.9 prose-zeroing — no HANDOFF_WRITE_GATE / ## Handoff prose anywhere
    expect(out).not.toContain("HANDOFF_WRITE_GATE");
    expect(out).not.toContain("RETURN_JSON");
    expect(out).not.toContain("DOCS_FIX");
    // the per-mode trimming: an implement round's context carries no review/fix keys
    expect(out).not.toContain("INPUT_CRITERIA");
    expect(out).not.toContain("INPUT_REVIEWS");
    expect(out).not.toContain("FIX_BASE");
    expect(out).not.toContain("BASE_BRANCH");
    // ⑫ the implement dispatch ref is the DISPATCH single source — the rendered
    // shell carries DISPATCH.implement's value (zero drift pin; the literal lives
    // ONLY in the DISPATCH table, never re-spelled in the template prose).
    expect(out).toContain(DISPATCH.implement);
  });

  it("renders the docs-fix mode through the same table — its own rules + subset", () => {
    const out = assembler.render({
      ...ALL_VALUES,
      ROLE: "docs-fix",
      INPUT_SPEC: "docs/x-design.md",
    });
    expect(out.startsWith("# CDD dispatch — docs-fix round")).toBe(true);
    expect(out).toContain("apply `INPUT_REVIEWS` (all severities) directly to the judged doc");
    expect(out).toContain("- `INPUT_SPEC`: docs/x-design.md");
    expect(out).not.toContain("BASE_BRANCH");
    // the review-only keys stay out of the docs-fix context
    expect(out).not.toContain("INPUT_CRITERIA");
  });

  it("every work shell carries the Bash discipline clause — a timeout on every command, ceiling from the constant", () => {
    // The clause's minute value is DERIVED from the constant, never re-spelled in
    // prose — the pin reads the constant, so a budget change cannot leave the
    // prompt behind.
    const ceiling = `${TerminationPolicy.CHILD_BASH_TIMEOUT_MS / 60_000} minutes`;
    for (const role of ["implement", "fix", "review", "docs-fix"] as const) {
      const out = assembler.render({
        ...ALL_VALUES,
        ROLE: role,
        REVIEW_TYPE: "spec",
        INPUT_SPEC: "docs/x-design.md",
      });
      expect(out, role).toContain("Put a `timeout` on every Bash command");
      expect(out, role).toContain(ceiling);
    }
  });

  it("every work shell forbids unbounded loops — a wait must carry its own exit condition", () => {
    const pins = [
      "`while True: pass`",
      "`while true; do …; done`",
      "bounded exit condition",
    ] as const;
    for (const role of ["implement", "fix", "review", "docs-fix"] as const) {
      const out = assembler.render({
        ...ALL_VALUES,
        ROLE: role,
        REVIEW_TYPE: "spec",
        INPUT_SPEC: "docs/x-design.md",
      });
      for (const pin of pins) expect(out, role).toContain(pin);
    }
  });

  it("the fix shell carries the two typed fix-discipline sentences — verify-then-apply + conditional TDD (P5 §2.4)", () => {
    const out = assembler.render({
      ...ALL_VALUES,
      ROLE: "fix",
      INPUT_REVIEWS: "/ws/tasks-1-review-1.json",
    });
    expect(out.startsWith("# CDD dispatch — fix round")).toBe(true);
    // verify-then-apply — the receiving-code-review core: VERIFY each finding
    // against the codebase's actual state, apply only what is technically sound
    expect(out).toContain("technically sound");
    expect(out).toMatch(/verify/i);
    // conditional TDD — the B1 appliesTo semantics: only when the finding demands a
    // behavior change AND the change lacks tests, never a blanket discipline
    expect(out).toContain("requires a behavior change");
  });

  it("T5 — the fix shell carries the work face's single strict-schema sentence — the schema declaration is the field source, zero enum", () => {
    const out = assembler.render({
      ...ALL_VALUES,
      ROLE: "fix",
      INPUT_REVIEWS: "/ws/tasks-1-review-1.json",
    });
    // the work face's ONE strict-schema directive — the declared properties are the
    // draft's field source (the keyset rides the injected `## Handoff schema` fence,
    // never an enumerated restate in the shell's own prose)
    expect(out).toContain(
      "every top-level field of the draft comes from the `## Handoff schema` declared `properties`",
    );
    expect(out).toContain("zero extra keys");
    // keyset zero-residue + the retired guard sentences are gone: the shell prose
    // enumerates no field and names no explicit INPUT_REVIEWS mirror ban
    expect(out).not.toContain("**Writable fields:**");
    expect(out).not.toContain("accepts exactly");
    expect(out).not.toContain("**Findings read-only:**");
  });

  it("T5 — the docs-fix shell carries the findings face's single strict-schema sentence — the required findings rides from INPUT_REVIEWS verbatim (no contradiction with the required gate)", () => {
    const out = assembler.render({
      ...ALL_VALUES,
      ROLE: "docs-fix",
      INPUT_SPEC: "docs/x-design.md",
    });
    // the findings face's ONE strict-schema directive — same schema-first wording,
    // the required `findings` told how to fill (the verbatim carry-over), so the
    // sentence never reads "findings required but do not write it"
    expect(out).toContain(
      "every top-level field of the draft comes from the `## Handoff schema` declared `properties`",
    );
    expect(out).toContain("`findings` (required) rides over from `INPUT_REVIEWS` verbatim");
    expect(out).toContain("zero extra keys");
    // keyset zero-residue + the retired carried-as-is guard marker is gone
    expect(out).not.toContain("**Writable fields:**");
    expect(out).not.toContain("accepts exactly");
    expect(out).not.toContain("**Findings carried as-is:**");
    expect(out).not.toContain("VERBATIM");
  });

  it("renders the review mode per type — the criteria/lens fold into the fixed prefix", () => {
    // a spec review: the URC criteria + its lens ride the shell (fixed region), the
    // round context carries only the review's dynamic facts
    const spec = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      REVIEW_TYPE: "spec",
      INPUT_WAVE_BRIEF: "",
      INPUT_SPEC: "docs/kairos/specs/s1-design.md",
      OUTPUT_HANDOFF: "/ws/spec-review-1.json",
    });
    expect(spec.startsWith("# CDD dispatch — review round")).toBe(true);
    expect(spec).toContain("**Criteria — spec:**");
    expect(spec).toContain("Follow URC");
    expect(spec).toContain("completeness | consistency | clarity");
    // the claimed→pin clause (T4) — every behavior claim must cite a colocated pin;
    // the spec + plan review variants carry it (the task/branch variants do not)
    expect(spec).toContain("Claimed→pin");
    // the review-quality clauses (P10/D49) — every axis carries the vision-document
    // rule (silence is not permission), the declined-to-judge ledger, and severity
    // calibration; pinned per distinctive phrase
    expect(spec).toContain("its silence is not permission");
    expect(spec).toContain("nothing set aside is dropped silently");
    expect(spec).toContain("accurate praise earns the rest of the report trust");
    expect(spec).toContain("- `INPUT_SPEC`: docs/kairos/specs/s1-design.md");
    expect(spec).not.toContain("- `INPUT_PLAN`");
    expect(spec).not.toContain("- `INPUT_WAVE_BRIEF`");
    expect(spec).not.toContain("- `INPUT_REVIEWS`");
    expect(spec).not.toContain("- `FIX_BASE`");
    expect(spec).not.toContain("BASE_BRANCH"); // spec review carries no scope anchor
    // a task review selects its own variant — the task axes + lens + the wave brief
    const task = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      REVIEW_TYPE: "wave",
      BASE_BRANCH: "develop",
      OUTPUT_HANDOFF: "/ws/tasks-1-review-1.json",
    });
    expect(task).toContain("**Criteria — wave:**");
    expect(task).toContain("Standards axis");
    expect(task).toContain("standards | spec | buildability");
    expect(task).toContain("- `INPUT_WAVE_BRIEF`: /ws/tasks-4,12-brief.md");
    expect(task).toContain("- `BASE_BRANCH`: develop");
    expect(task).not.toContain("Follow URC");
    expect(task).not.toContain("Claimed→pin"); // the task axes carry no clause
    // every review axis (task/branch/spec/plan) carries the three review-quality
    // clauses (P10/D49) — here on the wave variant
    expect(task).toContain("its silence is not permission");
    expect(task).toContain("nothing set aside is dropped silently");
    expect(task).toContain("accurate praise earns the rest of the report trust");
    // a branch review carries the single doc anchor (the plan) + the scope anchor
    // BASE_BRANCH — the shared review layout carries the slot (§3.1/§3.2)
    const branch = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      REVIEW_TYPE: "branch",
      INPUT_WAVE_BRIEF: "",
      INPUT_PLAN: "docs/kairos/plans/p.md",
      INPUT_SPEC: "docs/kairos/specs/p-design.md",
      BASE_BRANCH: "develop",
      OUTPUT_HANDOFF: "/ws/branch-review-1.json",
    });
    expect(branch).toContain("- `INPUT_PLAN`: docs/kairos/plans/p.md");
    expect(branch).toContain("- `INPUT_SPEC`: docs/kairos/specs/p-design.md");
    expect(branch).toContain("- `BASE_BRANCH`: develop");
    // the branch variant carries the three review-quality clauses too (P10/D49)
    expect(branch).toContain("its silence is not permission");
    expect(branch).toContain("nothing set aside is dropped silently");
    expect(branch).toContain("accurate praise earns the rest of the report trust");
    // a plan review carries the same claimed→pin clause as the spec variant; the
    // semantic spec/plan-absent anchor rule (the tree-review faces only) is the
    // lifecycle-injection concern — pinned at the CLI dispatch face (cli.test.ts)
    const plan = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      REVIEW_TYPE: "plan",
      INPUT_WAVE_BRIEF: "",
      INPUT_PLAN: "docs/kairos/plans/p.md",
      INPUT_SPEC: "docs/kairos/specs/p-design.md",
      OUTPUT_HANDOFF: "/ws/plan-review-1.json",
    });
    expect(plan).toContain("**Criteria — plan:**");
    expect(plan).toContain("Claimed→pin");
    // a plan review carries the plan's design-spec anchor (INPUT_SPEC) so the
    // reviewer judges the plan against the spec it implements
    expect(plan).toContain("- `INPUT_PLAN`: docs/kairos/plans/p.md");
    expect(plan).toContain("- `INPUT_SPEC`: docs/kairos/specs/p-design.md");
    // the spec review's judged doc IS the spec — carries INPUT_SPEC only; the wave
    // review carries neither judged-doc anchor (the empty slots are dropped by the
    // assembler)
    const wave = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      REVIEW_TYPE: "wave",
      BASE_BRANCH: "develop",
      OUTPUT_HANDOFF: "/ws/tasks-1-review-1.json",
    });
    expect(wave).not.toContain("- `INPUT_PLAN`");
    expect(wave).not.toContain("- `INPUT_SPEC`");
  });

  it("P14 — the sync-completion clause lands identically on implement / review / fix shells (single LICENSE_ITEMS source)", () => {
    // Required tokens from design §2.1: bg_run, bg_delegate, before the handoff,
    // synchronously / same turn — nested work finishes in-process before the draft.
    const pins = [
      "bg_run",
      "bg_delegate",
      "before the handoff",
      "synchronously",
      "same turn",
    ] as const;
    const implement = assembler.render(ALL_VALUES);
    const review = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      REVIEW_TYPE: "wave",
      OUTPUT_HANDOFF: "/ws/tasks-1-review-1.json",
    });
    const fix = assembler.render({
      ...ALL_VALUES,
      ROLE: "fix",
      INPUT_REVIEWS: "/ws/tasks-1-review-1.json",
    });
    for (const out of [implement, review, fix]) {
      for (const pin of pins) {
        expect(out).toContain(pin);
      }
    }
    // single-source clause bytes — the three shells share one resolved hard sentence
    const sentence =
      "Finish nested work in this same turn before writing the handoff. Do not `bg_run` / `bg_delegate` (or equivalent yield-and-wait paths) before the handoff draft is written — nested work must complete synchronously in this process turn, then write the handoff and finish.";
    expect(implement).toContain(sentence);
    expect(review).toContain(sentence);
    expect(fix).toContain(sentence);
  });

  it("hard gates: a missing token value throws (named)", () => {
    const partial = { ...ALL_VALUES };
    delete partial.ROLE;
    expect(() => assembler.render(partial)).toThrow(/ROLE/);
    // an unknown ROLE is refused by the mode table (never a phantom assemble)
    expect(() => assembler.render({ ...ALL_VALUES, ROLE: "bogus" })).toThrow(/work-mode/);
    // a review without its REVIEW_TYPE discriminant is refused by the variants
    expect(() => assembler.render({ ...ALL_VALUES, ROLE: "review", REVIEW_TYPE: "" })).toThrow(
      /review type not declared/,
    );
  });

  it("hard gates: an undeclared value throws (the guard is the declared token list)", () => {
    expect(() => assembler.render({ ...ALL_VALUES, BOGUS: "x" })).toThrow(/undeclared/);
  });

  it("the shell↔layout consistency assertion — a shell naming a slot its layout never carries throws", () => {
    // construct a rogue mode whose shell references INPUT_PLAN but whose layout
    // carries it nowhere (the "claimed but not carried" gap the assertion closes)
    const modes = TEMPLATE_PROMPT.modes as Record<string, unknown>;
    const saved = modes.bogus;
    modes.bogus = {
      mode: "bogus",
      shell: ["# rogue", "**rogue:** read `INPUT_PLAN`"],
      roundContext: ["## Round context", "- `ROLE`: {{ROLE}}"],
    };
    try {
      expect(() => assembler.render({ ...ALL_VALUES, ROLE: "bogus" })).toThrow(
        /references INPUT_PLAN not carried by its round context/,
      );
    } finally {
      if (saved === undefined) delete modes.bogus;
      else modes.bogus = saved;
    }
    // every real declared mode renders cleanly under the assertion
    expect(() => assembler.render(ALL_VALUES)).not.toThrow();
    expect(() =>
      assembler.render({ ...ALL_VALUES, ROLE: "fix", INPUT_REVIEWS: "/f.json" }),
    ).not.toThrow();
  });
});

/** A two-task plan — task 1 steps all checkable, task 2 carries a bare step (the
 *  front-matter head the plan parser reads). */
const PLAN = [
  "---",
  "title: Test Plan",
  "doc-type: plan",
  "version: v1.0",
  "date: 2026-10-09",
  "spec: docs/kairos/specs/x-design.md",
  "parent-program: docs/kairos/specs/x-overall.md",
  "parent-version: v1.21",
  "---",
  "",
  "### Task 1: one",
  "- **Objective**: objective",
  "- **Files**: file",
  "- **Consumes**: consumes",
  "- **Produces**: produces",
  "- **Steps**:",
  "  - step with checkable — checkable: green",
  "  - step two — checkable: also green",
  "- **Acceptance**: acceptance",
  "- **DependsOn**: none",
  "",
  "### Task 2: two",
  "- **Objective**: objective",
  "- **Files**: file",
  "- **Consumes**: consumes",
  "- **Produces**: produces",
  "- **Steps**:",
  "  - bare step",
  "- **Acceptance**: acceptance",
  "- **DependsOn**: none",
].join("\n");

describe("BriefRenderer — the brief data rendering + the checkable gate", () => {
  const brief = new BriefRenderer();

  it("extracts the requested task blocks with fields, steps and checkables", () => {
    const { data, missing } = brief.extract(PLAN, [1, 2]);
    expect(missing).toEqual([]);
    expect(data.map((task) => task.id)).toEqual([1, 2]);
    expect(data[0].steps.map((step) => step.action)).toEqual(["step with checkable", "step two"]);
    expect(data[0].steps[1].checkable).toBe("also green");
    expect(data[1].fields.map((field) => field.key)).toContain("Objective");
  });

  it("checkable gate: a step without — checkable: is reported and blocks the verdict", () => {
    const { data } = brief.extract(PLAN, [1, 2]);
    expect(data[0].checkableComplete).toBe(true);
    expect(data[1].checkableComplete).toBe(false);
    expect(data[1].missingCheckables).toEqual(["bare step"]);
  });

  it("the task-heading pattern rides the parse face (T3 tokens consumption)", () => {
    expect(brief.taskHeadingPattern()?.test("### Task 3:")).toBe(true);
    expect(brief.taskHeadingPattern()?.test("### Task 12:")).toBe(true);
  });

  it("out-of-bounds: a missing task id is listed and the render blocks", () => {
    const { missing } = brief.extract(PLAN, [1, 5]);
    expect(missing).toEqual([5]);
    expect(() => brief.render(PLAN, [1, 5])).toThrow(/task 5/);
  });

  it("renders the brief content — the raw task sections + the plan's ## Constraints mirror", () => {
    const planWithConstraints = `${PLAN}\n\n## Constraints\n\n- keep it simple\n`;
    const out = brief.render(planWithConstraints, [1]);
    expect(out).toContain("### Task 1: one");
    expect(out).toContain("- **Objective**: objective");
    expect(out).toContain("## Constraints");
    expect(out).toContain("- keep it simple");
    expect(out).not.toContain("WAVE_BASE");
    // a plan without a ## Constraints section renders the task sections alone
    const bare = brief.render(PLAN, [1]);
    expect(bare).not.toContain("## Constraints");
  });
});

// ---------------------------------------------------------------------------
// the issue-body renderer suite (T19 — the renderer's home is render/, the P7
// translation-system render landing; migrated from the cli.test.ts renderer tests)
// ---------------------------------------------------------------------------

describe("IssueBodyRenderer — the aggregate issue body (the P7 render face)", () => {
  const words = new Words();
  const translator = new Translator(words);
  const renderer = new IssueBodyRenderer(words, translator);

  /** The canonical en-aggregate input — one bug finding + the dedup/related tails. */
  const EN_INPUT: IssueReportInput = {
    harness: "claude",
    findings: [
      {
        type: "bug",
        lang: "en",
        context: "c",
        problem: "p",
        impact: "i",
        suggestedFix: "f",
        meta: { skill: "cdd-dev", step: "implement" },
      },
    ],
    related: {
      open: [{ issue: 1, component: "cdd", reason: "dup" }],
      closed: [{ issue: 9 }],
      program: { issue: 2 },
    },
  };

  it("renders the deterministic body — harness line, the en four-segment labels, attribution, dedup, related", () => {
    const out = renderer.renderBody(EN_INPUT);
    expect(out).toContain("# CDD aggregate issue");
    expect(out).toContain("- Harness: claude");
    expect(out).toContain("## Context\n\nc");
    expect(out).toContain("## Problem\n\np");
    expect(out).toContain("## Impact\n\ni");
    expect(out).toContain("## Suggested fix\n\nf");
    expect(out).toContain("- Skill: cdd-dev\n- Step: implement");
    expect(out).toContain("- Dedup → #1 (open)：cdd · dup");
    expect(out).toContain("- Regression / follow-up of #9 (closed)");
    expect(out).toContain("- Program: #2");
  });

  it("renders the zh labels through the translation layer (the locale-normalized render face)", () => {
    const zh = renderer.renderBody({
      harness: "claude",
      findings: [
        {
          type: "bug",
          lang: "zh",
          context: "c",
          problem: "p",
          impact: "i",
          suggestedFix: "f",
          meta: { skill: "s", step: "t" },
        },
      ],
    });
    expect(zh).toContain("## 场景\n\nc");
    expect(zh).toContain("## 问题\n\np");
    expect(zh).toContain("## 影响\n\ni");
    expect(zh).toContain("## 建议修复\n\nf");
  });

  it("the type × lang label variants — enhancement carries the Gap + Suggested direction wording", () => {
    const out = renderer.renderBody({
      harness: "claude",
      findings: [
        {
          type: "enhancement",
          lang: "en",
          context: "c",
          problem: "p",
          impact: "i",
          suggestedFix: "f",
          meta: { skill: "s", step: "t" },
        },
      ],
    });
    expect(out).toContain("## Gap\n\np");
    expect(out).toContain("## Suggested direction\n\nf");
  });

  it("langs — the projected language vocabulary (the word-table locale key projection, never a hardcoded list)", () => {
    expect(renderer.langs()).toEqual(words.localeKeys());
    // the validation rides the projection — a lang outside the project keys is refused
    // with the data-derived vocabulary message
    const errors = renderer.validateInput({
      harness: "claude",
      findings: [
        {
          type: "bug",
          lang: "fr",
          context: "c",
          problem: "p",
          impact: "i",
          suggestedFix: "f",
          meta: { skill: "s", step: "t" },
        },
      ],
    });
    expect(errors).toContain("findings[0].lang: must be one of en | zh");
  });

  it("validateInput — field-path errors for the type/enum and the segment/meta shapes", () => {
    expect(
      renderer.validateInput({
        harness: "claude",
        findings: [{ type: "bogus", lang: "en", meta: {} }],
      }),
    ).toEqual([
      "findings[0].type: must be one of bug | enhancement | chore",
      "findings[0].context: non-empty string required",
      "findings[0].problem: non-empty string required",
      "findings[0].impact: non-empty string required",
      "findings[0].suggestedFix: non-empty string required",
      "findings[0].meta.skill: non-empty string required",
      "findings[0].meta.step: non-empty string required",
    ]);
    expect(renderer.validateInput("bogus")).toEqual([
      "input: expected an object with harness / findings / related?",
    ]);
  });

  it("the label data is complete — every declared type × segment resolves on the word table", () => {
    const segments = ["context", "problem", "impact", "suggestedFix"];
    for (const type of renderer.types) {
      for (const segment of segments) {
        expect(words.localeRow(`${type}.${segment}`), `${type}.${segment}`).not.toBeNull();
      }
    }
  });
});
