// packages/cdd-engine/src/dispatch/__tests__/plan-constraints.test.ts — T22 / spec §T7.1
// plan-constraints materialization contract. Unit seam: the pure extraction family + the
// materializer + the stale checker from dispatch/task.ts (the black-box pre-flight gate itself
// lives in runner.test.ts — this file covers the deterministic-extraction / missing-source /
// stale-anchor planes the brief calls out).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashFile } from "../../artifacts/hash.ts";
import { DocumentsValidator } from "../../rules/documents.ts";
import {
  ConstraintsSourceUndeclared,
  isPlanConstraintsStale,
  materializePlanConstraints,
} from "../task.ts";

// The plan-Constraints extractor is a DocumentsValidator instance method (the class face — no
// bare export on dispatch/task.ts, 判定标准⑤); the extraction plane below consumes the instance.
const validator = new DocumentsValidator();

// Legacy prose-pointer plan: the four **bold** constraint paragraphs in the preamble. Neutral
// prose sits BEFORE the first anchor — unter-anchored preamble text must never be captured into a
// constraint block (continuation capture runs until the next `**…**：` declaration, so a stray
// paragraph between anchors would be absorbed by the preceding one).
const PROSE_PLAN = [
  "# Plan title",
  "",
  "**Spec:** [x-design.md](docs/osuperpowers/specs/x-design.md)",
  "",
  "a neutral prose paragraph (not a constraint anchor)",
  "",
  "**口径**：mouthpiece constraint",
  "",
  "**commit 边界机制（本 program 全 phase 生效）**：commit-boundary constraint",
  "",
  "**Flow Atomicity（本 phase 强化）**：flow-atomicity constraint",
  "",
  "**顺序原则（spec §2.4）**：ordering-principle constraint",
  "",
  "---",
  "",
  "### Task 1: x",
  "body",
].join("\n");

const PROSE_EXTRACTED = `${[
  "**口径**：mouthpiece constraint",
  "",
  "**commit 边界机制（本 program 全 phase 生效）**：commit-boundary constraint",
  "",
  "**Flow Atomicity（本 phase 强化）**：flow-atomicity constraint",
  "",
  "**顺序原则（spec §2.4）**：ordering-principle constraint",
].join("\n")}\n`;

// Canonical plan: a first-class `## Constraints` top-level section (writing-plans-mandated for
// new plans) with `###` subsections inside; the section is self-bounded by the `---` rule.
const LITERAL_PLAN = [
  "# Plan title",
  "",
  "**Spec:** [x-design.md](docs/osuperpowers/specs/x-design.md)",
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

// Multi-paragraph prose body (findings 1): a legacy constraint whose body spans blank-line-
// separated paragraphs — the block runs to a structural boundary (`---` here), capturing every
// continuation paragraph verbatim.
const MULTI_PARA_PLAN = [
  "# Plan",
  "",
  "**commit 边界机制（本 program 全 phase 生效）**：first paragraph of the commitment rule",
  "",
  "second paragraph elaborating the commitment rule",
  "",
  "third paragraph still inside the same commitment body",
  "",
  "---",
  "",
  "### Task 1: x",
  "body",
].join("\n");

const MULTI_PARA_EXTRACTED = `${[
  "**commit 边界机制（本 program 全 phase 生效）**：first paragraph of the commitment rule",
  "",
  "second paragraph elaborating the commitment rule",
  "",
  "third paragraph still inside the same commitment body",
].join("\n")}\n`;

// Multi-paragraph body bounded by a `---` rule (the structural boundary of the literal form).
const MULTI_PARA_BOUNDED = [
  "# Plan",
  "",
  "**commit 边界机制**：first paragraph of the commitment rule",
  "",
  "continuation paragraph",
  "",
  "---",
  "",
  "### Task 1: x",
  "body",
].join("\n");

// Prefix-collision heading (findings 2): `**commit 边界机制 补充**：…` shares the anchor as a prefix
// but is a different declaration — the constricted anchor regex must not let it occupy the slot.
const PREFIX_COLLISION_PLAN = [
  "# Plan",
  "",
  "**commit 边界机制 补充**：a differently-named heading with the anchor as prefix",
  "",
  "**commit 边界机制（本 program 全 phase 生效）**：the real anchored paragraph",
  "",
  "**顺序原则**：ordering-principle constraint",
].join("\n");

// tmp'd plan file in a fake repo-less dir (the pure fns take paths, not repos).
function tmpPlan(content: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-plan-src-"));
  const p = path.join(dir, "docs", "plans", "plan.md");
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
}

describe("extractPlanConstraints — source extraction determinism", () => {
  it("prose-pointer form: the four anchored paragraphs, canonical order, verbatim bytes", () => {
    expect(validator.extractPlanConstraints(PROSE_PLAN)).toBe(PROSE_EXTRACTED);
  });

  it("deterministic: identical input → identical output (recomputable baseline)", () => {
    expect(validator.extractPlanConstraints(PROSE_PLAN)).toBe(
      validator.extractPlanConstraints(PROSE_PLAN),
    );
    const a = validator.extractPlanConstraints(LITERAL_PLAN);
    const b = validator.extractPlanConstraints(LITERAL_PLAN);
    expect(a).toBe(b);
    expect(a).toBe(LITERAL_EXTRACTED);
  });

  it("partial prose pointer: missing anchors are omitted, present ones keep canonical order", () => {
    // Flow removed whole (heading + its separator blank) — a plain replacement in the anchor
    // stream would be absorbed by the preceding block, so the omission is modelled by deletion.
    const partial = PROSE_PLAN.replace(
      "**Flow Atomicity（本 phase 强化）**：flow-atomicity constraint\n\n",
      "",
    );
    const out = validator.extractPlanConstraints(partial);
    expect(out).not.toBeNull();
    expect(out!.includes("flow-atomicity constraint")).toBe(false);
    // canonical order: 口径 before commit, 顺序原则 last
    expect(out!.indexOf("**口径**") < out!.indexOf("**commit 边界机制")).toBe(true);
    expect(out!.indexOf("**顺序原则")).toBeGreaterThan(out!.indexOf("**commit 边界机制"));
  });

  it("multi-paragraph prose body: blank-line-separated continuations are captured in full", () => {
    expect(validator.extractPlanConstraints(MULTI_PARA_PLAN)).toBe(MULTI_PARA_EXTRACTED);
  });

  it("prose block stops at a structural boundary after the last continuation", () => {
    expect(validator.extractPlanConstraints(MULTI_PARA_BOUNDED)).toBe(
      "**commit 边界机制**：first paragraph of the commitment rule\n\ncontinuation paragraph\n",
    );
  });

  it("prefix-collision heading does not occupy the anchor's slot", () => {
    const out = validator.extractPlanConstraints(PREFIX_COLLISION_PLAN);
    expect(out).not.toBeNull();
    // the constricted anchor regex skips `**commit 边界机制 补充**：…` and lands on the real anchor
    expect(out).toContain("the real anchored paragraph");
    expect(out).not.toContain("differently-named heading");
    // canonical order preserved: commit before 顺序原则
    expect(out!.indexOf("**commit 边界机制")).toBeLessThan(out!.indexOf("**顺序原则"));
  });

  it("canonical form: literal ## Constraints section wins over the prose pointer when both exist", () => {
    const both = `${LITERAL_PLAN}\n${PROSE_PLAN.slice(PROSE_PLAN.indexOf("**口径"))}`;
    const out = validator.extractPlanConstraints(both);
    expect(out).toBe(LITERAL_EXTRACTED);
  });

  it("ASCII colon delimiter is accepted for prose anchors", () => {
    const ascii = PROSE_PLAN.replace("**口径**：", "**口径**:");
    expect(validator.extractPlanConstraints(ascii)).toContain("**口径**:");
  });
});

describe("extractPlanConstraints — missing source", () => {
  it("no ## Constraints and no prose anchors → null (source undeclared)", () => {
    expect(validator.extractPlanConstraints(NO_SOURCE_PLAN)).toBeNull();
  });

  it("empty literal section → null (a declared-but-empty section does not declare constraints)", () => {
    expect(
      validator.extractPlanConstraints("# Plan\n\n## Constraints\n\n### Task 1: x\nbody\n"),
    ).toBeNull();
  });
});

describe("materializePlanConstraints — generate-once workspace artifact", () => {
  it("writes plan-constraints.md with a deterministic plan-hash anchor header", () => {
    const plan = tmpPlan(PROSE_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    const res = materializePlanConstraints(plan, ws);
    expect(res.generated).toBe(true);
    expect(res.path).toBe(path.join(ws, "plan-constraints.md"));
    const text = readFileSync(res.path, "utf8");
    // anchor: plan hash + basename only (never the absolute root — machine-independent bytes)
    expect(text).toContain(`plan hash: ${hashFile(plan)}`);
    expect(text).toContain(`source plan: plan.md`);
    expect(text).not.toContain(path.dirname(path.dirname(plan)));
    // body verbatim-recomputed
    expect(text.endsWith(PROSE_EXTRACTED)).toBe(true);
  });

  it("existing file → no rewrite (generate once), custom content untouched", () => {
    const plan = tmpPlan(PROSE_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    writeFileSync(path.join(ws, "plan-constraints.md"), "operator legible content\n");
    const res = materializePlanConstraints(plan, ws);
    expect(res.generated).toBe(false);
    expect(readFileSync(path.join(ws, "plan-constraints.md"), "utf8")).toBe(
      "operator legible content\n",
    );
  });

  it("plan with no constraint source → throws ConstraintsSourceUndeclared, writes nothing", () => {
    const plan = tmpPlan(NO_SOURCE_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    expect(() => materializePlanConstraints(plan, ws)).toThrow(ConstraintsSourceUndeclared);
    expect(existsSync(path.join(ws, "plan-constraints.md"))).toBe(false);
  });
});

describe("isPlanConstraintsStale — plan-hash anchor comparison", () => {
  it("fresh: anchor matches current plan → false", () => {
    const plan = tmpPlan(PROSE_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    materializePlanConstraints(plan, ws);
    expect(isPlanConstraintsStale(path.join(ws, "plan-constraints.md"), plan)).toBe(false);
  });

  it("plan content moved after generation → true", () => {
    const plan = tmpPlan(PROSE_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    materializePlanConstraints(plan, ws);
    writeFileSync(
      plan,
      PROSE_PLAN.replace("mouthpiece constraint", "mouthpiece constraint — revised"),
    );
    expect(isPlanConstraintsStale(path.join(ws, "plan-constraints.md"), plan)).toBe(true);
  });

  it("un-anchored / missing file → stale (cannot confirm freshness)", () => {
    const plan = tmpPlan(PROSE_PLAN);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-ws-"));
    writeFileSync(path.join(ws, "plan-constraints.md"), "no anchor here\n");
    expect(isPlanConstraintsStale(path.join(ws, "plan-constraints.md"), plan)).toBe(true);
    expect(isPlanConstraintsStale(path.join(ws, "does-not-exist.md"), plan)).toBe(true);
  });
});
