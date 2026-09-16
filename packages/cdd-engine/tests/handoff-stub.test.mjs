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
  it("非对象顶层输入收口为对象 → 载荷不漏索引键且自身合法（engine 是载体唯一作者）", () => {
    // 缺陷面：`normalizeHandoff` 对非对象输入原样透传（`schema.mjs:87`，透传契约由本文件 :154 用例钉住），
    // 失败分支把它放回 `handoff`，而三处消费方一律 `{ ...rec.handoff, … }` 组装落盘载荷——`{...x}` 对非对象是
    // **索引展开**、不抛错 → engine 亲手写出含 `"0"`… 的 BLOCKED 载体，被自家 schema 的 additionalProperties
    // 拒绝（T5 存在的唯一理由就是消灭这一类 CONTRACT_VIOLATION）。收口点选在 `recoverHandoff`（与校验器同
    // 文件的单点），`normalizeHandoff` 的透传契约不动。
    for (const bad of [[{ severity: "warn", summary: "x" }], "BLOCKED", 42, true]) {
      const rec = recoverHandoff(bad, "cdd");
      expect(rec.valid).toBe(false);
      expect(Object.keys(rec.handoff)).not.toContain("0");       // 索引展开面
      expect(Array.isArray(rec.preservedFindings)).toBe(true);
      // 按 run-task.mjs 8.8 的载荷形状原样组装（review-3 起为 **engine 自写字面量 + 仅 findings**，
      // 不再 spread rec.handoff——非对象输入收口为 {} 后本无键可漏，两形在此输入上等价）→ 必须过校验
      const payload = {
        task: 1, phase: "review", status: "BLOCKED",
        findings: rec.preservedFindings, artifacts: {},
        blocker: `handoff schema invalid${rec.reason} → fix the handoff JSON and re-dispatch task 1`,
      };
      const r = validateHandoffSchema(payload, "cdd");
      expect(r.valid, `${JSON.stringify(bad)} → ${r.reason}`).toBe(true);
    }
    // 顶层数组不是 findings 字段（收口为 `{}` → 无 findings 可留，与「无 findings 可留 → []」同语义）；
    // 对象形的 findings 照旧全额保留（AC7）。
    expect(recoverHandoff([{ severity: "warn" }], "cdd").preservedFindings).toEqual([]);
    expect(recoverHandoff(
      { phase: "review", artifacts: {}, findings: [{ severity: "warn" }], unknownField: 1 }, "cdd",
    ).preservedFindings).toEqual([{ severity: "warn" }]);
  });
});

// ---- fix round 3（review-3 finding 1，warn）：不可救分支的 BLOCKED 载荷 = engine 自写字面量 + 仅 findings ----
// 缺陷面：`{...rec.handoff}` 组装只剥**顶层未知键**，已声明键的 agent 原值（类型/枚举违规：`notes: 5` /
// `commits.base` 短形 / `artifacts: "x"`）原样进载体 → 三处 BLOCKED 载荷违反自家 schema（review-3 实测
// `notes: 5` → payload.valid=false，「engine 是载体唯一作者却写出非契约载体」正是本任务要消灭的类目）。
// recoverHandoff 的归一化无权改这些已声明键的值（normalize 只剥未知键），故引擎不得把它们拼进自己的
// 载体——三处消费方（run-task 8.8 / run-docs writeBlocked / branch-review writeBranchBlocked）一律改为
// 自写字面量 + findings（数组守卫后），载荷与 agent 输入完全解耦。
describe("recoverHandoff 失败分支 → 三处 BLOCKED 载荷恒过校验（engine 字面量 + 仅 findings，不 spread）", () => {
  // 「已声明键类型/枚举违规」输入：normalize 对这些键束手无策（非 unknown key）→ 恢复面必然 valid:false。
  const badInputs = [
    { name: "notes: 5（已声明键类型违规）", handoff: { task: 1, phase: "review", artifacts: {}, findings: [], notes: 5 } },
    { name: "commits.base 7 位短形（pattern 违规）", handoff: { task: 1, phase: "review", artifacts: {}, findings: [], commits: { base: "7a7327b" } } },
    { name: "artifacts: 字符串（类型违规）", handoff: { task: 1, phase: "review", artifacts: "x", findings: [] } },
    { name: "complexity 越枚举", handoff: { task: 1, phase: "review", artifacts: {}, findings: [], complexity: "bogus" } },
    { name: "test_evidence / unverifiable 字符串", handoff: { task: 1, phase: "review", artifacts: {}, findings: [], test_evidence: "x", unverifiable: "x" } },
  ];
  for (const { name, handoff } of badInputs) {
    it(`${name} → 三路 BLOCKED 载荷均 valid: true`, () => {
      const rec = recoverHandoff(handoff, "cdd");
      expect(rec.valid, "恢复面应判归一化不可救（已声明键违规不可剥除）").toBe(false);
      // ① run-task 8.8 归一化不可救分支（lib/runner/run-task.mjs）——不 spread rec.handoff
      const taskPayload = {
        task: 1, phase: "review", status: "BLOCKED",
        findings: rec.preservedFindings, artifacts: {},
        blocker: `handoff schema invalid${rec.reason} → fix the handoff JSON and re-dispatch task 1`,
      };
      expect(validateHandoffSchema(taskPayload, "cdd").valid,
        `run-task 形（${rec.reason}）`).toBe(true);
      // ② run-docs writeBlocked（lib/runner/run-docs.mjs）——doc_path/doc_hash 为引擎真值
      const docsPayload = {
        phase: "review", status: "BLOCKED", findings: rec.preservedFindings,
        artifacts: {}, doc_path: "docs/x.md", doc_hash: "abcd",
        blocker: `docs handoff schema invalid${rec.reason} → fix the handoff JSON and re-run review`,
      };
      expect(validateHandoffSchema(docsPayload, "docs").valid,
        `docs 形（${rec.reason}）`).toBe(true);
      // ③ branch-review writeBranchBlocked（lib/cli/branch-review.mjs）——commits 仅 base 全形时写入
      const branchPayload = {
        task: 1, phase: "branch-review", status: "BLOCKED",
        commits: { base: "a".repeat(40), head: "b".repeat(40) },
        findings: rec.preservedFindings, artifacts: {},
        blocker: `branch-review handoff schema invalid${rec.reason} → fix and re-run branch-review`,
      };
      expect(validateHandoffSchema(branchPayload, "cdd").valid,
        `branch 形（${rec.reason}）`).toBe(true);
    });
  }
  it("回归锚：`{...rec.handoff, …}` spread 组装在声明键违规输入上必然 invalid（spread 面即缺陷根）", () => {
    // 复现 review-3 实测：`notes: 5` 经收口后的 `rec.handoff`（已声明键原值保留）spread 进 payload →
    // `payload.valid=false`（/notes must be string）。这恰是旧载荷形状不可逆的失败面——
    // 若有人把三处消费方改回 spread 组装，本锚立即标明该载荷违反自家 schema。
    const rec = recoverHandoff({ task: 1, phase: "review", artifacts: {}, findings: [], notes: 5 }, "cdd");
    expect(rec.valid).toBe(false);
    expect(rec.handoff.notes).toBe(5);                       // 已声明键原值被归一化保留（缺陷的泄漏源）
    const legacy = {
      ...rec.handoff, task: 1, phase: "review", status: "BLOCKED",
      findings: rec.preservedFindings, artifacts: rec.handoff.artifacts ?? {},
      blocker: `handoff schema invalid${rec.reason} → ...`,
    };
    expect(validateHandoffSchema(legacy, "cdd").valid).toBe(false);
    expect(validateHandoffSchema(legacy, "cdd").reason).toMatch(/notes must be string/);
  });
});
