// packages/cdd-engine/tests/handoff-stub.test.mjs
import { describe, it, expect } from "vitest";
import { loadHandoffSchema, validateHandoffSchema, normalizeHandoff, recoverHandoff } from "../lib/handoff/schema.mjs";
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

// ---- fix round 1 追加：骨架值自身合法（原 5 条用例只钉键名与措辞，对**值**合法性零守卫）----

// 骨架 → handoff 的机械还原：删注释行 + 给裸键补引号 —— 即 agent 照骨架写真实 handoff 时做的
// 两件事。产物必须直接过 validateHandoffSchema：占位值若违反 `pattern` / `minimum` / `enum`，
// 留下的占位即 CONTRACT_VIOLATION，而 pattern/minimum 违规**不可归一化剥除** → 白烧一轮 BLOCKED。
function toHandoff(stub) {
  const body = stub.replace(/^```jsonc\n/, "").replace(/\n```$/, "");
  return JSON.parse(body
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))   // 注释行与行尾标注（值内不含 `//`）
    .filter((line) => line.trim() !== "")
    .map((line) => line.replace(/^(\s*)([A-Za-z_]\w*):/, '$1"$2":'))
    .join("\n"));
}

describe("renderHandoffStub — 骨架值自身满足 schema", () => {
  it("机械还原后整对象过校验（cdd review / cdd fix / docs review / branch 四形）", () => {
    const cdd = loadHandoffSchema("cdd");
    const docs = loadHandoffSchema("docs");
    const shapes = [
      ["cdd/review", cdd, "review", 1, {}, "cdd"],
      ["cdd/fix", cdd, "fix", 1, {}, "cdd"],                       // work 型：else 分支要求 status
      ["cdd/branch-review", cdd, "review", 1,
        { values: { phase: "branch-review", review_scope: "branch", commits: { base: "a".repeat(40) } } }, "cdd"],
      ["docs/review", docs, "review", undefined, { docPath: "docs/x.md" }, "docs"],
      ["docs/fix", docs, "fix", undefined, { docPath: "docs/x.md" }, "docs"],
    ];
    for (const [name, schema, mode, taskNum, opts, schemaName] of shapes) {
      const handoff = toHandoff(renderHandoffStub(schema, mode, taskNum, opts));
      const r = validateHandoffSchema(handoff, schemaName);
      expect(r.valid, `${name}: ${r.reason}`).toBe(true);
    }
  });
  it("commits.base 的占位值满足 pattern（不再渲染违反 `^[0-9a-f]{40}$` 的空串）", () => {
    const stub = renderHandoffStub(loadHandoffSchema("cdd"), "review", 1);
    expect(/^\s*base: "([^"]*)"/m.exec(stub)?.[1]).toMatch(/^[0-9a-f]{40}$/);
  });
  it("task 的占位值满足 minimum: 1（TASK 缺省时不再兜底 0）", () => {
    // 原 `parseInt(params.TASK) || 0` 的 0 兜底与 schema `minimum: 1` 相悖 —— 渲染 0 即违规占位。
    const stub = renderHandoffStub(loadHandoffSchema("cdd"), "review", undefined);
    expect(Number(/^\s*task: (-?\d+)/m.exec(stub)?.[1])).toBeGreaterThanOrEqual(1);
  });
  it("调用方真值注入：合法真值进骨架，非法真值回退 schema 示例值", () => {
    const cdd = loadHandoffSchema("cdd");
    const full = "a".repeat(40);
    expect(renderHandoffStub(cdd, "review", 1, { values: { commits: { base: full } } })).toContain(`base: "${full}"`);
    // FIXED_POINT 在测试/降级链上可能是 7 位短形或 "unknown"（templates.test.mjs 用 '7a7327b'）——
    // 不合法即不得进骨架（骨架值必须自身满足 schema）。
    for (const short of ["7a7327b", "unknown", ""]) {
      const stub = renderHandoffStub(cdd, "review", 1, { values: { commits: { base: short } } });
      expect(stub).not.toContain(short === "" ? 'base: ""' : short);
      expect(stub).toMatch(/^\s*base: "[0-9a-f]{40}"/m);
    }
  });
  it("可选枚举键不代 agent 声明：complexity 省略；review_scope 由派发注入；status 仍在（条件必需）", () => {
    const cdd = loadHandoffSchema("cdd");
    // `complexity` 无机械来源（plan 无档位标注）→ 骨架不得预填 enum[0]（"simple" 是伪造的声明）
    expect(renderHandoffStub(cdd, "fix", 1)).not.toMatch(/complexity/);
    // `review_scope` 由派发类型决定 → 调用方注入；implement/fix 不是评审 → 不出现
    expect(renderHandoffStub(cdd, "review", 1, { values: { review_scope: "task" } })).toMatch(/review_scope: "task"/);
    expect(renderHandoffStub(cdd, "review", 1, { values: { review_scope: "branch" } })).toMatch(/review_scope: "branch"/);
    expect(renderHandoffStub(cdd, "fix", 1)).not.toMatch(/review_scope/);
    // `status` 是 allOf 条件必需键 → 保留在骨架里，值取 schema 的 enum[0]（不再是硬编码字面量）
    expect(renderHandoffStub(cdd, "fix", 1)).toMatch(/status: "APPROVED"/);
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
  it("findings / unverifiable / plan_conflicts 非数组 → 不抛（原为 TypeError: findings.some is not a function）", () => {
    // agent 常把 findings 写成 "none" / {} / 数字；而 review 族缺 status 是 schema 明确许可的形态
    // （allOf[0].then.required: []）。旧实现把未校验的 agent 值直接喂 rollupStatus → 归一化单点在
    // CONTRACT_VIOLATION 恢复路径上崩溃（runner 无 catch → exit 2、不写 BLOCKED handoff、findings 全丢）。
    const raw = { task: 1, phase: "review", artifacts: {}, findings: "none" };
    const out = normalizeHandoff(raw, "cdd");
    expect(out.status).toBe("APPROVED");                                 // rollup 收到守卫后的 []
    expect(validateHandoffSchema(out, "cdd").valid).toBe(false);         // 归一化不可救 → 调用方走 BLOCKED
    for (const bad of ["x", {}, 7, null]) {
      expect(() => normalizeHandoff({ ...raw, findings: bad, unverifiable: bad, plan_conflicts: bad }, "cdd")).not.toThrow();
    }
  });
});

describe("recoverHandoff — CONTRACT_VIOLATION 恢复单点（三路 runner 同源消费）", () => {
  it("归一化命中 → valid: true，handoff 即可继续形态（findings 全额保留）", () => {
    const rec = recoverHandoff({ task: 1, phase: "review", artifacts: {}, findings: [{ severity: "warn" }], review_notes: "x" }, "cdd");
    expect(rec.valid).toBe(true);
    expect(rec.handoff).not.toHaveProperty("review_notes");
    expect(rec.handoff.findings).toEqual([{ severity: "warn" }]);
  });
  it("归一化不可救 → valid: false，reason 含违规键名 + ajv 明细，preservedFindings 过数组守卫", () => {
    // 未知键（review_notes）+ 不可救违规（findings 非数组、缺 required task）同时在场
    const rec = recoverHandoff({ phase: "review", artifacts: {}, findings: "none", review_notes: "x" }, "cdd");
    expect(rec.valid).toBe(false);
    expect(rec.property).toBe("review_notes");        // 违规键名取自原对象那轮校验（归一化已剥除 → 重校验面看不到）
    expect(rec.reason).toMatch(/^ \(unexpected key: review_notes\): /);
    expect(rec.reason).toMatch(/task/);               // ajv 明细（缺 required）
    expect(rec.preservedFindings).toEqual([]);        // 非数组 findings → 守卫成 []（守卫只写在本单点）
    expect(rec.handoff).not.toHaveProperty("review_notes");
  });
  it("原对象无违规键名 → reason 无后缀（三处调用方不再各自拼串）", () => {
    const rec = recoverHandoff({ task: "1", phase: "review", artifacts: {}, findings: [] }, "cdd");   // task 类型不符
    expect(rec.valid).toBe(false);
    expect(rec.property).toBeUndefined();
    expect(rec.reason).toMatch(/^: /);
    expect(rec.preservedFindings).toEqual([]);
  });
});