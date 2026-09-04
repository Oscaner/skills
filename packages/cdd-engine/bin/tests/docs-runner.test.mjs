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

vi.mock("../lib/registry.mjs", () => ({
  loadRegistry: vi.fn(() => ({})),
  checkHarness: vi.fn(() => ({
    cli: "claude",
    invoke: "-p --output-format text --dangerously-skip-permissions",
    output: "text",
  })),
}));

vi.mock("../lib/templates.mjs", () => ({
  PKG_ROOT: "/mock/pkg/root",
  renderHandoffStub: vi.fn(() => '{"phase":"review","status":"APPROVED","findings":[],"artifacts":{},"doc_path":""}'),
  renderTemplate: vi.fn(() => "mocked docs review prompt"),
}));

vi.mock("../lib/schema-utils.mjs", () => ({
  validateHandoffSchema: vi.fn(() => ({ valid: true })),
}));

// Selective node:fs mock: intercept schema + handoff reads; pass through everything else.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn((p) => {
      // Handoff file "exists" so we take the read-and-validate path (not writeHandoff BLOCKED path).
      if (String(p).includes("spec-review")) return true;
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
      if (String(p).includes("spec-review")) {
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
      template: "spec-review",
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
      template:  "spec-review",
      doc:       "/repo/root/docs/superpowers/specs/my-spec.md",
      params:    { PASS: "completeness" },
      workspace: "/repo/root/.superpowers/docs-review",
      repoRoot:  "/repo/root",  // accepted in opts but gitToplevel() is used (Bug L fix)
      dryRun:    false,
    });

    // execa called with cwd = '/repo/root' (gitToplevel mock value), NOT the doc directory.
    const callOpts = execa.mock.calls[0][2];
    expect(callOpts.cwd).toBe("/repo/root");
    expect(callOpts.cwd).not.toContain("docs/superpowers");
  });
});
