// packages/cdd-engine/src/documents/__tests__/tokens.test.ts — canonical doc-structure tokens
// (P2 T2 ①②; design §2.3 AC4 TC 单源实证). Every engine-side structure token derives from the
// canonical doc-structure schemas (documents/schema/*.json via deriveDocTokens) — the "改 canonical
// 定义一处 → engine 校验/抽取同步生效" evidence:
//   - deriveDocTokens(schemas) is pure: feed it a doctored canonical schema → the derived token
//     changes (the derivation is LIVE, not a second hand-written copy);
//   - the production DOC_TOKENS values equal the on-disk canonical leaves (spot-pinned);
//   - the derived regexes keep their exact parsing semantics (version header, history cell,
//     task-heading colon form, Phase-inventory header, canonical column, constraints heading,
//     prose anchors, CLAIM family) — the canary surface for the repo doc set;
//   - the engine consumers (documents.ts / brief.ts / task.ts) consume via this module — the
//     "grep 删除面零残留" engine-side face, checked textually (no literal re-assignment).
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadDocSchema } from "../schema.ts";
import { deriveDocTokens, DOC_TOKENS } from "../tokens.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// packages/cdd-engine/src/documents/__tests__ → the engine src root (2 hops up from __tests__)
const ENGINE_SRC = path.resolve(HERE, "..", "..");
const PLAN = loadDocSchema("plan");
const OVERALL = loadDocSchema("overall");
const PHASE_SPEC = loadDocSchema("phase-spec");

/** The four schemas deriveDocTokens needs — doctorable per-test. */
function schemas(overrides: { plan?: unknown; overall?: unknown; phase?: unknown } = {}) {
  return {
    plan: overrides.plan ?? (loadDocSchema("plan") as Record<string, unknown>),
    overall: overrides.overall ?? (loadDocSchema("overall") as Record<string, unknown>),
    "phase-spec": overrides.phase ?? (loadDocSchema("phase-spec") as Record<string, unknown>),
  };
}

/** Deep-clone a loaded schema (structuredClone of the parsed JSON). */
function cloneSchema<T extends object>(schema: T): T {
  return JSON.parse(JSON.stringify(schema)) as T;
}

describe("deriveDocTokens — live derivation from the canonical schemas", () => {
  it("doctored canonical schema → derived tokens change (TC single-source实证)", () => {
    const base = deriveDocTokens(schemas());
    expect(base.specMark).toBe("**Spec:**");
    expect(base.versionHeaderRe.source).toContain("Version");

    // Doctored plan: the specRef marker const changes → the derived SPEC_MARK follows.
    const doctoredPlan = cloneSchema(loadDocSchema("plan") as Record<string, unknown>);
    (doctoredPlan as any).properties.header.properties.specRef.properties.marker.const = "**Spec source:**";
    const re = deriveDocTokens(schemas({ plan: doctoredPlan }));
    expect(re.specMark).toBe("**Spec source:**");
    expect(re.specField).toBe("`**Spec source:**`");
  });

  it("doctored overall version line pattern → the version regex follows", () => {
    const doctored = cloneSchema(loadDocSchema("overall") as Record<string, unknown>);
    (doctored as any).properties.header.properties.version.properties.line.pattern =
      "^\\s*-?\\s*\\*\\*Program version\\*\\*:\\s*v\\d+\\.\\d+";
    const re = deriveDocTokens(schemas({ overall: doctored }));
    // the header regex now matches the doctored line shape
    expect(re.versionHeaderRe.test("- **Program version**: v1.0 · 2026-09-21")).toBe(true);
    expect(re.versionHeaderRe.test("- **Version**: v1.0 · 2026-09-21")).toBe(false);
  });

  it("doctored phase-spec version marker → the derived leaf follows the page twin; a one-page drift throws", () => {
    // Phase-spec pages the shared version marker as its own const leaf. Doctoring BOTH pages to a
    // new value keeps them equal — the derived phase-spec leaf follows live from the canonical edit.
    const doctoredOverall = cloneSchema(loadDocSchema("overall") as Record<string, unknown>);
    (doctoredOverall as any).properties.header.properties.version.properties.marker.const =
      "**Program version**";
    const doctoredPhase = cloneSchema(loadDocSchema("phase-spec") as Record<string, unknown>);
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

describe("DOC_TOKENS — production values equal the canonical leaves (single source)", () => {
  it("plan markers: specMark / parentMark / taskHeading / constraints / prose anchors", () => {
    expect(DOC_TOKENS.specMark).toBe("**Spec:**");
    expect(DOC_TOKENS.parentMark).toBe("**Parent program**");
    expect(DOC_TOKENS.taskHeadingFormat).toBe("### Task N:");
    expect(DOC_TOKENS.taskHeadingFor(7)).toBe("### Task 7:");
    expect(DOC_TOKENS.constraintsHeading).toBe("## Constraints");
    expect(DOC_TOKENS.proseAnchors).toEqual(["口径", "commit 边界机制", "Flow Atomicity", "顺序原则"]);
    expect(DOC_TOKENS.proseAnchorTokens).toEqual([
      "**口径**：",
      "**commit 边界机制**：",
      "**Flow Atomicity**：",
      "**顺序原则**：",
    ]);
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
    const header = "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |";
    expect(DOC_TOKENS.phaseHeaderRe.test(header)).toBe(true);
    expect(DOC_TOKENS.phaseHeaderRe.test("| P1 | phase one |")).toBe(false); // phase rows are not the header
    expect(DOC_TOKENS.canonicalColumnRe.test(header)).toBe(true);
    expect(DOC_TOKENS.canonicalColumnRe.test("| # | Phase | Scope | Implementation planning |")).toBe(false);
    expect(DOC_TOKENS.changeHistoryHeadingRe.test("## Change history")).toBe(true);
  });

  it("constraints heading + prose-anchor quad", () => {
    expect(DOC_TOKENS.constraintsHeadingRe.test("## Constraints")).toBe(true);
    expect(DOC_TOKENS.constraintsHeadingRe.test("### Constraint")).toBe(false);
    expect(DOC_TOKENS.proseAnchorTokens[1]).toBe("**commit 边界机制**：");
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
      "clause A", "clause B", "clause C",
    ]);
    // Claim phase references — the FULL canonical id captured (digit ridge inside, groups 1/3 full
    // + 2/4 digits): a `P2.1` reference stays verbatim (the ridge is captured as one group, dot
    // segments included).
    expect([..."P1 Design + P2.1 复盘 · P1–P4 范围".matchAll(DOC_TOKENS.claimSinglePhaseRe)].map((m) => [m[1], m[2]])).toEqual([
      ["P1", "1"], ["P2.1", "2.1"], ["P1", "1"], ["P4", "4"],
    ]);
    const range = [..."P2.1–P2.3".matchAll(DOC_TOKENS.claimPhaseRangeRe)][0]!;
    expect([range[1], range[2], range[3], range[4]]).toEqual(["P2.1", "2.1", "P2.3", "2.3"]);
    // Design-spec token — the canonical `P<digits>(.digits)*-design` leaf (sub-phase ids allowed:
    // `P2.1-design` scans as its own FULL token — the segment-join attribution, never a bare `P2`
    // or a ridge-less `P2.1`) + the design-doc filename tail derived from it.
    expect("source P2.1-design → p3-design v1.0".match(DOC_TOKENS.designTokenScanRe)?.[0]).toBe("P2.1-design");
    expect(DOC_TOKENS.designTokenScanRe.test("P2.1-design v1.0")).toBe(true);
    expect(DOC_TOKENS.designDocTail).toBe("-design.md");
    // Issue-anchor scan — the issue-number run captured (the anchor-registry membership atom).
    const anchor = [..."fixes #123#issuecomment-456".matchAll(DOC_TOKENS.issueAnchorFormRe)][0]!;
    expect(anchor[1]).toBe("123");
    // Phase-id token scan — the dependency graph / dependency-column membership scanner; dotted
    // ids scan as single tokens (`P2.1` is one id, not a `P2` + `.1` split).
    expect([..."P1 -> P2  (hard) · P2.1".matchAll(DOC_TOKENS.phaseTokenScanRe)].map((m) => m[0])).toEqual([
      "P1", "P2", "P2.1",
    ]);
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
});

// Template-retirement consumption face (§2.3 AC4/AC9 — repo/skill md 模板副本零残留 + the
// read-schema rewrite). The engine test asserts the repo/plugin surface the migration guarantees:
// the three md structure templates are gone, and the spec-writer skills carry the `read-schema`
// node that drives `cdd help` discovery (zero hardcoded template paths).
describe("template retirement — md templates gone + read-schema nodes in the spec-writer skills", () => {
  // packages/cdd-engine/src/documents/__tests__ → repo root (5 hops: __tests__→documents→src→cdd-engine→packages→root)
  const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
  const RETIRED = [
    "packages/osuperpowers/skills/writing-overall-spec/docs/overall-spec-template.md",
    "packages/osuperpowers/skills/writing-phase-spec/docs/phase-spec-template.md",
    "packages/osuperpowers/skills/writing-overall-spec/docs/add-phase-protocol.md",
  ];
  const SPEC_WRITER_SKILLS = [
    "packages/osuperpowers/skills/writing-overall-spec/SKILL.md",
    "packages/osuperpowers/skills/writing-phase-spec/SKILL.md",
    "packages/osuperpowers/skills/writing-single-spec/SKILL.md",
  ];

  it.each(RETIRED)("%s is deleted (structure facts moved to the canonical schema)", (rel) => {
    expect(existsSync(path.join(REPO_ROOT, rel))).toBe(false);
  });

  it.each(SPEC_WRITER_SKILLS)("%s carries the read-schema node and no template-path token", (rel) => {
    const src = readFileSync(path.join(REPO_ROOT, rel), "utf8");
    expect(src).toMatch(/read-schema/);
    expect(src).not.toMatch(/read-template/);
    expect(src).not.toMatch(/docs\/\*-template\.md/);
  });

  it("writing-plans author-plan defers plan structure to the canonical schema (`cdd help`)", () => {
    const src = readFileSync(
      path.join(REPO_ROOT, "packages/osuperpowers/skills/writing-plans/SKILL.md"),
      "utf8",
    );
    expect(src).toMatch(/cdd help/);
    // no hand-written extraction regex in the plan-authoring prose
    expect(src).not.toMatch(/\/\^### Task \\d\+:\//);
  });
});
