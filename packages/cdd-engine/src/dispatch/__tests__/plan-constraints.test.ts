// packages/cdd-engine/src/dispatch/__tests__/plan-constraints.test.ts — T22 / spec §T7.1
// plan-constraints materialization contract. Unit seam: the pure extraction family + the
// materializer from dispatch/task.ts (the black-box pre-flight regeneration itself lives in
// runner.test.ts — this file covers the deterministic-extraction / missing-source /
// unconditional-overwrite planes the brief calls out).
//
// T3 re-base: the Form-B prose-pointer extraction is retired — the literal `## Constraints`
// section is the plan's SINGLE constraint source. The prose-anchor fixtures are gone; the
// extraction plane covers the literal section's deterministic verbatim read + its boundary
// semantics + the undeclared face.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashFile } from "../../artifacts/hash.ts";
import { DocumentsValidator } from "../../rules/documents.ts";
import { ConstraintsSourceUndeclared, materializePlanConstraints } from "../task.ts";

// The plan-Constraints extractor is a DocumentsValidator instance method (the class face — no
// bare export on dispatch/task.ts, Criterion ⑤); the extraction plane below consumes the instance.
const validator = new DocumentsValidator();

// Canonical plan: a first-class `## Constraints` top-level section (the plan's SINGLE constraint
// source) with `###` subsections inside; the section is bounded by the `---` rule.
const LITERAL_PLAN = [
  "# Plan title",
  "",
  "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
  "",
  "## Constraints",
  "Leading prose line of the constraints section.",
  "",
  "### 口径",
  "mouthpiece subsection",
  "### Flow Atomicity",
  "flow subsection (### stays inside — only `##`/`#`/`### Task`/`---` bound the section)",
  "",
  "---",
  "",
  "### Task 1: x",
  "body",
].join("\n");

const LITERAL_EXTRACTED = `${[
  "## Constraints",
  "Leading prose line of the constraints section.",
  "",
  "### 口径",
  "mouthpiece subsection",
  "### Flow Atomicity",
  "flow subsection (### stays inside — only `##`/`#`/`### Task`/`---` bound the section)",
].join("\n")}\n`;

const NO_SOURCE_PLAN = "# Plan\n\n### Task 1: x\nbody\n";

// The MATERIALIZED body (planConstraintsOf's merged presentation, the literal section strip-
// heading re-emit — the chain truncates on the fixture spec, so the merged read is the own delta
// alone, `## Constraints` followed by the stripped content).
const LITERAL_MERGED = `${[
  "## Constraints",
  "",
  "Leading prose line of the constraints section.",
  "",
  "### 口径",
  "mouthpiece subsection",
  "### Flow Atomicity",
  "flow subsection (### stays inside — only `##`/`#`/`### Task`/`---` bound the section)",
].join("\n")}\n`;

// The literal section bounded by a `---` rule (the structural boundary of the literal form).
const BOUNDED_PLAN = [
  "# Plan",
  "",
  "## Constraints",
  "first constraint paragraph",
  "",
  "continuation paragraph",
  "",
  "---",
  "",
  "### Task 1: x",
  "body",
].join("\n");

const BOUNDED_EXTRACTED = `${[
  "## Constraints",
  "first constraint paragraph",
  "",
  "continuation paragraph",
].join("\n")}\n`;

// tmp'd plan file in a fake repo-less dir (the pure fns take paths, not repos).
function tmpPlan(content: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-plan-src-"));
  const p = path.join(dir, "docs", "plans", "plan.md");
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
}

describe("extractPlanConstraints — the literal `## Constraints` source, determinism", () => {
  it("the literal section is extracted verbatim — heading included, `###` subsections stay inside", () => {
    expect(validator.extractPlanConstraints(LITERAL_PLAN)).toBe(LITERAL_EXTRACTED);
  });

  it("deterministic: identical input → identical output (recomputable baseline)", () => {
    expect(validator.extractPlanConstraints(LITERAL_PLAN)).toBe(
      validator.extractPlanConstraints(LITERAL_PLAN),
    );
    const a = validator.extractPlanConstraints(LITERAL_PLAN);
    const b = validator.extractPlanConstraints(LITERAL_PLAN);
    expect(a).toBe(b);
  });

  it("the literal section is bounded by a structural boundary (the `---` rule) — continuations stay verbatim", () => {
    expect(validator.extractPlanConstraints(BOUNDED_PLAN)).toBe(BOUNDED_EXTRACTED);
  });

  it("the `### Task` heading terminates the section — a plan body after a `### Task 1:` heading is never captured", () => {
    const plan = [
      "# Plan",
      "",
      "## Constraints",
      "constraint content",
      "",
      "### Task 1: x",
      "body",
      "",
    ].join("\n");
    expect(validator.extractPlanConstraints(plan)).toBe("## Constraints\nconstraint content\n");
  });
});

describe("extractPlanConstraints — missing source (the undeclared face)", () => {
  it("no `## Constraints` section (and no retired prose anchor form) → null (source undeclared)", () => {
    expect(validator.extractPlanConstraints(NO_SOURCE_PLAN)).toBeNull();
    // a Form B prose-anchor plan is equally null — the anchor form is no longer a source.
    const proseAnchors = [
      "# Plan",
      "",
      "**口径**：mouthpiece constraint",
      "",
      "**顺序原则**：ordering-principle constraint",
    ].join("\n");
    expect(validator.extractPlanConstraints(proseAnchors)).toBeNull();
  });

  it("empty literal section → null (a declared-but-empty section does not declare constraints)", () => {
    expect(
      validator.extractPlanConstraints("# Plan\n\n## Constraints\n\n### Task 1: x\nbody\n"),
    ).toBeNull();
  });
});

describe("materializePlanConstraints — unconditional regeneration (TG8)", () => {
  it("writes plan-constraints.md with a deterministic plan-hash anchor header", () => {
    const plan = tmpPlan(LITERAL_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    const outPath = materializePlanConstraints(plan, ws, path.dirname(path.dirname(plan)));
    expect(outPath).toBe(path.join(ws, "plan-constraints.md"));
    const text = readFileSync(outPath, "utf8");
    // anchor: plan hash + basename only (never the absolute root — machine-independent bytes)
    expect(text).toContain(`plan hash: ${hashFile(plan)}`);
    expect(text).toContain(`source plan: plan.md`);
    expect(text).not.toContain(path.dirname(path.dirname(plan)));
    // body verbatim-recomputed from the literal section
    expect(text.endsWith(LITERAL_MERGED)).toBe(true);
  });

  it("existing file is overwritten (no generate-once skip), operator content replaced", () => {
    const plan = tmpPlan(LITERAL_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    writeFileSync(path.join(ws, "plan-constraints.md"), "operator legible content\n");
    const outPath = materializePlanConstraints(plan, ws, path.dirname(path.dirname(plan)));
    const text = readFileSync(outPath, "utf8");
    expect(text).not.toContain("operator legible content");
    expect(text).toContain(`plan hash: ${hashFile(plan)}`);
    expect(text.endsWith(LITERAL_MERGED)).toBe(true);
    // the deterministic header (plan basename + hash) is regenerated, not the operator file
    expect(text.startsWith("<!-- plan-constraints.md — CDD workspace artifact")).toBe(true);
  });

  it("second call with the same plan rewrites identical bytes (determinism preserved)", () => {
    const plan = tmpPlan(LITERAL_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    const first = materializePlanConstraints(plan, ws, path.dirname(path.dirname(plan)));
    const second = materializePlanConstraints(plan, ws, path.dirname(path.dirname(plan)));
    expect(second).toBe(first);
    expect(readFileSync(second, "utf8")).toBe(readFileSync(first, "utf8"));
  });

  it("plan content change between calls → the next call reflects the new extraction", () => {
    const plan = tmpPlan(LITERAL_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    materializePlanConstraints(plan, ws, path.dirname(path.dirname(plan)));
    writeFileSync(
      plan,
      LITERAL_PLAN.replace("mouthpiece subsection", "mouthpiece subsection — revised"),
    );
    const outPath = materializePlanConstraints(plan, ws, path.dirname(path.dirname(plan)));
    const text = readFileSync(outPath, "utf8");
    expect(text).toContain("mouthpiece subsection — revised");
    expect(text).not.toContain("mouthpiece subsection\n");
    // the anchor follows the source plan hash, so provenance stays current
    expect(text).toContain(`plan hash: ${hashFile(plan)}`);
  });

  it("plan with no constraint source → throws ConstraintsSourceUndeclared, writes nothing", () => {
    const plan = tmpPlan(NO_SOURCE_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    expect(() => materializePlanConstraints(plan, ws, path.dirname(path.dirname(plan)))).toThrow(
      ConstraintsSourceUndeclared,
    );
    expect(existsSync(path.join(ws, "plan-constraints.md"))).toBe(false);
  });
});
