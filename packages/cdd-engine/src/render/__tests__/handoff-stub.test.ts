// packages/cdd-engine/src/render/__tests__/handoff-stub.test.ts
import { describe, it, expect } from "vitest";
import { loadHandoffSchema, validateHandoffSchema, normalizeHandoff, recoverHandoff } from "../../rules/schema.ts";
import { renderHandoffSchemaJson } from "../templates.ts";

// ---- Task 18：renderHandoffSchemaJson = schema 原样注入（零 render、零解释器、零第二校验器）----

describe("renderHandoffSchemaJson — schema 原样注入", () => {
  it("stub = schema 本体的 ```json 块：解析后逐键相等、description 随附", () => {
    const schema = loadHandoffSchema("task");
    const stub = renderHandoffSchemaJson(schema);
    expect(stub.startsWith("```json\n")).toBe(true);      // 载体是 json（非 jsonc：schema 本体无注释行可复制）
    expect(stub.endsWith("\n```")).toBe(true);
    const parsed = JSON.parse(stub.replace(/^```json\n/, "").replace(/\n```$/, ""));
    expect(parsed).toEqual(schema);
    expect(stub).toContain('"description"');               // 写协议规则随 schema 注入
  });

  it("两份 schema 顶层 + 逐 property 均有 description（写协议规则迁入 schema）", () => {
    for (const name of ["task", "docs"]) {
      const schema = loadHandoffSchema(name);
      expect(schema.description, name).toMatch(/\S/);
      for (const [key, prop] of Object.entries(schema.properties ?? {})) {
        expect(prop.description, `${name}#${key}`).toMatch(/\S/);
      }
    }
  });

  it("stub 与 schema 键集同构（不新增不删减：注入面 = 契约面）", () => {
    const schema = loadHandoffSchema("task");
    const parsed = JSON.parse(renderHandoffSchemaJson(schema).replace(/^```json\n/, "").replace(/\n```$/, ""));
    expect(Object.keys(parsed)).toEqual(Object.keys(schema));
  });

  it("commits.head 为 schema 契约键（写协议规则迁入：full 40-char SHA）", () => {
    const schema = loadHandoffSchema("task");
    expect(schema.properties.commits.properties.head.description).toMatch(/40-char|SHort|--short/i);
    // head 是可选的（required 仍只有 base —— branch 派发省略 head 仍合法）
    expect(schema.properties.commits.required).toEqual(["base"]);
  });

  it("status 描述承载 engine 派生语义（Write findings, not status）", () => {
    const schema = loadHandoffSchema("task");
    expect(schema.properties.status.description).toMatch(/findings, not status/i);
  });

  it("blocker 描述：无阻塞时省略（非 null）", () => {
    const schema = loadHandoffSchema("docs");
    expect(schema.properties.blocker.description).toMatch(/omit|省略/i);
  });
});

// ---- validateHandoffSchema — 失败形态与磁盘契约一致（不改名；schema 名 cdd→task 随文件改名）----

describe("validateHandoffSchema — 失败形态与磁盘契约一致（不改名）", () => {
  it("失败返回 `valid`（非 `ok`），且 `reason` 含违规键名", () => {
    // task required = task / phase / artifacts / findings；`review_notes` 触发 additionalProperties:false
    const r = validateHandoffSchema({ task: 1, phase: "review", artifacts: {}, findings: [], review_notes: "x" }, "task");
    expect(r.valid).toBe(false);              // 既有键名不变（三个 lib 消费方 + 四个测试按 .valid 判定）
    expect(r.property).toBe("review_notes");  // T5 新增键
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
    expect(validateHandoffSchema(raw, "task").valid).toBe(false);
    const fixed = normalizeHandoff(raw, "task");
    expect(fixed).not.toHaveProperty("review_notes");
    expect(validateHandoffSchema(fixed, "task").valid).toBe(true);
    // findings 全额保留（AC7 类目级要求；不得在恢复路径上被清空）
    expect(fixed.findings).toEqual([{ severity: "warn" }]);
  });
  it("`blocker: null` → 省略（schema blocker 为 string，null 非法）", () => {
    const fixed = normalizeHandoff({ task: 1, phase: "review", artifacts: {}, findings: [], blocker: null }, "task");
    expect(fixed).not.toHaveProperty("blocker");
    expect(validateHandoffSchema(fixed, "task").valid).toBe(true);
  });
  it("review 族缺 status → 按 findings roll-up 派生补上（work 型不补——schema else 分支强制 agent 声明）", () => {
    const base = { task: 1, artifacts: {}, findings: [{ severity: "blocker" }] };
    expect(normalizeHandoff({ ...base, phase: "review" }, "task").status).toBe("CHANGES_REQUESTED");
    expect(normalizeHandoff({ ...base, phase: "branch-review", findings: [] }, "task").status).toBe("APPROVED");
    // work 型（implement）status 缺省不被补 —— 否则 schema 的 else.required 约束被归一化单点绕过
    expect(normalizeHandoff({ ...base, phase: "implement" }, "task")).not.toHaveProperty("status");
  });
  it("已含声明键与非对象输入原样透传（无副作用）", () => {
    const ok = { task: 1, phase: "review", status: "APPROVED", artifacts: {}, findings: [] };
    expect(normalizeHandoff(ok, "task")).toEqual(ok);
    expect(normalizeHandoff(null, "task")).toBe(null);
  });
  it("findings / unverifiable / plan_conflicts 非数组 → 不抛（原为 TypeError: findings.some is not a function）", () => {
    // agent 常把 findings 写成 "none" / {} / 数字；而 review 族缺 status 是 schema 明确许可的形态
    // （allOf[0].then.required: []）。旧实现把未校验的 agent 值直接喂 rollupStatus → 归一化单点在
    // CONTRACT_VIOLATION 恢复路径上崩溃（runner 无 catch → exit 2、不写 BLOCKED handoff、findings 全丢）。
    const raw = { task: 1, phase: "review", artifacts: {}, findings: "none" };
    const out = normalizeHandoff(raw, "task");
    expect(out.status).toBe("APPROVED");                                 // rollup 收到守卫后的 []
    expect(validateHandoffSchema(out, "task").valid).toBe(false);         // 归一化不可救 → 调用方走 BLOCKED
    for (const bad of ["x", {}, 7, null]) {
      expect(() => normalizeHandoff({ ...raw, findings: bad, unverifiable: bad, plan_conflicts: bad }, "task")).not.toThrow();
    }
  });
});

describe("recoverHandoff — CONTRACT_VIOLATION 恢复单点（三路 runner 同源消费）", () => {
  it("归一化命中 → valid: true，handoff 即可继续形态（findings 全额保留）", () => {
    const rec = recoverHandoff({ task: 1, phase: "review", artifacts: {}, findings: [{ severity: "warn" }], review_notes: "x" }, "task");
    expect(rec.valid).toBe(true);
    expect(rec.handoff).not.toHaveProperty("review_notes");
    expect(rec.handoff.findings).toEqual([{ severity: "warn" }]);
  });
  it("归一化不可救 → valid: false，reason 含违规键名 + ajv 明细，preservedFindings 过数组守卫", () => {
    // 未知键（review_notes）+ 不可救违规（findings 非数组、缺 required task）同时在场
    const rec = recoverHandoff({ phase: "review", artifacts: {}, findings: "none", review_notes: "x" }, "task");
    expect(rec.valid).toBe(false);
    expect(rec.property).toBe("review_notes");        // 违规键名取自原对象那轮校验（归一化已剥除 → 重校验面看不到）
    expect(rec.reason).toMatch(/^ \(unexpected key: review_notes\): /);
    expect(rec.reason).toMatch(/task/);               // ajv 明细（缺 required）
    expect(rec.preservedFindings).toEqual([]);        // 非数组 findings → 守卫成 []（守卫只写在本单点）
    expect(rec.handoff).not.toHaveProperty("review_notes");
  });
  it("原对象无违规键名 → reason 无后缀（三处调用方不再各自拼串）", () => {
    const rec = recoverHandoff({ task: "1", phase: "review", artifacts: {}, findings: [] }, "task");   // task 类型不符
    expect(rec.valid).toBe(false);
    expect(rec.property).toBeUndefined();
    expect(rec.reason).toMatch(/^: /);
    expect(rec.preservedFindings).toEqual([]);
  });
  it("非对象顶层输入收口为对象 → 载荷不漏索引键且自身合法（engine 是载体唯一作者）", () => {
    // 缺陷面：`normalizeHandoff` 对非对象输入原样透传（`schema.mjs` 透传契约由本文件用例钉住），
    // 失败分支把它放回 `handoff`，而三处消费方一律 `{ ...rec.handoff, … }` 组装落盘载荷——`{...x}` 对非对象是
    // **索引展开**、不抛错 → engine 亲手写出含 `"0"`… 的 BLOCKED 载体，被自家 schema 的 additionalProperties
    // 拒绝（T5 存在的唯一理由就是消灭这一类 CONTRACT_VIOLATION）。收口点选在 `recoverHandoff`（与校验器同
    // 文件的单点），`normalizeHandoff` 的透传契约不动。
    for (const bad of [[{ severity: "warn", summary: "x" }], "BLOCKED", 42, true]) {
      const rec = recoverHandoff(bad, "task");
      expect(rec.valid).toBe(false);
      expect(Object.keys(rec.handoff)).not.toContain("0");       // 索引展开面
      expect(Array.isArray(rec.preservedFindings)).toBe(true);
      // 按 run-task.mjs 8.8 的载荷形状原样组装 → 必须过校验
      const payload = {
        task: 1, phase: "review", status: "BLOCKED",
        findings: rec.preservedFindings, artifacts: {},
        blocker: `handoff schema invalid${rec.reason} → fix the handoff JSON and re-dispatch task 1`,
      };
      const r = validateHandoffSchema(payload, "task");
      expect(r.valid, `${JSON.stringify(bad)} → ${r.reason}`).toBe(true);
    }
    // 顶层数组不是 findings 字段（收口为 `{}` → 无 findings 可留，与「无 findings 可留 → []」同语义）；
    // 对象形的 findings 照旧全额保留（AC7）。
    expect(recoverHandoff([{ severity: "warn" }], "task").preservedFindings).toEqual([]);
    expect(recoverHandoff(
      { phase: "review", artifacts: {}, findings: [{ severity: "warn" }], unknownField: 1 }, "task",
    ).preservedFindings).toEqual([{ severity: "warn" }]);
  });
});

// ---- fix round 3（review-3 finding 1，warn）：不可救分支的 BLOCKED 载荷 = engine 自写字面量 + 仅 findings ----
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
      const rec = recoverHandoff(handoff, "task");
      expect(rec.valid, "恢复面应判归一化不可救（已声明键违规不可剥除）").toBe(false);
      // ① task 8.8 归一化不可救分支（src/dispatch/task.ts）——不 spread rec.handoff
      const taskPayload = {
        task: 1, phase: "review", status: "BLOCKED",
        findings: rec.preservedFindings, artifacts: {},
        blocker: `handoff schema invalid${rec.reason} → fix the handoff JSON and re-dispatch task 1`,
      };
      expect(validateHandoffSchema(taskPayload, "task").valid,
        `run-task 形（${rec.reason}）`).toBe(true);
      // ② docs writeBlocked（src/dispatch/docs.ts）——doc_path/doc_hash 为引擎真值
      const docsPayload = {
        phase: "review", status: "BLOCKED", findings: rec.preservedFindings,
        artifacts: {}, doc_path: "docs/x.md", doc_hash: "abcd",
        blocker: `docs handoff schema invalid${rec.reason} → fix the handoff JSON and re-run review`,
      };
      expect(validateHandoffSchema(docsPayload, "docs").valid,
        `docs 形（${rec.reason}）`).toBe(true);
      // ③ branch-review writeBranchBlocked（src/cli/branch-review.ts）——commits 仅 base 全形时写入
      const branchPayload = {
        task: 1, phase: "branch-review", status: "BLOCKED",
        commits: { base: "a".repeat(40), head: "b".repeat(40) },
        findings: rec.preservedFindings, artifacts: {},
        blocker: `branch-review handoff schema invalid${rec.reason} → fix and re-run branch-review`,
      };
      expect(validateHandoffSchema(branchPayload, "task").valid,
        `branch 形（${rec.reason}）`).toBe(true);
    });
  }
  it("回归锚：`{...rec.handoff, …}` spread 组装在声明键违规输入上必然 invalid（spread 面即缺陷根）", () => {
    // 复现 review-3 实测：`notes: 5` 经收口后的 `rec.handoff`（已声明键原值保留）spread 进 payload →
    // `payload.valid=false`（/notes must be string）。这恰是旧载荷形状不可逆的失败面——
    // 若有人把三处消费方改回 spread 组装，本锚立即标明该载荷违反自家 schema。
    const rec = recoverHandoff({ task: 1, phase: "review", artifacts: {}, findings: [], notes: 5 }, "task");
    expect(rec.valid).toBe(false);
    expect(rec.handoff.notes).toBe(5);                       // 已声明键原值被归一化保留（缺陷的泄漏源）
    const legacy = {
      ...rec.handoff, task: 1, phase: "review", status: "BLOCKED",
      findings: rec.preservedFindings, artifacts: rec.handoff.artifacts ?? {},
      blocker: `handoff schema invalid${rec.reason} → ...`,
    };
    expect(validateHandoffSchema(legacy, "task").valid).toBe(false);
    expect(validateHandoffSchema(legacy, "task").reason).toMatch(/notes must be string/);
  });
});
