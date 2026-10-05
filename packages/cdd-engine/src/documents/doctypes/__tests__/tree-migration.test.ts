// packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts — the migration-queue
// expectation table + base assertion skeleton (doc-architecture-v2-p3 T3; plan §T3 step 1). The
// tree's single-form state: the legacy dual-read runtime is retired, so every tree document is in
// one declared migration state —
//   - canonical (zero migration objects): the documents ALREADY carrying the single grammar
//     (this program's p3 plan = the data-shaped task form; the p3 design = the new three-truth
//     skeleton) → validate clean;
//   - pending-migration: the legacy documents (20 six-section design specs + 21 legacy plans) →
//     validate BLOCK (the single-form contracts they no longer meet) until T5–T7 migrate them
//     per family;
//   - the one-off spec (2026-09-28-cdd-review-contract-fix.md — no parent overall / canonical
//     schema, the engine no longer recognises it) is walked but tolerated: never counted, never
//     migrated, never in the 41.
// T5–T7 extend the table per family (each migrated doc flips pending → canonical); T8 turns the
// terminal state all-green (zero exclusions). The suite's assertion skeleton stays one line per
// state: every pending doc blocks, every canonical doc validates clean.
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DocumentsValidator, UnknownDocKindError } from "../../../rules/documents.ts";
import { docTypeRegistry } from "../../registry.ts";

const HERE = import.meta.dirname; // …/documents/doctypes/__tests__
// The repo root — 6 levels up from src/documents/doctypes/__tests__ (the real docs tree the
// migration queue walks).
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..", "..");
const SPECS_DIR = path.join(REPO_ROOT, "docs", "kairos", "specs");
const PLANS_DIR = path.join(REPO_ROOT, "docs", "kairos", "plans");

/** A tree document's migration state — canonical (zero migration objects, the single grammar,
 *  validate clean) or pending (the legacy face, validate BLOCK until its family migrates). */
type MigrationState = "canonical" | "pending";

// The migration-queue expectation table (T3 base: exactly one canonical pair — this program's own
// p3 plan/design — against the 41 legacy documents; every file MUST be declared below, a missing
// row fails the coverage assertion).
const PLAN_MIGRATION: Readonly<Record<string, MigrationState>> = {
  "2026-09-13-osuperpowers-overhaul-p1.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p2.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p3.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p4.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p5.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p6.md": "pending",
  "2026-09-21-consumer-parity-p1.md": "pending",
  "2026-09-21-consumer-parity-p2.md": "pending",
  "2026-09-21-consumer-parity-p3.md": "pending",
  "2026-09-21-consumer-parity-p4.1.md": "pending",
  "2026-09-21-consumer-parity-p4.2.md": "pending",
  "2026-09-21-consumer-parity-p4.3.md": "pending",
  "2026-09-21-consumer-parity-p4.4.md": "pending",
  "2026-09-27-pi-harness-p1.md": "pending",
  "2026-09-27-pi-harness-p2.md": "pending",
  "2026-09-27-pi-harness-p3.md": "pending",
  "2026-09-27-pi-harness-p4.md": "pending",
  "2026-09-27-pi-harness-p5.md": "pending",
  "2026-09-28-cdd-review-contract-fix.md": "pending",
  "2026-10-02-doc-architecture-v2-p1.md": "pending",
  "2026-10-02-doc-architecture-v2-p2.md": "pending",
  "2026-10-02-doc-architecture-v2-p3.md": "canonical",
};

const SPEC_MIGRATION: Readonly<Record<string, MigrationState>> = {
  "2026-09-13-osuperpowers-overhaul-p1-design.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p2-design.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p3-design.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p4-design.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p5-design.md": "pending",
  "2026-09-13-osuperpowers-overhaul-p6-design.md": "pending",
  "2026-09-21-consumer-parity-p1-design.md": "pending",
  "2026-09-21-consumer-parity-p2-design.md": "pending",
  "2026-09-21-consumer-parity-p3-design.md": "pending",
  "2026-09-21-consumer-parity-p4.1-design.md": "pending",
  "2026-09-21-consumer-parity-p4.2-design.md": "pending",
  "2026-09-21-consumer-parity-p4.3-design.md": "pending",
  "2026-09-21-consumer-parity-p4.4-design.md": "pending",
  "2026-09-27-pi-harness-p1-design.md": "pending",
  "2026-09-27-pi-harness-p2-design.md": "pending",
  "2026-09-27-pi-harness-p3-design.md": "pending",
  "2026-09-27-pi-harness-p4-design.md": "pending",
  "2026-09-27-pi-harness-p5-design.md": "pending",
  "2026-10-02-doc-architecture-v2-p1-design.md": "pending",
  "2026-10-02-doc-architecture-v2-p2-design.md": "pending",
  "2026-10-02-doc-architecture-v2-p3-design.md": "canonical",
};

const ONE_OFF = "2026-09-28-cdd-review-contract-fix.md";

const validator = new DocumentsValidator();
const planType = () => docTypeRegistry.resolve("plan");
const specType = () => docTypeRegistry.resolve("spec");

describe("迁移队列期望态 — the single-form tree's migration state table (T3 base skeleton)", () => {
  it("the table is the full tree: every plan (22) and design spec (21) file is declared, exactly one canonical pair (p3)", () => {
    const plans = readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"));
    const designs = readdirSync(SPECS_DIR).filter((f) => f.endsWith("-design.md"));
    expect(plans).toHaveLength(22);
    expect(designs).toHaveLength(21);
    // every tree file is on the table (a missing row breaks the coverage claim).
    for (const f of plans)
      expect(PLAN_MIGRATION[f], `${f} missing from PLAN_MIGRATION`).toBeDefined();
    for (const f of designs)
      expect(SPEC_MIGRATION[f], `${f} missing from SPEC_MIGRATION`).toBeDefined();
    // the one canonical pair — this program's own p3 documents (T3's zero-migration objects).
    expect(PLAN_MIGRATION["2026-10-02-doc-architecture-v2-p3.md"]).toBe("canonical");
    expect(SPEC_MIGRATION["2026-10-02-doc-architecture-v2-p3-design.md"]).toBe("canonical");
    expect(Object.values(PLAN_MIGRATION).filter((s) => s === "canonical")).toHaveLength(1);
    expect(Object.values(SPEC_MIGRATION).filter((s) => s === "canonical")).toHaveLength(1);
  });

  it("canonical / zero-migration documents validate clean (the p3 plan + design)", () => {
    expect(
      planType().validate(path.join(PLANS_DIR, "2026-10-02-doc-architecture-v2-p3.md"), {
        root: REPO_ROOT,
      }),
    ).toEqual([]);
    expect(
      specType().validate(path.join(SPECS_DIR, "2026-10-02-doc-architecture-v2-p3-design.md"), {
        root: REPO_ROOT,
      }),
    ).toEqual([]);
  });

  it("pending-migration documents validate BLOCK (non-empty — the single-form contract they no longer meet)", () => {
    for (const [file, state] of Object.entries(PLAN_MIGRATION)) {
      if (state !== "pending") continue;
      const failures = planType().validate(path.join(PLANS_DIR, file), { root: REPO_ROOT });
      expect(failures.length, `${file} pending-migration must block`).toBeGreaterThan(0);
    }
    for (const [file, state] of Object.entries(SPEC_MIGRATION)) {
      if (state !== "pending") continue;
      const failures = specType().validate(path.join(SPECS_DIR, file), { root: REPO_ROOT });
      expect(failures.length, `${file} pending-migration must block`).toBeGreaterThan(0);
    }
  });

  it("the one-off spec is the sole tolerated non-canonical tree doc — never counted, detect only", () => {
    const oneOffPath = path.join(SPECS_DIR, ONE_OFF);
    expect(() => validator.detectDocKind(oneOffPath)).toThrow(UnknownDocKindError);
    expect(() => validator.detectDocKind(oneOffPath)).toThrow(/no registered doc type/);
    // not a design/overall member — absent from both canonical counts (the tolerance's shape).
    expect(ONE_OFF.endsWith("-design.md")).toBe(false);
    expect(ONE_OFF.endsWith("-overall.md")).toBe(false);
  });
});
