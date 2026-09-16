// packages/cdd-engine/tests/handoff-stub.test.mjs
import { describe, it, expect } from "vitest";
import { loadHandoffSchema, validateHandoffSchema, normalizeHandoff } from "../lib/handoff/schema.mjs";
import { renderHandoffStub } from "../lib/templates.mjs";

describe("renderHandoffStub — schema 全形派生", () => {
  it("携带 commits 嵌套形状与 status 枚举（非仅 required 空键）", () => {
    const schema = loadHandoffSchema("cdd");
    const stub = renderHandoffStub(schema, "review", 1);
    expect(stub).toMatch(/^\s*commits:/m);   // 嵌套键可见（properties 全形派生，非仅 required）
    expect(stub).toMatch(/^\s+base:/m);      // 嵌套形状可见：base 缩进在 commits 之下
    expect(stub).not.toMatch(/^\s*head:/m);  // 反向断言：commits.head 不是本 schema 的契约键
    expect(stub).toMatch(/APPROVED|CHANGES_REQUESTED/);  // 枚举可见
  });
  it("allOf 条件约束可见（cdd 形：phase ∈ review 时 status 可省）", () => {
    const stub = renderHandoffStub(loadHandoffSchema("cdd"), "review", 1);
    // 可区分形态：断言 allOf 分支所表达的**可省语义措辞行**（由 allOf[0].if.properties.phase.enum + else.required 求值生成），
    // 非仅「键名出现过」——后者在「未实现 allOf 派生」时同样通过（删前删后同结果）。
    expect(stub).toMatch(/when phase ∈ \[review, branch-review\].*status may be omitted.*otherwise status is required/);
  });
  it("allOf 条件约束可见（docs 形：`const` 同样求值——spec/plan 评审注入的就是这一份）", () => {
    // docs-handoff-schema.json 的 allOf[0].if.properties.phase 是 { "const": "review" } 而非 enum；
    // 覆盖它是必需的：lib/runner/run-docs.mjs:64 正是 loadHandoffSchema("docs") + renderHandoffStub(...)，
    // 即 spec/plan 评审提示词。只测 cdd 形则「全形派生」在 docs 面上零守卫。
    const stub = renderHandoffStub(loadHandoffSchema("docs"), "review", undefined, { docPath: "docs/x.md" });
    expect(stub).toMatch(/when phase = review.*status may be omitted.*otherwise status is required/);   // const 形的措辞
    expect(stub).toMatch(/doc_path/);                                                                   // docs 面的必需键可见
    expect(stub).not.toMatch(/commits|complexity|review_scope/);  // 反向断言：docs schema 未声明的 cdd 专属键不得出现
  });
  it("stub 不含 schema 未声明的键（反向断言，防「全键罗列」蒙对）", () => {
    const stub = renderHandoffStub(loadHandoffSchema("cdd"), "review", 1);
    expect(stub).not.toMatch(/review_notes/);
  });
  it("注释行的载体 = jsonc fence 之内（位置可区分，非仅「措辞出现过」）", () => {
    // 载体断言：注释行必须落在 ```jsonc 的开口行之后、闭口行之前。四要素缺一即红——
    // ① 载体是 jsonc（不是 json：带 // 的 json 块被字面复制即非法 JSON，正是 R6 / #250[1] 的 CONTRACT_VIOLATION 形态）
    // ②③ 注释行在代码块**之内**（渲染到 fence 之外会使 Step 1 的两条措辞断言与「不复制注释」的指令脱节）
    const stub = renderHandoffStub(loadHandoffSchema("cdd"), "review", 1);
    const open = stub.indexOf("```jsonc");
    const close = stub.lastIndexOf("```");
    const at = stub.indexOf("// when phase");
    expect(open).toBe(0);
    expect(at).toBeGreaterThan(open);
    expect(at).toBeLessThan(close);
  });
});

describe("validateHandoffSchema — 失败形态与磁盘契约一致（不改名）", () => {
  it("失败返回 `valid`（非 `ok`），且 `reason` 含违规键名", () => {
    // cdd required = task / phase / artifacts / findings；`review_notes` 触发 additionalProperties:false
    const r = validateHandoffSchema({ task: 1, phase: "review", artifacts: {}, findings: [], review_notes: "x" }, "cdd");
    expect(r.valid).toBe(false);              // 既有键名不变（三个 lib 消费方 + 四个测试按 .valid 判定）
    expect(r.property).toBe("review_notes");  // 本任务新增键
    expect(r.reason).toMatch(/review_notes/); // 报错文案含违规键名
  });
  it("通过时返回 `{ valid: true }`（形态不变）", () => {
    // docs required = phase / findings / artifacts / doc_path
    expect(validateHandoffSchema({ phase: "review", doc_path: "x.md", findings: [], artifacts: {} }, "docs").valid).toBe(true);
  });
});

describe("normalizeHandoff — 归一化 → 重校验单点（三个 runner 同源消费）", () => {
  it("剥除 schema 未声明键 → 重校验通过（CONTRACT_VIOLATION 恢复路径）", () => {
    const raw = { task: 1, phase: "review", artifacts: {}, findings: [{ severity: "warn" }], review_notes: "x" };
    expect(validateHandoffSchema(raw, "cdd").valid).toBe(false);
    const fixed = normalizeHandoff(raw, "cdd");
    expect(fixed).not.toHaveProperty("review_notes");
    expect(validateHandoffSchema(fixed, "cdd").valid).toBe(true);
    // findings 全额保留（AC7 类目级要求；不得在恢复路径上被清空）
    expect(fixed.findings).toEqual([{ severity: "warn" }]);
  });
  it("`blocker: null` → 省略（schema blocker 为 string，null 非法）", () => {
    const fixed = normalizeHandoff({ task: 1, phase: "review", artifacts: {}, findings: [], blocker: null }, "cdd");
    expect(fixed).not.toHaveProperty("blocker");
    expect(validateHandoffSchema(fixed, "cdd").valid).toBe(true);
  });
  it("review 族缺 status → 按 findings roll-up 派生补上（work 型不补——schema else 分支强制 agent 声明）", () => {
    const base = { task: 1, artifacts: {}, findings: [{ severity: "blocker" }] };
    expect(normalizeHandoff({ ...base, phase: "review" }, "cdd").status).toBe("CHANGES_REQUESTED");
    expect(normalizeHandoff({ ...base, phase: "branch-review", findings: [] }, "cdd").status).toBe("APPROVED");
    // work 型（implement）status 缺省不被补 —— 否则 schema 的 else.required 约束被归一化单点绕过
    expect(normalizeHandoff({ ...base, phase: "implement" }, "cdd")).not.toHaveProperty("status");
  });
  it("已含声明键与非对象输入原样透传（无副作用）", () => {
    const ok = { task: 1, phase: "review", status: "APPROVED", artifacts: {}, findings: [] };
    expect(normalizeHandoff(ok, "cdd")).toEqual(ok);
    expect(normalizeHandoff(null, "cdd")).toBe(null);
  });
});