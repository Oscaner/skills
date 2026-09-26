// packages/cdd-engine/src/documents/__tests__/schema.test.ts — canonical doc-structure schemas
// (P2 T1 ①/③/④; design §2.3 · AC5). Coverage:
//   - every schema is valid draft 2020-12 (Ajv2020 meta-validation at compile);
//   - description coverage: every structural node carries a non-empty description (writing
//     guidance replaces the retired md-template prose role);
//   - DOC_SCHEMA_NAMES matches the on-disk canonical files (single source of truth);
//   - the loader resolves the published addressable path (dist copy → consumer face) and falls
//     back to the source tree (dev face); the resolver is exercised against a fabricated
//     consumer-install layout deterministically (no real build needed in the suite);
//   - canonical token spot-checks pin the contract-critical patterns (task-heading colon form,
//     CLAIM_RE family, six-content-column Phase-inventory rows, prose-anchor quad,
//     taskGroups dispatch-group declaration, `### Acceptance criteria` uniqueness) so an
//     accidental edit of the single source surfaces as a test failure.
// Zero transactional behavior: this module reads only — no writes, no dispatch, no audit.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { DocumentsValidator } from "../../rules/documents.ts";

const documentsValidator = new DocumentsValidator();

import {
  DOC_SCHEMA_NAMES,
  loadDocSchema,
  loadDocSchemaText,
  resolveDocSchemaDir,
} from "../schema.ts";
import { DOC_TOKENS } from "../tokens.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// packages/cdd-engine/src/documents/__tests__ → package root (3 hops: __tests__ → documents → src → pkg)
const PKG_ROOT = path.resolve(HERE, "..", "..", "..");
const SRC_SCHEMA_DIR = path.join(PKG_ROOT, "src", "documents", "schema");

// Walk every structural node of a schema (properties / patternProperties / items / $defs /
// allOf·anyOf·oneOf) and report the ones lacking a non-empty `description`.
function missingDescriptions(node: unknown, nodePath: string): string[] {
  if (node === null || typeof node !== "object") return [];
  const obj = node as Record<string, unknown>;
  const out: string[] = [];
  const children: Array<[string, unknown]> = [];
  for (const containerKey of ["properties", "patternProperties", "$defs"] as const) {
    const container = obj[containerKey];
    if (container && typeof container === "object") {
      for (const [key, child] of Object.entries(container))
        children.push([`${nodePath}.${containerKey}.${key}`, child]);
    }
  }
  if (Array.isArray(obj.items))
    obj.items.forEach((c, i) => {
      children.push([`${nodePath}.items[${i}]`, c]);
    });
  else if (obj.items && typeof obj.items === "object")
    children.push([`${nodePath}.items`, obj.items]);
  for (const combiner of ["allOf", "anyOf", "oneOf"] as const) {
    if (Array.isArray(obj[combiner]))
      (obj[combiner] as unknown[]).forEach((c, i) => {
        children.push([`${nodePath}.${combiner}[${i}]`, c]);
      });
  }
  for (const [childPath, child] of children) {
    const desc = (child as { description?: unknown } | null)?.description;
    if (typeof desc !== "string" || desc.trim().length === 0) out.push(childPath);
    out.push(...missingDescriptions(child, childPath));
  }
  return out;
}

function schemaNode(schema: unknown, jsonPath: string): unknown {
  let cur: unknown = schema;
  const segs = jsonPath.split(".").filter((s) => s !== "" && s !== "$"); // "$" is the root marker
  for (const seg of segs) {
    if (cur === null || typeof cur !== "object") throw new Error(`bad path ${jsonPath}`);
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

describe("canonical doc-structure schemas (P2 T1)", () => {
  it("DOC_SCHEMA_NAMES = the five canonical files on disk (single source of truth)", () => {
    const onDisk = ["add-phase-protocol", "overall", "phase-spec", "plan", "skill-anatomy"]; // sorted dir listing
    expect([...DOC_SCHEMA_NAMES].sort()).toEqual(onDisk);
    for (const name of DOC_SCHEMA_NAMES) {
      expect(existsSync(path.join(SRC_SCHEMA_DIR, `${name}.json`))).toBe(true);
    }
  });

  it.each(DOC_SCHEMA_NAMES)(
    "%s is valid draft 2020-12 (Ajv2020 compile = meta-validation)",
    (name) => {
      const ajv = new Ajv2020({ allErrors: true }); // fresh instance per schema — reserved 2020-12 meta is pre-registered
      const schema = loadDocSchema(name);
      expect(schema).toBeTypeOf("object");
      expect((schema as { $schema: string }).$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      // Ajv compile() runs full meta-schema validation (validateSchema default true) — a schema that
      // violates draft 2020-12 (bad keyword, invalid pattern, unknown keyword in strict mode) throws.
      expect(() => ajv.compile(schema as object)).not.toThrow();
    },
  );

  it.each(DOC_SCHEMA_NAMES)("%s: every structural node carries a non-empty description", (name) => {
    const schema = loadDocSchema(name);
    expect(typeof (schema as { description: string }).description).toBe("string"); // root description
    const missing = missingDescriptions(schema, "$");
    expect(missing).toEqual([]);
  });

  it.each(DOC_SCHEMA_NAMES)(
    "%s: canonical tokens are pinned (single-source regression guard)",
    (name) => {
      const s = loadDocSchema(name);
      // The canonical patterns live in the schema as the single structure fact — spot-check the
      // contract-critical ones (the docContractValidate / brief-extraction tokens of T2).
      const get = (p: string): string => {
        const v = schemaNode(s, p);
        if (typeof v !== "string") throw new Error(`expected string at ${p}, got ${typeof v}`);
        return v;
      };
      if (name === "plan") {
        expect(get("$.properties.taskHeadings.properties.format.const")).toBe("### Task N:");
        // tolerant colon form — the brief extractor's slice surface (`/^### Task \d+:/`); an
        // optional title after the colon is parse-tolerated, so the pin is unanchored at the tail
        expect(get("$.properties.taskHeadings.properties.pattern.pattern")).toBe("^### Task \\d+:");
        // constraints Form B prose-anchor quad
        const anchors = schemaNode(
          s,
          "$.properties.constraints.properties.formBProseAnchors.properties.anchors.items.enum",
        ) as string[];
        expect(anchors).toEqual([
          "**口径**：",
          "**commit 边界机制**：",
          "**Flow Atomicity**：",
          "**顺序原则**：",
        ]);
        // taskGroups dispatch-group declaration (P4.3 Task 3, spec §2.2): optional array, empty
        // default [], each item `{ tasks: number[] }` with minItems >= 2 (a length-1 group is
        // redundant — the singleton state exists only as the empty default), section layout const/pattern
        expect(get("$.properties.taskGroups.type")).toBe("array");
        expect(schemaNode(s, "$.properties.taskGroups.default")).toEqual([]);
        expect(get("$.properties.taskGroups.items.properties.tasks.type")).toBe("array");
        expect(schemaNode(s, "$.properties.taskGroups.items.properties.tasks.minItems")).toBe(2);
        expect(get("$.properties.taskGroups.$defs.section.properties.heading.const")).toBe(
          "## Task Groups",
        );
        expect(get("$.properties.taskGroups.$defs.section.properties.entry.pattern")).toBe(
          "^- \\*\\*Task (?:\\d+(?:, \\d+)*)\\*\\*:",
        );
        // spec marker — any-line findIndex semantics are documented, not position-enforced
        const markerDesc = get(
          "$.properties.header.properties.specRef.properties.marker.description",
        );
        expect(markerDesc).toMatch(/findIndex/);
        expect(markerDesc).toMatch(/line 2/i);
      }
      if (name === "overall") {
        // canonical header — SIX content columns per phase row (the enforcement position-reads
        // c1 = id / c3 = Design spec / c4 = Implementation plan / c6 = Dependency; the written
        // header is the inspection row, keyed via headerOpen + the canonical-form marker)
        expect(
          get("$.properties.phaseInventory.properties.columnNames.properties.header.const"),
        ).toBe(
          "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        );
        expect(
          schemaNode(
            s,
            "$.properties.phaseInventory.properties.columnNames.properties.count.const",
          ),
        ).toBe(6);
        // claim pattern — CLAIM_RE family single source: pin it as a LIVE regex by compiling the
        // canonical pattern and asserting representative change-history claim clauses match (the
        // target stops at whitespace / CJK punctuation / brackets — the capture is bounded, trailing
        // clause content like `（PR #1）` is left unconsumed). An unanchored pattern-keyword search
        // is the intended semantics; a substring pin is what let the escaped-operator encoding that
        // matches no real clause slip through review.
        const claimPattern = get(
          "$.properties.claimPatterns.properties.claimClause.properties.pattern.pattern",
        );
        const claimRe = new RegExp(claimPattern);
        expect(claimRe.exec("Pending → **Done**（PR #1）")![0]).toBe("Pending → **Done**");
        expect(claimRe.exec("[Pending] -> P4-design v1.0")![0]).toBe("[Pending] -> P4-design");
        expect(claimRe.test("Pending")).toBe(false); // no arrow + target → no clause match
        // plan/design link words
        expect(get("$.properties.claimPatterns.properties.planLinkWord.pattern")).toBe(
          "^(?:plan|计划)$",
        );
        expect(get("$.properties.claimPatterns.properties.designLinkWord.pattern")).toBe(
          "^Design\\s?-?\\s?spec$",
        );
        // four table headings
        expect(get("$.properties.sectionHeadings.properties.issueInventory.const")).toBe(
          "## Issue inventory",
        );
        expect(get("$.properties.sectionHeadings.properties.phaseInventory.const")).toBe(
          "## Phase inventory",
        );
        expect(get("$.properties.sectionHeadings.properties.changeHistory.const")).toBe(
          "## Change history",
        );
        // canonical phase-id grammar (strict A — design §2.3 / P3 T4): all 8 phase-id-bearing
        // patterns carry the `^P<digits>(.digits)*$` form; the old split-letter form (`P1a`) is
        // extinct. Pinned literals + live sub-phase representatives (the migration regression guard).
        const phaseId = "^P\\d+(\\.\\d+)*$";
        expect(get("$.properties.issueInventory.properties.row.properties.phaseId.pattern")).toBe(
          phaseId,
        );
        expect(
          get("$.properties.phaseInventory.properties.rowShape.properties.idFormat.pattern"),
        ).toBe(phaseId);
        expect(
          get("$.properties.claimPatterns.properties.phaseReference.properties.single.pattern"),
        ).toBe(phaseId);
        // the dependency cell keeps the hard/soft alternation shape with the canonical id token
        expect(
          get("$.properties.phaseInventory.properties.cells.properties.dependency.pattern"),
        ).toBe(`^P\\d+(\\.\\d+)*\\s*->|^P\\d+(\\.\\d+)*\\s*->\\s*\\(?\\s*soft\\s*\\)?`);
        expect(get("$.properties.dependencyGraph.properties.hardEdge.pattern")).toBe(
          "^P\\d+(\\.\\d+)*\\s*->\\s*P\\d+(\\.\\d+)*$",
        );
        expect(get("$.properties.dependencyGraph.properties.softEdge.pattern")).toBe(
          "^P\\d+(\\.\\d+)*\\s*->\\s*\\(?\\s*soft\\s*\\)?\\s*P\\d+(\\.\\d+)*$",
        );
        expect(get("$.properties.claimPatterns.properties.designToken.pattern")).toBe(
          "^P\\d+(\\.\\d+)*-design$",
        );
        expect(
          get("$.properties.claimPatterns.properties.phaseReference.properties.range.pattern"),
        ).toBe("^P\\d+(\\.\\d+)*\\s*[-–—]\\s*P\\d+(\\.\\d+)*$");
        // live representatives — sub-phase ids parse under the canonical patterns
        expect(
          new RegExp(get("$.properties.dependencyGraph.properties.hardEdge.pattern")).test(
            "P2.1 -> P2.2",
          ),
        ).toBe(true);
        expect(
          new RegExp(get("$.properties.dependencyGraph.properties.softEdge.pattern")).test(
            "P2.1 -> (soft) P2.2",
          ),
        ).toBe(true);
        expect(
          new RegExp(get("$.properties.claimPatterns.properties.designToken.pattern")).test(
            "P2.1-design",
          ),
        ).toBe(true);
        // The three-state plan column + explicit-claim-only semantics are canonical facts of the schema
        // (pinned so an accidental description drift surfaces — P4.3 Task 8 #274):
        expect(
          schemaNode(
            s,
            "$.properties.phaseInventory.properties.cells.properties.inflight.enum",
          ) as string[],
        ).toEqual(["In-flight", "[In-flight]"]);
        const doneDesc = get(
          "$.properties.phaseInventory.properties.cells.properties.done.description",
        );
        expect(doneDesc).toMatch(/claim|closeout/i);
        expect(doneDesc).toMatch(/link/i);
        expect(
          get("$.properties.phaseInventory.properties.cells.properties.pending.description"),
        ).toMatch(/In-flight|in-flight/);
        const claimClauseDesc = get(
          "$.properties.claimPatterns.properties.claimClause.description",
        );
        expect(claimClauseDesc).toMatch(/window|explicit/i);
        expect(claimClauseDesc).toMatch(/prose|hint|diagnos/i);
      }
      if (name === "phase-spec") {
        // `### Acceptance criteria` is the unique subsection (const heading + fixed location)
        expect(get("$.properties.acceptanceCriteria.properties.heading.const")).toBe(
          "### Acceptance criteria",
        );
        expect(
          get("$.properties.acceptanceCriteria.properties.location.properties.parent.const"),
        ).toBe("Section 2 (Design body)");
        // Section 0–5 skeleton headings
        for (const n of [0, 1, 2, 3, 4, 5]) {
          expect(
            get(`$.properties.sections.properties.section${n}.properties.heading.pattern`),
          ).toContain(`^## Section ${n}:`);
        }
      }
      if (name === "add-phase-protocol") {
        // registration checklist structure — hard edge + anchored form
        expect(
          get(
            "$.properties.fourTableSyncChecklist.properties.dependencyEdge.properties.hard.pattern",
          ),
        ).toBe("^P\\d+(\\.\\d+)*\\s*->\\s*P\\d+(\\.\\d+)*$");
        expect(get("$.properties.issueReferenceSyntax.properties.anchoredForm.pattern")).toBe(
          "^#\\d+#issuecomment-\\d+$",
        );
      }
      if (name === "skill-anatomy") {
        // Section-heading registry — the strict allowlist the osuperpowers machine check consumes:
        // the four public + two conditional section keys, and the literal heading consts.
        expect(schemaNode(s, "$.properties.sectionRegistry.properties.public.items.enum")).toEqual([
          "flowDigraph",
          "nodeDefinitions",
          "invariants",
          "failureModes",
        ]);
        expect(
          schemaNode(s, "$.properties.sectionRegistry.properties.conditional.items.enum"),
        ).toEqual(["skeletonDeltas"]);
        expect(
          get(
            "$.properties.sectionRegistry.properties.sections.properties.flowDigraph.properties.heading.const",
          ),
        ).toBe("## Flow Digraph");
        expect(
          get(
            "$.properties.sectionRegistry.properties.sections.properties.nodeDefinitions.properties.heading.const",
          ),
        ).toBe("## Node Definitions");
        // Conditional carrier — the spec-writer trio MUST carry Skeleton deltas (the Pending
        // Acceptance Patch conditional section is retired — #279).
        expect(
          schemaNode(
            s,
            "$.properties.sectionRegistry.properties.sections.properties.skeletonDeltas.properties.requiredCarriers.items.enum",
          ),
        ).toEqual(["writing-single-spec", "writing-phase-spec", "writing-overall-spec"]);
        expect(
          get(
            "$.properties.sectionRegistry.properties.sections.properties.skeletonDeltas.properties.heading.const",
          ),
        ).toBe("## Skeleton deltas");
        // `### ` heading kinds — backticked node names only (the pending-patch sample `Task N:` form is retired).
        expect(
          get("$.properties.sectionRegistry.properties.headingKinds.properties.nodeName.pattern"),
        ).toBe("^### `[^`]+`$");
        expect(
          schemaNode(s, "$.properties.sectionRegistry.properties.headingKinds.properties"),
        ).toEqual({ nodeName: expect.any(Object) });
        // Four-element node contract — same literal markers the machine check reads.
        expect(get("$.properties.nodeElements.properties.do.pattern")).toBe("^- \\*\\*Do\\*\\*:");
        expect(get("$.properties.nodeElements.properties.read.pattern")).toBe(
          "^- \\*\\*Read\\*\\*:",
        );
        expect(get("$.properties.nodeElements.properties.exit.pattern")).toBe(
          "^- \\*\\*Exit\\*\\*:",
        );
        expect(get("$.properties.nodeElements.properties.fail.pattern")).toBe(
          "^- \\*\\*Fail\\*\\*:",
        );
        // Growth boundary — the numbers + the crossed-skill registry (the machine check reads them,
        // never test literals: crossing means MORE than the limits, and every crossing skill must
        // be registered here — consumer SKILL.md carries zero trace). The P4.4 loop shrink (13 nodes
        // / 17 edges) dropped cli-driven-development back inside the boundary — the registry's
        // per-skill crossings map carries zero registered names.
        expect(schemaNode(s, "$.properties.growthBoundary.properties.nodeLimit.const")).toBe(15);
        expect(schemaNode(s, "$.properties.growthBoundary.properties.edgeLimit.const")).toBe(17);
        expect(
          schemaNode(s, "$.properties.growthBoundary.properties.registry.properties.crossings"),
        ).toMatchObject({ type: "object", properties: {} });
        expect(
          Object.keys(
            schemaNode(
              s,
              "$.properties.growthBoundary.properties.registry.properties.crossings.properties",
            ) as Record<string, unknown>,
          ),
        ).toEqual([]);
        // Consumer-surface purity — the canonical forbidden narrative headings (regression pins; the
        // allowlist blocks every other unregistered narrative heading too).
        expect(
          schemaNode(
            s,
            "$.properties.consumerPurity.properties.forbiddenNarrativeHeads.items.enum",
          ),
        ).toEqual(["## Flow size note", "## Full Flow Refactor Rationale"]);
        // Digraph section — the content rule the machine check enforces: exactly one mermaid block,
        // zero prose after it (mermaidOnly const true).
        expect(schemaNode(s, "$.properties.digraph.properties.mermaidOnly.const")).toBe(true);
      }
    },
  );

  it("plan-cell enforcement predicates ↔ canonical cell enums (P4.3 Task 8 parity — enforcement and schema cannot drift)", () => {
    // The three-state recognition (rules/documents.ts) must accept exactly the schema's canonical
    // cells.pending / cells.inflight enum values — the contrast assertion that pins the descriptions
    // written for #274 to the enforcement that implements them.
    const overall = loadDocSchema("overall");
    const pendingEnum = schemaNode(
      overall,
      "$.properties.phaseInventory.properties.cells.properties.pending.enum",
    ) as string[];
    const inflightEnum = schemaNode(
      overall,
      "$.properties.phaseInventory.properties.cells.properties.inflight.enum",
    ) as string[];
    expect(pendingEnum.length).toBeGreaterThan(0);
    expect(inflightEnum).toEqual(["In-flight", "[In-flight]"]);
    for (const v of pendingEnum) expect(documentsValidator.isPendingText(v)).toBe(true);
    for (const v of inflightEnum) {
      expect(documentsValidator.isInflightText(v)).toBe(true);
      expect(documentsValidator.isPendingText(v)).toBe(false);
    }
    expect(documentsValidator.isPendingText("**Done**")).toBe(false);
    expect(documentsValidator.isInflightText("Done")).toBe(false);
    expect(documentsValidator.isInflightText("**Done**")).toBe(false);
  });

  it("overall descriptions align with the enforcement's positional reads (P4.3 Task 9 #276 parity)", () => {
    // The schema descriptions are the authoring authority authors draft against — they must teach
    // exactly the shape documents.ts / tokens.ts actually read. Each claim below is anchored on a
    // derived token or a constant the enforcement consumes, so description drift fails loudly.
    const overall = loadDocSchema("overall");
    const desc = (p: string): string => {
      const v = schemaNode(overall, p);
      if (typeof v !== "string") throw new Error(`expected string at ${p}`);
      return v;
    };

    // Phase-inventory rows are position-read over SIX content cells (parseOverall's cell map:
    // id = c[1], design = c[3], plan = c[4], dependency = c[6]). The count leaf must equal the
    // row-shape guard's split count (8) minus the two edge empties — the schema cannot claim a
    // self-contradictory 7 (+2 = 9) while the enforcement gates on 8.
    expect(
      schemaNode(
        overall,
        "$.properties.phaseInventory.properties.columnNames.properties.count.const",
      ),
    ).toBe(DOC_TOKENS.phaseRowCellCount - 2);
    const cellCountDesc = desc(
      "$.properties.phaseInventory.properties.rowShape.properties.cellCount.description",
    );
    expect(cellCountDesc).toMatch(/6 content columns/);
    for (const pos of ["c1", "c3", "c4", "c6"]) expect(cellCountDesc).toContain(pos);
    expect(cellCountDesc).not.toMatch(/7 content/); // the retired "7 content + 2 empties = 9" count

    // Header: the enforcement keys on the `| # | Phase |` open (headerOpen) + the Implementation
    // plan marker (canonicalColumnToken), and reads rows by position — never by a 7-column list.
    const headerDesc = desc(
      "$.properties.phaseInventory.properties.columnNames.properties.header.description",
    );
    expect(headerDesc).not.toMatch(/7-column/);
    expect(headerDesc).toMatch(/\| # \| Phase \|/);
    expect(headerDesc).toMatch(/Implementation plan/);
    const sectionDesc = desc("$.properties.phaseInventory.description");
    expect(sectionDesc).not.toMatch(/7-column/);

    // Change history: the version cell is determined by POSITION (the row's FIRST content cell
    // carrying the `v<major>.<minor>` token), never by the header's conventional column names.
    const columnsDesc = desc(
      "$.properties.changeHistory.properties.header.properties.columns.description",
    );
    expect(columnsDesc).toMatch(/first content cell/);
    expect(columnsDesc).toMatch(/version/i);
    expect(columnsDesc).toMatch(/position|by position|POSITION/i);
    expect(
      desc("$.properties.changeHistory.properties.header.properties.columns.items.description"),
    ).toMatch(/not read|never reads|never keyed|conventional/i);

    // Issue ref: the legal vocabulary mirrors the enforcement's five acceptance paths (bare none /
    // `#NNN` / `[#NNN]` / `#NNN#issuecomment-<digits>` / whole-cell parenthetical); the retired
    // `none (dogfood session …)` literal is gone — the gate accepts only the bare `none`.
    const issueRefDesc = desc(
      "$.properties.issueInventory.properties.row.properties.issueRef.description",
    );
    for (const form of ["`none`", "#NNN", "[#NNN]", "#NNN#issuecomment-<digits>", "（", "）"]) {
      expect(issueRefDesc).toContain(form);
    }
    expect(issueRefDesc).not.toMatch(/dogfood session/);
  });

  it("the live canonical surface carries no misleading 7-column Phase-header claim (the retired hint + drifted descriptions)", () => {
    // The 7-column Phase-header framing is gone from every shipped plane: the canonical schema
    // text (the authoring surface) and the engine's enforcement module. Frozen program docs
    // (docs/osuperpowers/specs/*) are exempt — they are lineage-pinned artifacts, not live surface.
    expect(loadDocSchemaText("overall")).not.toMatch(/7-column/);
    expect(readFileSync(path.join(PKG_ROOT, "src", "rules", "documents.ts"), "utf8")).not.toMatch(
      /7-column/,
    );
  });

  it("loader resolves the source tree in the dev face and a fabricated install layout in the consumer face", () => {
    // Dev face: from the repo's own module tree the resolved dir contains the five canonical files.
    const dev = resolveDocSchemaDir(path.join(SRC_SCHEMA_DIR, "..")); // src/documents
    expect(existsSync(dev)).toBe(true);
    for (const name of DOC_SCHEMA_NAMES)
      expect(existsSync(path.join(dev, `${name}.json`))).toBe(true);

    // Consumer face: a fabricated install layout — package root with dist/documents/schema copy
    // and NO src tree (a published package ships only dist/ + templates/). Walking up from a
    // bundled dist/cli.mjs must resolve the dist copy, never the source.
    const install = mkdtempSync(path.join(tmpdir(), "cdd-consumer-layout-"));
    try {
      const pkg = path.join(install, "node_modules", "@oscaner-skills", "cdd-engine");
      mkdirSync(path.join(pkg, "dist", "documents", "schema"), { recursive: true });
      mkdirSync(path.join(pkg, "templates"), { recursive: true });
      writeFileSync(
        path.join(pkg, "package.json"),
        JSON.stringify({ name: "@oscaner-skills/cdd-engine", version: "1.0.0" }),
      );
      for (const name of DOC_SCHEMA_NAMES) {
        writeFileSync(
          path.join(pkg, "dist", "documents", "schema", `${name}.json`),
          readFileSync(path.join(dev, `${name}.json`), "utf8"),
        );
      }
      const resolved = resolveDocSchemaDir(path.join(pkg, "dist"));
      expect(resolved).toBe(path.join(pkg, "dist", "documents", "schema"));
      expect(existsSync(resolved)).toBe(true);
      for (const name of DOC_SCHEMA_NAMES)
        expect(existsSync(path.join(resolved, `${name}.json`))).toBe(true);
    } finally {
      // the fabricated install dir itself is the only residue — rm it (nothing else was written)
      rmSync(install, { recursive: true, force: true });
    }
  });

  it("loadDocSchemaText returns the file bytes verbatim (byte-identical contract — a re-serialized parse is not)", () => {
    // The raw-text loader is the `cdd schema get` stdout source: the bytes it returns must equal
    // the on-disk file exactly, and JSON re-serialization must NOT be asserted against it (the
    // canonical files' formatting is the truth — this pins the no-re-serialize contract).
    for (const name of DOC_SCHEMA_NAMES) {
      const file = path.join(resolveDocSchemaDir(), `${name}.json`);
      expect(loadDocSchemaText(name)).toBe(readFileSync(file, "utf8"));
    }
    // loaded-parsed round-trips semantically but not byte-identity — the two loaders are distinct
    // surfaces (JSON.stringify(JSON.parse(x)) normalizes the file's own formatting).
    expect(JSON.parse(loadDocSchemaText("plan"))).toEqual(loadDocSchema("plan"));
  });
});
