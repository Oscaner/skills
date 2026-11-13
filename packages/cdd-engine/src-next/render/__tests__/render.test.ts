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
import {
  REVIEW_BODY_TEXT,
  REVIEWS,
  reviewGuideOf,
  TEMPLATE_PROMPT,
  TemplateAssembler,
} from "../templates.ts";

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
  INPUT_RULINGS: "",
  INPUT_PLAN: "",
  INPUT_SPEC: "",
  INPUT_OVERALL: "",
  BASE_BRANCH: "",
  OUTPUT_REPORT: "/ws/tasks-4,12-implement-report.md",
  OUTPUT_EVIDENCE: "/ws/tasks-4,12-test-evidence.json",
  OUTPUT_HANDOFF: "/ws/tasks-4,12-implement.json",
  TARGET_TYPE: "",
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
    // P33 T1 — the target discriminant is a declared round-context token (it renders
    // on every face that has a target; the value stays empty on implement)
    expect(assembler.declaredTokens()).toContain("TARGET_TYPE");
    // the retired reference tokens — the range/brief tokens are gone; INPUT_PLAN is
    // resurrected as the semantic plan-doc anchor (the kind-named round context)
    expect(assembler.declaredTokens()).not.toContain("INPUT_RANGE");
    expect(assembler.declaredTokens()).toContain("INPUT_PLAN");
    expect(assembler.declaredTokens()).toContain("INPUT_OVERALL");
    // D61-4 — the four review legs share REVIEW_CONTEXT; fix / docs-fix declare the
    // same slot beside INPUT_SPEC (implement carries no spec anchor, so no slot)
    for (const mode of ["fix", "docs-fix"] as const) {
      expect(TEMPLATE_PROMPT.modes[mode].roundContext.join("\n")).toContain("{{INPUT_OVERALL}}");
    }
    expect(TEMPLATE_PROMPT.modes.implement.roundContext.join("\n")).not.toContain("INPUT_OVERALL");
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
      INPUT_OVERALL: "docs/kairos/overalls/x-overall.md",
    });
    expect(out.startsWith("# CDD dispatch — docs-fix round")).toBe(true);
    expect(out).toContain("apply `INPUT_REVIEWS` (all severities) directly to the judged doc");
    expect(out).toContain("- `INPUT_SPEC`: docs/x-design.md");
    // P30 T3 — the two lineage edits the round must not get wrong: appending a
    // Change-history row bumps the front-matter version in the same edit, and a
    // table cell is never hard-wrapped.
    expect(out).toContain(
      "a new `## Change history` row bumps the front-matter `version:` in the same edit",
    );
    expect(out).toContain("never hard-wrap a table cell");
    // D61-4 — the docs-fix round context declares the parent charter slot too
    expect(out).toContain("- `INPUT_OVERALL`: docs/kairos/overalls/x-overall.md");
    expect(out).not.toContain("BASE_BRANCH");
    // the review-only keys stay out of the docs-fix context
    expect(out).not.toContain("INPUT_CRITERIA");
  });

  it("P33 T1 — the twelve target faces render their TARGET_TYPE word right after ROLE; implement carries none", () => {
    // The discriminant is a ROUND-CONTEXT fact (the child reads the target word the
    // CLI `--type` declared), one line below ROLE on every face that has a target:
    // the six review rows, the two fix rows (wave · branch) and the four docs-fix
    // rows (plan · phase-spec · overall · single-spec).
    const faces = [
      ...(["wave", "branch", "phase-spec", "overall", "plan", "single-spec"] as const).map(
        (type) => ({ role: "review", type }),
      ),
      ...(["wave", "branch"] as const).map((type) => ({ role: "fix", type })),
      ...(["plan", "phase-spec", "overall", "single-spec"] as const).map((type) => ({
        role: "docs-fix",
        type,
      })),
    ];
    // the matrix is complete by construction — twelve faces, no silent drop
    expect(faces).toHaveLength(12);
    for (const { role, type } of faces) {
      const out = assembler.render({
        ...ALL_VALUES,
        ROLE: role,
        TARGET_TYPE: type,
        INPUT_SPEC: "docs/x-design.md",
        INPUT_REVIEWS: "/ws/x-review-1.json",
      });
      // the line sits IMMEDIATELY below ROLE (one block, one reading order)
      expect(out, `${role}/${type}`).toContain(`- \`ROLE\`: ${role}\n- \`TARGET_TYPE\`: ${type}\n`);
    }
    // implement is the ONE role without a target: its layout carries no such line,
    // and the empty slot is dropped even when the value is supplied empty.
    const implement = assembler.render({ ...ALL_VALUES, ROLE: "implement" });
    expect(implement).not.toContain("TARGET_TYPE");
  });

  it("P33 T2 — the three referent sentences name the judged face, never a shared substitute (§2.5 A · B · D)", () => {
    // The review item rides every review row's fixed prefix. The shared sentence used
    // to fold the branch review into the plan review, contradicting the branch
    // criteria body (branch review IS the full diff).
    const reviewItem = TEMPLATE_PROMPT.reviews.branch.shell.join("\n");
    expect(reviewItem).toContain("the branch review judges the live tree");
    expect(reviewItem).not.toContain("the plan/branch reviews judge the plan");
    // the plan review still reads the plan document as its judged doc
    expect(reviewItem).toContain("the plan review judges the plan at `INPUT_PLAN`");
    // the spec / overall faces carry their own judged anchor, one sentence each
    expect(reviewItem).toContain("the spec review judges the spec at `INPUT_SPEC`");
    expect(reviewItem).toContain("the overall review judges the charter at `INPUT_OVERALL`");
    // A — the fix shell reaches no spec line; the branch line's INPUT_SPEC is a
    // conformance reference, never the judged document
    const fix = TEMPLATE_PROMPT.modes.fix.shell.join("\n");
    expect(fix).not.toContain("the spec line");
    expect(fix).toContain("never the judged document");
    // D — the docs-fix shell marks the plan-doc line's spec reference un-editable in
    // this round and names the overall line's own anchor
    const docsFix = TEMPLATE_PROMPT.modes["docs-fix"].shell.join("\n");
    expect(docsFix).toContain("never edited here");
    expect(docsFix).toContain("`INPUT_OVERALL` on the overall line");
  });

  it("P33 T2/C2 — the overall face renders ONE charter anchor (no INPUT_SPEC line); the four doc faces keep theirs", () => {
    // #valuesOf empties INPUT_SPEC on the overall face (C2 — the charter is never its
    // own spec), and the assembler drops the empty slot, so the overall review and
    // docs-fix round contexts carry INPUT_OVERALL alone. The four doc faces keep the
    // spec anchor they judge or reference.
    for (const role of ["review", "docs-fix"] as const) {
      const out = assembler.render({
        ...ALL_VALUES,
        ROLE: role,
        TARGET_TYPE: "overall",
        INPUT_SPEC: "",
        INPUT_OVERALL: "docs/kairos/overalls/x-overall.md",
        INPUT_REVIEWS: "/ws/x-review-1.json",
      });
      expect(out, role).toContain("- `INPUT_OVERALL`: docs/kairos/overalls/x-overall.md");
      expect(out, role).not.toContain("- `INPUT_SPEC`");
    }
    // the slot IS declared on both faces — the missing line comes from the empty
    // value (C2), never from a hole in the layout
    expect(TEMPLATE_PROMPT.reviews.overall.roundContext.join("\n")).toContain("{{INPUT_SPEC}}");
    expect(TEMPLATE_PROMPT.modes["docs-fix"].roundContext.join("\n")).toContain("{{INPUT_SPEC}}");
    for (const { role, type } of [
      { role: "review", type: "plan" },
      { role: "review", type: "branch" },
      { role: "docs-fix", type: "phase-spec" },
      { role: "docs-fix", type: "single-spec" },
    ] as const) {
      const out = assembler.render({
        ...ALL_VALUES,
        ROLE: role,
        TARGET_TYPE: type,
        INPUT_SPEC: "docs/x-design.md",
        INPUT_REVIEWS: "/ws/x-review-1.json",
      });
      expect(out, `${role}/${type}`).toContain("- `INPUT_SPEC`: docs/x-design.md");
    }
  });

  it("P33 T3/G — the three work shells' freeze and capability sentences self-limit instead of contradicting (§2.6 G)", () => {
    // The shared clause block is unconditional, so the freeze sentence must bound
    // itself to the round's declared capability. The capability declaration is the
    // load-bearing side: it names the judged document families by their own words,
    // so a docs-fix round on any of the four never reads "amend the charter" beside
    // "freeze the spec".
    const workFaces = [
      { role: "implement", type: "" },
      { role: "fix", type: "wave" },
      { role: "docs-fix", type: "phase-spec" },
    ] as const;
    for (const { role, type } of workFaces) {
      const out = assembler.render({
        ...ALL_VALUES,
        ROLE: role,
        TARGET_TYPE: type,
        INPUT_SPEC: "docs/x-design.md",
        INPUT_REVIEWS: "/ws/x-review-1.json",
      });
      expect(out, role).toContain(
        "frozen beyond the round's declared `capability: may.amend` scope",
      );
      expect(out, role).toContain("never an in-place edit");
      expect(out, role).toContain(
        "the structure face is outside amending authority in every round",
      );
      // the old absolute claim is gone — it contradicted the authorization above it
      expect(out, role).not.toContain("zero modification");
      // the declaration itself names all four judged document families — pinned on
      // its own line, not on the prompt at large ("plan" reads in plenty of other
      // sentences there)
      const capability = TEMPLATE_PROMPT.modes[role].shell
        .filter((line) => line.includes("capability: may.amend = content"))
        .join("\n");
      expect(capability, role).toContain(
        "the phase-spec, single-spec, overall charter and plan families",
      );
      for (const family of ["phase-spec", "single-spec", "overall charter", "plan"] as const) {
        expect(capability, `${role} capability names ${family}`).toContain(family);
      }
      // the structure-face ban is untouched by the wording change
      expect(capability, role).toContain("the plan's Task id set and any task's `DependsOn` set");
    }
  });

  it("P33 T3/H — a read-only round's commit clause says there is nothing to commit (§2.6 H)", () => {
    const out = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      TARGET_TYPE: "wave",
      BASE_BRANCH: "develop",
      OUTPUT_HANDOFF: "/ws/tasks-1-review-1.json",
    });
    expect(out).toContain("A read-only round has nothing to commit");
    expect(out).toContain("its only writes are the prescribed `OUTPUT_*` artifacts");
    expect(out).toContain("committing belongs to the orchestrator");
  });

  it("P33 T3/I · J · K — the shared body's three vocabulary fixes name the right object (§2.6 I · J · K)", () => {
    // I — the program-conformance clause is scoped to the phase, the only document
    // shape that carries a `program:` and a live `INPUT_OVERALL`.
    expect(REVIEWS.spec.axesGuide).toContain("program conformance (phase-spec only");
    for (const type of ["phase-spec", "single-spec"] as const) {
      const out = assembler.render({
        ...ALL_VALUES,
        ROLE: "review",
        TARGET_TYPE: type,
        INPUT_SPEC: "docs/x-design.md",
        OUTPUT_HANDOFF: `/ws/${type}-review-1.json`,
      });
      expect(out, type).toContain("program conformance (phase-spec only");
    }
    // J — the branch criteria body speaks the live vocabulary (task was renamed wave)
    const branchCriteria = TEMPLATE_PROMPT.reviews.branch.shell.find((line) =>
      line.startsWith("**Criteria — branch:**"),
    );
    expect(branchCriteria).toContain("Same four axes as the wave review");
    expect(branchCriteria).not.toContain("as task");
    // K — the charter's rubric reads charter / phase author, never spec
    expect(REVIEW_BODY_TEXT.overall).toEqual({ artifact: "charter", audience: "phase author" });
    const overall = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      TARGET_TYPE: "overall",
      INPUT_SPEC: "",
      INPUT_OVERALL: "docs/kairos/overalls/x-overall.md",
      OUTPUT_HANDOFF: "/ws/overall-review-1.json",
    });
    expect(overall).toContain("The reviewed charter is a vision");
    expect(overall).toContain("a reasonable phase author would expect");
    expect(overall).not.toContain("The reviewed spec is a vision");
  });

  it("P33 T3 — the nine shells keep their titles, criteria labels and lens lines byte-identical", () => {
    // The I / J / K fixes change criteria BODIES; the labels that identify a row stay
    // byte-frozen, and so do the first-line titles of the three work shells.
    const reviewFaces = [
      ["wave", "**Criteria — wave:**", "standards | spec | buildability"],
      ["branch", "**Criteria — branch:**", "standards | spec | buildability"],
      ["phase-spec", "**Criteria — phase-spec:**", "completeness | consistency | clarity"],
      ["single-spec", "**Criteria — single-spec:**", "completeness | consistency | clarity"],
      ["plan", "**Criteria — plan:**", "completeness | decomposition | buildability"],
      [
        "overall",
        "**Criteria — overall:**",
        "scope | inventory | dependency | acceptance | boundary",
      ],
    ] as const;
    for (const [type, label, lens] of reviewFaces) {
      const shell = TEMPLATE_PROMPT.reviews[type].shell;
      expect(shell[0], type).toBe("# CDD dispatch — review round");
      expect(shell, type).toContain(
        `**Lens labels:** one of \`${lens}\` — every finding MUST carry its \`lens\`.`,
      );
      expect(
        shell.filter((line) => line.startsWith("**Criteria — ")),
        type,
      ).toHaveLength(1);
      const criteriaLine = shell.find((line) => line.startsWith("**Criteria — ")) ?? "";
      expect(criteriaLine.startsWith(label), `${type} criteria label`).toBe(true);
    }
    const workFaces = [
      ["implement", "# CDD dispatch — implement round"],
      ["fix", "# CDD dispatch — fix round"],
      ["docs-fix", "# CDD dispatch — docs-fix round"],
    ] as const;
    for (const [role, title] of workFaces) {
      expect(TEMPLATE_PROMPT.modes[role].shell[0], role).toBe(title);
      expect(
        TEMPLATE_PROMPT.modes[role].shell.filter((line) => line.startsWith("**Criteria — ")),
        role,
      ).toEqual([]);
    }
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
        TARGET_TYPE: "phase-spec",
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
        TARGET_TYPE: "phase-spec",
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
      INPUT_OVERALL: "docs/kairos/overalls/x-overall.md",
    });
    expect(out.startsWith("# CDD dispatch — fix round")).toBe(true);
    // D61-4 — the fix round context declares the parent charter slot too
    expect(out).toContain("- `INPUT_OVERALL`: docs/kairos/overalls/x-overall.md");
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

  it("T5/D62 — the docs-fix shell carries the work plane's generic strict-schema sentence and reports its outcome in status", () => {
    const out = assembler.render({
      ...ALL_VALUES,
      ROLE: "docs-fix",
      INPUT_SPEC: "docs/x-design.md",
    });
    // the SAME strict-schema directive the work shells carry — the injected
    // declaration is the draft's single field source, zero per-mode field enumeration
    expect(out).toContain(
      "every top-level field of the draft comes from the `## Handoff schema` declared `properties`",
    );
    expect(out).toContain("zero extra keys");
    // D62 — the docs-fix round reports its conclusion in the work plane's `status`
    // slot (the old residual-findings / derived-conclusion contradiction is gone)
    expect(out).toContain("record the path in `artifacts.doc` and report the round in `status`");
    expect(out).toContain(
      "APPROVED once every finding is applied, else BLOCKED + the reason in `notes`",
    );
    expect(out).not.toContain("residual findings");
    expect(out).not.toContain("`findings` (required) rides over from `INPUT_REVIEWS`");
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
      TARGET_TYPE: "phase-spec",
      INPUT_WAVE_BRIEF: "",
      INPUT_SPEC: "docs/kairos/specs/s1-design.md",
      INPUT_OVERALL: "docs/kairos/overalls/s1-overall.md",
      OUTPUT_HANDOFF: "/ws/phase-spec-review-1.json",
    });
    expect(spec.startsWith("# CDD dispatch — review round")).toBe(true);
    expect(spec).toContain("**Criteria — phase-spec:**");
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
    // D61-4 — the parent charter the spec's `program:` names rides the same round
    // context (INPUT_OVERALL mirrors INPUT_SPEC; the spec face carries it)
    expect(spec).toContain("- `INPUT_OVERALL`: docs/kairos/overalls/s1-overall.md");
    // the shared REVIEW_ITEM half-sentence names the token's existence condition, so
    // an empty slot reads "no parent charter", never "not applicable"
    expect(spec).toContain("the parent charter at `INPUT_OVERALL`");
    // D61-5 — the spec axis carries its program conformance criterion (the phase
    // judged against its charter's registered Phase inventory), lens set unchanged
    expect(REVIEWS.spec.axesGuide).toContain("program conformance");
    expect(REVIEWS.spec.axesGuide).toContain("INPUT_OVERALL");
    // the shared calibration tail is the fragment's, reached through `reviewGuideOf`
    expect(reviewGuideOf("spec")).toContain("reasonable downstream author");
    expect(REVIEWS.spec.lensEnum).toEqual(["completeness", "consistency", "clarity"]);
    expect(spec).not.toContain("- `INPUT_PLAN`");
    expect(spec).not.toContain("- `INPUT_WAVE_BRIEF`");
    expect(spec).not.toContain("- `INPUT_REVIEWS`");
    expect(spec).not.toContain("- `FIX_BASE`");
    expect(spec).not.toContain("BASE_BRANCH"); // spec review carries no scope anchor
    // P16/D60 — the two hard review disciplines ride the shared fixed prefix, so
    // every review variant carries them (assembled-face pin)
    expect(spec).toContain("**Read-only:**");
    expect(spec).toContain("**Single agent:**");
    // a task review selects its own variant — the task axes + lens + the wave brief
    const task = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      TARGET_TYPE: "wave",
      BASE_BRANCH: "develop",
      OUTPUT_HANDOFF: "/ws/tasks-1-review-1.json",
    });
    expect(task).toContain("**Criteria — wave:**");
    expect(task).toContain("Standards axis");
    expect(task).toContain("standards | spec | buildability");
    expect(task).toContain("- `INPUT_WAVE_BRIEF`: /ws/tasks-4,12-brief.md");
    expect(task).toContain("- `BASE_BRANCH`: develop");
    // the wave face carries no `program:` spec — the INPUT_OVERALL slot is empty
    // and dropped (the fixed-prefix half-sentence still names the condition)
    expect(task).not.toContain("- `INPUT_OVERALL`");
    expect(task).toContain("the parent charter at `INPUT_OVERALL`");
    expect(task).not.toContain("Follow URC");
    expect(task).not.toContain("Claimed→pin"); // the task axes carry no clause
    // P16/D60 — the read-only discipline names its boundary (the review's only
    // writes are the prescribed OUTPUT_* drafts); the single-agent discipline
    // overrides any dispatched skill's parallel-sub-agent default
    expect(task).toContain("**Read-only:**");
    expect(task).toContain("prescribed `OUTPUT_*` artifacts are a review's only writes");
    expect(task).toContain("**Single agent:**");
    expect(task).toContain("never spawn a subagent");
    expect(task).toContain("overrides any dispatched skill's parallel-sub-agent default");
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
      TARGET_TYPE: "branch",
      INPUT_WAVE_BRIEF: "",
      INPUT_PLAN: "docs/kairos/plans/p.md",
      INPUT_SPEC: "docs/kairos/specs/p-design.md",
      BASE_BRANCH: "develop",
      OUTPUT_HANDOFF: "/ws/branch-review-1.json",
    });
    expect(branch).toContain("- `INPUT_PLAN`: docs/kairos/plans/p.md");
    expect(branch).toContain("- `INPUT_SPEC`: docs/kairos/specs/p-design.md");
    expect(branch).toContain("- `BASE_BRANCH`: develop");
    // the shared REVIEW_ITEM names the INPUT_OVERALL existence condition on every
    // review leg; the leg's own slot stays empty when its spec names no program
    expect(branch).toContain("the parent charter at `INPUT_OVERALL`");
    expect(branch).not.toContain("- `INPUT_OVERALL`");
    // P16/D60 — the branch axis carries the three judgment points; the single-agent
    // fact does not ride the axis guide (it lives in the shared REVIEW_ITEM)
    expect(branch).toContain("**Read-only:**");
    expect(branch).toContain("**Single agent:**");
    expect(branch).toContain("Three things a green run cannot show you");
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
      TARGET_TYPE: "plan",
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
    expect(plan).toContain("the parent charter at `INPUT_OVERALL`");
    expect(plan).not.toContain("- `INPUT_OVERALL`");
    // P16/D60 — the plan variant carries the shared two-discipline prefix too
    expect(plan).toContain("**Read-only:**");
    expect(plan).toContain("**Single agent:**");
    // the template contract's version tracks the fixed-prefix text (P16/D60: 12 → 13;
    // the sync-completion rewrite: 13 → 14; the handoff-carrier plane unification: 15 → 16;
    // issue #390 — the no-secret-access clause: 16 → 17; P22 §7.3 — the work plane's
    // capability declaration: 17 → 18; the docs-fix row's capability declaration
    // (the fix face's spec / plan dispatch): 18 → 19; P22 T15 — the charter's own
    // criteria body + the explicit criteria-body selection: 19 → 20; P33 T1 — the
    // target discriminant rendered as a round-context line on every targeted face: 20 → 21;
    // P33 T2 — the three referent sentences (§2.5 A · B · D): 21 → 22;
    // P33 T3 — the shared body's five calibrations (§2.6 G · H · I · J · K): 22 → 23)
    expect(TEMPLATE_PROMPT.$version).toBe(23);
    // the spec review's judged doc IS the spec — carries INPUT_SPEC only; the wave
    // review carries neither judged-doc anchor (the empty slots are dropped by the
    // assembler)
    const wave = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      TARGET_TYPE: "wave",
      BASE_BRANCH: "develop",
      OUTPUT_HANDOFF: "/ws/tasks-1-review-1.json",
    });
    expect(wave).not.toContain("- `INPUT_PLAN`");
    expect(wave).not.toContain("- `INPUT_SPEC`");
    expect(wave).not.toContain("- `INPUT_OVERALL`");
  });

  it("P22 §7.3 — the work-plane capability line rides every work row (a review declares nothing)", () => {
    // The document-amendment right is a PROMPT slot, never a carrier slot: the engine
    // judges the result (the structure-face snapshot), never the declaration. The
    // docs-fix row carries it too — the fix face's spec / plan dispatch IS docs-fix,
    // so the authorization must reach that row (and the structure-face ban with it).
    const line = "capability: may.amend = content";
    expect(TEMPLATE_PROMPT.modes.implement.shell.join("\n")).toContain(line);
    expect(TEMPLATE_PROMPT.modes.fix.shell.join("\n")).toContain(line);
    expect(TEMPLATE_PROMPT.modes["docs-fix"].shell.join("\n")).toContain(line);
    for (const variant of Object.values(TEMPLATE_PROMPT.reviews)) {
      expect(variant.shell.join("\n")).not.toContain(line);
    }
  });

  it("P14 — the sync-completion clause lands identically on implement / review / fix shells (single LICENSE_ITEMS source)", () => {
    // Required tokens from design §2.1: bg_run, bg_delegate, before the handoff,
    // synchronously / same turn — nested work finishes in-process before the draft.
    // The rewrite (v14) additionally names the one-shot fact and the subagent class:
    // the child must know WHY the ban is absolute, and that a nested agent counts.
    const pins = [
      "bg_run",
      "bg_delegate",
      "before the handoff",
      "synchronously",
      "same turn",
      "one-shot",
      "non-interactive",
      "background subagent",
    ] as const;
    const implement = assembler.render(ALL_VALUES);
    const review = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      TARGET_TYPE: "wave",
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
      "This dispatch is one-shot and non-interactive: end your turn with anything still running and the process exits — the work and the handoff die with it. So do not end your turn — a background command, a background subagent, or any yield-and-wait path such as `bg_run` / `bg_delegate` — before the handoff draft is written. Finish nested work in this same turn: complete it synchronously in this process turn, then write the handoff and finish.";
    expect(implement).toContain(sentence);
    expect(review).toContain(sentence);
    expect(fix).toContain(sentence);
  });

  it("issue #390 — the no-secret-access clause lands identically on every dispatch shell (single LICENSE_ITEMS source)", () => {
    // A dispatched child runs with the harness's full authority (an unrestricted Bash
    // tool), so the fixed prefix is the only surface that can bar it from user
    // credentials. Required: no reading / printing / deriving a secret, the named
    // credential surfaces (keychain · credential files · token env vars), and the
    // report-don't-acquire exit (BLOCKED on a work round · a finding on a review).
    const pins = [
      "Never read, print, or derive a user secret",
      "keychain",
      "~/.ssh",
      "~/.aws/credentials",
      "~/.netrc",
      "environment variable",
      "BLOCKED",
      "finding",
      "[REDACTED]",
    ] as const;
    const implement = assembler.render(ALL_VALUES);
    const fix = assembler.render({
      ...ALL_VALUES,
      ROLE: "fix",
      INPUT_REVIEWS: "/ws/wave-1-review-1.json",
    });
    const docsFix = assembler.render({
      ...ALL_VALUES,
      ROLE: "docs-fix",
      INPUT_SPEC: "docs/x-design.md",
      INPUT_OVERALL: "docs/kairos/overalls/x-overall.md",
    });
    const reviews = (
      ["wave", "branch", "phase-spec", "overall", "plan", "single-spec"] as const
    ).map((type) =>
      assembler.render({
        ...ALL_VALUES,
        ROLE: "review",
        TARGET_TYPE: type,
        INPUT_SPEC: "docs/x-design.md",
        OUTPUT_HANDOFF: `/ws/tasks-1-${type}-review-1.json`,
      }),
    );
    for (const out of [implement, fix, docsFix, ...reviews]) {
      for (const pin of pins) {
        expect(out).toContain(pin);
      }
    }
  });

  it("hard gates: a missing token value throws (named)", () => {
    const partial = { ...ALL_VALUES };
    delete partial.ROLE;
    expect(() => assembler.render(partial)).toThrow(/ROLE/);
    // an unknown ROLE is refused by the mode table (never a phantom assemble)
    expect(() => assembler.render({ ...ALL_VALUES, ROLE: "bogus" })).toThrow(/work-mode/);
    // a review without its TARGET_TYPE discriminant is refused by the variants
    expect(() => assembler.render({ ...ALL_VALUES, ROLE: "review", TARGET_TYPE: "" })).toThrow(
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
  "slug: x-p3",
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

  it("taskBody — the task-only projection the reviewed hash binds, `## Constraints` excluded", () => {
    const planWithConstraints = `${PLAN}\n\n## Constraints\n\n- keep it simple\n`;
    const body = brief.taskBody(planWithConstraints, [1]);
    expect(body).toContain("### Task 1: one");
    expect(body).not.toContain("## Constraints");
    // the child's render is that projection plus the Constraints mirror
    expect(brief.render(planWithConstraints, [1])).toContain(body.trimEnd());
    // out-of-bounds blocks the projection too (one gate, two consumers)
    expect(() => brief.taskBody(PLAN, [5])).toThrow(/task 5/);
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

  /** A findings-valid input — the related leg is judged alone (zero findings noise). */
  const VALID_FINDINGS = [
    {
      type: "bug",
      lang: "en",
      context: "c",
      problem: "p",
      impact: "i",
      suggestedFix: "f",
      meta: { skill: "cdd-dev", step: "implement" },
    },
  ];
  const RELATED_MESSAGE = "related: object with open / closed / program expected";

  it("validateInput — a FLAT related is refused with the related field path (the nested shape is the only one)", () => {
    // the acceptance face: a flat array renders no Related section today, so the
    // shape gate — never a silent drop — is what keeps dedup trustworthy
    expect(
      renderer.validateInput({
        harness: "claude",
        findings: VALID_FINDINGS,
        related: [{ issue: 1 }],
      }),
    ).toEqual([RELATED_MESSAGE]);
  });

  it("validateInput — a null / scalar related is refused with the same related field path", () => {
    for (const related of [null, "x", 7]) {
      expect(
        renderer.validateInput({ harness: "claude", findings: VALID_FINDINGS, related }),
        `related: ${JSON.stringify(related)}`,
      ).toEqual([RELATED_MESSAGE]);
    }
  });

  it("validateInput — the nested related leg reports element field paths", () => {
    expect(
      renderer.validateInput({
        harness: "claude",
        findings: VALID_FINDINGS,
        related: {
          open: [{ issue: 1 }],
          closed: [5],
          program: {},
        },
      }),
    ).toEqual([
      "related.open[0].component: non-empty string required",
      "related.open[0].reason: non-empty string required",
      "related.closed[0]: object with issue required",
      "related.program.issue: number required",
    ]);
  });

  it("validateInput — a non-array open / closed and a non-object program carry their own paths", () => {
    expect(
      renderer.validateInput({
        harness: "claude",
        findings: VALID_FINDINGS,
        related: { open: "x", closed: {}, program: "y" },
      }),
    ).toEqual([
      "related.open: array of open hits expected",
      "related.closed: array of closed hits expected",
      "related.program: object with issue required",
    ]);
  });

  it("validateInput — a legal nested related and an absent related add zero errors", () => {
    expect(
      renderer.validateInput({
        harness: "claude",
        findings: VALID_FINDINGS,
        related: EN_INPUT.related,
      }),
    ).toEqual([]);
    expect(renderer.validateInput({ harness: "claude", findings: VALID_FINDINGS })).toEqual([]);
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

// ---------------------------------------------------------------------------
// P31 T2 — the fix round's `INPUT_RULINGS` input cell (design spec §2.5)
// ---------------------------------------------------------------------------

/** The fix round's standing values — the mode asserts on top of them. */
const FIX_VALUES: Record<string, string> = {
  ...ALL_VALUES,
  ROLE: "fix",
  INPUT_PLAN: "docs/kairos/plans/p.md",
  INPUT_REVIEWS: "/ws/tasks-1-review-1.json",
};

describe("P31 T2 — INPUT_RULINGS rides the fix input side alone", () => {
  it("renders the sidecar line and its rulings body when the fix round carries one", () => {
    const out = new TemplateAssembler().render({
      ...FIX_VALUES,
      INPUT_RULINGS: [
        "/ws/tasks-1-review-1.rulings.json",
        "  - `F1` — ACCEPTED, the guard lands in W2",
        "  - `F2` — REJECTED as stated",
      ].join("\n"),
    });
    expect(out).toContain("- `INPUT_REVIEWS`: /ws/tasks-1-review-1.json");
    expect(out).toContain("- `INPUT_RULINGS`: /ws/tasks-1-review-1.rulings.json");
    // The body rides the same bullet, indented below the path (§2.5 AC).
    expect(out).toContain("  - `F1` — ACCEPTED, the guard lands in W2");
    expect(out).toContain("  - `F2` — REJECTED as stated");
    // The rendered position is adjacent to INPUT_REVIEWS — the pair reads as one input.
    expect(out.indexOf("INPUT_RULINGS")).toBeGreaterThan(out.indexOf("INPUT_REVIEWS"));
  });

  it("emits no INPUT_RULINGS line on a fix round with no sidecar (the empty slot is dropped)", () => {
    const out = new TemplateAssembler().render(FIX_VALUES);
    expect(out).not.toContain("INPUT_RULINGS");
  });

  it("emits no INPUT_RULINGS line on a review round (the sidecar does not exist yet)", () => {
    const out = new TemplateAssembler().render({
      ...ALL_VALUES,
      ROLE: "review",
      TARGET_TYPE: "wave",
      INPUT_WAVE_BRIEF: "/ws/tasks-1-brief.md",
      INPUT_RULINGS: "/ws/tasks-1-review-1.rulings.json",
    });
    expect(out).not.toContain("INPUT_RULINGS");
  });
});
