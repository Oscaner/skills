// packages/cdd-engine/src/dispatch/__tests__/docs-runner.test.ts
// Covers: dry-run path + Bug L regression (subprocess cwd = gitToplevel not doc directory).
// All file-touching modules are mocked for isolation (no real CLI, no real schema files needed).

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Module mocks (hoisted before imports) ---

vi.mock("execa", () => ({ execa: vi.fn() }));

// rules/commit.mjs was deleted — its git now lives in infra/git.ts, consumed by finalize.mjs —
// so no commit-module mock is needed here; docs-runner injects repoRoot explicitly (Task 5)

vi.mock("../../artifacts/handoff/write.ts", async () => {
  // write 三件（contract.mjs 符号拆分后独立文件）：writeHandoff/writeOwnHandoff mock（不落盘），
  // readJson 走真实实现（returnFromHandoff 等读回路径）。
  const actual = await vi.importActual("../../artifacts/handoff/write.ts");
  return {
    ...actual,
    writeHandoff: vi.fn(),
    writeOwnHandoff: vi.fn(),
  };
});

vi.mock("../../infra/registry.ts", async () => {
  // cli-shared imports resolveInjection from the registry — the mock reuses the real
  // implementation; checkHarness returns entries with full operation×type prefixes (to verify
  // docs-runner's type pass-through injection). REG_PATH, the unified export (spec §2.3), joins
  // the mock surface for the run-docs consumer (Task 5).
  const { resolveInjection, resolveSuffix, REG_PATH } =
    await vi.importActual("../../infra/registry.ts");
  return {
    loadRegistry: vi.fn(() => ({})),
    checkHarness: vi.fn(() => ({
      cli: "claude",
      invoke: "-p --output-format text --dangerously-skip-permissions",
      output: "text",
      prefix: {
        implement: "/mattpocock-skills:tdd",
        review: {
          task: "/mattpocock-skills:code-review",
          branch: "/mattpocock-skills:code-review",
          spec: "",
          plan: "",
        },
        fix: "/mattpocock-skills:tdd",
      },
      suffix: {},
    })),
    resolveInjection,
    resolveSuffix,
    REG_PATH,
  };
});

vi.mock("../../render/templates.ts", () => ({
  PKG_ROOT: "/mock/pkg/root",
  renderTemplate: vi.fn(() => "mocked docs review prompt"),
  reviewHardGate: vi.fn(
    (_returnFormat, handoffPath) =>
      `> HARD GATE — Write \`${handoffPath}\` BEFORE outputting the JSON return.`,
  ),
  docsFixHardGate: vi.fn(
    (handoffPath) =>
      `> HARD GATE — Write \`${handoffPath}\` BEFORE exiting: the engine reads the file, not your stdout.`,
  ),
}));

vi.mock("../../rules/schema.ts", () => ({
  loadHandoffSchema: () => ({
    type: "object",
    required: ["phase", "status", "findings", "artifacts", "doc_path"],
    properties: {
      phase: { type: "string" },
      status: { type: "string" },
      doc_path: { type: "string" },
      findings: { type: "array" },
      artifacts: { type: "object" },
    },
  }),
  validateHandoffSchema: vi.fn(() => ({ valid: true })),
}));

// The CONTRACT_VIOLATION recovery unit moved with its applyDerivedStatus caller into
// artifacts/handoff/finalize.ts — the recovery mock now mirrors THAT module (partial spread keeps
// writeBlockedCarrier / finalizeHandoff / persistFinalized real for the run-docs paths that consume
// them), not the validator's schema.ts (P6 T24 B).
vi.mock("../../artifacts/handoff/finalize.ts", async () => {
  const actual = await vi.importActual("../../artifacts/handoff/finalize.ts");
  return {
    ...actual,
    // Mirror the real module's exports on the mock surface (T5): the run-docs schema-invalid
    // branch consumes recoverHandoff, and without this export the "normalize → re-validate"
    // single point is unreachable under mock. normalizeHandoff mirrors the defensive shape as
    // well: finalize.ts's implement materialization depends on it (the docs surface never touches it).
    recoverHandoff: vi.fn((o) => ({ handoff: o, valid: true })),
    normalizeHandoff: vi.fn((o) => o),
  };
});

// Selective node:fs mock: intercept schema + handoff reads; pass through everything else.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn((p) => {
      // Handoff file "exists" so we take the read-and-validate path (not writeHandoff BLOCKED path).
      // T3: 以 canonical fake ws 前缀判别（不再按 template 名含 "review"）—— spec-fix-1.json 等也视为存在。
      if (String(p).includes(".osuperpowers/cdd/foo/")) return true;
      return actual.existsSync(p);
    }),
    readFileSync: vi.fn((p, enc) => {
      if (String(p).includes("docs-handoff-schema")) {
        return JSON.stringify({
          required: ["phase", "status", "findings", "artifacts", "doc_path"],
          properties: {
            phase: { enum: ["review", "fix"] },
            status: { enum: ["APPROVED", "CHANGES_REQUESTED", "BLOCKED"] },
            findings: {},
            artifacts: {},
            doc_path: {},
          },
        });
      }
      if (String(p).includes(".osuperpowers/cdd/foo/")) {
        return JSON.stringify({
          phase: "review",
          status: "APPROVED",
          findings: [],
          artifacts: {},
          doc_path: "/doc.md",
        });
      }
      return actual.readFileSync(p, enc);
    }),
  };
});

// --- Tests ---

// 真实落盘 mock helper（P4 nit fix 4 DRY）：模块级 vi.mock 把 writeHandoff 换成 vi.fn() 不落盘
// → BLOCKED 分支写盘后 JSON.parse(readFileSync(handoffPath)) 读回必 ENOENT。注入真实写盘实现
// 让读回成功（run-docs.mjs BLOCKED 分支强耦合同步读回，不可 stub 掉）。
function mockRealWriteBack(writeHandoff) {
  writeHandoff.mockImplementation((p, data) => {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
    return data;
  });
}

// 夹具常量：单一来源（根迁移一行改动，免 9 处机械编辑）
const SPEC_DOC = "/repo/root/docs/osuperpowers/specs/my-spec.md";

describe("runDocsTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dry-run review → exitCode 0 + APPROVED handoff", async () => {
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
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

  it("subprocess cwd = 注入的 repoRoot not doc directory", async () => {
    // Bug L regression: cwd must be the repo root ('/repo/root'), never the doc path or workspace.
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      doc: SPEC_DOC,
      params: { REVIEW_TYPE: "spec" },
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/spec-review-1.json",
      repoRoot: "/repo/root", // 注入缝：run-docs 真用该值（P4 §2.4.1 单根权威）
      dryRun: false,
    });

    // execa called with cwd = '/repo/root' (注入的 repoRoot), NOT the doc directory.
    // （原另有一条 `not.toContain("/docs/osuperpowers/specs")` 反向断言，经 branch-review 判定为
    //  **不可失败**——上行已 pin cwd === "/repo/root"；已删，见 P2 plan T3 follow-up。）
    const callOpts = execa.mock.calls[0][2];
    expect(callOpts.cwd).toBe("/repo/root");
  });

  it("Task 5: type opt 透传 invokeCli (op, type) —— review×spec 无注入、fix×spec 得 tdd 首行", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    // review×spec → prefix.review.spec="" → 无注入，prompt 保持模板渲染结果（首行）
    await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc: SPEC_DOC,
      params: { REVIEW_TYPE: "spec" },
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/spec-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    let promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split("\n")[0]).toBe("mocked docs review prompt");

    // fix×spec → prefix.fix="/mattpocock-skills:tdd"（flat string）→ 注入首行
    execa.mockClear();
    await runDocsTask({
      harness: "claude",
      mode: "fix",
      template: "docs",
      type: "spec",
      doc: SPEC_DOC,
      findingsPath: "/repo/root/docs/findings.md",
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/spec-fix-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split("\n")[0]).toBe("/mattpocock-skills:tdd");
    expect(promptArg.split("\n")[1]).toBe("mocked docs review prompt");
  });

  it("Task 18 review-1 finding 2: fix 族 HARD_GATE = docsFixHardGate 写盘门（review 的 json-return 门不被挪用）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const { docsFixHardGate, reviewHardGate } = await import("../../render/templates.ts");

    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    await runDocsTask({
      harness: "claude",
      mode: "fix",
      template: "docs",
      type: "spec",
      doc: SPEC_DOC,
      findingsPath: "/repo/root/docs/findings.md",
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/spec-fix-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    // fix 的 return = 文件本体（stdout 无 JSON return）：门 = docsFixHardGate(handoffPath)
    expect(docsFixHardGate).toHaveBeenCalledWith(
      "/repo/root/.osuperpowers/cdd/foo/spec-fix-1.json",
    );
    expect(reviewHardGate).not.toHaveBeenCalled();
  });

  // ---- handoffPath must be passed explicitly (no template fallback) + template name passed straight through (the -review→-fix derivation was deleted) (P6 T3) ----

  it("T3: 非 dry-run 缺 handoffPath → throw（canonical naming；无 template-round fallback）", async () => {
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    await expect(
      runDocsTask({
        harness: "claude",
        mode: "review",
        template: "review",
        doc: SPEC_DOC,
        repoRoot: "/repo/root",
        dryRun: false,
      }),
    ).rejects.toThrow(/handoffPath required/);
  });

  it("T3: fix 模板名直传 —— `-review`→`-fix` legacy 派生分支已删（renderTemplate 收 template 原值）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const { renderTemplate } = await import("../../render/templates.ts");

    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    await runDocsTask({
      harness: "claude",
      mode: "fix",
      template: "critiques-review",
      type: "spec",
      doc: SPEC_DOC,
      // 含 "review" 段 → node:fs fixture 的 existsSync 视为存在 → 走 read-and-validate 路径。
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/critiques-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    expect(renderTemplate.mock.calls.at(-1)?.[0]).toBe("critiques-review");
  });

  // ---- Status single-authority: review-type read-back overwrites (agent wrote a warn-only CHANGES_REQUESTED → overwritten to APPROVED) (T5) ----

  it("docs-runner 读回定稿（T7 writeOwnHandoff）：agent 写 warn-only CHANGES_REQUESTED → 文件 status 覆写为 APPROVED", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const { writeOwnHandoff } = await import("../../artifacts/handoff/write.ts");
    const fs = await import("node:fs");
    const origRead = fs.readFileSync.getMockImplementation();
    // 覆写读回 fixture：同一 canonical ws 前缀下，agent 写 status:CHANGES_REQUESTED + warn/nit findings
    //（engine 应派生覆写为 APPROVED 并持久化；findings 原样保留）。
    fs.readFileSync.mockImplementation((p, enc) => {
      if (String(p).includes(".osuperpowers/cdd/foo/")) {
        return JSON.stringify({
          phase: "review",
          status: "CHANGES_REQUESTED",
          findings: [
            { severity: "warn", summary: "w" },
            { severity: "nit", summary: "n" },
          ],
          artifacts: {},
          doc_path: "/spec.md",
        });
      }
      return origRead(p, enc);
    });
    try {
      const result = await runDocsTask({
        harness: "claude",
        mode: "review",
        template: "review",
        type: "spec",
        doc: SPEC_DOC,
        handoffPath: "/repo/root/.osuperpowers/cdd/foo/spec-review-1.json",
        repoRoot: "/repo/root",
        dryRun: false,
      });
      expect(result.exitCode).toBe(0);
      // 返回/读回后 status 已被派生覆写为 APPROVED（warn/nit = 0 blocker）
      expect(result.handoff.status).toBe("APPROVED");
      expect(result.handoff.findings).toHaveLength(2);
      // 覆写持久化：writeOwnHandoff 收到 status=APPROVED 的完整 handoff（全量覆盖，非浅合并）
      const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
        String(p).endsWith("spec-review-1.json"),
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[1].status).toBe("APPROVED");
      expect(writeCall[1].findings).toEqual([
        { severity: "warn", summary: "w" },
        { severity: "nit", summary: "n" },
      ]);
    } finally {
      fs.readFileSync.mockImplementation(origRead);
    }
  });

  // ---- Review-mode doc_hash finalization injection — the engine is the carrier's sole author (T7) (P2 F5) ----

  it("review-mode 定稿注入 doc_hash：缺失 doc（mock 环境 ENOENT）→ 空串哨兵 + 内存返回值同步", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const { writeOwnHandoff } = await import("../../artifacts/handoff/write.ts");
    const result = await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc: SPEC_DOC, // 不存在 → hashFile "" 哨兵
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/spec-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    expect(result.handoff.status).toBe("APPROVED");
    expect(result.handoff.doc_hash).toBe(""); // 内存返回值同步（§2.3.3）
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("spec-review-1.json"),
    );
    expect(writeCall[1].doc_hash).toBe(""); // 磁盘定稿含 doc_hash
    expect(writeCall[1].status).toBe("APPROVED");
  });

  it("review-mode doc_hash = 真实内容 sha256 hex（temp doc + 非 ws 前缀不被 mock 拦截）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p2hash-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const { writeOwnHandoff } = await import("../../artifacts/handoff/write.ts");
    const result = await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/spec-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    expect(result.handoff.doc_hash).toBe(
      createHash("sha256").update("- **Version**: v1.0 · 2026-09-21\n").digest("hex"),
    );
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("spec-review-1.json"),
    );
    expect(writeCall[1].doc_hash).toBe(result.handoff.doc_hash);
  });

  it("fix-mode 不注入 doc_hash（p persistFinalized 原样；负向对称防误扩展）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const { writeOwnHandoff } = await import("../../artifacts/handoff/write.ts");
    await runDocsTask({
      harness: "claude",
      mode: "fix",
      template: "docs",
      type: "spec",
      doc: SPEC_DOC,
      findingsPath: "/repo/root/docs/findings.md",
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/spec-fix-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    const fixCalls = writeOwnHandoff.mock.calls.filter(([p]) => String(p).includes("spec-fix-"));
    expect(fixCalls).toHaveLength(0); // fix-mode 无注入写
    expect(writeOwnHandoff).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ doc_hash: expect.anything() }),
    );
  });

  it("BLOCKED 失败写盘（handoff 未写）亦注入 doc_hash（uniform 载体）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "p2block-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const { writeHandoff } = await import("../../artifacts/handoff/write.ts");
    // 真实落盘 mock：模块级 vi.mock 把 writeHandoff 换成 vi.fn() 不落盘 → BLOCKED 分支写盘后
    // JSON.parse(readFileSync(handoffPath)) 读回必 ENOENT（orphan 路径 node:fs mock 透传真实 fs）。
    // 注入真实写盘实现让读回成功（run-docs.mjs BLOCKED 分支强耦合同步读回，不可 stub 掉）。
    mockRealWriteBack(writeHandoff);
    const orphanPath = join(dir, "ws", "spec-review-1.json"); // 非 .osuperpowers/cdd/foo 前缀 → existsSync mock 走真实 → 文件不存在 → BLOCKED 写盘
    const result = await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath: orphanPath,
      repoRoot: "/repo/root",
      dryRun: false,
    });
    expect(result.exitCode).toBe(1);
    const writeCall = writeHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("spec-review-1.json"),
    );
    expect(writeCall[1].status).toBe("BLOCKED");
    expect(writeCall[1].doc_hash).toBe(
      createHash("sha256").update("- **Version**: v1.0 · 2026-09-21\n").digest("hex"),
    );
  });

  it("exit-0-no-handoff boundary → recovery carries the cause only (exit_code stays a strict-death code)", async () => {
    const { execa } = await import("execa");
    const dir = mkdtempSync(join(tmpdir(), "p2death-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const { writeHandoff } = await import("../../artifacts/handoff/write.ts");
    mockRealWriteBack(writeHandoff);
    // Three faces of the same「no handoff after exit」boundary: exit 0 (contract break, NOT a death),
    // 143 (SIGTERM), 1 (run failure). Each dispatch gets a fresh orphan dir (an existing written
    // handoff would reroute the run to the read-and-validate path, leaving the boundary).
    const faces = [
      { rc: 0, recovery: { cause: "EXECUTION_FAILURE" } }, // cause ONLY — a 0 never rides as a diagnosed death
      { rc: 143, recovery: { cause: "EXECUTION_FAILURE", exit_code: 143 } },
      { rc: 1, recovery: { cause: "EXECUTION_FAILURE", exit_code: 1 } },
    ];
    for (const [i, face] of faces.entries()) {
      execa.mockResolvedValue({ exitCode: face.rc, stdout: "", stderr: "", timedOut: false });
      const result = await runDocsTask({
        harness: "claude",
        mode: "review",
        template: "review",
        type: "spec",
        doc,
        handoffPath: join(dir, `ws${i}`, "spec-review-1.json"),
        repoRoot: "/repo/root",
        dryRun: false,
      });
      expect(result.exitCode).toBe(1);
      const writeCall = writeHandoff.mock.calls.at(-1); // exactly one carrier write per dispatch
      expect(String(writeCall[0])).toContain(`ws${i}`);
      expect(writeCall[1].recovery).toEqual(face.recovery);
    }
  });

  it("plan 家族镜像：review-mode type:plan 定稿注入 doc_hash（真实双族 handoff 断言）", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p2planh-"));
    const doc = join(dir, "plan.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const { writeOwnHandoff } = await import("../../artifacts/handoff/write.ts");
    const result = await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "plan",
      doc,
      handoffPath: "/repo/root/.osuperpowers/cdd/foo/plan-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    expect(result.handoff.doc_hash).toBe(
      createHash("sha256").update("- **Version**: v1.0 · 2026-09-21\n").digest("hex"),
    );
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("plan-review-1.json"),
    );
    expect(writeCall[1].doc_hash).toBe(result.handoff.doc_hash);
  });

  // ---- Hardening: agent-write bad JSON (unescaped \d) → BLOCKED handoff, not throw (T8) ----

  it("T8-hardening: agent 手写坏 JSON（未转义 \\d）→ BLOCKED handoff 非 throw", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p8bad-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    // agent 手写坏 JSON 到 canonical handoff 路径：`"#\d+ 未转义"` —— \d 非合法 JSON escape →
    // JSON.parse 必 throw（P4 dogfood 实证：agent 手写 handoff 含未转义 regex 记号）。
    const handoffPath = join(dir, "ws", "spec-review-1.json");
    mkdirSync(path.dirname(handoffPath), { recursive: true });
    writeFileSync(
      handoffPath,
      '{"phase":"review","status":"APPROVED","findings":[{"summary":"#\\d+ 未转义"}],"artifacts":{},"doc_path":"/spec.md"}',
    );
    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const { writeHandoff } = await import("../../artifacts/handoff/write.ts");
    // 真实落盘 mock：BLOCKED 分支写盘后 JSON.parse(readFileSync(handoffPath)) 同步读回必须成功。
    mockRealWriteBack(writeHandoff);
    const result = await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath,
      repoRoot: "/repo/root",
      dryRun: false,
    });
    // 非 throw —— BLOCKED handoff（doc_hash 载体 uniform），而非 exit 2 / 无 handoff 静默丢失。
    expect(result.exitCode).toBe(1);
    expect(result.handoff.status).toBe("BLOCKED");
    expect(result.handoff.blocker).toContain("JSON unparseable");
    expect(result.handoff.doc_hash).toBe(
      createHash("sha256").update("- **Version**: v1.0 · 2026-09-21\n").digest("hex"),
    );
  });

  // ---- review-3 finding 4（standards nit）+ finding 1（warn）：schema 无效分支的端到端守卫 ----
  // 此前该分支被 `validateHandoffSchema: vi.fn(() => ({ valid: true }))` mock 成恒 valid → writeBlocked 的
  // baseHandoff→writeOwnHandoff 全量覆盖写盘在测试环境不可达，spec/plan 路的「违规键剥除 + findings 保留 +
  // 全量覆盖」从未实测。此处仿 runner.test.mjs 的 8.8 归一化不可救用例补一条：agent 写 `findings: "none"`
  // + 已声明键类型违规（`notes: 5`）→ 恢复面判不可救 → BLOCKED 载体**键集干净**（engine 自写字面量，
  // 不 spread 归一化结果——review-3 finding 1 的失败分支载荷规则）、findings 守卫成 []、blocker 含违规键名。
  it("schema-invalid handoff（findings 非数组 + notes:5）→ BLOCKED 载体键集干净 / findings [] / blocker 含违规键名", async () => {
    const { execa } = await import("execa");
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p5cv-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    const handoffPath = join(dir, "ws", "spec-review-1.json"); // 非 `.osuperpowers/cdd/foo/` 前缀 → 真实 fs
    mkdirSync(path.dirname(handoffPath), { recursive: true });
    // agent 手写违规 handoff：findings 非数组 + `notes: 5`（已声明键类型违规，normalize 无权修改其值）
    writeFileSync(
      handoffPath,
      JSON.stringify({
        phase: "review",
        status: "APPROVED",
        findings: "none",
        notes: 5,
        artifacts: {},
        doc_path: "/spec.md",
      }),
    );
    const { validateHandoffSchema } = await import("../../rules/schema.ts");
    const { recoverHandoff } = await import("../../artifacts/handoff/finalize.ts");
    validateHandoffSchema.mockImplementationOnce(() => ({
      valid: false,
      reason: "/findings must be array; /notes must be string",
    }));
    // 沿真实 recoverHandoff 语义：归一化结果**保留已声明键原值**（notes: 5 仍在内——正是旧载荷的泄漏源），
    // 重校验仍失败 → 调用方走 BLOCKED；findings 非数组 → preservedFindings 守卫成 []。
    recoverHandoff.mockImplementationOnce(() => ({
      handoff: {
        phase: "review",
        status: "APPROVED",
        findings: [],
        notes: 5,
        artifacts: {},
        doc_path: "/spec.md",
      },
      valid: false,
      reason: ": /findings must be array; /notes must be string",
      preservedFindings: [],
    }));
    const { writeOwnHandoff } = await import("../../artifacts/handoff/write.ts");
    mockRealWriteBack(writeOwnHandoff); // 恢复面不可救 → writeBlocked 带 baseHandoff → 全量覆盖写盘

    vi.resetModules();
    const { runDocsTask } = await import("../docs.ts");
    const result = await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath,
      repoRoot: "/repo/root",
      dryRun: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.handoff.status).toBe("BLOCKED");
    // 键集干净：engine 字面量 + doc_path/doc_hash + findings（agent 的 notes 不得进载体）
    expect(Object.keys(result.handoff).sort()).toEqual([
      "artifacts",
      "blocker",
      "doc_hash",
      "doc_path",
      "findings",
      "phase",
      "status",
    ]);
    expect(result.handoff.findings).toEqual([]); // 非数组 findings → 数组守卫成 []
    expect(result.handoff).not.toHaveProperty("notes");
    expect(result.handoff.blocker).toMatch(/notes/); // 违规键名在 blocker 文案
    // 写盘全量覆盖（writeOwnHandoff），磁盘上不再有 agent 的违规键
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("spec-review-1.json"),
    );
    expect(writeCall).toBeDefined();
    expect(writeCall[1]).not.toHaveProperty("notes");
  });
});
