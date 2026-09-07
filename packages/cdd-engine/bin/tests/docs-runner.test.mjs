// packages/cdd-engine/bin/tests/docs-runner.test.mjs — Vitest port of docs-runner tests.
// Covers: dry-run path + Bug L regression (subprocess cwd = gitToplevel not doc directory).
// All file-touching modules are mocked for isolation (no real CLI, no real schema files needed).
import { vi, it, expect, describe, beforeEach } from "vitest";

// --- Module mocks (hoisted before imports) ---

vi.mock("execa", () => ({ execa: vi.fn() }));

vi.mock("../lib/contract.mjs", () => ({
  gitToplevel: vi.fn(() => "/repo/root"),
  writeHandoff: vi.fn(),
}));

vi.mock("../lib/registry.mjs", async () => {
  // Task 5: cli-shared 从 registry 导入 resolveInjection —— mock 复用真实实现，
  // checkHarness 返回带完整 operation×type prefix 的条目（验证 docs-runner type 透传注入）。
  const { resolveInjection } = await vi.importActual("../lib/registry.mjs");
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
  };
});

vi.mock("../lib/templates.mjs", () => ({
  PKG_ROOT: "/mock/pkg/root",
  renderHandoffStub: vi.fn(() => '{"phase":"review","status":"APPROVED","findings":[],"artifacts":{},"doc_path":""}'),
  renderTemplate: vi.fn(() => "mocked docs review prompt"),
}));

vi.mock("../lib/schema-utils.mjs", () => ({
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
      if (String(p).includes("review")) return true;
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
      if (String(p).includes("review")) {
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
    const { runDocsTask } = await import("../lib/docs-runner.mjs");
    const result = await runDocsTask({
      harness: "claude",
      mode: "review",
      template: "review",
      doc: "/spec.md",
      workspace: "/tmp/ws",
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
    const { runDocsTask } = await import("../lib/docs-runner.mjs");
    await runDocsTask({
      harness:   "claude",
      mode:      "review",
      template:  "review",
      doc:       "/repo/root/docs/superpowers/specs/my-spec.md",
      params:    { TYPE: "spec" },
      workspace: "/repo/root/.superpowers/docs-review",
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
    const { runDocsTask } = await import("../lib/docs-runner.mjs");
    // review×spec → prefix.review.spec="" → 无注入，prompt 保持模板渲染结果（首行）
    await runDocsTask({
      harness: "claude", mode: "review", template: "review", type: "spec",
      doc: "/repo/root/docs/superpowers/specs/my-spec.md",
      params: { TYPE: "spec" },
      workspace: "/repo/root/.superpowers/docs-review",
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
      workspace: "/repo/root/.superpowers/docs-review",
      dryRun: false,
    });
    promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split("\n")[0]).toBe("/mattpocock-skills:tdd");
    expect(promptArg.split("\n")[1]).toBe("mocked docs review prompt");
  });
});
