// packages/cdd-engine/src/documents/__tests__/tokens.test.ts — canonical doc-structure tokens
// (P2 T2/T3; design §2.3 AC4 TC single-source evidence · S8). Every engine-side structure token
// derives from the doc-type shape domain (the overall shape constant + the P2 T2/T3 body-leaf
// projections for the phase-spec and plan faces — the same DocType.shape content the registry
// serves, passed into
// deriveDocTokens) — the "edit one canonical leaf → engine
// validation/extraction follow in the same build" evidence:
//   - deriveDocTokens(shapes) is pure: feed it a doctored shape → the derived token changes (the
//     derivation is LIVE, not a second hand-written copy);
//   - the production DOC_TOKENS values equal the shape-domain leaves (spot-pinned — the on-disk
//     config/schema products are the byte-faithful projections of these shapes, so the same
//     leaves hold transitively);
//   - the derived regexes keep their exact parsing semantics (version header, history cell,
//     task-heading colon form, Phase-inventory header, canonical column, constraints heading,
//     CLAIM family) — the canary surface for the repo doc set;
//   - the engine consumers (documents.ts / brief.ts / task.ts) consume via this module — the
//     "grep 删除面零残留" engine-side face, checked textually (no literal re-assignment).
//   - the token-plane deliberate-update verdict (the P2 T6 closure): the shape-domain housing
//     changed (the phase-spec / plan constants retired into the body-leaf projections), yet every
//     deriveDocTokens leaf stayed byte-identical — verified leaf-by-leaf against the pre-P2
//     schema products (31/31 leaves unchanged; `header.constraints.marker` included). The golds
//     pinned under "production values" below therefore hold verbatim from the pre-P2 gold — a
//     byte-unchanged token plane registers as unchanged evidence, never as a forced re-pin; the
//     derivation chain (DocType.shape → tokens) is what re-sources, not the values.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { SchemaShape } from "../doctype.ts";
import { OVERALL_SHAPE } from "../doctypes/body/overall-body.ts";
import { PHASE_SPEC_BODY_SHAPE } from "../doctypes/body/phase-spec-body.ts";
import { PLAN_BODY_SHAPE } from "../doctypes/body/plan-body.ts";
import { docTypeRegistry } from "../registry.ts";
import { DOC_TOKENS, deriveDocTokens } from "../tokens.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// packages/cdd-engine/src/documents/__tests__ → the engine src root (2 hops up from __tests__)
const ENGINE_SRC = path.resolve(HERE, "..", "..");

/** The three shape-domain faces deriveDocTokens needs — doctorable per-test. The base content is
 *  the shape-domain sources the production DOC_TOKENS and the registry's doc types carry (the shape
 *  constant / the P2 T2/T3 body-leaf projections) — the shape domain is the single source; the
 *  derived config/schema products are never re-read. The phase-spec face reads through the registry
 *  (test-body access, never module-top — the load-order graph stays one-way). */
function schemas(
  overrides: { plan?: SchemaShape; overall?: SchemaShape; phase?: SchemaShape } = {},
) {
  return {
    plan: overrides.plan ?? PLAN_BODY_SHAPE,
    overall: overrides.overall ?? OVERALL_SHAPE,
    "phase-spec": overrides.phase ?? docTypeRegistry.resolve("spec").shape,
  };
}

/** Deep-clone a DocType.shape object (the writable mutation surface for doctored-shape tests). */
function cloneSchema<T extends SchemaShape>(schema: T): T {
  return JSON.parse(JSON.stringify(schema)) as T;
}

describe("deriveDocTokens — live derivation from the shape domain", () => {
  it("doctored shape → derived tokens change (TC single-source实证)", () => {
    const base = deriveDocTokens(schemas());
    expect(base.specMark).toBe("**Spec:**");
    expect(base.versionHeaderRe.source).toContain("Version");

    // Doctored plan shape: the specRef marker const changes → the derived SPEC_MARK follows.
    const doctoredPlan = cloneSchema(PLAN_BODY_SHAPE);
    (doctoredPlan as any).properties.header.properties.specRef.properties.marker.const =
      "**Spec source:**";
    const re = deriveDocTokens(schemas({ plan: doctoredPlan }));
    expect(re.specMark).toBe("**Spec source:**");
    expect(re.specField).toBe("`**Spec source:**`");
  });

  it("doctored overall shape version line pattern → the version regex follows", () => {
    const doctored = cloneSchema(OVERALL_SHAPE);
    (doctored as any).properties.header.properties.version.properties.line.pattern =
      "^\\s*-?\\s*\\*\\*Program version\\*\\*:\\s*v\\d+\\.\\d+";
    const re = deriveDocTokens(schemas({ overall: doctored }));
    // the header regex now matches the doctored line shape
    expect(re.versionHeaderRe.test("- **Program version**: v1.0 · 2026-09-21")).toBe(true);
    expect(re.versionHeaderRe.test("- **Version**: v1.0 · 2026-09-21")).toBe(false);
  });

  it("the taskGroups tokens are retired — the shape node and the derived DOC_TOKENS keys are both gone (T4 deliberate update)", () => {
    // The dispatch-group declaration shape node is deleted: the plan shape maps no `## Task Groups`
    // section (the single-form plan owns only the `## Constraints` section), so the derived token
    // surface can never expose the retired taskGroups family. Pin the absence on BOTH faces — the
    // shape's root properties and every key deriveDocTokens returns — a re-adding shape edit
    // (a revoked read surface) fails loudly instead of silently re-authorizing a dead token.
    const planProps = PLAN_BODY_SHAPE.properties as Readonly<Record<string, unknown>>;
    expect("taskGroups" in planProps).toBe(false);
    const derivedKeys = Object.keys(deriveDocTokens(schemas()));
    for (const retired of [
      "taskGroupsHeading",
      "taskGroupsHeadingRe",
      "taskGroupsLineRe",
      "taskGroupsMinItems",
    ]) {
      expect(derivedKeys).not.toContain(retired);
    }
    // The shape still derives the surviving plan-leaf families live (the derivation law holds for
    // what remains — the Task-heading + `## Constraints` faces).
    expect(deriveDocTokens(schemas()).taskHeadingFormat).toBe("### Task N:");
    expect(deriveDocTokens(schemas()).constraintsHeading).toBe("## Constraints");
  });

  it("doctored phase-spec shape version marker → the derived leaf follows the page twin; a one-page drift throws", () => {
    // Phase-spec pages the shared version marker as its own const leaf. Doctoring BOTH pages to a
    // new value keeps them equal — the derived phase-spec leaf follows live from the shape edit.
    const doctoredOverall = cloneSchema(OVERALL_SHAPE);
    (doctoredOverall as any).properties.header.properties.version.properties.marker.const =
      "**Program version**";
    const doctoredPhase = cloneSchema(docTypeRegistry.resolve("spec").shape);
    (doctoredPhase as any).properties.header.properties.version.properties.marker.const =
      "**Program version**";
    const re = deriveDocTokens(schemas({ overall: doctoredOverall, phase: doctoredPhase }));
    expect(re.phaseSpecVersionMark).toBe("**Program version**");
    expect(re.phaseSpecVersionMark).toBe(re.versionMark);

    // Doctoring ONLY the phase-spec page (overall page untouched) is a drift — the load guard throws.
    expect(() => deriveDocTokens(schemas({ phase: doctoredPhase }))).toThrow(
      /phase-spec version marker/,
    );
  });
});

describe("deriveDocTokens — the DocType.shape-domain wiring (S8)", () => {
  it("DOC_TOKENS derives from the exact shape objects the registry's doc types carry (single source)", () => {
    // The identity is the single-source pin: the shapes DOC_TOKENS derives from ARE the DocType.shape
    // fields the registered doc types present — derivation and factory projection read the same content.
    // The plan + phase-spec faces are the body-leaf bindings (P2 T2/T3): the doc types' shapes ARE
    // the body projected shape leaves — the same values tokens.ts authorizes its DOC_TOKENS inputs
    // from (the retired shape constants are gone).
    expect(docTypeRegistry.resolve("plan").shape).toBe(PLAN_BODY_SHAPE);
    expect(docTypeRegistry.resolve("overall").shape).toBe(OVERALL_SHAPE);
    expect(docTypeRegistry.resolve("spec").shape).toBe(PHASE_SPEC_BODY_SHAPE);
    // Deriving through the registry's DocType.shape accessors reproduces the production surface —
    // every value token exact; the only functions are the parse-mechanics closures over the same
    // leaves (per-journey regex construction), so those are structurally skipped.
    const fromRegistry = deriveDocTokens({
      plan: docTypeRegistry.resolve("plan").shape,
      overall: docTypeRegistry.resolve("overall").shape,
      "phase-spec": docTypeRegistry.resolve("spec").shape,
    });
    for (const key of Object.keys(DOC_TOKENS)) {
      const production = (DOC_TOKENS as unknown as Record<string, unknown>)[key];
      const wired = (fromRegistry as unknown as Record<string, unknown>)[key];
      if (typeof production === "function" && typeof wired === "function") continue;
      expect(wired).toEqual(production);
    }
  });
});

describe("DOC_TOKENS — production values equal the shape-domain leaves (single source)", () => {
  // The golds below ARE the registered production values — byte-identical to the pre-P2 gold, so
  // the deliberate-update verdict is the unchanged-evidence declaration, never a re-pin (P2 T6).
  // Edit a gold here only when the shape-domain leaf it derives from changes for real.
  it("plan markers: specMark / parentMark / taskHeading / constraints", () => {
    expect(DOC_TOKENS.specMark).toBe("**Spec:**");
    expect(DOC_TOKENS.parentMark).toBe("**Parent program**");
    expect(DOC_TOKENS.taskHeadingFormat).toBe("### Task N:");
    expect(DOC_TOKENS.taskHeadingFor(7)).toBe("### Task 7:");
    expect(DOC_TOKENS.constraintsHeading).toBe("## Constraints");
    // The Form-B prose-anchor tokens are retired — the single constraint surface is the literal
    // `## Constraints` section (the token face holds no prose-anchor leaf).
    expect("proseAnchors" in DOC_TOKENS).toBe(false);
    expect("proseAnchorTokens" in DOC_TOKENS).toBe(false);
  });

  it("phase-spec version marker page-twin equals the overall leaf (canonical identity pinned)", () => {
    expect(DOC_TOKENS.phaseSpecVersionMark).toBe("**Version**");
    expect(DOC_TOKENS.phaseSpecVersionMark).toBe(DOC_TOKENS.versionMark);
  });

  it("task-heading regexes keep the exact colon-form parsing semantics", () => {
    // tolerant-titled headings (repo plans carry a title after the colon) must keep matching
    expect(DOC_TOKENS.taskNumberRe.test("### Task 1: runtime 单源翻转")).toBe(true);
    expect(DOC_TOKENS.taskNumberRe.exec("### Task 12: x")![1]).toBe("12");
    expect(DOC_TOKENS.taskHeadingRe.test("### Task 3:")).toBe(true);
  });

  it("version header / history cell / unanchored token scan keep exact semantics", () => {
    const m = "- **Version**: v1.0 · 2026-09-21".match(DOC_TOKENS.versionHeaderRe);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("v1.0");
    const c = "| v1.0 | 2026-09-21 | Initial |".match(DOC_TOKENS.historyVersionCellRe);
    expect(c![1]).toBe("v1.0");
    expect([..."[plan-overall.md v1.0 v1.1]".matchAll(DOC_TOKENS.versionTokenRe)]).toHaveLength(2);
  });

  it("Phase-inventory header / canonical column / change-history heading", () => {
    const header =
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |";
    expect(DOC_TOKENS.phaseHeaderRe.test(header)).toBe(true);
    expect(DOC_TOKENS.phaseHeaderRe.test("| P1 | phase one |")).toBe(false); // phase rows are not the header
    expect(DOC_TOKENS.canonicalColumnRe.test(header)).toBe(true);
    expect(
      DOC_TOKENS.canonicalColumnRe.test("| # | Phase | Scope | Implementation planning |"),
    ).toBe(false);
    expect(DOC_TOKENS.changeHistoryHeadingRe.test("## Change history")).toBe(true);
  });

  it("constraints heading — the single constraint surface token", () => {
    expect(DOC_TOKENS.constraintsHeadingRe.test("## Constraints")).toBe(true);
    expect(DOC_TOKENS.constraintsHeadingRe.test("### Constraint")).toBe(false);
    // the overall header constraints-block marker (the constitutional block the new-shape
    // spec/plan inherits — P2 T4) derives from the overall shape header.constraints.marker
    expect(DOC_TOKENS.overallConstraintsMark).toBe("**Constraints**:");
  });

  it("taskGroups tokens — retired from the production surface (the dispatch-group declaration is gone with its shape node)", () => {
    // The four taskGroups token fields are deleted from the DOC_TOKENS contract — the single-form
    // plan owns no `## Task Groups` section, so no derived token can name the retired layout.
    // The absence is pinned on the key set (the interface no longer carries the members), and the
    // plan leaf families that remain (taskHeading / constraints) keep their production values
    // (T4 deliberate update — the node deletion removes the members with it).
    const keys = Object.keys(DOC_TOKENS);
    for (const retired of [
      "taskGroupsHeading",
      "taskGroupsHeadingRe",
      "taskGroupsLineRe",
      "taskGroupsMinItems",
    ]) {
      expect(keys).not.toContain(retired);
    }
    expect(DOC_TOKENS.taskHeadingFormat).toBe("### Task N:");
    expect(DOC_TOKENS.constraintsHeading).toBe("## Constraints");
  });

  it("CLAIM family — the claimClause pattern is derived live and matches representatives", () => {
    const re = DOC_TOKENS.claimClauseRe;
    expect(re.exec("Pending → **Done**（PR #1）")![0]).toBe("Pending → **Done**");
    expect(re.exec("[Pending] -> P4-design v1.0")![0]).toBe("[Pending] -> P4-design");
    // dotted sub-phase design tokens embed literal periods — the target must parse the FULL token
    expect(re.exec("[Pending] -> p2.1-design v1.0")![0]).toBe("[Pending] -> p2.1-design");
    expect(re.test("Pending")).toBe(false);
  });

  it("four-table audit tokens — issue inventory / dependency graph headings + the claim/anchor/phase scans", () => {
    // Section headings (validator-keyed — same derivation family as the change-history heading).
    expect(DOC_TOKENS.issueInventoryHeading).toBe("## Issue inventory");
    expect(DOC_TOKENS.dependencyGraphHeadingRe.test("## Dependency graph")).toBe(true);
    expect(DOC_TOKENS.dependencyGraphHeadingRe.test("## Dependency graph (ASCII)")).toBe(true);
    expect(DOC_TOKENS.dependencyGraphHeadingRe.test("## Dependency graphs")).toBe(false);
    // Claim-clause separator (the canonical `；` const + its documented ASCII sibling) — a
    // change-history sentence splits on it.
    expect("clause A；clause B;clause C".split(DOC_TOKENS.claimClauseSeparatorRe)).toEqual([
      "clause A",
      "clause B",
      "clause C",
    ]);
    // Claim phase references — the FULL canonical id captured (digit ridge inside, groups 1/3 full
    // + 2/4 digits): a `P2.1` reference stays verbatim (the ridge is captured as one group, dot
    // segments included).
    expect(
      [..."P1 Design + P2.1 复盘 · P1–P4 范围".matchAll(DOC_TOKENS.claimSinglePhaseRe)].map((m) => [
        m[1],
        m[2],
      ]),
    ).toEqual([
      ["P1", "1"],
      ["P2.1", "2.1"],
      ["P1", "1"],
      ["P4", "4"],
    ]);
    const range = [..."P2.1–P2.3".matchAll(DOC_TOKENS.claimPhaseRangeRe)][0]!;
    expect([range[1], range[2], range[3], range[4]]).toEqual(["P2.1", "2.1", "P2.3", "2.3"]);
    // Design-spec token — the canonical `P<digits>(.digits)*-design` leaf (sub-phase ids allowed:
    // `P2.1-design` scans as its own FULL token — the segment-join attribution, never a bare `P2`
    // or a ridge-less `P2.1`) + the design-doc filename tail derived from it.
    expect("source P2.1-design → p3-design v1.0".match(DOC_TOKENS.designTokenScanRe)?.[0]).toBe(
      "P2.1-design",
    );
    expect(DOC_TOKENS.designTokenScanRe.test("P2.1-design v1.0")).toBe(true);
    expect(DOC_TOKENS.designDocTail).toBe("-design.md");
    // Issue-anchor scan — the issue-number run captured (the anchor-registry membership atom).
    const anchor = [..."fixes #123#issuecomment-456".matchAll(DOC_TOKENS.issueAnchorFormRe)][0]!;
    expect(anchor[1]).toBe("123");
    // Phase-id token scan — the dependency graph / dependency-column membership scanner; dotted
    // ids scan as single tokens (`P2.1` is one id, not a `P2` + `.1` split).
    expect(
      [..."P1 -> P2  (hard) · P2.1".matchAll(DOC_TOKENS.phaseTokenScanRe)].map((m) => m[0]),
    ).toEqual(["P1", "P2", "P2.1"]);
  });
});

describe("engine consumers consume via the derived tokens (grep 删除面零残留)", () => {
  const consumerFiles = ["rules/documents.ts", "render/brief.ts", "dispatch/task.ts"];
  it.each(consumerFiles)("%s no longer hand-writes the derived structure tokens", (rel) => {
    const src = readFileSync(path.join(ENGINE_SRC, rel), "utf8");
    expect(src).not.toMatch(/const SPEC_MARK\s*=\s*["'`]\*\*Spec:\*\*/);
    expect(src).not.toMatch(/const PARENT_MARK\s*=\s*["'`]\*\*Parent program\*\*/);
    expect(src).not.toMatch(/const VERSION_HEADER_RE\s*=\s*\/\^\\s\*-/);
    expect(src).not.toMatch(/const HISTORY_VERSION_CELL_RE\s*=\s*\/\^\\s\*\\\|/);
  });

  it("tokens.ts derives from the DocType.shape domain — no config/schema re-read via loadDocSchema (S8)", () => {
    const src = readFileSync(path.join(ENGINE_SRC, "documents/tokens.ts"), "utf8");
    expect(src).not.toMatch(/loadDocSchema/);
    expect(src).not.toMatch(/documents\/schema\//);
  });
});

// Template-retirement consumption face (§2.3 AC4/AC9 — repo/skill md 模板副本零残留 + the
// read-schema rewrite). The engine test asserts the repo/plugin surface the migration guarantees:
// the three md structure templates are gone, and the spec-writer skills carry the `read-schema`
// node that drives `cdd schema get` discovery (zero hardcoded template paths).
describe("template retirement — md templates gone + read-schema nodes in the spec-writer skills", () => {
  // packages/cdd-engine/src/documents/__tests__ → repo root (5 hops: __tests__→documents→src→cdd-engine→packages→root)
  const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
  const RETIRED = [
    "packages/kairos/skills/cdd-charter/docs/overall-spec-template.md",
    "packages/kairos/skills/cdd-phase/docs/phase-spec-template.md",
    "packages/kairos/skills/cdd-charter/docs/add-phase-protocol.md",
  ];
  const SPEC_WRITER_SKILLS = [
    "packages/kairos/skills/cdd-charter/SKILL.md",
    "packages/kairos/skills/cdd-phase/SKILL.md",
    "packages/kairos/skills/cdd-spec/SKILL.md",
  ];

  it.each(RETIRED)("%s is deleted (structure facts moved to the canonical schema)", (rel) => {
    expect(existsSync(path.join(REPO_ROOT, rel))).toBe(false);
  });

  it.each(SPEC_WRITER_SKILLS)(
    "%s carries the read-schema node and no template-path token",
    (rel) => {
      const src = readFileSync(path.join(REPO_ROOT, rel), "utf8");
      expect(src).toMatch(/read-schema/);
      expect(src).not.toMatch(/read-template/);
      expect(src).not.toMatch(/docs\/\*-template\.md/);
    },
  );

  it("cdd-plan author-plan defers plan structure to the canonical schema (`cdd schema get plan`)", () => {
    const src = readFileSync(
      path.join(REPO_ROOT, "packages/kairos/skills/cdd-plan/SKILL.md"),
      "utf8",
    );
    expect(src).toMatch(/cdd schema get plan/);
    // no hand-written extraction regex in the plan-authoring prose
    expect(src).not.toMatch(/\/\^### Task \\d\+:\//);
  });
});
