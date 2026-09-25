// packages/cdd-engine/src/rules/__tests__/schema-utils.test.ts
// Validates against the REAL task-handoff-schema.json (no fabricated fs mock —
// a fabricated schema would pass even if the shipped schema were corrupted).
import { describe, expect, it } from "vitest";
import { HandoffSchemaValidator } from "../schema.ts";

const schemaValidator = new HandoffSchemaValidator();

// Handoffs must satisfy the real shipped schema (task/phase/status/findings/
// artifacts required; blocker optional; additionalProperties: false).
const VALID_HANDOFF = {
  tasks: [1],
  phase: "implement",
  status: "APPROVED",
  commits: { base: "a".repeat(40), head: "b".repeat(40) },
  findings: [],
  artifacts: { brief: "/ws/tasks-1-brief.md" },
  blocker: "none",
};

describe("validateHandoffSchema (real schema)", () => {
  it("valid handoff passes", () => {
    expect(schemaValidator.validateHandoffSchema(VALID_HANDOFF)).toEqual({ valid: true });
  });

  it("missing required field (tasks) fails", () => {
    const { tasks, ...missingTasks } = VALID_HANDOFF;
    const res = schemaValidator.validateHandoffSchema(missingTasks);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("tasks");
  });

  it("tasks as string fails (must be an integer array)", () => {
    const res = schemaValidator.validateHandoffSchema({ ...VALID_HANDOFF, tasks: "1" });
    expect(res.valid).toBe(false);
  });

  it("blocker is optional (not required by real schema)", () => {
    const { blocker, ...noBlocker } = VALID_HANDOFF;
    expect(schemaValidator.validateHandoffSchema(noBlocker)).toEqual({ valid: true });
  });

  it("invalid status enum fails", () => {
    const res = schemaValidator.validateHandoffSchema({ ...VALID_HANDOFF, status: "DONE" });
    expect(res.valid).toBe(false);
  });

  it("unknown property rejected (additionalProperties: false)", () => {
    const res = schemaValidator.validateHandoffSchema({ ...VALID_HANDOFF, doc_path: "/x/y.md" });
    expect(res.valid).toBe(false);
  });
});

describe("status conditional — review 族可缺省 / implement·fix required（T5 status 单一权威）", () => {
  it("review phase: status 缺省 → valid（engine 从 findings 派生，缺省合法）", () => {
    const { status, ...noStatus } = { ...VALID_HANDOFF, phase: "review" };
    expect(schemaValidator.validateHandoffSchema(noStatus)).toEqual({ valid: true });
  });

  it("branch-review phase: status 缺省 → valid", () => {
    const { status, ...noStatus } = { ...VALID_HANDOFF, phase: "branch-review" };
    expect(schemaValidator.validateHandoffSchema(noStatus)).toEqual({ valid: true });
  });

  it("review phase: status 显式提供 → valid", () => {
    expect(schemaValidator.validateHandoffSchema({ ...VALID_HANDOFF, phase: "review" })).toEqual({
      valid: true,
    });
  });

  it("implement / fix phase: status 缺省 → invalid（work 型 status 必需）", () => {
    const { status, ...noStatus } = { ...VALID_HANDOFF, phase: "implement" };
    expect(schemaValidator.validateHandoffSchema(noStatus).valid).toBe(false);
    expect(schemaValidator.validateHandoffSchema({ ...noStatus, phase: "fix" }).valid).toBe(false);
  });
});

// docs schema（§2.5.7「schema 校验过」）：真实 docs-handoff-schema 既收 doc_path 又收 doc_hash
//（additionalProperties:false 下已声明属性不误伤；未知属性仍拒）——若 schema 属性被删/拼错即红。
describe("docs handoff schema (doc_hash)", () => {
  const DOCS = {
    phase: "review",
    status: "APPROVED",
    findings: [],
    artifacts: {},
    doc_path: "/x.md",
    doc_hash: "a".repeat(64),
  };
  it("doc_path + doc_hash 同携 valid（schema 显式声明 doc_hash 属性）", () => {
    expect(schemaValidator.validateHandoffSchema(DOCS, "docs")).toEqual({ valid: true });
  });
  it("doc_hash optional（无 doc_hash 的 legacy handoff 仍 valid）", () => {
    const { doc_hash, ...legacy } = DOCS;
    expect(schemaValidator.validateHandoffSchema(legacy, "docs")).toEqual({ valid: true });
  });
  it("additionalProperties:false 仍桩——未知属性拒绝", () => {
    expect(schemaValidator.validateHandoffSchema({ ...DOCS, bogus: 1 }, "docs").valid).toBe(false);
  });
});
