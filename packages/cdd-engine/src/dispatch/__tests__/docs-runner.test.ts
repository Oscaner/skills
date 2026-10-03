// packages/cdd-engine/src/dispatch/__tests__/docs-runner.test.ts
// Covers: dry-run path + Bug L regression (subprocess cwd = gitToplevel not doc directory).
// All file-touching modules are mocked for isolation (no real CLI, no real schema files needed).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockExeca } from "../../infra/__tests__/helpers.ts";

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
  const actual =
    await vi.importActual<typeof import("../../infra/registry.ts")>("../../infra/registry.ts");
  class MockRegistry extends actual.Registry {
    load = vi.fn(() => ({}));
    checkHarness = vi.fn(() => ({
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
    }));
  }
  return {
    Registry: MockRegistry,
    REG_PATH: actual.REG_PATH,
  };
});

const { docsRenderSpy, docsReviewGateSpy, docsFixGateSpy } = vi.hoisted(() => ({
  docsRenderSpy: vi.fn((_template: string, _params?: unknown) => "mocked docs review prompt"),
  docsReviewGateSpy: vi.fn(
    (_returnFormat: string, handoffPath?: unknown) =>
      `> HARD GATE — Write \`${handoffPath}\` BEFORE outputting the JSON return.`,
  ),
  docsFixGateSpy: vi.fn(
    (handoffPath?: unknown) =>
      `> HARD GATE — Write \`${handoffPath}\` BEFORE exiting: the engine reads the file, not your stdout.`,
  ),
}));
vi.mock("../../render/templates.ts", () => ({
  PKG_ROOT: "/mock/pkg/root",
  TemplateLoader: class {
    renderTemplate = docsRenderSpy;
    reviewHardGate = docsReviewGateSpy;
    docsFixHardGate = docsFixGateSpy;
  },
  renderTemplate: docsRenderSpy,
}));

const { schemaValidateSpy } = vi.hoisted(() => ({
  schemaValidateSpy: vi.fn(() => ({ valid: true })),
}));
vi.mock("../../rules/schema.ts", () => ({
  HandoffSchemaValidator: class {
    loadHandoffSchema = () => ({
      type: "object",
      required: ["phase", "status", "findings", "artifacts", "doc_path"],
      properties: {
        phase: { type: "string" },
        status: { type: "string" },
        doc_path: { type: "string" },
        findings: { type: "array" },
        artifacts: { type: "object" },
      },
    });
    validateHandoffSchema = schemaValidateSpy;
  },
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
  // Factory boundary cast: importOriginal is statically unknown — the real module types the
  // pass-through reads (fixture seam).
  const actual = (await importOriginal()) as typeof import("node:fs");
  return {
    ...actual,
    existsSync: vi.fn((p: Parameters<typeof actual.existsSync>[0]) => {
      // Handoff file "exists" so we take the read-and-validate path (not writeHandoff BLOCKED path).
      // T3: 以 canonical fake ws 前缀判别（不再按 template 名含 "review"）—— spec-fix-1.json 等也视为存在。
      if (String(p).includes(".kairos/cdd/foo/")) return true;
      return actual.existsSync(p);
    }),
    readFileSync: vi.fn(
      (
        p: Parameters<typeof actual.readFileSync>[0],
        enc: Parameters<typeof actual.readFileSync>[1],
      ) => {
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
        if (String(p).includes(".kairos/cdd/foo/")) {
          return JSON.stringify({
            phase: "review",
            status: "APPROVED",
            findings: [],
            artifacts: {},
            doc_path: "/doc.md",
          });
        }
        return actual.readFileSync(p, enc);
      },
    ),
  };
});

// --- Tests ---

// 真实落盘 mock helper（P4 nit fix 4 DRY）：模块级 vi.mock 把 writeHandoff 换成 vi.fn() 不落盘
// → BLOCKED 分支写盘后 JSON.parse(readFileSync(handoffPath)) 读回必 ENOENT。注入真实写盘实现
// 让读回成功（run-docs.mjs BLOCKED 分支强耦合同步读回，不可 stub 掉）。
function mockRealWriteBack(writeHandoff: {
  mockImplementation(
    fn: (p: string, data: Record<string, unknown>) => Record<string, unknown>,
  ): void;
}) {
  writeHandoff.mockImplementation((p, data) => {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
    return data;
  });
}

// 夹具常量：单一来源（根迁移一行改动，免 9 处机械编辑）
const SPEC_DOC = "/repo/root/docs/kairos/specs/my-spec.md";

/** docs-run finalize fixture seam (T2 mechanical surface): these cases construct a non-null
 * handoff by fixture design (asserted below each call) — narrows DocsResult's nullable
 * `unknown`-shaped handoff once at the assignment seam; no per-property casts in the
 * expectations. */
type DocsRunFixture = {
  exitCode: number;
  handoff: {
    status?: string;
    phase?: string;
    doc_path?: string;
    doc_hash?: string;
    failure_category?: string;
    blocker?: unknown;
    findings?: unknown;
    [k: string]: unknown;
  };
};

describe("runDocsTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dry-run review → exitCode 0 + APPROVED handoff", async () => {
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const result = (await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      doc: "/spec.md",
      dryRun: true,
    })) as DocsRunFixture;
    expect(result.exitCode).toBe(0);
    expect(result.handoff.status).toBe("APPROVED");
    expect(result.handoff.phase).toBe("review");
    expect(result.handoff.doc_path).toBe("/spec.md");
  });

  it("subprocess cwd = 注入的 repoRoot not doc directory", async () => {
    // Bug L regression: cwd must be the repo root ('/repo/root'), never the doc path or workspace.
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      doc: SPEC_DOC,
      params: { REVIEW_TYPE: "spec" },
      handoffPath: "/repo/root/.kairos/cdd/foo/spec-review-1.json",
      repoRoot: "/repo/root", // injection seam: run-docs really uses this value (P4 §2.4.1 single-root authority)
      dryRun: false,
    });

    // execa called with cwd = '/repo/root' (the injected repoRoot), NOT the doc directory.
    // (A previous `not.toContain("/docs/kairos/specs")` reverse assertion was judged by
    //  branch-review as un-failable — the line above already pins cwd === "/repo/root"; it was
    //  deleted, see the P2 plan T3 follow-up.)
    const callOpts = execa.mock.calls[0][2];
    expect(callOpts.cwd).toBe("/repo/root");
  });

  it("Task 5: type opt 透传 invokeCli (op, type) —— review×spec 无注入、fix×spec 得 tdd 首行", async () => {
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    // review×spec → prefix.review.spec="" → 无注入，prompt 保持模板渲染结果（首行）
    await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc: SPEC_DOC,
      params: { REVIEW_TYPE: "spec" },
      handoffPath: "/repo/root/.kairos/cdd/foo/spec-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    let promptArg = execa.mock.calls[0][1].at(-1) ?? "";
    expect(promptArg.split("\n")[0]).toBe("mocked docs review prompt");

    // fix×spec → prefix.fix="/mattpocock-skills:tdd"（flat string）→ 注入首行
    execa.mockClear();
    await DocsLifecycle.run({
      harness: "claude",
      mode: "fix",
      template: "docs",
      type: "spec",
      doc: SPEC_DOC,
      findingsPath: "/repo/root/docs/findings.md",
      handoffPath: "/repo/root/.kairos/cdd/foo/spec-fix-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    promptArg = execa.mock.calls[0][1].at(-1) ?? "";
    expect(promptArg.split("\n")[0]).toBe("/mattpocock-skills:tdd");
    expect(promptArg.split("\n")[1]).toBe("mocked docs review prompt");
  });

  it("Task 18 review-1 finding 2: fix 族 HARD_GATE = docsFixHardGate 写盘门（review 的 json-return 门不被挪用）", async () => {
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    // The gate atoms are TemplateLoader instance methods (Task 7 ①); the docs.ts module-scope
    // instance's methods ARE the hoisted spies, so the fix/review gates asserts on the spies
    // directly (a bare-function import is the pre-classification shape).
    const { TemplateLoader } = await import("../../render/templates.ts");

    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    await DocsLifecycle.run({
      harness: "claude",
      mode: "fix",
      template: "docs",
      type: "spec",
      doc: SPEC_DOC,
      findingsPath: "/repo/root/docs/findings.md",
      handoffPath: "/repo/root/.kairos/cdd/foo/spec-fix-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    // fix 的 return = 文件本体（stdout 无 JSON return）：门 = docsFixHardGate(handoffPath)
    expect(typeof new TemplateLoader().docsFixHardGate).toBe("function"); // class surface, not a bare export
    expect(docsFixGateSpy).toHaveBeenCalledWith("/repo/root/.kairos/cdd/foo/spec-fix-1.json");
    expect(docsReviewGateSpy).not.toHaveBeenCalled();
  });

  // ---- handoffPath must be passed explicitly (no template fallback) + template name passed straight through (the -review→-fix derivation was deleted) (P6 T3) ----

  it("T3: 非 dry-run 缺 handoffPath → throw（canonical naming；无 template-round fallback）", async () => {
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    await expect(
      DocsLifecycle.run({
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
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    await DocsLifecycle.run({
      harness: "claude",
      mode: "fix",
      template: "critiques-review",
      type: "spec",
      doc: SPEC_DOC,
      // 含 "review" 段 → node:fs fixture 的 existsSync 视为存在 → 走 read-and-validate 路径。
      handoffPath: "/repo/root/.kairos/cdd/foo/critiques-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    // The mock maps templates.renderTemplate to the hoisted docsRenderSpy — assert the spy directly
    // (renderTemplate is a mock-only surface, absent from the real module's exports).
    expect(docsRenderSpy.mock.calls.at(-1)?.[0]).toBe("critiques-review");
  });

  // ---- Status single-authority: review-type read-back overwrites (agent wrote a warn-only CHANGES_REQUESTED → overwritten to APPROVED) (T5) ----

  it("docs-runner 读回定稿（T7 writeOwnHandoff）：agent 写 warn-only CHANGES_REQUESTED → 文件 status 覆写为 APPROVED", async () => {
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });

    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const writeOwnHandoff = vi.mocked(
      (await import("../../artifacts/handoff/write.ts")).writeOwnHandoff,
    );
    const fs = await import("node:fs");
    const origRead = vi.mocked(fs.readFileSync).getMockImplementation();
    // 覆写读回 fixture：同一 canonical ws 前缀下，agent 写 status:CHANGES_REQUESTED + warn/nit findings
    //（engine 应派生覆写为 APPROVED 并持久化；findings 原样保留）。
    vi.mocked(fs.readFileSync).mockImplementation((p, enc) => {
      if (String(p).includes(".kairos/cdd/foo/")) {
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
      return origRead?.(p, enc) ?? "";
    });
    try {
      const result = (await DocsLifecycle.run({
        harness: "claude",
        mode: "review",
        template: "review",
        type: "spec",
        doc: SPEC_DOC,
        handoffPath: "/repo/root/.kairos/cdd/foo/spec-review-1.json",
        repoRoot: "/repo/root",
        dryRun: false,
      })) as DocsRunFixture;
      expect(result.exitCode).toBe(0);
      // after run/read-back, the status has been derived-overwritten to REVIEW_FIX (warn/nit = 0 blockers — Task 8 closure state)
      expect(result.handoff.status).toBe("REVIEW_FIX");
      expect(result.handoff.findings).toHaveLength(2);
      // overwrite persisted: writeOwnHandoff receives the full status=REVIEW_FIX handoff (full overwrite, not a shallow merge)
      const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
        String(p).endsWith("spec-review-1.json"),
      );
      expect(writeCall).toBeDefined();
      expect(writeCall?.[1].status).toBe("REVIEW_FIX");
      expect(writeCall?.[1].findings).toEqual([
        { severity: "warn", summary: "w" },
        { severity: "nit", summary: "n" },
      ]);
    } finally {
      if (origRead) vi.mocked(fs.readFileSync).mockImplementation(origRead);
    }
  });

  // ---- Review-mode doc_hash finalization injection — the engine is the carrier's sole author (T7) (P2 F5) ----

  it("review-mode 定稿注入 doc_hash：缺失 doc（mock 环境 ENOENT）→ 空串哨兵 + 内存返回值同步", async () => {
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const writeOwnHandoff = vi.mocked(
      (await import("../../artifacts/handoff/write.ts")).writeOwnHandoff,
    );
    const result = (await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc: SPEC_DOC, // does not exist → hashFile "" sentinel
      handoffPath: "/repo/root/.kairos/cdd/foo/spec-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    })) as DocsRunFixture;
    expect(result.handoff.status).toBe("APPROVED");
    expect(result.handoff.doc_hash).toBe(""); // in-memory return value in sync (§2.3.3)
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("spec-review-1.json"),
    );
    expect(writeCall?.[1].doc_hash).toBe(""); // the on-disk finalization carries doc_hash
    expect(writeCall?.[1].status).toBe("APPROVED");
  });

  it("review-mode doc_hash = 真实内容 sha256 hex（temp doc + 非 ws 前缀不被 mock 拦截）", async () => {
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p2hash-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const writeOwnHandoff = vi.mocked(
      (await import("../../artifacts/handoff/write.ts")).writeOwnHandoff,
    );
    const result = (await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath: "/repo/root/.kairos/cdd/foo/spec-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    })) as DocsRunFixture;
    expect(result.handoff.doc_hash).toBe(
      createHash("sha256").update("- **Version**: v1.0 · 2026-09-21\n").digest("hex"),
    );
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("spec-review-1.json"),
    );
    expect(writeCall?.[1].doc_hash).toBe(result.handoff.doc_hash);
  });

  it("fix-mode 不注入 doc_hash（p persistFinalized 原样；负向对称防误扩展）", async () => {
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const writeOwnHandoff = vi.mocked(
      (await import("../../artifacts/handoff/write.ts")).writeOwnHandoff,
    );
    await DocsLifecycle.run({
      harness: "claude",
      mode: "fix",
      template: "docs",
      type: "spec",
      doc: SPEC_DOC,
      findingsPath: "/repo/root/docs/findings.md",
      handoffPath: "/repo/root/.kairos/cdd/foo/spec-fix-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    });
    const fixCalls = writeOwnHandoff.mock.calls.filter(([p]) => String(p).includes("spec-fix-"));
    expect(fixCalls).toHaveLength(0); // fix-mode has no injection write
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
    const { DocsLifecycle } = await import("../docs.ts");
    const writeHandoff = vi.mocked((await import("../../artifacts/handoff/write.ts")).writeHandoff);
    // 真实落盘 mock：模块级 vi.mock 把 writeHandoff 换成 vi.fn() 不落盘 → BLOCKED 分支写盘后
    // JSON.parse(readFileSync(handoffPath)) 读回必 ENOENT（orphan 路径 node:fs mock 透传真实 fs）。
    // 注入真实写盘实现让读回成功（run-docs.mjs BLOCKED 分支强耦合同步读回，不可 stub 掉）。
    mockRealWriteBack(writeHandoff);
    const orphanPath = join(dir, "ws", "spec-review-1.json"); // non-.kairos/cdd/foo prefix → the existsSync mock falls through to real → the file does not exist → BLOCKED written to disk
    const result = (await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath: orphanPath,
      repoRoot: "/repo/root",
      dryRun: false,
    })) as DocsRunFixture;
    expect(result.exitCode).toBe(1);
    const writeCall = writeHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("spec-review-1.json"),
    );
    expect(writeCall?.[1].status).toBe("BLOCKED");
    expect(writeCall?.[1].doc_hash).toBe(
      createHash("sha256").update("- **Version**: v1.0 · 2026-09-21\n").digest("hex"),
    );
  });

  it("no-handoff boundary splits on the exit code (T7): exit 0 → ENGINE_SELF_WRITTEN discipline face; exit 143/1 → HARNESS_ABORT teardown + crash record", async () => {
    const execa = mockExeca((await import("execa")).execa);
    const dir = mkdtempSync(join(tmpdir(), "p2death-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const writeHandoff = vi.mocked((await import("../../artifacts/handoff/write.ts")).writeHandoff);
    mockRealWriteBack(writeHandoff);
    // Three faces of the same「no handoff after exit」boundary: exit 0 (contract break, NOT a death),
    // 143 (SIGTERM), 1 (run failure). T7: the rc ≠ 0 faces run the HARNESS_ABORT crash teardown
    // (crash record + resume), the rc === 0 face stays the ENGINE_SELF_WRITTEN discipline carrier;
    // the recovery carrier itself is deleted (crash record takes over the death diagnosis).
    const faces = [
      { rc: 0, category: "ENGINE_SELF_WRITTEN", crash: false },
      { rc: 143, category: "HARNESS_ABORT", crash: true },
      { rc: 1, category: "HARNESS_ABORT", crash: true },
    ];
    for (const [i, face] of faces.entries()) {
      execa.mockResolvedValue({ exitCode: face.rc, stdout: "", stderr: "", timedOut: false });
      const result = (await DocsLifecycle.run({
        harness: "claude",
        mode: "review",
        template: "review",
        type: "spec",
        doc,
        handoffPath: join(dir, `ws${i}`, "spec-review-1.json"),
        repoRoot: "/repo/root",
        dryRun: false,
      })) as DocsRunFixture;
      expect(result.exitCode).toBe(1);
      const writeCall = writeHandoff.mock.calls.at(-1); // exactly one carrier write per dispatch
      expect(String(writeCall?.[0])).toContain(`ws${i}`);
      expect(writeCall?.[1].failure_category).toBe(face.category);
      expect(writeCall?.[1].recovery).toBeUndefined(); // the stash-plane recovery carrier is deleted
      if (face.crash) {
        // Crash teardown: the crash record lands beside the handoff (lane "docs", round from the
        // canonical name). commitSnapshot fails open on the non-repo /repo/root → snapshotSha null.
        const crash = JSON.parse(readFileSync(join(dir, `ws${i}`, "crash-docs-1.json"), "utf8"));
        expect(crash.exitCode).toBe(face.rc);
        expect(crash.snapshotSha).toBeNull();
        expect(crash.cause).toBe(face.rc === 143 ? "child-signal" : "child-exit"); // unified-cause classification (T8)
        expect(crash.next).toContain("cdd review --type spec --spec");
      } else {
        expect(existsSync(join(dir, `ws${i}`, "crash-docs-1.json"))).toBe(false);
      }
    }
  });

  it("T8 docs unified cause: an engine-terminated (timedOut) no-handoff round routes to the TIMEOUT category with the unified cause — not HARNESS_ABORT/child-exit", async () => {
    const execa = mockExeca((await import("execa")).execa);
    const dir = mkdtempSync(join(tmpdir(), "p2term-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const writeHandoff = vi.mocked((await import("../../artifacts/handoff/write.ts")).writeHandoff);
    mockRealWriteBack(writeHandoff);
    // A signal-ended dispatch (spawnManaged folds res.signal === "SIGTERM" → timedOut + cause
    // "signal"): the engine-terminated face — same routing as the task lane's step 8.5 (TIMEOUT
    // category + the unified cause), never the HARNESS_ABORT/child-shape face of the child-exit lane.
    execa.mockResolvedValue({ exitCode: 143, stdout: "trace", stderr: "", signal: "SIGTERM" });
    const result = (await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath: join(dir, "ws", "spec-review-1.json"),
      repoRoot: "/repo/root",
      dryRun: false,
    })) as DocsRunFixture;
    expect(result.exitCode).toBe(1);
    expect(result.handoff.status).toBe("TIMEOUT");
    expect(result.handoff.failure_category).toBe("TIMEOUT");
    const crash = JSON.parse(readFileSync(join(dir, "ws", "crash-docs-1.json"), "utf8"));
    expect(crash.cause).toBe("child-signal"); // monitor cause "signal" → the signal-folding classification
    expect(crash.exitCode).toBe(143); // the 128+signo convention
    expect(crash.next).toContain("cdd review --type spec --spec");
  });

  it("T7 docs-fix repeat-abort: the stale HARNESS_ABORT carrier at the round-stable fix path is rotated pre-dispatch → the second abort re-fires the crash teardown (fresh crash record)", async () => {
    const execa = mockExeca((await import("execa")).execa);
    const dir = mkdtempSync(join(tmpdir(), "p2rot-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    const findingsPath = join(dir, "spec-review-1.json");
    writeFileSync(
      findingsPath,
      `${JSON.stringify(
        {
          phase: "review",
          status: "CHANGES_REQUESTED",
          findings: [{ severity: "blocker" }],
          artifacts: {},
        },
        null,
        2,
      )}\n`,
    );
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const writeHandoff = vi.mocked((await import("../../artifacts/handoff/write.ts")).writeHandoff);
    // The carrier must land on disk so the resume's rotation can read it (writeHandoff default mock
    // does not write).
    mockRealWriteBack(writeHandoff);
    const handoffPath = join(dir, "ws", "spec-fix-1.json");
    const runFix = () =>
      DocsLifecycle.run({
        harness: "claude",
        mode: "fix",
        template: "review",
        type: "spec",
        doc,
        findingsPath,
        handoffPath,
        repoRoot: "/repo/root",
        dryRun: false,
      });
    // Round 1: the docs fix agent aborts (exit 1, no handoff) → HARNESS_ABORT teardown + carrier at
    // the round-stable fix path.
    execa.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "round1-trace", timedOut: false });
    const r1 = (await runFix()) as DocsRunFixture;
    expect(r1.exitCode).toBe(1);
    expect(r1.handoff.failure_category).toBe("HARNESS_ABORT");
    const rec1 = JSON.parse(readFileSync(join(dir, "ws", "crash-docs-1.json"), "utf8"));
    expect(rec1.stderrTail).toContain("round1-trace");
    // Resume (same command — the docs fix round is pinned to the source review's round): the agent
    // aborts AGAIN with a new trace. The stale round-1 carrier must be rotated pre-dispatch so the
    // teardown re-fires with the resume session's output — the suppressed path would finalize from
    // the stale carrier and leave the round-1 record untouched.
    execa.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "round2-trace", timedOut: false });
    const r2 = (await runFix()) as DocsRunFixture;
    expect(r2.exitCode).toBe(1);
    expect(r2.handoff.failure_category).toBe("HARNESS_ABORT");
    const rec2 = JSON.parse(readFileSync(join(dir, "ws", "crash-docs-1.json"), "utf8"));
    expect(rec2.stderrTail).toContain("round2-trace"); // fresh record — the resume session's trace
    expect(existsSync(handoffPath)).toBe(true); // the fresh BLOCKED carrier replaced the rotated stale one
  });

  it("plan 家族镜像：review-mode type:plan 定稿注入 doc_hash（真实双族 handoff 断言）", async () => {
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p2planh-"));
    const doc = join(dir, "plan.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const writeOwnHandoff = vi.mocked(
      (await import("../../artifacts/handoff/write.ts")).writeOwnHandoff,
    );
    const result = (await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "plan",
      doc,
      handoffPath: "/repo/root/.kairos/cdd/foo/plan-review-1.json",
      repoRoot: "/repo/root",
      dryRun: false,
    })) as DocsRunFixture;
    expect(result.handoff.doc_hash).toBe(
      createHash("sha256").update("- **Version**: v1.0 · 2026-09-21\n").digest("hex"),
    );
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("plan-review-1.json"),
    );
    expect(writeCall?.[1].doc_hash).toBe(result.handoff.doc_hash);
  });

  // ---- Hardening: agent-write bad JSON (unescaped \d) → BLOCKED handoff, not throw (T8) ----

  it("T8-hardening: agent 手写坏 JSON（未转义 \\d）→ BLOCKED handoff 非 throw", async () => {
    const execa = mockExeca((await import("execa")).execa);
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
    const { DocsLifecycle } = await import("../docs.ts");
    const writeHandoff = vi.mocked((await import("../../artifacts/handoff/write.ts")).writeHandoff);
    // 真实落盘 mock：BLOCKED 分支写盘后 JSON.parse(readFileSync(handoffPath)) 同步读回必须成功。
    mockRealWriteBack(writeHandoff);
    const result = (await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath,
      repoRoot: "/repo/root",
      dryRun: false,
    })) as DocsRunFixture;
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
    const execa = mockExeca((await import("execa")).execa);
    execa.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
    const dir = mkdtempSync(join(tmpdir(), "p5cv-"));
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
    const handoffPath = join(dir, "ws", "spec-review-1.json"); // non-`.kairos/cdd/foo/` prefix → real fs
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
    const { recoverHandoff } = await import("../../artifacts/handoff/finalize.ts");
    schemaValidateSpy.mockImplementationOnce(() => ({
      valid: false,
      reason: "/findings must be array; /notes must be string",
    }));
    // 沿真实 recoverHandoff 语义：归一化结果**保留已声明键原值**（notes: 5 仍在内——正是旧载荷的泄漏源），
    // 重校验仍失败 → 调用方走 BLOCKED；findings 非数组 → preservedFindings 守卫成 []。
    vi.mocked(recoverHandoff).mockImplementationOnce(() => ({
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
    const writeOwnHandoff = vi.mocked(
      (await import("../../artifacts/handoff/write.ts")).writeOwnHandoff,
    );
    mockRealWriteBack(writeOwnHandoff); // the resume surface is irrecoverable → writeBlocked carries baseHandoff → full-overwrite write to disk

    vi.resetModules();
    const { DocsLifecycle } = await import("../docs.ts");
    const result = (await DocsLifecycle.run({
      harness: "claude",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath,
      repoRoot: "/repo/root",
      dryRun: false,
    })) as DocsRunFixture;
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
    expect(result.handoff.findings).toEqual([]); // non-array findings → the array guard yields []
    expect(result.handoff).not.toHaveProperty("notes");
    expect(result.handoff.blocker).toMatch(/notes/); // the offending key name lands in the blocker copy
    // 写盘全量覆盖（writeOwnHandoff），磁盘上不再有 agent 的违规键
    const writeCall = writeOwnHandoff.mock.calls.find(([p]) =>
      String(p).endsWith("spec-review-1.json"),
    );
    expect(writeCall).toBeDefined();
    expect(writeCall?.[1]).not.toHaveProperty("notes");
  });
});
