// packages/cdd-engine/src/rules/__tests__/rules.schema.test.ts
// Independent source of truth = the templates/schema/*.json plus templates/engine-config.json
// #handoffNamespace (read fresh in this file; never recomputed the way the port computes). Same
// seams as handoff-stub.test.mjs / schema-utils.test.mjs, which keep guarding the legacy .mjs copy.
// Covers the write-side contract that makes CONTRACT_VIOLATION recovery lossless:
// validate → normalize → re-validate is a single testable unit (T5).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// normalizeHandoff / recoverHandoff now live in artifacts/handoff/finalize.ts — the module that
// owns status derivation, while the validator stays on rules/schema.ts; this file's import split
// tracks the schema⇄finalize cycle break. (P6 Task 24 B)
import { loadHandoffSchema, validateHandoffSchema, loadHandoffNamespace } from "../schema.ts";
import { normalizeHandoff, recoverHandoff } from "../../artifacts/handoff/finalize.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => JSON.parse(readFileSync(path.join(HERE, "..", "..", "..", "templates", rel), "utf8"));

const TASK_SCHEMA = read(path.join("schema", "task-handoff-schema.json"));
const DOCS_SCHEMA = read(path.join("schema", "docs-handoff-schema.json"));
const NAMESPACE = read("engine-config.json").handoffNamespace;

const validTask = {
  tasks: [1],
  phase: "review",
  status: "APPROVED",
  artifacts: { brief: "b.md" },
  findings: [],
};

describe("rules/schema.ts — loadHandoffSchema / loadHandoffNamespace canonical 单读", () => {
  it("loadHandoffSchema('task') 返回 templates/schema/task-handoff-schema.json 原值", () => {
    expect(loadHandoffSchema("task")).toEqual(TASK_SCHEMA);
  });

  it("loadHandoffSchema('docs') 返回 docs-handoff-schema.json 原值", () => {
    expect(loadHandoffSchema("docs")).toEqual(DOCS_SCHEMA);
  });

  it("loadHandoffSchema 未知 schema 名 → throw unknown handoff schema", () => {
    expect(() => loadHandoffSchema("bogus")).toThrow(/unknown handoff schema/);
  });

  it("loadHandoffNamespace 返回 engine-config#handoffNamespace 原值（workspaceRoot + 9 families）", () => {
    const ns = loadHandoffNamespace();
    expect(ns).toEqual(NAMESPACE);
    expect(ns.workspaceRoot).toBe(".osuperpowers/cdd");
    expect(Object.keys(ns.families)).toHaveLength(9);
  });
});

describe("rules/schema.ts — validateHandoffSchema", () => {
  it("合法 task handoff → { valid: true }", () => {
    expect(validateHandoffSchema(validTask)).toEqual({ valid: true });
  });

  it("AC10: notes 可选字段被 schema 接受", () => {
    expect(validateHandoffSchema({ ...validTask, notes: "re-recorded after fix" })).toEqual({ valid: true });
  });

  it("缺 required 字段 → { valid: false, reason 含 must have required property }", () => {
    const r = validateHandoffSchema({ phase: "review", findings: [] });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/must have required property/);
  });

  it("未知键 → { valid: false, property: 键名, reason 含 unexpected key }", () => {
    const r = validateHandoffSchema({ ...validTask, junk: 5 });
    expect(r.valid).toBe(false);
    expect(r.property).toBe("junk");
    expect(r.reason).toContain("unexpected key: junk");
  });
});

describe("P6 T24 B: finalize.ts — normalizeHandoff (single-point re-validate; moved from schema.ts)", () => {
  it("① 剥除 schema 未声明键", () => {
    expect(normalizeHandoff({ ...validTask, junk: 5 })).toEqual({ ...validTask });
  });

  it("② blocker: null → 省略（schema 声明 string，null 非法）", () => {
    expect(normalizeHandoff({ ...validTask, blocker: null })).toEqual(validTask);
  });

  it("③ review 族缺 status → 按 findings roll-up 派生（warn/nit → APPROVED）", () => {
    expect(normalizeHandoff({ ...validTask, status: undefined })).toMatchObject({ status: "APPROVED" });
  });

  it("③ review 族含 blocker finding → 派生 CHANGES_REQUESTED", () => {
    const n = normalizeHandoff({
      tasks: [1],
      phase: "review",
      artifacts: {},
      findings: [{ severity: "blocker" }],
    });
    expect(n.status).toBe("CHANGES_REQUESTED");
  });

  it("work 型（implement）缺 status → 不派生（schema else.required 强制 agent 声明）", () => {
    const n = normalizeHandoff({ tasks: [1], phase: "implement", artifacts: {}, findings: [] });
    expect("status" in n).toBe(false);
  });

  it("非对象输入原样透传（透传契约由恢复面 objOrEmpty 收口）", () => {
    expect(normalizeHandoff("status: APPROVED")).toBe("status: APPROVED");
    expect(normalizeHandoff([1, 2])).toEqual([1, 2]);
    expect(normalizeHandoff(null)).toBeNull();
  });
});

describe("P6 T24 B: finalize.ts — recoverHandoff (CONTRACT_VIOLATION recovery single point, findings fully preserved)", () => {
  it("合法输入 → { handoff, valid: true }", () => {
    const r = recoverHandoff(validTask);
    expect(r.valid).toBe(true);
    expect(r.handoff).toEqual(validTask);
  });

  it("仅未知键 → 归一化命中 valid: true（handoff 即可继续形态，findings 全额保留）", () => {
    const r = recoverHandoff({ ...validTask, junk: 5 });
    expect(r.valid).toBe(true);
    expect(r.handoff).toEqual(validTask);
    expect(r.handoff).not.toHaveProperty("junk");
  });

  it("不可救违规 + 未知键同场 → valid:false + handoff 已剥键 + property/reason 指向原键", () => {
    const r = recoverHandoff({ phase: "review", findings: [], artifacts: {}, junk: 5 });
    expect(r.valid).toBe(false);
    expect(r.handoff).not.toHaveProperty("junk");
    expect(r.property).toBe("junk");
    expect(r.reason).toContain("unexpected key: junk");
    expect(r.preservedFindings).toEqual([]);
  });

  it("findings 非数组（agent 写 none）→ preservedFindings 数组守卫收口为 []", () => {
    const r = recoverHandoff({ ...validTask, findings: "none" });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/must be array/);
    expect(r.preservedFindings).toEqual([]);
  });

  it("findings 数组保留（AC7：违规键剥除不影响 findings 全额保留；缺 task 不可救 → valid:false）", () => {
    const findings = [{ severity: "warn", summary: "keep me" }];
    const r = recoverHandoff({ phase: "review", artifacts: {}, findings, junk: 1 });
    expect(r.valid).toBe(false);
    expect(r.handoff).not.toHaveProperty("junk");
    expect(r.preservedFindings).toEqual(findings);
  });

  it("非对象顶层输入（数组/裸字符串）→ 必然 invalid，findings []", () => {
    const r = recoverHandoff([{ findings: [] }]);
    expect(r.valid).toBe(false);
    expect(r.handoff).toEqual({});
    expect(r.preservedFindings).toEqual([]);
  });

  it("docs 族 schema 生效（缺 doc_path → invalid）", () => {
    const r = recoverHandoff({ phase: "review", findings: [], artifacts: {} }, "docs");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/must have required property/);
  });
});

// ---- Lifecycle contract core single-source assertion (T5 AC7 "no dual core blocks in the handoff schema" + AC6 docs reversal) ----
// The lifecycle contract core (status / commits{base,head} / failure_category / blocker / changes /
// artifacts / findings) is ONE core — the task and docs schemas declare it through identical
// definitions; lane differences are ONLY the boundary objects (docs: doc_path/doc_hash; task:
// task). A divergent core (e.g. docs losing TIMEOUT or keeping the commits-free declaration) must
// fail here before it ships.
describe("T5 AC7: handoff schema single-source core (task/docs one contract core; lane differences are only boundary objects)", () => {
  const taskProps = (loadHandoffSchema("task") as { properties: Record<string, Record<string, unknown>> }).properties;
  const docsProps = (loadHandoffSchema("docs") as { properties: Record<string, Record<string, unknown>> }).properties;

  it("status enum single-source: docs = task (BREAKING — docs status gains the TIMEOUT attribution declaration)", () => {
    expect(docsProps.status.enum).toEqual(["APPROVED", "BLOCKED", "CHANGES_REQUESTED", "TIMEOUT"]);
    expect(docsProps.status.enum).toEqual(taskProps.status.enum);
    expect(String(docsProps.status.description)).toContain("TIMEOUT");
    expect(String(docsProps.status.description)).toContain("terminal");
  });

  it("commits{base,head} single-source: docs definition deep-equals the task family (base ^[0-9a-f]{40}$; required [base])", () => {
    expect(docsProps.commits).toEqual(taskProps.commits);
    expect(docsProps.commits.required).toEqual(["base"]);
    expect((docsProps.commits.properties as Record<string, { pattern?: string }>).base.pattern).toBe("^[0-9a-f]{40}$");
  });

  it("failure_category channel enum single-source + blocker singular unification (neither family has a blockers plural key)", () => {
    expect(docsProps.failure_category.enum).toEqual(taskProps.failure_category.enum);
    expect(Object.keys(docsProps)).not.toContain("blockers");
    expect(Object.keys(taskProps)).not.toContain("blockers");
    expect(docsProps.blocker.type).toBe("string");
    expect(taskProps.blocker.type).toBe("string");
  });

  it("core block key shapes align (changes/artifacts/findings same type); lane differences are only boundary objects (docs: doc_path/doc_hash; task: tasks group reference)", () => {
    expect(docsProps.changes.type).toBe(taskProps.changes.type);
    expect(docsProps.artifacts.type).toBe(taskProps.artifacts.type);
    expect(docsProps.findings.type).toBe(taskProps.findings.type);
    expect(docsProps.doc_path.type).toBe("string");
    expect(docsProps.doc_hash.type).toBe("string");
    // the task-lane boundary is the `tasks` group reference (array); the legacy scalar `task` is
    // deleted from the shared schema (single-data-model)
    expect(taskProps.tasks.type).toBe("array");
    expect(taskProps.task).toBeUndefined();
    expect(taskProps.doc_path).toBeUndefined();
    expect(taskProps.doc_hash).toBeUndefined();
    expect(docsProps.task).toBeUndefined();
    expect(docsProps.tasks).toBeUndefined();
  });

  it("docs handoff reversal (AC6): the commits-free legacy declaration is removed + a valid docs commits handoff passes schema validation", () => {
    expect(String(docsProps.changes.description)).not.toContain("carry no commits field");
    expect(validateHandoffSchema({
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
      doc_path: "spec.md",
      commits: { base: "a".repeat(40), head: "b".repeat(40) },
    }, "docs")).toEqual({ valid: true });
    // base must be 40-hex (same task-family pattern; non-hex rejected)
    const r = validateHandoffSchema({
      phase: "fix", status: "APPROVED", findings: [], artifacts: {}, doc_path: "spec.md",
      commits: { base: "short" },
    }, "docs");
    expect(r.valid).toBe(false);
  });
});
