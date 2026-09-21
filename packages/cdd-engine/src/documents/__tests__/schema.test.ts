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
//     CLAIM_RE family, 7-column header, prose-anchor quad, pending-acceptance-patch zone,
//     `### Acceptance criteria` uniqueness) so an accidental edit of the single source surfaces
//     as a test failure.
// Zero transactional behavior: this module reads only — no writes, no dispatch, no audit.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { DOC_SCHEMA_NAMES, loadDocSchema, resolveDocSchemaDir } from "../schema.ts";

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
      for (const [key, child] of Object.entries(container)) children.push([`${nodePath}.${containerKey}.${key}`, child]);
    }
  }
  if (Array.isArray(obj.items)) obj.items.forEach((c, i) => children.push([`${nodePath}.items[${i}]`, c]));
  else if (obj.items && typeof obj.items === "object") children.push([`${nodePath}.items`, obj.items]);
  for (const combiner of ["allOf", "anyOf", "oneOf"] as const) {
    if (Array.isArray(obj[combiner])) (obj[combiner] as unknown[]).forEach((c, i) => children.push([`${nodePath}.${combiner}[${i}]`, c]));
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
  it("DOC_SCHEMA_NAMES = the four canonical files on disk (single source of truth)", () => {
    const onDisk = ["add-phase-protocol", "overall", "phase-spec", "plan"]; // sorted dir listing
    expect([...DOC_SCHEMA_NAMES].sort()).toEqual(onDisk);
    for (const name of DOC_SCHEMA_NAMES) {
      expect(existsSync(path.join(SRC_SCHEMA_DIR, `${name}.json`))).toBe(true);
    }
  });

  it.each(DOC_SCHEMA_NAMES)("%s is valid draft 2020-12 (Ajv2020 compile = meta-validation)", (name) => {
    const ajv = new Ajv2020({ allErrors: true }); // fresh instance per schema — reserved 2020-12 meta is pre-registered
    const schema = loadDocSchema(name);
    expect(schema).toBeTypeOf("object");
    expect((schema as { $schema: string }).$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    // Ajv compile() runs full meta-schema validation (validateSchema default true) — a schema that
    // violates draft 2020-12 (bad keyword, invalid pattern, unknown keyword in strict mode) throws.
    expect(() => ajv.compile(schema as object)).not.toThrow();
  });

  it.each(DOC_SCHEMA_NAMES)("%s: every structural node carries a non-empty description", (name) => {
    const schema = loadDocSchema(name);
    expect(typeof (schema as { description: string }).description).toBe("string"); // root description
    const missing = missingDescriptions(schema, "$");
    expect(missing).toEqual([]);
  });

  it.each(DOC_SCHEMA_NAMES)("%s: canonical tokens are pinned (single-source regression guard)", (name) => {
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
      const anchors = schemaNode(s, "$.properties.constraints.properties.formBProseAnchors.properties.anchors.items.enum") as string[];
      expect(anchors).toEqual(["**口径**：", "**commit 边界机制**：", "**Flow Atomicity**：", "**顺序原则**："]);
      // pending-acceptance-patch zone
      expect(get("$.properties.pendingAcceptancePatch.properties.heading.const")).toBe("## Pending Acceptance Patch");
      // spec marker — any-line findIndex semantics are documented, not position-enforced
      const markerDesc = get("$.properties.header.properties.specRef.properties.marker.description");
      expect(markerDesc).toMatch(/findIndex/);
      expect(markerDesc).toMatch(/line 2/i);
    }
    if (name === "overall") {
      // canonical 7-column header
      expect(get("$.properties.phaseInventory.properties.columnNames.properties.header.const")).toBe(
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      );
      expect((schemaNode(s, "$.properties.phaseInventory.properties.columnNames.properties.count.const"))).toBe(7);
      // claim pattern — CLAIM_RE family single source: pin it as a LIVE regex by compiling the
      // canonical pattern and asserting representative change-history claim clauses match (the
      // target stops at whitespace / CJK punctuation / brackets — the capture is bounded, trailing
      // clause content like `（PR #1）` is left unconsumed). An unanchored pattern-keyword search
      // is the intended semantics; a substring pin is what let the escaped-operator encoding that
      // matches no real clause slip through review.
      const claimPattern = get("$.properties.claimPatterns.properties.claimClause.properties.pattern.pattern");
      const claimRe = new RegExp(claimPattern);
      expect(claimRe.exec("Pending → **Done**（PR #1）")![0]).toBe("Pending → **Done**");
      expect(claimRe.exec("[Pending] -> P4-design v1.0")![0]).toBe("[Pending] -> P4-design");
      expect(claimRe.test("Pending")).toBe(false); // no arrow + target → no clause match
      // plan/design link words
      expect(get("$.properties.claimPatterns.properties.planLinkWord.pattern")).toBe("^(?:plan|计划)$");
      expect(get("$.properties.claimPatterns.properties.designLinkWord.pattern")).toBe("^Design\\s?-?\\s?spec$");
      // four table headings
      expect(get("$.properties.sectionHeadings.properties.issueInventory.const")).toBe("## Issue inventory");
      expect(get("$.properties.sectionHeadings.properties.phaseInventory.const")).toBe("## Phase inventory");
      expect(get("$.properties.sectionHeadings.properties.changeHistory.const")).toBe("## Change history");
    }
    if (name === "phase-spec") {
      // `### Acceptance criteria` is the unique subsection (const heading + fixed location)
      expect(get("$.properties.acceptanceCriteria.properties.heading.const")).toBe("### Acceptance criteria");
      expect(get("$.properties.acceptanceCriteria.properties.location.properties.parent.const")).toBe("Section 2 (Design body)");
      // Section 0–5 skeleton headings
      for (const n of [0, 1, 2, 3, 4, 5]) {
        expect(get(`$.properties.sections.properties.section${n}.properties.heading.pattern`)).toContain(`^## Section ${n}:`);
      }
    }
    if (name === "add-phase-protocol") {
      // registration checklist structure — hard edge + anchored form
      expect(get("$.properties.fourTableSyncChecklist.properties.dependencyEdge.properties.hard.pattern")).toBe(
        "^P\\d+(?![0-9])[a-z]?\\s*->\\s*P\\d+(?![0-9])[a-z]?$",
      );
      expect(get("$.properties.issueReferenceSyntax.properties.anchoredForm.pattern")).toBe("^#\\d+#issuecomment-\\d+$");
    }
  });

  it("loader resolves the source tree in the dev face and a fabricated install layout in the consumer face", () => {
    // Dev face: from the repo's own module tree the resolved dir contains the four canonical files.
    const dev = resolveDocSchemaDir(path.join(SRC_SCHEMA_DIR, "..")); // src/documents
    expect(existsSync(dev)).toBe(true);
    for (const name of DOC_SCHEMA_NAMES) expect(existsSync(path.join(dev, `${name}.json`))).toBe(true);

    // Consumer face: a fabricated install layout — package root with dist/documents/schema copy
    // and NO src tree (a published package ships only dist/ + templates/). Walking up from a
    // bundled dist/cli.mjs must resolve the dist copy, never the source.
    const install = mkdtempSync(path.join(tmpdir(), "cdd-consumer-layout-"));
    try {
      const pkg = path.join(install, "node_modules", "@oscaner-skills", "cdd-engine");
      mkdirSync(path.join(pkg, "dist", "documents", "schema"), { recursive: true });
      mkdirSync(path.join(pkg, "templates"), { recursive: true });
      writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "@oscaner-skills/cdd-engine", version: "1.0.0" }));
      for (const name of DOC_SCHEMA_NAMES) {
        writeFileSync(path.join(pkg, "dist", "documents", "schema", `${name}.json`), readFileSync(path.join(dev, `${name}.json`), "utf8"));
      }
      const resolved = resolveDocSchemaDir(path.join(pkg, "dist"));
      expect(resolved).toBe(path.join(pkg, "dist", "documents", "schema"));
      expect(existsSync(resolved)).toBe(true);
      for (const name of DOC_SCHEMA_NAMES) expect(existsSync(path.join(resolved, `${name}.json`))).toBe(true);
    } finally {
      // the fabricated install dir itself is the only residue — rm it (nothing else was written)
      rmSync(install, { recursive: true, force: true });
    }
  });
});
