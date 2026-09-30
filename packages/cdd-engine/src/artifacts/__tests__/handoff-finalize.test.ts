// packages/cdd-engine/src/artifacts/__tests__/handoff-finalize.test.ts
// finalizeHandoff 是唯一 定稿入口（engine 载体唯一作者）：review 族 rollup 派生 / implement 族实体化
//（无 agentHandoff 输入槽位）/ fix 族 agent 声明保留。三消费方（runner/docs-runner/cdd.mjs）
// 共享同一实现 —— 非各自接线（导入断言）。

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { captureStderr, gitCommit, gitInit } from "../../infra/__tests__/helpers.ts";
import { Workspace } from "../../infra/workspace.ts";
import { FAILURE_CATEGORIES } from "../../rules/failure.ts";
import { HandoffSchemaValidator } from "../../rules/schema.ts";
import {
  applyDerivedStatus,
  blockedCarrierFor,
  deriveReviewStatus,
  finalizeHandoff,
  rollupStatus,
  statusExitCode,
  taskBaseFromBrief,
} from "../handoff/finalize.ts";
import { writeOwnHandoff } from "../handoff/write.ts";
import { ReturnBlockParser } from "../return-block.ts";

const returnBlockParser = new ReturnBlockParser();

// ---- review 族：rollup 派生（applyDerivedStatus；SP-4 失败轮次豁免）----

it("finalizeHandoff review 族：agent 写 warn-only CHANGES_REQUESTED → 定稿 REVIEW_FIX（Task 8 收口态）", async () => {
  const agentHandoff = { status: "CHANGES_REQUESTED", findings: [{ severity: "warn" }] };
  const r = await finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff.status).toBe("REVIEW_FIX");
  expect(r.handoff.findings).toEqual([{ severity: "warn" }]);
  expect(r.handoff).not.toBe(agentHandoff); // 派生返回新对象（不原地修改 agent 内容）
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff review 族：无变化 → 返回原对象（不写盘；caller 以引用判定 skip）", async () => {
  const agentHandoff = { status: "APPROVED", findings: [] };
  const r = await finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff).toBe(agentHandoff);
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff review 族 SP-4 豁免：agent status BLOCKED + findings:[] → 保持 BLOCKED（失败轮次不覆写）", async () => {
  const agentHandoff = { status: "BLOCKED", findings: [], blocker: "boom" };
  const r = await finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff.status).toBe("BLOCKED");
});

// ---- C1 ①④ equivalence anchor: status ⟺ severity roll-up (rollupStatus/deriveReviewStatus single
// encoding — prevents bypass dilution) ----
// The status-routing criterion's machine equivalence: the review conclusion status is the severity
// roll-up's bijective image (≥1 blocker-severity finding ↔ CHANGES_REQUESTED — S1 fix then mandatory
// re-review; warn/nit-only ↔ REVIEW_FIX — S2 closure; zero findings ↔ APPROVED — S3 no fix dispatch).
// A bypass that dilutes a blocker finding into a lower status fails here.
describe("rollup 等价锚：status ⟺ severity 汇总（C1 ①④）", () => {
  const blockerFindings = [
    { severity: "blocker", summary: "blocking defect" },
    { severity: "warn", summary: "soft issue" },
  ];
  const warnNitFindings = [
    { severity: "warn", summary: "soft issue" },
    { severity: "nit", summary: "polish" },
  ];

  it("≥1 severity=blocker finding → CHANGES_REQUESTED（收敛语义 = fix 后必 re-review）", () => {
    expect(rollupStatus(blockerFindings)).toBe("CHANGES_REQUESTED");
    // SP-4 pass-through bypass face: status falsely declared APPROVED is not spared — the
    // derivation overwrites it to CHANGES_REQUESTED (SP-4 applies to BLOCKED/TIMEOUT rounds only).
    expect(deriveReviewStatus({ status: "APPROVED", findings: blockerFindings })).toBe(
      "CHANGES_REQUESTED",
    );
  });

  it("warn/nit-only findings → REVIEW_FIX（S2 收口 — 无 blocker 但有 findings）", () => {
    expect(rollupStatus(warnNitFindings)).toBe("REVIEW_FIX");
    expect(deriveReviewStatus({ status: "CHANGES_REQUESTED", findings: warnNitFindings })).toBe(
      "REVIEW_FIX",
    );
  });

  it("zero findings → APPROVED（S3 — 无 fix dispatch）", () => {
    expect(rollupStatus([])).toBe("APPROVED");
    expect(deriveReviewStatus({ status: "CHANGES_REQUESTED", findings: [] })).toBe("APPROVED");
  });

  it("防旁路稀释：blocker 任何形态都不会汇总到 CHANGES_REQUESTED 之下", () => {
    expect(rollupStatus([{ severity: "blocker" }])).not.toBe("REVIEW_FIX");
    expect(rollupStatus([{ severity: "blocker" }])).not.toBe("APPROVED");
    expect(rollupStatus([{ severity: "blocker" }, { severity: "nit" }])).toBe("CHANGES_REQUESTED");
  });
});

// ---- implement 族：实体化，输入无 agentHandoff 槽位 ----

it("finalizeHandoff implement 族：输入无 agentHandoff 槽位（通过类型避免残留路径）", async () => {
  // 从 return block + brief TASK_BASE + git HEAD 实体化（T6 逻辑迁入；commits 单一权威）。
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-repo-"));
  gitInit(repo);
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-ws-"));
  const taskBase = "9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63";
  const brief = path.join(ws, "tasks-1-brief.md");
  writeFileSync(brief, `# task 1\nTASK_BASE: ${taskBase}\n`);
  writeFileSync(path.join(ws, "tasks-1-test-evidence.json"), "{}"); // behavior_change !== true → soft empty
  const actualHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim();
  const r = await finalizeHandoff({
    mode: "implement",
    returnBlock: [
      "status: APPROVED",
      "commits: base=agent-wrong-base head=agent-wrong-head",
      "artifacts: report=r.md",
    ],
    brief,
    repoRoot: repo,
    workspace: Workspace.fromPath(ws),
    tasks: [1],
  });
  expect(r.handoff.phase).toBe("implement");
  expect(r.handoff.status).toBe("APPROVED");
  expect(r.handoff.commits.base).toBe(taskBase); // brief TASK_BASE is authoritative (the agent line is ignored)
  expect(r.handoff.commits.head).toBe(actualHead); // git HEAD is authoritative
  expect(r.handoff.findings).toEqual([]);
  expect(r.handoff.artifacts.report).toBe("r.md");
  expect(r.handoff.blocker).toBeUndefined(); // no blocker field lands on the materialized carrier (M3)
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff implement 族：brief 无 TASK_BASE → 降级 fail-open（不实体化，handoff:null + exit 0）", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-fail-"));
  const brief = path.join(ws, "tasks-1-brief.md");
  writeFileSync(brief, "# task 1\nno TASK_BASE here\n");
  const r = await finalizeHandoff({
    mode: "implement",
    returnBlock: ["status: APPROVED"],
    brief,
    workspace: Workspace.fromPath(ws),
    tasks: [1],
  });
  expect(r.handoff).toBeNull();
  expect(r.exitCode).toBe(0);
});

// ---- fix 族：work 型 — agent 声明保留，契约在 commit-contract 层否决 ----

it("finalizeHandoff fix 族：agent 声明保留（不派生覆写）", async () => {
  const agentHandoff = {
    status: "APPROVED",
    findings: [{ severity: "blocker" }],
    blocker: "uncommitted",
  };
  const r = await finalizeHandoff({ mode: "fix", agentHandoff });
  expect(r.handoff).toBe(agentHandoff);
  expect(r.exitCode).toBe(0);
});

// ---- C4-1 (T7): branch-fix closing handoff = engine fact reconstruction — commits (git facts
// base/head) + phase + status (commit-contract judgment) authoritative, the agent handoff is input
// only (findings/notes preserved, unknown keys and `$schema` stripped). opt-in via fixBase+repoRoot
// (the docs fix channel passes neither and keeps the work-type passthrough above). ----

describe("finalizeHandoff fix 族 C4-1：收据事实重造（spec C4）", () => {
  // two-commit repo: c0 (root) → c1 (HEAD). fixBase = c0 → a real fix-advance face.
  function fixFixture() {
    const repo = mkdtempSync(path.join(tmpdir(), "cdd-hf-c4-repo-"));
    gitInit(repo);
    const c0 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    writeFileSync(path.join(repo, "a.txt"), "a\n");
    gitCommit(repo, "second");
    const c1 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    expect(c0).not.toBe(c1);
    return { repo, c0, c1 };
  }

  it("修已 commit + agent handoff 带 $schema/坏 review_scope/坏 notes → 收据自愈 APPROVED（不 BLOCKED）", async () => {
    const { repo, c0, c1 } = fixFixture();
    // The agent (per the #307 receipt bug) mirrored the injected schema into its handoff: the
    // `$schema` meta key, a non-enum review_scope and a wrong-shape notes — shape junk that the
    // engine's reconstruction must strip, never verbatim-persist.
    const r = await finalizeHandoff({
      mode: "fix",
      agentHandoff: {
        tasks: [1],
        phase: "fix",
        status: "APPROVED",
        $schema: "http://json-schema.org/draft-07/schema#",
        review_scope: "bogus",
        notes: { oops: true },
        commits: { base: "agent-wrong-base", head: "agent-wrong-head" },
        findings: [{ severity: "warn" }],
        artifacts: { report: "r.md" },
      },
      fixBase: c0,
      repoRoot: repo,
    });
    expect(r.handoff.status).toBe("APPROVED"); // the fix committed → the receipt self-heals
    expect(r.handoff.phase).toBe("fix"); // engine-stamped
    expect(r.handoff.commits.base).toBe(c0); // git facts (FIX_BASE) authoritative
    expect(r.handoff.commits.head).toBe(c1); // git facts (HEAD) authoritative — the agent line is ignored
    expect(r.handoff).not.toHaveProperty("$schema"); // unknown key stripped
    expect(r.handoff).not.toHaveProperty("review_scope"); // dispatch-stamp field never authored
    expect(r.handoff).not.toHaveProperty("notes"); // malformed notes dropped (must stay schema-valid)
    expect(r.handoff.findings).toEqual([{ severity: "warn" }]); // valid content preserved
    expect(r.handoff.artifacts).toEqual({ report: "r.md" });
    expect(r.handoff.blocker).toBeUndefined();
    expect(r.exitCode).toBe(0);
  });

  it("无 commit（HEAD == FIX_BASE）→ BLOCKED + failure_category + exit 1（真败面仍 BLOCKED）", async () => {
    const { repo, c1 } = fixFixture();
    const r = await finalizeHandoff({
      mode: "fix",
      agentHandoff: { status: "APPROVED", findings: [], artifacts: {} },
      fixBase: c1, // == HEAD: the fix produced no commit
      repoRoot: repo,
    });
    expect(r.handoff.status).toBe("BLOCKED");
    expect(r.handoff.failure_category).toBe(FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id);
    expect(r.handoff.blocker).toMatch(/no commit|no fix commit/);
    expect(r.handoff.commits.base).toBe(c1);
    expect(r.handoff.commits.head).toBe(c1);
    expect(r.exitCode).toBe(1);
  });

  it("代码面错误：agent 声明 BLOCKED（即便 HEAD 已前移）→ 保持 BLOCKED + exit 1", async () => {
    const { repo, c0 } = fixFixture();
    const r = await finalizeHandoff({
      mode: "fix",
      agentHandoff: {
        status: "BLOCKED",
        failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
        blocker: "fix failed on the code face",
        findings: [],
        artifacts: {},
      },
      fixBase: c0,
      repoRoot: repo,
    });
    expect(r.handoff.status).toBe("BLOCKED");
    expect(r.handoff.failure_category).toBe(FAILURE_CATEGORIES.EXECUTION_FAILURE.id); // agent's real cause survives
    expect(r.handoff.blocker).toContain("code face");
    expect(r.exitCode).toBe(1);
  });

  it("代码面错误：unverifiable 车道 → BLOCKED + UNVERIFIABLE（内容级 BLOCK 通道不折叠）", async () => {
    const { repo, c0 } = fixFixture();
    const r = await finalizeHandoff({
      mode: "fix",
      agentHandoff: {
        status: "APPROVED",
        unverifiable: [{ claim: "复现场景", why: "环境缺失" }],
        findings: [],
        artifacts: {},
      },
      fixBase: c0,
      repoRoot: repo,
    });
    expect(r.handoff.status).toBe("BLOCKED");
    expect(r.handoff.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
    expect(r.handoff.blocker).toContain("复现场景");
    expect(r.handoff.unverifiable).toEqual([{ claim: "复现场景", why: "环境缺失" }]); // the structured lane rides the reconstructed carrier (C4-1)
    expect(r.exitCode).toBe(1);
  });

  it("代码面错误：plan_conflicts 车道 → BLOCKED + PLAN_CONFLICT（结构化车道在重造载体上保留）", async () => {
    const { repo, c0 } = fixFixture();
    const r = await finalizeHandoff({
      mode: "fix",
      agentHandoff: {
        status: "APPROVED",
        plan_conflicts: [{ summary: "验收判据 与 plan-constraints §口径 冲突" }],
        findings: [],
        artifacts: {},
      },
      fixBase: c0,
      repoRoot: repo,
    });
    expect(r.handoff.status).toBe("BLOCKED");
    expect(r.handoff.failure_category).toBe(FAILURE_CATEGORIES.PLAN_CONFLICT.id);
    expect(r.handoff.blocker).toContain("plan conflict");
    expect(r.handoff.plan_conflicts).toEqual([
      { summary: "验收判据 与 plan-constraints §口径 冲突" },
    ]);
    expect(r.exitCode).toBe(1);
  });

  it("修复后的载体恒过任务 schema 校验（engine 是收据唯一作者）", async () => {
    const { repo, c0 } = fixFixture();
    const schemaValidator = new HandoffSchemaValidator();
    for (const junk of [
      { tasks: ["x"] },
      { findings: "none" },
      { artifacts: [1, 2] },
      { blocker: null },
      { status: "BLOCKED", failure_category: "BOGUS" }, // non-canonical category → engine fallback
    ]) {
      const r = await finalizeHandoff({
        mode: "fix",
        agentHandoff: { status: "APPROVED", findings: [], artifacts: {}, ...junk },
        fixBase: c0,
        repoRoot: repo,
      });
      const h = r.handoff as Record<string, unknown>;
      // tasks never lands as a string array / findings stays an array / artifacts stays an object
      // (fallbacks keep the carrier valid) — assert valid via the schema validator.
      const ok = schemaValidator.validateHandoffSchema(h, "task");
      expect(ok.valid, `${JSON.stringify(junk)} → ${ok.reason}`).toBe(true);
    }
  });
});

it("finalizeHandoff 未知 mode → 抛错（定稿分派契约）", async () => {
  await expect(finalizeHandoff({ mode: "bogus", agentHandoff: {} })).rejects.toThrow(
    /unknown mode/,
  );
});

// ---- writeOwnHandoff：全量覆盖写盘（engine 载体唯一作者）----

it("writeOwnHandoff 全量覆盖：existing 含垃圾字段 → 新载体不含它", () => {
  const p = path.join(mkdtempSync(path.join(tmpdir(), "cdd-woh-")), "tasks-1-implement.json");
  writeOwnHandoff(p, { junk: true, task: 1 });
  writeOwnHandoff(p, {
    tasks: [1],
    phase: "implement",
    status: "APPROVED",
    findings: [],
    artifacts: {},
  });
  const h = JSON.parse(readFileSync(p, "utf8"));
  expect(h).not.toHaveProperty("junk");
  expect(h).toEqual({
    tasks: [1],
    phase: "implement",
    status: "APPROVED",
    findings: [],
    artifacts: {},
  });
});

// ---- The BLOCKED carrier: unverifiable / plan_conflicts must never fold to a bare
// BLOCKED; the derived round carries failure_category + a real blocker (real sources only). (Task 23 ①④) ----

it("statusExitCode ③: APPROVED / CHANGES_REQUESTED → 0；BLOCKED / TIMEOUT / absent → 1", () => {
  expect(statusExitCode("APPROVED")).toBe(0);
  expect(statusExitCode("CHANGES_REQUESTED")).toBe(0);
  expect(statusExitCode("BLOCKED")).toBe(1);
  expect(statusExitCode("TIMEOUT")).toBe(1);
  expect(statusExitCode(undefined)).toBe(1);
});

it("blockedCarrierFor: unverifiable 非空 → UNVERIFIABLE 通道 + 真实 blocker（entry 汇总，never 伪造）", () => {
  const c = blockedCarrierFor("BLOCKED", [{ claim: "git-status 无法复核", why: "dirty tree" }]);
  expect(c.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
  expect(c.blocker).toContain("git-status 无法复核");
  expect(c.blocker).toContain("dirty tree");
});

it("blockedCarrierFor: plan_conflicts 非空 → PLAN_CONFLICT 通道 + 真实 blocker", () => {
  const c = blockedCarrierFor("BLOCKED", [], [{ summary: "口径 与 overall v1.48 冲突" }]);
  expect(c.failure_category).toBe(FAILURE_CATEGORIES.PLAN_CONFLICT.id);
  expect(c.blocker).toContain("口径 与 overall v1.48 冲突");
});

it("blockedCarrierFor: real sources win — existing blocker / failure_category → 零伪造 carrier", () => {
  expect(blockedCarrierFor("BLOCKED", [{}], [], { blocker: "agent 声明的真实原因" })).toEqual({});
  expect(
    blockedCarrierFor("BLOCKED", [{}], [], { failure_category: FAILURE_CATEGORIES.TIMEOUT.id }),
  ).toEqual({});
});

it("blockedCarrierFor: 非 BLOCKED / 无车道 → {}（不发明散文）", () => {
  expect(blockedCarrierFor("APPROVED", [{}])).toEqual({});
  expect(blockedCarrierFor("BLOCKED")).toEqual({});
});

it("applyDerivedStatus: unverifiable 裸折消灭 — 派生 BLOCKED 必带 failure_category + blocker", () => {
  const d = applyDerivedStatus({
    findings: [],
    unverifiable: [{ claim: "复现场景", why: "环境缺失" }],
  });
  expect(d.status).toBe("BLOCKED");
  expect(d.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
  expect(d.blocker).toContain("复现场景");
  expect(d.blocker).toContain("环境缺失");
});

it("applyDerivedStatus: 无变化 → null（caller skip 写盘）；带 carrier 的 BLOCKED → 合并返回", () => {
  expect(applyDerivedStatus({ status: "APPROVED", findings: [] })).toBeNull();
  const d = applyDerivedStatus({ status: "BLOCKED", findings: [], unverifiable: [{}] });
  expect(d.status).toBe("BLOCKED");
  expect(d.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
});

it("finalizeHandoff review 族 T14 复现场景：unverifiable → BLOCKED + UNVERIFIABLE + 真实 blocker + exit 1（反转 exit 0）", async () => {
  const r = await finalizeHandoff({
    mode: "review",
    agentHandoff: {
      findings: [],
      unverifiable: [{ claim: "90min 无拖死实证", why: "现场已恢复" }],
    },
  });
  expect(r.handoff.status).toBe("BLOCKED");
  expect(r.handoff.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
  expect(r.handoff.blocker).toContain("90min 无拖死实证");
  expect(r.exitCode).toBe(1);
});

it("finalizeHandoff review 族：真 blocker 发现 → CHANGES_REQUESTED + exit 0（非 BLOCKED 通道）", async () => {
  const r = await finalizeHandoff({
    mode: "review",
    agentHandoff: { findings: [{ severity: "blocker" }] },
  });
  expect(r.handoff.status).toBe("CHANGES_REQUESTED");
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff review 族 dev-measured：notes 记录接受项 + warn-only → REVIEW_FIX，零 unverifiable 零 BLOCK", async () => {
  const r = await finalizeHandoff({
    mode: "review",
    agentHandoff: {
      findings: [{ severity: "warn" }],
      notes:
        "§口径 dev-measured 验收项已经 evidence-contract accepted-noted（notes 记录，不写 unverifiable 不 BLOCK）",
    },
  });
  expect(r.handoff.status).toBe("REVIEW_FIX");
  expect(r.handoff.unverifiable).toBeUndefined();
  expect(r.handoff.blocker).toBeUndefined();
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff fix 族：BLOCKED → exit 1（任何通道 BLOCKED → 1）", async () => {
  const r = await finalizeHandoff({
    mode: "fix",
    agentHandoff: { status: "BLOCKED", blocker: "真实原因" },
  });
  expect(r.handoff).toBeDefined();
  expect(r.exitCode).toBe(1);
});

it("finalizeHandoff implement 族：非 APPROVED 返回 → BLOCKED + failure_category + stderr CDD_BLOCKED 占位理由 + exit 1", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-blocked-"));
  const brief = path.join(ws, "tasks-1-brief.md");
  writeFileSync(brief, "# task 1\nTASK_BASE: 9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63\n");
  writeFileSync(path.join(ws, "tasks-1-test-evidence.json"), "{}");
  const cap = captureStderr();
  try {
    const r = await finalizeHandoff({
      mode: "implement",
      returnBlock: ["status: NEEDS_CONTEXT", "commits: base=x", "artifacts: "],
      brief,
      workspace: Workspace.fromPath(ws),
      tasks: [1],
    });
    expect(r.handoff.status).toBe("BLOCKED");
    // M3 carrier ruling: the reason rides failure_category + notes — the `blocker` field is vacant
    expect(r.handoff.failure_category).toBe(FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id);
    expect(r.handoff.notes).toContain('implement return status "NEEDS_CONTEXT" without blocker');
    expect(r.handoff.blocker).toBeUndefined();
    expect(r.exitCode).toBe(1);
  } finally {
    cap.restore();
  }
  // stderr CDD_BLOCKED carries the same placeholder reason — the clue is not silently lost
  expect(cap.text).toContain(
    'CDD_BLOCKED: implement return status "NEEDS_CONTEXT" without blocker',
  );
});

// ---- The commitsFromReturnLine parse atom — the input plane whose resume-declared base is adopted (T27, spec T7.6) ----

describe("return-block commitsFromReturnLine（T27 恢复轮声明 base 解析）", () => {
  it("标准 `commits: base=X head=Y` → { base, head }", () => {
    expect(
      returnBlockParser.commitsFromReturnLine(
        "commits: base=a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e head=0000000000000000000000000000000000000000",
      ),
    ).toEqual({
      base: "a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e",
      head: "0000000000000000000000000000000000000000",
    });
  });

  it("仅 base（head 缺省）→ { base }; 缺省线 / 空值 → {}", () => {
    expect(
      returnBlockParser.commitsFromReturnLine(
        "commits: base=9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63",
      ),
    ).toEqual({ base: "9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63" });
    expect(returnBlockParser.commitsFromReturnLine("commits: ")).toEqual({});
    expect(returnBlockParser.commitsFromReturnLine(undefined)).toEqual({});
  });

  it("只取 base/head 键；其他键忽略（artifacts 式 key=value 同构）", () => {
    expect(returnBlockParser.commitsFromReturnLine("commits: base=x junk=y head=z")).toEqual({
      base: "x",
      head: "z",
    });
    expect(returnBlockParser.commitsFromReturnLine("commits: junk=y")).toEqual({});
  });

  it("无前导 `commits:` 前缀的串 → {}（非本行安全）", () => {
    expect(returnBlockParser.commitsFromReturnLine("artifacts: brief=b.md")).toEqual({});
    expect(returnBlockParser.commitsFromReturnLine("phase: implement")).toEqual({});
  });
});

// ---- Resume-round declared-base adoption + scope-ledger seed/move (T27, spec T7.6) ----
// The resume signature = the materialized base==head (the re-dispatched brief's TASK_BASE is the
// dead round's head) → the declared base is validated and adopted as commits.base (the next
// review round's fixed point = declared..HEAD, non-empty). A fresh implement (base≠head) is
// never adopted.

describe("finalizeImplement T27 恢复轮声明采纳 + scope 账本（spec T7.6）", () => {
  // 两提交线性仓：c0(init) → c1(HEAD)。恢复轮 fixture：brief TASK_BASE = c1 == HEAD（恢复签名）。
  function resumeFixture() {
    const repo = mkdtempSync(path.join(tmpdir(), "cdd-hf-t27-repo-"));
    gitInit(repo);
    const c0 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    writeFileSync(path.join(repo, "a.txt"), "a\n");
    gitCommit(repo, "second");
    const c1 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(c0).not.toBe(c1);
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-t27-ws-"));
    const brief = path.join(ws, "tasks-27-brief.md");
    writeFileSync(brief, `# task 27\nTASK_BASE: ${c1}\n`);
    writeFileSync(path.join(ws, "tasks-27-test-evidence.json"), "{}");
    return { repo, c0, c1, ws, brief };
  }

  it("恢复签名（base==head）+ 合法声明（祖先、≠HEAD）→ 采纳声明为 commits.base + 账本移至声明", async () => {
    const { repo, c0, c1, ws, brief } = resumeFixture();
    const r = await finalizeHandoff({
      mode: "implement",
      returnBlock: ["status: APPROVED", `commits: base=${c0} head=${c1}`, "artifacts: report=r.md"],
      brief,
      repoRoot: repo,
      workspace: Workspace.fromPath(ws),
      tasks: [27],
    });
    expect(r.handoff.commits.base).toBe(c0); // 声明被采纳（非空 review 范围）
    expect(r.handoff.commits.head).toBe(c1);
    expect(r.exitCode).toBe(0);
    // 账本：seed base(=c1, 恢复轮快照) 后被声明(c0)严格前移
    const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress.tasks[0].scope_base).toBe(c0);
  });

  it("声明 ==HEAD → 拒（Reset 面）；声明非 40-hex → 拒（agent 伪造面）", async () => {
    const { repo, c1, ws, brief } = resumeFixture();
    const r1 = await finalizeHandoff({
      mode: "implement",
      returnBlock: ["status: APPROVED", `commits: base=${c1} head=${c1}`, "artifacts: "],
      brief,
      repoRoot: repo,
      workspace: Workspace.fromPath(ws),
      tasks: [27],
    });
    expect(r1.handoff.commits.base).toBe(c1); // 未采纳（==HEAD）→ 保持 brief TASK_BASE
    const r2 = await finalizeHandoff({
      mode: "implement",
      returnBlock: ["status: APPROVED", "commits: base=agent-wrong-base", "artifacts: "],
      brief,
      repoRoot: repo,
      workspace: Workspace.fromPath(ws),
      tasks: [27],
    });
    expect(r2.handoff.commits.base).toBe(c1); // 未采纳（非 40-hex）
    // 账本既有值不被 c1（==HEAD 的恢复轮快照）覆盖 — 首 seed 后 earliest-wins
    const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress.tasks[0].scope_base).toBe(c1); // r1 的 seed
  });

  it("声明非 HEAD 祖先（另一仓 commit，同 init 同形防变形写出文件）→ 拒——祖先校验拒伪造", async () => {
    const { repo, c1, ws, brief } = resumeFixture();
    const forge = mkdtempSync(path.join(tmpdir(), "cdd-hf-t27-forge-"));
    gitInit(forge);
    writeFileSync(path.join(forge, "forged.txt"), "forged\n");
    gitCommit(forge, "forged work");
    const forgeHead = execFileSync("git", ["-C", forge, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    expect(forgeHead).not.toBe(c1);
    const r = await finalizeHandoff({
      mode: "implement",
      returnBlock: ["status: APPROVED", `commits: base=${forgeHead} head=${c1}`, "artifacts: "],
      brief,
      repoRoot: repo,
      workspace: Workspace.fromPath(ws),
      tasks: [27],
    });
    expect(r.handoff.commits.base).toBe(c1); // 非祖先伪造被拒 → 保持 brief TASK_BASE
  });

  it("fresh implement（base≠head）→ 永不采纳（即便声明是合法祖先）", async () => {
    const { repo, c0, c1 } = resumeFixture();
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-t27-fresh-"));
    // fresh brief：TASK_BASE = c0（≠HEAD）
    const freshBrief = path.join(ws, "tasks-27-brief.md");
    writeFileSync(freshBrief, `# task 27\nTASK_BASE: ${c0}\n`);
    writeFileSync(path.join(ws, "tasks-27-test-evidence.json"), "{}");
    const r = await finalizeHandoff({
      mode: "implement",
      returnBlock: ["status: APPROVED", `commits: base=${c0} head=${c1}`, "artifacts: "],
      brief: freshBrief,
      repoRoot: repo,
      workspace: Workspace.fromPath(ws),
      tasks: [27],
    });
    expect(r.handoff.commits.base).toBe(c0); // fresh = brief TASK_BASE 权威（声明车道关闭）
  });

  it("resumeScopeBase 车道：carrier 恢复锚（recovery.scope_base）把账本严格前移（声明缺失时）", async () => {
    const { repo, c0, c1, ws, brief } = resumeFixture();
    const r = await finalizeHandoff({
      mode: "implement",
      returnBlock: ["status: APPROVED", `commits: head=${c1}`, "artifacts: "],
      brief,
      repoRoot: repo,
      workspace: Workspace.fromPath(ws),
      tasks: [27],
      resumeScopeBase: c0,
    });
    expect(r.handoff.commits.base).toBe(c1); // 无声明 → 不采纳，commits.base = brief TASK_BASE
    const progress = JSON.parse(readFileSync(path.join(ws, "progress.json"), "utf8"));
    expect(progress.tasks[0].scope_base).toBe(c0); // 账本被 resumeScopeBase 严格前移到 c0
  });

  it("taskBaseFromBrief：无 brief / 无 TASK_BASE 行 → null；有 → 40-hex 值", () => {
    expect(taskBaseFromBrief(undefined)).toBeNull();
    const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-t27-tbf-"));
    const noBase = path.join(ws, "no-base.md");
    writeFileSync(noBase, "# t\nno TASK_BASE\n");
    expect(taskBaseFromBrief(noBase)).toBeNull();
    const withBase = path.join(ws, "with-base.md");
    writeFileSync(withBase, `# t\nTASK_BASE: ${"a".repeat(40)}\n`);
    expect(taskBaseFromBrief(withBase)).toBe("a".repeat(40));
  });
});

// ---- 三消费方共享同一 finalizeHandoff（导入断言，非各自接线）----

it("branch/docs/runner 三消费方共享同一 finalizeHandoff（非各自接线）", async () => {
  // Import assertion: the single finalization implementation = src/artifacts/handoff/finalize.ts
  // (the one .ts canonical after Task 8's full TS migration; post-T24-A the branch surface lives in
  // dispatch/branch.ts#BranchLifecycle — no longer a cli shell). All three consumers import
  // finalizeHandoff from that canonical module and no longer hand-wire their own applyDerivedStatus
  // read-back (the single final-entry point = finalizeHandoff; applyDerivedStatus is consumed only
  // by artifact/handoff/finalize.ts itself).
  const dir = new URL("../../../", import.meta.url); // packages/cdd-engine/（P6 Task 3 迁就近：src/artifacts/__tests__ → 3-up）
  const src = (rel) => readFileSync(new URL(rel, dir), "utf8");
  for (const rel of ["src/dispatch/task.ts", "src/dispatch/docs.ts", "src/dispatch/branch.ts"]) {
    expect(src(rel)).toMatch(/handoff\/finalize\.ts/);
    // 不得再各自手写 applyDerivedStatus 调用接线（注释提及无害；唯一定稿入口 = finalizeHandoff）
    expect(src(rel)).not.toMatch(/applyDerivedStatus\s*\(/);
  }
});
