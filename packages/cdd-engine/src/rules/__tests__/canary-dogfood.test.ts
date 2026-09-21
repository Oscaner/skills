// packages/cdd-engine/src/rules/__tests__/canary-dogfood.test.ts — P2 T6 ④: this repo AS canary.
// The program's own doc chain (consumer-parity P2 plan v1.2 → p2 design v1.4 → overall v1.12) is
// pushed through the engine's NEW audit path + the canonical plan-schema parsing, proving 零误伤 on
// the documents the engine is also dogfood-consuming:
//
//   - lineage resolution over the real plan → design → overall chain (Class B);
//   - four tables legal → the structural audit returns zero failures (四表合法 → 全绿);
//   - plan-header parse semantics (task numbers / `**Spec:**` resolution / Form-A Constraints) hold
//     after the canonical-schema takeover (plan 头既有解析语义经 schema 零新增失败);
//   - the canonical plan schema declares the header fields the engine parses (schema = the single
//     structure fact), and the packed consumer face is addressable via the schema directory `cdd
//     help` points at (engine 拆包消费者模拟路径).
//
// These tests run inside this monorepo's checkout (the same layout CI validates), so REPO_ROOT is
// derived from the test file — the same convention `cli/__tests__/help.test.ts` uses.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import { validateDispatchDocuments, parentOverallOf, taskNumbersFromPlan, extractPlanConstraints } from "../documents.ts";
import { DOC_TOKENS } from "../../documents/tokens.ts";
import { loadDocSchema, docSchemaDir, DOC_SCHEMA_NAMES, type DocSchemaName } from "../../documents/schema.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const SPECS = path.join(REPO_ROOT, "docs", "osuperpowers", "specs");
const PLANS = path.join(REPO_ROOT, "docs", "osuperpowers", "plans");
const PLAN = path.join(PLANS, "2026-09-21-consumer-parity-p2.md");
const DESIGN = path.join(SPECS, "2026-09-21-consumer-parity-p2-design.md");
const OVERALL = path.join(SPECS, "2026-09-21-consumer-parity-overall.md");

describe("canary — the repo's own program doc chain through the engine audit (P2 T6 ④)", () => {
  it("the three docs exist (the canary fixtures are the live program)", () => {
    for (const f of [PLAN, DESIGN, OVERALL]) expect(existsSync(f)).toBe(true);
  });

  it("lineage resolves: plan → design → overall (Class B chain walk)", () => {
    expect(parentOverallOf(PLAN, REPO_ROOT)).toBe(OVERALL);
  });

  it("four tables legal → the structural audit returns zero failures over the real chain (legal four tables → all green)", () => {
    expect(validateDispatchDocuments({ entry: PLAN, root: REPO_ROOT })).toEqual([]);
  });

  it("plan-header parse semantics hold on the real plan — task numbers / Form-A Constraints / heading token (zero new failures)", () => {
    expect(taskNumbersFromPlan(PLAN)).toEqual([1, 2, 3, 4, 5, 6]); // the six P2 tasks, colon-form
    const constraints = extractPlanConstraints(readFileSync(PLAN, "utf8"));
    expect(constraints).not.toBeNull();
    expect(constraints!).toMatch(/### 口径/); // canonical Form-A section captured with its anchors
    expect(constraints!).toMatch(/### 顺序原则/);
    expect(constraints!).not.toMatch(/### Task \d:/); // the section stops before the task zone
    // the exact colon-form heading still parses after the schema-derived token takeover
    expect(DOC_TOKENS.taskNumberRe.test("### Task 6: breaking 版本面 + 零债收口（design §2.5 · AC8 · 零债断言聚合）")).toBe(true);
  });

  it("the canonical plan schema declares the header fields the engine parses (schema = the structure fact)", () => {
    const plan = loadDocSchema("plan") as Record<string, unknown>;
    // the canonical descends to the exact fields the engine's extractors consume
    const header = (plan as { properties: { header?: { properties?: Record<string, unknown> } } }).properties?.header?.properties;
    expect(header).toMatchObject({
      specRef: { properties: { marker: { const: "**Spec:**" } } },
      parentProgram: { properties: { marker: { const: "**Parent program**" } } },
    });
    expect(plan).toMatchObject({ properties: { taskHeadings: expect.any(Object) } });
  });

  it("the consumer face is addressable — the schema directory `cdd help` points at holds every canonical file", () => {
    const dir = docSchemaDir();
    expect(existsSync(dir)).toBe(true);
    for (const name of DOC_SCHEMA_NAMES) {
      expect(existsSync(path.join(dir, `${name}.json`))).toBe(true);
    }
    const schema = loadDocSchema("overall" as DocSchemaName);
    expect(schema).not.toBeUndefined();
  });
});