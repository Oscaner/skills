// packages/cdd-engine/tests/docs-runner.test.mjs — Vitest port of docs-runner tests.
// Covers: dry-run path + Bug L regression (subprocess cwd = gitToplevel not doc directory).
// All file-touching modules are mocked for isolation (no real CLI, no real schema files needed).
import { vi, it, expect, describe, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path, { join } from "node:path";
import { tmpdir } from "node:os";

// --- Module mocks (hoisted before imports) ---

vi.mock("execa", () => ({ execa: vi.fn() }));

vi.mock("../lib/contract/commit.mjs", async () => {
  // T5/T7: deriveReviewStatus/applyDerivedStatus 走真实实现（lib/handoff/finalize.mjs 不 mock），
  // mock 只替 gitToplevel（commit.mjs 侧），保证 docs-runner 读回定稿测试（finalizeHandoff →
  // rollup 派生）覆盖的是真实派生逻辑，而非 mock 出来的假 status。
  const actual = await vi.importActual("../lib/contract/commit.mjs");
  return {
    ...actual,
    gitToplevel: vi.fn(() => "/repo/root"),
  };
});

vi.mock("../lib/handoff/write.mjs", async () => {
  // write 三件（contract.mjs 符号拆分后独立文件）：writeHandoff/writeOwnHandoff mock（不落盘），
  // readJson 走真实实现（h1FromHandoff 等读回路径）。
  const actual = await vi.importActual("../lib/handoff/write.mjs");
  return {
    ...actual,
    writeHandoff: vi.fn(),
    writeOwnHandoff: vi.fn(),
  };
});

vi.mock("../lib/registry.mjs", async () => {
  // Task 5: cli-shared 从 registry 导入 resolveInjection —— mock 复用真实实现，
  // checkHarness 返回带完整 operation×type prefix 的条目（验证 docs-runner type 透传注入）。
  // REG_PATH：统一导出（spec §2.3）随 run-docs 消费方纳入 mock 面。
  const { resolveInjection, resolveSuffix, REG_PATH } = await vi.importActual("../lib/registry.mjs");
  return {
    loadRegistry: vi.fn(() => ({})),
    checkHarness: vi.fn(() => ({
      cli: "claude",
      invoke: "-p --output-format text --dangerously-skip-permissions",
      output: "text",
      prefix: {
        implement: "/mattpocock-skills:tdd",
        review: { task: "/mattpocock-skills:code-review", branch: "/mattpocock-skills:code-review", spec: "", plan: "" },
        fix: "/mattpocock-skills:tdd",
      },
      suffix: {},
    })),
    resolveInjection,
    resolveSuffix,
    REG_PATH,
  };
});

vi.mock("../lib/templates.mjs", () => ({
  PKG_ROOT: "/mock/pkg/root",
  renderHandoffStub: vi.fn(() => '{"phase":"review","status":"APPROVED","findings":[],"artifacts":{},"doc_path":""}'),
  renderTemplate: vi.fn(() => "mocked docs review prompt"),
}));

vi.mock("../lib/handoff/schema.mjs", () => ({
  loadHandoffSchema: () => ({ type: 'object', required: ['phase', 'status', 'findings', 'artifacts', 'doc_path'], properties: { phase: { type: 'string' }, status: { type: 'string' }, doc_path: { type: 'string' }, findings: { type: 'array' }, artifacts: { type: 'object' } } }),
  validateHandoffSchema: vi.fn(() => ({ valid: true })),
}));

// Selective node:fs mock: intercept schema + handoff reads; pass through everything else.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn((p) => {
      // Handoff file "exists" so we take the read-and-validate path (not writeHandoff BLOCKED path).
      // T3: 以 canonical fake ws 前缀判别（不再按 template 名含 "review"）—— spec-fix-1.json 等也视为存在。
      if (String(p).includes(".superpowers/cdd/foo/")) return true;
      return actual.existsSync(p);
    }),
    readFileSync: vi.fn((p, enc) => {
      if (String(p).includes("docs-handoff-schema")) {
        return JSON.stringify({
          required: ["phase", "status", "findings", "artifacts", "doc_path"],
          properties: {
            phase:     { enum: ["review", "fix"] },
            status:    { enum: ["APPROVED", "CHANGES_REQUESTED", "BLOCKED"] },
            findings:  {},
            artifacts: {},
            doc_path:  {},
          },
        });
      }
      if (String(p).includes(".superpowers/cdd/foo/")) {
        return JSON.stringify({
          phase: "review", status: "APPROVED",
          findings: [], artifacts: {}, doc_path: "/doc.md",
        });
      }
      return actual.readFileSync(p, enc);
    }),
  };
});

// --- Tests ---

describe("runDocsTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dry-run review → exitCode 0 + APPROVED handoff", async () => {
    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    const result = await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      doc: "/spec.md",
      dryRun: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.handoff.status).toBe("APPROVED");
    expect(result.handoff.phase).toBe("review");
    expect(result.handoff.doc_path).toBe("/spec.md");
  });

  it("subprocess cwd = gitToplevel(process.cwd()) not doc directory", async () => {
    // Bug L regression: cwd must be gitToplevel ('/repo/root'), never the doc path or workspace.
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    await runDocsTask({
      harness:   "claude",
      mode:      "review",
      template:  "review",
      doc:       "/repo/root/docs/superpowers/specs/my-spec.md",
      params:    { TYPE: "spec" },
      handoffPath: "/repo/root/.superpowers/cdd/foo/spec-review-1.json",
      repoRoot:  "/repo/root",  // accepted in opts but gitToplevel() is used (Bug L fix)
      dryRun:    false,
    });

    // execa called with cwd = '/repo/root' (gitToplevel mock value), NOT the doc directory.
    const callOpts = execa.mock.calls[0][2];
    expect(callOpts.cwd).toBe("/repo/root");
    expect(callOpts.cwd).not.toContain("docs/superpowers");
  });

  it("Task 5: type opt 透传 invokeCli (op, type) —— review×spec 无注入、fix×spec 得 tdd 首行", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    // review×spec → prefix.review.spec="" → 无注入，prompt 保持模板渲染结果（首行）
    await runDocsTask({
      harness: "claude", mode: "review", template: "review", type: "spec",
      doc: "/repo/root/docs/superpowers/specs/my-spec.md",
      params: { TYPE: "spec" },
      handoffPath: "/repo/root/.superpowers/cdd/foo/spec-review-1.json",
      dryRun: false,
    });
    let promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split("\n")[0]).toBe("mocked docs review prompt");

    // fix×spec → prefix.fix="/mattpocock-skills:tdd"（flat string）→ 注入首行
    execa.mockClear();
    await runDocsTask({
      harness: "claude", mode: "fix", template: "doc-fix", type: "spec",
      doc: "/repo/root/docs/superpowers/specs/my-spec.md",
      findingsPath: "/repo/root/docs/findings.md",
      handoffPath: "/repo/root/.superpowers/cdd/foo/spec-fix-1.json",
      dryRun: false,
    });
    promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split("\n")[0]).toBe("/mattpocock-skills:tdd");
    expect(promptArg.split("\n")[1]).toBe("mocked docs review prompt");
  });

  // ---- P6 T3：handoffPath 显式必传（no template fallback）+ 模板名直传（-review→-fix 派生已删） ----

  it("T3: 非 dry-run 缺 handoffPath → throw（canonical naming；无 template-round fallback）", async () => {
    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    await expect(runDocsTask({
      harness: "claude", mode: "review", template: "review",
      doc: "/repo/root/docs/superpowers/specs/my-spec.md",
      dryRun: false,
    })).rejects.toThrow(/handoffPath required/);
  });

  it("T3: fix 模板名直传 —— `-review`→`-fix` legacy 派生分支已删（renderTemplate 收 template 原值）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const { renderTemplate } = await import("../lib/templates.mjs");

    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    await runDocsTask({
      harness: "claude", mode: "fix", template: "critiques-review", type: "spec",
      doc: "/repo/root/docs/superpowers/specs/my-spec.md",
      // 含 "review" 段 → node:fs fixture 的 existsSync 视为存在 → 走 read-and-validate 路径。
      handoffPath: "/repo/root/.superpowers/cdd/foo/critiques-review-1.json",
      dryRun: false,
    });
    expect(renderTemplate.mock.calls.at(-1)?.[0]).toBe("critiques-review");
  });

  // ---- T5：status 单一权威 — review 型读回覆写（agent 写 warn-only CHANGES_REQUESTED → 覆写 APPROVED） ----

  it("docs-runner 读回定稿（T7 writeOwnHandoff）：agent 写 warn-only CHANGES_REQUESTED → 文件 status 覆写为 APPROVED", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
    const fs = await import("node:fs");
    const origRead = fs.readFileSync.getMockImplementation();
    // 覆写读回 fixture：同一 canonical ws 前缀下，agent 写 status:CHANGES_REQUESTED + warn/nit findings
    //（engine 应派生覆写为 APPROVED 并持久化；findings 原样保留）。
    fs.readFileSync.mockImplementation((p, enc) => {
      if (String(p).includes(".superpowers/cdd/foo/")) {
        return JSON.stringify({
          phase: "review", status: "CHANGES_REQUESTED",
          findings: [{ severity: "warn", summary: "w" }, { severity: "nit", summary: "n" }],
          artifacts: {}, doc_path: "/spec.md",
        });
      }
      return origRead(p, enc);
    });
    try {
      const result = await runDocsTask({
        harness: "claude", mode: "review", template: "review", type: "spec",
        doc: "/repo/root/docs/superpowers/specs/my-spec.md",
        handoffPath: "/repo/root/.superpowers/cdd/foo/spec-review-1.json",
        dryRun: false,
      });
      expect(result.exitCode).toBe(0);
      // 返回/读回后 status 已被派生覆写为 APPROVED（warn/nit = 0 blocker）
      expect(result.handoff.status).toBe("APPROVED");
      expect(result.handoff.findings).toHaveLength(2);
      // 覆写持久化：writeOwnHandoff 收到 status=APPROVED 的完整 handoff（全量覆盖，非浅合并）
      const writeCall = writeOwnHandoff.mock.calls.find(([p]) => String(p).endsWith("spec-review-1.json"));
      expect(writeCall).toBeDefined();
      expect(writeCall[1].status).toBe("APPROVED");
      expect(writeCall[1].findings).toEqual([
        { severity: "warn", summary: "w" }, { severity: "nit", summary: "n" },
      ]);
    } finally {
      fs.readFileSync.mockImplementation(origRead);
    }
  });

  // ---- P2 F5：review-mode doc_hash 定稿注入（载体唯一作者 T7）----

  it("review-mode 定稿注入 doc_hash：缺失 doc（mock 环境 ENOENT）→ 空串哨兵 + 内存返回值同步", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
    const result = await runDocsTask({
      harness: "claude", mode: "review", template: "review", type: "spec",
      doc: "/repo/root/docs/superpowers/specs/my-spec.md",   // 不存在 → hashFile "" 哨兵
      handoffPath: "/repo/root/.superpowers/cdd/foo/spec-review-1.json",
      dryRun: false,
    });
    expect(result.handoff.status).toBe("APPROVED");
    expect(result.handoff.doc_hash).toBe("");                // 内存返回值同步（§2.3.3）
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) => String(p).endsWith("spec-review-1.json"));
    expect(writeCall[1].doc_hash).toBe("");                  // 磁盘定稿含 doc_hash
    expect(writeCall[1].status).toBe("APPROVED");
  });

  it("review-mode doc_hash = 真实内容 sha256 hex（temp doc + 非 ws 前缀不被 mock 拦截）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p2hash-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "real content p2");
    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
    const result = await runDocsTask({
      harness: "claude", mode: "review", template: "review", type: "spec", doc,
      handoffPath: "/repo/root/.superpowers/cdd/foo/spec-review-1.json",
      dryRun: false,
    });
    expect(result.handoff.doc_hash).toBe(createHash("sha256").update("real content p2").digest("hex"));
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) => String(p).endsWith("spec-review-1.json"));
    expect(writeCall[1].doc_hash).toBe(result.handoff.doc_hash);
  });

  it("fix-mode 不注入 doc_hash（p persistFinalized 原样；负向对称防误扩展）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
    await runDocsTask({
      harness: "claude", mode: "fix", template: "doc-fix", type: "spec",
      doc: "/repo/root/docs/superpowers/specs/my-spec.md",
      findingsPath: "/repo/root/docs/findings.md",
      handoffPath: "/repo/root/.superpowers/cdd/foo/spec-fix-1.json",
      dryRun: false,
    });
    const fixCalls = writeOwnHandoff.mock.calls.filter(([p]) => String(p).includes("spec-fix-"));
    expect(fixCalls).toHaveLength(0);                       // fix-mode 无注入写
    expect(writeOwnHandoff).not.toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ doc_hash: expect.anything() }));
  });

  it("BLOCKED 失败写盘（handoff 未写）亦注入 doc_hash（uniform 载体）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "p2block-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "blocked content");
    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    const { writeHandoff } = await import("../lib/handoff/write.mjs");
    // 真实落盘 mock：模块级 vi.mock 把 writeHandoff 换成 vi.fn() 不落盘 → BLOCKED 分支写盘后
    // JSON.parse(readFileSync(handoffPath)) 读回必 ENOENT（orphan 路径 node:fs mock 透传真实 fs）。
    // 注入真实写盘实现让读回成功（run-docs.mjs BLOCKED 分支强耦合同步读回，不可 stub 掉）。
    writeHandoff.mockImplementation((p, data) => {
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
      return data;
    });
    const orphanPath = join(dir, "ws", "spec-review-1.json");  // 非 .superpowers/cdd/foo 前缀 → existsSync mock 走真实 → 文件不存在 → BLOCKED 写盘
    const result = await runDocsTask({
      harness: "claude", mode: "review", template: "review", type: "spec", doc,
      handoffPath: orphanPath,
      dryRun: false,
    });
    expect(result.exitCode).toBe(1);
    const writeCall = writeHandoff.mock.calls.find(([p]) => String(p).endsWith("spec-review-1.json"));
    expect(writeCall[1].status).toBe("BLOCKED");
    expect(writeCall[1].doc_hash).toBe(createHash("sha256").update("blocked content").digest("hex"));
  });

  it("plan 家族镜像：review-mode type:plan 定稿注入 doc_hash（真实双族 handoff 断言）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p2planh-"));
    const doc = join(dir, "plan.md");
    writeFileSync(doc, "plan content p2");
    vi.resetModules();
    const { runDocsTask } = await import("../lib/runner/run-docs.mjs");
    const { writeOwnHandoff } = await import("../lib/handoff/write.mjs");
    const result = await runDocsTask({
      harness: "claude", mode: "review", template: "review", type: "plan", doc,
      handoffPath: "/repo/root/.superpowers/cdd/foo/plan-review-1.json",
      dryRun: false,
    });
    expect(result.handoff.doc_hash).toBe(createHash("sha256").update("plan content p2").digest("hex"));
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) => String(p).endsWith("plan-review-1.json"));
    expect(writeCall[1].doc_hash).toBe(result.handoff.doc_hash);
  });
});
