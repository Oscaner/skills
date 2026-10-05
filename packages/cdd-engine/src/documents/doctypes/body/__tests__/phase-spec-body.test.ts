// packages/cdd-engine/src/documents/doctypes/body/__tests__/phase-spec-body.test.ts — the phase-spec
// concrete body (P2 T2; plan §T2 · design C1/C2, Criterion ②). Covers the T2 PhaseSpecBody
// deliverable surface:
//   - the concrete-body construction contract (kind pinned "phase-spec", the authoring-way
//     description injected read-only, an instance of the abstract DocBody);
//   - the full-field shape projection — the metadata header five-tuple (version / status / author /
//     parentProgram / dependsOn), the three-truth skeleton (design + its unique acceptanceCriteria ·
//     acceptance · constraints), and the four conditional fields each carrying `dependentRequired`
//     (deviations — the `Overall updated?` = `Yes` consequence — / incrementalWarning /
//     downstreamNotes / reviewRecord) + the root `if`/`then` three-truth consequence;
//   - the parse slice-pattern projection (`## Design` / `### Acceptance criteria` / `## Constraints`);
//   - the leaf-binding identity: `projectSchemaShape()` returns the module-level `PHASE_SPEC_BODY_SHAPE`
//     leaf (the same object identity the registry's spec doc type carries as its `shape` field);
//   - the new-skeleton docContractValidate surface (design C2): the new-shape fixtures — full
//     conditional surface (condition=true lands the sections) and zero-residue (condition=false
//     leaves no section) — pass validate, and the decorated-section structural consequences fail:
//     a `## Deviations` section without an `Overall updated?` = `Yes` answer, a duplicated
//     `### Acceptance criteria`, and a missing `## Constraints` inheritance point. Legacy
//     six-section docs (no `## Design` — the new-skeleton gate) stay on the P1 acceptance path
//     (dual-read contract).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DocType, SchemaNode } from "../../../doctype.ts";
import { docTypeRegistry } from "../../../registry.ts";
import { DocBody } from "../doc-body.ts";
import { PHASE_SPEC_BODY_SHAPE, PhaseSpecBody, phaseSpecBody } from "../phase-spec-body.ts";

const HERE = import.meta.dirname; // …/documents/doctypes/body/__tests__
const FIXTURES = path.join(HERE, "fixtures");
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..", "..", "..");

const NEW_SHAPE = path.join(FIXTURES, "new-shape-phase-spec-design.md");
const ZERO_RESIDUE = path.join(FIXTURES, "zero-residue-phase-spec-design.md");

const specType = (): DocType => docTypeRegistry.resolve("spec");

// ---- type-level contract surface (tsc --noEmit gate; zero escape directives) ----

/** The type-level assertion carrier — `Expect<T extends true>` compiles only while its argument is
 *  exactly `true`; a flipped contract surface (a `false` argument) fails the whole file. */
type Expect<T extends true> = T;

/** Negative key-contained assertion — true while `Key` is NOT a member of `Face`'s public keys. */
type NotIn<Key extends string, Face> = Key extends keyof Face ? false : true;

// renderBrief is a PlanBody-side member — the phase-spec body carries NO brief surface either
// (the abstract contract exposes none; this pins the same negative on the concrete type).
type _renderBriefOffPhaseSpecBody = Expect<NotIn<"renderBrief", PhaseSpecBody>>;

// ---- shape-navigation probe (the projection content assertions read the leaf's properties tree) ----

function node(props: readonly string[]): SchemaNode {
  let cur: SchemaNode = PHASE_SPEC_BODY_SHAPE;
  for (const key of props) {
    const next = cur.properties?.[key];
    if (!next) throw new Error(`shape node path not found: ${props.join(".")}`);
    cur = next;
  }
  return cur;
}

const pat = (props: readonly string[]): string => {
  const v = node(props).pattern;
  if (typeof v !== "string") throw new Error(`no pattern at ${props.join(".")}`);
  return v;
};

describe("PhaseSpecBody — the concrete body construction contract", () => {
  it('idempotent identity: kind pinned "phase-spec" + the authoring-way description injected read-only', () => {
    expect(phaseSpecBody.kind).toBe("phase-spec");
    expect(phaseSpecBody.description.length).toBeGreaterThan(0);
    expect(phaseSpecBody.description).toMatch(/## Design/);
    expect(phaseSpecBody).toBeInstanceOf(DocBody);
  });

  it("a PhaseSpecBody constructs with an injected description (the opts face is the arbitrary-description surface)", () => {
    const body = new PhaseSpecBody({ description: "fixture-specific template prose" });
    expect(body.kind).toBe("phase-spec");
    expect(body.description).toBe("fixture-specific template prose");
  });

  it("the schema projection returns the module-level leaf (identity — every consumer reads one product)", () => {
    expect(phaseSpecBody.projectSchemaShape()).toBe(PHASE_SPEC_BODY_SHAPE);
  });

  it("the slice projection exposes the new-skeleton heading regexes (permanent three)", () => {
    const slices = phaseSpecBody.projectSlicePatterns();
    expect(Object.keys(slices).sort()).toEqual([
      "acceptanceCriteriaHeading",
      "constraintsHeading",
      "designHeading",
    ]);
    expect(slices.designHeading.test("## Design")).toBe(true);
    expect(slices.designHeading.test("## Section 2: Design body")).toBe(false);
    expect(slices.acceptanceCriteriaHeading.test("### Acceptance criteria")).toBe(true);
    expect(slices.acceptanceCriteriaHeading.test("## Acceptance criteria")).toBe(false);
    expect(slices.constraintsHeading.test("## Constraints")).toBe(true);
    expect(slices.constraintsHeading.test("### Constraints")).toBe(false);
  });
});

describe("PHASE_SPEC_BODY_SHAPE — the full-field new-skeleton projection", () => {
  it("metadata header five-tuple (version / status / author / parentProgram / dependsOn)", () => {
    for (const key of ["version", "status", "author", "parentProgram", "dependsOn"])
      expect(node(["header", key])).toBeDefined();
    // the `**Version**` line is preserved as the detect / backfill-as-version / R2 anchor line
    expect(node(["header", "version", "marker"]).const).toBe("**Version**");
    expect(node(["header", "status", "states"]).enum).toEqual([
      "Draft",
      "Approved",
      "Plan pending",
      "Shipped",
    ]);
  });

  it("three-truth skeleton: design (with the unique acceptanceCriteria subsection) · acceptance · constraints", () => {
    // `## Design` — the first permanent section, carrying the unique `### Acceptance criteria`.
    expect(pat(["design", "heading"])).toBe("^## Design$");
    expect(node(["design", "acceptanceCriteria", "heading"]).const).toBe("### Acceptance criteria");
    expect(node(["design", "acceptanceCriteria", "location", "parent"]).const).toBe("## Design");
    expect(pat(["design", "acceptanceCriteria", "entry"])).toBe("^- `");
    // `acceptance` — the `- ` code-span conditional-sentence entry face.
    expect(pat(["acceptance", "entry"])).toBe("^- `");
    // `## Constraints` — the inheritance point (constraints-pointer semantics merged; non-conditional).
    expect(pat(["constraints", "heading"])).toBe("^## Constraints$");
  });

  it("four conditional fields each carry the dependentRequired consequence (deviations demands the `Yes` answer)", () => {
    for (const field of ["deviations", "incrementalWarning", "downstreamNotes", "reviewRecord"])
      expect(node([field]).dependentRequired).toBeDefined();
    // deviations — the `Overall updated?` answer must read `Yes` (decorated ⇒ the marker consequence).
    expect(node(["deviations"]).dependentRequired).toEqual({ heading: ["updated"] });
    expect(pat(["deviations", "updated"])).toBe("^Yes");
    const columnsItems = node(["deviations", "columns"]).items;
    const columns = columnsItems?.enum as readonly string[];
    expect(columns).toContain("Overall updated?");
    expect(columns).toEqual(["Overall assumption", "Phase decision", "Overall updated?"]);
    // the remaining conditional sections carry the heading-only structural marker
    for (const field of ["incrementalWarning", "downstreamNotes", "reviewRecord"]) {
      expect(node([field]).dependentRequired).toEqual({ heading: [] });
      expect(typeof node([field, "heading"]).pattern).toBe("string");
    }
  });

  it("the root if/then carries the three-truth skeleton consequence (design ⇒ acceptance + constraints)", () => {
    expect(PHASE_SPEC_BODY_SHAPE.if).toEqual({ required: ["design"] });
    expect(PHASE_SPEC_BODY_SHAPE.then).toEqual({ required: ["acceptance", "constraints"] });
  });
});

describe("leaf binding — DocType.shape derives from the body projection (S8)", () => {
  it("the registered spec doc type's shape IS the body leaf projection value (identity — the tokens.ts / SchemaFactory input)", () => {
    expect(docTypeRegistry.resolve("spec").shape).toBe(PHASE_SPEC_BODY_SHAPE);
  });

  it("the leaf includes the new-skeleton head (the authoring fact the projection serves)", () => {
    expect(docTypeRegistry.resolve("spec").shape.description).toMatch(/three-truth skeleton/);
  });
});

describe("new-skeleton docContractValidate (design C2) — fixture evidence", () => {
  it("condition=true 落盘: the full-conditional-surface new-shape fixture passes validate", () => {
    expect(specType().validate(NEW_SHAPE, { root: REPO_ROOT })).toEqual([]);
  });

  it("condition=false 零残留段: the three-truth-only fixture (no conditional section) passes validate", () => {
    expect(specType().validate(ZERO_RESIDUE, { root: REPO_ROOT })).toEqual([]);
  });

  /** Write a doctored spec to a temp file and run the phase-spec validate against it (the doc
   *  contract reads the file — the doctoring surface for the structural-consequence negatives). */
  function doctored(content: string, run: (specPath: string) => void): void {
    const dir = mkdtempSync(path.join(tmpdir(), "phase-spec-body-"));
    try {
      const specPath = path.join(dir, "doctored-phase-spec-design.md");
      writeFileSync(specPath, content);
      run(specPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("decorated `## Deviations` without an `Overall updated?` = `Yes` answer → fail (装饰段落盘 ⇒ 结构必带标记)", () => {
    const notYes = readFileSync(NEW_SHAPE, "utf8").replace(
      "Yes — v1.3 · 2026-10-05",
      "No — not fed back yet",
    );
    doctored(notYes, (p) => {
      const failures = specType().validate(p, { root: REPO_ROOT });
      expect(failures.some((f) => f.field.includes("`Overall updated?`"))).toBe(true);
      expect(failures.some((f) => f.missing.includes("`Yes`"))).toBe(true);
    });
  });

  it("an incidental `Yes` elsewhere in the deviations section cannot satisfy the assertion — the marker scan is anchored to the answer column (the false-positive probe)", () => {
    // The answer cell reads `No` while an unrelated cell in the section reads `Yes`: only the
    // answer-column scan (every data row's final cell vs the anchored `^Yes` leaf) passes verdicts —
    // a section-wide contains-search would validate green (the P1 scan's false-positive).
    const incidental = readFileSync(NEW_SHAPE, "utf8")
      .replace(
        "P2 keeps the dual-read skeleton for the legacy tree",
        "Yes, dual-read kept for the legacy tree",
      )
      .replace("Yes — v1.3 · 2026-10-05", "No — not fed back yet");
    doctored(incidental, (p) => {
      const failures = specType().validate(p, { root: REPO_ROOT });
      expect(failures.some((f) => f.field.includes("`Overall updated?`"))).toBe(true);
    });
  });

  it("a later deviations-table row answering `No` fails even when an earlier row answers `Yes` — every data row's answer cell is the marker", () => {
    const twoRows = readFileSync(NEW_SHAPE, "utf8").replace(
      "| Whole-program conventions win on conflict | P2 keeps the dual-read skeleton for the legacy tree | Yes — v1.3 · 2026-10-05 |",
      "| Whole-program conventions win on conflict | P2 keeps the dual-read skeleton for the legacy tree | Yes — v1.3 · 2026-10-05 |\n| A second divergence | Not yet reflected | No — pending |",
    );
    doctored(twoRows, (p) => {
      const failures = specType().validate(p, { root: REPO_ROOT });
      expect(failures.some((f) => f.field.includes("`Overall updated?`"))).toBe(true);
    });
  });

  it("a `## Deviations` table carrying no data rows → fail — the decorated section still lacks the `Overall updated?` marker (缺 Overall updated? → fail)", () => {
    const noRows = readFileSync(NEW_SHAPE, "utf8").replace(
      "| Whole-program conventions win on conflict | P2 keeps the dual-read skeleton for the legacy tree | Yes — v1.3 · 2026-10-05 |",
      "",
    );
    doctored(noRows, (p) => {
      const failures = specType().validate(p, { root: REPO_ROOT });
      expect(failures.some((f) => f.field.includes("`Overall updated?`"))).toBe(true);
    });
  });

  it("a duplicated `### Acceptance criteria` subsection → fail (the unique-constraint kept)", () => {
    const dup = readFileSync(NEW_SHAPE, "utf8").replace(
      "### Acceptance criteria",
      "### Acceptance criteria\n### Acceptance criteria",
    );
    doctored(dup, (p) => {
      const failures = specType().validate(p, { root: REPO_ROOT });
      expect(failures.some((f) => f.field.includes("`### Acceptance criteria`"))).toBe(true);
    });
  });

  it("a missing `## Constraints` inheritance point → fail (the three-truth skeleton existence)", () => {
    const missing = readFileSync(NEW_SHAPE, "utf8").replace(
      "## Constraints",
      "## Removed constraints",
    );
    doctored(missing, (p) => {
      const failures = specType().validate(p, { root: REPO_ROOT });
      expect(failures.some((f) => f.field.includes("`## Constraints`"))).toBe(true);
    });
  });
});
